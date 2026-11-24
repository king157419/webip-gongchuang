/* =====================================================================
 * v12-contour · 页面内容渲染与交互控制
 * ---------------------------------------------------------------------
 * · 全部列表（部门、5 类活动、人物、16 篇报道、加入步骤、FAQ、荣誉）均从
 *   window.CLUB 动态渲染并严格 HTML 转义
 * · 滚动驱动首屏镜头俯冲、三段过渡短句、活动卡片横向平移及按钮/拖拽联动
 * · 报道分类筛选、HTTP 兼容公众号复制、吉祥物小智表情交互
 * ===================================================================== */
(function () {
  'use strict';

  var CLUB = window.CLUB || {};
  var $ = function (id) { return document.getElementById(id); };
  var reduce = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function valOrTag(v) {
    if (v == null || v === '' || v === '待补充') {
      return '<span class="pending-tag">待补充</span>';
    }
    return esc(v);
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dotDate(d) { return String(d || '').replace(/-/g, '.'); }

  var CAT_SHORT = {
    weld: '焊接课',
    course: '昇腾 AI 课',
    visit: '企业参访',
    contest: '创新大赛',
    talk: '分享会'
  };

  // 每类活动的极简等高/几何线稿图标（纯 currentColor 细线，无装饰噱头）
  var PROG_SVG = {
    weld: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><circle cx="13" cy="27" r="4.5"/><circle cx="27" cy="13" r="3.5"/><path d="M16.2 23.8L24.5 15.5M6 27h2.5M30.5 13H35M13 31.5V35"/></svg>',
    course: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><rect x="7" y="9" width="26" height="22" rx="1"/><path d="M7 16.5h26M15.5 16.5V31M24.5 16.5V31"/></svg>',
    visit: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><ellipse cx="20" cy="20" rx="14" ry="8"/><ellipse cx="20" cy="20" rx="8" ry="14"/><circle cx="20" cy="20" r="2.2"/></svg>',
    contest: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M8 30L16 14l6 9 5-11 5 18H8z"/><path d="M6 30h28"/></svg>',
    talk: '<svg viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="1" aria-hidden="true"><path d="M9 26c4-9 8-9 11 0s7 9 11 0"/><path d="M9 17c4-6 8-6 11 0s7 6 11 0"/></svg>'
  };

  /* ---------- 1. 从 window.CLUB 渲染全站数据 ---------- */
  var meta = CLUB.meta || {};
  var programs = CLUB.programs || [];
  var news = CLUB.news || [];
  var honors = CLUB.honors || [];
  var people = CLUB.people || {};
  var join = CLUB.join || {};

  if (coarse && $('cueLabel')) {
    $('cueLabel').textContent = '按住或左右拖动地形 · 松手波纹回弹';
  }

  // 01 关于
  if ($('aboutIntro')) {
    $('aboutIntro').textContent = meta.intro || '';
  }
  if ($('aboutLoc')) {
    $('aboutLoc').innerHTML = '常驻活动空间：' + valOrTag(meta.location) +
      '<span class="prose-sep" aria-hidden="true">·</span>在册人数：' + valOrTag(meta.members);
  }

  if ($('deptGrid')) {
    var depts = meta.departments || [];
    $('deptGrid').innerHTML = depts.map(function (d, idx) {
      return '<li class="dept-item">' +
        '<span class="dept-no">' + pad2(idx + 1) + '</span>' +
        '<div><strong class="dept-name">' + esc(d.name) + '</strong>' +
        '<p class="dept-desc">' + esc(d.desc) + '</p></div>' +
        '</li>';
    }).join('');
  }

  if ($('honorList')) {
    $('honorList').innerHTML = honors.map(function (h) {
      var inner = '<span class="honor-yr">' + esc(h.year) + '</span>' +
        '<span class="honor-txt">' + esc(h.text) + '</span>' +
        (h.source ? '<span class="honor-arr" aria-hidden="true">↗</span>' : '');
      return '<li class="honor-item">' +
        (h.source
          ? '<a href="' + esc(h.source) + '" target="_blank" rel="noopener noreferrer">' + inner + '</a>'
          : '<div class="honor-row">' + inner + '</div>') +
        '</li>';
    }).join('');
  }

  if ($('statList')) {
    var yrs = news.map(function (n) { return parseInt(String(n.date).slice(0, 4), 10); }).filter(Boolean);
    var yrSpan = yrs.length ? (Math.min.apply(null, yrs) + '—' + Math.max.apply(null, yrs)) : '2022—2026';
    var statRows = [
      { val: String(meta.founded || 2021), label: '年成立', sub: '挂靠' + (meta.host || '通信与信息工程学院团委') },
      { val: String(news.length), label: '篇学院官网公开报道', sub: yrSpan + ' 真实活动记录' },
      { val: String((meta.departments || []).length || 4), label: '个社团部门', sub: (meta.departments || []).map(function (d) { return d.name; }).join(' · ') },
      { val: '近 200', label: '人参加 AI 论文分享会', sub: '2024.12 · 宝山校区 CJ203' },
      { val: '百余名', label: '同学赴 2024 华为全联接大会', sub: '2025.11 焊接专项赛亦报名百余人' },
      { val: '近百名', label: '学子走进华为鸿蒙生态学堂', sub: '2025.11 · 另有 40 余名入选 2026 昇腾实践课' }
    ];
    $('statList').innerHTML = statRows.map(function (r) {
      return '<div class="stat-row">' +
        '<dt><span class="stat-main">' + esc(r.label) + '</span>' +
        (r.sub ? '<small class="stat-sub">' + esc(r.sub) + '</small>' : '') + '</dt>' +
        '<dd>' + esc(r.val) + '</dd>' +
        '</div>';
    }).join('');
  }

  // 02 平时做什么（5 张横向平移大卡）
  if ($('pgTrack')) {
    $('pgTrack').innerHTML = programs.map(function (p, i) {
      var related = news.filter(function (n) { return n.cat === p.id; });
      var latest = related[0];
      var latestHtml = '';
      if (latest) {
        latestHtml = '<div class="pg-card-foot">' +
          '<p class="pg-quote">' + esc(latest.summary) + '</p>' +
          '<a class="pg-link" href="' + esc(latest.source) + '" target="_blank" rel="noopener noreferrer">' +
          '<span>最近报道 · ' + esc(dotDate(latest.date)) + '</span><span aria-hidden="true">↗</span></a>' +
          '</div>';
      }
      return '<li class="pg-card">' +
        '<div class="pg-card-top">' +
        '<span class="pg-no">' + pad2(i + 1) + ' / ' + pad2(programs.length) + '</span>' +
        '<span class="pg-icon">' + (PROG_SVG[p.id] || '') + '</span>' +
        '</div>' +
        '<h3 class="pg-name">' + esc(p.name) + '</h3>' +
        '<p class="pg-desc">' + esc(p.desc) + '</p>' +
        '<div class="pg-meta">' +
        '<span>地点：' + esc(p.where) + '</span>' +
        '<span>学院官网报道 ' + related.length + ' 篇</span>' +
        '</div>' +
        latestHtml +
        '</li>';
    }).join('');
  }

  // 03 社长与指导老师
  if ($('ppGrid')) {
    var allPeople = (people.leaders || []).map(function (x) { return { data: x, kind: 'leader' }; })
      .concat((people.teachers || []).map(function (x) { return { data: x, kind: 'teacher' }; }));

    $('ppGrid').innerHTML = allPeople.map(function (item, idx) {
      var p = item.data;
      var hasPhoto = !!p.photo;
      var photoHtml = hasPhoto
        ? '<figure class="pp-figure"><img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '照片" width="228" height="285" loading="lazy"></figure>'
        : '';
      var awardsHtml = (p.awards && p.awards.length)
        ? '<div class="pp-awards-wrap"><p class="pp-awards-label">主要竞赛经历</p><ul class="pp-awards">' +
          p.awards.map(function (aw) { return '<li>' + esc(aw) + '</li>'; }).join('') +
          '</ul></div>'
        : '';

      var noPhotoHtml = !hasPhoto ? '<span class="pending-tag">照片待补充</span>' : '';

      return '<article class="arch-cell pp-card' + (hasPhoto ? ' pp-featured' : '') + '" data-rv>' +
        '<div class="pp-head"><span class="cell-idx">' + pad2(idx + 1) + '.</span>' +
        '<span class="pp-tag">' + (item.kind === 'leader' ? '学生负责人' : '指导教师') + noPhotoHtml + '</span></div>' +
        '<div class="pp-body">' +
        photoHtml +
        '<div class="pp-text">' +
        '<h3 class="pp-name">' + esc(p.name) + '</h3>' +
        '<p class="pp-role">' + esc(p.role) + '</p>' +
        '<p class="pp-desc">' + esc(p.desc) + '</p>' +
        awardsHtml +
        '</div></div></article>';
    }).join('');
  }

  // 04 做过的事（16 篇报道 + 分类筛选）
  if ($('nwTitle')) {
    $('nwTitle').textContent = news.length + ' 篇学院官网报道';
  }
  if ($('nwSub')) {
    $('nwSub').textContent = '2022 至 2026 年全部公开报道归档，点击任意条目直接打开上海大学通信学院官网原文。';
  }

  function cleanHeadline(raw) {
    var s = String(raw || '').trim();
    var parts = s.split(/\s*[|丨｜]\s*|\s*——\s*/);
    if (parts.length > 1) {
      // 优先保留信息量完整的一侧，同时呈现主副题层次
      return {
        tag: parts[0].trim().replace(/^[“"]|[”"]$/g, ''),
        main: parts.slice(1).join(' · ').trim()
      };
    }
    return { tag: '', main: s };
  }

  function renderNews(catFilter) {
    var grid = $('nwGrid');
    if (!grid) return;
    var filtered = news.map(function (n, idx) { return { item: n, idx: idx }; })
      .filter(function (entry) { return catFilter === 'all' || entry.item.cat === catFilter; });

    grid.innerHTML = filtered.map(function (entry) {
      var n = entry.item;
      var hl = cleanHeadline(n.title);
      var catName = CAT_SHORT[n.cat] || n.cat;
      return '<li class="nw-li">' +
        '<a class="arch-cell nw-card" href="' + esc(n.source) + '" target="_blank" rel="noopener noreferrer">' +
        '<div class="nw-card-top">' +
        '<span class="cell-idx">' + pad2(entry.idx + 1) + '.</span>' +
        '<span class="nw-cat">' + esc(dotDate(n.date)) + ' · ' + esc(catName) + '</span>' +
        '<span class="nw-arr" aria-hidden="true">↗</span>' +
        '</div>' +
        (hl.tag ? '<p class="nw-kicker">' + esc(hl.tag) + '</p>' : '') +
        '<h3 class="nw-card-title">' + esc(hl.main) + '</h3>' +
        '<p class="nw-summary">' + esc(n.summary) + '</p>' +
        '<span class="sr">（在新窗口打开学院官网报道原文）</span>' +
        '</a></li>';
    }).join('');
  }

  if ($('nwFilters')) {
    var filterItems = [{ id: 'all', label: '全部', count: news.length }].concat(
      programs.map(function (p) {
        var c = news.filter(function (n) { return n.cat === p.id; }).length;
        return { id: p.id, label: CAT_SHORT[p.id] || p.name, count: c };
      })
    );
    $('nwFilters').innerHTML = filterItems.map(function (f, idx) {
      return '<button type="button" class="flt-btn' + (idx === 0 ? ' is-active' : '') + '" data-cat="' + esc(f.id) + '" aria-pressed="' + (idx === 0 ? 'true' : 'false') + '">' +
        esc(f.label) + '<span class="flt-cnt">' + esc(f.count) + '</span></button>';
    }).join('');

    $('nwFilters').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.flt-btn') : null;
      if (!btn) return;
      var cat = btn.getAttribute('data-cat') || 'all';
      [].forEach.call($('nwFilters').querySelectorAll('.flt-btn'), function (b) {
        var on = b === btn;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      renderNews(cat);
    });
  }
  renderNews('all');

  // 05 加入我们（步骤 + FAQ + 页脚）
  if ($('joinSteps')) {
    $('joinSteps').innerHTML = (join.steps || []).map(function (st, i) {
      return '<li class="step-card" data-rv>' +
        '<span class="step-num">' + pad2(i + 1) + '</span>' +
        '<h3 class="step-title">' + esc(st.t) + '</h3>' +
        '<p class="step-desc">' + esc(st.d) + '</p>' +
        '</li>';
    }).join('');
  }

  if ($('joinMeta')) {
    var contact = meta.contact || {};
    var formHtml = join.formUrl
      ? '<a class="join-meta-link" href="' + esc(join.formUrl) + '" target="_blank" rel="noopener noreferrer">填写问卷 ↗</a>'
      : valOrTag(null);
    $('joinMeta').innerHTML =
      '<div class="join-meta-item"><dt>集中招新时间</dt><dd>' + valOrTag(join.season) + '</dd></div>' +
      '<div class="join-meta-item"><dt>线上报名问卷</dt><dd>' + formHtml + '</dd></div>' +
      '<div class="join-meta-item"><dt>社团招新群</dt><dd>' + valOrTag(contact.qqGroup) + '</dd></div>';
  }

  if ($('faqList')) {
    $('faqList').innerHTML = (join.faq || []).map(function (f) {
      return '<details class="faq-item">' +
        '<summary class="faq-q"><span>' + esc(f.q) + '</span><span class="faq-pm" aria-hidden="true"></span></summary>' +
        '<div class="faq-a"><p>' + esc(f.a) + '</p></div>' +
        '</details>';
    }).join('');
  }

  if ($('ftTitle') && meta.name) {
    $('ftTitle').textContent = meta.name + (meta.en ? ' · ' + meta.en : '');
  }
  if ($('ftMeta')) {
    $('ftMeta').textContent = '挂靠单位：' + (meta.host || '') + ' · ' + (meta.founded || 2021) + ' 年成立 · ' + (meta.location || '');
  }

  /* ---------- 2. 吉祥物小智表情交互 & 复制公众号名 ---------- */
  var ZHI_MOODS = [
    '小智 · 欢迎来玩（点我换表情）',
    '小智 · 零基础也能上手',
    '小智 · 翔英大楼见',
    '小智 · 刚焊完一块电路板'
  ];
  var zhiIdx = 0;
  function setZhiMood(idx) {
    zhiIdx = ((idx % 4) + 4) % 4;
    var img = $('zhiImg');
    var cap = $('zhiCap');
    if (img) img.style.transform = 'translate3d(' + (-zhiIdx * 25) + '%, 0, 0)';
    if (cap) cap.textContent = ZHI_MOODS[zhiIdx];
  }
  if ($('zhiBtn')) {
    $('zhiBtn').addEventListener('click', function () {
      setZhiMood(zhiIdx + 1);
    });
  }
  if ($('faqList')) {
    $('faqList').addEventListener('toggle', function (e) {
      if (e.target && e.target.open) setZhiMood(1);
    }, true);
  }

  if ($('copyBtn')) {
    $('copyBtn').addEventListener('click', function () {
      var account = '上海大学通信学院';
      var copied = false;
      var ta = document.createElement('textarea');
      ta.value = account;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-999px;left:-999px;opacity:0;pointer-events:none';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        ta.setSelectionRange(0, account.length);
        copied = document.execCommand('copy');
      } catch (err) {
        copied = false;
      }
      document.body.removeChild(ta);

      var st = $('copyStatus');
      if (st) {
        st.textContent = copied
          ? '已复制「上海大学通信学院」，打开微信粘贴搜索关注即可。'
          : '微信里搜索：上海大学通信学院';
      }
      $('copyBtn').classList.toggle('is-copied', copied);
      setZhiMood(2);
    });
  }

  /* ---------- 3. 首屏俯冲短句拆词 ---------- */
  var phraseEls = [].slice.call(document.querySelectorAll('.phrase'));
  var PHRASE_WINS = [
    [0.18, 0.44],
    [0.45, 0.70],
    [0.72, 0.94]
  ];
  phraseEls.forEach(function (el) {
    var mainEl = el.querySelector('.phrase-main');
    if (!mainEl) return;
    var txt = mainEl.textContent || '';
    mainEl.setAttribute('aria-label', txt);
    mainEl.innerHTML = txt.split('').map(function (ch) {
      return '<span class="ph-ch" aria-hidden="true">' + esc(ch) + '</span>';
    }).join('');
    el._chars = [].slice.call(mainEl.children);
    el._sub = el.querySelector('.phrase-sub');
  });

  /* ---------- 4. 滚动联动：首屏镜头、逐句浮现、横向卡片平移 ---------- */
  var hero = $('hero');
  var hdr = $('hdr');
  var heroCopy = $('heroCopy');
  var heroAside = $('heroAside');
  var heroVeil = $('heroVeil');
  var cv = $('contourCv');
  var fb = $('contourFb');
  var pgSec = $('programs');
  var pgRail = $('pgRail');
  var pgTrack = $('pgTrack');
  var pgBar = $('pgBar');
  var pgCounter = $('pgCounter');
  var pgPrev = $('pgPrev');
  var pgNext = $('pgNext');

  var Contour = window.Contour || { ok: false, setProgress: function () {}, start: function () {}, stop: function () {}, frame: function () {} };
  var pgTravel = 0;
  var heroVisible = true;
  var scrollTicking = false;
  var headlessY = null;

  var navLinks = [].slice.call(document.querySelectorAll('.nav a'));
  var navOrder = ['about', 'honors', 'programs', 'people', 'news', 'join'];
  function syncNavActive() {
    var line = Math.min(220, innerHeight * 0.28);
    var activeId = '';
    for (var i = 0; i < navOrder.length; i++) {
      var el = $(navOrder[i]);
      if (el && el.getBoundingClientRect().top <= line) {
        activeId = '#' + navOrder[i];
      }
    }
    navLinks.forEach(function (a) {
      var match = a.getAttribute('href') === activeId;
      a.classList.toggle('is-active', match);
      if (match) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smoothstep(a, b, x) {
    var t = clamp01((x - a) / (b - a));
    return t * t * (3 - 2 * t);
  }

  function measurePrograms() {
    if (!pgSec || !pgRail || !pgTrack) return;
    if (reduce) {
      pgSec.style.height = 'auto';
      pgTrack.style.transform = 'none';
      pgTravel = 0;
      return;
    }
    pgTravel = Math.max(0, pgTrack.scrollWidth - pgRail.clientWidth);
    pgSec.style.height = Math.round(innerHeight + pgTravel * 1.08) + 'px';
  }

  function updateOnScroll() {
    scrollTicking = false;
    var sy = headlessY != null ? headlessY : (window.pageYOffset || document.documentElement.scrollTop || 0);
    var heroSpan = Math.max(1, hero.offsetHeight - innerHeight);
    var p = clamp01(sy / heroSpan);

    Contour.setProgress(p);
    if (reduce && Contour.ok && p < 1) Contour.frame();

    // 首屏标题区缓慢上浮淡出
    var fadeHero = smoothstep(0.02, 0.19, p);
    var heroOp = (1 - fadeHero).toFixed(3);
    if (heroCopy) {
      heroCopy.style.opacity = heroOp;
      heroCopy.style.transform = 'translate3d(0,' + (-fadeHero * 54).toFixed(1) + 'px,0)';
      heroCopy.style.pointerEvents = fadeHero > 0.85 ? 'none' : '';
    }
    if (heroAside) {
      heroAside.style.opacity = heroOp;
    }
    if (heroVeil) {
      heroVeil.style.opacity = heroOp;
    }

    // 俯冲过程三句短句依次浮现
    phraseEls.forEach(function (el, idx) {
      var win = PHRASE_WINS[idx];
      var a = win[0], b = win[1];
      var enter = smoothstep(a, a + 0.06, p);
      var exit = smoothstep(b - 0.065, b, p);
      var vis = enter * (1 - exit);
      el.style.opacity = vis.toFixed(3);
      el.style.transform = 'translate3d(0,' + ((1 - enter) * 24 - exit * 28).toFixed(1) + 'px,0)';
      var chars = el._chars || [];
      var spanIn = Math.min(0.11, (b - a) * 0.44);
      for (var c = 0; c < chars.length; c++) {
        var cStart = a + (chars.length > 1 ? (c / (chars.length - 1)) * spanIn : 0);
        var cv0 = smoothstep(cStart, cStart + 0.055, p);
        chars[c].style.opacity = cv0.toFixed(3);
        chars[c].style.transform = 'translate3d(0,' + ((1 - cv0) * 0.36).toFixed(3) + 'em,0)';
      }
      if (el._sub) {
        var sv = smoothstep(a + 0.05, a + 0.13, p);
        el._sub.style.opacity = (sv * 0.85).toFixed(3);
      }
    });

    // 首屏滚出视口后隐藏画布并停止 WebGL 帧循环
    var inHero = p < 0.998;
    if (inHero !== heroVisible) {
      heroVisible = inHero;
      if (cv) cv.style.visibility = inHero ? '' : 'hidden';
      if (fb) fb.style.visibility = (inHero && !Contour.ok) ? '' : 'hidden';
      if (inHero && !document.hidden) Contour.start();
      else Contour.stop();
    }
    if (!Contour.ok && fb) {
      fb.style.opacity = (1 - smoothstep(0.75, 0.99, p)).toFixed(3);
    }

    // 顶栏深浅色切换与导航高亮
    if (hdr) {
      hdr.classList.toggle('is-dark', p > 0.78);
    }
    syncNavActive();

    // 02 活动卡片横向平移
    if (pgSec && !reduce && pgTravel > 0) {
      var denom = Math.max(1, pgSec.offsetHeight - innerHeight);
      var q;
      if (headlessY != null) {
        var pgTop = hero.offsetHeight + pgSec.offsetTop;
        q = clamp01((sy - pgTop) / denom);
      } else {
        var rect = pgSec.getBoundingClientRect();
        q = clamp01(-rect.top / denom);
      }
      pgTrack.style.transform = 'translate3d(' + (-q * pgTravel).toFixed(1) + 'px,0,0)';
      if (pgBar) pgBar.style.transform = 'scaleX(' + q.toFixed(3) + ')';
      var totalCards = programs.length || 5;
      var curIdx = Math.min(totalCards, Math.max(1, Math.round(q * (totalCards - 1)) + 1));
      if (pgCounter) pgCounter.textContent = pad2(curIdx) + ' / ' + pad2(totalCards);
      if (pgPrev) pgPrev.disabled = q <= 0.02;
      if (pgNext) pgNext.disabled = q >= 0.98;
    }
  }

  function requestScrollUpdate() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(updateOnScroll);
    }
  }

  // 活动区左右切换按钮 & 鼠标拖拽联动竖向滚动位置
  function stepProgramCard(dir) {
    if (!pgSec || programs.length < 2) return;
    if (reduce || pgTravel <= 0) {
      if (pgRail) pgRail.scrollBy({ left: dir * 340, behavior: reduce ? 'auto' : 'smooth' });
      return;
    }
    var rect = pgSec.getBoundingClientRect();
    var sy = window.pageYOffset || document.documentElement.scrollTop || 0;
    var secTop = sy + rect.top;
    var denom = Math.max(1, pgSec.offsetHeight - innerHeight);
    var curQ = clamp01(-rect.top / denom);
    var step = 1 / (programs.length - 1);
    var nextIdx = Math.min(programs.length - 1, Math.max(0, Math.round(curQ / step) + dir));
    window.scrollTo({ top: secTop + nextIdx * step * denom, behavior: 'smooth' });
  }
  if (pgPrev) pgPrev.addEventListener('click', function () { stepProgramCard(-1); });
  if (pgNext) pgNext.addEventListener('click', function () { stepProgramCard(1); });

  if (pgRail && !coarse) {
    var dragState = { on: false, startX: 0, startScrollY: 0 };
    pgRail.addEventListener('pointerdown', function (e) {
      if (e.button !== 0 || (e.target && e.target.closest('a, button'))) return;
      dragState.on = true;
      dragState.startX = e.clientX;
      dragState.startScrollY = window.pageYOffset || 0;
      pgRail.classList.add('is-dragging');
    }, { passive: true });
    addEventListener('pointermove', function (e) {
      if (!dragState.on || pgTravel <= 0) return;
      var dx = e.clientX - dragState.startX;
      window.scrollTo(0, dragState.startScrollY - dx * 1.15);
    }, { passive: true });
    addEventListener('pointerup', function () {
      if (dragState.on) {
        dragState.on = false;
        pgRail.classList.remove('is-dragging');
      }
    }, { passive: true });
  }

  addEventListener('scroll', requestScrollUpdate, { passive: true });
  addEventListener('resize', function () {
    measurePrograms();
    requestScrollUpdate();
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) Contour.stop();
    else if (heroVisible) Contour.start();
  });

  /* ---------- 5. 区块渐入（带非 rAF 兜底） ---------- */
  if ('IntersectionObserver' in window) {
    var rvIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          rvIO.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px' });

    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) {
      rvIO.observe(el);
    });
  } else {
    document.documentElement.classList.add('settled');
    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) {
      el.style.transition = 'none';
      el.classList.add('in');
    });
  }

  // 非 requestAnimationFrame 硬兜底：确保后台标签页或慢速环境下首屏与视口元素到位
  setTimeout(function () {
    document.documentElement.classList.add('settled');
    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < innerHeight * 1.15) el.classList.add('in');
    });
  }, 2300);

  /* ---------- 6. 启动与 ?at=像素 截图自检支持 ---------- */
  var atMatch = /[?&]at=(\d+)/.exec(location.search);
  measurePrograms();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      measurePrograms();
      updateOnScroll();
    });
  }

  function applyAtParam() {
    if (!atMatch) return;
    var targetY = parseInt(atMatch[1], 10);
    document.documentElement.classList.add('settled');
    document.documentElement.style.scrollBehavior = 'auto';
    measurePrograms();
    [].forEach.call(document.querySelectorAll('[data-rv]'), function (el) {
      el.style.transition = 'none';
      el.classList.add('in');
    });
    if (/Headless/i.test(navigator.userAgent || '')) {
      // 无头浏览器 --screenshot 固定截取文档顶部 (0,0)，用等效视口位移完整呈现任意滚动位置与吸顶层
      var mainEl = $('top');
      var hStage = $('heroStage');
      var pSticky = $('pgSticky');
      if (mainEl) mainEl.style.transform = '';
      if (hStage) hStage.style.transform = '';
      if (pSticky) pSticky.style.transform = '';
      var hSpan = Math.max(1, hero.offsetHeight - innerHeight);
      var pTop = hero.offsetHeight + pgSec.offsetTop;
      var pSpan = Math.max(1, pgSec.offsetHeight - innerHeight);
      headlessY = targetY;
      if (mainEl) mainEl.style.transform = 'translate3d(0,' + (-targetY) + 'px,0)';
      if (hStage) hStage.style.transform = 'translate3d(0,' + Math.min(targetY, hSpan) + 'px,0)';
      if (pSticky) pSticky.style.transform = 'translate3d(0,' + Math.max(0, Math.min(targetY - pTop, pSpan)) + 'px,0)';
    } else {
      window.scrollTo(0, targetY);
    }
    updateOnScroll();
    if (Contour.ok && heroVisible) Contour.frame();
  }

  addEventListener('load', function () {
    measurePrograms();
    applyAtParam();
    updateOnScroll();
  });

  if (atMatch) applyAtParam();
  updateOnScroll();
  if (!document.hidden && heroVisible) Contour.start();
})();
