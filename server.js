'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

const PORT = Number(process.env.PORT) || 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const ROOT = process.env.PUBLIC_DIR || (fs.existsSync(path.join(PUBLIC_DIR, 'index.html')) ? PUBLIC_DIR : __dirname);
const SEAT_COUNT = 8;
const HALL_COUNT = 8;
const MAX_PLAYERS = 120;
const TTL_MS = 12000;
const PROTO = 3;
const GRANT_MS = 6000;
const MAX_REALM = 19; // 与前端 REALMS 长度保持一致（20 层）

/* ---------------- 道牒登记 / 云存档 ----------------
 * uid 由道号确定性派生，不依赖任何持久化文件：即使服务端档案全丢，
 * 同一道号 + 口令登录回来仍是同一个 uid，身份不会漂移。
 * token 用固定密钥签名，服务重启后依然有效。
 */
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const ACCOUNT_FILE = path.join(DATA_DIR, 'accounts.json');
const ACCOUNT_SECRET = 'shangshan-daoyuan-v1-2026'; // 固定签名密钥，勿随部署变动
const MAX_SAVE_BYTES = 24000;
const accounts = new Map(); // name -> { name, passHash, uid, save, updatedAt }
let storageOK = false;
let bootStamp = Date.now();

function hashPass(pass) {
  return crypto.createHash('sha256').update(ACCOUNT_SECRET + '|' + pass).digest('hex').slice(0, 32);
}
function nameKey(name) {
  return String(name).trim().toLowerCase();
}
function uidFor(name) {
  return 'd' + crypto.createHash('sha256').update('uid|' + nameKey(name)).digest('hex').slice(0, 18);
}
function tokenFor(uid) {
  return crypto.createHash('sha256').update('token|' + ACCOUNT_SECRET + '|' + uid).digest('hex').slice(0, 32);
}
function verifyName(v) {
  const s = String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim();
  return s.length >= 2 && s.length <= 10 ? s : null;
}
function verifyPass(v) {
  const s = String(v || '');
  return s.length >= 4 && s.length <= 40 ? s : null;
}

function loadAccounts() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    storageOK = true;
  } catch (e) { storageOK = false; }
  try {
    const raw = JSON.parse(fs.readFileSync(ACCOUNT_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, a] of Object.entries(raw)) {
        if (a && typeof a.name === 'string' && typeof a.uid === 'string') accounts.set(k, a);
      }
    }
  } catch (e) { /* 首次启动无档案 */ }
  try {
    const probe = path.join(DATA_DIR, '.writeprobe');
    fs.writeFileSync(probe, String(bootStamp));
    fs.unlinkSync(probe);
    storageOK = true;
  } catch (e) { storageOK = false; }
}

let savePending = null;
function writeAccounts() {
  if (!storageOK) return;
  try {
    const obj = {};
    for (const [k, a] of accounts) obj[k] = a;
    const tmp = ACCOUNT_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(obj));
    fs.renameSync(tmp, ACCOUNT_FILE);
  } catch (e) { /* 落盘失败不中断服务 */ }
}
function persistAccounts() {
  if (!storageOK || savePending) return;
  savePending = setTimeout(() => {
    savePending = null;
    writeAccounts();
  }, 300);
}
// 进程退出前把待写档案强制落盘，避免防抖窗口内的数据丢失
function flushAccounts() {
  if (savePending) { clearTimeout(savePending); savePending = null; }
  writeAccounts();
}
process.on('SIGTERM', flushAccounts);
process.on('SIGINT', flushAccounts);
process.on('beforeExit', flushAccounts);
loadAccounts();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// 每个道院（殿）各自有蒲团与候坐队列；玩家由服务端自动分流到人最少的殿
const halls = [];
for (let i = 0; i < HALL_COUNT; i++) {
  halls.push({
    id: i,
    seats: new Array(SEAT_COUNT).fill(null),
    waiting: [],
    messages: [],   // 殿内聊天记录 { seq, id, name, text, at }
    msgSeq: 0
  });
}

const players = new Map(); // id -> { id, hall, name, x, y, state, seat, grantAt, realm, lastSeen }
const chatTimes = new Map(); // id -> 上一条发言时间，用于限频

const CHAT_MAX_LEN = 40;
const CHAT_KEEP = 60;
const CHAT_GAP_MS = 600;
const CHAT_TTL_MS = 3 * 60 * 1000;

