/* v24-fold-r2 · app.js —— 数据渲染 + 吸顶折纸舞台编排
 * 原生滚动驱动，不拦截滚轮/触摸/键盘：
 *   每一拍 = 折纸动作 → 摊平停住可读 → 文字"印"回纸面 → 下一折把它折走
 *   最后一拍折成纸飞机停在桌上待发射：往下滑得越猛（或按住飞机甩出去），飞得越快越远。
 *   减少动态或 WebGL 不可用时退回普通纸张分节页面。 */
(function () {
  'use strict';

  const C = window.CLUB;
  const root = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
  const clamp = (x, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  const pad2 = (n) => String(n).padStart(2, '0');

  setTimeout(() => root.classList.add('intro-done'), 2500);

  // 双击本地打开（file://）时：要印进纸面贴图的图片换成内嵌数据，否则浏览器不让读像素、整张纸就印不上字
  const IMG = window.V24_IMG || null;
  const imgSrc = (rel) => (IMG && IMG[rel]) || ('../shared/img/' + rel);
  if (IMG) $$('img.flyer-stamp').forEach((im) => { im.src = imgSrc('ip/zhi-flat.webp'); });

  if (!C) {
    root.classList.remove('st');
    return;
  }

  /* ================= 1. 渲染 window.CLUB 真实内容 ================= */
  const CAT = { weld: '焊接', course: '课程', visit: '参访', contest: '大赛', talk: '分享会' };
  const WX = String((C.meta.contact && C.meta.contact.wechat) || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '').trim();

  const heroHost = String(C.meta.host || '').replace('通信与信息工程学院', '通信学院');
  $('#heroMeta').textContent = `${C.meta.founded} 年成立 · 挂靠${heroHost}`;

  $('#progList').innerHTML = C.programs.map((p, k) => {
    const oneLine = String(p.desc || '').split(/[；。]/)[0];
    return `<li data-i="${k + 1}">
      <span class="prog__n">${pad2(k + 1)}</span>
      <b class="prog__t">${esc(p.name)}</b>
      <span class="prog__d">${esc(oneLine)}。</span>
    </li>`;
  }).join('');

  const HL_SPEC = [
    { d: '2024-12-09', pre: '近', n: 200, suf: '', label: '名同学参加 AI 论文分享会' },
    { d: '2024-09-24', pre: '', n: 100, suf: '余', label: '名学子赴 2024 华为全联接大会' },
    { d: '2026-05-11', pre: '', n: 40, suf: '余', label: '名同学入选昇腾大模型实践课' },
    { d: '2025-11-25', pre: '近', n: 100, suf: '', label: '名学子走进华为鸿蒙生态学堂' },
    { d: '2025-11-06', pre: '', n: 100, suf: '余', label: '人报名创新大赛焊接专项赛' }
  ];
  $('#hlList').innerHTML = HL_SPEC.map((h, k) => {
    const item = C.news.find((x) => x.date === h.d);
    if (!item) return '';
    return `<li data-i="${k + 1}">
      <a class="hl__a" href="${esc(item.source)}" target="_blank" rel="noopener">
        <span class="hl__n">${h.pre ? `<small>${esc(h.pre)}</small>` : ''}<b data-n="${h.n}">${h.n}</b>${h.suf ? `<small>${esc(h.suf)}</small>` : ''}</span>
        <span class="hl__t">${esc(h.label)}</span>
        <span class="hl__d">${esc(item.date.slice(0, 7).replace('-', '.'))} ↗</span>
      </a>
    </li>`;
  }).join('');

  const totalNews = C.news.length;
  $('#newsSub').textContent = `挑自学院官网的 ${totalNews} 篇公开报道。`;
  $('#openNews').innerHTML = `全部 ${totalNews} 篇报道 <span aria-hidden="true">→</span>`;
  $('#newsSheetT').textContent = `全部 ${totalNews} 篇报道（2022–2026）`;
  $('#allNews').innerHTML = C.news.map((n) => `<li>
    <a href="${esc(n.source)}" target="_blank" rel="noopener">
      <span class="drawer__d">${esc(n.date.replace(/-/g, '.'))} · ${esc(CAT[n.cat] || '动态')}</span>
      <span class="drawer__tt">${esc(n.title)}</span>
      <span class="drawer__s">${esc(n.summary)}</span>
    </a>
  </li>`).join('');

  const LD = C.people.leaders[0];
  const TS = C.people.teachers || [];
  const DEPS = C.meta.departments || [];
  const ldParts = String(LD.desc || '').split('。').filter(Boolean);
  const ldShort = (ldParts[0] ? ldParts[0].replace(/^通信与信息工程学院/, '') + '。' : '')
    + (ldParts[1] ? ldParts[1].split('，')[0] + '。' : '');

  // 社长照片：一直是彩色；不懒加载（它要被"印"进纸面贴图）
  $('#pplBox').innerHTML = `
    <div class="ppl-top" data-i="1">
      <div class="ppl-lead">
        ${LD.photo ? `<img class="ppl-photo" src="${esc(imgSrc(LD.photo))}" alt="社长${esc(LD.name)}" width="228" height="671" decoding="async">` : ''}
        <div>
          <p class="ppl-role">${esc(LD.role)}</p>
          <p class="ppl-name">${esc(LD.name)}</p>
          <p class="ppl-desc">${esc(ldShort)}</p>
        </div>
      </div>
      <ul class="ppl-teachers">
        ${TS.map((t) => `<li>
          <p class="ppl-name">${esc(t.name)}</p>
          <p class="ppl-role">${esc(t.role)}</p>
        </li>`).join('')}
      </ul>
    </div>
    <ul class="ppl-deps" data-i="2">
      ${DEPS.map((d) => `<li><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></li>`).join('')}
    </ul>
  `;

  $('#stepList').innerHTML = C.join.steps.map((s, k) => `<li data-i="${k + 1}">
    <span class="step__n">${pad2(k + 1)}</span>
    <b class="step__t">${esc(s.t)}</b>
    <span class="step__d">${esc(s.d)}</span>
  </li>`).join('');

  const locMain = String(C.meta.location || '').split('（')[0].trim();
  $('#whereLine').textContent = `常驻${locMain}`;
  $('#copyMsg').textContent = `公众号：${WX}`;
  $('#footMeta').textContent = `${C.meta.type} · 挂靠${C.meta.host} · ${C.meta.founded} 年成立 · ${DEPS.length} 个部门`;
  $('#faqList').innerHTML = (C.join.faq || []).map((f) => `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`).join('');

  $('#copyBtn').addEventListener('click', () => {
    const ta = $('#clip'), msg = $('#copyMsg');
    let ok = false;
    try {
      ta.value = WX;
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, WX.length);
      ok = document.execCommand('copy');
    } catch (e) { ok = false; }
    ta.blur();
    $('#copyBtn').focus({ preventScroll: true });
    msg.textContent = ok ? `已复制「${WX}」，打开微信搜一搜粘贴即可。` : `微信里搜索：${WX}`;
  });

  function bindDrawer(dlg, openBtn, closeBtn) {
    const open = () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
    const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); openBtn.focus({ preventScroll: true }); };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  }
  bindDrawer($('#newsSheet'), $('#openNews'), $('#closeNews'));
  bindDrawer($('#faqSheet'), $('#openFaq'), $('#closeFaq'));

  try {
    const gc = document.createElement('canvas');
    gc.width = gc.height = 128;
    const ctx = gc.getContext('2d'), img = ctx.createImageData(128, 128);
    let sd = 13579;
    for (let i = 0; i < img.data.length; i += 4) {
      sd = (sd * 1664525 + 1013904223) >>> 0;
      const v = (sd >>> 24);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    root.style.setProperty('--grain', `url(${gc.toDataURL()})`);
  } catch (e) { /* 忽略 */ }

  /* ================= 2. 吸顶折纸舞台 ================= */
  if (!root.classList.contains('st') || !window.FoldGL) {
    root.classList.remove('st');
    return;
  }

  const FG = window.FoldGL;
  const stageEl = $('#stage'), trackEl = $('#track'), glCanvas = $('#gl'), fxCanvas = $('#fx');
  let renderer, fx;
  try {
    renderer = new FG.FoldStage(glCanvas);
    renderer.rebuildTextures(WX);
    fx = fxCanvas.getContext('2d');
    if (!fx) throw new Error('No 2D');
  } catch (e) {
    root.classList.remove('st');
    return;
  }

  const BEAT_LEN = [1.15, 2.5, 2.2, 2.3, 2.8];
  const C2 = FG.C2, MEET = FG.MEET;
  // 前 4 拍摊平时，纸张整体包络与文字安全区（纸面坐标 W=1, H=1.42）
  const PAPER_ENV = [
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 1.42, sx0: -0.88, sx1: 0.88, sy0: -1.28, sy1: 1.28 },
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 1.42, sx0: -0.90, sx1: 0.90, sy0: -1.34, sy1: 0.36 },
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: C2, sx0: -0.90, sx1: 0.90, sy0: -1.33, sy1: C2 - 0.08 },
    // 第 3 折后上半是机头三角：文字从三角里半宽还剩 0.53 的地方开始排
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: C2, sx0: -0.90, sx1: 0.90, sy0: -1.36, sy1: C2 - 0.53 }
  ];

  const beats = $$('.beat', stageEl);
  const boxes = [$('#box0'), $('#box1'), $('#box2'), $('#box3'), $('#box4')];
  const boxItems = boxes.map((bx) => $$('[data-i]', bx).map((el) => [el, +el.dataset.i]));
  const numEls = $$('[data-n]', boxes[2]);
  const planeHit = $('#planePoke');
  const launchUi = $('#launchUi'), launchFill = $('#launchFill'), launchHint = $('#launchHint');
  const resultEl = $('#flightResult'), resultM = $('#frM'), resultT = $('#frT');
  const dockFoldN = $('#dockFoldN'), deskHint = $('#deskHint');
  const dockBtns = $$('#foldDock button');

  let VW = 0, VH = 0, dpr = 1, trackTop = 0, totalScroll = 0, mobile = false;
  let starts = [], basePose = [];
  let targetY = 0, curY = 0, raf = 0, lastT = 0, lastFrame = 0, fbTimer = 0, dbgAt = null;
  let ptrX = 0, ptrY = 0, sPtrX = 0, sPtrY = 0, introT0 = -1;
  const uiState = { fold: -1, beat: -1, launch: '' };

  // 纸飞机发射台
  const PC = [0, (C2 - 1.42) / 2, -0.12];         // 飞机几何中心（机体坐标：机头 y=C2，机尾 y=-1.42）
  const pad = { x: 0, y: 0, z: 0.39, s: 0.5, psi: 0.4, len: 300, M: null, q: null };
  const plane = {
    state: 'fold',                               // fold | ready | flying | landed | gone | back
    armMin: 0, charge: 0, chargeShown: 0,
    t0: 0, sim: null, power: 0, dir: [1, 0], from: [0, 0],
    trail: [], landAt: null, backT0: 0, backFrom: null,
    drag: null, dragOff: [0, 0]
  };
  let velS = 0;
  const scrollHist = [];
  const chargeHist = [];

  function foldEase(u) {
    u = clamp(u, 0, 1);
    const t = clamp(u / 0.94, 0, 1);
    return t < 0.5 ? 2.2 * t * t * (1.05 - 0.3 * t) : 1 - Math.pow(-2 * t + 2, 2.6) / 2;
  }
  const easeIO = (t) => { t = clamp(t, 0, 1); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

  /* ---------- 布局 ---------- */
  function computeLayout() {
    VW = stageEl.clientWidth || window.innerWidth;
    VH = stageEl.clientHeight || window.innerHeight;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, (VW < 768 || coarse) ? 1.5 : 1.75);

    starts = [];
    totalScroll = 0;
    for (let i = 0; i < BEAT_LEN.length; i++) {
      starts.push(totalScroll);
      totalScroll += BEAT_LEN[i] * VH;
    }
    trackEl.style.height = Math.round(totalScroll + VH) + 'px';
    trackTop = trackEl.getBoundingClientRect().top + window.scrollY;

    renderer.resize(VW, VH, dpr);
    fxCanvas.width = Math.round(VW * dpr);
    fxCanvas.height = Math.round(VH * dpr);

    mobile = VW < 860;
    const compact = VW < 640;
    const topSafe = compact ? 52 : (mobile ? 56 : 62);
    const botSafe = compact ? 48 : (mobile ? 54 : 56);
    const sidePad = compact ? Math.max(8, VW * 0.022) : (mobile ? Math.max(12, VW * 0.03) : Math.max(48, VW * 0.14));
    const availW = VW - sidePad * 2;
    const availH = VH - topSafe - botSafe;
    const ppu = renderer.pxPerUnit(0);

    basePose = [];
    for (let b = 0; b < 4; b++) {
      const env = PAPER_ENV[b];
      const pw = env.x1 - env.x0, ph = env.y1 - env.y0;
      const maxW = b === 0 ? Math.min(availW, mobile ? 480 : 580) : Math.min(availW, mobile ? 520 : 760);
      const maxH = availH * (b === 1 ? 1.02 : 0.96);
      const s = Math.min(maxW / pw, maxH / ph) / ppu;
      const worldCenter = renderer.unproject(VW * 0.5, topSafe + availH * 0.5, 0);
      const tx = worldCenter[0] - (env.x0 + env.x1) * 0.5 * s;
      const ty = worldCenter[1] - (env.y0 + env.y1) * 0.5 * s;
      basePose[b] = { rx: 0, ry: 0, rz: 0, tx, ty, tz: 0, s };

      const sx0 = compact ? Math.min(env.sx0, -0.93) : env.sx0;
      const sx1 = compact ? Math.max(env.sx1, 0.93) : env.sx1;
      const pTL = renderer.project([sx0 * s + tx, env.sy1 * s + ty, 0]);
      const pBR = renderer.project([sx1 * s + tx, env.sy0 * s + ty, 0]);
      const bw = Math.max(240, pBR[0] - pTL[0]);
      const bh = Math.max(160, pBR[1] - pTL[1]);
      const box = boxes[b];
      box.style.setProperty('--bx', ((pTL[0] + pBR[0]) * 0.5).toFixed(1) + 'px');
      box.style.setProperty('--by', ((pTL[1] + pBR[1]) * 0.5).toFixed(1) + 'px');
      box.style.setProperty('--bw', bw.toFixed(1) + 'px');
      box.style.setProperty('--bh', (b === 0 ? bh.toFixed(1) + 'px' : 'auto'));
      box.style.setProperty('--fit', '1');
      const realH = box.offsetHeight || bh;
      box.style.setProperty('--fit', Math.min(1, bh / Math.max(1, realH)).toFixed(3));
    }

    // 第 5 拍：加入卡片 + 发射台
    boxes[4].style.setProperty('--fit', '1');
    const maxJoinH = mobile ? availH * 0.60 : availH * 0.90;
    const jFit = Math.min(1, maxJoinH / Math.max(1, boxes[4].offsetHeight));
    boxes[4].style.setProperty('--fit', jFit.toFixed(3));
    const sr = stageEl.getBoundingClientRect();
    const cr = boxes[4].getBoundingClientRect();
    const cardL = cr.left - sr.left, cardR = cr.right - sr.left, cardT = cr.top - sr.top;

    if (!mobile) {
      const freeL = cardR + 40, freeR = VW - 40;
      pad.len = Math.min((freeR - freeL) * 0.40, VH * 0.36, 380);
      pad.x = freeL + (freeR - freeL) * 0.40;
      pad.y = VH * 0.62;
      pad.psi = 0.40;
    } else {
      const freeT = topSafe + 6, freeB = Math.max(freeT + 140, cardT - 8);
      pad.len = Math.min(VW * 0.46, (freeB - freeT) * 0.62);
      pad.x = VW * 0.40;
      pad.y = freeT + (freeB - freeT) * 0.42;
      pad.psi = 0.34;
    }
    pad.z = zOfH(SIM.H0);
    pad.s = pad.len / ((1.42 + C2) * renderer.pxPerUnit(pad.z));
    PXM = Math.max(110, pad.len * 0.78);
    // 停在发射台：从侧上方看，看得见机腹（龙骨）和两翼的 V 形，一眼能认出是纸飞机
    pad.theta = 0.16; pad.phi = -0.98;
    const qp = new URLSearchParams(location.search).get('pp');
    if (qp) { const a = qp.split(',').map(Number); pad.theta = a[0]; pad.phi = a[1]; if (a.length > 2) pad.psi = a[2]; }
    pad.M = FG.planeMat(pad.psi, pad.theta, pad.phi);
    pad.q = FG.matToQuat(pad.M);
    pad.cardRect = [cardL, cardT, cardR, cr.bottom - sr.top];

    // 抓飞机的热区 + 蓄力条位置
    const hitW = Math.max(120, pad.len * 0.95), hitH = Math.max(96, pad.len * 0.62);
    planeHit.style.setProperty('--hx', pad.x.toFixed(1) + 'px');
    planeHit.style.setProperty('--hy', pad.y.toFixed(1) + 'px');
    planeHit.style.setProperty('--hw', hitW.toFixed(0) + 'px');
    planeHit.style.setProperty('--hh', hitH.toFixed(0) + 'px');
    launchUi.style.setProperty('--lx', pad.x.toFixed(1) + 'px');
    launchUi.style.setProperty('--ly', (pad.y + pad.len * (mobile ? 0.40 : 0.50) + (mobile ? 4 : 18)).toFixed(1) + 'px');
  }

  function lerpPose(a, b, w) {
    return {
      rx: lerp(a.rx, b.rx, w), ry: lerp(a.ry, b.ry, w), rz: lerp(a.rz, b.rz, w),
      tx: lerp(a.tx, b.tx, w), ty: lerp(a.ty, b.ty, w), tz: lerp(a.tz, b.tz, w), s: lerp(a.s, b.s, w)
    };
  }

  function beatAt(scrollPx) {
    const p = clamp(scrollPx, 0, totalScroll - 0.01);
    let i = 0;
    while (i < 4 && p >= starts[i + 1]) i++;
    return { i, f: (p - starts[i]) / (BEAT_LEN[i] * VH) };
  }

  function paperToScreen(pose, x, y) {
    const p = [x * pose.s, y * pose.s, 0];
    FG.applyM3(FG.eulerMat(pose.rx, pose.ry, pose.rz), p);
    return renderer.project([p[0] + pose.tx, p[1] + pose.ty, p[2] + pose.tz]);
  }

  /* ---------- 把每一拍的文字"印"进纸面贴图 ---------- */
  const imgCache = new Map();
  function multiplyImage(img) {
    // 模拟 mix-blend-mode: multiply：白底变透明，颜色按纸色预乘
    if (imgCache.has(img.src)) return imgCache.get(img.src);
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    try {
      const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        const al = a[i + 3] / 255;
        const r = a[i] / 255, gg = a[i + 1] / 255, b = a[i + 2] / 255;
        const r1 = 1 - al + al * r, g1 = 1 - al + al * gg, b1 = 1 - al + al * b;
        const mn = Math.min(r1, g1, b1), A = 1 - mn;
        if (A < 0.004) { a[i + 3] = 0; continue; }
        a[i] = Math.round(255 * 0.97 * (r1 - mn) / A);
        a[i + 1] = Math.round(255 * 0.95 * (g1 - mn) / A);
        a[i + 2] = Math.round(255 * 0.91 * (b1 - mn) / A);
        a[i + 3] = Math.round(255 * A);
      }
      g.putImageData(d, 0, 0);
    } catch (e) { /* 跨域图片就原样画 */ }
    imgCache.set(img.src, c);
    return c;
  }

  function drawBorder(g, x, y, w, h, side, bw, style, color) {
    if (bw <= 0 || style === 'none' || style === 'hidden') return;
    g.fillStyle = color;
    g.strokeStyle = color;
    if (style === 'dashed' || style === 'dotted') {
      g.save();
      g.lineWidth = bw;
      g.setLineDash(style === 'dashed' ? [Math.max(2, bw * 3), Math.max(2, bw * 3)] : [bw, bw * 1.6]);
      g.beginPath();
      if (side === 't') { g.moveTo(x, y + bw / 2); g.lineTo(x + w, y + bw / 2); }
      if (side === 'b') { g.moveTo(x, y + h - bw / 2); g.lineTo(x + w, y + h - bw / 2); }
      if (side === 'l') { g.moveTo(x + bw / 2, y); g.lineTo(x + bw / 2, y + h); }
      if (side === 'r') { g.moveTo(x + w - bw / 2, y); g.lineTo(x + w - bw / 2, y + h); }
      g.stroke();
      g.restore();
      return;
    }
    if (side === 't') g.fillRect(x, y, w, bw);
    if (side === 'b') g.fillRect(x, y + h - bw, w, bw);
    if (side === 'l') g.fillRect(x, y, bw, h);
    if (side === 'r') g.fillRect(x + w - bw, y, bw, h);
  }

  function rasterizeInk(k) {
    const box = boxes[k], pose = basePose[k];
    if (!box || !pose) return;
    // 入场动画若还在播，直接放到最后一帧再量位置
    try { if (box.getAnimations) box.getAnimations({ subtree: true }).forEach((a) => a.finish()); } catch (e) { /* 忽略 */ }
    const items = boxItems[k];
    const saved = items.map(([el]) => [el.style.transform, el.style.opacity]);
    items.forEach(([el]) => { el.style.transform = 'none'; });
    const savedNums = k === 2 ? numEls.map((b) => b.textContent) : null;
    if (k === 2) numEls.forEach((b) => { b.textContent = b.dataset.n; });

    const sr = stageEl.getBoundingClientRect();
    const br = box.getBoundingClientRect();
    const scl = br.width / Math.max(1, box.offsetWidth);
    const P = 8;
    const L = br.left - sr.left - P, T = br.top - sr.top - P, Wd = br.width + 2 * P, Hd = br.height + 2 * P;
    let q = Math.max(1, dpr * 1.3);
    q = Math.min(q, 2048 / Wd, 2048 / Hd);
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(Wd * q); cv.height = Math.ceil(Hd * q);
    const g = cv.getContext('2d');
    g.setTransform(q, 0, 0, q, -L * q, -T * q);
    g.textBaseline = 'alphabetic';

    const els = [box].concat($$('*', box));
    // 背景与边线
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      if (el.tagName === 'IMG') continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 0.5 || r.height < 0.5) continue;
      const x = r.left - sr.left, y = r.top - sr.top;
      const bg = cs.backgroundColor;
      if (bg && bg !== 'transparent' && !/rgba\([^)]*,\s*0\)$/.test(bg)) {
        g.fillStyle = bg;
        const rad = parseFloat(cs.borderTopLeftRadius) * scl || 0;
        if (rad > 0.5 && g.roundRect) { g.beginPath(); g.roundRect(x, y, r.width, r.height, rad); g.fill(); }
        else g.fillRect(x, y, r.width, r.height);
      }
      [['t', 'Top'], ['b', 'Bottom'], ['l', 'Left'], ['r', 'Right']].forEach(([sd, nm]) => {
        drawBorder(g, x, y, r.width, r.height, sd, parseFloat(cs['border' + nm + 'Width']) * scl,
          cs['border' + nm + 'Style'], cs['border' + nm + 'Color']);
      });
    }
    // 图片
    $$('img', box).forEach((img) => {
      if (!img.complete || !img.naturalWidth) return;
      const cs = getComputedStyle(img);
      if (cs.display === 'none') return;
      const r = img.getBoundingClientRect();
      const x = r.left - sr.left, y = r.top - sr.top;
      const src = cs.mixBlendMode === 'multiply' ? multiplyImage(img) : img;
      const iw = img.naturalWidth, ih = img.naturalHeight;
      g.save();
      g.globalAlpha = parseFloat(cs.opacity) || 1;
      if (cs.objectFit === 'cover') {
        const sc = Math.max(r.width / iw, r.height / ih);
        const sw = r.width / sc, shh = r.height / sc;
        const op = cs.objectPosition.split(' ').map((v) => parseFloat(v) / 100);
        const sx = (iw - sw) * (isNaN(op[0]) ? 0.5 : op[0]);
        const sy = (ih - shh) * (isNaN(op[1]) ? 0.5 : op[1]);
        g.drawImage(src, sx, sy, sw, shh, x, y, r.width, r.height);
        const bw = parseFloat(cs.borderTopWidth) * scl;
        if (bw > 0) { g.strokeStyle = cs.borderTopColor; g.lineWidth = bw; g.strokeRect(x + bw / 2, y + bw / 2, r.width - bw, r.height - bw); }
      } else {
        g.drawImage(src, x, y, r.width, r.height);
      }
      g.restore();
    });
    // 文字：逐字取位置，按原字体原颜色画
    const range = document.createRange();
    const tw = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = tw.nextNode())) {
      const txt = node.nodeValue;
      if (!txt || !txt.trim()) continue;
      const pe = node.parentElement;
      const cs = getComputedStyle(pe);
      if (cs.display === 'none') continue;
      g.font = `${cs.fontStyle} ${cs.fontWeight} ${(parseFloat(cs.fontSize) * scl).toFixed(2)}px ${cs.fontFamily}`;
      g.fillStyle = cs.color;
      const mt = g.measureText('国');
      const fa = mt.fontBoundingBoxAscent || parseFloat(cs.fontSize) * scl * 0.88;
      const fd = mt.fontBoundingBoxDescent || parseFloat(cs.fontSize) * scl * 0.12;
      for (let i = 0; i < txt.length; i++) {
        const ch = txt[i];
        if (/\s/.test(ch)) continue;
        let len = 1;
        if (ch.charCodeAt(0) >= 0xD800 && ch.charCodeAt(0) <= 0xDBFF) len = 2;
        range.setStart(node, i);
        range.setEnd(node, i + len);
        const rs = range.getClientRects();
        if (!rs.length || rs[0].width <= 0) { i += len - 1; continue; }
        const r = rs[0];
        g.fillText(txt.substr(i, len), r.left - sr.left, r.top - sr.top + (r.height - (fa + fd)) / 2 + fa);
        i += len - 1;
      }
    }
    range.detach && range.detach();

    items.forEach(([el], n) => { el.style.transform = saved[n][0]; el.style.opacity = saved[n][1]; });
    if (savedNums) numEls.forEach((b, n) => { b.textContent = savedNums[n]; });

    const o = renderer.project([pose.tx, pose.ty, 0]);
    const ppuP = renderer.pxPerUnit(0) * pose.s;
    renderer.setInk(k, cv, [(L - o[0]) / ppuP, (o[1] - (T + Hd)) / ppuP, (L + Wd - o[0]) / ppuP, (o[1] - T) / ppuP]);
  }

  let inkTimer = 0, inkReady = false;
  function scheduleInk(delay) {
    clearTimeout(inkTimer);
    inkTimer = setTimeout(() => {
      if (!root.classList.contains('st')) return;
      try {
        for (let k = 0; k < 4; k++) rasterizeInk(k);
        inkReady = true;
        renderFrame(performance.now());
      } catch (e) { /* 印不上就保持空白纸，不影响阅读 */ }
    }, delay == null ? 160 : delay);
  }
  $$('img', stageEl).forEach((img) => { if (!img.complete) img.addEventListener('load', () => scheduleInk(200), { once: true }); });

  /* ---------- 2D 辅助特效 ---------- */
  function drawCreaseGlint(pA, pB, prog, alpha) {
    if (alpha <= 0.01) return;
    const x1 = lerp(pA[0], pB[0], clamp(prog - 0.28, 0, 1)), y1 = lerp(pA[1], pB[1], clamp(prog - 0.28, 0, 1));
    const x2 = lerp(pA[0], pB[0], clamp(prog + 0.18, 0, 1)), y2 = lerp(pA[1], pB[1], clamp(prog + 0.18, 0, 1));
    const g = fx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(255,252,244,0)');
    g.addColorStop(0.5, `rgba(255,252,244,${(0.85 * alpha).toFixed(3)})`);
    g.addColorStop(1, 'rgba(255,252,244,0)');
    fx.save();
    fx.strokeStyle = g;
    fx.lineWidth = 2.2;
    fx.beginPath();
    fx.moveTo(x1, y1);
    fx.lineTo(x2, y2);
    fx.stroke();
    fx.restore();
  }

  // 蓄力时的风线：逆着机头方向掠过飞机
  function drawWind(now, cx, cy, psi, k) {
    if (k < 0.02) return;
    const dx = Math.cos(psi), dy = -Math.sin(psi);
    const nx = -dy, ny = dx;
    const n = Math.round(5 + 13 * k);
    fx.save();
    fx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const h1 = ((i * 0.6180339) % 1), h2 = ((i * 0.7548776 + 0.31) % 1);
      const speed = 0.9 + 1.6 * k + h2 * 0.6;
      const ph = ((now / 1000) * speed + h1) % 1;
      const span = pad.len * (1.5 + 0.6 * k);
      const along = (0.6 - ph * 1.6) * span;
      const off = (h2 - 0.5) * pad.len * 0.9;
      const len = pad.len * (0.10 + 0.22 * k) * (0.6 + h1 * 0.6);
      const x = cx + dx * along + nx * off, y = cy + dy * along + ny * off;
      const a = Math.sin(Math.PI * ph) * (0.18 + 0.42 * k);
      fx.strokeStyle = `rgba(90,82,70,${a.toFixed(3)})`;
      fx.lineWidth = 1 + k * 0.6;
      fx.beginPath();
      fx.moveTo(x, y);
      fx.lineTo(x - dx * len, y - dy * len);
      fx.stroke();
    }
    fx.restore();
  }

  const MONO = "'Geist Mono', ui-monospace, Menlo, monospace";
  const SERIF = "'SHU Serif', 'Noto Serif SC', serif";

  // 航迹：存的是世界坐标，每帧按镜头换算到屏幕
  function drawTrail(alphaMul) {
    const tr = plane.trail;
    if (tr.length < 2) return;
    const pts = tr.map((p) => { const q = toScreen(p[0], p[1]); return [q[0], q[1], p[2]]; });
    fx.save();
    fx.lineCap = 'round';
    fx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const age = i / pts.length;
      fx.strokeStyle = `rgba(255,252,246,${(0.55 * age * alphaMul).toFixed(3)})`;
      fx.lineWidth = (1 + 5 * age * (0.5 + 0.5 * b[2])) * cam.z;
      fx.beginPath();
      fx.moveTo(a[0], a[1]);
      fx.lineTo(b[0], b[1]);
      fx.stroke();
    }
    fx.setLineDash([6, 7]);
    fx.strokeStyle = `rgba(201,63,24,${(0.55 * alphaMul).toFixed(3)})`;
    fx.lineWidth = 1.4;
    fx.beginPath();
    fx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) fx.lineTo(pts[i][0], pts[i][1]);
    fx.stroke();
    fx.restore();
  }

  function drawLandMark(p, alpha) {
    if (!p || alpha < 0.01) return;
    const q = toScreen(p[0], p[1]);
    fx.save();
    fx.strokeStyle = `rgba(201,63,24,${(0.8 * alpha).toFixed(3)})`;
    fx.lineWidth = 1.6;
    const r = 7;
    fx.beginPath();
    fx.moveTo(q[0] - r, q[1] - r); fx.lineTo(q[0] + r, q[1] + r);
    fx.moveTo(q[0] + r, q[1] - r); fx.lineTo(q[0] - r, q[1] + r);
    fx.stroke();
    fx.restore();
  }

  // 地面上的米数圈：以出手点为圆心，只画飞行方向两侧一小段弧；每 5 米一道实线 + 数字
  // 本机最远纪录：一道朱砂虚线弧 + 小旗，让人想飞过它
  function drawRange(F, ang, alpha, best) {
    if (alpha < 0.01 || !F) return;
    const c = toScreen(F[0], F[1]), R = PXM * cam.z;
    const ddx = Math.max(0, -c[0], c[0] - VW), ddy = Math.max(0, -c[1], c[1] - VH);
    const dMin = Math.hypot(ddx, ddy);
    let dMax = 0;
    [[0, 0], [VW, 0], [0, VH], [VW, VH]].forEach((q) => { dMax = Math.max(dMax, Math.hypot(q[0] - c[0], q[1] - c[1])); });
    const m0 = Math.max(1, Math.floor(dMin / R)), m1 = Math.min(80, Math.ceil(dMax / R));
    const span = mobile ? 0.46 : 0.34;
    fx.save();
    fx.textAlign = 'center';
    fx.textBaseline = 'middle';
    for (let m = m0; m <= m1; m++) {
      const r = m * R, major = m % 5 === 0;
      fx.setLineDash(major ? [] : [2, 6]);
      fx.lineWidth = major ? 1.4 : 1.1;
      fx.strokeStyle = `rgba(23,22,20,${((major ? 0.26 : 0.20) * alpha).toFixed(3)})`;
      fx.beginPath();
      fx.arc(c[0], c[1], r, ang - span, ang + span);
      fx.stroke();
      // 航线上的那一小段描粗，像尺子上的刻度；数字写在航线旁边，镜头跟着飞机时总能看见
      fx.setLineDash([]);
      fx.lineWidth = major ? 2.6 : 2;
      fx.strokeStyle = `rgba(23,22,20,${((major ? 0.5 : 0.32) * alpha).toFixed(3)})`;
      fx.beginPath();
      fx.arc(c[0], c[1], r, ang - 12 / r, ang + 12 / r);
      fx.stroke();
      const a2 = ang + (mobile ? 40 : 54) / r;
      fx.font = `${major ? 600 : 400} ${major ? 12.5 : 11}px ${MONO}`;
      fx.fillStyle = `rgba(23,22,20,${((major ? 0.62 : 0.40) * alpha).toFixed(3)})`;
      fx.fillText(major ? `${m} 米` : String(m), c[0] + Math.cos(a2) * r, c[1] + Math.sin(a2) * r);
    }
    fx.setLineDash([]);
    if (best > 0) {
      const r = best * R;
      if (r > dMin - 60 && r < dMax + 60) {
        fx.setLineDash([9, 6]);
        fx.lineWidth = 2;
        fx.strokeStyle = `rgba(201,63,24,${(0.80 * alpha).toFixed(3)})`;
        fx.beginPath();
        fx.arc(c[0], c[1], r, ang - span - 0.08, ang + span + 0.08);
        fx.stroke();
        fx.setLineDash([]);
        const a3 = ang - span * 0.62;
        const px = c[0] + Math.cos(a3) * r, py = c[1] + Math.sin(a3) * r;
        fx.strokeStyle = `rgba(201,63,24,${alpha.toFixed(3)})`;
        fx.lineWidth = 1.5;
        fx.beginPath(); fx.moveTo(px, py); fx.lineTo(px, py - 30); fx.stroke();
        fx.fillStyle = `rgba(201,63,24,${alpha.toFixed(3)})`;
        fx.beginPath(); fx.moveTo(px, py - 30); fx.lineTo(px + 14, py - 25); fx.lineTo(px, py - 20); fx.closePath(); fx.fill();
        const label = `本机最远 ${best.toFixed(1)} 米`;
        fx.font = `900 12.5px ${SERIF}`;
        fx.textAlign = 'left';
        const tw = fx.measureText(label).width;
        fx.fillStyle = `rgba(247,243,234,${(0.94 * alpha).toFixed(3)})`;
        fx.fillRect(px + 18, py - 37, tw + 14, 22);
        fx.strokeStyle = `rgba(201,63,24,${(0.5 * alpha).toFixed(3)})`;
        fx.lineWidth = 1;
        fx.strokeRect(px + 18.5, py - 36.5, tw + 13, 21);
        fx.fillStyle = `rgba(201,63,24,${alpha.toFixed(3)})`;
        fx.fillText(label, px + 25, py - 25.5);
      }
    }
    fx.restore();
  }

  // 桌面上的细碎纸屑 / 墨点：按世界格子固定撒好，镜头一动就往后掠过；快的时候拉出拖影
  function hash2(x, y) {
    let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  function drawSpecks(alpha) {
    if (alpha < 0.01) return;
    const Z = cam.z, G = mobile ? 110 : 150;
    const hw = VW / 2 / Z, hh = VH / 2 / Z;
    const gx0 = Math.floor((cam.x - hw) / G) - 1, gx1 = Math.floor((cam.x + hw) / G) + 1;
    const gy0 = Math.floor((cam.y - hh) / G) - 1, gy1 = Math.floor((cam.y + hh) / G) + 1;
    const bx = cam.vx * Z * 0.045, by = cam.vy * Z * 0.045;
    fx.save();
    fx.lineCap = 'round';
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gy = gy0; gy <= gy1; gy++) {
        const h = hash2(gx, gy);
        if (h > 0.6) continue;
        const q = toScreen((gx + hash2(gx + 17, gy - 5)) * G, (gy + hash2(gx - 9, gy + 31)) * G);
        const tone = h < 0.025 ? '201,63,24' : (h < 0.3 ? '96,84,66' : '140,126,104');
        fx.strokeStyle = `rgba(${tone},${((h < 0.025 ? 0.28 : 0.26) * alpha).toFixed(3)})`;
        fx.lineWidth = (h < 0.15 ? 2.2 : 1.4) * Math.max(0.7, Z);
        fx.beginPath();
        fx.moveTo(q[0], q[1]);
        fx.lineTo(q[0] + bx + 1.5, q[1] + by + 0.8);
        fx.stroke();
      }
    }
    fx.restore();
  }

  // 破纪录时的彩纸：先往上抛（离桌面越高画得越大），再飘落、慢慢淡掉
  const bits = [];
  let bitsT = 0;
  function burst(wx, wy, n) {
    const cols = ['#c93f18', '#171614', '#d9a441', '#3a6b8a', '#c93f18', '#efe8db'];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, sp = 120 + Math.random() * 520;
      bits.push({
        x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.8,
        h: 0, vh: 260 + Math.random() * 460, r: Math.random() * 6, vr: (Math.random() - 0.5) * 16,
        c: cols[k % cols.length], s: 5 + Math.random() * 6, age: 0, life: 1.6 + Math.random() * 1.0
      });
    }
  }
  function drawBits(now) {
    const dt = clamp((now - (bitsT || now)) / 1000, 0, 1 / 20);
    bitsT = now;
    if (!bits.length) return false;
    fx.save();
    for (let k = bits.length - 1; k >= 0; k--) {
      const b = bits[k];
      b.age += dt;
      if (b.age > b.life) { bits.splice(k, 1); continue; }
      const dr = Math.exp(-dt * 2.4);
      b.vx *= dr; b.vy *= dr;
      b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.vr * dt;
      b.vh -= 950 * dt;
      b.h = Math.max(0, b.h + b.vh * dt);
      if (b.h === 0) { b.vh = 0; b.vr *= Math.exp(-dt * 6); }
      const q = toScreen(b.x, b.y - b.h * 0.35);
      const sc = (1 + b.h / 600) * cam.z;
      fx.save();
      fx.translate(q[0], q[1]);
      fx.rotate(b.r);
      fx.globalAlpha = 1 - sm(b.life * 0.65, b.life, b.age);
      fx.fillStyle = b.c;
      const w = b.s * sc * Math.max(0.15, Math.abs(Math.cos(b.r * 1.7))), hg = b.s * sc * 0.62;
      fx.fillRect(-w / 2, -hg / 2, w, hg);
      fx.restore();
    }
    fx.restore();
    return bits.length > 0;
  }

  // 飞行中跟着飞机的距离牌；超过本机纪录时变朱砂色
  function drawDistTag(sx, sy, X, best) {
    const beat = best > 0 && X > best;
    const txt = `${X.toFixed(1)} 米`;
    fx.save();
    fx.font = `500 13px ${MONO}`;
    fx.textAlign = 'center';
    fx.textBaseline = 'middle';
    const y = sy + pad.len * 0.52 * cam.z + 18;
    const tw = fx.measureText(txt).width + 16;
    fx.fillStyle = beat ? 'rgba(201,63,24,0.96)' : 'rgba(23,22,20,0.84)';
    fx.fillRect(sx - tw / 2, y - 11, tw, 22);
    fx.fillStyle = '#fbf8f1';
    fx.fillText(txt, sx, y + 0.5);
    if (beat) {
      fx.font = `900 13px ${SERIF}`;
      fx.fillStyle = '#c93f18';
      fx.fillText('破本机纪录！', sx, y + 24);
    }
    fx.restore();
  }

  function updateBox(idx, showK, exitK) {
    const beatEl = beats[idx], box = boxes[idx], items = boxItems[idx];
    const active = showK > 0.002 && exitK < 0.998;
    beatEl.classList.toggle('on', active);
    if (!active) return;
    box.style.opacity = (clamp(showK, 0, 1) * (1 - clamp(exitK, 0, 1))).toFixed(3);
    for (let k = 0; k < items.length; k++) {
      const [el, order] = items[k];
      const v = idx === 0 ? 1 : sm(0.04 + order * 0.07, 0.50 + order * 0.07, showK);
      el.style.opacity = v.toFixed(3);
      el.style.transform = v >= 0.999 ? 'none' : `translate3d(0, ${((1 - v) * 10).toFixed(1)}px, 0)`;
    }
    if (idx === 2) {
      const nk = sm(0.15, 0.85, showK);
      for (let k = 0; k < numEls.length; k++) numEls[k].textContent = Math.round(+numEls[k].dataset.n * nk);
    }
  }

  /* ---------- 飞行：一个简化的纸飞机滑翔模型 ---------- */
  const SIM = { H0: 0.40, SPEED: 0.82 };
  function zOfH(h) { return 1.5 * (1 - Math.exp(-Math.max(0, h) / 1.3)) + 0.018; }

  function simulate(p) {
    const g = 9.81, kL = g / (4.6 * 4.6), kD = kL / 6.5;
    const v0 = 1.5 + 11 * Math.pow(p, 0.85), gam0 = -0.24 + 0.36 * p;
    let X = 0, Hh = SIM.H0, vx = v0 * Math.cos(gam0), vh = v0 * Math.sin(gam0), t = 0;
    const dt = 1 / 240, out = [];
    let step = 0;
    while (Hh > 0 && t < 9) {
      const v = Math.hypot(vx, vh) || 1e-6;
      const L = Math.min(kL * v * v, 1.7 * g), D = kD * v * v;
      const tx = vx / v, th = vh / v;
      vx += (-L * th - D * tx) * dt;
      vh += (L * tx - D * th - g) * dt;
      X += vx * dt; Hh += vh * dt; t += dt;
      if (step++ % 4 === 0) out.push([t, X, Math.max(0, Hh), Math.atan2(vh, vx)]);
    }
    // 触地后在桌面上滑一小段
    const vG = Math.max(0, vx), slide = Math.min(0.9, vG * 0.12), tSlide = 0.18 + slide * 0.35;
    const tl = t, Xl = X;
    for (let s = 1; s <= 24; s++) {
      const u = s / 24, e = 1 - (1 - u) * (1 - u);
      out.push([tl + tSlide * u, Xl + slide * e, 0, 0]);
    }
    return { pts: out, T: tl + tSlide, X: Xl + slide, tLand: tl };
  }

  function sampleSim(sim, t) {
    const a = sim.pts;
    if (t <= a[0][0]) return a[0];
    if (t >= a[a.length - 1][0]) return a[a.length - 1];
    let lo = 0, hi = a.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m][0] <= t) lo = m; else hi = m; }
    const u = (t - a[lo][0]) / Math.max(1e-6, a[hi][0] - a[lo][0]);
    return [t, lerp(a[lo][1], a[hi][1], u), lerp(a[lo][2], a[hi][2], u), lerp(a[lo][3], a[hi][3], u)];
  }

  /* ---------- 跟拍镜头 ----------
   * 世界坐标 = 镜头静止时的屏幕像素（发射台就在它原来的位置）。镜头中心 (cam.x, cam.y) 对准屏幕中心，cam.z 是推拉。
   * 飞机出手后镜头用临界阻尼弹簧追：有滞后、有惯性；飞得快就拉远一点、刚出手猛时带一点抖；
   * 落地时追上去停在落点，停一会儿再滑回发射台。桌面格子、加入卡片、米数圈都按同一个镜头换算，所以会往后掠过。 */
  const cam = { x: 0, y: 0, vx: 0, vy: 0, z: 1, vz: 0, t: 0, sx: 0, sy: 0, speed: 0 };
  let PXM = 200;                                  // 一米 = 多少世界像素
  function camRest() {
    cam.x = VW / 2; cam.y = VH / 2; cam.vx = 0; cam.vy = 0;
    cam.z = 1; cam.vz = 0; cam.sx = 0; cam.sy = 0; cam.speed = 0;
  }
  function toScreen(wx, wy) {
    return [VW / 2 + (wx - cam.x) * cam.z + cam.sx, VH / 2 + (wy - cam.y) * cam.z + cam.sy];
  }
  // 回发射台：镜头和飞机用同一条缓动一起滑回去（飞机在画面里平稳地从落点移回发射台，背景"嗖"地倒回去）
  function camSet(now, x, y, z) {
    const dt = clamp((now - (cam.t || now)) / 1000, 1 / 240, 1 / 20);
    cam.t = now;
    cam.vx = (x - cam.x) / dt; cam.vy = (y - cam.y) / dt; cam.vz = 0;
    cam.speed = Math.hypot(x - cam.x, y - cam.y) / dt * z;
    cam.x = x; cam.y = y; cam.z = z;
  }
  function camStep(now, tx, ty, tz, w) {
    const dt = clamp((now - (cam.t || now)) / 1000, 0, 1 / 20);
    cam.t = now;
    if (dt <= 0) return;
    const px = cam.x, py = cam.y;
    cam.vx += (w * w * (tx - cam.x) - 2 * w * cam.vx) * dt;
    cam.vy += (w * w * (ty - cam.y) - 2 * w * cam.vy) * dt;
    cam.x += cam.vx * dt;
    cam.y += cam.vy * dt;
    const wz = 2.4;
    cam.vz += (wz * wz * (tz - cam.z) - 2 * wz * cam.vz) * dt;
    cam.z = clamp(cam.z + cam.vz * dt, 0.55, 1.3);
    cam.speed = Math.hypot(cam.x - px, cam.y - py) / dt * cam.z;   // 背景在屏幕上掠过的速度（像素/秒）
  }

  const gridEl = $('.desk-bg__grid'), grainEl = $('.desk-bg__grain');
  let camDomOn = false;
  function applyCamDom() {
    const away = Math.abs(cam.x - VW / 2) + Math.abs(cam.y - VH / 2) + Math.abs(cam.z - 1) * 400 + Math.abs(cam.sx) + Math.abs(cam.sy) > 0.4;
    if (!away) {
      if (camDomOn) {
        camDomOn = false;
        gridEl.style.transform = ''; grainEl.style.transform = ''; gridEl.style.opacity = '';
        beats[4].style.transform = '';
        stageEl.classList.remove('cam-away');
      }
      return;
    }
    camDomOn = true;
    const Z = cam.z;
    const ox = (VW / 2 - cam.x) * Z + cam.sx, oy = (VH / 2 - cam.y) * Z + cam.sy;
    const md = (v, per) => ((v % per) + per) % per;
    const zs = Z.toFixed(4);
    gridEl.style.transform = `translate3d(${md(ox, 48 * Z).toFixed(1)}px, ${md(oy, 48 * Z).toFixed(1)}px, 0) scale(${zs})`;
    grainEl.style.transform = `translate3d(${md(ox, 160 * Z).toFixed(1)}px, ${md(oy, 160 * Z).toFixed(1)}px, 0) scale(${zs})`;
    // 细格子掠得太快会"倒着转"（频闪），按速度淡掉，速度感交给米数圈和纸屑
    gridEl.style.opacity = (1 - 0.85 * sm(700, 1600, cam.speed)).toFixed(3);
    beats[4].style.transform = `translate3d(${ox.toFixed(1)}px, ${oy.toFixed(1)}px, 0) scale(${zs})`;
    stageEl.classList.add('cam-away');
  }

  // 落地后镜头把落点停在哪：桌面版偏左（右边留给成绩卡），手机偏上（下面留给成绩条）
  function landAnchor() { return mobile ? [VW * 0.5, Math.max(130, VH * 0.30)] : [VW * 0.36, VH * 0.52]; }

  function flightPose(t) {
    const sa = sampleSim(plane.sim, t);
    const X = sa[1], Hh = sa[2], gam = sa[3];
    const [dx, dy] = plane.dir;
    const lat = plane.bend * X * X / 30, latD = 2 * plane.bend * X / 30;    // 轻微侧偏（米）
    const wx = plane.from[0] + (dx * X - dy * lat) * PXM;
    const wy = plane.from[1] + (dy * X + dx * lat) * PXM;
    const landed = t >= plane.sim.tLand;
    const settle = landed ? sm(plane.sim.tLand, plane.sim.T, t) : 0;
    const vxs = dx - dy * latD, vys = dy + dx * latD;
    const psi = Math.atan2(-vys, vxs);
    const sb = sampleSim(plane.sim, Math.min(plane.sim.T, t + 0.03));
    const v = (sb[1] - X) / 0.03;
    const theta = lerp(clamp(gam * 0.9 + 0.12, -0.7, 0.9), 0.02, settle);
    const phiF = lerp(pad.phi, -0.34, sm(0, 0.45, t)) + 0.14 * Math.sin(t * 2.4) * Math.exp(-t * 0.25);
    const phi = lerp(phiF, -0.18, settle);
    return { wx, wy, z: zOfH(Hh), h: Hh, psi, v, M: FG.planeMat(psi, theta, phi), X, landed };
  }

  function placePlane(sx, sy, z, s, M) {
    const w = renderer.unproject(sx, sy, z);
    const c = [PC[0] * s, PC[1] * s, PC[2] * s];
    FG.applyM3(M, c);
    return { M, s, tx: w[0] - c[0], ty: w[1] - c[1], tz: z - c[2], rx: 0, ry: 0, rz: 0 };
  }

  /* ---------- 本机成绩榜（只存在这台设备的浏览器里，存不了也照常能玩） ---------- */
  const LS_KEY = 'shu-ai-v24-fold-board-v1';
  const padBest = $('#padBest'), frBoard = $('#frBoard');
  const board = (function () {
    try {
      const d = JSON.parse(window.localStorage.getItem(LS_KEY) || 'null');
      if (d && Array.isArray(d.top)) {
        return { top: d.top.filter((r) => r && isFinite(r.m) && r.m > 0).map((r) => ({ m: +r.m, t: +r.t || 0 })).slice(0, 5), n: d.n | 0 };
      }
    } catch (e) { /* 读不到就从空榜开始 */ }
    return { top: [], n: 0 };
  })();
  let lastFlight = null;
  const bestM = () => (board.top.length ? board.top[0].m : 0);
  function recordFlight(X) {
    const prev = bestM();
    const rec = { m: Math.round(X * 10) / 10, t: Date.now() };
    lastFlight = rec;
    board.top.push(rec);
    board.top.sort((a, b) => b.m - a.m || a.t - b.t);
    board.top = board.top.slice(0, 5);
    board.n += 1;
    try { window.localStorage.setItem(LS_KEY, JSON.stringify(board)); } catch (e) { /* 存不了：这次照样算，刷新后不记得 */ }
    return { isRecord: rec.m > prev, prev, best: bestM() };
  }
  function renderBoard() {
    const b = bestM();
    if (padBest) {
      padBest.innerHTML = b > 0
        ? `本机最远 <b>${b.toFixed(1)}</b> 米` + (lastFlight ? `<span>刚才 ${lastFlight.m.toFixed(1)} 米</span>` : '')
        : '本机还没有纪录 · 飞一次试试';
    }
    if (frBoard) {
      frBoard.innerHTML = board.top.map((r, k) => `<li${r === lastFlight ? ' class="is-now"' : ''}><i>${k + 1}</i>${r.m.toFixed(1)}<small>米</small></li>`).join('');
    }
  }
  renderBoard();

  function launch(power, dirPsi, fromX, fromY) {
    plane.power = clamp(power, 0, 1);
    plane.sim = simulate(plane.power);
    const psi = dirPsi == null ? pad.psi : dirPsi;
    plane.dir = [Math.cos(psi), -Math.sin(psi)];
    plane.from = [fromX == null ? pad.x : fromX, fromY == null ? pad.y : fromY];
    plane.bend = (plane.power > 0.5 ? -1 : 1) * (0.03 + 0.05 * Math.random());
    plane.t0 = performance.now();
    plane.trail = [];
    plane.landAt = null;
    plane.touchAt = 0;
    plane.state = 'flying';
    plane.charge = 0;
    resultEl.classList.remove('on', 'is-record');
    boxes[4].classList.remove('is-delivered');
    stageEl.classList.add('is-flying');
    bits.length = 0;
    cam.t = performance.now();
    wake();
  }

  function verdict(X) {
    if (X < 1.5) return '软软地掉在了脚边。再猛一点往下滑？';
    if (X < 5) return '平平稳稳，滑了一小段。';
    if (X < 10) return '漂亮的滑翔！';
    return '这一下够远的！';
  }

  function finishFlight(fp) {
    plane.state = 'landed';
    stageEl.classList.remove('is-flying');
    const rec = recordFlight(plane.sim.X);
    const X = lastFlight.m;
    plane.landAt = [fp.wx, fp.wy];
    plane.returnAt = performance.now() + (rec.isRecord ? 3900 : 3000);
    resultM.innerHTML = `${X.toFixed(1)}<small>米</small>`;
    resultT.textContent = rec.isRecord
      ? (rec.prev > 0 ? `新纪录！比本机之前最远多飞了 ${(X - rec.prev).toFixed(1)} 米。` : '第一次飞，就是本机纪录。')
      : `${verdict(X)}本机最远 ${rec.best.toFixed(1)} 米。`;
    resultEl.classList.toggle('is-record', rec.isRecord);
    renderBoard();
    const [ax, ay] = landAnchor();
    let rx, ry;
    if (mobile) {
      rx = 12;
      ry = clamp(ay + pad.len * 0.5 + 30, 64, VH - 170);
    } else {
      rx = ax + pad.len * 0.62;
      if (rx + 260 > VW) rx = ax - pad.len * 0.62 - 250;
      ry = clamp(ay - 100, 70, VH - 300);
    }
    resultEl.style.setProperty('--rx', rx.toFixed(0) + 'px');
    resultEl.style.setProperty('--ry', ry.toFixed(0) + 'px');
    resultEl.classList.add('on');
    boxes[4].classList.add('is-delivered');
    if (rec.isRecord) burst(fp.wx, fp.wy, mobile ? 46 : 72);
    wake();
  }

  function rearm(goBack) {
    if (plane.state === 'flying' || plane.state === 'landed') {
      plane.backFrom = plane.lastPose || null;
      plane.backT0 = performance.now();
      plane.camFrom = [cam.x, cam.y, cam.z];
      plane.state = 'back';
    }
    resultEl.classList.remove('on');
    stageEl.classList.remove('is-flying');
    plane.trail = [];
    plane.landAt = null;
    plane.armMin = window.scrollY;
    plane.gesture = null;
    if (goBack) {
      const padY = trackTop + starts[4] + 0.42 * BEAT_LEN[4] * VH;
      if (window.scrollY > padY + VH * 0.04) {
        plane.quietUntil = performance.now() + 1600;   // 滚回去的这段平滑滚动不算"往下滑发射"
        window.scrollTo({ top: Math.round(padY), behavior: 'smooth' });
      }
    }
    wake();
  }

  /* ---------- 每帧 ---------- */
  function renderFrame(now) {
    const { i, f } = beatAt(curY);
    let busy = false;

    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, VW, VH);
    if (i < 4 && camDomOn) { camRest(); applyCamDom(); }

    const st = { t0: 0, t1: 0, t2: 0, t3: 0, t4a: 0, g4: 0, deskZ: -0.04, shadowAlpha: 0.18, creaseOn: [0, 0, 0, 0] };
    let pose = { ...basePose[0] };
    let inkA = { k: -1, amt: 0 }, inkB = { k: -1, amt: 0 };

    const actLift = (act) => (1 - sm(0.54, 1.0, act)) * lerp(0.30, 1.0, sm(0.0, 0.42, act));
    const SWING = [
      null,
      { rx: -0.26, ry: 0.12, rz: -0.03, tz: 0.20 },
      { rx: 0.28, ry: -0.12, rz: 0.03, tz: 0.22 },
      { rx: -0.24, ry: 0.13, rz: -0.03, tz: 0.20 }
    ];

    if (introT0 > 0) {
      const iu = clamp((now - introT0) / 850, 0, 1);
      if (iu < 1) {
        const w = Math.pow(1 - iu, 3);
        pose.tz += 0.24 * w; pose.rx -= 0.12 * w; pose.rz += 0.04 * w;
        busy = true;
      } else introT0 = -1;
    }

    // 每拍里：文字从 DOM 换成纸面墨迹（停住阅读结束时）→ 下一折带着它折走 → 落定后旧墨迹渗进纸里消失、新内容浮现
    let flightZ = false;

    if (i === 0) {
      const pre = sm(0.88, 1.0, f);
      const sw = SWING[1];
      pose = lerpPose(pose, basePose[1], 0.22 * pre);
      pose.rx += sw.rx * 0.30 * pre; pose.ry += sw.ry * 0.30 * pre; pose.rz += sw.rz * 0.30 * pre; pose.tz += sw.tz * 0.30 * pre;
      inkB = { k: 0, amt: sm(0.76, 0.86, f) };
    } else if (i <= 3) {
      const len = i === 1 ? 0.44 : 0.40;
      const act = clamp(f / len, 0, 1);
      const pre = sm(0.88, 1.0, f);
      if (i === 1) {
        st.t0 = clamp(act / 0.40, 0, 1);
        st.t1 = foldEase((act - 0.34) / 0.66);
      } else if (i === 2) {
        st.t1 = 1; st.t2 = foldEase(act);
      } else {
        st.t1 = 1; st.t2 = 1; st.t3 = foldEase(act);
      }
      st.creaseOn = [
        i === 1 ? sm(0.15, 0.45, st.t0) : 1,
        i === 1 ? sm(0.80, 1.0, st.t1) : 1,
        i === 2 ? sm(0.80, 1.0, st.t2) : (i > 2 ? 1 : 0),
        i === 3 ? sm(0.80, 1.0, st.t3) : 0
      ];
      // 取景：翻起来的那块纸还在半空时先别推近（第 2 折的尖角会高出纸面一大截），落定前再推到这一拍的构图
      pose = lerpPose(basePose[i - 1], basePose[i], lerp(i === 2 ? 0 : 0.22, 1.0, i === 2 ? sm(0.42, 0.96, act) : sm(0, 0.80, act)));
      pose.s *= 1 - (i === 2 ? 0.10 : 0.05) * Math.sin(Math.PI * clamp(act, 0, 1));
      const lf = actLift(act), sw = SWING[i];
      if (i < 3) {
        pose = lerpPose(pose, basePose[i + 1], (i === 1 ? 0 : 0.22) * pre);
        const nx = SWING[i + 1];
        pose.rx = sw.rx * lf + nx.rx * 0.30 * pre; pose.ry = sw.ry * lf + nx.ry * 0.30 * pre;
        pose.rz = sw.rz * lf + nx.rz * 0.30 * pre; pose.tz = sw.tz * lf + nx.tz * 0.30 * pre;
      } else {
        pose.rx = sw.rx * lf - 0.10 * pre; pose.ry = sw.ry * lf + 0.08 * pre;
        pose.rz = sw.rz * lf - 0.05 * pre; pose.tz = sw.tz * lf + 0.10 * pre;
      }
      // 上一拍的墨迹：跟着折过来，落定后渗进纸里
      const landF = len + 0.005;
      inkA = { k: i - 1, amt: 1 - sm(landF - 0.01, landF + 0.06, f) };
      inkB = { k: i, amt: sm(0.80, 0.86, f) };

      // 折痕压实时一道高光扫过
      if (act > 0.72 && act < 1.0) {
        const gA = Math.sin(Math.PI * (act - 0.72) / 0.28), pr = (act - 0.72) / 0.28;
        const segs = i === 1 ? [[-1, 0.42, 0, 1.42], [1, 0.42, 0, 1.42]]
          : i === 2 ? [[-1, C2, 1, C2]]
          : [[-1, MEET, 0, C2], [1, MEET, 0, C2]];
        segs.forEach((sg) => drawCreaseGlint(paperToScreen(pose, sg[0], sg[1]), paperToScreen(pose, sg[2], sg[3]), pr, gA));
      }
    } else {
      // ===== 第 5 拍：对折 → 折下机翼 → 翻过来停在发射台 =====
      st.t1 = 1; st.t2 = 1; st.t3 = 1;
      st.creaseOn = [1, 1, 1, 1];
      const act = clamp(f / 0.36, 0, 1);
      st.t4a = easeIO(sm(0.0, 0.42, act));
      // 机翼：先往外压到快贴住机身（压出折痕），再松开到和机身约 70°，两翼略微上扬成 V 形
      st.g4 = 2.75 * easeIO(sm(0.36, 0.70, act)) - 1.55 * easeIO(sm(0.70, 0.96, act));
      inkA = { k: 3, amt: 1 - sm(0.50, 0.80, act) };

      // 姿态：从摊平的纸（单位旋转）转到发射台姿态（机背朝上，机头指向右上）
      const p3 = basePose[3];
      const a0 = [PC[0] * p3.s + p3.tx, PC[1] * p3.s + p3.ty, PC[2] * p3.s + p3.tz];
      const w1 = renderer.unproject(pad.x, pad.y, pad.z);
      const wR = easeIO(sm(0.30, 0.95, act));
      // 对折时转到侧面看（看得见两半合拢、机翼往下折），最后再翻成机背朝上停到发射台
      const qI = [0, 0, 0, 1];
      const qSide = FG.matToQuat(FG.eulerMat(-0.30, 1.18, -0.10));
      const q = act < 0.5 ? FG.slerp(qI, qSide, easeIO(sm(0.02, 0.42, act))) : FG.slerp(qSide, pad.q, easeIO(sm(0.62, 0.96, act)));
      let M = FG.quatToMat(q);
      const sNow = lerp(p3.s, pad.s, easeIO(sm(0.30, 0.95, act)));
      const anc = [lerp(a0[0], w1[0], wR), lerp(a0[1], w1[1], wR), lerp(a0[2], w1[2], wR) + 0.35 * Math.sin(Math.PI * wR)];
      const c = [PC[0] * sNow, PC[1] * sNow, PC[2] * sNow];
      FG.applyM3(M, c);
      pose = { M, s: sNow, tx: anc[0] - c[0], ty: anc[1] - c[1], tz: anc[2] - c[2], rx: 0, ry: 0, rz: 0 };
      st.shadowAlpha = lerp(0.18, 0.15, wR);
      flightZ = act > 0.6;

      // ---- 发射台状态机 ----
      const ready = act >= 0.999;
      if (!ready) {
        if (plane.state !== 'fold') {
          plane.state = 'fold';
          resultEl.classList.remove('on');
          boxes[4].classList.remove('is-delivered');
          stageEl.classList.remove('is-flying');
          plane.trail = [];
          bits.length = 0;
        }
        camRest();
      } else if (plane.state === 'fold') {
        plane.state = 'ready';
        plane.armMin = window.scrollY;
        camRest();
      }

      let gF = null, gAng = -pad.psi, gA = 0, speckA = 0, windAt = null, tagAt = null;
      if (plane.state === 'ready' || plane.state === 'back') {
        let wx = pad.x, wy = pad.y, z = pad.z, Mr = pad.M, s = pad.s;
        const tt = now / 1000;
        const k = plane.chargeShown;
        // 待发射：轻轻悬停；蓄力时机头抬起、往后坐、微微发抖
        const back = 0.22 * pad.len * k;
        wx += -Math.cos(pad.psi) * back + plane.dragOff[0];
        wy += Math.sin(pad.psi) * back + plane.dragOff[1];
        z += 0.012 * Math.sin(tt * 1.7) + 0.05 * k;
        const shake = k > 0.3 ? 0.03 * (k - 0.3) * Math.sin(tt * 47) : 0;
        Mr = FG.planeMat(pad.psi + shake * 0.6, pad.theta + 0.42 * k + 0.02 * Math.sin(tt * 1.3), pad.phi + 0.03 * Math.sin(tt * 1.1) + shake);
        if (plane.state === 'back' && plane.backFrom) {
          // 飞机从落点飞回发射台，镜头同时往回滑
          const u = clamp((now - plane.backT0) / 1300, 0, 1), e = easeIO(u);
          const bf = plane.backFrom, cf = plane.camFrom || [VW / 2, VH / 2, 1];
          wx = lerp(bf.wx, wx, e); wy = lerp(bf.wy, wy, e);
          z = lerp(bf.z, z, e) + 0.45 * Math.sin(Math.PI * e);
          s = lerp(bf.s, s, e);
          Mr = FG.quatToMat(FG.slerp(FG.matToQuat(bf.M), FG.matToQuat(Mr), e));
          cam.sx = 0; cam.sy = 0;
          camSet(now, lerp(cf[0], VW / 2, e), lerp(cf[1], VH / 2, e), lerp(cf[2], 1, e));
          if (u >= 1) { plane.state = 'ready'; plane.armMin = window.scrollY; camRest(); }
        } else {
          if (plane.state === 'back') plane.state = 'ready';
          cam.sx = 0; cam.sy = 0;
          camStep(now, VW / 2, VH / 2, 1, 6);
        }
        const sc = toScreen(wx, wy);
        pose = placePlane(sc[0], sc[1], z, s * cam.z, Mr);
        plane.lastPose = { wx, wy, z, s, M: Mr };
        gF = [pad.x, pad.y]; gA = 0.9;
        speckA = sm(30, 260, Math.hypot(cam.x - VW / 2, cam.y - VH / 2));
        if (plane.state === 'ready') windAt = [sc[0], sc[1], pad.psi, k];
        busy = true;
      } else if (plane.state === 'flying' || plane.state === 'landed') {
        const flying = plane.state === 'flying';
        const tr = (now - plane.t0) / 1000;
        const tt = flying ? tr * SIM.SPEED : plane.sim.T;
        const fp = flightPose(Math.min(tt, plane.sim.T));
        const hd = [Math.cos(fp.psi), -Math.sin(fp.psi)];
        let tx, ty, tz, w;
        if (flying) {
          const spd = clamp((fp.v - 2) / 9, 0, 1);
          tz = 1 - 0.30 * spd - 0.10 * clamp(fp.h / 3.5, 0, 1);
          // 刚出手时镜头"咬"得紧一点（别让飞机一下冲出画面），之后放松，留出滞后和惯性
          w = lerp(mobile ? 8.5 : 6.5, 4.2, sm(0.1, 0.9, tr));
          // 飞机想停在画面里的位置：从发射台出发，0.6 秒内滑到画面中心略靠后（飞得越快越靠后，前方多留画面）
          const lead = Math.min(VW, VH) * (mobile ? 0.10 : 0.15) * spd;
          const follow = sm(0, 0.45, tr);
          const sxD = lerp(plane.from[0], VW / 2 - hd[0] * lead, follow);
          const syD = lerp(plane.from[1], VH / 2 - hd[1] * lead, follow);
          // 弹簧追匀速目标会落后 2v/w，这里把大部分补上，只留一点滞后当"惯性"
          const vpx = fp.v * SIM.SPEED * PXM, ff = (2 / w) * 0.88;
          tx = fp.wx + hd[0] * vpx * ff + (VW / 2 - sxD) / tz;
          ty = fp.wy + hd[1] * vpx * ff + (VH / 2 - syD) / tz;
          if (fp.landed && !plane.touchAt) plane.touchAt = now;
          windAt = [0, 0, fp.psi, 0.85 * spd];
          tagAt = fp.X;
        } else {
          const [ax, ay] = landAnchor();
          tz = 1.06;
          tx = plane.landAt[0] + (VW / 2 - ax) / tz;
          ty = plane.landAt[1] + (VH / 2 - ay) / tz;
          w = 3.4;
        }
        // 抖动：出手猛时前半秒带一点手持感；触地时轻轻一顿
        let amp = flying ? 7 * sm(0.55, 1, plane.power) * Math.exp(-tr / 0.55) : 0;
        if (plane.touchAt) amp += (2 + 4 * plane.power) * Math.exp(-(now - plane.touchAt) / 170);
        cam.sx = amp * (0.6 * Math.sin(now * 0.061) + 0.4 * Math.sin(now * 0.037 + 1.3));
        cam.sy = amp * (0.6 * Math.sin(now * 0.053 + 2.1) + 0.4 * Math.sin(now * 0.029));
        camStep(now, tx, ty, tz, w);
        const sc = toScreen(fp.wx, fp.wy);
        pose = placePlane(sc[0], sc[1], fp.z, pad.s * cam.z, fp.M);
        plane.lastPose = { wx: fp.wx, wy: fp.wy, z: fp.z, s: pad.s, M: fp.M };
        st.shadowAlpha = 0.16;
        if (windAt) { windAt[0] = sc[0]; windAt[1] = sc[1]; }
        if (tagAt != null) tagAt = [sc[0], sc[1], fp.X];
        if (flying) {
          const twp = [fp.wx - hd[0] * pad.len * 0.45, fp.wy - hd[1] * pad.len * 0.45, clamp(fp.z / 1.2, 0, 1)];
          const last = plane.trail[plane.trail.length - 1];
          if (!last || Math.hypot(twp[0] - last[0], twp[1] - last[1]) > 3) plane.trail.push(twp);
          if (plane.trail.length > 220) plane.trail.shift();
          if (tt >= plane.sim.T) finishFlight(fp);
        } else if (now >= plane.returnAt) {
          rearm(false);
        }
        gF = plane.from; gAng = Math.atan2(plane.dir[1], plane.dir[0]); gA = 1; speckA = 1;
        busy = true;
      }
      applyCamDom();
      // 2D 层从下往上：纸屑 → 米数圈 / 纪录线 → 航迹 → 风线 → 落点 → 彩纸 → 距离牌
      drawSpecks(speckA);
      drawRange(gF, gAng, gA, bestM());
      if (plane.state === 'flying' || plane.state === 'landed') {
        drawTrail(plane.state === 'flying' ? 1 : 0.6);
        drawLandMark(plane.landAt, 1);
      }
      if (windAt) drawWind(now, windAt[0], windAt[1], windAt[2], windAt[3]);
      if (drawBits(now)) busy = true;
      if (tagAt) drawDistTag(tagAt[0], tagAt[1], tagAt[2], bestM());
    }
    stageEl.classList.toggle('plane-up', flightZ);

    st.pose = pose;
    st.inkA = inkReady ? inkA : { k: -1, amt: 0 };
    st.inkB = inkReady ? inkB : { k: -1, amt: 0 };
    st.light = [-0.30 + sPtrX * 0.14, 0.38 - sPtrY * 0.14, 1.0];
    st.curl = i === 0 ? { cx: sPtrX >= 0 ? 0.7 : -0.7, cy: -0.7, amp: 0.045 * (0.4 + Math.hypot(sPtrX, sPtrY)) } : null;
    renderer.render(st);

    // DOM 文字：停稳才出现；离场前先换成纸面墨迹（位置完全重合），然后才开始动纸
    updateBox(0, i === 0 ? 1 : 0, i === 0 ? sm(0.78, 0.86, f) : 1);
    for (let b = 1; b <= 3; b++) {
      const len = b === 1 ? 0.44 : 0.40;
      const sh = i === b ? sm(len + 0.055, len + 0.15, f) : 0;
      const ex = i === b ? sm(0.80, 0.86, f) : (i > b ? 1 : 0);
      updateBox(b, sh, ex);
    }
    updateBox(4, i === 4 ? sm(0.26, 0.36, f) : 0, 0);

    // 发射台 UI
    const ls = i === 4 ? plane.state : '';
    if (uiState.launch !== ls) {
      uiState.launch = ls;
      stageEl.classList.toggle('pad-ready', ls === 'ready');
      planeHit.tabIndex = ls === 'ready' ? 0 : -1;
    }
    if (ls === 'ready') {
      launchFill.style.transform = `scaleX(${plane.chargeShown.toFixed(3)})`;
      launchUi.classList.toggle('is-hot', plane.chargeShown > 0.55);
    }

    const foldNum = i === 0 ? 0 : (f >= 0.18 ? i : i - 1);
    const hintKey = foldNum + ls;
    if (uiState.fold !== hintKey) {
      uiState.fold = hintKey;
      dockFoldN.textContent = foldNum;
      if (deskHint) {
        deskHint.textContent = ls === 'ready' ? '纸飞机折好了 · 往下滑得越猛飞得越远'
          : (ls === 'flying' ? '起飞！镜头跟上' : ls === 'landed' ? '落地！镜头一会儿回到发射台' : ls === 'back' ? '回发射台 · 再飞一次' 
            : (foldNum === 0 ? '往下滑 · 把传单折成纸飞机' : `已完成第 ${foldNum} 折 · 往下滑继续折`));
      }
    }
    if (uiState.beat !== i) {
      uiState.beat = i;
      dockBtns.forEach((btn, k) => { if (k === i) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current'); });
    }
    return busy;
  }

  /* ================= 3. 帧循环与输入 ================= */
  function tick(now) {
    raf = 0;
    lastFrame = now;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;

    curY += (targetY - curY) * (1 - Math.exp(-dt / 0.048));
    if (Math.abs(targetY - curY) < 0.5) curY = targetY;
    const kPtr = 1 - Math.exp(-dt / 0.09);
    sPtrX += (ptrX - sPtrX) * kPtr;
    sPtrY += (ptrY - sPtrY) * kPtr;
    if (Math.abs(ptrX - sPtrX) < 0.002) sPtrX = ptrX;
    if (Math.abs(ptrY - sPtrY) < 0.002) sPtrY = ptrY;

    // 力度：滚动速度的峰值保持 + 缓慢回落
    velS *= Math.exp(-dt / 0.30);
    const raw = clamp((velS / Math.max(1, VH) - 0.30) / 5.2, 0, 1);
    plane.charge = Math.pow(raw, 0.72);
    if (plane.drag) plane.charge = Math.max(plane.charge, plane.drag.k || 0);
    if (plane.forceCharge != null) plane.charge = plane.forceCharge;   // 仅调试用（?debug）
    plane.chargeShown += (plane.charge - plane.chargeShown) * (1 - Math.exp(-dt / (plane.charge > plane.chargeShown ? 0.05 : 0.22)));
    if (plane.chargeShown < 0.002) plane.chargeShown = 0;
    chargeHist.push([now, plane.charge]);
    while (chargeHist.length && now - chargeHist[0][0] > 320) chargeHist.shift();
    checkRelease(now);

    let busy = false;
    try {
      if (curY <= totalScroll + VH + 60) busy = renderFrame(now);
    } catch (e) {
      fallbackFlat();
      return;
    }
    const moving = curY !== targetY || sPtrX !== ptrX || sPtrY !== ptrY || busy || plane.chargeShown > 0;
    // 注意：这一帧里如果有人调过 wake()（比如落地、回发射台），下一帧已经排上了，别再排一次（否则之后每帧都画两遍）
    if (moving && !document.hidden) { if (!raf) raf = requestAnimationFrame(tick); }
    else if (!raf) lastT = 0;
  }

  function wake() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    clearTimeout(fbTimer);
    fbTimer = setTimeout(() => {
      if (performance.now() - lastFrame > 240) {
        curY = targetY;
        sPtrX = ptrX; sPtrY = ptrY;
        try { renderFrame(performance.now()); } catch (e) { fallbackFlat(); }
      }
    }, 280);
  }

  function resolveDebugY(spec) {
    if (spec == null) return null;
    if (typeof spec === 'number') return spec;
    const mBeat = /^b([0-4])$/.exec(spec);
    if (mBeat) { const b = +mBeat[1]; return starts[b] + (b === 0 ? 0 : (b === 4 ? 0.42 : 0.62) * BEAT_LEN[b] * VH); }
    const mFold = /^f([1-4])$/.exec(spec);
    if (mFold) { const b = +mFold[1]; return starts[b] + 0.20 * BEAT_LEN[b] * VH; }
    const n = parseFloat(spec);
    return isNaN(n) ? null : n;
  }

  // 什么时候松手：滑够一大段、或者停手 0.12 秒、或者速度掉到峰值的三分之一
  function checkRelease(now) {
    const G = plane.gesture;
    if (plane.state !== 'ready' || !G) return;
    const y = window.scrollY;
    if (now < (plane.quietUntil || 0)) { plane.armMin = y; plane.gesture = null; return; }
    let vNow = 0;
    if (scrollHist.length >= 2) {
      const a = scrollHist[0], b = scrollHist[scrollHist.length - 1];
      vNow = (now - b[0] > 120) ? 0 : (b[1] - a[1]) / Math.max(16, b[0] - a[0]) * 1000;
    }
    G.vPeak = Math.max(G.vPeak, vNow);
    G.peak = Math.max(G.peak, plane.charge);
    const dist = y - plane.armMin;
    const idle = now - (G.lastT || now) > 120;
    const eased = G.vPeak > 0 && vNow < G.vPeak * 0.33 && dist > VH * 0.06;
    if (dist > VH * 0.42 || (dist > VH * 0.05 && (idle || eased))) {
      plane.gesture = null;
      const from = plane.lastPose ? [plane.lastPose.wx, plane.lastPose.wy] : [pad.x, pad.y];
      launch(Math.max(G.peak, plane.chargeShown), null, from[0], from[1]);
    }
  }

  function onScroll() {
    const now = performance.now();
    const y = window.scrollY;
    scrollHist.push([now, y]);
    while (scrollHist.length > 2 && now - scrollHist[0][0] > 110) scrollHist.shift();
    if (scrollHist.length >= 2) {
      const a = scrollHist[0], dtv = Math.max(16, now - a[0]);
      const v = (y - a[1]) / dtv * 1000;
      if (v > velS) velS = v;
    }
    const dbgY = resolveDebugY(dbgAt);
    targetY = dbgY != null ? dbgY : (y - trackTop);

    // 待发射时往下滑 = 拉弓：滑的过程中飞机往后坐、力度条涨；这一下滑完（或松劲）就放手起飞
    if (plane.state === 'ready') {
      if (y < plane.armMin) { plane.armMin = y; plane.gesture = null; }
      if (y - plane.armMin > VH * 0.03 && !plane.gesture) plane.gesture = { peak: 0, vPeak: 0 };
      if (plane.gesture) plane.gesture.lastT = now;
    }
    wake();
  }

  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    ptrX = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -1, 1);
    ptrY = clamp(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1, -1, 1);
    wake();
  }, { passive: true });
  stageEl.addEventListener('pointerleave', () => { ptrX = 0; ptrY = 0; wake(); }, { passive: true });

  // 按住飞机甩出去：松手时的速度 = 力度，方向 = 甩的方向
  planeHit.addEventListener('pointerdown', (e) => {
    if (plane.state !== 'ready') return;
    e.preventDefault();
    try { planeHit.setPointerCapture(e.pointerId); } catch (er) { /* 忽略 */ }
    plane.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: e.timeStamp, hist: [[e.timeStamp, e.clientX, e.clientY]], moved: 0, k: 0 };
    stageEl.classList.add('is-grab');
    wake();
  });
  planeHit.addEventListener('pointermove', (e) => {
    const d = plane.drag;
    if (!d || d.id !== e.pointerId) return;
    const now = e.timeStamp;
    d.hist.push([now, e.clientX, e.clientY]);
    while (d.hist.length > 2 && now - d.hist[0][0] > 90) d.hist.shift();
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    d.moved = Math.max(d.moved, Math.hypot(dx, dy));
    const R = pad.len * 0.45, dd = Math.hypot(dx, dy) || 1, k = R * Math.tanh(dd / R) / dd;
    plane.dragOff = [dx * k, dy * k];
    const a = d.hist[0], v = Math.hypot(e.clientX - a[1], e.clientY - a[2]) / Math.max(16, now - a[0]) * 1000;
    d.k = Math.pow(clamp((v - 150) / 2200, 0, 1), 0.75);
    wake();
  });
  function endDrag(e, cancel) {
    const d = plane.drag;
    if (!d || d.id !== e.pointerId) return;
    plane.drag = null;
    stageEl.classList.remove('is-grab');
    const now = e.timeStamp;
    const a = d.hist[0];
    const vx = (e.clientX - a[1]) / Math.max(16, now - a[0]) * 1000;
    const vy = (e.clientY - a[2]) / Math.max(16, now - a[0]) * 1000;
    const sp = Math.hypot(vx, vy);
    const from = plane.lastPose ? [plane.lastPose.wx, plane.lastPose.wy] : [pad.x, pad.y];
    plane.dragOff = [0, 0];
    if (cancel) { wake(); return; }
    if (d.moved < 8 && now - d.t0 < 400) {
      launch(0.14, null, from[0], from[1]);       // 只是点一下：轻轻一抛
    } else if (sp < 250) {
      launch(0.06, Math.atan2(-vy, vx || 1), from[0], from[1]); // 拖着慢慢放手：几乎直接掉下
    } else {
      const p = Math.pow(clamp((sp - 150) / 2200, 0, 1), 0.75);
      launch(p, Math.atan2(-vy, vx), from[0], from[1]);
    }
  }
  planeHit.addEventListener('pointerup', (e) => endDrag(e, false));
  planeHit.addEventListener('pointercancel', (e) => endDrag(e, true));
  planeHit.addEventListener('click', (e) => {
    // 键盘回车 / 空格：来一次中等力度的标准投掷
    if (e.detail === 0 && plane.state === 'ready') launch(0.55);
  });
  $('#refly').addEventListener('click', () => rearm(true));

  function goBeat(b) {
    plane.quietUntil = performance.now() + 1600;   // 点按钮跳过去的平滑滚动不算甩
    const y = trackTop + starts[b] + (b === 0 ? 0 : (b === 4 ? 0.42 : 0.62) * BEAT_LEN[b] * VH);
    window.scrollTo({ top: Math.round(y), behavior: 'smooth' });
    const h = $('h1, h2', beats[b]);
    if (h) {
      h.setAttribute('tabindex', '-1');
      setTimeout(() => h.focus({ preventScroll: true }), 900);
    }
  }
  $$('[data-go]').forEach((el) => {
    el.addEventListener('click', (e) => {
      if (!root.classList.contains('st')) return;
      e.preventDefault();
      goBeat(+el.dataset.go);
    });
  });

  function fallbackFlat() {
    root.classList.remove('st');
    cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('scroll', onScroll);
    trackEl.removeAttribute('style');
    beats.forEach((b) => b.classList.remove('on'));
    boxes.forEach((bx) => bx.removeAttribute('style'));
    beats[4].style.transform = '';
    $$('.desk-bg__grid, .desk-bg__grain').forEach((el) => el.removeAttribute('style'));
    $$('[data-i]', stageEl).forEach((el) => el.removeAttribute('style'));
    numEls.forEach((b) => { b.textContent = b.dataset.n; });
  }

  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallbackFlat(); });
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (rmq.addEventListener) rmq.addEventListener('change', (e) => { if (e.matches) fallbackFlat(); });

  /* ================= 4. 启动 ================= */
  const qAt = new URLSearchParams(window.location.search).get('at');
  if (/[?&]debug/.test(location.search)) window.__fold = { renderer, plane, pad, cam, launch, board };
  if (qAt) dbgAt = qAt;

  let lastW = 0, lastH = 0;
  function onResize(force) {
    const w = stageEl.clientWidth || window.innerWidth;
    const h = stageEl.clientHeight || window.innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 2) return;
    // 手机地址栏伸缩只改高度一点点：不重排，避免墨迹重印
    if (!force && w === lastW && Math.abs(h - lastH) < 90 && lastH) return;
    lastW = w; lastH = h;
    computeLayout();
    onScroll();
    curY = targetY;
    if (plane.state !== 'fold') { plane.state = 'fold'; resultEl.classList.remove('on'); }
    camRest();
    applyCamDom();
    scheduleInk(260);
    wake();
  }

  window.addEventListener('resize', () => onResize(false));
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });

  introT0 = qAt ? -1 : performance.now();
  try {
    onResize(true);
    renderFrame(performance.now());
  } catch (e) {
    fallbackFlat();
    return;
  }

  const fontP = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('900 58px "SHU Serif"', '怎么加入' + WX),
        document.fonts.load('400 18px "SHU Serif"', '上海大学人工智能社传单背面第折微信搜公众号'),
        document.fonts.ready
      ]).catch(() => 0)
    : Promise.resolve();
  const imgsP = Promise.all($$('img', stageEl).map((im) => (im.decode ? im.decode().catch(() => 0) : 0)));

  Promise.race([Promise.all([fontP, imgsP]), new Promise((ok) => setTimeout(ok, 2200))]).then(() => {
    if (!root.classList.contains('st')) return;
    try {
      renderer.rebuildTextures(WX);
      onResize(true);
      renderFrame(performance.now());
    } catch (e) {
      fallbackFlat();
    }
    // 首屏标题入场动画结束后再印
    scheduleInk(Math.max(60, 1300 - performance.now()));
  });

  setTimeout(() => {
    if (!root.classList.contains('st')) return;
    introT0 = -1;
    curY = targetY;
    try { renderFrame(performance.now()); } catch (e) { fallbackFlat(); }
  }, 2500);
})();
