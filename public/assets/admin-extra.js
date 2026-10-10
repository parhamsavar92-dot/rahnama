/* ==========================================================================
   رهنما — گسترش پنل مالک  |  admin-extra.js
   --------------------------------------------------------------------------
   تب‌ها و کنش‌های تازهٔ پنل مالک: ویژگی‌ها، محتوا و ظاهر، آزمون، پیام به
   کاربران، گزارش و رتبه‌بندی، عملیات گروهی، امنیت و نشست‌ها، داده و پشتیبان
   و یک نوار «کنش سریع». همه با سرورِ داخلی سایت کار می‌کنند (بدون ۴۰۴).
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!D.getElementById("admBody")) return;

  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (n) { return String(n == null ? "" : n).replace(/\d/g, function (d) { return NFA[+d]; }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  function toast(m) { if (W.HK && W.HK.toast) W.HK.toast(m); else console.log(m); }
  function api(method, path, body) {
    var opt = { method: method, headers: { "X-HK": "1" }, credentials: "same-origin" };
    if (method !== "GET") { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body || {}); }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ("خطا " + r.status)); throw e; }
        return j;
      });
    });
  }
  var ME = null, ROLE = null;
  var isOwner = function () { return !!(ME && (ME.isOwner || ME.role === "owner")); };

  /* ------------------------------------------------------------ تب و صفحه */
  var TABS = [
    { n: "quick", t: "⚡ کنش سریع", owner: false },
    { n: "flags", t: "🧩 ویژگی‌ها و دسترسی", owner: false },
    { n: "content", t: "🎨 محتوا و ظاهر", owner: false },
    { n: "exams", t: "📝 آزمون و کارنامه", owner: false },
    { n: "broadcast", t: "📨 پیام به کاربران", owner: false },
    { n: "bulk", t: "☑ عملیات گروهی", owner: false },
    { n: "reports", t: "📊 گزارش و رتبه‌بندی", owner: false },
    { n: "security", t: "🔐 امنیت و نشست‌ها", owner: true },
    { n: "data", t: "🗄 داده و پشتیبان", owner: true }
  ];

  function injectTabs() {
    var nav = $("#admSide .adm-nav") || $(".adm-nav");
    if (!nav || nav.getAttribute("data-extra")) return;
    nav.setAttribute("data-extra", "1");
    var frag = "";
    TABS.forEach(function (x) {
      frag += '<button type="button" data-nav="' + x.n + '"' + (x.owner ? " data-admin-only" : "") + '><span class="ic"></span> ' + x.t + "</button>";
    });
    nav.insertAdjacentHTML("beforeend", frag);
  }

  function pane(n, inner) {
    return '<section class="adm-pane" data-pane="' + n + '" hidden>' + inner + "</section>";
  }
  function toggleRow(key, title, desc, on) {
    return '<div class="adm-switch" style="cursor:pointer"><span class="info"><b>' + title + "</b><small>" + desc +
      '</small></span><span class="adm-toggle' + (on ? " on" : "") + '" data-flag="' + key + '" role="switch"></span></div>';
  }

  var FLAGS = [
    ["klass", "کلاس مجازی", "ساخت کلاس، جلسهٔ زندهٔ آنلاین، تخته، نظرسنجی و حضور و غیاب."],
    ["exam", "آزمون جامع", "آزمون چهارگزینه‌ای از ۳۶ کتاب با نمره و کارنامهٔ آنلاین."],
    ["flashcards", "فلش‌کارت", "مرور فعال واژه‌ها و نکته‌های کلیدی هر درس."],
    ["ai", "دستیار هوشمند", "پرسش و پاسخ از محتوای درس‌ها به‌صورت آنلاین."],
    ["consult", "مشاورهٔ آنلاین", "درخواست مشاوره و گفت‌وگو با مشاور."],
    ["report", "کارنامهٔ من", "نمودار پیشرفت، نمرهٔ آزمون‌ها و ذخیرهٔ مطالعه."],
    ["messenger", "پیام‌رسان مدرسه", "پیام خصوصی میان دانش‌آموز، دبیر و مدیر."],
    ["pdf", "خروجی PDF جزوه", "ساخت فایل چاپی از هر درس."],
    ["signup", "ثبت‌نام کاربر تازه", "اگر خاموش شود فقط حساب‌های موجود وارد می‌شوند."],
    ["tick", "تیک آبی تأییدشده", "نمایش نشان تأیید کنار نام کاربران تأییدشده."],
    ["leaderboard", "جدول رتبه‌بندی", "نمایش شاگردان برتر بر پایهٔ زمان مطالعه و آزمون."],
    ["notes", "یادداشت‌گذاری", "امکان نوشتن یادداشت روی هر درس."],
    ["highlight", "هایلایت متن", "رنگ‌کردن نکته‌های مهم درس‌ها."],
    ["speak", "بلندخوانی درس", "خواندن متن درس با صدای مرورگر."],
    ["guestView", "مشاهدهٔ مهمان", "دیدن جزوه‌ها بدون حساب کاربری."],
    ["darkMode", "حالت شب", "پوستهٔ تیرهٔ سایت."]
  ];

  function buildPanes() {
    var main = $(".adm-main") || $("[data-pane]").parentNode;
    if (!main || main.getAttribute("data-extra")) return;
    main.setAttribute("data-extra", "1");

    var html = "";

    /* ---------------- کنش سریع ---------------- */
    html += pane("quick",
      '<div class="card"><h4><span class="card-icon">⚡</span> کنش‌های سریع مالک</h4>' +
      '<p style="font-size:.86rem;color:var(--muted)">با یک کلیک، مهم‌ترین کارهای مدیریتی سایت را انجام بده. هر کنش بلافاصله اعمال و ثبت می‌شود.</p>' +
      '<div class="adm-actions" id="qeActions" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:12px">' +
      '<button class="btn btn-ghost btn-sm" data-qe="flag:klass:1">روشن‌کردن کلاس مجازی</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="flag:klass:0">خاموش‌کردن کلاس مجازی</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="flag:exam:1">روشن‌کردن آزمون جامع</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="flag:ai:1">روشن‌کردن دستیار هوشمند</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="reg:0">بستن ثبت‌نام</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="reg:1">بازکردن ثبت‌نام</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="maint:1">روشن‌کردن حالت تعمیر</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="maint:0">خاموش‌کردن حالت تعمیر</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="ann:on">فعال‌کردن اعلان سراسری</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="ann:off">خاموش‌کردن اعلان</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="export:users">خروجی کاربران</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="export:progress">خروجی پیشرفت</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="export:all">بکاپ کامل</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="rank">رتبه‌بندی مطالعه</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="clearcache">پاک‌کردن کش سایت</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="reset:progress">صفر کردن پیشرفت همه</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="reset:reports">پاک‌کردن کارنامه‌ها</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="prune:90">پاک‌سازی رویدادهای قدیمی</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="logoutall">خروج همهٔ نشست‌ها</button>' +
      '<button class="btn btn-ghost btn-sm" data-qe="reloadall">تازه‌سازی همه</button>' +
      '</div>' +
      '<div class="grid-3 mt-3" id="qeStats"></div></div>' +
      '<div class="card"><h4><span class="card-icon">◆</span> نتیجه</h4><div class="adm-log" id="qeLog"><p style="color:var(--muted)">هنوز کنشی اجرا نشده است.</p></div></div>');

    /* ---------------- ویژگی‌ها ---------------- */
    html += pane("flags",
      '<div class="card"><div class="flex" style="align-items:center;gap:10px;flex-wrap:wrap">' +
      '<h4 style="margin:0"><span class="card-icon">🧩</span> ویژگی‌ها و دسترسی‌ها</h4>' +
      '<span style="margin-inline-start:auto"></span>' +
      '<button class="btn btn-ghost btn-sm" id="flAllOn">همه روشن</button>' +
      '<button class="btn btn-ghost btn-sm" id="flAllOff">همه خاموش</button>' +
      '<button class="btn btn-primary btn-sm" id="flSave">ذخیره</button></div>' +
      '<div id="flGrid" class="mt-3">' +
      FLAGS.map(function (f) { return toggleRow(f[0], f[1], f[2], true); }).join("") +
      '</div></div>');

    /* ---------------- محتوا و ظاهر ---------------- */
    html += pane("content",
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">🎨</span> متن‌های اصلی سایت</h4>' +
      '<div class="hk-field"><label>تیتر اصلی صفحهٔ خانه</label><input id="ctTitle" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>زیرتیتر</label><input id="ctSub" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>جملهٔ وضعیت (روی همهٔ صفحه‌ها)</label><input id="ctNotice" placeholder="کاملاً آنلاین" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>رنگ اصلی سایت</label><div class="flex" style="gap:8px;align-items:center"><input id="ctTheme" type="color" style="width:52px;height:38px;border:0;background:none;cursor:pointer"><input id="ctThemeHex" dir="ltr" style="flex:1;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div></div>' +
      '<button class="btn btn-primary btn-sm" id="ctSave">ذخیرهٔ محتوا</button> ' +
      '<button class="btn btn-ghost btn-sm" id="ctDefault">بازگردانی پیش‌فرض</button></div>' +
      '<div class="card"><h4><span class="card-icon">☎</span> راه‌های تماس</h4>' +
      '<div class="hk-field"><label>ایمیل</label><input id="ctEmail" dir="ltr" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>تلگرام</label><input id="ctTelegram" dir="ltr" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>اینستاگرام</label><input id="ctInstagram" dir="ltr" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>شمارهٔ تماس</label><input id="ctPhone" dir="ltr" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<button class="btn btn-primary btn-sm" id="ctSave2">ذخیرهٔ تماس</button></div></div>');

    /* ---------------- آزمون ---------------- */
    html += pane("exams",
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">📝</span> پیش‌فرض آزمون جامع</h4>' +
      '<div class="hk-field"><label>شمار پرسش هر آزمون</label><input id="exCount" type="number" min="5" max="100" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>زمان (دقیقه)</label><input id="exMinutes" type="number" min="1" max="180" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>حد نصاب قبولی (٪)</label><input id="exPass" type="number" min="0" max="100" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<button class="btn btn-primary btn-sm" id="exSave">ذخیرهٔ پیش‌فرض‌ها</button></div>' +
      '<div class="card"><h4><span class="card-icon">🧹</span> مدیریت کارنامه‌ها</h4>' +
      '<p style="font-size:.86rem;color:var(--muted)">کارنامه‌ها و پیشرفت مطالعهٔ کاربران را بازنشانی کن.</p>' +
      '<div class="adm-actions">' +
      '<button class="btn btn-ghost btn-sm" id="exClearReports">پاک‌کردن همهٔ کارنامه‌ها</button>' +
      '<button class="btn btn-ghost btn-sm" id="exResetAll">صفر کردن پیشرفت همهٔ کاربران</button>' +
      '</div>' +
      '<div class="hk-field mt-3"><label>صفر کردن پیشرفت یک کاربر (ایمیل)</label>' +
      '<input id="exUser" dir="ltr" placeholder="user1@rahnama.ir" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<button class="btn btn-ghost btn-sm" id="exResetOne">صفر کردن این کاربر</button></div></div>');

    /* ---------------- پیام به کاربران ---------------- */
    html += pane("broadcast",
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">📨</span> فرستادن پیام</h4>' +
      '<div class="hk-field"><label>موضوع</label><input id="bcTitle" placeholder="مثلاً: شروع آزمون میان‌ترم" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<div class="hk-field"><label>متن پیام</label><textarea id="bcText" rows="4" style="width:100%;padding:11px 13px;border-radius:12px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit;resize:vertical"></textarea></div>' +
      '<div class="hk-field"><label>مخاطب</label><select id="bcTo" class="chip" style="padding:9px 12px;font-weight:800"><option value="all">همهٔ کاربران</option><option value="7">پایهٔ هفتم</option><option value="8">پایهٔ هشتم</option><option value="9">پایهٔ نهم</option><option value="teacher">دبیران</option></select></div>' +
      '<button class="btn btn-primary btn-sm" id="bcSend">ارسال پیام</button></div>' +
      '<div class="card"><h4><span class="card-icon">🗂</span> پیام‌های فرستاده‌شده</h4><div class="adm-log" id="bcList"></div></div></div>');

    /* ---------------- عملیات گروهی ---------------- */
    html += pane("bulk",
      '<div class="card"><h4><span class="card-icon">☑</span> عملیات گروهی روی کاربران</h4>' +
      '<p style="font-size:.86rem;color:var(--muted)">کاربران را تیک بزن، سپس یک کنش را روی همه اعمال کن.</p>' +
      '<div class="adm-actions" style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0">' +
      '<button class="btn btn-ghost btn-sm" id="bkAll">انتخاب همه</button>' +
      '<button class="btn btn-ghost btn-sm" id="bkNone">حذف انتخاب</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="verify" data-v="1">دادن تیک آبی</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="verify" data-v="0">برداشتن تیک آبی</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="ban" data-v="1">مسدود کردن</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="ban" data-v="0">آزاد کردن</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="grade" data-v="7">پایه ۷</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="grade" data-v="8">پایه ۸</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="grade" data-v="9">پایه ۹</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="role" data-v="student">دانش‌آموز</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="role" data-v="teacher">دبیر</button>' +
      '<button class="btn btn-ghost btn-sm" data-bk="role" data-v="admin">مدیر</button>' +
      '</div><div id="bkList"></div></div>');

    /* ---------------- گزارش‌ها ---------------- */
    html += pane("reports",
      '<div class="card"><h4><span class="card-icon">📊</span> گزارش‌ها و خروجی</h4>' +
      '<div class="adm-actions" style="display:flex;flex-wrap:wrap;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" id="rpRank">رتبه‌بندی مطالعه</button>' +
      '<button class="btn btn-ghost btn-sm" id="rpUsers">خروجی کاربران (CSV)</button>' +
      '<button class="btn btn-ghost btn-sm" id="rpProgress">خروجی پیشرفت (CSV)</button>' +
      '<button class="btn btn-ghost btn-sm" id="rpEvents">خروجی رویدادها (CSV)</button>' +
      '<button class="btn btn-ghost btn-sm" id="rpAudit">خروجی گزارش اقدامات (CSV)</button>' +
      '<button class="btn btn-ghost btn-sm" id="rpAll">پشتیبان کامل (JSON)</button>' +
      '</div><div id="rpTable" class="mt-3"></div></div>');

    /* ---------------- امنیت ---------------- */
    html += pane("security",
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">🔐</span> نشست‌های فعال</h4>' +
      '<div id="scSessions" class="adm-log"></div>' +
      '<button class="btn btn-ghost btn-sm mt-3" id="scLogoutAll">خروج همهٔ نشست‌ها</button></div>' +
      '<div class="card"><h4><span class="card-icon">🔑</span> رمز حساب مالک</h4>' +
      '<div class="hk-field"><label>رمز تازه</label><input id="scPass" type="password" dir="ltr" style="width:100%;padding:10px 12px;border-radius:11px;border:1px solid var(--border-strong);background:var(--surface-2);color:var(--text);font:inherit"></div>' +
      '<button class="btn btn-primary btn-sm" id="scPassSave">تغییر رمز</button>' +
      '<h4 class="mt-3"><span class="card-icon">⛔</span> کاربران مسدود</h4>' +
      '<div id="scBanned" class="adm-log"></div></div></div>');

    /* ---------------- داده و پشتیبان ---------------- */
    html += pane("data",
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">🗄</span> پشتیبان‌گیری</h4>' +
      '<p style="font-size:.86rem;color:var(--muted)">یک فایل JSON از همهٔ حساب‌ها، تنظیمات، کلاس‌ها و گزارش‌ها بگیر و جای امن نگه دار.</p>' +
      '<button class="btn btn-primary btn-sm" id="dtBackup">گرفتن پشتیبان کامل</button> ' +
      '<button class="btn btn-ghost btn-sm" id="dtSize">حجم داده</button>' +
      '<div id="dtInfo" class="mt-3" style="font-size:.85rem;color:var(--muted)"></div></div>' +
      '<div class="card"><h4><span class="card-icon">♻</span> بازگردانی و بازنشانی</h4>' +
      '<div class="hk-field"><label>فایل پشتیبان (JSON)</label><input id="dtFile" type="file" accept=".json,application/json"></div>' +
      '<button class="btn btn-primary btn-sm" id="dtRestore">بازگردانی از فایل</button>' +
      '<hr style="opacity:.2;margin:14px 0">' +
      '<button class="btn btn-ghost btn-sm" id="dtReset">بازگشت به دادهٔ اولیه</button> ' +
      '<button class="btn btn-ghost btn-sm" id="dtCache">پاک‌کردن کش و سرویس‌ورکر</button></div></div>');

    main.insertAdjacentHTML("beforeend", html);
  }

  /* ------------------------------------------------------------ بارگذاری داده‌ها */
  function loadFlags() {
    return api("GET", "/api/admin/stats").then(function (r) {
      var f = (r.settings && r.settings.features) || {};
      $$("[data-flag]").forEach(function (el) { el.classList.toggle("on", f[el.getAttribute("data-flag")] !== false); });
      var s = r.settings || {};
      if ($("#exCount")) { $("#exCount").value = (s.examDefaults || {}).count || 20; $("#exMinutes").value = (s.examDefaults || {}).minutes || 15; $("#exPass").value = (s.examDefaults || {}).pass || 60; }
      var h = s.hero || {}, c = s.contact || {};
      if ($("#ctTitle")) {
        $("#ctTitle").value = h.title || ""; $("#ctSub").value = h.sub || ""; $("#ctNotice").value = s.siteNotice || "";
        $("#ctTheme").value = s.theme || "#6d5efc"; $("#ctThemeHex").value = s.theme || "#6d5efc";
        $("#ctEmail").value = c.email || ""; $("#ctTelegram").value = c.telegram || ""; $("#ctInstagram").value = c.instagram || ""; $("#ctPhone").value = c.phone || "";
      }
    });
  }
  function saveFlags() {
    var f = {};
    $$("[data-flag]").forEach(function (el) { f[el.getAttribute("data-flag")] = el.classList.contains("on"); });
    return api("POST", "/api/admin/flags", { flags: f }).then(function () { toast("ویژگی‌ها ذخیره شد"); paintQuick(); });
  }

  function paintQuick() {
    if (!$("#qeStats")) return;
    api("GET", "/api/admin/stats").then(function (r) {
      var s = r.stats;
      $("#qeStats").innerHTML =
        '<div class="card"><h4 style="margin:0 0 6px"><span class="card-icon">👥</span> کاربران</h4><b style="font-size:1.5rem">' + fa(s.users.total) + '</b><p style="color:var(--muted);font-size:.82rem">آنلاین ۱۵ دقیقه: ' + fa(s.activity.activeNow) + " · مسدود: " + fa(s.users.banned) + "</p></div>" +
        '<div class="card"><h4 style="margin:0 0 6px">🎓 <span class="card-icon"></span> کلاس‌ها</h4><b style="font-size:1.5rem">' + fa(s.activity.classes) + '</b><p style="color:var(--muted);font-size:.82rem">جلسهٔ زنده: ' + fa(s.activity.sessions) + "</p></div>" +
        '<div class="card"><h4 style="margin:0 0 6px">📚 مطالعه</h4><b style="font-size:1.5rem">' + fa(s.learning.studyMinutes) + ' دقیقه</b><p style="color:var(--muted);font-size:.82rem">درس خوانده: ' + fa(s.learning.lessonsRead) + " · آزمون: " + fa(s.learning.exams) + "</p></div>";
    });
  }
  function qlog(m) { var el = $("#qeLog"); if (el) el.insertAdjacentHTML("afterbegin", '<div class="adm-ev"><span class="k">کنش</span><span class="t">' + esc(m) + "</span></div>"); }

  function quick(cmd) {
    var p = cmd.split(":");
    if (p[0] === "flag") return api("POST", "/api/admin/flags", { flags: (function () { var o = {}; o[p[1]] = p[2] === "1"; return o; })() }).then(function () { toast("اعمال شد"); qlog("ویژگی " + p[1] + " → " + (p[2] === "1" ? "روشن" : "خاموش")); loadFlags(); });
    if (p[0] === "reg") return api("POST", "/api/admin/settings", { registrationOpen: p[1] === "1" }).then(function () { toast("ثبت‌نام " + (p[1] === "1" ? "باز" : "بسته") + " شد"); qlog("ثبت‌نام " + (p[1] === "1" ? "باز" : "بسته")); });
    if (p[0] === "maint") return api("POST", "/api/admin/maintenance", { on: p[1] === "1" }).then(function () { toast("حالت تعمیر " + (p[1] === "1" ? "روشن" : "خاموش")); qlog("حالت تعمیر"); });
    if (p[0] === "ann") return api("POST", "/api/admin/announce", { active: p[1] === "on", level: "info", text: $("#anText") ? $("#anText").value : "به رهنما خوش آمدید" }).then(function () { toast("اعلان به‌روز شد"); qlog("اعلان " + p[1]); });
    if (p[0] === "export") { W.HKServer.downloadExport(p[1]); toast("فایل ساخته شد"); qlog("خروجی " + p[1]); return Promise.resolve(); }
    if (p[0] === "rank") { showPane("reports"); return loadRank(); }
    if (p[0] === "clearcache") return clearCache();
    if (p[0] === "reset") return api("POST", p[1] === "reports" ? "/api/admin/reports/clear" : "/api/admin/reset-progress", { all: true }).then(function () { toast("انجام شد"); qlog("بازنشانی " + p[1]); paintQuick(); });
    if (p[0] === "prune") return api("POST", "/api/admin/prune", { days: +p[1] }).then(function () { toast("پاک‌سازی شد"); qlog("پاک‌سازی رویدادها"); paintQuick(); });
    if (p[0] === "logoutall") return api("POST", "/api/admin/logout-all").then(function () { toast("همهٔ نشست‌ها بسته شد"); qlog("خروج همه"); });
    if (p[0] === "reloadall") { loadFlags(); paintQuick(); loadBroadcast(); toast("تازه‌سازی شد"); return Promise.resolve(); }
    return Promise.resolve();
  }

  function clearCache() {
    toast("در حال پاک‌کردن کش…");
    var jobs = [];
    if (W.caches) jobs.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    if (W.navigator && navigator.serviceWorker && navigator.serviceWorker.getRegistrations) {
      jobs.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    }
    return Promise.all(jobs).then(function () { toast("کش و سرویس‌ورکر پاک شد"); qlog("پاک‌سازی کش"); });
  }

  function loadBroadcast() {
    return api("GET", "/api/admin/messages").then(function (r) {
      var list = (r.messages || []);
      if (!$("#bcList")) return;
      $("#bcList").innerHTML = list.length ? list.map(function (m) {
        return '<div class="adm-ev"><span class="k">' + esc(m.audience || "all") + '</span><span class="t">' + esc(m.title || m.text).slice(0, 90) + "<small>" + esc(m.by || "") + "</small></span></div>";
      }).join("") : '<p style="color:var(--muted)">پیامی فرستاده نشده است.</p>';
    });
  }

  function loadBulk() {
    return api("GET", "/api/admin/users?sort=name").then(function (r) {
      if (!$("#bkList")) return;
      $("#bkList").innerHTML = '<div style="max-height:420px;overflow:auto">' + (r.users || []).map(function (u) {
        return '<label class="adm-switch" style="cursor:pointer"><input type="checkbox" data-bk-id="' + u.id + '" style="width:18px;height:18px">' +
          '<span class="info"><b>' + esc(u.name) + (u.verified ? " ✔" : "") + (u.banned ? " ⛔" : "") + '</b><small>' + esc(u.email) + " · " + esc(u.roleFa) + " · پایه " + esc(u.grade) + "</small></span></label>";
      }).join("") + "</div>";
    });
  }

  function loadRank() {
    return api("GET", "/api/admin/leaderboard").then(function (r) {
      if (!$("#rpTable")) return '<p></p>';
      $("#rpTable").innerHTML = '<table class="adm-table"><thead><tr><th>#</th><th>نام</th><th>پایه</th><th>دقیقه مطالعه</th><th>درس</th><th>آزمون</th></tr></thead><tbody>' +
        (r.rows || []).map(function (x) {
          return "<tr><td>" + fa(x.rank) + "</td><td>" + esc(x.name) + "<br><small>" + esc(x.email) + "</small></td><td>" + fa(x.grade) + "</td><td>" + fa(x.minutes) + "</td><td>" + fa(x.lessonsRead) + "</td><td>" + fa(x.exams) + "</td></tr>";
        }).join("") + "</tbody></table>";
    });
  }

  function loadSecurity() {
    return Promise.all([api("GET", "/api/admin/sessions"), api("GET", "/api/admin/users?role=&sort=active")]).then(function (res) {
      var r = res[0], all = res[1];
      if ($("#scSessions")) {
        $("#scSessions").innerHTML = (r.rows || []).map(function (x) {
          return '<div class="adm-ev"><span class="k">' + (x.active ? "🟢 آنلاین" : "⚪") + '</span><span class="t">' + esc(x.name) + "<small>" + esc(x.email) + " · " + esc(x.role) + "</small></span></div>";
        }).join("") || '<p style="color:var(--muted)">نشستی نیست.</p>';
      }
      if ($("#scBanned")) {
        var banned = (all.users || []).filter(function (u) { return u.banned; });
        $("#scBanned").innerHTML = banned.length ? banned.map(function (u) {
          return '<div class="adm-ev"><span class="k">مسدود</span><span class="t">' + esc(u.name) + "<small>" + esc(u.email) + '</small></span><span><button class="btn btn-ghost btn-sm" data-unban="' + u.id + '">آزاد کن</button></span></div>';
        }).join("") : '<p style="color:var(--muted)">کاربر مسدودی نیست.</p>';
      }
    });
  }

  function showPane(n) {
    $$("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== n; });
    $$(".adm-nav button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-nav") === n); });
    try { location.hash = n; } catch (e) {}
    if (n === "quick") paintQuick();
    if (n === "flags" || n === "content" || n === "exams") loadFlags();
    if (n === "broadcast") loadBroadcast();
    if (n === "bulk") loadBulk();
    if (n === "reports") loadRank();
    if (n === "security") loadSecurity();
  }

  /* ------------------------------------------------------------ سیم‌کشی */
  function wire() {
    /* کنش‌های سریع */
    var qa = $("#qeActions");
    if (qa) qa.addEventListener("click", function (e) {
      var b = e.target.closest("[data-qe]"); if (!b) return;
      quick(b.getAttribute("data-qe")).catch(function (x) { toast(x.message); });
    });

    /* ویژگی‌ها */
    var fl = $("#flGrid");
    if (fl) fl.addEventListener("click", function (e) {
      var t = e.target.closest("[data-flag]"); if (t) t.classList.toggle("on");
    });
    if ($("#flSave")) $("#flSave").addEventListener("click", function () { saveFlags().catch(function (e) { toast(e.message); }); });
    if ($("#flAllOn")) $("#flAllOn").addEventListener("click", function () { $$("[data-flag]").forEach(function (e) { e.classList.add("on"); }); saveFlags(); });
    if ($("#flAllOff")) $("#flAllOff").addEventListener("click", function () { $$("[data-flag]").forEach(function (e) { e.classList.remove("on"); }); saveFlags(); });

    /* محتوا و ظاهر */
    function saveContent() {
      return api("POST", "/api/admin/content", {
        hero: { title: $("#ctTitle").value, sub: $("#ctSub").value },
        theme: $("#ctThemeHex").value || $("#ctTheme").value,
        siteNotice: $("#ctNotice").value
      }).then(function () { toast("محتوا ذخیره شد"); });
    }
    if ($("#ctSave")) $("#ctSave").addEventListener("click", function () { saveContent().catch(function (e) { toast(e.message); }); });
    if ($("#ctSave2")) $("#ctSave2").addEventListener("click", function () {
      api("POST", "/api/admin/content", { contact: { email: $("#ctEmail").value, telegram: $("#ctTelegram").value, instagram: $("#ctInstagram").value, phone: $("#ctPhone").value } })
        .then(function () { toast("راه‌های تماس ذخیره شد"); }).catch(function (e) { toast(e.message); });
    });
    if ($("#ctDefault")) $("#ctDefault").addEventListener("click", function () {
      api("POST", "/api/admin/content", { hero: { title: "جزوهٔ کامل پایه‌های هفتم، هشتم و نهم", sub: "آنلاین، رایگان و همیشه در دسترس" }, theme: "#6d5efc", siteNotice: "کاملاً آنلاین" })
        .then(function () { toast("پیش‌فرض بازگشت"); loadFlags(); });
    });
    if ($("#ctTheme") && $("#ctThemeHex")) {
      $("#ctTheme").addEventListener("input", function () { $("#ctThemeHex").value = this.value; });
      $("#ctThemeHex").addEventListener("input", function () { if (/^#[0-9a-f]{6}$/i.test(this.value)) $("#ctTheme").value = this.value; });
    }

    /* آزمون */
    if ($("#exSave")) $("#exSave").addEventListener("click", function () {
      api("POST", "/api/admin/exam-defaults", { count: $("#exCount").value, minutes: $("#exMinutes").value, pass: $("#exPass").value })
        .then(function () { toast("پیش‌فرض آزمون ذخیره شد"); }).catch(function (e) { toast(e.message); });
    });
    if ($("#exClearReports")) $("#exClearReports").addEventListener("click", function () {
      if (!confirm("همهٔ کارنامه‌ها پاک شود؟")) return;
      api("POST", "/api/admin/reports/clear").then(function () { toast("کارنامه‌ها پاک شد"); paintQuick(); });
    });
    if ($("#exResetAll")) $("#exResetAll").addEventListener("click", function () {
      if (!confirm("پیشرفت مطالعهٔ همهٔ کاربران صفر شود؟")) return;
      api("POST", "/api/admin/reset-progress", { all: true }).then(function (r) { toast("برای " + fa(r.n) + " کاربر انجام شد"); paintQuick(); });
    });
    if ($("#exResetOne")) $("#exResetOne").addEventListener("click", function () {
      var em = $("#exUser").value.trim(); if (!em) return;
      api("POST", "/api/admin/reset-progress", { email: em }).then(function () { toast("پیشرفت " + em + " صفر شد"); });
    });

    /* پیام به کاربران */
    if ($("#bcSend")) $("#bcSend").addEventListener("click", function () {
      var t = $("#bcTitle").value.trim() || "پیام مدیر", x = $("#bcText").value.trim();
      if (!x) { toast("متن پیام را بنویس"); return; }
      api("POST", "/api/admin/messages", { title: t, text: x, audience: $("#bcTo").value })
        .then(function () { toast("پیام فرستاده شد"); $("#bcText").value = ""; loadBroadcast(); })
        .catch(function (e) { toast(e.message); });
    });

    /* عملیات گروهی */
    if ($("#bkAll")) $("#bkAll").addEventListener("click", function () { $$("[data-bk-id]").forEach(function (c) { c.checked = true; }); });
    if ($("#bkNone")) $("#bkNone").addEventListener("click", function () { $$("[data-bk-id]").forEach(function (c) { c.checked = false; }); });
    var bl = $("#bkList");
    if (bl) bl.addEventListener("click", function (e) {
      var b = e.target.closest("[data-bk]"); if (!b) return;
      var ids = $$("[data-bk-id]").filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-bk-id"); });
      if (!ids.length) { toast("اول چند کاربر را تیک بزن"); return; }
      api("POST", "/api/admin/user/bulk", { ids: ids, action: b.getAttribute("data-bk"), value: b.getAttribute("data-v") })
        .then(function (r) { toast("روی " + fa(r.n) + " کاربر اعمال شد"); loadBulk(); paintQuick(); })
        .catch(function (x) { toast(x.message); });
    });

    /* گزارش‌ها */
    if ($("#rpRank")) $("#rpRank").addEventListener("click", function () { loadRank(); });
    if ($("#rpUsers")) $("#rpUsers").addEventListener("click", function () { W.HKServer.downloadExport("users"); toast("فایل کاربران آماده شد"); });
    if ($("#rpProgress")) $("#rpProgress").addEventListener("click", function () { W.HKServer.downloadExport("progress"); toast("فایل پیشرفت آماده شد"); });
    if ($("#rpEvents")) $("#rpEvents").addEventListener("click", function () { W.HKServer.downloadExport("events"); toast("فایل رویدادها آماده شد"); });
    if ($("#rpAudit")) $("#rpAudit").addEventListener("click", function () { W.HKServer.downloadExport("audit"); toast("فایل گزارش اقدامات آماده شد"); });
    if ($("#rpAll")) $("#rpAll").addEventListener("click", function () { W.HKServer.downloadExport("all"); toast("پشتیبان کامل آماده شد"); });

    /* امنیت */
    if ($("#scLogoutAll")) $("#scLogoutAll").addEventListener("click", function () {
      if (!confirm("همهٔ نشست‌ها بسته شود؟")) return;
      api("POST", "/api/admin/logout-all").then(function () { toast("همهٔ نشست‌ها بسته شد"); loadSecurity(); });
    });
    if ($("#scPassSave")) $("#scPassSave").addEventListener("click", function () {
      var p = $("#scPass").value; if (p.length < 6) { toast("رمز دست‌کم ۶ نویسه"); return; }
      api("POST", "/api/me/password", { password: p }).then(function () { toast("رمز تغییر کرد"); $("#scPass").value = ""; });
    });
    var sb = $("#scBanned");
    if (sb) sb.addEventListener("click", function (e) {
      var b = e.target.closest("[data-unban]"); if (!b) return;
      api("POST", "/api/admin/user", { id: b.getAttribute("data-unban"), banned: false })
        .then(function () { toast("کاربر آزاد شد"); loadSecurity(); paintQuick(); });
    });

    /* داده و پشتیبان */
    if ($("#dtBackup")) $("#dtBackup").addEventListener("click", function () { W.HKServer.downloadExport("all"); toast("پشتیبان ساخته شد"); });
    if ($("#dtSize")) $("#dtSize").addEventListener("click", function () {
      if (W.HKServer.isReal && W.HKServer.isReal()) {
        api("GET", "/api/admin/stats").then(function (r) {
          var s = r.stats || { users: {}, activity: {} };
          $("#dtInfo").innerHTML = "کاربران: <b>" + fa(s.users.total || 0) + "</b> · کلاس‌ها: <b>" + fa(s.activity.classes || 0) +
            "</b> · رویدادها: <b>" + fa(s.activity.events || 0) + "</b> · ذخیره‌سازی: <b>Cloudflare D1</b>";
        }).catch(function (e) { toast(e.message); });
        return;
      }
      var db = W.HKServer.db();
      $("#dtInfo").innerHTML = "کاربران: <b>" + fa(db.users.length) + "</b> · کلاس‌ها: <b>" + fa((db.classes || []).length) +
        "</b> · رویدادها: <b>" + fa((db.events || []).length) + "</b> · گزارش اقدامات: <b>" + fa((db.audit || []).length) +
        "</b> · حجم تقریبی: <b>" + fa(Math.round(JSON.stringify(db).length / 1024)) + " کیلوبایت</b>";
    });
    if ($("#dtRestore")) $("#dtRestore").addEventListener("click", function () {
      var f = $("#dtFile").files[0]; if (!f) { toast("اول فایل پشتیبان را انتخاب کن"); return; }
      var fr = new FileReader();
      fr.onload = function () {
        api("POST", "/api/admin/restore", { json: String(fr.result) })
          .then(function () { toast("بازگردانی انجام شد"); loadFlags(); paintQuick(); })
          .catch(function (e) { toast(e.message); });
      };
      fr.readAsText(f);
    });
    if ($("#dtReset")) $("#dtReset").addEventListener("click", function () {
      if (!confirm("همهٔ داده‌ها به حالت اولیه برگردد؟")) return;
      api("POST", "/api/admin/reset-all").then(function () { toast("بازنشانی شد"); location.reload(); });
    });
    if ($("#dtCache")) $("#dtCache").addEventListener("click", function () { clearCache(); });

    /* بارگذاری هر تب هنگام کلیک (بدون دست‌زدن به منطق تب‌های اصلی) */
    var side = $("#admSide");
    if (side) side.addEventListener("click", function (e) {
      var b = e.target.closest("[data-nav]"); if (!b) return;
      var n = b.getAttribute("data-nav");
      if (n === "quick") paintQuick();
      else if (n === "flags" || n === "content" || n === "exams") loadFlags();
      else if (n === "broadcast") loadBroadcast();
      else if (n === "bulk") loadBulk();
      else if (n === "reports") loadRank();
      else if (n === "security") loadSecurity();
    });
  }

  /* ------------------------------------------------------------ راه‌اندازی */
  function boot() {
    injectTabs();
    buildPanes();
    wire();
    api("GET", "/api/auth/me").then(function (r) {
      ME = r.user; ROLE = ME ? ME.role : null;
      if (!ME || (ROLE !== "admin" && ROLE !== "teacher" && ROLE !== "owner")) return;
      if (!isOwner()) {
        TABS.forEach(function (x) {
          if (!x.owner) return;
          var b = $('.adm-nav button[data-nav="' + x.n + '"]'); if (b) b.hidden = true;
          var p = $('[data-pane="' + x.n + '"]'); if (p) p.setAttribute("data-owner-only", "1");
        });
      }
      paintQuick();
    }).catch(function () {});
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