function sendJson(res, code, body) {
  const data = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function readBody(req, maxBytes) {
  const limit = maxBytes || 8192;
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error('too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function clamp(n, min, max, fallback) {
  return (typeof n === 'number' && isFinite(n)) ? Math.max(min, Math.min(max, n)) : fallback;
}

function cleanName(v) {
  return String(v || '道友').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 12) || '道友';
}

function cleanText(v) {
  return String(v || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, CHAT_MAX_LEN);
}

// 取该殿尚未下发的新消息
function recentMessages(hall, since) {
  const out = [];
  for (const m of hall.messages) {
    if (m.seq > since) out.push(m);
  }
  return out.slice(-20);
}

function isAlive(p, now) {
  return p && now - p.lastSeen <= TTL_MS && !p.gone;
}

function hallOnline(hallId, now) {
  let n = 0;
  for (const p of players.values()) {
    if (p.hall === hallId && isAlive(p, now)) n++;
  }
  return n;
}

function totalOnline(now) {
  let n = 0;
  for (const p of players.values()) {
    if (isAlive(p, now)) n++;
  }
  return n;
}

function totalWaiting() {
  let n = 0;
  for (const h of halls) n += h.waiting.length;
  return n;
}

// 先补满有空位的殿；全满了就进人最少的那一殿候坐
function pickHall(now) {
  let best = 0;
  let bestCount = Infinity;
  for (const h of halls) {
    const c = hallOnline(h.id, now);
    if (c < SEAT_COUNT) return h.id;
    if (c < bestCount) {
      bestCount = c;
      best = h.id;
    }
  }
  return best;
}

function snapshot(now, hallId) {
  const list = [];
  for (const p of players.values()) {
    if (p.hall !== hallId || !isAlive(p, now)) continue;
    list.push({
      id: p.id,
      name: p.name,
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      state: p.state,
      seat: p.seat,
      realm: p.realm
    });
  }
  return list;
}

function pruneQueue(hall, now) {
  for (let i = hall.waiting.length - 1; i >= 0; i--) {
    const p = players.get(hall.waiting[i]);
    if (!p || p.hall !== hall.id || !isAlive(p, now) || p.seat !== null) hall.waiting.splice(i, 1);
  }
}

function freeSeatIndex(hall, now) {
  for (let i = 0; i < SEAT_COUNT; i++) {
    if (!hall.seats[i]) return i;
    const holder = players.get(hall.seats[i]);
    if (!holder || holder.hall !== hall.id || !isAlive(holder, now)) {
      hall.seats[i] = null;
      return i;
    }
  }
  return -1;
}

// 空出的蒲团按候坐顺序递补
function fillSeats(hall, now) {
  pruneQueue(hall, now);
  while (hall.waiting.length) {
    const idx = freeSeatIndex(hall, now);
    if (idx < 0) break;
    const id = hall.waiting.shift();
    const p = players.get(id);
    if (!p || p.hall !== hall.id || !isAlive(p, now) || p.seat !== null) continue;
    hall.seats[idx] = id;
    p.seat = idx;
    p.state = 'sit';
    p.grantAt = now;
  }
}

function releaseSeat(p, hall) {
  if (p.seat !== null && hall.seats[p.seat] === p.id) hall.seats[p.seat] = null;
  p.seat = null;
  p.grantAt = 0;
}

function sync(id, data, now) {
  const prev = players.get(id);
  if (!prev && totalOnline(now) >= MAX_PLAYERS) {
    return { full: true };
  }

  let hallId = prev ? prev.hall : -1;
  const req = Number.isInteger(data.hall) ? data.hall : -1;

  if (req >= 0 && req < HALL_COUNT) {
    if (hallId >= 0 && hallId !== req) {
      releaseSeat(prev, halls[hallId]);
      const w = halls[hallId].waiting.indexOf(id);
      if (w >= 0) halls[hallId].waiting.splice(w, 1);
    }
    hallId = req;
  } else if (hallId < 0 || hallId >= HALL_COUNT) {
    hallId = pickHall(now);
  }
  const hall = halls[hallId];

  const want = data.want === true;
  const state = data.state === 'sit' ? 'sit' : 'idle';
  let seat = Number.isInteger(data.seat) && data.seat >= 0 && data.seat < SEAT_COUNT ? data.seat : null;
  let grantAt = 0;
  let conflict = false;

  if (prev && prev.hall === hallId && prev.seat !== null && hall.seats[prev.seat] === id) {
    // 队列递补时服务端先占座，等客户端回执；宽限期内不因旧状态释放
    // 已确认或仍在宽限期内都保留座位，避免每次同步都释放再抢一次
    const acked = seat === prev.seat && state === 'sit';
    const pending = prev.grantAt > 0 && now - prev.grantAt < GRANT_MS && !acked;
    if (acked || pending) {
      seat = prev.seat;
      grantAt = prev.grantAt;
    } else {
      hall.seats[prev.seat] = null;
    }
  }

  if (seat !== null && hall.seats[seat] && hall.seats[seat] !== id) {
    const held = players.get(hall.seats[seat]);
    if (!held || held.hall !== hallId || !isAlive(held, now)) hall.seats[seat] = null;
  }

  if (seat !== null && state !== 'sit' && grantAt === 0) {
    // 已经站起来却还带着旧座位号，不再占座
    seat = null;
  }

  if (seat !== null) {
    if (hall.seats[seat] && hall.seats[seat] !== id) {
      conflict = true;
      seat = null;
    } else {
      hall.seats[seat] = id;
    }
  }

  players.set(id, {
    id,
    hall: hallId,
    name: cleanName(data.name),
    x: clamp(data.x, 0, 520, 240),
    y: clamp(data.y, 0, 300, 240),
    state: seat === null ? 'idle' : (state === 'sit' || grantAt > 0 ? 'sit' : 'idle'),
    seat,
    grantAt,
    realm: Math.floor(clamp(data.realm, 0, MAX_REALM, 0)),
    lastSeen: now
  });

  const qi = hall.waiting.indexOf(id);
  if (seat !== null || !want) {
    if (qi >= 0) hall.waiting.splice(qi, 1);
  } else if (qi < 0) {
    hall.waiting.push(id);
  }

  fillSeats(hall, now);

  const me = players.get(id);
  const since = Number.isInteger(data.since) && data.since >= 0 ? data.since : 0;
  return {
    conflict,
    hall: hallId,
    seat: me.seat,
    queuePos: hall.waiting.indexOf(id) + 1,
    queueCount: hall.waiting.length,
    players: snapshot(now, hallId),
    online: hallOnline(hallId, now),
    totalOnline: totalOnline(now),
    chat: recentMessages(hall, since),
    chatSeq: hall.msgSeq
  };
}

function serveStatic(req, res, pathname) {
  let rel;
  try {
    rel = decodeURIComponent(pathname === '/' ? '/index.html' : pathname);
  } catch (e) {
    res.writeHead(400);
    res.end('Bad Request');
    return;
  }
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT + path.sep)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-cache'
    });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/health') {
    const now = Date.now();
    sendJson(res, 200, {
      ok: true,
      online: totalOnline(now),
      waiting: totalWaiting(),
      seats: SEAT_COUNT,
      halls: halls.map((h) => ({ id: h.id, online: hallOnline(h.id, now), waiting: h.waiting.length })),
      passport: { enabled: true, accounts: accounts.size, storage: storageOK, boot: bootStamp }
    });
    return;
  }

  // 道牒：登记 / 登录 / 拉取存档 / 上传存档 / 退出
  if (url.pathname === '/api/passport' && req.method === 'POST') {
    let data;
    try {
      data = JSON.parse(await readBody(req, 32768));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: 'bad_json' });
      return;
    }
    const act = String(data.act || '');

    if (act === 'register' || act === 'login') {
      const name = verifyName(data.name);
      const pass = verifyPass(data.pass);
      if (!name || !pass) {
        sendJson(res, 400, { ok: false, error: 'bad_input' });
        return;
      }
      const key = nameKey(name);
      const uid = uidFor(name);
      const passHash = hashPass(pass);
      const existing = accounts.get(key);

      if (act === 'register') {
        if (existing) {
          // 同名已登记：口令正确则直接视为登录，避免重复占号
          if (existing.passHash !== passHash) {
            sendJson(res, 409, { ok: false, error: 'name_taken' });
            return;
          }
        } else {
          if (accounts.size >= 5000) {
            sendJson(res, 503, { ok: false, error: 'account_full' });
            return;
          }
          accounts.set(key, {
            name, passHash, uid, save: null, updatedAt: Date.now()
          });
          persistAccounts();
        }
      } else if (!existing || existing.passHash !== passHash) {
        sendJson(res, 401, { ok: false, error: 'bad_credentials' });
        return;
      }

      const acc = accounts.get(key);
      sendJson(res, 200, {
        ok: true,
        uid: acc.uid,
        name: acc.name,
        token: tokenFor(acc.uid),
        save: acc.save || null,
        updatedAt: acc.updatedAt || 0,
        storage: storageOK
      });
      return;
    }

    const uid = String(data.uid || '');
    const token = String(data.token || '');
    if (!/^d[a-f0-9]{18}$/.test(uid) || token !== tokenFor(uid)) {
      sendJson(res, 401, { ok: false, error: 'unauthorized' });
      return;
    }
    let acc = null;
    for (const a of accounts.values()) { if (a.uid === uid) { acc = a; break; } }

    if (act === 'pull') {
      if (!acc) { sendJson(res, 404, { ok: false, error: 'no_account' }); return; }
      sendJson(res, 200, { ok: true, name: acc.name, save: acc.save || null, updatedAt: acc.updatedAt || 0 });
      return;
    }
    if (act === 'push') {
      const save = data.save;
      if (!save || typeof save !== 'object' || JSON.stringify(save).length > MAX_SAVE_BYTES) {
        sendJson(res, 400, { ok: false, error: 'bad_save' });
        return;
      }
      if (!acc) {
        // 档案文件丢失时按 uid 重建，保证老用户仍能续上
        acc = { name: String(data.name || '道友').slice(0, 10), passHash: '', uid, save: null, updatedAt: 0 };
        accounts.set(nameKey(acc.name), acc);
      }
      // 别的设备在本机上次同步之后写过云端：拒绝覆盖，让本机决定是否取回
      const base = Number(data.base) || 0;
      if (acc.save && acc.updatedAt && base && base < acc.updatedAt) {
        sendJson(res, 200, { ok: false, error: 'conflict', updatedAt: acc.updatedAt });
        return;
      }
      acc.save = save;
      acc.updatedAt = Date.now();
      persistAccounts();
      sendJson(res, 200, { ok: true, updatedAt: acc.updatedAt, storage: storageOK });
      return;
    }
    sendJson(res, 400, { ok: false, error: 'bad_action' });
    return;
  }

  if (url.pathname === '/api/sync') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: 'bad_json' });
      return;
    }
    const id = String(data.id || '');
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) {
      sendJson(res, 400, { ok: false, error: 'bad_id' });
      return;
    }
    if (data.v !== PROTO) {
      sendJson(res, 409, { ok: false, error: 'stale_client' });
      return;
    }
    const result = sync(id, data, Date.now());
    if (result.full) {
      sendJson(res, 503, { ok: false, error: 'full' });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      now: Date.now(),
      online: result.online,
      totalOnline: result.totalOnline,
      hall: result.hall,
      seat: result.seat,
      conflict: result.conflict,
      queuePos: result.queuePos,
      queueCount: result.queueCount,
      players: result.players,
      chat: result.chat,
      chatSeq: result.chatSeq
    });
    return;
  }

  if (url.pathname === '/api/chat') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
      return;
    }
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch (e) {
      sendJson(res, 400, { ok: false, error: 'bad_json' });
      return;
    }
    const id = String(data.id || '');
    if (!/^[a-zA-Z0-9_-]{6,40}$/.test(id)) {
      sendJson(res, 400, { ok: false, error: 'bad_id' });
      return;
    }
    const now = Date.now();
    const me = players.get(id);
    if (!me || !isAlive(me, now) || me.hall < 0 || me.hall >= HALL_COUNT) {
      sendJson(res, 409, { ok: false, error: 'not_in_hall' });
      return;
    }
    const text = cleanText(data.text);
    if (!text) {
      sendJson(res, 400, { ok: false, error: 'empty' });
      return;
    }
    const last = chatTimes.get(id) || 0;
    if (now - last < CHAT_GAP_MS) {
      sendJson(res, 429, { ok: false, error: 'too_fast' });
      return;
    }
    chatTimes.set(id, now);

    const hall = halls[me.hall];
    hall.msgSeq += 1;
    const msg = { seq: hall.msgSeq, id, name: me.name, text, at: now };
    hall.messages.push(msg);
    if (hall.messages.length > CHAT_KEEP) hall.messages.shift();

    sendJson(res, 200, { ok: true, seq: msg.seq, at: now, hall: me.hall });
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(req, res, url.pathname);
    return;
  }

  sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
});

setInterval(() => {
  const now = Date.now();
  for (const [id, p] of players) {
    if (now - p.lastSeen > TTL_MS) {
      const hall = halls[p.hall];
      if (hall) {
        if (p.seat !== null && hall.seats[p.seat] === id) hall.seats[p.seat] = null;
        const w = hall.waiting.indexOf(id);
        if (w >= 0) hall.waiting.splice(w, 1);
      }
      players.delete(id);
    }
  }
  for (const hall of halls) {
    pruneQueue(hall, now);
    fillSeats(hall, now);
    while (hall.messages.length && now - hall.messages[0].at > CHAT_TTL_MS) {
      hall.messages.shift();
    }
  }
  for (const [id, at] of chatTimes) {
    if (now - at > CHAT_TTL_MS) chatTimes.delete(id);
  }
}, 4000).unref();

server.listen(PORT, '0.0.0.0', () => {
  console.log('daoyuan server listening on ' + PORT);
});

// 让离开的玩家尽快释放蒲团
process.on('SIGTERM', () => server.close(() => process.exit(0)));
