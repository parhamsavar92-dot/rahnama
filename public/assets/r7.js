/* ==========================================================================
   رهنما — لایهٔ ۷  |  r7.js
   --------------------------------------------------------------------------
   افزودنی و بی‌خطر؛ هر بخش مستقل کار می‌کند و اگر شرطش نبود، خودش را خاموش
   می‌کند. هیچ اسکریپت دیگری را بازنویسی نمی‌کند.
     ۱) نوار پایین موبایل   — دسترسی یک‌لمسی به بخش‌های اصلی
     ۲) ناوبری بی‌وقفه       — پیش‌بارگذاری صفحه‌های بعدی + گذار نرم
     ۳) ابزارهای درس        — اشتراک، چاپ، نشان‌کردن، زمان مطالعه
     ۴) جزئیات کیوت         — ظاهرشدن نرم بخش‌ها هنگام اسکرول
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(m) { try { if (W.HK && W.HK.toast) return W.HK.toast(m); } catch (e) { } }
  function LS(k, v) {
    try {
      if (v === undefined) return W.localStorage.getItem(k);
      W.localStorage.setItem(k, v);
    } catch (e) { }
  }
  function url(p) {
    try { if (W.G8 && W.G8.url) return W.G8.url(p); } catch (e) { }
    return p;
  }
  var HERE = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  /* ------------------------------------------------ ۱) نوار پایین موبایل */
  var TABS = [
    { f: "index.html", t: "خانه", i: "🏠" },
    { f: "dashboard.html", t: "مطالعه", i: "📚" },
    { f: "exam.html", t: "آزمون", i: "✍️" },
    { f: "ai.html", t: "دستیار", i: "🤖" },
    { f: "profile.html", t: "پروفایل", i: "👤" }
  ];
  function tabbar() {
    if ($(".r7-tabbar")) return;
    var nav = D.createElement("nav");
    nav.className = "r7-tabbar";
    nav.setAttribute("aria-label", "دسترسی سریع");
    nav.innerHTML = TABS.map(function (x) {
      var on = HERE === x.f ? " class=\"on\"" : "";
      return '<a href="' + esc(url(x.f)) + '"' + on + '><b aria-hidden="true">' + x.i + "</b>" + x.t + "</a>";
    }).join("");
    D.body.appendChild(nav);
  }

  /* ------------------------------------------------ ۲) ناوبری بی‌وقفه */
  var done = {};
  function prefetch(href) {
    if (!href || done[href]) return;
    if (!/\.html($|\?|#)/.test(href)) return;
    if (href.indexOf("://") > -1 && href.indexOf(location.host) < 0) return;
    done[href] = 1;
    try {
      var l = D.createElement("link");
      l.rel = "prefetch";
      l.href = href;
      l.as = "document";
      D.head.appendChild(l);
    } catch (e) { }
  }
  function navBoost() {
    // پیش‌بارگذاری هوشمند: با اشاره روی پیوند یا پس از بی‌کاریِ کاربر
    D.addEventListener("mouseover", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (a) prefetch(a.getAttribute("href"));
    }, { passive: true });
    D.addEventListener("touchstart", function (e) {
      var a = e.target.closest && e.target.closest("a[href]");
      if (a) prefetch(a.getAttribute("href"));
    }, { passive: true });
    var idle = W.requestIdleCallback || function (fn) { setTimeout(fn, 1400); };
    idle(function () {
      var links = $$("a[href]").slice(0, 14);
      links.forEach(function (a) { prefetch(a.getAttribute("href")); });
    });
    // گذار نرم هنگام ترک صفحه (بی‌رفرش به‌نظر می‌رسد)
    D.addEventListener("click", function (e) {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      var a = e.target.closest && e.target.closest("a[href]");
      if (!a) return;
      var href = a.getAttribute("href") || "";
      if (!href || href.charAt(0) === "#") return;
      if (a.target === "_blank" || href.indexOf("://") > -1 && href.indexOf(location.host) < 0) return;
      if (!/\.html($|\?|#)/.test(href)) return;
      if (W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      D.body.classList.add("r7-leaving");
    }, true);
  }

  /* ------------------------------------------------ ۳) ابزارهای درس */
  function isLessonPage() { return $$("article.lesson").length > 0; }

  function bookmarkKey() { return "g8:marks"; }
  function marks() {
    try { return JSON.parse(LS(bookmarkKey()) || "[]") || []; } catch (e) { return []; }
  }
  function isMarked(id) {
    return marks().some(function (m) { return m.u === location.pathname + "#" + id; });
  }
  function toggleMark(id, title) {
    var u = location.pathname + "#" + id;
    var list = marks().filter(function (m) { return m.u !== u; });
    if (!isMarked(id)) list.unshift({ u: u, t: title, d: Date.now() });
    try { LS(bookmarkKey(), JSON.stringify(list.slice(0, 120))); } catch (e) { }
    return isMarked(id);
  }

  function readingTime(scope) {
    var chars = String((scope && scope.textContent) || "").replace(/\s+/g, "").length;
    // فارسی: حدود ۹۰۰ نویسه در دقیقه خواندنِ درسی
    return Math.max(1, Math.round(chars / 900));
  }

  function lessonTools() {
    if (!isLessonPage() || $(".r7-tools")) return;
    var main = $("main") || D.body;
    var first = $("article.lesson");
    var mins = 0;
    $$("article.lesson").forEach(function (a) { mins += readingTime(a); });

    var bar = D.createElement("div");
    bar.className = "r7-tools";
    bar.innerHTML =
      '<button type="button" class="r7-t" data-r7="share"><span aria-hidden="true">📤</span> اشتراک‌گذاری</button>' +
      '<button type="button" class="r7-t" data-r7="print"><span aria-hidden="true">🖨</span> چاپ / PDF</button>' +
      '<button type="button" class="r7-t" data-r7="mark"><span aria-hidden="true">🔖</span> نشان‌کردن این درس</button>' +
      '<span class="r7-meta">⏱ حدود ' + String(mins).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }) + " دقیقه مطالعه</span>";
    if (first && first.parentNode) first.parentNode.insertBefore(bar, first);
    else main.insertBefore(bar, main.firstChild);

    // اگر کاربر جای دیگری از درس را خوانده بود، ادامه بده
    try {
      var last = JSON.parse(LS("g8:lessonPos") || "null");
      if (last && last.id && last.y > 400 && Date.now() - (last.t || 0) < 30 * 864e5) {
        var h = D.getElementById(last.id);
        if (h) {
          var go = D.createElement("button");
          go.type = "button"; go.className = "r7-t"; go.style.marginInlineStart = "4px";
          go.innerHTML = '<span aria-hidden="true">↩</span> ادامه از جایی که بودی';
          go.setAttribute("data-r7", "resume");
          go.setAttribute("data-y", String(last.y));
          bar.appendChild(go);
        }
      }
    } catch (e) { }
  }

  function onTools(e) {
    var b = e.target.closest && e.target.closest("[data-r7]");
    if (!b) return;
    var a = b.getAttribute("data-r7");
    if (a === "share") {
      var title = (D.title || "رهنما").trim();
      if (W.navigator && W.navigator.share) {
        W.navigator.share({ title: title, url: location.href }).catch(function () { });
      } else if (W.navigator && W.navigator.clipboard) {
        W.navigator.clipboard.writeText(location.href).then(function () { toast("نشانی صفحه کپی شد"); });
      } else { toast("نشانی: " + location.href); }
      return;
    }
    if (a === "print") { W.print(); return; }
    if (a === "resume") {
      var y = parseInt(b.getAttribute("data-y"), 10) || 0;
      W.scrollTo({ top: y, behavior: "smooth" });
      return;
    }
    if (a === "mark") {
      var cur = currentLessonId();
      if (!cur) { toast("اول روی یک درس بزن"); return; }
      var on = toggleMark(cur.id, cur.title);
      b.classList.toggle("is-on", on);
      toast(on ? "به نشان‌شده‌ها اضافه شد" : "از نشان‌شده‌ها برداشته شد");
      return;
    }
  }

  function currentLessonId() {
    // درسی که در دید است یا آخرین درسی که تا آن اسکرول شده
    var best = null;
    $$("article.lesson").forEach(function (a) {
      var r = a.getBoundingClientRect();
      if (r.top < 140 && r.bottom > 60) best = a;
    });
    if (!best) best = $("article.lesson");
    if (!best) return null;
    var h = best.querySelector("h2, h3");
    return { id: best.id || "", title: (h ? h.textContent : D.title) || "" };
  }

  /* ------------------------------------------------ ۴) جزئیات کیوت */
  function cuteReveal() {
    if (!W.IntersectionObserver) return;
    if (W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var items = $$("main > section, .grid > .card, .subject-card, .tool-card").slice(0, 60);
    if (items.length < 4) return;
    items.forEach(function (el) {
      el.style.opacity = "0";
      el.style.transform = "translateY(10px)";
      el.style.transition = "opacity .38s ease, transform .38s ease";
    });
    var io = new W.IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.opacity = "1"; el.style.transform = "none";
        io.unobserve(el);
      });
    }, { rootMargin: "80px 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------ راه‌اندازی */
  function boot() {
    try { tabbar(); } catch (e) { }
    try { navBoost(); } catch (e) { }
    try { lessonTools(); } catch (e) { }
    try { cuteReveal(); } catch (e) { }
    D.addEventListener("click", onTools, true);
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
