/* ==========================================================================
   رهنما — پنل مشاورهٔ سراسری  |  hk-panel.js
   روی همهٔ صفحه‌ها یک پنل کشویی اضافه می‌کند:
     • مشاور اجرایی (درخواست می‌دهی، انجام می‌دهد؛ با میکروفون هم می‌شود)
     • کارهای من   • برنامهٔ مطالعه   • یادداشت‌ها   • نشان‌گذاری‌ها   • تنظیمات
   همهٔ داده‌ها روی همان دستگاه (localStorage) ذخیره می‌شوند.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return NFA[+d]; }); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function toast(m, ms) { W.HK && W.HK.toast ? W.HK.toast(m, ms) : null; }
  function grade() {
    var q = new URLSearchParams(location.search).get("g");
    return ["7", "8", "9"].indexOf(q) > -1 ? q : (D.body.getAttribute("data-grade") || "8");
  }
  var SUBJECT = D.body.getAttribute("data-subject") || "jozve";
  var Q = grade() === "8" ? "" : "?g=" + grade();

  var el = {};

  /* ------------------------------------------------------- ساخت پنل */
  function build() {
    if ($(".hk-drawer")) return;

    var fab = D.createElement("button");
    fab.className = "hk-fab";
    fab.setAttribute("aria-label", "پنل مشاوره");
    fab.innerHTML = '<span class="hk-dot"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-8 8H8l-5 3 1.5-4.5A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01"/></svg>';
    fab.addEventListener("click", function () { open(); });
    D.body.appendChild(fab);

    var bd = D.createElement("div");
    bd.className = "hk-backdrop";
    bd.addEventListener("click", close);
    D.body.appendChild(bd);

    var dr = D.createElement("aside");
    dr.className = "hk-drawer";
    dr.setAttribute("role", "dialog");
    dr.setAttribute("aria-label", "پنل مشاورهٔ رهنما");
    dr.innerHTML =
      '<div class="hk-drawer-head">' +
        '<span class="ai-dot off" data-hk-state></span>' +
        "<div><h3>پنل مشاور همکار</h3><small>درخواست بده — انجام می‌دهم</small></div>" +
        '<span class="hk-spacer"></span>' +
        '<button class="hk-icon-btn" data-hk-close aria-label="بستن">✕</button>' +
      "</div>" +
      '<div class="hk-tabs">' +
        '<button class="hk-tab on" data-hk-tab="chat">مشاور</button>' +
        '<button class="hk-tab" data-hk-tab="do">چه کارهایی؟</button>' +
        '<button class="hk-tab" data-hk-tab="tasks">کارهای من</button>' +
        '<button class="hk-tab" data-hk-tab="plan">برنامه</button>' +
        '<button class="hk-tab" data-hk-tab="notes">یادداشت‌ها</button>' +
        '<button class="hk-tab" data-hk-tab="marks">نشان‌ها</button>' +
        '<button class="hk-tab" data-hk-tab="set">تنظیمات</button>' +
      "</div>" +

      /* --- مشاور --- */
      '<div class="hk-pane" data-hk-pane="chat">' +
        '<div class="hk-quick">' +
          '<button class="hk-q" data-hk-go="jozve-list">فهرست جزوه‌ها</button>' +
          '<button class="hk-q" data-hk-go="help">چه کارهایی می‌کنی؟</button>' +
          '<button class="hk-q" data-hk-go="stats">آمار من</button>' +
          '<button class="hk-q" data-hk-go="backup">پشتیبان‌گیری</button>' +
          '<button class="hk-q" data-hk-say="برنامهٔ مطالعهٔ ۷ روزه با روزی ۳ ساعت بده">برنامهٔ مطالعه بده</button>' +
          '<button class="hk-q" data-hk-say="جزوهٔ ریاضی هشتم را باز کن">جزوهٔ ریاضی</button>' +
          '<button class="hk-q" data-hk-say="۱۰ سؤال بساز">آزمون بساز</button>' +
          '<button class="hk-q" data-hk-say="این درس را خلاصه کن">این درس را خلاصه کن</button>' +
        "</div>" +
        '<div class="hk-log" data-hk-log></div>' +
      "</div>" +

      /* --- چه کارهایی --- */
      '<div class="hk-pane" data-hk-pane="do" hidden><div data-hk-dolist></div></div>' +

      /* --- کارها --- */
      '<div class="hk-pane" data-hk-pane="tasks" hidden>' +
        '<div class="hk-form" style="padding:0 0 12px;border:0;background:none">' +
          '<textarea data-hk-task-in rows="1" placeholder="کار تازه… مثلاً «فصل ۳ ریاضی را بخوانم»"></textarea>' +
          '<button class="btn btn-primary btn-sm" data-hk-task-add>افزودن</button>' +
        "</div>" +
        '<div data-hk-tasklist></div>' +
      "</div>" +

      /* --- برنامه --- */
      '<div class="hk-pane" data-hk-pane="plan" hidden>' +
        '<div class="hk-form" style="padding:0 0 12px;border:0;background:none;flex-wrap:wrap">' +
          '<label style="font-size:.78rem;font-weight:800">روز <input type="number" min="3" max="30" value="7" data-hk-days style="width:64px;padding:6px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text)"></label>' +
          '<label style="font-size:.78rem;font-weight:800">ساعت <input type="number" min="1" max="8" value="3" data-hk-hours style="width:60px;padding:6px;border-radius:8px;border:1px solid var(--border-strong);background:var(--surface);color:var(--text)"></label>' +
          '<button class="btn btn-primary btn-sm" data-hk-plan-make>ساخت برنامه</button>' +
          '<button class="btn btn-ghost btn-sm" data-hk-plan-print>چاپ</button>' +
        "</div>" +
        '<div data-hk-plan></div>' +
      "</div>" +

      /* --- یادداشت‌ها --- */
      '<div class="hk-pane" data-hk-pane="notes" hidden>' +
        '<div class="hk-quick"><button class="hk-q" data-hk-notes-export>خروجی متنی</button>' +
        '<button class="hk-q" data-hk-notes-print>چاپ</button></div>' +
        '<div data-hk-notes></div>' +
      "</div>" +

      /* --- نشان‌ها --- */
      '<div class="hk-pane" data-hk-pane="marks" hidden><div data-hk-marks></div></div>' +

      /* --- تنظیمات --- */
      '<div class="hk-pane" data-hk-pane="set" hidden>' +
        "<h4 style=\"margin:0 0 8px;font-size:.92rem\">ظاهر مطالعه</h4>" +
        '<div class="hk-quick">' +
          '<button class="hk-q" data-hk-set="dark">حالت شب</button>' +
          '<button class="hk-q" data-hk-set="light">حالت روز</button>' +
          '<button class="hk-q" data-hk-set="sepia">سپیا (کاغذی)</button>' +
          '<button class="hk-q" data-hk-set="fontUp">متن بزرگ‌تر</button>' +
          '<button class="hk-q" data-hk-set="fontDn">متن کوچک‌تر</button>' +
          '<button class="hk-q" data-hk-set="lhUp">فاصلهٔ بیشتر</button>' +
          '<button class="hk-q" data-hk-set="lhDn">فاصلهٔ کمتر</button>' +
          '<button class="hk-q" data-hk-set="focus">حالت تمرکز</button>' +
        "</div>" +
        "<h4 style=\"margin:14px 0 8px;font-size:.92rem\">دستیار آنلاین (اختیاری)</h4>" +
        '<p style="font-size:.79rem;color:var(--muted);line-height:1.85">برای پاسخ‌های تحلیلی، یکی از سرویس‌ها را وصل کن. کلید فقط در همین دستگاه ذخیره می‌شود. ساده‌ترین راه: «سرور خود سایت».</p>' +
        '<div class="ai-keybar">' +
          '<div><label>سرویس</label><select data-hk-mode>' +
            '<option value="auto">خودکار</option><option value="proxy">سرور خود سایت</option>' +
            '<option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option>' +
            '<option value="groq">Groq</option><option value="deepseek">DeepSeek</option>' +
            '<option value="gemini">Gemini</option><option value="offline">آفلاین</option>' +
          "</select></div>" +
          '<div><label>کلید سرویس</label><input type="password" data-hk-key placeholder="اختیاری"></div>' +
          '<div><label>نام مدل</label><input data-hk-model placeholder="خالی = پیش‌فرض"></div>' +
        "</div>" +
        '<button class="btn btn-primary btn-sm" data-hk-save>ذخیره</button>' +
        "<h4 style=\"margin:16px 0 8px;font-size:.92rem\">داده‌های من</h4>" +
        '<div class="hk-quick">' +
          '<button class="hk-q" data-hk-backup>پشتیبان‌گیری</button>' +
          '<button class="hk-q" data-hk-restore>بازگردانی</button>' +
          '<button class="hk-q" data-hk-wipe>پاک کردن همهٔ داده‌ها</button>' +
        "</div>" +
      "</div>" +

      '<div class="hk-form">' +
        "<textarea data-hk-in rows=\"1\" placeholder=\"بنویس چه می‌خواهی… مثلاً «جزوهٔ علوم نهم را باز کن» یا «۲۰ سؤال بساز»\"></textarea>" +
        '<button class="hk-icon-btn" data-hk-mic title="گفتن با صدا">🎤</button>' +
        '<button class="btn btn-primary btn-sm" data-hk-send>اجرا کن</button>' +
      "</div>";

    D.body.appendChild(dr);

    el = {
      fab: fab, bd: bd, dr: dr,
      log: $("[data-hk-log]", dr),
      input: $("[data-hk-in]", dr),
      state: $("[data-hk-state]", dr)
    };

    bind(dr);
    hello();
  }

  /* -------------------------------------------------- چت و اجرای کارها */
  function bubble(role, html, extra) {
    var d = D.createElement("div");
    d.className = "hk-msg " + role;
    var av = role === "me" ? "من" : role === "act" ? "✓" : "AI";
    d.innerHTML = '<span class="av">' + av + '</span><div class="bub">' + html + (extra || "") + "</div>";
    el.log.appendChild(d);
    el.log.scrollTop = el.log.scrollHeight;
    return d;
  }

  function hello() {
    var tasks = (LS.get("g8:tasks", []) || []).filter(function (t) { return !t.done; }).length;
    bubble("ai", "سلام! من مشاور اجرایی تو هستم.\nمی‌توانم جزوه باز کنم، آزمون و فلش‌کارت بسازم، خلاصه کنم، یادداشت بنویسم، برنامهٔ مطالعه بچینم، خروجی PDF و فایل بدهم و خیلی کارهای دیگر.\n\n" +
      (tasks ? "الان " + fa(tasks) + " کار انجام‌نشده داری — تب «کارهای من» را ببین.\n\n" : "") +
      "ساده بنویس: «جزوهٔ علوم نهم را باز کن» یا «برنامهٔ ۱۰ روزه بده».");
  }

  function submit(text) {
    text = String(text == null ? el.input.value : text).trim();
    if (!text) return;
    el.input.value = "";
    el.input.style.height = "";
    bubble("me", esc(text));
    var wait = bubble("ai", '<span class="typing"><i></i><i></i><i></i></span>');

    if (!W.HK || !W.HK.Agent) {
      wait.querySelector(".bub").textContent = "موتور اجرا بارگذاری نشده است.";
      return;
    }
    setState("در حال انجام…", "on");

    W.HK.Agent.handle(text).then(function (res) {
      var bub = wait.querySelector(".bub");
      if (res.results && res.results.length) {
        wait.className = "hk-msg act";
        wait.querySelector(".av").textContent = "✓";
        var parts = res.results.map(function (r) {
          var head = (r.ok ? "✅ " : "⚠️ ") + (r.label ? "<b>" + esc(r.label) + "</b>: " : "");
          var body = esc(r.text || "");
          var list = "";
          if (r.list && r.list.length) {
            list = '<span class="src">' + r.list.map(function (x) {
              return '<a href="' + U(x.url) + '">' + esc(x.t) + "</a> <small>" + esc(x.m || "") + "</small>";
            }).join("<br>") + "</span>";
          }
          return head + "<br>" + body + list;
        }).join("<hr style='border:0;border-top:1px solid var(--border);margin:10px 0'>");
        bub.innerHTML = parts;
        setState(res.mode === "ai" ? "انجام شد (با هوش مصنوعی)" : "انجام شد", "on");
        if (W.HK.refreshTasks) W.HK.refreshTasks();
        if (W.HK.refreshPlan) W.HK.refreshPlan();
        if (W.HK.refreshNotes) W.HK.refreshNotes();
        if (W.HK.refreshMarks) W.HK.refreshMarks();
        return;
      }
      bub.innerHTML = esc(res.text || "تمام.") + (res.sources && res.sources.length
        ? '<span class="src">منابع: ' + res.sources.map(function (h) { return '<a href="' + U(h.url) + '">' + esc(h.t) + "</a>"; }).join(" · ") + "</span>" : "");
      setState(res.fallback ? "پاسخ آفلاین" : (res.online ? "متصل" : "آماده"), res.fallback ? "off" : "on");
      el.log.scrollTop = el.log.scrollHeight;
    }).catch(function (e) {
      wait.querySelector(".bub").textContent = "خطا: " + e.message;
      setState("خطا", "off");
    });
  }

  function setState(t, c) {
    if (!el.state) return;
    el.state.className = "ai-dot " + (c || "");
    el.state.title = t;
  }

  /* --------------------------------------------------- تب‌ها و رویدادها */
  function open(tab) {
    build();
    el.bd.classList.add("open");
    el.dr.classList.add("open");
    if (tab) showTab(tab);
    setTimeout(function () { if (window.innerWidth > 720 && el.input) el.input.focus(); }, 320);
  }
  function close() {
    if (el.bd) el.bd.classList.remove("open");
    if (el.dr) el.dr.classList.remove("open");
  }
  function showTab(name) {
    $$("[data-hk-tab]").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-hk-tab") === name); });
    $$("[data-hk-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-hk-pane") !== name; });
    if (name === "tasks" && W.HK.refreshTasks) W.HK.refreshTasks();
    if (name === "notes" && W.HK.refreshNotes) W.HK.refreshNotes();
    if (name === "marks" && W.HK.refreshMarks) W.HK.refreshMarks();
    if (name === "plan" && W.HK.refreshPlan) W.HK.refreshPlan();
    if (name === "do") renderDoList();
    if (name === "set") fillSettings();
  }

  function bind(root) {
    root.addEventListener("click", function (e) {
      var t = e.target;

      if (t.closest("[data-hk-close]")) return close();
      var tab = t.closest("[data-hk-tab]");
      if (tab) return showTab(tab.getAttribute("data-hk-tab"));

      var g = t.closest("[data-hk-go]");
      if (g) {
        var cmd = g.getAttribute("data-hk-go");
        var map = {
          "jozve-list": "فهرست جزوه‌ها را نشان بده", "help": "راهنما", "stats": "آمار من",
          "backup": "پشتیبان بگیر", "print": "چاپ کن"
        };
        return submit(map[cmd] || cmd);
      }
      var s = t.closest("[data-hk-say]");
      if (s) return submit(s.getAttribute("data-hk-say"));

      if (t.closest("[data-hk-send]")) return submit();

      if (t.closest("[data-hk-mic]")) {
        if (!W.HK.Agent) return;
        var rec = W.HK.Agent.listen(function (text) { submit(text); }, function (st) {
          setState(st === "start" ? "دارم گوش می‌دهم…" : "آماده", st === "start" ? "on" : "");
        });
        if (!rec) toast("مرورگر تو از ورودی صوتی پشتیبانی نمی‌کند");
        else setState("دارم گوش می‌دهم…", "on");
        return;
      }

      if (t.closest("[data-hk-task-add]")) {
        var inp = $("[data-hk-task-in]", root);
        var v = inp.value.trim();
        if (!v) return;
        var arr = LS.get("g8:tasks", []) || [];
        arr.unshift({ t: v, done: false, at: Date.now() });
        LS.set("g8:tasks", arr);
        inp.value = "";
        W.HK.refreshTasks();
        toast("کار اضافه شد");
        return;
      }
      var del = t.closest("[data-hk-task-del]");
      if (del) {
        var i = +del.getAttribute("data-hk-task-del");
        var a2 = LS.get("g8:tasks", []) || [];
        a2.splice(i, 1);
        LS.set("g8:tasks", a2);
        return W.HK.refreshTasks();
      }
      var chk = t.closest("[data-hk-task-chk]");
      if (chk) {
        var i2 = +chk.getAttribute("data-hk-task-chk");
        var a3 = LS.get("g8:tasks", []) || [];
        a3[i2].done = !a3[i2].done;
        LS.set("g8:tasks", a3);
        return W.HK.refreshTasks();
      }

      if (t.closest("[data-hk-plan-make]")) {
        return submit("برنامهٔ مطالعهٔ " + $("[data-hk-days]", root).value + " روزه با روزی " + $("[data-hk-hours]", root).value + " ساعت بساز");
      }
      if (t.closest("[data-hk-plan-print]")) {
        var rows = LS.get("g8:plan", null);
        if (!rows) return toast("اول برنامه بساز");
        var w = W.open("", "_blank");
        w.document.write("<!DOCTYPE html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><title>برنامهٔ مطالعه</title><style>body{font-family:Tahoma,sans-serif;line-height:2;padding:22px}h2{color:#4b3fd0}table{width:100%;border-collapse:collapse}td,th{border:1px solid #ccc;padding:8px}</style></head><body><h2>برنامهٔ مطالعهٔ من — رهنما</h2><table><tr><th>روز</th><th>برنامه</th></tr>" +
          rows.rows.map(function (r) { return "<tr><td>روز " + fa(r.d) + "</td><td>" + esc(r.items.join(" | ")) + "</td></tr>"; }).join("") +
          "</table></body></html>");
        w.document.close();
        setTimeout(function () { w.print(); }, 400);
        return;
      }

      var exp = t.closest("[data-hk-notes-export]");
      if (exp) return exportNotes();
      if (t.closest("[data-hk-notes-print]")) return printNotes();
      var nd = t.closest("[data-hk-note-del]");
      if (nd) {
        var k = +nd.getAttribute("data-hk-note-del");
        var arrN = LS.get("g8:notes:" + SUBJECT, []) || [];
        arrN.splice(k, 1);
        LS.set("g8:notes:" + SUBJECT, arrN);
        return W.HK.refreshNotes();
      }
      var mk = t.closest("[data-hk-mark-del]");
      if (mk) {
        var k2 = +mk.getAttribute("data-hk-mark-del");
        var arrM = LS.get("g8:marks", []) || [];
        arrM.splice(k2, 1);
        LS.set("g8:marks", arrM);
        return W.HK.refreshMarks();
      }

      var s2 = t.closest("[data-hk-set]");
      if (s2) return applySetting(s2.getAttribute("data-hk-set"));
      if (t.closest("[data-hk-save]")) {
        if (!W.AI2) return;
        W.AI2.config.mode = $("[data-hk-mode]", root).value;
        W.AI2.config.key = $("[data-hk-key]", root).value.trim();
        W.AI2.config.model = $("[data-hk-model]", root).value.trim();
        W.AI2.save();
        toast("تنظیمات ذخیره شد");
        return;
      }
      if (t.closest("[data-hk-backup]")) return submit("پشتیبان بگیر");
      if (t.closest("[data-hk-restore]")) return submit("بازگردانی کن");
      if (t.closest("[data-hk-wipe]")) {
        if (!confirm("همهٔ داده‌های این دستگاه (پیشرفت، یادداشت، نمره، کارها) پاک شود؟")) return;
        var keys = [];
        try { for (var i = 0; i < localStorage.length; i++) { var kk = localStorage.key(i); if (kk && kk.indexOf("g8:") === 0) keys.push(kk); } } catch (e) {}
        keys.forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
        toast("همهٔ داده‌ها پاک شد");
        setTimeout(function () { location.reload(); }, 800);
        return;
      }
    });

    root.addEventListener("keydown", function (e) {
      if (e.target === el.input && e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      if (e.target === el.input) {
        e.target.style.height = "auto";
        e.target.style.height = Math.min(150, e.target.scrollHeight) + "px";
      }
      if (e.target.hasAttribute && e.target.hasAttribute("data-hk-task-in") && e.key === "Enter") {
        e.preventDefault();
        $("[data-hk-task-add]", root).click();
      }
    });

    // ویرایش زندهٔ یادداشت‌ها
    root.addEventListener("input", function (e) {
      var ta = e.target.closest("[data-hk-note-text]");
      if (!ta) return;
      var i = +ta.getAttribute("data-hk-note-text");
      var arr = LS.get("g8:notes:" + SUBJECT, []) || [];
      if (!arr[i]) return;
      arr[i].t = ta.value;
      LS.set("g8:notes:" + SUBJECT, arr);
      var meta = ta.parentNode.querySelector(".meta");
      if (meta) meta.innerHTML = "ذخیره شد · " + new Date().toLocaleTimeString("fa-IR");
    });
  }

  /* -------------------------------------------------- محتوای تب‌ها */
  function renderDoList() {
    var host = $("[data-hk-dolist]");
    if (!host || !W.HK.Agent) return;
    var list = W.HK.Agent.list();
    host.innerHTML = "<h4 style='margin:0 0 8px;font-size:.92rem'>" + fa(list.length) + " کار که می‌توانم انجام دهم</h4>" +
      list.map(function (a) {
        return '<div class="hk-task"><span style="color:var(--accent);font-weight:900">◆</span><span class="t"><b>' + esc(a.label) + "</b><br><small style='color:var(--muted)'>" + esc(a.desc) + "</small></span></div>";
      }).join("") +
      "<p style='font-size:.79rem;color:var(--muted);line-height:1.9;margin-top:10px'>فقط کافی است با زبان خودت بگویی چه می‌خواهی؛ اگر درخواستت را نشناسم، از هوش مصنوعی آنلاین کمک می‌گیرم و بعد همان کار را انجام می‌دهم.</p>";
  }

  function refreshTasks() {
    var host = $("[data-hk-tasklist]");
    if (!host) return;
    var arr = LS.get("g8:tasks", []) || [];
    var open = arr.filter(function (t) { return !t.done; }).length;
    host.innerHTML = "<div class='hk-status'><span>باز: <b>" + fa(open) + "</b></span><span>کل: <b>" + fa(arr.length) + "</b></span></div>" +
      (arr.length ? arr.map(function (t, i) {
        return '<div class="hk-task' + (t.done ? " done" : "") + '">' +
          '<input type="checkbox" data-hk-task-chk="' + i + '"' + (t.done ? " checked" : "") + ">" +
          '<span class="t">' + esc(t.t) + "</span>" +
          '<button class="x" data-hk-task-del="' + i + '" title="حذف">✕</button></div>';
      }).join("") : "<p style='color:var(--muted);font-size:.84rem'>هنوز کاری نداری. از مشاور بخواه یا خودت اضافه کن.</p>");
  }

  function refreshPlan() {
    var host = $("[data-hk-plan]");
    if (!host) return;
    var p = LS.get("g8:plan", null);
    if (!p) { host.innerHTML = "<p style='color:var(--muted);font-size:.84rem'>هنوز برنامه‌ای نساخته‌ای. تعداد روز و ساعت را بگذار و «ساخت برنامه» را بزن.</p>"; return; }
    host.innerHTML = "<div class='hk-status'><span>برنامهٔ <b>" + fa(p.days) + "</b> روزه</span><span>روزی <b>" + fa(p.hours) + "</b> ساعت</span></div>" +
      p.rows.map(function (r) {
        return '<div class="hk-plan-row"><b>روز ' + fa(r.d) + "</b><div>" +
          r.items.map(function (x) { return "<div>" + esc(x) + "</div>"; }).join("") + "</div></div>";
      }).join("") +
      "<p style='font-size:.79rem;color:var(--muted)'>روز آخر را به مرور نکات کلیدی و حل یک آزمون بگذران.</p>";
  }

  function refreshNotes() {
    var host = $("[data-hk-notes]");
    if (!host) return;
    var arr = LS.get("g8:notes:" + SUBJECT, []) || [];
    if (!arr.length) { host.innerHTML = "<p style='color:var(--muted);font-size:.84rem'>یادداشتی نداری. متن یک درس را انتخاب کن و از منوی شناور «✎» را بزن، یا از مشاور بخواه.</p>"; return; }
    host.innerHTML = "<div class='hk-status'><span>یادداشت‌ها: <b>" + fa(arr.length) + "</b></span></div>" +
      arr.map(function (n, i) {
        return '<div class="hk-note-card">' +
          (n.q || n.title ? '<div class="qt">' + esc(n.q || n.title) + "</div>" : "") +
          '<textarea data-hk-note-text="' + i + '" placeholder="متن یادداشت…">' + esc(n.t || "") + "</textarea>" +
          '<div class="meta"><span>' + (n.at ? new Date(n.at).toLocaleString("fa-IR") : "") + "</span>" +
          '<span class="hk-spacer"></span><button class="x" data-hk-note-del="' + i + '">حذف</button></div></div>';
      }).join("");
  }

  function refreshMarks() {
    var host = $("[data-hk-marks]");
    if (!host) return;
    var arr = LS.get("g8:marks", []) || [];
    if (!arr.length) { host.innerHTML = "<p style='color:var(--muted);font-size:.84rem'>هنوز چیزی را نشان نکرده‌ای. در جزوه دکمهٔ «نشان‌گذاری» را بزن.</p>"; return; }
    host.innerHTML = "<div class='hk-status'><span>نشان‌ها: <b>" + fa(arr.length) + "</b></span></div>" +
      arr.map(function (m, i) {
        return '<div class="hk-task"><a href="' + esc(U(m.url)) + '" class="t" style="text-decoration:none;color:var(--text)">' +
          esc(m.title || m.url) + '</a><button class="x" data-hk-mark-del="' + i + '">✕</button></div>';
      }).join("");
  }

  function exportNotes() {
    var all = {};
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("g8:notes:") === 0) all[k.replace("g8:notes:", "")] = LS.get(k, []);
      }
    } catch (e) {}
    var txt = "# یادداشت‌های من — رهنما\n\n";
    Object.keys(all).forEach(function (s) {
      if (!all[s].length) return;
      txt += "## " + s + "\n\n";
      all[s].forEach(function (n) { txt += "- " + (n.q ? "«" + n.q + "» → " : "") + (n.t || "") + "\n"; });
      txt += "\n";
    });
    dl("my-notes.md", txt, "text/markdown;charset=utf-8");
    toast("یادداشت‌ها دانلود شد");
  }
  function printNotes() {
    var arr = LS.get("g8:notes:" + SUBJECT, []) || [];
    var w = W.open("", "_blank");
    w.document.write("<!DOCTYPE html><html lang='fa' dir='rtl'><head><meta charset='utf-8'><title>یادداشت‌ها</title><style>body{font-family:Tahoma;line-height:2;padding:22px}h2{color:#4b3fd0}.n{margin-bottom:12px;padding:8px;border:1px solid #ddd;border-radius:8px}.q{color:#666;font-size:.85em}</style></head><body><h2>یادداشت‌های من</h2>" +
      arr.map(function (n) { return "<div class='n'>" + (n.q ? "<div class='q'>" + esc(n.q) + "</div>" : "") + esc(n.t || "") + "</div>"; }).join("") +
      "</body></html>");
    w.document.close();
    setTimeout(function () { w.print(); }, 400);
  }

  function dl(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var a = D.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    D.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  function fillSettings() {
    if (!W.AI2) return;
    var m = $("[data-hk-mode]"), k = $("[data-hk-key]"), mo = $("[data-hk-model]");
    if (m) m.value = W.AI2.config.mode || "auto";
    if (k) k.value = W.AI2.config.key || "";
    if (mo) mo.value = W.AI2.config.model || "";
  }

  function applySetting(what) {
    var b = D.body;
    var fKey = "g8:ui:font", lhKey = "g8:ui:lh";
    if (what === "dark") { b.classList.remove("hk-sepia"); D.documentElement.setAttribute("data-theme", "dark"); LS.set("g8:uiTheme", "dark"); }
    if (what === "light") { b.classList.remove("hk-sepia"); D.documentElement.setAttribute("data-theme", "light"); LS.set("g8:uiTheme", "light"); }
    if (what === "sepia") { D.documentElement.setAttribute("data-theme", "light"); b.classList.toggle("hk-sepia"); }
    if (what === "fontUp" || what === "fontDn") {
      var cur = LS.get(fKey, 2);
      var nx = what === "fontUp" ? Math.min(4, cur + 1) : Math.max(1, cur - 1);
      for (var i = 1; i <= 4; i++) b.classList.remove("hk-font-" + i);
      b.classList.add("hk-font-" + nx);
      LS.set(fKey, nx);
      toast("اندازهٔ متن: " + fa(nx));
    }
    if (what === "lhUp" || what === "lhDn") {
      var cur2 = LS.get(lhKey, 2);
      var nx2 = what === "lhUp" ? Math.min(3, cur2 + 1) : Math.max(1, cur2 - 1);
      for (var j = 1; j <= 3; j++) b.classList.remove("hk-lh-" + j);
      b.classList.add("hk-lh-" + nx2);
      LS.set(lhKey, nx2);
      toast("فاصلهٔ خطوط: " + fa(nx2));
    }
    if (what === "focus") { b.classList.toggle("hk-focus"); LS.set("g8:uiFocus", b.classList.contains("hk-focus")); }
  }

  /* ------------------------------------------------------ راه‌اندازی */
  function boot() {
    build();
    // پنجرهٔ شناور در همهٔ صفحه‌ها؛ پنل با دکمهٔ گفت‌وگو یا کلیدهای میان‌بر
    D.addEventListener("keydown", function (e) {
      if (e.key === "Escape") close();
      if (e.key === "i" && e.altKey) { e.preventDefault(); open(); }
    });
    W.HK = W.HK || {};
    W.HK.openPanel = open;
    W.HK.closePanel = close;
    W.HK.refreshTasks = refreshTasks;
    W.HK.refreshNotes = refreshNotes;
    W.HK.refreshMarks = refreshMarks;
    W.HK.refreshPlan = refreshPlan;
    W.HK.refreshAll = function () { refreshTasks(); refreshNotes(); refreshMarks(); refreshPlan(); };
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
