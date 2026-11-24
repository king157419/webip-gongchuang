/* v24-fold · fold-gl.js —— 手写 WebGL1 折纸引擎
 * 真实折痕多边形剖分（Sutherland-Hodgman）+ 中村锁纸飞机四步运动学 + 桌面投影阴影 */
(function () {
  'use strict';

  const W = 1.0, H = 1.42;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ================= 1. 折痕多边形精确剖分 ================= */
  function lerpV(a, b, t) {
    return {
      u: a.u + (b.u - a.u) * t,
      v: a.v + (b.v - a.v) * t,
      x0: a.x0 + (b.x0 - a.x0) * t,
      y0: a.y0 + (b.y0 - a.y0) * t,
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }

  function polyCenter(vs) {
    let x = 0, y = 0;
    for (let i = 0; i < vs.length; i++) { x += vs[i].x; y += vs[i].y; }
    return [x / vs.length, y / vs.length];
  }

  function splitAtThreshold(polys, ax, ay, nx, ny, thr, pred) {
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
          vA.push(m);
          vB.push({ ...m });
        }
      }
      if (vA.length >= 3) out.push({ ...P, verts: vA });
      if (vB.length >= 3) out.push({ ...P, verts: vB });
    }
    return out;
  }

  function foldStepSetup(polys, ax, ay, bx, by, flagKey, strips, pred, fixedMaxR) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    let res = splitAtThreshold(polys, ax, ay, nx, ny, 0, pred);
    if (strips) {
      for (let k = 0; k < strips.length; k++) {
        res = splitAtThreshold(res, ax, ay, nx, ny, strips[k], pred);
      }
    }
    let maxR = fixedMaxR != null ? fixedMaxR : 0;
    if (fixedMaxR == null) {
      for (let i = 0; i < res.length; i++) if (res[i].rank > maxR) maxR = res[i].rank;
    }
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

  // 机身龙骨宽度：机尾 0.36 → 机头 0.045（龙骨够深，侧看才像纸飞机）
  const WK0 = () => 0.36;
  const wKatY = (y) => lerp(WK0(), 0.045, clamp((y + 1.42) / 2.02, 0, 1));

  function buildOrigami() {
    let polys = [{
      rank: 0, r0: 0,
      verts: [
        { u: 0, v: 1, x0: -W, y0: -H, x: -W, y: -H },
        { u: 1, v: 1, x0:  W, y0: -H, x:  W, y: -H },
        { u: 1, v: 0, x0:  W, y0:  H, x:  W, y:  H },
        { u: 0, v: 0, x0: -W, y0:  H, x: -W, y:  H }
      ]
    }];

    const S1 = [0.16, 0.34, 0.52];
    const s1L = foldStepSetup(polys, -1.0, 0.42, 0.0, 1.42, 'f1L', S1, null, 0);
    polys = s1L.polys;
    const s1R = foldStepSetup(polys, 0.0, 1.42, 1.0, 0.42, 'f1R', S1, null, 0);
    polys = s1R.polys;
    compactRanks(polys, 'r1');

    const s2 = foldStepSetup(polys, -1.0, 0.60, 1.0, 0.60, 'f2', [0.18, 0.40, 0.62]);
    polys = s2.polys;
    const maxR2 = compactRanks(polys, 'r2');

    const S3 = [0.15, 0.32, 0.50];
    const s3L = foldStepSetup(polys, -1.0, -0.34, -0.05, 0.60, 'f3L', S3, null, maxR2);
    polys = s3L.polys;
    const s3R = foldStepSetup(polys, 0.05, 0.60, 1.0, -0.34, 'f3R', S3, null, maxR2);
    polys = s3R.polys;
    // 中村锁小鼻尖上翻（仅针对第 2 折翻下来的表层鼻尖）
    const s3K = foldStepSetup(polys, 0.14, -0.11, -0.14, -0.11, 'f3K', [0.05], (p) => p.f2 && !p.f3L && !p.f3R);
    polys = s3K.polys;
    compactRanks(polys, 'r3');

    // 第 4 折精确折痕切分：中脊 x=0 + 两侧渐缩机身翼根线 (±0.22,-1.42)->(±0.045,0.60)
    polys = splitAtThreshold(polys, 0, 0, 1, 0, 0);
    const wk0 = WK0(), dxK = wk0 - 0.045, dyK = 2.02, LK = Math.hypot(dxK, dyK);
    polys = splitAtThreshold(polys, -wk0, -1.42, -dyK / LK, dxK / LK, 0);
    polys = splitAtThreshold(polys, wk0, -1.42, dyK / LK, dxK / LK, 0);

    const xCuts = [-0.62, 0.62];
    for (let k = 0; k < xCuts.length; k++) {
      polys = splitAtThreshold(polys, xCuts[k], 0, 1, 0, 0);
    }
    const yCuts = [-1.02, -0.64, -0.10];
    for (let k = 0; k < yCuts.length; k++) {
      polys = splitAtThreshold(polys, 0, yCuts[k], 0, 1, 0);
    }

    const tris = [];
    for (let i = 0; i < polys.length; i++) {
      const P = polys[i], vs = P.verts;
      const [cx, cy] = polyCenter(vs);
      const sideX = cx < 0 ? -1 : 1;
      const isWing = Math.abs(cx) > wKatY(cy);
      for (let k = 1; k < vs.length - 1; k++) {
        tris.push({
          P,
          sideX,
          isWing,
          v: [vs[0], vs[k], vs[k + 1]]
        });
      }
    }
    return { tris, hinges: { h1L: s1L.hinge, h1R: s1R.hinge, h2: s2.hinge, h3L: s3L.hinge, h3R: s3R.hinge, h3K: s3K.hinge } };
  }

  /* ================= 2. 纸张正反面与机翼贴图生成 ================= */
  function makeFrontTexture() {
    const c = document.createElement('canvas');
    c.width = 768; c.height = 1090;
    const g = c.getContext('2d');
    // 暖棉纸底色
    const bg = g.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, '#faf6ee');
    bg.addColorStop(0.55, '#f6f1e7');
    bg.addColorStop(1, '#eee7da');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);

    // 纸张纤维与微颗粒
    let seed = 24041;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.lineWidth = 0.85;
    for (let i = 0; i < 1500; i++) {
      const x = rnd() * c.width, y = rnd() * c.height, a = rnd() * Math.PI, l = 4 + rnd() * 14;
      g.strokeStyle = i % 3 === 0 ? 'rgba(148,132,108,0.08)' : 'rgba(255,253,248,0.38)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }

    // 真实裁切纸边微暗描边（翻折叠合时清晰区分每一层纸缘）
    g.strokeStyle = 'rgba(86,74,56,0.24)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);

    // 四角裁切线
    g.strokeStyle = 'rgba(23,22,20,0.22)';
    g.lineWidth = 1.2;
    const m = 26, cl = 18;
    [[m, m, 1, 1], [c.width - m, m, -1, 1], [m, c.height - m, 1, -1], [c.width - m, c.height - m, -1, -1]].forEach(([x, y, sx, sy]) => {
      g.beginPath();
      g.moveTo(x, y + sy * cl); g.lineTo(x, y); g.lineTo(x + sx * cl, y);
      g.stroke();
    });

    // 折纸虚线引导（克制浅朱砂虚线，不压正文区域）
    const ux = (x) => (x + W) / (2 * W) * c.width;
    const uy = (y) => (H - y) / (2 * H) * c.height;
    g.save();
    g.setLineDash([7, 7]);
    g.strokeStyle = 'rgba(201,63,24,0.16)';
    g.lineWidth = 1.1;
    g.beginPath();
    g.moveTo(ux(0), uy(1.42)); g.lineTo(ux(-1), uy(0.42));
    g.moveTo(ux(0), uy(1.42)); g.lineTo(ux(1), uy(0.42));
    g.stroke();
    g.strokeStyle = 'rgba(23,22,20,0.075)';
    g.beginPath();
    g.moveTo(ux(0), uy(1.42)); g.lineTo(ux(0), uy(-1.42));
    g.stroke();
    g.restore();

    return c;
  }

  function makeBackTexture() {
    const c = document.createElement('canvas');
    c.width = 768; c.height = 1090;
    const g = c.getContext('2d');
    // 背面微暖棉浆纸，与正面形成自然纸层色差，干净衬托深墨字与折翼造型
    const bg = g.createLinearGradient(0, 0, c.width, c.height);
    bg.addColorStop(0, '#f4eee2');
    bg.addColorStop(1, '#ebe3d3');
    g.fillStyle = bg;
    g.fillRect(0, 0, c.width, c.height);

    let seed = 88177;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    g.lineWidth = 0.85;
    for (let i = 0; i < 1100; i++) {
      const x = rnd() * c.width, y = rnd() * c.height, a = rnd() * Math.PI, l = 5 + rnd() * 13;
      g.strokeStyle = i % 3 === 0 ? 'rgba(132,118,96,0.075)' : 'rgba(255,252,246,0.32)';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }

    // 背面纸缘细描边与极淡中脊折痕线
    g.strokeStyle = 'rgba(86,74,56,0.25)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, c.width - 3, c.height - 3);

    g.strokeStyle = 'rgba(201,63,24,0.11)';
    g.lineWidth = 1;
    g.setLineDash([6, 7]);
    g.beginPath();
    g.moveTo(c.width / 2, 36);
    g.lineTo(c.width / 2, c.height - 36);
    g.stroke();
    return c;
  }

  function makeWingTexture() {
    // 印在纸飞机机翼上的“怎么加入”（按翼面方向居中排版，飞机停稳时正对视线）
    const c = document.createElement('canvas');
    c.width = 768; c.height = 1090;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);

    const ux = (x) => (x + W) / (2 * W) * c.width;
    const uy = (y) => (H - y) / (2 * H) * c.height;

    // 左翼主标题（飞机向右上昂首停驻时，左翼宽阔迎向镜头）
    g.save();
    g.translate(ux(-0.58), uy(-0.88));
    g.rotate(-0.46);
    g.fillStyle = '#c93f18';
    g.fillRect(-102, -52, 204, 4);
    g.font = '900 16.5px "SHU Serif", "Noto Serif SC", serif';
    g.fillText('第四折 · 折翼起飞', -102, -28);
    g.fillStyle = '#171614';
    g.font = '900 50px "SHU Serif", "Noto Serif SC", serif';
    g.fillText('怎么加入', -104, 26);
    g.fillStyle = 'rgba(23,22,20,0.62)';
    g.font = '400 16.5px "SHU Serif", "Noto Serif SC", serif';
    g.fillText('上海大学人工智能社', -102, 54);
    g.restore();

    // 右翼朱砂航标饰条
    g.save();
    g.translate(ux(0.58), uy(-0.90));
    g.rotate(0.46);
    g.fillStyle = '#c93f18';
    g.fillRect(-82, -10, 164, 6.5);
    g.fillStyle = '#171614';
    g.fillRect(-82, 3, 110, 2.8);
    g.restore();

    return c;
  }

  /* ================= 3. 三维旋转与单步折痕形变 ================= */
  function rotAroundHinge(p, h, zH, theta, sDist) {
    if (theta <= 1e-5) return;
    const dx = p[0] - h.ax, dy = p[1] - h.ay, dz = p[2] - zH;
    // 沿折痕轴投影
    const proj = dx * h.ux + dy * h.uy;
    const px = h.ax + proj * h.ux, py = h.ay + proj * h.uy;
    // 垂直于折痕平面的二维分量 (rN, dz)
    const rN = dx * h.nx + dy * h.ny;
    // 纸张翻折时的自然弧度滞后（离折痕越远越柔顺微弯，落地时归零摊平）
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
    // R = Rz * Rx * Ry
    const m00 = cz * cy - sz * sx * sy;
    const m01 = -sz * cx;
    const m02 = cz * sy + sz * sx * cy;
    const m10 = sz * cy + cz * sx * sy;
    const m11 = cz * cx;
    const m12 = sz * sy - cz * sx * cy;
    const m20 = -cx * sy;
    const m21 = sx;
    const m22 = cx * cy;
    return [m00, m01, m02, m10, m11, m12, m20, m21, m22];
  }

  function applyM3(M, p) {
    const x = p[0], y = p[1], z = p[2];
    p[0] = M[0] * x + M[1] * y + M[2] * z;
    p[1] = M[3] * x + M[4] * y + M[5] * z;
    p[2] = M[6] * x + M[7] * y + M[8] * z;
  }

  /* ================= 4. WebGL1 渲染器 ================= */
  const VS = `
    attribute vec3 aPos;
    attribute vec3 aNorm;
    attribute vec2 aUv;
    attribute float aShade;
    uniform vec2 uScale;
    uniform float uEyeZ;
    varying vec3 vNorm;
    varying vec3 vPos;
    varying vec2 vUv;
    varying float vShade;
    void main() {
      vNorm = aNorm;
      vPos = aPos;
      vUv = aUv;
      vShade = aShade;
      float w = max(0.25, uEyeZ - aPos.z);
      gl_Position = vec4(aPos.x * uScale.x, aPos.y * uScale.y, (0.05 - aPos.z) * 0.25, w);
    }
  `;

  const FS = `
    precision mediump float;
    varying vec3 vNorm;
    varying vec3 vPos;
    varying vec2 vUv;
    varying float vShade;
    uniform sampler2D uTexFront;
    uniform sampler2D uTexBack;
    uniform sampler2D uTexWing;
    uniform float uWingInk;
    uniform vec3 uLight;
    void main() {
      vec3 N = normalize(vNorm);
      if (!gl_FrontFacing) N = -N;
      vec4 base = gl_FrontFacing ? texture2D(uTexFront, vUv) : texture2D(uTexBack, vec2(1.0 - vUv.x, vUv.y));
      if (gl_FrontFacing && uWingInk > 0.005) {
        vec4 wk = texture2D(uTexWing, vUv);
        base.rgb = mix(base.rgb, wk.rgb, wk.a * uWingInk);
      }
      vec3 L = normalize(uLight);
      float diff = max(0.0, dot(N, L));
      float sky = 0.5 + 0.5 * N.z;
      float bounce = max(0.0, -N.z) * 0.22;
      vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
      float spec = pow(max(0.0, dot(N, H)), 26.0) * 0.11;
      float lit = (0.64 + 0.34 * diff + 0.08 * sky + bounce) * vShade;
      vec3 col = base.rgb * lit + vec3(1.0, 0.98, 0.94) * spec;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  const VS_SH = `
    attribute vec3 aPos;
    uniform vec2 uScale;
    uniform float uEyeZ;
    uniform float uDeskZ;
    uniform vec3 uLight;
    uniform vec2 uShift;
    uniform float uDepth;
    void main() {
      float h = max(0.0, aPos.z - uDeskZ);
      vec2 sh = aPos.xy - uLight.xy * (h / max(0.3, uLight.z)) + uShift;
      float w = max(0.25, uEyeZ - uDeskZ);
      gl_Position = vec4(sh.x * uScale.x, sh.y * uScale.y, uDepth, w);
    }
  `;

  const FS_SH = `
    precision mediump float;
    uniform float uAlpha;
    void main() {
      gl_FragColor = vec4(0.11, 0.09, 0.06, uAlpha);
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

  function uploadTex(gl, unit, canvas) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    return t;
  }

  class FoldStage {
    constructor(canvas) {
      const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, stencil: false, powerPreference: 'high-performance' })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, depth: true });
      if (!gl) throw new Error('No WebGL');
      this.gl = gl;
      this.canvas = canvas;
      this.eyeZ = 3.8;
      this.fovScale = 1.95;
      this.vw = 1; this.vh = 1; this.dpr = 1;
      this.scaleX = 1; this.scaleY = 1;

      this.mesh = buildOrigami();
      this.triCount = this.mesh.tris.length;
      this.vertCount = this.triCount * 3;
      this.bufData = new Float32Array(this.vertCount * 9); // pos(3), norm(3), uv(2), shade(1)
      this.shData = new Float32Array(this.vertCount * 3);

      this.prog = makeProg(gl, VS, FS);
      this.shProg = makeProg(gl, VS_SH, FS_SH);
      this.vbo = gl.createBuffer();
      this.shVbo = gl.createBuffer();

      this.loc = {
        aPos: gl.getAttribLocation(this.prog, 'aPos'),
        aNorm: gl.getAttribLocation(this.prog, 'aNorm'),
        aUv: gl.getAttribLocation(this.prog, 'aUv'),
        aShade: gl.getAttribLocation(this.prog, 'aShade'),
        uScale: gl.getUniformLocation(this.prog, 'uScale'),
        uEyeZ: gl.getUniformLocation(this.prog, 'uEyeZ'),
        uTexFront: gl.getUniformLocation(this.prog, 'uTexFront'),
        uTexBack: gl.getUniformLocation(this.prog, 'uTexBack'),
        uTexWing: gl.getUniformLocation(this.prog, 'uTexWing'),
        uWingInk: gl.getUniformLocation(this.prog, 'uWingInk'),
        uLight: gl.getUniformLocation(this.prog, 'uLight')
      };
      this.shLoc = {
        aPos: gl.getAttribLocation(this.shProg, 'aPos'),
        uScale: gl.getUniformLocation(this.shProg, 'uScale'),
        uEyeZ: gl.getUniformLocation(this.shProg, 'uEyeZ'),
        uDeskZ: gl.getUniformLocation(this.shProg, 'uDeskZ'),
        uLight: gl.getUniformLocation(this.shProg, 'uLight'),
        uShift: gl.getUniformLocation(this.shProg, 'uShift'),
        uDepth: gl.getUniformLocation(this.shProg, 'uDepth'),
        uAlpha: gl.getUniformLocation(this.shProg, 'uAlpha')
      };

      this.rebuildTextures();
      gl.disable(gl.CULL_FACE);
    }

    rebuildTextures() {
      const gl = this.gl;
      if (this.tFront) gl.deleteTexture(this.tFront);
      if (this.tBack) gl.deleteTexture(this.tBack);
      if (this.tWing) gl.deleteTexture(this.tWing);
      this.tFront = uploadTex(gl, 0, makeFrontTexture());
      this.tBack = uploadTex(gl, 1, makeBackTexture());
      this.tWing = uploadTex(gl, 2, makeWingTexture());
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
      const ndcX = (pt[0] * this.scaleX) / w;
      const ndcY = (pt[1] * this.scaleY) / w;
      return [(ndcX * 0.5 + 0.5) * this.vw, (0.5 - ndcY * 0.5) * this.vh];
    }

    unproject(sx, sy, z) {
      const w = Math.max(0.25, this.eyeZ - (z || 0));
      const ndcX = (sx / this.vw) * 2 - 1;
      const ndcY = 1 - (sy / this.vh) * 2;
      return [(ndcX * w) / this.scaleX, (ndcY * w) / this.scaleY, z || 0];
    }

    rotVec(rx, ry, rz, v) {
      const p = [v[0], v[1], v[2]];
      applyM3(eulerMat(rx, ry, rz), p);
      return p;
    }

    worldPt(pose, lx, ly, lz) {
      const p = [lx * pose.s, ly * pose.s, lz * pose.s];
      applyM3(eulerMat(pose.rx, pose.ry, pose.rz), p);
      p[0] += pose.tx; p[1] += pose.ty; p[2] += pose.tz;
      return p;
    }

    render(state) {
      const gl = this.gl;
      const { t1, t2, t3, t4, wingInk, pose, light, curl } = state;
      const { tris, hinges } = this.mesh;
      const EPS = 0.0024;

      const th1 = Math.PI * t1;
      const th2 = Math.PI * t2;
      const t3a = sm(0, 0.80, t3), t3b = sm(0.66, 1.0, t3);
      const th3a = Math.PI * t3a, th3b = Math.PI * t3b;

      const alpha4 = 1.38 * sm(0.0, 0.74, t4);
      const delta4 = 0.30 * sm(0.24, 0.96, t4);
      const cosA = Math.cos(alpha4), sinA = Math.sin(alpha4);
      const cosD = Math.cos(delta4), sinD = Math.sin(delta4);

      const Rm = eulerMat(pose.rx, pose.ry, pose.rz);
      const sScale = pose.s;
      const tx = pose.tx, ty = pose.ty, tz = pose.tz;

      const data = this.bufData, sh = this.shData;
      const pTmp = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      const shTmp = [1, 1, 1];

      for (let i = 0; i < tris.length; i++) {
        const T = tris[i], P = T.P, vs = T.v;
        for (let k = 0; k < 3; k++) {
          const v = vs[k], pt = pTmp[k];
          pt[0] = v.x0; pt[1] = v.y0; pt[2] = 0;
          let shade = 1.0;

          // 首屏微掀纸角手感（仅未折平处轻微响应指针）
          if (curl && t1 < 0.25) {
            const cd = Math.max(0, (pt[0] * curl.cx + pt[1] * curl.cy) - 0.85);
            pt[2] += cd * cd * curl.amp * (1 - t1 * 4);
          }

          // 第 1 折：左右上角 45° 内折
          if (t1 > 1e-4) {
            if (P.f1L) {
              const s = (pt[0] - hinges.h1L.ax) * hinges.h1L.nx + (pt[1] - hinges.h1L.ay) * hinges.h1L.ny;
              rotAroundHinge(pt, hinges.h1L, 0.8 * EPS, th1, s);
              if (s < 0.18) shade *= 1 - 0.15 * Math.sin(th1 * 0.85) * (1 - s / 0.18);
            } else if (P.f1R) {
              const s = (pt[0] - hinges.h1R.ax) * hinges.h1R.nx + (pt[1] - hinges.h1R.ay) * hinges.h1R.ny;
              rotAroundHinge(pt, hinges.h1R, 0.8 * EPS, th1, s);
              if (s < 0.18) shade *= 1 - 0.15 * Math.sin(th1 * 0.85) * (1 - s / 0.18);
            }
            pt[2] = lerp(pt[2], P.r1 * EPS, sm(0.86, 1.0, t1));
          }

          // 第 2 折：上尖向下信封横折
          if (t2 > 1e-4) {
            if (P.f2) {
              const s = (pt[0] - hinges.h2.ax) * hinges.h2.nx + (pt[1] - hinges.h2.ay) * hinges.h2.ny;
              rotAroundHinge(pt, hinges.h2, 1.6 * EPS, th2, s);
              if (s < 0.22) shade *= 1 - 0.16 * Math.sin(th2 * 0.85) * (1 - s / 0.22);
            }
            pt[2] = lerp(pt[2], P.r2 * EPS, sm(0.86, 1.0, t2));
          }

          // 第 3 折：两翼斜收 + 中村锁小鼻尖上扣
          if (t3 > 1e-4) {
            if (P.f3L) {
              const s = (pt[0] - hinges.h3L.ax) * hinges.h3L.nx + (pt[1] - hinges.h3L.ay) * hinges.h3L.ny;
              rotAroundHinge(pt, hinges.h3L, 3.4 * EPS, th3a, s);
              if (s < 0.20) shade *= 1 - 0.15 * Math.sin(th3a * 0.85) * (1 - s / 0.20);
            } else if (P.f3R) {
              const s = (pt[0] - hinges.h3R.ax) * hinges.h3R.nx + (pt[1] - hinges.h3R.ay) * hinges.h3R.ny;
              rotAroundHinge(pt, hinges.h3R, 3.4 * EPS, th3a, s);
              if (s < 0.20) shade *= 1 - 0.15 * Math.sin(th3a * 0.85) * (1 - s / 0.20);
            }
            if (t3b > 1e-4 && P.f3K) {
              const s = (pt[0] - hinges.h3K.ax) * hinges.h3K.nx + (pt[1] - hinges.h3K.ay) * hinges.h3K.ny;
              rotAroundHinge(pt, hinges.h3K, 5.4 * EPS, th3b, s);
            }
            pt[2] = lerp(pt[2], P.r3 * EPS, sm(0.88, 1.0, t3));
          }

          // 第 4 折：渐缩中脊合拢出龙骨 + 利落双翼展开（严格单调层高，零穿模零锯齿）
          if (t4 > 1e-4) {
            const sg = T.sideX;
            const ax = Math.max(0, sg * pt[0]);
            const wK = wKatY(pt[1]);
            let bx, bz;
            if (!T.isWing) {
              const aC = Math.min(ax, wK);
              bx = sg * aC * cosA;
              bz = (aC - wK) * sinA;
              shade *= 1 - 0.19 * t4 * (1 - aC / Math.max(0.02, wK));
            } else {
              const aW = Math.max(ax, wK);
              bx = sg * (wK * cosA + (aW - wK) * cosD);
              bz = (aW - wK) * sinD;
              if (aW - wK < 0.09) shade *= 1 - 0.09 * t4 * (1 - (aW - wK) / 0.09);
            }
            const zLayer = lerp(pt[2], P.r3 * 0.0017, sm(0, 0.36, t4));
            pt[0] = bx;
            pt[2] = bz + zLayer;
          }

          // 叠层轻微明暗层次
          if (P.r3 > 0 && t1 >= 0.98) shade *= 0.988;

          pt[0] *= sScale; pt[1] *= sScale; pt[2] *= sScale;
          applyM3(Rm, pt);
          pt[0] += tx; pt[1] += ty; pt[2] += tz;
          shTmp[k] = shade;
        }

        // 面法线
        const ax = pTmp[1][0] - pTmp[0][0], ay = pTmp[1][1] - pTmp[0][1], az = pTmp[1][2] - pTmp[0][2];
        const bx = pTmp[2][0] - pTmp[0][0], by = pTmp[2][1] - pTmp[0][1], bz = pTmp[2][2] - pTmp[0][2];
        let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;

        const base = i * 27, sBase = i * 9;
        for (let k = 0; k < 3; k++) {
          const o = base + k * 9, so = sBase + k * 3;
          const pt = pTmp[k], v = vs[k];
          data[o] = pt[0]; data[o + 1] = pt[1]; data[o + 2] = pt[2];
          data[o + 3] = nx; data[o + 4] = ny; data[o + 5] = nz;
          data[o + 6] = v.u; data[o + 7] = v.v;
          data[o + 8] = shTmp[k];
          sh[so] = pt[0]; sh[so + 1] = pt[1]; sh[so + 2] = pt[2];
        }
      }

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      // Pass 1：双层桌面投影阴影（远层柔化半影 + 近层接触实影，固定深度防叠黑）
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

      gl.uniform2f(this.shLoc.uShift, 0.018, -0.024);
      gl.uniform1f(this.shLoc.uDepth, 0.95);
      gl.uniform1f(this.shLoc.uAlpha, state.shadowAlpha * 0.46);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);

      gl.uniform2f(this.shLoc.uShift, 0.005, -0.007);
      gl.uniform1f(this.shLoc.uDepth, 0.91);
      gl.uniform1f(this.shLoc.uAlpha, state.shadowAlpha * 0.68);
      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);

      // Pass 2：三维折纸实体
      gl.clear(gl.DEPTH_BUFFER_BIT);
      gl.disable(gl.BLEND);
      gl.depthFunc(gl.LEQUAL);

      gl.useProgram(this.prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const stride = 36;
      gl.enableVertexAttribArray(this.loc.aPos);
      gl.vertexAttribPointer(this.loc.aPos, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(this.loc.aNorm);
      gl.vertexAttribPointer(this.loc.aNorm, 3, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(this.loc.aUv);
      gl.vertexAttribPointer(this.loc.aUv, 2, gl.FLOAT, false, stride, 24);
      gl.enableVertexAttribArray(this.loc.aShade);
      gl.vertexAttribPointer(this.loc.aShade, 1, gl.FLOAT, false, stride, 32);

      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tFront);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.tBack);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.tWing);
      gl.uniform1i(this.loc.uTexFront, 0);
      gl.uniform1i(this.loc.uTexBack, 1);
      gl.uniform1i(this.loc.uTexWing, 2);
      gl.uniform2f(this.loc.uScale, this.scaleX, this.scaleY);
      gl.uniform1f(this.loc.uEyeZ, this.eyeZ);
      gl.uniform1f(this.loc.uWingInk, wingInk);
      gl.uniform3f(this.loc.uLight, light[0], light[1], light[2]);

      gl.drawArrays(gl.TRIANGLES, 0, this.vertCount);
    }
  }

  window.FoldGL = { FoldStage, W, H };
})();
