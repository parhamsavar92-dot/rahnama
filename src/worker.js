/* ==========================================================================
   رهنما — سرور واقعی (Cloudflare Worker + D1)
   --------------------------------------------------------------------------
   • ورود/ثبت‌نام/خروج، رمز با PBKDF2، نشست با کوکی HttpOnly
   • محدودیت تلاش ورود، بررسی Origin، سقف حجم درخواست
   • پنل مدیریت، کلاس مجازی، پروفایل: همان منطق مرورگر (engine.js) ولی روی دادهٔ D1
   • دستیار هوشمند: Anthropic (اگر کلید ست شود) یا Workers AI (اگر binding باشد)
   ========================================================================== */
import { createEngine } from "./engine.js";

const OWNER_DEFAULT = "parham.savar92@gmail.com";
const VERSION = "6.0";
const ITER = 100000;               // سقف PBKDF2 در Workers
const SESSION_MS = 30 * 864e5;
const MAX_BODY = 2 * 1024 * 1024;
const COOKIE = "hk_sid";
const UPTIME_START = Date.now();

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, json TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS creds (uid TEXT PRIMARY KEY, hash TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS sessions (th TEXT PRIMARY KEY, uid TEXT NOT NULL, exp INTEGER NOT NULL)",
  "CREATE INDEX IF NOT EXISTS sessions_uid ON sessions(uid)",
  "CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL)"
];

const enc = new TextEncoder();
let booted = null;           // یک‌بار برای هر isolate
let defaultsCache = null;

/* ------------------------------------------------------------ ابزارها */
function json(obj, status, extra) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  if (extra) for (const k in extra) h.append(k, extra[k]);
  return new Response(JSON.stringify(obj), { status: status || 200, headers: h });
}
const err = (msg, status) => json({ error: msg }, status || 400);
const b64 = (buf) => { let s = ""; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const b64url = (buf) => b64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function newId(p) { const a = crypto.getRandomValues(new Uint8Array(8)); return p + "_" + b64url(a); }

async function sha256hex(s) {
  const h = await crypto.subtle.digest("SHA-256", enc.encode(s));
  return Array.from(new Uint8Array(h)).map((x) => x.toString(16).padStart(2, "0")).join("");
}
async function pbkdf2(pw, salt, iter) {
  const k = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: iter }, k, 256);
}
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
async function hashPw(pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return "p1$" + ITER + "$" + b64(salt) + "$" + b64(await pbkdf2(pw, salt, ITER));
}
const DUMMY = "p1$" + ITER + "$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";
async function checkPw(pw, stored) {
  const p = String(stored || DUMMY).split("$");
  if (p[0] !== "p1" || p.length !== 4) return false;
  const out = new Uint8Array(await pbkdf2(String(pw), unb64(p[2]), Math.min(+p[1] || ITER, ITER)));
  return safeEqual(out, unb64(p[3])) && !!stored;
}

function ownerEmailOf(env) { return String(env.OWNER_EMAIL || OWNER_DEFAULT).trim().toLowerCase(); }
function cfgOf(env) { return { ownerEmail: ownerEmailOf(env), staffCode: env.STAFF_CODE || "" }; }
function cookieOf(req) { const m = new RegExp("(?:^|;\\s*)" + COOKIE + "=([A-Za-z0-9_-]{20,64})").exec(req.headers.get("Cookie") || ""); return m ? m[1] : ""; }
function setCookie(token, maxAge) {
  return COOKIE + "=" + token + "; Path=/; Max-Age=" + maxAge + "; HttpOnly; Secure; SameSite=Lax";
}

/* ------------------------------------------------------------ راه‌اندازی دیتابیس و مالک */
async function boot(env) {
  if (booted) return booted;
  booted = (async () => {
    const db = env.DB;
    await db.batch(SCHEMA.map((s) => db.prepare(s)));
    const email = ownerEmailOf(env);
    const row = await db.prepare("SELECT id, json FROM users WHERE email = ?").bind(email).first();
    const pw = env.OWNER_PASSWORD ? String(env.OWNER_PASSWORD) : "";
    if (!row) {
      if (pw) {
        const t = Date.now();
        const u = {
          id: "owner", name: "مالک سایت", email, role: "owner", roleFa: "مالک سایت", grade: "8", school: "", city: "",
          banned: false, verified: true, isOwner: true, createdAt: t, lastAt: t,
          lessonsRead: 0, exams: 0, notes: 0, studyMinutes: 0, color: "#6d5efc", progress: {}
        };
        await db.batch([
          db.prepare("INSERT OR IGNORE INTO users(id,email,json) VALUES(?,?,?)").bind(u.id, email, JSON.stringify(u)),
          db.prepare("INSERT OR REPLACE INTO creds(uid,hash) VALUES(?,?)").bind(u.id, await hashPw(pw))
        ]);
      }
    } else {
      const u = JSON.parse(row.json);
      if (!u.isOwner || u.role !== "owner" || !u.verified || u.banned) {
        Object.assign(u, { isOwner: true, role: "owner", roleFa: "مالک سایت", verified: true, banned: false });
        await db.prepare("UPDATE users SET json = ? WHERE id = ?").bind(JSON.stringify(u), row.id).run();
      }
      const c = await db.prepare("SELECT 1 AS x FROM creds WHERE uid = ?").bind(row.id).first();
      if (!c && pw) await db.prepare("INSERT OR REPLACE INTO creds(uid,hash) VALUES(?,?)").bind(row.id, await hashPw(pw)).run();
    }
  })().catch((e) => { booted = null; throw e; });
  return booted;
}

