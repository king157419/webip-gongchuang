/* v17-slice · gl.js —— 手写 WebGL1
 * 物体由若干"凸的闭合网格"（圆角盒 / 圆柱 / 椭球）拼成，顶面一张贴图。
 * 切开：两半共用同一套网格，各带一个裁切平面（片元里 discard）。
 * 透过切口看见的是网格"背面"，按视线与切面的交点去上色 —— 看起来就是实心的截面
 * （芯片里有硅片和引线框，电路板是一层层的铜和玻纤）。 */
(function () {
  'use strict';

  /* ---------- 3×3 旋转（行主序） ---------- */
  const M3 = {
    mul(a, b) {
      const o = new Array(9);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
      return o;
    },
    x(t) { const c = Math.cos(t), s = Math.sin(t); return [1, 0, 0, 0, c, -s, 0, s, c]; },
    y(t) { const c = Math.cos(t), s = Math.sin(t); return [c, 0, s, 0, 1, 0, -s, 0, c]; },
    z(t) { const c = Math.cos(t), s = Math.sin(t); return [c, -s, 0, s, c, 0, 0, 0, 1]; },
    axis(a, t) {
      const x = a[0], y = a[1], z = a[2], c = Math.cos(t), s = Math.sin(t), k = 1 - c;
      return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
    },
    ap(m, v) { return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]; },
    apT(m, v) { return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; },
    euler(p) { return M3.mul(M3.y(p.yaw), M3.mul(M3.x(p.pitch), M3.z(p.roll))); },
    col(m) { return new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]); }
  };

  /* ---------- 网格生成 ---------- */
  function Geo() { this.p = []; this.n = []; this.m = []; this.i = []; }
  Geo.prototype.v = function (p, n, m) {
    this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.m.push(m);
    return this.p.length / 3 - 1;
  };
  // 圆角盒：c 中心，h 半边长，r 圆角，q 每段圆角细分
  Geo.prototype.box = function (c, h, r, m, q) {
    q = q || 3;
    const S = h.map((hh) => {
      if (r <= 0) return [-hh, hh];
      const ir = hh - r, a = [];
      for (let j = q; j >= 1; j--) a.push(-ir - r * Math.tan(j / q * Math.PI / 4));
      a.push(-ir, ir);
      for (let j = 1; j <= q; j++) a.push(ir + r * Math.tan(j / q * Math.PI / 4));
      return a;
    });
    for (let a = 0; a < 3; a++) for (const sg of [1, -1]) {
      const u = (a + 1) % 3, w = (a + 2) % 3, su = S[u], sw = S[w], base = this.p.length / 3, W = sw.length;
      for (let i = 0; i < su.length; i++) for (let j = 0; j < W; j++) {
        const p = [0, 0, 0]; p[a] = sg * h[a]; p[u] = su[i]; p[w] = sw[j];
        let pos, nn;
        if (r <= 0) { pos = p; nn = [0, 0, 0]; nn[a] = sg; }
        else {
          const inn = p.map((x, k) => Math.max(-(h[k] - r), Math.min(h[k] - r, x)));
          const d = [p[0] - inn[0], p[1] - inn[1], p[2] - inn[2]], l = Math.hypot(d[0], d[1], d[2]);
          nn = d.map((x) => x / l); pos = inn.map((x, k) => x + nn[k] * r);
        }
        this.v([pos[0] + c[0], pos[1] + c[1], pos[2] + c[2]], nn, m);
      }
      for (let i = 0; i < su.length - 1; i++) for (let j = 0; j < W - 1; j++) {
        const A = base + i * W + j, B = A + W, C = B + 1, D = A + 1;
        if (sg > 0) this.i.push(A, B, C, A, C, D); else this.i.push(A, C, B, A, D, C);
      }
    }
  };
  // 圆柱（轴向 z）
  Geo.prototype.cyl = function (c, R, hz, m, seg) {
    seg = seg || 28;
    for (const sg of [1, -1]) {
      const ctr = this.v([c[0], c[1], c[2] + sg * hz], [0, 0, sg], m), b = this.p.length / 3;
      for (let k = 0; k < seg; k++) { const t = k / seg * Math.PI * 2; this.v([c[0] + R * Math.cos(t), c[1] + R * Math.sin(t), c[2] + sg * hz], [0, 0, sg], m); }
      for (let k = 0; k < seg; k++) { const a = b + k, bb = b + (k + 1) % seg; if (sg > 0) this.i.push(ctr, a, bb); else this.i.push(ctr, bb, a); }
    }
    const b = this.p.length / 3;
    for (let k = 0; k <= seg; k++) {
      const t = k / seg * Math.PI * 2, cs = Math.cos(t), sn = Math.sin(t);
      this.v([c[0] + R * cs, c[1] + R * sn, c[2] + hz], [cs, sn, 0], m);
      this.v([c[0] + R * cs, c[1] + R * sn, c[2] - hz], [cs, sn, 0], m);
    }
    for (let k = 0; k < seg; k++) { const a = b + k * 2; this.i.push(a + 1, a + 3, a + 2, a + 1, a + 2, a); }
  };
  // 椭球（焊点）
  Geo.prototype.ell = function (c, r, m) {
    const sl = 14, st = 8, b = this.p.length / 3, W = sl + 1;
    for (let i = 0; i <= st; i++) {
      const ph = i / st * Math.PI, sp = Math.sin(ph), cp = Math.cos(ph);
      for (let j = 0; j <= sl; j++) {
        const th = j / sl * Math.PI * 2, x = sp * Math.cos(th), y = sp * Math.sin(th), z = cp;
        const n = [x / r[0], y / r[1], z / r[2]], l = Math.hypot(n[0], n[1], n[2]);
        this.v([c[0] + x * r[0], c[1] + y * r[1], c[2] + z * r[2]], [n[0] / l, n[1] / l, n[2] / l], m);
      }
    }
    for (let i = 0; i < st; i++) for (let j = 0; j < sl; j++) { const a = b + i * W + j, bb = a + W; this.i.push(a, bb, bb + 1, a, bb + 1, a + 1); }
  };

  /* ---------- 着色器 ---------- */
  const VS = `
attribute vec3 aP; attribute vec3 aN; attribute float aM;
uniform mat4 uProj; uniform vec3 uEye; uniform mat3 uR; uniform vec3 uT; uniform float uS;
uniform vec4 uCol[8]; uniform vec4 uPar[8];
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying vec3 vNL; varying vec4 vC; varying vec4 vPr;
void main(){
  int m = int(aM + 0.5);
  vC = uCol[m]; vPr = uPar[m];
  vL = aP; vNL = aN;
  vec3 w = uT + uS * (uR * aP);
  vW = w; vN = uR * aN;
  gl_Position = uProj * vec4(w - uEye, 1.0);
}`;
  const FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec3 vL; varying vec3 vW; varying vec3 vN; varying vec3 vNL; varying vec4 vC; varying vec4 vPr;
