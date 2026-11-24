// 离线测试（node model-test.js）：合成两类笔迹，各 3 个例子训练，再用 200 个新的测
const M = require("./model.js");
const assert = require("assert");

function makeGen(seed) {
  const r = M.rng(seed);
  const u = (a, b) => a + (b - a) * r();
  const noisy = (pts, amt) => pts.map(([x, y]) => [x + u(-amt, amt), y + u(-amt, amt)]);
  return {
    circle() {
      const cx = u(0.35, 0.65), cy = u(0.35, 0.65), rad = u(0.12, 0.35), ex = u(0.75, 1.25);
      const a0 = u(0, 6.28), sweep = u(5.6, 6.9), dir = r() < 0.5 ? 1 : -1, n = 40;
      const pts = [];
      for (let i = 0; i <= n; i++) { const a = a0 + dir * sweep * i / n; pts.push([cx + rad * ex * Math.cos(a), cy + rad * Math.sin(a)]); }
      return [noisy(pts, rad * 0.06)];
    },
    cross() {
      const cx = u(0.35, 0.65), cy = u(0.35, 0.65), L = u(0.12, 0.35);
      const line = (ang, len) => { const pts = []; for (let i = 0; i <= 15; i++) { const t = -1 + 2 * i / 15; pts.push([cx + Math.cos(ang) * len * t, cy + Math.sin(ang) * len * t]); } return noisy(pts, L * 0.04); };
      return [line(Math.PI / 4 + u(-0.3, 0.3), L * u(0.85, 1.15)), line(-Math.PI / 4 + u(-0.3, 0.3), L * u(0.85, 1.15))];
    },
    triangle() {
      const cx = u(0.35, 0.65), cy = u(0.35, 0.65), s = u(0.15, 0.35), rot = u(-0.25, 0.25);
      const pts = [];
      for (let k = 0; k <= 3; k++) { const a0 = -Math.PI / 2 + rot + k * 2 * Math.PI / 3, a1 = a0 + 2 * Math.PI / 3; if (k === 3) break; for (let i = 0; i < 10; i++) { const t = i / 10; pts.push([cx + s * ((1 - t) * Math.cos(a0) + t * Math.cos(a1)), cy + s * ((1 - t) * Math.sin(a0) + t * Math.sin(a1))]); } }
      pts.push(pts[0]);
      return [noisy(pts, s * 0.04)];
    },
    square() {
      const cx = u(0.35, 0.65), cy = u(0.35, 0.65), s = u(0.12, 0.3), rot = u(-0.2, 0.2);
      const c = [[-1, -1], [1, -1], [1, 1], [-1, 1], [-1, -1]].map(([x, y]) => [cx + s * (x * Math.cos(rot) - y * Math.sin(rot)), cy + s * (x * Math.sin(rot) + y * Math.cos(rot))]);
      const pts = [];
      for (let k = 0; k < 4; k++) for (let i = 0; i < 10; i++) { const t = i / 10; pts.push([c[k][0] * (1 - t) + c[k + 1][0] * t, c[k][1] * (1 - t) + c[k + 1][1] * t]); }
      pts.push(c[0]);
      return [noisy(pts, s * 0.04)];
    }
  };
}

function run(a, b, seed, epochs = 150) {
  const gen = makeGen(seed);
  const L = new M.Learner({ seed });
  for (let i = 0; i < 3; i++) { L.add(gen[a](), 0); L.add(gen[b](), 1); }
  L.prepare();
  const losses = [];
  for (let e = 0; e < epochs; e++) losses.push(L.trainStep());
  let ok = 0, conf = 0; const N = 200;
  for (let i = 0; i < N; i++) {
    const y = i % 2, p = L.predict(gen[y ? b : a]());
    if ((p[1] > p[0] ? 1 : 0) === y) ok++;
    conf += Math.max(...p);
  }
  return { L, gen, acc: ok / N, conf: conf / N, l0: losses[0], l1: losses[losses.length - 1], mono: losses.filter((x, i) => i && x > losses[i - 1] * 1.05).length };
}

assert.strictEqual(M.normalize([]), null);
assert.strictEqual(M.rasterize(M.normalize([[[0.5, 0.5]]])).length, 256);

console.log("参数个数：", new M.Learner().size);
const t0 = Date.now();
for (const [a, b] of [["circle", "cross"], ["triangle", "square"], ["circle", "square"]]) {
  const rs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => run(a, b, s));
  const accs = rs.map((r) => r.acc);
  console.log(`${a} vs ${b}: 准确率 平均 ${(accs.reduce((x, y) => x + y) / accs.length * 100).toFixed(1)}%  最低 ${(Math.min(...accs) * 100).toFixed(1)}%  平均把握 ${(rs.reduce((x, r) => x + r.conf, 0) / rs.length * 100).toFixed(1)}%  损失 ${rs[0].l0.toFixed(3)}→${rs[0].l1.toFixed(4)}  明显回升的轮数 ${rs[0].mono}`);
  if (b === "cross") assert(Math.min(...accs) >= 0.9, "圆圈/叉叉 应能分对");
}
console.log("30 次训练耗时", Date.now() - t0, "ms（单次约", ((Date.now() - t0) / 30).toFixed(0), "ms）");

// 纠错：把一个“猜错”的样本加进去重新训练，再猜它应该改对
{
  // 圆圈 vs 方块里种子 1~10 中最差的那个，最容易找到猜错的
  const worst = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => run("circle", "square", s)).sort((x, y) => x.acc - y.acc)[0];
  const { L, gen } = worst;
  console.log("纠错前准确率", (worst.acc * 100).toFixed(1) + "%");
  let fixed = 0, tried = 0;
  for (let i = 0; i < 300 && tried < 5; i++) {
    const y = i % 2, s = gen[y ? "square" : "circle"](), p = L.predict(s);
    if ((p[1] > p[0] ? 1 : 0) === y && Math.max(...p) > 0.75) continue;  // 只挑猜错或没把握的
    tried++;
    L.add(s, y); L.prepare();
    for (let e = 0; e < 80; e++) L.trainStep();
    const q = L.predict(s);
    if ((q[1] > q[0] ? 1 : 0) === y) fixed++;
    console.log(`纠错 ${tried}：原来 ${(p[y] * 100).toFixed(0)}% 是正确类别，重训后 ${(q[y] * 100).toFixed(0)}%`);
  }
  let ok = 0;
  for (let i = 0; i < 200; i++) { const y = i % 2, p = L.predict(gen[y ? "square" : "circle"]()); if ((p[1] > p[0] ? 1 : 0) === y) ok++; }
  console.log("纠错后在新的 200 个上的准确率", (ok / 2).toFixed(1) + "%");
  if (tried) assert(fixed === tried, "加进去重训后应当改对");
  else console.log("纠错：没找到猜错的样本");
}
console.log("全部通过");