function defaultSettings(env) {
  if (!defaultsCache) {
    const LS = { getItem: () => null, setItem() {}, removeItem() {} };
    defaultsCache = createEngine(LS, cfgOf(env)).defaults();
  }
  return JSON.parse(JSON.stringify(defaultsCache));
}

/* ------------------------------------------------------------ محدودیت نرخ */
async function hit(db, key, max, windowMs) {
  const t = Date.now();
  const r = await db.prepare("SELECT n, reset FROM rate WHERE k = ?").bind(key).first();
  if (!r || r.reset < t) {
    await db.prepare("INSERT OR REPLACE INTO rate(k,n,reset) VALUES(?,?,?)").bind(key, 1, t + windowMs).run();
    return true;
  }
  if (r.n >= max) return false;
  await db.prepare("UPDATE rate SET n = n + 1 WHERE k = ?").bind(key).run();
  return true;
}

/* ------------------------------------------------------------ نشست */
async function newSession(db, uid) {
  const token = b64url(crypto.getRandomValues(new Uint8Array(32)));
  await db.prepare("INSERT INTO sessions(th,uid,exp) VALUES(?,?,?)").bind(await sha256hex(token), uid, Date.now() + SESSION_MS).run();
  return token;
}
const ms = (n) => Math.floor(n / 1000);

/* ------------------------------------------------------------ دادهٔ مشترک (events/audit) */
async function appendDoc(db, key, entries, cap) {
  if (!entries.length) return;
  const r = await db.prepare("SELECT v FROM kv WHERE k = ?").bind(key).first();
  let arr = []; try { arr = r ? JSON.parse(r.v) : []; } catch (e) { arr = []; }
  arr = entries.concat(arr).slice(0, cap || 900);
  await db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").bind(key, JSON.stringify(arr)).run();
}

/* ------------------------------------------------------------ بارگذاری/ذخیرهٔ وضعیت برای موتور */
const KV_SETS = {
  light: ["settings"],
  cls: ["settings", "classes", "sessions"],
  heavy: ["settings", "events", "audit", "classes", "sessions", "messages", "reports"]
};
function planOf(seg) {
  if (seg[0] === "admin") return { kv: "heavy", all: true };
  if (seg[0] === "class") {
    const sub = seg.slice(1).join("/");
    return { kv: "cls", all: sub === "create" || sub === "overview" || sub === "attendance" };
  }
  return { kv: "light", all: false };
}

async function loadState(env, plan, tokenHash) {
  const db = env.DB, t = Date.now();
  const keys = KV_SETS[plan.kv];
  const wantRooms = plan.kv !== "light";
  const ph = keys.map(() => "?").join(",");
  const stmts = [
    db.prepare("SELECT s.uid AS uid, u.json AS json FROM sessions s JOIN users u ON u.id = s.uid WHERE s.th = ? AND s.exp > ?").bind(tokenHash || "-", t),
    db.prepare("SELECT k, v FROM kv WHERE k IN (" + ph + ")" + (wantRooms ? " OR k LIKE 'room:%'" : "")).bind(...keys)
  ];
  if (plan.all) stmts.push(db.prepare("SELECT id, email, json FROM users"));
  const res = await db.batch(stmts);
  const sRow = (res[0].results || [])[0] || null;
  const kvRows = res[1].results || [];

  const state = {
    v: 4, _chk: 1, users: [], settings: null, events: [], audit: [], classes: [], sessions: [],
    rooms: {}, messages: [], reports: [], rate: {}
  };
  const orig = { users: new Map(), kv: new Map(), rooms: new Map(), loaded: new Set(keys) };

  if (plan.all) {
    for (const r of res[2].results || []) { orig.users.set(r.id, { js: r.json, email: r.email }); state.users.push(JSON.parse(r.json)); }
  } else if (sRow) {
    const u = JSON.parse(sRow.json);
    orig.users.set(u.id, { js: sRow.json, email: u.email });
    state.users.push(u);
  }
  for (const r of kvRows) {
    if (r.k.startsWith("room:")) {
      try { const id = r.k.slice(5); state.rooms[id] = JSON.parse(r.v); orig.rooms.set(id, r.v); } catch (e) { /* خراب */ }
    } else {
      try { state[r.k] = JSON.parse(r.v); orig.kv.set(r.k, r.v); } catch (e) { /* خراب */ }
    }
  }
  if (!state.settings) state.settings = defaultSettings(env);

  let uid = sRow ? sRow.uid : null;
  if (uid) {
    const me = state.users.find((x) => x.id === uid);
    if (!me || (me.banned && !me.isOwner)) uid = null;
  }
  return { state, orig, uid, plan };
}

