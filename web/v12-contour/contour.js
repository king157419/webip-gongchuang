/* =====================================================================
 * v12-contour · WebGL1 3D 等高线地形 + 二维黏弹性流体波纹仿真
 * ---------------------------------------------------------------------
 * · 全屏片元光线步进（真 3D 高度场遮挡与俯冲透视）+ 切平面解析像素雅可比抗锯齿
 * · 128×128 黏弹性波动方程（Klein-Gordon + 黏性耗散），16-bit 编码上传纹理，
 *   片元内 3×3 二次 B 样条插值与解析梯度：按住拖动实时压出凹坑与隆起边缘，
 *   松手后如重质流体缓慢回弹、同心波纹向四周扩散。
 * · 克制石墨细等高线 + 光学薄膜干涉棱边色散 + 35mm 胶片颗粒。
 * ===================================================================== */
(function () {
  'use strict';

  var cv = document.getElementById('contourCv');
  var stage = document.getElementById('heroStage');
  var API = {
    ok: false,
    setProgress: function () {},
    start: function () {},
    stop: function () {},
    frame: function () {}
  };
  window.Contour = API;
  if (!cv) return;

  var gl = null;
  try {
    var opts = {
      antialias: false,
      alpha: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance'
    };
    gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts);
  } catch (e) {
    gl = null;
  }
  if (!gl) {
    document.documentElement.classList.add('no-gl');
    return;
  }

  /* ---------- 128×128 黏弹性流体高度场 ---------- */
  var G = 128;
  var X0 = -6.0, Y0 = -5.5, SPAN = 12.0;
  var DX = SPAN / G;
  var H_SCALE = 0.60;
  var u = new Float32Array(G * G);
  var v = new Float32Array(G * G);
  var lap = new Float32Array(G * G);
  var texBytes = new Uint8Array(G * G * 4);
  var dampMask = new Float32Array(G * G);

  (function initSponge() {
    for (var y = 0; y < G; y++) {
      var dy = Math.min(y, G - 1 - y) / 8;
      var sy = dy < 1 ? dy * dy * (3 - 2 * dy) : 1;
      for (var x = 0; x < G; x++) {
        var dx = Math.min(x, G - 1 - x) / 8;
        var sx = dx < 1 ? dx * dx * (3 - 2 * dx) : 1;
        dampMask[y * G + x] = sx * sy;
      }
    }
  })();

  function packWaveTexture() {
    for (var i = 0, n = G * G; i < n; i++) {
      var val = u[i] / H_SCALE * 0.5 + 0.5;
      if (val < 0) val = 0; else if (val > 1) val = 1;
      var iv = (val * 65535 + 0.5) | 0;
      var p = i << 2;
      texBytes[p] = (iv >> 8) & 255;
      texBytes[p + 1] = iv & 255;
      texBytes[p + 2] = 0;
      texBytes[p + 3] = 255;
    }
  }
  packWaveTexture();

  var waveTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, waveTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, G, G, 0, gl.RGBA, gl.UNSIGNED_BYTE, texBytes);

  /* ---------- 着色器 ---------- */
  var VS = 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}';

  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes, uBasin;',
    'uniform float uTime, uDark, uFoc, uGrainSeed;',
    'uniform vec3 uC, uF, uR, uU;',
    'uniform sampler2D uWave;',
    '',
    'float hash(vec2 p){',
    '  p = fract(p * vec2(123.34, 456.21));',
    '  p += dot(p, p + 45.32);',
    '  return fract(p.x * p.y);',
    '}',
    '',
    'float gs(vec2 d, float r){ return exp(-dot(d, d) / (r * r)); }',
    '',
    'float decTex(vec2 ij){',
    '  vec4 c = texture2D(uWave, (ij + 0.5) / 128.0);',
    '  return ((c.r * 65280.0 + c.g * 255.0) - 32768.0) * (0.60 / 32768.0);',
    '}',
    '',
    '// 3x3 二次 B 样条插值 + 解析梯度（C1 连续，消除网格折痕）',
    'float waveSmooth(vec2 p, out vec2 wg){',
    '  wg = vec2(0.0);',
    '  vec2 g = (p - vec2(-6.0, -5.5)) * (128.0 / 12.0) - 0.5;',
    '  if(g.x < 1.0 || g.y < 1.0 || g.x > 125.0 || g.y > 125.0) return 0.0;',
    '  vec2 fl = floor(g);',
    '  vec2 i = fl - 1.0;',
    '  vec2 f = g - fl;',
    '  vec2 w0 = 0.5 * (1.0 - f) * (1.0 - f);',
    '  vec2 w1 = 0.5 + f - f * f;',
    '  vec2 w2 = 0.5 * f * f;',
    '  vec2 dw0 = f - 1.0;',
    '  vec2 dw1 = 1.0 - 2.0 * f;',
    '  vec2 dw2 = f;',
    '  float r00 = decTex(i), r10 = decTex(i + vec2(1.0, 0.0)), r20 = decTex(i + vec2(2.0, 0.0));',
    '  float r01 = decTex(i + vec2(0.0, 1.0)), r11 = decTex(i + vec2(1.0, 1.0)), r21 = decTex(i + vec2(2.0, 1.0));',
    '  float r02 = decTex(i + vec2(0.0, 2.0)), r12 = decTex(i + vec2(1.0, 2.0)), r22 = decTex(i + vec2(2.0, 2.0));',
    '  float y0 = r00 * w0.x + r10 * w1.x + r20 * w2.x;',
    '  float y1 = r01 * w0.x + r11 * w1.x + r21 * w2.x;',
    '  float y2 = r02 * w0.x + r12 * w1.x + r22 * w2.x;',
    '  float dx0 = r00 * dw0.x + r10 * dw1.x + r20 * dw2.x;',
    '  float dx1 = r01 * dw0.x + r11 * dw1.x + r21 * dw2.x;',
    '  float dx2 = r02 * dw0.x + r12 * dw1.x + r22 * dw2.x;',
    '  float scale = 128.0 / 12.0;',
    '  wg = vec2(dx0 * w0.y + dx1 * w1.y + dx2 * w2.y, y0 * dw0.y + y1 * dw1.y + y2 * dw2.y) * scale;',
    '  return y0 * w0.y + y1 * w1.y + y2 * w2.y;',
    '}',
    '',
    'float waveVal(vec2 p){',
    '  vec2 g = (p - vec2(-6.0, -5.5)) * (128.0 / 12.0) - 0.5;',
    '  if(g.x < 1.0 || g.y < 1.0 || g.x > 125.0 || g.y > 125.0) return 0.0;',
    '  vec2 fl = floor(g);',
    '  vec2 i = fl - 1.0;',
    '  vec2 f = g - fl;',
    '  vec2 w0 = 0.5 * (1.0 - f) * (1.0 - f);',
    '  vec2 w1 = 0.5 + f - f * f;',
    '  vec2 w2 = 0.5 * f * f;',
    '  float y0 = decTex(i) * w0.x + decTex(i + vec2(1.0, 0.0)) * w1.x + decTex(i + vec2(2.0, 0.0)) * w2.x;',
    '  float y1 = decTex(i + vec2(0.0, 1.0)) * w0.x + decTex(i + vec2(1.0, 1.0)) * w1.x + decTex(i + vec2(2.0, 1.0)) * w2.x;',
    '  float y2 = decTex(i + vec2(0.0, 2.0)) * w0.x + decTex(i + vec2(1.0, 2.0)) * w1.x + decTex(i + vec2(2.0, 2.0)) * w2.x;',
    '  return y0 * w0.y + y1 * w1.y + y2 * w2.y;',
    '}',
    '',
    'float H0(vec2 p){',
    '  float tt = uTime;',
    '  vec2 d0 = p - uBasin;',
    '  float r2 = d0.x * d0.x * 0.46 + d0.y * d0.y * 0.38;',
    '  float h = 0.56 - 0.90 * exp(-r2 * 0.82) + 0.022 * r2;',
    '  h += 0.44 * gs(p - vec2(-2.55, -1.25), 1.65);',
    '  h += 0.52 * gs(p - vec2( 2.65, -0.55), 1.60);',
    '  h -= 0.30 * gs(p - vec2(-1.85,  2.05), 1.32);',
    '  h += 0.36 * gs(p - vec2( 2.10,  2.45), 1.48);',
    '  h -= 0.20 * gs(p - vec2( 0.25, -2.15), 1.28);',
    '  h += 0.095 * sin(p.x * 0.78 + tt * 0.20) * cos(p.y * 0.70 - tt * 0.15);',
    '  h += 0.055 * cos((p.x * 0.62 - p.y * 0.82) * 1.28 + tt * 0.13);',
    '  return h;',
    '}',
    '',
    'float H(vec2 p){ return H0(p) + waveVal(p); }',
    '',
    'void main(){',
    '  vec2 s = (2.0 * gl_FragCoord.xy - uRes) / uRes.y;',
    '  vec3 ro = uC;',
    '  vec3 rayRaw = uF * uFoc + s.x * uR + s.y * uU;',
    '  float invRayLen = 1.0 / length(rayRaw);',
    '  vec3 rd = rayRaw * invRayLen;',
    '',
    '  float zMax = 1.62, zMin = -1.02;',
    '  float tNear = 0.24, tFar = 19.5;',
    '  bool canHit = true;',
    '  if(ro.z > zMax){',
    '    if(rd.z >= -0.004) canHit = false;',
    '    else tNear = max(0.24, (zMax - ro.z) / rd.z);',
    '  }',
    '  if(rd.z < -0.015){',
    '    tFar = min(19.5, max(tNear + 0.4, (zMin - ro.z) / rd.z));',
    '  } else if(ro.z < zMax && rd.z > 0.004){',
    '    tFar = min(19.5, max(tNear + 0.4, (zMax - ro.z) / rd.z));',
    '  }',
    '',
    '  // 28 步连续步进 + 7 次二分 + 末步割线插值：彻底消除步进区间量化断续纹',
    '  float tA = tNear, tB = tFar;',
    '  float dA = ro.z + rd.z * tNear - H(ro.xy + rd.xy * tNear);',
    '  float dB = -1.0;',
    '  float prevT = tNear, prevD = dA;',
    '  bool hit = false;',
    '  if(canHit){',
    '    for(int i = 1; i <= 28; i++){',
    '      float fi = float(i) / 28.0;',
    '      float t = mix(tNear, tFar, fi * (0.52 + 0.48 * fi));',
    '      vec3 pos = ro + rd * t;',
    '      float d = pos.z - H(pos.xy);',
    '      if(d <= 0.0 && !hit){',
    '        tA = prevT; tB = t;',
    '        dA = prevD; dB = d;',
    '        hit = true;',
    '      }',
    '      prevT = t; prevD = d;',
    '    }',
    '  }',
    '',
    '  if(hit){',
    '    for(int j = 0; j < 7; j++){',
    '      float tm = 0.5 * (tA + tB);',
    '      vec3 pm = ro + rd * tm;',
    '      float dm = pm.z - H(pm.xy);',
    '      if(dm > 0.0){ tA = tm; dA = dm; }',
    '      else { tB = tm; dB = dm; }',
    '    }',
    '  }',
    '  float frac = clamp(dA / max(dA - dB, 1e-5), 0.0, 1.0);',
    '  float tHit = hit ? mix(tA, tB, frac) : 19.5;',
    '  vec3 P3 = ro + rd * tHit;',
    '  vec2 P = P3.xy;',
    '',
    '  vec2 wg;',
    '  float wVal = waveSmooth(P, wg);',
    '  float h0 = H0(P);',
    '  float h = h0 + wVal;',
    '',
    '  // 解析 + 高精度梯度与法线',
    '  float eps = 0.012;',
    '  vec2 g0 = vec2(H0(P + vec2(eps, 0.0)) - H0(P - vec2(eps, 0.0)),',
    '                 H0(P + vec2(0.0, eps)) - H0(P - vec2(0.0, eps))) / (2.0 * eps);',
    '  vec2 grad = g0 + wg;',
    '  vec3 N3 = normalize(vec3(-grad.x, -grad.y, 1.0));',
    '',
    '  // 切平面解析屏幕像素雅可比（L2 各向同性线宽，零锯齿、零虚线）',
    '  const float INTERVALS = 16.0;',
    '  float hs = h * INTERVALS;',
    '  float pxStep = (2.0 / uRes.y) * invRayLen;',
    '  vec3 dRdx = (uR - rd * dot(rd, uR)) * pxStep;',
    '  vec3 dRdy = (uU - rd * dot(rd, uU)) * pxStep;',
    '  float denomN = min(dot(N3, rd), -0.11);',
    '  vec3 dPx3 = tHit * (dRdx - rd * (dot(N3, dRdx) / denomN));',
    '  vec3 dPy3 = tHit * (dRdy - rd * (dot(N3, dRdy) / denomN));',
    '  float dhx = INTERVALS * dot(grad, dPx3.xy);',
    '  float dhy = INTERVALS * dot(grad, dPy3.xy);',
    '  float fw = max(length(vec2(dhx, dhy)), 1e-4);',
    '',
    '  float fr = fract(hs);',
    '  float dPx = min(fr, 1.0 - fr) / fw;',
    '  float sc = clamp(uRes.y / 900.0, 0.72, 1.35);',
    '',
    '  // 主等高细线与每 4 层略加重的计曲线',
    '  float idx4 = abs(mod(floor(hs + 0.5), 4.0));',
    '  float isMajor = 1.0 - step(0.5, min(idx4, 4.0 - idx4));',
    '  float fadeDense = 1.0 - smoothstep(0.42, 0.92, fw);',
    '  float lineW = (0.68 + 0.32 * isMajor) * sc;',
    '  float lineMask = (1.0 - smoothstep(lineW * 0.35, lineW * 1.32, dPx)) * fadeDense;',
    '',
    '  // 俯冲拉近时渐显的加密细等高线',
    '  float fr2 = fract(hs * 2.0);',
    '  float dPx2 = min(fr2, 1.0 - fr2) / (fw * 2.0);',
    '  float subLine = (1.0 - smoothstep(0.25 * sc, 0.95 * sc, dPx2)) * (1.0 - smoothstep(0.11, 0.25, fw));',
    '',
    '  // 柔和建筑石膏浅浮雕光影 + 胶片纸底',
    '  vec3 L = normalize(vec3(-0.48, 0.62, 0.62));',
    '  float diff = clamp(dot(N3, L), 0.0, 1.0);',
    '  float elev = clamp((h + 0.45) / 1.48, 0.0, 1.0);',
    '  vec3 paperHaze = vec3(0.916, 0.910, 0.888);',
    '  vec3 shadeLow  = vec3(0.818, 0.813, 0.796);',
    '  vec3 shadeHigh = vec3(0.946, 0.941, 0.924);',
    '  vec3 surf = mix(shadeLow, shadeHigh, smoothstep(0.0, 1.0, elev * 0.56 + diff * 0.44));',
    '',
    '  // 极克制的等高台阶微阴影（赋予曲面厚度而不脏画面）',
    '  float stepShadow = exp(-(1.0 - fr) / max(fw * 3.4 * sc, 1e-3)) * (0.075 + 0.065 * (1.0 - diff)) * fadeDense;',
    '  surf *= (1.0 - stepShadow * vec3(0.82, 0.79, 0.74));',
    '',
    '  // 克制光学彩虹薄膜色描边（主要出现在等高线边缘折射、外围视角与波纹起伏处）',
    '  float rr = dot(s, s);',
    '  // 左下标题阅读区保持素雅低色度，不抢标题视觉焦点',
    '  float calmTextZone = smoothstep(0.25, 1.05, length(s - vec2(-0.55, -0.35)));',
    '  float waveEnergy = clamp(length(wg) * 2.6 + abs(wVal) * 2.4, 0.0, 1.35);',
    '  float viewGraze = 1.0 - clamp(dot(N3, -rd), 0.0, 1.0);',
    '  float opd = hs * 0.13 + viewGraze * 1.9 + waveEnergy * 1.05 - uTime * 0.03;',
    '  vec3 rawSpec = 0.5 + 0.5 * cos(6.28318 * (opd + vec3(0.02, 0.35, 0.68)));',
    '  vec3 film = mix(vec3(0.52, 0.51, 0.49), rawSpec, 0.62);',
    '',
    '  // 沿等高细线旁侧 0.5~3.5px 处叠一层薄膜干涉棱光 + 极细微棱镜色散',
    '  float edgeHalo = exp(-abs(dPx - 1.15 * sc) / (1.85 * sc)) * fadeDense;',
    '  float filmAmt = (0.08 + 0.24 * rr * calmTextZone + 0.52 * waveEnergy + 0.10 * isMajor * calmTextZone);',
    '  float ca = (0.36 + 0.72 * rr * calmTextZone + 0.65 * waveEnergy) * sc;',
    '  vec3 caBand = exp(-abs(vec3(dPx - ca, dPx, dPx + ca)) / (1.15 * sc)) * fadeDense;',
    '  surf += (caBand - vec3(caBand.g)) * (0.075 * calmTextZone + 0.14 * waveEnergy);',
    '',
    '  // 温润石墨细线叠印薄膜光谱微光',
    '  float filmOnLine = clamp(0.14 * calmTextZone + 0.18 * rr + 0.52 * waveEnergy, 0.0, 0.74);',
    '  vec3 graphite = mix(vec3(0.42, 0.41, 0.39), vec3(0.24, 0.235, 0.22), isMajor);',
    '  vec3 inkCol = mix(graphite, film * 0.74, filmOnLine);',
    '  float totalLine = clamp(lineMask * (0.40 + 0.28 * isMajor) + subLine * 0.15, 0.0, 0.82);',
    '  vec3 col = mix(surf, inkCol, totalLine);',
    '  col += (film - 0.5) * edgeHalo * filmAmt * 0.52;',
    '',
    '  // 远景雾化自然融入浅灰底色',
    '  float fog = hit ? smoothstep(11.8, 19.2, tHit) : 1.0;',
    '  col = mix(col, paperHaze, fog);',
    '',
    '  // 俯冲过渡至 #151515 深色分区',
    '  if(uDark > 0.001){',
    '    float d1 = smoothstep(0.0, 0.74, uDark);',
    '    float d2 = smoothstep(0.64, 1.0, uDark);',
    '    vec3 darkBg = vec3(0.08235);',
    '    vec3 nightGlow = mix(vec3(0.52, 0.51, 0.48), rawSpec, 0.38);',
    '    vec3 nightScene = darkBg + nightGlow * (totalLine * 0.40 + edgeHalo * 0.10) * (1.0 - fog);',
    '    col = mix(col, nightScene, d1);',
    '    col = mix(col, darkBg, d2);',
    '  }',
    '',
    '  // 胶片颗粒',
    '  float grainAmp = 0.035 * (1.0 - smoothstep(0.84, 0.99, uDark));',
    '  float gr = hash(gl_FragCoord.xy + vec2(uGrainSeed * 71.3, uGrainSeed * 37.9)) - 0.5;',
    '  col += gr * grainAmp;',
    '',
    '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
    '}'
  ].join('\n');

  function compileShader(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('Shader error:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  var vs = compileShader(gl.VERTEX_SHADER, VS);
  var fs = compileShader(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) {
    document.documentElement.classList.add('no-gl');
    return;
  }

  var progGL = gl.createProgram();
  gl.attachShader(progGL, vs);
  gl.attachShader(progGL, fs);
  gl.linkProgram(progGL);
  if (!gl.getProgramParameter(progGL, gl.LINK_STATUS)) {
    document.documentElement.classList.add('no-gl');
    return;
  }
  gl.useProgram(progGL);

  var quadBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aPos = gl.getAttribLocation(progGL, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var U = {};
  ['uRes', 'uBasin', 'uTime', 'uDark', 'uFoc', 'uGrainSeed', 'uC', 'uF', 'uR', 'uU', 'uWave'].forEach(function (k) {
    U[k] = gl.getUniformLocation(progGL, k);
  });
  gl.uniform1i(U.uWave, 0);

  /* ---------- CPU 侧同步几何与射线拾取 ---------- */
  var reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  var isCoarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);

  var W = 1, Hh = 1;
  var simTime = 0, lastNow = 0, rafId = 0, running = false;
  var scrollProg = 0, smoothProg = 0;
  var basinXY = [0.82, 0.55];
  var camC = [0, -5.5, 3.5], camF = [0, 0.8, -0.5], camR = [1, 0, 0], camU = [0, 0.5, 0.8], camFoc = 1.84;
  var waveDirty = true, waveEnergySum = 1;

  function gsJS(dx, dy, r) { return Math.exp(-(dx * dx + dy * dy) / (r * r)); }

  function H0JS(px, py, tt) {
    var d0x = px - basinXY[0], d0y = py - basinXY[1];
    var r2 = d0x * d0x * 0.46 + d0y * d0y * 0.38;
    var h = 0.56 - 0.90 * Math.exp(-r2 * 0.82) + 0.022 * r2;
    h += 0.44 * gsJS(px + 2.55, py + 1.25, 1.65);
    h += 0.52 * gsJS(px - 2.65, py + 0.55, 1.60);
    h -= 0.30 * gsJS(px + 1.85, py - 2.05, 1.32);
    h += 0.36 * gsJS(px - 2.10, py - 2.45, 1.48);
    h -= 0.20 * gsJS(px - 0.25, py + 2.15, 1.28);
    h += 0.095 * Math.sin(px * 0.78 + tt * 0.20) * Math.cos(py * 0.70 - tt * 0.15);
    h += 0.055 * Math.cos((px * 0.62 - py * 0.82) * 1.28 + tt * 0.13);
    return h;
  }

  function waveAtCPU(px, py) {
    var gx = (px - X0) / DX - 0.5;
    var gy = (py - Y0) / DX - 0.5;
    if (gx < 0 || gy < 0 || gx >= G - 1 || gy >= G - 1) return 0;
    var ix = gx | 0, iy = gy | 0;
    var fx = gx - ix, fy = gy - iy;
    var idx = iy * G + ix;
    var a = u[idx] + (u[idx + 1] - u[idx]) * fx;
    var b = u[idx + G] + (u[idx + G + 1] - u[idx + G]) * fx;
    return a + (b - a) * fy;
  }

  function bez3(a, b, c, t) {
    var mt = 1 - t;
    return [
      mt * mt * a[0] + 2 * mt * t * b[0] + t * t * c[0],
      mt * mt * a[1] + 2 * mt * t * b[1] + t * t * c[1],
      mt * mt * a[2] + 2 * mt * t * b[2] + t * t * c[2]
    ];
  }

  function norm3(a) {
    var l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  }

  function cross3(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }

  function updateCamera() {
    var p = easeInOut(Math.min(1, Math.max(0, smoothProg / 0.94)));
    var portrait = innerWidth < innerHeight;
    basinXY[0] = portrait ? 0.22 : 0.85;
    basinXY[1] = portrait ? 0.42 : 0.55;

    var bx = basinXY[0], by = basinXY[1];
    var C0 = portrait ? [0.00, -6.10, 4.10] : [-0.52, -5.55, 3.48];
    var Cm = portrait ? [0.10, -2.50, 1.82] : [ 0.18, -2.25, 1.62];
    var C1 = [bx - 0.02, by - 0.45, portrait ? 0.62 : 0.58];

    var T0 = portrait ? [0.14,  0.28, -0.05] : [0.46, 0.42,  0.02];
    var Tm = portrait ? [0.18,  0.68, -0.18] : [0.68, 0.72, -0.16];
    var T1 = [bx, by + 0.52, -0.38];

    camC = bez3(C0, Cm, C1, p);
    if (!reduceMotion) {
      camC[0] += Math.sin(simTime * 0.15) * 0.05 * (1 - p * 0.7);
      camC[2] += Math.cos(simTime * 0.12) * 0.025 * (1 - p * 0.7);
    }
    var tgt = bez3(T0, Tm, T1, p);
    camF = norm3([tgt[0] - camC[0], tgt[1] - camC[1], tgt[2] - camC[2]]);
    camR = norm3(cross3(camF, [0, 0, 1]));
    camU = cross3(camR, camF);
    camFoc = portrait ? 1.72 : 1.84;
  }

  function raycastTerrain(clientX, clientY) {
    var sx = (2 * clientX - innerWidth) / Math.max(1, innerHeight);
    var sy = (innerHeight - 2 * clientY) / Math.max(1, innerHeight);
    var rdx = camF[0] * camFoc + sx * camR[0] + sy * camU[0];
    var rdy = camF[1] * camFoc + sx * camR[1] + sy * camU[1];
    var rdz = camF[2] * camFoc + sx * camR[2] + sy * camU[2];
    var rl = Math.hypot(rdx, rdy, rdz) || 1;
    rdx /= rl; rdy /= rl; rdz /= rl;

    var prevT = 0.25;
    var tMax = 16.0;
    for (var i = 1; i <= 28; i++) {
      var fi = i / 28;
      var t = 0.25 + (tMax - 0.25) * (fi * (0.52 + 0.48 * fi));
      var px = camC[0] + rdx * t;
      var py = camC[1] + rdy * t;
      var pz = camC[2] + rdz * t;
      var hz = H0JS(px, py, simTime) + waveAtCPU(px, py);
      if (pz <= hz) {
        var a = prevT, b = t;
        for (var j = 0; j < 5; j++) {
          var m = 0.5 * (a + b);
          var mx = camC[0] + rdx * m, my = camC[1] + rdy * m, mz = camC[2] + rdz * m;
          if (mz > H0JS(mx, my, simTime) + waveAtCPU(mx, my)) a = m; else b = m;
        }
        var th = 0.5 * (a + b);
        return [camC[0] + rdx * th, camC[1] + rdy * th];
      }
      prevT = t;
    }
    if (rdz < -0.02) {
      var tf = -camC[2] / rdz;
      return [camC[0] + rdx * tf, camC[1] + rdy * tf];
    }
    return null;
  }

  /* ---------- 地形按压 / 拖动 / 掠过物理耦合 ---------- */
  function stampDent(wx, wy, depth, radius, pullStrength, rimVel) {
    if (wx < X0 - 1 || wx > X0 + SPAN + 1 || wy < Y0 - 1 || wy > Y0 + SPAN + 1) return;
    var outerR = radius * 1.68;
    var minX = Math.max(1, Math.floor((wx - outerR - X0) / DX));
    var maxX = Math.min(G - 2, Math.ceil((wx + outerR - X0) / DX));
    var minY = Math.max(1, Math.floor((wy - outerR - Y0) / DX));
    var maxY = Math.min(G - 2, Math.ceil((wy + outerR - Y0) / DX));
    var invR2 = 1 / (radius * radius);

    for (var gy = minY; gy <= maxY; gy++) {
      var py = Y0 + (gy + 0.5) * DX - wy;
      var row = gy * G;
      for (var gx = minX; gx <= maxX; gx++) {
        var px = X0 + (gx + 0.5) * DX - wx;
        var q2 = (px * px + py * py) * invR2;
        var idx = row + gx;
        var mask = dampMask[idx];
        if (q2 < 1.0) {
          var bell = (1 - q2) * (1 - q2);
          var target = depth * bell * mask;
          u[idx] += (target - u[idx]) * pullStrength * bell;
          v[idx] *= (1 - 0.35 * pullStrength * bell);
        } else if (q2 < 2.82 && rimVel !== 0) {
          var rq = (Math.sqrt(q2) - 1.0) / 0.68;
          var collar = Math.sin(rq * Math.PI);
          if (collar > 0) {
            v[idx] += (-depth) * rimVel * collar * collar * mask;
          }
        }
      }
    }
    waveDirty = true;
  }

  function addVelocityImpulse(wx, wy, velAmp, radius) {
    if (wx < X0 || wx > X0 + SPAN || wy < Y0 || wy > Y0 + SPAN) return;
    var outerR = radius * 2.1;
    var minX = Math.max(1, Math.floor((wx - outerR - X0) / DX));
    var maxX = Math.min(G - 2, Math.ceil((wx + outerR - X0) / DX));
    var minY = Math.max(1, Math.floor((wy - outerR - Y0) / DX));
    var maxY = Math.min(G - 2, Math.ceil((wy + outerR - Y0) / DX));
    var invR2 = 1 / (radius * radius);
    for (var gy = minY; gy <= maxY; gy++) {
      var py = Y0 + (gy + 0.5) * DX - wy;
      var row = gy * G;
      for (var gx = minX; gx <= maxX; gx++) {
        var px = X0 + (gx + 0.5) * DX - wx;
        var q2 = (px * px + py * py) * invR2;
        if (q2 < 4.4) {
          var w = Math.exp(-q2 * 1.15) * (1 - 0.42 * q2) * dampMask[row + gx];
          v[row + gx] += velAmp * w;
        }
      }
    }
    waveDirty = true;
  }

  function strokeDent(x0, y0, x1, y1, depth, radius, pull, rimVel) {
    var dist = Math.hypot(x1 - x0, y1 - y0);
    var steps = Math.max(1, Math.min(18, Math.ceil(dist / 0.11)));
    for (var s = 1; s <= steps; s++) {
      var t = s / steps;
      stampDent(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, depth, radius, pull, rimVel / steps);
    }
  }

  if (!reduceMotion) {
    addVelocityImpulse(0.95, 0.48, -0.85, 0.72);
  }

  /* ---------- 指针与触摸事件 ---------- */
  var ptr = {
    down: false,
    id: -1,
    mode: -1,
    cx: 0,
    cy: 0,
    wx: 0,
    wy: 0,
    hasW: false,
    lastTap: 0
  };

  function isInteractiveEl(el) {
    return !!(el && el.closest && el.closest('a, button, summary, input, textarea, select, .hdr'));
  }

  function beginPress(clientX, clientY, modeSign) {
    if (scrollProg > 0.92) return;
    updateCamera();
    var w = raycastTerrain(clientX, clientY);
    ptr.down = true;
    ptr.cx = clientX;
    ptr.cy = clientY;
    ptr.mode = modeSign;
    if (stage) stage.classList.add('is-pressing');
    if (w) {
      ptr.wx = w[0];
      ptr.wy = w[1];
      ptr.hasW = true;
      stampDent(w[0], w[1], 0.34 * ptr.mode, 0.74, 0.42, 1.35);
    } else {
      ptr.hasW = false;
    }
    if (!running && !reduceMotion && !document.hidden) API.start();
    else if (reduceMotion) { stepWave(0.016); API.frame(); }
  }

  function movePointer(clientX, clientY) {
    if (scrollProg > 0.95) return;
    ptr.cx = clientX;
    ptr.cy = clientY;
    var w = raycastTerrain(clientX, clientY);
    if (!w) return;

    if (ptr.down) {
      if (ptr.hasW) {
        strokeDent(ptr.wx, ptr.wy, w[0], w[1], 0.36 * ptr.mode, 0.72, 0.46, 1.65);
      } else {
        stampDent(w[0], w[1], 0.36 * ptr.mode, 0.72, 0.46, 1.35);
      }
      ptr.wx = w[0];
      ptr.wy = w[1];
      ptr.hasW = true;
    } else if (!reduceMotion) {
      if (ptr.hasW) {
        var mv = Math.min(0.65, Math.hypot(w[0] - ptr.wx, w[1] - ptr.wy));
        if (mv > 0.004) {
          addVelocityImpulse(w[0], w[1], mv * 0.62, 0.62);
        }
      }
      ptr.wx = w[0];
      ptr.wy = w[1];
      ptr.hasW = true;
    }
  }

  function endPress() {
    if (!ptr.down) return;
    ptr.down = false;
    ptr.id = -1;
    if (stage) stage.classList.remove('is-pressing');
    if (ptr.hasW) {
      addVelocityImpulse(ptr.wx, ptr.wy, -ptr.mode * 1.15, 0.68);
    }
  }

  if (window.PointerEvent) {
    addEventListener('pointerdown', function (e) {
      if (isInteractiveEl(e.target)) return;
      if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
      var now = performance.now();
      var dbl = (now - ptr.lastTap) < 320;
      ptr.lastTap = now;
      var sign = (e.shiftKey || e.button === 2 || dbl) ? 1 : -1;
      ptr.id = e.pointerId;
      beginPress(e.clientX, e.clientY, sign);
    }, { passive: true });

    addEventListener('pointermove', function (e) {
      if (ptr.down && ptr.id !== -1 && e.pointerId !== ptr.id) return;
      movePointer(e.clientX, e.clientY);
    }, { passive: true });

    addEventListener('pointerup', endPress, { passive: true });
    addEventListener('pointercancel', endPress, { passive: true });
  } else {
    addEventListener('touchstart', function (e) {
      if (isInteractiveEl(e.target)) return;
      var t = e.touches[0];
      if (t) beginPress(t.clientX, t.clientY, -1);
    }, { passive: true });
    addEventListener('touchmove', function (e) {
      var t = e.touches[0];
      if (t) movePointer(t.clientX, t.clientY);
    }, { passive: true });
    addEventListener('touchend', endPress, { passive: true });
    addEventListener('touchcancel', endPress, { passive: true });
  }
  addEventListener('blur', endPress);

  /* ---------- 2D 黏弹性波动方程求解步 ---------- */
  function stepWave(dt) {
    if (ptr.down && ptr.hasW) {
      var wHold = raycastTerrain(ptr.cx, ptr.cy);
      if (wHold) {
        ptr.wx = wHold[0];
        ptr.wy = wHold[1];
      }
      stampDent(ptr.wx, ptr.wy, 0.35 * ptr.mode, 0.72, Math.min(0.32, dt * 10.5), 0.35);
    }

    if (!waveDirty && waveEnergySum < 1e-6) return;

    var subSteps = 2;
    var h = Math.min(0.013, dt / subSteps);
    var c2_dx2 = (1.92 * 1.92) / (DX * DX);
    var nu_dx2 = 0.016 / (DX * DX);
    var kSpring = 5.4;
    var gamma = 1.32;
    var energy = 0;

    for (var s = 0; s < subSteps; s++) {
      for (var y = 1; y < G - 1; y++) {
        var row = y * G;
        for (var x = 1; x < G - 1; x++) {
          var i = row + x;
          lap[i] = u[i - 1] + u[i + 1] + u[i - G] + u[i + G] - 4 * u[i];
        }
      }
      for (var y2 = 1; y2 < G - 1; y2++) {
        var row2 = y2 * G;
        for (var x2 = 1; x2 < G - 1; x2++) {
          var j = row2 + x2;
          var vLap = v[j - 1] + v[j + 1] + v[j - G] + v[j + G] - 4 * v[j];
          var acc = c2_dx2 * lap[j] - kSpring * u[j] - gamma * v[j] + nu_dx2 * vLap;
          var sp = dampMask[j];
          var vn = (v[j] + acc * h) * (0.985 + 0.015 * sp);
          var un = (u[j] + vn * h) * (0.992 + 0.008 * sp);
          if (un > 0.56) un = 0.56; else if (un < -0.56) un = -0.56;
          v[j] = vn;
          u[j] = un;
          if (s === subSteps - 1) {
            energy += un * un + vn * vn;
          }
        }
      }
    }

    waveEnergySum = energy;
    packWaveTexture();
    gl.bindTexture(gl.TEXTURE_2D, waveTex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, G, G, gl.RGBA, gl.UNSIGNED_BYTE, texBytes);
    if (energy < 1e-6 && !ptr.down) {
      waveDirty = false;
    }
  }

  /* ---------- 画布尺寸与渲染帧 ---------- */
  function resize() {
    var mobile = isCoarse || innerWidth <= 768;
    var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1 : 1.5);
    var w = Math.max(1, innerWidth);
    var h = Math.max(1, innerHeight);
    var maxPx = mobile ? 9.5e5 : 2.1e6;
    if (w * h * dpr * dpr > maxPx) {
      dpr = Math.sqrt(maxPx / (w * h));
    }
    var nw = Math.max(1, Math.round(w * dpr));
    var nh = Math.max(1, Math.round(h * dpr));
    if (cv.width !== nw || cv.height !== nh) {
      cv.width = nw;
      cv.height = nh;
    }
    W = nw;
    Hh = nh;
    gl.viewport(0, 0, W, Hh);
  }

  function renderFrame() {
    updateCamera();
    var dark = Math.max(0, Math.min(1, (smoothProg - 0.72) / 0.26));
    var grainSeed = reduceMotion ? 0.17 : (Math.floor(simTime * 18) % 97) / 97;

    gl.uniform2f(U.uRes, W, Hh);
    gl.uniform2f(U.uBasin, basinXY[0], basinXY[1]);
    gl.uniform1f(U.uTime, simTime);
    gl.uniform1f(U.uDark, dark);
    gl.uniform1f(U.uFoc, camFoc);
    gl.uniform1f(U.uGrainSeed, grainSeed);
    gl.uniform3fv(U.uC, camC);
    gl.uniform3fv(U.uF, camF);
    gl.uniform3fv(U.uR, camR);
    gl.uniform3fv(U.uU, camU);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function loop(now) {
    rafId = 0;
    if (!running) return;
    var dt = lastNow ? Math.min(0.04, Math.max(0.004, (now - lastNow) / 1000)) : 0.016;
    lastNow = now;
    simTime += dt;

    var k = 1 - Math.pow(0.0008, dt);
    smoothProg += (scrollProg - smoothProg) * Math.min(1, k * 1.85);
    stepWave(dt);
    renderFrame();
    rafId = requestAnimationFrame(loop);
  }

  cv.addEventListener('webglcontextlost', function (e) {
    e.preventDefault();
    API.stop();
    document.documentElement.classList.add('no-gl');
  });

  API.ok = true;
  API.setProgress = function (p) {
    scrollProg = p;
    if (reduceMotion || !running) {
      smoothProg = p;
    }
  };
  API.frame = function () {
    resize();
    renderFrame();
  };
  API.start = function () {
    if (reduceMotion) {
      smoothProg = scrollProg;
      API.frame();
      return;
    }
    if (running) return;
    running = true;
    lastNow = 0;
    if (!rafId) rafId = requestAnimationFrame(loop);
  };
  API.stop = function () {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  addEventListener('resize', function () {
    resize();
    if (!running) renderFrame();
  });

  resize();
  renderFrame();
  document.documentElement.classList.add('gl');
})();
