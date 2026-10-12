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
      if (save) return true;                 // کاربر خودش داده‌کم خواسته
      if (cores && cores <= 2) return true;  // فقط دو هسته‌ای‌های واقعاً ضعیف
      if (mem && mem <= 2) return true;
      // پیش‌تر «۴ هسته یا کم» و «موبایل کوچک» هم ضعیف شمرده می‌شد؛
      // عملاً بیشتر لپ‌تاپ‌های امروزی ۴ هسته گزارش می‌کنند و بی‌دلیل
      // ظاهر یخی خاموش می‌شد. حالا آستانه واقع‌بینانه است.
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
    var n = 3;
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

  /* ── دربارهٔ شیب سه‌بعدی کارت‌ها ────────────────────────────────────────
     این کار از قبل در assets/hk3d.js انجام می‌شود و کاربر هم در تنظیماتش
     آن را روی «حداکثر» گذاشته (data-hk-3d="max").
     پیش‌تر یک سیستم شیب سه‌بعدی دوم هم این‌جا بود؛ هر دو روی یک
     transform می‌نوشتند و نتیجه ناهماهنگ می‌شد. برای یکدستی کامل،
     نسخهٔ تکراری برداشته شد و ۳بعدی فقط به hk3d.js سپرده شد.
  ────────────────────────────────────────────────────────────────────── */

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
        var el = en.target;
        el.classList.add("r8-in");
        io.unobserve(el);
        /* بعد از پایان انیمیشن، کلاس‌ها را برمی‌داریم.
           این‌طور هیچ transform/translate/opacity بازمانده‌ای روی عنصر
           نمی‌ماند و با هاور و شیب سه‌بعدی لایه‌های دیگر تعارض نمی‌کند. */
        setTimeout(function () {
          try {
            el.classList.remove("r8-reveal", "r8-in");
            el.style.removeProperty("--r8-i");
          } catch (e) { }
        }, 1100);
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

  /* ------------------------------------- ۷. روان‌سازی اسکرول
     backdrop-filter هدر چسبان در هر فریم اسکرول از نو حساب می‌شود و
     بزرگ‌ترین عامل کندی بود. هنگام اسکرول موقتاً خاموشش می‌کنیم و
     بعد از ایستِ اسکرول برمی‌گردانیم. هیچ تفاوت بصری محسوسی ندارد. */
  function scrollBlur() {
    var t = 0, raf = 0, on = false;
    function idle() {
      on = false;
      try { D.body.classList.remove("r8-scrolling"); } catch (e) { }
    }
    W.addEventListener("scroll", function () {
      if (!on) { on = true; try { D.body.classList.add("r8-scrolling"); } catch (e) { } }
      clearTimeout(t);
      t = setTimeout(idle, 250);
      if (!raf) raf = W.requestAnimationFrame(function () { raf = 0; });
    }, { passive: true });
  }

  /* ------------------------------------- ۸. نگهبان سرعت (خودکار)
     نرخ فریم را در دو ثانیهٔ اول می‌سنجد. اگر دستگاه ضعیف بود یا مرورگر
     درگیر بود، حالت سبک را روشن می‌کند: شفق یخی، شیشهٔ مات و انیمیشن‌های
     پیوسته خاموش می‌شوند تا سایت روان بماند. این‌طور روی همهٔ دستگاه‌ها
     بدون حدس‌زدن، بهترین حالت انتخاب می‌شود. */
  function fpsWatch() {
    if (LITE) return;
    if (D.hidden) return;
    var frames = 0, t0 = 0, done = false;
    function tick(ts) {
      if (done) return;
      if (!t0) t0 = ts;
      frames++;
      var el = ts - t0;
      if (el < 1600) { W.requestAnimationFrame(tick); return; }
      done = true;
      var fps = frames / (el / 1000);
      try { W.R8 && (W.R8.fps = Math.round(fps)); } catch (e) { }
      if (fps < 45) {
        D.body.classList.add("r8-lite");
        try { W.R8 && (W.R8.lite = true); W.R8 && (W.R8.autoLite = true); } catch (e) { }
      }
    }
    try { W.requestAnimationFrame(tick); } catch (e) { }
  }

  /* ------------------------------------- ۹. توقف انیمیشن‌ها در تبِ پنهان */
  function pauseHidden() {
    D.addEventListener("visibilitychange", function () {
      try { D.body.classList.toggle("r8-paused", D.hidden); } catch (e) { }
    });
  }

  /* ------------------------------------------------------------ اجرا */
  function run() {
    var jobs = [buildAurora, buildCrystals, buildReveal, buildLazy, scrollBlur, pauseHidden, fpsWatch];
    jobs.forEach(function (fn) {
      try { fn(); } catch (e) { /* یک جلوه خراب شود، بقیه سالم می‌مانند */ }
    });
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", run);
  else run();

  W.R8 = { lite: LITE, fx: FX, rebuild: run };
})();