async function persist(env, ctx) {
  const { state, orig, plan } = ctx;
  const db = env.DB, st = [], pending = [];
  const ownerEmail = ownerEmailOf(env);
  const seen = new Set();

  for (const u of state.users) {
    seen.add(u.id);
    const np = u._np; delete u._np; delete u.ph; delete u.pass;
    const js = JSON.stringify(u);
    const o = orig.users.get(u.id);
    if (!o || o.js !== js) {
      st.push(db.prepare("INSERT INTO users(id,email,json) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET email = excluded.email, json = excluded.json")
        .bind(u.id, String(u.email).toLowerCase(), js));
    }
    if (np != null) pending.push([u.id, np]);
  }
  for (const [id, o] of orig.users) {
    if (seen.has(id) || String(o.email).toLowerCase() === ownerEmail) continue;
    st.push(db.prepare("DELETE FROM users WHERE id = ?").bind(id));
    st.push(db.prepare("DELETE FROM creds WHERE uid = ?").bind(id));
    st.push(db.prepare("DELETE FROM sessions WHERE uid = ?").bind(id));
  }

  for (const k of ["settings", "classes", "sessions", "messages", "reports"]) {
    if (!orig.loaded.has(k)) continue;
    const js = JSON.stringify(state[k]);
    if (orig.kv.get(k) !== js) st.push(db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").bind(k, js));
  }

  if (plan.kv !== "light") {
    const sessById = new Map((state.sessions || []).map((s) => [s.id, s]));
    for (const [id, r] of Object.entries(state.rooms || {})) {
      const s = sessById.get(id);
      if (s && s.status === "ended" && Date.now() - (s.endedAt || 0) > 864e5) {
        if (orig.rooms.has(id)) st.push(db.prepare("DELETE FROM kv WHERE k = ?").bind("room:" + id));
        continue;
      }
      const js = JSON.stringify(r);
      if (orig.rooms.get(id) !== js) st.push(db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").bind("room:" + id, js));
    }
    for (const id of orig.rooms.keys()) {
      if (!(id in (state.rooms || {}))) st.push(db.prepare("DELETE FROM kv WHERE k = ?").bind("room:" + id));
    }
  }

  if (st.length) await db.batch(st);

  // رویدادها و گزارش اقدامات: افزودن امن (بدون پاک‌کردن ورودی‌های هم‌زمان)
  for (const k of ["events", "audit"]) {
    const cur = state[k] || [];
    if (orig.loaded.has(k)) {
      const old = JSON.parse(orig.kv.get(k) || "[]");
      const oldIds = new Set(old.map((x) => x.id)), curIds = new Set(cur.map((x) => x.id));
      const removed = old.some((x) => !curIds.has(x.id));
      if (removed) await db.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES(?,?)").bind(k, JSON.stringify(cur)).run();
      else await appendDoc(db, k, cur.filter((x) => !oldIds.has(x.id)), 900);
    } else {
      await appendDoc(db, k, cur, 900);
    }
  }

  for (const [id, pw] of pending) {
    await db.prepare("INSERT OR REPLACE INTO creds(uid,hash) VALUES(?,?)").bind(id, await hashPw(pw)).run();
  }
}

/* ------------------------------------------------------------ مسیرهای ورود و حساب */
function ev(type, meta) { return { id: newId("ev"), t: Date.now(), type, meta: meta || {} }; }
function au(action, target, by, meta) { return { id: newId("au"), t: Date.now(), action, target: target || "—", by: by || "system", meta: meta || {} }; }
const pubUser = (u) => { const c = Object.assign({}, u); delete c.ph; delete c.pass; delete c.ownerInit; delete c._np; return c; };
const ROLE_FA_STUDENT = "دانش‌آموز";

async function readSettings(env) {
  const r = await env.DB.prepare("SELECT v FROM kv WHERE k = 'settings'").first();
  if (!r) return defaultSettings(env);
  try { return JSON.parse(r.v); } catch (e) { return defaultSettings(env); }
}

async function handleRegister(env, req, body) {
  const db = env.DB;
  const ip = req.headers.get("CF-Connecting-IP") || "x";
  if (!(await hit(db, "reg:" + ip, 10, 3600e3))) return err("تعداد ثبت‌نام از این شبکه زیاد است؛ کمی بعد دوباره تلاش کن.", 429);
  const em = String(body.email || "").trim().toLowerCase();
  const pw = String(body.password || "");
  if (!em || !pw) return err("ایمیل و رمز لازم است.");
  if (em.length > 120 || !/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(em)) return err("ایمیل معتبر نیست.");
  if (pw.length < 6) return err("رمز باید حداقل ۶ نویسه باشد.");
  if (pw.length > 200) return err("رمز خیلی طولانی است.");
  const settings = await readSettings(env);
  if (settings.registrationOpen === false) return err("ثبت‌نام فعلاً بسته است.", 403);
  const exists = await db.prepare("SELECT 1 AS x FROM users WHERE email = ?").bind(em).first();
  if (exists || em === ownerEmailOf(env)) return err("این ایمیل قبلاً ثبت شده است.");
  const t = Date.now();
  const grade = ["7", "8", "9"].includes(String(body.grade)) ? String(body.grade) : "8";
  const u = {
    id: newId("u"), name: String(body.name || "کاربر تازه").trim().slice(0, 60) || "کاربر تازه", email: em,
    role: "student", roleFa: ROLE_FA_STUDENT, grade, school: String(body.school || "").slice(0, 60), city: String(body.city || "").slice(0, 40),
    banned: false, verified: false, isOwner: false, createdAt: t, lastAt: t,
    lessonsRead: 0, exams: 0, notes: 0, studyMinutes: 0, color: "#6d5efc", progress: {}
  };
  const hash = await hashPw(pw);
  try {
    await db.batch([
      db.prepare("INSERT INTO users(id,email,json) VALUES(?,?,?)").bind(u.id, em, JSON.stringify(u)),
      db.prepare("INSERT INTO creds(uid,hash) VALUES(?,?)").bind(u.id, hash)
    ]);
  } catch (e) { return err("این ایمیل قبلاً ثبت شده است."); }
  const token = await newSession(db, u.id);
  await appendDoc(db, "events", [ev("register", { email: em, grade })], 900);
  await appendDoc(db, "audit", [au("user.register", em, em)], 900);
  return json({ user: pubUser(u) }, 200, { "Set-Cookie": setCookie(token, ms(SESSION_MS)) });
}

async function handleLogin(env, req, body) {
  const db = env.DB;
  const ip = req.headers.get("CF-Connecting-IP") || "x";
  const em = String(body.email || "").trim().toLowerCase();
  const key = "login:" + ip + ":" + em;
  if (!(await hit(db, key, 10, 600e3))) return err("تلاش‌های ناموفق زیاد بود؛ ۱۰ دقیقه بعد دوباره امتحان کن.", 429);
  const row = em ? await db.prepare("SELECT u.id AS id, u.json AS json, c.hash AS hash FROM users u LEFT JOIN creds c ON c.uid = u.id WHERE u.email = ?").bind(em).first() : null;
  const okPw = await checkPw(body.password == null ? "" : body.password, row && row.hash);
  if (!row || !okPw) return err("ایمیل یا رمز اشتباه است.", 401);
  const u = JSON.parse(row.json);
  if (u.banned && !u.isOwner) return err("حساب شما مسدود است.", 403);
  u.lastAt = Date.now();
  const token = await newSession(db, u.id);
  await db.batch([
    db.prepare("UPDATE users SET json = ? WHERE id = ?").bind(JSON.stringify(u), u.id),
    db.prepare("DELETE FROM rate WHERE k = ?").bind(key)
  ]);
  await appendDoc(db, "events", [ev("login", { email: em })], 900);
  return json({ user: pubUser(u) }, 200, { "Set-Cookie": setCookie(token, ms(SESSION_MS)) });
}

async function handleLogout(env, req) {
  const tk = cookieOf(req);
  if (tk) await env.DB.prepare("DELETE FROM sessions WHERE th = ?").bind(await sha256hex(tk)).run();
  return json({ ok: true }, 200, { "Set-Cookie": setCookie("", 0) });
}

async function handlePassword(env, req, body, uid) {
  if (!uid) return err("وارد شوید.", 401);
  const db = env.DB;
  const nx = String(body.password || body.next || "");
  if (nx.length < 6) return err("رمز جدید باید حداقل ۶ نویسه باشد.");
  if (nx.length > 200) return err("رمز خیلی طولانی است.");
  if (!(await hit(db, "pw:" + uid, 8, 600e3))) return err("تلاش زیاد بود؛ کمی بعد دوباره امتحان کن.", 429);
  const c = await db.prepare("SELECT hash FROM creds WHERE uid = ?").bind(uid).first();
  if (!(await checkPw(body.current == null ? "" : body.current, c && c.hash))) return err("رمز فعلی نادرست است.", 403);
  const keep = await sha256hex(cookieOf(req));
  await db.batch([
    db.prepare("INSERT OR REPLACE INTO creds(uid,hash) VALUES(?,?)").bind(uid, await hashPw(nx)),
    db.prepare("DELETE FROM sessions WHERE uid = ? AND th != ?").bind(uid, keep)   // بقیهٔ دستگاه‌ها خارج می‌شوند
  ]);
  await appendDoc(db, "audit", [au("me.password", uid, uid)], 900);
  return json({ ok: true });
}

/* فقط بخش‌های عمومی تنظیمات به بیرون داده می‌شود (بدون پیام‌های مدیر،
   سقف‌های داخلی و سایر داده‌های مدیریتی). */
function publicSettings(s) {
  return {
    registrationOpen: s.registrationOpen !== false,
    maintenance: !!s.maintenance,
    maintenanceNote: s.maintenanceNote,
    aiEnabled: s.aiEnabled !== false,
    allowedGrades: s.allowedGrades || ["7", "8", "9"],
    announcement: s.announcement || { active: false },
    features: s.features || {},
    hero: s.hero || {},
    contact: s.contact || {},
    theme: s.theme || "",
    siteNotice: s.siteNotice || "",
    examDefaults: s.examDefaults || { count: 20, minutes: 15, pass: 60 }
  };
}

async function handleSiteStatus(env) {
  const s = await readSettings(env);
  const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
  const pub = publicSettings(s);
  return json({
    ok: true, online: true, version: VERSION, server: "d1",
    announcement: pub.announcement, settings: pub, features: pub.features,
    hero: pub.hero, contact: pub.contact, theme: pub.theme, note: pub.siteNotice,
    maintenance: pub.maintenance, users: n ? n.n : 0
  });
}

/* ------------------------------------------------------------ سلامت سیستم */
async function handleHealth(env) {
  const t0 = Date.now();
  let db = false, users = 0;
  try {
    const r = await env.DB.prepare("SELECT COUNT(*) AS n FROM users").first();
    users = r ? r.n : 0; db = true;
  } catch (e) { db = false; }
  const plan = aiPlan(env);
  return json({
    ok: db, version: VERSION, server: "d1", online: true,
    db: { ok: db, latencyMs: Date.now() - t0, users: users },
    ai: { configured: plan.order.length > 0, providers: plan.order, defaultModel: plan.order.length ? plan.have[plan.order[0]].model : null },
    assets: !!env.ASSETS,
    uptimeSeconds: Math.round((Date.now() - UPTIME_START) / 1000),
    time: new Date().toISOString()
  }, db ? 200 : 503);
}

/* ------------------------------------------------------------ دستیار هوشمند
   ─ چند ارائه‌دهنده، بدون قفل‌شدن به یک سرویس ─
   • anthropic  : ANTHROPIC_API_KEY
   • openai     : هر سرویس سازگار با OpenAI (OpenAI / OpenRouter / Groq /
                  DeepSeek / Together / Ollama و…) با OPENAI_API_KEY و اختیاری
                  AI_BASE_URL
   • gemini     : GEMINI_API_KEY
   • workersai  : اتصال Workers AI با نام AI (بدون کلید)
   ترتیب انتخاب با AI_PROVIDER قابل تعیین است؛ اگر هیچ‌کدام نبود، سایت خودش
   با موتور محلی پاسخ می‌دهد و این مسیر با پیام روشن ۵۰۳ برمی‌گردد.
   پاسخ‌ها هم به شکل معمولی و هم با «پخش زنده» (SSE سازگار با OpenAI) هستند. */
const AI_DEFAULTS = {
  anthropic: { model: "claude-haiku-5-5", base: "https://api.anthropic.com" },
  openai: { model: "gpt-4o-mini", base: "https://api.openai.com/v1" },
  gemini: { model: "gemini-2.0-flash", base: "https://generativelanguage.googleapis.com/v1beta" },
  workersai: { model: "@cf/meta/llama-3.1-8b-instruct", base: "" }
};
const AI_SYS_BASE = "تو دستیار درسی «رهنما» برای دانش‌آموزان دورهٔ اول متوسطه (پایه‌های هفتم، هشتم و نهم) هستی. همیشه فارسی، ساده، دقیق و مرحله‌به‌مرحله پاسخ بده. اگر متن جزوه در اختیارت گذاشته شد، فقط بر پایهٔ همان پاسخ بده و از خودت مطلب اضافه نکن.";
const dec = new TextDecoder();

function aiPlan(env, pref) {
  const want = String(pref || env.AI_PROVIDER || "").trim().toLowerCase();
  const order = [];
  const push = (id) => { if (id && order.indexOf(id) === -1) order.push(id); };
  push(want);
  if (env.ANTHROPIC_API_KEY) push("anthropic");
  if (env.OPENAI_API_KEY || env.AI_BASE_URL) push("openai");
  if (env.GEMINI_API_KEY) push("gemini");
  if (env.AI && env.AI.run) push("workersai");
  const have = {};
  for (const id of order) {
    if (id === "anthropic" && env.ANTHROPIC_API_KEY) have[id] = { key: env.ANTHROPIC_API_KEY, base: String(env.AI_BASE_URL || AI_DEFAULTS.anthropic.base).replace(/\/+$/, ""), model: env.AI_MODEL || AI_DEFAULTS.anthropic.model };
    else if (id === "openai" && (env.OPENAI_API_KEY || env.AI_BASE_URL)) have[id] = { key: env.OPENAI_API_KEY || "", base: String(env.AI_BASE_URL || AI_DEFAULTS.openai.base).replace(/\/+$/, ""), model: env.AI_MODEL || AI_DEFAULTS.openai.model };
    else if (id === "gemini" && env.GEMINI_API_KEY) have[id] = { key: env.GEMINI_API_KEY, base: String(env.AI_BASE_URL || AI_DEFAULTS.gemini.base).replace(/\/+$/, ""), model: env.AI_MODEL || AI_DEFAULTS.gemini.model };
    else if (id === "workersai") have[id] = { key: "", base: "", model: env.AI_MODEL || AI_DEFAULTS.workersai.model };
  }
  return { order: order.filter((id) => have[id]), have };
}

const aiChunk = (t) => ({ choices: [{ index: 0, delta: { content: t } }] });
const aiBody = (text) => ({ choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }] });

