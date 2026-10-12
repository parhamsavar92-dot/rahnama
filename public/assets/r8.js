/* ==========================================================================
   رهنما — لایهٔ ۸: رفتار «یخ و شیشه»  |  r8.js
   --------------------------------------------------------------------------
   کارهای این فایل:
     ۱. ساخت شفق یخی (div.r8-aurora)
     ۲. بلورهای یخی شناور در هدر
     ۳. شیب سه‌بعدی کارت‌ها با حرکت موس (فقط دستگاه اشاره‌گر)
     ۴. ظهور پله‌ای بخش‌ها هنگام اسکرول
     ۵. محافظ‌های کارایی: دستگاه ضعیف، تبِ پنهان، کاهش حرکت

   هیچ‌کدام از این کارها اگر شکست بخورد، صفحه را خراب نمی‌کند:
   همهٔ بخش‌ها در try/catch جدا هستند و ظاهر پایه بدون این فایل هم سالم است.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!D || !D.body) return;

  var REDUCED = false;
  try { REDUCED = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }

  /* ------------------------------------------------ ۱. سنجش توان دستگاه */
  function isLite() {
    try {
      var cores = navigator.hardwareConcurrency || 4;
      var mem = navigator.deviceMemory || 4;
      var save = navigator.connection && navigator.connection.saveData;
      if (save) return true;
      if (cores <= 4) return true;
      if (mem <= 4) return true;
      // دستگاه لمسی کوچک هم معمولاً ضعیف است
      if (W.matchMedia && W.matchMedia("(max-width: 480px)").matches && cores <= 6) return true;
    } catch (e) { }
    return false;
  }
  var LITE = isLite();
  if (LITE) D.body.classList.add("r8-lite");

  var FX = !LITE && !REDUCED;   // اجازهٔ جلوه‌های سنگین

  /* ------------------------------------------------ ۲. شفق یخی */
  function buildAurora() {
    if (!FX) return;
    if (D.querySelector(".r8-aurora")) return;
    var d = D.createElement("div");
    d.className = "r8-aurora";
    d.setAttribute("aria-hidden", "true");
    D.body.insertBefore(d, D.body.firstChild);
  }

  /* ------------------------------------------------ ۳. بلورهای یخی هدر */
  function buildCrystals() {
    if (!FX) return;
    var h = D.querySelector(".site-header");
    if (!h) return;
    if (h.querySelector(".r8-crystal")) return;
    if (W.getComputedStyle(h).position === "static") h.style.position = "relative";
    var n = 5;
    for (var i = 0; i < n; i++) {
      var s = D.createElement("i");
      s.className = "r8-crystal";
      s.setAttribute("aria-hidden", "true");
      s.style.insetInlineStart = (8 + i * 18 + Math.random() * 8) + "%";
      s.style.setProperty("--r8-dx", (Math.random() * 46 - 23).toFixed(1) + "px");
      s.style.setProperty("--r8-dur", (11 + Math.random() * 8).toFixed(1) + "s");
      s.style.setProperty("--r8-delay", (-Math.random() * 14).toFixed(1) + "s");
      h.appendChild(s);
    }
    // پایان‌یافته‌ها را جمع می‌کنیم تا هدر پر نشود
    setTimeout(function () {
      var extra = h.querySelectorAll(".r8-crystal");
      for (var k = extra.length - 1; k >= n; k--) extra[k].remove();
    }, 40000);
  }

  /* --------------------------------------- ۴. شیب سه‌بعدی (بازدهی‌محور) */
  var TILT_SEL = ".card, .subject-card, .tool-card";
  var MAX_TILT = 26;            // سقف تعداد کارت‌ها، تا موبایل کند نشود
  function buildTilt() {
    if (!FX) return;
    var fine = W.matchMedia && W.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;
    var cards = Array.prototype.slice.call(D.querySelectorAll(TILT_SEL)).slice(0, MAX_TILT);
    if (!cards.length) return;
    D.body.classList.add("r8-tilt");

    cards.forEach(function (c) {
      c.classList.add("r8-3d");
      var raf = 0, rx = 0, ry = 0;

      function apply() {
        raf = 0;
        c.style.setProperty("--r8-rx", rx.toFixed(2) + "deg");
        c.style.setProperty("--r8-ry", ry.toFixed(2) + "deg");
      }
      function move(ev) {
        var r = c.getBoundingClientRect();
        if (!r.width || !r.height) return;
        var px = (ev.clientX - r.left) / r.width;    // ۰..۱
        var py = (ev.clientY - r.top) / r.height;
        ry = (px - 0.5) * 7;                          // حول محور عمودی
        rx = (0.5 - py) * 6;                          // حول محور افقی
        if (!raf) raf = W.requestAnimationFrame(apply);
      }
      function reset() {
        rx = ry = 0;
        if (!raf) raf = W.requestAnimationFrame(apply);
      }
      c.addEventListener("pointermove", move, { passive: true });
      c.addEventListener("pointerleave", reset, { passive: true });
    });
  }

  /* ------------------------------------- ۵. ظهور پله‌ای هنگام اسکرول */
  function buildReveal() {
    var blocks = D.querySelectorAll(
      "main > section, main > .wrap > .card, main > .wrap > article, main .pd-grid > .card"
    );
    if (!blocks.length) return;
    if (REDUCED || !("IntersectionObserver" in W)) {
      Array.prototype.forEach.call(blocks, function (b) { b.classList.add("r8-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add("r8-in");
        io.unobserve(en.target);
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });

    var shown = 0;
    Array.prototype.forEach.call(blocks, function (b, i) {
      // آنچه همین حالا در دید است بی‌درنگ نشان داده می‌شود (بدون پرش)
      var r = b.getBoundingClientRect();
      if (r.top < W.innerHeight * 0.9) return;
      b.classList.add("r8-reveal");
      b.style.setProperty("--r8-i", (shown % 6));
      shown++;
      io.observe(b);
    });
  }

  /* ------------------------------------- ۶. بارگذاری تنبل بخش‌های پایین */
  function buildLazy() {
    if (!("CSS" in W) || !CSS.supports || !CSS.supports("content-visibility", "auto")) return;
    var secs = D.querySelectorAll("main > section");
    Array.prototype.forEach.call(secs, function (s, i) {
      if (i < 2) return;                       // دو بخش اول همیشه آماده
      var r = s.getBoundingClientRect();
      if (r.top > W.innerHeight * 2) s.classList.add("r8-lazy");
    });
  }

  /* ------------------------------------- ۷. توقف انیمیشن‌ها در تبِ پنهان */
  function pauseHidden() {
    D.addEventListener("visibilitychange", function () {
      try { D.body.classList.toggle("r8-paused", D.hidden); } catch (e) { }
    });
  }

  /* ------------------------------------------------------------ اجرا */
  function run() {
    var jobs = [buildAurora, buildCrystals, buildTilt, buildReveal, buildLazy, pauseHidden];
    jobs.forEach(function (fn) {
      try { fn(); } catch (e) { /* یک جلوه خراب شود، بقیه سالم می‌مانند */ }
    });
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", run);
  else run();

  // اگر بعداً کارتی اضافه شد (فیلتر/جست‌وجو)، شیب سه‌بعدی را دوباره ببند
  var again = 0;
  W.addEventListener("load", function () {
    if (again) return; again = 1;
    try { buildTilt(); } catch (e) { }
  });

  W.R8 = { lite: LITE, fx: FX, rebuild: run };
})();
