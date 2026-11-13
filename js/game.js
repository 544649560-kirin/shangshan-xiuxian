window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var CFG = SS.CFG;

  var Game = {
    state: null,
    mode: 'title',
    offlineInfo: null,
    upgradeReturn: 'playing',
    insightTimer: 30,
    endingTimer: 0,
    playerX: 70,
    playerY: 238,
    book: null,
    bookTimer: 0,
    _saveT: 0
  };

  Game.newState = function () {
    return {
      v: 1,
      cultivation: 0,
      realm: 0,
      stones: 0,
      upgrades: { tuna: 0, jingxin: 0, caiyao: 0 },
      herbs: CFG.SCENE.herbs.map(function () { return { taken: false, left: 0 }; }),
      buffLeft: 0,
      btT: 0,
      stats: { sit: 0, insight: 0, herbs: 0, books: 0, breakthroughs: 0, startedAt: Date.now() },
      muted: false,
      lastSeen: Date.now(),
      npcGift: false,
      shopGift: false,
      altarBroken: false,
      hiddenSeen: false,
      endingSeen: false
    };
  };

  function num(v, d) {
    return (typeof v === 'number' && isFinite(v)) ? v : d;
  }

  Game.init = function () {
    this.state = this.load() || this.newState();
    this.offlineInfo = this.settleOffline();
  };

  Game.load = function () {
    var raw;
    try {
      raw = JSON.parse(localStorage.getItem(CFG.SAVE_KEY) || 'null');
    } catch (e) {
      return null;
    }
    if (!raw || raw.v !== 1) return null;

    var d = this.newState();
    d.cultivation = Math.max(0, num(raw.cultivation, 0));
    d.realm = Math.max(0, Math.min(CFG.REALMS.length - 1, Math.floor(num(raw.realm, 0))));
    d.stones = Math.max(0, Math.floor(num(raw.stones, 0)));

    if (raw.upgrades) {
      for (var k in d.upgrades) {
        var u = CFG.UPGRADES.filter(function (x) { return x.id === k; })[0];
        var lim = u ? u.max : 5;
        d.upgrades[k] = Math.max(0, Math.min(lim, Math.floor(num(raw.upgrades[k], 0))));
      }
    }
    if (Array.isArray(raw.herbs) && raw.herbs.length === d.herbs.length) {
      for (var i = 0; i < d.herbs.length; i++) {
        d.herbs[i].taken = !!raw.herbs[i].taken;
        d.herbs[i].left = Math.max(0, num(raw.herbs[i].left, 0));
      }
    }
    if (raw.stats) {
      for (var s in d.stats) {
        d.stats[s] = Math.max(0, num(raw.stats[s], d.stats[s]));
      }
      if (!raw.stats.startedAt) d.stats.startedAt = Date.now();
    }
    d.buffLeft = 0;
    d.btT = 0;
    d.muted = !!raw.muted;
    d.npcGift = !!raw.npcGift;
    d.shopGift = !!raw.shopGift;
    d.altarBroken = !!raw.altarBroken;
    d.hiddenSeen = !!raw.hiddenSeen;
    d.endingSeen = !!raw.endingSeen;
    d.lastSeen = num(raw.lastSeen, Date.now());

    // 旧存档（6 层体系）升级到 20 层体系：按修为重新推算所处层数
    var derived = 0;
    for (var r = 1; r < CFG.REALMS.length; r++) {
      if (d.cultivation >= CFG.REALMS[r].need) derived = r;
    }
    d.realm = Math.max(d.realm, derived);
    // 数值调整后，旧存档保留原境界，修为补到该层门槛
    if (d.cultivation < CFG.REALMS[d.realm].need) d.cultivation = CFG.REALMS[d.realm].need;
    return d;
  };

  Game.save = function () {
    if (!this.state) return;
    try {
      this.state.lastSeen = Date.now();
      localStorage.setItem(CFG.SAVE_KEY, JSON.stringify(this.state));
    } catch (e) { /* storage might be unavailable */ }
  };

  Game.rate = function () {
    var realm = CFG.REALMS[this.state.realm];
    var tuna = this.state.upgrades.tuna || 0;
    var r = CFG.BASE_RATE * realm.mult * (1 + 0.2 * tuna);
    if (this.state.buffLeft > 0) r *= CFG.INSIGHT.buffMult;
    return r;
  };

  Game.isSitting = function () {
    return SS.Player.state === 'sit';
  };

  Game.canBreak = function () {
    var next = CFG.REALMS[this.state.realm + 1];
    return !!next && this.state.cultivation >= next.need;
  };

  Game.canAffordAny = function () {
    for (var i = 0; i < CFG.UPGRADES.length; i++) {
      var u = CFG.UPGRADES[i];
      var lv = this.state.upgrades[u.id] || 0;
      if (lv < u.max && this.state.stones >= u.costs[lv]) return true;
    }
    return false;
  };

  Game.objective = function () {
    var st = this.state;
    var next = CFG.REALMS[st.realm + 1];
    if (!next) {
      if (st.altarBroken) return '炉已碎 · 红光未散';
      return '殿前镇山炉，似在等你';
    }
    if (this.canBreak()) return '修为已足，按 E 冲击' + next.name;
    if (this.canAffordAny()) return '灵石 ' + st.stones + '，可修习功法（F）';
    return '于蒲团打坐，凝聚灵气（' + Math.floor(st.cultivation) + '/' + next.need + '）';
  };

  Game.settleOffline = function () {
    var away = (Date.now() - this.state.lastSeen) / 1000;
    if (!(away > 60)) {
      this.state.lastSeen = Date.now();
      return null;
    }
    var capped = Math.min(away, CFG.OFFLINE_CAP_H * 3600);
    var gain = Math.floor(capped * CFG.OFFLINE_EFF * this.rate());
    this.state.cultivation += gain;
    this.state.lastSeen = Date.now();
    this.state.stats.sit += capped * CFG.OFFLINE_EFF;
    this.save();
    return { seconds: away, gain: gain };
  };

  Game.beginPlay = function () {
    this.mode = 'playing';
    this.book = null;
    this.bookTimer = CFG.BOOK.firstDelay;
    this.insightTimer = CFG.INSIGHT.minGap + Math.random() * (CFG.INSIGHT.maxGap - CFG.INSIGHT.minGap);
    var sky = SS.Scene.todKey(new Date());
    SS.Scene.setSky(sky);
    SS.Scene.prevSky = null;
    SS.Scene.skyMix = 1;
    SS.UI.setMode('playing');
    this.save();
  };

  Game.start = function () {
    if (this.mode !== 'title') return;
    var self = this;
    this.mode = 'starting';
    SS.UI.setMode('playing');
    SS.UI.setHudHidden(true);

    SS.Intro.play(function () {
      SS.UI.setHudHidden(false);
      if (self.offlineInfo) {
        self.mode = 'offline';
        SS.UI.showOffline(self.offlineInfo);
      } else {
        SS.UI.fade(function () { self.beginPlay(); });
      }
    });
  };

  Game.offlineDone = function () {
    this.offlineInfo = null;
    this.beginPlay();
  };

  Game.update = function (dt) {
    this.playerX = SS.Player.x;
    this.playerY = SS.Player.y;

    if (this.mode !== 'playing') return;
    var st = this.state;

    // 奇遇古书：随机飘落，限时存在
    if (this.book) {
      this.book.left -= dt;
      if (this.book.left <= 0) {
        this.book = null;
        this.bookTimer = this.nextBookGap();
        SS.UI.toast('那本旧书被风翻走了');
      }
    } else {
      this.bookTimer -= dt;
      if (this.bookTimer <= 0) this.spawnBook();
    }

    if (st.btT > 0) st.btT = Math.max(0, st.btT - dt);
    if (st.buffLeft > 0) st.buffLeft = Math.max(0, st.buffLeft - dt);

    if (this.isSitting() && st.btT <= 0) {
      st.cultivation += this.rate() * dt;
      st.stats.sit += dt;
      this.insightTimer -= dt;
      if (this.insightTimer <= 0) this.triggerInsight();
    }

    for (var i = 0; i < st.herbs.length; i++) {
      var h = st.herbs[i];
      if (h.taken) {
        h.left -= dt;
        if (h.left <= 0) {
          h.taken = false;
          h.left = 0;
        }
      }
    }

    if (this.endingTimer > 0) {
      this.endingTimer -= dt;
      if (this.endingTimer <= 0) {
        this.mode = 'ending';
        SS.UI.showEnding(this);
        this.save();
      }
    }

    this._saveT += dt;
    if (this._saveT >= 5) {
      this._saveT = 0;
      this.save();
    }
  };

  Game.triggerInsight = function () {
    var st = this.state;
    var jing = st.upgrades.jingxin || 0;
    var pick = Math.random() < 0.5 ? 'qi' : 'buff';
    st.stats.insight += 1;
    if (pick === 'qi') {
      st.cultivation += CFG.INSIGHT.qiGain;
      SS.UI.toast('顿悟 · ' + CFG.TEXT.insight[0].title + '　' + CFG.TEXT.insight[0].text);
    } else {
      st.buffLeft = Math.max(st.buffLeft, CFG.INSIGHT.buffTime);
      SS.UI.toast('顿悟 · ' + CFG.TEXT.insight[1].title + '　' + CFG.TEXT.insight[1].text, 'buff');
    }
    SS.UI.sfx.insight();
    this.insightTimer = (CFG.INSIGHT.minGap + Math.random() * (CFG.INSIGHT.maxGap - CFG.INSIGHT.minGap)) / (1 + 0.25 * jing);
    this.save();
  };

  /* ---------------- 隐藏剧情：镇山炉 ---------------- */

  Game.atMax = function () {
    return this.state && this.state.realm >= CFG.REALMS.length - 1;
  };

  Game.altarNear = function () {
    var dx = 240 - SS.Player.x;
    var dy = 208 - SS.Player.y;
    return dx * dx + dy * dy <= 26 * 26;
  };

  Game.smashAltar = function () {
    if (!this.atMax() || this.state.altarBroken) return;
    this.state.altarBroken = true;
    this.state.hiddenSeen = true;
    this.mode = 'hidden';
    SS.Scene.burst(240, 208);
    SS.UI.sfx.breakthrough();
    SS.UI.showHidden(this);
    this.save();
  };

  Game.closeHidden = function () {
    if (this.mode !== 'hidden') return;
    this.mode = 'playing';
    SS.UI.closeHidden();
    this.save();
  };

  /* ---------------- 山上小店 · 义桥义起奔富 ---------------- */

  Game.shopNear = function () {
    var dx = CFG.SHOP.x - SS.Player.x;
    var dy = CFG.SHOP.y - SS.Player.y;
    return dx * dx + dy * dy <= 30 * 30;
  };

  Game.openShop = function () {
    if (this.mode !== 'playing') return;
    this.mode = 'shop';
    if (!this.state.shopGift) {
      this.state.shopGift = true;
      this.state.stones += 12;
      SS.UI.toast('小店开张 · 赠你 12 枚灵石');
      this.save();
    }
    SS.UI.openShop(this);
  };

  Game.closeShop = function () {
    if (this.mode !== 'shop') return;
    this.mode = 'playing';
    SS.UI.closeShop();
    this.save();
  };

  Game.buyShopItem = function (id) {
    var item = null;
    for (var i = 0; i < CFG.SHOP.items.length; i++) {
      if (CFG.SHOP.items[i].id === id) { item = CFG.SHOP.items[i]; break; }
    }
    if (!item) return { ok: false, reason: 'none' };
    if (this.state.stones < item.cost) return { ok: false, reason: 'stones' };

    this.state.stones -= item.cost;
    if (item.kind === 'buff') {
      this.state.buffLeft = Math.max(this.state.buffLeft, item.time);
    } else if (item.kind === 'qi' || item.kind === 'both') {
      var realm = CFG.REALMS[this.state.realm];
      var next = CFG.REALMS[this.state.realm + 1];
      var prev = CFG.REALMS[this.state.realm - 1] || { need: 0 };
      var span = next ? next.need - realm.need : Math.max(2000, realm.need - prev.need);
      this.state.cultivation += Math.round(span * item.ratio);
      if (item.kind === 'both' && item.time) {
        this.state.buffLeft = Math.max(this.state.buffLeft, item.time);
      }
    }
    this.save();
    return { ok: true, item: item };
  };

  Game.interact = function () {
    if (SS.UI.isBookOpen()) {
      SS.UI.closeBook();
      return;
    }
    if (SS.UI.dialogOpen) {
      SS.UI.advanceDialog();
      return;
    }
    if (this.mode !== 'playing') return;
    if (this.state.btT > 0) return;

    if (this.bookNear()) {
      this.openBook();
      return;
    }

    if (this.shopNear() && SS.Player.state !== 'sit') {
      this.openShop();
      return;
    }

    if (this.canBreak()) {
      this.breakthrough();
      return;
    }

    if (SS.Net && SS.Net.queuePos > 0 && SS.Player.state !== 'sit') {
      SS.Net.leaveQueue();
      SS.UI.toast('已离开候坐队列');
      return;
    }
    if (SS.Player.state === 'sit') {
      SS.Player.stand();
      return;
    }

    if (this.atMax() && !this.state.altarBroken && this.altarNear()) {
      this.smashAltar();
      return;
    }

    var near = SS.Scene.nearest(SS.Player);
    if (!near) {
      if (SS.Net && SS.Scene.seatNear(SS.Player) >= 0) {
        var free = 0;
        for (var i = 0; i < CFG.SCENE.seats.length; i++) {
          if (!SS.Net.seatTaken(i)) free++;
        }
        if (free > 0) {
          SS.UI.toast('这蒲团已经有人了，旁边还有空位');
        } else {
          SS.Net.joinQueue();
          SS.UI.toast('道院满座 · 开始候坐，有人起身便轮到你');
        }
      }
      return;
    }
    if (near.type === 'cushion') {
      var seatIdx = near.seat;
      if (SS.Net && SS.Net.seatTaken(seatIdx)) {
        SS.Net.joinQueue();
        SS.UI.toast('这蒲团已经有人了，开始候坐');
        return;
      }
      SS.Player.sit(CFG.SCENE.seats[seatIdx]);
      if (SS.Net) SS.Net.claimSeat(seatIdx);
      if (this.insightTimer > CFG.INSIGHT.maxGap) this.insightTimer = CFG.INSIGHT.maxGap;
      SS.UI.sfx.page();
    } else if (near.type === 'herb') {
      this.pickHerb(near.index);
    } else if (near.type === 'npc') {
      this.talkNpc();
    }
  };

  Game.nextBookGap = function () {
    return CFG.BOOK.minGap + Math.random() * (CFG.BOOK.maxGap - CFG.BOOK.minGap);
  };

  Game.bookNear = function () {
    if (!this.book) return false;
    var dx = this.book.x - SS.Player.x;
    var dy = this.book.y - SS.Player.y;
    var d = CFG.BOOK.pickDist;
    return dx * dx + dy * dy <= d * d;
  };

  Game.spawnBook = function () {
    if (this.book) return;
    var b = CFG.SCENE.bounds;
    var idx = Math.floor(Math.random() * CFG.BOOKS.length);
    this.book = {
      index: idx,
      rare: !!CFG.BOOKS[idx].rare,
      x: b.x0 + 16 + Math.random() * (b.x1 - b.x0 - 32),
      y: 214 + Math.random() * 32,
      left: CFG.BOOK.life
    };
    SS.UI.toast('院子里凭空落下一本《' + CFG.BOOKS[idx].title + '》');
    SS.UI.sfx.book();
  };

  Game.openBook = function () {
    var b = this.book;
    if (!b) return;
    var book = CFG.BOOKS[b.index];
    var realm = CFG.REALMS[this.state.realm];
    var next = CFG.REALMS[this.state.realm + 1];
    var span = next
      ? next.need - realm.need
      : Math.max(1200, realm.need - (CFG.REALMS[this.state.realm - 1] || { need: 0 }).need);
    var lo = book.rare ? 0.12 : 0.05;
    var hi = book.rare ? 0.20 : 0.10;
    var gain = Math.max(10, Math.round(span * (lo + Math.random() * (hi - lo))));

    this.state.cultivation += gain;
    this.state.stats.books = (this.state.stats.books || 0) + 1;
    this.book = null;
    this.bookTimer = this.nextBookGap();
    this.save();
    SS.UI.showBook(book, gain);
  };

  Game.pickHerb = function (i) {
    var h = this.state.herbs[i];
    if (!h || h.taken) return;
    h.taken = true;
    h.left = CFG.HERB.respawn;
    var stones = CFG.HERB.stone + (this.state.upgrades.caiyao || 0);
    this.state.cultivation += CFG.HERB.qi;
    this.state.stones += stones;
    this.state.stats.herbs += 1;
    SS.UI.toast('灵草 · 修为 +' + CFG.HERB.qi + ' · 灵石 +' + stones);
    SS.UI.sfx.pick();
    this.save();
  };

  Game.talkNpc = function () {
    var st = this.state;
    if (!st.npcGift) {
      st.npcGift = true;
      st.stones += 5;
      SS.UI.say(CFG.TEXT.npcFirst);
      SS.UI.toast('道友赠你 5 枚灵石');
      this.save();
      return;
    }
    if (this.canBreak()) {
      SS.UI.say(CFG.TEXT.npcReady);
      return;
    }
    SS.UI.say(CFG.TEXT.npcByRealm[st.realm] || CFG.TEXT.npcByRealm[0]);
  };

  Game.breakthrough = function () {
    var st = this.state;
    var nextIdx = st.realm + 1;
    if (!CFG.REALMS[nextIdx]) return;

    st.realm = nextIdx;
    st.btT = 1.2;
    st.stats.breakthroughs += 1;
    SS.Scene.burst(this.playerX, this.playerY);
    SS.UI.sfx.breakthrough();
    SS.UI.toast('突破 · ' + CFG.REALMS[nextIdx].name);
    if (nextIdx === CFG.REALMS.length - 1 && !st.endingSeen) {
      st.endingSeen = true;
      this.endingTimer = 1.9;
    }
    this.save();
  };

  Game.buyUpgrade = function (id) {
    var u = null;
    for (var i = 0; i < CFG.UPGRADES.length; i++) {
      if (CFG.UPGRADES[i].id === id) { u = CFG.UPGRADES[i]; break; }
    }
    if (!u) return { ok: false, reason: 'none' };
    var lv = this.state.upgrades[id] || 0;
    if (lv >= u.max) return { ok: false, reason: 'max' };
    var cost = u.costs[lv];
    if (this.state.stones < cost) return { ok: false, reason: 'stones' };
    this.state.stones -= cost;
    this.state.upgrades[id] = lv + 1;
    this.save();
    return { ok: true, name: u.name, level: lv + 1 };
  };

  Game.setMuted = function (v) {
    this.state.muted = !!v;
    this.save();
  };

  Game.pause = function () {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    SS.UI.setMode('paused');
    this.save();
  };

  Game.resume = function () {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    SS.UI.setMode('playing');
  };

  Game.togglePause = function () {
    if (this.mode === 'playing') this.pause();
    else if (this.mode === 'paused') this.resume();
    else if (this.mode === 'upgrade') this.closeUpgrade();
  };

  Game.openUpgrade = function () {
    if (this.mode !== 'playing' && this.mode !== 'paused') return;
    this.upgradeReturn = this.mode;
    this.mode = 'upgrade';
    SS.UI.renderUpgrade(this);
    SS.UI.setMode('upgrade');
  };

  Game.closeUpgrade = function () {
    if (this.mode !== 'upgrade') return;
    this.mode = this.upgradeReturn || 'playing';
    SS.UI.setMode(this.mode);
  };

  Game.closeEnding = function () {
    if (this.mode !== 'ending') return;
    this.mode = 'playing';
    SS.UI.setMode('playing');
  };

  Game.restart = function () {
    this.state = this.newState();
    this.offlineInfo = null;
    this.endingTimer = 0;
    this.book = null;
    this.bookTimer = CFG.BOOK.firstDelay;
    this._saveT = 0;
    SS.Player.init();
    SS.Scene.init();
    SS.Scene.setSky(SS.Scene.todKey(new Date()));
    SS.Scene.prevSky = null;
    SS.Scene.skyMix = 1;
    SS.UI.closeDialog();
    this.mode = 'playing';
    SS.UI.setMode('playing');
    SS.UI.setMuted(false);
    SS.UI.toast('重新上山');
    this.save();
  };

  SS.Game = Game;
})(window.SS);
