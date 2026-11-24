/* v23-rings · 年轮表盘渲染与极坐标命中检测（纯 Canvas 2D，零外部依赖）
 * 6 圈同心圆（2021–2026）+ 第 7 圈「现在 · 下一段，留给你」
 * 16 篇报道严格按 CLUB.news 的真实日期角度与活动规模弧长排布
 */
(function (W) {
  'use strict';

  var TAU = Math.PI * 2;
  var HALF_PI = Math.PI / 2;

  var CAT_META = {
    weld:    { color: '#c45525', name: '电路焊接' },
    course:  { color: '#1e5b88', name: '昇腾课程' },
    visit:   { color: '#2b6e4f', name: '企业参访' },
    contest: { color: '#b57c16', name: '创新大赛' },
    talk:    { color: '#6b4c3b', name: '系列分享' }
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function normAngle(a) {
    a = a % TAU;
    return a < 0 ? a + TAU : a;
  }
  function shortAngleDist(a, b) {
    var d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
  }

  function dayOfYear(dateStr) {
    var p = String(dateStr).split('-');
    var m = parseInt(p[1], 10) || 1;
    var d = parseInt(p[2], 10) || 1;
    var mdays = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return (mdays[clamp(m - 1, 0, 11)] || 0) + d;
  }

  // 根据报道原文中的真实规模词决定弧段长度（严格依据原文，不编造）
  function calcArcSpan(item) {
    var txt = (item.title || '') + ' ' + (item.summary || '');
    if (/近\s*200/.test(txt)) return 0.76;         // ~43.5° 近200名同学
    if (/百余/.test(txt)) return 0.58;             // ~33° 百余名学子 / 报名百余人
    if (/近百/.test(txt)) return 0.50;             // ~28.6° 近百名学子
    if (/四十余|40\s*余/.test(txt)) return 0.40;   // ~23° 四十余名同学
    if (/决赛|训练营/.test(txt)) return 0.36;      // ~20.6° 全校决赛 / 两天训练营
    return 0.26;                                   // ~15° 班级焊接课 / 专项参访 / 进阶课
  }

  function hexToRgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function traceArc(ctx, cx, cy, r, a0, a1, moveFirst) {
    var steps = Math.max(8, Math.ceil(Math.abs(a1 - a0) * 28));
    for (var s = 0; s <= steps; s++) {
      var a = a0 + (a1 - a0) * (s / steps);
      var x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      if (s === 0 && moveFirst) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }

  function traceBand(ctx, cx, cy, rIn, rOut, a0, a1) {
    ctx.beginPath();
    traceArc(ctx, cx, cy, rOut, a0, a1, true);
    traceArc(ctx, cx, cy, rIn, a1, a0, false);
    ctx.closePath();
  }

  function createDial(canvas, bezelBox, clubData, options) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var opts = options || {};
    var news = (clubData && clubData.news) || [];
    var founded = (clubData && clubData.meta && clubData.meta.founded) || 2021;
    var depts = (clubData && clubData.meta && clubData.meta.departments) || [];
    var years = [2021, 2022, 2023, 2024, 2025, 2026];

    // 每年挑一条代表报道 ID（用于第 3 拍逐圈扫亮）
    var pickIds = opts.pickIds || ['6612', '40315', '43095', '45485', '46475'];

    // 构建 2021 成立弧 + 16 条真实报道弧
    var arcs = [];
    var foundingArc = {
      id: 'founded-2021',
      ring: 0,
      year: founded,
      date: founded + '-09-01',
      cat: 'founded',
      isFounded: true,
      isPick: true,
      title: founded + ' 年上海大学人工智能社成立，挂靠通信与信息工程学院团委',
      source: null,
      mid: -HALF_PI,
      span: 0.62,
      start: -HALF_PI - 0.31,
      end: -HALF_PI + 0.31
    };
    arcs.push(foundingArc);

    var byYear = { 2022: [], 2023: [], 2024: [], 2025: [], 2026: [] };
    news.forEach(function (n, idx) {
      var y = parseInt(String(n.date).slice(0, 4), 10);
      if (!byYear[y]) return;
      var doy = dayOfYear(n.date);
      var rawAngle = ((doy - 1) / 365) * TAU - HALF_PI; // 1月1日在正上方 -90°
      var span = calcArcSpan(n);
      var isPick = false;
      for (var k = 0; k < pickIds.length; k++) {
        if (String(n.source).indexOf(pickIds[k]) > -1) { isPick = true; break; }
      }
      byYear[y].push({
        id: 'news-' + idx,
        newsIndex: idx,
        ring: y - 2021,
        year: y,
        date: n.date,
        cat: n.cat,
        color: (CAT_META[n.cat] && CAT_META[n.cat].color) || '#181614',
        catName: (CAT_META[n.cat] && CAT_META[n.cat].name) || '社团动态',
        isPick: isPick,
        title: n.title,
        summary: n.summary,
        source: n.source,
        rawMid: rawAngle,
        mid: rawAngle,
        span: span
      });
    });

    // 同一年内做轻微角度退让，确保相邻报道弧段之间留有清晰间隙且严格保持时间先后
    Object.keys(byYear).forEach(function (yk) {
      var list = byYear[yk];
      list.sort(function (a, b) { return a.rawMid - b.rawMid; });
      var minGap = 0.085; // ~4.8°
      for (var pass = 0; pass < 12; pass++) {
        for (var i = 0; i < list.length - 1; i++) {
          var a = list[i], b = list[i + 1];
          var need = (a.span + b.span) * 0.5 + minGap;
          var diff = b.mid - a.mid;
          if (diff < need) {
            var push = (need - diff) * 0.5;
            a.mid -= push;
            b.mid += push;
          }
        }
      }
      list.forEach(function (item) {
        item.start = item.mid - item.span * 0.5;
        item.end = item.mid + item.span * 0.5;
        arcs.push(item);
      });
    });

    // 生成细腻纸张颗粒图案（仅 80x80 离屏画布）
    var grainPattern = null;
    try {
      var gc = document.createElement('canvas');
      gc.width = 80; gc.height = 80;
      var gctx = gc.getContext('2d');
      var img = gctx.createImageData(80, 80);
      var d = img.data, seed = 202109;
      for (var p = 0; p < d.length; p += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        var v = (seed & 31) - 15;
        d[p] = 120 + v;
        d[p + 1] = 112 + v;
        d[p + 2] = 98 + v;
        d[p + 3] = 9;
      }
      gctx.putImageData(img, 0, 0);
      grainPattern = ctx.createPattern(gc, 'repeat');
    } catch (e) { grainPattern = null; }

    // 外圈年份刻度按钮（2021..2026 + 现在）
    var bezelNodes = [];
    var bezelLabels = [
      { key: '2021', text: '2021', beat: 0, year: 2021, title: '跳至 2021 社团成立（首屏）' },
      { key: 'cat',  text: '日常', beat: 1, year: null, title: '跳至 5 类日常活动' },
      { key: '2022', text: '2022', beat: 2, year: 2022, title: '跳至 2022 年代表报道' },
      { key: '2023', text: '2023', beat: 2, year: 2023, title: '跳至 2023 年代表报道' },
      { key: '2024', text: '2024', beat: 2, year: 2024, title: '跳至 2024 年代表报道' },
      { key: '2025', text: '2025', beat: 2, year: 2025, title: '跳至 2025 年代表报道' },
      { key: '2026', text: '2026', beat: 3, year: 2026, title: '跳至 2026 团队与部门' },
      { key: 'now',  text: '现在', beat: 4, year: 2027, title: '跳至怎么加入（下一段留给你）' }
    ];

    if (bezelBox) {
      bezelBox.innerHTML = '';
      bezelLabels.forEach(function (item, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bz-tick';
        btn.setAttribute('aria-label', item.title);
        btn.innerHTML = '<span>' + item.text + '</span>';
        btn.addEventListener('click', function () {
          if (opts.onBezelJump) opts.onBezelJump(item.beat, item.year, idx);
        });
        bezelBox.appendChild(btn);
        bezelNodes.push({ el: btn, cfg: item });
      });
    }

    var state = {
      W: 1, H: 1, dpr: 1, mobile: false, cx: 0, cy: 0, maxR: 260,
      rot: 0, userRot: 0, ptrAngle: -HALF_PI, ptrRing: 0, mode: 0,
      actionMix: 0, catBlend: 0, sweepYear: 2021, quadrantMix: 0,
      futureMix: 0, heroCenterFade: 1, globalProgress: 0,
      activeCat: null, focusYear: null, activeDept: -1, hoveredArc: null, energy: 0
    };

    var ringRadii = [0, 0, 0, 0, 0, 0, 0];

    function resize(w, h, mobile) {
      state.W = Math.max(1, w);
      state.H = Math.max(1, h);
      state.mobile = !!mobile;
      state.dpr = mobile ? 1 : Math.min(W.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(state.W * state.dpr);
      canvas.height = Math.round(state.H * state.dpr);
      computeGeometry();
      layoutBezelButtons();
    }

    function computeGeometry() {
      var w = state.W, h = state.H;
      if (state.mobile) {
        var heroShift = state.heroCenterFade;
        state.cx = w * 0.5;
        state.cy = lerp(clamp(h * 0.19, 114, 152), clamp(h * 0.22, 128, 174), heroShift);
        state.maxR = clamp(Math.min(w * 0.285, h * 0.132), 74, 132);
      } else {
        var centerCx = w * 0.5;
        var sideCx = clamp(w * 0.275, 250, 450);
        state.cx = lerp(sideCx, centerCx, state.heroCenterFade);
        state.cy = lerp(h * 0.51, h * 0.488, state.heroCenterFade);
        var heroR = Math.min(w * 0.41, h * 0.435);
        var sideR = Math.min(w * 0.225, h * 0.385);
        state.maxR = lerp(sideR, heroR, state.heroCenterFade);
      }

      var compress = 1 - state.futureMix * 0.11;
      var innerRatio = state.mobile ? 0.26 : lerp(0.23, 0.55, state.heroCenterFade);
      var outerRatio = lerp(0.85, 0.88, state.heroCenterFade) * compress;

      var weights = [], sumW = 0;
      for (var i = 0; i < 6; i++) {
        var dist = Math.abs(state.ptrRing - i);
        var swell = Math.max(0, 1 - dist * 0.85);
        if (state.focusYear && (state.focusYear - 2021) === i) swell = Math.max(swell, 0.9);
        var wgt = 1 + swell * 0.42;
        weights.push(wgt);
        sumW += wgt;
      }

      var acc = 0;
      for (var r = 0; r < 6; r++) {
        var frac = (acc + weights[r] * 0.5) / sumW;
        ringRadii[r] = state.maxR * lerp(innerRatio, outerRatio, frac);
        acc += weights[r];
      }
      ringRadii[6] = state.maxR * (state.mobile ? 0.91 : 0.92);
    }

    function layoutBezelButtons() {
      if (!bezelNodes.length) return;
      bezelBox.style.opacity = '1';
      bezelBox.style.pointerEvents = 'auto';
      var n = bezelNodes.length;
      for (var i = 0; i < n; i++) {
        var node = bezelNodes[i], x, y;
        if (state.mobile) {
          var leftSide = i < 4;
          var slot = leftSide ? i : (i - 4);
          var mDeg = leftSide ? (-146 - slot * 22) : (-34 + slot * 22);
          var mAng = (mDeg * Math.PI) / 180;
          var mRad = state.maxR + 26;
          x = clamp(state.cx + Math.cos(mAng) * mRad, 28, state.W - 28);
          y = clamp(state.cy + Math.sin(mAng) * (state.maxR + 14), 52, state.H * 0.31);
        } else {
          var u = i / (n - 1);
          var sideAng = ((-212 + u * 150) * Math.PI) / 180;
          var heroAng = ((152 - u * 124) * Math.PI) / 180;
          var ang = lerp(sideAng, heroAng, state.heroCenterFade);
          var rad = state.maxR * lerp(1.055, 1.035, state.heroCenterFade);
          x = clamp(state.cx + Math.cos(ang) * rad, 34, state.W - 34);
          y = clamp(state.cy + Math.sin(ang) * rad, 56, state.H - 22);
        }
        node.el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) translate(-50%,-50%)';

        var isCur = false;
        if (state.mode === 0 && node.cfg.key === '2021') isCur = true;
        else if (state.mode === 1 && node.cfg.key === 'cat') isCur = true;
        else if (state.mode === 2 && node.cfg.year && Math.round(state.sweepYear) === node.cfg.year) isCur = true;
        else if (state.mode === 3 && node.cfg.key === '2026') isCur = true;
        else if (state.mode === 4 && node.cfg.key === 'now') isCur = true;
        if (state.focusYear && node.cfg.year === state.focusYear) isCur = true;
        node.el.classList.toggle('on', isCur);
      }
    }

    function setState(patch, dt, instant) {
      var safeDt = clamp(dt || 0.016, 0.001, 0.05);
      var prevRot = state.rot;
      var prevRing = state.ptrRing;
      for (var k in patch) {
        if (Object.prototype.hasOwnProperty.call(patch, k)) state[k] = patch[k];
      }
      computeGeometry();
      layoutBezelButtons();

      if (instant) {
        state.energy = 0;
        return;
      }
      var dRot = Math.abs(shortAngleDist(normAngle(prevRot), normAngle(state.rot)));
      var dRing = Math.abs(state.ptrRing - prevRing);
      var impulse = clamp(dRot * 5.2 + dRing * 0.85, 0, 1.2);
      state.energy = clamp(Math.max(state.energy * Math.pow(0.03, safeDt), impulse), 0, 1);
    }

    function getFoundingHighlight() {
      return state.mode === 0 ? 1 : 0.25;
    }

    function render() {
      var w = state.W, h = state.H, dpr = state.dpr;
      var cx = state.cx, cy = state.cy, maxR = state.maxR;
      var totalRot = normAngle(state.rot + state.userRot);

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      // 1. 细腻纸面肌理与表盘柔和底盘
      if (grainPattern) {
        ctx.fillStyle = grainPattern;
        ctx.fillRect(0, 0, w, h);
      }

      var bezelR = maxR * 0.965;
      var dialPlateGrad = ctx.createRadialGradient(cx, cy, ringRadii[0] * 0.65, cx, cy, maxR * 1.04);
      dialPlateGrad.addColorStop(0, 'rgba(232, 223, 208, 0.48)');
      dialPlateGrad.addColorStop(0.86, 'rgba(228, 218, 201, 0.52)');
      dialPlateGrad.addColorStop(1, 'rgba(244, 239, 230, 0)');
      ctx.fillStyle = dialPlateGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, maxR * 1.04, 0, TAU);
      ctx.fill();

      // 首屏中央留白内盘（仅位于第 1 圈内侧，绝不遮盖 6 圈年轮与弧段）
      if (!state.mobile && state.heroCenterFade > 0.02) {
        var wellR = Math.max(24, ringRadii[0] - 18);
        ctx.beginPath();
        ctx.arc(cx, cy, wellR, 0, TAU);
        ctx.fillStyle = 'rgba(246, 242, 234, ' + (0.94 * state.heroCenterFade).toFixed(3) + ')';
        ctx.fill();
        ctx.strokeStyle = 'rgba(24, 22, 20, ' + (0.12 * state.heroCenterFade).toFixed(3) + ')';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // 2. 外圈精密刻度环（随表盘转动：12个月份辐射线与度数细齿）
      ctx.beginPath();
      ctx.arc(cx, cy, bezelR, 0, TAU);
      ctx.strokeStyle = 'rgba(24, 22, 20, 0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();

      var tickCount = state.mobile ? 72 : 180;
      var spokeIn = state.mobile ? ringRadii[0] * 0.78 : lerp(ringRadii[0] * 0.78, ringRadii[0] - 14, state.heroCenterFade);
      for (var t = 0; t < tickCount; t++) {
        var deg = t * (360 / tickCount);
        var ta = (deg * Math.PI) / 180 - HALF_PI + totalRot;
        var isMajor = (deg % 30 === 0);
        var isMid = !isMajor && (deg % 10 === 0);
        var len = isMajor ? (state.mobile ? 7 : 10) : isMid ? (state.mobile ? 4.5 : 6) : 3;
        var r0 = bezelR - len;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ta) * r0, cy + Math.sin(ta) * r0);
        ctx.lineTo(cx + Math.cos(ta) * bezelR, cy + Math.sin(ta) * bezelR);
        ctx.strokeStyle = isMajor ? 'rgba(24, 22, 20, 0.38)' : 'rgba(24, 22, 20, 0.14)';
        ctx.lineWidth = isMajor ? 1.1 : 0.75;
        ctx.stroke();

        if (isMajor) {
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ta) * spokeIn, cy + Math.sin(ta) * spokeIn);
          ctx.lineTo(cx + Math.cos(ta) * (bezelR - len - 3), cy + Math.sin(ta) * (bezelR - len - 3));
          ctx.strokeStyle = 'rgba(24, 22, 20, 0.055)';
          ctx.lineWidth = 0.8;
          ctx.stroke();

          if (!state.mobile || deg % 90 === 0) {
            var mNum = Math.round(deg / 30) + 1;
            var mStr = (mNum < 10 ? '0' : '') + mNum;
            var lr = bezelR - len - (state.mobile ? 8 : 11);
            ctx.font = (state.mobile ? '8.5px' : '10px') + ' "Geist Mono", monospace';
            ctx.fillStyle = 'rgba(24, 22, 20, 0.42)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(mStr, cx + Math.cos(ta) * lr, cy + Math.sin(ta) * lr);
          }
        }
      }

      // 3. 外圈固定进度红弧
      var statorR = maxR * 0.998;
      ctx.beginPath();
      ctx.arc(cx, cy, statorR, 0, TAU);
      ctx.strokeStyle = 'rgba(24, 22, 20, 0.09)';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (state.globalProgress > 0.002) {
        ctx.beginPath();
        traceArc(ctx, cx, cy, statorR, -HALF_PI, -HALF_PI + clamp(state.globalProgress, 0, 1) * TAU, true);
        ctx.strokeStyle = '#d63624';
        ctx.lineWidth = state.mobile ? 2 : 2.4;
        ctx.stroke();
      }

      // 4. 第 4 拍：四部门象限基准线与扇区高亮
      if (state.quadrantMix > 0.01) {
        ctx.save();
        var qAlpha = state.quadrantMix;
        if (state.activeDept >= 0 && state.activeDept < 4) {
          var qa0 = -HALF_PI + state.activeDept * HALF_PI;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          traceArc(ctx, cx, cy, ringRadii[5] + 12, qa0, qa0 + HALF_PI, false);
          ctx.closePath();
          ctx.fillStyle = 'rgba(214, 54, 36, ' + (0.08 * qAlpha).toFixed(3) + ')';
          ctx.fill();
        }
        for (var q = 0; q < 4; q++) {
          var qa = -HALF_PI + q * HALF_PI;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(qa) * (ringRadii[0] * 0.6), cy + Math.sin(qa) * (ringRadii[0] * 0.6));
          ctx.lineTo(cx + Math.cos(qa) * (ringRadii[5] + 14), cy + Math.sin(qa) * (ringRadii[5] + 14));
          ctx.strokeStyle = 'rgba(214, 54, 36, ' + (0.28 * qAlpha).toFixed(3) + ')';
          ctx.setLineDash([4, 4]);
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.setLineDash([]);

          if (depts[q] && !state.mobile) {
            var midQa = qa + Math.PI * 0.25;
            var qr = ringRadii[5] * 0.72;
            var qx = cx + Math.cos(midQa) * qr, qy = cy + Math.sin(midQa) * qr;
            var isDeptOn = state.activeDept === q;
            ctx.font = (isDeptOn ? '600 ' : '400 ') + '12px -apple-system, "PingFang SC", sans-serif';
            var tw = ctx.measureText(depts[q].name).width + 14;
            ctx.fillStyle = isDeptOn ? '#d63624' : 'rgba(250, 247, 241, 0.94)';
            ctx.fillRect(qx - tw * 0.5, qy - 10, tw, 20);
            ctx.strokeStyle = isDeptOn ? '#d63624' : 'rgba(24, 22, 20, 0.24)';
            ctx.strokeRect(qx - tw * 0.5, qy - 10, tw, 20);
            ctx.fillStyle = isDeptOn ? '#faf7f1' : '#181614';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(depts[q].name, qx, qy + 0.5);
          }
        }
        ctx.restore();
      }

      // 5. 绘制 6 圈同心年轮（2021–2026）
      for (var i = 0; i < 6; i++) {
        var r = ringRadii[i];
        var distPtr = Math.abs(state.ptrRing - i);
        var ringGlow = Math.max(0, 1 - distPtr * 1.05);
        if (state.focusYear && (state.focusYear - 2021) === i) ringGlow = 1;

        if (ringGlow > 0.2 && state.energy > 0.06) {
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, TAU);
          ctx.strokeStyle = 'rgba(214, 54, 36, ' + (ringGlow * state.energy * 0.20).toFixed(3) + ')';
          ctx.lineWidth = (state.mobile ? 7 : 12) * ringGlow;
          ctx.stroke();
        }

        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, TAU);
        ctx.strokeStyle = ringGlow > 0.45
          ? 'rgba(214, 54, 36, ' + lerp(0.28, 0.62, ringGlow).toFixed(3) + ')'
          : 'rgba(24, 22, 20, ' + (i === 0 ? '0.24' : '0.16') + ')';
        ctx.lineWidth = ringGlow > 0.45 ? 1.35 : 0.95;
        ctx.stroke();
      }

      // 6. 第 5 拍：第 7 圈「现在 · 下一段，留给你」空白弧展开
      if (state.futureMix > 0.01) {
        var fm = state.futureMix, rNow = ringRadii[6];
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, rNow, 0, TAU);
        ctx.setLineDash([3, 5]);
        ctx.strokeStyle = 'rgba(214, 54, 36, ' + (0.36 * fm).toFixed(3) + ')';
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.setLineDash([]);

        var openStart = -0.68, openEnd = openStart + 1.18 * fm;
        var bandW = state.mobile ? 7.5 : 12.5;
        traceBand(ctx, cx, cy, rNow - bandW * 0.5, rNow + bandW * 0.5, openStart, openEnd);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.96 * fm).toFixed(3) + ')';
        ctx.fill();

        ctx.strokeStyle = 'rgba(214, 54, 36, ' + (0.86 * fm).toFixed(3) + ')';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        traceArc(ctx, cx, cy, rNow - bandW * 0.5, openStart, openEnd, true);
        ctx.stroke();
        ctx.beginPath();
        traceArc(ctx, cx, cy, rNow + bandW * 0.5, openStart, openEnd, true);
        ctx.stroke();
        ctx.setLineDash([]);

        var sx = cx + Math.cos(openStart) * rNow, sy = cy + Math.sin(openStart) * rNow;
        ctx.beginPath();
        ctx.arc(sx, sy, state.mobile ? 3.5 : 4.8, 0, TAU);
        ctx.fillStyle = '#d63624';
        ctx.fill();

        if (fm > 0.35 && !state.mobile) {
          var midOpen = (openStart + openEnd) * 0.5;
          var arcInX = cx + Math.cos(midOpen) * (rNow - bandW * 0.5);
          var arcInY = cy + Math.sin(midOpen) * (rNow - bandW * 0.5);
          var tagTxt = '下一段，留给你';
          ctx.font = '600 12px -apple-system, "PingFang SC", sans-serif';
          var tagW = ctx.measureText(tagTxt).width + 14;
          var lx = arcInX - tagW * 0.5 - 12, ly = arcInY;
          ctx.globalAlpha = clamp((fm - 0.35) / 0.65, 0, 1);
          ctx.beginPath();
          ctx.moveTo(arcInX - 2, arcInY);
          ctx.lineTo(lx + tagW * 0.5, ly);
          ctx.strokeStyle = '#d63624';
          ctx.lineWidth = 1.1;
          ctx.stroke();
          ctx.fillStyle = '#d63624';
          ctx.fillRect(lx - tagW * 0.5, ly - 10, tagW, 20);
          ctx.fillStyle = '#fffdf9';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(tagTxt, lx, ly + 0.5);
        }
        ctx.restore();
      }

      // 7. 绘制所有真实记忆弧段（2021 成立弧 + 16 篇报道弧）
      var baseBand = state.mobile ? 5.8 : clamp(maxR * 0.032, 8.5, 12.5);
      for (var aIdx = 0; aIdx < arcs.length; aIdx++) {
        var arc = arcs[aIdx];
        var ar = ringRadii[arc.ring];
        var a0 = arc.start + totalRot;
        var a1 = arc.end + totalRot;
        var isHov = state.hoveredArc === arc;
        var onPtrRing = Math.abs(state.ptrRing - arc.ring) < 0.48;

        var midWorld = normAngle((a0 + a1) * 0.5);
        var angDiff = Math.abs(shortAngleDist(midWorld, normAngle(state.ptrAngle)));
        var ptrHit = onPtrRing && angDiff < (arc.span * 0.5 + 0.14);

        var thick = baseBand, fillCol = '#ffffff', strokeCol = 'rgba(24, 22, 20, 0.44)', alpha = 1;

        if (arc.isFounded) {
          var fOn = state.mode === 0 || isHov || ptrHit;
          fillCol = fOn ? '#d63624' : '#1f1c19';
          strokeCol = fillCol;
          thick = baseBand * (fOn ? 1.3 : 0.96);
          alpha = state.mode === 1 && state.activeCat ? 0.25 : getFoundingHighlight() * 0.6 + 0.4;
        } else if (state.catBlend > 0.5) {
          fillCol = arc.color;
          strokeCol = arc.color;
          if (state.activeCat) {
            thick = baseBand * (arc.cat === state.activeCat ? 1.42 : 0.82);
            alpha = arc.cat === state.activeCat ? 1 : 0.22;
          } else {
            thick = baseBand * (onPtrRing ? 1.22 : 1.06);
          }
        } else if (state.mode === 2) {
          var reached = arc.year <= Math.ceil(state.sweepYear + 0.05);
          var isFocusYr = state.focusYear ? (arc.year === state.focusYear) : (Math.round(state.sweepYear) === arc.year);
          if (arc.isPick && isFocusYr) {
            fillCol = '#d63624';
            strokeCol = '#d63624';
            thick = baseBand * 1.45;
          } else if (arc.isPick && reached) {
            fillCol = '#1f1c19';
            strokeCol = '#1f1c19';
            thick = baseBand * 1.22;
          } else {
            fillCol = '#ffffff';
            strokeCol = 'rgba(24, 22, 20, 0.36)';
            alpha = isFocusYr ? 0.95 : 0.62;
          }
        } else if (state.mode === 3) {
          var isLeadArc = arc.date === '2026-10-26';
          fillCol = isLeadArc ? '#d63624' : '#ffffff';
          strokeCol = isLeadArc ? '#d63624' : 'rgba(24, 22, 20, 0.34)';
          thick = baseBand * (isLeadArc ? 1.4 : 0.96);
          alpha = isLeadArc ? 1 : 0.72;
        } else if (state.mode === 4) {
          fillCol = arc.isPick ? '#262320' : '#ffffff';
          strokeCol = arc.isPick ? '#262320' : 'rgba(24, 22, 20, 0.32)';
          thick = baseBand * 0.94;
          alpha = 0.78;
        } else {
          if (ptrHit) {
            fillCol = '#d63624';
            strokeCol = '#d63624';
            thick = baseBand * 1.32;
          } else {
            fillCol = '#ffffff';
            strokeCol = arc.isPick ? 'rgba(24, 22, 20, 0.62)' : 'rgba(24, 22, 20, 0.36)';
            thick = baseBand * (arc.isPick ? 1.12 : 0.94);
          }
        }

        if (isHov) {
          fillCol = '#d63624';
          strokeCol = '#181614';
          thick = baseBand * 1.55;
          alpha = 1;
        }

        ctx.save();
        ctx.globalAlpha = alpha;

        if (isHov || fillCol === '#d63624' || (state.activeCat && arc.cat === state.activeCat)) {
          var glowHalf = (thick + (state.mobile ? 5 : 8)) * 0.5;
          traceBand(ctx, cx, cy, ar - glowHalf, ar + glowHalf, a0 - 0.01, a1 + 0.01);
          ctx.fillStyle = fillCol === '#d63624' ? 'rgba(214, 54, 36, 0.20)' : hexToRgba(arc.color || '#d63624', 0.20);
          ctx.fill();
        }

        traceBand(ctx, cx, cy, ar - thick * 0.5, ar + thick * 0.5, a0, a1);
        ctx.fillStyle = fillCol;
        ctx.fill();
        ctx.lineWidth = isHov ? 1.3 : 0.95;
        ctx.strokeStyle = strokeCol;
        ctx.stroke();
        ctx.restore();
      }

      // 8. 每圈年份微标牌（桌面端 2021–2026，排在 -112° 轴线上）
      if (!state.mobile) {
        var labelAxis = -HALF_PI - 0.38;
        for (var yi = 0; yi < 6; yi++) {
          var yr = ringRadii[yi];
          var lx2 = cx + Math.cos(labelAxis) * yr, ly2 = cy + Math.sin(labelAxis) * yr;
          var yrActive = Math.abs(state.ptrRing - yi) < 0.45 || (state.focusYear === years[yi]);
          var yTxt = String(years[yi]);
          ctx.font = (yrActive ? '700 ' : '500 ') + (state.mobile ? '8.5px' : '10px') + ' "Geist Mono", monospace';
          var yw = ctx.measureText(yTxt).width + (state.mobile ? 6 : 8), yh = state.mobile ? 12 : 14;
          ctx.fillStyle = yrActive ? '#d63624' : 'rgba(250, 247, 241, 0.94)';
          ctx.fillRect(lx2 - yw * 0.5, ly2 - yh * 0.5, yw, yh);
          ctx.fillStyle = yrActive ? '#fffdf9' : 'rgba(24, 22, 20, 0.62)';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(yTxt, lx2, ly2 + 0.5);
        }
      }

      // 9. 红色精密指针 + 游标卡尺准星
      var targetR = ringRadii[0];
      if (state.ptrRing <= 5) {
        var idx0 = clamp(Math.floor(state.ptrRing), 0, 5);
        var idx1 = clamp(idx0 + 1, 0, 5);
        targetR = lerp(ringRadii[idx0], ringRadii[idx1], state.ptrRing - idx0);
      } else {
        targetR = lerp(ringRadii[5], ringRadii[6], clamp(state.ptrRing - 5, 0, 1));
      }

      var pa = state.ptrAngle;
      var tailLen = state.mobile ? 12 : 22;
      var startDist = state.mobile ? -tailLen : lerp(-tailLen, Math.max(0, ringRadii[0] - 24), state.heroCenterFade);
      var tipLen = Math.min(maxR * 0.985, targetR + (state.mobile ? 11 : 17));

      ctx.save();
      if (state.energy > 0.05) {
        var sweepSpan = 0.20 * state.energy;
        var sweepIn = Math.max(12, startDist > 0 ? startDist : ringRadii[0] * 0.45);
        traceBand(ctx, cx, cy, sweepIn, tipLen, pa - sweepSpan, pa);
        ctx.fillStyle = 'rgba(214, 54, 36, ' + (0.11 * state.energy).toFixed(3) + ')';
        ctx.fill();
      }

      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(pa) * startDist, cy + Math.sin(pa) * startDist);
      ctx.lineTo(cx + Math.cos(pa) * tipLen, cy + Math.sin(pa) * tipLen);
      ctx.strokeStyle = '#d63624';
      ctx.lineWidth = state.mobile ? 1.6 : 2.0;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cx + Math.cos(pa) * startDist, cy + Math.sin(pa) * startDist, state.mobile ? 2.4 : 3.2, 0, TAU);
      ctx.fillStyle = '#faf7f1';
      ctx.fill();
      ctx.strokeStyle = '#d63624';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      var rx = cx + Math.cos(pa) * targetR, ry = cy + Math.sin(pa) * targetR;
      var calR = (state.mobile ? 6.2 : 9.2) + state.energy * 2.2;
      ctx.beginPath();
      ctx.arc(rx, ry, calR, 0, TAU);
      ctx.fillStyle = 'rgba(214, 54, 36, 0.14)';
      ctx.fill();
      ctx.strokeStyle = '#d63624';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(rx, ry, state.mobile ? 2.3 : 3.1, 0, TAU);
      ctx.fillStyle = '#d63624';
      ctx.fill();

      // 中心精密轴心圆盘（桌面首屏隐藏以留白给标题，下滑左移时浮现）
      var hubAlpha = state.mobile ? 1 : clamp(1 - state.heroCenterFade * 1.35, 0, 1);
      if (hubAlpha > 0.02) {
        ctx.save();
        ctx.globalAlpha = hubAlpha;
        var hubR = state.mobile ? 14 : 23;
        ctx.beginPath();
        ctx.arc(cx, cy, hubR, 0, TAU);
        ctx.fillStyle = '#faf7f1';
        ctx.fill();
        ctx.strokeStyle = 'rgba(24, 22, 20, 0.28)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(cx, cy, 3.0, 0, TAU);
        ctx.fillStyle = '#d63624';
        ctx.fill();

        if (!state.mobile) {
          var centerYr = state.ptrRing > 5.4 ? '现在' : String(years[clamp(Math.round(state.ptrRing), 0, 5)]);
          ctx.font = '600 9.5px "Geist Mono", -apple-system, sans-serif';
          ctx.fillStyle = '#181614';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(centerYr, cx, cy + hubR + 5);
        }
        ctx.restore();
      }
      ctx.restore();
      ctx.restore();
    }

    function hitTest(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var x = clientX - rect.left, y = clientY - rect.top;
      var dx = x - state.cx, dy = y - state.cy;
      var dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ringRadii[0] * 0.6 || dist > state.maxR * 1.05) return null;

      var ang = normAngle(Math.atan2(dy, dx));
      var totalRot = normAngle(state.rot + state.userRot);
      var tolR = state.mobile ? 11 : 13;
      var best = null, bestD = 1e9;

      for (var i = 0; i < arcs.length; i++) {
        var arc = arcs[i];
        var rr = ringRadii[arc.ring];
        var dr = Math.abs(dist - rr);
        if (dr > tolR) continue;
        var midWorld = normAngle(arc.mid + totalRot);
        var da = Math.abs(shortAngleDist(ang, midWorld));
        if (da <= arc.span * 0.5 + 0.045 && dr < bestD) {
          best = arc;
          bestD = dr;
        }
      }
      if (!best) return null;
      var midW = best.mid + totalRot, anchorR = ringRadii[best.ring];
      return {
        arc: best,
        x: state.cx + Math.cos(midW) * anchorR,
        y: state.cy + Math.sin(midW) * anchorR,
        pointerX: x,
        pointerY: y
      };
    }

    function findPickArc(year) {
      for (var i = 0; i < arcs.length; i++) {
        if (arcs[i].year === year && arcs[i].isPick) return arcs[i];
      }
      for (var j = 0; j < arcs.length; j++) {
        if (arcs[j].year === year) return arcs[j];
      }
      return foundingArc;
    }

    function findCatArc(catId) {
      for (var i = arcs.length - 1; i >= 0; i--) {
        if (arcs[i].cat === catId) return arcs[i];
      }
      return null;
    }

    function isInsideDial(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var dx = (clientX - rect.left) - state.cx, dy = (clientY - rect.top) - state.cy;
      return Math.sqrt(dx * dx + dy * dy) <= state.maxR * 1.06;
    }

    return {
      CAT_META: CAT_META,
      arcs: arcs,
      state: state,
      resize: resize,
      setState: setState,
      render: render,
      hitTest: hitTest,
      findPickArc: findPickArc,
      findCatArc: findCatArc,
      isInsideDial: isInsideDial,
      hasActiveSparks: function () { return state.energy > 0.02; }
    };
  }

  W.createAnnualDial = createDial;
})(window);
