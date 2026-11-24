/* =====================================================================
 * 上海大学人工智能社 · v16-scope 页面数据绑定与滚动调台控制器
 * 所有事实与列表均从 window.CLUB 渲染，HTML 插入严格转义
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var CLUB = window.CLUB || {};

  function esc(val) {
    return String(val == null ? '' : val)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, txt) {
    var el = byId(id);
    if (el && txt != null) el.textContent = String(txt);
  }

  /* -------------------------------------------------------------------
   * 1. 从 window.CLUB 渲染全部真实内容（严禁编造）
   * ------------------------------------------------------------------- */
  var meta = CLUB.meta || {};
  var programs = Array.isArray(CLUB.programs) ? CLUB.programs : [];
  var news = Array.isArray(CLUB.news) ? CLUB.news : [];
  var honors = Array.isArray(CLUB.honors) ? CLUB.honors : [];
  var people = CLUB.people || {};
  var join = CLUB.join || {};

  var catNameMap = {};
  for (var pi = 0; pi < programs.length; pi++) {
    catNameMap[programs[pi].id] = programs[pi].name;
  }

  function renderClubData(onFocusChange) {
    var newsTotal = news.length || 16;

    if (meta.name) {
      setText('top-club-name', meta.name);
      setText('h-ch1', meta.name);
      setText('foot-club-name', meta.name);
    }
    if (meta.host) {
      setText('top-host-label', meta.host + '挂靠');
    }
    if (meta.founded) {
      setText('stat-founded', meta.founded);
    }
    if (programs.length) {
      setText('stat-progs', programs.length);
    }
    setText('stat-news', newsTotal);
    setText('top-news-count', newsTotal);
    setText('ch3-news-total', newsTotal);
    setText('btn-news-total', newsTotal);
    setText('modal-news-count', newsTotal);

    if (meta.type || meta.location) {
      var shortLoc = (meta.location || '').split('（')[0].trim();
      setText('hero-type-host', (meta.type || '学术科技类学生社团') + (shortLoc ? ' · ' + shortLoc : ''));
    }
    if (meta.en || meta.founded || meta.host) {
      setText(
        'foot-club-sub',
        [meta.en || 'SHU AI Club', (meta.founded || 2021) + ' 年成立', '挂靠' + (meta.host || '通信与信息工程学院团委')].join(' · ')
      );
    }

    // 频道 2：5 种活动
    var progListEl = byId('prog-list');
    if (progListEl && programs.length) {
      var progHtml = '';
      for (var i = 0; i < programs.length; i++) {
        var pr = programs[i];
        progHtml +=
          '<li class="prog-card" data-focus-idx="' + i + '">' +
            '<div class="prog-main">' +
              '<div class="prog-top-line">' +
                '<span class="prog-idx">CH2.' + (i + 1) + '</span>' +
                '<h3 class="prog-name">' + esc(pr.name) + '</h3>' +
              '</div>' +
              '<p class="prog-desc">' + esc(pr.desc) + '</p>' +
            '</div>' +
            '<div class="prog-where">' + esc(pr.where || '待社团补充') + '</div>' +
          '</li>';
      }
      progListEl.innerHTML = progHtml;
      bindFocusCards(progListEl.querySelectorAll('.prog-card'), onFocusChange);
    }

    // 频道 3：从 16 篇报道挑 5 条最有分量的（覆盖五类活动与关键规模），并记录原始索引以联动波形峰值
    var featuredEl = byId('news-featured');
    if (featuredEl && news.length) {
      var targetDates = ['2026-10-26', '2026-05-11', '2026-04-13', '2024-12-09', '2024-09-24'];
      var picked = [];
      var usedIdx = {};

      for (var td = 0; td < targetDates.length; td++) {
        for (var ni = 0; ni < news.length; ni++) {
          if (!usedIdx[ni] && news[ni].date === targetDates[td]) {
            picked.push({ item: news[ni], rawIndex: ni });
            usedIdx[ni] = true;
            break;
          }
        }
      }
      for (var fk = 0; fk < news.length && picked.length < 5; fk++) {
        if (!usedIdx[fk]) {
          picked.push({ item: news[fk], rawIndex: fk });
          usedIdx[fk] = true;
        }
      }

      var nfHtml = '';
      for (var pIdx = 0; pIdx < picked.length; pIdx++) {
        var entry = picked[pIdx];
        var nw = entry.item;
        var cLabel = catNameMap[nw.cat] || '社团动态';
        nfHtml +=
          '<a class="nf-card" href="' + esc(nw.source || '#') + '" target="_blank" rel="noopener noreferrer" data-focus-idx="' + entry.rawIndex + '">' +
            '<div>' +
              '<div class="nf-meta"><span>' + esc(nw.date) + '</span><span class="nf-cat">' + esc(cLabel) + ' ↗</span></div>' +
              '<h3 class="nf-title">' + esc(nw.title) + '</h3>' +
              '<p class="nf-sum">' + esc(nw.summary) + '</p>' +
            '</div>' +
            '<span class="nf-link-hint">学院官网原文 ↗</span>' +
          '</a>';
      }
      featuredEl.innerHTML = nfHtml;
      bindFocusCards(featuredEl.querySelectorAll('.nf-card'), onFocusChange);
    }

    // 频道 4：社长、指导老师、四个部门
    var leaderSlot = byId('leader-slot');
    var leaders = Array.isArray(people.leaders) ? people.leaders : [];
    if (leaderSlot && leaders.length) {
      var ld = leaders[0];
      var photoHtml = ld.photo
        ? '<img class="leader-photo" src="../shared/img/' + esc(ld.photo) + '" alt="' + esc(ld.name) + '照片" width="60" height="74" loading="lazy">'
        : '';
      var awardsHtml = '';
      if (Array.isArray(ld.awards) && ld.awards.length) {
        awardsHtml = '<ul class="awards-list">';
        for (var aw = 0; aw < ld.awards.length; aw++) {
          awardsHtml += '<li>' + esc(ld.awards[aw]) + '</li>';
        }
        awardsHtml += '</ul>';
      }
      leaderSlot.innerHTML =
        '<article class="leader-card">' +
          '<div class="leader-top">' +
            photoHtml +
            '<div>' +
              '<h3 class="leader-name">' + esc(ld.name) + '<span class="leader-role">' + esc(ld.role) + '</span></h3>' +
              '<p class="leader-desc">' + esc(ld.desc) + '</p>' +
            '</div>' +
          '</div>' +
          awardsHtml +
        '</article>';
    }

    var teachersSlot = byId('teachers-slot');
    var teachers = Array.isArray(people.teachers) ? people.teachers : [];
    if (teachersSlot && teachers.length) {
      var thHtml = '';
      for (var ti = 0; ti < teachers.length; ti++) {
        var tc = teachers[ti];
        thHtml +=
          '<article class="teacher-card">' +
            '<h3 class="teacher-name">' + esc(tc.name) + '</h3>' +
            '<span class="teacher-role">' + esc(tc.role) + '</span>' +
            '<p class="teacher-desc">' + esc(tc.desc) + '</p>' +
          '</article>';
      }
      teachersSlot.innerHTML = thHtml;
    }

    var deptsEl = byId('depts-list');
    var depts = Array.isArray(meta.departments) ? meta.departments : [];
    if (deptsEl && depts.length) {
      var dpHtml = '';
      for (var di = 0; di < depts.length; di++) {
        dpHtml += '<li><strong>' + esc(depts[di].name) + '</strong>' + esc(depts[di].desc) + '</li>';
      }
      deptsEl.innerHTML = dpHtml;
    }

    // 频道 5：加入三步 + 公众号名 + FAQ
    var stepsEl = byId('join-steps');
    var steps = Array.isArray(join.steps) ? join.steps : [];
    if (stepsEl && steps.length) {
      var stHtml = '';
      for (var si = 0; si < steps.length; si++) {
        stHtml +=
          '<li class="join-step">' +
            '<span class="join-step-num">0' + (si + 1) + '</span>' +
            '<strong>' + esc(steps[si].t) + '</strong>' +
            '<span>' + esc(steps[si].d) + '</span>' +
          '</li>';
      }
      stepsEl.innerHTML = stHtml;
    }

    if (meta.contact && meta.contact.wechat) {
      var cleanWx = meta.contact.wechat.replace(/（.*?）|\(.*?\)/g, '').trim();
      if (cleanWx) {
        setText('wx-account-name', cleanWx);
        var clipEl = byId('wx-clip-input');
        if (clipEl) clipEl.value = cleanWx;
      }
    }

    var faqEl = byId('faq-list');
    var faqs = Array.isArray(join.faq) ? join.faq : [];
    if (faqEl && faqs.length) {
      var fqHtml = '';
      for (var qi = 0; qi < faqs.length; qi++) {
        var openCls = qi === 0 ? ' is-open' : '';
        var expanded = qi === 0 ? 'true' : 'false';
        fqHtml +=
          '<div class="faq-item' + openCls + '">' +
            '<button class="faq-q" type="button" aria-expanded="' + expanded + '">' +
              '<span>' + esc(faqs[qi].q) + '</span>' +
              '<span class="faq-q-icon" aria-hidden="true">' + (qi === 0 ? '−' : '+') + '</span>' +
            '</button>' +
            '<p class="faq-a">' + esc(faqs[qi].a) + '</p>' +
          '</div>';
      }
      faqEl.innerHTML = fqHtml;

      faqEl.addEventListener('click', function (e) {
        var btn = e.target.closest('.faq-q');
        if (!btn) return;
        var item = btn.parentElement;
        var willOpen = !item.classList.contains('is-open');
        var siblings = faqEl.querySelectorAll('.faq-item');
        for (var s = 0; s < siblings.length; s++) {
          siblings[s].classList.remove('is-open');
          var sb = siblings[s].querySelector('.faq-q');
          var ic = siblings[s].querySelector('.faq-q-icon');
          if (sb) sb.setAttribute('aria-expanded', 'false');
          if (ic) ic.textContent = '+';
        }
        if (willOpen) {
          item.classList.add('is-open');
          btn.setAttribute('aria-expanded', 'true');
          var icon = item.querySelector('.faq-q-icon');
          if (icon) icon.textContent = '−';
        }
      });
    }

    // 归档抽屉：3 项承办协办荣誉 + 全部 16 篇报道（含分类筛选）
    var honorsEl = byId('honors-list');
    if (honorsEl && honors.length) {
      var hHtml = '';
      for (var hi = 0; hi < honors.length; hi++) {
        var hn = honors[hi];
        hHtml +=
          '<li class="honor-row">' +
            '<a href="' + esc(hn.source || '#') + '" target="_blank" rel="noopener noreferrer">' +
              '<div class="an-top"><span>' + esc(hn.year) + '</span><span class="an-cat">学院官网记录 ↗</span></div>' +
              '<p class="an-title">' + esc(hn.text) + '</p>' +
            '</a>' +
          '</li>';
      }
      honorsEl.innerHTML = hHtml;
    }

    renderArchiveFiltersAndNews('all');
  }

  function renderArchiveFiltersAndNews(activeCat) {
    var filterWrap = byId('archive-filters');
    var listWrap = byId('archive-news-list');
    if (!filterWrap || !listWrap) return;

    var chips = '<button class="filter-chip' + (activeCat === 'all' ? ' is-on' : '') + '" type="button" data-cat="all">全部 (' + news.length + ')</button>';
    for (var i = 0; i < programs.length; i++) {
      var pr = programs[i];
      var cnt = 0;
      for (var j = 0; j < news.length; j++) {
        if (news[j].cat === pr.id) cnt++;
      }
      chips += '<button class="filter-chip' + (activeCat === pr.id ? ' is-on' : '') + '" type="button" data-cat="' + esc(pr.id) + '">' + esc(pr.name) + ' (' + cnt + ')</button>';
    }
    filterWrap.innerHTML = chips;

    var nHtml = '';
    for (var k = 0; k < news.length; k++) {
      var item = news[k];
      if (activeCat !== 'all' && item.cat !== activeCat) continue;
      var catTxt = catNameMap[item.cat] || '社团报道';
      nHtml +=
        '<li class="an-row">' +
          '<a href="' + esc(item.source || '#') + '" target="_blank" rel="noopener noreferrer">' +
            '<div class="an-top"><span>' + esc(item.date) + '</span><span class="an-cat">' + esc(catTxt) + ' · 查看学院原文 ↗</span></div>' +
            '<h4 class="an-title">' + esc(item.title) + '</h4>' +
            '<p class="an-sum">' + esc(item.summary) + '</p>' +
          '</a>' +
        '</li>';
    }
    listWrap.innerHTML = nHtml;
  }

  function bindFocusCards(nodeList, onFocusChange) {
    if (!onFocusChange) return;
    for (var i = 0; i < nodeList.length; i++) {
      (function (el) {
        var idx = parseInt(el.getAttribute('data-focus-idx'), 10);
        el.addEventListener('pointerenter', function () { onFocusChange(idx); });
        el.addEventListener('pointerleave', function () { onFocusChange(-1); });
        el.addEventListener('focusin', function () { onFocusChange(idx); });
        el.addEventListener('focusout', function () { onFocusChange(-1); });
      })(nodeList[i]);
    }
  }

  /* -------------------------------------------------------------------
   * 2. 五拍滚动调谐与锁定控制器（40% 动作 → 45% 静止可读 → 15% 过渡）
   * ------------------------------------------------------------------- */
  var CHANNELS = [
    {
      title: '频道 1 · 社团是什么 · ' + (meta.founded || 2021) + ' 年成立',
      freq: 20.21,
      snr: 48.0,
      caption: '扫描线实时绘制轮廓 · 移动指针可微扰波形 · 向下滑动拧动频道'
    },
    {
      title: '频道 2 · 平时做什么 · ' + (programs.length || 5) + ' 类常态活动',
      freq: 25.00,
      snr: 46.5,
      caption: '五路日常活动调制波 · 悬停下方卡片可单独放大对应频段'
    },
    {
      title: '频道 3 · 做过的事 · ' + (news.length || 16) + ' 篇学院报道',
      freq: 16.00,
      snr: 49.2,
      caption: '2022–2026 十六次报道真实时间脉冲 · 悬停卡片定位日期峰值'
    },
    {
      title: '频道 4 · 谁在带大家 · ' + ((meta.departments && meta.departments.length) || 4) + ' 个社团部门',
      freq: 34.00,
      snr: 47.8,
      caption: '3:4 锁相李萨如谐振图 · 社长、指导老师与四部门协同运转'
    },
    {
      title: '频道 5 · 怎么加入 · 全校零基础可来',
      freq: 50.00,
      snr: 50.0,
      caption: '吉祥物「小智」XY 矢量欢迎信号 · 复制公众号即可关注招新'
    }
  ];

  var rootEl = document.documentElement;
  var trackEl = byId('scope-track');
  var stageEl = byId('scope-stage');
  var screenEl = byId('crt-screen');
  var canvasEl = byId('scope-canvas');
  var panels = [
    byId('sec-ch1'),
    byId('sec-ch2'),
    byId('sec-ch3'),
    byId('sec-ch4'),
    byId('sec-ch5')
  ];
  var scaleBtns = document.querySelectorAll('.channel-scale .scale-btn');

  var teleLockEl = byId('tele-lock');
  var teleLockTxt = byId('tele-lock-txt');
  var teleChTitle = byId('tele-ch-title');
  var teleFreq = byId('tele-freq');
  var teleSnr = byId('tele-snr');
  var teleProbeVal = byId('tele-probe-val');
  var waveCaption = byId('wave-caption');

  var deckChNum = byId('deck-ch-num');
  var deckMeterFill = byId('deck-meter-fill');
  var deckPhaseTag = byId('deck-phase-tag');
  var knobRotor = byId('knob-rotor');
  var knobBtn = byId('channel-knob');

  var reducedMotion = false;
  try {
    reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {}

  var scope = null;
  var currentBeat = 0;
  var headlessVirtualY = null;
  var headlessVirtualProg = null;

  renderClubData(function (focusIdx) {
    if (scope) scope.update({ focusIndex: focusIdx });
  });

  if (window.ScopeEngine) {
    scope = window.ScopeEngine.create(canvasEl, screenEl, {
      news: news,
      reducedMotion: reducedMotion,
      onProbe: function (txt) {
        if (teleProbeVal) teleProbeVal.textContent = txt;
      }
    });
  }

  var stickyEnabled = !!scope && !reducedMotion;
  if (stickyEnabled) {
    rootEl.classList.remove('fallback-flow');
    rootEl.classList.add('scope-ready');
    // 切换为 sticky 后刷新一次画布尺寸
    scope.resize();
  } else {
    rootEl.classList.remove('scope-ready');
    rootEl.classList.add('fallback-flow');
    if (scope) scope.resize();
  }

  function applyPanelVisual(activeIdx, alpha, offsetY) {
    for (var i = 0; i < panels.length; i++) {
      var p = panels[i];
      if (!p) continue;
      if (i === activeIdx) {
        p.classList.add('is-active');
        p.removeAttribute('inert');
        p.setAttribute('aria-hidden', 'false');
        p.style.opacity = alpha.toFixed(3);
        p.style.transform = 'translate3d(0,' + offsetY.toFixed(1) + 'px,0)';
      } else {
        p.classList.remove('is-active');
        p.setAttribute('inert', '');
        p.setAttribute('aria-hidden', 'true');
        p.style.opacity = '0';
        p.style.transform = 'translate3d(0,14px,0)';
      }
    }
  }

  function updateScaleButtons(idx) {
    for (var i = 0; i < scaleBtns.length; i++) {
      var active = i === idx;
      scaleBtns[i].classList.toggle('is-current', active);
      if (active) scaleBtns[i].setAttribute('aria-current', 'step');
      else scaleBtns[i].removeAttribute('aria-current');
    }
    if (knobBtn) {
      knobBtn.setAttribute('aria-label', '拧动频道旋钮切换到下一拍（当前第 ' + (idx + 1) + ' 拍，共 5 拍）');
    }
  }

  function syncScroll() {
    if (!stickyEnabled || !trackEl || !stageEl) return;

    var rect = trackEl.getBoundingClientRect();
    var maxScroll = Math.max(1, trackEl.offsetHeight - stageEl.offsetHeight);
    var scrolled = headlessVirtualProg !== null
      ? clamp(headlessVirtualProg * maxScroll, 0, maxScroll)
      : (headlessVirtualY !== null ? clamp(headlessVirtualY, 0, maxScroll) : clamp(-rect.top, 0, maxScroll));
    var totalProg = scrolled / maxScroll; // 0..1
    var raw = clamp(totalProg * 5, 0, 4.9999);
    var b = Math.floor(raw);
    var u = raw - b; // 本拍内进度 0..1

    var fromCh = b;
    var toCh = b;
    var morph = 0;
    var turbulence = 0;
    var locked = true;
    var panelIdx = b;
    var panelAlpha = 1;
    var panelY = 0;
    var phaseText = '已锁定 · 可读';

    if (b === 0) {
      // 第 1 拍（首屏）：0 秒起正文即完整可读；前 40% 微调谐波，40%-85% 完全静止，后 15% 失锁进入第 2 拍
      if (u <= 0.85) {
        fromCh = 0;
        toCh = 0;
        morph = 0;
        turbulence = u < 0.40 ? Math.sin((u / 0.40) * Math.PI) * 0.14 : 0;
        locked = turbulence < 0.06;
        panelIdx = 0;
        panelAlpha = 1;
        panelY = 0;
        phaseText = u < 0.40 && u > 0.02 ? '微调谐振' : '已锁定 · 可读';
      } else {
        var q0 = (u - 0.85) / 0.15;
        fromCh = 0;
        toCh = 1;
        morph = q0 * 0.32;
        turbulence = smoothstep(0, 1, q0) * 0.78;
        locked = false;
        panelIdx = 0;
        panelAlpha = 1 - smoothstep(0, 0.92, q0);
        panelY = -14 * q0;
        phaseText = '换台失锁...';
      }
    } else if (b < 4) {
      // 第 2–4 拍：40% 拧旋钮去噪锁定 → 45% 完全静止可读 → 15% 过渡换台
      if (u < 0.40) {
        var p = u / 0.40;
        fromCh = b - 1;
        toCh = b;
        morph = lerp(0.32, 1.0, smoothstep(0, 0.90, p));
        turbulence = (1 - smoothstep(0.20, 0.98, p)) * (0.78 + 0.18 * Math.sin(p * Math.PI));
        locked = p > 0.95;
        panelIdx = b;
        panelAlpha = smoothstep(0.28, 0.96, p);
        panelY = (1 - panelAlpha) * 16;
        phaseText = '调谐锁定 ' + Math.round(p * 100) + '%';
      } else if (u <= 0.85) {
        fromCh = b;
        toCh = b;
        morph = 1;
        turbulence = 0;
        locked = true;
        panelIdx = b;
        panelAlpha = 1;
        panelY = 0;
        phaseText = '已锁定 · 可读';
      } else {
        var q = (u - 0.85) / 0.15;
        fromCh = b;
        toCh = b + 1;
        morph = q * 0.32;
        turbulence = smoothstep(0, 1, q) * 0.78;
        locked = false;
        panelIdx = b;
        panelAlpha = 1 - smoothstep(0, 0.92, q);
        panelY = -14 * q;
        phaseText = '换台失锁...';
      }
    } else {
      // 第 5 拍（怎么加入）：前 40% 调谐锁定，40%-100% 全程稳态保持，直通底部页脚不消失
      if (u < 0.40) {
        var p4 = u / 0.40;
        fromCh = 3;
        toCh = 4;
        morph = lerp(0.32, 1.0, smoothstep(0, 0.90, p4));
        turbulence = (1 - smoothstep(0.20, 0.98, p4)) * (0.78 + 0.18 * Math.sin(p4 * Math.PI));
        locked = p4 > 0.95;
        panelIdx = 4;
        panelAlpha = smoothstep(0.28, 0.96, p4);
        panelY = (1 - panelAlpha) * 16;
        phaseText = '调谐锁定 ' + Math.round(p4 * 100) + '%';
      } else {
        fromCh = 4;
        toCh = 4;
        morph = 1;
        turbulence = 0;
        locked = true;
        panelIdx = 4;
        panelAlpha = 1;
        panelY = 0;
        phaseText = '已锁定 · 可读';
      }
    }

    currentBeat = panelIdx;
    applyPanelVisual(panelIdx, panelAlpha, panelY);
    updateScaleButtons(panelIdx);

    // 物理旋钮角度与进度读数
    var knobDeg = lerp(-100, 100, totalProg);
    if (knobRotor) knobRotor.style.transform = 'rotate(' + knobDeg.toFixed(1) + 'deg)';
    if (deckChNum) deckChNum.textContent = String(panelIdx + 1);
    if (deckMeterFill) deckMeterFill.style.transform = 'scaleX(' + ((panelIdx + 1) / 5).toFixed(2) + ')';
    if (deckPhaseTag) deckPhaseTag.textContent = phaseText;

    // 屏幕顶部仪器读数：调谐时数字跳动，锁定时稳态显示本节事实
    var chFromInfo = CHANNELS[fromCh] || CHANNELS[0];
    var chToInfo = CHANNELS[toCh] || CHANNELS[0];
    var curInfo = CHANNELS[panelIdx] || CHANNELS[0];

    if (teleLockEl && teleLockTxt) {
      teleLockEl.classList.toggle('is-tuning', !locked);
      teleLockEl.classList.toggle('is-locked', locked);
      teleLockTxt.textContent = locked ? '已锁定' : '调谐中';
    }

    if (teleChTitle) {
      teleChTitle.textContent = locked ? curInfo.title : '正在调谐 → 频道 ' + (toCh + 1) + ' …';
    }
    if (waveCaption) {
      waveCaption.textContent = curInfo.caption;
    }

    if (teleFreq && teleSnr) {
      if (locked) {
        teleFreq.textContent = curInfo.freq.toFixed(2) + ' kHz';
        teleSnr.textContent = curInfo.snr.toFixed(1) + ' dB';
      } else {
        var jitter = Math.sin(scrolled * 0.19) * 4.6 * turbulence;
        var fVal = lerp(chFromInfo.freq, chToInfo.freq, morph) + jitter;
        var sVal = Math.max(1.8, curInfo.snr * (1 - turbulence * 0.86));
        teleFreq.textContent = Math.abs(fVal).toFixed(2) + ' kHz';
        teleSnr.textContent = sVal.toFixed(1) + ' dB';
      }
    }

    scope.update({
      fromCh: fromCh,
      toCh: toCh,
      morph: morph,
      turbulence: turbulence,
      scrollPhase: scrolled * 0.012,
      activeCh: panelIdx,
      locked: locked
    });
  }

  // 平滑滚动到指定拍的“可读锁定段”正中央
  function scrollToChannel(chIndex, instant) {
    var idx = clamp(chIndex, 0, 4);
    if (!stickyEnabled || !trackEl || !stageEl) {
      var sec = panels[idx];
      if (sec) sec.scrollIntoView({ behavior: instant ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    var trackTop = trackEl.getBoundingClientRect().top + window.pageYOffset;
    var maxScroll = Math.max(1, trackEl.offsetHeight - stageEl.offsetHeight);
    var beatSpan = maxScroll / 5;
    var targetOffset = idx === 0 ? 0 : (idx + 0.56) * beatSpan;
    window.scrollTo({
      top: Math.round(trackTop + targetOffset),
      behavior: instant ? 'auto' : 'smooth'
    });
  }

  // 绑定所有 data-goto-ch 刻度与按钮（不劫持任何滚轮/触摸事件）
  document.addEventListener('click', function (e) {
    var gotoEl = e.target.closest('[data-goto-ch]');
    if (gotoEl) {
      e.preventDefault();
      var targetCh = parseInt(gotoEl.getAttribute('data-goto-ch'), 10);
      if (!isNaN(targetCh)) scrollToChannel(targetCh, reducedMotion);
      return;
    }
  });

  var brandHome = byId('brand-home');
  if (brandHome) {
    brandHome.addEventListener('click', function (e) {
      e.preventDefault();
      scrollToChannel(0, reducedMotion);
    });
  }

  if (knobBtn) {
    knobBtn.addEventListener('click', function () {
      var nextCh = (currentBeat + 1) % 5;
      scrollToChannel(nextCh, reducedMotion);
    });
  }

  // 荧光绿 / 琥珀色切换与脉冲校准按钮
  var phosBtn = byId('toggle-phosphor');
  var phosLabel = byId('phosphor-label');
  if (phosBtn) {
    phosBtn.addEventListener('click', function () {
      var nextMode = rootEl.getAttribute('data-phosphor') === 'amber' ? 'green' : 'amber';
      rootEl.setAttribute('data-phosphor', nextMode);
      phosBtn.setAttribute('aria-pressed', nextMode === 'amber' ? 'true' : 'false');
      if (phosLabel) phosLabel.textContent = nextMode === 'amber' ? '荧光：珀' : '荧光：绿';
      if (scope) scope.setPhosphor(nextMode);
    });
  }

  var calBtn = byId('btn-calibrate');
  if (calBtn) {
    calBtn.addEventListener('click', function () {
      if (scope) scope.calibrate();
    });
  }

  /* -------------------------------------------------------------------
   * 3. 公众号名复制（HTTP 兼容隐藏 textarea + execCommand，含失败兜底文案）
   * ------------------------------------------------------------------- */
  var copyBtn = byId('copy-wx-btn');
  var copyFeedback = byId('copy-wx-feedback');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var clipInput = byId('wx-clip-input');
      var wxName = (clipInput && clipInput.value) || '上海大学通信学院';
      var ok = false;
      if (clipInput) {
        try {
          clipInput.focus({ preventScroll: true });
          clipInput.select();
          clipInput.setSelectionRange(0, wxName.length);
          ok = document.execCommand('copy');
        } catch (err) {
          ok = false;
        }
        try {
          copyBtn.focus({ preventScroll: true });
        } catch (e2) {}
      }
      if (ok) {
        if (copyFeedback) copyFeedback.textContent = '已复制「' + wxName + '」，打开微信粘贴搜索即可关注。';
        copyBtn.textContent = '已复制公众号名 ✓';
        if (scope) scope.calibrate();
      } else {
        if (copyFeedback) copyFeedback.textContent = '微信里搜索：上海大学通信学院';
      }
    });
  }

  /* -------------------------------------------------------------------
   * 4. 全部 16 篇公开报道归档抽屉开关与键盘无障碍
   * ------------------------------------------------------------------- */
  var modalEl = byId('archive-modal');
  var openArchiveBtn = byId('open-archive-btn');
  var openArchiveTop = byId('open-archive-top');
  var closeArchiveBtn = byId('close-archive-btn');
  var archiveFilters = byId('archive-filters');
  var lastTriggerEl = null;

  function openArchive(trigger) {
    if (!modalEl) return;
    lastTriggerEl = trigger || document.activeElement;
    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');
    if (closeArchiveBtn) closeArchiveBtn.focus();
  }

  function closeArchive() {
    if (!modalEl || modalEl.hidden) return;
    modalEl.hidden = true;
    modalEl.setAttribute('aria-hidden', 'true');
    if (lastTriggerEl && lastTriggerEl.focus) {
      lastTriggerEl.focus();
    }
  }

  if (openArchiveBtn) {
    openArchiveBtn.addEventListener('click', function () { openArchive(openArchiveBtn); });
  }
  if (openArchiveTop) {
    openArchiveTop.addEventListener('click', function () { openArchive(openArchiveTop); });
  }
  if (closeArchiveBtn) {
    closeArchiveBtn.addEventListener('click', closeArchive);
  }
  if (modalEl) {
    modalEl.addEventListener('click', function (e) {
      if (e.target === modalEl) closeArchive();
    });
  }
  if (archiveFilters) {
    archiveFilters.addEventListener('click', function (e) {
      var chip = e.target.closest('.filter-chip');
      if (!chip) return;
      renderArchiveFiltersAndNews(chip.getAttribute('data-cat') || 'all');
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) {
      closeArchive();
    }
  });

  /* -------------------------------------------------------------------
   * 5. 原生滚动监听与 ?at=像素 / ?ch=频道 截图调试参数支持
   * ------------------------------------------------------------------- */
  window.addEventListener('scroll', syncScroll, { passive: true });
  window.addEventListener('resize', syncScroll, { passive: true });

  function applyQueryJump() {
    var search = window.location.search || '';
    var mAt = search.match(/[?&]at=(\d+)/);
    var mCh = search.match(/[?&]ch=([1-5])/);
    var isHeadless = /Headless/i.test(navigator.userAgent || '');

    if (mAt || mCh) {
      var imgs = document.querySelectorAll('img[loading="lazy"]');
      for (var ii = 0; ii < imgs.length; ii++) imgs[ii].loading = 'eager';
      if (scope) scope.skipIntro();

      var maxScroll = (trackEl && stageEl) ? Math.max(1, trackEl.offsetHeight - stageEl.offsetHeight) : 3600;
      var targetY = 0;
      if (mAt) {
        targetY = parseInt(mAt[1], 10);
      } else {
        var ch = parseInt(mCh[1], 10) - 1;
        targetY = ch === 0 ? 0 : Math.round(((ch + 0.56) / 5) * maxScroll);
      }

      if (isHeadless && stickyEnabled) {
        window.scrollTo(0, 0);
        if (mCh) {
          var cIdx = parseInt(mCh[1], 10) - 1;
          headlessVirtualProg = cIdx === 0 ? 0 : (cIdx + 0.56) / 5;
          headlessVirtualY = null;
        } else {
          headlessVirtualProg = null;
          headlessVirtualY = targetY;
        }
      } else {
        headlessVirtualProg = null;
        headlessVirtualY = null;
        window.scrollTo(0, targetY);
      }
      syncScroll();
      if (scope) scope.skipIntro();
    } else {
      syncScroll();
    }
  }

  applyQueryJump();
  window.addEventListener('load', applyQueryJump);
})(window, document);
