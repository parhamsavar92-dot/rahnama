/* ==========================================================================
   رهنما — احراز هویت و همگامی  |  hk-auth.js
   روی همهٔ صفحه‌ها: وضعیت ورود، دکمهٔ پروفایل در سربرگ، اعلان سراسری،
   و همگامی خودکار دادهٔ مطالعه با سرور (فقط اگر کاربر وارد شده باشد).
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  };
  function toast(m, ms) { W.HK && W.HK.toast ? W.HK.toast(m, ms) : null; }

  var ME = null;
  var LAST_SYNC = 0;

  /* =============== حساب محلی برای حالت آنلاین و اپ اندروید ===============
     در اپ اندروید، صفحه‌ها از دامنهٔ داخلی appassets.androidplatform.net
     بارگذاری می‌شوند و هیچ سروری وجود ندارد؛ پس درخواست ثبت‌نام خطای ۴۰۴
     می‌داد و ثبت‌نام کار نمی‌کرد. حالا در این حالت (و وقتی فایل را مستقیم
     باز کنی) حساب روی خود دستگاه ساخته می‌شود و ورود/خروج/پروفایل کار
     می‌کند. حساب ایمیلیِ مالک هم همان‌جا تیک آبی و نقش مالک می‌گیرد. */
  var OFFLINE = (location.hostname === "appassets.androidplatform.net") ||
    (location.hostname === "" ) || (location.protocol === "file:");
  var OWNER_EMAIL = "parham.savar92@gmail.com";
  var L_USERS = "g8:localUsers", L_SESS = "g8:localSession";

  function lUsers() { try { return JSON.parse(localStorage.getItem(L_USERS) || "{}"); } catch (e) { return {}; } }
  function lWrite(o) { try { localStorage.setItem(L_USERS, JSON.stringify(o)); } catch (e) {} }
  function lSession() { try { return JSON.parse(localStorage.getItem(L_SESS) || "null"); } catch (e) { return null; } }
  function lHash(s) {
    var h = 5381, i;
    for (i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
    return "L" + (h >>> 0).toString(36);
  }
  function lAuth(path, body) {
    body = body || {};
    var email = String(body.email || "").trim().toLowerCase();
    var users = lUsers();
    if (path === "/api/auth/me") {
      var me = lSession();
      return me ? Promise.resolve({ user: me, local: true }) : Promise.reject(new Error("ورود لازم است."));
    }
    if (path === "/api/auth/register") {
      if (!/^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$/.test(email)) return Promise.reject(new Error("ایمیل معتبر نیست."));
      if (String(body.password || "").length < 6) return Promise.reject(new Error("رمز باید حداقل ۶ نویسه باشد."));
      if (users[email]) return Promise.reject(new Error("این ایمیل قبلاً در این دستگاه ثبت شده است."));
      var owner = false; /* مالک فقط از طریق سرور اصلی تعیین می‌شود */
      // تعیین نقش در حالت محلی هم مثل سرور: دانش‌آموز آزاد، بقیه با کد همکاران
      var wantRole = String(body.role || "student").toLowerCase();
      if (["teacher", "deputy"].indexOf(wantRole) > -1 &&
        String(body.staffCode || "").trim() !== "rahnama-hamkaran") {
        var eRole = new Error("برای نقش دبیر / ناظم / مدیر باید «کد همکاران» درست را وارد کنی.");
        eRole.data = { needCode: true };
        return Promise.reject(eRole);
      }
      if (["student", "teacher", "deputy"].indexOf(wantRole) < 0) wantRole = "student";
      var ROLE_FA = { student: "دانش‌آموز", teacher: "دبیر", deputy: "ناظم", admin: "مدیر", owner: "مالک سایت" };
      var user = {
        id: "local-" + lHash(email),
        name: String(body.name || "").trim() || (owner ? "پارهام سوار" : "دانش‌آموز"),
        email: email,
        role: owner ? "owner" : wantRole,
        roleFa: owner ? ROLE_FA.owner : ROLE_FA[wantRole],
        isOwner: owner,
        verified: owner,
        grade: String(body.grade || ""),
        school: String(body.school || "").slice(0, 60),
        color: "#6d5efc",
        bio: owner ? "مالک و مدیر سایت رهنما" : "",
        local: true,
        createdAt: Date.now(),
      };
      users[email] = { p: lHash(String(body.password || "")), joined: Date.now(), user: user };
      lWrite(users);
      try { localStorage.setItem(L_SESS, JSON.stringify(user)); } catch (e) {}
      return Promise.resolve({ user: user, local: true });
    }
    if (path === "/api/auth/login") {
      var rec = users[email];
      if (!rec) return Promise.reject(new Error("در این دستگاه حسابی با این ایمیل نیست؛ اول ثبت‌نام کن."));
      if (rec.p !== lHash(String(body.password || ""))) return Promise.reject(new Error("رمز نادرست است."));
      try { localStorage.setItem(L_SESS, JSON.stringify(rec.user)); } catch (e) {}
      return Promise.resolve({ user: rec.user, local: true });
    }
    if (path === "/api/auth/logout") {
      try { localStorage.removeItem(L_SESS); } catch (e) {}
      return Promise.resolve({ ok: true });
    }
    return Promise.reject(new Error("این قابلیت در حالت آنلاین در دسترس نیست."));
  }

  /* پروفایل و رمز در حالت محلی (اپ اندروید / فایل مستقیم) */
  function lMe(path, body) {
    body = body || {};
    var me = lSession();
    if (!me) return Promise.reject(new Error("ورود لازم است."));
    var users = lUsers(), rec = users[me.email];
    var ROLE_FA = { student: "دانش‌آموز", teacher: "دبیر", deputy: "ناظم", admin: "مدیر", owner: "مالک سایت" };
    if (path === "/api/me/profile") {
      var nm = String(body.name == null ? me.name : body.name).trim();
      if (!nm) return Promise.reject(new Error("نام نمی‌تواند خالی باشد."));
      me.name = nm.slice(0, 60);
      if (["7", "8", "9"].indexOf(String(body.grade)) > -1) me.grade = String(body.grade);
      if (body.school != null) me.school = String(body.school).slice(0, 60);
      if (body.city != null) me.city = String(body.city).slice(0, 40);
      if (body.bio != null) me.bio = String(body.bio).slice(0, 300);
      if (/^#[0-9a-fA-F]{6}$/.test(String(body.color || ""))) me.color = body.color;
      if (body.role && !me.isOwner && body.role !== me.role) {
        var wr = String(body.role).toLowerCase();
        if (["student", "teacher", "deputy"].indexOf(wr) < 0) return Promise.reject(new Error("نقش مدیر فقط توسط مالک سایت تعیین می‌شود."));
        if (wr !== "student" && String(body.staffCode || "").trim() !== "rahnama-hamkaran") {
          var e = new Error("برای نقش دبیر / ناظم / مدیر باید «کد همکاران» درست را وارد کنی.");
          e.data = { needCode: true }; return Promise.reject(e);
        }
        me.role = wr;
      }
      me.roleFa = ROLE_FA[me.role] || me.roleFa;
      if (rec) { rec.user = me; lWrite(users); }
      try { localStorage.setItem(L_SESS, JSON.stringify(me)); } catch (e2) {}
      return Promise.resolve({ ok: true, user: me, local: true });
    }
    if (path === "/api/me/password") {
      var nx = String(body.next || body.password || "");
      if (nx.length < 6) return Promise.reject(new Error("رمز جدید باید حداقل ۶ نویسه باشد."));
      if (!rec || rec.p !== lHash(String(body.current || ""))) return Promise.reject(new Error("رمز فعلی نادرست است."));
      rec.p = lHash(nx); lWrite(users);
      return Promise.resolve({ ok: true, local: true });
    }
    return Promise.resolve({ ok: true, local: true });
  }

  /* ----------------------------------------------------- درخواست API */
  function api(method, path, body) {
    var isAuth = path.indexOf("/api/auth/") === 0;
    if (OFFLINE && (path === "/api/me/profile" || path === "/api/me/password")) return lMe(path, body);
    if (isAuth && OFFLINE) return lAuth(path, body);
    var opt = { method: method, headers: {}, credentials: "same-origin" };
    if (method !== "GET") {
      opt.headers["Content-Type"] = "application/json";
      opt.headers["X-HK"] = "1";
      opt.body = JSON.stringify(body === undefined ? {} : body);
    }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.error) || ("خطا (" + r.status + ")")); e.status = r.status; e.data = j; throw e; }
        return j;
      });
    }).catch(function (e) {
      // اگر مسیرهای حساب روی این نسخه وجود نداشتند (مثل اپ آفلاین)، محلی پیش می‌رویم
      if (isAuth && (e.status === 404 || e.name === "TypeError")) return lAuth(path, body);
      throw e;
    });
  }

  /* ------------------------------------------------ جمع‌آوری دادهٔ محلی */
  function collectLocal() {
    var out = { read: {}, notes: [], marks: [], tasks: [], exams: [], studyLog: [], plan: null, fcKnown: {}, scores: {} };
    var i, k, v;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (!k || k.indexOf("g8:") !== 0) continue;
        if (k.indexOf("g8:read:") === 0) { v = LS.get(k, false); if (v) out.read[k] = true; }
        else if (k.indexOf("g8:notes:") === 0) out.notes = out.notes.concat(LS.get(k, []) || []);
        else if (k === "g8:marks") out.marks = LS.get(k, []) || [];
        else if (k === "g8:tasks") out.tasks = LS.get(k, []) || [];
        else if (k === "g8:exams") out.exams = LS.get(k, []) || [];
        else if (k === "g8:studyLog") out.studyLog = LS.get(k, []) || [];
        else if (k === "g8:plan") out.plan = LS.get(k, null);
        else if (k === "g8:fcKnown") out.fcKnown = LS.get(k, {}) || {};
        else if (k.indexOf("g8:rpScores:") === 0) out.scores[k] = LS.get(k, {});
      }
    } catch (e) {}
    return out;
  }

  /** دادهٔ سرور را روی همین دستگاه می‌نویسد (طوری که بقیهٔ صفحه‌ها ببینند). */
  function applyServer(data) {
    if (!data) return;
    var set = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
    Object.keys(data.read || {}).forEach(function (k) { set(k, true); });
    set("g8:marks", data.marks || []);
    set("g8:tasks", data.tasks || []);
    set("g8:exams", data.exams || []);
    set("g8:studyLog", data.studyLog || []);
    set("g8:fcKnown", data.fcKnown || {});
    if (data.plan) set("g8:plan", data.plan);
    Object.keys(data.scores || {}).forEach(function (k) { set(k, data.scores[k]); });

    // یادداشت‌ها بر پایهٔ درس گروه‌بندی می‌شوند
    var bySub = {};
    (data.notes || []).forEach(function (n) {
      var s = n.sub || "jozve";
      (bySub[s] = bySub[s] || []).push(n);
    });
    Object.keys(bySub).forEach(function (s) { set("g8:notes:" + s, bySub[s]); });
  }

  var syncTimer = 0;
  function sync(silent) {
    if (!ME) return Promise.resolve(null);
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = 0; }
    return api("POST", "/api/me/sync", { data: collectLocal() }).then(function (r) {
      applyServer(r.data);
      LAST_SYNC = Date.now();
      if (!silent) toast("داده‌هایت با حساب همگام شد");
      paintAvatar();
      try { W.dispatchEvent(new CustomEvent("hk:synced", { detail: r.data })); } catch (e) {}
      return r.data;
    }).catch(function (e) {
      if (!silent) toast("همگامی انجام نشد: " + e.message);
      return null;
    });
  }
  function scheduleSync(delay) {
    if (!ME) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { sync(true); }, delay || 4000);
  }

  /* ------------------------------------------------------ سربرگ */
  function paintAvatar() {
    var nav = $(".header-nav");
    if (!nav) return;
    var old = $(".hk-account", nav);
    if (old) old.remove();

    var a = D.createElement("a");
    a.className = "hk-account";
    if (ME) {
      a.href = U("profile.html");
      a.title = ME.name + " — " + (ME.roleFa || "") + (ME.verified ? " · تأییدشده" : "");
      a.innerHTML =
        '<span class="hk-ava" style="background:linear-gradient(140deg,' + (ME.color || "#6d5efc") + ',color-mix(in srgb,' + (ME.color || "#6d5efc") + ' 55%,#000))">' +
        esc((ME.name || "؟").trim().charAt(0)) + "</span>" +
        "<span>" + esc((ME.name || "").split(" ")[0]) + "</span>" +
        (ME.verified ? '<span class="hk-tick" title="حساب تأییدشده" aria-label="تأییدشده"></span>' : "") +
        (ME.isOwner ? '<span class="hk-ownertag">مالک</span>'
          : (ME.role === "admin" || ME.role === "teacher" ? '<span class="hk-role">' + esc(ME.roleFa) + "</span>" : ""));
    } else {
      a.href = U("profile.html");
      a.title = "ورود یا ثبت‌نام";
      a.innerHTML = '<span class="hk-ava" style="background:var(--surface-3);color:var(--text-soft)">؟</span><span>ورود</span>';
    }
    var themeBtn = $("[data-theme-toggle]", nav);
    if (themeBtn) nav.insertBefore(a, themeBtn);
    else nav.appendChild(a);

    if (ME && (ME.role === "admin" || ME.isOwner)) {
      var adm = D.createElement("a");
      adm.className = "hk-account hk-admin-link";
      adm.href = U("admin.html");
      adm.innerHTML = '<span class="hk-ava" style="background:linear-gradient(140deg,#111827,#374151);color:#fff">⚙</span><span>مدیریت</span>';
      nav.insertBefore(adm, a);
    }
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* -------------------------------------------------- اعلان سراسری */
  function banner(ann) {
    var old = $(".hk-announce[data-global]");
    if (ann && ann.active && ann.text) {
      if (old) { old.className = "hk-announce lv-" + ann.level; $("span", old).textContent = ann.text; return; }
      var b = D.createElement("div");
      b.className = "hk-announce lv-" + (ann.level || "info");
      b.setAttribute("data-global", "1");
      b.innerHTML = '<span>' + esc(ann.text) + '</span><button aria-label="بستن">✕</button>';
      b.querySelector("button").addEventListener("click", function () { b.remove(); });
      var hdr = $(".site-header");
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(b, hdr.nextSibling);
      else D.body.insertBefore(b, D.body.firstChild);
    } else if (old) old.remove();
  }

  /* --------------------------------------------------- راه‌اندازی */
  /* ------------------------------------------------------------------------
     بارگذاری بستهٔ مطالعه (نوار پیشرفت، فهرست مطالب، خوانده‌شده، ادامهٔ مطالعه)
     فقط روی صفحه‌های درس. از همین فایل بارگذاری می‌شود تا نیازی به تغییر
     تک‌تک صفحه‌های درس نباشد. مسیر از روی آدرس همین اسکریپت حساب می‌شود،
     پس هم روی سرور و هم در نسخهٔ آفلاین (مسیرهای نسبی) درست کار می‌کند.
     ------------------------------------------------------------------------ */
  function loadStudyPack() {
    try {
      var isLesson = !!D.querySelector("article.lesson");
      var isClass = !!D.querySelector("#clsRoom, #clsLobby");
      if (!isLesson && !isClass) return;
      // صفحهٔ درس → بستهٔ مطالعه · صفحهٔ کلاس مجازی → ابزارهای زندهٔ کلاس
      var want = isLesson ? "hk-study" : "hk-class-live";
      if (D.querySelector('script[src*="' + want + '.js"]')) return;
      var base = "";
      var me = D.currentScript;
      if (me && me.src) base = me.src.replace(/hk-auth\.js.*$/, "");
      if (!base) {
        var tag = D.querySelector('script[src*="hk-auth.js"]');
        if (tag && tag.src) base = tag.src.replace(/hk-auth\.js.*$/, "");
      }
      if (!base) base = "/assets/";
      if (isLesson) {
        var l = D.createElement("link");
        l.rel = "stylesheet";
        l.href = base + "hk-study.css";
        D.head.appendChild(l);
      }
      var s = D.createElement("script");
      s.src = base + want + ".js";
      s.defer = true;
      D.body.appendChild(s);
    } catch (e) {}
  }

  /* پیوند «پنل من» در نوار بالای صفحه — به‌جای دست‌زدن به ۹۶ فایل HTML،
     این پیوند در زمان اجرا اضافه می‌شود و مسیرش هم نسبی حساب می‌شود. */
  function addPanelLink() {
    try {
      var nav = D.querySelector(".header-nav");
      if (!nav) return;
      var base = "";
      var tag = D.querySelector('script[src*="hk-auth.js"]');
      if (tag && tag.src) base = tag.src.replace(/assets\/hk-auth\.js.*$/, "");

      /* «پنل من»، «کلاس مجازی» و «درباره ما» باید در منوی همهٔ صفحه‌ها باشند.
         در زمان اجرا اضافه می‌شوند تا نیازی به دست‌زدن به ۹۶ فایل HTML نباشد
         و در نسخهٔ آفلاین و اپ اندروید هم کار کنند. */
      var want = [
        ["panel.html", "پنل من", "hkPanelLink"],
        ["class.html", "کلاس مجازی", "hkClassLink"],
        ["about.html", "دربارهٔ ما", "hkAboutLink"]
      ];
      want.forEach(function (w) {
        if (nav.querySelector("[" + w[2] + "]")) return;
        var exists = Array.prototype.some.call(nav.querySelectorAll("a"), function (a) {
          return String(a.getAttribute("href") || "").indexOf(w[0]) > -1;
        });
        if (exists) return;
        var a = D.createElement("a");
        a.href = base + w[0];
        a.setAttribute(w[2], "1");
        a.textContent = w[1];
        nav.appendChild(a);
      });
    } catch (e) {}
  }

  function boot() {
    loadStudyPack();
    addPanelLink();
    // وضعیت عمومی سایت (اعلان، ثبت‌نام، تعمیر)
    fetch("/api/site/status", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (s) {
        if (s && s.announcement) banner(s.announcement);
        W.HK = W.HK || {};
        W.HK.siteStatus = s;
      })
      .catch(function () {});

    // وضعیت ورود
    api("GET", "/api/auth/me").then(function (r) {
      ME = r.user;
      paintAvatar();
      // حساب محلی (حالت آنلاین) چیزی برای همگام‌سازی با سرور ندارد
      if (ME && !OFFLINE && !ME.local) {
        sync(true);
        setInterval(function () { sync(true); }, 3 * 60 * 1000);
        // هر تغییری در پیشرفت → همگامی با تأخیر
        W.addEventListener("hk:progress", function () { scheduleSync(4000); });
        D.addEventListener("visibilitychange", function () { if (D.hidden) sync(true); });
      }
      W.dispatchEvent(new CustomEvent("hk:auth", { detail: ME }));
    }).catch(function () { paintAvatar(); });

    W.HK = W.HK || {};
    W.HK.auth = {
      api: api,
      me: function () { return ME; },
      setMe: function (u) { ME = u; paintAvatar(); },
      login: function (email, password) {
        return api("POST", "/api/auth/login", { email: email, password: password }).then(function (r) {
          ME = r.user; paintAvatar(); sync(true); return r.user;
        });
      },
      register: function (payload) {
        return api("POST", "/api/auth/register", payload).then(function (r) {
          ME = r.user; paintAvatar(); sync(true); return r.user;
        });
      },
      logout: function () {
        return api("POST", "/api/auth/logout", {}).then(function () { ME = null; paintAvatar(); });
      },
      sync: sync,
      collect: collectLocal,
      apply: applyServer,
      lastSync: function () { return LAST_SYNC; }
    };
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
