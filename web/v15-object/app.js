/* v15-object · 上海大学人工智能社 —— 数据渲染、逐字入场、横向拖拽与 3D 伴随调度
 * 所有事实严格读取自 ../shared/content.js（window.CLUB），原生 JS，零外部依赖。 */
(function () {
  'use strict';

  var C = window.CLUB;
  if (!C) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  var REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(e0, e1, x) {
    var t = clamp((x - e0) / (e1 - e0 || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }
  function fmtDate(d) { return String(d || '').replace(/-/g, '.'); }
  function shortTitle(t) {
    var s = String(t || '').split(/\s*[|｜丨]\s*|\s*——\s*/)[0].trim();
    return s.replace(/^[“"]+|[”"]+$/g, '');
  }

  var NEWS = (C.news || []).slice();
  var PROGS = (C.programs || []).slice();
  var DEPTS = (C.meta && C.meta.departments) || [];
  var YEARS = NEWS.map(function (n) { return +n.date.slice(0, 4); });
  var Y_MIN = YEARS.length ? Math.min.apply(null, YEARS) : 2022;
  var Y_MAX = YEARS.length ? Math.max.apply(null, YEARS) : 2026;

  var CAT_NAME = {};
  PROGS.forEach(function (p) { CAT_NAME[p.id] = p.name; });
  var CAT_SHORT = { weld: '电路焊接', course: '昇腾课程', visit: '企业参访', contest: '创新大赛', talk: '分享会' };

  /* ---------- 1. 绑定元信息与关于区块 ---------- */
  $('#hero-eyebrow').textContent = C.meta.founded + ' 年成立 · ' + C.meta.host + '指导 · 面向全校';
  $('#hero-news-n').textContent = NEWS.length;
  $('#stat-founded').textContent = C.meta.founded;
  $('#stat-progs').textContent = PROGS.length + ' 类';
  $('#stat-news').textContent = NEWS.length + ' 篇';
  $('#stat-depts').textContent = DEPTS.length + ' 个';

  $('#about-type').textContent = C.meta.type + ' · ' + C.meta.host;
  $('#about-intro').textContent = C.meta.intro;
  $('#about-loc').textContent = C.meta.location || '待社团补充';

  $('#dept-grid').innerHTML = DEPTS.map(function (d) {
    return '<li class="dept-item"><b>' + esc(d.name) + '</b><span>' + esc(d.desc) + '</span></li>';
  }).join('');

  /* ---------- 2. 平时做什么（横向可拖彩色卡） ---------- */
  var THEMES = ['t-vermilion', 't-cobalt', 't-forest', 't-sand', 't-slate'];
  var track = $('#prog-track');

  track.innerHTML = PROGS.map(function (p, i) {
    var related = NEWS.filter(function (n) { return n.cat === p.id; });
    var latest = related[0];
    var ticket = '';
    if (latest) {
      ticket =
        '<a class="pc-ticket" href="' + esc(latest.source) + '" target="_blank" rel="noopener" ' +
        'style="--tilt:' + (i % 2 ? '2deg' : '-2deg') + '" ' +
        'aria-label="查看近期报道：' + esc(latest.title) + '（新窗口打开）">' +
        '<span class="tk-meta"><span>近期报道 · ' + esc(fmtDate(latest.date)) + '</span><span>学院官网 ↗</span></span>' +
        '<span class="tk-title">' + esc(shortTitle(latest.title)) + '</span>' +
        '</a>';
    }
    return (
      '<article class="pcard ' + THEMES[i % THEMES.length] + '">' +
        '<div class="pc-top">' +
          '<span>' + String(i + 1).padStart(2, '0') + ' / ' + String(PROGS.length).padStart(2, '0') + '</span>' +
          '<span class="pc-pill">' + related.length + ' 篇官网报道</span>' +
        '</div>' +
        '<h3 class="pc-title">' + esc(p.name) + '</h3>' +
        '<p class="pc-desc">' + esc(p.desc) + '</p>' +
        ticket +
        '<div class="pc-foot">' +
          '<span>常驻地点：' + esc(p.where) + '</span>' +
        '</div>' +
      '</article>'
    );
  }).join('');

  var pCards = $$('.pcard', track);
  var btnPrev = $('#prog-prev'), btnNext = $('#prog-next'), progCounter = $('#prog-counter');

  function cardStep() {
    return pCards.length > 1 ? (pCards[1].offsetLeft - pCards[0].offsetLeft) : track.clientWidth;
  }
  function syncProgControls() {
    var st = cardStep() || 1;
    var idx = clamp(Math.round(track.scrollLeft / st), 0, Math.max(0, pCards.length - 1));
    progCounter.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(pCards.length).padStart(2, '0');
    btnPrev.disabled = track.scrollLeft <= 4;
    btnNext.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 4;
  }
  btnPrev.addEventListener('click', function () {
    track.scrollBy({ left: -cardStep(), behavior: REDUCE ? 'auto' : 'smooth' });
  });
  btnNext.addEventListener('click', function () {
    track.scrollBy({ left: cardStep(), behavior: REDUCE ? 'auto' : 'smooth' });
  });
  track.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); btnNext.click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); btnPrev.click(); }
  });
  track.addEventListener('scroll', function () { requestAnimationFrame(syncProgControls); }, { passive: true });
  window.addEventListener('resize', syncProgControls);
  syncProgControls();

  // 鼠标横向抓拖 + 惯性对齐 + 3D 小智微转头呼应
  (function () {
    var drag = null, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x0: e.clientX, s0: track.scrollLeft, lx: e.clientX, lt: performance.now(), v: 0 };
      moved = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x0;
      if (!moved && Math.abs(dx) > 5) {
        moved = true;
        track.classList.add('dragging');
      }
      if (!moved) return;
      track.scrollLeft = drag.s0 - dx;
      var now = performance.now(), dt = Math.max(1, now - drag.lt);
      drag.v = (e.clientX - drag.lx) / dt;
      drag.lx = e.clientX; drag.lt = now;
      if (window.Zhi3D) window.Zhi3D.setCardNudge(drag.v * 0.22);
      e.preventDefault();
    });
    window.addEventListener('pointerup', function () {
      if (!drag) return;
      var v = drag.v;
      drag = null;
      if (moved) {
        track.classList.remove('dragging');
        var st = cardStep() || 320;
        var dest = Math.round((track.scrollLeft - v * 240) / st) * st;
        track.scrollTo({ left: dest, behavior: REDUCE ? 'auto' : 'smooth' });
      }
    });
    track.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
    track.addEventListener('dragstart', function (e) { e.preventDefault(); });
  })();

  /* ---------- 3. 做过的事（16 篇报道 + 分类筛选 + 荣誉） ---------- */
  $('#news-span-label').textContent = Y_MIN + ' — ' + Y_MAX + ' · 共 ' + NEWS.length + ' 篇学院官网报道';
  $('#news-side-desc').textContent =
    Y_MIN + ' 至 ' + Y_MAX + ' 年间，通信与信息工程学院官网共发布社团相关报道 ' + NEWS.length + ' 篇。点击任意卡片可阅读原文。';

  var filterWrap = $('#news-filters');
  var newsList = $('#news-list');
  var newsStatus = $('#news-status');

  var filterDefs = [{ id: 'all', label: '全部', count: NEWS.length }].concat(
    PROGS.map(function (p) {
      return {
        id: p.id,
        label: CAT_SHORT[p.id] || p.name,
        count: NEWS.filter(function (n) { return n.cat === p.id; }).length
      };
    })
  );

  filterWrap.innerHTML = filterDefs.map(function (f, idx) {
    return '<button class="flt-btn" type="button" data-cat="' + esc(f.id) + '" aria-pressed="' + (idx === 0 ? 'true' : 'false') + '">' +
      esc(f.label) + ' ' + f.count + '</button>';
  }).join('');

  function renderNews(cat) {
    var list = cat === 'all' ? NEWS : NEWS.filter(function (n) { return n.cat === cat; });
    newsList.innerHTML = list.map(function (n) {
      var tag = CAT_SHORT[n.cat] || CAT_NAME[n.cat] || '活动';
      return (
        '<a class="ncard reveal in" href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
          '<div class="nc-head">' +
            '<span class="nc-date">' + esc(fmtDate(n.date)) + '</span>' +
            '<span class="nc-cat" data-cat="' + esc(n.cat) + '">' + esc(tag) + '</span>' +
          '</div>' +
          '<h3 class="nc-title">' + esc(n.title) + '</h3>' +
          '<p class="nc-sum">' + esc(n.summary) + '</p>' +
          '<span class="nc-go">阅读学院官网原文 ↗</span>' +
        '</a>'
      );
    }).join('');
    newsStatus.textContent = '当前显示 ' + list.length + ' 篇报道';
  }
  renderNews('all');

  var CAT_EXPR = { all: 'happy', weld: 'wink', course: 'curious', visit: 'sparkle', contest: 'happy', talk: 'focus' };
  filterWrap.addEventListener('click', function (e) {
    var btn = e.target.closest('.flt-btn');
    if (!btn) return;
    var cat = btn.getAttribute('data-cat');
    $$('.flt-btn', filterWrap).forEach(function (b) {
      b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
    });
    renderNews(cat);
    if (window.Zhi3D) {
      window.Zhi3D.triggerExpr(CAT_EXPR[cat] || 'happy', 2.6);
      window.Zhi3D.hop();
    }
  });

  $('#honors-list').innerHTML = (C.honors || []).map(function (h, idx) {
    var inner =
      '<div class="hc-top">' +
        '<span class="hc-yr">' + esc(h.year) + '</span>' +
        '<span class="hc-idx">#' + String(idx + 1).padStart(2, '0') + '</span>' +
      '</div>' +
      '<h3 class="hc-txt">' + esc(h.text) + '</h3>' +
      '<span class="hc-go">查看学院官网报道 ↗</span>';
    return '<li>' + (h.source
      ? '<a class="hcard reveal" href="' + esc(h.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
      : '<div class="hcard reveal">' + inner + '</div>') + '</li>';
  }).join('');

  /* ---------- 4. 社长和指导老师 ---------- */
  var P = C.people || { leaders: [], teachers: [] };
  $('#people-kicker').textContent = C.meta.founded + ' 年成立 · ' + DEPTS.length + ' 个职能部门';

  var leaderHTML = (P.leaders || []).map(function (l) {
    var photo = l.photo
      ? '<img class="p-photo" src="../shared/img/' + esc(l.photo) + '" alt="' + esc(l.role + l.name) + '照片" width="228" height="671" loading="lazy">'
      : '<div class="p-seal" aria-hidden="true">' + esc(String(l.name || '').slice(0, 1)) + '</div>';
    var awards = (l.awards && l.awards.length)
      ? '<ul class="p-awards">' + l.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
      : '';
    return (
      '<article class="p-card reveal">' +
        '<div class="p-leader-top">' +
          photo +
          '<div>' +
            '<p class="p-role">' + esc(l.role) + '</p>' +
            '<h3 class="p-name">' + esc(l.name) + '</h3>' +
            '<p class="p-desc">' + esc(l.desc) + '</p>' +
          '</div>' +
        '</div>' +
        awards +
      '</article>'
    );
  }).join('');

  var teacherHTML = (P.teachers || []).map(function (t) {
    var hasPhoto = t.photo && String(t.photo).trim() !== '' && t.photo !== '待补充';
    var photo = hasPhoto
      ? '<img class="p-photo" src="../shared/img/' + esc(t.photo) + '" alt="' + esc(t.name) + '照片" loading="lazy">'
      : '<div class="p-seal-row">' +
          '<div class="p-seal" aria-hidden="true">' + esc(String(t.name || '').slice(0, 1)) + '</div>' +
          '<span class="tbd-meta">教师照片 <em class="tbd-pill">待补充</em></span>' +
        '</div>';
    return (
      '<article class="p-card reveal">' +
        photo +
        '<div>' +
          '<p class="p-role">' + esc(t.role) + '</p>' +
          '<h3 class="p-name">' + esc(t.name) + '</h3>' +
          '<p class="p-desc">' + esc(t.desc) + '</p>' +
        '</div>' +
      '</article>'
    );
  }).join('');

  $('#people-grid').innerHTML = leaderHTML + teacherHTML;

  /* ---------- 5. 加入我们 + 复制公众号名 ---------- */
  var J = C.join || { steps: [], faq: [] };
  $('#join-steps').innerHTML = (J.steps || []).map(function (s, i) {
    return (
      '<li class="jstep reveal">' +
        '<span class="js-num">STEP ' + String(i + 1).padStart(2, '0') + '</span>' +
        '<h3 class="js-title">' + esc(s.t) + '</h3>' +
        '<p class="js-desc">' + esc(s.d) + '</p>' +
      '</li>'
    );
  }).join('');

  $('#faq-list').innerHTML = (J.faq || []).map(function (f) {
    return (
      '<details>' +
        '<summary><span>' + esc(f.q) + '</span><span class="faq-ico" aria-hidden="true"></span></summary>' +
        '<p class="faq-ans">' + esc(f.a) + '</p>' +
      '</details>'
    );
  }).join('');

  function isBlank(v) {
    return v == null || String(v).trim() === '' || String(v).trim() === '待补充';
  }
  var ct = (C.meta && C.meta.contact) || {};
  var pendingItems = [
    { k: '集中招新时间', v: isBlank(J.season) ? null : esc(J.season) },
    { k: '线上报名问卷', v: isBlank(J.formUrl) ? null : '<a href="' + esc(J.formUrl) + '" target="_blank" rel="noopener">填写报名问卷 ↗</a>' },
    { k: '社团交流群', v: isBlank(ct.qqGroup) ? null : esc(ct.qqGroup) },
    { k: '在册社员人数', v: isBlank(C.meta && C.meta.members) ? null : esc(C.meta.members) + ' 人' }
  ];
  var pendingEl = $('#join-pending');
  if (pendingEl) {
    pendingEl.innerHTML = pendingItems.map(function (it) {
      return '<li class="wx-pend-item"><span class="wx-pend-k">' + esc(it.k) + '</span>' +
        (it.v ? '<span class="wx-pend-v">' + it.v + '</span>' : '<em class="tbd-pill">待补充</em>') +
      '</li>';
    }).join('');
  }

  var WX_ACCOUNT = '上海大学通信学院';
  $('#copy-wx-btn').addEventListener('click', function () {
    var clip = $('#wx-clip');
    var msg = $('#copy-wx-msg');
    var ok = false;
    clip.value = WX_ACCOUNT;
    try {
      clip.focus({ preventScroll: true });
      clip.select();
      clip.setSelectionRange(0, WX_ACCOUNT.length);
      ok = document.execCommand('copy');
    } catch (err) {
      ok = false;
    }
    clip.blur();
    msg.textContent = ok
      ? '已复制「' + WX_ACCOUNT + '」，打开微信搜一搜粘贴即可。'
      : '微信里搜索：' + WX_ACCOUNT;
    if (window.Zhi3D) {
      window.Zhi3D.triggerExpr('happy', 3.0);
      window.Zhi3D.hop();
    }
  });

  $('#foot-name').textContent = C.meta.name;
  $('#foot-en').textContent = C.meta.en;
  $('#foot-founded').textContent = C.meta.founded + ' 年成立';
  $('#foot-host').textContent = '挂靠' + C.meta.host;

  /* ---------- 6. 首屏超大字逐字入场（CSS 合成器驱动 + 2.5s setTimeout 硬兜底） ---------- */
  var chars = $$('.ch');
  var introDone = false;

  function finishIntroImmediate() {
    if (introDone) return;
    introDone = true;
    var root = document.documentElement;
    root.classList.remove('intro-run');
    root.classList.add('intro-done');
    chars.forEach(function (el) {
      el.style.opacity = '';
      el.style.transform = '';
      el.style.animation = '';
    });
  }

  function runHeroIntro() {
    if (REDUCE || !chars.length || document.documentElement.classList.contains('intro-done')) {
      finishIntroImmediate();
      return;
    }
    var lastCh = chars[chars.length - 1];
    lastCh.addEventListener('animationend', finishIntroImmediate, { once: true });
    // 非 rAF 硬兜底：2.5 秒后无论如何全部归位
    setTimeout(finishIntroImmediate, 2500);
  }

  /* ---------- 7. 区块卡片滚动浮现（带超时兜底） ---------- */
  $$('.bento-card').forEach(function (el) { el.classList.add('reveal'); });

  function setupReveals() {
    var els = $$('.reveal:not(.in)');
    if (REDUCE || !('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (ent) {
        if (ent.isIntersecting) {
          ent.target.classList.add('in');
          io.unobserve(ent.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    els.forEach(function (el) { io.observe(el); });

    // 2.4 秒后把已在视口内的元素兜底设为可见
    setTimeout(function () {
      $$('.reveal:not(.in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top < window.innerHeight + 80) el.classList.add('in');
      });
    }, 2400);
  }

  /* ---------- 8. 3D 小智舞台跨区块伴随与零遮挡调度 ---------- */
  var stage = $('#bot-stage');
  var hitBtn = $('#bot-hit');
  var summonBtn = $('#bot-summon');
  var bubble = $('#bot-bubble');
  var dockHero = $('#dock-hero');
  var dockNews = $('#dock-news');
  var dockJoin = $('#dock-join');
  var heroSec = $('#hero'), newsSec = $('#news'), joinSec = $('#join');
  var footEl = $('.site-foot');
  var SECS = ['hero', 'about', 'programs', 'news', 'honors', 'people', 'join'].map(function (id) {
    return { id: id, el: document.getElementById(id) };
  });

  var BASE_STAGE = 440;
  var B = {
    x: 0, y: 0, sz: 224, op: 1,
    tx: 0, ty: 0, tsz: 224, top: 1,
    mode: 'hero',
    mobileOpen: false, mobileOpenY: 0,
    raf: 0, inited: false,
    bubbleOpen: false, bubbleTimer: 0, factIdx: 0, exprIdx: 0
  };

  var FACTS = [
    '2024 年 12 月，近 200 名同学来 CJ203 听过 AI 顶会论文分享会。',
    '2024 年 9 月，社团组织百余名上大学子赴世博中心参加华为全联接大会。',
    '2026 年 5 月，40 余名同学限额入选华为昇腾 AI 大模型实践课。',
    '2025 年 11 月，近百名同学随社团走进华为鸿蒙生态学堂上海站。',
    '2025 年宏嘉书院焊接专项赛，报名人数超过百人。',
    '从 ' + Y_MIN + ' 到 ' + Y_MAX + ' 年，通信学院官网报道过社团 ' + NEWS.length + ' 次。',
    '社团 ' + C.meta.founded + ' 年成立，下设' + DEPTS.map(function (d) { return d.name; }).join('、') + '。',
    '全校各专业都能来，零基础先来体验一次焊接课就行！'
  ];
  var CLICK_EXPRS = ['wink', 'curious', 'sparkle', 'focus', 'happy'];

  function lerp(a, b, t) { return a + (b - a) * t; }

  function updateSummonUI(show, active) {
    if (!summonBtn) return;
    summonBtn.classList.toggle('visible', !!show);
    summonBtn.setAttribute('aria-expanded', active ? 'true' : 'false');
  }

  function computeStageTarget() {
    var vw = window.innerWidth, vh = window.innerHeight;
    var hr = dockHero.getBoundingClientRect();
    var heroRect = heroSec.getBoundingClientRect();

    var tx = hr.left, ty = hr.top, tsz = hr.width, top = 1;
    var mode = 'hero', showSummon = false, scrollTurn = 0;

    if (vw < 1024) {
      // 手机与窄屏：首屏停在预留锚点内；滚出首屏后干脆淡出绝不挡字，顶栏可点「小智」再唤出
      var heroVis = smoothstep(70, 210, hr.bottom) * smoothstep(vh + 40, vh - 30, hr.top);
      if (heroVis > 0.05) {
        B.mobileOpen = false;
        tsz = hr.width * (0.84 + 0.16 * heroVis);
        tx = hr.left + (hr.width - tsz) * 0.5;
        ty = hr.top + (hr.height - tsz) * 0.5;
        top = heroVis;
        mode = 'hero';
        scrollTurn = (1 - heroVis) * 1.2;
      } else {
        showSummon = true;
        var mSz = 88;
        tx = vw - mSz - 10;
        ty = vh - mSz - 12;
        tsz = mSz;
        top = B.mobileOpen ? 1 : 0;
        mode = B.mobileOpen ? 'mobile-pop' : 'hidden';
      }
    } else {
      // 桌面端：计算正文容器右侧真实留白宽度，仅在留白充足且无横滑卡片/页脚冲突时停靠右下留白区
      var gut = vw >= 1200 ? 48 : 32;
      var contentRight = (vw + Math.min(vw, 1300)) * 0.5 - gut;
      var rightClear = vw - contentRight;

      var cSize = clamp(rightClear - 18, 72, 98);
      var cx = vw - cSize - 8;
      var cy = vh - cSize - 14;

      var pHero = clamp(-heroRect.top / Math.max(150, heroRect.height * 0.36), 0, 1);
      var eHero = pHero * pHero * (3 - 2 * pHero);
      var xHero = 1 - Math.pow(1 - pHero, 3);
      scrollTurn = eHero * Math.PI * 2;

      var trk = track.getBoundingClientRect();
      var hitProg = (trk.top < cy + cSize + 8) && (trk.bottom > cy - 8);
      var ft = footEl ? footEl.getBoundingClientRect() : null;
      var hitFoot = ft ? (ft.top < cy + cSize * 0.72) : false;

      var cornerSafe = (rightClear >= 96) && !hitProg && !hitFoot;
      var cornerOp = cornerSafe ? 1 : (B.mobileOpen ? 1 : 0);
      if (eHero > 0.75 && !cornerSafe) showSummon = true;

      tx = lerp(hr.left, cx, xHero);
      ty = lerp(hr.top, cy, eHero);
      tsz = lerp(hr.width, cSize, eHero);
      top = lerp(1, cornerOp, eHero);
      mode = eHero < 0.75 ? 'hero' : (top > 0.05 ? 'corner' : 'hidden');

      // 桌面端「做过的事」左侧预留陪读底座（完整在视口内时直接切入，绝不横穿正文）
      if (dockNews && newsSec) {
        var ns = newsSec.getBoundingClientRect();
        var nr = dockNews.getBoundingClientRect();
        if (nr.width > 40 && ns.top <= vh * 0.50 && ns.bottom >= vh * 0.40 && nr.top >= 58 && nr.bottom <= vh - 8) {
          tx = nr.left;
          ty = nr.top;
          tsz = nr.width;
          top = 1;
          mode = 'news';
          showSummon = false;
          scrollTurn += 0.55;
        }
      }

      // 桌面端「加入」右侧预留欢迎底座
      if (dockJoin && joinSec) {
        var js = joinSec.getBoundingClientRect();
        var jr = dockJoin.getBoundingClientRect();
        if (jr.width > 40 && js.top <= vh * 0.68 && jr.top >= 64 && jr.bottom <= vh - 16) {
          tx = jr.left;
          ty = jr.top;
          tsz = jr.width;
          top = 1;
          mode = 'join';
          showSummon = false;
        }
      }
    }

    updateSummonUI(showSummon, B.mobileOpen && top > 0.5);

    var prevMode = B.mode;
    B.tx = tx; B.ty = ty; B.tsz = tsz; B.top = top; B.mode = mode;
    B.snapPos = (prevMode !== mode) && (Math.hypot(tx - B.x, ty - B.y) > 250 || B.op < 0.06);

    if (window.Zhi3D) window.Zhi3D.setScrollTurn(scrollTurn);

    // 检测当前阅读分区，驱动小智换姿态和表情
    var probeY = vh * 0.42, activeSec = 'hero';
    for (var i = 0; i < SECS.length; i++) {
      var sEl = SECS[i].el;
      if (!sEl) continue;
      var sr = sEl.getBoundingClientRect();
      if (sr.top <= probeY) activeSec = SECS[i].id;
    }
    if (window.Zhi3D) window.Zhi3D.setSection(activeSec === 'honors' ? 'programs' : activeSec);
  }

  function applyStageTransform() {
    var sc = B.sz / BASE_STAGE;
    stage.style.transform = 'translate3d(' + B.x.toFixed(1) + 'px,' + B.y.toFixed(1) + 'px,0) scale(' + sc.toFixed(4) + ')';
    stage.style.opacity = B.op.toFixed(3);
    var hidden = B.op < 0.06;
    stage.classList.toggle('is-hidden', hidden);
    var inView = !hidden && (B.x + B.sz > 0) && (B.x < window.innerWidth) && (B.y + B.sz > 0) && (B.y < window.innerHeight);
    if (window.Zhi3D) window.Zhi3D.setVisible(inView);
    if (B.bubbleOpen) {
      if (hidden) closeBubble();
      else positionBubble();
    }
  }

  function closeBubble() {
    clearTimeout(B.bubbleTimer);
    bubble.classList.remove('show');
    B.bubbleOpen = false;
  }

  function showNextFactBubble() {
    var expr = CLICK_EXPRS[B.exprIdx % CLICK_EXPRS.length];
    B.exprIdx++;
    if (window.Zhi3D) {
      window.Zhi3D.triggerExpr(expr, 3.2);
      window.Zhi3D.hop();
    }
    bubble.textContent = FACTS[B.factIdx % FACTS.length];
    B.factIdx++;
    B.bubbleOpen = true;
    positionBubble();
    bubble.classList.add('show');
    clearTimeout(B.bubbleTimer);
    B.bubbleTimer = setTimeout(closeBubble, 3400);
  }

  function positionBubble() {
    var vw = window.innerWidth;
    var bw = bubble.offsetWidth || 220, bh = bubble.offsetHeight || 54;
    var bx = clamp(B.x + B.sz * 0.5 - bw * 0.5, 12, vw - bw - 12);
    var by = B.y - bh - 8;
    if (by < 58) by = B.y + B.sz + 8;
    bubble.style.transform = 'translate3d(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px,0)';
  }

  function stageTick() {
    B.raf = 0;
    B.x += (B.tx - B.x) * 0.24;
    B.y += (B.ty - B.y) * 0.24;
    B.sz += (B.tsz - B.sz) * 0.24;
    B.op += (B.top - B.op) * 0.26;
    applyStageTransform();
    if (Math.abs(B.tx - B.x) + Math.abs(B.ty - B.y) + Math.abs(B.tsz - B.sz) + Math.abs(B.top - B.op) * 60 > 0.35) {
      B.raf = requestAnimationFrame(stageTick);
    } else {
      B.x = B.tx; B.y = B.ty; B.sz = B.tsz; B.op = B.top;
      applyStageTransform();
    }
  }

  function syncStage(immediate) {
    computeStageTarget();
    if (immediate || REDUCE || !B.inited) {
      B.inited = true;
      B.x = B.tx; B.y = B.ty; B.sz = B.tsz; B.op = B.top;
      applyStageTransform();
    } else {
      if (B.snapPos) {
        B.x = B.tx; B.y = B.ty; B.sz = B.tsz;
        B.snapPos = false;
      }
      if (!B.raf) B.raf = requestAnimationFrame(stageTick);
    }
  }

  hitBtn.addEventListener('click', function () {
    if (hitBtn.dataset.justDragged === '1') {
      hitBtn.dataset.justDragged = '';
      return;
    }
    showNextFactBubble();
  });

  if (summonBtn) {
    summonBtn.addEventListener('click', function () {
      B.mobileOpen = !B.mobileOpen;
      if (B.mobileOpen) {
        B.mobileOpenY = window.scrollY;
        syncStage(true);
        showNextFactBubble();
      } else {
        closeBubble();
        syncStage(false);
      }
    });
  }

  var scrollQueued = false;
  window.addEventListener('scroll', function () {
    if (B.mobileOpen && Math.abs(window.scrollY - B.mobileOpenY) > 150) {
      B.mobileOpen = false;
      closeBubble();
    }
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(function () {
      scrollQueued = false;
      syncStage(false);
    });
  }, { passive: true });

  window.addEventListener('resize', function () { syncStage(true); });

  /* ---------- 9. 启动与 ?at=像素 截图调试参数 ---------- */
  runHeroIntro();
  setupReveals();
  syncStage(true);

  var mAt = /[?&]at=(\d+)/.exec(location.search);
  if (mAt) {
    var yAt = parseInt(mAt[1], 10);
    document.documentElement.classList.add('at-jump');
    document.documentElement.style.scrollBehavior = 'auto';
    finishIntroImmediate();
    $$('.reveal').forEach(function (el) { el.classList.add('in'); });
    $$('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; });

    var mainEl = document.getElementById('main');
    var newsLayout = $('.news-layout');
    var newsSide = $('.news-side');
    var useTransformAt = /Headless/i.test(navigator.userAgent);

    var jumpAt = function () {
      if (useTransformAt && mainEl) {
        mainEl.style.transform = '';
        if (footEl) footEl.style.transform = '';
        if (newsSide) newsSide.style.transform = '';
        window.scrollTo(0, 0);
        var totalH = (footEl ? footEl.offsetTop + footEl.offsetHeight : mainEl.offsetHeight);
        var y = clamp(yAt, 0, Math.max(0, totalH - window.innerHeight));
        var shift = 'translate3d(0,-' + y + 'px,0)';
        mainEl.style.transform = shift;
        if (footEl) footEl.style.transform = shift;
        if (window.innerWidth >= 1024 && newsLayout && newsSide) {
          var nlr = newsLayout.getBoundingClientRect();
          if (nlr.top < 78) {
            var pin = clamp(78 - nlr.top, 0, Math.max(0, nlr.height - newsSide.offsetHeight));
            newsSide.style.transform = 'translate3d(0,' + pin.toFixed(1) + 'px,0)';
          }
        }
      } else {
        window.scrollTo(0, yAt);
      }
      syncStage(true);
      if (window.Zhi3D) window.Zhi3D.renderOnce();
    };
    jumpAt();
    requestAnimationFrame(jumpAt);
    setTimeout(jumpAt, 80);
    window.addEventListener('load', jumpAt, { once: true });
  }
})();