/* خط‌های SSE را به جریان سازگار با OpenAI تبدیل می‌کند */
function toOpenAIStream(src, pick) {
  let buf = "";
  return new ReadableStream({
    async start(ctrl) {
      const reader = src.getReader();
      const emit = (t) => { if (t) ctrl.enqueue(enc.encode("data: " + JSON.stringify(aiChunk(t)) + "\n\n")); };
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n")) > -1) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line || line.indexOf("data:") !== 0) continue;
            const payload = line.slice(5).trim();
            if (payload === "[DONE]") continue;
            try { emit(pick(JSON.parse(payload))); } catch (e) { /* خط ناقص */ }
          }
        }
      } catch (e) { /* جریان قطع شد */ }
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
    cancel(reason) { try { src.cancel(reason); } catch (e) {} }
  });
}

/* یک جریان متن خام (Workers AI) را به SSE تبدیل می‌کند */
function rawToOpenAIStream(src) {
  return new ReadableStream({
    async start(ctrl) {
      const reader = src.getReader();
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          const t = typeof value === "string" ? value : dec.decode(value, { stream: true });
          if (t) ctrl.enqueue(enc.encode("data: " + JSON.stringify(aiChunk(t)) + "\n\n"));
        }
      } catch (e) { /* قطع */ }
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    }
  });
}

