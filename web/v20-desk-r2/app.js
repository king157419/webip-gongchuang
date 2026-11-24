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
  var lightEl = $('stageLight'), hazeEl = $('stageHaze');
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
  var avatarBox = d.querySelector('.leader-card__avatar');
  var avatarImg = avatarBox ? avatarBox.querySelector('img') : null;

  // 每个物件下方一块跟着“抬起”变化的柔影（只动 transform/opacity，不重绘）
  var shadows = stations.map(function (st) {
    var sh = d.createElement('div');
    sh.className = 'st-shadow';
    sh.setAttribute('aria-hidden', 'true');
    world.insertBefore(sh, stations[0]);
    return sh;
  });

  /* 每拍三段：a = 镜头飞入并打开物件，r = 可读段（镜头仍在缓慢滑移，不停），x = 抬升飞向下一件。
   * 第 0 拍没有停留：一滑动镜头就从台卡升起，拉到能看到整张桌子的全景，再俯冲向笔记本。 */
  /* 第 1–4 拍的镜头分镜（第三轮）：中景飞入 → 近景（物件开合，铺满画面）→ 快推特写（浅景深）
   * → 特写里慢慢移 → 快拉回近景（完整可读，慢慢滑）→ 抬起飞走。
   * a = 飞入并打开，c = 特写段（推、停、拉），r = 近景阅读段，x = 飞向下一件。 */
  var leadName = (PPL.leaders && PPL.leaders[0] && PPL.leaders[0].name) || '';
  var step0 = (JOIN.steps && JOIN.steps[0] && JOIN.steps[0].t) || '关注公众号';
  var SEG = [
    { a: 0.00, c: 0, r: 0.00, x: 1.00, L: 1.30, name: '翔英大楼工作台 · 中央台卡' },
    { a: 0.30, c: 0.30, r: 0.26, x: 0.14, L: 2.10, name: '翻开实验笔记本 · 平时做什么',
      close: '特写 · 手记第一行：' + ((PROGS[0] && PROGS[0].name) || ''),
      dSel: ['#progList .prog-item:first-child'],
      mSel: ['#progList .prog-item:first-child .prog-item__no', '#progList .prog-item:first-child .prog-item__name'] },
    { a: 0.30, c: 0.30, r: 0.26, x: 0.14, L: 2.10, name: '摊开官网剪报 · 做过的事',
      close: '特写 · 剪报：' + (pickedNews[0] ? pickedNews[0].num + String(pickedNews[0].line).split('，')[0] : ''),
      dSel: ['#clipsGrid .clip-card[data-slot="0"]'],
      mSel: ['#clipsGrid .clip-card[data-slot="0"] .clip-card__meta', '#clipsGrid .clip-card[data-slot="0"] .clip-card__num-wrap'] },
    { a: 0.30, c: 0.30, r: 0.26, x: 0.14, L: 2.10, name: '翻转社团工牌 · 谁在带大家',
      close: '特写 · 工牌照片：社长' + leadName,
      dSel: ['.leader-card__top'],
      mSel: ['.leader-card__avatar', '.leader-card__role', '.leader-card__name'] },
    { a: 0.32, c: 0.30, r: 0.38, x: 0.00, L: 1.95, name: '点亮手机屏幕 · 怎么加入',
      close: '特写 · 手机屏幕：' + step0,
      dSel: ['.phone__head', '#stepList .join-step:first-child'],
      mSel: ['.phone__head .sec-head__no', '.phone__title'] }
  ];
  var WIDE_AT = [0.50, 0.86]; // 第 0 拍里到达全景高处、横移结束的位置
  var CLOSE_IN = 0.36, CLOSE_HOLD = 0.70; // 特写段内：推到位、开始往回拉的位置

  var STACK_ROTS = [-4.2, 3.1, -2.2, 3.8, -1.6, 1.4];
  var CH = ['x', 'y', 's', 't', 'r'];

  var geo = {
    W: 1440, H: 900, mobile: false,
    top: 0, total: 1, starts: [], lens: [],
    pos: [], clipDeltas: [], stW: [], stH: [], drift: [],
    keys: null
  };

  var params = new URLSearchParams(w.location.search);
  var atParam = params.has('at') ? Math.max(0, parseInt(params.get('at'), 10) || 0) : null;

  var targetP = 0, dispP = 0, vel = 0, initedP = false;
  var activeBeat = -1, rafId = 0, tmoId = 0, lastTs = 0, lastAvatar = -1;
  var lastShotBeat = -1, shotMode = '', restTmo = 0, resting = false;
  var dofEl = $('stageDof'), frameEl = $('shotFrame'), frameTag = $('shotFrameTag');
  var SMOOTH = 0.24; // 镜头惯性时间常数（秒）：滑动停下后镜头还会顺势滑一小段再落稳

  function placeEl(el, x, y, deg, sc) {
    if (!el) return;
    var tr = 'translate3d(' + Math.round(x) + 'px,' + Math.round(y) + 'px,0) translate(-50%,-50%)';
    if (deg) tr += ' rotate(' + deg + 'deg)';
    if (sc && sc !== 1) tr += ' scale(' + sc + ')';
    el.style.transform = tr;
    el._wx = x;
    el._wy = y;
  }

  // 参与景深失焦判断的物件：5 个工作站 + 桌面器物
  var focusables = stations.concat(['propSolder', 'propSpool', 'propPcb', 'propMeter', 'propRuler', 'propZhi'].map($)).filter(Boolean);

  /* 单调三次插值（Steffen）：曲线过每个机位、不过冲、速度连续——没有“急停”，也没有平台死区 */
  function slopes(ps, vs) {
    var n = ps.length, m = new Array(n), h = [], dd = [], k;
    for (k = 0; k < n - 1; k++) {
      h[k] = (ps[k + 1] - ps[k]) || 1;
      dd[k] = (vs[k + 1] - vs[k]) / h[k];
    }
    m[0] = dd[0];
    m[n - 1] = dd[n - 2];
    for (k = 1; k < n - 1; k++) {
      var pk = (dd[k - 1] * h[k] + dd[k] * h[k - 1]) / (h[k - 1] + h[k]);
      var sg = (dd[k - 1] > 0 ? 1 : dd[k - 1] < 0 ? -1 : 0) + (dd[k] > 0 ? 1 : dd[k] < 0 ? -1 : 0);
      m[k] = sg * Math.min(Math.abs(dd[k - 1]), Math.abs(dd[k]), 0.5 * Math.abs(pk));
    }
    return m;
  }

  function buildKeys(availH) {
    var P = geo.pos, S = geo.starts, L = geo.lens, mob = geo.mobile;
    var list = [];
    list.push({ p: 0, x: P[0].x, y: P[0].y, s: 1, t: 0, r: 0 });

    // 全景机位：把桌上五件东西一起框进画面，镜头抬高并带一点俯仰
    var nIn = mob ? 2 : 5, minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
    for (var b = 0; b < nIn; b++) {
      minX = Math.min(minX, P[b].x - geo.stW[b] / 2); maxX = Math.max(maxX, P[b].x + geo.stW[b] / 2);
      minY = Math.min(minY, P[b].y - geo.stH[b] / 2); maxY = Math.max(maxY, P[b].y + geo.stH[b] / 2);
    }
    var wideS = clamp(Math.min(geo.W / (maxX - minX + 160), geo.H / (maxY - minY + 120)), mob ? 0.5 : 0.3, mob ? 0.56 : 0.5);
    var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2 + (mob ? 0 : 40);
    var sweep = (P[1].x - P[0].x) * 0.2;
    // 全景用两个机位：先升到高处，再在高处横移一段——升、移、降三件事错开，最高点也不会“悬停”
    list.push({
      p: S[0] + L[0] * WIDE_AT[0],
      x: cx - sweep, y: cy + 20,
      s: wideS + 0.03, t: mob ? 14 : 19, r: mob ? 1.4 : 2
    });
    list.push({
      p: S[0] + L[0] * WIDE_AT[1],
      x: cx + sweep, y: cy - 30,
      s: wideS, t: mob ? 15 : 21, r: mob ? 2.4 : 3.6
    });

    for (var i = 1; i < SEG.length; i++) {
      var g = SEG[i], dr = geo.drift[i], sh = geo.shot[i];
      var rs = S[i] + g.a * L[i], re = S[i] + (g.a + g.c + g.r) * L[i];
      // 最后一件（手机）：近景阅读段最后落回正中，页面收尾时画面是端正的
      var last = i === SEG.length - 1, kOut = last ? 0 : 1;
      var nearAt = function (fx, fy) {
        return { x: sh.qx + fx - geo.offX / sh.sn, y: sh.qy + fy - geo.offY / sh.sn };
      };
      var closeAt = function (fx) {
        return { x: sh.dx + fx - geo.offX / sh.sc, y: sh.dy - geo.offY / sh.sc };
      };
      // 近景：物件刚打开，铺满画面（有竖向溢出时先看上半）
      var n0 = nearAt(-dr.dx, -dr.dy - sh.ov);
      list.push({ p: rs, x: n0.x, y: n0.y, s: sh.sn, t: 0, r: 0 });
      // 快推特写 → 特写里顺着那行字慢慢移、再贴近一点 → 快拉回近景
      var c0 = closeAt(-sh.cd), c1 = closeAt(sh.cd);
      list.push({ p: S[i] + (g.a + g.c * CLOSE_IN) * L[i], x: c0.x, y: c0.y, s: sh.sc, t: 0, r: 0 });
      list.push({ p: S[i] + (g.a + g.c * CLOSE_HOLD) * L[i], x: c1.x, y: c1.y, s: sh.sc * 1.035, t: 0, r: 0 });
      var n1 = nearAt(-dr.dx * 0.35, -dr.dy * 0.35 - sh.ov);
      list.push({ p: S[i] + (g.a + g.c) * L[i], x: n1.x, y: n1.y, s: sh.sn, t: 0, r: 0 });
      // 近景阅读段：比例不变（字一直清楚），只沿去路方向慢慢滑；溢出时顺势看到下半
      var n2 = nearAt(dr.dx * kOut, dr.dy * kOut + sh.ov);
      list.push({ p: re, x: n2.x, y: n2.y, s: sh.sn, t: 0, r: 0 });
      if (i < SEG.length - 1) {
        var nx = P[i + 1], ddx = nx.x - P[i].x, ddy = nx.y - P[i].y;
        var nrs = S[i + 1] + SEG[i + 1].a * L[i + 1];
        var span = Math.min(geo.W / (Math.abs(ddx) + (geo.stW[i] + geo.stW[i + 1]) / 2 + 160),
          geo.H / (Math.abs(ddy) + (geo.stH[i] + geo.stH[i + 1]) / 2 + 120));
        list.push({
          p: (re + nrs) / 2,
          x: (P[i].x + nx.x) / 2, y: (P[i].y + nx.y) / 2,
          s: clamp(span, mob ? 0.52 : 0.4, mob ? 0.6 : 0.6),
          t: mob ? 10 : 15,
          r: (ddx >= 0 ? -1 : 1) * (mob ? 3 : 4.5)
        });
      }
    }

    var K = { p: list.map(function (k) { return k.p; }), v: {}, m: {} };
    CH.forEach(function (c) {
      K.v[c] = list.map(function (k) { return k[c]; });
      K.m[c] = slopes(K.p, K.v[c]);
    });
    geo.keys = K;
  }

  function camAt(p) {
    var K = geo.keys, ps = K.p, n = ps.length, out = {};
    if (p <= ps[0] || p >= ps[n - 1]) {
      var e = p <= ps[0] ? 0 : n - 1;
      CH.forEach(function (c) { out[c] = K.v[c][e]; });
      return out;
    }
    var k = 0;
    while (k < n - 2 && p >= ps[k + 1]) k++;
    var h = ps[k + 1] - ps[k], t = (p - ps[k]) / h, t2 = t * t, t3 = t2 * t;
    var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
    CH.forEach(function (c) {
      out[c] = h00 * K.v[c][k] + h10 * h * K.m[c][k] + h01 * K.v[c][k + 1] + h11 * h * K.m[c][k + 1];
    });
    return out;
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

    // 画面安全区：顶栏、右侧（或底部）进度标签不压字
    var topSafe = geo.mobile ? 54 : 62;
    var botSafe = geo.narrowTabs ? 84 : 22;
    var leftSafe = geo.mobile ? 2 : 24;
    var rightSafe = geo.mobile ? 2 : (geo.narrowTabs ? 24 : 120);
    var availH = Math.max(260, geo.H - topSafe - botSafe);
    var availW = Math.max(260, geo.W - leftSafe - rightSafe);
    geo.offX = (leftSafe - rightSafe) / 2;
    geo.offY = (topSafe - botSafe) / 2;
    geo.availW = availW;
    geo.availH = availH;
    // 世界原点落在整数像素上（375 宽时 50% = 187.5，会让整页字发虚）
    world.style.left = Math.floor(geo.W / 2) + 'px';
    world.style.top = Math.floor(geo.H / 2) + 'px';

    stations.forEach(function (st, i) {
      st.style.left = geo.pos[i].x + 'px';
      st.style.top = geo.pos[i].y + 'px';
      st.style.transform = '';
      geo.stW[i] = st.offsetWidth || 0;
      geo.stH[i] = st.offsetHeight || 0;
      var shEl = shadows[i];
      shEl.style.width = Math.round(geo.stW[i] * 0.9) + 'px';
      shEl.style.height = Math.round(geo.stH[i] * 0.84) + 'px';
    });

    // 近景与特写机位：近景让物件铺满安全区；特写推到一行字 / 一张照片上
    function relRect(el, st) {
      var x = 0, y = 0, n = el;
      while (n && n !== st) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
      if (n !== st) return null;
      // 块级标题的盒子是整行宽，特写要框的是字本身：临时收成 fit-content 量一下字宽（左对齐排版）
      var ww = el.offsetWidth;
      if (w.getComputedStyle(el).display === 'block') {
        var keep = el.style.width;
        el.style.width = 'fit-content';
        ww = el.offsetWidth || ww;
        el.style.width = keep;
      }
      return { x: x, y: y, w: ww, h: el.offsetHeight };
    }
    geo.shot = stations.map(function (st, i) {
      var sw = geo.stW[i], shh = geo.stH[i], g = SEG[i];
      var qx = geo.pos[i].x, qy = geo.pos[i].y;
      if (i === 0) return { qx: qx, qy: qy, sn: 1, sc: 1, ov: 0, dx: qx, dy: qy, dw: sw, dh: shh, cd: 0 };
      var sn = geo.mobile
        ? clamp(Math.min((geo.W - 4) / sw, (availH - 6) / shh), 1, 1.3)
        : clamp(Math.min((availW - 30) / sw, (availH - 26) / shh), 0.9, 1.55);
      sn = Math.round(sn * 100) / 100;
      var ov = Math.max(0, (shh * sn - (availH - 6)) / 2 / sn);
      // 特写目标：几个元素的并集矩形（布局坐标，不受动画中的 transform 影响）
      var sels = (geo.mobile ? g.mSel : g.dSel) || [];
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      sels.forEach(function (sel) {
        var el = st.querySelector(sel), rr = el && relRect(el, st);
        if (!rr || !rr.w) return;
        x0 = Math.min(x0, rr.x); y0 = Math.min(y0, rr.y);
        x1 = Math.max(x1, rr.x + rr.w); y1 = Math.max(y1, rr.y + rr.h);
      });
      if (x1 < x0) { x0 = sw * 0.3; x1 = sw * 0.7; y0 = shh * 0.3; y1 = shh * 0.6; }
      var dw = x1 - x0, dh = y1 - y0;
      var sc = Math.min(0.8 * availW / dw, 0.6 * availH / dh);
      sc = clamp(sc, sn * 1.35, geo.mobile ? 2.2 : 2.5);
      sc = Math.round(sc * 100) / 100;
      return {
        qx: qx, qy: qy, sn: sn, sc: sc, ov: ov,
        dx: qx - sw / 2 + (x0 + x1) / 2, dy: qy - shh / 2 + (y0 + y1) / 2,
        dw: dw, dh: dh, cd: Math.min(clamp(dw * 0.035, 3, 12), 16 / sc)
      };
    });

    // 近景阅读段里镜头继续滑移的幅度：沿“来路 → 去路”方向，按近景比例下的留白截断，保证文字不出画
    geo.drift = stations.map(function (st, i) {
      if (i === 0) return { dx: 0, dy: 0 };
      var prev = geo.pos[i - 1], next = geo.pos[Math.min(SEG.length - 1, i + 1)], cur = geo.pos[i];
      var vx = (i < SEG.length - 1 ? next.x : cur.x) - prev.x;
      var vy = (i < SEG.length - 1 ? next.y : cur.y) - prev.y;
      var vl = Math.hypot(vx, vy) || 1, sn = geo.shot[i].sn;
      var spareX = Math.max(0, ((availW - 12) / sn - geo.stW[i]) / 2);
      var spareY = geo.shot[i].ov > 0 ? 0 : Math.max(0, ((availH - 6) / sn - geo.stH[i]) / 2);
      var want = geo.mobile ? 30 : 60;
      return { dx: clamp(vx / vl * want, -spareX, spareX), dy: clamp(vy / vl * want, -spareY, spareY) };
    });

    // 手机：整体略短一点（同样的分镜比例）
    SEG.forEach(function (sg) {
      if (!sg.base) sg.base = { L: sg.L };
      sg.L = geo.mobile && sg.r > 0 ? sg.base.L - 0.15 : sg.base.L;
    });

    // DOF 遮罩的清晰区与取景框：按当前拍特写目标在屏上的大小
    lastShotBeat = -1;

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

    buildKeys(availH);

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

  /* 把滚动距离 p 映射为镜头（位置 / 远近 / 俯仰 / 侧倾）与 5 个物件的开合度 */
  function solveTimeline(p) {
    var clamped = clamp(p, 0, geo.total);
    var i = 0;
    while (i < SEG.length - 1 && clamped >= geo.starts[i + 1]) i++;
    var g = SEG[i];
    var u = clamp((clamped - geo.starts[i]) / (geo.lens[i] || 1), 0, 1);

    var open = [1, 0, 0, 0, 0];
    var focus = 0;
    var cam = camAt(clamped);

    // 桌面器物读数联动
    var temp = 350, heat = 0.35, sheen = 0, pulse = 0, volts = 3.30;

    if (i === 0) {
      heat = lerp(0.35, 0.92, u);
      temp = lerp(350, 344, u);
      focus = 0.15 * (1 - u);
    } else if (u < g.a) {
      var q = u / g.a;
      if (i - 1 > 0 && q < 0.3) open[i - 1] = 0.25 * (1 - q / 0.3);
      open[i] = easeOutCubic(clamp((q - 0.22) / 0.78, 0, 1));
      focus = open[i];
      if (i === 1) { temp = lerp(344, 350, q); heat = lerp(0.92, 0.42, q); }
      if (i === 2) { pulse = q; sheen = q; }
      if (i === 3) { volts = 3.30 + Math.sin(q * Math.PI) * 1.68; sheen = 1 - q; }
      if (i === 4) { volts = lerp(3.36, 3.30, q); }
    } else if (u <= g.a + g.c + g.r || g.x === 0) {
      open[i] = 1;
      focus = 1;
    } else {
      var ex = (u - g.a - g.c - g.r) / g.x;
      open[i] = 1 - 0.75 * easeInOutCubic(ex);
      focus = 1 - ex;
      if (i === 1) { pulse = ex * 0.4; }
      if (i === 2) { volts = lerp(3.30, 4.10, ex); }
    }

    // 特写程度：镜头从近景比例推到特写比例的进度（0 = 近景及更远，1 = 特写）
    var close = 0;
    if (i > 0 && geo.shot[i]) {
      var shI = geo.shot[i];
      close = clamp((cam.s - shI.sn) / ((shI.sc - shI.sn) || 1), 0, 1);
    }

    return {
      beat: i, u: u, p: clamped, close: close,
      camX: cam.x, camY: cam.y, camS: cam.s, camT: cam.t, camR: cam.r,
      open: open, focus: focus,
      temp: temp, heat: heat, sheen: sheen, pulse: pulse, volts: volts
    };
  }

  function applyState(st, v) {
    // 0) 惯性前倾：滑得越快镜头越往前探、略微拉远；停手后随惯性一起回正
    var vn = clamp((v || 0) / (2.4 * geo.H), -1, 1);
    var tilt = st.camT + vn * (geo.mobile ? 2.4 : 3.4);
    var sc = st.camS * (1 - 0.035 * Math.abs(vn));
    var rz = st.camR;

    // 1) 世界镜头变换：完全回正时落到整数像素平移，杜绝字体模糊
    if (Math.abs(tilt) < 0.02 && Math.abs(rz) < 0.02) {
      // 平视（近景 / 特写 / 首屏）：先缩放、后整数像素平移——停下来时每个字都落在像素格上
      var sq = Math.round(sc * 1e4) / 1e4;
      world.style.transform = 'translate3d(' + Math.round(-st.camX * sq) + 'px,' + Math.round(-st.camY * sq) + 'px,0)' +
        (Math.abs(sq - 1) < 0.0002 ? '' : ' scale(' + sq + ')');
    } else {
      world.style.transform = 'rotateX(' + tilt.toFixed(3) + 'deg) rotateZ(' + rz.toFixed(3) + 'deg) scale(' + sc.toFixed(4) + ') translate3d(' + (-st.camX).toFixed(1) + 'px,' + (-st.camY).toFixed(1) + 'px,0)';
    }

    // 1b) 光线与景深随镜头：拉远时远处起雾、上下缘虚化（移轴感），主光斑随镜头位置游移
    var away = clamp((1 - sc) / 0.6, 0, 1);
    var tiltK = clamp(tilt / 20, 0, 1);
    hazeEl.style.opacity = (tiltK * 0.72).toFixed(3);
    // 景深：拉远到一定程度后，离画面中心远的物件失焦；推近时全部清晰（带回差，避免来回闪）
    var halfDiag = Math.hypot(geo.W, geo.H) / 2;
    for (var f = 0; f < focusables.length; f++) {
      var fe = focusables[f];
      var fx = f < stations.length ? geo.pos[f].x : fe._wx;
      var fy = f < stations.length ? geo.pos[f].y : fe._wy;
      var soft = false;
      if (sc < 0.82 && fx != null) {
        var sd = Math.hypot(fx - st.camX, (fy - st.camY) * (1 + tiltK * 0.5)) * sc / halfDiag;
        var was = fe.classList.contains('is-soft');
        soft = sd > (was ? 0.5 : 0.56);
      }
      if (fe._soft !== soft) {
        fe._soft = soft;
        fe.classList.toggle('is-soft', soft);
      }
    }
    if (lightEl) {
      var lx = clamp(-st.camX * 0.05 - rz * 9, -120, 120);
      var ly = clamp(-st.camY * 0.04 + tilt * 3, -110, 110);
      lightEl.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      lightEl.style.opacity = (1 - 0.3 * away).toFixed(3);
    }
    focusMask.style.opacity = Math.min(1, st.focus * 0.55 + away * 0.6 + st.close * 0.45).toFixed(3);

    // 1d) 特写：浅景深（取景框外的画面虚掉）+ 取景框角标；顶栏状态同步“近景 / 特写”
    if (st.beat !== lastShotBeat) {
      lastShotBeat = st.beat;
      var shB = geo.shot[st.beat];
      if (shB && st.beat > 0) {
        var fw = Math.min(geo.W - 16, shB.dw * shB.sc + (geo.mobile ? 28 : 56));
        var fh = Math.min(geo.availH - 8, shB.dh * shB.sc + (geo.mobile ? 24 : 44));
        var fcx = Math.round(geo.W / 2 + geo.offX), fcy = Math.round(geo.H / 2 + geo.offY);
        R.style.setProperty('--fw', Math.round(fw) + 'px');
        R.style.setProperty('--fh', Math.round(fh) + 'px');
        R.style.setProperty('--fx', fcx + 'px');
        R.style.setProperty('--fy', fcy + 'px');
      }
    }
    var cl = st.close, clE = cl * cl * (3 - 2 * cl);
    if (dofEl) {
      if (clE < 0.01) {
        if (dofEl._on) { dofEl._on = false; dofEl.style.visibility = 'hidden'; dofEl.style.opacity = '0'; }
      } else {
        if (!dofEl._on) { dofEl._on = true; dofEl.style.visibility = 'visible'; }
        dofEl.style.opacity = clE.toFixed(3);
      }
    }
    if (frameEl) {
      var fk = clamp((cl - 0.55) / 0.45, 0, 1);
      if (fk < 0.01) {
        if (frameEl._on) { frameEl._on = false; frameEl.style.visibility = 'hidden'; }
      } else {
        if (!frameEl._on) { frameEl._on = true; frameEl.style.visibility = 'visible'; }
        frameEl.style.opacity = fk.toFixed(3);
        frameEl.style.transform = 'translate(-50%,-50%) scale(' + (1.05 - 0.05 * fk).toFixed(4) + ')';
      }
    }
    var shM = geo.shot[st.beat];
    var mode = cl > 0.6 ? 'close' : (st.beat > 0 && shM && st.camS >= shM.sn * 0.97 ? 'near' : 'move');
    if (mode !== shotMode || st.beat !== activeBeat) {
      shotMode = mode;
      var lbl = mode === 'close' && SEG[st.beat].close ? SEG[st.beat].close
        : (mode === 'near' ? '近景 · ' : '') + SEG[st.beat].name;
      statLabel.textContent = lbl;
      if (frameTag) frameTag.textContent = '特写';
      R.classList.toggle('is-closeup', mode === 'close');
    }

    // 1c) 物件柔影：打开 = 被拿起，影子拉长变淡并偏离；主光挂在镜头左上方，镜头一动影子方向跟着变
    var lampX = st.camX - 430, lampY = st.camY - 540;
    for (var k = 0; k < shadows.length; k++) {
      var lift = k === 0 ? 0.55 : st.open[k];
      var shEl = shadows[k];
      if (lift < 0.01) {
        if (shEl.style.opacity !== '0') shEl.style.opacity = '0';
        continue;
      }
      var px = geo.pos[k].x, py = geo.pos[k].y;
      var ddx = px - lampX, ddy = py - lampY, dl = Math.hypot(ddx, ddy) || 1;
      var off = 12 + 34 * lift;
      shEl.style.transform = 'translate3d(' + (px + ddx / dl * off).toFixed(1) + 'px,' + (py + ddy / dl * off).toFixed(1) + 'px,0) translate(-50%,-50%) scale(' + (0.95 + 0.07 * lift).toFixed(3) + ')';
      shEl.style.opacity = (0.34 * lift).toFixed(3);
    }

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
        var dl2 = geo.clipDeltas[idx] || { dx: 0, dy: 0 };
        var rot = (STACK_ROTS[idx] || 0) * inv;
        var sc2 = 1 - 0.08 * inv;
        c.style.transform = 'translate3d(' + (-dl2.dx * inv).toFixed(1) + 'px,' + (-dl2.dy * inv).toFixed(1) + 'px,0) rotate(' + rot.toFixed(2) + 'deg) scale(' + sc2.toFixed(3) + ')';
      });
      paperclip.style.transform = 'translate3d(' + (-34 * clOpen).toFixed(1) + 'px,' + (-26 * clOpen).toFixed(1) + 'px,0) rotate(' + (-28 * clOpen).toFixed(1) + 'deg)';
    }
    var ringDraw = clamp((clOpen - 0.45) / 0.55, 0, 1);
    clipRings.forEach(function (pth) {
      pth.style.strokeDashoffset = (280 * (1 - ringDraw)).toFixed(1);
    });
    stations[2].classList.toggle('is-open', clOpen > 0.85);

    // 4) 社团工牌（第 4 拍）：工牌 180° 3D 翻转（背面从 -90 -> 0deg 落位无镜像模糊），右侧老师部门卡滑出
    var bdOpen = st.open[3];
    if (bdOpen < 0.5) {
      var fDeg = bdOpen * 2 * 90;
      badgeFront.style.visibility = 'visible';
      badgeBack.style.visibility = 'hidden';
      badgeFront.style.transform = 'rotateY(' + fDeg.toFixed(2) + 'deg)';
    } else {
      var bDeg = (1 - bdOpen) * 2 * -90;
      badgeFront.style.visibility = 'hidden';
      badgeBack.style.visibility = 'visible';
      badgeBack.style.transform = bdOpen >= 0.998 ? '' : ('rotateY(' + bDeg.toFixed(2) + 'deg)');
    }
    // 社长照片：始终全彩；入场只用“由上往下揭开 + 轻微压暗退去 + 微微缩回”
    if (avatarBox) {
      var av = easeOutCubic(clamp((bdOpen - 0.5) / 0.5, 0, 1));
      var avQ = Math.round(av * 400) / 400;
      if (avQ !== lastAvatar) {
        lastAvatar = avQ;
        if (avQ >= 0.998) {
          avatarBox.style.clipPath = '';
          avatarBox.style.setProperty('--shade', '0');
          if (avatarImg) avatarImg.style.transform = '';
        } else {
          avatarBox.style.clipPath = 'inset(0 0 ' + ((1 - avQ) * 100).toFixed(1) + '% 0 round 6px)';
          avatarBox.style.setProperty('--shade', ((1 - avQ) * 0.32).toFixed(3));
          if (avatarImg) avatarImg.style.transform = 'translate3d(0,' + ((1 - avQ) * -10).toFixed(1) + 'px,0) scale(' + (1 + 0.12 * (1 - avQ)).toFixed(3) + ')';
        }
      }
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
      tabBtns.forEach(function (btn, kk) {
        var cur = kk === activeBeat;
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
    // 后台标签页或无头浏览器 rAF 节流兜底：90ms 未执行则直接推进一帧
    clearTimeout(tmoId);
    tmoId = setTimeout(function () {
      if (rafId) {
        w.cancelAnimationFrame(rafId);
        rafId = 0;
        tick(w.performance ? performance.now() : Date.now());
      }
    }, 90);
  }

  /* 临界阻尼弹簧（smooth-damp）：镜头有起步加速、停手后的顺势滑行与平稳落定，不会回弹过冲 */
  function tick(now) {
    rafId = 0;
    clearTimeout(tmoId);
    targetP = clamp(currentScrollP(), 0, geo.total);

    var dtMs = lastTs ? (now - lastTs) : 16;
    lastTs = now;

    if (!initedP || dtMs > 260) {
      dispP = targetP;
      vel = 0;
      initedP = true;
    } else {
      var dt = clamp(dtMs, 4, 64) / 1000;
      var omega = 2 / SMOOTH, xx = omega * dt;
      var ex = 1 / (1 + xx + 0.48 * xx * xx + 0.235 * xx * xx * xx);
      var change = dispP - targetP;
      var tmp = (vel + omega * change) * dt;
      vel = (vel - omega * tmp) * ex;
      dispP = targetP + (change + tmp) * ex;
      if (Math.abs(targetP - dispP) < 0.3 && Math.abs(vel) < 8) {
        dispP = targetP;
        vel = 0;
      }
    }

    var moving = dispP !== targetP || vel !== 0;
    // 镜头一动就恢复合成层（流畅）；停稳 160ms 后按当前比例重新栅格化（清晰）
    if (moving) {
      clearTimeout(restTmo);
      restTmo = 0;
      if (resting) { resting = false; R.classList.remove('cam-rest'); }
    }

    applyState(solveTimeline(dispP), vel);

    if (moving) {
      kick();
    } else {
      lastTs = 0;
      if (!resting && !restTmo) {
        restTmo = setTimeout(function () {
          restTmo = 0;
          resting = true;
          R.classList.add('cam-rest');
        }, 160);
      }
    }
  }

  function beatTargetY(idx) {
    idx = clamp(idx, 0, SEG.length - 1);
    if (idx === 0) return geo.top;
    return Math.round(geo.top + geo.starts[idx] + (SEG[idx].a + SEG[idx].c + SEG[idx].r * 0.5) * geo.lens[idx]);
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

  // 调试：?debug 时暴露镜头求解，便于画出“滚动进度 → 镜头参数”曲线
  if (params.has('debug')) {
    w.__desk = { solve: solveTimeline, geo: geo, apply: function (p) { applyState(solveTimeline(p), 0); } };
  }

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
