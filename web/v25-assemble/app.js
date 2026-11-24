/* v25-assemble · app.js —— 内容渲染 + 原生滚动组装编舞 + 2D 工业引线标注 */
(function () {
  'use strict';

  var C = window.CLUB, root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var sm = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };

  if (!C) { root.classList.remove('staged'); return; }

  /* 1. 内容渲染（严格读取 window.CLUB 并转义） */
  var CAT_LABEL = { weld: '焊接实践', course: '技术课程', visit: '企业参访', contest: '创新大赛', talk: '分享交流' };
  var WX_NAME = String((C.meta.contact && C.meta.contact.wechat) || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '').trim();

  var heroKicker = $('#heroKicker');
  if (heroKicker) heroKicker.textContent = C.meta.founded + ' 成立 · ' + C.meta.host;

  var progList = $('#progList');
  if (progList && Array.isArray(C.programs)) {
    progList.innerHTML = C.programs.map(function (p, i) {
      var brief = String(p.desc || '').split(/[；。]/)[0] + '。';
      return '<li class="prog-item"><span class="prog-item__no">' + pad2(i + 1) + '</span><div class="prog-item__main">' +
        '<b class="prog-item__name">' + esc(p.name) + '</b><span class="prog-item__desc">' + esc(brief) + '</span>' +
        (p.where ? '<span class="prog-item__loc">' + esc(p.where) + '</span>' : '') + '</div></li>';
    }).join('');
  }

  var newsArr = Array.isArray(C.news) ? C.news : [];
  var newsSub = $('#newsSub');
  if (newsSub) newsSub.textContent = '2022–2026 学院官网共 ' + newsArr.length + ' 篇社团报道摘选：';
  var openNewsBtn = $('#openNewsBtn');
  if (openNewsBtn) openNewsBtn.innerHTML = '全部 ' + newsArr.length + ' 篇官网报道 <span aria-hidden="true">→</span>';

  var PICKS = [
    { date: '2024-12-09', pre: '近', num: 200, suf: '人', label: '参加本科撰写 AI 论文经验分享会' },
    { date: '2024-09-24', pre: '',   num: 100, suf: '+人', label: '赴世博中心参观 2024 华为全联接大会' },
    { date: '2026-05-11', pre: '',   num: 40,  suf: '+人', label: '入选华为昇腾 AI 大模型创新实践课' },
    { date: '2025-11-25', pre: '近', num: 100, suf: '人', label: '走进华为鸿蒙生态学堂上海站实训' },
    { date: '2025-11-06', pre: '',   num: 100, suf: '+人', label: '报名宏嘉书院焊接与编程专项赛' }
  ];

  var factList = $('#factList');
  if (factList) {
    factList.innerHTML = PICKS.map(function (pk, idx) {
      var item = newsArr.find(function (n) { return n.date === pk.date; }) || newsArr[idx];
      if (!item) return '';
      var ym = String(item.date || '').slice(0, 7).replace('-', '.');
      return '<li class="fact-item"><a class="fact-item__link" href="' + esc(item.source) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="fact-item__num">' + (pk.pre ? '<small>' + esc(pk.pre) + '</small>' : '') +
        '<b class="js-count" data-target="' + pk.num + '">' + pk.num + '</b>' +
        (pk.suf ? '<small>' + esc(pk.suf) + '</small>' : '') + '</span>' +
        '<span class="fact-item__txt">' + esc(pk.label) + '</span><span class="fact-item__date">' + esc(ym) + ' ↗</span></a></li>';
    }).join('');
  }

  var honorList = $('#honorList');
  if (honorList && Array.isArray(C.honors)) {
    honorList.innerHTML = C.honors.map(function (h) {
      return '<li><b>' + esc(h.year) + '</b><a href="' + esc(h.source) + '" target="_blank" rel="noopener noreferrer">' + esc(h.text) + ' ↗</a></li>';
    }).join('');
  }
  var allNewsList = $('#allNewsList');
  if (allNewsList) {
    allNewsList.innerHTML = newsArr.map(function (n) {
      return '<li><a class="news-all__link" href="' + esc(n.source) + '" target="_blank" rel="noopener noreferrer">' +
        '<span class="news-all__meta">' + esc(String(n.date).replace(/-/g, '.')) + ' · ' + esc(CAT_LABEL[n.cat] || '社团动态') + '</span>' +
        '<span class="news-all__title">' + esc(n.title) + '</span><span class="news-all__sum">' + esc(n.summary) + '</span></a></li>';
    }).join('');
  }

  var depts = Array.isArray(C.meta.departments) ? C.meta.departments : [];
  var peopleSub = $('#peopleSub');
  if (peopleSub) peopleSub.textContent = '学长学姐手把手带入门，' + depts.length + ' 个部门协同运转。';
  var peopleBox = $('#peopleBox');
  if (peopleBox && C.people) {
    var ld = (C.people.leaders && C.people.leaders[0]) || null;
    var tchs = Array.isArray(C.people.teachers) ? C.people.teachers : [];
    var ldHtml = '';
    if (ld) {
      var sents = String(ld.desc || '').split('。').filter(Boolean);
      var shortBio = sents.slice(0, 2).join('。') + (sents.length ? '。' : '');
      var awards = Array.isArray(ld.awards) ? ld.awards : [];
      ldHtml = '<div class="leader-card">' +
        (ld.photo ? '<img class="leader-card__avatar" src="../shared/img/' + esc(ld.photo) + '" alt="社长' + esc(ld.name) + '" width="128" height="152" loading="lazy">' : '') +
        '<div><div class="leader-card__head"><span class="leader-card__name">' + esc(ld.name) + '</span><span class="leader-card__role">' + esc(ld.role) + '</span></div>' +
        '<p class="leader-card__desc">' + esc(shortBio) + '</p>' +
        (awards.length ? '<div class="leader-card__awards">' + awards.map(function (a) {
          return '<span class="award-pill">' + esc(String(a).split('、')[0]) + '</span>';
        }).join('') + '</div>' : '') + '</div></div>';
    }
    var tchHtml = '<ul class="teachers-row">' + tchs.map(function (t) {
      return '<li class="teacher-item"><p class="teacher-item__name">' + esc(t.name) + '</p><p class="teacher-item__role">' + esc(t.role) + '</p></li>';
    }).join('') + '</ul>';
    var depHtml = '<ul class="dept-grid">' + depts.map(function (d) {
      return '<li class="dept-item"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></li>';
    }).join('') + '</ul>';
    peopleBox.innerHTML = ldHtml + tchHtml + depHtml;
  }

  var stepList = $('#stepList');
  if (stepList && C.join && Array.isArray(C.join.steps)) {
    stepList.innerHTML = C.join.steps.map(function (s, i) {
      return '<li class="step-item"><span class="step-item__no">' + pad2(i + 1) + '</span><b class="step-item__t">' + esc(s.t) + '</b><span class="step-item__d">' + esc(s.d) + '</span></li>';
    }).join('');
  }
  var copyBtn = $('#copyBtn'), copyMsg = $('#copyMsg');
  if (copyBtn) copyBtn.textContent = '复制公众号名：' + WX_NAME;
  if (copyMsg) copyMsg.textContent = '微信里搜索：' + WX_NAME;
  var locLine = $('#locLine');
  if (locLine && C.meta.location) locLine.textContent = '常用活动地点：' + C.meta.location;

  var faqMini = $('#faqMini');
  if (faqMini && C.join && Array.isArray(C.join.faq)) {
    faqMini.innerHTML = C.join.faq.slice(0, 2).map(function (f) {
      return '<div class="faq-mini__item"><dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd></div>';
    }).join('');
  }

  var footTitle = $('#footTitle'), footMeta = $('#footMeta');
  if (footTitle) footTitle.textContent = C.meta.name;
  if (footMeta) footMeta.textContent = C.meta.type + ' · 挂靠' + C.meta.host + ' · ' + C.meta.founded + ' 年成立 · ' + depts.length + ' 个部门';

  /* 2. 复制公众号 / 报道抽屉 / 胶片颗粒 */
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var ta = $('#clipTa'), ok = false, sy = window.scrollY;
      try {
        ta.value = WX_NAME; ta.focus({ preventScroll: true });
        ta.select(); ta.setSelectionRange(0, WX_NAME.length);
        ok = document.execCommand('copy');
      } catch (e) { ok = false; }
      if (ta) ta.blur();
      copyBtn.focus({ preventScroll: true });
      if (Math.abs(window.scrollY - sy) > 2) window.scrollTo(0, sy);
      if (copyMsg) copyMsg.textContent = ok ? '已复制「' + WX_NAME + '」，打开微信搜一搜粘贴关注即可。' : '微信里搜索：' + WX_NAME;
    });
  }

  var drawer = $('#newsDrawer'), closeNewsBtn = $('#closeNewsBtn');
  function openDrawer() { if (drawer) { drawer.hidden = false; if (closeNewsBtn) closeNewsBtn.focus({ preventScroll: true }); } }
  function closeDrawer() { if (drawer && !drawer.hidden) { drawer.hidden = true; if (openNewsBtn) openNewsBtn.focus({ preventScroll: true }); } }
  if (openNewsBtn) openNewsBtn.addEventListener('click', openDrawer);
  if (closeNewsBtn) closeNewsBtn.addEventListener('click', closeDrawer);
  if (drawer) drawer.addEventListener('click', function (e) { if (e.target && e.target.hasAttribute('data-close-drawer')) closeDrawer(); });
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape' && drawer && !drawer.hidden) closeDrawer(); });

  try {
    var gcv = document.createElement('canvas'); gcv.width = gcv.height = 128;
    var gctx = gcv.getContext('2d'), gid = gctx.createImageData(128, 128);
    for (var gi = 0; gi < gid.data.length; gi += 4) {
      var gv = (Math.random() * 255) | 0;
      gid.data[gi] = gid.data[gi + 1] = gid.data[gi + 2] = gv; gid.data[gi + 3] = 255;
    }
    gctx.putImageData(gid, 0, 0);
    root.style.setProperty('--grain', 'url(' + gcv.toDataURL() + ')');
  } catch (e) { /* 忽略 */ }

  /* 3. 零件清单进度导航与分节兜底 */
  var REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var BL = [1.3, 2.1, 2.1, 2.1, 1.95];
  var starts = [0, 0, 0, 0, 0], lens = [0, 0, 0, 0, 0];
  var trackTop = 0, totalScroll = 1, stagedActive = false;
  var chkBtns = $$('.chk-btn'), chkNum = $('#chkNum'), topStep = $('#topStep');

  function syncChecklistUI(b, doneFlags) {
    var stepStr = pad2(b + 1);
    if (chkNum && chkNum.textContent !== stepStr) chkNum.textContent = stepStr;
    if (topStep && topStep.textContent !== (stepStr + ' / 05')) topStep.textContent = stepStr + ' / 05';
    chkBtns.forEach(function (btn) {
      var pIdx = parseInt(btn.getAttribute('data-part'), 10) || 0;
      btn.classList.toggle('is-done', !!doneFlags[pIdx]);
      btn.classList.toggle('is-current', b === pIdx);
    });
  }

  function scrollToBeat(idx) {
    var b = clamp(idx | 0, 0, 4);
    if (!stagedActive) {
      var sec = $('#b' + b);
      if (sec) sec.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    window.scrollTo({ top: b === 0 ? trackTop : Math.round(trackTop + starts[b] + lens[b] * 0.56), behavior: REDUCE ? 'auto' : 'smooth' });
  }

  $$('[data-go]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToBeat(parseInt(el.getAttribute('data-go'), 10) || 0);
    });
  });

  function initFallbackSpy() {
    root.classList.remove('staged');
    var secs = [$('#b0'), $('#b1'), $('#b2'), $('#b3'), $('#b4')];
    var onScroll = function () {
      var mid = window.innerHeight * 0.42, cur = 0;
      for (var i = 0; i < 5; i++) if (secs[i] && secs[i].getBoundingClientRect().top <= mid) cur = i;
      syncChecklistUI(cur, [false, cur >= 1, cur >= 2, cur >= 3, cur >= 4]);
      root.classList.toggle('is-dark', cur === 4);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* 4. 吸顶舞台与 WebGL 组装编舞 */
  if (!root.classList.contains('staged') || !window.AssembleGL) { initFallbackSpy(); return; }

  var glCanvas = $('#gl'), hudCanvas = $('#hud'), stage = $('#stage'), track = $('#track');
  var rotZone = $('#rotZone'), rotHint = $('#rotHint');
  var engine = window.AssembleGL.create(glCanvas);
  var hud = hudCanvas ? hudCanvas.getContext('2d') : null;
  if (!engine || !hud || !stage || !track) { initFallbackSpy(); return; }

  stagedActive = true;
  root.classList.add('stage-ok');

  var heroBox = $('.hero', stage);
  var cards = [null, $('[data-card="1"]'), $('[data-card="2"]'), $('[data-card="3"]'), $('[data-card="4"]')];
  var countNodes = $$('.js-count');

  var VW = 1, VH = 1, DPR = 1, isMobile = false;
  var heroRight = 480, heroBot = 240, cardRects = [null, null, null, null, null];
  var styleCache = new WeakMap();

  function measureLayout() {
    styleCache = new WeakMap();
    VW = stage.clientWidth || window.innerWidth || 1;
    VH = stage.clientHeight || window.innerHeight || 1;
    isMobile = VW < 900;
    var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    DPR = Math.min(window.devicePixelRatio || 1, (VW < 768 || coarse) ? 1 : 1.5);

    var acc = 0;
    for (var i = 0; i < 5; i++) { starts[i] = acc; lens[i] = Math.round(BL[i] * VH); acc += lens[i]; }
    totalScroll = Math.max(1, acc);
    track.style.height = Math.round(totalScroll + VH) + 'px';
    trackTop = track.getBoundingClientRect().top + window.scrollY;

    engine.resize(VW, VH, DPR);
    var cw = Math.round(VW * DPR), ch = Math.round(VH * DPR);
    if (hudCanvas.width !== cw || hudCanvas.height !== ch) { hudCanvas.width = cw; hudCanvas.height = ch; }

    var sr = stage.getBoundingClientRect();
    if (heroBox) {
      var savedTr = heroBox.style.transform;
      heroBox.style.transform = isMobile ? 'none' : 'translate3d(0,-50%,0)';
      var hr = heroBox.getBoundingClientRect();
      heroRight = hr.right - sr.left;
      heroBot = hr.bottom - sr.top;
      heroBox.style.transform = savedTr;
    }

    var availH = isMobile ? (VH * 0.62 - 62) : (VH - 116);
    for (var k = 1; k <= 4; k++) {
      var c = cards[k];
      if (!c) continue;
      c.style.setProperty('--fit', '1');
      c.style.setProperty('--cy', '0px');
      var fit = clamp(availH / Math.max(c.offsetHeight || 300, 1), 0.76, 1);
      c.style.setProperty('--fit', fit.toFixed(3));
      var r = c.getBoundingClientRect();
      cardRects[k] = { left: r.left - sr.left, top: r.top - sr.top, width: r.width, height: r.height };
    }
  }

  function partGap(u) {
    if (u <= 0) return 1;
    if (u < 0.29) { var t = u / 0.29; return (1 - t) * (1 - 0.40 * t * t); }
    if (u < 0.39) { var r = (u - 0.29) / 0.10; return Math.max(0, 0.035 * Math.sin(r * Math.PI) * (1 - r)); }
    return 0;
  }
  function snapFlash(u) {
    if (u < 0.26 || u > 0.40) return 0;
    return u < 0.295 ? (u - 0.26) / 0.035 : 1 - (u - 0.295) / 0.105;
  }
  function snapImpulse(u) {
    if (u < 0.28 || u > 0.40) return 0;
    var r = (u - 0.28) / 0.12;
    return Math.sin(r * Math.PI * 2.0) * Math.exp(-r * 3.0);
  }

  var drag = { active: false, id: -1, x0: 0, y0: 0, moved: false, yaw: 0, pitch: 0 };
  var hover = { x: 0, y: 0 }, starUntil = 0, hopUntil = 0;

  if (rotZone) {
    rotZone.addEventListener('pointerdown', function (e) {
      drag.active = true; drag.id = e.pointerId; drag.x0 = e.clientX; drag.y0 = e.clientY; drag.moved = false;
      rotZone.classList.add('is-dragging'); wake();
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag.active) {
        if (!isMobile) { hover.x = (e.clientX / Math.max(VW, 1)) * 2 - 1; hover.y = (e.clientY / Math.max(VH, 1)) * 2 - 1; wake(); }
        return;
      }
      if (e.pointerId !== drag.id) return;
      var dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
      if (!drag.moved && Math.hypot(dx, dy) > 6) {
        if (Math.abs(dy) > Math.abs(dx) * 1.25 && e.pointerType === 'touch') {
          drag.active = false; rotZone.classList.remove('is-dragging'); return;
        }
        drag.moved = true;
        if (rotHint) rotHint.classList.add('is-hidden');
      }
      if (drag.moved) {
        drag.yaw = clamp(drag.yaw + dx * 0.0095, -Math.PI * 1.05, Math.PI * 1.05);
        drag.pitch = clamp(drag.pitch + dy * 0.0045, -0.34, 0.34);
        drag.x0 = e.clientX; drag.y0 = e.clientY; wake();
      }
    }, { passive: true });
    var endDrag = function (e) {
      if (!drag.active || (e && e.pointerId != null && e.pointerId !== drag.id)) return;
      if (!drag.moved) { var now = performance.now(); starUntil = now + 1300; hopUntil = now + 520; }
      drag.active = false; rotZone.classList.remove('is-dragging'); wake();
    };
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });
  }

  var PART_META = [
    null,
    { key: 'visor', name: '01 面罩屏幕', mm: 68 },
    { key: 'ears',  name: '02 钴蓝耳机', mm: 54 },
    { key: 'ant',   name: '03 双球天线', mm: 46 },
    { key: 'chest', name: '04 胸口指示灯', mm: 58 }
  ];

  function relaxY(items, minY, maxY, gap) {
    items.sort(function (a, b) { return a.pt[1] - b.pt[1]; });
    var n = items.length;
    for (var i = 0; i < n; i++) items[i].ty = clamp(items[i].pt[1], minY + i * gap, maxY - (n - 1 - i) * gap);
    for (var j = 1; j < n; j++) if (items[j].ty < items[j - 1].ty + gap) items[j].ty = items[j - 1].ty + gap;
    for (var k = n - 2; k >= 0; k--) if (items[k].ty > items[k + 1].ty - gap) items[k].ty = items[k + 1].ty - gap;
  }

  function drawSnapBurst(x, y, fl, isCyan) {
    if (fl <= 0.02) return;
    hud.save();
    var r = 10 + (1 - fl) * 42;
    hud.strokeStyle = isCyan ? 'rgba(20,232,255,' + (fl * 0.88).toFixed(3) + ')' : 'rgba(15,78,194,' + (fl * 0.76).toFixed(3) + ')';
    hud.lineWidth = 1.6;
    hud.beginPath(); hud.arc(x, y, r, 0, Math.PI * 2); hud.stroke();
    for (var i = 0; i < 8; i++) {
      var a = (i / 8) * Math.PI * 2 + 0.25;
      hud.beginPath();
      hud.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
      hud.lineTo(x + Math.cos(a) * r * 1.24, y + Math.sin(a) * r * 1.24);
      hud.stroke();
    }
    hud.restore();
  }

  function drawHUD(proj, st) {
    hud.setTransform(DPR, 0, 0, DPR, 0, 0);
    hud.clearRect(0, 0, VW, VH);

    hud.save();
    hud.lineWidth = 1; hud.setLineDash([3, 4]);
    hud.strokeStyle = st.dark > 0.5 ? 'rgba(20,232,255,0.28)' : 'rgba(15,78,194,0.25)';
    for (var i = 0; i < proj.axes.length; i++) {
      var ax = proj.axes[i];
      if (ax.gap <= 0.025) continue;
      hud.beginPath(); hud.moveTo(ax.a[0], ax.a[1]); hud.lineTo(ax.b[0], ax.b[1]); hud.stroke();
      hud.setLineDash([]); hud.beginPath(); hud.arc(ax.a[0], ax.a[1], 2.2, 0, Math.PI * 2); hud.stroke(); hud.setLineDash([3, 4]);
    }
    hud.restore();

    if (st.heroLabelA > 0.02) {
      var bd = proj.bounds, minGap = isMobile ? 22 : 30;
      var topY = isMobile ? (heroBot + 14) : Math.max(74, bd.minY + 8);
      var botY = isMobile ? (VH - 64) : Math.min(VH - 56, bd.maxY - 8);
      var leftSlots = [
        { pt: proj.anchors.head,      txt: '头壳' },
        { pt: proj.anchors.visorLeft, txt: isMobile ? '01 面罩' : '01 面罩屏幕' },
        { pt: proj.anchors.torso,     txt: '身体' }
      ];
      var rightSlots = [
        { pt: proj.anchors.ant,   txt: isMobile ? '03 天线' : '03 两根天线' },
        { pt: proj.anchors.ears,  txt: isMobile ? '02 耳机' : '02 钴蓝耳机' },
        { pt: proj.anchors.chest, txt: isMobile ? '04 指示灯' : '04 胸口指示灯' },
        { pt: proj.anchors.limbs, txt: '手脚' }
      ];
      relaxY(leftSlots, topY, botY, minGap);
      relaxY(rightSlots, topY, botY, minGap);

      var lPad = isMobile ? 54 : 84, rPad = isMobile ? 60 : 94;
      var lTx = clamp(bd.minX - (isMobile ? 10 : 20), isMobile ? (6 + lPad) : (heroRight + 16 + lPad), proj.center[0] - 32);
      var rTx = clamp(bd.maxX + (isMobile ? 10 : 20), proj.center[0] + 32, isMobile ? (VW - 6 - rPad) : (VW - 152 - rPad));

      hud.save();
      hud.globalAlpha = st.heroLabelA;
      hud.font = '600 ' + (isMobile ? 10.5 : 11.5) + 'px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
      var drawSlot = function (it, isLeft) {
        var px = it.pt[0], py = it.pt[1], tx = isLeft ? lTx : rTx;
        var ex = isLeft ? Math.min(px - 6, tx + 12) : Math.max(px + 6, tx - 12);
        hud.strokeStyle = 'rgba(20,23,31,0.46)'; hud.lineWidth = 1;
        hud.beginPath(); hud.moveTo(px, py); hud.lineTo(ex, it.ty); hud.lineTo(tx, it.ty); hud.stroke();
        hud.fillStyle = '#0f4ec2'; hud.beginPath(); hud.arc(px, py, 2.4, 0, Math.PI * 2); hud.fill();
        hud.fillStyle = '#14171f'; hud.textAlign = isLeft ? 'right' : 'left'; hud.textBaseline = 'middle';
        hud.fillText(it.txt, tx + (isLeft ? -5 : 5), it.ty);
      };
      leftSlots.forEach(function (it) { drawSlot(it, true); });
      rightSlots.forEach(function (it) { drawSlot(it, false); });
      hud.restore();
    }

    var b = st.activeBeat;
    if (b >= 1 && b <= 4) {
      var meta = PART_META[b], pt = proj.anchors[meta.key], u = st.beatU;
      var fl = st.activeFlash, useCyan = b === 4 && st.dark > 0.35;
      var mainCol = useCyan ? '#14e8ff' : '#0f4ec2';

      if (fl > 0.02) {
        drawSnapBurst(pt[0], pt[1], fl, useCyan);
        if (b === 2) drawSnapBurst(proj.anchors.earsL[0], proj.anchors.earsL[1], fl, false);
        if (b === 3) drawSnapBurst(proj.anchors.antL[0], proj.anchors.antL[1], fl, false);
      }

      if (u > 0.015 && u < 0.35) {
        var mmLeft = Math.max(0, Math.round(st.activeGap * meta.mm));
        var tagTxt = u >= 0.285 ? (meta.name + ' · 咔！已扣合') : (meta.name + ' · 间隙 ' + mmLeft + 'mm');
        hud.save();
        hud.globalAlpha = sm(0.015, 0.055, u) * (1 - sm(0.30, 0.35, u));
        hud.strokeStyle = hud.fillStyle = mainCol; hud.lineWidth = 1.2;
        var lx = clamp(pt[0] + (isMobile ? 16 : 26), 16, VW - (isMobile ? 165 : 195));
        var ly = clamp(pt[1] - 18, 62, VH - 80);
        hud.beginPath(); hud.arc(pt[0], pt[1], 3, 0, Math.PI * 2); hud.fill();
        hud.beginPath(); hud.moveTo(pt[0], pt[1]); hud.lineTo(lx, ly); hud.lineTo(lx + 14, ly); hud.stroke();
        hud.font = '600 11.5px "Geist Mono", -apple-system, "PingFang SC", sans-serif';
        hud.textAlign = 'left'; hud.textBaseline = 'middle';
        var tw = hud.measureText(tagTxt).width;
        hud.fillStyle = st.dark > 0.5 ? 'rgba(21,26,34,0.92)' : 'rgba(240,239,234,0.94)';
        hud.fillRect(lx + 13, ly - 10, tw + 10, 20);
        hud.strokeRect(lx + 13.5, ly - 9.5, tw + 9, 19);
        hud.fillStyle = mainCol;
        hud.fillText(tagTxt, lx + 18, ly);
        hud.restore();
      }

      var lineK = sm(0.25, 0.37, u) * (b < 4 ? (1 - sm(0.85, 0.96, u)) : 1);
      var rect = cardRects[b];
      if (lineK > 0.01 && rect) {
        /* 桌面：引线先水平走出机身再折到卡片左缘，不横穿小智的脸 */
        var tx2 = isMobile ? clamp(Math.max(pt[0], proj.bounds.maxX + 10), rect.left + 22, rect.left + rect.width - 22) : rect.left;
        var ty2 = isMobile ? (rect.top + (st.cardY || 0)) : clamp(pt[1], rect.top + 34, rect.top + rect.height - 34) + (st.cardY || 0);
        var mx = isMobile ? tx2 : clamp(proj.bounds.maxX + 14, pt[0] + 10, tx2 - 10), my = pt[1];

        hud.save();
        hud.strokeStyle = hud.fillStyle = mainCol; hud.lineWidth = 1.35;
        if (useCyan) { hud.shadowColor = 'rgba(20,232,255,0.55)'; hud.shadowBlur = 8; }
        hud.beginPath(); hud.arc(pt[0], pt[1], 3.2, 0, Math.PI * 2); hud.fill();

        var seg1 = Math.hypot(mx - pt[0], my - pt[1]), seg2 = Math.hypot(tx2 - mx, ty2 - my);
        var drawLen = Math.max(1, seg1 + seg2) * lineK;
        hud.beginPath(); hud.moveTo(pt[0], pt[1]);
        if (drawLen <= seg1) {
          var k1 = drawLen / Math.max(seg1, 1);
          hud.lineTo(lerp(pt[0], mx, k1), lerp(pt[1], my, k1)); hud.stroke();
        } else {
          var k2 = (drawLen - seg1) / Math.max(seg2, 1);
          hud.lineTo(mx, my); hud.lineTo(lerp(mx, tx2, k2), lerp(my, ty2, k2)); hud.stroke();
          if (lineK > 0.92) hud.fillRect(tx2 - 3, ty2 - 3, 6, 6);
        }
        hud.restore();
      }
    }
  }

  function setStyle(el, prop, val) {
    if (!el) return;
    var bag = styleCache.get(el);
    if (!bag) { bag = {}; styleCache.set(el, bag); }
    if (bag[prop] !== val) { bag[prop] = val; el.style[prop] = val; }
  }

  var curS = 0, targetS = 0, rafId = 0, lastTs = 0;
  var inView = true, pageHidden = false, virtS = null;

  function readTargetScroll() {
    if (virtS !== null && window.scrollY < 2) return clamp(typeof virtS === 'function' ? virtS() : virtS, 0, totalScroll);
    virtS = null;
    return clamp(window.scrollY - trackTop, 0, totalScroll);
  }

  function renderAt(s, nowMs) {
    var b = 0, u = 0;
    for (var i = 0; i < 5; i++) {
      if (s < starts[i] + lens[i] || i === 4) { b = i; u = clamp((s - starts[i]) / Math.max(lens[i], 1), 0, 1); break; }
    }

    var u0 = clamp(s / Math.max(lens[0], 1), 0, 1);
    var u1 = clamp((s - starts[1]) / Math.max(lens[1], 1), 0, 1);
    var u2 = clamp((s - starts[2]) / Math.max(lens[2], 1), 0, 1);
    var u3 = clamp((s - starts[3]) / Math.max(lens[3], 1), 0, 1);
    var u4 = clamp((s - starts[4]) / Math.max(lens[4], 1), 0, 1);

    var baseDock = clamp((s - lens[0] * 0.72) / Math.max(lens[0] * 0.28 + lens[1] * 0.05, 1), 0, 1);
    var eBase = (1 - 0.10 * Math.min(u0, 0.72)) * (1 - sm(0, 1, baseDock));
    var fBase = baseDock > 0.82 && baseDock < 0.99 ? Math.sin(((baseDock - 0.82) / 0.17) * Math.PI) * 0.75 : 0;

    var eVisor = s <= starts[1] ? 1 : partGap(u1), eEars = s <= starts[2] ? 1 : partGap(u2);
    var eAnt = s <= starts[3] ? 1 : partGap(u3), eChest = s <= starts[4] ? 1 : partGap(u4);
    var fVisor = b === 1 ? snapFlash(u1) : 0, fEars = b === 2 ? snapFlash(u2) : 0;
    var fAnt = b === 3 ? snapFlash(u3) : 0, fChest = b === 4 ? snapFlash(u4) : 0;
    var k1 = b === 1 ? snapImpulse(u1) : 0, k2 = b === 2 ? snapImpulse(u2) : 0;
    var k3 = b === 3 ? snapImpulse(u3) : 0, k4 = b === 4 ? snapImpulse(u4) : 0;

    var power = b === 4 ? sm(0.27, 0.40, u4) : 0, dark = b === 4 ? sm(0.22, 0.39, u4) : 0;
    root.style.setProperty('--dark', dark.toFixed(3));
    root.classList.toggle('is-dark', dark > 0.5);

    var stageShift = sm(0.72, 1.0, u0), uPx = engine.unitPx(VH), cx, cy, botScale;
    if (isMobile) {
      var availH0 = Math.max(150, (VH - 58) - (heroBot + 10)), availW0 = Math.max(142, VW - 144);
      var sc0 = Math.min(availW0 / 2.58, (availH0 - 18) / 3.24) / uPx;
      var cy0 = heroBot + 8 + availH0 * 0.50 + 0.18 * sc0 * uPx;
      var cTop = cardRects[1] ? cardRects[1].top : VH * 0.38, topH = Math.max(115, cTop - 54);
      var sc1 = Math.min((VW - 40) / 2.48, (topH - 12) / 2.62) / uPx;
      var cy1 = 48 + topH * 0.53 + 0.22 * sc1 * uPx;
      cx = VW * 0.50; cy = lerp(cy0, cy1, stageShift); botScale = lerp(sc0, sc1, stageShift);
      if (rotZone) {
        setStyle(rotZone, 'top', Math.round(lerp(heroBot + 8, 48, stageShift)) + 'px');
        setStyle(rotZone, 'height', Math.round(lerp(availH0, topH, stageShift)) + 'px');
        setStyle(rotZone, 'transform', 'none');
      }
    } else {
      var zLeft0 = heroRight + 16, zW0 = Math.max(300, (VW - 150) - zLeft0);
      var sc0d = Math.min((zW0 - 208) / 2.58, (VH - 148) / 3.26) / uPx;
      var cx0d = zLeft0 + zW0 * 0.50, cy0d = VH * 0.50 + 0.18 * sc0d * uPx;
      var cLeft = cardRects[1] ? cardRects[1].left : VW * 0.41, zW1 = Math.max(250, cLeft - 48);
      var compactK = 1 + 0.08 * sm(0.35, 1.0, u2) + 0.05 * sm(0.35, 1.0, u3);
      var sc1d = (Math.min((zW1 - 24) / 2.48, (VH - 156) / 2.64) / uPx) * compactK;
      var cx1d = 26 + zW1 * 0.50, cy1d = VH * 0.51 + 0.18 * sc1d * uPx;
      cx = lerp(cx0d, cx1d, stageShift); cy = lerp(cy0d, cy1d, stageShift); botScale = lerp(sc0d, sc1d, stageShift);
      if (rotZone) {
        setStyle(rotZone, 'top', '60px'); setStyle(rotZone, 'height', '');
        setStyle(rotZone, 'transform', 'translate3d(' + Math.round(cx - VW * 0.18) + 'px,0,0)');
      }
    }

    var baseYaw = -0.44 * (1 - stageShift)
      + 0.24 * stageShift * (1 - sm(0, 0.30, u2))
      - 0.28 * sm(0, 0.30, u2) * (1 - sm(0, 0.30, u3))
      + 0.22 * sm(0, 0.30, u3) * (1 - sm(0, 0.32, u4))
      + 0.10 * sm(0, 0.35, u4);
    var basePitch = 0.12 * (1 - stageShift) + 0.04 * stageShift + 0.10 * sm(0, 0.28, u3) * (1 - sm(0.85, 1.0, u3)) - 0.08 * k1 - 0.06 * k4;

    var hopK = nowMs < hopUntil ? Math.sin(((hopUntil - nowMs) / 520) * Math.PI) : 0;
    var faceMode = 'sig', ledAlpha = lerp(0.64, 0.42, stageShift);
    if (fVisor > 0.2 || fEars > 0.2 || fAnt > 0.2) { faceMode = 'happy'; ledAlpha = 0.88; }
    if (power > 0.45) { faceMode = 'happy'; ledAlpha = lerp(0.45, 1.0, power); }
    if (nowMs < starUntil) { faceMode = 'star'; ledAlpha = 1.0; }
    var blinkSlot = (nowMs * 0.001) % 4.2;
    var blink = power > 0.8 && nowMs >= starUntil && blinkSlot > 3.98 && blinkSlot < 4.12;

    var wavePh = nowMs * 0.0068;
    var stGL = {
      cx: cx, cy: cy, scale: botScale,
      bx: 0, by: -0.06 * k3 + 0.14 * hopK, bz: -0.06 * k1 - 0.04 * k4,
      rx: basePitch + drag.pitch + hover.y * 0.045,
      ry: baseYaw + drag.yaw + hover.x * 0.065,
      rz: 0.03 * k2 + 0.035 * power * Math.sin(wavePh * 0.5),
      sqX: 1 - 0.045 * k2 + 0.03 * k3, sqY: 1 + 0.045 * k2 - 0.045 * k3,
      eBase: eBase, eVisor: eVisor, eEars: eEars, eAnt: eAnt, eChest: eChest,
      fBase: fBase, fVisor: fVisor, fEars: fEars, fAnt: fAnt, fChest: fChest,
      power: power, dark: dark, shadowK: lerp(0.55, 1.0, stageShift),
      wave: power, wavePh: wavePh, faceMode: faceMode, ledAlpha: ledAlpha, blink: blink,
      heroLabelA: 1 - sm(0.62, 0.80, u0), activeBeat: b, beatU: u,
      activeGap: b === 1 ? eVisor : b === 2 ? eEars : b === 3 ? eAnt : b === 4 ? eChest : 1,
      activeFlash: b === 1 ? fVisor : b === 2 ? fEars : b === 3 ? fAnt : b === 4 ? fChest : 0,
      cardY: 0
    };

    if (heroBox) {
      var hA = 1 - sm(0.70, 0.90, u0), hY = -22 * sm(0.70, 0.92, u0);
      setStyle(heroBox, 'opacity', hA.toFixed(3));
      setStyle(heroBox, 'transform', isMobile ? 'translate3d(0,' + hY.toFixed(1) + 'px,0)' : 'translate3d(0,calc(-50% + ' + hY.toFixed(1) + 'px),0)');
      setStyle(heroBox, 'pointerEvents', hA > 0.4 ? 'auto' : 'none');
    }

    for (var ci = 1; ci <= 4; ci++) {
      var card = cards[ci];
      if (!card) continue;
      var cA = 0, cY = 18;
      if (b === ci) {
        var enter = sm(0.26, 0.40, u), exit = ci < 4 ? sm(0.85, 0.98, u) : 0;
        cA = enter * (1 - exit); cY = (1 - enter) * 18 - exit * 16; stGL.cardY = cY;
      }
      setStyle(card, 'opacity', cA.toFixed(3));
      card.style.setProperty('--cy', cY.toFixed(1) + 'px');
      setStyle(card, 'pointerEvents', cA > 0.55 ? 'auto' : 'none');
    }

    if (b === 2) {
      var numK = clamp((u2 - 0.16) / 0.22, 0, 1);
      countNodes.forEach(function (el) {
        var tgt = parseInt(el.getAttribute('data-target'), 10) || 0;
        var str = String(numK >= 1 ? tgt : Math.max(1, Math.round(tgt * (1 - Math.pow(1 - numK, 2)))));
        if (el.textContent !== str) el.textContent = str;
      });
    } else if (s > starts[2] + lens[2] * 0.4) {
      countNodes.forEach(function (el) {
        var tgt = el.getAttribute('data-target');
        if (el.textContent !== tgt) el.textContent = tgt;
      });
    }

    syncChecklistUI(b, [false, eVisor < 0.05, eEars < 0.05, eAnt < 0.05, eChest < 0.05]);

    var proj = engine.render(stGL);
    drawHUD(proj, stGL);

    return power > 0.02 || nowMs < starUntil || nowMs < hopUntil || drag.active ||
      Math.abs(drag.yaw) > 0.002 || Math.abs(drag.pitch) > 0.002 || Math.abs(targetS - curS) > 0.35;
  }

  var lastTickAt = 0, fbTimer = 0;
  function tick(now) {
    rafId = 0; lastTickAt = performance.now();
    if (pageHidden || !inView) return;
    var dt = lastTs ? Math.min(0.05, (now - lastTs) * 0.001) : 0.016;
    lastTs = now;
    targetS = readTargetScroll();
    curS += (targetS - curS) * (1 - Math.exp(-dt * 18));
    if (Math.abs(targetS - curS) < 0.35) curS = targetS;
    if (!drag.active) {
      var sk = 1 - Math.exp(-dt * 8.5);
      drag.yaw *= (1 - sk); drag.pitch *= (1 - sk);
      if (Math.abs(drag.yaw) < 0.0015) drag.yaw = 0;
      if (Math.abs(drag.pitch) < 0.0015) drag.pitch = 0;
    }
    if (renderAt(curS, now)) rafId = requestAnimationFrame(tick);
    else lastTs = 0;
  }

  function wake() { if (!rafId && !pageHidden && inView) rafId = requestAnimationFrame(tick); }

  measureLayout();

  var qs = location.search;
  var mAt = /[?&]at=(\d+)/.exec(qs), mBeat = /[?&]beat=(\d+)/.exec(qs), mProg = /[?&]p=(\d+):([0-9.]+)/.exec(qs);
  /* 调试参数按"第几拍 + 拍内进度"记，窗口尺寸变了也落在同一位置 */
  var dbgS = null;
  if (mProg) {
    var pi = clamp((parseInt(mProg[1], 10) || 1) - 1, 0, 4), pf = clamp(parseFloat(mProg[2]) || 0, 0, 0.999);
    dbgS = function () { return starts[pi] + lens[pi] * pf; };
  } else if (mAt) {
    var atPx = parseInt(mAt[1], 10) || 0;
    dbgS = function () { return atPx - trackTop; };
  } else if (mBeat) {
    var bi = clamp((parseInt(mBeat[1], 10) || 1) - 1, 0, 4);
    dbgS = function () { return bi === 0 ? 0 : Math.round(starts[bi] + lens[bi] * 0.62); };
  }
  if (dbgS !== null) {
    if (/Headless/i.test(navigator.userAgent)) virtS = dbgS;
    else window.scrollTo(0, Math.round(trackTop + clamp(dbgS(), 0, totalScroll)));
  }

  targetS = curS = readTargetScroll();
  renderAt(curS, performance.now());
  wake();

  window.addEventListener('scroll', function () {
    if (rotHint && window.scrollY > trackTop + 40) rotHint.classList.add('is-hidden');
    wake();
    /* rAF 被节流（后台/省电）时的兜底：直接画到当前滚动位置，内容不会卡在半路 */
    clearTimeout(fbTimer);
    fbTimer = setTimeout(function () {
      if (performance.now() - lastTickAt > 150) { targetS = curS = readTargetScroll(); renderAt(curS, performance.now()); }
    }, 180);
  }, { passive: true });
  window.addEventListener('resize', function () {
    measureLayout(); targetS = curS = readTargetScroll(); renderAt(curS, performance.now()); wake();
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    pageHidden = document.hidden; if (!pageHidden) { lastTs = 0; wake(); }
  });
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (entries) {
      inView = entries.some(function (en) { return en.isIntersecting; });
      if (inView) { lastTs = 0; wake(); }
    }, { threshold: 0.01 }).observe(stage);
  }
})();
