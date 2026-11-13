window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var W = CFG.W;
  var H = CFG.H;
  var S = 3; // 超采样：逻辑坐标 1 单位 = 3 设备像素（角色光影更细腻）

  // 水墨调色板：焦/浓/重/淡/清 墨 + 宣纸 + 朱砂点缀
  var P = {
    ink: '#2a2826',       // 焦墨（最深）
    ink2: '#3d3a36',      // 浓墨
    ink3: '#5a5550',      // 重墨
    ink4: '#7a7570',      // 淡墨
    ink5: '#a8a29a',      // 清墨
    ink6: '#c8c2b8',      // 极淡墨
    paper: '#f4efe6',     // 宣纸底
    paperD: '#e8e2d4',    // 宣纸暗
    paperL: '#faf7f0',    // 宣纸亮
    cinnabar: '#a84038',  // 朱砂印
    cinnabarL: '#c8605a',
    ochre: '#b89060',     // 赭石
    ochreL: '#d8b080',
    moss: '#6a8a6a',      // 淡青绿
    mossL: '#9ab090',
    leaf: '#8aa888',
    mist: '#d8d2c8',
    warm: '#d8c8a8',
    cool: '#a8b0b8',
    gold: '#c8a850',
    stone: '#e0dcd2',
    stoneL: '#ece8de',
    stoneD: '#c0bcb0'
  };

  // 仙侠风角色配色：青蓝道袍 + 深蓝滚边 + 玉饰
  var CHAR = {
    robe: '#6d8fa0',
    robeD: '#43606d',
    robeL: '#a8c3c9',
    inner: '#f2ece0',     // 中衣
    skin: '#f4e6d4',
    skinD: '#e2cdb4',
    hair: '#242424',
    hairL: '#3a3a3a',
    belt: '#3c5a6a',
    beltL: '#5a7f8f',
    jade: '#6fae9b',
    gold: '#c8a850',
    shoe: '#3a4650',
    cheek: '#e8b4a8',
    eye: '#242424'
  };

  function cv(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  // 以逻辑坐标绘制，内部按 S 倍超采样
  function lcv(w, h) {
    var c = cv(w * S, h * S);
    var g = c.getContext('2d');
    g.scale(S, S);
    g.lineJoin = 'round';
    g.lineCap = 'round';
    return { c: c, g: g };
  }

  function px(g, x, y, w, h, c) {
    g.fillStyle = c;
    g.fillRect(x, y, w, h);
  }

  function rr(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  function fillRR(g, x, y, w, h, r, c) {
    g.fillStyle = c;
    rr(g, x, y, w, h, r);
    g.fill();
  }

  function circle(g, cx, cy, r, color) {
    g.fillStyle = color;
    g.beginPath();
    g.arc(cx, cy, r, 0, Math.PI * 2);
    g.fill();
  }

  function ellipse(g, cx, cy, rx, ry, color) {
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  }

  function blob(g, cx, cy, rx, ry, color) {
    ellipse(g, cx, cy, rx, ry, color);
  }

  function rng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hex2rgb(h) {
    h = h.replace('#', '');
    return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
  }

  function lerpColor(a, b, t) {
    var c1 = hex2rgb(a), c2 = hex2rgb(b);
    return 'rgb(' + Math.round(c1[0] + (c2[0] - c1[0]) * t) + ',' +
      Math.round(c1[1] + (c2[1] - c1[1]) * t) + ',' +
      Math.round(c1[2] + (c2[2] - c1[2]) * t) + ')';
  }

  // 不规则墨团：用多圆叠加 + 噪声边缘，模拟泼墨渗化
  function inkBlob(g, cx, cy, rx, ry, color, seed) {
    var r = rng(seed || 99);
    g.save();
    g.translate(cx, cy);
    // 外层淡墨晕染
    g.globalAlpha = 0.12;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(0, 0, rx * 1.4, ry * 1.5, 0, 0, Math.PI * 2);
    g.fill();
    // 中层不规则
    g.globalAlpha = 0.35;
    g.beginPath();
    var pts = 14;
    for (var i = 0; i <= pts; i++) {
      var a = (i / pts) * Math.PI * 2;
      var jitter = 0.75 + r() * 0.5;
      var px = Math.cos(a) * rx * jitter;
      var py = Math.sin(a) * ry * jitter;
      if (i === 0) g.moveTo(px, py);
      else g.quadraticCurveTo(
        Math.cos(a - 0.1) * rx * (0.8 + r() * 0.4),
        Math.sin(a - 0.1) * ry * (0.8 + r() * 0.4),
        px, py
      );
    }
    g.closePath();
    g.fill();
    // 内层浓墨核心
    g.globalAlpha = 0.7;
    g.beginPath();
    g.ellipse(-rx * 0.1, -ry * 0.1, rx * 0.6, ry * 0.6, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  // 毛笔笔触：带毛边的线条
  function brushStroke(g, x1, y1, x2, y2, width, color, seed) {
    var r = rng(seed || 7);
    var segs = Math.max(4, Math.floor(Math.hypot(x2 - x1, y2 - y1) / 4));
    g.strokeStyle = color;
    g.lineCap = 'round';
    for (var pass = 0; pass < 3; pass++) {
      g.globalAlpha = pass === 0 ? 0.15 : (pass === 1 ? 0.5 : 0.85);
      g.lineWidth = width * (pass === 0 ? 2.2 : (pass === 1 ? 1.2 : 0.7));
      g.beginPath();
      g.moveTo(x1, y1);
      for (var i = 1; i <= segs; i++) {
        var t = i / segs;
        var px = x1 + (x2 - x1) * t + (r() - 0.5) * width * 0.6;
        var py = y1 + (y2 - y1) * t + (r() - 0.5) * width * 0.6;
        g.lineTo(px, py);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  // 宣纸纹理噪点
  function paperNoise(g, w, h, alpha) {
    var r = rng(20261113);
    g.globalAlpha = alpha || 0.06;
    for (var i = 0; i < w * h * 0.012; i++) {
      var x = r() * w, y = r() * h;
      g.fillStyle = r() > 0.5 ? P.ink : P.paperD;
      g.fillRect(x, y, 1, 1);
    }
    g.globalAlpha = 1;
  }

  /* ---------------- sky ---------------- */
  function makeRidge(seed, baseY, amp, step) {
    var r = rng(seed);
    var pts = [];
    for (var x = -40; x <= W + 40; x += step) {
      pts.push({ x: x, y: baseY - r() * amp });
    }
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 1; i < pts.length - 1; i++) {
        pts[i].y = (pts[i - 1].y + pts[i].y * 2 + pts[i + 1].y) / 4;
      }
    }
    return pts;
  }

  var RIDGE_FAR = makeRidge(1337, 158, 68, 30);
  var RIDGE_NEAR = makeRidge(4242, 178, 34, 20);
  var skyCache = {};

  function smoothRidge(g, pts, baseY, color, density) {
    // 远山淡墨，近山浓墨 —— 水墨层次
    g.save();
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(-40, baseY);
    g.lineTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length - 1; i++) {
      var mx = (pts[i].x + pts[i + 1].x) / 2;
      var my = (pts[i].y + pts[i + 1].y) / 2;
      g.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
    }
    var last = pts[pts.length - 1];
    g.lineTo(last.x, last.y);
    g.lineTo(W + 40, baseY);
    g.closePath();
    g.fill();

    // 山脊墨线（焦墨勾线）
    if (density > 0.4) {
      g.strokeStyle = P.ink2;
      g.lineWidth = 0.8;
      g.globalAlpha = 0.35;
      g.beginPath();
      g.moveTo(pts[0].x, pts[0].y);
      for (var j = 1; j < pts.length - 1; j++) {
        var mxx = (pts[j].x + pts[j + 1].x) / 2;
        var myy = (pts[j].y + pts[j + 1].y) / 2;
        g.quadraticCurveTo(pts[j].x, pts[j].y, mxx, myy);
      }
      g.stroke();
      g.globalAlpha = 1;
    }

    // 山体墨点皴法（近山才有）
    if (density > 0.5) {
      var r = rng(density > 0.7 ? 88 : 66);
      g.globalAlpha = 0.12;
      g.fillStyle = P.ink3;
      for (var k = 0; k < 40; k++) {
        var rx = r() * W;
        var ry = baseY - r() * 40;
        if (ry > baseY - 8) continue;
        g.beginPath();
        g.ellipse(rx, ry, 1.2 + r() * 2, 0.5 + r() * 1.2, r() * 3, 0, Math.PI * 2);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    g.restore();
    shadeRidge(g, baseY, density);
  }

  // 云影（让山体更立体）—— 水墨浓淡
  function shadeRidge(g, baseY, density) {
    var sg = g.createLinearGradient(0, baseY - 78, 0, baseY);
    var a = (density || 0.5) * 0.16;
    sg.addColorStop(0, 'rgba(42,40,38,0)');
    sg.addColorStop(1, 'rgba(42,40,38,' + a + ')');
    g.fillStyle = sg;
    g.fill();
  }

  function bakeSky(key) {
    if (skyCache[key]) return skyCache[key];
    var sky = CFG.SKY[key];
    var L = lcv(W, 176);
    var g = L.g;
    var i, x;

    var grad = g.createLinearGradient(0, 0, 0, 176);
    grad.addColorStop(0, sky.top);
    grad.addColorStop(0.52, sky.mid);
    grad.addColorStop(1, sky.low);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, 176);

    if (sky.stars) {
      var rs = rng(2026);
      for (i = 0; i < 72; i++) {
        g.globalAlpha = 0.3 + rs() * 0.7;
        circle(g, rs() * W, rs() * 118, rs() > 0.86 ? 1.3 : 0.7, '#ffffff');
      }
      g.globalAlpha = 1;
    }

    if (key === 'aurora') {
      var bands = [
        { y: 34, amp: 11, col: '#8ef5dc', a: 0.3 },
        { y: 54, amp: 15, col: '#b9a8ff', a: 0.22 },
        { y: 74, amp: 9, col: '#7fe0b8', a: 0.18 }
      ];
      for (var b = 0; b < bands.length; b++) {
        var bd = bands[b];
        g.globalAlpha = bd.a;
        g.fillStyle = bd.col;
        g.beginPath();
        g.moveTo(0, bd.y + 16);
        for (x = 0; x <= W; x += 12) {
          g.lineTo(x, bd.y + Math.sin(x * 0.018 + b * 1.6) * bd.amp);
        }
        g.lineTo(W, bd.y + 30);
        for (x = W; x >= 0; x -= 12) {
          g.lineTo(x, bd.y + 24 + Math.sin(x * 0.02 + b * 1.1) * bd.amp * 0.6);
        }
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    }

    var cx = sky.cx, cy = sky.cy;
    g.globalAlpha = 0.13; circle(g, cx, cy, 34, sky.sun);
    g.globalAlpha = 0.24; circle(g, cx, cy, 22, sky.sun);
    g.globalAlpha = 1; circle(g, cx, cy, 13, sky.sun);
    if (sky.celestial === 'moon') {
      // 月晕
      g.globalAlpha = 0.1; circle(g, cx, cy, 28, sky.sun);
      g.globalAlpha = 0.16; circle(g, cx, cy, 20, sky.sun);
      g.globalAlpha = 1;
      // 满月与月海
      circle(g, cx, cy, 11.5, sky.sun);
      g.globalAlpha = 0.18;
      circle(g, cx - 4, cy - 3, 3.2, '#b9b28c');
      circle(g, cx + 3.5, cy + 2, 2.6, '#b9b28c');
      circle(g, cx - 1, cy + 5, 1.8, '#b9b28c');
      g.globalAlpha = 1;
      circle(g, cx - 3, cy - 5, 1.2, 'rgba(255,255,255,0.7)');
    } else if (sky.rays) {
      // 日出／日落的光束
      g.globalAlpha = 0.055;
      g.fillStyle = sky.sun;
      for (var ry = -1; ry <= 1; ry++) {
        g.beginPath();
        g.moveTo(cx, cy);
        g.lineTo(cx + 210, cy + 70 + ry * 46);
        g.lineTo(cx + 230, cy + 96 + ry * 50);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
    }

    smoothRidge(g, RIDGE_FAR, 176, sky.far, 0.35);
    g.globalAlpha = 0.18;
    g.fillStyle = P.paperL;
    g.fillRect(0, 130, W, 8);
    g.globalAlpha = 1;

    smoothRidge(g, RIDGE_NEAR, 176, sky.near, 0.75);

    // 远山雾带（水墨晕染）
    g.globalAlpha = 0.16;
    g.fillStyle = P.paperL;
    g.fillRect(0, 152, W, 7);
    g.globalAlpha = 1;

    // 飞鸟（焦墨一笔）
    g.strokeStyle = P.ink3;
    g.lineWidth = 1;
    g.globalAlpha = 0.5;
    var birds = [[96, 34, 5], [112, 28, 4], [128, 37, 3.4]];
    for (i = 0; i < birds.length; i++) {
      var bx = birds[i][0], by = birds[i][1], bw = birds[i][2];
      g.beginPath();
      g.moveTo(bx - bw, by);
      g.quadraticCurveTo(bx - bw * 0.4, by - bw * 0.7, bx, by);
      g.quadraticCurveTo(bx + bw * 0.4, by - bw * 0.7, bx + bw, by);
      g.stroke();
    }
    g.globalAlpha = 1;

    // 宣纸纹理
    paperNoise(g, W, 176, 0.04);

    skyCache[key] = L.c;
    return L.c;
  }

  /* ---------------- 道院 ---------------- */
  function tree(g, bx, by, s) {
    // 水墨树：淡墨树干 + 浓墨枯枝 + 墨团叶
    g.globalAlpha = 0.12;
    ellipse(g, bx, by, 30 * s, 5 * s, P.ink3);
    g.globalAlpha = 1;

    // 树干（赭石淡墨）
    brushStroke(g, bx, by, bx - 2 * s, by - 36 * s, 3.2 * s, P.ochre, 11);
    // 枯枝（焦墨）
    g.strokeStyle = P.ink;
    g.lineWidth = 0.9;
    g.lineCap = 'round';
    var branches = [
      [bx, by - 20 * s, bx - 14 * s, by - 34 * s],
      [bx, by - 22 * s, bx + 12 * s, by - 36 * s],
      [bx, by - 28 * s, bx - 8 * s, by - 44 * s],
      [bx, by - 26 * s, bx + 10 * s, by - 42 * s],
      [bx - 6 * s, by - 32 * s, bx - 16 * s, by - 40 * s],
      [bx + 8 * s, by - 34 * s, bx + 18 * s, by - 40 * s]
    ];
    for (var bi = 0; bi < branches.length; bi++) {
      g.globalAlpha = 0.6;
      g.beginPath();
      g.moveTo(branches[bi][0], branches[bi][1]);
      g.lineTo(branches[bi][2], branches[bi][3]);
      g.stroke();
    }
    g.globalAlpha = 1;

    // 墨团叶（浓淡三层）
    inkBlob(g, bx, by - 48 * s, 18 * s, 14 * s, P.moss, 201);
    inkBlob(g, bx - 12 * s, by - 40 * s, 11 * s, 9 * s, P.mossL, 202);
    inkBlob(g, bx + 14 * s, by - 42 * s, 12 * s, 9 * s, P.mossL, 203);
    inkBlob(g, bx - 4 * s, by - 56 * s, 10 * s, 8 * s, P.leaf, 204);

    // 零星朱红点（落花/果实）
    var dots = [[-10, -50], [4, -60], [12, -46], [-14, -38], [2, -42]];
    for (var i = 0; i < dots.length; i++) {
      g.globalAlpha = 0.7;
      circle(g, bx + dots[i][0] * s, by + dots[i][1] * s, 1.5 * s, P.cinnabar);
    }
    g.globalAlpha = 1;
  }

  function roof(g, cx, yTop, wTop, wBot, h) {
    var ht = wTop / 2, hb = wBot / 2;
    // 黛瓦（浓墨）
    g.fillStyle = P.ink2;
    g.beginPath();
    g.moveTo(cx - ht, yTop);
    g.lineTo(cx - hb + 5, yTop + h * 0.6);
    g.quadraticCurveTo(cx - hb - 3, yTop + h * 0.76, cx - hb - 10, yTop + h * 0.8);
    g.quadraticCurveTo(cx - hb + 16, yTop + h, cx - hb + 34, yTop + h);
    g.lineTo(cx + hb - 34, yTop + h);
    g.quadraticCurveTo(cx + hb - 16, yTop + h, cx + hb + 10, yTop + h * 0.8);
    g.quadraticCurveTo(cx + hb + 3, yTop + h * 0.76, cx + hb - 5, yTop + h * 0.6);
    g.lineTo(cx + ht, yTop);
    g.closePath();
    g.fill();

    // 檐下淡墨
    g.globalAlpha = 0.45;
    fillRR(g, cx - hb + 32, yTop + h - 3.6, hb * 2 - 64, 3.2, 1.4, P.ink);
    g.globalAlpha = 1;

    // 正脊（朱砂）
    g.strokeStyle = P.cinnabar;
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(cx - ht + 3, yTop - 1);
    g.lineTo(cx + ht - 3, yTop - 1);
    g.stroke();

    // 翘角（朱砂点缀）
    circle(g, cx - hb - 10, yTop + h * 0.8, 2.2, P.cinnabar);
    circle(g, cx + hb + 10, yTop + h * 0.8, 2.2, P.cinnabar);
    circle(g, cx, yTop - 3.6, 2.4, P.cinnabar);
  }

  function hall(g) {
    var i, x;
    // 参考图：黄墙 + 黑瓦 + 深木色檐柱
    var ochre = '#d9b97c', ochreD = '#c5a468', wood = '#4a4034', woodL = '#6a5c48';

    // 台阶（宣纸石）
    for (i = 0; i < 4; i++) {
      var w = 104 + i * 12;
      fillRR(g, 240 - w / 2, 188 + i * 4, w, 6, 2.5, i % 2 ? P.stone : P.stoneL);
    }
    // 台基
    fillRR(g, 124, 164, 232, 26, 4, P.paper);
    fillRR(g, 124, 161, 232, 5, 2.5, P.paperL);
    g.globalAlpha = 0.4;
    fillRR(g, 124, 186, 232, 4, 2, P.stoneD);
    g.globalAlpha = 1;

    // 下层殿身（黄墙）
    fillRR(g, 152, 124, 176, 46, 3, ochre);
    var bays = [[160, 186], [192, 218], [224, 250], [256, 282], [288, 314]];
    for (i = 0; i < bays.length; i++) {
      var b = bays[i];
      fillRR(g, b[0], 130, b[1] - b[0], 36, 2, ochreD);
      g.strokeStyle = 'rgba(120,92,52,0.4)';
      g.lineWidth = 0.7;
      for (x = b[0] + 5; x < b[1] - 2; x += 6) {
        g.beginPath(); g.moveTo(x, 131); g.lineTo(x, 165); g.stroke();
      }
      g.beginPath(); g.moveTo(b[0] + 2, 147); g.lineTo(b[1] - 2, 147); g.stroke();
    }
    // 深木色檐柱
    [154, 188, 222, 256, 290, 318].forEach(function (px0) {
      fillRR(g, px0, 124, 5.5, 46, 2, wood);
      g.globalAlpha = 0.3;
      fillRR(g, px0 + 3.6, 124, 1.6, 46, 0.8, '#b8a888');
      g.globalAlpha = 1;
      fillRR(g, px0, 124, 5.5, 2.4, 1, woodL);
    });

    // 上层殿身
    fillRR(g, 182, 72, 116, 52, 3, ochre);
    [184, 206, 228, 250, 272, 292].forEach(function (px0) {
      fillRR(g, px0, 72, 4.5, 52, 2, wood);
      g.globalAlpha = 0.3;
      fillRR(g, px0 + 3, 72, 1.4, 52, 0.7, '#b8a888');
      g.globalAlpha = 1;
    });
    fillRR(g, 188, 100, 104, 5, 2.5, ochreD);

    // 栏杆
    fillRR(g, 126, 150, 228, 3, 1.5, P.stoneL);
    fillRR(g, 126, 162, 228, 2, 1, P.stoneD);
    for (x = 132; x <= 348; x += 16) {
      fillRR(g, x, 150, 3, 16, 1.5, P.stoneL);
    }

    // 匾额（墨底朱砂字）
    fillRR(g, 218, 80, 44, 15, 3, P.ink);
    fillRR(g, 220, 82, 40, 11, 2, P.ink3);
    g.fillStyle = P.cinnabarL;
    g.font = 'bold 8px "Songti SC","STSong","SimSun",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('道院', 240, 88);

    roof(g, 240, 46, 86, 168, 22);
    roof(g, 240, 108, 118, 208, 18);
  }

  function wall(g, x, y, w, h, side) {
    fillRR(g, x, y, w, h, 3, P.paperL);
    fillRR(g, x - 3, y - 9, w + 6, 12, 4, P.stone);
    fillRR(g, x - 3, y - 9, w + 6, 6, 3, P.paperL);
    g.globalAlpha = 0.35;
    fillRR(g, x, y + h - 4, w, 4, 2, P.stoneD);
    g.globalAlpha = 1;

    var fx = side === 'left' ? x + 34 : x + w - 96;
    fillRR(g, fx, y + 12, 46, 30, 3, P.paper);
    fillRR(g, fx + 3, y + 15, 40, 24, 2, P.mossL);
    g.strokeStyle = 'rgba(106,138,106,0.7)';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(fx + 7, y + 34);
    g.quadraticCurveTo(fx + 15, y + 23, fx + 23, y + 34);
    g.quadraticCurveTo(fx + 30, y + 26, fx + 39, y + 34);
    g.stroke();
    circle(g, fx + 34, y + 21, 2.2, P.cinnabar);

    var chars = side === 'left' ? ['处', '见', '真', '如'] : ['一', '叶', '飘', '落'];
    var tx = side === 'left' ? x + 96 : x + 26;
    g.fillStyle = P.ink3;
    g.font = '10px "Songti SC","STSong","SimSun",serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (var i = 0; i < chars.length; i++) {
      g.fillText(chars[i], tx, y + 15 + i * 10);
    }
    fillRR(g, tx - 4, y + 46, 8, 8, 1.5, P.cinnabar);
    g.fillStyle = P.paperL;
    g.font = 'bold 5px "Songti SC","STSong","SimSun",serif';
    g.fillText('印', tx, y + 50);
  }

  function fuStone(g) {
    g.globalAlpha = 0.14;
    ellipse(g, 240, 227, 25, 4.5, P.ink3);
    g.globalAlpha = 1;
    fillRR(g, 220, 214, 40, 10, 4, P.stone);
    fillRR(g, 222, 212, 36, 4, 2, P.paperL);
    g.textAlign = 'center';
    g.textBaseline = 'alphabetic';
    g.font = 'bold 30px "Songti SC","STSong","SimSun",serif';
    g.fillStyle = P.cinnabar;
    g.fillText('福', 240, 214);
  }

  function cushion(g, x, y) {
    // 水墨蒲团：淡墨椭圆 + 朱砂边
    g.globalAlpha = 0.16;
    ellipse(g, x, y + 4.6, 13, 3.4, P.ink3);
    g.globalAlpha = 1;
    // 蒲团主体（宣纸色）
    ellipse(g, x, y, 12.4, 4.8, P.paper);
    ellipse(g, x, y - 1.6, 11.2, 3.6, P.warm);
    ellipse(g, x, y - 2.6, 6.6, 1.9, P.paperL);
    // 朱砂描边
    g.strokeStyle = P.cinnabar;
    g.lineWidth = 0.9;
    g.globalAlpha = 0.6;
    g.beginPath();
    g.ellipse(x, y, 12, 4.4, 0, 0, Math.PI * 2);
    g.stroke();
    g.globalAlpha = 1;
    // 中心墨点
    circle(g, x, y - 2.2, 1.1, P.ink4);
  }

  var groundCache = null;

  function bakeGround() {
    if (groundCache) return groundCache;
    var L = lcv(W, H);
    var g = L.g;
    var i, x, y;

    // 草地（淡墨绿晕染）
    g.fillStyle = P.mossL;
    g.beginPath();
    g.moveTo(0, 194);
    for (x = 0; x <= W; x += 30) {
      g.quadraticCurveTo(x + 15, 184 + ((x / 30) % 2 ? 2 : 0), x + 30, 191);
    }
    g.lineTo(W, 202);
    g.lineTo(0, 202);
    g.closePath();
    g.fill();
    g.globalAlpha = 0.5;
    for (i = 0; i < 26; i++) {
      x = (i * 37) % W;
      y = 188 + (i * 13) % 12;
      circle(g, x, y, 1.6, P.moss);
    }
    g.globalAlpha = 1;

    // 石坪（宣纸石）
    fillRR(g, 0, 192, W, H - 192, 0, P.paper);
    g.strokeStyle = 'rgba(160,156,148,0.35)';
    g.lineWidth = 0.8;
    for (y = 204; y < H; y += 16) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    for (y = 196; y < H; y += 16) {
      var off = ((y - 196) / 16) % 2 ? 16 : 0;
      for (x = off; x < W; x += 32) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 16); g.stroke();
      }
    }
    g.globalAlpha = 0.45;
    for (i = 0; i < 18; i++) {
      x = (i * 53) % W;
      y = 200 + (i * 29) % 64;
      fillRR(g, x, y, 14, 3, 1.5, P.paperL);
    }
    g.globalAlpha = 1;

    hall(g);
    wall(g, 0, 136, 124, 54, 'left');
    wall(g, 356, 136, 124, 54, 'right');
    tree(g, 6, 216, 1.12);
    tree(g, 474, 218, 1.12);
    fuStone(g);

    var scene = CFG.SCENE;
    for (i = 0; i < scene.seats.length; i++) {
      cushion(g, scene.seats[i].x, scene.seats[i].y - 6);
    }

    var planters = [[24, 196], [442, 196]];
    for (i = 0; i < planters.length; i++) {
      fillRR(g, planters[i][0], planters[i][1], 15, 6, 2.5, P.stone);
      fillRR(g, planters[i][0], planters[i][1], 15, 2.5, 1.2, P.paperL);
      inkBlob(g, planters[i][0] + 5, planters[i][1] - 3, 4.5, 3.5, P.moss, 301 + i);
      inkBlob(g, planters[i][0] + 10, planters[i][1] - 4, 4, 3, P.mossL, 303 + i);
      g.globalAlpha = 0.7;
      circle(g, planters[i][0] + 8, planters[i][1] - 7, 1.8, P.cinnabar);
      g.globalAlpha = 1;
    }

    // 宣纸纹理
    paperNoise(g, W, H, 0.05);

    groundCache = L.c;
    return groundCache;
  }

  /* ---------------- characters ---------------- */
  var charCache = null;

  function head(g, cx, cy, closed) {
    // 颈与下颌阴影
    ellipse(g, cx, cy + 5.4, 2.5, 2.4, CHAR.skinD);

    // 耳
    circle(g, cx - 4.9, cy + 1, 1, CHAR.skinD);
    circle(g, cx + 4.9, cy + 1, 1, CHAR.skinD);

    // 脸：左上受光、右下转暗，做出体积
    var face = g.createRadialGradient(cx - 1.9, cy - 2.3, 0.8, cx, cy + 0.6, 6.6);
    face.addColorStop(0, '#fcf3e4');
    face.addColorStop(0.55, CHAR.skin);
    face.addColorStop(1, '#dfcab0');
    ellipse(g, cx, cy, 4.8, 5.2, face);

    g.globalAlpha = 0.16;
    ellipse(g, cx + 3, cy + 1.4, 1.9, 3.1, '#c9a98c');
    g.globalAlpha = 1;

    // 左缘轮廓光
    g.strokeStyle = 'rgba(255,246,232,0.45)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.arc(cx, cy, 4.85, Math.PI * 0.8, Math.PI * 1.24);
    g.stroke();

    // 头发：额发 + 斜分刘海（上亮下暗）
    var hairG = g.createLinearGradient(cx - 5, cy - 6, cx + 5, cy + 2);
    hairG.addColorStop(0, '#444444');
    hairG.addColorStop(0.5, CHAR.hair);
    hairG.addColorStop(1, '#141414');
    g.fillStyle = hairG;
    g.beginPath();
    g.moveTo(cx - 5.1, cy + 0.4);
    g.quadraticCurveTo(cx - 5.4, cy - 6.2, cx, cy - 6.2);
    g.quadraticCurveTo(cx + 5.4, cy - 6.2, cx + 5.1, cy + 0.4);
    g.quadraticCurveTo(cx + 4.3, cy - 1.6, cx + 3.2, cy - 2.2);
    g.quadraticCurveTo(cx + 1.8, cy - 3, cx + 0.6, cy - 2.4);
    g.quadraticCurveTo(cx - 1.6, cy - 3.3, cx - 3.2, cy - 2.2);
    g.quadraticCurveTo(cx - 4.4, cy - 1.4, cx - 5.1, cy + 0.4);
    g.closePath();
    g.fill();

    // 两侧长发披肩
    fillRR(g, cx - 5.8, cy - 1.2, 1.8, 7, 0.9, CHAR.hair);
    fillRR(g, cx + 4, cy - 1.2, 1.8, 7, 0.9, CHAR.hair);
    g.globalAlpha = 0.35;
    fillRR(g, cx - 5.2, cy - 0.6, 0.7, 5.6, 0.35, CHAR.hairL);
    fillRR(g, cx + 4.5, cy - 0.6, 0.7, 5.6, 0.35, CHAR.hairL);
    g.globalAlpha = 1;

    // 发丝高光
    g.strokeStyle = 'rgba(160,160,160,0.32)';
    g.lineWidth = 0.7;
    g.beginPath();
    g.arc(cx, cy - 1.2, 4.2, Math.PI * 1.1, Math.PI * 1.52);
    g.stroke();

    // 高髻与玉簪
    circle(g, cx, cy - 6.7, 1.8, CHAR.hair);
    g.strokeStyle = CHAR.gold;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(cx - 2.7, cy - 7);
    g.lineTo(cx + 2.7, cy - 6.6);
    g.stroke();
    circle(g, cx + 2.7, cy - 6.6, 0.65, CHAR.jade);

    // 眉心朱点
    circle(g, cx, cy - 2.9, 0.55, '#b05048');

    // 眉
    g.strokeStyle = CHAR.hairL;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(cx - 3.4, cy - 0.5);
    g.quadraticCurveTo(cx - 2.4, cy - 1.2, cx - 1.4, cy - 0.7);
    g.moveTo(cx + 1.4, cy - 0.7);
    g.quadraticCurveTo(cx + 2.4, cy - 1.2, cx + 3.4, cy - 0.5);
    g.stroke();

    if (closed) {
      g.strokeStyle = CHAR.eye;
      g.lineWidth = 0.8;
      g.beginPath(); g.arc(cx - 2.2, cy + 0.7, 1.1, 0.2, Math.PI - 0.2); g.stroke();
      g.beginPath(); g.arc(cx + 2.2, cy + 0.7, 1.1, 0.2, Math.PI - 0.2); g.stroke();
    } else {
      ellipse(g, cx - 2.2, cy + 0.7, 1.15, 1.35, CHAR.eye);
      ellipse(g, cx + 2.2, cy + 0.7, 1.15, 1.35, CHAR.eye);
      circle(g, cx - 2.45, cy + 0.25, 0.42, '#ffffff');
      circle(g, cx + 1.95, cy + 0.25, 0.42, '#ffffff');
    }

    g.globalAlpha = 0.35;
    ellipse(g, cx - 3.1, cy + 2.5, 1.2, 0.65, CHAR.cheek);
    ellipse(g, cx + 3.1, cy + 2.5, 1.2, 0.65, CHAR.cheek);
    g.globalAlpha = 1;

    g.strokeStyle = '#c98a7c';
    g.lineWidth = 0.55;
    g.beginPath();
    g.arc(cx, cy + 2.5, 0.85, 0.3, Math.PI - 0.3);
    g.stroke();
  }

  function body(g, f, back) {
    var sway = f === 1 ? 0.35 : (f === 2 ? -0.3 : 0);
    var lx = 6.1 + sway, rx = 10.5 - sway;

    // 左光右暗的道袍渐变，制造圆柱体积
    var robeG = g.createLinearGradient(2, 0, 18, 0);
    robeG.addColorStop(0, '#adc9d2');
    robeG.addColorStop(0.4, CHAR.robe);
    robeG.addColorStop(1, '#4d6975');
    var beltG = g.createLinearGradient(0, 15.2, 0, 17.8);
    beltG.addColorStop(0, '#5d8090');
    beltG.addColorStop(0.5, CHAR.belt);
    beltG.addColorStop(1, '#29424e');

    // 鞋
    fillRR(g, lx, 24.7, 3.5, 2.7, 1.2, CHAR.shoe);
    fillRR(g, rx, 24.7, 3.5, 2.7, 1.2, CHAR.shoe);
    fillRR(g, lx + 0.4, 24.9, 2.3, 0.9, 0.45, '#8fa0a8');
    fillRR(g, rx + 0.4, 24.9, 2.3, 0.9, 0.45, '#8fa0a8');

    // 裙摆
    g.fillStyle = robeG;
    g.beginPath();
    g.moveTo(5.6, 15.2);
    g.quadraticCurveTo(10, 14.3, 14.4, 15.2);
    g.lineTo(16.2, 24.9);
    g.quadraticCurveTo(10, 26.1, 3.8, 24.9);
    g.closePath();
    g.fill();

    // 裙摆暗部与浅色下摆
    g.globalAlpha = 0.5;
    g.fillStyle = CHAR.robeD;
    g.beginPath();
    g.moveTo(13.2, 15.4);
    g.lineTo(16.2, 24.9);
    g.quadraticCurveTo(13.8, 25.6, 12.2, 25.5);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
    fillRR(g, 4.4, 23.6, 11.2, 1.3, 0.65, CHAR.robeL);

    // 中衣前襟
    if (!back) {
      g.fillStyle = CHAR.inner;
      g.beginPath();
      g.moveTo(8.8, 15.6);
      g.lineTo(7.8, 24.2);
      g.quadraticCurveTo(10, 24.8, 12.2, 24.2);
      g.lineTo(11.2, 15.6);
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(120,110,100,0.3)';
      g.lineWidth = 0.4;
      g.beginPath(); g.moveTo(10, 16.2); g.lineTo(10, 23.8); g.stroke();
    }

    // 上身
    g.fillStyle = robeG;
    g.beginPath();
    g.moveTo(6.3, 10.6);
    g.quadraticCurveTo(10, 9.6, 13.7, 10.6);
    g.lineTo(14.6, 16.2);
    g.quadraticCurveTo(10, 17.1, 5.4, 16.2);
    g.closePath();
    g.fill();

    // 宽袖
    g.fillStyle = robeG;
    g.beginPath();
    g.moveTo(6.6, 10.9);
    g.quadraticCurveTo(4.2, 13.4, 2.6, 18.4);
    g.quadraticCurveTo(4.4, 19.4, 6.3, 18.7);
    g.quadraticCurveTo(7.1, 14.6, 7.8, 11.8);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(13.4, 10.9);
    g.quadraticCurveTo(15.8, 13.4, 17.4, 18.4);
    g.quadraticCurveTo(15.6, 19.4, 13.7, 18.7);
    g.quadraticCurveTo(12.9, 14.6, 12.2, 11.8);
    g.closePath();
    g.fill();

    // 袖口浅色
    g.globalAlpha = 0.5;
    g.fillStyle = CHAR.robeL;
    g.beginPath();
    g.moveTo(2.6, 18.4);
    g.quadraticCurveTo(4.4, 19.4, 6.3, 18.7);
    g.lineTo(6.1, 17.4);
    g.quadraticCurveTo(4.3, 18.2, 2.8, 17.3);
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(17.4, 18.4);
    g.quadraticCurveTo(15.6, 19.4, 13.7, 18.7);
    g.lineTo(13.9, 17.4);
    g.quadraticCurveTo(15.7, 18.2, 17.2, 17.3);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;

    // 交领
    g.fillStyle = CHAR.inner;
    g.beginPath();
    g.moveTo(10, 10.1);
    g.lineTo(7.3, 13.8);
    g.lineTo(9.2, 14.9);
    g.lineTo(10.9, 12.1);
    g.closePath();
    g.fill();
    g.strokeStyle = CHAR.robeD;
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(10, 10.1);
    g.lineTo(7.3, 13.8);
    g.stroke();
    g.strokeStyle = CHAR.robeL;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(10, 10.1);
    g.lineTo(12.6, 13.4);
    g.stroke();

    // 袖内阴影、裙摆暗部、左缘轮廓光
    g.globalAlpha = 0.2;
    ellipse(g, 5.4, 14.6, 1.7, 3.4, '#3c5660');
    ellipse(g, 14.6, 14.6, 1.7, 3.4, '#3c5660');
    g.globalAlpha = 0.18;
    ellipse(g, 10, 23.2, 6.2, 2.4, '#3f5862');
    g.globalAlpha = 1;
    g.strokeStyle = 'rgba(228,244,250,0.3)';
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(6.4, 10.9);
    g.quadraticCurveTo(5.5, 13.4, 5.4, 16.1);
    g.stroke();

    // 腰带
    fillRR(g, 5.2, 15.7, 9.6, 1.7, 0.85, beltG);
    g.strokeStyle = 'rgba(210,235,240,0.25)';
    g.lineWidth = 0.4;
    g.beginPath();
    g.moveTo(5.6, 16.05);
    g.lineTo(14.4, 16.05);
    g.stroke();

    if (back) {
      fillRR(g, 9.3, 16.4, 1.4, 2.8, 0.6, CHAR.beltL);
    } else {
      circle(g, 10, 17.9, 0.95, CHAR.jade);
      circle(g, 10, 17.9, 0.4, '#c8e6da');
      circle(g, 6.1, 16.5, 0.55, CHAR.gold);
      circle(g, 13.9, 16.5, 0.55, CHAR.gold);
    }

    // 腰线金边
    g.strokeStyle = 'rgba(200,168,80,0.6)';
    g.lineWidth = 0.35;
    g.beginPath();
    g.moveTo(5.4, 16.5);
    g.lineTo(14.6, 16.5);
    g.stroke();

    if (!back) {
      circle(g, 4.6, 19.5, 1.1, CHAR.skin);
      circle(g, 15.4, 19.5, 1.1, CHAR.skin);
    }
  }

  function drawCharFront(g, f) {
    body(g, f, false);
    head(g, 10, 6.9, false);
  }

  function drawCharBack(g, f) {
    body(g, f, true);

    // 后脑长发（顶部受光、发梢转暗）
    var hairB = g.createLinearGradient(0, 2, 0, 14.5);
    hairB.addColorStop(0, '#414141');
    hairB.addColorStop(0.5, CHAR.hair);
    hairB.addColorStop(1, '#121212');
    ellipse(g, 10, 6.9, 4.9, 5.1, hairB);
    g.fillStyle = hairB;
    g.beginPath();
    g.moveTo(5.4, 4.6);
    g.quadraticCurveTo(4.6, 11.2, 6.4, 14.2);
    g.quadraticCurveTo(10, 15.4, 13.6, 14.2);
    g.quadraticCurveTo(15.4, 11.2, 14.6, 4.6);
    g.closePath();
    g.fill();

    // 发丝
    g.strokeStyle = CHAR.hairL;
    g.lineWidth = 0.4;
    g.beginPath();
    g.moveTo(8.4, 6.4);
    g.quadraticCurveTo(7.8, 11, 8.6, 13.8);
    g.moveTo(11.6, 6.4);
    g.quadraticCurveTo(12.2, 11, 11.4, 13.8);
    g.stroke();
    g.strokeStyle = 'rgba(170,170,170,0.28)';
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(9.4, 3.2);
    g.quadraticCurveTo(8.8, 8, 9.6, 12.6);
    g.stroke();

    // 高髻与玉簪
    circle(g, 10, 1.9, 1.9, CHAR.hair);
    g.strokeStyle = CHAR.gold;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(7.6, 1.6);
    g.lineTo(12.4, 1.9);
    g.stroke();
    circle(g, 12.4, 1.9, 0.65, CHAR.jade);
  }

  function drawCharSide(g, f) {
    body(g, f, false);

    // 侧脸（受光面在左前）
    var faceS = g.createRadialGradient(9.4, 5.6, 0.8, 11, 7.4, 6.2);
    faceS.addColorStop(0, '#fcf2e2');
    faceS.addColorStop(0.6, CHAR.skin);
    faceS.addColorStop(1, '#dfcab0');
    ellipse(g, 10.8, 6.9, 4.6, 5, faceS);

    // 头发
    var hairS = g.createLinearGradient(5, 2, 15, 9);
    hairS.addColorStop(0, '#424242');
    hairS.addColorStop(0.55, CHAR.hair);
    hairS.addColorStop(1, '#141414');
    g.fillStyle = hairS;
    g.beginPath();
    g.moveTo(5.6, 7.6);
    g.quadraticCurveTo(5.2, 1.9, 10.6, 1.9);
    g.quadraticCurveTo(15.4, 1.9, 15.5, 6.2);
    g.quadraticCurveTo(13.8, 3.9, 11.4, 4);
    g.quadraticCurveTo(8.4, 4.2, 7.1, 6);
    g.quadraticCurveTo(6.2, 6.9, 5.6, 7.6);
    g.closePath();
    g.fill();

    // 脑后长发与鬓
    fillRR(g, 5.2, 5.2, 1.9, 8, 0.9, CHAR.hair);
    fillRR(g, 8.2, 3.6, 1.3, 3.8, 0.65, CHAR.hair);

    // 高髻
    circle(g, 9.6, 1.8, 1.75, CHAR.hair);
    g.strokeStyle = CHAR.gold;
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(7.8, 1.5);
    g.lineTo(11.4, 1.8);
    g.stroke();
    circle(g, 11.4, 1.8, 0.6, CHAR.jade);

    // 眉
    g.strokeStyle = CHAR.hairL;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(12.2, 6.2);
    g.quadraticCurveTo(13.1, 5.6, 13.9, 6.1);
    g.stroke();

    // 眼
    ellipse(g, 13.2, 7.3, 1.05, 1.25, CHAR.eye);
    circle(g, 13.45, 6.95, 0.4, '#ffffff');

    // 鼻与唇
    g.strokeStyle = CHAR.skinD;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(14.9, 8.3);
    g.lineTo(15.1, 8.9);
    g.stroke();
    g.strokeStyle = '#c98a7c';
    g.beginPath();
    g.arc(14.1, 9.9, 0.75, 0.3, Math.PI - 0.3);
    g.stroke();

    // 眉心朱点与腮红
    circle(g, 12.7, 4.4, 0.5, '#b05048');
    g.globalAlpha = 0.35;
    ellipse(g, 14.6, 9.9, 0.9, 0.5, CHAR.cheek);
    g.globalAlpha = 1;
  }

  function mirror(src, w, h) {
    var c = cv(w, h);
    var g = c.getContext('2d');
    g.translate(w, 0);
    g.scale(-1, 1);
    g.drawImage(src, 0, 0);
    return c;
  }

  function drawSitting() {
    var L = lcv(24, 22);
    var g = L.g;

    // 盘坐裙摆
    g.fillStyle = CHAR.robe;
    g.beginPath();
    g.moveTo(6.2, 13.2);
    g.quadraticCurveTo(12, 11.4, 17.8, 13.2);
    g.quadraticCurveTo(21.6, 16.8, 20.2, 19.2);
    g.quadraticCurveTo(12, 21.6, 3.8, 19.2);
    g.quadraticCurveTo(2.4, 16.8, 6.2, 13.2);
    g.closePath();
    g.fill();

    fillRR(g, 4.6, 18.4, 14.8, 1.4, 0.7, CHAR.robeL);

    g.globalAlpha = 0.35;
    ellipse(g, 12, 19.4, 7.6, 1.6, CHAR.robeD);
    g.globalAlpha = 1;

    // 中衣
    g.fillStyle = CHAR.inner;
    g.beginPath();
    g.moveTo(9.6, 14.2);
    g.lineTo(9, 19.6);
    g.quadraticCurveTo(12, 20.3, 15, 19.6);
    g.lineTo(14.4, 14.2);
    g.closePath();
    g.fill();

    // 交领
    g.beginPath();
    g.moveTo(12, 12.6);
    g.lineTo(9.6, 15.8);
    g.lineTo(11.2, 16.6);
    g.lineTo(12.6, 14.2);
    g.closePath();
    g.fill();
    g.strokeStyle = CHAR.robeD;
    g.lineWidth = 0.55;
    g.beginPath();
    g.moveTo(12, 12.6);
    g.lineTo(9.6, 15.8);
    g.stroke();

    // 腰带与玉坠
    fillRR(g, 7.6, 15.4, 8.8, 1.5, 0.75, CHAR.belt);
    circle(g, 12, 17.4, 0.85, CHAR.jade);
    circle(g, 12, 17.4, 0.35, '#c8e6da');

    // 宽袖与结印双手
    ellipse(g, 9.4, 17.4, 2.2, 1.2, CHAR.robeL);
    ellipse(g, 14.6, 17.4, 2.2, 1.2, CHAR.robeL);
    circle(g, 10.2, 18.2, 0.95, CHAR.skin);
    circle(g, 13.8, 18.2, 0.95, CHAR.skin);

    head(g, 12, 7.4, true);
    return L.c;
  }

  function charSet() {
    if (charCache) return charCache;
    var set = { down: [], up: [], left: [], right: [], sit: null };
    for (var f = 0; f < 3; f++) {
      var dl = lcv(20, 28), ul = lcv(20, 28), rl = lcv(20, 28);
      drawCharFront(dl.g, f);
      drawCharBack(ul.g, f);
      drawCharSide(rl.g, f);
      set.down.push(dl.c);
      set.up.push(ul.c);
      set.right.push(rl.c);
      set.left.push(mirror(rl.c, 20 * S, 28 * S));
    }
    set.sit = drawSitting();
    charCache = set;
    return set;
  }

  /* ---------------- herbs ---------------- */
  var herbCache = null;

  function herbFrames() {
    if (herbCache) return herbCache;
    var frames = [];
    for (var f = 0; f < 4; f++) {
      var L = lcv(14, 16);
      var g = L.g;

      g.globalAlpha = 0.15 + f * 0.05;
      circle(g, 7, 5.6, 5.4, P.gold);
      g.globalAlpha = 1;

      g.strokeStyle = P.moss;
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(7, 15);
      g.quadraticCurveTo(6.6, 11, 7, 8);
      g.stroke();

      ellipse(g, 4.6, 11.4, 2.8, 1.7, P.leaf);
      ellipse(g, 9.4, 10.4, 2.8, 1.7, P.moss);
      ellipse(g, 5.4, 13.6, 2.2, 1.4, P.moss);

      circle(g, 7, 5.8, 2.7, P.gold);
      circle(g, 6.3, 5, 1.1, '#fff2c8');
      circle(g, 9.6, 3.2 + (f % 2) * 0.7, 0.9, '#fff6d8');
      frames.push(L.c);
    }
    herbCache = frames;
    return frames;
  }

  /* ---------------- vignette ---------------- */
  var vignetteCache = null;

  function vignette() {
    if (vignetteCache) return vignetteCache;
    var L = lcv(W, H);
    var g = L.g;
    var grad = g.createRadialGradient(W / 2, H / 2, 110, W / 2, H / 2, 320);
    grad.addColorStop(0, 'rgba(42,40,38,0)');
    grad.addColorStop(0.72, 'rgba(42,40,38,0.03)');
    grad.addColorStop(1, 'rgba(42,40,38,0.15)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    vignetteCache = L.c;
    return vignetteCache;
  }

  SS.Art = {
    P: P,
    S: S,
    cv: cv,
    px: px,
    rng: rng,
    blob: blob,
    circle: circle,
    ellipse: ellipse,
    fillRR: fillRR,
    lerpColor: lerpColor,
    inkBlob: inkBlob,
    brushStroke: brushStroke,
    paperNoise: paperNoise,
    bakeSky: bakeSky,
    bakeGround: bakeGround,
    charSet: charSet,
    herbFrames: herbFrames,
    vignette: vignette
  };
})(window.SS);
