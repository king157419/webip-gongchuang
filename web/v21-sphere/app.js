/* v21-sphere · app.js —— 数据渲染与原生滚动驱动「报道星球」吸顶舞台
 * 每拍三段：动作 40%（转球 + 簇浮起 + 前卡飞出摊平）→ 停住可读 45% → 过渡飞回 15%。
 * 零拦截滚轮/触摸；支持拨动甩出弹簧回正、悬停起伏、刻度跳转、?at= 定位与降级布局。 */
(function () {
  'use strict';

  var C = window.CLUB;
  var root = document.documentElement;
  var DEG = Math.PI / 180;

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a || 1e-6), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function easeOutCubic(t) {
    var x = clamp(t, 0, 1);
    return 1 - Math.pow(1 - x, 3);
  }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }

  /* 2.3 秒硬兜底，确保后台标签页不依赖 rAF 也能完整显示 */
  setTimeout(function () {
    root.classList.remove('intro-boot');
    root.classList.add('intro-done');
  }, 2300);

  if (!C) {
    root.classList.remove('st');
    return;
  }

  /* 1. 静态胶片噪点底纹 */
  try {
    var gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    var gctx = gc.getContext('2d');
    var imgData = gctx.createImageData(128, 128);
    for (var p = 0; p < imgData.data.length; p += 4) {
      var val = (Math.random() * 220) | 0;
      imgData.data[p] = val;
      imgData.data[p + 1] = val;
      imgData.data[p + 2] = val;
      imgData.data[p + 3] = 255;
    }
    gctx.putImageData(imgData, 0, 0);
    root.style.setProperty('--grain', 'url(' + gc.toDataURL() + ')');
  } catch (e) {}

  /* 2. 渲染 window.CLUB 真实内容 */
  var newsList = C.news || [];
  var progList = C.programs || [];
  var depts = (C.meta && C.meta.departments) || [];
  var honors = C.honors || [];
  var wxRaw = String((C.meta && C.meta.contact && C.meta.contact.wechat) || '上海大学通信学院');
  var WX = wxRaw.replace(/（.*?）|\(.*?\)/g, '').trim() || '上海大学通信学院';

  var CAT_NAME = {
    weld: '焊接实践',
    course: '昇腾课程',
    visit: '企业参访',
    contest: '创新大赛',
    talk: '经验分享'
  };

  /* 顶栏与首屏计数 */
  $('#topHost').textContent = (C.meta.host || '通信与信息工程学院团委') + '挂靠';
  $('#heroMetaTxt').textContent = (C.meta.founded || 2021) + ' 成立 · ' + (C.meta.host || '通信学院团委') + '挂靠';
  $('#statFounded').textContent = String(C.meta.founded || 2021);
  $('#statPrograms').textContent = String(progList.length);
  $('#statNews').textContent = String(newsList.length);
  $('#statDepts').textContent = String(depts.length);
  $('#topNewsCount').textContent = String(newsList.length);
  $('#btnNewsCount').textContent = String(newsList.length);
  $('#modalNewsCount').textContent = String(newsList.length);

  /* 拍 ②：平时做什么（5 种活动，每种一句话） */
  $('#progList').innerHTML = progList.map(function (pr, idx) {
    var oneLine = String(pr.desc || '').split(/[；。]/)[0] + '。';
    return '<li class="prog-item">' +
      '<span class="prog-item__no">' + pad2(idx + 1) + '</span>' +
      '<b class="prog-item__name">' + esc(pr.name) + '</b>' +
      '<span class="prog-item__desc">' + esc(oneLine) + '</span>' +
      '<span class="prog-item__where">' + esc(pr.where) + '</span>' +
      '</li>';
  }).join('');

  /* 拍 ③：做过的事（精选 5 条最有分量报道 + 数字跳动属性） */
  $('#newsSub').textContent = '2022–2026 共 ' + newsList.length + ' 篇报道，挑五件最有分量的：';
  if (honors[0]) {
    $('#honorBrief').textContent = honors[0].text;
  }

  var HIGHLIGHTS = [
    { date: '2024-12-09', pre: '近 ', n: 200, suf: ' 人', label: '来听本科阶段 AI 顶级论文经验分享会' },
    { date: '2024-09-24', pre: '', n: 100, suf: ' 余名', label: '同学赴世博中心参观 2024 华为全联接大会' },
    { date: '2026-05-11', pre: '', n: 40, suf: ' 余名', label: '同学入选华为昇腾 AI 大模型创新实践课' },
    { date: '2025-11-25', pre: '近 ', n: 100, suf: ' 名', label: '学子走进华为鸿蒙生态学堂上海站实训' },
    { date: '2025-11-06', pre: '', n: 100, suf: ' 余人', label: '报名协办宏嘉书院焊接与 Vibe Coding 专项赛' }
  ];

  $('#hlList').innerHTML = HIGHLIGHTS.map(function (h) {
    var found = null;
    for (var i = 0; i < newsList.length; i++) {
      if (newsList[i].date === h.date) { found = newsList[i]; break; }
    }
    if (!found) return '';
    var ym = found.date.slice(0, 7).replace('-', '.');
    return '<li class="hl-row">' +
      '<a class="hl-row__link" href="' + esc(found.source) + '" target="_blank" rel="noopener">' +
        '<span class="hl-row__num">' +
          (h.pre ? '<small>' + esc(h.pre) + '</small>' : '') +
          '<b class="js-count" data-target="' + h.n + '">' + h.n + '</b>' +
          (h.suf ? '<small>' + esc(h.suf) + '</small>' : '') +
        '</span>' +
        '<span class="hl-row__title">' + esc(h.label) + '</span>' +
        '<span class="hl-row__date">' + esc(ym) + ' ↗</span>' +
      '</a>' +
    '</li>';
  }).join('');

  var countEls = $$('.js-count');

  /* 拍 ④：谁在带大家 */
  var leader = (C.people && C.people.leaders && C.people.leaders[0]) || null;
  var teachers = (C.people && C.people.teachers) || [];
  var leaderHtml = '';
  if (leader) {
    var awardsHtml = (leader.awards || []).map(function (aw) {
      return '<li>' + esc(aw) + '</li>';
    }).join('');
    leaderHtml =
      '<div class="leader-card">' +
        (leader.photo
          ? '<img class="leader-card__photo" src="../shared/img/' + esc(leader.photo) + '" alt="社长' + esc(leader.name) + '" width="228" height="671" loading="lazy">'
          : '') +
        '<div class="leader-card__body">' +
          '<p class="leader-card__role">' + esc(leader.role) + '</p>' +
          '<p class="leader-card__name">' + esc(leader.name) + '</p>' +
          '<p class="leader-card__desc">' + esc(leader.desc) + '</p>' +
          (awardsHtml ? '<ul class="award-tags" aria-label="竞赛获奖记录">' + awardsHtml + '</ul>' : '') +
        '</div>' +
      '</div>';
  }

  var teachersHtml = teachers.map(function (t) {
    return '<li><strong>' + esc(t.name) + '</strong><span>' + esc(t.role) + '</span></li>';
  }).join('');

  var deptsHtml = depts.map(function (d) {
    return '<li><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></li>';
  }).join('');

  $('#peopleBox').innerHTML =
    leaderHtml +
    '<div class="team-side">' +
      '<ul class="teacher-list" aria-label="指导老师">' + teachersHtml + '</ul>' +
      '<ul class="dept-grid" aria-label="四个部门">' + deptsHtml + '</ul>' +
    '</div>';

  /* 拍 ⑤：怎么加入 */
  var steps = (C.join && C.join.steps) || [];
  $('#stepList').innerHTML = steps.map(function (s, idx) {
    return '<li>' +
      '<span class="step-list__n">' + pad2(idx + 1) + '</span>' +
      '<span class="step-list__t">' + esc(s.t) + '</span>' +
      '<span class="step-list__d">' + esc(s.d) + '</span>' +
    '</li>';
  }).join('');

  $('#wxName').textContent = WX;
  $('#wxClip').value = WX;
  $('#whereLine').textContent = '常驻活动场地：' + String(C.meta.location || '宝山校区翔英大楼');

  var faqs = (C.join && C.join.faq) || [];
  var defaultOpenFaq = window.innerWidth > 960 ? 0 : -1;
  $('#faqList').innerHTML = faqs.map(function (f, idx) {
    var open = idx === defaultOpenFaq;
    return '<div class="faq-item">' +
      '<button type="button" class="faq-q" aria-expanded="' + (open ? 'true' : 'false') + '" data-faq="' + idx + '">' +
        '<span>' + esc(f.q) + '</span>' +
        '<span class="faq-q__icon" aria-hidden="true">' + (open ? '−' : '+') + '</span>' +
      '</button>' +
      '<div class="faq-a"' + (open ? '' : ' hidden') + '>' + esc(f.a) + '</div>' +
    '</div>';
  }).join('');

  $('#faqList').addEventListener('click', function (e) {
    var btn = e.target.closest('.faq-q');
    if (!btn) return;
    var expanded = btn.getAttribute('aria-expanded') === 'true';
    $$('.faq-q', $('#faqList')).forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      $('.faq-q__icon', b).textContent = '+';
      b.nextElementSibling.hidden = true;
    });
    if (!expanded) {
      btn.setAttribute('aria-expanded', 'true');
      $('.faq-q__icon', btn).textContent = '−';
      btn.nextElementSibling.hidden = false;
    }
  });

  /* 页脚信息 */
  $('#footTitle').textContent = C.meta.name || '上海大学人工智能社';
  $('#footMeta').textContent = (C.meta.type || '学术科技类学生社团') +
    ' · 挂靠' + (C.meta.host || '通信与信息工程学院团委') +
    ' · ' + (C.meta.founded || 2021) + ' 年成立 · ' + depts.length + ' 个部门';

  /* HTTP 环境兼容复制公众号名 */
  $('#copyWxBtn').addEventListener('click', function () {
    var clip = $('#wxClip');
    var msg = $('#copyWxMsg');
    var ok = false;
    try {
      clip.removeAttribute('readonly');
      clip.value = WX;
      clip.focus({ preventScroll: true });
      clip.select();
      clip.setSelectionRange(0, WX.length);
      ok = document.execCommand('copy');
      clip.setAttribute('readonly', '');
    } catch (err) {
      ok = false;
    }
    clip.blur();
    try { $('#copyWxBtn').focus({ preventScroll: true }); } catch (e) {}
    msg.textContent = ok
      ? '已复制「' + WX + '」，打开微信搜一搜粘贴关注即可。'
      : '微信里搜索：' + WX;
  });

  /* 3. 全部报道抽屉与分类筛选 */
  var archiveDialog = $('#archiveDialog');
  var lastTrigger = null;

  $('#honorList').innerHTML = honors.map(function (h) {
    return '<li><a href="' + esc(h.source) + '" target="_blank" rel="noopener">' +
      '<span class="honor-year">' + esc(h.year) + '</span>' +
      '<span>' + esc(h.text) + ' ↗</span>' +
    '</a></li>';
  }).join('');

  function renderArchiveNews(cat) {
    var filtered = cat === 'all' ? newsList : newsList.filter(function (n) { return n.cat === cat; });
    $('#allNewsList').innerHTML = filtered.map(function (n) {
      var cName = CAT_NAME[n.cat] || '社团动态';
      return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
        '<span class="news-all__meta">' + esc(n.date.replace(/-/g, '.')) + ' · ' + esc(cName) + '</span>' +
        '<span class="news-all__title">' + esc(n.title) + '</span>' +
        '<span class="news-all__sum">' + esc(n.summary) + '</span>' +
      '</a></li>';
    }).join('');
  }

  var filterCats = ['all', 'weld', 'course', 'visit', 'contest', 'talk'];
  $('#archiveFilters').innerHTML = filterCats.map(function (k) {
    var count = k === 'all' ? newsList.length : newsList.filter(function (n) { return n.cat === k; }).length;
    var label = (k === 'all' ? '全部' : CAT_NAME[k]) + ' (' + count + ')';
    return '<button type="button" class="filter-chip' + (k === 'all' ? ' is-active' : '') + '" data-cat="' + k + '">' + esc(label) + '</button>';
  }).join('');

  $('#archiveFilters').addEventListener('click', function (e) {
    var chip = e.target.closest('.filter-chip');
    if (!chip) return;
    $$('.filter-chip', $('#archiveFilters')).forEach(function (c) { c.classList.remove('is-active'); });
    chip.classList.add('is-active');
    renderArchiveNews(chip.getAttribute('data-cat'));
  });
  renderArchiveNews('all');

  function openArchive(triggerEl) {
    lastTrigger = triggerEl || document.activeElement;
    if (archiveDialog.showModal) {
      archiveDialog.showModal();
    } else {
      archiveDialog.setAttribute('open', '');
    }
  }

  function closeArchive() {
    if (archiveDialog.close) {
      archiveDialog.close();
    } else {
      archiveDialog.removeAttribute('open');
    }
    if (lastTrigger && lastTrigger.focus) {
      try { lastTrigger.focus({ preventScroll: true }); } catch (e) {}
    }
  }

  $('#topArchiveBtn').addEventListener('click', function () { openArchive(this); });
  $('#openArchiveBtn').addEventListener('click', function () { openArchive(this); });
  $('#closeArchiveBtn').addEventListener('click', closeArchive);
  archiveDialog.addEventListener('click', function (e) {
    if (e.target === archiveDialog) closeArchive();
  });

  /* 4. 导航跳转与降级兼容 */
  var beatSections = $$('.beat');
  var meridianBtns = $$('.meridian__btn');
  var beatNowEl = $('#beatNow');
  var coordTxtEl = $('#coordTxt');
  var meridianFillEl = $('#meridianFill');

  var BEAT_SPANS = [1.30, 2.30, 2.30, 2.30, 2.20]; /* 单位：视口高度 VH */
  var beatStarts = [0, 0, 0, 0, 0, 0];
  var trackTop = 0;
  var totalScroll = 1;
  var VW = window.innerWidth;
  var VH = window.innerHeight;

  function scrollToBeat(idx, instant) {
    idx = clamp(idx | 0, 0, 4);
    if (!root.classList.contains('st')) {
      var sec = beatSections[idx];
      if (sec) {
        var top = sec.getBoundingClientRect().top + window.pageYOffset - 64;
        window.scrollTo({ top: Math.max(0, top), behavior: instant ? 'auto' : 'smooth' });
      }
      return;
    }
    var dest = 0;
    if (idx > 0) {
      /* 跳到该拍 45% 静止可读段正中（u = 0.58），一停下即完整清晰 */
      var bStart = beatStarts[idx];
      var bLen = beatStarts[idx + 1] - bStart;
      dest = trackTop + bStart + bLen * 0.58;
    }
    window.scrollTo({ top: Math.round(dest), behavior: instant ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var goEl = e.target.closest('[data-go]');
    if (!goEl) return;
    e.preventDefault();
    var idx = parseInt(goEl.getAttribute('data-go'), 10);
    if (!isNaN(idx)) {
      var isSkip = goEl.classList.contains('skip-link');
      scrollToBeat(idx, isSkip);
      if (isSkip && $('#copyWxBtn')) {
        setTimeout(function () {
          try { $('#copyWxBtn').focus({ preventScroll: true }); } catch (err) {}
        }, 60);
      }
    }
  });

  function setActiveNav(idx, overallProgress) {
    beatNowEl.textContent = pad2(idx + 1);
    meridianFillEl.style.transform = 'scaleX(' + clamp(0.12 + overallProgress * 0.88, 0.12, 1).toFixed(3) + ')';
    for (var i = 0; i < meridianBtns.length; i++) {
      var active = i === idx;
      meridianBtns[i].classList.toggle('is-active', active);
      if (active) meridianBtns[i].setAttribute('aria-current', 'step');
      else meridianBtns[i].removeAttribute('aria-current');
    }
  }

  function enterFallbackMode() {
    root.classList.remove('st');
    function syncFallbackNav() {
      var mid = window.innerHeight * 0.45;
      var curIdx = 0;
      for (var i = 0; i < beatSections.length; i++) {
        if (beatSections[i].getBoundingClientRect().top <= mid) curIdx = i;
      }
      var maxS = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      setActiveNav(curIdx, window.pageYOffset / maxS);
    }
    window.addEventListener('scroll', syncFallbackNav, { passive: true });
    var q = location.search || '';
    var mAt = q.match(/[?&]at=(\d+)/);
    var mBeat = q.match(/[?&]beat=(\d+)/);
    if (mAt) window.scrollTo(0, parseInt(mAt[1], 10));
    else if (mBeat) scrollToBeat(parseInt(mBeat[1], 10), true);
    syncFallbackNav();
  }

  /* 若处于降级流式布局（无 WebGL 或 prefers-reduced-motion），仅做轻量当前节高亮即可 */
  if (!root.classList.contains('st') || !window.SphereStage) {
    enterFallbackMode();
    return;
  }

  /* 5. 初始化 WebGL1 报道星球舞台 */
  var trackEl = $('#track');
  var stageEl = $('#stage');
  var canvasEl = $('#sphereCanvas');
  var heroBox = $('#heroBox');
  var sphereCue = $('#sphereCue');
  var vignetteEl = $('#vignette');

  var sphere = null;
  try {
    sphere = new window.SphereStage(canvasEl, C);
  } catch (err) {
    enterFallbackMode();
    return;
  }

  var sheets = [null];
  for (var sIdx = 1; sIdx <= 4; sIdx++) {
    var shEl = $('.card-sheet[data-sheet="' + sIdx + '"]');
    sheets.push({
      el: shEl,
      paper: $('.card-sheet__paper', shEl),
      body: $('.card-sheet__body', shEl),
      cx: 0,
      cy: 0,
      w: 600,
      h: 420
    });
  }

  function measure() {
    VW = stageEl.clientWidth || window.innerWidth;
    VH = stageEl.clientHeight || window.innerHeight;
    sphere.resize(VW, VH);

    var acc = 0;
    for (var i = 0; i < BEAT_SPANS.length; i++) {
      beatStarts[i] = acc;
      acc += BEAT_SPANS[i] * VH;
    }
    beatStarts[BEAT_SPANS.length] = acc;
    totalScroll = Math.max(1, acc);
    trackEl.style.height = Math.round(acc + VH) + 'px';

    var rect = trackEl.getBoundingClientRect();
    trackTop = rect.top + window.pageYOffset;
    var sRect = stageEl.getBoundingClientRect();

    /* 测量四张 HTML 纸卡在静止展开态（transform: none）下相对于舞台的基准中心与宽高 */
    for (var k = 1; k <= 4; k++) {
      var sh = sheets[k];
      var prevP = sh.paper.style.transform;
      var prevB = sh.body.style.transform;
      sh.paper.style.transform = 'none';
      sh.body.style.transform = 'none';
      var r = sh.el.getBoundingClientRect();
      sh.w = Math.max(240, r.width);
      sh.h = Math.max(200, r.height);
      sh.cx = (r.left - sRect.left) + r.width * 0.5;
      sh.cy = (r.top - sRect.top) + r.height * 0.5;
      sh.paper.style.transform = prevP;
      sh.body.style.transform = prevB;
    }
  }

  var targetY = 0, smoothY = 0, idleYaw = 0;
  var curFrameOffsetX = 0.35, curFrameOffsetY = -0.02, curFrameCamDist = 4.0, curFrameDim = 0;
  var drag = { active: false, id: -1, lastX: 0, lastY: 0, lastT: 0, yaw: 0, pitch: 0, vy: 0, vp: 0 };
  var hover = { x: 0, y: 0, tx: 0, ty: 0, on: 0, targetOn: 0 };
  var inView = true, pageHidden = document.hidden, rafId = 0, lastTime = 0;

  function requestTick() {
    if (!rafId && !pageHidden && inView) {
      rafId = requestAnimationFrame(tick);
    }
  }

  sphere.onDirty = requestTick;

  /* 指针按住拨动球体（支持甩出惯性与物理弹簧回弹；移动端 touch-action: pan-y 不劫持纵向滚动） */
  canvasEl.addEventListener('pointerdown', function (e) {
    if (e.button && e.button !== 0) return;
    drag.active = true;
    drag.id = e.pointerId;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = performance.now();
    drag.vy = 0;
    drag.vp = 0;
    hover.targetOn = 0;
    canvasEl.classList.add('is-dragging');
    try { canvasEl.setPointerCapture(e.pointerId); } catch (err) {}
    requestTick();
  });

  canvasEl.addEventListener('pointermove', function (e) {
    if (!drag.active || e.pointerId !== drag.id) return;
    var nowT = performance.now();
    var dtMove = Math.max(8, nowT - (drag.lastT || nowT - 16)) / 1000;
    var dx = e.clientX - drag.lastX;
    var dy = e.clientY - drag.lastY;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = nowT;
    var k = 3.2 / Math.max(320, Math.min(VW, VH));
    drag.yaw = clamp(drag.yaw + dx * k, -1.45, 1.45);
    drag.pitch = clamp(drag.pitch + dy * k * 0.7, -0.78, 0.78);
    drag.vy = clamp(drag.vy * 0.45 + (dx * k / dtMove) * 0.55, -8.5, 8.5);
    drag.vp = clamp(drag.vp * 0.45 + (dy * k * 0.7 / dtMove) * 0.55, -5.5, 5.5);
    requestTick();
  });

  function endDrag(e) {
    if (!drag.active || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
    if (performance.now() - drag.lastT > 90) {
      drag.vy = 0;
      drag.vp = 0;
    }
    drag.active = false;
    canvasEl.classList.remove('is-dragging');
    try { canvasEl.releasePointerCapture(drag.id); } catch (err) {}
    requestTick();
  }
  canvasEl.addEventListener('pointerup', endDrag);
  canvasEl.addEventListener('pointercancel', endDrag);

  /* 桌面鼠标掠过球面时卡片微微浮起 */
  stageEl.addEventListener('pointermove', function (e) {
    if (drag.active || e.pointerType === 'touch' || curFrameDim > 0.45) {
      if (hover.targetOn > 0) { hover.targetOn = 0; requestTick(); }
      return;
    }
    var sRect = stageEl.getBoundingClientRect();
    var nx = ((e.clientX - sRect.left) / Math.max(1, VW)) * 2 - 1;
    var ny = 1 - ((e.clientY - sRect.top) / Math.max(1, VH)) * 2;
    var py = sphere.focal;
    var px = py / (VW / Math.max(1, VH));
    var depth = Math.max(1.2, curFrameCamDist - 0.86);
    var hx = (nx - curFrameOffsetX) * depth / px;
    var hy = (ny - curFrameOffsetY) * depth / py;
    hover.tx = hx;
    hover.ty = hy;
    hover.targetOn = (hx * hx + hy * hy < 1.32) ? 1 : 0;
    requestTick();
  }, { passive: true });

  stageEl.addEventListener('pointerleave', function () {
    if (hover.targetOn > 0) {
      hover.targetOn = 0;
      requestTick();
    }
  });

  /* 监听原生滚动（零 preventDefault） */
  function readScroll() {
    targetY = clamp(window.pageYOffset - trackTop, 0, totalScroll);
  }

  window.addEventListener('scroll', function () {
    readScroll();
    requestTick();
  }, { passive: true });

  window.addEventListener('resize', function () {
    measure();
    readScroll();
    renderAt(smoothY, true);
    requestTick();
  });

  /* 视口外与后台标签页暂停渲染 */
  if (window.IntersectionObserver) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0]) {
        inView = entries[0].isIntersecting;
        if (inView) requestTick();
        else if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      }
    }, { threshold: 0 });
    io.observe(trackEl);
  }

  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden;
    if (pageHidden && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    } else if (!pageHidden) {
      lastTime = 0;
      requestTick();
    }
  });

  /* 监听运行期切换到减少动态 */
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var onMq = function (ev) {
      if (ev.matches) {
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
        root.classList.remove('st');
        trackEl.style.height = '';
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
  } catch (e) {}

  function formatCoord(latRad, lonRad) {
    var lonDeg = ((lonRad / DEG) % 360 + 540) % 360 - 180;
    var latDeg = clamp(latRad / DEG, -90, 90);
    var ew = lonDeg >= 0 ? '东经 ' : '西经 ';
    var ns = latDeg >= 0 ? '北纬 +' : '南纬 −';
    var loStr = String(Math.round(Math.abs(lonDeg))).padStart(3, '0');
    var laStr = String(Math.round(Math.abs(latDeg))).padStart(2, '0');
    return ew + loStr + '° · ' + ns + laStr + '°';
  }

  var lastCountVal = -1;
  function updateHighlightCounts(ratio) {
    var r = clamp(ratio, 0, 1);
    var q = Math.round(r * 100);
    if (q === lastCountVal) return;
    lastCountVal = q;
    for (var i = 0; i < countEls.length; i++) {
      var goal = parseInt(countEls[i].getAttribute('data-target'), 10) || 0;
      countEls[i].textContent = String(Math.max(1, Math.round(goal * easeOutCubic(r))));
    }
  }

  /* 根据平滑滚动距离 y 计算球体状态与 HTML 卡片形态 */
  function renderAt(y, forceDom) {
    var anchors = sphere.anchors;
    var isMobile = VW <= 960;

    /* 首屏球体在右侧（窄屏在下半屏），进入第 2 拍前平滑移至舞台正中央；距离随视口比例自适应防裁切 */
    var heroOffsetX = isMobile ? 0.0 : 0.35;
    var heroOffsetY = isMobile ? -0.29 : -0.02;
    var centerOffsetX = 0.0;
    var centerOffsetY = -0.02;

    var baseDistHero = isMobile
      ? sphere.computeCamDist(0.82, 0.43)
      : sphere.computeCamDist(0.47, 0.78);
    var baseDistCenter = isMobile
      ? sphere.computeCamDist(0.86, 0.56)
      : sphere.computeCamDist(0.58, 0.84);

    var beatIdx = 0;
    for (var b = 0; b < BEAT_SPANS.length; b++) {
      if (y >= beatStarts[b]) beatIdx = b;
    }
    var bStart = beatStarts[beatIdx];
    var bLen = Math.max(1, beatStarts[beatIdx + 1] - bStart);
    var u = clamp((y - bStart) / bLen, 0, 1);

    var curLat = anchors[0].lat;
    var curLon = anchors[0].lon;
    var offsetX = heroOffsetX;
    var offsetY = heroOffsetY;
    var camDist = baseDistHero;
    var activeCard = -1;
    var activeBeat = 0;
    var clusterPop = 0;
    var fly = 0;
    var dim = 0;
    var shadow = 0;
    var leadAlpha = 1;
    var openSheetIdx = 0;

    var TWO_PI = Math.PI * 2;
    var p1Lon = lerp(anchors[0].lon, anchors[1].lon, 0.32);
    var p1Lat = lerp(anchors[0].lat, anchors[1].lat, 0.32);
    var turnOffset = (p1Lon - (anchors[0].lon + idleYaw) < 0.15) ? TWO_PI : 0;

    if (beatIdx === 0) {
      /* 拍 ① 首屏：前段稳定可读 + 顶位慢速自转；后段球移向中央并顺向转往第 2 拍 */
      var tMove = smoothstep(0.36, 1.0, u);
      curLon = lerp(anchors[0].lon + idleYaw, p1Lon + turnOffset, tMove);
      curLat = lerp(anchors[0].lat, p1Lat, tMove);
      offsetX = lerp(heroOffsetX, centerOffsetX, tMove);
      offsetY = lerp(heroOffsetY, centerOffsetY, tMove);
      camDist = lerp(baseDistHero, baseDistCenter, tMove);

      var heroOut = smoothstep(0.42, 0.92, u);
      heroBox.style.opacity = (1 - heroOut).toFixed(3);
      heroBox.style.transform = 'translate3d(' + (-heroOut * 36).toFixed(1) + 'px, ' + (-heroOut * 16).toFixed(1) + 'px, 0)';
      heroBox.style.pointerEvents = heroOut > 0.6 ? 'none' : 'auto';
      heroBox.style.visibility = heroOut > 0.98 ? 'hidden' : 'visible';
      sphereCue.style.opacity = (1 - smoothstep(0.18, 0.55, u)).toFixed(3);
    } else {
      heroBox.style.opacity = '0';
      heroBox.style.pointerEvents = 'none';
      heroBox.style.visibility = 'hidden';
      sphereCue.style.opacity = '0';
      offsetX = centerOffsetX;
      offsetY = centerOffsetY;

      var prevLat = beatIdx === 1 ? p1Lat : lerp(anchors[beatIdx - 1].lat, anchors[beatIdx].lat, 0.22);
      var prevLon = (beatIdx === 1 ? p1Lon : lerp(anchors[beatIdx - 1].lon, anchors[beatIdx].lon, 0.22)) + turnOffset;

      /* 动作段前 22%：转动球体把本拍簇群对准正前方 */
      var tRot = smoothstep(0.0, 0.22, u);
      curLat = lerp(prevLat, anchors[beatIdx].lat, tRot);
      curLon = lerp(prevLon, anchors[beatIdx].lon + turnOffset, tRot);

      activeBeat = beatIdx;
      activeCard = anchors[beatIdx].cardId;
      openSheetIdx = beatIdx;

      if (u <= 0.40) {
        /* 0%–40% 动作段：簇群浮起 + 正前主卡脱离飞出放大摊平 */
        clusterPop = smoothstep(0.06, 0.22, u);
        fly = smoothstep(0.18, 0.40, u);
      } else if (u <= 0.85 || beatIdx === 4) {
        /* 40%–85% 停住可读段（第 5 拍保持展开至轨道末端）：内容完全静止 */
        clusterPop = 1.0;
        fly = 1.0;
      } else {
        /* 85%–100% 过渡段：纸卡折回球面，球体起旋前往下一拍 */
        var tBack = smoothstep(0.85, 0.96, u);
        fly = 1.0 - tBack;
        clusterPop = 1.0 - smoothstep(0.90, 1.0, u);
        var tPreNext = smoothstep(0.93, 1.0, u);
        curLat = lerp(anchors[beatIdx].lat, anchors[beatIdx + 1].lat, tPreNext * 0.22);
        curLon = lerp(anchors[beatIdx].lon, anchors[beatIdx + 1].lon, tPreNext * 0.22) + turnOffset;
      }

      dim = smoothstep(0.32, 0.92, fly);
      camDist = baseDistCenter * (1 + dim * 0.11);
      shadow = Math.sin(clamp(fly * 1.35, 0, 1) * Math.PI) * 0.95;
      leadAlpha = 1.0 - smoothstep(0.24, 0.46, fly);
    }

    curFrameOffsetX = offsetX;
    curFrameOffsetY = offsetY;
    curFrameCamDist = camDist;
    curFrameDim = dim;
    vignetteEl.style.opacity = (0.22 + dim * 0.52).toFixed(3);

    sphere.render({
      lat: curLat, lon: curLon,
      dragYaw: drag.yaw, dragPitch: drag.pitch,
      camDist: camDist, offsetX: offsetX, offsetY: offsetY,
      activeCard: activeCard, activeBeat: activeBeat,
      clusterPop: clusterPop, fly: fly, dim: dim, shadow: shadow, leadAlpha: leadAlpha,
      hoverX: hover.x, hoverY: hover.y, hoverOn: hover.on * (1 - dim)
    });

    /* 更新四张 HTML 内容纸卡的衔接变形与静止态 */
    for (var s = 1; s <= 4; s++) {
      var sh = sheets[s];
      if (s !== openSheetIdx || fly < 0.20) {
        if (sh.el.classList.contains('is-visible') || forceDom) {
          sh.el.classList.remove('is-visible', 'is-interactive');
        }
        continue;
      }

      sh.el.classList.add('is-visible');
      sh.el.classList.toggle('is-interactive', fly > 0.72);

      if (fly >= 0.999) {
        /* 可读段完全静止：零缩放、零偏移，文字锐利 */
        sh.paper.style.opacity = '1';
        sh.paper.style.transform = 'translate3d(0,0,0) scale(1,1)';
        sh.body.style.opacity = '1';
        sh.body.style.transform = 'translate3d(0,0,0) scale(1)';
      } else {
        /* 飞出/飞回衔接段：从 3D 主卡投影矩形平滑展开至完整版面 */
        var refRect = sphere.getLeadScreenRect({
          camDist: camDist,
          offsetX: offsetX,
          offsetY: offsetY,
          fly: Math.min(fly, 0.36)
        });
        var m = easeOutCubic((fly - 0.20) / 0.80);
        var dx = lerp(refRect.cx - sh.cx, 0, m);
        var dy = lerp(refRect.cy - sh.cy, 0, m);
        var sx = lerp(refRect.w / sh.w, 1, m);
        var sy = lerp(refRect.h / sh.h, 1, m);
        var tilt = Math.sin(m * Math.PI) * (s % 2 === 0 ? -1.8 : 1.8);
        var pAlpha = smoothstep(0.20, 0.36, fly);

        sh.paper.style.opacity = pAlpha.toFixed(3);
        sh.paper.style.transform =
          'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0) ' +
          'rotate(' + tilt.toFixed(2) + 'deg) ' +
          'scale(' + sx.toFixed(3) + ',' + sy.toFixed(3) + ')';

        var bReveal = smoothstep(0.52, 0.98, fly);
        var bScale = lerp(0.92, 1.0, bReveal);
        var bY = lerp(14, 0, bReveal);
        sh.body.style.opacity = bReveal.toFixed(3);
        sh.body.style.transform = 'translate3d(0,' + bY.toFixed(1) + 'px,0) scale(' + bScale.toFixed(3) + ')';
      }

      if (s === 2) {
        updateHighlightCounts(smoothstep(0.45, 0.96, fly));
      }
    }

    setActiveNav(beatIdx, y / totalScroll);
    coordTxtEl.textContent = formatCoord(curLat + drag.pitch, curLon - drag.yaw);
  }

  /* 主渲染循环（按需休眠） */
  function tick(now) {
    rafId = 0;
    if (pageHidden || !inView) return;

    var dt = lastTime ? Math.min(50, now - lastTime) : 16.7;
    lastTime = now;

    /* 滚动紧跟手缓动（约 50ms 时间常数） */
    var kScroll = 1 - Math.exp(-dt / 48);
    smoothY += (targetY - smoothY) * kScroll;
    if (Math.abs(targetY - smoothY) < 0.25) smoothY = targetY;

    /* 指针松手后的欠阻尼弹簧回正 */
    if (!drag.active) {
      var dtSec = dt / 1000;
      var springK = 46;
      var damp = 9.5;
      var ay = -springK * drag.yaw - damp * drag.vy;
      var ap = -springK * drag.pitch - damp * drag.vp;
      drag.vy += ay * dtSec;
      drag.vp += ap * dtSec;
      drag.yaw = clamp(drag.yaw + drag.vy * dtSec, -1.65, 1.65);
      drag.pitch = clamp(drag.pitch + drag.vp * dtSec, -0.88, 0.88);
      if (Math.abs(drag.yaw) < 0.0005 && Math.abs(drag.vy) < 0.001) { drag.yaw = 0; drag.vy = 0; }
      if (Math.abs(drag.pitch) < 0.0005 && Math.abs(drag.vp) < 0.001) { drag.pitch = 0; drag.vp = 0; }
    }

    /* 悬停平滑跟随 */
    var kHover = 1 - Math.exp(-dt / 85);
    hover.x += (hover.tx - hover.x) * kHover;
    hover.y += (hover.ty - hover.y) * kHover;
    hover.on += (hover.targetOn - hover.on) * kHover;
    if (Math.abs(hover.on - hover.targetOn) < 0.004) hover.on = hover.targetOn;

    /* 首屏顶位时球体慢速自转（进入滚动段后锁定，避免回卷跳变） */
    var inHeroIdle = smoothY < 3 && targetY < 3;
    if (inHeroIdle && !drag.active) {
      idleYaw += (dt / 1000) * 0.15;
      if (idleYaw >= Math.PI * 2) idleYaw -= Math.PI * 2;
    }

    renderAt(smoothY, false);

    var moving =
      Math.abs(targetY - smoothY) > 0.25 ||
      drag.active ||
      Math.abs(drag.yaw) > 0.0005 ||
      Math.abs(drag.pitch) > 0.0005 ||
      Math.abs(hover.on - hover.targetOn) > 0.004 ||
      (hover.targetOn > 0 && (Math.abs(hover.tx - hover.x) > 0.003 || Math.abs(hover.ty - hover.y) > 0.003)) ||
      inHeroIdle;

    if (moving) {
      rafId = requestAnimationFrame(tick);
    } else {
      lastTime = 0;
    }
  }

  function syncInitialPosition() {
    measure();
    var q = location.search || '';
    var mAt = q.match(/[?&]at=(\d+)/);
    var mBeat = q.match(/[?&]beat=(\d+)/);
    if (mAt) window.scrollTo(0, parseInt(mAt[1], 10));
    else if (mBeat) scrollToBeat(parseInt(mBeat[1], 10), true);
    readScroll();
    smoothY = targetY;
    renderAt(smoothY, true);
    requestTick();
  }

  if ('scrollRestoration' in history && /[?&](at|beat)=\d+/.test(location.search || '')) {
    history.scrollRestoration = 'manual';
  }
  syncInitialPosition();
  window.addEventListener('load', syncInitialPosition);
})();
