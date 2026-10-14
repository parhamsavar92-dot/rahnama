/* ==========================================================================
   رهنما — مرکز ابزارها  |  r9-tools.js
   --------------------------------------------------------------------------
   ۲۰ ابزار واقعی و کاربردی. همه در مرورگر و بدون اینترنت کار می‌کنند.
   هر ابزار مستقل است: اگر یکی خطا بدهد، بقیه سالم می‌مانند.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function toast(m) { try { W.HK && W.HK.toast ? W.HK.toast(m) : null; } catch (e) { } }
  function num(v) { var n = parseFloat(String(v).replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); }).replace(/[٠-٩]/g, function (d) { return String("٠١٢٣٤٥٦٧٨٩".indexOf(d)); })); return isNaN(n) ? null : n; }
  function fa(n, d) {
    if (typeof n !== "number" || !isFinite(n)) return "—";
    var s = d === undefined ? String(Math.round(n * 1e6) / 1e6) : n.toFixed(d);
    return s.replace(/\d/g, function (x) { return "۰۱۲۳۴۵۶۷۸۹"[+x]; }).replace(/\./g, "٫");
  }
  function out(el, html) { if (el) el.innerHTML = html; }
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem("r9:" + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("r9:" + k, JSON.stringify(v)); } catch (e) { } }
  };

  /* ═══════════════════════════ ۱. پومودورو ═══════════════════════════ */
  function pomodoro() {
    var wrap = $("#tool-pomodoro"); if (!wrap) return;
    var clock = $("#pmClock", wrap), ring = $("#pmRing i", wrap) || $(".rt-ring circle", wrap);
    var outEl = $("#pmOut", wrap), startB = $("#pmStart", wrap), stopB = $("#pmStop", wrap);
    var mode = 25, left = 25 * 60, timer = null;
    var C = 2 * Math.PI * 52;

    function paint() {
      var m = Math.floor(left / 60), s = left % 60;
      clock.textContent = fa(m) + ":" + ("0" + fa(s)).slice(-2);
      if (ring && ring.setAttribute) {
        var done = 1 - left / (mode * 60);
        ring.setAttribute("stroke-dasharray", C.toFixed(1));
        ring.setAttribute("stroke-dashoffset", (C * done).toFixed(1));
      }
      if (left > 0) { try { D.title = clock.textContent + " — پومودورو رهنما"; } catch (e) { } }
    }
    function beep() {
      try {
        var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
        var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.25, ac.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.9);
        o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + 0.95);
        setTimeout(function () { try { ac.close(); } catch (e) { } }, 1400);
      } catch (e) { }
    }
    function log(min) {
      var today = new Date().toISOString().slice(0, 10);
      var d = LS.get("pomo", {}); d[today] = (d[today] || 0) + min;
      LS.set("pomo", d);
      var total = 0; for (var k in d) total += d[k];
      out(outEl, "امروز: <b>" + fa(d[today]) + " دقیقه</b> تمرکز · مجموع کل: <b>" + fa(total) + " دقیقه</b>");
    }
    function tick() {
      left--;
      if (left <= 0) {
        clearInterval(timer); timer = null; beep();
        var wasWork = mode === 25;
        log(wasWork ? 25 : 0);
        mode = wasWork ? 5 : 25; left = mode * 60;
        try { if (W.Notification && Notification.permission === "granted") new Notification(wasWork ? "وقت استراحت!" : "برگرد به درس"); } catch (e) { }
        toast(wasWork ? "یک پومودورو تمام شد — ۵ دقیقه استراحت" : "استراحت تمام شد — برو سر درس");
        $("#pmMode", wrap) && ($("#pmMode", wrap).textContent = mode + " دقیقه");
      }
      paint();
    }
    function start() {
      if (timer) return;
      try { if (W.Notification && Notification.permission === "default") Notification.requestPermission(); } catch (e) { }
      timer = setInterval(tick, 1000); paint();
      toast("شروع شد — " + mode + " دقیقه");
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; toast("متوقف شد"); } }
    startB && startB.addEventListener("click", start);
    stopB && stopB.addEventListener("click", stop);
    $$("[data-pm]", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        var m = parseInt(b.getAttribute("data-pm"), 10);
        stop(); mode = m; left = m * 60; paint();
      });
    });
    paint();
    if (outEl && !outEl.textContent) log(0);
  }

  /* ═══════════════════════════ ۲. کرنومتر و تایمر آزمون ═══════════════════════════ */
  function stopwatch() {
    var wrap = $("#tool-stopwatch"); if (!wrap) return;
    var clock = $("#swClock", wrap), outEl = $("#swOut", wrap);
    var t0 = 0, acc = 0, iv = null, countdown = 0, laps = [];
    function fmt(ms) {
      ms = Math.max(0, ms);
      var s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
      return (h ? fa(h) + ":" : "") + ("0" + fa(m)).slice(-2) + ":" + ("0" + fa(ss)).slice(-2) +
        "٫" + fa(Math.floor((ms % 1000) / 100));
    }
    function render() {
      var el = acc + (iv && !countdown ? Date.now() - t0 : 0);
      if (countdown) {
        var rest = countdown - (acc + (iv ? Date.now() - t0 : 0));
        clock.textContent = fmt(rest);
        if (rest <= 0) { clearInterval(iv); iv = null; beepSimple(); out(outEl, '<span class="rt-warn">زمان تمام شد!</span>'); }
      } else clock.textContent = fmt(el);
    }
    function beepSimple() {
      try {
        var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
        var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
        o.frequency.value = 660; o.connect(g); g.connect(ac.destination);
        g.gain.value = 0.2; o.start(); o.stop(ac.currentTime + 0.7);
        setTimeout(function () { try { ac.close(); } catch (e) { } }, 1000);
      } catch (e) { }
    }
    $("#swStart", wrap) && $("#swStart", wrap).addEventListener("click", function () {
      if (iv) return; t0 = Date.now(); iv = setInterval(render, 97); render();
    });
    $("#swStop", wrap) && $("#swStop", wrap).addEventListener("click", function () {
      if (!iv) return; acc += Date.now() - t0; clearInterval(iv); iv = null; render();
    });
    $("#swReset", wrap) && $("#swReset", wrap).addEventListener("click", function () {
      clearInterval(iv); iv = null; acc = 0; countdown = 0; laps = []; render(); out(outEl, "");
    });
    $("#swLap", wrap) && $("#swLap", wrap).addEventListener("click", function () {
      laps.push(acc + (iv ? Date.now() - t0 : 0));
      out(outEl, laps.map(function (l, i) { return "دور " + fa(i + 1) + ": <b>" + fmt(l) + "</b>"; }).join("<br>"));
    });
    $("#swCd", wrap) && $("#swCd", wrap).addEventListener("click", function () {
      var m = num($("#swCdMin", wrap).value) || 0;
      if (m <= 0) { toast("دقیقه را بنویس"); return; }
      clearInterval(iv); iv = null; acc = 0; countdown = m * 60 * 1000; t0 = Date.now();
      iv = setInterval(render, 97); render(); toast("تایمر " + fa(m) + " دقیقه‌ای شروع شد");
    });
    render();
  }

  /* ═══════════════════════ ۳. ماشین‌حساب علمی (پارسر امن) ═══════════════════════ */
  function calc() {
    var wrap = $("#tool-calc"); if (!wrap) return;
    var inp = $("#calcIn", wrap), outEl = $("#calcOut", wrap);

    /* پارسر بازگشتی — بدون eval، پس هیچ خطری ندارد */
    function tokenize(s) {
      s = s.replace(/[۰-۹]/g, function (d) { return String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)); })
           .replace(/[×✕]/g, "*").replace(/[÷]/g, "/").replace(/،/g, ",").replace(/٫/g, ".");
      var t = [], i = 0;
      var fns = ["sqrt", "sin", "cos", "tan", "log", "ln", "abs", "asin", "acos", "atan", "exp"];
      while (i < s.length) {
        var c = s[i];
        if (/\s/.test(c)) { i++; continue; }
        if (/[0-9.]/.test(c)) { var j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; t.push({ t: "n", v: parseFloat(s.slice(i, j)) }); i = j; continue; }
        if (/[a-zA-Z]/.test(c)) {
          var k = i; while (k < s.length && /[a-zA-Z]/.test(s[k])) k++;
          var w = s.slice(i, k).toLowerCase();
          if (w === "pi") t.push({ t: "n", v: Math.PI });
          else if (w === "e") t.push({ t: "n", v: Math.E });
          else if (fns.indexOf(w) > -1) t.push({ t: "f", v: w });
          else throw new Error("ناشناخته: " + w);
          i = k; continue;
        }
        if ("+-*/^%()".indexOf(c) > -1) { t.push({ t: "o", v: c }); i++; continue; }
        throw new Error("نویسهٔ نامعتبر: " + c);
      }
      return t;
    }
    function parse(tk) {
      var p = 0;
      function peek() { return tk[p]; }
      function expr() {
        var v = term();
        while (peek() && peek().t === "o" && (peek().v === "+" || peek().v === "-")) {
          var o = tk[p++].v; var r = term(); v = o === "+" ? v + r : v - r;
        }
        return v;
      }
      function term() {
        var v = unary();
        while (peek() && peek().t === "o" && "*/%".indexOf(peek().v) > -1) {
          var o = tk[p++].v; var r = unary();
          if (o === "*") v = v * r; else if (o === "/") v = v / r; else v = v % r;
        }
        return v;
      }
      function unary() {
        if (peek() && peek().t === "o" && (peek().v === "-" || peek().v === "+")) {
          var o = tk[p++].v; var v = unary(); return o === "-" ? -v : v;
        }
        return power();
      }
      function power() {
        var v = atom();
        if (peek() && peek().t === "o" && peek().v === "^") { p++; var r = unary(); v = Math.pow(v, r); }
        return v;
      }
      function atom() {
        var x = tk[p++];
        if (!x) throw new Error("عبارت ناقص است");
        if (x.t === "n") return x.v;
        if (x.t === "f") {
          if (!peek() || peek().v !== "(") throw new Error("بعد از " + x.v + " پرانتز لازم است");
          p++; var a = expr();
          if (!peek() || peek().v !== ")") throw new Error("پرانتز بسته نشده");
          p++;
          var m = { sqrt: Math.sqrt, sin: Math.sin, cos: Math.cos, tan: Math.tan, log: Math.log10, ln: Math.log, abs: Math.abs, asin: Math.asin, acos: Math.acos, atan: Math.atan, exp: Math.exp };
          return m[x.v](a);
        }
        if (x.v === "(") {
          var v = expr();
          if (!peek() || peek().v !== ")") throw new Error("پرانتز بسته نشده");
          p++; return v;
        }
        throw new Error("عبارت نامعتبر");
      }
      var val = expr();
      if (p < tk.length) throw new Error("بخش اضافی: " + tk[p].v);
      return val;
    }
    function run() {
      var s = (inp.value || "").trim();
      if (!s) { out(outEl, ""); return; }
      try {
        var v = parse(tokenize(s));
        out(outEl, '<div class="rt-big">' + fa(v, 6).replace(/\.?0+$/, "") + '</div><div style="font-size:.78rem;color:var(--muted)">= ' + String(v) + "</div>");
      } catch (e) { out(outEl, '<span class="rt-warn">' + e.message + "</span>"); }
    }
    inp && inp.addEventListener("input", run);
    inp && inp.addEventListener("keydown", function (e) { if (e.key === "Enter") run(); });
    $$("[data-calc]", wrap).forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-calc");
        if (v === "C") { inp.value = ""; }
        else if (v === "←") { inp.value = inp.value.slice(0, -1); }
        else if (v === "=") { run(); return; }
        else inp.value += v;
        run(); inp.focus();
      });
    });
  }

  /* ══════════════════ ۴. معادلهٔ درجهٔ اول و دوم با گام‌ها ══════════════════ */
  function quadratic() {
    var wrap = $("#tool-quad"); if (!wrap) return;
    var outEl = $("#quadOut", wrap);
    $("#quadGo", wrap) && $("#quadGo", wrap).addEventListener("click", function () {
      var a = num($("#qa", wrap).value), b = num($("#qb", wrap).value), c = num($("#qc", wrap).value);
      if (a === null || b === null || c === null) { out(outEl, '<span class="rt-warn">هر سه ضریب را عدد بنویس (اگر نیست صفر بگذار).</span>'); return; }
      var L = [];
      if (a === 0) {
        if (b === 0) { out(outEl, c === 0 ? "بی‌شمار جواب (۰=۰)" : '<span class="rt-warn">جواب ندارد</span>'); return; }
        var x = -c / b;
        out(outEl, "<b>معادلهٔ درجهٔ اول</b><ol class='rt-steps'>" +
          "<li>" + fa(b) + "x + " + fa(c) + " = ۰</li>" +
          "<li>" + fa(b) + "x = " + fa(-c) + "</li>" +
          "<li>x = " + fa(-c) + " ÷ " + fa(b) + " = <b>" + fa(x) + "</b></li></ol>");
        return;
      }
      var d = b * b - 4 * a * c;
      L.push("Δ = b² − 4ac = " + fa(b) + "² − 4×" + fa(a) + "×" + fa(c) + " = <b>" + fa(d) + "</b>");
      if (d > 0) {
        var s = Math.sqrt(d), x1 = (-b + s) / (2 * a), x2 = (-b - s) / (2 * a);
        L.push("Δ > ۰ → دو جواب حقیقی");
        L.push("x₁ = (−b + √Δ) ÷ 2a = <b>" + fa(x1) + "</b>");
        L.push("x₂ = (−b − √Δ) ÷ 2a = <b>" + fa(x2) + "</b>");
        out(outEl, "<b>دو جواب</b><ol class='rt-steps'>" + L.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>");
      } else if (d === 0) {
        var x0 = -b / (2 * a);
        L.push("Δ = ۰ → یک جواب (ریشهٔ مضاعف)");
        L.push("x = −b ÷ 2a = <b>" + fa(x0) + "</b>");
        out(outEl, "<b>یک جواب</b><ol class='rt-steps'>" + L.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>");
      } else {
        var re = -b / (2 * a), im = Math.sqrt(-d) / (2 * a);
        L.push("Δ < ۰ → جواب حقیقی ندارد");
        L.push("جواب‌های مختلط: <b>" + fa(re) + (im >= 0 ? " + " : " − ") + fa(Math.abs(im)) + "i</b>");
        out(outEl, "<b>بدون جواب حقیقی</b><ol class='rt-steps'>" + L.map(function (t) { return "<li>" + t + "</li>"; }).join("") + "</ol>");
      }
    });
  }

  /* ══════════════════ ۵. ب.م.م، ک.م.م و تجزیه به عوامل اول ══════════════════ */
  function gcdlcm() {
    var wrap = $("#tool-gcd"); if (!wrap) return;
    var outEl = $("#gcdOut", wrap);
    function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { var t = b; b = a % b; a = t; } return a; }
    function factor(n) {
      n = Math.abs(Math.round(n)); if (n < 2) return [n];
      var f = [], d = 2;
      while (d * d <= n) { while (n % d === 0) { f.push(d); n /= d; } d++; }
      if (n > 1) f.push(n);
      return f;
    }
    $("#gcdGo", wrap) && $("#gcdGo", wrap).addEventListener("click", function () {
      var a = num($("#gA", wrap).value), b = num($("#gB", wrap).value);
      if (a === null || b === null || a < 1 || b < 1) { out(outEl, '<span class="rt-warn">دو عدد درست بده (بزرگ‌تر از صفر).</span>'); return; }
      a = Math.round(a); b = Math.round(b);
      var g = gcd(a, b), l = (a * b) / g;
      var fa2 = {}; factor(a).forEach(function (x) { fa2[x] = (fa2[x] || 0) + 1; });
      var fb = {}; factor(b).forEach(function (x) { fb[x] = (fb[x] || 0) + 1; });
      function show(m) { return Object.keys(m).map(function (k) { return fa(k) + (m[k] > 1 ? "^" + fa(m[k]) : ""); }).join(" × "); }
      out(outEl,
        '<div class="rt-kv"><dt>ب.م.م</dt><dd class="rt-ok">' + fa(g) + "</dd>" +
        "<dt>ک.م.م</dt><dd class='rt-ok'>" + fa(l) + "</dd></div>" +
        "<ol class='rt-steps'><li>" + fa(a) + " = " + show(fa2) + "</li><li>" + fa(b) + " = " + show(fb) + "</li></ol>");
    });
  }

  /* ═══════════════════ ۶. تبدیل کسر ↔ اعشار ↔ درصد ═══════════════════ */
  function frac() {
    var wrap = $("#tool-frac"); if (!wrap) return;
    var outEl = $("#fracOut", wrap);
    function gcd(a, b) { return b ? gcd(b, a % b) : a; }
    function paint(n, d) {
      if (d === 0) { out(outEl, '<span class="rt-warn">مخرج صفر نمی‌شود.</span>'); return; }
      var g = gcd(Math.abs(n), Math.abs(d)) || 1; var sn = n / g, sd = d / g;
      if (sd < 0) { sn = -sn; sd = -sd; }
      var v = n / d;
      out(outEl, '<div class="rt-kv">' +
        "<dt>ساده‌شده</dt><dd>" + fa(sn) + " / " + fa(sd) + "</dd>" +
        "<dt>اعشار</dt><dd>" + fa(v, 6).replace(/\.?0+$/, "") + "</dd>" +
        "<dt>درصد</dt><dd>" + fa(v * 100, 4).replace(/\.?0+$/, "") + "٪</dd>" +
        "<dt>عدد مخلوط</dt><dd>" + (Math.abs(sn) >= sd ? fa(Math.trunc(sn / sd)) + " و " + fa(Math.abs(sn % sd)) + "/" + fa(sd) : "—") + "</dd></div>");
    }
    $("#fracGo", wrap) && $("#fracGo", wrap).addEventListener("click", function () {
      paint(num($("#frN", wrap).value), num($("#frD", wrap).value));
    });
    $("#fracFromDec", wrap) && $("#fracFromDec", wrap).addEventListener("click", function () {
      var v = num($("#frDec", wrap).value);
      if (v === null) { out(outEl, '<span class="rt-warn">یک عدد اعشاری بنویس.</span>'); return; }
      var s = String(v), dec = (s.split(".")[1] || "").length, d = Math.pow(10, dec);
      paint(Math.round(v * d), d);
    });
  }

  /* ═══════════════════════════ ۷. محاسبهٔ درصد ═══════════════════════════ */
  function percent() {
    var wrap = $("#tool-percent"); if (!wrap) return;
    var outEl = $("#pcOut", wrap);
    $("#pcGo", wrap) && $("#pcGo", wrap).addEventListener("click", function () {
      var a = num($("#pcA", wrap).value), b = num($("#pcB", wrap).value);
      if (a === null || b === null) { out(outEl, '<span class="rt-warn">دو عدد لازم است.</span>'); return; }
      var of = a * b / 100;
      var what = b === 0 ? null : (a / b) * 100;
      var chg = a === 0 ? null : ((b - a) / a) * 100;
      out(outEl, '<div class="rt-kv">' +
        "<dt>" + fa(a) + "٪ از " + fa(b) + "</dt><dd>" + fa(of) + "</dd>" +
        "<dt>" + fa(a) + " چند درصدِ " + fa(b) + " است</dt><dd>" + (what === null ? "—" : fa(what, 4).replace(/\.?0+$/, "") + "٪") + "</dd>" +
        "<dt>تغییر از " + fa(a) + " به " + fa(b) + "</dt><dd>" + (chg === null ? "—" : (chg >= 0 ? "+" : "−") + fa(Math.abs(chg), 2).replace(/\.?0+$/, "") + "٪") + "</dd></div>");
    });
  }

  /* ═══════════════════════ ۸. جدول تناوبی عناصر ═══════════════════════ */
  var ELEMENTS = (
    "1 H هیدروژن 1.008 nm|2 He هلیم 4.003 ng|3 Li لیتیم 6.94 am|4 Be بریلیم 9.012 ae|5 B بور 10.81 ml|" +
    "6 C کربن 12.011 nm|7 N نیتروژن 14.007 nm|8 O اکسیژن 15.999 nm|9 F فلوئور 18.998 hl|10 Ne نئون 20.180 ng|" +
    "11 Na سدیم 22.990 am|12 Mg منیزیم 24.305 ae|13 Al آلومینیم 26.982 pt|14 Si سیلیسیم 28.085 ml|15 P فسفر 30.974 nm|" +
    "16 S گوگرد 32.06 nm|17 Cl کلر 35.45 hl|18 Ar آرگون 39.95 ng|19 K پتاسیم 39.098 am|20 Ca کلسیم 40.078 ae|" +
    "21 Sc اسکاندیم 44.956 tm|22 Ti تیتانیم 47.867 tm|23 V وانادیم 50.942 tm|24 Cr کروم 51.996 tm|25 Mn منگنز 54.938 tm|" +
    "26 Fe آهن 55.845 tm|27 Co کبالت 58.933 tm|28 Ni نیکل 58.693 tm|29 Cu مس 63.546 tm|30 Zn روی 65.38 tm|" +
    "31 Ga گالیم 69.723 pt|32 Ge ژرمانیم 72.630 ml|33 As آرسنیک 74.922 ml|34 Se سلنیم 78.971 nm|35 Br برم 79.904 hl|" +
    "36 Kr کریپتون 83.798 ng|37 Rb روبیدیم 85.468 am|38 Sr استرانسیم 87.62 ae|39 Y ایتریم 88.906 tm|40 Zr زیرکونیم 91.224 tm|" +
    "41 Nb نیوبیم 92.906 tm|42 Mo مولیبدن 95.95 tm|43 Tc تکنسیوم 98 tm|44 Ru روتنیوم 101.07 tm|45 Rh رودیم 102.91 tm|" +
    "46 Pd پالادیم 106.42 tm|47 Ag نقره 107.87 tm|48 Cd کادمیم 112.41 tm|49 In ایندیم 114.82 pt|50 Sn قلع 118.71 pt|" +
    "51 Sb آنتیموان 121.76 ml|52 Te تلوریم 127.60 ml|53 I ید 126.90 hl|54 Xe زنون 131.29 ng|55 Cs سزیم 132.91 am|" +
    "56 Ba باریم 137.33 ae|57 La لانتان 138.91 ln|58 Ce سریم 140.12 ln|59 Pr پرازئودیم 140.91 ln|60 Nd نئودیم 144.24 ln|" +
    "61 Pm پرومتیم 145 ln|62 Sm ساماریم 150.36 ln|63 Eu اروپیم 151.96 ln|64 Gd گادولینیم 157.25 ln|65 Tb تربیوم 158.93 ln|" +
    "66 Dy دیسپروزیم 162.50 ln|67 Ho هولمیم 164.93 ln|68 Er اربیم 167.26 ln|69 Tm تولیم 168.93 ln|70 Yb ایتربیم 173.05 ln|" +
    "71 Lu لوتسیم 174.97 ln|72 Hf هافنیم 178.49 tm|73 Ta تانتالیم 180.95 tm|74 W تنگستن 183.84 tm|75 Re رنیم 186.21 tm|" +
    "76 Os اسمیم 190.23 tm|77 Ir ایریدیم 192.22 tm|78 Pt پلاتین 195.08 tm|79 Au طلا 196.97 tm|80 Hg جیوه 200.59 tm|" +
    "81 Tl تالیم 204.38 pt|82 Pb سرب 207.2 pt|83 Bi بیسموت 208.98 pt|84 Po پولونیم 209 pt|85 At آستاتین 210 hl|" +
    "86 Rn رادون 222 ng|87 Fr فرانسیوم 223 am|88 Ra رادیوم 226 ae|89 Ac اکتینیم 227 an|90 Th توریم 232.04 an|" +
    "91 Pa پروتاکتینیم 231.04 an|92 U اورانیم 238.03 an|93 Np نپتونیوم 237 an|94 Pu پلوتونیم 244 an|95 Am آمریکیم 243 an|" +
    "96 Cm کوریم 247 an|97 Bk برکلیم 247 an|98 Cf کالیفرنیم 251 an|99 Es اینشتینیم 252 an|100 Fm فرمیم 257 an|" +
    "101 Md مندلیفیم 258 an|102 No نوبلیم 259 an|103 Lr لارنسیم 266 an|104 Rf رادرفوردیم 267 tm|105 Db دوبنیم 268 tm|" +
    "106 Sg سیبورگیم 269 tm|107 Bh بوهریوم 270 tm|108 Hs هاسیم 269 tm|109 Mt مایتنریم 278 tm|110 Ds دارمشتادیم 281 tm|" +
    "111 Rg رونتگنیم 282 tm|112 Cn کوپرنیسیم 285 tm|113 Nh نیهونیم 286 pt|114 Fl فلروویم 289 pt|115 Mc مسکوویم 290 pt|" +
    "116 Lv لیورموریم 293 pt|117 Ts تنسیسین 294 hl|118 Og اوگانسون 294 ng"
  ).split("|").map(function (s) {
    var p = s.split(" ");
    return { z: +p[0], sym: p[1], fa: p[2], m: +p[3], c: p[4] };
  });
  var CAT = { am: "فلز قلیایی", ae: "فلز قلیایی خاکی", tm: "فلز واسطه", pt: "فلز پس‌واسطه", ml: "شبه‌فلز", nm: "نافلز", hl: "هالوژن", ng: "گاز نجیب", ln: "لانتانید", an: "اکتینید" };

  function periodic() {
    var wrap = $("#tool-periodic"); if (!wrap) return;
    var host = $("#ptGrid", wrap), outEl = $("#ptOut", wrap);
    /* ردیف‌های استاندارد جدول: هر جفت [جای شروع ستون، عناصر] */
    var LAYOUT = [
      [1, [1, 2]], [2, [3, 4]], [3, [11, 12]]
    ];
    /* روش ساده و مطمئن: مکان هر عنصر را دستی از روی گروه و تناوب می‌گذاریم */
    var POS = {
      1: [1, 1], 2: [1, 18], 3: [2, 1], 4: [2, 2], 5: [2, 13], 6: [2, 14], 7: [2, 15], 8: [2, 16], 9: [2, 17], 10: [2, 18],
      11: [3, 1], 12: [3, 2], 13: [3, 13], 14: [3, 14], 15: [3, 15], 16: [3, 16], 17: [3, 17], 18: [3, 18],
      19: [4, 1], 20: [4, 2], 21: [4, 3], 22: [4, 4], 23: [4, 5], 24: [4, 6], 25: [4, 7], 26: [4, 8], 27: [4, 9], 28: [4, 10], 29: [4, 11], 30: [4, 12], 31: [4, 13], 32: [4, 14], 33: [4, 15], 34: [4, 16], 35: [4, 17], 36: [4, 18],
      37: [5, 1], 38: [5, 2], 39: [5, 3], 40: [5, 4], 41: [5, 5], 42: [5, 6], 43: [5, 7], 44: [5, 8], 45: [5, 9], 46: [5, 10], 47: [5, 11], 48: [5, 12], 49: [5, 13], 50: [5, 14], 51: [5, 15], 52: [5, 16], 53: [5, 17], 54: [5, 18],
      55: [6, 1], 56: [6, 2], 72: [6, 4], 73: [6, 5], 74: [6, 6], 75: [6, 7], 76: [6, 8], 77: [6, 9], 78: [6, 10], 79: [6, 11], 80: [6, 12], 81: [6, 13], 82: [6, 14], 83: [6, 15], 84: [6, 16], 85: [6, 17], 86: [6, 18],
      87: [7, 1], 88: [7, 2], 104: [7, 4], 105: [7, 5], 106: [7, 6], 107: [7, 7], 108: [7, 8], 109: [7, 9], 110: [7, 10], 111: [7, 11], 112: [7, 12], 113: [7, 13], 114: [7, 14], 115: [7, 15], 116: [7, 16], 117: [7, 17], 118: [7, 18]
    };
    /* لانتانیدها و اکتینیدها در دو ردیف جدا زیر جدول */
    var LANTH = [57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71];
    var ACT = [89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103];
    var byZ = {}; ELEMENTS.forEach(function (e) { byZ[e.z] = e; });

    function cell(e) {
      var b = D.createElement("button");
      b.type = "button";
      b.className = "rt-el c-" + e.c;
      b.setAttribute("data-z", e.z);
      b.innerHTML = "<small>" + fa(e.z) + "</small>" + e.sym;
      b.title = e.fa + " — " + CAT[e.c];
      return b;
    }
    if (host) {
      host.innerHTML = "";
      var grid = [];
      Object.keys(POS).forEach(function (z) { var p = POS[z]; grid.push({ z: +z, r: p[0], c: p[1] }); });
      LANTH.forEach(function (z, i) { grid.push({ z: z, r: 9, c: i + 3 }); });
      ACT.forEach(function (z, i) { grid.push({ z: z, r: 10, c: i + 3 }); });
      grid.sort(function (a, b) { return a.r - b.r || a.c - b.c; });
      grid.forEach(function (g) {
        if (!byZ[g.z]) return;
        var el = cell(byZ[g.z]);
        el.style.gridRow = g.r;
        el.style.gridColumn = g.c;
        host.appendChild(el);
      });
      host.addEventListener("click", function (ev) {
        var b = ev.target.closest(".rt-el"); if (!b) return;
        $$(".rt-el.on", host).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        var e = byZ[+b.getAttribute("data-z")];
        if (!e || !outEl) return;
        out(outEl, '<div class="rt-kv">' +
          "<dt>نام</dt><dd>" + e.fa + "</dd>" +
          "<dt>نماد</dt><dd>" + e.sym + "</dd>" +
          "<dt>عدد اتمی</dt><dd>" + fa(e.z) + "</dd>" +
          "<dt>جرم اتمی</dt><dd>" + fa(e.m) + " u</dd>" +
          "<dt>دسته</dt><dd>" + CAT[e.c] + "</dd></div>");
      });
    }
    var search = $("#ptSearch", wrap);
    search && search.addEventListener("input", function () {
      var q = search.value.trim().toLowerCase();
      $$(".rt-el", host).forEach(function (b) {
        var e = byZ[+b.getAttribute("data-z")];
        var hit = !q || e.sym.toLowerCase().indexOf(q) > -1 || e.fa.indexOf(q) > -1 || String(e.z) === q;
        b.style.opacity = hit ? "" : ".18";
      });
    });
    var legend = $("#ptLegend", wrap);
    if (legend) legend.innerHTML = Object.keys(CAT).map(function (k) {
      return '<span><i class="c-' + k + '" style="background:var(--r8-glass-bg)"></i>' + CAT[k] + "</span>";
    }).join("");
  }

  /* ═══════════════════════════ ۹. مبدل واحدها ═══════════════════════════ */
  function units() {
    var wrap = $("#tool-units"); if (!wrap) return;
    var outEl = $("#unOut", wrap);
    var TABLES = {
      طول: { متر: 1, کیلومتر: 1000, سانتی‌متر: 0.01, میلی‌متر: 0.001, مایل: 1609.344, اینچ: 0.0254, فوت: 0.3048, یارد: 0.9144 },
      جرم: { کیلوگرم: 1, گرم: 0.001, میلی‌گرم: 1e-6, تن: 1000, پوند: 0.45359237, اونس: 0.028349523125 },
      حجم: { لیتر: 1, میلی‌لیتر: 0.001, مترمکعب: 1000, گالن: 3.785411784, "سانتی‌مترمکعب": 0.001 },
      زمان: { ثانیه: 1, دقیقه: 60, ساعت: 3600, روز: 86400, هفته: 604800 },
      انرژی: { ژول: 1, کیلوژول: 1000, کالری: 4.184, "کیلوکالری": 4184, "وات‌ساعت": 3600 }
    };
    function fill(kind) {
      var s1 = $("#unFrom", wrap), s2 = $("#unTo", wrap), t = TABLES[kind] || {};
      var opts = Object.keys(t).map(function (k) { return '<option value="' + k + '">' + k + "</option>"; }).join("");
      s1.innerHTML = opts; s2.innerHTML = opts;
      s2.selectedIndex = Math.min(1, s2.options.length - 1);
    }
    var kindSel = $("#unKind", wrap);
    kindSel && kindSel.addEventListener("change", function () { fill(kindSel.value); });
    if (kindSel) fill(kindSel.value);
    $("#unGo", wrap) && $("#unGo", wrap).addEventListener("click", function () {
      var kind = kindSel.value, t = TABLES[kind];
      var v = num($("#unVal", wrap).value);
      if (v === null) { out(outEl, '<span class="rt-warn">یک عدد بنویس.</span>'); return; }
      var f = $("#unFrom", wrap).value, to = $("#unTo", wrap).value;
      var r = v * t[f] / t[to];
      out(outEl, '<div class="rt-big">' + fa(r, 6).replace(/\.?0+$/, "") + " " + to + "</div>" +
        '<div style="font-size:.82rem;color:var(--muted)">' + fa(v) + " " + f + " = " + fa(r) + " " + to + "</div>");
    });
    /* دما جداست چون تبدیلش خطیِ ساده نیست */
    $("#unTemp", wrap) && $("#unTemp", wrap).addEventListener("click", function () {
      var v = num($("#unTv", wrap).value);
      if (v === null) { out(outEl, '<span class="rt-warn">دما را بنویس.</span>'); return; }
      var from = $("#unTf", wrap).value, r;
      var c = from === "C" ? v : from === "F" ? (v - 32) * 5 / 9 : v - 273.15;
      r = [c, c * 9 / 5 + 32, c + 273.15];
      out(outEl, '<div class="rt-kv"><dt>سلسیوس</dt><dd>' + fa(r[0], 2) + "°</dd><dt>فارنهایت</dt><dd>" + fa(r[1], 2) + "°</dd><dt>کلوین</dt><dd>" + fa(r[2], 2) + " K</dd></div>");
    });
  }

  /* ═══════════════ ۱۰. محاسبه‌گر فیزیک: چگالی، سرعت، نیرو، فشار ═══════════════ */
  function physics() {
    var wrap = $("#tool-physics"); if (!wrap) return;
    var outEl = $("#phOut", wrap);
    $("#phGo", wrap) && $("#phGo", wrap).addEventListener("click", function () {
      var f = $("#phForm", wrap).value;
      var a = num($("#phA", wrap).value), b = num($("#phB", wrap).value);
      if (a === null || b === null) { out(outEl, '<span class="rt-warn">هر دو مقدار را بنویس.</span>'); return; }
      var r = null, unit = "", name = "";
      if (f === "density") { r = a / b; name = "چگالی (ρ = m ÷ V)"; unit = "g/cm³ یا kg/m³"; }
      if (f === "speed") { r = a / b; name = "سرعت (v = d ÷ t)"; unit = "m/s یا km/h"; }
      if (f === "force") { r = a * b; name = "نیرو (F = m × a)"; unit = "نیوتن (N)"; }
      if (f === "pressure") { r = a / b; name = "فشار (P = F ÷ A)"; unit = "پاسکال (Pa)"; }
      if (f === "work") { r = a * b; name = "کار (W = F × d)"; unit = "ژول (J)"; }
      out(outEl, "<b>" + name + "</b><div class='rt-big'>" + fa(r, 4).replace(/\.?0+$/, "") + "</div>" +
        '<div style="font-size:.8rem;color:var(--muted)">یکا: ' + unit + "</div>");
    });
  }

  /* ═══════════════════════ ۱۱. برنامه‌ریز هفتگی ═══════════════════════ */
  function planner() {
    var wrap = $("#tool-planner"); if (!wrap) return;
    var outEl = $("#plOut", wrap);
    var DAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"];
    function build() {
      var subs = ($("#plSubs", wrap).value || "").split(/[,،\n]/).map(function (s) { return s.trim(); }).filter(Boolean);
      var perDay = num($("#plHours", wrap).value) || 2;
      if (!subs.length) { out(outEl, '<span class="rt-warn">نام درس‌ها را بنویس (با ویرگول جدا کن).</span>'); return; }
      var html = "<table class='rt-table'><thead><tr><th>روز</th><th>درس‌ها</th><th>مجموع</th></tr></thead><tbody>";
      var i = 0;
      DAYS.forEach(function (d) {
        var names = [], mins = 0;
        var n = Math.max(1, Math.min(3, Math.round(perDay / 1)));
        for (var k = 0; k < n; k++) { names.push(subs[i % subs.length]); i++; }
        names = names.filter(function (v, ix, s) { return s.indexOf(v) === ix; });
        var each = Math.round((perDay * 60) / names.length / 5) * 5;
        html += "<tr><th>" + d + "</th><td>" + names.map(function (x) { return x + " (" + fa(each) + " دقیقه)"; }).join(" + ") + "</td><td>" + fa(Math.round(each * names.length)) + " دقیقه</td></tr>";
      });
      html += "</tbody></table>";
      var week = Math.round(perDay * 60) * 7;
      html += "<div style='margin-top:10px'>مجموع هفته: <b>" + fa(Math.round(week / 60)) + "</b> ساعت · روزی " + fa(Math.round(perDay * 60)) + " دقیقه</div>";
      out(outEl, html);
      LS.set("plan", { subs: subs, perDay: perDay });
    }
    var saved = LS.get("plan", null);
    if (saved) { $("#plSubs", wrap).value = (saved.subs || []).join("، "); $("#plHours", wrap).value = saved.perDay; }
    $("#plGo", wrap) && $("#plGo", wrap).addEventListener("click", build);
    $("#plClear", wrap) && $("#plClear", wrap).addEventListener("click", function () { out(outEl, ""); LS.set("plan", null); });
  }

  /* ═══════════════════════ ۱۲. پیگیری عادت روزانه ═══════════════════════ */
  function habits() {
    var wrap = $("#tool-habits"); if (!wrap) return;
    var host = $("#hbList", wrap);
    var DAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
    var data = LS.get("habits", null) || [
      { t: "مطالعهٔ روزانه", d: [0, 0, 0, 0, 0, 0, 0] },
      { t: "حل تمرین", d: [0, 0, 0, 0, 0, 0, 0] },
      { t: "مرور فلش‌کارت", d: [0, 0, 0, 0, 0, 0, 0] }
    ];
    function save() { LS.set("habits", data); }
    function paint() {
      if (!host) return;
      host.innerHTML = data.map(function (h, hi) {
        return '<div style="margin-bottom:10px"><div style="font-weight:800;font-size:.86rem;margin-bottom:5px">' + h.t + "</div>" +
          '<div class="rt-hab">' + h.d.map(function (v, di) {
            return '<button type="button" class="' + (v ? "on" : "") + '" data-h="' + hi + '" data-d="' + di + '" title="' + DAYS[di] + '">' + DAYS[di] + "</button>";
          }).join("") + "</div></div>";
      }).join("") +
        '<div style="margin-top:4px;font-size:.84rem">مجموع نشان‌ها این هفته: <b>' +
        fa(data.reduce(function (s, h) { return s + h.d.filter(Boolean).length; }, 0)) + "</b> از " + fa(data.length * 7) + "</div>";
    }
    host && host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-h]"); if (!b) return;
      var hi = +b.getAttribute("data-h"), di = +b.getAttribute("data-d");
      data[hi].d[di] = data[hi].d[di] ? 0 : 1;
      save(); paint();
    });
    $("#hbAdd", wrap) && $("#hbAdd", wrap).addEventListener("click", function () {
      var t = ($("#hbNew", wrap).value || "").trim();
      if (!t) { toast("نام عادت را بنویس"); return; }
      data.push({ t: t, d: [0, 0, 0, 0, 0, 0, 0] });
      $("#hbNew", wrap).value = ""; save(); paint();
    });
    $("#hbReset", wrap) && $("#hbReset", wrap).addEventListener("click", function () {
      data.forEach(function (h) { h.d = [0, 0, 0, 0, 0, 0, 0]; }); save(); paint();
    });
    paint();
  }

  /* ═══════════════════════════ ۱۳. واژه‌نامهٔ شخصی ═══════════════════════════ */
  function vocab() {
    var wrap = $("#tool-vocab"); if (!wrap) return;
    var host = $("#voList", wrap), outEl = $("#voOut", wrap);
    var data = LS.get("vocab", null) || [];
    function save() { LS.set("vocab", data); }
    function paint() {
      if (!host) return;
      if (!data.length) { host.innerHTML = '<p style="font-size:.85rem;color:var(--muted)">هنوز واژه‌ای اضافه نکرده‌ای.</p>'; return; }
      host.innerHTML = "<ul class='rt-voc'>" + data.map(function (v, i) {
        return "<li><b>" + v.w + "</b><span> — " + v.m + '</span><button type="button" data-del="' + i + '" title="حذف">✕</button></li>';
      }).join("") + "</ul>";
    }
    host && host.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-del]"); if (!b) return;
      data.splice(+b.getAttribute("data-del"), 1); save(); paint();
    });
    $("#voAdd", wrap) && $("#voAdd", wrap).addEventListener("click", function () {
      var w = ($("#voW", wrap).value || "").trim(), m = ($("#voM", wrap).value || "").trim();
      if (!w || !m) { toast("واژه و معنی را بنویس"); return; }
      data.push({ w: w, m: m });
      $("#voW", wrap).value = ""; $("#voM", wrap).value = "";
      save(); paint();
    });
    $("#voQuiz", wrap) && $("#voQuiz", wrap).addEventListener("click", function () {
      if (data.length < 1) { out(outEl, '<span class="rt-warn">اول چند واژه اضافه کن.</span>'); return; }
      var q = data[Math.floor(Math.random() * data.length)];
      var opts = [q.m];
      while (opts.length < 4 && data.length > 1) {
        var r = data[Math.floor(Math.random() * data.length)].m;
        if (opts.indexOf(r) < 0) opts.push(r);
      }
      opts.sort(function () { return Math.random() - 0.5; });
      out(outEl, "<b>معنی «" + q.w + "» چیست؟</b>" +
        opts.map(function (o) { return '<div><button type="button" class="rt-btn ' + (o === q.m ? "ok" : "") + '" style="margin-top:6px" data-ans="' + (o === q.m ? "1" : "0") + '">' + o + "</button></div>"; }).join(""));
    });
    outEl && outEl.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-ans]"); if (!b) return;
      toast(b.getAttribute("data-ans") === "1" ? "درست بود ✅" : "نه، جواب درست را ببین");
      out(outEl, b.getAttribute("data-ans") === "1" ? '<span class="rt-ok">آفرین! درست بود ✅</span>' : '<span class="rt-warn">اشکالی ندارد — دوباره تلاش کن</span>');
    });
    paint();
  }

  /* ═══════════════════ ۱۴. فلش‌کارت‌ساز سریع ═══════════════════ */
  function flashmake() {
    var wrap = $("#tool-flashmake"); if (!wrap) return;
    var outEl = $("#fmOut", wrap);
    $("#fmGo", wrap) && $("#fmGo", wrap).addEventListener("click", function () {
      var lines = ($("#fmText", wrap).value || "").split(/\n/).map(function (l) { return l.trim(); }).filter(Boolean);
      var cards = [];
      lines.forEach(function (l) {
        var p = l.split(/\s*[|،؛]\s*|\s*[-–—]\s*/);
        if (p.length >= 2 && p[0] && p[1]) cards.push({ q: p[0].trim(), a: p.slice(1).join(" ").trim() });
      });
      if (!cards.length) { out(outEl, '<span class="rt-warn">هر خط را به شکل «سؤال | جواب» بنویس.</span>'); return; }
      LS.set("madeCards", cards);
      localStorage.setItem("g8:fcExtra", JSON.stringify(cards));
      out(outEl, "<b>" + fa(cards.length) + " فلش‌کارت ساخته شد ✅</b>" +
        "<ol class='rt-steps'>" + cards.slice(0, 8).map(function (c) { return "<li>" + c.q + " → <b>" + c.a + "</b></li>"; }).join("") + "</ol>" +
        '<div class="rt-btns"><a class="rt-btn primary" href="flashcards.html">تمرین با فلش‌کارت‌ها</a></div>');
    });
    $("#fmLoad", wrap) && $("#fmLoad", wrap).addEventListener("click", function () {
      var c = LS.get("madeCards", []);
      if (!c.length) { out(outEl, '<span class="rt-warn">هنوز کارتی نساخته‌ای.</span>'); return; }
      $("#fmText", wrap).value = c.map(function (x) { return x.q + " | " + x.a; }).join("\n");
      toast("کارت‌های ذخیره‌شده بارگذاری شد");
    });
  }

  /* ═══════════════════════════ ۱۵. یادداشت سریع ═══════════════════════════ */
  function notes() {
    var wrap = $("#tool-notes"); if (!wrap) return;
    var ta = $("#ntText", wrap), st = $("#ntStatus", wrap);
    if (!ta) return;
    ta.value = LS.get("note", "");
    var t = null;
    function save() {
      LS.set("note", ta.value);
      if (st) st.textContent = "ذخیره شد · " + new Date().toLocaleTimeString("fa-IR");
    }
    ta.addEventListener("input", function () { if (t) clearTimeout(t); t = setTimeout(save, 600); });
    $("#ntSave", wrap) && $("#ntSave", wrap).addEventListener("click", function () { save(); toast("یادداشت ذخیره شد"); });
    $("#ntCopy", wrap) && $("#ntCopy", wrap).addEventListener("click", function () {
      try { navigator.clipboard.writeText(ta.value); toast("در حافظه کپی شد"); } catch (e) { toast("کپی نشد — دستی انتخاب کن"); }
    });
    $("#ntDl", wrap) && $("#ntDl", wrap).addEventListener("click", function () {
      var b = new Blob([ta.value], { type: "text/plain;charset=utf-8" });
      var a = D.createElement("a"); a.href = URL.createObjectURL(b); a.download = "yaddasht-rahnama.txt";
      D.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1200);
    });
    $("#ntClear", wrap) && $("#ntClear", wrap).addEventListener("click", function () {
      if (!confirm("یادداشت پاک شود؟")) return;
      ta.value = ""; save(); toast("پاک شد");
    });
  }

  /* ═══════════════════════════ ۱۶. محاسبهٔ معدل ═══════════════════════════ */
  function average() {
    var wrap = $("#tool-average"); if (!wrap) return;
    var outEl = $("#avOut", wrap);
    function row() {
      return '<div class="rt-row" style="margin-bottom:6px">' +
        '<div class="rt-f"><input class="rt-in" type="number" step="0.25" placeholder="نمره" data-av-s></div>' +
        '<div class="rt-f"><input class="rt-in" type="number" step="1" placeholder="ضریب" data-av-w value="1"></div>' +
        "</div>";
    }
    var box = $("#avRows", wrap);
    if (box) { box.innerHTML = row() + row() + row() + row(); }
    $("#avAdd", wrap) && $("#avAdd", wrap).addEventListener("click", function () { if (box) box.insertAdjacentHTML("beforeend", row()); });
    $("#avGo", wrap) && $("#avGo", wrap).addEventListener("click", function () {
      var ss = $$("[data-av-s]", box), ws = $$("[data-av-w]", box);
      var sum = 0, wsum = 0, n = 0;
      ss.forEach(function (s, i) {
        var v = num(s.value); if (v === null) return;
        var w = num(ws[i] && ws[i].value) || 1;
        sum += v * w; wsum += w; n++;
      });
      if (!n) { out(outEl, '<span class="rt-warn">حداقل یک نمره بنویس.</span>'); return; }
      var avg = sum / wsum;
      var word = avg >= 17 ? "عالی" : avg >= 14 ? "خوب" : avg >= 10 ? "قابل قبول" : "نیاز به تلاش";
      out(outEl, '<div class="rt-big">' + fa(avg, 2) + "</div>" +
        "<div>معدل وزنی از " + fa(n) + " نمره — <b>" + word + "</b></div>" +
        '<div style="font-size:.8rem;color:var(--muted)">مجموع (نمره×ضریب) = ' + fa(sum, 2) + " · مجموع ضریب‌ها = " + fa(wsum) + "</div>");
    });
  }

  /* ═════════════════ ۱۷. شمارشگر متن و زمان مطالعه ═════════════════ */
  function counter() {
    var wrap = $("#tool-counter"); if (!wrap) return;
    var ta = $("#cnText", wrap), outEl = $("#cnOut", wrap);
    function run() {
      var s = ta.value || "";
      var words = s.trim() ? s.trim().split(/\s+/).length : 0;
      var chars = s.length;
      var sentences = (s.match(/[.!?؟!…]/g) || []).length;
      var mins = words / 200;   // سرعت متوسط مطالعهٔ فارسی
      out(outEl, '<div class="rt-kv">' +
        "<dt>واژه</dt><dd>" + fa(words) + "</dd>" +
        "<dt>نویسه</dt><dd>" + fa(chars) + "</dd>" +
        "<dt>جمله</dt><dd>" + fa(sentences) + "</dd>" +
        "<dt>زمان تقریبی مطالعه</dt><dd>" + (mins < 1 ? "زیر یک دقیقه" : fa(Math.ceil(mins)) + " دقیقه") + "</dd></div>");
    }
    ta && ta.addEventListener("input", run);
    run();
  }

  /* ═══════════════ ۱۸. متن‌خوان فارسی (بلندخوانی) ═══════════════ */
  function tts() {
    var wrap = $("#tool-tts"); if (!wrap) return;
    var ta = $("#ttText", wrap), outEl = $("#ttOut", wrap);
    if (!("speechSynthesis" in W)) { out(outEl, '<span class="rt-warn">مرورگر تو از بلندخوانی پشتیبانی نمی‌کند.</span>'); return; }
    var u = null;
    function pick() {
      var vs = W.speechSynthesis.getVoices() || [];
      for (var i = 0; i < vs.length; i++) if (/fa|persian|iran/i.test(vs[i].lang + " " + vs[i].name)) return vs[i];
      return null;
    }
    function speak() {
      stop();
      var txt = (ta.value || "").trim();
      if (!txt) { out(outEl, '<span class="rt-warn">متنی برای خواندن نیست.</span>'); return; }
      var v = pick();
      /* صدای فارسی اگر نصب نباشد، خواندنِ متن فارسی با صدای بیگانه
         کیفیت خوبی ندارد. بهتر است صادق باشیم و راه‌حل بدهیم. */
      if (!v) {
        out(outEl, '<span class="rt-warn">روی این دستگاه صدای فارسی نصب نیست.</span><br>' +
          "بلندخوانی فارسی به بستهٔ صدای فارسی نیاز دارد. در ویندوز از " +
          "<b>تنظیمات ← زمان و زبان ← زبان و منطقه</b> زبان فارسی را اضافه کن " +
          "(گزینهٔ گفتار/Speech) و صفحه را تازه کن.<br>" +
          "برای خواندن فوری بدون نصب صدا، همان متن را در «دستیار هوشمند» بپرس یا از حالت تمرکز استفاده کن.");
        return;
      }
      u = new SpeechSynthesisUtterance(txt.slice(0, 4000));
      u.lang = v.lang;
      u.voice = v;
      u.rate = Math.max(0.5, Math.min(2, num($("#ttRate", wrap).value) || 1));
      u.onend = function () { out(outEl, '<span class="rt-ok">خواندن تمام شد ✅</span>'); };
      W.speechSynthesis.speak(u);
      out(outEl, "در حال خواندن با صدای «" + v.name + "» …");
    }
    function stop() { try { W.speechSynthesis.cancel(); } catch (e) { } }
    $("#ttGo", wrap) && $("#ttGo", wrap).addEventListener("click", speak);
    $("#ttStop", wrap) && $("#ttStop", wrap).addEventListener("click", function () { stop(); out(outEl, "متوقف شد"); });
    if (W.speechSynthesis.onvoiceschanged !== undefined) W.speechSynthesis.onvoiceschanged = function () { };
  }

  /* ═══════════════ ۱۹. حالت تمرکز تمام‌صفحه + آمبیانس ═══════════════ */
  function focusMode() {
    var wrap = $("#tool-focus"); if (!wrap) return;
    var ov = null, ac = null, noise = null, iv = null, sec = 0;
    function ambience(on) {
      try {
        if (on) {
          var AC = W.AudioContext || W.webkitAudioContext; if (!AC) return;
          ac = new AC();
          var buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
          var d = buf.getChannelData(0);
          for (var i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * 0.28;
          noise = ac.createBufferSource(); noise.buffer = buf; noise.loop = true;
          var f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 620;
          var g = ac.createGain(); g.gain.value = 0.16;
          noise.connect(f); f.connect(g); g.connect(ac.destination); noise.start();
        } else {
          try { noise && noise.stop(); } catch (e) { }
          try { ac && ac.close(); } catch (e) { }
          noise = ac = null;
        }
      } catch (e) { }
    }
    function close() {
      if (iv) clearInterval(iv); iv = null;
      ambience(false);
      if (ov) { ov.remove(); ov = null; }
      D.body.classList.remove("rt-focusing");
      try { D.title = "رهنما"; } catch (e) { }
    }
    $("#foGo", wrap) && $("#foGo", wrap).addEventListener("click", function () {
      close();
      var mins = num($("#foMin", wrap).value) || 25;
      sec = mins * 60;
      ov = D.createElement("div");
      ov.className = "rt-focus-overlay";
      ov.innerHTML = '<div style="font-size:.95rem;opacity:.8">حالت تمرکز — ' + fa(mins) + ' دقیقه</div>' +
        '<div class="rt-clock" id="foClock">' + fa(mins) + ":۰۰</div>" +
        '<div class="rt-pills"><span class="rt-pill">صدا: ' + ($("#foNoise", wrap) && $("#foNoise", wrap).checked ? "روشن" : "خاموش") + "</span></div>" +
        '<div class="rt-btns"><button type="button" class="rt-btn" id="foStop">خروج از تمرکز</button></div>';
      /* لایه را به <html> می‌چسبانیم، نه <body>.
         اگر body هر transform یا فیلتری داشته باشد (و در این سایت
         هنگام گذار بین صفحه‌ها داشت) «حاویِ عناصر شناور» می‌شود و
         position:fixed به‌جای پنجره، نسبت به body جا می‌گیرد و لایه
         بیرون از دید می‌افتد. چسباندن به html این خطر را صفر می‌کند. */
      (D.documentElement || D.body).appendChild(ov);
      ov.style.inset = "0";
      D.body.classList.add("rt-focusing");
      if ($("#foNoise", wrap) && $("#foNoise", wrap).checked) ambience(true);
      function tick() {
        sec--;
        if (sec < 0) { close(); toast("جلسهٔ تمرکز تمام شد ✅"); return; }
        var c = $("#foClock"); if (c) c.textContent = fa(Math.floor(sec / 60)) + ":" + ("0" + fa(sec % 60)).slice(-2);
        try { D.title = fa(Math.floor(sec / 60)) + ":" + ("0" + fa(sec % 60)).slice(-2) + " — تمرکز"; } catch (e) { }
      }
      iv = setInterval(tick, 1000);
      $("#foStop") && $("#foStop").addEventListener("click", function () { close(); toast("از تمرکز خارج شدی"); });
      ov.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
    });
  }

  /* ═══════════════════ ۲۰. تبدیل تاریخ شمسی ↔ میلادی ═══════════════════ */
  function dates() {
    var wrap = $("#tool-date"); if (!wrap) return;
    var outEl = $("#dtOut", wrap);
    function toJalali(gy, gm, gd) {
      var g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
      var jy = gy <= 1600 ? 0 : 979;
      gy -= gy <= 1600 ? 621 : 1600;
      var gy2 = gm > 2 ? gy + 1 : gy;
      var days = 365 * gy + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
      jy += 33 * Math.floor(days / 12053); days %= 12053;
      jy += 4 * Math.floor(days / 1461); days %= 1461;
      if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
      var jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
      return [jy, jm, jd];
    }
    function toGregorian(jy, jm, jd) {
      var gy = jy <= 979 ? 621 : 1600;
      jy -= jy <= 979 ? 0 : 979;
      var days = 365 * jy + Math.floor(jy / 33) * 8 + Math.floor(((jy % 33) + 3) / 4) + 78 + jd + (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
      gy += 400 * Math.floor(days / 146097); days %= 146097;
      if (days > 36524) { gy += 100 * Math.floor(--days / 36524); days %= 36524; if (days >= 365) days++; }
      gy += 4 * Math.floor(days / 1461); days %= 1461;
      if (days > 365) { gy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
      var gd = days + 1;
      var sal_a = [0, 31, (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
      var gm = 0;
      for (gm = 0; gm < 13; gm++) { if (gd <= sal_a[gm]) break; gd -= sal_a[gm]; }
      return [gy, gm, gd];
    }
    $("#dtJ2G", wrap) && $("#dtJ2G", wrap).addEventListener("click", function () {
      var y = num($("#dtY", wrap).value), m = num($("#dtM", wrap).value), d = num($("#dtD", wrap).value);
      if (!y || !m || !d) { out(outEl, '<span class="rt-warn">سال، ماه و روز را بنویس.</span>'); return; }
      var g = toGregorian(y, m, d);
      var names = ["ژانویه", "فوریه", "مارس", "آپریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"];
      out(outEl, '<div class="rt-big">' + fa(g[2]) + " " + names[g[1] - 1] + " " + fa(g[0]) + "</div>" +
        "<div>" + g[0] + "-" + ("0" + g[1]).slice(-2) + "-" + ("0" + g[2]).slice(-2) + " (میلادی)</div>");
    });
    $("#dtG2J", wrap) && $("#dtG2J", wrap).addEventListener("click", function () {
      var y = num($("#dtYg", wrap).value), m = num($("#dtMg", wrap).value), d = num($("#dtDg", wrap).value);
      if (!y || !m || !d) { out(outEl, '<span class="rt-warn">سال، ماه و روز میلادی را بنویس.</span>'); return; }
      var j = toJalali(y, m, d);
      var names = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
      out(outEl, '<div class="rt-big">' + fa(j[2]) + " " + names[j[1] - 1] + " " + fa(j[0]) + "</div>" +
        "<div>" + j[0] + "/" + ("0" + j[1]).slice(-2) + "/" + ("0" + j[2]).slice(-2) + " (شمسی)</div>");
    });
    $("#dtToday", wrap) && $("#dtToday", wrap).addEventListener("click", function () {
      var n = new Date(), j = toJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
      out(outEl, "امروز: <b>" + fa(j[0]) + "/" + fa(j[1]) + "/" + fa(j[2]) + "</b> شمسی");
    });
  }

  /* ══════════════════════════════ راه‌اندازی ══════════════════════════════ */
  function boot() {
    var jobs = [pomodoro, stopwatch, calc, quadratic, gcdlcm, frac, percent, periodic, units,
      physics, planner, habits, vocab, flashmake, notes, average, counter, tts, focusMode, dates];
    jobs.forEach(function (fn) { try { fn(); } catch (e) { } });
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
  W.R9TOOLS = { boot: boot, elements: ELEMENTS };
})();
