/* =====================================================================
 * v12-contour-r2 · 损失曲面 + 梯度下降（第三轮：镜头俯冲进曲面）
 * ---------------------------------------------------------------------
 * · 首屏是一张俯视的"损失函数等高线图"。它其实是一张三维曲面：
 *   高度 = 这一点的 loss，等高线画在曲面上（WebGL：顶点着色器把网格按
 *   loss 顶起来，片元着色器逐像素画线）。
 * · 访客往下滑 = 训练往前走：
 *   ① 第一下滑动，平面地图"隆起"成有山有谷的曲面，镜头一边下降一边
 *      压低、转向，从俯视变成贴着山谷的跟拍视角——像被带进去；
 *   ② 小球按事先算好的带动量梯度下降轨迹顺着山谷往谷底滚，镜头跟着它，
 *      loss 数字跟着降，三个检查点对应三句短句；
 *   ③ 收敛后镜头回正、俯冲到最低点，最低点打开一个口，穿过去就是下面的
 *      正文（收敛 = 加入我们）。
 * · 指针：鼠标在曲面上移动会把附近的损失顶起一个小包（三维里就是曲面
 *   跟着手鼓起来）；点一下在那里放一个新起点，它会自己沿梯度滚下去，
 *   停在全局最低点或右下角的局部最低点。
 * · 减少动态效果 / 没有 WebGL：镜头保持俯视，不隆起不转向，只有小球随滚动走。
 * ===================================================================== */
