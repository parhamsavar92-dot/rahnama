/* ==========================================================================
   رهنما — اعمال مستقیم تنظیمات پنل مالک روی سایت  |  r9-owner.js
   --------------------------------------------------------------------------
   هر چیزی که مالک در پنل تغییر می‌دهد، همان لحظه باید روی سایت دیده شود.

   این فایل روی همهٔ صفحه‌ها بار می‌شود و:
     ۱. تنظیمات عمومی را از سرور می‌گیرد (/api/site/status)
     ۲. همهٔ آن‌ها را روی همین صفحه اعمال می‌کند — نه فقط چند پرچم
     ۳. هر ۲۰ ثانیه تازه می‌کند و با برگشتن به تب هم بازبینی می‌کند
        پس کاربر لازم نیست صفحه را نو کند
     ۴. اگر مالک در همین مرورگر تغییر بدهد، از طریق BroadcastChannel
        بی‌درنگ در همهٔ زبانه‌های باز اعمال می‌شود

   هر بخش مستقل و در try/catch است تا خرابی یک مورد، صفحه را خراب نکند.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!D || !D.body) return;

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function toast(m) { try { W.HK && W.HK.toast ? W.HK.toast(m) : null; } catch (e) { } }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }

  /* آیا خودِ پنل مالک هستیم؟ روی این صفحه نباید تزئینات سایت اعمال شود
     (مثلاً پنهان‌کردن لینک پایه‌ها ناوبری پنل را به‌هم می‌ریزد). */
  var IS_ADMIN = /(^|\/)(admin\.html|admin)$/.test(location.pathname);

  var SRV = null;                 // آخرین پاسخ /api/site/status
  var OPEN = null;                // آخرین settings اعمال‌شده
  var CH = null;                  // کانال پخش هم‌مرورگری
  try { if (W.BroadcastChannel) CH = new W.BroadcastChannel("g8-site-flags"); } catch (e) { CH = null; }

  /* ═══════════════ ۱. اعلان سراسری (announcement) ═══════════════ */
  function paintAnnounce(ann) {
    var old = $(".hk-announce[data-global]");
    if (ann && ann.active && ann.text) {
      if (old) {
        old.className = "hk-announce lv-" + (ann.level || "info");
        var sp = $("span", old);
        if (sp) sp.textContent = ann.text;
      } else {
        var b = D.createElement("div");
        b.className = "hk-announce lv-" + (ann.level || "info");
        b.setAttribute("data-global", "1");
        b.innerHTML = "<span>" + esc(ann.text) + "</span>" +
          '<button type="button" aria-label="بستن">✕</button>';
        var btn = b.querySelector("button");
        if (btn) btn.addEventListener("click", function () { b.remove(); });
        var hdr = $(".site-header");
        if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(b, hdr.nextSibling);
        else D.body.insertBefore(b, D.body.firstChild);
      }
    } else if (old) old.remove();
  }

  /* ═══════════════ ۲. اطلاعیهٔ سایت (siteNotice) ═══════════════ */
  function paintNotice(text) {
    var el = $("#r9SiteNotice");
    if (!text) { if (el) el.remove(); return; }
    if (lsGet("r9:noticeClosed", "") === text) { if (el) el.remove(); return; }
    if (!el) {
      el = D.createElement("div");
      el.id = "r9SiteNotice";
      el.className = "r9-site-notice";
      var hdr = $(".site-header");
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(el, hdr.nextSibling);
      else D.body.insertBefore(el, D.body.firstChild);
    }
    el.innerHTML = '<span class="r9n-ico" aria-hidden="true">📣</span>' +
      '<span class="r9n-txt">' + esc(text) + "</span>" +
      '<button type="button" class="r9n-x" aria-label="بستن"> ✕ </button>';
    el.querySelector(".r9n-x").addEventListener("click", function () {
      lsSet("r9:noticeClosed", text);
      el.remove();
    });
  }

  /* ═══════════════ ۳. حالت تعمیر سایت + یادداشت ═══════════════ */
  function paintMaintenance(s) {
    var on = !!s.maintenance;
    D.body.classList.toggle("hks-maint", on);
    var el = $("#r9MaintBar");
    var note = s.maintenanceNote || "سایت موقتاً در حال به‌روزرسانی است. لطفاً کمی بعد برگرد.";
    if (!on) { if (el) el.remove(); return; }
    if (!el) {
      el = D.createElement("div");
      el.id = "r9MaintBar";
      el.className = "r9-maint-bar";
      var hdr = $(".site-header");
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(el, hdr.nextSibling);
      else D.body.insertBefore(el, D.body.firstChild);
    }
    el.innerHTML = '<b>در حال به‌روزرسانی</b> ' + esc(note);
  }

  /* ═══════════════ ۴. رنگ سایت (theme) ═══════════════ */
  function paintTheme(t) {
    if (!t || !/^#[0-9a-f]{3,8}$/i.test(t)) return;
    try {
      D.documentElement.style.setProperty("--brand", t);
      D.documentElement.style.setProperty("--accent", t);
    } catch (e) { }
  }

  /* ═══════════════ ۵. متن هیرو صفحهٔ اصلی (hero) ═══════════════ */
  function paintHero(h) {
    if (!h) return;
    var t = $(".hero h1");
    if (t && h.title) t.textContent = h.title;
    var p = $(".hero-lead");
    if (p && h.sub) p.textContent = h.sub;
  }

  /* ═══════════════ ۶. راه‌های تماس در فوتر (contact) ═══════════════ */
  function paintContact(c) {
    if (!c) return;
    var box = $("#r9Contact");
    var has = c.email || c.telegram || c.instagram;
    if (!has) { if (box) box.remove(); return; }
    var foot = $(".site-footer .wrap") || $(".site-footer");
    if (!foot) return;
    if (!box) {
      box = D.createElement("div");
      box.id = "r9Contact";
      box.className = "r9-contact";
      foot.appendChild(box);
    }
    var items = [];
    if (c.email) items.push('<a href="mailto:' + esc(c.email) + '">✉ ' + esc(c.email) + "</a>");
    if (c.telegram) {
      var tg = String(c.telegram).replace(/^@/, "");
      items.push('<a href="https://t.me/' + esc(tg) + '" target="_blank" rel="noopener">✈ تلگرام</a>');
    }
    if (c.instagram) {
      var ig = String(c.instagram).replace(/^@/, "");
      items.push('<a href="https://instagram.com/' + esc(ig) + '" target="_blank" rel="noopener">◉ اینستاگرام</a>');
    }
    box.innerHTML = "<b>راه‌های تماس:</b> " + items.join(" · ");
  }

  /* ═══════════════ ۷. پایه‌های مجاز (allowedGrades) ═══════════════ */
  function gradeOfHref(h) {
    if (!h) return null;
    var m = h.match(/[?&]g=([0-9])/) || h.match(/(?:^|\/)g([0-9])(?:\/|$)/);
    return m ? m[1] : null;
  }
  function paintGrades(s) {
    var list = (s.allowedGrades && s.allowedGrades.length) ? s.allowedGrades.map(String) : ["7", "8", "9"];
    var allowed = function (g) { return list.indexOf(String(g)) > -1; };

    // ۱) فهرست پایه در فرم ثبت‌نام
    var sel = $("#rgGrade");
    if (sel) {
      $$("option", sel).forEach(function (o) {
        var v = o.value;
        if (!v) return;
        var ok = allowed(v);
        o.hidden = !ok; o.disabled = !ok;
        if (!ok && sel.value === v) sel.value = "";
      });
      var bad = $$("option", sel).filter(function (o) { return o.value && !o.disabled; });
      if (bad.length && !sel.value) sel.value = bad[0].value;
    }

    // ۲) لینک‌های پایه‌های غیرمجاز در ناوبری و کارت‌ها
    $$("a[href]").forEach(function (a) {
      var g = gradeOfHref(a.getAttribute("href"));
      if (!g) return;
      var hide = !allowed(g);
      a.style.display = hide ? "none" : "";
      // کارت‌های والد را هم اگر فقط همین یک لینک بودند پنهان کن
      var par = a.closest ? a.closest(".subject-card, .tool-card, .grade-card, .card") : null;
      if (par && hide && par.querySelectorAll("a[href]").length === 1) par.style.display = "none";
      else if (par && !hide) par.style.display = "";
    });

    // ۳) اگر کاربر روی صفحهٔ پایهٔ غیرمجاز است، اطلاع بده
    var here = gradeOfHref(location.pathname);
    if (here && !allowed(here)) {
      var n = $("#r9GradeNote");
      if (!n) {
        n = D.createElement("div");
        n.id = "r9GradeNote";
        n.className = "r9-grade-note";
        n.innerHTML = "این پایه فعلاً روی سایت فعال نیست. " +
          '<a href="' + (D.body.getAttribute("data-base") || "") + 'index.html">بازگشت به صفحهٔ اصلی</a>';
        var main = $("main");
        if (main) main.insertBefore(n, main.firstChild);
      }
    }
  }

  /* ═══════════════ ۸. ویژگی‌های روشن/خاموش (features) ═══════════════ */
  var FLAG_LINKS = {
    klass: ["class.html", "class-support.html", "social.html"],
    exam: ["exam.html"],
    ai: ["ai.html"],
    consult: ["consult.html"],
    jozve: ["jozve.html"]
  };
  function paintFeatures(f) {
    Object.keys(FLAG_LINKS).forEach(function (k) {
      var v = f ? f[k] : undefined;
      // فقط وقتی مالک صریحاً خاموش کرده باشد
      var off = (v === false);
      var roots = FLAG_LINKS[k].map(function (h) { return h.replace(/\.html$/, ""); });
      $$("a[href]").forEach(function (a) {
        var h = a.getAttribute("href") || "";
        var hit = roots.some(function (r) {
          return new RegExp("(^|/)" + r.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(\\.html)?(\\?|#|$)").test(h);
        });
        if (!hit) return;
        a.style.display = off ? "none" : "";
        var par = a.closest ? a.closest(".tool-card, .subject-card, .card") : null;
        if (par && off && par.querySelectorAll("a[href]").length === 1) par.style.display = "none";
      });
    });
  }

  /* ═══════════════ ۹. وضعیت ثبت‌نام (registrationOpen) ═══════════════ */
  function paintRegister(s) {
    var open = s.registrationOpen !== false;
    D.body.classList.toggle("hks-reg-closed", !open);
    var wrap = $("#authWrap");
    if (!wrap) return;
    var note = $("#r9RegClosed");
    if (open) { if (note) note.remove(); }
    else if (!note) {
      note = D.createElement("div");
      note.id = "r9RegClosed";
      note.className = "r9-reg-closed";
      note.innerHTML = "<b>ثبت‌نام فعلاً بسته است.</b> اگر حساب داری می‌توانی وارد شوی؛ " +
        "برای باز شدن ثبت‌نام، بعداً سر بزن.";
      wrap.insertBefore(note, wrap.firstChild);
    }
    // دکمه‌ها و فرم ثبت‌نام را خاموش کن
    var tab = $('.hk-tab[data-pane="reg"]');
    if (tab) { tab.disabled = !open; tab.style.opacity = open ? "" : ".5"; }
    var form = $("#regForm");
    if (form) {
      if (!open) { form.hidden = true; form.setAttribute("data-r9-closed", "1"); }
      else if (form.getAttribute("data-r9-closed") === "1") {
        form.removeAttribute("data-r9-closed");
      }
    }
  }

  /* ═══════════════ ۱۰. پیش‌فرض‌های آزمون (examDefaults) ═══════════════ */
  function paintExamDefaults(d) {
    try {
      W.HK = W.HK || {};
      W.HK.examDefaults = d || null;
      W.dispatchEvent(new CustomEvent("hk:exam-defaults", { detail: d || null }));
    } catch (e) { }
  }

  /* ═══════════════ ۱۱. اعمال همه با هم ═══════════════ */
  function apply(s, full) {
    if (!s) return;
    OPEN = s;
    var jobs = [
      function () { paintAnnounce((full && full.announcement) || s.announcement); },
      function () { paintNotice(s.siteNotice); },
      function () { paintMaintenance(s); },
      function () { paintTheme(s.theme); },
      function () { paintExamDefaults(s.examDefaults); },
      function () { paintRegister(s); }
    ];
    /* تزئینات صفحه‌های عمومی — روی پنل مالک اجرا نمی‌شوند */
    if (!IS_ADMIN) {
      jobs.push(
        function () { paintHero(s.hero); },
        function () { paintContact(s.contact); },
        function () { paintGrades(s); },
        function () { paintFeatures(s.features); }
      );
    }
    jobs.forEach(function (fn) { try { fn(); } catch (e) { } });
    try {
      D.documentElement.setAttribute("data-site-settings", "1");
    } catch (e) { }
  }

  /* ═══════════════ ۱۲. گرفتن از سرور + تازه‌سازی زنده ═══════════════ */
  var inflight = false;
  function load() {
    if (inflight) return Promise.resolve(SRV);
    inflight = true;
    return fetch("/api/site/status", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        inflight = false;
        if (!j || j.ok !== true) return SRV;
        SRV = j;
        try { W.HK = W.HK || {}; W.HK.siteStatus = j; } catch (e) { }
        apply(j.settings || {}, j);
        try { D.dispatchEvent(new CustomEvent("hk:site-status", { detail: j })); } catch (e) { }
        return j;
      })
      .catch(function () { inflight = false; return SRV; });
  }

  function startLive() {
    // ۱) تازه‌سازی زمان‌دار (مالک تغییر می‌دهد → تا ۲۰ ثانیه بعد این‌جا دیده می‌شود)
    setInterval(load, 20000);
    // ۲) برگشتن به تب یا پنجره
    D.addEventListener("visibilitychange", function () { if (!D.hidden) load(); });
    W.addEventListener("focus", function () { load(); });
    W.addEventListener("online", function () { load(); });
    // ۳) اگر مالک در همین مرورگر تغییر داد → بی‌درنگ در همهٔ زبانه‌ها
    if (CH) {
      try {
        CH.onmessage = function (ev) {
          var t = ev && ev.data && ev.data.t;
          if (t === "flags" || t === "admin-write" || t === "site-changed") load();
        };
      } catch (e) { }
    }
    W.addEventListener("storage", function (e) {
      if (e && (e.key === "g8:site:flags" || e.key === "g8:site")) load();
    });
  }

  /* --------------------------------------------- قلاب نوشتن‌های پنل مالک
     ▼ مهم‌ترین بخش همین است ▼
     روی صفحهٔ پنل مالک، هر درخواست موفقی که وضعیت سایت را تغییر می‌دهد
     (/api/admin/...) گرفته می‌شود و همان لحظه:
       • تنظیمات تازه از سرور خوانده و روی همین صفحه اعمال می‌شود
       • به همهٔ زبانه‌های باز دیگر هم خبر داده می‌شود
     پس مالک لازم نیست کاری بکند و کاربران هم بدون رفرش تغییر را می‌بینند.
     این قلاب همهٔ کارهای پنل را پوشش می‌دهد: تنظیمات، پرچم‌ها، حالت تعمیر،
     اعلان، باز/بسته‌کردن ثبت‌نام، پایه‌های مجاز، متن‌ها و پیش‌فرض‌های آزمون. */
  function hookAdminWrites() {
    if (!IS_ADMIN) return;
    var orig = W.fetch;
    if (typeof orig !== "function" || orig.__r9owner) return;
    function wrapped(input, init) {
      var url = (typeof input === "string") ? input : ((input && input.url) || "");
      var method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      var p = orig.apply(this, arguments);
      if (method !== "GET" && url.indexOf("/api/admin/") > -1) {
        p.then(function (r) {
          if (r && r.ok) {
            try { if (CH) CH.postMessage({ t: "admin-write", url: url }); } catch (e) { }
            load();
          }
        }).catch(function () { });
      }
      return p;
    }
    wrapped.__r9owner = 1;
    try { W.fetch = wrapped; } catch (e) { }
  }

  function boot() {
    hookAdminWrites();                       // پیش از هر نوشتنِ پنل، قلاب آماده باشد
    load().then(function () { startLive(); });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();

  W.HKSite = {
    refresh: load,
    status: function () { return SRV; },
    settings: function () { return OPEN; },
    apply: function (s) { apply(s || OPEN || {}, SRV); }
  };
})();
