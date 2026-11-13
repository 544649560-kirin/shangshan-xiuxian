window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var Input = { keys: {}, joy: { x: 0, y: 0 } };
  SS.Input = Input;

  var canvas, ctx;
  var last = 0;
  var stepTimer = 0;

  function inputVec() {
    var x = 0, y = 0;
    if (Input.keys.ArrowLeft || Input.keys.KeyA) x -= 1;
    if (Input.keys.ArrowRight || Input.keys.KeyD) x += 1;
    if (Input.keys.ArrowUp || Input.keys.KeyW) y -= 1;
    if (Input.keys.ArrowDown || Input.keys.KeyS) y += 1;
    x += Input.joy.x;
    y += Input.joy.y;
    if (x > 1) x = 1;
    if (x < -1) x = -1;
    if (y > 1) y = 1;
    if (y < -1) y = -1;
    return { x: x, y: y };
  }

  function resize() {
    var s = Math.min(window.innerWidth / CFG.W, window.innerHeight / CFG.H);
    if (s >= 1) s = Math.floor(s);
    if (s <= 0) s = 0.5;
    canvas.style.width = Math.round(CFG.W * s) + 'px';
    canvas.style.height = Math.round(CFG.H * s) + 'px';
  }

  function update(dt) {
    if (SS.Intro && SS.Intro.active) {
      SS.Intro.update(dt);
      SS.Net.update(dt);
      return;
    }
    SS.Game.update(dt);

    var p = SS.Player;
    var canMove = SS.Game.mode === 'playing' && !SS.UI.dialogOpen && !SS.UI.isBookOpen() &&
      !SS.UI.isTyping() && SS.Game.state.btT <= 0;
    if (canMove) {
      p.update(dt, inputVec(), CFG.SCENE.solids, CFG.SCENE.bounds);
      if (p.moving) {
        stepTimer -= dt;
        if (stepTimer <= 0) {
          stepTimer = 0.34;
          SS.UI.sfx.step();
        }
      } else {
        stepTimer = 0;
      }
    }

    SS.Scene.update(dt, SS.Game);
    SS.Net.update(dt);
    SS.UI.tick(SS.Game);
  }

  function render(t) {
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, CFG.W, CFG.H);
    if (SS.Intro && SS.Intro.active) {
      SS.Intro.draw(ctx, t);
      return;
    }
    SS.Scene.draw(ctx, SS.Game, SS.Player, t);
  }

  function loop(ts) {
    requestAnimationFrame(loop);
    if (ts - last < 15) return;
    var dt = (ts - last) / 1000;
    last = ts;
    if (!isFinite(dt) || dt < 0) dt = 0;
    if (dt > 0.05) dt = 0.05;

    update(dt);
    render(ts / 1000);
  }

  function onKeyDown(e) {
    // 上山过场：方向键自己走，Esc 跳过
    if (SS.Intro && SS.Intro.active) {
      if (e.code === 'Escape') {
        e.preventDefault();
        SS.Intro.skip();
        return;
      }
      if (e.code.indexOf('Arrow') === 0) e.preventDefault();
      Input.keys[e.code] = true;
      return;
    }

    // 正在输入（聊天 / 改道号）时，不响应游戏按键
    if (SS.UI && SS.UI.isTyping && SS.UI.isTyping()) {
      if (e.code === 'Escape') {
        e.preventDefault();
        if (SS.UI.isRenaming()) SS.UI.closeRename();
        else SS.UI.closeChat();
      }
      return;
    }

    if (e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' ||
        e.code === 'ArrowRight' || e.code === 'Space') {
      e.preventDefault();
    }
    Input.keys[e.code] = true;
    if (e.repeat) return;

    if (e.code === 'KeyE' || e.code === 'Space' || e.code === 'Enter') {
      if (SS.Game.mode === 'playing') SS.Game.interact();
      else if (SS.Game.mode === 'hidden') SS.Game.closeHidden();
      else if (SS.Game.mode === 'title') SS.Game.start();
      else if (SS.Game.mode === 'offline') SS.Game.offlineDone();
      else if (SS.Game.mode === 'ending') SS.Game.closeEnding();
    } else if (e.code === 'KeyF') {
      if (SS.Game.mode === 'upgrade') SS.Game.closeUpgrade();
      else SS.Game.openUpgrade();
    } else if (e.code === 'KeyT') {
      if (SS.Game.mode === 'playing') SS.UI.openChat();
    } else if (e.code === 'KeyN') {
      if (SS.Game.mode === 'playing' || SS.Game.mode === 'paused') SS.UI.openRename();
    } else if (e.code === 'Escape') {
      if (SS.Game.mode === 'hidden') SS.Game.closeHidden();
      else if (SS.Game.mode === 'shop') SS.Game.closeShop();
      else if (SS.UI.isBookOpen()) SS.UI.closeBook();
      else if (SS.Game.mode === 'upgrade') SS.Game.closeUpgrade();
      else SS.Game.togglePause();
    }
  }

  function onKeyUp(e) {
    Input.keys[e.code] = false;
  }

  function bind() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('pointerdown', function () {
      if (SS.Intro && SS.Intro.active) SS.Intro.skip();
    });
    window.addEventListener('blur', function () {
      Input.keys = {};
      Input.joy.x = 0;
      Input.joy.y = 0;
    });
    window.addEventListener('resize', resize);
    window.addEventListener('pagehide', function () { SS.Net.leave(); SS.Game.save(); });
    window.addEventListener('beforeunload', function () { SS.Game.save(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        Input.keys = {};
        Input.joy.x = 0;
        Input.joy.y = 0;
        if (SS.Game.mode === 'playing') SS.Game.pause();
        SS.Game.save();
      }
    });
  }

  function boot() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    SS.Game.init();
    SS.Scene.init();
    SS.Player.init();
    SS.Net.init();
    SS.UI.init(SS.Game);

    bind();
    resize();

    // 主画面天色跟随本机时间
    SS.Scene.setSky(SS.Scene.todKey(new Date()));
    SS.Scene.prevSky = null;
    SS.Scene.skyMix = 1;

    last = performance.now();
    requestAnimationFrame(loop);
  }

  window.addEventListener('load', boot);
})(window.SS);
