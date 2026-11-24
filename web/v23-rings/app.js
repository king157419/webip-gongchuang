/* v23-rings · 页面主逻辑
 * 原生滚动 + 吸顶表盘舞台：每一拍严格分 动作(40%) → 停住可读(45%) → 过渡(15%)
 * 不拦截任何滚轮/触摸/键盘滚动；支持 ?at=像素 调试定位与 ?flat / reduced-motion 普通分节回退
 */
(function () {
  'use strict';

  var d = document, R = d.documentElement, C = window.CLUB;
  var HALF_PI = Math.PI / 2;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return d.getElementById(id); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function dotDate(s) { return String(s).replace(/-/g, '.'); }
  function ymDate(s) { return String(s).slice(0, 7).replace('-', '.'); }

  if (!C) {
    R.classList.remove('staged');
    return;
  }

  var M = C.meta || {}, NEWS = C.news || [], P = C.people || {}, J = C.join || {};
  var PROGS = C.programs || [];
  var DEPTS = M.departments || [];
  var TOTAL_BEATS = 5;
  var account = String((M.contact && M.contact.wechat) || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '').trim();

  var CAT_COLORS = {
    weld: '#c45525',
    course: '#1e5b88',
    visit: '#2b6e4f',
    contest: '#b57c16',
    talk: '#6b4c3b'
  };
  var CAT_SHORT = {
    weld: '电路焊接',
    course: '昇腾课程',
    visit: '企业参访',
    contest: '创新大赛',
    talk: '系列分享'
  };

  /* ================= 1. 从 window.CLUB 渲染全站内容（严格转义） ================= */
  var isStagedMode = R.classList.contains('staged');
  $('heroKicker').textContent = (M.founded || 2021) + ' 成立 · 通信学院团委指导';
  $('topNewsBtn').textContent = NEWS.length + ' 篇报道';
  var cueEl = $('scrollCue');
  if (cueEl) cueEl.textContent = isStagedMode ? ('下滑转动年轮 · ' + NEWS.length + ' 篇真实记录') : (NEWS.length + ' 篇学院官网报道记录');

  function beatHead(num, title, sub) {
    return '<header class="bh">' +
      '<p class="bh-idx"><span>' + pad2(num) + '</span> / ' + pad2(TOTAL_BEATS) + '</p>' +
      '<h2 id="h' + num + '">' + esc(title) + '</h2>' +
      (sub ? '<p class="bh-sub">' + esc(sub) + '</p>' : '') +
      '</header>';
  }

  function firstSentence(s) {
    return String(s || '').split(/[；。]/)[0].trim();
  }

  // 统计每类活动在 16 篇报道中的次数
  var catCounts = {};
  NEWS.forEach(function (n) { catCounts[n.cat] = (catCounts[n.cat] || 0) + 1; });

  // ② 平时做什么（5 种活动，每种一句话 + 颜色弧段图例）
  var progHTML = PROGS.map(function (p) {
    var col = CAT_COLORS[p.id] || '#181614';
    var cnt = catCounts[p.id] || 0;
    return '<li class="prog-item" tabindex="0" data-cat="' + esc(p.id) + '">' +
      '<span class="prog-arc" style="--c:' + esc(col) + '" aria-hidden="true"></span>' +
      '<div class="prog-body">' +
        '<div class="prog-top"><h3>' + esc(p.name) + '</h3><span class="prog-cnt">' + cnt + ' 篇报道</span></div>' +
        '<p>' + esc(firstSentence(p.desc)) + ' · <span class="prog-loc">' + esc(p.where) + '</span></p>' +
      '</div>' +
    '</li>';
  }).join('');

  // ③ 做过的事：2022 → 2026 每年挑一条最有分量的真实报道
  var ANNUAL_PICKS = [
    { year: 2022, src: '6612',  big: '“百年上大”焊接课', note: '翔英大楼 T404 焊主题电路板，评出三组优秀作品' },
    { year: 2023, src: '40315', big: '赴华为全联接大会', note: '吴静老师带队，联合宏嘉书院参加“数智之星”活动' },
    { year: 2024, src: '43095', big: '近 200 人论文分享会', note: '三位学长讲科研论文；同年百余人赴全联接大会' },
    { year: 2025, src: '45485', big: '近百人进鸿蒙学堂', note: '参加生态实训；同年协办焊接专项赛报名百余人' },
    { year: 2026, src: '46475', big: '40 余人昇腾大模型课', note: '华为工程师授课，完成 Transformer 与 BERT 微调' }
  ];

  var pickIds = ANNUAL_PICKS.map(function (p) { return p.src; });
  var featHTML = ANNUAL_PICKS.map(function (pk) {
    var item = null;
    for (var i = 0; i < NEWS.length; i++) {
      if (String(NEWS[i].source).indexOf(pk.src) > -1) { item = NEWS[i]; break; }
    }
    if (!item) return '';
    return '<li class="feat-item" data-year="' + pk.year + '">' +
      '<a href="' + esc(item.source) + '" target="_blank" rel="noopener" title="' + esc(item.title) + '">' +
        '<span class="feat-yr">' + pk.year + '</span>' +
        '<div class="feat-main">' +
          '<div class="feat-line"><strong class="feat-big">' + esc(pk.big) + '</strong><span class="feat-date">' + ymDate(item.date) + '</span></div>' +
          '<p class="feat-note">' + esc(pk.note) + '</p>' +
        '</div>' +
        '<span class="feat-arr" aria-hidden="true">↗</span>' +
      '</a>' +
    '</li>';
  }).join('');

  // ④ 谁在带大家：社长任捷 + 两位指导老师 + 四个部门
  var lead = (P.leaders || [])[0];
  var awardsHTML = lead && lead.awards ? lead.awards.map(function (aw) {
    var shortAw = String(aw).split('、')[0];
    return '<li>' + esc(shortAw) + '</li>';
  }).join('') : '';

  var leadHTML = lead ? (
    '<div class="leader-card">' +
      (lead.photo ? '<div class="leader-photo"><img src="../shared/img/' + esc(lead.photo) + '" alt="社长' + esc(lead.name) + '照片" width="228" height="671" loading="lazy" draggable="false"></div>' : '') +
      '<div class="leader-info">' +
        '<div class="leader-head"><span class="role-tag">' + esc(lead.role) + '</span><h3>' + esc(lead.name) + '</h3></div>' +
        '<p class="leader-desc">' + esc(String(lead.desc).split('。')[0]) + '。</p>' +
        (awardsHTML ? '<ul class="leader-awards">' + awardsHTML + '</ul>' : '') +
      '</div>' +
    '</div>'
  ) : '';

  var teachHTML = (P.teachers || []).map(function (t) {
    var parts = String(t.role || '').split('·');
    return '<li><strong>' + esc(t.name) + '</strong><span>' + esc((parts[1] || parts[0] || '').trim()) + '</span></li>';
  }).join('');

  var deptHTML = DEPTS.map(function (dep, idx) {
    return '<li tabindex="0" data-dept="' + idx + '"><b>' + esc(dep.name) + '</b><span>' + esc(dep.desc) + '</span></li>';
  }).join('');

  // ⑤ 怎么加入：三步走 + 复制公众号 + 小智挥手
  var stepsHTML = (J.steps || []).map(function (s, idx) {
    return '<li><span class="step-n">0' + (idx + 1) + '</span><div><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></div></li>';
  }).join('');

  var restBeatsHTML =
    '<section class="beat b-do" id="b2" data-i="1" aria-labelledby="h2"><div class="in"><div class="content-col">' +
      beatHead(2, '平时做什么', isStagedMode ? '五色弧段对应五类日常，点按可单独点亮。' : '五类日常活动，面向全校零基础开放。') +
      '<ul class="prog-list">' + progHTML + '</ul>' +
    '</div></div></section>' +

    '<section class="beat b-did" id="b3" data-i="2" aria-labelledby="h3"><div class="in"><div class="content-col">' +
      beatHead(3, '做过的事', isStagedMode ? '2022—2026 每年代表作，悬停让红针转回当年。' : '2022—2026 每年挑一件代表报道。') +
      '<ol class="feat-list">' + featHTML + '</ol>' +
      '<div class="did-foot">' +
        '<button class="btn-all" type="button" id="openNews">展开全部 ' + NEWS.length + ' 篇官网报道 <span aria-hidden="true">→</span></button>' +
      '</div>' +
    '</div></div></section>' +

    '<section class="beat b-who" id="b4" data-i="3" aria-labelledby="h4"><div class="in"><div class="content-col">' +
      beatHead(4, '谁在带大家', '学长一线带实操，学院老师全程指导。') +
      leadHTML +
      '<div class="who-grid">' +
        '<div class="who-block"><h3 class="sub-lab">指导老师</h3><ul class="teach-list">' + teachHTML + '</ul></div>' +
        '<div class="who-block"><h3 class="sub-lab">' + DEPTS.length + ' 个部门' + (isStagedMode ? '（点按看象限）' : '') + '</h3><ul class="dept-list">' + deptHTML + '</ul></div>' +
      '</div>' +
    '</div></div></section>' +

    '<section class="beat b-join" id="b5" data-i="4" aria-labelledby="h5"><div class="in"><div class="content-col">' +
      beatHead(5, '怎么加入', '不设笔试与专业门槛，下一段留给你。') +
      '<ol class="step-list">' + stepsHTML + '</ol>' +
      '<div class="join-cta-box">' +
        '<div class="copy-wrap">' +
          '<button class="btn-copy" type="button" id="copyBtn">复制公众号名「' + esc(account) + '」</button>' +
          '<p class="copy-msg" id="copyMsg" role="status" aria-live="polite">活动预告与招新均发布在该公众号</p>' +
        '</div>' +
        '<div class="zhi-wave" aria-hidden="true" title="社团吉祥物小智">' +
          '<img src="../v11-kinetic/zhi-toy.webp" alt="" width="360" height="90" loading="lazy" draggable="false">' +
        '</div>' +
      '</div>' +
    '</div></div></section>';

  $('beats').insertAdjacentHTML('beforeend', restBeatsHTML);

  // 页脚渲染：4 条 FAQ + 学院标志 + 管理后台入口
  var faqHTML = (J.faq || []).map(function (f) {
    return '<div class="qa"><dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd></div>';
  }).join('');

  $('foot').innerHTML =
    '<div class="foot-in">' +
      '<div class="foot-head"><h2>常见问题</h2><span>公开资料整理 · 零基础面向全校</span></div>' +
      '<dl class="faq">' + faqHTML + '</dl>' +
      '<div class="foot-bot">' +
        '<img class="wm" src="../shared/img/brand/scie-wordmark.png" alt="上海大学通信与信息工程学院" width="3526" height="738" loading="lazy">' +
        '<p>' + esc(M.name) + ' · ' + esc(M.founded) + ' 年成立 · 挂靠' + esc(M.host) + '<br>' +
          esc(M.location) + ' · 全部事实源自学院官网 ' + NEWS.length + ' 篇公开报道</p>' +
        '<a class="admin-link" href="/admin/">管理后台</a>' +
      '</div>' +
    '</div>';

  // 全部 16 篇报道抽屉列表渲染
  var npTitle = $('npH');
  if (npTitle) npTitle.textContent = '全部 ' + NEWS.length + ' 篇报道';
  $('newsList').innerHTML = NEWS.map(function (n) {
    var col = CAT_COLORS[n.cat] || '#181614';
    var cname = CAT_SHORT[n.cat] || '动态';
    return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
      '<div class="nl-meta"><span class="nl-date">' + dotDate(n.date) + '</span>' +
      '<span class="nl-cat"><i style="background:' + esc(col) + '"></i>' + esc(cname) + '</span></div>' +
      '<h3 class="nl-title">' + esc(n.title) + '</h3>' +
      '<p class="nl-sum">' + esc(n.summary) + '</p>' +
    '</a></li>';
  }).join('');

  /* ================= 2. 交互事件：复制公众号、报道抽屉 ================= */
  $('copyBtn').addEventListener('click', function () {
    var ok = false, ta = d.createElement('textarea');
    ta.value = account;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none;';
    d.body.appendChild(ta);
    ta.focus();
    ta.select();
    try {
      ta.setSelectionRange(0, account.length);
      ok = d.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    d.body.removeChild(ta);
    var msg = $('copyMsg');
    msg.textContent = ok
      ? '已复制「' + account + '」，打开微信粘贴搜索即可关注。'
      : '微信里搜索：' + account;
    msg.classList.add('copied');
  });

  var panel = $('newsPanel'), lastFocus = null;
  function openPanel() {
    lastFocus = d.activeElement;
    panel.hidden = false;
    R.classList.add('panel-open');
    var closeBtn = panel.querySelector('.panel-x');
    if (closeBtn) closeBtn.focus();
  }
  function closePanel() {
    panel.hidden = true;
    R.classList.remove('panel-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('openNews').addEventListener('click', openPanel);
  $('topNewsBtn').addEventListener('click', openPanel);
  panel.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closePanel();
  });
  d.addEventListener('keydown', function (e) {
    if (panel.hidden) return;
    if (e.key === 'Escape') closePanel();
    if (e.key === 'Tab') {
      var focusables = panel.querySelectorAll('a,button');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && d.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && d.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  /* ================= 3. 吸顶舞台与滑动驱动表盘 ================= */
  var track = $('track'), stage = $('stage'), canvas = $('dial'), bezelBox = $('yearBezel');
  var beats = [].slice.call(d.querySelectorAll('.beat'));
  var railTrack = $('railTrack'), railFill = $('railFill'), railCur = $('railCur');
  var roYear = $('roYear'), roDeg = $('roDeg'), roLabel = $('roLabel');
  var arcTip = $('arcTip'), tipDot = $('tipDot'), tipDate = $('tipDate'), tipCat = $('tipCat'), tipTitle = $('tipTitle'), tipLink = $('tipLink');

  var params = new URLSearchParams(location.search);
  var atParam = params.has('at') ? parseInt(params.get('at'), 10) : null;

  // 每一拍严格分段：a = 动作段(40%), r = 停住可读段(45%), x = 过渡段(15%)
  // 首屏一进来即处于可读段(a=0)，保证 1 秒内看清社团名、一句话说明与怎么加入入口
  var SEG = [
    { a: 0.00, r: 0.82, x: 0.18, L: 0.95, name: '2021 · 成立' },
    { a: 0.40, r: 0.45, x: 0.15, L: 1.85, name: '五类 · 日常' },
    { a: 0.40, r: 0.45, x: 0.15, L: 2.15, name: '22–26 · 纪事' },
    { a: 0.40, r: 0.45, x: 0.15, L: 1.85, name: '团队 · 带队' },
    { a: 0.40, r: 0.60, x: 0.00, L: 1.65, name: '现在 · 加入' }
  ];

  var railTicks = [];
  SEG.forEach(function (seg, idx) {
    var btn = d.createElement('button');
    btn.type = 'button';
    btn.className = 'rail-tick';
    btn.setAttribute('aria-label', '第 ' + (idx + 1) + ' 拍：' + seg.name);
    btn.innerHTML = '<span class="rt-dot"></span><span class="rt-txt">' + esc(seg.name) + '</span>';
    btn.addEventListener('click', function () { jumpToBeat(idx, null, 'smooth'); });
    railTrack.appendChild(btn);
    railTicks.push(btn);
  });

  // 若非舞台模式（prefers-reduced-motion 或 ?flat），直接结束舞台初始化，保持普通分节页面
  if (!R.classList.contains('staged') || typeof window.createAnnualDial !== 'function') {
    R.classList.remove('staged');
    R.classList.add('intro-done');
    return;
  }

  var hoverState = {
    cat: null,
    year: null,
    dept: -1,
    arc: null,
    pinnedTouch: false
  };

  var dial = window.createAnnualDial(canvas, bezelBox, C, {
    pickIds: pickIds,
    onBezelJump: function (beatIdx, yr) {
      if (yr && yr >= 2022 && yr <= 2026 && beatIdx === 2) {
        hoverState.year = yr;
      } else {
        hoverState.year = null;
      }
      jumpToBeat(beatIdx, yr, 'smooth');
    }
  });

  if (!dial) {
    R.classList.remove('staged');
    R.classList.add('intro-done');
    return;
  }

  R.classList.add('stage-ok');
  setTimeout(function () { R.classList.add('intro-done'); }, 450);

  // 悬停右侧条目联动左侧表盘
  d.querySelectorAll('.prog-item').forEach(function (el) {
    var cat = el.getAttribute('data-cat');
    function onEnter() { hoverState.cat = cat; el.classList.add('is-on'); requestTick(); }
    function onLeave() { if (hoverState.cat === cat) hoverState.cat = null; el.classList.remove('is-on'); requestTick(); }
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focus', onEnter);
    el.addEventListener('blur', onLeave);
    el.addEventListener('click', function () {
      hoverState.cat = (hoverState.cat === cat) ? null : cat;
      d.querySelectorAll('.prog-item').forEach(function (n) { n.classList.toggle('is-on', n.getAttribute('data-cat') === hoverState.cat); });
      requestTick();
    });
  });

  var featItems = [].slice.call(d.querySelectorAll('.feat-item'));
  featItems.forEach(function (el) {
    var yr = parseInt(el.getAttribute('data-year'), 10);
    function onEnter() { hoverState.year = yr; requestTick(); }
    function onLeave() { if (hoverState.year === yr) hoverState.year = null; requestTick(); }
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focusin', onEnter);
    el.addEventListener('focusout', onLeave);
  });

  var deptItems = [].slice.call(d.querySelectorAll('.dept-list li'));
  deptItems.forEach(function (el) {
    var idx = parseInt(el.getAttribute('data-dept'), 10);
    function syncDept() {
      deptItems.forEach(function (n, k) { n.classList.toggle('is-on', k === hoverState.dept); });
    }
    function onEnter() { hoverState.dept = idx; syncDept(); requestTick(); }
    function onLeave() { if (hoverState.dept === idx) hoverState.dept = -1; syncDept(); requestTick(); }
    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);
    el.addEventListener('focus', onEnter);
    el.addEventListener('blur', onLeave);
    el.addEventListener('click', function () {
      hoverState.dept = (hoverState.dept === idx) ? -1 : idx;
      syncDept();
      requestTick();
    });
  });

  /* ================= 4. 轨道测量与滚动映射 ================= */
  var geo = { W: 1, H: 1, mobile: false, top: 0, total: 1, starts: [], lens: [] };
  var mainEl = $('main');

  function measure() {
    geo.W = stage.clientWidth || window.innerWidth;
    geo.H = stage.clientHeight || window.innerHeight;
    geo.mobile = geo.W <= 860;
    R.style.setProperty('--vh', (geo.H * 0.01).toFixed(2) + 'px');

    var s = 0;
    geo.starts = [];
    geo.lens = [];
    SEG.forEach(function (g) {
      geo.starts.push(s);
      var len = g.L * geo.H;
      geo.lens.push(len);
      s += len;
    });
    geo.total = Math.max(1, s);
    track.style.height = Math.round(geo.H + s) + 'px';
    geo.top = track.getBoundingClientRect().top + (window.pageYOffset || 0);

    railTicks.forEach(function (btn, i) {
      var anchor = (geo.starts[i] + SEG[i].a * geo.lens[i]) / geo.total;
      btn.style.setProperty('--pos', clamp(anchor, 0, 1).toFixed(4));
    });

    dial.resize(geo.W, geo.H, geo.mobile);
  }

  function jumpY(i, yr) {
    var g = SEG[i];
    if (i === 0) return geo.top;
    if (i === 2 && yr && yr >= 2022 && yr <= 2026) {
      return geo.top + geo.starts[2] + (g.a + 0.06) * geo.lens[2];
    }
    return geo.top + geo.starts[i] + (g.a + 0.08) * geo.lens[i];
  }

  function jumpToBeat(i, yr, behavior) {
    atParam = null;
    if (mainEl) mainEl.style.marginTop = '';
    i = clamp(i, 0, SEG.length - 1);
    window.scrollTo({ top: Math.round(jumpY(i, yr)), behavior: behavior || 'smooth' });
    requestTick();
  }

  d.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (!go || !R.classList.contains('staged')) return;
    e.preventDefault();
    jumpToBeat(parseInt(go.getAttribute('data-go'), 10) || 0, null, 'smooth');
  });

  d.addEventListener('focusin', function (e) {
    if (!R.classList.contains('staged')) return;
    var b = e.target.closest && e.target.closest('.beat');
    if (!b) return;
    var idx = parseInt(b.getAttribute('data-i'), 10);
    if (!isNaN(idx) && idx !== activeBeatIdx) {
      jumpToBeat(idx, null, 'auto');
    }
  });

  var pick22 = dial.findPickArc(2022);
  var pick23 = dial.findPickArc(2023);
  var pick24 = dial.findPickArc(2024);
  var pick25 = dial.findPickArc(2025);
  var pick26 = dial.findPickArc(2026);
  var leadArc26 = null;
  for (var ai = 0; ai < dial.arcs.length; ai++) {
    if (dial.arcs[ai].date === '2026-10-26') { leadArc26 = dial.arcs[ai]; break; }
  }
  if (!leadArc26) leadArc26 = pick26;

  function sampleScroll(scrollY, idleTheta) {
    var p = clamp(scrollY - geo.top, 0, geo.total);
    var globalF = p / geo.total;

    var i = 0;
    while (i < SEG.length - 1 && p >= geo.starts[i + 1]) i++;
    var g = SEG[i];
    var u = clamp((p - geo.starts[i]) / geo.lens[i], 0, 1);

    // 可读段 [g.a, g.a + g.r] 内严格 reveal=1, shiftY=0（完全静止、完整显示）
    var reveal = 1, shiftY = 0;
    if (g.a > 0 && u < g.a) {
      var eStart = i === 2 ? 0.06 : g.a * 0.48;
      var enterT = clamp((u - eStart) / (g.a - eStart), 0, 1);
      reveal = easeOutCubic(enterT);
      shiftY = (1 - reveal) * 18;
    } else if (g.x > 0 && u > g.a + g.r) {
      var exitT = clamp((u - g.a - g.r) / g.x, 0, 1);
      reveal = 1 - smoothstep(exitT);
      shiftY = -smoothstep(exitT) * 14;
    }

    var act = g.a > 0 ? smoothstep(clamp(u / g.a, 0, 1)) : 1;
    var out = g.x > 0 && u > g.a + g.r ? smoothstep(clamp((u - g.a - g.r) / g.x, 0, 1)) : 0;

    var readAngle = geo.mobile ? -HALF_PI + 0.48 : -0.28;
    var rot = 0, ptrRing = 0, ptrAngle = -HALF_PI;
    var catBlend = 0, sweepYear = 2021, quadMix = 0, futureMix = 0, heroFade = 0;
    var label = '第 1 圈 · 社团成立', dispYear = '2021';

    if (i === 0) {
      heroFade = 1 - out;
      rot = idleTheta * (1 - out) + out * 0.65;
      ptrRing = lerp(0, 0.8, out);
      ptrAngle = lerp(-HALF_PI, readAngle, out);
      sweepYear = 2021;
      dispYear = '2021';
      label = '第 1 圈 · 社团成立';
    } else if (i === 1) {
      heroFade = 0;
      catBlend = out > 0 ? (1 - out) : act;
      rot = lerp(0.65, 2.15, act) + out * 0.45;
      ptrRing = lerp(0.8, 2.6, act) - out * 1.4;
      ptrAngle = readAngle;
      sweepYear = Math.round(lerp(2021, 2024, act));
      if (hoverState.cat) {
        var cArc = dial.findCatArc(hoverState.cat);
        if (cArc) {
          ptrRing = cArc.ring;
          rot = readAngle - cArc.mid;
          sweepYear = cArc.year;
        }
        dispYear = CAT_SHORT[hoverState.cat] || '日常';
        label = (catCounts[hoverState.cat] || 0) + ' 篇相关官网报道';
      } else {
        dispYear = '五类';
        label = '5 种日常活动 · 16 段弧线图例';
      }
    } else if (i === 2) {
      heroFade = 0;
      var yrProg = clamp(u / g.a, 0, 1);
      var yrFloat = lerp(2022, 2026, smoothstep(yrProg));
      sweepYear = yrFloat;
      ptrRing = yrFloat - 2021;

      var anchors = [
        readAngle - pick22.mid,
        readAngle - pick23.mid + Math.PI * 0.5,
        readAngle - pick24.mid + Math.PI,
        readAngle - pick25.mid + Math.PI * 1.5,
        readAngle - pick26.mid + Math.PI * 2.0
      ];
      var segPos = clamp(yrFloat - 2022, 0, 3.9999);
      var sIdx = Math.floor(segPos);
      var sFrac = smoothstep(segPos - sIdx);
      rot = lerp(anchors[sIdx], anchors[sIdx + 1], sFrac) + out * 0.4;
      ptrAngle = readAngle;

      if (hoverState.year && hoverState.year >= 2022 && hoverState.year <= 2026 && u >= g.a * 0.85) {
        var hArc = dial.findPickArc(hoverState.year);
        ptrRing = hoverState.year - 2021;
        rot = readAngle - hArc.mid + Math.PI * 2.0;
        dispYear = String(hoverState.year);
        label = '第 ' + (hoverState.year - 2020) + ' 圈 · 代表报道高亮';
      } else {
        var curYr = Math.round(yrFloat);
        dispYear = String(curYr);
        label = u < g.a ? ('红针扫掠 ' + curYr + ' 圈年轮') : '2022—2026 · 每年代表报道';
      }
    } else if (i === 3) {
      heroFade = 0;
      var baseRot3 = readAngle - pick26.mid + Math.PI * 2.4;
      var targetRot3 = readAngle - leadArc26.mid + Math.PI * 2.0;
      rot = lerp(baseRot3, targetRot3, act) + out * 0.35;
      ptrRing = 5;
      ptrAngle = readAngle;
      quadMix = out > 0 ? (1 - out) : act;
      sweepYear = 2026;
      dispYear = '2026';
      if (hoverState.dept >= 0 && DEPTS[hoverState.dept]) {
        ptrAngle = -HALF_PI + hoverState.dept * HALF_PI + Math.PI * 0.25;
        label = DEPTS[hoverState.dept].name + ' · ' + DEPTS[hoverState.dept].desc;
      } else {
        label = '社长与指导老师 · 4 个部门协作';
      }
    } else {
      heroFade = 0;
      var baseRot4 = readAngle - leadArc26.mid + Math.PI * 2.35;
      rot = lerp(baseRot4, baseRot4 + 0.85, act);
      ptrRing = lerp(5, 6, act);
      ptrAngle = lerp(readAngle, -0.68, act);
      futureMix = act;
      sweepYear = 2026;
      dispYear = act > 0.65 ? '现在' : '2026';
      label = act > 0.5 ? '圈外留白 · 下一段，留给你' : '向外展开新的一圈';
    }

    return {
      beatIdx: i, u: u, reveal: reveal, shiftY: shiftY, globalProgress: globalF,
      rot: rot, ptrRing: ptrRing, ptrAngle: ptrAngle, catBlend: catBlend,
      sweepYear: sweepYear, quadrantMix: quadMix, futureMix: futureMix,
      heroCenterFade: heroFade, dispYear: dispYear, label: label
    };
  }

  /* ================= 5. 渲染循环与微缓动跟手 ================= */
  var cur = null, activeBeatIdx = -1, rafId = 0, tmoId = 0, lastTs = 0, idleTheta = 0, inViewport = true;
  var drag = { on: false, startAng: 0, baseRot: 0, userRot: 0, moved: false };

  // ?at=像素：不滚动文档直接把舞台画成对应像素处的画面，兼顾无头浏览器截图与真实浏览
  function curY() {
    var wy = window.pageYOffset || R.scrollTop || 0;
    if (atParam !== null && !isNaN(atParam) && wy < 2) {
      if (mainEl) {
        if (atParam > geo.total + 40) {
          var maxOff = Math.max(0, (d.body.scrollHeight || 9000) - geo.H);
          mainEl.style.marginTop = -Math.round(Math.min(atParam, maxOff)) + 'px';
        } else {
          mainEl.style.marginTop = '';
        }
      }
      return Math.max(0, atParam);
    }
    if (wy >= 2 && atParam !== null) {
      atParam = null;
      if (mainEl) mainEl.style.marginTop = '';
    }
    return wy;
  }

  function updateDOM(tgt) {
    if (tgt.beatIdx !== activeBeatIdx) {
      beats.forEach(function (b, k) {
        b.classList.toggle('on', k === tgt.beatIdx);
      });
      activeBeatIdx = tgt.beatIdx;
    }

    var activeBeat = beats[tgt.beatIdx];
    if (activeBeat) {
      activeBeat.style.opacity = tgt.reveal.toFixed(3);
      var inner = activeBeat.querySelector('.in');
      if (inner) {
        inner.style.transform = 'translate3d(0,' + tgt.shiftY.toFixed(1) + 'px,0)';
      }
      activeBeat.style.pointerEvents = tgt.reveal > 0.45 ? 'auto' : 'none';
    }

    if (tgt.beatIdx === 2) {
      var hlYr = hoverState.year || (tgt.u < SEG[2].a ? Math.round(tgt.sweepYear) : 0);
      featItems.forEach(function (el) {
        el.classList.toggle('is-on', parseInt(el.getAttribute('data-year'), 10) === hlYr);
      });
    }

    railCur.textContent = pad2(tgt.beatIdx + 1);
    railFill.style.setProperty('--f', tgt.globalProgress.toFixed(4));
    railTicks.forEach(function (btn, k) {
      var isCur = k === tgt.beatIdx;
      btn.classList.toggle('cur', isCur);
      btn.classList.toggle('done', k < tgt.beatIdx);
      if (isCur) btn.setAttribute('aria-current', 'step');
      else btn.removeAttribute('aria-current');
    });

    roYear.textContent = tgt.dispYear;
    var degVal = Math.round((((cur ? cur.rot : tgt.rot) * 180 / Math.PI) % 360 + 360) % 360);
    roDeg.textContent = (degVal < 10 ? '00' : degVal < 100 ? '0' : '') + degVal + '°';
    roLabel.textContent = tgt.label;
  }

  function stepFrame(ts) {
    rafId = 0;
    clearTimeout(tmoId);
    if (!inViewport || d.hidden) return;

    var raw = lastTs ? (ts - lastTs) / 1000 : 0.016;
    var lag = raw > 0.12 || raw < 0;
    var dt = raw <= 0 ? 0.016 : Math.min(0.05, raw);
    lastTs = ts;

    var sy = curY();
    var onHeroIdle = (sy - geo.top) < geo.lens[0] * 0.65 && !drag.on && !hoverState.arc;
    if (onHeroIdle && atParam === null) {
      idleTheta = (idleTheta + dt * 0.026) % (Math.PI * 2);
    }

    var tgt = sampleScroll(sy, idleTheta);

    var instant = !cur || lag || atParam !== null;
    if (instant) {
      cur = {
        rot: tgt.rot, ptrRing: tgt.ptrRing, ptrAngle: tgt.ptrAngle, catBlend: tgt.catBlend,
        sweepYear: tgt.sweepYear, quadrantMix: tgt.quadrantMix, futureMix: tgt.futureMix,
        heroCenterFade: tgt.heroCenterFade, globalProgress: tgt.globalProgress
      };
    } else {
      var k = clamp(1 - Math.exp(-dt * 15), 0, 1);
      cur.rot = lerp(cur.rot, tgt.rot, k);
      cur.ptrRing = lerp(cur.ptrRing, tgt.ptrRing, k);
      cur.ptrAngle = lerp(cur.ptrAngle, tgt.ptrAngle, k);
      cur.catBlend = lerp(cur.catBlend, tgt.catBlend, k);
      cur.sweepYear = lerp(cur.sweepYear, tgt.sweepYear, k);
      cur.quadrantMix = lerp(cur.quadrantMix, tgt.quadrantMix, k);
      cur.futureMix = lerp(cur.futureMix, tgt.futureMix, k);
      cur.heroCenterFade = lerp(cur.heroCenterFade, tgt.heroCenterFade, k);
      cur.globalProgress = lerp(cur.globalProgress, tgt.globalProgress, k);
    }

    if (!drag.on && Math.abs(drag.userRot) > 0.0005) {
      drag.userRot *= Math.pow(0.18, dt);
      if (Math.abs(drag.userRot) <= 0.0005) drag.userRot = 0;
    }

    dial.setState({
      mode: tgt.beatIdx, rot: cur.rot, userRot: drag.userRot, ptrRing: cur.ptrRing, ptrAngle: cur.ptrAngle,
      catBlend: cur.catBlend, sweepYear: cur.sweepYear, quadrantMix: cur.quadrantMix, futureMix: cur.futureMix,
      heroCenterFade: cur.heroCenterFade, globalProgress: cur.globalProgress,
      activeCat: hoverState.cat, focusYear: hoverState.year, activeDept: hoverState.dept, hoveredArc: hoverState.arc
    }, dt, instant || Math.abs(cur.rot - tgt.rot) < 0.0008);

    dial.render();
    updateDOM(tgt);

    var diff = Math.abs(cur.rot - tgt.rot) +
               Math.abs(cur.ptrRing - tgt.ptrRing) +
               Math.abs(cur.heroCenterFade - tgt.heroCenterFade) +
               Math.abs(cur.futureMix - tgt.futureMix) +
               Math.abs(drag.userRot);

    if (onHeroIdle || diff > 0.0012 || dial.hasActiveSparks() || drag.on) {
      requestTick();
    } else {
      lastTs = 0;
    }
  }

  function requestTick() {
    if (!rafId && inViewport && !d.hidden) {
      rafId = requestAnimationFrame(stepFrame);
      clearTimeout(tmoId);
      tmoId = setTimeout(function () {
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = 0;
          stepFrame(performance.now());
        }
      }, 100);
    }
  }

  /* ================= 6. 鼠标悬停报道弧段提示 + 彩蛋手拨表盘 ================= */
  function showArcTip(hit) {
    var arc = hit.arc;
    hoverState.arc = arc;
    tipDot.style.background = arc.isFounded ? '#d63624' : (arc.color || '#181614');
    tipDate.textContent = arc.isFounded ? (arc.year + ' · 成立') : dotDate(arc.date);
    tipCat.textContent = arc.isFounded ? '起点' : (arc.catName || '社团报道');
    tipTitle.textContent = arc.title;
    if (arc.source) {
      tipLink.href = arc.source;
      tipLink.hidden = false;
    } else {
      tipLink.hidden = true;
    }
    arcTip.hidden = false;

    if (!geo.mobile) {
      var tx = clamp(hit.pointerX + 18, 16, geo.W - 336);
      var ty = clamp(hit.pointerY - 24, 62, geo.H - 138);
      arcTip.style.transform = 'translate3d(' + Math.round(tx) + 'px,' + Math.round(ty) + 'px,0)';
    } else {
      arcTip.style.transform = 'none';
    }
    stage.classList.add('arc-hover');
    requestTick();
  }

  function hideArcTip() {
    if (!hoverState.arc) return;
    hoverState.arc = null;
    hoverState.pinnedTouch = false;
    arcTip.hidden = true;
    stage.classList.remove('arc-hover');
    requestTick();
  }

  function isInteractiveTarget(t) {
    return !!(t && t.closest && t.closest('a, button, .prog-item, .feat-item, .dept-list li, .arc-tip, .rail, .year-bezel, .hero-card'));
  }

  stage.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    if (drag.on) {
      var rect = canvas.getBoundingClientRect();
      var ang = Math.atan2((e.clientY - rect.top) - dial.state.cy, (e.clientX - rect.left) - dial.state.cx);
      var delta = ang - drag.startAng;
      if (Math.abs(delta) > 0.02) drag.moved = true;
      drag.userRot = drag.baseRot + delta;
      requestTick();
      return;
    }
    if (isInteractiveTarget(e.target)) {
      if (!e.target.closest('.arc-tip')) hideArcTip();
      return;
    }
    var hit = dial.hitTest(e.clientX, e.clientY);
    if (hit) showArcTip(hit);
    else hideArcTip();
  });

  stage.addEventListener('pointerleave', function () {
    if (!hoverState.pinnedTouch) hideArcTip();
    drag.on = false;
  });

  // 鼠标按住表盘空白处可轻微拨动年轮（不拦截滚轮与手机触摸滑动）
  stage.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') {
      if (e.target.closest('.arc-tip')) return;
      if (!isInteractiveTarget(e.target)) {
        var tHit = dial.hitTest(e.clientX, e.clientY);
        if (tHit) {
          hoverState.pinnedTouch = true;
          showArcTip(tHit);
        } else {
          hideArcTip();
        }
      }
      return;
    }
    if (e.button !== 0 || isInteractiveTarget(e.target)) return;
    if (!dial.isInsideDial(e.clientX, e.clientY)) return;
    var rect = canvas.getBoundingClientRect();
    drag.on = true;
    drag.moved = false;
    drag.startAng = Math.atan2((e.clientY - rect.top) - dial.state.cy, (e.clientX - rect.left) - dial.state.cx);
    drag.baseRot = drag.userRot;
  });

  window.addEventListener('pointerup', function (e) {
    if (e.pointerType !== 'touch' && drag.on) {
      var wasMoved = drag.moved;
      drag.on = false;
      if (!wasMoved && !isInteractiveTarget(e.target)) {
        var hit = dial.hitTest(e.clientX, e.clientY);
        if (hit && hit.arc && hit.arc.source) {
          window.open(hit.arc.source, '_blank', 'noopener');
        }
      }
      requestTick();
    }
  });

  /* ================= 7. 视口可见性与窗口尺寸监听 ================= */
  window.addEventListener('scroll', function () {
    if (hoverState.pinnedTouch) hideArcTip();
    requestTick();
  }, { passive: true });

  window.addEventListener('resize', function () {
    measure();
    cur = null;
    lastTs = 0;
    stepFrame(performance.now());
  });

  d.addEventListener('visibilitychange', function () {
    if (!d.hidden) { lastTs = 0; requestTick(); }
  });

  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      inViewport = entries[0] ? entries[0].isIntersecting : true;
      if (inViewport) { lastTs = 0; requestTick(); }
    }, { threshold: 0.01 });
    io.observe(track);
  }

  var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq && mq.addEventListener) {
    mq.addEventListener('change', function () {
      if (mq.matches) {
        cancelAnimationFrame(rafId);
        clearTimeout(tmoId);
        track.style.height = '';
        if (mainEl) mainEl.style.marginTop = '';
        beats.forEach(function (b) {
          b.style.opacity = '';
          b.style.pointerEvents = '';
          var inner = b.querySelector('.in');
          if (inner) inner.style.transform = '';
        });
        R.classList.remove('staged');
      }
    });
  }

  /* ================= 8. 初次测量、?at=像素 调试定位与首帧同步绘制 ================= */
  measure();
  stepFrame(performance.now());
  if (atParam !== null && !isNaN(atParam)) {
    setTimeout(function () {
      measure();
      cur = null;
      lastTs = 0;
      stepFrame(performance.now());
    }, 120);
  }
})();
