/* v17-slice · app.js —— 内容渲染 + 吸顶舞台（滑动 = 一刀）
 * 原生滚动，不拦截滚轮/触摸；滚动进度一一对应到舞台里的动作：
 *   每一拍 = 动作 40%（抛起 → 刀光划过 → 两半飞开）→ 停住可读 45% → 过渡 15%（下一个物体抛上来）
 * 减少动态 / WebGL 失败 → 去掉 html.st，退回普通分节页面。 */
(function () {
  'use strict';
  const C = window.CLUB;
  const root = document.documentElement;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (x, a, b) => Math.max(a == null ? 0 : a, Math.min(b == null ? 1 : b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;
  setTimeout(() => root.classList.add('intro-done'), 2500);
  if (!C) { root.classList.remove('st'); return; }

  /* ================= 1. 内容（全部来自 shared/content.js） ================= */
  const pad2 = (n) => String(n).padStart(2, '0');
  const CAT = { weld: '焊接', course: '课程', visit: '参访', contest: '大赛', talk: '分享会' };
  const WX = String(C.meta.contact.wechat || '上海大学通信学院').replace(/（.*?）|\(.*?\)/g, '');

  $('#progList').innerHTML = C.programs.map((p, k) => `<li data-i="${k + 1}"><span class="prog__n">${pad2(k + 1)}</span><b class="prog__t">${esc(p.name)}</b><span class="prog__d">${esc(p.desc.split(/[；。]/)[0])}。</span></li>`).join('');

  // 做过的事：数字都出自对应报道
  const HL = [
    { d: '2024-12-09', pre: '近', n: 200, suf: '', t: '名同学来听 AI 论文分享会' },
    { d: '2024-09-24', pre: '', n: 100, suf: '+', t: '名同学去 2024 华为全联接大会' },
    { d: '2026-05-11', pre: '', n: 40, suf: '+', t: '名同学入选昇腾大模型实践课' },
    { d: '2025-11-25', pre: '近', n: 100, suf: '', t: '名学子走进华为鸿蒙生态学堂' },
    { d: '2025-11-06', pre: '', n: 100, suf: '+', t: '人报名焊接专项赛' }
  ];
  $('#hlList').innerHTML = HL.map((h, k) => {
    const n = C.news.find((x) => x.date === h.d);
    if (!n) return '';
    return `<li data-i="${k + 1}"><a class="hl__a" href="${esc(n.source)}" target="_blank" rel="noopener">
      <span class="hl__n">${h.pre ? `<small>${h.pre}</small>` : ''}<b data-n="${h.n}">${h.n}</b>${h.suf ? `<small>${h.suf}</small>` : ''}</span>
      <span class="hl__t">${esc(h.t)}</span><span class="hl__d">${esc(n.date.slice(0, 7).replace('-', '.'))} <span aria-hidden="true">↗</span></span></a></li>`;
  }).join('');
  $('#newsSub').textContent = `从 ${C.news.length} 篇学院官网报道里挑了五件。`;
  $('#openNews').innerHTML = `全部 ${C.news.length} 篇报道 <span aria-hidden="true">→</span>`;
  $('#allNews').innerHTML = C.news.map((n) => `<li><a href="${esc(n.source)}" target="_blank" rel="noopener"><span class="sheet__d">${esc(n.date.replace(/-/g, '.'))} · ${esc(CAT[n.cat] || '活动')}</span><span class="sheet__tt">${esc(n.title)}</span><span class="sheet__s">${esc(n.summary)}</span></a></li>`).join('');

  const LD = C.people.leaders[0], TS = C.people.teachers, DEP = C.meta.departments;
  const ls = String(LD.desc).split('。').filter(Boolean);
  $('#pplBox').innerHTML = `
    <div class="ppl__lead" data-i="1">
      ${LD.photo ? `<img class="ppl__ph" src="../shared/img/${esc(LD.photo)}" alt="社长${esc(LD.name)}" width="228" height="671" loading="lazy">` : ''}
      <div class="ppl__txt"><p class="ppl__role">${esc(LD.role)}</p><p class="ppl__name">${esc(LD.name)}</p>
      <p class="ppl__d">${esc(ls[0])}。${ls[1] ? esc(ls[1].split('，')[0]) + '。' : ''}</p></div>
    </div>
    <ul class="ppl__tch" data-i="2">${TS.map((t) => `<li><p class="ppl__name ppl__name--s">${esc(t.name)}</p><p class="ppl__role">${esc(t.role)}</p></li>`).join('')}</ul>
    <ul class="ppl__dep" data-i="3">${DEP.map((d) => `<li><b>${esc(d.name)}</b><span>${esc(d.desc)}</span></li>`).join('')}</ul>`;

  $('#stepList').innerHTML = C.join.steps.map((s, k) => `<li data-i="${k + 1}"><span class="steps__n">${pad2(k + 1)}</span><b class="steps__t">${esc(s.t)}</b><span class="steps__d">${esc(s.d)}</span></li>`).join('');
  $('#whereLine').textContent = '活动多在' + String(C.meta.location).split('（')[0].replace(/\s+/g, '') + '。';
  $('#footMeta').textContent = `${C.meta.type} · 挂靠${C.meta.host} · ${C.meta.founded} 年成立 · ${DEP.length} 个部门`;
  $('#copyMsg').textContent = `公众号：${WX}`;

  // 复制公众号名（HTTP 下没有 navigator.clipboard）
  $('#copyBtn').addEventListener('click', () => {
    const ta = $('#clip'), msg = $('#copyMsg');
    let ok = false;
    try { ta.value = WX; ta.focus(); ta.select(); ta.setSelectionRange(0, WX.length); ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.blur(); $('#copyBtn').focus({ preventScroll: true });
    msg.textContent = ok ? `已复制「${WX}」，打开微信搜一搜粘贴即可。` : `微信里搜索：${WX}`;
  });

  // 全部报道
  const sheet = $('#newsSheet');
  const openSheet = () => { if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', ''); };
  const closeSheet = () => { if (sheet.close) sheet.close(); else sheet.removeAttribute('open'); $('#openNews').focus({ preventScroll: true }); };
  $('#openNews').addEventListener('click', openSheet);
  $('#closeNews').addEventListener('click', closeSheet);
  sheet.addEventListener('click', (e) => { if (e.target === sheet) closeSheet(); });

  // 颗粒底纹（只生成一次，静态）
  try {
    const g = document.createElement('canvas'); g.width = g.height = 160;
    const gc = g.getContext('2d'), id = gc.createImageData(160, 160);
    for (let k = 0; k < id.data.length; k += 4) { const v = Math.random() * 255; id.data[k] = id.data[k + 1] = id.data[k + 2] = v; id.data[k + 3] = 255; }
    gc.putImageData(id, 0, 0);
    root.style.setProperty('--grain', `url(${g.toDataURL()})`);
  } catch (e) { /* 没有颗粒也照常 */ }

  /* ================= 2. 吸顶舞台 ================= */
  if (!root.classList.contains('st') || !window.SliceGL) { root.classList.remove('st'); return; }
  const { Renderer, M3, OBJ } = window.SliceGL;
  const stage = $('#stage'), track = $('#track'), fxc = $('#fx');
  let R, fx;
  try { R = new Renderer($('#gl')); fx = fxc.getContext('2d'); if (!fx) throw 0; } catch (e) { root.classList.remove('st'); return; }

  const BL = [1.1, 2.2, 2.2, 2.2, 2.0];            // 每拍长度（屏高的倍数）
  const ANG = [0, 0.38, -0.3, Math.PI - 0.14, 0.62]; // 每拍刀的方向（屏幕坐标，y 向下）
  const BASE = [null, { pitch: -0.62, yaw: 0.4, roll: -0.12 }, { pitch: -0.72, yaw: -0.32, roll: 0.07 }, { pitch: -0.32, yaw: 0.4, roll: -0.05 }, { pitch: -0.66, yaw: -0.38, roll: 0.1 }];
  const LABEL = [null, '平时做什么', '做过的事', '谁在带大家', '加入'];
  const A0 = 0.06, A1 = 0.36, LAG = 0.07;          // 刀光在动作段里的起止
  const beats = $$('.beat', stage);
  const panels = beats.map((b) => {
    const p = $('.panel', b);
    return p && { el: b, panel: p, bg: $('.panel__bg', p), slit: $('.panel__slit', p), items: $$('[data-i]', p).map((x) => [x, +x.dataset.i]), nums: $$('[data-n]', p), last: '' };
  });
  const heroBeat = beats[0], heroIn = $('.hero', heroBeat), hint = $('#hint'), dark = $('#dark'), shadow = $('#shadow');
  const cutN = $('#cutN'), railNow = $('#railNow'), railBtns = $$('#rail button');
  const objs = [];
  const early = [];
  let VW = 0, VH = 0, dpr = 1, trackTop = 0, total = 0, starts = [], cutA = [], cutS = [], lines = [];
  let target = 0, cur = 0, dir = 1, raf = 0, lastT = 0, lastFrame = 0, fbT = 0, dbgAt = null;
  let heroToss0 = -1, cuttable = null, hero = { x: 0, y: 0, s: 1 };
  const trail = [];
  const domCache = new Map(), ui = {};
  const setS = (el, k, v) => { const key = el; let o = domCache.get(key); if (!o) domCache.set(key, o = {}); if (o[k] !== v) { o[k] = v; el.style[k] = v; } };

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function sObj(j) { const o = objs[j]; return o ? Math.min(VH * 0.58, VW * 0.76) / R.pxPerUnit() / o.span : 1; }
  function lineThrough(cx, cy, ang) {
    const dx = Math.cos(ang), dy = Math.sin(ang), m = 80;
    let t0 = -1e9, t1 = 1e9;
    if (Math.abs(dx) > 1e-6) { let a = (-m - cx) / dx, b = (VW + m - cx) / dx; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    if (Math.abs(dy) > 1e-6) { let a = (-m - cy) / dy, b = (VH + m - cy) / dy; if (a > b) [a, b] = [b, a]; t0 = Math.max(t0, a); t1 = Math.min(t1, b); }
    return { x0: cx + dx * t0, y0: cy + dy * t0, dx, dy, len: t1 - t0, tc: -t0, cx, cy };
  }
  // 物体在屏幕 (x1,y1)-(x2,y2) 这条线上被切：求物体局部坐标里的切面
  function makeCut(pose, x1, y1, x2, y2) {
    const E = [0, 0, R.eyeZ], q1 = R.unproject(x1, y1, pose.T[2]), q2 = R.unproject(x2, y2, pose.T[2]);
    const n = nrm(cross(sub(q1, E), sub(q2, E))), d = dot(n, E);
    const Rm = M3.euler(pose.e), nl = M3.apT(Rm, n);
    return { R0: Rm, T0: pose.T, s: pose.s, plane: [nl[0], nl[1], nl[2], (d - dot(n, pose.T)) / pose.s], sep: nrm([n[0], n[1], 0]), nl };
  }

  /* ---------- 物体姿态 ---------- */
  function prePose(j, a) {
    const b = BASE[j], dr = Math.max(0, a - (j === 1 ? 0 : 0.1));
    return { e: { pitch: b.pitch, yaw: b.yaw + 0.5 * dr, roll: b.roll - 0.2 * dr }, T: [0, 0, 0], s: sObj(j) };
  }
  function tossPose(j, tau) {
    const b = BASE[j], w = (1 - tau) * (1 - tau), s = sObj(j), sg = j % 2 ? 1 : -1;
    const y0 = R.unproject(0, VH * 1.25, 0)[1] - objs[j].span * s * 0.6;
    return { e: { pitch: b.pitch + 1.0 * w, yaw: b.yaw - 0.8 * w * sg, roll: b.roll + 2.4 * w * sg }, T: [0.4 * w * sg, y0 * w, 0], s };
  }
  function heroPose(ts, t) {
    const b = BASE[1], tau = heroToss0 < 0 ? 1 : clamp((t - heroToss0) / 1100), w = (1 - tau) * (1 - tau);
    const hy = R.unproject(0, VH * 1.3, 0)[1];
    const base = R.unproject(hero.x, hero.y, 0);
    return {
      e: { pitch: b.pitch + 0.07 * Math.sin(ts * 0.6) + 0.8 * w, yaw: b.yaw + 0.5 * Math.sin(ts * 0.42), roll: b.roll + 0.06 * Math.sin(ts * 0.33) + 2.2 * w },
      T: [base[0], lerp(base[1] + 0.05 * Math.sin(ts * 0.9), hy - 1, w), 0], s: sObj(1) * hero.s, busy: true
    };
  }
  function blend(p, q, w) {
    return { e: { pitch: lerp(p.e.pitch, q.e.pitch, w), yaw: lerp(p.e.yaw, q.e.yaw, w), roll: lerp(p.e.roll, q.e.roll, w) }, T: [lerp(p.T[0], q.T[0], w), lerp(p.T[1], q.T[1], w), 0], s: lerp(p.s, q.s, w) };
  }
  function halfState(o, cut, k, u) {
    const e3 = 1 - Math.pow(1 - Math.min(1, u * 3), 3), push = 0.12 * e3 + 1.2 * u, sp = cut.sep;
    const zl = M3.apT(cut.R0, [0, 0, 1]);
    let ax = cross(cut.nl, zl); ax = Math.hypot(ax[0], ax[1], ax[2]) < 1e-3 ? [1, 0, 0] : nrm(ax);
    const Rs = M3.mul(M3.axis(ax, -k * (1.3 * u + 1.1 * u * u)), M3.z(k * 0.5 * u));
    const pl = nrm([cut.nl[0], cut.nl[1], 0]), r = o.rad * 0.45 * k, pv = [pl[0] * r, pl[1] * r, 0], rp = M3.ap(Rs, pv);
    const off = M3.ap(cut.R0, [pv[0] - rp[0], pv[1] - rp[1], 0 - rp[2]]);
    return {
      R: M3.mul(cut.R0, Rs), s: cut.s, plane: cut.plane, side: k,
      T: [cut.T0[0] + sp[0] * push * k + off[0] * cut.s, cut.T0[1] + sp[1] * push * k + 1.4 * u - 15 * u * u + off[1] * cut.s, cut.T0[2] + k * 0.8 * u + off[2] * cut.s],
      heat: 0.95 * Math.pow(1 - clamp(u / 0.32), 2)
    };
  }

  /* ---------- 布局 ---------- */
  function layout() {
    VW = stage.clientWidth || innerWidth; VH = stage.clientHeight || innerHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, VW < 768 || coarse ? 1 : 1.5);
    starts = []; total = 0;
    BL.forEach((l) => { starts.push(total); total += l * VH; });
    track.style.height = Math.round(total + VH) + 'px';
    trackTop = track.getBoundingClientRect().top + window.scrollY;
    R.size(VW, VH, dpr);
    fxc.width = Math.round(VW * dpr); fxc.height = Math.round(VH * dpr);
    // 首屏物体的位置：宽屏在右侧，窄屏放在文字下面
    const hr = heroIn.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    if (VW >= 900) hero = { x: VW * (VW > 1200 ? 0.75 : 0.73), y: VH * 0.6, s: VW > 1200 ? 0.8 : 0.66 };
    else {
      const top = hr.bottom - sr.top + 8, bot = VH - (VW < 700 ? 74 : 48), room = Math.max(120, bot - top);
      hero = { x: VW / 2, y: top + room / 2, s: Math.min(1, room * 0.9 / Math.min(VH * 0.58, VW * 0.76)) * 0.92 };
    }
    // 每拍的刀：从哪儿划到哪儿、什么时候切到底
    for (let j = 1; j <= 4; j++) {
      const L = lines[j] = lineThrough(VW / 2, VH / 2, ANG[j]);
      if (!objs[j]) continue;
      const rpx = objs[j].rad * sObj(j) * R.pxPerUnit();
      cutA[j] = A0 + clamp((L.tc + rpx * 0.85) / L.len) * (A1 - A0);
      const p = prePose(j, cutA[j]);
      cutS[j] = makeCut(p, VW / 2 - L.dx * 100, VH / 2 - L.dy * 100, VW / 2 + L.dx * 100, VH / 2 + L.dy * 100);
    }
    // 卡片太高就整体缩一点
    const top = VW < 700 ? 60 : 76, bot = VW < 700 ? 52 : 40;
    panels.forEach((P) => {
      if (!P) return;
      P.panel.style.setProperty('--fit', 1);
      const h = P.panel.offsetHeight, f = Math.min(1, (VH - top - bot) / h);
      P.panel.style.setProperty('--fit', f.toFixed(3));
      P.panel.style.setProperty('--dy', ((top - bot) / 2).toFixed(0) + 'px');
    });
  }

  /* ---------- 2D 特效：刀光、火花、碎屑、指尖划痕 ---------- */
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const at = (L, h) => [L.x0 + L.dx * L.len * h, L.y0 + L.dy * L.len * h];
  function blade(L, hd, hb, onDark, al) {
    const [x1, y1] = at(L, hd), [x2, y2] = at(L, hb), len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2 || al <= 0) return;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, nx = -uy, ny = ux;
    const strip = (w, c0, c1) => {
      const g = fx.createLinearGradient(x1, y1, x2, y2); g.addColorStop(0, c0); g.addColorStop(1, c1);
      fx.fillStyle = g; fx.beginPath(); fx.moveTo(x1, y1);
      fx.lineTo(x2 + nx * w, y2 + ny * w); fx.quadraticCurveTo(x2 + ux * w * 2.2, y2 + uy * w * 2.2, x2 - nx * w, y2 - ny * w); fx.closePath(); fx.fill();
    };
    fx.save();
    if (onDark) {
      fx.globalCompositeOperation = 'lighter';
      strip(18, 'rgba(255,120,40,0)', `rgba(255,150,70,${0.22 * al})`);
      strip(6, 'rgba(255,200,150,0)', `rgba(255,225,190,${0.55 * al})`);
      strip(1.4, 'rgba(255,255,255,0)', `rgba(255,255,255,${al})`);
      const g = fx.createRadialGradient(x2, y2, 0, x2, y2, 34);
      g.addColorStop(0, `rgba(255,250,240,${0.9 * al})`); g.addColorStop(0.25, `rgba(255,190,120,${0.35 * al})`); g.addColorStop(1, 'rgba(255,120,40,0)');
      fx.fillStyle = g; fx.fillRect(x2 - 34, y2 - 34, 68, 68);
    } else {
      strip(5, 'rgba(20,20,20,0)', `rgba(20,20,20,${0.18 * al})`);
      strip(1.2, 'rgba(20,20,20,0)', `rgba(15,15,15,${0.95 * al})`);
    }
    fx.restore();
  }
  function flash(L, u, onDark) {
    const a = 1 - u / 0.16;
    if (a <= 0 || !onDark) return;
    fx.save(); fx.globalCompositeOperation = 'lighter';
    const [x1, y1] = at(L, 0), [x2, y2] = at(L, 1);
    fx.strokeStyle = `rgba(255,214,170,${0.09 * a})`; fx.lineWidth = 18 * (1 + u * 2.5); fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
    fx.strokeStyle = `rgba(255,248,236,${0.7 * a})`; fx.lineWidth = 1.2; fx.stroke();
    fx.restore();
  }
  function sparks(seed, L, cx, cy, rpx, u, onDark, crumb) {
    const r = rnd(seed * 977 + 13);
    fx.save(); fx.lineCap = 'round';
    fx.globalCompositeOperation = onDark ? 'lighter' : 'source-over';
    for (let k = 0; k < 46; k++) {
      const s0 = (r() * 2 - 1) * rpx * 0.95, launch = (s0 / rpx + 1) * 0.02, life = 0.1 + r() * 0.3;
      const sp = 450 + r() * 1000, sd = (r() - 0.5) * 2;
      const vx = L.dx * sp - L.dy * sd * 420, vy = L.dy * sp + L.dx * sd * 420 - 160;
      const age = u - launch;
      if (age <= 0 || age > life) continue;
      const x0 = cx + L.dx * s0, y0 = cy + L.dy * s0, x = x0 + vx * age, y = y0 + vy * age + 1300 * age * age, tv = age / life;
      fx.strokeStyle = onDark ? `rgba(255,${235 - 140 * tv | 0},${190 - 170 * tv | 0},${1 - tv})` : `rgba(${200 - 80 * tv | 0},${70 - 40 * tv | 0},20,${1 - tv})`;
      fx.lineWidth = 1.7 - tv;
      fx.beginPath(); fx.moveTo(x - vx * 0.02, y - (vy + 2600 * age) * 0.02); fx.lineTo(x, y); fx.stroke();
    }
    fx.globalCompositeOperation = 'source-over';
    for (let k = 0; k < 18; k++) {
      const s0 = (r() * 2 - 1) * rpx * 0.8, vx = -L.dy * (r() - 0.5) * 520 + L.dx * (r() - 0.3) * 260, vy = L.dx * (r() - 0.5) * 520 - 260 - r() * 200;
      const sz = 2 + r() * 4.5, spin = (r() - 0.5) * 30, col = crumb[k % 2], age = u - 0.02;
      if (age <= 0 || age > 0.6) continue;
      const x = cx + L.dx * s0 + vx * age, y = cy + L.dy * s0 + vy * age + 1700 * age * age;
      fx.globalAlpha = 1 - sm(0.35, 0.6, age);
      fx.save(); fx.translate(x, y); fx.rotate(spin * age); fx.fillStyle = col;
      fx.beginPath(); fx.moveTo(-sz, -sz * 0.4); fx.lineTo(sz * 0.7, -sz * 0.6); fx.lineTo(sz * 0.4, sz * 0.7); fx.closePath(); fx.fill();
      fx.restore();
    }
    fx.restore();
  }
  function drawTrail(t, onDark) {
    while (trail.length && t - trail[0].t > 220) trail.shift();
    if (trail.length < 2) return false;
    fx.save(); fx.lineCap = 'round'; fx.globalCompositeOperation = onDark ? 'lighter' : 'source-over';
    for (let k = 1; k < trail.length; k++) {
      const a = trail[k - 1], b = trail[k], sp = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1, b.t - a.t);
      const al = clamp((sp - 0.5) / 1.2) * (1 - (t - b.t) / 220);
      if (al <= 0) continue;
      fx.strokeStyle = onDark ? `rgba(255,236,214,${al})` : `rgba(18,18,18,${al * 0.9})`;
      fx.lineWidth = 0.6 + 2.6 * (k / trail.length) * al;
      fx.beginPath(); fx.moveTo(a.x, a.y); fx.lineTo(b.x, b.y); fx.stroke();
    }
    fx.restore();
    return true;
  }

  /* ---------- 每一帧 ---------- */
  function beatAt(p) {
    p = clamp(p, 0, total - 0.01);
    let i = 0; while (i < 4 && p >= starts[i + 1]) i++;
    return { i, f: (p - starts[i]) / (BL[i] * VH) };
  }
  function render(t) {
    const ts = t / 1000, { i, f } = beatAt(cur);
    let busy = false;
    R.clear();
    fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, VW, VH);
    const darkO = i === 0 ? sm(0.62, 0.93, f) : 1, onDark = darkO > 0.5;
    cuttable = null;
    let shadowOn = 0, heroC = null;

    for (let j = 1; j <= 4; j++) {
      const o = objs[j];
      if (!o) continue;
      let pre = null, u = -1, cut = null, a = -1;
      const ea = early[j];
      if (ea && (i < j - 1 || (i === j - 1 && j > 1 && f < 0.85))) early[j] = null;
      if (j === 1 && i === 0) {
        const w = sm(0.6, 1, f), hv = heroPose(ts, t);
        pre = blend(hv, prePose(1, 0), w);
        if (w < 1 && !document.hidden) busy = true;
      } else if (j >= 2 && i === j - 1 && f > 0.85) {
        pre = tossPose(j, 0.75 * (f - 0.85) / 0.15);
      } else if (i === j) {
        a = Math.min(1, f / 0.4);
        if (j >= 2 && a < 0.1) pre = tossPose(j, 0.75 + 0.25 * a / 0.1);
        else if (a < cutA[j]) pre = prePose(j, a);
        else { cut = cutS[j]; u = (a - cutA[j]) / (1 - cutA[j]); }
      } else if (i > j) u = 2;
      else continue;
      const E = early[j];
      let L = lines[j];
      if (E) {
        const ue = (t - E.t0) / 950;
        if (ue < 1.6) busy = true;
        cut = E.cut; L = E.L; u = Math.max(u, ue);
        if (j === 1 && i === 0 && ue > 1.35) { early[1] = null; heroToss0 = t; busy = true; continue; }
      }
      if (pre && !E) {
        R.draw(o, { R: M3.euler(pre.e), T: pre.T, s: pre.s });
        const c = R.project(pre.T), rpx = o.rad * pre.s * R.pxPerUnit();
        if (c[1] < VH + rpx * 0.5) cuttable = { j, pose: pre, c, rpx };
        if (j === 1 && i === 0) { heroC = { c, rpx }; shadowOn = 1 - darkO; }
      } else if (cut && u >= 0 && u < 1.05) {
        R.draw(o, halfState(o, cut, 1, u)); R.draw(o, halfState(o, cut, -1, u));
        const c = R.project(cut.T0), rpx = o.rad * cut.s * R.pxPerUnit();
        if (u < 0.2) flash(L, u, onDark);
        if (u < 0.7) sparks(j, L, c[0], c[1], rpx, u, onDark, o.crumb);
      }
      // 跟着滚动的刀光（被指尖提前切开时就不再划）
      if (i === j && !E && a > A0 - 0.01 && a < A1 + LAG + 0.01) {
        const hd = (x) => clamp((x - A0) / (A1 - A0));
        blade(L, hd(a - LAG * dir), hd(a), onDark, 1);
      }
    }
    if (drawTrail(t, onDark)) busy = true;

    // 首屏文字、阴影、背景明暗
    const hw = i === 0 ? clamp((f - 0.58) / 0.16) : 1;
    heroBeat.classList.toggle('off', hw >= 1);
    setS(heroIn, 'opacity', (1 - hw).toFixed(3));
    setS(heroIn, 'transform', `translate3d(0,${(-hw * 60).toFixed(1)}px,0)`);
    setS(dark, 'opacity', darkO.toFixed(3));
    if (ui.theme !== onDark) { ui.theme = onDark; root.dataset.theme = onDark ? 'dark' : 'light'; }
    if (heroC) {
      setS(hint, 'opacity', (1 - sm(0.45, 0.7, f)).toFixed(3));
      setS(hint, 'transform', `translate3d(${heroC.c[0].toFixed(0)}px,${Math.min(VH - (VW < 700 ? 62 : 36), heroC.c[1] + heroC.rpx * 1.02 + 22).toFixed(0)}px,0) translateX(-50%)`);
      setS(shadow, 'opacity', (shadowOn * 0.9).toFixed(3));
      setS(shadow, 'transform', `translate3d(${heroC.c[0].toFixed(0)}px,${(heroC.c[1] + heroC.rpx * 1.05).toFixed(0)}px,0) translate(-50%,-50%) scale(${(heroC.rpx / 100).toFixed(3)})`);
    } else { setS(hint, 'opacity', '0'); setS(shadow, 'opacity', '0'); }

    // 卡片：从切口里展开 → 停住 → 合上
    let cuts = 0;
    for (let j = 1; j <= 4; j++) {
      let k = 0, ex = 0;
      if (i === j) {
        const a = f / 0.4;
        k = f < 0.4 ? clamp((a - 0.44) / 0.52) : 1;
        if (j < 4 && f > 0.85) ex = (f - 0.85) / 0.15;
        if (early[j]) k = Math.max(k, clamp(((t - early[j].t0) / 950 - 0.2) / 0.55));
      }
      if (i > j || (i === j && f / 0.4 >= cutA[j]) || early[j]) cuts++;
      panel(j, k, ex, early[j] ? early[j].ang : ANG[j]);
    }
    if (ui.cuts !== cuts) { ui.cuts = cuts; cutN.textContent = cuts; }
    if (ui.beat !== i) {
      ui.beat = i; railNow.textContent = pad2(i + 1);
      railBtns.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    return busy;
  }
  function panel(j, k, ex, ang) {
    const P = panels[j];
    const key = k.toFixed(3) + '|' + ex.toFixed(3) + '|' + ang;
    if (P.last === key) return;
    P.last = key;
    const on = k > 0.001 && ex < 0.999;
    P.el.classList.toggle('on', on);
    if (!on) return;
    let deg = ang * 180 / Math.PI; if (deg > 90) deg -= 180; if (deg < -90) deg += 180;
    const rot = deg * (1 - sm(0.1, 0.62, k));
    const sy = Math.max(0.004, 1 - Math.pow(1 - sm(0.12, 0.72, k), 3)) * (1 - sm(0.04, 0.5, ex));
    P.bg.style.opacity = sm(0.04, 0.16, k).toFixed(3);
    P.bg.style.transform = `rotate(${rot.toFixed(2)}deg) scale(${(0.9 + 0.1 * sm(0.1, 0.7, k)).toFixed(3)},${sy.toFixed(4)})`;
    P.slit.style.opacity = (sm(0, 0.08, k) * (1 - sm(0.3, 0.55, k)) + sm(0.3, 0.5, ex) * (1 - sm(0.5, 0.75, ex))).toFixed(3);
    P.slit.style.transform = `rotate(${rot.toFixed(2)}deg) scaleX(${(0.25 + 0.75 * sm(0, 0.32, k)).toFixed(3)})`;
    const fade = 1 - sm(0, 0.3, ex);
    P.items.forEach(([el, n]) => {
      const v = sm(0.4 + n * 0.04, 0.7 + n * 0.04, k);
      el.style.opacity = (v * fade).toFixed(3);
      el.style.transform = `translate3d(0,${((1 - v) * 18 - ex * 24).toFixed(1)}px,0)`;
    });
    P.nums.forEach((b) => { b.textContent = Math.round(+b.dataset.n * sm(0.5, 0.95, k)); });
  }

  /* ---------- 循环：只有需要动的时候才跑 ---------- */
  function frame(t) {
    raf = 0; lastFrame = t;
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    cur += (target - cur) * (1 - Math.exp(-dt / 0.055));
    if (Math.abs(target - cur) < 0.6) cur = target;
    let busy = false;
    try { busy = cur > total + VH + 50 ? false : render(t); } catch (e) { flat(); return; } // 舞台整个滚出视口就不画；出错就退回普通页面
    if ((busy || cur !== target) && !document.hidden) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function kick() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    clearTimeout(fbT);
    // 后台标签页里 rAF 不跑：直接放到终点
    fbT = setTimeout(() => { if (performance.now() - lastFrame > 250) { cur = target; render(performance.now()); } }, 300);
  }
  function onScroll() {
    const y = dbgAt == null ? window.scrollY - trackTop : typeof dbgAt === 'string' ? starts[+dbgAt] + (+dbgAt === 0 ? 0 : 0.62 * BL[+dbgAt] * VH) : dbgAt;
    if (y > target) dir = 1; else if (y < target) dir = -1;
    target = y; kick();
  }

  /* ---------- 彩蛋：指尖/鼠标快速划过物体 = 提前切开 ---------- */
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect(), now = performance.now();
    trail.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: now });
    if (trail.length > 30) trail.shift();
    kick();
    if (!cuttable || early[cuttable.j]) return;
    const b = trail[trail.length - 1];
    let a = null;
    for (let k = trail.length - 2; k >= 0; k--) { if (now - trail[k].t > 130) break; a = trail[k]; }
    if (!a) return;
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
    if (d < 70 || d / Math.max(1, b.t - a.t) < 0.9) return;
    const { c, rpx, pose, j } = cuttable;
    const tt = clamp(((c[0] - a.x) * dx + (c[1] - a.y) * dy) / (d * d)), px = a.x + dx * tt, py = a.y + dy * tt;
    if (Math.hypot(c[0] - px, c[1] - py) > rpx * 0.7) return;
    const ang = Math.atan2(dy, dx);
    early[j] = { t0: now, ang, cut: makeCut(pose, a.x, a.y, b.x, b.y), L: lineThrough(px, py, ang) };
    kick();
  }, { passive: true });

  /* ---------- 进度刻度 / 跳转 ---------- */
  function goBeat(j) {
    const y = trackTop + starts[j] + (j === 0 ? 0 : 0.62 * BL[j] * VH);
    window.scrollTo({ top: Math.round(y), behavior: 'smooth' });
    const h = $('h1,h2', beats[j]);
    if (h) { h.setAttribute('tabindex', '-1'); setTimeout(() => h.focus({ preventScroll: true }), 1100); }
  }
  $$('[data-go]').forEach((b) => b.addEventListener('click', (e) => {
    if (!root.classList.contains('st')) return;
    e.preventDefault(); goBeat(+b.dataset.go);
  }));

  function flat() {
    root.classList.remove('st');
    cancelAnimationFrame(raf); raf = 0;
    window.removeEventListener('scroll', onScroll);
    $$('[style]', stage).forEach((el) => { el.removeAttribute('style'); });
    track.removeAttribute('style'); beats.forEach((b) => b.classList.remove('on', 'off'));
    panels.forEach((P) => P && P.nums.forEach((b) => { b.textContent = b.dataset.n; }));
  }
  $('#gl').addEventListener('webglcontextlost', flat);
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  if (rmq.addEventListener) rmq.addEventListener('change', (e) => { if (e.matches) flat(); });

  /* ---------- 启动 ---------- */
  let lw = 0, lh = 0;
  function relayout(force) {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!force && w === lw && Math.abs(h - lh) < 2) return;
    lw = w; lh = h; layout(); onScroll(); cur = target; kick();
  }
  window.addEventListener('resize', () => relayout(false));
  window.addEventListener('scroll', onScroll, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });
  try { relayout(true); } catch (e) { flat(); return; }
  const q = new URLSearchParams(location.search).get('at');
  if (q) {
    const m = /^b([0-4])$/.exec(q), y = parseFloat(q);
    if (m || !isNaN(y)) { dbgAt = m ? m[1] : y; onScroll(); cur = target; } // 调试：不真的滚动，直接把舞台放到这个进度（无头截图用）
  }
  kick();

  // 贴图要用宋体：等字体（最多 1.8 秒）和小智头像就绪再造物体
  const zhi = new Image();
  const imgReady = new Promise((ok) => { zhi.onload = zhi.onerror = ok; zhi.src = '../shared/img/ip/zhi-flat.webp'; });
  const fontReady = document.fonts && document.fonts.load
    ? Promise.all(['900 40px "SHU Serif"', '400 12px "SHU Serif"', '400 12px "Geist Mono"'].map((s) => document.fonts.load(s, LABEL.join('') + '上海大学人工智能社通信与信息工程学院团委焊接课成立年'))).catch(() => 0)
    : Promise.resolve();
  Promise.race([Promise.all([imgReady, fontReady]), new Promise((ok) => setTimeout(ok, 1800))]).then(() => {
    try {
      window.SliceGL.Q = VW < 768 || matchMedia('(pointer: coarse)').matches ? 0.5 : 1;
      objs[1] = OBJ.chip(R, LABEL[1]);
      objs[2] = OBJ.pcb(R, LABEL[2]);
      objs[3] = OBJ.badge(R, LABEL[3], zhi.complete && zhi.naturalWidth ? zhi : null);
      objs[4] = OBJ.lid(R, LABEL[4]);
    } catch (e) { flat(); return; }
    heroToss0 = q ? -1 : performance.now();
    try { relayout(true); } catch (e) { flat(); return; }
    // 入场抛起靠 rAF；2.5 秒后不管怎样都放到最终位置
    setTimeout(() => { heroToss0 = -1; cur = target; render(performance.now()); kick(); }, 2500);
  });
})();
