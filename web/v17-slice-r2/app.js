/* v17-slice-r2 · app.js —— 内容渲染 + 吸顶舞台（滑动 = 一刀）+ 首屏切水果 + 页底战利品彩蛋
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


  /* ================= 2. 战利品（这一次会话里切下的东西，存 sessionStorage） ================= */
  const LOOT_KEY = 'shuai-v17r2-loot';
  // best = 这一趟的最高连击；peak = 这一趟到过的最高得分；multi = 一刀最多切中几个
  let loot = { seq: [], score: 0, best: 0, peak: 0, multi: 0, bombs: 0, hand: 0 };
  try {
    const s = JSON.parse(sessionStorage.getItem(LOOT_KEY) || 'null');
    if (s && Array.isArray(s.seq)) loot = Object.assign(loot, s);
  } catch (e) { /* 读不到就从零开始 */ }
  /* 本机最佳：存在这台设备的浏览器里（localStorage），存不了也照常能玩 */
  const REC_KEY = 'shuai-v17r2-records';
  let rec = { best: 0, combo: 0, runs: [] };
  try {
    const s = JSON.parse(localStorage.getItem(REC_KEY) || 'null');
    if (s && Array.isArray(s.runs)) rec = { best: +s.best || 0, combo: +s.combo || 0, runs: s.runs.filter((r) => r && typeof r.s === 'number' && r.id).slice(0, 5) };
  } catch (e) { /* 读不到就当没有纪录 */ }
  if (!loot.id) loot.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  if (!loot.base) loot.base = { s: rec.best, c: rec.combo }; // 这一趟开始之前的纪录：超过它才算"破纪录"
  function saveRec() {
    if (loot.peak <= 0 && loot.best <= 0) return;
    if (!loot.t0) loot.t0 = Date.now();
    const me = { id: loot.id, s: loot.peak, c: loot.best, m: loot.multi || 0, t: loot.t0 };
    rec.runs = rec.runs.filter((r) => r.id !== loot.id);
    rec.runs.push(me);
    rec.runs.sort((a, b) => b.s - a.s || b.c - a.c || a.t - b.t);
    rec.runs = rec.runs.slice(0, 5);
    rec.best = Math.max(rec.best, loot.peak); rec.combo = Math.max(rec.combo, loot.best);
    try { localStorage.setItem(REC_KEY, JSON.stringify(rec)); } catch (e) { /* 存不了也不影响玩 */ }
  }
  function saveLoot() {
    saveRec();
    try { sessionStorage.setItem(LOOT_KEY, JSON.stringify(loot)); } catch (e) { /* 存不了也不影响玩 */ }
    lootChanged();
  }
  // how: hand = 亲手切的；scroll = 往下滑时自动切开的；bomb = 切到的炸弹
  function addLoot(k, how) {
    const idx = loot.seq.findIndex((x) => x.k === k);
    let it = idx >= 0 ? loot.seq[idx] : null;
    if (how === 'scroll') { if (!it) { loot.seq.push({ k, n: 1, how }); saveLoot(); } return; }
    if (it && it.how === 'scroll') { loot.seq.splice(idx, 1); it = null; }
    if (!it) { it = { k, n: 0, how }; loot.seq.push(it); }
    it.n++;
    if (how === 'hand') loot.hand++;
    saveLoot();
  }

  /* ================= 3. 吸顶舞台 ================= */
  const lootSec = $('#loot');
  if (!root.classList.contains('st') || !window.SliceGL) { root.classList.remove('st'); return; }
  const { Renderer, M3, OBJ } = window.SliceGL;
  const stage = $('#stage'), track = $('#track'), fxc = $('#fx'), lzc = $('#lz');
  let R, fx, lzx;
  try { R = new Renderer($('#gl')); fx = fxc.getContext('2d'); lzx = lzc.getContext('2d'); if (!fx || !lzx) throw 0; } catch (e) { root.classList.remove('st'); return; }

  const BL = [1.25, 2.2, 2.2, 2.2, 2.0];            // 每拍长度（屏高的倍数）
  const ANG = [0, 0.38, -0.3, Math.PI - 0.14, 0.62]; // 每拍刀的方向（屏幕坐标，y 向下）
  const EXA = [0, -0.22, 0.3, -0.4];                 // 每张卡片离场时被切的方向
  const BASE = [null, { pitch: -0.62, yaw: 0.4, roll: -0.12 }, { pitch: -0.72, yaw: -0.32, roll: 0.07 }, { pitch: -0.32, yaw: 0.4, roll: -0.05 }, { pitch: -0.66, yaw: -0.38, roll: 0.1 }];
  const LABEL = [null, '平时做什么', '做过的事', '谁在带大家', '加入'];
  const A0 = 0.06, A1 = 0.36, LAG = 0.07;          // 刀光在动作段里的起止
  const HERO_TH = -0.17;                            // 首屏被切开的方向
  const beats = $$('.beat', stage);
  const heroBeat = beats[0], heroIn = $('.hero', heroBeat), hint = $('#hint'), paperA = $('#paperA'), paperB = $('#paperB');
  const cutN = $('#cutN'), bestN = $('#bestN'), bestBox = $('#bestBox'), railNow = $('#railNow'), railBtns = $$('#rail button');
  const EX0 = 0.8, EXH = 0.36;                      // 卡片离场：从这一拍的 80% 开始；前 36% 是激光切过去，之后两半分开
  const LZ0 = 0.25, LZD = 0.15;                     // 首屏激光：从 25% 走到 40%，之后整张纸分开

  // 克隆一份"静态"的界面，用来做被切成两半的效果（去掉 id、不可聚焦、读屏不读）
  function ghost(el) {
    const c = el.cloneNode(true);
    c.removeAttribute('id');
    $$('[id]', c).forEach((x) => x.removeAttribute('id'));
    $$('[data-i]', c).forEach((x) => x.removeAttribute('data-i'));
    $$('[data-n]', c).forEach((x) => x.removeAttribute('data-n'));
    $$('[data-go]', c).forEach((x) => x.removeAttribute('data-go'));
    $$('img', c).forEach((x) => x.setAttribute('loading', 'eager'));
    c.setAttribute('aria-hidden', 'true'); c.setAttribute('inert', '');
    return c;
  }
  const panels = beats.map((b) => {
    const p = $('.panel', b);
    if (!p) return null;
    const halves = [1, -1].map(() => {
      const h = document.createElement('div');
      h.className = 'panel__half'; h.setAttribute('aria-hidden', 'true'); h.setAttribute('inert', '');
      h.appendChild(ghost($('.panel__bg', p))); h.appendChild(ghost($('.panel__in', p)));
      p.appendChild(h);
      return h;
    });
    return { el: b, panel: p, halves, items: $$('[data-i]', p).map((x) => [x, +x.dataset.i]), nums: $$('[data-n]', p), last: '', glow: null, w: 1, h: 1, sx: 0, sy: 0, fit: 1 };
  });
  const heroHalves = [1, -1].map(() => {
    const h = ghost(heroBeat);
    h.classList.add('hero-half');
    const hn = $('.hint', h); if (hn) hn.remove();
    heroBeat.after(h);
    return h;
  });

  const objs = [], early = [], trail = [];
  let VW = 0, VH = 0, dpr = 1, trackTop = 0, total = 0, starts = [], cutA = [], cutS = [], lines = [];
  let target = 0, cur = 0, dir = 1, raf = 0, lastT = 0, lastFrame = 0, fbT = 0, dbgAt = null, cuttable = null;
  let zones = [], HS = null, scrollCut = [];
  const domCache = new Map(), ui = {};
  const setS = (el, k, v) => { let o = domCache.get(el); if (!o) domCache.set(el, o = {}); if (o[k] !== v) { o[k] = v; el.style[k] = v; } };
  const rand = (a, b) => a + Math.random() * (b - a);

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const normAng = (a) => { while (a > Math.PI / 2) a -= Math.PI; while (a <= -Math.PI / 2) a += Math.PI; return a; };
  const segDist = (px, py, a, b) => {
    const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy || 1, t = clamp(((px - a.x) * dx + (py - a.y) * dy) / l2);
    return Math.hypot(px - a.x - dx * t, py - a.y - dy * t);
  };
  // 半平面（clip-path 多边形）：过 (cx,cy)、方向 th 的直线，k=+1 取法线正侧
  const halfPoly = (cx, cy, th, k, L) => {
    const d = [Math.cos(th), Math.sin(th)], n = [-d[1] * k, d[0] * k];
    const P = [[cx - d[0] * L, cy - d[1] * L], [cx + d[0] * L, cy + d[1] * L], [cx + d[0] * L + n[0] * L, cy + d[1] * L + n[1] * L], [cx - d[0] * L + n[0] * L, cy - d[1] * L + n[1] * L]];
    return 'polygon(' + P.map((p) => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ')';
  };

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
  // 半边绕切口附近的一根轴翻开：返回旋转和因为换了转轴带来的位移
  function hinge(cut, k, th, tz, o) {
    const zl = M3.apT(cut.R0, [0, 0, 1]);
    let ax = cross(cut.nl, zl); ax = Math.hypot(ax[0], ax[1], ax[2]) < 1e-3 ? [1, 0, 0] : nrm(ax);
    const Rs = M3.mul(M3.axis(ax, -k * th), M3.z(k * tz));
    const pl = nrm([cut.nl[0], cut.nl[1], 0]), r = o.rad * 0.45 * k, pv = [pl[0] * r, pl[1] * r, 0], rp = M3.ap(Rs, pv);
    const off = M3.ap(cut.R0, [pv[0] - rp[0], pv[1] - rp[1], 0 - rp[2]]);
    return { R: M3.mul(cut.R0, Rs), off: [off[0] * cut.s, off[1] * cut.s, off[2] * cut.s] };
  }

  /* ---------- 每一拍物体的姿态（跟着滚动） ---------- */
  function prePose(j, a) {
    const b = BASE[j], dr = Math.max(0, a - 0.1);
    return { e: { pitch: b.pitch, yaw: b.yaw + 0.5 * dr, roll: b.roll - 0.2 * dr }, T: [0, 0, 0], s: sObj(j) };
  }
  function tossPose(j, tau) {
    const b = BASE[j], w = (1 - tau) * (1 - tau), s = sObj(j), sg = j % 2 ? 1 : -1;
    const y0 = R.unproject(0, VH * 1.25, 0)[1] - objs[j].span * s * 0.6;
    return { e: { pitch: b.pitch + 1.0 * w, yaw: b.yaw - 0.8 * w * sg, roll: b.roll + 2.4 * w * sg }, T: [0.4 * w * sg, y0 * w, 0], s };
  }
  function halfState(o, cut, k, u) {
    const e3 = 1 - Math.pow(1 - Math.min(1, u * 3), 3), push = 0.12 * e3 + 1.2 * u, sp = cut.sep;
    const h = hinge(cut, k, 1.3 * u + 1.1 * u * u, 0.5 * u, o);
    return {
      R: h.R, s: cut.s, plane: cut.plane, side: k,
      T: [cut.T0[0] + sp[0] * push * k + h.off[0], cut.T0[1] + sp[1] * push * k + 1.4 * u - 15 * u * u + h.off[1], cut.T0[2] + k * 0.8 * u + h.off[2]],
      heat: 0.95 * Math.pow(1 - clamp(u / 0.32), 2)
    };
  }

  const SERIF = '"SHU Serif", "Noto Serif SC", serif', MONO = '"Geist Mono", ui-monospace, monospace';
  /* ================= 4. 首屏切水果：物件清单（全部对应社团真实内容） ================= */
  const KIND = {
    pcb: { name: '焊好的电路板', cat: '板子', px: 210, w: 3, pose: 'board', mk: () => OBJ.pcb(R, '焊接课') },
    dev: { name: '开发板', cat: '板子', px: 205, w: 3, pose: 'board', mk: () => OBJ.dev(R, '嵌入式') },
    sonar: { name: '超声波测距模块', cat: '板子', px: 175, w: 2, pose: 'board', mk: () => OBJ.sonar(R) },
    chip: { name: 'FPGA 芯片', cat: '芯片', px: 150, w: 2, pose: 'board', mk: () => OBJ.chip(R, 'FPGA') },
    lid: { name: '昇腾芯片', cat: '芯片', px: 150, w: 2, pose: 'board', mk: () => OBJ.lid(R, '昇腾') },
    badge: { name: '参访工牌', cat: '板子', px: 165, w: 1, pose: 'badge', mk: () => OBJ.badge(R, '企业参访', zhi.complete && zhi.naturalWidth ? zhi : null) },
    ecap: { name: '电解电容', cat: '元件', px: 105, w: 1, pose: 'can', mk: () => OBJ.ecap(R) },
    res: { name: '1kΩ 电阻', cat: '元件', px: 150, w: 1, pose: 'lying', mk: () => OBJ.res(R) },
    led: { name: 'LED', cat: '元件', px: 85, w: 1, pose: 'can', mk: () => OBJ.led(R) },
    bomb: { name: '短路炸弹', cat: '炸弹', px: 112, w: 0, pose: 'bomb', mk: () => OBJ.bomb(R) }
  };
  [1, 2, 3, 4].forEach((j) => { KIND['b' + j] = { name: ['', '芯片 · 平时做什么', '电路板 · 做过的事', '工牌 · 谁在带大家', '昇腾方块 · 加入'][j], cat: '滑开', pose: 'board', beat: j, mk: () => objs[j] }; });
  // 词条：都出自 content.js（部门名直接从里面读）
  const WORDS = [
    ['电路焊接', '课程'], ['昇腾', '课程'], ['MindSpore', '课程'], ['Transformer', '课程'], ['BERT 微调', '课程'], ['深度估计', '课程'],
    ['鸿蒙', '参访'], ['鲲鹏', '参访'], ['全联接大会', '参访'], ['创新大赛', '大赛'], ['焊接专项赛', '大赛'], ['AI 分享会', '分享'],
    ['FPGA', '方向'], ['集成电路', '方向'], ['从零开始', '加入'], ['面向全校', '加入'], ['主题团日', '活动'], ['608 创客空间', '地点'], ['翔英大楼', '地点']
  ].concat(DEP.map((d) => [d.name, '部门']));
  WORDS.forEach(([t, c], k) => {
    const style = c === '部门' ? 1 : c === '课程' ? 2 : k % 3 === 0 ? 1 : 0;
    KIND['w:' + t] = { name: t, cat: '词条', sub: c, w: 0.6, pose: 'word', word: true, mk: () => OBJ.word(R, t, style, c) };
  });
  const built = new Map();
  function getObj(k) {
    const K = KIND[k];
    if (!K) return null;
    if (K.beat) return objs[K.beat] || null;
    let o = built.get(k);
    if (!o) { o = K.mk(); built.set(k, o); }
    return o;
  }

  /* ---------- 游戏状态 ---------- */
  // combo = 连击：连续切中、中间没有任何一个能切的东西从下面掉出去；漏一个或切到炸弹就断
  // sw = 这一刀（手没停下来的一次划动）切中了几个 → 一刀多切，单独给分
  const G = { items: [], halves: [], parts: [], slashes: [], pops: [], miss: [], boom: null, shake: null, gt: 0, next: 0.2, n: 0, stopUntil: 0, combo: 0, comboAt: 0, sw: null, brk: null, cele: null, cx: 0, cy: 0, ready: false, sliced: false, flakeAt: 0 };
  const COMBO_STEP = 5, COMBO_BONUS = 5;           // 每连到 5 的倍数，额外 +5
  const GRAV = () => VH * 1.55;
  function sizeMul() { return VW < 700 ? 0.6 : VW < 1100 ? 0.8 : 1; }
  function pickKind() {
    const pool = [];
    let bombAlive = G.items.some((it) => it.bomb);
    if (G.forceBomb && built.has('bomb')) { G.forceBomb = false; return 'bomb'; }
    if (G.n >= 5 && !bombAlive && Math.random() < 0.13 && built.has('bomb')) return 'bomb';
    for (const k in KIND) { const K = KIND[k]; if (K.w && built.has(k)) pool.push([k, K.w]); }
    if (!pool.length) return null;
    let s = pool.reduce((a, b) => a + b[1], 0) * Math.random();
    for (const [k, w] of pool) { s -= w; if (s <= 0) return k; }
    return pool[0][0];
  }
  function spawnOne() {
    const k = pickKind();
    if (!k || !zones.length) return;
    const K = KIND[k], o = getObj(k);
    const z = rand(-0.55, 0.3), ppu = R.pxAt(z), m = sizeMul();
    const s = K.word ? (VW < 700 ? 66 : VW < 1100 ? 100 : 116) / R.pxAt(0) : K.px * m / (o.span * R.pxAt(0));
    const r = o.rad * s * ppu;
    const zone = zones.length > 1 && Math.random() < zones[1].w ? zones[1] : zones[0];
    const g = GRAV();
    const x0 = rand(zone.x0 + r * 0.5, Math.max(zone.x0 + r * 0.5 + 1, zone.x1 - r * 0.5));
    const ya = rand(zone.y0 + r * 0.6, Math.max(zone.y0 + r * 0.6 + 1, zone.y1 - r * 0.4));
    const y0 = VH + r + 12, vy = -Math.sqrt(2 * g * (y0 - ya)), tUp = -vy / g;
    const xa = clamp(x0 + rand(-0.28, 0.28) * (zone.x1 - zone.x0), zone.x0 + r * 0.6, zone.x1 - r * 0.6);
    const sg = () => (Math.random() < 0.5 ? -1 : 1);
    let e, w;
    if (K.pose === 'word') { w = { pitch: 0, yaw: rand(-0.2, 0.2), roll: rand(0.25, 0.5) * sg() }; e = { pitch: rand(-0.36, -0.22), yaw: -w.yaw * tUp, roll: -w.roll * tUp }; }
    else if (K.pose === 'can') { w = { pitch: rand(-0.4, 0.4), yaw: rand(0.6, 1.4) * sg(), roll: rand(0.5, 1.2) * sg() }; e = { pitch: rand(-1.2, -0.9) - w.pitch * tUp, yaw: rand(-0.4, 0.4), roll: rand(-1, 1) }; }
    else if (K.pose === 'lying') { w = { pitch: 0, yaw: rand(0.3, 0.8) * sg(), roll: rand(1.2, 2.4) * sg() }; e = { pitch: rand(-0.6, -0.3), yaw: rand(-0.3, 0.3), roll: rand(-1, 1) }; }
    else if (K.pose === 'bomb') { w = { pitch: 0, yaw: rand(-0.5, 0.5), roll: rand(0.6, 1.1) * sg() }; e = { pitch: -0.18, yaw: 0.1, roll: -w.roll * tUp * 0.6 }; }
    else if (K.pose === 'badge') { w = { pitch: 0, yaw: rand(0.2, 0.45) * sg(), roll: rand(0.4, 0.9) * sg() }; e = { pitch: -0.3, yaw: -w.yaw * tUp, roll: -w.roll * tUp }; }
    else { w = { pitch: rand(-0.15, 0.15), yaw: rand(0.2, 0.5) * sg(), roll: rand(0.6, 1.4) * sg() }; e = { pitch: rand(-0.65, -0.4) - w.pitch * tUp, yaw: rand(-0.25, 0.25) - w.yaw * tUp, roll: rand(-0.4, 0.4) - w.roll * tUp }; }
    G.items.push({ k, o, x: x0, y: y0, z, vx: (xa - x0) / tUp, vy, e, w, s, r, bomb: k === 'bomb' });
    G.n++;
  }
  function spawnWave() {
    const n = G.n < 2 ? 1 : 1 + (Math.random() < 0.7) + (Math.random() < 0.35);
    for (let k = 0; k < n; k++) spawnOne();
    G.next = G.gt + rand(0.75, 1.25) + (G.items.length > 7 ? 0.9 : 0);
  }
  function itemPose(it) { return { e: it.e, T: R.unproject(it.x, it.y, it.z), s: it.s }; }

  /* ---------- 粒子：火花、碎屑、烟、纸屑 ---------- */
  function burst(x, y, ux, uy, r, crumb, light, n) {
    n = n || 1;
    for (let k = 0; k < 22 * n; k++) {
      const s0 = rand(-1, 1) * r * 0.8, sp = rand(320, 900) * Math.min(1.4, n), sd = rand(-1, 1);
      G.parts.push({ t: 'spark', x: x + ux * s0, y: y + uy * s0, vx: ux * sp - uy * sd * 380, vy: uy * sp + ux * sd * 380 - 140, g: 1300, age: 0, life: rand(0.12, 0.38), light });
    }
    for (let k = 0; k < 12 * n; k++) {
      const s0 = rand(-1, 1) * r * 0.7;
      G.parts.push({ t: 'crumb', x: x + ux * s0, y: y + uy * s0, vx: -uy * rand(-1, 1) * 420 + ux * rand(-0.3, 1) * 240, vy: ux * rand(-1, 1) * 420 - rand(160, 420), g: 1700, age: 0, life: rand(0.5, 0.8), col: crumb[k % 2], sz: rand(2, 5.5) * (VW < 700 ? 0.8 : 1), rot: rand(0, 6), vr: rand(-18, 18) });
    }
  }
  function smoke(x, y, r) {
    for (let k = 0; k < 14; k++) {
      const a = rand(0, 6.28), sp = rand(40, 260);
      G.parts.push({ t: 'smoke', x: x + Math.cos(a) * r * 0.3, y: y + Math.sin(a) * r * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, g: -40, age: 0, life: rand(0.6, 1.1), sz: r * rand(0.3, 0.6) });
    }
  }
  function stepParts(dt) {
    for (let k = G.parts.length - 1; k >= 0; k--) {
      const p = G.parts[k];
      p.age += dt;
      if (p.age > p.life) { G.parts.splice(k, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'smoke') { p.vx *= 1 - 2.2 * dt; p.vy *= 1 - 2.2 * dt; }
      if (p.rot != null) p.rot += p.vr * dt;
    }
  }
  function drawParts(onDark) {
    fx.save(); fx.lineCap = 'round';
    for (const p of G.parts) {
      const tv = p.age / p.life;
      if (p.t === 'spark') {
        const dark = onDark && !p.light;
        fx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
        fx.strokeStyle = dark ? `rgba(255,${235 - 140 * tv | 0},${190 - 170 * tv | 0},${1 - tv})` : `rgba(${255 - 60 * tv | 0},${110 - 70 * tv | 0},${40 - 20 * tv | 0},${1 - tv})`;
        fx.lineWidth = 1.9 - 1.2 * tv;
        fx.beginPath(); fx.moveTo(p.x - p.vx * 0.022, p.y - p.vy * 0.022); fx.lineTo(p.x, p.y); fx.stroke();
      } else if (p.t === 'smoke') {
        fx.globalCompositeOperation = 'source-over';
        const rr = p.sz * (1 + tv * 1.8), gr = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr);
        gr.addColorStop(0, `rgba(40,36,32,${0.38 * (1 - tv)})`); gr.addColorStop(1, 'rgba(40,36,32,0)');
        fx.fillStyle = gr; fx.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
      } else {
        fx.globalCompositeOperation = 'source-over';
        fx.globalAlpha = 1 - sm(0.6, 1, tv);
        fx.save(); fx.translate(p.x, p.y); fx.rotate(p.rot); fx.fillStyle = p.col;
        const z = p.sz;
        if (p.t === 'flake') { fx.fillRect(-z, -z * 0.55, z * 2, z * 1.1); fx.fillStyle = 'rgba(20,20,20,.5)'; fx.fillRect(-z, z * 0.4, z * 2, z * 0.15); }
        else { fx.beginPath(); fx.moveTo(-z, -z * 0.4); fx.lineTo(z * 0.7, -z * 0.6); fx.lineTo(z * 0.4, z * 0.7); fx.closePath(); fx.fill(); }
        fx.restore(); fx.globalAlpha = 1;
      }
    }
    fx.restore();
  }

  /* ---------- 切到东西 ---------- */
  function pop(x, y, txt, kind, t, life) { G.pops.push({ x, y, txt, kind, t0: t, life: life || 900 }); if (G.pops.length > 16) G.pops.shift(); }
  function showBest() { bestN.textContent = Math.max(rec.best, loot.peak); }
  function setScore(v, bad) {
    loot.score = Math.max(0, v);
    cutN.textContent = loot.score;
    if (cutN.animate) cutN.animate(bad ? [{ transform: 'translateX(-4px)', color: '#d92b12' }, { transform: 'translateX(4px)', color: '#d92b12' }, { transform: 'none' }] : [{ transform: 'scale(1.7)' }, { transform: 'none' }], { duration: bad ? 320 : 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (loot.score > loot.peak) {
      loot.peak = loot.score;
      if (!loot.celeS && loot.base.s > 0 && loot.peak > loot.base.s) { loot.celeS = 1; celebrate('s'); }
    }
    showBest();
  }
  // 破本机纪录：顶栏的"本机最佳"亮一下 + 屏幕上一行大字 + 一把彩色纸屑
  function celebrate(kind) {
    const t = performance.now(), x = VW < 900 ? VW / 2 : (zones[0] ? (zones[0].x0 + zones[0].x1) / 2 : VW * 0.7), y = VH * (VW < 900 ? 0.5 : 0.34) + (G.cele && t - G.cele.t0 < 1700 ? (VW < 700 ? 96 : 120) : 0); // 两个纪录同时破：第二行往下错开
    G.cele = { t0: t, kind };
    pop(x, y, kind === 's' ? '破本机纪录！' : '最高连击 新纪录', 'r', t, 1700);
    pop(x, y + (VW < 700 ? 38 : 52), kind === 's' ? '之前最佳 ' + loot.base.s + ' 分' : '之前最多连 ' + loot.base.c + ' 个', 'rs', t + 120, 1600);
    for (let k = 0; k < 46; k++) {
      const a = rand(-Math.PI, 0), sp = rand(260, 820);
      G.parts.push({ t: 'flake', x: x + rand(-60, 60), y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, g: 1000, age: 0, life: rand(1, 1.6), col: ['#ff5b1f', '#ffd25a', '#151515', '#e7e5df'][k % 4], sz: rand(3, 6.5), rot: rand(0, 6), vr: rand(-14, 14) });
    }
    if (kind === 's' && bestBox.animate) bestBox.animate([{ transform: 'scale(1)', background: 'rgba(255,91,31,0)' }, { transform: 'scale(1.18)', background: 'rgba(255,91,31,.95)', color: '#141414' }, { transform: 'scale(1)', background: 'rgba(255,91,31,0)' }], { duration: 1400, easing: 'cubic-bezier(.2,.8,.2,1)' });
    if (kind === 's') bestBox.classList.add('is-new');
    kick();
  }
  // 连击断了：记下断在几连、为什么断，画在连击数字的位置
  function comboBreak(t, why) {
    if (G.combo >= 2) G.brk = { n: G.combo, t0: t, why };
    G.combo = 0;
  }
  // 一刀多切：这一刀结束时结算
  function settleSwipe(t) {
    const s = G.sw; G.sw = null;
    if (!s || s.n < 2) return;
    const bonus = s.n * (s.n - 1); // 2 个 +2，3 个 +6，4 个 +12
    const up = G.pops.some((p) => p.kind === 'c' && t - p.t0 < 500) ? (VW < 700 ? 40 : 52) : 0; // 刚出过"N 连击"就往上错开
    pop(s.x, s.y - 56 - up, '一刀 ' + s.n + ' 切', 'c', t);
    pop(s.x, s.y - 14 - up, '+' + bonus, 'x', t + 90);
    if (s.n > (loot.multi || 0)) loot.multi = s.n;
    G.shake = { t0: t, amp: Math.min(9, 2 + s.n * 1.5), dur: 260 };
    setScore(loot.score + bonus);
    saveLoot();
  }
  // 没切到的东西从屏幕下面掉出去了：连击断
  function missed(it, t) {
    if (!G.sliced) return; // 还没开始玩的人不提示
    G.miss.push({ x: clamp(it.x, 26, VW - 26), t0: t });
    comboBreak(t, '漏了一个');
  }
  function sliceItem(it, a, b, ux, uy, sp, t) {
    const idx = G.items.indexOf(it);
    if (idx < 0) return;
    G.items.splice(idx, 1);
    const pose = itemPose(it), cut = makeCut(pose, a.x, a.y, b.x, b.y);
    const ss = [cut.sep[0], -cut.sep[1]], kick = Math.min(420, sp * 160);
    [1, -1].forEach((k) => G.halves.push({
      o: it.o, cut, k, x: it.x, y: it.y, z: it.z, age: 0, r: it.r, bomb: it.bomb,
      vx: it.vx * 0.5 + ss[0] * k * (it.bomb ? 420 : 200) + ux * kick, vy: Math.min(it.vy, 0) * 0.3 + ss[1] * k * (it.bomb ? 420 : 200) - 120 + uy * kick * 0.5,
      spin: (it.bomb ? 5 : 2.4) + Math.random() * 1.6
    }));
    G.slashes.push({ x: it.x, y: it.y, ux, uy, r: it.r, t0: t, bomb: it.bomb });
    G.sliced = true;
    if (it.bomb) {
      G.stopUntil = t + 190;
      G.boom = { x: it.x, y: it.y, t0: t };
      G.shake = { t0: t, amp: VW < 700 ? 9 : 14, dur: 520 };
      burst(it.x, it.y, ux, uy, it.r, it.o.crumb, true, 2.2); smoke(it.x, it.y, it.r * 1.6);
      comboBreak(t, '碰到炸弹');
      if (G.sw) G.sw.open = false;
      setScore(loot.score - 3, true);
      pop(it.x, it.y - it.r * 0.4, '短路 −3', 'b', t);
      // 冲击波把旁边的东西推开
      G.items.forEach((o) => { const dx = o.x - it.x, dy = o.y - it.y, d = Math.hypot(dx, dy) || 1; if (d < VW * 0.45) { const f = 520 * (1 - d / (VW * 0.45)); o.vx += dx / d * f; o.vy += dy / d * f - 80; } });
      loot.bombs++; addLoot('bomb', 'bomb');
      return;
    }
    burst(it.x, it.y, ux, uy, it.r, it.o.crumb, true);
    G.combo++;
    G.comboAt = t; G.cx = it.x; G.cy = it.y;
    G.stopUntil = t + (G.combo >= COMBO_STEP ? 90 : 60);
    let pts = 1;
    if (G.combo % COMBO_STEP === 0) {
      pts += COMBO_BONUS;
      pop(it.x, it.y - it.r - 40, G.combo + ' 连击', 'c', t + 40);
      pop(it.x, it.y - it.r + 2, '+' + COMBO_BONUS, 'x', t + 120);
      G.shake = { t0: t, amp: Math.min(8, 2 + G.combo / 4), dur: 240 };
    }
    pop(it.x + rand(-10, 10), it.y - it.r * 0.6, '+1', 's', t);
    if (G.combo > loot.best) {
      loot.best = G.combo;
      if (!loot.celeC && loot.base.c >= 3 && G.combo > loot.base.c) { loot.celeC = 1; celebrate('c'); }
    }
    // 同一刀里接着切中的，记进"一刀多切"
    if (!G.sw || !G.sw.open || t - G.sw.t > 350) { settleSwipe(t); G.sw = { n: 0, open: true, t, x: it.x, y: it.y }; }
    G.sw.n++; G.sw.t = t; G.sw.x = it.x; G.sw.y = it.y;
    setScore(loot.score + pts);
    addLoot(it.k, 'hand');
  }
  function stepGame(t, dt, live) {
    if (!G.ready) return false;
    const slow = t < G.stopUntil ? 0.05 : 1, gdt = dt * slow, g = GRAV();
    G.gt += gdt;
    if (live && G.gt >= G.next) spawnWave();
    for (let k = G.items.length - 1; k >= 0; k--) {
      const it = G.items[k];
      it.vy += g * gdt; it.x += it.vx * gdt; it.y += it.vy * gdt;
      it.e.pitch += it.w.pitch * gdt; it.e.yaw += it.w.yaw * gdt; it.e.roll += it.w.roll * gdt;
      if (it.vy > 0 && it.y - it.r > VH + 20) { G.items.splice(k, 1); if (!it.bomb && live) missed(it, t); }
    }
    for (let k = G.halves.length - 1; k >= 0; k--) {
      const h = G.halves[k];
      h.age += gdt; h.vy += g * gdt; h.x += h.vx * gdt; h.y += h.vy * gdt;
      if (h.vy > 0 && h.y - h.r * 1.4 > VH + 20) G.halves.splice(k, 1);
    }
    stepParts(gdt);
    // 一刀多切结算：手停了 / 松开了，或者 0.35 秒内没再切中
    if (G.sw && (!G.sw.open || t - G.sw.t > 350)) settleSwipe(t);
    for (let k = G.pops.length - 1; k >= 0; k--) if (t - G.pops[k].t0 > G.pops[k].life) G.pops.splice(k, 1);
    for (let k = G.slashes.length - 1; k >= 0; k--) if (t - G.slashes[k].t0 > 320) G.slashes.splice(k, 1);
    for (let k = G.miss.length - 1; k >= 0; k--) if (t - G.miss[k].t0 > 1000) G.miss.splice(k, 1);
    if (G.boom && t - G.boom.t0 > 700) G.boom = null;
    if (G.brk && t - G.brk.t0 > 950) G.brk = null;
    if (G.cele && t - G.cele.t0 > 1800) G.cele = null;
    return live || G.items.length + G.halves.length + G.parts.length + G.pops.length + G.miss.length > 0 || !!G.boom || !!G.sw || !!G.brk || !!G.cele;
  }
  function drawGameGL() {
    for (const it of G.items) R.draw(it.o, { R: M3.euler(it.e), T: R.unproject(it.x, it.y, it.z), s: it.s });
    for (const h of G.halves) {
      const th = h.spin * h.age, hz = hinge(h.cut, h.k, th, 0.35 * th, h.o), T = R.unproject(h.x, h.y, h.z + h.k * 0.4 * h.age);
      R.draw(h.o, { R: hz.R, T: [T[0] + hz.off[0], T[1] + hz.off[1], T[2] + hz.off[2]], s: h.cut.s, plane: h.cut.plane, side: h.k, heat: (h.bomb ? 1.4 : 0.95) * Math.pow(1 - clamp(h.age / 0.5), 2) });
    }
  }
  function drawGame2D(t, onDark) {
    // 炸弹：红色虚线圈 + 引信火星
    for (const it of G.items) {
      if (!it.bomb) continue;
      const Rm = M3.euler(it.e), T = R.unproject(it.x, it.y, it.z), tl = M3.ap(Rm, it.o.tip);
      const tip = R.project([T[0] + tl[0] * it.s, T[1] + tl[1] * it.s, T[2] + tl[2] * it.s]);
      fx.save();
      fx.strokeStyle = 'rgba(217,43,18,.7)'; fx.lineWidth = 1.4; fx.setLineDash([5, 7]); fx.lineDashOffset = -t * 0.03;
      fx.beginPath(); fx.arc(it.x, it.y, it.r * 1.32, 0, 7); fx.stroke(); fx.setLineDash([]);
      const fl = 0.75 + 0.25 * Math.sin(t * 0.07) * Math.sin(t * 0.031), gr = fx.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], 14 * fl);
      gr.addColorStop(0, 'rgba(255,255,235,1)'); gr.addColorStop(0.3, 'rgba(255,190,80,.85)'); gr.addColorStop(1, 'rgba(255,90,20,0)');
      fx.fillStyle = gr; fx.fillRect(tip[0] - 16, tip[1] - 16, 32, 32);
      fx.restore();
      if (Math.random() < 0.7) G.parts.push({ t: 'spark', x: tip[0], y: tip[1], vx: rand(-160, 160), vy: rand(-260, -60), g: 900, age: 0, life: rand(0.12, 0.28), light: true });
    }
    // 刀口：命中瞬间的一道亮线 + 白闪
    for (const s of G.slashes) {
      const a = 1 - (t - s.t0) / 320, L = s.r * 1.5, x1 = s.x - s.ux * L, y1 = s.y - s.uy * L, x2 = s.x + s.ux * L, y2 = s.y + s.uy * L;
      fx.save(); fx.lineCap = 'round';
      fx.strokeStyle = `rgba(255,91,31,${0.35 * a})`; fx.lineWidth = 9 * a; fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
      fx.strokeStyle = onDark ? `rgba(255,250,240,${a})` : `rgba(20,18,16,${a})`; fx.lineWidth = 1.6; fx.stroke();
      if (t - s.t0 < 90) {
        fx.globalCompositeOperation = 'lighter';
        const gr = fx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 0.9);
        gr.addColorStop(0, 'rgba(255,250,240,.75)'); gr.addColorStop(1, 'rgba(255,200,150,0)');
        fx.fillStyle = gr; fx.fillRect(s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
      }
      fx.restore();
    }
    drawParts(onDark);
    // 爆炸
    if (G.boom) {
      const b = G.boom, age = (t - b.t0) / 1000;
      fx.save();
      if (age < 0.35) { fx.fillStyle = `rgba(255,91,31,${0.2 * (1 - age / 0.35)})`; fx.fillRect(0, 0, VW, VH); }
      if (age < 0.12) { fx.fillStyle = `rgba(255,250,240,${0.85 * (1 - age / 0.12)})`; fx.fillRect(0, 0, VW, VH); }
      const rr = 30 + age * Math.max(VW, VH) * 1.4, al = Math.max(0, 1 - age / 0.6);
      fx.strokeStyle = `rgba(20,16,12,${0.5 * al})`; fx.lineWidth = 2 + 10 * al; fx.beginPath(); fx.arc(b.x, b.y, rr, 0, 7); fx.stroke();
      const gr = fx.createRadialGradient(b.x, b.y, 0, b.x, b.y, rr * 0.6);
      gr.addColorStop(0, `rgba(255,240,200,${0.9 * al})`); gr.addColorStop(0.4, `rgba(255,120,40,${0.5 * al})`); gr.addColorStop(1, 'rgba(255,91,31,0)');
      fx.fillStyle = gr; fx.fillRect(b.x - rr, b.y - rr, rr * 2, rr * 2);
      fx.restore();
    }
    // 漏掉的：掉出去的地方在屏幕底边闪一个红叉
    for (const ms of G.miss) {
      const age = (t - ms.t0) / 1000, al = 1 - sm(0.5, 1, age), s = (VW < 700 ? 9 : 12) * (0.6 + 0.4 * Math.min(1, age * 8)), y = VH - (VW < 700 ? 64 : 34) - 18 * Math.min(1, age * 4);
      fx.save(); fx.globalAlpha = al; fx.translate(ms.x, y); fx.lineCap = 'round';
      fx.strokeStyle = 'rgba(231,229,223,.95)'; fx.lineWidth = 7;
      fx.beginPath(); fx.moveTo(-s, -s); fx.lineTo(s, s); fx.moveTo(s, -s); fx.lineTo(-s, s); fx.stroke();
      fx.strokeStyle = '#d92b12'; fx.lineWidth = 3; fx.stroke();
      fx.font = `600 ${VW < 700 ? 10 : 11}px ${MONO}`; fx.textAlign = 'center'; fx.fillStyle = '#d92b12'; fx.fillText('漏', 0, s + 16);
      fx.restore();
    }
    // 飘字
    for (const p of G.pops) {
      const age = (t - p.t0) / p.life;
      if (age < 0) continue;
      const rk = p.kind === 'r', big = p.kind === 'c' || p.kind === 'b' || rk, m = VW < 700 ? 0.78 : 1;
      const al = 1 - sm(rk ? 0.7 : 0.55, 1, age), y = p.y - (rk || p.kind === 'rs' ? 20 : 46) * (1 - Math.pow(1 - age, 3)), sc = big ? 0.6 + 0.4 * Math.min(1, age * (rk ? 12 : 7)) + 0.12 * Math.max(0, 1 - Math.abs(age * 7 - 1.2)) : 1;
      fx.save(); fx.globalAlpha = al; fx.translate(p.x, y); fx.scale(sc, sc); fx.textAlign = 'center'; fx.textBaseline = 'middle';
      fx.font = rk ? `900 ${Math.round((VW < 700 ? 34 : 56))}px ${SERIF}` : big ? `900 ${Math.round(38 * m)}px ${SERIF}` : p.kind === 'm' || p.kind === 'rs' ? `900 ${Math.round(18 * m)}px ${SERIF}` : `600 ${Math.round((p.kind === 'x' ? 20 : 15) * m)}px ${MONO}`;
      fx.lineJoin = 'round'; fx.lineWidth = rk ? 9 : big ? 7 : 4; fx.strokeStyle = onDark ? 'rgba(18,18,17,.9)' : 'rgba(231,229,223,.95)'; fx.strokeText(p.txt, 0, 0);
      if (rk) {
        const g = fx.createLinearGradient(0, -30 * m, 0, 24 * m);
        g.addColorStop(0, '#ffcf4a'); g.addColorStop(0.55, '#ff5b1f'); g.addColorStop(1, '#c8160b');
        fx.fillStyle = g;
      } else fx.fillStyle = p.kind === 'b' ? '#d92b12' : p.kind === 'c' || p.kind === 'x' ? '#ff5b1f' : onDark ? '#ecebe6' : '#151515';
      fx.fillText(p.txt, 0, 0);
      fx.restore();
    }
  }

  /* ---------- 布局 ---------- */
  function layout() {
    VW = stage.clientWidth || innerWidth; VH = stage.clientHeight || innerHeight;
    const coarse = matchMedia('(pointer: coarse)').matches;
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    starts = []; total = 0;
    BL.forEach((l) => { starts.push(total); total += l * VH; });
    track.style.height = Math.round(total + VH) + 'px';
    trackTop = track.getBoundingClientRect().top + window.scrollY;
    R.size(VW, VH, dpr);
    fxc.width = lzc.width = Math.round(VW * dpr); fxc.height = lzc.height = Math.round(VH * dpr);
    const sr = stage.getBoundingClientRect();
    // 首屏文字占的区域：游戏物件只在文字以外的地方飞
    let tr = 0, tb = 0;
    $$('.hero__t .ln > span, .hero__s, .hero__cta .btn', heroIn).forEach((el) => { const r = el.getBoundingClientRect(); tr = Math.max(tr, r.right - sr.left); tb = Math.max(tb, r.bottom - sr.top); });
    if (VW >= 900) {
      zones = [{ x0: Math.max(tr + 24, VW * 0.42), x1: VW - 64, y0: VH * 0.14, y1: VH * 0.6, w: 1 }];
      if (VH - tb > 190) zones.push({ x0: 40, x1: Math.max(tr + 24, VW * 0.42), y0: tb + 40, y1: VH - 40, w: 0.3 });
    } else {
      const y0 = Math.min(tb + 24, VH - 200);
      zones = [{ x0: 14, x1: VW - 14, y0, y1: VH - 90, w: 1 }];
    }
    setS(hint, 'transform', `translate3d(${(VW >= 900 ? (zones[0].x0 + zones[0].x1) / 2 : VW / 2).toFixed(0)}px,${(VH - (VW < 700 ? 78 : 58)).toFixed(0)}px,0) translateX(-50%)`);
    // 首屏切开线：穿过标题第二行
    const l2 = $$('.hero__t .ln', heroIn)[1];
    let hc = [VW * 0.4, VH * 0.45];
    if (l2) { const r = l2.getBoundingClientRect(); hc = [r.left - sr.left + r.width * 0.5, r.top - sr.top + r.height * 0.52]; }
    const L = 3 * Math.max(VW, VH);
    // 纸比舞台四边各大 15%，转一点角度也不会露出底下的边
    const ox = VW * 0.15, oy = VH * 0.15;
    HS = { c: hc, th: HERO_TH, d: [Math.cos(HERO_TH), Math.sin(HERO_TH)], n: [-Math.sin(HERO_TH), Math.cos(HERO_TH)], clip: [halfPoly(hc[0], hc[1], HERO_TH, 1, L), halfPoly(hc[0], hc[1], HERO_TH, -1, L)], pclip: [halfPoly(hc[0] + ox, hc[1] + oy, HERO_TH, 1, L), halfPoly(hc[0] + ox, hc[1] + oy, HERO_TH, -1, L)], ui: -1, L: lineThrough(hc[0], hc[1], HERO_TH) };
    heroHalves.forEach((h, k) => { h.style.clipPath = HS.clip[k]; });
    // 每拍的刀：从哪儿划到哪儿、什么时候切到底
    for (let j = 1; j <= 4; j++) {
      const Ln = lines[j] = lineThrough(VW / 2, VH / 2, ANG[j]);
      if (!objs[j]) continue;
      const rpx = objs[j].rad * sObj(j) * R.pxPerUnit();
      cutA[j] = A0 + clamp((Ln.tc + rpx * 0.85) / Ln.len) * (A1 - A0);
      const p = prePose(j, cutA[j]);
      cutS[j] = makeCut(p, VW / 2 - Ln.dx * 100, VH / 2 - Ln.dy * 100, VW / 2 + Ln.dx * 100, VH / 2 + Ln.dy * 100);
    }
    // 卡片太高就整体缩一点；记下卡片在屏幕上的位置（画切口的光要用）
    const top = VW < 700 ? 60 : 76, bot = VW < 700 ? 52 : 40;
    panels.forEach((P, j) => {
      if (!P) return;
      P.panel.style.clipPath = ''; P.last = '';
      P.panel.style.setProperty('--fit', 1);
      const h = P.panel.offsetHeight, f = Math.min(1, (VH - top - bot) / h);
      P.panel.style.setProperty('--fit', f.toFixed(3));
      P.panel.style.setProperty('--dy', ((top - bot) / 2).toFixed(0) + 'px');
      P.w = P.panel.offsetWidth; P.h = P.panel.offsetHeight;
      const r = P.panel.getBoundingClientRect();
      P.fit = r.width / P.w; P.sx = r.left - sr.left + r.width / 2; P.sy = r.top - sr.top + r.height / 2;
      const th = EXA[j] || 0, L2 = (P.w + P.h) * 2;
      P.halves.forEach((hv, k) => { hv.style.clipPath = halfPoly(P.w / 2, P.h / 2, th, k ? -1 : 1, L2); });
    });
  }

  /* ---------- 2D 特效：刀光、火花、指尖划痕 ---------- */
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
      strip(10, 'rgba(255,91,31,0)', `rgba(255,91,31,${0.22 * al})`);
      strip(4, 'rgba(20,20,20,0)', `rgba(20,20,20,${0.22 * al})`);
      strip(1.3, 'rgba(20,20,20,0)', `rgba(15,15,15,${0.95 * al})`);
      fx.fillStyle = `rgba(255,91,31,${al})`; fx.beginPath(); fx.arc(x2, y2, 2.6, 0, 7); fx.fill();
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
  // 切口发光的一条线（卡片和首屏被切开时）
  function glowLine(x1, y1, x2, y2, a, onDark) {
    if (a <= 0.01) return;
    fx.save(); fx.lineCap = 'round';
    if (onDark) {
      fx.globalCompositeOperation = 'lighter';
      fx.strokeStyle = `rgba(255,110,40,${0.3 * a})`; fx.lineWidth = 10; fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
      fx.strokeStyle = `rgba(255,190,130,${0.6 * a})`; fx.lineWidth = 3; fx.stroke();
      fx.strokeStyle = `rgba(255,250,240,${a})`; fx.lineWidth = 1.2; fx.stroke();
    } else {
      fx.strokeStyle = `rgba(255,91,31,${0.28 * a})`; fx.lineWidth = 8; fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
      fx.strokeStyle = `rgba(255,91,31,${a})`; fx.lineWidth = 1.6; fx.stroke();
    }
    fx.restore();
  }
  // 刀尖划过的痕迹：一条前粗后细的刀刃
  function drawTrail(t, onDark, heat) {
    while (trail.length && t - trail[0].t > 150) trail.shift();
    const n = trail.length;
    if (n < 3) return n > 0;
    const W = (VW < 700 ? 4 : 5.5) * (1 + 0.55 * heat), Lf = [], Rt = [];
    let any = false;
    for (let k = 0; k < n; k++) {
      const p = trail[k], a = trail[Math.max(0, k - 1)], b = trail[Math.min(n - 1, k + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
      const sp = k ? Math.hypot(p.x - a.x, p.y - a.y) / Math.max(1, p.t - a.t) : 0;
      const w = W * Math.pow(k / (n - 1), 0.9) * clamp((sp - 0.35) / 1.1) * (1 - (t - p.t) / 150);
      if (w > 0.4) any = true;
      Lf.push([p.x - dy * w, p.y + dx * w]); Rt.push([p.x + dy * w, p.y - dx * w]);
    }
    if (!any) return true;
    const last = trail[n - 1], pv = trail[n - 2];
    let hx = last.x - pv.x, hy = last.y - pv.y; const hl = Math.hypot(hx, hy) || 1;
    fx.save();
    fx.globalCompositeOperation = onDark ? 'lighter' : 'source-over';
    // 连击越高，刀越"热"：刀身从墨黑变成暗红，外面一圈火光，刃口从橙变金
    const hc = (a, b) => Math.round(a + (b - a) * heat);
    fx.fillStyle = onDark ? 'rgba(255,238,220,.95)' : `rgba(${hc(18, 150)},${hc(18, 26)},${hc(18, 8)},.92)`;
    if (heat > 0.02) { fx.shadowColor = `rgba(255,${hc(110, 70)},30,${(0.4 + 0.5 * heat).toFixed(2)})`; fx.shadowBlur = 6 + 22 * heat; }
    fx.beginPath(); fx.moveTo(Lf[0][0], Lf[0][1]);
    for (let k = 1; k < n; k++) fx.lineTo(Lf[k][0], Lf[k][1]);
    fx.lineTo(last.x + hx / hl * W * 2, last.y + hy / hl * W * 2);
    for (let k = n - 1; k >= 0; k--) fx.lineTo(Rt[k][0], Rt[k][1]);
    fx.closePath(); fx.fill();
    fx.shadowBlur = 0;
    fx.strokeStyle = onDark ? 'rgba(255,150,80,.9)' : `rgba(255,${hc(91, 214)},${hc(31, 90)},.95)`; fx.lineWidth = 1.1 + 1.2 * heat; fx.lineCap = 'round';
    fx.beginPath(); const m0 = Math.floor(n * 0.45); fx.moveTo(trail[m0].x, trail[m0].y);
    for (let k = m0 + 1; k < n; k++) fx.lineTo(trail[k].x, trail[k].y);
    fx.stroke();
    fx.restore();
    return true;
  }

  /* ---------- 激光切割：首屏整张纸、每张卡片离场 ----------
   * 画在最上层的 #lz 画布上。切缝、余热、烧痕全由滚动进度算出来（往回滑就倒放）；
   * 只有火花和烟是按时间飞的粒子。 */
  const HEAT = [[0, 70, 14, 6], [0.22, 150, 28, 10], [0.45, 225, 70, 18], [0.66, 255, 140, 45], [0.84, 255, 214, 130], [1, 255, 250, 236]];
  function heatRGB(h) {
    h = clamp(h);
    for (let k = 1; k < HEAT.length; k++) {
      if (h <= HEAT[k][0]) { const a = HEAT[k - 1], b = HEAT[k], u = (h - a[0]) / (b[0] - a[0]); return (a[1] + (b[1] - a[1]) * u | 0) + ',' + (a[2] + (b[2] - a[2]) * u | 0) + ',' + (a[3] + (b[3] - a[3]) * u | 0); }
    }
    return '255,250,236';
  }
  // 切过之后过了多久（以"激光走完一趟"为单位）→ 还剩多少热：刚切过白热，很快变橙、变红，最后只剩焦黑
  const heatOf = (age) => (age < 0 ? 0 : Math.min(1, 0.25 * Math.exp(-age * 16) + 0.8 * Math.exp(-age * 1.0)));
  const hash = (x) => { const s = Math.sin(x * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const vnoise = (x) => { const i = Math.floor(x), u = x - i, w = u * u * (3 - 2 * u); return hash(i) * (1 - w) + hash(i + 1) * w; };
  const LZ = { parts: [], st: {}, dirty: true, hot: false };

  // 正在切：A→B 这条线，光点走到 hd（0~1）
  function laserKerf(A, B, hd, dk) {
    const c = lzx, dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
    const H = [A[0] + dx * hd, A[1] + dy * hd], m = VW < 700 ? 0.75 : 1;
    LZ.dirty = true;
    c.save(); c.lineJoin = 'round';
    // ① 已经切穿的地方：一道烧黑的细缝，两边一圈焦痕
    if (hd > 0.001) {
      c.globalCompositeOperation = 'source-over'; c.lineCap = 'round';
      c.strokeStyle = dk ? 'rgba(0,0,0,.5)' : 'rgba(96,44,12,.15)'; c.lineWidth = 10 * m;
      c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(H[0], H[1]); c.stroke();
      c.strokeStyle = dk ? 'rgba(4,3,2,.95)' : 'rgba(34,18,8,.86)'; c.lineWidth = 2.2 * m;
      c.beginPath(); c.moveTo(A[0], A[1]);
      const n = Math.max(2, Math.round(len * hd / 12));
      for (let k = 1; k <= n; k++) { const s = hd * k / n, j = (vnoise(s * len / 9 + 3) - 0.5) * 1.8 * m; c.lineTo(A[0] + dx * s + nx * j, A[1] + dy * s + ny * j); }
      c.stroke();
    }
    // ② 刚切过的一段还烧得发红，离光点越远越冷
    c.globalCompositeOperation = dk ? 'lighter' : 'source-over'; c.lineCap = 'butt';
    const span = Math.min(hd, 0.85), N = 30;
    for (let k = 0; k < N && span > 0.002; k++) {
      const s1 = hd - span * k / N, s0 = hd - span * (k + 1) / N, h = heatOf(hd - (s0 + s1) / 2);
      if (h < 0.03) continue;
      const col = heatRGB(dk ? h : h * 0.93);
      c.beginPath(); c.moveTo(A[0] + dx * s0, A[1] + dy * s0); c.lineTo(A[0] + dx * s1, A[1] + dy * s1);
      c.strokeStyle = `rgba(${col},${((dk ? 0.28 : 0.32) * h).toFixed(3)})`; c.lineWidth = (3 + 10 * h) * m; c.stroke();
      c.strokeStyle = `rgba(${col},${Math.min(1, 0.2 + h).toFixed(3)})`; c.lineWidth = (1 + 1.8 * h) * m; c.stroke();
    }
    // ③ 光点：极亮的白芯 + 光晕 + 沿切线的一道横向光芒 + 从上方打下来的细光束
    if (hd > 0 && hd < 1) {
      const fl = 0.85 + 0.3 * Math.random(), R0 = (dk ? 58 : 46) * m * fl;
      let g = c.createRadialGradient(H[0], H[1], 0, H[0], H[1], R0);
      if (dk) { g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.08, 'rgba(255,246,220,.95)'); g.addColorStop(0.25, 'rgba(255,170,80,.42)'); g.addColorStop(0.6, 'rgba(255,90,30,.1)'); g.addColorStop(1, 'rgba(255,60,20,0)'); }
      else { g.addColorStop(0, 'rgba(255,255,250,1)'); g.addColorStop(0.1, 'rgba(255,236,170,.95)'); g.addColorStop(0.3, 'rgba(255,140,40,.5)'); g.addColorStop(0.65, 'rgba(255,91,31,.13)'); g.addColorStop(1, 'rgba(255,91,31,0)'); }
      c.globalCompositeOperation = dk ? 'lighter' : 'source-over';
      c.fillStyle = g; c.fillRect(H[0] - R0, H[1] - R0, R0 * 2, R0 * 2);
      c.lineCap = 'round';
      const streak = (L, w, x, y, a) => {
        const gg = c.createLinearGradient(H[0] - x * L, H[1] - y * L, H[0] + x * L, H[1] + y * L);
        gg.addColorStop(0, 'rgba(255,190,120,0)'); gg.addColorStop(0.5, `rgba(255,252,240,${a})`); gg.addColorStop(1, 'rgba(255,190,120,0)');
        c.strokeStyle = gg; c.lineWidth = w; c.beginPath(); c.moveTo(H[0] - x * L, H[1] - y * L); c.lineTo(H[0] + x * L, H[1] + y * L); c.stroke();
      };
      streak(140 * m * fl, 1.6 * m, ux, uy, 0.95);
      streak(34 * m * fl, 1.2 * m, nx, ny, 0.7);
      const Ex = H[0] + VH * 0.2, Ey = -40;
      g = c.createLinearGradient(Ex, Ey, H[0], H[1]);
      g.addColorStop(0, 'rgba(255,110,50,0)'); g.addColorStop(0.75, dk ? 'rgba(255,150,80,.18)' : 'rgba(255,91,31,.16)'); g.addColorStop(1, dk ? 'rgba(255,220,180,.55)' : 'rgba(255,91,31,.5)');
      c.strokeStyle = g; c.lineWidth = 7 * m; c.beginPath(); c.moveTo(Ex, Ey); c.lineTo(H[0], H[1]); c.stroke();
      g = c.createLinearGradient(Ex, Ey, H[0], H[1]);
      g.addColorStop(0, 'rgba(255,200,160,0)'); g.addColorStop(0.6, 'rgba(255,210,170,.35)'); g.addColorStop(1, 'rgba(255,255,255,1)');
      c.strokeStyle = g; c.lineWidth = 1.1 * m; c.stroke();
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#fff'; c.beginPath(); c.arc(H[0], H[1], 2.6 * m, 0, 7); c.fill();
    }
    c.restore();
  }
  // 光点在走：沿途喷火花、冒一点烟（时间粒子；停在半路也会持续冒）
  function laserEmit(key, A, B, hd, on, dk, dt) {
    const st = LZ.st[key] || (LZ.st[key] = { h: -1, sm: 0 });
    if (!on) { st.h = -1; return; }
    const prev = st.h < 0 ? hd : st.h; st.h = hd;
    if (!dt) return;
    const dx = B[0] - A[0], dy = B[1] - A[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, sg = hd >= prev ? 1 : -1, m = VW < 700 ? 0.75 : 1;
    const moved = Math.abs(hd - prev) * len, n = Math.min(48, Math.round(moved * 0.3 + dt * (80 + 120 * Math.random())));
    for (let k = 0; k < n; k++) {
      const s = prev + (hd - prev) * Math.random(), x = A[0] + dx * s, y = A[1] + dy * s, sp = rand(140, 780), side = rand(-1, 1);
      LZ.parts.push({ t: 'spark', x, y, vx: -ux * sg * sp * 0.55 - uy * side * sp * 0.6 + rand(-60, 60), vy: -uy * sg * sp * 0.55 + ux * side * sp * 0.6 - rand(120, 480), g: 1500, age: 0, life: rand(0.15, 0.6), dk, w: rand(0.8, 1.9) * m });
    }
    if (Math.random() < dt * 9) LZ.parts.push({ t: 'drop', x: H0(A, dx, dy, hd)[0], y: H0(A, dx, dy, hd)[1], vx: rand(-90, 90), vy: rand(-140, 30), g: 1700, age: 0, life: rand(0.5, 0.9), dk, w: rand(1.6, 2.8) * m });
    st.sm += dt + moved * 0.0015;
    while (st.sm > 0.025) {
      st.sm -= 0.025;
      const s = hd - rand(0, 0.04) * sg;
      LZ.parts.push({ t: 'smoke', x: A[0] + dx * s + rand(-4, 4), y: A[1] + dy * s, vx: rand(-25, 25), vy: rand(-80, -30), g: -30, age: 0, life: rand(1, 1.7), dk, sz: rand(5, 11) * m });
    }
    if (LZ.parts.length > 460) LZ.parts.splice(0, LZ.parts.length - 460);
  }
  const H0 = (A, dx, dy, h) => [A[0] + dx * h, A[1] + dy * h];
  function stepLZ(dt) {
    for (let k = LZ.parts.length - 1; k >= 0; k--) {
      const p = LZ.parts[k];
      p.age += dt;
      if (p.age > p.life) { LZ.parts.splice(k, 1); continue; }
      p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'smoke') { p.vx *= 1 - 1.5 * dt; p.vy *= 1 - 1.2 * dt; }
    }
  }
  function drawLZParts() {
    if (!LZ.parts.length) return;
    const c = lzx;
    LZ.dirty = true;
    c.save(); c.lineCap = 'round';
    for (const p of LZ.parts) {
      const tv = p.age / p.life;
      if (p.t === 'smoke') {
        c.globalCompositeOperation = 'source-over';
        const rr = p.sz * (1 + tv * 2.4), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr), col = p.dk ? '150,145,138' : '72,62,54', a = (p.dk ? 0.08 : 0.1) * Math.sin(Math.PI * Math.min(1, tv * 1.3 + 0.08));
        g.addColorStop(0, `rgba(${col},${a.toFixed(3)})`); g.addColorStop(1, `rgba(${col},0)`);
        c.fillStyle = g; c.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
      } else if (p.t === 'drop') {
        c.globalCompositeOperation = p.dk ? 'lighter' : 'source-over';
        c.fillStyle = `rgba(${heatRGB(0.95 - tv * 0.7)},${(1 - tv * tv).toFixed(3)})`;
        c.beginPath(); c.arc(p.x, p.y, p.w * (1 - tv * 0.5), 0, 7); c.fill();
      } else {
        c.globalCompositeOperation = p.dk ? 'lighter' : 'source-over';
        c.strokeStyle = `rgba(${heatRGB(p.dk ? 1 - tv * 0.8 : 0.86 - tv * 0.5)},${(1 - tv).toFixed(3)})`;
        c.lineWidth = p.w * (1 - tv * 0.6);
        c.beginPath(); c.moveTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02); c.lineTo(p.x, p.y); c.stroke();
      }
    }
    c.restore();
  }
  // 切开后的一半：切口边上一条焦黑的烧痕（往里不均匀地渗），边缘一线余火，按进度慢慢冷却
  // pt(h) = 这一半切口上、激光走到 h 处的那个点（屏幕坐标）；(ix,iy) = 指向这一半里面的方向
  function burnEdge(pt, ix, iy, heatAt, al, dk, scl, seed, t) {
    if (al <= 0.01) return 0;
    const c = lzx, N = 34, P = [], W = [], Hh = [];
    let hmax = 0;
    for (let k = 0; k <= N; k++) {
      const h = -0.02 + 1.04 * k / N;
      P.push(pt(h)); W.push((3 + 8 * vnoise(seed + k * 0.83)) * scl); const hv = heatAt(h); Hh.push(hv); if (hv > hmax) hmax = hv;
    }
    LZ.dirty = true;
    c.save();
    c.globalCompositeOperation = 'source-over';
    const mid = P[N >> 1], g = c.createLinearGradient(mid[0], mid[1], mid[0] + ix * 12 * scl, mid[1] + iy * 12 * scl);
    if (dk) { g.addColorStop(0, `rgba(0,0,0,${0.85 * al})`); g.addColorStop(0.35, `rgba(70,28,8,${0.5 * al})`); g.addColorStop(1, 'rgba(90,40,12,0)'); }
    else { g.addColorStop(0, `rgba(28,13,4,${0.92 * al})`); g.addColorStop(0.3, `rgba(80,36,10,${0.55 * al})`); g.addColorStop(1, 'rgba(120,64,22,0)'); }
    c.fillStyle = g; c.beginPath(); c.moveTo(P[0][0], P[0][1]);
    for (let k = 1; k <= N; k++) c.lineTo(P[k][0], P[k][1]);
    for (let k = N; k >= 0; k--) c.lineTo(P[k][0] + ix * W[k], P[k][1] + iy * W[k]);
    c.closePath(); c.fill();
    if (hmax > 0.03) {
      c.globalCompositeOperation = dk ? 'lighter' : 'source-over'; c.lineCap = 'butt';
      for (let k = 0; k < N; k++) {
        const hm = (Hh[k] + Hh[k + 1]) / 2 * (0.75 + 0.5 * vnoise(seed * 3 + k * 1.7 + t * 0.004));
        if (hm < 0.03) continue;
        const col = heatRGB(Math.min(1, hm)), a = P[k], b = P[k + 1];
        c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]);
        c.strokeStyle = `rgba(${col},${(0.3 * hm * al).toFixed(3)})`; c.lineWidth = (3 + 7 * hm) * scl; c.stroke();
        c.strokeStyle = `rgba(${col},${Math.min(1, 1.5 * hm * al).toFixed(3)})`; c.lineWidth = (1 + 1.4 * hm) * scl; c.stroke();
      }
    }
    c.restore();
    return hmax;
  }

  /* ---------- 连击数字：越连越热；断了就裂成两半掉下去 ---------- */
  function drawCombo(t) {
    const c = lzx, mob = VW < 700, x = VW - (mob ? 54 : 112), y = mob ? 118 : 146;
    let busy = false;
    if (G.combo >= 2) {
      G.brk = null;
      LZ.dirty = true;
      const n = G.combo, heat = clamp((n - 2) / 13), age = (t - G.comboAt) / 1000, pulse = 1 + 0.5 * Math.exp(-age * 12);
      if (age < 0.5) busy = true;
      const fs = Math.round((mob ? 42 : 66) * (1 + 0.22 * heat));
      c.save(); c.translate(x, y); c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      c.font = `500 ${mob ? 10 : 11}px ${MONO}`; c.fillStyle = 'rgba(21,21,21,.62)';
      c.fillText('连击 · 一个不漏', 0, 30);
      // 离下一档 +5 还差几个：五个小格
      const tw = mob ? 6 : 8, gap = 3, seg = n % COMBO_STEP, full = seg === 0 && age < 0.6;
      for (let k = 0; k < COMBO_STEP; k++) {
        c.fillStyle = full || k < seg ? '#ff5b1f' : 'rgba(21,21,21,.18)';
        c.fillRect(-((tw + gap) * COMBO_STEP - gap) / 2 + k * (tw + gap), 9, tw, 3);
      }
      c.scale(pulse, pulse);
      c.font = `900 ${fs}px ${SERIF}`; c.lineJoin = 'round';
      if (heat > 0.04) { c.shadowColor = `rgba(255,${120 - 60 * heat | 0},30,${(0.35 + 0.5 * heat).toFixed(2)})`; c.shadowBlur = 8 + 26 * heat; }
      c.lineWidth = 7; c.strokeStyle = 'rgba(231,229,223,.95)'; c.strokeText(String(n), 0, 0);
      c.shadowBlur = 0;
      const mix = (a, b) => `rgb(${a.map((v, q) => Math.round(v + (b[q] - v) * heat)).join(',')})`;
      const g = c.createLinearGradient(0, -fs * 0.72, 0, 0);
      g.addColorStop(0, mix([255, 91, 31], [255, 214, 90])); g.addColorStop(1, mix([255, 91, 31], [205, 20, 10]));
      c.fillStyle = g; c.fillText(String(n), 0, 0);
      c.restore();
    }
    if (G.brk) {
      const age = (t - G.brk.t0) / 1000, fs = mob ? 42 : 66;
      if (age < 0.95) {
        busy = true; LZ.dirty = true;
        const al = 1 - sm(0.5, 0.95, age), sep = 3 + 26 * age + 120 * age * age, th = -0.32, d = [Math.cos(th), Math.sin(th)], nn = [-d[1], d[0]];
        c.save(); c.translate(x, y); c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.font = `900 ${fs}px ${SERIF}`;
        [1, -1].forEach((k) => {
          c.save();
          c.translate(nn[0] * k * sep * 0.35, nn[1] * k * sep * 0.35 + (k > 0 ? sep : sep * 0.45));
          c.rotate(k * 0.5 * age);
          c.beginPath();
          const cy0 = -fs * 0.36, L = fs * 2;
          c.moveTo(-L * d[0], cy0 - L * d[1]); c.lineTo(L * d[0], cy0 + L * d[1]); c.lineTo(L * d[0] + nn[0] * k * L, cy0 + L * d[1] + nn[1] * k * L); c.lineTo(-L * d[0] + nn[0] * k * L, cy0 - L * d[1] + nn[1] * k * L);
          c.closePath(); c.clip();
          c.globalAlpha = al; c.fillStyle = '#8d8a83'; c.fillText(String(G.brk.n), 0, 0);
          c.restore();
        });
        if (age < 0.18) { // 断的那一下：一道红线划过数字
          c.strokeStyle = `rgba(217,43,18,${1 - age / 0.18})`; c.lineWidth = 2.5; c.lineCap = 'round';
          c.beginPath(); c.moveTo(-fs * 0.8 * d[0], -fs * 0.36 - fs * 0.8 * d[1]); c.lineTo(fs * 0.8 * d[0], -fs * 0.36 + fs * 0.8 * d[1]); c.stroke();
        }
        c.globalAlpha = al; c.font = `600 ${mob ? 11 : 12}px ${MONO}`; c.fillStyle = '#d92b12';
        c.fillText('连击断了', 0, 30); c.font = `400 ${mob ? 10 : 11}px ${MONO}`; c.fillStyle = 'rgba(21,21,21,.6)'; c.fillText(G.brk.why + ' · 停在 ' + G.brk.n, 0, 46);
        c.restore();
      }
    }
    return busy;
  }

  /* ---------- 每一帧 ---------- */
  function beatAt(p) {
    p = clamp(p, 0, total - 0.01);
    let i = 0; while (i < 4 && p >= starts[i + 1]) i++;
    return { i, f: (p - starts[i]) / (BL[i] * VH) };
  }
  function render(t, dt) {
    dt = dt || 0;
    const { i, f } = beatAt(cur);
    let busy = false;
    R.clear();
    fx.setTransform(dpr, 0, 0, dpr, 0, 0); fx.clearRect(0, 0, VW, VH);
    lzx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (LZ.dirty) { lzx.clearRect(0, 0, VW, VH); LZ.dirty = false; }
    LZ.hot = false;
    // 首屏被切开的进度
    const hu = i === 0 ? sm(LZ0 + LZD, 0.82, f) : 1;
    const onDark = hu > 0.35;
    cuttable = null;

    // 屏幕震动（切到炸弹 / 大连击）
    let shook = '';
    if (G.shake) {
      const p = (t - G.shake.t0) / G.shake.dur;
      if (p >= 1) G.shake = null;
      else { const a = G.shake.amp * (1 - p) * (1 - p); shook = `translate3d(${(a * Math.sin(t * 0.11)).toFixed(1)}px,${(a * Math.cos(t * 0.083)).toFixed(1)}px,0)`; busy = true; }
    }
    setS(stage, 'transform', shook);

    // 切水果（首屏）
    const live = i === 0 && f < 0.24 && !document.hidden;
    if (stepGame(t, dt, live)) busy = true;
    drawGameGL();

    for (let j = 1; j <= 4; j++) {
      const o = objs[j];
      if (!o) continue;
      let pre = null, u = -1, cut = null, a = -1;
      const T0 = j === 1 ? 0.5 : 0.85; // 第一块芯片从首屏切开的缝里抛上来
      if (early[j] && (i < j - 1 || (i === j - 1 && f < T0))) early[j] = null;
      if (i === j - 1 && f > T0) pre = tossPose(j, 0.75 * (f - T0) / (1 - T0));
      else if (i === j) {
        a = Math.min(1, f / 0.4);
        if (a < 0.1) pre = tossPose(j, 0.75 + 0.25 * a / 0.1);
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
      }
      if (pre && !E) {
        R.draw(o, { R: M3.euler(pre.e), T: pre.T, s: pre.s });
        const c = R.project(pre.T), rpx = o.rad * pre.s * R.pxPerUnit();
        if (c[1] < VH + rpx * 0.5) cuttable = { j, pose: pre, c, rpx };
      } else if (cut && u >= 0 && u < 1.05) {
        R.draw(o, halfState(o, cut, 1, u)); R.draw(o, halfState(o, cut, -1, u));
        const c = R.project(cut.T0), rpx = o.rad * cut.s * R.pxPerUnit();
        if (u < 0.2) flash(L, u, true);
        if (u < 0.7) sparks(j, L, c[0], c[1], rpx, u, true, o.crumb);
      }
      // 跟着滚动的刀光（被指尖提前切开时就不再划）
      if (i === j && !E && a > A0 - 0.01 && a < A1 + LAG + 0.01) {
        const hd = (x) => clamp((x - A0) / (A1 - A0));
        blade(L, hd(a - LAG * dir), hd(a), true, 1);
      }
    }
    drawGame2D(t, onDark);
    heroCut(i, f, hu, t, dt);

    // 卡片：从切口里展开 → 停住 → 被激光切成两半离场
    for (let j = 1; j <= 4; j++) {
      let k = 0, ex = 0;
      if (i === j) {
        const a = f / 0.4;
        k = f < 0.4 ? clamp((a - 0.44) / 0.52) : 1;
        if (j < 4 && f > EX0) ex = (f - EX0) / (1 - EX0);
        if (early[j]) k = Math.max(k, clamp(((t - early[j].t0) / 950 - 0.2) / 0.55));
      }
      const isCut = i > j || (i === j && f / 0.4 >= cutA[j]);
      if (isCut && !early[j] && !scrollCut[j]) { scrollCut[j] = 1; addLoot('b' + j, 'scroll'); }
      panel(j, k, ex, early[j] ? early[j].ang : ANG[j]);
      drawPanelGlow(panels[j], t);
      // 离场：先一束激光从卡片一边烧到另一边，再分成两半
      const P = panels[j], lzOn = ex > 0 && ex < EXH;
      let A = null, B = null;
      if (lzOn || LZ.st['p' + j]) {
        const d = [Math.cos(EXA[j] || 0), Math.sin(EXA[j] || 0)], tm = panelChord(P, d);
        A = [P.sx - d[0] * tm * P.fit, P.sy - d[1] * tm * P.fit]; B = [P.sx + d[0] * tm * P.fit, P.sy + d[1] * tm * P.fit];
        if (lzOn) { laserKerf(A, B, ex / EXH, true); LZ.hot = true; }
      }
      if (A) laserEmit('p' + j, A, B, clamp(ex / EXH), lzOn, true, dt);
    }
    if (drawTrail(t, onDark, i === 0 ? clamp((G.combo - 1) / 12) : 0)) busy = true;
    if (i === 0 && hu < 0.35 && G.ready && drawCombo(t)) busy = true;
    stepLZ(dt); drawLZParts();
    if (LZ.parts.length || LZ.hot) busy = true;

    if (ui.theme !== onDark) { ui.theme = onDark; root.dataset.theme = onDark ? 'dark' : 'light'; }
    setS(hint, 'opacity', (G.sliced ? 0 : 1 - sm(0.08, 0.24, i === 0 ? f : 1)).toFixed(3));
    if (ui.beat !== i) {
      ui.beat = i; railNow.textContent = pad2(i + 1);
      railBtns.forEach((b, k) => { if (k === i) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    }
    return busy;
  }

  // 首屏整张纸被一刀切开：先一道刀光划过，再上下两半分开，露出后面深色的舞台
  function heroCut(i, f, hu, t, dt) {
    if (!HS) return;
    // bl = 激光走了几趟（0→1 是光点从左走到右；之后继续涨，用来算切口冷却了多少）
    const bl = i === 0 ? (f - LZ0) / LZD : 9, Lh = HS.L, A = at(Lh, 0), B = at(Lh, 1);
    const lzOn = bl > 0 && bl < 1 && hu <= 0;
    if (bl > 0 && hu <= 0) { laserKerf(A, B, clamp(bl), false); if (lzOn) LZ.hot = true; }
    laserEmit('h', A, B, clamp(bl), lzOn, false, dt);
    const state = hu <= 0 ? 0 : hu >= 1 ? 2 : 1;
    if (HS.ui !== state) {
      HS.ui = state;
      heroBeat.classList.toggle('off', state > 0);
      heroHalves.forEach((h) => h.classList.toggle('on', state === 1));
      paperA.style.visibility = state === 2 ? 'hidden' : '';
      paperB.style.visibility = state === 1 ? 'visible' : 'hidden';
      paperA.style.clipPath = state === 1 ? HS.pclip[0] : '';
      paperB.style.clipPath = HS.pclip[1];
      if (state !== 1) [paperA, paperB].concat(heroHalves).forEach((el) => setS(el, 'transform', ''));
      // 切开的一瞬间：灰烬、火星和纸屑沿切口飞出（只在往下滑时）
      if (state === 1 && dir > 0 && t - G.flakeAt > 1200) {
        G.flakeAt = t;
        for (let k = 0; k < 30; k++) {
          const s0 = rand(-0.5, 0.6) * VW;
          G.parts.push({ t: 'flake', x: HS.c[0] + HS.d[0] * s0, y: HS.c[1] + HS.d[1] * s0, vx: rand(-120, 120), vy: rand(-380, -60), g: 1100, age: 0, life: rand(0.6, 1.1), col: ['#e7e5df', '#3a322c', '#ff7a2f', '#e7e5df', '#2a2420'][k % 5], sz: rand(2, 5.5), rot: rand(0, 6), vr: rand(-14, 14) });
        }
      }
    }
    if (state !== 1) return;
    const D = Math.max(VW, VH) * 0.95, dist = Math.pow(hu, 1.8) * D, rot = 3.2 * hu;
    [1, -1].forEach((k, n) => {
      const tx = HS.n[0] * k * dist + HS.d[0] * k * dist * 0.1, ty = HS.n[1] * k * dist + HS.d[1] * k * dist * 0.1;
      const tf = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) rotate(${(k * rot).toFixed(2)}deg)`;
      setS(n ? paperB : paperA, 'transform', tf);
      setS(heroHalves[n], 'transform', tf);
      // 两半的切口：烧黑的边 + 一线余火，跟着进度慢慢冷却
      const cx = VW / 2, cy = VH / 2, cr = Math.cos(k * rot * Math.PI / 180), sr = Math.sin(k * rot * Math.PI / 180);
      const P = (s) => { const px = HS.c[0] + HS.d[0] * s - cx, py = HS.c[1] + HS.d[1] * s - cy; return [cx + px * cr - py * sr + tx, cy + px * sr + py * cr + ty]; };
      const ix = (HS.n[0] * cr - HS.n[1] * sr) * k, iy = (HS.n[0] * sr + HS.n[1] * cr) * k;
      const hm = burnEdge((h) => P(h * Lh.len - Lh.tc), ix, iy, (h) => heatOf(bl - h), 1, false, VW < 700 ? 0.8 : 1, n * 17 + 5, t);
      if (hm > 0.06) LZ.hot = true;
    });
  }
  // 卡片中心沿 d 方向到卡片边的距离（卡片自己的像素）
  function panelChord(P, d) {
    return Math.min(Math.abs(d[0]) > 1e-3 ? P.w / 2 / Math.abs(d[0]) : 1e9, Math.abs(d[1]) > 1e-3 ? P.h / 2 / Math.abs(d[1]) : 1e9);
  }

  function panel(j, k, ex, ang) {
    const P = panels[j];
    const key = k.toFixed(3) + '|' + ex.toFixed(3) + '|' + ang;
    if (P.last === key) return;
    P.last = key;
    const on = k > 0.001 && ex < 0.999;
    P.el.classList.toggle('on', on);
    P.glow = null;
    if (!on) { P.panel.classList.remove('split'); return; }
    if (ex < EXH) {
      P.panel.classList.remove('split');
      if (k < 0.999) {
        // 从切口展开：一条沿刀口方向的缝，慢慢张开成整张卡片
        const th = normAng(ang), d = [Math.cos(th), Math.sin(th)], n = [-d[1], d[0]];
        const e = 1 - Math.pow(1 - sm(0.1, 0.82, k), 3), hmax = (P.w * Math.abs(n[0]) + P.h * Math.abs(n[1])) / 2 + 6, h = Math.max(0.6, e * hmax);
        const cx = P.w / 2, cy = P.h / 2, L = P.w + P.h;
        const pts = [[-L, h], [L, h], [L, -h], [-L, -h]].map(([a, b]) => [cx + d[0] * a + n[0] * b, cy + d[1] * a + n[1] * b]);
        P.panel.style.clipPath = 'polygon(' + pts.map((p) => p[0].toFixed(1) + 'px ' + p[1].toFixed(1) + 'px').join(',') + ')';
        P.glow = { t: 'band', d, n, h, a: 1 - sm(0.5, 0.97, k), g: sm(0, 0.14, k) };
      } else P.panel.style.clipPath = '';
      P.items.forEach(([el, nn]) => {
        const v = sm(0.36 + nn * 0.045, 0.68 + nn * 0.045, k);
        el.style.opacity = v.toFixed(3);
        el.style.transform = `translate3d(0,${((1 - v) * 18).toFixed(1)}px,0)`;
      });
      P.nums.forEach((b) => { b.textContent = Math.round(+b.dataset.n * sm(0.5, 0.95, k)); });
    } else {
      // 离场：被切成两半，各自往两边滑开、往下掉
      P.panel.style.clipPath = '';
      P.panel.classList.add('split');
      const u = (ex - EXH) / (1 - EXH), th = EXA[j], d = [Math.cos(th), Math.sin(th)], n = [-d[1], d[0]];
      const dist = 30 * u + 260 * u * u, drop = 200 * u * u, rot = 7 * u;
      const tr = [];
      P.halves.forEach((hv, q) => {
        const kk = q ? -1 : 1, tx = n[0] * kk * dist + d[0] * kk * dist * 0.25, ty = n[1] * kk * dist + d[1] * kk * dist * 0.25 + drop;
        tr.push([tx, ty, kk * rot]);
        hv.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) rotate(${(kk * rot).toFixed(2)}deg)`;
        hv.style.opacity = (1 - sm(0.35, 0.95, u)).toFixed(3);
      });
      P.glow = { t: 'split', d, tr, a: 1 - sm(0.35, 0.95, u), lt: ex / EXH };
    }
  }
  function drawPanelGlow(P, t) {
    if (!P || !P.glow || !P.el.classList.contains('on')) return;
    const G2 = P.glow, f = P.fit, S = (x, y) => [P.sx + (x - P.w / 2) * f, P.sy + (y - P.h / 2) * f];
    const cx = P.w / 2, cy = P.h / 2;
    fx.save();
    fx.beginPath(); fx.rect(P.sx - P.w * f / 2 - 2, P.sy - P.h * f / 2 - 2, P.w * f + 4, P.h * f + 4); fx.clip();
    if (G2.t === 'band') {
      const Lg = (P.w + P.h) * G2.g;
      [1, -1].forEach((s) => {
        const a = S(cx + G2.n[0] * G2.h * s - G2.d[0] * Lg, cy + G2.n[1] * G2.h * s - G2.d[1] * Lg), b = S(cx + G2.n[0] * G2.h * s + G2.d[0] * Lg, cy + G2.n[1] * G2.h * s + G2.d[1] * Lg);
        glowLine(a[0], a[1], b[0], b[1], G2.a, true);
      });
      fx.restore();
      return;
    }
    fx.restore();
    // 两半各自的切口：烧黑的边 + 一线余火，跟着进度冷却
    const tmax = panelChord(P, G2.d), nn = [-G2.d[1], G2.d[0]];
    G2.tr.forEach(([tx, ty, rot], q) => {
      const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180), kk = q ? -1 : 1;
      const Pt = (tt) => { const px = G2.d[0] * tt, py = G2.d[1] * tt; return S(cx + px * c - py * s + tx, cy + px * s + py * c + ty); };
      const ix = (nn[0] * c - nn[1] * s) * kk, iy = (nn[0] * s + nn[1] * c) * kk;
      const hm = burnEdge((h) => Pt(-tmax + 2 * tmax * h), ix, iy, (h) => heatOf(G2.lt - h), G2.a, true, f, q * 23 + P.w % 7, t);
      if (hm > 0.06) LZ.hot = true;
    });
  }

  /* ---------- 循环：只有需要动的时候才跑 ---------- */
  function frame(t) {
    raf = 0; lastFrame = t;
    const dt = Math.min(0.05, (t - (lastT || t)) / 1000); lastT = t;
    cur += (target - cur) * (1 - Math.exp(-dt / 0.055));
    if (Math.abs(target - cur) < 0.6) cur = target;
    let busy = false;
    try { busy = cur > total + VH + 50 ? false : render(t, dt); } catch (e) { console.warn(e); flat(); return; } // 舞台整个滚出视口就不画；出错就退回普通页面
    if ((busy || cur !== target) && !document.hidden) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function kick() {
    if (!raf && !document.hidden) raf = requestAnimationFrame(frame);
    clearTimeout(fbT);
    // 后台标签页里 rAF 不跑：直接放到终点
    fbT = setTimeout(() => { if (performance.now() - lastFrame > 250) { cur = target; try { render(performance.now(), 0); } catch (e) { flat(); } } }, 300);
  }
  function onScroll() {
    const y = dbgAt == null ? window.scrollY - trackTop : typeof dbgAt === 'string' ? starts[+dbgAt] + (+dbgAt === 0 ? 0 : 0.62 * BL[+dbgAt] * VH) : dbgAt;
    if (y > target) dir = 1; else if (y < target) dir = -1;
    const past = window.scrollY - trackTop > total + VH * 0.4;
    if (ui.past !== past) { ui.past = past; root.classList.toggle('past', past); }
    target = y; kick();
  }

  /* ---------- 划一刀：鼠标快速划过 / 手指横着划 ---------- */
  let lastPt = null;
  function slice(a, b, ptype) {
    if (b.t - a.t > 90) return;
    let k = trail.length - 1, old = b;
    while (k >= 0 && b.t - trail[k].t < 90) { old = trail[k]; k--; }
    const sdx = b.x - old.x, sdy = b.y - old.y, sd = Math.hypot(sdx, sdy), sp = sd / Math.max(16, b.t - old.t);
    if (sp < (ptype === 'mouse' ? 0.7 : 0.35) || sd < 6) { if (G.sw) G.sw.open = false; return; } // 手慢下来 = 这一刀结束
    const ux = sdx / sd, uy = sdy / sd, t = performance.now();
    let hit = false;
    for (const it of G.items.slice()) if (segDist(it.x, it.y, a, b) < it.r * 0.62) { sliceItem(it, a, b, ux, uy, sp, t); hit = true; }
    if (cuttable && !early[cuttable.j]) {
      const { c, rpx, pose, j } = cuttable;
      if (segDist(c[0], c[1], a, b) < rpx * 0.7) {
        const ang = Math.atan2(uy, ux), tt = clamp(((c[0] - a.x) * ux + (c[1] - a.y) * uy) / (Math.hypot(b.x - a.x, b.y - a.y) || 1));
        early[j] = { t0: t, ang, cut: makeCut(pose, a.x, a.y, b.x, b.y), L: lineThrough(a.x + (b.x - a.x) * tt, a.y + (b.y - a.y) * tt, ang) };
        setScore(loot.score + 1); pop(c[0], c[1] - rpx * 0.5, '+1', 's', t);
        addLoot('b' + j, 'hand'); hit = true;
      }
    }
    if (hit) kick();
  }
  function ptr(e) {
    const r = stage.getBoundingClientRect();
    const evs = e.getCoalescedEvents && e.getCoalescedEvents().length ? e.getCoalescedEvents() : [e];
    for (const ev of evs) {
      const p = { x: ev.clientX - r.left, y: ev.clientY - r.top, t: ev.timeStamp || performance.now() };
      if (lastPt && p.t < lastPt.t) p.t = lastPt.t;
      if (lastPt) slice(lastPt, p, e.pointerType);
      trail.push(p); if (trail.length > 48) trail.shift();
      lastPt = p;
    }
    kick();
  }
  stage.addEventListener('pointermove', ptr, { passive: true });
  stage.addEventListener('pointerdown', (e) => { const r = stage.getBoundingClientRect(); lastPt = { x: e.clientX - r.left, y: e.clientY - r.top, t: e.timeStamp || performance.now() }; trail.length = 0; trail.push(lastPt); }, { passive: true });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((n) => stage.addEventListener(n, () => { lastPt = null; if (G.sw) G.sw.open = false; }, { passive: true }));

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
    stage.removeAttribute('style');
    track.removeAttribute('style'); beats.forEach((b) => b.classList.remove('on', 'off'));
    panels.forEach((P) => { if (P) { P.panel.classList.remove('split'); P.nums.forEach((b) => { b.textContent = b.dataset.n; }); } });
    root.dataset.theme = 'light';
  }
  $('#gl').addEventListener('webglcontextlost', flat);
  const rmq = matchMedia('(prefers-reduced-motion: reduce)');
  if (rmq.addEventListener) rmq.addEventListener('change', (e) => { if (e.matches) flat(); });

  /* ================= 5. 彩蛋：页面最底下的战利品 ================= */
  const lootGrid = $('#lootGrid'), lootSum = $('#lootSum'), lootEmpty = $('#lootEmpty'), lootNote = $('#lootNote');
  const thumbs = new Map();
  let lootVisible = false, lootPending = false;
  function lootChanged() { lootPending = true; if (lootVisible) requestAnimationFrame(lootRender); }
  function lootRender() {
    if (!lootPending || !G.ready) return;
    lootPending = false;
    const hand = loot.seq.filter((x) => x.how === 'hand'), auto = loot.seq.filter((x) => x.how === 'scroll'), bomb = loot.seq.find((x) => x.how === 'bomb');
    const shown = hand.concat(bomb ? [bomb] : []);
    const nHand = hand.reduce((a, b) => a + b.n, 0);
    const cats = {};
    hand.forEach((x) => { const c = (KIND[x.k] || {}).cat || '词条'; cats[c] = (cats[c] || 0) + x.n; });
    lootEmpty.hidden = nHand > 0;
    lootSum.textContent = nHand
      ? `一共切下 ${nHand} 块（${Object.keys(cats).map((c) => c + ' ' + cats[c]).join(' · ')}）· 最高连击 ${loot.best}` + (loot.multi >= 2 ? ` · 一刀最多切 ${loot.multi} 个` : '') + ` · 得分 ${loot.score}` + (loot.bombs ? ` · 碰了 ${loot.bombs} 次短路` : '')
      : (loot.bombs ? `只切到了 ${loot.bombs} 颗炸弹……别的一块都没切。` : '');
    lootNote.hidden = !auto.length;
    lootNote.textContent = auto.length ? `往下滑的时候，滚动条替你切开了 ${auto.length} 块（${auto.map((x) => KIND[x.k].name.split(' · ')[1]).join('、')}）——那些不算你的。` : '';
    const html = shown.map((x, q) => {
      const K = KIND[x.k] || { name: x.k, cat: '' };
      return `<li class="loot__it${x.how === 'bomb' ? ' is-bomb' : ''}" style="--d:${q * 45}"><canvas class="loot__cv" data-k="${esc(x.k)}" width="300" height="220" aria-hidden="true"></canvas>
        <p class="loot__no">${pad2(q + 1)} · ${esc(x.how === 'bomb' ? '炸弹' : K.cat)}</p><p class="loot__nm">${esc(K.name)}</p><p class="loot__n">×${x.n}</p></li>`;
    }).join('');
    lootGrid.innerHTML = html;
    lootGrid.hidden = !shown.length;
    drawThumbs();
    renderBoard();
  }
  // 本机前 5 次
  const boardList = $('#boardList'), boardMe = $('#boardMe');
  const fmtD = (ms) => { const d = new Date(ms || Date.now()); return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`; };
  function renderBoard() {
    const runs = rec.runs, meIn = runs.some((r) => r.id === loot.id);
    boardList.innerHTML = runs.length
      ? runs.map((r, q) => {
        const me = r.id === loot.id, top = q === 0 && runs.length > 1;
        return `<li class="board__r${me ? ' is-me' : ''}${top ? ' is-top' : ''}"><span class="board__no">${pad2(q + 1)}</span><b class="board__s">${r.s}<small> 分</small></b><span class="board__c">最高连击 ${r.c}${r.m >= 2 ? ` · 一刀 ${r.m} 切` : ''}</span><span class="board__d">${esc(fmtD(r.t))}</span>${me ? `<span class="board__tag">这一趟${loot.celeS ? ' · 破得分纪录' : ''}${loot.celeC ? ' · 破连击纪录' : ''}</span>` : ''}</li>`;
      }).join('')
      : '<li class="board__none">还没有成绩。回到最上面切几刀，成绩会记在这台设备上。</li>';
    boardMe.hidden = meIn || loot.peak <= 0;
    boardMe.textContent = !meIn && loot.peak > 0 ? `这一趟最高 ${loot.peak} 分、最高连击 ${loot.best}，没挤进前 5。` : '';
    clubRefresh();
  }

  /* ---------- 全社团排行（club-board.js 管接口；接口不通、file:// 打开时整块藏着，只剩上面的本机榜） ----------
   * 一趟 = 这次打开页面以来（sessionStorage 里的 loot）；成绩 = 这一趟到过的最高分 loot.peak。
   * 没昵称：填一次昵称上榜，昵称记在本机。有昵称：划到这里时，这一趟的最高分比上次交的高就自动交。 */
  const CB = window.ClubBoard;
  const club = { el: $('#club'), form: $('#clubForm'), input: $('#clubName'), peak: $('#clubPeak'), who: $('#clubWho'), whoT: $('#clubWhoT'), msg: $('#clubMsg'), list: $('#clubList'), me: $('#clubMe') };
  const CLUB_SENT = 'shuai-v17r2-club-sent';
  let clubData = null, clubAt = 0, clubBusy = false, clubEdit = false, clubNote = '', clubFailAt = 0, clubSent = 0;
  try { const s = JSON.parse(sessionStorage.getItem(CLUB_SENT) || 'null'); if (s && s.id === loot.id) clubSent = +s.s || 0; } catch (e) { /* 读不到就当没交过 */ }
  function clubRefresh() {
    if (!CB || !CB.online || !club.el || clubBusy) return;
    if (clubData && Date.now() - clubAt < 20000) { clubAuto(); clubRender(); return; }
    if (Date.now() - clubFailAt < 30000) return;
    clubBusy = true;
    CB.load('slice', CB.name()).then((r) => {
      clubBusy = false;
      if (!r.ok) { clubFailAt = Date.now(); return; } // 不通：保持原样（从没通过就一直藏着）
      clubData = r.data; clubAt = Date.now();
      club.el.hidden = false;
      clubAuto(); clubRender();
    });
  }
  function clubAuto() {
    const name = CB.name(), me = clubData && clubData.me && CB.same(clubData.me.name, name) ? clubData.me : null;
    if (!name || clubEdit || clubBusy || loot.peak <= clubSent || (me && me.score >= loot.peak) || Date.now() - clubFailAt < 60000) return;
    clubSubmit(name);
  }
  function clubSubmit(name) {
    const s = loot.peak;
    clubBusy = true; clubNote = '正在上榜…'; clubRender();
    CB.submit('slice', name, s).then((r) => {
      clubBusy = false;
      if (r.ok) {
        CB.setName(name); clubEdit = false; clubSent = s;
        try { sessionStorage.setItem(CLUB_SENT, JSON.stringify({ id: loot.id, s })); } catch (e) { /* 存不了：刷新后可能再交一次，服务器只留最高，没关系 */ }
        clubData = r.data; clubAt = Date.now();
        const me = r.data.me;
        clubNote = !me ? `交上去了，不过 ${s} 分还没挤进榜（只留前 ${r.data.kept} 名）。`
          : r.data.improved ? `上榜了：${s} 分，全社团第 ${me.rank} 名。`
          : `这一趟 ${s} 分没超过你榜上的 ${me.score} 分，还是第 ${me.rank} 名。`;
      } else {
        clubFailAt = Date.now();
        if (r.status === 409) { if (CB.same(CB.name(), name)) CB.setName(''); clubEdit = true; clubFailAt = 0; }
        clubNote = r.status === 409 || r.status === 429 || r.status === 400 ? (r.msg || '没交上去，换个昵称试试') : '排行榜暂时连不上，成绩先记在本机了。';
      }
      clubRender();
    });
  }
  function clubRender() {
    if (!clubData) return;
    const name = CB.name(), me = clubData.me && CB.same(clubData.me.name, name) ? clubData.me : null;
    club.peak.textContent = loot.peak;
    club.form.hidden = !(clubEdit || (!name && loot.peak > 0));
    club.who.hidden = !name || clubEdit;
    club.whoT.textContent = name ? `昵称「${name}」` + (me ? ` · 榜上最高 ${me.score} 分，第 ${me.rank} 名` : loot.peak > 0 ? '' : ' · 切出得分后，划到这里会自动上榜') : '';
    club.msg.textContent = clubNote || (!name && loot.peak <= 0 && !clubEdit ? '先回最上面切几刀，有了得分就能上榜。' : '');
    const rows = clubData.top.map((r) => {
      const li = document.createElement('li'), mine = CB.same(r.name, name);
      li.className = 'board__r' + (mine ? ' is-me' : '') + (r.rank === 1 ? ' is-top' : '');
      const cell = (tag, cls, txt) => { const e = document.createElement(tag); e.className = cls; e.textContent = txt; li.appendChild(e); return e; };
      cell('span', 'board__no', pad2(r.rank));
      const b = cell('b', 'board__s', String(r.score)), u = document.createElement('small'); u.textContent = ' 分'; b.appendChild(u);
      cell('span', 'board__c board__nm', r.name);
      cell('span', 'board__d', String(r.time || '').replace(/-/g, '.'));
      return li;
    });
    if (!rows.length) { const li = document.createElement('li'); li.className = 'board__none'; li.textContent = '还没有人上榜，第一个就是你。'; rows.push(li); }
    club.list.replaceChildren(...rows);
    club.me.hidden = !(me && me.rank > clubData.top.length);
    club.me.textContent = me && me.rank > clubData.top.length ? `你在全社团第 ${me.rank} 名（一共 ${clubData.total} 人上榜）。` : '';
  }
  if (CB && club.el) {
    club.form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (clubBusy) return;
      const n = CB.cleanName(club.input.value), err = CB.checkName(n);
      if (err) { clubNote = err; clubRender(); club.input.focus(); return; }
      if (loot.peak <= 0) { CB.setName(n); clubEdit = false; clubNote = '记住了。切出得分后划到这里，会自动用这个昵称上榜。'; clubRender(); return; }
      clubSubmit(n);
    });
    club.form.appendChild(Object.assign(document.createElement('p'), { className: 'club__fine', textContent: '昵称记在这台设备上，下次不用再填。不想上榜就不填，照样能玩。' }));
    $('#clubRename').addEventListener('click', () => {
      clubEdit = true; clubNote = ''; club.input.value = CB.name(); clubRender(); club.input.focus();
    });
    const off = document.createElement('button');
    off.type = 'button'; off.className = 'club__link'; off.textContent = '不上榜了';
    off.addEventListener('click', () => { CB.setName(''); clubEdit = false; clubNote = '好，不再自动上榜。想上榜时再填个昵称。'; clubRender(); });
    club.who.appendChild(off);
  }
  // 用同一个 WebGL 画布给每样东西拍一张"切成两半"的小照片（同一帧里画完再还原，屏幕上看不到）
  function drawThumbs() {
    const cvs = $$('.loot__cv', lootGrid);
    if (!cvs.length) return;
    const TW = 150, TH = 110;
    let resized = false;
    try {
      cvs.forEach((cv) => {
        const k = cv.dataset.k;
        let img = thumbs.get(k);
        if (!img) {
          const o = getObj(k);
          if (!o) return;
          if (!resized) { R.size(TW, TH, 2); resized = true; }
          R.clear();
          const K = KIND[k], s = K.word ? Math.min(5.6 / o.span, 2.7) : Math.min(4.4 / o.span, 3.5 / (2 * o.rad));
          const e = K.word ? { pitch: -0.32, yaw: 0.18, roll: -0.04 } : K.pose === 'can' ? { pitch: -1.05, yaw: 0.3, roll: 0.3 } : K.pose === 'bomb' ? { pitch: -0.2, yaw: 0.25, roll: 0 } : { pitch: -0.62, yaw: 0.36, roll: -0.12 };
          const pose = { e, T: [0, 0, 0], s }, ang = K.word ? 1.3 : 1.12;
          const cut = makeCut(pose, TW / 2 - Math.cos(ang) * 30, TH / 2 - Math.sin(ang) * 30, TW / 2 + Math.cos(ang) * 30, TH / 2 + Math.sin(ang) * 30);
          [1, -1].forEach((kk) => {
            const h = hinge(cut, kk, 0.3, 0.06, o), sp = 0.1 * o.span * s;
            R.draw(o, { R: h.R, T: [cut.sep[0] * kk * sp + h.off[0], cut.sep[1] * kk * sp + h.off[1], h.off[2]], s, plane: cut.plane, side: kk, heat: 0.22 });
          });
          img = document.createElement('canvas'); img.width = TW * 2; img.height = TH * 2;
          img.getContext('2d').drawImage(R.cv, 0, 0);
          thumbs.set(k, img);
        }
        const c2 = cv.getContext('2d'); c2.clearRect(0, 0, cv.width, cv.height); c2.drawImage(img, 0, 0, cv.width, cv.height);
      });
    } finally {
      if (resized) {
        R.size(VW, VH, dpr); R.clear();
        if (cur <= total + VH + 50) { try { render(performance.now(), 0); } catch (e) { /* 下一帧会再画 */ } }
      }
    }
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { lootVisible = es[0].isIntersecting; if (lootVisible) { lootPending = true; lootRender(); } }, { rootMargin: '0px 0px 300px 0px' }).observe(lootSec);
  } else { lootVisible = true; }
  $('#lootBack').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); });

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
  $('#hintT').textContent = matchMedia('(pointer: coarse)').matches ? '手指横着划，把它们切开' : '鼠标划过去，把它们切开';
  cutN.textContent = loot.score; showBest();
  if (loot.celeS) bestBox.classList.add('is-new');
  try { relayout(true); } catch (e) { flat(); return; }
  if (/[?&]debug/.test(location.search)) window.__v17 = { G, loot: () => loot, rec: () => rec, LZ }; // 调试用（自动化测试读物件位置）
  const q = new URLSearchParams(location.search).get('at');
  if (q) {
    const m = /^b([0-4])$/.exec(q), y = parseFloat(q);
    if (m || !isNaN(y)) { dbgAt = m ? m[1] : y; onScroll(); cur = target; } // 调试：不真的滚动，直接把舞台放到这个进度（无头截图用）
  }
  kick();

  // 贴图要用宋体：等字体（最多 1.8 秒）和小智头像就绪再造物体；之后分批造，不卡主线程
  const zhi = new Image();
  const imgReady = new Promise((ok) => { zhi.onload = zhi.onerror = ok; zhi.src = window.ZHI_FLAT_SRC || '../shared/img/ip/zhi-flat.webp'; });
  const fontReady = document.fonts && document.fonts.load
    ? Promise.all(['900 40px "SHU Serif"', '400 12px "SHU Serif"', '400 12px "Geist Mono"'].map((s) => document.fonts.load(s, LABEL.join('') + WORDS.map((w) => w[0] + w[1]).join('') + '上海大学人工智能社通信与信息工程学院团委焊接课成立年嵌入式超声波测距企业参访短路连切断了得分'))).catch(() => 0)
    : Promise.resolve();
  Promise.race([Promise.all([imgReady, fontReady]), new Promise((ok) => setTimeout(ok, 1800))]).then(() => {
    try {
      window.SliceGL.Q = VW < 768 || matchMedia('(pointer: coarse)').matches ? 0.5 : 1;
      objs[1] = OBJ.chip(R, LABEL[1]);
      objs[2] = OBJ.pcb(R, LABEL[2]);
      objs[3] = OBJ.badge(R, LABEL[3], zhi.complete && zhi.naturalWidth ? zhi : null);
      objs[4] = OBJ.lid(R, LABEL[4]);
      relayout(true);
    } catch (e) { console.warn(e); flat(); return; }
    // 游戏物件：先造几样就开场，其余一样一样补上
    const words = Object.keys(KIND).filter((k) => KIND[k].word).sort(() => Math.random() - 0.5);
    const queue = ['pcb', 'chip', words[0], words[1], 'dev', words[2], 'sonar', words[3], 'lid', 'bomb', words[4], 'ecap', 'badge', words[5], 'res', 'led'].concat(words.slice(6));
    const step = () => {
      const k = queue.shift();
      if (!k) { lootRender(); return; }
      try { getObj(k); } catch (e) { console.warn(e); }
      if (built.size >= 3 && !G.ready) { G.ready = true; G.next = G.gt + 0.1; kick(); }
      setTimeout(step, 16);
    };
    step();
  });
})();
