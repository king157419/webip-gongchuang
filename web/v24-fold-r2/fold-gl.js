/* v24-fold-r2 · fold-gl.js —— 手写 WebGL1 折纸引擎
 * 折法按真实的「中村锁」纸飞机：
 *   0 竖向对折压痕 → 1 两个上角折到中线（谷折，两片在正面）
 *   → 2 整个尖角往下折（谷折；折线比两片的底边低 0.24，尖角落到离纸底约 3.8 厘米处）
 *   → 3 两个新角再折到中线（谷折，盖在尖角上面），两片在中线相会处，下面露出约 2.5 厘米的小尖
 *       → 小尖往上翻（谷折），压住两片的下角 —— 这就是"中村锁"
 *   → 4 沿中线向后对折（山折，锁在外侧、成为机腹）→ 两侧机翼往外折下
 * 网格按每条折痕精确剖分；每一层纸记下它在每一步摊平时的位置、层级和朝上的那一面，
 * 用来把页面上的文字"印"在当时最上层的纸面上，跟着纸一起被折走。 */
(function () {
  'use strict';

  const W = 1.0, H = 1.42;
  const C2 = 0.18;          // 第 2 折（尖角下折）的折线高度：比第 1 折两片的底边（0.42）低，尖角才能从第 3 折两片下面露出来
  const MEET = C2 - 1.0;    // 第 3 折两角在中线相会的位置，也是小尖上翻的折线
  const EPS = 0.0024;       // 一层纸的厚度（纸面单位）
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  // 折痕编号（位掩码），用于折痕压痕贴图的四个通道
  const CR0 = 1, CR1 = 2, CR2 = 4, CR3 = 8;

  /* ================= 1. 折痕多边形精确剖分 ================= */
  const VKEYS = ['u', 'v', 'x0', 'y0', 'x', 'y', 'x1', 'y1', 'x2', 'y2'];
  function lerpV(a, b, t) {
    const o = {};
    for (let i = 0; i < VKEYS.length; i++) {
      const k = VKEYS[i];
      if (a[k] !== undefined) o[k] = a[k] + (b[k] - a[k]) * t;
    }
    o.tag = (a.tag | 0) & (b.tag | 0);
    return o;
  }

  function polyCenter(vs, kx, ky) {
    kx = kx || 'x'; ky = ky || 'y';
    let x = 0, y = 0;
    for (let i = 0; i < vs.length; i++) { x += vs[i][kx]; y += vs[i][ky]; }
    return [x / vs.length, y / vs.length];
  }

  function splitAtThreshold(polys, ax, ay, nx, ny, thr, pred, tag) {
    const out = [];
    for (let p = 0; p < polys.length; p++) {
      const P = polys[p];
      if (pred && !pred(P)) { out.push(P); continue; }
      const vs = P.verts, n = vs.length;
      const d = new Array(n);
      let pos = 0, neg = 0;
      for (let i = 0; i < n; i++) {
        const s = (vs[i].x - ax) * nx + (vs[i].y - ay) * ny - thr;
        d[i] = s;
        if (s > 1e-5) pos++;
        else if (s < -1e-5) neg++;
        else if (tag) vs[i].tag = (vs[i].tag | 0) | tag;
      }
      if (!pos || !neg) { out.push(P); continue; }
      const vA = [], vB = [];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const vi = vs[i], vj = vs[j], di = d[i], dj = d[j];
        if (di >= -1e-5) vA.push({ ...vi });
        if (di <= 1e-5) vB.push({ ...vi });
        if ((di > 1e-5 && dj < -1e-5) || (di < -1e-5 && dj > 1e-5)) {
          const m = lerpV(vi, vj, di / (di - dj));
          if (tag) m.tag |= tag;
          vA.push(m);
          vB.push({ ...m });
        }
      }
      if (vA.length >= 3) out.push({ ...P, verts: vA });
      if (vB.length >= 3) out.push({ ...P, verts: vB });
    }
    return out;
  }

  function foldStepSetup(polys, ax, ay, bx, by, flagKey, strips, pred, fixedMaxR, tag) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    let res = splitAtThreshold(polys, ax, ay, nx, ny, 0, pred, tag);
    if (strips) {
      for (let k = 0; k < strips.length; k++) res = splitAtThreshold(res, ax, ay, nx, ny, strips[k], pred, 0);
    }
    let maxR = fixedMaxR != null ? fixedMaxR : 0;
    if (fixedMaxR == null) for (let i = 0; i < res.length; i++) if (res[i].rank > maxR) maxR = res[i].rank;
    for (let i = 0; i < res.length; i++) {
      const P = res[i];
      if (pred && !pred(P)) { P[flagKey] = false; continue; }
      const [cx, cy] = polyCenter(P.verts);
      const sc = (cx - ax) * nx + (cy - ay) * ny;
      if (sc > 1e-4) {
        P[flagKey] = true;
        P.rank = maxR + 1 + (maxR - P.rank);
        P.verts = P.verts.map((v) => {
          const s = (v.x - ax) * nx + (v.y - ay) * ny;
          return { ...v, x: v.x - 2 * s * nx, y: v.y - 2 * s * ny };
        });
      } else {
        P[flagKey] = false;
      }
    }
    return { polys: res, hinge: { ax, ay, ux: dx / L, uy: dy / L, nx, ny } };
  }

  function compactRanks(polys, key) {
    const uniq = Array.from(new Set(polys.map((p) => p.rank))).sort((a, b) => a - b);
    const map = new Map(uniq.map((r, idx) => [r, idx]));
    for (let i = 0; i < polys.length; i++) {
      const nr = map.get(polys[i].rank);
      polys[i].rank = nr;
      polys[i][key] = nr;
    }
    return uniq.length - 1;
  }

  function snapshot(polys, kx, ky) {
    for (let i = 0; i < polys.length; i++) {
      const vs = polys[i].verts;
      for (let j = 0; j < vs.length; j++) { vs[j][kx] = vs[j].x; vs[j][ky] = vs[j].y; }
    }
  }

  // 机身（龙骨）深度：机头 0.035 → 机尾 0.30
  const wKatY = (y) => lerp(0.30, 0.035, clamp((y + H) / (C2 + H), 0, 1));

  function pointInConvex(px, py, vs, kx, ky) {
    let area = 0;
    const n = vs.length;
    for (let i = 0; i < n; i++) {
      const a = vs[i], b = vs[(i + 1) % n];
      area += a[kx] * b[ky] - b[kx] * a[ky];
    }
    const sg = area >= 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const a = vs[i], b = vs[(i + 1) % n];
      const c = ((b[kx] - a[kx]) * (py - a[ky]) - (b[ky] - a[ky]) * (px - a[kx])) * sg;
      if (c < 1e-4) return false;
    }
    return true;
  }

  function buildOrigami() {
    let polys = [{
      rank: 0, r1: 0, r2: 0, r3: 0,
      verts: [
        { u: 0, v: 1, x0: -W, y0: -H, x: -W, y: -H, tag: 0 },
        { u: 1, v: 1, x0: W, y0: -H, x: W, y: -H, tag: 0 },
        { u: 1, v: 0, x0: W, y0: H, x: W, y: H, tag: 0 },
        { u: 0, v: 0, x0: -W, y0: H, x: -W, y: H, tag: 0 }
      ]
    }];

    // 第 0 步：竖向中线压痕（右半张翻过来再摊开）
    polys = splitAtThreshold(polys, 0, 0, 1, 0, 0, null, CR0);
    polys = splitAtThreshold(polys, 0, 0, 1, 0, 0.5, null, 0);
    for (let i = 0; i < polys.length; i++) polys[i].half0 = polyCenter(polys[i].verts)[0] > 0;

    // 第 1 步：两个上角折到中线
    const S1 = [0.16, 0.34, 0.52];
    const s1L = foldStepSetup(polys, -W, H - 1, 0, H, 'f1L', S1, null, 0, CR1);
    polys = s1L.polys;
    const s1R = foldStepSetup(polys, 0, H, W, H - 1, 'f1R', S1, null, 0, CR1);
    polys = s1R.polys;
    const maxR1 = compactRanks(polys, 'r1');
    snapshot(polys, 'x1', 'y1');

    // 第 2 步：尖角往下折（折线比两个三角的底边低，尖角会伸到下面）
    const s2 = foldStepSetup(polys, -W, C2, W, C2, 'f2', [0.16, 0.38, 0.62, 0.90]);
    polys = s2.polys;
    // 折痕标记单独打（strips 不算折痕）
    polys = splitAtThreshold(polys, -W, C2, 0, 1, 0, null, CR2);
    const maxR2 = compactRanks(polys, 'r2');
    snapshot(polys, 'x2', 'y2');

    // 第 3 步：两个新角再折到中线，在 MEET 相会
    const S3 = [0.15, 0.32, 0.50];
    const s3L = foldStepSetup(polys, -W, MEET, 0, C2, 'f3L', S3, null, maxR2, CR3);
    polys = s3L.polys;
    const s3R = foldStepSetup(polys, 0, C2, W, MEET, 'f3R', S3, null, maxR2, CR3);
    polys = s3R.polys;
    // 中村锁：露在两片下面的小尖往上翻，盖住两片的下角
    let maxR3pre = 0;
    for (let i = 0; i < polys.length; i++) if (polys[i].rank > maxR3pre) maxR3pre = polys[i].rank;
    const s3K = foldStepSetup(polys, 0.2, MEET, -0.2, MEET, 'f3K', null, (p) => p.f2 && !p.f3L && !p.f3R, null, CR3);
    polys = s3K.polys;
    compactRanks(polys, 'r3');
    // 每一折的转轴高度 = 这一折之前纸堆最高层再高半层：翻过去的每一层正好落在它的新层级上，中途不会穿过下面的纸
    s1L.hinge.z = s1R.hinge.z = 0.5 * EPS;
    s2.hinge.z = (maxR1 + 0.5) * EPS;
    s3L.hinge.z = s3R.hinge.z = (maxR2 + 0.5) * EPS;
    s3K.hinge.z = (maxR3pre + 0.5) * EPS;

    // 第 4 步要用的切线：中线 + 两侧机翼折线
    polys = splitAtThreshold(polys, 0, 0, 1, 0, 0, null, CR0);
    const wT = wKatY(-H), wN = wKatY(C2), dxK = wT - wN, dyK = C2 + H, LK = Math.hypot(dxK, dyK);
    polys = splitAtThreshold(polys, -wT, -H, -dyK / LK, dxK / LK, 0, null, 0);
    polys = splitAtThreshold(polys, wT, -H, dyK / LK, dxK / LK, 0, null, 0);
    // 机翼中段再切两刀，让翼面在形变时也有足够的顶点
    polys = splitAtThreshold(polys, 0, -0.9, 0, 1, 0, null, 0);

    // 每一步摊平时：这块纸是不是最上层、朝上的是正面还是背面
    const posKey = [['x0', 'y0'], ['x1', 'y1'], ['x2', 'y2'], ['x', 'y']];
    const rankKey = [null, 'r1', 'r2', 'r3'];
    for (let i = 0; i < polys.length; i++) {
      const P = polys[i];
      P.face = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const [kx, ky] = posKey[k];
        const [cx, cy] = polyCenter(P.verts, kx, ky);
        const rP = k ? P[rankKey[k]] : 0;
        let top = true;
        if (k) {
          for (let j = 0; j < polys.length && top; j++) {
            if (j === i) continue;
            const Q = polys[j];
            if (Q[rankKey[k]] > rP && pointInConvex(cx, cy, Q.verts, kx, ky)) top = false;
          }
        }
        let flips = 0;
        if (k >= 1 && (P.f1L || P.f1R)) flips++;
        if (k >= 2 && P.f2) flips++;
        if (k >= 3 && (P.f3L || P.f3R)) flips++;
        if (k >= 3 && P.f3K) flips++;
        P.face[k] = top ? (flips % 2 ? -1 : 1) : 0;
      }
    }

    const tris = [];
    for (let i = 0; i < polys.length; i++) {
      const P = polys[i], vs = P.verts;
      const [cx, cy] = polyCenter(vs);
      const sideX = cx < 0 ? -1 : 1;
      const isWing = Math.abs(cx) > wKatY(cy) + 1e-4;
      for (let k = 1; k < vs.length - 1; k++) {
        tris.push({ P, sideX, isWing, v: [vs[0], vs[k], vs[k + 1]] });
      }
    }
    return {
      tris, polys,
      hinges: { h0: { ax: 0, ay: 0, ux: 0, uy: 1, nx: 1, ny: 0 }, h1L: s1L.hinge, h1R: s1R.hinge, h2: s2.hinge, h3L: s3L.hinge, h3R: s3R.hinge, h3K: s3K.hinge }
    };
  }

  /* ================= 2. 贴图：纸张正反面 + 背面印的"怎么加入" + 折痕压痕 ================= */
  const TEX_W = 1024, TEX_H = 1454;
  const ux = (x) => (x + W) / (2 * W) * TEX_W;
  const uy = (y) => (H - y) / (2 * H) * TEX_H;

  function paperBase(g, seed, c0, c1, fibers) {
    const bg = g.createLinearGradient(0, 0, TEX_W, TEX_H);
    bg.addColorStop(0, c0);
    bg.addColorStop(1, c1);
    g.fillStyle = bg;
    g.fillRect(0, 0, TEX_W, TEX_H);
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.lineWidth = 0.9;
    for (let i = 0; i < fibers; i++) {
      const x = rnd() * TEX_W, y = rnd() * TEX_H, a = rnd() * Math.PI, l = 5 + rnd() * 18;
      g.strokeStyle = i % 3 === 0 ? 'rgba(140,124,100,0.075)' : 'rgba(255,253,248,0.36)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
    // 纸缘：一圈极细的暗边 + 内侧一道亮边，叠在一起时能看出每层纸的切口
    g.strokeStyle = 'rgba(86,74,56,0.30)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, TEX_W - 3, TEX_H - 3);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.5;
    g.strokeRect(4.5, 4.5, TEX_W - 9, TEX_H - 9);
  }

  function makeFrontTexture() {
    const c = document.createElement('canvas');
    c.width = TEX_W; c.height = TEX_H;
    const g = c.getContext('2d');
    paperBase(g, 24041, '#fbf8f1', '#efe8db', 2000);
    // 四角裁切线（印刷品的小细节）
    g.strokeStyle = 'rgba(23,22,20,0.22)';
    g.lineWidth = 1.4;
    const m = 34, cl = 22;
    [[m, m, 1, 1], [TEX_W - m, m, -1, 1], [m, TEX_H - m, 1, -1], [TEX_W - m, TEX_H - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      g.beginPath();
      g.moveTo(x, y + sy * cl); g.lineTo(x, y); g.lineTo(x + sx * cl, y);
      g.stroke();
    });
    return c;
  }

  // 背面：平时一直朝下看不到；折成飞机翻过来以后，机翼上表面正好是这一块
  function makeBackTexture(wx) {
    const c = document.createElement('canvas');
    c.width = TEX_W; c.height = TEX_H;
    const g = c.getContext('2d');
    paperBase(g, 88177, '#f5efe3', '#e9e1d1', 1500);
    // 背面坐标：从背后看纸，x 方向是镜像的
    const bx = (x) => (1 - x) / 2 * TEX_W;
    const serif = '"SHU Serif", "Noto Serif SC", serif';
    const pu = TEX_W / 2; // 一个纸面单位 = 多少像素

    // 文字沿机身方向（纸的 +y）读，字头朝 +x 一侧
    function wingText(cx, cy, fn) {
      g.save();
      g.translate(bx(cx), uy(cy));
      g.rotate(-Math.PI / 2);
      fn();
      g.restore();
    }
    // 印的位置要整块落在机翼上：上沿不能越过第 3 折的折线（y = C2 - |x|），否则折到一半会在翻起的那片背面露出一截
    // 上侧机翼（+x）：大标题
    wingText(0.66, -1.06, () => {
      g.fillStyle = '#c93f18';
      g.fillRect(-0.32 * pu, -0.255 * pu, 0.62 * pu, 0.022 * pu);
      g.font = `400 ${0.058 * pu}px ${serif}`;
      g.fillText('传单背面 · 第 4 折', -0.32 * pu, -0.17 * pu);
      g.fillStyle = '#171614';
      g.font = `900 ${0.17 * pu}px ${serif}`;
      g.fillText('怎么加入', -0.34 * pu, 0.03 * pu);
    });
    wingText(0.44, -1.06, () => {
      g.fillStyle = 'rgba(23,22,20,0.66)';
      g.font = `400 ${0.064 * pu}px ${serif}`;
      g.fillText('上海大学人工智能社', -0.32 * pu, 0.0);
    });
    // 下侧机翼（-x）：公众号
    wingText(-0.50, -1.06, () => {
      g.fillStyle = 'rgba(23,22,20,0.62)';
      g.font = `400 ${0.058 * pu}px ${serif}`;
      g.fillText('微信搜公众号', -0.32 * pu, -0.06 * pu);
      g.fillStyle = '#171614';
      g.font = `900 ${0.088 * pu}px ${serif}`;
      g.fillText(wx || '上海大学通信学院', -0.32 * pu, 0.06 * pu);
    });
    wingText(-0.78, -1.06, () => {
      g.fillStyle = '#c93f18';
      g.fillRect(-0.32 * pu, -0.02 * pu, 0.42 * pu, 0.016 * pu);
    });
    return c;
  }

  // 折痕贴图：四个通道分别是 中线 / 第 1 折 / 第 2 折 / 第 3 折
  function makeCreaseData(polys) {
    const CW = 512, CH = 728;
    const layers = [CR0, CR1, CR2, CR3].map((bit) => {
      const c = document.createElement('canvas');
      c.width = CW; c.height = CH;
      const g = c.getContext('2d');
      g.lineCap = 'round';
      const seen = new Set();
      const segs = [];
      for (let i = 0; i < polys.length; i++) {
        const vs = polys[i].verts;
        for (let j = 0; j < vs.length; j++) {
          const a = vs[j], b = vs[(j + 1) % vs.length];
          if (!((a.tag | 0) & (b.tag | 0) & bit)) continue;
          // 中线压痕只在原纸的 x=0 上；折到中线上的纸边（第 1、3 折的两片外缘）不是折痕
          if (bit === CR0 && (Math.abs(a.x0) > 1e-4 || Math.abs(b.x0) > 1e-4)) continue;
          const key = [a.u, a.v, b.u, b.v].map((n) => n.toFixed(3)).join(',');
          if (seen.has(key)) continue;
          seen.add(key);
          segs.push([a.u * CW, a.v * CH, b.u * CW, b.v * CH]);
        }
      }
      [[4.5, 0.22], [1.6, 0.85]].forEach(([w, a]) => {
        g.strokeStyle = `rgba(0,0,0,${a})`;
        g.lineWidth = w;
        g.beginPath();
        segs.forEach((s) => { g.moveTo(s[0], s[1]); g.lineTo(s[2], s[3]); });
        g.stroke();
      });
      return g.getImageData(0, 0, CW, CH).data;
    });
    const out = new Uint8Array(CW * CH * 4);
    for (let i = 0; i < CW * CH; i++) {
      for (let ch = 0; ch < 4; ch++) out[i * 4 + ch] = layers[ch][i * 4 + 3];
    }
    return { w: CW, h: CH, data: out };
  }

  /* ================= 3. 旋转工具 ================= */
  function rotAroundHinge(p, h, zH, theta, sDist) {
    if (theta <= 1e-5) return;
    const dx = p[0] - h.ax, dy = p[1] - h.ay, dz = p[2] - zH;
    const proj = dx * h.ux + dy * h.uy;
    const px = h.ax + proj * h.ux, py = h.ay + proj * h.uy;
    const rN = dx * h.nx + dy * h.ny;
    // 翻折时纸张的自然弧度：离折痕越远越"跟不上"，落地时归零摊平
    const lag = 0.24 * Math.sin(theta) * clamp(sDist * 0.85, 0, 1);
    const th = clamp(theta - lag, 0, Math.PI);
    const cs = Math.cos(th), sn = Math.sin(th);
    const rN2 = rN * cs - dz * sn;
    const dz2 = rN * sn + dz * cs;
    p[0] = px + rN2 * h.nx;
    p[1] = py + rN2 * h.ny;
    p[2] = zH + dz2;
  }

  function eulerMat(rx, ry, rz) {
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const cz = Math.cos(rz), sz = Math.sin(rz);
    return [
      cz * cy - sz * sx * sy, -sz * cx, cz * sy + sz * sx * cy,
      sz * cy + cz * sx * sy, cz * cx, sz * sy - cz * sx * cy,
      -cx * sy, sx, cx * cy
    ];
  }

  function applyM3(M, p) {
    const x = p[0], y = p[1], z = p[2];
    p[0] = M[0] * x + M[1] * y + M[2] * z;
    p[1] = M[3] * x + M[4] * y + M[5] * z;
    p[2] = M[6] * x + M[7] * y + M[8] * z;
  }

  // 四元数（姿态插值用）
  function matToQuat(m) {
    const tr = m[0] + m[4] + m[8];
    let x, y, z, w;
    if (tr > 0) {
      const s = Math.sqrt(tr + 1) * 2;
      w = 0.25 * s; x = (m[7] - m[5]) / s; y = (m[2] - m[6]) / s; z = (m[3] - m[1]) / s;
    } else if (m[0] > m[4] && m[0] > m[8]) {
      const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2;
      w = (m[7] - m[5]) / s; x = 0.25 * s; y = (m[1] + m[3]) / s; z = (m[2] + m[6]) / s;
    } else if (m[4] > m[8]) {
      const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2;
      w = (m[2] - m[6]) / s; x = (m[1] + m[3]) / s; y = 0.25 * s; z = (m[5] + m[7]) / s;
    } else {
      const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2;
      w = (m[3] - m[1]) / s; x = (m[2] + m[6]) / s; y = (m[5] + m[7]) / s; z = 0.25 * s;
    }
    return [x, y, z, w];
  }
  function quatToMat(q) {
    const [x, y, z, w] = q;
    return [
      1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
      2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
      2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)
    ];
  }
  function slerp(a, b, t) {
    let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
    let bb = b;
    if (d < 0) { d = -d; bb = [-b[0], -b[1], -b[2], -b[3]]; }
    if (d > 0.9995) {
      const r = a.map((v, i) => v + (bb[i] - v) * t);
      const l = Math.hypot(r[0], r[1], r[2], r[3]);
      return r.map((v) => v / l);
    }
    const th = Math.acos(d), s = Math.sin(th);
    const wa = Math.sin((1 - t) * th) / s, wb = Math.sin(t * th) / s;
    return [a[0] * wa + bb[0] * wb, a[1] * wa + bb[1] * wb, a[2] * wa + bb[2] * wb, a[3] * wa + bb[3] * wb];
  }

  // 飞机姿态矩阵：heading 在屏幕平面里的朝向，pitch 机头抬向镜头，roll 横滚
  // 机体坐标：机头 +y，机背 -z（中村锁向后对折后，背面朝上）
  function planeMat(psi, theta, phi) {
    const f = [Math.cos(psi) * Math.cos(theta), Math.sin(psi) * Math.cos(theta), Math.sin(theta)];
    const u0 = [-Math.cos(psi) * Math.sin(theta), -Math.sin(psi) * Math.sin(theta), Math.cos(theta)];
    const s0 = [f[1] * u0[2] - f[2] * u0[1], f[2] * u0[0] - f[0] * u0[2], f[0] * u0[1] - f[1] * u0[0]];
    const cp = Math.cos(phi), sp = Math.sin(phi);
    const u = [u0[0] * cp + s0[0] * sp, u0[1] * cp + s0[1] * sp, u0[2] * cp + s0[2] * sp];
    const r = [u[1] * f[2] - u[2] * f[1], u[2] * f[0] - u[0] * f[2], u[0] * f[1] - u[1] * f[0]];
    return [r[0], f[0], -u[0], r[1], f[1], -u[1], r[2], f[2], -u[2]];
  }

  /* ================= 4. WebGL1 渲染器 ================= */
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNorm;
    attribute vec2 aUv;
    attribute float aShade;
    attribute vec3 aInkA;
    attribute vec3 aInkB;
    uniform vec2 uScale;
    uniform float uEyeZ;
    uniform vec4 uRectA;
    uniform vec4 uRectB;
    varying vec3 vNorm;
    varying vec2 vUv;
    varying float vShade;
    varying vec3 vInkA;
    varying vec3 vInkB;
    void main() {
      vNorm = aNorm;
      vUv = aUv;
      vShade = aShade;
      vInkA = vec3((aInkA.x - uRectA.x) * uRectA.z, (uRectA.y - aInkA.y) * uRectA.w, aInkA.z);
      vInkB = vec3((aInkB.x - uRectB.x) * uRectB.z, (uRectB.y - aInkB.y) * uRectB.w, aInkB.z);
      float w = max(0.25, uEyeZ - aPos.z);
      gl_Position = vec4(aPos.x * uScale.x, aPos.y * uScale.y, (0.05 - aPos.z) * 0.12, w);
    }
  `;

  const FS = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    varying vec3 vNorm;
    varying vec2 vUv;
    varying float vShade;
    varying vec3 vInkA;
    varying vec3 vInkB;
    uniform sampler2D uTexFront;
    uniform sampler2D uTexBack;
    uniform sampler2D uCrease;
    uniform sampler2D uInkTexA;
    uniform sampler2D uInkTexB;
    uniform vec4 uCreaseOn;
    uniform float uInkAmtA;
    uniform float uInkAmtB;
    uniform vec3 uLight;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    vec3 ink(vec3 col, sampler2D tex, vec3 k, float amt, float face) {
      if (amt < 0.002 || abs(k.z - face) > 0.5) return col;
      if (k.x < 0.0 || k.x > 1.0 || k.y < 0.0 || k.y > 1.0) return col;
      vec4 t = texture2D(tex, k.xy);
      // 墨迹的出现 / 消失：按纸纤维噪声一点点渗开，而不是整体淡入淡出
      float n = 0.75 * vnoise(vUv * 34.0) + 0.25 * vnoise(vUv * 120.0);
      float m = smoothstep(n - 0.22, n + 0.22, amt * 1.44 - 0.22);
      return col * (1.0 - t.a * m) + t.rgb * m * 0.96;
    }
    void main() {
      float face = gl_FrontFacing ? 1.0 : -1.0;
      vec3 N = normalize(vNorm) * face;
      vec3 base = gl_FrontFacing ? texture2D(uTexFront, vUv).rgb : texture2D(uTexBack, vec2(1.0 - vUv.x, vUv.y)).rgb;
      base = ink(base, uInkTexA, vInkA, uInkAmtA, face);
      base = ink(base, uInkTexB, vInkB, uInkAmtB, face);
      float cr = dot(texture2D(uCrease, vUv), uCreaseOn);
      base *= 1.0 - 0.13 * clamp(cr, 0.0, 1.0);
      vec3 L = normalize(uLight);
      float diff = max(0.0, dot(N, L));
      float wrap = max(0.0, dot(N, L) * 0.5 + 0.5);
      float sky = 0.5 + 0.5 * N.z;
      vec3 Hh = normalize(L + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(0.0, dot(N, Hh)), 30.0) * 0.08;
      float lit = (0.60 + 0.22 * diff + 0.14 * wrap + 0.06 * sky) * vShade;
      // 背光的一面带一点暖色透光感（纸很薄）
      vec3 tint = mix(vec3(0.97, 0.94, 0.90), vec3(1.0), clamp(diff * 1.6, 0.0, 1.0));
      vec3 col = base * lit * tint + vec3(1.0, 0.98, 0.94) * spec;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  // 投在桌面上的影子（远处柔一层 + 贴地实一层）
  const VS_SH = `
    attribute vec3 aPos;
    uniform vec2 uScale;
    uniform float uEyeZ;
    uniform float uDeskZ;
    uniform vec3 uLight;
    uniform vec2 uShift;
    uniform float uDepth;
    varying float vH;
    void main() {
      float h = max(0.0, aPos.z - uDeskZ);
      vH = h;
      vec2 sh = aPos.xy - uLight.xy * (h / max(0.3, uLight.z)) + uShift * (1.0 + h * 2.2);
      float w = max(0.25, uEyeZ - uDeskZ);
      gl_Position = vec4(sh.x * uScale.x, sh.y * uScale.y, uDepth, w);
    }
  `;
  const FS_SH = `
    precision mediump float;
    uniform float uAlpha;
    varying float vH;
    void main() {
      gl_FragColor = vec4(0.11, 0.09, 0.06, uAlpha / (1.0 + vH * 1.4));
    }
  `;

  // 翻起来的纸角投在下面纸面上的影子（只画在纸上，靠模板缓冲限制）
  const VS_PS = `
    attribute vec4 aPos;
    uniform vec2 uScale;
    uniform float uEyeZ;
    varying float vA;
    void main() {
      vA = aPos.w;
      float w = max(0.25, uEyeZ - aPos.z);
      gl_Position = vec4(aPos.x * uScale.x, aPos.y * uScale.y, (0.05 - aPos.z) * 0.12, w);
    }
  `;
  const FS_PS = `
    precision mediump float;
    uniform float uAlpha;
    varying float vA;
    void main() {
      gl_FragColor = vec4(0.16, 0.12, 0.07, uAlpha * vA);
    }
  `;

  function compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function makeProg(gl, vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  function locs(gl, prog, names) {
    const o = {};
    names.forEach((n) => { o[n] = n[0] === 'a' ? gl.getAttribLocation(prog, n) : gl.getUniformLocation(prog, n); });
    return o;
  }
  function makeTex(gl) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  class FoldStage {
    constructor(canvas) {
      const opts = { alpha: true, antialias: true, depth: true, stencil: true, powerPreference: 'high-performance' };
      const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
      if (!gl) throw new Error('No WebGL');
      this.gl = gl;
      this.canvas = canvas;
      // 镜头放远、视角收窄：透视更自然，纸角翻起来不会突然顶到镜头前
      this.eyeZ = 7.0;
      this.fovScale = 3.6;
      this.vw = 1; this.vh = 1; this.dpr = 1;
      this.scaleX = 1; this.scaleY = 1;

      this.mesh = buildOrigami();
      const tris = this.mesh.tris;
      this.triCount = tris.length;
      this.vertCount = this.triCount * 3;
      this.STR = 15;
      this.bufData = new Float32Array(this.vertCount * this.STR);
      this.shData = new Float32Array(this.vertCount * 3);
      this.psData = new Float32Array(this.vertCount * 4);

      this.prog = makeProg(gl, VS, FS);
      this.shProg = makeProg(gl, VS_SH, FS_SH);
      this.psProg = makeProg(gl, VS_PS, FS_PS);
      this.vbo = gl.createBuffer();
      this.shVbo = gl.createBuffer();
      this.psVbo = gl.createBuffer();

      this.loc = locs(gl, this.prog, ['aPos', 'aNorm', 'aUv', 'aShade', 'aInkA', 'aInkB', 'uScale', 'uEyeZ', 'uRectA', 'uRectB',
        'uTexFront', 'uTexBack', 'uCrease', 'uInkTexA', 'uInkTexB', 'uCreaseOn', 'uInkAmtA', 'uInkAmtB', 'uLight']);
      this.shLoc = locs(gl, this.shProg, ['aPos', 'uScale', 'uEyeZ', 'uDeskZ', 'uLight', 'uShift', 'uDepth', 'uAlpha']);
      this.psLoc = locs(gl, this.psProg, ['aPos', 'uScale', 'uEyeZ', 'uAlpha']);

      this.tFront = makeTex(gl);
      this.tBack = makeTex(gl);
      this.tCrease = makeTex(gl);
      this.tEmpty = makeTex(gl);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));
      const cd = makeCreaseData(this.mesh.polys);
      gl.bindTexture(gl.TEXTURE_2D, this.tCrease);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, cd.w, cd.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, cd.data);
      this.inks = [];
      this.wx = '';
      this.rebuildTextures();
      gl.disable(gl.CULL_FACE);
    }

    rebuildTextures(wx) {
      if (wx) this.wx = wx;
      const gl = this.gl;
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.bindTexture(gl.TEXTURE_2D, this.tFront);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeFrontTexture());
      gl.bindTexture(gl.TEXTURE_2D, this.tBack);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, makeBackTexture(this.wx));
    }

    // 第 k 步摊平时印在最上层纸面上的文字：canvas 覆盖纸面坐标 rect = [x0, y0, x1, y1]
    setInk(k, canvas, rect) {
      const gl = this.gl;
      if (!this.inks[k]) this.inks[k] = { tex: makeTex(gl), rect: null };
      gl.bindTexture(gl.TEXTURE_2D, this.inks[k].tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      this.inks[k].rect = rect;
    }

    resize(vw, vh, dpr) {
      this.vw = vw; this.vh = vh; this.dpr = dpr;
      this.canvas.width = Math.round(vw * dpr);
      this.canvas.height = Math.round(vh * dpr);
      const minDim = Math.min(vw, vh);
      this.scaleX = (this.fovScale * minDim) / vw;
      this.scaleY = (this.fovScale * minDim) / vh;
      this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    pxPerUnit(z) {
      const w = Math.max(0.25, this.eyeZ - (z || 0));
      return (this.fovScale * Math.min(this.vw, this.vh)) / (2 * w);
    }
    project(pt) {
      const w = Math.max(0.25, this.eyeZ - pt[2]);
      return [((pt[0] * this.scaleX) / w * 0.5 + 0.5) * this.vw, (0.5 - (pt[1] * this.scaleY) / w * 0.5) * this.vh];
    }
    unproject(sx, sy, z) {
      const w = Math.max(0.25, this.eyeZ - (z || 0));
      return [(((sx / this.vw) * 2 - 1) * w) / this.scaleX, ((1 - (sy / this.vh) * 2) * w) / this.scaleY, z || 0];
    }

    render(state) {
      const gl = this.gl;
      const { t0 = 0, t1 = 0, t2 = 0, t3 = 0, t4a = 0, g4 = 0, pose, light, curl } = state;
      const { tris, hinges } = this.mesh;
      const inkA = state.inkA || { k: -1, amt: 0 }, inkB = state.inkB || { k: -1, amt: 0 };
      const kA = this.inks[inkA.k] ? inkA.k : -1, kB = this.inks[inkB.k] ? inkB.k : -1;

      const th0 = Math.PI * 0.86 * Math.sin(Math.PI * clamp(t0, 0, 1));
      const th1 = Math.PI * t1, th2 = Math.PI * t2;
      const t3a = sm(0, 0.78, t3), t3b = sm(0.70, 1.0, t3);
      const th3a = Math.PI * t3a, th3b = Math.PI * t3b;
      const beta = Math.PI / 2 * t4a;
      const cb = Math.cos(beta), sb = Math.sin(beta);
      const cg = Math.cos(g4), sgm = Math.sin(g4);
      const folding4 = t4a > 1e-4 || g4 > 1e-4;

      const Rm = pose.M || eulerMat(pose.rx, pose.ry, pose.rz);
      const sS = pose.s, tx = pose.tx, ty = pose.ty, tz = pose.tz;

      // 纸面阴影：本地光方向
      const Ll = Math.hypot(light[0], light[1], light[2]) || 1;
      const lx = light[0] / Ll, ly = light[1] / Ll, lz = Math.max(0.3, light[2] / Ll);
      const zSurf = 0.034;
      const psOn = !folding4 && (t0 + t1 + t2 + t3) > 0;

      const data = this.bufData, sh = this.shData, ps = this.psData, STR = this.STR;
      const pT = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const shd = [1, 1, 1];
      const psA = [0, 0, 0], psP = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];

      const fold = (pt, P, T, k) => {
        let shade = 1;
        if (curl && t1 < 0.25 && t0 <= 0) {
          const cd = Math.max(0, (pt[0] * curl.cx + pt[1] * curl.cy) - 0.85);
          pt[2] += cd * cd * curl.amp;
        }
        // 第 0 步：右半张往左翻起再摊开（压出中线）
        if (th0 > 1e-4 && P.half0) {
          const s0 = Math.max(0, pt[0]);
          rotAroundHinge(pt, hinges.h0, 0, th0, s0);
          if (s0 < 0.2) shade *= 1 - 0.10 * Math.sin(th0) * (1 - s0 / 0.2);
        }
        if (t1 > 1e-4) {
          const h = P.f1L ? hinges.h1L : (P.f1R ? hinges.h1R : null);
          if (h) {
            const s = (pt[0] - h.ax) * h.nx + (pt[1] - h.ay) * h.ny;
            rotAroundHinge(pt, h, h.z, th1, s);
            if (s < 0.18) shade *= 1 - 0.15 * Math.sin(th1 * 0.85) * (1 - s / 0.18);
          }
          pt[2] = lerp(pt[2], P.r1 * EPS, sm(0.86, 1.0, t1));
        }
        if (t2 > 1e-4) {
          if (P.f2) {
            const h = hinges.h2, s = (pt[0] - h.ax) * h.nx + (pt[1] - h.ay) * h.ny;
            rotAroundHinge(pt, h, h.z, th2, s);
            if (s < 0.22) shade *= 1 - 0.16 * Math.sin(th2 * 0.85) * (1 - s / 0.22);
          }
          pt[2] = lerp(pt[2], P.r2 * EPS, sm(0.86, 1.0, t2));
        }
        if (t3 > 1e-4) {
          const h = P.f3L ? hinges.h3L : (P.f3R ? hinges.h3R : null);
          if (h) {
            const s = (pt[0] - h.ax) * h.nx + (pt[1] - h.ay) * h.ny;
            rotAroundHinge(pt, h, h.z, th3a, s);
            if (s < 0.20) shade *= 1 - 0.15 * Math.sin(th3a * 0.85) * (1 - s / 0.20);
          }
          if (t3b > 1e-4 && P.f3K) {
            const hk = hinges.h3K, s = (pt[0] - hk.ax) * hk.nx + (pt[1] - hk.ay) * hk.ny;
            rotAroundHinge(pt, hk, hk.z, th3b, s * 0.2);
          }
          pt[2] = lerp(pt[2], P.r3 * EPS, sm(0.88, 1.0, t3));
        }
        // 第 4 步：沿中线向后对折（β）→ 折下机翼（γ）；层厚沿各自面的法线方向叠
        if (folding4) {
          const sg = T.sideX, a = Math.max(0, sg * pt[0]);
          const lzz = pt[2];
          if (!T.isWing) {
            pt[0] = sg * a * cb + sg * lzz * sb + sg * 0.6 * EPS * sb;
            pt[2] = -a * sb + lzz * cb;
            shade *= 1 - 0.10 * sb * (1 - a / Math.max(0.03, wKatY(pt[1])));
          } else {
            const wk = wKatY(pt[1]), Lw = a - wk;
            const wx = sg * (cb * cg + sb * sgm), wz = -sb * cg + cb * sgm;
            const nx = sg * (sb * cg - cb * sgm), nz = cb * cg + sb * sgm;
            pt[0] = sg * wk * cb + Lw * wx + (lzz + 0.6 * EPS) * nx;
            pt[2] = -wk * sb + Lw * wz + (lzz + 0.6 * EPS) * nz;
            if (Lw < 0.08) shade *= 1 - 0.08 * Math.min(1, g4) * (1 - Lw / 0.08);
          }
        }
        return shade;
      };

      for (let i = 0; i < tris.length; i++) {
        const T = tris[i], P = T.P, vs = T.v;
        for (let k = 0; k < 3; k++) {
          const v = vs[k], pt = pT[k];
          pt[0] = v.x0; pt[1] = v.y0; pt[2] = 0;
          shd[k] = fold(pt, P, T, k);
          // 纸面阴影：把高出纸面的点沿光线压回纸面
          if (psOn) {
            const hh = Math.max(0, pt[2] - zSurf);
            psA[k] = sm(0.02, 0.45, hh) * (1 - sm(0.9, 1.6, hh));
            const q = psP[k];
            q[0] = (pt[0] - lx * hh / lz * 0.9) * sS;
            q[1] = (pt[1] - ly * hh / lz * 0.9) * sS;
            q[2] = zSurf * sS;
            applyM3(Rm, q);
            q[0] += tx; q[1] += ty; q[2] += tz;
          }
          pt[0] *= sS; pt[1] *= sS; pt[2] *= sS;
          applyM3(Rm, pt);
          pt[0] += tx; pt[1] += ty; pt[2] += tz;
        }
        const ax = pT[1][0] - pT[0][0], ay = pT[1][1] - pT[0][1], az = pT[1][2] - pT[0][2];
        const bx = pT[2][0] - pT[0][0], by = pT[2][1] - pT[0][1], bz = pT[2][2] - pT[0][2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        const fA = kA >= 0 ? P.face[kA] : 0, fB = kB >= 0 ? P.face[kB] : 0;
        for (let k = 0; k < 3; k++) {
          const o = (i * 3 + k) * STR, so = (i * 3 + k) * 3, po = (i * 3 + k) * 4;
          const pt = pT[k], v = vs[k];
          data[o] = pt[0]; data[o + 1] = pt[1]; data[o + 2] = pt[2];
          data[o + 3] = nx; data[o + 4] = ny; data[o + 5] = nz;
          data[o + 6] = v.u; data[o + 7] = v.v;
          data[o + 8] = shd[k];
          data[o + 9] = kA === 0 ? v.x0 : kA === 1 ? v.x1 : kA === 2 ? v.x2 : v.x;
          data[o + 10] = kA === 0 ? v.y0 : kA === 1 ? v.y1 : kA === 2 ? v.y2 : v.y;
          data[o + 11] = fA;
          data[o + 12] = kB === 0 ? v.x0 : kB === 1 ? v.x1 : kB === 2 ? v.x2 : v.x;
          data[o + 13] = kB === 0 ? v.y0 : kB === 1 ? v.y1 : kB === 2 ? v.y2 : v.y;
          data[o + 14] = fB;
          sh[so] = pt[0]; sh[so + 1] = pt[1]; sh[so + 2] = pt[2];
          if (psOn) { const q = psP[k]; ps[po] = q[0]; ps[po + 1] = q[1]; ps[po + 2] = q[2]; ps[po + 3] = psA[k]; }
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clearStencil(0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);

      // Pass 1：桌面投影阴影
      gl.disable(gl.STENCIL_TEST);
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.shProg);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.shVbo);
      gl.bufferData(gl.ARRAY_BUFFER, sh, gl.DYNAMIC_DRAW);
      gl.enableVertexAttribArray(this.shLoc.aPos);
      gl.vertexAttribPointer(this.shLoc.aPos, 3, gl.FLOAT, false, 12, 0);
      gl.uniform2f(this.shLoc.uScale, this.scaleX, this.scaleY);
      gl.uniform1f(this.shLoc.uEyeZ, this.eyeZ);
      gl.uniform1f(this.shLoc.uDeskZ, state.deskZ);
      gl.uniform3f(this.shLoc.uLight, light[0], light[1], light[2]);
      gl.uniform2f(this.shLoc.uShift, 0.02, -0.03);
      gl.uniform1f(this.shLoc.uDepth, 0.95);
      gl.uniform1f(this.shLoc.uAlpha, state.shadowAlpha * 0.42);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      gl.uniform2f(this.shLoc.uShift, 0.005, -0.007);
      gl.uniform1f(this.shLoc.uDepth, 0.91);
      gl.uniform1f(this.shLoc.uAlpha, state.shadowAlpha * 0.66);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      gl.disableVertexAttribArray(this.shLoc.aPos);

      // Pass 2：纸本体（同时在模板缓冲里记下"这里有纸"）
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.depthFunc(gl.LEQUAL);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilFunc(gl.ALWAYS, 1, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const L = this.loc, B = STR * 4;
      [['aPos', 3, 0], ['aNorm', 3, 12], ['aUv', 2, 24], ['aShade', 1, 32], ['aInkA', 3, 36], ['aInkB', 3, 48]].forEach(([n, sz, off]) => {
        gl.enableVertexAttribArray(L[n]);
        gl.vertexAttribPointer(L[n], sz, gl.FLOAT, false, B, off);
      });
      const bindT = (unit, tex, uni) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(uni, unit); };
      bindT(0, this.tFront, L.uTexFront);
      bindT(1, this.tBack, L.uTexBack);
      bindT(2, this.tCrease, L.uCrease);
      bindT(3, kA >= 0 ? this.inks[kA].tex : this.tEmpty, L.uInkTexA);
      bindT(4, kB >= 0 ? this.inks[kB].tex : this.tEmpty, L.uInkTexB);
      const rect = (k, uni) => {
        if (k < 0) { gl.uniform4f(uni, 0, 0, 1, 1); return; }
        const r = this.inks[k].rect;
        gl.uniform4f(uni, r[0], r[3], 1 / (r[2] - r[0]), 1 / (r[3] - r[1]));
      };
      rect(kA, L.uRectA);
      rect(kB, L.uRectB);
      gl.uniform1f(L.uInkAmtA, kA >= 0 ? inkA.amt : 0);
      gl.uniform1f(L.uInkAmtB, kB >= 0 ? inkB.amt : 0);
      const co = state.creaseOn || [0, 0, 0, 0];
      gl.uniform4f(L.uCreaseOn, co[0], co[1], co[2], co[3]);
      gl.uniform2f(L.uScale, this.scaleX, this.scaleY);
      gl.uniform1f(L.uEyeZ, this.eyeZ);
      gl.uniform3f(L.uLight, light[0], light[1], light[2]);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
      ['aPos', 'aNorm', 'aUv', 'aShade', 'aInkA', 'aInkB'].forEach((n) => gl.disableVertexAttribArray(L[n]));

      // Pass 3：翻起的纸角落在纸面上的软影
      if (psOn) {
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.depthMask(false);
        gl.stencilFunc(gl.EQUAL, 1, 0xff);
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
        gl.useProgram(this.psProg);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.psVbo);
        gl.bufferData(gl.ARRAY_BUFFER, ps, gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(this.psLoc.aPos);
        gl.vertexAttribPointer(this.psLoc.aPos, 4, gl.FLOAT, false, 16, 0);
        gl.uniform2f(this.psLoc.uScale, this.scaleX, this.scaleY);
        gl.uniform1f(this.psLoc.uEyeZ, this.eyeZ);
        gl.uniform1f(this.psLoc.uAlpha, 0.16);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
        gl.disableVertexAttribArray(this.psLoc.aPos);
        gl.depthMask(true);
      }
      gl.disable(gl.STENCIL_TEST);
    }
  }

  window.FoldGL = { FoldStage, W, H, C2, MEET, wKatY, planeMat, matToQuat, quatToMat, slerp, eulerMat, applyM3 };
})();
