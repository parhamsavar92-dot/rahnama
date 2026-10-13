/* ==========================================================================
   پایهٔ هشتم — لایهٔ ارتقا  |  enhance.js
   منوی مگا • پالت فرمان • نوار ابزار مطالعه • یادداشت • پومودورو • بلندخوانی
   • حالت تمرکز • آفلاین (PWA) • حافظهٔ محل مطالعه
   ========================================================================== */
(function () {
  "use strict";

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  var BOOKS = [
    { k: "math", n: "ریاضی", f: "pages/math.html", c: "#6d5efc", n2: "۳۴ درس" },
    { k: "science", n: "علوم تجربی", f: "pages/science.html", c: "#0ea5a5", n2: "۱۵ فصل" },
    { k: "farsi", n: "فارسی", f: "pages/farsi.html", c: "#e0533f", n2: "۱۹ درس" },
    { k: "negaresh", n: "نگارش و انشا", f: "pages/negaresh.html", c: "#f97316", n2: "۸ درس" },
    { k: "arabic", n: "عربی", f: "pages/arabic.html", c: "#b8860b", n2: "۱۰ درس" },
    { k: "english", n: "زبان انگلیسی", f: "pages/english.html", c: "#2563eb", n2: "۷ درس" },
    { k: "social", n: "مطالعات اجتماعی", f: "pages/social.html", c: "#d97706", n2: "۲۴ درس" },
    { k: "religion", n: "پیام‌های آسمان", f: "pages/religion.html", c: "#14b8a6", n2: "۱۵ درس" },
    { k: "quran", n: "آموزش قرآن", f: "pages/quran.html", c: "#059669", n2: "۱۲ درس" },
    { k: "tech", n: "کار و فناوری", f: "pages/tech.html", c: "#64748b", n2: "۹ پودمان" },
    { k: "art", n: "فرهنگ و هنر", f: "pages/art.html", c: "#db2777", n2: "۱۵ درس" },
    { k: "thinking", n: "تفکر و سبک زندگی", f: "pages/thinking.html", c: "#7c3aed", n2: "۷ بخش" }
  ];
  var EXTRAS = [
    { n: "زنگ تفریح", f: "community.html", i: "🎉" },
    { n: "مرکز ابزارها", f: "study-tools.html", i: "🧰" },
    { n: "ابزار PDF", f: "pdf-tools.html", i: "🗂" },
    { n: "دستیار هوشمند", f: "ai.html", i: "✦" },
    { n: "داشبورد مطالعه", f: "dashboard.html", i: "◧" },
    { n: "آزمون جامع", f: "exam.html", i: "✓" },
    { n: "فلش‌کارت هوشمند", f: "flashcards.html", i: "⇄" },
    { n: "درباره ما", f: "about.html", i: "◉" }
  ];

  var BASE = document.body.getAttribute("data-base") || "";
  var GRD = document.body.getAttribute("data-grade") || "8";
  var GP = GRD === "8" ? "" : "g" + GRD + "/";
  var DATA_FILE = GRD === "8" ? "assets/study-data.json" : "assets/study-data-g" + GRD + ".json";
  /* ریشهٔ سایت از روی مسیر همین اسکریپت حساب می‌شود تا لینک‌ها و فایل‌های
     داده هم روی دامنه، هم در زیرپوشه، و هم وقتی فایل را مستقیم (file://)
     باز می‌کنید درست کار کنند. خروجی یک نشانی کامل است که هم برای fetch
     و هم برای href/src معتبر است. */
  var SELF_SRC = (document.currentScript && document.currentScript.src) ||
    (function () { var t = document.querySelector('script[src*="enhance.js"]'); return t ? t.src : ""; })();
  var ROOT = SELF_SRC ? SELF_SRC.replace(/assets\/enhance\.js.*$/, "") : location.href.replace(/[^\/]*$/, "");
  function url(p) {
    var s = String(p == null ? "" : p).replace(/^\/+/, "");
    try { return new URL(s, ROOT).href; } catch (e) { return s; }
  }

  /* بارگذاری دادهٔ JSON: روی وب با fetch، و اگر فایل را مستقیم از دیسک باز
     کنید (file://) — که مرورگرها fetch را در آن می‌بندند — از نسخهٔ .js
     کنارِ همان داده با تزریق <script> خوانده می‌شود. این‌طور آزمون، فلش‌کارت،
     داشبورد و جست‌وجو هنگام باز کردن فایل‌ها هم کار می‌کنند. */
  function jsonLoad(p) {
    var abs = url(p);
    var viaScript = (location.protocol === "file:") || /\.js$/.test(p);
    if (!viaScript) return fetch(abs).then(function (r) { return r.json(); });
    return new Promise(function (resolve, reject) {
      var box = window.G8JSON = window.G8JSON || {};
      if (box[p]) { resolve(box[p]); return; }
      var s = document.createElement("script");
      s.src = /\.js$/.test(p) ? abs : abs + ".js";
      s.onload = function () { box[p] ? resolve(box[p]) : reject(new Error("داده بارگذاری نشد")); };
      s.onerror = function () { reject(new Error("داده بارگذاری نشد")); };
      document.head.appendChild(s);
    });
  }

  /* ---------- اعلان ---------- */
  var toastEl = null;
  function toast(msg, actionLabel, action) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = msg;
    if (actionLabel && action) {
      var b = document.createElement("button");
      b.textContent = actionLabel;
      b.className = "btn btn-sm";
      b.style.cssText = "margin-inline-start:12px;background:#fff;color:#111";
      b.onclick = function () { action(); toastEl.classList.remove("show"); };
      toastEl.appendChild(b);
    }
    toastEl.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove("show"); }, actionLabel ? 9000 : 2600);
  }

  function svg(p, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ' + (extra || "") + ">" + p + "</svg>";
  }

  var ICON = {
    ink: '<path d="M12.5 11 20 3.5l.5.5-7.5 7.5z"/><path d="M3 21h8"/><path d="M9 14.5 4.5 19l4.5-1z"/>',
    dash: '<rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="11.5" width="7.5" height="9.5" rx="2"/><rect x="3" y="15" width="7.5" height="6" rx="2"/>',
    exam: '<path d="M9 11.5 11.2 14 15.5 9"/><rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 3.5v-2M16 3.5v-2"/>',
    spark: '<path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
    cards: '<rect x="3" y="7" width="13" height="12" rx="2.5"/><path d="M7.5 3.5h9A3.5 3.5 0 0 1 20 7v9"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9.5V13l2.5 1.6M9 2.5h6"/>',
    note: '<path d="M5 3.5h9.5L19 8v12.5H5z"/><path d="M14 3.5V8h5M8.5 12h7M8.5 16h5"/>',
    speak: '<path d="M11 5 6.5 9H3v6h3.5L11 19z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12"/>',
    focus: '<path d="M3 8V5.5A2.5 2.5 0 0 1 5.5 3H8M16 3h2.5A2.5 2.5 0 0 1 21 5.5V8M21 16v2.5A2.5 2.5 0 0 1 18.5 21H16M8 21H5.5A2.5 2.5 0 0 1 3 18.5V16"/>',
    offline: '<path d="M12 3v12M7.5 10.5 12 15l4.5-4.5"/><path d="M4 17.5v1A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-1"/>',
    print: '<path d="M7 9V4h10v5"/><rect x="4" y="9" width="16" height="7" rx="2"/><path d="M7 14h10v6H7z"/>',
    expand: '<path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5V8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M4 16v2.5A1.5 1.5 0 0 0 5.5 20H8"/><path d="M12 8v8M8 12h8"/>',
    up: '<path d="m5 14 7-7 7 7"/>'
  };

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }

  /* ---------- ۱. منوی مگا ---------- */
  function buildMega() {
    var nav = document.querySelector(".header-nav");
    if (!nav || nav.dataset.enh) return;
    nav.dataset.enh = "1";

    var themeBtn = nav.querySelector("[data-theme-toggle]");
    nav.innerHTML = "";

    // گروه‌بندی کتاب‌ها
    var groups = [
      { t: "ریاضی و علوم", ks: ["math", "science", "tech"] },
      { t: "زبان و ادبیات", ks: ["farsi", "negaresh", "arabic", "english"] },
      { t: "علوم اجتماعی و دینی", ks: ["social", "religion", "quran"] },
      { t: "هنر و مهارت زندگی", ks: ["art", "thinking"] }
    ];

    var home = document.createElement("a");
    home.href = url("index.html"); home.textContent = "خانه";
    nav.appendChild(home);

    var wrap = document.createElement("div");
    wrap.className = "mega-wrap";
    var btn = document.createElement("button");
    btn.className = "mega-btn";
    btn.innerHTML = "کتاب‌های هشتم <span class=\"chev\">▾</span>";
    wrap.appendChild(btn);

    var panel = document.createElement("div");
    panel.className = "mega-panel";
    var grid = '<div class="mega-grid">';
    groups.forEach(function (g) {
      grid += '<div class="mega-col"><h5>' + esc(g.t) + "</h5>";
      g.ks.forEach(function (k) {
        var b = BOOKS.filter(function (x) { return x.k === k; })[0];
        if (!b) return;
        grid += '<a class="mega-item" href="' + url(GP + b.f) + '" style="--mc:' + b.c + '">' +
          '<span class="mi">' + esc(b.n.charAt(0)) + "</span>" +
          "<span>" + esc(b.n) + "<small>" + esc(b.n2) + "</small></span></a>";
      });
      grid += "</div>";
    });
    grid += "</div>";
    grid += '<div class="mega-foot">' +
      EXTRAS.map(function (e) { return '<a class="btn btn-ghost" href="' + url(e.f) + '">' + e.i + " " + esc(e.n) + "</a>"; }).join("") +
      '<button class="btn btn-ghost" data-open-cmdk>' + svg(ICON.search, 'width="16" height="16"') + " جست‌وجوی سریع</button>" +
      "</div>";
    panel.innerHTML = grid;
    wrap.appendChild(panel);
    nav.appendChild(wrap);

    [["دستیار هوشمند", "ai.html"], ["داشبورد", "dashboard.html"], ["آزمون جامع", "exam.html"],
     ["فلش‌کارت", "flashcards.html"], ["درباره ما", "about.html"]].forEach(function (p) {
      var a = document.createElement("a");
      a.href = url(p[1]) + (GRD === "8" ? "" : "?g=" + GRD); a.textContent = p[0];
      if (document.body.getAttribute("data-page") === p[1].replace(".html", "")) a.className = "is-active";
      nav.appendChild(a);
    });


    if (themeBtn) nav.appendChild(themeBtn);

    btn.addEventListener("click", function (e) { e.stopPropagation(); wrap.classList.toggle("open"); });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".mega-wrap")) wrap.classList.remove("open");
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") wrap.classList.remove("open"); });
  }

  /* ---------- ۲. پالت فرمان ---------- */
  var DATA = null, cmdk = null;
  function loadData(cb) {
    if (DATA) return cb(DATA);
    jsonLoad(DATA_FILE).then(function (d) {
      DATA = d; cb(d);
    }).catch(function () { cb({ books: BOOKS.map(function (b) { return { key: b.k, name: b.n, file: b.f, color: b.c, lessons: 0 }; }), lessons: [] }); });
  }

  function buildCmdk() {
    if (cmdk) return cmdk;
    cmdk = document.createElement("div");
    cmdk.className = "cmdk-overlay";
    cmdk.innerHTML =
      '<div class="cmdk" role="dialog" aria-label="جست‌وجوی سریع">' +
      '<div class="cmdk-head">' + svg(ICON.search) +
      '<input type="search" placeholder="نام درس، واژه یا موضوع را بنویسید…" aria-label="جست‌وجو">' +
      "<kbd>Esc</kbd></div>" +
      '<div class="cmdk-list"></div>' +
      '<div class="cmdk-foot"><span>↑ ↓ جابه‌جایی</span><span>Enter ورود</span><span>Ctrl/⌘ + K</span></div></div>';
    document.body.appendChild(cmdk);
    cmdk.addEventListener("click", function (e) { if (e.target === cmdk) close(); });
    var input = cmdk.querySelector("input");
    input.addEventListener("input", function () { render(input.value); });
    input.addEventListener("keydown", function (e) {
      var items = [].slice.call(cmdk.querySelectorAll(".cmdk-item"));
      var i = items.findIndex(function (x) { return x.classList.contains("sel"); });
      if (e.key === "ArrowDown") { e.preventDefault(); if (i + 1 < items.length) { items[i] && items[i].classList.remove("sel"); items[i + 1].classList.add("sel"); items[i + 1].scrollIntoView({ block: "nearest" }); } }
      if (e.key === "ArrowUp") { e.preventDefault(); if (i > 0) { items[i].classList.remove("sel"); items[i - 1].classList.add("sel"); items[i - 1].scrollIntoView({ block: "nearest" }); } }
      if (e.key === "Enter") { var s = cmdk.querySelector(".cmdk-item.sel") || items[0]; if (s) location.href = s.dataset.href; }
    });
    return cmdk;
  }

  function render(q) {
    var list = cmdk.querySelector(".cmdk-list");
    q = (q || "").trim();
    loadData(function (d) {
      var out = "", n = 0;
      if (!q) {
        out += '<div class="cmdk-sec">ابزارهای مطالعه</div>';
        EXTRAS.forEach(function (e) {
          out += '<a class="cmdk-item" data-href="' + url(e.f) + '" href="' + url(e.f) + '"><span class="ci" style="--mc:#6d5efc">' + e.i + "</span><span class=\"ct\"><b>" + esc(e.n) + "</b></span></a>";
        });
        out += '<div class="cmdk-sec">کتاب‌ها</div>';
        (d.books || []).forEach(function (b) {
          out += '<a class="cmdk-item" data-href="' + url(b.file) + '" href="' + url(b.file) + '"><span class="ci" style="--mc:' + b.color + '">' + esc(b.name.charAt(0)) + '</span><span class="ct"><b>' + esc(b.name) + "</b><span>" + b.lessons + " درس</span></span></a>";
        });
      } else {
        var needle = q.toLowerCase();
        (d.lessons || []).forEach(function (l) {
          if (n >= 40) return;
          var hay = (l.t + " " + l.s + " " + (l.pts || []).join(" ") + " " + (l.terms || []).map(function (t) { return t.join(" "); }).join(" ")).toLowerCase();
          if (hay.indexOf(needle) === -1) return;
          var bk = (d.books || []).filter(function (x) { return x.key === l.b; })[0] || { name: l.b, color: "#6d5efc" };
          n++;
          out += '<a class="cmdk-item" data-href="' + url(bk.file) + "#" + l.id + '" href="' + url(bk.file) + "#" + l.id + '">' +
            '<span class="ci" style="--mc:' + bk.color + '">' + esc(bk.name.charAt(0)) + '</span>' +
            '<span class="ct"><b>' + esc(l.t) + "</b><span>" + esc(bk.name) + " • " + esc(l.badge || "") + "</span></span></a>";
        });
        if (!n) out = '<div class="cmdk-empty">چیزی پیدا نشد. واژهٔ دیگری را امتحان کنید.</div>';
      }
      list.innerHTML = out;
      var first = list.querySelector(".cmdk-item");
      if (first) first.classList.add("sel");
    });
  }

  function open() { buildCmdk(); cmdk.classList.add("open"); var i = cmdk.querySelector("input"); i.value = ""; render(""); setTimeout(function () { i.focus(); }, 30); }
  function close() { if (cmdk) cmdk.classList.remove("open"); }

  /* ---------- ۳. نوار ابزار شناور ---------- */
  function buildToolbar() {
    if (!document.querySelector(".lesson[id]")) return;
    var bar = document.createElement("div");
    bar.className = "toolbar";
    bar.innerHTML =
      '<button class="tb" data-tb="ai">' + svg(ICON.spark) + '<span class="tip">پرسش از دستیار هوشمند</span></button>' +
      '<button class="tb" data-tb="ink">' + svg(ICON.ink) + '<span class="tip">یادداشت‌گذاری روی جزوه (هایلایت و مداد)</span></button>' +
      '<button class="tb" data-tb="pomodoro" title=""><span class="pomo-ring"></span>' + svg(ICON.timer) + '<span class="tb-time"></span><span class="tip">تایمر مطالعه (۲۵ دقیقه)</span></button>' +
      '<button class="tb" data-tb="note">' + svg(ICON.note) + '<span class="tip">یادداشت این صفحه</span></button>' +
      '<button class="tb" data-tb="speak">' + svg(ICON.speak) + '<span class="tip">بلندخوانی درس</span></button>' +
      '<button class="tb" data-tb="focus">' + svg(ICON.focus) + '<span class="tip">حالت تمرکز</span></button>' +
      '<button class="tb" data-tb="expand">' + svg(ICON.expand) + '<span class="tip">باز کردن همهٔ پنل‌ها</span></button>' +
      '<button class="tb" data-tb="offline">' + svg(ICON.offline) + '<span class="tip">ذخیره برای مطالعهٔ آفلاین</span></button>' +
      '<button class="tb" data-tb="print">' + svg(ICON.print) + '<span class="tip">چاپ / PDF</span></button>';
    document.body.appendChild(bar);

    bar.addEventListener("click", function (e) {
      var b = e.target.closest(".tb"); if (!b) return;
      var t = b.dataset.tb;
      if (t === "pomodoro") pomodoro(b);
      if (t === "note") openNotes();
      if (t === "speak") speak(b);
      if (t === "focus") { document.body.classList.toggle("focus-mode"); b.classList.toggle("on", document.body.classList.contains("focus-mode")); }
      if (t === "expand") {
        var open = document.querySelector("details.panel[open]") ? false : true;
        document.querySelectorAll("details.panel").forEach(function (d) { d.open = open; });
        toast(open ? "همهٔ پنل‌ها باز شد" : "همهٔ پنل‌ها بسته شد");
      }
      if (t === "offline") saveOffline(b);
      if (t === "print") window.print();
      if (t === "ai") {
        var vis = null, mid = innerHeight / 3;
        document.querySelectorAll(".lesson[id]").forEach(function (l) { var r = l.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) vis = l; });
        vis = vis || document.querySelector(".lesson[id]");
        var title = vis ? (vis.querySelector("h2") || {}).textContent : document.title;
        var bn = (BOOKS.filter(function (b) { return b.k === document.body.getAttribute("data-subject"); })[0] || {}).n || "";
        var q = "درس «" + String(title).trim() + "»" + (bn ? " از " + bn : "") +
          " را کامل و ساده توضیح بده، مهم‌ترین نکته‌هایش را بگو و سه نمونه سؤال امتحانی با پاسخ بساز.";
        location.href = url("ai.html") + "?q=" + encodeURIComponent(q);
      }
    });
  }

  /* ---------- پومودورو ---------- */
  var pomo = { left: 25 * 60, run: false, timer: null };
  function pomodoro(btn) {
    if (pomo.run) { clearInterval(pomo.timer); pomo.run = false; btn.classList.remove("running"); toast("تایمر متوقف شد"); return; }
    pomo.run = true; btn.classList.add("running");
    var timeEl = btn.querySelector(".tb-time");
    pomo.timer = setInterval(function () {
      pomo.left--;
      if (pomo.left <= 0) {
        clearInterval(pomo.timer); pomo.run = false; pomo.left = 25 * 60;
        btn.classList.remove("running"); timeEl.textContent = "";
        toast("پایان ۲۵ دقیقه! پنج دقیقه استراحت کن.");
        return;
      }
      var m = Math.floor(pomo.left / 60), s = pomo.left % 60;
      timeEl.textContent = (m < 10 ? "۰" : "") + m.toString().replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }) + ":" +
        (s < 10 ? "۰" : "") + s.toString().replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; });
    }, 1000);
    toast("تایمر ۲۵ دقیقه‌ای شروع شد");
  }

  /* ---------- بلندخوانی ---------- */
  var speaking = false;
  function speak(btn) {
    if (!("speechSynthesis" in window)) { toast("مرورگر شما از بلندخوانی پشتیبانی نمی‌کند"); return; }
    if (speaking) { speechSynthesis.cancel(); speaking = false; btn.classList.remove("on"); return; }
    var vis = null, lessons = document.querySelectorAll(".lesson[id]");
    var mid = innerHeight / 3;
    lessons.forEach(function (l) { var r = l.getBoundingClientRect(); if (r.top < mid && r.bottom > mid) vis = l; });
    vis = vis || lessons[0];
    if (!vis) return;
    var body = vis.querySelector(".panel-body");
    var text = (body ? body.innerText : vis.innerText).slice(0, 4000);
    var u = new SpeechSynthesisUtterance(text);
    u.lang = "fa-IR"; u.rate = .95;
    u.onend = function () { speaking = false; btn.classList.remove("on"); };
    speaking = true; btn.classList.add("on");
    speechSynthesis.speak(u);
    toast("بلندخوانی شروع شد");
  }

  /* ---------- یادداشت ---------- */
  function noteKey() { return "g8:notes:" + location.pathname.replace(/[^a-z0-9]/gi, "_"); }
  function openNotes() {
    var d = document.querySelector(".drawer.notes");
    if (!d) {
      d = document.createElement("aside");
      d.className = "drawer notes";
      d.innerHTML =
        '<div class="drawer-head"><h4>یادداشت‌های من</h4><button class="icon-btn" data-close-drawer aria-label="بستن">✕</button></div>' +
        '<div class="drawer-body"><div data-notes-list></div>' +
        '<label style="font-size:.8rem;font-weight:800;display:block;margin-top:14px">یادداشت جدید</label>' +
        '<textarea class="area" data-note-input placeholder="خلاصهٔ خودت، نکتهٔ مهم یا سؤالی که داری…"></textarea></div>' +
        '<div class="drawer-foot"><button class="btn btn-primary btn-sm" data-note-save>ذخیرهٔ یادداشت</button>' +
        '<button class="btn btn-ghost btn-sm" data-note-clear>پاک‌کردن همه</button></div>';
      document.body.appendChild(d);
      d.addEventListener("click", function (e) {
        if (e.target.closest("[data-close-drawer]")) d.classList.remove("open");
        if (e.target.closest("[data-note-save]")) {
          var ta = d.querySelector("[data-note-input]");
          var v = ta.value.trim(); if (!v) return;
          var all = LS.get(noteKey(), []);
          all.unshift({ t: Date.now(), v: v, p: document.title });
          LS.set(noteKey(), all); ta.value = ""; drawNotes(); toast("یادداشت ذخیره شد");
        }
        if (e.target.closest("[data-note-clear]")) { LS.del(noteKey()); drawNotes(); toast("یادداشت‌ها پاک شد"); }
        var del = e.target.closest("[data-note-del]");
        if (del) { var all = LS.get(noteKey(), []); all.splice(+del.dataset.noteDel, 1); LS.set(noteKey(), all); drawNotes(); }
      });
    }
    d.classList.add("open"); drawNotes();
  }
  function drawNotes() {
    var d = document.querySelector(".drawer.notes"); if (!d) return;
    var list = d.querySelector("[data-notes-list]");
    var all = LS.get(noteKey(), []);
    if (!all.length) { list.innerHTML = '<p style="color:var(--muted);font-size:.85rem">هنوز یادداشتی ثبت نشده است.</p>'; return; }
    list.innerHTML = all.map(function (n, i) {
      var dt = new Date(n.t).toLocaleDateString("fa-IR");
      return '<div class="note-item"><b>' + esc(dt) + '</b><p>' + esc(n.v) + '</p><button class="del" data-note-del="' + i + '">حذف</button></div>';
    }).join("");
  }

  /* ---------- آفلاین ---------- */
  function saveOffline(btn) {
    if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) { toast("برای ذخیرهٔ آفلاین، سایت باید از روی سرور باز شود"); return; }
    var urls = [url("index.html"), url("offline.html")];
    BOOKS.forEach(function (b) { urls.push(url(GP + b.f)); });
    EXTRAS.forEach(function (e) { urls.push(url(e.f)); });
    document.querySelectorAll("a[href]").forEach(function (a) {
      var h = a.getAttribute("href") || "";
      if (/\.html$/.test(h) && h.indexOf("://") === -1) urls.push(a.href);
    });
    navigator.serviceWorker.controller.postMessage({ type: "PRECACHE_ALL", urls: urls });
    btn.classList.add("on");
    toast("همهٔ ۱۶ صفحه برای مطالعهٔ آفلاین ذخیره شد");
  }

  function netBadge() {
    var b = document.createElement("div");
    b.className = "net-badge";
    b.innerHTML = "◍ حالت آنلاین — همهٔ درس‌ها از حافظهٔ دستگاه خوانده می‌شوند";
    document.body.appendChild(b);
    function sync() { document.body.classList.toggle("offline", !navigator.onLine); }
    addEventListener("online", sync); addEventListener("offline", sync); sync();
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol !== "http:" && location.protocol !== "https:") return;
    /* updateViaCache:"none" → مرورگر همیشه نسخهٔ تازهٔ sw.js را می‌گیرد.
       پیش‌تر نسخهٔ کهنه در حافظهٔ HTTP می‌ماند و اصلاح باگ ERR_FAILED
       به دست کاربر نمی‌رسید. */
    navigator.serviceWorker.register(url("sw.js"), { updateViaCache: "none" }).then(function (reg) {
      try { reg.update(); } catch (e) { }
      /* اگر پیش‌تر Service Worker داشتیم (نسخهٔ خراب) و حالا نسخهٔ تازه
         کنترل را گرفت، یک‌بار صفحه را نو می‌کنیم تا همان لحظه نسخهٔ سالم
         دیده شود. برای کاربری که تازه آمده، نو کردن لازم نیست. */
      if (!navigator.serviceWorker.controller) return;
      var done = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (done) return;
        done = true;
        location.reload();
      });
    }).catch(function () { });
  }

  /* ---------- حافظهٔ محل مطالعه ---------- */
  function rememberPos() {
    var k = "g8:pos:" + location.pathname;
    var saved = LS.get(k, 0);
    if (saved > 500 && document.body.scrollHeight > innerHeight * 1.6) {
      setTimeout(function () {
        toast("قبلاً این صفحه را نیمه‌کاره رها کرده بودی", "برگرد به محل قبل", function () { window.scrollTo({ top: saved, behavior: "smooth" }); });
      }, 1200);
    }
    var t;
    addEventListener("scroll", function () {
      clearTimeout(t);
      t = setTimeout(function () { LS.set(k, Math.round(window.scrollY)); }, 500);
    }, { passive: true });
  }


  /* ---------- نصب روی دستگاه (PWA) ---------- */
  var deferredInstall = null;
  addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); deferredInstall = e;
    document.querySelectorAll("[data-install-app]").forEach(function (b) { b.classList.add("on"); });
  });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-install-app]")) return;
    if (deferredInstall) { deferredInstall.prompt(); deferredInstall = null; }
    else toast("در منوی مرورگر «افزودن به صفحهٔ اصلی» را انتخاب کن");
  });


  /* ---------- حالت برنامهٔ اندروید ---------- */
  function appMode() {
    var ua = navigator.userAgent || "";
    var inApp = /PayeHashtomApp/i.test(ua) || document.documentElement.classList.contains("app-mode");
    if (!inApp) return;
    document.body.classList.add("app-mode");
    var path = location.pathname.replace(/^.*\//, "") || "index.html";
    var items = [
      { n: "خانه", f: url("index.html"), i: '<path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9h12v-9"/>' },
      { n: "کتاب‌ها", f: url("pages/math.html"), i: '<path d="M4 19V6a2 2 0 0 1 2-2h11a1 1 0 0 1 1 1v14a2.5 2.5 0 0 0-2.5 2.5H6a2 2 0 0 1-2-2z"/>' },
      { n: "داشبورد", f: url("dashboard.html"), i: ICON.dash },
      { n: "آزمون", f: url("exam.html"), i: ICON.exam },
      { n: "فلش‌کارت", f: url("flashcards.html"), i: ICON.cards }
    ];
    var nav = document.createElement("nav");
    nav.className = "app-nav";
    nav.innerHTML = items.map(function (it) {
      var on = (path === it.f.split("/").pop());
      return '<a href="' + it.f + '" class="' + (on ? "is-active" : "") + '">' + svg(it.i) + "<span>" + it.n + "</span></a>";
    }).join("");
    document.body.appendChild(nav);
  }

  /* ---------- راه‌اندازی ---------- */
  function init() {
    buildMega(); buildToolbar(); netBadge(); registerSW(); rememberPos(); appMode();

    var t2 = document.createElement("a");
    t2.href = url("dashboard.html") + (GRD === "8" ? "" : "?g=" + GRD); t2.className = "tb"; t2.dataset.tb = "dash";
    t2.innerHTML = svg(ICON.dash) + '<span class="tip">داشبورد مطالعه</span>';
    var bar = document.querySelector(".toolbar"); if (bar) bar.insertBefore(t2, bar.firstChild);

    var cbtn = document.createElement("button");
    cbtn.className = "icon-btn"; cbtn.setAttribute("data-open-cmdk", ""); cbtn.setAttribute("aria-label", "جست‌وجوی سریع");
    cbtn.innerHTML = svg(ICON.search);
    var nav = document.querySelector(".header-nav");
    if (nav) nav.insertBefore(cbtn, nav.firstChild);

    /* «زنگ تفریح» در ردیف اول منوی بالای سایت — همیشه دیده شود
       (پیش‌تر فقط داخل منوی «بیشتر»/مگامنو بود و به‌راحتی پیدا نمی‌شد). */
    var zone = document.querySelector(".header-nav");
    if (zone && !zone.querySelector("[data-zt-link]")) {
      var z = document.createElement("a");
      z.href = url("community.html");
      z.setAttribute("data-zt-link", "");
      z.className = "zt-top-link";
      z.innerHTML = "🎉 <span>زنگ تفریح</span>";
      var zOn = /community\.html$/.test(location.pathname);
      if (zOn) z.className += " is-active";
      var first = zone.querySelector("a");
      if (first) zone.insertBefore(z, first); else zone.appendChild(z);
    }

    document.addEventListener("click", function (e) { if (e.target.closest("[data-open-cmdk]")) { e.preventDefault(); open(); } });
    document.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); open(); }
      if (e.key === "Escape") close();
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.G8 = { toast: toast, LS: LS, BOOKS: BOOKS, url: url, jsonLoad: jsonLoad, esc: esc, svg: svg, ICON: ICON };
})();
