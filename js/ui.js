window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;

  var $ = function (id) { return document.getElementById(id); };

  var UI = {
    dialogOpen: false,
    dialogFull: '',
    dialogShown: 0,
    dialogTimer: null,
    _tickAt: 0,
    _isTouch: false,
    _chatOpen: false,
    _renameOpen: false,
    _bookOpen: false,
    _unread: 0
  };

  /* ---------------- sound ---------------- */
  var actx = null;
  var muted = false;

  function ensureAudio() {
    if (!actx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        try { actx = new AC(); } catch (e) { actx = null; }
      }
    }
    if (actx && actx.state === 'suspended') {
      actx.resume().catch(function () {});
    }
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    ensureAudio();
    if (!actx) return;
    var t0 = actx.currentTime + (delay || 0);
    var o = actx.createOscillator();
    var g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(vol || 0.03, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(actx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  UI.sfx = {
    step: function () { tone(104, 0.05, 'square', 0.012); },
    pick: function () { tone(620, 0.1, 'triangle', 0.04, 940); },
    upgrade: function () { tone(520, 0.09, 'square', 0.03); tone(780, 0.12, 'triangle', 0.03, null, 0.09); },
    breakthrough: function () {
      tone(96, 0.9, 'sawtooth', 0.035, 60);
      tone(880, 0.55, 'sine', 0.04);
      tone(1320, 0.4, 'triangle', 0.025, null, 0.16);
    },
    page: function () { tone(300, 0.04, 'square', 0.018); },
    insight: function () { tone(740, 0.16, 'sine', 0.035, 1180); },
    chat: function () { tone(560, 0.07, 'sine', 0.022, 760); },
    book: function () {
      tone(760, 0.06, 'triangle', 0.026, 1080);
      tone(1180, 0.09, 'sine', 0.02, null, 0.06);
    }
  };

  UI.setMuted = function (v) {
    muted = !!v;
    var btn = $('btnSound');
    var pauseBtn = $('btnPauseSound');
    if (btn) btn.textContent = muted ? '静音' : '音效';
    if (pauseBtn) pauseBtn.textContent = muted ? '音效：关' : '音效：开';
  };

  UI.toggleMute = function () {
    SS.Game.setMuted(!muted);
    UI.setMuted(muted);
  };

  /* ---------------- basic UI ---------------- */
  UI.toast = function (text, cls) {
    var box = $('toasts');
    if (!box) return;
    var el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    box.appendChild(el);
    setTimeout(function () {
      el.classList.add('out');
      setTimeout(function () { el.remove(); }, 380);
    }, 2400);
  };

  UI.say = function (text) {
    var dlg = $('dialog');
    var txt = $('dialogText');
    UI.dialogOpen = true;
    UI.dialogFull = text;
    UI.dialogShown = 0;
    txt.textContent = '';
    dlg.classList.remove('hidden');
    if (UI.dialogTimer) clearInterval(UI.dialogTimer);
    UI.dialogTimer = setInterval(function () {
      UI.dialogShown += 1;
      txt.textContent = UI.dialogFull.slice(0, UI.dialogShown);
      if (UI.dialogShown >= UI.dialogFull.length) {
        clearInterval(UI.dialogTimer);
        UI.dialogTimer = null;
      }
    }, 26);
    UI.sfx.page();
  };

  UI.advanceDialog = function () {
    if (!UI.dialogOpen) return false;
    if (UI.dialogShown < UI.dialogFull.length) {
      UI.dialogShown = UI.dialogFull.length;
      $('dialogText').textContent = UI.dialogFull;
      if (UI.dialogTimer) { clearInterval(UI.dialogTimer); UI.dialogTimer = null; }
      return true;
    }
    UI.closeDialog();
    return true;
  };

  UI.closeDialog = function () {
    UI.dialogOpen = false;
    if (UI.dialogTimer) { clearInterval(UI.dialogTimer); UI.dialogTimer = null; }
    $('dialog').classList.add('hidden');
  };

  UI.setHudHidden = function (v) {
    var ui = $('ui');
    if (ui) ui.classList.toggle('ui-hidden', !!v);
  };

  UI.setMode = function (mode) {
    if (mode !== 'playing' && UI._chatOpen) UI.closeChat();
    if (mode !== 'playing' && UI._bookOpen) UI.closeBook();
    if (mode !== 'shop' && UI._shopOpen) UI.closeShop();
    if (mode !== 'hidden' && UI._hiddenOpen) UI.closeHidden();
    var screens = ['title', 'pause', 'upgrade', 'offline', 'ending'];
    var active = mode === 'paused' ? 'pause' : mode;
    for (var i = 0; i < screens.length; i++) {
      var el = $(screens[i]);
      if (el) el.classList.toggle('hidden', screens[i] !== active);
    }
    var ui = $('ui');
    var hideUi = mode === 'title' || mode === 'offline' || mode === 'ending';
    ui.classList.toggle('ui-hidden', hideUi);
  };

  UI.fade = function (cb) {
    var f = $('fade');
    f.classList.add('on');
    setTimeout(function () {
      if (cb) cb();
      setTimeout(function () { f.classList.remove('on'); }, 90);
    }, 420);
  };

  /* ---------------- chat ---------------- */
  function refreshBadge() {
    var el = $('chatBadge');
    if (!el) return;
    if (UI._unread > 0) {
      el.classList.remove('hidden');
      el.textContent = UI._unread > 9 ? '9+' : String(UI._unread);
    } else {
      el.classList.add('hidden');
    }
  }

  function appendChatLine(msg) {
    var log = $('chatLog');
    if (!log) return;
    var hint = log.querySelector('.chat-empty');
    if (hint) hint.remove();
    var row = document.createElement('div');
    row.className = 'chat-msg' + (SS.Net && msg.id === SS.Net.id ? ' self' : '');
    var who = document.createElement('b');
    who.textContent = (msg.name || '道友') + '：';
    row.appendChild(who);
    row.appendChild(document.createTextNode(msg.text));
    log.appendChild(row);
    while (log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  }

  UI.chatReceive = function (msg) {
    if (!msg) return;
    appendChatLine(msg);
    if (!UI._chatOpen) {
      UI._unread++;
      refreshBadge();
    }
    UI.sfx.chat();
  };

  UI.chatHistory = function (list) {
    if (!list || !list.length) return;
    for (var i = 0; i < list.length; i++) appendChatLine(list[i]);
  };

  UI.chatReset = function () {
    var log = $('chatLog');
    if (log) log.innerHTML = '<div class="chat-empty">同一殿的同修都能看到</div>';
    UI._unread = 0;
    refreshBadge();
  };

  UI.stopMoving = function () {
    if (!SS.Input) return;
    SS.Input.keys = {};
    SS.Input.joy.x = 0;
    SS.Input.joy.y = 0;
  };

  UI.openChat = function () {
    if (UI._chatOpen) return;
    UI.closeRename();
    UI.closeDialog();
    UI._chatOpen = true;
    UI._unread = 0;
    refreshBadge();
    UI.stopMoving();
    $('chat').classList.remove('hidden');
    var inp = $('chatInput');
    inp.value = '';
    setTimeout(function () { if (UI._chatOpen) inp.focus(); }, 0);
  };

  UI.closeChat = function () {
    if (!UI._chatOpen) return;
    UI._chatOpen = false;
    $('chat').classList.add('hidden');
    $('chatInput').blur();
  };

  UI.toggleChat = function () {
    if (UI._chatOpen) UI.closeChat();
    else UI.openChat();
  };

  UI.isChatOpen = function () { return UI._chatOpen; };
  UI.isRenaming = function () { return UI._renameOpen; };
  UI.isTyping = function () { return UI._chatOpen || UI._renameOpen; };

  /* ---------------- rename ---------------- */
  UI.openRename = function () {
    if (UI._renameOpen) return;
    UI.closeChat();
    UI._renameOpen = true;
    UI.stopMoving();
    $('renamePanel').classList.remove('hidden');
    var inp = $('renameInput');
    inp.value = (SS.Net && SS.Net.name) || '';
    setTimeout(function () {
      if (!UI._renameOpen) return;
      inp.focus();
      inp.select();
    }, 0);
  };

  UI.closeRename = function () {
    if (!UI._renameOpen) return;
    UI._renameOpen = false;
    $('renamePanel').classList.add('hidden');
    $('renameInput').blur();
  };

  /* ---------------- 奇遇古书 ---------------- */
  UI.isBookOpen = function () { return UI._bookOpen; };

  UI.showBook = function (book, gain) {
    UI._bookOpen = true;
    UI.stopMoving();
    $('bookTitle').textContent = '《' + book.title + '》';
    $('bookQuote').textContent = book.text;
    $('bookGain').textContent = '+' + gain;
    $('bookPanel').classList.toggle('rare', !!book.rare);
    $('bookTag').textContent = book.rare ? '稀 有 奇 遇' : '奇 遇';
    $('bookPanel').classList.remove('hidden');
    UI.sfx.book();
  };

  UI.closeBook = function () {
    if (!UI._bookOpen) return;
    UI._bookOpen = false;
    $('bookPanel').classList.add('hidden');
  };

  /* ---------------- 山上小店 ---------------- */
  UI.openShop = function (game) {
    UI._shopOpen = true;
    UI.stopMoving();
    UI.renderShop(game);
    $('shopPanel').classList.remove('hidden');
    UI.sfx.page();
  };

  UI.closeShop = function () {
    if (!UI._shopOpen) return;
    UI._shopOpen = false;
    $('shopPanel').classList.add('hidden');
  };

  /* ---------------- 隐藏剧情 · 红光 ---------------- */
  UI.showHidden = function () {
    UI._hiddenOpen = true;
    UI.stopMoving();
    var story = CFG.STORY.hidden;
    var html = '';
    for (var i = 0; i < story.lines.length; i++) {
      html += '<p>' + story.lines[i] + '</p>';
    }
    $('hiddenText').innerHTML = html;
    $('hiddenPanel').classList.remove('hidden');
  };

  UI.closeHidden = function () {
    if (!UI._hiddenOpen) return;
    UI._hiddenOpen = false;
    $('hiddenPanel').classList.add('hidden');
  };

  UI.renderShop = function (game) {
    $('shopStones').textContent = game.state.stones;
    var html = '';
    for (var i = 0; i < CFG.SHOP.items.length; i++) {
      var it = CFG.SHOP.items[i];
      var can = game.state.stones >= it.cost;
      html += '<div class="shop-row">' +
        '<div class="shop-info"><b>' + it.name + '</b>' +
        '<span class="shop-tag">' + (it.tag || (it.kind === 'buff' ? '时效' : '修为')) + '</span>' +
        '<div class="shop-desc">' + it.desc + '</div></div>' +
        '<button class="pixel-btn' + (can ? '' : ' is-off') + '" data-shop="' + it.id + '">' +
        it.cost + ' 灵石</button></div>';
    }
    $('shopList').innerHTML = html;
  };

  UI.submitRename = function () {
    var v = $('renameInput').value;
    if (!SS.Net || !SS.Net.setName(v)) {
      UI.toast('道号要有一两个字');
      return;
    }
    UI.toast('道号已定 · ' + SS.Net.name);
    UI.sfx.page();
    UI.closeRename();
  };

  /* ---------------- HUD ---------------- */
  function fmt(n) {
    return Math.floor(n).toLocaleString('en-US');
  }

  UI.tick = function (game) {
    var now = performance.now();
    if (now - UI._tickAt < 100) return;
    UI._tickAt = now;

    var st = game.state;
    var realm = CFG.REALMS[st.realm];
    var next = CFG.REALMS[st.realm + 1];
    var realmChip = $('realmChip');

    var nameChip = $('nameChip');
    if (nameChip && SS.Net && SS.Net.name && nameChip.textContent !== SS.Net.name) {
      nameChip.textContent = SS.Net.name;
    }

    realmChip.textContent = realm.name;
    realmChip.style.borderColor = realm.aura;
    realmChip.style.background = 'color-mix(in srgb, ' + realm.aura + ' 26%, #f4efe6)';
    realmChip.style.color = '#2a2826';

    var pct = 100;
    if (next) {
      pct = (st.cultivation - realm.need) / (next.need - realm.need) * 100;
      pct = Math.max(0, Math.min(100, pct));
    }
    $('qiBar').style.width = pct.toFixed(1) + '%';
    $('qiText').textContent = next ? (fmt(st.cultivation) + ' / ' + fmt(next.need)) : (fmt(st.cultivation) + ' · 圆满');
    $('rateChip').textContent = game.rate().toFixed(1) + '/s';
    $('stoneChip').textContent = '灵石 ' + st.stones;

    var timeChip = $('timeChip');
    if (timeChip && SS.Scene && SS.Scene.phaseName) {
      var now = new Date();
      var hh = ('0' + now.getHours()).slice(-2);
      var mm = ('0' + now.getMinutes()).slice(-2);
      var timeText = SS.Scene.phaseName() + ' · ' + hh + ':' + mm;
      if (timeChip.textContent !== timeText) timeChip.textContent = timeText;
    }

    var onlineChip = $('onlineChip');
    if (SS.Net && SS.Net.online) {
      onlineChip.classList.remove('hidden');
      var hallTag = SS.Net.hall >= 0 ? '第 ' + (SS.Net.hall + 1) + ' 殿 · ' : '';
      onlineChip.textContent = hallTag + '同修 ' + Math.max(1, SS.Net.onlineCount);
    } else {
      onlineChip.classList.add('hidden');
    }

    var queueChip = $('queueChip');
    if (SS.Net && SS.Net.queuePos > 0 && SS.Player.state !== 'sit') {
      queueChip.classList.remove('hidden');
      queueChip.textContent = '候坐 第 ' + SS.Net.queuePos + ' 位';
    } else {
      queueChip.classList.add('hidden');
    }

    var buff = $('buffChip');
    if (st.buffLeft > 0) {
      buff.classList.remove('hidden');
      buff.textContent = '灵气入体 ' + Math.ceil(st.buffLeft) + 's';
    } else {
      buff.classList.add('hidden');
    }

    $('objective').textContent = game.objective();

    var hint = '';
    if (game.mode === 'playing') {
      if (UI.dialogOpen) {
        hint = 'E 继续';
      } else if (game.bookNear && game.bookNear()) {
        hint = 'E 翻开《' + CFG.BOOKS[game.book.index].title + '》';
      } else if (game.canBreak()) {
        hint = 'E 冲击' + CFG.REALMS[st.realm + 1].name;
      } else if (SS.Net && SS.Net.queuePos > 0 && SS.Player.state !== 'sit') {
        hint = '候坐第 ' + SS.Net.queuePos + ' 位 · E 离开队列';
      } else if (SS.Player.state === 'sit') {
        hint = 'E 起身 · 打坐中 ' + game.rate().toFixed(1) + ' 修为/秒';
      } else {
        var near = SS.Scene.nearest(SS.Player);
        if (game.atMax && game.atMax() && game.altarNear() && !game.state.altarBroken) {
          hint = 'E 击碎镇山炉';
        } else if (game.shopNear && game.shopNear()) hint = 'E 进「' + CFG.SHOP.name + '」';
        else if (near && near.type === 'cushion') hint = 'E 打坐';
        else if (near && near.type === 'herb') hint = 'E 采灵草';
        else if (near && near.type === 'npc') hint = 'E 交谈';
        else if (SS.Scene.seatNear(SS.Player) >= 0) hint = 'E 候坐';
        else hint = UI._isTouch ? '摇杆走动 · E 交互' : 'WASD 走动 · E 交互';
      }
    }
    var hintEl = $('hint');
    hintEl.textContent = hint;
    hintEl.style.opacity = hint ? '1' : '0';
  };

  /* ---------------- upgrades ---------------- */
  UI.renderUpgrade = function (game) {
    $('upStone').textContent = game.state.stones;
    $('upRate').textContent = game.rate().toFixed(1) + '/s';
    var html = '';
    for (var i = 0; i < CFG.UPGRADES.length; i++) {
      var u = CFG.UPGRADES[i];
      var lv = game.state.upgrades[u.id] || 0;
      var maxed = lv >= u.max;
      var cost = maxed ? 0 : u.costs[lv];
      var can = !maxed && game.state.stones >= cost;
      var label = maxed ? '已至化境' : ('修习 · ' + cost + ' 灵石');
      html += '<div class="up-row">' +
        '<div class="up-info"><b>' + u.name + '</b><span class="up-lv">Lv.' + lv + ' / ' + u.max + '</span>' +
        '<div class="up-desc">' + u.desc + '</div></div>' +
        '<button class="pixel-btn" data-up="' + u.id + '"' + ((maxed || !can) ? ' disabled' : '') + '>' + label + '</button>' +
        '</div>';
    }
    $('upList').innerHTML = html;
  };

  UI.showOffline = function (info) {
    $('offTime').textContent = fmtDuration(info.seconds);
    $('offGain').textContent = '+' + fmt(info.gain);
    UI.setMode('offline');
  };

  UI.showEnding = function (game) {
    var st = game.state;
    var lines = CFG.TEXT.ending;
    $('endingText').innerHTML = lines.join('<br>');
    var total = (Date.now() - st.stats.startedAt) / 1000;
    $('endStats').innerHTML =
      '这一程 · 用时 ' + fmtDuration(total) +
      '<br>打坐 ' + fmtDuration(st.stats.sit) +
      ' · 灵草 ' + st.stats.herbs + ' 株' +
      ' · 古书 ' + (st.stats.books || 0) + ' 本' +
      ' · 顿悟 ' + st.stats.insight + ' 次' +
      '<br>突破 ' + st.stats.breakthroughs + ' 次 · 灵石 ' + st.stones;
    UI.setMode('ending');
  };

  function fmtDuration(sec) {
    sec = Math.max(0, Math.floor(sec));
    var h = Math.floor(sec / 3600);
    var m = Math.floor((sec % 3600) / 60);
    var s = sec % 60;
    if (h > 0) return h + ' 小时 ' + m + ' 分';
    if (m > 0) return m + ' 分 ' + s + ' 秒';
    return s + ' 秒';
  }

  /* ---------------- touch ---------------- */
  function bindStick() {
    var stick = $('stick');
    var knob = $('knob');
    var active = false;
    var pid = null;

    function setKnob(dx, dy) {
      knob.style.transform = 'translate(calc(-50% + ' + dx + 'px), calc(-50% + ' + dy + 'px))';
    }

    function move(e) {
      var r = stick.getBoundingClientRect();
      var dx = e.clientX - (r.left + r.width / 2);
      var dy = e.clientY - (r.top + r.height / 2);
      var max = Math.max(20, r.width / 2 - 20);
      var len = Math.hypot(dx, dy);
      if (len > max) { dx = dx / len * max; dy = dy / len * max; }
      setKnob(dx, dy);
      if (len < 7) {
        SS.Input.joy.x = 0;
        SS.Input.joy.y = 0;
      } else {
        SS.Input.joy.x = dx / max;
        SS.Input.joy.y = dy / max;
      }
    }

    stick.addEventListener('pointerdown', function (e) {
      active = true;
      pid = e.pointerId;
      stick.setPointerCapture(pid);
      move(e);
      e.preventDefault();
    });
    stick.addEventListener('pointermove', function (e) {
      if (!active || e.pointerId !== pid) return;
      move(e);
      e.preventDefault();
    });
    function end(e) {
      if (pid !== null && e.pointerId !== pid) return;
      active = false;
      pid = null;
      SS.Input.joy.x = 0;
      SS.Input.joy.y = 0;
      setKnob(0, 0);
    }
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
  }

  /* ---------------- init ---------------- */
  UI.init = function (game) {
    UI._isTouch = (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window);
    if (UI._isTouch) document.body.classList.add('touch');
    $('touch').classList.remove('hidden');
    UI.setMuted(game.state.muted);

    $('btnStart').addEventListener('click', function () {
      ensureAudio();
      game.start();
    });
    $('btnResume').addEventListener('click', function () { game.resume(); });
    $('btnPauseUpgrade').addEventListener('click', function () { game.openUpgrade(); });
    $('btnPauseSound').addEventListener('click', function () { UI.toggleMute(); });
    $('btnRestart').addEventListener('click', function () { game.restart(); });
    $('btnUpClose').addEventListener('click', function () { game.closeUpgrade(); });
    $('btnOffOk').addEventListener('click', function () { game.offlineDone(); });
    $('btnEndContinue').addEventListener('click', function () { game.closeEnding(); });
    $('btnEndRestart').addEventListener('click', function () { game.restart(); });
    $('btnUpgrade').addEventListener('click', function () { game.openUpgrade(); });
    $('btnMenu').addEventListener('click', function () { game.togglePause(); });
    $('btnSound').addEventListener('click', function () { UI.toggleMute(); });

    $('btnChat').addEventListener('click', function () {
      ensureAudio();
      if (game.mode === 'playing') UI.toggleChat();
      this.blur();
    });
    $('nameChip').addEventListener('click', function () {
      ensureAudio();
      if (game.mode === 'playing' || game.mode === 'paused') UI.openRename();
      this.blur();
    });
    $('btnPauseRename').addEventListener('click', function () { UI.openRename(); });
    $('btnRenameOk').addEventListener('click', function () { UI.submitRename(); });
    $('btnBookClose').addEventListener('click', function () { UI.closeBook(); });
    $('btnShopClose').addEventListener('click', function () { game.closeShop(); });
    $('btnHiddenClose').addEventListener('click', function () { game.closeHidden(); });
    $('shopList').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-shop]') : null;
      if (!btn) return;
      if (btn.classList.contains('is-off')) {
        UI.toast('灵石不足 · 采灵草或与道友闲谈可得');
        return;
      }
      var res = game.buyShopItem(btn.getAttribute('data-shop'));
      if (res && res.ok) {
        UI.renderShop(game);
        UI.toast(res.item.name + ' · 已收下');
        UI.sfx.upgrade();
      } else if (res && res.reason === 'stones') {
        UI.toast('灵石不足');
      }
    });
    $('btnRenameCancel').addEventListener('click', function () { UI.closeRename(); });
    $('renameInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        UI.submitRename();
      }
    });
    $('chatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var inp = $('chatInput');
      var text = inp.value;
      if (!text.trim()) {
        UI.closeChat();
        return;
      }
      if (SS.Net.sendChat(text)) inp.value = '';
      else UI.toast('还没连上道院');
    });

    $('upList').addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('button[data-up]') : null;
      if (!btn || btn.disabled) return;
      var res = game.buyUpgrade(btn.getAttribute('data-up'));
      if (res && res.ok) {
        UI.renderUpgrade(game);
        UI.toast('习得 ' + res.name + ' · Lv.' + res.level);
        UI.sfx.upgrade();
      } else if (res && res.reason === 'stones') {
        UI.toast('灵石不足');
      }
    });

    $('btnE').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      ensureAudio();
      game.interact();
    });

    bindStick();

    window.addEventListener('pointerdown', ensureAudio, { once: true });
    window.addEventListener('keydown', ensureAudio, { once: true });

    UI.setMode('title');
    UI.setMuted(game.state.muted);
    UI.chatReset();
  };

  SS.UI = UI;
})(window.SS);
