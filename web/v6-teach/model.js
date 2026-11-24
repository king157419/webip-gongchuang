/* 小智的小模型：笔迹 → 16×16 格子 → 一个两层的小神经网络。
 * 只做计算，不碰页面；浏览器里挂在 window.ZhiModel，node 里 require 也能用（离线测试用）。
 *
 * 流程：
 *   1. normalize  把笔迹按外框缩放、居中（保持长宽比），坐标落在 [-0.5, 0.5]
 *   2. augment    对每个例子做小幅旋转、缩放、平移，6 个例子扩成一百多个
 *   3. rasterize  画到 16×16 的格子上，每格是 0~1 的深浅，共 256 个数
 *   4. Net        256 → 16（tanh）→ 类别数（softmax），交叉熵损失 + L2，Adam 梯度下降
 */
(function (root) {
  "use strict";
  const G = 16;            // 格子边长
  const N_IN = G * G;      // 输入维度

  // 可复现的随机数（mulberry32）
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // strokes: [[[x, y], ...], ...]，单位任意。返回居中、按最长边缩放后的笔迹；空画返回 null
  function normalize(strokes) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, n = 0;
    for (const s of strokes) for (const [x, y] of s) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      n++;
    }
    if (!n) return null;
    const size = Math.max(x1 - x0, y1 - y0, 1e-6);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return strokes.map((s) => s.map(([x, y]) => [(x - cx) / size, (y - cy) / size]));
  }

  // 旋转 rot（弧度）、缩放 sx/sy、平移 dx/dy（单位：画的最长边）
  function transform(strokes, { rot = 0, sx = 1, sy = 1, dx = 0, dy = 0 }) {
    const c = Math.cos(rot), s = Math.sin(rot);
    return strokes.map((st) => st.map(([x, y]) => {
      const u = x * sx, v = y * sy;
      return [c * u - s * v + dx, s * u + c * v + dy];
    }));
  }

  // 随机小幅变形一次
  function jitter(strokes, rand) {
    const k = 0.85 + rand() * 0.3;
    return transform(strokes, {
      rot: (rand() - 0.5) * 0.5,          // 约 ±14°
      sx: k * (0.92 + rand() * 0.16),
      sy: k * (0.92 + rand() * 0.16),
      dx: (rand() - 0.5) * 0.14,
      dy: (rand() - 0.5) * 0.14
    });
  }

  // 把（已归一化的）笔迹画到 16×16 格子上：每格按到最近线段的距离给深浅
  const R = 0.75, FALL = 0.9;  // 线的半宽和边缘过渡，单位：格
  function rasterize(strokes) {
    const dist = new Float64Array(N_IN).fill(Infinity);
    const toGrid = (p) => [(p[0] * 0.8 + 0.5) * G, (p[1] * 0.8 + 0.5) * G]; // 画占格子 80%，四周留白
    const reach = R + FALL;
    for (const st of strokes) {
      if (!st.length) continue;
      const pts = st.map(toGrid);
      if (pts.length === 1) pts.push(pts[0]);
      for (let k = 1; k < pts.length; k++) {
        const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
        const i0 = Math.max(0, Math.floor(Math.min(ax, bx) - reach)), i1 = Math.min(G - 1, Math.ceil(Math.max(ax, bx) + reach));
        const j0 = Math.max(0, Math.floor(Math.min(ay, by) - reach)), j1 = Math.min(G - 1, Math.ceil(Math.max(ay, by) + reach));
        const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const px = i + 0.5 - ax, py = j + 0.5 - ay;
          const t = len2 ? Math.max(0, Math.min(1, (px * ex + py * ey) / len2)) : 0;
          const qx = px - t * ex, qy = py - t * ey;
          const d = Math.sqrt(qx * qx + qy * qy);
          const idx = j * G + i;
          if (d < dist[idx]) dist[idx] = d;
        }
      }
    }
    const out = new Float64Array(N_IN);
    for (let i = 0; i < N_IN; i++) out[i] = Math.max(0, Math.min(1, (reach - dist[i]) / FALL));
    return out;
  }

  // 两层网络：输入 → 隐藏层（tanh）→ softmax
  class Net {
    constructor(nIn, nHid, nOut, seed) {
      const rand = rng(seed);
      const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());
      this.nIn = nIn; this.nHid = nHid; this.nOut = nOut;
      this.W1 = new Float64Array(nHid * nIn).map(() => gauss() * Math.sqrt(1 / nIn));
      this.b1 = new Float64Array(nHid);
      this.W2 = new Float64Array(nOut * nHid).map(() => gauss() * Math.sqrt(1 / nHid));
      this.b2 = new Float64Array(nOut);
      this.params = [this.W1, this.b1, this.W2, this.b2];
      this.m = this.params.map((p) => new Float64Array(p.length));
      this.v = this.params.map((p) => new Float64Array(p.length));
      this.t = 0;
    }
    get size() { return this.params.reduce((s, p) => s + p.length, 0); }

    forward(x) {
      const { nIn, nHid, nOut, W1, b1, W2, b2 } = this;
      const h = new Float64Array(nHid);
      for (let j = 0; j < nHid; j++) {
        let s = b1[j]; const o = j * nIn;
        for (let i = 0; i < nIn; i++) s += W1[o + i] * x[i];
        h[j] = Math.tanh(s);
      }
      const z = new Float64Array(nOut);
      let max = -Infinity;
      for (let k = 0; k < nOut; k++) {
        let s = b2[k]; const o = k * nHid;
        for (let j = 0; j < nHid; j++) s += W2[o + j] * h[j];
        z[k] = s; if (s > max) max = s;
      }
      let sum = 0;
      for (let k = 0; k < nOut; k++) { z[k] = Math.exp(z[k] - max); sum += z[k]; }
      for (let k = 0; k < nOut; k++) z[k] /= sum;
      return { h, p: z };
    }

    // 整批算一次梯度，Adam 走一步；返回这一步之前的平均交叉熵
    step(X, Y, { lr = 0.01, l2 = 3e-3 } = {}) {
      const { nIn, nHid, nOut, W1, W2 } = this;
      const g = this.params.map((p) => new Float64Array(p.length));
      const [gW1, gb1, gW2, gb2] = g;
      const dh = new Float64Array(nHid);
      let loss = 0;
      for (let n = 0; n < X.length; n++) {
        const x = X[n], y = Y[n];
        const { h, p } = this.forward(x);
        loss -= Math.log(p[y] + 1e-12);
        dh.fill(0);
        for (let k = 0; k < nOut; k++) {
          const dz = p[k] - (k === y ? 1 : 0);
          gb2[k] += dz;
          const o = k * nHid;
          for (let j = 0; j < nHid; j++) { gW2[o + j] += dz * h[j]; dh[j] += dz * W2[o + j]; }
        }
        for (let j = 0; j < nHid; j++) {
          const da = dh[j] * (1 - h[j] * h[j]);
          if (!da) continue;
          gb1[j] += da;
          const o = j * nIn;
          for (let i = 0; i < nIn; i++) if (x[i]) gW1[o + i] += da * x[i];
        }
      }
      const inv = 1 / X.length;
      this.t++;
      const b1c = 1 - Math.pow(0.9, this.t), b2c = 1 - Math.pow(0.999, this.t);
      this.params.forEach((p, q) => {
        const gq = g[q], m = this.m[q], v = this.v[q], decay = q === 0 || q === 2 ? l2 : 0;
        for (let i = 0; i < p.length; i++) {
          const gi = gq[i] * inv + decay * p[i];
          m[i] = 0.9 * m[i] + 0.1 * gi;
          v[i] = 0.999 * v[i] + 0.001 * gi * gi;
          p[i] -= lr * (m[i] / b1c) / (Math.sqrt(v[i] / b2c) + 1e-8);
        }
      });
      return loss * inv;
    }
  }

  // 给页面用的“学生”：收例子、做增广、一轮一轮地训练、猜
  class Learner {
    constructor({ classes = 2, hidden = 16, copies = 24, seed = 7 } = {}) {
      this.classes = classes; this.copies = copies; this.seed = seed;
      this.samples = [];          // { strokes（已归一化）, label }
      this.net = new Net(N_IN, hidden, classes, seed);
      this.X = []; this.Y = [];
      this.epochs = 0;
    }
    get size() { return this.net.size; }
    add(strokes, label) {
      const s = normalize(strokes);
      if (s) this.samples.push({ strokes: s, label });
      return !!s;
    }
    // 重新生成训练集：每个例子 1 份原样 + (copies-1) 份变形
    prepare() {
      const rand = rng(this.seed * 7919 + this.samples.length);
      this.X = []; this.Y = [];
      for (const { strokes, label } of this.samples) {
        this.X.push(rasterize(strokes)); this.Y.push(label);
        for (let c = 1; c < this.copies; c++) { this.X.push(rasterize(jitter(strokes, rand))); this.Y.push(label); }
      }
    }
    trainStep(opts) { this.epochs++; return this.net.step(this.X, this.Y, opts); }
    predict(strokes) {
      const s = normalize(strokes);
      return s ? Array.from(this.net.forward(rasterize(s)).p) : null;
    }
  }

  const api = { G, N_IN, rng, normalize, transform, jitter, rasterize, Net, Learner };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ZhiModel = api;
})(typeof window !== "undefined" ? window : globalThis);
