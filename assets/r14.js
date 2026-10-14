/* ==========================================================================
   رهنما — لایهٔ توانمندی‌ها (r14.js)
   --------------------------------------------------------------------------
   چیزهایی که یک سایتِ «حرفه‌ای» را از یک سایت معمولی جدا می‌کند:
     • پالت فرمان (Ctrl + K): جست‌وجو و رفتن به هر صفحه، بی‌دست‌زدن به منو
     • علاقه‌مندی‌ها: نشانه‌کردن هر صفحه و دیدنشان در یک جا
     • نصب اپلیکیشن (PWA) با یک کلیک
     • اشتراک‌گذاری صفحه با پیوند یا برنامه‌های گوشی
     • حالت تمرکز: پنهان‌کردن همهٔ حاشیه‌ها، فقط متن
     • خواندن درس با صدای بلند و تخمین زمان مطالعه
     • نشانگر قطع/وصل اینترنت
     • ذخیرهٔ خودکار نوشته‌های نیمه‌کاره (اگر صفحه بسته شود، از دست نمی‌رود)
   همه چیز محافظت‌شده است: اگر چیزی پشتیبانی نشود، بی‌صدا کنار می‌رود.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  if (!D || !W) return;

  var REDUCED = false;
  try { REDUCED = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }
  function LITE() { return D.body && D.body.classList.contains("r8-lite"); }
  var fa = function (n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9"[+d]; }); };
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function ready(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }

  /* ── انبار محلی با محافظ ────────────────────────────────────────────── */
  var store = {
    get: function (k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } },
    del: function (k) { try { W.localStorage.removeItem(k); } catch (e) { } }
  };
  var PATH = (location.pathname || "/").replace(/\/+$/, "") || "/index.html";

  /* ── نرمال‌سازی متن فارسی برای جست‌وجو ─────────────────────────────── */
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u200c\u200f\u200e]/g, "")
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[أإآا]/g, "ا")
      .replace(/[ؤو]/g, "و").replace(/[\u06f0-\u06f9]/g, function (d) { return String("\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9".indexOf(d)); })
      .replace(/\s+/g, " ").trim();
  }

  /* ══════════════ ۱. فهرست صفحه‌ها برای پالت فرمان ══════════════ */
  var SUBJECTS = {
    "7": [["math", "ریاضی"], ["science", "علوم تجربی"], ["farsi", "فارسی"], ["negaresh", "نگارش و انشا"], ["arabic", "عربی"], ["english", "زبان انگلیسی"], ["social", "مطالعات اجتماعی"], ["religion", "پیام‌های آسمان"], ["quran", "قرآن"], ["tech", "کار و فناوری"], ["art", "فرهنگ و هنر"], ["thinking", "تفکر و سبک زندگی"]],
    "8": [["math", "ریاضی"], ["science", "علوم تجربی"], ["farsi", "فارسی"], ["negaresh", "نگارش و انشا"], ["arabic", "عربی"], ["english", "زبان انگلیسی"], ["social", "مطالعات اجتماعی"], ["religion", "پیام‌های آسمان"], ["quran", "قرآن"], ["tech", "کار و فناوری"], ["art", "فرهنگ و هنر"], ["thinking", "تفکر و سبک زندگی"]],
    "9": [["math", "ریاضی"], ["science", "علوم تجربی"], ["farsi", "فارسی"], ["negaresh", "نگارش و انشا"], ["arabic", "عربی"], ["english", "زبان انگلیسی"], ["social", "مطالعات اجتماعی"], ["religion", "پیام‌های آسمان"], ["quran", "قرآن"], ["tech", "کار و فناوری"], ["art", "فرهنگ و هنر"], ["defa", "آمادگی دفاعی"]]
  };
  var GRADE_FA = { "7": "هفتم", "8": "هشتم", "9": "نهم" };

  function pageIndex() {
    var list = [
      { t: "خانه", d: "صفحهٔ اصلی رهنما", u: "index.html", i: "🏠", k: "home صفحه اصلی شروع" },
      { t: "جزوه‌ها", d: "همهٔ جزوه‌های پایه‌های هفتم، هشتم و نهم", u: "jozve.html", i: "📚", k: "جزوه درس" },
      { t: "جزوهٔ همکلاسی‌ها", d: "جزوه بگذار، عکس بگذار، ببین و بپسند", u: "jozve-share.html", i: "🧑‍🎓", k: "اشتراک عکس بارگذاری" },
      { t: "ابزارهای مطالعه", d: "فلش‌کارت، برنامهٔ مطالعه، ابزارهای درس", u: "study-tools.html", i: "🧰", k: "ابزار مطالعه" },
      { t: "جعبهٔ ابزار", d: "معدل، پومودورو، ماشین‌حساب، تبدیل یکا", u: "toolbox.html", i: "🧮", k: "ماشین حساب معدل پومودورو تایمر تبدیل" },
      { t: "ابزار PDF", d: "تبدیل، ادغام و ساخت PDF", u: "pdf-tools.html", i: "📄", k: "پی دی اف pdf چاپ" },
      { t: "زنگ تفریح", d: "گفت‌وگوی هم‌زمان بچه‌های رهنما", u: "community.html", i: "💬", k: "گفتگو پست چت" },
      { t: "آزمون جامع", d: "آزمون چهارگزینه‌ای و نمرهٔ فوری", u: "exam.html", i: "📝", k: "آزمون تست امتحان" },
      { t: "فلش‌کارت", d: "مرور سریع با کارت‌های پرسش و پاسخ", u: "flashcards.html", i: "🃏", k: "فلش کارت مرور" },
      { t: "دستیار هوشمند", d: "پرسیدن سؤال درسی از هوش مصنوعی", u: "ai.html", i: "🤖", k: "هوش مصنوعی دستیار سوال" },
      { t: "داشبورد مطالعه", d: "پیشرفت، زمان مطالعه و برنامهٔ روزانه", u: "dashboard.html", i: "📈", k: "داشبورد پیشرفت" },
      { t: "کارنامهٔ تحلیلی", d: "نتیجهٔ آزمون‌ها و نقطه‌ضعف‌ها", u: "report.html", i: "📊", k: "کارنامه نمره تحلیل" },
      { t: "پنل من", d: "تنظیمات و میان‌بُرهای شخصی", u: "panel.html", i: "🎛", k: "پنل تنظیمات" },
      { t: "کلاس مجازی", d: "کلاس آنلاین و حضور و غیاب", u: "class.html", i: "🎥", k: "کلاس آنلاین مجازی" },
      { t: "مشاورهٔ آنلاین", d: "گرفتن راهنمای درسی", u: "consult.html", i: "🎧", k: "مشاوره راهنما" },
      { t: "حساب من", d: "ورود، ثبت‌نام و اطلاعات حساب", u: "profile.html", i: "👤", k: "ورود ثبت نام حساب" },
      { t: "تنظیمات", d: "شخصی‌سازی ظاهر و امکانات", u: "settings.html", i: "⚙️", k: "تنظیمات" },
      { t: "پرسش‌های پرتکرار", d: "پاسخ پرسش‌های رایج", u: "faq.html", i: "❓", k: "سوال متداول راهنما" },
      { t: "قوانین و شرایط", d: "شرایط استفاده و قوانین محتوا", u: "terms.html", i: "⚖️", k: "قوانین شرایط حریم خصوصی مقررات" },
      { t: "دربارهٔ ما", d: "دربارهٔ رهنما و هدفش", u: "about.html", i: "ℹ️", k: "درباره تماس" },
      { t: "حریم خصوصی", d: "چه داده‌ای ذخیره می‌شود", u: "privacy.html", i: "🔒", k: "حریم خصوصی داده" },
      { t: "گزارش تخلف", d: "گزارش محتوای نامناسب به مدیر", u: "report-abuse.html", i: "🚩", k: "گزارش تخلف شکایت" }
    ];
    for (var g in SUBJECTS) {
      for (var i = 0; i < SUBJECTS[g].length; i++) {
        var s = SUBJECTS[g][i];
        list.push({
          t: s[1] + " — پایهٔ " + GRADE_FA[g],
          d: "جزوهٔ کامل، آزمون و جمع‌بندی",
          u: "jozve/" + g + "/" + s[0] + ".html",
          i: "📖",
          k: "جزوه " + s[1] + " پایه " + GRADE_FA[g] + " g" + g
        });
      }
    }
    return list;
  }

  /* ══════════════ ۲. پالت فرمان ══════════════ */
  var pal = null, palInput = null, palList = null, palItems = [], palSel = 0, palRows = [];

  function actions() {
    return [
      { t: "تغییر حالت روشن / تیره", d: "ظاهر سایت را عوض کن", i: "🌗", run: toggleTheme },
      { t: "حالت تمرکز", d: "فقط متن؛ حاشیه‌ها پنهان می‌شوند", i: "🎯", run: toggleFocus },
      { t: "این صفحه را نشان کن", d: "افزودن به علاقه‌مندی‌ها", i: "⭐", run: function () { toggleBookmark(true); } },
      { t: "اشتراک‌گذاری این صفحه", d: "پیوند را بفرست", i: "🔗", run: sharePage },
      { t: "نصب اپلیکیشن", d: "رهنما روی صفحهٔ خانه", i: "📲", run: function () { startInstall(); } },
      { t: "بازگشت به بالا", d: "رفتن به ابتدای صفحه", i: "⬆️", run: function () { W.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" }); } }
    ];
  }

  function buildPal() {
    pal = D.createElement("div");
    pal.className = "r14-pal";
    pal.setAttribute("role", "dialog");
    pal.setAttribute("aria-modal", "true");
    pal.setAttribute("aria-label", "جست‌وجوی سریع");
    pal.hidden = true;
    pal.innerHTML =
      '<div class="r14-pal-box">' +
        '<div class="r14-pal-in">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' +
          '<input type="search" placeholder="جست‌وجو در صفحه‌ها و ابزارها…" aria-label="جست‌وجو" autocomplete="off" spellcheck="false">' +
          '<kbd>Esc</kbd>' +
        '</div>' +
        '<ul class="r14-pal-list" role="listbox" aria-label="نتایج"></ul>' +
        '<div class="r14-pal-foot"><b>↑ ↓</b> جابه‌جایی · <b>Enter</b> رفتن · <b>Esc</b> بستن · <b>Ctrl K</b> باز کردن</div>' +
      '</div>';
    D.body.appendChild(pal);
    palInput = $("input", pal);
    palList = $(".r14-pal-list", pal);
    pal.addEventListener("click", function (e) { if (e.target === pal) closePal(); });
    palInput.addEventListener("input", function () { paintPal(palInput.value); });
    palInput.addEventListener("keydown", onPalKey);
    return pal;
  }

  function closePal() { if (pal) { pal.hidden = true; D.body.style.overflow = ""; } }
  function openPal() {
    if (!pal) buildPal();
    pal.hidden = false;
    D.body.style.overflow = "hidden";
    paintPal("");
    if (palInput) { palInput.value = ""; setTimeout(function () { palInput.focus(); }, 30); }
  }
  function togglePal() { if (pal && !pal.hidden) closePal(); else openPal(); }

  function paintPal(q) {
    var nq = norm(q);
    var items = pageIndex().concat(actions());
    palRows = [];
    if (nq) {
      var scored = [];
      for (var i = 0; i < items.length; i++) {
        var it = items[i], hay = norm(it.t + " " + (it.d || "") + " " + (it.k || ""));
        var pos = hay.indexOf(nq);
        if (pos < 0) continue;
        scored.push({ it: it, s: (norm(it.t).indexOf(nq) === 0 ? 0 : 1) * 100 + pos });
      }
      scored.sort(function (a, b) { return a.s - b.s; });
      palRows = scored.slice(0, 24).map(function (x) { return x.it; });
    } else {
      palRows = actions().slice(0, 4).concat(items.filter(function (x) { return !x.run; }).slice(0, 14));
    }
    if (!palRows.length) {
      palList.innerHTML = '<li class="r14-pal-empty">چیزی با «' + esc(q) + '» پیدا نشد.<br>مثلاً بنویس: ریاضی، آزمون، معدل</li>';
      palSel = 0; palItems = [];
      return;
    }
    var html = "", sec = "";
    palItems = [];
    for (var k = 0; k < palRows.length; k++) {
      var it = palRows[k], group = it.run ? "کارهای سریع" : "صفحه‌ها";
      if (group !== sec) { html += '<li class="r14-pal-sec">' + group + "</li>"; sec = group; }
      var idx = palItems.length;
      palItems.push(it);
      html += '<li role="option"><button type="button" class="r14-pal-item" data-i="' + idx + '" aria-selected="false">' +
        '<span class="r14-pal-ico">' + it.i + "</span>" +
        '<span class="r14-pal-tx"><b>' + esc(it.t) + "</b>" + (it.d ? "<span>" + esc(it.d) + "</span>" : "") + "</span>" +
        "</button></li>";
    }
    palList.innerHTML = html;
    palSel = 0;
    markSel();
    palList.onclick = function (e) {
      var b = e.target.closest ? e.target.closest(".r14-pal-item") : null;
      if (b) runItem(+b.getAttribute("data-i"));
    };
  }
  function markSel() {
    var btns = $$(".r14-pal-item", palList);
    for (var i = 0; i < btns.length; i++) {
      var on = i === palSel;
      btns[i].setAttribute("aria-selected", on ? "true" : "false");
      if (on && btns[i].scrollIntoView) btns[i].scrollIntoView({ block: "nearest" });
    }
  }
  function onPalKey(e) {
    if (e.key === "ArrowDown") { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); markSel(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); palSel = Math.max(0, palSel - 1); markSel(); }
    else if (e.key === "Enter") { e.preventDefault(); runItem(palSel); }
    else if (e.key === "Escape") { e.preventDefault(); closePal(); }
  }
  function runItem(i) {
    var it = palItems[i];
    if (!it) return;
    closePal();
    if (it.run) { try { it.run(); } catch (e) { } return; }
    location.href = it.u;
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ══════════════ ۳. حالت روشن/تیره ══════════════ */
  function toggleTheme() {
    var cur = D.documentElement.getAttribute("data-theme") || "light";
    var next = cur === "dark" ? "light" : "dark";
    D.documentElement.setAttribute("data-theme", next);
    store.set("r14:theme", next);
    /* دکمهٔ اصلی سایت هم اگر بود هم‌گام شود تا حالت دوتایی نشود */
    var btn = D.querySelector("[data-theme-toggle]");
    if (btn && btn.getAttribute) btn.setAttribute("data-theme", next);
    try { D.dispatchEvent(new CustomEvent("r14:theme", { detail: next })); } catch (e) { }
  }

  /* ══════════════ ۴. حالت تمرکز ══════════════ */
  function focusOn() { return D.body.classList.contains("r14-focus"); }
  function toggleFocus(force) {
    var on = typeof force === "boolean" ? force : !focusOn();
    D.body.classList.toggle("r14-focus", on);
    store.set("r14:focus", on);
    syncRail();
  }

  /* ══════════════ ۵. علاقه‌مندی‌ها ══════════════ */
  function bms() { return store.get("r14:bookmarks", []) || []; }
  function isBm(u) { return bms().indexOf(u) > -1; }
  function toggleBookmark(force) {
    var u = PATH;
    var list = bms();
    var i = list.indexOf(u);
    var want = typeof force === "boolean" ? force : i < 0;
    if (want && i < 0) list.unshift(u);
    else if (!want && i > -1) list.splice(i, 1);
    store.set("r14:bookmarks", list.slice(0, 200));
    syncRail();
    toast(want ? "به علاقه‌مندی‌ها اضافه شد ⭐" : "از علاقه‌مندی‌ها برداشته شد");
    return want;
  }

  /* ══════════════ ۶. اشتراک‌گذاری ══════════════ */
  function sharePage() {
    var data = { title: D.title, text: (D.querySelector('meta[name="description"]') || {}).content || D.title, url: location.href };
    if (W.navigator && navigator.share) {
      navigator.share(data).catch(function () { });
      return;
    }
    copy(location.href);
  }
  function copy(txt) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(txt).then(function () { toast("پیوند کپی شد 🔗"); }, function () { fallbackCopy(txt); });
        return;
      }
    } catch (e) { }
    fallbackCopy(txt);
  }
  function fallbackCopy(txt) {
    try {
      var t = D.createElement("textarea");
      t.value = txt; t.setAttribute("readonly", ""); t.style.position = "fixed"; t.style.opacity = "0";
      D.body.appendChild(t); t.select(); D.execCommand("copy"); D.body.removeChild(t);
      toast("پیوند کپی شد 🔗");
    } catch (e) { toast("کپی نشد؛ خودت از نوار آدرس بردار.", true); }
  }

  /* ══════════════ ۷. نصب اپلیکیشن (PWA) ══════════════ */
  var installEvt = null, installBar = null;
  function installable() {
    if (W.matchMedia && W.matchMedia("(display-mode: standalone)").matches) return false;
    if (D.body && D.body.classList.contains("is-app")) return false;
    return !!installEvt;
  }
  function startInstall() {
    if (!installEvt) { toast("از منوی مرورگر «افزودن به صفحهٔ خانه» را بزن.", true); return; }
    var e = installEvt;
    installEvt = null;
    try { e.prompt(); } catch (err) { }
    if (e.userChoice && e.userChoice.then) {
      e.userChoice.then(function (r) {
        toast(r && r.outcome === "accepted" ? "نصب شد! آیکون رهنما روی صفحه‌ات آمد 📲" : "باشه، بعداً.");
        syncRail();
      });
    }
  }
  function showInstallBar() {
    store.del("r14:installSnooze");
    syncRail();
  }
  W.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    installEvt = e;
    if (!store.get("r14:installed", false)) showInstallBar();
  });
  W.addEventListener("appinstalled", function () {
    installEvt = null;
    store.set("r14:installed", true);
    if (installBar && installBar.parentNode) installBar.parentNode.removeChild(installBar);
    installBar = null;
    syncRail();
  });

  /* ══════════════ ۸. نشانگر اینترنت ══════════════ */
  function netBar() {
    var el = D.createElement("div");
    el.className = "r14-net";
    el.setAttribute("aria-live", "polite");
    D.body.appendChild(el);
    var hideT = null;
    function show(txt, ok, keep) {
      el.textContent = txt;
      el.className = "r14-net " + (ok ? "r14-ok" : "") + (txt ? " r14-on" : "");
      D.body.classList.toggle("r14-offline", !!txt && !ok);
      clearTimeout(hideT);
      if (txt && ok && !keep) hideT = setTimeout(hide, 3200);
    }
    function hide() { el.className = "r14-net" + (el.className.indexOf("r14-ok") > -1 ? " r14-ok" : ""); D.body.classList.remove("r14-offline"); }
    function check() { if (!navigator.onLine) show("اتصال اینترنت قطع است — نسخهٔ ذخیره‌شده نشان داده می‌شود", false, true); else hide(); }
    W.addEventListener("offline", check);
    W.addEventListener("online", function () { show("اتصال برگشت ✅", true, false); setTimeout(check, 3300); });
    check();
  }

  /* ══════════════ ۹. زره ابزار کنار صفحه ══════════════ */
  var rail = null;
  function fab(name, label, pressed, hideSm) {
    var b = D.createElement("button");
    b.type = "button";
    b.className = "r14-fab" + (hideSm ? " r14-hide-sm" : "");
    b.setAttribute("data-r14f", name);
    b.setAttribute("aria-label", label);
    b.setAttribute("title", label);
    if (pressed != null) b.setAttribute("aria-pressed", pressed ? "true" : "false");
    return b;
  }
  var ICON = {
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m12 4 2.4 5 5.6.8-4 3.9 1 5.5-5-2.7-5 2.7 1-5.5-4-3.9 5.6-.8Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5" r="2.6"/><circle cx="6" cy="12" r="2.6"/><circle cx="18" cy="19" r="2.6"/><path d="m8.3 10.7 7.4-4.3M8.3 13.3l7.4 4.3"/></svg>',
    focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.6"/></svg>',
    install: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v10M8 10l4 4 4-4"/><path d="M5 18h14"/></svg>',
    report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 5h11l-1.6 4L16 13H5"/></svg>'
  };
  function buildRail() {
    rail = D.createElement("div");
    rail.className = "r14-rail";
    rail.setAttribute("role", "group");
    rail.setAttribute("aria-label", "ابزارهای سریع");
    D.body.appendChild(rail);

    var bSearch = fab("search", "جست‌وجوی سریع (Ctrl + K)");
    bSearch.innerHTML = ICON.search;
    bSearch.addEventListener("click", openPal);
    rail.appendChild(bSearch);

    var bStar = fab("star", "افزودن به علاقه‌مندی‌ها", isBm(PATH));
    bStar.innerHTML = ICON.star;
    bStar.addEventListener("click", function () { toggleBookmark(); });
    rail.appendChild(bStar);

    var bShare = fab("share", "اشتراک‌گذاری این صفحه", null, true);
    bShare.innerHTML = ICON.share;
    bShare.addEventListener("click", sharePage);
    rail.appendChild(bShare);

    if ($$("article.lesson, .lesson, .jz-card, .panel-body").length) {
      var bFocus = fab("focus", "حالت تمرکز: فقط متن", focusOn(), true);
      bFocus.innerHTML = ICON.focus;
      bFocus.addEventListener("click", function () { toggleFocus(); });
      rail.appendChild(bFocus);
    }

    var bInstall = fab("install", "نصب اپلیکیشن رهنما", null, true);
    bInstall.innerHTML = ICON.install;
    bInstall.hidden = !installable();
    bInstall.addEventListener("click", startInstall);
    rail.appendChild(bInstall);

    var bReport = fab("report", "گزارش محتوای نامناسب", null, true);
    bReport.innerHTML = ICON.report;
    bReport.addEventListener("click", function () { location.href = "report-abuse.html?url=" + encodeURIComponent(location.pathname); });
    rail.appendChild(bReport);

    syncRail();
  }
  function syncRail() {
    if (!rail) return;
    var st = $('[data-r14f="star"]', rail);
    if (st) st.setAttribute("aria-pressed", isBm(PATH) ? "true" : "false");
    var fc = $('[data-r14f="focus"]', rail);
    if (fc) fc.setAttribute("aria-pressed", focusOn() ? "true" : "false");
    var ins = $('[data-r14f="install"]', rail);
    if (ins) ins.hidden = !installable();
  }

  /* ══════════════ ۱۰. نشانهٔ علاقه‌مندی روی کارت‌ها ══════════════ */
  function decorateCards() {
    var cards = $$("a.subject-card[href], a.tool-card[href], a[data-r14-bm]");
    for (var i = 0; i < cards.length; i++) {
      (function (a) {
        if (a.getAttribute("data-r14sb") === "1") return;
        a.setAttribute("data-r14sb", "1");
        /* فقط پیوندهای درون‌سایتی */
        var href = a.getAttribute("href") || "";
        if (/^(https?:|mailto:|tel:|#)/.test(href)) return;
        try {
          if (a.style) a.style.position = a.style.position || "relative";
          var b = D.createElement("button");
          b.type = "button";
          b.className = "r14-star";
          b.setAttribute("aria-pressed", isBm(href) ? "true" : "false");
          b.setAttribute("aria-label", "افزودن به علاقه‌مندی‌ها");
          b.setAttribute("title", "افزودن به علاقه‌مندی‌ها");
          b.innerHTML = ICON.star;
          b.addEventListener("click", function (e) {
            e.preventDefault(); e.stopPropagation();
            var list = bms(), ix = list.indexOf(href), want = ix < 0;
            if (want) list.unshift(href); else list.splice(ix, 1);
            store.set("r14:bookmarks", list.slice(0, 200));
            b.setAttribute("aria-pressed", want ? "true" : "false");
            toast(want ? "به علاقه‌مندی‌ها اضافه شد ⭐" : "از علاقه‌مندی‌ها برداشته شد");
          });
          a.appendChild(b);
        } catch (e) { }
      })(cards[i]);
    }
  }

  /* ══════════════ ۱۱. زمان مطالعه + خواندن با صدا ══════════════ */
  function readingTools() {
    var arts = $$("article.lesson");
    if (!arts.length) return;
    var canSpeak = !!(W.speechSynthesis && W.SpeechSynthesisUtterance);
    for (var i = 0; i < arts.length; i++) {
      (function (art) {
        var head = art.querySelector(".lesson-head");
        if (!head || head.getAttribute("data-r14read") === "1") return;
        head.setAttribute("data-r14read", "1");

        var text = (art.textContent || "").replace(/\s+/g, " ").trim();
        var words = text ? text.split(" ").length : 0;
        if (words < 120) return;
        var mins = Math.max(1, Math.round(words / 200));

        var kick = head.querySelector(".lesson-kicker") || head;
        var chip = D.createElement("span");
        chip.className = "r14-minutes";
        chip.textContent = "⏱ " + fa(mins) + " دقیقه مطالعه";
        kick.appendChild(chip);

        if (!canSpeak) return;
        var btn = D.createElement("button");
        btn.type = "button";
        btn.className = "r14-read";
        btn.setAttribute("aria-pressed", "false");
        btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/></svg> خواندن با صدا';
        btn.addEventListener("click", function () {
          if (btn.getAttribute("aria-pressed") === "true") {
            try { W.speechSynthesis.cancel(); } catch (e) { }
            btn.setAttribute("aria-pressed", "false");
            return;
          }
          try { W.speechSynthesis.cancel(); } catch (e) { }
          var u = new W.SpeechSynthesisUtterance(text.slice(0, 4000));
          u.lang = "fa-IR";
          u.rate = 0.95;
          u.onend = u.onerror = function () { btn.setAttribute("aria-pressed", "false"); };
          btn.setAttribute("aria-pressed", "true");
          W.speechSynthesis.speak(u);
        });
        kick.appendChild(btn);
      })(arts[i]);
    }
    W.addEventListener("pagehide", function () { try { W.speechSynthesis.cancel(); } catch (e) { } });
  }

  /* ══════════════ ۱۲. ذخیرهٔ خودکار نوشتهٔ نیمه‌کاره ══════════════ */
  function drafts() {
    var fields = $$("[data-draft]");
    if (!fields.length) return;
    var key = "r14:draft:" + PATH + ":";
    for (var i = 0; i < fields.length; i++) {
      (function (f) {
        var k = key + (f.getAttribute("data-draft") || f.id || i);
        var saved = store.get(k, null);
        if (saved && !f.value && !f.disabled) {
          f.value = saved;
          f.setAttribute("data-r14-restored", "1");
        }
        var t = null;
        f.addEventListener("input", function () {
          clearTimeout(t);
          t = setTimeout(function () {
            if (f.value && f.value.trim()) store.set(k, f.value);
            else store.del(k);
          }, 700);
        });
        var form = f.closest ? f.closest("form") : null;
        if (form) form.addEventListener("submit", function () { store.del(k); });
      })(fields[i]);
    }
  }

  /* ══════════════ ۱۳. پیام کوتاه ══════════════ */
  var toastBox = null, toastT = null;
  function toast(msg, bad) {
    if (!toastBox) {
      toastBox = D.createElement("div");
      toastBox.style.cssText = "position:fixed;inset-inline:0;bottom:24px;z-index:700;display:flex;justify-content:center;pointer-events:none";
      D.body.appendChild(toastBox);
    }
    toastBox.innerHTML = '<div style="padding:11px 19px;border-radius:14px;font-size:.85rem;font-weight:600;color:#fff;' +
      "background:" + (bad ? "linear-gradient(135deg,#b4232b,#e0533f)" : "linear-gradient(135deg,#1f2440,#2d3358)") +
      ';box-shadow:0 18px 44px -18px rgba(8,10,24,.6)">' + esc(msg) + "</div>";
    clearTimeout(toastT);
    toastT = setTimeout(function () { if (toastBox) toastBox.innerHTML = ""; }, 3000);
  }

  /* ══════════════ ۱۴. میان‌بُرهای کیبورد ══════════════ */
  function shortcuts() {
    D.addEventListener("keydown", function (e) {
      var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      var typing = tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable);

      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault(); togglePal(); return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "/") { e.preventDefault(); togglePal(); return; }
      if (e.key === "Escape" && pal && !pal.hidden) { e.preventDefault(); closePal(); return; }
      if (typing) return;
      if (e.key === "/") {
        var g = D.querySelector("#globalSearch, .searchbox input[type=search], input[type=search]");
        if (g) { e.preventDefault(); g.focus(); }
        return;
      }
      if (e.key === "?" || (e.shiftKey && e.key === "/")) { e.preventDefault(); openPal(); }
    });
  }

  /* ══════════════ ۱۵. گرم‌کردن آرام حافظهٔ نهان ══════════════ */
  function warmCache() {
    var go = function () {
      try {
        var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        if (c && (c.saveData || /(^|-)2g/.test(c.effectiveType || ""))) return;
      } catch (e) { }
      try {
        var sw = navigator.serviceWorker;
        if (sw && sw.controller) sw.controller.postMessage({ type: "WARM" });
      } catch (e) { }
    };
    if (W.requestIdleCallback) W.requestIdleCallback(go, { timeout: 6000 });
    else setTimeout(go, 4000);
  }

  /* ══════════════ راه‌اندازی ══════════════ */
  ready(function () {
    var theme = store.get("r14:theme", null);
    if (theme && D.documentElement.getAttribute("data-theme") !== theme) D.documentElement.setAttribute("data-theme", theme);
    if (store.get("r14:focus", false)) D.body.classList.add("r14-focus");

    try { buildRail(); } catch (e) { }
    try { netBar(); } catch (e) { }
    try { shortcuts(); } catch (e) { }
    try { decorateCards(); } catch (e) { }
    try { readingTools(); } catch (e) { }
    try { drafts(); } catch (e) { }
    try { warmCache(); } catch (e) { }

    /* اگر کاربر روی خطای صفحهٔ قبلی آمد، بی‌صدا اطلاع بده */
    try { if (location.search.indexOf("offline=1") > -1) toast("نسخهٔ ذخیره‌شده نشان داده شد.", true); } catch (e) { }
  });

  /* رخداد عمومی برای بخش‌های دیگر سایت */
  W.R14 = {
    palette: openPal,
    toast: toast,
    bookmark: toggleBookmark,
    focus: toggleFocus,
    share: sharePage,
    bookmarks: bms
  };
})();
