/* ==========================================================================
   رهنما — موتور سه‌بعدی و گزینه‌های حرفه‌ای  |  hk3d.js
   • صحنهٔ سه‌بعدی با مکعب چرخان و نشان‌های شناور
   • تیلت واقعی با لایه‌های عمق و درخشش سطح
   • پالت فرمان (Ctrl+K): اجرای هر کار یا رفتن به هر صفحه فقط با تایپ
   • زمان‌سنج مطالعهٔ پومودورو با گزارش در کارنامه
   • بسته‌های رنگ، گردی گوشه، تراکم، پس‌زمینه و شدت سه‌بعدی
   همه‌چیز روی همان دستگاه ذخیره می‌شود.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var J = (W.G8 && W.G8.jsonLoad) || function (p) { return fetch(U(p)).then(function (r) { return r.json(); }); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return NFA[+d]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function toast(m, ms) { W.HK && W.HK.toast ? W.HK.toast(m, ms) : null; }

  var LITE = W.HK && W.HK.lite;
  var KEY = "g8:ux";

  var DEFAULTS = {
    theme: "violet",
    radius: "auto",
    density: "normal",
    bg: "mesh",
    d3d: LITE ? "soft" : "max",
    shine: true,
    accent: "",
    timer: true
  };
  var UX = Object.assign({}, DEFAULTS, LS.get(KEY, {}) || {});

  var THEMES = [
    ["violet", "#6d5efc"], ["ocean", "#0ea5e9"], ["emerald", "#10b981"], ["sunset", "#f97316"],
    ["rose", "#e11d48"], ["royal", "#4f46e5"], ["amber", "#d97706"], ["slate", "#475569"]
  ];
  var THEME_NAMES = {
    violet: "بنفش", ocean: "اقیانوس", emerald: "زمرد", sunset: "غروب",
    rose: "رز", royal: "شاهانه", amber: "کهربا", slate: "سنگی"
  };

  /* -------------------------------------------------- اعمال تنظیمات */
  function apply() {
    var r = D.documentElement;
    r.setAttribute("data-hk-theme", UX.theme);
    if (UX.radius === "auto") r.removeAttribute("data-hk-radius");
    else r.setAttribute("data-hk-radius", UX.radius);
    if (UX.density === "normal") r.removeAttribute("data-hk-density");
    else r.setAttribute("data-hk-density", UX.density);
    r.setAttribute("data-hk-bg", UX.bg);
    r.setAttribute("data-hk-3d", UX.d3d);
    if (UX.accent) {
      r.style.setProperty("--brand", UX.accent);
      r.style.setProperty("--accent-soft", hexA(UX.accent, .13));
    } else {
      r.style.removeProperty("--brand");
      r.style.removeProperty("--accent-soft");
    }
    D.body.classList.toggle("hk3-no-shine", !UX.shine);
    LS.set(KEY, UX);
    syncControls();
  }
  function hexA(hex, a) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  }

  /* ------------------------------------------------ صحنهٔ سه‌بعدی */
  function buildScene() {
    var art = $(".hero-art");
    if (!art || $(".h3-scene")) return;
    var sc = D.createElement("div");
    sc.className = "h3-scene";
    sc.setAttribute("aria-hidden", "true");
    sc.innerHTML =
      '<div class="h3-cube">' +
        '<div class="h3-face"><div><b>۳۶</b><small>جزوهٔ کامل</small></div></div>' +
        '<div class="h3-face"><div><b>۶۰۹</b><small>درس و فصل</small></div></div>' +
        '<div class="h3-face"><div><b>۳۸۶۱</b><small>پرسش با پاسخ</small></div></div>' +
        '<div class="h3-face"><div><b>AI</b><small>مشاور اجرایی</small></div></div>' +
        '<div class="h3-face"><div><b>PDF</b><small>چاپ و ذخیره</small></div></div>' +
        '<div class="h3-face"><div><b>آنلاین</b><small>همیشه در دسترس</small></div></div>' +
      "</div>" +
      '<div class="h3-shadow"></div>' +
      '<span class="h3-float">۳۱ کار با یک جمله</span>' +
      '<span class="h3-float">برجسته‌سازی و یادداشت</span>' +
      '<span class="h3-float">آزمون و فلش‌کارت خودکار</span>';
    art.insertBefore(sc, art.firstChild);

    if (UX.d3d === "max" && !LITE) parallax(sc, $(".h3-cube", sc));
  }

  function parallax(scene, cube) {
    /* روی صفحه‌های لمسی، هنگام اسکرول با انگشت رویداد pointermove پشت‌سرهم
       می‌آید و هر بار چشم‌انداز سه‌بعدی بازنویسی می‌شود؛ همین کار اسکرول را
       کند و لرزان می‌کند. پس فقط روی رایانه (ماوس) فعال می‌شود. */
    var fine = W.matchMedia && W.matchMedia("(hover:hover) and (pointer:fine)").matches;
    if (!fine) return;
    var raf = 0, tx = 0, ty = 0;
    function apply_() {
      raf = 0;
      scene.style.perspectiveOrigin = (50 + tx * 8) + "% " + (40 + ty * 6) + "%";
    }
    D.addEventListener("pointermove", function (e) {
      tx = (e.clientX / W.innerWidth - .5) * 2;
      ty = (e.clientY / W.innerHeight - .5) * 2;
      if (!raf) raf = requestAnimationFrame(apply_);
    }, { passive: true });
  }

  /* --------------------------------------------- تیلت کارت‌ها */
  function tilt() {
    if (UX.d3d === "off") return;
    var max = UX.d3d === "max" ? 9 : 4;
    var fine = W.matchMedia && W.matchMedia("(hover:hover) and (pointer:fine)").matches;
    if (!fine) return;

    $$(".subject-card, .card, .tool-card, .hero-card, .kpi, .rp-card, .hk-quizbox").forEach(function (c) {
      if (c.dataset.h3tilt) return;
      c.dataset.h3tilt = "1";
      if (UX.shine) c.classList.add("h3-shine");
      c.classList.add("h3-tilt");
      var raf = 0, rx = 0, ry = 0;
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        ry = px * max; rx = -py * max;
        c.style.setProperty("--mx", ((px + .5) * 100) + "%");
        c.style.setProperty("--my", ((py + .5) * 100) + "%");
        if (!raf) raf = requestAnimationFrame(function () {
          raf = 0;
          c.style.transform = "perspective(950px) rotateX(" + rx.toFixed(2) + "deg) rotateY(" + ry.toFixed(2) + "deg) translateY(-4px) scale(1.008)";
        });
      });
      c.addEventListener("pointerleave", function () {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        c.style.transform = "";
      });
    });

    // عمق‌دادن به محتوای کارت‌های درس
    $$(".subject-card h3").forEach(function (e) { e.classList.add("h3-pop-1"); });
    $$(".subject-card .s-desc").forEach(function (e) { e.classList.add("h3-pop-2"); });
    var deck = $(".subject-grid");
    if (deck) deck.classList.add("h3-deck");
  }

  /* ------------------------------------------- پالت فرمان (Ctrl+K) */
  var cmdItems = null;
  function cmdData() {
    if (cmdItems) return Promise.resolve(cmdItems);
    var base = [
      { k: "home", t: "صفحهٔ اصلی", d: "خانهٔ سایت", u: U("index.html"), g: "ب" },
      { k: "jozve", t: "فهرست جزوه‌های کامل", d: "۳۶ جزوهٔ چاپ‌پذیر", u: U("jozve.html"), g: "ج" },
      { k: "consult", t: "مشاورهٔ آنلاین", d: "پرسش و پاسخ درسی", u: U("consult.html"), g: "م" },
      { k: "report", t: "کارنامهٔ تحلیلی", d: "پیشرفت درس‌به‌درس", u: U("report.html"), g: "ک" },
      { k: "exam", t: "آزمون جامع", d: "آزمون تصادفی با زمان‌سنج", u: U("exam.html"), g: "آ" },
      { k: "cards", t: "فلش‌کارت", d: "مرور سریع نکات", u: U("flashcards.html"), g: "ف" },
      { k: "dash", t: "داشبورد", d: "نمای کلی پیشرفت", u: U("dashboard.html"), g: "د" },
      { k: "g7", t: "پایهٔ هفتم", d: "همهٔ درس‌های هفتم", u: U("g7/index.html"), g: "۷" },
      { k: "g8", t: "پایهٔ هشتم", d: "همهٔ درس‌های هشتم", u: U("index.html"), g: "۸" },
      { k: "g9", t: "پایهٔ نهم", d: "همهٔ درس‌های نهم", u: U("g9/index.html"), g: "۹" },
      { k: "status", t: "وضعیت سرور", d: "سلامت و آمار سرور", u: "/__status", g: "و" }
    ];
    var acts = (W.HK && W.HK.Agent) ? W.HK.Agent.list().map(function (a) {
      return { k: "act:" + a.id, t: a.label, d: a.desc, act: a.id, g: "◆" };
    }) : [];

    return J("assets/search-index.json")
      .then(function (rows) {
        var seen = {};
        var lessons = [];
        rows.forEach(function (r) {
          if (lessons.length > 260) return;
          var key = r.bn + "|" + r.t;
          if (seen[key]) return;
          seen[key] = 1;
          lessons.push({ k: "L:" + r.url, t: r.t, d: r.bn + " — پایهٔ " + ({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[r.g] || ""), u: U(r.url), g: "د" });
        });
        cmdItems = acts.concat(base, lessons);
        return cmdItems;
      })
      .catch(function () { cmdItems = acts.concat(base); return cmdItems; });
  }

  function norm(s) {
    return String(s || "").replace(/[\u200c\u200e\u200f]/g, " ").replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[؟?!.,،:;«»"'()\[\]\-_–—]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function buildCmd() {
    if ($(".hk-cmd")) return;
    var o = D.createElement("div");
    o.className = "hk-cmd";
    o.innerHTML =
      '<div class="hk-cmd-box" role="dialog" aria-label="پالت فرمان">' +
        '<input class="hk-cmd-in" data-hk-cmd-in placeholder="چه کاری؟ چی می‌خواهی؟ (نام درس، کار، یا صفحه)" autocomplete="off">' +
        '<div class="hk-cmd-hint"><span><kbd>↑</kbd><kbd>↓</kbd> جابه‌جایی</span><span><kbd>Enter</kbd> اجرا</span><span><kbd>Esc</kbd> بستن</span><span>۳۱ کار + همهٔ درس‌ها</span></div>' +
        '<div class="hk-cmd-list" data-hk-cmd-list></div>' +
      "</div>";
    D.body.appendChild(o);

    var input = $("[data-hk-cmd-in]", o), list = $("[data-hk-cmd-list]", o);
    if (!input || !list) return;              // اگر ساخت پالت ناتمام بماند، بقیهٔ صفحه سالم می‌ماند
    var current = [], cursor = 0;

    function render(q) {
      cmdData().then(function (all) {
        var nq = norm(q);
        var hits = nq
          ? all.map(function (it) {
              var t = norm(it.t), d = norm(it.d);
              var sc = 0;
              if (t.indexOf(nq) === 0) sc = 100;
              else if (t.indexOf(nq) > -1) sc = 60;
              else if (d.indexOf(nq) > -1) sc = 25;
              else {
                var words = nq.split(" ").filter(Boolean), m = 0;
                words.forEach(function (w) { if (t.indexOf(w) > -1 || d.indexOf(w) > -1) m++; });
                if (m) sc = m * 8;
              }
              return sc ? { it: it, sc: sc } : null;
            }).filter(Boolean).sort(function (a, b) { return b.sc - a.sc; }).slice(0, 40).map(function (x) { return x.it; })
          : all.slice(0, 30);

        current = hits;
        cursor = 0;
        list.innerHTML = hits.length
          ? hits.map(function (it, i) {
              return '<div class="hk-cmd-item' + (i === 0 ? " on" : "") + '" data-i="' + i + '">' +
                '<span class="ic">' + esc(it.g || "◆") + "</span>" +
                '<span class="tx"><b>' + esc(it.t) + "</b><small>" + esc(it.d || "") + "</small></span>" +
                '<span class="kind">' + (it.act ? "کار" : "صفحه") + "</span></div>";
            }).join("")
          : '<div class="hk-cmd-empty">چیزی پیدا نشد. با واژهٔ دیگری امتحان کن.</div>';
      });
    }

    function move(d) {
      var items = $$(".hk-cmd-item", list);
      if (!items.length) return;
      items[cursor] && items[cursor].classList.remove("on");
      cursor = (cursor + d + items.length) % items.length;
      items[cursor].classList.add("on");
      items[cursor].scrollIntoView({ block: "nearest" });
    }

    function run_(i) {
      var it = current[i];
      if (!it) return;
      close();
      if (it.act) {
        if (W.HK && W.HK.Agent) {
          W.HK.Agent.execute([{ type: it.act, args: {} }]).then(function (res) {
            var r = res[0] || {};
            toast((r.ok ? "✅ " : "⚠️ ") + (r.text || r.label || "انجام شد").slice(0, 120), 3200);
            if (W.HK.refreshAll) W.HK.refreshAll();
          });
        }
        return;
      }
      location.href = it.u;
    }

    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
      if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      if (e.key === "Enter") { e.preventDefault(); run_(cursor); }
    });
    list.addEventListener("click", function (e) {
      var it = e.target.closest("[data-i]");
      if (it) run_(+it.getAttribute("data-i"));
    });
    o.addEventListener("click", function (e) { if (e.target === o) close(); });

    render("");
  }

  function openCmd() {
    buildCmd();
    var o = $(".hk-cmd");
    if (!o) return;
    o.classList.add("open");
    var i = $("[data-hk-cmd-in]", o);
    if (i) { i.value = ""; i.focus(); i.select(); }
  }
  function close() {
    var o = $(".hk-cmd"); if (o) o.classList.remove("open");
    var h = $(".hk-help"); if (h) h.classList.remove("open");
  }

  /* ------------------------------------------ راهنمای میان‌برها */
  var SHORTCUTS = [
    ["Ctrl + K", "پالت فرمان (هر کار یا هر صفحه)"],
    ["Alt + I", "پنل مشاور"],
    ["Ctrl + F", "جست‌وجو در همین جزوه"],
    ["j / k", "درس بعد / درس قبل"],
    ["Ctrl + P", "چاپ یا ذخیرهٔ PDF"],
    ["Alt + T", "شروع و توقف زمان‌سنج مطالعه"],
    ["Alt + H", "همین راهنما"],
    ["Alt + 1 … 4", "اندازهٔ متن (کوچک تا بزرگ)"],
    ["Alt + D", "حالت شب / روز"],
    ["Alt + S", "حالت سپیا (کاغذی)"],
    ["Alt + F", "حالت تمرکز"],
    ["Esc", "بستن پنجره‌ها"]
  ];
  function buildHelp() {
    if ($(".hk-help")) return;
    var o = D.createElement("div");
    o.className = "hk-help";
    o.innerHTML = '<div class="hk-help-box"><h3>میان‌برهای صفحه‌کلید</h3>' +
      SHORTCUTS.map(function (s) { return '<div class="hk-help-row"><span>' + esc(s[1]) + "</span><kbd>" + esc(s[0]) + "</kbd></div>"; }).join("") +
      '<p style="font-size:.79rem;color:var(--muted);margin-top:14px">همهٔ این‌ها در گوشی هم با پنل مشاور و دکمه‌ها در دسترس‌اند.</p>' +
      '<button class="btn btn-primary btn-sm" data-hk-help-close>بستن</button></div>';
    D.body.appendChild(o);
    o.addEventListener("click", function (e) { if (e.target === o || e.target.closest("[data-hk-help-close]")) o.classList.remove("open"); });
  }
  function openHelp() {
    buildHelp();
    var h = $(".hk-help");
    if (h) h.classList.add("open");
  }

  /* ------------------------------------- زمان‌سنج مطالعه (پومودورو) */
  var T = LS.get("g8:timer", null) || { phase: "work", left: 25 * 60, running: false, sessions: 0, stamp: 0 };
  var WORK = 25 * 60, REST = 5 * 60;

  function buildTimer() {
    if (!UX.timer || $(".hk-timer")) return;
    var o = D.createElement("div");
    o.className = "hk-timer";
    o.innerHTML =
      '<span class="ring"><i></i></span>' +
      '<span class="t" data-hk-t-time>۲۵:۰۰</span>' +
      '<button data-hk-t-run title="شروع / توقف">▶</button>' +
      '<button data-hk-t-reset title="شروع دوباره">↺</button>' +
      '<button data-hk-t-close title="پنهان کن">✕</button>';
    D.body.appendChild(o);
    o.addEventListener("click", function (e) {
      if (e.target.closest("[data-hk-t-run]")) return toggleTimer();
      if (e.target.closest("[data-hk-t-reset]")) { T = { phase: T.phase, left: T.phase === "work" ? WORK : REST, running: false, sessions: T.sessions, stamp: 0 }; saveTimer(); drawTimer(); return; }
      if (e.target.closest("[data-hk-t-close]")) { UX.timer = false; LS.set(KEY, UX); o.remove(); return; }
    });
    drawTimer();
  }

  function saveTimer() { T.stamp = Date.now(); LS.set("g8:timer", T); }

  function toggleTimer() {
    T.running = !T.running;
    saveTimer();
    drawTimer();
    if (T.running) toast(T.phase === "work" ? "شروع مطالعه — ۲۵ دقیقه" : "وقت استراحت — ۵ دقیقه");
  }

  function tick() {
    if (!T.running) return;
    var now = Date.now();
    var elapsed = Math.floor((now - (T.stamp || now)) / 1000);
    if (elapsed > 0) {
      T.left = Math.max(0, T.left - elapsed);
      saveTimer();
      drawTimer();
    }
    if (T.left <= 0) {
      beep();
      if (T.phase === "work") {
        T.sessions = (T.sessions || 0) + 1;
        var log = LS.get("g8:studyLog", []) || [];
        log.unshift({ at: Date.now(), minutes: 25, page: location.pathname });
        LS.set("g8:studyLog", log.slice(0, 400));
        T.phase = "rest"; T.left = REST;
        toast("آفرین! ۲۵ دقیقه مطالعه ثبت شد — وقت استراحت", 4200);
      } else {
        T.phase = "work"; T.left = WORK;
        toast("استراحت تمام شد — دوباره شروع کنیم", 4200);
      }
      saveTimer();
      drawTimer();
    }
  }

  function drawTimer() {
    var o = $(".hk-timer"); if (!o) return;
    var m = Math.floor(T.left / 60), s = T.left % 60;
    var tEl = $("[data-hk-t-time]", o);
    if (tEl) tEl.textContent = fa(m) + ":" + fa(s < 10 ? "0" + s : s);
    o.classList.toggle("running", !!T.running);
    var total = T.phase === "work" ? WORK : REST;
    var pct = Math.round((1 - T.left / total) * 100);
    var ring = $(".ring", o);
    if (ring && ring.style && ring.style.setProperty) ring.style.setProperty("--tp", pct);
    var run = $("[data-hk-t-run]", o);
    if (run) run.textContent = T.running ? "⏸" : "▶";
  }

  function beep() {
    try {
      var AC = W.AudioContext || W.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 880;
      g.gain.setValueAtTime(0.001, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.9);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.95);
      setTimeout(function () { try { ctx.close(); } catch (e) {} }, 1400);
    } catch (e) {}
  }

  function studyStats() {
    var log = LS.get("g8:studyLog", []) || [];
    var today = new Date().toDateString();
    var minToday = log.filter(function (x) { return new Date(x.at).toDateString() === today; })
      .reduce(function (a, x) { return a + (x.minutes || 0); }, 0);
    var minAll = log.reduce(function (a, x) { return a + (x.minutes || 0); }, 0);
    return { sessions: log.length, minToday: minToday, minAll: minAll, phase: T.phase, left: T.left };
  }

  /* ------------------------------------ کنترل‌های ظاهر در پنل مشاور */
  function injectSettings() {
    var pane = $('[data-hk-pane="set"]');
    if (!pane || $("[data-h3-block]", pane)) return;

    var block = D.createElement("div");
    block.setAttribute("data-h3-block", "1");
    block.innerHTML =
      '<h4 style="margin:16px 0 8px;font-size:.92rem">رنگ سایت</h4>' +
      '<div class="hk-swatches">' +
        THEMES.map(function (t) {
          return '<button class="hk-sw' + (UX.theme === t[0] ? " on" : "") + '" data-h3="theme" data-v="' + t[0] + '" title="' + THEME_NAMES[t[0]] + '" style="background:linear-gradient(140deg,' + t[1] + ',color-mix(in srgb,' + t[1] + ' 55%,#000))"></button>';
        }).join("") +
      "</div>" +

      '<div class="hk-field"><label>شدت سه‌بعدی</label>' +
        '<div class="hk-seg"><button data-h3="d3d" data-v="off">خاموش</button><button data-h3="d3d" data-v="soft">ملایم</button><button data-h3="d3d" data-v="max">کامل</button></div>' +
      "</div>" +

      '<div class="hk-field"><label>گردی گوشه‌ها</label>' +
        '<div class="hk-seg"><button data-h3="radius" data-v="auto">پیش‌فرض</button><button data-h3="radius" data-v="sharp">تیز</button><button data-h3="radius" data-v="soft">ملایم</button><button data-h3="radius" data-v="round">گرد</button></div>' +
      "</div>" +

      '<div class="hk-field"><label>تراکم صفحه</label>' +
        '<div class="hk-seg"><button data-h3="density" data-v="compact">فشرده</button><button data-h3="density" data-v="normal">معمولی</button><button data-h3="density" data-v="airy">باز</button></div>' +
      "</div>" +

      '<div class="hk-field"><label>پس‌زمینه</label>' +
        '<div class="hk-seg"><button data-h3="bg" data-v="mesh">نقطه‌ای</button><button data-h3="bg" data-v="grid">شبکه‌ای</button><button data-h3="bg" data-v="dots">رنگی</button><button data-h3="bg" data-v="aurora">شفق</button><button data-h3="bg" data-v="plain">ساده</button></div>' +
      "</div>" +

      '<div class="hk-field"><label>رنگ دلخواه (کد رنگ)</label>' +
        '<input class="hk-range" data-h3="accent" type="color" value="' + (UX.accent || "#6d5efc") + '">' +
      "</div>" +

      '<div class="hk-field"><label>درخشش روی کارت‌ها</label>' +
        '<div class="hk-seg"><button data-h3="shine" data-v="on">روشن</button><button data-h3="shine" data-v="off">خاموش</button></div>' +
      "</div>" +

      '<div class="hk-field"><label>زمان‌سنج مطالعه</label>' +
        '<div class="hk-seg"><button data-h3="timer" data-v="on">نمایش</button><button data-h3="timer" data-v="off">پنهان</button></div>' +
      "</div>" +

      '<div data-h3-study style="margin-top:14px"></div>' +
      '<div class="hk-quick" style="margin-top:12px">' +
        '<button class="hk-q" data-h3="help">میان‌برها</button>' +
        '<button class="hk-q" data-h3="palette">پالت فرمان</button>' +
        '<button class="hk-q" data-h3="reset">بازگشت به پیش‌فرض ظاهر</button>' +
      "</div>";

    pane.appendChild(block);

    block.addEventListener("click", function (e) {
      var b = e.target.closest("[data-h3]");
      if (!b) return;
      var k = b.getAttribute("data-h3"), v = b.getAttribute("data-v");
      if (k === "accent") return;                 // با رویداد input مدیریت می‌شود
      if (k === "help") return openHelp();
      if (k === "palette") { close(); return openCmd(); }
      if (k === "reset") {
        UX = Object.assign({}, DEFAULTS);
        apply(); toast("ظاهر به حالت پیش‌فرض برگشت");
        return;
      }
      if (k === "theme") UX.theme = v;
      else if (k === "d3d") UX.d3d = v;
      else if (k === "radius") UX.radius = v;
      else if (k === "density") UX.density = v;
      else if (k === "bg") UX.bg = v;
      else if (k === "shine") UX.shine = (v === "on");
      else if (k === "timer") UX.timer = (v === "on");
      apply();
      syncControls();
      if (k === "d3d" && v === "off") {
        $$(".h3-tilt").forEach(function (c) { c.style.transform = ""; });
      }
      if (k === "timer") { var t = $(".hk-timer"); if (t) t.remove(); buildTimer(); }
      if (k === "d3d" || k === "shine") { $$(".h3-tilt").forEach(function (c) { c.dataset.h3tilt = ""; }); tilt(); }
      toast("تنظیم شد");
    });

    block.addEventListener("input", function (e) {
      var i = e.target.closest("[data-h3='accent']");
      if (!i) return;
      UX.accent = i.value;
      apply();
    });

    syncControls();
    drawStudy(block);
  }

  function syncControls() {
    $$("[data-h3]").forEach(function (b) {
      var k = b.getAttribute("data-h3"), v = b.getAttribute("data-v");
      if (!v) return;
      var on = (k === "shine") ? (UX.shine ? "on" : "off")
        : (k === "timer") ? (UX.timer ? "on" : "off")
        : UX[k];
      b.classList.toggle("on", on === v);
    });
    $$("[data-h3='theme']").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-v") === UX.theme);
    });
  }

  function drawStudy(scope) {
    var host = scope ? $("[data-h3-study]", scope) : null;
    if (!host) return;
    var s = studyStats();
    host.innerHTML = '<div class="hk-status"><span>مطالعهٔ امروز: <b>' + fa(s.minToday) + "</b> دقیقه</span>" +
      "<span>جلسه‌ها: <b>" + fa(s.sessions) + "</b></span>" +
      "<span>جمع کل: <b>" + fa(s.minAll) + "</b> دقیقه</span></div>";
  }

  /* ------------------------------------------------- میان‌برهای کلیدی */
  function keys() {
    D.addEventListener("keydown", function (e) {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); return openCmd(); }
      if (e.key === "Escape") return close();
      if (!e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === "i") return; // پنل مشاور خودش مدیریت می‌کند
      if (k === "h") { e.preventDefault(); return openHelp(); }
      if (k === "t") { e.preventDefault(); if (!UX.timer) { UX.timer = true; apply(); buildTimer(); } return toggleTimer(); }
      if (k === "d") { e.preventDefault(); var dark = D.documentElement.getAttribute("data-theme") === "dark"; D.documentElement.setAttribute("data-theme", dark ? "light" : "dark"); return toast(dark ? "حالت روز" : "حالت شب"); }
      if (k === "s") { e.preventDefault(); D.body.classList.toggle("hk-sepia"); return toast("حالت سپیا"); }
      if (k === "f") { e.preventDefault(); D.body.classList.toggle("hk-focus"); return toast("حالت تمرکز"); }
      if (["1", "2", "3", "4"].indexOf(k) > -1) {
        e.preventDefault();
        var n = +k;
        for (var i = 1; i <= 4; i++) D.body.classList.remove("hk-font-" + i);
        D.body.classList.add("hk-font-" + n);
        LS.set("g8:ui:font", n);
        return toast("اندازهٔ متن: " + fa(n));
      }
    });
  }

  /* ------------------------------------------------------ راه‌اندازی */
  function boot() {
    apply();
    buildScene();
    tilt();
    buildTimer();
    keys();
    buildCmd();
    injectSettings();

    setInterval(tick, 1000);

    // تنظیمات پنل مشاور ممکن است کمی بعد ساخته شود؛ با تأخیر و فقط چند بار بررسی می‌کنیم
    var tries = 0, moTimer = 0;
    var mo = new MutationObserver(function () {
      if (moTimer) return;
      moTimer = setTimeout(function () {
        moTimer = 0;
        injectSettings();
        drawStudy();
        if (++tries > 8 || $("[data-h3-block]")) mo.disconnect();
      }, 350);
    });
    mo.observe(D.body, { childList: true, subtree: true });

    W.HK3D = {
      ux: UX,
      apply: apply,
      openPalette: openCmd,
      openHelp: openHelp,
      themes: THEMES,
      studyStats: studyStats,
      timer: function () { return T; },
      toggleTimer: toggleTimer
    };
    W.HK = W.HK || {};
    W.HK.UX = W.HK3D;
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