async function aiRun(env, provider, cfg, sys, conv, stream) {
  const msgs = conv.length ? conv : [{ role: "user", content: "سلام" }];
  const H = { "content-type": "application/json" };

  if (provider === "anthropic") {
    const r = await fetch(cfg.base + "/v1/messages", {
      method: "POST",
      headers: Object.assign({ "x-api-key": cfg.key, "anthropic-version": "2023-06-01" }, H),
      body: JSON.stringify({ model: cfg.model, max_tokens: 1400, system: sys, messages: msgs, stream: !!stream })
    });
    if (!r.ok) throw new Error("anthropic " + r.status);
    if (!stream) {
      const j = await r.json();
      return { text: (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("") };
    }
    return { stream: toOpenAIStream(r.body, (o) => o.type === "content_block_delta" && o.delta ? o.delta.text : "") };
  }

  if (provider === "openai") {
    const h = Object.assign({}, H);
    if (cfg.key) h.authorization = "Bearer " + cfg.key;
    const r = await fetch(cfg.base + "/chat/completions", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ model: cfg.model, messages: [{ role: "system", content: sys }].concat(msgs), max_tokens: 1400, temperature: 0.4, stream: !!stream })
    });
    if (!r.ok) throw new Error("openai " + r.status);
    if (!stream) {
      const j = await r.json();
      const c = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
      return { text: String(c || "") };
    }
    return { stream: toOpenAIStream(r.body, (o) => (o.choices && o.choices[0] && o.choices[0].delta ? o.choices[0].delta.content : "") || "") };
  }

  if (provider === "gemini") {
    const contents = msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const url = cfg.base + "/models/" + encodeURIComponent(cfg.model) + (stream ? ":streamGenerateContent?alt=sse&key=" : ":generateContent?key=") + encodeURIComponent(cfg.key);
    const r = await fetch(url, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: contents, generationConfig: { temperature: 0.4, maxOutputTokens: 1400 } })
    });
    if (!r.ok) throw new Error("gemini " + r.status);
    const pickG = (o) => {
      try { return o.candidates[0].content.parts.map((p) => p.text || "").join(""); } catch (e) { return ""; }
    };
    if (!stream) { const j = await r.json(); return { text: pickG(j) }; }
    return { stream: toOpenAIStream(r.body, pickG) };
  }

  if (provider === "workersai") {
    const out = await env.AI.run(cfg.model, { messages: [{ role: "system", content: sys }].concat(msgs), max_tokens: 1200, stream: !!stream });
    if (stream && out && typeof out.getReader === "function") return { stream: rawToOpenAIStream(out) };
    if (stream && out instanceof ReadableStream) return { stream: rawToOpenAIStream(out) };
    return { text: String((out && (out.response || out.result)) || "") };
  }

  throw new Error("no provider");
}

