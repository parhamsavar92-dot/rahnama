/* ==========================================================================
   پایهٔ هشتم — دستیار هوشمند مستقل  |  ai.js
   نسخهٔ ۲ — بدون نیاز به هیچ کلید یا سرویس بیرونی
   موتور: بازیابی BM25 روی پایگاه دانش محلی + تشخیص قصد + ترکیب پاسخ
   قابلیت‌ها: تعریف، تفاوت، فهرست، علت، مثال، مراحل، فرمول، خلاصه،
              ساخت آزمون، برنامهٔ مطالعه، تحلیل پیشرفت، ماشین‌حساب علمی
   (اتصال به سرویس بیرونی به‌صورت اختیاری باقی مانده، ولی هیچ‌چیز به آن وابسته نیست)
   ========================================================================== */
(function () {
  "use strict";
  if (document.body.getAttribute("data-page") !== "ai") return;

  var G = window.G8 || {};
  var LS = G.LS;
  var url = G.url || function (p) { return p; };
  var J = G.jsonLoad || function (p) { return fetch(url(p)).then(function (r) { return r.json(); }); };
  var esc = G.esc || function (s) { return String(s); };
  var toast = G.toast || function () {};

  /* ---------- پایهٔ جاری: از ?g= یا حافظهٔ دستگاه یا صفحه ---------- */
  var grade = (function () {
    var q = new URLSearchParams(location.search).get("g");
    var saved = LS ? LS.get("g8:grade", null) : null;
    var g = q || saved || document.body.getAttribute("data-grade") || "8";
    if (["7", "8", "9"].indexOf(g) === -1) g = "8";
    if (LS) LS.set("g8:grade", g);
    return g;
  })();
  var kbFile = grade === "8" ? "assets/kb.json" : "assets/kb-g" + grade + ".json";

  var KB = null;            // پایگاه دانش
  var IDX = null;           // ایندکس معکوس BM25
  var TERMS = [];           // واژه‌نامهٔ سراسری
  var CHAT = [];
  var LAST = { lesson: null, term: null };
  var busy = false;
  var CFG = LS.get("g8:ai", { baseUrl: "https://api.openai.com/v1", key: "", model: "gpt-4o-mini", temp: 0.4 });

  var SUPPORT = "۰۹۳۹۸۰۶۲۲۷۳";
  var SUPPORT_RAW = "09398062273";

  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ==================== نرمال‌سازی فارسی ==================== */
  function norm(s) {
    return String(s || "")
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/\u200c/g, " ")
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک")
      .replace(/[أإآ]/g, "ا").replace(/ؤ/g, "و").replace(/ئ/g, "ی")
      .replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
      .replace(/[.,،؛:!؟?()"'«»\[\]{}]/g, " ")
      .replace(/\s+/g, " ")
      .trim().toLowerCase();
  }
  var STOP = ["و", "در", "به", "از", "که", "این", "را", "با", "برای", "است", "هست", "یک", "آن", "های", "ها", "یا", "اگر", "تا", "هم", "نه", "بله", "چه", "چی", "کی", "کجا", "چطور", "چگونه", "چرا", "می", "شود", "شده", "بود", "بودن", "کن", "بکن", "بگو", "بده", "ولی", "اما", "پس", "نیز", "دیگر", "خیلی", "همه", "هر", "بعضی", "بر", "ای", "ان", "راست", "درباره", "مورد", "طریق", "انجام", "داشته", "دارد", "بتوانم", "لطفا", "میشه", "یعنی", "چیست", "چیه", "تعریف", "معنی", "کدام", "توضیح", "فرمول", "رابطه", "قاعده", "قانون", "تفاوت", "فرق", "مقایسه", "مثال", "نمونه", "فهرست", "انواع", "علت", "دلیل", "چرایی", "مراحل", "خلاصه", "چکیده", "چند", "بساز", "بزن", "بنویس", "بگویم", "بگویید"];
  function toks(s) { return norm(s).split(" ").filter(function (t) { return t.length > 2 && STOP.indexOf(t) === -1; }); }

  /* ==================== ایندکس + بازیابی BM25 ==================== */
  var K1 = 1.4, B = 0.72, AVGDL = 1;

  function buildIndex() {
    var df = {}, docs = [], N = KB.lessons.length;
    KB.lessons.forEach(function (l, i) {
      var tf = {}, len = 0;
      function add(text, w) {
        toks(text).forEach(function (t) { tf[t] = (tf[t] || 0) + w; len += w; });
      }
      add(l.t, 6); add(l.badge, 2);
      (l.pts || []).forEach(function (p) { add(p, 2); });
      (l.terms || []).forEach(function (tm) { add(tm[0], 4); add(tm[1], 1.2); });
      (l.f || []).forEach(function (f) { add(f[0] + " " + f[1], 3.5); });
      (l.st || []).forEach(function (s) { add(s[0] + " " + s[1], 2); });
      (l.ca || []).forEach(function (c) { add(c[0] + " " + c[1], 1.6); });
      docs.push({ tf: tf, len: len, l: l, i: i });
      Object.keys(tf).forEach(function (t) { df[t] = (df[t] || 0) + 1; });
    });
    var total = docs.reduce(function (a, d) { return a + d.len; }, 0);
    AVGDL = (total / Math.max(1, N)) || 1;
    IDX = { df: df, docs: docs, N: N };

    TERMS = [];
    KB.lessons.forEach(function (l, i) {
      (l.terms || []).forEach(function (tm) { TERMS.push({ t: tm[0], d: tm[1], li: i, nk: norm(tm[0]) }); });
    });
  }

  function idf(t) { var df = IDX.df[t] || 0; return Math.log(1 + (IDX.N - df + 0.5) / (df + 0.5)); }

  function retrieve(query, k) {
    var ts = toks(query);
    if (!ts.length) return [];
    var q = norm(query);
    var scored = IDX.docs.map(function (d) {
      var s = 0;
      ts.forEach(function (t) {
        var tf = d.tf[t];
        if (tf) { s += idf(t) * (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * d.len / AVGDL)); return; }
        var best = 0;
        Object.keys(d.tf).forEach(function (key) {
          if (key.length > 3 && (key.indexOf(t) === 0 || t.indexOf(key) === 0)) best = Math.max(best, d.tf[key] * 0.35);
        });
        if (best) s += idf(t) * 0.4 * (best * (K1 + 1)) / (best + K1);
      });
      if (q.length > 6) {
        var hay = norm(d.l.t + " " + (d.l.pts || []).join(" ") +
          " " + (d.l.terms || []).map(function (x) { return x[0] + " " + x[1]; }).join(" "));
        if (hay.indexOf(q) > -1) s += 8;
        else {
          var words = q.split(" ");
          for (var n = Math.min(4, words.length); n >= 2; n--) {
            var hit = false;
            for (var i = 0; i + n <= words.length; i++) {
              if (hay.indexOf(words.slice(i, i + n).join(" ")) > -1) { s += 2.2 * n; hit = true; break; }
            }
            if (hit) break;
          }
        }
      }
      return { l: d.l, i: d.i, score: s };
    }).filter(function (x) { return x.score > 0; });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.slice(0, k || 4);
  }

  function findTerms(query, limit) {
    var n = norm(query), ts = toks(query), best = [];
    if (!ts.length) return [];
    TERMS.forEach(function (T) {
      var s = 0, shared = 0;
      ts.forEach(function (t) {
        if (t.length >= 4 && T.nk.indexOf(t) > -1) { s += t.length * 1.6; shared++; }
        else if (t.length === 3 && T.nk === t) { s += 3; shared++; }
      });
      // واژه تنها وقتی معتبر است که دست‌کم یک واژهٔ محتوایی با پرسش مشترک داشته باشد
      if (!shared) return;
      if (n.indexOf(T.nk) > -1 && T.nk.length > 3) s += 12 + T.nk.length;
      best.push({ T: T, s: s });
    });
    best.sort(function (a, b) { return b.s - a.s; });
    var seen = {}, out = [];
    best.forEach(function (x) { if (!seen[x.T.nk]) { seen[x.T.nk] = 1; out.push(x.T); } });
    return out.slice(0, limit || 3);
  }

  function bookOf(key) {
    return (KB.books || []).filter(function (b) { return b.key === key; })[0] ||
      { key: key, name: key, color: "#6d5efc", file: "pages/" + key + ".html" };
  }
  function lessonLink(l) { return url(bookOf(l.b).file) + "#" + l.id; }
  function payload(l) { return { l: l, score: 99 }; }

  /* ==================== ماشین‌حساب علمی ==================== */
  function calc(expr) {
    var s = String(expr)
      .replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); })
      .replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })
      .replace(/[×✕·]/g, "*").replace(/[÷]/g, "/").replace(/[−–—]/g, "-")
      .replace(/جذر|رادیکال/g, " sqrt ")
      .replace(/[^0-9a-zA-Z+\-*/^%().,\s]/g, " ")
      .replace(/,/g, "").replace(/\s+/g, "");
    if (!/[0-9]/.test(s) || !/[+\-*/^%]|sqrt|sin|cos|tan|log|ln/.test(s)) return null;
    var i = 0;
    function ws() { while (s[i] === " ") i++; }
    function num() { ws(); var st = i; while (i < s.length && /[0-9.]/.test(s[i])) i++; return st === i ? NaN : parseFloat(s.slice(st, i)); }
    function ident() { ws(); var st = i; while (i < s.length && /[a-z]/.test(s[i])) i++; return s.slice(st, i); }
    function primary() {
      ws();
      if (s[i] === "(") { i++; var v = exprE(); ws(); if (s[i] === ")") i++; return v; }
      if (s[i] === "-") { i++; return -primary(); }
      if (s[i] === "+") { i++; return primary(); }
      var nm = ident();
      if (nm) {
        if (nm === "pi") return Math.PI;
        if (nm === "e") return Math.E;
        ws();
        var arg;
        if (s[i] === "(") { i++; arg = exprE(); ws(); if (s[i] === ")") i++; } else arg = primary();
        var f = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10,
          ln: Math.log, abs: Math.abs, round: Math.round, floor: Math.floor, ceil: Math.ceil, exp: Math.exp }[nm];
        return f ? f(arg) : NaN;
      }
      return num();
    }
    function power() { var b = primary(); ws(); if (s[i] === "^") { i++; return Math.pow(b, power()); } return b; }
    function term() {
      var v = power(); ws();
      while (s[i] === "*" || s[i] === "/" || s[i] === "%") { var op = s[i]; i++; var r = power(); v = op === "*" ? v * r : op === "/" ? v / r : v % r; ws(); }
      return v;
    }
    function exprE() { var v = term(); ws(); while (s[i] === "+" || s[i] === "-") { var op = s[i]; i++; var r = term(); v = op === "+" ? v + r : v - r; ws(); } return v; }
    try { var res = exprE(); ws(); if (i < s.length || !isFinite(res)) return null; return Math.round(res * 1e8) / 1e8; } catch (e) { return null; }
  }
  function isCalc(q) {
    var n = norm(q);
    if (/(محاسبه|حساب کن|جواب این|چند است|چقدر)/.test(n) && /[0-9]/.test(n)) return true;
    return /^[\s0-9+\-*/^%().,×÷a-z]*$/.test(n) && /[0-9]/.test(n) && /[+\-*/^%]/.test(n);
  }

  /* ==================== تشخیص قصد ==================== */
  function intentOf(q) {
    var n = norm(q);
    if (/^(سلام|درود|هی|های|خوبی|خسته نباشی|ممنون|مرسی|سپاس|خداحافظ)/.test(n)) return "greet";
    if (/(راهنما|چیکار|چه کار|کمک|چه میتوانی|چی بلدی|امکانات|چیکار میتونی)/.test(n)) return "help";
    if (isCalc(q)) return "calc";
    if (/(پشتیبانی|تماس|شماره|تلفن)/.test(n)) return "support";
    if (/(پیشرفت|چقدر خواندم|چقدر خوانده|کجا ضعیف|نقاط ضعف|ضعیفم|وضعیت من|وضعیتم)/.test(n)) return "progress";
    if (/(برنامه|برنامهریزی|پلان|زمانبندی|چطور بخوانم)/.test(n)) return "plan";
    if (/(سؤال بساز|سوال بساز|آزمون بساز|تست بساز|امتحان بگیر|سؤال بده|سوال بده|نمونه سؤال بساز)/.test(n)) return "quiz";
    if (/(خلاصه|جمعبندی|جمع بندی|چکیده)/.test(n)) return "summary";
    if (/(مثال|نمونه|مصداق)/.test(n)) return "example";
    if (/(فرمول|رابطه|قاعده|قانون)/.test(n)) return "formula";
    if (/(تفاوت|فرق|مقایسه|چه فرقی)/.test(n)) return "compare";
    if (/(مراحل|گام به گام|چطور حل|چگونه حل|روش حل|حل کن)/.test(n)) return "steps";
    if (/(چرا|دلیل|علت|به چه علت)/.test(n)) return "cause";
    if (/(فهرست|انواع|چه چیزهایی|چه موارد|چند نوع)/.test(n)) return "list";
    if (/(چیست|چیه|تعریف|یعنی چه|معنی|یعنی چی|به چه معنا)/.test(n)) return "define";
    return "open";
  }

  function fmtList(items, marker) {
    return items.map(function (x, i) { return (marker === "num" ? fa(i + 1) + ". " : "• ") + x; }).join("\n");
  }
  function clip(s, n) { s = String(s || "").trim(); return s.length > n ? s.slice(0, n) + "…" : s; }

  /* ==================== ترکیب پاسخ ==================== */
  function answer(q) {
    var it = intentOf(q);
    var hits = retrieve(q, 4);
    var found = findTerms(q, 3);
    var out = { text: "", src: hits, acts: [] };
    var main = hits[0] ? hits[0].l : (found[0] ? KB.lessons[found[0].li] : null);

    if (it === "greet") {
      out.text = "سلام! خوش آمدی. من دستیار آموزشی پایهٔ هشتم هستم و روی همهٔ محتوای همین مجموعه کار می‌کنم — بدون نیاز به اینترنت و بدون هیچ کلیدی.\n\n" +
        "کافی است سؤالت را بنویسی؛ مثلاً:\n• «فیثاغورس چیست؟»\n• «تفاوت تغییر فیزیکی و شیمیایی چیست؟»\n• «فرمول‌های فصل الکتریسیته را بگو»\n• «برای درس تولید مثل ۵ سؤال بساز»\n• «برنامهٔ مطالعه بده»\n\nپشتیبانی: " + SUPPORT;
      out.src = [];
      return out;
    }
    if (it === "help") {
      out.text = "این فهرست کارهایی است که همین حالا و بدون اینترنت می‌توانم انجام دهم:\n\n" +
        fmtList([
          "تعریف هر واژه یا مفهوم کتاب",
          "توضیح و جمع‌بندی هر یک از ۱۷۵ درس",
          "نمایش فرمول‌ها و قواعد ثبت‌شده",
          "حل گام‌به‌گام و مراحل کار",
          "بیان علت و چرایی پدیده‌ها",
          "مقایسه و تفاوت دو مفهوم",
          "ساخت آزمون چهارگزینه‌ای و جای خالی از هر درس",
          "ساخت برنامهٔ مطالعهٔ هفتگی",
          "تحلیل پیشرفت و پیدا کردن درس‌های ضعیف",
          "ماشین‌حساب علمی"
        ]) + "\n\nسؤالت را بپرس یا از دکمه‌های آمادهٔ کنار صفحه استفاده کن.";
      out.src = [];
      return out;
    }
    if (it === "support") {
      out.text = "پشتیبانی این مجموعه:\n\n• شمارهٔ تماس: " + SUPPORT + "\n\n" +
        "اگر درسی ایراد داشت یا پیشنهادی داشتی، خوشحال می‌شویم بشنویم.";
      out.acts = [{ t: "تماس با پشتیبانی", a: function () { location.href = "tel:" + SUPPORT_RAW; } }];
      out.src = [];
      return out;
    }
    if (it === "calc") {
      var r = calc(q);
      if (r !== null) {
        out.text = "نتیجهٔ محاسبه:\n\n" + fa(r) + "\n\nاین محاسبه روی همین دستگاه و بدون اینترنت انجام شد.";
        out.acts = [{ t: "کپی نتیجه", a: function () { try { navigator.clipboard.writeText(String(r)); toast("کپی شد"); } catch (e) {} } }];
        out.src = [];
        return out;
      }
    }
    if (it === "progress") return progressAnswer();
    if (it === "plan") return planAnswer();
    if (it === "quiz") return quizAnswer(main, q);

    if (!main) {
      out.text = "چیزی مرتبط با این پرسش در محتوای درس‌ها پیدا نکردم.\n\n" +
        "می‌توانی:\n• واژهٔ کلیدی دیگری امتحان کنی (مثلاً «فیثاغورس»، «تنظیم عصبی»، «آرایه‌های ادبی»)\n" +
        "• از منوی «کتاب‌های هشتم» درس مورد نظر را باز کنی\n" +
        "• یا کلمهٔ کمتری بنویسی؛ مثلاً «هوازدگی» به‌جای «چه عواملی باعث هوازدگی می‌شوند»\n\n" +
        "پشتیبانی: " + SUPPORT;
      out.src = [];
      out.acts = [{ t: "فهرست کتاب‌ها", a: function () { location.href = url("index.html#subjects"); } }];
      return out;
    }

    LAST.lesson = main;
    var b = bookOf(main.b);
    var head = "«" + main.t + "» — " + b.name + (main.badge ? " (" + main.badge + ")" : "");

    if (it === "define") {
      var T = found[0];
      out.text = (T && T.nk.length > 2)
        ? "تعریف:\n\n" + T.t + ": " + T.d + "\n\nدرس: «" + KB.lessons[T.li].t + "» — " + bookOf(KB.lessons[T.li].b).name +
          (main.s ? "\n\nتوضیح بیشتر: " + clip(main.s, 200) : "")
        : head + "\n\n" + (main.s || "") + "\n\n" + fmtList((main.pts || []).slice(0, 5));
      LAST.term = T || null;
    } else if (it === "compare") {
      var t2 = found[0], t3 = found[1];
      out.text = "مقایسه:\n\n";
      if (t2 && t3) out.text += "۱) " + t2.t + ": " + t2.d + "\n\n۲) " + t3.t + ": " + t3.d + "\n\n";
      else if (t2) out.text += t2.t + ": " + t2.d + "\n\n";
      out.text += "درس مرتبط: " + head + "\n\n" + fmtList((main.pts || []).slice(0, 5));
    } else if (it === "formula") {
      if ((main.f || []).length) {
        out.text = "فرمول‌ها و قواعد " + head + ":\n\n" + (main.f || []).map(function (f, i) {
          return fa(i + 1) + ". " + (f[0] ? f[0] + ": " : "") + f[1];
        }).join("\n");
        if ((main.pts || []).length) out.text += "\n\nنکته‌های کلیدی:\n" + fmtList((main.pts || []).slice(0, 4));
      } else {
        var withF = KB.lessons.filter(function (l) { return (l.f || []).length; })[0] || main;
        out.text = "در درس «" + main.t + "» فرمول ثبت‌شده‌ای نداریم؛ این درس مفهومی است.\n\n" +
          "نزدیک‌ترین درس با فرمول: «" + withF.t + "» — " + bookOf(withF.b).name + "\n" +
          (withF.f || []).map(function (f, i) { return fa(i + 1) + ". " + (f[0] ? f[0] + ": " : "") + f[1]; }).join("\n");
      }
    } else if (it === "cause") {
      var whys = (main.ca || []).concat((main.pts || []).map(function (p) { return ["", p]; }))
        .filter(function (c) { return /چون|زیرا|دلیل|علت|باعث|موجب|نتیجه/.test(c[1] || ""); });
      out.text = "دربارهٔ علت و چرایی در " + head + ":\n\n" +
        (whys.length ? fmtList(whys.slice(0, 6).map(function (c) { return (c[0] ? c[0] + ": " : "") + clip(c[1], 220); }))
                     : fmtList((main.pts || []).slice(0, 5))) +
        (main.s ? "\n\nزمینهٔ کلی: " + clip(main.s, 200) : "");
    } else if (it === "example") {
      out.text = "مثال‌ها و نمونه‌های " + head + ":\n\n" +
        ((main.st || []).length
          ? fmtList((main.st || []).slice(0, 5).map(function (s) { return (s[0] ? s[0] + ": " : "") + clip(s[1], 200); }), "num")
          : fmtList((main.terms || []).slice(0, 5).map(function (t) { return t[0] + ": " + t[1]; }), "num"));
    } else if (it === "steps") {
      out.text = "مراحل کار در " + head + ":\n\n" +
        ((main.st || []).length
          ? (main.st || []).slice(0, 6).map(function (s, i) {
              return "گام " + fa(i + 1) + (s[0] ? " — " + s[0] : "") + "\n" + clip(s[1], 240);
            }).join("\n\n")
          : fmtList((main.pts || []).slice(0, 6), "num"));
    } else if (it === "list") {
      out.text = "فهرست مطالب " + head + ":\n\n" +
        fmtList((main.pts || []).slice(0, 8).map(function (p) { return clip(p, 200); })) +
        ((main.terms || []).length ? "\n\nواژه‌های مهم:\n" + fmtList((main.terms || []).slice(0, 6).map(function (t) { return t[0] + ": " + clip(t[1], 120); })) : "");
    } else if (it === "summary") {
      out.text = "خلاصهٔ " + head + ":\n\n" + (main.s ? main.s + "\n\n" : "") +
        fmtList((main.pts || []).slice(0, 8).map(function (p) { return clip(p, 200); })) +
        ((main.f || []).length ? "\n\nفرمول‌های مهم:\n" + fmtList((main.f || []).slice(0, 4).map(function (f) { return (f[0] ? f[0] + ": " : "") + f[1]; })) : "");
    } else {
      out.text = "نزدیک‌ترین بخش جزوه به پرسش تو: " + head + "\n\n" +
        (main.s ? main.s + "\n\n" : "") +
        "مهم‌ترین نکته‌ها:\n" + fmtList((main.pts || []).slice(0, 6).map(function (p) { return clip(p, 200); })) +
        ((main.terms || []).length ? "\n\nواژه‌های کلیدی:\n" + fmtList((main.terms || []).slice(0, 4).map(function (t) { return t[0] + ": " + clip(t[1], 130); })) : "") +
        (hits.length > 1 ? "\n\nبخش‌های مرتبط دیگر:\n" + fmtList(hits.slice(1).map(function (h) { return "«" + h.l.t + "» — " + bookOf(h.l.b).name; })) : "");
    }

    out.acts = [
      { t: "رفتن به این درس", a: function () { location.href = lessonLink(main); } },
      { t: "خلاصه‌اش را بگو", a: function () { send("خلاصهٔ درس «" + main.t + "» را بگو"); } },
      { t: "۵ سؤال از این درس", a: function () { send("برای درس «" + main.t + "» ۵ سؤال بساز"); } },
      { t: "فلش‌کارت این درس", a: function () { location.href = url("flashcards.html"); } }
    ];
    return out;
  }

  /* ==================== سازندهٔ آزمون محلی ==================== */
  function quizAnswer(lesson, q) {
    if (!lesson) lesson = LAST.lesson || KB.lessons[0];
    var m = norm(q).match(/([0-9]+)/);
    var n = m ? Math.min(10, Math.max(3, parseInt(m[1], 10))) : 5;
    var out = { text: "", src: [payload(lesson)], acts: [] };
    var b = bookOf(lesson.b);
    var lines = [], i;

    var pool = (lesson.terms || []).filter(function (t) { return t[1].length > 8; });
    var others = [];
    KB.lessons.forEach(function (l) { if (l.id !== lesson.id) (l.terms || []).forEach(function (t) { if (t[1].length > 8) others.push(t); }); });
    var mcq = [];
    for (i = 0; i < pool.length && mcq.length < Math.ceil(n / 2); i++) {
      var t = pool[i], wrong = [];
      for (var k = 0; wrong.length < 3 && k < 40; k++) {
        var c = others[Math.floor(Math.random() * others.length)];
        if (c && norm(c[1]) !== norm(t[1]) && wrong.indexOf(c[1]) === -1) wrong.push(c[1]);
      }
      if (wrong.length < 3) continue;
      var opts = [t[1]].concat(wrong);
      for (var j = opts.length - 1; j > 0; j--) { var r = Math.floor(Math.random() * (j + 1)); var tmp = opts[j]; opts[j] = opts[r]; opts[r] = tmp; }
      mcq.push({ q: "تعریف درست «" + t[0] + "» کدام است؟", opts: opts });
    }
    if (mcq.length) {
      lines.push("بخش اول — چهارگزینه‌ای:");
      mcq.forEach(function (x, idx) {
        lines.push("\n" + fa(idx + 1) + ") " + x.q + "\n" +
          x.opts.map(function (o, oi) { return "   " + fa(oi + 1) + ") " + clip(o, 110); }).join("\n"));
      });
    }
    var desc = [];
    (lesson.pts || []).forEach(function (p) {
      if (desc.length >= n - mcq.length) return;
      var w = p.split(" ");
      if (w.length < 7) return;
      desc.push("جای خالی را کامل کن: " + w.slice(0, Math.max(3, Math.floor(w.length * 0.6))).join(" ") + " ……");
    });
    (lesson.pts || []).forEach(function (p) {
      if (desc.length >= n - mcq.length) return;
      desc.push("توضیح بده: " + clip(p, 120));
    });
    if (desc.length) {
      lines.push("\nبخش دوم — تشریحی:");
      desc.forEach(function (d, idx) { lines.push(fa(mcq.length + idx + 1) + ") " + d); });
    }

    out.text = "«" + lesson.t + "» — " + b.name + " (" + (lesson.badge || "") + ")\n\n" +
      fa(n) + " سؤال ساخته‌شده از متن همین جزوه:\n\n" + lines.join("\n") +
      "\n\nپاسخ‌ها را در بخش «نکات کلیدی» و «واژه‌نامهٔ» همین درس در جزوه پیدا می‌کنی.";
    out.acts = [
      { t: "رفتن به درس (دیدن پاسخ‌ها)", a: function () { location.href = lessonLink(lesson); } },
      { t: "۵ سؤال دیگر", a: function () { send("برای درس «" + lesson.t + "» ۵ سؤال بساز"); } },
      { t: "آزمون جامع تصادفی", a: function () { location.href = url("exam.html"); } }
    ];
    return out;
  }

  /* ==================== پیشرفت و برنامهٔ مطالعه ==================== */
  function readDone(bk) {
    var ids = KB.lessons.filter(function (l) { return l.b === bk; }).map(function (l) { return l.id; });
    return { done: ids.filter(function (id) { return LS.get("g8:read:" + bk + ":" + id, false); }).length, total: ids.length };
  }

  function progressAnswer() {
    var rows = KB.books.map(function (b) {
      var r = readDone(b.key);
      return { b: b, done: r.done, total: r.total, pct: r.total ? Math.round(r.done / r.total * 100) : 0 };
    }).sort(function (x, y) { return x.pct - y.pct; });
    var total = rows.reduce(function (a, r) { return a + r.total; }, 0);
    var done = rows.reduce(function (a, r) { return a + r.done; }, 0);
    var exams = LS.get("g8:exams", []);
    var avg = exams.length ? Math.round(exams.reduce(function (a, e) { return a + (e.pct || 0); }, 0) / exams.length) : 0;

    var txt = "وضعیت مطالعهٔ تو (بر پایهٔ علامت‌های «خوانده‌ام» و کارنامهٔ آزمون‌ها):\n\n" +
      "• پیشرفت کل: " + fa(total ? Math.round(done / total * 100) : 0) + "٪ (" + fa(done) + " از " + fa(total) + " درس)\n" +
      "• آزمون جامع: " + (exams.length ? fa(exams.length) + " آزمون، میانگین " + fa(avg) + "٪" : "هنوز آزمونی نداده‌ای") + "\n\n" +
      "کتاب‌ها به ترتیب عقب‌ماندگی:\n" +
      fmtList(rows.slice(0, 6).map(function (r) { return r.b.name + " — " + fa(r.pct) + "٪ (" + fa(r.done) + " از " + fa(r.total) + ")"; }), "num");
    var weak = rows.filter(function (r) { return r.pct < 100; }).slice(0, 3);
    if (weak.length) txt += "\n\nپیشنهاد: از " + weak.map(function (r) { return "«" + r.b.name + "»"; }).join(" و ") + " شروع کن؛ پایین‌ترین درصد را دارند.";
    return { text: txt, src: [], acts: [
      { t: "داشبورد کامل", a: function () { location.href = url("dashboard.html"); } },
      { t: "آزمون بگیر", a: function () { location.href = url("exam.html"); } },
      { t: "برنامهٔ هفتگی بده", a: function () { send("برای من برنامهٔ مطالعهٔ هفتگی بده"); } }
    ] };
  }

  function planAnswer() {
    var rows = KB.books.map(function (b) { var r = readDone(b.key); return { b: b, pct: r.total ? r.done / r.total : 0 }; })
      .sort(function (x, y) { return x.pct - y.pct; });
    var days = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
    var lines = days.map(function (d, i) {
      var a = rows[i % rows.length].b, b2 = rows[(i + 4) % rows.length].b;
      if (i === 6) return d + ": مرور هفته و رفع اشکال — جمع‌بندی درس‌های خوانده‌شده + یک آزمون کوتاه";
      return d + ": ۶۰ دقیقه " + a.name + " + ۳۰ دقیقه " + b2.name + " — یک درس از هر کدام و ۱۰ تست";
    });
    return { text: "برنامهٔ پیشنهادی هفتگی (روزی ۹۰ دقیقه):\n\n" + fmtList(lines) +
      "\n\nساختار هر جلسهٔ مطالعه:\n" + fmtList([
        "۱۰ دقیقه مرور سریع درس جلسهٔ قبل",
        "۲۵ دقیقه مطالعهٔ درس جدید (پنل «شرح و خلاصه» + «نکات کلیدی»)",
        "۵ دقیقه استراحت",
        "۲۵ دقیقه تمرین: مثال حل‌شده را بی‌نگاه بازتولید کن",
        "۲۰ دقیقه آزمون همان درس + رفع اشتباه‌ها",
        "۵ دقیقه علامت‌زدن «خوانده‌ام» و نوشتن یادداشت"
      ], "num"),
      src: [], acts: [
        { t: "شروع مطالعه", a: function () { location.href = url("index.html#subjects"); } },
        { t: "تحلیل پیشرفت من", a: function () { send("وضعیت پیشرفت من چطور است؟"); } }
      ] };
  }

  /* ==================== اتصال اختیاری (پیشرفته) ==================== */
  function systemPrompt(ctx) {
    return "تو «دستیار آموزشی پایهٔ هشتم» هستی؛ معلم خصوصی فارسی‌زبان، دقیق و صمیمی برای دانش‌آموز ۱۳-۱۴ سالهٔ ایرانی.\n" +
      "۱) ساده و فارسی توضیح بده. ۲) اگر پاسخ در «منابع درس» بود بر همان تکیه کن و در پایان منبع را بنویس. " +
      "۳) اگر نبود، از دانش عمومی بگو و صریح بگو که در جزوه نبوده. ۴) حل ریاضی و علوم را گام‌به‌گام بنویس. " +
      "۵) اطلاعات نادرست نساز. ۶) پاسخ را با فهرست کوتاه بنویس.\n\n" + (ctx || "منبع مرتبطی در جزوه پیدا نشد.");
  }
  function endpoint() {
    var b = (CFG.baseUrl || "").replace(/\/+$/, "");
    return /\/chat\/completions$/.test(b) ? b : b + "/chat/completions";
  }
  function llm(messages, onToken) {
    var body = { model: CFG.model || "gpt-4o-mini", messages: messages, temperature: Number(CFG.temp) || 0.4, stream: !!onToken };
    return fetch(endpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + (CFG.key || "") },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) {
        var msg = "خطای سرویس (" + r.status + ")";
        try { var j = JSON.parse(t); if (j.error && j.error.message) msg += ": " + j.error.message; } catch (e) { msg += ": " + t.slice(0, 180); }
        throw new Error(msg);
      });
      if (!onToken || !r.body || !r.body.getReader) return r.json().then(function (j) {
        var txt = (j.choices && j.choices[0] && (j.choices[0].message ? j.choices[0].message.content : j.choices[0].text)) || "";
        if (onToken) onToken(txt); return txt;
      });
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      return (function pump() {
        return reader.read().then(function (res) {
          if (res.done) return full;
          buf += dec.decode(res.value, { stream: true });
          var lines = buf.split("\n"); buf = lines.pop();
          lines.forEach(function (ln) {
            ln = ln.trim(); if (ln.indexOf("data:") !== 0) return;
            var p = ln.slice(5).trim(); if (p === "[DONE]") return;
            try { var j = JSON.parse(p); var d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content; if (d) { full += d; onToken(d); } } catch (e) {}
          });
          return pump();
        });
      })();
    });
  }

  /* ==================== رابط کاربری ==================== */
  var msgsEl, inputEl, sendBtn, srcEl, modeEl, selBook, selLesson;

  function bubble(role, html, acts) {
    var wrap = document.createElement("div");
    wrap.className = "msg" + (role === "me" ? " me" : "");
    wrap.innerHTML = '<span class="who">' + (role === "me" ? "من" : "د") + '</span><div><div class="bubble">' + html + "</div></div>";
    var holder = wrap.querySelector("div");
    if (acts && acts.length) paint(holder, acts);
    msgsEl.appendChild(wrap);
    msgsEl.scrollTop = msgsEl.scrollHeight;
    return wrap.querySelector(".bubble");
  }
  function paint(holder, acts) {
    var box = document.createElement("div"); box.className = "acts";
    acts.forEach(function (a) { var b = document.createElement("button"); b.textContent = a.t; b.addEventListener("click", a.a); box.appendChild(b); });
    holder.appendChild(box);
  }
  function addActs(el, acts) { if (el && acts && acts.length) paint(el.parentElement, acts); }
  function setMode() {
    if (!modeEl) return;
    if (CFG.key) { modeEl.className = "ai-mode online"; modeEl.textContent = "حالت پیشرفتهٔ متصل"; }
    else { modeEl.className = "ai-mode"; modeEl.textContent = "آنلاین — پاسخ از سرور سایت"; }
  }
  function renderSources(list) {
    if (!srcEl) return;
    if (!list || !list.length) { srcEl.innerHTML = '<p style="color:var(--muted);font-size:.82rem">منبعی برای نمایش نیست.</p>'; return; }
    srcEl.innerHTML = list.map(function (s) {
      var b = bookOf(s.l.b);
      return '<a class="src-item" href="' + lessonLink(s.l) + '" style="--mc:' + b.color + '">' +
        "<b>" + esc(s.l.t) + "</b><span>" + esc(b.name) + " • " + esc(s.l.badge || "") + "</span></a>";
    }).join("");
  }

  function send(text) {
    if (busy) return;
    text = (text || inputEl.value).trim();
    if (!text) return;
    inputEl.value = ""; inputEl.style.height = "auto";
    bubble("me", esc(text).replace(/\n/g, "<br>"));
    CHAT.push({ role: "user", content: text });
    busy = true; sendBtn.disabled = true;
    var bot = bubble("bot", '<span class="typing"><i></i><i></i><i></i></span>');

    function local() {
      var res;
      try { res = answer(text); }
      catch (err) { res = { text: "در پردازش این پرسش خطایی رخ داد. جمله را ساده‌تر بنویس یا با پشتیبانی تماس بگیر: " + SUPPORT, src: [], acts: [] }; }
      bot.innerHTML = esc(res.text).replace(/\n/g, "<br>");
      addActs(bot, res.acts);
      renderSources(res.src);
      CHAT.push({ role: "assistant", content: res.text });
      msgsEl.scrollTop = msgsEl.scrollHeight;
      busy = false; sendBtn.disabled = false;
    }

    if (!CFG.key) { setTimeout(local, 240); return; }

    var hits = retrieve(text, 3);
    var ctx = hits.map(function (h) {
      var l = h.l;
      return "### " + l.t + " — " + bookOf(l.b).name + "\n" + (l.s || "") + "\n" +
        (l.pts || []).map(function (p) { return "- " + p; }).join("\n") + "\n" +
        (l.terms || []).map(function (t) { return "- " + t[0] + ": " + t[1]; }).join("\n");
    }).join("\n");
    renderSources(hits);
    var messages = [{ role: "system", content: systemPrompt(ctx) }]
      .concat(CHAT.slice(-8).map(function (m) { return { role: m.role, content: m.content }; }));
    var acc = "";
    llm(messages, function (tok) { acc += tok; bot.innerHTML = esc(acc).replace(/\n/g, "<br>"); msgsEl.scrollTop = msgsEl.scrollHeight; })
      .then(function (full) {
        acc = full || acc;
        bot.innerHTML = esc(acc).replace(/\n/g, "<br>");
        addActs(bot, [
          { t: "کپی پاسخ", a: function () { try { navigator.clipboard.writeText(acc); toast("کپی شد"); } catch (e) {} } },
          { t: "خواندن با صدای بلند", a: function () { speak(acc); } }
        ]);
        CHAT.push({ role: "assistant", content: acc });
        busy = false; sendBtn.disabled = false;
      })
      .catch(function (e) {
        var res = answer(text);
        bot.innerHTML = "<b>اتصال به سرویس بیرونی برقرار نشد؛ پاسخ از موتور مستقل آمد:</b><br>" +
          '<span style="font-size:.78rem;color:var(--muted)">' + esc(e.message) + "</span><br><br>" +
          esc(res.text).replace(/\n/g, "<br>");
        addActs(bot, res.acts);
        renderSources(res.src);
        CHAT.push({ role: "assistant", content: res.text });
        busy = false; sendBtn.disabled = false;
      });
  }

  function speak(t) {
    if (!("speechSynthesis" in window)) { toast("مرورگر از بلندخوانی پشتیبانی نمی‌کند"); return; }
    speechSynthesis.cancel();
    var u = new SpeechSynthesisUtterance(String(t).slice(0, 3000));
    u.lang = "fa-IR"; u.rate = .95;
    speechSynthesis.speak(u);
  }

  function stat(k) {
    return KB.lessons.reduce(function (a, l) { return a + (l[k] || []).length; }, 0);
  }

  function welcome() {
    bubble("bot",
      "<b>سلام! من دستیار آموزشی پایهٔ هشتم هستم.</b><br><br>" +
      "برخلاف چت‌بات‌های معمولی، برای کار کردن <b>به هیچ کلید، حساب یا سرویس بیرونی نیاز ندارم</b>. " +
      "همهٔ دانش من داخل همین برنامه ذخیره شده و روی دستگاه خودت اجرا می‌شود.<br><br>" +
      "آنچه در اختیار دارم:<br>" +
      fmtList([
        fa(KB.lessons.length) + " درس و فصل کامل",
        fa(stat("pts")) + " نکتهٔ کلیدی",
        fa(TERMS.length) + " واژه و اصطلاح تخصصی",
        fa(stat("f")) + " فرمول و قاعده",
        fa(stat("st")) + " مرحلهٔ حل گام‌به‌گام",
        fa(stat("ca")) + " توضیح مفهومی و چرایی"
      ]) + "<br><br>" +
      "چند نمونه از کارهایی که می‌توانی بخواهی:<br>" +
      "• «فیثاغورس چیست؟»<br>• «تفاوت تغییر فیزیکی و شیمیایی چیست؟»<br>" +
      "• «فرمول‌های فصل الکتریسیته»<br>• «برای درس تولید مثل ۵ سؤال بساز»<br>" +
      "• «برنامهٔ مطالعه بده» یا «وضعیت پیشرفت من چطور است؟»<br><br>" +
      "پشتیبانی: <b>" + SUPPORT + "</b>",
      [{ t: "چه کارهایی می‌توانی بکنی؟", a: function () { send("چه کارهایی می‌توانی انجام دهی؟"); } }]);
  }

  function curLessonTitle() {
    if (!selBook || !selLesson) return LAST.lesson ? LAST.lesson.t : "فیثاغورس";
    var l = KB.lessons.filter(function (x) { return x.b === selBook.value && x.id === selLesson.value; })[0];
    return l ? l.t : "فیثاغورس";
  }

  function buildUI() {
    msgsEl = $("[data-ai-msgs]"); inputEl = $("[data-ai-input]"); sendBtn = $("[data-ai-send]");
    srcEl = $("[data-ai-sources]"); modeEl = $("[data-ai-mode]");
    selBook = $("[data-ai-book]"); selLesson = $("[data-ai-lesson]");

    sendBtn.addEventListener("click", function () { send(); });
    inputEl.addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    inputEl.addEventListener("input", function () {
      inputEl.style.height = "auto";
      inputEl.style.height = Math.min(150, inputEl.scrollHeight) + "px";
    });
    $$("[data-ai-chip]").forEach(function (b) { b.addEventListener("click", function () { send(b.getAttribute("data-ai-chip")); }); });

    if (selBook) {
      selBook.innerHTML = KB.books.map(function (b) { return '<option value="' + b.key + '">' + esc(b.name) + "</option>"; }).join("");
      function fill() {
        selLesson.innerHTML = KB.lessons.filter(function (l) { return l.b === selBook.value; })
          .map(function (l) { return '<option value="' + l.id + '">' + esc(l.t) + "</option>"; }).join("");
      }
      selBook.addEventListener("change", fill); fill();
      var ask = $("[data-ai-ask-lesson]");
      if (ask) ask.addEventListener("click", function () {
        var l = KB.lessons.filter(function (x) { return x.b === selBook.value && x.id === selLesson.value; })[0];
        if (!l) return;
        inputEl.value = "درس «" + l.t + "» از " + bookOf(l.b).name + " را کامل و ساده توضیح بده، فرمول‌ها و نکته‌های مهمش را بگو و ۳ نمونه سؤال با پاسخ بساز.";
        inputEl.focus();
      });
    }

    var tools = $("[data-ai-tools]");
    if (tools) {
      var items = [
        ["خلاصهٔ درس", function () { send("خلاصهٔ درس «" + curLessonTitle() + "» را بگو"); }],
        ["۵ سؤال بساز", function () { send("برای درس «" + curLessonTitle() + "» ۵ سؤال بساز"); }],
        ["فرمول‌های درس", function () { send("فرمول‌های درس «" + curLessonTitle() + "» را بگو"); }],
        ["تفاوت دو مفهوم", function () { inputEl.value = "تفاوت تغییر فیزیکی و شیمیایی چیست؟"; inputEl.focus(); }],
        ["برنامهٔ مطالعه", function () { send("برای من برنامهٔ مطالعهٔ هفتگی بده"); }],
        ["وضعیت پیشرفت من", function () { send("وضعیت پیشرفت من چطور است؟"); }],
        ["ماشین‌حساب", function () { inputEl.value = "محاسبه کن: sqrt(144) + 2^5"; inputEl.focus(); }],
        ["پشتیبانی", function () { send("شمارهٔ پشتیبانی چیست؟"); }]
      ];
      tools.innerHTML = items.map(function (it, i) { return '<button class="btn btn-sm btn-ghost" data-tool="' + i + '">' + it[0] + "</button>"; }).join("");
      tools.addEventListener("click", function (e) {
        var b = e.target.closest("[data-tool]"); if (!b) return;
        items[+b.dataset.tool][1]();
      });
    }

    var clr = $("[data-ai-clear]");
    if (clr) clr.addEventListener("click", function () {
      if (!confirm("همهٔ پیام‌های این گفت‌وگو پاک شود؟")) return;
      CHAT = []; msgsEl.innerHTML = ""; renderSources([]); welcome();
    });

    var f = { baseUrl: $("[data-cfg-base]"), key: $("[data-cfg-key]"), model: $("[data-cfg-model]"), temp: $("[data-cfg-temp]") };
    if (f.baseUrl) {
      f.baseUrl.value = CFG.baseUrl; f.key.value = CFG.key; f.model.value = CFG.model; f.temp.value = CFG.temp;
      $("[data-cfg-save]").addEventListener("click", function () {
        CFG = { baseUrl: f.baseUrl.value.trim() || "https://api.openai.com/v1", key: f.key.value.trim(),
                model: f.model.value.trim() || "gpt-4o-mini", temp: parseFloat(f.temp.value) || 0.4 };
        LS.set("g8:ai", CFG); setMode(); toast(CFG.key ? "حالت پیشرفته فعال شد" : "حالت مستقل فعال است");
      });
      $("[data-cfg-clear]").addEventListener("click", function () {
        CFG.key = ""; f.key.value = ""; LS.set("g8:ai", CFG); setMode(); toast("کلید حذف شد؛ دستیار مستقل کار می‌کند");
      });
      $("[data-cfg-test]").addEventListener("click", function () {
        if (!CFG.key) { toast("این بخش اختیاری است؛ دستیار بدون کلید هم کار می‌کند"); return; }
        toast("در حال آزمایش اتصال…");
        llm([{ role: "user", content: "فقط بنویس: اتصال برقرار است" }], null)
          .then(function (t) { toast("اتصال موفق: " + String(t).slice(0, 40)); })
          .catch(function (e) { toast("اتصال ناموفق — " + e.message.slice(0, 70)); });
      });
    }

    var tel = $("[data-support-call]");
    if (tel) tel.setAttribute("href", "tel:" + SUPPORT_RAW);
  }

  /* ==================== راه‌اندازی ==================== */
  J(kbFile)
    .then(function (d) {
      KB = d; buildIndex();
      buildUI(); setMode(); welcome(); renderSources([]);
      var p = new URLSearchParams(location.search);
      if (p.get("q")) { inputEl.value = p.get("q"); send(); }
    })
    .catch(function (err) {
      if (window.console && console.error) console.error("G8 assistant init failed:", err);
      toast("راه‌اندازی دستیار کامل نشد");
    });
})();
