/* 首屏地形：手写 WebGL1，全屏三角形 + 片元着色器。
 * 地形 = 一张"损失曲面"：一个主盆地 + 几个局部极小/山脊 + 低频噪声，
 * 量化成台阶；台阶脚下有柔和投影，投影边缘按屏幕半径做 RGB 错位（色散），
 * 再叠一圈薄膜光谱色和胶片颗粒。指针处叠一个带缓动的凸起 + 拖尾凹陷。
 * 对外：window.Terrain = { ok, setProgress(p), start(), stop(), frame() } */
(function () {
  'use strict';
  var cv = document.getElementById('terrain');
  var T = { ok: false, setProgress: function () {}, start: function () {}, stop: function () {}, frame: function () {} };
  window.Terrain = T;
  if (!cv) return;

  var gl = null;
  try {
    var o = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    gl = cv.getContext('webgl', o) || cv.getContext('experimental-webgl', o);
  } catch (e) { gl = null; }
  if (!gl || !gl.getExtension('OES_standard_derivatives')) { document.documentElement.classList.add('no-gl'); return; }

  var VS = 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}';
  var FS = [
    '#extension GL_OES_standard_derivatives : enable',
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2 uRes;uniform float uTime,uDark,uFoc,uPR,uA1,uA2;',
    'uniform vec3 uC,uF,uR,uU;uniform vec2 uM1,uM2;',
    'const float N=15.;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<3;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}',
    'float gs(vec2 d,float r){return exp(-dot(d,d)/(r*r));}',
    'vec2 ground(vec2 s,out float t,out float ok){vec3 rd=normalize(uF*uFoc+s.x*uR+s.y*uU);ok=-rd.z;',
    ' t=uC.z/max(-rd.z,1e-3);return uC.xy+rd.xy*t;}',
    'vec2 W1,W2;',
    'float H(vec2 p){float tt=uTime*.018;vec2 q=p;',
    ' float r2=dot(q,q);',
    ' float h=1.02-.98*exp(-r2/1.7)+.012*r2;',
    ' h-=.30*gs(p-vec2(2.2,1.3),.75);',
    ' h-=.20*gs(p-vec2(-2.3,1.9),.65);',
    ' h+=.20*gs(p-vec2(-1.4,-1.6),.95);',
    ' h+=.16*gs(p-vec2(1.7,-1.2),.6);',
    ' h+=.19*(fbm(p*.62+vec2(tt,-tt*.7))-.5);',
    ' h+=uA1*gs(p-W1,uPR)-uA2*gs(p-W2,uPR*1.5);',
    ' return h;}',
    'void main(){',
    ' vec2 s=(2.*gl_FragCoord.xy-uRes)/uRes.y;',
    ' float t,ok,t1,o1;vec2 P=ground(s,t,ok);',
    ' W1=ground(uM1,t1,o1);W2=ground(uM2,t1,o1);',
    ' vec3 haze=vec3(.93,.928,.92);',
    ' float h=H(P);float e=.015;',
    ' vec2 g=vec2(H(P+vec2(e,0.))-h,H(P+vec2(0.,e))-h)/e;',
    ' float gm=length(g)+1e-4;vec2 n=g/gm;',
    ' float hs=h*N;float k=floor(hs);float fr=hs-k;',
    ' float px=max(fwidth(hs),1e-4);',
    ' float sc=uRes.y/900.;',
    ' float wpp=px/(N*gm);',
    ' vec2 L=normalize(vec2(-.55,.85));',
    ' float face=smoothstep(-.35,.6,dot(n,L));',
    ' float lev=clamp(k/N,0.,1.2);',
    ' vec3 base=mix(vec3(.70,.705,.715),vec3(.962,.958,.95),smoothstep(.0,.75,lev));',
    ' float rr=dot(s,s);',
    ' float ca=(.3+1.7*rr)*sc;',
    ' vec3 sF=vec3((1.-fr)/px)+vec3(-ca,0.,ca);',
    ' vec3 dw=max(sF,0.)*wpp;',
    ' float sw=.075+.05*(1.-face);',
    ' vec3 sh=(1.-smoothstep(vec3(0.),vec3(sw),dw))*(.30+.55*face);',
    ' sh+=exp(-max(sF,0.)/(1.6*sc))*.18;',
    ' vec3 col=base*(1.-sh*vec3(.40,.38,.34));',
    ' vec3 sR=vec3(fr/px)+vec3(ca,0.,-ca);',
    ' col+=exp(-max(sR,0.)/(1.3*sc))*.10*(1.-face*.5);',
    ' float sp=(1.-fr)/px;',
    ' vec3 spec=.5+.5*cos(6.2832*(sp/(16.*sc)+lev*1.3+vec3(0.,.33,.67)));',
    ' float bm=exp(-sp/(9.*sc))*smoothstep(0.,2.*sc,sp)*(.05+.32*rr)*(.4+.6*face)*(1.-smoothstep(.12,.45,px));',
    ' col+=(spec-.5)*bm*.55;',
    ' float aa=smoothstep(.22,.6,px);',
    ' col=mix(col,base*.9,aa);',
    ' col=mix(col,haze,smoothstep(9.,22.,t)+(1.-smoothstep(.02,.12,ok)));',
    ' col+=(hash(gl_FragCoord.xy+fract(uTime*.37)*91.7)-.5)*.05;',
    ' col=mix(col,vec3(.082),uDark);',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function sh(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn(gl.getShaderInfoLog(s)); return null; }
    return s;
  }
  var vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
  if (!vs || !fs) { document.documentElement.classList.add('no-gl'); return; }
  var pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, fs); gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { document.documentElement.classList.add('no-gl'); return; }
  gl.useProgram(pr);
  var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var aLoc = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  var U = {};
  ['uRes', 'uTime', 'uDark', 'uFoc', 'uPR', 'uA1', 'uA2', 'uC', 'uF', 'uR', 'uU', 'uM1', 'uM2'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
  var W = 0, Hh = 0, prog = 0, progS = 0, time = 0, last = 0, raf = 0, running = false;
  // 指针：目标 m，快跟随 m1，慢跟随 m2（拖尾）
  var m = [0.4, -0.2], m1 = [0.4, -0.2], m2 = [0.4, -0.2], a1 = 0, a2 = 0, lastMove = -1e9, vel = 0;

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, touch ? 1 : 1.5);
    var w = innerWidth, h = innerHeight;
    var px = w * h * dpr * dpr, cap = 2.4e6;
    if (px > cap) dpr *= Math.sqrt(cap / px);
    W = Math.max(1, Math.round(w * dpr)); Hh = Math.max(1, Math.round(h * dpr));
    if (cv.width !== W || cv.height !== Hh) { cv.width = W; cv.height = Hh; }
    gl.viewport(0, 0, W, Hh);
  }

  function toS(x, y) { // 像素 → 着色器屏幕坐标 s
    return [(2 * x - innerWidth) / innerHeight, (innerHeight - 2 * y) / innerHeight];
  }
  function onMove(x, y) {
    var s = toS(x, y);
    vel = Math.min(1, vel + Math.hypot(s[0] - m[0], s[1] - m[1]) * 2.2);
    m = s; lastMove = time;
  }
  addEventListener('pointermove', function (e) { onMove(e.clientX, e.clientY); }, { passive: true });
  addEventListener('touchmove', function (e) { var t = e.touches[0]; if (t) onMove(t.clientX, t.clientY); }, { passive: true });
  addEventListener('touchstart', function (e) { var t = e.touches[0]; if (t) { var s = toS(t.clientX, t.clientY); m = s; m1 = s.slice(); m2 = s.slice(); lastMove = time; } }, { passive: true });

  function ease(x) { return x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function norm(v) { var l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }

  function draw() {
    var p = ease(Math.min(1, progS / 0.92));
    var narrow = innerWidth < innerHeight;
    var D = lerp(narrow ? 7.4 : 6.2, 1.25, p);
    var pitch = lerp(0.62, 1.42, p);
    var yaw = lerp(0.42, 1.75, p) + (reduce ? 0 : Math.sin(time * 0.05) * 0.04);
    var tx = lerp(narrow ? -0.2 : -1.25, 0, p), ty = lerp(narrow ? 0.6 : 0.95, 0, p);
    var hd = [Math.sin(yaw), -Math.cos(yaw)];
    var C = [tx + D * Math.cos(pitch) * hd[0], ty + D * Math.cos(pitch) * hd[1], D * Math.sin(pitch)];
    var F = norm([tx - C[0], ty - C[1], -C[2]]);
    var R = norm(cross(F, [0, 0, 1]));
    var Uv = cross(R, F);
    gl.uniform2f(U.uRes, W, Hh);
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uDark, Math.max(0, Math.min(1, (progS - 0.86) / 0.13)));
    gl.uniform1f(U.uFoc, 1.9);
    gl.uniform1f(U.uPR, 0.42 * Math.pow(D / 6.2, 0.8));
    gl.uniform1f(U.uA1, a1); gl.uniform1f(U.uA2, a2);
    gl.uniform3fv(U.uC, C); gl.uniform3fv(U.uF, F); gl.uniform3fv(U.uR, R); gl.uniform3fv(U.uU, Uv);
    gl.uniform2fv(U.uM1, m1); gl.uniform2fv(U.uM2, m2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function tick(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
    time += dt;
    var k = 1 - Math.pow(0.001, dt);      // 帧率无关的缓动系数
    progS += (prog - progS) * Math.min(1, k * 2.2);
    m1[0] += (m[0] - m1[0]) * k * 1.6; m1[1] += (m[1] - m1[1]) * k * 1.6;
    m2[0] += (m1[0] - m2[0]) * k * 0.55; m2[1] += (m1[1] - m2[1]) * k * 0.55;
    var active = time - lastMove < 2.6;
    var tA1 = active ? 0.19 + vel * 0.08 : 0.0;
    a1 += (tA1 - a1) * k * 0.6;
    a2 += (vel * 0.10 - a2) * k * 0.8;
    vel *= Math.pow(0.04, dt);
    draw();
    raf = requestAnimationFrame(tick);
  }

  T.ok = true;
  T.frame = function () { resize(); draw(); };
  T.setProgress = function (p) { prog = p; if (reduce) { progS = p; } };
  T.start = function () {
    if (reduce) { progS = prog; T.frame(); return; }
    if (running) return;
    running = true; last = 0;
    if (!raf) raf = requestAnimationFrame(tick);
  };
  T.stop = function () { running = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } };
  addEventListener('resize', function () { resize(); if (!running) draw(); });
  resize();
  draw();
  document.documentElement.classList.add('gl');
})();
