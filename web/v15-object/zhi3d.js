/* v15-object · 手写 WebGL1 3D「小智桌面机器人」引擎
 * 零外部依赖：过程化生成光滑曲面网格 + 2D Canvas 动态 LED 像素表情贴图 +
 * 半球柔和环境光 / 塑料陶瓷双高光 / 菲涅尔边缘光 / 接地软阴影。 */
(function () {
  'use strict';

  var API = {
    ok: false,
    setSection: function () {},
    setScrollTurn: function () {},
    setCardNudge: function () {},
    triggerExpr: function () {},
    hop: function () {},
    setVisible: function () {},
    renderOnce: function () {}
  };
  window.Zhi3D = API;

  var canvas = document.getElementById('bot-gl');
  if (!canvas) return;

  var REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  var gl = null;
  try {
    var opts = { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false };
    gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
  } catch (e) { gl = null; }

  if (!gl) {
    document.documentElement.classList.add('no-gl');
    return;
  }

  /* ---------- 1. 着色器 ---------- */
  var VS = [
    'attribute vec3 aPos;',
    'attribute vec3 aNorm;',
    'attribute vec2 aUV;',
    'uniform mat4 uProj;',
    'uniform mat4 uView;',
    'uniform mat4 uModel;',
    'varying vec3 vWorldPos;',
    'varying vec3 vLocalPos;',
    'varying vec3 vNorm;',
    'varying vec2 vUV;',
    'void main(){',
    '  vec4 wp = uModel * vec4(aPos, 1.0);',
    '  vWorldPos = wp.xyz;',
    '  vLocalPos = aPos;',
    '  vNorm = normalize((uModel * vec4(aNorm, 0.0)).xyz);',
    '  vUV = aUV;',
    '  gl_Position = uProj * uView * wp;',
    '}'
  ].join('\n');

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform int uMat;',
    'uniform vec3 uCamPos;',
    'uniform float uPulse;',
    'uniform vec2 uShadowShift;',
    'uniform sampler2D uLedTex;',
    'varying vec3 vWorldPos;',
    'varying vec3 vLocalPos;',
    'varying vec3 vNorm;',
    'varying vec2 vUV;',
    'void main(){',
    '  if(uMat == 4){',
    '    vec2 p = (vUV - 0.5) * 2.0 - uShadowShift;',
    '    vec2 fL = (p - vec2(-0.25, 0.02)) / vec2(0.28, 0.24);',
    '    vec2 fR = (p - vec2( 0.25, 0.02)) / vec2(0.28, 0.24);',
    '    vec2 bd = p / vec2(0.76, 0.62);',
    '    float aFoot = exp(-dot(fL, fL) * 2.3) + exp(-dot(fR, fR) * 2.3);',
    '    float aBody = exp(-dot(bd, bd) * 1.9);',
    '    float a = clamp(aBody * 0.17 + aFoot * 0.13, 0.0, 0.28);',
    '    a *= (1.0 - smoothstep(0.68, 1.0, length(p)));',
    '    vec3 sc = vec3(0.035, 0.075, 0.15);',
    '    gl_FragColor = vec4(sc * a, a);',
    '    return;',
    '  }',
    '  vec3 N = normalize(vNorm);',
    '  vec3 V = normalize(uCamPos - vWorldPos);',
    '  vec3 L1 = normalize(vec3(-0.48, 0.76, 0.68));',
    '  vec3 L2 = normalize(vec3(0.66, 0.24, 0.45));',
    '  float wrap1 = clamp((dot(N, L1) + 0.38) / 1.38, 0.0, 1.0);',
    '  float wrap2 = clamp((dot(N, L2) + 0.30) / 1.30, 0.0, 1.0);',
    '  float nv = clamp(dot(N, V), 0.0, 1.0);',
    '  float fres = pow(max(1.0 - nv, 1e-4), 3.1);',
    '  vec3 H1 = normalize(L1 + V);',
    '  vec3 H2 = normalize(L2 + V);',
    '  float nh1 = max(dot(N, H1), 1e-4);',
    '  float nh2 = max(dot(N, H2), 1e-4);',
    '  vec3 hemi = mix(vec3(0.70, 0.83, 0.96), vec3(1.0, 0.99, 0.97), N.y * 0.5 + 0.5);',
    '',
    '  if(uMat == 3){',
    '    vec3 core = mix(vec3(0.02, 0.78, 0.98), vec3(0.48, 0.99, 1.0), nv);',
    '    core += vec3(0.16, 0.22, 0.24) * uPulse;',
    '    core += vec3(0.85, 0.98, 1.0) * pow(nh1, 90.0) * 0.55;',
    '    gl_FragColor = vec4(clamp(core, 0.0, 1.0), 1.0);',
    '    return;',
    '  }',
    '',
    '  if(uMat == 2){',
    '    vec3 glass = vec3(0.036, 0.065, 0.215) * (0.72 + 0.28 * wrap1);',
    '    vec2 g = abs(fract(vUV * vec2(58.0, 26.0)) - 0.5);',
    '    float matrixDot = 1.0 - smoothstep(0.20, 0.44, max(g.x, g.y));',
    '    glass += vec3(0.008, 0.018, 0.048) * matrixDot;',
    '    vec4 led = texture2D(uLedTex, vUV);',
    '    float la = clamp(led.a, 0.0, 1.0);',
    '    glass = mix(glass, led.rgb * (1.0 + 0.05 * uPulse), la) + led.rgb * (la * 0.12);',
    '    vec3 Hg = normalize(normalize(vec3(-0.36, 0.88, 0.48)) + V);',
    '    float nhg = max(dot(N, Hg), 1e-4);',
    '    float coat = smoothstep(0.972, 0.995, nhg) * 0.36 + pow(nhg, 46.0) * 0.09 + pow(nh2, 48.0) * 0.06;',
    '    glass += vec3(0.86, 0.94, 1.0) * coat;',
    '    glass += vec3(0.16, 0.42, 0.82) * fres * 0.32;',
    '    gl_FragColor = vec4(clamp(glass, 0.0, 1.0), 1.0);',
    '    return;',
    '  }',
    '',
    '  vec3 albedo = (uMat == 0) ? vec3(0.265, 0.695, 0.985) : vec3(0.062, 0.318, 0.785);',
    '  vec3 deep   = (uMat == 0) ? vec3(0.135, 0.485, 0.845) : vec3(0.032, 0.175, 0.525);',
    '  vec3 col = mix(deep, albedo, wrap1 * 0.82 + 0.18);',
    '  col *= (0.76 + 0.28 * hemi);',
    '  col += albedo * wrap2 * 0.14;',
    '  float specBroad = pow(nh1, 24.0) * 0.17 + pow(nh2, 20.0) * 0.07;',
    '  float specClear = smoothstep(0.962, 0.992, nh1) * 0.34;',
    '  col += vec3(1.0, 0.995, 0.98) * (specBroad + specClear);',
    '  vec3 rimCol = (uMat == 0) ? vec3(0.76, 0.93, 1.0) : vec3(0.42, 0.76, 1.0);',
    '  col += rimCol * fres * 0.42;',
    '  if(uMat == 0 && vLocalPos.z > 0.25 && abs(vLocalPos.x) < 0.45){',
    '    float dChest = length(vLocalPos - vec3(0.0, -0.185, 0.67));',
    '    col += vec3(0.04, 0.45, 0.58) * exp(-dChest * dChest * 11.0) * (0.15 + 0.05 * uPulse);',
    '  }',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      return null;
    }
    return s;
  }

  var vs = compile(gl.VERTEX_SHADER, VS);
  var fs = compile(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { document.documentElement.classList.add('no-gl'); return; }

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    document.documentElement.classList.add('no-gl');
    return;
  }
  gl.useProgram(prog);

  var aPos = gl.getAttribLocation(prog, 'aPos');
  var aNorm = gl.getAttribLocation(prog, 'aNorm');
  var aUV = gl.getAttribLocation(prog, 'aUV');
  var U = {};
  ['uProj', 'uView', 'uModel', 'uMat', 'uCamPos', 'uPulse', 'uShadowShift', 'uLedTex'].forEach(function (k) {
    U[k] = gl.getUniformLocation(prog, k);
  });

  /* ---------- 2. 矩阵工具 ---------- */
  function mat4Identity() {
    return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]);
  }
  function mat4Mul(a, b) {
    var o = new Float32Array(16);
    for (var c = 0; c < 4; c++) {
      var b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
      o[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
      o[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
      o[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
      o[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
    }
    return o;
  }
  function mat4Perspective(fovRad, aspect, near, far) {
    var f = 1.0 / Math.tan(fovRad * 0.5), nf = 1.0 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, (2 * far * near) * nf, 0
    ]);
  }
  function mat4LookAt(ex, ey, ez, tx, ty, tz) {
    var zx = ex - tx, zy = ey - ty, zz = ez - tz;
    var zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
    var xx = zz, xy = 0, xz = -zx;
    var xl = Math.hypot(xx, xy, xz) || 1; xx /= xl; xz /= xl;
    var yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
    return new Float32Array([
      xx, yx, zx, 0,
      xy, yy, zy, 0,
      xz, yz, zz, 0,
      -(xx*ex + xy*ey + xz*ez), -(yx*ex + yy*ey + yz*ez), -(zx*ex + zy*ey + zz*ez), 1
    ]);
  }
  function mat4TRS(tx, ty, tz, rx, ry, rz) {
    var cx = Math.cos(rx), sx = Math.sin(rx);
    var cy = Math.cos(ry), sy = Math.sin(ry);
    var cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Ry * Rx * Rz
    var m00 = cy*cz + sy*sx*sz, m01 = cx*sz, m02 = -sy*cz + cy*sx*sz;
    var m10 = -cy*sz + sy*sx*cz, m11 = cx*cz, m12 = sy*sz + cy*sx*cz;
    var m20 = sy*cx, m21 = -sx, m22 = cy*cx;
    return new Float32Array([
      m00, m01, m02, 0,
      m10, m11, m12, 0,
      m20, m21, m22, 0,
      tx,  ty,  tz,  1
    ]);
  }

  /* ---------- 3. 过程化曲面网格构造 ---------- */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function makeSurface(uSeg, vSeg, evalPt, insideFn) {
    var cols = uSeg + 1, rows = vSeg + 1;
    var data = new Float32Array(cols * rows * 8);
    var idx = new Uint16Array(uSeg * vSeg * 6);
    var eps = 0.0018, ptr = 0;

    for (var j = 0; j < rows; j++) {
      var v = j / vSeg;
      var vSafe = clamp(v, 0.0025, 0.9975);
      for (var i = 0; i < cols; i++) {
        var u = i / uSeg;
        var p = evalPt(u, v);
        var pu1 = evalPt(u + eps, vSafe), pu0 = evalPt(u - eps, vSafe);
        var vp1 = Math.min(1, v + eps), vp0 = Math.max(0, v - eps);
        var pv1 = evalPt(u, vp1), pv0 = evalPt(u, vp0);

        var ux = pu1[0] - pu0[0], uy = pu1[1] - pu0[1], uz = pu1[2] - pu0[2];
        var vx = pv1[0] - pv0[0], vy = pv1[1] - pv0[1], vz = pv1[2] - pv0[2];
        var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
        var nl = Math.hypot(nx, ny, nz);
        if (nl < 1e-7) { nx = 0; ny = v > 0.5 ? 1 : -1; nz = 0; }
        else { nx /= nl; ny /= nl; nz /= nl; }

        if (insideFn) {
          var ins = insideFn(u, v, p);
          var dx = p[0] - ins[0], dy = p[1] - ins[1], dz = p[2] - ins[2];
          if (nx * dx + ny * dy + nz * dz < 0) { nx = -nx; ny = -ny; nz = -nz; }
        }

        data[ptr++] = p[0]; data[ptr++] = p[1]; data[ptr++] = p[2];
        data[ptr++] = nx;   data[ptr++] = ny;   data[ptr++] = nz;
        data[ptr++] = p[3] || 0; data[ptr++] = p[4] || 0;
      }
    }

    var ip = 0;
    for (var r = 0; r < vSeg; r++) {
      for (var c = 0; c < uSeg; c++) {
        var a = r * cols + c, b = a + 1, d = a + cols, e = d + 1;
        idx[ip++] = a; idx[ip++] = d; idx[ip++] = b;
        idx[ip++] = b; idx[ip++] = d; idx[ip++] = e;
      }
    }

    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

    var ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    return { vbo: vbo, ibo: ibo, count: idx.length };
  }

  // 小智身体截面函数（精确贴合三视图圆润胶囊比例）
  var BODY_H = 0.94;
  function bodyAxes(y) {
    var yn = clamp(y / BODY_H, -1, 1);
    var u2 = yn * yn;
    var c = Math.sqrt(Math.max(0, 1 - u2)) * (1 + 0.11 * u2 * (1 - u2));
    var belly = 1.0 - 0.046 * yn + 0.05 * Math.exp(-Math.pow((yn + 0.24) / 0.48, 2));
    return [0.80 * c * belly, 0.66 * c * belly];
  }
  function bodyZ(x, y) {
    var axz = bodyAxes(y);
    var q = clamp(x / Math.max(axz[0], 1e-4), -0.985, 0.985);
    return axz[1] * Math.sqrt(1 - q * q);
  }

  // 1) 主躯干
  var meshBody = makeSurface(52, 38, function (u, v) {
    var th = u * Math.PI * 2;
    var ph = (v - 0.5) * Math.PI;
    var y = BODY_H * Math.sin(ph);
    var axz = bodyAxes(y);
    return [axz[0] * Math.sin(th), y, axz[1] * Math.cos(th), u, v];
  }, function (u, v, p) { return [0, p[1] * 0.5, 0]; });

  // 跑道形面罩骨架（2D 中心 (0, 0.24)，平直半宽 HX=0.27）
  var VISOR_CY = 0.24, HX = 0.27, RMID = 0.242;
  var L_SEG = 2 * HX, L_ARC = Math.PI * RMID, L_TOT = 2 * L_SEG + 2 * L_ARC;
  function stadiumSpine(u) {
    var s = ((u % 1) + 1) % 1 * L_TOT;
    if (s < L_SEG) {
      var t1 = s / L_SEG;
      return [HX - 2 * HX * t1, 0, 0, 1];
    }
    s -= L_SEG;
    if (s < L_ARC) {
      var a1 = Math.PI * 0.5 + (s / L_ARC) * Math.PI;
      return [-HX, 0, Math.cos(a1), Math.sin(a1)];
    }
    s -= L_ARC;
    if (s < L_SEG) {
      var t2 = s / L_SEG;
      return [-HX + 2 * HX * t2, 0, 0, -1];
    }
    s -= L_SEG;
    var a2 = -Math.PI * 0.5 + (s / L_ARC) * Math.PI;
    return [HX, 0, Math.cos(a2), Math.sin(a2)];
  }

  // 2) 面罩深蓝边框
  var meshBezel = makeSurface(68, 14, function (u, v) {
    var sp = stadiumSpine(u);
    var beta = v * Math.PI;
    var rho = 0.244 - 0.041 * Math.cos(beta);
    var x = sp[0] + rho * sp[2];
    var y = VISOR_CY + sp[1] + rho * sp[3];
    var dz = 0.048 * Math.sin(beta) - 0.016 * (1 - Math.sin(beta));
    return [x, y, bodyZ(x, y) + dz, u, v];
  }, function (u, v) {
    var sp = stadiumSpine(u);
    var x = sp[0] + 0.244 * sp[2], y = VISOR_CY + sp[1] + 0.244 * sp[3];
    return [x, y, bodyZ(x, y) - 0.03];
  });

  // 3) 曲面玻璃 LED 屏幕（无退化缝正交跑道网格，保证表情贴图不拉伸不变形）
  var SCR_R = 0.218;
  var meshScreen = makeSurface(56, 20, function (u, v) {
    var su = Math.sin((u - 0.5) * Math.PI);
    var x = su * (HX + SCR_R) * 0.996;
    var dx = Math.max(0, Math.abs(x) - HX);
    var yMax = Math.sqrt(Math.max(1e-6, SCR_R * SCR_R - dx * dx));
    var sv = (v * 2 - 1) * 0.994;
    var y = VISOR_CY + sv * yMax;
    var dRim = clamp((SCR_R - Math.hypot(dx, y - VISOR_CY)) / SCR_R, 0, 1);
    var z = bodyZ(x, y) + 0.017 + 0.013 * Math.sqrt(dRim);
    var ut = (x + (HX + SCR_R)) / (2 * (HX + SCR_R));
    var vt = 1.0 - (y - VISOR_CY + SCR_R) / (2 * SCR_R);
    return [x, y, z, ut, vt];
  }, function () { return [0, VISOR_CY, 0]; });

  // 4) 胸口核心灯圈 + 发光圆钮
  var CHEST_Y = -0.185;
  var meshChestRim = makeSurface(32, 10, function (u, v) {
    var a = u * Math.PI * 2, beta = v * Math.PI;
    var r = 0.095 - 0.024 * Math.cos(beta);
    var x = r * Math.cos(a), y = CHEST_Y + r * Math.sin(a);
    var dz = 0.022 * Math.sin(beta) - 0.012 * (1 - Math.sin(beta));
    return [x, y, bodyZ(x, y) + dz, u, v];
  }, function (u) {
    var a = u * Math.PI * 2;
    var x = 0.095 * Math.cos(a), y = CHEST_Y + 0.095 * Math.sin(a);
    return [x, y, bodyZ(x, y) - 0.03];
  });

  var meshChestBtn = makeSurface(32, 8, function (u, v) {
    var a = u * Math.PI * 2, t = 0.01 + 0.99 * v, r = t * 0.079;
    var x = r * Math.cos(a), y = CHEST_Y + r * Math.sin(a);
    var dz = 0.012 + 0.024 * Math.cos(t * Math.PI * 0.5);
    return [x, y, bodyZ(x, y) + dz, u, v];
  }, function () { return [0, CHEST_Y, 0]; });

  // 5) 左右耳罩（局部朝向 +X，右侧直放，左侧绕 Y 转 180° 复用）
  function sgnPow(val, p) { return (val < 0 ? -1 : 1) * Math.pow(Math.abs(val), p); }
  var meshEar = makeSurface(38, 20, function (u, v) {
    var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI;
    var x = 0.135 * sgnPow(Math.sin(ph), 0.66);
    var r = Math.pow(Math.max(0, Math.cos(ph)), 0.68);
    return [x, 0.345 * r * Math.cos(th), 0.315 * r * Math.sin(th), u, v];
  }, function () { return [0, 0, 0]; });

  var meshEarGlow = makeSurface(30, 8, function (u, v) {
    var th = u * Math.PI * 2, t = 0.01 + 0.99 * v;
    var x = 0.128 + 0.024 * Math.cos(t * Math.PI * 0.5);
    return [x, 0.162 * t * Math.cos(th), 0.148 * t * Math.sin(th), u, v];
  }, function () { return [0, 0, 0]; });

  // 6) 头顶一体圆球触角（锥柱 + 圆球无缝过渡）
  var meshAntenna = makeSurface(28, 24, function (u, v) {
    var th = u * Math.PI * 2, r, y;
    var RB = 0.168, YC = 0.305, A0 = -Math.PI / 3;
    var yJoin = YC + RB * Math.sin(A0), rJoin = RB * Math.cos(A0);
    if (v < 0.42) {
      var k = v / 0.42;
      y = -0.05 + k * (yJoin + 0.05);
      r = 0.124 + (rJoin - 0.124) * Math.pow(k, 0.85);
    } else {
      var k2 = (v - 0.42) / 0.58;
      var ang = A0 + k2 * (Math.PI * 0.5 - A0);
      y = YC + RB * Math.sin(ang);
      r = RB * Math.cos(ang);
    }
    return [r * Math.cos(th), y, r * Math.sin(th), u, v];
  }, function (u, v, p) { return [0, Math.min(p[1], 0.305), 0]; });

  // 7) 可摆动小短手（局部原点在肩关节，向下延伸，圆润饱满）
  var meshArm = makeSurface(26, 18, function (u, v) {
    var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI;
    var sn = Math.sin(ph), cs = Math.cos(ph);
    var y = -0.16 + 0.255 * sn;
    var plump = 1.0 - 0.14 * sn;
    var r = Math.pow(Math.max(0, cs), 0.84) * plump;
    return [0.158 * r * Math.cos(th), y, 0.172 * r * Math.sin(th), u, v];
  }, function () { return [0, -0.16, 0]; });

  // 8) 圆润平底小短脚
  var meshFoot = makeSurface(28, 16, function (u, v) {
    var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI;
    var sn = Math.sin(ph), cs = Math.cos(ph);
    var y = sn < 0 ? sn * 0.105 : sn * 0.175;
    var r = Math.pow(Math.max(0, cs), 0.76);
    return [0.255 * r * Math.cos(th), y, 0.295 * r * Math.sin(th), u, v];
  }, function () { return [0, 0, 0]; });

  // 9) 接地软阴影平面
  var meshShadow = (function () {
    var S = 1.38, Y = -1.005;
    var d = new Float32Array([
      -S, Y, -S, 0, 1, 0, 0, 0,
       S, Y, -S, 0, 1, 0, 1, 0,
       S, Y,  S, 0, 1, 0, 1, 1,
      -S, Y,  S, 0, 1, 0, 0, 1
    ]);
    var ix = new Uint16Array([0, 2, 1, 0, 3, 2]);
    var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
    var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    return { vbo: vb, ibo: ib, count: 6 };
  })();

  /* ---------- 4. 2D Canvas 动态 LED 表情贴图（对标 zhi-expressions.webp） ---------- */
  var ledCv = document.createElement('canvas');
  ledCv.width = 512; ledCv.height = 228;
  var lctx = ledCv.getContext('2d');
  var ledTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, ledTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  function rrect(ctx, x, y, w, h, r) {
    var rr = Math.min(r, w * 0.5, h * 0.5);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
    ctx.fill();
  }

  var lastExprKey = '';
  function drawLedFace(expr, blink) {
    var key = expr + ':' + (blink ? '1' : '0');
    if (key === lastExprKey) return;
    lastExprKey = key;

    lctx.clearRect(0, 0, 512, 228);
    lctx.lineCap = 'round';
    lctx.lineJoin = 'round';

    var LX = 166, RX = 346, CY = 106;

    function drawArch(cx, cy, lw) {
      lctx.lineWidth = lw;
      lctx.beginPath();
      lctx.arc(cx, cy + 20, 32, Math.PI * 1.12, Math.PI * 1.88, false);
      lctx.stroke();
    }
    function drawBar(cx, cy, w, h) {
      rrect(lctx, cx - w * 0.5, cy - h * 0.5, w, h, h * 0.5);
    }
    function drawRing(cx, cy, r, lw) {
      lctx.lineWidth = lw;
      lctx.beginPath();
      lctx.arc(cx, cy, r, 0, Math.PI * 2);
      lctx.stroke();
    }
    function drawStarEye(cx, cy, lw) {
      drawRing(cx, cy, 20, lw * 0.85);
      var arm = 31, inner = 20;
      lctx.lineWidth = lw * 0.82;
      lctx.beginPath();
      lctx.moveTo(cx, cy - arm); lctx.lineTo(cx, cy - inner);
      lctx.moveTo(cx, cy + inner); lctx.lineTo(cx, cy + arm);
      lctx.moveTo(cx - arm, cy); lctx.lineTo(cx - inner, cy);
      lctx.moveTo(cx + inner, cy); lctx.lineTo(cx + arm, cy);
      lctx.stroke();
    }
    function drawChevron(cx, cy, dir, lw) {
      lctx.lineWidth = lw;
      lctx.beginPath();
      lctx.moveTo(cx - dir * 20, cy - 20);
      lctx.lineTo(cx + dir * 16, cy);
      lctx.lineTo(cx - dir * 20, cy + 20);
      lctx.stroke();
    }

    function paintEyes(lw, dotSz) {
      // 小智标志性外下侧小腮红点（与眼睛拉开足够间距，绝不粘连）
      rrect(lctx, 108 - dotSz * 0.5, 160 - dotSz * 0.5, dotSz, dotSz, dotSz * 0.35);
      rrect(lctx, 404 - dotSz * 0.5, 160 - dotSz * 0.5, dotSz, dotSz, dotSz * 0.35);

      if (blink) {
        drawBar(LX, CY + 4, 68, Math.max(6, lw * 0.68));
        drawBar(RX, CY + 4, 68, Math.max(6, lw * 0.68));
      } else if (expr === 'happy') {
        drawArch(LX, CY, lw);
        drawArch(RX, CY, lw);
      } else if (expr === 'wink') {
        drawArch(LX, CY, lw);
        drawBar(RX, CY + 2, 66, lw);
      } else if (expr === 'curious') {
        drawRing(LX, CY, 25, lw * 0.92);
        drawRing(RX, CY, 25, lw * 0.92);
      } else if (expr === 'sparkle') {
        drawStarEye(LX, CY, lw);
        drawStarEye(RX, CY, lw);
      } else if (expr === 'dizzy') {
        drawChevron(LX, CY, 1, lw * 0.92);
        drawChevron(RX, CY, -1, lw * 0.92);
      } else {
        // focus：专注平视横条眼（对应设定图右下气质）
        drawBar(LX, CY + 2, 66, lw);
        drawBar(RX, CY + 2, 66, lw);
      }
    }

    // 第 1 遍：青蓝 LED 本体 + 克制柔光边缘
    lctx.strokeStyle = '#12e6ff';
    lctx.fillStyle = '#12e6ff';
    lctx.shadowColor = 'rgba(0, 200, 255, 0.52)';
    lctx.shadowBlur = 7;
    paintEyes(17, 13);

    // 第 2 遍：高清晰度明亮灯芯核
    lctx.shadowBlur = 0;
    lctx.strokeStyle = '#b4ffff';
    lctx.fillStyle = '#b4ffff';
    paintEyes(8.5, 6.5);

    gl.bindTexture(gl.TEXTURE_2D, ledTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ledCv);
  }
  drawLedFace('happy', false);

  /* ---------- 5. 分区姿态与交互物理状态 ---------- */
  // 注：右臂位于 +X，armR[1] > 0 为向外张开/举起挥手；左臂位于 -X，armL[1] < 0 为向外张开/举起挥手
  var POSES = {
    hero:     { yaw: -0.24, pitch:  0.03, roll:  0.00, armL: [-0.22, -0.26], armR: [-0.25,  2.28], waveR: 1.0, expr: 'happy' },
    about:    { yaw:  0.26, pitch: -0.05, roll:  0.07, armL: [-0.20, -0.26], armR: [-1.18, -0.28], waveR: 0.18, expr: 'curious' },
    programs: { yaw: -0.18, pitch:  0.05, roll: -0.03, armL: [-0.25, -2.25], armR: [-0.25,  2.25], waveR: 0.65, expr: 'sparkle' },
    news:     { yaw:  0.34, pitch:  0.02, roll: -0.03, armL: [-0.24, -0.30], armR: [-0.48,  0.52], waveR: 0.25, expr: 'happy' },
    people:   { yaw: -0.26, pitch:  0.02, roll:  0.02, armL: [-0.20, -0.24], armR: [-0.30,  2.05], waveR: 0.35, expr: 'wink' },
    join:     { yaw: -0.16, pitch:  0.04, roll:  0.00, armL: [-0.25, -2.30], armR: [-0.25,  2.30], waveR: 1.1, expr: 'happy' }
  };

  var S = {
    sec: 'hero',
    yaw: -0.24, pitch: 0.03, roll: 0,
    armLX: -0.22, armLZ: -0.26, armRX: -0.25, armRZ: 2.28, waveAmt: 1.0,
    scrollTurn: 0, scrollTurnSmooth: 0,
    cardNudge: 0,
    userYaw: 0, userPitch: 0,
    velYaw: 0, velPitch: 0,
    dragging: false,
    hopY: 0, hopV: 0,
    antWobble: 0, antVel: 0,
    expr: 'happy', overrideExpr: '', overrideUntil: 0,
    nextBlink: 2.8, blinkEnd: 0,
    time: 0, last: 0,
    visible: true, pageVisible: !document.hidden,
    raf: 0
  };

  /* ---------- 6. 视口与渲染通道 ---------- */
  var W = 0, H = 0;
  var CAM = [0, 0.06, 5.15];
  var mProj = mat4Perspective(34 * Math.PI / 180, 1, 0.5, 20);
  var mView = mat4LookAt(CAM[0], CAM[1], CAM[2], 0, -0.03, 0);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, COARSE || innerWidth < 768 ? 1 : 1.5);
    var base = innerWidth < 768 ? 380 : 460;
    var nw = Math.round(base * dpr), nh = nw;
    if (canvas.width !== nw || canvas.height !== nh) {
      canvas.width = nw;
      canvas.height = nh;
      W = nw; H = nh;
    }
    gl.viewport(0, 0, W, H);
  }

  function bindDraw(mesh, matId, modelMat) {
    gl.uniform1i(U.uMat, matId);
    gl.uniformMatrix4fv(U.uModel, false, modelMat);
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(aNorm);
    gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 32, 24);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
    gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
  }

  function render() {
    if (!W) resize();

    var activeExpr = S.expr;
    if (Math.abs(S.velYaw) > 7.5) activeExpr = 'dizzy';
    else if (S.overrideExpr && S.time < S.overrideUntil) activeExpr = S.overrideExpr;
    var blinking = !REDUCE && S.time < S.blinkEnd;
    drawLedFace(activeExpr, blinking);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(prog);
    gl.uniformMatrix4fv(U.uProj, false, mProj);
    gl.uniformMatrix4fv(U.uView, false, mView);
    gl.uniform3f(U.uCamPos, CAM[0], CAM[1], CAM[2]);
    gl.uniform1f(U.uPulse, REDUCE ? 0.5 : 0.5 + 0.5 * Math.sin(S.time * 3.1));

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, ledTex);
    gl.uniform1i(U.uLedTex, 0);

    var breath = REDUCE ? 0 : Math.sin(S.time * 2.3) * 0.028;
    var totalYaw = S.yaw + S.scrollTurnSmooth + S.userYaw + S.cardNudge;
    var totalPitch = clamp(S.pitch + S.userPitch, -0.62, 0.62);
    var totalRoll = S.roll + clamp(S.velYaw * -0.015, -0.18, 0.18);
    var bobY = breath + S.hopY;

    // 1) 接地软阴影（保持水平接地，随机器人姿态轻微偏移缩放）
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.disable(gl.DEPTH_TEST);
    var shScale = clamp(1.0 - bobY * 0.35, 0.72, 1.1);
    var mShadow = new Float32Array([
      shScale, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, shScale, 0,
      0, 0, 0, 1
    ]);
    gl.uniform2f(U.uShadowShift, Math.sin(totalRoll) * 0.12, Math.sin(totalPitch) * 0.10);
    bindDraw(meshShadow, 4, mShadow);

    // 2) 不透明 3D 部件（开启深度缓冲）
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.DEPTH_TEST);

    var mRoot = mat4TRS(0, bobY, 0, totalPitch, totalYaw, totalRoll);

    bindDraw(meshBody, 0, mRoot);
    bindDraw(meshBezel, 1, mRoot);
    bindDraw(meshScreen, 2, mRoot);
    bindDraw(meshChestRim, 1, mRoot);
    bindDraw(meshChestBtn, 3, mRoot);

    // 左右耳罩 + 青色发光圆盘
    var mEarR = mat4Mul(mRoot, mat4TRS(0.775, 0.24, -0.01, 0, 0, 0.05));
    var mEarL = mat4Mul(mRoot, mat4TRS(-0.775, 0.24, -0.01, 0, Math.PI, -0.05));
    bindDraw(meshEar, 1, mEarR);
    bindDraw(meshEar, 1, mEarL);
    bindDraw(meshEarGlow, 3, mEarR);
    bindDraw(meshEarGlow, 3, mEarL);

    // 头顶双触角（带旋转惯性弹性摆动）
    var wob = S.antWobble + (REDUCE ? 0 : Math.sin(S.time * 3.2) * 0.025);
    var mAntR = mat4Mul(mRoot, mat4TRS(0.35, 0.855, 0.02, 0, 0, -0.36 + wob));
    var mAntL = mat4Mul(mRoot, mat4TRS(-0.35, 0.855, 0.02, 0, 0,  0.36 + wob));
    bindDraw(meshAntenna, 1, mAntR);
    bindDraw(meshAntenna, 1, mAntL);

    // 左右关节短手（随姿态挥手 + 快速旋转时离心向外张开）
    var spinFlare = clamp(Math.abs(S.velYaw) * 0.05, 0, 0.65);
    var wave = REDUCE ? 0 : Math.sin(S.time * 5.2) * 0.20 * S.waveAmt;
    var mArmL = mat4Mul(mRoot, mat4TRS(-0.78, -0.08, 0.09, S.armLX, 0, S.armLZ - spinFlare + wave * 0.35));
    var mArmR = mat4Mul(mRoot, mat4TRS( 0.78, -0.08, 0.09, S.armRX, 0, S.armRZ + spinFlare + wave));
    bindDraw(meshArm, 0, mArmL);
    bindDraw(meshArm, 0, mArmR);

    // 左右圆润小短脚
    var mFootL = mat4Mul(mRoot, mat4TRS(-0.34, -0.90, 0.05, 0,  0.06, 0));
    var mFootR = mat4Mul(mRoot, mat4TRS( 0.34, -0.90, 0.05, 0, -0.06, 0));
    bindDraw(meshFoot, 0, mFootL);
    bindDraw(meshFoot, 0, mFootR);
  }

  /* ---------- 7. 动画主循环与功耗控制 ---------- */
  function shouldRun() {
    return S.visible && S.pageVisible && !REDUCE;
  }
  function kick() {
    if (REDUCE) { render(); return; }
    if (!S.raf && shouldRun()) {
      S.last = 0;
      S.raf = requestAnimationFrame(step);
    }
  }
  function stop() {
    if (S.raf) { cancelAnimationFrame(S.raf); S.raf = 0; }
  }

  function step(now) {
    S.raf = 0;
    if (!shouldRun()) return;
    var dt = S.last ? Math.min(0.05, (now - S.last) / 1000) : 0.016;
    S.last = now;
    S.time += dt;

    var k = 1 - Math.pow(0.0015, dt);
    var p = POSES[S.sec] || POSES.hero;
    S.expr = p.expr;

    S.yaw     += (p.yaw - S.yaw) * k;
    S.pitch   += (p.pitch - S.pitch) * k;
    S.roll    += (p.roll - S.roll) * k;
    S.armLX   += (p.armL[0] - S.armLX) * k;
    S.armLZ   += (p.armL[1] - S.armLZ) * k;
    S.armRX   += (p.armR[0] - S.armRX) * k;
    S.armRZ   += (p.armR[1] - S.armRZ) * k;
    S.waveAmt += (p.waveR - S.waveAmt) * k;
    S.scrollTurnSmooth += (S.scrollTurn - S.scrollTurnSmooth) * Math.min(1, k * 1.6);
    S.cardNudge *= Math.pow(0.04, dt);

    if (!S.dragging) {
      S.userYaw   += S.velYaw * dt;
      S.userPitch += S.velPitch * dt;
      var damp = Math.exp(-2.8 * dt);
      S.velYaw   *= damp;
      S.velPitch *= damp;
      // 惯性慢下来后俯仰角柔和回正，水平角保留少量自然回弹
      if (Math.abs(S.velPitch) < 0.8) S.userPitch *= Math.pow(0.18, dt);
      if (Math.abs(S.velYaw) < 0.25) {
        // 把多圈旋转归一到 [-PI, PI] 再缓缓朝当前分区最佳视角靠拢
        if (S.userYaw > Math.PI || S.userYaw < -Math.PI) {
          S.userYaw = ((S.userYaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        }
        S.userYaw *= Math.pow(0.42, dt);
      }
    }

    // 触角弹簧阻尼跟随角速度
    var antTarget = clamp(-S.velYaw * 0.028, -0.28, 0.28);
    S.antVel += (-110 * (S.antWobble - antTarget) - 9.5 * S.antVel) * dt;
    S.antWobble += S.antVel * dt;

    // 跳跃弹簧
    if (S.hopY !== 0 || S.hopV !== 0) {
      S.hopV += (-150 * S.hopY - 12 * S.hopV) * dt;
      S.hopY += S.hopV * dt;
      if (Math.abs(S.hopY) < 0.001 && Math.abs(S.hopV) < 0.01) { S.hopY = 0; S.hopV = 0; }
    }

    // 自然眨眼计时
    if (S.time > S.nextBlink) {
      S.blinkEnd = S.time + 0.13;
      S.nextBlink = S.time + 3.2 + Math.random() * 2.6;
    }

    render();
    S.raf = requestAnimationFrame(step);
  }

  /* ---------- 8. 指针拖拽旋转交互 ---------- */
  var hit = document.getElementById('bot-hit');
  var dragState = null;

  if (hit) {
    hit.addEventListener('pointerdown', function (e) {
      if (e.button && e.button !== 0) return;
      try { hit.setPointerCapture(e.pointerId); } catch (err) {}
      S.dragging = true;
      S.velYaw = 0; S.velPitch = 0;
      dragState = {
        id: e.pointerId,
        x0: e.clientX, y0: e.clientY,
        lx: e.clientX, ly: e.clientY,
        lt: performance.now(),
        moved: false
      };
      hit.classList.add('grabbing');
    });

    hit.addEventListener('pointermove', function (e) {
      if (!dragState || e.pointerId !== dragState.id) return;
      var dxTot = e.clientX - dragState.x0, dyTot = e.clientY - dragState.y0;
      if (!dragState.moved && Math.hypot(dxTot, dyTot) > 5) dragState.moved = true;
      if (!dragState.moved) return;

      var now = performance.now();
      var dt = Math.max(8, now - dragState.lt) / 1000;
      var dx = e.clientX - dragState.lx;
      var dy = e.clientY - dragState.ly;
      dragState.lx = e.clientX; dragState.ly = e.clientY; dragState.lt = now;

      var sens = innerWidth < 768 ? 0.015 : 0.011;
      var dYaw = dx * sens, dPitch = dy * sens * 0.72;
      S.userYaw += dYaw;
      S.userPitch = clamp(S.userPitch + dPitch, -0.58, 0.58);

      if (!REDUCE) {
        S.velYaw   = S.velYaw * 0.45 + (dYaw / dt) * 0.55;
        S.velPitch = S.velPitch * 0.45 + (dPitch / dt) * 0.55;
        kick();
      } else {
        render();
      }
    });

    var endDrag = function (e) {
      if (!dragState || (e.pointerId != null && e.pointerId !== dragState.id)) return;
      var wasMoved = dragState.moved;
      dragState = null;
      S.dragging = false;
      hit.classList.remove('grabbing');
      if (wasMoved) {
        hit.dataset.justDragged = '1';
        S.velYaw = clamp(S.velYaw, -18, 18);
        S.velPitch = clamp(S.velPitch, -8, 8);
        kick();
      }
    };
    hit.addEventListener('pointerup', endDrag);
    hit.addEventListener('pointercancel', endDrag);
  }

  document.addEventListener('visibilitychange', function () {
    S.pageVisible = !document.hidden;
    if (S.pageVisible) kick(); else stop();
  });

  window.addEventListener('resize', function () {
    resize();
    render();
  });

  canvas.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    stop();
    document.documentElement.classList.add('no-gl');
  });

  /* ---------- 9. 对外控制接口 ---------- */
  API.ok = true;
  API.setSection = function (sec) {
    if (!POSES[sec] || S.sec === sec) return;
    S.sec = sec;
    if (REDUCE) {
      var p = POSES[sec];
      S.yaw = p.yaw; S.pitch = p.pitch; S.roll = p.roll;
      S.armLX = p.armL[0]; S.armLZ = p.armL[1]; S.armRX = p.armR[0]; S.armRZ = p.armR[1];
      S.expr = p.expr;
      render();
    } else {
      kick();
    }
  };
  API.setScrollTurn = function (rad) {
    S.scrollTurn = rad;
    if (REDUCE) { S.scrollTurnSmooth = 0; render(); }
    else kick();
  };
  API.setCardNudge = function (rad) {
    S.cardNudge = clamp(rad, -0.45, 0.45);
    if (!REDUCE) kick();
  };
  API.triggerExpr = function (expr, secDuration) {
    S.overrideExpr = expr;
    S.overrideUntil = S.time + (secDuration || 2.2);
    if (REDUCE) { S.expr = expr; render(); }
    else kick();
  };
  API.hop = function () {
    if (REDUCE) return;
    S.hopV = 1.65;
    S.velYaw += (Math.random() < 0.5 ? -1 : 1) * 2.4;
    kick();
  };
  API.setVisible = function (vis) {
    S.visible = !!vis;
    if (S.visible) kick(); else stop();
  };
  API.renderOnce = render;

  resize();
  render();
  document.documentElement.classList.add('has-gl');
  kick();
})();
