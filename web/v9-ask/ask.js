/* v9「问小智」页面逻辑：渲染资料盘、实时检索、展示依据。所有数据来自 window.CLUB。 */
(function () {
  'use strict';
  var C = window.CLUB || {};
  var meta = C.meta || {}, join = C.join || {};
  var Z = window.ZhiAsk;
  var docs = Z.buildDocs(C);
  var idx = new Z.Index(docs);

  var MIN = 0.1;   // 最高分低于它就说没找到（ask-engine 里同样的默认值）
  var CHIPS = ['不会编程能来吗？', '活动在哪？', '最近办了什么？', '能学大模型吗？', '怎么加入？'];
  var CAT = { weld: '焊接课', course: '昇腾 AI 课', visit: '企业参访', contest: 'AI 创新大赛', talk: '分享会' };
  var WX = ((meta.contact && meta.contact.wechat) || '上海大学通信学院（公众号）').replace(/（.*?）|\(.*?\)/g, '');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function f2(x) { return x.toFixed(2); }

  // ---------- 静态信息 ----------
  document.querySelectorAll('[data-club="name"]').forEach(function (e) { if (meta.name) e.textContent = meta.name; });
  document.querySelectorAll('[data-club="short"]').forEach(function (e) { if (meta.short) e.textContent = meta.short; });
  if (meta.founded) $('founded').textContent = meta.founded;
  $('next-line').textContent = '还没发布，留意「' + WX + '」公众号';
  $('doc-n').textContent = docs.length;
  if (meta.host) $('foot-host').textContent = '挂靠' + meta.host;
  $('join-who').textContent = (meta.audience ? '面向' + meta.audience + '。' : '') + '不用先报名，可以先来一次活动看看。';
  var steps = $('steps');
  (join.steps || []).forEach(function (s, i) {
    var li = el('li');
    li.appendChild(el('span', 'steps__n num', String(i + 1)));
    var d = el('div');
    d.appendChild(el('h3', null, s.t));
    d.appendChild(el('p', null, s.d));
    li.appendChild(d);
    steps.appendChild(li);
  });
  var nNews = docs.filter(function (d) { return d.kind === 'news'; }).length;
  var more = document.querySelector('.more-link a');
  if (more) more.textContent = '更多社团资料：全部 ' + nNews + ' 篇报道、社长和指导老师、部门、常见问题';

  // ---------- 资料盘 ----------
  var body = $('case-body');
  var tiles = [];
  function tile(d) {
    var b = el('button', 't');
    b.type = 'button';
    b.dataset.i = d.i;
    b.dataset.kind = d.group;
    b.setAttribute('aria-label', (d.date ? d.date + ' ' : '') + d.short);
    b.title = d.short;
    b.style.setProperty('--k', tiles.filter(Boolean).length);
    b.appendChild(el('span', 't__ch', d.mark));
    b.appendChild(el('span', 't__tag num', d.tag));
    b.appendChild(el('span', 't__rank num'));
    b.addEventListener('click', function () { pick(d.i); });
    tiles[d.i] = b;
    return b;
  }
  function row(label, list, cls) {
    var r = el('div', 'row' + (cls ? ' ' + cls : ''));
    r.appendChild(el('span', 'row__k num', label));
    var box = el('div', 'row__t');
    list.forEach(function (d) { box.appendChild(tile(d)); });
    r.appendChild(box);
    body.appendChild(r);
  }
  var years = {};
  docs.forEach(function (d) { if (d.kind === 'news') (years[d.year] = years[d.year] || []).push(d); });
  Object.keys(years).sort().reverse().forEach(function (y) { row(y, years[y]); });
  row('社团', docs.filter(function (d) { return d.group === 'club'; }), 'row--club');

  // 图例：每类活动报道过几次
  var cnt = {};
  docs.forEach(function (d) { if (d.kind === 'news') cnt[d.cat] = (cnt[d.cat] || 0) + 1; });
  var legend = $('legend');
  Object.keys(CAT).forEach(function (k) {
    if (!cnt[k]) return;
    var s = el('span', 'lg');
    s.appendChild(el('b', null, docs.filter(function (d) { return d.cat === k; })[0].mark));
    s.appendChild(document.createTextNode(CAT[k] + ' '));
    s.appendChild(el('span', 'num', String(cnt[k])));
    legend.appendChild(s);
  });
  var lgq = el('span', 'lg');
  lgq.appendChild(el('b', null, '问'));
  lgq.appendChild(document.createTextNode('常见问题'));
  legend.appendChild(lgq);

  // ---------- 检索与展示 ----------
  var caseEl = $('case'), ans = $('ans'), terms = $('terms');
  var input = $('q'), clear = $('q-clear');

  function paint(scores, ranked, ok) {
    var topS = ranked.length ? ranked[0].s : 0;
    var ref = Math.max(topS, 0.35);
    tiles.forEach(function (t, i) {
      var s = scores ? scores[i] : 0;
      var v = s < 0.008 ? 0 : Math.pow(Math.min(1, s / ref), 0.55);
      t.style.setProperty('--v', v.toFixed(3));
      t.classList.toggle('is-hot', v > 0.55);
      t.querySelector('.t__rank').textContent = '';
      t.removeAttribute('data-rank');
      t.setAttribute('aria-pressed', 'false');
    });
    if (ok) ranked.forEach(function (r, k) {
      if (r.s < 0.015) return;
      var t = tiles[r.i];
      t.dataset.rank = k + 1;
      t.querySelector('.t__rank').textContent = f2(r.s);
    });
  }

  function chip(text, cls, title) {
    var s = el('span', 'tk' + (cls ? ' ' + cls : ''), text);
    if (title) s.title = title;
    return s;
  }

  function showTerms(res, ms) {
    terms.textContent = '';
    if (!res) return;
    if (!res.terms.length && !res.expanded.length) return;
    terms.appendChild(el('span', 'terms__k', '拆成'));
    res.terms.forEach(function (t) {
      terms.appendChild(chip(t.t, t.known ? '' : 'tk--off', t.known ? '' : '资料里没出现过这个词'));
    });
    if (res.expanded.length) {
      terms.appendChild(el('span', 'terms__k', '同义补上'));
      res.expanded.forEach(function (w) { terms.appendChild(chip(w, 'tk--syn')); });
    }
    terms.appendChild(el('span', 'terms__k terms__time',
      '和 ' + docs.length + ' 份资料逐一比对，' + (ms < 1 ? '用时不到 1 毫秒' : '用时 ' + Math.round(ms) + ' 毫秒')));
  }

  function srcLine(d, s) {
    var p = $('ans-src');
    p.textContent = '';
    p.appendChild(el('span', 'ans__k', '依据'));
    p.appendChild(document.createTextNode(d.cite + (d.kind === 'news' ? '《' + d.short + '》' : '')));
    if (d.url) {
      var a = el('a', null, '看原文');
      a.href = d.url; a.target = '_blank'; a.rel = 'noopener';
      p.appendChild(document.createTextNode(' '));
      p.appendChild(a);
    }
    if (s != null) p.appendChild(el('span', 'ans__score num', '相似度 ' + f2(s)));
  }

  function rankList(res) {
    var ol = $('ans-rank');
    ol.textContent = '';
    if (!res) return;
    var topS = res.ranked[0] ? res.ranked[0].s : 1;
    res.ranked.forEach(function (r, k) {
      if (r.s < 0.015) return;
      var d = docs[r.i];
      var li = el('li');
      var b = el('button', 'rk');
      b.type = 'button';
      b.appendChild(el('span', 'rk__n num', String(k + 1)));
      b.appendChild(el('span', 'rk__m', d.mark));
      b.appendChild(el('span', 'rk__t', (d.tag && d.kind === 'news' ? d.year + '.' + d.tag.replace('·', '.') + ' ' : '') + d.short));
      var bar = el('span', 'rk__bar');
      var fill = el('i');
      fill.style.width = Math.max(4, Math.round(r.s / topS * 100)) + '%';
      bar.appendChild(fill);
      b.appendChild(bar);
      b.appendChild(el('span', 'rk__s num', f2(r.s)));
      b.addEventListener('click', function () { pick(r.i); });
      li.appendChild(b);
      ol.appendChild(li);
    });
    if (ol.children.length) {
      var cap = el('li', 'rk__cap', '相关度最高的 ' + ol.children.length + ' 份，点一下看原文');
      ol.insertBefore(cap, ol.firstChild);
    }
  }

  var last = null;
  function run(q) {
    q = q.trim();
    clear.hidden = !input.value;
    if (!q) {
      last = null;
      caseEl.dataset.state = 'idle';
      paint(null, [], false);
      showTerms(null);
      ans.hidden = true;
      howLive(null);
      return;
    }
    var t0 = performance.now();
    var res = idx.query(q, { minScore: MIN });
    var ms = performance.now() - t0;
    last = res;
    caseEl.dataset.state = res.ok ? 'hit' : 'miss';
    paint(res.scores, res.ranked, res.ok);
    showTerms(res, ms);
    ans.hidden = false;
    ans.dataset.state = res.ok ? 'hit' : 'miss';
    if (res.ok) {
      var d = docs[res.best];
      $('ans-text').textContent = d.answer;
      srcLine(d, res.ranked[0].s);
      rankList(res);
    } else {
      $('ans-text').textContent = '社团资料里没找到和“' + q + '”相关的内容，我就不瞎猜了。可以到「' + WX + '」公众号留言问问。';
      var p = $('ans-src');
      p.textContent = '';
      p.appendChild(el('span', 'ans__k', '为什么'));
      var topS = res.ranked[0] ? res.ranked[0].s : 0;
      p.appendChild(document.createTextNode('最相关的一份资料相似度只有 '));
      p.appendChild(el('span', 'num', f2(topS)));
      p.appendChild(document.createTextNode('，低于 ' + f2(MIN) + ' 就不回答。'));
      rankList(null);
    }
    howLive(res);
  }

  // 点资料盘里的一格：直接看这份资料
  function pick(i) {
    var d = docs[i];
    stopTyping();
    ans.hidden = false;
    ans.dataset.state = 'pick';
    $('ans-text').textContent = d.answer;
    srcLine(d, last && last.scores ? last.scores[i] : null);
    rankList(last && last.ok ? last : null);
    tiles.forEach(function (t) { t.setAttribute('aria-pressed', 'false'); });
    tiles[i].setAttribute('aria-pressed', 'true');
    ans.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  }

  // 第二屏跟着最近一次提问更新
  function howLive(res) {
    var l1 = $('how-1'), l2 = $('how-2'), l3 = $('how-3');
    [l1, l2, l3].forEach(function (p) { var o = p.querySelector('.how__live'); if (o) o.remove(); });
    if (!res) return;
    var words = res.terms.map(function (t) { return t.t; }).slice(0, 8).join('、');
    var top = res.ranked[0];
    l1.appendChild(el('span', 'how__live', '刚才：“' + res.q + '” → ' + (words || '没有可用的词')));
    if (top) l2.appendChild(el('span', 'how__live', '刚才：最高分是《' + docs[top.i].short + '》，' + f2(top.s)));
    l3.appendChild(el('span', 'how__live', res.ok ? '刚才：' + f2(top.s) + ' 不低于 ' + f2(MIN) + '，所以回答了' : '刚才：最高分低于 ' + f2(MIN) + '，所以说没找到'));
  }

  // ---------- 输入 ----------
  var composing = false, typer = null, touched = false;
  input.addEventListener('compositionstart', function () { composing = true; });
  input.addEventListener('compositionend', function () { composing = false; run(input.value); });
  input.addEventListener('input', function () {
    touched = true; stopTyping();
    if (!composing) run(input.value);
  });
  input.addEventListener('focus', function () { touched = true; });
  clear.addEventListener('click', function () { stopTyping(); input.value = ''; run(''); input.focus(); });
  $('ask').addEventListener('submit', function (e) {
    e.preventDefault();
    run(input.value);
    input.blur();
    if (!ans.hidden) ans.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
  });

  function stopTyping() { if (typer) { clearTimeout(typer); typer = null; } }
  // 一个字一个字地填进去，让访客看到每多一个字，资料盘怎么重新排
  function typeInto(text, done) {
    stopTyping();
    if (reduce) { input.value = text; run(text); if (done) done(); return; }
    input.value = '';
    var k = 0;
    (function step() {
      k++;
      input.value = text.slice(0, k);
      run(input.value);
      if (k < text.length) typer = setTimeout(step, 110 + Math.random() * 60);
      else { typer = null; if (done) done(); }
    })();
  }

  var chips = $('chips');
  CHIPS.forEach(function (q) {
    var b = el('button', 'chip', q);
    b.type = 'button';
    b.addEventListener('click', function () {
      touched = true;
      typeInto(q, function () {
        ans.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest' });
      });
    });
    chips.appendChild(b);
  });

  // 首次打开：访客还没动手时，小智自己演示一个最常见的问题
  // 手机上资料盘在第一屏下面，等它露出来再演示，不然访客看不到每个字带来的变化
  function demo() {
    if (touched || input.value) return;
    typeInto(CHIPS[0]);
  }
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); setTimeout(demo, 700); }
    }, { threshold: 0.35 });
    io.observe(caseEl);
  } else setTimeout(demo, 1400);
})();
