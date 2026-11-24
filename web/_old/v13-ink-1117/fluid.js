/* =====================================================================
 * v13-ink · 手写 WebGL1 实时二维流体（Stable Fluids）+ 分区水墨晕染转场
 * ---------------------------------------------------------------------
 * 1. 流体求解器：旋度 -> 涡量限制 -> 外力/指针推墨/滚动吹风 -> 散度
 *    -> 雅可比压力迭代 -> 压力梯度投影（无散速度场） -> 半拉格朗日平流扩散
 * 2. 精度自动降级：HALF_FLOAT_OES -> FLOAT -> UNSIGNED_BYTE（双字节 16-bit 零漂移编码）
 * 3. 性能守卫：DPR 上限桌面 1.5 / 手机 1.0；离屏或隐藏标签页立即停帧；
 *    prefers-reduced-motion 下仅预热渲染单帧静态水墨画卷。
 * ===================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarse = function () {
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) || window.innerWidth < 768;
  };

  /* ===================================================================
   * PART 1 · 首屏 WebGL1 Stable Fluids 实时水墨
   * =================================================================== */
  var Fluid = {
    ok: false,
    mode: 'none',
    setScroll: function () {},
    splash: function () {},
    syncLayout: function () {},
    start: function () {},
    stop: function () {}
  };
  window.InkFluid = Fluid;

  var cv = document.getElementById('fluidCv');
  if (cv) initFluid(cv);

  function initFluid(canvas) {
    var gl = null;
    var ctxOpts = {
      alpha: false,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false
    };
    try {
      gl = canvas.getContext('webgl', ctxOpts) || canvas.getContext('experimental-webgl', ctxOpts);
    } catch (e) {
      gl = null;
    }
    if (!gl) {
      root.classList.add('no-gl');
      return;
    }

    var halfExt = gl.getExtension('OES_texture_half_float');
    var halfLin = gl.getExtension('OES_texture_half_float_linear');
    gl.getExtension('EXT_color_buffer_half_float');
    var floatExt = gl.getExtension('OES_texture_float');
    var floatLin = gl.getExtension('OES_texture_float_linear');
    gl.getExtension('WEBGL_color_buffer_float');

    function testRenderable(texType, filter) {
      var tex = gl.createTexture();
      var fb = gl.createFramebuffer();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      var ok = false;
      try {
        gl.getError();
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 4, 4, 0, gl.RGBA, texType, null);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE) {
          gl.clearColor(0, 0, 0, 1);
          gl.clear(gl.COLOR_BUFFER_BIT);
          ok = (gl.getError() === gl.NO_ERROR);
        }
      } catch (e) {
        ok = false;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.deleteFramebuffer(fb);
      gl.deleteTexture(tex);
      return ok;
    }

    var simType = gl.UNSIGNED_BYTE;
    var signedFilter = gl.NEAREST;
    var dyeFilter = gl.LINEAR;
    var byteMode = true;
    var manualVelBilerp = true;
    var manualDyeBilerp = false;
    var modeName = 'rgba8-16bit';

    if (halfExt && halfLin && testRenderable(halfExt.HALF_FLOAT_OES, gl.LINEAR)) {
      simType = halfExt.HALF_FLOAT_OES;
      signedFilter = gl.LINEAR; dyeFilter = gl.LINEAR;
      byteMode = false; manualVelBilerp = false; manualDyeBilerp = false;
      modeName = 'half-linear';
    } else if (floatExt && floatLin && testRenderable(gl.FLOAT, gl.LINEAR)) {
      simType = gl.FLOAT;
      signedFilter = gl.LINEAR; dyeFilter = gl.LINEAR;
      byteMode = false; manualVelBilerp = false; manualDyeBilerp = false;
      modeName = 'float-linear';
    } else if (halfExt && testRenderable(halfExt.HALF_FLOAT_OES, gl.NEAREST)) {
      simType = halfExt.HALF_FLOAT_OES;
      signedFilter = gl.NEAREST; dyeFilter = gl.NEAREST;
      byteMode = false; manualVelBilerp = true; manualDyeBilerp = true;
      modeName = 'half-nearest';
    } else if (floatExt && testRenderable(gl.FLOAT, gl.NEAREST)) {
      simType = gl.FLOAT;
      signedFilter = gl.NEAREST; dyeFilter = gl.NEAREST;
      byteMode = false; manualVelBilerp = true; manualDyeBilerp = true;
      modeName = 'float-nearest';
    } else if (!testRenderable(gl.UNSIGNED_BYTE, gl.LINEAR)) {
      root.classList.add('no-gl');
      return;
    }

    var VS_BASE = [
      'precision highp float;',
      'attribute vec2 aPos;',
      'varying vec2 vUv;',
      'void main(){',
      '  vUv = aPos * 0.5 + 0.5;',
      '  gl_Position = vec4(aPos, 0.0, 1.0);',
      '}'
    ].join('\n');

    /* 双字节 16-bit 编码（RGBA8 降级时：RG 存 vx，BA 存 vy；u=0.5 精确对应 hi=128,lo=0，零漂移、无阶梯条纹） */
    var CODEC = byteMode ? [
      'const float VR = 5.0;',
      'vec2 pk16(float v){',
      '  float u = clamp(v / (2.0 * VR) + 0.5, 0.0, 0.9999);',
      '  float s = u * 256.0;',
      '  float hi = floor(s);',
      '  float lo = floor((s - hi) * 255.0 + 0.5);',
      '  return vec2(hi / 255.0, lo / 255.0);',
      '}',
      'float unpk16(vec2 p){',
      '  float s = floor(p.x * 255.0 + 0.5) + p.y;',
      '  return (s / 256.0 - 0.5) * (2.0 * VR);',
      '}',
      'vec2 decV(vec4 t){ return vec2(unpk16(t.rg), unpk16(t.ba)); }',
      'vec4 encV(vec2 v){ return vec4(pk16(v.x), pk16(v.y)); }',
      'float decS(vec4 t){ return unpk16(t.rg); }',
      'vec4 encS(float s){ return vec4(pk16(s), 0.0, 1.0); }'
    ].join('\n') : [
      'vec2 decV(vec4 t){ return t.xy; }',
      'vec4 encV(vec2 v){ return vec4(v, 0.0, 1.0); }',
      'float decS(vec4 t){ return t.x; }',
      'vec4 encS(float s){ return vec4(s, 0.0, 0.0, 1.0); }'
    ].join('\n');

    var HDR = [
      '#ifdef GL_FRAGMENT_PRECISION_HIGH',
      'precision highp float;',
      '#else',
      'precision mediump float;',
      '#endif',
      'varying vec2 vUv;',
      CODEC
    ].join('\n');

    var VEL_BILERP = manualVelBilerp ? [
      'vec2 sampleVelBi(sampler2D tex, vec2 uv, vec2 texel){',
      '  vec2 st = uv / texel - 0.5;',
      '  vec2 i = floor(st);',
      '  vec2 f = fract(st);',
      '  vec2 p0 = (i + 0.5) * texel;',
      '  vec2 a = decV(texture2D(tex, p0));',
      '  vec2 b = decV(texture2D(tex, p0 + vec2(texel.x, 0.0)));',
      '  vec2 c = decV(texture2D(tex, p0 + vec2(0.0, texel.y)));',
      '  vec2 d = decV(texture2D(tex, p0 + texel));',
      '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
      '}'
    ].join('\n') : [
      'vec2 sampleVelBi(sampler2D tex, vec2 uv, vec2 texel){ return decV(texture2D(tex, uv)); }'
    ].join('\n');

    var DYE_BILERP = manualDyeBilerp ? [
      'vec4 sampleDyeBi(sampler2D tex, vec2 uv, vec2 texel){',
      '  vec2 st = uv / texel - 0.5;',
      '  vec2 i = floor(st);',
      '  vec2 f = fract(st);',
      '  vec2 p0 = (i + 0.5) * texel;',
      '  vec4 a = texture2D(tex, p0);',
      '  vec4 b = texture2D(tex, p0 + vec2(texel.x, 0.0));',
      '  vec4 c = texture2D(tex, p0 + vec2(0.0, texel.y));',
      '  vec4 d = texture2D(tex, p0 + texel);',
      '  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);',
      '}'
    ].join('\n') : [
      'vec4 sampleDyeBi(sampler2D tex, vec2 uv, vec2 texel){ return texture2D(tex, uv); }'
    ].join('\n');

    var FS_INIT_ZERO = HDR + '\nuniform float uSigned;\nvoid main(){ gl_FragColor = uSigned > 0.5 ? encV(vec2(0.0)) : vec4(0.0,0.0,0.0,1.0); }';

    var FS_CURL = [
      HDR,
      'uniform sampler2D uVel;',
      'uniform vec2 uTexel;',
      'void main(){',
      '  float L = decV(texture2D(uVel, vUv - vec2(uTexel.x, 0.0))).y;',
      '  float R = decV(texture2D(uVel, vUv + vec2(uTexel.x, 0.0))).y;',
      '  float B = decV(texture2D(uVel, vUv - vec2(0.0, uTexel.y))).x;',
      '  float T = decV(texture2D(uVel, vUv + vec2(0.0, uTexel.y))).x;',
      '  gl_FragColor = encS(0.5 * (R - L - T + B));',
      '}'
    ].join('\n');

    var FS_VORT = [
      HDR,
      'uniform sampler2D uVel;',
      'uniform sampler2D uCurl;',
      'uniform vec2 uTexel;',
      'uniform float uConfinement, uDt, uWind, uTime;',
      'void main(){',
      '  float L = decS(texture2D(uCurl, vUv - vec2(uTexel.x, 0.0)));',
      '  float R = decS(texture2D(uCurl, vUv + vec2(uTexel.x, 0.0)));',
      '  float B = decS(texture2D(uCurl, vUv - vec2(0.0, uTexel.y)));',
      '  float T = decS(texture2D(uCurl, vUv + vec2(0.0, uTexel.y)));',
      '  float C = decS(texture2D(uCurl, vUv));',
      '  vec2 f = vec2(abs(T) - abs(B), abs(R) - abs(L));',
      '  f /= (length(f) + 1e-4);',
      '  f *= uConfinement * C;',
      '  vec2 v = decV(texture2D(uVel, vUv)) + f * uDt;',
      '  if (abs(uWind) > 1e-4) {',
      '    float gust = 0.68 + 0.38 * sin(vUv.y * 6.8 + uTime * 1.4) + 0.22 * cos(vUv.x * 4.5 - uTime);',
      '    v.x += uWind * gust;',
      '    v.y += uWind * 0.18 * sin(vUv.x * 5.2 + vUv.y * 3.1);',
      '  }',
      '  gl_FragColor = encV(clamp(v, vec2(-4.6), vec2(4.6)));',
      '}'
    ].join('\n');

    var FS_SPLAT_VEL = [
      HDR,
      'uniform sampler2D uTarget;',
      'uniform vec2 uPoint, uForce;',
      'uniform float uAspect, uRadius;',
      'void main(){',
      '  vec2 p = vUv - uPoint;',
      '  p.x *= uAspect;',
      '  float w = exp(-dot(p, p) / uRadius);',
      '  vec2 v = decV(texture2D(uTarget, vUv)) + uForce * w;',
      '  gl_FragColor = encV(clamp(v, vec2(-4.6), vec2(4.6)));',
      '}'
    ].join('\n');

    var FS_SPLAT_DYE = [
      HDR,
      'uniform sampler2D uTarget;',
      'uniform vec2 uPoint;',
      'uniform vec3 uInk;',
      'uniform float uAspect, uRadius;',
      'void main(){',
      '  vec2 p = vUv - uPoint;',
      '  p.x *= uAspect;',
      '  float d2 = dot(p, p);',
      '  float core = exp(-d2 / uRadius);',
      '  float halo = exp(-d2 / (uRadius * 2.8));',
      '  vec3 base = texture2D(uTarget, vUv).rgb;',
      '  base.r = clamp(base.r + uInk.r * core, 0.0, 1.0);',
      '  base.g = clamp(base.g + uInk.g * halo, 0.0, 1.0);',
      '  base.b = clamp(base.b + uInk.b * core, 0.0, 1.0);',
      '  gl_FragColor = vec4(base, 1.0);',
      '}'
    ].join('\n');

    var FS_ADVECT_VEL = [
      HDR,
      VEL_BILERP,
      'uniform sampler2D uVel;',
      'uniform vec2 uTexel, uSimScale;',
      'uniform float uDt, uDissipation;',
      'void main(){',
      '  vec2 v = sampleVelBi(uVel, vUv, uTexel);',
      '  vec2 back = clamp(vUv - uDt * v * uSimScale, uTexel * 0.5, 1.0 - uTexel * 0.5);',
      '  vec2 outV = sampleVelBi(uVel, back, uTexel) * uDissipation;',
      '  float edge = smoothstep(0.0, 0.04, vUv.x) * smoothstep(1.0, 0.96, vUv.x) * smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);',
      '  gl_FragColor = encV(outV * mix(0.6, 1.0, edge));',
      '}'
    ].join('\n');

    var FS_ADVECT_DYE = [
      HDR,
      VEL_BILERP,
      DYE_BILERP,
      'uniform sampler2D uVel, uDye;',
      'uniform vec2 uVelTexel, uDyeTexel, uSimScale;',
      'uniform float uDt, uFadeCore, uFadeWash;',
      'void main(){',
      '  vec2 v = sampleVelBi(uVel, vUv, uVelTexel);',
      '  vec2 back = clamp(vUv - uDt * v * uSimScale, uDyeTexel * 0.5, 1.0 - uDyeTexel * 0.5);',
      '  vec3 c = sampleDyeBi(uDye, back, uDyeTexel).rgb;',
      '  float gL = texture2D(uDye, back - vec2(uDyeTexel.x, 0.0)).g;',
      '  float gR = texture2D(uDye, back + vec2(uDyeTexel.x, 0.0)).g;',
      '  float gB = texture2D(uDye, back - vec2(0.0, uDyeTexel.y)).g;',
      '  float gT = texture2D(uDye, back + vec2(0.0, uDyeTexel.y)).g;',
      '  c.g = mix(c.g, 0.25 * (gL + gR + gB + gT), 0.05);',
      '  c.r *= uFadeCore;',
      '  c.g *= uFadeWash;',
      '  c.b *= (uFadeCore * 0.994);',
      '  gl_FragColor = vec4(c, 1.0);',
      '}'
    ].join('\n');

    var FS_DIV = [
      HDR,
      'uniform sampler2D uVel;',
      'uniform vec2 uTexel;',
      'void main(){',
      '  vec2 C = decV(texture2D(uVel, vUv));',
      '  float L = vUv.x - uTexel.x < 0.0 ? -C.x : decV(texture2D(uVel, vUv - vec2(uTexel.x, 0.0))).x;',
      '  float R = vUv.x + uTexel.x > 1.0 ? -C.x : decV(texture2D(uVel, vUv + vec2(uTexel.x, 0.0))).x;',
      '  float B = vUv.y - uTexel.y < 0.0 ? -C.y : decV(texture2D(uVel, vUv - vec2(0.0, uTexel.y))).y;',
      '  float T = vUv.y + uTexel.y > 1.0 ? -C.y : decV(texture2D(uVel, vUv + vec2(0.0, uTexel.y))).y;',
      '  gl_FragColor = encS(0.5 * (R - L + T - B));',
      '}'
    ].join('\n');

    var FS_DECAY_P = [
      HDR,
      'uniform sampler2D uP;',
      'uniform float uDamp;',
      'void main(){ gl_FragColor = encS(decS(texture2D(uP, vUv)) * uDamp); }'
    ].join('\n');

    var FS_JACOBI = [
      HDR,
      'uniform sampler2D uP, uDiv;',
      'uniform vec2 uTexel;',
      'void main(){',
      '  float L = decS(texture2D(uP, vUv - vec2(uTexel.x, 0.0)));',
      '  float R = decS(texture2D(uP, vUv + vec2(uTexel.x, 0.0)));',
      '  float B = decS(texture2D(uP, vUv - vec2(0.0, uTexel.y)));',
      '  float T = decS(texture2D(uP, vUv + vec2(0.0, uTexel.y)));',
      '  float div = decS(texture2D(uDiv, vUv));',
      '  gl_FragColor = encS((L + R + B + T - div) * 0.25);',
      '}'
    ].join('\n');

    var FS_PROJ = [
      HDR,
      'uniform sampler2D uVel, uP;',
      'uniform vec2 uTexel;',
      'void main(){',
      '  float L = decS(texture2D(uP, vUv - vec2(uTexel.x, 0.0)));',
      '  float R = decS(texture2D(uP, vUv + vec2(uTexel.x, 0.0)));',
      '  float B = decS(texture2D(uP, vUv - vec2(0.0, uTexel.y)));',
      '  float T = decS(texture2D(uP, vUv + vec2(0.0, uTexel.y)));',
      '  vec2 v = decV(texture2D(uVel, vUv)) - 0.5 * vec2(R - L, T - B);',
      '  gl_FragColor = encV(clamp(v, vec2(-4.6), vec2(4.6)));',
      '}'
    ].join('\n');

    var FS_DISPLAY = [
      HDR,
      DYE_BILERP,
      'uniform sampler2D uDye;',
      'uniform vec2 uRes, uDyeTexel;',
      'uniform float uTime, uProgress, uMobile, uFootY;',
      'uniform vec4 uTitleBox, uMetaBox, uSubBox;',
      'float hash(vec2 p){',
      '  p = fract(p * vec2(127.1, 311.7));',
      '  p += dot(p, p + 34.23);',
      '  return fract(p.x * p.y);',
      '}',
      'float vnoise(vec2 p){',
      '  vec2 i = floor(p), f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
      '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
      '}',
      'float fbm(vec2 p){',
      '  float s = 0.0, a = 0.5;',
      '  for(int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.07 + vec2(3.1, 7.4); a *= 0.5; }',
      '  return s;',
      '}',
      'float boxMask(vec2 uv, vec4 b, float aspect, float pad, float feather){',
      '  vec2 c = 0.5 * (b.xy + b.zw);',
      '  vec2 h = max(vec2(0.0), 0.5 * (b.zw - b.xy)) + vec2(pad / max(aspect, 0.5), pad);',
      '  vec2 d = abs(uv - c) - h;',
      '  d.x *= aspect;',
      '  float dist = length(max(d, vec2(0.0)));',
      '  return exp(-(dist * dist) / (feather * feather));',
      '}',
      'void main(){',
      '  float aspect = uRes.x / max(uRes.y, 1.0);',
      '  vec2 pUv = vUv;',
      '  float blow = smoothstep(0.02, 0.92, uProgress);',
      '  float wave = (fbm(vUv * vec2(3.6, 4.2) + vec2(-uTime * 0.08, 0.0)) - 0.5) * 0.15;',
      '  vec2 sampleUv = vUv - vec2(blow * (0.62 + 0.25 * vUv.y) + blow * wave, blow * 0.05 * wave);',
      '  float inBounds = smoothstep(-0.02, 0.06, sampleUv.x) * (1.0 - smoothstep(0.96, 1.04, sampleUv.x));',
      '  vec2 clUv = clamp(sampleUv, uDyeTexel * 0.5, 1.0 - uDyeTexel * 0.5);',
      '  vec3 dC = sampleDyeBi(uDye, clUv, uDyeTexel).rgb * inBounds;',
      '  float dR = sampleDyeBi(uDye, clamp(clUv + vec2(uDyeTexel.x * 1.5, 0.0), 0.001, 0.999), uDyeTexel).r * inBounds;',
      '  float dT = sampleDyeBi(uDye, clamp(clUv + vec2(0.0, uDyeTexel.y * 1.5), 0.001, 0.999), uDyeTexel).r * inBounds;',
      '  float rim = length(vec2(dR - dC.r, dT - dC.r));',
      '  vec2 fiberCoord = vec2(pUv.x * aspect, pUv.y) * 9.5;',
      '  float fiber = fbm(fiberCoord) * 0.65 + vnoise(fiberCoord * 3.8) * 0.35;',
      '  float laid = sin(gl_FragCoord.y * 1.4) * 0.0032;',
      '  vec3 paper = vec3(0.937, 0.925, 0.894) + (fiber - 0.5) * 0.026 + laid;',
      '  float rawInk = dC.r * 1.02 + dC.g * 0.42 + rim * 0.72;',
      '  float edgeBleed = smoothstep(0.012, 0.26, rawInk) * (1.0 - smoothstep(0.32, 0.85, rawInk));',
      '  float ink = max(0.0, rawInk + (fiber - 0.48) * 0.16 * edgeBleed);',
      // 文字区可读性呼吸保护：小字与说明文字区严格限浓，大标题区保留柔淡墨丝叠印
      '  float fadeGuard = 1.0 - smoothstep(0.04, 0.28, uProgress);',
      '  float gTitle = boxMask(vUv, uTitleBox, aspect, 0.012, 0.065) * fadeGuard;',
      '  float gMeta  = boxMask(vUv, uMetaBox,  aspect, 0.014, 0.052) * fadeGuard;',
      '  float gSub   = boxMask(vUv, uSubBox,   aspect, 0.016, 0.056) * fadeGuard;',
      '  float gFoot  = (1.0 - smoothstep(uFootY, uFootY + 0.045, vUv.y)) * fadeGuard;',
      '  float gRead  = max(max(gMeta, gSub), gFoot);',
      '  ink = mix(ink, ink / (1.0 + ink / 0.08), gRead);',
      '  float capTitle = mix(0.24, 0.095, uMobile);',
      '  ink = mix(ink, ink / (1.0 + ink / capTitle), gTitle);',
      '  ink *= (1.0 - smoothstep(0.76, 1.0, uProgress) * 0.55);',
      '  vec3 absorb = exp(-ink * vec3(1.65, 1.67, 1.73));',
      '  vec3 col = paper * mix(vec3(0.10, 0.10, 0.096), vec3(1.0), absorb);',
      '  float verm = clamp(dC.b * 0.68, 0.0, 0.44) * (1.0 - max(gRead * 0.88, gTitle * 0.65));',
      '  col = mix(col, vec3(0.702, 0.188, 0.133), verm);',
      '  float grain = hash(gl_FragCoord.xy + fract(uTime * 0.37) * 89.3) - 0.5;',
      '  col += grain * 0.032;',
      '  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);',
      '}'
    ].join('\n');

    function compile(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
      return s;
    }

    var vs = compile(gl.VERTEX_SHADER, VS_BASE);
    if (!vs) { root.classList.add('no-gl'); return; }

    function createProg(fsSrc, uniforms) {
      var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
      if (!fs) return null;
      var p = gl.createProgram();
      gl.attachShader(p, vs);
      gl.attachShader(p, fs);
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      var u = {};
      for (var i = 0; i < uniforms.length; i++) {
        u[uniforms[i]] = gl.getUniformLocation(p, uniforms[i]);
      }
      return { p: p, u: u, aPos: gl.getAttribLocation(p, 'aPos') };
    }

    var P = {
      zero: createProg(FS_INIT_ZERO, ['uSigned']),
      curl: createProg(FS_CURL, ['uVel', 'uTexel']),
      vort: createProg(FS_VORT, ['uVel', 'uCurl', 'uTexel', 'uConfinement', 'uDt', 'uWind', 'uTime']),
      splatVel: createProg(FS_SPLAT_VEL, ['uTarget', 'uPoint', 'uForce', 'uAspect', 'uRadius']),
      splatDye: createProg(FS_SPLAT_DYE, ['uTarget', 'uPoint', 'uInk', 'uAspect', 'uRadius']),
      advVel: createProg(FS_ADVECT_VEL, ['uVel', 'uTexel', 'uSimScale', 'uDt', 'uDissipation']),
      advDye: createProg(FS_ADVECT_DYE, ['uVel', 'uDye', 'uVelTexel', 'uDyeTexel', 'uSimScale', 'uDt', 'uFadeCore', 'uFadeWash']),
      div: createProg(FS_DIV, ['uVel', 'uTexel']),
      decayP: createProg(FS_DECAY_P, ['uP', 'uDamp']),
      jacobi: createProg(FS_JACOBI, ['uP', 'uDiv', 'uTexel']),
      proj: createProg(FS_PROJ, ['uVel', 'uP', 'uTexel']),
      display: createProg(FS_DISPLAY, ['uDye', 'uRes', 'uDyeTexel', 'uTime', 'uProgress', 'uMobile', 'uFootY', 'uTitleBox', 'uMetaBox', 'uSubBox'])
    };

    for (var k in P) {
      if (!P[k]) { root.classList.add('no-gl'); return; }
    }

    var quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    function blit(prog, targetFbo, w, h) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
      gl.viewport(0, 0, w, h);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function use(prog) {
      gl.useProgram(prog.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
      gl.enableVertexAttribArray(prog.aPos);
      gl.vertexAttribPointer(prog.aPos, 2, gl.FLOAT, false, 0, 0);
      return prog.u;
    }

    function bindTex(unit, tex) {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      return unit;
    }

    function makeFBO(w, h, signedField) {
      var flt = signedField ? signedFilter : dyeFilter;
      var tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, flt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, flt);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, simType, null);
      var fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

      var u = use(P.zero);
      gl.uniform1f(u.uSigned, signedField ? 1.0 : 0.0);
      blit(P.zero, fbo, w, h);
      return { tex: tex, fbo: fbo, w: w, h: h };
    }

    function makeDoubleFBO(w, h, signedField) {
      var a = makeFBO(w, h, signedField);
      var b = makeFBO(w, h, signedField);
      return {
        w: w, h: h,
        texelX: 1.0 / w, texelY: 1.0 / h,
        read: a, write: b,
        swap: function () { var t = this.read; this.read = this.write; this.write = t; }
      };
    }

    var simW = 0, simH = 0, dyeW = 0, dyeH = 0;
    var vel, dye, divFbo, curlFbo, pres;
    var dispW = 1, dispH = 1;
    var narrowMode = false, lastNarrowMode = null;

    var guardTitle = [0.04, 0.40, 0.59, 0.72];
    var guardMeta  = [0.04, 0.73, 0.32, 0.78];
    var guardSub   = [0.04, 0.21, 0.56, 0.38];
    var guardFootY = 0.09;

    function isNarrowHero() {
      return (canvas.clientWidth || window.innerWidth) <= 760;
    }

    function updateGuardBoxes() {
      narrowMode = isNarrowHero();
      var stage = document.getElementById('heroStage') || canvas.parentElement;
      var copy  = document.getElementById('heroCopy');
      var meta  = document.getElementById('heroMeta');
      var title = document.getElementById('heroTitle');
      var sub   = document.getElementById('heroSub');
      var act   = copy ? copy.querySelector('.hero-actions') : null;
      var foot  = document.getElementById('heroFoot');
      if (!stage) return;
      var sw = Math.max(1, stage.clientWidth);
      var sh = Math.max(1, stage.clientHeight);
      function toUv(x, y, w, h) {
        return [
          Math.max(0, Math.min(1, x / sw)),
          Math.max(0, Math.min(1, 1 - (y + h) / sh)),
          Math.max(0, Math.min(1, (x + w) / sw)),
          Math.max(0, Math.min(1, 1 - y / sh))
        ];
      }
      if (copy) {
        var cx = copy.offsetLeft;
        var cy = copy.offsetTop;
        if (meta) {
          guardMeta = toUv(cx + meta.offsetLeft, cy + meta.offsetTop, meta.offsetWidth, meta.offsetHeight);
        }
        if (title) {
          var tw = title.parentElement;
          var tx = cx + (tw && tw !== copy ? tw.offsetLeft : 0) + title.offsetLeft;
          var ty = cy + (tw && tw !== copy ? tw.offsetTop : 0) + title.offsetTop;
          guardTitle = toUv(tx, ty, title.offsetWidth, title.offsetHeight);
        }
        if (sub && act) {
          var sx0 = cx + Math.min(sub.offsetLeft, act.offsetLeft);
          var sy0 = cy + Math.min(sub.offsetTop, act.offsetTop);
          var sx1 = cx + Math.max(sub.offsetLeft + sub.offsetWidth, act.offsetLeft + act.offsetWidth);
          var sy1 = cy + Math.max(sub.offsetTop + sub.offsetHeight, act.offsetTop + act.offsetHeight);
          guardSub = toUv(sx0, sy0, sx1 - sx0, sy1 - sy0);
        } else if (sub) {
          guardSub = toUv(cx + sub.offsetLeft, cy + sub.offsetTop, sub.offsetWidth, sub.offsetHeight);
        }
      }
      if (foot) {
        guardFootY = Math.max(0.04, Math.min(0.24, 1 - foot.offsetTop / sh));
      }
    }

    function allocBuffers() {
      var mobile = isCoarse();
      var narrow = isNarrowHero();
      var w = Math.max(320, canvas.clientWidth || window.innerWidth);
      var h = Math.max(320, canvas.clientHeight || window.innerHeight);
      var aspect = w / h;

      var baseSim = mobile ? 112 : 148;
      var baseDye = mobile ? 220 : 320;
      var nSimW = Math.max(92, Math.min(256, Math.round(baseSim * aspect)));
      var nSimH = baseSim;
      var nDyeW = Math.max(168, Math.min(512, Math.round(baseDye * aspect)));
      var nDyeH = baseDye;

      if (!vel || Math.abs(nSimW - simW) > 24 || narrow !== lastNarrowMode) {
        lastNarrowMode = narrow;
        simW = nSimW; simH = nSimH;
        dyeW = nDyeW; dyeH = nDyeH;
        vel = makeDoubleFBO(simW, simH, true);
        dye = makeDoubleFBO(dyeW, dyeH, false);
        divFbo = makeFBO(simW, simH, true);
        curlFbo = makeFBO(simW, simH, true);
        pres = makeDoubleFBO(simW, simH, true);
        seedCalligraphy();
      }
    }

    function resizeDisplay() {
      var mobile = isCoarse();
      var dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.0 : 1.5);
      var cw = Math.max(1, canvas.clientWidth || window.innerWidth);
      var ch = Math.max(1, canvas.clientHeight || window.innerHeight);
      var px = cw * ch * dpr * dpr;
      if (px > 2100000) dpr *= Math.sqrt(2100000 / px);
      dispW = Math.max(1, Math.round(cw * dpr));
      dispH = Math.max(1, Math.round(ch * dpr));
      if (canvas.width !== dispW || canvas.height !== dispH) {
        canvas.width = dispW;
        canvas.height = dispH;
      }
      updateGuardBoxes();
    }

    function splat(x, y, vx, vy, inkR, inkG, inkB, radius) {
      var aspect = dispW / Math.max(dispH, 1);
      var uV = use(P.splatVel);
      gl.uniform1i(uV.uTarget, bindTex(0, vel.read.tex));
      gl.uniform2f(uV.uPoint, x, y);
      gl.uniform2f(uV.uForce, vx, vy);
      gl.uniform1f(uV.uAspect, aspect);
      gl.uniform1f(uV.uRadius, radius * 1.6);
      blit(P.splatVel, vel.write.fbo, vel.w, vel.h);
      vel.swap();

      if (inkR + inkG + inkB > 1e-4) {
        var uD = use(P.splatDye);
        gl.uniform1i(uD.uTarget, bindTex(0, dye.read.tex));
        gl.uniform2f(uD.uPoint, x, y);
        gl.uniform3f(uD.uInk, inkR, inkG, inkB);
        gl.uniform1f(uD.uAspect, aspect);
        gl.uniform1f(uD.uRadius, radius);
        blit(P.splatDye, dye.write.fbo, dye.w, dye.h);
        dye.swap();
      }
    }

    var simTime = 0;
    var windQueued = 0;
    var scrollProg = 0, scrollProgSmooth = 0;

    function stepSimulation(dt, fadeCore, fadeWash) {
      var u = use(P.curl);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform2f(u.uTexel, vel.texelX, vel.texelY);
      blit(P.curl, curlFbo.fbo, simW, simH);

      u = use(P.vort);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform1i(u.uCurl, bindTex(1, curlFbo.tex));
      gl.uniform2f(u.uTexel, vel.texelX, vel.texelY);
      gl.uniform1f(u.uConfinement, 28.0);
      gl.uniform1f(u.uDt, dt);
      gl.uniform1f(u.uWind, windQueued);
      gl.uniform1f(u.uTime, simTime);
      blit(P.vort, vel.write.fbo, simW, simH);
      vel.swap();
      windQueued *= 0.75;
      if (Math.abs(windQueued) < 1e-4) windQueued = 0;

      u = use(P.div);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform2f(u.uTexel, vel.texelX, vel.texelY);
      blit(P.div, divFbo.fbo, simW, simH);

      u = use(P.decayP);
      gl.uniform1i(u.uP, bindTex(0, pres.read.tex));
      gl.uniform1f(u.uDamp, 0.82);
      blit(P.decayP, pres.write.fbo, simW, simH);
      pres.swap();

      u = use(P.jacobi);
      gl.uniform1i(u.uDiv, bindTex(1, divFbo.tex));
      gl.uniform2f(u.uTexel, pres.texelX, pres.texelY);
      var iters = isCoarse() ? 15 : 20;
      for (var i = 0; i < iters; i++) {
        gl.uniform1i(u.uP, bindTex(0, pres.read.tex));
        blit(P.jacobi, pres.write.fbo, simW, simH);
        pres.swap();
      }

      u = use(P.proj);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform1i(u.uP, bindTex(1, pres.read.tex));
      gl.uniform2f(u.uTexel, vel.texelX, vel.texelY);
      blit(P.proj, vel.write.fbo, simW, simH);
      vel.swap();

      var aspect = dispW / Math.max(dispH, 1);
      var sx = 0.58 / Math.max(aspect, 0.62);
      var sy = 0.58;

      u = use(P.advVel);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform2f(u.uTexel, vel.texelX, vel.texelY);
      gl.uniform2f(u.uSimScale, sx, sy);
      gl.uniform1f(u.uDt, dt);
      gl.uniform1f(u.uDissipation, 0.985);
      blit(P.advVel, vel.write.fbo, simW, simH);
      vel.swap();

      u = use(P.advDye);
      gl.uniform1i(u.uVel, bindTex(0, vel.read.tex));
      gl.uniform1i(u.uDye, bindTex(1, dye.read.tex));
      gl.uniform2f(u.uVelTexel, vel.texelX, vel.texelY);
      gl.uniform2f(u.uDyeTexel, dye.texelX, dye.texelY);
      gl.uniform2f(u.uSimScale, sx, sy);
      gl.uniform1f(u.uDt, dt);
      gl.uniform1f(u.uFadeCore, fadeCore);
      gl.uniform1f(u.uFadeWash, fadeWash);
      blit(P.advDye, dye.write.fbo, dyeW, dyeH);
      dye.swap();
    }

    function renderDisplay() {
      var u = use(P.display);
      gl.uniform1i(u.uDye, bindTex(0, dye.read.tex));
      gl.uniform2f(u.uRes, dispW, dispH);
      gl.uniform2f(u.uDyeTexel, dye.texelX, dye.texelY);
      gl.uniform1f(u.uTime, simTime);
      gl.uniform1f(u.uProgress, scrollProgSmooth);
      gl.uniform1f(u.uMobile, narrowMode ? 1.0 : 0.0);
      gl.uniform1f(u.uFootY, guardFootY);
      gl.uniform4fv(u.uTitleBox, guardTitle);
      gl.uniform4fv(u.uMetaBox, guardMeta);
      gl.uniform4fv(u.uSubBox, guardSub);
      blit(P.display, null, dispW, dispH);
    }

    /* 开屏连续行笔预热：桌面在右侧行云卷涡，手机在文字下方留白区横掠成韵 */
    function seedCalligraphy() {
      var narrow = isNarrowHero();
      if (narrow) {
        var topLim = Math.max(0.28, guardSub[1] - 0.04);
        var botLim = Math.min(topLim - 0.08, guardFootY + 0.05);
        var midY = 0.5 * (topLim + botLim);
        var spanY = Math.max(0.05, 0.40 * (topLim - botLim));
        for (var m = 0; m < 36; m++) {
          simTime += 0.018;
          if (m < 15) {
            var sm = m / 14;
            var mx = 0.80 - sm * 0.36;
            var my = midY + spanY * (0.48 - sm * 0.82) + Math.sin(sm * 4.6) * (spanY * 0.22);
            splat(mx, my, -0.82, -0.42 + Math.cos(sm * 5.6) * 0.72, 0.31, 0.25, m === 4 ? 0.18 : 0.0, 0.00076);
          }
          if (m >= 6 && m < 19) {
            var sm2 = (m - 6) / 13;
            var mx2 = 0.30 + sm2 * 0.36;
            var my2 = midY - spanY * 0.36 + sm2 * (spanY * 0.72);
            splat(mx2, my2, 0.78, 0.48, 0.20, 0.19, 0.0, 0.00068);
          }
          if (m === 18) {
            splat(0.60, midY - spanY * 0.20, 0.92, 0.82, 0.36, 0.26, 0.0, 0.00080);
            splat(0.68, midY + spanY * 0.24, -0.78, 0.66, 0.25, 0.20, 0.14, 0.00068);
          }
          stepSimulation(0.018, 0.999, 0.9995);
        }
        return;
      }

      for (var i = 0; i < 36; i++) {
        var t = i / 35;
        simTime += 0.018;
        if (i < 16) {
          // 主笔：右上向左下弧形挥洒，卷出层叠墨涡（避开说明文字右端）
          var bx = 0.86 - t * 0.38;
          var by = 0.74 - t * 0.40 + Math.sin(t * 5.0) * 0.06;
          splat(bx, by, -2.3, -1.25 + Math.cos(t * 6.0) * 1.35, 0.42, 0.34, i === 3 ? 0.24 : 0.0, 0.0014);
        }
        if (i >= 6 && i < 20) {
          // 副笔：自标题后方轻掠而出，与 SHU Serif 900 大字叠印交融
          var s2 = (i - 6) / 14;
          var cx = 0.33 + s2 * 0.34;
          var cy = 0.46 + s2 * 0.19;
          splat(cx, cy, 2.1, 1.15, 0.24, 0.28, 0.0, 0.0012);
        }
        if (i === 18) {
          // 反向挑锋激起细密涡旋丝缕
          splat(0.70, 0.43, 2.6, 2.2, 0.52, 0.36, 0.0, 0.0015);
          splat(0.77, 0.63, -2.2, 1.8, 0.35, 0.28, 0.18, 0.0011);
        }
        stepSimulation(0.018, 0.999, 0.9995);
      }
    }

    var ptr = { x: 0.5, y: 0.5, active: false, lastT: -10 };
    var splatQueue = [];

    function pointerToUv(clientX, clientY) {
      var r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return null;
      var x = (clientX - r.left) / r.width;
      var y = 1.0 - (clientY - r.top) / r.height;
      if (x < -0.05 || x > 1.05 || y < -0.05 || y > 1.05) return null;
      return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
    }

    function handleMove(clientX, clientY, isTap) {
      if (reduceMotion) return;
      var uv = pointerToUv(clientX, clientY);
      if (!uv) { ptr.active = false; return; }
      if (!ptr.active || isTap) {
        ptr.x = uv.x; ptr.y = uv.y; ptr.active = true;
        if (isTap) {
          var a = Math.random() * 6.283;
          splatQueue.push({
            x: uv.x, y: uv.y,
            vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6,
            r: 0.56, g: 0.48, b: 0.16,
            rad: 0.0016
          });
        }
        return;
      }
      var dx = uv.x - ptr.x;
      var dy = uv.y - ptr.y;
      ptr.x = uv.x; ptr.y = uv.y;
      var dist = Math.hypot(dx, dy);
      if (dist < 0.001) return;
      ptr.lastT = simTime;
      var vx = Math.max(-4.2, Math.min(4.2, dx * 58.0));
      var vy = Math.max(-4.2, Math.min(4.2, dy * 58.0));
      var speed = Math.min(1.0, dist * 18.0);
      splatQueue.push({
        x: uv.x,
        y: uv.y,
        vx: vx,
        vy: vy,
        r: 0.28 + speed * 0.45,
        g: 0.30 + speed * 0.34,
        b: speed > 0.75 ? 0.14 : 0.0,
        rad: isCoarse() ? 0.0019 : 0.0013
      });
    }

    window.addEventListener('pointermove', function (e) {
      handleMove(e.clientX, e.clientY, false);
    }, { passive: true });
    window.addEventListener('pointerdown', function (e) {
      handleMove(e.clientX, e.clientY, true);
    }, { passive: true });
    window.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, true);
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX, e.touches[0].clientY, false);
    }, { passive: true });

    // 无人操作时的极轻自发暗流（细柔缓慢游走，不抢文字视线）
    var ambientTimer = 0;
    function stepAmbient(dt) {
      ambientTimer += dt;
      var idle = (simTime - ptr.lastT) > 1.5;
      if (ambientTimer > (idle ? 0.32 : 0.95)) {
        ambientTimer = 0;
        var a = simTime * 0.42;
        if (narrowMode) {
          var mTop = Math.max(0.28, guardSub[1] - 0.06);
          var mBot = Math.min(mTop - 0.06, guardFootY + 0.06);
          var mMid = 0.5 * (mTop + mBot);
          var mAmp = Math.max(0.03, 0.30 * (mTop - mBot));
          var mx = 0.56 + 0.16 * Math.sin(a) + 0.05 * Math.cos(a * 1.9);
          var my = mMid + mAmp * Math.cos(a * 0.78);
          splat(mx, my, 0.52 * Math.cos(a * 1.25), 0.46 * Math.sin(a * 0.95), idle ? 0.11 : 0.04, idle ? 0.10 : 0.04, 0.0, 0.00072);
        } else {
          var ax = 0.72 + 0.15 * Math.sin(a) + 0.05 * Math.cos(a * 1.9);
          var ay = 0.56 + 0.16 * Math.cos(a * 0.78);
          var avx = 1.35 * Math.cos(a * 1.25);
          var avy = 1.05 * Math.sin(a * 0.95);
          splat(ax, ay, avx, avy, idle ? 0.18 : 0.06, idle ? 0.16 : 0.06, 0.0, 0.0013);
        }
      }
    }

    var running = false;
    var rafId = 0;
    var lastNow = 0;

    function tick(now) {
      rafId = 0;
      if (!running) return;
      var dt = Math.min(0.033, lastNow ? (now - lastNow) / 1000 : 0.016);
      lastNow = now;
      simTime += dt;

      var k = 1.0 - Math.pow(0.001, dt);
      scrollProgSmooth += (scrollProg - scrollProgSmooth) * Math.min(1.0, k * 2.4);

      while (splatQueue.length > 0) {
        var s = splatQueue.shift();
        splat(s.x, s.y, s.vx, s.vy, s.r, s.g, s.b, s.rad);
      }
      if (scrollProgSmooth < 0.72) {
        stepAmbient(dt);
      }

      stepSimulation(dt, 0.9972, 0.9982);
      renderDisplay();
      rafId = requestAnimationFrame(tick);
    }

    resizeDisplay();
    allocBuffers();
    renderDisplay();

    Fluid.ok = true;
    Fluid.mode = modeName;
    root.classList.add('gl');

    Fluid.syncLayout = function () {
      updateGuardBoxes();
      if (reduceMotion || !running) renderDisplay();
    };

    Fluid.setScroll = function (p, deltaP, instant) {
      scrollProg = p;
      if (instant) {
        scrollProgSmooth = p;
        if (p > 0.02) {
          windQueued = Math.min(3.2, p * 3.0);
          for (var i = 0; i < 10; i++) stepSimulation(0.018, 0.998, 0.9985);
        }
        renderDisplay();
        return;
      }
      if (deltaP > 0.0005 && !reduceMotion) {
        windQueued = Math.min(3.2, windQueued + deltaP * 30.0);
      } else if (deltaP < -0.001 && !reduceMotion) {
        windQueued = Math.max(-1.6, windQueued + deltaP * 16.0);
      }
      if (reduceMotion) {
        scrollProgSmooth = p;
        renderDisplay();
      }
    };

    Fluid.splash = function () {
      var ang = Math.random() * Math.PI * 2;
      if (narrowMode) {
        var sTop = Math.max(0.28, guardSub[1] - 0.06);
        var sBot = Math.min(sTop - 0.06, guardFootY + 0.06);
        var rxM = 0.34 + Math.random() * 0.36;
        var ryM = sBot + Math.random() * Math.max(0.05, sTop - sBot);
        splat(rxM, ryM, Math.cos(ang) * 1.15, Math.sin(ang) * 1.15, 0.54, 0.44, 0.18, 0.00088);
        splat(rxM - 0.05, ryM + 0.03, -Math.cos(ang) * 0.95, Math.sin(ang) * 0.95, 0.34, 0.30, 0.0, 0.00072);
      } else {
        var rx = 0.58 + Math.random() * 0.28;
        var ry = 0.38 + Math.random() * 0.36;
        splat(rx, ry, Math.cos(ang) * 3.0, Math.sin(ang) * 2.8, 0.74, 0.62, 0.24, 0.0018);
        splat(rx - 0.06, ry + 0.05, -Math.cos(ang) * 2.4, Math.sin(ang) * 2.0, 0.48, 0.44, 0.0, 0.0014);
      }
      if (reduceMotion || !running) {
        for (var i = 0; i < 14; i++) stepSimulation(0.018, 0.999, 0.999);
        renderDisplay();
      }
    };

    Fluid.start = function () {
      if (reduceMotion) {
        renderDisplay();
        return;
      }
      if (running) return;
      running = true;
      lastNow = 0;
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    Fluid.stop = function () {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    };

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeDisplay();
        allocBuffers();
        renderDisplay();
      }, 100);
    }, { passive: true });
  }

  /* ===================================================================
   * PART 2 · 分区之间的水墨晕染转场小画布（宣纸纤维毛边 + 淡墨水痕随滚动漫延）
   * =================================================================== */
  var bleedEls = [].slice.call(document.querySelectorAll('.bleed'));
  var bleeds = [];

  function hash1(n) {
    var x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  }
  function noise2(x, y, seed) {
    var ix = Math.floor(x), iy = Math.floor(y);
    var fx = x - ix, fy = y - iy;
    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);
    var n00 = hash1(ix + iy * 57.0 + seed);
    var n10 = hash1(ix + 1 + iy * 57.0 + seed);
    var n01 = hash1(ix + (iy + 1) * 57.0 + seed);
    var n11 = hash1(ix + 1 + (iy + 1) * 57.0 + seed);
    return (n00 * (1 - fx) + n10 * fx) * (1 - fy) + (n01 * (1 - fx) + n11 * fx) * fy;
  }
  function fbm2(x, y, seed) {
    return 0.55 * noise2(x, y, seed) + 0.30 * noise2(x * 2.13, y * 2.13, seed + 19.3) + 0.15 * noise2(x * 4.7, y * 4.7, seed + 41.7);
  }

  bleedEls.forEach(function (wrap, idx) {
    var c = wrap.querySelector('.bleed-cv');
    if (!c || !c.getContext) return;
    var ctx = c.getContext('2d');
    if (!ctx) return;

    var W = 360, H = 64;
    c.width = W;
    c.height = H;
    var toDark = wrap.getAttribute('data-dir') === 'to-dark';
    var seed = (idx + 1) * 37.7;

    var field = new Float32Array(W * H);
    for (var y = 0; y < H; y++) {
      var ny = y / (H - 1);
      for (var x = 0; x < W; x++) {
        var nx = x / W;
        var brush = 0.22 * Math.sin(nx * 6.283 + seed) + 0.13 * Math.cos(nx * 13.5 - seed * 0.6);
        var fiber = (fbm2(nx * 14.0, ny * 5.5, seed) - 0.5) * 0.38;
        var fine = (noise2(nx * 56.0, ny * 18.0, seed + 9.1) - 0.5) * 0.13;
        field[y * W + x] = (1.0 - ny) + brush * (1.0 - ny * 0.35) + fiber + fine;
      }
    }

    var img = ctx.createImageData(W, H);
    var data = img.data;
    var fg = toDark ? [19, 19, 18] : [239, 236, 228];

    var item = {
      wrap: wrap,
      ctx: ctx,
      img: img,
      data: data,
      field: field,
      W: W,
      H: H,
      fg: fg,
      lastLevel: -999,
      visible: true,
      draw: function (prog) {
        var level = 0.26 + prog * 0.68;
        if (Math.abs(level - this.lastLevel) < 0.006) return;
        this.lastLevel = level;
        var d = this.data, f = this.field, n = this.W * this.H;
        var r = this.fg[0], g = this.fg[1], b = this.fg[2];
        for (var i = 0; i < n; i++) {
          var yRow = (i / this.W) | 0;
          var p = i << 2;
          if (yRow >= this.H - 3) {
            d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
            continue;
          }
          var diff = level - f[i];
          if (diff > 0.13) {
            d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
          } else if (diff > 0.0) {
            var t = diff / 0.13;
            d[p] = r; d[p + 1] = g; d[p + 2] = b;
            d[p + 3] = (55 + 175 * t * t) | 0;
          } else {
            d[p + 3] = 0;
          }
        }
        this.ctx.putImageData(this.img, 0, 0);
      }
    };
    item.draw(0.55);
    bleeds.push(item);
  });

  if (bleeds.length > 0) {
    root.classList.add('bleed-ok');
  }

  if ('IntersectionObserver' in window) {
    var bio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        for (var i = 0; i < bleeds.length; i++) {
          if (bleeds[i].wrap === en.target) bleeds[i].visible = en.isIntersecting;
        }
      });
    }, { rootMargin: '120px 0px 120px 0px' });
    bleeds.forEach(function (b) { bio.observe(b.wrap); });
  }

  window.InkBleed = {
    update: function () {
      var vh = Math.max(1, window.innerHeight);
      for (var i = 0; i < bleeds.length; i++) {
        var b = bleeds[i];
        if (!b.visible && b.lastLevel > -100) continue;
        if (reduceMotion) {
          b.draw(0.58);
          continue;
        }
        var rect = b.wrap.getBoundingClientRect();
        var q = 1.0 - (rect.top / (vh * 0.92));
        if (q < 0) q = 0; else if (q > 1) q = 1;
        b.draw(q);
      }
    }
  };
})();
