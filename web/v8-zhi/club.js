/* 社团内容渲染：全部从 ../shared/content.js（window.CLUB）读取，缺的显示“待补充”。
 * 首页（data-page="index"）和资料页（data-page="more"）共用。 */
(function () {
  'use strict';
  var C = window.CLUB || {};
  var meta = C.meta || {}, join = C.join || {}, people = C.people || {};
  var news = C.news || [], programs = C.programs || [];
  var page = document.body.getAttribute('data-page');

  /* ---------- 小工具 ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }
  // 中文和英文、数字之间加空格
  function sp(s) {
    return String(s == null ? '' : s)
      .replace(/([㐀-鿿])([A-Za-z0-9])/g, '$1 $2')
      .replace(/([A-Za-z0-9%])([㐀-鿿])/g, '$1 $2');
  }
  function t(s) { return esc(sp(s)); }
  var TBD = '<span class="tbd">待补充</span>';
  function val(v) { return v == null || v === '' || v === '待补充' ? TBD : t(v); }
  function $(id) { return document.getElementById(id); }
  function set(id, html) { var el = $(id); if (el) el.innerHTML = html; }
  function prog(id) { for (var i = 0; i < programs.length; i++) if (programs[i].id === id) return programs[i]; return null; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function ext(url) { return /^https?:\/\//.test(url || '') ? ' target="_blank" rel="noopener"' : ''; }

  /* 从新闻摘要里取出活动日期和地点，从标题里取出一句话。取不到就退回报道日期、活动类型的常用地点。 */
  function parseNews(n) {
    var s = n.summary || '', rd = (n.date || '').split('-');
    var date = rd.length === 3 ? rd.join('.') : (n.date || '');
    var m = s.match(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/);
    if (m && rd.length === 3) {
      var y = m[1] ? +m[1] : +rd[0], mo = +m[2];
      if (!m[1] && mo > +rd[1]) y -= 1;
      date = y + '.' + pad2(mo) + '.' + pad2(+m[3]);
    }
    var place = null, re = /(?:在|于|赴|走进)([^，。；]{2,24}?)(?=举办|开展|举行|参加|，|。|；)/g, pm;
    while ((pm = re.exec(s))) { if (/大楼|中心|学堂|空间|[A-Z]{1,2}\d{3}|\d{3}/.test(pm[1])) { place = pm[1]; break; } }
    if (!place) { var p = prog(n.cat); place = p && p.where ? p.where.split(' / ')[0] : null; }
    var line = n.title || '';
    var cut = Math.max(line.lastIndexOf('|'), line.lastIndexOf('——'));
    if (cut >= 0) line = line.slice(cut + (line.charAt(cut) === '|' ? 1 : 2));
    line = line.trim()
      .replace(/（附公示）$/, '')
      .replace(/暨主题(?:趣味焊接)?团日活动$/, '')
      .replace(/^(?:上海大学)?人工智能社团?/, '社团');
    return { date: date, place: place, line: line, source: n.source, title: n.title, summary: s, cat: n.cat };
  }
  var parsed = news.map(parseNews);

  function newsItem(p, full) {
    var head = '<span class="news__date num">' + esc(p.date) + '</span><span class="dot" aria-hidden="true">·</span>' +
      '<span class="news__place">' + (p.place ? t(p.place) : TBD) + '</span><span class="dot" aria-hidden="true">·</span>';
    if (!full) {
      return '<li><a class="news__a" href="' + esc(p.source) + '"' + ext(p.source) + '>' + head +
        '<span class="news__line">' + t(p.line) + '</span></a></li>';
    }
    return '<li class="news--full"><p class="news__meta">' + head.replace(/<span class="dot"[^>]*>·<\/span>$/, '') + '</p>' +
      '<h3 class="news__title"><a href="' + esc(p.source) + '"' + ext(p.source) + '>' + t(p.title) + '</a></h3>' +
      '<p class="news__sum">' + t(p.summary) + '</p></li>';
  }

  document.querySelectorAll('[data-club="name"]').forEach(function (el) { if (meta.name) el.textContent = meta.name; });
  if ($('foot-host')) $('foot-host').textContent = meta.host ? '，挂靠' + meta.host : '';

  function joinAction() {
    var btn = join.formUrl
      ? '<a class="btn btn--main" href="' + esc(join.formUrl) + '"' + ext(join.formUrl) + '>填写报名表</a>'
      : '<span class="btn btn--main is-off" role="link" aria-disabled="true">报名表 <span class="tbd tbd--inv">待补充</span></span>';
    var wx = meta.contact && meta.contact.wechat;
    return btn +
      '<p class="join__meta">招新时间：' + val(join.season) + '</p>' +
      '<p class="join__meta">招新和活动预告发在' + (wx ? '「' + t(wx.replace(/（公众号）$/, '')) + '」公众号' : TBD) + '。</p>';
  }

  /* =================== 首页 =================== */
  if (page === 'index') {
    var course = prog('course'), weld = prog('weld');

    function q(s) { return '「' + esc(s) + '」'; }
    function facts(d) {
      d = d || { total: 0, counts: [0, 0], names: ['举手', '不举手'], numbers: 768, last: null, mode: 'draw', k: 5 };
      var verb = d.mode === 'camera' ? '拍' : '画';
      var li = [];
      if (!d.total) {
        li.push('<b class="num">0</b> 张例子。你还没教过小智，所以它什么都认不出来。');
      } else {
        li.push('<b class="num">' + d.total + '</b> 张例子是你' + verb + '的：' + q(d.names[0]) + d.counts[0] + ' 张，' + q(d.names[1]) + d.counts[1] + ' 张。');
      }
      li.push('<b class="num">' + d.numbers + '</b> 个数字，就是每张例子在小智眼里的全部：32 × 24 个格子的明暗。');
      if (d.last) {
        li.push('<b class="num">第 ' + d.last.id + ' 张</b>' + q(d.names[d.last.label]) + '，是它最后一次认出你时，找到的最像的那张。');
      } else {
        li.push('<b>第几张</b>？两类都有例子、它认出你之后，这里会写出它是靠你给的哪一张认出你的。');
      }
      set('facts', li.map(function (x) { return '<li>' + x + '</li>'; }).join(''));
    }
    facts(null);
    document.addEventListener('zhi:update', function (e) { facts(e.detail); });

    set('bridge',
      '小智并不懂你在做什么，它只是把你和每张例子比了一遍，再让最像的 5 张投票。这种办法叫 k 近邻，是机器学习里最朴素的一种。' +
      (course ? '社团的<b>' + t(course.name) + '</b>从这里往前走，是' + t(course.desc) : '') +
      (weld ? '<b>' + t(weld.name) + '</b>则在动手的另一头：' + t(weld.desc) : ''));

    // 几个真实数字
    var stats = [];
    if (meta.founded) stats.push([meta.founded, '年成立']);
    stats.push([news.length, '篇学院官网报道']);
    stats.push([programs.length, '类活动']);
    set('stats', stats.map(function (s) {
      return '<div class="stat"><dt class="stat__n num">' + esc(s[0]) + '</dt><dd class="stat__l">' + esc(s[1]) + '</dd></div>';
    }).join(''));

    var latest = parsed[0];
    if (latest) {
      var ld = latest.date.split('.');
      set('alive-line', '从 ' + (meta.founded || TBD) + ' 年到现在，学院官网报道过社团的 ' + news.length + ' 次活动，最近一次是 ' +
        ld[0] + ' 年 ' + (+ld[1]) + ' 月。');
    }
    set('news', parsed.slice(0, 3).map(function (p) { return newsItem(p, false); }).join('') ||
      '<li>' + TBD + '</li>');

    set('join-who', meta.audience ? '面向' + t(meta.audience) + '。' : TBD);
    set('steps', (join.steps || []).map(function (s, i) {
      return '<li><span class="steps__i num">' + (i + 1) + '</span><span class="steps__t">' + t(s.t) + '</span><span class="steps__d">' + t(s.d) + '</span></li>';
    }).join('') || '<li>' + TBD + '</li>');
    set('join-act', joinAction());
  }

  /* =================== 资料页 =================== */
  if (page === 'more') {
    set('m-intro', meta.intro ? t(meta.intro) : TBD);
    var rows = [
      ['类型', meta.type], ['挂靠单位', meta.host], ['成立', meta.founded ? meta.founded + ' 年' : null],
      ['面向', meta.audience], ['活动地点', meta.location], ['成员人数', meta.members],
      ['邮箱', meta.contact && meta.contact.email], ['QQ 群', meta.contact && meta.contact.qqGroup],
      ['公众号', meta.contact && meta.contact.wechat]
    ];
    set('m-facts', rows.map(function (r) { return '<div><dt>' + esc(r[0]) + '</dt><dd>' + val(r[1]) + '</dd></div>'; }).join(''));

    set('m-depts', (meta.departments || []).map(function (d) {
      return '<li><b>' + t(d.name) + '</b>' + t(d.desc) + '</li>';
    }).join('') || '<li>' + TBD + '</li>');

    set('m-programs', programs.map(function (p) {
      var n = news.filter(function (x) { return x.cat === p.id; }).length;
      return '<li><h3>' + t(p.name) + '</h3><p>' + t(p.desc) + '</p><p class="small">地点：' + val(p.where) + '<span class="dot">·</span>报道 <span class="num">' + n + '</span> 篇</p></li>';
    }).join('') || '<li>' + TBD + '</li>');

    set('m-news-n', String(news.length));
    set('m-news', parsed.map(function (p) { return newsItem(p, true); }).join('') || '<li>' + TBD + '</li>');

    set('m-honors', (C.honors || []).map(function (h) {
      return '<li><span class="num honors__y">' + esc(h.year) + '</span><span>' + t(h.text) +
        (h.source ? ' <a href="' + esc(h.source) + '"' + ext(h.source) + '>原文</a>' : '') + '</span></li>';
    }).join('') || '<li>' + TBD + '</li>');

    function person(p) {
      var img = p.photo ? '<img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '的照片" width="96" height="96" loading="lazy">'
        : '<span class="person__ph" aria-hidden="true">' + esc((p.name || '').charAt(0)) + '</span>';
      var aw = (p.awards || []).length ? '<ul class="person__aw">' + p.awards.map(function (a) { return '<li>' + t(a) + '</li>'; }).join('') + '</ul>' : '';
      return '<li class="person">' + img + '<div><h3>' + t(p.name) + '</h3><p class="small">' + t(p.role) + '</p>' +
        '<p>' + (p.desc ? t(p.desc) : TBD) + '</p>' + aw + (p.photo ? '' : '<p class="small">照片' + TBD + '</p>') + '</div></li>';
    }
    set('m-people', (people.leaders || []).concat(people.teachers || []).map(person).join('') || '<li>' + TBD + '</li>');

    set('m-steps', (join.steps || []).map(function (s, i) {
      return '<li><span class="steps__i num">' + (i + 1) + '</span><span class="steps__t">' + t(s.t) + '</span><span class="steps__d">' + t(s.d) + '</span></li>';
    }).join('') || '<li>' + TBD + '</li>');
    set('m-join-act', joinAction());
    set('m-faq', (join.faq || []).map(function (f) {
      return '<div><dt>' + t(f.q) + '</dt><dd>' + t(f.a) + '</dd></div>';
    }).join('') || TBD);
  }
})();
