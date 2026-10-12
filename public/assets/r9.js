/* ==========================================================================
   رهنما — لایهٔ ۹ سراسری: روان‌سازی و میان‌برها  |  r9.js
   --------------------------------------------------------------------------
   این فایل روی همهٔ صفحه‌ها بار می‌شود و این‌ها را اضافه می‌کند:
     • نوار پیشرفت مطالعه در بالای صفحه
     • صفحه‌بندی هوشمند: تصویرها تنبل بار می‌شوند (سرعت بیشتر)
     • کلیدهای میان‌بر + پنجرهٔ راهنما با کلید «؟»
     • دکمهٔ «بخوان» برای بلندخوانی متن درس (فارسی)
     • بن‌بست‌شکن: اگر صفحه‌ای خطا داد، پیام آرام و راه بازگشت
   هر بخش مستقل و در try/catch است تا هیچ‌وقت صفحه را خراب نکند.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!D || !D.body) return;
  function $(s) { return D.querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function toast(m) { try { W.HK && W.HK.toast ? W.HK.toast(m) : null; } catch (e) { } }
  var REDUCED = false;
  try { REDUCED = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }

  /* ───────────────────────────── ۱. نوار پیشرفت مطالعه ───────────────────────────── */
  function progressBar() {
    var bar = D.createElement("div");
    bar.className = "r9-progress";
    bar.setAttribute("aria-hidden", "true");
    bar.innerHTML = "<i></i>";
    D.body.appendChild(bar);
    var fill = bar.firstChild, raf = 0;

    function update() {
      raf = 0;
      var h = D.documentElement.scrollHeight - W.innerHeight;
      var p = h > 40 ? Math.min(100, Math.max(0, (W.pageYOffset / h) * 100)) : 0;
      fill.style.setProperty("--r9-p", p.toFixed(1) + "%");
      bar.style.opacity = p > 0.5 ? "1" : "0";
    }
    W.addEventListener("scroll", function () { if (!raf) raf = W.requestAnimationFrame(update); }, { passive: true });
    W.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ───────────────────────── ۲. بارگذاری تنبلِ تصویرها (سرعت) ───────────────────── */
  function lazyImages() {
    $$("img").forEach(function (im) {
      if (im.getAttribute("loading")) return;
      try {
        im.setAttribute("loading", "lazy");
        im.setAttribute("decoding", "async");
      } catch (e) { }
    });
  }

  /* ───────────────────────────── ۳. کلیدهای میان‌بر ───────────────────────────── */
  function shortcuts() {
    var PAGES = [
      ["۱", "index.html", "خانه"],
      ["۲", "jozve.html", "جزوه‌ها"],
      ["۳", "study-tools.html", "مرکز ابزارها"],
      ["۴", "pdf-tools.html", "ابزار PDF"],
      ["۵", "exam.html", "آزمون"],
      ["۶", "flashcards.html", "فلش‌کارت"],
      ["۷", "ai.html", "دستیار هوشمند"],
      ["۸", "dashboard.html", "داشبورد مطالعه"],
      ["۹", "profile.html", "حساب من"]
    ];
    var base = "";
    try {
      var b = D.body.getAttribute("data-base");
      if (b) base = b;
    } catch (e) { }
    function go(p) {
      // از ریشهٔ سایت یا پوشهٔ همان صفحه حساب می‌کنیم
      var depth = (location.pathname.match(/\//g) || []).length - 1;
      location.href = (base || "../".repeat(Math.max(0, depth))) + p;
    }
    function help() {
      if ($(".rt-kbd-overlay")) return;
      var ov = D.createElement("div");
      ov.className = "rt-kbd-overlay";
      ov.innerHTML = '<div class="rt-kbd-card" role="dialog" aria-label="کلیدهای میان‌بر">' +
        "<h3>کلیدهای میان‌بر</h3>" +
        '<div class="rt-kbd-list">' +
        PAGES.map(function (p) { return "<kbd>Alt + " + p[0] + "</kbd><span>" + p[2] + "</span>"; }).join("") +
        "<kbd>Alt + ?</kbd><span>همین راهنما</span>" +
        "<kbd>Alt + ↑</kbd><span>برو به بالای صفحه</span>" +
        "<kbd>Alt + P</kbd><span>چاپ / ذخیرهٔ PDF</span>" +
        "<kbd>Alt + R</kbd><span>بلندخوانی متن درس</span>" +
        "<kbd>Esc</kbd><span>بستن پنجره‌ها</span>" +
        "</div>" +
        '<div class="rt-btns" style="margin-top:14px"><button type="button" class="rt-btn" data-close>بستن</button></div>' +
        "</div>";
      D.body.appendChild(ov);
      ov.addEventListener("click", function (e) {
        if (e.target === ov || e.target.closest("[data-close]")) ov.remove();
      });
    }
    D.addEventListener("keydown", function (e) {
      if (!e.altKey) {
        if (e.key === "Escape") { var ov = $(".rt-kbd-overlay"); if (ov) ov.remove(); }
        return;
      }
      var k = e.key;
      var hit = PAGES.filter(function (p) { return p[0] === k || p[0] === String(k).replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }); })[0];
      if (hit) { e.preventDefault(); go(hit[1]); return; }
      if (k === "?" || k === "/") { e.preventDefault(); help(); }
      else if (k === "ArrowUp") { e.preventDefault(); W.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); }
      else if (k === "p" || k === "P") { e.preventDefault(); W.print(); }
      else if (k === "r" || k === "R") { e.preventDefault(); readAloud(); }
    });
  }

  /* ─────────────────── ۴. بلندخوانی متن درس (فارسی) ─────────────────── */
  var speaking = false;
  function pickVoice() {
    try {
      var vs = W.speechSynthesis.getVoices() || [];
      for (var i = 0; i < vs.length; i++) if (/fa|persian|iran/i.test(vs[i].lang + " " + vs[i].name)) return vs[i];
    } catch (e) { }
    return null;
  }
  function articleText() {
    var host = $("article.lesson") || $("main article") || $(".lesson") || $("main");
    if (!host) return "";
    var t = (host.innerText || host.textContent || "").replace(/\s+/g, " ").trim();
    return t.slice(0, 3500);
  }
  function readAloud() {
    var btn = $(".r9-tts");
    if (!("speechSynthesis" in W)) { toast("مرورگر تو بلندخوانی را پشتیبانی نمی‌کند"); return; }
    if (speaking) {
      try { W.speechSynthesis.cancel(); } catch (e) { }
      speaking = false;
      if (btn) { btn.classList.remove("on"); btn.textContent = "🔊 بخوان"; }
      return;
    }
    var txt = articleText();
    if (txt.length < 60) { toast("متنی برای خواندن در این صفحه نیست"); return; }
    var v = pickVoice();
    if (!v) {
      toast("صدای فارسی روی این دستگاه نصب نیست — از تنظیمات ویندوز بستهٔ گفتار فارسی را اضافه کن");
      return;
    }
    var u = new SpeechSynthesisUtterance(txt);
    u.lang = v.lang;
    u.voice = v;
    u.rate = 1;
    u.onend = function () {
      speaking = false;
      if (btn) { btn.classList.remove("on"); btn.textContent = "🔊 بخوان"; }
    };
    try { W.speechSynthesis.speak(u); } catch (e) { toast("خواندن ممکن نشد"); return; }
    speaking = true;
    if (btn) { btn.classList.add("on"); btn.textContent = "⏹ بس کن"; }
    toast("در حال خواندن — دوباره بزن تا بس کند");
  }
  function ttsButton() {
    if (!("speechSynthesis" in W)) return;
    if ($(".r9-tts")) return;
    // فقط روی صفحه‌هایی که متن درسی دارند نشان می‌دهیم
    var host = $("article.lesson") || $("main article") || $(".lesson");
    if (!host) return;
    var len = (host.innerText || "").length;
    if (len < 600) return;
    var b = D.createElement("button");
    b.type = "button";
    b.className = "r9-tts";
    b.textContent = "🔊 بخوان";
    b.title = "بلندخوانی متن این صفحه (Alt + R)";
    b.addEventListener("click", readAloud);
    D.body.appendChild(b);
  }

  /* ───────────── ۵. بن‌بست‌شکن: اگر صفحه‌ای خطا داد، کاربر گیر نکند ───────────── */
  function safetyNet() {
    W.addEventListener("error", function (ev) {
      // خطای اسکریپت خارجی نباید صفحه را از کار بیندازد
      if (ev && ev.target && ev.target.tagName === "SCRIPT") {
        try { console.warn("اسکریپت بار نشد:", ev.target.src); } catch (e) { }
      }
    }, true);
    var main = $("main");
    if (!main) return;
    // اگر بعد از ۴ ثانیه صفحه کاملاً خالی مانده بود، پیام راهنما نشان بده
    setTimeout(function () {
      try {
        var txt = (main.innerText || "").trim();
        if (txt.length > 40) return;
        var n = D.createElement("div");
        n.className = "card";
        n.style.cssText = "margin:18px auto;max-width:560px;text-align:center;padding:20px";
        n.innerHTML = '<div style="font-size:1.7rem">🔌</div><p style="margin:8px 0">محتوای این صفحه بار نشد.</p>' +
          '<p style="font-size:.84rem;color:var(--muted);margin:0 0 12px">اینترنت را بررسی کن و دوباره تلاش کن.</p>' +
          '<button type="button" class="rt-btn primary" onclick="location.reload()">تلاش دوباره</button>';
        main.appendChild(n);
      } catch (e) { }
    }, 4000);
  }

  function run() {
    [progressBar, lazyImages, shortcuts, ttsButton, safetyNet].forEach(function (fn) {
      try { fn(); } catch (e) { }
    });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", run);
  else run();
  W.R9 = { read: readAloud, help: null };
})();
