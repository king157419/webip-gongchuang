/* v18-solder · 上海大学人工智能社 · 焊接：滑动 = 烙铁走线
 * 原生滚动 + 吸顶舞台：滚动进度一一对应烙铁的位置。每一拍 = 走线并焊上（动作）→ 停住可读 → 过渡。
 * 不拦截滚轮/触摸、不吸附；prefers-reduced-motion 或初始化失败时退回普通分节页面（去掉 html.live）。
 * 调试：?at=像素 直接滚到某处；?beat=0..4 直接看某一拍的可读段；?flat 看退回版。 */
(function () {
'use strict';
var C = window.CLUB, d = document, root = d.documentElement, M = Math;

function $(s, el) { return (el || d).querySelector(s); }
function $$(s, el) { return Array.prototype.slice.call((el || d).querySelectorAll(s)); }
function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function sm(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function seg(v, a, b) { return b - a < 1e-6 ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a), 0, 1); }
function bell(t) { return M.sin(clamp(t, 0, 1) * M.PI); }
function dist(a, b) { return M.sqrt((b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y)); }
function rng(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = M.imul(a ^ (a >>> 15), 1 | a);
    t = (t + M.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  var n = M.imul(x | 0, 374761393) ^ M.imul(y | 0, 668265263) ^ 0x5bd1e995;
  n = M.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y) {
  var xi = M.floor(x), yi = M.floor(y), u = sm(x - xi), v = sm(y - yi);
  return lerp(lerp(hash2(xi, yi), hash2(xi + 1, yi), u), lerp(hash2(xi, yi + 1), hash2(xi + 1, yi + 1), u), v);
}
function cs(gr, a) { for (var i = 0; i < a.length; i += 2) gr.addColorStop(a[i], a[i + 1]); return gr; }
function infl(r, p) { return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p }; }
function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

/* ============================ 内容（两种模式共用） ============================ */
var PROG = {
  weld: '从焊好一个点到焊好一根线，学长学姐一对一带。',
  course: '和华为合作的实践课：MindSpore、Transformer、BERT 微调。',
  visit: '华为全联接大会、鸿蒙生态学堂、鲲鹏开发者众测。',
  contest: '协办上海大学人工智能创新大赛，从报名到决赛答辩。',
  talk: '学长学姐讲科研、讲论文、讲保研与项目经验。'
};
var PICK = [
  ['2026-05-11', '昇腾 AI 大模型创新实践课', '四十余名同学经限额报名入选'],
  ['2026-04-13', '2025 年人工智能创新大赛决赛', '社团协办 · 翔英大楼 T608'],
  ['2025-11-06', '创新技能大赛焊接专项赛', '社团协办 · 报名百余人'],
  ['2024-12-09', 'AI 论文分享会', '近 200 名同学参加'],
  ['2024-09-24', '2024 华为全联接大会', '组织百余名同学参观']
];
var LEAD = { '任捷': '电子信息工程专业。2026 年秋季的焊接课上，就是他给新同学讲焊接基础和安全规范。' };
var KIND = ['res', 'elec', 'disc', 'xtal', 'diode'];
var NAMES = [['社团', '社团是什么'], ['日常', '平时做什么'], ['做过', '做过的事'], ['带队', '谁在带大家'], ['加入', '怎么加入']];
var WX = '上海大学通信学院';

function ym(s) { return String(s).slice(0, 7).replace('-', '.'); }
function ymd(s) { return String(s).replace(/-/g, '.'); }
function firstClause(s) { return String(s || '').split(/[；。]/)[0]; }
function fill(id, html) { var el = d.getElementById(id); if (el) el.innerHTML = html; return el; }

function renderContent() {
  if (!C) return;
  var meta = C.meta || {}, news = C.news || [], ppl = C.people || {}, join = C.join || {};
  var depts = meta.departments || [];
  if (meta.contact && meta.contact.wechat) WX = String(meta.contact.wechat).replace(/（[^）]*）|\([^)]*\)/g, '').trim() || WX;

  fill('progs', (C.programs || []).map(function (p, i) {
    return '<li class="prog"><div class="comp ko" data-kind="' + KIND[i % KIND.length] + '" aria-hidden="true"></div>' +
      '<h3 class="ink ko">' + esc(p.name) + '</h3><p class="ink ko">' + esc(PROG[p.id] || firstClause(p.desc)) + '</p></li>';
  }).join(''));

  var picks = [];
  PICK.forEach(function (pk) {
    var n = news.filter(function (x) { return x.date === pk[0]; })[0];
    if (n) picks.push({ n: n, t: pk[1], f: pk[2] });
  });
  for (var i = 0; picks.length < 4 && i < news.length; i++) {
    if (!picks.some(function (p) { return p.n === news[i]; })) picks.push({ n: news[i], t: String(news[i].title).slice(0, 16), f: '' });
  }
  fill('chips', picks.map(function (p) {
    return '<li><a class="chip ko" href="' + esc(p.n.source) + '" target="_blank" rel="noopener" aria-label="' +
      esc(ymd(p.n.date) + ' ' + p.n.title + '（学院官网原文，新窗口打开）') + '">' +
      '<span class="ink c-date">' + esc(ym(p.n.date)) + '</span><span class="ink c-t">' + esc(p.t) + '</span>' +
      (p.f ? '<span class="ink c-f">' + esc(p.f) + '</span>' : '') + '<i class="glint" aria-hidden="true"></i></a></li>';
  }).join(''));
  fill('news-sub', '学院官网报道过 ' + news.length + ' 次，这里挑出 ' + picks.length + ' 件。');
  fill('btn-all', '全部 ' + news.length + ' 篇报道');
  fill('dlg-h', '全部 ' + news.length + ' 篇报道');
  fill('nlist', news.map(function (n) {
    return '<li><a href="' + esc(n.source) + '" target="_blank" rel="noopener"><time datetime="' + esc(n.date) + '">' +
      esc(ymd(n.date)) + '</time><span>' + esc(n.title) + '</span><b>原文 ↗</b></a></li>';
  }).join(''));

  var L = (ppl.leaders || [])[0], img = $('#lead-photo');
  if (L) {
    fill('lead-a', '<p class="lead-role ink ko">' + esc(L.role) + '</p><p class="lead-name ink ko">' + esc(L.name) + '</p>' +
      '<p class="lead-desc ink ko">' + esc(LEAD[L.name] || firstClause(L.desc)) + '</p>');
    if (L.photo && img) { img.src = '../shared/img/' + L.photo; img.alt = L.role + L.name + '的照片'; }
  }
  var b = '';
  if (L && L.awards && L.awards.length) b += '<ul class="awards ink ko">' + L.awards.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul>';
  var T = ppl.teachers || [];
  if (T.length) b += '<p class="tea ink ko"><span>指导老师</span>' + T.map(function (t) { return esc(t.name); }).join(' · ') + '</p>';
  if (depts.length) b += '<p class="depts ink ko"><span class="dl">' + depts.length + ' 个部门</span>' + depts.map(function (x) { return '<b>' + esc(x.name) + '</b>'; }).join('') + '</p>';
  fill('lead-b', b);

  fill('steps', (join.steps || []).map(function (s, n) {
    return '<li class="ink ko"><b>' + (n + 1) + '</b><span><strong>' + esc(s.t) + '</strong>' + esc(s.d) + '</span></li>';
  }).join(''));
  fill('led-hint', '点这颗灯，复制公众号名<b>' + esc(WX) + '</b>');
  var led = $('#bigled'); if (led) led.setAttribute('aria-label', '复制公众号名：' + WX);

  fill('faq', (join.faq || []).map(function (f) { return '<dt>' + esc(f.q) + '</dt><dd>' + esc(f.a) + '</dd>'; }).join(''));
  var info = [['挂靠', meta.host], ['类型', meta.type], ['成立', meta.founded ? meta.founded + ' 年' : ''],
    ['部门', depts.map(function (x) { return x.name; }).join(' / ')], ['面向', meta.audience], ['活动地点', meta.location], ['公众号', WX]];
  fill('info', info.filter(function (x) { return x[1]; }).map(function (x) {
    return '<li><span>' + esc(x[0]) + '</span>' + esc(x[1]) + '</li>';
  }).join(''));

  var tps = $('#tps');
  if (tps) tps.innerHTML = NAMES.map(function (n, i) {
    return '<button class="tp" type="button" data-b="' + i + '" aria-label="TP' + (i + 1) + ' ' + n[1] + '"><span class="nm">' + n[0] +
      '</span><span class="lb">TP' + (i + 1) + '</span><span class="ring"></span></button>';
  }).join('') + '<span class="tpn" aria-hidden="true"></span>';
}

/* 复制公众号名：HTTP 下没有 navigator.clipboard，用隐藏 textarea + execCommand */
function copyWX(btn) {
  var ok = false, ta = d.createElement('textarea'), msg = $('#led-msg');
  ta.value = WX; ta.setAttribute('readonly', '');
  ta.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
  d.body.appendChild(ta);
  try { ta.focus({ preventScroll: true }); } catch (e) { ta.focus(); }
  ta.select();
  try { ta.setSelectionRange(0, ta.value.length); ok = d.execCommand('copy'); } catch (e) { ok = false; }
  d.body.removeChild(ta);
  if (btn) { try { btn.focus({ preventScroll: true }); } catch (e) { /* 忽略 */ } btn.classList.remove('blink'); void btn.offsetWidth; btn.classList.add('blink'); }
  if (msg) msg.textContent = ok ? '已复制「' + WX + '」，去微信里搜索关注' : '微信里搜索：' + WX;
}

