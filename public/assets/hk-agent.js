/* ==========================================================================
   رهنما — موتور اجرای درخواست‌ها  |  hk-agent.js
   هوش مصنوعی فقط «جواب» نمی‌دهد؛ درخواست‌ها را روی همین دستگاه **عملی** می‌کند:
   باز کردن جزوه، ساختن آزمون و فلش‌کارت، خلاصه‌سازی، علامت‌گذاری، یادداشت،
   برنامهٔ مطالعه، خروجی گرفتن، جست‌وجو، چاپ، خواندن صوتی و ده‌ها کار دیگر.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var GRADE_NAME = { "7": "هفتم", "8": "هشتم", "9": "نهم" };
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return NFA[+d]; }); };

  /* ---------------------------------------------------------- ابزار متن */
  function norm(s) {
    return String(s || "")
      .replace(/[\u200c\u200e\u200f]/g, " ")
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/[أإآ]/g, "ا")
      .replace(/[؟?!.,،:;«»"'()\[\]\-_–—]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
  function nfa(s) { // تبدیل ارقام فارسی به لاتین
    return String(s || "").replace(/[۰-۹]/g, function (d) { return NFA.indexOf(d); });
  }

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del: function (k) { try { localStorage.removeItem(k); } catch (e) {} },
    keys: function () { var out = []; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("g8:") === 0) out.push(k); } } catch (e) {} return out; }
  };

  function grade() {
    var q = new URLSearchParams(location.search).get("g");
    return ["7", "8", "9"].indexOf(q) > -1 ? q : (D.body.getAttribute("data-grade") || "8");
  }
  function toast(m, ms) { W.HK && W.HK.toast ? W.HK.toast(m, ms) : null; }

  /* ------------------------------------------------------- نمایه‌های سایت */
  var CACHE = {};
  function fetchJson(p) {
    if (CACHE[p]) return Promise.resolve(CACHE[p]);
    var load = (W.G8 && W.G8.jsonLoad) ? W.G8.jsonLoad(p) : fetch(U(p)).then(function (r) { return r.json(); });
    return load.then(function (j) { CACHE[p] = j; return j; }).catch(function () { return null; });
  }
  function searchIndex() { return fetchJson("assets/search-index.json").then(function (j) { return j || []; }); }
  function jozveIndex() { return fetchJson("assets/jozve-index.json").then(function (j) { return j || {}; }); }

  /* ------------------------------------------- یافتن درس/کتاب نزدیک به متن */
  function findUnits(query, limit) {
    var q = norm(query);
    if (!q) return Promise.resolve([]);
    var terms = q.split(" ").filter(function (t) { return t.length > 1; });
    return searchIndex().then(function (rows) {
      var g = grade();
      var scored = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        var hay = norm(r.t + " " + r.bn + " " + r.s);
        var sc = 0;
        for (var k = 0; k < terms.length; k++) {
          var t = terms[k];
          if (norm(r.t).indexOf(t) > -1) sc += 4;
          else if (hay.indexOf(t) > -1) sc += 1.5;
        }
        if (!sc) continue;
        if (r.g === g) sc += 1;
        scored.push({ r: r, sc: sc });
      }
      scored.sort(function (a, b) { return b.sc - a.sc; });
      return scored.slice(0, limit || 5).map(function (x) { return x.r; });
    });
  }

  /* --------------------------------------------------------- فهرست کارها */
  var SUBS = {
    math: ["ریاضی", "math"], science: ["علوم", "علوم تجربی", "science"], farsi: ["فارسی", "farsi"],
    negaresh: ["نگارش", "انشا", "negaresh"], arabic: ["عربی", "arabic"], english: ["انگلیسی", "زبان", "english"],
    social: ["مطالعات", "اجتماعی", "social"], religion: ["دینی", "پیام‌های آسمان", "religion"],
    quran: ["قرآن", "quran"], tech: ["کار و فناوری", "فناوری", "tech"], art: ["هنر", "فرهنگ", "art"],
    thinking: ["تفکر", "سبک زندگی", "thinking"], defa: ["دفاعی", "آمادگی دفاعی", "defa"]
  };

  function detectSubject(text) {
    var q = norm(text);
    var keys = Object.keys(SUBS);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      for (var j = 0; j < SUBS[k].length; j++) {
        if (q.indexOf(norm(SUBS[k][j])) > -1) return k;
      }
    }
    return null;
  }
  function detectGrade(text) {
    var q = norm(text);
    if (/\b7\b|هفتم|۷/.test(q)) return "7";
    if (/\b8\b|هشتم|۸/.test(q)) return "8";
    if (/\b9\b|نهم|۹/.test(q)) return "9";
    return null;
  }
  function detectCount(text, dflt) {
    var m = nfa(String(text || "")).match(/(\d{1,2})\s*(سؤال|سوال|پرسش|تست|کارت|flashcard)?/);
    return m ? Math.max(1, Math.min(40, parseInt(m[1], 10))) : dflt;
  }

  /* =========================================================== کارها */
  var ACTIONS = {

    help: {
      label: "راهنما",
      desc: "فهرست کارهایی که می‌توانم انجام دهم",
      run: function () {
        var list = [];
        Object.keys(ACTIONS).forEach(function (k) {
          if (k === "help") return;
          list.push("• " + ACTIONS[k].desc);
        });
        return Promise.resolve({ text: "این کارها را می‌توانم همین حالا برایت انجام دهم:\n\n" + list.join("\n") + "\n\nمی‌توانی ساده بنویسی، مثلاً: «جزوهٔ ریاضی هشتم را باز کن»، «۱۰ سؤال بساز»، «این درس را خلاصه کن»، «برنامهٔ مطالعهٔ یک‌هفته‌ای بده»." });
      }
    },

    goto: {
      label: "رفتن به صفحه",
      desc: "باز کردن هر صفحهٔ سایت (مثلاً «کارنامه را باز کن»)",
      run: function (a) {
        location.href = U(a.url);
        return { text: "رفتم به: " + a.url };
      }
    },

    "open-jozve": {
      label: "باز کردن جزوه",
      desc: "باز کردن جزوهٔ کامل یک درس (مثلاً «جزوهٔ علوم نهم را باز کن»)",
      run: function (a) {
        var g = a.grade || grade();
        var s = a.subject;
        if (!s) return searchJozve(a.q);
        location.href = U("jozve/" + g + "/" + s + ".html");
        return { text: "جزوهٔ " + (SUBS[s] ? SUBS[s][0] : s) + " پایهٔ " + (GRADE_NAME[g] || "") + " را باز کردم." };
      }
    },

    "jozve-list": {
      label: "فهرست جزوه‌ها",
      desc: "نمایش فهرست ۳۶ جزوهٔ کامل",
      run: function () { location.href = U("jozve.html" + (grade() === "8" ? "" : "?g=" + grade())); return { text: "فهرست جزوه‌ها را باز کردم." }; }
    },

    "open-lesson": {
      label: "باز کردن درس",
      desc: "باز کردن مستقیم یک درس (مثلاً «درس هم‌نهشتی مثلث‌ها را باز کن»)",
      run: function (a) {
        return findUnits(a.q, 6).then(function (hits) {
          if (!hits.length) return { text: "درسی با این عنوان پیدا نکردم. کمی دقیق‌تر بنویس، مثلاً «عدد گویا» یا «تجوید»." };
          location.href = U(hits[0].url);
          return { text: "درس «" + hits[0].t + "» از " + hits[0].bn + " را باز کردم." + (hits.length > 1 ? "\n\nدرس‌های نزدیک دیگر: " + hits.slice(1, 4).map(function (h) { return h.t; }).join("، ") : "") };
        });
      }
    },

    search: {
      label: "جست‌وجو",
      desc: "جست‌وجو در همهٔ ۶۰۹ درس (مثلاً «قانون نیوتن را پیدا کن»)",
      run: function (a) {
        return findUnits(a.q, 8).then(function (hits) {
          if (!hits.length) return { text: "چیزی پیدا نکردم. با واژه‌های خود کتاب امتحان کن." };
          return {
            text: "این نتایج را پیدا کردم:",
            list: hits.map(function (h) { return { t: h.t, m: h.bn + " — پایهٔ " + (GRADE_NAME[h.g] || ""), url: U(h.url) }; })
          };
        });
      }
    },

    print: {
      label: "چاپ / PDF",
      desc: "چاپ صفحهٔ فعلی یا ذخیرهٔ آن به‌صورت PDF",
      run: function () {
        $$("details.panel").forEach(function (p) { p.setAttribute("open", ""); });
        setTimeout(function () { W.print(); }, 220);
        return { text: "پنجرهٔ چاپ باز شد. در بخش مقصد، «Save as PDF» را انتخاب کن تا فایل PDF بگیری." };
      }
    },

    "mark-read": {
      label: "علامت خوانده‌شده",
      desc: "علامت‌زدن درس‌های فعلی به‌عنوان خوانده‌شده",
      run: function (a) {
        var subject = D.body.getAttribute("data-subject") || "jozve";
        var g = grade();
        var lessons = $$("article.lesson");
        if (!lessons.length) return { text: "در این صفحه درسی پیدا نکردم." };
        var n = 0;
        lessons.forEach(function (l) {
          var id = l.id || "x";
          if (a.single && n > 0) return;
          LS.set("g8:read:" + subject + ":" + id, true);
          var b = $(".read-toggle", l);
          if (b) { b.setAttribute("aria-pressed", "true"); b.classList.add("on"); }
          n++;
        });
        return { text: n + " درس را خوانده‌شده علامت زدم. پیشرفتت را در «کارنامه» ببین." };
      }
    },

    "read-aloud": {
      label: "خواندن صوتی",
      desc: "خواندن متن درس با صدای بلند",
      run: function (a) {
        if (!("speechSynthesis" in W)) return { text: "مرورگر تو از خواندن صوتی پشتیبانی نمی‌کند." };
        stopSpeech();
        var txt = collectText(a.scope === "lesson" ? firstVisibleLesson() : D.querySelector("main"));
        txt = txt.slice(0, 6000);
        if (!txt) return { text: "متنی برای خواندن پیدا نکردم." };
        var u = new SpeechSynthesisUtterance(txt);
        u.lang = "fa-IR"; u.rate = 0.98;
        var voices = W.speechSynthesis.getVoices();
        var v = voices.filter(function (x) { return /fa|iran|persian/i.test(x.lang + " " + x.name); })[0];
        if (v) u.voice = v;
        W.speechSynthesis.speak(u);
        return { text: "شروع به خواندن کردم. برای توقف بگو «توقف صدا» یا دکمهٔ توقف را بزن." };
      }
    },

    "stop-voice": {
      label: "توقف صدا",
      desc: "متوقف کردن خواندن صوتی",
      run: function () { stopSpeech(); return { text: "خواندن صوتی متوقف شد." }; }
    },

    theme: {
      label: "تم",
      desc: "تغییر ظاهر: «حالت شب»، «حالت روز»، «حالت سپیا»",
      run: function (a) {
        var m = a.mode || "toggle";
        if (m === "sepia") { D.documentElement.setAttribute("data-theme", "light"); D.body.classList.add("hk-sepia"); }
        else if (m === "dark") { D.body.classList.remove("hk-sepia"); D.documentElement.setAttribute("data-theme", "dark"); }
        else if (m === "light") { D.body.classList.remove("hk-sepia"); D.documentElement.setAttribute("data-theme", "light"); }
        else {
          var cur = D.documentElement.getAttribute("data-theme");
          D.documentElement.setAttribute("data-theme", cur === "dark" ? "light" : "dark");
        }
        LS.set("g8:uiTheme", D.documentElement.getAttribute("data-theme"));
        return { text: "ظاهر صفحه را عوض کردم." };
      }
    },

    font: {
      label: "اندازهٔ متن",
      desc: "بزرگ یا کوچک کردن متن («متن را بزرگ‌تر کن»)",
      run: function (a) {
        var cur = LS.get("g8:uiFont", 2);
        var next = a.dir === "up" ? Math.min(4, cur + 1) : a.dir === "down" ? Math.max(1, cur - 1) : (a.size || 2);
        for (var i = 1; i <= 4; i++) D.body.classList.remove("hk-font-" + i);
        D.body.classList.add("hk-font-" + next);
        LS.set("g8:uiFont", next);
        return { text: "اندازهٔ متن را روی سطح " + fa(next) + " گذاشتم." };
      }
    },

    spacing: {
      label: "فاصلهٔ خطوط",
      desc: "کم یا زیاد کردن فاصلهٔ خطوط برای راحتی خواندن",
      run: function (a) {
        var cur = LS.get("g8:uiLh", 2);
        var next = a.dir === "up" ? Math.min(3, cur + 1) : a.dir === "down" ? Math.max(1, cur - 1) : 2;
        for (var i = 1; i <= 3; i++) D.body.classList.remove("hk-lh-" + i);
        D.body.classList.add("hk-lh-" + next);
        LS.set("g8:uiLh", next);
        return { text: "فاصلهٔ خطوط را روی سطح " + fa(next) + " گذاشتم." };
      }
    },

    focus: {
      label: "حالت تمرکز",
      desc: "روشن/خاموش کردن حالت تمرکز برای خواندن بدون حواس‌پرتی",
      run: function () {
        D.body.classList.toggle("hk-focus");
        var on = D.body.classList.contains("hk-focus");
        LS.set("g8:uiFocus", on);
        return { text: on ? "حالت تمرکز روشن شد." : "حالت تمرکز خاموش شد." };
      }
    },

    ruler: {
      label: "خط‌کش مطالعه",
      desc: "خط‌کش مطالعه را برای دنبال‌کردن خطوط روشن کن",
      run: function () {
        D.body.classList.toggle("hk-ruler-on");
        if (!$(".hk-ruler")) {
          var r = D.createElement("div"); r.className = "hk-ruler"; D.body.appendChild(r);
          var move = function (e) {
            if (!D.body.classList.contains("hk-ruler-on")) return;
            var y = (e.touches ? e.touches[0].clientY : e.clientY) - 23;
            r.style.top = y + "px";
          };
          D.addEventListener("mousemove", move, { passive: true });
          D.addEventListener("touchmove", move, { passive: true });
        }
        var on = D.body.classList.contains("hk-ruler-on");
        return { text: on ? "خط‌کش مطالعه روشن شد؛ با حرکت انگشت یا ماوس جابه‌جا می‌شود." : "خط‌کش مطالعه خاموش شد." };
      }
    },

    "make-quiz": {
      label: "ساختن آزمون",
      desc: "ساختن آزمون چهارگزینه‌ای از همین جزوه (مثلاً «۲۰ سؤال بساز»)",
      run: function (a) {
        if (!W.HK || !W.HK.jozve || !W.HK.jozve.quiz) return { text: "این کار روی صفحهٔ جزوه در دسترس است. اول یک جزوه را باز کن." };
        var n = a.count || 10;
        W.HK.jozve.quiz(n);
        return { text: "آزمون " + fa(n) + " سؤالی از همین جزوه ساختم — در بالای صفحه ببین." };
      }
    },

    "make-flashcards": {
      label: "ساختن فلش‌کارت",
      desc: "ساختن فلش‌کارت خودکار از نکات کلیدی همین جزوه",
      run: function (a) {
        if (!W.HK || !W.HK.jozve || !W.HK.jozve.flashcards) return { text: "اول یک جزوه را باز کن تا فلش‌کارت بسازم." };
        W.HK.jozve.flashcards(a.count || 12);
        return { text: "فلش‌کارت‌ها را از نکات کلیدی همین جزوه ساختم — در بالای صفحه ببین." };
      }
    },

    summarize: {
      label: "خلاصه‌سازی درس",
      desc: "خلاصه کردن درس فعلی (آفلاین از نکات کلیدی، آنلاین با هوش مصنوعی)",
      run: function (a) {
        var lesson = pickLesson(a);
        if (!lesson) return { text: "درسی در این صفحه پیدا نکردم. یک جزوه را باز کن." };
        var title = ($("h2", lesson) || {}).textContent || "";
        var points = $$(".panel-body li", lesson).slice(0, 14).map(function (li) { return li.textContent.trim(); });
        var concept = ($(".panel-body p", lesson) || {}).textContent || "";
        var base = "درس: " + title + "\n\n" + concept.slice(0, 400) + "\n\nنکات: " + points.join(" | ");
        if (W.AI2 && W.AI2.config && (W.AI2.config.key || W.AI2.config.mode === "proxy")) {
          return W.AI2.ask("این درس را در ۵ خط و خیلی ساده خلاصه کن و آخرش ۳ نکتهٔ امتحانی بنویس:\n\n" + base)
            .then(function (r) { return { text: r.text, ai: true }; });
        }
        return { text: "خلاصهٔ سریع «" + title + "»:\n\n" + points.slice(0, 8).map(function (p, i) { return fa(i + 1) + ") " + p; }).join("\n") };
      }
    },

    "add-note": {
      label: "یادداشت",
      desc: "ثبت یادداشت روی همین درس (روی دستگاه خودت ذخیره می‌شود)",
      run: function (a) {
        var t = String(a.text || "").trim();
        if (!t) return { text: "متن یادداشت را بنویس، مثلاً: «یادداشت: فرمول مساحت دایره را یاد بگیرم»." };
        var subject = D.body.getAttribute("data-subject") || "jozve";
        var arr = LS.get("g8:notes:" + subject, []) || [];
        arr.push({ t: t, at: Date.now(), title: ($("h2") || {}).textContent || "" });
        LS.set("g8:notes:" + subject, arr);
        if (W.HK && W.HK.refreshNotes) W.HK.refreshNotes();
        return { text: "یادداشت ثبت شد. در پنل مشاور، تب «یادداشت‌ها» می‌توانی همه را ببینی و خروجی بگیری." };
      }
    },

    highlight: {
      label: "برجسته‌سازی",
      desc: "برجسته کردن متن (متن را انتخاب کن و رنگ بزن، یا بگو «مهم‌ها را زرد کن»)",
      run: function (a) {
        if (W.HK && W.HK.highlightSelection) {
          var ok = W.HK.highlightSelection(a.color || "y");
          return { text: ok ? "متن انتخاب‌شده را برجسته کردم." : "اول یک متن را با انگشت یا ماوس انتخاب کن، بعد بگو برجسته‌اش کنم." };
        }
        return { text: "این کار روی صفحهٔ جزوه در دسترس است." };
      }
    },

    bookmark: {
      label: "نشان‌گذاری",
      desc: "نشان‌گذاری صفحه یا درس فعلی برای برگشت سریع",
      run: function () {
        var arr = LS.get("g8:marks", []) || [];
        var item = { url: location.pathname + location.hash, title: D.title.split("—")[0].trim(), at: Date.now() };
        if (!arr.some(function (x) { return x.url === item.url; })) arr.unshift(item);
        LS.set("g8:marks", arr.slice(0, 80));
        return { text: "این صفحه را نشان‌گذاری کردم: «" + item.title + "»" };
      }
    },

    "study-plan": {
      label: "برنامهٔ مطالعه",
      desc: "ساختن برنامهٔ مطالعه (مثلاً «برنامهٔ ۱۰ روزه با روزی ۳ ساعت بده»)",
      run: function (a) {
        var days = a.days || 7, hours = a.hours || 3;
        var picked = (a.subjects && a.subjects.length) ? a.subjects : ["ریاضی", "علوم", "فارسی", "عربی", "انگلیسی"];
        var per = hours >= 4 ? 3 : hours >= 3 ? 2 : 1;
        var slots = ["۱۶:۰۰–۱۷:۰۰", "۱۷:۱۵–۱۸:۱۵", "۱۸:۳۰–۱۹:۳۰", "۱۹:۴۵–۲۰:۴۵", "۲۱:۰۰–۲۲:۰۰"];
        var rows = [], k = 0;
        for (var d = 1; d <= days; d++) {
          var items = [];
          for (var i = 0; i < per; i++) { items.push(picked[k % picked.length]); k++; }
          rows.push({ d: d, items: items.map(function (t, j) { return t + " — " + slots[j % slots.length]; }) });
        }
        LS.set("g8:plan", { days: days, hours: hours, rows: rows, at: Date.now() });
        if (W.HK && W.HK.refreshPlan) W.HK.refreshPlan();
        return { text: "برنامهٔ " + fa(days) + "-روزه با روزی " + fa(hours) + " ساعت را ساختم و ذخیره کردم. در پنل مشاور، تب «برنامه» می‌توانی ببینی، ویرایش کنی و چاپ بگیری." };
      }
    },

    "add-task": {
      label: "افزودن کار",
      desc: "افزودن کار به فهرست کارهای من (مثلاً «کار اضافه کن: فصل ۳ ریاضی را بخوانم»)",
      run: function (a) {
        var t = String(a.text || "").trim();
        if (!t) return { text: "متن کار را بنویس." };
        var arr = LS.get("g8:tasks", []) || [];
        arr.unshift({ t: t, done: false, at: Date.now() });
        LS.set("g8:tasks", arr);
        if (W.HK && W.HK.refreshTasks) W.HK.refreshTasks();
        return { text: "به فهرست کارهایت اضافه کردم: «" + t + "»" };
      }
    },

    "show-report": {
      label: "کارنامه",
      desc: "نمایش کارنامهٔ تحلیلی و پیشرفت",
      run: function () { location.href = U("report.html" + (grade() === "8" ? "" : "?g=" + grade())); return { text: "کارنامهٔ تحلیلی را باز کردم." }; }
    },

    "show-progress": {
      label: "پیشرفت",
      desc: "نمایش پیشرفت مطالعه در همین صفحه",
      run: function () {
        var lessons = $$("article.lesson").length;
        var subject = D.body.getAttribute("data-subject") || "";
        var read = $$("article.lesson").filter(function (l) { return LS.get("g8:read:" + subject + ":" + l.id, false); }).length;
        var exams = LS.get("g8:exams", []) || [];
        var tasks = (LS.get("g8:tasks", []) || []).filter(function (t) { return !t.done; }).length;
        var marks = (LS.get("g8:marks", []) || []).length;
        return {
          text: "وضعیت تو تا این لحظه:\n\n• درس‌های این صفحه: " + fa(read) + " از " + fa(lessons) +
            "\n• آزمون‌های جامع: " + fa(exams.length) +
            "\n• کارهای انجام‌نشده: " + fa(tasks) +
            "\n• نشان‌گذاری‌ها: " + fa(marks)
        };
      }
    },

    export: {
      label: "خروجی گرفتن",
      desc: "خروجی گرفتن از جزوه: «خروجی مارک‌داون بده»، «خروجی HTML بده»",
      run: function (a) {
        if (!W.HK || !W.HK.jozve || !W.HK.jozve.export) return { text: "این کار روی صفحهٔ جزوه در دسترس است." };
        W.HK.jozve.export(a.format || "md");
        return { text: "فایل خروجی ساخته شد و دانلود شد." };
      }
    },

    backup: {
      label: "پشتیبان‌گیری",
      desc: "گرفتن نسخهٔ پشتیبان از همهٔ داده‌های من (پیشرفت، یادداشت، نمره…)",
      run: function () {
        var data = {};
        LS.keys().forEach(function (k) { data[k] = LS.get(k, null); });
        var blob = new Blob([JSON.stringify({ app: "رهنما", at: new Date().toISOString(), data: data }, null, 2)], { type: "application/json" });
        var a2 = D.createElement("a");
        a2.href = URL.createObjectURL(blob);
        a2.download = "hampish-backup-" + new Date().toISOString().slice(0, 10) + ".json";
        a2.click();
        return { text: "فایل پشتیبان ساخته و دانلود شد. هر وقت خواستی می‌توانم بازگردانی‌اش کنم." };
      }
    },

    restore: {
      label: "بازگردانی پشتیبان",
      desc: "بازگردانی داده‌ها از فایل پشتیبان",
      run: function () {
        var inp = D.createElement("input");
        inp.type = "file"; inp.accept = ".json,application/json";
        inp.onchange = function () {
          var f = inp.files[0]; if (!f) return;
          var fr = new FileReader();
          fr.onload = function () {
            try {
              var j = JSON.parse(fr.result);
              var d = j.data || j;
              Object.keys(d).forEach(function (k) { if (k.indexOf("g8:") === 0) LS.set(k, d[k]); });
              toast("داده‌ها بازگردانی شد؛ صفحه دوباره بارگذاری می‌شود.");
              setTimeout(function () { location.reload(); }, 900);
            } catch (e) { toast("فایل پشتیبان معتبر نبود."); }
          };
          fr.readAsText(f);
        };
        inp.click();
        return { text: "فایل پشتیبان را انتخاب کن." };
      }
    },

    share: {
      label: "اشتراک‌گذاری",
      desc: "اشتراک‌گذاری صفحه در گوشی",
      run: function () {
        var data = { title: D.title, text: "رهنما — جزوه و آزمون متوسطهٔ اول", url: location.href };
        if (navigator.share) { navigator.share(data).catch(function () {}); return { text: "پنجرهٔ اشتراک‌گذاری باز شد." }; }
        if (navigator.clipboard) { navigator.clipboard.writeText(location.href); return { text: "لینک این صفحه کپی شد." }; }
        return { text: location.href };
      }
    },

    "offline-save": {
      label: "ذخیرهٔ آفلاین",
      desc: "ذخیرهٔ همین جزوه برای مطالعهٔ بدون اینترنت",
      run: function () {
        if (!("serviceWorker" in navigator)) return { text: "این مرورگر از ذخیرهٔ آفلاین پشتیبانی نمی‌کند." };
        navigator.serviceWorker.ready.then(function () {
          toast("این صفحه برای مطالعهٔ آفلاین ذخیره شد.");
        }).catch(function () { toast("ذخیرهٔ آفلاین آماده نشد."); });
        return { text: "این صفحه در حافظهٔ آفلاین مرورگر ذخیره می‌شود؛ بعداً بدون اینترنت هم باز می‌شود." };
      }
    },

    stats: {
      label: "آمار من",
      desc: "نمایش آمار کلی مطالعه من",
      run: function () {
        var exams = LS.get("g8:exams", []) || [];
        var avg = exams.length ? Math.round(exams.reduce(function (a, e) { return a + (e.pct || 0); }, 0) / exams.length) : 0;
        var notes = 0, reads = 0;
        LS.keys().forEach(function (k) {
          if (k.indexOf("g8:notes:") === 0) notes += (LS.get(k, []) || []).length;
          if (k.indexOf("g8:read:") === 0 && LS.get(k, false)) reads++;
        });
        return { text: "آمار تو:\n\n• درس‌های خوانده‌شده: " + fa(reads) + "\n• آزمون‌ها: " + fa(exams.length) + " (میانگین " + fa(avg) + "٪)\n• یادداشت‌ها: " + fa(notes) };
      }
    }
  };

  /* -------------------------------------------------- ابزارهای کمکی */
  function stopSpeech() { try { W.speechSynthesis.cancel(); } catch (e) {} }
  function collectText(root) {
    if (!root) return "";
    return $$("p, li, h2, h3, .panel-body, .c-title", root)
      .map(function (e) { return (e.textContent || "").trim(); })
      .filter(function (t) { return t.length > 24; })
      .join(". ");
  }
  function firstVisibleLesson() {
    var ls = $$("article.lesson");
    var best = null;
    for (var i = 0; i < ls.length; i++) {
      var r = ls[i].getBoundingClientRect();
      if (r.top >= -60 && r.top < W.innerHeight) { best = ls[i]; break; }
    }
    return best || ls[0] || null;
  }
  function pickLesson(a) {
    if (a && a.index) return $$("article.lesson")[a.index - 1] || null;
    var h = (location.hash || "").replace("#", "");
    if (h) { var el = D.getElementById(h); if (el && el.classList.contains("lesson")) return el; }
    return firstVisibleLesson();
  }
  function searchJozve(q) {
    var s = detectSubject(q), g = detectGrade(q) || grade();
    if (s) { location.href = U("jozve/" + g + "/" + s + ".html"); return Promise.resolve({ text: "جزوهٔ " + SUBS[s][0] + " پایهٔ " + (GRADE_NAME[g] || "") + " را باز کردم." }); }
    return jozveIndex().then(function (idx) {
      var q2 = norm(q);
      var hit = null;
      ["7", "8", "9"].forEach(function (gg) {
        (idx[gg] || []).forEach(function (b) {
          if (!hit && q2 && (q2.indexOf(norm(b.name)) > -1 || norm(b.name).indexOf(q2) > -1)) hit = { g: gg, b: b };
        });
      });
      if (hit) { location.href = U("jozve/" + hit.g + "/" + hit.b.key + ".html"); return { text: "جزوهٔ " + hit.b.name + " (پایهٔ " + (GRADE_NAME[hit.g] || "") + ") را باز کردم." }; }
      return { text: "کدام جزوه را باز کنم؟ مثلاً بگو «جزوهٔ ریاضی هشتم»." };
    });
  }

  /* ============================================ تحلیل درخواست کاربر */
  function localPlan(text) {
    var q = norm(text);
    var has = function () {
      for (var i = 0; i < arguments.length; i++) {
        var n = norm(arguments[i]);
        if (!n) continue;                 // رشتهٔ خالی باعث تطبیق نادرست می‌شود
        if (q.indexOf(n) > -1) return true;
      }
      return false;
    };
    // تطبیق «واژهٔ کامل» — برای واژه‌های کوتاه مثل «تم» که در «هشتم» هم پیدا می‌شوند
    var hasWord = function () {
      var padded = " " + q + " ";
      for (var i = 0; i < arguments.length; i++) {
        var n = norm(arguments[i]);
        if (!n) continue;
        if (padded.indexOf(" " + n + " ") > -1) return true;
      }
      return false;
    };
    var subj = detectSubject(text), g = detectGrade(text);

    if (has("راهنما", "چیکار", "چه کاری", "کمک", "help")) return [{ type: "help" }];
    if (has("کارنامه", "نمره‌هام", "نمره هام", "وضعیت من", "پیشرفت کلی")) return [{ type: "show-report" }];
    if (has("پیشرفت من", "چقدر خوندم", "چقد خوندم")) return [{ type: "show-progress" }];
    if (has("آمار")) return [{ type: "stats" }];
    if (has("پشتیبان", "بکاپ", "backup")) return [{ type: "backup" }];
    if (has("بازگردانی", "ریستور", "restore")) return [{ type: "restore" }];
    if (has("چاپ کن", "پرینت", "پی دی اف", "pdf")) return [{ type: "print" }];
    if (has("فلش کارت", "فلش‌کارت", "کارت")) return [{ type: "make-flashcards", count: detectCount(text, 12) }];
    if (has("سوال بساز", "سؤال بساز", "سوال بده", "آزمون بساز", "تست بساز", "امتحان بگیر")) return [{ type: "make-quiz", count: detectCount(text, 10) }];
    if (has("خلاصه کن", "خلاصه بده", "جمع بندی", "جمع‌بندی")) return [{ type: "summarize" }];
    if (has("بخون", "بلند بخون", "صوتی", "گوش بدم")) return [{ type: "read-aloud", scope: "page" }];
    if (has("ساکت", "توقف صدا", "بس کن")) return [{ type: "stop-voice" }];
    if (has("تمرکز")) return [{ type: "focus" }];
    if (has("حالت شب", "تاریک")) return [{ type: "theme", mode: "dark" }];
    if (has("حالت روز", "روشن")) return [{ type: "theme", mode: "light" }];
    if (has("سپیا", "کاغذی", "چشام درد")) return [{ type: "theme", mode: "sepia" }];
    if (hasWord("تم")) return [{ type: "theme", mode: "toggle" }];
    if (has("بزرگ تر", "بزرگ‌تر", "بزرگتر")) return [{ type: "font", dir: "up" }];
    if (has("کوچک تر", "کوچک‌تر", "کوچکتر")) return [{ type: "font", dir: "down" }];
    if (has("فاصله")) return [{ type: "spacing", dir: has("کم") ? "down" : "up" }];
    if (has("خط کش", "خط‌کش")) return [{ type: "ruler" }];
    if (has("یادداشت", "نوت")) {
      var t = String(text).replace(/^[^:：]*[:：]\s*/, "").replace(/یادداشت( بنویس| کن| اضافه کن)?/, "").trim();
      var raw = String(text);
      var hasColon = raw.indexOf(":") > -1 || raw.indexOf("：") > -1;
      return [{ type: "add-note", text: hasColon ? t : "" }];
    }
    if (has("کار اضافه کن", "به کارهام اضافه", "تسک")) {
      var t2 = String(text).replace(/^[^:：]*[:：]\s*/, "").replace(/(کار اضافه کن|به کارهام اضافه کن|تسک)/, "").trim();
      return [{ type: "add-task", text: t2 }];
    }
    if (has("فهرست جزوه", "جزوه ها", "همهٔ جزوه", "همه جزوه")) return [{ type: "jozve-list" }];
    if (has("برنامه", "پلن") && has("مطالعه", "بدم", "بساز", "روزه", "روز")) {
      var days = detectCount(text, 7);
      var hm = nfa(text).match(/(\d{1,2})\s*(ساعت|ساعتی)/);
      return [{ type: "study-plan", days: days, hours: hm ? parseInt(hm[1], 10) : 3 }];
    }
    if (has("نشان کن", "نشان گذاری", "نشان‌گذاری", "بوک مارک", "بوک‌مارک", "علامت بزن", "برای بعد ذخیره")) return [{ type: "bookmark" }];
    if (has("خوانده ام", "خواندم", "خوانده‌ام", "خوندم")) return [{ type: "mark-read" }];
    if (has("برجسته", "هایلایت", "زرد", "سبز", "ابی", "آبی", "بنفش", "علامت رنگی", "رنگ کن")) {
      return [{ type: "highlight", color: has("سبز") ? "g" : has("ابی", "آبی") ? "b" : has("بنفش") ? "p" : "y" }];
    }
    if (has("خروجی", "دانلود")) return [{ type: "export", format: has("html") ? "html" : has("json") ? "json" : "md" }];
    if (has("اشتراک", "کپی لینک")) return [{ type: "share" }];
    if (has("افلاین", "آفلاین")) return [{ type: "offline-save" }];
    if (has("جزوه") && (has("باز کن", "نشونم", "بده", "بیار") || subj)) return [{ type: "open-jozve", subject: subj, grade: g, q: text }];
    if (has("درس") && has("باز کن")) return [{ type: "open-lesson", q: String(text).replace(/.*باز کن/, "").trim() || text }];
    if (has("پیدا کن", "جست و جو", "جست‌وجو", "جستجو", "بگرد")) {
      return [{ type: "search", q: String(text).replace(/(پیدا کن|جست و جو کن|جست‌وجو کن|جستجو کن|بگرد)/g, "").trim() || text }];
    }
    if (subj && (has("باز کن", "برو به", "نشونم"))) return [{ type: "goto", url: U("jozve/" + (g || grade()) + "/" + subj + ".html") }];
    return null;
  }

  /* ------------------------------------------------- اجرای برنامهٔ کارها */
  function execute(plan) {
    var out = [];
    var chain = Promise.resolve();
    (plan || []).forEach(function (a) {
      chain = chain.then(function () {
        var fn = ACTIONS[a.type];
        if (!fn) { out.push({ ok: false, text: "کاری با نام «" + a.type + "» نمی‌شناسم." }); return; }
        return Promise.resolve(fn.run(a.args || {}))
          .then(function (r) { out.push(Object.assign({ ok: true, action: a.type, label: fn.label }, r || {})); })
          .catch(function (e) { out.push({ ok: false, action: a.type, text: "در انجام «" + fn.label + "» خطا دادم: " + e.message }); });
      });
    });
    return chain.then(function () { return out; });
  }

  /* -------------------------------------- حلقهٔ هوش مصنوعی اجراکننده */
  function aiActionPrompt(userText) {
    var names = Object.keys(ACTIONS).join(", ");
    return "تو دستیار اجرایی «رهنما» هستی. کاربر درخواستی دارد. اگر درخواست انجام یک کار است، " +
      "پاسخ را **فقط** به شکل یک بلوک JSON بده و هیچ متن اضافه ننویس:\n" +
      '```json\n{"actions":[{"type":"نام کار","args":{}}]}\n```\n' +
      "کارهای مجاز و نام دقیق‌شان: " + names + "\n" +
      "قواعد:\n" +
      "• اگر کاربر پرسش علمی یا درخواست توضیح دارد، به فارسی و ساخت‌یافته توضیح بده و هیچ JSON نده.\n" +
      "• در args فقط از این کلیدها استفاده کن: subject (math/science/farsi/negaresh/arabic/english/social/religion/quran/tech/art/thinking/defa)، grade (7/8/9)، q (متن جست‌وجو)، count، days، hours، text، mode (dark/light/sepia/toggle)، dir (up/down)، format (md/html/json)، color (y/g/b/p)، url.\n" +
      "• هرگز کلید اضافه نساز.\n\nدرخواست کاربر: " + userText;
  }

  function extractActions(text) {
    var m = String(text).match(/```json\s*([\s\S]*?)```/i) || String(text).match(/(\{"actions"[\s\S]*\})/);
    if (!m) return null;
    try {
      var j = JSON.parse(m[1] || m[0]);
      if (j && Array.isArray(j.actions) && j.actions.length) return j.actions;
      if (Array.isArray(j)) return j;
    } catch (e) {}
    return null;
  }

  /**
   * درخواست کاربر را می‌گیرد و «انجامش می‌دهد».
   * ۱) تحلیل محلی  ۲) اگر نشد، هوش مصنوعی آنلاین با امکان اجرا  ۳) پاسخ متنی
   */
  function handle(userText) {
    var local = localPlan(userText);
    if (local && local.length) return execute(local).then(function (res) { return { results: res, mode: "local" }; });
    if (D.body.classList.contains("hk-pending-note")) {
      // حالت انتظار برای متن یادداشت
    }
    if (W.AI2 && typeof W.AI2.ask === "function") {
      return W.AI2.ask(aiActionPrompt(userText), { subject: D.body.getAttribute("data-subject") || "" })
        .then(function (r) {
          var acts = extractActions(r.text);
          if (acts) return execute(acts).then(function (res) { return { results: res, mode: "ai" }; });
          return { text: r.text, sources: r.sources, online: r.online, fallback: r.fallback, mode: "answer" };
        })
        .catch(function () { return { text: "متأسفانه نتوانستم پاسخ را بگیرم." }; });
    }
    return Promise.resolve({ text: "متوجه نشدم چه کاری می‌خواهی. بگو «راهنما» تا فهرست کارها را ببینی." });
  }

  /* --------------------------------------------------------- شنود صوتی */
  function listen(onText, onState) {
    var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) return null;
    var rec = new SR();
    rec.lang = "fa-IR"; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = function (e) { onText(e.results[0][0].transcript); };
    rec.onerror = function () { if (onState) onState("error"); };
    rec.onend = function () { if (onState) onState("end"); };
    try { rec.start(); if (onState) onState("start"); } catch (e) { return null; }
    return rec;
  }

  W.HK = W.HK || {};
  W.HK.Agent = {
    handle: handle,
    execute: execute,
    localPlan: localPlan,
    actions: ACTIONS,
    listen: listen,
    stopSpeech: stopSpeech,
    findUnits: findUnits,
    detectSubject: detectSubject,
    detectGrade: detectGrade,
    list: function () { return Object.keys(ACTIONS).map(function (k) { return { id: k, label: ACTIONS[k].label, desc: ACTIONS[k].desc }; }); }
  };
})();
