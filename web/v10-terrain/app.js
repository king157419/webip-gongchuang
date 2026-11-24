/* 页面逻辑：从 window.CLUB 渲染各节；滚动驱动首屏镜头、逐句文字、横向卡片、导航高亮。 */
(function () {
  'use strict';
  var C = window.CLUB;
  var $ = function (id) { return document.getElementById(id); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dot(d) { return String(d).replace(/-/g, '.'); }
  function pad(i) { return (i < 9 ? '0' : '') + (i + 1) + '.'; }
  function isTbd(v) { return v == null || v === '' || v === '待补充'; }
  var CAT = { weld: '焊接课', course: '昇腾 AI 课', visit: '企业参访', contest: '创新大赛', talk: '分享会' };

  /* ---------- 内容渲染 ---------- */
  if (C) {
    var news = C.news || [];
    var meta = C.meta || {};
    $('aboutIntro').textContent = '挂靠' + meta.host + '的' + meta.type + '。面向' + meta.audience + '，围绕学术交流、竞赛实践和创新项目开展活动，为同学提供学习、交流与协作实践的平台。';
    $('aboutWhere').textContent = '常在：' + (meta.location || '');
    var deps = (meta.departments || []).map(function (d) { return d.name.replace('部', ''); }).join(' / ');
    var years = news.map(function (n) { return +n.date.slice(0, 4); });
    var stats = [
      [String(meta.founded), '年成立', ''],
      [String((meta.departments || []).length), '个部门', deps],
      [String(news.length), '篇学院官网报道', Math.min.apply(null, years) + '–' + Math.max.apply(null, years)],
      ['近 200', '人听过 AI 论文分享会', '2024.12']
    ];
    $('stats').innerHTML = stats.map(function (s) {
      return '<div class="stat"><dt>' + esc(s[1]) + (s[2] ? '<small>' + esc(s[2]) + '</small>' : '') + '</dt><dd>' + esc(s[0]) + '</dd></div>';
    }).join('');

    // 02 活动卡片
    $('pgRow').innerHTML = (C.programs || []).map(function (p, i) {
      var list = news.filter(function (n) { return n.cat === p.id; });
      var latest = list[0];
      var quote = '';
      if (latest) {
        var parts = latest.summary.split('。').filter(function (x) { return x.trim(); });
        var longest = parts.reduce(function (a, b) { return b.length > a.length ? b : a; }, '');
        quote = '<blockquote>「' + esc(longest) + '。」</blockquote><figcaption>' + esc(dot(latest.date)) + ' · 学院官网报道</figcaption>';
      }
      return '<li class="card"><span class="card-no">' + pad(i) + '</span>' +
        '<h3>' + esc(p.name) + '</h3><p class="card-desc">' + esc(p.desc) + '</p>' +
        '<p class="card-meta">' + esc(p.where) + '<br>学院官网报道 ' + list.length + ' 篇</p>' +
        (quote ? '<figure class="card-q">' + quote + '</figure>' : '') + '</li>';
    }).join('');

    // 03 人
    var ppl = C.people || {};
    var cells = (ppl.leaders || []).concat(ppl.teachers || []);
    $('ppGrid').innerHTML = cells.map(function (p, i) {
      var hasPhoto = !isTbd(p.photo);
      var img = hasPhoto ? '<div class="pp-photo"><img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '的照片" loading="lazy"></div>' : '';
      var miss = hasPhoto ? '' : '<span class="pp-miss">照片 <i class="tbd">待补充</i></span>';
      var aw = p.awards && p.awards.length ? '<ul class="pp-aw">' + p.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '';
      return '<article class="cell pp' + (hasPhoto ? ' has-photo' : '') + '" data-rv><span class="cell-no">' + pad(i) + '</span>' + miss + img +
        '<h3>' + esc(p.name) + '</h3><p class="pp-role">' + esc(p.role) + '</p><p class="pp-desc">' + esc(p.desc) + '</p>' + aw + '</article>';
    }).join('');

    // 04 动态
    $('nwNote').textContent = '全部 ' + news.length + ' 条都来自通信与信息工程学院官网的公开报道，点开即是原文。';
    $('nwGrid').innerHTML = news.map(function (n, i) {
      var parts = n.title.split(/\s*[|丨｜]\s*|\s*——\s*/);
      var t = (parts.length > 1 && parts[0].trim() ? parts[0] : n.title).trim().replace(/^[“"]|[”"]$/g, '');
      return '<li><a class="cell nw" href="' + esc(n.source) + '" target="_blank" rel="noopener" title="' + esc(n.title) + '">' +
        '<span class="cell-no">' + pad(i) + '</span><span class="arr" aria-hidden="true">↗</span>' +
        '<span class="nw-t">' + esc(t) + '</span>' +
        '<span class="nw-m">' + esc(dot(n.date)) + ' · ' + esc(CAT[n.cat] || '') + '<span class="sr"> （在新窗口打开原文）</span></span></a></li>';
    }).join('');

    // 05 荣誉与承办协办
    var honors = C.honors || [];
    $('hnNote').textContent = '收录通信与信息工程学院官网公开报道中明确与社团相关的 ' + honors.length + ' 项赛事与活动。';
    $('hnList').innerHTML = honors.map(function (h, i) {
      return '<li data-rv><a class="hn-row" href="' + esc(h.source) + '" target="_blank" rel="noopener">' +
        '<span class="hn-idx">' + pad(i) + '</span>' +
        '<span class="hn-yr">' + esc(h.year) + '</span>' +
        '<span class="hn-txt">' + esc(h.text) + '</span>' +
        '<span class="hn-go">原文 <span class="arr" aria-hidden="true">↗</span></span></a></li>';
    }).join('');

    // 06 加入
    var join = C.join || {};
    var contact = meta.contact || {};
    $('steps').innerHTML = (join.steps || []).map(function (s, i) {
      return '<li data-rv><span class="num">0' + (i + 1) + '</span><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></li>';
    }).join('');
    var jMeta = [
      ['招新时间', isTbd(join.season) ? '<i class="tbd">待补充</i>' : esc(join.season)],
      ['报名问卷', isTbd(join.formUrl) ? '<i class="tbd">待补充</i>' : '<a href="' + esc(join.formUrl) + '" target="_blank" rel="noopener">在线填写 ↗</a>'],
      ['社团联络群', isTbd(contact.qqGroup) ? '<i class="tbd">待补充</i>' : esc(contact.qqGroup)]
    ];
    $('joinMeta').innerHTML = jMeta.map(function (m) {
      return '<div><dt>' + esc(m[0]) + '</dt><dd>' + m[1] + '</dd></div>';
    }).join('');
    $('faq').innerHTML = (join.faq || []).map(function (f) {
      return '<details><summary>' + esc(f.q) + '<span class="pm" aria-hidden="true"></span></summary><p>' + esc(f.a) + '</p></details>';
    }).join('');
    $('ftName').textContent = meta.name + ' · ' + meta.en;
    $('ftHost').textContent = '挂靠单位：' + meta.host + ' · ' + meta.founded + ' 年成立';
  }

  /* ---------- 复制公众号名 ---------- */
  $('copyBtn').addEventListener('click', function () {
    var name = '上海大学通信学院', ok = false;
    var ta = document.createElement('textarea');
    ta.value = name; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta); ta.select();
    try { ta.setSelectionRange(0, name.length); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    $('copyMsg').textContent = ok ? '已复制。打开微信搜索并关注「上海大学通信学院」。' : '微信里搜索：上海大学通信学院';
  });

  /* ---------- 首屏逐句：拆字 ---------- */
  var phrases = [].slice.call(document.querySelectorAll('.phrase'));
  phrases.forEach(function (el) {
    var txt = el.textContent;
    el.setAttribute('aria-label', txt);
    el.innerHTML = txt.split('').map(function (ch) { return '<span aria-hidden="true">' + esc(ch) + '</span>'; }).join('');
    el._ch = [].slice.call(el.children);
  });
  var WIN = [[0.22, 0.52], [0.54, 0.84]]; // 每句在首屏进度里的区间

  /* ---------- 滚动 ---------- */
  var hero = $('hero'), stage = hero.firstElementChild, hdr = $('hdr'), copy = $('heroCopy'), note = $('heroNote');
  var cv = $('terrain'), fb = $('terrainFb');
  var pg = $('programs'), rail = $('pgRail'), row = $('pgRow'), bar = $('pgBar');
  var T = window.Terrain || { ok: false, setProgress: function () {}, start: function () {}, stop: function () {} };
  var pgDist = 0, heroOn = true, ticking = false, headlessY = null;
  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function ss(a, b, x) { var t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); }

  function layoutPg() {
    if (!pg) return;
    var wide = innerWidth >= 900;
    pgDist = Math.max(0, row.scrollWidth - rail.clientWidth);
    pg.style.height = (innerHeight + pgDist + (wide ? 0 : 0)) + 'px';
  }

  function onScroll() {
    ticking = false;
    var y = headlessY !== null ? headlessY : window.pageYOffset;
    var span = Math.max(1, hero.offsetHeight - innerHeight);
    var p = clamp(y / span);
    T.setProgress(p);
    // 标题与说明淡出
    var out = ss(0.03, 0.2, p);
    copy.style.opacity = 1 - out;
    copy.style.transform = 'translate3d(0,' + (-out * 60).toFixed(1) + 'px,0)';
    note.style.opacity = 1 - out;
    stage.style.setProperty('--veil', (1 - out).toFixed(3));
    // 逐句
    phrases.forEach(function (el, i) {
      var w = WIN[i], a = w[0], b = w[1], n = el._ch.length;
      var fade = 1 - ss(b - 0.07, b, p);
      el.style.opacity = fade;
      el.style.transform = 'translate3d(0,' + (-ss(b - 0.07, b, p) * 30).toFixed(1) + 'px,0)';
      el._ch.forEach(function (c, j) {
        var s0 = a + j * 0.012, v = ss(s0, s0 + 0.06, p);
        c.style.opacity = v;
        c.style.transform = 'translate3d(0,' + ((1 - v) * 0.4).toFixed(3) + 'em,0)';
      });
    });
    // 画布：首屏结束后隐藏并停帧
    var on = p < 0.999;
    if (on !== heroOn) {
      heroOn = on;
      cv.style.visibility = fb.style.visibility = on ? '' : 'hidden';
      if (on && !document.hidden) T.start(); else T.stop();
    }
    if (!T.ok) fb.style.opacity = 1 - ss(0.8, 1, p);
    hdr.classList.toggle('on-dark', p > 0.9);
    // 横向卡片
    if (pg) {
      var r = pg.getBoundingClientRect();
      var q = clamp(-r.top / Math.max(1, pg.offsetHeight - innerHeight));
      row.style.transform = 'translate3d(' + (-q * pgDist).toFixed(1) + 'px,0,0)';
      bar.style.transform = 'scaleX(' + q.toFixed(3) + ')';
    }
  }
  function req() { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }
  addEventListener('scroll', req, { passive: true });
  addEventListener('resize', function () { layoutPg(); req(); });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) T.stop(); else if (heroOn) T.start();
  });

  /* ---------- 导航高亮 ---------- */
  var links = [].slice.call(document.querySelectorAll('.nav a'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) {
          var on = a.getAttribute('href') === '#' + e.target.id;
          a.classList.toggle('active', on);
          if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -54% 0px' });
    ['hero', 'about', 'programs', 'people', 'news', 'honors', 'join'].forEach(function (id) { var el = $(id); if (el) io.observe(el); });

    // 进入视口淡入
    var rv = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); rv.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) { rv.observe(el); });
  } else {
    document.documentElement.classList.remove('js');
  }

  // 调试：?at=像素 直接滚到某处（用于无界面截图核对）
  var at = /[?&]at=(\d+)/.exec(location.search);
  var isHeadlessTop = at && window === window.top && /Headless/i.test(navigator.userAgent);
  function applyAt() {
    layoutPg();
    if (!at) { req(); return; }
    var targetY = +at[1];
    if (isHeadlessTop) {
      var mainEl = $('top');
      mainEl.style.transform = '';
      scrollTo(0, 0);
      var maxY = Math.max(0, Math.max(document.documentElement.scrollHeight, mainEl.offsetHeight) - innerHeight);
      headlessY = Math.min(targetY, maxY);
      mainEl.style.transform = 'translate3d(0,' + (-headlessY) + 'px,0)';
      onScroll();
    } else {
      scrollTo(0, targetY);
      onScroll();
    }
  }
  if (at) {
    document.documentElement.classList.add('at-snap');
    document.documentElement.style.scrollBehavior = 'auto';
    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) { el.classList.add('in'); });
    [].forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
  }
  layoutPg();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(applyAt);
  addEventListener('load', applyAt);
  if (at) applyAt(); else onScroll();
  if (!document.hidden) T.start();
})();
