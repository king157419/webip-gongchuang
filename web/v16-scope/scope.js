/* =====================================================================
 * 上海大学人工智能社 · v16-scope 示波器波形与轮廓采样引擎
 * 纯原生 Canvas 2D · 无外部依赖 · DPR 上限桌面 1.5 / 手机 1.0
 * ===================================================================== */
(function (window, document) {
  'use strict';

  var SAMPLE_N = 1440;
  var TAU = Math.PI * 2;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function smoothstep(a, b, x) {
    var t = clamp((x - a) / (b - a || 1), 0, 1);
    return t * t * (3 - 2 * t);
  }

  /* -------------------------------------------------------------------
   * 1. 有向网格半边追踪器：将「上海大学人工智能社」真字形轮廓采样为单条连续波形
   * ------------------------------------------------------------------- */
  function buildTextWaveform(isNarrow) {
    var off = document.createElement('canvas');
    var W = isNarrow ? 520 : 920;
    var H = isNarrow ? 196 : 150;
    off.width = W;
    off.height = H;
    var octx = off.getContext('2d');
    if (!octx) return buildFallbackHeroWave();

    octx.clearRect(0, 0, W, H);
    octx.fillStyle = '#ffffff';
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';

    if (isNarrow) {
      octx.font = '900 68px "SHU Serif", "Songti SC", "Noto Serif SC", Georgia, serif';
      octx.fillText('上海大学', W * 0.5, H * 0.29);
      octx.fillText('人工智能社', W * 0.5, H * 0.74);
    } else {
      octx.font = '900 82px "SHU Serif", "Songti SC", "Noto Serif SC", Georgia, serif';
      octx.fillText('上海大学人工智能社', W * 0.5, H * 0.52);
    }

    var img;
    try {
      img = octx.getImageData(0, 0, W, H).data;
    } catch (e) {
      return buildFallbackHeroWave();
    }

    var grid = new Uint8Array(W * H);
    var filledCount = 0;
    for (var i = 0, p = 0; i < grid.length; i++, p += 4) {
      if (img[p + 3] >= 112) {
        grid[i] = 1;
        filledCount++;
      }
    }
    if (filledCount < 120) return buildFallbackHeroWave();

    function ins(x, y) {
      if (x < 0 || x >= W || y < 0 || y >= H) return 0;
      return grid[y * W + x];
    }

    // 收集像素边界上的有向单位边，保证闭合轮廓环且不自交
    var edgeMap = new Map();
    var allEdges = [];

    function addEdge(x1, y1, x2, y2) {
      var k = x1 + ',' + y1;
      var e = { x1: x1, y1: y1, x2: x2, y2: y2, used: false };
      var arr = edgeMap.get(k);
      if (!arr) {
        arr = [];
        edgeMap.set(k, arr);
      }
      arr.push(e);
      allEdges.push(e);
    }

    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        if (!ins(x, y)) continue;
        if (!ins(x, y - 1)) addEdge(x, y, x + 1, y);
        if (!ins(x + 1, y)) addEdge(x + 1, y, x + 1, y + 1);
        if (!ins(x, y + 1)) addEdge(x + 1, y + 1, x, y + 1);
        if (!ins(x - 1, y)) addEdge(x, y + 1, x, y);
      }
    }

    var loops = [];
    for (var ei = 0; ei < allEdges.length; ei++) {
      var start = allEdges[ei];
      if (start.used) continue;
      start.used = true;
      var pts = [{ x: start.x1, y: start.y1 }];
      var cur = start;
      var guard = 0;
      while (guard++ < 8000) {
        pts.push({ x: cur.x2, y: cur.y2 });
        if (cur.x2 === start.x1 && cur.y2 === start.y1) break;
        var nextList = edgeMap.get(cur.x2 + ',' + cur.y2);
        if (!nextList) break;
        var chosen = null;
        for (var j = 0; j < nextList.length; j++) {
          if (!nextList[j].used) {
            chosen = nextList[j];
            break;
          }
        }
        if (!chosen) break;
        chosen.used = true;
        cur = chosen;
      }
      if (pts.length >= 8) {
        loops.push(smoothLoop(pts));
      }
    }

    if (!loops.length) return buildFallbackHeroWave();

    // 计算每个闭合环的几何中心与包围盒，按阅读顺序分桶串联
    var minX = W, maxX = 0, minY = H, maxY = 0;
    for (var li = 0; li < loops.length; li++) {
      var lp = loops[li];
      var sx = 0, sy = 0;
      for (var k = 0; k < lp.length; k++) {
        var px = lp[k].x, py = lp[k].y;
        sx += px;
        sy += py;
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }
      lp.cx = sx / lp.length;
      lp.cy = sy / lp.length;
    }

    var spanX = Math.max(1, maxX - minX);
    var spanY = Math.max(1, maxY - minY);
    var midX = (minX + maxX) * 0.5;
    var midY = (minY + maxY) * 0.5;
    var scaleX = isNarrow
      ? 1.68 / spanX
      : 1.72 / spanX;
    var scaleY = isNarrow
      ? Math.min(1.52 / spanY, scaleX * 2.55)
      : Math.min(1.22 / spanY, scaleX * 4.35);

    function normPt(pt) {
      return {
        x: (pt.x - midX) * scaleX,
        y: (pt.y - midY) * scaleY
      };
    }

    // 按字符列（窄屏先分上下两行再分列）做最近邻串联，模拟真实 XY 示波器电子束走线
    var bucketCount = 9;
    var buckets = [];
    for (var b = 0; b < bucketCount; b++) buckets.push([]);

    for (var m = 0; m < loops.length; m++) {
      var item = loops[m];
      var bIdx;
      if (isNarrow) {
        var isBottom = item.cy >= H * 0.51;
        var relX = clamp((item.cx - minX) / spanX, 0, 0.999);
        bIdx = isBottom ? 4 + Math.floor(relX * 5) : Math.floor(relX * 4);
      } else {
        var rx = clamp((item.cx - minX) / spanX, 0, 0.999);
        bIdx = Math.floor(rx * 9);
      }
      buckets[clamp(bIdx, 0, 8)].push(item);
    }

    var rawChain = [];
    var leadY = isNarrow ? -0.34 : 0.0;
    rawChain.push({ x: -0.96, y: leadY, w: 0.35 });
    var lastPt = { x: -0.92, y: leadY };
    rawChain.push({ x: lastPt.x, y: lastPt.y, w: 0.35 });

    for (var bi = 0; bi < bucketCount; bi++) {
      var grp = buckets[bi];
      if (!grp.length) continue;
      grp.sort(function (a, b2) { return a.cx - b2.cx; });
      var usedLoop = new Uint8Array(grp.length);

      for (var step = 0; step < grp.length; step++) {
        var bestL = -1;
        var bestK = 0;
        var bestDist = Infinity;
        for (var gi = 0; gi < grp.length; gi++) {
          if (usedLoop[gi]) continue;
          var cand = grp[gi];
          for (var ck = 0; ck < cand.length; ck += 3) {
            var np = normPt(cand[ck]);
            var dx = np.x - lastPt.x;
            var dy = np.y - lastPt.y;
            var d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
              bestDist = d2;
              bestL = gi;
              bestK = ck;
            }
          }
        }
        if (bestL < 0) break;
        usedLoop[bestL] = 1;
        var chosenLoop = grp[bestL];
        var entry = normPt(chosenLoop[bestK]);

        // 电子束跨笔画暗跳线（Z 轴消隐感）
        rawChain.push({ x: entry.x, y: entry.y, w: step === 0 ? 0.18 : 0.11 });

        var L = chosenLoop.length - 1;
        for (var s = 1; s <= L; s++) {
          var pNorm = normPt(chosenLoop[(bestK + s) % L]);
          rawChain.push({ x: pNorm.x, y: pNorm.y, w: 1.0 });
          lastPt = pNorm;
        }
      }
    }

    var tailY = isNarrow ? 0.34 : 0.0;
    rawChain.push({ x: 0.92, y: tailY, w: 0.22 });
    rawChain.push({ x: 0.96, y: tailY, w: 0.35 });

    return resampleChain(rawChain, SAMPLE_N);
  }

  function smoothLoop(pts) {
    var n = pts.length - 1;
    if (n < 6) return pts;
    var cur = pts.slice(0, n);
    for (var pass = 0; pass < 2; pass++) {
      var next = new Array(cur.length);
      for (var i = 0; i < cur.length; i++) {
        var p0 = cur[(i - 1 + cur.length) % cur.length];
        var p1 = cur[i];
        var p2 = cur[(i + 1) % cur.length];
        next[i] = {
          x: p0.x * 0.24 + p1.x * 0.52 + p2.x * 0.24,
          y: p0.y * 0.24 + p1.y * 0.52 + p2.y * 0.24
        };
      }
      cur = next;
    }
    // 适度抽稀，保留精细笔锋
    var out = [];
    for (var k = 0; k < cur.length; k += 2) {
      out.push(cur[k]);
    }
    out.push({ x: out[0].x, y: out[0].y });
    return out;
  }

  function resampleChain(chain, targetN) {
    var cum = new Float32Array(chain.length);
    var total = 0;
    for (var i = 1; i < chain.length; i++) {
      var dx = chain[i].x - chain[i - 1].x;
      var dy = chain[i].y - chain[i - 1].y;
      var seg = Math.hypot(dx, dy);
      // 让暗跳线占用更少采样点，把 92% 以上的采样密度留给真实笔画轮廓
      var weight = chain[i].w < 0.5 ? 0.22 : 1.0;
      total += Math.max(1e-5, seg * weight);
      cum[i] = total;
    }

    var xs = new Float32Array(targetN);
    var ys = new Float32Array(targetN);
    var ws = new Float32Array(targetN);
    var idx = 1;

    for (var s = 0; s < targetN; s++) {
      var d = (s / (targetN - 1)) * total;
      while (idx < chain.length - 1 && cum[idx] < d) idx++;
      var c0 = cum[idx - 1];
      var c1 = cum[idx];
      var t = c1 > c0 ? (d - c0) / (c1 - c0) : 0;
      var a = chain[idx - 1];
      var b = chain[idx];
      xs[s] = lerp(a.x, b.x, t);
      ys[s] = lerp(a.y, b.y, t);
      ws[s] = b.w;
    }
    return { x: xs, y: ys, w: ws };
  }

  function buildFallbackHeroWave() {
    var xs = new Float32Array(SAMPLE_N);
    var ys = new Float32Array(SAMPLE_N);
    var ws = new Float32Array(SAMPLE_N);
    for (var i = 0; i < SAMPLE_N; i++) {
      var u = i / (SAMPLE_N - 1);
      var x = lerp(-0.95, 0.95, u);
      var env = Math.exp(-Math.pow((u - 0.5) * 3.1, 2));
      xs[i] = x;
      ys[i] = -env * 0.62 * Math.sin(u * 38) * Math.cos(u * 9);
      ws[i] = 1;
    }
    return { x: xs, y: ys, w: ws };
  }

  /* -------------------------------------------------------------------
   * 2. 频道 2–5 锁定目标波形构造器（全部统一为 SAMPLE_N 点连续电子束）
   * ------------------------------------------------------------------- */

  // 频道 2：五类常态活动 —— 五段特征调制信号列
  function buildCh2Wave() {
    var xs = new Float32Array(SAMPLE_N);
    var ys = new Float32Array(SAMPLE_N);
    var ws = new Float32Array(SAMPLE_N);
    for (var i = 0; i < SAMPLE_N; i++) {
      var u = i / (SAMPLE_N - 1);
      var x = lerp(-0.94, 0.94, u);
      var segFloat = u * 5;
      var seg = Math.min(4, Math.floor(segFloat));
      var s = segFloat - seg; // 0..1
      var win = Math.sin(Math.PI * clamp((s - 0.05) / 0.9, 0, 1));
      var y = 0;

      if (s < 0.05 || s > 0.95) {
        y = 0;
      } else if (seg === 0) {
        // 1. 电路焊接：电容放电尖峰 + 阻尼振荡
        var t0 = (s - 0.12) / 0.8;
        y = t0 < 0 ? 0 : -0.72 * Math.exp(-3.4 * t0) * Math.cos(t0 * 24);
      } else if (seg === 1) {
        // 2. 昇腾 AI 课：张量量化阶梯激活波
        var step = Math.round(((s - 0.08) / 0.84) * 5) / 5;
        y = -(step * 2 - 1) * 0.56 * win;
      } else if (seg === 2) {
        // 3. 企业参访：双边带调幅载波包络
        y = -0.64 * (0.28 + 0.72 * win) * Math.sin(s * 44);
      } else if (seg === 3) {
        // 4. 创新大赛：高 Q 谐振冲顶峰
        var d = (s - 0.5) * 14;
        var sinc = Math.abs(d) < 1e-3 ? 1 : Math.sin(d) / d;
        y = -0.76 * sinc * win;
      } else {
        // 5. 系列分享会：三谐波清晰声波
        y = -0.54 * win * (0.6 * Math.sin(s * 18) + 0.28 * Math.sin(s * 36 + 0.7) + 0.16 * Math.sin(s * 54));
      }

      xs[i] = x;
      ys[i] = y;
      ws[i] = 1.0;
    }
    return { x: xs, y: ys, w: ws };
  }

  // 频道 3：做过的事 —— 基于 CLUB.news 全部 16 篇真实日期的脉冲频谱
  function buildCh3Wave(newsList) {
    var xs = new Float32Array(SAMPLE_N);
    var ys = new Float32Array(SAMPLE_N);
    var ws = new Float32Array(SAMPLE_N);

    var tMin = Date.parse('2021-11-01') || 1635724800000;
    var tMax = Date.parse('2026-12-15') || 1797292800000;
    var pulses = [];

    var list = Array.isArray(newsList) ? newsList : [];
    for (var k = 0; k < list.length; k++) {
      var item = list[k];
      var ts = Date.parse(item.date) || lerp(tMin, tMax, k / Math.max(1, list.length - 1));
      var pos = lerp(-0.86, 0.86, clamp((ts - tMin) / (tMax - tMin), 0.02, 0.98));
      var txt = (item.title || '') + (item.summary || '');
      var amp = 0.40;
      if (/200/.test(txt)) amp = 0.78;
      else if (/百余/.test(txt)) amp = 0.68;
      else if (/近百/.test(txt)) amp = 0.63;
      else if (/四十|40/.test(txt)) amp = 0.58;
      else if (/决赛/.test(txt)) amp = 0.54;
      pulses.push({ x: pos, amp: amp, date: item.date || '' });
    }

    for (var i = 0; i < SAMPLE_N; i++) {
      var u = i / (SAMPLE_N - 1);
      var x = lerp(-0.94, 0.94, u);
      var y = 0.24; // 底部时间轴基线
      for (var p = 0; p < pulses.length; p++) {
        var dx = (x - pulses[p].x) / 0.019;
        if (Math.abs(dx) < 4.5) {
          y -= pulses[p].amp * Math.exp(-dx * dx * 0.9) * Math.cos(dx * 1.15);
        }
      }
      xs[i] = x;
      ys[i] = clamp(y, -0.78, 0.45);
      ws[i] = 1.0;
    }
    return { x: xs, y: ys, w: ws, pulses: pulses };
  }

  // 频道 4：谁在带大家 —— 3:4 锁相李萨如图形（3 位核心带队 × 4 个部门协同）
  function buildCh4Wave() {
    var xs = new Float32Array(SAMPLE_N);
    var ys = new Float32Array(SAMPLE_N);
    var ws = new Float32Array(SAMPLE_N);

    var leftN = Math.floor(SAMPLE_N * 0.18);
    var rightStart = Math.floor(SAMPLE_N * 0.82);
    var midN = rightStart - leftN;

    for (var i = 0; i < SAMPLE_N; i++) {
      if (i < leftN) {
        var ul = i / leftN;
        xs[i] = lerp(-0.94, -0.34, ul);
        ys[i] = -0.18 * Math.sin(ul * TAU * 3) * smoothstep(0, 0.3, ul);
        ws[i] = 0.85;
      } else if (i < rightStart) {
        var um = (i - leftN) / midN;
        var th = um * TAU * 2;
        xs[i] = 0.34 * Math.sin(3 * th + Math.PI * 0.25);
        ys[i] = -0.66 * Math.sin(4 * th);
        ws[i] = 1.0;
      } else {
        var ur = (i - rightStart) / (SAMPLE_N - 1 - rightStart);
        xs[i] = lerp(0.34, 0.94, ur);
        ys[i] = -0.18 * Math.sin(ur * TAU * 3) * (1 - smoothstep(0.7, 1, ur));
        ws[i] = 0.85;
      }
    }
    return { x: xs, y: ys, w: ws };
  }

  // 频道 5：怎么加入 —— 吉祥物「小智」双天线轮廓 XY 矢量波 + 欢迎脉冲
  function buildCh5Wave() {
    var chain = [];

    // 左侧接入心电欢迎波
    for (var i = 0; i <= 48; i++) {
      var t = i / 48;
      var x = lerp(-0.94, -0.26, t);
      var ecg = 0;
      if (t > 0.42 && t < 0.68) {
        var q = (t - 0.55) / 0.045;
        ecg = -0.52 * Math.exp(-q * q) * Math.cos(q * 1.7);
      }
      chain.push({ x: x, y: ecg, w: 0.92 });
    }

    // 小智圆润头部 + 双球形天线 + 耳机罩外轮廓（闭合一笔画）
    var bodyPts = [
      [-0.20, 0.12], [-0.24, 0.06], [-0.24, -0.16], [-0.20, -0.22],
      [-0.15, -0.38], [-0.11, -0.46], [-0.15, -0.62], [-0.18, -0.68],
      [-0.15, -0.75], [-0.09, -0.75], [-0.06, -0.67], [-0.07, -0.49],
      [0.00, -0.51], [0.07, -0.49], [0.06, -0.67], [0.09, -0.75],
      [0.15, -0.75], [0.18, -0.68], [0.15, -0.62], [0.11, -0.46],
      [0.15, -0.38], [0.20, -0.22], [0.24, -0.16], [0.24, 0.06],
      [0.20, 0.12], [0.23, 0.30], [0.18, 0.36], [0.15, 0.48],
      [0.16, 0.62], [0.04, 0.62], [0.03, 0.52], [-0.03, 0.52],
      [-0.04, 0.62], [-0.16, 0.62], [-0.15, 0.48], [-0.18, 0.36],
      [-0.23, 0.30], [-0.20, 0.12]
    ];
    chain.push({ x: bodyPts[0][0], y: bodyPts[0][1], w: 0.16 });
    for (var b = 0; b < bodyPts.length; b++) {
      chain.push({ x: bodyPts[b][0], y: bodyPts[b][1], w: 1.0 });
    }

    // 面罩框
    var visor = [
      [-0.14, -0.28], [0.14, -0.28], [0.16, -0.18], [0.16, -0.02],
      [0.14, 0.06], [-0.14, 0.06], [-0.16, -0.02], [-0.16, -0.18], [-0.14, -0.28]
    ];
    chain.push({ x: visor[0][0], y: visor[0][1], w: 0.14 });
    for (var v = 0; v < visor.length; v++) {
      chain.push({ x: visor[v][0], y: visor[v][1], w: 1.0 });
    }

    // 左像素笑眼 ^ 与右像素横线眼 —
    var leftEye = [[-0.10, -0.10], [-0.07, -0.18], [-0.04, -0.10]];
    chain.push({ x: leftEye[0][0], y: leftEye[0][1], w: 0.12 });
    for (var le = 0; le < leftEye.length; le++) {
      chain.push({ x: leftEye[le][0], y: leftEye[le][1], w: 1.0 });
    }
    chain.push({ x: 0.04, y: -0.13, w: 0.12 });
    chain.push({ x: 0.11, y: -0.13, w: 1.0 });

    // 胸口能量圆点
    for (var c = 0; c <= 16; c++) {
      var ang = (c / 16) * TAU;
      chain.push({
        x: Math.cos(ang) * 0.036,
        y: 0.22 + Math.sin(ang) * 0.055,
        w: c === 0 ? 0.12 : 1.0
      });
    }

    // 右侧锁定载波输出
    chain.push({ x: 0.26, y: 0, w: 0.18 });
    for (var r = 0; r <= 48; r++) {
      var tr = r / 48;
      var xr = lerp(0.26, 0.94, tr);
      var yr = -0.14 * Math.sin(tr * TAU * 3) * (1 - tr * 0.55);
      chain.push({ x: xr, y: yr, w: 0.92 });
    }

    return resampleChain(chain, SAMPLE_N);
  }

  /* -------------------------------------------------------------------
   * 3. 示波器主渲染器：刻度底板缓存 + 余辉拖尾 + 调频噪声锁定 + 指针微扰
   * ------------------------------------------------------------------- */
  function createScope(canvas, screenEl, options) {
    if (!canvas || !canvas.getContext) return null;
    var ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return null;

    var opts = options || {};
    var reducedMotion = !!opts.reducedMotion;

    var width = 0;
    var height = 0;
    var dpr = 1;
    var waveCenterY = 140;
    var waveHalfH = 95;
    var isNarrow = window.innerWidth < 580;

    // 刻度网格离屏缓存，避免每帧重绘上百条网格线
    var gridCanvas = document.createElement('canvas');
    var gridCtx = gridCanvas.getContext('2d');

    var waves = [
      buildTextWaveform(isNarrow),
      buildCh2Wave(),
      buildCh3Wave(opts.news || []),
      buildCh4Wave(),
      buildCh5Wave()
    ];

    // 字体加载完毕后用真 SHU Serif 重采样一次首屏字形轮廓
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        waves[0] = buildTextWaveform(window.innerWidth < 580);
        if (reducedMotion) renderOnce(performance.now());
      });
    }

    var state = {
      fromCh: 0,
      toCh: 0,
      morph: 0,
      turbulence: 0,
      scrollPhase: 0,
      activeCh: 0,
      locked: true,
      focusIndex: -1, // 悬停第几项活动或报道
      phosphor: 'green'
    };

    var bootStart = performance.now();
    var lockFlash = 0;
    var calPulse = -1;
    var wasLocked = true;

    // 指针微扰状态
    var pointer = { x: -9999, y: -9999, vx: 0, vy: 0, active: false };
    var inViewport = true;
    var pageVisible = !document.hidden;
    var rafId = 0;

    function getColors() {
      if (state.phosphor === 'amber') {
        return {
          bgFade: 'rgba(10, 17, 14, 0.30)',
          bgSolid: '#0A110E',
          halo: 'rgba(238, 166, 58, 0.17)',
          main: '#EEA63A',
          retrace: 'rgba(238, 166, 58, 0.16)',
          ghost: 'rgba(238, 166, 58, 0.22)',
          core: '#FFF3D6',
          label: 'rgba(238, 166, 58, 0.78)'
        };
      }
      return {
        bgFade: 'rgba(10, 17, 14, 0.30)',
        bgSolid: '#0A110E',
        halo: 'rgba(63, 224, 134, 0.17)',
        main: '#3FE086',
        retrace: 'rgba(63, 224, 134, 0.16)',
        ghost: 'rgba(63, 224, 134, 0.22)',
        core: '#DCFFEE',
        label: 'rgba(63, 224, 134, 0.78)'
      };
    }

    function rebuildGrid() {
      gridCanvas.width = Math.max(1, Math.round(width * dpr));
      gridCanvas.height = Math.max(1, Math.round(height * dpr));
      gridCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      gridCtx.clearRect(0, 0, width, height);

      var cols = 10;
      var rows = 8;
      gridCtx.strokeStyle = 'rgba(180, 226, 198, 0.065)';
      gridCtx.lineWidth = 1;
      gridCtx.beginPath();
      for (var c = 1; c < cols; c++) {
        var gx = Math.round((width / cols) * c) + 0.5;
        gridCtx.moveTo(gx, 0);
        gridCtx.lineTo(gx, height);
      }
      for (var r = 1; r < rows; r++) {
        var gy = Math.round((height / rows) * r) + 0.5;
        gridCtx.moveTo(0, gy);
        gridCtx.lineTo(width, gy);
      }
      gridCtx.stroke();

      // 波形区中心十字精密细刻度线
      var cy = Math.round(waveCenterY) + 0.5;
      var cx = Math.round(width * 0.5) + 0.5;
      gridCtx.strokeStyle = 'rgba(180, 226, 198, 0.14)';
      gridCtx.beginPath();
      gridCtx.moveTo(0, cy);
      gridCtx.lineTo(width, cy);
      gridCtx.moveTo(cx, 34);
      gridCtx.lineTo(cx, waveCenterY + waveHalfH + 14);

      var subTicks = 50;
      for (var t = 1; t < subTicks; t++) {
        var tx = (width / subTicks) * t;
        gridCtx.moveTo(tx, cy - 3);
        gridCtx.lineTo(tx, cy + 3);
      }
      for (var ty = 42; ty < waveCenterY + waveHalfH + 10; ty += 14) {
        gridCtx.moveTo(cx - 3, ty);
        gridCtx.lineTo(cx + 3, ty);
      }
      gridCtx.stroke();
    }

    function resize() {
      var rect = screenEl.getBoundingClientRect();
      var nextW = Math.max(280, Math.round(rect.width));
      var nextH = Math.max(260, Math.round(rect.height));
      var mobile = window.innerWidth < 768;
      dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);

      var nextNarrow = window.innerWidth < 580;
      if (nextNarrow !== isNarrow) {
        isNarrow = nextNarrow;
        waves[0] = buildTextWaveform(isNarrow);
      }

      width = nextW;
      height = nextH;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // 计算上方波形主舞台中心与振幅空间
      var teleEl = document.querySelector('.crt-telemetry');
      var waveZoneEl = document.getElementById('wave-zone');
      var topH = teleEl ? teleEl.offsetHeight : 36;
      var zoneH = waveZoneEl ? waveZoneEl.offsetHeight : Math.round(height * 0.30);

      if (reducedMotion || document.documentElement.classList.contains('fallback-flow')) {
        waveCenterY = topH + zoneH * 0.50;
        waveHalfH = Math.max(46, zoneH * 0.41);
      } else {
        waveCenterY = topH + zoneH * 0.50;
        waveHalfH = Math.max(46, zoneH * 0.42);
      }

      ctx.fillStyle = '#0A110E';
      ctx.fillRect(0, 0, width, height);
      rebuildGrid();
      if (reducedMotion) renderOnce(performance.now());
    }

    function drawChannelAnnotations(pal) {
      if (state.turbulence > 0.35) return;
      var alpha = clamp(1 - state.turbulence * 2.5, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha * 0.85;
      ctx.font = '11px "Geist Mono", monospace';
      ctx.fillStyle = pal.label;

      var padX = Math.max(18, width * 0.04);
      var spanW = width - padX * 2;

      if (state.activeCh === 1 && !isNarrow) {
        var labels = ['01 焊接脉冲', '02 昇腾阶梯', '03 参访调幅', '04 大赛谐振', '05 分享声波'];
        for (var s = 0; s < 5; s++) {
          var lx = padX + spanW * ((s + 0.5) / 5);
          ctx.textAlign = 'center';
          var isHot = state.focusIndex === s;
          ctx.globalAlpha = alpha * (isHot ? 1 : 0.58);
          ctx.fillText(labels[s], lx, waveCenterY - waveHalfH + 8);
          if (isHot) {
            ctx.strokeStyle = pal.main;
            ctx.lineWidth = 1;
            var bx = padX + spanW * (s / 5) + 4;
            var bw = spanW / 5 - 8;
            ctx.strokeRect(bx, waveCenterY - waveHalfH + 14, bw, waveHalfH * 1.65);
          }
        }
      } else if (state.activeCh === 2) {
        var yrs = ['2022', '2023', '2024', '2025', '2026'];
        ctx.textAlign = 'center';
        for (var y = 0; y < yrs.length; y++) {
          var yx = padX + spanW * (0.08 + (y / 4) * 0.84);
          ctx.fillText(yrs[y], yx, waveCenterY + waveHalfH * 0.52);
        }
        // 悬停精选报道时在对应日期脉冲峰顶画锁定游标
        if (state.focusIndex >= 0 && waves[2].pulses && waves[2].pulses[state.focusIndex]) {
          var fp = waves[2].pulses[state.focusIndex];
          var px = width * 0.5 + fp.x * (spanW * 0.5);
          var py = waveCenterY + (0.24 - fp.amp) * waveHalfH;
          ctx.strokeStyle = pal.core;
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, TAU);
          ctx.stroke();
          ctx.fillText(fp.date, px, Math.max(50, py - 10));
        }
      }
      ctx.restore();
    }

    // 频道 4 与频道 5 的中心 XY 矢量图形按屏幕高宽比做等比修正，避免宽屏下横向拉扁
    function adjustIsoX(chIdx, xVal, halfX, ampY) {
      if (chIdx !== 3 && chIdx !== 4) return xVal;
      var iso = clamp((ampY * 1.28) / Math.max(1, halfX), 0.26, 0.92);
      var lim = chIdx === 3 ? 0.34 : 0.26;
      if (Math.abs(xVal) <= lim) {
        return xVal * (iso / lim) * 0.72;
      }
      var sign = xVal < 0 ? -1 : 1;
      var innerEdge = sign * 0.72 * iso;
      var t = (Math.abs(xVal) - lim) / (0.94 - lim);
      return lerp(innerEdge, sign * 0.94, clamp(t, 0, 1));
    }

    function renderFrame(now, isStatic) {
      if (!width || !height) return;
      var pal = getColors();

      // 1) CRT 荧光屏指数衰减余辉层
      if (isStatic) {
        ctx.fillStyle = pal.bgSolid;
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.fillStyle = state.turbulence > 0.15 ? 'rgba(10, 17, 14, 0.24)' : pal.bgFade;
        ctx.fillRect(0, 0, width, height);
      }

      // 2) 叠加预渲染细网格刻度
      ctx.drawImage(gridCanvas, 0, 0, width, height);

      var wFrom = waves[state.fromCh] || waves[0];
      var wTo = waves[state.toCh] || waves[0];
      var m = state.morph;
      var turb = state.turbulence;

      // 首屏开机 0.95 秒快速扫出「上海大学人工智能社」轮廓（若带跳转参数或静态帧则直接全显）
      var bootProgress = isStatic ? 1 : clamp((now - bootStart) / 760, 0.28, 1);
      var drawLimit = (state.fromCh === 0 && state.toCh === 0 && m === 0)
        ? Math.max(24, Math.floor(SAMPLE_N * bootProgress))
        : SAMPLE_N;

      // 调台动作期，波形可向屏幕纵深大幅扩张，制造强烈失锁冲击；锁定时安静收束回上方波形带
      var curCenterY = lerp(waveCenterY, height * 0.46, turb * 0.55);
      var curAmpY = lerp(waveHalfH, height * 0.34, turb * 0.65);
      var halfSpanX = Math.max(110, width * 0.46);
      var cx = width * 0.5;

      var tSec = isStatic ? 0 : now * 0.001;
      var ph = state.scrollPhase;

      // 校准脉冲位置（0..1）
      var pulseU = -1;
      if (calPulse >= 0) {
        pulseU = (now - calPulse) / 680;
        if (pulseU > 1.15) calPulse = -1;
      }

      // 计算当前帧所有顶点屏幕坐标
      var pxArr = renderFrame.px || (renderFrame.px = new Float32Array(SAMPLE_N));
      var pyArr = renderFrame.py || (renderFrame.py = new Float32Array(SAMPLE_N));
      var pwArr = renderFrame.pw || (renderFrame.pw = new Float32Array(SAMPLE_N));

      for (var i = 0; i < drawLimit; i++) {
        var u = i / (SAMPLE_N - 1);
        var fx = adjustIsoX(state.fromCh, wFrom.x[i], halfSpanX, curAmpY);
        var tx = adjustIsoX(state.toCh, wTo.x[i], halfSpanX, curAmpY);
        var bx = lerp(fx, tx, m);
        var by = lerp(wFrom.y[i], wTo.y[i], m);
        var bw = lerp(wFrom.w[i], wTo.w[i], m);

        // 锁定状态下的极轻微生命呼吸（绝不喧宾夺主）
        if (!isStatic && turb < 0.05) {
          if (state.activeCh === 1) {
            var segIdx = Math.min(4, Math.floor(u * 5));
            var boost = state.focusIndex === segIdx ? 1.32 : 1.0;
            by *= boost * (1 + 0.04 * Math.sin(tSec * 3.2 + segIdx));
          } else if (state.activeCh === 3 && i > SAMPLE_N * 0.18 && i < SAMPLE_N * 0.82) {
            var um = (i - SAMPLE_N * 0.18) / (SAMPLE_N * 0.64);
            var th = um * TAU * 2;
            var rawLx = 0.34 * Math.sin(3 * th + Math.PI * 0.25 + Math.sin(tSec * 0.7) * 0.18);
            bx = adjustIsoX(3, rawLx, halfSpanX, curAmpY);
          } else {
            by += Math.sin(u * 16 - tSec * 2.1) * 0.008;
          }
        }

        // 调频动作段（0-40% 及回滑过渡段）：严格跟滚动相位的模拟失真、扫频谐波与高频热噪声
        if (turb > 0.001) {
          var sweepX = lerp(-0.95, 0.95, u);
          bx = lerp(bx, sweepX, smoothstep(0, 0.55, turb) * 0.78);

          var fm = Math.sin(u * (26 + 38 * turb) + ph * 9.5) * 0.46
                 + Math.sin(u * 83 - ph * 17.0 + Math.sin(u * 9 + ph)) * 0.28
                 + Math.cos(u * 191 + ph * 31.0 + i * 0.37) * 0.22;
          by = lerp(by, fm, turb * 0.88);
          bw = Math.max(bw, turb * 0.95);
        }

        // 脉冲校准行波
        if (pulseU >= 0 && pulseU <= 1.15) {
          var du = (u - pulseU) / 0.055;
          if (Math.abs(du) < 3.2) {
            by -= 0.30 * Math.exp(-du * du) * Math.cos(du * 3.5);
          }
        }

        var sx = cx + bx * halfSpanX;
        var sy = curCenterY + by * curAmpY;

        // 鼠标 / 手指靠近时的洛伦兹电磁偏转微扰彩蛋
        if (pointer.active) {
          var dxp = sx - pointer.x;
          var dyp = sy - pointer.y;
          var dist2 = dxp * dxp + dyp * dyp;
          var rad = 92;
          if (dist2 < rad * rad) {
            var falloff = 1 - Math.sqrt(dist2) / rad;
            var ripple = Math.sin(Math.sqrt(dist2) * 0.22 - tSec * 12) * 9 * falloff * falloff;
            sy += ripple + pointer.vy * 0.16 * falloff;
            sx += pointer.vx * 0.10 * falloff;
          }
        }

        pxArr[i] = sx;
        pyArr[i] = sy;
        pwArr[i] = bw;
      }

      // 3) 调频失锁期的次级谐波重影线（增强换台声势）
      if (turb > 0.08 && !isStatic) {
        ctx.save();
        ctx.strokeStyle = pal.ghost;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (var g = 0; g < drawLimit; g += 3) {
          var gx = pxArr[g];
          var gy = pyArr[g] + Math.sin(g * 0.09 + ph * 14) * 18 * turb;
          if (g === 0) ctx.moveTo(gx, gy);
          else ctx.lineTo(gx, gy);
        }
        ctx.stroke();
        ctx.restore();
      }

      // 4) 第一遍：宽柔光晕笔触（仅绘制主轮廓段，零高斯模糊开销）
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = pal.halo;
      ctx.lineWidth = isNarrow ? 4.5 : 6.0;
      ctx.beginPath();
      var penDown = false;
      for (var h = 0; h < drawLimit; h++) {
        if (pwArr[h] >= 0.5) {
          if (!penDown) {
            ctx.moveTo(pxArr[h], pyArr[h]);
            penDown = true;
          } else {
            ctx.lineTo(pxArr[h], pyArr[h]);
          }
        } else {
          penDown = false;
        }
      }
      ctx.stroke();

      // 5) 第二遍：Z 轴消隐暗跳线 + 高亮锐利荧光主线
      ctx.strokeStyle = pal.retrace;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      var rDown = false;
      for (var r = 0; r < drawLimit; r++) {
        if (pwArr[r] < 0.5) {
          if (!rDown && r > 0) {
            ctx.moveTo(pxArr[r - 1], pyArr[r - 1]);
            ctx.lineTo(pxArr[r], pyArr[r]);
            rDown = true;
          } else if (rDown) {
            ctx.lineTo(pxArr[r], pyArr[r]);
          }
        } else {
          rDown = false;
        }
      }
      ctx.stroke();

      ctx.strokeStyle = pal.main;
      ctx.lineWidth = isNarrow ? 1.75 : 2.1;
      ctx.beginPath();
      penDown = false;
      for (var k = 0; k < drawLimit; k++) {
        if (pwArr[k] >= 0.5) {
          if (!penDown) {
            ctx.moveTo(pxArr[k], pyArr[k]);
            penDown = true;
          } else {
            ctx.lineTo(pxArr[k], pyArr[k]);
          }
        } else {
          penDown = false;
        }
      }
      ctx.stroke();

      // 6) 扫描电子束亮斑与余辉彗尾
      if (!isStatic && drawLimit > 12) {
        var headIdx = drawLimit < SAMPLE_N
          ? drawLimit - 1
          : Math.floor(((tSec * 0.26) % 1) * (SAMPLE_N - 1));
        var tailLen = 36;
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        var started = false;
        for (var ti = Math.max(0, headIdx - tailLen); ti <= headIdx; ti++) {
          if (pwArr[ti] < 0.5) {
            started = false;
            continue;
          }
          if (!started) {
            ctx.moveTo(pxArr[ti], pyArr[ti]);
            started = true;
          } else {
            ctx.lineTo(pxArr[ti], pyArr[ti]);
          }
        }
        ctx.stroke();

        ctx.fillStyle = pal.core;
        ctx.beginPath();
        ctx.arc(pxArr[headIdx], pyArr[headIdx], 3.1, 0, TAU);
        ctx.fill();
      }

      // 7) 锁相瞬间的干净触发闪光横线（锁定后迅速归零安静）
      if (lockFlash > 0.01 && !isStatic) {
        ctx.save();
        ctx.globalAlpha = lockFlash * 0.45;
        ctx.strokeStyle = pal.core;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, waveCenterY);
        ctx.lineTo(width, waveCenterY);
        ctx.stroke();
        ctx.restore();
        lockFlash *= 0.86;
      }

      drawChannelAnnotations(pal);
    }

    function renderOnce(now) {
      renderFrame(now || performance.now(), true);
    }

    function tick(now) {
      rafId = 0;
      if (reducedMotion || !inViewport || !pageVisible) return;
      renderFrame(now, false);
      rafId = window.requestAnimationFrame(tick);
    }

    function ensureLoop() {
      if (reducedMotion) {
        renderOnce(performance.now());
        return;
      }
      if (!rafId && inViewport && pageVisible) {
        rafId = window.requestAnimationFrame(tick);
      }
    }

    // 指针移动与触摸微扰监听（绝不调用 preventDefault，完全保留原生触摸滑动）
    function onPointerMove(clientX, clientY) {
      var rect = screenEl.getBoundingClientRect();
      var nx = clientX - rect.left;
      var ny = clientY - rect.top;
      if (nx < 0 || ny < 0 || nx > rect.width || ny > rect.height) {
        pointer.active = false;
        return;
      }
      if (pointer.active) {
        pointer.vx = clamp(nx - pointer.x, -28, 28);
        pointer.vy = clamp(ny - pointer.y, -28, 28);
      }
      pointer.x = nx;
      pointer.y = ny;
      pointer.active = true;
      if (opts.onProbe) {
        var dv = (((waveCenterY - ny) / Math.max(1, waveHalfH)) * 2.5).toFixed(2);
        opts.onProbe((dv >= 0 ? '+' : '') + dv + ' V');
      }
    }

    screenEl.addEventListener('pointermove', function (e) {
      onPointerMove(e.clientX, e.clientY);
    }, { passive: true });

    screenEl.addEventListener('pointerleave', function () {
      pointer.active = false;
      if (opts.onProbe) opts.onProbe('待命');
    }, { passive: true });

    // 视口与标签页可见性节能控制
    document.addEventListener('visibilitychange', function () {
      pageVisible = !document.hidden;
      if (pageVisible) ensureLoop();
    });

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries && entries[0]) {
          inViewport = entries[0].isIntersecting;
          if (inViewport) ensureLoop();
        }
      }, { threshold: 0.01 });
      io.observe(screenEl);
    }

    window.addEventListener('resize', resize, { passive: true });
    resize();
    ensureLoop();

    // 不依赖 requestAnimationFrame 的硬兜底：后台标签页 1.5s 后强制绘制完整首屏轮廓
    setTimeout(function () {
      bootStart = performance.now() - 5000;
      if (!rafId || document.hidden || reducedMotion) {
        renderOnce(performance.now());
      }
    }, 1500);

    return {
      update: function (next) {
        var prevLocked = wasLocked;
        for (var k in next) {
          if (Object.prototype.hasOwnProperty.call(next, k)) {
            state[k] = next[k];
          }
        }
        if (!prevLocked && state.locked) {
          lockFlash = 1.0;
        }
        wasLocked = !!state.locked;
        if (reducedMotion) renderOnce(performance.now());
        else ensureLoop();
      },
      setPhosphor: function (mode) {
        state.phosphor = mode === 'amber' ? 'amber' : 'green';
        if (reducedMotion) renderOnce(performance.now());
      },
      calibrate: function () {
        calPulse = performance.now();
        lockFlash = 0.85;
        if (reducedMotion) renderOnce(performance.now());
        else ensureLoop();
      },
      skipIntro: function () {
        bootStart = performance.now() - 5000;
        renderFrame(performance.now(), reducedMotion);
      },
      resize: resize
    };
  }

  window.ScopeEngine = { create: createScope };
})(window, document);
