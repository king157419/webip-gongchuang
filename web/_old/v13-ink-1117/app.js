/* =====================================================================
 * v13-ink · 页面内容渲染与交互编排（数据全部读取自 window.CLUB）
 * ===================================================================== */
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
  function valOrPending(v) {
    if (v == null || v === '' || v === '待补充') {
      return '<span class="pending-tag">待补充</span>';
    }
    return esc(v);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dotDate(d) { return String(d || '').replace(/-/g, '.'); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  var CAT_SHORT = {
    weld: '电路焊接',
    course: '昇腾 AI 课',
    visit: '企业参访',
    contest: '创新大赛',
    talk: '系列分享'
  };

  /* ---------- 1. 从 window.CLUB 渲染全部真实内容 ---------- */
  var meta = C.meta || {};
  var programs = C.programs || [];
  var news = C.news || [];
  var honors = C.honors || [];
  var people = C.people || {};
  var join = C.join || {};

  if (meta.host && meta.founded) {
    $('heroMeta').textContent = '上海大学 · ' + meta.host + '挂靠 · ' + meta.founded + ' 年成立';
  }

  // 01 关于
  $('aboutIntro').textContent = meta.intro || '';
  $('aboutLocation').innerHTML = '常驻活动空间：' + valOrPending(meta.location || '宝山校区翔英大楼') +
    '<span class="loc-sep" aria-hidden="true">·</span>在册人数：' + valOrPending(meta.members);

  var depts = meta.departments || [];
  $('deptList').innerHTML = depts.map(function (d) {
    return '<div class="dept-item"><dt>' + esc(d.name) + '</dt><dd>' + esc(d.desc) + '</dd></div>';
  }).join('');

  $('honorList').innerHTML = honors.map(function (h) {
    var inner = '<span class="honor-yr">' + esc(h.year) + '</span>' +
      '<span class="honor-txt">' + esc(h.text) + '</span>' +
      (h.source ? '<span class="honor-arr" aria-hidden="true">↗</span><span class="sr">（在新窗口打开学院官网报道）</span>' : '');
    return '<li>' + (h.source
      ? '<a class="honor-link" href="' + esc(h.source) + '" target="_blank" rel="noopener">' + inner + '</a>'
      : '<div class="honor-row">' + inner + '</div>') + '</li>';
  }).join('');

  var years = news.map(function (n) { return parseInt(String(n.date).slice(0, 4), 10); }).filter(Boolean);
  var yearSpan = years.length ? (Math.min.apply(null, years) + '–' + Math.max.apply(null, years)) : '2022–2026';
  var deptNames = depts.map(function (d) { return d.name; }).join(' · ');

  var statsData = [
    [String(news.length), '篇学院官网公开报道', yearSpan + ' 年真实活动归档'],
    [String(meta.founded || 2021), '年正式成立', '挂靠' + (meta.host || '通信与信息工程学院团委')],
    ['近 200', '人参加本科 AI 论文分享会', '2024.12 · 宝山校区 CJ203'],
    ['百余名', '学子赴华为全联接大会参访', '2024.09 · 上海世博中心'],
    ['近百名', '学子走进华为鸿蒙生态学堂', '2025.11 · 开发者实训上海站'],
    ['百余人', '报名本科生创新大赛焊接专项赛', '2025.11 · 翔英大楼 406 协办'],
    ['40 余名', '同学入选昇腾大模型实践课', '2026.05 · GJ204 动手微调实验'],
    [String(depts.length || 4), '个常设部门协同运转', deptNames]
  ];
  $('statsLedger').innerHTML = statsData.map(function (s) {
    return '<div class="stat-row"><dt>' + esc(s[1]) + '<small>' + esc(s[2]) + '</small></dt><dd>' + esc(s[0]) + '</dd></div>';
  }).join('');

  // 02 平时做什么（5 类活动卡片）
  $('pgTrack').innerHTML = programs.map(function (p, idx) {
    var related = news.filter(function (n) { return n.cat === p.id; });
    var latest = related[0];
    var quoteHtml = '';
    if (latest) {
      quoteHtml = '<div class="pg-quote">' +
        '<p>' + esc(latest.summary) + '</p>' +
        '<a href="' + esc(latest.source) + '" target="_blank" rel="noopener">' +
        esc(dotDate(latest.date)) + ' 学院官网报道 <span aria-hidden="true">↗</span></a>' +
        '</div>';
    }
    return '<li class="pg-card" data-idx="' + idx + '">' +
      '<div class="pg-card-top">' +
        '<div class="pg-card-meta"><span class="pg-no">' + pad2(idx + 1) + '</span>' +
        '<span class="pg-cnt">官网报道 ' + related.length + ' 篇</span></div>' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="pg-desc">' + esc(p.desc) + '</p>' +
        '<p class="pg-where">常在：' + esc(p.where) + '</p>' +
      '</div>' +
      quoteHtml +
      '</li>';
  }).join('');

  // 卡片指针墨晕微光跟随
  [].slice.call(document.querySelectorAll('.pg-card')).forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100).toFixed(1) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100).toFixed(1) + '%');
    }, { passive: true });
  });

  // 03 社长和指导老师
  var leaders = people.leaders || [];
  var teachers = people.teachers || [];
  var allPeople = leaders.map(function (x) { return { d: x, leader: true }; })
    .concat(teachers.map(function (x) { return { d: x, leader: false }; }));

  $('ppGrid').innerHTML = allPeople.map(function (item, idx) {
    var p = item.d;
    var hasPhoto = Boolean(p.photo);
    var photoHtml = hasPhoto
      ? '<div class="pp-photo"><img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '（' + esc(p.role) + '）照片" loading="lazy"></div>'
      : '';
    var awardsHtml = (p.awards && p.awards.length)
      ? '<ul class="pp-awards">' + p.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>'
      : '';
    var glyphHtml = !hasPhoto
      ? '<span class="pp-glyph" aria-hidden="true">' + esc(String(p.name || '').charAt(0)) + '</span>'
      : '';

    var noPhotoHtml = !hasPhoto ? '<span class="pending-tag">照片待补充</span>' : '';

    return '<article class="pp-card' + (hasPhoto ? ' is-leader' : '') + '" data-rv>' +
      '<div class="pp-head-row"><span>' + pad2(idx + 1) + '</span><span class="pp-tag-wrap"><span class="pp-tag">' + (item.leader ? '学生负责人' : '指导教师') + '</span>' + noPhotoHtml + '</span></div>' +
      photoHtml +
      '<div class="pp-body">' +
        '<h3>' + esc(p.name) + '</h3>' +
        '<p class="pp-role">' + esc(p.role) + '</p>' +
        '<p class="pp-desc">' + esc(p.desc) + '</p>' +
        awardsHtml +
      '</div>' +
      glyphHtml +
      '</article>';
  }).join('');

  // 04 做过的事（16 篇报道 + 分类筛选）
  $('nwSummaryNote').textContent = '共收录 ' + news.length + ' 篇上海大学通信与信息工程学院官网公开报道（' + yearSpan + '），点开任意卡片可阅读原文。';

  var filterItems = [{ id: 'all', label: '全部', count: news.length }].concat(
    programs.map(function (p) {
      return {
        id: p.id,
        label: CAT_SHORT[p.id] || p.name,
        count: news.filter(function (n) { return n.cat === p.id; }).length
      };
    })
  );

  $('nwFilters').innerHTML = filterItems.map(function (f, i) {
    return '<button type="button" class="flt-btn' + (i === 0 ? ' active' : '') + '" data-cat="' + esc(f.id) + '" aria-pressed="' + (i === 0 ? 'true' : 'false') + '">' +
      esc(f.label) + '<span class="cnt">' + f.count + '</span></button>';
  }).join('');

  function cleanTitle(raw) {
    var s = String(raw || '').trim();
    var parts = s.split(/\s*[|丨｜]\s*|\s*——\s*/);
    if (parts.length > 1 && parts[1] && parts[0].length < 18) {
      return parts[0].replace(/^[“"「]|[”"」]$/g, '') + ' · ' + parts.slice(1).join(' ');
    }
    return s;
  }

  $('nwGrid').innerHTML = news.map(function (n, idx) {
    var catName = CAT_SHORT[n.cat] || n.cat || '';
    return '<li class="nw-item" data-cat="' + esc(n.cat) + '">' +
      '<a class="nw-card" href="' + esc(n.source) + '" target="_blank" rel="noopener">' +
        '<div class="nw-top">' +
          '<span>' + pad2(idx + 1) + ' · <span class="nw-cat">' + esc(catName) + '</span></span>' +
          '<span class="nw-arr" aria-hidden="true">↗</span>' +
        '</div>' +
        '<div class="nw-mid">' +
          '<h3 class="nw-title">' + esc(cleanTitle(n.title)) + '</h3>' +
          '<p class="nw-sum">' + esc(n.summary) + '</p>' +
        '</div>' +
        '<div class="nw-foot">' +
          '<span>' + esc(dotDate(n.date)) + '</span>' +
          '<span>学院官网原文</span>' +
        '</div>' +
      '</a>' +
    '</li>';
  }).join('');

  $('nwFilters').addEventListener('click', function (e) {
    var btn = e.target.closest('.flt-btn');
    if (!btn) return;
    var cat = btn.getAttribute('data-cat');
    [].slice.call($('nwFilters').querySelectorAll('.flt-btn')).forEach(function (b) {
      var on = b === btn;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    [].slice.call($('nwGrid').querySelectorAll('.nw-item')).forEach(function (li) {
      var match = (cat === 'all') || (li.getAttribute('data-cat') === cat);
      li.hidden = !match;
    });
    // 分类切换改变了页面总高度，刷新后续锚点与转场带状态
    requestScrollUpdate();
  });

  // 05 加入我们 + 页脚
  $('joinSteps').innerHTML = (join.steps || []).map(function (s, idx) {
    return '<li data-rv><span class="step-no">0' + (idx + 1) + '</span>' +
      '<h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></li>';
  }).join('');

  if ($('joinMeta')) {
    var contact = meta.contact || {};
    var formVal = join.formUrl
      ? '<a class="wc-form-link" href="' + esc(join.formUrl) + '" target="_blank" rel="noopener">填写问卷 ↗</a>'
      : valOrPending(null);
    $('joinMeta').innerHTML =
      '<div class="wc-meta-item"><dt>集中招新时间</dt><dd>' + valOrPending(join.season) + '</dd></div>' +
      '<div class="wc-meta-item"><dt>线上报名问卷</dt><dd>' + formVal + '</dd></div>' +
      '<div class="wc-meta-item"><dt>社团招新群</dt><dd>' + valOrPending(contact.qqGroup) + '</dd></div>';
  }

  $('faqList').innerHTML = (join.faq || []).map(function (f, idx) {
    return '<details' + (idx === 0 ? ' open' : '') + '>' +
      '<summary><span>' + esc(f.q) + '</span><span class="faq-pm" aria-hidden="true"></span></summary>' +
      '<p>' + esc(f.a) + '</p></details>';
  }).join('');

  if (meta.name) {
    $('ftName').textContent = meta.name + (meta.en ? ' · ' + meta.en : '');
    $('ftMeta').textContent = '挂靠单位：' + (meta.host || '') + ' · ' + (meta.founded || 2021) + ' 年成立 · ' + (meta.location || '');
  }

  /* ---------- 2. 复制公众号按钮（HTTP 环境兼容：隐藏 textarea + execCommand） ---------- */
  var copyBtn = $('copyBtn');
  var copyMsg = $('copyMsg');
  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var target = '上海大学通信学院';
      var ok = false;
      var ta = document.createElement('textarea');
      ta.value = target;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      try {
        ta.setSelectionRange(0, target.length);
        ok = document.execCommand('copy');
      } catch (err) {
        ok = false;
      }
      document.body.removeChild(ta);
      if (ok) {
        copyBtn.classList.add('copied');
        copyMsg.textContent = '已复制「上海大学通信学院」，打开微信搜索并关注即可留意活动通知。';
      } else {
        copyMsg.textContent = '微信里搜索：上海大学通信学院';
      }
    });
  }

  /* ---------- 3. 吉祥物小智互动（真实社团提示轮换） ---------- */
  var mascotLines = [
    '翔英大楼 T404 / T406 常办焊接课，零基础也能一对一上手。',
    '社团面向全校招新，不是通信学院的同学也完全可以来。',
    '没有报名表和 QQ 群，关注「上海大学通信学院」公众号等预告就行。',
    '与华为合作的昇腾 AI 课会带你亲手跑通 Transformer 和 BERT 微调。',
    '学术部、组织部、宣传部、办公部四个部门，来过活动后再按兴趣选。'
  ];
  var mascotIdx = 0;
  var mascotBtn = $('mascotBtn');
  var mascotLine = $('mascotLine');
  if (mascotBtn && mascotLine) {
    mascotBtn.addEventListener('click', function () {
      mascotIdx = (mascotIdx + 1) % mascotLines.length;
      mascotLine.textContent = mascotLines[mascotIdx];
    });
  }

  /* ---------- 4. 首屏重新落墨按钮 & 过渡文字拆字 ---------- */
  var reInkBtn = $('reInkBtn');
  if (reInkBtn) {
    reInkBtn.addEventListener('click', function () {
      if (window.InkFluid) window.InkFluid.splash();
    });
  }

  var bridgeLine = document.querySelector('[data-split]');
  var bridgeChars = [];
  if (bridgeLine) {
    var rawTxt = bridgeLine.textContent;
    bridgeLine.setAttribute('aria-label', rawTxt);
    bridgeLine.innerHTML = rawTxt.split('').map(function (c) {
      return '<span class="ch" aria-hidden="true">' + esc(c) + '</span>';
    }).join('');
    bridgeChars = [].slice.call(bridgeLine.children);
  }

  /* ---------- 5. 滚动编排：首屏吹墨、横向活动平移、顶栏反色、墨晕转场 ---------- */
  var mainEl = $('top');
  var hero = $('hero');
  var heroStage = $('heroStage');
  var heroCopy = $('heroCopy');
  var heroFoot = $('heroFoot');
  var heroBridge = $('heroBridge');
  var fluidCv = $('fluidCv');
  var fluidFb = $('fluidFb');
  var hdr = $('hdr');

  var pgSec = $('programs');
  var pgSticky = $('pgSticky');
  var pgViewport = $('pgViewport');
  var pgTrack = $('pgTrack');
  var pgBar = $('pgBar');
  var pgIdx = $('pgIdx');
  var totalPrograms = Math.max(1, programs.length);

  var atMatch = /[?&]at=(\d+)/.exec(window.location.search);
  var debugY = atMatch ? parseInt(atMatch[1], 10) : null;
  var debugSnapPending = (debugY !== null);

  var pgTravel = 0;
  var isDesktopRail = false;
  var lastHeroP = 0;
  var heroActive = true;
  var scrollTicking = false;

  function layoutPrograms() {
    if (!pgSec || !pgTrack || !pgViewport) return;
    isDesktopRail = (window.innerWidth > 960) && !reduceMotion;
    if (isDesktopRail) {
      pgTrack.style.transform = 'translate3d(0,0,0)';
      pgTravel = Math.max(0, pgTrack.scrollWidth - pgViewport.clientWidth + 24);
      pgSec.style.height = (window.innerHeight + pgTravel) + 'px';
    } else {
      pgTravel = 0;
      pgSec.style.height = '';
      pgTrack.style.transform = '';
    }
  }

  function updateProgramControls(q) {
    if (pgBar) pgBar.style.transform = 'scaleX(' + clamp(0.2 + q * 0.8, 0.2, 1).toFixed(3) + ')';
    if (pgIdx) {
      var cur = Math.min(totalPrograms, Math.max(1, Math.round(q * (totalPrograms - 1)) + 1));
      pgIdx.textContent = pad2(cur) + ' / ' + pad2(totalPrograms);
    }
  }

  // 窄屏原生横滑时同步进度条
  if (pgViewport) {
    pgViewport.addEventListener('scroll', function () {
      if (isDesktopRail) return;
      var maxS = Math.max(1, pgViewport.scrollWidth - pgViewport.clientWidth);
      updateProgramControls(clamp(pgViewport.scrollLeft / maxS, 0, 1));
    }, { passive: true });
  }

  function stepProgramCard(dir) {
    if (isDesktopRail && pgTravel > 0) {
      var secTop = pgSec.getBoundingClientRect().top + window.pageYOffset;
      var curQ = clamp((window.pageYOffset - secTop) / pgTravel, 0, 1);
      var step = 1 / Math.max(1, totalPrograms - 1);
      var nextQ = clamp(Math.round(curQ / step + dir) * step, 0, 1);
      window.scrollTo({ top: secTop + nextQ * pgTravel, behavior: reduceMotion ? 'auto' : 'smooth' });
    } else if (pgViewport) {
      var cardEl = pgTrack.querySelector('.pg-card');
      var w = cardEl ? (cardEl.offsetWidth + 16) : 300;
      pgViewport.scrollBy({ left: dir * w, behavior: reduceMotion ? 'auto' : 'smooth' });
    }
  }
  if ($('pgPrev')) $('pgPrev').addEventListener('click', function () { stepProgramCard(-1); });
  if ($('pgNext')) $('pgNext').addEventListener('click', function () { stepProgramCard(1); });

  var darkZones = ['about', 'people', 'join'].map($).filter(Boolean);
  var ftrEl = document.querySelector('.ftr');
  if (ftrEl) darkZones.push(ftrEl);

  var navLinks = [].slice.call(document.querySelectorAll('.nav a'));
  var navOrder = ['about', 'honors', 'programs', 'people', 'news', 'join'];
  function syncNavActive() {
    var line = Math.min(220, (window.innerHeight || 900) * 0.28);
    var activeId = '';
    for (var i = 0; i < navOrder.length; i++) {
      var el = $(navOrder[i]);
      if (el && el.getBoundingClientRect().top <= line) {
        activeId = '#' + navOrder[i];
      }
    }
    navLinks.forEach(function (a) {
      var active = a.getAttribute('href') === activeId;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  function updateHeaderTheme() {
    var probeY = 34;
    var onDark = false;
    for (var i = 0; i < darkZones.length; i++) {
      var r = darkZones[i].getBoundingClientRect();
      if (r.top <= probeY && r.bottom >= probeY) {
        onDark = true;
        break;
      }
    }
    hdr.classList.toggle('on-dark', onDark);
  }

  function revealVisibleElements() {
    var vh = window.innerHeight || 900;
    var els = document.querySelectorAll('[data-rv]:not(.in)');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (r.top < vh * 0.96) {
        els[i].classList.add('in');
      }
    }
  }

  function onScrollFrame() {
    scrollTicking = false;
    var vh = Math.max(1, window.innerHeight);

    // 若真实用户滚动了页面，自动退出 ?at= 静态截图定位态
    if (debugY !== null && (window.pageYOffset || 0) > 4) {
      debugY = null;
      if (mainEl) mainEl.style.transform = '';
      if (heroStage) heroStage.style.transform = '';
      if (pgSticky) pgSticky.style.transform = '';
    }

    if (debugY !== null && mainEl) {
      var maxDoc = Math.max(0, mainEl.scrollHeight + (ftrEl ? ftrEl.offsetHeight : 0) - vh);
      var dy = clamp(debugY, 0, maxDoc > 0 ? maxDoc : debugY);
      mainEl.style.transform = 'translate3d(0,' + (-dy) + 'px,0)';
      if (ftrEl) ftrEl.style.transform = 'translate3d(0,' + (-dy) + 'px,0)';
      if (heroStage && hero && !reduceMotion) {
        var hSpanDbg = Math.max(0, hero.offsetHeight - vh);
        heroStage.style.transform = 'translate3d(0,' + clamp(dy, 0, hSpanDbg) + 'px,0)';
      }
      if (pgSticky && pgSec && isDesktopRail && pgTravel > 0) {
        var pgRel = dy - pgSec.offsetTop;
        pgSticky.style.transform = 'translate3d(0,' + clamp(pgRel, 0, pgTravel) + 'px,0)';
      }
    }

    // 1. 首屏进度与吹墨效果
    if (hero) {
      var hRect = hero.getBoundingClientRect();
      var span = Math.max(1, hero.offsetHeight - vh);
      var p = reduceMotion ? 0 : clamp(-hRect.top / span, 0, 1);
      var dp = p - lastHeroP;
      lastHeroP = p;

      if (window.InkFluid) {
        window.InkFluid.setScroll(p, dp, debugSnapPending);
        debugSnapPending = false;
      }

      if (!reduceMotion) {
        var fadeOut = smoothstep(0.03, 0.28, p);
        // 顶置静止时不设 transform/opacity，确保 hero-title 的 mix-blend-mode: multiply 直接与 WebGL 宣纸墨流叠印
        if (fadeOut <= 0.002) {
          heroCopy.style.opacity = '';
          heroCopy.style.transform = '';
          heroFoot.style.opacity = '';
        } else {
          heroCopy.style.opacity = (1 - fadeOut).toFixed(3);
          heroCopy.style.transform = 'translate3d(0,' + (-fadeOut * 54).toFixed(1) + 'px,0)';
          heroFoot.style.opacity = (1 - fadeOut).toFixed(3);
        }

        // 中段显影句
        if (heroBridge) {
          var bIn = smoothstep(0.22, 0.36, p);
          var bOut = smoothstep(0.86, 1.0, p);
          var bVis = bIn * (1 - bOut);
          heroBridge.style.opacity = bVis.toFixed(3);
          heroBridge.style.transform = 'translate3d(0, calc(-50% + ' + ((1 - bIn) * 24 - bOut * 28).toFixed(1) + 'px), 0)';
          for (var c = 0; c < bridgeChars.length; c++) {
            var cStart = 0.24 + (c / Math.max(1, bridgeChars.length)) * 0.18;
            var cv = smoothstep(cStart, cStart + 0.08, p);
            bridgeChars[c].style.opacity = cv.toFixed(3);
            bridgeChars[c].style.transform = 'translate3d(0,' + ((1 - cv) * 14).toFixed(1) + 'px,0)';
          }
        }
      }

      // 视口外立即停止 WebGL 渲染
      var inHeroView = hRect.bottom > 0 && hRect.top < vh;
      if (inHeroView !== heroActive) {
        heroActive = inHeroView;
        if (fluidCv) fluidCv.style.visibility = inHeroView ? '' : 'hidden';
        if (fluidFb) fluidFb.style.visibility = inHeroView ? '' : 'hidden';
        if (window.InkFluid) {
          if (inHeroView && !document.hidden) window.InkFluid.start();
          else window.InkFluid.stop();
        }
      }
    }

    // 2. 02 平时做什么：纵向滚 -> 横向平移
    if (isDesktopRail && pgSec && pgTravel > 0) {
      var pr = pgSec.getBoundingClientRect();
      var q = clamp(-pr.top / pgTravel, 0, 1);
      pgTrack.style.transform = 'translate3d(' + (-q * pgTravel).toFixed(1) + 'px,0,0)';
      updateProgramControls(q);
    }

    // 3. 分区水墨晕染转场 & 顶栏反色 & 导航高亮 & 入场揭示
    if (window.InkBleed) window.InkBleed.update();
    updateHeaderTheme();
    syncNavActive();
    revealVisibleElements();
  }

  function requestScrollUpdate() {
    if (!scrollTicking) {
      scrollTicking = true;
      requestAnimationFrame(onScrollFrame);
    }
  }

  window.addEventListener('scroll', requestScrollUpdate, { passive: true });
  window.addEventListener('resize', function () {
    layoutPrograms();
    onScrollFrame();
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (!window.InkFluid) return;
    if (document.hidden) window.InkFluid.stop();
    else if (heroActive) window.InkFluid.start();
  });

  /* ---------- 6. IntersectionObserver 渐入观察 ---------- */
  if ('IntersectionObserver' in window) {
    var rvObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          rvObserver.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -6% 0px' });
    [].slice.call(document.querySelectorAll('[data-rv]')).forEach(function (el) {
      rvObserver.observe(el);
    });
  } else {
    [].slice.call(document.querySelectorAll('[data-rv]')).forEach(function (el) {
      el.classList.add('in');
    });
  }

  // 不依赖 requestAnimationFrame 的入场兜底：2 秒后确保视口内元素全部就位
  setTimeout(function () {
    root.classList.remove('entering');
    root.classList.add('entered');
    revealVisibleElements();
  }, 2000);

  /* ---------- 7. 初始化与 ?at=像素 无头截图调试跳转 ---------- */
  function jumpIfRequested() {
    if (window.InkFluid && window.InkFluid.syncLayout) window.InkFluid.syncLayout();
    layoutPrograms();
    onScrollFrame();
    if (debugY !== null) {
      root.classList.remove('entering');
      root.classList.add('entered');
      var els = document.querySelectorAll('[data-rv]');
      for (var i = 0; i < els.length; i++) {
        els[i].style.transition = 'none';
        els[i].classList.add('in');
      }
    }
  }

  if (window.InkFluid && window.InkFluid.syncLayout) window.InkFluid.syncLayout();
  layoutPrograms();
  onScrollFrame();
  if (!document.hidden && window.InkFluid) window.InkFluid.start();

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(jumpIfRequested);
  }
  window.addEventListener('load', jumpIfRequested);
})();
