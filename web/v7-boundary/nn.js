/* 一个手写的小型神经网络：2 个输入 → 8 → 8 → 1 个输出
 * 隐藏层用 tanh，输出用 sigmoid，损失是二元交叉熵，优化器是 Adam。
 * 不依赖任何库。浏览器里挂到 window.TinyNet，node 里 module.exports。
 */
(function (root) {
  "use strict";

  // 可复现的伪随机数（mulberry32），方便离线测试和每次打开时一样的开局
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

  function Net(sizes, opts) {
    opts = opts || {};
    this.sizes = sizes.slice();          // 例如 [2, 8, 8, 1]
    this.L = sizes.length - 1;           // 层数（不算输入）
    this.lr = opts.lr || 0.02;
    this.seed = opts.seed || 7;
    this.W = []; this.b = [];            // W[l] 是 out×in 的扁平数组
    this.mW = []; this.vW = []; this.mb = []; this.vb = [];
    this.gW = []; this.gb = [];
    this.a = []; this.d = [];            // 前向的激活值、反向的误差
    for (let l = 0; l < this.L; l++) {
      const n = sizes[l], m = sizes[l + 1];
      this.W.push(new Float64Array(n * m));
      this.b.push(new Float64Array(m));
      this.mW.push(new Float64Array(n * m)); this.vW.push(new Float64Array(n * m));
      this.mb.push(new Float64Array(m)); this.vb.push(new Float64Array(m));
      this.gW.push(new Float64Array(n * m)); this.gb.push(new Float64Array(m));
    }
    for (let l = 0; l <= this.L; l++) {
      this.a.push(new Float64Array(sizes[l]));
      this.d.push(new Float64Array(sizes[l]));
    }
    this.reset(this.seed);
  }

  Net.prototype.reset = function (seed) {
    const r = rng(seed == null ? this.seed : seed);
    for (let l = 0; l < this.L; l++) {
      const n = this.sizes[l], W = this.W[l];
      const s = Math.sqrt(1 / n) * 1.6;  // 略大于 Xavier，开局边界不至于太平
      for (let i = 0; i < W.length; i++) W[i] = (r() * 2 - 1) * s;
      this.b[l].fill(0);
      this.mW[l].fill(0); this.vW[l].fill(0); this.mb[l].fill(0); this.vb[l].fill(0);
    }
    this.t = 0;          // Adam 的步数
    this.epochs = 0;     // 训练了多少轮（每轮把所有点看一遍）
    this.loss = NaN;
  };

  Net.prototype.paramCount = function () {
    let c = 0;
    for (let l = 0; l < this.L; l++) c += this.W[l].length + this.b[l].length;
    return c;
  };

  // 前向：返回输出层第一个值（属于第二种颜色的概率）
  Net.prototype.forward = function (x, y) {
    const a = this.a;
    a[0][0] = x; a[0][1] = y;
    for (let l = 0; l < this.L; l++) {
      const n = this.sizes[l], m = this.sizes[l + 1];
      const W = this.W[l], b = this.b[l], src = a[l], dst = a[l + 1];
      const last = l === this.L - 1;
      for (let j = 0; j < m; j++) {
        let s = b[j];
        const off = j * n;
        for (let i = 0; i < n; i++) s += W[off + i] * src[i];
        dst[j] = last ? 1 / (1 + Math.exp(-s)) : Math.tanh(s);
      }
    }
    return a[this.L][0];
  };

  // 训练一轮：全部点算一遍梯度，再用 Adam 更新一次。points: [{x, y, c}]，c 为 0 或 1
  Net.prototype.trainEpoch = function (points) {
    const N = points.length;
    if (!N) return NaN;
    for (let l = 0; l < this.L; l++) { this.gW[l].fill(0); this.gb[l].fill(0); }
    let loss = 0;
    for (let k = 0; k < N; k++) {
      const p = points[k];
      const out = this.forward(p.x, p.y);
      const o = Math.min(Math.max(out, 1e-7), 1 - 1e-7);
      loss += p.c ? -Math.log(o) : -Math.log(1 - o);
      // sigmoid + 交叉熵 的输出误差正好是 out - 标签
      this.d[this.L][0] = out - p.c;
      for (let l = this.L - 1; l >= 0; l--) {
        const n = this.sizes[l], m = this.sizes[l + 1];
        const W = this.W[l], gW = this.gW[l], gb = this.gb[l];
        const src = this.a[l], dOut = this.d[l + 1], dIn = this.d[l];
        if (l > 0) dIn.fill(0);
        for (let j = 0; j < m; j++) {
          const dj = dOut[j];
          gb[j] += dj;
          const off = j * n;
          for (let i = 0; i < n; i++) {
            gW[off + i] += dj * src[i];
            if (l > 0) dIn[i] += dj * W[off + i];
          }
        }
        if (l > 0) for (let i = 0; i < n; i++) dIn[i] *= 1 - src[i] * src[i]; // tanh 的导数
      }
    }
    this.adam(1 / N);
    this.epochs++;
    this.loss = loss / N;
    return this.loss;
  };

  Net.prototype.adam = function (scale) {
    const b1 = 0.9, b2 = 0.999, eps = 1e-8;
    this.t++;
    const c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t);
    const lr = this.lr;
    const upd = function (P, G, M, V) {
      for (let i = 0; i < P.length; i++) {
        const g = G[i] * scale;
        M[i] = b1 * M[i] + (1 - b1) * g;
        V[i] = b2 * V[i] + (1 - b2) * g * g;
        P[i] -= lr * (M[i] / c1) / (Math.sqrt(V[i] / c2) + eps);
      }
    };
    for (let l = 0; l < this.L; l++) {
      upd(this.W[l], this.gW[l], this.mW[l], this.vW[l]);
      upd(this.b[l], this.gb[l], this.mb[l], this.vb[l]);
    }
  };

  Net.prototype.accuracy = function (points) {
    let ok = 0;
    for (const p of points) if ((this.forward(p.x, p.y) >= 0.5 ? 1 : 0) === p.c) ok++;
    return ok;
  };

  // 预设数据。坐标范围 [-1, 1]，c = 0 / 1
  function makePreset(name, seed) {
    const r = rng(seed || 3);
    const g = function () { // 近似正态
      return (r() + r() + r() + r() - 2) / 2;
    };
    const pts = [];
    if (name === "circle") {
      for (let i = 0; i < 22; i++) {
        const t = r() * Math.PI * 2, rad = r() * 0.3;
        pts.push({ x: Math.cos(t) * rad, y: Math.sin(t) * rad, c: 0 });
      }
      for (let i = 0; i < 26; i++) {
        const t = r() * Math.PI * 2, rad = 0.62 + r() * 0.26;
        pts.push({ x: Math.cos(t) * rad, y: Math.sin(t) * rad, c: 1 });
      }
    } else if (name === "spiral") {
      const n = 26;
      for (let c = 0; c < 2; c++) {
        for (let i = 0; i < n; i++) {
          const k = i / n;
          const rad = 0.1 + k * 0.8;
          const t = k * Math.PI * 2.2 + c * Math.PI;
          pts.push({ x: Math.cos(t) * rad + g() * 0.03, y: Math.sin(t) * rad + g() * 0.03, c: c });
        }
      }
    } else { // blobs 左右两团
      for (let i = 0; i < 20; i++) pts.push({ x: -0.45 + g() * 0.32, y: 0.1 + g() * 0.4, c: 0 });
      for (let i = 0; i < 20; i++) pts.push({ x: 0.45 + g() * 0.32, y: -0.1 + g() * 0.4, c: 1 });
    }
    return pts;
  }

  const api = { Net: Net, makePreset: makePreset, rng: rng };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TinyNet = api;
})(typeof window !== "undefined" ? window : this);
