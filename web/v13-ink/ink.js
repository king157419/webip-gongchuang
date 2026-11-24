/* v13-ink · 生宣纸纤维 + 毛细晕染水渍线 + 84 毫丝状飞白 + 指针淡墨水痕引擎 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isMobile = function () {
    return window.innerWidth < 760 || (window.matchMedia && matchMedia('(pointer: coarse)').matches);
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function makeRng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  /* 1. 程序化无缝生宣纸（暖米白纸浆絮聚 + 竹帘横纹 + 420 根檀皮/稻草纤维 + 纸齿高度场） */
  var PAPER_SZ = 512;
  var paperData = buildXuanPaper(PAPER_SZ);

  function hash2Period(ix, iy, p, seed) {
    var x = ((ix % p) + p) % p;
    var y = ((iy % p) + p) % p;
    var n = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    n = (n ^ (n >>> 13)) * 1274126177;
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }

  function pNoise(u, v, period, seed) {
    var x = u * period, y = v * period;
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    return lerp(
      lerp(hash2Period(ix, iy, period, seed), hash2Period(ix + 1, iy, period, seed), fx),
      lerp(hash2Period(ix, iy + 1, period, seed), hash2Period(ix + 1, iy + 1, period, seed), fx),
      fy
    );
  }

  function buildXuanPaper(sz) {
    var cv = document.createElement('canvas');
    cv.width = sz;
    cv.height = sz;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(sz, sz);
    var px = img.data;
    var tooth = new Float32Array(sz * sz);

    for (var y = 0; y < sz; y++) {
      var v = y / sz;
      for (var x = 0; x < sz; x++) {
        var u = x / sz;
        var cloud = 0.50 * pNoise(u, v, 5, 11) + 0.28 * pNoise(u, v, 11, 23) +
                    0.14 * pNoise(u, v, 24, 37) + 0.08 * pNoise(u, v, 52, 53);
        var grain = 0.62 * pNoise(u, v, 96, 71) + 0.38 * pNoise(u, v, 192, 97);
        var laid = Math.sin((v * sz * 0.88 + cloud * 3.2) * 1.55) * 0.5 + 0.5;
        var chain = Math.exp(-Math.pow(((u * 8) % 1) - 0.5, 2) / 0.008) * 0.25;

        tooth[y * sz + x] = clamp(0.42 * cloud + 0.44 * grain + 0.14 * laid, 0, 1);

        var lum = (cloud - 0.5) * 13 + (grain - 0.5) * 6 + (laid - 0.5) * 3.2 - chain * 2.5;
        var idx = (y * sz + x) * 4;
        px[idx]     = clamp(244 + lum * 0.95, 224, 252);
        px[idx + 1] = clamp(239 + lum * 0.98, 218, 248);
        px[idx + 2] = clamp(226 + lum * 1.08, 202, 239);
        px[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    var rng = makeRng(20261117);
    ctx.lineCap = 'round';
    for (var i = 0; i < 420; i++) {
      var x0 = rng() * sz, y0 = rng() * sz;
      var ang = rng() * Math.PI * 2;
      var isStraw = i > 260;
      var len = isStraw ? (4 + rng() * 11) : (9 + rng() * 23);
      var bend = (rng() - 0.5) * len * 0.55;
      var x2 = x0 + Math.cos(ang) * len, y2 = y0 + Math.sin(ang) * len;
      var cx = (x0 + x2) * 0.5 - Math.sin(ang) * bend;
      var cy = (y0 + y2) * 0.5 + Math.cos(ang) * bend;

      ctx.lineWidth = isStraw ? (0.55 + rng() * 0.65) : (0.45 + rng() * 0.55);
      var al = (isStraw ? (0.11 + rng() * 0.14) : (0.20 + rng() * 0.22)).toFixed(3);
      ctx.strokeStyle = isStraw
        ? (i % 2 ? 'rgba(174,154,124,' + al + ')' : 'rgba(150,132,104,' + al + ')')
        : (i % 3 ? 'rgba(253,250,243,' + al + ')' : 'rgba(212,202,182,' + al + ')');

      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var dx = ox * sz, dy = oy * sz;
          if (Math.max(x0 + dx, x2 + dx) < -4 || Math.min(x0 + dx, x2 + dx) > sz + 4) continue;
          if (Math.max(y0 + dy, y2 + dy) < -4 || Math.min(y0 + dy, y2 + dy) > sz + 4) continue;
          ctx.beginPath();
          ctx.moveTo(x0 + dx, y0 + dy);
          ctx.quadraticCurveTo(cx + dx, cy + dy, x2 + dx, y2 + dy);
          ctx.stroke();
        }
      }

      var steps = Math.ceil(len);
      for (var k = 0; k <= steps; k++) {
        var t = k / steps, mt = 1 - t;
        var fx = Math.floor(((mt * mt * x0 + 2 * mt * t * cx + t * t * x2) % sz + sz) % sz);
        var fy = Math.floor(((mt * mt * y0 + 2 * mt * t * cy + t * t * y2) % sz + sz) % sz);
        tooth[fy * sz + fx] = clamp(tooth[fy * sz + fx] + 0.18, 0, 1);
      }
    }
    return { canvas: cv, tooth: tooth, size: sz };
  }

  /* 2. 五拍水墨画谱（避开左侧正文区与最右侧进度尺，留出疏朗宣纸留白） */
  function getSceneDefs(mob) {
    return [
      /* 第 1 拍（立社）：远淡近浓破墨双晕 + 苍劲弧撇长丝飞白 + 初滚触发侧锋枯笔 */
      {
        seed: 101,
        washes: [
          { x: mob ? 0.80 : 0.74, y: mob ? 0.21 : 0.44, rx: mob ? 0.22 : 0.145, ry: mob ? 0.13 : 0.21, ang: -0.26, den: 0.33, t0: 0.00, t1: 0.72 },
          { x: mob ? 0.74 : 0.69, y: mob ? 0.17 : 0.35, rx: mob ? 0.14 : 0.092, ry: mob ? 0.085 : 0.128, ang: 0.34, den: 0.68, t0: 0.08, t1: 0.86 },
          { x: mob ? 0.84 : 0.79, y: mob ? 0.27 : 0.63, rx: mob ? 0.15 : 0.110, ry: mob ? 0.09 : 0.145, ang: 0.18, den: 0.21, t0: 0.16, t1: 0.96 }
        ],
        strokes: [
          {
            pts: mob
              ? [[0.64, 0.07], [0.85, 0.14], [0.89, 0.27], [0.68, 0.41]]
              : [[0.67, 0.13], [0.81, 0.33], [0.77, 0.62], [0.58, 0.86]],
            width: mob ? 30 : 54, dryStart: 0.34, press: 1.20, s0: 0.00, s1: 0.72
          },
          {
            pts: mob
              ? [[0.90, 0.11], [0.82, 0.21], [0.74, 0.30], [0.64, 0.36]]
              : [[0.85, 0.22], [0.79, 0.38], [0.71, 0.53], [0.62, 0.65]],
            width: mob ? 16 : 26, dryStart: 0.18, press: 0.92, s0: 0.76, s1: 0.99
          }
        ]
      },

      /* 第 2 拍（平时做什么）：饱墨洇开 + 侧锋疾掠长飞白 + 焦墨双苔点 */
      {
        seed: 203,
        washes: [
          { x: mob ? 0.77 : 0.71, y: mob ? 0.19 : 0.40, rx: mob ? 0.17 : 0.112, ry: mob ? 0.10 : 0.142, ang: 0.22, den: 0.64, t0: 0.00, t1: 0.76 },
          { x: mob ? 0.83 : 0.78, y: mob ? 0.24 : 0.51, rx: mob ? 0.20 : 0.135, ry: mob ? 0.11 : 0.165, ang: -0.35, den: 0.29, t0: 0.10, t1: 0.92 }
        ],
        strokes: [
          {
            pts: mob
              ? [[0.56, 0.22], [0.70, 0.18], [0.83, 0.14], [0.95, 0.10]]
              : [[0.59, 0.48], [0.70, 0.42], [0.80, 0.35], [0.91, 0.27]],
            width: mob ? 28 : 48, dryStart: 0.30, press: 1.16, s0: 0.03, s1: 0.72
          },
          {
            pts: mob
              ? [[0.65, 0.29], [0.76, 0.26], [0.86, 0.23], [0.94, 0.21]]
              : [[0.64, 0.60], [0.73, 0.56], [0.82, 0.52], [0.90, 0.47]],
            width: mob ? 16 : 26, dryStart: 0.16, press: 0.88, s0: 0.26, s1: 0.88
          },
          {
            pts: mob
              ? [[0.71, 0.11], [0.74, 0.12], [0.77, 0.14], [0.79, 0.15]]
              : [[0.67, 0.27], [0.69, 0.28], [0.71, 0.30], [0.73, 0.31]],
            width: mob ? 14 : 23, dryStart: 0.55, press: 1.25, s0: 0.55, s1: 0.88
          },
          {
            pts: mob
              ? [[0.82, 0.33], [0.85, 0.34], [0.87, 0.35], [0.89, 0.35]]
              : [[0.78, 0.67], [0.80, 0.68], [0.83, 0.69], [0.85, 0.69]],
            width: mob ? 12 : 19, dryStart: 0.50, press: 1.15, s0: 0.68, s1: 0.98
          }
        ]
      },

      /* 第 3 拍（做过的事）：清淡重浓三层山峦积墨（层层见水渍黑边）+ 斧劈枯笔皴擦 */
      {
        seed: 307,
        washes: [
          { x: mob ? 0.82 : 0.78, y: mob ? 0.15 : 0.31, rx: mob ? 0.20 : 0.135, ry: mob ? 0.11 : 0.185, ang: -0.18, den: 0.22, t0: 0.00, t1: 0.68 },
          { x: mob ? 0.74 : 0.70, y: mob ? 0.21 : 0.46, rx: mob ? 0.18 : 0.132, ry: mob ? 0.11 : 0.175, ang: 0.26, den: 0.44, t0: 0.12, t1: 0.84 },
          { x: mob ? 0.82 : 0.77, y: mob ? 0.27 : 0.60, rx: mob ? 0.14 : 0.104, ry: mob ? 0.085 : 0.142, ang: -0.32, den: 0.74, t0: 0.24, t1: 0.96 }
        ],
        strokes: [
          {
            pts: mob
              ? [[0.71, 0.08], [0.77, 0.18], [0.84, 0.28], [0.92, 0.39]]
              : [[0.69, 0.19], [0.74, 0.40], [0.80, 0.60], [0.88, 0.81]],
            width: mob ? 26 : 46, dryStart: 0.26, press: 1.14, s0: 0.06, s1: 0.82
          },
          {
            pts: mob
              ? [[0.62, 0.26], [0.71, 0.31], [0.80, 0.35], [0.88, 0.38]]
              : [[0.62, 0.63], [0.70, 0.69], [0.78, 0.74], [0.86, 0.78]],
            width: mob ? 18 : 30, dryStart: 0.20, press: 0.95, s0: 0.32, s1: 0.96
          }
        ]
      },

      /* 第 4 拍（谁在带大家）：中锋顿挫双节劲竹 + 撇叶飞白 + 淡墨水晕 */
      {
        seed: 409,
        washes: [
          { x: mob ? 0.80 : 0.75, y: mob ? 0.22 : 0.47, rx: mob ? 0.18 : 0.125, ry: mob ? 0.11 : 0.18, ang: 0.12, den: 0.30, t0: 0.00, t1: 0.80 },
          { x: mob ? 0.74 : 0.70, y: mob ? 0.28 : 0.64, rx: mob ? 0.13 : 0.090, ry: mob ? 0.08 : 0.115, ang: -0.40, den: 0.52, t0: 0.18, t1: 0.92 }
        ],
        strokes: [
          {
            pts: mob
              ? [[0.82, 0.40], [0.81, 0.32], [0.80, 0.25], [0.80, 0.21]]
              : [[0.75, 0.85], [0.745, 0.73], [0.74, 0.60], [0.74, 0.50]],
            width: mob ? 21 : 36, dryStart: 0.38, press: 1.22, s0: 0.00, s1: 0.46
          },
          {
            pts: mob
              ? [[0.80, 0.19], [0.81, 0.14], [0.82, 0.09], [0.83, 0.04]]
              : [[0.74, 0.47], [0.75, 0.35], [0.76, 0.23], [0.77, 0.11]],
            width: mob ? 19 : 33, dryStart: 0.32, press: 1.16, s0: 0.36, s1: 0.78
          },
          {
            pts: mob
              ? [[0.80, 0.20], [0.86, 0.17], [0.91, 0.14], [0.96, 0.11]]
              : [[0.74, 0.47], [0.80, 0.43], [0.85, 0.38], [0.90, 0.33]],
            width: mob ? 14 : 24, dryStart: 0.22, press: 1.05, s0: 0.62, s1: 0.92
          },
          {
            pts: mob
              ? [[0.80, 0.22], [0.73, 0.19], [0.67, 0.16], [0.61, 0.13]]
              : [[0.74, 0.50], [0.69, 0.45], [0.64, 0.40], [0.59, 0.35]],
            width: mob ? 13 : 22, dryStart: 0.20, press: 1.00, s0: 0.70, s1: 0.98
          }
        ]
      },

      /* 第 5 拍（怎么加入）：宿墨浓淡双晕 + 折锋回钩苍劲收官飞白 */
      {
        seed: 512,
        washes: [
          { x: mob ? 0.78 : 0.73, y: mob ? 0.23 : 0.54, rx: mob ? 0.20 : 0.145, ry: mob ? 0.12 : 0.19, ang: 0.28, den: 0.26, t0: 0.00, t1: 0.75 },
          { x: mob ? 0.80 : 0.75, y: mob ? 0.21 : 0.51, rx: mob ? 0.12 : 0.092, ry: mob ? 0.075 : 0.12, ang: -0.22, den: 0.68, t0: 0.14, t1: 0.92 }
        ],
        strokes: [
          {
            pts: mob
              ? [[0.86, 0.11], [0.90, 0.23], [0.78, 0.33], [0.62, 0.27]]
              : [[0.82, 0.24], [0.86, 0.56], [0.72, 0.77], [0.59, 0.63]],
            width: mob ? 28 : 50, dryStart: 0.32, press: 1.22, s0: 0.02, s1: 0.94
          },
          {
            pts: mob
              ? [[0.72, 0.16], [0.78, 0.20], [0.84, 0.25], [0.89, 0.30]]
              : [[0.67, 0.38], [0.72, 0.45], [0.78, 0.52], [0.85, 0.60]],
            width: mob ? 15 : 24, dryStart: 0.22, press: 0.95, s0: 0.45, s1: 0.98
          }
        ]
      }
    ];
  }

  /* 3. 84 毫毛笔笔触光栅化器：起笔顿笔饱满，行笔随速度变粗细，收笔分束拉出连续丝状飞白 */
  function evalBezier(pts, t) {
    var mt = 1 - t;
    var p0 = pts[0], p1 = pts[1], p2 = pts[2], p3 = pts[3];
    return {
      x: mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      y: mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
      dx: 3 * mt * mt * (p1[0] - p0[0]) + 6 * mt * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]),
      dy: 3 * mt * mt * (p1[1] - p0[1]) + 6 * mt * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1])
    };
  }

  function bakeBeatStrokeMap(def, w, h) {
    var cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    var ctx = cv.getContext('2d');
    var img = ctx.createImageData(w, h);
    var buf = img.data;
    /* Alpha 置 255 防止 2D Canvas 预乘清零 G 通道；空白像素 G=255 杜绝线性采样 1px 预显轮廓 */
    for (var pi = 0; pi < buf.length; pi += 4) { buf[pi + 1] = 255; buf[pi + 3] = 255; }
    var tooth = paperData.tooth;
    var pSz = paperData.size;
    var rng = makeRng(def.seed * 977 + 13);

    for (var si = 0; si < def.strokes.length; si++) {
      var st = def.strokes[si];
      var baseW = clamp(st.width * (w / 1080), 10, 68);

      /* 11 束分明毫簇，干笔段各簇之间自然拉开纵向丝状留白 */
      var numTufts = 11;
      var tuftCenters = [];
      var tuftLife = [];
      for (var tc = 0; tc < numTufts; tc++) {
        var normT = -0.92 + (tc / (numTufts - 1)) * 1.84;
        tuftCenters.push(normT + (rng() - 0.5) * 0.06);
        /* 交错枯竭长度，令收笔拉出长短参差的苍劲丝缕，而非齐头截断 */
        var coreBonus = (1 - Math.abs(normT) * 0.55);
        var altBonus = (tc % 2 === 0) ? 0.16 : -0.08;
        tuftLife.push(clamp(st.dryStart + coreBonus * 0.52 + altBonus + rng() * 0.22, st.dryStart + 0.12, 1.06));
      }

      var bristles = [];
      var NB = 84;
      for (var b = 0; b < NB; b++) {
        var tIdx = Math.min(numTufts - 1, Math.floor((b / NB) * numTufts));
        var inTuft = (rng() - 0.5) * 0.11;
        var offset = tuftCenters[tIdx] + inTuft;
        var absOff = Math.abs(offset);
        bristles.push({
          tuftOff: tuftCenters[tIdx],
          inTuft: inTuft,
          splay: tuftCenters[tIdx] * (0.14 + rng() * 0.14),
          dryStart: st.dryStart * (0.72 + 0.34 * (1 - absOff)) + (rng() - 0.5) * 0.05,
          dryEnd: clamp(tuftLife[tIdx] + (rng() - 0.5) * 0.07, st.dryStart + 0.10, 1.08),
          rad: 0.70 + rng() * 0.65,
          lead: (1 - absOff) * 0.02 + (rng() - 0.5) * 0.01
        });
      }

      var pStart = evalBezier(st.pts, 0), pEnd = evalBezier(st.pts, 1);
      var approxLen = Math.hypot((pEnd.x - pStart.x) * w, (pEnd.y - pStart.y) * h) * 1.5;
      var steps = Math.max(100, Math.min(960, Math.ceil(approxLen / 0.8)));
      var midEv = evalBezier(st.pts, 0.5);
      var refSpeed = Math.max(12, Math.hypot(midEv.dx * w, midEv.dy * h));

      for (var k = 0; k <= steps; k++) {
        var u = k / steps;
        var ev = evalBezier(st.pts, u);
        var cx = ev.x * w, cy = ev.y * h;
        var spd = Math.hypot(ev.dx * w, ev.dy * h);
        var invL = 1 / Math.max(1e-4, spd);
        var nx = -ev.dy * h * invL, ny = ev.dx * w * invL;

        /* 起笔重顿藏锋 -> 行笔疾徐变粗细 -> 收笔微敛 */
        var heelIn = smoothstep(0.0, 0.052, u);
        var heelBulge = Math.exp(-Math.pow((u - 0.062) / 0.055, 2)) * 0.30 * (st.press || 1);
        var spdRatio = spd / refSpeed;
        var velWidth = clamp(1.18 / (0.54 + 0.66 * spdRatio), 0.45, 1.30);
        var halfW = baseW * 0.5 * (0.34 + 0.66 * heelIn + heelBulge) * velWidth * (1.0 - 0.24 * smoothstep(0.68, 1.0, u));

        var wetHeel = Math.exp(-u * 10.0) * 0.88 + Math.max(0, 1.0 - spdRatio * 0.85) * 0.32 * (1 - smoothstep(0.45, 0.8, u));
        var globalTime = clamp(lerp(st.s0, st.s1, u), 0.006, 0.998);

        for (var bi = 0; bi < NB; bi++) {
          var br = bristles[bi];
          var dryProg = smoothstep(br.dryStart, br.dryEnd, u);
          if (dryProg >= 0.992) continue;

          /* 湿笔时毫簇展开连成浑厚浓墨面；入枯笔段每束内收成锋利细丝、束间拉开清晰丝状飞白！ */
          var tighten = 1.0 - 0.58 * smoothstep(0.05, 0.55, dryProg);
          var lat = (br.tuftOff + br.inTuft * tighten) * halfW + br.splay * dryProg * baseW * 0.38;
          var ix = Math.round(cx + nx * lat);
          var iy = Math.round(cy + ny * lat);
          if (ix < 1 || ix >= w - 1 || iy < 1 || iy >= h - 1) continue;

          var pTooth = tooth[(iy % pSz) * pSz + (ix % pSz)];
          var inkLoad = 1.0 - dryProg;
          /* 干笔毫丝保持纵向连贯，仅在宣纸深凹谷处微断，形成真实丝缕擦痕而非碎点 */
          var valleyCut = dryProg * dryProg * 0.52;
          if (pTooth < valleyCut) continue;

          var deposit = inkLoad > 0.55
            ? clamp(0.78 + 0.22 * pTooth, 0, 1)
            : clamp((0.52 + 0.62 * pTooth) * Math.pow(inkLoad, 0.38), 0, 1);

          if (deposit <= 0.03) continue;

          var tByte = Math.max(1, Math.min(255, Math.round(clamp(globalTime - br.lead * 0.3, 0.005, 1) * 255)));
          var dByte = Math.min(255, Math.round(deposit * 255));
          var wByte = Math.min(255, Math.round(clamp(wetHeel * inkLoad, 0, 1) * 255));

          var spread = (inkLoad > 0.56 && br.rad > 0.95) ? 1 : 0;
          for (var oy = -spread; oy <= spread; oy++) {
            for (var ox = -spread; ox <= spread; ox++) {
              var fall = (ox === 0 && oy === 0) ? 1.0 : 0.68;
              var pIdx = ((iy + oy) * w + (ix + ox)) * 4;
              var nd = Math.round(dByte * fall);
              if (nd > buf[pIdx]) {
                buf[pIdx] = nd;
                buf[pIdx + 1] = Math.min(buf[pIdx + 1], tByte);
                buf[pIdx + 2] = Math.max(buf[pIdx + 2], wByte);
                buf[pIdx + 3] = 255;
              }
            }
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    return cv;
  }

  function make2DInkCopy(encodedCv) {
    var cv = document.createElement('canvas');
    cv.width = encodedCv.width;
    cv.height = encodedCv.height;
    var ctx = cv.getContext('2d');
    var src = encodedCv.getContext('2d').getImageData(0, 0, cv.width, cv.height);
    var d = src.data;
    for (var i = 0; i < d.length; i += 4) {
      var a = d[i];
      d[i] = 17; d[i + 1] = 16; d[i + 2] = 14; d[i + 3] = a;
    }
    ctx.putImageData(src, 0, 0);
    return cv;
  }

  /* 4. SHU Serif 标题字形遮罩逐笔写出器 */
  function createTitleWriter(wrapEl) {
    var hEl = wrapEl.querySelector('h2');
    var cv = wrapEl.querySelector('.title-cv');
    if (!hEl || !cv) return null;

    var state = {
      hEl: hEl, cv: cv, ctx: cv.getContext('2d'),
      glyphCv: document.createElement('canvas'),
      w: 0, h: 0, dpr: 1, text: hEl.textContent.trim(), ready: false, lastP: -1
    };

    state.bake = function () {
      var rect = hEl.getBoundingClientRect();
      var cs = window.getComputedStyle(hEl);
      var fs = parseFloat(cs.fontSize) || 44;
      var w = Math.max(120, Math.ceil((rect.width || fs * state.text.length) + 24));
      var h = Math.max(52, Math.ceil((rect.height || fs * 1.2) + 24));
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      state.w = w; state.h = h; state.dpr = dpr;
      cv.style.width = w + 'px'; cv.style.height = h + 'px';
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);

      state.glyphCv.width = cv.width; state.glyphCv.height = cv.height;
      var gCtx = state.glyphCv.getContext('2d');
      gCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gCtx.clearRect(0, 0, w, h);
      gCtx.fillStyle = '#0f0e0c';
      gCtx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
      gCtx.textBaseline = 'middle';
      gCtx.fillText(state.text, 6, h * 0.51);
      state.ready = true;
      state.lastP = -1;
    };

    state.render = function (p) {
      if (reduceMotion) { hEl.style.opacity = '1'; cv.style.opacity = '0'; return; }
      if (!state.ready) state.bake();
      var cp = clamp(p, 0, 1);
      if (Math.abs(cp - state.lastP) < 0.003) return;
      state.lastP = cp;

      if (cp <= 0.004) { hEl.style.opacity = '0'; cv.style.opacity = '0'; return; }
      if (cp >= 0.992) { hEl.style.opacity = '1'; cv.style.opacity = '0'; return; }

      hEl.style.opacity = '0';
      cv.style.opacity = '1';

      var ctx = state.ctx, dpr = state.dpr, w = state.w, h = state.h;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      var nChars = Math.max(1, state.text.length);
      var charAdv = (w - 12) / nChars;
      ctx.strokeStyle = '#0f0e0c';
      ctx.lineCap = 'round';

      for (var i = 0; i < nChars; i++) {
        var cStart = (i / nChars) * 0.72;
        var lp = clamp((cp - cStart) / Math.max(0.08, 0.28 + 0.72 / nChars), 0, 1);
        if (lp <= 0) continue;
        var x0 = 6 + i * charAdv, cw = charAdv * 1.06;
        var bands = [
          [0.00, 0.45, x0 - 4, h * 0.24, x0 + cw, h * 0.34, h * 0.38],
          [0.24, 0.76, x0 + cw * 0.85, h * 0.30, x0 + cw * 0.08, h * 0.64, h * 0.42],
          [0.52, 1.00, x0 - 2, h * 0.66, x0 + cw + 4, h * 0.82, h * 0.42]
        ];
        for (var b = 0; b < 3; b++) {
          var bd = bands[b];
          var bp = smoothstep(bd[0], bd[1], lp);
          if (bp <= 0) continue;
          for (var f = -2; f <= 2; f++) {
            var lag = Math.abs(f) * 0.05;
            var fp = clamp((bp - lag) / (1 - lag), 0, 1);
            if (fp <= 0) continue;
            ctx.lineWidth = bd[6] * 0.34;
            ctx.beginPath();
            ctx.moveTo(bd[2], bd[3] + f * bd[6] * 0.16);
            ctx.lineTo(lerp(bd[2], lerp(bd[2], bd[4], bp), fp), lerp(bd[3], lerp(bd[3], bd[5], bp), fp) + f * bd[6] * 0.16);
            ctx.stroke();
          }
        }
      }

      ctx.globalCompositeOperation = 'destination-in';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(state.glyphCv, 0, 0);
      ctx.restore();
    };
    return state;
  }

  /* 5. WebGL1 宣纸水墨主舞台 + 2D Canvas 降级 */
  var Engine = {
    ready: false,
    setState: function () {},
    setSafeBox: function () {},
    createTitleWriter: createTitleWriter,
    resize: function () {},
    stop: function () {},
    start: function () {}
  };
  window.InkEngine = Engine;

  var mainCv = document.getElementById('inkCv');
  if (mainCv) initMainCanvas(mainCv);

  function initMainCanvas(canvas) {
    var width = 1, height = 1, dpr = 1, mob = false;
    var scenes = [], bakedCanvases = [];
    var st = { beat: 0, bloom: 1.0, stroke: 0.74, fade: 1.0, safe: [0.04, 0.14, 0.56, 0.86] };

    var trails = [], lastPtr = null, TRAIL_LIFE = 2100;
    if (!reduceMotion) {
      window.addEventListener('pointermove', function (e) {
        if (e.pointerType === 'touch' && !e.isPrimary) return;
        var vw = Math.max(1, window.innerWidth), vh = Math.max(1, window.innerHeight);
        var nx = e.clientX / vw, ny = e.clientY / vh, now = performance.now();
        if (lastPtr && (now - lastPtr.t) < 140) {
          var dist = Math.hypot((nx - lastPtr.x) * vw, (ny - lastPtr.y) * vh);
          if (dist > 5) {
            var spd = clamp(dist / Math.max(8, now - lastPtr.t), 0.05, 3.2);
            trails.push({ x0: lastPtr.x, y0: lastPtr.y, x1: nx, y1: ny, r: clamp(0.016 - spd * 0.0036, 0.005, 0.016), t: now });
            if (trails.length > 24) trails.shift();
            lastPtr = { x: nx, y: ny, t: now };
            wakeLoop();
          }
        } else {
          lastPtr = { x: nx, y: ny, t: now };
        }
      }, { passive: true });
      window.addEventListener('pointerleave', function () { lastPtr = null; }, { passive: true });
    }

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, depth: false, stencil: false, antialias: false }) ||
           canvas.getContext('experimental-webgl', { alpha: false, depth: false });
    } catch (err) { gl = null; }

    var glState = gl ? setupWebGL(gl) : null;
    if (!glState) gl = null;
    var ctx2d = gl ? null : canvas.getContext('2d');

    function setupWebGL(g) {
      var vsSrc = 'precision highp float;attribute vec2 aPos;varying vec2 vUv;void main(){vUv=vec2(aPos.x*0.5+0.5,0.5-aPos.y*0.5);gl_Position=vec4(aPos,0.0,1.0);}';
      var fsSrc = [
        '#ifdef GL_FRAGMENT_PRECISION_HIGH',
        'precision highp float;',
        '#else',
        'precision mediump float;',
        '#endif',
        'varying vec2 vUv;',
        'uniform sampler2D uPaper, uStroke;',
        'uniform vec2 uRes, uPaperTile;',
        'uniform vec4 uState, uSafe;',
        'uniform float uSeed, uMob;',
        'uniform vec4 uWashA[3], uWashB[3];',
        'uniform vec4 uTrailA[12];',
        'uniform vec2 uTrailB[12];',

        'float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.23);return fract(p.x*p.y);}',
        'float vnoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),f.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),f.x),f.y);}',
        'float fbm(vec2 p){float s=0.0,a=0.52;for(int i=0;i<4;i++){s+=a*vnoise(p);p=p*2.09+vec2(4.3,7.1);a*=0.48;}return s;}',

        'float segDist(vec2 p,vec2 a,vec2 b,float asp){',
        '  vec2 pa=(p-a)*vec2(asp,1.0), ba=(b-a)*vec2(asp,1.0);',
        '  float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.0,1.0);',
        '  return length(pa-ba*h);',
        '}',

        'float textSafeMask(vec2 uv,vec4 b,float asp,float mob){',
        '  vec2 c=0.5*(b.xy+b.zw), hs=max(vec2(0.01),0.5*(b.zw-b.xy));',
        '  vec2 d=abs(uv-c)-hs; d.x*=asp;',
        '  float m=smoothstep(0.0,0.072,length(max(d,vec2(0.0))));',
        '  if(mob<0.5){ m*=smoothstep(0.985,0.925,uv.x); }',
        '  return m;',
        '}',

        'vec2 evalInkWash(vec2 uv,vec4 wa,vec4 wb,float bloomP,float fg,float seed){',
        '  if(wb.y<=0.001) return vec2(0.0);',
        '  float locB=clamp((bloomP-wb.z)/max(0.08,wb.w-wb.z),0.0,1.0);',
        '  if(locB<=0.002) return vec2(0.0);',
        '  float spread=1.0-pow(1.0-locB,2.25);',
        '  vec2 dp=uv-wa.xy;',
        '  float cs=cos(wb.x), sn=sin(wb.x);',
        '  vec2 q=vec2(dp.x*cs-dp.y*sn,dp.x*sn+dp.y*cs)/max(wa.zw,vec2(0.01));',
        '  float baseR=length(q);',
        '  if(baseR>1.75) return vec2(0.0);',
        '  float nMacro=fbm(q*2.3+vec2(seed,seed*0.7));',
        '  float nMeso=fbm(q*8.4-vec2(seed*1.3,2.9));',
        '  float nFine=fbm(q*26.0+vec2(3.7,seed));',
        '  float d=baseR*(1.0+0.32*(nMacro-0.5)+0.20*(nMeso-0.5)+0.13*(nFine-0.5)+0.11*(fg-0.5));',
        '  float xi=d/max(0.02,spread);',
        '  float bodyEdge=1.0-smoothstep(0.955,1.002,xi);',
        '  float corePool=0.34*exp(-xi*xi*4.2);',
        '  float waterRim=smoothstep(0.83,0.96,xi)*(1.0-smoothstep(0.97,1.012,xi))*(0.74+0.64*nMeso);',
        '  float mainInk=wb.y*(bodyEdge*(0.58+corePool)*(0.80+0.36*fg)+0.46*waterRim);',
        '  float xiHalo=xi-0.10*nFine-0.07*(fg-0.5);',
        '  float halo=wb.y*0.26*(1.0-smoothstep(0.96,1.20,xiHalo))*smoothstep(0.90,0.99,xi);',
        '  float outerRing=wb.y*0.09*smoothstep(1.10,1.17,xiHalo)*(1.0-smoothstep(1.17,1.23,xiHalo));',
        '  return vec2(mainInk+halo+outerRing, waterRim*wb.y);',
        '}',

        'void main(){',
        '  float asp=uRes.x/max(uRes.y,1.0);',
        '  vec3 paperCol=texture2D(uPaper,vUv*uPaperTile).rgb;',
        '  float fg=clamp((0.945-dot(paperCol,vec3(0.3333)))*10.5+0.48,0.0,1.0);',
        '  float safe=textSafeMask(vUv,uSafe,asp,uMob);',
        '  float fade=uState.w;',

        '  float washOpt=0.0, rimBoost=0.0;',
        '  for(int i=0;i<3;i++){',
        '    vec2 wRes=evalInkWash(vUv,uWashA[i],uWashB[i],uState.x,fg,uSeed+float(i)*5.7);',
        '    washOpt+=wRes.x*0.88;',
        '    rimBoost=max(rimBoost,wRes.y);',
        '  }',
        '  washOpt=(washOpt+rimBoost*0.25)*mix(0.04,1.0,safe)*fade;',

        '  vec4 stTex=texture2D(uStroke,vUv);',
        '  float stInk=0.0;',
        '  if(stTex.r>0.015 && stTex.g>0.003 && uState.y>0.002){',
        '    float tip=1.0-smoothstep(uState.y-0.016,uState.y+0.004,stTex.g);',
        '    stInk=(stTex.r+stTex.b*0.15*fg)*tip;',
        '  }',
        '  stInk*=mix(0.03,1.0,safe)*fade;',

        '  float trailInk=0.0;',
        '  for(int j=0;j<12;j++){',
        '    float age=uTrailB[j].y;',
        '    if(age>0.001 && age<0.999){',
        '      float bR=uTrailB[j].x*(1.0+0.35*smoothstep(0.0,0.45,age));',
        '      float sd=segDist(vUv,uTrailA[j].xy,uTrailA[j].zw,asp);',
        '      float fn=vnoise(vUv*uRes*0.09+float(j)*3.1);',
        '      float wd=(sd+(fn-0.5)*bR*0.42)/max(bR,0.001);',
        '      float tBody=1.0-smoothstep(0.75,1.05,wd);',
        '      float tRim=smoothstep(0.72,0.96,wd)*(1.0-smoothstep(0.96,1.12,wd));',
        '      trailInk=max(trailInk,(tBody*0.11+tRim*0.085)*pow(1.0-age,1.65));',
        '    }',
        '  }',
        '  trailInk*=mix(0.28,1.0,safe);',

        '  float totalDen=clamp(washOpt*0.85+stInk*1.20+trailInk,0.0,1.38);',
        '  vec3 jiaoCol=vec3(0.052,0.048,0.043);',
        '  vec3 zhongCol=vec3(0.212,0.200,0.184);',
        '  vec3 mixed=mix(mix(zhongCol,jiaoCol,clamp(stInk*0.95+washOpt*0.45,0.0,1.0)),paperCol,exp(-totalDen*2.38));',
        '  gl_FragColor=vec4(mixed,1.0);',
        '}'
      ].join('\n');

      function compile(type, src) {
        var sh = g.createShader(type);
        g.shaderSource(sh, src);
        g.compileShader(sh);
        return g.getShaderParameter(sh, g.COMPILE_STATUS) ? sh : null;
      }
      var vs = compile(g.VERTEX_SHADER, vsSrc), fs = compile(g.FRAGMENT_SHADER, fsSrc);
      if (!vs || !fs) return null;
      var prog = g.createProgram();
      g.attachShader(prog, vs); g.attachShader(prog, fs); g.linkProgram(prog);
      if (!g.getProgramParameter(prog, g.LINK_STATUS)) return null;

      var quad = g.createBuffer();
      g.bindBuffer(g.ARRAY_BUFFER, quad);
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), g.STATIC_DRAW);

      var paperTex = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, paperTex);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, paperData.canvas);

      var strokeTexs = [];
      for (var i = 0; i < 5; i++) {
        var tex = g.createTexture();
        g.bindTexture(g.TEXTURE_2D, tex);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
        g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
        strokeTexs.push(tex);
      }

      return {
        prog: prog, quad: quad, aPos: g.getAttribLocation(prog, 'aPos'),
        paperTex: paperTex, strokeTexs: strokeTexs,
        uPaper: g.getUniformLocation(prog, 'uPaper'),
        uStroke: g.getUniformLocation(prog, 'uStroke'),
        uRes: g.getUniformLocation(prog, 'uRes'),
        uPaperTile: g.getUniformLocation(prog, 'uPaperTile'),
        uState: g.getUniformLocation(prog, 'uState'),
        uSafe: g.getUniformLocation(prog, 'uSafe'),
        uSeed: g.getUniformLocation(prog, 'uSeed'),
        uMob: g.getUniformLocation(prog, 'uMob'),
        uWashA: g.getUniformLocation(prog, 'uWashA[0]'),
        uWashB: g.getUniformLocation(prog, 'uWashB[0]'),
        uTrailA: g.getUniformLocation(prog, 'uTrailA[0]'),
        uTrailB: g.getUniformLocation(prog, 'uTrailB[0]')
      };
    }

    var lastBakeMob = null, lastBakeH = 0;
    function rebuildStrokesIfNeeded() {
      var strokeW = mob ? 600 : 1024;
      var strokeH = Math.max(420, Math.round(strokeW * (height / Math.max(1, width))));
      if (lastBakeMob === mob && Math.abs(strokeH - lastBakeH) < 70 && bakedCanvases.length === 5) return;
      lastBakeMob = mob; lastBakeH = strokeH;
      scenes = getSceneDefs(mob);
      bakedCanvases = [];
      for (var i = 0; i < 5; i++) {
        var bCv = bakeBeatStrokeMap(scenes[i], strokeW, strokeH);
        if (gl && glState) {
          bakedCanvases.push(bCv);
          gl.bindTexture(gl.TEXTURE_2D, glState.strokeTexs[i]);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bCv);
        } else {
          bakedCanvases.push(make2DInkCopy(bCv));
        }
      }
    }

    function resize() {
      mob = isMobile();
      dpr = Math.min(window.devicePixelRatio || 1, mob ? 1.0 : 1.5);
      var vw = Math.max(1, canvas.clientWidth || window.innerWidth);
      var vh = Math.max(1, canvas.clientHeight || window.innerHeight);
      width = Math.round(vw * dpr);
      height = Math.round(vh * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width; canvas.height = height;
      }
      rebuildStrokesIfNeeded();
      renderOnce();
    }

    var washArrA = new Float32Array(12), washArrB = new Float32Array(12);
    var trailArrA = new Float32Array(48), trailArrB = new Float32Array(24);

    function drawGL(now) {
      var g = gl, gs = glState, sc = scenes[st.beat] || scenes[0];
      g.viewport(0, 0, width, height);
      g.useProgram(gs.prog);
      g.bindBuffer(g.ARRAY_BUFFER, gs.quad);
      g.enableVertexAttribArray(gs.aPos);
      g.vertexAttribPointer(gs.aPos, 2, g.FLOAT, false, 0, 0);

      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, gs.paperTex); g.uniform1i(gs.uPaper, 0);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, gs.strokeTexs[st.beat]); g.uniform1i(gs.uStroke, 1);

      var cssW = width / dpr, cssH = height / dpr;
      g.uniform2f(gs.uRes, cssW, cssH);
      g.uniform2f(gs.uPaperTile, cssW / 380, cssH / 380);
      g.uniform4f(gs.uState, st.bloom, st.stroke, 0, st.fade);
      g.uniform4f(gs.uSafe, st.safe[0], st.safe[1], st.safe[2], st.safe[3]);
      g.uniform1f(gs.uSeed, sc.seed);
      g.uniform1f(gs.uMob, mob ? 1.0 : 0.0);

      for (var i = 0; i < 3; i++) {
        var wd = sc.washes[i], o4 = i * 4;
        if (wd) {
          washArrA[o4] = wd.x; washArrA[o4 + 1] = wd.y; washArrA[o4 + 2] = wd.rx; washArrA[o4 + 3] = wd.ry;
          washArrB[o4] = wd.ang; washArrB[o4 + 1] = wd.den; washArrB[o4 + 2] = wd.t0; washArrB[o4 + 3] = wd.t1;
        } else {
          washArrA[o4 + 2] = 0.1; washArrA[o4 + 3] = 0.1; washArrB[o4 + 1] = 0; washArrB[o4 + 3] = 1;
        }
      }
      g.uniform4fv(gs.uWashA, washArrA);
      g.uniform4fv(gs.uWashB, washArrB);

      for (var t = trails.length - 1; t >= 0; t--) {
        if (now - trails[t].t >= TRAIL_LIFE) trails.splice(t, 1);
      }
      var tCount = Math.min(12, trails.length), sIdx = trails.length - tCount;
      for (var j = 0; j < 12; j++) {
        var j4 = j * 4, j2 = j * 2;
        if (j < tCount) {
          var tr = trails[sIdx + j];
          trailArrA[j4] = tr.x0; trailArrA[j4 + 1] = tr.y0; trailArrA[j4 + 2] = tr.x1; trailArrA[j4 + 3] = tr.y1;
          trailArrB[j2] = tr.r; trailArrB[j2 + 1] = clamp((now - tr.t) / TRAIL_LIFE, 0.002, 0.998);
        } else {
          trailArrB[j2] = 0; trailArrB[j2 + 1] = 0;
        }
      }
      g.uniform4fv(gs.uTrailA, trailArrA);
      g.uniform2fv(gs.uTrailB, trailArrB);
      g.drawArrays(g.TRIANGLE_STRIP, 0, 4);
    }

    var paperPat = null;
    function draw2DFallback(now) {
      var c = ctx2d;
      if (!c) return;
      if (!paperPat) paperPat = c.createPattern(paperData.canvas, 'repeat');
      c.save();
      c.fillStyle = paperPat || '#f4efe3';
      c.fillRect(0, 0, width, height);
      var sc = scenes[st.beat] || scenes[0];
      c.globalAlpha = st.fade;
      for (var i = 0; i < sc.washes.length; i++) {
        var wd = sc.washes[i];
        var locB = clamp((st.bloom - wd.t0) / Math.max(0.08, wd.t1 - wd.t0), 0, 1);
        if (locB <= 0.01) continue;
        var sp = 1 - Math.pow(1 - locB, 2.2);
        c.save();
        c.translate(wd.x * width, wd.y * height); c.rotate(wd.ang); c.beginPath();
        for (var a = 0; a <= 48; a++) {
          var th = (a / 48) * Math.PI * 2;
          var wob = 1 + 0.14 * Math.sin(th * 3 + sc.seed) + 0.08 * Math.cos(th * 7 - i * 2) + 0.04 * Math.sin(th * 15);
          var px = Math.cos(th) * wd.rx * width * sp * wob, py = Math.sin(th) * wd.ry * height * sp * wob;
          if (a === 0) c.moveTo(px, py); else c.lineTo(px, py);
        }
        c.closePath();
        c.fillStyle = 'rgba(24,22,19,' + (wd.den * 0.34).toFixed(3) + ')'; c.fill();
        c.lineWidth = Math.max(1.5, 2.5 * dpr);
        c.strokeStyle = 'rgba(18,16,14,' + (wd.den * 0.24).toFixed(3) + ')'; c.stroke();
        c.restore();
      }
      var bCv = bakedCanvases[st.beat];
      if (bCv && st.stroke > 0.02) {
        c.save();
        c.globalAlpha = st.fade * clamp(st.stroke * 1.15, 0, 1) * 0.92;
        c.drawImage(bCv, 0, 0, width, height);
        c.restore();
      }
      for (var t = trails.length - 1; t >= 0; t--) {
        if (now - trails[t].t >= TRAIL_LIFE) trails.splice(t, 1);
      }
      c.restore();
    }

    function renderOnce() {
      var now = performance.now();
      if (gl && glState) drawGL(now);
      else draw2DFallback(now);
    }

    var rafId = 0, paused = false;
    function tick() {
      rafId = 0;
      if (paused || document.hidden) return;
      renderOnce();
      if (trails.length > 0 && !reduceMotion) rafId = requestAnimationFrame(tick);
    }
    function wakeLoop() {
      if (!paused && !document.hidden && !rafId) rafId = requestAnimationFrame(tick);
    }

    Engine.setState = function (beatIdx, bloomP, strokeP, fadeP, immediate) {
      st.beat = clamp(beatIdx | 0, 0, 4);
      st.bloom = clamp(bloomP, 0, 1);
      st.stroke = clamp(strokeP, 0, 1);
      st.fade = clamp(fadeP, 0, 1);
      if (immediate) renderOnce();
      else wakeLoop();
    };
    Engine.setSafeBox = function (x0, y0, x1, y1) {
      st.safe[0] = clamp(x0, 0, 1); st.safe[1] = clamp(y0, 0, 1);
      st.safe[2] = clamp(x1, 0, 1); st.safe[3] = clamp(y1, 0, 1);
    };
    Engine.resize = resize;
    Engine.stop = function () { paused = true; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } };
    Engine.start = function () { paused = false; renderOnce(); if (trails.length > 0 && !reduceMotion) wakeLoop(); };

    resize();
    root.classList.add('ink-ready');
    Engine.ready = true;
  }
})();
