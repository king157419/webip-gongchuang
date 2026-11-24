/* v20-desk · 社团活动室工作台主逻辑
 * 原生滚动驱动吸顶舞台：镜头在俯拍工作台上平移推近，走到哪个物件就打开哪个，往回滑原路合上。
 * 每一拍严格遵循：动作（40%）→ 停住可读（45%）→ 过渡（15%）；不拦截任何滚轮/触摸/键盘事件。
 */
(function (w, d) {
  'use strict';

  var R = d.documentElement;
  var C = w.CLUB;

  function $(id) { return d.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function easeOutCubic(t) { var u = 1 - clamp(t, 0, 1); return 1 - u * u * u; }
  function easeInOutCubic(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function dotDate(s) { return String(s || '').replace(/-/g, '.'); }
  function ymDate(s) { return String(s || '').slice(0, 7).replace('-', '.'); }
  function shortClause(s) {
    return String(s || '').split(/[；]/)[0].replace(/[。，]$/, '');
  }

  if (!C) {
    R.classList.remove('staged');
    R.classList.add('intro-done');
    return;
  }

  /* ================= 1. 从 shared/content.js 渲染全部真实内容 ================= */
  var M = C.meta || {};
  var PROGS = C.programs || [];
  var NEWS = C.news || [];
  var HONORS = C.honors || [];
  var PPL = C.people || {};
  var JOIN = C.join || {};
  var wechatName = String((M.contact && M.contact.wechat) || '上海大学通信学院')
    .replace(/（.*?）|\(.*?\)/g, '').trim();

  // ① 首屏台卡事实项
  $('heroKicker').textContent = (M.founded || 2021) + ' 年成立 · 挂靠' + (M.host || '通信与信息工程学院团委');
  $('factYear').textContent = String(M.founded || 2021);
  $('factDept').textContent = ((M.departments || []).length || 4) + ' 个';
  $('factNews').textContent = NEWS.length + ' 篇';

  // ② 笔记本：平时做什么（5 种活动）
  $('progList').innerHTML = PROGS.map(function (p, idx) {
    return '<li class="prog-item">' +
      '<span class="prog-item__no">' + pad2(idx + 1) + '</span>' +
      '<div class="prog-item__main">' +
        '<div class="prog-item__row">' +
          '<h3 class="prog-item__name">' + esc(p.name) + '</h3>' +
          '<span class="prog-item__where">' + esc(p.where) + '</span>' +
        '</div>' +
        '<p class="prog-item__desc">' + esc(shortClause(p.desc)) + '。</p>' +
      '</div>' +
    '</li>';
  }).join('');

  // ③ 报道剪报：挑出 5 条写明具体人数的重磅报道 + 第 6 张完整目录卡
  $('clipsSub').textContent = '学院官网公开报道 ' + NEWS.length + ' 篇（2022–2026），挑出五件有分量的记录。';

  var FEATURED_SPECS = [
    { key: '46475', num: '40 余名', tag: '昇腾实训', line: '同学入选华为昇腾大模型实践课，完成 Transformer 与 BERT 微调实验。' },
    { key: '45485', num: '近百名', tag: '企业参访', line: '学子走进华为鸿蒙生态学堂上海站，参与开发者分享与实训。' },
    { key: '45315', num: '百余人', tag: '竞赛协办', line: '报名本科生创新技能大赛焊接专项赛，社团参与协办双赛道赛事。' },
    { key: '43095', num: '近 200 人', tag: '学术分享', line: '参加本科撰写顶级 AI 论文分享会，三位学长现场讲授科研经验。' },
    { key: '42585', num: '百余名', tag: '全联接大会', line: '上大学子赴上海世博中心参观 2024 华为全联接大会。' }
  ];

  var pickedNews = FEATURED_SPECS.map(function (sp, idx) {
    var found = null;
    for (var i = 0; i < NEWS.length; i++) {
      if (String(NEWS[i].source).indexOf(sp.key) > -1) { found = NEWS[i]; break; }
    }
    if (!found && NEWS[idx]) found = NEWS[idx];
    return found ? { item: found, num: sp.num, tag: sp.tag, line: sp.line } : null;
  }).filter(Boolean);

  var clipsHTML = pickedNews.map(function (pk, idx) {
    var n = pk.item;
    return '<article class="clip-card" data-slot="' + idx + '">' +
      '<div class="clip-card__meta">' +
        '<span class="clip-card__tag">' + esc(pk.tag) + '</span>' +
        '<time class="clip-card__date">' + esc(ymDate(n.date)) + '</time>' +
      '</div>' +
      '<div class="clip-card__num-wrap">' +
        '<strong class="clip-card__num">' + esc(pk.num) + '</strong>' +
        '<svg class="clip-ring" viewBox="0 0 128 46" aria-hidden="true">' +
          '<path d="M12,24 C10,9 38,5 68,6 C102,7 121,14 119,26 C117,38 88,42 54,41 C22,40 8,33 17,19" />' +
        '</svg>' +
      '</div>' +
      '<p class="clip-card__txt">' + esc(pk.line) + '</p>' +
      '<a class="clip-card__link" href="' + esc(n.source) + '" target="_blank" rel="noopener" title="' + esc(n.title) + '">看学院官网原文 <span aria-hidden="true">↗</span></a>' +
    '</article>';
  }).join('');

  var honorsMini = HONORS.slice(0, 2).map(function (h) {
    return '<li><span>' + esc(h.year) + '</span>' + esc(h.text) + '</li>';
  }).join('');

  clipsHTML += '<div class="clip-card clip-card--index" data-slot="5">' +
    '<p class="clip-index__kicker">档案汇编 · 2022–2026</p>' +
    '<p class="clip-index__big">共 ' + NEWS.length + ' 篇报道</p>' +
    '<ul class="clip-index__honors">' + honorsMini + '</ul>' +
    '<button type="button" class="btn-archive" id="openNewsBtn">展开全部 ' + NEWS.length + ' 篇报道 <span aria-hidden="true">→</span></button>' +
  '</div>';

  $('clipsGrid').innerHTML = clipsHTML;

  // ④ 工牌与名单：谁在带大家
  var leader = (PPL.leaders || [])[0];
  if (leader) {
    var awardsHTML = (leader.awards || []).map(function (aw) {
      return '<li>' + esc(aw) + '</li>';
    }).join('');
    $('leaderBox').innerHTML =
      '<div class="leader-card__top">' +
        (leader.photo
          ? '<div class="leader-card__avatar"><img src="../shared/img/' + esc(leader.photo) + '" alt="社长' + esc(leader.name) + '照片" width="228" height="671"></div>'
          : '') +
        '<div class="leader-card__id">' +
          '<span class="leader-card__role">' + esc(leader.role) + '</span>' +
          '<h3 class="leader-card__name">' + esc(leader.name) + '</h3>' +
          '<p class="leader-card__desc">' + esc(leader.desc) + '</p>' +
        '</div>' +
      '</div>' +
      (awardsHTML ? '<ul class="leader-card__awards">' + awardsHTML + '</ul>' : '');
  }

  $('teacherList').innerHTML = (PPL.teachers || []).map(function (t) {
    var parts = String(t.role || '').split('·');
    var rMain = (parts[0] || '').trim();
    var rSub = (parts[1] || '').trim();
    return '<li class="teacher-item">' +
      '<div class="teacher-item__head">' +
        '<strong>' + esc(t.name) + '</strong>' +
        '<span>' + esc(rMain) + (rSub ? ' · ' + esc(rSub) : '') + '</span>' +
      '</div>' +
      '<p>' + esc(t.desc) + '</p>' +
    '</li>';
  }).join('');

  var depts = M.departments || [];
  $('deptHeading').textContent = depts.length + ' 个部门';
  $('deptList').innerHTML = depts.map(function (dp) {
    return '<li><strong>' + esc(dp.name) + '</strong><span>' + esc(dp.desc) + '</span></li>';
  }).join('');

  // ⑤ 手机：怎么加入
  $('stepList').innerHTML = (JOIN.steps || []).map(function (st, idx) {
    return '<li class="join-step">' +
      '<span class="join-step__n">' + (idx + 1) + '</span>' +
      '<div class="join-step__txt">' +
        '<h3>' + esc(st.t) + '</h3>' +
        '<p>' + esc(st.d) + '</p>' +
      '</div>' +
    '</li>';
  }).join('');

  $('copyBtn').textContent = '复制公众号名：' + wechatName;
  $('copyMsg').textContent = '微信里搜索：' + wechatName;
  $('whereLine').textContent = M.location || '宝山校区 翔英大楼（T404 / T406 / 608 创客空间）';

  // 页脚 FAQ 与署名
  $('faqList').innerHTML = (JOIN.faq || []).map(function (f) {
    return '<div class="faq-item"><dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd></div>';
  }).join('');

  $('footMeta').innerHTML =
    esc(M.name) + ' · ' + esc(M.founded) + ' 年成立 · 挂靠' + esc(M.host) + '<br>' +
    esc(M.location) + ' · 页面事实与报道均整理自学院官网公开报道（共 ' + NEWS.length + ' 篇）。';

  // 弹窗：荣誉 + 全部 16 篇报道
  $('modalTitle').textContent = '全部 ' + NEWS.length + ' 篇学院官网报道';
  $('honorsBox').innerHTML = HONORS.map(function (h) {
    return '<a class="honor-pill" href="' + esc(h.source) + '" target="_blank" rel="noopener">' +
      '<b>' + esc(h.year) + '</b><span>' + esc(h.text) + ' ↗</span></a>';
  }).join('');

  var CAT_MAP = {};
  PROGS.forEach(function (p) { CAT_MAP[p.id] = p.name; });
  $('allNewsList').innerHTML = NEWS.map(function (n, idx) {
    return '<li class="archive-item">' +
      '<a href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
        '<div class="archive-item__top">' +
          '<span class="archive-item__idx">' + pad2(idx + 1) + '</span>' +
          '<time>' + esc(dotDate(n.date)) + '</time>' +
          '<span class="archive-item__cat">' + esc(CAT_MAP[n.cat] || '社团动态') + '</span>' +
        '</div>' +
        '<h3 class="archive-item__t">' + esc(n.title) + '</h3>' +
        '<p class="archive-item__s">' + esc(n.summary) + '</p>' +
      '</a>' +
    '</li>';
  }).join('');

  /* ================= 2. 交互控件：复制公众号、报道弹窗、小智摆件 ================= */
  $('copyBtn').addEventListener('click', function () {
    var ta = $('clipTa'), ok = false;
    ta.value = wechatName;
    ta.style.display = 'block';
    ta.focus({ preventScroll: true });
    ta.select();
    try {
      ta.setSelectionRange(0, wechatName.length);
      ok = d.execCommand('copy');
    } catch (e) { ok = false; }
    ta.style.display = 'none';
    $('copyBtn').focus({ preventScroll: true });
    $('copyMsg').textContent = ok
      ? '已复制「' + wechatName + '」，去微信搜索框粘贴关注即可。'
      : '微信里搜索：' + wechatName;
    $('copyBtn').classList.add('is-copied');
    setTimeout(function () { $('copyBtn').classList.remove('is-copied'); }, 2200);
  });

  var modal = $('newsModal'), prevFocus = null;
  function openModal() {
    prevFocus = d.activeElement;
    modal.hidden = false;
    R.classList.add('modal-open');
    $('closeModal').focus({ preventScroll: true });
  }
  function closeModal() {
    modal.hidden = true;
    R.classList.remove('modal-open');
    if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
  }
  var openNewsBtn = $('openNewsBtn');
  if (openNewsBtn) openNewsBtn.addEventListener('click', openModal);
  modal.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  d.addEventListener('keydown', function (e) {
    if (modal.hidden) return;
    if (e.key === 'Escape') { closeModal(); return; }
    if (e.key === 'Tab') {
      var focusables = modal.querySelectorAll('a[href], button:not([disabled])');
      if (!focusables.length) return;
      var first = focusables[0], last = focusables[focusables.length - 1];
      if (e.shiftKey && d.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && d.activeElement === last) { first.focus(); e.preventDefault(); }
    }
  });

  // 吉祥物小智桌面摆件彩蛋（4 帧透明小智切换）
  var zhiPose = 0;
  var ZHI_LABELS = ['小智 · 挥手欢迎', '小智 · 思考电路', '小智 · 调试成功', '小智 · 困倦待机'];
  var propZhi = $('propZhi'), zhiFig = $('zhiFig'), zhiTag = $('zhiTag');
  if (propZhi) {
    propZhi.addEventListener('click', function () {
      zhiPose = (zhiPose + 1) % 4;
      zhiFig.style.backgroundPosition = (zhiPose * 33.3333).toFixed(2) + '% 50%';
      zhiTag.textContent = ZHI_LABELS[zhiPose];
      propZhi.classList.remove('is-pop');
      void propZhi.offsetWidth;
      propZhi.classList.add('is-pop');
    });
  }

  /* ================= 3. 初始化桌面器物画布与悬停微抬联动 ================= */
  var art = null;
  try {
    if (w.DeskArt) art = w.DeskArt.create();
  } catch (e) { art = null; }

  var hoverBoost = { solder: 0, spool: 0, pcb: 0, meter: 0 };
  [
    ['propSolder', 'solder'],
    ['propSpool', 'spool'],
    ['propPcb', 'pcb'],
    ['propMeter', 'meter']
  ].forEach(function (pair) {
    var el = $(pair[0]), key = pair[1];
    if (!el) return;
    el.addEventListener('pointerenter', function () {
      hoverBoost[key] = 1;
      el.classList.add('is-hover');
      kick();
    });
    el.addEventListener('pointerleave', function () {
      hoverBoost[key] = 0;
      el.classList.remove('is-hover');
      kick();
    });
  });

  /* ================= 4. 吸顶舞台滚动引擎 ================= */
  var staged = R.classList.contains('staged');
  if (!staged) {
    R.classList.add('intro-done');
    setupFlatNav();
    return;
  }

  var track = $('track'), stage = $('stage'), world = $('world'), focusMask = $('focusMask');
  var stations = [0, 1, 2, 3, 4].map(function (i) { return $('st' + i); });
  var tabBtns = [].slice.call(d.querySelectorAll('.desk-tab'));
  var tabNow = $('tabNow'), tabFill = $('tabFill'), statLabel = $('statLabel');

  // 舞台内动作节点引用
  var nbCover = $('nbCover'), nbRig = $('nbRig'), nbBand = $('nbBand'), nbPen = $('nbPen'), nbSpread = $('nbSpread'), nbLeft = $('nbLeft');
  var clipCards = [].slice.call(d.querySelectorAll('#clipsGrid .clip-card'));
  var clipRings = [].slice.call(d.querySelectorAll('#clipsGrid .clip-ring path'));
  var paperclip = $('paperclip');
  var badgeFront = $('badgeFront'), badgeBack = $('badgeBack'), badgeSlot = $('badgeSlot'), rosterCard = $('rosterCard'), lanyard = $('lanyard');
  var phoneLock = $('phoneLock'), phoneScreen = $('phoneScreen'), phoneNote = $('phoneNote');

  // 每拍分三段：a=动作(40%)，r=停住可读(45%)，x=过渡(15%)，L=滚动高度倍数
  var SEG = [
    { a: 0.00, r: 0.72, x: 0.28, L: 0.85, name: '翔英大楼工作台 · 中央台卡' },
    { a: 0.40, r: 0.45, x: 0.15, L: 2.00, name: '翻开实验笔记本 · 平时做什么' },
    { a: 0.40, r: 0.45, x: 0.15, L: 2.00, name: '摊开官网剪报 · 做过的事' },
    { a: 0.40, r: 0.45, x: 0.15, L: 2.00, name: '翻转社团工牌 · 谁在带大家' },
    { a: 0.40, r: 0.60, x: 0.00, L: 1.80, name: '点亮手机屏幕 · 怎么加入' }
  ];

  var STACK_ROTS = [-4.2, 3.1, -2.2, 3.8, -1.6, 1.4];

  var geo = {
    W: 1440, H: 900, mobile: false,
    top: 0, total: 1, starts: [], lens: [],
    pos: [], clipDeltas: []
  };

  var params = new URLSearchParams(w.location.search);
  var atParam = params.has('at') ? Math.max(0, parseInt(params.get('at'), 10) || 0) : null;

  var targetP = 0, dispP = 0, initedP = false;
  var activeBeat = 0, rafId = 0, tmoId = 0, lastTs = 0;

  function placeEl(el, x, y, deg, sc) {
    if (!el) return;
    var tr = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0) translate(-50%,-50%)';
    if (deg) tr += ' rotate(' + deg + 'deg)';
    if (sc && sc !== 1) tr += ' scale(' + sc + ')';
    el.style.transform = tr;
  }

  function measure() {
    geo.W = stage.clientWidth || w.innerWidth || 1440;
    geo.H = stage.clientHeight || w.innerHeight || 900;
    geo.mobile = geo.W < 880;
    geo.narrowTabs = geo.W <= 1120;
    R.style.setProperty('--stage-w', geo.W + 'px');
    R.classList.toggle('is-mobile-stage', geo.mobile);

    // 各物件在桌面世界平面上的中心坐标（原点 0,0 为首屏台卡）
    if (!geo.mobile) {
      geo.pos = [
        { x: 0, y: 0 },
        { x: 1120, y: -470 },
        { x: 1190, y: 720 },
        { x: -1080, y: 680 },
        { x: 0, y: 1320 }
      ];
      placeEl($('deskMat'), -430, -135, 0, 1);
      placeEl($('propSolder'), -500, -210, -1.5, 1);
      placeEl($('propSpool'), -250, -318, 8, 1);
      placeEl($('propRuler'), 468, -285, -3.5, 1);
      placeEl($('propZhi'), 478, -155, 0, 1);
      placeEl($('propPcb'), 505, 198, 2.2, 1);
      placeEl($('propMeter'), -495, 210, 3.2, 1);
    } else {
      var spreadX = Math.max(480, geo.W + 130);
      var mx = Math.min(1, geo.W / 440);
      var msc = geo.W < 420 ? 0.88 : 1;
      geo.pos = [
        { x: 0, y: -6 },
        { x: spreadX, y: 560 },
        { x: -spreadX, y: 1220 },
        { x: spreadX, y: 1900 },
        { x: 0, y: 2580 }
      ];
      placeEl($('deskMat'), -45 * mx, -268, 0, 0.66 * msc);
      placeEl($('propSolder'), -106 * mx, -296, -2, 0.62 * msc);
      placeEl($('propSpool'), 42 * mx, -326, 6, 0.60 * msc);
      placeEl($('propRuler'), -58 * mx, -198, -1.5, 0.66 * msc);
      placeEl($('propZhi'), 136 * mx, -238, 0, 0.76 * msc);
      placeEl($('propMeter'), -104 * mx, 272, 3, 0.62 * msc);
      placeEl($('propPcb'), 106 * mx, 276, -2, 0.64 * msc);
    }

    var topSafe = geo.mobile ? 52 : 58;
    var botSafe = geo.narrowTabs ? 80 : 22;
    var availH = Math.max(260, geo.H - topSafe - botSafe - 10);
    var yShift = geo.narrowTabs ? -12 : 0;

    stations.forEach(function (st, i) {
      st.style.left = geo.pos[i].x + 'px';
      st.style.top = (geo.pos[i].y + (i > 0 ? yShift : 0)) + 'px';
      st.style.transform = '';
      var sh = st.offsetHeight || 0;
      if (sh > availH) {
        var fit = clamp(availH / sh, 0.72, 1);
        st.style.transform = 'translate(-50%, -50%) scale(' + fit.toFixed(3) + ')';
      }
    });

    // 计算滚动轨道长度
    var acc = 0;
    geo.starts = [];
    geo.lens = [];
    SEG.forEach(function (sg) {
      geo.starts.push(acc);
      var len = Math.round(sg.L * geo.H);
      geo.lens.push(len);
      acc += len;
    });
    geo.total = Math.max(1, acc);
    track.style.height = (geo.H + geo.total) + 'px';
    geo.top = track.getBoundingClientRect().top + (w.pageYOffset || 0);

    // 测量剪报在网格摊开态相对于容器中心的自然布局偏移（用 offsetLeft/Top 免受祖先缩放影响）
    var gridEl = $('clipsGrid');
    var gcx = gridEl.clientWidth / 2;
    var gcy = gridEl.clientHeight / 2;
    geo.clipDeltas = clipCards.map(function (c) {
      return {
        dx: (c.offsetLeft + c.offsetWidth / 2) - gcx,
        dy: (c.offsetTop + c.offsetHeight / 2) - gcy
      };
    });

    if (art) art.resize();
  }

  /* 将滚动距离 p 映射为连续镜头位置、缩放与 5 个物件的开合度 */
  function solveTimeline(p) {
    var clamped = clamp(p, 0, geo.total);
    var i = 0;
    while (i < SEG.length - 1 && clamped >= geo.starts[i + 1]) i++;
    var g = SEG[i];
    var u = clamp((clamped - geo.starts[i]) / (geo.lens[i] || 1), 0, 1);

    var open = [0, 0, 0, 0, 0];
    open[0] = 1;

    var camX = geo.pos[i].x, camY = geo.pos[i].y, camScale = 1;
    var focus = 0;
    var dipMax = geo.mobile ? 0.14 : 0.20;

    // 硬件动态参数
    var temp = 350, heat = 0.35, sheen = 0, pulse = 0, volts = 3.30;

    if (i === 0) {
      if (u <= g.r) {
        camX = geo.pos[0].x; camY = geo.pos[0].y; camScale = 1;
        focus = 0.15;
      } else {
        // 第 0 拍后段过渡：镜头抬起并滑向第 1 拍前 28% 路程
        var e0 = (u - g.r) / g.x; // 0..1
        var pan0 = 0.28 * easeInOutCubic(e0);
        camX = lerp(geo.pos[0].x, geo.pos[1].x, pan0);
        camY = lerp(geo.pos[0].y, geo.pos[1].y, pan0) - Math.sin(pan0 * Math.PI) * 34;
        camScale = 1 - dipMax * Math.sin(pan0 * Math.PI);
        temp = lerp(318, 344, e0);
        heat = lerp(0.45, 0.92, e0);
      }
    } else {
      var prev = geo.pos[i - 1], curr = geo.pos[i];
      if (u < g.a) {
        // 动作段（40%）：完成剩余 28%->100% 镜头推移，并同步打开当前物件 0->1
        var q = u / g.a; // 0..1
        var panQ = clamp(q / 0.78, 0, 1);
        var panT = 0.28 + 0.72 * easeOutCubic(panQ);
        camX = lerp(prev.x, curr.x, panT);
        camY = lerp(prev.y, curr.y, panT) - Math.sin(panT * Math.PI) * (geo.mobile ? 18 : 34);
        camScale = panQ >= 1 ? 1 : (1 - dipMax * Math.sin(panT * Math.PI));

        // 上一拍残留平稳收合
        if (i - 1 > 0 && q < 0.28) {
          open[i - 1] = 0.25 * (1 - q / 0.28);
        }

        var opQ = clamp((q - 0.10) / 0.90, 0, 1);
        open[i] = easeOutCubic(opQ);
        focus = open[i];

        // 途经不同桌面器物时的联动反馈
        if (i === 1) { temp = lerp(344, 350, q); heat = lerp(0.95, 0.42, q); }
        if (i === 2) { pulse = q; sheen = q; }
        if (i === 3) { volts = 3.30 + Math.sin(q * Math.PI) * 1.68; sheen = 1 - q; }
        if (i === 4) { volts = lerp(3.36, 3.30, q); }
      } else if (u <= g.a + g.r || g.x === 0) {
        // 停住可读段（45%，最后一拍 60%）：镜头与物件 100% 静止，缩放恒为 1
        camX = curr.x; camY = curr.y; camScale = 1;
        open[i] = 1;
        focus = 1;
      } else {
        // 过渡到下一拍段（15%）：当前物件开始合拢，镜头抬起滑向下一拍前 28%
        var ex = (u - g.a - g.r) / g.x; // 0..1
        var next = geo.pos[Math.min(SEG.length - 1, i + 1)];
        var panEx = 0.28 * easeInOutCubic(ex);
        camX = lerp(curr.x, next.x, panEx);
        camY = lerp(curr.y, next.y, panEx) - Math.sin(panEx * Math.PI) * (geo.mobile ? 18 : 34);
        camScale = 1 - dipMax * Math.sin(panEx * Math.PI);
        open[i] = 1 - 0.75 * easeInOutCubic(ex);
        focus = 1 - ex;

        if (i === 1) { pulse = ex * 0.4; }
        if (i === 2) { volts = lerp(3.30, 4.10, ex); }
      }
    }

    return {
      beat: i, u: u, p: clamped,
      camX: camX, camY: camY, camScale: camScale,
      open: open, focus: focus,
      temp: temp, heat: heat, sheen: sheen, pulse: pulse, volts: volts
    };
  }

  function applyState(st) {
    // 1) 世界镜头变换：可读静止态完全回落到整数像素平移（scale === 1），杜绝字体模糊
    if (Math.abs(st.camScale - 1) < 0.0008) {
      world.style.transform = 'translate3d(' + (-Math.round(st.camX)) + 'px,' + (-Math.round(st.camY)) + 'px,0)';
    } else {
      world.style.transform = 'scale(' + st.camScale.toFixed(4) + ') translate3d(' + (-st.camX).toFixed(1) + 'px,' + (-st.camY).toFixed(1) + 'px,0)';
    }

    focusMask.style.opacity = (st.focus * 0.55).toFixed(3);

    // 2) 笔记本（第 2 拍）：硬壳封面绕中缝 3D 翻开，过 90° 无缝交接左页展开，静止态回落零变换锐利排版
    var nbOpen = st.open[1];
    if (!geo.mobile) {
      nbSpread.style.opacity = '1';
      if (nbOpen < 0.5) {
        var cDeg = -nbOpen * 2 * 90;
        nbRig.style.visibility = 'visible';
        nbRig.style.opacity = '1';
        nbCover.style.transform = 'rotateY(' + cDeg.toFixed(2) + 'deg)';
        if (nbLeft) nbLeft.style.visibility = 'hidden';
      } else {
        var lDeg = (1 - nbOpen) * 2 * 90;
        nbRig.style.visibility = 'hidden';
        nbRig.style.opacity = '0';
        if (nbLeft) {
          nbLeft.style.visibility = 'visible';
          nbLeft.style.transform = nbOpen >= 0.998 ? '' : ('rotateY(' + lDeg.toFixed(2) + 'deg)');
        }
      }
      nbBand.style.transform = 'translate3d(' + (Math.min(nbOpen * 2, 1) * 28).toFixed(1) + 'px,0,0)';
      nbBand.style.opacity = clamp(1 - nbOpen * 3.2, 0, 1).toFixed(2);
      nbPen.style.transform = nbOpen >= 0.998
        ? 'translate3d(38px, 6px, 0) rotate(14deg)'
        : ('translate3d(' + (38 * nbOpen).toFixed(1) + 'px,' + (6 * nbOpen).toFixed(1) + 'px,0) rotate(' + (14 * nbOpen).toFixed(1) + 'deg)');
    } else {
      if (nbLeft) {
        nbLeft.style.visibility = 'visible';
        nbLeft.style.transform = '';
      }
      nbSpread.style.opacity = clamp(0.15 + nbOpen * 1.15, 0, 1).toFixed(3);
      if (nbOpen >= 0.84) {
        nbRig.style.visibility = 'hidden';
        nbRig.style.opacity = '0';
      } else {
        nbRig.style.visibility = 'visible';
        nbRig.style.opacity = '1';
        nbCover.style.transform = 'rotateY(' + (-108 * nbOpen).toFixed(2) + 'deg)';
        nbBand.style.opacity = clamp(1 - nbOpen * 3.2, 0, 1).toFixed(2);
      }
    }
    stations[1].classList.toggle('is-open', nbOpen > 0.85);

    // 3) 报道剪报（第 3 拍）：回形针滑开，6 张卡片从叠放中心扇形摊开到各自网格位，红圈勾出人数
    var clOpen = st.open[2];
    if (clOpen >= 0.998) {
      clipCards.forEach(function (c) { c.style.transform = ''; });
      paperclip.style.transform = 'translate3d(-34px,-26px,0) rotate(-28deg)';
    } else {
      var inv = 1 - clOpen;
      clipCards.forEach(function (c, idx) {
        var dl = geo.clipDeltas[idx] || { dx: 0, dy: 0 };
        var rot = (STACK_ROTS[idx] || 0) * inv;
        var sc = 1 - 0.08 * inv;
        c.style.transform = 'translate3d(' + (-dl.dx * inv).toFixed(1) + 'px,' + (-dl.dy * inv).toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + sc.toFixed(3) + ')';
      });
      paperclip.style.transform = 'translate3d(' + (-34 * clOpen).toFixed(1) + 'px,' + (-26 * clOpen).toFixed(1) + 'px,0) rotate(' + (-28 * clOpen).toFixed(1) + 'deg)';
    }
    var ringDraw = clamp((clOpen - 0.45) / 0.55, 0, 1);
    clipRings.forEach(function (p) {
      p.style.strokeDashoffset = (280 * (1 - ringDraw)).toFixed(1);
    });
    stations[2].classList.toggle('is-open', clOpen > 0.85);

    // 4) 社团工牌（第 4 拍）：工牌 180° 3D 翻转（背面从 -90 -> 0deg 落位无镜像模糊），右侧老师部门卡滑出
    var bdOpen = st.open[3];
    if (bdOpen < 0.5) {
      var fDeg = bdOpen * 2 * 90; // 0 -> 90deg
      badgeFront.style.visibility = 'visible';
      badgeBack.style.visibility = 'hidden';
      badgeFront.style.transform = 'rotateY(' + fDeg.toFixed(2) + 'deg)';
    } else {
      var bDeg = (1 - bdOpen) * 2 * -90; // -90 -> 0deg
      badgeFront.style.visibility = 'hidden';
      badgeBack.style.visibility = 'visible';
      badgeBack.style.transform = bdOpen >= 0.998 ? '' : ('rotateY(' + bDeg.toFixed(2) + 'deg)');
    }
    var slideT = clamp((bdOpen - 0.22) / 0.78, 0, 1);
    var slideEase = easeOutCubic(slideT);
    if (slideEase >= 0.998) {
      rosterCard.style.transform = '';
      rosterCard.style.opacity = '1';
      badgeSlot.style.transform = '';
    } else {
      if (!geo.mobile) {
        badgeSlot.style.transform = 'translate3d(' + ((1 - slideEase) * 190).toFixed(1) + 'px,0,0)';
        rosterCard.style.transform = 'translate3d(' + ((1 - slideEase) * -170).toFixed(1) + 'px,0,0) scale(' + (0.94 + 0.06 * slideEase).toFixed(3) + ')';
      } else {
        badgeSlot.style.transform = '';
        rosterCard.style.transform = 'translate3d(0,' + ((1 - slideEase) * -44).toFixed(1) + 'px,0) scale(' + (0.95 + 0.05 * slideEase).toFixed(3) + ')';
      }
      rosterCard.style.opacity = slideEase.toFixed(3);
    }
    if (lanyard) {
      lanyard.style.transform = !geo.mobile && slideEase < 0.998
        ? 'translate3d(' + ((1 - slideEase) * 190).toFixed(1) + 'px,0,0)'
        : '';
    }
    stations[3].classList.toggle('is-open', bdOpen > 0.85);

    // 5) 智能手机（第 5 拍）：屏幕唤醒亮起，锁屏层向上滑开解锁
    var phOpen = st.open[4];
    var unlockT = clamp((phOpen - 0.12) / 0.88, 0, 1);
    if (unlockT >= 0.998) {
      phoneLock.style.transform = 'translate3d(0,-105%,0)';
      phoneLock.style.opacity = '0';
    } else {
      phoneLock.style.transform = 'translate3d(0,' + (-105 * unlockT).toFixed(1) + '%,0)';
      phoneLock.style.opacity = clamp(1 - unlockT * 1.25, 0, 1).toFixed(3);
    }
    if (phoneNote) {
      phoneNote.style.transform = phOpen >= 0.998
        ? 'rotate(-2.2deg)'
        : 'translate3d(' + ((1 - phOpen) * 28).toFixed(1) + 'px,0,0) rotate(' + (-2.2 - (1 - phOpen) * 4).toFixed(2) + 'deg)';
      phoneNote.style.opacity = (0.35 + 0.65 * phOpen).toFixed(3);
    }
    stations[4].classList.toggle('is-open', phOpen > 0.85);

    // 更新桌面器物画布（结合悬停微调与滚动联动）
    if (art) {
      art.update({
        temp: st.temp + hoverBoost.solder * 8,
        heat: Math.max(st.heat, hoverBoost.solder * 0.92),
        sheen: st.sheen + hoverBoost.spool * 0.65,
        pulse: st.pulse + hoverBoost.pcb * 0.35,
        volts: hoverBoost.meter ? 5.00 : st.volts
      });
    }

    // 更新进度导航与顶栏状态
    if (st.beat !== activeBeat) {
      activeBeat = st.beat;
      tabNow.textContent = pad2(activeBeat + 1);
      statLabel.textContent = SEG[activeBeat].name;
      tabBtns.forEach(function (btn, k) {
        var cur = k === activeBeat;
        btn.classList.toggle('is-cur', cur);
        if (cur) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });
    }
    tabFill.style.setProperty('--prog', (st.p / geo.total).toFixed(4));
  }

  function currentScrollP() {
    var y = w.pageYOffset || d.documentElement.scrollTop || 0;
    if (atParam !== null && y < 2) return atParam - geo.top;
    return y - geo.top;
  }

  function kick() {
    if (rafId) return;
    rafId = w.requestAnimationFrame(tick);
    // 后台标签页或无头浏览器 rAF 节流兜底：90ms 未执行则直接同步推进到目标帧
    clearTimeout(tmoId);
    tmoId = setTimeout(function () {
      if (rafId) {
        w.cancelAnimationFrame(rafId);
        rafId = 0;
        tick(w.performance ? performance.now() : Date.now());
      }
    }, 90);
  }

  function tick(now) {
    rafId = 0;
    clearTimeout(tmoId);
    targetP = clamp(currentScrollP(), 0, geo.total);

    var dt = lastTs ? (now - lastTs) : 16;
    lastTs = now;

    if (!initedP || dt > 95) {
      dispP = targetP;
      initedP = true;
    } else {
      var diff = targetP - dispP;
      if (Math.abs(diff) < 0.4) {
        dispP = targetP;
      } else {
        dispP += diff * (1 - Math.pow(0.42, clamp(dt, 8, 64) / 16));
      }
    }

    applyState(solveTimeline(dispP));

    if (Math.abs(targetP - dispP) >= 0.4) {
      kick();
    } else {
      lastTs = 0;
    }
  }

  function beatTargetY(idx) {
    idx = clamp(idx, 0, SEG.length - 1);
    if (idx === 0) return geo.top;
    return Math.round(geo.top + geo.starts[idx] + (SEG[idx].a + 0.08) * geo.lens[idx]);
  }

  function jumpToBeat(idx, behavior) {
    atParam = null;
    w.scrollTo({ top: beatTargetY(idx), behavior: behavior || 'smooth' });
  }

  // 导航点击与键盘焦点自动对齐可读段
  d.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-go]');
    if (!trigger) return;
    e.preventDefault();
    jumpToBeat(parseInt(trigger.getAttribute('data-go'), 10) || 0, 'smooth');
  });

  d.addEventListener('focusin', function (e) {
    if (!modal.hidden) return;
    if (e.target === propZhi && activeBeat !== 0) {
      jumpToBeat(0, 'auto');
      return;
    }
    var st = e.target.closest && e.target.closest('.station');
    if (!st) return;
    var idx = parseInt(st.getAttribute('data-beat'), 10);
    if (!isNaN(idx) && idx !== activeBeat) {
      jumpToBeat(idx, 'auto');
    }
  });

  function setupFlatNav() {
    d.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-go]');
      if (!trigger) return;
      var idx = parseInt(trigger.getAttribute('data-go'), 10) || 0;
      var target = $('st' + idx);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'auto' });
      }
    });
  }

  w.addEventListener('scroll', function () {
    if (atParam !== null && (w.pageYOffset || 0) > 4) atParam = null;
    kick();
  }, { passive: true });

  w.addEventListener('resize', function () {
    measure();
    initedP = false;
    kick();
  });

  // 初始化测量与首帧直出
  measure();
  R.classList.add('stage-ok');
  if (atParam !== null) {
    R.classList.add('intro-done');
  } else {
    setTimeout(function () { R.classList.add('intro-done'); }, 450);
  }
  tick(w.performance ? performance.now() : Date.now());
})(window, document);
