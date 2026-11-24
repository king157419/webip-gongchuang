/* 首屏的训练画布 + 下面各栏目的内容渲染。数据全部来自 ../shared/content.js */
(function () {
  "use strict";
  const C = window.CLUB || {};
  const T = window.TinyNet;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TODO = '<span class="todo">待补充</span>';
  const val = (v) => (v == null || v === "" || v === "待补充" ? TODO : esc(v));

  /* ============================== 一、训练画布 ============================== */
  // 两种颜色就是全站配色：0 = 蓝，1 = 橙
  const COL = [[35, 71, 197], [214, 78, 34]];
  const PAPER = [244, 241, 234];
  const INK = "#17181b";
  const G = 50;                 // 底色网格：50×50 个格子，51×51 个采样点
  const EPOCHS_PER_FRAME = 2;
  const STEP_BUTTON = 200;      // 减少动态效果时，点一次按钮训练多少轮

  const board = $("#board");
  const viz = $("#netviz");
  if (board && T) initLab();

  function initLab() {
    const ctx = board.getContext("2d");
    const vctx = viz.getContext("2d");
    const net = new T.Net([2, 8, 8, 1], { lr: 0.01, seed: 7 });
    $$(".js-params").forEach((el) => (el.textContent = net.paramCount()));

    const field = document.createElement("canvas");
    field.width = field.height = G + 1;
    const fctx = field.getContext("2d");
    const img = fctx.createImageData(G + 1, G + 1);
    const vals = new Float64Array((G + 1) * (G + 1));

    const mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
    let reduced = mq.matches;
    let points = T.makePreset("circle", 3);
    let pen = 0;
    let paused = false;
    let onScreen = true;
    let settled = 0;          // 连续多少帧全部分对且误差很小
    let idle = false;         // 学会了就歇着，等新的点
    let rafId = 0;
    let frame = 0;
    let W = 0, H = 0, dpr = 1;
    let cursor = null;        // 键盘十字的位置（世界坐标）
    let lastStatus = "";
    let pulse = null;         // 新放的点：{p, t0}

    /* ---------- 尺寸 ---------- */
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = board.getBoundingClientRect();
      W = board.width = Math.max(1, Math.round(r.width * dpr));
      H = board.height = Math.max(1, Math.round(r.height * dpr));
      const vr = viz.getBoundingClientRect();
      viz.width = Math.max(1, Math.round(vr.width * dpr));
      viz.height = Math.max(1, Math.round(vr.height * dpr));
      draw(); drawNet();
    }

    /* ---------- 坐标 ---------- */
    const toWorld = (px, py) => ({ x: (px / W) * 2 - 1, y: 1 - (py / H) * 2 });
    const toPx = (x, y) => [((x + 1) / 2) * W, ((1 - y) / 2) * H];

    /* ---------- 画底色和分界线 ---------- */
    function computeField() {
      const d = img.data;
      for (let j = 0; j <= G; j++) {
        const y = 1 - (2 * j) / G;
        for (let i = 0; i <= G; i++) {
          const x = -1 + (2 * i) / G;
          const p = net.forward(x, y);
          vals[j * (G + 1) + i] = p;
          const c = p >= 0.5 ? COL[1] : COL[0];
          const conf = Math.abs(p - 0.5) * 2;           // 0 = 拿不准，1 = 很确定
          const t = 0.08 + 0.34 * conf;
          const k = (j * (G + 1) + i) * 4;
          d[k] = PAPER[0] + (c[0] - PAPER[0]) * t;
          d[k + 1] = PAPER[1] + (c[1] - PAPER[1]) * t;
          d[k + 2] = PAPER[2] + (c[2] - PAPER[2]) * t;
          d[k + 3] = 255;
        }
      }
      fctx.putImageData(img, 0, 0);
    }

    function drawContour() {
      const cw = W / G, ch = H / G, N = G + 1;
      ctx.beginPath();
      for (let j = 0; j < G; j++) {
        for (let i = 0; i < G; i++) {
          const tl = vals[j * N + i] - 0.5, tr = vals[j * N + i + 1] - 0.5;
          const br = vals[(j + 1) * N + i + 1] - 0.5, bl = vals[(j + 1) * N + i] - 0.5;
          const x0 = i * cw, y0 = j * ch;
          const pts = [];
          const cut = (a, b) => a / (a - b);
          // 按 上、右、下、左 的顺序找穿过边的点
          if ((tl >= 0) !== (tr >= 0)) pts.push([x0 + cut(tl, tr) * cw, y0, 0]);
          if ((tr >= 0) !== (br >= 0)) pts.push([x0 + cw, y0 + cut(tr, br) * ch, 1]);
          if ((br >= 0) !== (bl >= 0)) pts.push([x0 + cw - cut(br, bl) * cw, y0 + ch, 2]);
          if ((bl >= 0) !== (tl >= 0)) pts.push([x0, y0 + ch - cut(bl, tl) * ch, 3]);
          if (pts.length === 2) {
            ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]);
          } else if (pts.length === 4) {
            const centerUp = tl + tr + br + bl >= 0;
            const pairs = (tl >= 0) === centerUp ? [[0, 1], [2, 3]] : [[3, 0], [1, 2]];
            for (const [a, b] of pairs) { ctx.moveTo(pts[a][0], pts[a][1]); ctx.lineTo(pts[b][0], pts[b][1]); }
          }
        }
      }
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 * dpr;
      ctx.lineJoin = ctx.lineCap = "round";
      ctx.stroke();
    }

    function drawPoints(now) {
      const r = (W < 500 * dpr ? 6.5 : 7) * dpr;
      for (const p of points) {
        const [px, py] = toPx(p.x, p.y);
        let rr = r;
        if (pulse && pulse.p === p) {
          const k = Math.min(1, (now - pulse.t0) / 260);
          rr = r * (1.8 - 0.8 * k);
          if (k >= 1) pulse = null;
        }
        const wrong = (net.forward(p.x, p.y) >= 0.5 ? 1 : 0) !== p.c;
        if (wrong) {
          ctx.beginPath(); ctx.arc(px, py, rr + 4.5 * dpr, 0, Math.PI * 2);
          ctx.strokeStyle = INK; ctx.lineWidth = 1.6 * dpr; ctx.stroke();
        }
        ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2);
        ctx.fillStyle = "rgb(" + COL[p.c].join(",") + ")"; ctx.fill();
        ctx.strokeStyle = "rgb(" + PAPER.join(",") + ")"; ctx.lineWidth = 2 * dpr; ctx.stroke();
      }
    }

    function drawCursor() {
      if (!cursor || document.activeElement !== board) return;
      const [px, py] = toPx(cursor.x, cursor.y);
      const s = 12 * dpr;
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(px - s, py); ctx.lineTo(px - 4 * dpr, py);
      ctx.moveTo(px + 4 * dpr, py); ctx.lineTo(px + s, py);
      ctx.moveTo(px, py - s); ctx.lineTo(px, py - 4 * dpr);
      ctx.moveTo(px, py + 4 * dpr); ctx.lineTo(px, py + s);
      ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = "rgb(" + COL[pen].join(",") + ")"; ctx.fill();
    }

    function draw(now) {
      if (!W) return;
      now = now || performance.now();
      computeField();
      ctx.imageSmoothingEnabled = true;
      const cw = W / G, ch = H / G;
      // 采样点落在格子的角上，所以整张图往外扩半格，让像素中心对齐采样位置
      ctx.drawImage(field, -cw / 2, -ch / 2, W + cw, H + ch);
      drawContour();
      drawPoints(now);
      drawCursor();
    }

    /* ---------- 网络结构图（图二） ---------- */
    function drawNet() {
      const w = viz.width, h = viz.height;
      if (w < 2) return;
      vctx.clearRect(0, 0, w, h);
      const sizes = net.sizes;
      const padX = 70 * dpr, padY = 14 * dpr;
      const xs = sizes.map((_, l) => padX + ((w - padX * 2) * l) / (sizes.length - 1));
      const ys = sizes.map((n) => Array.from({ length: n }, (_, i) => (n === 1 ? h / 2 : padY + ((h - padY * 2) * i) / (n - 1))));
      for (let l = 0; l < net.L; l++) {
        const n = sizes[l], m = sizes[l + 1], Wl = net.W[l];
        for (let j = 0; j < m; j++) for (let i = 0; i < n; i++) {
          const v = Wl[j * n + i];
          vctx.strokeStyle = "rgba(" + COL[v > 0 ? 1 : 0].join(",") + "," + Math.min(0.9, 0.25 + Math.abs(v) * 0.35) + ")";
          vctx.lineWidth = Math.min(4.5, 0.4 + Math.abs(v) * 1.1) * dpr;
          vctx.beginPath(); vctx.moveTo(xs[l], ys[l][i]); vctx.lineTo(xs[l + 1], ys[l + 1][j]); vctx.stroke();
        }
      }
      const r = 4.5 * dpr;
      for (let l = 0; l < sizes.length; l++) {
        for (let i = 0; i < sizes[l]; i++) {
          vctx.beginPath(); vctx.arc(xs[l], ys[l][i], r, 0, Math.PI * 2);
          if (l === 0) { vctx.fillStyle = "rgb(" + PAPER.join(",") + ")"; }
          else {
            const b = net.b[l - 1][i];
            const t = Math.min(1, 0.25 + Math.abs(b) * 0.6);
            const c = COL[b > 0 ? 1 : 0];
            vctx.fillStyle = "rgb(" + c.map((v, k) => Math.round(PAPER[k] + (v - PAPER[k]) * t)).join(",") + ")";
          }
          vctx.fill();
          vctx.strokeStyle = INK; vctx.lineWidth = 1.2 * dpr; vctx.stroke();
        }
      }
      vctx.fillStyle = INK;
      vctx.font = 12 * dpr + 'px -apple-system, BlinkMacSystemFont, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
      vctx.textBaseline = "middle"; vctx.textAlign = "right";
      vctx.fillText("横坐标", xs[0] - 10 * dpr, ys[0][0]);
      vctx.fillText("纵坐标", xs[0] - 10 * dpr, ys[0][1]);
      vctx.textAlign = "left";
      vctx.fillText("像橙点", xs[3] + 10 * dpr, ys[3][0] - 8 * dpr);
      vctx.fillText("的程度", xs[3] + 10 * dpr, ys[3][0] + 8 * dpr);
    }

    /* ---------- 数字和状态 ---------- */
    const sEpoch = $("#s-epoch"), sAcc = $("#s-acc"), sLoss = $("#s-loss"), status = $("#status");
    const fmt = (n) => n.toLocaleString("zh-CN");
    function setStatus(s) { if (s !== lastStatus) { status.textContent = s; lastStatus = s; } }
    function updateStats() {
      const ok = net.accuracy(points), n = points.length;
      sEpoch.textContent = fmt(net.epochs);
      sAcc.textContent = ok + " / " + n;
      sLoss.textContent = n && isFinite(net.loss) ? net.loss.toFixed(3) : "—";
      const kinds = new Set(points.map((p) => p.c)).size;
      if (!n) setStatus("画布是空的。点一下，放第一个点。");
      else if (kinds < 2) setStatus("现在只有一种颜色。换另一种颜色再放几个点，它才有东西可学。");
      else if (reduced && !idle && ok < n) setStatus("已关闭自动训练。点“训练 " + STEP_BUTTON + " 轮”让它学一会儿。");
      else if (idle) setStatus("学会了，" + n + " 个点全部分对。它停下来等你再放一个点。");
      else if (paused) setStatus("已暂停。");
      else if (ok === n) setStatus("全部分对了，它还在把分界线调得更稳。");
      else setStatus("正在学习，还有 " + (n - ok) + " 个点没分对。");
      return ok;
    }

    /* ---------- 训练循环 ---------- */
    const shouldRun = () => !reduced && !paused && !idle && onScreen && !document.hidden && points.length > 0;
    function tick(now) {
      rafId = 0;
      if (!shouldRun()) { updateStats(); return; }
      for (let i = 0; i < EPOCHS_PER_FRAME; i++) net.trainEpoch(points);
      frame++;
      draw(now);
      if (frame % 4 === 0) drawNet();
      const ok = updateStats();
      if (ok === points.length && net.loss < 0.02) settled++; else settled = 0;
      if (settled > 120) { idle = true; drawNet(); updateStats(); return; }
      rafId = requestAnimationFrame(tick);
    }
    function wake() {
      idle = false; settled = 0;
      if (!rafId && shouldRun()) rafId = requestAnimationFrame(tick);
      else if (!shouldRun()) { draw(); drawNet(); updateStats(); }
    }

    /* ---------- 放点 ---------- */
    function addPoint(x, y, c) {
      x = Math.max(-0.98, Math.min(0.98, x)); y = Math.max(-0.98, Math.min(0.98, y));
      const p = { x, y, c };
      points.push(p);
      if (!reduced) pulse = { p, t0: performance.now() };
      if (points.length > 300) points.shift();
      wake(); draw(); updateStats();
    }

    // 只把“点按”当作放点；手指拖动交给浏览器去滚动页面（CSS 里是 touch-action: manipulation）
    let down = null;
    board.addEventListener("pointerdown", (e) => {
      if (e.button > 2) return;
      down = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId };
    });
    board.addEventListener("pointercancel", () => (down = null));
    board.addEventListener("pointerup", (e) => {
      if (!down || down.id !== e.pointerId) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const long = e.timeStamp - down.t > 600;
      down = null;
      if (moved > 10 || long) return;
      const r = board.getBoundingClientRect();
      const w = toWorld((e.clientX - r.left) * (W / r.width), (e.clientY - r.top) * (H / r.height));
      const other = e.shiftKey || e.button === 2;
      addPoint(w.x, w.y, other ? 1 - pen : pen);
    });
    board.addEventListener("contextmenu", (e) => e.preventDefault());

    // 键盘：方向键移动十字，回车或空格放点，1 / 2 切换颜色
    board.addEventListener("focus", () => { if (!cursor) cursor = { x: 0, y: 0 }; draw(); });
    board.addEventListener("blur", () => draw());
    board.addEventListener("keydown", (e) => {
      const step = e.shiftKey ? 0.2 : 0.05;
      const k = e.key;
      if (!cursor) cursor = { x: 0, y: 0 };
      if (k === "ArrowLeft") cursor.x -= step;
      else if (k === "ArrowRight") cursor.x += step;
      else if (k === "ArrowUp") cursor.y += step;
      else if (k === "ArrowDown") cursor.y -= step;
      else if (k === "Enter" || k === " ") { addPoint(cursor.x, cursor.y, pen); e.preventDefault(); return; }
      else if (k === "1" || k === "2") { setPen(+k - 1); }
      else return;
      e.preventDefault();
      cursor.x = Math.max(-0.95, Math.min(0.95, cursor.x));
      cursor.y = Math.max(-0.95, Math.min(0.95, cursor.y));
      draw();
    });

    /* ---------- 按钮 ---------- */
    function setPen(c) {
      pen = c;
      $$("[data-pen]").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.pen === c)));
      draw();
    }
    $$("[data-pen]").forEach((b) => b.addEventListener("click", () => setPen(+b.dataset.pen)));

    $$("[data-preset]").forEach((b) => b.addEventListener("click", () => {
      const name = b.dataset.preset;
      points = name === "clear" ? [] : T.makePreset(name, 3);
      if (name !== "clear") net.reset();   // 换题时从头学，才看得见线是怎么弯过去的
      pulse = null;
      wake(); draw(); drawNet(); updateStats();
    }));

    const runBtn = $("#run");
    function syncRun() {
      runBtn.textContent = reduced ? "训练 " + STEP_BUTTON + " 轮" : paused ? "继续训练" : "暂停";
      if (!reduced) runBtn.setAttribute("aria-pressed", String(paused)); else runBtn.removeAttribute("aria-pressed");
    }
    runBtn.addEventListener("click", () => {
      if (reduced) {
        if (points.length) for (let i = 0; i < STEP_BUTTON; i++) net.trainEpoch(points);
        idle = false;
        if (points.length && net.accuracy(points) === points.length && net.loss < 0.02) idle = true;
        draw(); drawNet(); updateStats();
        return;
      }
      paused = !paused; syncRun(); wake(); updateStats();
    });
    $("#reset").addEventListener("click", () => { net.reset(Math.floor(Math.random() * 1e6)); wake(); draw(); drawNet(); updateStats(); });
    $("#undo").addEventListener("click", () => { points.pop(); pulse = null; wake(); draw(); updateStats(); });

    // 存图：带一行说明，算是从这里带走的一点东西
    $("#save").addEventListener("click", () => {
      const S = 1080, out = document.createElement("canvas");
      out.width = S; out.height = S + 200;
      const o = out.getContext("2d");
      o.fillStyle = "rgb(" + PAPER.join(",") + ")"; o.fillRect(0, 0, out.width, out.height);
      o.drawImage(board, 60, 60, S - 120, S - 120);
      o.strokeStyle = INK; o.lineWidth = 2; o.strokeRect(60, 60, S - 120, S - 120);
      const font = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
      o.fillStyle = INK;
      o.font = "bold 40px " + font;
      o.fillText("一个 " + net.paramCount() + " 个数字的神经网络，学了 " + fmt(net.epochs) + " 轮", 60, S + 30);
      o.font = "30px " + font;
      o.fillText("分对了 " + net.accuracy(points) + " / " + points.length + " 个点。在上海大学人工智能社的网站上训练。", 60, S + 90);
      const done = (url) => {
        const a = document.createElement("a");
        a.href = url; a.download = "我训练的神经网络.png";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL && url.startsWith("blob:") && URL.revokeObjectURL(url), 2000);
      };
      if (out.toBlob) out.toBlob((b) => done(URL.createObjectURL(b)), "image/png");
      else done(out.toDataURL("image/png"));
    });

    /* ---------- 何时暂停 ---------- */
    document.addEventListener("visibilitychange", wakeOrSleep);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver((es) => { onScreen = es[0].isIntersecting; wakeOrSleep(); }).observe(board);
    }
    function wakeOrSleep() { if (shouldRun() && !rafId) rafId = requestAnimationFrame(tick); }
    const onMq = () => { reduced = mq.matches; syncRun(); wake(); updateStats(); };
    if (mq.addEventListener) mq.addEventListener("change", onMq); else if (mq.addListener) mq.addListener(onMq);

    let rt = 0;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 80); });

    syncRun();
    resize();
    updateStats();
    wake();
  }

  /* ============================== 二、内容栏目 ============================== */
  const M = C.meta || {};
  $$(".js-club").forEach((el) => (el.textContent = M.name || "上海大学人工智能社"));
  $$(".js-founded").forEach((el) => (el.textContent = M.founded || "待补充"));

  // 社团是什么
  if ($("#about-intro")) {
    $("#about-intro").textContent = M.intro || "待补充";
    const facts = [
      ["成立", M.founded ? M.founded + " 年" : null],
      ["类型", M.type],
      ["挂靠", M.host],
      ["面向", M.audience],
      ["在哪", M.location],
      ["成员人数", M.members]
    ];
    $("#about-facts").innerHTML = facts.map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + val(v) + "</dd></div>").join("");
    $("#about-depts").innerHTML = (M.departments || []).map((d) =>
      '<li><b>' + esc(d.name) + "</b><span>" + esc(d.desc) + "</span></li>").join("") || "<li>" + TODO + "</li>";
  }

  // 平时做什么：每种活动配上相关报道的篇数和最近一次
  const news = C.news || [];
  const programs = C.programs || [];
  const catName = (id) => (programs.find((p) => p.id === id) || {}).name || "活动";
  const dateCn = (d) => String(d).replace(/-/g, ".");
  if ($("#programs")) {
    $("#programs").innerHTML = programs.map((p, i) => {
      const rel = news.filter((n) => n.cat === p.id);
      const last = rel[0];
      return '<li class="prog">' +
        '<span class="prog__no" aria-hidden="true">' + (i + 1) + "</span>" +
        '<div class="prog__main"><h3>' + esc(p.name) + "</h3><p>" + esc(p.desc) + "</p></div>" +
        '<dl class="prog__meta"><div><dt>地点</dt><dd>' + val(p.where) + "</dd></div>" +
        "<div><dt>公开报道</dt><dd>" + rel.length + " 篇" + (last ? "，最近一次 " + last.date.slice(0, 4) + " 年 " + +last.date.slice(5, 7) + " 月" : "") + "</dd></div></dl>" +
        "</li>";
    }).join("");
  }

  // 动态
  const SHOW = 5;
  let showAll = false;
  function renderNews() {
    const list = showAll ? news : news.slice(0, SHOW);
    $("#news-list").innerHTML = list.map((n) =>
      '<li class="item"><p class="item__date"><time datetime="' + esc(n.date) + '">' + dateCn(n.date) + "</time><span>" + esc(catName(n.cat)) + "</span></p>" +
      '<div class="item__main"><h3><a href="' + esc(n.source) + '" target="_blank" rel="noopener">' + esc(n.title) + '<span class="sr">（在新窗口打开原文）</span></a></h3>' +
      "<p>" + esc(n.summary) + "</p></div></li>").join("");
    const more = $("#news-more");
    if (news.length > SHOW) {
      more.hidden = false;
      more.textContent = showAll ? "收起" : "再看 " + (news.length - SHOW) + " 条";
      more.setAttribute("aria-expanded", String(showAll));
    }
  }
  if ($("#news-list")) {
    if (news.length) {
      const first = news[news.length - 1].date.slice(0, 4), last = news[0].date.slice(0, 4);
      $("#news-note").textContent = "从 " + first + " 年到 " + last + " 年，学院官网报道过社团的活动 " + news.length + " 次。标题点开是原文。";
      renderNews();
      $("#news-more").addEventListener("click", () => { showAll = !showAll; renderNews(); });
    } else $("#news-list").innerHTML = "<li>" + TODO + "</li>";
  }

  // 人
  if ($("#people-list")) {
    const P = C.people || {};
    const photo = (p) => p.photo
      ? '<img src="../shared/img/' + esc(p.photo) + '" alt="' + esc(p.name) + '的照片" loading="lazy">'
      : '<span class="ph" aria-label="照片待补充"><b aria-hidden="true">' + esc((p.name || "？").slice(0, 1)) + "</b><small>照片待补充</small></span>";
    const lead = (P.leaders || []).map((p) =>
      '<article class="lead"><div class="lead__pic">' + photo(p) + "</div><div>" +
      '<p class="role">' + esc(p.role) + "</p><h3>" + esc(p.name) + "</h3><p>" + val(p.desc) + "</p>" +
      ((p.awards || []).length ? '<h4 class="sub sub--s">获奖</h4><ul class="awards">' + p.awards.map((a) => "<li>" + esc(a) + "</li>").join("") + "</ul>" : "") +
      "</div></article>").join("");
    const teach = (P.teachers || []).map((p) =>
      '<li class="teacher"><div class="teacher__pic">' + photo(p) + "</div><div><h3>" + esc(p.name) + '</h3><p class="role">' + esc(p.role) + "</p><p>" + val(p.desc) + "</p></div></li>").join("");
    $("#people-list").innerHTML = (lead || "<p>社长信息" + TODO + "</p>") +
      '<h3 class="sub">指导老师</h3><ul class="teachers">' + (teach || "<li>" + TODO + "</li>") + "</ul>" +
      '<p class="note">各部门部长和其他成员的介绍' + TODO + "。</p>";
  }

  // 承办和协办
  if ($("#honors-list")) {
    $("#honors-list").innerHTML = (C.honors || []).map((h) =>
      '<li><span class="honors__y">' + esc(h.year) + "</span><span>" + esc(h.text) + "</span>" +
      (h.source ? '<a href="' + esc(h.source) + '" target="_blank" rel="noopener">原文<span class="sr">（' + esc(h.text) + "，新窗口打开）</span></a>" : "") +
      "</li>").join("") || "<li>" + TODO + "</li>";
  }

  // 怎么加入
  const J = C.join || {};
  if ($("#join-steps")) {
    $("#join-steps").innerHTML = (J.steps || []).map((s, i) =>
      '<li><span class="join__no" aria-hidden="true">' + (i + 1) + "</span><div><h3>" + esc(s.t) + "</h3><p>" + esc(s.d) + "</p></div></li>").join("");

    const wechat = (M.contact && M.contact.wechat) || "";
    const account = (wechat.match(/^[^（(]+/) || [wechat])[0].trim();   // “上海大学通信学院（公众号）” → “上海大学通信学院”
    const now = $("#join-now");
    if (J.formUrl) {
      now.innerHTML = '<a class="btn btn--primary" href="' + esc(J.formUrl) + '" target="_blank" rel="noopener">填写报名表</a>' +
        '<p>报名表在新窗口打开。</p>';
    } else if (account) {
      now.innerHTML = '<p class="join__lead">现在就能做的一步：在微信里搜公众号<b>「' + esc(account) + "」</b>，招新和活动预告都发在那里。</p>" +
        '<button type="button" class="btn btn--primary" id="copy">复制公众号名称</button>' +
        '<p class="note">报名表链接' + TODO + "，有了之后这里会换成报名按钮。</p>";
      $("#copy").addEventListener("click", () => {
        const msg = $("#copied");
        const ok = () => (msg.textContent = "已复制“" + account + "”，去微信里搜索就行。");
        const fail = () => (msg.textContent = "没能自动复制，请手动在微信里搜索“" + account + "”。");
        if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(account).then(ok, fail);
        else {
          try {
            const t = document.createElement("textarea");
            t.value = account; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
            document.body.appendChild(t); t.select();
            const r = document.execCommand("copy"); t.remove(); r ? ok() : fail();
          } catch (e) { fail(); }
        }
      });
    } else now.innerHTML = "<p>报名方式" + TODO + "。</p>";

    const c = M.contact || {};
    $("#join-facts").innerHTML = [
      ["招新时间", J.season],
      ["报名表", J.formUrl ? "见上方按钮" : null],
      ["公众号", account || null],
      ["QQ 群", c.qqGroup],
      ["邮箱", c.email]
    ].map(([k, v]) => "<div><dt>" + k + "</dt><dd>" + val(v) + "</dd></div>").join("");

    const depts = M.departments || [];
    const pick = $("#pick"), desc = $("#pick-desc");
    pick.innerHTML = depts.map((d, i) => '<button type="button" class="seg__btn" data-i="' + i + '" aria-pressed="false">' + esc(d.name) + "</button>").join("");
    pick.addEventListener("click", (e) => {
      const b = e.target.closest("[data-i]"); if (!b) return;
      $$("#pick [data-i]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      const d = depts[+b.dataset.i];
      desc.textContent = d.name + "：" + d.desc + "。加入时按兴趣报名就行。";
    });

    $("#faq").innerHTML = (J.faq || []).map((f) =>
      "<details><summary>" + esc(f.q) + "</summary><p>" + esc(f.a) + "</p></details>").join("");
  }

  if ($("#foot-line")) $("#foot-line").textContent = [M.type, M.host ? "挂靠" + M.host : "", M.founded ? M.founded + " 年成立" : ""].filter(Boolean).join("，") + "。";
})();
