/* v19-denoise · 去噪渲染器
 * 1) paint(): 把某一拍的真实 HTML（字、图、底色、细线）按它在页面上的位置，
 *    逐字画到一张离屏 canvas 上，当作扩散模型要"生成"的那张干净图 x0。
 * 2) WebGL1 片元着色器按步数 t 混合：x_t = √ᾱ·x0(模糊到对应频段) + √(1-ᾱ)·噪声
 *    · ᾱ 用余弦噪声表（和 DDPM/改进版一致）
 *    · x0 用 mipmap 的 LOD 做低通：t 大时只剩大色块，t 变小逐级加回细节
 *    · 每一步换一组高斯噪声种子，所以读数每跳一步，颗粒就换一次
 */
(function () {
  'use strict';

  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform sampler2D T;',
    'uniform vec2 R;',          // 画布像素尺寸
    'uniform float t;',         // 噪声水平 0..1（= 步数/50）
    'uniform float seed;',      // 每步一组噪声
    'uniform float bseed;',     // 每拍一组低频色块
    'uniform float content;',   // 干净图里是否带内容（HTML 接管后淡出，避免重影）
    'uniform float cell;',      // 颗粒大小（设备像素）
    'uniform float maxLod;',
    'uniform vec4 P;',          // 按住彩蛋：x, y, 半径, 力度
    'uniform vec3 paper;',
    'varying vec2 v;',
    'float h(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}',
    'float g(vec2 p){return (h(p)+h(p+17.17)+h(p+41.71)+h(p+73.37)-2.)*1.732;}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}',
    'void main(){',
    ' vec2 px=gl_FragCoord.xy;',
    ' float pf=P.w*(1.-smoothstep(P.z*.3,P.z,distance(px,P.xy)));',
    ' float tt=max(t,pf*.8);',
    ' float ab=cos((tt+.008)/1.008*1.5707963);ab*=ab;',
    ' vec3 x0=texture2D(T,v,maxLod*pow(tt,.85)).rgb;',
    ' x0=mix(paper,x0,max(content,clamp(pf*3.,0.,1.)));',
    ' vec2 q=px/R.y*4.;',
    ' vec3 lf=vec3(vn(q+bseed),vn(q+bseed+9.3),vn(q+bseed+21.7))-.5;',
    ' lf=mix(vec3(lf.r),lf,.3);',
    ' x0+=lf*.75*smoothstep(.2,.95,tt);',
    ' vec2 c=floor(px/cell)+seed*vec2(37.13,11.71);',
    ' float gl=g(c);',
    ' vec3 e=mix(vec3(gl),vec3(g(c+101.3),g(c+211.7),g(c+307.1)),.2)*.92;',
    ' vec3 x=sqrt(ab)*(x0*2.-1.)+sqrt(1.-ab)*e;',
    ' vec3 col=x*.5+.5;',
    ' col+=(h(floor(px/cell)+.5)-.5)*.045;',   // 静止的胶片颗粒，内容出现后不再动
    ' gl_FragColor=vec4(clamp(col,0.,1.),1.);',
    '}'
  ].join('\n');

  function pow2(n, cap) {
    var p = 256;
    while (p < cap && p * 1.33 < n) p *= 2;
    return Math.min(p, cap);
  }

  function create(canvas) {
    var gl;
    try {
      gl = canvas.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'low-power' }) ||
        canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }
    if (!gl) return null;

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
    } catch (e) { return null; }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var U = {};
    ['T', 'R', 't', 'seed', 'bseed', 'content', 'cell', 'maxLod', 'P', 'paper'].forEach(function (n) {
      U[n] = gl.getUniformLocation(prog, n);
    });
    gl.uniform1i(U.T, 0);

    var maxTex = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048);
    var texs = [], blank = mkTex();
    var W = 1, H = 1, cssW = 1, cssH = 1, dpr = 1, tw = 256, th = 256;
    var scratch = document.createElement('canvas');

    function mkTex() {
      var t = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([235, 234, 229, 255]));
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      return t;
    }

    function resize(w, h, ratio) {
      cssW = w; cssH = h; dpr = ratio;
      W = Math.max(1, Math.round(w * ratio)); H = Math.max(1, Math.round(h * ratio));
      canvas.width = W; canvas.height = H;
      gl.viewport(0, 0, W, H);
      gl.uniform2f(U.R, W, H);
      tw = pow2(W, maxTex); th = pow2(H, maxTex);
      while (tw * th > 2048 * 1024) { if (th >= tw) th /= 2; else tw /= 2; }   // 显存封顶：5 拍纹理合计约 56MB 以内
    }

    /* 把一拍的 DOM 画成干净图并上传成带 mipmap 的纹理 */
    function paintBeat(i, root, origin, paperCss) {
      scratch.width = tw; scratch.height = th;
      var ctx = scratch.getContext('2d');
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = paperCss; ctx.fillRect(0, 0, tw, th);
      ctx.setTransform(tw / cssW, 0, 0, th / cssH, -origin.left * tw / cssW, -origin.top * th / cssH);
      rasterize(ctx, root);
      if (!texs[i]) texs[i] = mkTex();
      gl.bindTexture(gl.TEXTURE_2D, texs[i]);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    }

    var paperRGB = [0.92, 0.918, 0.898];
    function setPaper(rgb) { paperRGB = rgb; }

    function render(s) {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texs[s.beat] || blank);
      gl.uniform1f(U.t, s.t);
      gl.uniform1f(U.seed, s.seed);
      gl.uniform1f(U.bseed, s.beat * 13.7 + 3.1);
      gl.uniform1f(U.content, texs[s.beat] ? s.content : 0);
      gl.uniform1f(U.cell, Math.max(1, Math.round(1.7 * dpr)));
      gl.uniform1f(U.maxLod, Math.log(Math.max(tw, th)) / Math.LN2 - 3.2);
      gl.uniform4f(U.P, s.px * dpr, (cssH - s.py) * dpr, s.pr * dpr, s.pk);
      gl.uniform3f(U.paper, paperRGB[0], paperRGB[1], paperRGB[2]);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }

    return {
      gl: gl, resize: resize, paintBeat: paintBeat, render: render, setPaper: setPaper,
      has: function (i) { return !!texs[i]; }
    };
  }

  /* ---------- 迷你 DOM 光栅器：只画这个站用到的东西 ---------- */
  function alphaOf(c) {
    if (!c || c === 'transparent') return 0;
    var m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 1;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean);
    return p.length > 3 ? parseFloat(p[3]) : 1;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    r = Math.min(r, w / 2, h / 2);
    if (r > 0.5) {
      ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    } else ctx.rect(x, y, w, h);
  }
  function drawImg(ctx, img, r, cs, rad) {
    if (!img.complete || !img.naturalWidth) return;
    var iw = img.naturalWidth, ih = img.naturalHeight, fit = cs.objectFit;
    var pos = (cs.objectPosition || '50% 50%').split(' ');
    var fx = /%/.test(pos[0]) ? parseFloat(pos[0]) / 100 : 0.5;
    var fy = /%/.test(pos[1] || '') ? parseFloat(pos[1]) / 100 : (pos[1] === '0px' ? 0 : 0.5);
    var s = 1, dw = r.width, dh = r.height;
    if (fit === 'cover' || fit === 'contain') {
      s = fit === 'cover' ? Math.max(r.width / iw, r.height / ih) : Math.min(r.width / iw, r.height / ih);
      dw = iw * s; dh = ih * s;
    }
    ctx.save();
    rrect(ctx, r.left, r.top, r.width, r.height, rad); ctx.clip();
    ctx.drawImage(img, r.left + (r.width - dw) * fx, r.top + (r.height - dh) * fy, dw, dh);
    ctx.restore();
  }
  function rasterize(ctx, root) {
    var els = [root].concat([].slice.call(root.querySelectorAll('*')));
    for (var k = 0; k < els.length; k++) {
      var el = els[k];
      if (el.closest('[data-np]')) continue;
      var cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      var rad = parseFloat(cs.borderTopLeftRadius) || 0;
      if (alphaOf(cs.backgroundColor) > 0) {
        ctx.fillStyle = cs.backgroundColor; rrect(ctx, r.left, r.top, r.width, r.height, rad); ctx.fill();
      }
      var bt = parseFloat(cs.borderTopWidth), bb = parseFloat(cs.borderBottomWidth),
        bl = parseFloat(cs.borderLeftWidth), br = parseFloat(cs.borderRightWidth);
      if (rad > 0.5 && bt > 0 && bt === bb && bt === bl && alphaOf(cs.borderTopColor) > 0) {
        ctx.strokeStyle = cs.borderTopColor; ctx.lineWidth = bt;
        rrect(ctx, r.left + bt / 2, r.top + bt / 2, r.width - bt, r.height - bt, rad - bt / 2); ctx.stroke();
      } else {
        if (bt > 0 && alphaOf(cs.borderTopColor) > 0) { ctx.fillStyle = cs.borderTopColor; ctx.fillRect(r.left, r.top, r.width, bt); }
        if (bb > 0 && alphaOf(cs.borderBottomColor) > 0) { ctx.fillStyle = cs.borderBottomColor; ctx.fillRect(r.left, r.bottom - bb, r.width, bb); }
        if (bl > 0 && alphaOf(cs.borderLeftColor) > 0) { ctx.fillStyle = cs.borderLeftColor; ctx.fillRect(r.left, r.top, bl, r.height); }
        if (br > 0 && alphaOf(cs.borderRightColor) > 0) { ctx.fillStyle = cs.borderRightColor; ctx.fillRect(r.right - br, r.top, br, r.height); }
      }
      if (el.tagName === 'IMG') drawImg(ctx, el, r, cs, rad);
    }
    var tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), n, range = document.createRange();
    while ((n = tw.nextNode())) {
      var s = n.nodeValue;
      if (!/\S/.test(s)) continue;
      var pe = n.parentElement;
      if (pe.closest('[data-np]')) continue;
      var pcs = getComputedStyle(pe);
      if (pcs.visibility === 'hidden' || pcs.display === 'none') continue;
      ctx.font = pcs.fontStyle + ' ' + pcs.fontWeight + ' ' + pcs.fontSize + ' ' + pcs.fontFamily;
      ctx.fillStyle = pcs.color;
      if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      var m = ctx.measureText('国H');
      var fs = parseFloat(pcs.fontSize);
      var asc = m.fontBoundingBoxAscent || fs * 0.88, desc = m.fontBoundingBoxDescent || fs * 0.24;
      var off = (asc - desc) / 2;   // 字框中线 → 基线（不管矩形是按字高还是行高给的，中线都一样）
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i), code = s.charCodeAt(i), len = 1;
        if (code >= 0xD800 && code <= 0xDBFF) { ch = s.substr(i, 2); len = 2; }
        if (/\s/.test(ch)) continue;
        range.setStart(n, i); range.setEnd(n, i + len);
        var rs = range.getClientRects();
        if (rs.length && rs[0].width) ctx.fillText(ch, rs[0].left, (rs[0].top + rs[0].bottom) / 2 + off);
        i += len - 1;
      }
    }
  }

  window.Denoise = { create: create };
})();
