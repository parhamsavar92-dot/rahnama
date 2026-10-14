/* ==========================================================================
   رهنما — لایهٔ سرورِ سایت  |  hk-server.js
   --------------------------------------------------------------------------
   همهٔ درخواست‌های ‎/api/*‎ را در همین مرورگر پاسخ می‌دهد تا پنل مالک، حساب
   کاربری، کلاس مجازی، کارنامه، مشاور و پیام‌ها بدون خطای «۴۰۴» کار کنند و
   هر اقدامی واقعاً تأثیر بگذارد. داده‌ها در localStorage ذخیره می‌شوند.

   این فایل باید «اولین» اسکریپت هر صفحه باشد.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document, LS = W.localStorage;
  var DB_KEY = "hk:db:v4", SID_KEY = "hk:sid";

  /* ------------------------------------------------------------ ابزارها */
  var now = function () { return Date.now(); };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function jload(k, d) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function jsave(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function uid(p) { return (p || "u") + "_" + Math.random().toString(36).slice(2, 9) + now().toString(36).slice(-4); }
  function code(n) { var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = ""; for (var i = 0; i < (n || 6); i++) o += s[Math.floor(Math.random() * s.length)]; return o; }
  var ROLE_FA = { owner: "مالک سایت", admin: "مدیر", deputy: "ناظم", teacher: "دبیر", student: "دانش‌آموز" };

  /* ------------------------------------------------------------ دادهٔ اولیه */
  var FIRST = ["علی رضایی", "زهرا محمدی", "امیرحسین کریمی", "فاطمه حسینی", "محمد صادقی", "نرگس عبداللهی", "سینا موسوی", "ریحانه نوری", "مهدی اکبری", "آیدا شریفی", "پارسا قاسمی", "یاسمین رحیمی"];
  var SCHOOLS = ["شهید بهشتی", "فرزانگان", "علامه طباطبایی", "نمونهٔ مفید", "دبیرستان البرز", "شاهد", "مدرسهٔ آنلاین رهنما"];
  var CITIES = ["تهران", "مشهد", "اصفهان", "شیراز", "تبریز", "کرج", "رشت", "یزد"];


  /* ------------------------------------------------------------  رمز و حساب مالک */
  function sha256(str) {
    var utf = unescape(encodeURIComponent(String(str)));
    var K = [], H = [], i, j, p = 2, n = 0;
    function frac(x) { return ((x - Math.floor(x)) * 4294967296) | 0; }
    while (n < 64) {
      var prime = true;
      for (i = 2; i * i <= p; i++) if (p % i === 0) { prime = false; break; }
      if (prime) { if (n < 8) H[n] = frac(Math.pow(p, 0.5)); K[n] = frac(Math.pow(p, 1 / 3)); n++; }
      p++;
    }
    var bytes = [];
    for (i = 0; i < utf.length; i++) bytes.push(utf.charCodeAt(i));
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 4294967296), lo = bitLen >>> 0;
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255, (lo >>> 24) & 255, (lo >>> 16) & 255, (lo >>> 8) & 255, lo & 255);
    function rr(x, c) { return (x >>> c) | (x << (32 - c)); }
    for (var off = 0; off < bytes.length; off += 64) {
      var w = [];
      for (i = 0; i < 16; i++) w[i] = (bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) | (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3];
      for (i = 16; i < 64; i++) {
        var s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        var s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (i = 0; i < 64; i++) {
        var S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25), ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        var S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22), mj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + mj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H = [(H[0] + a) | 0, (H[1] + b) | 0, (H[2] + c) | 0, (H[3] + d) | 0, (H[4] + e) | 0, (H[5] + f) | 0, (H[6] + g) | 0, (H[7] + h) | 0];
    }
    var out = "";
    for (j = 0; j < 8; j++) out += ("00000000" + (H[j] >>> 0).toString(16)).slice(-8);
    return out;
  }
  function hashPass(email, pw) { return "s1$" + sha256("hk-rahnama|" + String(email || "").toLowerCase() + "|" + String(pw == null ? "" : pw)); }
  function passOk(u, pw) {
    if (!u) return false;
    if (u.ph) return u.ph === hashPass(u.email, pw);
    return u.pass != null && String(u.pass) === String(pw == null ? "" : pw);
  }
  function setPass(u, pw) { u.ph = hashPass(u.email, pw); delete u.pass; }

  var OWNER_EMAIL = "parham.savar92@gmail.com";
  var OWNER_PH = "";
  var DEMO_EMAIL = /^(user\d{1,3}|owner)@rahnama\.ir$/;

  function ensureOwner(d) {
    var ch = false;
    var keep = d.users.filter(function (u) { return !DEMO_EMAIL.test(String(u.email || "")); });
    if (keep.length !== d.users.length) { d.users = keep; ch = true; }
    var demoIds = {};
    (d.classes || []).forEach(function (c) { if (!c.ownerId || c.ownerId === "owner" || /^u1\d\d$/.test(c.ownerId)) demoIds[c.id] = 1; });
    if (Object.keys(demoIds).length) { d.classes = d.classes.filter(function (c) { return !demoIds[c.id]; }); ch = true; }
    ["events", "audit"].forEach(function (k) {
      var arr = d[k] || [], n = arr.filter(function (x) {
        var em = (x.meta && x.meta.email) || x.by || "";
        return !DEMO_EMAIL.test(String(em));
      });
      if (n.length !== arr.length) { d[k] = n; ch = true; }
    });
    var o = d.users.filter(function (u) { return String(u.email).toLowerCase() === OWNER_EMAIL; })[0];
    if (!o) { /* حالت محلی: مالک با ثبت‌نام همان ایمیل ساخته می‌شود */ } else {
      if (!o.isOwner || o.role !== "owner" || !o.verified || o.banned) ch = true;
      o.isOwner = true; o.role = "owner"; o.roleFa = ROLE_FA.owner; o.verified = true; o.banned = false;
      if (!o.ownerInit) { o.ownerInit = true; ch = true; }
    }
    if (o) d.users.forEach(function (u) {
      if (u !== o && u.isOwner) { u.isOwner = false; if (u.role === "owner") { u.role = "admin"; u.roleFa = ROLE_FA.admin; } ch = true; }
    });
    return ch;
  }

  function seedUsers() {
    return [];
  }

  var DEFAULT_SETTINGS = {
    registrationOpen: true,
    maintenance: false,
    maintenanceNote: "سایت موقتاً در حال به‌روزرسانی است؛ چند دقیقهٔ دیگر برگرد.",
    aiEnabled: true,
    consultEnabled: true,
    // حالت تعمیر — مالک از پنل روشن/خاموش می‌کند و بی‌درنگ روی سایت اعمال می‌شود
    aiMaintenance: false,
    consultMaintenance: false,
    aiMaintenanceNote: "دستیار هوشمند موقتاً در حال تعمیر و به‌روزرسانی است. لطفاً کمی بعد برگرد.",
    consultMaintenanceNote: "مشاورهٔ آنلاین موقتاً در حال تعمیر و به‌روزرسانی است. لطفاً کمی بعد برگرد.",
    allowedGrades: ["7", "8", "9"],
    announcement: { active: false, level: "info", text: "" },
    features: {
      klass: true, exam: true, flashcards: true, ai: true, consult: true, report: true,
      messenger: true, pdf: true, tick: true, leaderboard: true, guestView: true, darkMode: true,
      signup: true, notes: true, highlight: true, speak: true
    },
    hero: { title: "جزوهٔ کامل پایه‌های هفتم، هشتم و نهم", sub: "آنلاین، رایگان و همیشه در دسترس" },
    contact: { email: "", telegram: "", instagram: "", phone: "" },
    theme: "#6d5efc",
    examDefaults: { count: 20, minutes: 15, pass: 60 },
    broadcast: [],
    siteNotice: "کاملاً آنلاین"
  };

  function emptySupport() { return { reqs: [], keys: [] }; }

  function seedDB() {
    var d = {
      v: 4, users: [], settings: clone(DEFAULT_SETTINGS), events: [], audit: [], classes: [],
      sessions: [], rooms: {}, messages: [], reports: [], rate: {}, support: emptySupport()
    };
    ensureOwner(d);
    return d;
  }

  /* ------------------------------------------------------- ذخیره‌سازی ایمن
     ─ باگ واقعی که پیدا شد ─
     DB یک بار هنگام بارگذاری خوانده و در حافظه نگه داشته می‌شد و save()
     همان نسخهٔ حافظه را روی localStorage می‌نوشت. اگر تب دیگری در این فاصله
     کاربر/کلاس تازه اضافه کرده بود، نوشتن این تب آن را پاک می‌کرد.
     نتیجه‌های دیده‌شده: شمار کاربران بین ۱ و ۲ نوسان می‌کرد، خطای الکی
     «این ایمیل قبلاً ثبت شده است» می‌آمد، حساب کاربر ناپدید/پیدا می‌شد و
     شمارندهٔ پنل مدیر با جدول کاربران نمی‌خواند.
     راه‌حل: پیش از هر نوشتن، نسخهٔ تازهٔ دیسک خوانده و با حافظه ادغام
     می‌شود (اتحاد بر پایهٔ شناسه)؛ حذف‌ها هم علامت‌گذاری می‌شوند تا ادغام
     دوباره زنده‌شان نکند. با رویداد storage هم نسخهٔ حافظه تازه می‌شود. */
  /* در «مرورگر» (حالت محلی) ادغام لازم است: DB در حافظهٔ صفحه می‌ماند و تب
     دیگری می‌تواند در این فاصله نسخهٔ تازه‌تری نوشته باشد.
     در «موتور سرور» هر درخواست نسخهٔ تازهٔ خودش را از پایگاه می‌خواند؛ آن‌جا
     ادغام با نسخهٔ «پیش از درخواست» فقط باعث زنده‌شدن رکوردهای حذف‌شده
     می‌شود (کاربر حذف‌شده دوباره می‌توانست وارد شود).
     tools/build-engine.py این مقدار را برای موتور سرور به false تغییر می‌دهد. */
  var MERGE_ON_SAVE = true;
  var ARR_KEYS = ["users", "events", "audit", "classes", "sessions", "messages", "reports"];
  var MAP_KEYS = ["rooms", "rate"];
  var PREV = null;
  function tkey(arr, id) { return arr + ":" + id; }

  function mergeArr(arrName, mem, disk, del) {
    var out = [], seen = {};
    function add(x) {
      if (!x || x.id == null) return;
      var k = String(x.id);
      if (seen[k]) return;
      seen[k] = 1; out.push(x);
    }
    (mem || []).forEach(add);                       // نسخهٔ همین تب اولویت دارد
    (disk || []).forEach(function (x) {
      if (!x || x.id == null) return;
      var k = String(x.id);
      if (seen[k]) return;
      if (del && del[tkey(arrName, k)]) return;     // در این نشست حذف شده است
      add(x);
    });
    return out;
  }

  function mergeDB(disk, mem) {
    if (!disk || disk.v !== 4 || !Array.isArray(disk.users)) return mem;
    var out = clone(mem);
    ARR_KEYS.forEach(function (k) { out[k] = mergeArr(k, mem[k], disk[k], mem._del); });
    MAP_KEYS.forEach(function (k) { out[k] = Object.assign({}, disk[k] || {}, mem[k] || {}); });
    if (disk.support || mem.support) {
      var ds = disk.support || emptySupport(), ms = mem.support || emptySupport();
      out.support = {
        reqs: mergeArr("sreqs", ms.reqs, ds.reqs, mem._del),
        keys: mergeArr("skeys", ms.keys, ds.keys, mem._del)
      };
    }
    if (mem.settings) out.settings = Object.assign({}, disk.settings || {}, mem.settings);
    return out;
  }

  var DB = jload(DB_KEY, null);
  function db() {
    if (!DB || DB.v !== 4 || !DB.users) { DB = seedDB(); save(); }
    else {
      var dirty = false;
      if (!DB._chk) { DB._chk = 1; if (ensureOwner(DB)) dirty = true; }
      // مهاجرت پایگاه‌های قدیمی: بخش «پشتیبانی کلاس مجازی» تازه اضافه شده است
      if (!DB.support || !DB.support.reqs) { DB.support = emptySupport(); dirty = true; }
      if (dirty) save();
    }
    return DB;
  }

  function save() {
    if (!MERGE_ON_SAVE) { jsave(DB_KEY, DB); return; }
    var disk = jload(DB_KEY, null);
    var mem = DB;
    // رکوردهایی که در همین نشست حذف شده‌اند علامت می‌خورند
    if (PREV) {
      ARR_KEYS.forEach(function (k) {
        var nowIds = {};
        (mem[k] || []).forEach(function (x) { if (x && x.id != null) nowIds[x.id] = 1; });
        (PREV[k] || []).forEach(function (x) {
          if (x && x.id != null && !nowIds[x.id]) { mem._del = mem._del || {}; mem._del[tkey(k, x.id)] = 1; }
        });
      });
    }
    var merged = mergeDB(disk, mem);
    PREV = clone(merged);
    DB = merged;
    jsave(DB_KEY, merged);
  }

  // اگر تب دیگری پایگاه را عوض کرد، نسخهٔ حافظهٔ این تب هم تازه می‌شود
  try {
    W.addEventListener("storage", function (e) {
      if (!e || e.key !== DB_KEY) return;
      var fresh = jload(DB_KEY, null);
      if (fresh && fresh.v === 4 && Array.isArray(fresh.users)) { DB = fresh; PREV = clone(fresh); }
    });
  } catch (e) { }

  db();

  /* ------------------------------------------------------------ نشست */
  function sid() { return LS.getItem(SID_KEY) || ""; }
  function me() { var d = db(), s = sid(); return (s && d.users.filter(function (u) { return u.id === s; })[0]) || null; }
  function pub(u) {
    if (!u) return null;
    var c = clone(u); delete c.pass; delete c.ph; delete c.ownerInit; c.roleFa = ROLE_FA[c.role] || c.roleFa || ""; return c;
  }
  function logEvent(type, meta) { var d = db(); d.events.unshift({ id: uid("ev"), t: now(), type: type, meta: meta || {} }); d.events = d.events.slice(0, 900); save(); }
  function audit(action, target, meta) { var d = db(), u = me(); d.audit.unshift({ id: uid("au"), t: now(), action: action, target: target || "—", by: u ? u.email : "system", meta: meta || {} }); d.audit = d.audit.slice(0, 900); save(); }
  function touch(u) { if (u) { u.lastAt = now(); save(); } }

  /* ============================================================ پاسخ‌ها */
  function J(body, status) { return new Response(JSON.stringify(body), { status: status || 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } }); }
  function ok(extra) { var o = { ok: true }; if (extra) for (var k in extra) o[k] = extra[k]; return J(o); }
  function bad(msg, status) { return J({ error: msg || "خطا" }, status || 400); }

  function needAdmin() {
    var u = me();
    if (!u) return bad("ابتدا وارد حساب شوید.", 401);
    if (u.role !== "admin" && u.role !== "owner") return bad("دسترسی ندارید.", 403);
    return null;
  }
  function needOwner() {
    var u = me();
    if (!u) return bad("ابتدا وارد حساب شوید.", 401);
    if (!(u.isOwner || u.role === "owner")) return bad("فقط مالک سایت می‌تواند این کار را انجام دهد.", 403);
    return null;
  }

  function byDayOf(d) {
    var out = {}, day = 864e5, t0 = new Date(); t0.setHours(0, 0, 0, 0);
    var start = t0.getTime(), keys = [], i;
    for (i = 13; i >= 0; i--) {
      var dt = new Date(start - i * day), k;
      try { k = dt.toLocaleDateString("fa-IR", { month: "numeric", day: "numeric" }); } catch (e) { k = (dt.getMonth() + 1) + "/" + dt.getDate(); }
      keys.push(k); out[k] = { logins: 0, signs: 0, quizzes: 0, ai: 0, _s: start - i * day };
    }
    (d.events || []).forEach(function (ev) {
      for (var j = 0; j < keys.length; j++) {
        var b = out[keys[j]];
        if (ev.t >= b._s && ev.t < b._s + day) {
          if (ev.type === "login") b.logins++;
          else if (ev.type === "register") b.signs++;
          else if (ev.type === "exam_finish") b.quizzes++;
          else if (ev.type === "ai") b.ai++;
          break;
        }
      }
    });
    return out;
  }

  /* ------------------------------------------------------------ آمار */
  function statsOf() {
    var d = db(), us = d.users;
    var byRole = { student: 0, teacher: 0, admin: 0, owner: 0 };
    var byGrade = { "7": 0, "8": 0, "9": 0 };
    us.forEach(function (u) { byRole[u.role] = (byRole[u.role] || 0) + 1; byGrade[u.grade] = (byGrade[u.grade] || 0) + 1; });
    var day = 864e5, t = now();
    var mins = us.reduce(function (a, u) { return a + (+u.studyMinutes || 0); }, 0);
    var exams = us.reduce(function (a, u) { return a + (+u.exams || 0); }, 0);
    var lessons = us.reduce(function (a, u) { return a + (+u.lessonsRead || 0); }, 0);
    var notes = us.reduce(function (a, u) { return a + (+u.notes || 0); }, 0);
    return {
      users: {
        total: us.length, newToday: us.filter(function (u) { return t - u.createdAt < day; }).length,
        newWeek: us.filter(function (u) { return t - u.createdAt < 7 * day; }).length,
        banned: us.filter(function (u) { return u.banned; }).length,
        verified: us.filter(function (u) { return u.verified; }).length,
        byRole: byRole, byGrade: byGrade
      },
      activity: {
        activeNow: us.filter(function (u) { return t - (u.lastAt || 0) < 9e5; }).length,
        activeToday: us.filter(function (u) { return t - (u.lastAt || 0) < day; }).length,
        sessions: (d.sessions || []).filter(function (s) { return s.status === "live"; }).length,
        events: d.events.length, classes: d.classes.length,
        byDay: byDayOf(d)
      },
      learning: { lessonsRead: lessons, notes: notes, exams: exams, quizAvg: 78, studyMinutes: mins },
      server: {
        uptimeSeconds: Math.round((now() - BOOT) / 1000),
        memoryMB: Math.max(1, Math.round(JSON.stringify(d).length / 1024)),
        node: "rhahnama-server (محلی/آنلاین)", online: true
      }
    };
  }
  var BOOT = now();

  /* ------------------------------------------------------------ کلاس مجازی */
  function liveSession(classId) {
    var d = db(), c = d.classes.filter(function (x) { return x.id === classId; })[0];
    if (!c) return null;
    var s = (d.sessions || []).filter(function (x) { return x.classId === classId && x.status === "live"; })[0];
    if (!s) {
      s = { id: uid("s"), classId: classId, code: c.code, title: c.subject + " — " + c.name, status: "live", startedAt: now(), hostId: (me() ? me().id : c.ownerId) };
      d.sessions.unshift(s);
    }
    if (!d.rooms[s.id]) d.rooms[s.id] = roomOf(c, s);
    save();
    return s;
  }
  function roomOf(c, s) {
    return { rev: 1, board: "", msgs: [], canTeach: true, hands: [], poll: null, picks: [], reactions: {}, timer: null, announce: null, attendance: [], subject: c.subject, grade: c.grade };
  }
  function getRoom(sessionId) {
    var d = db();
    if (!d.rooms[sessionId]) {
      var s = (d.sessions || []).filter(function (x) { return x.id === sessionId; })[0];
      var c = s ? d.classes.filter(function (x) { return x.id === s.classId; })[0] : null;
      if (!c) return null;
      d.rooms[sessionId] = roomOf(c, s);
    }
    return d.rooms[sessionId];
  }
  function bump(r) { r.rev = (r.rev || 0) + 1; }

  function classHandler(sub, method, body, q) {
    var d = db(), u = me();
    if (sub === "list") {
      var mine = d.classes.filter(function (c) { return u && (c.ownerId === u.id || (c.members || []).indexOf(u.id) > -1); });
      var pubList = u && (u.role === "teacher" || u.role === "admin" || u.role === "owner") ? d.classes : mine;
      return J({ classes: pubList, sessions: (d.sessions || []).filter(function (s) { return s.status === "live"; }) });
    }
    if (sub === "create") {
      if (!u) return bad("ابتدا وارد شوید.", 401);
      var nc = { id: uid("c"), name: String(body.name || "کلاس تازه").slice(0, 80), grade: body.grade || (u.grade || "8"), subject: body.subject || "ریاضی", code: code(6), ownerId: u.id, members: [], createdAt: now() };
      if (body.autoMembers) d.users.forEach(function (x) { if (x.role === "student" && x.grade === nc.grade) nc.members.push(x.id); });
      d.classes.unshift(nc); save(); logEvent("class_create", { code: nc.code, name: nc.name });
      return J({ class: nc });
    }
    if (sub === "join") {
      var cd = String(body.code || "").trim().toUpperCase();
      var c = d.classes.filter(function (x) { return x.code === cd; })[0];
      if (!c) return bad("کلاسی با این کد پیدا نشد.", 404);
      if (u && (c.members || []).indexOf(u.id) === -1) { c.members.push(u.id); save(); }
      var s = liveSession(c.id);
      logEvent("class_join", { code: cd, email: u ? u.email : "" });
      return J({ class: c, session: s });
    }
    if (sub === "session") { var s2 = liveSession(body.classId); return s2 ? J({ session: s2 }) : bad("کلاس پیدا نشد.", 404); }
    if (sub === "session/end") {
      var t = (d.sessions || []).filter(function (x) { return x.id === body.sessionId; })[0];
      if (t) { t.status = "ended"; t.endedAt = now(); save(); }
      logEvent("class_end", { session: body.sessionId });
      return ok();
    }
    if (sub === "room") {
      var sess = (d.sessions || []).filter(function (x) { return x.id === q.session; })[0];
      if (!sess) return bad("جلسه پیدا نشد.", 404);
      var cls = d.classes.filter(function (x) { return x.id === sess.classId; })[0];
      var room = getRoom(sess.id); save();
      return J({ class: cls, session: sess, room: room });
    }
    if (sub === "stream") {
      var sess2 = (d.sessions || []).filter(function (x) { return x.id === q.session; })[0];
      if (!sess2) return bad("جلسه پیدا نشد.", 404);
      var r2 = getRoom(sess2.id);
      return J({ session: sess2, room: r2, rev: r2 ? r2.rev : 0 });
    }
    if (sub === "ping") return ok();
    if (sub === "chat") {
      var r3 = getRoom(body.sessionId); if (!r3) return bad("جلسه پیدا نشد.", 404);
      r3.msgs.push({ id: uid("m"), t: now(), from: u ? u.name : "مهمان", role: u ? u.role : "student", text: String(body.text || "").slice(0, 500) });
      r3.msgs = r3.msgs.slice(-200); bump(r3); save(); return ok();
    }
    if (sub === "board") {
      var r4 = getRoom(body.sessionId); if (!r4) return bad("جلسه پیدا نشد.", 404);
      r4.board = String(body.board || ""); bump(r4); save(); return ok();
    }
    if (sub === "hand") {
      var r5 = getRoom(body.sessionId); if (!r5) return ok();
      r5.hands = (r5.hands || []).filter(function (h) { return h.userId !== body.userId; });
      if (body.up) r5.hands.push({ userId: body.userId, t: now() });
      bump(r5); save(); return ok();
    }
    if (sub === "attendance") {
      var sess3 = (d.sessions || []).filter(function (x) { return x.id === q.session; })[0];
      var cls2 = sess3 ? d.classes.filter(function (x) { return x.id === sess3.classId; })[0] : null;
      var rows = (cls2 ? cls2.members : []).map(function (id) {
        var x = d.users.filter(function (y) { return y.id === id; })[0] || {};
        return { id: id, name: x.name || "—", present: true, joinedAt: now() - 6e5 };
      });
      return J({ className: cls2 ? cls2.name : "—", session: sess3 || { title: "—" }, rows: rows });
    }
    if (sub === "overview") {
      var live = (d.sessions || []).filter(function (x) { return x.status === "live"; });
      return J({
        kpis: {
          classes: d.classes.length, live: live.length, students: d.users.filter(function (x) { return x.role === "student"; }).length,
          teachers: d.users.filter(function (x) { return x.role === "teacher"; }).length,
          verified: d.users.filter(function (x) { return x.verified; }).length,
          owners: d.users.filter(function (x) { return x.isOwner || x.role === "owner"; }).length
        },
        classes: d.classes,
        live: live,
        sessions: d.sessions
      });
    }
    /* سایر کنش‌های کلاس زنده (نظرسنجی، دست‌بلند، واکنش، تایمر، اعلام) */
    var ra = getRoom(body.sessionId);
    if (!ra) return ok();
    if (sub === "poll") { ra.poll = body.poll || null; }
    else if (sub === "pick") { ra.picks = (ra.picks || []).concat([{ userId: body.userId, t: now() }]); }
    else if (sub === "vote") { ra.poll = ra.poll || { q: body.q || "", votes: {} }; ra.poll.votes[u ? u.id : "guest"] = body.choice; }
    else if (sub === "react") { ra.reactions[body.emoji || "👍"] = (ra.reactions[body.emoji || "👍"] || 0) + 1; }
    else if (sub === "reactclear") { ra.reactions = {}; }
    else if (sub === "timer") { ra.timer = body.seconds ? { seconds: body.seconds, at: now() } : null; }
    else if (sub === "announce") { ra.announce = body.text || null; }
    bump(ra); save(); return ok();
  }

  /* ------------------------------------------------------------ پنل مالک */
  function findUser(d, b) {
    return d.users.filter(function (x) { return x.id === (b && b.id) || x.email === (b && b.email); })[0];
  }
  function exportText(what) {
    var d = db();
    if (what === "events") return { name: "events.csv", mime: "text/csv;charset=utf-8", text: csv(d.events, ["type", "t", "meta"]) };
    if (what === "audit") return { name: "audit.csv", mime: "text/csv;charset=utf-8", text: csv(d.audit, ["action", "target", "by", "t", "meta"]) };
    if (what === "progress") {
      var rows = d.users.map(function (u) { return { name: u.name, email: u.email, grade: u.grade, lessonsRead: u.lessonsRead, exams: u.exams, notes: u.notes, studyMinutes: u.studyMinutes }; });
      return { name: "progress.csv", mime: "text/csv;charset=utf-8", text: csv(rows, ["name", "email", "grade", "lessonsRead", "exams", "notes", "studyMinutes"]) };
    }
    if (what === "all") { var cp = clone(d); cp.users.forEach(function (x) { delete x.pass; delete x.ph; }); return { name: "rahnama-backup.json", mime: "application/json", text: JSON.stringify(cp, null, 2) }; }
    var us = d.users.map(function (u) { var c = clone(u); delete c.pass; delete c.ph; delete c.progress; return c; });
    return { name: "users.csv", mime: "text/csv;charset=utf-8", text: csv(us, ["id", "name", "email", "role", "grade", "school", "city", "verified", "banned", "createdAt", "lastAt", "lessonsRead", "exams", "studyMinutes"]) };
  }
  function csv(rows, cols) {
    var out = [cols.join(",")];
    rows.forEach(function (r) {
      out.push(cols.map(function (c) {
        var v = r[c]; if (v && typeof v === "object") v = JSON.stringify(v);
        return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
      }).join(","));
    });
    return "\uFEFF" + out.join("\n");
  }
  function download(what) {
    var e = exportText(what);
    try {
      var b = new Blob([e.text], { type: e.mime });
      var a = D.createElement("a");
      a.href = URL.createObjectURL(b); a.download = e.name;
      D.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      return true;
    } catch (x) { return false; }
  }

  function adminHandler(sub, method, body, q) {
    var d = db();
    var g = needAdmin(); if (g) return g;
    if (sub === "stats") return J({ stats: statsOf(), settings: d.settings });

    /* ---- پشتیبانی کلاس مجازی — فقط مالک/مدیر ---- */
    if (sub === "support") {
      return J({ reqs: d.support.reqs, keys: d.support.keys });
    }
    if (sub === "support/key") {
      var gk = needOwner(); if (gk) return gk;
      var rq = d.support.reqs.filter(function (x) { return x.id === String(body.reqId || ""); })[0] || null;
      var ownerId = rq ? rq.by : String(body.userId || "");
      if (!ownerId) return bad("درخواست یا کاربر مقصد مشخص نیست.");
      var kcode = String(body.code || "").trim().toUpperCase() || ("RN-" + code(6));
      if (d.support.keys.filter(function (k) { return k.code === kcode; }).length) return bad("این کلید قبلاً ساخته شده است.");
      var kdays = Math.max(1, Math.min(730, +body.days || 90));
      var kobj = {
        id: uid("sk"), code: kcode, t: now(), exp: now() + kdays * 864e5,
        owner: ownerId, school: String(body.school || (rq && rq.school) || "").slice(0, 80),
        seats: Math.max(1, Math.min(5000, +body.seats || 35)),
        active: true, used: 0, members: [], days: kdays
      };
      d.support.keys.unshift(kobj);
      d.support.keys = d.support.keys.slice(0, 400);
      // مدیر همان لحظه صاحب کلید می‌شود و می‌تواند برای مدرسه‌اش کلاس بسازد
      var tu = d.users.filter(function (x) { return x.id === ownerId; })[0];
      if (tu) {
        tu.schoolKey = kcode;
        if (kobj.school) tu.school = kobj.school;
        tu.schoolVerified = true; tu.classKey = kcode;
        touch(tu);
      }
      if (rq) { rq.status = "approved"; rq.keyCode = kcode; rq.t2 = now(); }
      save(); audit("support.key", kobj.school + " / " + kcode);
      return J({ key: kobj, request: rq });
    }
    if (sub === "support/state") {
      var gs = needOwner(); if (gs) return gs;
      var sk = d.support.keys.filter(function (k) { return k.id === String(body.id || ""); })[0];
      if (!sk) return bad("کلید پیدا نشد.", 404);
      if (body.active != null) sk.active = !!body.active;
      if (body.seats != null) sk.seats = Math.max(1, Math.min(5000, +body.seats));
      if (body.days != null) sk.exp = now() + Math.max(1, Math.min(730, +body.days)) * 864e5;
      save(); audit("support.key.update", sk.code + " → " + (sk.active ? "فعال" : "غیرفعال"));
      return J({ key: sk });
    }

    if (sub === "users") {
      var list = d.users.slice();
      var qq = (q.q || "").toLowerCase(), role = q.role || "", grade = q.grade || "", sort = q.sort || "new";
      if (qq) list = list.filter(function (u) { return ((u.name || "") + " " + (u.email || "") + " " + (u.school || "") + " " + (u.city || "")).toLowerCase().indexOf(qq) > -1; });
      if (role) list = list.filter(function (u) { return u.role === role; });
      if (grade) list = list.filter(function (u) { return u.grade === grade; });
      list.sort(function (a, b) {
        if (sort === "name") return String(a.name).localeCompare(String(b.name), "fa");
        if (sort === "grade") return String(a.grade).localeCompare(String(b.grade));
        if (sort === "active") return (b.lastAt || 0) - (a.lastAt || 0);
        if (sort === "study") return (b.studyMinutes || 0) - (a.studyMinutes || 0);
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
      var per = 12, pages = Math.max(1, Math.ceil(list.length / per)), page = Math.min(Math.max(1, +q.page || 1), pages);
      var mine = me();
      var rows = list.slice((page - 1) * per, page * per).map(function (u) {
        var c = pub(u); c.canEdit = !u.isOwner || (mine && mine.isOwner); return c;
      });
      return J({ users: rows, page: page, pages: pages, total: list.length });
    }

    if (sub === "user") {
      var u = findUser(d, body);
      if (!u) return bad("کاربر پیدا نشد.", 404);
      var restrict = (u.role === "admin" || u.role === "owner") && !(me().isOwner || me().role === "owner");
      if (restrict) return bad("فقط مالک سایت می‌تواند مدیران را تغییر دهد.", 403);
      ["name", "grade", "school", "city"].forEach(function (k) { if (body[k] != null) u[k] = body[k]; });
      if (body.role != null && !u.isOwner) {
        var iAmOwner = !!(me().isOwner || me().role === "owner");
        if (["student", "teacher", "deputy", "admin"].indexOf(body.role) < 0) return bad("نقش نامعتبر است.");
        if (body.role === "admin" && !iAmOwner) return bad("فقط مالک سایت می‌تواند مدیر تعیین کند.", 403);
        u.role = body.role;
      }
      if (body.banned != null) u.banned = !!body.banned;
      if (body.verified != null && (me().isOwner || me().role === "owner")) u.verified = !!body.verified;
      u.roleFa = ROLE_FA[u.role] || u.role;
      if (u.isOwner) { u.role = "owner"; u.roleFa = ROLE_FA.owner; u.banned = false; u.verified = true; }
      save(); audit("user.update", u.email, { role: u.role, banned: u.banned });
      return J({ user: pub(u) });
    }
    if (sub === "user/delete") {
      var u2 = findUser(d, body);
      if (!u2) return bad("کاربر پیدا نشد.", 404);
      if (u2.isOwner) return bad("مالک سایت حذف نمی‌شود.", 403);
      d.users = d.users.filter(function (x) { return x.id !== u2.id; });
      save(); audit("user.delete", u2.email);
      return ok();
    }
    if (sub === "user/password") {
      var u3 = findUser(d, body);
      if (!u3) return bad("کاربر پیدا نشد.", 404);
      var p = code(8);
      if (u3.isOwner && !(me().isOwner || me().role === "owner")) return bad("فقط مالک سایت.", 403);
      setPass(u3, p); save(); audit("user.password", u3.email);
      return J({ password: p });
    }
    if (sub === "user/bulk") {
      var ids = body.ids || [], n = 0;
      d.users.forEach(function (x) {
        if (ids.indexOf(x.id) === -1 || x.isOwner) return;
        if (body.action === "verify") x.verified = !!body.value;
        if (body.action === "ban") x.banned = !!body.value;
        if (body.action === "grade") x.grade = body.value;
        if (body.action === "role") {
          var okR = ["student", "teacher", "deputy"].concat((me().isOwner || me().role === "owner") ? ["admin"] : []);
          if (okR.indexOf(body.value) < 0) return;
          x.role = body.value; x.roleFa = ROLE_FA[body.value];
        }
        n++;
      });
      save(); audit("user.bulk", String(n) + " کاربر", { action: body.action });
      return J({ ok: true, n: n });
    }
    if (sub === "verify") {
      var u4 = findUser(d, body);
      if (!u4) return bad("کاربر پیدا نشد.", 404);
      if (!(me().isOwner || me().role === "owner")) return bad("تیک آبی فقط با مالک سایت.", 403);
      u4.verified = !!body.verified; save(); audit("user.verify", u4.email, { verified: u4.verified });
      return J({ user: pub(u4) });
    }
    if (sub === "owner") {
      var o = needOwner(); if (o) return o;
      var t = d.users.filter(function (x) { return x.email === body.email; })[0];
      if (!t) return bad("کاربری با این ایمیل نیست.", 404);
      d.users.forEach(function (x) { if (x.isOwner) { x.isOwner = false; if (x.role === "owner") { x.role = "admin"; x.roleFa = ROLE_FA.admin; } } });
      t.isOwner = true; t.role = "owner"; t.roleFa = ROLE_FA.owner;
      save(); audit("owner.set", t.email);
      return ok();
    }
    if (sub === "owners") {
      var iOwn = !!(me().isOwner || me().role === "owner");
      var cnt = { owners: 0, admins: 0, teachers: 0, students: 0, verified: 0 };
      d.users.forEach(function (x) {
        if (x.isOwner || x.role === "owner") cnt.owners++;
        else if (x.role === "admin") cnt.admins++;
        else if (x.role === "teacher") cnt.teachers++;
        else cnt.students++;
        if (x.verified) cnt.verified++;
      });
      var act = function (x) { var y = pub(x); y.online = now() - (x.lastAt || 0) < 9e5; return y; };
      return J({
        owners: d.users.filter(function (x) { return x.isOwner || x.role === "owner"; }).map(act),
        verified: d.users.filter(function (x) { return x.verified; }).map(act),
        counts: cnt, byRole: cnt, canManage: iOwn
      });
    }
    if (sub === "settings") {
      var s = d.settings;
      ["registrationOpen", "maintenance", "aiEnabled", "consultEnabled",
        "aiMaintenance", "consultMaintenance", "aiMaintenanceNote", "consultMaintenanceNote",
        "maintenanceNote", "allowedGrades", "staffCode", "schoolKey",
        "classLimit", "announceBanner"].forEach(function (k) { if (body[k] != null) s[k] = body[k]; });
      if (s.allowedGrades) s.allowedGrades = s.allowedGrades.map(String);
      save(); audit("settings.update", "site", body);
      return J({ settings: s });
    }
    if (sub === "maintenance") {
      d.settings.maintenance = !!body.on;
      if (body.note != null) d.settings.maintenanceNote = body.note;
      save(); audit("maintenance.set", body.on ? "روشن" : "خاموش");
      return J({ settings: d.settings });
    }
    if (sub === "flags") {
      var f = d.settings.features = d.settings.features || {};
      for (var k2 in (body.flags || {})) f[k2] = !!body.flags[k2];
      if (body.maintenance != null) d.settings.maintenance = !!body.maintenance;
      if (body.registrationOpen != null) d.settings.registrationOpen = !!body.registrationOpen;
      save(); audit("flags.update", "features", body.flags || {});
      return J({ features: f, settings: d.settings });
    }
    if (sub === "content") {
      var c = d.settings;
      if (body.hero) c.hero = { title: body.hero.title || c.hero.title, sub: body.hero.sub || c.hero.sub };
      if (body.contact) c.contact = body.contact;
      if (body.theme) c.theme = body.theme;
      if (body.siteNotice != null) c.siteNotice = body.siteNotice;
      save(); audit("content.update", "appearance");
      return J({ settings: c });
    }
    if (sub === "exam-defaults") {
      d.settings.examDefaults = { count: +body.count || 20, minutes: +body.minutes || 15, pass: +body.pass || 60 };
      save(); audit("exam.defaults", "آزمون", d.settings.examDefaults);
      return J({ settings: d.settings });
    }
    if (sub === "reports/clear") {
      d.users.forEach(function (x) { x.exams = 0; x.progress = {}; });
      d.reports = []; save(); audit("reports.clear", "همهٔ کارنامه‌ها");
      return ok();
    }
    if (sub === "reset-progress") {
      var targets = body.all ? d.users : d.users.filter(function (x) { return x.id === body.id || x.email === body.email; });
      targets.forEach(function (x) { x.lessonsRead = 0; x.exams = 0; x.notes = 0; x.studyMinutes = 0; x.progress = {}; });
      save(); audit("progress.reset", body.all ? "همه" : (body.email || body.id));
      return J({ ok: true, n: targets.length });
    }
    if (sub === "announce") {
      d.settings.announcement = { active: !!body.active, level: body.level || "info", text: body.text || "", audience: body.audience || "all", until: body.until || 0 };
      if (body.active && d.settings.announcement.text) logEvent("announce", { text: d.settings.announcement.text.slice(0, 60) });
      save(); audit("announce.set", "سراسری", { active: !!body.active });
      return J({ announcement: d.settings.announcement });
    }
    if (sub === "broadcast") {
      d.settings.broadcast = d.settings.broadcast || [];
      d.settings.broadcast.unshift({ id: uid("bc"), t: now(), title: body.title || "پیام مدیر", text: body.text || "", audience: body.audience || "all", by: me().email });
      d.settings.broadcast = d.settings.broadcast.slice(0, 100);
      save(); audit("broadcast.send", body.audience || "all", { title: body.title });
      return J({ broadcast: d.settings.broadcast });
    }
    if (sub === "messages") {
      if (method === "POST") { d.messages.unshift({ id: uid("msg"), t: now(), userId: body.userId || "", text: body.text || "", by: me().email }); save(); audit("message.send", body.userId || "همه"); return J({ messages: d.messages }); }
      return J({ messages: d.messages });
    }
    if (sub === "leaderboard") {
      var rows = d.users.slice().sort(function (a, b) { return (b.studyMinutes || 0) - (a.studyMinutes || 0); }).slice(0, 20).map(function (u, i) {
        return { rank: i + 1, name: u.name, email: u.email, grade: u.grade, minutes: u.studyMinutes, exams: u.exams, lessonsRead: u.lessonsRead };
      });
      return J({ rows: rows });
    }
    if (sub === "sessions") {
      var rows2 = d.users.slice().sort(function (a, b) { return (b.lastAt || 0) - (a.lastAt || 0); }).slice(0, 20).map(function (u) {
        return { email: u.email, name: u.name, role: u.roleFa, lastAt: u.lastAt, active: now() - (u.lastAt || 0) < 9e5 };
      });
      return J({ rows: rows2 });
    }
    if (sub === "logout-all") { LS.removeItem(SID_KEY); audit("session.logout_all", "همه"); return ok(); }
    if (sub === "events") {
      var t2 = q.type || "";
      return J({ events: d.events.filter(function (e) { return !t2 || e.type === t2; }).slice(0, 300) });
    }
    if (sub === "audit") return J({ audit: d.audit.slice(0, 300) });
    if (sub === "prune") {
      var days = +body.days || 90, cut = now() - days * 864e5;
      d.events = d.events.filter(function (e) { return e.t >= cut; });
      d.audit = d.audit.filter(function (a) { return a.t >= cut; });
      save(); audit("data.prune", days + " روز");
      return J({ ok: true, left: d.events.length });
    }
    if ((sub === "backup" || sub === "restore" || sub === "reset-all") && !(me().isOwner || me().role === "owner")) return bad("فقط مالک سایت.", 403);
    if (sub === "backup") return J({ json: JSON.stringify(d), size: JSON.stringify(d).length });
    if (sub === "restore") {
      try {
        var nd = JSON.parse(body.json);
        if (!nd || !nd.users) throw new Error("ساختار نامعتبر");
        nd.v = 4; nd._chk = 1; ensureOwner(nd); DB = nd; save(); audit("data.restore", "بازگردانی از فایل");
        return ok();
      } catch (e) { return bad("فایل پشتیبان معتبر نیست."); }
    }
    if (sub === "reset-all") { DB = seedDB(); save(); return ok({ message: "داده‌ها به حالت اولیه برگشت" }); }
    if (sub === "export") { var e2 = exportText(q.what); return J({ name: e2.name, text: e2.text, mime: e2.mime }); }
    return bad("این فرمان پشتیبانی نمی‌شود.", 404);
  }

  /* ------------------------------------------------------------ مسیریاب */
  function handle(path, method, body, q) {
    var d = db(), m = (method || "GET").toUpperCase();
    var seg = path.replace(/^\/api\//, "").split("/");

    if (method === "GET" && path === "/api/site/status") {
      var st = d.settings;
      // ⚠️ امنیت: پیش‌تر کلِ d.settings به بیرون داده می‌شد و پیام‌های سراسری
      // مدیر (broadcast) و سایر داده‌های مدیریتی عمومی می‌شد. حالا فقط
      // بخش‌های عمومی برگردانده می‌شود.
      return J({
        ok: true, online: true, version: "6.0",
        announcement: st.announcement,
        features: st.features,
        settings: {
          registrationOpen: st.registrationOpen !== false,
          maintenance: !!st.maintenance,
          maintenanceNote: st.maintenanceNote,
          aiEnabled: st.aiEnabled !== false,
          consultEnabled: st.consultEnabled !== false,
          aiMaintenance: !!st.aiMaintenance,
          consultMaintenance: !!st.consultMaintenance,
          aiMaintenanceNote: st.aiMaintenanceNote,
          consultMaintenanceNote: st.consultMaintenanceNote,
          allowedGrades: st.allowedGrades || ["7", "8", "9"]
        },
        hero: st.hero, contact: st.contact, theme: st.theme,
        note: st.siteNotice, users: d.users.length
      });
    }
    if (seg[0] === "auth") {
      var a = seg.slice(1).join("/");
      if (a === "me") return J({ user: pub(me()) });
      if (a === "register") {
        var em = String(body.email || "").trim().toLowerCase();
        if (!em || !body.password) return bad("ایمیل و رمز لازم است.");
        if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(em)) return bad("ایمیل معتبر نیست.");
        if (String(body.password).length < 6) return bad("رمز باید حداقل ۶ نویسه باشد.");
        if (d.users.filter(function (u) { return u.email === em; }).length) return bad("این ایمیل قبلاً ثبت شده است.");
        if (!d.settings.registrationOpen) return bad("ثبت‌نام فعلاً بسته است.", 403);
        var nu = {
          id: uid("u"), name: body.name || "کاربر تازه", email: em, ph: hashPass(em, body.password),
          role: "student", roleFa: ROLE_FA.student, grade: String(body.grade || "8"), school: body.school || "", city: body.city || "",
          banned: false, verified: false, isOwner: false, createdAt: now(), lastAt: now(),
          lessonsRead: 0, exams: 0, notes: 0, studyMinutes: 0, color: "#6d5efc", progress: {}
        };
        if (em === OWNER_EMAIL) { nu.isOwner = true; nu.role = "owner"; nu.roleFa = ROLE_FA.owner; nu.verified = true; nu.ownerInit = true; }
        d.users.push(nu); save(); LS.setItem(SID_KEY, nu.id);
        logEvent("register", { email: em, grade: nu.grade }); audit("user.register", em);
        return J({ user: pub(nu) });
      }
      if (a === "login") {
        var em2 = String(body.email || "").trim().toLowerCase();
        var u = d.users.filter(function (x) { return String(x.email).toLowerCase() === em2 && passOk(x, body.password); })[0];
        if (!u) return J({ error: "ایمیل یا رمز اشتباه است." }, 401);
        if (u.banned) return J({ error: "حساب شما مسدود است." }, 403);
        if (!u.ph) setPass(u, body.password);
        LS.setItem(SID_KEY, u.id); touch(u);
        logEvent("login", { email: em2 }); return J({ user: pub(u) });
      }
      if (a === "logout") { LS.removeItem(SID_KEY); return ok(); }
      if (a === "profile" || a === "update") {
        var mu = me(); if (!mu) return bad("وارد شوید.", 401);
        ["name", "grade", "school", "city", "color"].forEach(function (k) { if (body[k] != null) mu[k] = body[k]; });
        save(); return J({ user: pub(mu) });
      }
      return bad("مسیر نامعتبر", 404);
    }

    if (seg[0] === "me") {
      var a2 = seg.slice(1).join("/"), mu2 = me();
      if (!mu2) return bad("وارد شوید.", 401);
      if (a2 === "data") return J({ data: mu2.progress || {} });
      if (a2 === "sync") { mu2.progress = body.data || mu2.progress; touch(mu2); return ok(); }
      if (a2 === "profile") {
        var nm = String(body.name == null ? mu2.name : body.name).trim();
        if (!nm) return bad("نام نمی‌تواند خالی باشد.");
        mu2.name = nm.slice(0, 60);
        if (body.grade != null && ["7", "8", "9"].indexOf(String(body.grade)) > -1) mu2.grade = String(body.grade);
        if (body.school != null) mu2.school = String(body.school).slice(0, 60);
        if (body.city != null) mu2.city = String(body.city).slice(0, 40);
        if (body.bio != null) mu2.bio = String(body.bio).slice(0, 300);
        if (body.color != null && /^#[0-9a-fA-F]{6}$/.test(String(body.color))) mu2.color = String(body.color);
        // ---- شخصی‌سازی پروفایل: تصویر/گیف، فونت نام و رنگ نام ----
        if (body.nameColor != null && /^#[0-9a-fA-F]{6}$/.test(String(body.nameColor))) mu2.nameColor = String(body.nameColor);
        if (body.font != null) {
          var fk = String(body.font);
          if (["vazir", "system", "display", "serif"].indexOf(fk) > -1) mu2.font = fk;
        }
        if (body.avatar !== undefined) {
          var av = String(body.avatar || "");
          if (!av) { mu2.avatar = ""; }
          else if (/^https:\/\/[^\s"'<>]{6,700}$/.test(av)) { mu2.avatar = av; }
          else if (/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]+$/.test(av) && av.length <= 200000) { mu2.avatar = av; }
          else return bad("تصویر پروفایل پذیرفته نشد (png / jpg / gif / webp — حداکثر ۱۴۰ کیلوبایت).");
        }
        // تغییر نقش: دانش‌آموز آزاد است؛ دبیر/ناظم/مدیر با «کد همکاران»
        if (body.role && !mu2.isOwner && body.role !== mu2.role) {
          var wr = String(body.role).toLowerCase();
          if (["student", "teacher", "deputy"].indexOf(wr) < 0) return bad("نقش مدیر فقط توسط مالک سایت تعیین می‌شود.", 403);
          /* کد همکاران: اول از تنظیمات سایت (قابل تغییر در پنل مالک)، وگرنه پیش‌فرض.
       tools/build-engine.py این خط را برای موتور سرور به متغیر محیطی STAFF_CODE
       هم وصل می‌کند تا در Cloudflare هم قابل تنظیم باشد. */
    var WANT_STAFF_CODE = String((d.settings && d.settings.staffCode) || "").trim() || "rahnama-hamkaran";
    if (wr !== "student" && String(body.staffCode || "").trim() !== WANT_STAFF_CODE) {
            return J({ error: "برای نقش دبیر / ناظم / مدیر باید «کد همکاران» درست را وارد کنی.", needCode: true }, 403);
          }
          mu2.role = wr;
        }
        mu2.roleFa = ROLE_FA[mu2.role] || mu2.roleFa || "";
        touch(mu2); save(); audit("me.profile", mu2.email);
        return J({ user: pub(mu2) });
      }
      if (a2 === "password") {
        var cur = body.current, nx = String(body.password || body.next || "");
        if (nx.length < 6) return bad("رمز جدید باید حداقل ۶ نویسه باشد.");
        if (!passOk(mu2, cur)) return bad("رمز فعلی نادرست است.", 403);
        setPass(mu2, nx); save(); audit("me.password", mu2.email); return ok();
      }
      if (a2 === "delete") {
        if (mu2.isOwner) return bad("حساب مالک حذف نمی‌شود.", 403);
        d.users = d.users.filter(function (x) { return x.id !== mu2.id; }); save(); LS.removeItem(SID_KEY);
        return ok();
      }
      return ok();
    }

    /* ---------------- پشتیبانی کلاس مجازی (درخواست کلید) ----------------
       مدیر/ناظم/دبیر از صفحهٔ «پشتیبانی کلاس مجازی» درخواست می‌دهد و تیم
       مدیریت از پنل مالک برای همان مدرسه کلید می‌سازد. اعضای آن مدرسه هم
       با همان کلید به مدرسه وصل می‌شوند. */
    if (seg[0] === "support") {
      var sa = seg.slice(1).join("/"), su = me();
      if (sa === "request") {
        if (!su) return bad("برای ثبت درخواست وارد شوید.", 401);
        if (!(su.isOwner || ["teacher", "deputy", "admin", "owner"].indexOf(su.role) > -1)) {
          return bad("ثبت درخواست کلاس مجازی برای مدیر، ناظم و دبیر فعال است.", 403);
        }
        var rq = {
          id: uid("sr"), t: now(), by: su.id, byName: su.name, byEmail: su.email,
          school: String(body.school || su.school || "").slice(0, 80),
          city: String(body.city || su.city || "").slice(0, 40),
          classes: Math.max(1, Math.min(200, +body.classes || 1)),
          students: Math.max(1, Math.min(5000, +body.students || 30)),
          phone: String(body.phone || "").slice(0, 30),
          note: String(body.note || "").slice(0, 400),
          status: "pending", keyCode: "", t2: 0
        };
        if (!rq.school) return bad("نام مدرسه را وارد کنید.");
        d.support.reqs.unshift(rq);
        d.support.reqs = d.support.reqs.slice(0, 300);
        save(); audit("support.request", rq.school); logEvent("support", { school: rq.school });
        return J({ request: rq });
      }
      if (sa === "my") {
        if (!su) return bad("وارد شوید.", 401);
        return J({
          requests: d.support.reqs.filter(function (x) { return x.by === su.id; }),
          key: d.support.keys.filter(function (k) { return k.owner === su.id && k.active; })[0] || null
        });
      }
      if (sa === "redeem") {
        if (!su) return bad("وارد شوید.", 401);
        var rc = String(body.code || "").trim().toUpperCase();
        var kk = d.support.keys.filter(function (k) { return k.code === rc; })[0];
        if (!kk) return bad("این کلید معتبر نیست.", 404);
        if (!kk.active) return bad("این کلید غیرفعال شده است.", 403);
        if (kk.exp && now() > kk.exp) return bad("این کلید منقضی شده است.", 403);
        su.school = kk.school || su.school; su.schoolKey = kk.code; su.schoolVerified = true;
        kk.used = (kk.used || 0) + 1; kk.members = kk.members || [];
        if (kk.members.indexOf(su.id) < 0) kk.members.push(su.id);
        touch(su); save(); audit("support.redeem", su.email + " → " + kk.school);
        return J({ ok: true, school: kk.school, user: pub(su) });
      }
      if (sa === "keys") {
        if (!su) return bad("وارد شوید.", 401);
        var iAmBoss = !!(su.isOwner || su.role === "owner" || su.role === "admin");
        var ks = iAmBoss ? d.support.keys : d.support.keys.filter(function (k) { return k.owner === su.id || su.schoolKey === k.code; });
        return J({ keys: ks });
      }
      return bad("مسیر نامعتبر", 404);
    }

    if (seg[0] === "admin") return adminHandler(seg.slice(1).join("/"), m, body, q);
    if (seg[0] === "class") return classHandler(seg.slice(1).join("/"), m, body, q);

    if (seg[0] === "ai") return J({ error: "دستیار آنلاین در این نسخه به سرور وصل نیست؛ حالت محلی فعال است.", offline: true }, 503);
    if (seg[0] === "__status" || path === "/__status") return J({ ok: true, online: true });
    return bad("مسیر نامعتبر", 404);
  }

  /* ------------------------------------------------------------ نصب */
  /* اگر سرور واقعی (Cloudflare Worker + D1) پاسخ بدهد، همهٔ ‎/api/*‎ به آن می‌رود؛
     وگرنه (آفلاین، APK، هاست ساده) همین سرور محلیِ داخل مرورگر جواب می‌دهد. */
  var origFetch = W.fetch ? W.fetch.bind(W) : null;
  var realP = null, REAL = false;
  function probe() {
    if (realP) return realP;
    var SS = null; try { SS = W.sessionStorage; } catch (e0) { SS = null; }
    if (!origFetch || (W.location && W.location.protocol === "file:")) return (realP = Promise.resolve(false));
    /* هاست بدون سرور واقعی: در همین نشست دوباره پرس‌وجو نکن (از خطای ۴۰۴ تکراری در کنسول جلوگیری می‌شود) */
    if (SS && SS.getItem("hk:real") === "0") return (realP = Promise.resolve(false));
    var timeout = new Promise(function (res) { setTimeout(function () { res(false); }, 4000); });
    var check = origFetch("/api/__status", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { REAL = !!(j && j.server === "d1"); if (!REAL && SS) { try { SS.setItem("hk:real", "0"); } catch (e1) {} } return REAL; })
      .catch(function () { if (SS) { try { SS.setItem("hk:real", "0"); } catch (e1) {} } return false; });
    realP = Promise.race([check, timeout]);
    return realP;
  }
  W.fetch = function (input, init) {
    var url = typeof input === "string" ? input : ((input && input.url) || "");
    var abs = url, path = url, q = {};
    try {
      abs = new URL(url, location.href);
      path = abs.pathname;
      abs.searchParams.forEach(function (v, k) { q[k] = v; });
    } catch (e) {}
    if (path.indexOf("/api/") === 0 && path !== "/api/__status") {
      return probe().then(function (real) {
        if (real) return origFetch(input, init);
        var method = ((init && init.method) || (input && input.method) || "GET").toUpperCase();
        var body = {};
        try { if (init && init.body) body = JSON.parse(init.body); } catch (e2) { body = {}; }
        return handle(path, method, body, q);
      });
    }
    return origFetch ? origFetch(input, init) : Promise.reject(new Error("fetch"));
  };

  function realDownload(what) {
    return origFetch("/api/admin/export?what=" + encodeURIComponent(what), { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (e) {
        if (!e || e.error) throw new Error((e && e.error) || "خطا");
        var b = new Blob([e.text], { type: e.mime || "text/plain" });
        var a = D.createElement("a");
        a.href = URL.createObjectURL(b); a.download = e.name || "export.txt";
        D.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      });
  }

  W.HKServer = {
    db: function () { return REAL ? { users: [], settings: {}, events: [], audit: [], classes: [], remote: true } : clone(db()); },
    reset: function () { DB = seedDB(); save(); },
    downloadExport: function (what) { if (REAL) { realDownload(what).catch(function () {}); return true; } return download(what); },
    me: function () { return pub(me()); },
    stats: statsOf,
    online: true,
    isReal: function () { return REAL; }
  };
})();