var go = function (b) { var el = d.getElementById('s' + b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

function wire() {
  var led = $('#bigled'), dlg = $('#dlg');
  if (led) led.addEventListener('click', function () { copyWX(led); });
  $$('[data-go]').forEach(function (el) { el.addEventListener('click', function () { go(+el.getAttribute('data-go')); }); });
  var tps = $('#tps');
  if (tps) tps.addEventListener('click', function (e) { var t = e.target.closest('.tp'); if (t) go(+t.getAttribute('data-b')); });
  var all = $('#btn-all');
  if (all && dlg) {
    all.addEventListener('click', function () { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
    var close = function () { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); };
    $('#dlg-x').addEventListener('click', close);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });
  }
}

/* 把 .ink 里的字拆成一个个 span，CSS 用 --r（0→1）控制"丝印"逐字印出 */
function splitInk(el) {
  var n = 0;
  (function walk(node) {
    Array.prototype.slice.call(node.childNodes).forEach(function (c) {
      if (c.nodeType === 3) {
        if (!c.nodeValue.trim()) return;
        var frag = d.createDocumentFragment();
        Array.from(c.nodeValue).forEach(function (ch) {
          if (/\s/.test(ch)) { frag.appendChild(d.createTextNode(ch)); return; }
          var s = d.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', n++); s.textContent = ch; frag.appendChild(s);
        });
        node.replaceChild(frag, c);
      } else if (c.nodeType === 1 && !c.classList.contains('glint')) walk(c);
    });
  })(el);
  el.style.setProperty('--n', n);
}

/* ================================ 吸顶舞台 ================================ */
function initLive() {
  var stage = $('#stage'), world = $('#world'), track = $('#track');
  var cvB = $('#cv-board'), cvF = $('#cv-fx');
  var gB = cvB.getContext('2d'), gF = cvF.getContext('2d');
  if (!gB || !gF) throw new Error('2d context');
  var sts = $$('.st', world).map(function (el) { return { el: el }; });
  if (sts.length !== 5) throw new Error('stations');
  $$('.ink', world).forEach(splitInk);

  var CO = { bench: '#0f1211', sub: '#09241a', pour: '#123b2b', cu: '#1f5d44', cuHi: 'rgba(180,245,205,0.09)', silk: 'rgba(238,236,227,0.9)', silkD: 'rgba(238,236,227,0.5)' };
  var A0 = 0.32;
  var W, H, k, mob, dpr, mrg, lane, worldH;
  var J = [], JB = [], TRm = [], TRd = [], TRp = [], TRi = [], TRall = [], VIA = [], PART = [], SEGB = [], KO = [], MH = [], FID = [];
  var PW = null, TPM = [], logoRect = null, beats = [], segs = [], total = 0, trackTop = 0, refN = 0;
  var tiles = {}, tileQ = 0, noisePat = null, silkLogo = null, smokeDot = null, logoImg = null;
  var sT = 0, sD = 0, raf = 0, lastT = 0, lastCam = null, curB = -1, powerT0 = -1e9;
  var ptr = { x: -1e4, y: -1e4, heat: 0, t: 0 }, aOff = 0;
  var binds = [], tpBtns = $$('.tp'), tpNum = $('.tpn');

  /* ---------- 几何：从 DOM 量出元件位置，生成焊点、走线、装饰 ---------- */
  function cumul(p) { var c = [0]; for (var i = 1; i < p.length; i++) c.push(c[i - 1] + dist(p[i - 1], p[i])); return c; }
  function along(p, c, L) {
    if (L <= 0) return p[0];
    for (var i = 1; i < p.length; i++) if (c[i] >= L) {
      var u = (L - c[i - 1]) / ((c[i] - c[i - 1]) || 1);
      return { x: lerp(p[i - 1].x, p[i].x, u), y: lerp(p[i - 1].y, p[i].y, u) };
    }
    return p[p.length - 1];
  }
  function tr(p, w) {
    var c = cumul(p), x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    p.forEach(function (q) { x0 = M.min(x0, q.x); x1 = M.max(x1, q.x); y0 = M.min(y0, q.y); y1 = M.max(y1, q.y); });
    return { p: p, w: w, cum: c, len: c[c.length - 1] || 1, x0: x0 - w, x1: x1 + w, y0: y0 - w, y1: y1 + w };
  }
  function octo(p) { // 去重、去共线，直角处切 45° 倒角（真板子的走线习惯）
    var q = [p[0]], i;
    for (i = 1; i < p.length; i++) { var l = q[q.length - 1]; if (M.abs(p[i].x - l.x) + M.abs(p[i].y - l.y) > 0.5) q.push(p[i]); }
    for (i = q.length - 2; i > 0; i--) {
      var a = q[i - 1], b = q[i], c = q[i + 1];
      if (M.abs((b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)) < 0.5) q.splice(i, 1);
    }
    var out = [q[0]];
    for (i = 1; i < q.length - 1; i++) {
      var A = q[i - 1], B = q[i], Cc = q[i + 1], l1 = dist(A, B), l2 = dist(B, Cc), ch = M.min(16 * k, l1 / 2, l2 / 2);
      out.push({ x: B.x + (A.x - B.x) / l1 * ch, y: B.y + (A.y - B.y) / l1 * ch });
      out.push({ x: B.x + (Cc.x - B.x) / l2 * ch, y: B.y + (Cc.y - B.y) / l2 * ch });
    }
    out.push(q[q.length - 1]);
    return out;
  }
  function connect(A, B) {
    if (M.abs(A.y - B.y) < 1.5) return [A, { x: B.x, y: A.y }];
    if (M.abs(A.x - B.x) < 1.5) return [A, B];
    var gy = B.y - 26 * k;
    return octo([A, { x: lane, y: A.y }, { x: lane, y: gy }, { x: B.x, y: gy }, B]);
  }

  function build() {
    W = stage.clientWidth || window.innerWidth; H = stage.clientHeight || window.innerHeight;
    if (W < 200 || H < 200) throw new Error('stage too small');
    mob = W < 760; k = mob ? 0.72 : W < 1100 ? 0.86 : 1;
    dpr = M.min(window.devicePixelRatio || 1, 1.5);
    mrg = mob ? 6 : 16;
    lane = W - (mob ? 19 : W < 1280 ? 104 : 150);
    world.style.transform = 'translate3d(0,0,0)'; lastCam = 0;
    var top = 0;
    sts.forEach(function (s) {
      s.el.style.minHeight = H + 'px'; s.el.style.top = top + 'px';
      s.top = top; s.h = M.ceil(s.el.offsetHeight); s.max = s.top + M.max(0, s.h - H); top += s.h;
    });
    worldH = top;
    var wr = world.getBoundingClientRect();
    function R(el) { var r = el.getBoundingClientRect(); return { x: r.left - wr.left, y: r.top - wr.top, w: r.width, h: r.height }; }
    KO = $$('.ko', world).map(function (el) { return infl(R(el), 13 * k); });
    J = []; TRm = []; TRp = []; TRi = [];

    /* 首屏电源区：USB-C（窄屏为 2 针插座）→ 稳压 U1 → R1 → 电源灯 D1 → 起点焊盘 */
    var P = R($('[data-part=pwr]'));
    var u1 = { x: P.x + P.w * 0.3, y: P.y + P.h * 0.38 }, r1 = { x: P.x + P.w * 0.5, y: P.y + P.h * 0.62 };
    var d1 = { x: P.x + P.w * 0.66, y: r1.y }, j0 = { x: P.x + P.w * 0.88, y: r1.y };
    var usb = !mob && W >= 1280;
    PW = { u1: u1, r1: r1, d1: d1, j0: j0, usb: usb, P: P, inp: usb ? { x: u1.x, y: mrg } : { x: P.x + 10 * k, y: u1.y },
      c1: { x: u1.x - 30 * k, y: u1.y + 2 * k }, c2: { x: u1.x + 30 * k, y: u1.y + 2 * k } };
    if (usb) { TRp.push(tr([{ x: u1.x, y: mrg + 24 * k }, { x: u1.x, y: u1.y - 12 * k }], 4 * k)); KO.push({ x: u1.x - 28 * k, y: 0, w: 56 * k, h: mrg + 40 * k }); }
    else TRp.push(tr(octo([{ x: PW.inp.x + 8 * k, y: u1.y }, { x: PW.inp.x + 18 * k, y: u1.y }, { x: PW.inp.x + 18 * k, y: u1.y - 22 * k }, { x: u1.x, y: u1.y - 22 * k }, { x: u1.x, y: u1.y - 12 * k }]), 4 * k));
    TRp.push(tr(octo([{ x: u1.x, y: u1.y + 12 * k }, { x: u1.x, y: r1.y }, { x: r1.x - 7 * k, y: r1.y }]), 3.4 * k));
    TRp.push(tr([{ x: r1.x + 7 * k, y: r1.y }, { x: d1.x - 8 * k, y: r1.y }], 3 * k));
    TRp.push(tr([{ x: d1.x + 8 * k, y: r1.y }, { x: j0.x, y: j0.y }], 3 * k));
    J.push({ b: 0, type: 'tht', x: j0.x, y: j0.y, ex: j0.x, ey: j0.y, ox: j0.x, oy: j0.y, pre: true, rp: 7 * k });

    /* ② 五个直插元件：左脚是待焊点，右脚已焊好，右边是指示灯 */
    $$('.comp', world).forEach(function (el, n) {
      var r = R(el), cy = r.y + r.h / 2, lx = r.x + 8 * k, rx = r.x + r.w * 0.72, lex = r.x + r.w * 0.86;
      var j = { b: 1, type: 'tht', kind: el.getAttribute('data-kind'), x: lx, y: cy, ex: lx, ey: cy, ox: r.x + r.w, oy: cy, rx: rx, lex: lex, r: r, rp: (mob ? 6.5 : 7.8) * k, idx: n };
      j.inA = tr([{ x: rx, y: cy }, { x: lex - 8 * k, y: cy }], 2.6 * k);
      j.inB = tr([{ x: lex + 8 * k, y: cy }, { x: r.x + r.w, y: cy }], 2.6 * k);
      TRi.push(j.inA, j.inB);
      J.push(j);
    });
    /* ③ 一排芯片：烙铁沿上排引脚拖焊 */
    $$('.chip', world).forEach(function (el, n) {
      var q = R(el), cnt = clamp(M.round(q.w / (17 * k)), 6, 16), x0 = q.x + 13 * k, x1 = q.x + q.w - 13 * k, pins = [];
      for (var i = 0; i < cnt; i++) pins.push(lerp(x0, x1, i / (cnt - 1)));
      var py = q.y - 7 * k;
      J.push({ b: 2, type: 'drag', x: x0, y: py, ex: x1, ey: py, ox: x1, oy: py, q: q, pins: pins, idx: n, pw: M.min((x1 - x0) / (cnt - 1) * 0.56, 7 * k) });
    });
    /* ④ 屏幕模块：四根排针 */
    var D = R($('#disp')), hp = 15 * k, hy = D.y + (mob ? 13 : 19) * k, hx = D.x + D.w / 2 - 1.5 * hp;
    for (var i = 0; i < 4; i++) J.push({ b: 3, type: 'tht', post: true, sq: i === 0, x: hx + i * hp, y: hy, ex: hx + i * hp, ey: hy, ox: hx + i * hp, oy: hy, rp: 5.6 * k, D: D, idx: i });
    /* ⑤ 大功率 LED：两块贴片焊盘 */
    var B = R($('#bigled')), by = B.y + B.h / 2, pW = 15 * k, pH = 26 * k, gp = 5 * k;
    var xr = B.x + B.w + gp + pW / 2, xl = B.x - gp - pW / 2;
    J.push({ b: 4, type: 'smd', x: xr, y: by, ex: xr, ey: by, ox: xr, oy: by, pW: pW, pH: pH, B: B, idx: 0 });
    J.push({ b: 4, type: 'smd', x: xl, y: by, ex: xl, ey: by, ox: xl, oy: by, pW: pW, pH: pH, B: B, idx: 1, noTrace: true });
    KO.push(infl({ x: xl - pW, y: by - pH, w: xr - xl + 2 * pW, h: 2 * pH }, 8 * k));

    JB = [];
    J.forEach(function (j, n) { (JB[j.b] = JB[j.b] || []).push(n); });
    for (var b = 0; b < 5; b++) if (!JB[b] || !JB[b].length) throw new Error('joints ' + b);

    /* 每个焊点之间的铜线；跨元件的那一段烙铁是抬起来跳过去的（不点亮） */
    for (i = 1; i < J.length; i++) {
      var a = J[i - 1], j = J[i], Ae = { x: a.ex, y: a.ey }, O = { x: a.ox, y: a.oy }, Tg = { x: j.x, y: j.y };
      var hop = [Ae]; if (dist(Ae, O) > 0.5) hop.push(O);
      if (j.noTrace) { j.rt = null; j.path = hop.concat([Tg]); j.hopLen = cumul(j.path).pop(); }
      else { var rt = connect(O, Tg); j.rt = tr(rt, 3 * k); TRm.push(j.rt); j.path = hop.concat(rt.slice(1)); j.hopLen = cumul(hop).pop(); }
      j.cum = cumul(j.path); j.pathLen = j.cum[j.cum.length - 1] || 1;
    }
    SEGB = [];
    TRm.concat(TRp, TRi).forEach(function (t) {
      for (var n = 1; n < t.p.length; n++) {
        var p0 = t.p[n - 1], p1 = t.p[n], pad = 8 * k + t.w;
        SEGB.push({ x: M.min(p0.x, p1.x) - pad, y: M.min(p0.y, p1.y) - pad, w: M.abs(p1.x - p0.x) + 2 * pad, h: M.abs(p1.y - p0.y) + 2 * pad });
      }
    });
    sts.forEach(function (s, n) {
      if (n === 0) s.park = { x: J[0].x, y: J[0].y };
      else if (mob) s.park = { x: W - 24, y: s.top + M.min(s.h, H) - 122 };
      else s.park = { x: lane - 36 * k, y: s.top + M.min(s.h, H) * 0.8 };
    });
    logoRect = R($('[data-part=logo]'));
    TPM = ['#t0', '#t1', '#t2', '#t3', '#t4'].map(function (sel, n) { var r = R($(sel)); return { x: r.x + 7 * k, y: r.y - 26 * k, n: n + 1 }; });
    decor();
    TRall = TRd.concat(TRm, TRp, TRi);
  }

  /* ---------- 装饰：总线、过孔、已经焊好的小贴片、安装孔、基准点 ---------- */
  function decor() {
    var rnd = rng(2021), occ = KO.slice(), i, x, y;
    TRd = []; VIA = []; PART = []; MH = []; FID = []; refN = 0;
    var BX = [mrg + 12 * k, W - mrg - 12 * k, mrg + 12 * k, worldH - mrg - 12 * k];
    function fits(bb) {
      if (bb.x < BX[0] || bb.x + bb.w > BX[1] || bb.y < BX[2] || bb.y + bb.h > BX[3]) return false;
      for (var n = 0; n < occ.length; n++) if (hit(bb, occ[n])) return false;
      for (n = 0; n < SEGB.length; n++) if (hit(bb, SEGB[n])) return false;
      return true;
    }
    function busLines(xs) {
      var y0 = mrg + 64 * k, y1 = worldH - mrg - 64 * k, ys = [], yy = y0 + (180 + rnd() * 300) * k, o = 0;
      while (yy < y1 - 80 * k) { o = 1 - o; ys.push([yy, o]); yy += (260 + rnd() * 520) * k; }
      xs.forEach(function (bx) {
        var pts = [{ x: bx, y: y0 }], cur = 0;
        ys.forEach(function (e) { var j = 11 * k; pts.push({ x: bx + cur * j, y: e[0] }); cur = e[1]; pts.push({ x: bx + cur * j, y: e[0] + j }); });
        pts.push({ x: bx + cur * 11 * k, y: y1 });
        TRd.push(tr(pts, 2 * k));
        VIA.push({ x: bx, y: y0, r: 3 * k }); VIA.push({ x: bx + cur * 11 * k, y: y1, r: 3 * k });
      });
    }
    if (!mob) {
      busLines([mrg + 22 * k, mrg + 33 * k, mrg + 44 * k]); occ.push({ x: 0, y: 0, w: mrg + 72 * k, h: worldH });
      if (W >= 1280) { busLines([lane + 14 * k, lane + 25 * k, lane + 36 * k]); occ.push({ x: lane - 10 * k, y: 0, w: 70 * k, h: worldH }); }
      occ.push({ x: W - 76, y: 0, w: 76, h: worldH });
    } else {
      occ.push({ x: lane - 9 * k, y: 0, w: W, h: worldH });
      sts.forEach(function (st) { // 窄屏：内容块整体留空，装饰不塞进字缝
        var r = null;
        KO.forEach(function (o) {
          if (o.y + o.h < st.top || o.y > st.top + st.h) return;
          if (!r) r = { x: o.x, y: o.y, w: o.w, h: o.h };
          else { var x0 = M.min(r.x, o.x), y0 = M.min(r.y, o.y); r = { x: x0, y: y0, w: M.max(r.x + r.w, o.x + o.w) - x0, h: M.max(r.y + r.h, o.y + o.h) - y0 }; }
        });
        if (r) occ.push(r);
      });
    }

    var mr = (mob ? 8 : 11) * k, mi = mr * 2.1;
    [[BX[0] + mi, BX[2] + mi], [BX[1] - mi, BX[2] + mi], [BX[0] + mi, BX[3] - mi], [BX[1] - mi, BX[3] - mi]].forEach(function (p) {
      var bb = { x: p[0] - mr * 2.2, y: p[1] - mr * 2.2, w: mr * 4.4, h: mr * 4.4 };
      if (KO.some(function (o) { return hit(bb, o); })) return;
      MH.push({ x: p[0], y: p[1], r: mr }); occ.push(bb);
    });
    [[BX[0] + mi * 2.6, BX[2] + mi * 0.7], [BX[1] - mi * 2.6, BX[3] - mi * 0.7], [BX[1] - mi * 2.8, BX[2] + mi * 0.7]].forEach(function (p) {
      var bb = { x: p[0] - 8 * k, y: p[1] - 8 * k, w: 16 * k, h: 16 * k };
      if (fits(bb)) { FID.push({ x: p[0], y: p[1] }); occ.push(bb); }
    });

    if (!mob) { // 板边过孔围栏
      [BX[0] + 5 * k, BX[1] - 5 * k].forEach(function (fx) {
        for (var fy = BX[2] + 74 * k; fy < BX[3] - 74 * k; fy += 15 * k) {
          var vb = { x: fx - 3 * k, y: fy - 3 * k, w: 6 * k, h: 6 * k };
          if (!KO.some(function (o) { return hit(vb, o); })) VIA.push({ x: fx, y: fy, r: 1.9 * k, st: 1 });
        }
      });
    }
    function nrm(a, b) { var dx = b.x - a.x, dy = b.y - a.y, l = M.sqrt(dx * dx + dy * dy) || 1; return { x: -dy / l, y: dx / l }; }
    function offsetLine(p, o) { // 斜接平移，得到平行走线
      return p.map(function (b, i) {
        var n1 = i > 0 ? nrm(p[i - 1], b) : nrm(b, p[i + 1]), n2 = i < p.length - 1 ? nrm(b, p[i + 1]) : n1;
        var mx = n1.x + n2.x, my = n1.y + n2.y, ml = M.sqrt(mx * mx + my * my) || 1; mx /= ml; my /= ml;
        var dd = o / ((mx * n1.x + my * n1.y) || 1);
        return { x: b.x + mx * dd, y: b.y + my * dd };
      });
    }
    function bbOf(pts) {
      var x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      pts.forEach(function (q) { x0 = M.min(x0, q.x); y0 = M.min(y0, q.y); x1 = M.max(x1, q.x); y1 = M.max(y1, q.y); });
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    }
    function bundle(ya, yb) { // 一束 3–6 根平行细线，中间一段 45° 斜折，两头错开打过孔
      var n = 3 + M.floor(rnd() * (mob ? 2 : 4)), sp = 7.5 * k, hz = rnd() < 0.62, i;
      var d1 = hz ? { x: rnd() < 0.5 ? 1 : -1, y: 0 } : { x: 0, y: 1 }, pr = { x: -d1.y, y: d1.x }, sg = rnd() < 0.5 ? -1 : 1;
      var l1 = (40 + rnd() * (mob ? 70 : 190)) * k, l2 = (40 + rnd() * (mob ? 70 : 190)) * k, dg = (16 + rnd() * 34) * k;
      var P0 = { x: BX[0] + rnd() * (BX[1] - BX[0]), y: ya + rnd() * (yb - ya) };
      var P1 = { x: P0.x + d1.x * l1, y: P0.y + d1.y * l1 };
      var P2 = { x: P1.x + (d1.x + pr.x * sg) * dg, y: P1.y + (d1.y + pr.y * sg) * dg };
      var P3 = { x: P2.x + d1.x * l2, y: P2.y + d1.y * l2 }, c = [P0, P1, P2, P3], lines = [], all = [];
      for (i = 0; i < n; i++) { var L = offsetLine(c, (i - (n - 1) / 2) * sp); lines.push(L); all = all.concat(L); }
      var bb = infl(bbOf(all), 12 * k);
      if (!fits(bb)) return false;
      lines.forEach(function (L, q) {
        var s0 = (q % 2) * 8 * k, s1 = ((q + 1) % 2) * 8 * k;
        var a = { x: L[0].x + d1.x * s0, y: L[0].y + d1.y * s0 }, b = { x: L[3].x - d1.x * s1, y: L[3].y - d1.y * s1 };
        TRd.push(tr([a, L[1], L[2], b], 1.8 * k));
        VIA.push({ x: a.x, y: a.y, r: 2.5 * k }); VIA.push({ x: b.x, y: b.y, r: 2.5 * k });
      });
      occ.push(bb);
      return true;
    }
    function cluster(type, ya, yb) { // 成组的元件：芯片 + 去耦电容、电阻排……
      var x = BX[0] + rnd() * (BX[1] - BX[0]), y = ya + rnd() * (yb - ya), ps = [], i, t;
      if (type === 'array') { var cnt = 4 + M.floor(rnd() * 3); t = rnd() < 0.6 ? 'r' : 'c'; for (i = 0; i < cnt; i++) ps.push(mkPart(t, x + i * 10 * k, y, 1)); }
      else if (type === 'ic') ps.push(mkPart('so8', x, y, 0), mkPart('c', x - 22 * k, y, 1), mkPart('c', x + 22 * k, y, 1), mkPart('r', x, y + 26 * k, 0));
      else if (type === 'qfp') ps.push(mkPart('qfp', x, y, 0), mkPart('c', x - 41 * k, y - 10 * k, 1), mkPart('c', x + 41 * k, y + 10 * k, 1), mkPart('c8', x + 8 * k, y - 43 * k, 0), mkPart('r', x - 6 * k, y + 43 * k, 0));
      else ps.push(mkPart(['r', 'c', 'c8', 'sot'][M.floor(rnd() * 4)], x, y, rnd() < 0.5 ? 0 : 1));
      var bb = ps.reduce(function (a, p) { var b = p.bb, x0 = M.min(a.x, b.x), y0 = M.min(a.y, b.y); return { x: x0, y: y0, w: M.max(a.x + a.w, b.x + b.w) - x0, h: M.max(a.y + a.h, b.y + b.h) - y0 }; }, ps[0].bb);
      if (!fits(infl(bb, 8 * k))) return false;
      ps.forEach(function (p, n) { place(p, n === 0 || (type !== 'array' && rnd() < 0.35)); });
      occ.push(infl(bb, 6 * k));
      if (type === 'array') ps.forEach(function (p, n) { stub(p.pads[1], n % 2 ? 17 * k : 8 * k, true); });
      else ps.forEach(function (p) { p.pads.forEach(function (pd) { if (rnd() < 0.45) stub(pd); }); });
      return true;
    }
    sts.forEach(function (st) {
      var ya = st.top + 30 * k, yb = st.top + st.h - 30 * k, t, got;
      var plan = mob ? [['b', 2], ['ic', 1], ['array', 1], ['one', 4]] : [['b', 4], ['qfp', 1], ['ic', 2], ['array', 2], ['one', 6]];
      plan.forEach(function (pl) {
        for (got = 0, t = 0; got < pl[1] && t < 60; t++) if (pl[0] === 'b' ? bundle(ya, yb) : cluster(pl[0], ya, yb)) got++;
      });
    });
    function place(p, lab) { p.ref = lab ? ({ r: 'R', c: 'C', c8: 'C', sot: 'Q', so8: 'U', qfp: 'U' })[p.t] + (21 + refN++) : null; PART.push(p); }
    function stub(pd, len, straight) {
      var a = len || (6 + rnd() * 10) * k, b2 = straight ? 0 : (5 + rnd() * 9) * k, sg = rnd() < 0.5 ? -1 : 1;
      var p1 = { x: pd.x + pd.dx * a, y: pd.y + pd.dy * a };
      var p2 = straight ? p1 : rnd() < 0.5 ? { x: p1.x + (pd.dx + (pd.dx ? 0 : sg)) * b2, y: p1.y + (pd.dy + (pd.dy ? 0 : sg)) * b2 } : { x: p1.x + pd.dx * b2, y: p1.y + pd.dy * b2 };
      var q0 = { x: pd.x + pd.dx * 5 * k, y: pd.y + pd.dy * 5 * k };
      var bb = infl(bbOf([q0, p1, p2]), 4 * k);
      if (!fits(bb)) return;
      TRd.push(tr(straight ? [{ x: pd.x, y: pd.y }, p1] : [{ x: pd.x, y: pd.y }, p1, p2], 1.7 * k)); VIA.push({ x: p2.x, y: p2.y, r: 2.5 * k }); occ.push(bb);
    }
    var st = (mob ? 22 : 26) * k;
    for (y = BX[2] + st; y < BX[3] - st; y += st) for (x = BX[0] + st; x < BX[1] - st; x += st) {
      var xx = x + (M.round(y / st) % 2 ? st / 2 : 0);
      if (vnoise(xx / (190 * k), y / (190 * k)) < 0.68) continue;
      var vb = { x: xx - 5 * k, y: y - 5 * k, w: 10 * k, h: 10 * k };
      if (!fits(vb)) continue;
      VIA.push({ x: xx, y: y, r: 2.5 * k, st: 1 });
    }
  }
  function mkPart(t, x, y, o) {
    var dm = { r: [17, 9], c: [17, 9], c8: [21, 12], sot: [14, 18], so8: [27, 31], qfp: [54, 54] }[t];
    var w = dm[0] * k, h = dm[1] * k; if (o) { var tw = w; w = h; h = tw; }
    var p = { t: t, x: x, y: y, o: o, pads: [], bb: { x: x - w / 2, y: y - h / 2 - 10 * k, w: w, h: h + 10 * k } };
    function rot(lx, ly, dx, dy) { return o ? { x: x - ly, y: y + lx, dx: -dy, dy: dx } : { x: x + lx, y: y + ly, dx: dx, dy: dy }; }
    if (t === 'r' || t === 'c' || t === 'c8') { var e = (t === 'c8' ? 7 : 5.6) * k; p.pads = [rot(-e, 0, -1, 0), rot(e, 0, 1, 0)]; }
    else if (t === 'sot') p.pads = [rot(-3.8 * k, 6 * k, 0, 1), rot(3.8 * k, 6 * k, 0, 1), rot(0, -6 * k, 0, -1)];
    else if (t === 'so8') p.pads = [rot(-5.7 * k, 11 * k, 0, 1), rot(1.9 * k, 11 * k, 0, 1), rot(5.7 * k, -11 * k, 0, -1)];
    return p;
  }

  /* ---------- 画图小工具 ---------- */
  function rr(g, x, y, w, h, r) {
    if (w <= 0 || h <= 0) { g.beginPath(); return; }
    r = M.max(0, M.min(r, w / 2, h / 2));
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  function circ(g, x, y, r) { g.beginPath(); g.arc(x, y, M.max(0.1, r), 0, M.PI * 2); }
  function poly(g, p) { g.beginPath(); g.moveTo(p[0].x, p[0].y); for (var i = 1; i < p.length; i++) g.lineTo(p[i].x, p[i].y); }
  function line(g, x0, y0, x1, y1) { g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
  function txt(g, s, x, y, sz) { g.font = '500 ' + (sz || 8 * k).toFixed(1) + 'px "Geist Mono", ui-monospace, monospace'; g.fillStyle = CO.silkD; g.fillText(s, x, y); }
  function gold(g, x, y, r) {
    var gr = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    cs(gr, [0, '#f2da93', 0.6, '#c9a24c', 1, '#94722b']); g.fillStyle = gr; circ(g, x, y, r); g.fill();
  }
  function goldRect(g, x, y, w, h) {
    var gr = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    cs(gr, [0, '#efd58b', 0.55, '#c49d48', 1, '#94722b']); g.fillStyle = gr; g.fillRect(x - w / 2, y - h / 2, w, h);
  }
  function solderRect(g, x, y, w, h) {
    var gr = g.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
    cs(gr, [0, '#f1f3f4', 0.45, '#adb4ba', 1, '#646d75']); g.fillStyle = gr; rr(g, x - w / 2, y - h / 2, w, h, M.min(w, h) * 0.32); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.5)'; rr(g, x - w * 0.36, y - h * 0.36, w * 0.24, h * 0.55, w * 0.1); g.fill();
  }
  function clear(g, x, y, w, h) { g.fillStyle = CO.sub; g.fillRect(x - w / 2, y - h / 2, w, h); }
  function padTHT(g, x, y, r, sq, post) {
    g.fillStyle = CO.sub;
    if (sq) { g.fillRect(x - r - 2.2 * k, y - r - 2.2 * k, 2 * r + 4.4 * k, 2 * r + 4.4 * k); goldRect(g, x, y, 2 * r, 2 * r); }
    else { circ(g, x, y, r + 2.2 * k); g.fill(); gold(g, x, y, r); }
    g.fillStyle = '#07130e'; circ(g, x, y, r * 0.5); g.fill();
    if (post) { g.fillStyle = '#d8bb68'; g.fillRect(x - r * 0.28, y - r * 0.28, r * 0.56, r * 0.56); }
    else { g.fillStyle = '#9aa1a7'; circ(g, x, y, r * 0.3); g.fill(); g.fillStyle = 'rgba(255,255,255,0.55)'; circ(g, x - r * 0.08, y - r * 0.1, r * 0.1); g.fill(); }
  }
  function leg(g, x, ey, dir, pw) {
    var lw = pw * 0.62, L = 9.5 * k, gr = g.createLinearGradient(0, ey, 0, ey + dir * L);
    cs(gr, [0, '#5f676e', 0.32, '#d6dadd', 0.55, '#959da3', 1, '#c3c8cc']); g.fillStyle = gr; g.fillRect(x - lw / 2, dir < 0 ? ey - L : ey, lw, L);
  }
  function smd(g, t, x, y, vert, die) { // 两端贴片：R / C / LED
    var L = (t === 'c8' ? 19 : t === 'led' ? 14 : 15) * k, Wd = (t === 'c8' ? 10 : t === 'led' ? 8 : 7.5) * k, pl = L * 0.3;
    g.save(); g.translate(x, y); if (vert) g.rotate(M.PI / 2);
    clear(g, 0, 0, L + 4 * k, Wd + 5 * k);
    solderRect(g, -L / 2 + pl / 2, 0, pl * 1.08, Wd * 1.16); solderRect(g, L / 2 - pl / 2, 0, pl * 1.08, Wd * 1.16);
    var bw = L * 0.62, gr = g.createLinearGradient(0, -Wd / 2, 0, Wd / 2);
    if (t === 'r') { cs(gr, [0, '#2a2b2c', 0.5, '#141515', 1, '#0c0c0d']); }
    else if (t === 'led') { cs(gr, [0, '#fbf6e6', 0.6, '#e6dec4', 1, '#bdb498']); }
    else { cs(gr, [0, '#cdb084', 0.5, '#a88a5e', 1, '#7a6242']); }
    g.fillStyle = gr; g.fillRect(-bw / 2, -Wd / 2, bw, Wd);
    g.fillStyle = 'rgba(205,210,214,0.9)'; g.fillRect(-L / 2 + pl * 0.45, -Wd / 2, pl * 0.5, Wd); g.fillRect(L / 2 - pl * 0.95, -Wd / 2, pl * 0.5, Wd);
    if (die) { g.fillStyle = die; g.fillRect(-1.6 * k, -1.6 * k, 3.2 * k, 3.2 * k); }
    g.restore();
  }

  /* ---------- 焊点（静态成品与动态熔化共用） ---------- */
  function heat(g, x, y, r, m) {
    var h = bell(seg(m, 0, 0.72)); if (h <= 0.01) return;
    var gr = g.createRadialGradient(x, y, r * 0.2, x, y, r * 2.4);
    cs(gr, [0, 'rgba(255,170,95,' + (0.38 * h).toFixed(3) + ')', 1, 'rgba(255,120,40,0)']); g.fillStyle = gr; circ(g, x, y, r * 2.4); g.fill();
  }
  function jointTHT(g, x, y, rp, m, post) {
    if (m < 1) heat(g, x, y, rp, m);
    var f = sm(seg(m, 0.1, 0.5)); if (f <= 0) return;
    var molten = 1 - sm(seg(m, 0.58, 0.92)), r = rp * (0.45 + 0.68 * f) * (1 + 0.13 * bell(seg(m, 0.36, 0.78)));
    var fl = sm(seg(m, 0.72, 1));
    if (fl > 0) { g.fillStyle = 'rgba(190,140,55,' + (0.2 * fl).toFixed(3) + ')'; circ(g, x, y, r * 1.3); g.fill(); }
    var gr = g.createRadialGradient(x - r * 0.28, y - r * 0.32, r * 0.05, x, y, r);
    cs(gr, [0, '#f5f7f8', 0.42, '#bac1c7', 0.8, '#737c84', 1, '#4b535a']); g.fillStyle = gr; circ(g, x, y, r); g.fill();
    g.lineCap = 'round';
    g.strokeStyle = 'rgba(0,0,0,0.26)'; g.lineWidth = r * 0.3; g.beginPath(); g.arc(x, y, r * 0.68, 0.15, 1.85); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,' + (0.62 + 0.35 * molten).toFixed(3) + ')'; g.lineWidth = r * (0.15 + 0.12 * molten);
    g.beginPath(); g.arc(x, y, r * 0.58, 3.55, 4.95); g.stroke();
    if (molten > 0.01) { g.fillStyle = 'rgba(255,255,255,' + (0.32 * molten).toFixed(3) + ')'; circ(g, x, y, r); g.fill(); }
    if (post) { g.fillStyle = '#dcc06e'; g.fillRect(x - r * 0.24, y - r * 0.24, r * 0.48, r * 0.48); }
    else { g.fillStyle = '#d3d8dc'; circ(g, x, y, r * 0.24); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.7; g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.38)'; g.lineWidth = 0.8; circ(g, x, y, r); g.stroke();
  }
  function jointSMD(g, x, y, w, h, m) {
    if (m < 1) heat(g, x, y, M.max(w, h) * 0.45, m);
    var f = sm(seg(m, 0.1, 0.5)); if (f <= 0) return;
    var molten = 1 - sm(seg(m, 0.58, 0.92)), ww = w * (0.55 + 0.52 * f), hh = h * (0.5 + 0.56 * f), fl = sm(seg(m, 0.72, 1));
    if (fl > 0) { g.fillStyle = 'rgba(190,140,55,' + (0.18 * fl).toFixed(3) + ')'; rr(g, x - ww * 0.75, y - hh * 0.62, ww * 1.5, hh * 1.24, ww * 0.4); g.fill(); }
    solderRect(g, x, y, ww, hh);
    if (molten > 0.01) { g.fillStyle = 'rgba(255,255,255,' + (0.32 * molten).toFixed(3) + ')'; rr(g, x - ww / 2, y - hh / 2, ww, hh, ww * 0.3); g.fill(); }
  }
  function pinT(j, i) { return 0.05 + 0.85 * i / (j.pins.length - 1); }
  function jointDrag(g, j, m) {
    var pl = 13 * k, q = j.q;
    for (var i = 0; i < j.pins.length; i++) {
      var t = pinT(j, i), mi = seg(m, t - 0.05, t + 0.2); if (mi <= 0) continue;
      jointSMD(g, j.pins[i], q.y - pl / 2 + 1.5 * k, j.pw * 1.05, pl, mi);
      leg(g, j.pins[i], q.y, -1, j.pw);
    }
  }
  function drawJ(g, j, m) {
    if (j.type === 'tht') jointTHT(g, j.x, j.y, j.rp, m, j.post);
    else if (j.type === 'smd') jointSMD(g, j.x, j.y, j.pW, j.pH, m);
    else jointDrag(g, j, m);
  }

  /* ---------- 内容元件（静态、未焊状态） ---------- */
  var REF1 = { res: 'R3', elec: 'C4', disc: 'C5', xtal: 'Y1', diode: 'D3' };
  function comp(g, j) {
    var q = k * (mob ? 1 : 1.3), cy = j.y, lx = j.x, rx = j.rx, mid = (lx + rx) / 2, span = rx - lx, bx0, bx1, gr, R2;
    padTHT(g, lx, cy, j.rp); padTHT(g, rx, cy, j.rp);
    g.strokeStyle = '#aeb4b9'; g.lineWidth = 1.5 * q; g.lineCap = 'round'; line(g, lx, cy, rx, cy);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; line(g, lx, cy + 0.9 * q, rx, cy + 0.9 * q);
    if (j.kind === 'res' || j.kind === 'xtal' || j.kind === 'diode') {
      var bl = M.min(span * (j.kind === 'diode' ? 0.4 : j.kind === 'xtal' ? 0.62 : 0.56), (j.kind === 'xtal' ? 42 : 46) * q);
      var bh = (j.kind === 'diode' ? 8 : j.kind === 'xtal' ? 12.5 : 10.5) * q;
      bx0 = mid - bl / 2; bx1 = mid + bl / 2;
      gr = g.createLinearGradient(0, cy - bh / 2, 0, cy + bh / 2);
      if (j.kind === 'res') { cs(gr, [0, '#e6d6b2', 0.45, '#c8af80', 1, '#8c7149']); }
      else if (j.kind === 'xtal') { cs(gr, [0, '#f2f4f5', 0.5, '#adb4b9', 1, '#7b8389']); }
      else { cs(gr, [0, 'rgba(240,150,100,0.95)', 0.5, '#c4532d', 1, '#8a2d14']); }
      g.fillStyle = gr; rr(g, bx0, cy - bh / 2, bl, bh, bh / 2); g.fill();
      if (j.kind === 'res') {
        [[0.2, '#6c3a1e'], [0.33, '#1c1c1c'], [0.46, '#b5392b'], [0.78, '#c8a443']].forEach(function (bd) {
          g.fillStyle = bd[1]; g.fillRect(bx0 + bl * bd[0], cy - bh / 2 + 0.6, bl * 0.075, bh - 1.2);
        });
        g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, bx0 + bh * 0.3, cy - bh * 0.38, bl - bh * 0.6, bh * 0.22, bh * 0.1); g.fill();
      } else if (j.kind === 'xtal') {
        g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 0.8; rr(g, bx0 + 2.2 * q, cy - bh / 2 + 2.2 * q, bl - 4.4 * q, bh - 4.4 * q, bh / 2 - 2.2 * q); g.stroke();
      } else {
        g.fillStyle = '#151515'; g.fillRect(bx0 + bl * 0.74, cy - bh / 2 + 0.4, bl * 0.14, bh - 0.8);
        g.strokeStyle = 'rgba(80,80,80,0.6)'; g.lineWidth = 0.8; line(g, bx0 + bl * 0.15, cy, bx0 + bl * 0.7, cy);
      }
    } else {
      R2 = M.min(span * (j.kind === 'elec' ? 0.3 : 0.24), (j.kind === 'elec' ? 15 : 11.5) * q);
      bx0 = mid - R2; bx1 = mid + R2;
      if (j.kind === 'elec') {
        gr = g.createRadialGradient(mid - R2 * 0.3, cy - R2 * 0.3, R2 * 0.2, mid, cy, R2);
        cs(gr, [0, '#355476', 1, '#152438']); g.fillStyle = gr; circ(g, mid, cy, R2); g.fill();
        g.strokeStyle = '#94a4b6'; g.lineWidth = R2 * 0.22; g.beginPath(); g.arc(mid, cy, R2 * 0.88, 2.3, 3.98); g.stroke();
        gr = g.createRadialGradient(mid - R2 * 0.25, cy - R2 * 0.3, R2 * 0.1, mid, cy, R2 * 0.72);
        cs(gr, [0, '#e4e7e9', 1, '#949ca2']); g.fillStyle = gr; circ(g, mid, cy, R2 * 0.72); g.fill();
        g.strokeStyle = 'rgba(55,60,66,0.75)'; g.lineWidth = 1.1 * q;
        line(g, mid - R2 * 0.46, cy, mid + R2 * 0.46, cy); line(g, mid, cy - R2 * 0.46, mid, cy + R2 * 0.46);
      } else {
        gr = g.createRadialGradient(mid - R2 * 0.35, cy - R2 * 0.4, R2 * 0.1, mid, cy, R2);
        cs(gr, [0, '#f0b45a', 0.6, '#c97a24', 1, '#8d4f12']); g.fillStyle = gr; circ(g, mid, cy, R2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(mid - R2 * 0.35, cy - R2 * 0.42, R2 * 0.32, R2 * 0.16, -0.5, 0, M.PI * 2); g.fill();
      }
    }
    jointTHT(g, rx, cy, j.rp, 1);
    smd(g, 'led', j.lex, cy, false, '#e2a24a');
    g.strokeStyle = CO.silkD; g.lineWidth = 1; g.strokeRect(bx0 - 3 * q, cy - 11 * q, bx1 - bx0 + 6 * q, 22 * q);
    txt(g, REF1[j.kind] || 'R9', bx0 - 3 * q, cy - 14 * q);
  }
  function chipStatic(g, j) {
    var q = j.q, pl = 13 * k, pw = j.pw;
    j.pins.forEach(function (x) {
      clear(g, x, q.y - pl / 2 + 1.5 * k, pw + 4 * k, pl + 4 * k); goldRect(g, x, q.y - pl / 2 + 1.5 * k, pw, pl); leg(g, x, q.y, -1, pw);
      clear(g, x, q.y + q.h + pl / 2 - 1.5 * k, pw + 4 * k, pl + 4 * k); solderRect(g, x, q.y + q.h + pl / 2 - 1.5 * k, pw * 1.04, pl); leg(g, x, q.y + q.h, 1, pw);
    });
    txt(g, 'U' + (11 + j.idx), q.x, q.y + q.h + pl + 10 * k);
  }
  function moduleStatic(g, D) {
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, D.x + 3 * k, D.y + 6 * k, D.w, D.h, 6 * k); g.fill();
    var gr = g.createLinearGradient(D.x, D.y, D.x + D.w, D.y + D.h); cs(gr, [0, '#1e2226', 1, '#111315']); g.fillStyle = gr; rr(g, D.x, D.y, D.w, D.h, 6 * k); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1; g.stroke();
    var ins = 8 * k;
    [[D.x + ins, D.y + ins], [D.x + D.w - ins, D.y + ins], [D.x + ins, D.y + D.h - ins], [D.x + D.w - ins, D.y + D.h - ins]].forEach(function (p) {
      gold(g, p[0], p[1], 4 * k); g.fillStyle = '#050606'; circ(g, p[0], p[1], 2.3 * k); g.fill();
    });
    g.fillStyle = '#b37a2e'; g.fillRect(D.x + D.w * 0.38, D.y + D.h - 7 * k, D.w * 0.24, 5 * k);
    txt(g, 'J3', D.x + D.w * 0.5 + 34 * k, D.y + 16 * k + (mob ? 0 : 6 * k));
  }
  function ledPads(g, j) {
    var B = j.B, dir = j.x > B.x + B.w / 2 ? -1 : 1, ex = dir < 0 ? B.x + B.w : B.x;
    clear(g, j.x, j.y, j.pW + 5 * k, j.pH + 5 * k); goldRect(g, j.x, j.y, j.pW, j.pH);
    var gr = g.createLinearGradient(0, j.y - j.pH * 0.22, 0, j.y + j.pH * 0.22);
    cs(gr, [0, '#e2e5e7', 1, '#8e959b']); g.fillStyle = gr;
    g.fillRect(M.min(ex, j.x), j.y - j.pH * 0.22, M.abs(j.x - ex), j.pH * 0.44);
    if (j.idx === 0) txt(g, 'D9', B.x + B.w + 6 * k, B.y - 8 * k);
  }
  function powerStatic(g) {
    var P = PW, u = P.u1;
    if (P.usb) usbc(g, u.x, mrg); else jst(g, P.inp.x, P.inp.y);
    sot223(g, u.x, u.y);
    smd(g, 'c', P.c1.x, P.c1.y, true); smd(g, 'c', P.c2.x, P.c2.y, true);
    smd(g, 'r', P.r1.x, P.r1.y, false); smd(g, 'led', P.d1.x, P.d1.y, false, '#6fcf8a');
    padTHT(g, P.j0.x, P.j0.y, 7 * k); jointTHT(g, P.j0.x, P.j0.y, 7 * k, 1);
    g.strokeStyle = CO.silkD; g.lineWidth = 1; circ(g, P.j0.x, P.j0.y, 12.5 * k); g.stroke();
    txt(g, 'U1', u.x + 16 * k, u.y - 12 * k); txt(g, 'C1', P.c1.x - 6 * k, P.c1.y + 20 * k); txt(g, 'C2', P.c2.x - 6 * k, P.c2.y + 20 * k);
    txt(g, 'R1', P.r1.x - 6 * k, P.r1.y - 9 * k); txt(g, 'D1', P.d1.x - 6 * k, P.d1.y - 9 * k);
    // 功能区丝印框（只画四个角）
    var x0 = P.P.x - 8 * k, y0 = P.P.y - 6 * k, x1 = P.P.x + P.P.w + 8 * k, y1 = P.P.y + P.P.h + 6 * k, c = 10 * k;
    g.strokeStyle = CO.silkD; g.lineWidth = 1; g.beginPath();
    g.moveTo(x0, y0 + c); g.lineTo(x0, y0); g.lineTo(x0 + c, y0); g.moveTo(x1 - c, y0); g.lineTo(x1, y0); g.lineTo(x1, y0 + c);
    g.moveTo(x1, y1 - c); g.lineTo(x1, y1); g.lineTo(x1 - c, y1); g.moveTo(x0 + c, y1); g.lineTo(x0, y1); g.lineTo(x0, y1 - c); g.stroke();
  }
  function usbc(g, x, y0) {
    var w = 36 * k, h = 26 * k, y = y0 - 3 * k, i;
    for (i = 0; i < 12; i++) solderRect(g, x - 13.2 * k + i * 2.4 * k, y + h + 3.4 * k, 1.5 * k, 4.8 * k);
    [-1, 1].forEach(function (s) { solderRect(g, x + s * (w / 2 + 2.4 * k), y + h * 0.3, 5 * k, 8 * k); solderRect(g, x + s * (w / 2 + 2.4 * k), y + h * 0.82, 5 * k, 7 * k); });
    var gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
    cs(gr, [0, '#858c92', 0.16, '#e4e7e9', 0.5, '#b1b7bc', 0.84, '#e7e9eb', 1, '#848b91']); g.fillStyle = gr; rr(g, x - w / 2, y, w, h, 3 * k); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 0.8; line(g, x - w * 0.38, y + h * 0.32, x + w * 0.38, y + h * 0.32); line(g, x - w * 0.38, y + h * 0.66, x + w * 0.38, y + h * 0.66);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; line(g, x - w * 0.38, y + h * 0.32 + 1, x + w * 0.38, y + h * 0.32 + 1); line(g, x - w * 0.38, y + h * 0.66 + 1, x + w * 0.38, y + h * 0.66 + 1);
    txt(g, 'J1', x + w / 2 + 8 * k, y + h + 6 * k);
  }
  function jst(g, x, y) {
    solderRect(g, x - 2.6 * k, y + 8 * k, 3 * k, 5 * k); solderRect(g, x + 2.6 * k, y + 8 * k, 3 * k, 5 * k);
    var gr = g.createLinearGradient(0, y - 7 * k, 0, y + 7 * k); cs(gr, [0, '#f1ece0', 1, '#c9c1ad']); g.fillStyle = gr; rr(g, x - 9 * k, y - 7 * k, 18 * k, 13 * k, 1.5 * k); g.fill();
    g.fillStyle = '#4a4538'; g.fillRect(x - 6 * k, y - 4 * k, 4.5 * k, 5 * k); g.fillRect(x + 1.5 * k, y - 4 * k, 4.5 * k, 5 * k);
    txt(g, 'J1', x - 9 * k, y - 10 * k);
  }
  function sot223(g, x, y) {
    var bw = 26 * k, bh = 14 * k;
    clear(g, x, y, bw + 8 * k, bh + 26 * k);
    solderRect(g, x, y - bh / 2 - 3 * k, 21 * k, 8 * k);
    [-1, 0, 1].forEach(function (i) { solderRect(g, x + i * 8 * k, y + bh / 2 + 4.5 * k, 4.8 * k, 7.5 * k); g.fillStyle = '#a3aaaf'; g.fillRect(x + i * 8 * k - 1.4 * k, y + bh / 2, 2.8 * k, 5 * k); });
    g.fillStyle = '#b4babf'; g.fillRect(x - 9 * k, y - bh / 2 - 5 * k, 18 * k, 5.5 * k);
    var gr = g.createLinearGradient(0, y - bh / 2, 0, y + bh / 2); cs(gr, [0, '#2a2b2c', 1, '#0d0e0e']); g.fillStyle = gr; g.fillRect(x - bw / 2, y - bh / 2, bw, bh);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x - bw / 2, y - bh / 2, bw, 1.2);
  }
  function part(g, p) {
    var t = p.t, i, gr;
    if (t === 'r' || t === 'c' || t === 'c8') { smd(g, t, p.x, p.y, !!p.o); if (p.ref) txt(g, p.ref, p.bb.x, p.bb.y + 7 * k, 7 * k); return; }
    g.save(); g.translate(p.x, p.y); if (p.o) g.rotate(M.PI / 2);
    if (t === 'sot') {
      clear(g, 0, 0, 16 * k, 20 * k);
      [[-3.8, 6], [3.8, 6], [0, -6]].forEach(function (q) { solderRect(g, q[0] * k, q[1] * k, 3.6 * k, 4.8 * k); g.fillStyle = '#9aa1a6'; g.fillRect(q[0] * k - 1 * k, q[1] > 0 ? 3 * k : -5 * k, 2 * k, 2.4 * k); });
      g.fillStyle = '#161717'; g.fillRect(-6 * k, -3.4 * k, 12 * k, 6.8 * k);
    } else if (t === 'so8') {
      clear(g, 0, 0, 25 * k, 29 * k);
      for (i = 0; i < 4; i++) [-1, 1].forEach(function (s) {
        var lx = (-5.7 + i * 3.8) * k; solderRect(g, lx, s * 11 * k, 2.4 * k, 5.6 * k); g.fillStyle = '#a0a7ac'; g.fillRect(lx - 0.8 * k, s > 0 ? 7.5 * k : -10 * k, 1.6 * k, 2.6 * k);
      });
      gr = g.createLinearGradient(0, -7.5 * k, 0, 7.5 * k); cs(gr, [0, '#262728', 1, '#0e0f0f']); g.fillStyle = gr; g.fillRect(-10 * k, -7.5 * k, 20 * k, 15 * k);
      g.fillStyle = '#0a0a0a'; circ(g, -7 * k, 4.5 * k, 1.1 * k); g.fill();
    } else if (t === 'qfp') {
      var S = 32 * k, pitch = 3.5 * k;
      clear(g, 0, 0, S + 22 * k, S + 22 * k);
      for (i = 0; i < 8; i++) {
        var o = (i - 3.5) * pitch;
        solderRect(g, o, -S / 2 - 5 * k, 1.9 * k, 6 * k); solderRect(g, o, S / 2 + 5 * k, 1.9 * k, 6 * k);
        solderRect(g, -S / 2 - 5 * k, o, 6 * k, 1.9 * k); solderRect(g, S / 2 + 5 * k, o, 6 * k, 1.9 * k);
      }
      gr = g.createLinearGradient(-S / 2, -S / 2, S / 2, S / 2); cs(gr, [0, '#26282a', 1, '#0d0e0f']); g.fillStyle = gr; g.fillRect(-S / 2, -S / 2, S, S);
      g.fillStyle = '#090909'; circ(g, -S / 2 + 4.5 * k, -S / 2 + 4.5 * k, 1.6 * k); g.fill();
      g.strokeStyle = CO.silkD; g.lineWidth = 1; var e = S / 2 + 11 * k, c = 6 * k; g.beginPath();
      g.moveTo(-e, -e + c); g.lineTo(-e, -e); g.lineTo(-e + c, -e); g.moveTo(e - c, -e); g.lineTo(e, -e); g.lineTo(e, -e + c);
      g.moveTo(e, e - c); g.lineTo(e, e); g.lineTo(e - c, e); g.moveTo(-e + c, e); g.lineTo(-e, e); g.lineTo(-e, e - c); g.stroke();
    }
    g.restore();
    if (p.ref) txt(g, p.ref, p.bb.x, p.bb.y + 7 * k, 7 * k);
  }

  /* ---------- 静态底板（按区域切成画布瓦片缓存） ---------- */
  function sheen(g, y0, y1) {
    sts.forEach(function (s, i) {
      var r = rng(31 + i), cx = W * (0.15 + 0.7 * r()), cy = s.top + s.h * r(), R = M.max(W, H) * 0.75;
      if (cy + R < y0 || cy - R > y1) return;
      var gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
      cs(gr, [0, 'rgba(130,210,160,0.05)', 1, 'rgba(130,210,160,0)']); g.fillStyle = gr; g.fillRect(0, y0, W, y1 - y0);
    });
  }
  function drawStatic(g, y0, y1) {
    var bx = mrg, by = mrg, bw = W - 2 * mrg, bh = worldH - 2 * mrg, rad = 12 * k, pi = 6 * k;
    g.fillStyle = CO.bench; g.fillRect(0, y0, W, y1 - y0);
    g.save(); rr(g, bx, by, bw, bh, rad); g.clip();
    g.fillStyle = CO.sub; g.fillRect(0, y0, W, y1 - y0);
    rr(g, bx + pi, by + pi, bw - 2 * pi, bh - 2 * pi, rad * 0.6); g.fillStyle = CO.pour; g.fill();
    sheen(g, y0, y1);
    g.fillStyle = noisePat; g.fillRect(0, y0, W, y1 - y0);
    var vis = TRall.filter(function (t) { return t.y1 >= y0 - 20 && t.y0 <= y1 + 20; });
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = CO.sub; vis.forEach(function (t) { g.lineWidth = t.w + 4.6 * k; poly(g, t.p); g.stroke(); });
    g.strokeStyle = CO.cu; vis.forEach(function (t) { g.lineWidth = t.w; poly(g, t.p); g.stroke(); });
    g.save(); g.translate(-0.45, -0.55); g.strokeStyle = CO.cuHi;
    vis.forEach(function (t) { g.lineWidth = M.max(0.7, t.w * 0.35); poly(g, t.p); g.stroke(); }); g.restore();
    VIA.forEach(function (v) {
      if (v.y < y0 - 10 || v.y > y1 + 10) return;
      if (!v.st) { g.fillStyle = CO.sub; circ(g, v.x, v.y, v.r + 2 * k); g.fill(); }
      g.fillStyle = v.st ? '#1b5640' : '#215f47'; circ(g, v.x, v.y, v.r); g.fill();
      g.fillStyle = '#06150f'; circ(g, v.x, v.y, v.r * 0.46); g.fill();
      g.strokeStyle = 'rgba(180,245,205,0.12)'; g.lineWidth = 0.7; g.beginPath(); g.arc(v.x, v.y, v.r * 0.8, 3.4, 5.2); g.stroke();
    });
    TPM.forEach(function (t) { // 每节标题旁的测试点，和右侧进度 TP1–TP5 对应
      if (t.y < y0 - 30 || t.y > y1 + 30) return;
      g.fillStyle = CO.sub; circ(g, t.x, t.y, 7 * k); g.fill(); gold(g, t.x, t.y, 4.4 * k);
      g.strokeStyle = CO.silkD; g.lineWidth = 1; circ(g, t.x, t.y, 8.6 * k); g.stroke();
      txt(g, 'TP' + t.n, t.x + 14 * k, t.y + 3.2 * k, 9.5 * k);
    });
    FID.forEach(function (f) { g.fillStyle = CO.sub; circ(g, f.x, f.y, 6.5 * k); g.fill(); gold(g, f.x, f.y, 3 * k); });
    PART.forEach(function (p) { if (p.bb.y + p.bb.h > y0 - 20 && p.bb.y < y1 + 20) part(g, p); });
    J.forEach(function (j) {
      if (j.type === 'tht' && j.b === 1) { if (j.y > y0 - 60 && j.y < y1 + 60) comp(g, j); }
      else if (j.type === 'drag') { if (j.q.y + j.q.h + 40 > y0 && j.q.y - 40 < y1) chipStatic(g, j); }
      else if (j.b === 3) { if (j.idx === 0) moduleStatic(g, j.D); padTHT(g, j.x, j.y, j.rp, j.sq, true); }
      else if (j.type === 'smd') ledPads(g, j);
    });
    if (silkLogo && logoRect) { g.globalAlpha = 0.92; g.drawImage(silkLogo, logoRect.x, logoRect.y, logoRect.w, logoRect.h); g.globalAlpha = 1; }
    g.restore();
    MH.forEach(function (h) {
      if (h.y < y0 - 40 || h.y > y1 + 40) return;
      g.fillStyle = CO.sub; circ(g, h.x, h.y, h.r * 1.95); g.fill();
      gold(g, h.x, h.y, h.r * 1.45);
      for (var i = 0; i < 8; i++) { var an = i * M.PI / 4; g.fillStyle = '#5c4718'; circ(g, h.x + M.cos(an) * h.r * 1.2, h.y + M.sin(an) * h.r * 1.2, h.r * 0.12); g.fill(); }
      g.fillStyle = CO.bench; circ(g, h.x, h.y, h.r); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 1; g.stroke();
    });
    powerStatic(g);
    rr(g, bx + 0.5, by + 0.5, bw - 1, bh - 1, rad); g.strokeStyle = 'rgba(205,222,180,0.17)'; g.lineWidth = 1; g.stroke();
  }
  function buildTile(i) {
    var s = sts[i], c = d.createElement('canvas');
    c.width = M.max(1, M.round(W * dpr)); c.height = M.max(1, M.ceil(s.h * dpr));
    var g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, -s.top * dpr);
    drawStatic(g, s.top, s.top + c.height / dpr);
    return c;
  }
  function tile(i) { return tiles[i] || (tiles[i] = buildTile(i)); }
  function dropTiles() { for (var key in tiles) tiles[key].width = 0; tiles = {}; }
  function prefetch(c) {
    for (var key in tiles) if (M.abs(key - c) > 2) { tiles[key].width = 0; delete tiles[key]; }
    if (tileQ) return;
    var want = [c + 1, c - 1, c + 2].filter(function (i) { return i >= 0 && i < sts.length && !tiles[i]; });
    if (want.length) tileQ = setTimeout(function () { tileQ = 0; if (!tiles[want[0]]) tiles[want[0]] = buildTile(want[0]); prefetch(c); }, 50);
  }
  function stIdx(y) { for (var i = sts.length - 1; i > 0; i--) if (y >= sts[i].top - 1) return i; return 0; }
  function makeNoise() {
    var c = d.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'), id = x.createImageData(128, 128), p = id.data, r = rng(7);
    for (var i = 0; i < p.length; i += 4) { var v = r(); p[i] = p[i + 1] = p[i + 2] = v > 0.5 ? 255 : 0; p[i + 3] = M.abs(v - 0.5) * 2 * 20; }
    x.putImageData(id, 0, 0);
    return gB.createPattern(c, 'repeat');
  }
  function makeDot() {
    var c = d.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    cs(gr, [0, 'rgba(232,238,234,1)', 0.5, 'rgba(232,238,234,0.35)', 1, 'rgba(232,238,234,0)']); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return c;
  }
  function makeSilk(img) { // 吉祥物线稿转成白色丝印
    var n = M.round(M.max(64, (logoRect ? logoRect.w : 90) * dpr * 1.5)), c = d.createElement('canvas'); c.width = c.height = n;
    var x = c.getContext('2d'); x.drawImage(img, 0, 0, n, n);
    var id = x.getImageData(0, 0, n, n), p = id.data;
    for (var i = 0; i < p.length; i += 4) {
      var l = 0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2];
      p[i + 3] = clamp((86 - l) / 30, 0, 1) * 235; p[i] = 238; p[i + 1] = 236; p[i + 2] = 227;
    }
    x.putImageData(id, 0, 0); return c;
  }

  /* ---------- 时间线：滚动像素 → 每个焊点的走线 / 熔化区间 ---------- */
  function timeline() {
    var u = H, s, i;
    segs = []; beats = [];
    var b0 = { start: 0, rStart: 0, aEnd: 0, rEnd: 0.06 * u };
    b0.end = b0.rEnd + 0.2 * u; b0.lift0 = 0;
    segs.push({ k: 'park', b: 0, s0: 0, s1: b0.rEnd }, { k: 'ret', b: 0, s0: b0.rEnd, s1: b0.end });
    beats.push(b0); s = b0.end;
    J[0].w0 = J[0].w1 = J[0].m0 = J[0].m1 = -1;
    for (var b = 1; b < 5; b++) {
      var ids = JB[b], n = ids.length, sumP = 0;
      ids.forEach(function (ji, q) { if (q) sumP += J[ji].pathLen; });
      var L = u * (1.15 + 0.12 * n) + 0.45 * sumP, A = 0.4 * L, Rl = 0.45 * L, T = b < 4 ? 0.15 * L : 0; // 动作 40% / 停住 45% / 过渡 15%
      var rest = 0, ww = [], mw = [];
      ids.forEach(function (ji, q) {
        var j = J[ji], a = q === 0 ? 0 : 0.14 + 0.5 * j.pathLen / u, m = j.type === 'drag' ? 0.75 : 0.55;
        ww.push(a); mw.push(m); rest += a + m;
      });
      var stb = sts[b], jl = J[ids[n - 1]], lw = 0.35 + (clamp(jl.ey - 0.62 * u, stb.top, stb.max) - stb.top) / u; // 高出一屏的区块，收尾时镜头要回到顶部，给足滚动距离
      rest += lw;
      var first = 0.4 * A, sc = (A - first) / rest, B = { start: s };
      ids.forEach(function (ji, q) {
        var j = J[ji];
        j.w0 = s; s += q === 0 ? first : ww[q] * sc; j.w1 = s; segs.push({ k: 'walk', j: j, s0: j.w0, s1: j.w1 });
        j.m0 = s; s += mw[q] * sc; j.m1 = s; segs.push({ k: 'melt', j: j, s0: j.m0, s1: j.m1 });
      });
      B.lift0 = s; s += lw * sc; B.aEnd = s; segs.push({ k: 'lift', b: b, s0: B.lift0, s1: s });
      B.rStart = s; s += Rl; B.rEnd = s; segs.push({ k: 'park', b: b, s0: B.rStart, s1: s });
      if (T) { segs.push({ k: 'ret', b: b, s0: s, s1: s + T }); s += T; }
      B.end = s; beats.push(B);
    }
    total = s;
    for (i = 0; i < 5; i++) beats[i].last = JB[i][JB[i].length - 1];
  }
  function Wv(i, s) { var j = J[i]; return j.pre ? 1 : seg(s, j.w0, j.w1); }
  function Mv(i, s) { var j = J[i]; return j.pre ? 1 : seg(s, j.m0, j.m1); }
  function lightOf(i, s) { return sm(seg(Mv(i, s), 0.55, 0.88)); }
  function ease(t) { return t * 0.35 + sm(t) * 0.65; }
  function litFrac(j, s) {
    if (s >= j.w1) return 1; if (s <= j.w0) return 0;
    return clamp((ease(seg(s, j.w0, j.w1)) * j.pathLen - j.hopLen) / j.rt.len, 0, 1);
  }
  function PL(b) { return b === 0 ? 0.22 : 0.35; }
  function ironAt(s) {
    var sg = segs[segs.length - 1], i, t, e, j, st;
    for (i = 0; i < segs.length; i++) if (s < segs[i].s1) { sg = segs[i]; break; }
    t = seg(s, sg.s0, sg.s1);
    if (sg.k === 'park') { st = sts[sg.b]; return { x: st.park.x, y: st.park.y, lift: PL(sg.b) }; }
    if (sg.k === 'ret' || sg.k === 'lift') {
      st = sts[sg.b]; j = J[beats[sg.b].last]; e = sm(t);
      var from = sg.k === 'ret' ? st.park : { x: j.ex, y: j.ey }, to = sg.k === 'ret' ? { x: j.ex, y: j.ey } : st.park;
      var l0 = sg.k === 'ret' ? PL(sg.b) : 0.08, l1 = sg.k === 'ret' ? 0.08 : PL(sg.b);
      return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), lift: lerp(l0, l1, e) + (sg.b || sg.k === 'lift' ? 0.4 : 0) * bell(t) };
    }
    j = sg.j;
    if (sg.k === 'walk') {
      e = ease(t); var Ld = e * j.pathLen, p = along(j.path, j.cum, Ld), lift = 0.08;
      if (j.hopLen > 0.5 && Ld < j.hopLen) lift += 0.5 * bell(Ld / j.hopLen);
      return { x: p.x, y: p.y, lift: lift, walk: Ld > j.hopLen && t < 1 };
    }
    var lf = 0.08 * (1 - sm(seg(t, 0, 0.12))) + 0.08 * sm(seg(t, 0.9, 1));
    if (j.type === 'drag') return { x: lerp(j.x, j.ex, seg(t, 0.05, 0.9)), y: j.y, lift: lf, melt: j };
    // 烙铁头贴在焊盘边上（不是正中），让熔化的焊锡露出来
    var off = sm(seg(t, 0, 0.14)) * (1 - sm(seg(t, 0.88, 1))), oR = (j.rp || j.pW * 0.55) * 1.1;
    return { x: j.x + M.cos(A0) * oR * off, y: j.y + M.sin(A0) * oR * off, lift: lf, melt: j };
  }
  function delta(b) {
    var nx = sts[b + 1]; if (!nx) return 0;
    var jl = J[beats[b].last];
    return clamp(M.min(0.25 * H, jl.ey - sts[b].max - 0.15 * H), 0, nx.top - sts[b].max);
  }
  function camAt(s, ir) {
    var b = 4; while (b > 0 && s < beats[b].start) b--;
    var B = beats[b], st = sts[b];
    if (s >= B.rEnd) return sts[b + 1] ? lerp(st.max, st.max + delta(b), sm(seg(s, B.rEnd, B.end))) : st.max;
    if (b === 0) return lerp(0, st.max, seg(s, B.rStart, B.rEnd));
    var j1 = J[JB[b][0]], from = sts[b - 1].max + delta(b - 1);
    if (s < j1.w1) {
      var y0 = j1.path[0].y, y1 = j1.y, f = y1 - y0 > 1 ? clamp((ir.y - y0) / (y1 - y0), 0, 1) : seg(s, j1.w0, j1.w1);
      return lerp(from, clamp(j1.y - 0.62 * H, st.top, st.max), sm(f));
    }
    if (s < B.lift0) return clamp(ir.y - 0.62 * H, st.top, st.max);
    if (s < B.aEnd) { var jl = J[B.last], c0 = clamp(jl.ey - 0.62 * H, st.top, st.max); return lerp(c0, st.top, sm(seg(s, B.lift0, B.aEnd))); }
    return lerp(st.top, st.max, seg(s, B.rStart, B.rEnd));
  }
  function readPos(b) { var B = beats[b]; return b === 0 ? 0 : B.rStart + 0.1 * (B.rEnd - B.rStart); }

  /* ---------- DOM 绑定：每段字的 --r 跟着焊点进度 ---------- */
  function bind(el, f, kind, off) { if (el) binds.push({ el: el, f: f, kind: kind || 'r', off: !!off, v: -1 }); }
  function bindAll() {
    binds = [];
    var b1 = JB[1], b2 = JB[2], b3 = JB[3], b4 = JB[4];
    function head(el, ji) { bind(el, function (s) { return sm(seg(Wv(ji, s), 0.22, 0.92)); }); }
    function onM(el, ji, a, z, off) { bind(el, function (s) { return seg(Mv(ji, s), a, z); }, 'r', off); }
    head($('#t1'), b1[0]);
    $$('.prog', world).forEach(function (li, n) { var ji = b1[M.min(n, b1.length - 1)]; onM($('h3', li), ji, 0.42, 0.82); onM($('p', li), ji, 0.56, 1); });
    head($('#t2'), b2[0]); head($('#news-sub'), b2[0]);
    $$('.chip', world).forEach(function (el, n) {
      var ji = b2[M.min(n, b2.length - 1)];
      onM(el, ji, 0.18, 1, true);
      bind($('.glint', el), function (s) { return seg(Mv(ji, s), 0.18, 1); }, 'glint');
    });
    bind($('#btn-all'), function (s) { return seg(s, beats[2].lift0, beats[2].aEnd); }, 'op', true);
    head($('#t3'), b3[0]);
    var la = $$('#lead-a .ink'), lb = $$('#lead-b .ink'), last3 = b3[b3.length - 1];
    la.forEach(function (el, n) { onM(el, b3[n < 2 ? 0 : M.min(1, b3.length - 1)], 0.35, 1); });
    lb.forEach(function (el, n) { onM(el, b3[M.min(2 + (n ? 1 : 0), b3.length - 1)], 0.3 + 0.2 * (n > 1 ? 1 : 0), 1); });
    bind($('#lead-photo'), function (s) { return lightOf(last3, s); });
    bind($('#disp .flash'), function (s) { return 0.5 * bell(seg(Mv(last3, s), 0.55, 0.8)); }, 'op');
    head($('#t4'), b4[0]);
    onM($('#s4 .jl'), b4[0], 0.45, 1);
    $$('#steps li').forEach(function (el, n) { onM(el, b4[b4.length - 1], 0.25 + n * 0.12, 0.7 + n * 0.1); });
    bind($('#bigled'), function (s) { return lightOf(b4[b4.length - 1], s); });
    bind($('#led-hint'), function (s) { return seg(s, beats[4].lift0, beats[4].aEnd); });
  }
  function applyBinds(s) {
    for (var i = 0; i < binds.length; i++) {
      var b = binds[i], v = M.round(b.f(s) * 1000) / 1000;
      if (v === b.v) continue; b.v = v;
      if (b.kind === 'r') b.el.style.setProperty('--r', v);
      else if (b.kind === 'op') b.el.style.opacity = v;
      else { b.el.style.opacity = (0.95 * bell(v)).toFixed(3); b.el.style.transform = 'translateX(' + (v * (b.el.parentNode.clientWidth + 3)).toFixed(1) + 'px)'; }
      if (b.off) b.el.classList.toggle('off', v < 0.5);
    }
  }
  function tpUpdate(s) {
    var c = 0; for (var b = 1; b < 5; b++) if (s >= beats[b].start - 0.5) c = b;
    if (c !== curB) {
      curB = c;
      tpBtns.forEach(function (el, i) { if (i === c) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
      if (tpNum) tpNum.textContent = (c + 1) + ' / 5';
    }
    tpBtns.forEach(function (el, i) { var dn = i === 0 || s >= beats[i].aEnd - 0.5; if (el._dn !== dn) { el._dn = dn; el.classList.toggle('done', dn); } });
  }

  /* ---------- 烙铁、烟、光 ---------- */
  var IR = [ // 从烙铁头往笔身：x0, x1, 宽0, 宽1, 边缘色, 高光色, 中间色
    [0, 9, 2.4, 5.4, '#7c848b', '#fbfcfd', '#c4cacf'],
    [9, 40, 5.4, 9.6, '#16181b', '#7b838a', '#373c42'],
    [40, 112, 9.6, 10.4, '#545b62', '#f1f3f5', '#a9b0b6'],
    [112, 134, 21, 21, '#434950', '#e0e4e7', '#9aa1a7'],
    [134, 206, 15, 15, '#4f565c', '#eceef0', '#a1a8ae'],
    [206, 219, 19, 19, '#101214', '#4f555b', '#26292d'],
    [219, 304, 23, 30, '#0c0d0f', '#454b52', '#1e2125'],
    [304, 3200, 30, 30, '#101215', '#4c535a', '#23272c']
  ];
  function ironShape(g, s) {
    g.beginPath(); g.moveTo(0, -IR[0][2] * s / 2);
    IR.forEach(function (q) { g.lineTo(q[0] * s, -q[2] * s / 2); g.lineTo(q[1] * s, -q[3] * s / 2); });
    for (var i = IR.length - 1; i >= 0; i--) { var q = IR[i]; g.lineTo(q[1] * s, q[3] * s / 2); g.lineTo(q[0] * s, q[2] * s / 2); }
    g.closePath();
  }
  function drawIron(g, x, y, a, lift) {
    var s = k * (mob ? 1 : 1.18) * (1 + 0.035 * lift), ca = M.cos(-a), sa = M.sin(-a), Lx = 0.5 * ca - 0.86 * sa, Ly = 0.5 * sa + 0.86 * ca;
    var o = (2.5 + 34 * lift) * k, sh = 0.12 + 0.04 * lift, i, xx;
    g.save();
    g.translate(-9000, 0); g.translate(x, y); g.rotate(a);
    g.transform(1 + sh * Lx, sh * Ly, 0, 1, o * Lx, o * Ly);
    ironShape(g, s);
    g.shadowColor = 'rgba(0,0,0,' + (0.5 - 0.18 * lift).toFixed(3) + ')';
    g.shadowBlur = (4 + 16 * lift) * k * dpr; g.shadowOffsetX = 9000 * dpr; g.shadowOffsetY = 0;
    g.fillStyle = '#000'; g.fill();
    g.restore();
    g.save(); g.translate(x, y); g.rotate(a);
    for (i = 0; i < IR.length; i++) {
      var q = IR[i], x0 = q[0] * s, x1 = q[1] * s, h0 = q[2] * s / 2, h1 = q[3] * s / 2, hm = M.max(h0, h1);
      var gr = g.createLinearGradient(0, -hm, 0, hm);
      cs(gr, [0, q[4], 0.3, q[5], 0.56, q[6], 1, q[4]]); g.fillStyle = gr; g.beginPath(); g.moveTo(x0, -h0); g.lineTo(x1, -h1); g.lineTo(x1, h1); g.lineTo(x0, h0); g.closePath(); g.fill();
    }
    g.lineWidth = 0.8; g.strokeStyle = 'rgba(0,0,0,0.3)';
    for (xx = 114; xx < 133; xx += 2.2) line(g, xx * s, -10.5 * s, xx * s, 10.5 * s);
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    for (xx = 227; xx < 302; xx += 8.5) { var hw = lerp(11.5, 15, (xx - 219) / 85) * s; line(g, xx * s, -hw, xx * s, hw); }
    g.strokeStyle = 'rgba(255,255,255,0.06)';
    for (xx = 228.4; xx < 303; xx += 8.5) { hw = lerp(11.5, 15, (xx - 219) / 85) * s; line(g, xx * s, -hw, xx * s, hw * 0.2); }
    g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(304 * s, -10 * s, 3000 * s, 2.2 * s);
    g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(3.6 * s, -0.7 * s, 2.6 * s, 0.7 * s, 0, 0, M.PI * 2); g.fill();
    g.restore();
  }
  function smoke(g, x, y, amt, seed, now) {
    for (var w = 0; w < 3; w++) for (var i = 0; i < 9; i++) {
      var p = (i / 9 + now * 0.00032 + w * 0.31 + seed * 0.17) % 1;
      var ph = now * 0.0011 + seed * 1.7 + w * 2.1;
      var yy = y - (6 + p * 78) * k, xx = x + (M.sin(ph + p * 3.1) * (2 + p * 14) + (w - 1) * 5 * p) * k;
      var r = (3 + p * 13) * k, a = amt * 0.1 * bell(p) * (1 - p * 0.5);
      if (a <= 0.002) continue;
      g.globalAlpha = a; g.drawImage(smokeDot, xx - r, yy - r, 2 * r, 2 * r);
    }
    g.globalAlpha = 1;
  }
  function spatter(g, x, y, m, seed) { // 助焊剂受热迸出的几颗小亮点，完全由熔化进度决定，倒滑会收回
    var t = seg(m, 0.26, 0.7); if (t <= 0 || t >= 1) return;
    var r = rng(seed * 97 + 13);
    for (var i = 0; i < 7; i++) {
      var an = -M.PI * (0.15 + 0.7 * r()), sp = (10 + r() * 22) * k, d = sp * M.sqrt(t), fall = 18 * k * t * t;
      var a = (1 - t) * (0.6 + 0.4 * r());
      g.fillStyle = 'rgba(255,236,200,' + a.toFixed(3) + ')';
      circ(g, x + M.cos(an) * d * (r() < 0.5 ? -1 : 1), y + M.sin(an) * d + fall, (0.7 + r() * 0.8) * k); g.fill();
    }
  }
  function glow(g, x, y, r, rgb, a) {
    if (a <= 0.003) return;
    var gr = g.createRadialGradient(x, y, 0, x, y, r);
    cs(gr, [0, 'rgba(255,255,255,' + M.min(1, 0.9 * a).toFixed(3) + ')', 0.08, 'rgba(' + rgb + ',' + M.min(1, 0.75 * a).toFixed(3) + ')', 0.3, 'rgba(' + rgb + ',' + M.min(1, 0.22 * a).toFixed(3) + ')', 1, 'rgba(' + rgb + ',0)']); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  function strokePart(g, t, frac) {
    if (frac >= 0.999) { poly(g, t.p); g.stroke(); return; }
    var L = frac * t.len, c = t.cum, p = t.p;
    g.beginPath(); g.moveTo(p[0].x, p[0].y);
    for (var i = 1; i < p.length; i++) {
      if (c[i] >= L) { var u = (L - c[i - 1]) / ((c[i] - c[i - 1]) || 1); g.lineTo(lerp(p[i - 1].x, p[i].x, u), lerp(p[i - 1].y, p[i].y, u)); break; }
      g.lineTo(p[i].x, p[i].y);
    }
    g.stroke();
  }
  function lit(g, t, frac, a) {
    if (frac <= 0 || a <= 0.003) return;
    g.lineCap = 'round'; g.lineJoin = 'round'; g.globalAlpha = a;
    g.strokeStyle = 'rgba(255,150,70,0.13)'; g.lineWidth = t.w * 3.6; strokePart(g, t, frac);
    g.strokeStyle = '#eea86b'; g.lineWidth = t.w * 0.95; strokePart(g, t, frac);
    g.strokeStyle = 'rgba(255,236,205,0.75)'; g.lineWidth = M.max(0.6, t.w * 0.32); strokePart(g, t, frac);
    g.globalAlpha = 1;
  }
  function powerOn(now) { return powerT0 < 0 ? 1 : sm((now - powerT0 - 380) / 240); }

  /* ---------- 每一帧 ---------- */
  function draw(s, now, dt) {
    var ir = ironAt(s), cam = camAt(s, ir), busy = false, i, j, m;
    if (cam !== lastCam) { world.style.transform = 'translate3d(0,' + (-cam).toFixed(2) + 'px,0)'; lastCam = cam; }
    applyBinds(s); tpUpdate(s);
    var g = gB, v0 = cam - 60, v1 = cam + H + 60;
    g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    for (i = 0; i < sts.length; i++) {
      var st = sts[i]; if (st.top + st.h < cam || st.top > cam + H) continue;
      var tc = tile(i); g.drawImage(tc, 0, st.top - cam, W, tc.height / dpr);
    }
    prefetch(stIdx(cam + H * 0.5));
    g.translate(0, -cam);
    var pOn = powerOn(now); if (pOn < 1) busy = true;
    TRp.forEach(function (t) { lit(g, t, 1, pOn); });
    for (i = 1; i < J.length; i++) { j = J[i]; if (!j.rt || j.rt.y1 < v0 || j.rt.y0 > v1) continue; var lf = litFrac(j, s); if (lf > 0) lit(g, j.rt, lf, 1); }
    JB[1].forEach(function (ji) { var L = lightOf(ji, s); if (L > 0) { lit(g, J[ji].inA, 1, L); lit(g, J[ji].inB, 1, L); } });
    for (i = 1; i < J.length; i++) {
      j = J[i]; if (j.y < v0 || j.y > v1) continue;
      m = Mv(i, s); if (m > 0) drawJ(g, j, m);
    }
    g.globalCompositeOperation = 'lighter';
    glow(g, PW.d1.x, PW.d1.y, 26 * k, '110,230,140', pOn); glow(g, PW.d1.x, PW.d1.y, 86 * k, '110,230,140', 0.22 * pOn);
    JB[1].forEach(function (ji) {
      var jj = J[ji], mm = Mv(ji, s), L = lightOf(ji, s) * (1 + 0.7 * bell(seg(mm, 0.6, 0.92)));
      glow(g, jj.lex, jj.y, 24 * k, '255,170,70', L); glow(g, jj.lex, jj.y, 80 * k, '255,170,70', 0.2 * L);
    });
    var l3 = JB[3][JB[3].length - 1], D = J[l3].D, L3 = lightOf(l3, s);
    if (L3 > 0) glow(g, D.x + D.w / 2, D.y + D.h * 0.56, D.w * 0.95, '150,180,255', 0.12 * L3);
    var l4 = JB[4][JB[4].length - 1], Bq = J[l4].B, L4 = lightOf(l4, s) * (1 + 0.5 * bell(seg(Mv(l4, s), 0.6, 0.92)));
    if (L4 > 0) { glow(g, Bq.x + Bq.w / 2, Bq.y + Bq.h / 2, Bq.w * 1.5, '255,214,150', 0.3 * L4); glow(g, Bq.x + Bq.w / 2, Bq.y + Bq.h / 2, Bq.w * 3.2, '255,200,130', 0.12 * L4); }
    if (ir.walk) glow(g, ir.x, ir.y, 22 * k, '255,160,80', 0.5);
    for (i = 1; i < J.length; i++) {
      j = J[i]; m = Mv(i, s); if (m <= 0.25 || m >= 0.85 || j.y < v0 || j.y > v1) continue;
      var fx = j.type === 'drag' ? ir.x : j.x, fl = bell(seg(m, 0.28, 0.82));
      glow(g, fx - 2 * k, j.y - 2 * k, 18 * k, '255,250,240', 0.5 * fl);
    }
    g.globalCompositeOperation = 'source-over';
    if (ptr.heat > 0.003) {
      busy = true;
      var wx = ptr.x, wy = ptr.y + cam, R = 140 * k, h = ptr.heat, hg = g.createRadialGradient(wx, wy, 0, wx, wy, R);
      cs(hg, [0, 'rgba(255,176,100,' + (0.7 * h).toFixed(3) + ')', 0.5, 'rgba(255,140,70,' + (0.18 * h).toFixed(3) + ')', 1, 'rgba(255,120,60,0)']); g.strokeStyle = hg; g.lineCap = 'round'; g.lineJoin = 'round';
      TRall.forEach(function (t) { if (t.x1 < wx - R || t.x0 > wx + R || t.y1 < wy - R || t.y0 > wy + R) return; g.lineWidth = t.w * 1.3; poly(g, t.p); g.stroke(); });
      if (now - ptr.t > 140) ptr.heat = M.max(0, ptr.heat - dt / 1500);
    }
    var f = gF, ixs = ir.x, iys = ir.y - cam, tgt = 0;
    if (ptr.heat > 0) { var df = M.atan2(iys - ptr.y, ixs - ptr.x) - A0; df = M.atan2(M.sin(df), M.cos(df)); tgt = clamp(df, -1.3, 1.3) * 0.075 * ptr.heat; }
    aOff += (tgt - aOff) * (1 - M.exp(-dt / 200)); if (M.abs(tgt - aOff) > 0.0005) busy = true;
    f.setTransform(dpr, 0, 0, dpr, 0, 0); f.clearRect(0, 0, W, H);
    drawIron(f, ixs, iys, A0 + aOff, ir.lift);
    for (i = 1; i < J.length; i++) {
      m = Mv(i, s); if (m <= 0.12 || m >= 1) continue;
      j = J[i]; var amt = bell(seg(m, 0.12, 1)) * 0.95;
      smoke(f, j.type === 'drag' ? ir.x : j.x, (j.type === 'drag' ? ir.y : j.y) - cam, amt, i, now); busy = true;
      if (j.type !== 'drag') { f.globalCompositeOperation = 'lighter'; spatter(f, j.x, j.y - cam, m, i); f.globalCompositeOperation = 'source-over'; }
    }
    return busy;
  }
  function offstage() { return (window.scrollY || window.pageYOffset) > trackTop + total + H + 40; }
  var lastFrame = 0, fbT = 0;
  function frame(now) {
    raf = 0; lastFrame = performance.now();
    if (offstage()) { sD = sT; lastT = 0; return; } // 舞台已滚出视口：不画
    var dt = lastT ? M.min(64, now - lastT) : 16; lastT = now;
    var diff = sT - sD;
    if (M.abs(diff) < 0.4) sD = sT; else sD += diff * (1 - M.exp(-dt / 70));
    var busy = draw(sD, now, dt) || sD !== sT;
    if (busy) raf = requestAnimationFrame(frame); else lastT = 0;
  }
  function kick() { if (!raf) raf = requestAnimationFrame(frame); }
  var virt = null;
  function curS() { return virt != null ? virt : clamp((window.scrollY || window.pageYOffset) - trackTop, 0, total); }
  function sizeAll() {
    track.style.height = M.round(total + H) + 'px';
    trackTop = track.getBoundingClientRect().top + (window.scrollY || window.pageYOffset);
    [cvB, cvF].forEach(function (c) { c.width = M.round(W * dpr); c.height = M.round(H * dpr); });
  }
  function logical(s) { for (var b = 4; b > 0; b--) if (s >= beats[b].start) break; var B = beats[b]; return [b, (s - B.start) / ((B.end - B.start) || 1)]; }
  function relayout() { try { relayout0(); } catch (e) { fallback(e); } }
  function relayout0() {
    var pos = beats.length ? logical(sT) : [0, 0];
    build(); timeline(); sizeAll(); dropTiles(); bindAll();
    if (logoImg && logoImg.complete && logoImg.naturalWidth) silkLogo = makeSilk(logoImg);
    var B = beats[pos[0]], s = clamp(B.start + pos[1] * (B.end - B.start), 0, total);
    if (virt != null) virt = s; else window.scrollTo(0, trackTop + s);
    sT = sD = s; lastCam = null; curB = -1;
    draw(sD, performance.now(), 16);
  }

  /* ---------- 启动 ---------- */
  noisePat = makeNoise(); smokeDot = makeDot();
  build(); timeline(); sizeAll(); bindAll();
  root.classList.add('ready');
  /* 调试定位。无头 Edge 的 --screenshot 总是从文档 (0,0) 截，所以无头时不真滚动，直接把舞台状态设到目标进度 */
  var qa = /[?&]at=(\d+)/.exec(location.search), qb = /[?&]beat=(\d)/.exec(location.search), qp = /[?&]p=(\d)(\.\d+)?/.exec(location.search);
  var dbg = null;
  if (qp) { var pb = beats[clamp(+qp[1], 0, 4)]; qb = qp; dbg = pb.start + (+(qp[2] || 0)) * (pb.end - pb.start); }
  else if (qa) dbg = +qa[1] - trackTop; else if (qb) dbg = readPos(clamp(+qb[1], 0, 4));
  if (dbg != null) { if (/Headless/i.test(navigator.userAgent)) virt = clamp(dbg, 0, total); else window.scrollTo(0, trackTop + dbg); }
  sT = sD = curS();
  powerT0 = (qa || qb || sT > 0) ? -1 : performance.now();
  draw(sD, performance.now(), 16); kick();

  go = function (b) { window.scrollTo({ top: trackTop + readPos(b), behavior: 'smooth' }); };
  window.addEventListener('scroll', function () {
    sT = curS();
    if (d.hidden) { sD = sT; draw(sD, performance.now(), 16); return; }
    kick();
    // 兜底：有些内嵌浏览器不跑 rAF 但页面也不算隐藏，这时直接按滚动位置画
    clearTimeout(fbT);
    fbT = setTimeout(function () { if (performance.now() - lastFrame > 120 && !offstage()) { sD = sT; draw(sD, performance.now(), 16); } }, 140);
  }, { passive: true });
  var rT = 0;
  var headless = /Headless/i.test(navigator.userAgent);
  window.addEventListener('resize', function () {
    var fn = function () { if (stage.clientWidth !== W || M.abs(stage.clientHeight - H) > 1) relayout(); };
    clearTimeout(rT);
    if (headless) fn(); else rT = setTimeout(fn, 160); // 无头截图前会突然改窗口尺寸，来不及等防抖
  });
  function onPtr(cx, cy) { var r = stage.getBoundingClientRect(); ptr.x = cx - r.left; ptr.y = cy - r.top; ptr.heat = 1; ptr.t = performance.now(); kick(); }
  stage.addEventListener('pointermove', function (e) { onPtr(e.clientX, e.clientY); }, { passive: true });
  stage.addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) onPtr(t.clientX, t.clientY); }, { passive: true });
  stage.addEventListener('scroll', function () { stage.scrollTop = 0; stage.scrollLeft = 0; });
  world.addEventListener('focusin', function (e) {
    stage.scrollTop = 0;
    var el = e.target.closest('.st'), b = sts.map(function (x) { return x.el; }).indexOf(el);
    if (b < 0) return;
    var B = beats[b];
    if (b === 0 ? sT > B.end : (sT < B.aEnd - 1 || sT > B.end - 1)) go(b);
  });
  // 兜底：2.5 秒后不管 rAF 是否在跑，都把状态直接放到当前滚动位置
  setTimeout(function () { powerT0 = -1; sT = sD = curS(); draw(sD, performance.now(), 16); }, 2500);
  if (d.fonts && d.fonts.ready) d.fonts.ready.then(function () { relayout(); });
  logoImg = new Image();
  logoImg.onload = function () {
    try { silkLogo = makeSilk(logoImg); if (tiles[0]) { tiles[0].width = 0; delete tiles[0]; } draw(sD, performance.now(), 16); } catch (e) { /* 丝印吉祥物可有可无 */ }
  };
  logoImg.src = '../shared/img/ip/zhi-flat.webp';
}

function fallback(err) {
  root.classList.remove('live', 'ready');
  $$('.st').forEach(function (s) { s.style.top = ''; s.style.minHeight = ''; });
  var w = $('#world'), t = $('#track');
  if (w) w.style.transform = '';
  if (t) t.style.height = '';
  go = function (b) { var el = d.getElementById('s' + b); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  if (window.console) console.warn('[v18] 舞台初始化失败，退回普通页面：', err);
}

renderContent();
wire();
if (root.classList.contains('live')) { try { initLive(); } catch (e) { fallback(e); } }
})();