(function () {
  'use strict';

  var glCv = document.getElementById('contourCv');
  var fx = document.getElementById('contourFx');
  var stage = document.getElementById('heroStage');
  var sparkCv = document.getElementById('lossSpark');
  var hudStep = document.getElementById('hudStep');
  var hudLoss = document.getElementById('hudLoss');
  var hudTotal = document.getElementById('hudTotal');

  var API = {
    ok: false,
    setProgress: function () {},
    start: function () {},
    stop: function () {},
    frame: function () {},
    sample: function () { return { step: 0, loss: 0 }; },
    total: 0
  };
  window.Contour = API;
  if (!fx || !fx.getContext) return;
  var ctx = fx.getContext('2d');
  if (!ctx) return;

  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var isCoarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  /* ---------- 1. 损失函数（JS 与着色器完全同一个公式） ---------- */
  var MX = 0.55, MY = 0.10, CURV = 0.35;
  var EPS = 1e-5;          // log 取线的下限
  var KLV = 3.6;           // 每个 e 倍数里画几条线

  function gau(x, y, cx, cy, s) {
    var dx = x - cx, dy = y - cy;
    return Math.exp(-(dx * dx + dy * dy) / s);
  }
  function lossRaw(x, y) {
    var u = x - MX, v = y - MY, w = v - CURV * u * u;
    var b = 0.16 * u * u + 2.6 * w * w;
    b = b / (1 + 0.04 * b);
    b += 0.95 * gau(x, y, 1.40, 0.52, 0.10);     // 一块高台……
    b -= 0.85 * gau(x, y, 1.40, 0.52, 0.035);    // ……台上一个小坑 = 局部最低点（陷阱，loss≈0.25）
    b += 0.55 * gau(x, y, 0.95, 0.95, 0.06);     // 右上小山
    b += 0.70 * gau(x, y, -0.60, -0.60, 0.12);   // 左下小山（标题区下面）
    b += 0.32 * gau(x, y, -1.35, 0.30, 0.05);
    b -= 0.22 * gau(x, y, 1.75, 0.25, 0.06);
    b += 0.26 * gau(x, y, 0.20, -0.75, 0.05);
    b += 0.20 * gau(x, y, 1.30, -0.55, 0.04);
    var sat = b / (b + 0.35);
    b += 0.07 * Math.sin(3.1 * x + 1.3) * Math.sin(2.7 * y - 0.4) * sat;
    return b;
  }
  function gradRaw(x, y) {
    var e = 1e-4;
    return [(lossRaw(x + e, y) - lossRaw(x - e, y)) / (2 * e),
            (lossRaw(x, y + e) - lossRaw(x, y - e)) / (2 * e)];
  }

  /* ---------- 2. 预先算好主轨迹：带动量梯度下降 + 梯度裁剪 ---------- */
  var START = [-0.2, 0.95];
  var LR = 0.06, BETA = 0.8, CLIP = 1.2;
  var PATH = [];
  (function buildPath() {
    var x = START[0], y = START[1], vx = 0, vy = 0;
    PATH.push([x, y]);
    for (var i = 0; i < 96; i++) {
      var g = gradRaw(x, y);
      var gn = Math.hypot(g[0], g[1]);
      if (gn > CLIP) { g[0] *= CLIP / gn; g[1] *= CLIP / gn; }
      vx = BETA * vx - LR * g[0];
      vy = BETA * vy - LR * g[1];
      x += vx; y += vy;
      PATH.push([x, y]);
    }
  })();
  var N = PATH.length - 1;
  var END = PATH[N];
  // 把真正的最低点挪到 0：显示的 loss = 原始值 - 最低值
  var LMIN = lossRaw(END[0], END[1]);
  for (var it = 0; it < 40; it++) {
    var gq = gradRaw(END[0], END[1]);
    END = [END[0] - 0.05 * gq[0], END[1] - 0.05 * gq[1]];
  }
  LMIN = Math.min(LMIN, lossRaw(END[0], END[1]));
  var PATH_L = PATH.map(function (p) { return Math.max(0, lossRaw(p[0], p[1]) - LMIN); });

  // 滚动参数：七成按走过的路程、三成按步数，前面大步不会一闪而过，后面小步也不会停太久
  var ARC = [0];
  (function () {
    var s = 0;
    for (var i = 1; i <= N; i++) {
      s += Math.hypot(PATH[i][0] - PATH[i - 1][0], PATH[i][1] - PATH[i - 1][1]);
      ARC.push(s);
    }
    for (var j = 0; j <= N; j++) ARC[j] = 0.72 * ARC[j] / s + 0.28 * j / N;
  })();

  var P_START = 0.05, P_END = 0.86;          // 训练占首屏滚动的这一段
  function indexAt(p) {
    var a = (p - P_START) / (P_END - P_START);
    if (a <= 0) return 0;
    if (a >= 1) return N;
    var lo = 0, hi = N;
    while (hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if (ARC[mid] <= a) lo = mid; else hi = mid;
    }
    return lo + (a - ARC[lo]) / Math.max(1e-6, ARC[hi] - ARC[lo]);
  }
  function pathPos(fi) {
    var i = Math.floor(fi), f = fi - i;
    if (i >= N) return PATH[N].slice();
    var a = PATH[i], b = PATH[i + 1];
    // 小球在两步之间用缓动滑过去，看起来像"走一步"而不是匀速漂
    var e = f * f * (3 - 2 * f);
    return [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
  }
  function lossAtIndex(fi) {
    var i = Math.floor(fi), f = fi - i;
    if (i >= N) return PATH_L[N];
    return PATH_L[i] + (PATH_L[i + 1] - PATH_L[i]) * f;
  }

  API.total = N;
  API.sample = function (p) {
    var fi = indexAt(p);
    return { step: Math.round(fi), loss: lossAtIndex(fi) };
  };
  // 给正文背景画等高线用：某点的 log(loss)×3.6（整数处就是一条等高线）
  API.lv = function (x, y) { return Math.log(Math.max(0, lossRaw(x, y) - LMIN) + EPS) * KLV; };
  API.END = END;
  API.PATH = PATH;
  var CKPT_P = [0.28, 0.53, 0.88];
  var CKPT_I = CKPT_P.map(function (p) { return Math.round(indexAt(p)); });

  /* ---------- 3. 动态部分：时间流动 + 指针顶起的小包 ---------- */
  var simTime = 0;
  var bump = { x: 0, y: 0, tx: 0, ty: 0, amp: 0, target: 0, r2: 0.03, lastMove: -9 };

  function lossFull(x, y) {
    var b = lossRaw(x, y) - LMIN;
    if (b < 0) b = 0;
    if (!reduceMotion) {
      b += 0.05 * Math.sin(1.9 * x + 0.5 * simTime) * Math.cos(1.6 * y - 0.38 * simTime) * b / (b + 0.35);
    }
    if (bump.amp > 0.002) {
      var dx = x - bump.x, dy = y - bump.y;
      var gb = bump.amp * Math.exp(-(dx * dx + dy * dy) / bump.r2);
      b = b * (1 + 1.6 * gb) + 0.06 * gb;
    }
    return b < 0 ? 0 : b;
  }
  function gradFull(x, y, e) {
    return [(lossFull(x + e, y) - lossFull(x - e, y)) / (2 * e),
            (lossFull(x, y + e) - lossFull(x, y - e)) / (2 * e)];
  }

  /* ---------- 4. 曲面高度：loss 越大越高，山顶压扁一点 ---------- */
  var HS = 0.9;                 // 最高的山大约多高（世界单位）
  var relief = 0;                // 0 = 平面地图，1 = 完整的三维曲面
  function hNorm(L) { return L <= 0 ? 0 : Math.pow(L / (L + 1), 0.6); }
  function heightAt(x, y) { return HS * relief * hNorm(lossFull(x, y)); }
  var PATH_H = PATH_L.map(hNorm);

  /* ---------- 5. 配色：高 loss 靛蓝 → 青 → 黄绿 → 谷底奶油黄 ---------- */
  var RAMP = [
    [0.00, [0.34, 0.37, 0.70]],
    [0.34, [0.18, 0.43, 0.56]],
    [0.60, [0.25, 0.68, 0.58]],
    [0.82, [0.66, 0.84, 0.45]],
    [1.00, [0.97, 0.91, 0.64]]
  ];
  var LOG_LO = Math.log(EPS), LOG_HI = Math.log(1.6);
  function ramp(s) {
    if (s <= 0) return RAMP[0][1];
    for (var i = 1; i < RAMP.length; i++) {
      if (s <= RAMP[i][0]) {
        var a = RAMP[i - 1], b = RAMP[i];
        var t = (s - a[0]) / (b[0] - a[0]);
        return [a[1][0] + (b[1][0] - a[1][0]) * t, a[1][1] + (b[1][1] - a[1][1]) * t, a[1][2] + (b[1][2] - a[1][2]) * t];
      }
    }
    return RAMP[RAMP.length - 1][1];
  }
  function lowness(L) {
    var t = (Math.log(L + EPS) - LOG_LO) / (LOG_HI - LOG_LO);
    return 1 - Math.min(1, Math.max(0, t));
  }
  function rgba(c, a) {
    return 'rgba(' + ((c[0] * 255) | 0) + ',' + ((c[1] * 255) | 0) + ',' + ((c[2] * 255) | 0) + ',' + a.toFixed(3) + ')';
  }

  /* ---------- 6. 镜头 ---------- */
  var W = 1, Hh = 1, DPR = 1;           // CSS 像素
  var scrollProg = 0, smoothProg = 0;
  var flat = reduceMotion;              // 没有 WebGL 时下面也会置为 true

  function smooth01(a, b, x) {
    var t = Math.min(1, Math.max(0, (x - a) / (b - a)));
    return t * t * (3 - 2 * t);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function lerpAng(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return a + d * t;
  }

  // 小球前进方向（平滑过的），镜头跟拍时用
  var HEAD = [];
  (function () {
    var prev = [1, 0];
    for (var i = 0; i <= N; i++) {
      var a = PATH[Math.max(0, i - 3)], b = PATH[Math.min(N, i + 10)];
      var dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy);
      var h = l > 1e-4 ? [dx / l, dy / l] : prev;
      HEAD.push(h); prev = h;
    }
    for (var pass = 0; pass < 6; pass++) {
      var nx = HEAD.map(function (h, k) {
        var p0 = HEAD[Math.max(0, k - 1)], p1 = HEAD[Math.min(N, k + 1)];
        var x = p0[0] + 2 * h[0] + p1[0], y = p0[1] + 2 * h[1] + p1[1], l = Math.hypot(x, y) || 1;
        return [x / l, y / l];
      });
      HEAD = nx;
    }
  })();
  var VALLEY_YAW = Math.atan2(-0.22, 1);   // 山谷大致的走向：往东略偏南
  function chaseYaw(fi) {
    var i = Math.min(N, Math.max(0, Math.round(fi)));
    var a = Math.atan2(HEAD[i][1], HEAD[i][0]);
    return lerpAng(VALLEY_YAW, a, 0.18);
  }

  // 当前镜头：目标点 T、距离 D、俯仰 phi（0 = 正俯视）、朝向 yaw、竖直视角 fov
  var cam = { T: [0, 0, 0], D: 3, phi: 0, yaw: Math.PI / 2, fov: 0.66, eye: [0, 0, 3], F: [0, 0, -1], U: [0, 1, 0], R: [1, 0, 0], fy: 1, scale: 1 };
  var FOV0 = 36 * Math.PI / 180;

  function baseView() {
    var asp = W / Math.max(1, Hh);
    if (asp < 0.9) {
      // 竖屏：整条轨迹放在屏幕上部，下面留给标题
      var hhP = 0.76 / asp;
      return { cx: 0.05, cy: 0.95 - 0.64 * hhP, hh: hhP };
    }
    var hh = Math.max(1.0, 1.58 / asp);
    return { cx: 0.02, cy: 0.17, hh: hh };
  }

  function applyCam(T, D, phi, yaw, fov) {
    var hx = Math.cos(yaw), hy = Math.sin(yaw);
    var sp = Math.sin(phi), cp = Math.cos(phi);
    var F = [sp * hx, sp * hy, -cp];
    var U = [cp * hx, cp * hy, sp];
    var R = [F[1] * U[2] - F[2] * U[1], F[2] * U[0] - F[0] * U[2], F[0] * U[1] - F[1] * U[0]];
    cam.T = T; cam.D = D; cam.phi = phi; cam.yaw = yaw; cam.fov = fov;
    cam.F = F; cam.U = U; cam.R = R;
    cam.eye = [T[0] - F[0] * D, T[1] - F[1] * D, T[2] - F[2] * D];
    cam.fy = 1 / Math.tan(fov / 2);
    cam.scale = D * Math.tan(fov / 2);
  }

  function updateCamera(p) {
    var b = baseView();
    var portrait = Hh > W;
    if (flat) {
      // 俯视 + 收敛时推近到最低点（原来的二维镜头）
      var z = smooth01(0.62, 0.975, p);
      var ze = z * z * (3 - 2 * z);
      var hhEnd = portrait ? 0.085 : 0.06;
      var hh = Math.exp(Math.log(b.hh) + (Math.log(hhEnd) - Math.log(b.hh)) * ze);
      relief = 0;
      applyCam([b.cx + (END[0] - b.cx) * ze, b.cy + (END[1] - b.cy) * ze, 0], hh / Math.tan(FOV0 / 2), 0, Math.PI / 2, FOV0);
      return;
    }
    var fi = indexAt(p);
    var ball = pathPos(fi);
    // ① 俯冲：地图隆起 + 镜头压低、转向
    var a = Math.min(1, Math.max(0, (p - 0.006) / 0.25));
    var ae = 1 - Math.pow(1 - a, 2.4);          // 第一下滑动镜头就动得最明显，之后慢慢落定
    relief = 1 - Math.pow(1 - Math.min(1, Math.max(0, (p - 0.004) / 0.17)), 2);
    // ③ 收敛：回正、推到最低点
    var c = smooth01(0.8, 0.985, p);
    var ce = c * c * (3 - 2 * c);
    var orbit = smooth01(0.42, 0.9, p) * 0.42;

    var yaw1 = chaseYaw(fi) + orbit;
    var hx = Math.cos(yaw1), hy = Math.sin(yaw1);
    var bz = HS * relief * PATH_H[Math.min(N, Math.round(fi))];
    var T1 = [ball[0] + hx * 0.2, ball[1] + hy * 0.2, bz * 0.7];
    var D1 = portrait ? 1.5 : 1.08;
    var phi1 = portrait ? 1.0 : 1.12;          // 约 57° / 64°：镜头压进山谷里
    var fov1 = (portrait ? 60 : 50) * Math.PI / 180;

    var T0 = [b.cx, b.cy, 0];
    var D0 = b.hh / Math.tan(FOV0 / 2);
    var at = Math.min(1, ae * 1.35);           // 目标点比镜头姿态先到位，小球不会被甩出画面
    var T = [lerp(T0[0], T1[0], at), lerp(T0[1], T1[1], at), lerp(T0[2], T1[2], at)];
    // 距离按对数插值，下降过程更"沉"
    var D = Math.exp(lerp(Math.log(D0), Math.log(D1), ae));
    var phi = phi1 * (1 - Math.pow(1 - Math.min(1, Math.max(0, (p - 0.01) / 0.26)), 2.2));
    var yaw = lerpAng(Math.PI / 2, yaw1, ae);
    var fov = lerp(FOV0, fov1, ae);

    if (ce > 0) {
      T = [lerp(T[0], END[0], ce), lerp(T[1], END[1], ce), lerp(T[2], 0, ce)];
      D = Math.exp(lerp(Math.log(D), Math.log(portrait ? 0.26 : 0.2), ce));
      phi = lerp(phi, 0.05, ce);
    }
    applyCam(T, D, phi, yaw, fov);
    // 镜头不能钻进山里：眼睛离曲面太近就整体抬高
    if (relief > 0.01) {
      var he = HS * relief * hNorm(Math.max(0, lossRaw(cam.eye[0], cam.eye[1]) - LMIN));
      var need = he + 0.16 - cam.eye[2];
      if (need > 0) applyCam([T[0], T[1], T[2] + need], D, phi, yaw, fov);
    }
  }

  // 世界坐标 → 屏幕（CSS 像素）；在镜头后面返回 null
  function proj(x, y, z) {
    var dx = x - cam.eye[0], dy = y - cam.eye[1], dz = z - cam.eye[2];
    var cz = dx * cam.F[0] + dy * cam.F[1] + dz * cam.F[2];
    if (cz < 0.03) return null;
    var cx = dx * cam.R[0] + dy * cam.R[1] + dz * cam.R[2];
    var cy = dx * cam.U[0] + dy * cam.U[1] + dz * cam.U[2];
    var k = cam.fy * Hh * 0.5 / cz;
    return [W * 0.5 + cx * k, Hh * 0.5 - cy * k, cz];
  }
  // 某个深度处 1 个 CSS 像素对应多少世界单位
  function wpp(cz) { return 2 * cz / (cam.fy * Hh); }

  // 屏幕 → 曲面上的点（沿视线往前走，碰到曲面为止）
  function pick(sx, sy) {
    var nx = (sx / W) * 2 - 1, ny = 1 - (sy / Hh) * 2;
    var asp = W / Hh;
    var d = [
      cam.F[0] + cam.R[0] * nx * asp / cam.fy + cam.U[0] * ny / cam.fy,
      cam.F[1] + cam.R[1] * nx * asp / cam.fy + cam.U[1] * ny / cam.fy,
      cam.F[2] + cam.R[2] * nx * asp / cam.fy + cam.U[2] * ny / cam.fy
    ];
    var l = Math.hypot(d[0], d[1], d[2]);
    d[0] /= l; d[1] /= l; d[2] /= l;
    var e = cam.eye;
    if (relief < 0.001) {
      if (d[2] > -1e-4) return null;
      var t0 = -e[2] / d[2];
      return [e[0] + d[0] * t0, e[1] + d[1] * t0];
    }
    var t = 0, prevT = 0, x, y, z, diff;
    for (var i = 0; i < 90; i++) {
      x = e[0] + d[0] * t; y = e[1] + d[1] * t; z = e[2] + d[2] * t;
      diff = z - HS * relief * hNorm(Math.max(0, lossRaw(x, y) - LMIN));
      if (diff < 0) {
        var lo = prevT, hi = t;
        for (var j = 0; j < 8; j++) {
          var m = (lo + hi) / 2;
          var mx = e[0] + d[0] * m, my = e[1] + d[1] * m, mz = e[2] + d[2] * m;
          if (mz - HS * relief * hNorm(Math.max(0, lossRaw(mx, my) - LMIN)) < 0) hi = m; else lo = m;
        }
        return [e[0] + d[0] * hi, e[1] + d[1] * hi];
      }
      prevT = t;
      t += Math.max(0.004, diff * 0.6);
      if (t > 14) break;
    }
    return null;
  }

  /* ---------- 7. WebGL：网格曲面 + 等高线 ---------- */
  var gl = null, U = {}, glOk = false, meshCount = 0;
  if (glCv) {
    try {
      var opts = { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
      gl = glCv.getContext('webgl', opts) || glCv.getContext('experimental-webgl', opts);
    } catch (e) { gl = null; }
  }

  var LOSS_SRC = [
    'uniform float uTime, uLmin, uMotion;',
    'uniform vec4 uBump;',
    'float gau(vec2 p, vec2 c, float s){ vec2 d = p - c; return exp(-dot(d, d) / s); }',
    'float lossRaw(vec2 p){',
    '  float u = p.x - 0.55, v = p.y - 0.10, w = v - 0.35 * u * u;',
    '  float b = 0.16 * u * u + 2.6 * w * w;',
    '  b = b / (1.0 + 0.04 * b);',
    '  b += 0.95 * gau(p, vec2(1.40, 0.52), 0.10);',
    '  b -= 0.85 * gau(p, vec2(1.40, 0.52), 0.035);',
    '  b += 0.55 * gau(p, vec2(0.95, 0.95), 0.06);',
    '  b += 0.70 * gau(p, vec2(-0.60, -0.60), 0.12);',
    '  b += 0.32 * gau(p, vec2(-1.35, 0.30), 0.05);',
    '  b -= 0.22 * gau(p, vec2(1.75, 0.25), 0.06);',
    '  b += 0.26 * gau(p, vec2(0.20, -0.75), 0.05);',
    '  b += 0.20 * gau(p, vec2(1.30, -0.55), 0.04);',
    '  float sat = b / (b + 0.35);',
    '  b += 0.07 * sin(3.1 * p.x + 1.3) * sin(2.7 * p.y - 0.4) * sat;',
    '  return b;',
    '}',
    'float loss(vec2 p){',
    '  float b = max(lossRaw(p) - uLmin, 0.0);',
    '  b += uMotion * 0.05 * sin(1.9 * p.x + 0.5 * uTime) * cos(1.6 * p.y - 0.38 * uTime) * b / (b + 0.35);',
    '  vec2 d = p - uBump.xy;',
    '  float gb = uBump.z * exp(-dot(d, d) / uBump.w);',
    '  b = b * (1.0 + 1.6 * gb) + 0.06 * gb;',
    '  return max(b, 0.0);',
    '}'
  ].join('\n');

  var VS = [
    'precision highp float;',
    'attribute vec2 aPos;',
    'uniform vec3 uEye, uR, uU, uF;',
    'uniform vec4 uProj;',
    'uniform float uRelief, uHS;',
    LOSS_SRC,
    'varying vec2 vP;',
    'varying vec3 vN;',
    'varying float vDist;',
    'float hOf(float L){ return uHS * uRelief * pow(L / (L + 1.0) + 1e-9, 0.6); }',
    'void main(){',
    '  vec2 p = aPos;',
    '  float h = hOf(loss(p));',
    '  float e = 0.006;',
    '  float hx = hOf(loss(p + vec2(e, 0.0))) - hOf(loss(p - vec2(e, 0.0)));',
    '  float hy = hOf(loss(p + vec2(0.0, e))) - hOf(loss(p - vec2(0.0, e)));',
    '  vN = normalize(vec3(-hx / (2.0 * e), -hy / (2.0 * e), 1.0));',
    '  vec3 d = vec3(p, h) - uEye;',
    '  float cz = dot(d, uF);',
    '  vP = p;',
    '  vDist = length(d);',
    '  gl_Position = vec4(dot(d, uR) * uProj.x, dot(d, uU) * uProj.y, cz * uProj.z + uProj.w, cz);',
    '}'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;',
    'uniform float uFade, uPx, uCalm, uSeed, uRelief, uPxK;',
    'uniform vec3 uLens;',
    'uniform vec3 uPortal;',
    'uniform vec2 uFog;',
    LOSS_SRC,
    'varying vec2 vP;',
    'varying vec3 vN;',
    'varying float vDist;',
    'vec3 ramp(float s){',
    '  vec3 c0 = vec3(0.34, 0.37, 0.70), c1 = vec3(0.18, 0.43, 0.56), c2 = vec3(0.25, 0.68, 0.58);',
    '  vec3 c3 = vec3(0.66, 0.84, 0.45), c4 = vec3(0.97, 0.91, 0.64);',
    '  vec3 c = mix(c0, c1, smoothstep(0.0, 0.34, s));',
    '  c = mix(c, c2, smoothstep(0.34, 0.60, s));',
    '  c = mix(c, c3, smoothstep(0.60, 0.82, s));',
    '  c = mix(c, c4, smoothstep(0.82, 1.00, s));',
    '  return c;',
    '}',
    'float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    '',
    'void main(){',
    '  vec2 frag = gl_FragCoord.xy;',
    '  vec2 p = vP;',
    '  float pw = vDist * uPxK;',             // 这个像素大约跨多少世界单位
    '  float L = loss(p);',
    '  float lg = log(L + 1e-5);',
    '  float lv = lg * 3.6;',
    '#ifdef USE_DERIV',
    '  float fw = length(vec2(dFdx(lv), dFdy(lv)));',
    '#else',
    '  float e = pw;',
    '  vec2 gr = vec2(loss(p + vec2(e, 0.0)) - loss(p - vec2(e, 0.0)), loss(p + vec2(0.0, e)) - loss(p - vec2(0.0, e))) / (2.0 * e);',
    '  float fw = length(gr) / (L + 1e-5) * 3.6 * pw;',
    '#endif',
    '  fw = max(fw, 1e-5);',
    '  float s = 1.0 - clamp((lg - log(1e-5)) / (log(1.6) - log(1e-5)), 0.0, 1.0);',
    '  vec3 rc = ramp(s);',
    '',
    '  // 主线 + 每 5 条一根计曲线',
    '  float fr = fract(lv);',
    '  float d = min(fr, 1.0 - fr) / fw;',
    '  float idx = floor(lv + 0.5);',
    '  float major = 1.0 - step(0.5, mod(idx, 5.0));',
    '  float wpx = mix(0.75, 1.35, major) * uPx;',
    '  float line = 1.0 - smoothstep(wpx * 0.5 - 0.35, wpx * 0.5 + 0.85, d);',
    '  float dens = 1.0 - smoothstep(mix(0.16, 0.5, major), mix(0.42, 0.9, major), fw);',
    '  line *= dens;',
    '',
    '  // 亮度波：沿 log(loss) 一圈圈往谷底流',
    '  float wave = 0.5 + 0.5 * sin(lg * 1.25 + uTime * 0.9);',
    '  float pulse = mix(1.0, 0.62 + 0.38 * wave * wave, uMotion);',
    '',
    '  // 指针附近：放大镜式加密半格细线',
    '  vec2 q = frag / uRes;',
    '  vec2 dl = (frag - uLens.xy) / (115.0 * uPx);',
    '  float lens = uLens.z * exp(-dot(dl, dl));',
    '  float fr2 = fract(lv * 2.0 + 0.5);',
    '  float d2 = min(fr2, 1.0 - fr2) / (fw * 2.0);',
    '  float sub = (1.0 - smoothstep(0.2 * uPx, 1.0 * uPx, d2)) * (1.0 - smoothstep(0.2, 0.5, fw * 2.0)) * lens;',
    '',
    '  // 标题区（左下）线条收一收，不和大字抢',
    '  vec2 tq = (q - vec2(0.16, 0.18)) * vec2(uRes.x / uRes.y, 1.0);',
    '  float calm = mix(1.0, mix(0.32, 1.0, smoothstep(0.12, 0.62, length(tq))), uCalm);',
    '',
    '  // 光照：曲面隆起后才有明暗（平面时不变）',
    '  vec3 nrm = normalize(vN);',
    '  float dif = max(dot(nrm, normalize(vec3(-0.45, 0.55, 0.70))), 0.0);',
    '  float slope = 1.0 - nrm.z;',
    '  float lit = mix(1.0, 0.42 + 0.9 * dif, uRelief);',
    '',
    '  float near = 1.0 - smoothstep(uFog.x - 0.6, uFog.y, vDist) * 0.55 * uRelief;',
    '  float alpha = (0.34 + 0.56 * pow(s, 1.4) + 0.2 * major) * pulse * calm * lit * near * (1.0 + 0.25 * uRelief);',
    '  alpha = min(1.0, alpha + lens * 0.35);',
    '',
    '  // 底色：近黑，越接近谷底越透出一点暖光；隆起后山坡迎光处略亮',
    '  vec3 bg = vec3(0.058, 0.061, 0.070);',
    '  vec3 surf = vec3(0.078, 0.083, 0.100) * (0.3 + 1.5 * dif);',
    '  bg = mix(bg, surf, uRelief);',
    '  // 台阶感：每圈等高线外沿一道亮边、内侧一道阴影，像一层层往下走的梯田',
    '  float band = fract(lv);',
    '  float shadow = smoothstep(0.55, 1.0, band);',
    '  float hl = 1.0 - smoothstep(0.0, 0.16, band);',
    '  float terr = uRelief * dens;',
    '  bg *= 1.0 - 0.55 * shadow * terr;',
    '  bg += rc * 0.10 * hl * terr * (0.4 + dif);',
    '  bg += rc * 0.075 * smoothstep(0.55, 1.0, s);',
    '  bg += rc * 0.018 * step(0.5, fract(lv * 0.5)) * smoothstep(0.3, 0.9, s) * dens;',
    '  bg += rc * 0.06 * slope * uRelief;',
    '',
    '  // 坐标网格（俯视全景时有，曲面隆起后淡出）',
    '  float gsp = 0.25;',
    '  vec2 gq = abs(fract(p / gsp + 0.5) - 0.5) * gsp / pw;',
    '  float grid = (1.0 - smoothstep(0.0, 1.0 * uPx, min(gq.x, gq.y))) * (1.0 - uRelief) * smoothstep(0.0012, 0.0024, pw / uPx);',
    '  bg += vec3(0.6, 0.65, 0.75) * grid * 0.035;',
    '',
    '  vec3 col = bg + rc * line * alpha + rc * sub * 0.45;',
    '  col += rc * 0.10 * (1.0 - dens) * smoothstep(0.75, 1.0, s);',
    '',
    '  // 远处慢慢沉进雾里',
    '  float fog = smoothstep(uFog.x, uFog.y, vDist);',
    '  col = mix(col, vec3(0.052, 0.055, 0.063), fog);',
    '',
    '  // 暗角 + 胶片颗粒',
    '  vec2 vq = q - 0.5;',
    '  col *= 1.0 - 0.32 * dot(vq, vq);',
    '  col += (hash(frag + uSeed * 97.0) - 0.5) * 0.018;',
    '',
    '  // 收敛后：最低点打开一个口，里面就是下面正文的底色',
    '  if (uPortal.z > 0.0) {',
    '    float r = length(p - uPortal.xy);',
    '    float R = uPortal.z;',
    '    float edge = max(pw * 1.5, R * 0.015);',
    '    float rimW = 0.003 + R * 0.07;',
    '    float halo = exp(-max(r - R, 0.0) / rimW) * step(R, r);',
    '    vec3 rimCol = mix(vec3(1.0, 0.93, 0.70), vec3(0.25, 0.68, 0.58), smoothstep(R, R + rimW * 2.5, r));',
    '    col += rimCol * halo * 0.42;',
    '    col += vec3(1.0, 0.96, 0.80) * (1.0 - smoothstep(0.0, edge * 2.5, abs(r - R))) * 0.85;',
    '    float inside = 1.0 - smoothstep(R - edge * 3.0, R - edge * 0.5, r);',
    '    col = mix(col, vec3(0.0824), inside);',
    '  }',
    '  col = mix(col, vec3(0.0824), uFade);',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function buildMesh(gn) {
    // 网格在中心（山谷附近）密、四周疏
    var CX = 0.35, CY = 0.2, S = 3.6;
    var n1 = gn + 1;
    var pos = new Float32Array(n1 * n1 * 2);
    var k = 0;
    for (var j = 0; j <= gn; j++) {
      var tj = j / gn * 2 - 1;
      var yy = CY + S * (0.4 * tj + 0.6 * tj * tj * tj);
      for (var i = 0; i <= gn; i++) {
        var ti = i / gn * 2 - 1;
        pos[k++] = CX + S * (0.4 * ti + 0.6 * ti * ti * ti);
        pos[k++] = yy;
      }
    }
    var idx = new Uint16Array(gn * gn * 6);
    var m = 0;
    for (var jj = 0; jj < gn; jj++) {
      for (var ii = 0; ii < gn; ii++) {
        var a = jj * n1 + ii, b = a + 1, c = a + n1, d = c + 1;
        idx[m++] = a; idx[m++] = b; idx[m++] = c;
        idx[m++] = b; idx[m++] = d; idx[m++] = c;
      }
    }
    return { pos: pos, idx: idx, count: m };
  }

  function initGL() {
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        if (window.console) console.info('contour shader fallback:', gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    }
    var deriv = gl.getExtension('OES_standard_derivatives');
    var vs = sh(gl.VERTEX_SHADER, VS);
    var fs = sh(gl.FRAGMENT_SHADER, (deriv ? '#extension GL_OES_standard_derivatives : enable\n#define USE_DERIV 1\n' : '') + FS);
    if (!vs || !fs) return false;
    var pr = gl.createProgram();
    gl.attachShader(pr, vs);
    gl.attachShader(pr, fs);
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    // 网格最多 251×251 个顶点，正好放得进 16 位索引
    var mesh = buildMesh(isCoarse || innerWidth < 760 ? 170 : 250);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.pos, gl.STATIC_DRAW);
    var ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.idx, gl.STATIC_DRAW);
    meshCount = mesh.count;
    var aPos = gl.getAttribLocation(pr, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uEye', 'uR', 'uU', 'uF', 'uProj', 'uRelief', 'uHS', 'uTime', 'uLmin', 'uFade', 'uPx', 'uCalm', 'uMotion', 'uSeed', 'uBump', 'uLens', 'uPortal', 'uFog', 'uPxK'].forEach(function (k) {
      U[k] = gl.getUniformLocation(pr, k);
    });
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(0.052, 0.055, 0.063, 1);
    return true;
  }
  glOk = initGL();
  if (!glOk) { document.documentElement.classList.add('no-gl'); flat = true; }
  else document.documentElement.classList.add('gl');

  if (glCv && gl) {
    glCv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      glOk = false;
      flat = true;
      document.documentElement.classList.remove('gl');
      document.documentElement.classList.add('no-gl');
    });
  }

  /* ---------- 8. 顺坡流动的细线（梯度流，世界坐标里走） ---------- */
  var PCOUNT = reduceMotion ? 0 : (isCoarse || innerWidth < 760 ? 150 : 380);
  var parts = [];
  function spawn(pt, initial) {
    var w = pick(Math.random() * W, Math.random() * Hh);
    if (!w) { pt.dead = true; pt.age = 0; pt.life = 0.2; pt.hx = []; pt.hy = []; return; }
    pt.dead = false;
    pt.x = w[0]; pt.y = w[1];
    pt.life = 2.2 + Math.random() * 3.2;
    pt.age = initial ? Math.random() * pt.life : 0;
    pt.hx = [pt.x]; pt.hy = [pt.y]; pt.tick = 0;
  }
  for (var pi = 0; pi < PCOUNT; pi++) { parts.push({ dead: true, age: 0, life: 0, hx: [], hy: [] }); }

  /* ---------- 9. 访客放下的新起点 ---------- */
  var probes = [];
  function dropProbe(sx, sy) {
    var w = pick(sx, sy);
    if (!w) return;
    var pr = { x: w[0], y: w[1], vx: 0, vy: 0, trail: [[w[0], w[1]]], acc: 0, still: 0, fade: 1, done: false, t: 0, L0: lossFull(w[0], w[1]) };
    probes.push(pr);
    if (probes.length > 6) probes.shift();
    if (reduceMotion) {
      for (var k = 0; k < 260 && !pr.done; k++) stepProbe(pr);
      drawAll();
    }
  }
  function stepProbe(pr) {
    var sc = Math.min(1, cam.scale);
    var e = 0.002 * sc;
    var g = gradFull(pr.x, pr.y, e);
    var gn = Math.hypot(g[0], g[1]);
    var clip = 1.2;
    if (gn > clip) { g[0] *= clip / gn; g[1] *= clip / gn; }
    var lr = 0.024 * sc;
    pr.vx = 0.7 * pr.vx - lr * g[0];
    pr.vy = 0.7 * pr.vy - lr * g[1];
    pr.x += pr.vx; pr.y += pr.vy;
    pr.trail.push([pr.x, pr.y]);
    if (pr.trail.length > 240) pr.trail.shift();
    var sp = Math.hypot(pr.vx, pr.vy) / sc;
    pr.n = (pr.n || 0) + 1;
    pr.still = sp < 0.003 ? pr.still + 1 : 0;
    if (pr.still > 18 || pr.n > 420 || Math.abs(pr.x) > 4 || Math.abs(pr.y) > 4) pr.done = true;
  }

  /* ---------- 10. 指针 ---------- */
  var ptr = { sx: -999, sy: -999, in: false, downX: 0, downY: 0, downT: 0, down: false, id: -1, wx: 0, wy: 0, hit: false };
  function isInteractiveEl(el) {
    return !!(el && el.closest && el.closest('a, button, summary, input, textarea, select, .hdr, .hud'));
  }
  function inHeroZone() { return scrollProg < 0.9; }

  if (stage && window.PointerEvent) {
    addEventListener('pointermove', function (e) {
      if (!inHeroZone()) { ptr.in = false; return; }
      ptr.sx = e.clientX; ptr.sy = e.clientY;
      if (e.pointerType === 'mouse') {
        ptr.in = !isInteractiveEl(e.target);
        bump.lastMove = simTime;
      }
      if (!running && !reduceMotion) API.start();
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', function () { ptr.in = false; });
    addEventListener('pointerdown', function (e) {
      if (!inHeroZone() || isInteractiveEl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      ptr.down = true; ptr.id = e.pointerId;
      ptr.downX = e.clientX; ptr.downY = e.clientY; ptr.downT = performance.now();
    }, { passive: true });
    addEventListener('pointerup', function (e) {
      if (!ptr.down || e.pointerId !== ptr.id) return;
      ptr.down = false;
      var moved = Math.hypot(e.clientX - ptr.downX, e.clientY - ptr.downY);
      if (moved < 10 && performance.now() - ptr.downT < 600 && inHeroZone()) {
        var sel = window.getSelection && window.getSelection();
        if (sel && String(sel).length) return;
        dropProbe(e.clientX, e.clientY);
        if (!running && !reduceMotion) API.start();
      }
    }, { passive: true });
    addEventListener('pointercancel', function () { ptr.down = false; }, { passive: true });
  }

  /* ---------- 11. 画面 ---------- */
  var lastSparkStep = -1;
  var lastHudStep = -1, lastHudLoss = '';

  function resize() {
    var mobile = isCoarse || innerWidth <= 768;
    W = Math.max(1, (stage && stage.clientWidth) || innerWidth);
    Hh = Math.max(1, (stage && stage.clientHeight) || innerHeight);
    DPR = Math.min(window.devicePixelRatio || 1, mobile ? 2 : 1.5);
    var fw = Math.round(W * DPR), fh = Math.round(Hh * DPR);
    if (fx.width !== fw || fx.height !== fh) { fx.width = fw; fx.height = fh; }
    if (glOk) {
      var gd = Math.min(window.devicePixelRatio || 1, mobile ? 1.25 : 1.5);
      var maxPx = mobile ? 1.0e6 : 2.2e6;
      if (W * Hh * gd * gd > maxPx) gd = Math.sqrt(maxPx / (W * Hh));
      var gw = Math.round(W * gd), gh = Math.round(Hh * gd);
      if (glCv.width !== gw || glCv.height !== gh) { glCv.width = gw; glCv.height = gh; }
      gl.viewport(0, 0, gw, gh);
      U._px = gd;
    }
    updateCamera(smoothProg);
    for (var i = 0; i < parts.length; i++) spawn(parts[i], true);
    lastSparkStep = -1;
  }

  function portalR(p) {
    if (flat) return 0;
    var t = smooth01(0.885, 0.995, p);
    return t <= 0 ? 0 : 0.0015 + Math.pow(t, 2.1) * (Hh > W ? 0.5 : 0.36);
  }

  function renderGL(calm, fade, p) {
    if (!glOk) return;
    var gw = glCv.width, gh = glCv.height, gd = U._px || 1;
    var asp = gw / gh;
    var near = 0.02, far = 40;
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.uniform2f(U.uRes, gw, gh);
    gl.uniform3f(U.uEye, cam.eye[0], cam.eye[1], cam.eye[2]);
    gl.uniform3f(U.uR, cam.R[0], cam.R[1], cam.R[2]);
    gl.uniform3f(U.uU, cam.U[0], cam.U[1], cam.U[2]);
    gl.uniform3f(U.uF, cam.F[0], cam.F[1], cam.F[2]);
    gl.uniform4f(U.uProj, cam.fy / asp, cam.fy, (far + near) / (far - near), -2 * far * near / (far - near));
    gl.uniform1f(U.uRelief, relief);
    gl.uniform1f(U.uHS, HS);
    gl.uniform1f(U.uPxK, 2 / (cam.fy * gh));
    gl.uniform2f(U.uFog, cam.D + 0.9, cam.D + 3.4);
    gl.uniform1f(U.uTime, simTime);
    gl.uniform1f(U.uLmin, LMIN);
    gl.uniform1f(U.uFade, fade);
    gl.uniform1f(U.uPx, gd);
    gl.uniform1f(U.uCalm, calm);
    gl.uniform1f(U.uMotion, reduceMotion ? 0 : 1);
    gl.uniform1f(U.uSeed, reduceMotion ? 0.3 : (Math.floor(simTime * 20) % 50) / 50);
    gl.uniform4f(U.uBump, bump.x, bump.y, bump.amp, bump.r2);
    gl.uniform3f(U.uLens, ptr.sx * gd, (Hh - ptr.sy) * gd, bump.amp * 0.9);
    gl.uniform3f(U.uPortal, END[0], END[1], portalR(p));
    gl.drawElements(gl.TRIANGLES, meshCount, gl.UNSIGNED_SHORT, 0);
  }

  function zAt(x, y, hn) { return HS * relief * (hn == null ? hNorm(lossFull(x, y)) : hn) + 0.004 * relief; }

  function drawParticles(dt, alphaMul) {
    if (!parts.length || alphaMul <= 0.01) return;
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    for (var i = 0; i < parts.length; i++) {
      var pt = parts[i];
      pt.age += dt;
      if (pt.dead) { if (pt.age > pt.life) spawn(pt, false); continue; }
      if (pt.age > pt.life) { spawn(pt, false); continue; }
      var L = lossFull(pt.x, pt.y);
      var sp0 = proj(pt.x, pt.y, zAt(pt.x, pt.y, hNorm(L)));
      if (!sp0) { spawn(pt, false); continue; }
      var k = wpp(sp0[2]);
      var g = gradFull(pt.x, pt.y, 1.5 * k);
      var gl2 = Math.hypot(g[0], g[1]);
      if (gl2 < 1e-9) { spawn(pt, false); continue; }
      // 用"每像素跨几条线"衡量陡不陡，线越密走得越快
      var steep = gl2 / (L + EPS) * KLV * k;
      var spd = (14 + 70 * Math.min(1, steep * 2.2)) * k;
      pt.x -= g[0] / gl2 * spd * dt;
      pt.y -= g[1] / gl2 * spd * dt;
      var s = lowness(L);
      if (sp0[0] < -10 || sp0[0] > W + 10 || sp0[1] < -10 || sp0[1] > Hh + 10 || steep < 0.004 || s > 0.8) { spawn(pt, false); continue; }
      if (++pt.tick >= 3) {
        pt.tick = 0;
        pt.hx.push(pt.x); pt.hy.push(pt.y);
        if (pt.hx.length > 12) { pt.hx.shift(); pt.hy.shift(); }
      }
      var lifeA = Math.min(1, pt.age / 0.6) * Math.min(1, (pt.life - pt.age) / 0.8) * (1 - smooth01(0.66, 0.8, s));
      var c = ramp(Math.max(0.3, s));
      ctx.strokeStyle = rgba(c, (0.16 + 0.34 * s) * lifeA * alphaMul);
      ctx.beginPath();
      var started = false;
      for (var h = 0; h < pt.hx.length; h++) {
        var q = proj(pt.hx[h], pt.hy[h], zAt(pt.hx[h], pt.hy[h], relief > 0.001 ? hNorm(Math.max(0, lossRaw(pt.hx[h], pt.hy[h]) - LMIN)) : 0));
        if (!q) continue;
        if (!started) { ctx.moveTo(q[0], q[1]); started = true; } else ctx.lineTo(q[0], q[1]);
      }
      var qn = proj(pt.x, pt.y, zAt(pt.x, pt.y, hNorm(L)));
      if (qn && started) ctx.lineTo(qn[0], qn[1]);
      ctx.stroke();
    }
  }

  var MONO = "'Geist Mono', ui-monospace, Menlo, Consolas, monospace";
  var LABEL_FONT = "500 11px " + MONO;
  var CN_FONT = "11.5px 'SHU Serif', 'Songti SC', serif";

  function pz(i) { return HS * relief * PATH_H[i] + 0.006 * relief; }

  function drawPath(fi, alphaMul) {
    if (alphaMul <= 0.01) return;
    var i, s;
    var upto = Math.floor(fi);
    var ball = pathPos(fi);
    var bzz = zAt(ball[0], ball[1], null) + 0.008 * relief;
    var bp = proj(ball[0], ball[1], bzz);
    var pts = [];
    for (i = 0; i <= Math.min(upto, N); i++) pts.push(proj(PATH[i][0], PATH[i][1], pz(i)));
    // 轨迹：每段按 loss 上色
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (i = 0; i < Math.min(upto, N); i++) {
      var a = pts[i];
      var b = (i + 1 <= upto) ? pts[i + 1] : bp;
      if (!a || !b) continue;
      s = lowness(PATH_L[i + 1]);
      ctx.strokeStyle = rgba(ramp(Math.max(0.55, s)), 0.85 * alphaMul);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    if (upto < N && pts[upto] && bp) {
      ctx.strokeStyle = rgba(ramp(0.9), 0.85 * alphaMul);
      ctx.beginPath(); ctx.moveTo(pts[upto][0], pts[upto][1]); ctx.lineTo(bp[0], bp[1]); ctx.stroke();
    }
    // 每一步的落点
    for (i = 0; i <= upto && i <= N; i++) {
      var q = pts[i];
      if (!q) continue;
      ctx.fillStyle = rgba(ramp(Math.max(0.6, lowness(PATH_L[i]))), 0.9 * alphaMul);
      ctx.beginPath(); ctx.arc(q[0], q[1], 1.9, 0, 6.2832); ctx.fill();
    }
    // 起点
    var st = pts[0] || proj(PATH[0][0], PATH[0][1], pz(0));
    ctx.font = LABEL_FONT;
    if (st) {
      ctx.strokeStyle = 'rgba(236,233,225,' + (0.55 * alphaMul).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(st[0], st[1], 6, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(236,233,225,' + (0.6 * alphaMul).toFixed(3) + ')';
      ctx.textAlign = 'left';
      ctx.fillText('init', st[0] + 11, st[1] + 4);
    }

    // 检查点
    for (var c = 0; c < CKPT_I.length; c++) {
      if (fi + 0.01 < CKPT_I[c]) continue;
      var cp = proj(PATH[CKPT_I[c]][0], PATH[CKPT_I[c]][1], pz(CKPT_I[c]));
      if (!cp) continue;
      ctx.save();
      ctx.translate(cp[0], cp[1]);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = 'rgba(246,232,163,' + (0.85 * alphaMul).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.strokeRect(-4.5, -4.5, 9, 9);
      ctx.restore();
      if (c < 2 || fi < N - 0.5) {
        ctx.fillStyle = 'rgba(246,232,163,' + (0.75 * alphaMul).toFixed(3) + ')';
        ctx.textAlign = 'right';
        ctx.fillText('ckpt ' + (c + 1), cp[0] - 10, cp[1] + 16);
        ctx.textAlign = 'left';
      }
    }

    if (!bp) return;
    // 小球 + 光晕（离镜头越近越大）
    var Lb = lossAtIndex(fi);
    var bs = Math.max(0.8, Math.min(2.2, 0.9 / Math.max(0.3, bp[2]) * (relief > 0.5 ? 1 : 0) + (relief > 0.5 ? 0.3 : 1)));
    var halo = ctx.createRadialGradient(bp[0], bp[1], 0, bp[0], bp[1], 30 * bs);
    halo.addColorStop(0, 'rgba(250,236,170,' + (0.42 * alphaMul).toFixed(3) + ')');
    halo.addColorStop(1, 'rgba(250,236,170,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(bp[0], bp[1], 30 * bs, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,248,222,' + alphaMul.toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(bp[0], bp[1], 4.6 * bs, 0, 6.2832); ctx.fill();

    // 负梯度箭头（这一步要往哪走）
    if (fi < N - 0.5) {
      var g = gradFull(ball[0], ball[1], 0.002 * Math.min(1, cam.scale));
      var gn = Math.hypot(g[0], g[1]);
      if (gn > 1e-9) {
        var len = 42 * wpp(bp[2]);
        var tx = ball[0] - g[0] / gn * len, ty = ball[1] - g[1] / gn * len;
        var tp = proj(tx, ty, zAt(tx, ty, null) + 0.008 * relief);
        if (tp) {
          var ax = tp[0] - bp[0], ay = tp[1] - bp[1], al = Math.hypot(ax, ay);
          if (al > 6) {
            ax /= al; ay /= al;
            var L2 = Math.min(60, Math.max(22, al));
            var ex = bp[0] + ax * (L2 + 8), ey = bp[1] + ay * (L2 + 8);
            ctx.strokeStyle = 'rgba(255,248,222,' + (0.8 * alphaMul).toFixed(3) + ')';
            ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(bp[0] + ax * 9, bp[1] + ay * 9); ctx.lineTo(ex, ey); ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - ax * 6 - ay * 3.5, ey - ay * 6 + ax * 3.5);
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex - ax * 6 + ay * 3.5, ey - ay * 6 - ax * 3.5);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,248,222,' + (0.7 * alphaMul).toFixed(3) + ')';
            ctx.fillText('−∇L', ex + ax * 6 + (ax >= 0 ? 2 : -26), ey + ay * 6 + 4);
          }
        }
      }
    }
    // loss 读数跟着小球
    ctx.fillStyle = 'rgba(255,248,222,' + (0.88 * alphaMul).toFixed(3) + ')';
    ctx.fillText('L = ' + Lb.toFixed(4), bp[0] + 12, bp[1] + 18);

    // 收敛后：从最低点一圈圈散开的环（贴在曲面上）
    if (fi >= N - 0.01 && !reduceMotion) {
      var base = Math.max(0.02, cam.scale * 0.08);
      for (var r = 0; r < 2; r++) {
        var ph = ((simTime * 0.42 + r * 0.5) % 1);
        var rad = base * (0.4 + ph * 6);
        ctx.strokeStyle = 'rgba(250,236,170,' + ((1 - ph) * 0.45 * alphaMul).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.beginPath();
        var ok = false;
        for (var sg = 0; sg <= 48; sg++) {
          var an = sg / 48 * 6.2832;
          var rx = END[0] + Math.cos(an) * rad, ry = END[1] + Math.sin(an) * rad;
          var rq = proj(rx, ry, zAt(rx, ry, hNorm(Math.max(0, lossRaw(rx, ry) - LMIN))));
          if (!rq) { ok = false; continue; }
          if (!ok) { ctx.moveTo(rq[0], rq[1]); ok = true; } else ctx.lineTo(rq[0], rq[1]);
        }
        ctx.stroke();
      }
    }
  }

  function drawProbes(dt, alphaMul) {
    if (!probes.length) return;
    for (var i = probes.length - 1; i >= 0; i--) {
      var pr = probes[i];
      if (!reduceMotion) {
        pr.t += dt;
        if (!pr.done) {
          pr.acc += dt;
          while (pr.acc > 1 / 30 && !pr.done) { pr.acc -= 1 / 30; stepProbe(pr); }
        } else {
          pr.fade -= dt / 4.5;
          if (pr.fade <= 0) { probes.splice(i, 1); continue; }
        }
      }
      var a = Math.min(1, pr.fade) * alphaMul;
      var tq = [];
      for (var k = 0; k < pr.trail.length; k++) {
        var tx = pr.trail[k][0], ty = pr.trail[k][1];
        tq.push(proj(tx, ty, zAt(tx, ty, hNorm(Math.max(0, lossRaw(tx, ty) - LMIN))) + 0.004 * relief));
      }
      ctx.lineWidth = 1.1;
      ctx.strokeStyle = 'rgba(170,220,235,' + (0.75 * a).toFixed(3) + ')';
      ctx.beginPath();
      var on = false;
      for (k = 0; k < tq.length; k++) {
        if (!tq[k]) { on = false; continue; }
        if (!on) { ctx.moveTo(tq[k][0], tq[k][1]); on = true; } else ctx.lineTo(tq[k][0], tq[k][1]);
      }
      ctx.stroke();
      ctx.fillStyle = 'rgba(170,220,235,' + (0.8 * a).toFixed(3) + ')';
      for (var m = 0; m < tq.length; m += 2) {
        if (tq[m]) ctx.fillRect(tq[m][0] - 1, tq[m][1] - 1, 2, 2);
      }
      var s0 = tq[0];
      var hd = tq[tq.length - 1];
      if (s0) {
        ctx.strokeStyle = 'rgba(170,220,235,' + (0.7 * a).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(s0[0], s0[1], 5, 0, 6.2832); ctx.stroke();
      }
      if (hd) {
        ctx.fillStyle = 'rgba(214,240,248,' + a.toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(hd[0], hd[1], 3.4, 0, 6.2832); ctx.fill();
      }
      ctx.font = CN_FONT;
      ctx.fillStyle = 'rgba(200,232,242,' + (0.85 * a).toFixed(3) + ')';
      if (pr.done && hd) {
        var Lend = Math.max(0, lossRaw(pr.x, pr.y) - LMIN);
        var txt = (Lend < 0.03 ? '到了全局最低点' : '卡在局部最低点') + '  L=' + Lend.toFixed(3);
        var flip = hd[0] > W - 190;
        ctx.textAlign = flip ? 'right' : 'left';
        ctx.fillText(txt, hd[0] + (flip ? -10 : 10), hd[1] - 9);
        ctx.textAlign = 'left';
      } else if (s0 && (pr.t < 1.6 || reduceMotion)) {
        ctx.fillText('新起点', s0[0] + 10, s0[1] - 8);
      }
      ctx.font = LABEL_FONT;
    }
  }

  function drawCursor(alphaMul) {
    if (!ptr.in || bump.amp < 0.05 || alphaMul < 0.05 || !ptr.hit) return;
    var L = Math.max(0, lossRaw(ptr.wx, ptr.wy) - LMIN);
    var a = bump.amp * alphaMul;
    ctx.strokeStyle = 'rgba(236,233,225,' + (0.5 * a).toFixed(3) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ptr.sx - 14, ptr.sy); ctx.lineTo(ptr.sx - 5, ptr.sy);
    ctx.moveTo(ptr.sx + 5, ptr.sy); ctx.lineTo(ptr.sx + 14, ptr.sy);
    ctx.moveTo(ptr.sx, ptr.sy - 14); ctx.lineTo(ptr.sx, ptr.sy - 5);
    ctx.moveTo(ptr.sx, ptr.sy + 5); ctx.lineTo(ptr.sx, ptr.sy + 14);
    ctx.stroke();
    ctx.font = LABEL_FONT;
    ctx.fillStyle = 'rgba(236,233,225,' + (0.62 * a).toFixed(3) + ')';
    ctx.fillText('L = ' + L.toFixed(3), ptr.sx + 14, ptr.sy + 24);
  }

  function updateHud(fi) {
    var st = Math.round(fi);
    var L = lossAtIndex(fi);
    var ls = L.toFixed(4);
    if (hudStep && st !== lastHudStep) {
      hudStep.textContent = (st < 10 ? '00' : st < 100 ? '0' : '') + st;
      lastHudStep = st;
    }
    if (hudLoss && ls !== lastHudLoss) { hudLoss.textContent = ls; lastHudLoss = ls; }
    if (sparkCv && st !== lastSparkStep) { drawSpark(st); lastSparkStep = st; }
  }

  function drawSpark(st) {
    var sc = sparkCv.getContext('2d');
    if (!sc) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = sparkCv.clientWidth || 132, ch = sparkCv.clientHeight || 34;
    if (sparkCv.width !== Math.round(cw * dpr)) { sparkCv.width = Math.round(cw * dpr); sparkCv.height = Math.round(ch * dpr); }
    sc.setTransform(dpr, 0, 0, dpr, 0, 0);
    sc.clearRect(0, 0, cw, ch);
    var lo = Math.log(1e-4), hi = Math.log(PATH_L[0] + 1e-4);
    function yAt(L) { return 2 + (ch - 4) * (1 - (Math.log(L + 1e-4) - lo) / (hi - lo)); }
    function xAt(i) { return 1 + (cw - 2) * i / N; }
    sc.lineWidth = 1;
    sc.strokeStyle = 'rgba(236,233,225,0.18)';
    sc.setLineDash([2, 3]);
    sc.beginPath();
    for (var i = st; i <= N; i++) { if (i === st) sc.moveTo(xAt(i), yAt(PATH_L[i])); else sc.lineTo(xAt(i), yAt(PATH_L[i])); }
    sc.stroke();
    sc.setLineDash([]);
    sc.strokeStyle = 'rgba(246,232,163,0.95)';
    sc.beginPath();
    for (var j = 0; j <= st; j++) { if (j === 0) sc.moveTo(xAt(j), yAt(PATH_L[j])); else sc.lineTo(xAt(j), yAt(PATH_L[j])); }
    sc.stroke();
    sc.fillStyle = 'rgba(255,248,222,1)';
    sc.beginPath(); sc.arc(xAt(st), yAt(PATH_L[st]), 2.2, 0, 6.2832); sc.fill();
  }

  var running = false, rafId = 0, lastNow = 0;

  function drawAll(dt) {
    dt = dt || 0;
    var p = smoothProg;
    updateCamera(p);
    var fi = indexAt(p);
    var calm = 1 - smooth01(0.02, 0.2, p) * 0.45;
    var fade = flat ? smooth01(0.9, 1.0, p) * 0.3 : smooth01(0.97, 1.0, p) * 0.5;
    var over = 1 - (flat ? 0 : smooth01(0.9, 0.96, p));   // 小球落进口子里

    // 指针小包：跟手但有一点"黏"
    ptr.hit = false;
    if (ptr.in) {
      var w = pick(ptr.sx, ptr.sy);
      if (w) { ptr.hit = true; ptr.wx = w[0]; ptr.wy = w[1]; bump.tx = w[0]; bump.ty = w[1]; }
    }
    var active = ptr.in && ptr.hit && (simTime - bump.lastMove < 2.5) && p < 0.88 && !reduceMotion;
    bump.target = active ? 1 : 0;
    var kf = 1 - Math.pow(0.0001, dt || 0.016);
    if (bump.amp < 0.01 && bump.target > 0) { bump.x = bump.tx; bump.y = bump.ty; }
    bump.x += (bump.tx - bump.x) * Math.min(1, kf * 1.6);
    bump.y += (bump.ty - bump.y) * Math.min(1, kf * 1.6);
    bump.amp += (bump.target - bump.amp) * Math.min(1, kf * 0.7);
    var sc = Math.min(1.2, cam.scale);
    bump.r2 = 0.012 * sc * sc * (Hh > W ? 1.6 : 1);

    renderGL(calm, fade, p);

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, Hh);
    ctx.globalCompositeOperation = 'lighter';
    drawParticles(dt, over * (1 - smooth01(0.7, 0.95, p) * 0.6));
    ctx.globalCompositeOperation = 'source-over';
    drawProbes(dt, over);
    drawPath(fi, over);
    drawCursor(over);
    updateHud(fi);
  }

  function loop(now) {
    rafId = 0;
    if (!running) return;
    var dt = lastNow ? Math.min(0.05, Math.max(0.004, (now - lastNow) / 1000)) : 0.016;
    lastNow = now;
    simTime += dt;
    // 镜头带一点惯性：滚轮停了，镜头还会再"滑"一小段
    var k = 1 - Math.pow(0.004, dt);
    smoothProg += (scrollProg - smoothProg) * Math.min(1, k * 1.25);
    if (Math.abs(scrollProg - smoothProg) < 1e-5) smoothProg = scrollProg;
    drawAll(dt);
    rafId = requestAnimationFrame(loop);
  }

  API.ok = true;
  API.gl = glOk;
  API.flat = flat;
  API.setProgress = function (p) {
    scrollProg = p;
    if (reduceMotion || !running) smoothProg = p;
  };
  API.frame = function () {
    resize();
    drawAll(0);
  };
  API.start = function () {
    if (reduceMotion) { smoothProg = scrollProg; API.frame(); return; }
    if (running) return;
    running = true;
    lastNow = 0;
    if (!rafId) rafId = requestAnimationFrame(loop);
  };
  API.stop = function () {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  };
  // 截图自检用：直接跳到某个进度
  API.debugJump = function (p) { scrollProg = smoothProg = p; drawAll(0.016); };

  if (hudTotal) hudTotal.textContent = String(N);
  addEventListener('resize', function () {
    resize();
    if (!running) drawAll(0);
  });

  resize();
  drawAll(0);
})();
