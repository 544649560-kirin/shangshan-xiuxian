window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;
  var SYNC_MS = 600;

  function loadId() {
    var id = null;
    try { id = localStorage.getItem('shangshan-uid'); } catch (e) { /* ignore */ }
    if (!id || !/^[a-zA-Z0-9_-]{6,40}$/.test(id)) {
      id = 'u' + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
      try { localStorage.setItem('shangshan-uid', id); } catch (e) { /* ignore */ }
    }
    return id;
  }

  function genName(id) {
    var seed = 0;
    for (var i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) % 900;
    return '道友' + (100 + seed);
  }

  function cleanName(v) {
    return String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 10);
  }

  function loadName(id) {
    var saved = null;
    try { saved = localStorage.getItem(CFG.NAME_KEY); } catch (e) { /* ignore */ }
    var name = cleanName(saved);
    return name || genName(id);
  }

  var Net = {
    id: '',
    name: '',
    online: false,
    hall: -1,
    onlineCount: 0,
    totalOnline: 0,
    players: [],
    mySeat: null,
    queuePos: 0,
    queueCount: 0,
    messages: [],
    chatSeq: 0,
    bubbles: {},
    _echoSeqs: {},
    _want: false,
    _interval: 0,
    _busy: false,
    _fails: 0
  };

  Net.init = function () {
    this.id = loadId();
    this.name = loadName(this.id);
    this.online = false;
    this.hall = -1;
    this.onlineCount = 0;
    this.totalOnline = 0;
    this.players = [];
    this.mySeat = null;
    this.queuePos = 0;
    this.queueCount = 0;
    this.messages = [];
    this.chatSeq = 0;
    this.bubbles = {};
    this._echoSeqs = {};
    this._want = false;
    this._busy = false;
    this._fails = 0;
    var self = this;
    if (this._interval) clearInterval(this._interval);
    this._interval = setInterval(function () { self.push(); }, SYNC_MS);
  };

  Net.setName = function (value) {
    var name = cleanName(value);
    if (!name) return false;
    this.name = name;
    try { localStorage.setItem(CFG.NAME_KEY, name); } catch (e) { /* ignore */ }
    this.push();
    return true;
  };

  Net.sendChat = function (value) {
    var text = String(value || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
    if (!text || !this.online) return false;
    var self = this;
    this._busy = true;
    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: this.id, text: text }),
      cache: 'no-store'
    }).then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok && data && data.ok, data: data }; });
    }).then(function (r) {
      self._busy = false;
      if (!r.ok) {
        if (SS.UI) SS.UI.toast(r.data && r.data.error === 'too_fast' ? '说得太急了，缓一缓' : '这句话没有送出去');
        return;
      }
      // 本地先显示，等同步回来时按 seq 去重
      self._echoSeqs[r.data.seq] = true;
      self._echoChat({ id: self.id, name: self.name, text: text, at: r.data.at, seq: r.data.seq });
    }).catch(function () {
      self._busy = false;
      if (SS.UI) SS.UI.toast('这句话没有送出去');
    });
    return true;
  };

  Net._echoChat = function (msg) {
    this._showMessage(msg);
  };

  Net.bubbleFor = function (id) {
    var b = this.bubbles[id];
    if (!b || Date.now() > b.until) return null;
    return b.text;
  };

  Net._showMessage = function (msg) {
    var now = Date.now();
    this.bubbles[msg.id] = { text: msg.text, until: now + 7000 };
    this.messages.push(msg);
    if (this.messages.length > 80) this.messages.shift();
    if (SS.UI && SS.UI.chatReceive) SS.UI.chatReceive(msg);
  };

  Net.applyChat = function (list, seq) {
    var i, m;
    if (list && list.length) {
      for (i = 0; i < list.length; i++) {
        m = list[i];
        if (!m || typeof m.seq !== 'number') continue;
        if (m.id === this.id && this._echoSeqs[m.seq]) {
          // 自己刚发的已经本地显示过，只延长气泡时间
          delete this._echoSeqs[m.seq];
          this.bubbles[m.id] = { text: m.text, until: Date.now() + 7000 };
          continue;
        }
        this._showMessage(m);
      }
    }
    if (typeof seq === 'number' && seq > this.chatSeq) this.chatSeq = seq;
  };

  Net.claimSeat = function (index) {
    this.mySeat = index;
    this._want = false;
    this.queuePos = 0;
    this.push();
  };

  Net.releaseSeat = function () {
    this.mySeat = null;
    this.push();
  };

  Net.joinQueue = function () {
    this._want = true;
    this.push();
  };

  Net.leaveQueue = function () {
    this._want = false;
    this.queuePos = 0;
    this.push();
  };

  Net.seatTaken = function (index) {
    for (var i = 0; i < this.players.length; i++) {
      var p = this.players[i];
      if (p.seat === index && p.state === 'sit') return true;
    }
    return false;
  };

  Net.update = function (dt) {
    var i, p;
    var k = Math.min(1, dt * 9);
    for (i = 0; i < this.players.length; i++) {
      p = this.players[i];
      p.sx += (p.x - p.sx) * k;
      p.sy += (p.y - p.sy) * k;
    }
  };

  Net.push = function () {
    var self = this;
    var game = SS.Game;
    if (!game || !game.state) return;

    var payload = {
      v: 3,
      id: this.id,
      name: this.name,
      x: Math.round(SS.Player.x * 10) / 10,
      y: Math.round(SS.Player.y * 10) / 10,
      state: SS.Player.state === 'sit' ? 'sit' : 'idle',
      seat: this.mySeat,
      want: !!this._want,
      hall: this.hall,
      realm: game.state.realm,
      since: this.chatSeq
    };

    this._busy = true;
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 4000) : 0;

    fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl ? ctrl.signal : undefined,
      cache: 'no-store'
    }).then(function (res) {
      if (!res.ok) throw new Error('http_' + res.status);
      return res.json();
    }).then(function (data) {
      clearTimeout(timer);
      self._busy = false;
      self._fails = 0;
      self.online = true;
      var firstHall = self.hall < 0;
      var hallChanged = false;
      if (typeof data.hall === 'number' && data.hall >= 0) {
        if (self.hall >= 0 && self.hall !== data.hall) {
          hallChanged = true;
          self.mySeat = null;
          self.queuePos = 0;
          // 换殿后聊天序号重新开始，避免串殿
          self.chatSeq = 0;
          self.messages = [];
          self.bubbles = {};
          self._echoSeqs = {};
          if (SS.UI && SS.UI.chatReset) SS.UI.chatReset();
        }
        self.hall = data.hall;
      }
      self.onlineCount = data.online || 0;
      self.totalOnline = data.totalOnline || self.onlineCount;
      self.queuePos = data.queuePos || 0;
      self.queueCount = data.queueCount || 0;
      self.applyPlayers(data.players || []);
      self.applySeat(data);
      if (firstHall || hallChanged) {
        // 刚进殿：把近期聊天补进记录，但不弹气泡、不提示音
        if (SS.UI && SS.UI.chatHistory) SS.UI.chatHistory(data.chat);
        self.chatSeq = typeof data.chatSeq === 'number' ? data.chatSeq : 0;
      } else {
        self.applyChat(data.chat, data.chatSeq);
      }
    }).catch(function () {
      clearTimeout(timer);
      self._busy = false;
      self._fails++;
      if (self._fails >= 2) self.online = false;
      if (!self.online) {
        self.players = [];
        self.onlineCount = 0;
        self.hall = -1;
      }
    });
  };

  Net.applySeat = function (data) {
    if (data.conflict) {
      if (SS.Player.state === 'sit') {
        SS.Player.stand();
        SS.UI.toast('这蒲团已经有人了，换一个');
      }
      this.mySeat = null;
      return;
    }

    if (data.seat !== null && data.seat !== this.mySeat) {
      // 排队递补：服务端把空出的蒲团直接递给我
      var seat = CFG.SCENE.seats[data.seat];
      if (seat) {
        this.mySeat = data.seat;
        this._want = false;
        this.queuePos = 0;
        if (SS.Player.state !== 'sit') SS.Player.sit(seat);
        SS.UI.toast('轮到你 · 已入座第 ' + (data.seat + 1) + ' 号蒲团');
        SS.UI.sfx.page();
      }
      return;
    }

    if (this.mySeat !== null && SS.Player.state === 'sit' && data.seat === null) {
      SS.Player.stand();
      SS.UI.toast('这蒲团已经有人了，换一个');
      this.mySeat = null;
    }
  };

  Net.applyPlayers = function (list) {
    var next = [];
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (!p || p.id === this.id) continue;
      var old = null;
      for (var j = 0; j < this.players.length; j++) {
        if (this.players[j].id === p.id) { old = this.players[j]; break; }
      }
      next.push({
        id: p.id,
        name: p.name,
        x: p.x,
        y: p.y,
        state: p.state,
        seat: p.seat,
        realm: p.realm,
        sx: old ? old.sx : p.x,
        sy: old ? old.sy : p.y
      });
    }
    this.players = next;
  };

  Net.leave = function () {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = 0;
    }
    try {
      var body = JSON.stringify({
        id: this.id,
        name: this.name,
        x: SS.Player.x,
        y: SS.Player.y,
        state: 'idle',
        seat: null,
        want: false,
        realm: SS.Game && SS.Game.state ? SS.Game.state.realm : 0
      });
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/sync', new Blob([body], { type: 'application/json' }));
      }
    } catch (e) { /* ignore */ }
  };

  SS.Net = Net;
})(window.SS);
