/* v20-desk · 桌面器物与切割垫 Canvas 2D 写实渲染
 * 顶视产品摄影质感：柔和左上主光（-35°）、哑光工程塑料、拉丝金属、PCB 沉金焊盘与液晶读数。
 * 严格限制 DPR <= 1.5（窄屏为 1），离屏或页面隐藏时零重绘。
 */
(function (w, d) {
  'use strict';

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function rr(ctx, x, y, width, height, r) {
    var rad = Math.min(r, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + width, y, x + width, y + height, rad);
    ctx.arcTo(x + width, y + height, x, y + height, rad);
    ctx.arcTo(x, y + height, x, y, rad);
    ctx.arcTo(x, y, x + width, y, rad);
    ctx.closePath();
  }

  function setupCanvas(el, lw, lh, dpr) {
    if (!el || !el.getContext) return null;
    var pw = Math.round(lw * dpr), ph = Math.round(lh * dpr);
    if (el.width !== pw || el.height !== ph) {
      el.width = pw;
      el.height = ph;
    }
    var ctx = el.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, lw, lh);
    return ctx;
  }

  /* 生成细腻胶片颗粒平铺贴图 */
  function applyGrain() {
    try {
      var c = d.createElement('canvas');
      c.width = 112; c.height = 112;
      var g = c.getContext('2d');
      if (!g) return;
      var img = g.createImageData(112, 112), data = img.data;
      var seed = 202109;
      for (var i = 0; i < data.length; i += 4) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        var v = (seed >>> 24) & 255;
        data[i] = v; data[i + 1] = v; data[i + 2] = v;
        data[i + 3] = 22;
      }
      g.putImageData(img, 0, 0);
      d.documentElement.style.setProperty('--grain-tex', 'url(' + c.toDataURL('image/png') + ')');
    } catch (e) {}
  }

  /* 1. 防静电切割实训垫 */
  function drawMat(el, dpr) {
    var W = 760, H = 540;
    var ctx = setupCanvas(el, W, H, dpr);
    if (!ctx) return;

    // 垫子柔和投影已由 CSS 承担，这里画哑光深橄榄灰橡胶垫体
    var bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#313734');
    bg.addColorStop(0.55, '#292e2c');
    bg.addColorStop(1, '#232725');
    rr(ctx, 4, 4, W - 8, H - 8, 18);
    ctx.fillStyle = bg;
    ctx.fill();

    // 边缘微高光倒角
    rr(ctx, 5, 5, W - 10, H - 10, 17);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 内框与 40px 坐标网格
    var ox = 36, oy = 36, gw = W - 72, gh = H - 72, step = 40;
    ctx.strokeStyle = 'rgba(228,224,212,0.12)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (var x = ox; x <= ox + gw + 0.5; x += step) {
      ctx.moveTo(x, oy); ctx.lineTo(x, oy + gh);
    }
    for (var y = oy; y <= oy + gh + 0.5; y += step) {
      ctx.moveTo(ox, y); ctx.lineTo(ox + gw, y);
    }
    ctx.stroke();

    // 10px 细分刻度（上边与左边）
    ctx.strokeStyle = 'rgba(228,224,212,0.22)';
    ctx.lineWidth = 0.75;
    ctx.beginPath();
    for (var tx = ox; tx <= ox + gw; tx += 8) {
      var tall = ((tx - ox) % 40 === 0) ? 7 : 3.5;
      ctx.moveTo(tx, oy); ctx.lineTo(tx, oy - tall);
    }
    for (var ty = oy; ty <= oy + gh; ty += 8) {
      var ltall = ((ty - oy) % 40 === 0) ? 7 : 3.5;
      ctx.moveTo(ox, ty); ctx.lineTo(ox - ltall, ty);
    }
    ctx.stroke();

    // 角度辅助参考线（左下角克制几何）
    ctx.save();
    ctx.strokeStyle = 'rgba(228,224,212,0.11)';
    ctx.setLineDash([4, 4]);
    [30, 45, 60].forEach(function (deg) {
      var rad = deg * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(ox, oy + gh);
      ctx.lineTo(ox + Math.cos(rad) * 140, oy + gh - Math.sin(rad) * 140);
      ctx.stroke();
    });
    ctx.restore();

    // 刻度数字与中文工位丝印
    ctx.fillStyle = 'rgba(228,224,212,0.34)';
    ctx.font = '500 9.5px "Geist Mono", monospace';
    for (var i = 0; i <= 17; i += 2) {
      ctx.fillText(String(i * 2), ox + i * step - 4, oy - 10);
    }
    ctx.font = '400 11px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillStyle = 'rgba(228,224,212,0.36)';
    ctx.fillText('翔英大楼 T404 · 电子焊接实训垫', ox + 8, oy + gh - 12);
  }

  /* 2. 数显温控焊台 + 金属烙铁架与电烙铁 */
  function drawSolder(el, dpr, state) {
    var W = 330, H = 240;
    var ctx = setupCanvas(el, W, H, dpr);
    if (!ctx) return;

    var temp = Math.round(state.temp || 350);
    var heat = clamp(state.heat || 0.35, 0, 1);

    // 连接主机与烙铁手柄的黑色硅胶软线
    ctx.save();
    ctx.strokeStyle = 'rgba(15,14,12,0.22)';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(118, 198);
    ctx.bezierCurveTo(132, 232, 232, 236, 250, 196);
    ctx.stroke();

    ctx.strokeStyle = '#222426';
    ctx.lineWidth = 5.5;
    ctx.beginPath();
    ctx.moveTo(115, 194);
    ctx.bezierCurveTo(130, 228, 228, 232, 247, 192);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(114, 193);
    ctx.bezierCurveTo(129, 226, 227, 230, 246, 191);
    ctx.stroke();
    ctx.restore();

    // 左侧焊台主机壳体
    ctx.save();
    ctx.shadowColor = 'rgba(18,16,12,0.26)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 11;
    var bodyG = ctx.createLinearGradient(16, 18, 162, 198);
    bodyG.addColorStop(0, '#3a3d40');
    bodyG.addColorStop(0.5, '#2b2e31');
    bodyG.addColorStop(1, '#1f2124');
    rr(ctx, 16, 18, 144, 178, 14);
    ctx.fillStyle = bodyG;
    ctx.fill();
    ctx.restore();

    // 主机顶面内嵌面板
    var faceG = ctx.createLinearGradient(24, 26, 152, 188);
    faceG.addColorStop(0, '#323538');
    faceG.addColorStop(1, '#25272a');
    rr(ctx, 24, 26, 128, 162, 10);
    ctx.fillStyle = faceG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.11)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 数显亚克力视窗
    rr(ctx, 34, 38, 108, 46, 6);
    ctx.fillStyle = '#131416';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();

    // 加热呼吸红点
    ctx.beginPath();
    ctx.arc(46, 51, 3.2, 0, Math.PI * 2);
    ctx.fillStyle = heat > 0.45 ? '#ea4c36' : '#8c2d20';
    ctx.fill();
    if (heat > 0.45) {
      ctx.beginPath();
      ctx.arc(46, 51, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(234,76,54,' + (0.28 * heat).toFixed(2) + ')';
      ctx.fill();
    }

    // 数显温度读数
    ctx.font = '700 22px "Geist Mono", monospace';
    ctx.fillStyle = '#f06449';
    ctx.textAlign = 'right';
    ctx.fillText(temp + '°', 132, 69);
    ctx.font = '500 9px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(240,236,228,0.45)';
    ctx.textAlign = 'left';
    ctx.fillText('恒温', 42, 74);

    // 铝合金调温旋钮
    var kx = 88, ky = 132, kr = 27;
    ctx.save();
    // 刻度圈
    ctx.strokeStyle = 'rgba(235,230,220,0.32)';
    ctx.lineWidth = 1.1;
    for (var a = -210; a <= 30; a += 24) {
      var r0 = a * Math.PI / 180;
      ctx.beginPath();
      ctx.moveTo(kx + Math.cos(r0) * (kr + 4), ky + Math.sin(r0) * (kr + 4));
      ctx.lineTo(kx + Math.cos(r0) * (kr + 8), ky + Math.sin(r0) * (kr + 8));
      ctx.stroke();
    }
    ctx.shadowColor = 'rgba(0,0,0,0.42)';
    ctx.shadowBlur = 9;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    var knobG = ctx.createLinearGradient(kx - kr, ky - kr, kx + kr, ky + kr);
    knobG.addColorStop(0, '#d8d5ce');
    knobG.addColorStop(0.48, '#9fa2a6');
    knobG.addColorStop(1, '#5e6166');
    ctx.beginPath();
    ctx.arc(kx, ky, kr, 0, Math.PI * 2);
    ctx.fillStyle = knobG;
    ctx.fill();
    ctx.restore();

    // 旋钮内凹帽与指针
    ctx.beginPath();
    ctx.arc(kx, ky, kr - 5, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3033';
    ctx.fill();
    var pAng = (-65 + (temp - 280) * 0.65) * Math.PI / 180;
    ctx.strokeStyle = '#f06449';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(kx + Math.cos(pAng) * 6, ky + Math.sin(pAng) * 6);
    ctx.lineTo(kx + Math.cos(pAng) * (kr - 7), ky + Math.sin(pAng) * (kr - 7));
    ctx.stroke();

    // 底部铭牌
    ctx.fillStyle = 'rgba(235,232,224,0.42)';
    ctx.font = '400 9.5px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('数显焊台 · T404', 88, 178);

    // 右侧：铸铁烙铁座 + 黄铜清洁丝杯
    ctx.save();
    ctx.shadowColor = 'rgba(18,16,12,0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    var stG = ctx.createLinearGradient(184, 28, 304, 188);
    stG.addColorStop(0, '#45484c');
    stG.addColorStop(1, '#282a2d');
    rr(ctx, 186, 30, 114, 158, 16);
    ctx.fillStyle = stG;
    ctx.fill();
    ctx.restore();

    // 黄铜清洁丝凹槽
    ctx.beginPath();
    ctx.arc(243, 74, 28, 0, Math.PI * 2);
    ctx.fillStyle = '#1b1c1e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 金色铜丝团肌理
    ctx.save();
    ctx.beginPath();
    ctx.arc(243, 74, 24, 0, Math.PI * 2);
    ctx.clip();
    var coils = [
      [235, 68, 11], [249, 67, 10], [238, 81, 12], [252, 79, 10],
      [244, 73, 9], [230, 75, 9], [255, 71, 8]
    ];
    coils.forEach(function (c, idx) {
      ctx.beginPath();
      ctx.arc(c[0], c[1], c[2], 0, Math.PI * 2);
      ctx.strokeStyle = idx % 2 ? '#d6ab56' : '#a87d31';
      ctx.lineWidth = 1.8;
      ctx.stroke();
    });
    ctx.restore();

    // 斜插的电烙铁（不锈钢发热套筒 + 隔热护套 + 手柄）
    ctx.save();
    ctx.translate(245, 134);
    ctx.rotate(-0.26);
    // 投影
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    rr(ctx, -11, -56, 24, 122, 10);
    ctx.fill();

    // 镀锡烙铁尖与不锈钢管（朝上指向铜丝）
    var tipG = ctx.createLinearGradient(-5, -72, 5, -20);
    tipG.addColorStop(0, '#f2efe8');
    tipG.addColorStop(0.35, '#b8bcc2');
    tipG.addColorStop(1, '#6f747b');
    ctx.beginPath();
    ctx.moveTo(0, -76);
    ctx.lineTo(4.5, -56);
    ctx.lineTo(5.5, -18);
    ctx.lineTo(-5.5, -18);
    ctx.lineTo(-4.5, -56);
    ctx.closePath();
    ctx.fillStyle = tipG;
    ctx.fill();

    // 热态微光（随滚动动作略亮，静止后收敛）
    if (heat > 0.5) {
      var glow = ctx.createRadialGradient(0, -68, 1, 0, -68, 16);
      glow.addColorStop(0, 'rgba(244,124,66,' + ((heat - 0.45) * 0.55).toFixed(2) + ')');
      glow.addColorStop(1, 'rgba(244,124,66,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(0, -68, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    // 隔热护圈
    rr(ctx, -11, -20, 22, 12, 4);
    ctx.fillStyle = '#c43c29';
    ctx.fill();

    // 硅胶手柄
    var hG = ctx.createLinearGradient(-10, -8, 10, 62);
    hG.addColorStop(0, '#3a3d42');
    hG.addColorStop(0.5, '#26282c');
    hG.addColorStop(1, '#191b1e');
    rr(ctx, -9.5, -8, 19, 72, 8);
    ctx.fillStyle = hG;
    ctx.fill();
    ctx.restore();
  }

  /* 3. 无铅焊锡丝卷 */
  function drawSpool(el, dpr, state) {
    var W = 172, H = 172, cx = 82, cy = 84, R = 64;
    var ctx = setupCanvas(el, W, H, dpr);
    if (!ctx) return;

    var sheen = (state && state.sheen) || 0;

    // 伸出的一截银色焊锡丝
    ctx.save();
    ctx.strokeStyle = 'rgba(18,16,12,0.22)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx + 46, cy + 36);
    ctx.bezierCurveTo(cx + 68, cy + 52, cx + 76, cy + 68, cx + 64, cy + 80);
    ctx.stroke();

    ctx.strokeStyle = '#d8dce0';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(cx + 44, cy + 34);
    ctx.bezierCurveTo(cx + 66, cy + 50, cx + 74, cy + 66, cx + 62, cy + 78);
    ctx.stroke();
    ctx.restore();

    // 线盘外圆与柔和投影
    ctx.save();
    ctx.shadowColor = 'rgba(18,16,12,0.25)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 9;
    var rimG = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rimG.addColorStop(0, '#3c3f42');
    rimG.addColorStop(1, '#222427');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = rimG;
    ctx.fill();
    ctx.restore();

    // 金属锡丝同心绕线层（透过观察窗可见，这里做半透顶盖质感）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 7, 0, Math.PI * 2);
    ctx.clip();
    for (var r = 30; r <= R - 7; r += 2.6) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = (Math.round(r) % 2 === 0) ? '#aeb4ba' : '#7f858c';
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
    // 金属各向异性高光束
    ctx.translate(cx, cy);
    ctx.rotate(-0.6 + sheen * 0.35);
    var spec = ctx.createLinearGradient(0, -R, 0, R);
    spec.addColorStop(0, 'rgba(255,255,255,0.34)');
    spec.addColorStop(0.5, 'rgba(255,255,255,0)');
    spec.addColorStop(1, 'rgba(255,255,255,0.28)');
    ctx.fillStyle = spec;
    ctx.fillRect(-18, -R, 36, R * 2);
    ctx.restore();

    // 顶盖三辐骨架环
    ctx.strokeStyle = '#2a2d30';
    ctx.lineWidth = 10;
    for (var k = 0; k < 3; k++) {
      var a = k * (Math.PI * 2 / 3) - 0.4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 28, cy + Math.sin(a) * 28);
      ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, R - 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 中央米白规格贴纸
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#f3efe6';
    ctx.fill();
    ctx.strokeStyle = '#c4bfb2';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 贴纸红圈装饰与文字
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(196,60,41,0.55)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#22201d';
    ctx.font = '600 9.5px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('无铅焊锡', cx, cy - 15);
    ctx.font = '500 8.5px "Geist Mono", monospace';
    ctx.fillStyle = '#5c5850';
    ctx.fillText('0.8 mm', cx, cy + 25);

    // 轴心孔
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#d4d0c7';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* 4. 实训开发板（深墨绿沉金 PCB） */
  function drawPcb(el, dpr, state) {
    var W = 290, H = 214;
    var ctx = setupCanvas(el, W, H, dpr);
    if (!ctx) return;

    var pulse = (state && state.pulse) || 0;

    // 左侧 USB-C 金属母座伸出边缘
    rr(ctx, 10, 88, 18, 36, 4);
    ctx.fillStyle = '#b9bec4';
    ctx.fill();

    // PCB 板体与柔和投影
    ctx.save();
    ctx.shadowColor = 'rgba(16,15,12,0.26)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    var pcbG = ctx.createLinearGradient(18, 14, 272, 198);
    pcbG.addColorStop(0, '#1f4034');
    pcbG.addColorStop(0.6, '#173228');
    pcbG.addColorStop(1, '#12271f');
    rr(ctx, 18, 14, 254, 184, 10);
    ctx.fillStyle = pcbG;
    ctx.fill();
    ctx.restore();

    rr(ctx, 18.5, 14.5, 253, 183, 9.5);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 铜箔走线纹理
    ctx.strokeStyle = 'rgba(78,154,122,0.26)';
    ctx.lineWidth = 1.2;
    var traces = [
      [56, 56, 108, 56, 122, 74], [56, 68, 98, 68, 122, 86],
      [234, 62, 194, 62, 178, 80], [234, 78, 200, 78, 178, 96],
      [148, 138, 148, 166, 210, 166], [134, 138, 134, 158, 78, 158],
      [34, 106, 86, 106, 118, 106]
    ];
    traces.forEach(function (t) {
      ctx.beginPath();
      ctx.moveTo(t[0], t[1]);
      ctx.lineTo(t[2], t[3]);
      ctx.lineTo(t[4], t[5]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(t[0], t[1], 2, 0, Math.PI * 2);
      ctx.fillStyle = '#c8a656';
      ctx.fill();
    });

    // 四角沉金定位螺孔
    [[32, 28], [258, 28], [32, 184], [258, 184]].forEach(function (p) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 6.5, 0, Math.PI * 2);
      ctx.fillStyle = '#d6b25e';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(p[0], p[1], 3.2, 0, Math.PI * 2);
      ctx.fillStyle = '#dcd8cf';
      ctx.fill();
    });

    // 上下双排 2x16 镀金排针底座
    [26, 176].forEach(function (py) {
      rr(ctx, 56, py, 178, 12, 2);
      ctx.fillStyle = '#1b1d1e';
      ctx.fill();
      for (var px = 62; px <= 228; px += 9.2) {
        ctx.fillStyle = '#e2be69';
        ctx.fillRect(px - 1.3, py + 2, 2.6, 2.6);
        ctx.fillRect(px - 1.3, py + 7.2, 2.6, 2.6);
      }
    });

    // 中央主控芯片（QFP 四边银色引脚 + 环氧黑封装）
    var ix = 114, iy = 72, isz = 66;
    ctx.fillStyle = '#c6ccd2';
    for (var p = 6; p <= isz - 8; p += 5.2) {
      ctx.fillRect(ix - 5, iy + p, 5, 2.4);
      ctx.fillRect(ix + isz, iy + p, 5, 2.4);
      ctx.fillRect(ix + p, iy - 5, 2.4, 5);
      ctx.fillRect(ix + p, iy + isz, 2.4, 5);
    }
    var icG = ctx.createLinearGradient(ix, iy, ix + isz, iy + isz);
    icG.addColorStop(0, '#323538');
    icG.addColorStop(1, '#1e2022');
    rr(ctx, ix, iy, isz, isz, 5);
    ctx.fillStyle = icG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.stroke();

    // 芯片 1 脚圆点与激光丝印
    ctx.beginPath();
    ctx.arc(ix + 10, iy + 10, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(240,236,228,0.45)';
    ctx.fill();
    ctx.fillStyle = 'rgba(240,236,228,0.62)';
    ctx.font = '600 9px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SHU-2026', ix + isz / 2, iy + 33);
    ctx.font = '400 8.5px -apple-system, "PingFang SC", sans-serif';
    ctx.fillStyle = 'rgba(240,236,228,0.46)';
    ctx.fillText('智能实训核', ix + isz / 2, iy + 47);

    // 银色金属晶振与微动按键
    rr(ctx, 56, 86, 28, 14, 5);
    ctx.fillStyle = '#cfd4d9';
    ctx.fill();
    ctx.fillStyle = '#3a3e42';
    ctx.font = '500 7px "Geist Mono", monospace';
    ctx.fillText('50.0M', 70, 95.5);

    // 微动复位键
    rr(ctx, 58, 118, 20, 20, 3);
    ctx.fillStyle = '#bfc4c9';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(68, 128, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#25272a';
    ctx.fill();

    // 右侧状态贴片 LED（电源常亮翠绿 + 3 颗信号灯随滚动律动）
    var actIdx = Math.floor(pulse * 4) % 3;
    for (var l = 0; l < 4; l++) {
      var ly = 82 + l * 16;
      rr(ctx, 218, ly, 10, 6, 1.5);
      var on = l === 0 || (pulse > 0.05 && (l - 1) === actIdx);
      ctx.fillStyle = l === 0 ? '#4fd17c' : (on ? '#f09a3e' : '#4a453b');
      ctx.fill();
      if (on) {
        ctx.beginPath();
        ctx.arc(223, ly + 3, 7, 0, Math.PI * 2);
        ctx.fillStyle = l === 0 ? 'rgba(79,209,124,0.22)' : 'rgba(240,154,62,0.26)';
        ctx.fill();
      }
    }

    // 板载中文白油丝印
    ctx.fillStyle = 'rgba(244,241,234,0.52)';
    ctx.font = '400 8.5px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('翔英创客实训板', 56, 166);
  }

  /* 5. 数字万用表 */
  function drawMeter(el, dpr, state) {
    var W = 244, H = 268;
    var ctx = setupCanvas(el, W, H, dpr);
    if (!ctx) return;

    var volts = (state && state.volts != null) ? state.volts : 3.30;

    // 姜黄防摔橡胶护套
    ctx.save();
    ctx.shadowColor = 'rgba(18,16,12,0.26)';
    ctx.shadowBlur = 17;
    ctx.shadowOffsetX = 6;
    ctx.shadowOffsetY = 10;
    var holG = ctx.createLinearGradient(28, 12, 214, 248);
    holG.addColorStop(0, '#cf983e');
    holG.addColorStop(0.55, '#b6802b');
    holG.addColorStop(1, '#8f621d');
    rr(ctx, 28, 12, 188, 238, 22);
    ctx.fillStyle = holG;
    ctx.fill();
    ctx.restore();

    // 内部深灰表壳
    var caseG = ctx.createLinearGradient(38, 22, 206, 240);
    caseG.addColorStop(0, '#36393d');
    caseG.addColorStop(1, '#232528');
    rr(ctx, 38, 22, 168, 218, 15);
    ctx.fillStyle = caseG;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 灰绿液晶屏（LCD）
    rr(ctx, 52, 36, 140, 52, 6);
    ctx.fillStyle = '#1b1d1e';
    ctx.fill();
    var lcdG = ctx.createLinearGradient(56, 40, 188, 84);
    lcdG.addColorStop(0, '#aeb8a6');
    lcdG.addColorStop(1, '#949f8d');
    rr(ctx, 56, 40, 132, 44, 4);
    ctx.fillStyle = lcdG;
    ctx.fill();

    ctx.fillStyle = '#1d221c';
    ctx.font = '700 23px "Geist Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(volts.toFixed(2), 164, 71);
    ctx.font = '600 11px "Geist Mono", monospace';
    ctx.fillText('V', 180, 70);
    ctx.font = '500 8.5px -apple-system, "PingFang SC", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('直流', 62, 54);

    // 量程转盘与挡位刻度
    var dx = 122, dy = 144, dr = 35;
    ctx.fillStyle = 'rgba(240,236,228,0.55)';
    ctx.font = '500 8px "Geist Mono", -apple-system, sans-serif';
    ctx.textAlign = 'center';
    var marks = [
      [-162, '关'], [-124, 'V~'], [-88, 'mV'], [-52, 'V='],
      [-16, 'Ω'], [20, '蜂鸣'], [152, 'mA']
    ];
    marks.forEach(function (m) {
      var ar = m[0] * Math.PI / 180;
      ctx.fillText(m[1], dx + Math.cos(ar) * (dr + 13), dy + Math.sin(ar) * (dr + 13) + 3);
    });

    ctx.beginPath();
    ctx.arc(dx, dy, dr, 0, Math.PI * 2);
    ctx.fillStyle = '#2d3034';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 旋钮凸起拨杆（指向 V= 挡）
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate(-0.92);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 3;
    rr(ctx, -7, -dr + 3, 14, dr * 2 - 6, 6);
    ctx.fillStyle = '#43474d';
    ctx.fill();
    // 白色指向端
    ctx.fillStyle = '#f2ede2';
    ctx.fillRect(-2, -dr + 6, 4, 8);
    ctx.restore();

    // 底部三孔表笔插口（10A / 公共黑 / 电压红）
    var jacks = [
      { x: 78, c: '#9e3528', lb: '10A' },
      { x: 122, c: '#1c1d1f', lb: '公共', plug: '#232528' },
      { x: 166, c: '#b83728', lb: 'VΩ', plug: '#b83728' }
    ];
    jacks.forEach(function (jk) {
      ctx.beginPath();
      ctx.arc(jk.x, 212, 11, 0, Math.PI * 2);
      ctx.fillStyle = jk.c;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(jk.x, 212, 5.5, 0, Math.PI * 2);
      ctx.fillStyle = '#111214';
      ctx.fill();
      ctx.fillStyle = 'rgba(240,236,228,0.5)';
      ctx.font = '400 8px -apple-system, "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(jk.lb, jk.x, 196);

      if (jk.plug) {
        // 插入的弯头表笔护套
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 5;
        rr(ctx, jk.x - 7, 206, 14, 28, 6);
        ctx.fillStyle = jk.plug;
        ctx.fill();
        ctx.restore();
      }
    });
  }

  /* 对外暴露控制器 */
  w.DeskArt = {
    create: function () {
      applyGrain();
      var els = {
        mat: d.getElementById('cvMat'),
        solder: d.getElementById('cvSolder'),
        spool: d.getElementById('cvSpool'),
        pcb: d.getElementById('cvPcb'),
        meter: d.getElementById('cvMeter')
      };
      var dpr = 1, active = true;
      var cur = { temp: 350, heat: 0.35, sheen: 0, pulse: 0, volts: 3.30 };
      var prev = { temp: -1, heat: -1, sheen: -1, pulse: -1, volts: -1 };

      function getDpr() {
        var raw = w.devicePixelRatio || 1;
        return Math.min(raw, w.innerWidth < 768 ? 1 : 1.5);
      }

      function renderAll(force) {
        if (!active && !force) return;
        var nextDpr = getDpr();
        if (nextDpr !== dpr) { dpr = nextDpr; force = true; }
        if (force) drawMat(els.mat, dpr);

        var tRound = Math.round(cur.temp);
        var hRound = Math.round(cur.heat * 25) / 25;
        if (force || tRound !== prev.temp || hRound !== prev.heat) {
          drawSolder(els.solder, dpr, { temp: tRound, heat: hRound });
          prev.temp = tRound; prev.heat = hRound;
        }

        var sRound = Math.round(cur.sheen * 20) / 20;
        if (force || sRound !== prev.sheen) {
          drawSpool(els.spool, dpr, { sheen: sRound });
          prev.sheen = sRound;
        }

        var pRound = Math.round(cur.pulse * 12) / 12;
        if (force || pRound !== prev.pulse) {
          drawPcb(els.pcb, dpr, { pulse: pRound });
          prev.pulse = pRound;
        }

        var vRound = Math.round(cur.volts * 50) / 50;
        if (force || vRound !== prev.volts) {
          drawMeter(els.meter, dpr, { volts: vRound });
          prev.volts = vRound;
        }
      }

      // 页面可见性与视口内观察：离屏或切后台时零重绘
      d.addEventListener('visibilitychange', function () {
        active = !d.hidden;
        if (active) renderAll(false);
      });
      if (w.IntersectionObserver && els.solder) {
        var stage = d.getElementById('stage');
        if (stage) {
          var io = new IntersectionObserver(function (entries) {
            active = !d.hidden && entries[0].isIntersecting;
          }, { threshold: 0.01 });
          io.observe(stage);
        }
      }

      renderAll(true);

      return {
        resize: function () { renderAll(true); },
        update: function (next) {
          if (next.temp != null) cur.temp = next.temp;
          if (next.heat != null) cur.heat = next.heat;
          if (next.sheen != null) cur.sheen = next.sheen;
          if (next.pulse != null) cur.pulse = next.pulse;
          if (next.volts != null) cur.volts = next.volts;
          renderAll(false);
        }
      };
    }
  };
})(window, document);
