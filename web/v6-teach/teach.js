/* 首屏互动“教小智认画”：画板、例子、训练曲线、猜测、纠错、卡片。
 * 计算部分在 model.js（window.ZhiModel），这里只管页面。 */
(function () {
  "use strict";
  const M = window.ZhiModel;
  const root = document.getElementById("teach");
  if (!M || !root) return;
  const $ = (id) => document.getElementById(id);

  const PER = 3;                 // 每类先画几个
  const FIRST = 150, MORE = 80;  // 第一次训练 / 每次纠错后再训练的轮数
  const PER_FRAME = 2;           // 每帧训练几轮（让曲线看得见地往下走）
  const DEFAULT_NAMES = ["圆圈", "叉叉"];
  const MOOD = { wave: "0% 0%", think: "100% 0%", cheer: "0% 100%", sleepy: "100% 100%" };
  const SPRITE = "../shared/img/ip/zhi-expressions.webp";
  const FONT = '-apple-system, BlinkMacSystemFont, "PingFang SC", "Microsoft YaHei", "微软雅黑", "Hiragino Sans GB", sans-serif';
  const INK = "#141a3f", BLUE = "#0b61bc", LINE = "#dde5ef", MUTED = "#6a7392";
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pad = $("pad"), pctx = pad.getContext("2d");
  const curve = $("curve"), cctx = curve.getContext("2d");
  const btnDone = $("done"), btnClear = $("clear");

  let S;  // 全部状态
  function fresh() {
    S = {
      names: S ? S.names : DEFAULT_NAMES.slice(),
      samples: [[], []],   // 每类的原始笔迹（坐标是画板边长的比例，0~1）
      strokes: [],         // 画板上正在画的
      phase: "collect",    // collect → training → test
      learner: null,
      losses: [], marks: [],
      guess: null,         // { strokes, probs, truth }
      last: null,          // 最近一次猜测，做卡片用
      clearOnDraw: false
    };
  }

  /* ---------- 小智说话 ---------- */
  const zhi = $("zhi"), sayEl = $("say");
  function say(text, mood) { sayEl.textContent = text; zhi.style.backgroundPosition = MOOD[mood || "wave"]; }
  const name = (c) => S.names[c];
  const pct = (p) => (p >= 0.995 ? "超过 99% " : ` ${Math.round(p * 100)}% `);   // 前后带空格，直接嵌进句子
  const pctShort = (p) => (p >= 0.995 ? "&gt;99%" : p < 0.005 ? "&lt;1%" : Math.round(p * 100) + "%");

  /* ---------- 画板 ---------- */
  function fitCanvas(cv) {
    const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(r.width * d)), h = Math.max(1, Math.round(r.height * d));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  }
  function drawStrokes(ctx, strokes, x, y, size, width, color) {
    ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.lineWidth = width; ctx.strokeStyle = color; ctx.fillStyle = color;
    for (const s of strokes) {
      if (s.length === 1) { ctx.beginPath(); ctx.arc(x + s[0][0] * size, y + s[0][1] * size, width / 2, 0, Math.PI * 2); ctx.fill(); continue; }
      ctx.beginPath();
      s.forEach(([px, py], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + px * size, y + py * size));
      ctx.stroke();
    }
  }
  function redraw() {
    pctx.clearRect(0, 0, pad.width, pad.height);
    drawStrokes(pctx, S.strokes, 0, 0, pad.width, pad.width * 0.032, INK);
    $("hint").hidden = S.strokes.length > 0 && S.phase !== "training";
    $("hint").textContent = S.phase === "training" ? "小智在学" : "在这里画";
  }
  const pt = (e) => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.width]; };

  let pen = null, guessTimer = 0;
  pad.addEventListener("pointerdown", (e) => {
    if (S.phase === "training" || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    try { pad.setPointerCapture(e.pointerId); } catch (err) { /* 个别浏览器不支持也能画 */ }
    pen = e.pointerId;
    clearTimeout(guessTimer);
    if (S.clearOnDraw) { S.strokes = []; S.clearOnDraw = false; hideGuess(); }
    S.strokes.push([pt(e)]);
    redraw();
  });
  pad.addEventListener("pointermove", (e) => {
    if (e.pointerId !== pen) return;
    e.preventDefault();
    const s = S.strokes[S.strokes.length - 1];
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    for (const ev of evs.length ? evs : [e]) {
      const p = pt(ev), q = s[s.length - 1];
      if (Math.hypot(p[0] - q[0], p[1] - q[1]) > 0.004) s.push(p);
    }
    redraw();
  });
  const penUp = (e) => {
    if (e.pointerId !== pen) return;
    pen = null;
    syncButtons();
    if (S.phase === "test") guessTimer = setTimeout(guess, 450);
  };
  pad.addEventListener("pointerup", penUp);
  pad.addEventListener("pointercancel", penUp);
  pad.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

  /* ---------- 例子栏 ---------- */
  function thumb(strokes) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = M.G;
    const ctx = cv.getContext("2d"), img = ctx.createImageData(M.G, M.G);
    const v = M.rasterize(M.normalize(strokes));
    for (let i = 0; i < v.length; i++) {
      const a = v[i];  // 白 → 深蓝
      img.data[i * 4] = 255 - a * (255 - 11); img.data[i * 4 + 1] = 255 - a * (255 - 97); img.data[i * 4 + 2] = 255 - a * (255 - 188); img.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }
  function target() { return S.samples[0].length < PER ? 0 : S.samples[1].length < PER ? 1 : -1; }
  function renderTray() {
    const t = S.phase === "collect" ? target() : -1;
    S.samples.forEach((list, c) => {
      const ol = $("slots" + c);
      ol.textContent = "";
      const n = Math.max(PER, list.length);
      for (let i = 0; i < n; i++) {
        const li = document.createElement("li");
        if (list[i]) li.appendChild(thumb(list[i]));
        else if (c === t && i === list.length) li.className = "is-next";
        ol.appendChild(li);
      }
      $("name" + c).value = S.names[c];
    });
  }
  [0, 1].forEach((c) => {
    $("name" + c).addEventListener("input", (e) => {
      S.names[c] = e.target.value.trim() || DEFAULT_NAMES[c];
      if (S.phase === "collect") prompt();
      if (S.guess) showGuess(false);
      explain();
    });
  });

  /* ---------- 训练曲线 ---------- */
  function drawCurve() {
    fitCanvas(curve);
    const w = curve.width, h = curve.height, d = window.devicePixelRatio || 1;
    const L = S.losses, padL = 4 * d, padB = 4 * d, top = 8 * d;
    cctx.clearRect(0, 0, w, h);
    cctx.strokeStyle = LINE; cctx.lineWidth = d; cctx.setLineDash([]);
    cctx.beginPath(); cctx.moveTo(padL, h - padB); cctx.lineTo(w, h - padB); cctx.stroke();
    if (!L.length) {
      cctx.fillStyle = MUTED; cctx.font = `${13 * d}px ${FONT}`; cctx.textBaseline = "middle";
      cctx.fillText("画满 6 个例子后从这里开始", padL + 4 * d, h / 2);
      return;
    }
    const maxX = Math.max(L.length, FIRST) - 1 || 1, maxY = Math.max(...L) * 1.05;
    const X = (i) => padL + (w - padL - 2 * d) * i / maxX, Y = (v) => top + (h - padB - top) * (1 - v / maxY);
    cctx.strokeStyle = LINE; cctx.setLineDash([4 * d, 4 * d]);
    for (const m of S.marks) { cctx.beginPath(); cctx.moveTo(X(m), top); cctx.lineTo(X(m), h - padB); cctx.stroke(); }
    cctx.setLineDash([]);
    cctx.strokeStyle = BLUE; cctx.lineWidth = 2.5 * d; cctx.lineJoin = "round";
    cctx.beginPath();
    L.forEach((v, i) => (i ? cctx.lineTo : cctx.moveTo).call(cctx, X(i), Y(v)));
    cctx.stroke();
    $("stat").textContent = `第 ${L.length} 轮，损失 ${L[L.length - 1].toFixed(2)}`;
  }

  function train(epochs, done) {
    S.phase = "training";
    syncButtons(); redraw();
    S.learner.prepare();
    let left = epochs;
    const tick = () => {
      const n = reduce ? left : Math.min(PER_FRAME, left);
      for (let i = 0; i < n; i++) S.losses.push(S.learner.trainStep());
      left -= n;
      drawCurve();
      if (left > 0) requestAnimationFrame(tick);
      else { S.phase = "test"; syncButtons(); redraw(); explain(); done(); }
    };
    requestAnimationFrame(tick);
  }

  /* ---------- 猜 ---------- */
  function guess() {
    if (S.phase !== "test" || !S.strokes.length) return;
    const probs = S.learner.predict(S.strokes);
    if (!probs) return;
    S.guess = { strokes: S.strokes.map((s) => s.slice()), probs, truth: -1 };
    S.last = S.guess;
    showGuess(true);
  }
  function showGuess(speak) {
    const g = S.guess, k = g.probs[1] > g.probs[0] ? 1 : 0, p = g.probs[k];
    $("bars").innerHTML = g.probs.map((q, c) => `
      <div class="pbar${c === k ? " is-top" : ""}">
        <span class="pbar__n"></span>
        <span class="pbar__t"><i style="width:${(q * 100).toFixed(1)}%"></i></span>
        <span class="pbar__p">${pctShort(q)}</span>
      </div>`).join("");
    $("bars").querySelectorAll(".pbar__n").forEach((el, c) => { el.textContent = name(c); });
    $("guess").hidden = false;
    $("verdict").hidden = g.truth >= 0;
    $("wrong").textContent = `你猜错了，这是${name(1 - k)}`;
    $("wrong").dataset.label = 1 - k;
    $("card-btn").hidden = false;
    if (speak) say(p >= 0.8 ? `我猜是${name(k)}，有${pct(p)}的把握。` : `我不太确定，可能是${name(k)}，把握只有${pct(p).trimEnd()}。`, "think");
  }
  function hideGuess() { $("guess").hidden = true; S.guess = null; }

  $("right").addEventListener("click", () => {
    if (!S.guess) return;
    say("猜对了。再画一个考考我？", "cheer");
    S.guess.truth = S.guess.probs[1] > S.guess.probs[0] ? 1 : 0;
    $("verdict").hidden = true;
    S.clearOnDraw = true;
  });
  $("wrong").addEventListener("click", () => {
    if (!S.guess || S.phase !== "test") return;
    const label = +$("wrong").dataset.label, g = S.guess;
    g.truth = label;
    $("verdict").hidden = true;
    S.samples[label].push(g.strokes);
    S.learner.add(g.strokes, label);
    S.marks.push(S.losses.length);
    renderTray();
    say(`原来这是${name(label)}。我拿它再学一遍。`, "think");
    train(MORE, () => {
      g.probs = S.learner.predict(g.strokes);
      showGuess(false);
      const p = g.probs[label];
      say(p > 0.5 ? `学好了。现在我觉得它是${name(label)}的把握有${pct(p).trimEnd()}。` : `还没学会，再多给我几个${name(label)}的例子吧。`, p > 0.5 ? "cheer" : "sleepy");
      S.clearOnDraw = true;
    });
  });

  /* ---------- 按钮 ---------- */
  function prompt() {
    const t = target(), n = S.samples[t].length;
    if (t === 1 && n === 0) say(`${name(0)}够了。现在画 3 个${name(1)}。`);
    else if (n === 0) say(`教教我。先在白板上画一个${name(t)}，画完点下面的“画好了”。`);
    else say(`第 ${n + 1} 个${name(t)}。大一点小一点、歪一点都行。`);
  }
  function syncButtons() {
    const p = S.phase;
    btnDone.hidden = p === "test";
    btnDone.disabled = p === "training";
    btnClear.disabled = p === "training";
    btnClear.textContent = p === "test" ? "擦掉，再画一个" : "擦掉";
    root.dataset.phase = p;
  }
  btnClear.addEventListener("click", () => {
    clearTimeout(guessTimer);
    S.strokes = []; S.clearOnDraw = false;
    if (S.phase === "test") { hideGuess(); say("好，再画一个。", "wave"); }
    redraw(); syncButtons();
  });
  btnDone.addEventListener("click", () => {
    if (S.phase !== "collect") return;
    if (!S.strokes.length) { say("白板上还是空的，先画一下。", "think"); return; }
    const t = target();
    S.samples[t].push(S.strokes);
    S.strokes = [];
    redraw();
    if (target() >= 0) { renderTray(); prompt(); return; }
    renderTray();
    S.learner = new M.Learner({ classes: 2, seed: (Math.random() * 1e9) | 0 });
    S.samples.forEach((list, c) => list.forEach((s) => S.learner.add(s, c)));
    say(`我在学。看${matchMedia("(max-width: 900px)").matches ? "下面" : "右边"}那条线往下走。`, "think");
    train(FIRST, () => say(`学完了。再画一个${name(0)}或${name(1)}，考考我。`, "cheer"));
  });
  $("reset").addEventListener("click", () => {
    if (S.phase === "training") return;
    clearTimeout(guessTimer);
    fresh(); hideGuess(); $("card-btn").hidden = true; $("cardout").hidden = true;
    renderTray(); redraw(); drawCurve(); syncButtons(); explain(); prompt();
    $("stat").textContent = "";
  });

  /* ---------- 大白话说明 ---------- */
  function explain() {
    const el = $("explain");
    if (!S.losses.length) {
      el.textContent = "画满 6 个例子，小智就开始学。所有计算都在你这台设备的浏览器里做，画的东西不会上传。";
      return;
    }
    const n = S.samples[0].length + S.samples[1].length, P = S.learner.size, L = S.losses;
    let t = `你给了 ${n} 个例子。小智把每张画缩成 16×16 的小格子，也就是 256 个数，再把每个例子稍微转一转、挪一挪，凑出 ${n * S.learner.copies} 道练习题。` +
      `它有 ${P} 个可以调的数字，一开始是随便填的。每一轮，它把练习题全猜一遍，算出错了多少，再把这些数字都往错得少的方向挪一点。` +
      `一共挪了 ${L.length} 轮，那条线从 ${L[0].toFixed(2)} 降到了 ${L[L.length - 1].toFixed(2)}。这就是训练。`;
    if (S.marks.length) t += `你纠正了它 ${S.marks.length} 次，每次它都带着新例子重新学一遍。`;
    el.textContent = t;
  }

  /* ---------- 卡片 ---------- */
  const sprite = new Image();
  sprite.src = SPRITE;
  function paintCard(withSprite) {
    const W = 1080, H = 1350, cv = document.createElement("canvas");
    cv.width = W; cv.height = H;
    const c = cv.getContext("2d"), g = S.last, k = g.probs[1] > g.probs[0] ? 1 : 0;
    const font = (w, px) => `${w} ${px}px ${FONT}`;
    c.fillStyle = "#fff"; c.fillRect(0, 0, W, H);
    c.fillStyle = BLUE; c.fillRect(0, 0, W, 330);
    c.fillStyle = "#fff"; c.textBaseline = "alphabetic";
    c.font = font(700, 76); c.fillText("我教会了小智认画", 72, 150);
    c.font = font(400, 40); c.fillStyle = "#d6e8fb"; c.fillText(`它现在认得${name(0)}和${name(1)}`, 72, 222);
    if (withSprite && sprite.complete && sprite.naturalWidth) {
      const q = sprite.naturalWidth / 2;
      c.save(); c.beginPath(); c.arc(W - 170, 170, 120, 0, Math.PI * 2); c.fillStyle = "#fff"; c.fill(); c.clip();
      c.drawImage(sprite, 0, q, q, q, W - 290, 50, 240, 240);  // 左下：欢呼
      c.restore();
    }
    // 例子
    c.fillStyle = INK; c.font = font(700, 36); c.fillText("我给它的例子", 72, 420);
    const tile = (strokes, x, y, s, lw) => {
      c.fillStyle = "#f4f8fc"; c.beginPath(); c.roundRect ? c.roundRect(x, y, s, s, 20) : c.rect(x, y, s, s); c.fill();
      const n = M.normalize(strokes);  // 居中放进格子
      drawStrokes(c, n.map((st) => st.map(([px, py]) => [px * 0.78 + 0.5, py * 0.78 + 0.5])), x, y, s, lw, INK);
    };
    [0, 1].forEach((cl) => {
      const y = 460 + cl * 190;
      c.fillStyle = MUTED; c.font = font(400, 30); c.fillText(name(cl), 72, y + 95);
      S.samples[cl].slice(0, 5).forEach((s, i) => tile(s, 250 + i * 170, y, 150, 7));
    });
    // 考题
    c.fillStyle = LINE; c.fillRect(72, 870, W - 144, 2);
    tile(g.strokes, 72, 920, 300, 11);
    c.fillStyle = MUTED; c.font = font(400, 34); c.fillText("我又画了一个，小智猜：", 420, 990);
    c.fillStyle = BLUE; c.font = font(700, 96); c.fillText(name(k), 420, 1110);
    c.fillStyle = INK; c.font = font(400, 34); c.fillText(`把握${pct(g.probs[k]).trimEnd()}`, 420, 1180);
    // 落款
    const d = new Date();
    c.fillStyle = INK; c.font = font(700, 38); c.fillText("上海大学人工智能社", 72, 1290);
    c.fillStyle = MUTED; c.font = font(400, 28);
    const when = `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
    c.fillText(when, W - 72 - c.measureText(when).width, 1290);
    return cv;
  }
  $("card-btn").addEventListener("click", () => {
    if (!S.last) return;
    let url;
    try { url = paintCard(true).toDataURL("image/png"); }
    catch (e) { url = paintCard(false).toDataURL("image/png"); }  // 本地直接打开文件时图片可能不让导出
    $("card-img").src = url;
    $("card-dl").href = url;
    $("cardout").hidden = false;
    $("cardout").scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
  });

  /* ---------- 开始 ---------- */
  fresh();
  zhi.style.backgroundImage = `url(${SPRITE})`;
  const onResize = () => { fitCanvas(pad); redraw(); drawCurve(); };
  if ("ResizeObserver" in window) new ResizeObserver(onResize).observe(pad);
  else window.addEventListener("resize", onResize);
  onResize();
  renderTray(); syncButtons(); explain(); prompt();
})();
