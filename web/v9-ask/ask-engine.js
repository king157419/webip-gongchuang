/* 问小智的检索引擎（纯前端，不调用任何大模型）。
 *
 * 做的事情只有三步，页面上会把每一步都摆出来给访客看：
 *   1. 拆词：把问题里的汉字切成两两相连的“两字词”（不会、会编、编程…），英文按单词切；
 *   2. 比对：每份资料也这样切好，用 TF-IDF 给每个词打权重（这份资料里出现得多、别的资料里少见的词更重要），
 *      再算问题和每份资料的余弦相似度，0 到 1；
 *   3. 摘原文：只拿得分最高那份资料的原话回答；最高分太低就说没找到，不猜。
 * 资料全部来自 window.CLUB（后台维护的内容），管理员加一条新闻，小智就多读一份。
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZhiAsk = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // 单独出现时不带信息的字（只影响单字匹配，两字词照常保留）
  var STOP = '的了是吗么呢啊吧呀哦嘛在我你他她它们有和与及或就都也还又被把这那个些怎什能会可以要想去来到吧对给让得着过很';

  // 同义扩展：访客的说法 → 资料里的说法。页面会把扩展出来的词标出来，不藏。
  var SYN = [
    { re: /编程|代码|写程序|零基础|小白|没基础|没有基础|新手|不懂/, add: ['零基础', '从零开始', '不会编程'] },
    { re: /在哪|哪里|地点|地方|教室|位置|几楼/, add: ['活动地点', '翔英大楼'] },
    { re: /加入|报名|招新|入社|进社|参加社团|怎么进|纳新/, add: ['加入', '招新', '报名'] },
    { re: /联系|微信|qq|群|邮箱|公众号/i, add: ['联系', '公众号'] },
    { re: /比赛|竞赛|大赛|参赛/, add: ['大赛', '创新大赛'] },
    { re: /参观|参访|企业|公司|大会/, add: ['参访', '参观'] },
    { re: /焊|烙铁|电路|动手/, add: ['焊接', '焊点'] },
    { re: /大模型|llm|gpt|transformer|bert|模型/i, add: ['大模型', 'Transformer', 'BERT'] },
    { re: /深度学习|神经网络|机器学习|训练/, add: ['深度学习', '模型'] },
    { re: /论文|科研|保研|读研|导师/, add: ['论文', '科研'] },
    { re: /社长|负责人|谁管|会长/, add: ['社长'] },
    { re: /老师/, add: ['指导老师'] },
    { re: /最近|最新|近期|这学期|下次|下一次|预告|什么时候/, add: ['最近的活动', '活动预告'] },
    { re: /部门|学术部|组织部|宣传部|办公部|干事/, add: ['部门'] },
    { re: /华为|昇腾|昇思|mindspore|鸿蒙|鲲鹏/i, add: ['华为', '昇腾'] },
    { re: /学什么|学到|课程|上课|讲座|分享/, add: ['课程', '分享'] },
    { re: /其他学院|别的学院|外院|非通信|全校|只能/, add: ['面向全校', '通信学院'] }
  ];

  var HAN = /[㐀-鿿]+/g;
  var ASC = /[a-z0-9]+/gi;

  function isStop(ch) { return STOP.indexOf(ch) >= 0; }

  // 把一段话切成词：两字词权重 1，单字 0.25（只在问题很短时起作用），英文单词 1
  function tokenize(text) {
    var out = [];
    var s = String(text || '');
    var m;
    HAN.lastIndex = 0;
    while ((m = HAN.exec(s))) {
      var run = m[0];
      for (var i = 0; i < run.length; i++) {
        var c = run[i];
        if (!isStop(c)) out.push({ t: c, w: 0.25, kind: 'uni' });
        if (i + 1 < run.length) {
          var bi = run.substr(i, 2);
          if (!(isStop(bi[0]) && isStop(bi[1]))) out.push({ t: bi, w: 1, kind: 'bi' });
        }
      }
    }
    ASC.lastIndex = 0;
    while ((m = ASC.exec(s))) {
      var w = m[0].toLowerCase();
      if (w.length >= 2) out.push({ t: w, w: 1, kind: 'en' });
    }
    return out;
  }

  function bag(tokens, mult, into) {
    into = into || {};
    for (var i = 0; i < tokens.length; i++) {
      var k = tokens[i];
      into[k.t] = (into[k.t] || 0) + k.w * (mult || 1);
    }
    return into;
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function shortDate(d) {
    var p = String(d || '').split('-');
    return p.length === 3 ? (+p[1]) + '·' + pad2(+p[2]) : '';
  }
  function cleanTitle(t) {
    // 报道标题常是“口号 | 正文”，取口号做短标题
    var s = String(t || '');
    var parts = s.split(/\s*[|丨]\s*|\s*——\s*/);
    var best = parts.length > 1 ? parts[0] : s;
    return best.replace(/^[“”"\s]+|[“”"\s]+$/g, '').replace(/[“”]/g, '');
  }

  var MARK = { weld: '焊', course: '课', visit: '访', contest: '赛', talk: '讲' };

  // 从后台内容生成小智能读到的全部资料
  function buildDocs(C) {
    C = C || {};
    var meta = C.meta || {}, join = C.join || {}, people = C.people || {};
    var programs = C.programs || [], news = (C.news || []).slice();
    var docs = [];
    function add(d) { d.i = docs.length; docs.push(d); }
    var WX = (meta.contact && meta.contact.wechat) || '上海大学通信学院（公众号）';
    var wxName = WX.replace(/（.*?）|\(.*?\)/g, '');

    news.sort(function (a, b) { return a.date < b.date ? 1 : -1; });

    // 1) 学院官网报道
    news.forEach(function (n) {
      var ym = String(n.date || '').split('-');
      var lead = ym.length === 3 ? '最相关的是 ' + ym[0] + ' 年 ' + (+ym[1]) + ' 月的《' + cleanTitle(n.title) + '》：' : '';
      add({
        kind: 'news', group: 'news', mark: MARK[n.cat] || '事', cat: n.cat,
        date: n.date, tag: shortDate(n.date), year: String(n.date || '').slice(0, 4),
        title: n.title, short: cleanTitle(n.title), body: n.summary || '',
        answer: lead + (n.summary || n.title), url: n.source || null,
        cite: String(n.date || '').replace(/-/g, '.') + ' 学院官网报道'
      });
    });

    // 2) 社团资料
    var faq = join.faq || [];
    faq.forEach(function (f) {
      add({ kind: 'faq', group: 'club', mark: '问', tag: '问答', title: f.q, short: f.q, body: f.a, answer: f.a, cite: '常见问题' });
    });

    if (meta.intro) {
      add({
        kind: 'intro', group: 'club', mark: '社', tag: '简介', short: '社团简介',
        title: '社团简介 这是什么社团 是做什么的',
        body: [meta.intro, meta.type, meta.host, meta.founded ? meta.founded + ' 年成立' : '', meta.audience].join(' '),
        answer: meta.intro + (meta.founded ? '社团成立于 ' + meta.founded + ' 年。' : ''), cite: '社团简介'
      });
    }

    var depts = meta.departments || [];
    if (depts.length) {
      add({
        kind: 'dept', group: 'club', mark: '部', tag: '部门', short: '四个部门',
        title: '部门 有哪些部门 干事',
        body: depts.map(function (d) { return d.name + ' ' + d.desc; }).join(' '),
        answer: '社团有 ' + depts.length + ' 个部门：' + depts.map(function (d) { return d.name + '（' + d.desc + '）'; }).join('、') + '。',
        cite: '社团简介'
      });
    }

    if (meta.location) {
      add({
        kind: 'place', group: 'club', mark: '址', tag: '地点', short: '活动地点',
        title: '活动地点 在哪 地方', body: meta.location,
        answer: '活动多在' + meta.location.replace(/（/, '，').replace(/）/, '') + '。企业参访另行通知集合地点。',
        cite: '社团简介'
      });
    }

    programs.forEach(function (p) {
      var cnt = news.filter(function (n) { return n.cat === p.id; }).length;
      add({
        kind: 'prog', group: 'club', mark: MARK[p.id] || '事', tag: '常办', cat: p.id,
        title: p.name + ' 常办活动', short: p.name, body: p.desc + ' 地点 ' + (p.where || ''),
        answer: p.name + '：' + p.desc + (p.where ? '常在' + p.where + '。' : '') + (cnt ? '学院官网报道过 ' + cnt + ' 次。' : ''),
        cite: '常办活动'
      });
    });

    (people.leaders || []).forEach(function (p) {
      add({
        kind: 'person', group: 'club', mark: '长', tag: p.role, short: p.role + p.name,
        title: p.role + ' ' + p.name + ' 是谁',
        body: p.desc + ' ' + (p.awards || []).join(' '),
        answer: p.role + '是' + p.name + '。' + p.desc, cite: '社长介绍'
      });
    });
    (people.teachers || []).forEach(function (p) {
      add({
        kind: 'person', group: 'club', mark: '师', tag: '老师', short: '指导老师' + p.name,
        title: '指导老师 ' + p.name, body: p.role + ' ' + p.desc,
        answer: p.name + '，' + p.role.replace(/\s*·\s*/, '，') + '。' + p.desc, cite: '指导老师'
      });
    });

    var steps = join.steps || [];
    if (steps.length) {
      add({
        kind: 'join', group: 'club', mark: '入', tag: '加入', short: '怎么加入',
        title: '怎么加入 招新 报名 入社',
        body: steps.map(function (s) { return s.t + ' ' + s.d; }).join(' '),
        answer: steps.map(function (s, k) { return (k + 1) + '. ' + s.t + '：' + s.d; }).join(' ') +
          (join.formUrl ? '' : ' 报名表还没发布。'),
        cite: '加入方式'
      });
    }

    if (news.length) {
      var recent = news.slice(0, 3);
      add({
        kind: 'recent', group: 'club', mark: '新', tag: '近况', short: '最近的活动',
        title: '最近的活动 最新动态 活动预告 下一次活动',
        body: recent.map(function (n) { return n.title; }).join(' '),
        answer: '下一次活动还没有发布，预告会发在「' + wxName + '」公众号。最近办过的三次：' +
          recent.map(function (n) { return String(n.date).replace(/-/g, '.') + '《' + cleanTitle(n.title) + '》'; }).join('；') + '。',
        cite: '学院官网报道'
      });
    }
    return docs;
  }

  // 建索引：每份资料一个 TF-IDF 向量
  function Index(docs) {
    this.docs = docs;
    var N = docs.length, df = {}, raw = [];
    docs.forEach(function (d) {
      var b = bag(tokenize(d.title), 2);
      bag(tokenize(d.short), 1, b);
      bag(tokenize(d.body), 1, b);
      raw.push(b);
      Object.keys(b).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    var idf = {};
    Object.keys(df).forEach(function (t) { idf[t] = Math.log((N + 1) / (df[t] + 1)) + 1; });
    this.idf = idf;
    this.vecs = raw.map(function (b) {
      var v = {}, n = 0;
      Object.keys(b).forEach(function (t) { var x = (1 + Math.log(b[t])) * idf[t]; v[t] = x; n += x * x; });
      return { v: v, n: Math.sqrt(n) || 1 };
    });
  }

  Index.prototype.query = function (q, opts) {
    opts = opts || {};
    var minScore = opts.minScore != null ? opts.minScore : 0.1;
    var qtoks = tokenize(q);
    var qb = bag(qtoks, 1);
    var expanded = [];
    SYN.forEach(function (r) {
      if (r.re.test(q)) r.add.forEach(function (w) {
        if (expanded.indexOf(w) < 0) { expanded.push(w); bag(tokenize(w), 0.6, qb); }
      });
    });
    var idf = this.idf;
    var qv = {}, qn = 0;
    Object.keys(qb).forEach(function (t) {
      if (!idf[t]) return;                              // 资料里从没出现过的词，对比对没有贡献
      var x = qb[t] * idf[t]; qv[t] = x; qn += x * x;
    });
    qn = Math.sqrt(qn) || 1;

    var hasBi = qtoks.some(function (k) { return k.kind !== 'uni'; });
    var scores = this.vecs.map(function (dv, i) {
      var dot = 0, strong = false, hit = [];
      for (var t in qv) {
        if (dv.v[t]) { dot += qv[t] * dv.v[t]; hit.push(t); if (t.length > 1) strong = true; }
      }
      return { i: i, s: dot / (qn * dv.n), strong: strong, hit: hit };
    });
    var ranked = scores.slice().sort(function (a, b) { return b.s - a.s; });
    var top = ranked[0];
    // 只靠单字撞上的不算数（除非问题本身就只有单字）
    var ok = !!top && top.s >= minScore && (top.strong || !hasBi);

    // 页面上的“拆词”一行：每个两字词/英文词有没有在资料里出现过
    var seen = {};
    var terms = qtoks.filter(function (k) { return k.kind !== 'uni' || !hasBi; }).filter(function (k) {
      if (seen[k.t]) return false; seen[k.t] = 1; return true;
    }).map(function (k) { return { t: k.t, known: !!idf[k.t] }; });

    return {
      q: q, ok: ok, terms: terms, expanded: expanded,
      scores: scores.map(function (x) { return x.s; }),
      ranked: ranked.slice(0, 3).map(function (x) { return { i: x.i, s: x.s, hit: x.hit }; }),
      best: ok ? top.i : -1
    };
  };

  return { tokenize: tokenize, buildDocs: buildDocs, Index: Index, cleanTitle: cleanTitle };
});
