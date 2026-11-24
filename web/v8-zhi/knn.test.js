/* KNN 和亮度归一化的离线测试：node knn.test.js
 * 不依赖任何测试框架，全部通过时退出码为 0。 */
'use strict';
var K = require('./knn.js');
var assert = require('assert');

var W = K.W, H = K.H;
var seed = 20261116;
function rand() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
function gauss() { var u = rand() || 1e-9, v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/* 合成一张 32 × 24 的“人像”：暗背景上一个亮的身体，两只手臂要么举起要么放下。
 * dx 让人在画面里左右挪几格，模拟每次站的位置不一样。 */
function person(armsUp, dx) {
  var g = new Float32Array(W * H).fill(0.2);
  function rect(x0, y0, x1, y1, v) {
    for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) {
      var xx = x + dx;
      if (xx >= 0 && xx < W && y >= 0 && y < H) g[y * W + xx] = v;
    }
  }
  rect(13, 3, 18, 8, 0.8);     // 头
  rect(12, 9, 19, 23, 0.7);    // 身体
  if (armsUp) { rect(8, 1, 10, 10, 0.75); rect(21, 1, 23, 10, 0.75); }
  else { rect(8, 10, 10, 21, 0.75); rect(21, 10, 23, 21, 0.75); }
  return g;
}
/* 先加噪声，再整体改亮度和对比度：x' = a·(x + 噪声) + b，最后量化到 0–255 */
function shoot(armsUp, opts) {
  var dx = Math.round((rand() - 0.5) * 4);
  var g = person(armsUp, dx);
  var a = opts.a, b = opts.b, noise = opts.noise;
  for (var i = 0; i < g.length; i++) {
    g[i] = Math.round(Math.min(255, Math.max(0, (a * (g[i] + gauss() * noise) + b) * 255)));
  }
  return g;
}

var passed = 0;
function test(name, fn) { fn(); passed++; console.log('通过  ' + name); }

/* ---------- 归一化本身 ---------- */
test('归一化后均值为 0、标准差为 1', function () {
  var z = K.normalize(shoot(true, { a: 1, b: 0, noise: 0.05 }));
  var m = 0, v = 0, i;
  for (i = 0; i < z.length; i++) m += z[i];
  m /= z.length;
  for (i = 0; i < z.length; i++) v += (z[i] - m) * (z[i] - m);
  assert(Math.abs(m) < 1e-5, '均值 ' + m);
  assert(Math.abs(Math.sqrt(v / z.length) - 1) < 1e-4);
});

test('整体变亮、变暗、对比度变化后，归一化结果不变', function () {
  var base = person(true, 0);
  var z0 = K.normalize(base.map(function (v) { return v * 255; }));
  [[0.3, 0], [0.5, 0.4], [1.2, -0.1], [0.8, 0.15]].forEach(function (ab) {
    var z = K.normalize(base.map(function (v) { return (ab[0] * v + ab[1]) * 255; }));
    assert(K.distance(z0, z) < 1e-3, '亮度 ' + ab + ' 距离 ' + K.distance(z0, z));
  });
});

test('空白画面（标准差为 0）归一化成全 0，不出现 NaN', function () {
  var z = K.normalize(new Float32Array(W * H).fill(200));
  assert(z.every(function (v) { return v === 0; }));
});

/* ---------- KNN 分类 ---------- */
function trainSet(n, light) {
  var ex = [];
  for (var i = 0; i < n; i++) {
    ex.push({ label: 0, id: i + 1, vec: K.normalize(shoot(true, light)) });
    ex.push({ label: 1, id: i + 1, vec: K.normalize(shoot(false, light)) });
  }
  return ex;
}
function accuracy(ex, light, trials, raw) {
  var ok = 0;
  for (var t = 0; t < trials; t++) {
    var up = t % 2 === 0;
    var g = shoot(up, light);
    var r = K.predict(ex, raw ? g : K.normalize(g), 2, 5);
    if (r.top === (up ? 0 : 1)) ok++;
  }
  return ok / trials;
}

var normal = { a: 1, b: 0, noise: 0.08 };
var ex = trainSet(10, normal);

test('同样光线下：200 张新画面全部分对', function () {
  var acc = accuracy(ex, normal, 200);
  console.log('      准确率 ' + (acc * 100).toFixed(1) + '%');
  assert(acc === 1);
});

test('光线大变（暗 0.35 倍 / 亮 +0.45 / 对比度 1.3 倍）：仍然全部分对', function () {
  [{ a: 0.35, b: 0, noise: 0.08 }, { a: 0.55, b: 0.45, noise: 0.08 }, { a: 1.3, b: -0.1, noise: 0.08 }].forEach(function (light) {
    var acc = accuracy(ex, light, 200);
    console.log('      a=' + light.a + ' b=' + light.b + '  准确率 ' + (acc * 100).toFixed(1) + '%');
    assert(acc === 1);
  });
});

