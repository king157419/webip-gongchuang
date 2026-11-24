/* 首屏互动：教小智认出你。
 * 输入（摄像头或画板）→ 缩成 32 × 24 的灰度网格 → 亮度归一化 → 和你给的例子逐张比距离（KNN）。
 * 全部在浏览器里完成，不上传任何画面。 */
(function () {
  'use strict';
  var K = window.ZhiKNN;
  var W = K.W, H = K.H;
  var KNN_K = 5;          // 看最近的 5 张例子
  var SURE = 0.65;        // 把握低于这个数就说“拿不准”
  var CAP = 40;           // 每一类最多留 40 张，再多就把最早的换掉
  var SHOT_MS = 100;      // 按住时每 0.1 秒拍一张，一秒 10 张
  var DEFAULT_NAMES = ['举手', '不举手'];

  var $ = function (id) { return document.getElementById(id); };
  var lab = $('lab'), video = $('video'), pad = $('pad'), gridCv = $('grid');
  var face = $('zhi-face'), say = $('zhi-say'), bars = $('bars'), why = $('why'), whyImg = $('why-img'), whyTxt = $('why-txt');
  var digits = $('digits'), padHint = $('pad-hint'), capIn = $('cap-in');
  var btnCam = $('mode-cam'), btnDraw = $('mode-draw'), note = $('mode-note'), cover = $('cam-cover');
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var names = DEFAULT_NAMES.slice();
  var mode = 'draw';
  // 两种输入各记各的例子：画画和摄像头的“数字”不是一回事
  var sets = { draw: [], camera: [] };
  var serial = { draw: [0, 0], camera: [0, 0] };
  var last = { draw: null, camera: null };   // 最近一次有把握认出时，最像的是哪一张
  var current = null;                         // 当前输入的 { raw, vec }
  var stream = null, holding = -1, lastShot = 0, rafId = 0;

  var camOK = !!(window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  /* ---------- 画网格：把数字画成马赛克（墨色到纸色） ---------- */
  var INK = [22, 22, 26], PAPER = [251, 250, 247];
  function paint(cv, raw) {
    var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data;
    var lo = Infinity, hi = -Infinity, i;
    if (raw) for (i = 0; i < raw.length; i++) { if (raw[i] < lo) lo = raw[i]; if (raw[i] > hi) hi = raw[i]; }
    var span = raw ? hi - lo : 0;
    for (i = 0; i < W * H; i++) {
      var t = span > 1e-6 ? (raw[i] - lo) / span : 1;
      d[i * 4] = INK[0] + (PAPER[0] - INK[0]) * t;
      d[i * 4 + 1] = INK[1] + (PAPER[1] - INK[1]) * t;
      d[i * 4 + 2] = INK[2] + (PAPER[2] - INK[2]) * t;
      d[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
  }
  function fmt(v) { return (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2); }
  function showDigits(vec) {
    // 取画面正中间一行的 5 个数，让人看到“它看到的就是这些数”
    var row = Math.floor(H / 2) * W + Math.floor(W / 2) - 2, out = [];
    for (var i = 0; i < 5; i++) out.push(vec ? fmt(vec[row + i]) : '+0.00');
    digits.textContent = out.join(' ') + ' …';
  }

  /* ---------- 小智的表情 ---------- */
  var faceNow = '', sayNow = '', sayTimer = 0, sayPending = '';
  var FACE_LABEL = { blank: '小智：还什么都不会', unsure: '小智：拿不准', c0: '小智：举起了手', c1: '小智：手放着' };
  function setFace(f) {
    if (f === faceNow) return;
    faceNow = f;
    face.setAttribute('data-face', f);
    var label = FACE_LABEL[f];
    if (f === 'c0') label = '小智：认出了「' + names[0] + '」，举起了手';
    if (f === 'c1') label = '小智：认出了「' + names[1] + '」，手放着';
    face.setAttribute('aria-label', label);
  }
  // 说的话最多 0.4 秒换一次，避免读屏软件被刷屏、文字闪烁
  function setSay(t) {
    sayPending = t;
    if (sayTimer) return;
    if (t !== sayNow) { sayNow = t; say.textContent = t; }
    sayTimer = setTimeout(function () { sayTimer = 0; if (sayPending !== sayNow) setSay(sayPending); }, 400);
  }

  /* ---------- 类别（例子）区 ---------- */
  var rows = [];
  function q(s) { return '「' + s + '」'; }
  function buildClasses() {
    var box = $('classes');
    box.innerHTML = '';
    rows = names.map(function (nm, c) {
      var row = document.createElement('div');
      row.className = 'cls';
      row.innerHTML =
        '<div class="cls__head">' +
          '<label class="cls__name"><span class="sr">第' + (c ? '二' : '一') + '类的名字（可以改）</span>' +
          '<input type="text" maxlength="8" value="' + nm + '" spellcheck="false"></label>' +
          '<span class="cls__count num"></span>' +
          '<button type="button" class="link-btn cls__reset">清空</button>' +
        '</div>' +
        '<button type="button" class="btn btn--line cls__add"></button>' +
        '<div class="cls__thumbs" role="list"></div>';
      box.appendChild(row);
      var r = {
        el: row, input: row.querySelector('input'), add: row.querySelector('.cls__add'),
        count: row.querySelector('.cls__count'), thumbs: row.querySelector('.cls__thumbs'),
        reset: row.querySelector('.cls__reset')
      };
      r.input.addEventListener('input', function () {
        names[c] = r.input.value.trim() || DEFAULT_NAMES[c];
        labels(); refresh();
      });
      bindAdd(r.add, c);
      r.reset.addEventListener('click', function () { clearClass(c); });
      return r;
    });
    labels();
  }
  function labels() {
    rows.forEach(function (r, c) {
      var n = sets[mode].filter(function (e) { return e.label === c; }).length;
      r.count.textContent = n + ' 张';
      r.thumbs.setAttribute('aria-label', q(names[c]) + '的例子，共 ' + n + ' 张');
      r.reset.hidden = n === 0;
      if (holding === c) return;
      r.add.textContent = mode === 'camera' ? '按住，拍' + q(names[c]) : '这是' + q(names[c]);
      r.add.disabled = mode === 'camera' ? !stream : !current;
    });
    if (mode === 'draw') {
      var cnt = counts();
      var dflt = names[0] === DEFAULT_NAMES[0] && names[1] === DEFAULT_NAMES[1];
      padHint.textContent = !cnt[0] ? (dflt ? '画一个举着手的小人，火柴人就行' : '画一个' + q(names[0]))
        : !cnt[1] ? (dflt ? '再画一个手放下的小人' : '再画一个' + q(names[1]))
        : '再画一个，看它认不认得';
    }
  }
  function counts() {
    var n = [0, 0];
    sets[mode].forEach(function (e) { n[e.label]++; });
    return n;
  }

  function addExample(c) {
    if (!current) return;
    var set = sets[mode];
    serial[mode][c]++;
    var th = document.createElement('canvas');
    th.width = W; th.height = H;
    th.className = 'thumb';
    th.setAttribute('role', 'listitem');
    th.setAttribute('aria-label', q(names[c]) + '第 ' + serial[mode][c] + ' 张');
    paint(th, current.raw);
    var ex = { label: c, id: serial[mode][c], vec: current.vec, raw: current.raw, el: th };
    set.push(ex);
    rows[c].thumbs.appendChild(th);
    // 超过上限就去掉这一类最早的那张
    var mine = set.filter(function (e) { return e.label === c; });
    if (mine.length > CAP) {
      var old = mine[0];
      set.splice(set.indexOf(old), 1);
      old.el.remove();
    }
    if (!reduceMotion) { th.classList.add('is-new'); setTimeout(function () { th.classList.remove('is-new'); }, 260); }
  }
  function clearClass(c) {
    sets[mode] = sets[mode].filter(function (e) {
      if (e.label === c) { e.el.remove(); return false; }
      return true;
    });
    serial[mode][c] = 0;
    if (last[mode] && last[mode].label === c) last[mode] = null;
    labels(); refresh(); emit(true);
  }
  function renderThumbs() {
    rows.forEach(function (r) { r.thumbs.innerHTML = ''; });
    sets[mode].forEach(function (e) { rows[e.label].thumbs.appendChild(e.el); });
  }

  /* 摄像头：按住连拍。画画：点一下收下当前这幅画。 */
  function bindAdd(btn, c) {
    function start(e) {
      if (mode !== 'camera' || !stream || holding >= 0) return;
      if (e && e.pointerId != null) { try { btn.setPointerCapture(e.pointerId); } catch (_) {} }
      holding = c; lastShot = 0;
      btn.classList.add('is-holding');
      btn.textContent = '正在拍' + q(names[c]) + '，松开停';
    }
    function stop() {
      if (holding !== c) return;
      holding = -1;
      btn.classList.remove('is-holding');
      labels(); emit(true);
    }
    btn.addEventListener('pointerdown', function (e) { if (e.button === 0) { e.preventDefault(); start(e); } });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('lostpointercapture', stop);
    btn.addEventListener('contextmenu', function (e) { if (mode === 'camera') e.preventDefault(); });
    btn.addEventListener('keydown', function (e) {
      if ((e.key === ' ' || e.key === 'Enter') && mode === 'camera') { e.preventDefault(); if (!e.repeat) start(); }
    });
    btn.addEventListener('keyup', function (e) { if (e.key === ' ' || e.key === 'Enter') stop(); });
    btn.addEventListener('blur', stop);
    btn.addEventListener('click', function () {
      if (mode !== 'draw' || !current) return;
      addExample(c);
      clearPad();
      labels(); refresh(); emit(true);
    });
  }

  /* ---------- 判断：小智现在怎么想 ---------- */
  var nearEl = null, lastEmit = 0;
  function refresh() {
    var set = sets[mode], n = counts();
    var pred = current && n[0] && n[1] ? K.predict(set, current.vec, 2, KNN_K) : null;

    if (!set.length) {
      setFace('blank');
      setSay('我还没见过任何例子，没法认你。');
    } else if (!n[0] || !n[1]) {
      var has = n[0] ? 0 : 1;
      setFace('unsure');
      setSay('我只见过' + q(names[has]) + '。现在你给我看什么，我都只能说是' + q(names[has]) + '。也教教我' + q(names[1 - has]) + '吧。');
    } else if (!current) {
      setFace('unsure');
      setSay(mode === 'camera' ? '打开摄像头，我就能看你。' : '两种我都见过了。画一个给我看。');
    } else if (pred.topP >= SURE) {
      setFace('c' + pred.top);
      setSay(mode === 'camera' ? '你在' + q(names[pred.top]) + '。' : '这是' + q(names[pred.top]) + '。');
    } else {
      setFace('unsure');
      setSay('拿不准，有一点像' + q(names[pred.top]) + '。');
    }

    // 两类各自的把握
    var p = pred ? pred.probs : null;
    var key = names.join('\u0001');
    if (bars.getAttribute('data-key') !== key) {
      bars.setAttribute('data-key', key);
      bars.innerHTML = names.map(function (nm) {
        return '<div class="bar"><span class="bar__n">' + esc(nm) + '</span>' +
          '<span class="bar__track"><span class="bar__fill"></span></span><span class="bar__v num">–</span></div>';
      }).join('');
    }
    Array.prototype.forEach.call(bars.children, function (row, c) {
      var v = p ? Math.round(p[c] * 100) : 0;
      row.classList.toggle('is-top', !!p && pred.top === c);
      row.querySelector('.bar__fill').style.transform = 'scaleX(' + v / 100 + ')';
      row.querySelector('.bar__v').textContent = p ? v + '%' : '–';
    });

    // 为什么：它觉得你最像哪一张
    if (nearEl) { nearEl.classList.remove('is-near'); nearEl = null; }
    if (pred) {
      var ex = set[pred.nearest.index];
      nearEl = ex.el; nearEl.classList.add('is-near');
      paint(whyImg, ex.raw);
      whyTxt.innerHTML = (mode === 'camera' ? '它觉得你现在最像你给的' : '它觉得这一幅最像你给的') + q(esc(names[ex.label])) + '第 <span class="num">' + ex.id + '</span> 张。';
      why.hidden = false;
      if (pred.topP >= SURE) {
        var prev = last[mode];
        last[mode] = { label: ex.label, id: ex.id };
        if (!prev || prev.label !== ex.label || prev.id !== ex.id) emit(false);
      }
    } else {
      why.hidden = true;
    }
    lab.setAttribute('data-state', !set.length ? 'empty' : (!n[0] || !n[1]) ? 'half' : 'ready');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (ch) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]; }); }

  /* 把访客的真实数字告诉页面下面的“刚才发生了什么” */
  var emitTimer = 0;
  function emit(force) {
    var now = Date.now();
    if (!force && now - lastEmit < 500) {
      // 太频繁时不丢掉，等一会儿补发最后一次
      if (!emitTimer) emitTimer = setTimeout(function () { emitTimer = 0; emit(true); }, 500 - (now - lastEmit));
      return;
    }
    if (emitTimer) { clearTimeout(emitTimer); emitTimer = 0; }
    lastEmit = now;
    var n = counts();
    document.dispatchEvent(new CustomEvent('zhi:update', {
      detail: { mode: mode, names: names.slice(), counts: n, total: n[0] + n[1], numbers: W * H, k: KNN_K, last: last[mode] }
    }));
  }

  /* ---------- 画板 ---------- */
  var pctx = pad.getContext('2d', { willReadFrequently: true });
  var inked = false, drawing = false, lastPt = null, padRaf = 0;
  function clearPad() {
    pctx.fillStyle = '#fff';
    pctx.fillRect(0, 0, pad.width, pad.height);
    inked = false;
    padHint.hidden = false;
    current = null;
    paint(gridCv, null); showDigits(null);
  }
  function padPoint(e) {
    var r = pad.getBoundingClientRect();
    return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height };
  }
  function stroke(a, b) {
    pctx.strokeStyle = '#16161a';
    pctx.lineWidth = pad.width / 26;
    pctx.lineCap = 'round'; pctx.lineJoin = 'round';
    pctx.beginPath(); pctx.moveTo(a.x, a.y); pctx.lineTo(b.x, b.y); pctx.stroke();
  }
  pad.addEventListener('pointerdown', function (e) {
    if (mode !== 'draw') return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (_) {}
    drawing = true; lastPt = padPoint(e);
    stroke(lastPt, lastPt);
    inked = true; padHint.hidden = true;
    schedulePad();
  });
  pad.addEventListener('pointermove', function (e) {
    if (!drawing) return;
    var evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    if (!evs.length) evs = [e];
    evs.forEach(function (ev) { var p = padPoint(ev); stroke(lastPt, p); lastPt = p; });
    schedulePad();
  });
  // 每一笔结束时立刻算一次，不依赖下一帧（后台标签页里 requestAnimationFrame 会暂停）
  function endStroke() {
    if (!drawing) return;
    drawing = false;
    if (padRaf) { cancelAnimationFrame(padRaf); padRaf = 0; }
    readPad();
  }
  pad.addEventListener('pointerup', endStroke);
  pad.addEventListener('pointercancel', endStroke);
  $('pad-clear').addEventListener('click', function () { clearPad(); labels(); refresh(); });

  function schedulePad() {
    if (padRaf) return;
    padRaf = requestAnimationFrame(function () { padRaf = 0; readPad(); });
  }
  function readPad() {
    if (!inked) return;
    var w = pad.width, h = pad.height;
    var data = pctx.getImageData(0, 0, w, h).data, lum = new Float32Array(w * h);
    for (var i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = (data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114) / 255;
    var box = K.inkBox(lum, w, h, 0.5);
    if (!box) { current = null; return; }
    var raw = K.blur(K.resample(lum, w, h, K.fitBox(box, W / H, 0.12), W, H, 1), W, H);
    current = { raw: raw, vec: K.normalize(raw) };
    paint(gridCv, raw); showDigits(current.vec);
    labels(); refresh();
  }

  /* ---------- 摄像头 ---------- */
  var off = document.createElement('canvas');
  off.width = 128; off.height = 96;
  var octx = off.getContext('2d', { willReadFrequently: true });

  function openCam() {
    if (!camOK) return toDraw('用 HTTPS 打开可以改用摄像头。');
    cover.querySelector('button').disabled = true;
    cover.querySelector('button').textContent = '正在请求摄像头…';
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false
    }).then(function (s) {
      if (mode !== 'camera') { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s;
      video.srcObject = s;
      return video.play().then(function () {
        cover.hidden = true;
        note.textContent = '画面只在你的浏览器里处理，不上传。';
        labels(); loop();
      });
    }).catch(function (err) {
      var why = err && err.name === 'NotAllowedError' ? '你没有允许使用摄像头'
        : err && (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') ? '没有找到摄像头'
        : err && err.name === 'NotReadableError' ? '摄像头正被别的程序占用'
        : '摄像头没能打开';
      stopCam();
      toDraw(why + '。换成画画，玩法完全一样。');
    }).then(function () {
      var b = cover.querySelector('button');
      b.disabled = false; b.textContent = '打开摄像头';
    });
  }
  function stopCam() {
    cancelAnimationFrame(rafId); rafId = 0;
    if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
    stream = null; video.srcObject = null; holding = -1;
  }
  function loop() {
    rafId = requestAnimationFrame(loop);
    if (!stream || video.readyState < 2) return;
    var vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    // 取画面中间 4:3 的一块，左右镜像（和你在屏幕上看到的一致）
    var sw = vw, sh = vw * 3 / 4;
    if (sh > vh) { sh = vh; sw = vh * 4 / 3; }
    octx.setTransform(-1, 0, 0, 1, off.width, 0);
    octx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, off.width, off.height);
    var data = octx.getImageData(0, 0, off.width, off.height).data, lum = new Float32Array(off.width * off.height);
    for (var i = 0, j = 0; i < lum.length; i++, j += 4) lum[i] = data[j] * 0.299 + data[j + 1] * 0.587 + data[j + 2] * 0.114;
    var raw = K.resample(lum, off.width, off.height, { x: 0, y: 0, w: off.width, h: off.height }, W, H, 0);
    current = { raw: raw, vec: K.normalize(raw) };
    paint(gridCv, raw); showDigits(current.vec);
    var now = performance.now();
    if (holding >= 0 && now - lastShot >= SHOT_MS) {
      lastShot = now;
      addExample(holding);
      rows[holding].add.textContent = '正在拍' + q(names[holding]) + '，松开停';
      labels();
    }
    refresh();
  }

  /* ---------- 切换输入方式 ---------- */
  function setMode(m) {
    if (m === mode) return;
    if (mode === 'camera') stopCam();
    mode = m;
    lab.setAttribute('data-mode', m);
    btnCam.setAttribute('aria-pressed', String(m === 'camera'));
    btnDraw.setAttribute('aria-pressed', String(m === 'draw'));
    capIn.textContent = m === 'camera' ? '你' : '你画的';
    current = null;
    paint(gridCv, null); showDigits(null);
    if (m === 'draw') { clearPad(); note.textContent = camOK ? '' : '用 HTTPS 打开可以改用摄像头。'; }
    else { cover.hidden = false; note.textContent = '点「打开摄像头」之后，浏览器才会问你要不要允许。'; }
    renderThumbs(); labels(); refresh(); emit(true);
  }
  function toDraw(msg) {
    setMode('draw');
    note.textContent = msg;
  }
  btnDraw.addEventListener('click', function () { setMode('draw'); });
  btnCam.addEventListener('click', function () { if (camOK) setMode('camera'); });
  $('cam-open').addEventListener('click', openCam);

  /* ---------- 启动 ---------- */
  buildClasses();
  clearPad();
  if (camOK) {
    mode = 'draw';
    setMode('camera');
  } else {
    btnCam.disabled = true;
    btnCam.title = '用 HTTPS 打开才能用摄像头';
    note.textContent = '用 HTTPS 打开可以改用摄像头。';
    labels(); refresh(); emit(true);
  }
})();
