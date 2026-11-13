window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var Art = SS.Art;
  var P = Art.P;
  var W = CFG.W;

  // 现实时间 → 天色
  var TOD = [
    { h: 0, k: 'deepnight' },
    { h: 5, k: 'dawn' },
    { h: 7, k: 'morning' },
    { h: 10, k: 'noon' },
    { h: 15, k: 'afternoon' },
    { h: 17.5, k: 'dusk' },
    { h: 19.5, k: 'night' },
    { h: 23, k: 'deepnight' }
  ];
  var TOD_NAME = {
    deepnight: '深夜', dawn: '黎明', morning: '清晨', noon: '正午',
    afternoon: '午后', dusk: '黄昏', night: '夜晚'
  };

  var LEAF_PAL = {
    dawn: ['#d8b8b0', '#c8a898', '#a8b8a0'],
    morning: ['#c8a8a0', '#b89888', '#98a890'],
    noon: ['#98a890', '#88a888', '#d8c8a0'],
    afternoon: ['#d8c090', '#c8a878', '#c8a098'],
    dusk: ['#b89060', '#a87848', '#c8a860'],
    night: ['#8890a8', '#788098', '#a8b0c0'],
    deepnight: ['#687090', '#8890a8', '#98a0b8']
  };

  function todKey(d) {
    var h = d.getHours() + d.getMinutes() / 60;
    var k = 'deepnight';
    for (var i = 0; i < TOD.length; i++) {
      if (h >= TOD[i].h) k = TOD[i].k;
    }
    return k;
  }

  var Scene = {
    skyKey: 'morning',
    prevSky: null,
    skyMix: 1,
    ground: null,
    clouds: [],
    particles: [],
    leafTimer: 0,
    qiAcc: 0,
    mateTimer: 1.5,
    flyTimer: 2,
    todTimer: 0,
    mistTimer: 0,
    splashTimer: 8,
    isNight: false,
    npc: CFG.SCENE.npc,
    seats: CFG.SCENE.seats,
    herbs: CFG.SCENE.herbs,
    herbFrames: null,
    deer: { x: 330, y: 250, dir: -1, moving: false, timer: 2.5, frame: 0 }
  };

  Scene.todKey = todKey;

  Scene.phaseName = function () {
    return TOD_NAME[todKey(new Date())] || '';
  };

  Scene.init = function () {
    this.ground = Art.bakeGround();
    this.herbFrames = Art.herbFrames();
    this.skyKey = todKey(new Date());
    this.prevSky = null;
    this.skyMix = 1;
    this.mateTimer = 1.5;
    this.flyTimer = 2;
    this.todTimer = 0;
    this.isNight = this.skyKey === 'night' || this.skyKey === 'deepnight';
    var r = Art.rng(451);
    this.clouds = [];
    for (var i = 0; i < 5; i++) {
      this.clouds.push({
        x: r() * (W + 120) - 60,
        y: 16 + r() * 66,
        w: 46 + r() * 54,
        h: 8 + r() * 8,
        speed: 1.4 + r() * 2.6,
        alpha: 0.22 + r() * 0.24
      });
    }
    this.particles.length = 0;
    this.leafTimer = 0;
    this.qiAcc = 0;
    Art.bakeSky(this.skyKey);
  };

  Scene.setSky = function (key) {
    if (!CFG.SKY[key] || key === this.skyKey) return;
    this.prevSky = this.skyKey;
    this.skyKey = key;
    this.skyMix = 0;
    this.isNight = key === 'night' || key === 'deepnight';
    Art.bakeSky(key);
  };

  Scene.nearest = function (player) {
    if (player.state === 'sit') {
      return { type: 'cushion', dist: 0 };
    }
    var best = null;
    for (var s = 0; s < this.seats.length; s++) {
      if (SS.Net && SS.Net.seatTaken(s)) continue;
      var seat = this.seats[s];
      var d = Math.hypot(player.x - seat.x, player.y - (seat.y + 10));
      if (d < 30 && (!best || d < best.dist)) {
        best = { type: 'cushion', seat: s, dist: d };
      }
    }

    for (var i = 0; i < this.herbs.length; i++) {
      var hs = SS.Game && SS.Game.state && SS.Game.state.herbs[i];
      if (hs && hs.taken) continue;
      var h = this.herbs[i];
      var hd = Math.hypot(player.x - h.x, player.y - (h.y - 4));
      if (hd < 26 && (!best || hd < best.dist)) {
        best = { type: 'herb', index: i, dist: hd };
      }
    }
    var nd = Math.hypot(player.x - this.npc.x, player.y - (this.npc.y - 6));
    if (nd < 30 && (!best || nd < best.dist)) {
      best = { type: 'npc', dist: nd };
    }
    return best;
  };

  Scene.seatNear = function (player) {
    var best = -1;
    var bd = 32;
    for (var s = 0; s < this.seats.length; s++) {
      var seat = this.seats[s];
      var d = Math.hypot(player.x - seat.x, player.y - (seat.y + 10));
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };

  Scene.burst = function (bx, by) {
    var cx = typeof bx === 'number' ? bx : 240;
    var cy = typeof by === 'number' ? by : 232;
    var r = Art.rng(Date.now() & 0xffff);
    for (var i = 0; i < 3; i++) {
      this.particles.push({
        type: 'ring', x: cx, y: cy, r: 10 + i * 8, vr: 54 + i * 10,
        life: 1.1 + i * 0.15, maxLife: 1.1 + i * 0.15, color: P.paper
      });
    }
    for (var s = 0; s < 36; s++) {
      var ang = r() * Math.PI * 2;
      var sp = 20 + r() * 46;
      this.particles.push({
        type: 'spark',
        x: cx + (r() - 0.5) * 20,
        y: cy + (r() - 0.5) * 8,
        vx: Math.cos(ang) * sp,
        vy: -18 - r() * 40,
        life: 0.8 + r() * 0.8,
        maxLife: 1.6,
        color: r() > 0.4 ? P.lamp : P.paper
      });
    }
  };

  Scene.update = function (dt, game) {
    var i, p;
    this.skyMix = Math.min(1, this.skyMix + dt / 1.5);

    // 天色跟随本机时间
    this.todTimer -= dt;
    if (this.todTimer <= 0) {
      this.todTimer = 5;
      this.setSky(todKey(new Date()));
    }

    for (i = 0; i < this.clouds.length; i++) {
      var cl = this.clouds[i];
      cl.x += cl.speed * dt;
      if (cl.x > W + 80) {
        cl.x = -90;
        cl.y = 14 + Math.random() * 68;
      }
    }

    // 落叶 / 花瓣
    this.leafTimer -= dt;
    if (this.leafTimer <= 0) {
      var windy = this.skyKey === 'dawn' || this.skyKey === 'dusk';
      this.leafTimer = (windy ? 0.28 : 0.5) + Math.random() * 0.6;
      if (this.particles.length < 110) {
        var pal = LEAF_PAL[this.skyKey] || LEAF_PAL.morning;
        this.particles.push({
          type: 'leaf',
          x: Math.random() * (W + 60) - 20,
          y: -14 - Math.random() * 30,
          vx: (windy ? 5 : 2) + Math.random() * 6,
          vy: 9 + Math.random() * 11,
          rot: Math.random() * 6.28,
          vr: (Math.random() - 0.5) * 3.4,
          sway: Math.random() * 6.28,
          swaySp: 1.1 + Math.random() * 1.8,
          size: 0.7 + Math.random() * 0.6,
          life: 16,
          maxLife: 16,
          color: pal[Math.floor(Math.random() * pal.length)]
        });
      }
    }

    // 夜间流萤
    if (this.isNight) {
      this.flyTimer -= dt;
      if (this.flyTimer <= 0) {
        this.flyTimer = 1.2 + Math.random() * 2;
        var flies = 0;
        for (i = 0; i < this.particles.length; i++) {
          if (this.particles[i].type === 'fly') flies++;
        }
        if (flies < 10) {
          this.particles.push({
            type: 'fly',
            x: 40 + Math.random() * 400,
            y: 196 + Math.random() * 46,
            vx: (Math.random() - 0.5) * 9,
            vy: (Math.random() - 0.6) * 6,
            phase: Math.random() * 6.28,
            life: 5 + Math.random() * 5,
            maxLife: 10,
            color: '#e8dca0'
          });
        }
      }
    }

    // 水墨雾团（缓慢飘移的淡墨云）
    this.mistTimer -= dt;
    if (this.mistTimer <= 0) {
      this.mistTimer = 3 + Math.random() * 4;
      var mistCount = 0;
      for (i = 0; i < this.particles.length; i++) {
        if (this.particles[i].type === 'mist') mistCount++;
      }
      if (mistCount < 6) {
        var fromLeft = Math.random() > 0.5;
        this.particles.push({
          type: 'mist',
          x: fromLeft ? -60 : W + 60,
          y: 100 + Math.random() * 70,
          vx: (fromLeft ? 1 : -1) * (4 + Math.random() * 6),
          vy: -0.3 + Math.random() * 0.6,
          rx: 28 + Math.random() * 22,
          ry: 8 + Math.random() * 6,
          phase: Math.random() * 6.28,
          life: 18 + Math.random() * 10,
          maxLife: 28,
          color: this.isNight ? P.ink4 : P.ink5
        });
      }
    }

    // 墨点扩散（偶尔在地面产生渗化墨团）
    this.splashTimer -= dt;
    if (this.splashTimer <= 0) {
      this.splashTimer = 10 + Math.random() * 12;
      if (this.particles.length < 120) {
        this.particles.push({
          type: 'splash',
          x: 60 + Math.random() * 360,
          y: 210 + Math.random() * 40,
          r: 2,
          maxR: 14 + Math.random() * 10,
          life: 4,
          maxLife: 4,
          color: Math.random() > 0.7 ? P.cinnabar : P.ink4
        });
      }
    }

    // 院中仙鹿
    this.updateDeer(dt);

    // qi particles while meditating
    if (game.isSitting()) {
      var realm = CFG.REALMS[game.state.realm];
      var spawnRate = 5 + game.state.realm * 2;
      this.qiAcc += spawnRate * dt;
      while (this.qiAcc >= 1) {
        this.qiAcc -= 1;
        this.particles.push({
          type: 'qi',
          x: game.playerX + (Math.random() - 0.5) * 22,
          y: game.playerY - 4 - Math.random() * 12,
          vx: (Math.random() - 0.5) * 7,
          vy: -9 - Math.random() * 15,
          life: 0.9 + Math.random() * 0.9,
          maxLife: 1.8,
          size: Math.random() > 0.82 ? 2 : 1,
          color: realm.aura
        });
      }
    } else {
      this.qiAcc = 0;
    }

    // 古书周围浮起的细碎灵光
    if (SS.Game && SS.Game.book && Math.random() < dt * 2.5) {
      this.particles.push({
        type: 'spark',
        x: SS.Game.book.x + (Math.random() - 0.5) * 16,
        y: SS.Game.book.y - 6 - Math.random() * 8,
        vx: (Math.random() - 0.5) * 6,
        vy: -6 - Math.random() * 6,
        life: 0.8,
        maxLife: 0.8,
        color: P.gold
      });
    }

    // faint qi from fellow cultivators online
    this.mateTimer -= dt;
    if (this.mateTimer <= 0) {
      this.mateTimer = 1.2 + Math.random() * 1.8;
      var sitters = [];
      if (SS.Net) {
        for (var n = 0; n < SS.Net.players.length; n++) {
          if (SS.Net.players[n].state === 'sit') sitters.push(SS.Net.players[n]);
        }
      }
      if (sitters.length && this.particles.length < 90) {
        var m = sitters[Math.floor(Math.random() * sitters.length)];
        this.particles.push({
          type: 'qi',
          x: m.sx + (Math.random() - 0.5) * 14,
          y: m.sy - 14 - Math.random() * 8,
          vx: (Math.random() - 0.5) * 4,
          vy: -6 - Math.random() * 8,
          life: 1.2 + Math.random() * 0.8,
          maxLife: 2,
          size: 1,
          color: '#e6e0cf'
        });
      }
    }

    for (i = this.particles.length - 1; i >= 0; i--) {
      p = this.particles[i];
      p.life -= dt;
      if (p.type === 'leaf') {
        p.x += (p.vx + Math.sin(p.sway) * 12) * dt;
        p.y += p.vy * dt;
        p.sway += p.swaySp * dt;
        p.rot += p.vr * dt;
        p.vy = Math.min(p.vy + 1.4 * dt, 24);
        if (p.x > W + 26) p.x = -18;
      } else if (p.type === 'fly') {
        p.phase += 1.6 * dt;
        p.x += (p.vx + Math.sin(p.phase) * 6) * dt;
        p.y += (p.vy + Math.cos(p.phase * 0.8) * 5) * dt;
      } else if (p.type === 'mist') {
        p.phase += 0.3 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt + Math.sin(p.phase) * 0.3;
      } else if (p.type === 'splash') {
        var t2 = 1 - p.life / p.maxLife;
        p.r = 2 + (p.maxR - 2) * (1 - Math.pow(1 - t2, 2));
      } else if (p.type === 'qi') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 0.985;
      } else if (p.type === 'spark') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 46 * dt;
      } else if (p.type === 'ring') {
        p.r += p.vr * dt;
      }
      if (p.life <= 0 || p.y > 292) this.particles.splice(i, 1);
    }
  };

  function drawCloud(g, cl, color) {
    var w = cl.w, h = cl.h;
    // 水墨云：多层淡墨叠加
    g.globalAlpha = cl.alpha * 0.4;
    g.fillStyle = color;
    g.beginPath();
    g.ellipse(cl.x, cl.y, w * 0.55, h * 0.55, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = cl.alpha * 0.6;
    g.beginPath();
    g.ellipse(cl.x - w * 0.26, cl.y + h * 0.08, w * 0.3, h * 0.4, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(cl.x + w * 0.27, cl.y + h * 0.04, w * 0.28, h * 0.42, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = cl.alpha * 0.3;
    g.fillStyle = P.paperL;
    g.beginPath();
    g.ellipse(cl.x - 2, cl.y - h * 0.22, w * 0.32, h * 0.22, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }

  function roundPath(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // 头顶对话气泡（宣纸底 + 墨字）
  function drawBubble(ctx, text, x, y) {
    if (!text) return;
    ctx.save();
    ctx.font = '7px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    var t = text.length > 14 ? text.slice(0, 13) + '…' : text;
    var w = Math.min(108, Math.max(20, ctx.measureText(t).width + 11));
    var h = 13;
    var bx = Math.max(2, Math.min(478 - w, Math.round(x - w / 2)));
    var by = Math.round(y - h);

    ctx.globalAlpha = 0.13;
    ctx.fillStyle = P.ink;
    roundPath(ctx, bx + 0.5, by + 1.2, w, h, 4);
    ctx.fill();

    ctx.globalAlpha = 0.97;
    ctx.fillStyle = P.paperL;
    roundPath(ctx, bx, by, w, h, 4);
    ctx.fill();
    ctx.globalAlpha = 0.6;
    ctx.strokeStyle = P.ink4;
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.globalAlpha = 0.97;
    ctx.fillStyle = P.paperL;
    ctx.beginPath();
    ctx.moveTo(x - 2.4, by + h - 0.4);
    ctx.lineTo(x, by + h + 3);
    ctx.lineTo(x + 2.4, by + h - 0.4);
    ctx.closePath();
    ctx.fill();

    ctx.globalAlpha = 1;
    ctx.fillStyle = P.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, bx + w / 2, by + h / 2 + 0.5);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.restore();
  }

  // 落在地上的古书：小小一本，悬着，带光
  function drawBook(ctx, b, t) {
    var bob = Math.sin(t * 2.4) * 1.4;
    var y = b.y - 7 + bob;

    var glow = ctx.createRadialGradient(b.x, y, 1, b.x, y, 20);
    glow.addColorStop(0, 'rgba(200,168,80,0.30)');
    glow.addColorStop(0.6, 'rgba(200,168,80,0.10)');
    glow.addColorStop(1, 'rgba(200,168,80,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(b.x - 22, y - 22, 44, 44);

    ctx.globalAlpha = 0.2;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(b.x, b.y + 1, 8, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.translate(b.x, y);
    ctx.rotate(-0.14);
    // 纸页
    ctx.fillStyle = P.paperL;
    ctx.fillRect(-7, -5, 14, 10);
    // 封面边
    ctx.fillStyle = '#7a6a52';
    ctx.fillRect(-7, -5, 14, 2.2);
    ctx.fillRect(-7, -5, 2.6, 10);
    // 页线
    ctx.strokeStyle = 'rgba(90,85,80,0.45)';
    ctx.lineWidth = 0.4;
    for (var i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-3, -1.6 + i * 2.2);
      ctx.lineTo(5.4, -1.6 + i * 2.2);
      ctx.stroke();
    }
    // 朱印
    ctx.fillStyle = P.cinnabar;
    ctx.fillRect(3.4, 1.8, 2.2, 2.2);
    // 金边（稀有）
    if (b.rare) {
      ctx.strokeStyle = 'rgba(200,168,80,0.9)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(-7, -5, 14, 10);
    }
    ctx.restore();
  }

  function drawNameTag(ctx, text, x, y) {
    if (!text) return;
    ctx.font = '7px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(244,239,230,0.92)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = 'rgba(42,40,38,0.92)';
    ctx.fillText(text, x, y);
    ctx.lineWidth = 1;
    ctx.textAlign = 'left';
  }

  /* ---------------- 场景陈设：石狮、菊花、仙鹿 ---------------- */

  function drawLion(ctx, x, y, dir) {
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(x, y, 7, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 须弥座
    ctx.fillStyle = P.stoneD;
    ctx.fillRect(x - 5.5, y - 5, 11, 5);
    ctx.fillStyle = P.stone;
    ctx.fillRect(x - 4.5, y - 8, 9, 3.5);

    // 狮身
    ctx.fillStyle = P.stoneL;
    ctx.beginPath();
    ctx.ellipse(x, y - 12, 4.6, 4.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 鬃毛
    ctx.strokeStyle = 'rgba(120,112,96,0.8)';
    ctx.lineWidth = 0.5;
    for (var i = 0; i < 6; i++) {
      var a = -0.9 + i * 0.36;
      ctx.beginPath();
      ctx.arc(x, y - 14, 4.2, a, a + 0.24);
      ctx.stroke();
    }

    // 头、耳、眼
    ctx.fillStyle = '#e2dac8';
    ctx.beginPath();
    ctx.arc(x + dir * 1.6, y - 16, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.stone;
    ctx.beginPath();
    ctx.arc(x + dir * 3.6, y - 18, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = P.ink3;
    ctx.beginPath();
    ctx.arc(x + dir * 2.4, y - 16.4, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // 前爪
    ctx.fillStyle = '#e2dac8';
    ctx.beginPath();
    ctx.ellipse(x + dir * 3.2, y - 9, 1.8, 1, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBloom(ctx, x, y, s, color, sway) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);

    // 叶
    ctx.fillStyle = P.moss;
    ctx.beginPath();
    ctx.ellipse(-2.4 * s, 1.2 * s, 2.6 * s, 1 * s, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(2.2 * s, 1.6 * s, 2.2 * s, 0.9 * s, 0.4, 0, Math.PI * 2);
    ctx.fill();

    // 花瓣
    for (var i = 0; i < 9; i++) {
      var a = i * Math.PI * 2 / 9 + sway;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(a) * 2.2 * s, Math.sin(a) * 1.6 * s - 1.8 * s,
        1.5 * s, 0.75 * s, a, 0, Math.PI * 2
      );
      ctx.fill();
    }

    // 花心
    ctx.fillStyle = '#b89040';
    ctx.beginPath();
    ctx.arc(0, -1.8 * s, 1.05 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  var FLOWER_BEDS = [
    { x: 26, y: 266, s: 1.0, c: '#e8c860' },
    { x: 42, y: 269, s: 0.82, c: '#b04a3a' },
    { x: 84, y: 267, s: 0.92, c: '#f0d878' },
    { x: 402, y: 268, s: 1.0, c: '#e8c860' },
    { x: 420, y: 264, s: 0.8, c: '#b04a3a' },
    { x: 454, y: 268, s: 0.9, c: '#f0d878' }
  ];

  function drawFlowers(ctx, t) {
    for (var i = 0; i < FLOWER_BEDS.length; i++) {
      var b = FLOWER_BEDS[i];
      drawBloom(ctx, b.x, b.y, b.s, b.c, Math.sin(t * 1.2 + b.x * 0.05) * 0.09);
    }
  }

  function drawDeer(ctx, d, t) {
    var step = d.moving ? Math.sin(t * 7) : 0;
    ctx.save();
    ctx.translate(d.x, d.y);
    if (d.dir < 0) ctx.scale(-1, 1);

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(0, 1, 13, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 腿
    ctx.strokeStyle = '#a08a70';
    ctx.lineWidth = 1.1;
    var legs = [6, 3, -3.5, -6.5];
    for (var i = 0; i < legs.length; i++) {
      var ph = step * (i % 2 ? 1 : -1) * 1.6;
      ctx.beginPath();
      ctx.moveTo(legs[i], -8);
      ctx.lineTo(legs[i] + ph, -1);
      ctx.stroke();
    }

    // 身体
    ctx.fillStyle = '#e6d8bc';
    ctx.beginPath();
    ctx.ellipse(0, -10, 9.6, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f2e9d4';
    ctx.beginPath();
    ctx.ellipse(0, -8, 7.6, 2.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // 梅花斑
    ctx.fillStyle = '#fffaf0';
    for (var s = 0; s < 5; s++) {
      ctx.beginPath();
      ctx.arc(-5 + s * 2.6, -12.4 + (s % 2) * 1.2, 0.7, 0, Math.PI * 2);
      ctx.fill();
    }

    // 颈
    ctx.fillStyle = '#e6d8bc';
    ctx.beginPath();
    ctx.moveTo(6.4, -12);
    ctx.quadraticCurveTo(9.4, -17, 10.4, -20);
    ctx.lineTo(13, -19);
    ctx.quadraticCurveTo(11.4, -14, 9.6, -9.6);
    ctx.closePath();
    ctx.fill();

    // 头与吻
    ctx.beginPath();
    ctx.ellipse(11.8, -21, 3.1, 2.2, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14.4, -20.4, 1.9, 1.3, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // 耳
    ctx.beginPath();
    ctx.ellipse(10.9, -23.6, 1.5, 0.7, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // 角
    ctx.strokeStyle = '#b09a78';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(11.2, -23);
    ctx.lineTo(10.6, -26);
    ctx.moveTo(10.9, -25);
    ctx.lineTo(9.6, -26.4);
    ctx.moveTo(11.2, -24.6);
    ctx.lineTo(12.4, -26);
    ctx.stroke();

    // 眼与鼻
    ctx.fillStyle = '#3a3228';
    ctx.beginPath();
    ctx.arc(12.8, -21.4, 0.55, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15.6, -20.2, 0.45, 0, Math.PI * 2);
    ctx.fill();

    // 尾
    ctx.fillStyle = '#f2e9d4';
    ctx.beginPath();
    ctx.ellipse(-9.4, -13, 1.6, 1.1, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  Scene.updateDeer = function (dt) {
    var d = this.deer;
    if (!d) return;

    d.timer -= dt;
    if (d.timer <= 0) {
      d.timer = 2.5 + Math.random() * 3.5;
      d.moving = Math.random() > 0.35;
      d.dir = Math.random() > 0.5 ? 1 : -1;
    }

    var px = SS.Player ? SS.Player.x : -999;
    var py = SS.Player ? SS.Player.y : -999;
    var dx = d.x - px, dy = d.y - py;
    if (dx * dx + dy * dy < 34 * 34) {
      d.dir = dx > 0 ? 1 : -1;
      d.moving = true;
      d.timer = Math.max(d.timer, 1.2);
    }

    if (d.moving) {
      d.x += d.dir * 13 * dt;
      if (d.x < 44) { d.x = 44; d.dir = 1; }
      if (d.x > 436) { d.x = 436; d.dir = -1; }
    }
  };

  /* ---------------- 镇山炉与隐藏剧情红光 ---------------- */

  function drawAltar(ctx, game, t) {
    var x = 240, y = 208;
    var broken = game.state.altarBroken;
    var maxed = game.atMax && game.atMax();

    ctx.globalAlpha = 0.16;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(x, y + 1, 14, 3.4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (!broken) {
      ctx.fillStyle = P.stoneD;
      ctx.fillRect(x - 13, y - 4, 26, 5);
      ctx.fillStyle = P.stone;
      ctx.fillRect(x - 11, y - 7, 22, 4);

      var bronze = ctx.createLinearGradient(x - 9, 0, x + 9, 0);
      bronze.addColorStop(0, '#b8a06a');
      bronze.addColorStop(0.45, '#8a7348');
      bronze.addColorStop(1, '#5a4a30');
      ctx.fillStyle = bronze;
      ctx.beginPath();
      ctx.moveTo(x - 9, y - 16);
      ctx.quadraticCurveTo(x - 10, y - 9, x - 6, y - 8);
      ctx.lineTo(x + 6, y - 8);
      ctx.quadraticCurveTo(x + 10, y - 9, x + 9, y - 16);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#c9b078';
      ctx.beginPath();
      ctx.ellipse(x, y - 16, 9, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a3024';
      ctx.beginPath();
      ctx.ellipse(x, y - 16, 7.2, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#7a6440';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(x - 10, y - 17, 3.4, Math.PI * 0.4, Math.PI * 1.4);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + 10, y - 17, 3.4, Math.PI * 1.6, Math.PI * 2.6);
      ctx.stroke();

      ctx.strokeStyle = '#6a5638';
      ctx.lineWidth = 1.6;
      [-6, 0, 6].forEach(function (dx) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y - 9);
        ctx.lineTo(x + dx * 1.25, y - 3);
        ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(240,225,190,0.35)';
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      ctx.moveTo(x - 7, y - 12.5);
      ctx.lineTo(x + 7, y - 12.5);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(200,200,190,0.26)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - 18);
      for (var i = 1; i <= 4; i++) {
        ctx.lineTo(x + Math.sin(t * 1.1 + i) * (1.4 + i * 0.7), y - 18 - i * 4);
      }
      ctx.stroke();

      // 修为圆满后，炉中透出红光
      if (maxed) {
        ctx.globalAlpha = 0.32 + 0.16 * Math.sin(t * 3);
        ctx.fillStyle = '#c8322c';
        ctx.beginPath();
        ctx.ellipse(x, y - 13, 8, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    } else {
      ctx.fillStyle = P.stoneD;
      ctx.fillRect(x - 14, y - 4, 28, 5);
      ctx.fillStyle = '#7a6440';
      [[-10, 6], [3, 7], [11, 4]].forEach(function (p) {
        ctx.beginPath();
        ctx.moveTo(x + p[0], y);
        ctx.lineTo(x + p[0] + p[1] * 0.4, y - p[1]);
        ctx.lineTo(x + p[0] + p[1], y);
        ctx.closePath();
        ctx.fill();
      });
      ctx.fillStyle = 'rgba(60,54,46,0.5)';
      ctx.beginPath();
      ctx.ellipse(x, y - 2, 10, 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
      var glow = ctx.createRadialGradient(x, y - 6, 2, x, y - 6, 26);
      glow.addColorStop(0, 'rgba(230,60,50,' + (0.42 + 0.12 * Math.sin(t * 2.6)) + ')');
      glow.addColorStop(1, 'rgba(230,60,50,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(x - 30, y - 36, 60, 46);
    }
  }

  function drawRedBeam(ctx, game, t) {
    if (!game.state.altarBroken) return;
    var x = 240;
    var w = 26 + Math.sin(t * 2) * 3;

    var g = ctx.createLinearGradient(0, 0, 0, 210);
    g.addColorStop(0, 'rgba(220,50,44,0)');
    g.addColorStop(0.55, 'rgba(220,50,44,0.14)');
    g.addColorStop(1, 'rgba(240,70,55,0.4)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x - w, 0);
    ctx.lineTo(x + w, 0);
    ctx.lineTo(x + 8, 208);
    ctx.lineTo(x - 8, 208);
    ctx.closePath();
    ctx.fill();

    var core = ctx.createLinearGradient(0, 0, 0, 208);
    core.addColorStop(0, 'rgba(255,120,100,0)');
    core.addColorStop(0.7, 'rgba(255,120,100,0.18)');
    core.addColorStop(1, 'rgba(255,170,140,0.38)');
    ctx.fillStyle = core;
    ctx.fillRect(x - 3.5, 0, 7, 208);

    ctx.fillStyle = '#e86a5a';
    for (var i = 0; i < 10; i++) {
      var my = 208 - ((t * 22 + i * 27) % 208);
      var mx = x + Math.sin(t * 1.3 + i) * (10 + i * 1.6);
      ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 2 + i);
      ctx.beginPath();
      ctx.arc(mx, my, 1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  /* ---------------- 山上小店：义桥义起奔富 ---------------- */

  function drawShopStall(ctx, game, t) {
    var x0 = 396, x1 = 462, base = 204;

    ctx.globalAlpha = 0.14;
    ctx.fillStyle = P.ink;
    ctx.beginPath();
    ctx.ellipse(429, base, 34, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 木构铺面
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(x0, base - 34, 66, 34);
    ctx.fillStyle = '#7d6144';
    ctx.fillRect(x0 + 2, base - 32, 62, 32);

    // 货架隔板与陶罐
    ctx.strokeStyle = 'rgba(60,44,28,0.55)';
    ctx.lineWidth = 0.8;
    for (var r = 0; r < 2; r++) {
      var yy = base - 28 + r * 8;
      ctx.beginPath();
      ctx.moveTo(x0 + 4, yy);
      ctx.lineTo(x1 - 4, yy);
      ctx.stroke();
    }
    for (var i = 0; i < 6; i++) {
      var jx = x0 + 9 + (i % 3) * 18;
      var jy = base - 25 + Math.floor(i / 3) * 8;
      ctx.fillStyle = i % 2 ? '#b8a078' : '#a89068';
      ctx.beginPath();
      ctx.ellipse(jx, jy, 2.6, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 柜台
    ctx.fillStyle = '#8a6b4a';
    ctx.fillRect(x0 - 2, base - 12, 70, 6);
    ctx.fillStyle = 'rgba(60,44,28,0.25)';
    ctx.fillRect(x0 - 2, base - 6, 70, 2);

    // 布棚
    ctx.fillStyle = '#c9b088';
    ctx.beginPath();
    ctx.moveTo(x0 - 4, base - 40);
    ctx.quadraticCurveTo(429, base - 52, x1 + 4, base - 40);
    ctx.lineTo(x1 + 2, base - 34);
    ctx.quadraticCurveTo(429, base - 44, x0 - 2, base - 34);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#b89a72';
    for (var k = 0; k < 7; k++) {
      ctx.beginPath();
      ctx.arc(x0 + 3 + k * 10, base - 34, 2.4, 0, Math.PI);
      ctx.fill();
    }

    // 匾额
    ctx.fillStyle = '#3a3226';
    ctx.fillRect(x0 + 2, base - 62, 62, 12);
    ctx.fillStyle = '#e8d8b0';
    ctx.font = '5.5px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = 'center';
    ctx.fillText(CFG.SHOP.name, 429, base - 53.5);

    // 店灯笼
    ctx.fillStyle = '#b85048';
    ctx.beginPath();
    ctx.ellipse(x1 - 6, base - 25, 3.4, 4.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e0b060';
    ctx.fillRect(x1 - 7, base - 21, 2, 3.5);

    // 店主
    ctx.fillStyle = '#4a5a66';
    ctx.beginPath();
    ctx.ellipse(429, base - 19, 5.2, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d4bc';
    ctx.beginPath();
    ctx.arc(429, base - 27, 3.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2a2a';
    ctx.beginPath();
    ctx.arc(429, base - 30, 2, 0, Math.PI * 2);
    ctx.fill();

    // 靠近时暖光提示
    if (game.shopNear && game.shopNear()) {
      ctx.globalAlpha = 0.5 + 0.15 * Math.sin(t * 3);
      ctx.strokeStyle = 'rgba(224,176,96,0.9)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x0 - 1, base - 63, 68, 63);
      ctx.globalAlpha = 1;
    }
  }

  function drawShopShelf(ctx, x, y, w, h) {
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(x, y, w, 4);
    ctx.fillRect(x, y + h, w, 4);
    ctx.fillRect(x, y, 4, h);
    ctx.fillRect(x + w - 4, y, 4, h);

    for (var r = 1; r < 3; r++) {
      var yy = y + r * (h / 3);
      ctx.fillStyle = '#7d6144';
      ctx.fillRect(x + 2, yy, w - 4, 3);
      for (var i = 0; i < 5; i++) {
        var jx = x + 15 + i * ((w - 30) / 4);
        ctx.fillStyle = i % 2 ? '#b8a078' : '#a89068';
        ctx.beginPath();
        ctx.ellipse(jx, yy - 6, 4, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#8a7350';
        ctx.fillRect(jx - 2, yy - 12, 4, 2);
      }
    }
  }

  Scene.drawShop = function (ctx, game, t) {
    // 暖木墙面
    var wall = ctx.createLinearGradient(0, 0, 0, 270);
    wall.addColorStop(0, '#efe4cc');
    wall.addColorStop(0.62, '#e2d3b4');
    wall.addColorStop(1, '#c6b28c');
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, 480, 270);

    // 梁柱
    ctx.fillStyle = '#5a4632';
    ctx.fillRect(0, 0, 480, 10);
    ctx.fillRect(0, 60, 480, 5);
    ctx.fillRect(64, 10, 6, 200);
    ctx.fillRect(410, 10, 6, 200);

    // 后墙货架
    drawShopShelf(ctx, 86, 78, 128, 96);
    drawShopShelf(ctx, 266, 78, 128, 96);

    // 匾额
    ctx.fillStyle = '#3a3226';
    ctx.fillRect(150, 24, 180, 26);
    ctx.fillStyle = '#f0dfb4';
    ctx.font = '14px "Songti SC","STSong","SimSun",serif';
    ctx.textAlign = 'center';
    ctx.fillText(CFG.SHOP.name, 240, 44);
    ctx.fillStyle = 'rgba(240,223,180,0.65)';
    ctx.font = '5px "Songti SC","STSong",serif';
    ctx.fillText('山 上 小 店 · 只 收 灵 石', 240, 56);

    // 吊灯
    [-138, 138].forEach(function (hx, idx) {
      ctx.strokeStyle = 'rgba(80,64,46,0.7)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(240 + hx, 10);
      ctx.lineTo(240 + hx, 52);
      ctx.stroke();
      ctx.fillStyle = idx ? '#b85048' : '#c07848';
      ctx.beginPath();
      ctx.ellipse(240 + hx, 58, 5, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(240,190,120,0.16)';
      ctx.beginPath();
      ctx.arc(240 + hx, 58, 22, 0, Math.PI * 2);
      ctx.fill();
    });

    // 柜台
    ctx.fillStyle = '#6a5138';
    ctx.fillRect(58, 196, 364, 52);
    ctx.fillStyle = '#7d6144';
    ctx.fillRect(56, 190, 368, 9);
    ctx.fillStyle = 'rgba(70,52,34,0.3)';
    for (var f = 0; f < 6; f++) {
      ctx.fillRect(66 + f * 58, 202, 2, 42);
    }

    // 柜上器物
    ctx.fillStyle = '#9c8460';
    ctx.beginPath();
    ctx.ellipse(150, 186, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a6446';
    ctx.fillRect(147, 178, 6, 3);
    ctx.beginPath();
    ctx.arc(150, 176, 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(316, 176, 26, 12);
    ctx.fillStyle = '#b8a078';
    for (var b = 0; b < 4; b++) {
      ctx.beginPath();
      ctx.arc(320 + b * 6, 180, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // 店主（柜台后，拱手）
    ctx.fillStyle = '#4a5a66';
    ctx.beginPath();
    ctx.ellipse(240, 168, 18, 24, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8d4bc';
    ctx.beginPath();
    ctx.arc(240, 142, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2a2826';
    ctx.beginPath();
    ctx.arc(240, 136, 8.4, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(240, 130, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3228';
    ctx.beginPath();
    ctx.arc(236.4, 143, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(243.6, 143, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(58,50,40,0.6)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.arc(240, 146, 4, 0.25, Math.PI - 0.25);
    ctx.stroke();

    // 地面木纹（近大远小的暗部）
    ctx.fillStyle = 'rgba(90,70,50,0.12)';
    ctx.beginPath();
    ctx.moveTo(0, 248);
    ctx.lineTo(480, 248);
    ctx.lineTo(480, 270);
    ctx.lineTo(0, 270);
    ctx.closePath();
    ctx.fill();

    // 浮尘
    ctx.fillStyle = '#f0dca8';
    for (var m = 0; m < 14; m++) {
      var mx = (m * 97 + t * 6) % 480;
      var my = 90 + ((m * 53 + t * 4) % 100);
      ctx.globalAlpha = 0.1 + 0.08 * Math.sin(t + m);
      ctx.beginPath();
      ctx.arc(mx, my, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  };

  Scene.draw = function (ctx, game, player, t) {
    if (game.mode === 'shop') {
      this.drawShop(ctx, game, t);
      return;
    }
    var sky = CFG.SKY[this.skyKey];

    // sky (with breakthrough cross-fade)
    if (this.prevSky && this.skyMix < 1) {
      ctx.drawImage(Art.bakeSky(this.prevSky), 0, 0, 480, 176);
      ctx.globalAlpha = this.skyMix;
      ctx.drawImage(Art.bakeSky(this.skyKey), 0, 0, 480, 176);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(Art.bakeSky(this.skyKey), 0, 0, 480, 176);
    }

    for (var i = 0; i < this.clouds.length; i++) {
      drawCloud(ctx, this.clouds[i], sky.cloud);
    }

    ctx.drawImage(this.ground, 0, 0, 480, 270);

    // 夜色：殿内窗火 + 月华
    if (this.isNight) {
      ctx.fillStyle = 'rgba(200,168,100,0.28)';
      var wins = [160, 192, 224, 256, 288];
      for (var wi = 0; wi < wins.length; wi++) {
        ctx.fillRect(wins[wi], 131, 26, 34);
      }
      ctx.fillRect(190, 104, 100, 5);

      var lg = ctx.createRadialGradient(240, 152, 8, 240, 152, 132);
      lg.addColorStop(0, 'rgba(200,168,100,0.14)');
      lg.addColorStop(1, 'rgba(200,168,100,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(108, 78, 264, 154);

      var mg = ctx.createLinearGradient(0, 188, 0, 270);
      mg.addColorStop(0, 'rgba(160,170,190,0)');
      mg.addColorStop(1, 'rgba(160,170,190,0.14)');
      ctx.fillStyle = mg;
      ctx.fillRect(0, 188, 480, 82);
    }

    // 庭院陈设：罗峰寺式石碑、殿前石狮、角落黄菊
    drawShopStall(ctx, game, t);
    drawLion(ctx, 214, 228, -1);
    drawLion(ctx, 266, 228, 1);
    drawFlowers(ctx, t);
    drawAltar(ctx, game, t);
    drawRedBeam(ctx, game, t);

    // 圣地灵气浮尘
    ctx.fillStyle = this.isNight ? '#c8d4e4' : '#e8d8a8';
    for (var m = 0; m < 16; m++) {
      var mx = (m * 89 + t * 7) % 480;
      var my = 200 + Math.sin(t * 0.4 + m) * 16 - ((t * 6 + m * 31) % 70);
      ctx.globalAlpha = 0.1 + 0.09 * Math.sin(t + m);
      ctx.beginPath();
      ctx.arc(mx, my, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // cushion glow while meditating
    if (game.isSitting()) {
      var realm = CFG.REALMS[game.state.realm];
      var pulse = 0.16 + 0.1 * Math.sin(t * 2.4);
      ctx.globalAlpha = pulse;
      ctx.fillStyle = realm.aura;
      ctx.beginPath();
      ctx.ellipse(player.x, player.y - 2, 26, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // depth-sorted entities
    var list = [];
    list.push({ y: this.npc.y, kind: 'npc' });
    if (SS.Net) {
      for (var r = 0; r < SS.Net.players.length; r++) {
        list.push({ y: SS.Net.players[r].sy, kind: 'remote', p: SS.Net.players[r] });
      }
    }
    for (var h = 0; h < this.herbs.length; h++) {
      list.push({ y: this.herbs[h].y, kind: 'herb', i: h });
    }
    if (game.book) list.push({ y: game.book.y, kind: 'book', b: game.book });
    if (this.deer) list.push({ y: this.deer.y, kind: 'deer' });
    list.push({ y: player.y, kind: 'player' });
    list.sort(function (a, b) { return a.y - b.y; });

    var set = Art.charSet();

    for (var n = 0; n < list.length; n++) {
      var it = list[n];
      if (it.kind === 'npc') {
        var nb = Math.round(Math.sin(t * 1.4) * 1);
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = P.ink;
        ctx.beginPath();
        ctx.ellipse(this.npc.x, this.npc.y + 1, 8, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.drawImage(set.down[0], this.npc.x - 10, this.npc.y - 28 + nb, 20, 28);
      } else if (it.kind === 'remote') {
        var rp = it.p;
        var rsit = rp.state === 'sit';
        var rb = Math.round(Math.sin(t * 1.7 + rp.sx * 0.1) * 1);
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = P.ink;
        ctx.beginPath();
        ctx.ellipse(rp.sx, rp.sy + 1, rsit ? 13 : 8, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (rsit) {
          var rrealm = CFG.REALMS[rp.realm] || CFG.REALMS[0];
          ctx.globalAlpha = 0.1 + 0.05 * Math.sin(t * 2 + rp.sx);
          ctx.fillStyle = rrealm.aura;
          ctx.beginPath();
          ctx.ellipse(rp.sx, rp.sy - 2, 20, 7, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.drawImage(set.sit, rp.sx - 12, rp.sy - 22 + rb, 24, 22);
        } else {
          ctx.drawImage(set.down[0], rp.sx - 10, rp.sy - 28, 20, 28);
        }
        var rNameY = rsit ? rp.sy - 30 : rp.sy - 38;
        drawNameTag(ctx, rp.name, rp.sx, rNameY);
        if (SS.Net) {
          var rBubble = SS.Net.bubbleFor(rp.id);
          if (rBubble) drawBubble(ctx, rBubble, rp.sx, rNameY - 6);
        }
      } else if (it.kind === 'book') {
        drawBook(ctx, it.b, t);
      } else if (it.kind === 'deer') {
        drawDeer(ctx, this.deer, t);
      } else if (it.kind === 'herb') {
        var herb = this.herbs[it.i];
        var st = game.state.herbs[it.i];
        if (!st || !st.taken) {
          var hf = this.herbFrames[Math.floor(t * 5) % 4];
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = P.ink3;
          ctx.beginPath();
          ctx.ellipse(herb.x, herb.y - 1, 5, 1.6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
          ctx.drawImage(hf, herb.x - 7, herb.y - 16, 14, 16);
        } else {
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = P.ochre;
          ctx.beginPath();
          ctx.ellipse(herb.x, herb.y - 1.4, 4.5, 1.2, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      } else {
        player.draw(ctx, game, t);
        var selfNameY = player.state === 'sit' ? player.y - 30 : player.y - 38;
        if (SS.Net) {
          drawNameTag(ctx, SS.Net.name, player.x, selfNameY);
          var selfBubble = SS.Net.bubbleFor(SS.Net.id);
          if (selfBubble) drawBubble(ctx, selfBubble, player.x, selfNameY - 6);
        }
      }
    }

    this.drawParticles(ctx);

    // breakthrough light column
    if (game.state.btT > 0) {
      var realm2 = CFG.REALMS[game.state.realm];
      var a = Math.min(1, game.state.btT / 1.1);
      var bx = game.playerX || 240;
      var by = game.playerY || 232;
      var grad = ctx.createLinearGradient(0, by - 150, 0, by + 12);
      grad.addColorStop(0, 'rgba(242,232,207,0)');
      grad.addColorStop(0.45, realm2.aura);
      grad.addColorStop(1, 'rgba(242,232,207,0)');
      ctx.globalAlpha = 0.28 * a;
      ctx.fillStyle = grad;
      ctx.fillRect(bx - 26, Math.max(0, by - 150), 52, 162);
      ctx.globalAlpha = 0.55 * a;
      ctx.fillStyle = P.paper;
      ctx.fillRect(bx - 2, Math.max(0, by - 140), 4, 152);
      ctx.globalAlpha = 1;
    }

    // tint + vignette
    ctx.fillStyle = sky.tint;
    ctx.fillRect(0, 0, 480, 270);
    ctx.drawImage(Art.vignette(), 0, 0, 480, 270);
  };

  Scene.drawParticles = function (ctx) {
    for (var i = 0; i < this.particles.length; i++) {
      var p = this.particles[i];
      var k = Math.max(0, Math.min(1, p.life / p.maxLife));
      if (p.type === 'ring') {
        ctx.globalAlpha = 0.5 * k;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r, p.r * 0.36, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === 'spark') {
        ctx.globalAlpha = k;
        Art.px(ctx, p.x, p.y, 1, 1, p.color);
      } else if (p.type === 'leaf') {
        ctx.globalAlpha = Math.min(1, k * 2.4) * 0.9;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 2.2 * p.size, 1.1 * p.size, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (p.type === 'fly') {
        var fk = 0.35 + 0.65 * Math.abs(Math.sin(p.phase * 1.3));
        ctx.globalAlpha = Math.min(1, k) * fk;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = Math.min(1, k) * fk * 0.28;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'mist') {
        // 水墨雾团：淡墨椭圆 + 中心稍浓
        ctx.globalAlpha = k * 0.18;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.rx * 1.2, p.ry * 1.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k * 0.12;
        ctx.beginPath();
        ctx.ellipse(p.x - p.rx * 0.3, p.y, p.rx * 0.7, p.ry * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'splash') {
        // 墨点渗化：外圈淡 + 内圈浓
        ctx.globalAlpha = k * 0.18;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 1.3, p.r * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = k * 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x, p.y, p.r * 0.7, p.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalAlpha = k;
        Art.px(ctx, p.x, p.y, p.size || 1, p.size || 1, p.color);
      }
    }
    ctx.globalAlpha = 1;
  };

  SS.Scene = Scene;
})(window.SS);
