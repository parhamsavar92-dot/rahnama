/* ==========================================================================
   رهنما نسخهٔ ۲ — موتور تجربهٔ کاربری  |  ultra.js
   • انیمیشن کارت‌ها: تیلت سه‌بعدی، درخشش، ورود پلکانی، موج کلیک، شمارنده
   • جست‌وجوی سراسری، تب‌های جزوه، نوار پایین اپ اندروید
   • اصلاح کارایی موبایل: پروفایل سبک، رندر تنبل، حذف معطلی صفحه
   ========================================================================== */
(function () {
  "use strict";

  var D = document, W = window;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var J = (W.G8 && W.G8.jsonLoad) || function (p) { return fetch(U(p)).then(function (r) { return r.json(); }); };
  var reduce = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var cores = navigator.hardwareConcurrency || 4;
  var mem = navigator.deviceMemory || 4;
  var LITE = reduce || cores <= 4 || mem <= 4;
  var IS_APP = /PayeHashtomApp|HamkarDarsiApp/i.test(navigator.userAgent);
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); };

  if (IS_APP) D.body.classList.add("is-app");
  if (LITE) D.body.classList.add("u-lite");
  D.documentElement.classList.add("u-js");

  /* ------------------------------------------------------------- ابزارها */
  function toast(msg, ms) {
    var box = $(".u-toast");
    if (!box) {
      box = D.createElement("div"); box.className = "u-toast";
      box.innerHTML = "<div></div>"; D.body.appendChild(box);
    }
    box.firstChild.textContent = msg;
    box.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { box.classList.remove("show"); }, ms || 2600);
  }
  W.HK = W.HK || {};
  W.HK.toast = toast;
  W.HK.lite = LITE;
  W.HK.isApp = IS_APP;

  /* ------------------------------------------- ۱. نوار پایین مخصوص اپ */
  function buildAppBar() {
    if (!IS_APP || $(".u-appbar")) return;
    var q = (function () {
      var g = D.body.getAttribute("data-grade") || "8";
      return g === "8" ? "" : "?g=" + g;
    })();
    var items = [
      [U("index.html"), "خانه", '<path d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z"/>'],
      [U("jozve.html" + q), "جزوه‌ها", '<path d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2z"/><path d="M8 7h6M8 11h6"/>'],
      [U("report.html" + q), "کارنامه", '<path d="M4 19V5m0 14h16"/><path d="M8 16V9M12 16v-4M16 16v-7"/>'],
      [U("exam.html" + q), "آزمون", '<path d="M9 11l2 2 4-4"/><path d="M5 4h14v16H5z"/>'],
      [U("consult.html" + q), "مشاور", '<path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/>']
    ];
    var bar = D.createElement("nav");
    bar.className = "u-appbar";
    bar.setAttribute("aria-label", "ناوبری برنامه");
    bar.innerHTML = items.map(function (it) {
      var on = (location.pathname.split("/").pop() || "index.html") === (it[0].split("?")[0].split("/").pop() || "index.html") ? " class=\"on\"" : "";
      return '<a href="' + it[0] + '"' + on + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + it[2] + "</svg><span>" + it[1] + "</span></a>";
    }).join("");
    D.body.appendChild(bar);
    D.documentElement.style.setProperty("--u-shell-h", "74px");
  }

  /* --------------------------------------- ۲. ورود پلکانی کارت‌ها */
  function reveal() {
    var sel = ".subject-card, .card, .kpi, .lesson, .tool-card, .rp-card, .jozve-group .subject-card";
    var els = $$(sel).filter(function (e) { return !e.classList.contains("u-reveal"); });
    if (!els.length) return;
    if (LITE || !("IntersectionObserver" in W)) { els.forEach(function (e) { e.classList.add("u-in"); }); return; }

    // فقط عناصر ابتدای صفحه بلافاصله ظاهر شوند؛ بقیه با اسکرول
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var idx = Number(el.getAttribute("data-u-idx") || 0);
        el.style.transitionDelay = Math.min(idx % 8, 7) * 45 + "ms";
        el.classList.add("u-in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.02 });

    els.forEach(function (e, i) {
      // نوار کناری و هدر را دست نمی‌زنیم
      if (e.closest("aside") || e.closest(".site-header")) return;
      e.classList.add("u-reveal");
      e.setAttribute("data-u-idx", String(i));
      io.observe(e);
    });
  }

  /* ------------------------------- ۳. تیلت سه‌بعدی و درخشش کارت‌ها */
  function tilt() {
    if (LITE || IS_APP) return;
    var fine = W.matchMedia && W.matchMedia("(hover:hover) and (pointer:fine)").matches;
    if (!fine) return;
    $$(".subject-card").forEach(function (c) {
      if (c.dataset.uTilt) return;
      c.dataset.uTilt = "1";
      var raf = 0, tx = 0, ty = 0;
      function apply() {
        raf = 0;
        c.style.transform = "perspective(900px) rotateX(" + ty.toFixed(2) + "deg) rotateY(" + tx.toFixed(2) + "deg) translateY(-6px) scale(1.015)";
      }
      c.addEventListener("pointermove", function (e) {
        var r = c.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - .5;
        var py = (e.clientY - r.top) / r.height - .5;
        tx = px * 9; ty = -py * 9;
        if (!raf) raf = requestAnimationFrame(apply);
      });
      c.addEventListener("pointerleave", function () {
        if (raf) { cancelAnimationFrame(raf); raf = 0; }
        c.style.transform = "";
      });
    });
  }

  /* ------------------------------------------------- ۴. موج روی دکمه‌ها */
  D.addEventListener("pointerdown", function (e) {
    var b = e.target.closest(".btn, .opt, .grade-tab, .icon-btn");
    if (!b || LITE) return;
    var r = b.getBoundingClientRect();
    var size = Math.max(r.width, r.height);
    var s = D.createElement("span");
    s.className = "u-ripple";
    s.style.width = s.style.height = size + "px";
    s.style.left = (e.clientX - r.left - size / 2) + "px";
    s.style.top = (e.clientY - r.top - size / 2) + "px";
    b.style.setProperty("--x", ((e.clientX - r.left) / r.width * 100) + "%");
    b.style.setProperty("--y", ((e.clientY - r.top) / r.height * 100) + "%");
    if (getComputedStyle(b).position === "static") b.style.position = "relative";
    b.appendChild(s);
    setTimeout(function () { s.remove(); }, 640);
  }, { passive: true });

  /* --------------------------------------------- ۵. شمارندهٔ اعداد کلیدی */
  function counters() {
    var els = $$(".kpi strong, .hero-stat strong, .rp-card strong").filter(function (el) {
      var t = el.textContent.trim();
      return /^[۰-۹0-9]+$/.test(t) && !el.dataset.uCount && Number(t.replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); })) > 4;
    });
    if (!els.length) return;
    if (LITE || !("IntersectionObserver" in W)) return;
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) {
        if (!x.isIntersecting) return;
        var el = x.target; io.unobserve(el);
        el.dataset.uCount = "1";
        var digits = el.textContent.trim().replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); });
        var target = parseInt(digits, 10);
        if (!isFinite(target)) return;
        var t0 = performance.now(), dur = 900;
        (function step(now) {
          var p = Math.min(1, (now - t0) / dur);
          var v = Math.round(target * (1 - Math.pow(1 - p, 3)));
          el.textContent = fa(v);
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: .3 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ------------------------------------------------- ۶. جست‌وجوی سراسری */
  var searchData = null;
  function loadIndex() {
    if (searchData) return Promise.resolve(searchData);
    return J("assets/search-index.json")
      .then(function (j) { searchData = j; return j; })
      .catch(function () { searchData = []; return []; });
  }
  function initSearch() {
    var input = $("#globalSearch"), box = $("#globalResults");
    if (!input || !box) return;
    var timer = 0;
    function run() {
      var q = input.value.trim().toLowerCase();
      if (q.length < 2) { box.hidden = true; box.innerHTML = ""; return; }
      loadIndex().then(function (rows) {
        var hits = rows.filter(function (r) {
          return (r.t && r.t.toLowerCase().indexOf(q) > -1) || (r.s && r.s.toLowerCase().indexOf(q) > -1) || (r.bn && r.bn.toLowerCase().indexOf(q) > -1);
        }).slice(0, 24);
        box.hidden = false;
        if (!hits.length) { box.innerHTML = '<div class="sr-empty">نتیجه‌ای یافت نشد.</div>'; return; }
        box.innerHTML = hits.map(function (h) {
          return '<a href="' + U(h.url) + '"><div class="sr-t">' + h.t + '</div><div class="sr-m">پایهٔ ' + ({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[h.g] || "") + " · " + h.bn + "</div></a>";
        }).join("");
      });
    }
    input.addEventListener("input", function () { clearTimeout(timer); timer = setTimeout(run, 140); });
    input.addEventListener("focus", function () { loadIndex(); });
    D.addEventListener("click", function (e) { if (!e.target.closest(".searchbox")) { box.hidden = true; } });
    D.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(D.activeElement.tagName)) { e.preventDefault(); input.focus(); input.scrollIntoView({ block: "center" }); }
      if (e.key === "Escape") { box.hidden = true; input.blur(); }
    });
  }

  /* ------------------------------------------------- ۷. تب‌های پایه */
  function initTabs() {
    var host = $("[data-jozve-tabs]");
    if (!host) return;
    var saved = null;
    try { saved = localStorage.getItem("g8:grade"); } catch (e) {}
    var cur = (saved || "8").replace(/"/g, "");
    function show(g) {
      $$("[data-jtab]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-jtab") === g); });
      $$("[data-jgroup]").forEach(function (gr) { gr.hidden = gr.getAttribute("data-jgroup") !== g; });
      try { localStorage.setItem("g8:grade", g); } catch (e) {}
      reveal();
    }
    host.addEventListener("click", function (e) {
      var b = e.target.closest("[data-jtab]");
      if (b) show(b.getAttribute("data-jtab"));
    });
    show(["7", "8", "9"].indexOf(cur) > -1 ? cur : "8");
  }

  /* ------------------------------------------------ ۸. رندر تنبل درس‌ها */
  function lazyLessons() {
    var lessons = $$("article.lesson");
    if (lessons.length > 4) {
      lessons.slice(3).forEach(function (l) { l.classList.add("u-lazy"); });
    }
    // پنل‌های بسته در درس‌های دور، سنگین رندر نشوند
    if (lessons.length > 12 && !LITE) {
      lessons.slice(10).forEach(function (l) {
        $$("details.panel", l).forEach(function (p) { p.removeAttribute("open"); });
      });
    }
  }

  /* ------------------------------------------- ۹. هم‌راستایی منوی فعلی */
  function markNav() {
    var here = location.pathname.split("/").pop() || "index.html";
    $$(".header-nav a").forEach(function (a) {
      var t = (a.getAttribute("href") || "").split("/").pop().split("?")[0];
      if (t && t === here) a.classList.add("is-current");
    });
  }

  /* --------------------------------------------------- ۱۰. راه‌اندازی */
  function boot() {
    D.body.classList.add("u-boot-done");
    buildAppBar();
    markNav();
    lazyLessons();
    reveal();
    counters();
    tilt();
    initSearch();
    initTabs();
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();

  // پس از بارگذاری کامل، بازهه‌ای تنظیمات را تازه کن
  W.addEventListener("load", function () { setTimeout(function () { tilt(); counters(); }, 120); }, { once: true });
})();
