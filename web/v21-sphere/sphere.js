/* v21-sphere · sphere.js —— 手写 WebGL1「报道星球」渲染器
 * 74 张弧面纸质小卡铺成 3D 球面（取自 window.CLUB 报道/活动/部门 + 小智四表情） */
(function () {
  'use strict';

  var DEG = Math.PI / 180;

  function clamp(v, a, b) {
    return v < a ? a : v > b ? b : v;
  }

  /* 将中文长句按像素宽度折行绘制到 2D Canvas */
  function wrapText(ctx, text, x, y, maxW, lineH, maxLines) {
    var s = String(text || '');
    var line = '';
    var row = 0;
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var test = line + ch;
      if (ctx.measureText(test).width > maxW && line.length > 0) {
        row++;
        if (row >= maxLines) {
          ctx.fillText(line.slice(0, Math.max(1, line.length - 1)) + '…', x, y);
          return y + lineH;
        }
        ctx.fillText(line, x, y);
        y += lineH;
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, x, y);
      y += lineH;
    }
    return y;
  }

  /* 绘制圆角矩形路径 */
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* 生成 6×6 纸质卡片纹理图集（共 36 格） */
  function AtlasBuilder(club, maxTexSize, onUpdate) {
    this.club = club;
    this.size = Math.min(1536, maxTexSize || 1536);
    if (window.innerWidth <= 768) {
      this.size = Math.min(1024, this.size);
    }
    this.cols = 6;
    this.rows = 6;
    this.cv = document.createElement('canvas');
    this.cv.width = this.size;
    this.cv.height = this.size;
    this.ctx = this.cv.getContext('2d');
    this.zhiImg = null;
    this.onUpdate = onUpdate;
    this.drawAll();

    var self = this;
    var img = new Image();
    img.onload = function () {
      self.zhiImg = img;
      self.drawZhiTiles();
      if (self.onUpdate) self.onUpdate();
    };
    img.src = '../shared/img/ip/zhi-expressions.webp';

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        self.drawAll();
        if (self.onUpdate) self.onUpdate();
      }).catch(function () {});
    }
  }

  AtlasBuilder.prototype.cellRect = function (idx) {
    var cw = this.size / this.cols;
    var ch = this.size / this.rows;
    var c = idx % this.cols;
    var r = Math.floor(idx / this.cols);
    var padX = Math.round(cw * 0.055);
    var padY = Math.round(ch * 0.035);
    return {
      x: c * cw + padX,
      y: r * ch + padY,
      w: cw - padX * 2,
      h: ch - padY * 2,
      cw: cw,
      ch: ch,
      cx: c * cw,
      cy: r * ch
    };
  };

  AtlasBuilder.prototype.uvRect = function (idx) {
    var b = this.cellRect(idx);
    var S = this.size;
    return [b.x / S, b.y / S, (b.x + b.w) / S, (b.y + b.h) / S];
  };

  AtlasBuilder.prototype.baseCard = function (idx, bg, accent, borderCol) {
    var ctx = this.ctx;
    var b = this.cellRect(idx);
    ctx.save();
    ctx.fillStyle = bg;
    ctx.fillRect(b.cx, b.cy, b.cw, b.ch);

    roundRect(ctx, b.x, b.y, b.w, b.h, b.w * 0.035);
    ctx.fillStyle = bg;
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, b.w * 0.012);
    ctx.strokeStyle = borderCol || 'rgba(23,22,20,0.26)';
    ctx.stroke();

    if (accent) {
      ctx.fillStyle = accent;
      ctx.fillRect(b.x + b.w * 0.06, b.y + b.h * 0.045, b.w * 0.88, Math.max(3, b.h * 0.032));
    }
    ctx.restore();
    return b;
  };

  AtlasBuilder.prototype.drawAll = function () {
    var ctx = this.ctx;
    var C = this.club;
    var S = this.size;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#ece8df';
    ctx.fillRect(0, 0, S, S);

    var serif = '"SHU Serif", "Songti SC", serif';
    var mono = '"Geist Mono", monospace';
    var sans = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    function putText(font, col, txt, x, y) {
      ctx.fillStyle = col;
      ctx.font = font;
      ctx.fillText(txt, x, y);
    }

    /* 0..3：四张章节引导封面卡（对应第 2–5 拍飞出球面的主卡） */
    var covers = [
      { no: '02 / 05', tag: '常态活动', title: '平时做什么', sub: (C.programs ? C.programs.length : 5) + ' 类常态实践活动', acc: '#ba3d24' },
      { no: '03 / 05', tag: '官网报道', title: '做过的事', sub: (C.news ? C.news.length : 16) + ' 篇学院公开报道', acc: '#234d7a' },
      { no: '04 / 05', tag: '社团骨干', title: '谁在带大家', sub: '社长 · 指导老师 · 4 部门', acc: '#2e5d47' },
      { no: '05 / 05', tag: '随时加入', title: '怎么加入', sub: '上海大学通信学院公众号', acc: '#ba3d24' }
    ];
    for (var k = 0; k < 4; k++) {
      var cv = covers[k];
      var b = this.baseCard(k, '#fbf8f1', cv.acc, 'rgba(23,22,20,0.34)');
      var u = b.w / 200;
      putText('700 ' + Math.round(15 * u) + 'px ' + mono, cv.acc, cv.no, b.x + 14 * u, b.y + 34 * u);
      putText('600 ' + Math.round(13 * u) + 'px ' + sans, '#6b665d', cv.tag, b.x + 14 * u, b.y + 56 * u);

      ctx.fillStyle = '#171614';
      ctx.font = '900 ' + Math.round(30 * u) + 'px ' + serif;
      wrapText(ctx, cv.title, b.x + 14 * u, b.y + 102 * u, b.w - 28 * u, 34 * u, 2);

      ctx.strokeStyle = 'rgba(23,22,20,0.16)';
      ctx.lineWidth = Math.max(1, u);
      ctx.beginPath();
      ctx.moveTo(b.x + 14 * u, b.y + b.h - 54 * u);
      ctx.lineTo(b.x + b.w - 14 * u, b.y + b.h - 54 * u);
      ctx.stroke();

      ctx.fillStyle = '#3f3c36';
      ctx.font = '600 ' + Math.round(13 * u) + 'px ' + sans;
      wrapText(ctx, cv.sub, b.x + 14 * u, b.y + b.h - 30 * u, b.w - 28 * u, 17 * u, 2);
    }

    /* 4..19：16 篇真实报道剪报卡 */
    var catMeta = {
      weld: { name: '焊接实践', col: '#ba3d24' },
      course: { name: '昇腾课程', col: '#234d7a' },
      visit: { name: '企业参访', col: '#2e5d47' },
      contest: { name: '创新大赛', col: '#8f621e' },
      talk: { name: '经验分享', col: '#3b3935' }
    };
    var news = C.news || [];
    for (var n = 0; n < 16; n++) {
      var item = news[n % Math.max(1, news.length)];
      var cm = catMeta[item && item.cat] || catMeta.talk;
      var nb = this.baseCard(4 + n, '#f8f5ed', cm.col, 'rgba(23,22,20,0.23)');
      var nu = nb.w / 200;
      var dt = item ? String(item.date).replace(/-/g, '.') : '';
      putText('700 ' + Math.round(13 * nu) + 'px ' + sans, cm.col, cm.name, nb.x + 13 * nu, nb.y + 33 * nu);
      putText('600 ' + Math.round(13 * nu) + 'px ' + mono, '#6b665d', dt, nb.x + 13 * nu, nb.y + 52 * nu);

      var cleanTitle = item ? String(item.title).replace(/^.*?[|｜—]+/, '').trim() : '';
      if (!cleanTitle && item) cleanTitle = item.title;
      ctx.fillStyle = '#181715';
      ctx.font = '900 ' + Math.round(18 * nu) + 'px ' + serif;
      wrapText(ctx, cleanTitle, nb.x + 13 * nu, nb.y + 82 * nu, nb.w - 26 * nu, 24 * nu, 4);

      ctx.strokeStyle = 'rgba(23,22,20,0.11)';
      ctx.lineWidth = Math.max(1, nu);
      for (var ln = 0; ln < 2; ln++) {
        var ly = nb.y + nb.h - (28 - ln * 11) * nu;
        ctx.beginPath();
        ctx.moveTo(nb.x + 13 * nu, ly);
        ctx.lineTo(nb.x + nb.w - (ln === 1 ? 48 : 13) * nu, ly);
        ctx.stroke();
      }
    }

    /* 20..24：5 类常态活动索引卡 */
    var progs = C.programs || [];
    for (var p = 0; p < 5; p++) {
      var pr = progs[p] || { name: '社团活动', where: '翔英大楼' };
      var pb = this.baseCard(20 + p, '#f0ebe0', '#171614', 'rgba(23,22,20,0.28)');
      var pu = pb.w / 200;
      putText('700 ' + Math.round(15 * pu) + 'px ' + mono, '#ba3d24', '0' + (p + 1), pb.x + 14 * pu, pb.y + 36 * pu);

      ctx.beginPath();
      ctx.arc(pb.x + pb.w - 22 * pu, pb.y + 28 * pu, 5.5 * pu, 0, Math.PI * 2);
      ctx.fillStyle = '#dad3c4';
      ctx.fill();
      ctx.strokeStyle = 'rgba(23,22,20,0.25)';
      ctx.stroke();

      ctx.fillStyle = '#171614';
      ctx.font = '900 ' + Math.round(23 * pu) + 'px ' + serif;
      wrapText(ctx, pr.name, pb.x + 14 * pu, pb.y + 76 * pu, pb.w - 28 * pu, 28 * pu, 3);
      ctx.fillStyle = '#5f5a51';
      ctx.font = '600 ' + Math.round(13 * pu) + 'px ' + sans;
      wrapText(ctx, pr.where, pb.x + 14 * pu, pb.y + pb.h - 26 * pu, pb.w - 28 * pu, 16 * pu, 2);
    }

    /* 25..28：4 个部门牛皮纸档案卡 */
    var depts = (C.meta && C.meta.departments) || [];
    for (var d = 0; d < 4; d++) {
      var dp = depts[d] || { name: '社团部门', desc: '' };
      var db = this.baseCard(25 + d, '#e7dec9', '#2e5d47', 'rgba(23,22,20,0.3)');
      var du = db.w / 200;
      putText('600 ' + Math.round(13 * du) + 'px ' + sans, '#5a5347', '社团部门 · 0' + (d + 1), db.x + 14 * du, db.y + 35 * du);
      putText('900 ' + Math.round(28 * du) + 'px ' + serif, '#171614', dp.name, db.x + 14 * du, db.y + 82 * du);
      ctx.fillStyle = '#3f3b34';
      ctx.font = '600 ' + Math.round(15 * du) + 'px ' + sans;
      wrapText(ctx, dp.desc, db.x + 14 * du, db.y + 116 * du, db.w - 28 * du, 21 * du, 3);
    }

    /* 29..32：小智 4 张表情拍立得卡 */
    this.drawZhiTiles();

    /* 33..34：两张真实里程碑数字卡 */
    var facts = [
      { big: '200', unit: '近 200 人参与', note: 'AI 顶级论文分享会 · 2024.12' },
      { big: String((C.meta && C.meta.founded) || 2021), unit: '成立年份', note: '宝山校区翔英大楼常驻实践' }
    ];
    for (var f = 0; f < 2; f++) {
      var fc = facts[f];
      var fb = this.baseCard(33 + f, '#f6f1e6', '#ba3d24', 'rgba(23,22,20,0.28)');
      var fu = fb.w / 200;
      putText('800 ' + Math.round(44 * fu) + 'px ' + mono, '#ba3d24', fc.big, fb.x + 14 * fu, fb.y + 74 * fu);
      putText('900 ' + Math.round(19 * fu) + 'px ' + serif, '#171614', fc.unit, fb.x + 14 * fu, fb.y + 108 * fu);
      ctx.fillStyle = '#5e5950';
      ctx.font = '600 ' + Math.round(13 * fu) + 'px ' + sans;
      wrapText(ctx, fc.note, fb.x + 14 * fu, fb.y + 138 * fu, fb.w - 28 * fu, 18 * fu, 2);
    }

    /* 35：纸卡背面纹理（供背面半球卡片双面渲染使用） */
    var bb = this.baseCard(35, '#d8d1c2', null, 'rgba(23,22,20,0.22)');
    var bu = bb.w / 200;
    ctx.strokeStyle = 'rgba(23,22,20,0.08)';
    ctx.lineWidth = Math.max(1, bu);
    ctx.strokeRect(bb.x + 14 * bu, bb.y + 14 * bu, bb.w - 28 * bu, bb.h - 28 * bu);
    ctx.beginPath();
    ctx.arc(bb.x + bb.w * 0.5, bb.y + bb.h * 0.5, 22 * bu, 0, Math.PI * 2);
    ctx.stroke();
  };

  AtlasBuilder.prototype.drawZhiTiles = function () {
    var ctx = this.ctx;
    var sans = '-apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
    var labels = ['吉祥物小智 · 挥手', '吉祥物小智 · 思考', '吉祥物小智 · 欢呼', '吉祥物小智 · 小憩'];
    var quads = [[0, 0], [1, 0], [0, 1], [1, 1]];

    for (var i = 0; i < 4; i++) {
      var zb = this.baseCard(29 + i, '#ffffff', null, 'rgba(23,22,20,0.25)');
      var zu = zb.w / 200;
      var imgBoxX = zb.x + 14 * zu;
      var imgBoxY = zb.y + 12 * zu;
      var imgBoxW = zb.w - 28 * zu;
      var imgBoxH = zb.h - 48 * zu;

      if (this.zhiImg && this.zhiImg.naturalWidth > 0) {
        var hw = this.zhiImg.naturalWidth / 2;
        var hh = this.zhiImg.naturalHeight / 2;
        var side = Math.min(imgBoxW, imgBoxH);
        var dx = imgBoxX + (imgBoxW - side) * 0.5;
        var dy = imgBoxY + (imgBoxH - side) * 0.5;
        ctx.drawImage(this.zhiImg, quads[i][0] * hw, quads[i][1] * hh, hw, hh, dx, dy, side, side);
      } else {
        ctx.fillStyle = '#eef3f8';
        ctx.fillRect(imgBoxX, imgBoxY, imgBoxW, imgBoxH);
      }

      ctx.fillStyle = '#3f3c36';
      ctx.font = '600 ' + Math.round(13 * zu) + 'px ' + sans;
      ctx.fillText(labels[i], zb.x + 14 * zu, zb.y + zb.h - 14 * zu);
    }
  };

  /* 构建 74 张纬圈铺排卡片与 4 组节拍锚点（极区减密，零几何重叠） */
  function buildDeck() {
    var rings = [
      { lat: 60, n: 7, phase: 8 },
      { lat: 36, n: 14, phase: 14 },
      { lat: 12, n: 16, phase: 0 },
      { lat: -12, n: 16, phase: 11.25 },
      { lat: -36, n: 14, phase: 5 },
      { lat: -60, n: 7, phase: 22 }
    ];
    var cards = [];
    for (var r = 0; r < rings.length; r++) {
      var rg = rings[r];
      for (var k = 0; k < rg.n; k++) {
        var lon = rg.phase + (360 / rg.n) * k;
        if (lon > 180) lon -= 360;
        cards.push({
          id: cards.length,
          lat: rg.lat * DEG,
          lon: lon * DEG,
          tile: 4,
          cluster: 0
        });
      }
    }

    var used = {};
    function unitVec(la, lo) {
      return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
    }
    function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

    function pickNearest(latDeg, lonDeg) {
      var n0 = unitVec(latDeg * DEG, lonDeg * DEG);
      var best = -1, bestDot = -9;
      for (var i = 0; i < cards.length; i++) {
        if (used[i]) continue;
        var d = dot3(n0, unitVec(cards[i].lat, cards[i].lon));
        if (d > bestDot) { bestDot = d; best = i; }
      }
      used[best] = true;
      return best;
    }

    function pickNeighbors(centerIdx, count) {
      var n0 = unitVec(cards[centerIdx].lat, cards[centerIdx].lon);
      var arr = [];
      for (var i = 0; i < cards.length; i++) {
        if (!used[i] && i !== centerIdx) {
          arr.push({ idx: i, dot: dot3(n0, unitVec(cards[i].lat, cards[i].lon)) });
        }
      }
      arr.sort(function (a, b) { return b.dot - a.dot; });
      return arr.slice(0, count).map(function (it) { used[it.idx] = true; return it.idx; });
    }

    /* 4 个节拍锚点（沿固定向东旋转轨迹依次把对应簇转到正前方） */
    var targets = [
      { beat: 1, lat: 12, lon: 45, coverTile: 0, neighborTiles: [20, 21, 22, 23, 24] },
      { beat: 2, lat: -12, lon: 135, coverTile: 1, neighborTiles: [4, 5, 13, 14, 10] },
      { beat: 3, lat: 12, lon: -135, coverTile: 2, neighborTiles: [25, 26, 27, 28] },
      { beat: 4, lat: -12, lon: -45, coverTile: 3, neighborTiles: [29, 30, 31, 32] }
    ];

    var anchors = [
      /* 拍 0（首屏）：球面初始朝向西经 32°、北纬 8°，正前方展示丰富卡片与小智 */
      { lat: 8 * DEG, lon: -32 * DEG, cardId: -1 }
    ];

    /* 首屏正面精选卡片排布，确保第一眼层次分明 */
    var heroFront = pickNearest(12, -22);
    cards[heroFront].tile = 29; /* 小智挥手 */
    var heroNbs = pickNeighbors(heroFront, 6);
    var heroPool = [4, 5, 13, 20, 33, 25];
    for (var h = 0; h < heroNbs.length; h++) {
      cards[heroNbs[h]].tile = heroPool[h % heroPool.length];
    }

    for (var t = 0; t < targets.length; t++) {
      var tg = targets[t];
      var leadIdx = pickNearest(tg.lat, tg.lon);
      cards[leadIdx].tile = tg.coverTile;
      cards[leadIdx].cluster = tg.beat;
      var nbs = pickNeighbors(leadIdx, tg.neighborTiles.length);
      for (var m = 0; m < nbs.length; m++) {
        cards[nbs[m]].tile = tg.neighborTiles[m];
        cards[nbs[m]].cluster = tg.beat;
      }
      anchors.push({
        lat: cards[leadIdx].lat,
        lon: cards[leadIdx].lon,
        cardId: leadIdx
      });
    }

    /* 其余球面卡均匀填入 16 篇报道、5 类活动、4 个部门、4 张小智与里程碑卡 */
    var generalPool = [
      4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
      20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34
    ];
    var gp = 0;
    for (var c = 0; c < cards.length; c++) {
      if (!used[c]) {
        cards[c].tile = generalPool[(gp * 7 + 3) % generalPool.length];
        gp++;
      }
    }

    /* 将锚点经度展开为单调递增序列，保证往下滑始终沿同一方向顺畅旋转 */
    for (var a = 1; a < anchors.length; a++) {
      while (anchors[a].lon < anchors[a - 1].lon + 20 * DEG) {
        anchors[a].lon += Math.PI * 2;
      }
    }

    return { cards: cards, anchors: anchors };
  }

  function compileShader(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      var info = gl.getShaderInfoLog(sh);
      gl.deleteShader(sh);
      throw new Error(info || 'Shader compile error');
    }
    return sh;
  }

  function createProgram(gl, vsSrc, fsSrc) {
    var p = gl.createProgram();
    var vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    var fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(p) || 'Program link error');
    }
    return p;
  }

  /* 主舞台类 */
  function SphereStage(canvas, club) {
    var gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
      premultipliedAlpha: false
    }) || canvas.getContext('experimental-webgl', { alpha: true, antialias: true, depth: true });
    if (!gl) throw new Error('WebGL1 unavailable');

    this.canvas = canvas;
    this.gl = gl;
    this.club = club;
    this.vw = 1;
    this.vh = 1;
    this.dpr = 1;
    this.fov = 38 * DEG;
    this.focal = 1 / Math.tan(this.fov * 0.5);
    this.radius = 1.0;
    this.cardW = 0.322;
    this.cardH = 0.382;

    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    var self = this;
    this.atlas = new AtlasBuilder(club, maxTex, function () {
      self.uploadAtlas();
      if (self.onDirty) self.onDirty();
    });
    this.deck = buildDeck();
    this.anchors = this.deck.anchors;

    this.initShaders();
    this.initTexture();
    this.initCardMesh();
    this.initWireMesh();

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  SphereStage.prototype.initShaders = function () {
    var gl = this.gl;

    var cardVS = [
      'attribute vec2 aLocal;',
      'attribute vec2 aUv;',
      'attribute vec2 aLatLon;',
      'attribute float aCardId;',
      'attribute float aCluster;',
      'uniform vec2 uRot;',        /* x: yaw (-lon), y: pitch (+lat) */
      'uniform vec2 uDrag;',       /* x: dragYaw, y: dragPitch */
      'uniform float uCamDist;',
      'uniform vec2 uProj;',       /* x: focal/aspect, y: focal */
      'uniform vec2 uOffset;',     /* NDC 主点偏移 */
      'uniform vec2 uCardSize;',
      'uniform float uActiveCard;',
      'uniform float uActiveBeat;',
      'uniform float uClusterPop;',
      'uniform float uFly;',       /* 0..1 脱离飞出进度 */
      'uniform float uFlyZ;',      /* 主卡前飞世界距离 */
      'uniform vec2 uHover;',      /* 指针球面局部坐标 */
      'uniform float uHoverOn;',   /* 指针悬停强度 */
      'uniform float uPass;',      /* 0: 球体众卡, 1: 正在脱离飞出的主卡 */
      'varying vec2 vUv;',
      'varying vec2 vLocal;',
      'varying vec3 vNormal;',
      'varying vec3 vPos;',
      'varying float vIsLead;',
      'vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x*c + p.z*s, p.y, -p.x*s + p.z*c); }',
      'vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y*c - p.z*s, p.y*s + p.z*c); }',
      'void main() {',
      '  float isLead = step(abs(aCardId - uActiveCard), 0.25);',
      '  if (uPass < 0.5 && uFly > 0.002 && isLead > 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
      '  if (uPass > 0.5 && isLead < 0.5) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }',
      '  float lat = aLatLon.x, lon = aLatLon.y;',
      '  vec3 N = vec3(cos(lat)*sin(lon), sin(lat), cos(lat)*cos(lon));',
      '  vec3 T = vec3(cos(lon), 0.0, -sin(lon));',
      '  vec3 B = vec3(-sin(lat)*sin(lon), cos(lat), -sin(lat)*cos(lon));',
      '  float isClust = step(abs(aCluster - uActiveBeat), 0.25) * (1.0 - isLead);',
      '  float rLayer = fract(aCardId * 0.618034) * 0.007 * (1.0 - isLead);',
      '  float rBase = 1.0 + rLayer + isClust * 0.055 * uClusterPop;',
      '  vec3 flatP = N * rBase + T * (aLocal.x * uCardSize.x) + B * (aLocal.y * uCardSize.y);',
      '  vec3 curvedP = normalize(flatP) * rBase;',
      '  float bend = 1.0;',
      '  if (uPass > 0.5) {',
      '    bend = 1.0 - clamp(uFly * 2.1, 0.0, 1.0);',
      '  }',
      '  vec3 p = mix(flatP, curvedP, bend);',
      '  vec3 nrm = mix(N, normalize(curvedP), bend);',
      '  p = rotX(rotY(p, uRot.x), uRot.y);',
      '  nrm = rotX(rotY(nrm, uRot.x), uRot.y);',
      '  if (uPass < 0.5 && isClust > 0.5 && uFly > 0.001) {',
      '    vec2 pushDir = length(p.xy) > 0.001 ? normalize(p.xy) : vec2(0.0, 1.0);',
      '    p.xy += pushDir * (0.048 * sin(min(uFly * 1.4, 1.0) * 1.5708));',
      '  }',
      '  p = rotX(rotY(p, uDrag.x), uDrag.y);',
      '  nrm = rotX(rotY(nrm, uDrag.x), uDrag.y);',
      '  if (uPass < 0.5 && uHoverOn > 0.01 && p.z > 0.12) {',
      '    float hd = length(p.xy - uHover);',
      '    float hLift = exp(-hd * hd * 9.5) * 0.052 * uHoverOn * smoothstep(0.12, 0.62, p.z);',
      '    p += normalize(p) * hLift;',
      '  }',
      '  if (uPass > 0.5) {',
      '    float arch = sin(clamp(uFly * 1.5, 0.0, 1.0) * 3.14159);',
      '    float curl = arch * 0.028 * cos(aLocal.x * 3.14159);',
      '    vec3 pc = vec3(p.x, p.y, p.z - rBase);',
      '    pc = rotX(pc, -0.14 * arch);',
      '    p = vec3(pc.x, pc.y, pc.z + rBase);',
      '    nrm = rotX(nrm, -0.14 * arch);',
      '    p.z += uFly * uFlyZ + curl;',
      '    p.xy *= (1.0 + uFly * 0.24);',
      '  }',
      '  vec3 camP = vec3(p.x, p.y, p.z - uCamDist);',
      '  float zp = max(0.38, -camP.z);',
      '  vec4 clip = vec4(camP.x * uProj.x, camP.y * uProj.y, 1.0339 * zp - 0.8136, zp);',
      '  clip.xy += uOffset * clip.w;',
      '  gl_Position = clip;',
      '  vUv = aUv;',
      '  vLocal = aLocal + 0.5;',
      '  vNormal = nrm;',
      '  vPos = p;',
      '  vIsLead = uPass;',
      '}'
    ].join('\n');

    var cardFS = [
      'precision mediump float;',
      'uniform sampler2D uTex;',
      'uniform vec4 uBackUv;',
      'uniform float uAlpha;',
      'uniform float uDim;',
      'uniform float uShadow;',
      'varying vec2 vUv;',
      'varying vec2 vLocal;',
      'varying vec3 vNormal;',
      'varying vec3 vPos;',
      'varying float vIsLead;',
      'void main() {',
      '  vec2 q = abs(vLocal - 0.5) - vec2(0.454, 0.461);',
      '  float sd = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.046;',
      '  if (sd > 0.0) discard;',
      '  vec3 n = normalize(vNormal);',
      '  vec4 col;',
      '  if (!gl_FrontFacing) {',
      '    n = -n;',
      '    vec2 buv = mix(uBackUv.xy, uBackUv.zw, vec2(1.0 - vLocal.x, 1.0 - vLocal.y));',
      '    col = texture2D(uTex, buv);',
      '    col.rgb *= 0.85;',
      '  } else {',
      '    col = texture2D(uTex, vUv);',
      '  }',
      '  vec3 lightDir = normalize(vec3(-0.36, 0.58, 0.73));',
      '  float diff = max(dot(n, lightDir), 0.0);',
      '  float hemi = 0.76 + 0.26 * diff;',
      '  float depthShade = smoothstep(-1.05, 0.85, vPos.z);',
      '  float rim = mix(1.0, 0.76, smoothstep(-0.016, -0.002, sd));',
      '  float shade = hemi * mix(0.62, 1.03, depthShade) * rim;',
      '  if (vIsLead < 0.5 && uShadow > 0.001 && vPos.z > 0.2) {',
      '    float r2 = dot(vPos.xy, vPos.xy);',
      '    float sh = exp(-r2 * 7.5) * uShadow * 0.34;',
      '    shade *= (1.0 - sh);',
      '  }',
      '  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
      '  vec3 rgb = col.rgb * shade + (grain - 0.5) * 0.018;',
      '  if (vIsLead < 0.5) {',
      '    rgb = mix(rgb, vec3(0.91, 0.895, 0.86), uDim * 0.42);',
      '  }',
      '  gl_FragColor = vec4(rgb, col.a * uAlpha);',
      '}'
    ].join('\n');

    var wireVS = [
      'attribute vec3 aPos;',
      'uniform vec2 uRot;',
      'uniform vec2 uDrag;',
      'uniform float uCamDist;',
      'uniform vec2 uProj;',
      'uniform vec2 uOffset;',
      'varying float vZ;',
      'vec3 rotY(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x*c + p.z*s, p.y, -p.x*s + p.z*c); }',
      'vec3 rotX(vec3 p, float a) { float c = cos(a), s = sin(a); return vec3(p.x, p.y*c - p.z*s, p.y*s + p.z*c); }',
      'void main() {',
      '  vec3 p = rotX(rotY(aPos, uRot.x), uRot.y);',
      '  p = rotX(rotY(p, uDrag.x), uDrag.y);',
      '  vec3 camP = vec3(p.x, p.y, p.z - uCamDist);',
      '  float zp = max(0.38, -camP.z);',
      '  vec4 clip = vec4(camP.x * uProj.x, camP.y * uProj.y, 1.0339 * zp - 0.8136, zp);',
      '  clip.xy += uOffset * clip.w;',
      '  gl_Position = clip;',
      '  vZ = p.z;',
      '}'
    ].join('\n');

    var wireFS = [
      'precision mediump float;',
      'uniform float uWireAlpha;',
      'varying float vZ;',
      'void main() {',
      '  float a = smoothstep(-0.8, 0.9, vZ) * uWireAlpha;',
      '  gl_FragColor = vec4(0.16, 0.15, 0.13, a);',
      '}'
    ].join('\n');

    this.cardProg = createProgram(gl, cardVS, cardFS);
    this.wireProg = createProgram(gl, wireVS, wireFS);

    function mapLocs(prog, attrs, unifs) {
      var out = {};
      attrs.forEach(function (k) { out[k] = gl.getAttribLocation(prog, k); });
      unifs.forEach(function (k) { out[k] = gl.getUniformLocation(prog, k); });
      return out;
    }
    this.cLoc = mapLocs(
      this.cardProg,
      ['aLocal', 'aUv', 'aLatLon', 'aCardId', 'aCluster'],
      ['uRot', 'uDrag', 'uCamDist', 'uProj', 'uOffset', 'uCardSize', 'uActiveCard', 'uActiveBeat',
       'uClusterPop', 'uFly', 'uFlyZ', 'uHover', 'uHoverOn', 'uPass', 'uTex', 'uBackUv', 'uAlpha', 'uDim', 'uShadow']
    );
    this.wLoc = mapLocs(this.wireProg, ['aPos'], ['uRot', 'uDrag', 'uCamDist', 'uProj', 'uOffset', 'uWireAlpha']);
  };

  SphereStage.prototype.initTexture = function () {
    var gl = this.gl;
    this.tex = gl.createTexture();
    this.uploadAtlas();
  };

  SphereStage.prototype.uploadAtlas = function () {
    var gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.atlas.cv);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    var s = this.atlas.size;
    var isPot = (s & (s - 1)) === 0;
    if (isPot) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  };

  SphereStage.prototype.initCardMesh = function () {
    var gl = this.gl;
    var cards = this.deck.cards;
    var seg = 4; /* 每张卡片 5×5 顶点网格，平滑贴合球面并支持摊平 */
    var vPerCard = (seg + 1) * (seg + 1);
    var iPerCard = seg * seg * 6;
    var verts = new Float32Array(cards.length * vPerCard * 8);
    var indices = new Uint16Array(cards.length * iPerCard);

    var vo = 0, io = 0;
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var uv = this.atlas.uvRect(card.tile);
      var baseVertex = c * vPerCard;

      for (var iy = 0; iy <= seg; iy++) {
        var ty = iy / seg;
        var ly = 0.5 - ty; /* ty=0 -> 卡片上沿(+0.5), 对应图集顶端 uv[1] */
        var vy = uv[1] + (uv[3] - uv[1]) * ty;
        for (var ix = 0; ix <= seg; ix++) {
          var tx = ix / seg;
          var lx = tx - 0.5;
          var vx = uv[0] + (uv[2] - uv[0]) * tx;

          verts[vo++] = lx;
          verts[vo++] = ly;
          verts[vo++] = vx;
          verts[vo++] = vy;
          verts[vo++] = card.lat;
          verts[vo++] = card.lon;
          verts[vo++] = card.id;
          verts[vo++] = card.cluster;
        }
      }

      for (var ry = 0; ry < seg; ry++) {
        for (var rx = 0; rx < seg; rx++) {
          var a = baseVertex + ry * (seg + 1) + rx;
          var b = a + 1;
          var d = a + (seg + 1);
          var e = d + 1;
          /* 逆时针正面：(a: 左上, d: 左下, b: 右上), (b: 右上, d: 左下, e: 右下) */
          indices[io++] = a;
          indices[io++] = d;
          indices[io++] = b;
          indices[io++] = b;
          indices[io++] = d;
          indices[io++] = e;
        }
      }
    }

    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);

    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
    this.indexCount = indices.length;
  };

  SphereStage.prototype.initWireMesh = function () {
    var gl = this.gl;
    var pts = [];
    var R = 0.968;
    var lats = [-48, -24, 0, 24, 48];
    var segs = 64;
    for (var i = 0; i < lats.length; i++) {
      var la = lats[i] * DEG;
      var cl = Math.cos(la), sl = Math.sin(la);
      for (var s = 0; s < segs; s++) {
        var a0 = (s / segs) * Math.PI * 2;
        var a1 = ((s + 1) / segs) * Math.PI * 2;
        pts.push(R * cl * Math.sin(a0), R * sl, R * cl * Math.cos(a0));
        pts.push(R * cl * Math.sin(a1), R * sl, R * cl * Math.cos(a1));
      }
    }
    for (var m = 0; m < 6; m++) {
      var lo = (m / 6) * Math.PI;
      for (var t = 0; t < segs; t++) {
        var b0 = (t / segs) * Math.PI * 2;
        var b1 = ((t + 1) / segs) * Math.PI * 2;
        pts.push(R * Math.cos(b0) * Math.sin(lo), R * Math.sin(b0), R * Math.cos(b0) * Math.cos(lo));
        pts.push(R * Math.cos(b1) * Math.sin(lo), R * Math.sin(b1), R * Math.cos(b1) * Math.cos(lo));
      }
    }
    this.wireVbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wireVbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(pts), gl.STATIC_DRAW);
    this.wireCount = pts.length / 3;
  };

  SphereStage.prototype.resize = function (vw, vh) {
    this.vw = Math.max(1, vw);
    this.vh = Math.max(1, vh);
    var maxDpr = vw <= 768 ? 1.0 : 1.5;
    this.dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    var w = Math.round(this.vw * this.dpr);
    var h = Math.round(this.vh * this.dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.gl.viewport(0, 0, w, h);
  };

  /* 根据视口宽高比自适应计算相机距离，确保窄屏与宽屏均完整无裁切、不压文字 */
  SphereStage.prototype.computeCamDist = function (maxNdcX, maxNdcY) {
    var aspect = this.vw / this.vh;
    var px = this.focal / aspect;
    var py = this.focal;
    var rBound = 1.06;
    var reqZ = rBound * Math.max(px / maxNdcX, py / maxNdcY);
    return Math.sqrt(reqZ * reqZ + rBound * rBound);
  };

  /* 计算正在脱离球面的主卡在屏幕上的精确像素矩形，用于与 HTML 纸卡无缝衔接 */
  SphereStage.prototype.getLeadScreenRect = function (state) {
    var aspect = this.vw / this.vh;
    var px = this.focal / aspect;
    var py = this.focal;
    var fly = clamp(state.fly || 0, 0, 1);
    var flyZ = (state.camDist - 1.0) * 0.42;
    var zWorld = 1.0 + fly * flyZ;
    var scaleMul = 1.0 + fly * 0.24;
    var depth = Math.max(0.45, state.camDist - zWorld);

    var halfW_ndc = (this.cardW * 0.5 * scaleMul * px) / depth;
    var halfH_ndc = (this.cardH * 0.5 * scaleMul * py) / depth;

    var cx = (state.offsetX * 0.5 + 0.5) * this.vw;
    var cy = (0.5 - state.offsetY * 0.5) * this.vh;
    return {
      cx: cx,
      cy: cy,
      w: halfW_ndc * this.vw,
      h: halfH_ndc * this.vh
    };
  };

  SphereStage.prototype.render = function (state) {
    var gl = this.gl;
    var aspect = this.vw / this.vh;
    var px = this.focal / aspect;
    var py = this.focal;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    var yaw = -state.lon;
    var pitch = state.lat;

    /* 1. 内部经纬刻度细线球架 */
    gl.useProgram(this.wireProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.wireVbo);
    gl.enableVertexAttribArray(this.wLoc.aPos);
    gl.vertexAttribPointer(this.wLoc.aPos, 3, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.wLoc.uRot, yaw, pitch);
    gl.uniform2f(this.wLoc.uDrag, state.dragYaw || 0, state.dragPitch || 0);
    gl.uniform1f(this.wLoc.uCamDist, state.camDist);
    gl.uniform2f(this.wLoc.uProj, px, py);
    gl.uniform2f(this.wLoc.uOffset, state.offsetX || 0, state.offsetY || 0);
    gl.uniform1f(this.wLoc.uWireAlpha, 0.11 * (1 - (state.dim || 0) * 0.45));
    gl.drawArrays(gl.LINES, 0, this.wireCount);

    /* 2. 球面纸卡群 */
    var L = this.cLoc;
    var stride = 32;
    gl.useProgram(this.cardProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    var attrs = [[L.aLocal, 2, 0], [L.aUv, 2, 8], [L.aLatLon, 2, 16], [L.aCardId, 1, 24], [L.aCluster, 1, 28]];
    for (var ai = 0; ai < attrs.length; ai++) {
      gl.enableVertexAttribArray(attrs[ai][0]);
      gl.vertexAttribPointer(attrs[ai][0], attrs[ai][1], gl.FLOAT, false, stride, attrs[ai][2]);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.uniform1i(L.uTex, 0);

    var backUv = this.atlas.uvRect(35);
    gl.uniform4f(L.uBackUv, backUv[0], backUv[1], backUv[2], backUv[3]);
    gl.uniform2f(L.uRot, yaw, pitch);
    gl.uniform2f(L.uDrag, state.dragYaw || 0, state.dragPitch || 0);
    gl.uniform1f(L.uCamDist, state.camDist);
    gl.uniform2f(L.uProj, px, py);
    gl.uniform2f(L.uOffset, state.offsetX || 0, state.offsetY || 0);
    gl.uniform2f(L.uCardSize, this.cardW, this.cardH);
    gl.uniform1f(L.uActiveCard, state.activeCard != null ? state.activeCard : -1);
    gl.uniform1f(L.uActiveBeat, state.activeBeat || 0);
    gl.uniform1f(L.uClusterPop, state.clusterPop || 0);
    gl.uniform1f(L.uFly, state.fly || 0);
    gl.uniform1f(L.uFlyZ, (state.camDist - 1.0) * 0.42);
    gl.uniform2f(L.uHover, state.hoverX || 0, state.hoverY || 0);
    gl.uniform1f(L.uHoverOn, state.hoverOn || 0);
    gl.uniform1f(L.uDim, state.dim || 0);
    gl.uniform1f(L.uShadow, state.shadow || 0);

    /* Pass 0：绘制球面所有卡片 */
    gl.uniform1f(L.uPass, 0);
    gl.uniform1f(L.uAlpha, 1.0);
    gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);

    /* Pass 1：绘制正在脱离球面飞向读者（或飞回球面）的主卡 */
    var leadAlpha = state.leadAlpha != null ? state.leadAlpha : 1.0;
    if ((state.fly || 0) > 0.002 && leadAlpha > 0.005 && state.activeCard >= 0) {
      gl.uniform1f(L.uPass, 1);
      gl.uniform1f(L.uAlpha, leadAlpha);
      gl.drawElements(gl.TRIANGLES, this.indexCount, gl.UNSIGNED_SHORT, 0);
    }
  };

  window.SphereStage = SphereStage;
})();
