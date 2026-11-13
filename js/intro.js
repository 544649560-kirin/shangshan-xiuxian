window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var Art = SS.Art;
  var P = Art.P;
  var W = CFG.W;
  var H = CFG.H;

  // 过场时间轴（秒）
  var TOTAL = 14.4;
  var T_A = 2.2;    // 山脚
  var T_B = 7.6;    // 登山
  var T_C = 11.0;   // 山门开启
  var T_D = 13.6;   // 殿内 → 淡出

  var Intro = {
    active: false,
    t: 0,
    done: null,
    smoke: []
  };

  function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }
  function seg(t, a, b) { return clamp01((t - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }

  function text(ctx, str, x, y, size, alpha, color, align) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = 'bold ' + size + 'px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = align || 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color || P.ink;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function sky(ctx) {
    var g = ctx.createLinearGradient(0, 0, 0, 210);
    g.addColorStop(0, '#f4efe4');
    g.addColorStop(0.55, '#e8e2d4');
    g.addColorStop(1, '#d8d2c4');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = 0.45;
    ctx.fillStyle = '#faf6ea';
    ctx.beginPath(); ctx.arc(352, 56, 20, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.14;
    ctx.beginPath(); ctx.arc(352, 56, 32, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }

  function cloud(ctx, x, y, s, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fbf8f0';
    ctx.beginPath();
    ctx.ellipse(x, y, 26 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 16 * s, y + 2 * s, 16 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 18 * s, y + 2 * s, 15 * s, 5.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function ridge(ctx, baseY, color, amp, speed, t) {
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-12, H);
    for (var x = -12; x <= W + 12; x += 8) {
      var wave = Math.sin(x * 0.012 + speed * t * 0.18) * amp +
        Math.sin(x * 0.033 + 1.7) * amp * 0.45;
      ctx.lineTo(x, baseY - wave);
    }
    ctx.lineTo(W + 12, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function mistBand(ctx, y, alpha) {
    var g = ctx.createLinearGradient(0, y - 10, 0, y + 12);
    g.addColorStop(0, 'rgba(250,247,240,0)');
    g.addColorStop(0.5, 'rgba(250,247,240,' + alpha + ')');
    g.addColorStop(1, 'rgba(250,247,240,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, y - 10, W, 22);
  }

  function walker(ctx, x, y, frame, s) {
    var set = Art.charSet();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 8 * s, 2.6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.drawImage(set.up[frame], x - 10 * s, y - 28 * s, 20 * s, 28 * s);
  }

  function pine(ctx, x, y, s) {
    ctx.globalAlpha = 0.3;
    Art.fillRR(ctx, x - 1.5 * s, y - 26 * s, 3 * s, 26 * s, 1.5 * s, P.ink2);
    Art.inkBlob(ctx, x, y - 34 * s, 12 * s, 9 * s, P.moss, 11);
    Art.inkBlob(ctx, x - 8 * s, y - 27 * s, 8 * s, 6 * s, P.mossL, 12);
    Art.inkBlob(ctx, x + 8 * s, y - 28 * s, 8 * s, 6 * s, P.mossL, 13);
    ctx.globalAlpha = 1;
  }

  function roofShape(ctx, cx, yTop, wTop, wBot, h) {
    var ht = wTop / 2, hb = wBot / 2;
    ctx.fillStyle = P.ink2;
    ctx.beginPath();
    ctx.moveTo(cx - ht, yTop);
    ctx.lineTo(cx - hb, yTop + h * 0.7);
    ctx.quadraticCurveTo(cx - hb - 10, yTop + h * 0.78, cx - hb - 14, yTop + h);
    ctx.lineTo(cx + hb + 14, yTop + h);
    ctx.quadraticCurveTo(cx + hb + 10, yTop + h * 0.78, cx + hb, yTop + h * 0.7);
    ctx.lineTo(cx + ht, yTop);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = P.cinnabar;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx - ht + 2, yTop);
    ctx.lineTo(cx + ht - 2, yTop);
    ctx.stroke();
  }

  function gateLion(ctx, x, y, dir) {
    ctx.fillStyle = P.stoneD;
    ctx.fillRect(x - 7, y - 6, 14, 6);
    ctx.fillStyle = P.stone;
    ctx.fillRect(x - 5.5, y - 10, 11, 4);

    ctx.fillStyle = P.stoneL;
    ctx.beginPath();
    ctx.ellipse(x, y - 16, 6, 5.6, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120,112,96,0.75)';
    ctx.lineWidth = 0.7;
    for (var i = 0; i < 6; i++) {
      var a = -0.9 + i * 0.36;
      ctx.beginPath();
      ctx.arc(x, y - 18, 5.4, a, a + 0.24);
      ctx.stroke();
    }

    ctx.fillStyle = '#e6dece';
    ctx.beginPath();
    ctx.arc(x + dir * 2, y - 21, 3.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink2;
    ctx.beginPath();
    ctx.arc(x + dir * 1.4, y - 23.8, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink3;
    ctx.beginPath();
    ctx.arc(x + dir * 3, y - 21.6, 0.7, 0, Math.PI * 2);
    ctx.fill();
  }

  function gateLantern(ctx, x, y) {
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x - 1.5, y - 56, 3, 56);
    ctx.fillStyle = '#7a6a52';
    ctx.fillRect(x - 1.5, y - 56, 1, 56);
    ctx.fillRect(x - 1.5, y - 58, 16, 2.4);

    ctx.strokeStyle = 'rgba(80,70,58,0.8)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x + 12, y - 56);
    ctx.lineTo(x + 12, y - 52);
    ctx.stroke();

    Art.fillRR(ctx, x + 7, y - 52, 10, 12, 2, '#e0c890');
    Art.fillRR(ctx, x + 8.4, y - 50.6, 7.2, 9.2, 1.4, '#f4e2b0');
    ctx.fillStyle = 'rgba(220,150,80,0.85)';
    ctx.beginPath();
    ctx.arc(x + 12, y - 46, 1.6, 0, Math.PI * 2);
    ctx.fill();

    var g = ctx.createRadialGradient(x + 12, y - 46, 1, x + 12, y - 46, 22);
    g.addColorStop(0, 'rgba(244,210,140,0.28)');
    g.addColorStop(1, 'rgba(244,210,140,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 12, y - 70, 48, 48);
  }

  function gateBanner(ctx, x, groundY, chars) {
    ctx.fillStyle = '#5a4a3a';
    ctx.fillRect(x - 1.2, groundY - 84, 2.4, 84);
    ctx.fillRect(x - 8, groundY - 84, 16, 2);

    var top = groundY - 80;
    var h = 14 + chars.length * 9;
    ctx.fillStyle = '#b86050';
    ctx.fillRect(x - 7, top, 14, h);
    ctx.fillStyle = '#f4eee0';
    ctx.fillRect(x - 5.2, top + 1.8, 10.4, h - 3.6);

    for (var i = 0; i < chars.length; i++) {
      text(ctx, chars[i], x, top + 11 + i * 9, 6, 0.9, P.ink);
    }

    ctx.strokeStyle = 'rgba(168,64,56,0.7)';
    ctx.lineWidth = 0.8;
    for (var k = -2; k <= 2; k++) {
      ctx.beginPath();
      ctx.moveTo(x + k * 2.4, top + h);
      ctx.lineTo(x + k * 2.4, top + h + 4);
      ctx.stroke();
    }
  }

  // 山门 / 大殿正面，open: 0 关闭 → 1 全开
  function hallFacade(ctx, cx, baseY, open) {
    Art.fillRR(ctx, cx - 112, baseY - 18, 224, 18, 3, P.stoneL);
    Art.fillRR(ctx, cx - 112, baseY - 18, 224, 4, 2, P.paperL);

    // 台阶
    for (var i = 0; i < 3; i++) {
      var w = 110 + i * 14;
      Art.fillRR(ctx, cx - w / 2, baseY - 4 + i * 5, w, 5, 2, i % 2 ? P.stone : P.paperD);
    }

    Art.fillRR(ctx, cx - 86, baseY - 92, 172, 74, 2, P.paperL);
    [-78, -44, 0, 44, 78].forEach(function (px) {
      Art.fillRR(ctx, cx + px - 3, baseY - 92, 6, 74, 2, P.cinnabar);
      ctx.globalAlpha = 0.3;
      Art.fillRR(ctx, cx + px + 0.6, baseY - 92, 1.6, 74, 0.8, P.paperL);
      ctx.globalAlpha = 1;
    });

    var dw = 54, dh = 56;
    ctx.fillStyle = '#2e2822';
    ctx.fillRect(cx - dw / 2, baseY - 84, dw, dh);

    // 门内暖光
    ctx.globalAlpha = 0.92 * open;
    var ig = ctx.createLinearGradient(0, baseY - 84, 0, baseY - 28);
    ig.addColorStop(0, '#f6e2b2');
    ig.addColorStop(1, '#c89a50');
    ctx.fillStyle = ig;
    ctx.fillRect(cx - dw / 2 + 1, baseY - 83, dw - 2, dh - 2);
    ctx.globalAlpha = 1;

    // 两扇门
    var slide = open * 24;
    ctx.fillStyle = '#7a5a40';
    ctx.fillRect(cx - dw / 2 - slide, baseY - 84, dw / 2, dh);
    ctx.fillRect(cx + slide, baseY - 84, dw / 2, dh);

    ctx.strokeStyle = 'rgba(40,34,26,0.55)';
    ctx.lineWidth = 0.6;
    for (var k = 1; k < 4; k++) {
      var dy = baseY - 84 + k * 14;
      ctx.beginPath();
      ctx.moveTo(cx - dw / 2 - slide, dy);
      ctx.lineTo(cx - slide, dy);
      ctx.moveTo(cx + slide, dy);
      ctx.lineTo(cx + dw / 2 + slide, dy);
      ctx.stroke();
    }

    // 门钉
    ctx.fillStyle = 'rgba(40,34,26,0.55)';
    for (var n = 0; n < 3; n++) {
      ctx.beginPath(); ctx.arc(cx - dw / 2 - slide + 9, baseY - 74 + n * 12, 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + dw / 2 + slide - 9, baseY - 74 + n * 12, 0.9, 0, Math.PI * 2); ctx.fill();
    }

    Art.fillRR(ctx, cx - 30, baseY - 114, 60, 16, 3, P.ink);
    text(ctx, '三 清 殿', cx, baseY - 102, 8, 1, P.cinnabarL);

    // 檐下斗拱
    for (var dx = -80; dx <= 80; dx += 13) {
      ctx.fillStyle = '#5c5040';
      ctx.fillRect(cx + dx - 2, baseY - 96, 4, 5);
      ctx.fillStyle = '#7a6a52';
      ctx.fillRect(cx + dx - 3.5, baseY - 92, 7, 2);
    }

    // 檐下挂灯
    [-52, 52].forEach(function (hx) {
      ctx.strokeStyle = 'rgba(60,50,40,0.7)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(cx + hx, baseY - 92);
      ctx.lineTo(cx + hx, baseY - 84);
      ctx.stroke();
      ctx.fillStyle = '#b85048';
      ctx.beginPath();
      ctx.ellipse(cx + hx, baseY - 79, 3.4, 4.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e0b060';
      ctx.fillRect(cx + hx - 1, baseY - 75, 2, 3.4);
    });

    roofShape(ctx, cx, baseY - 132, 80, 170, 40);
  }

  function taiji(ctx, x, y, r) {
    ctx.fillStyle = '#efe8d8';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1c1916';
    ctx.beginPath();
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - r / 2, r / 2, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#efe8d8';
    ctx.beginPath(); ctx.arc(x, y + r / 2, r / 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y - r / 2, r / 6, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = '#1c1916';
    ctx.beginPath(); ctx.arc(x, y + r / 2, r / 6, 0, Math.PI * 2); ctx.fill();

    ctx.strokeStyle = 'rgba(220,200,160,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
  }

  // 八卦环，trigrams 用 0..7 表示阴阳爻组合
  var TRIGRAMS = [7, 3, 5, 6, 1, 2, 4, 0];
  function bagua(ctx, x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(220,200,160,0.5)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();

    for (var i = 0; i < 8; i++) {
      var tri = TRIGRAMS[i];
      ctx.save();
      ctx.rotate(i * Math.PI / 4);
      for (var b = 0; b < 3; b++) {
        var yy = r + 5 + b * 3.2;
        var solid = (tri >> (2 - b)) & 1;
        ctx.beginPath();
        if (solid) {
          ctx.moveTo(-4, yy);
          ctx.lineTo(4, yy);
        } else {
          ctx.moveTo(-4, yy);
          ctx.lineTo(-1.2, yy);
          ctx.moveTo(1.2, yy);
          ctx.lineTo(4, yy);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function statue(ctx, x, y, s) {
    var hg = ctx.createRadialGradient(x, y - 44 * s, 2, x, y - 44 * s, 34 * s);
    hg.addColorStop(0, 'rgba(224,196,128,0.32)');
    hg.addColorStop(1, 'rgba(224,196,128,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(x - 40 * s, y - 86 * s, 80 * s, 94 * s);

    // 莲座
    Art.ellipse(ctx, x, y, 18 * s, 4 * s, '#4a3e32');
    Art.ellipse(ctx, x, y - 2.4 * s, 15 * s, 3.6 * s, '#7a6a52');

    // 衣身
    ctx.fillStyle = '#d8cfbc';
    ctx.beginPath();
    ctx.moveTo(x - 13 * s, y - 6 * s);
    ctx.quadraticCurveTo(x - 16 * s, y - 30 * s, x - 8 * s, y - 34 * s);
    ctx.lineTo(x + 8 * s, y - 34 * s);
    ctx.quadraticCurveTo(x + 16 * s, y - 30 * s, x + 13 * s, y - 6 * s);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(90,85,80,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, y - 32 * s); ctx.lineTo(x, y - 8 * s); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - 7 * s, y - 26 * s);
    ctx.quadraticCurveTo(x - 3 * s, y - 17 * s, x - 5 * s, y - 8 * s);
    ctx.stroke();

    // 头与髻
    Art.circle(ctx, x, y - 39 * s, 7 * s, '#e8dfcc');
    Art.circle(ctx, x, y - 46 * s, 3.4 * s, '#c8bca6');

    // 禅定印
    Art.ellipse(ctx, x, y - 13 * s, 6 * s, 2.4 * s, '#e0d6c2');

    ctx.strokeStyle = 'rgba(90,85,80,0.35)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(x - 3 * s, y - 39 * s);
    ctx.lineTo(x + 3 * s, y - 39 * s);
    ctx.stroke();
  }

  function banner(ctx, x, y, chars) {
    ctx.fillStyle = 'rgba(168,64,56,0.4)';
    ctx.fillRect(x - 6, y, 12, 14 + chars.length * 12);
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = P.paperL;
    ctx.fillRect(x - 4, y + 2, 8, 10 + chars.length * 12);
    ctx.globalAlpha = 1;
    for (var i = 0; i < chars.length; i++) {
      text(ctx, chars[i], x, y + 16 + i * 12, 7, 0.8, '#e8dcc0');
    }
  }

  function lantern(ctx, x, y, t) {
    ctx.strokeStyle = 'rgba(200,180,140,0.3)';
    ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();

    var f = 0.85 + 0.15 * Math.sin(t * 6 + x);
    var g = ctx.createRadialGradient(x, y + 6, 2, x, y + 6, 26 * f);
    g.addColorStop(0, 'rgba(240,200,120,0.45)');
    g.addColorStop(1, 'rgba(240,200,120,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 30, y - 16, 60, 62);

    Art.fillRR(ctx, x - 6, y, 12, 14, 3, '#c8a850');
    Art.fillRR(ctx, x - 4, y + 2, 8, 10, 2, '#f0dca8');
    ctx.fillStyle = 'rgba(220,120,80,0.9)';
    ctx.beginPath(); ctx.arc(x, y + 7, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  function burner(ctx, x, y, smoke) {
    Art.ellipse(ctx, x, y + 7, 16, 3, 'rgba(0,0,0,0.35)');

    ctx.strokeStyle = '#8a6a4a';
    ctx.lineWidth = 1;
    for (var i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(x + i * 4, y - 1);
      ctx.lineTo(x + i * 4, y - 13);
      ctx.stroke();
      ctx.fillStyle = 'rgba(224,128,86,0.9)';
      ctx.beginPath(); ctx.arc(x + i * 4, y - 13, 0.9, 0, Math.PI * 2); ctx.fill();
    }

    ctx.fillStyle = '#6a5a48';
    ctx.beginPath();
    ctx.moveTo(x - 14, y);
    ctx.quadraticCurveTo(x - 12, y + 10, x - 7, y + 10);
    ctx.lineTo(x + 7, y + 10);
    ctx.quadraticCurveTo(x + 12, y + 10, x + 14, y);
    ctx.closePath();
    ctx.fill();

    for (var s = 0; s < smoke.length; s++) {
      var p = smoke[s];
      ctx.globalAlpha = p.a;
      ctx.fillStyle = '#d8d2c8';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 分段绘制 ---------------- */

  // 山脚：石阶、石狮、挑灯、竖匾，作为「上山」的标识
  function treeTrunk(ctx, x, baseY, s) {
    ctx.fillStyle = 'rgba(60,54,48,0.32)';
    ctx.fillRect(x - 4 * s, baseY - 150 * s, 8 * s, 150 * s);
    Art.inkBlob(ctx, x - 10 * s, baseY - 150 * s, 26 * s, 18 * s, P.ink4, 31 + x);
    Art.inkBlob(ctx, x + 14 * s, baseY - 132 * s, 20 * s, 14 * s, P.ink5, 32 + x);
  }

  function handrail(ctx, x0, y0, x1, y1) {
    ctx.strokeStyle = 'rgba(90,66,46,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();

    ctx.lineWidth = 1.2;
    for (var i = 0; i <= 4; i++) {
      var k = i / 4;
      var x = x0 + (x1 - x0) * k;
      var y = y0 + (y1 - y0) * k;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 10 - i * 1.3);
      ctx.stroke();
    }
  }

  // 山门一隅的石碣：莲座、碑身、碑檐翘角、碑文与苔痕
  function bigStele(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(2, 0, 24, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 三层莲座
    ctx.fillStyle = '#b6ae9e';
    ctx.beginPath();
    ctx.moveTo(-24, 0); ctx.lineTo(24, 0); ctx.lineTo(20, -6); ctx.lineTo(-20, -6);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cdc5b4';
    ctx.beginPath();
    ctx.moveTo(-20, -6); ctx.lineTo(20, -6); ctx.lineTo(17, -11); ctx.lineTo(-17, -11);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,92,0.55)';
    ctx.lineWidth = 0.8;
    for (var i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * 5.4, -6, 2.6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }

    // 碑身
    ctx.fillStyle = '#e0d9c8';
    ctx.beginPath();
    ctx.moveTo(-13, -11);
    ctx.lineTo(13, -11);
    ctx.lineTo(11, -52);
    ctx.quadraticCurveTo(0, -56, -11, -52);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(120,110,92,0.16)';
    ctx.beginPath();
    ctx.moveTo(8, -11); ctx.lineTo(13, -11); ctx.lineTo(11, -52);
    ctx.quadraticCurveTo(9.5, -53, 8, -53.5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(120,110,92,0.32)';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-9, -49, 18, 35);

    // 碑首与翘角
    ctx.fillStyle = '#cfc7b6';
    ctx.beginPath();
    ctx.moveTo(-16, -56); ctx.lineTo(16, -56);
    ctx.lineTo(12, -62); ctx.lineTo(-12, -62);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8b0a0';
    ctx.beginPath();
    ctx.moveTo(-12, -62); ctx.lineTo(12, -62);
    ctx.quadraticCurveTo(0, -68, -12, -62);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#cfc7b6';
    ctx.beginPath();
    ctx.moveTo(-17, -56); ctx.quadraticCurveTo(-22, -58, -21, -62);
    ctx.lineTo(-15, -58); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(17, -56); ctx.quadraticCurveTo(22, -58, 21, -62);
    ctx.lineTo(15, -58); ctx.closePath(); ctx.fill();

    // 碑文
    ctx.fillStyle = '#4a443c';
    ctx.font = 'bold 8px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = 'center';
    var chars = '上山修仙';
    for (var c = 0; c < chars.length; c++) {
      ctx.fillText(chars[c], 0, -40 + c * 9);
    }
    ctx.fillStyle = 'rgba(80,72,60,0.7)';
    ctx.font = '3.5px "Songti SC","STSong",serif';
    ctx.fillText('道', -5.8, -48);
    ctx.fillText('院', -5.8, -44.6);
    ctx.fillStyle = P.cinnabar;
    ctx.fillRect(4.2, -50, 3.2, 3.2);

    // 苔痕
    ctx.fillStyle = 'rgba(106,138,106,0.35)';
    ctx.beginPath(); ctx.ellipse(-10, -13, 3, 1.6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(11, -14, 2.2, 1.2, 0, 0, Math.PI * 2); ctx.fill();

    ctx.restore();
  }

  function drawFoot(ctx, t) {
    sky(ctx);
    ridge(ctx, 142, P.ink5, 16, 0.5, t);
    ridge(ctx, 164, P.ink4, 22, 0.8, t);
    cloud(ctx, 96 + Math.sin(t * 0.4) * 8, 58, 1, 0.45);
    cloud(ctx, 350 + Math.sin(t * 0.3 + 2) * 10, 88, 0.7, 0.3);
    mistBand(ctx, 150, 0.18);

    // 林间露出一角殿顶
    ctx.fillStyle = '#d9b97c';
    ctx.fillRect(86, 84, 54, 22);
    ctx.fillStyle = '#3a3832';
    ctx.beginPath();
    ctx.moveTo(78, 86);
    ctx.quadraticCurveTo(113, 71, 149, 86);
    ctx.lineTo(140, 92);
    ctx.quadraticCurveTo(113, 81, 87, 92);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a84038';
    ctx.fillRect(94, 90, 3, 16);
    ctx.fillRect(126, 90, 3, 16);
    Art.inkBlob(ctx, 116, 100, 44, 15, P.ink4, 41);

    // 两侧山石与林影
    Art.inkBlob(ctx, 44, 198, 40, 32, P.ink5, 21);
    Art.inkBlob(ctx, 440, 192, 42, 34, P.ink5, 22);
    Art.inkBlob(ctx, 66, 216, 32, 24, P.ink4, 23);
    Art.inkBlob(ctx, 420, 212, 34, 26, P.ink4, 24);
    treeTrunk(ctx, 62, 202, 0.95);
    treeTrunk(ctx, 416, 198, 1.1);
    treeTrunk(ctx, 26, 212, 0.75);

    // 石砌挡墙
    ctx.fillStyle = '#b8b0a0';
    ctx.fillRect(58, 206, 96, 34);
    ctx.strokeStyle = 'rgba(90,84,72,0.38)';
    ctx.lineWidth = 0.6;
    for (var r = 0; r < 4; r++) {
      var wy = 210 + r * 8;
      ctx.beginPath(); ctx.moveTo(58, wy); ctx.lineTo(154, wy); ctx.stroke();
      for (var wx = 62 + (r % 2) * 6; wx < 152; wx += 14) {
        ctx.beginPath(); ctx.moveTo(wx, wy - 8); ctx.lineTo(wx, wy); ctx.stroke();
      }
    }

    // 山门一隅的主碑
    bigStele(ctx, 100, 266, 1);

    // 上山石阶（近宽远窄）
    for (var i = 0; i < 9; i++) {
      var yy = 266 - i * 13;
      var w = 148 - i * 9;
      Art.fillRR(ctx, 240 - w / 2, yy - 7, w, 8, 2, i % 2 ? '#c8b090' : '#d8c4a2');
      ctx.fillStyle = 'rgba(90,70,50,0.22)';
      ctx.fillRect(240 - w / 2, yy - 1, w, 1.2);
    }
    handrail(ctx, 240 - 70, 266, 240 - 38, 158);
    handrail(ctx, 240 + 70, 266, 240 + 38, 158);

    // 标识：石狮、灯柱、上山竖匾
    gateLion(ctx, 172, 266, -1);
    gateLion(ctx, 308, 266, 1);
    gateLantern(ctx, 352, 266);
    gateBanner(ctx, 148, 266, ['上', '山']);

    walker(ctx, 240, 268, Math.floor(t * 2) % 2, 0.9);

    // 斜洒的暖光
    var sun = ctx.createLinearGradient(0, 0, W, H);
    sun.addColorStop(0, 'rgba(244,214,150,0.14)');
    sun.addColorStop(0.55, 'rgba(244,214,150,0.04)');
    sun.addColorStop(1, 'rgba(244,214,150,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, W, H);

    var a = seg(t, 0.1, 0.6) * (1 - seg(t, 1.7, 2.1));
    text(ctx, '山　脚', 240, 40, 16, a * 0.75, P.ink);
  }

  // 登山：一条真实蜿蜒的山道，镜头随人前行
  var TRAIL_SPEED = 34;

  function trailY(wx) {
    return 208 - wx * 0.09 + Math.sin(wx * 0.021) * 9 + Math.sin(wx * 0.0068 + 2) * 6;
  }

  function layerRidge(ctx, camX, camY, par, baseY, amp, color, alpha) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, H);
    for (var x = -10; x <= W + 10; x += 8) {
      var wx = camX * par + x;
      var y = baseY - Math.sin(wx * 0.006) * amp -
        Math.sin(wx * 0.015 + 1.3) * amp * 0.5 - camY * par;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 10, H);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawFarTemple(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.globalAlpha = 0.5;

    ctx.fillStyle = '#7a6a52';
    ctx.fillRect(-10, -14, 20, 12);

    ctx.fillStyle = '#4a4438';
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.quadraticCurveTo(0, -22, 14, -14);
    ctx.lineTo(10, -11);
    ctx.quadraticCurveTo(0, -17, -10, -11);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(-1, -26, 2, 6);

    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#e8d8a8';
    ctx.beginPath();
    ctx.arc(0, -18, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawTrail(ctx, camX, camY) {
    // 山体
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (var x = 0; x <= W; x += 6) {
      ctx.lineTo(x, trailY(camX + x) - camY - 12);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = P.ink5;
    ctx.fill();

    // 路面
    ctx.beginPath();
    for (var x2 = 0; x2 <= W; x2 += 6) {
      ctx.lineTo(x2, trailY(camX + x2) - camY - 10);
    }
    for (var x3 = W; x3 >= 0; x3 -= 6) {
      ctx.lineTo(x3, trailY(camX + x3) - camY + 15);
    }
    ctx.closePath();
    var road = ctx.createLinearGradient(0, 180, 0, 246);
    road.addColorStop(0, '#d9d0ba');
    road.addColorStop(0.5, '#c5bba3');
    road.addColorStop(1, '#a79d87');
    ctx.fillStyle = road;
    ctx.fill();

    // 路面石阶
    var gap = 30;
    var first = Math.floor(camX / gap) * gap - gap;
    for (var wx = first; wx < camX + W + gap; wx += gap) {
      var sx = wx - camX;
      var sy = trailY(wx) - camY;
      ctx.fillStyle = (Math.floor(wx / gap) % 2) ? '#cfc4ac' : '#dbd1b9';
      ctx.beginPath();
      ctx.moveTo(sx - 14, sy - 6);
      ctx.lineTo(sx + 14, sy - 6);
      ctx.lineTo(sx + 16, sy + 2);
      ctx.lineTo(sx - 16, sy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,235,0.28)';
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(sx - 14, sy - 6);
      ctx.lineTo(sx + 14, sy - 6);
      ctx.stroke();
    }

    // 碎石
    for (var k = 0; k < 16; k++) {
      var wxs = camX + ((k * 53) % 480);
      var sxs = wxs - camX;
      var sys = trailY(wxs) - camY;
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#b8ae96';
      ctx.beginPath();
      ctx.ellipse(sxs, sys + 6 + (k % 3) * 3, 1.6, 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawTrailPines(ctx, camX, camY, par, fg) {
    var gap = 132;
    var first = Math.floor(camX * par / gap) * gap - gap;
    for (var wx = first; wx < camX * par + W + gap; wx += gap) {
      var sx = wx - camX * par;
      if (fg && sx > 80 && sx < 400) continue;
      var sy = trailY(wx) - camY * par - (fg ? 18 : 8);
      pine(ctx, sx, sy, (fg ? 1.4 : 0.95) + ((wx / gap) % 2) * 0.18);
    }
  }

  function drawGodRays(ctx, s) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 3; i++) {
      var off = Math.sin(s * 0.3 + i) * 6;
      var g = ctx.createLinearGradient(330 + off, 0, 180 + off, 270);
      g.addColorStop(0, 'rgba(250,232,190,0.15)');
      g.addColorStop(0.6, 'rgba(250,232,190,0.05)');
      g.addColorStop(1, 'rgba(250,232,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(300 + off + i * 26, 0);
      ctx.lineTo(318 + off + i * 26, 0);
      ctx.lineTo(200 + off + i * 20, 270);
      ctx.lineTo(160 + off + i * 20, 270);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMotes(ctx, s) {
    ctx.fillStyle = '#f0dca8';
    for (var i = 0; i < 16; i++) {
      var mx = (i * 71 + s * 9) % 480;
      var my = 200 - ((i * 37 + s * 14) % 160);
      ctx.globalAlpha = 0.16 + 0.16 * Math.sin(s * 1.4 + i);
      ctx.beginPath();
      ctx.arc(mx, my + Math.sin(s * 0.8 + i) * 4, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawClimb(ctx, s) {
    sky(ctx);

    var camX = s * TRAIL_SPEED;
    var charX = 150;
    var charWX = camX + charX;
    var camY = trailY(charWX) - 222;

    layerRidge(ctx, camX, camY, 0.22, 112, 16, P.ink5, 0.16);
    layerRidge(ctx, camX, camY, 0.45, 146, 22, P.ink4, 0.3);

    var px = 392 - camX * 0.1;
    drawFarTemple(ctx, px, 92 - camY * 0.3, 0.9);

    cloud(ctx, 90 + Math.sin(s * 0.5) * 14, 70, 0.8, 0.4);
    cloud(ctx, 350 + Math.sin(s * 0.35 + 2) * 20, 52, 0.65, 0.28);
    mistBand(ctx, 168 + Math.sin(s * 0.6) * 8, 0.2);

    drawTrailPines(ctx, camX, camY, 0.85, false);
    drawTrail(ctx, camX, camY);
    drawTrailPines(ctx, camX, camY, 1.15, true);
    drawGodRays(ctx, s);
    drawMotes(ctx, s);

    // 侧身行走、身体随步起伏
    var bob = Math.abs(Math.sin(charWX * 0.09)) * 1.2;
    var frame = Math.floor(charWX * 0.09) % 3;
    var set = Art.charSet();

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(charX, 223, 9, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.drawImage(set.right[frame], charX - 10, 222 - 28 - bob, 20, 28);

    // 足下微尘
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#d8d0c0';
    for (var d = 0; d < 3; d++) {
      var dx = charX - 9 - ((charWX * 0.6 + d * 9) % 18);
      ctx.beginPath();
      ctx.arc(dx, 220 - d * 1.5, 1.6 - d * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    var a = seg(s, 0.1, 0.9) * (1 - seg(s, 4.6, 5.3));
    text(ctx, '上　山', 240, 46, 16, a * 0.8, P.ink);
    text(ctx, '云 在 脚 下', 240, 62, 8, a * 0.45, P.ink4);
  }

  function drawGate(ctx, s, walkIn) {
    sky(ctx);
    ridge(ctx, 140, P.ink5, 16, 0.5, s);
    ridge(ctx, 162, P.ink4, 20, 0.8, s + 2);

    ctx.fillStyle = P.stone;
    ctx.fillRect(0, 198, W, H - 198);
    ctx.globalAlpha = 0.4;
    for (var x = 0; x < W; x += 32) {
      Art.fillRR(ctx, x + 4, 206 + (x % 64 ? 8 : 0), 24, 3, 1.5, P.paperL);
    }
    ctx.globalAlpha = 1;

    // 山门两侧的山石松影
    Art.inkBlob(ctx, 34, 202, 46, 38, P.ink5, 61);
    Art.inkBlob(ctx, 446, 198, 48, 40, P.ink5, 62);
    Art.inkBlob(ctx, 70, 214, 30, 22, P.ink4, 63);
    Art.inkBlob(ctx, 414, 212, 32, 24, P.ink4, 64);
    pine(ctx, 48, 208, 1.1);
    pine(ctx, 432, 204, 1.25);
    pine(ctx, 92, 214, 0.85);

    var k = easeOut(seg(s, 0.1, 2.3));
    var scale = 0.58 + k * 0.72;
    var open = typeof walkIn === 'number' ? walkIn : easeOut(seg(s, 1.8, 3.0));

    ctx.save();
    ctx.translate(240, 210);
    ctx.scale(scale, scale);
    ctx.translate(-240, -210);
    hallFacade(ctx, 240, 200, open);
    gateLion(ctx, 176, 202, -1);
    gateLion(ctx, 304, 202, 1);
    gateLantern(ctx, 132, 202);
    gateBanner(ctx, 348, 202, ['上', '山', '修', '仙']);
    ctx.restore();

    // 玩家自己走向山门
    if (typeof walkIn === 'number') {
      walker(ctx, 240, 264 - walkIn * 32, Math.floor(Date.now() / 140) % 2, 1.2 - walkIn * 0.4);
    }

    if (open > 0.02) {
      var lg = ctx.createRadialGradient(240, 150, 4, 240, 150, 100);
      lg.addColorStop(0, 'rgba(244,214,150,' + (0.4 * open) + ')');
      lg.addColorStop(1, 'rgba(244,214,150,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(80, 30, 320, 220);
    }

    var a = seg(s, 0.5, 1.2) * (1 - seg(s, 2.6, 3.2));
    text(ctx, '道　院', 240, 62, 20, a, P.ink);
  }

  function drawHall(ctx, s, smoke, hallWalk) {
    var zoom = 1 + 0.06 * clamp01(s / 3.4);
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-W / 2, -H / 2);

    var bg = ctx.createRadialGradient(240, 116, 16, 240, 150, 270);
    bg.addColorStop(0, '#4c4438');
    bg.addColorStop(0.55, '#2e2a24');
    bg.addColorStop(1, '#191612');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 地砖透视
    ctx.strokeStyle = 'rgba(210,200,180,0.14)';
    ctx.lineWidth = 0.6;
    for (var i = -6; i <= 6; i++) {
      ctx.beginPath();
      ctx.moveTo(240 + i * 6, 184);
      ctx.lineTo(240 + i * 46, H);
      ctx.stroke();
    }
    for (var j = 0; j < 6; j++) {
      var y = 190 + j * 7 + j * j * 3;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // 后墙
    Art.fillRR(ctx, 96, 38, 288, 148, 4, '#3a342c');
    ctx.globalAlpha = 0.45;
    Art.fillRR(ctx, 104, 46, 272, 132, 3, '#463f34');
    ctx.globalAlpha = 1;

    bagua(ctx, 240, 96, 40, s * 0.22);
    taiji(ctx, 240, 96, 16);

    banner(ctx, 118, 44, ['道']);
    banner(ctx, 362, 44, ['法', '自', '然']);

    statue(ctx, 168, 186, 0.92);
    statue(ctx, 240, 190, 1.08);
    statue(ctx, 312, 186, 0.92);

    // 供桌
    Art.fillRR(ctx, 148, 192, 184, 8, 2, '#5a4a3a');
    Art.fillRR(ctx, 148, 192, 184, 3, 1, '#6e5c48');

    burner(ctx, 240, 205, smoke);

    lantern(ctx, 132, 48, s);
    lantern(ctx, 348, 48, s + 1.7);

    // 玩家自己走入殿中
    if (typeof hallWalk === 'number') {
      walker(ctx, 240, 268 - hallWalk * 52, Math.floor(s * 4) % 2, 1.15 - hallWalk * 0.4);
    }

    var vg = ctx.createLinearGradient(0, 0, 0, 76);
    vg.addColorStop(0, 'rgba(10,8,6,0.55)');
    vg.addColorStop(1, 'rgba(10,8,6,0)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, 76);

    ctx.restore();

    // 入殿暖光一闪
    var flash = 1 - clamp01(s / 0.8);
    if (flash > 0) {
      ctx.globalAlpha = flash * 0.85;
      ctx.fillStyle = '#f0e4c8';
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }

    var a = seg(s, 0.9, 1.4) * (1 - seg(s, 2.4, 3.1));
    text(ctx, '三　清　殿', 240, 252, 11, a, '#e8dcc0');
  }

  /* ---------------- 生命周期 ---------------- */

  Intro.play = function (cb) {
    this.active = true;
    this.t = 0;
    this.phase = 0;
    this.walk = 0;
    this.appr = 0;
    this.hallWalk = 0;
    this.done = cb || null;
    this.smoke = [];
    for (var i = 0; i < 14; i++) {
      this.smoke.push({
        x: 240 + (Math.random() - 0.5) * 8,
        y: 198 + (Math.random() - 0.5) * 12,
        r: 1 + Math.random() * 1.6,
        vy: 6 + Math.random() * 7,
        seed: Math.random() * 6.28
      });
    }
  };

  Intro.skip = function () {
    if (this.active) this.finish();
  };

  Intro.finish = function () {
    if (!this.active) return;
    this.active = false;
    var cb = this.done;
    this.done = null;
    if (cb) cb();
  };

  Intro.update = function (dt) {
    if (!this.active) return;
    this.t += dt;

    for (var i = 0; i < this.smoke.length; i++) {
      var p = this.smoke[i];
      p.y -= p.vy * dt;
      p.x += Math.sin(this.t * 1.4 + p.seed) * 4.5 * dt;
      p.r += 2.4 * dt;
      if (p.y < 150) {
        p.y = 199;
        p.x = 240 + (Math.random() - 0.5) * 8;
        p.r = 1;
      }
    }

    var keys = (SS.Input && SS.Input.keys) || {};
    var joy = (SS.Input && SS.Input.joy) || { x: 0, y: 0 };
    var right = keys.KeyD || keys.ArrowRight || joy.x > 0.3;
    var left = keys.KeyA || keys.ArrowLeft || joy.x < -0.3;
    var up = keys.KeyW || keys.ArrowUp || joy.y < -0.3;
    var down = keys.KeyS || keys.ArrowDown || joy.y > 0.3;

    if (this.phase === 0) {
      if (right || up) this.phase = 1;
    } else if (this.phase === 1) {
      if (right) this.walk += dt / 5.4;
      if (left) this.walk -= dt / 5.4;
      this.walk = clamp01(this.walk);
      if (this.walk >= 1) {
        this.phase = 2;
        this.appr = 0;
      }
    } else if (this.phase === 2) {
      if (right) this.appr += dt / 2.2;
      if (left) this.appr -= dt / 2.2;
      this.appr = clamp01(this.appr);
      if (this.appr >= 1) {
        this.phase = 3;
        this.hallWalk = 0;
      }
    } else if (this.phase === 3) {
      if (up || right) this.hallWalk += dt / 3.0;
      if (down || left) this.hallWalk -= dt / 3.0;
      this.hallWalk = clamp01(this.hallWalk);
      if (this.hallWalk >= 1) this.finish();
    }
  };

  Intro.draw = function (ctx, time) {
    if (!this.active) return;
    var t = this.t;
    var hint = '';

    if (this.phase === 0) {
      drawFoot(ctx, t);
      hint = '按住 D / → 上山';
    } else if (this.phase === 1) {
      drawClimb(ctx, this.walk * 5.4);
      hint = '按住 D / → 前行';
    } else if (this.phase === 2) {
      drawGate(ctx, 3.0, this.appr);
      hint = '向前走，推开山门';
    } else {
      drawHall(ctx, t, this.smoke, this.hallWalk);
      hint = '走入三清殿';
    }

    if (hint) {
      text(ctx, hint, 240, H - 12, 8, 0.34 + 0.14 * Math.sin(time * 2.2), P.ink3);
    }
    text(ctx, '点击跳过', W - 34, H - 12, 8, 0.26, P.ink4, 'right');
  };

  SS.Intro = Intro;
})(window.SS);
