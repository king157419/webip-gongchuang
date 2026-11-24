/* ==========================================================================
 * v22-ticket · 上海大学人工智能社 · 活动票根（滑动 = 拉出立体票卷，沿齿孔线撕下）
 * - 纯原生 JS + Canvas 2D，零外部依赖，数据全部读取 window.CLUB
 * - 原生滚动驱动，不拦截 wheel / touchmove，不使用 scroll-snap
 * - prefers-reduced-motion 或初始化异常自动退回普通分节票据页
 * - 调试参数：?at=像素  |  ?beat=0..4（可读段） |  ?pull=1..4（撕裂瞬间） |  ?flat=1
 * ========================================================================== */
(function () {
  'use strict';

  var CLUB = window.CLUB || {};
  var doc = document;
  var root = doc.documentElement;
  var M = Math;

  function $(sel, ctx) { return (ctx || doc).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function seg(v, a, b) { return b - a < 1e-6 ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a), 0, 1); }
  function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - M.pow(1 - t, 3); }
  function easeInOutCubic(t) {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - M.pow(-2 * t + 2, 3) / 2;
  }

  /* 确定性哈希（用于条码与纸屑轨迹，往回滑可精确倒放） */
  function hashStr(s) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = M.imul(h, 16777619) >>> 0;
    }
    return h;
  }
  function hash01(seed) {
    var t = (seed + 0x6D2B79F5) | 0;
    t = M.imul(t ^ (t >>> 15), 1 | t);
    t = (t + M.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /* 生成 Code-128 风格高对比矢量条码 SVG */
  function makeBarcodeSVG(code) {
    var h = hashStr(String(code || 'SHU'));
    var x = 0;
    var rects = ['<rect x="0" y="0" width="2" height="24"/><rect x="3.5" y="0" width="1" height="24"/>'];
    x = 6.5;
    for (var i = 0; i < 24; i++) {
      var r = hash01(h + i * 97);
      var w = r < 0.42 ? 1 : r < 0.78 ? 2 : 3;
      var g = hash01(h + i * 193) < 0.55 ? 1.2 : 2.2;
      rects.push('<rect x="' + x.toFixed(1) + '" y="0" width="' + w + '" height="24"/>');
      x += w + g;
    }
    rects.push('<rect x="' + x.toFixed(1) + '" y="0" width="1.2" height="24"/>');
    x += 2.6;
    rects.push('<rect x="' + x.toFixed(1) + '" y="0" width="2.2" height="24"/>');
    x += 2.2;
    return '<svg viewBox="0 0 ' + x.toFixed(1) + ' 24" preserveAspectRatio="none" fill="#151412" focusable="false" aria-hidden="true">' +
      rects.join('') + '</svg>';
  }

  /* ==================== 1. 渲染 window.CLUB 真实数据 ==================== */
  var WX_NAME = '上海大学通信学院';

  /* 五类活动精炼一句话（严格依据 CLUB.programs，零编造） */
  var PROG_SHORT = {
    weld: '从焊好一个点到焊好一根线，学长学姐现场一对一指导。',
    course: '与华为智能基座合作：MindSpore、Transformer 与 BERT 微调。',
    visit: '走进华为全联接大会、鸿蒙生态学堂与鲲鹏开发者众测。',
    contest: '连续协办上海大学人工智能创新大赛，从报名到决赛答辩。',
    talk: '邀请学长学姐讲科研、讲论文、讲保研与项目经验。'
  };

  /* 挑选最有分量的 5 篇官网报道（全部对应 CLUB.news 真实日期、地点、规模） */
  var NEWS_PICKS = [
    {
      date: '2026-05-11',
      when: '2026.05.09–10',
      where: '宝山 GJ204',
      stat: '40 余人入选',
      shortTitle: '联合华为举办昇腾 AI 大模型创新实践课',
      note: '华为昇腾工程师授课，完成 Transformer 开发与 BERT 微调实验。'
    },
    {
      date: '2026-04-13',
      when: '2026.04.10',
      where: '翔英大楼 T608',
      stat: '连续三年协办',
      shortTitle: '协办上海大学 2025 年人工智能创新大赛决赛',
      note: '本科生院联合主办、通信学院承办、人工智能社团协办。'
    },
    {
      date: '2025-11-06',
      when: '2025.11.01',
      where: '翔英大楼 406',
      stat: '报名百余人',
      shortTitle: '协办本科生创新技能大赛焊接专项赛',
      note: '设电路焊接与 Vibe Coding 双赛道。'
    },
    {
      date: '2024-12-09',
      when: '2024.12.06',
      where: '宝山 CJ203',
      stat: '近 200 人参加',
      shortTitle: 'AI 系列课：本科阶段撰写顶级论文经验分享',
      note: '三位学长分享选导师、做科研与发表论文经验。'
    },
    {
      date: '2024-09-24',
      when: '2024.09',
      where: '上海世博中心',
      stat: '百余名学子',
      shortTitle: '组织上大学子参观 2024 华为全联接大会',
      note: '学院副院长陈涛与指导老师吴静共同出席。'
    }
  ];

  function ymdDot(s) { return String(s || '').replace(/-/g, '.'); }

  function renderAllContent() {
    var meta = CLUB.meta || {};
    var programs = CLUB.programs || [];
    var news = CLUB.news || [];
    var people = CLUB.people || {};
    var join = CLUB.join || {};
    var depts = meta.departments || [];

    if (meta.contact && meta.contact.wechat) {
      var parsed = String(meta.contact.wechat).replace(/（[^）]*）|\([^)]*\)/g, '').trim();
      if (parsed) WX_NAME = parsed;
    }

    /* ① 首屏元数据 */
    var founded = meta.founded || 2021;
    var heroYear = $('#heroYear');
    if (heroYear) heroYear.textContent = founded + ' 成立';
    var heroType = $('#heroType');
    if (heroType && meta.type) heroType.textContent = meta.type;
    var heroMeta = $('#heroMeta');
    if (heroMeta) {
      heroMeta.innerHTML =
        '<div><dt>挂靠单位</dt><dd>' + esc(meta.host || '通信与信息工程学院团委') + '</dd></div>' +
        '<div><dt>成立与架构</dt><dd>' + esc(founded + ' 年成立 · ' + (depts.length || 4) + ' 个部门') + '</dd></div>' +
        '<div><dt>常驻场地</dt><dd>宝山校区 翔英大楼</dd></div>';
    }

    /* ② 平时做什么：5 张小票 */
    var progList = $('#progList');
    if (progList) {
      progList.innerHTML = programs.map(function (p, idx) {
        var code = '02-' + (idx + 1);
        var desc = PROG_SHORT[p.id] || String(p.desc || '').split(/[；。]/)[0] + '。';
        return '<li class="voucher" data-sub="' + idx + '">' +
          '<div class="voucher__idx"><b>0' + (idx + 1) + '</b><span>№' + code + '</span></div>' +
          '<div class="voucher__main"><h3>' + esc(p.name) + '</h3><p>' + esc(desc) + '</p></div>' +
          '<div class="voucher__side">' +
            '<span class="voucher__where">' + esc(p.where || '翔英大楼') + '</span>' +
            '<span class="v-bar">' + makeBarcodeSVG('PROG-' + p.id + '-' + idx) + '</span>' +
          '</div>' +
        '</li>';
      }).join('');
    }

    /* ③ 做过的事：5 张报道票 + 全部 16 篇 */
    var totalNews = news.length || 16;
    var newsSub = $('#newsSub');
    if (newsSub) {
      newsSub.textContent = '学院官网 ' + totalNews + ' 篇报道（2022–2026），点票看原文。';
    }
    var openAllBtn = $('#openAllNews');
    if (openAllBtn) openAllBtn.textContent = '全部 ' + totalNews + ' 篇报道 →';
    var modalTitle = $('#modalTitle');
    if (modalTitle) modalTitle.textContent = '全部 ' + totalNews + ' 篇官网报道存根';

    var pickedItems = [];
    NEWS_PICKS.forEach(function (pk) {
      var found = null;
      for (var i = 0; i < news.length; i++) {
        if (news[i].date === pk.date) { found = news[i]; break; }
      }
      if (found) pickedItems.push({ raw: found, pk: pk });
    });
    for (var k = 0; pickedItems.length < 5 && k < news.length; k++) {
      var exists = pickedItems.some(function (x) { return x.raw === news[k]; });
      if (!exists) {
        pickedItems.push({
          raw: news[k],
          pk: {
            when: ymdDot(news[k].date),
            where: '上海大学',
            stat: '官网报道',
            shortTitle: news[k].title,
            note: news[k].summary || ''
          }
        });
      }
    }

    var newsPicks = $('#newsPicks');
    if (newsPicks) {
      newsPicks.innerHTML = pickedItems.map(function (item, idx) {
        var r = item.raw, pk = item.pk;
        return '<li data-sub="' + idx + '">' +
          '<a class="rstub" href="' + esc(r.source) + '" target="_blank" rel="noopener" aria-label="' +
            esc(pk.when + ' ' + pk.shortTitle + '（打开通信学院官网原文）') + '">' +
            '<div class="rstub__top">' +
              '<span class="rstub__date">' + esc(pk.when) + '</span>' +
              '<span class="rstub__where">· ' + esc(pk.where) + '</span>' +
              '<span class="rstub__stat">' + esc(pk.stat) + '</span>' +
            '</div>' +
            '<div>' +
              '<h3 class="rstub__title">' + esc(pk.shortTitle) + '</h3>' +
              (idx === 0 && pk.note ? '<p class="rstub__note">' + esc(pk.note) + '</p>' : '') +
            '</div>' +
            '<div class="rstub__go">' +
              '<span>原文 ↗</span>' +
              '<span class="r-bar">' + makeBarcodeSVG(r.date + '-' + idx) + '</span>' +
            '</div>' +
          '</a>' +
        '</li>';
      }).join('');
    }

    var allNewsList = $('#allNewsList');
    if (allNewsList) {
      allNewsList.innerHTML = news.map(function (n, idx) {
        var num = (idx + 1 < 10 ? '0' : '') + (idx + 1);
        return '<li>' +
          '<a class="modal__item" href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
            '<span class="modal__date">#' + num + ' · ' + esc(ymdDot(n.date)) + '</span>' +
            '<span class="modal__main"><strong>' + esc(n.title) + '</strong><p>' + esc(n.summary) + '</p></span>' +
            '<span class="modal__link">查看原文 ↗</span>' +
          '</a>' +
        '</li>';
      }).join('');
    }

    /* ④ 谁在带大家：嘉宾证 */
    var passBody = $('#passBody');
    if (passBody) {
      var leader = (people.leaders || [])[0] || {};
      var teachers = people.teachers || [];
      var photoSrc = leader.photo ? '../shared/img/' + leader.photo : '';
      var awardsHTML = (leader.awards || []).map(function (a) {
        return '<li>' + esc(a) + '</li>';
      }).join('');

      var teachersHTML = teachers.map(function (t) {
        var roleClean = String(t.role || '指导老师').replace(/^指导老师\s*·\s*/, '');
        return '<div class="adv-item">' +
          '<strong>' + esc(t.name) + '</strong><span>指导老师 · ' + esc(roleClean) + '</span>' +
          '<p>' + esc(t.desc) + '</p>' +
        '</div>';
      }).join('');

      var deptHTML = depts.map(function (dItem) {
        return '<li><b>' + esc(dItem.name) + '</b><span>' + esc(dItem.desc) + '</span></li>';
      }).join('');

      passBody.innerHTML =
        '<div class="pass-lead">' +
          '<div class="pass-photo">' +
            (photoSrc ? '<img src="' + esc(photoSrc) + '" alt="' + esc((leader.role || '社长') + leader.name + '照片') + '" width="208" height="264">' : '') +
            '<span class="pass-photo__stamp">' + esc(leader.role || '社长') + '</span>' +
          '</div>' +
          '<div class="pass-who">' +
            '<p class="pass-who__role">学生负责人 · 通信学院电子信息工程</p>' +
            '<h3 class="pass-who__name">' + esc(leader.name || '任捷') + '</h3>' +
            '<p class="pass-who__desc">关注集成电路、FPGA 与 AI 实践，主讲秋季焊接课。</p>' +
            (awardsHTML ? '<ul class="pass-awards">' + awardsHTML + '</ul>' : '') +
          '</div>' +
        '</div>' +
        '<div class="pass-advisors">' +
          '<div>' +
            '<p class="adv-block__h">指导老师</p>' +
            teachersHTML +
          '</div>' +
          '<div>' +
            '<p class="adv-block__h">下设 ' + (depts.length || 4) + ' 个部门</p>' +
            '<ul class="dept-pills">' + deptHTML + '</ul>' +
          '</div>' +
        '</div>';
    }

    /* ⑤ 怎么加入：三步 + 公众号按钮 */
    var joinWhere = $('#joinWhere');
    if (joinWhere && meta.location) {
      joinWhere.textContent = '常驻：' + meta.location;
    }
    var joinSteps = $('#joinSteps');
    if (joinSteps) {
      joinSteps.innerHTML = (join.steps || []).map(function (s, i) {
        return '<li><b>0' + (i + 1) + '</b><div><strong>' + esc(s.t) + '</strong><span>' + esc(s.d) + '</span></div></li>';
      }).join('');
    }
    var copyBtn = $('#copyBtn');
    if (copyBtn) copyBtn.textContent = '复制公众号名：' + WX_NAME;

    /* 页脚 FAQ 与档案 */
    var faqList = $('#faqList');
    if (faqList) {
      faqList.innerHTML = (join.faq || []).map(function (f) {
        return '<dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd>';
      }).join('');
    }
    var archList = $('#archList');
    if (archList) {
      var rows = [
        ['社团全称', meta.name],
        ['社团类型', meta.type],
        ['挂靠单位', meta.host],
        ['成立年份', founded + ' 年'],
        ['面向人群', meta.audience],
        ['常驻地点', meta.location],
        ['官方报道', '通信学院官网累计 ' + totalNews + ' 篇（2022–2026）'],
        ['招新入口', '微信公众号「' + WX_NAME + '」']
      ];
      archList.innerHTML = rows.filter(function (r) { return r[1]; }).map(function (r) {
        return '<li><span>' + esc(r[0]) + '</span><b>' + esc(r[1]) + '</b></li>';
      }).join('');
    }

    /* 渲染静态条码占位 */
    $$('[data-barcode]').forEach(function (el) {
      el.innerHTML = makeBarcodeSVG(el.getAttribute('data-barcode'));
    });
  }

  /* ==================== 2. 交互绑定（复制公众号 / 弹窗 / 跳拍） ==================== */
  var scrollToBeatFn = null;

  function copyWechat() {
    var ok = false;
    var ta = doc.createElement('textarea');
    ta.value = WX_NAME;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;';
    doc.body.appendChild(ta);
    try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
    ta.select();
    try {
      ta.setSelectionRange(0, ta.value.length);
      ok = doc.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    doc.body.removeChild(ta);

    var msg = $('#copyMsg');
    if (msg) {
      msg.textContent = ok
        ? '已复制「' + WX_NAME + '」——打开微信搜索关注，挑一场活动直接来！'
        : '微信里搜索：' + WX_NAME;
      msg.classList.add('is-ok');
    }
    var seal = $('#issuedSeal');
    if (seal) seal.classList.add('is-stamped');
  }

  function bindUI() {
    var copyBtn = $('#copyBtn');
    if (copyBtn) copyBtn.addEventListener('click', copyWechat);

    var holderInput = $('#holderInput');
    if (holderInput) {
      holderInput.addEventListener('input', function () {
        var seal = $('#issuedSeal');
        var v = holderInput.value.trim();
        var bbar = $('.blank-bar');
        if (bbar) bbar.innerHTML = makeBarcodeSVG('SHU-AI-NO5-' + (v || 'JOIN'));
        if (!seal) return;
        if (v) {
          seal.innerHTML = '已签发<br>翔英见';
          seal.classList.add('is-stamped');
        }
      });
    }

    /* 全部 16 篇报道弹窗 */
    var modal = $('#newsModal');
    var openBtn = $('#openAllNews');
    var closeBtn = $('#closeModal');
    var lastFocus = null;

    function openModal() {
      if (!modal) return;
      lastFocus = doc.activeElement;
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
      if (closeBtn) closeBtn.focus();
    }
    function closeModal() {
      if (!modal) return;
      if (typeof modal.close === 'function' && modal.open) modal.close();
      else modal.removeAttribute('open');
      if (lastFocus && typeof lastFocus.focus === 'function') {
        try { lastFocus.focus({ preventScroll: true }); } catch (e) { lastFocus.focus(); }
      }
    }
    if (openBtn) openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === modal) closeModal();
      });
    }

    /* 跳拍按钮（顶部怎么加入 / 首屏按钮 / 右侧或底部 No.1–No.5） */
    doc.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-go]');
      if (!btn) return;
      var idx = parseInt(btn.getAttribute('data-go'), 10);
      if (isNaN(idx)) return;
      e.preventDefault();
      if (scrollToBeatFn) {
        scrollToBeatFn(idx);
      } else {
        var ids = ['top', 'programs', 'news', 'people', 'join'];
        var target = doc.getElementById(ids[idx] || 'top');
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  /* ==================== 3. 吸顶舞台：立体票卷 + 拉出撕下引擎 ==================== */
  var STUB_META = [
    { no: 'No.1', name: '社团入场券' },
    { no: 'No.2', name: '日常活动票' },
    { no: 'No.3', name: '官网报道票' },
    { no: 'No.4', name: '带队嘉宾证' },
    { no: 'No.5', name: '你的入社票' }
  ];

  function initLiveStage() {
    var track = $('#track');
    var stage = $('#stage');
    var desk = $('#desk');
    var cvRoll = $('#cvRoll');
    var cvFx = $('#cvFx');
    if (!track || !stage || !desk || !cvRoll || !cvFx) throw new Error('DOM missing');

    var gR = cvRoll.getContext('2d');
    var gF = cvFx.getContext('2d');
    if (!gR || !gF) throw new Error('Canvas 2D unavailable');

    var beatEls = $$('.beat', desk);
    var clipEls = beatEls.map(function (b) { return $('.feed-clip', b); });
    var cardEls = beatEls.map(function (b, i) { return $('#card' + i, b); });
    var railBtns = $$('.rail__btn');
    var topNow = $('#topNow');

    /* 节拍权重：
       Beat 0: 0..0.58 停住可读，0.58..1.00 撕下归档（首屏免滑立即可读）
       Beat 1..3: 0..0.40 拉出并撕下（40%） → 0.40..0.85 停住可读（45%） → 0.85..1.00 归档过渡（15%）
       Beat 4: 0..0.42 拉出并撕下（约 40%） → 0.42..1.00 停住可读直至滚入页脚 */
    var SPANS = [0.76, 1.0, 1.0, 1.0, 0.94];
    var CUM = [0];
    for (var s = 0; s < SPANS.length; s++) CUM.push(CUM[s] + SPANS[s]);
    var TOTAL_U = CUM[CUM.length - 1]; // 4.70

    var W = 0, H = 0, dpr = 1, isMob = false;
    var trackTop = 0, maxScroll = 1;
    var deskRect = { left: 360, top: 56, width: 800, height: 760 };
    var cardSizes = [];

    var grainPattern = null;
    var paperPattern = null;
    var stubHitBoxes = [];
    var rollHitBox = null;
    var hoverRoll = false;
    var isHeadless = /Headless/i.test(navigator.userAgent || '');
    var virtP = null;
    var scrollFbTimer = 0;

    var targetP = 0;   // 0 .. TOTAL_U
    var curP = 0;
    var ptr = { x: 0, y: 0, tx: 0, ty: 0, active: false };
    var activeIdx = -1;
    var rafId = 0;
    var inView = true;
    var pageHidden = false;

    /* 预烘焙桌面胶片颗粒与票纸纤维纹理（仅初始化执行一次） */
    function buildPatterns() {
      var c1 = doc.createElement('canvas');
      c1.width = 96; c1.height = 96;
      var x1 = c1.getContext('2d');
      var img1 = x1.createImageData(96, 96);
      for (var i = 0; i < img1.data.length; i += 4) {
        var v = hash01(i * 17 + 31) > 0.5 ? 255 : 0;
        img1.data[i] = v;
        img1.data[i + 1] = v;
        img1.data[i + 2] = v;
        img1.data[i + 3] = 9;
      }
      x1.putImageData(img1, 0, 0);
      grainPattern = gR.createPattern(c1, 'repeat');

      var c2 = doc.createElement('canvas');
      c2.width = 64; c2.height = 64;
      var x2 = c2.getContext('2d');
      x2.fillStyle = '#f3ede0';
      x2.fillRect(0, 0, 64, 64);
      for (var j = 0; j < 140; j++) {
        var px = hash01(j * 41) * 64;
        var py = hash01(j * 83) * 64;
        x2.fillStyle = j % 2 ? 'rgba(21,20,18,0.035)' : 'rgba(255,255,255,0.38)';
        x2.fillRect(px, py, 2, 1);
      }
      paperPattern = gR.createPattern(c2, 'repeat');
    }

    function measure() {
      W = stage.clientWidth || window.innerWidth;
      H = stage.clientHeight || window.innerHeight;
      isMob = W < 900;
      dpr = isMob ? 1 : M.min(window.devicePixelRatio || 1, 1.5);

      cvRoll.width = M.round(W * dpr);
      cvRoll.height = M.round(H * dpr);
      cvFx.width = M.round(W * dpr);
      cvFx.height = M.round(H * dpr);

      var unitPx = isMob ? M.max(660, M.round(H * 1.02)) : M.max(780, M.round(H * 1.12));
      var trackH = M.round(H + TOTAL_U * unitPx);
      track.style.height = trackH + 'px';

      var trRect = track.getBoundingClientRect();
      trackTop = trRect.top + (window.pageYOffset || doc.documentElement.scrollTop || 0);
      maxScroll = M.max(1, trackH - H);

      var dRect = desk.getBoundingClientRect();
      var stRect = stage.getBoundingClientRect();
      deskRect = {
        left: dRect.left - stRect.left,
        top: dRect.top - stRect.top,
        width: dRect.width,
        height: dRect.height
      };

      cardSizes = cardEls.map(function (el) {
        if (!el) return { w: 680, h: 380 };
        return {
          w: el.offsetWidth || deskRect.width,
          h: el.offsetHeight || 360
        };
      });
    }

    function readScrollProgress() {
      if (virtP !== null) return virtP;
      var sy = window.pageYOffset || doc.documentElement.scrollTop || 0;
      var raw = clamp((sy - trackTop) / maxScroll, 0, 1);
      return raw * TOTAL_U;
    }

    function getBeatReadableU(idx) {
      idx = clamp(idx, 0, 4);
      var localTarget = idx === 0 ? 0 : (idx === 4 ? 0.62 : 0.58);
      return CUM[idx] + SPANS[idx] * localTarget;
    }

    /* 计算跳往某一拍“停住可读段”中心的精确 scrollY */
    function getBeatReadableScrollY(idx) {
      return M.round(trackTop + (getBeatReadableU(idx) / TOTAL_U) * maxScroll);
    }

    scrollToBeatFn = function (idx) {
      virtP = null;
      var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({
        top: getBeatReadableScrollY(idx),
        behavior: rm ? 'auto' : 'smooth'
      });
    };

    /* 由全局进度 p (0..TOTAL_U) 解析当前节拍 b 与节内进度 u (0..1) */
    function resolveBeat(p) {
      p = clamp(p, 0, TOTAL_U);
      for (var i = 0; i < SPANS.length; i++) {
        if (p <= CUM[i + 1] || i === SPANS.length - 1) {
          var u = SPANS[i] > 0 ? clamp((p - CUM[i]) / SPANS[i], 0, 1) : 0;
          return { b: i, u: u };
        }
      }
      return { b: 4, u: 1 };
    }

    /* 更新进度导航与可访问状态 */
    function setActiveBeatUI(b) {
      if (b === activeIdx) return;
      activeIdx = b;
      if (topNow) topNow.textContent = 'No.' + (b + 1);
      railBtns.forEach(function (btn, i) {
        var on = i === b;
        btn.classList.toggle('is-on', on);
        if (on) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });
      beatEls.forEach(function (el, i) {
        var on = i === b;
        el.classList.toggle('is-active', on);
        if ('inert' in el) el.inert = !on;
      });
    }

    /* 计算累计拉纸行程，使立体票卷角度严格跟手且单调可逆 */
    function computeRollAngle(p) {
      var angle = 0.4;
      for (var i = 0; i < 5; i++) {
        var u = clamp((p - CUM[i]) / SPANS[i], 0, 1);
        if (i === 0) {
          angle += sm(seg(u, 0.0, 0.72)) * 0.45;
        } else {
          angle += sm(seg(u, 0.0, 0.30)) * 2.55;
        }
      }
      return angle;
    }

    /* ==================== 绘制桌面端：立式 3/4 透视立体票卷 ==================== */
    function drawDesktopStage(p, st) {
      var b = st.b, u = st.u;
      var cardSz = cardSizes[b] || { w: 720, h: 380 };

      /* 桌面背景与微弱裁切标尺 */
      gR.fillStyle = '#141413';
      gR.fillRect(0, 0, W, H);

      var spot = gR.createRadialGradient(W * 0.44, H * 0.46, 30, W * 0.44, H * 0.46, W * 0.65);
      spot.addColorStop(0, 'rgba(245, 236, 218, 0.055)');
      spot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      gR.fillStyle = spot;
      gR.fillRect(0, 0, W, H);

      if (grainPattern) {
        gR.fillStyle = grainPattern;
        gR.fillRect(0, 0, W, H);
      }

      /* 裁切垫细刻度线 */
      gR.strokeStyle = 'rgba(242, 236, 224, 0.032)';
      gR.lineWidth = 1;
      var gridStep = 64;
      gR.beginPath();
      for (var gx = gridStep; gx < W; gx += gridStep) {
        gR.moveTo(gx + 0.5, 50);
        gR.lineTo(gx + 0.5, H);
      }
      for (var gy = 80; gy < H; gy += gridStep) {
        gR.moveTo(0, gy + 0.5);
        gR.lineTo(W, gy + 0.5);
      }
      gR.stroke();

      /* 几何锚点：立体票卷与右侧票面严格同中轴线对齐，出纸口位于圆柱右缘切线 */
      var deskCenterY = M.round(deskRect.top + deskRect.height * 0.5);
      var rollProgress = clamp(p / TOTAL_U, 0, 1);
      var R = lerp(84, 62, rollProgress);        // 票卷随撕票真实变薄
      var rCore = 28;                            // 中心牛皮纸筒内径
      var ry = R * 0.35;                         // 顶面椭圆透视短轴
      var tearBaseX = deskRect.left - 28;
      var cx = M.max(106, M.min(168, tearBaseX - R - 116));
      var exitX = cx + R - 2;                    // 出纸口紧贴圆柱右侧轮廓，存根文字绝不被遮挡
      var rollH = clamp(H * 0.36, 236, 326);
      var cyTop = M.round(deskCenterY - rollH * 0.5);
      var cyBot = cyTop + rollH;
      var stripTop = cyTop + 8;
      var stripH = rollH - 16;
      var rollAngle = computeRollAngle(p);

      rollHitBox = { x: cx - R - 6, y: cyTop - ry - 8, w: R * 2 + 12, h: rollH + ry * 2 + 16 };

      /* 计算当前拍动作（40%）→ 停住可读（45%）→ 归档过渡（15%）参数 */
      var pullP = 1, tearP = 0, settleP = 0, stackP = 0;
      if (b === 0) {
        pullP = 1;
        tearP = seg(u, 0.54, 0.74);
        settleP = 1;
        stackP = easeInOutCubic(seg(u, 0.75, 1.0));
      } else if (b < 4) {
        pullP = easeOutCubic(seg(u, 0.0, 0.27));
        tearP = seg(u, 0.27, 0.39);
        settleP = easeOutCubic(seg(u, 0.28, 0.40));
        stackP = easeInOutCubic(seg(u, 0.85, 1.0));
      } else {
        pullP = easeOutCubic(seg(u, 0.0, 0.27));
        tearP = seg(u, 0.27, 0.39);
        settleP = easeOutCubic(seg(u, 0.28, 0.40));
        stackP = 0;
      }

      /* 统一物理拉纸撕线坐标 perfX 与存根前缘 stubEndX：
         拉出阶段票面先滚出圆柱切口，撕线携整枚骑缝章随后滚出至 tearBaseX；
         撕裂瞬间骑缝章一分为二，存根向左回弹露出锯齿毛边，票面落位静止。 */
      var activeTearX = b === 0 ? deskRect.left : tearBaseX;
      var tensionStretch = (b === 0 ? sm(seg(u, 0.30, 0.54)) : sm(seg(u, 0.20, 0.27))) * (1 - sm(tearP * 2)) * 5;
      var stubEndX = exitX;
      var pullPerfX = activeTearX;

      if (b === 0) {
        var recoil0 = sm(seg(tearP, 0.35, 1.0)) * 28;
        var retract0 = sm(stackP) * 64;
        stubEndX = M.max(exitX + 12, activeTearX + tensionStretch - recoil0 - retract0);
      } else if (u < 0.27) {
        pullPerfX = lerp(exitX - cardSz.w * 0.68, activeTearX, pullP);
        stubEndX = M.max(exitX, pullPerfX + tensionStretch);
      } else {
        var recoil = sm(seg(tearP, 0.35, 1.0)) * 24;
        var retract = sm(stackP) * 56;
        stubEndX = M.max(exitX + 12, activeTearX + tensionStretch - recoil - retract);
      }

      /* ---------- A. 左下角：已撕票根归档托盘（与圆柱底影留足间距） ---------- */
      var trayW = 178, trayH = 80;
      var trayX = M.max(26, cx - 88);
      var trayY = clamp(M.round(cyBot + ry + 46), 560, H - trayH - 18);

      gR.save();
      gR.fillStyle = 'rgba(14, 14, 13, 0.55)';
      gR.fillRect(trayX, trayY, trayW, trayH);
      gR.strokeStyle = 'rgba(242, 236, 224, 0.2)';
      gR.setLineDash([4, 4]);
      gR.strokeRect(trayX, trayY, trayW, trayH);
      gR.setLineDash([]);
      gR.fillStyle = 'rgba(242, 236, 224, 0.68)';
      gR.font = '600 11px "Geist Mono", "PingFang SC", sans-serif';
      var stackedCount = b + (stackP > 0.78 ? 1 : 0);
      gR.fillText('已撕存根 · ' + stackedCount + ' / 4', trayX + 4, trayY - 8);

      stubHitBoxes = [];
      for (var k = 0; k < 4; k++) {
        var showAmt = k < b ? 1 : (k === b ? seg(stackP, 0.65, 1.0) : 0);
        if (showAmt <= 0.01) continue;
        gR.save();
        var sx = trayX + 12 + k * 7;
        var sy = trayY + 12 + (k % 2) * 5 - (1 - sm(showAmt)) * 18;
        var srot = ((k % 2 === 0 ? -1 : 1) * (2.4 - k * 0.4) * M.PI) / 180;
        gR.globalAlpha = sm(showAmt);
        gR.translate(sx + 72, sy + 26);
        gR.rotate(srot);
        gR.fillStyle = 'rgba(0,0,0,0.45)';
        gR.fillRect(-70, -23, 144, 50);
        gR.fillStyle = k === b - 1 ? '#f4eee1' : '#e6decb';
        gR.strokeStyle = '#151412';
        gR.lineWidth = 1.2;
        gR.fillRect(-72, -25, 144, 50);
        gR.strokeRect(-72, -25, 144, 50);
        /* 迷你红标与标题 */
        gR.fillStyle = '#d83418';
        gR.fillRect(-66, -19, 34, 15);
        gR.fillStyle = '#fff';
        gR.font = '700 10px "Geist Mono", monospace';
        gR.fillText(STUB_META[k].no, -61, -8);
        gR.fillStyle = '#151412';
        gR.font = '700 11px "PingFang SC", "Microsoft YaHei", sans-serif';
        gR.fillText(STUB_META[k].name, -26, -8);
        /* 迷你条码纹 */
        for (var bi = 0; bi < 16; bi++) {
          gR.fillRect(-66 + bi * 7.5, 4, (bi % 3) + 1.2, 11);
        }
        gR.restore();
        stubHitBoxes.push({ idx: k, x: sx, y: sy, w: 144, h: 50 });
      }
      gR.restore();

      /* ---------- B. 票卷底座投影 ---------- */
      gR.save();
      var baseShadow = gR.createRadialGradient(cx + 10, cyBot + 8, 10, cx + 14, cyBot + 10, R * 1.38);
      baseShadow.addColorStop(0, 'rgba(0, 0, 0, 0.76)');
      baseShadow.addColorStop(0.62, 'rgba(0, 0, 0, 0.32)');
      baseShadow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      gR.fillStyle = baseShadow;
      gR.beginPath();
      gR.ellipse(cx + 12, cyBot + 10, R * 1.32, ry * 1.32, 0, 0, M.PI * 2);
      gR.fill();
      gR.restore();

      /* ---------- C. 从圆柱右侧切线拉出的纸带存根（完全位于圆柱右侧，文字零遮挡） ---------- */
      var stripStartX = exitX - 6;
      if (stubEndX > exitX + 2) {
        gR.save();
        /* 纸带下方投影 */
        gR.fillStyle = 'rgba(0, 0, 0, 0.42)';
        gR.beginPath();
        gR.moveTo(stripStartX, stripTop + 10);
        gR.lineTo(stubEndX, stripTop + 13);
        gR.lineTo(stubEndX, stripTop + stripH + 15);
        gR.lineTo(stripStartX, stripTop + stripH + 9);
        gR.closePath();
        gR.fill();

        /* 纸带主体（左侧紧贴圆柱处带出纸弧面暗部过渡） */
        var stripGrad = gR.createLinearGradient(exitX - 4, 0, stubEndX, 0);
        stripGrad.addColorStop(0, '#c8beaa');
        stripGrad.addColorStop(0.16, '#f3ede0');
        stripGrad.addColorStop(0.62, '#ebe2d0');
        stripGrad.addColorStop(1, '#f5efe3');

        var waveY = M.sin(pullP * M.PI) * -2.5 + ptr.y * 1.5;
        gR.fillStyle = stripGrad;
        gR.strokeStyle = '#151412';
        gR.lineWidth = 1.4;
        gR.beginPath();
        gR.moveTo(stripStartX, stripTop);
        gR.quadraticCurveTo((exitX + stubEndX) * 0.5, stripTop + waveY, stubEndX, stripTop);
        /* 若已撕开，右缘画锯齿齿孔毛边；未撕开则平齐接票面 */
        if (tearP > 0.04) {
          var teeth = 16;
          var stepT = stripH / teeth;
          for (var ti = 0; ti < teeth; ti++) {
            var ty0 = stripTop + ti * stepT;
            if (tearP * teeth > ti) {
              gR.lineTo(stubEndX - 3.8, ty0 + stepT * 0.5);
              gR.lineTo(stubEndX, ty0 + stepT);
            } else {
              gR.lineTo(stubEndX, ty0 + stepT);
            }
          }
        } else {
          gR.lineTo(stubEndX, stripTop + stripH);
        }
        gR.quadraticCurveTo((exitX + stubEndX) * 0.5, stripTop + stripH + waveY, stripStartX, stripTop + stripH);
        gR.closePath();
        gR.fill();
        gR.stroke();

        /* 纸带上下排走纸齿孔 */
        gR.fillStyle = '#141413';
        for (var hx = exitX + 12; hx < stubEndX - 7; hx += 16) {
          gR.beginPath();
          gR.arc(hx, stripTop + 8, 2.6, 0, M.PI * 2);
          gR.arc(hx, stripTop + stripH - 8, 2.6, 0, M.PI * 2);
          gR.fill();
        }

        /* 纸带印刷细框、存根编号与条码（起点从 exitX + 10 开始，100% 完整可见） */
        var visStubW = stubEndX - exitX;
        if (visStubW > 36) {
          gR.save();
          gR.beginPath();
          gR.rect(exitX + 4, stripTop + 15, M.max(0, visStubW - 8), stripH - 30);
          gR.clip();

          gR.strokeStyle = 'rgba(21,20,18,0.24)';
          gR.lineWidth = 1;
          gR.strokeRect(exitX + 8, stripTop + 17, M.max(8, visStubW - 18), stripH - 34);

          gR.fillStyle = '#d83418';
          gR.font = '800 11px "Geist Mono", monospace';
          gR.fillText('存根 · ' + STUB_META[b].no, exitX + 14, stripTop + 36);
          gR.fillStyle = '#3e3a34';
          gR.font = '600 11px "PingFang SC", "Microsoft YaHei", sans-serif';
          gR.fillText(STUB_META[b].name, exitX + 14, stripTop + 54);

          /* 存根条码纹 */
          gR.fillStyle = '#151412';
          for (var sb = 0; sb < 18; sb++) {
            var bh = (sb % 3 === 0) ? 26 : 18;
            gR.fillRect(exitX + 14 + sb * 4.2, stripTop + stripH - 48, (sb % 2) + 1.2, bh);
          }
          gR.restore();
        }

        /* 纸带右缘的【左半枚朱砂骑缝章】（圆心锁定 deskCenterY，半径 36/31，未撕时与票面右半枚严丝合缝） */
        gR.save();
        gR.beginPath();
        gR.rect(exitX + 1, stripTop, M.max(0, stubEndX - exitX - 1), stripH);
        gR.clip();
        gR.translate(stubEndX, deskCenterY);
        gR.rotate(-8 * M.PI / 180);
        gR.strokeStyle = 'rgba(216, 52, 24, 0.86)';
        gR.lineWidth = 2.4;
        gR.beginPath();
        gR.arc(0, 0, 36, 0, M.PI * 2);
        gR.stroke();
        gR.strokeStyle = 'rgba(216, 52, 24, 0.72)';
        gR.lineWidth = 1.1;
        gR.beginPath();
        gR.arc(0, 0, 30.8, 0, M.PI * 2);
        gR.stroke();
        gR.fillStyle = 'rgba(216, 52, 24, 0.88)';
        gR.font = '900 9.5px "SHU Serif", serif';
        gR.textAlign = 'center';
        gR.fillText('上大', -16, -2);
        gR.fillText('存根', -16, 10);
        gR.restore();

        gR.restore();
      }

      /* ---------- D. 立体圆柱票卷本体（卷身曲面 + 透视印刷 + 顶面螺旋纸层 + 中心纸筒） ---------- */
      gR.save();
      /* 圆柱外轮廓路径 */
      gR.beginPath();
      gR.ellipse(cx, cyBot, R, ry, 0, 0, M.PI);
      gR.lineTo(cx - R, cyTop);
      gR.ellipse(cx, cyTop, R, ry, 0, M.PI, 0, true);
      gR.lineTo(cx + R, cyBot);
      gR.closePath();

      var cylGrad = gR.createLinearGradient(cx - R, 0, cx + R, 0);
      cylGrad.addColorStop(0.0, '#b2a996');
      cylGrad.addColorStop(0.18, '#dcd4c2');
      cylGrad.addColorStop(0.42, '#f8f4eb');
      cylGrad.addColorStop(0.68, '#ebe3d1');
      cylGrad.addColorStop(0.88, '#c8bfa9');
      cylGrad.addColorStop(1.0, '#9e9583');
      gR.fillStyle = cylGrad;
      gR.fill();

      /* 在圆柱曲面上按正弦透视投射旋转中的票面印刷纹、撕线与条码 */
      gR.save();
      gR.clip();
      var sectorCount = 8;
      for (var sc = 0; sc < sectorCount; sc++) {
        var phi = ((sc / sectorCount) * M.PI * 2 + rollAngle) % (M.PI * 2);
        if (phi < 0) phi += M.PI * 2;
        /* 前半圆柱面可见区间：0 .. PI */
        if (phi > 0.06 && phi < M.PI - 0.06) {
          var sxCyl = cx - R * M.cos(phi);
          var foreshorten = M.sin(phi); // 边缘压缩，中央最宽
          var yDrop = ry * M.sin(phi) * 0.92;

          /* 卷面竖向撕线齿孔 */
          gR.strokeStyle = 'rgba(21, 20, 18, ' + (0.34 * foreshorten).toFixed(3) + ')';
          gR.lineWidth = 1.1;
          gR.setLineDash([4, 4]);
          gR.beginPath();
          gR.moveTo(sxCyl, cyTop + yDrop + 12);
          gR.lineTo(sxCyl, cyBot + yDrop - 12);
          gR.stroke();
          gR.setLineDash([]);

          /* 卷面朱砂票号色块与条码纹（随圆柱透视压缩） */
          if (foreshorten > 0.25) {
            var bw = 22 * foreshorten;
            gR.fillStyle = 'rgba(216, 52, 24, ' + (0.72 * foreshorten).toFixed(3) + ')';
            gR.fillRect(sxCyl + 4 * foreshorten, cyTop + yDrop + 26, bw, 12);

            gR.fillStyle = 'rgba(21, 20, 18, ' + (0.55 * foreshorten).toFixed(3) + ')';
            for (var cb = 0; cb < 6; cb++) {
              gR.fillRect(
                sxCyl + (4 + cb * 4.2) * foreshorten,
                cyBot + yDrop - 54,
                M.max(0.8, 1.8 * foreshorten),
                24
              );
            }
          }
        }
      }

      /* 卷身上下沿走纸圆孔带 */
      for (var hp = 0; hp < 22; hp++) {
        var hPhi = ((hp / 22) * M.PI * 2 + rollAngle) % (M.PI * 2);
        if (hPhi < 0) hPhi += M.PI * 2;
        if (hPhi > 0.12 && hPhi < M.PI - 0.12) {
          var hxCyl = cx - R * M.cos(hPhi);
          var hFore = M.sin(hPhi);
          var hyOff = ry * M.sin(hPhi);
          gR.fillStyle = 'rgba(20, 20, 19, ' + (0.75 * hFore).toFixed(3) + ')';
          gR.beginPath();
          gR.ellipse(hxCyl, cyTop + hyOff + 9, M.max(0.8, 2.5 * hFore), 2.5, 0, 0, M.PI * 2);
          gR.ellipse(hxCyl, cyBot + hyOff - 9, M.max(0.8, 2.5 * hFore), 2.5, 0, 0, M.PI * 2);
          gR.fill();
        }
      }
      gR.restore();

      /* 圆柱外轮廓描边 */
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1.6;
      gR.beginPath();
      gR.moveTo(cx - R, cyTop);
      gR.lineTo(cx - R, cyBot);
      gR.ellipse(cx, cyBot, R, ry, 0, M.PI, 0, true);
      gR.lineTo(cx + R, cyTop);
      gR.stroke();

      /* ---------- E. 票卷顶面椭圆：密集螺旋纸层 + 中心牛皮纸筒 ---------- */
      gR.beginPath();
      gR.ellipse(cx, cyTop, R, ry, 0, 0, M.PI * 2);
      var topGrad = gR.createRadialGradient(cx - R * 0.2, cyTop - ry * 0.2, rCore * 0.4, cx, cyTop, R);
      topGrad.addColorStop(0, '#ddd4c1');
      topGrad.addColorStop(0.55, '#f2ecdf');
      topGrad.addColorStop(1, '#cfc6b2');
      gR.fillStyle = topGrad;
      gR.fill();
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1.6;
      gR.stroke();

      /* 螺旋卷纸层纹（随 rollAngle 旋转，视觉立竿见影） */
      var rings = 18;
      for (var ri = 1; ri < rings; ri++) {
        var rr = lerp(rCore + 3, R - 2, ri / rings);
        var rry = rr * (ry / R);
        gR.strokeStyle = ri % 4 === 0 ? 'rgba(216, 52, 24, 0.24)' : 'rgba(21, 20, 18, 0.18)';
        gR.lineWidth = 0.9;
        gR.beginPath();
        gR.ellipse(cx, cyTop, rr, rry, 0, rollAngle + ri * 0.35, rollAngle + ri * 0.35 + M.PI * 1.68);
        gR.stroke();
      }

      /* 中心中空牛皮纸筒（内壁立体暗部渐变 + 螺旋纸芯接缝） */
      var coreRy = rCore * (ry / R);
      gR.save();
      gR.beginPath();
      gR.ellipse(cx, cyTop, rCore, coreRy, 0, 0, M.PI * 2);
      var coreWall = gR.createLinearGradient(cx, cyTop - coreRy, cx, cyTop + coreRy);
      coreWall.addColorStop(0, '#433222');
      coreWall.addColorStop(0.55, '#7c5f41');
      coreWall.addColorStop(1, '#a6845e');
      gR.fillStyle = coreWall;
      gR.fill();
      gR.clip();

      /* 纸筒内部深孔阴影与旋转卡槽标记 */
      gR.fillStyle = '#161310';
      gR.beginPath();
      gR.ellipse(cx, cyTop + coreRy * 0.52, rCore * 0.78, coreRy * 0.72, 0, 0, M.PI * 2);
      gR.fill();

      /* 纸筒内壁随旋转运动的斜向牛皮纸接缝 */
      var seamX = cx + M.cos(rollAngle) * rCore * 0.65;
      gR.strokeStyle = 'rgba(30, 20, 12, 0.55)';
      gR.lineWidth = 1.6;
      gR.beginPath();
      gR.moveTo(seamX - 6, cyTop - coreRy);
      gR.lineTo(seamX + 8, cyTop + coreRy);
      gR.stroke();
      gR.restore();

      /* 牛皮纸筒厚壁环圈 */
      gR.strokeStyle = '#b9966d';
      gR.lineWidth = 3.2;
      gR.beginPath();
      gR.ellipse(cx, cyTop, rCore, coreRy, 0, 0, M.PI * 2);
      gR.stroke();
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1.2;
      gR.stroke();

      /* 票卷状态微铭牌（悬停票卷时提示可点击拉出下一张） */
      gR.fillStyle = hoverRoll ? '#ff6a4f' : 'rgba(242, 236, 224, 0.56)';
      gR.font = '600 11px "Geist Mono", "PingFang SC", sans-serif';
      gR.textAlign = 'center';
      gR.fillText(
        hoverRoll ? (b < 4 ? '点击拉出下一张 →' : '点击回到 No.1 ↺') : ('票卷余量 ' + M.round((1 - rollProgress * 0.78) * 100) + '%'),
        cx,
        cyTop - ry - 14
      );
      gR.textAlign = 'left';
      gR.restore();

      /* ---------- F. 驱动 DOM 票面位置 + 顶层撕裂特效画布 (#cvFx) ---------- */
      gF.clearRect(0, 0, W, H);

      beatEls.forEach(function (el, idx) {
        var clipEl = clipEls[idx];
        var cardEl = cardEls[idx];
        if (!cardEl || !clipEl) return;

        if (idx !== b) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          cardEl.style.transform = '';
          clipEl.style.clipPath = 'none';
          return;
        }

        el.style.visibility = 'visible';

        var tx = 0, ty = 0, rot = 0, sc = 1, op = 1;
        var isResting = false;
        if (b === 0) {
          /* 首屏：初始即完整停在可读位；往下滑时拉紧、撕开并归入左下存根叠 */
          if (u < 0.30) {
            isResting = true;
          } else {
            var pull0 = sm(seg(u, 0.30, 0.54)) * 5;
            var ripKick0 = M.sin(clamp(tearP, 0, 1) * M.PI) * 14;
            tx = pull0 + ripKick0;
            rot = M.sin(clamp(tearP, 0, 1) * M.PI) * 1.1;
            if (stackP > 0) {
              var targetDx0 = (trayX + 40) - deskRect.left;
              var targetDy0 = (trayY - 12) - deskCenterY;
              tx = lerp(tx, targetDx0, stackP);
              ty = lerp(0, targetDy0, stackP);
              sc = lerp(1, 0.24, stackP);
              rot = lerp(rot, -6, stackP);
              op = 1 - seg(stackP, 0.72, 1.0);
            }
          }
          clipEl.style.clipPath = 'none';
        } else {
          /* 第 2–5 拍：从圆柱右缘切口拉出 → 到撕线撕下 → 落位完全静止可读 → 归入存根叠 */
          var atTearLineX = tearBaseX - deskRect.left + tensionStretch;
          var clipLeftPx = exitX - deskRect.left;
          if (u < 0.27) {
            tx = pullPerfX + tensionStretch - deskRect.left;
            ty = 0;
            rot = 0;
            clipEl.style.clipPath = 'inset(-48px -48px -48px ' + M.round(clipLeftPx) + 'px)';
          } else if (u < 0.40) {
            tx = lerp(atTearLineX, 0, settleP);
            ty = M.sin(tearP * M.PI) * -4.5;
            rot = M.sin(tearP * M.PI) * 1.5;
            clipEl.style.clipPath = tearP < 0.35 ? 'inset(-48px -48px -48px ' + M.round(clipLeftPx) + 'px)' : 'none';
          } else if (stackP <= 0) {
            isResting = true;
            clipEl.style.clipPath = 'none';
          } else {
            clipEl.style.clipPath = 'none';
          }

          /* 节内子票扇出微动态（动作段跟手，可读段完全归零静止） */
          if (b === 1 || b === 2) {
            var subs = $$('[data-sub]', cardEl);
            var subSettle = b === 1 ? seg(u, 0.14, 0.39) : seg(u, 0.16, 0.39);
            subs.forEach(function (subEl, si) {
              if (u >= 0.40) {
                subEl.style.transform = '';
              } else {
                var localS = easeOutCubic(clamp((subSettle * 1.35) - si * 0.08, 0, 1));
                var dx = (1 - localS) * -18;
                var dy = (1 - localS) * (si - 2) * 2.5;
                subEl.style.transform = 'translate3d(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px,0)';
              }
            });
          }

          if (stackP > 0) {
            var tDx = (trayX + 44) - deskRect.left;
            var tDy = (trayY - 12) - deskCenterY;
            tx = lerp(0, tDx, stackP);
            ty = lerp(0, tDy, stackP);
            sc = lerp(1, 0.24, stackP);
            rot = lerp(0, -5.5, stackP);
            op = 1 - seg(stackP, 0.72, 1.0);
          }
        }

        el.style.opacity = op.toFixed(3);
        cardEl.style.transformOrigin = 'left center';
        if (isResting) {
          cardEl.style.transform = '';
        } else {
          cardEl.style.transform =
            'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) scale(' + sc.toFixed(3) + ') rotate(' + rot.toFixed(2) + 'deg)';
        }
      });

      /* 顶层撕裂拉链高光与纸屑（仅在撕裂区间 0 < tearP < 1 出现，可读段干净归零） */
      if (tearP > 0.01 && tearP < 0.99) {
        var seamX2 = activeTearX;
        var yStart = stripTop - 6;
        var yEnd = stripTop + stripH + 6;
        var ripFrontY = lerp(yStart, yEnd, clamp(tearP * 1.25, 0, 1));

        gF.save();
        /* 正在撕开的亮白纸纤维裂口线 */
        gF.strokeStyle = 'rgba(255, 250, 240, ' + ((1 - tearP) * 0.9).toFixed(3) + ')';
        gF.lineWidth = 2.2;
        gF.beginPath();
        gF.moveTo(seamX2, yStart);
        gF.lineTo(seamX2 + 2, ripFrontY);
        gF.stroke();

        /* 撕裂点朱砂火花脉冲与细纸屑（确定性轨迹，回滑可逆） */
        if (tearP < 0.85) {
          gF.fillStyle = '#ff5436';
          gF.beginPath();
          gF.arc(seamX2 + 1, ripFrontY, 3.5 * (1 - tearP * 0.6), 0, M.PI * 2);
          gF.fill();
        }

        for (var fi = 0; fi < 14; fi++) {
          var appearAt = (fi / 14) * 0.68;
          var life = seg(tearP, appearAt, appearAt + 0.32);
          if (life <= 0 || life >= 1) continue;
          var seed = b * 131 + fi * 37;
          var baseY = lerp(yStart + 10, yEnd - 10, fi / 13);
          var vx = (hash01(seed) - 0.35) * 44;
          var vy = (hash01(seed + 7) - 0.5) * 34 + life * 16;
          var fx = seamX2 + vx * easeOutCubic(life);
          var fy = baseY + vy * easeOutCubic(life);
          gF.save();
          gF.globalAlpha = 1 - life;
          gF.translate(fx, fy);
          gF.rotate((hash01(seed + 19) * 6 + life * 4));
          gF.fillStyle = fi % 4 === 0 ? '#d83418' : '#f4eee1';
          gF.fillRect(-2.5, -1.5, 5, 2.6);
          gF.restore();
        }

        /* 撕票声势微提示 */
        if (tearP > 0.08 && tearP < 0.78) {
          gF.fillStyle = 'rgba(255, 91, 61, ' + M.sin((tearP - 0.08) / 0.7 * M.PI).toFixed(3) + ')';
          gF.font = '700 11px "Geist Mono", "PingFang SC", sans-serif';
          gF.fillText('✂ 嘶——', seamX2 - 18, yStart - 10);
        }
        gF.restore();
      }
    }

    /* ==================== 绘制手机端：顶部横置 3/4 透视立体票卷 ==================== */
    function drawMobileStage(p, st) {
      var b = st.b, u = st.u;
      var cardSz = cardSizes[b] || { w: W - 24, h: 420 };

      gR.fillStyle = '#141413';
      gR.fillRect(0, 0, W, H);
      if (grainPattern) {
        gR.fillStyle = grainPattern;
        gR.fillRect(0, 0, W, H);
      }

      var rollProgress = clamp(p / TOTAL_U, 0, 1);
      var R = lerp(20, 15, rollProgress);
      var rxEnd = R * 0.46;
      var rCore = 7.5;
      var rollW = M.max(240, W - 40);
      var xL = 22;
      var xR = xL + rollW;
      var cy = 70;
      var exitY = cy + R - 2;
      var rollAngle = computeRollAngle(p);

      rollHitBox = { x: xL - rxEnd - 4, y: cy - R - 4, w: rollW + rxEnd * 2 + 8, h: R * 2 + 12 };

      var pullP = 1, tearP = 0, settleP = 0, stackP = 0;
      if (b === 0) {
        pullP = 1;
        tearP = seg(u, 0.54, 0.74);
        settleP = 1;
        stackP = easeInOutCubic(seg(u, 0.75, 1.0));
      } else if (b < 4) {
        pullP = easeOutCubic(seg(u, 0.0, 0.27));
        tearP = seg(u, 0.27, 0.39);
        settleP = easeOutCubic(seg(u, 0.28, 0.40));
        stackP = easeInOutCubic(seg(u, 0.85, 1.0));
      } else {
        pullP = easeOutCubic(seg(u, 0.0, 0.27));
        tearP = seg(u, 0.27, 0.39);
        settleP = easeOutCubic(seg(u, 0.28, 0.40));
        stackP = 0;
      }

      /* 手机端票面紧接 deskRect.top (120px)，上方留出约 30px 真实存根带 */
      var cardTopM = deskRect.top;
      var tearBaseY = cardTopM - 6;
      var activeTearY = b === 0 ? cardTopM : tearBaseY;
      var pullPerfY = activeTearY;
      var stubEndY = exitY;

      if (b === 0) {
        stubEndY = M.max(exitY + 6, activeTearY - sm(seg(tearP, 0.35, 1.0)) * 10 - sm(stackP) * 10);
      } else if (u < 0.27) {
        pullPerfY = lerp(exitY - M.min(cardSz.h * 0.65, H * 0.52), activeTearY, pullP);
        stubEndY = M.max(exitY, pullPerfY);
      } else {
        stubEndY = M.max(exitY + 6, activeTearY - sm(seg(tearP, 0.35, 1.0)) * 8 - sm(stackP) * 10);
      }

      /* 下垂纸带存根（带存根票号、撕裂锯齿边与上半枚朱砂骑缝章） */
      if (stubEndY > exitY + 1) {
        gR.save();
        var sLeft = 14, sWidth = W - 28;
        var sGrad = gR.createLinearGradient(0, exitY - 2, 0, stubEndY);
        sGrad.addColorStop(0, '#c8beaa');
        sGrad.addColorStop(0.42, '#f3ede0');
        sGrad.addColorStop(1, '#ece3d1');
        gR.fillStyle = sGrad;
        gR.strokeStyle = '#151412';
        gR.lineWidth = 1.2;

        gR.beginPath();
        gR.moveTo(sLeft, exitY - 2);
        gR.lineTo(sLeft + sWidth, exitY - 2);
        gR.lineTo(sLeft + sWidth, stubEndY);
        if (tearP > 0.05) {
          var mTeeth = 20;
          var mStep = sWidth / mTeeth;
          for (var mt = mTeeth; mt > 0; mt--) {
            var tx0 = sLeft + mt * mStep;
            if (tearP * mTeeth > (mTeeth - mt)) {
              gR.lineTo(tx0 - mStep * 0.5, stubEndY - 3);
              gR.lineTo(tx0 - mStep, stubEndY);
            } else {
              gR.lineTo(tx0 - mStep, stubEndY);
            }
          }
        } else {
          gR.lineTo(sLeft, stubEndY);
        }
        gR.closePath();
        gR.fill();
        gR.stroke();

        if (stubEndY - exitY > 14) {
          gR.save();
          gR.beginPath();
          gR.rect(sLeft + 2, exitY, sWidth - 4, M.max(0, stubEndY - exitY - 2));
          gR.clip();
          gR.fillStyle = '#d83418';
          gR.font = '800 10px "Geist Mono", monospace';
          gR.fillText('存根 · ' + STUB_META[b].no, sLeft + 10, exitY + 15);
          gR.fillStyle = '#3e3a34';
          gR.font = '600 10px "PingFang SC", "Microsoft YaHei", sans-serif';
          gR.fillText(STUB_META[b].name, sLeft + 84, exitY + 15);
          gR.restore();
        }

        /* 上半枚朱砂骑缝章（与手机端卡片顶部 calc(62%) 下半枚严丝合缝） */
        gR.save();
        gR.beginPath();
        gR.rect(sLeft, exitY, sWidth, M.max(0, stubEndY - exitY));
        gR.clip();
        var stampMX = 12 + (W - 24) * 0.62;
        gR.strokeStyle = 'rgba(216, 52, 24, 0.86)';
        gR.lineWidth = 2;
        gR.beginPath();
        gR.arc(stampMX, stubEndY, 27, 0, M.PI * 2);
        gR.stroke();
        gR.lineWidth = 1;
        gR.beginPath();
        gR.arc(stampMX, stubEndY, 22.8, 0, M.PI * 2);
        gR.stroke();
        gR.fillStyle = 'rgba(216, 52, 24, 0.86)';
        gR.font = '900 8px "SHU Serif", serif';
        gR.textAlign = 'center';
        gR.fillText('上大存根', stampMX, stubEndY - 8);
        gR.restore();
        gR.restore();
      }

      /* 顶部横置立体圆柱票卷 */
      gR.save();
      gR.fillStyle = 'rgba(0,0,0,0.5)';
      gR.fillRect(xL + 4, cy + R - 2, rollW, 9);

      var hGrad = gR.createLinearGradient(0, cy - R, 0, cy + R);
      hGrad.addColorStop(0, '#bdb39f');
      hGrad.addColorStop(0.32, '#f8f4eb');
      hGrad.addColorStop(0.72, '#e8dfd0');
      hGrad.addColorStop(1, '#a99f8c');

      gR.beginPath();
      gR.moveTo(xL, cy - R);
      gR.lineTo(xR, cy - R);
      gR.ellipse(xR, cy, rxEnd, R, 0, -M.PI * 0.5, M.PI * 0.5);
      gR.lineTo(xL, cy + R);
      gR.closePath();
      gR.fillStyle = hGrad;
      gR.fill();
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1.3;
      gR.stroke();

      /* 圆柱面随滚动旋转的横纹与红标 */
      for (var mi = 0; mi < 6; mi++) {
        var mPhi = ((mi / 6) * M.PI * 2 + rollAngle) % (M.PI * 2);
        if (mPhi < 0) mPhi += M.PI * 2;
        if (mPhi < M.PI) {
          var my = cy - R * M.cos(mPhi);
          var mFore = M.sin(mPhi);
          gR.strokeStyle = 'rgba(21,20,18,' + (0.28 * mFore).toFixed(2) + ')';
          gR.setLineDash([3, 3]);
          gR.beginPath();
          gR.moveTo(xL + 8, my);
          gR.lineTo(xR - 6, my);
          gR.stroke();
          gR.setLineDash([]);
          if (mFore > 0.4) {
            gR.fillStyle = 'rgba(216,52,24,' + (0.72 * mFore).toFixed(2) + ')';
            gR.fillRect(xL + 22, my - 2, 20, M.max(1.5, 4 * mFore));
          }
        }
      }

      /* 左侧断面：螺旋纸层 + 牛皮纸筒芯 */
      gR.beginPath();
      gR.ellipse(xL, cy, rxEnd, R, 0, 0, M.PI * 2);
      gR.fillStyle = '#ece4d3';
      gR.fill();
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1.3;
      gR.stroke();

      for (var mr = 1; mr < 8; mr++) {
        var rrM = lerp(rCore + 2, R - 2, mr / 8);
        gR.strokeStyle = 'rgba(21,20,18,0.2)';
        gR.lineWidth = 0.8;
        gR.beginPath();
        gR.ellipse(xL, cy, rrM * (rxEnd / R), rrM, 0, rollAngle + mr, rollAngle + mr + M.PI * 1.5);
        gR.stroke();
      }

      gR.beginPath();
      gR.ellipse(xL, cy, rCore * (rxEnd / R), rCore, 0, 0, M.PI * 2);
      gR.fillStyle = '#6c5136';
      gR.fill();
      gR.strokeStyle = '#151412';
      gR.lineWidth = 1;
      gR.stroke();
      gR.restore();

      stubHitBoxes = [];

      /* 驱动手机端 DOM 票面纵向从顶部票卷拉出、撕下、落位 */
      gF.clearRect(0, 0, W, H);

      beatEls.forEach(function (el, idx) {
        var clipEl = clipEls[idx];
        var cardEl = cardEls[idx];
        if (!cardEl || !clipEl) return;

        if (idx !== b) {
          el.style.opacity = '0';
          el.style.visibility = 'hidden';
          cardEl.style.transform = '';
          clipEl.style.clipPath = 'none';
          return;
        }

        el.style.visibility = 'visible';
        var tx = 0, ty = 0, rot = 0, sc = 1, op = 1;
        var restM = false;

        if (b === 0) {
          if (u < 0.30) {
            restM = true;
          } else {
            ty = sm(seg(u, 0.30, 0.54)) * 4 + M.sin(clamp(tearP, 0, 1) * M.PI) * 8;
            rot = M.sin(clamp(tearP, 0, 1) * M.PI) * 0.9;
            if (stackP > 0) {
              ty = lerp(ty, -56, stackP);
              sc = lerp(1, 0.88, stackP);
              op = 1 - seg(stackP, 0.3, 1.0);
            }
          }
          clipEl.style.clipPath = 'none';
        } else {
          var atTearY = tearBaseY - cardTopM;
          var clipTopPx = exitY - cardTopM;
          if (u < 0.27) {
            ty = pullPerfY - cardTopM;
            clipEl.style.clipPath = 'inset(' + M.round(clipTopPx) + 'px -20px -24px -20px)';
          } else if (u < 0.40) {
            ty = lerp(atTearY, 0, settleP);
            rot = M.sin(tearP * M.PI) * 1.1;
            clipEl.style.clipPath = tearP < 0.35 ? 'inset(' + M.round(clipTopPx) + 'px -20px -24px -20px)' : 'none';
          } else if (stackP <= 0) {
            restM = true;
            clipEl.style.clipPath = 'none';
          } else {
            clipEl.style.clipPath = 'none';
          }

          if (stackP > 0) {
            ty = lerp(0, -56, stackP);
            sc = lerp(1, 0.88, stackP);
            op = 1 - seg(stackP, 0.3, 1.0);
          }
        }

        el.style.opacity = op.toFixed(3);
        cardEl.style.transformOrigin = 'center top';
        if (restM) {
          cardEl.style.transform = '';
        } else {
          cardEl.style.transform =
            'translate3d(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px,0) scale(' + sc.toFixed(3) + ') rotate(' + rot.toFixed(2) + 'deg)';
        }
      });

      /* 手机端横向撕裂拉链特效 */
      if (tearP > 0.01 && tearP < 0.99) {
        var ripX = lerp(xL, xR, clamp(tearP * 1.25, 0, 1));
        gF.save();
        gF.strokeStyle = 'rgba(255, 250, 240, ' + ((1 - tearP) * 0.9).toFixed(2) + ')';
        gF.lineWidth = 2;
        gF.beginPath();
        gF.moveTo(xL, activeTearY);
        gF.lineTo(ripX, activeTearY + 1.5);
        gF.stroke();

        for (var mf = 0; mf < 10; mf++) {
          var mApp = (mf / 10) * 0.65;
          var mLife = seg(tearP, mApp, mApp + 0.34);
          if (mLife <= 0 || mLife >= 1) continue;
          var mSeed = b * 97 + mf * 29;
          var fxM = lerp(xL + 8, xR - 8, mf / 9) + (hash01(mSeed) - 0.5) * 24 * mLife;
          var fyM = activeTearY + (hash01(mSeed + 5) - 0.3) * 26 * mLife;
          gF.globalAlpha = 1 - mLife;
          gF.fillStyle = mf % 3 === 0 ? '#d83418' : '#f4eee1';
          gF.fillRect(fxM, fyM, 4, 2.2);
        }
        gF.restore();
      }
    }

    function renderFrame(p) {
      var st = resolveBeat(p);
      setActiveBeatUI(st.b);

      gR.setTransform(dpr, 0, 0, dpr, 0, 0);
      gF.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (isMob) drawMobileStage(p, st);
      else drawDesktopStage(p, st);
    }

    function tick() {
      rafId = 0;
      if (pageHidden || !inView) return;

      targetP = readScrollProgress();
      var diff = targetP - curP;
      var pDiffX = ptr.tx - ptr.x;
      var pDiffY = ptr.ty - ptr.y;

      /* 极短跟手缓动（0.28），兼顾跟手实时感与丝滑度；静止即停帧省电 */
      if (M.abs(diff) > 0.00025 || M.abs(pDiffX) > 0.002 || M.abs(pDiffY) > 0.002) {
        curP += diff * 0.28;
        ptr.x += pDiffX * 0.18;
        ptr.y += pDiffY * 0.18;
        renderFrame(curP);
        rafId = requestAnimationFrame(tick);
      } else {
        curP = targetP;
        ptr.x = ptr.tx;
        ptr.y = ptr.ty;
        renderFrame(curP);
      }
    }

    function requestTick() {
      if (!rafId && !pageHidden && inView) {
        rafId = requestAnimationFrame(tick);
      }
    }

    /* 点击立体票卷可拉出下一张票；点击左下已撕存根可直接跳回对应拍 */
    function hitBoxTest(box, mx, my) {
      return !!(box && mx >= box.x && mx <= box.x + box.w && my >= box.y && my <= box.y + box.h);
    }

    stage.addEventListener('click', function (e) {
      if (e.target.closest('a, button, input, label, .ticket, .ticket-sheet, .rail')) return;
      var r = stage.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var my = e.clientY - r.top;
      if (hitBoxTest(rollHitBox, mx, my)) {
        scrollToBeatFn(activeIdx < 4 ? activeIdx + 1 : 0);
        return;
      }
      if (!isMob && stubHitBoxes.length) {
        for (var i = stubHitBoxes.length - 1; i >= 0; i--) {
          if (hitBoxTest(stubHitBoxes[i], mx, my)) {
            scrollToBeatFn(stubHitBoxes[i].idx);
            break;
          }
        }
      }
    });

    stage.addEventListener('pointermove', function (e) {
      if (isMob) return;
      ptr.active = true;
      var r = stage.getBoundingClientRect();
      var mx = e.clientX - r.left;
      var my = e.clientY - r.top;
      ptr.tx = ((mx / M.max(1, W)) - 0.5) * 2;
      ptr.ty = ((my / M.max(1, H)) - 0.5) * 2;

      var onTarget = hitBoxTest(rollHitBox, mx, my);
      var onStub = false;
      for (var i = 0; i < stubHitBoxes.length; i++) {
        if (hitBoxTest(stubHitBoxes[i], mx, my)) { onStub = true; break; }
      }
      var nextHoverRoll = onTarget && !e.target.closest('.ticket, .ticket-sheet, .rail');
      if (nextHoverRoll !== hoverRoll) {
        hoverRoll = nextHoverRoll;
        renderFrame(curP);
      }
      stage.style.cursor = (nextHoverRoll || onStub) ? 'pointer' : '';
      requestTick();
    }, { passive: true });

    stage.addEventListener('pointerleave', function () {
      ptr.active = false;
      ptr.tx = 0; ptr.ty = 0;
      if (hoverRoll) { hoverRoll = false; renderFrame(curP); }
      stage.style.cursor = '';
      requestTick();
    }, { passive: true });

    window.addEventListener('scroll', function () {
      if (!isHeadless && virtP !== null && (window.pageYOffset || doc.documentElement.scrollTop || 0) > 4) {
        virtP = null;
      }
      requestTick();
      /* 不依赖 rAF 的兜底：若后台或受限环境未跑 rAF，150ms 后直接同步到终点 */
      clearTimeout(scrollFbTimer);
      scrollFbTimer = setTimeout(function () {
        if (!rafId && inView) {
          curP = readScrollProgress();
          targetP = curP;
          renderFrame(curP);
        }
      }, 150);
    }, { passive: true });
    window.addEventListener('resize', function () {
      measure();
      curP = readScrollProgress();
      targetP = curP;
      renderFrame(curP);
    }, { passive: true });

    doc.addEventListener('visibilitychange', function () {
      pageHidden = doc.hidden;
      if (!pageHidden) requestTick();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        inView = entries.some(function (en) { return en.isIntersecting; });
        if (inView) requestTick();
      }, { threshold: 0 });
      io.observe(track);
    }

    /* 监听动态偏好切换 */
    if (window.matchMedia) {
      var mq = matchMedia('(prefers-reduced-motion: reduce)');
      var onChange = function (ev) {
        if (ev.matches) {
          root.classList.remove('live');
          track.style.height = '';
          beatEls.forEach(function (el, i) {
            el.style.opacity = '';
            el.style.visibility = '';
            if ('inert' in el) el.inert = false;
            if (cardEls[i]) cardEls[i].style.transform = '';
            if (clipEls[i]) clipEls[i].style.clipPath = '';
          });
        }
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
    }

    /* 初始化构建与首帧同步渲染 */
    buildPatterns();
    measure();

    /* 解析调试定位参数：?at=像素或b0..b4 / ?beat=0..4 / ?pull=0..4 / ?unroll=1..4
       无头 Edge --screenshot 始终从文档 (0,0) 截取，因此无头模式下通过 virtP 直接定位舞台进度 */
    var qs = location.search;
    var mAtB = qs.match(/[?&]at=b([0-4])\b/);
    var mAtPx = qs.match(/[?&]at=(\d+)\b/);
    var mBeat = qs.match(/[?&]beat=([0-4])\b/);
    var mPull = qs.match(/[?&]pull=([0-4])\b/);
    var mUnroll = qs.match(/[?&]unroll=([1-4])\b/);
    var dbgU = null;

    if (mAtB || mBeat) {
      dbgU = getBeatReadableU(parseInt((mAtB || mBeat)[1], 10));
    } else if (mPull) {
      var pIdx = clamp(parseInt(mPull[1], 10), 0, 4);
      var localU = pIdx === 0 ? 0.62 : 0.32;
      dbgU = CUM[pIdx] + SPANS[pIdx] * localU;
    } else if (mUnroll) {
      var uIdx = clamp(parseInt(mUnroll[1], 10), 1, 4);
      dbgU = CUM[uIdx] + SPANS[uIdx] * 0.11;
    } else if (mAtPx) {
      var pxVal = parseInt(mAtPx[1], 10);
      dbgU = clamp((pxVal - trackTop) / maxScroll, 0, 1) * TOTAL_U;
    }

    if (dbgU !== null) {
      if (isHeadless) {
        virtP = clamp(dbgU, 0, TOTAL_U);
      } else {
        window.scrollTo(0, M.round(trackTop + (dbgU / TOTAL_U) * maxScroll));
      }
    }

    curP = readScrollProgress();
    targetP = curP;
    renderFrame(curP);

    /* 2.5s 不依赖 rAF 的硬兜底，确保后台标签页同步到最终状态 */
    setTimeout(function () {
      curP = readScrollProgress();
      targetP = curP;
      renderFrame(curP);
    }, 2500);

    /* 字体加载完成后复测一次卡片高度，确保像素对齐 */
    if (doc.fonts && doc.fonts.ready) {
      doc.fonts.ready.then(function () {
        measure();
        curP = readScrollProgress();
        targetP = curP;
        renderFrame(curP);
      });
    }
  }

  /* ==================== 启动入口（异常自动退回普通分节页） ==================== */
  renderAllContent();
  bindUI();

  if (root.classList.contains('live')) {
    try {
      initLiveStage();
    } catch (err) {
      root.classList.remove('live');
      var tr = $('#track');
      if (tr) tr.style.height = '';
    }
  }
})();
