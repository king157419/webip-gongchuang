/* v11 · kinetic —— 上海大学人工智能社
 * 所有事实来自 ../shared/content.js（window.CLUB）。原生 JS，无依赖。 */
(function () {
  'use strict';
  var C = window.CLUB;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var REDUCE = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FINE = window.matchMedia && matchMedia('(pointer: fine)').matches;
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  var CN = '零一二三四五六七八九十';
  function cn(n) { return n <= 10 ? CN[n] : String(n); }
  function isTbd(v) { return v == null || v === '' || v === '待补充'; }

  var NEWS = C.news.slice();
  var N = NEWS.length;
  var YEARS = NEWS.map(function (n) { return +n.date.slice(0, 4); });
  var Y0 = Math.min.apply(null, YEARS), Y1 = Math.max.apply(null, YEARS);
  var CAT = { weld: '焊接', course: '课程', visit: '参访', contest: '大赛', talk: '分享会' };
  var CAT_LONG = { weld: '焊接课', course: '技术课', visit: '参访', contest: '创新大赛', talk: '分享会' };
  var COLORS = ['or', 'co', 'gr', 'be'];

  function dot(d) { return d.replace(/-/g, '.'); }
  function slogan(t) {
    var parts = t.split(/\s*[|｜丨]\s*|\s*——\s*/);
    var s = (parts.length > 1 ? parts[0] : t).trim();
    if (/^[“"].*[”"]$/.test(s) && !/[“"]/.test(s.slice(1, -1))) s = s.slice(1, -1);
    return s;
  }
  function sizeCls(s) { return s.length <= 10 ? 's-l' : s.length <= 18 ? 's-m' : 's-s'; }
  function newsOf(cat) { return NEWS.filter(function (n) { return n.cat === cat; }); }

  /* ============ 1. 首屏：字带着小圆点弹回原位 ============ */
  var hero = $('#hero'), title = $('.hero-title'), layer = $('.hero-dots');
  var chs = [].slice.call(document.querySelectorAll('.h-ch'));
  var per = $('.h-period');
  var H = { run: false, t0: 0, last: 0, intro: true, ptr: null, st: [], dots: [], ps: 0, pv: 0 };

  function homeOf(el) {
    return {
      cx: title.offsetLeft + el.offsetLeft + el.offsetWidth / 2,
      cy: title.offsetTop + el.offsetTop + el.offsetHeight / 2,
      w: el.offsetWidth
    };
  }
  function heroSetup() {
    document.documentElement.classList.remove('pre');
    if (REDUCE) { H.intro = false; return; }
    var W = hero.clientWidth, Hh = hero.clientHeight;
    H.st = chs.map(function (el, i) {
      var h = homeOf(el);
      var sx = rand(0.06, 0.94) * W, sy = rand(0.1, 0.9) * Hh;
      var s = { el: el, cx: h.cx, cy: h.cy, x: sx - h.cx, y: sy - h.cy, r: rand(-55, 55), s: rand(0.5, 0.82),
        vx: 0, vy: 0, vr: 0, vs: 0, tx: 0, ty: 0, tr: 0, delay: i * 0.03 };
      var n = 3 + Math.floor(Math.random() * 3);
      for (var k = 0; k < n; k++) {
        var d = document.createElement('i');
        var sz = Math.round(rand(6, 12));
        d.className = 'hd';
        d.style.width = d.style.height = sz + 'px';
        d.style.background = Math.random() < 0.35 ? '#0b61bc' : '#0a0a0a';
        var ox = rand(-0.7, 0.7) * h.w, oy = rand(-0.7, 0.7) * h.w;
        layer.appendChild(d);
        H.dots.push({ el: d, sz: sz, ch: s, ox: ox, oy: oy, px: sx + ox * 1.6, py: sy + oy * 1.6, vx: 0, vy: 0,
          k: rand(60, 95), c: rand(8, 11) });
      }
      return s;
    });
    paintHero();
    H.t0 = H.last = performance.now();
    kickHero();
    // 兜底：页面在后台打开或 requestAnimationFrame 被暂停时，2.3 秒后直接把字放回原位
    setTimeout(function () {
      if (!H.intro) return;
      H.intro = false;
      layer.innerHTML = ''; H.dots = [];
      per.style.transform = '';
      H.st.forEach(function (s) { s.x = s.y = s.r = s.vx = s.vy = s.vr = s.vs = 0; s.s = 1; s.el.style.transform = ''; });
    }, 2300);
  }
  function kickHero() { if (!H.run) { H.run = true; H.last = performance.now(); requestAnimationFrame(heroFrame); } }
  function paintHero() {
    H.st.forEach(function (s) {
      s.el.style.transform = 'translate3d(' + s.x.toFixed(2) + 'px,' + s.y.toFixed(2) + 'px,0) rotate(' + s.r.toFixed(2) + 'deg) scale(' + s.s.toFixed(3) + ')';
    });
  }
  function spring(o, key, vkey, target, k, c, h) {
    var a = -k * (o[key] - target) - c * o[vkey];
    o[vkey] += a * h; o[key] += o[vkey] * h;
  }
  function heroFrame(now) {
    // 按真实时间推进（掉帧时多做几步子步），保证慢设备上也在约 1.2 秒内归位
    var dt = Math.min((now - H.last) / 1000, 0.12); H.last = now;
    var t = (now - H.t0) / 1000;
    var subs = Math.max(2, Math.ceil(dt * 240)), h = dt / subs, moving = false;
    if (H.intro && t > 2) {
      H.st.forEach(function (s) { s.x = s.y = s.r = s.vx = s.vy = s.vr = s.vs = 0; s.s = 1; });
    }
    // 指针轻推：只在入场后、精确指针时
    if (!H.intro) {
      H.st.forEach(function (s) {
        s.tx = s.ty = s.tr = 0;
        if (H.ptr) {
          var dx = s.cx - H.ptr.x, dy = s.cy - H.ptr.y, d = Math.hypot(dx, dy) || 1, R = 170;
          if (d < R) { var f = (1 - d / R); f *= f; s.tx = dx / d * f * 28; s.ty = dy / d * f * 28; s.tr = dx / d * f * 7; }
        }
      });
    }
    for (var sub = 0; sub < subs; sub++) {
      H.st.forEach(function (s) {
        if (H.intro && t < s.delay) return;
        var k = H.intro ? 170 : 210, c = H.intro ? 14 : 15;
        spring(s, 'x', 'vx', s.tx, k, c, h);
        spring(s, 'y', 'vy', s.ty, k, c, h);
        spring(s, 'r', 'vr', s.tr, k, c, h);
        spring(s, 's', 'vs', 1, k, c, h);
      });
    }
    H.st.forEach(function (s) {
      if (Math.abs(s.x - s.tx) + Math.abs(s.y - s.ty) + Math.abs(s.vx) + Math.abs(s.vy) + Math.abs(s.r - s.tr) + Math.abs(s.vr) * 0.1 + Math.abs(s.s - 1) * 50 > 0.25) moving = true;
    });
    paintHero();
    if (H.intro) {
      // 小圆点：追着字跑，随后收拢淡出
      var orbit = Math.max(0, 1 - t / 1.0);
      H.dots.forEach(function (d) {
        var tx = d.ch.cx + d.ch.x + d.ox * orbit, ty = d.ch.cy + d.ch.y + d.oy * orbit;
        for (var sub2 = 0; sub2 < subs; sub2++) {
          d.vx += (-d.k * (d.px - tx) - d.c * d.vx) * h; d.px += d.vx * h;
          d.vy += (-d.k * (d.py - ty) - d.c * d.vy) * h; d.py += d.vy * h;
        }
        var fade = clamp((t - 0.85) / 0.4, 0, 1);
        d.el.style.opacity = (1 - fade).toFixed(3);
        d.el.style.transform = 'translate3d(' + (d.px - d.sz / 2).toFixed(1) + 'px,' + (d.py - d.sz / 2).toFixed(1) + 'px,0) scale(' + (1 - fade * 0.7).toFixed(3) + ')';
      });
      // 句点：最后弹出来
      if (t > 0.75) for (var sp = 0; sp < subs; sp++) { H.pv += (-300 * (H.ps - 1) - 13 * H.pv) * h; H.ps += H.pv * h; }
      per.style.transform = 'scale(' + Math.max(0, H.ps).toFixed(3) + ')';
      if (t > 1.6 && !moving) {
        H.intro = false;
        layer.innerHTML = ''; H.dots = [];
        per.style.transform = '';
      } else moving = true;
    }
    if (moving) requestAnimationFrame(heroFrame);
    else {
      H.run = false;
      H.st.forEach(function (s) { s.x = s.y = s.r = s.vx = s.vy = s.vr = s.vs = 0; s.s = 1; s.el.style.transform = ''; });
    }
  }
  if (FINE && !REDUCE) {
    hero.addEventListener('pointermove', function (e) {
      if (H.intro) return;
      var r = hero.getBoundingClientRect();
      H.ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
      kickHero();
    });
    hero.addEventListener('pointerleave', function () { H.ptr = null; kickHero(); });
    window.addEventListener('resize', function () {
      if (H.intro) return;
      H.st.forEach(function (s) { var h = homeOf(s.el); s.cx = h.cx; s.cy = h.cy; });
    });
  }

  /* ============ 2. 瀑布流 ============ */
  var PICS = [
    { src: '../shared/img/ip/zhi-scene_poster_v2.webp', w: 1050, h: 1400, cap: '社团吉祥物 · 小智 · 海报设计', over: true },
    { src: '../shared/img/ip/zhi-merch_keychain.webp', w: 1400, h: 1050, cap: '社团吉祥物 · 小智 · 钥匙扣设计' },
    { src: '../shared/img/ip/zhi-desk_bot.webp', w: 1400, h: 1050, cap: '社团吉祥物 · 小智 · 桌面摆件设计' },
    { src: '../shared/img/ip/zhi-lenti.gif', w: 480, h: 480, cap: '社团吉祥物 · 小智 · 光栅卡动图' }
  ];
  var PIC_AT = { 1: 0, 5: 1, 9: 2, 13: 3 };
  var NEWS_KINDS = ['or', 'gy', 'co', 'be', 'gy', 'gr'];
  var cards = [];
  NEWS.forEach(function (n, i) {
    var s = slogan(n.title);
    var a = document.createElement('a');
    a.className = 'card k-' + NEWS_KINDS[i % NEWS_KINDS.length] + (i % 5 === 0 || i % 7 === 3 ? ' tall' : '');
    a.href = n.source; a.target = '_blank'; a.rel = 'noopener';
    a.setAttribute('aria-label', n.title + '（' + dot(n.date) + '，学院官网原文，新窗口打开）');
    a.innerHTML =
      '<div class="c-top"><span class="c-date">' + esc(dot(n.date)) + '</span></div>' +
      '<p class="c-slogan ' + sizeCls(s) + '">' + esc(s) + '</p>' +
      '<p class="c-sum">' + esc(n.summary) + '</p>' +
      '<div class="c-bot"><span class="c-tag">' + esc(CAT[n.cat] || '') + '</span><span class="c-arrow" aria-hidden="true">↗</span></div>';
    cards.push(a);
    if (PIC_AT[i] != null) {
      var p = PICS[PIC_AT[i]];
      var f = document.createElement('figure');
      f.className = 'card pic' + (p.over ? ' over' : '');
      f.style.margin = '0';
      f.innerHTML = '<img src="' + esc(p.src) + '" width="' + p.w + '" height="' + p.h + '" loading="lazy" decoding="async" alt="' + esc(p.cap.replace(/ · /g, '，')) + '">' +
        '<figcaption class="pic-cap">' + esc(p.cap) + '</figcaption>';
      cards.push(f);
    }
  });
  var mas = $('#masonry'), cols = [], colN = 0;
  function colCount() { var w = window.innerWidth; return w < 560 ? 1 : w < 1000 ? 2 : 3; }
  function layoutMasonry() {
    var n = colCount();
    if (n === colN) return;
    colN = n; mas.innerHTML = ''; cols = [];
    for (var i = 0; i < n; i++) { var c = document.createElement('div'); c.className = 'm-col'; mas.appendChild(c); cols.push(c); }
    // 依次放进当前最短的一列（按宽高比估算，避免逐张强制排版）
    var hs = cols.map(function () { return 0; });
    cards.forEach(function (el) {
      var j = hs.indexOf(Math.min.apply(null, hs));
      cols[j].appendChild(el);
      var est = el.classList.contains('pic') ? (function () { var im = el.querySelector('img'); return +im.getAttribute('height') / +im.getAttribute('width') + 0.12; })()
        : el.classList.contains('tall') ? 1.0 : 0.72;
      hs[j] += est;
    });
    parallax();
  }
  layoutMasonry();
  window.addEventListener('resize', layoutMasonry);

  function revealer(sel, cls, stepMs) {
    var els = [].slice.call(document.querySelectorAll(sel));
    if (REDUCE || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add(cls); }); return; }
    var io = new IntersectionObserver(function (ents) {
      var vis = ents.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left; });
      vis.forEach(function (e, i) {
        var el = e.target;
        el.style.transitionDelay = (i * stepMs) + 'ms';
        el.classList.add(cls);
        io.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 1100 + i * stepMs);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    els.forEach(function (e) { io.observe(e); });
  }
  revealer('.card', 'in', 90);

  function parallax() {
    if (REDUCE || colN < 3) { cols.forEach(function (c) { c.style.transform = ''; }); return; }
    var r = mas.getBoundingClientRect();
    if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
    var rel = clamp(window.innerHeight - r.top, 0, r.height + window.innerHeight);
    cols[1].style.transform = 'translate3d(0,' + (-rel * 0.06).toFixed(1) + 'px,0)';
    cols[2].style.transform = 'translate3d(0,' + (-rel * 0.025).toFixed(1) + 'px,0)';
  }

  /* ============ 3. 刻度盘时间轴 ============ */
  var NS = 'http://www.w3.org/2000/svg';
  var dial = $('#dial'), CX = 500, CY = 470, R = 440;
  var yearsArr = []; for (var y = Y0; y <= Y1; y++) yearsArr.push(y);
  var span = Y1 - Y0 + 1;
  $('#years-h').textContent = cn(span) + '年，' + N + ' 篇报道';
  var perYear = yearsArr.map(function (yr) {
    var list = NEWS.filter(function (n) { return +n.date.slice(0, 4) === yr; });
    var by = {};
    list.forEach(function (n) { by[n.cat] = (by[n.cat] || 0) + 1; });
    var parts = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }).map(function (k) { return CAT[k] + ' ' + by[k]; });
    return { y: yr, n: list.length, parts: parts };
  });
  var cum = []; perYear.reduce(function (acc, p, i) { cum[i] = acc + p.n; return cum[i]; }, 0);
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    (parent || dial).appendChild(e); return e;
  }
  function pt(deg, rad) { var a = deg * Math.PI / 180; return [CX + rad * Math.cos(a), CY + rad * Math.sin(a)]; }
  for (var ti = 0; ti <= 60; ti++) {
    var deg = 180 + ti * 3, maj = ti % 10 === 0;
    var p1 = pt(deg, maj ? 388 : 402), p2 = pt(deg, 420);
    el('line', { x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1), 'class': 'tick' + (maj ? ' maj' : '') });
  }
  var arcD = 'M ' + (CX - R) + ' ' + CY + ' A ' + R + ' ' + R + ' 0 0 1 ' + (CX + R) + ' ' + CY;
  el('path', { d: arcD, 'class': 'arc-bg' });
  var arc = el('path', { d: arcD, 'class': 'arc', pathLength: '1', 'stroke-dasharray': '1 1', 'stroke-dashoffset': '1' });
  var yAng = perYear.map(function (p, i) { return 180 + 180 * (i + 0.5) / perYear.length; });
  var yPts = perYear.map(function (p, i) {
    var c = pt(yAng[i], R), l = pt(yAng[i], R + 44);
    var circ = el('circle', { cx: c[0].toFixed(1), cy: c[1].toFixed(1), r: 11, 'class': 'ypt' });
    var tx = el('text', { x: l[0].toFixed(1), y: (l[1] + 10).toFixed(1), 'text-anchor': 'middle', 'class': 'ylab' });
    tx.textContent = p.y;
    return { c: circ, t: tx };
  });
  var handG = el('g', { 'class': 'hand-g' });
  el('line', { x1: CX, y1: CY, x2: CX + 372, y2: CY, 'class': 'hand' }, handG);
  el('circle', { cx: CX, cy: CY, r: 24, 'class': 'pivot' });
  var yl = $('#year-list');
  yl.innerHTML = perYear.map(function (p) {
    return '<li><b>' + p.y + '</b><span>' + p.n + ' 篇 · ' + esc(p.parts.join(' · ')) + '</span></li>';
  }).join('');
  var yLis = [].slice.call(yl.children);
  var dialSec = $('#years'), dCount = $('#dial-count'), dYear = $('#dial-year'), lastIdx = -2;
  function updateDial(force) {
    var p;
    if (REDUCE) p = 1;
    else {
      var r = dialSec.getBoundingClientRect();
      if (!force && (r.bottom < 0 || r.top > window.innerHeight)) return;
      p = clamp(-r.top / Math.max(1, r.height - window.innerHeight), 0, 1);
    }
    var f = clamp(p * 1.12, 0, 1);
    arc.setAttribute('stroke-dashoffset', (1 - f).toFixed(4));
    var ang = 180 + 180 * f;
    handG.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' ' + CX + ' ' + CY + ')');
    var idx = -1;
    yAng.forEach(function (a, i) { if (ang >= a - 0.01) idx = i; });
    if (idx !== lastIdx) {
      lastIdx = idx;
      yPts.forEach(function (o, i) { o.c.classList.toggle('on', i <= idx); o.t.classList.toggle('on', i <= idx); });
      yLis.forEach(function (li, i) { li.classList.toggle('on', i <= idx); li.classList.toggle('cur', i === idx); });
      dCount.textContent = idx < 0 ? '0' : cum[idx];
      dYear.textContent = idx < 0 ? Y0 + ' 年起' : perYear[idx].y + ' 年 · 累计';
    }
  }
  updateDial(true);

  /* ============ 4. 平时做什么：横向卡 ============ */
  var track = $('#prog-track');
  track.innerHTML = C.programs.map(function (p, i) {
    var list = newsOf(p.id), latest = list[0];
    var kind = COLORS[i % COLORS.length];
    var mini = '';
    if (latest) {
      var s = slogan(latest.title);
      mini = '<a class="mini" href="' + esc(latest.source) + '" target="_blank" rel="noopener" style="--tilt:' + (i % 2 ? 3.5 : -4) + 'deg" ' +
        'aria-label="最新报道：' + esc(latest.title) + '（新窗口打开）">' +
        '<span class="mini-d"><span>' + esc(dot(latest.date)) + '</span><span>最新 ↗</span></span>' +
        '<span class="mini-s"' + (s.length > 16 ? ' style="font-size:17px"' : '') + '>' + esc(s) + '</span>' +
        '<span class="mini-z" style="background-position:' + ((i % 4) * 100 / 3).toFixed(3) + '% 0"></span></a>';
    }
    return '<article class="pc k-' + kind + '">' +
      '<h3 class="pc-name">' + esc(p.name) + '</h3>' +
      '<p class="pc-desc">' + esc(p.desc) + '</p>' + mini +
      '<div class="pc-bot"><span>' + esc(p.where) + '</span><span>报道 ' + list.length + ' 篇</span></div></article>';
  }).join('');
  var pcs = [].slice.call(track.children);
  var prev = $('#prog-prev'), next = $('#prog-next'), pcount = $('#prog-count');
  function stepW() { return pcs.length > 1 ? pcs[1].offsetLeft - pcs[0].offsetLeft : track.clientWidth; }
  function progUI() {
    var i = Math.round(track.scrollLeft / stepW());
    var max = track.scrollWidth - track.clientWidth - 2;
    pcount.textContent = String(Math.min(i + 1, pcs.length)).padStart(2, '0') + ' / ' + String(pcs.length).padStart(2, '0');
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }
  prev.addEventListener('click', function () { track.scrollBy({ left: -stepW(), behavior: REDUCE ? 'auto' : 'smooth' }); });
  next.addEventListener('click', function () { track.scrollBy({ left: stepW(), behavior: REDUCE ? 'auto' : 'smooth' }); });
  track.addEventListener('scroll', function () { requestAnimationFrame(progUI); }, { passive: true });
  window.addEventListener('resize', progUI);
  progUI();
  // 鼠标拖动横滑（触摸用原生滑动）
  (function () {
    var drag = null, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, s: track.scrollLeft, v: 0, lx: e.clientX, lt: performance.now() }; moved = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      if (!moved && Math.abs(dx) > 5) { moved = true; track.classList.add('drag'); }
      if (moved) {
        track.scrollLeft = drag.s - dx;
        var now = performance.now();
        drag.v = (e.clientX - drag.lx) / Math.max(1, now - drag.lt); drag.lx = e.clientX; drag.lt = now;
        e.preventDefault();
      }
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var v = drag.v; drag = null;
      if (moved) {
        track.classList.remove('drag');
        var target = track.scrollLeft - v * 260;
        var w = stepW();
        track.scrollTo({ left: Math.round(target / w) * w, behavior: REDUCE ? 'auto' : 'smooth' });
      }
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
  })();
  (function () {
    if (REDUCE || !('IntersectionObserver' in window)) { pcs.forEach(function (p) { p.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (ents) {
      if (!ents.some(function (e) { return e.isIntersecting; })) return;
      pcs.forEach(function (p, i) {
        p.style.transitionDelay = (i * 110) + 'ms'; p.classList.add('in');
        setTimeout(function () { p.style.transitionDelay = ''; }, 1200 + i * 110);
      });
      io.disconnect();
    }, { threshold: 0.15 });
    io.observe(track);
  })();

  /* ============ 5. 在哪里见 ============ */
  var PLACES = [
    { name: 'T402', bld: '翔英大楼', re: /T402/ },
    { name: 'T404', bld: '翔英大楼', re: /T404/ },
    { name: 'T406', bld: '翔英大楼', re: /T406|大楼406/ },
    { name: '608 创客空间', bld: '翔英大楼', re: /608/ },
    { name: 'GJ204', re: /GJ204/ },
    { name: 'CJ203', re: /CJ203/ },
    { name: '上海世博中心', re: /世博中心/ },
    { name: '华为练秋湖研发中心', re: /练秋湖/ }
  ];
  var pList = $('#place-list');
  pList.innerHTML = PLACES.map(function (pl) {
    var hit = NEWS.filter(function (n) { return pl.re.test(n.summary); });
    var by = {}, order = [];
    hit.slice().reverse().forEach(function (n) {
      if (!by[n.cat]) { by[n.cat] = []; order.push(n.cat); }
      by[n.cat].push(n.date.slice(0, 7).replace('-', '.'));
    });
    var lines = order.map(function (c) { return '<em>' + esc(CAT_LONG[c]) + ' ' + esc(by[c].join(' · ')) + '</em>'; }).join('');
    var meta = (pl.bld ? '<em>' + esc(pl.bld) + '</em>' : '') + lines;
    return '<li class="pl" tabindex="0"><span class="pl-name">' + esc(pl.name) + '</span>' +
      (meta ? '<span class="pl-meta">' + meta + '</span>' : '') + '</li>';
  }).join('');
  pList.addEventListener('click', function (e) {
    var li = e.target.closest('.pl'); if (!li) return;
    var on = li.classList.contains('on');
    [].forEach.call(pList.children, function (x) { x.classList.remove('on'); });
    if (!on) li.classList.add('on');
  });

  /* ============ 5.5 荣誉与承办协办 ============ */
  var HONORS = C.honors || [];
  var H_KINDS = ['gr', 'be', 'co'];
  $('#honors-n').textContent = '共 ' + HONORS.length + ' 项 · 来自学院官网报道';
  $('#honor-list').innerHTML = HONORS.map(function (h, i) {
    var tag = /承办/.test(h.text) ? '承办' : /协办/.test(h.text) ? '协办' : '荣誉';
    return '<li><a class="hcard k-' + H_KINDS[i % H_KINDS.length] + '" href="' + esc(h.source) + '" target="_blank" rel="noopener">' +
      '<div class="c-top"><span class="c-date">' + esc(h.year) + '</span><span class="c-arrow" aria-hidden="true">↗</span></div>' +
      '<p class="hcard-t">' + esc(h.text) + '</p>' +
      '<div class="c-bot"><span class="c-tag">' + tag + '</span><span class="hcard-src">学院官网原文</span></div></a></li>';
  }).join('');

  /* ============ 6. 人 ============ */
  var P = C.people;
  $('#people-n').textContent = C.meta.founded + ' 年成立 · ' + C.meta.departments.length + ' 个部门';
  $('#people-grid').innerHTML =
    P.leaders.map(function (p) {
      return '<article class="pp pp-wide"><div class="pp-lead">' +
        (p.photo ? '<img class="pp-photo" src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.role + p.name) + '的照片" loading="lazy" width="228" height="671">' : '') +
        '<div><p class="pp-role">' + esc(p.role) + '</p><h3 class="pp-name">' + esc(p.name) + '</h3>' +
        '<p class="pp-desc">' + esc(p.desc) + '</p></div></div>' +
        (p.awards && p.awards.length ? '<ul class="pp-aw">' + p.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>' : '') +
        '</article>';
    }).join('') +
    P.teachers.map(function (p) {
      var hasPhoto = !isTbd(p.photo);
      return '<article class="pp">' +
        (hasPhoto ? '<img class="pp-photo pp-tphoto" src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '的照片" loading="lazy">' : '') +
        '<p class="pp-role">' + esc(p.role) + '</p><h3 class="pp-name">' + esc(p.name) + '</h3>' +
        '<p class="pp-desc">' + esc(p.desc) + '</p>' +
        (hasPhoto ? '' : '<p class="pp-foot"><span>教师照片</span><span class="tbd">待补充</span></p>') +
        '</article>';
    }).join('');

  /* ============ 7. 加入 ============ */
  $('#steps').innerHTML = C.join.steps.map(function (s, i) {
    return '<li class="step"><span class="step-n">' + String(i + 1).padStart(2, '0') + '</span>' +
      '<h3 class="step-t">' + esc(s.t) + '</h3><p class="step-d">' + esc(s.d) + '</p></li>';
  }).join('');
  var contact = (C.meta && C.meta.contact) || {};
  var jMeta = [
    { k: '招新时间', v: isTbd(C.join.season) ? null : esc(C.join.season) },
    { k: '报名问卷', v: isTbd(C.join.formUrl) ? null : '<a href="' + esc(C.join.formUrl) + '" target="_blank" rel="noopener">在线填写 ↗</a>' },
    { k: '社团联络群', v: isTbd(contact.qqGroup) ? null : esc(contact.qqGroup) }
  ];
  $('#join-meta').innerHTML = jMeta.map(function (m) {
    return '<li class="jm-chip"><span>' + esc(m.k) + '</span>' + (m.v ? '<b>' + m.v + '</b>' : '<span class="tbd">待补充</span>') + '</li>';
  }).join('');
  $('#faq').innerHTML = C.join.faq.map(function (f) {
    return '<details><summary>' + esc(f.q) + '<i aria-hidden="true"></i></summary><p class="ans">' + esc(f.a) + '</p></details>';
  }).join('');
  var WX = '上海大学通信学院';
  $('#copy-btn').addEventListener('click', function () {
    var ta = $('#clip'), ok = false, msg = $('#copy-msg');
    ta.value = WX;
    try { ta.focus({ preventScroll: true }); ta.select(); ta.setSelectionRange(0, WX.length); ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.blur();
    msg.textContent = ok ? '已复制。打开微信搜索公众号，粘贴即可。' : '微信里搜索：' + WX;
  });
  $('#foot-year').textContent = C.meta.founded + ' 年成立';
  $('#foot-en').textContent = C.meta.en;
  $('#foot-host').textContent = '挂靠 ' + C.meta.host;

  /* ============ 8. 玩具：小智 ============ */
  var toy = $('#toy'), sprite = $('#toy-sprite'), bubble = $('#toy-bubble'), homeEl = $('#toy-home');
  var FACTS = [
    '2024 年 12 月，近 200 人来听过社团的 AI 论文分享会。',
    '2024 年，社团带百余名同学去了华为全联接大会。',
    '2026 年昇腾大模型实践课，40 余名同学报名入选。',
    '2025 年 11 月，近百名同学跟社团去了华为鸿蒙生态学堂。',
    '2025 年焊接专项赛，报名的有百余人。',
    '学院官网报道过社团 ' + N + ' 次，从 ' + Y0 + ' 到 ' + Y1 + ' 年。',
    '社团 ' + C.meta.founded + ' 年成立，有 ' + C.meta.departments.length + ' 个部门：' + C.meta.departments.map(function (d) { return d.name; }).join('、') + '。',
    '不会编程也能来，焊接课和入门课都从零教。'
  ];
  var T = { x: 0, y: 0, vx: 0, vy: 0, a: 0, va: 0, held: false, run: false, last: 0, frame: 0, fact: 0, dragged: false, hideT: 0 };
  function paintToy() { toy.style.transform = 'translate3d(' + T.x.toFixed(1) + 'px,' + T.y.toFixed(1) + 'px,0) rotate(' + T.a.toFixed(1) + 'deg)'; }
  function kickToy() { if (!T.run) { T.run = true; T.last = performance.now(); requestAnimationFrame(toyFrame); } }
  function toyFrame(now) {
    var dt = Math.min((now - T.last) / 1000, 1 / 30); T.last = now;
    if (T.held) { T.run = false; return; }
    var hr = homeEl.getBoundingClientRect(), W = window.innerWidth, Hh = window.innerHeight;
    var h = dt / 3;
    for (var i = 0; i < 3; i++) {
      T.vx += (-55 * T.x - 6.5 * T.vx) * h; T.x += T.vx * h;
      T.vy += (-55 * T.y - 6.5 * T.vy) * h; T.y += T.vy * h;
      T.va += (-60 * T.a - 5 * T.va + T.vx * 0.9) * h; T.a += T.va * h;
      // 碰到屏幕边缘回弹
      var L = hr.left + T.x, Tp = hr.top + T.y;
      if (L < 4) { T.x = 4 - hr.left; T.vx = Math.abs(T.vx) * 0.6; }
      if (L + hr.width > W - 4) { T.x = W - 4 - hr.width - hr.left; T.vx = -Math.abs(T.vx) * 0.6; }
      if (Tp < 4) { T.y = 4 - hr.top; T.vy = Math.abs(T.vy) * 0.6; }
      if (Tp + hr.height > Hh - 2) { T.y = Hh - 2 - hr.height - hr.top; T.vy = -Math.abs(T.vy) * 0.6; }
    }
    paintToy();
    if (Math.abs(T.x) + Math.abs(T.y) + Math.abs(T.vx) * 0.05 + Math.abs(T.vy) * 0.05 + Math.abs(T.a) + Math.abs(T.va) * 0.05 < 0.3) {
      T.x = T.y = T.vx = T.vy = T.a = T.va = 0; paintToy(); T.run = false; return;
    }
    requestAnimationFrame(toyFrame);
  }
  var drag = null;
  toy.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    try { toy.setPointerCapture(e.pointerId); } catch (err) {}
    drag = { px: e.clientX, py: e.clientY, x0: T.x, y0: T.y, lx: e.clientX, ly: e.clientY, lt: performance.now(), moved: false };
    T.held = true; T.vx = T.vy = 0; toy.classList.add('held');
  });
  toy.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var dx = e.clientX - drag.px, dy = e.clientY - drag.py;
    if (!drag.moved && Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    var now = performance.now(), dtm = Math.max(8, now - drag.lt) / 1000;
    var nvx = (e.clientX - drag.lx) / dtm, nvy = (e.clientY - drag.ly) / dtm;
    T.vx = T.vx * 0.5 + nvx * 0.5; T.vy = T.vy * 0.5 + nvy * 0.5;
    drag.lx = e.clientX; drag.ly = e.clientY; drag.lt = now;
    T.x = drag.x0 + dx; T.y = drag.y0 + dy;
    T.a = clamp(T.vx * 0.025, -40, 40);
    paintToy();
  });
  function release(e) {
    if (!drag) return;
    var moved = drag.moved; drag = null;
    T.held = false; toy.classList.remove('held');
    if (moved) {
      T.dragged = true;
      if (REDUCE) { T.x = T.y = T.a = 0; paintToy(); return; }
      T.vx = clamp(T.vx, -2600, 2600); T.vy = clamp(T.vy, -2600, 2600);
      T.va = T.vx * 0.15;
      kickToy();
    }
  }
  toy.addEventListener('pointerup', release);
  toy.addEventListener('pointercancel', release);
  toy.addEventListener('click', function () {
    if (T.dragged) { T.dragged = false; return; }
    poke();
  });
  function poke() {
    T.frame = (T.frame + 1) % 4;
    sprite.style.backgroundPosition = (T.frame * 100 / 3).toFixed(3) + '% 0';
    bubble.textContent = FACTS[T.fact % FACTS.length]; T.fact++;
    bubble.classList.add('show');
    clearTimeout(T.hideT);
    T.hideT = setTimeout(function () { bubble.classList.remove('show'); }, 3000);
    if (!REDUCE) { T.vy -= 520; T.va += (Math.random() < 0.5 ? -1 : 1) * 260; kickToy(); }
  }

  /* ============ 滚动驱动 ============ */
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return; ticking = true;
    requestAnimationFrame(function () { ticking = false; updateDial(); parallax(); });
  }, { passive: true });
  window.addEventListener('resize', function () { updateDial(true); });

  // 首屏入场放在最后：等布局就绪，字体到了也不影响（位移是相对量）
  heroSetup();

  // 调试：?at=像素 直接滚到某处（用于无界面截图核对）
  var at = /[?&]at=(\d+)/.exec(location.search);
  if (at) {
    var isHeadlessTop = window === window.top && /Headless/i.test(navigator.userAgent);
    document.documentElement.style.scrollBehavior = 'auto';
    H.intro = false;
    layer.innerHTML = ''; H.dots = []; per.style.transform = '';
    H.st.forEach(function (s) { s.x = s.y = s.r = s.vx = s.vy = s.vr = s.vs = 0; s.s = 1; s.el.style.transform = ''; });
    [].forEach.call(document.querySelectorAll('.card, .pc'), function (c) { c.classList.add('in'); });
    [].forEach.call(document.querySelectorAll('img[loading="lazy"]'), function (im) { im.loading = 'eager'; });
    var jumpAt = function () {
      var targetY = +at[1];
      if (isHeadlessTop) {
        var mainEl = $('#main'), footEl = $('.foot');
        mainEl.style.transform = '';
        if (footEl) footEl.style.transform = '';
        scrollTo(0, 0);
        var maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        var y = clamp(targetY, 0, maxY);
        var shift = 'translate3d(0,' + (-y) + 'px,0)';
        mainEl.style.transform = shift;
        if (footEl) footEl.style.transform = shift;
      } else {
        scrollTo(0, targetY);
      }
      updateDial(true);
      parallax();
    };
    jumpAt();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(jumpAt);
    addEventListener('load', jumpAt);
  }
})();
