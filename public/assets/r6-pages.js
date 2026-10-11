/* ==========================================================================
   رهنما — صفحه‌های تازهٔ نسخهٔ ۶٫۵  |  r6-pages.js
   --------------------------------------------------------------------------
   منطق چهار صفحه:
     • class-support.html   پشتیبانی کلاس مجازی (درخواست کلید / دریافت کلید)
     • settings.html        تنظیمات هر کاربر (دستِ بازتر)
     • panel-teacher.html   پنل دبیر
     • panel-manager.html   پنل ناظم و مدیر
   همهٔ فراخوانی‌های سروری از HK.auth.api رد می‌شوند؛ اگر سرور نبود، همان
   مسیر محلی سایت استفاده می‌شود و صفحه باز هم کار می‌کند.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fa(n) { return String(n == null ? "" : n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function when(t) { try { return new Date(t).toLocaleString("fa-IR"); } catch (e) { return "—"; } }
  function toast(msg, kind) {
    try {
      if (W.HK && W.HK.toast) return W.HK.toast(msg, kind);
    } catch (e) { }
    var el = $("#r6pToast");
    if (!el) {
      el = D.createElement("div");
      el.id = "r6pToast";
      el.className = "r6p-toast";
      D.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add("on");
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove("on"); }, 3200);
  }
  function maint(what) { try { return W.R6 && W.R6.maintenance ? W.R6.maintenance(what) : false; } catch (e) { return false; } }
  function maintNote(what) { try { return W.R6 && W.R6.maintenanceNote ? W.R6.maintenanceNote(what) : ""; } catch (e) { return ""; } }

  /* منتظر می‌ماند تا لایهٔ احراز هویت سایت آماده شود */
  function ready(fn) {
    var tries = 0;
    (function tick() {
      if (W.HK && W.HK.auth && W.HK.auth.me) return fn();
      if (tries++ > 120) return fn();
      setTimeout(tick, 50);
    })();
  }
  function api(method, path, body) {
    try { return W.HK.auth.api(method, path, body); }
    catch (e) { return Promise.reject(e); }
  }
  function me() { try { return W.HK.auth.me(); } catch (e) { return null; } }
  function refreshMe() { try { return W.HK.auth.sync(true); } catch (e) { return Promise.resolve(); } }

  /* ---------- انبار محلی پشتیبانی (برای میزبانی استاتیک) ---------- */
  var SUP = "g8:support";
  function supRead() {
    try {
      var o = JSON.parse(W.localStorage.getItem(SUP) || "null");
      if (!o || !o.reqs) return { reqs: [], keys: [] };
      return o;
    } catch (e) { return { reqs: [], keys: [] }; }
  }
  function supWrite(o) { try { W.localStorage.setItem(SUP, JSON.stringify(o)); } catch (e) { } }
  function isStatic() { try { return !!(W.R6 && W.R6.server && W.R6.server().static); } catch (e) { return false; } }
  function newKey() {
    var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = "RN-";
    for (var i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)];
    return o;
  }

  /* ======================================================================
     ۱) صفحهٔ پشتیبانی کلاس مجازی
     ====================================================================== */
  function pageSupport() {
    var box = $("#r6Support");
    if (!box) return;
    var u = me();
    var roleOk = !!(u && (u.isOwner || ["teacher", "deputy", "admin", "owner"].indexOf(u.role) > -1));

    function render() {
      u = me();
      roleOk = !!(u && (u.isOwner || ["teacher", "deputy", "admin", "owner"].indexOf(u.role) > -1));
      var local = supRead();
      var mineReq = u ? local.reqs.filter(function (r) { return r.by === u.id; }) : [];
      var myKey = u ? local.keys.filter(function (k) { return k.owner === u.id && k.active; })[0] : null;
      var activeKey = (u && u.schoolKey) ? u.schoolKey : (myKey ? myKey.code : "");

      var h = '<div class="r6-grid2">';

      /* کارت وضعیت */
      h += '<section class="card"><h4><span class="card-icon">⌘</span> وضعیت من</h4>';
      if (!u) {
        h += '<p class="r6-empty">برای ثبت درخواست یا دریافت کلید، اول <a href="profile.html">وارد حساب شو</a>.</p>';
      } else {
        h += '<div class="r6-kv"><b>نام</b><span>' + esc(u.name) + "</span></div>" +
          '<div class="r6-kv"><b>نقش</b><span>' + esc(u.roleFa || u.role) + "</span></div>" +
          '<div class="r6-kv"><b>مدرسه</b><span>' + esc(u.school || "ثبت نشده") + "</span></div>" +
          '<div class="r6-kv"><b>کلید مدرسه</b><span>' + (activeKey ? "<code>" + esc(activeKey) + "</code>" : "—") + "</span></div>";
        if (activeKey) h += '<p style="margin-top:10px"><span class="r6-pill ok">کلاس مجازی این مدرسه فعال است</span></p>';
        if (!roleOk) h += '<p class="r6-prof-note">ثبت درخواست برای نقش‌های <b>دبیر</b>، <b>ناظم</b> و <b>مدیر</b> فعال است. برای تغییر نقش، از <a href="profile.html">پروفایل</a> و با «کد همکاران» استفاده کن.</p>';
      }
      h += "</section>";

      /* کارت درخواست */
      h += '<section class="card"><h4><span class="card-icon">✎</span> درخواست کلید کلاس مجازی</h4>' +
        '<p class="r6-prof-note">تیم مدیریت پس از بررسی، یک کلید مخصوص مدرسهٔ تو می‌سازد. با آن کلید، تو و اعضای مدرسه‌ات می‌توانید کلاس مجازی بسازید و به هم بپیوندید.</p>' +
        '<div class="r6-field"><label for="spSchool">نام مدرسه</label><input id="spSchool" placeholder="مثلاً دبیرستان شهید بهشتی" value="' + esc(u ? (u.school || "") : "") + '"></div>' +
        '<div class="r6-field"><label for="spCity">شهر</label><input id="spCity" placeholder="مثلاً تهران" value="' + esc(u ? (u.city || "") : "") + '"></div>' +
        '<div class="r6-field"><label for="spClasses">تعداد کلاس‌های موردنیاز</label><input id="spClasses" type="number" min="1" max="200" value="3"></div>' +
        '<div class="r6-field"><label for="spStudents">تعداد تقریبی دانش‌آموزان</label><input id="spStudents" type="number" min="1" max="5000" value="60"></div>' +
        '<div class="r6-field"><label for="spPhone">شمارهٔ تماس</label><input id="spPhone" placeholder="۰۹…" value=""></div>' +
        '<div class="r6-field"><label for="spNote">توضیح (اختیاری)</label><textarea id="spNote" placeholder="هر نکته‌ای که به بررسی کمک می‌کند"></textarea></div>' +
        '<div class="r6-actions"><button class="btn btn-primary" data-sp="send">ارسال درخواست</button></div></section>';

      /* کارت دریافت کلید */
      h += '<section class="card"><h4><span class="card-icon">⚿</span> دریافت کلید مدرسه</h4>' +
        '<p class="r6-prof-note">کلیدی که مدیر مدرسه برایت می‌فرستد را این‌جا وارد کن تا به مدرسه وصل شوی.</p>' +
        '<div class="r6-field"><label for="spCode">کلید</label><input id="spCode" placeholder="RN-XXXXXX" style="text-transform:uppercase"></div>' +
        '<div class="r6-actions"><button class="btn btn-primary" data-sp="redeem">وصل شو</button></div></section>';

      h += "</div>";

      /* درخواست‌های من */
      h += '<section class="card" style="margin-top:16px"><h4><span class="card-icon">≡</span> درخواست‌های من</h4>';
      if (!mineReq.length) h += '<div class="r6-empty">هنوز درخواستی ثبت نکرده‌ای.</div>';
      else {
        h += '<div class="r6-tbl-wrap"><table class="r6-tbl"><thead><tr><th>مدرسه</th><th>تاریخ</th><th>وضعیت</th><th>کلید</th></tr></thead><tbody>';
        mineReq.forEach(function (r) {
          h += "<tr><td>" + esc(r.school) + "</td><td>" + esc(when(r.t)) + "</td><td>" +
            (r.status === "approved" ? '<span class="r6-pill ok">کلید ساخته شد</span>' : '<span class="r6-pill warn">در انتظار بررسی</span>') +
            "</td><td>" + (r.keyCode ? "<code>" + esc(r.keyCode) + "</code>" : "—") + "</td></tr>";
        });
        h += "</tbody></table></div>";
      }
      h += "</section>";

      box.innerHTML = h;

      $$("[data-sp]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.getAttribute("data-sp");
          if (!me()) return toast("اول وارد حساب شو.", "warn");
          if (act === "send") {
            if (!roleOk) return toast("ثبت درخواست برای مدیر، ناظم و دبیر فعال است.", "warn");
            var body = {
              school: ($("#spSchool") || {}).value || "", city: ($("#spCity") || {}).value || "",
              classes: +($("#spClasses") || {}).value || 1, students: +($("#spStudents") || {}).value || 30,
              phone: ($("#spPhone") || {}).value || "", note: ($("#spNote") || {}).value || ""
            };
            if (!body.school.trim()) return toast("نام مدرسه را بنویس.", "warn");
            b.disabled = true;
            api("POST", "/api/support/request", body).then(function (r) {
              var local2 = supRead();
              if (!local2.reqs.filter(function (x) { return x.id === (r && r.request && r.request.id); }).length) {
                local2.reqs.unshift({
                  id: (r && r.request && r.request.id) || ("loc_" + Date.now().toString(36)),
                  t: Date.now(), by: me().id, byName: me().name, byEmail: me().email,
                  school: body.school, city: body.city, classes: body.classes, students: body.students,
                  status: "pending", keyCode: ""
                });
                supWrite(local2);
              }
              toast("درخواست ثبت شد؛ نتیجه را همین‌جا می‌بینی.", "ok");
              render();
            }).catch(function () { toast("ارسال نشد؛ دوباره تلاش کن.", "warn"); render(); });
            return;
          }
          if (act === "redeem") {
            var code = (($("#spCode") || {}).value || "").trim().toUpperCase();
            if (code.length < 4) return toast("کلید را کامل وارد کن.", "warn");
            b.disabled = true;
            api("POST", "/api/support/redeem", { code: code }).then(function () {
              var local2 = supRead();
              var k = local2.keys.filter(function (x) { return x.code === code && x.active; })[0];
              if (k) {
                local2.keys.forEach(function (x) { if (x.code === code) x.used = (x.used || 0) + 1; });
                supWrite(local2);
              }
              return refreshMe();
            }).then(function () {
              toast("به مدرسه وصل شدی.", "ok");
              render();
            }).catch(function (e) {
              var msg = (e && e.message) || "کلید معتبر نبود.";
              toast(msg, "warn"); render();
            });
          }
        });
      });
    }
    render();
    // وضعیت مدرسهٔ کاربر ممکن است بعد از sync برسد
    try { refreshMe().then(render); } catch (e) { }
  }

  /* ======================================================================
     ۲) صفحهٔ تنظیمات کاربر
     ====================================================================== */
  function pageSettings() {
    var box = $("#r6Settings");
    if (!box) return;
    var LS = W.localStorage;

    /* ظاهر سایت از همان کنترل‌های پنل مشاوره استفاده می‌کند تا منطق تکراری نشود */
    function click(what) {
      var b = $('[data-hk-set="' + what + '"]');
      if (b) b.click();
    }
    function uiState() {
      return {
        theme: D.documentElement.getAttribute("data-theme") || "light",
        sepia: D.body.classList.contains("hk-sepia"),
        focus: D.body.classList.contains("hk-focus"),
        font: +(LS.getItem("g8:ui:font") || 3),
        lh: +(LS.getItem("g8:ui:lh") || 2),
        width: LS.getItem("g8:r6:width") || "normal",
        motion: LS.getItem("g8:r6:motion") || "on",
        fontName: LS.getItem("g8:r6:fontName") || "vazir"
      };
    }
    function applyWidth(v) {
      D.body.classList.remove("r6-w-narrow", "r6-w-wide");
      if (v === "narrow") D.body.classList.add("r6-w-narrow");
      if (v === "wide") D.body.classList.add("r6-w-wide");
      LS.setItem("g8:r6:width", v);
    }
    function applyMotion(v) {
      D.documentElement.classList.toggle("r6-no-motion", v === "off");
      LS.setItem("g8:r6:motion", v);
    }
    function applyFontName(v) {
      var map = { vazir: "r6-font-vazir", system: "r6-font-system", display: "r6-font-display", serif: "r6-font-serif" };
      ["r6-font-vazir", "r6-font-system", "r6-font-display", "r6-font-serif"].forEach(function (c) { D.body.classList.remove(c); });
      D.body.classList.add(map[v] || "r6-font-vazir");
      LS.setItem("g8:r6:fontName", v);
    }

    function render() {
      var s = uiState(), u = me();
      var aiCfg = {};
      try { aiCfg = JSON.parse(LS.getItem("g8:ai2") || "{}") || {}; } catch (e) { aiCfg = {}; }

      box.innerHTML =
        '<div class="r6-grid2">' +

        /* ظاهر */
        '<section class="card"><h4><span class="card-icon">◐</span> ظاهر</h4>' +
        '<div class="r6-field"><label>حالت رنگ</label><div class="r6-actions">' +
        '<button class="btn btn-sm' + (s.theme === "light" && !s.sepia ? " btn-primary" : "") + '" data-set="light">روشن</button>' +
        '<button class="btn btn-sm' + (s.theme === "dark" ? " btn-primary" : "") + '" data-set="dark">تیره</button>' +
        '<button class="btn btn-sm' + (s.sepia ? " btn-primary" : "") + '" data-set="sepia">کاغذی</button>' +
        "</div></div>" +
        '<div class="r6-field"><label>اندازهٔ نوشته</label><div class="r6-actions">' +
        '<button class="btn btn-sm" data-set="fontDn">کوچک‌تر</button>' +
        '<span class="r6-pill">سطح ' + fa(s.font) + " از ۴</span>" +
        '<button class="btn btn-sm" data-set="fontUp">بزرگ‌تر</button></div></div>' +
        '<div class="r6-field"><label>فاصلهٔ خطوط</label><div class="r6-actions">' +
        '<button class="btn btn-sm" data-set="lhDn">کم‌تر</button>' +
        '<span class="r6-pill">سطح ' + fa(s.lh) + " از ۳</span>" +
        '<button class="btn btn-sm" data-set="lhUp">بیش‌تر</button></div></div>' +
        '<div class="r6-field"><label>پهنای ستون مطالعه</label><div class="r6-actions">' +
        '<button class="btn btn-sm' + (s.width === "narrow" ? " btn-primary" : "") + '" data-width="narrow">باریک</button>' +
        '<button class="btn btn-sm' + (s.width === "normal" ? " btn-primary" : "") + '" data-width="normal">معمولی</button>' +
        '<button class="btn btn-sm' + (s.width === "wide" ? " btn-primary" : "") + '" data-width="wide">پهن</button></div></div>' +
        '<div class="r6-field"><label>حالت تمرکز</label><div class="r6-actions">' +
        '<button class="btn btn-sm' + (s.focus ? " btn-primary" : "") + '" data-set="focus">' + (s.focus ? "روشن" : "خاموش") + "</button>" +
        "</div></div>" +
        "</section>" +

        /* خواندن */
        '<section class="card"><h4><span class="card-icon">☰</span> خواندن</h4>' +
        '<div class="r6-field"><label>فونت نام من</label><div class="r6-fontpick">' +
        [["vazir", "وزیرمتن"], ["system", "سیستم"], ["display", "نمایشی"], ["serif", "سریف"]].map(function (f) {
          return '<button class="' + (s.fontName === f[0] ? "on" : "") + '" data-fontname="' + f[0] + '" aria-pressed="' + (s.fontName === f[0]) + '">' +
            '<span class="r6-font-' + f[0] + '">' + f[1] + "</span></button>";
        }).join("") +
        "</div><small>این فونت برای نمایش نام تو در پروفایل و صفحهٔ اصلی است.</small></div>" +
        '<div class="r6-field"><label>حرکت‌ها و انیمیشن‌ها</label><div class="r6-actions">' +
        '<button class="btn btn-sm' + (s.motion === "on" ? " btn-primary" : "") + '" data-motion="on">روشن</button>' +
        '<button class="btn btn-sm' + (s.motion === "off" ? " btn-primary" : "") + '" data-motion="off">کم</button>' +
        "</div><small>«کم» برای دستگاه‌های ضعیف و اسکرول روان‌تر.</small></div>" +
        '<div class="r6-actions"><a class="btn btn-sm" href="profile.html">شخصی‌سازی پروفایل (عکس/گیف، رنگ نام)</a></div>' +
        "</section>" +

        /* دستیار */
        '<section class="card"><h4><span class="card-icon">✦</span> دستیار هوشمند</h4>' +
        (maint("ai")
          ? '<p><span class="r6-pill warn">در حالت تعمیر</span></p><p class="r6-prof-note">' + esc(maintNote("ai")) + "</p>"
          : '<p><span class="r6-pill ok">فعال</span></p>') +
        '<div class="r6-field"><label for="stAiKey">کلید شخصی (اختیاری)</label>' +
        '<input id="stAiKey" type="password" placeholder="' + (aiCfg.key ? "•••••• ذخیره شده" : "خالی = دستیار سروری/محلی سایت") + '" autocomplete="off">' +
        "<small>اگر کلید خودت را بگذاری، پاسخ‌ها از حساب خودت حساب می‌شود.</small></div>" +
        '<div class="r6-field"><label for="stAiMode">حالت</label><select id="stAiMode">' +
        ["auto", "proxy", "openai", "openrouter", "groq", "deepseek", "gemini", "offline"].map(function (m) {
          return '<option value="' + m + '"' + ((aiCfg.mode || "auto") === m ? " selected" : "") + ">" + m + "</option>";
        }).join("") + "</select></div>" +
        '<div class="r6-actions"><button class="btn btn-primary btn-sm" data-ai="save">ذخیرهٔ تنظیم دستیار</button>' +
        '<a class="btn btn-sm" href="ai.html">رفتن به دستیار</a></div>' +
        "</section>" +

        /* داده‌ها */
        '<section class="card"><h4><span class="card-icon">⇅</span> داده‌های من</h4>' +
        '<p class="r6-prof-note">پیشرفت، یادداشت‌ها و نشانه‌هایت روی همین دستگاه ذخیره می‌شود. پیش از پاک‌کردن، پشتیبان بگیر.</p>' +
        '<div class="r6-actions">' +
        '<button class="btn btn-sm" data-data="backup">پشتیبان‌گیری</button>' +
        '<label class="btn btn-sm" style="cursor:pointer">بازگردانی<input type="file" id="stRestore" accept=".json" hidden></label>' +
        '<button class="btn btn-sm" data-data="wipe">پاک‌کردن داده‌های محلی</button>' +
        "</div>" +
        (u ? '<div class="r6-kv" style="margin-top:10px"><b>حساب</b><span>' + esc(u.email) + "</span></div>" : "") +
        "</section>" +

        /* میان‌بُرها */
        '<section class="card"><h4><span class="card-icon">⌘</span> میان‌بُرهای صفحه‌کلید</h4>' +
        '<div class="r6-kv"><b>Ctrl + K</b><span>جست‌وجوی سراسری</span></div>' +
        '<div class="r6-kv"><b>Alt + K</b><span>باز و بستن دستیار</span></div>' +
        '<div class="r6-kv"><b>Alt + I</b><span>پنل مشاوره</span></div>' +
        '<div class="r6-kv"><b>Space / PageDown</b><span>حرکت در صفحه</span></div>' +
        "</section>" +

        "</div>";

      bind();
    }

    function bind() {
      $$("[data-set]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var w = b.getAttribute("data-set");
          if (w === "sepia") {
            var on = !D.body.classList.contains("hk-sepia");
            click("sepia");
            if (on !== D.body.classList.contains("hk-sepia")) click("sepia");
          } else if (w === "light" || w === "dark") click(w);
          else click(w);
          render();
        });
      });
      $$("[data-width]", box).forEach(function (b) {
        b.addEventListener("click", function () { applyWidth(b.getAttribute("data-width")); render(); });
      });
      $$("[data-motion]", box).forEach(function (b) {
        b.addEventListener("click", function () { applyMotion(b.getAttribute("data-motion")); render(); });
      });
      $$("[data-fontname]", box).forEach(function (b) {
        b.addEventListener("click", function () { applyFontName(b.getAttribute("data-fontname")); render(); });
      });
      $$("[data-ai]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var cfg = {};
          try { cfg = JSON.parse(LS.getItem("g8:ai2") || "{}") || {}; } catch (e) { cfg = {}; }
          cfg.mode = ($("#stAiMode") || {}).value || "auto";
          var k = ($("#stAiKey") || {}).value || "";
          if (k.trim()) cfg.key = k.trim();
          try { LS.setItem("g8:ai2", JSON.stringify(cfg)); } catch (e) { }
          toast("تنظیم دستیار ذخیره شد.", "ok");
          render();
        });
      });
      $$("[data-data]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var w = b.getAttribute("data-data");
          var btn = $('[data-hk-backup]'); var btn2 = $('[data-hk-wipe]');
          if (w === "backup") { if (btn) btn.click(); else backup(); }
          else if (w === "wipe") { if (confirm("همهٔ داده‌های محلی این دستگاه پاک شود؟")) { if (btn2) btn2.click(); else wipe(); } }
        });
      });
      var r = $("#stRestore");
      if (r) r.addEventListener("change", function () {
        var f = r.files && r.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var data = JSON.parse(String(fr.result));
            Object.keys(data).forEach(function (k) {
              if (/^g8:/.test(k)) LS.setItem(k, data[k]);
            });
            toast("بازگردانی انجام شد.", "ok");
            setTimeout(function () { W.location.reload(); }, 700);
          } catch (e) { toast("فایل پشتیبان معتبر نبود.", "warn"); }
        };
        fr.readAsText(f);
      });
    }

    function backup() {
      var out = {};
      for (var i = 0; i < LS.length; i++) {
        var k = LS.key(i);
        if (/^g8:/.test(k)) out[k] = LS.getItem(k);
      }
      var blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
      var a = D.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "rahnama-backup-" + new Date().toISOString().slice(0, 10) + ".json";
      D.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
      toast("فایل پشتیبان ساخته شد.", "ok");
    }

    function wipe() {
      Object.keys(LS).forEach(function (k) { if (/^g8:/.test(k)) LS.removeItem(k); });
      toast("پاک شد.", "ok");
      setTimeout(function () { W.location.reload(); }, 600);
    }

    // اعمال تنظیم‌های ذخیره‌شده در بار اول
    var st = uiState();
    applyWidth(st.width); applyMotion(st.motion); applyFontName(st.fontName);
    render();
  }

  /* ======================================================================
     ۳) پنل دبیر
     ====================================================================== */
  function pageTeacher() {
    var box = $("#r6RolePanel");
    if (!box) return;
    var u = me();
    if (!u) return void (box.innerHTML = '<div class="r6-empty">اول <a href="profile.html">وارد حساب</a> شو.</div>');

    function roleBanner() {
      var ok = ["teacher", "deputy", "admin", "owner"].indexOf(u.role) > -1 || u.isOwner;
      if (ok) return "";
      return '<div class="r6-maint-banner"><b>این پنل برای دبیران است</b><span>نقش کنونی تو «' +
        esc(u.roleFa || u.role) + '» است. از <a href="profile.html">پروفایل</a> و با «کد همکاران» نقش دبیر را فعال کن.</span></div>';
    }

    box.innerHTML = roleBanner() +
      '<div class="r6-grid2">' +
      '<section class="card"><h4><span class="card-icon">＋</span> ساخت کلاس تازه</h4>' +
      '<div class="r6-field"><label for="tcName">نام کلاس</label><input id="tcName" placeholder="مثلاً ریاضی هشتم — الف"></div>' +
      '<div class="r6-field"><label for="tcGrade">پایه</label><select id="tcGrade"><option value="7">هفتم</option><option value="8" selected>هشتم</option><option value="9">نهم</option></select></div>' +
      '<div class="r6-field"><label for="tcSubject">درس</label><input id="tcSubject" placeholder="ریاضی"></div>' +
      '<div class="r6-actions"><button class="btn btn-primary" data-tc="create">ساخت کلاس</button></div>' +
      '<p class="r6-prof-note">برای ساخت کلاس مجازی، اگر مدرسه‌ات کلید دارد، همان کلید فعال است. بدون کلید هم می‌توانی کلاس آزمایشی بسازی.</p>' +
      "</section>" +
      '<section class="card"><h4><span class="card-icon">⇥</span> ورود با کد کلاس</h4>' +
      '<div class="r6-field"><label for="tcCode">کد کلاس</label><input id="tcCode" placeholder="مثلاً 7K2M9Q" style="text-transform:uppercase"></div>' +
      '<div class="r6-actions"><button class="btn btn-primary" data-tc="join">ورود به کلاس</button></div>' +
      "</section>" +
      "</div>" +
      '<section class="card" style="margin-top:16px"><h4><span class="card-icon">▤</span> کلاس‌های من</h4><div id="tcList"><div class="r6-empty">در حال بارگذاری…</div></div></section>' +
      '<section class="card" style="margin-top:16px"><h4><span class="card-icon">◔</span> آمار مدرسه</h4><div id="tcStats"><div class="r6-empty">در حال بارگذاری…</div></div></section>';

    function loadList() {
      api("GET", "/api/class/list").then(function (r) {
        var mine = (r && (r.taught || r.mine)) || [];
        var el = $("#tcList");
        if (!mine.length) { el.innerHTML = '<div class="r6-empty">هنوز کلاسی نساخته‌ای.</div>'; return; }
        var h = '<div class="r6-tbl-wrap"><table class="r6-tbl"><thead><tr><th>کلاس</th><th>پایه</th><th>درس</th><th>کد</th><th>اعضا</th><th>وضعیت</th><th></th></tr></thead><tbody>';
        mine.forEach(function (c) {
          h += "<tr><td>" + esc(c.name) + "</td><td>" + fa(c.grade || "—") + "</td><td>" + esc(c.subject || "—") +
            "</td><td><code>" + esc(c.code || "—") + "</code></td><td>" + fa((c.members || []).length || 0) +
            "</td><td>" + (c.live ? '<span class="r6-pill ok">در حال برگزاری</span>' : '<span class="r6-pill">آماده</span>') +
            '</td><td><a class="btn btn-sm" href="class.html">مدیریت</a></td></tr>';
        });
        h += "</tbody></table></div>";
        el.innerHTML = h;
      }).catch(function () { $("#tcList").innerHTML = '<div class="r6-empty">فهرست کلاس‌ها در دسترس نیست.</div>'; });
    }
    function loadStats() {
      api("GET", "/api/class/overview").then(function (r) {
        var c = (r && r.counts) || {};
        $("#tcStats").innerHTML =
          '<div class="r6-kv"><b>کلاس‌ها</b><span>' + fa(c.classes || 0) + "</span></div>" +
          '<div class="r6-kv"><b>کلاس در حال برگزاری</b><span>' + fa(c.live || 0) + "</span></div>" +
          '<div class="r6-kv"><b>دانش‌آموزان</b><span>' + fa(c.students || 0) + "</span></div>" +
          '<div class="r6-actions" style="margin-top:10px"><a class="btn btn-sm" href="class.html">کلاس مجازی</a>' +
          '<a class="btn btn-sm" href="class-support.html">پشتیبانی کلاس مجازی</a></div>';
      }).catch(function () { $("#tcStats").innerHTML = '<div class="r6-empty">آمار در دسترس نیست.</div>'; });
    }

    $$("[data-tc]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        var w = b.getAttribute("data-tc");
        if (w === "create") {
          var name = (($("#tcName") || {}).value || "").trim();
          if (!name) return toast("نام کلاس را بنویس.", "warn");
          b.disabled = true;
          api("POST", "/api/class/create", {
            name: name, grade: ($("#tcGrade") || {}).value || "8",
            subject: (($("#tcSubject") || {}).value || "").trim(), autoMembers: true
          }).then(function (r) {
            toast("کلاس ساخته شد · کد: " + ((r && r.class && r.class.code) || "—"), "ok");
            loadList(); render(); b.disabled = false;
          }).catch(function () { toast("ساخت کلاس نشد.", "warn"); b.disabled = false; });
          return;
        }
        if (w === "join") {
          var code = (($("#tcCode") || {}).value || "").trim().toUpperCase();
          if (code.length < 4) return toast("کد کلاس را کامل وارد کن.", "warn");
          b.disabled = true;
          api("POST", "/api/class/join", { code: code }).then(function () {
            toast("به کلاس وصل شدی.", "ok");
            setTimeout(function () { W.location.href = "class.html"; }, 700);
          }).catch(function () { toast("کد کلاس معتبر نبود.", "warn"); b.disabled = false; });
          return;
        }
      });
    });

    function render() { loadList(); loadStats(); }
    render();
    try { refreshMe().then(function () { }); } catch (e) { }
  }

  /* ======================================================================
     ۴) پنل ناظم و مدیر
     ====================================================================== */
  function pageManager() {
    var box = $("#r6RolePanel");
    if (!box) return;
    var u = me();
    if (!u) return void (box.innerHTML = '<div class="r6-empty">اول <a href="profile.html">وارد حساب</a> شو.</div>');

    var isManager = ["deputy", "admin", "owner"].indexOf(u.role) > -1 || u.isOwner;
    var banner = isManager ? "" :
      '<div class="r6-maint-banner"><b>این پنل برای ناظم و مدیر است</b><span>نقش کنونی تو «' +
      esc(u.roleFa || u.role) + '» است. نقش ناظم با «کد همکاران» و نقش مدیر فقط توسط مالک سایت تعیین می‌شود.</span></div>';

    box.innerHTML = banner +
      '<div class="r6-grid2">' +
      '<section class="card"><h4><span class="card-icon">◔</span> نمای کلی مدرسه</h4><div id="mgStats"><div class="r6-empty">در حال بارگذاری…</div></div></section>' +
      '<section class="card"><h4><span class="card-icon">⚿</span> کلید کلاس مجازی</h4><div id="mgKey"><div class="r6-empty">در حال بارگذاری…</div></div></section>' +
      "</div>" +
      '<section class="card" style="margin-top:16px"><h4><span class="card-icon">▤</span> کلاس‌های مدرسه</h4><div id="mgClasses"><div class="r6-empty">در حال بارگذاری…</div></div></section>' +
      '<section class="card" style="margin-top:16px"><h4><span class="card-icon">☰</span> آمار سایت</h4><div id="mgSite"><div class="r6-empty">در حال بارگذاری…</div></div></section>';

    api("GET", "/api/class/overview").then(function (r) {
      var c = (r && r.counts) || {};
      $("#mgStats").innerHTML =
        '<div class="r6-kv"><b>کلاس‌ها</b><span>' + fa(c.classes || 0) + "</span></div>" +
        '<div class="r6-kv"><b>در حال برگزاری</b><span>' + fa(c.live || 0) + "</span></div>" +
        '<div class="r6-kv"><b>دانش‌آموزان</b><span>' + fa(c.students || 0) + "</span></div>" +
        '<div class="r6-kv"><b>دبیران</b><span>' + fa(c.teachers || 0) + "</span></div>" +
        '<div class="r6-actions" style="margin-top:10px">' +
        '<a class="btn btn-sm" href="class.html">کلاس مجازی</a>' +
        '<a class="btn btn-sm" href="class-support.html">درخواست کلید مدرسه</a></div>';

      var list = (r && r.classes) || [];
      $("#mgClasses").innerHTML = list.length
        ? '<div class="r6-tbl-wrap"><table class="r6-tbl"><thead><tr><th>کلاس</th><th>پایه</th><th>درس</th><th>کد</th><th>وضعیت</th></tr></thead><tbody>' +
        list.slice(0, 50).map(function (x) {
          return "<tr><td>" + esc(x.name) + "</td><td>" + fa(x.grade || "—") + "</td><td>" + esc(x.subject || "—") +
            "</td><td><code>" + esc(x.code || "—") + "</code></td><td>" +
            (x.live ? '<span class="r6-pill ok">برگزار</span>' : '<span class="r6-pill">آماده</span>') + "</td></tr>";
        }).join("") + "</tbody></table></div>"
        : '<div class="r6-empty">کلاسی ثبت نشده است.</div>';
    }).catch(function () {
      $("#mgStats").innerHTML = '<div class="r6-empty">آمار در دسترس نیست.</div>';
      $("#mgClasses").innerHTML = '<div class="r6-empty">فهرست در دسترس نیست.</div>';
    });

    // کلید مدرسه
    api("GET", "/api/support/my").then(function (r) {
      var key = r && r.key;
      $("#mgKey").innerHTML = key
        ? '<div class="r6-kv"><b>کلید فعال</b><span><span class="r6-code">' + esc(key.code) + "</span></span></div>" +
        '<div class="r6-kv"><b>مدرسه</b><span>' + esc(key.school || "—") + "</span></div>" +
        '<div class="r6-kv"><b>ظرفیت</b><span>' + fa(key.seats || "—") + "</span></div>" +
        '<div class="r6-kv"><b>اعضای وصل‌شده</b><span>' + fa((key.members || []).length) + "</span></div>" +
        '<div class="r6-kv"><b>انقضا</b><span>' + esc(key.exp ? new Date(key.exp).toLocaleDateString("fa-IR") : "—") + "</span></div>" +
        '<p class="r6-prof-note">این کلید را به اعضای مدرسه بده تا در صفحهٔ «پشتیبانی کلاس مجازی» وارد کنند.</p>'
        : '<div class="r6-empty">کلیدی برای مدرسهٔ تو ساخته نشده است.<br><a class="btn btn-sm" style="margin-top:10px" href="class-support.html">ثبت درخواست کلید</a></div>';
    }).catch(function () {
      $("#mgKey").innerHTML = '<div class="r6-empty">برای کلید مدرسه، از صفحهٔ <a href="class-support.html">پشتیبانی کلاس مجازی</a> درخواست بده.</div>';
    });

    // آمار سایت — فقط برای مدیر و مالک
    if (u.role === "admin" || u.role === "owner" || u.isOwner) {
      api("GET", "/api/admin/stats").then(function (r) {
        var s = (r && r.stats) || {};
        var c = s.byRole || {};
        $("#mgSite").innerHTML =
          '<div class="r6-kv"><b>کاربران</b><span>' + fa(s.users || 0) + "</span></div>" +
          '<div class="r6-kv"><b>دانش‌آموز</b><span>' + fa(c.student || 0) + "</span></div>" +
          '<div class="r6-kv"><b>دبیر</b><span>' + fa(c.teacher || 0) + "</span></div>" +
          '<div class="r6-kv"><b>ناظم</b><span>' + fa(c.deputy || 0) + "</span></div>" +
          '<div class="r6-kv"><b>مدیر</b><span>' + fa(c.admin || 0) + "</span></div>" +
          '<div class="r6-actions" style="margin-top:10px"><a class="btn btn-sm btn-primary" href="admin.html">پنل مدیریت</a></div>';
      }).catch(function () { $("#mgSite").innerHTML = '<div class="r6-empty">آمار مدیریتی در دسترس نیست.</div>'; });
    } else {
      $("#mgSite").innerHTML = '<div class="r6-empty">این بخش برای مدیر و مالک سایت است.</div>';
    }
  }

  /* -------------------------------------------------------------- راه‌اندازی */
  function boot() {
    var page = (D.body && D.body.getAttribute("data-page")) || "";
    if (page === "class-support") return ready(pageSupport);
    if (page === "settings") return ready(pageSettings);
    if (page === "panel-teacher") return ready(pageTeacher);
    if (page === "panel-manager") return ready(pageManager);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();

  W.R6P = { toast: toast, api: api, me: me };
})();
