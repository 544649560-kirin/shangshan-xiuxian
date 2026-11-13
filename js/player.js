window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var Art = SS.Art;

  var Player = {
    x: 0,
    y: 0,
    dir: 'down',
    state: 'idle',
    animT: 0,
    moving: false,
    seat: null
  };

  Player.init = function () {
    this.x = CFG.SCENE.spawn.x;
    this.y = CFG.SCENE.spawn.y;
    this.dir = 'down';
    this.state = 'idle';
    this.animT = 0;
    this.moving = false;
    this.seat = null;
  };

  Player.footBox = function (x, y) {
    return { x: x - 5, y: y - 8, w: 10, h: 8 };
  };

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  Player.hits = function (x, y, solids) {
    var box = this.footBox(x, y);
    for (var i = 0; i < solids.length; i++) {
      if (overlap(box, solids[i])) return true;
    }
    return false;
  };

  Player.update = function (dt, input, solids, bounds) {
    if (this.state === 'sit') {
      this.moving = false;
      return;
    }
    var ix = input.x;
    var iy = input.y;
    var len = Math.hypot(ix, iy);
    var moving = len > 0.08;
    this.moving = moving;

    if (moving) {
      if (len > 1) { ix /= len; iy /= len; }
      if (Math.abs(ix) > Math.abs(iy)) {
        this.dir = ix > 0 ? 'right' : 'left';
      } else if (iy !== 0) {
        this.dir = iy > 0 ? 'down' : 'up';
      }
      var nx = this.x + ix * CFG.SPEED * dt;
      if (!this.hits(nx, this.y, solids)) this.x = nx;
      var ny = this.y + iy * CFG.SPEED * dt;
      if (!this.hits(this.x, ny, solids)) this.y = ny;
      this.animT += dt;
    } else {
      this.animT = 0;
    }

    this.x = Math.max(bounds.x0, Math.min(bounds.x1, this.x));
    this.y = Math.max(bounds.y0, Math.min(bounds.y1, this.y));
  };

  Player.sit = function (seat) {
    this.state = 'sit';
    this.dir = 'down';
    this.moving = false;
    this.seat = seat;
    this.x = seat.x;
    this.y = seat.y;
  };

  Player.stand = function () {
    this.state = 'idle';
    this.y = (this.seat ? this.seat.y : this.y) + 10;
    this.moving = false;
    this.seat = null;
    if (SS.Net) SS.Net.releaseSeat();
  };

  Player.draw = function (ctx, game, t) {
    var set = Art.charSet();
    var bob = 0;

    ctx.globalAlpha = 0.28;
    ctx.fillStyle = Art.P.ink;
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 1, this.state === 'sit' ? 13 : 8, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    if (this.state === 'sit') {
      bob = Math.sin(t * 1.8) * 0.6;
      ctx.drawImage(set.sit, this.x - 12, this.y - 22 + bob, 24, 22);
    } else {
      var frame = this.moving ? 1 + Math.floor(this.animT / 0.18) % 2 : 0;
      var img = set[this.dir][frame];
      ctx.drawImage(img, this.x - 10, this.y - 28, 20, 28);
    }
  };

  SS.Player = Player;
})(window.SS);
