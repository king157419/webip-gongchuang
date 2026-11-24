/* =====================================================================
 * v14-toybox · 手写 2D 刚体物理引擎（胶囊体 / 圆体）
 * 支持：重力堆叠、双接触点流形、偏心力矩抓取与甩出、摩擦与弹性恢复、
 *       视口外/后台自动停帧、prefers-reduced-motion 静态落位、2.3s 后台兜底
 * ===================================================================== */
(function () {
  'use strict';

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  // 点 P 到线段 AB 的最近点
  function closestOnSeg(px, py, ax, ay, bx, by) {
    var abx = bx - ax, aby = by - ay;
    var len2 = abx * abx + aby * aby;
    if (len2 < 1e-6) return { x: ax, y: ay, t: 0 };
    var t = ((px - ax) * abx + (py - ay) * aby) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    return { x: ax + abx * t, y: ay + aby * t, t: t };
  }

  // 判断两线段 AB 与 CD 是否严格相交，若相交返回交点
  function segIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    var rX = bx - ax, rY = by - ay;
    var sX = dx - cx, sY = dy - cy;
    var denom = rX * sY - rY * sX;
    if (Math.abs(denom) < 1e-6) return null;
    var qpX = cx - ax, qpY = cy - ay;
    var t = (qpX * sY - qpY * sX) / denom;
    var u = (qpX * rY - qpY * rX) / denom;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return { x: ax + t * rX, y: ay + t * rY };
    }
    return null;
  }

  function createToyBox(opts) {
    var stage = opts.stage;
    var reduceMotion = !!opts.reduceMotion;
    var onCapsuleClick = opts.onCapsuleClick || function () {};
    var onZhiTap = opts.onZhiTap || function () {};

    var W = stage.clientWidth || 375;
    var H = stage.clientHeight || 680;
    var floorPad = 15;
    var wallPad = 10;
    var ceilPad = 64;

    var GRAVITY = 1680;
    var RESTITUTION = 0.40;
    var FRICTION = 0.36;
    var bodies = [];
    var running = false;
    var inView = true;
    var sleepFrames = 0;
    var totalFrames = 0;
    var lastTime = 0;
    var fallbackTimer = 0;

    // 当前指针抓取状态
    var grab = null;

    function zhiSize() {
      return W < 480 ? 64 : W < 900 ? 80 : 94;
    }

    function setZhiFrame(b, frameIdx) {
      if (b.kind !== 'zhi' || !b.spriteEl) return;
      b.frame = ((frameIdx % 4) + 4) % 4;
      var pct = (b.frame * 100 / 3).toFixed(3);
      b.spriteEl.style.backgroundPosition = pct + '% 0%';
    }

    function syncGeometry() {
      W = stage.clientWidth || window.innerWidth || 375;
      H = stage.clientHeight || 680;
      var zs = zhiSize();

      bodies.forEach(function (b) {
        if (b.kind === 'zhi') {
          b.el.style.width = zs + 'px';
          b.el.style.height = zs + 'px';
          b.w = zs;
          b.h = zs;
          b.L = 0;
          b.R = zs * 0.43; // 贴合透明底小智主体轮廓
        } else {
          var h = W < 480 ? 42 : W < 900 ? 50 : 58;
          var padX = W < 480 ? 13 : W < 900 ? 17 : 21;
          b.el.style.height = h + 'px';
          b.el.style.padding = '0 ' + padX + 'px';
          var rectW = b.el.offsetWidth || (W < 480 ? 116 : 168);
          var rectH = b.el.offsetHeight || h;
          b.w = rectW;
          b.h = rectH;
          b.R = rectH * 0.5;
          b.L = Math.max(0, (rectW - rectH) * 0.5);
        }
        var area = Math.PI * b.R * b.R + 4 * b.L * b.R;
        b.m = Math.max(1, area * 0.0012);
        var bw = 2 * (b.L + b.R), bh = 2 * b.R;
        b.I = b.m * (bw * bw + bh * bh) / 12;
        b.invM = 1 / b.m;
        b.invI = 1 / b.I;
      });
    }

    // 创建 DOM 节点与刚体对象
    function buildBodies(items) {
      stage.innerHTML = '';
      bodies = items.map(function (it, idx) {
        var btn = document.createElement('button');
        btn.type = 'button';
        var spriteEl = null;

        if (it.kind === 'zhi') {
          btn.className = 'toy-item toy-zhi';
          btn.setAttribute('aria-label', it.aria || '吉祥物小智：可拖动甩出，点击查看社团趣味事实');
          spriteEl = document.createElement('span');
          spriteEl.className = 'zhi-sprite';
          spriteEl.setAttribute('aria-hidden', 'true');
          btn.appendChild(spriteEl);
        } else {
          btn.className = 'toy-item toy-pill';
          btn.setAttribute('data-cat', it.id);
          btn.setAttribute('aria-label', it.label + '活动胶囊：可拖动碰撞，点击滚到' + it.label + '详细介绍');
          btn.innerHTML =
            '<span class="pill-badge" aria-hidden="true">' + String(idx + 1).padStart(2, '0') + '</span>' +
            '<span class="pill-label">' + it.label + '</span>' +
            '<span class="pill-go" aria-hidden="true">↘</span>';
        }

        stage.appendChild(btn);

        var body = {
          idx: idx,
          kind: it.kind,
          id: it.id,
          label: it.label || '小智',
          el: btn,
          spriteEl: spriteEl,
          frame: it.frame || 0,
          baseFrame: it.frame || 0,
          x: 0, y: 0, a: 0,
          vx: 0, vy: 0, av: 0,
          w: 120, h: 48, L: 36, R: 24,
          m: 2, I: 800, invM: 0.5, invI: 0.00125,
          held: false,
          entered: false,
          ignoreClick: false,
          reactTimer: 0
        };

        if (it.kind === 'zhi') setZhiFrame(body, body.baseFrame);
        bindBodyEvents(body);
        return body;
      });

      syncGeometry();
    }

    function paint() {
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        var tx = b.x - b.w * 0.5;
        var ty = b.y - b.h * 0.5;
        var deg = b.a * 57.2957795;
        var sc = b.held ? ' scale(1.04)' : '';
        b.el.style.transform = 'translate3d(' + tx.toFixed(2) + 'px,' + ty.toFixed(2) + 'px,0) rotate(' + deg.toFixed(2) + 'deg)' + sc;
      }
    }

    // 施加冲量 (jx, jy) 于质心偏移 (rx, ry)
    function applyImpulse(b, jx, jy, rx, ry) {
      b.vx += jx * b.invM;
      b.vy += jy * b.invM;
      b.av += (rx * jy - ry * jx) * b.invI;
    }

    // 解决单点与静态边界碰撞（法向指向舞台内部 nx, ny）
    function solveWallContact(b, rx, ry, nx, ny, pen) {
      var rvx = b.vx - b.av * ry;
      var rvy = b.vy + b.av * rx;
      var vn = rvx * nx + rvy * ny;

      if (vn < 0) {
        var rn = rx * ny - ry * nx;
        var kN = b.invM + rn * rn * b.invI;
        var e = (-vn > 95 && !b.held) ? RESTITUTION : 0;
        var jn = -(1 + e) * vn / kN;
        applyImpulse(b, jn * nx, jn * ny, rx, ry);

        // 库仑切向摩擦
        rvx = b.vx - b.av * ry;
        rvy = b.vy + b.av * rx;
        var tx = -ny, ty = nx;
        var vt = rvx * tx + rvy * ty;
        var rt = rx * ty - ry * tx;
        var kT = b.invM + rt * rt * b.invI;
        var jt = clamp(-vt / kT, -FRICTION * jn, FRICTION * jn);
        applyImpulse(b, jt * tx, jt * ty, rx, ry);
      }

      var slop = 0.4;
      if (pen > slop) {
        var corr = (pen - slop) * 0.55;
        b.x += nx * corr;
        b.y += ny * corr;
      }
    }

    // 刚体与四壁/地板碰撞（胶囊两端点独立检测，支持斜落拍平与稳定平躺）
    function collideWalls(b) {
      var ux = Math.cos(b.a) * b.L;
      var uy = Math.sin(b.a) * b.L;
      var count = b.L > 0.5 ? 2 : 1;
      var floorY = H - floorPad;
      var leftX = wallPad;
      var rightX = W - wallPad;
      var topY = ceilPad;

      if (!b.entered && (b.y - b.R > topY)) {
        b.entered = true;
      }

      for (var k = 0; k < count; k++) {
        var sgn = k === 0 ? -1 : 1;
        var ex = b.x + sgn * ux;
        var ey = b.y + sgn * uy;

        // 地板 (n = 0, -1)
        var penFloor = (ey + b.R) - floorY;
        if (penFloor > 0) {
          solveWallContact(b, ex - b.x, (ey + b.R) - b.y, 0, -1, penFloor);
        }
        // 左墙 (n = 1, 0)
        var penLeft = leftX - (ex - b.R);
        if (penLeft > 0) {
          solveWallContact(b, (ex - b.R) - b.x, ey - b.y, 1, 0, penLeft);
        }
        // 右墙 (n = -1, 0)
        var penRight = (ex + b.R) - rightX;
        if (penRight > 0) {
          solveWallContact(b, (ex + b.R) - b.x, ey - b.y, -1, 0, penRight);
        }
        // 顶棚（仅入场后生效，允许开场从上方自然掉入）
        if (b.entered) {
          var penTop = topY - (ey - b.R);
          if (penTop > 0) {
            solveWallContact(b, ex - b.x, (ey - b.R) - b.y, 0, 1, penTop);
          }
        }
      }
    }

    // 解决两刚体接触点
    function solvePairContact(A, B, pax, pay, pbx, pby, dist) {
      var rsum = A.R + B.R;
      var pen = rsum - dist;
      if (pen <= 0) return;

      var nx, ny;
      if (dist > 1e-4) {
        nx = (pbx - pax) / dist;
        ny = (pby - pay) / dist;
      } else {
        var dx = B.x - A.x, dy = B.y - A.y;
        var dl = Math.hypot(dx, dy);
        nx = dl > 1e-4 ? dx / dl : 0;
        ny = dl > 1e-4 ? dy / dl : -1;
      }

      var cpx = pax + nx * (A.R - pen * 0.5);
      var cpy = pay + ny * (A.R - pen * 0.5);
      var rAx = cpx - A.x, rAy = cpy - A.y;
      var rBx = cpx - B.x, rBy = cpy - B.y;

      var vAx = A.vx - A.av * rAy, vAy = A.vy + A.av * rAx;
      var vBx = B.vx - B.av * rBy, vBy = B.vy + B.av * rBx;
      var rvx = vBx - vAx, rvy = vBy - vAy;
      var vn = rvx * nx + rvy * ny;

      if (vn < 0) {
        var rnA = rAx * ny - rAy * nx;
        var rnB = rBx * ny - rBy * nx;
        var kN = A.invM + B.invM + rnA * rnA * A.invI + rnB * rnB * B.invI;
        var e = (-vn > 95) ? RESTITUTION : 0;
        var jn = -(1 + e) * vn / kN;

        applyImpulse(A, -jn * nx, -jn * ny, rAx, rAy);
        applyImpulse(B,  jn * nx,  jn * ny, rBx, rBy);

        // 碰撞表情彩蛋：小智被快速撞击时短暂切换惊讶/晕乎表情
        if (-vn > 440) {
          flashZhiImpact(A);
          flashZhiImpact(B);
        }

        // 切向摩擦冲量
        vAx = A.vx - A.av * rAy; vAy = A.vy + A.av * rAx;
        vBx = B.vx - B.av * rBy; vBy = B.vy + B.av * rBx;
        rvx = vBx - vAx; rvy = vBy - vAy;
        var tx = -ny, ty = nx;
        var vt = rvx * tx + rvy * ty;
        var rtA = rAx * ty - rAy * tx;
        var rtB = rBx * ty - rBy * tx;
        var kT = A.invM + B.invM + rtA * rtA * A.invI + rtB * rtB * B.invI;
        var jt = clamp(-vt / kT, -FRICTION * jn, FRICTION * jn);
        applyImpulse(A, -jt * tx, -jt * ty, rAx, rAy);
        applyImpulse(B,  jt * tx,  jt * ty, rBx, rBy);
      }

      // 位置分离修正（带 0.5px 容差防止堆叠微抖）
      var slop = 0.5;
      if (pen > slop) {
        var invSum = A.invM + B.invM;
        var corr = (pen - slop) * 0.48 / invSum;
        // 被手抓持的物体减少被动退让，手感更跟手
        var wA = A.held ? A.invM * 0.25 : A.invM;
        var wB = B.held ? B.invM * 0.25 : B.invM;
        var wSum = wA + wB || 1;
        var scale = invSum / wSum;
        A.x -= nx * corr * wA * scale;
        A.y -= ny * corr * wA * scale;
        B.x += nx * corr * wB * scale;
        B.y += ny * corr * wB * scale;
      }
    }

    function flashZhiImpact(b) {
      if (b.kind !== 'zhi' || b.held) return;
      setZhiFrame(b, 3);
      clearTimeout(b.reactTimer);
      b.reactTimer = setTimeout(function () {
        if (!b.held) setZhiFrame(b, b.baseFrame);
      }, 650);
    }

    // 胶囊与胶囊/圆体双接触点流形检测
    function collidePair(A, B) {
      var reachA = A.L + A.R, reachB = B.L + B.R;
      if (Math.abs(A.x - B.x) > reachA + reachB || Math.abs(A.y - B.y) > reachA + reachB) return;

      var uAx = Math.cos(A.a) * A.L, uAy = Math.sin(A.a) * A.L;
      var uBx = Math.cos(B.a) * B.L, uBy = Math.sin(B.a) * B.L;
      var a0x = A.x - uAx, a0y = A.y - uAy, a1x = A.x + uAx, a1y = A.y + uAy;
      var b0x = B.x - uBx, b0y = B.y - uBy, b1x = B.x + uBx, b1y = B.y + uBy;

      var rsum = A.R + B.R;
      var rsum2 = rsum * rsum;
      var cands = [];

      function pushCand(pax, pay, pbx, pby) {
        var dx = pbx - pax, dy = pby - pay;
        var d2 = dx * dx + dy * dy;
        if (d2 < rsum2) cands.push({ pax: pax, pay: pay, pbx: pbx, pby: pby, d2: d2 });
      }

      var q0 = closestOnSeg(a0x, a0y, b0x, b0y, b1x, b1y);
      pushCand(a0x, a0y, q0.x, q0.y);
      if (A.L > 0.5) {
        var q1 = closestOnSeg(a1x, a1y, b0x, b0y, b1x, b1y);
        pushCand(a1x, a1y, q1.x, q1.y);
      }
      var p0 = closestOnSeg(b0x, b0y, a0x, a0y, a1x, a1y);
      pushCand(p0.x, p0.y, b0x, b0y);
      if (B.L > 0.5) {
        var p1 = closestOnSeg(b1x, b1y, a0x, a0y, a1x, a1y);
        pushCand(p1.x, p1.y, b1x, b1y);
      }
      if (A.L > 0.5 && B.L > 0.5) {
        var hit = segIntersect(a0x, a0y, a1x, a1y, b0x, b0y, b1x, b1y);
        if (hit) pushCand(hit.x, hit.y, hit.x, hit.y);
      }

      if (!cands.length) return;
      cands.sort(function (u, v) { return u.d2 - v.d2; });

      var c0 = cands[0];
      solvePairContact(A, B, c0.pax, c0.pay, c0.pbx, c0.pby, Math.sqrt(c0.d2));

      // 若两胶囊接近平行叠放，求解第二个独立接触点，保证叠放平稳不翘板
      for (var i = 1; i < cands.length; i++) {
        var ci = cands[i];
        var mx0 = (c0.pax + c0.pbx) * 0.5, my0 = (c0.pay + c0.pby) * 0.5;
        var mxi = (ci.pax + ci.pbx) * 0.5, myi = (ci.pay + ci.pby) * 0.5;
        if ((mxi - mx0) * (mxi - mx0) + (myi - my0) * (myi - my0) > 196) {
          solvePairContact(A, B, ci.pax, ci.pay, ci.pbx, ci.pby, Math.sqrt(ci.d2));
          break;
        }
      }
    }

    // 偏心抓取弹簧阻尼约束（捏住胶囊一端时会自然垂摆并产生真实角动量）
    function solveGrabConstraint() {
      if (!grab || !grab.body) return;
      var b = grab.body;
      var ca = Math.cos(b.a), sa = Math.sin(b.a);
      var rx = grab.gx * ca - grab.gy * sa;
      var ry = grab.gx * sa + grab.gy * ca;
      var wx = b.x + rx, wy = b.y + ry;

      var vwx = b.vx - b.av * ry;
      var vwy = b.vy + b.av * rx;

      var desVx = clamp((grab.px - wx) * 32 + grab.pvx * 0.25, -3000, 3000);
      var desVy = clamp((grab.py - wy) * 32 + grab.pvy * 0.25, -3000, 3000);
      var dvx = desVx - vwx;
      var dvy = desVy - vwy;

      var kxx = b.invM + b.invI * ry * ry;
      var kyy = b.invM + b.invI * rx * rx;
      var kxy = -b.invI * rx * ry;
      var det = kxx * kyy - kxy * kxy;
      if (det > 1e-8) {
        var jx = (kyy * dvx - kxy * dvy) / det;
        var jy = (-kxy * dvx + kxx * dvy) / det;
        applyImpulse(b, jx * 0.55, jy * 0.55, rx, ry);
      }
      b.av *= 0.965;
    }

    function stepWorld(dt) {
      var SUBS = 6;
      var h = dt / SUBS;
      var n = bodies.length;

      for (var s = 0; s < SUBS; s++) {
        for (var i = 0; i < n; i++) {
          var b = bodies[i];
          b.vy += GRAVITY * h;
          // 底部微配重回正力矩（像真实不倒翁玩具，自由翻滚碰撞但静止时字面朝上不倒扣）
          if (!b.held) {
            while (b.a > Math.PI) b.a -= Math.PI * 2;
            while (b.a < -Math.PI) b.a += Math.PI * 2;
            var righting = b.kind === 'zhi' ? 24 : 15;
            b.av -= Math.sin(b.a) * righting * h;
            if (Math.abs(b.a) > 1.18) {
              b.av -= (b.a - (b.a > 0 ? 1.18 : -1.18)) * 34 * h;
            }
          }
          b.vx *= 0.997;
          b.vy *= 0.997;
          b.av *= 0.99;
        }

        solveGrabConstraint();

        for (var k = 0; k < n; k++) {
          bodies[k].x += bodies[k].vx * h;
          bodies[k].y += bodies[k].vy * h;
          bodies[k].a += bodies[k].av * h;
        }

        // 4 轮顺序冲量迭代，使堆叠紧实稳定
        for (var it = 0; it < 4; it++) {
          for (var a = 0; a < n; a++) {
            for (var c = a + 1; c < n; c++) {
              collidePair(bodies[a], bodies[c]);
            }
          }
          for (var m = 0; m < n; m++) {
            collideWalls(bodies[m]);
          }
        }
      }
    }

    function settleSync(steps) {
      for (var i = 0; i < steps; i++) {
        stepWorld(1 / 60);
      }
      for (var k = 0; k < bodies.length; k++) {
        bodies[k].vx = bodies[k].vy = bodies[k].av = 0;
        bodies[k].entered = true;
      }
      paint();
    }

    function wake() {
      sleepFrames = 0;
      if (reduceMotion) return;
      if (!running && inView && !document.hidden) {
        running = true;
        lastTime = performance.now();
        requestAnimationFrame(tick);
      }
    }

    function stop() {
      running = false;
    }

    function tick(now) {
      if (!running) return;
      if (!inView || document.hidden) {
        running = false;
        return;
      }
      var dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;
      if (dt > 0.0005) {
        stepWorld(dt);
        totalFrames++;
        paint();
      }

      // 静止休眠检测：全部落地且无拖拽、速度极小时自动停止 rAF，0 CPU 占用
      var quiet = !grab;
      if (quiet) {
        for (var i = 0; i < bodies.length; i++) {
          var b = bodies[i];
          if (!b.entered || Math.abs(b.vx) > 7 || Math.abs(b.vy) > 7 || Math.abs(b.av) > 0.09) {
            quiet = false;
            break;
          }
        }
      }
      if (quiet) {
        sleepFrames++;
        if (sleepFrames > 42) {
          for (var j = 0; j < bodies.length; j++) {
            bodies[j].vx = bodies[j].vy = bodies[j].av = 0;
          }
          paint();
          running = false;
          return;
        }
      } else {
        sleepFrames = 0;
      }

      requestAnimationFrame(tick);
    }

    function dropAll(animateAllowed) {
      clearTimeout(fallbackTimer);
      syncGeometry();
      totalFrames = 0;
      sleepFrames = 0;

      var n = bodies.length;
      var usableW = Math.max(180, W - wallPad * 2 - 120);
      // 交错槽位，保证首屏底部堆叠错落有层次且不偏一边
      var order = [0, 5, 1, 2, 6, 3, 4];

      for (var k = 0; k < n; k++) {
        var b = bodies[order[k] != null ? order[k] : k];
        var slot = (k + 0.5) / n;
        var halfSpan = b.L + b.R + wallPad + 4;
        b.x = clamp(W * (0.12 + slot * 0.76) + rand(-18, 18), halfSpan, W - halfSpan);
        b.y = -42 - k * (W < 520 ? 54 : 46) - rand(0, 18);
        b.a = rand(-0.34, 0.34);
        b.vx = rand(-85, 85);
        b.vy = rand(80, 210);
        b.av = rand(-1.3, 1.3);
        b.entered = false;
        b.held = false;
        if (b.kind === 'zhi') setZhiFrame(b, b.baseFrame);
      }

      if (reduceMotion || animateAllowed === false) {
        settleSync(220);
        return;
      }

      paint();
      wake();

      // 硬约束兜底：2.3 秒后若标签页在后台导致 rAF 未推进，直接完成物理落位
      fallbackTimer = setTimeout(function () {
        var anyHigh = bodies.some(function (b) { return !b.entered || b.y < 0; });
        if (anyHigh || totalFrames < 18) {
          stop();
          settleSync(210);
        }
      }, 2300);
    }

    function stagePt(e) {
      var r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }

    function bindBodyEvents(b) {
      b.el.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        var pt = stagePt(e);
        try { b.el.setPointerCapture(e.pointerId); } catch (err) {}

        var dx = pt.x - b.x, dy = pt.y - b.y;
        var ca = Math.cos(b.a), sa = Math.sin(b.a);
        // 限制偏心抓取半径在玩具尺寸内
        var gx = clamp(dx * ca + dy * sa, -(b.L + b.R * 0.8), b.L + b.R * 0.8);
        var gy = clamp(-dx * sa + dy * ca, -b.R * 0.8, b.R * 0.8);

        grab = {
          pointerId: e.pointerId,
          body: b,
          startX: e.clientX,
          startY: e.clientY,
          startT: performance.now(),
          px: pt.x,
          py: pt.y,
          lastX: pt.x,
          lastY: pt.y,
          lastT: performance.now(),
          pvx: 0,
          pvy: 0,
          gx: gx,
          gy: gy,
          moved: false
        };

        b.held = true;
        b.entered = true;
        b.el.classList.add('is-held');
        if (b.kind === 'zhi') setZhiFrame(b, 2);
        wake();
      });

      b.el.addEventListener('pointermove', function (e) {
        if (!grab || grab.body !== b || grab.pointerId !== e.pointerId) return;
        var dist = Math.hypot(e.clientX - grab.startX, e.clientY - grab.startY);
        if (!grab.moved && dist > 6) {
          grab.moved = true;
        }
        var pt = stagePt(e);
        var now = performance.now();
        var dt = Math.max(8, now - grab.lastT) / 1000;
        var vx = (pt.x - grab.lastX) / dt;
        var vy = (pt.y - grab.lastY) / dt;
        grab.pvx = grab.pvx * 0.45 + vx * 0.55;
        grab.pvy = grab.pvy * 0.45 + vy * 0.55;
        grab.px = clamp(pt.x, wallPad + 8, W - wallPad - 8);
        grab.py = clamp(pt.y, ceilPad + 8, H - floorPad - 8);
        grab.lastX = pt.x;
        grab.lastY = pt.y;
        grab.lastT = now;

        if (reduceMotion && grab.moved) {
          b.x = grab.px;
          b.y = grab.py;
          paint();
        } else {
          wake();
        }
      });

      function endGrab(e) {
        if (!grab || grab.body !== b || grab.pointerId !== e.pointerId) return;
        var wasMoved = grab.moved;
        var age = performance.now() - grab.lastT;
        var throwVx = age < 90 ? grab.pvx : grab.pvx * 0.35;
        var throwVy = age < 90 ? grab.pvy : grab.pvy * 0.35;
        grab = null;

        b.held = false;
        b.el.classList.remove('is-held');
        if (b.kind === 'zhi') setZhiFrame(b, b.baseFrame);

        if (wasMoved) {
          b.ignoreClick = true;
          setTimeout(function () { b.ignoreClick = false; }, 80);
          if (reduceMotion) {
            settleSync(140);
          } else {
            b.vx = clamp(b.vx * 0.35 + throwVx * 0.72, -2500, 2500);
            b.vy = clamp(b.vy * 0.35 + throwVy * 0.72, -2500, 2500);
            b.av = clamp(b.av + throwVx * 0.004, -14, 14);
            wake();
          }
        }
      }

      b.el.addEventListener('pointerup', endGrab);
      b.el.addEventListener('pointercancel', endGrab);

      // 点击（含键盘 Enter/Space 触发）：平滑跳转或小智互动
      b.el.addEventListener('click', function () {
        if (b.ignoreClick) {
          b.ignoreClick = false;
          return;
        }
        if (b.kind === 'capsule') {
          if (!reduceMotion) {
            b.vy = -410;
            b.av += (Math.random() < 0.5 ? -1 : 1) * 2.4;
            wake();
          }
          onCapsuleClick(b.id, b);
        } else {
          b.baseFrame = (b.baseFrame + 1) % 4;
          setZhiFrame(b, b.baseFrame);
          if (!reduceMotion) {
            b.vy = -500;
            b.vx += rand(-160, 160);
            b.av += (Math.random() < 0.5 ? -1 : 1) * 4.2;
            wake();
          }
          onZhiTap(b);
        }
      });
    }

    // 监听视口显隐与窗口缩放
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        inView = entries.some(function (en) { return en.isIntersecting; });
        if (inView) wake(); else stop();
      }, { threshold: 0.02 });
      io.observe(stage);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop(); else wake();
    });

    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        var prevW = W;
        syncGeometry();
        if (prevW > 0 && Math.abs(W - prevW) > 4) {
          var ratio = W / prevW;
          bodies.forEach(function (b) {
            var margin = b.L + b.R + wallPad;
            b.x = clamp(b.x * ratio, margin, W - margin);
            b.y = Math.min(b.y, H - floorPad - b.R);
          });
          if (reduceMotion) settleSync(90);
          else wake();
        }
        paint();
      }, 90);
    });

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        syncGeometry();
        if (reduceMotion) settleSync(60);
        else wake();
      });
    }

    return {
      build: buildBodies,
      dropAll: dropAll,
      wake: wake,
      stop: stop
    };
  }

  window.ToyBox = { create: createToyBox };
})();
