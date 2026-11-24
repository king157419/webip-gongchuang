/* =====================================================================
 * v14-toybox · 页面渲染与交互主逻辑
 * 所有社团事实均读取自 ../shared/content.js (window.CLUB)，严格 HTML 转义
 * ===================================================================== */
(function () {
  'use strict';

  var C = window.CLUB;
  if (!C) return;

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); };
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FINE_PTR = !!(window.matchMedia && window.matchMedia('(pointer: fine)').matches);

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function fmtDate(d) { return String(d || '').replace(/-/g, '.'); }
  function pad2(n) { return String(n).padStart(2, '0'); }

  var CAT_SHORT = {
    weld: '焊接课',
    course: '昇腾 AI 课',
    visit: '企业参访',
    contest: '创新大赛',
    talk: '分享会'
  };
  var CAT_COLOR = {
    weld: 'var(--c-weld)',
    course: 'var(--c-course)',
    visit: 'var(--c-visit)',
    contest: 'var(--c-contest)',
    talk: 'var(--c-talk)'
  };

  var NEWS = (C.news || []).slice();
  var TOTAL_NEWS = NEWS.length;

  // 拆分报道主副标题，既保留大字张力又不丢失完整事实
  function splitTitle(raw) {
    var s = String(raw || '').trim();
    var parts = s.split(/\s*[|｜丨]\s*|\s*——\s*/);
    if (parts.length > 1 && parts[0].trim()) {
      var head = parts[0].trim().replace(/^[“"]+|[”"]+$/g, '');
      var sub = parts.slice(1).join(' · ').trim();
      return { head: head, sub: sub };
    }
    return { head: s, sub: '' };
  }

  // 从报道摘要提取真实人数/队伍规模短标签（仅匹配原文已有词句，绝不杜撰）
  function extractScale(summary) {
    var m = String(summary || '').match(/(近\s*200\s*名同学|百余名学子|四十余名同学|近百名学子|报名百余人|14\s*支队伍|十支队伍|8\s*个专业方向|三组优秀作品)/);
    return m ? m[1].replace(/\s+/g, '') : '';
  }

  /* =====================================================================
   * 1. 首屏：顶部元数据 + 超大粗体 SHU Serif 900 逐字拼合入场
   * ===================================================================== */
  $('#hero-meta').textContent =
    C.meta.founded + ' 年成立 · ' + C.meta.host + '挂靠 · 全校零基础可来';

  var heroTitleEl = $('#hero-title');
  var heroChars = $$('.ht-ch', heroTitleEl);
  var heroDot = $('.ht-dot', heroTitleEl);
  var titleState = {
    intro: !REDUCE,
    running: false,
    t0: 0,
    last: 0,
    ptr: null,
    items: [],
    dotScale: REDUCE ? 1 : 0.2,
    dotVel: 0,
    fallbackId: 0
  };

  function resetHeroTitleDOM() {
    titleState.intro = false;
    titleState.running = false;
    heroChars.forEach(function (el) {
      el.style.transform = '';
      el.style.opacity = '';
    });
    if (heroDot) {
      heroDot.style.transform = '';
      heroDot.style.opacity = '';
    }
  }

  function setupHeroTitle() {
    if (REDUCE) {
      resetHeroTitleDOM();
      return;
    }

    // 初始带有错位与倾角，但保持可见度 >= 0.32，确保首屏 0.2s–1s 内即可清晰辨认社团名
    var offsets = [
      [-44, -32, -14], [18, -46, 11], [-22, 36, -9], [46, -24, 15],
      [-52, 28, 12], [-18, -38, -13], [26, 42, 10], [-28, -30, -11], [48, 30, 14]
    ];

    titleState.items = heroChars.map(function (el, i) {
      var o = offsets[i % offsets.length];
      var st = {
        el: el,
        cx: 0, cy: 0,
        x: o[0] + rand(-8, 8),
        y: o[1] + rand(-8, 8),
        r: o[2] + rand(-3, 3),
        s: 0.84,
        op: 0.34,
        vx: 0, vy: 0, vr: 0, vs: 0,
        tx: 0, ty: 0, tr: 0,
        delay: i * 0.038
      };
      el.style.opacity = st.op.toFixed(2);
      el.style.transform = 'translate3d(' + st.x.toFixed(1) + 'px,' + st.y.toFixed(1) + 'px,0) rotate(' + st.r.toFixed(1) + 'deg) scale(' + st.s + ')';
      return st;
    });

    if (heroDot) {
      heroDot.style.transform = 'scale(0.2)';
    }

    measureCharCenters();
    titleState.t0 = titleState.last = performance.now();
    kickHeroTitle();

    // 不依赖 requestAnimationFrame 的硬兜底（1.9 秒内必定归位，满足 <=2.5s 要求）
    clearTimeout(titleState.fallbackId);
    titleState.fallbackId = setTimeout(function () {
      if (titleState.intro) resetHeroTitleDOM();
    }, 1900);
  }

  function measureCharCenters() {
    var hr = heroTitleEl.getBoundingClientRect();
    titleState.items.forEach(function (st) {
      st.cx = st.el.offsetLeft + st.el.offsetWidth * 0.5;
      st.cy = st.el.offsetTop + st.el.offsetHeight * 0.5;
    });
    return hr;
  }

  function kickHeroTitle() {
    if (!titleState.running && !REDUCE) {
      titleState.running = true;
      titleState.last = performance.now();
      requestAnimationFrame(stepHeroTitle);
    }
  }

  function stepSpring(st, prop, vprop, target, k, c, dt) {
    var acc = -k * (st[prop] - target) - c * st[vprop];
    st[vprop] += acc * dt;
    st[prop] += st[vprop] * dt;
  }

  function stepHeroTitle(now) {
    if (!titleState.running) return;
    var dt = Math.min((now - titleState.last) / 1000, 0.08);
    titleState.last = now;
    var elapsed = (now - titleState.t0) / 1000;
    var subs = Math.max(2, Math.ceil(dt * 180));
    var h = dt / subs;
    var active = false;

    if (!titleState.intro) {
      titleState.items.forEach(function (st) {
        st.tx = st.ty = st.tr = 0;
        if (titleState.ptr) {
          var dx = st.cx - titleState.ptr.x;
          var dy = st.cy - titleState.ptr.y;
          var d = Math.hypot(dx, dy) || 1;
          var R = 135;
          if (d < R) {
            var f = (1 - d / R);
            f *= f;
            st.tx = (dx / d) * f * 16;
            st.ty = (dy / d) * f * 16;
            st.tr = (dx / d) * f * 5;
          }
        }
      });
    }

    for (var s = 0; s < subs; s++) {
      titleState.items.forEach(function (st) {
        if (titleState.intro && elapsed < st.delay) {
          active = true;
          return;
        }
        var k = titleState.intro ? 210 : 230;
        var c = titleState.intro ? 16 : 18;
        stepSpring(st, 'x', 'vx', st.tx, k, c, h);
        stepSpring(st, 'y', 'vy', st.ty, k, c, h);
        stepSpring(st, 'r', 'vr', st.tr, k, c, h);
        stepSpring(st, 's', 'vs', 1, k, c, h);
      });

      if (titleState.intro && elapsed > 0.32) {
        var da = -280 * (titleState.dotScale - 1) - 14 * titleState.dotVel;
        titleState.dotVel += da * h;
        titleState.dotScale += titleState.dotVel * h;
      }
    }

    titleState.items.forEach(function (st) {
      var localT = Math.max(0, elapsed - st.delay);
      var op = titleState.intro ? clamp(0.34 + localT * 3.2, 0.34, 1) : 1;
      st.el.style.opacity = op < 0.999 ? op.toFixed(3) : '';
      st.el.style.transform =
        'translate3d(' + st.x.toFixed(2) + 'px,' + st.y.toFixed(2) + 'px,0) rotate(' +
        st.r.toFixed(2) + 'deg) scale(' + st.s.toFixed(3) + ')';

      var energy =
        Math.abs(st.x - st.tx) + Math.abs(st.y - st.ty) +
        Math.abs(st.r - st.tr) + Math.abs(st.s - 1) * 40 +
        (Math.abs(st.vx) + Math.abs(st.vy)) * 0.05;
      if (energy > 0.22) active = true;
    });

    if (titleState.intro && heroDot) {
      heroDot.style.transform = 'scale(' + Math.max(0.1, titleState.dotScale).toFixed(3) + ')';
      if (elapsed < 1.15 || Math.abs(titleState.dotScale - 1) > 0.02) active = true;
    }

    if (titleState.intro && !active) {
      titleState.intro = false;
      if (heroDot) heroDot.style.transform = '';
    }

    if (active) {
      requestAnimationFrame(stepHeroTitle);
    } else {
      titleState.running = false;
      titleState.items.forEach(function (st) {
        st.el.style.transform = '';
        st.el.style.opacity = '';
      });
    }
  }

  if (FINE_PTR && !REDUCE) {
    heroTitleEl.addEventListener('pointermove', function (e) {
      if (titleState.intro) return;
      var r = heroTitleEl.getBoundingClientRect();
      titleState.ptr = { x: e.clientX - r.left, y: e.clientY - r.top };
      kickHeroTitle();
    });
    heroTitleEl.addEventListener('pointerleave', function () {
      titleState.ptr = null;
      kickHeroTitle();
    });
    window.addEventListener('resize', function () {
      if (!titleState.intro) measureCharCenters();
    });
  }

  /* =====================================================================
   * 2. 首屏玩具盒接线（5 种塑料胶囊 + 2 只透明底小智）
   * ===================================================================== */
  var ZHI_FACTS = [
    '小智播报：2024 年 12 月 AI 论文分享会，近 200 名同学把 CJ203 坐得满满当当。',
    '小智播报：2024 年 9 月，社团组织百余名上大学子去世博中心逛华为全联接大会。',
    '小智播报：2026 年 5 月华为昇腾大模型实践课，40 余名同学动手微调了 BERT。',
    '小智播报：2025 年 11 月，近百名同学跟着社团走进华为鸿蒙生态学堂上海站。',
    '小智播报：2025 年宏嘉书院焊接专项赛设焊接与 Vibe Coding 赛道，报名百余人。',
    '小智播报：2022 至 2026 年，通信学院官网一共报道过我们 ' + TOTAL_NEWS + ' 次活动。',
    '小智播报：不会写代码完全能来，焊接课是一对一从焊好第一个焊点开始教的。',
    '小智播报：社团 ' + C.meta.founded + ' 年成立，设' + (C.meta.departments || []).map(function (d) { return d.name; }).join('、') + ' 4 个部门。'
  ];
  var factIdx = 0;
  var toastTimer = 0;
  var zhiToast = $('#zhi-toast');

  function showZhiFact() {
    zhiToast.textContent = ZHI_FACTS[factIdx % ZHI_FACTS.length];
    factIdx++;
    zhiToast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      zhiToast.classList.remove('is-on');
    }, 3400);
  }

  var toyItems = (C.programs || []).map(function (p) {
    return {
      kind: 'capsule',
      id: p.id,
      label: CAT_SHORT[p.id] || p.name
    };
  });
  // 加入 2 个透明底立体小智（挥手款 + 星星眼欢呼款）
  toyItems.push({
    kind: 'zhi',
    id: 'zhi-wave',
    frame: 0,
    aria: '吉祥物小智（挥手款）：可抓起碰撞，点击听一条社团真实故事'
  });
  toyItems.push({
    kind: 'zhi',
    id: 'zhi-cheer',
    frame: 2,
    aria: '吉祥物小智（欢呼款）：可抓起碰撞，点击听一条社团真实故事'
  });

  var toyBox = window.ToyBox.create({
    stage: $('#toy-stage'),
    reduceMotion: REDUCE,
    onCapsuleClick: function (catId) {
      jumpToProgram(catId);
    },
    onZhiTap: function () {
      showZhiFact();
    }
  });
  toyBox.build(toyItems);

  $('#toy-reset').addEventListener('click', function () {
    toyBox.dropAll(true);
  });

  /* =====================================================================
   * 3. 报道瀑布流（16 篇，支持分类筛选 + 滚动浮现 + 桌面视差）
   * ===================================================================== */
  $('#news-total').textContent = String(TOTAL_NEWS);
  var filterBar = $('#news-filters');
  var masonryEl = $('#masonry');
  var activeCat = 'all';
  var masonryCols = [];
  var currentColCount = 0;

  var catCounts = { all: TOTAL_NEWS };
  NEWS.forEach(function (n) {
    catCounts[n.cat] = (catCounts[n.cat] || 0) + 1;
  });

  var filterDefs = [{ id: 'all', name: '全部报道', color: 'var(--ink)' }].concat(
    (C.programs || []).map(function (p) {
      return { id: p.id, name: CAT_SHORT[p.id] || p.name, color: CAT_COLOR[p.id] };
    })
  );

  filterBar.innerHTML = filterDefs.map(function (f) {
    var count = catCounts[f.id] || 0;
    return '<button class="flt-btn' + (f.id === 'all' ? ' is-on' : '') + '" type="button" data-flt="' + esc(f.id) + '" aria-pressed="' + (f.id === 'all' ? 'true' : 'false') + '">' +
      '<span class="flt-dot" style="background:' + f.color + '" aria-hidden="true"></span>' +
      '<span>' + esc(f.name) + '</span>' +
      '<span class="flt-num">' + count + '</span></button>';
  }).join('');

  // 生成全部 16 张报道卡 DOM（重点卡片用明亮玩具色底，其余用纸白/浅灰形成呼吸感）
  var COLORED_INDICES = { 0: true, 1: true, 4: true, 6: true, 9: true, 10: true, 14: true };
  var allNewsCards = NEWS.map(function (n, i) {
    var parts = splitTitle(n.title);
    var scaleChip = extractScale(n.summary);
    var useColor = !!COLORED_INDICES[i];
    var toneCls = useColor ? ('tone-' + n.cat) : (i % 2 === 0 ? 'tone-white' : '');
    var featCls = (i === 0 || i === 1 || i === 9) ? ' is-featured' : '';

    var a = document.createElement('a');
    a.className = 'n-card ' + toneCls + featCls;
    a.href = n.source;
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('data-cat', n.cat);
    a.setAttribute('aria-label', n.title + '（' + fmtDate(n.date) + '，新窗口打开学院官网报道）');

    a.innerHTML =
      '<div class="nc-head">' +
        '<span class="nc-date">' + esc(fmtDate(n.date)) + ' · #' + pad2(TOTAL_NEWS - i) + '</span>' +
        '<span class="nc-cat"><span class="nc-cat-dot" style="background:' + (CAT_COLOR[n.cat] || 'var(--ink)') + '"></span>' + esc(CAT_SHORT[n.cat] || n.cat) + '</span>' +
      '</div>' +
      '<h3 class="nc-title">' + esc(parts.head) + '</h3>' +
      (parts.sub ? '<p class="nc-sub">' + esc(parts.sub) + '</p>' : '') +
      '<p class="nc-sum">' + esc(n.summary) + '</p>' +
      '<div class="nc-foot">' +
        (scaleChip ? '<span class="nc-num-chip">' + esc(scaleChip) + '</span>' : '<span class="nc-num-chip">学院官网报道</span>') +
        '<span class="nc-go">读原文 <span class="nc-arrow" aria-hidden="true">↗</span></span>' +
      '</div>';
    return a;
  });

  var cardIO = null;
  function observeCards(list, immediate) {
    if (cardIO) cardIO.disconnect();
    if (REDUCE || immediate || !('IntersectionObserver' in window)) {
      list.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    cardIO = new IntersectionObserver(function (entries) {
      var visible = entries.filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return a.boundingClientRect.top - b.boundingClientRect.top; });
      visible.forEach(function (entry, idx) {
        var el = entry.target;
        el.style.transitionDelay = (idx * 65) + 'ms';
        el.classList.add('is-in');
        cardIO.unobserve(el);
        setTimeout(function () { el.style.transitionDelay = ''; }, 850 + idx * 65);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    list.forEach(function (el) {
      if (!el.classList.contains('is-in')) cardIO.observe(el);
    });
  }

  function getMasonryColCount() {
    var w = window.innerWidth;
    return w < 640 ? 1 : w < 1024 ? 2 : 3;
  }

  function renderMasonry(forceRebuild, immediateReveal) {
    var colsN = getMasonryColCount();
    if (!forceRebuild && colsN === currentColCount) return;
    currentColCount = colsN;

    masonryEl.innerHTML = '';
    masonryCols = [];
    for (var i = 0; i < colsN; i++) {
      var col = document.createElement('div');
      col.className = 'm-col';
      masonryEl.appendChild(col);
      masonryCols.push(col);
    }

    var filtered = allNewsCards.filter(function (card) {
      return activeCat === 'all' || card.getAttribute('data-cat') === activeCat;
    });

    var heights = masonryCols.map(function () { return 0; });
    filtered.forEach(function (card) {
      var minIdx = heights.indexOf(Math.min.apply(null, heights));
      masonryCols[minIdx].appendChild(card);
      heights[minIdx] += card.classList.contains('is-featured') ? 1.18 : 0.92;
    });

    observeCards(filtered, immediateReveal);
    updateMasonryParallax();
  }

  filterBar.addEventListener('click', function (e) {
    var btn = e.target.closest('.flt-btn');
    if (!btn) return;
    var nextCat = btn.getAttribute('data-flt');
    if (nextCat === activeCat) return;
    activeCat = nextCat;

    $$('.flt-btn', filterBar).forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    allNewsCards.forEach(function (c) { c.classList.add('is-in'); });
    renderMasonry(true, true);
  });

  function updateMasonryParallax() {
    if (REDUCE || currentColCount < 3 || masonryCols.length < 3) {
      masonryCols.forEach(function (c) { c.style.transform = ''; });
      return;
    }
    var r = masonryEl.getBoundingClientRect();
    if (r.bottom < -200 || r.top > window.innerHeight + 200) return;
    var rel = clamp(window.innerHeight - r.top, 0, r.height + window.innerHeight);
    masonryCols[1].style.transform = 'translate3d(0,' + (-rel * 0.045).toFixed(1) + 'px,0)';
    masonryCols[2].style.transform = 'translate3d(0,' + (-rel * 0.02).toFixed(1) + 'px,0)';
  }

  renderMasonry(true, false);

  /* =====================================================================
   * 4. 吸顶滚动刻度尺（年份 2022–2026 与累计报道数 01–16 随滚动推进）
   * ===================================================================== */
  var chronoNews = NEWS.slice().reverse(); // 按时间正序：2022.01 -> 2026.10
  var yearNums = NEWS.map(function (n) { return +n.date.slice(0, 4); });
  var minYear = Math.min.apply(null, yearNums);
  var maxYear = Math.max.apply(null, yearNums);
  var yearsList = [];
  for (var yr = minYear; yr <= maxYear; yr++) yearsList.push(yr);

  var yearGroups = yearsList.map(function (y) {
    var items = chronoNews.filter(function (n) { return +n.date.slice(0, 4) === y; });
    var byCat = {};
    items.forEach(function (n) { byCat[n.cat] = (byCat[n.cat] || 0) + 1; });
    var tags = Object.keys(byCat).map(function (k) { return (CAT_SHORT[k] || k) + ' ×' + byCat[k]; });
    return { year: y, items: items, count: items.length, tags: tags };
  });
  var cumByYear = [];
  yearGroups.reduce(function (acc, g, i) {
    cumByYear[i] = acc + g.count;
    return cumByYear[i];
  }, 0);

  $('#tl-max').textContent = pad2(TOTAL_NEWS);

  // 年份快捷按钮
  var rulerYearsEl = $('#ruler-years');
  rulerYearsEl.innerHTML = yearGroups.map(function (g, idx) {
    return '<button class="ry-btn" type="button" role="tab" data-yidx="' + idx + '">' +
      g.year + '<small>累计 ' + cumByYear[idx] + ' 篇</small></button>';
  }).join('');
  var yearBtns = $$('.ry-btn', rulerYearsEl);

  // 50 格精密刻度线
  var rulerTicksEl = $('#ruler-ticks');
  var ticksHTML = '';
  for (var t = 0; t <= 48; t++) {
    ticksHTML += '<span class="r-tick' + (t % 12 === 0 ? ' maj' : '') + '"></span>';
  }
  rulerTicksEl.innerHTML = ticksHTML;

  // 16 颗真实报道色标点（均匀对应 16 篇按时间排序的报道）
  var rulerPipsEl = $('#ruler-pips');
  var pipPositions = chronoNews.map(function (item, idx) {
    var yrVal = +item.date.slice(0, 4);
    return {
      pos: (idx + 0.5) / TOTAL_NEWS,
      item: item,
      yearIdx: yearsList.indexOf(yrVal)
    };
  });

  rulerPipsEl.innerHTML = pipPositions.map(function (p) {
    var pct = (p.pos * 100).toFixed(2);
    var col = CAT_COLOR[p.item.cat] || 'var(--c-weld)';
    return '<span class="r-pip" style="left:' + pct + '%;--pip-c:' + col + '"></span>';
  }).join('');
  var pipEls = $$('.r-pip', rulerPipsEl);

  var tlSec = $('#timeline');
  var tlYearEl = $('#tl-year');
  var tlCountEl = $('#tl-count');
  var tlCardEl = $('#tl-card');
  var rulerTrackEl = $('#ruler-track');
  var rulerFillEl = $('#ruler-fill');
  var rulerNeedleEl = $('#ruler-needle');
  var shownYearIdx = -1;
  var shownActiveItem = null;

  function renderTimelineCard(yIdx, curItem) {
    var g = yearGroups[yIdx];
    if (!g) return;
    tlCardEl.innerHTML =
      '<div class="tlc-head">' +
        '<h3 class="tlc-title">' + g.year + ' 年 · 当年共 ' + g.count + ' 篇报道（截至年底累计 ' + cumByYear[yIdx] + ' 篇）</h3>' +
        '<div class="tlc-tags">' + g.tags.map(function (tg) { return '<span class="tlc-tag">' + esc(tg) + '</span>'; }).join('') + '</div>' +
      '</div>' +
      '<ul class="tlc-list">' +
        g.items.map(function (n) {
          var sp = splitTitle(n.title);
          var isCur = n === curItem;
          return '<li class="' + (isCur ? 'is-cur-news' : '') + '"><time>' + esc(fmtDate(n.date).slice(5)) + '</time>' +
            '<a href="' + esc(n.source) + '" target="_blank" rel="noopener">' + esc(sp.head) + ' ↗</a></li>';
        }).join('') +
      '</ul>';
  }

  function setTimelineProgress(prog) {
    var trackInnerW = Math.max(0, rulerTrackEl.clientWidth - 20);
    rulerFillEl.style.transform = 'scaleX(' + prog.toFixed(4) + ')';
    rulerNeedleEl.style.transform = 'translate3d(' + (prog * trackInnerW).toFixed(1) + 'px,0,0)';

    var activeIdx = clamp(Math.floor(prog * TOTAL_NEWS), 0, TOTAL_NEWS - 1);
    if (prog >= 0.99) activeIdx = TOTAL_NEWS - 1;

    for (var i = 0; i < pipEls.length; i++) {
      pipEls[i].classList.toggle('is-lit', i <= activeIdx);
    }

    var displayCount = activeIdx + 1;
    tlCountEl.textContent = pad2(displayCount);

    var curItem = chronoNews[activeIdx];
    var yIdx = pipPositions[activeIdx] ? pipPositions[activeIdx].yearIdx : 0;

    if (yIdx !== shownYearIdx || curItem !== shownActiveItem) {
      shownYearIdx = yIdx;
      shownActiveItem = curItem;
      tlYearEl.textContent = String(yearGroups[yIdx].year);
      yearBtns.forEach(function (btn, idx) {
        var cur = idx === yIdx;
        btn.classList.toggle('is-cur', cur);
        btn.setAttribute('aria-selected', cur ? 'true' : 'false');
      });
      renderTimelineCard(yIdx, curItem);
    }
  }

  function updateTimeline(force) {
    if (REDUCE) {
      setTimelineProgress(1);
      return;
    }
    var rect = tlSec.getBoundingClientRect();
    if (!force && (rect.bottom < -100 || rect.top > window.innerHeight + 100)) return;
    var scrollable = Math.max(1, rect.height - window.innerHeight);
    setTimelineProgress(clamp(-rect.top / scrollable, 0, 1));
  }

  rulerYearsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.ry-btn');
    if (!btn) return;
    var idx = +btn.getAttribute('data-yidx');
    var targetP = clamp((cumByYear[idx] - 0.35) / TOTAL_NEWS, 0, 0.995);
    if (REDUCE) {
      setTimelineProgress(targetP);
      return;
    }
    var secTop = tlSec.getBoundingClientRect().top + window.pageYOffset;
    var scrollable = Math.max(1, tlSec.offsetHeight - window.innerHeight);
    window.scrollTo({ top: secTop + scrollable * targetP, behavior: 'smooth' });
  });

  updateTimeline(true);

  /* =====================================================================
   * 5. 横向可拖的彩色活动大卡（5 种活动，支持胶囊联动定位）
   * ===================================================================== */
  var progTrack = $('#prog-track');
  var progDots = $('#prog-dots');
  var progIndexEl = $('#prog-index');
  var prevBtn = $('#prog-prev');
  var nextBtn = $('#prog-next');

  progTrack.innerHTML = (C.programs || []).map(function (p, i) {
    var relNews = NEWS.filter(function (n) { return n.cat === p.id; });
    var recent = relNews.slice(0, 2);
    return '<article class="p-card" id="prog-' + esc(p.id) + '" data-cat="' + esc(p.id) + '">' +
      '<div class="pc-top">' +
        '<span>' + pad2(i + 1) + ' / ' + pad2(C.programs.length) + '</span>' +
        '<span class="pc-count-pill">官网报道 ' + relNews.length + ' 篇</span>' +
      '</div>' +
      '<h3 class="pc-title">' + esc(p.name) + '</h3>' +
      '<p class="pc-desc">' + esc(p.desc) + '</p>' +
      '<div class="pc-ticket">' +
        '<span class="pct-label">近期真实记录（点开看官网原文）</span>' +
        recent.map(function (rn) {
          var sp = splitTitle(rn.title);
          return '<a class="pct-item" href="' + esc(rn.source) + '" target="_blank" rel="noopener">' +
            '<span>' + esc(sp.head) + ' ↗</span>' +
            '<span class="pct-date">' + esc(fmtDate(rn.date)) + '</span>' +
          '</a>';
        }).join('') +
      '</div>' +
      '<div class="pc-where">' +
        '<span>常在：' + esc(p.where) + '</span>' +
        '<span>零基础可参加</span>' +
      '</div>' +
    '</article>';
  }).join('');

  progDots.innerHTML = (C.programs || []).map(function (p, i) {
    return '<button class="p-dot-btn' + (i === 0 ? ' is-on' : '') + '" type="button" data-pidx="' + i + '" data-pcat="' + esc(p.id) + '">' +
      '<span class="p-dot-swatch" style="background:' + (CAT_COLOR[p.id] || 'var(--ink)') + '"></span>' +
      '<span>' + esc(CAT_SHORT[p.id] || p.name) + '</span>' +
    '</button>';
  }).join('');

  var progCards = $$('.p-card', progTrack);
  var progDotBtns = $$('.p-dot-btn', progDots);

  function cardStepWidth() {
    if (progCards.length > 1) {
      return progCards[1].offsetLeft - progCards[0].offsetLeft;
    }
    return progTrack.clientWidth;
  }

  function syncProgControls() {
    var step = Math.max(1, cardStepWidth());
    var idx = clamp(Math.round(progTrack.scrollLeft / step), 0, progCards.length - 1);
    progIndexEl.textContent = pad2(idx + 1) + ' / ' + pad2(progCards.length);
    var maxScroll = progTrack.scrollWidth - progTrack.clientWidth - 3;
    prevBtn.disabled = progTrack.scrollLeft <= 3;
    nextBtn.disabled = progTrack.scrollLeft >= maxScroll;
    progDotBtns.forEach(function (b, k) { b.classList.toggle('is-on', k === idx); });
  }

  function scrollTrackToIndex(idx) {
    var card = progCards[clamp(idx, 0, progCards.length - 1)];
    if (!card) return;
    var padLeft = parseFloat(getComputedStyle(progTrack).paddingLeft) || 16;
    progTrack.scrollTo({
      left: Math.max(0, card.offsetLeft - padLeft),
      behavior: REDUCE ? 'auto' : 'smooth'
    });
  }

  function jumpToProgram(catId) {
    var sec = $('#programs');
    var targetIdx = (C.programs || []).findIndex(function (p) { return p.id === catId; });
    if (targetIdx < 0) targetIdx = 0;
    var card = progCards[targetIdx];

    if (sec) {
      sec.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
    }
    scrollTrackToIndex(targetIdx);

    if (card) {
      card.classList.remove('is-spotlight');
      void card.offsetWidth;
      card.classList.add('is-spotlight');
    }
  }

  prevBtn.addEventListener('click', function () {
    progTrack.scrollBy({ left: -cardStepWidth(), behavior: REDUCE ? 'auto' : 'smooth' });
  });
  nextBtn.addEventListener('click', function () {
    progTrack.scrollBy({ left: cardStepWidth(), behavior: REDUCE ? 'auto' : 'smooth' });
  });
  progDots.addEventListener('click', function (e) {
    var btn = e.target.closest('.p-dot-btn');
    if (!btn) return;
    scrollTrackToIndex(+btn.getAttribute('data-pidx'));
  });
  progTrack.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevBtn.click(); }
  });
  progTrack.addEventListener('scroll', function () {
    requestAnimationFrame(syncProgControls);
  }, { passive: true });

  // 鼠标抓握横向拖拽与惯性吸附
  (function () {
    var d = null;
    var wasDragged = false;
    progTrack.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      d = {
        startX: e.clientX,
        startScroll: progTrack.scrollLeft,
        lastX: e.clientX,
        lastT: performance.now(),
        vel: 0,
        moved: false
      };
      wasDragged = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!d) return;
      var dx = e.clientX - d.startX;
      if (!d.moved && Math.abs(dx) > 6) {
        d.moved = true;
        wasDragged = true;
        progTrack.classList.add('is-dragging');
      }
      if (d.moved) {
        progTrack.scrollLeft = d.startScroll - dx;
        var now = performance.now();
        var dt = Math.max(8, now - d.lastT);
        d.vel = (e.clientX - d.lastX) / dt;
        d.lastX = e.clientX;
        d.lastT = now;
        e.preventDefault();
      }
    });
    window.addEventListener('pointerup', function () {
      if (!d) return;
      var moved = d.moved, vel = d.vel;
      d = null;
      if (moved) {
        progTrack.classList.remove('is-dragging');
        var step = Math.max(1, cardStepWidth());
        var projected = progTrack.scrollLeft - vel * 240;
        var snapIdx = Math.round(projected / step);
        scrollTrackToIndex(snapIdx);
        setTimeout(function () { wasDragged = false; }, 60);
      }
    });
    progTrack.addEventListener('click', function (e) {
      if (wasDragged) {
        e.preventDefault();
        e.stopPropagation();
        wasDragged = false;
      }
    }, true);
    progTrack.addEventListener('dragstart', function (e) { e.preventDefault(); });
  })();

  syncProgControls();

  /* =====================================================================
   * 6. 社长、指导老师、四个部门与承办荣誉
   * ===================================================================== */
  $('#people-meta').textContent =
    C.meta.founded + ' 年成立 · 挂靠' + C.meta.host + ' · 面向' + C.meta.audience;

  var P = C.people || {};
  $('#people-grid').innerHTML =
    (P.leaders || []).map(function (p) {
      return '<article class="person-card is-leader">' +
        '<div class="leader-top">' +
          (p.photo
            ? '<img class="leader-photo" src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.role + p.name) + '照片" width="228" height="671" loading="lazy">'
            : '') +
          '<div>' +
            '<span class="p-role-badge">' + esc(p.role) + '</span>' +
            '<h3 class="p-name">' + esc(p.name) + '</h3>' +
            '<p class="p-bio">' + esc(p.desc) + '</p>' +
          '</div>' +
        '</div>' +
        (p.awards && p.awards.length
          ? '<ul class="award-list">' + p.awards.map(function (aw) { return '<li>' + esc(aw) + '</li>'; }).join('') + '</ul>'
          : '') +
      '</article>';
    }).join('') +
    (P.teachers || []).map(function (t) {
      var hasPhoto = t.photo && String(t.photo).trim() !== '' && t.photo !== '待补充';
      return '<article class="person-card is-teacher">' +
        (hasPhoto
          ? '<div class="leader-top">' +
              '<img class="leader-photo" src="../shared/img/' + esc(t.photo) + '" alt="' + esc(t.name) + '照片" loading="lazy">' +
              '<div>' +
                '<span class="p-role-badge">' + esc(t.role) + '</span>' +
                '<h3 class="p-name">' + esc(t.name) + '</h3>' +
                '<p class="p-bio">' + esc(t.desc) + '</p>' +
              '</div>' +
            '</div>'
          : '<div>' +
              '<span class="p-role-badge">' + esc(t.role) + '</span>' +
              '<h3 class="p-name">' + esc(t.name) + '</h3>' +
              '<p class="p-bio">' + esc(t.desc) + '</p>' +
            '</div>') +
        '<div class="teacher-foot">' +
          '<span>' + esc(C.meta.host) + '</span>' +
          (hasPhoto
            ? '<span>社团指导教师</span>'
            : '<span class="tbd-wrap">教师照片 <em class="tbd-badge">待补充</em></span>') +
        '</div>' +
      '</article>';
    }).join('');

  $('#dept-grid').innerHTML = (C.meta.departments || []).map(function (d, i) {
    return '<div class="dept-card">' +
      '<span class="dept-num">' + pad2(i + 1) + '</span>' +
      '<h4 class="dept-name">' + esc(d.name) + '</h4>' +
      '<p class="dept-desc">' + esc(d.desc) + '</p>' +
    '</div>';
  }).join('');

  var HONOR_TONES = ['hi-contest', 'hi-course', 'hi-weld'];
  $('#honor-list').innerHTML = (C.honors || []).map(function (h, idx) {
    return '<li class="honor-item ' + HONOR_TONES[idx % HONOR_TONES.length] + '">' +
      '<div class="hi-top">' +
        '<span class="honor-year">' + esc(h.year) + '</span>' +
        '<span class="hi-idx">#' + pad2(idx + 1) + '</span>' +
      '</div>' +
      '<p class="honor-text">' + esc(h.text) + '</p>' +
      (h.source ? '<a class="honor-link" href="' + esc(h.source) + '" target="_blank" rel="noopener">查看学院官网报道 <span aria-hidden="true">↗</span></a>' : '') +
    '</li>';
  }).join('');

  /* =====================================================================
   * 7. 加入我们 + 复制公众号（兼容 HTTP） + FAQ + 页脚
   * ===================================================================== */
  var joinData = C.join || {};
  $('#join-steps').innerHTML = (joinData.steps || []).map(function (s, i) {
    return '<li class="j-step">' +
      '<span class="js-num">步骤 ' + pad2(i + 1) + '</span>' +
      '<h3 class="js-title">' + esc(s.t) + '</h3>' +
      '<p class="js-desc">' + esc(s.d) + '</p>' +
    '</li>';
  }).join('');

  if (C.meta.location) {
    $('#wechat-loc').textContent = '常在地点：' + C.meta.location;
  }

  function isEmptyVal(v) {
    return v == null || String(v).trim() === '' || String(v).trim() === '待补充';
  }
  var contactObj = (C.meta && C.meta.contact) || {};
  var joinMetaItems = [
    { k: '集中招新时间', v: isEmptyVal(joinData.season) ? null : esc(joinData.season) },
    { k: '线上报名问卷', v: isEmptyVal(joinData.formUrl) ? null : '<a class="tbd-val-link" href="' + esc(joinData.formUrl) + '" target="_blank" rel="noopener">填写报名问卷 ↗</a>' },
    { k: '社团交流群', v: isEmptyVal(contactObj.qqGroup) ? null : esc(contactObj.qqGroup) },
    { k: '在册社员人数', v: isEmptyVal(C.meta && C.meta.members) ? null : esc(C.meta.members) + ' 人' }
  ];
  var joinTbdEl = $('#join-tbd-bar');
  if (joinTbdEl) {
    joinTbdEl.innerHTML = joinMetaItems.map(function (it) {
      return '<li class="join-tbd-item"><span class="tbd-key">' + esc(it.k) + '</span>' +
        (it.v ? '<span class="tbd-val">' + it.v + '</span>' : '<em class="tbd-badge">待补充</em>') +
      '</li>';
    }).join('');
  }

  var WX_NAME = '上海大学通信学院';
  $('#wechat-name').textContent = WX_NAME;
  $('#copy-btn').addEventListener('click', function () {
    var ta = $('#copy-ta');
    var fb = $('#copy-feedback');
    var ok = false;
    ta.value = WX_NAME;
    try {
      ta.focus({ preventScroll: true });
      ta.select();
      ta.setSelectionRange(0, WX_NAME.length);
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    ta.blur();
    fb.textContent = ok
      ? '已复制「' + WX_NAME + '」— 打开微信搜一搜粘贴即可关注。'
      : '微信里搜索：' + WX_NAME;
  });

  $('#faq-list').innerHTML = (joinData.faq || []).map(function (f, i) {
    return '<details' + (i === 0 ? ' open' : '') + '>' +
      '<summary><span>' + esc(f.q) + '</span><span class="faq-icon" aria-hidden="true"></span></summary>' +
      '<p class="faq-ans">' + esc(f.a) + '</p>' +
    '</details>';
  }).join('');

  $('#foot-name').textContent = C.meta.name;
  $('#foot-en').textContent = C.meta.en;
  $('#foot-meta').textContent =
    '挂靠' + C.meta.host + ' · ' + C.meta.founded + ' 年成立 · 全部事实整理自通信学院官网公开报道';

  /* =====================================================================
   * 8. 全局滚动监听、导航高亮与 ?at=像素 调试定位
   * ===================================================================== */
  var scrollTicking = false;
  window.addEventListener('scroll', function () {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      updateTimeline(false);
      updateMasonryParallax();
    });
  }, { passive: true });

  window.addEventListener('resize', function () {
    renderMasonry(false, false);
    updateTimeline(true);
    syncProgControls();
  });

  if ('IntersectionObserver' in window) {
    var navLinks = $$('.nav-link');
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) {
          a.classList.toggle('is-active', a.getAttribute('href') === '#' + en.target.id);
        });
      });
    }, { rootMargin: '-42% 0px -52% 0px' });
    ['news', 'timeline', 'programs', 'honors', 'people', 'join'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) secIO.observe(el);
    });
  }

  // 启动首屏逐字拼合与 2D 刚体掉落
  setupHeroTitle();
  toyBox.dropAll(true);

  // 支持 ?at=像素 直接定位到指定区块（兼容无头 Edge --screenshot 视口裁剪在 0,0 的特性）
  var atMatch = /[?&]at=(\d+)/.exec(window.location.search);
  if (atMatch) {
    var targetY = +atMatch[1];
    document.documentElement.style.scrollBehavior = 'auto';
    resetHeroTitleDOM();
    toyBox.dropAll(false);
    allNewsCards.forEach(function (c) { c.classList.add('is-in'); });

    var applyAt = function () {
      if (/Headless/i.test(navigator.userAgent)) {
        var mainEl = document.getElementById('main');
        var footEl = document.querySelector('.site-foot');
        mainEl.style.transform = '';
        if (footEl) footEl.style.transform = '';
        var maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        var y = clamp(targetY, 0, maxY);
        var tlTop = tlSec.offsetTop;
        var tlH = tlSec.offsetHeight;
        var vh = window.innerHeight;
        var stickyEl = $('.tl-sticky', tlSec);
        if (y >= tlTop && y <= tlTop + tlH - vh) {
          var p = clamp((y - tlTop) / Math.max(1, tlH - vh), 0, 1);
          stickyEl.style.position = 'relative';
          stickyEl.style.transform = 'translate3d(0,' + (y - tlTop) + 'px,0)';
          setTimelineProgress(p);
        } else if (y > tlTop + tlH - vh) {
          stickyEl.style.position = 'relative';
          stickyEl.style.transform = 'translate3d(0,' + Math.max(0, tlH - vh) + 'px,0)';
          setTimelineProgress(1);
        }
        var shift = 'translate3d(0,-' + y + 'px,0)';
        mainEl.style.transform = shift;
        if (footEl) footEl.style.transform = shift;
      } else {
        window.scrollTo(0, targetY);
        updateTimeline(true);
        updateMasonryParallax();
      }
    };
    applyAt();
    window.addEventListener('load', applyAt);
  }
})();
