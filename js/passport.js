window.SS = window.SS || {};
(function (SS) {
  'use strict';

  var PKEY = 'shangshan-passport';
  var API = '/api/passport';
  var PUSH_MS = 12000;
  var CFG = SS.CFG;

  var cred = null;
  var lastPush = 0;
  var busy = false;
  var suppressSync = false;  // 登录/退出重载期间，禁止 pagehide 把旧 state 写回覆盖云端

  function ls(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  function del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  function $(id) { return document.getElementById(id); }

  function loadCred() {
    try { cred = JSON.parse(ls(PKEY) || 'null'); } catch (e) { cred = null; }
    if (!cred || !cred.uid || !cred.token) cred = null;
    return cred;
  }
  function saveCred() { set(PKEY, JSON.stringify(cred)); }

  function post(body, keepalive) {
    return fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: !!keepalive
    }).then(function (r) {
      return r.json().catch(function () { return { ok: false, error: 'network' }; });
    }).catch(function () { return { ok: false, error: 'network' }; });
  }

  function toast(msg) { if (SS.UI && SS.UI.toast) SS.UI.toast(msg); }

  // 短时间内刚同步过（防 reload 循环），10 秒后自动失效
  function justSynced() {
    try {
      var t = Number(sessionStorage.getItem('shangshan-synced') || 0);
      return Date.now() - t < 10000;
    } catch (e) { return false; }
  }
  function markSynced() {
    try { sessionStorage.setItem('shangshan-synced', String(Date.now())); } catch (e) { /* ignore */ }
  }

  // 采纳一份存档并重载：必须同时同步内存 state，
  // 否则 reload 触发的 pagehide 会把旧的 SS.Game.state 写回、覆盖掉刚取回的云端存档
  function adoptSave(save, updatedAt, delay, msg) {
    suppressSync = true;
    if (save) {
      set(CFG.SAVE_KEY, JSON.stringify(save));
      try {
        if (SS.Game) SS.Game.state = save;
      } catch (e) { /* ignore */ }
    }
    if (cred && updatedAt) { cred.syncedAt = updatedAt; saveCred(); }
    markSynced();
    if (msg) toast(msg);
    setTimeout(function () { location.reload(); }, delay || 0);
  }

  // 登记时若云端与本机都有进度，保留修为更高的一份，避免旧进度被冲掉
  function pickSave(cloudSave) {
    var local = null;
    try { local = JSON.parse(ls(CFG.SAVE_KEY) || 'null'); } catch (e) { /* ignore */ }
    if (!cloudSave) return local;
    if (!local) return cloudSave;
    var a = Number(cloudSave.cultivation) || 0;
    var b = Number(local.cultivation) || 0;
    if (b > a) return local;
    if (a > b) return cloudSave;
    return (Number(local.lastSeen) || 0) > (Number(cloudSave.lastSeen) || 0) ? local : cloudSave;
  }

  /* ---------- 云存档上行 ---------- */
  function pushNow(force, unloading) {
    if (suppressSync) return;
    if (!cred || !SS.Game || !SS.Game.state) return;
    var now = Date.now();
    if (!force && now - lastPush < PUSH_MS) return;
    lastPush = now;
    var body = {
      act: 'push', uid: cred.uid, token: cred.token, name: cred.name,
      base: cred.syncedAt || 0,
      save: SS.Game.state
    };
    if (unloading && navigator.sendBeacon) {
      try {
        navigator.sendBeacon(API, new Blob([JSON.stringify(body)], { type: 'application/json' }));
        return;
      } catch (e) { /* 退回 fetch */ }
    }
    post(body, !!unloading).then(function (r) {
      if (!r || !cred) return;
      if (r.ok) {
        cred.syncedAt = r.updatedAt;
        cred.storage = r.storage;
        saveCred();
      } else if (r.error === 'conflict') {
        // 别的设备刚写过云端：本机不要覆盖，取回云存档再重载
        if (!justSynced()) {
          post({ act: 'pull', uid: cred.uid, token: cred.token }).then(function (p) {
            adoptSave(pickSave(p && p.ok ? p.save : null),
              (p && p.updatedAt) || r.updatedAt, 700, '已取回其他设备上的修行进度');
          });
        }
      }
    });
  }

  /* ---------- 登记 / 登录 ---------- */
  function showErr(msg) {
    var e = $('passportErr');
    if (!e) return;
    e.textContent = msg;
    e.classList.remove('hidden');
  }

  function submit() {
    if (busy) return;
    var name = ($('passportNameInput').value || '').trim();
    var pass = $('passportPassInput').value || '';
    if (name.length < 2 || name.length > 10) { showErr('道号要 2–10 个字'); return; }
    if (pass.length < 4 || pass.length > 40) { showErr('口令至少 4 位'); return; }
    busy = true;
    var btn = $('btnPassportSubmit');
    if (btn) btn.disabled = true;
    post({ act: 'register', name: name, pass: pass }).then(function (r) {
      busy = false;
      if (btn) btn.disabled = false;
      if (!r.ok) {
        showErr(r.error === 'name_taken' ? '这个道号已被占用，请换一个（或确认口令）'
          : r.error === 'network' ? '连不上道院，稍后再试' : '登记失败，请检查道号与口令');
        return;
      }
      cred = { uid: r.uid, name: r.name, token: r.token, syncedAt: r.updatedAt || 0, storage: r.storage };
      saveCred();
      set('shangshan-uid', r.uid);       // 固定身份：不再随机
      set(CFG.NAME_KEY, r.name);
      // 云端/本机取修为高者；同步进内存 state，避免 pagehide 写回旧数据
      adoptSave(pickSave(r.save), r.updatedAt || 0, 0);
    });
  }

  function logout() {
    del(PKEY);
    del('shangshan-uid');   // 回到游客身份
    cred = null;
    location.reload();
  }

  /* ---------- 面板 ---------- */
  function openPanel() {
    var p = $('passportPanel');
    if (!p) return;
    $('passportErr').classList.add('hidden');
    if (cred) {
      $('passportLogged').classList.remove('hidden');
      $('passportForm').classList.add('hidden');
      $('passportName').textContent = cred.name;
      var st = $('passportStorage');
      if (st) st.textContent = cred.storage === false ? '云端存储暂不可用，进度仅存本机' : '修为已同步至云端';
    } else {
      $('passportLogged').classList.add('hidden');
      $('passportForm').classList.remove('hidden');
      $('passportNameInput').value = ls(CFG.NAME_KEY) || '';
      $('passportPassInput').value = '';
      setTimeout(function () { $('passportNameInput').focus(); }, 0);
    }
    p.classList.remove('hidden');
  }
  function closePanel() {
    var p = $('passportPanel');
    if (p) p.classList.add('hidden');
  }

  function bind() {
    var ids = ['btnPassportOpen', 'btnPassportOpen2', 'btnPassportOpen3'];
    ids.forEach(function (id) {
      var b = $(id);
      if (b) b.addEventListener('click', function (e) { e.preventDefault(); openPanel(); });
    });
    [['btnPassportClose', closePanel], ['btnPassportCancel', closePanel],
     ['btnPassportSubmit', submit], ['btnPassportLogout', logout]].forEach(function (pair) {
      var b = $(pair[0]);
      if (b) b.addEventListener('click', function (e) { e.preventDefault(); pair[1](); });
    });
    ['passportNameInput', 'passportPassInput'].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      // 输入时不要让 WASD/Esc 冒泡到游戏按键监听
      ['keydown', 'keyup'].forEach(function (ev) {
        el.addEventListener(ev, function (e) { e.stopPropagation(); });
      });
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); submit(); }
        if (e.key === 'Escape') { e.preventDefault(); closePanel(); }
      });
    });
  }

  function boot() {
    bind();
    loadCred();
    if (!cred) return;

    // 已登记：始终把本地身份纠正为固定 uid
    set('shangshan-uid', cred.uid);
    set(CFG.NAME_KEY, cred.name);

    // 云端比本机新（别的设备玩过）→ 取回后重载
    post({ act: 'pull', uid: cred.uid, token: cred.token }).then(function (r) {
      // 刚登记重载完（10 秒内）不再拉取，直接用本地已写入的存档
      if (justSynced()) { suppressSync = false; pushNow(true); return; }
      if (r && r.ok && r.save && (r.updatedAt || 0) > (cred.syncedAt || 0) + 1500) {
        adoptSave(pickSave(r.save), r.updatedAt, 600, '已取回云端修行进度');
        return;
      }
      cred.syncedAt = Math.max(cred.syncedAt || 0, (r && r.updatedAt) || 0);
      saveCred();
      suppressSync = false;
      // 本机为准，立刻上传一次（也用于首次登记把旧进度带上云）
      pushNow(true);
    });

    setInterval(function () { pushNow(false); }, 4000);
    window.addEventListener('pagehide', function () { pushNow(true, true); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pushNow(true, true);
    });
  }

  SS.Passport = { open: openPanel, close: closePanel, current: function () { return cred; }, push: pushNow };
  window.addEventListener('load', boot);
})(window.SS);