test('对照：拍“举手”时灯亮、拍“不举手”时灯暗，不归一化就会按亮度乱认', function () {
  var bright = { a: 1, b: 0.1, noise: 0.08 }, dim = { a: 0.45, b: 0, noise: 0.08 };
  var rawEx = [], zEx = [];
  for (var i = 0; i < 10; i++) {
    var u = shoot(true, bright), d = shoot(false, dim);
    rawEx.push({ label: 0, id: i + 1, vec: u }, { label: 1, id: i + 1, vec: d });
    zEx.push({ label: 0, id: i + 1, vec: K.normalize(u) }, { label: 1, id: i + 1, vec: K.normalize(d) });
  }
  // 测试时灯都开着
  var rawOk = 0, zOk = 0;
  for (var t = 0; t < 200; t++) {
    var up = t % 2 === 0, g = shoot(up, bright), want = up ? 0 : 1;
    if (K.predict(rawEx, g, 2, 5).top === want) rawOk++;
    if (K.predict(zEx, K.normalize(g), 2, 5).top === want) zOk++;
  }
  console.log('      不归一化 ' + (rawOk / 2).toFixed(1) + '%，归一化 ' + (zOk / 2).toFixed(1) + '%');
  assert(rawOk / 200 < 0.75);
  assert.strictEqual(zOk, 200);
});

test('把握：明确的画面把握高，最像的例子来自正确的类别', function () {
  var g = K.normalize(shoot(true, normal));
  var r = K.predict(ex, g, 2, 5);
  assert.strictEqual(r.top, 0);
  assert(r.topP > 0.8, 'topP ' + r.topP);
  assert.strictEqual(ex[r.nearest.index].label, 0);
  assert(Math.abs(r.probs[0] + r.probs[1] - 1) < 1e-9);
});

test('纠错：先只给错的例子，再补几张对的，结果马上改过来', function () {
  // 访客把“不举手”的样子错拍进了“举手”类
  var wrong = [];
  for (var i = 0; i < 4; i++) wrong.push({ label: 0, id: i + 1, vec: K.normalize(shoot(false, normal)) });
  for (i = 0; i < 4; i++) wrong.push({ label: 1, id: i + 1, vec: K.normalize(shoot(true, normal)) });
  var q = K.normalize(shoot(true, normal));
  assert.strictEqual(K.predict(wrong, q, 2, 5).top, 1);
  // 对着“举手”再拍 10 张
  for (i = 0; i < 10; i++) wrong.push({ label: 0, id: 5 + i, vec: K.normalize(shoot(true, normal)) });
  assert.strictEqual(K.predict(wrong, q, 2, 5).top, 0);
});

test('例子少于 k 张时 k 自动变小；没有例子返回 null', function () {
  assert.strictEqual(K.predict([], new Float32Array(W * H), 2, 5), null);
  var r = K.predict(ex.slice(0, 3), K.normalize(shoot(true, normal)), 2, 5);
  assert.strictEqual(r.k, 3);
});

/* ---------- 画板预处理：外框 + 居中 + 缩放 ---------- */
/* 在 320 × 240 的白底画板上画“举手的火柴人”或“放下手的火柴人”，位置和大小都可以变。 */
function stick(armsUp, ox, oy, s) {
  var sw = 320, sh = 240, img = new Float32Array(sw * sh).fill(1);
  function dot(x, y) {
    for (var yy = -5; yy <= 5; yy++) for (var xx = -5; xx <= 5; xx++) {
      var px = Math.round(x + xx), py = Math.round(y + yy);
      if (xx * xx + yy * yy <= 25 && px >= 0 && py >= 0 && px < sw && py < sh) img[py * sw + px] = 0;
    }
  }
  function line(x0, y0, x1, y1) {
    var n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 2);
    for (var i = 0; i <= n; i++) dot(ox + s * (x0 + (x1 - x0) * i / n), oy + s * (y0 + (y1 - y0) * i / n));
  }
  for (var a = 0; a < 24; a++) { var t = a / 24 * Math.PI * 2; dot(ox + s * (50 + 10 * Math.cos(t)), oy + s * (20 + 10 * Math.sin(t))); }
  line(50, 30, 50, 70);                  // 身体
  line(50, 70, 38, 95); line(50, 70, 62, 95); // 腿
  if (armsUp) { line(50, 40, 32, 12); line(50, 40, 68, 12); }
  else { line(50, 40, 34, 64); line(50, 40, 66, 64); }
  return { img: img, sw: sw, sh: sh };
}
function drawGrid(d) {
  var box = K.inkBox(d.img, d.sw, d.sh, 0.5);
  var rect = K.fitBox(box, W / H, 0.12);
  var g = K.resample(d.img, d.sw, d.sh, rect, W, H, 1);
  return K.normalize(K.blur(g, W, H));
}

test('画板：画在不同位置、画得大小不同，仍然认对', function () {
  var dex = [
    { label: 0, id: 1, vec: drawGrid(stick(true, 20, 20, 1.6)) },
    { label: 0, id: 2, vec: drawGrid(stick(true, 120, 40, 1.2)) },
    { label: 1, id: 1, vec: drawGrid(stick(false, 30, 10, 1.7)) },
    { label: 1, id: 2, vec: drawGrid(stick(false, 150, 60, 1.1)) }
  ];
  var cases = [[true, 200, 100, 0.9], [true, 5, 5, 2.0], [false, 180, 90, 1.0], [false, 60, 30, 1.5], [true, 90, 70, 1.3], [false, 10, 120, 1.0]];
  cases.forEach(function (c) {
    var r = K.predict(dex, drawGrid(stick(c[0], c[1], c[2], c[3])), 2, 3);
    assert.strictEqual(r.top, c[0] ? 0 : 1, '位置 ' + c.slice(1));
  });
});

test('画板：空白画板没有墨迹外框', function () {
  assert.strictEqual(K.inkBox(new Float32Array(320 * 240).fill(1), 320, 240, 0.5), null);
});

console.log('\n全部 ' + passed + ' 项通过');
