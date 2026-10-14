/* ==========================================================================
   رهنما — مدیریت پایه  |  grade.js
   انتخاب پایه (هفتم/هشتم/نهم) → همهٔ جزوه‌ها، ابزارها و داده‌های همان پایه
   ========================================================================== */
(function () {
  "use strict";
  var G = window.G8 || {};
  var LS = G.LS;
  var url = G.url || function (p) { return p; };
  var J = G.jsonLoad || function (p) { return fetch(url(p)).then(function (r) { return r.json(); }); };
  var esc = G.esc || function (s) { return String(s); };

  var ICON = {
    math: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 8h8M8 12h2M12 12h2M16 12h.01M8 16h2M12 16h2M16 16h.01"/>',
    science: '<path d="M9 3h6M10 3v6L5 19a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-10V3"/><path d="M7 14h10"/>',
    farsi: '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h6"/>',
    negaresh: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/>',
    arabic: '<path d="M12 3v18M5 8h14M7 16h10"/><circle cx="12" cy="12" r="9"/>',
    english: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18z"/>',
    social: '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    religion: '<path d="M12 21s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.7-7 10-7 10z"/>',
    quran: '<path d="M12 6.5S9.5 4 4 4v13c5.5 0 8 2.5 8 2.5S14.5 17 20 17V4c-5.5 0-8 2.5-8 2.5z"/><path d="M12 6.5V19.5"/>',
    tech: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/>',
    art: '<path d="M12 3a9 9 0 0 0 0 18c1.7 0 2-1.3 1.2-2.2c-.8-.9-.3-2.8 1.8-2.8H18a3 3 0 0 0 3-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="15.5" cy="10" r="1"/>',
    thinking: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 1 4 10.5V16H8v-2.5A6 6 0 0 1 12 3z"/>',
    defa: '<path d="M12 3l8 3v6c0 5-3.4 8.2-8 9.5C7.4 20.2 4 17 4 12V6z"/><path d="M9 12l2 2 4-4"/>'
  };
  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function $(s, r) { return (r || document).querySelector(s); }

  /* ---------- تعیین پایهٔ جاری ---------- */
  function resolveGrade() {
    var q = new URLSearchParams(location.search).get("g");
    var body = document.body.getAttribute("data-grade");
    var saved = LS ? LS.get("g8:grade", null) : null;
    var g = q || body || saved || "8";
    if (["7", "8", "9"].indexOf(g) === -1) g = "8";
    if (LS) LS.set("g8:grade", g);
    return g;
  }
  var GRADE = resolveGrade();
  G.grade = GRADE;

  /* ---------- انتخابگر در سربرگ ---------- */
  var GRADES = [["7", "هفتم"], ["8", "هشتم"], ["9", "نهم"]];
  function gradeHome(g) {
    return g === "8" ? url("index.html") : url("g" + g + "/index.html");
  }
  function buildSelector() {
    var nav = document.querySelector(".header-nav");
    if (!nav || nav.querySelector(".grade-switch")) return;
    var box = document.createElement("span");
    box.className = "grade-switch";
    GRADES.forEach(function (x) {
      var a = document.createElement("a");
      a.href = gradeHome(x[0]);
      a.textContent = x[1];
      a.title = "جزوه‌های پایهٔ " + x[1];
      if (x[0] === GRADE) a.className = "is-active";
      box.appendChild(a);
    });
    nav.insertBefore(box, nav.firstChild);
  }

  /* ---------- افزودن ?g= به لینک ابزارها ---------- */
  function toolQuery() { return GRADE === "8" ? "" : "?g=" + GRADE; }
  function fixToolLinks() {
    if (GRADE === "8") return;
    document.querySelectorAll('a[href$="ai.html"],a[href$="exam.html"],a[href^="ai.html"],a[href^="exam.html"],a[href$="flashcards.html"],a[href$="dashboard.html"]').forEach(function (a) {
      var h = a.getAttribute("href");
      if (!h || h.indexOf("?g=") > -1 || h.indexOf("#") > -1) return;
      if (/^(ai|exam|flashcards|dashboard)\.html$/.test(h) || /\/(ai|exam|flashcards|dashboard)\.html$/.test(h)) {
        a.setAttribute("href", h + toolQuery());
      }
    });
  }

  /* ---------- صفحهٔ اصلی: شبکهٔ کتاب‌ها با انتخاب پایه ---------- */
  function card(b) {
    return '<a class="subject-card" href="' + url(b.file) + '" style="--accent:' + b.color + '">' +
      '<span class="subject-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + (ICON[b.key] || "") + "</svg></span>" +
      "<h3>" + esc(b.name) + "</h3>" +
      '<p class="s-desc">' + esc(b.desc) + "</p>" +
      '<div class="subject-meta"><span class="chip chip-accent">' + esc(b.cat) + "</span>" +
      '<span class="chip">' + fa(b.lessons) + " درس</span></div>" +
      '<span class="subject-cta">مشاهدهٔ جزوه</span></a>';
  }

  function buildPicker(DATA) {
    var host = $("[data-grade-picker]");
    if (!host) return;
    var grid = $("[data-subject-grid]");
    var stats = $("[data-grade-stats]");
    var tabs = DATA.grades.map(function (x) {
      return '<button class="grade-tab' + (x.g === GRADE ? " on" : "") + '" data-pick="' + x.g + '">' +
        "پایهٔ " + x.name + '<small>' + fa(x.books) + " کتاب · " + fa(x.lessons) + " درس</small></button>";
    }).join("");
    host.innerHTML = '<div class="grade-tabs">' + tabs + "</div>";

    function render(g) {
      var bs = DATA.books.filter(function (b) { return b.g === g; });
      var info = DATA.grades.filter(function (x) { return x.g === g; })[0] || {};
      if (grid) grid.innerHTML = bs.map(card).join("");
      if (stats) {
        stats.innerHTML =
          '<div class="hero-stat"><strong>' + fa(info.books || bs.length) + "</strong><span>کتاب درسی</span></div>" +
          '<div class="hero-stat"><strong>' + fa(info.lessons || 0) + "</strong><span>درس و فصل</span></div>" +
          '<div class="hero-stat"><strong>' + fa(info.quiz || 0) + "</strong><span>پرسش چهارگزینه‌ای</span></div>" +
          '<div class="hero-stat"><strong>۱۰۰٪</strong><span>آنلاین و رایگان</span></div>';
      }
      host.querySelectorAll("[data-pick]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-pick") === g); });
      var t = $("[data-grade-title]");
      if (t) t.textContent = "پایهٔ " + (info.name || "");
    }
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-pick]");
      if (!b) return;
      var g = b.getAttribute("data-pick");
      if (LS) LS.set("g8:grade", g);
      if (g === GRADE) { render(g); return; }
      location.href = gradeHome(g);
    });
    render(GRADE);
  }

  /* ---------- راه‌اندازی ---------- */
  function init() {
    buildSelector();
    setTimeout(fixToolLinks, 400);   // پس از ساخته‌شدن منو توسط enhance.js
    if ($("[data-grade-picker]")) {
      J("assets/grades.json")
        .then(buildPicker).catch(function () {});
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 90); });
  else setTimeout(init, 90);
})();