async function bumpAI(env, provider) {
  try {
    const day = new Date().toISOString().slice(0, 10);
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k = 'ai:usage'").first();
    let o = {}; try { o = r ? JSON.parse(r.v) : {}; } catch (e) { o = {}; }
    const cur = o[day] || { total: 0, by: {} };
    cur.total++; cur.by[provider] = (cur.by[provider] || 0) + 1;
    o[day] = cur;
    const keys = Object.keys(o).sort().slice(-30), trimmed = {};
    for (const k of keys) trimmed[k] = o[k];
    await env.DB.prepare("INSERT OR REPLACE INTO kv(k,v) VALUES('ai:usage',?)").bind(JSON.stringify(trimmed)).run();
  } catch (e) { /* شمارش بی‌اثر است؛ جلوی پاسخ را نمی‌گیرد */ }
}

async function handleAI(env, req, body, uid) {
  if (!uid) return err("برای استفاده از دستیار وارد شوید.", 401);
  const s = await readSettings(env);
  if (s.aiEnabled === false) return err("دستیار موقتاً خاموش است.", 503);
  if (!(await hit(env.DB, "ai:" + uid, 40, 600e3))) return err("سؤال‌های زیادی پرسیدی؛ چند دقیقه بعد دوباره امتحان کن.", 429);
  const msgs = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  if (!msgs.length) return err("پیام خالی است.");
  const clean = msgs.map((m) => ({
    role: m.role === "assistant" ? "assistant" : (m.role === "system" ? "system" : "user"),
    content: String(m.content || "").slice(0, 8000)
  })).filter((m) => m.content);
  const sys = clean.filter((m) => m.role === "system").map((m) => m.content).join("\n");
  const conv = clean.filter((m) => m.role !== "system");
  const student = String(body.grade || "").trim();
  const ctx = String(body.context || "").slice(0, 12000);
  let SYS = (sys ? sys + "\n" : "") + AI_SYS_BASE;
  if (student) SYS += "\nپایهٔ تحصیلی کاربر: " + student + ".";
  if (ctx) SYS += "\n\n— متن جزوهٔ مرتبط (تنها منبع مجاز) —\n" + ctx;

  const plan = aiPlan(env, body.provider);
  if (!plan.order.length) {
    return err("دستیار هوشمند روی سرور تنظیم نشده است؛ ANSWERS از موتور محلی سایت استفاده می‌کند. برای فعال‌سازی، یکی از این‌ها را در تنظیمات Worker بگذار: ANTHROPIC_API_KEY، OPENAI_API_KEY، GEMINI_API_KEY یا اتصال Workers AI با نام AI.", 503);
  }
  const wantStream = !!body.stream;
  let lastErr = null;
  for (const id of plan.order) {
    try {
      const out = await aiRun(env, id, plan.have[id], SYS, conv, wantStream);
      await bumpAI(env, id);
      if (out.stream) {
        return new Response(out.stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-AI-Provider": id, "X-Accel-Buffering": "no" }
        });
      }
      return json(
        Object.assign({ provider: id, model: plan.have[id].model }, aiBody(String(out.text || ""))),
        200,
        { "X-AI-Provider": id }
      );
    } catch (e) { lastErr = e; }
  }
  console.error("AI providers failed:", lastErr && lastErr.message);
  return err("سرویس دستیار پاسخ نداد؛ کمی بعد دوباره امتحان کن.", 502);
}

