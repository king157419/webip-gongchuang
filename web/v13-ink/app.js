/* v13-ink · 五拍吸顶水墨舞台编排与真实数据渲染（全部读取自 window.CLUB） */
(function () {
  'use strict';

  var C = window.CLUB || {};
  var $ = function (id) { return document.getElementById(id); };
  var root = document.documentElement;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dotDate(d) { return String(d || '').replace(/-/g, '.'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  var CAT_SHORT = { weld: '电路焊接', course: '昇腾 AI 课', visit: '企业参访', contest: '创新大赛', talk: '系列分享' };

  function cleanTitle(raw) {
    var s = String(raw || '').trim();
    var parts = s.split(/\s*[|丨｜]\s*|\s*——\s*/);
    if (parts.length > 1 && parts[1] && parts[0].length < 18) {
      return parts[0].replace(/^[“"「]|[”"」]$/g, '') + ' · ' + parts.slice(1).join(' ');
    }
    return s;
  }

  /* 1. 从 window.CLUB 渲染全部真实内容 */
  var meta = C.meta || {}, programs = C.programs || [], news = C.news || [];
  var honors = C.honors || [], people = C.people || {}, join = C.join || {};
  var depts = meta.departments || [];
  var years = news.map(function (n) { return parseInt(String(n.date).slice(0, 4), 10); }).filter(Boolean);
  var yearSpan = years.length ? (Math.min.apply(null, years) + '–' + Math.max.apply(null, years)) : '2022–2026';

  if (meta.host && meta.founded && $('heroMeta')) {
    $('heroMeta').textContent = '壹 · 上海大学 · ' + meta.host + '挂靠 · ' + meta.founded + ' 年成立';
  }
  if ($('heroFacts')) {
    var facts = [
      [String(meta.founded || 2021) + ' 年', '正式成立'],
      [String(news.length) + ' 篇', '学院官网公开报道'],
      ['近 200 人', '本科 AI 论文分享会'],
      [String(depts.length || 4) + ' 个部门', depts.map(function (d) { return d.name; }).join(' / ') || '协同运转']
    ];
    $('heroFacts').innerHTML = facts.map(function (f) {
      return '<div class="fact-cell"><dt>' + esc(f[0]) + '</dt><dd>' + esc(f[1]) + '</dd></div>';
    }).join('');
  }

  if ($('progList')) {
    $('progList').innerHTML = programs.map(function (p, i) {
      return '<li class="prog-item"><span class="prog-no">' + pad2(i + 1) + '</span>' +
        '<div class="prog-main"><h3 class="prog-name">' + esc(p.name) + '</h3>' +
        '<span class="prog-where">' + esc(p.where) + '</span></div>' +
        '<p class="prog-desc">' + esc(p.desc) + '</p></li>';
    }).join('');
  }

  if ($('newsLead')) {
    $('newsLead').textContent = yearSpan + ' 年共 ' + news.length + ' 篇学院官网报道，近 200 人听过论文分享，百余人赴华为参访。';
  }
  if ($('archiveBtnTxt')) {
    $('archiveBtnTxt').textContent = '展开全部 ' + news.length + ' 篇官网报道与赛事荣誉';
  }

  var pickIndices = [1, 2, 0, 9, 10].filter(function (idx) { return idx < news.length; });
  for (var ni = 0; ni < news.length && pickIndices.length < 5; ni++) {
    if (pickIndices.indexOf(ni) === -1) pickIndices.push(ni);
  }
  if ($('featList')) {
    $('featList').innerHTML = pickIndices.map(function (idx) {
      var n = news[idx], cat = CAT_SHORT[n.cat] || '';
      return '<li class="feat-item"><a class="feat-link" href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
        '<span class="feat-date">' + esc(dotDate(n.date)) + '<br>' + esc(cat) + '</span>' +
        '<span><strong class="feat-title">' + esc(cleanTitle(n.title)) + '</strong>' +
        '<span class="feat-sub">' + esc(n.summary) + '</span></span>' +
        '<span class="feat-arr" aria-hidden="true">↗</span></a></li>';
    }).join('');
  }

  if ($('archHonors')) {
    $('archHonors').innerHTML = '<p class="arch-sub">赛事承办与协办记录（附学院官网报道）</p>' +
      honors.map(function (h) {
        var inner = '<span class="arch-honor-yr">' + esc(h.year) + '</span><span>' + esc(h.text) + (h.source ? ' ↗' : '') + '</span>';
        return h.source
          ? '<a class="arch-honor-row" href="' + esc(h.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
          : '<div class="arch-honor-row">' + inner + '</div>';
      }).join('');
  }
  if ($('archFilters') && $('archList')) {
    var flts = [{ id: 'all', label: '全部 ' + news.length }].concat(programs.map(function (p) {
      var cnt = news.filter(function (n) { return n.cat === p.id; }).length;
      return { id: p.id, label: (CAT_SHORT[p.id] || p.name) + ' ' + cnt };
    }));
    $('archFilters').innerHTML = flts.map(function (f, i) {
      return '<button type="button" class="flt-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + esc(f.id) + '">' + esc(f.label) + '</button>';
    }).join('');
    $('archList').innerHTML = news.map(function (n, idx) {
      var cat = CAT_SHORT[n.cat] || n.cat || '';
      return '<li class="arch-item" data-cat="' + esc(n.cat) + '"><a class="arch-link" href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
        '<p class="arch-meta">' + pad2(idx + 1) + ' · ' + esc(dotDate(n.date)) + ' · ' + esc(cat) + ' ↗</p>' +
        '<h3 class="arch-t">' + esc(cleanTitle(n.title)) + '</h3><p class="arch-s">' + esc(n.summary) + '</p></a></li>';
    }).join('');
    $('archFilters').addEventListener('click', function (e) {
      var btn = e.target.closest('.flt-btn');
      if (!btn) return;
      var cat = btn.getAttribute('data-cat');
      [].slice.call($('archFilters').querySelectorAll('.flt-btn')).forEach(function (b) { b.classList.toggle('active', b === btn); });
      [].slice.call($('archList').querySelectorAll('.arch-item')).forEach(function (li) {
        li.hidden = !(cat === 'all' || li.getAttribute('data-cat') === cat);
      });
    });
  }

  if ($('peopleBox')) {
    var leaders = people.leaders || [], teachers = people.teachers || [];
    var leaderHtml = leaders.map(function (p) {
      var photo = p.photo
        ? '<div class="leader-photo"><img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '（' + esc(p.role) + '）水墨肖像" width="88" height="112" loading="lazy"></div>'
        : '';
      var awards = (p.awards && p.awards.length)
        ? '<ul class="p-awards">' + p.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
        : '';
      return '<article class="leader-card">' + photo +
        '<div><div class="p-head"><h3 class="p-name">' + esc(p.name) + '</h3><span class="p-role">' + esc(p.role) + ' · 学生负责人</span></div>' +
        '<p class="p-desc">' + esc(p.desc) + '</p>' + awards + '</div></article>';
    }).join('');
    var teacherHtml = teachers.length
      ? '<div class="teacher-grid">' + teachers.map(function (t) {
          return '<article><div class="p-head"><h3 class="p-name">' + esc(t.name) + '</h3><span class="p-role">' + esc(t.role) + '</span></div>' +
            '<p class="p-desc">' + esc(t.desc) + '</p></article>';
        }).join('') + '</div>'
      : '';
    $('peopleBox').innerHTML = leaderHtml + teacherHtml;
  }
  if ($('deptStrip') && depts.length) {
    $('deptStrip').textContent = '四个常设部门：' + depts.map(function (d) { return d.name + '（' + d.desc + '）'; }).join(' · ');
  }

  if ($('joinSteps')) {
    $('joinSteps').innerHTML = (join.steps || []).map(function (s, i) {
      return '<li class="step-item"><span class="step-no">0' + (i + 1) + '</span><h3 class="step-t">' + esc(s.t) + '</h3><p class="step-d">' + esc(s.d) + '</p></li>';
    }).join('');
  }
  if ($('faqList')) {
    var openFirst = window.innerWidth > 680;
    $('faqList').innerHTML = (join.faq || []).map(function (f, i) {
      return '<details' + (openFirst && i === 0 ? ' open' : '') + '>' +
        '<summary><span>' + esc(f.q) + '</span><span class="faq-plus" aria-hidden="true">+</span></summary><p>' + esc(f.a) + '</p></details>';
    }).join('');
  }
  if (meta.name && $('ftName')) {
    $('ftName').textContent = meta.name + (meta.en ? ' · ' + meta.en : '');
    $('ftMeta').textContent = '挂靠单位：' + (meta.host || '') + ' · ' + (meta.founded || 2021) + ' 年成立 · ' + (meta.location || '');
  }

  /* 2. 复制公众号（HTTP 隐藏 textarea + execCommand）、小智印签、报道全集弹层 */
  var copyBtn = $('copyBtn'), copyMsg = $('copyMsg');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var target = '上海大学通信学院', ok = false;
      var ta = document.createElement('textarea');
      ta.value = target;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { ta.setSelectionRange(0, target.length); ok = document.execCommand('copy'); } catch (err) { ok = false; }
      document.body.removeChild(ta);
      if (ok) {
        copyBtn.classList.add('copied');
        copyMsg.textContent = '已复制「上海大学通信学院」，打开微信搜索关注即可收到活动预告。';
      } else {
        copyMsg.textContent = '微信里搜索：上海大学通信学院';
      }
    });
  }

  var mascotTips = [
    '翔英大楼 T404 / T406 常办焊接课，零基础也能一对一上手。',
    '面向全校招新，不是通信学院的同学也完全欢迎。',
    '没有报名表和 QQ 群，关注「上海大学通信学院」公众号等预告即可。',
    '与华为合作的昇腾 AI 课会亲手实践 Transformer 与 BERT 微调。',
    '学术部、组织部、宣传部、办公部四个部门，体验过活动再选。'
  ];
  var tipIdx = 0;
  if ($('mascotBtn') && $('mascotLine')) {
    $('mascotBtn').addEventListener('click', function () {
      tipIdx = (tipIdx + 1) % mascotTips.length;
      $('mascotLine').textContent = mascotTips[tipIdx];
    });
  }

  var modal = $('archiveModal'), lastFocus = null;
  function openArchive() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    if ($('closeArchiveBtn')) $('closeArchiveBtn').focus();
  }
  function closeArchive() {
    if (!modal || modal.hidden) return;
    modal.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  if ($('openArchiveBtn')) $('openArchiveBtn').addEventListener('click', openArchive);
  if ($('closeArchiveBtn')) $('closeArchiveBtn').addEventListener('click', closeArchive);
  if ($('closeArchiveBg')) $('closeArchiveBg').addEventListener('click', closeArchive);
  window.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeArchive(); });

  /* 3. 五拍吸顶滚动编排：40% 行笔落墨 -> 45% 停住可读 -> 15% 过渡（倒滑收回） */
  var inkTrack = $('inkTrack'), inkStage = $('inkStage'), stageHint = $('stageHint'), ftrEl = $('ftr');
  var beatEls = [].slice.call(document.querySelectorAll('.beat'));
  var safeEls = beatEls.map(function (b) { return b.querySelector('[data-safe]'); });
  var bodyRevealEls = beatEls.map(function (b) {
    return [].slice.call(b.querySelectorAll('.beat-lead, .prog-list, .feat-list, .beat-foot-row, .people-box, .dept-strip, .step-row, .join-grid'));
  });
  var titleWriters = beatEls.map(function (b) {
    var tw = b.querySelector('[data-brush-title]');
    return (tw && window.InkEngine && window.InkEngine.createTitleWriter) ? window.InkEngine.createTitleWriter(tw) : null;
  });

  var WEIGHTS = [0.76, 1.00, 1.00, 1.00, 0.96];
  var W_SUM = WEIGHTS.reduce(function (a, b) { return a + b; }, 0);
  var BOUNDS = [0];
  (function () {
    var acc = 0;
    for (var i = 0; i < WEIGHTS.length; i++) {
      acc += WEIGHTS[i] / W_SUM;
      BOUNDS.push(i === WEIGHTS.length - 1 ? 1.0 : acc);
    }
  })();

  function isFlowFallback() {
    return reduceMotion || window.innerHeight <= 550 || !inkTrack || !inkStage || !window.InkEngine || !window.InkEngine.ready;
  }

  var atMatch = /[?&]at=(\d+)/.exec(window.location.search);
  var debugY = atMatch ? parseInt(atMatch[1], 10) : null;

  var heroIntroP = (reduceMotion || debugY !== null) ? 1.0 : 0.20;
  var introStart = performance.now();
  setTimeout(function () {
    heroIntroP = 1.0;
    root.classList.remove('entering');
    root.classList.add('entered');
    scheduleSync(true);
  }, 1600);

  var navBtns = [].slice.call(document.querySelectorAll('.top-nav .nav-btn'));
  var railDots = [].slice.call(document.querySelectorAll('.rail-dot'));
  var railCur = $('railCur'), lastActiveBeat = -1;

  function syncActiveNav(idx) {
    if (idx === lastActiveBeat) return;
    lastActiveBeat = idx;
    if (railCur) railCur.textContent = String(idx + 1);
    navBtns.forEach(function (b, i) { b.classList.toggle('active', i === idx); });
    railDots.forEach(function (d, i) {
      var on = i === idx;
      d.classList.toggle('active', on);
      if (on) d.setAttribute('aria-current', 'step');
      else d.removeAttribute('aria-current');
    });
  }

  var safeBoxes = [];
  function measureSafeBoxes() {
    var vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
    safeBoxes = safeEls.map(function (el) {
      if (!el) return [0.04, 0.14, 0.56, 0.86];
      var r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return [0.04, 0.14, 0.56, 0.86];
      return [
        clamp((r.left - 12) / vw, 0.0, 0.95),
        clamp((r.top - 10) / vh, 0.0, 0.95),
        clamp((r.right + 14) / vw, 0.05, 1.0),
        clamp((r.bottom + 10) / vh, 0.05, 1.0)
      ];
    });
  }

  function clearDebugShift() {
    debugY = null;
    if (inkTrack) inkTrack.style.transform = '';
    if (ftrEl) ftrEl.style.transform = '';
  }

  function scrollToBeat(idx) {
    var b = clamp(idx | 0, 0, 4);
    if (isFlowFallback()) {
      if (beatEls[b]) beatEls[b].scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      return;
    }
    clearDebugShift();
    var vh = Math.max(1, window.innerHeight);
    var span = Math.max(1, inkTrack.offsetHeight - vh);
    var holdU = (b === 0) ? 0.0 : (b === 4 ? 0.66 : 0.60);
    var g = BOUNDS[b] + (BOUNDS[b + 1] - BOUNDS[b]) * holdU;
    window.scrollTo({ top: Math.round(g * span), behavior: reduceMotion ? 'auto' : 'smooth' });
  }

  document.addEventListener('click', function (e) {
    var jumpEl = e.target.closest('[data-jump]');
    if (!jumpEl) return;
    e.preventDefault();
    scrollToBeat(parseInt(jumpEl.getAttribute('data-jump'), 10) || 0);
  });

  var smoothG = 0, targetG = 0, animId = 0, inStageView = true;

  function applyStageAt(g, immediate) {
    var k = 0;
    for (var i = 0; i < 5; i++) {
      if (g < BOUNDS[i + 1] || i === 4) { k = i; break; }
    }
    var u = clamp((g - BOUNDS[k]) / Math.max(0.001, BOUNDS[k + 1] - BOUNDS[k]), 0, 1);
    syncActiveNav(k);

    for (var b = 0; b < beatEls.length; b++) {
      var el = beatEls[b];
      if (b !== k) {
        el.classList.remove('is-active');
        el.style.opacity = '0';
        el.style.transform = 'translate3d(0, 14px, 0)';
      } else {
        el.classList.add('is-active');
      }
    }

    var activeEl = beatEls[k];
    var bloomP = 1, strokeP = 0.74, fadeP = 1;

    if (k === 0) {
      var out0 = smoothstep(0.76, 0.99, u);
      bloomP = heroIntroP;
      strokeP = heroIntroP * 0.74 + smoothstep(0.02, 0.52, u) * 0.26;
      fadeP = 1 - out0;
      activeEl.style.opacity = (1 - out0).toFixed(3);
      activeEl.style.transform = 'translate3d(0,' + (-22 * out0).toFixed(1) + 'px,0)';
      if (stageHint) stageHint.style.opacity = (1 - smoothstep(0.04, 0.28, u)).toFixed(3);
    } else {
      if (stageHint) stageHint.style.opacity = '0';
      bloomP = smoothstep(0.00, 0.36, u);
      strokeP = smoothstep(0.03, 0.39, u);
      var titleP = smoothstep(0.10, 0.39, u);
      var bodyIn = smoothstep(0.24, 0.40, u);
      var outK = (k < 4) ? smoothstep(0.85, 0.995, u) : 0;

      fadeP = 1 - outK;
      activeEl.style.opacity = (1 - outK).toFixed(3);
      activeEl.style.transform = 'translate3d(0,' + (-18 * outK).toFixed(1) + 'px,0)';

      if (titleWriters[k]) titleWriters[k].render(titleP);
      var revList = bodyRevealEls[k] || [];
      for (var r = 0; r < revList.length; r++) {
        revList[r].style.opacity = bodyIn.toFixed(3);
        revList[r].style.transform = 'translate3d(0,' + ((1 - bodyIn) * 14).toFixed(1) + 'px,0)';
      }
    }

    if (window.InkEngine && window.InkEngine.ready) {
      var sb = safeBoxes[k] || [0.04, 0.14, 0.56, 0.86];
      window.InkEngine.setSafeBox(sb[0], sb[1], sb[2], sb[3]);
      window.InkEngine.setState(k, bloomP, strokeP, fadeP, immediate);
    }
  }

  function stepFrame(now) {
    animId = 0;
    if (isFlowFallback()) {
      root.classList.toggle('fallback-flow', !reduceMotion);
      if (window.InkEngine && window.InkEngine.ready) {
        window.InkEngine.setSafeBox(0.04, 0.08, 0.58, 0.92);
        window.InkEngine.setState(0, 1, 0.74, 1, true);
      }
      return;
    }
    root.classList.remove('fallback-flow');

    var vh = Math.max(1, window.innerHeight);
    var realSy = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (debugY !== null && realSy > 4) clearDebugShift();

    var span = Math.max(1, inkTrack.offsetHeight - vh);
    var sy = debugY !== null ? debugY : realSy;

    /* ?at= 调试定位：保持文档顶置以供无头浏览器截取 sticky 舞台；超出轨道时上移露出页脚 */
    if (debugY !== null) {
      var extraFoot = Math.max(0, Math.min(debugY - span, ftrEl ? ftrEl.offsetHeight : 0));
      inkTrack.style.transform = extraFoot > 0 ? 'translate3d(0,' + (-extraFoot) + 'px,0)' : '';
      if (ftrEl) ftrEl.style.transform = extraFoot > 0 ? 'translate3d(0,' + (-extraFoot) + 'px,0)' : '';
    }

    targetG = clamp(sy / span, 0, 1);

    var needMore = false;
    if (heroIntroP < 0.999) {
      heroIntroP = clamp(0.20 + (now - introStart) / 740 * 0.80, 0.20, 1.0);
      if (heroIntroP < 0.999) needMore = true;
    }

    if (debugY !== null) {
      smoothG = targetG;
    } else {
      var diff = targetG - smoothG;
      if (Math.abs(diff) > 0.00045) { smoothG += diff * 0.30; needMore = true; }
      else { smoothG = targetG; }
    }

    var trRect = inkTrack.getBoundingClientRect();
    var visible = trRect.bottom > 0 && trRect.top < vh;
    if (visible !== inStageView) {
      inStageView = visible;
      if (window.InkEngine) {
        if (visible && !document.hidden) window.InkEngine.start();
        else window.InkEngine.stop();
      }
    }

    if (visible) applyStageAt(smoothG, debugY !== null);
    if (needMore && !document.hidden) animId = requestAnimationFrame(stepFrame);
  }

  function scheduleSync(immediate) {
    if (immediate) {
      if (animId) { cancelAnimationFrame(animId); animId = 0; }
      stepFrame(performance.now());
      return;
    }
    if (!animId) animId = requestAnimationFrame(stepFrame);
  }

  window.addEventListener('scroll', function () { scheduleSync(false); }, { passive: true });
  window.addEventListener('resize', function () {
    if (window.InkEngine) window.InkEngine.resize();
    titleWriters.forEach(function (tw) { if (tw) tw.bake(); });
    measureSafeBoxes();
    scheduleSync(true);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!window.InkEngine) return;
    if (document.hidden) window.InkEngine.stop();
    else if (inStageView) { window.InkEngine.start(); scheduleSync(true); }
  });

  function initStage() {
    measureSafeBoxes();
    titleWriters.forEach(function (tw) { if (tw) tw.bake(); });
    scheduleSync(true);
    if (!reduceMotion && debugY === null) scheduleSync(false);
  }

  initStage();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      measureSafeBoxes();
      titleWriters.forEach(function (tw) { if (tw) { tw.bake(); tw.lastP = -1; } });
      scheduleSync(true);
    });
  }
  window.addEventListener('load', initStage);
})();
