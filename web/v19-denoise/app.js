/* v19-denoise · 页面逻辑
 * 原生滚动 + 吸顶舞台：每一拍 = 去噪（40%）→ 停住可读（45%）→ 加噪过渡（15%）。
 * 不拦截任何滚轮/触摸，只读 scrollY；进度一一对应步数，往回滑就是加噪。
 */
(function () {
  'use strict';
  var d = document, R = d.documentElement, C = window.CLUB;
  var STEPS = 50;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function $(id) { return d.getElementById(id); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function dot(date) { return String(date).replace(/-/g, '.'); }
  function ym(date) { return String(date).slice(0, 7).replace('-', '.'); }

  if (!C) { R.classList.remove('staged'); return; }

  /* ================= 内容渲染（全部来自 shared/content.js） ================= */
  var M = C.meta, NEWS = C.news || [], P = C.people || {}, J = C.join || {};
  var account = String((M.contact && M.contact.wechat) || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '').trim();
  var TOTAL_BEATS = 5;

  $('heroKicker').textContent = M.founded + ' 年成立';

  function head(i, title, sub) {
    return '<header class="bh"><p class="idx">' + pad2(i) + ' / ' + pad2(TOTAL_BEATS) + '</p>' +
      '<h2 id="h' + i + '">' + esc(title) + '</h2>' + (sub ? '<p class="sub">' + esc(sub) + '</p>' : '') + '</header>';
  }
  function firstClause(s) { return String(s).split(/[；：]/)[0].replace(/[。，]$/, ''); }

  // ② 平时做什么
  var progHTML = (C.programs || []).map(function (p, k) {
    return '<li><span class="n">' + pad2(k + 1) + '</span><div class="pt"><h3>' + esc(p.name) + '</h3><p>' +
      esc(firstClause(p.desc)) + '</p></div><span class="w">' + esc(p.where) + '</span></li>';
  }).join('');

  // ③ 做过的事：只挑报道里写明人数的 5 条，人数原样照抄
  var PICKS = [
    { src: '46475', big: '40 余名', what: '同学入选昇腾大模型实践课' },
    { src: '45485', big: '近百名', what: '学子走进华为鸿蒙生态学堂' },
    { src: '45315', big: '百余人', what: '报名社团协办的焊接专项赛' },
    { src: '43095', big: '近 200 人', what: '来听 AI 论文分享会' },
    { src: '42585', big: '百余名', what: '同学去 2024 华为全联接大会' }
  ];
  var featHTML = PICKS.map(function (pk) {
    var n = null;
    for (var k = 0; k < NEWS.length; k++) if (NEWS[k].source.indexOf(pk.src) > -1) { n = NEWS[k]; break; }
    if (!n) return '';
    return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener" title="' + esc(n.title) + '">' +
      '<span class="date">' + ym(n.date) + '</span><span class="big">' + esc(pk.big) + '</span>' +
      '<span class="what">' + esc(pk.what) + '</span><span class="more">看原文报道</span></a></li>';
  }).join('');

  // ④ 谁在带大家
  var lead = (P.leaders || [])[0];
  var leadHTML = lead ? '<div class="lead">' +
    (lead.photo ? '<img class="photo" src="../shared/img/' + esc(lead.photo) + '" alt="社长' + esc(lead.name) + '的照片" width="228" height="671" draggable="false">' : '') +
    '<div class="lead-t"><p class="role">' + esc(lead.role) + '</p><h3 class="nm">' + esc(lead.name) + '</h3><p>' +
    esc(String(lead.desc).split('。')[0]) + '。</p></div></div>' : '';
  var teachHTML = (P.teachers || []).map(function (t) {
    var role = String(t.role).split('·');
    return '<li><h3>' + esc(t.name) + '</h3><p><span class="tr1">' + esc((role[0] || '').trim()) + '</span><span class="tr2">' +
      esc((role[1] || '').trim()) + '</span></p></li>';
  }).join('');
  var deptHTML = (M.departments || []).map(function (x) {
    return '<li><b>' + esc(x.name) + '</b><span>' + esc(x.desc) + '</span></li>';
  }).join('');

  // ⑤ 怎么加入
  var stepHTML = (J.steps || []).map(function (s, k) {
    return '<li><span class="n">' + (k + 1) + '</span><div><h3>' + esc(s.t) + '</h3><p>' + esc(s.d) + '</p></div></li>';
  }).join('');

  var beatsHTML =
    '<section class="beat b-do" id="b2" data-i="1" aria-labelledby="h2"><div class="in">' +
      '<div class="col-a">' + head(2, '平时做什么') + '<img class="zhi" src="img/zhi-think.webp" alt="" width="220" height="220" draggable="false"></div>' +
      '<ol class="prog">' + progHTML + '</ol></div></section>' +
    '<section class="beat b-did" id="b3" data-i="2" aria-labelledby="h3"><div class="in">' +
      head(3, '做过的事', '学院官网报道过 ' + NEWS.length + ' 次，挑出写明人数的 5 次。') +
      '<ol class="feats">' + featHTML + '</ol>' +
      '<button class="btn-all" type="button" id="openNews">全部 ' + NEWS.length + ' 篇报道<span aria-hidden="true">→</span></button>' +
    '</div></section>' +
    '<section class="beat b-who" id="b4" data-i="3" aria-labelledby="h4"><div class="in">' +
      '<div class="col-a">' + head(4, '谁在带大家') + leadHTML + '</div>' +
      '<div class="col-b"><h3 class="lab">指导老师</h3><ul class="teach">' + teachHTML + '</ul>' +
      '<h3 class="lab">' + (M.departments || []).length + ' 个部门</h3><ul class="depts">' + deptHTML + '</ul></div>' +
    '</div></section>' +
    '<section class="beat b-join" id="b5" data-i="4" aria-labelledby="h5"><div class="in">' +
      '<div class="col-a">' + head(5, '怎么加入', '全校同学都能来，不会编程也行。') +
        '<div class="copy"><button class="btn-copy" type="button" id="copyBtn">复制公众号名「' + esc(account) + '」</button>' +
        '<p class="copy-msg" id="copyMsg" role="status" aria-live="polite" data-np></p></div>' +
        '<img class="zhi" src="img/zhi-wave.webp" alt="" width="220" height="220" draggable="false"></div>' +
      '<ol class="steps">' + stepHTML + '</ol>' +
    '</div></section>';
  $('beats').insertAdjacentHTML('beforeend', beatsHTML);

  // 页脚：常见问题 + 来源 + 管理后台
  var faqHTML = (J.faq || []).map(function (f) {
    return '<div class="qa"><dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd></div>';
  }).join('');
  $('foot').innerHTML =
    '<div class="foot-in"><h2 class="foot-h">常见问题</h2><dl class="faq">' + faqHTML + '</dl>' +
    '<div class="foot-bot"><img class="wm" src="../shared/img/brand/scie-wordmark.png" alt="上海大学通信与信息工程学院" width="3526" height="738">' +
    '<p>' + esc(M.name) + ' · ' + M.founded + ' 年成立 · 挂靠' + esc(M.host) + '<br>' + esc(M.location) + '<br>' +
    '页面内容整理自学院官网公开报道（' + NEWS.length + ' 篇）。</p>' +
    '<a class="admin" href="/admin/">管理后台</a></div></div>';

  $('newsList').innerHTML = NEWS.map(function (n) {
    return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener"><span class="date">' + dot(n.date) +
      '</span><span class="tt">' + esc(n.title) + '</span></a></li>';
  }).join('');

  /* ================= 小交互：复制、报道列表 ================= */
  $('copyBtn').addEventListener('click', function () {
    var ok = false, ta = d.createElement('textarea');
    ta.value = account; ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    d.body.appendChild(ta); ta.select();
    try { ta.setSelectionRange(0, 99); ok = d.execCommand('copy'); } catch (e) { ok = false; }
    d.body.removeChild(ta);
    $('copyMsg').textContent = ok ? '已复制。打开微信搜索框粘贴，关注即可。' : '微信里搜索：' + account;
  });

  var panel = $('newsPanel'), lastFocus = null;
  function openPanel() {
    lastFocus = d.activeElement; panel.hidden = false;
    R.classList.add('panel-open');
    panel.querySelector('.panel-x').focus();
  }
  function closePanel() {
    panel.hidden = true; R.classList.remove('panel-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }
  $('openNews').addEventListener('click', openPanel);
  panel.addEventListener('click', function (e) { if (e.target.closest('[data-close]')) closePanel(); });
  d.addEventListener('keydown', function (e) {
    if (panel.hidden) return;
    if (e.key === 'Escape') closePanel();
    if (e.key === 'Tab') { // 焦点留在面板里
      var f = panel.querySelectorAll('a,button'), a = f[0], z = f[f.length - 1];
      if (e.shiftKey && d.activeElement === a) { z.focus(); e.preventDefault(); }
      else if (!e.shiftKey && d.activeElement === z) { a.focus(); e.preventDefault(); }
    }
  });

  /* ================= 舞台 ================= */
  var track = $('track'), stage = $('stage'), canvas = $('gl'), beatsBox = $('beats');
  var beats = [].slice.call(d.querySelectorAll('.beat'));
  var rail = $('rail'), railFill = $('railFill'), roStep = $('roStep'), roPhase = $('roPhase'), roNote = $('roNote');
  var params = new URLSearchParams(location.search);
  var ghost = params.has('ghost');   // 调试：画布内容不淡出，用来核对字有没有对齐
  if (ghost) R.classList.add('ghost');
  var hold = params.has('hold') ? Math.max(0, Math.min(1, parseFloat(params.get('hold')) || 0)) : null; // 调试：首屏停在某个噪声水平
  var atParam = params.has('at') ? parseInt(params.get('at'), 10) || 0 : null;

  // 每拍：a = 去噪段，r = 可读段，x = 加噪过渡段，L = 这一拍的滚动长度（舞台高度的倍数）
  var SEG = [
    { a: 0, r: 0.78, x: 0.22, L: 0.7 },   // 首屏：自动去噪，滚动只负责结尾的加噪
    { a: 0.40, r: 0.45, x: 0.15, L: 1.9 },
    { a: 0.40, r: 0.45, x: 0.15, L: 1.9 },
    { a: 0.40, r: 0.45, x: 0.15, L: 1.9 },
    { a: 0.40, r: 0.60, x: 0, L: 1.5 }    // 最后一拍不再加噪，接页脚
  ];
  var NAMES = ['社团是什么', '平时做什么', '做过的事', '谁在带大家', '怎么加入'];

  var engine = null, staged = false;
  var geo = { H: 1, W: 1, top: 0, total: 1, starts: [], lens: [] };
  var tgt = { i: 0, t: 1, p: 0 }, disp = { i: 0, t: 1 };
  var intro = { done: false, t: 1, start: 0 };
  var content = 1, lastNow = 0, raf = 0, onBeat = -1, visible = true;
  var press = { on: false, x: 0, y: 0, k: 0, r: 130 };
  var ticks = [];

  // 进度刻度
  NAMES.forEach(function (nm, i) {
    var b = d.createElement('button');
    b.type = 'button'; b.className = 'tick';
    b.setAttribute('aria-label', '第 ' + (i + 1) + ' 拍：' + nm);
    b.innerHTML = '<span>' + (i + 1) + '</span>';
    b.addEventListener('click', function () { jump(i, 'smooth'); });
    rail.querySelector('.rail-bar').appendChild(b);
    ticks.push(b);
  });

  function measure() {
    geo.W = stage.clientWidth; geo.H = stage.clientHeight;
    var s = 0;
    geo.starts = []; geo.lens = [];
    SEG.forEach(function (g) { geo.starts.push(s); var l = g.L * geo.H; geo.lens.push(l); s += l; });
    geo.total = s;
    track.style.height = Math.round(geo.H + s) + 'px';
    geo.top = track.getBoundingClientRect().top + window.pageYOffset;
    // 刻度放在每一拍"去噪完成"的位置：进度条走到刻度，正好是这一拍的图生成完
    ticks.forEach(function (b, i) { b.style.setProperty('--pos', ((geo.starts[i] + SEG[i].a * geo.lens[i]) / geo.total).toFixed(4)); });
  }

  function fromScroll(y) {
    var p = Math.max(0, Math.min(geo.total, y - geo.top)), i = 0;
    while (i < SEG.length - 1 && p >= geo.starts[i + 1]) i++;
    var g = SEG[i], u = (p - geo.starts[i]) / geo.lens[i], t;
    if (u < g.a) t = 1 - u / g.a;
    else if (u <= g.a + g.r || !g.x) t = 0;
    else t = Math.min(1, (u - g.a - g.r) / g.x);
    if (i === 0 && !intro.done) t = Math.max(t, intro.t);
    return { i: i, t: t, p: p, u: u };
  }

  function jumpY(i) {
    var g = SEG[i];
    return geo.top + geo.starts[i] + (i === 0 ? 0 : (g.a + 0.04) * geo.lens[i]);
  }
  function jump(i, how) {
    if (!staged) { beats[i].scrollIntoView({ behavior: how === 'smooth' ? 'smooth' : 'auto' }); return; }
    window.scrollTo({ top: Math.round(jumpY(i)), behavior: how || 'smooth' });
  }

  // 顶栏/按钮里的 data-go：舞台模式下按拍跳转
  d.addEventListener('click', function (e) {
    var a = e.target.closest('[data-go]');
    if (!a || !staged) return;
    e.preventDefault();
    jump(+a.getAttribute('data-go'), 'smooth');
  });

  // 键盘 Tab 进了还没显示的那一拍：直接把页面翻到那一拍的可读段
  d.addEventListener('focusin', function (e) {
    if (!staged) return;
    var b = e.target.closest && e.target.closest('.beat');
    if (!b) return;
    var i = +b.getAttribute('data-i');
    if (i !== onBeat) jump(i, 'auto');
  });

  function applyHTML() {
    var show = tgt.t === 0 && (tgt.i !== 0 || intro.done) ? tgt.i : -1;
    if (show !== onBeat) {
      beats.forEach(function (b, k) { b.classList.toggle('on', k === show); });
      onBeat = show;
      // 文字一亮出来，背后必须已经是干净的：不等动画帧，当场画一张第 0 步
      if (show >= 0 && engine && staged) { disp.i = show; disp.t = 0; draw(0); }
      if (show === 0 && !R.hasAttribute('data-shown')) R.setAttribute('data-shown', Math.round(performance.now())); // 首屏文字亮出的时刻（毫秒）
    }
    railFill.style.setProperty('--f', (tgt.p / geo.total).toFixed(4));
    ticks.forEach(function (b, k) {
      var cur = k === tgt.i;
      b.classList.toggle('cur', cur);
      if (cur) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
  }

  // ?at=像素：调试用。页面本身不滚动，只把舞台画成"滚到这个位置"时的样子，方便无头截图直接看中间某一拍
  function curY() {
    if (atParam !== null && window.pageYOffset < 2) return atParam;
    atParam = null;
    return window.pageYOffset;
  }

  function onScroll() {
    if (!staged) return;
    tgt = fromScroll(curY());
    applyHTML();
    kick();
  }

  // 正常靠 requestAnimationFrame；它停摆时（后台、无头截图）用 setTimeout 顶上，画面不会卡在半路
  var tmo = 0;
  function kick() {
    if (raf || !staged) return;
    raf = requestAnimationFrame(frame);
    tmo = setTimeout(function () { if (raf) { cancelAnimationFrame(raf); frame(performance.now()); } }, 100);
  }

  function frame(now) {
    raf = 0; clearTimeout(tmo);
    // 帧间隔过大（后台、被节流、靠 setTimeout 顶上时）：直接跳到目标状态，不在半路慢慢挪
    var raw = lastNow ? now - lastNow : 16, lag = raw > 90, dt = Math.min(raw, 250); lastNow = now;
    var more = false;

    if (!intro.done && intro.start) {
      var s = Math.min(1, (now - intro.start) / 560);
      intro.t = 1 - s;
      if (s >= 1) finishIntro(); else more = true;
      tgt = fromScroll(curY());
    }

    // 显示状态追目标：跨拍时先加噪到满，再换图去噪（很短的缓动）
    if (lag) { disp.i = tgt.i; disp.t = tgt.t; }
    else if (tgt.i !== disp.i) {
      disp.t = Math.min(1, disp.t + Math.max(0.07, (1 - disp.t) * 0.4) * dt / 16);
      if (disp.t >= 0.999) { disp.i = tgt.i; disp.t = 1; }
      more = true;
    } else {
      var e = tgt.t - disp.t;
      if (Math.abs(e) < 0.006) disp.t = tgt.t; else { disp.t += e * (1 - Math.pow(0.62, dt / 16)); more = true; }
    }
    var step = Math.round(disp.t * STEPS);

    // HTML 接管后，画布里的内容淡出（只剩安静的纸面颗粒）
    var cWant = (onBeat === disp.i && step === 0 && !ghost) ? 0 : 1;
    if (content !== cWant) {
      content = cWant || lag ? cWant : Math.max(0, content - dt / 320);
      if (content !== cWant) more = true;
    }

    // 按住彩蛋
    var kWant = press.on ? 1 : 0;
    if (press.k !== kWant) {
      press.k = lag ? kWant : press.k + (kWant - press.k) * Math.min(1, (press.on ? 0.16 : 0.13) * (dt / 16));
      if (Math.abs(press.k - kWant) < 0.01) press.k = kWant;
      more = true;
    }
    updateMask();

    draw(step);
    var noising = tgt.i !== disp.i || tgt.u > SEG[tgt.i].a + SEG[tgt.i].r;
    var phase = step === 0 ? '完成' : (noising ? '加噪' : '去噪');
    if (roPhase.textContent !== phase) roPhase.textContent = phase;
    roNote.classList.toggle('show', disp.i === 0);
    if (more) kick(); else lastNow = 0;
  }

  function draw(step) {
    if (engine && visible) {
      engine.render({
        beat: disp.i, t: step / STEPS, seed: step + disp.i * 97 + 1, content: content,
        px: press.x, py: press.y, pr: press.r * (0.45 + 0.55 * press.k), pk: press.k
      });
    }
    roStep.textContent = step;
    if (step === 0 && roPhase.textContent !== '完成') roPhase.textContent = '完成';
  }

  function updateMask() {
    if (press.k > 0.01) {
      beatsBox.classList.add('pressing');
      beatsBox.style.setProperty('--mx', press.x + 'px');
      beatsBox.style.setProperty('--my', press.y + 'px');
      beatsBox.style.setProperty('--mr', (press.r * (0.45 + 0.55 * press.k)).toFixed(1) + 'px');
    } else if (beatsBox.classList.contains('pressing')) beatsBox.classList.remove('pressing');
  }

  function finishIntro() {
    if (intro.done) return;
    // 后台标签页里没看到去噪过程：等切回来时再跑一遍
    intro.replay = d.hidden && staged;
    intro.done = true; intro.t = 0;
    R.classList.add('intro-done');
    if (staged) { tgt = fromScroll(curY()); applyHTML(); kick(); }
  }

  /* ---- 按住画面空白处：那一圈临时重新加噪，松手去噪回来 ---- */
  function blankTarget(el) {
    return el === stage || el === canvas || el === beatsBox || el.tagName === 'IMG' || el.tagName === 'FIGURE' ||
      (el.classList && (el.classList.contains('beat') || el.classList.contains('in') || el.classList.contains('col-a') || el.classList.contains('col-b')));
  }
  function setPress(e) {
    var r = stage.getBoundingClientRect();
    press.x = e.clientX - r.left; press.y = e.clientY - r.top;
  }
  stage.addEventListener('pointerdown', function (e) {
    if (!staged || !engine || e.button > 0 || !blankTarget(e.target)) return;
    press.on = true; press.r = Math.max(90, Math.min(170, geo.W * 0.11));
    setPress(e); kick();
  });
  stage.addEventListener('pointermove', function (e) { if (press.on) { setPress(e); kick(); } });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
    stage.addEventListener(ev, function () { if (press.on) { press.on = false; kick(); } });
  });

  /* ---- 画干净图 ---- */
  var paperCss = '#ebeae5';
  function paint(i) {
    if (!engine || !staged) return;
    try { engine.paintBeat(i, beats[i], stage.getBoundingClientRect(), paperCss); } catch (e) { /* 画不出就保持纯纸面 */ }
    if (i === disp.i) kick();
  }
  function paintAll(first) {
    paint(first);
    var order = [0, 1, 2, 3, 4].filter(function (k) { return k !== first; }), n = 0;
    (function next() {
      if (n >= order.length) return;
      paint(order[n++]); setTimeout(next, 30);
    })();
  }
  // 图片晚到：重画它所在的那一拍
  beats.forEach(function (b, i) {
    [].forEach.call(b.querySelectorAll('img'), function (img) {
      if (!img.complete) img.addEventListener('load', function () { paint(i); }, { once: true });
    });
  });

  // 每一拍的内容是否都放得进舞台（扣掉上下留白）。放不下就退回普通页面，绝不裁掉信息
  function fits() {
    for (var k = 0; k < beats.length; k++) {
      var b = beats[k], inn = b.querySelector('.in'), cs = getComputedStyle(b);
      var avail = b.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      if (inn && inn.offsetHeight > avail + 2) return false;
    }
    return true;
  }

  var flatWhy = '';
  function goFlat(why) {
    flatWhy = why || 'fail';
    staged = false;
    R.classList.remove('staged');
    intro.done = true; intro.t = 0;
    R.classList.add('intro-done');
    track.style.height = '';
    beats.forEach(function (b) { b.classList.add('on'); });
    onBeat = -2;
    if (raf) cancelAnimationFrame(raf);
    raf = 0; clearTimeout(tmo);
    press.on = false; press.k = 0; updateMask();
  }
  // 因为放不下才退回的：窗口变大、字体到齐后再试一次
  function tryStage() {
    if (staged || flatWhy !== 'overflow' || !engine) return;
    R.classList.add('staged');
    beats.forEach(function (b) { b.classList.remove('on'); });
    onBeat = -1; staged = true;
    measure();
    if (!fits()) { goFlat('overflow'); return; }
    flatWhy = '';
    relayout(true);
  }

  var lastSize = '';
  function sizeEngine() {
    var w = stage.clientWidth, h = stage.clientHeight;
    var mob = Math.min(w, h) < 600 && window.matchMedia && matchMedia('(pointer: coarse)').matches;
    engine.resize(w, h, Math.min(window.devicePixelRatio || 1, mob ? 1 : 1.5));
    lastSize = w + 'x' + h;
  }
  function relayout(force) {
    if (!staged) { tryStage(); return; }
    measure();
    if (!fits()) { goFlat('overflow'); return; }
    if (force || stage.clientWidth + 'x' + stage.clientHeight !== lastSize) {
      sizeEngine();
      paintAll(disp.i);
    }
    onScroll();
  }

  function init() {
    if (!R.classList.contains('staged')) { goFlat('reduce'); return; }
    engine = window.Denoise && window.Denoise.create(canvas);
    if (!engine) { goFlat('fail'); return; }
    staged = true;
    R.classList.add('stage-ok');
    var cs = getComputedStyle(stage);
    paperCss = cs.backgroundColor || paperCss;
    var m = paperCss.match(/\d+(\.\d+)?/g);
    if (m) engine.setPaper([m[0] / 255, m[1] / 255, m[2] / 255]);

    measure();
    sizeEngine();
    if (!fits()) goFlat('overflow');

    if (atParam !== null) {
      intro.done = true; R.classList.add('intro-done');
    } else if (window.pageYOffset > 4) {
      intro.done = true; R.classList.add('intro-done');
    }
    if (staged) {
      tgt = fromScroll(curY());
      if (atParam !== null) { disp.i = tgt.i; disp.t = tgt.t; }
      applyHTML(); kick();
    }

    // 字体就绪（最多等 300ms）后画首屏，开跑去噪；1 秒内无论如何把社团名亮出来
    var started = false;
    function go() {
      if (started) return; started = true;
      if (!staged) { tryStage(); return; }
      measure();
      paintAll(tgt.i);
      if (!intro.done && hold === null) { intro.start = performance.now(); kick(); }
    }
    var fr = d.fonts && d.fonts.ready ? d.fonts.ready : Promise.resolve();
    Promise.race([fr, new Promise(function (r) { setTimeout(r, 200); })]).then(go);
    setTimeout(go, 220);
    if (hold === null) setTimeout(finishIntro, Math.max(0, 800 - performance.now()));
    else if (staged) { intro.t = hold; tgt = fromScroll(curY()); disp.t = tgt.t; kick(); }
    // 字体全部到齐后再画一遍，保证去噪出来的字和真文字对得上
    fr.then(function () { setTimeout(function () { if (staged) relayout(true); else tryStage(); }, 60); });
    if (d.fonts && d.fonts.addEventListener) {
      var t2 = 0;
      d.fonts.addEventListener('loadingdone', function () { clearTimeout(t2); t2 = setTimeout(function () { if (staged) paintAll(disp.i); }, 150); });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // 滚动事件跟着渲染帧走，帧被节流时会迟到：每 200ms 再核对一次位置，保证读数和可读内容不卡在旧状态
    var lastY = -1;
    setInterval(function () {
      var y = window.pageYOffset;
      if (staged && y !== lastY) { lastY = y; onScroll(); }
    }, 200);
    var rt = 0;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { relayout(false); }, 180); });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { visible = en[0].isIntersecting; if (visible) kick(); }).observe(track);
    }
    d.addEventListener('visibilitychange', function () {
      if (d.hidden) return;
      if (intro.replay && staged && tgt.i === 0 && window.pageYOffset < 4 && engine.has(0)) {
        intro.replay = false; intro.done = false; intro.t = 1; intro.start = performance.now();
        disp.i = 0; disp.t = 1;
        tgt = fromScroll(curY()); applyHTML();
        setTimeout(finishIntro, 900);
      }
      kick();
    });
    canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); engine = null; goFlat('fail'); });

    var mq = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.addEventListener) mq.addEventListener('change', function () { if (mq.matches) goFlat('reduce'); });
  }

  try { init(); } catch (err) { engine = null; goFlat('fail'); }
})();
