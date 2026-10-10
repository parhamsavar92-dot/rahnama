/* ==========================================================================
   رهنما — بستهٔ مطالعهٔ جزوه  |  assets/hk-study.js
   روی صفحه‌های درس (article.lesson) این‌ها را اضافه می‌کند:
     • نوار چسبان مطالعه: بخش فعلی، نوار پیشرفت، زمان تقریبی مطالعهٔ باقی‌مانده
     • فهرست مطالب خودکار (از سرفصل‌های خود صفحه) با جست‌وجوی سریع
     • نشانهٔ «خوانده‌شده» برای هر بخش (خودکار با اسکرول) + شمارش
     • ادامهٔ مطالعه: بازگشت به همان جای قبلی صفحه
   سرعت: یک IntersectionObserver و یک شنوندهٔ اسکرول رقیق (passive + rAF)؛
   هیچ حلقهٔ دائمی و هیچ افکت سنگینی روی موبایل اجرا نمی‌شود.
   ذخیره در localStorage با کلید g8: → با حساب کاربری هم‌گام می‌شود.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };

  function ls(k, v) {
    try {
      if (v === undefined) { var raw = localStorage.getItem(k); return raw ? JSON.parse(raw) : null; }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
    return null;
  }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  var lessons = $$("article.lesson");
  if (!lessons.length) return;

  var KEY = "g8:study:" + location.pathname;
  var saved = ls(KEY) || { done: {}, pos: 0, at: 0 };
  if (!saved.done) saved.done = {};

  var bar = null, drawer = null, items = [], cur = 0;

  /* ---------------------------------------------- عنوان هر بخش */
  function titleOf(el, i) {
    var h = el.querySelector("h2, h3, h4");
    var t = h ? h.textContent : "";
    t = (t || "").replace(/\s+/g, " ").trim();
    if (!t) t = "بخش " + fa(i + 1);
    return t.length > 90 ? t.slice(0, 88) + "…" : t;
  }

  /* ---------------------------------------------- ساخت نوار و کشوی فهرست */
  function build() {
    var host = $(".lesson-layout") || $("main") || D.body;

    bar = D.createElement("div");
    bar.className = "hk-stbar";
    bar.setAttribute("role", "region");
    bar.setAttribute("aria-label", "نوار مطالعه");
    bar.innerHTML =
      '<button class="hk-stb-btn" data-st="toc" aria-label="فهرست مطالب">☰ فهرست</button>' +
      '<span class="hk-stb-cur" data-st="cur">—</span>' +
      '<span class="hk-stb-meter" aria-hidden="true"><i data-st="fill"></i></span>' +
      '<span class="hk-stb-pct" data-st="pct">۰٪</span>' +
      '<span class="hk-stb-time" data-st="time"></span>' +
      '<button class="hk-stb-btn" data-st="resume" hidden>↩ ادامه</button>';

    drawer = D.createElement("div");
    drawer.className = "hk-stdrawer";
    drawer.hidden = true;
    drawer.innerHTML =
      '<div class="hk-std-head"><b>فهرست مطالب</b>' +
      '<span class="hk-std-count" data-st="count"></span>' +
      '<button class="hk-stb-btn" data-st="close" aria-label="بستن">✕</button></div>' +
      '<div class="hk-std-search"><input type="search" autocomplete="off" placeholder="جست‌وجو در سرفصل‌ها…" data-st="q"></div>' +
      '<ol class="hk-std-list" data-st="list"></ol>';

    host.insertBefore(bar, host.firstChild);
    D.body.appendChild(drawer);

    D.addEventListener("click", function (e) {
      var t = e.target.closest("[data-st]");
      if (!t) return;
      var act = t.getAttribute("data-st");
      if (act === "toc") { e.preventDefault(); toggleDrawer(); }
      else if (act === "close") { e.preventDefault(); toggleDrawer(false); }
      else if (act === "resume") { e.preventDefault(); jump(saved.pos || 0); }
    });
    D.addEventListener("keydown", function (e) { if (e.key === "Escape" && !drawer.hidden) toggleDrawer(false); });
    var q = drawer.querySelector('[data-st="q"]');
    q.addEventListener("input", function () { paintList(q.value); });
  }

  function toggleDrawer(force) {
    var open = force === undefined ? drawer.hidden : force;
    drawer.hidden = !open;
    if (open) {
      var q = drawer.querySelector('[data-st="q"]');
      if (q) q.focus();
      paintList(q ? q.value : "");
    }
  }

  function jump(i) {
    var el = lessons[i];
    if (!el) return;
    W.scrollTo({ top: el.getBoundingClientRect().top + W.pageYOffset - 96, behavior: "smooth" });
    toggleDrawer(false);
  }

  function paintList(filter) {
    var term = (filter || "").trim();
    var html = "";
    var shown = 0;
    items.forEach(function (it) {
      if (term && it.title.indexOf(term) < 0) return;
      shown++;
      html += '<li><button class="hk-std-item' + (it.done ? " is-done" : "") + (it.i === cur ? " is-cur" : "") + '" data-i="' + it.i + '">' +
        '<span class="hk-std-num">' + fa(it.i + 1) + "</span>" +
        '<span class="hk-std-t">' + esc(it.title) + "</span>" +
        (it.done ? '<span class="hk-std-ok" aria-label="خوانده‌شده">✔</span>' : "") +
        "</button></li>";
    });
    var list = drawer.querySelector('[data-st="list"]');
    list.innerHTML = html || '<li class="hk-std-empty">چیزی پیدا نشد</li>';
    var cnt = drawer.querySelector('[data-st="count"]');
    if (cnt) cnt.textContent = fa(doneCount()) + " از " + fa(items.length) + " بخش خوانده‌شده" + (term ? " · " + fa(shown) + " نتیجه" : "");
    list.onclick = function (e) {
      var b = e.target.closest("[data-i]");
      if (b) jump(Number(b.getAttribute("data-i")));
    };
  }

  function doneCount() {
    var n = 0;
    for (var k in saved.done) if (saved.done[k]) n++;
    return n;
  }

  /* ---------------------------------------------- محاسبهٔ پیشرفت و زمان */
  var words = 0;
  (function countWords() {
    var txt = lessons.map(function (a) { return a.textContent || ""; }).join(" ");
    words = (txt.match(/[\u0600-\u06FF]+/g) || []).length;
  })();

  var ticking = false;
  function update() {
    ticking = false;
    var y = W.pageYOffset, vh = W.innerHeight;
    var docH = Math.max(1, D.documentElement.scrollHeight - vh);
    var pct = Math.min(100, Math.max(0, Math.round((y / docH) * 100)));

    var left = Math.max(0, docH - y);
    var remainWords = Math.round(words * (left / Math.max(1, docH)));
    var mins = Math.max(1, Math.round(remainWords / 170));

    var fill = bar.querySelector('[data-st="fill"]');
    var pv = bar.querySelector('[data-st="pct"]');
    var tv = bar.querySelector('[data-st="time"]');
    if (fill) fill.style.width = pct + "%";
    if (pv) pv.textContent = fa(pct) + "٪";
    if (tv) tv.textContent = pct >= 99 ? "تمام شد ✔" : "≈ " + fa(mins) + " دقیقه مانده";
    var rs = bar.querySelector('[data-st="resume"]');
    if (rs) rs.hidden = !(saved.pos > 400 && Math.abs(saved.pos - y) > 600);

    saved.pos = y;
    saved.at = Date.now();
    saveThrottled();
  }
  var saveT = 0;
  function saveThrottled() {
    if (saveT) return;
    saveT = setTimeout(function () { saveT = 0; ls(KEY, saved); }, 1500);
  }

  /* ---------------------------------------------- بخش فعلی + خوانده‌شده */
  function connectObservers() {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var i = Number(en.target.getAttribute("data-lsn"));
        if (en.isIntersecting) {
          cur = i;
          var it = items[i];
          if (it) {
            var c = bar.querySelector('[data-st="cur"]');
            if (c) c.textContent = fa(i + 1) + " از " + fa(items.length) + " · " + it.title;
          }
        }
        // وقتی ۶۰٪ بخش از کنار صفحه گذشت، «خوانده‌شده» می‌شود
        if (en.isIntersecting === false && en.boundingClientRect.bottom < 0) {
          if (!saved.done[i]) {
            saved.done[i] = Date.now();
            if (items[i]) items[i].done = true;
            ls(KEY, saved);
            var ic = bar.querySelector('[data-st="cur"]');
            if (ic) ic.setAttribute("data-done", String(doneCount()));
          }
        }
      });
    }, { rootMargin: "-20% 0px -55% 0px", threshold: 0 });

    lessons.forEach(function (el, i) {
      if (!el.id) el.id = "sec" + (i + 1);
      el.setAttribute("data-lsn", String(i));
      items.push({ i: i, title: titleOf(el, i), id: el.id, done: !!saved.done[i] });
      io.observe(el);
    });
  }

  /* ---------------------------------------------- راه‌اندازی */
  function boot() {
    build();
    connectObservers();
    W.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      W.requestAnimationFrame(update);
    }, { passive: true });
    W.addEventListener("resize", function () {
      if (ticking) return;
      ticking = true;
      W.requestAnimationFrame(update);
    }, { passive: true });
    update();
    if (saved.pos > 800) {
      var rs = bar.querySelector('[data-st="resume"]');
      if (rs) rs.hidden = false;
    }
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
