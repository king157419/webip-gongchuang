/* v24-fold · app.js —— 数据渲染 + 吸顶折纸舞台编排
 * 原生滚动驱动，不拦截滚轮/触摸/键盘：
 *   每一拍 = 40% 折纸动作 → 45% 摊平停住可读 → 15% 压痕过渡下一折
 *   往回滑全程逆向展开；减少动态或 WebGL 不可用时退回普通纸张分节页面。 */
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

  // 入场动画不依赖 rAF 的硬兜底（后台标签页 2.5 秒后也必定就位）
  setTimeout(() => root.classList.add('intro-done'), 2500);

  if (!C) {
    root.classList.remove('st');
    return;
  }

  /* ================= 1. 渲染 window.CLUB 真实内容 ================= */
  const CAT = { weld: '焊接', course: '课程', visit: '参访', contest: '大赛', talk: '分享会' };
  const WX = String((C.meta.contact && C.meta.contact.wechat) || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '').trim();

  const heroHost = String(C.meta.host || '').replace('通信与信息工程学院', '通信学院');
  $('#heroMeta').textContent = `${C.meta.founded} 年成立 · 挂靠${heroHost}`;

  // ② 平时做什么（5 种活动，每种一句话）
  $('#progList').innerHTML = C.programs.map((p, k) => {
    const oneLine = String(p.desc || '').split(/[；。]/)[0];
    return `<li data-i="${k + 1}">
      <span class="prog__n">${pad2(k + 1)}</span>
      <b class="prog__t">${esc(p.name)}</b>
      <span class="prog__d">${esc(oneLine)}。</span>
    </li>`;
  }).join('');

  // ③ 做过的事（挑 5 条最有分量的报道 + 全部 16 篇抽屉）
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

  // ④ 谁在带大家（社长 + 指导老师 + 4 个部门）
  const LD = C.people.leaders[0];
  const TS = C.people.teachers || [];
  const DEPS = C.meta.departments || [];
  const ldParts = String(LD.desc || '').split('。').filter(Boolean);
  const ldShort = (ldParts[0] ? ldParts[0].replace(/^通信与信息工程学院/, '') + '。' : '')
    + (ldParts[1] ? ldParts[1].split('，')[0] + '。' : '');

  $('#pplBox').innerHTML = `
    <div class="ppl-top" data-i="1">
      <div class="ppl-lead">
        ${LD.photo ? `<img class="ppl-photo" src="../shared/img/${esc(LD.photo)}" alt="社长${esc(LD.name)}" width="228" height="671" loading="lazy">` : ''}
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

  // ⑤ 怎么加入（三步 + 复制公众号 + FAQ）
  $('#stepList').innerHTML = C.join.steps.map((s, k) => `<li data-i="${k + 1}">
    <span class="step__n">${pad2(k + 1)}</span>
    <b class="step__t">${esc(s.t)}</b>
    <span class="step__d">${esc(s.d)}</span>
  </li>`).join('');

  const locMain = String(C.meta.location || '').split('（')[0].trim();
  $('#whereLine').textContent = `常驻${locMain}`;
  $('#copyMsg').textContent = `公众号：${WX}`;
  $('#footMeta').textContent = `${C.meta.type} · 挂靠${C.meta.host} · ${C.meta.founded} 年成立 · ${DEPS.length} 个部门`;

  $('#faqList').innerHTML = (C.join.faq || []).map((f) =>
    `<dt>${esc(f.q)}</dt><dd>${esc(f.a)}</dd>`
  ).join('');

  // 复制公众号名（HTTP 环境兼容：隐藏 textarea + execCommand）
  $('#copyBtn').addEventListener('click', () => {
    const ta = $('#clip'), msg = $('#copyMsg');
    let ok = false;
    try {
      ta.value = WX;
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, WX.length);
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    ta.blur();
    $('#copyBtn').focus({ preventScroll: true });
    msg.textContent = ok ? `已复制「${WX}」，打开微信搜一搜粘贴即可。` : `微信里搜索：${WX}`;
  });

  // 抽屉开关
  function bindDrawer(dlg, openBtn, closeBtn) {
    const open = () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); };
    const close = () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); openBtn.focus({ preventScroll: true }); };
    openBtn.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  }
  bindDrawer($('#newsSheet'), $('#openNews'), $('#closeNews'));
  bindDrawer($('#faqSheet'), $('#openFaq'), $('#closeFaq'));

  // 静态桌面颗粒纹理
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

  const stageEl = $('#stage'), trackEl = $('#track'), glCanvas = $('#gl'), fxCanvas = $('#fx');
  let renderer, fx;
  try {
    renderer = new window.FoldGL.FoldStage(glCanvas);
    fx = fxCanvas.getContext('2d');
    if (!fx) throw new Error('No 2D');
  } catch (e) {
    root.classList.remove('st');
    return;
  }

  // 5 拍滚动轨道长度（视口高度倍数）
  const BEAT_LEN = [1.15, 2.2, 2.2, 2.2, 2.1];
  // 前 4 拍摊平状态下，纸张整体包络与文字安全区（纸张局部坐标 W=1, H=1.42）
  const PAPER_ENV = [
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 1.42, sx0: -0.88, sx1: 0.88, sy0: -1.28, sy1: 1.28 },
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 1.42, sx0: -0.90, sx1: 0.90, sy0: -1.34, sy1: 0.37 },
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 0.60, sx0: -0.90, sx1: 0.90, sy0: -1.32, sy1: 0.36 },
    { x0: -1.0, x1: 1.0, y0: -1.42, y1: 0.60, sx0: -0.90, sx1: 0.90, sy0: -1.35, sy1: -0.12 }
  ];

  const beats = $$('.beat', stageEl);
  const boxes = [$('#box0'), $('#box1'), $('#box2'), $('#box3'), $('#box4')];
  const boxItems = boxes.map((bx) => $$('[data-i]', bx).map((el) => [el, +el.dataset.i]));
  const numEls = $$('[data-n]', boxes[2]);
  const planeZone = $('#planeZone');
  const dockFoldN = $('#dockFoldN'), deskHint = $('#deskHint');
  const dockBtns = $$('#foldDock button');

  let VW = 0, VH = 0, dpr = 1, trackTop = 0, totalScroll = 0;
  let starts = [], basePose = [];
  let targetY = 0, curY = 0, raf = 0, lastT = 0, lastFrame = 0, fbTimer = 0, dbgAt = null;
  let ptrX = 0, ptrY = 0, sPtrX = 0, sPtrY = 0, pokeT0 = -1, pokeDir = 1, introT0 = -1;
  let stageVis = true;
  const uiState = { fold: -1, beat: -1 };

  // 有重量感的折纸曲线：起手轻掀 → 中段顺滑翻折 → 末端压实折痕
  function foldEase(u) {
    u = clamp(u, 0, 1);
    const t = clamp(u / 0.94, 0, 1);
    return t < 0.5 ? 2.2 * t * t * (1.05 - 0.3 * t) : 1 - Math.pow(-2 * t + 2, 2.6) / 2;
  }

  function computeLayout() {
    VW = stageEl.clientWidth || window.innerWidth;
    VH = stageEl.clientHeight || window.innerHeight;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, (VW < 768 || coarse) ? 1 : 1.5);

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

    const mobile = VW < 860;
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
      const sPx = Math.min(maxW / pw, maxH / ph);
      const s = sPx / ppu;
      const cxScreen = VW * 0.5;
      const cyScreen = topSafe + availH * 0.5;
      const worldCenter = renderer.unproject(cxScreen, cyScreen, 0);
      const midX = (env.x0 + env.x1) * 0.5, midY = (env.y0 + env.y1) * 0.5;
      const tx = worldCenter[0] - midX * s;
      const ty = worldCenter[1] - midY * s;
      basePose[b] = { rx: 0, ry: 0, rz: 0, tx, ty, tz: 0, s };

      // 把安全阅读区精确投影到屏幕像素，赋予 DOM 容器
      const sx0 = compact ? Math.min(env.sx0, -0.93) : env.sx0;
      const sx1 = compact ? Math.max(env.sx1, 0.93) : env.sx1;
      const sy1 = (b === 3 && compact) ? 0.02 : env.sy1;
      const pTL = renderer.project([sx0 * s + tx, sy1 * s + ty, 0]);
      const pBR = renderer.project([sx1 * s + tx, env.sy0 * s + ty, 0]);
      const bw = Math.max(240, pBR[0] - pTL[0]);
      const bh = Math.max(200, pBR[1] - pTL[1]);
      const bx = (pTL[0] + pBR[0]) * 0.5;
      const by = (pTL[1] + pBR[1]) * 0.5;

      const box = boxes[b];
      box.style.setProperty('--bx', bx.toFixed(1) + 'px');
      box.style.setProperty('--by', by.toFixed(1) + 'px');
      box.style.setProperty('--bw', bw.toFixed(1) + 'px');
      box.style.setProperty('--bh', (b === 0 ? bh.toFixed(1) + 'px' : 'auto'));
      box.style.setProperty('--fit', '1');
      const realH = box.offsetHeight || bh;
      const fit = Math.min(1, bh / Math.max(1, realH));
      box.style.setProperty('--fit', fit.toFixed(3));
    }

    // 第 5 拍（纸飞机俯侧停驻姿态：以纸飞机真实几何中心 [0,-0.41,0] 锚定，完整入镜）
    // 停驻姿态：机头朝右上、略侧倾露出龙骨，一眼读成"纸飞机"
    if (!mobile) {
      const cx4 = VW * 0.30, cy4 = VH * 0.44, z4 = 0.42;
      const rx = -0.70, ry = -0.50, rz = -0.25;
      const spanPx = Math.min(VW * 0.38, VH * 0.62);
      const s4 = (spanPx / 2.04) / renderer.pxPerUnit(z4);
      const targetPt = renderer.unproject(cx4, cy4, z4);
      const cOff = renderer.rotVec(rx, ry, rz, [0, -0.41 * s4, 0]);
      basePose[4] = { rx, ry, rz, tx: targetPt[0] - cOff[0], ty: targetPt[1] - cOff[1], tz: z4 - cOff[2], s: s4 };
      if (planeZone) {
        planeZone.style.setProperty('--px', cx4.toFixed(1) + 'px');
        planeZone.style.setProperty('--py', (cy4 + spanPx * 0.05).toFixed(1) + 'px');
        planeZone.style.setProperty('--pw', Math.round(spanPx * 0.96) + 'px');
        planeZone.style.setProperty('--ph', Math.round(spanPx * 1.04 + 34) + 'px');
      }
    } else {
      const cx4 = VW * 0.45, cy4 = topSafe + availH * 0.17, z4 = 0.38;
      const rx = -0.70, ry = -0.50, rz = -0.25;
      const spanPx = Math.min(VW * 0.8, availH * 0.36);
      const s4 = (spanPx / 2.02) / renderer.pxPerUnit(z4);
      const targetPt = renderer.unproject(cx4, cy4, z4);
      const cOff = renderer.rotVec(rx, ry, rz, [0, -0.41 * s4, 0]);
      basePose[4] = { rx, ry, rz, tx: targetPt[0] - cOff[0], ty: targetPt[1] - cOff[1], tz: z4 - cOff[2], s: s4 };
      if (planeZone) {
        planeZone.style.setProperty('--px', cx4.toFixed(1) + 'px');
        planeZone.style.setProperty('--py', (cy4 + spanPx * 0.06).toFixed(1) + 'px');
        planeZone.style.setProperty('--pw', Math.round(Math.max(200, spanPx * 1.05)) + 'px');
        planeZone.style.setProperty('--ph', Math.round(spanPx * 1.06 + 30) + 'px');
      }
    }

    // 第 5 拍右侧卡片自适应高度保护
    boxes[4].style.setProperty('--fit', '1');
    const maxJoinH = mobile ? availH * 0.62 : availH * 0.90;
    const jFit = Math.min(1, maxJoinH / Math.max(1, boxes[4].offsetHeight));
    boxes[4].style.setProperty('--fit', jFit.toFixed(3));
  }

  function lerpPose(a, b, w) {
    return {
      rx: lerp(a.rx, b.rx, w),
      ry: lerp(a.ry, b.ry, w),
      rz: lerp(a.rz, b.rz, w),
      tx: lerp(a.tx, b.tx, w),
      ty: lerp(a.ty, b.ty, w),
      tz: lerp(a.tz, b.tz, w),
      s: lerp(a.s, b.s, w)
    };
  }

  function beatAt(scrollPx) {
    const p = clamp(scrollPx, 0, totalScroll - 0.01);
    let i = 0;
    while (i < 4 && p >= starts[i + 1]) i++;
    return { i, f: (p - starts[i]) / (BEAT_LEN[i] * VH) };
  }

  // 2D 辅助特效：折痕压实高光扫掠 + 纸飞机起飞虚线航迹
  function drawCreaseGlint(pA, pB, prog, alpha) {
    if (alpha <= 0.01) return;
    const x1 = lerp(pA[0], pB[0], clamp(prog - 0.28, 0, 1));
    const y1 = lerp(pA[1], pB[1], clamp(prog - 0.28, 0, 1));
    const x2 = lerp(pA[0], pB[0], clamp(prog + 0.18, 0, 1));
    const y2 = lerp(pA[1], pB[1], clamp(prog + 0.18, 0, 1));
    const g = fx.createLinearGradient(x1, y1, x2, y2);
    g.addColorStop(0, 'rgba(255,252,244,0)');
    g.addColorStop(0.5, `rgba(255,252,244,${(0.85 * alpha).toFixed(3)})`);
    g.addColorStop(1, 'rgba(201,63,24,0)');
    fx.save();
    fx.strokeStyle = g;
    fx.lineWidth = 2.4;
    fx.beginPath();
    fx.moveTo(x1, y1);
    fx.lineTo(x2, y2);
    fx.stroke();
    fx.restore();
  }

  function drawFlightWake(pStart, pEnd, flyU) {
    if (flyU <= 0.02) return;
    const vis = flyU < 0.96 ? 1 : 1 - (flyU - 0.96) / 0.04;
    const ctrlX = lerp(pStart[0], pEnd[0], 0.35) + (VW >= 860 ? 120 : 60);
    const ctrlY = Math.min(pStart[1], pEnd[1]) - (VW >= 860 ? 90 : 45);
    fx.save();
    fx.setLineDash([5, 6]);
    fx.strokeStyle = `rgba(201, 63, 24, ${(0.34 * (0.45 + 0.55 * vis)).toFixed(3)})`;
    fx.lineWidth = 1.4;
    fx.beginPath();
    const steps = 28, uMax = clamp(flyU, 0, 1);
    for (let k = 0; k <= steps; k++) {
      const t = (k / steps) * uMax;
      const mt = 1 - t;
      const x = mt * mt * pStart[0] + 2 * mt * t * ctrlX + t * t * pEnd[0];
      const y = mt * mt * pStart[1] + 2 * mt * t * ctrlY + t * t * pEnd[1];
      if (k === 0) fx.moveTo(x, y);
      else fx.lineTo(x, y);
    }
    fx.stroke();
    fx.restore();
  }

  function updateBox(idx, showK, exitK) {
    const beatEl = beats[idx], box = boxes[idx], items = boxItems[idx];
    const active = showK > 0.002 && exitK < 0.998;
    beatEl.classList.toggle('on', active);
    if (!active) return;

    const fade = clamp(showK, 0, 1) * (1 - clamp(exitK, 0, 1));
    box.style.opacity = fade.toFixed(3);

    for (let k = 0; k < items.length; k++) {
      const [el, order] = items[k];
      const v = idx === 0 ? 1 : sm(0.08 + order * 0.06, 0.58 + order * 0.06, showK);
      const op = v * (1 - sm(0, 0.7, exitK));
      el.style.opacity = op.toFixed(3);
      el.style.transform = `translate3d(0, ${((1 - v) * 10 - exitK * 10).toFixed(1)}px, 0)`;
    }

    if (idx === 2) {
      const nk = sm(0.15, 0.85, showK);
      for (let k = 0; k < numEls.length; k++) {
        const b = numEls[k], targetN = +b.dataset.n;
        b.textContent = Math.round(targetN * nk);
      }
    }
  }

  function renderFrame(now) {
    const { i, f } = beatAt(curY);
    let busy = false;

    fx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fx.clearRect(0, 0, VW, VH);

    let t1 = 0, t2 = 0, t3 = 0, t4 = 0, wingInk = 0;
    let pose = { ...basePose[0] };
    let shadowAlpha = 0.18, deskZ = -0.04;

    // 跨拍连续抬纸曲线：上一拍末 15% 预抬至 0.30，下一拍前 40% 从 0.30 升至峰值 1.0 再平稳归零
    const actLift = (act) => (1 - sm(0.54, 1.0, act)) * lerp(0.30, 1.0, sm(0.0, 0.42, act));
    const SWING = [
      null,
      { rx: -0.30, ry: 0.13, rz: -0.03, tz: 0.22 },
      { rx: 0.32, ry: -0.14, rz: 0.03, tz: 0.24 },
      { rx: -0.28, ry: 0.15, rz: -0.035, tz: 0.22 }
    ];

    // 首屏纸张入场轻落（2.5s 后强制归零）
    if (introT0 > 0) {
      const iu = clamp((now - introT0) / 850, 0, 1);
      if (iu < 1) {
        const w = Math.pow(1 - iu, 3);
        pose.tz += 0.24 * w;
        pose.rx -= 0.12 * w;
        pose.rz += 0.04 * w;
        busy = true;
      } else {
        introT0 = -1;
      }
    }

    if (i === 0) {
      const pre = sm(0.85, 1.0, f);
      const sw = SWING[1];
      pose = lerpPose(pose, basePose[1], 0.28 * pre);
      pose.rx += sw.rx * 0.30 * pre;
      pose.ry += sw.ry * 0.30 * pre;
      pose.rz += sw.rz * 0.30 * pre;
      pose.tz += sw.tz * 0.30 * pre;
    } else if (i === 1) {
      const act = clamp(f / 0.40, 0, 1);
      const pre = sm(0.85, 1.0, f);
      t1 = foldEase(act);
      pose = lerpPose(basePose[0], basePose[1], lerp(0.28, 1.0, sm(0, 0.80, act)));
      pose = lerpPose(pose, basePose[2], 0.28 * pre);
      const lf = actLift(act), sw = SWING[1], swNext = SWING[2];
      pose.rx = sw.rx * lf + swNext.rx * 0.30 * pre;
      pose.ry = sw.ry * lf + swNext.ry * 0.30 * pre;
      pose.rz = sw.rz * lf + swNext.rz * 0.30 * pre;
      pose.tz = sw.tz * lf + swNext.tz * 0.30 * pre;

      if (act > 0.72 && act < 1.0) {
        const gA = Math.sin(Math.PI * (act - 0.72) / 0.28);
        const s = pose.s;
        drawCreaseGlint(
          renderer.project([-1 * s + pose.tx, 0.42 * s + pose.ty, 0]),
          renderer.project([0 * s + pose.tx, 1.42 * s + pose.ty, 0]),
          (act - 0.72) / 0.28, gA
        );
        drawCreaseGlint(
          renderer.project([1 * s + pose.tx, 0.42 * s + pose.ty, 0]),
          renderer.project([0 * s + pose.tx, 1.42 * s + pose.ty, 0]),
          (act - 0.72) / 0.28, gA
        );
      }
    } else if (i === 2) {
      t1 = 1;
      const act = clamp(f / 0.40, 0, 1);
      const pre = sm(0.85, 1.0, f);
      t2 = foldEase(act);
      pose = lerpPose(basePose[1], basePose[2], lerp(0.28, 1.0, sm(0, 0.80, act)));
      pose = lerpPose(pose, basePose[3], 0.28 * pre);
      const lf = actLift(act), sw = SWING[2], swNext = SWING[3];
      pose.rx = sw.rx * lf + swNext.rx * 0.30 * pre;
      pose.ry = sw.ry * lf + swNext.ry * 0.30 * pre;
      pose.rz = sw.rz * lf + swNext.rz * 0.30 * pre;
      pose.tz = sw.tz * lf + swNext.tz * 0.30 * pre;

      if (act > 0.72 && act < 1.0) {
        const gA = Math.sin(Math.PI * (act - 0.72) / 0.28);
        const s = pose.s;
        drawCreaseGlint(
          renderer.project([-0.82 * s + pose.tx, 0.60 * s + pose.ty, 0]),
          renderer.project([0.82 * s + pose.tx, 0.60 * s + pose.ty, 0]),
          (act - 0.72) / 0.28, gA
        );
      }
    } else if (i === 3) {
      t1 = 1; t2 = 1;
      const act = clamp(f / 0.40, 0, 1);
      const pre = sm(0.85, 1.0, f);
      t3 = foldEase(act);
      pose = lerpPose(basePose[2], basePose[3], lerp(0.28, 1.0, sm(0, 0.80, act)));
      const lf = actLift(act), sw = SWING[3];
      pose.rx = sw.rx * lf - 0.14 * pre;
      pose.ry = sw.ry * lf + 0.10 * pre;
      pose.rz = sw.rz * lf - 0.08 * pre;
      pose.tz = sw.tz * lf + 0.10 * pre;

      if (act > 0.72 && act < 1.0) {
        const gA = Math.sin(Math.PI * (act - 0.72) / 0.28);
        const s = pose.s;
        drawCreaseGlint(
          renderer.project([-1.0 * s + pose.tx, -0.34 * s + pose.ty, 0]),
          renderer.project([-0.05 * s + pose.tx, 0.60 * s + pose.ty, 0]),
          (act - 0.72) / 0.28, gA
        );
        drawCreaseGlint(
          renderer.project([1.0 * s + pose.tx, -0.34 * s + pose.ty, 0]),
          renderer.project([0.05 * s + pose.tx, 0.60 * s + pose.ty, 0]),
          (act - 0.72) / 0.28, gA
        );
      }
    } else if (i === 4) {
      t1 = 1; t2 = 1; t3 = 1;
      const act = clamp(f / 0.40, 0, 1);
      t4 = foldEase(clamp(act / 0.54, 0, 1));
      wingInk = sm(0.22, 0.58, act);

      const flyU = sm(0.24, 1.0, act);
      const pStart = {
        ...basePose[3],
        rx: -0.14,
        ry: 0.10,
        rz: -0.08,
        tz: 0.10
      };
      pose = lerpPose(pStart, basePose[4], flyU);

      // 起飞弧线：先轻盈拔高侧倾，再滑翔落定在侧翼停驻点
      const arc = Math.sin(Math.PI * flyU);
      pose.tx += 0.22 * arc;
      pose.ty += 0.14 * arc;
      pose.tz += 0.30 * arc;
      pose.ry += 0.24 * arc;
      pose.rx += -0.12 * arc;

      // 彩蛋：点一下纸飞机试飞一圈再稳稳落回
      if (pokeT0 > 0) {
        const pu = (now - pokeT0) / 1150;
        if (pu < 1) {
          const w = Math.sin(Math.PI * pu);
          const loop = Math.sin(Math.PI * 2 * pu);
          pose.tx += 0.20 * loop * w;
          pose.ty += 0.14 * Math.sin(Math.PI * pu);
          pose.tz += 0.22 * w;
          pose.ry += 0.36 * loop * w;
          pose.rx += -0.15 * w;
          busy = true;
        } else {
          pokeT0 = -1;
        }
      }

      // 指针轻抚响应（类似 Sedrus 书桌纸飞机随鼠标微微偏航俯仰）
      if (flyU > 0.85) {
        const inf = (flyU - 0.85) / 0.15;
        pose.ry += sPtrX * 0.14 * inf;
        pose.rx += -sPtrY * 0.11 * inf;
        pose.tx += sPtrX * 0.045 * inf;
        pose.ty += -sPtrY * 0.035 * inf;
      }

      shadowAlpha = lerp(0.18, 0.13, flyU);
      const st2D = renderer.project([basePose[3].tx, basePose[3].ty - 0.35 * basePose[3].s, 0]);
      const ed2D = renderer.project([pose.tx - 0.10 * pose.s, pose.ty - 0.42 * pose.s, pose.tz]);
      if (act > 0.26) drawFlightWake(st2D, ed2D, flyU);
    }

    // 前 4 拍可读态时纸张微随鼠标光影偏移（不倾斜文字，只动光源与边角微翘）
    const light = [-0.30 + sPtrX * 0.14, 0.38 - sPtrY * 0.14, 1.0];
    const curl = i === 0 ? { cx: sPtrX >= 0 ? 0.7 : -0.7, cy: -0.7, amp: 0.045 * (0.4 + Math.hypot(sPtrX, sPtrY)) } : null;

    renderer.render({ t1, t2, t3, t4, wingInk, pose, light, deskZ, shadowAlpha, curl });

    // 各拍文字显隐严格对应 40% 动作 → 45% 停住可读 → 15% 过渡
    updateBox(0, i === 0 ? 1 : 0, i === 0 ? sm(0.82, 0.94, f) : 1);
    for (let b = 1; b <= 3; b++) {
      const sh = i === b ? sm(0.32, 0.40, f) : 0;
      const ex = i === b ? sm(0.85, 0.95, f) : (i > b ? 1 : 0);
      updateBox(b, sh, ex);
    }
    updateBox(4, i === 4 ? sm(0.28, 0.40, f) : 0, 0);

    // 更新“第 n 折 / 共 4 折”与刻度 1–5
    const foldNum = i === 0 ? 0 : (f >= 0.18 ? i : i - 1);
    if (uiState.fold !== foldNum) {
      uiState.fold = foldNum;
      dockFoldN.textContent = foldNum;
      if (deskHint) {
        deskHint.textContent = foldNum === 4
          ? '纸飞机已成形 · 往回滑可一步步展开'
          : (foldNum === 0 ? '往下滑 · 把传单折成纸飞机' : `已完成第 ${foldNum} 折 · 往下滑继续折纸`);
      }
    }
    if (uiState.beat !== i) {
      uiState.beat = i;
      dockBtns.forEach((btn, k) => {
        if (k === i) btn.setAttribute('aria-current', 'step');
        else btn.removeAttribute('aria-current');
      });
    }

    return busy;
  }

  /* ================= 3. 按需帧循环与事件监听 ================= */
  function tick(now) {
    raf = 0;
    lastFrame = now;
    const dt = Math.min(0.05, (now - (lastT || now)) / 1000);
    lastT = now;

    const kScroll = 1 - Math.exp(-dt / 0.048);
    curY += (targetY - curY) * kScroll;
    if (Math.abs(targetY - curY) < 0.5) curY = targetY;

    const kPtr = 1 - Math.exp(-dt / 0.09);
    sPtrX += (ptrX - sPtrX) * kPtr;
    sPtrY += (ptrY - sPtrY) * kPtr;
    if (Math.abs(ptrX - sPtrX) < 0.002) sPtrX = ptrX;
    if (Math.abs(ptrY - sPtrY) < 0.002) sPtrY = ptrY;

    let busy = false;
    try {
      // 舞台彻底滚出视口后停止渲染
      if (curY <= totalScroll + VH + 60) {
        busy = renderFrame(now);
      }
    } catch (e) {
      fallbackFlat();
      return;
    }

    const moving = curY !== targetY || sPtrX !== ptrX || sPtrY !== ptrY || busy;
    if (moving && !document.hidden) {
      raf = requestAnimationFrame(tick);
    } else {
      lastT = 0;
    }
  }

  function wake() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(tick);
    clearTimeout(fbTimer);
    // 后台标签页或无头虚拟时间里 rAF 若停摆，直接对齐到目标帧
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
    if (mBeat) {
      const b = +mBeat[1];
      return starts[b] + (b === 0 ? 0 : 0.60 * BEAT_LEN[b] * VH);
    }
    const mFold = /^f([1-4])$/.exec(spec);
    if (mFold) {
      const b = +mFold[1];
      return starts[b] + 0.20 * BEAT_LEN[b] * VH;
    }
    const n = parseFloat(spec);
    return isNaN(n) ? null : n;
  }

  function onScroll() {
    const dbgY = resolveDebugY(dbgAt);
    targetY = dbgY != null ? dbgY : (window.scrollY - trackTop);
    wake();
  }

  stageEl.addEventListener('pointermove', (e) => {
    const r = stageEl.getBoundingClientRect();
    ptrX = clamp(((e.clientX - r.left) / Math.max(1, r.width)) * 2 - 1, -1, 1);
    ptrY = clamp(((e.clientY - r.top) / Math.max(1, r.height)) * 2 - 1, -1, 1);
    wake();
  }, { passive: true });

  stageEl.addEventListener('pointerleave', () => {
    ptrX = 0; ptrY = 0;
    wake();
  }, { passive: true });

  $('#planePoke').addEventListener('click', () => {
    pokeT0 = performance.now();
    wake();
  });

  // 点击 1–5 或“怎么加入”平滑跳到对应拍的可读段
  function goBeat(b) {
    const y = trackTop + starts[b] + (b === 0 ? 0 : 0.60 * BEAT_LEN[b] * VH);
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
    $$('[data-i]', stageEl).forEach((el) => el.removeAttribute('style'));
    numEls.forEach((b) => { b.textContent = b.dataset.n; });
  }

  glCanvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallbackFlat(); });
  const rmq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (rmq.addEventListener) rmq.addEventListener('change', (e) => { if (e.matches) fallbackFlat(); });

  /* ================= 4. 初始化启动 ================= */
  const qAt = new URLSearchParams(window.location.search).get('at');
  if (qAt) dbgAt = qAt;

  let lastW = 0, lastH = 0;
  function onResize(force) {
    const w = stageEl.clientWidth || window.innerWidth;
    const h = stageEl.clientHeight || window.innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 2) return;
    lastW = w; lastH = h;
    computeLayout();
    onScroll();
    curY = targetY;
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

  // 字体加载完后刷新一次机翼“怎么加入”宋体贴图与排版尺寸
  const fontP = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('900 58px "SHU Serif"', '怎么加入上海大学人工智能社第四折翼起飞'),
        document.fonts.load('400 18px "SHU Serif"', '上海大学人工智能社')
      ]).catch(() => 0)
    : Promise.resolve();

  Promise.race([fontP, new Promise((ok) => setTimeout(ok, 1800))]).then(() => {
    if (!root.classList.contains('st')) return;
    try {
      renderer.rebuildTextures();
      onResize(true);
      renderFrame(performance.now());
    } catch (e) {
      fallbackFlat();
    }
  });

  // 2.5 秒硬兜底：确保入场偏移消除并渲染静止终态
  setTimeout(() => {
    if (!root.classList.contains('st')) return;
    introT0 = -1;
    curY = targetY;
    try { renderFrame(performance.now()); } catch (e) { fallbackFlat(); }
  }, 2500);
})();