/* ------------------------------------------------------------ مسیریاب اصلی */
async function api(req, env, url) {
  const path = url.pathname;
  const method = req.method.toUpperCase();
  if (path === "/api/__status") {
    const ready = !!(await env.DB.prepare("SELECT 1 AS x FROM users WHERE email = ?").bind(ownerEmailOf(env)).first());
    return json({ ok: true, online: true, server: "d1", version: VERSION, ownerReady: ready });
  }
  if (path === "/api/health") return handleHealth(env);
  if (method !== "GET" && method !== "HEAD") {
    const origin = req.headers.get("Origin");
    if (origin) { try { if (new URL(origin).host !== url.host) return err("درخواست از مبدأ نامعتبر.", 403); } catch (e) { return err("مبدأ نامعتبر.", 403); } }
    const len = +(req.headers.get("Content-Length") || 0);
    if (len > MAX_BODY) return err("حجم درخواست زیاد است.", 413);
  }
  let body = {};
  if (method !== "GET" && method !== "HEAD") {
    const txt = await req.text();
    if (txt.length > MAX_BODY) return err("حجم درخواست زیاد است.", 413);
    if (txt) { try { body = JSON.parse(txt); } catch (e) { return err("درخواست نامعتبر است."); } }
    if (!body || typeof body !== "object" || Array.isArray(body)) body = {};
  }
  const q = {}; url.searchParams.forEach((v, k) => { q[k] = v; });
  const seg = path.replace(/^\/api\//, "").split("/").filter(Boolean);
  const route = seg.join("/");

  if (route === "auth/register" && method === "POST") return handleRegister(env, req, body);
  if (route === "auth/login" && method === "POST") return handleLogin(env, req, body);
  if (route === "auth/logout") return handleLogout(env, req);
  if (route === "site/status" && method === "GET") return handleSiteStatus(env);

  const token = cookieOf(req);
  const tokenHash = token ? await sha256hex(token) : "";
  const plan = planOf(seg);
  const ctx = await loadState(env, plan, tokenHash);
  let uid = ctx.uid;

  if (route === "me/password" && method === "POST") return handlePassword(env, req, body, uid);
  if (seg[0] === "ai") return handleAI(env, req, body, uid);

  // آمار مصرف دستیار روی سرور (فقط مدیر/مالک)
  if (route === "admin/ai-usage" && method === "GET") {
    const meU = (ctx.state.users || []).filter((x) => x.id === uid)[0];
    if (!meU) return err("ابتدا وارد حساب شوید.", 401);
    if (!(meU.isOwner || meU.role === "admin" || meU.role === "owner")) return err("دسترسی ندارید.", 403);
    const r = await env.DB.prepare("SELECT v FROM kv WHERE k = 'ai:usage'").first();
    let usage = {}; try { usage = r ? JSON.parse(r.v) : {}; } catch (e) { usage = {}; }
    const plan = aiPlan(env);
    const days = Object.keys(usage).sort().slice(-14).map((d) => Object.assign({ day: d }, usage[d]));
    const total = days.reduce((a, x) => a + (+x.total || 0), 0);
    return json({ usage: days, total: total, providers: plan.order, model: plan.order.length ? plan.have[plan.order[0]].model : null });
  }

  // موتور مشترک (همان منطق پنل/کلاس/پروفایل)
  const store = { "hk:db:v4": JSON.stringify(ctx.state), "hk:sid": uid };
  let dirty = false, sidCleared = false;
  const LS = {
    getItem: (k) => (k in store && store[k] != null ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); if (k === "hk:db:v4") dirty = true; },
    removeItem: (k) => { if (k === "hk:sid") sidCleared = true; delete store[k]; }
  };
  const engine = createEngine(LS, cfgOf(env));
  const res = engine.handle("/api/" + route, method, body, q);
  if (dirty) {
    ctx.state = JSON.parse(store["hk:db:v4"]);
    await persist(env, ctx);
  }
  const headers = new Headers(res.headers);
  if (sidCleared) {
    const tk = token;
    const stm = [];
    if (route === "admin/logout-all") stm.push(env.DB.prepare("DELETE FROM sessions"));
    else if (tk) stm.push(env.DB.prepare("DELETE FROM sessions WHERE th = ?").bind(tokenHash));
    if (stm.length) await env.DB.batch(stm);
    headers.append("Set-Cookie", setCookie("", 0));
  }
  headers.set("Cache-Control", "no-store");
  return new Response(res.body, { status: res.status, headers });
}

