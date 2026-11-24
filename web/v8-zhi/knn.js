/* 小智的“大脑”：k 近邻（KNN）分类，原生 JS，不依赖任何库。
 * 浏览器里挂在 window.ZhiKNN，node 里用 require('./knn.js')。
 *
 * 一张输入 = 32 × 24 个格子的明暗 = 768 个数字。
 * 比较之前先做亮度归一化：减去平均值、除以标准差。
 * 这样整体变亮、变暗、对比度变化都不影响比较结果。
 */
(function (root) {
  'use strict';

  var W = 32, H = 24, N = W * H;

  /* 亮度归一化：z = (x - 均值) / 标准差。几乎没有变化的画面（比如空白画板）返回全 0。 */
  function normalize(grid) {
    var n = grid.length, mean = 0, i;
    for (i = 0; i < n; i++) mean += grid[i];
    mean /= n;
    var v = 0;
    for (i = 0; i < n; i++) { var d = grid[i] - mean; v += d * d; }
    var sd = Math.sqrt(v / n);
    var out = new Float32Array(n);
    if (sd < 1e-6) return out;
    for (i = 0; i < n; i++) out[i] = (grid[i] - mean) / sd;
    return out;
  }

  /* 两张归一化后的网格之间的距离（欧氏距离）。 */
  function distance(a, b) {
    var s = 0;
    for (var i = 0; i < a.length; i++) { var d = a[i] - b[i]; s += d * d; }
    return Math.sqrt(s);
  }

  /* k 近邻预测。
   * examples: [{ label: 0|1|..., vec: Float32Array(已归一化), id: 第几张 }]
   * x: 当前输入（已归一化）
   * 返回：
   *   probs   每一类的把握（k 个最近例子按距离加权投票，权重 = 1 / (距离 + 1)）
   *   top     把握最大的类别
   *   nearest 最像的那一张例子（下标、类别、距离）
   *   k       实际用到的邻居数
   */
  function predict(examples, x, numClasses, k) {
    k = Math.min(k || 5, examples.length);
    if (!k) return null;
    var scored = new Array(examples.length);
    for (var i = 0; i < examples.length; i++) {
      scored[i] = { i: i, d: distance(examples[i].vec, x) };
    }
    scored.sort(function (p, q) { return p.d - q.d; });
    var votes = new Array(numClasses).fill(0), total = 0;
    for (var j = 0; j < k; j++) {
      var w = 1 / (scored[j].d + 1);
      votes[examples[scored[j].i].label] += w;
      total += w;
    }
    var probs = votes.map(function (v) { return v / total; });
    var top = 0;
    for (var c = 1; c < numClasses; c++) if (probs[c] > probs[top]) top = c;
    var best = scored[0];
    return {
      probs: probs,
      top: top,
      topP: probs[top],
      k: k,
      nearest: { index: best.i, label: examples[best.i].label, dist: best.d }
    };
  }

  /* 把一张大图（单通道 Float32Array，sw × sh）里的一个矩形区域按面积平均缩成 ow × oh。
   * 每个格子在源区域里取 4 × 4 个采样点求平均，避免缩小时丢细节。 */
  function resample(src, sw, sh, rect, ow, oh, bg) {
    var out = new Float32Array(ow * oh);
    var S = 4, cw = rect.w / ow, ch = rect.h / oh;
    for (var gy = 0; gy < oh; gy++) {
      for (var gx = 0; gx < ow; gx++) {
        var acc = 0;
        for (var sy = 0; sy < S; sy++) {
          var y = Math.floor(rect.y + (gy + (sy + 0.5) / S) * ch);
          for (var sx = 0; sx < S; sx++) {
            var x = Math.floor(rect.x + (gx + (sx + 0.5) / S) * cw);
            acc += (x < 0 || y < 0 || x >= sw || y >= sh) ? bg : src[y * sw + x];
          }
        }
        out[gy * ow + gx] = acc / (S * S);
      }
    }
    return out;
  }

  /* 画板专用：找出墨迹的外框（值小于 threshold 的像素算墨迹）。没有墨迹返回 null。 */
  function inkBox(src, sw, sh, threshold) {
    var x0 = sw, y0 = sh, x1 = -1, y1 = -1;
    for (var y = 0; y < sh; y++) {
      for (var x = 0; x < sw; x++) {
        if (src[y * sw + x] < threshold) {
          if (x < x0) x0 = x; if (x > x1) x1 = x;
          if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return null;
    return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }

  /* 把墨迹外框扩成和网格同样的宽高比、居中、四周留一点白，画在哪儿、画多大都不影响比较。 */
  function fitBox(box, aspect, pad) {
    var w = box.w * (1 + pad * 2), h = box.h * (1 + pad * 2);
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    var cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    return { x: cx - w / 2, y: cy - h / 2, w: w, h: h };
  }

  /* 轻微模糊（1-2-1 卷积），画板模式下让“差一两格”的笔画也算相近。 */
  function blur(grid, w, h) {
    var tmp = new Float32Array(grid.length), out = new Float32Array(grid.length), x, y;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var l = grid[y * w + Math.max(0, x - 1)], r = grid[y * w + Math.min(w - 1, x + 1)];
      tmp[y * w + x] = (l + 2 * grid[y * w + x] + r) / 4;
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) {
      var u = tmp[Math.max(0, y - 1) * w + x], d = tmp[Math.min(h - 1, y + 1) * w + x];
      out[y * w + x] = (u + 2 * tmp[y * w + x] + d) / 4;
    }
    return out;
  }

  var api = {
    W: W, H: H, N: N,
    normalize: normalize,
    distance: distance,
    predict: predict,
    resample: resample,
    inkBox: inkBox,
    fitBox: fitBox,
    blur: blur
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZhiKNN = api;
})(typeof window !== 'undefined' ? window : this);
