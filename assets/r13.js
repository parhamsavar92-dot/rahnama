/* ==========================================================================
   رهنما — لایهٔ شکوفایی (r13.js)
   --------------------------------------------------------------------------
   انیمیشن‌های ظریف سایت، همه سبک و بی‌خطر:
     • بازشدن بخش‌ها هنگام اسکرول (با احترام به «کاهش حرکت»)
     • خط لغزان منو و ضربدر شدن دکمهٔ فهرست
     • نوار پیشرفت اسکرول و دکمهٔ بازگشت به بالا
     • شمارندهٔ نرم اعداد در آمار
   هیچ‌جا محتوایی حذف یا پنهان نمی‌شود: اگر این فایل اجرا نشود، سایت کامل کار می‌کند.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  if (!D || !W) return;

  var REDUCED = false;
  try { REDUCED = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { REDUCED = false; }
  function LITE() { return D.body && D.body.classList.contains("r8-lite"); }
  var raf = W.requestAnimationFrame ? W.requestAnimationFrame.bind(W) : function (f) { return setTimeout(f, 16); };

  /* ── ۱. فعال‌سازی لایه (بدون این کلاس، هیچ چیز پنهان نمی‌شود) ───────────── */
  D.documentElement.classList.add("r13-on");

  function ready(fn) {
    if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn();
  }

  /* ── ۲. بازشدن نرم بخش‌ها ────────────────────────────────────────────────
     فقط بلوک‌های بزرگ صفحه را می‌گیریم (نه هر عنصر کوچک) تا حرکت آرام و روان
     بماند و چیدمان نلرزد. عناصری که همان اول در دید هستند، بی‌درنگ و با
     فاصلهٔ کوتاه ظاهر می‌شوند تا پرش دیده نشود. */
  function reveal() {
    if (REDUCED) return;
    var nodes = [];
    function add(list) { for (var i = 0; i < list.length; i++) if (list[i] && nodes.indexOf(list[i]) < 0) nodes.push(list[i]); }
    add(D.querySelectorAll("[data-reveal]"));
    add(D.querySelectorAll("main > section"));
    add(D.querySelectorAll("main > .wrap > .card, main > .wrap > .grid-2, main > .wrap > .grid-3"));
    /* بخش‌هایی که نوار چسبان (sticky) دارند از حرکت کنار گذاشته می‌شوند،
       وگرنه حرکت نَیاکان با چسبیدن نوار به بالای صفحه تضاد پیدا می‌کند. */
    nodes = nodes.filter(function (el) { return !el.hasAttribute("data-no-reveal"); });
    if (!nodes.length) return;

    var batch = [];
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].r13I = i;
      batch.push(nodes[i]);
      if (batch.length >= 4 || i === nodes.length - 1) {
        mark(batch.slice());
        batch = [];
      }
    }

    function mark(list) {
      for (var k = 0; k < list.length; k++) {
        var el = list[k];
        el.classList.add("r13-reveal");
        /* فاصلهٔ پله‌ای داخل هر گروه تا حرکت زنجیره‌ای و طبیعی دیده شود */
        el.style.transitionDelay = Math.min(k % 4, 3) * 70 + "ms";
      }
    }

    if (!("IntersectionObserver" in W)) {
      for (var q = 0; q < nodes.length; q++) nodes[q].classList.add("r13-in");
      return;
    }

    var vh = W.innerHeight || 800;
    var io = new IntersectionObserver(function (entries) {
      for (var e = 0; e < entries.length; e++) {
        var en = entries[e];
        if (!en.isIntersecting) continue;
        en.target.classList.add("r13-in");
        io.unobserve(en.target);
        /* پس از پایان حرکت، فاصله و will-change آزاد می‌شوند */
        (function (t) {
          setTimeout(function () { t.style.transitionDelay = ""; t.style.willChange = "auto"; }, 1100);
        })(en.target);
      }
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.05 });

    for (var n = 0; n < nodes.length; n++) {
      var el = nodes[n];
      var top = el.getBoundingClientRect().top;
      if (top < vh * 0.92) el.classList.add("r13-in");     /* همان اول در دید → بی‌درنگ */
      else io.observe(el);
    }

    /* محافظ: اگر روزی ناظر چیزی را جا انداخت، همه چیز باز می‌شود */
    setTimeout(function () {
      var rest = D.querySelectorAll(".r13-reveal:not(.r13-in)");
      for (var r = 0; r < rest.length; r++) {
        if (rest[r].getBoundingClientRect().top < (W.innerHeight || 800)) rest[r].classList.add("r13-in");
      }
    }, 2600);
  }

  /* ── ۳. سربرگ + دکمهٔ بالا ───────────────────────────────────────────────
     نکته: «نوار پیشرفت» (#readbar) و «دکمهٔ بازگشت به بالا» (#toTop) از قبل
     در سایت وجود دارند و app.js آن‌ها را می‌گرداند. اینجا عنصر تازه‌ای ساخته
     نمی‌شود (وگرنه دو دکمهٔ روی‌هم می‌افتاد)؛ فقط اگر صفحه‌ای این دکمه را
     نداشت، یکی با همان شناسهٔ #toTop اضافه می‌شود تا قیافه و رفتارش یکدست بماند. */
  function chrome() {
    var html = D.documentElement;
    var top = D.getElementById("toTop");
    var mine = false;

    if (!top && D.body) {
      top = D.createElement("button");
      top.id = "toTop";
      top.type = "button";
      top.setAttribute("aria-label", "بازگشت به بالای صفحه");
      top.setAttribute("title", "بازگشت به بالا");
      top.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V6M5 12l7-7 7 7"/></svg>';
      top.addEventListener("click", function () { W.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); });
      D.body.appendChild(top);
      mine = true;
    }

    var ticking = false;
    function update() {
      ticking = false;
      var y = W.pageYOffset || html.scrollTop || 0;
      if (y > 6) html.classList.add("r13-scrolled"); else html.classList.remove("r13-scrolled");
      /* فقط دکمه‌ای که خودمان ساخته‌ایم را می‌گردانیم؛ بقیه را app.js اداره می‌کند */
      if (mine) { if (y > 520) top.classList.add("show"); else top.classList.remove("show"); }
    }
    function onScroll() { if (ticking) return; ticking = true; raf(update); }
    W.addEventListener("scroll", onScroll, { passive: true });
    W.addEventListener("resize", onScroll, { passive: true });
    update();
  }

  /* ── ۴. منوی موبایل: ضربدر شدن دکمه و بستن با Esc ─────────────────────── */
  function nav() {
    var btn = D.querySelector("[data-nav-toggle]");
    var list = D.querySelector(".header-nav");
    if (!btn || !list) return;
    btn.setAttribute("aria-expanded", "false");
    function sync() {
      var open = list.classList.contains("open");
      D.documentElement.classList.toggle("r13-navopen", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    }
    btn.addEventListener("click", function () { setTimeout(sync, 0); });
    D.addEventListener("click", function (e) {
      if (!e.target.closest || !e.target.closest(".site-header")) setTimeout(sync, 0);
    });
    D.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && list.classList.contains("open")) { list.classList.remove("open"); sync(); }
    });
    /* پیوندهای کشو: با کلیک، کشو بسته شود */
    list.addEventListener("click", function (e) {
      if (e.target && e.target.tagName === "A") { list.classList.remove("open"); sync(); }
    });
    sync();
  }

  /* ── ۵. مشخص‌کردن پیوند صفحهٔ جاری در منو ─────────────────────────────── */
  function activeNav() {
    var nav = D.querySelector(".header-nav");
    if (!nav || nav.querySelector("a.on, a.is-active")) return;
    var here = (location.pathname || "/").replace(/\/+$/, "").split("/").pop().toLowerCase();
    if (!here) here = "index.html";
    if (here.indexOf(".html") < 0) here += ".html";
    var links = nav.querySelectorAll("a[href]");
    for (var i = 0; i < links.length; i++) {
      var h = (links[i].getAttribute("href") || "").split("#")[0].split("?")[0].toLowerCase();
      if (h === here || (here === "index.html" && (h === "" || h === "index.html" || h === "./"))) {
        links[i].classList.add("on");
        links[i].setAttribute("aria-current", "page");
        break;
      }
    }
  }

  /* ── ۶. شمارندهٔ نرم اعداد ─────────────────────────────────────────────
     فقط روی عنصرهایی که با data-count علامت خورده‌اند؛ بقیهٔ اعداد دست نمی‌خورند. */
  function counters() {
    var els = D.querySelectorAll("[data-count]");
    if (!els.length) return;
    function fa(n) { return String(n).replace(/[0-9]/g, function (d) { return "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[+d]; }); }
    function run(el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      var suffix = el.getAttribute("data-suffix") || "";
      if (REDUCED || LITE()) { el.textContent = fa(target) + suffix; return; }
      var t0 = 0, dur = 900;
      function step(ts) {
        if (!t0) t0 = ts;
        var p = Math.min(1, (ts - t0) / dur);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = fa(Math.round(target * eased)) + (p === 1 ? suffix : "");
        if (p < 1) raf(step);
      }
      raf(step);
    }
    if (!("IntersectionObserver" in W)) { for (var i = 0; i < els.length; i++) run(els[i]); return; }
    var io = new IntersectionObserver(function (ents) {
      for (var e = 0; e < ents.length; e++) if (ents[e].isIntersecting) { run(ents[e].target); io.unobserve(ents[e].target); }
    }, { threshold: 0.3 });
    for (var k = 0; k < els.length; k++) io.observe(els[k]);
  }

  ready(function () {
    try { activeNav(); } catch (e) { }
    try { reveal(); } catch (e) { }
    try { chrome(); } catch (e) { }
    try { nav(); } catch (e) { }
    try { counters(); } catch (e) { }
  });
})();
