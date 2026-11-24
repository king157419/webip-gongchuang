/* v25-assemble · gl.js —— 手写 WebGL1 小智爆炸拆解与逐件组装引擎（零外部依赖） */
(function () {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  var FOV_DEG = 32, CAM_Z = 5.45;
  var UNIT_K = (0.5 / Math.tan((FOV_DEG * 0.5) * Math.PI / 180)) / CAM_Z;

  function createEngine(canvas) {
    var gl = null;
    try {
      var opts = { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, stencil: false };
      gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    } catch (e) { gl = null; }
    if (!gl) return null;

    var VS = [
      'attribute vec3 aPos,aNorm; attribute vec2 aUV;',
      'uniform mat4 uPV,uModel;',
      'varying vec3 vWorld,vLocal,vNorm; varying vec2 vUV;',
      'void main(){',
      '  vec4 wp=uModel*vec4(aPos,1.0);',
      '  vWorld=wp.xyz; vLocal=aPos;',
      '  vNorm=normalize((uModel*vec4(aNorm,0.0)).xyz);',
      '  vUV=aUV; gl_Position=uPV*wp;',
      '}'
    ].join('\n');

    /* uMat: 0=天蓝主壳 1=钴蓝配件 2=深蓝LED屏 3=青色发光件 4=暗蓝止口卡座 5=接地阴影 */
    var FS = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'uniform float uMat,uPower,uDark,uFlash,uSeamAmt,uShadowK;',
      'uniform vec4 uSeam; uniform vec3 uCam; uniform sampler2D uLedTex;',
      'varying vec3 vWorld,vLocal,vNorm; varying vec2 vUV;',
      'void main(){',
      '  if(uMat>4.5){',
      '    vec2 p=(vUV-0.5)*2.0;',
      '    float r2=dot(p/vec2(0.82,0.56),p/vec2(0.82,0.56));',
      '    float sh=exp(-r2*2.2)*(1.0-smoothstep(0.65,1.0,length(p)));',
      '    float a=clamp(sh*0.24*uShadowK,0.0,0.34);',
      '    vec3 sc=mix(vec3(0.04,0.08,0.16),vec3(0.0),uDark);',
      '    vec3 glow=vec3(0.05,0.78,0.96)*exp(-r2*2.8)*uPower*uDark*0.24;',
      '    gl_FragColor=vec4(sc*a+glow,clamp(a+length(glow)*0.36,0.0,0.46)); return;',
      '  }',
      '  vec3 N=normalize(vNorm),V=normalize(uCam-vWorld);',
      '  vec3 L1=normalize(vec3(-0.46,0.78,0.66)),L2=normalize(vec3(0.68,0.22,0.48));',
      '  float w1=clamp((dot(N,L1)+0.36)/1.36,0.0,1.0),w2=clamp((dot(N,L2)+0.30)/1.30,0.0,1.0);',
      '  float nv=clamp(dot(N,V),0.0,1.0),fres=pow(max(1.0-nv,1e-4),3.0);',
      '  float nh1=max(dot(N,normalize(L1+V)),1e-4),nh2=max(dot(N,normalize(L2+V)),1e-4);',
      '  float ambDim=mix(1.0,0.76,uDark);',
      '  if(uMat>2.5&&uMat<3.5){',
      '    vec3 unlit=mix(vec3(0.14,0.62,0.84),vec3(0.32,0.84,0.96),w1*0.8+0.2)*ambDim+vec3(1.0)*pow(nh1,36.0)*0.28;',
      '    vec3 lit=mix(vec3(0.03,0.80,0.99),vec3(0.64,1.0,1.0),nv*0.75+0.25)+vec3(0.9,1.0,1.0)*pow(nh1,80.0)*0.55;',
      '    vec3 c3=mix(unlit,lit,clamp(uPower,0.0,1.0))+vec3(0.75,0.98,1.0)*uFlash*0.85;',
      '    gl_FragColor=vec4(clamp(c3,0.0,1.0),1.0); return;',
      '  }',
      '  if(uMat>1.5&&uMat<2.5){',
      '    vec3 glass=vec3(0.033,0.068,0.215)*(0.72+0.28*w1);',
      '    vec2 gd=abs(fract(vUV*vec2(54.0,24.0))-0.5);',
      '    glass+=vec3(0.010,0.022,0.055)*(1.0-smoothstep(0.20,0.43,max(gd.x,gd.y)));',
      '    vec4 led=texture2D(uLedTex,vUV); float la=clamp(led.a,0.0,1.0);',
      '    glass=mix(glass,led.rgb,la)+led.rgb*(la*(0.08+0.18*uPower));',
      '    float nhg=max(dot(N,normalize(normalize(vec3(-0.34,0.86,0.50))+V)),1e-4);',
      '    glass+=vec3(0.86,0.94,1.0)*(smoothstep(0.970,0.995,nhg)*0.34+pow(nhg,42.0)*0.09);',
      '    glass+=vec3(0.18,0.52,0.92)*fres*0.30+vec3(0.55,0.95,1.0)*uFlash*(0.35+0.65*fres);',
      '    gl_FragColor=vec4(clamp(glass,0.0,1.0),1.0); return;',
      '  }',
      '  vec3 hi,lo,rim;',
      '  if(uMat<0.5){ hi=vec3(0.262,0.706,0.992); lo=vec3(0.128,0.476,0.838); rim=vec3(0.76,0.93,1.0); }',
      '  else if(uMat<1.5){ hi=vec3(0.068,0.322,0.792); lo=vec3(0.032,0.168,0.515); rim=vec3(0.42,0.76,1.0); }',
      '  else { hi=vec3(0.125,0.205,0.365); lo=vec3(0.058,0.098,0.195); rim=vec3(0.28,0.46,0.72); }',
      '  vec3 hemi=mix(vec3(0.72,0.84,0.96),vec3(1.0,0.99,0.97),N.y*0.5+0.5);',
      '  vec3 col=mix(lo,hi,w1*0.82+0.18)*(0.76+0.28*hemi)*ambDim+hi*w2*0.13*ambDim;',
      '  float spec=pow(nh1,26.0)*0.17+pow(nh2,20.0)*0.06+smoothstep(0.964,0.993,nh1)*0.32;',
      '  col+=vec3(1.0,0.995,0.98)*spec*mix(1.0,0.78,uDark)+rim*fres*(0.38+0.18*uDark);',
      '  if(uMat<0.5&&uPower>0.01&&vLocal.z>0.20){',
      '    float dC=length(vLocal-vec3(0.0,-0.19,0.63));',
      '    col+=vec3(0.05,0.68,0.88)*exp(-dC*dC*9.5)*uPower*(0.24+0.26*uDark);',
      '  }',
      '  float seamGlow=0.0;',
      '  if(uSeamAmt>0.005){',
      '    vec3 sp=vec3(uSeam.x>0.01?abs(vLocal.x):vLocal.x,vLocal.y,vLocal.z);',
      '    float sd=(uSeam.w<0.0)?abs(vLocal.y-uSeam.y):length(sp-uSeam.xyz);',
      '    float sr=max(abs(uSeam.w),0.04);',
      '    seamGlow=exp(-(sd*sd)/(sr*sr))*uSeamAmt;',
      '  }',
      '  col+=mix(vec3(0.28,0.90,1.0),vec3(1.0),0.5)*(uFlash*(0.35+0.65*fres)+seamGlow*0.95);',
      '  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);',
      '}'
    ].join('\n');

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = compile(gl.VERTEX_SHADER, VS), fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);

    var aPos = gl.getAttribLocation(prog, 'aPos');
    var aNorm = gl.getAttribLocation(prog, 'aNorm');
    var aUV = gl.getAttribLocation(prog, 'aUV');
    var U = {};
    ['uPV', 'uModel', 'uMat', 'uPower', 'uDark', 'uFlash', 'uSeamAmt', 'uSeam', 'uShadowK', 'uCam', 'uLedTex'].forEach(function (k) {
      U[k] = gl.getUniformLocation(prog, k);
    });

    function M(a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) {
        var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
        o[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
        o[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
        o[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
        o[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
      }
      return o;
    }

    function T(tx, ty, tz, rx, ry, rz, sx, sy, sz) {
      var cx = Math.cos(rx), srx = Math.sin(rx), cy = Math.cos(ry), sry = Math.sin(ry), cz = Math.cos(rz), srz = Math.sin(rz);
      var k0 = sx == null ? 1 : sx, k1 = sy == null ? k0 : sy, k2 = sz == null ? k0 : sz;
      return new Float32Array([
        (cy * cz + sry * srx * srz) * k0, (cx * srz) * k0, (-sry * cz + cy * srx * srz) * k0, 0,
        (-cy * srz + sry * srx * cz) * k1, (cx * cz) * k1, (sry * srz + cy * srx * cz) * k1, 0,
        (sry * cx) * k2, (-srx) * k2, (cy * cx) * k2, 0,
        tx, ty, tz, 1
      ]);
    }

    function lookAt(ex, ey, ez, tx, ty, tz) {
      var zx = ex - tx, zy = ey - ty, zz = ez - tz;
      var zl = Math.hypot(zx, zy, zz) || 1; zx /= zl; zy /= zl; zz /= zl;
      var xx = zz, xz = -zx, xl = Math.hypot(xx, xz) || 1; xx /= xl; xz /= xl;
      var yx = zy * xz, yy = zz * xx - zx * xz, yz = -zy * xx;
      return new Float32Array([
        xx, yx, zx, 0, 0, yy, zy, 0, xz, yz, zz, 0,
        -(xx * ex + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1
      ]);
    }

    function xformPt(m, p) {
      return [
        m[0] * p[0] + m[4] * p[1] + m[8]  * p[2] + m[12],
        m[1] * p[0] + m[5] * p[1] + m[9]  * p[2] + m[13],
        m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]
      ];
    }

    function makeSurface(uSeg, vSeg, evalPt, insideFn, freeV) {
      var cols = uSeg + 1, rows = vSeg + 1;
      var data = new Float32Array(cols * rows * 8), idx = new Uint16Array(uSeg * vSeg * 6);
      var eps = 0.002, ptr = 0;
      for (var j = 0; j < rows; j++) {
        var v = j / vSeg, vs = freeV ? v : clamp(v, 0.003, 0.997);
        for (var i = 0; i < cols; i++) {
          var u = i / uSeg, p = evalPt(u, v);
          var pu1 = evalPt(u + eps, vs), pu0 = evalPt(u - eps, vs);
          var pv1 = evalPt(u, freeV ? (v + eps) : Math.min(1, v + eps));
          var pv0 = evalPt(u, freeV ? (v - eps) : Math.max(0, v - eps));
          var ux = pu1[0] - pu0[0], uy = pu1[1] - pu0[1], uz = pu1[2] - pu0[2];
          var vx = pv1[0] - pv0[0], vy = pv1[1] - pv0[1], vz = pv1[2] - pv0[2];
          var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
          var nl = Math.hypot(nx, ny, nz);
          if (nl < 1e-7) { nx = 0; ny = v > 0.5 ? 1 : -1; nz = 0; }
          else { nx /= nl; ny /= nl; nz /= nl; }
          if (insideFn) {
            var c = insideFn(u, v, p);
            if (nx * (p[0] - c[0]) + ny * (p[1] - c[1]) + nz * (p[2] - c[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; }
          }
          data[ptr++] = p[0]; data[ptr++] = p[1]; data[ptr++] = p[2];
          data[ptr++] = nx;   data[ptr++] = ny;   data[ptr++] = nz;
          data[ptr++] = p[3] || 0; data[ptr++] = p[4] || 0;
        }
      }
      var ip = 0;
      for (var r = 0; r < vSeg; r++) {
        for (var c2 = 0; c2 < uSeg; c2++) {
          var a = r * cols + c2, b = a + 1, d = a + cols, e = d + 1;
          idx[ip++] = a; idx[ip++] = d; idx[ip++] = b;
          idx[ip++] = b; idx[ip++] = d; idx[ip++] = e;
        }
      }
      var vbo = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vbo); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var ibo = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      return { vbo: vbo, ibo: ibo, count: idx.length };
    }

    var BODY_H = 0.94, Y_SPLIT = -0.025, VISOR_CY = 0.24, HX = 0.27, SCR_R = 0.218, CHEST_Y = -0.19;
    /* 比例对齐 zhi-turnaround：身体是竖长的蛋形（高:宽≈1.35） */
    var BW = 0.70, BD = 0.62, EAR_X = 0.632, ANT_X = 0.27, ANT_Y = 0.86, ARM_X = 0.66, FOOT_X = 0.28;

    function bodyAxes(y) {
      var yn = clamp(y / BODY_H, -1, 1), u2 = yn * yn;
      var c = Math.sqrt(Math.max(0, 1 - u2)) * (1 + 0.11 * u2 * (1 - u2));
      var belly = 1.0 - 0.045 * yn + 0.05 * Math.exp(-Math.pow((yn + 0.24) / 0.48, 2));
      return [BW * c * belly, BD * c * belly];
    }
    function bodyZ(x, y) {
      var axz = bodyAxes(y), q = clamp(x / Math.max(axz[0], 1e-4), -0.985, 0.985);
      return axz[1] * Math.sqrt(1 - q * q);
    }

    var phSplit = Math.asin(clamp(Y_SPLIT / BODY_H, -1, 1));
    var meshHeadShell = makeSurface(48, 24, function (u, v) {
      var th = u * Math.PI * 2, ph = clamp(lerp(phSplit, Math.PI * 0.5, v), -1.56, 1.5707);
      var y = BODY_H * Math.sin(ph), axz = bodyAxes(y), x = axz[0] * Math.sin(th), z = axz[1] * Math.cos(th);
      if (z > 0.15) {
        var dent = 1 - clamp((Math.hypot(Math.max(0, Math.abs(x) - HX), y - VISOR_CY) - 0.17) / 0.11, 0, 1);
        z -= 0.03 * dent * dent * (3 - 2 * dent);
      }
      return [x, y, z, u, v];
    }, function (u, v, p) { return [0, Math.max(Y_SPLIT + 0.05, p[1] * 0.55), 0]; }, true);

    var splitAx = bodyAxes(Y_SPLIT);
    var meshHeadCollar = makeSurface(40, 10, function (u, v) {
      var th = u * Math.PI * 2, y, rk;
      if (v < 0.72) { var t = v / 0.72; y = Y_SPLIT + 0.03 - t * 0.105; rk = 0.915 - 0.015 * t; }
      else { y = Y_SPLIT - 0.075; rk = 0.90 * (1 - ((v - 0.72) / 0.28) * 0.98); }
      return [splitAx[0] * rk * Math.sin(th), y, splitAx[1] * rk * Math.cos(th), u, v];
    }, function () { return [0, Y_SPLIT + 0.02, 0]; });

    var meshTorso = makeSurface(48, 24, function (u, v) {
      var th = u * Math.PI * 2, ph = clamp(lerp(-Math.PI * 0.5, phSplit, v), -1.5707, 1.56);
      var y = BODY_H * Math.sin(ph), axz = bodyAxes(y), x = axz[0] * Math.sin(th), z = axz[1] * Math.cos(th);
      if (z > 0.2) z -= 0.024 * (1 - clamp((Math.hypot(x, y - CHEST_Y) - 0.068) / 0.028, 0, 1));
      return [x, y, z, u, v];
    }, function (u, v, p) { return [0, Math.min(Y_SPLIT - 0.06, p[1] * 0.55), 0]; }, true);

    var meshTorsoCap = makeSurface(36, 6, function (u, v) {
      var th = u * Math.PI * 2, r = 0.01 + 0.97 * v;
      return [splitAx[0] * 0.96 * r * Math.sin(th), Y_SPLIT - 0.004 - 0.018 * (1 - r * r), splitAx[1] * 0.96 * r * Math.cos(th), u, v];
    }, function () { return [0, Y_SPLIT - 0.25, 0]; });

    var RMID = 0.242, L_SEG = 2 * HX, L_ARC = Math.PI * RMID, L_TOT = 2 * L_SEG + 2 * L_ARC;
    function stadiumSpine(u) {
      var s = ((u % 1) + 1) % 1 * L_TOT;
      if (s < L_SEG) return [HX - 2 * HX * (s / L_SEG), 0, 0, 1];
      s -= L_SEG;
      if (s < L_ARC) { var a1 = Math.PI * 0.5 + (s / L_ARC) * Math.PI; return [-HX, 0, Math.cos(a1), Math.sin(a1)]; }
      s -= L_ARC;
      if (s < L_SEG) return [-HX + 2 * HX * (s / L_SEG), 0, 0, -1];
      var a2 = -Math.PI * 0.5 + ((s - L_SEG) / L_ARC) * Math.PI;
      return [HX, 0, Math.cos(a2), Math.sin(a2)];
    }

    var meshBezel = makeSurface(60, 12, function (u, v) {
      var sp = stadiumSpine(u), beta = v * Math.PI, rho = 0.244 - 0.040 * Math.cos(beta);
      var x = sp[0] + rho * sp[2], y = VISOR_CY + sp[1] + rho * sp[3];
      return [x, y, bodyZ(x, y) + 0.048 * Math.sin(beta) - 0.022 * (1 - Math.sin(beta)), u, v];
    }, function (u) {
      var sp = stadiumSpine(u), x = sp[0] + 0.244 * sp[2], y = VISOR_CY + sp[1] + 0.244 * sp[3];
      return [x, y, bodyZ(x, y) - 0.03];
    });

    var meshScreen = makeSurface(48, 18, function (u, v) {
      var x = Math.sin((u - 0.5) * Math.PI) * (HX + SCR_R) * 0.996, dx = Math.max(0, Math.abs(x) - HX);
      var y = VISOR_CY + (v * 2 - 1) * 0.994 * Math.sqrt(Math.max(1e-6, SCR_R * SCR_R - dx * dx));
      var dRim = clamp((SCR_R - Math.hypot(dx, y - VISOR_CY)) / SCR_R, 0, 1);
      return [x, y, bodyZ(x, y) + 0.017 + 0.014 * Math.sqrt(dRim), (x + HX + SCR_R) / (2 * (HX + SCR_R)), 1.0 - (y - VISOR_CY + SCR_R) / (2 * SCR_R)];
    }, function () { return [0, VISOR_CY, 0]; });

    var meshVisorBack = makeSurface(40, 12, function (u, v) {
      var R = 0.268, x = Math.sin((u - 0.5) * Math.PI) * (HX + R) * 0.98, dx = Math.max(0, Math.abs(x) - HX);
      var y = VISOR_CY + (v * 2 - 1) * 0.98 * Math.sqrt(Math.max(1e-6, R * R - dx * dx));
      return [x, y, bodyZ(x, y) - 0.018, u, v];
    }, function () { return [0, VISOR_CY, 1.2]; });

    var meshEar = makeSurface(34, 18, function (u, v) {
      var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI, sn = Math.sin(ph);
      var r = Math.pow(Math.max(0, Math.cos(ph)), 0.68);
      return [0.136 * (sn < 0 ? -1 : 1) * Math.pow(Math.abs(sn), 0.66), 0.345 * r * Math.cos(th), 0.315 * r * Math.sin(th), u, v];
    }, function () { return [0, 0, 0]; });

    var meshEarPad = makeSurface(28, 8, function (u, v) {
      var th = u * Math.PI * 2, t = 0.01 + 0.99 * v;
      return [0.129 + 0.024 * Math.cos(t * Math.PI * 0.5), 0.162 * t * Math.cos(th), 0.148 * t * Math.sin(th), u, v];
    }, function () { return [0, 0, 0]; });

    var meshAntenna = makeSurface(26, 22, function (u, v) {
      var th = u * Math.PI * 2, r, y, RB = 0.168, YC = 0.305, A0 = -Math.PI / 3;
      var yJoin = YC + RB * Math.sin(A0), rJoin = RB * Math.cos(A0);
      if (v < 0.16) { var kp = v / 0.16; y = -0.12 + kp * 0.07; r = 0.068 * Math.min(1, kp * 2.5); }
      else if (v < 0.48) { var k = (v - 0.16) / 0.32; y = -0.05 + k * (yJoin + 0.05); r = 0.124 + (rJoin - 0.124) * Math.pow(k, 0.85); }
      else { var ang = A0 + ((v - 0.48) / 0.52) * (Math.PI * 0.5 - A0); y = YC + RB * Math.sin(ang); r = RB * Math.cos(ang); }
      return [r * Math.cos(th), y, r * Math.sin(th), u, v];
    }, function (u, v, p) { return [0, clamp(p[1], -0.08, 0.305), 0]; });

    var meshChestRim = makeSurface(30, 10, function (u, v) {
      var a = u * Math.PI * 2, beta = v * Math.PI, r = 0.082 - 0.017 * Math.cos(beta);
      var x = r * Math.cos(a), y = CHEST_Y + r * Math.sin(a);
      return [x, y, bodyZ(x, y) + 0.018 * Math.sin(beta) - 0.022 * (1 - Math.sin(beta)), u, v];
    }, function (u) {
      var a = u * Math.PI * 2, x = 0.082 * Math.cos(a), y = CHEST_Y + 0.082 * Math.sin(a);
      return [x, y, bodyZ(x, y) - 0.03];
    });

    var meshChestBtn = makeSurface(28, 8, function (u, v) {
      var a = u * Math.PI * 2, t = 0.01 + 0.99 * v, r = t * 0.066, x = r * Math.cos(a), y = CHEST_Y + r * Math.sin(a);
      return [x, y, bodyZ(x, y) + 0.011 + 0.020 * Math.cos(t * Math.PI * 0.5), u, v];
    }, function () { return [0, CHEST_Y, 0]; });

    var meshSocket = makeSurface(22, 6, function (u, v) {
      var a = u * Math.PI * 2, t = 0.02 + 0.98 * v;
      return [0.095 * t * Math.cos(a), 0.095 * t * Math.sin(a), -0.022 * (1 - t * t) + (t > 0.82 ? 0.008 * ((t - 0.82) / 0.18) : 0), u, v];
    }, function () { return [0, 0, -0.15]; });

    var meshArm = makeSurface(24, 16, function (u, v) {
      var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI, sn = Math.sin(ph);
      var r = Math.pow(Math.max(0, Math.cos(ph)), 0.84) * (1.0 - 0.14 * sn);
      return [0.158 * r * Math.cos(th), -0.16 + 0.255 * sn, 0.172 * r * Math.sin(th), u, v];
    }, function () { return [0, -0.16, 0]; });

    var meshFoot = makeSurface(26, 14, function (u, v) {
      var th = u * Math.PI * 2, ph = (v - 0.5) * Math.PI, sn = Math.sin(ph), r = Math.pow(Math.max(0, Math.cos(ph)), 0.76);
      return [0.255 * r * Math.cos(th), sn < 0 ? sn * 0.105 : sn * 0.175, 0.295 * r * Math.sin(th), u, v];
    }, function () { return [0, 0, 0]; });

    var meshShadow = (function () {
      var S = 1.42, Y = -1.015;
      var d = new Float32Array([-S, Y, -S, 0, 1, 0, 0, 0, S, Y, -S, 0, 1, 0, 1, 0, S, Y, S, 0, 1, 0, 1, 1, -S, Y, S, 0, 1, 0, 0, 1]);
      var ix = new Uint16Array([0, 2, 1, 0, 3, 2]);
      var vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STATIC_DRAW);
      var ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
      return { vbo: vb, ibo: ib, count: 6 };
    })();

    var ledCv = document.createElement('canvas');
    ledCv.width = 512; ledCv.height = 228;
    var lctx = ledCv.getContext('2d'), ledTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ledTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    function rrect(ctx, x, y, w, h, r) {
      var rr = Math.min(r, w * 0.5, h * 0.5);
      ctx.beginPath(); ctx.moveTo(x + rr, y);
      ctx.arcTo(x + w, y, x + w, y + h, rr); ctx.arcTo(x + w, y + h, x, y + h, rr);
      ctx.arcTo(x, y + h, x, y, rr); ctx.arcTo(x, y, x + w, y, rr);
      ctx.closePath(); ctx.fill();
    }

    var lastFaceKey = '';
    function updateLedFace(mode, alpha, blink) {
      var qAlpha = Math.round(clamp(alpha, 0, 1) * 25) / 25;
      var key = mode + ':' + qAlpha + ':' + (blink ? 1 : 0);
      if (key === lastFaceKey) return;
      lastFaceKey = key;
      lctx.clearRect(0, 0, 512, 228);
      if (qAlpha > 0.02) {
        var LX = 162, RX = 350, CY = 98, S = 22, G = 26;
        var px = function (cx, cy, w, h) { rrect(lctx, cx - w * 0.5, cy - h * 0.5, w, h, 5); };
        var paint = function (col, blur, ex) {
          lctx.save(); lctx.fillStyle = lctx.shadowColor = col; lctx.shadowBlur = blur;
          var b = S + ex;
          px(108, 162, 18 + ex, 18 + ex); px(404, 162, 18 + ex, 18 + ex);
          if (blink) {
            px(LX, CY + 4, 72 + ex, 14 + ex); px(RX, CY + 4, 72 + ex, 14 + ex);
          } else if (mode === 'happy') {
            [LX, RX].forEach(function (x0) {
              px(x0 - G * 1.4, CY + G * 0.55, b, b); px(x0 - G * 0.7, CY - G * 0.15, b, b);
              px(x0, CY - G * 0.75, b, b);
              px(x0 + G * 0.7, CY - G * 0.15, b, b); px(x0 + G * 1.4, CY + G * 0.55, b, b);
            });
          } else if (mode === 'star') {
            [LX, RX].forEach(function (x0) {
              px(x0, CY - G, b, b); px(x0, CY + G, b, b); px(x0 - G, CY, b, b); px(x0 + G, CY, b, b);
            });
          } else {
            px(LX - G, CY - G, b, b); px(LX + G, CY - G, b, b); px(LX, CY, b, b);
            px(LX - G, CY + G, b, b); px(LX + G, CY + G, b, b);
            px(RX - 24, CY + 3, 28 + ex, 21 + ex); px(RX + 18, CY + 3, 44 + ex, 21 + ex);
          }
          lctx.restore();
        };
        paint('rgba(0,225,255,' + (0.45 * qAlpha).toFixed(3) + ')', 18, 4);
        paint('rgba(45,250,255,' + qAlpha.toFixed(3) + ')', 0, 0);
        if (qAlpha > 0.7) paint('rgba(220,255,255,' + ((qAlpha - 0.7) * 1.6).toFixed(3) + ')', 0, -6);
      }
      gl.bindTexture(gl.TEXTURE_2D, ledTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ledCv);
    }
    updateLedFace('sig', 0.62, false);

    var VW = 1, VH = 1, DPR = 1, camPos = [0, 0.10, CAM_Z];
    var mView = lookAt(camPos[0], camPos[1], camPos[2], 0, 0.06, 0), mPV = new Float32Array(16);

    function resize(vw, vh, dpr) {
      VW = Math.max(1, vw); VH = Math.max(1, vh); DPR = dpr || 1;
      var cw = Math.round(VW * DPR), ch = Math.round(VH * DPR);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      gl.viewport(0, 0, cw, ch);
    }

    function buildPV(cx, cy) {
      var f = 1.0 / Math.tan((FOV_DEG * 0.5) * Math.PI / 180);
      var aspect = VW / VH, near = 0.5, far = 20.0, nf = 1.0 / (near - far);
      var nx = (cx / VW) * 2.0 - 1.0, ny = 1.0 - (cy / VH) * 2.0;
      mPV = M(new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, -nx, -ny, (far + near) * nf, -1, 0, 0, (2 * far * near) * nf, 0]), mView);
    }

    function projectWorld(wp) {
      var x = wp[0], y = wp[1], z = wp[2];
      var cx = mPV[0] * x + mPV[4] * y + mPV[8]  * z + mPV[12];
      var cy = mPV[1] * x + mPV[5] * y + mPV[9]  * z + mPV[13];
      var cw = mPV[3] * x + mPV[7] * y + mPV[11] * z + mPV[15];
      if (cw <= 0.001) return [VW * 0.5, VH * 0.5];
      return [(cx / cw * 0.5 + 0.5) * VW, (0.5 - cy / cw * 0.5) * VH];
    }

    function drawMesh(mesh, modelMat, matId, flash) {
      gl.uniformMatrix4fv(U.uModel, false, modelMat);
      gl.uniform1f(U.uMat, matId);
      gl.uniform1f(U.uFlash, flash || 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, mesh.vbo);
      gl.enableVertexAttribArray(aPos);  gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(aNorm); gl.vertexAttribPointer(aNorm, 3, gl.FLOAT, false, 32, 12);
      gl.enableVertexAttribArray(aUV);   gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 32, 24);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.ibo);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    function render(st) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);

      buildPV(st.cx, st.cy);
      updateLedFace(st.faceMode || 'sig', st.ledAlpha, !!st.blink);

      gl.useProgram(prog);
      gl.uniformMatrix4fv(U.uPV, false, mPV);
      gl.uniform3f(U.uCam, camPos[0], camPos[1], camPos[2]);
      gl.uniform1f(U.uPower, st.power || 0);
      gl.uniform1f(U.uDark, st.dark || 0);
      gl.uniform1f(U.uShadowK, st.shadowK == null ? 1 : st.shadowK);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ledTex); gl.uniform1i(U.uLedTex, 0);

      var sc = st.scale || 1;
      var mBot = T(st.bx || 0, st.by || 0, st.bz || 0, st.rx || 0, st.ry || 0, st.rz || 0, sc * (st.sqX || 1), sc * (st.sqY || 1), sc * (st.sqX || 1));

      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      drawMesh(meshShadow, T(st.bx || 0, st.by || 0, 0, 0, 0, 0, sc, sc, sc), 5.0, 0);
      gl.depthMask(true); gl.disable(gl.BLEND);

      var eBase = st.eBase || 0, eVisor = st.eVisor || 0, eEars = st.eEars || 0, eAnt = st.eAnt || 0, eChest = st.eChest || 0;
      var fBase = st.fBase || 0, fVisor = st.fVisor || 0, fEars = st.fEars || 0, fAnt = st.fAnt || 0, fChest = st.fChest || 0;

      function setSeam(x, y, z, r, amt) {
        gl.uniform1f(U.uSeamAmt, amt || 0);
        if (amt > 0.005) gl.uniform4f(U.uSeam, x, y, z, r);
      }

      var sx = 0, sy = Y_SPLIT, sz = 0, sr = -0.075, sa = 0;
      if (fBase > sa)  { sx = 0;    sy = Y_SPLIT;  sz = 0;    sr = -0.075; sa = fBase; }
      if (fVisor > sa) { sx = 0;    sy = VISOR_CY; sz = 0.56; sr = 0.42;   sa = fVisor * 0.85; }
      if (fEars > sa)  { sx = EAR_X; sy = 0.24;     sz = 0.02; sr = 0.28;   sa = fEars * 0.9; }
      if (fAnt > sa)   { sx = ANT_X; sy = ANT_Y;     sz = 0.02; sr = 0.22;   sa = fAnt * 0.9; }
      if (fChest > sa) { sx = 0;    sy = CHEST_Y;  sz = 0.63; sr = 0.16;   sa = fChest * 0.95; }

      var torsoY = -0.17 * eBase, mTorso = M(mBot, T(0, torsoY, 0, 0, 0, 0, 1));
      setSeam(sx, sy, sz, sr, sa); drawMesh(meshTorso, mTorso, 0.0, 0); setSeam(0, 0, 0, 1, 0);
      if (eBase > 0.008) drawMesh(meshTorsoCap, mTorso, 4.0, fBase * 0.5);
      if (eChest > 0.02) drawMesh(meshSocket, M(mTorso, T(0, CHEST_Y, bodyZ(0, CHEST_Y) - 0.006, 0, 0, 0, 0.82, 0.82, 1)), 4.0, fChest * 0.6);

      var headY = 0.25 * eBase, mHead = M(mBot, T(0, headY, -0.02 * eBase, -0.03 * eBase, 0, 0, 1));
      if (eBase > 0.008) drawMesh(meshHeadCollar, mHead, 4.0, fBase * 0.6);
      setSeam(sx, sy, sz, sr, sa); drawMesh(meshHeadShell, mHead, 0.0, 0); setSeam(0, 0, 0, 1, 0);

      if (eVisor > 0.02) drawMesh(meshVisorBack, M(mHead, T(0, VISOR_CY, 0.008, 0, 0, 0, 0.94, 0.88, 1)), 4.0, fVisor * 0.5);
      if (eEars > 0.02) {
        drawMesh(meshSocket, M(mHead, T( EAR_X, 0.24, 0.02, 0,  Math.PI * 0.5, -0.10, 1.35, 1.55, 1)), 4.0, fEars * 0.5);
        drawMesh(meshSocket, M(mHead, T(-EAR_X, 0.24, 0.02, 0, -Math.PI * 0.5,  0.10, 1.35, 1.55, 1)), 4.0, fEars * 0.5);
      }
      if (eAnt > 0.02) {
        drawMesh(meshSocket, M(mHead, T( ANT_X, ANT_Y - 0.005, 0.02, -Math.PI * 0.5, 0, -0.28, 1.05, 1.05, 1)), 4.0, fAnt * 0.5);
        drawMesh(meshSocket, M(mHead, T(-ANT_X, ANT_Y - 0.005, 0.02, -Math.PI * 0.5, 0,  0.28, 1.05, 1.05, 1)), 4.0, fAnt * 0.5);
      }

      var wave = st.wave || 0, wavePh = st.wavePh || 0;
      var mArmL = M(mBot, T(-ARM_X - 0.34 * eBase, torsoY - 0.08 - 0.05 * eBase, 0.08 + 0.06 * eBase, lerp(0.05, 0.28, wave), 0, lerp(-0.14, -2.32 + 0.26 * Math.sin(wavePh), wave) - 0.16 * eBase, 1));
      var mArmR = M(mBot, T( ARM_X + 0.34 * eBase, torsoY - 0.08 - 0.05 * eBase, 0.08 + 0.06 * eBase, 0.05, 0, 0.14 + 0.16 * eBase, 1));
      drawMesh(meshArm, mArmL, 0.0, fBase * 0.55); drawMesh(meshArm, mArmR, 0.0, fBase * 0.55);

      var mFootL = M(mBot, T(-FOOT_X - 0.13 * eBase, torsoY - 0.89 - 0.20 * eBase, 0.04, 0,  0.07, 0, 1));
      var mFootR = M(mBot, T( FOOT_X + 0.13 * eBase, torsoY - 0.89 - 0.20 * eBase, 0.04, 0, -0.07, 0, 1));
      drawMesh(meshFoot, mFootL, 0.0, fBase * 0.55); drawMesh(meshFoot, mFootR, 0.0, fBase * 0.55);

      var mVisor = M(mHead, T(0, 0.04 * eVisor, 0.78 * eVisor, -0.06 * eVisor, 0.04 * eVisor, 0, 1));
      if (eVisor > 0.01) drawMesh(meshVisorBack, mVisor, 4.0, fVisor * 0.5);
      drawMesh(meshBezel, mVisor, 1.0, fVisor); drawMesh(meshScreen, mVisor, 2.0, fVisor * 0.65);

      var mEarR = M(mHead, T( EAR_X + 0.01 + 0.42 * eEars, 0.24 + 0.03 * eEars, 0.02 + 0.05 * eEars, 0, 0,  0.10 - 0.14 * eEars, 1));
      var mEarL = M(mHead, T(-EAR_X - 0.01 - 0.42 * eEars, 0.24 + 0.03 * eEars, 0.02 + 0.05 * eEars, 0, Math.PI, -0.10 + 0.14 * eEars, 1));
      if (eEars > 0.02) {
        drawMesh(meshSocket, M(mEarR, T(-0.12, 0, 0, 0, -Math.PI * 0.5, 0, 0.9, 1.05, 1.5)), 4.0, fEars * 0.5);
        drawMesh(meshSocket, M(mEarL, T(-0.12, 0, 0, 0, -Math.PI * 0.5, 0, 0.9, 1.05, 1.5)), 4.0, fEars * 0.5);
      }
      drawMesh(meshEar, mEarR, 1.0, fEars); drawMesh(meshEarPad, mEarR, 3.0, fEars);
      drawMesh(meshEar, mEarL, 1.0, fEars); drawMesh(meshEarPad, mEarL, 3.0, fEars);

      var mAntR = M(mHead, T( ANT_X + 0.16 * eAnt, ANT_Y + 0.32 * eAnt, 0.02, 0, 0, -0.28, 1));
      var mAntL = M(mHead, T(-ANT_X - 0.16 * eAnt, ANT_Y + 0.32 * eAnt, 0.02, 0, 0,  0.28, 1));
      drawMesh(meshAntenna, mAntR, 1.0, fAnt); drawMesh(meshAntenna, mAntL, 1.0, fAnt);

      var mChest = M(mTorso, T(0.10 * eChest, -0.15 * eChest, 0.62 * eChest, 0.12 * eChest, 0, 0, 1));
      drawMesh(meshChestRim, mChest, 1.0, fChest); drawMesh(meshChestBtn, mChest, 3.0, fChest);

      function P(m, lp) { return projectWorld(xformPt(m, lp)); }
      var extPts = [
        P(mAntL, [-0.16, 0.47, 0]), P(mAntR, [0.16, 0.47, 0]),
        P(mEarL, [0.16, 0, 0]), P(mEarR, [0.16, 0, 0]),
        P(mArmL, [-0.16, -0.22, 0]), P(mArmR, [0.16, -0.22, 0]),
        P(mFootL, [-0.22, -0.11, 0.15]), P(mFootR, [0.22, -0.11, 0.15]),
        P(mVisor, [-0.50, VISOR_CY, 0.56]), P(mVisor, [0.50, VISOR_CY, 0.56]),
        P(mHead, [0, 0.24, -0.66]), P(mTorso, [0, -0.20, -0.66]), P(mChest, [0.08, CHEST_Y, 0.68])
      ];
      var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
      for (var ei = 0; ei < extPts.length; ei++) {
        var ep = extPts[ei];
        if (ep[0] < minX) minX = ep[0];
        if (ep[0] > maxX) maxX = ep[0];
        if (ep[1] < minY) minY = ep[1];
        if (ep[1] > maxY) maxY = ep[1];
      }

      return {
        center: projectWorld(xformPt(mBot, [0, 0.08, 0])),
        bounds: { minX: minX, maxX: maxX, minY: minY, maxY: maxY },
        anchors: {
          head:      P(mHead,  [-0.40, 0.70, 0.20]),
          visorLeft: P(mVisor, [-0.44, VISOR_CY, bodyZ(-0.44, VISOR_CY) + 0.03]),
          visor:     P(mVisor, [ 0.44, VISOR_CY + 0.02, bodyZ(0.44, VISOR_CY) + 0.03]),
          torso:     P(mTorso, [-0.54, -0.44, 0.30]),
          limbs:     P(mArmR,  [ 0.10, -0.24, 0.06]),
          ears:      P(mEarR,  [ 0.12, 0.08, 0.08]),
          earsL:     P(mEarL,  [ 0.12, 0.08, 0.08]),
          ant:       P(mAntR,  [ 0.07, 0.34, 0.04]),
          antL:      P(mAntL,  [-0.07, 0.34, 0.04]),
          chest:     P(mChest, [ 0.06, CHEST_Y, bodyZ(0.06, CHEST_Y) + 0.025])
        },
        axes: [
          { gap: eBase,  a: P(mTorso, [0, Y_SPLIT, 0]),                  b: P(mHead,  [0, Y_SPLIT, 0]) },
          { gap: eVisor, a: P(mHead,  [0, VISOR_CY, 0.62]),              b: P(mVisor, [0, VISOR_CY, 0.62]) },
          { gap: eEars,  a: P(mHead,  [EAR_X, 0.24, 0.02]),               b: P(mEarR,  [0, 0, 0]) },
          { gap: eEars,  a: P(mHead,  [-EAR_X, 0.24, 0.02]),              b: P(mEarL,  [0, 0, 0]) },
          { gap: eAnt,   a: P(mHead,  [ANT_X, ANT_Y, 0.02]),               b: P(mAntR,  [0, -0.06, 0]) },
          { gap: eAnt,   a: P(mHead,  [-ANT_X, ANT_Y, 0.02]),              b: P(mAntL,  [0, -0.06, 0]) },
          { gap: eChest, a: P(mTorso, [0, CHEST_Y, bodyZ(0, CHEST_Y)]),  b: P(mChest, [0, CHEST_Y, bodyZ(0, CHEST_Y)]) },
          { gap: eBase,  a: P(mTorso, [ARM_X - 0.02, -0.08, 0.08]),              b: P(mArmR,  [0, 0, 0]) },
          { gap: eBase,  a: P(mTorso, [-ARM_X + 0.02, -0.08, 0.08]),             b: P(mArmL,  [0, 0, 0]) },
          { gap: eBase,  a: P(mTorso, [FOOT_X, -0.88, 0.04]),              b: P(mFootR, [0, 0.08, 0]) },
          { gap: eBase,  a: P(mTorso, [-FOOT_X, -0.88, 0.04]),             b: P(mFootL, [0, 0.08, 0]) }
        ]
      };
    }

    return {
      resize: resize,
      render: render,
      unitPx: function (vh) { return UNIT_K * vh; }
    };
  }

  window.AssembleGL = { create: createEngine };
})();
