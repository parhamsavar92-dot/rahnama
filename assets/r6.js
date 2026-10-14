/* ==========================================================================
   رهنما — لایهٔ تعاملی ۶٫۰  |  r6.js
   --------------------------------------------------------------------------
   افزودنی و بی‌خطر: اگر هر بخشی لازم نبود، همان بخش خاموش می‌ماند و بقیهٔ
   صفحه دست‌نخورده کار می‌کند. هیچ اسکریپت دیگری را بازنویسی نمی‌کند.

   ۱) «دستیار همراه» روی همهٔ صفحه‌ها
        • اگر کاربر وارد شده باشد و سرور دستیار داشته باشد → پاسخ از سرور
          با پخش زنده (SSE) و متن جزوهٔ مرتبط به‌عنوان منبع.
        • در غیر این صورت → موتور محلی روی نمایهٔ درسی سایت (بدون اینترنت).
   ۲) فهرست شناور درس (از عنوان‌های همان صفحه ساخته می‌شود)
   ۳) نوار پیشرفت مطالعه + زمان تقریبی خواندن
   ۴) سایهٔ سربرگ هنگام اسکرول، نشانگر آنلاین/آفلاین، پیوند پرش دسترس‌پذیری
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  var R6 = (W.R6 = W.R6 || {});
  if (R6.ready) return;
  R6.ready = true;

  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  /* نمایش سبک متن ساختاریافتهٔ دستیار: **پررنگ**، فهرست، پاراگراف.
     همیشه اول escape می‌شود تا هیچ HTML ناامنی از پاسخ بیرون نیاید. */
  var md = function (s) {
    return esc(s)
      .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
      .replace(/\$([^$\n]+)\$/g, "<code>$1</code>")
      .replace(/^(\s*)(•|-)\s/gm, "$1• ")
      .replace(/\n/g, "<br>");
  };
  function toast(m, ms) {
    try {
      if (W.HK && W.HK.toast) return W.HK.toast(m, ms);
      if (W.G8 && W.G8.toast) return W.G8.toast(m, ms);
    } catch (e) {}
    var t = D.createElement("div");
    t.className = "r6-toast";
    t.textContent = m;
    t.style.cssText = "position:fixed;inset-inline:0;margin:auto;bottom:26px;width:max-content;max-width:90vw;" +
      "background:#161a2b;color:#fff;padding:10px 16px;border-radius:12px;z-index:9999;font-size:.85rem;font-weight:700;" +
      "box-shadow:0 14px 40px rgba(0,0,0,.35)";
    D.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3200);
  }
  R6.toast = toast;

  /* ---------------------------------------------------------- ابزار متن فارسی */
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  function nfa(s) { return String(s == null ? "" : s).replace(/[۰-۹]/g, function (d) { return String(NFA.indexOf(d)); }); }
  function norm(s) {
    return nfa(String(s == null ? "" : s))
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[يﻯﻰ]/g, "ی").replace(/[كﻙ]/g, "ک")
      .replace(/[أإآٱ]/g, "ا").replace(/[ؤئ]/g, "ی").replace(/ۀ/g, "ه")
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  var STOP = {};
  ("و در به از که این را با برای است هست یک آن های ها یا اگر تا هم نه بله چه چی کی کجا چطور چگونه چرا می شود شده بود بودن کن بکن بگو بده ولی اما پس نیز دیگر خیلی همه هر بعضی بر ای ان درباره مورد طریق انجام داشته دارد لطفا میشه یعنی چیست چیه تعریف معنی کدام توضیح فرمول رابطه قاعده قانون تفاوت فرق مقایسه مثال نمونه فهرست انواع علت دلیل مراحل خلاصه چکیده چند بساز بزن بنویس درس فصل بخش کنید کنم بدید بدم").split(" ")
    .forEach(function (w) { STOP[w] = 1; });
  function toks(s) {
    return norm(s).split(" ").filter(function (t) { return t.length > 1 && !STOP[t]; });
  }

  /* ------------------------------------------------------------ پایهٔ جاری */
  function currentGrade() {
    try {
      var q = new URLSearchParams(location.search).get("g");
      if (q) return q;
    } catch (e) {}
    if (W.G8 && W.G8.LS) { var g = W.G8.LS.get("g8:grade", null); if (g) return String(g); }
    var b = D.body && D.body.getAttribute("data-grade");
    return b || "8";
  }
  function basePath() {
    var tag = D.querySelector('script[src*="r6.js"]');
    var b = "";
    if (tag && tag.src) {
      try { b = new URL(tag.src, location.href).pathname.replace(/assets\/r6\.js.*$/, ""); } catch (e) { b = ""; }
    }
    if (!b) {
      var m = D.body && D.body.getAttribute("data-base");
      b = m || "";
      if (b === "/") b = "";
    }
    return b;
  }
  var BASE = basePath();
  function url(p) {
    if (W.G8 && W.G8.url) { try { return W.G8.url(p); } catch (e) {} }
    if (!p) return p;
    if (/^(https?:|mailto:|tel:|#|\/)/.test(p)) return p;
    return BASE + p;
  }

  /* ======================================================================
     ۱) موتور محلی: جست‌وجو در نمایهٔ درس‌ها (بدون اینترنت، بدون کلید)
     ====================================================================== */
  /* ---------------------------------------------------------------------
     پایگاه دانش درس‌ها (kb*.json)
     هر درس دارد: خلاصه، نکته‌های کلیدی، واژه‌نامه، فرمول، حل گام‌به‌گام و
     اشتباه‌های رایج. همین منبع، هم پاسخ محلی را می‌سازد و هم «متن مرجع»ی
     می‌شود که به دستیار سروری داده می‌شود تا پاسخش مستند و دقیق باشد.
     --------------------------------------------------------------------- */
  var KB = null, KB_P = null, KB_BOOKS = {}, DF = null, BOOKNAMES = {};
  /* هر سه پایه بارگذاری می‌شوند تا دستیار «همهٔ» جزوه‌ها را بشناسد؛ فقط
     درس‌های پایهٔ خودِ کاربر کمی امتیاز بیشتری می‌گیرند. */
  var KBFILES = [
    { file: "assets/kb-g7.json", grade: "7" },
    { file: "assets/kb.json", grade: "8" },
    { file: "assets/kb-g9.json", grade: "9" }
  ];

  function loadIndex() {
    if (KB_P) return KB_P;
    KB_P = Promise.all(KBFILES.map(function (k) {
      return fetch(url(k.file), { credentials: "same-origin" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (j) { return { grade: k.grade, j: j }; })
        .catch(function () { return { grade: k.grade, j: null }; });
    })).then(function (all) {
      KB = []; KB_BOOKS = {};
      var pairs = function (arr) { return arr.map(function (y) { return y[0] + " " + y[1]; }).join(" "); };
      BOOKNAMES = {};
      all.forEach(function (x) {
        if (!x.j || !x.j.lessons || !x.j.lessons.length) return;
        var byKey = {};
        (x.j.books || []).forEach(function (b) {
          KB_BOOKS[x.grade + ":" + b.key] = b;
          byKey[b.key] = b;
          var bn = norm(b.name);
          if (bn) BOOKNAMES[bn] = 1;
        });
        x.j.lessons.forEach(function (L) {
          L.pts = L.pts || []; L.terms = L.terms || []; L.f = L.f || [];
          L.st = L.st || []; L.ca = L.ca || [];
          L._g = x.grade;
          var b = byKey[L.b];
          L._bn = b ? norm(b.name) : "";
          L._t = norm(L.t);
          L._terms = norm(L.terms.map(function (y) { return y[0]; }).join(" "));
          // نام کتاب هم بخشی از متن جست‌وجو است تا «ریاضی» همهٔ درس‌های ریاضی را بیاورد
          L._hay = norm([L.t, L._bn, L.s || "", L.pts.join(" "), pairs(L.terms), pairs(L.f), pairs(L.st), pairs(L.ca)].join(" "));
          KB.push(L);
        });
      });
      buildDF();
      return KB;
    }).catch(function () { KB = []; return KB; });
    return KB_P;
  }
  R6.loadIndex = loadIndex;
  function kbReady() { return KB ? Promise.resolve(KB) : loadIndex(); }

  /* فراوانی واژه‌ها در درس‌ها — برای اینکه واژه‌های کم‌یاب ارزش بیشتری بگیرند
     (مثلاً «فیثاغورس» مهم‌تر از «ریاضی» است که در همهٔ درس‌ها هست). */
  function buildDF() {
    DF = {};
    for (var i = 0; i < KB.length; i++) {
      var words = (KB[i]._t + " " + KB[i]._terms + " " + KB[i]._hay).split(" ");
      var seen = {};
      for (var k = 0; k < words.length; k++) {
        var w = words[k];
        if (!w || seen[w]) continue;
        seen[w] = 1;
        DF[w] = (DF[w] || 0) + 1;
      }
    }
  }
  function idf(t) {
    if (!DF || !KB || !KB.length) return 1;
    return Math.log(1 + KB.length / (1 + (DF[t] || 0)));
  }

  /* رتبه‌بندی درس‌ها: وزن واژه نادر + جای واژه (عنوان > واژه‌نامه > متن)
     + پاداش پوشش چندواژه‌ای + اولویت پایهٔ خودِ کاربر */
  function rankLessons(query, limit) {
    if (!KB || !KB.length) return [];
    var ts = toks(query);
    var ph = norm(query);
    if (!ts.length && ph) ts = ph.split(" ").filter(function (t) { return t.length > 1; });
    if (!ts.length) return [];
    var mine = String(currentGrade());
    // اگر کاربر نام کتاب را گفته باشد (ریاضی، علوم، فارسی…)، درس‌های همان کتاب
    // بر بقیه اولویت می‌گیرند. رفع باگ «درس اول ریاضی» که عربی می‌آورد.
    var qBook = "";
    for (var bn in BOOKNAMES) {
      if (bn.length > 2 && ph.indexOf(bn) > -1) { qBook = bn; break; }
    }
    var out = [];
    for (var i = 0; i < KB.length; i++) {
      var L = KB[i], sc = 0, matched = 0, k;
      for (k = 0; k < ts.length; k++) {
        var t = ts[k], w = 0.5 + idf(t);
        if (L._t.indexOf(t) > -1) { sc += 24 * w; matched++; }
        else if (L._terms.indexOf(t) > -1) { sc += 9 * w; matched++; }
        else if (L._hay.indexOf(t) > -1) { sc += 3 * w; matched++; }
      }
      if (!matched) continue;
      sc *= 0.6 + 0.9 * (matched / ts.length);      // پاداش پوشش
      if (ph) {
        if (L._t.indexOf(ph) > -1) sc += 18;
        else if (L._hay.indexOf(ph) > -1) sc += 7;
      }
      if (qBook && L._bn.indexOf(qBook) > -1) sc *= 2.4;
      if (String(L._g) === mine) sc *= 1.35;
      out.push({ L: L, sc: sc });
    }
    out.sort(function (a, b) { return b.sc - a.sc; });
    return out.slice(0, limit || 3);
  }
  R6.search = rankLessons;

  /* رتبه‌بندی جمله‌های یک درس بر اساس پرسش (تا مرتبط‌ترین‌ها اول بیایند) */
  function rankSentences(list, query, min) {
    if (!list || !list.length) return [];
    var ts = toks(query);
    if (!ts.length) return list.slice(0, min || list.length);
    var scored = list.map(function (s, i) {
      var txt = Array.isArray(s) ? (s[0] + " " + s[1]) : String(s);
      var n = norm(txt), sc = 0;
      for (var k = 0; k < ts.length; k++) if (n.indexOf(ts[k]) > -1) sc += 1;
      return { s: s, sc: sc, i: i };
    });
    scored.sort(function (a, b) { return b.sc - a.sc || a.i - b.i; });
    return scored.map(function (x) { return x.s; }).slice(0, min || list.length);
  }

  /* ------------------------------------------------ تشخیص منظور پرسش */
  var INTENTS = [
    ["summary", /خلاصه|جمع ?بندی|چکیده|مرور|نکته‌?های مهم|مهم‌?ترین/],
    ["formula", /فرمول|رابطه|قاعده|قانون|محاسبه|چگونه حساب/],
    ["example", /مثال|حل کن|حل کن|مسئله|تمرین حل| نمونه/],
    ["practice", /سؤال|سوال|تمرین|آزمون|تست|بساز|بده.*(سؤال|سوال)/],
    ["definition", /تعریف|چیست|چیه|یعنی چه|معنی|چی هستند|چی هست/],
    ["mistake", /اشتباه|خطا|غلط|دقت|گاف/],
    ["simple", /ساده|راحت|مبتدی|بلد نیستم|نمی ?فهمم|کودکانه|ساده‌تر/],
    ["why", /چرا|دلیل|علت|به چه کار/],
    ["compare", /تفاوت|فرق|مقایسه|بهتر است/]
  ];
  function intentOf(q) {
    var s = norm(q);
    for (var i = 0; i < INTENTS.length; i++) if (INTENTS[i][1].test(s)) return INTENTS[i][0];
    return "explain";
  }
  R6.intentOf = intentOf;

  /* متن مرجع فشرده برای دستیار سروری (حدود ۶ هزار نویسه) */
  function buildContext(query, hits, maxChars) {
    if (!hits || !hits.length) return "";
    var parts = [];
    var used = 0;
    for (var i = 0; i < hits.length && i < 3; i++) {
      var L = hits[i].L;
      var b = [];
      b.push("### درس: " + L.t + (L.badge ? " (" + L.badge + ")" : ""));
      if (L.s) b.push("خلاصه: " + L.s);
      if (L.pts.length) b.push("نکته‌های کلیدی:\n- " + rankSentences(L.pts, query, 10).join("\n- "));
      if (L.terms.length) b.push("واژه‌نامه: " + L.terms.slice(0, 8).map(function (t) { return t[0] + " = " + t[1]; }).join(" | "));
      if (L.f.length) b.push("فرمول‌ها: " + L.f.slice(0, 6).map(function (t) { return t[0] + ": " + t[1]; }).join(" | "));
      if (L.st.length) b.push("حل گام‌به‌گام:\n" + L.st.slice(0, 3).map(function (t) { return "- " + t[0] + ": " + t[1]; }).join("\n"));
      if (L.ca.length) b.push("اشتباه‌های رایج:\n" + L.ca.slice(0, 3).map(function (t) { return "- " + t[0] + ": " + t[1]; }).join("\n"));
      var chunk = b.join("\n");
      if (used + chunk.length > (maxChars || 6000)) break;
      parts.push(chunk);
      used += chunk.length;
    }
    return parts.join("\n\n");
  }
  R6.buildContext = buildContext;

  function snippet(text, max) {
    var s = String(text || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var sp = cut.lastIndexOf(" ");
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
  }

  /* ---------------------------------------------------------------------
     ساخت پاسخ مفهومی از پایگاه دانش (حالت بدون اینترنت)
     ترتیب: تعریف → توضیح مفهومی → فرمول → حل گام‌به‌گام → اشتباه‌های رایج
     → خلاصه. بسته به منظور پرسش، بخش‌های مربوط پررنگ‌تر و کامل‌تر می‌آیند.
     --------------------------------------------------------------------- */
  function bookName(L) {
    var b = KB_BOOKS[L._g + ":" + L.b];
    return (b && b.name) || L.b || "";
  }

  function lessonUrl(L) {
    var b = KB_BOOKS[L._g + ":" + L.b];
    var anchor = L.id ? "#" + L.id : "";
    if (b && b.file) return b.file + anchor;   // مسیر نسبت به ریشهٔ سایت
    return "jozve/" + (L._g || currentGrade()) + "/" + (L.b || "math") + ".html" + anchor;
  }

  function composeLocal(query, hits, intent) {
    var L = hits[0].L;
    var t = [];
    // فقط درس‌هایی که واقعاً به پرسش مربوط‌اند منبع می‌شوند.
    // پیش‌تر سه نتیجهٔ اول بدون توجه به امتیاز می‌آمد و درس‌های بی‌ربط
    // (مثلاً «دین و زندگی» برای پرسش فیثاغورس) هم به‌عنوان منبع نشان داده می‌شد.
    var top = hits[0].sc || 1;
    var keep = hits.filter(function (h) { return h.sc >= top * 0.55; }).slice(0, 3);
    if (!keep.length) keep = [hits[0]];
    var src = keep.map(function (h) {
      return { t: h.L.t, bn: (bookName(h.L) || "") + " · پایهٔ " + (h.L._g || ""), url: lessonUrl(h.L) };
    });

    t.push("**" + L.t + "**" + (L.badge ? " — " + L.badge : "") + (L.b ? " · " + bookName(L) + " · پایهٔ " + (L._g || "") : ""));
    if (L.s) t.push(L.s);
    t.push("");

    // ۱) تعریف واژه‌های مرتبط با پرسش
    var qn = norm(query);
    var defs = L.terms.filter(function (x) {
      var n = norm(x[0]);
      return qn.indexOf(n) > -1 || n.indexOf(qn.split(" ")[0] || "@") > -1 ||
        toks(x[0]).some(function (w) { return qn.indexOf(w) > -1; });
    });
    if (!defs.length) defs = L.terms.slice(0, intent === "definition" ? 5 : 3);
    if (defs.length) {
      t.push("**تعریف‌ها**");
      defs.slice(0, 5).forEach(function (x) { t.push("• " + x[0] + ": " + x[1]); });
      t.push("");
    }

    // ۲) توضیح مفهومی
    var pts = rankSentences(L.pts, query, intent === "summary" || intent === "simple" ? 8 : 6);
    if (pts.length) {
      t.push("**توضیح مفهومی**");
      pts.forEach(function (p, i) { t.push((i + 1) + ". " + p); });
      t.push("");
    }

    // ۳) فرمول‌ها
    if (L.f.length && (intent !== "simple")) {
      t.push("**فرمول‌ها و قاعده‌ها**");
      rankSentences(L.f, query, 5).forEach(function (x) { t.push("• " + x[0] + ": " + x[1]); });
      t.push("");
    }

    // ۴) حل گام‌به‌گام
    if (L.st.length && (intent === "example" || intent === "explain" || intent === "formula" || intent === "why")) {
      t.push("**حل گام‌به‌گام (نمونه)**");
      L.st.slice(0, 4).forEach(function (x) { t.push("• " + x[0] + " — " + x[1]); });
      t.push("");
    }

    // ۵) اشتباه‌های رایج
    if (L.ca.length && (intent === "mistake" || intent === "explain" || intent === "why")) {
      t.push("**اشتباه‌های رایج — حواست باشد**");
      L.ca.slice(0, 3).forEach(function (x) { t.push("• " + x[0] + " — " + x[1]); });
      t.push("");
    }

    // ۶) تمرین پیشنهادی
    if (intent === "practice") {
      t.push("**چند پرسش برای تمرین**");
      rankSentences(L.pts, query, 4).forEach(function (p, i) {
        t.push((i + 1) + ". با تکیه بر این نکته توضیح بده: " + p.replace(/[.。]$/, "") + " — چرا؟");
      });
      t.push("");
    }

    // ۷) خلاصهٔ سریع
    if (L.pts.length) {
      t.push("**خلاصهٔ سریع**");
      t.push(rankSentences(L.pts, query, 3).map(function (p) { return snippet(p, 120); }).join(" • "));
    }

    return { text: t.join("\n"), src: src, hits: hits };
  }

  function noHitsAnswer() {
    return {
      text: "برای این پرسش مطلب مستقیمی در جزوه‌ها پیدا نکردم.\n\n" +
        "سه کار که کمک می‌کند:\n" +
        "• واژهٔ اصلی را کوتاه‌تر بنویس (مثلاً «فیثاغورس» یا «آرایهٔ ادبی»).\n" +
        "• نام درس یا واژهٔ کتاب را دقیق بنویس.\n" +
        "• یا با Ctrl + K جست‌وجوی سراسری را باز کن.\n\n" +
        "می‌توانی سؤالت را کامل‌تر هم بپرسی؛ مثلاً «تفاوت سلول جانوری و گیاهی را با مثال توضیح بده».",
      src: []
    };
  }

  /* پاسخ محلی: اول پایگاه دانش حتماً بارگذاری می‌شود، بعد پاسخ ساخته می‌شود.
     (به همین دلیل Promise برمی‌گرداند.) */
  function localAnswer(q) {
    return kbReady().then(function () {
      var intent = intentOf(q);
      var hits = rankLessons(q, 4);
      if (!hits.length) return noHitsAnswer();
      // درس‌های ضعیف کنار می‌روند تا هم منابع و هم متن مرجعی که به سرور
      // می‌رود، فقط از مطالب واقعاً مرتبط ساخته شود.
      var top = hits[0].sc || 1;
      hits = hits.filter(function (h) { return h.sc >= top * 0.5; });
      var a = composeLocal(q, hits, intent);
      a.intent = intent;
      return a;
    });
  }
  R6.localAnswer = localAnswer;

  /* ======================================================================
     ۲) وضعیت سرور دستیار
     ====================================================================== */
  var SRV = { known: false, ai: false, providers: [], model: null, version: "", settings: null, static: false };

  /* ---------------------------------------------------------------------
     وضعیت سایت: یک‌جا از سرور خوانده می‌شود و برای همهٔ بخش‌ها (دستیار،
     مشاوره، حالت تعمیر) استفاده می‌شود.
     ⚠️ روی میزبانی استاتیک (مثل GitHub Pages) هیچ سروری وجود ندارد؛ در آن
     حالت /api/health خطای ۴۰۴ می‌دهد و سایت خودکار «حالت محلی» می‌شود.
     --------------------------------------------------------------------- */
  function probeServer() {
    return fetch("/api/health", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        SRV.known = true;
        SRV.static = !j;
        SRV.ai = !!(j && j.ai && j.ai.configured);
        SRV.providers = (j && j.ai && j.ai.providers) || [];
        SRV.model = j && j.ai ? j.ai.defaultModel : null;
        SRV.version = (j && j.version) || "";
        return fetch("/api/site/status", { credentials: "same-origin" })
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (s) { SRV.settings = (s && s.settings) || null; return SRV; })
          .catch(function () { return SRV; });
      })
      .catch(function () { SRV.known = true; SRV.static = true; SRV.ai = false; return SRV; });
  }
  R6.server = function () { return SRV; };

  /* ---------------------------------------------------------------------
     پرچم‌های محلی سایت — برای وقتی که سروری در کار نیست.
     مالک از پنل تغییر می‌دهد؛ همان لحظه در همین مرورگر و همهٔ زبانه‌های باز
     اعمال می‌شود (localStorage + BroadcastChannel). این همان «اعمال مستقیم و
     بی‌قید و شرط» است — بدون نیاز به رفرش.
     --------------------------------------------------------------------- */
  var FLAGS_KEY = "g8:site:flags";
  var R6CH = null;
  try { if (W.BroadcastChannel) R6CH = new W.BroadcastChannel("g8-site-flags"); } catch (e) { R6CH = null; }

  function localFlags() {
    try { return JSON.parse(W.localStorage.getItem(FLAGS_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function writeFlags(o) {
    try { W.localStorage.setItem(FLAGS_KEY, JSON.stringify(o || {})); } catch (e) { }
    try { localStorage.setItem(FLAGS_KEY, JSON.stringify(o || {})); } catch (e) { }
    if (R6CH) { try { R6CH.postMessage({ t: "flags", v: o }); } catch (e) { } }
    applyFlags();
  }
  R6.flags = localFlags;
  R6.setFlags = writeFlags;

  /* تنظیمات سراسری میزبانی استاتیک — از فایل assets/site-flags.json خوانده
     می‌شود تا حالت تعمیر روی GitHub Pages هم برای «همهٔ» بازدیدکنندگان
     اعمال شود (نه فقط مرورگر مالک). */
  var STATIC_FLAGS = null;
  function loadStaticFlags() {
    return fetch(url("assets/site-flags.json"), { credentials: "same-origin", cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { STATIC_FLAGS = j || null; return STATIC_FLAGS; })
      .catch(function () { STATIC_FLAGS = null; return null; });
  }
  R6.staticFlags = function () { return STATIC_FLAGS; };

  var FKEY = { ai: "aiMaintenance", consult: "consultMaintenance", site: "maintenance" };

  /* ترتیب اولویت:
     ۱) تنظیم خودِ مالک در همین مرورگر (بی‌قید و شرط، همان که خواسته شد)
     ۲) تنظیمات سرور واقعی (برای همهٔ کاربران)
     ۳) فایل استاتیک site-flags.json (برای میزبانی بدون سرور) */
  function flagOn(k) {
    var f = localFlags(), key = FKEY[k] || k;
    if (f[key] !== undefined && f[key] !== null) return !!f[key];
    if (SRV.settings) {
      if (k === "ai") return !!(SRV.settings.aiMaintenance || SRV.settings.aiEnabled === false);
      if (k === "consult") return !!(SRV.settings.consultMaintenance || SRV.settings.consultEnabled === false);
      if (k === "site") return !!SRV.settings.maintenance;
      return !!SRV.settings[k];
    }
    if (STATIC_FLAGS) return !!STATIC_FLAGS[key];
    return false;
  }
  function flagNote(k) {
    var s = SRV.settings || {}, f = localFlags() || {}, sf = STATIC_FLAGS || {};
    if (k === "ai") return s.aiMaintenanceNote || f.aiMaintenanceNote || sf.aiMaintenanceNote || "دستیار هوشمند موقتاً در حال تعمیر و به‌روزرسانی است.";
    if (k === "consult") return s.consultMaintenanceNote || f.consultMaintenanceNote || sf.consultMaintenanceNote || "مشاورهٔ آنلاین موقتاً در حال تعمیر و به‌روزرسانی است.";
    return (s.maintenanceNote || f.maintenanceNote || sf.maintenanceNote) || "سایت موقتاً در حال به‌روزرسانی است.";
  }
  /* حذف تنظیم محلی تا سایت به پیش‌فرض خودش برگردد */
  R6.resetFlag = function (k) {
    var f = localFlags();
    delete f[FKEY[k] || k];
    writeFlags(f);
  };
  R6.maintenance = function (what) { return flagOn(what || "site"); };
  R6.maintenanceNote = flagNote;

  /* اعمال زندهٔ پرچم‌ها روی صفحهٔ جاری */
  function applyFlags() {
    try {
      ["ai", "consult"].forEach(function (k) {
        D.body.classList.toggle("r6-maint-" + k, flagOn(k));
      });
      D.body.classList.toggle("r6-maint-site", flagOn("site"));
      var n = $("#r6-ai-panel");
      if (n) {
        var on = flagOn("ai");
        var note = $("[data-r6-maint]", n);
        if (!note) {
          note = D.createElement("div");
          note.setAttribute("data-r6-maint", "1");
          note.className = "r6-ai-maint";
          n.appendChild(note);
        }
        note.innerHTML = "<b>حالت تعمیر</b><br>" + esc(flagNote("ai"));
        note.style.display = on ? "block" : "none";
        var box = $("[data-r6-input]", n), send = $("[data-r6-send]", n);
        if (box) box.disabled = on;
        if (send) send.disabled = on;
      }
      var fab = $("#r6-ai-fab");
      if (fab) fab.classList.toggle("is-maint", flagOn("ai"));

      // ── مشاورهٔ آنلاین ──
      // پیش‌تر فقط یک کلاس روی body گذاشته می‌شد و هیچ‌چیز آن را مصرف نمی‌کرد؛
      // یعنی با وجود «حالت تعمیر»، دکمهٔ شناور و کشوی مشاوره باز می‌شدند.
      var cOn = flagOn("consult");
      var cfab = $(".hk-fab");
      if (cfab) cfab.style.display = cOn ? "none" : "";
      if (cOn) {
        var cdr = $(".hk-drawer");
        if (cdr) cdr.classList.remove("open");
        var cbd = $(".hk-backdrop");
        if (cbd) cbd.classList.remove("open");
      }
    } catch (e) { }
  }
  R6.applyFlags = applyFlags;
  if (R6CH) { try { R6CH.onmessage = function (ev) { if (ev && ev.data && ev.data.t === "flags") applyFlags(); }; } catch (e) { } }
  W.addEventListener("storage", function (e) { if (e && e.key === FLAGS_KEY) applyFlags(); });

  /* ------------------------------------------------- پاسخ سرور با پخش زنده */
  function serverAnswer(messages, ctx, intent, onDelta) {
    return fetch("/api/ai/chat/completions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        messages: messages.slice(-12),
        grade: currentGrade(),
        context: ctx || "",
        intent: intent || "explain",
        stream: true
      })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error((j && j.error) || ("خطا " + r.status));
          e.status = r.status;
          throw e;
        });
      }
      var ct = r.headers.get("Content-Type") || "";
      if (ct.indexOf("text/event-stream") !== 0 || !r.body || !r.body.getReader) {
        return r.json().then(function (j) {
          var txt = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
          if (onDelta && txt) onDelta(txt);
          return { text: txt, provider: j && j.provider };
        });
      }
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return { text: full, provider: r.headers.get("X-AI-Provider") };
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf("\n")) > -1) {
            var line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (line.indexOf("data:") !== 0) continue;
            var payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              var o = JSON.parse(payload);
              var d = o.choices && o.choices[0] && o.choices[0].delta ? o.choices[0].delta.content : "";
              if (d) { full += d; if (onDelta) onDelta(d); }
            } catch (e) {}
          }
          return pump();
        });
      })();
    });
  }

  /* ======================================================================
     ۳) «دستیار همراه» — دکمهٔ شناور روی همهٔ صفحه‌ها
     ====================================================================== */
  var AI_HTML =
    '<div class="r6-ai-head">' +
    '  <span class="r6-ai-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">' +
    '  <path d="M12 3a1.6 1.6 0 0 1 1.6 1.6v.4a6.4 6.4 0 0 1 3.1 2L18 6.4a1.6 1.6 0 1 1 1.6 2.8l-1.2.7a6.4 6.4 0 0 1 0 3.6l1.2.7a1.6 1.6 0 1 1-1.6 2.8l-1.2-.7a6.4 6.4 0 0 1-2.7 2v.4a1.6 1.6 0 1 1-3.2 0v-.4a6.4 6.4 0 0 1-2.7-2l-1.2.7a1.6 1.6 0 1 1-1.6-2.8l1.2-.7a6.4 6.4 0 0 1 0-3.6l-1.2-.7A1.6 1.6 0 1 1 6.8 6.4l1.2.7a6.4 6.4 0 0 1 3.1-2v-.4A1.6 1.6 0 0 1 12 3z"/><circle cx="12" cy="12" r="2.6"/></svg></span>' +
    '  <div style="flex:1"><b>دستیار رهنما</b><small data-r6-mode>در حال آماده‌سازی…</small></div>' +
    '  <button class="icon-btn" data-r6-clear aria-label="پاک‌کردن گفت‌وگو" title="گفت‌وگوی تازه">' +
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' +
    '  <button class="icon-btn" data-r6-close aria-label="بستن">' +
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    "</div>" +
    '<div class="r6-ai-log" data-r6-log></div>' +
    '<div class="r6-ai-chips" data-r6-chips></div>' +
    '<div class="r6-ai-row"><textarea data-r6-input rows="1" placeholder="سؤالت را بنویس…" aria-label="پرسش"></textarea>' +
    '<button class="r6-ai-send" data-r6-send aria-label="ارسال"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19"><path d="M20 12 4.5 4.5 7 12l-2.5 7.5z"/><path d="M7 12h13"/></svg></button></div>';

  var CHIPS = [
    "این فصل را خلاصه کن",
    "برای این درس ۵ سؤال بساز",
    "فرمول‌های مهم این بخش چیست؟",
    "یک مثال حل‌شده بده",
    "این مفهوم را ساده‌تر توضیح بده"
  ];

  var AI = null;
  function buildAI() {
    if (AI || !D.body) return AI;
    var fab = D.createElement("button");
    fab.id = "r6-ai-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "دستیار هوشمند رهنما");
    fab.title = "دستیار هوشمند (Alt + K)";
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/></svg>';

    var panel = D.createElement("section");
    panel.id = "r6-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "دستیار هوشمند رهنما");
    panel.innerHTML = AI_HTML;

    D.body.appendChild(fab);
    D.body.appendChild(panel);

    var log = $("[data-r6-log]", panel);
    var input = $("[data-r6-input]", panel);
    var sendBtn = $("[data-r6-send]", panel);
    var modeEl = $("[data-r6-mode]", panel);
    var chips = $("[data-r6-chips]", panel);
    var history = LS.get("r6:ai:hist", []) || [];
    var busy = false;

    AI = { fab: fab, panel: panel, log: log, input: input, send: sendBtn, mode: modeEl, history: history };

    CHIPS.forEach(function (c) {
      var b = D.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", function () { ask(c); });
      chips.appendChild(b);
    });

    function push(role, html, src) {
      var el = D.createElement("div");
      el.className = "r6-msg " + (role === "me" ? "me" : "ai");
      el.innerHTML = html + (src && src.length ? srcHtml(src) : "");
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    function srcHtml(src) {
      var h = '<span class="r6-ai-src">';
      src.slice(0, 4).forEach(function (s) {
        h += '<a href="' + esc(url(s.url)) + '">' + esc(s.bn ? s.bn + " · " + s.t : s.t) + "</a>";
      });
      return h + "</span>";
    }
    function setMode(txt, ok) {
      if (!modeEl) return;
      modeEl.textContent = txt;
      modeEl.style.color = ok ? "var(--ok)" : "";
    }
    function typing() {
      var el = D.createElement("div");
      el.className = "r6-msg ai";
      el.innerHTML = '<span class="r6-typing"><span></span><span></span><span></span></span>';
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    /* متن درسِ همین صفحه به‌عنوان منبع، برای پاسخ مستند */
    function pageContext() {
      var art = $("article.lesson") || $("main");
      if (!art) return "";
      var t = art.innerText || art.textContent || "";
      return t.replace(/\s+/g, " ").trim().slice(0, 9000);
    }

    function ask(q) {
      q = String(q || "").trim();
      if (!q || busy) return;
      // حالت تعمیر: دستیار پاسخ نمی‌دهد و پیام روشن نشان می‌دهد
      if (flagOn("ai")) {
        var m = D.createElement("div");
        m.className = "r6-msg ai r6-msg-maint";
        m.innerHTML = "<b>دستیار در حالت تعمیر است</b><br>" + esc(flagNote("ai"));
        log.appendChild(m);
        log.scrollTop = log.scrollHeight;
        return;
      }
      busy = true;
      sendBtn.disabled = true;
      input.value = "";
      input.style.height = "auto";
      push("me", esc(q));
      history.push({ role: "user", content: q });
      if (history.length > 24) history = history.slice(-24);

      var bubble = typing();
      var got = "";
      var done = function (text, src, note) {
        bubble.className = "r6-msg ai";
        bubble.innerHTML = md(text) + (note ? '<span class="src">' + esc(note) + "</span>" : "") + (src && src.length ? srcHtml(src) : "");
        log.scrollTop = log.scrollHeight;
        history.push({ role: "assistant", content: text });
        if (history.length > 24) history = history.slice(-24);
        LS.set("r6:ai:hist", history);
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      };

      var localFallback = function (reason) {
        localAnswer(q).then(function (a) {
          done(a.text, a.src, reason || "پاسخ از موتور محلی سایت — بدون اینترنت و بدون کلید");
        }).catch(function () {
          done("نمایهٔ درس‌ها بارگذاری نشد. اگر تازه سایت را باز کرده‌ای یک‌بار صفحه را تازه کن.", [], "");
        });
      };

      if (SRV.ai) {
        // اول دانش مرتبط را از خود جزوه‌ها بیرون می‌کشیم؛ همان می‌شود «متن مرجع»
        // دستیار سروری. این‌طور پاسخ‌ها مستند به کتاب درسی می‌مانند.
        var intent = intentOf(q);
        localAnswer(q).then(function (a) {
          var ctx = buildContext(q, a.hits, 7000);
          if (!ctx && pageContext()) ctx = pageContext().slice(0, 4000);
          serverAnswer(history.slice(-8), ctx, intent, function (d) {
            got += d;
            bubble.className = "r6-msg ai";
            bubble.innerHTML = md(got);
            log.scrollTop = log.scrollHeight;
          }).then(function (out) {
            var text = (out && out.text) || got;
            if (!text) return localFallback("سرور پاسخی برنگرداند؛ پاسخ از موتور محلی سایت");
            done(text, a.src, "پاسخ از سرور سایت" + (out.provider ? " · " + out.provider : ""));
          }).catch(function (e) {
            if (e && e.status === 401) return localFallback("برای پاسخ سروری وارد حساب شو؛ فعلاً از موتور محلی پاسخ داده شد");
            if (got) return done(got, a.src, "پاسخ ناقص از سرور");
            done(a.text, a.src, "سرور در دسترس نبود؛ پاسخ از موتور محلی سایت");
          });
        }).catch(function () {
          localFallback("پایگاه دانش بارگذاری نشد؛ پاسخ از موتور محلی سایت");
        });
      } else {
        setTimeout(function () { localFallback(); }, 120);
      }
    }
    AI.ask = ask;

    /* پیام خوش‌آمد */
    if (history.length) {
      history.slice(-6).forEach(function (m) {
        push(m.role === "user" ? "me" : "ai", md(m.content));
      });
    } else {
      push("ai", "سلام! من دستیار رهنما هستم. هر جای جزوه گیر کردی بپرس — خلاصه، نمونه‌سؤال، فرمول یا توضیح ساده. " +
        "می‌توانی جواب را از دل همین جزوه بگیری، حتی بدون اینترنت.");
    }

    function toggle(open) {
      var on = open == null ? !panel.classList.contains("is-open") : !!open;
      panel.classList.toggle("is-open", on);
      fab.classList.toggle("is-open", on);
      if (on) setTimeout(function () { input.focus(); }, 220);
    }
    AI.toggle = toggle;
    fab.addEventListener("click", function () { toggle(); });
    $("[data-r6-close]", panel).addEventListener("click", function () { toggle(false); });
    $("[data-r6-clear]", panel).addEventListener("click", function () {
      history = []; AI.history = history; LS.set("r6:ai:hist", []);
      log.innerHTML = "";
      push("ai", "گفت‌وگوی تازه شروع شد. چه چیزی را توضیح بدهم؟");
      toast("گفت‌وگو پاک شد");
    });
    sendBtn.addEventListener("click", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 130) + "px";
    });
    D.addEventListener("keydown", function (e) {
      if (e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); toggle(); }
      if (e.key === "Escape" && panel.classList.contains("is-open")) toggle(false);
    });

    probeServer().then(function (s) {
      if (s.ai) setMode("متصل — پاسخ از سرور سایت" + (s.model ? " · " + s.model : ""), true);
      else setMode("محلی — پاسخ از دل جزوه، بدون اینترنت", false);
    });

    return AI;
  }

  /* ======================================================================
     ۴) فهرست شناور درس (TOC) + پیشرفت مطالعه + زمان خواندن
     ====================================================================== */
  function buildTOC() {
    var heads = $$("article.lesson h2, article.lesson h3, section.panel > h2, main section > h2");
    if (heads.length < 3) return;
    var seen = {}, list = [];
    heads.forEach(function (h, i) {
      var txt = (h.textContent || "").trim();
      if (!txt || seen[txt]) return;
      seen[txt] = 1;
      if (!h.id) h.id = "r6h" + i;
      list.push({ id: h.id, text: txt, el: h, lvl: h.tagName === "H3" ? 1 : 0 });
    });
    if (list.length < 3) return;

    var box = D.createElement("nav");
    box.id = "r6-toc";
    box.setAttribute("aria-label", "فهرست این صفحه");
    box.innerHTML = "<h4>فهرست این صفحه</h4>" + list.map(function (x) {
      return '<a href="#' + esc(x.id) + '" data-lvl="' + x.lvl + '">' + esc(x.text) + "</a>";
    }).join("") + '<a href="#" data-r6-top style="margin-top:8px;color:var(--muted)">↑ بازگشت به بالا</a>';

    var btn = D.createElement("button");
    btn.id = "r6-toc-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "فهرست صفحه");
    btn.title = "فهرست این صفحه";
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><path d="M4 6h16M4 12h11M4 18h7"/></svg>';

    D.body.appendChild(box);
    D.body.appendChild(btn);
    btn.addEventListener("click", function () { box.classList.toggle("is-open"); });
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-r6-top]")) { e.preventDefault(); W.scrollTo({ top: 0, behavior: "smooth" }); }
      if (e.target.tagName === "A" && W.innerWidth < 1500) box.classList.remove("is-open");
    });

    var links = $$("a", box).filter(function (a) { return a.getAttribute("href") !== "#"; });
    if ("IntersectionObserver" in W) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
        });
      }, { rootMargin: "-15% 0px -75% 0px" });
      list.forEach(function (x) { io.observe(x.el); });
    }
    box.style.insetBlockStart = "50%";
  }

  /* ---------------------------------------------------------------------
     یک حلقهٔ اسکرول برای همهٔ کارهای این لایه
     پیش‌تر سه شنوندهٔ جدا داشتیم (نوار پیشرفت، سایهٔ سربرگ، کلاس بدنه) و هر
     کدام جداگانه محاسبه می‌کردند. حالا یک شنونده و یک requestAnimationFrame
     برای همه — کمترین فشار ممکن روی رشتهٔ اصلی مرورگر.
     اگر #readbar از قبل باشد (کار app.js و hk-jozve.js)، دست نمی‌زنیم تا
     مقدار پیشرفت دو بار اعمال نشود.
     --------------------------------------------------------------------- */
  function scrollEngine() {
    var head = $(".site-header");
    var bar = $("#readbar");
    var madeBar = false;
    if (!bar) {
      bar = D.createElement("div");
      bar.id = "readbar";
      bar.style.cssText = "position:fixed;top:0;inset-inline:0;height:3px;transform-origin:right;transform:scaleX(0);z-index:400";
      D.body.insertBefore(bar, D.body.firstChild);
      madeBar = true;
    }

    var hgt = -1, stuck = false, scrolled = false, raf = 0;
    function upd() {
      raf = 0;
      var y = W.scrollY;
      if (madeBar) {
        if (hgt < 0) hgt = D.documentElement.scrollHeight - W.innerHeight;
        bar.style.transform = "scaleX(" + (hgt > 40 ? Math.min(1, Math.max(0, y / hgt)) : 0) + ")";
      }
      var s = y > 10;
      if (head && s !== stuck) { stuck = s; head.classList.toggle("is-stuck", s); }
      var sc = y > 8;
      if (sc !== scrolled) { scrolled = sc; D.body.classList.toggle("r6-scrolled", sc); }
    }
    W.addEventListener("scroll", function () { if (!raf) raf = W.requestAnimationFrame(upd); }, { passive: true });
    W.addEventListener("resize", function () { hgt = -1; }, { passive: true });
    try { if (W.ResizeObserver) new W.ResizeObserver(function () { hgt = -1; }).observe(D.body); } catch (e) { }
    upd();
  }

  /* توجه: پیش‌تر این‌جا کلاس r6-perf برای content-visibility درس‌ها گذاشته
     می‌شد. برداشته شد، چون هم‌زمان با باگ «body به‌عنوان ظرف اسکرول» باعث
     برآورد غلط ارتفاع سند و قفل‌شدن اسکرول می‌شد. خودِ پروژه از قبل برای
     بخش‌های سنگین از .u-lazy استفاده می‌کند و همان کافی است. */

  function readingTime() {
    var art = $("article.lesson");
    if (!art || $("[data-r6-rt]")) return;
    var words = (art.innerText || "").trim().split(/\s+/).length;
    if (words < 120) return;
    var mins = Math.max(1, Math.round(words / 190));
    var chip = D.createElement("div");
    chip.setAttribute("data-r6-rt", "1");
    chip.className = "r6-badge";
    chip.style.margin = "10px 0";
    chip.textContent = "زمان تقریبی مطالعه: " + mins + " دقیقه";
    var h = art.querySelector("h2") || art.firstElementChild;
    if (h && h.parentNode) h.parentNode.insertBefore(chip, h.nextSibling);
  }

  /* ------------------------------------------------- شبکه و دسترس‌پذیری */
  function netBadge() {
    var b = D.createElement("div");
    b.id = "r6-net";
    b.innerHTML = '<span class="r6-badge is-on">حالت آنلاین</span>';
    b.style.display = "none";
    D.body.appendChild(b);
    function upd() {
      var on = navigator.onLine;
      b.style.display = on ? "none" : "";
      b.querySelector(".r6-badge").className = "r6-badge " + (on ? "is-on" : "is-off");
      b.querySelector(".r6-badge").textContent = on ? "حالت آنلاین" : "حالت آفلاین — از حافظهٔ دستگاه";
    }
    W.addEventListener("online", upd);
    W.addEventListener("offline", upd);
    upd();
  }

  function skipLink() {
    if ($(".r6-skip") || !$("main")) return;
    var a = D.createElement("a");
    a.className = "r6-skip";
    a.href = "#main-anchor";
    a.textContent = "پرش به محتوای اصلی";
    var m = $("main");
    if (!m.id) { m.id = "main-anchor"; a.href = "#main-anchor"; }
    else a.href = "#" + m.id;
    D.body.insertBefore(a, D.body.firstChild);
  }

  /* دستیار باید بالای دکمهٔ «پنل مشاوره» بنشیند؛ آن دکمه ممکن است با
     کمی تأخیر ساخته شود، پس تا چند ثانیه نگاه می‌کنیم. */
  function stackFab() {
    if ($(".hk-fab")) { D.body.classList.add("r6-has-fab"); return true; }
    return false;
  }
  function watchFab() {
    if (stackFab()) return;
    var n = 0;
    var iv = setInterval(function () { n++; if (stackFab() || n > 16) clearInterval(iv); }, 500);
    if (W.MutationObserver) {
      var mo = new MutationObserver(function () { if (stackFab()) mo.disconnect(); });
      mo.observe(D.body, { childList: true });
      setTimeout(function () { mo.disconnect(); }, 9000);
    }
  }

  /* ======================================================================
     ۵) کارت‌های تازهٔ پنل مدیریت: سلامت سرور + مصرف دستیار هوشمند
     ====================================================================== */
  /* ---------------------------------------------------------------------
     انبار محلی درخواست‌ها و کلیدهای کلاس مجازی
     وقتی سرور واقعی هست، از سرور استفاده می‌شود؛ روی میزبانی استاتیک،
     همین مرورگر نقش انبار را دارد تا همهٔ اجزا کار کنند.
     --------------------------------------------------------------------- */
  var SUP_KEY = "g8:support";
  function supDB() {
    try {
      var o = JSON.parse(W.localStorage.getItem(SUP_KEY) || "null");
      if (!o || !o.reqs) return { reqs: [], keys: [] };
      return o;
    } catch (e) { return { reqs: [], keys: [] }; }
  }
  function supSave(o) { try { W.localStorage.setItem(SUP_KEY, JSON.stringify(o)); } catch (e) { } }
  function supApi(method, path, body) {
    if (SRV.static) return Promise.resolve(null);
    return fetch("/api/" + path, {
      method: method, credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
  }
  R6.supportDB = supDB;
  R6.supportSave = supSave;

  /* نسخهٔ «خام» فراخوانی سرور: برخلاف supApi که خطاها را null می‌کند،
     اینجا بدنهٔ پاسخ (همراه با پیام خطا) برگردانده می‌شود تا بتوانیم
     دلیل واقعی ناموفق‌بودن را به کاربر نشان بدهیم. */
  function supApiRaw(method, path, body) {
    return fetch("/api/" + path, {
      method: method, credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return null; });
    }).catch(function () { return null; });
  }

  function newKeyCode() {
    var s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", o = "RN-";
    for (var i = 0; i < 6; i++) o += s[Math.floor(Math.random() * s.length)];
    return o;
  }

  function adminExtras() {
    var kpis = $("#admKpis");
    if (!kpis) return;
    var old = $("#r6AdmCards");
    if (old) old.parentNode.removeChild(old);
    var box = D.createElement("div");
    box.id = "r6AdmCards";
    box.style.margin = "4px 0 18px";
    box.innerHTML =
      '<div class="r6-adm-grid">' +
      '<div class="card" data-r6-health><h4><span class="card-icon">♥</span> وضعیت سیستم</h4><p style="color:var(--muted)">در حال بررسی…</p></div>' +
      '<div class="card" data-r6-maint><h4><span class="card-icon">⏻</span> مرکز تعمیر و کنترل زنده</h4></div>' +
      '<div class="card" data-r6-supp style="grid-column:1/-1"><h4><span class="card-icon">⚿</span> پشتیبانی کلاس مجازی</h4><p style="color:var(--muted)">در حال بارگذاری…</p></div>' +
      '<div class="card" data-r6-usage style="grid-column:1/-1"><h4><span class="card-icon">◍</span> مصرف دستیار هوشمند</h4><p style="color:var(--muted)">در حال بارگذاری…</p></div>' +
      "</div>";
    kpis.parentNode.insertBefore(box, kpis.nextSibling);

    var rows = function (list) {
      return '<ul class="ticks" style="margin-top:8px">' + list.map(function (x) {
        return "<li><b>" + esc(x[0]) + ":</b> " + esc(x[1]) + "</li>";
      }).join("") + "</ul>";
    };

    /* ---------- کارت وضعیت: تفاوت «سرور قطع» و «میزبانی استاتیک» ---------- */
    var healthEl = $("[data-r6-health]", box);
    if (SRV.static) {
      // سایت روی میزبانی استاتیک است؛ نبود سرور یک «خطا» نیست، یک انتخاب است.
      healthEl.innerHTML =
        "<h4><span class=\"card-icon\">♥</span> وضعیت سیستم</h4>" +
        '<p style="margin:6px 0 4px"><span class="r6-pill warn">میزبانی استاتیک</span> ' +
        "<b>سرور متصل نیست</b></p>" +
        '<p style="font-size:.82rem;color:var(--muted);line-height:1.9">' +
        "این نسخه از سایت روی یک میزبان فایل‌ای (مثل GitHub Pages) اجرا می‌شود؛ آن‌جا هیچ بک‌اند و پایگاه داده‌ای وجود ندارد. " +
        "برای همین «نسخه»، «کاربران» و «زمان پاسخ سرور» مقدار ندارند. <b>این خرابی نیست</b> — سایت خودکار به «حالت محلی» می‌رود." +
        "</p>" + rows([
          ["وضعیت سایت", "درست کار می‌کند (حالت محلی)"],
          ["حساب‌ها", "روی همین دستگاه ذخیره می‌شوند"],
          ["دستیار", "موتور محلی سایت (بدون نیاز به کلید)"],
          ["کلاس مجازی", "کد اتاق روی همین دستگاه"]
        ]) +
        '<p style="font-size:.8rem;margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">' +
        "برای فعال‌کردن سرور واقعی و پایگاه دادهٔ D1، راهنمای <b>deploy/GO-LIVE.md</b> را ببین " +
        "یا در ترمینال <code>npm run deploy</code> را بزن. آن وقت همین کارت مقادیر واقعی را نشان می‌دهد." +
        "</p>";
    } else {
      fetch("/api/health", { credentials: "same-origin" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          healthEl.innerHTML = "<h4><span class=\"card-icon\">♥</span> وضعیت سیستم</h4>" + rows([
            ["وضعیت", j.ok ? "سالم" : "نیازمند بررسی"],
            ["نسخه", j.version || "—"],
            ["پایگاه دادهٔ D1", (j.db && j.db.ok ? "متصل" : "قطع") + (j.db ? " · " + j.db.latencyMs + "ms" : "")],
            ["کاربران", j.db ? String(j.db.users) : "—"],
            ["دستیار", j.ai && j.ai.configured ? "فعال (" + (j.ai.providers || []).join("، ") + ")" : "خاموش — موتور محلی"],
            ["سرور", (j.uptimeSeconds != null ? j.uptimeSeconds + " ثانیه از شروع" : "—")]
          ]);
        })
        .catch(function () { healthEl.innerHTML = "<h4><span class=\"card-icon\">♥</span> وضعیت سیستم</h4><p>ارتباط با سرور برقرار نشد.</p>"; });
    }

    /* ---------- مرکز تعمیر: تغییرها همان لحظه اعمال می‌شوند ---------- */
    var maintEl = $("[data-r6-maint]", box);
    function paintMaint() {
      var f = localFlags();
      var item = function (k, label, hint) {
        var on = flagOn(k);
        return '<label class="r6-switch-row"><span><b>' + label + "</b><br>" +
          '<small style="color:var(--muted)">' + hint + "</small></span>" +
          '<input type="checkbox" data-r6-flag="' + k + '"' + (on ? " checked" : "") + '></label>';
      };
      maintEl.innerHTML = "<h4><span class=\"card-icon\">⏻</span> مرکز تعمیر و کنترل زنده</h4>" +
        '<p style="font-size:.8rem;color:var(--muted);margin:4px 0 8px">هر تغییری این‌جا <b>همان لحظه</b> روی کل سایت اعمال می‌شود — بدون رفرش.</p>' +
        item("ai", "دستیار هوشمند", "روشن = در حالت تعمیر") +
        item("consult", "مشاورهٔ آنلاین", "روشن = در حالت تعمیر") +
        item("site", "کل سایت", "روشن = صفحهٔ تعمیر") +
        '<div class="r6-actions" style="margin-top:10px">' +
        '<button class="btn btn-sm" data-r6-flagreset="1">بازگشت به پیش‌فرض سایت</button></div>' +
        (SRV.static
          ? '<p style="font-size:.76rem;color:var(--muted);margin-top:8px;line-height:1.9">' +
          "این سایت روی میزبانی استاتیک است، پس تنظیم‌های این‌جا روی <b>همین مرورگر</b> اعمال می‌شود. " +
          "برای اعمال روی <b>همهٔ بازدیدکنندگان</b>، فایل <code>assets/site-flags.json</code> را ویرایش و دوباره منتشر کنید — " +
          "مقدارهای فعلی: <code>" + esc(JSON.stringify({ aiMaintenance: flagOn("ai"), consultMaintenance: flagOn("consult"), maintenance: flagOn("site") })) + "</code></p>"
          : '<p style="font-size:.76rem;color:var(--muted);margin-top:8px">با سرور واقعی، این تنظیم‌ها برای <b>همهٔ کاربران</b> اعمال می‌شود.</p>');

      $$("[data-r6-flag]", maintEl).forEach(function (inp) {
        inp.addEventListener("change", function () {
          var k = inp.getAttribute("data-r6-flag");
          var on = inp.checked;
          var f = localFlags();
          var key = k === "ai" ? "aiMaintenance" : k === "consult" ? "consultMaintenance" : "maintenance";
          f[key] = on;
          writeFlags(f);
          var b = {}; b[key] = on;
          supApi("POST", "admin/settings", b);
          if (R6.toastFn) R6.toastFn(on ? "حالت تعمیر روشن شد" : "حالت تعمیر خاموش شد");
        });
      });
      $$("[data-r6-flagreset]", maintEl).forEach(function (b) {
        b.addEventListener("click", function () {
          ["ai", "consult", "site"].forEach(function (k) { R6.resetFlag(k); });
          if (R6.toastFn) R6.toastFn("به پیش‌فرض سایت برگشت");
          paintMaint();
          applyFlags();
        });
      });
    }
    paintMaint();

    /* ---------- پشتیبانی کلاس مجازی ---------- */
    var suppEl = $("[data-r6-supp]", box);
    function paintSupport(srv) {
      var local = supDB();
      var reqs = (srv && srv.reqs) || local.reqs;
      var keys = (srv && srv.keys) || local.keys;
      var pending = reqs.filter(function (r) { return r.status !== "approved"; });
      var h = "<h4><span class=\"card-icon\">⚿</span> پشتیبانی کلاس مجازی</h4>" +
        '<p style="font-size:.82rem;color:var(--muted);margin:4px 0 10px">' +
        "مدیران و دبیران از صفحهٔ «پشتیبانی کلاس مجازی» درخواست می‌دهند. با ساخت کلید، همان مدیر و اعضای مدرسه‌اش " +
        "می‌توانند کلاس مجازی بسازند و به هم بپیوندند.</p>";

      h += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">' +
        '<span class="r6-pill">در انتظار: ' + pending.length + "</span>" +
        '<span class="r6-pill">کلیدهای فعال: ' + keys.filter(function (k) { return k.active; }).length + "</span>" +
        '<span class="r6-pill">کل کلیدها: ' + keys.length + "</span></div>";

      if (!reqs.length) {
        h += '<p style="color:var(--muted);font-size:.85rem">هنوز درخواستی ثبت نشده است.</p>';
      } else {
        h += '<div class="r6-tbl-wrap"><table class="r6-tbl"><thead><tr>' +
          "<th>مدرسه</th><th>متقاضی</th><th>شهر</th><th>کلاس</th><th>وضعیت</th><th>کلید</th><th>اقدام</th>" +
          "</tr></thead><tbody>";
        reqs.slice(0, 40).forEach(function (r) {
          var st = r.status === "approved"
            ? '<span class="r6-pill ok">کلید ساخته شد</span>'
            : '<span class="r6-pill warn">در انتظار</span>';
          h += "<tr><td>" + esc(r.school || "—") + "</td><td>" + esc(r.byName || r.by || "—") +
            "</td><td>" + esc(r.city || "—") + "</td><td>" + esc(String(r.classes || 1)) +
            "</td><td>" + st + "</td><td>" + (r.keyCode ? "<code>" + esc(r.keyCode) + "</code>" : "—") +
            '</td><td><button class="btn btn-sm" data-r6-mkkey="' + esc(r.id) + '" data-school="' + esc(r.school || "") +
            '" data-owner="' + esc(r.by || "") + '">ساخت کلید</button></td></tr>';
        });
        h += "</tbody></table></div>";
      }

      /* ── ساخت کلید جدید، بدون نیاز به درخواست ────────────────────────
         پیش‌تر کلید فقط از روی یک «درخواست» ساخته می‌شد؛ اگر درخواستی
         در انتظار نبود، راهی برای ساخت کلید وجود نداشت. این فرم همیشه
         کار می‌کند و کلید را مستقیم روی سرور ثبت می‌کند. */
      h = '<div class="card" style="padding:14px;margin-bottom:14px">' +
        '<h4 style="margin:0 0 4px">ساخت کلید جدید</h4>' +
        '<p style="font-size:.82rem;color:var(--muted);margin:0 0 10px">' +
        "با ساخت کلید، یک کلاس واقعی با همین کد روی سرور ساخته می‌شود؛ " +
        "هر کس این کد را در کلاس مجازی بزند، مستقیم وارد می‌شود.</p>" +
        '<div class="r6-grid2">' +
        '<label style="display:block"><span style="font-size:.78rem;font-weight:800">نام مدرسه (اختیاری)</span>' +
        '<input id="r6NewKeySchool" class="input" style="width:100%" type="text" placeholder="مثلاً: مدرسهٔ رهنما"></label>' +
        '<label style="display:block"><span style="font-size:.78rem;font-weight:800">اعتبار (روز)</span>' +
        '<input id="r6NewKeyDays" class="input" style="width:100%" type="number" min="1" max="730" value="90" dir="ltr"></label>' +
        '<label style="display:block"><span style="font-size:.78rem;font-weight:800">ظرفیت اعضا</span>' +
        '<input id="r6NewKeySeats" class="input" style="width:100%" type="number" min="1" max="5000" value="35" dir="ltr"></label>' +
        '<label style="display:block"><span style="font-size:.78rem;font-weight:800">کد دلخواه (اختیاری)</span>' +
        '<input id="r6NewKeyCode" class="input" style="width:100%" type="text" placeholder="خالی = خودکار" dir="ltr"></label>' +
        "</div>" +
        '<div class="r6-actions" style="margin-top:10px">' +
        '<button class="btn btn-sm" id="r6NewKeyBtn">ساخت کلید</button></div>' +
        '<div id="r6NewKeyOut" style="font-size:.84rem;margin-top:8px"></div>' +
        "</div>" + h;

      if (keys.length) {
        h += '<h4 style="margin-top:14px">کلیدهای ساخته‌شده</h4><div class="r6-tbl-wrap"><table class="r6-tbl"><thead><tr>' +
          "<th>کلید</th><th>مدرسه</th><th>ظرفیت</th><th>اعضا</th><th>انقضا</th><th>وضعیت</th><th></th></tr></thead><tbody>";
        keys.slice(0, 40).forEach(function (k) {
          var exp = k.exp ? new Date(k.exp).toLocaleDateString("fa-IR") : "—";
          h += "<tr><td><code>" + esc(k.code) + "</code></td><td>" + esc(k.school || "—") +
            "</td><td>" + esc(String(k.seats || "—")) + "</td><td>" + esc(String((k.members || []).length)) +
            "</td><td>" + esc(exp) + "</td><td>" +
            (k.active ? '<span class="r6-pill ok">فعال</span>' : '<span class="r6-pill warn">غیرفعال</span>') +
            '</td><td><button class="btn btn-sm" data-r6-tkey="' + esc(k.id) + '" data-on="' + (k.active ? "0" : "1") +
            '">' + (k.active ? "غیرفعال کن" : "فعال کن") + "</button></td></tr>";
        });
        h += "</tbody></table></div>";
      }

      suppEl.innerHTML = h;

      /* دکمهٔ ساخت کلید جدید */
      var nkBtn = $("#r6NewKeyBtn", suppEl);
      if (nkBtn) {
        nkBtn.addEventListener("click", function () {
          var school = ($("#r6NewKeySchool", suppEl).value || "").trim();
          var days = Math.max(1, Math.min(730, +$("#r6NewKeyDays", suppEl).value || 90));
          var seats = Math.max(1, Math.min(5000, +$("#r6NewKeySeats", suppEl).value || 35));
          var want = ($("#r6NewKeyCode", suppEl).value || "").trim().toUpperCase();
          var out = $("#r6NewKeyOut", suppEl);
          nkBtn.disabled = true;
          if (out) out.innerHTML = "در حال ساخت کلید…";
          supApiRaw("POST", "admin/support/key", {
            code: want, school: school, seats: seats, days: days
          }).then(function (r) {
            nkBtn.disabled = false;
            if (!r || r.error) {
              if (out) out.innerHTML = '<span style="color:var(--err);font-weight:700">کلید ساخته نشد: ' +
                esc((r && r.error) || "ارتباط با سرور برقرار نشد.") + "</span>";
              return;
            }
            var k = r.key || {};
            var local2 = supDB();
            local2.keys.unshift(k);
            supSave(local2);
            if (out) {
              out.innerHTML = '<span style="color:var(--ok);font-weight:800">کلید ساخته شد و روی سرور ثبت شد ✅</span>' +
                '<div style="margin-top:6px">کد کلاس: <code style="font-size:1.05rem">' + esc(k.code || "") + "</code></div>" +
                '<div style="font-size:.8rem;color:var(--muted);margin-top:4px">' +
                "این کد را به بچه‌ها بده؛ در صفحهٔ کلاس مجازی که بزنند، مستقیم وارد کلاس می‌شوند.</div>";
            }
            paintSupport(null);
          });
        });
      }

      $$("[data-r6-mkkey]", suppEl).forEach(function (b) {
        b.addEventListener("click", function () {
          var rid = b.getAttribute("data-r6-mkkey");
          var school = b.getAttribute("data-school") || "";
          var owner = b.getAttribute("data-owner") || "";
          var code = newKeyCode();
          /* ▼ رفع باگ: پیش‌تر بدون توجه به پاسخ سرور، همیشه پیام
             «کلید ساخته شد» نشان داده می‌شد. حالا تا سرور تأیید نکند
             کلید ساخته‌شده اعلام نمی‌شود و پیام خطا هم دیده می‌شود. */
          b.disabled = true;
          supApiRaw("POST", "admin/support/key", { reqId: rid, code: code, school: school, seats: 35, days: 90 })
            .then(function (r) {
              b.disabled = false;
              if (!r || (r.error)) {
                alert("کلید ساخته نشد.\n" + ((r && r.error) || "ارتباط با سرور برقرار نشد.") +
                  "\nاگر مشکل ادامه داشت، یک‌بار صفحه را تازه کن و دوباره بزن.");
                return;
              }
              var local2 = supDB();
              var key = r.key || { id: "sk_" + Date.now().toString(36), code: code, t: Date.now(), exp: Date.now() + 90 * 864e5, owner: owner, school: school, seats: 35, active: true, used: 0, members: [], days: 90 };
              local2.keys.unshift(key);
              local2.reqs.forEach(function (x) { if (x.id === rid) { x.status = "approved"; x.keyCode = key.code; } });
              supSave(local2);
              alert("کلید ساخته شد و روی سرور ثبت شد ✅\n\nکد کلاس: " + key.code +
                "\nاین کد را به مدیر و بچه‌ها بده؛ با زدن آن، مستقیم وارد کلاس می‌شوند.");
              paintSupport(null);
            });
        });
      });
      $$("[data-r6-tkey]", suppEl).forEach(function (b) {
        b.addEventListener("click", function () {
          var id = b.getAttribute("data-r6-tkey"), on = b.getAttribute("data-on") === "1";
          var local2 = supDB();
          local2.keys.forEach(function (k) { if (k.id === id) k.active = on; });
          supSave(local2);
          supApi("POST", "admin/support/state", { id: id, active: on });
          paintSupport(null);
        });
      });
    }

    supApi("GET", "admin/support").then(function (srv) { paintSupport(srv); });
    if (SRV.static) setTimeout(function () { paintSupport(null); }, 0);

    fetch("/api/admin/ai-usage", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var el = $("[data-r6-usage]", box);
        if (!el) return;
        if (j.error) { el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4><p>" + esc(j.error) + "</p>"; return; }
        var bars = (j.usage || []).slice(-7).map(function (d) {
          var w = Math.min(100, Math.round((d.total / Math.max(1, j.total)) * 100));
          return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:.78rem">' +
            '<span style="min-width:76px;color:var(--muted)">' + esc(d.day) + "</span>" +
            '<span style="flex:1;height:8px;border-radius:99px;background:var(--surface-3);overflow:hidden">' +
            '<span style="display:block;height:100%;width:' + w + '%;background:linear-gradient(90deg,var(--brand),var(--brand-3))"></span></span>' +
            '<b style="min-width:28px;text-align:center">' + esc(String(d.total || 0)) + "</b></div>";
        }).join("");
        el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4>" +
          (j.providers && j.providers.length
            ? "<p style=\"font-size:.8rem;color:var(--muted)\">ارائه‌دهنده: <b>" + esc(j.providers.join("، ")) + "</b>" + (j.model ? " · " + esc(j.model) : "") + "</p>"
            : "<p style=\"font-size:.8rem;color:var(--muted)\">دستیار سروری تنظیم نشده؛ پاسخ‌ها از موتور محلی سایت می‌آید.</p>") +
          (bars || "<p style=\"font-size:.8rem;color:var(--muted)\">هنوز مصرفی ثبت نشده است.</p>") +
          '<p style="font-size:.78rem;margin-top:8px">جمع هفتهٔ اخیر: <b>' + esc(String(j.total || 0)) + "</b> پرسش</p>";
      })
      .catch(function () {
        var el = $("[data-r6-usage]", box);
        if (el) el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4><p>در دسترس نیست.</p>";
      });
  }

  /* ======================================================================
     کارت‌های پروفایل در صفحهٔ اصلی
     ----------------------------------------------------------------------
     بعد از ورود، دو کارت می‌آید:
       ۱) پروفایل شخصی — تصویر/گیف، نام با فونت و رنگ دلخواه
       ۲) کارت نقش — با پیوند پنل مخصوص همان نقش
     ====================================================================== */
  var FONT_CLASS = { vazir: "r6-font-vazir", system: "r6-font-system", display: "r6-font-display", serif: "r6-font-serif" };
  R6.FONT_CLASS = FONT_CLASS;

  var ROLE_PANEL = {
    student: { fa: "دانش‌آموز", url: "panel.html", note: "پنل مطالعه، تکالیف و پیشرفت" },
    teacher: { fa: "دبیر", url: "panel-teacher.html", note: "کلاس‌ها، حضور و غیاب و تکالیف" },
    deputy: { fa: "ناظم", url: "panel-manager.html", note: "نظارت بر کلاس‌ها و اعضا" },
    admin: { fa: "مدیر", url: "panel-manager.html", note: "مدیریت مدرسه، اعضا و کلاس مجازی" },
    owner: { fa: "مالک سایت", url: "admin.html", note: "کنترل کامل سایت" }
  };
  R6.ROLE_PANEL = ROLE_PANEL;

  function avatarHTML(u, size) {
    var s = size || 76;
    var av = u && u.avatar ? String(u.avatar) : "";
    if (av) {
      return '<span class="r6-ava" style="width:' + s + "px;height:" + s + 'px"><img src="' + esc(av) + '" alt="تصویر پروفایل"></span>';
    }
    var initial = esc(((u && u.name) || "؟").trim().charAt(0) || "؟");
    var color = (u && u.color) || "#6d5efc";
    return '<span class="r6-ava" style="width:' + s + "px;height:" + s +
      "px;background:linear-gradient(135deg," + esc(color) + ",var(--brand-3))\">" + initial + "</span>";
  }
  R6.avatarHTML = avatarHTML;

  function nameHTML(u) {
    var f = (u && u.font) || "vazir";
    var c = (u && u.nameColor) || (u && u.color) || "";
    return '<span class="r6-uname ' + (FONT_CLASS[f] || "r6-font-vazir") + '"' +
      (c ? ' style="color:' + esc(c) + '"' : "") + ">" + esc((u && u.name) || "کاربر") + "</span>";
  }

  function homeProfiles() {
    if (!D.body || D.body.getAttribute("data-subject") !== "home") return;
    var host = $("#grades");
    if (!host || !host.parentNode) return;
    var u = null;
    try { u = (W.HK && W.HK.auth && W.HK.auth.me) ? W.HK.auth.me() : null; } catch (e) { u = null; }
    var old = $("#r6HomeProf");
    if (!u) { if (old) old.remove(); return; }

    var rp = ROLE_PANEL[u.role || "student"] || ROLE_PANEL.student;
    var roleFa = u.roleFa || rp.fa;
    var grade = u.grade ? "پایهٔ " + u.grade : "پایه نامشخص";
    var school = u.school ? esc(u.school) : "مدرسه ثبت نشده";
    var tick = u.verified ? '<span class="r6-pill ok">✔ تأییدشده</span>' : "";
    var own = (u.isOwner || u.role === "owner") ? '<span class="r6-pill brand">مالک سایت</span>' : "";
    var keyPill = u.schoolKey ? '<span class="r6-pill ok">کلید مدرسه: <code>' + esc(u.schoolKey) + "</code></span>" : "";

    var html =
      '<section class="section" id="r6HomeProf" style="padding-bottom:0">' +
      '<div class="wrap">' +
      '<div class="r6-prof-grid r6-prof-grid--one">' +
      // ---- یک کارت واحد ----
      // پیش‌تر این‌جا «دو» کارت ساخته می‌شد (پروفایل شخصی + کارت نقش) و
      // کاربر آن را به‌درستی «دو پروفایل» می‌دید. حالا همه‌چیز در یک کارت است.
      '<article class="card r6-prof-card">' +
      '<div class="r6-prof-head">' + avatarHTML(u, 76) +
      "<div>" + nameHTML(u) +
      '<div class="r6-prof-sub">' + esc(roleFa) + " · " + esc(grade) + " · " + school + "</div>" +
      '<div class="r6-prof-pills">' + tick + own + keyPill + "</div>" +
      "</div></div>" +
      (u.bio ? '<p class="r6-prof-bio">' + esc(u.bio) + "</p>" : "") +
      '<p class="r6-prof-note" style="margin-top:12px">' + esc(rp.note) + "</p>" +
      '<div class="r6-prof-acts">' +
      '<a class="btn btn-sm btn-primary" href="' + url("profile.html") + '">ویرایش پروفایل</a>' +
      '<a class="btn btn-sm" href="' + url(rp.url) + '">ورود به پنل ' + esc(roleFa) + "</a>" +
      '<a class="btn btn-sm" href="' + url("settings.html") + '">تنظیمات من</a>' +
      '<a class="btn btn-sm" href="' + url("class-support.html") + '">پشتیبانی کلاس مجازی</a>' +
      "</div>" +
      '<p class="r6-prof-note">نقش‌های <b>دبیر</b> و <b>ناظم</b> با «کد همکاران» فعال می‌شوند؛ ' +
      "نقش <b>مدیر</b> را فقط مالک سایت تعیین می‌کند.</p>" +
      "</article>" +
      "</div></div></section>";

    var wrap = D.createElement("div");
    wrap.innerHTML = html;
    var node = wrap.firstChild;
    if (old) old.parentNode.replaceChild(node, old);
    else host.parentNode.insertBefore(node, host);
  }
  R6.homeProfiles = homeProfiles;

  /* ======================================================================
     بنر حالت تعمیر برای صفحه‌های دستیار و مشاوره
     ====================================================================== */
  function consultBanner() {
    var p = (W.location && W.location.pathname) || "";
    var isAi = /\/ai\.html$/.test(p) || D.body.getAttribute("data-subject") === "ai";
    var isConsult = /\/consult\.html$/.test(p) || D.body.getAttribute("data-subject") === "consult";
    if (!isAi && !isConsult) return;
    var what = isConsult ? "consult" : "ai";
    var on = flagOn(what);
    var old = $("#r6MaintBanner");
    // کلاس مخصوص «صفحهٔ مشاوره در تعمیر»: با آن، محتوای صفحه جای خود را به
    // پیام تعمیر می‌دهد. عمداً فقط روی همین صفحه اعمال می‌شود تا بقیهٔ سایت
    // دست‌نخورده بماند.
    if (isConsult) D.body.classList.toggle("r6-maint-consult-page", on);
    if (!on) { if (old) old.remove(); return; }
    if (old) old.remove();
    var b = D.createElement("div");
    b.id = "r6MaintBanner";
    b.className = "r6-maint-banner";
    b.innerHTML = '<b>⏻ این بخش موقتاً در حالت تعمیر است</b><span>' + esc(flagNote(what)) + "</span>";
    var main = $("main") || D.body;
    main.insertBefore(b, main.firstChild);
  }
  R6.consultBanner = consultBanner;

  /* ------------------------------------------------------------ راه‌اندازی */
  function boot() {
    // از پیام‌رسان خودِ سایت استفاده می‌کنیم (اگر باشد)
    try { if (W.HK && W.HK.toast) R6.toastFn = W.HK.toast; } catch (e) { }
    try { skipLink(); } catch (e) {}
    try { scrollEngine(); } catch (e) {}
    try { netBadge(); } catch (e) {}
    try { buildTOC(); } catch (e) {}
    try { readingTime(); } catch (e) {}
    try { loadIndex(); } catch (e) {}     // نمایهٔ محلی را از پیش آماده می‌کند
    try { buildAI(); } catch (e) {}
    try { watchFab(); } catch (e) {}
    try { homeProfiles(); } catch (e) {}
    try { applyFlags(); } catch (e) {}
    // تنظیمات استاتیک سایت (site-flags.json) — پیش از اعمال پرچم‌ها می‌خوانیم
    loadStaticFlags().then(function () {
      try { applyFlags(); } catch (e) {}
      try { consultBanner(); } catch (e) {}
    }).catch(function () { });
    // پس از رسیدن وضعیت سرور: پرچم‌های تعمیر و کارت‌های پنل مالک تازه می‌شوند
    probeServer().then(function () {
      try { applyFlags(); } catch (e) {}
      try { adminExtras(); } catch (e) {}
      try { consultBanner(); } catch (e) {}
      try { homeProfiles(); } catch (e) {}
    });
    R6.buildAI = function () { return buildAI(); };
    R6.openAssistant = function (q) {
      var a = buildAI();
      if (!a) return;
      a.toggle(true);
      if (q) a.ask(q);
    };
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