uniform vec4 uPlane; uniform float uSide; uniform float uHeat; uniform float uTopZ;
uniform vec3 uEye; uniform vec3 uEyeL; uniform vec3 uT; uniform mat3 uR; uniform float uS;
uniform sampler2D uTex; uniform vec2 uTH;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec3 env(vec3 r){
  vec3 c = mix(vec3(.012,.012,.014), vec3(.15,.15,.16), smoothstep(-.5,.2,r.y));
  c += vec3(1.,.96,.9) * smoothstep(.45,.9,r.y) * 1.2;
  c += vec3(.85,.92,1.) * exp(-pow((r.x+.62)*4.5,2.)) * smoothstep(-.25,.45,r.y) * .9;
  c += vec3(1.,.56,.3) * exp(-pow((r.x-.82)*5.,2.)) * smoothstep(-.45,.3,r.y) * .3;
  return c;
}
vec3 shade(vec3 a, vec3 n, vec3 p, float g, float sp, float mt){
  vec3 v = normalize(uEye - p);
  float nv = clamp(dot(n, v), 0., 1.);
  vec3 L1 = normalize(vec3(-.55,.78,.62)), L2 = normalize(vec3(.85,-.12,.45));
  float d1 = max(dot(n, L1), 0.), d2 = max(dot(n, L2), 0.);
  vec3 dif = a * (vec3(.07,.074,.085) + d1 * vec3(1.,.95,.88) * 1.2 + d2 * vec3(.32,.4,.55));
  float pw = exp2(1. + g * 10.);
  float s1 = pow(max(dot(n, normalize(L1 + v)), 0.), pw) * (pw + 8.) / 60.;
  float s2 = pow(max(dot(n, normalize(L2 + v)), 0.), pw) * (pw + 8.) / 60. * .35;
  float fr = pow(1. - nv, 5.);
  vec3 f0 = mix(vec3(.04), a, mt);
  vec3 F = f0 + (1. - f0) * fr * (1. - mt * .4);
  vec3 e = mix(vec3(.13), env(reflect(-v, n)), g * g * .9 + .1);
  return dif * (1. - mt) + F * sp * (e + (s1 + s2) * vec3(1.,.96,.9));
}
vec3 cap(float ct, vec3 P, vec3 base, inout float g, inout float mt){
  float nz = hash(floor(P.xy * 160.) + floor(P.z * 160.) * 7.);
  if (ct < .5) {
    if (abs(P.x) < .42 && abs(P.y) < .42 && P.z > -.022 && P.z < .03) { g = .85; mt = .9; return vec3(.6,.63,.7); }
    if (abs(P.x) < .56 && abs(P.y) < .56 && P.z > -.06 && P.z < -.022) { g = .6; mt = 1.; return vec3(.86,.55,.36); }
    g = .25; return vec3(.16,.16,.165) * (.75 + .5 * nz);
  }
  if (ct < 1.5) {
    float z = abs(P.z);
    if (z > .037) { g = .5; return vec3(.07,.27,.16); }
    if (z > .029) { g = .7; mt = 1.; return vec3(.9,.56,.34); }
    if (abs(z - .01) < .003) { g = .7; mt = 1.; return vec3(.9,.56,.34); }
    g = .25; return vec3(.72,.62,.4) * (.82 + .18 * sin(P.x * 240. + P.y * 240.) * sin(P.z * 700.)) * (.9 + .2 * nz);
  }
  if (ct < 2.5) { g = .45; mt = .55; return min(base * 1.12, vec3(1.)) * (.94 + .1 * nz); }
  if (ct < 3.5) { g = .35; return vec3(.93,.92,.89) * (.96 + .05 * nz); }
  if (ct < 4.5) { g = .3; return base * .9 * (.85 + .3 * nz); }
  float zz = P.z + .12;
  if (abs(zz) > .042) { g = .45; return vec3(.12,.15,.09); }
  if (fract(zz * 55.) > .8) { g = .7; mt = 1.; return vec3(.88,.56,.34); }
  g = .3; return vec3(.24,.22,.14) * (.8 + .4 * nz);
}
vec3 srgb(vec3 c){ return c * c * (.3 + .7 * c); }
void main(){
  float sd = dot(vL, uPlane.xyz) - uPlane.w;
  if (uSide != 0. && uSide * sd < 0.) discard;
  vec3 col;
  float g = vPr.x, sp = vPr.y, mt = vPr.z;
  if (gl_FrontFacing) {
    vec3 a = vC.rgb;
    if (vC.a > .5 && vNL.z > .6 && vL.z > uTopZ) {
      vec4 t = texture2D(uTex, vL.xy / (2. * uTH) + .5);
      a = srgb(t.rgb); mt = t.a; g = mix(g, .82, t.a);
    }
    col = shade(a, normalize(vN), vW, g, sp, mt);
    if (uSide != 0.) col += vec3(1.,.5,.2) * uHeat * smoothstep(.035, 0., abs(sd)) * 2.;
  } else {
    vec3 d = normalize(vL - uEyeL);
    float t = (uPlane.w - dot(uPlane.xyz, uEyeL)) / dot(uPlane.xyz, d);
    vec3 P = uEyeL + d * t;
    g = .35; mt = 0.;
    vec3 a = srgb(cap(vPr.w, P, pow(vC.rgb, vec3(.42)), g, mt));
    vec3 n = normalize(uR * (-uSide * uPlane.xyz));
    col = shade(a, n, uT + uS * (uR * P), g, 1., mt);
    col += vec3(1.,.4,.1) * uHeat * .9;
  }
  col = 1. - exp(-col * 1.4);
  gl_FragColor = vec4(sqrt(col), 1.);
}`;

  const lin = (c) => c.map((x) => x * x * (0.3 + 0.7 * x));

  function Renderer(canvas) {
    const gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, powerPreference: 'high-performance' }) ||
      canvas.getContext('experimental-webgl', { alpha: true, antialias: true });
    if (!gl) throw new Error('no webgl');
    const sh = (type, src) => {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const U = {};
    ['uProj', 'uEye', 'uR', 'uT', 'uS', 'uCol', 'uPar', 'uPlane', 'uSide', 'uHeat', 'uTopZ', 'uEyeL', 'uTex', 'uTH'].forEach((n) => {
      U[n] = gl.getUniformLocation(pr, n === 'uCol' || n === 'uPar' ? n + '[0]' : n);
    });
    const A = { p: gl.getAttribLocation(pr, 'aP'), n: gl.getAttribLocation(pr, 'aN'), m: gl.getAttribLocation(pr, 'aM') };
    gl.enable(gl.DEPTH_TEST);
    gl.clearColor(0, 0, 0, 0);
    gl.uniform1i(U.uTex, 0);
    gl.uniform3f(U.uEye, 0, 0, 10);
    this.gl = gl; this.U = U; this.A = A; this.cv = canvas;
    this.fov = 30 * Math.PI / 180; this.eyeZ = 10;
    this.w = 1; this.h = 1;
  }
  Renderer.prototype.size = function (w, h, dpr) {
    const c = this.cv, W = Math.round(w * dpr), Hh = Math.round(h * dpr);
    if (c.width !== W || c.height !== Hh) { c.width = W; c.height = Hh; }
    this.w = w; this.h = h;
    const f = 1 / Math.tan(this.fov / 2), asp = w / h, n = 1, fa = 40;
    this.f = f; this.asp = asp;
    this.gl.viewport(0, 0, W, Hh);
    this.gl.uniformMatrix4fv(this.U.uProj, false, new Float32Array([f / asp, 0, 0, 0, 0, f, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, 2 * fa * n / (n - fa), 0]));
  };
  // 世界坐标 → 屏幕像素
  Renderer.prototype.project = function (p) {
    const z = this.eyeZ - p[2];
    return [((this.f / this.asp) * p[0] / z * 0.5 + 0.5) * this.w, (0.5 - (this.f * p[1] / z) * 0.5) * this.h];
  };
  // 屏幕像素 → 在深度 wz 的平面上的世界坐标
  Renderer.prototype.unproject = function (sx, sy, wz) {
    const z = this.eyeZ - (wz || 0), nx = sx / this.w * 2 - 1, ny = 1 - sy / this.h * 2;
    return [nx * z * this.asp / this.f, ny * z / this.f, wz || 0];
  };
  Renderer.prototype.pxPerUnit = function () { return this.h / (2 * this.eyeZ * Math.tan(this.fov / 2)); };
  Renderer.prototype.clear = function () { const gl = this.gl; gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); };

  Renderer.prototype.object = function (geo, mats, tex, opt) {
    const gl = this.gl, nV = geo.p.length / 3, data = new Float32Array(nV * 7);
    for (let k = 0; k < nV; k++) {
      data.set([geo.p[k * 3], geo.p[k * 3 + 1], geo.p[k * 3 + 2], geo.n[k * 3], geo.n[k * 3 + 1], geo.n[k * 3 + 2], geo.m[k]], k * 7);
    }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.i), gl.STATIC_DRAW);
    const col = new Float32Array(32), par = new Float32Array(32);
    mats.forEach((m, k) => { col.set(lin(m.c).concat([m.t ? 1 : 0]), k * 4); par.set([m.g, m.s == null ? 1 : m.s, m.m || 0, m.k], k * 4); });
    const o = { vb, ib, count: geo.i.length, col, par, tex: null, th: opt.th, topZ: opt.topZ, span: opt.span, rad: opt.rad, crumb: opt.crumb };
    this.setTex(o, tex);
    return o;
  };
  Renderer.prototype.setTex = function (o, img) {
    if (!img) return;
    const gl = this.gl;
    if (!o.tex) o.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, o.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  };
  // st: { R(3×3), T[3], s, plane[4] 物体局部坐标, side(0/±1), heat }
  Renderer.prototype.draw = function (o, st) {
    const gl = this.gl, U = this.U, A = this.A, R = st.R, T = st.T, s = st.s;
    gl.bindBuffer(gl.ARRAY_BUFFER, o.vb); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, o.ib);
    gl.enableVertexAttribArray(A.p); gl.vertexAttribPointer(A.p, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(A.n); gl.vertexAttribPointer(A.n, 3, gl.FLOAT, false, 28, 12);
    gl.enableVertexAttribArray(A.m); gl.vertexAttribPointer(A.m, 1, gl.FLOAT, false, 28, 24);
    gl.uniform4fv(U.uCol, o.col); gl.uniform4fv(U.uPar, o.par);
    gl.uniformMatrix3fv(U.uR, false, M3.col(R));
    gl.uniform3fv(U.uT, T); gl.uniform1f(U.uS, s);
    gl.uniform3fv(U.uEyeL, M3.apT(R, [-T[0] / s, -T[1] / s, (this.eyeZ - T[2]) / s]));
    const pl = st.plane || [0, 0, 1, 99];
    gl.uniform4fv(U.uPlane, pl); gl.uniform1f(U.uSide, st.side || 0); gl.uniform1f(U.uHeat, st.heat || 0);
    gl.uniform1f(U.uTopZ, o.topZ); gl.uniform2fv(U.uTH, o.th);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.tex);
    if (st.side) gl.disable(gl.CULL_FACE); else { gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); }
    gl.drawElements(gl.TRIANGLES, o.count, gl.UNSIGNED_SHORT, 0);
  };

  /* ---------- 顶面贴图（2D 画布画，alpha 通道 = 金属度） ---------- */
  function rnd(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  // W×H 像素，物体顶面半边长 hx×hy；draw(ctx, metalCtx) 用"厘单位"（1 = 0.01 物体单位，y 向下 = 物体 -y）
  function paint(W, H, hx, hy, draw) {
    const q = window.SliceGL.Q || 1; W = Math.round(W * q); H = Math.round(H * q);
    const a = document.createElement('canvas'), b = document.createElement('canvas');
    a.width = b.width = W; a.height = b.height = H;
    const ca = a.getContext('2d'), cb = b.getContext('2d');
    cb.fillStyle = '#000'; cb.fillRect(0, 0, W, H);
    [ca, cb].forEach((c) => c.setTransform(W / (2 * hx) / 100, 0, 0, H / (2 * hy) / 100, W / 2, H / 2));
    draw(ca, cb);
    const A = ca.getImageData(0, 0, W, H), B = cb.getImageData(0, 0, W, H);
    for (let k = 3; k < A.data.length; k += 4) A.data[k] = B.data[k - 1];
    return A;
  }
  const SERIF = '"SHU Serif", "Noto Serif SC", "Songti SC", serif';
  function grainFill(c, x, y, w, h, base, amt, seed, n) {
    c.fillStyle = base; c.fillRect(x, y, w, h);
    const r = rnd(seed);
    for (let k = 0; k < n; k++) {
      const v = r();
      c.fillStyle = v > 0.5 ? `rgba(255,255,255,${amt * (v - 0.5)})` : `rgba(0,0,0,${amt * (0.5 - v)})`;
      c.fillRect(x + r() * w, y + r() * h, 0.6 + r() * 0.9, 0.6 + r() * 0.9);
    }
  }
  function rr(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }

  /* ---------- 四个物体 ---------- */
  const OBJ = {};
  // ② 芯片：QFP 封装，黑色环氧 + 48 根鸥翼引脚
  OBJ.chip = function (R, label) {
    const g = new Geo();
    g.box([0, 0, 0], [0.95, 0.95, 0.13], 0.05, 0, 3);
    const rot = (s, x, y) => [[x, y], [-y, x], [-x, -y], [y, -x]][s];
    for (let s = 0; s < 4; s++) for (let i = 0; i < 12; i++) {
      const y = -0.8 + i * (1.6 / 11);
      [[0.99, -0.005, 0.06, 0.014], [1.065, -0.07, 0.016, 0.07], [1.14, -0.135, 0.07, 0.013]].forEach((b) => {
        const c = rot(s, b[0], y), odd = s % 2;
        g.box([c[0], c[1], b[1]], odd ? [0.028, b[2], b[3]] : [b[2], 0.028, b[3]], 0, 1);
      });
    }
    const tex = paint(1024, 1024, 0.95, 0.95, (c, m) => {
      grainFill(c, -95, -95, 190, 190, '#19191a', 0.16, 7, 5000);
      // 引脚 1 标记：一个压下去的小圆坑
      const gr = c.createRadialGradient(-68, 66, 0, -68, 66, 9);
      gr.addColorStop(0, '#0d0d0e'); gr.addColorStop(0.75, '#141415'); gr.addColorStop(0.9, '#2a2a2b'); gr.addColorStop(1, '#19191a');
      c.fillStyle = gr; c.beginPath(); c.arc(-68, 66, 9, 0, 7); c.fill();
      // 激光刻字
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#929296'; c.font = `900 ${label.length > 4 ? 30 : 40}px ${SERIF}`;
      c.fillText(label, 0, -8);
      c.fillStyle = '#58585b'; c.font = `400 8.5px ${SERIF}`; c.fillText('上海大学人工智能社', 0, 24);
      c.fillStyle = '#4d4d50'; c.font = `400 6.5px ${SERIF}`; c.fillText('2021 年成立', 0, 38);
      c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 0.6; c.strokeRect(-88, -88, 176, 176);
    });
    return R.object(g, [
      { c: [0.11, 0.11, 0.115], t: 1, g: 0.32, s: 0.7, k: 0 },
      { c: [0.8, 0.81, 0.82], g: 0.66, m: 1, k: 2 }
    ], tex, { th: [0.95, 0.95], topZ: 0.1, span: 2.42, rad: 1.2, crumb: ['#2b2b2d', '#c9cbcd'] });
  };

  // ③ 焊好的电路板
  OBJ.pcb = function (R, label) {
    const g = new Geo(), z0 = 0.045;
    g.box([0, 0, 0], [1.35, 0.9, z0], 0.018, 0, 2);
    // SOIC 芯片
    g.box([0.62, 0.38, z0 + 0.075], [0.3, 0.19, 0.06], 0.02, 2, 2);
    [-0.19, -0.063, 0.063, 0.19].forEach((dx) => [1, -1].forEach((sg) => {
      g.box([0.62 + dx, 0.38 + sg * 0.235, z0 + 0.065], [0.024, 0.05, 0.011], 0, 1);
      g.box([0.62 + dx, 0.38 + sg * 0.3, z0 + 0.014], [0.024, 0.035, 0.012], 0, 1);
      g.ell([0.62 + dx, 0.38 + sg * 0.31, z0], [0.038, 0.05, 0.024], 1);
    }));
    // 电解电容
    [[-0.98, 0.45, 0.18, 0.24], [-0.55, 0.56, 0.12, 0.17]].forEach((p) => {
      g.cyl([p[0], p[1], z0 + p[3]], p[2], p[3], 3, 30);
      g.cyl([p[0], p[1], z0 + 2 * p[3] + 0.006], p[2] * 0.9, 0.007, 4, 30);
    });
    // 贴片电阻
    [0.62, 0.38, 0.14].forEach((y) => {
      g.box([-0.12, y, z0 + 0.03], [0.1, 0.05, 0.03], 0.006, 2, 1);
      [-1, 1].forEach((sg) => {
        g.box([-0.12 + sg * 0.115, y, z0 + 0.031], [0.02, 0.052, 0.031], 0, 1);
        g.ell([-0.12 + sg * 0.14, y, z0], [0.035, 0.06, 0.02], 1);
      });
    });
    // 排针
    g.box([0.62, -0.62, z0 + 0.05], [0.38, 0.065, 0.05], 0.01, 5, 1);
    for (let k = 0; k < 6; k++) g.box([0.31 + k * 0.124, -0.62, z0 + 0.17], [0.019, 0.019, 0.17], 0, 6);
    // 一排插件焊点
    for (let k = 0; k < 5; k++) g.ell([-1.12 + k * 0.13, -0.74, z0], [0.045, 0.045, 0.03], 1);
    const tex = paint(2048, 1024, 1.35, 0.9, (c, m) => {
      const L = (x, y) => [x * 100, -y * 100];
      const gr = c.createLinearGradient(-135, -90, 135, 90);
      gr.addColorStop(0, '#123a27'); gr.addColorStop(1, '#0f3121');
      c.fillStyle = gr; c.fillRect(-135, -90, 270, 180);
      // 走线
      c.strokeStyle = '#1d5539'; c.lineCap = 'round'; c.lineJoin = 'round';
      const r = rnd(42);
      const tr = (pts, w) => { c.lineWidth = w; c.beginPath(); pts.forEach((p, k) => { const q = L(p[0], p[1]); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); }); c.stroke(); };
      [-0.19, -0.063, 0.063, 0.19].forEach((dx, k) => {
        tr([[0.62 + dx, 0.07], [0.62 + dx, -0.05 - k * 0.06], [0.31 + k * 0.124 + 0.12, -0.3 - k * 0.04], [0.31 + k * 0.124 + 0.12, -0.55]], 2.4);
        tr([[0.62 + dx, 0.69], [0.62 + dx, 0.78], [1.2, 0.78 - k * 0.0]], 2);
      });
      [0.62, 0.38, 0.14].forEach((y, k) => { tr([[0.02, y], [0.18, y], [0.25 + k * 0.03, y - 0.1], [0.25 + k * 0.03, 0.2 - k * 0.12], [0.32, 0.2 - k * 0.12]], 2.2); tr([[-0.26, y], [-0.4, y], [-0.55 + k * 0.05, y - 0.18]], 2.2); });
      for (let k = 0; k < 5; k++) tr([[-1.12 + k * 0.13, -0.74], [-1.12 + k * 0.13, -0.86 + 0.0], [0.2 + k * 0.1, -0.86], [0.31 + k * 0.124, -0.72]], 2);
      tr([[-0.98, 0.2], [-0.98, 0.05], [-0.6, 0.05], [-0.4, -0.12], [1.25, -0.12]], 3.2);
      for (let k = 0; k < 18; k++) { const x = -1.3 + r() * 2.6, y = -0.85 + r() * 1.7; tr([[x, y], [x + (r() - 0.5) * 0.3, y + (r() - 0.5) * 0.3]], 1.6); }
      // 焊盘（金色，金属度 = 1）
      const pad = (x, y, w, h, round) => {
        const q = L(x, y);
        [c, m].forEach((k, i) => {
          k.fillStyle = i ? '#fff' : '#c9a24e';
          if (round) { k.beginPath(); k.arc(q[0], q[1], w, 0, 7); k.fill(); } else k.fillRect(q[0] - w, q[1] - h, w * 2, h * 2);
        });
      };
      [-0.19, -0.063, 0.063, 0.19].forEach((dx) => [1, -1].forEach((sg) => pad(0.62 + dx, 0.38 + sg * 0.31, 3.6, 5.4)));
      [0.62, 0.38, 0.14].forEach((y) => [-1, 1].forEach((sg) => pad(-0.12 + sg * 0.14, y, 4.2, 6.2)));
      for (let k = 0; k < 6; k++) pad(0.31 + k * 0.124, -0.62, 4.6, 0, true);
      for (let k = 0; k < 5; k++) pad(-1.12 + k * 0.13, -0.74, 5.5, 0, true);
      for (let k = 0; k < 14; k++) { const x = -1.25 + r() * 2.5, y = -0.8 + r() * 1.6; pad(x, y, 1.7, 0, true); const q = L(x, y); c.fillStyle = '#0a1a12'; c.beginPath(); c.arc(q[0], q[1], 0.8, 0, 7); c.fill(); }
      // 丝印
      c.strokeStyle = 'rgba(236,233,220,.85)'; c.fillStyle = 'rgba(236,233,220,.92)'; c.lineWidth = 1.1;
      const q1 = L(0.62 - 0.36, 0.38 + 0.24); c.strokeRect(q1[0], q1[1], 72, 48);
      c.beginPath(); const q2 = L(0.62 - 0.3, 0.38 + 0.15); c.arc(q2[0], q2[1], 2, 0, 7); c.fill();
      [[-0.98, 0.45, 21], [-0.55, 0.56, 15]].forEach((p) => { const q = L(p[0], p[1]); c.beginPath(); c.arc(q[0], q[1], p[2], 0, 7); c.stroke(); c.fillText('+', q[0] - p[2] - 6, q[1] - p[2] + 4); });
      const q3 = L(0.62 - 0.42, -0.62 + 0.1); c.strokeRect(q3[0], q3[1], 84, 20);
      c.textBaseline = 'alphabetic'; c.textAlign = 'left';
      c.font = `900 33px ${SERIF}`; const q4 = L(-1.24, -0.42); c.fillText(label, q4[0], q4[1]);
      c.font = `400 8px ${SERIF}`; const q5 = L(-1.24, -0.55); c.fillText('上海大学人工智能社 · 焊接课', q5[0], q5[1]);
      c.lineWidth = 0.8; c.beginPath(); const q6 = L(-1.24, -0.495), q7 = L(-0.1, -0.495); c.moveTo(q6[0], q6[1]); c.lineTo(q7[0], q7[1]); c.stroke();
      // 安装孔
      [[-1.24, 0.79], [1.24, 0.79], [-1.24, -0.79], [1.24, -0.79]].forEach((p) => { pad(p[0], p[1], 6, 0, true); const q = L(p[0], p[1]); c.fillStyle = '#070b09'; c.beginPath(); c.arc(q[0], q[1], 3.6, 0, 7); c.fill(); });
    });
    return R.object(g, [
      { c: [0.07, 0.24, 0.15], t: 1, g: 0.58, s: 0.8, k: 1 },
      { c: [0.84, 0.85, 0.86], g: 0.85, m: 1, k: 2 },
      { c: [0.1, 0.1, 0.105], g: 0.3, s: 0.6, k: 0 },
      { c: [0.09, 0.12, 0.2], g: 0.62, s: 0.9, k: 4 },
      { c: [0.78, 0.79, 0.81], g: 0.55, m: 1, k: 2 },
      { c: [0.07, 0.07, 0.075], g: 0.35, s: 0.6, k: 4 },
      { c: [0.88, 0.7, 0.36], g: 0.78, m: 1, k: 2 }
    ], tex, { th: [1.35, 0.9], topZ: 0.035, span: 2.75, rad: 1.25, crumb: ['#c7b07a', '#174a30'] });
  };

  // ④ 企业参访的工牌（印着小智）
  OBJ.badge = function (R, label, zhiImg) {
    const g = new Geo();
    g.box([0, 0, 0], [0.78, 1.12, 0.035], 0.03, 0, 2);
    g.box([0, 1.17, 0], [0.15, 0.08, 0.05], 0.025, 1, 2);
    g.box([0, 1.27, 0], [0.055, 0.04, 0.03], 0.012, 1, 1);
    const tex = paint(1024, 2048, 0.78, 1.12, (c) => {
      const gr = c.createLinearGradient(0, -112, 0, 112);
      gr.addColorStop(0, '#f1f0ec'); gr.addColorStop(1, '#e6e4de');
      c.fillStyle = gr; c.fillRect(-78, -112, 156, 224);
      c.fillStyle = '#0b61bc'; c.fillRect(-78, -112, 156, 58);
      // 挂绳槽
      rr(c, -19, -101, 38, 8, 4); c.fillStyle = '#0a0e15'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.6; rr(c, -19.5, -101.5, 39, 9, 4.5); c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
      c.font = `400 9.6px ${SERIF}`; c.fillText('上海大学人工智能社', 0, -71);
      // 小智头像
      c.save(); c.beginPath(); c.arc(0, -8, 33, 0, 7); c.fillStyle = '#e3ebf4'; c.fill(); c.clip();
      if (zhiImg && zhiImg.width) c.drawImage(zhiImg, -30, -38, 60, 60);
      c.restore();
      c.strokeStyle = '#c9ced6'; c.lineWidth = 0.8; c.beginPath(); c.arc(0, -8, 33, 0, 7); c.stroke();
      c.fillStyle = '#151515'; c.font = `900 ${label.length > 4 ? 22 : 26}px ${SERIF}`; c.fillText(label, 0, 49);
      c.fillStyle = '#9a988f'; c.fillRect(-46, 66, 92, 0.6);
      c.fillStyle = '#6b6961'; c.font = `400 7.4px ${SERIF}`; c.fillText('通信与信息工程学院团委', 0, 78);
      c.font = `400 6.4px ${SERIF}`; c.fillText('2021 年成立', 0, 92);
    });
    return R.object(g, [
      { c: [0.92, 0.91, 0.88], t: 1, g: 0.74, s: 0.9, k: 3 },
      { c: [0.74, 0.76, 0.78], g: 0.68, m: 1, k: 2 }
    ], tex, { th: [0.78, 1.12], topZ: 0.023, span: 2.5, rad: 1.15, crumb: ['#ecebe6', '#0b61bc'] });
  };

  // ⑤ 昇腾芯片样子的方块：基板 + 拉丝金属顶盖，刻着"加入"
  OBJ.lid = function (R, label) {
    const g = new Geo();
    g.box([0, 0, -0.12], [1.15, 1.15, 0.05], 0.02, 0, 2);
    g.box([0, 0, 0], [0.86, 0.86, 0.08], 0.06, 1, 4);
    [[1.0, 0.55], [1.0, -0.55], [-1.0, 0.55], [-1.0, -0.55], [0.55, 1.0], [-0.55, 1.0], [0.55, -1.0], [-0.55, -1.0], [1.0, 0], [-1.0, 0]].forEach((p) => {
      const v = Math.abs(p[0]) > 0.9;
      g.box([p[0], p[1], -0.05], v ? [0.025, 0.05, 0.02] : [0.05, 0.025, 0.02], 0, 2);
      [-1, 1].forEach((sg) => g.box([p[0] + (v ? 0 : sg * 0.055), p[1] + (v ? sg * 0.055 : 0), -0.05], v ? [0.026, 0.012, 0.021] : [0.012, 0.026, 0.021], 0, 3));
    });
    const tex = paint(1024, 1024, 0.86, 0.86, (c, m) => {
      c.fillStyle = '#b4b7bb'; c.fillRect(-86, -86, 172, 172);
      const r = rnd(9);
      for (let k = 0; k < 1600; k++) {
        const y = -86 + r() * 172, v = r();
        c.fillStyle = v > 0.5 ? `rgba(255,255,255,${(v - 0.5) * 0.28})` : `rgba(40,42,46,${(0.5 - v) * 0.22})`;
        c.fillRect(-86, y, 172, 0.1 + r() * 0.22);
      }
      m.fillStyle = '#fff'; m.fillRect(-86, -86, 172, 172);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = `900 50px ${SERIF}`;
      c.fillStyle = 'rgba(255,255,255,.75)'; c.fillText(label, 0.6, -5.2);
      c.fillStyle = '#5f6267'; c.fillText(label, 0, -6);
      m.textAlign = 'center'; m.textBaseline = 'middle'; m.font = c.font; m.fillStyle = '#5a5a5a'; m.fillText(label, 0, -6);
      c.font = `400 7.6px ${SERIF}`; c.fillStyle = '#6a6d72'; c.fillText('上海大学人工智能社', 0, 34);
      c.fillStyle = '#7b7e83'; c.beginPath(); c.moveTo(-80, 80); c.lineTo(-68, 80); c.lineTo(-80, 68); c.fill();
    });
    return R.object(g, [
      { c: [0.17, 0.18, 0.12], g: 0.4, s: 0.6, k: 5 },
      { c: [0.74, 0.75, 0.77], t: 1, g: 0.55, s: 1, m: 1, k: 2 },
      { c: [0.6, 0.5, 0.34], g: 0.4, s: 0.6, k: 4 },
      { c: [0.82, 0.82, 0.83], g: 0.7, m: 1, k: 2 }
    ], tex, { th: [0.86, 0.86], topZ: 0.05, span: 2.4, rad: 1.2, crumb: ['#c4c7cb', '#3a3f2c'] });
  };

  window.SliceGL = { Renderer, M3, OBJ };
})();