/* ------------------------------------------------------------ هدرهای امنیتی */
const SEC_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "SAMEORIGIN",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
};
function withSec(res) {
  try {
    const h = new Headers(res.headers);
    for (const k in SEC_HEADERS) if (!h.has(k)) h.set(k, SEC_HEADERS[k]);
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
  } catch (e) { return res; }
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith("/api/")) {
      if (!env.ASSETS) return new Response("Not found", { status: 404, headers: SEC_HEADERS });
      return withSec(await env.ASSETS.fetch(req));
    }
    try {
      if (!env.DB) return json({ error: "دیتابیس D1 به Worker وصل نیست (binding با نام DB)." }, 500);
      await boot(env);
      // پاک‌سازی گاه‌به‌گاه نشست‌ها و شمارنده‌های منقضی
      if (Math.random() < 0.01) {
        ctx.waitUntil(env.DB.batch([
          env.DB.prepare("DELETE FROM sessions WHERE exp < ?").bind(Date.now()),
          env.DB.prepare("DELETE FROM rate WHERE reset < ?").bind(Date.now())
        ]));
      }
      return withSec(await api(req, env, url));
    } catch (e) {
      console.error("API error:", e && e.stack || e);
      return withSec(json({ error: "خطای داخلی سرور؛ دوباره تلاش کن." }, 500));
    }
  }
};
