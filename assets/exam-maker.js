/* ==========================================================================
   رهنما — آزمون‌ساز هوشمند (exam-maker.js)
   --------------------------------------------------------------------------
   از بانک ۴۱۴۹ سؤالی که از دل جزوه‌ها ساخته شده، آزمون دلخواه می‌سازد:
     گام ۱: پایه و کتاب‌ها   گام ۲: درس‌ها (یا همه)   گام ۳: تعداد، زمان، حالت
   سپس اجرای آزمون با زمان‌سنج، شبکهٔ پرش بین سؤال‌ها، تصحیح فوری،
   مرور پاسخ‌ها با توضیح، «تکرار سؤال‌های غلط» و تاریخچهٔ نتیجه‌ها.
   همه چیز روی دستگاه خودِ کاربر ذخیره می‌شود.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function fa(n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }
  function norm(s) {
    return String(s || "").toLowerCase().replace(/[\u064B-\u0652\u0670\u200c\u200e\u200f]/g, "")
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  }
  var LS = {
    get: function (k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  function toast(m, bad) { if (W.R14 && W.R14.toast) W.R14.toast(m, bad); }

  var POOL = [];          /* سؤال‌های بانک برای پایه‌های انتخاب‌شده */
  var SEL_BOOKS = {};     /* "g/s" → true */
  var SEL_LESSONS = {};   /* "g/s/id" → true */
  var OPEN_LESSONS = {};  /* کتابی که فهرست درسش باز است */
  var EXAM = null, TIMER = null;
  var HIST_KEY = "xm:history";
  var SEEN_KEY = "xm:seen";     /* "g/s/id#index" → {ok:true} برای «فقط سؤال‌های نزده» */

  /* ── بارگذاری بانک سؤال فقط برای پایه‌های لازم ── */
  var loaded = {};
  function loadBank(g) {
    if (loaded[g]) return Promise.resolve(loaded[g]);
    return fetch("assets/quiz-g" + g + ".json", { cache: "force-cache" })
      .then(function (r) { if (!r.ok) throw new Error("بانک سؤال پایهٔ " + g + " خوانده نشد."); return r.json(); })
      .then(function (j) { loaded[g] = j; return j; });
  }

  /* ── گام ۱: پایه و کتاب ── */
  function gradeSelect() {
    var box = $("#xmGrades");
    box.innerHTML = ["7", "8", "9"].map(function (g) {
      return '<button type="button" class="xm-pick" data-xg="' + g + '" aria-pressed="true"><i>📘</i><b>پایهٔ ' +
        (g === "7" ? "هفتم" : g === "8" ? "هشتم" : "نهم") + "</b></button>";
    }).join("");
  }
  function activeGrades() { return $$("[data-xg]").filter(function (b) { return b.getAttribute("aria-pressed") === "true"; }).map(function (b) { return b.getAttribute("data-xg"); }); }

  function paintBooks() {
    var box = $("#xmBooks");
    var gs = activeGrades();
    if (!gs.length) { box.innerHTML = '<div class="xm-empty">حداقل یک پایه را انتخاب کن</div>'; return; }
    box.innerHTML = '<div class="xm-sk r13-sk"></div>';
    Promise.all(gs.map(loadBank)).then(function (banks) {
      var html = "";
      banks.forEach(function (j) {
        j.books.forEach(function (b) {
          var key = j.g + "/" + b.s;
          var n = b.lessons.reduce(function (a, x) { return a + x.q.length; }, 0);
          html += '<button type="button" class="xm-pick" data-xb="' + key + '" aria-pressed="' + (SEL_BOOKS[key] ? "true" : "false") + '">' +
            "<b>" + esc(b.subject) + "</b><small>" + fa(n) + " سؤال</small></button>";
        });
      });
      box.innerHTML = '<div class="xm-grid">' + html + "</div>" +
        '<div class="xm-bar-actions"><button type="button" class="xm-go ghost" data-xall>همهٔ کتاب‌های این پایه‌ها</button>' +
        '<button type="button" class="xm-go ghost" data-xnone>پاک‌کردن انتخاب</button>' +
        '<span class="xm-hint">می‌توانی چند کتاب را با هم انتخاب کنی.</span></div>';
      paintLessons();
    }).catch(function (e) {
      box.innerHTML = '<div class="xm-empty"><i>⚠️</i>' + esc(e.message) + "</div>";
    });
  }

  /* ── گام ۲: درس‌ها ── */
  function paintLessons() {
    var box = $("#xmLessons");
    var keys = Object.keys(SEL_BOOKS).filter(function (k) { return SEL_BOOKS[k]; });
    if (!keys.length) { box.innerHTML = '<div class="xm-empty">اول از گام ۱ کتاب انتخاب کن.</div>'; return; }
    var html = "";
    keys.forEach(function (k) {
      var p = k.split("/"), j = loaded[p[0]];
      if (!j) return;
      var b = j.books.filter(function (x) { return x.s === p[1]; })[0];
      if (!b) return;
      var open = OPEN_LESSONS[k] !== false;
      var nAll = b.lessons.reduce(function (a, x) { return a + x.q.length; }, 0);
      var chosen = b.lessons.filter(function (x) { return SEL_LESSONS[k + "/" + x.id]; }).length;
      html += '<div style="margin-bottom:12px">' +
        '<button type="button" class="xm-pick" data-xopen="' + k + '" aria-pressed="' + (chosen ? "true" : "false") + '" style="margin-bottom:8px">' +
        "<i>📖</i><b>" + esc(b.subject) + "</b><small>" + (chosen ? fa(chosen) + " درس انتخاب شد" : fa(nAll) + " سؤال") + "</small></button>" +
        (open ? '<div class="xm-grid">' +
          '<button type="button" class="xm-pick" data-xbl="' + k + '" aria-pressed="' + (chosen === 0 ? "true" : "false") + '"><b>همهٔ درس‌های این کتاب</b></button>' +
          b.lessons.map(function (L, i) {
            var kk = k + "/" + L.id;
            return '<button type="button" class="xm-pick" data-xl="' + kk + '" aria-pressed="' + (SEL_LESSONS[kk] ? "true" : "false") + '">' +
              "<b>" + fa(i + 1) + ". " + esc(L.t) + "</b><small>" + fa(L.q.length) + " سؤال</small></button>";
          }).join("") + "</div>" : "") +
        "</div>";
    });
    box.innerHTML = html + '<div class="xm-bar-actions"><button type="button" class="xm-go ghost" data-xlall>همهٔ درس‌های کتاب‌های انتخابی</button>' +
      '<span class="xm-hint">اگر درسی را انتخاب نکنی، سؤال‌های همهٔ درس‌های آن کتاب می‌آید.</span></div>';
  }

  /* ── ساخت استخر سؤال ── */
  function buildPool(onlyWrongIds) {
    var keys = Object.keys(SEL_BOOKS).filter(function (k) { return SEL_BOOKS[k]; });
    var chosenAny = Object.keys(SEL_LESSONS).some(function (k) { return SEL_LESSONS[k]; });
    var seen = LS.get(SEEN_KEY, {}) || {};
    var onlyNew = $("#xmOnlyNew") && $("#xmOnlyNew").checked;
    var pool = [];
    keys.forEach(function (k) {
      var p = k.split("/"), j = loaded[p[0]];
      if (!j) return;
      var b = j.books.filter(function (x) { return x.s === p[1]; })[0];
      if (!b) return;
      b.lessons.forEach(function (L) {
        var kk = k + "/" + L.id;
        if (chosenAny && !SEL_LESSONS[kk]) return;
        L.q.forEach(function (q, qi) {
          var sig = kk + "#" + qi;
          if (onlyWrongIds) { if (onlyWrongIds.indexOf(sig) < 0) return; }
          else if (onlyNew && seen[sig] && seen[sig].ok) return;
          pool.push({ sig: sig, book: b.subject, g: p[0], s: p[1], lid: L.id, lt: L.t, q: q.q, o: q.o.slice(), c: q.c, e: q.e });
        });
      });
    });
    return pool;
  }

  /* ── شروع آزمون ── */
  function start(onlyWrongIds) {
    var pool = onlyWrongIds ? buildPool(onlyWrongIds) : buildPool(null);
    if (pool.length < 4) { toast("از این انتخاب، سؤال کافی نیست. کتاب یا درس بیشتری انتخاب کن.", true); return; }
    var want = parseInt(($("#xmCount") || {}).value, 10) || 20;
    var mins = parseInt(($("#xmTime") || {}).value, 10) || 0;
    var shuffleOpts = !$("#xmShuffleOpts") || $("#xmShuffleOpts").checked;
    var instant = $("#xmInstant") && $("#xmInstant").checked;

    /* تصادفی‌سازی */
    for (var i = pool.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    var qs = pool.slice(0, Math.min(want, pool.length)).map(function (x) {
      var pairs = x.o.map(function (txt, idx) { return { txt: txt, ok: idx === x.c }; });
      if (shuffleOpts) for (var m = pairs.length - 1; m > 0; m--) { var n = Math.floor(Math.random() * (m + 1)); var tmp = pairs[m]; pairs[m] = pairs[n]; pairs[n] = tmp; }
      return {
        sig: x.sig, book: x.book, lesson: x.lt, q: x.q, e: x.e,
        o: pairs.map(function (p) { return p.txt; }),
        a: pairs.map(function (p, idx) { return p.ok ? idx : -1; }).filter(function (v) { return v >= 0; })[0],
        pick: -1
      };
    });

    EXAM = {
      qs: qs, i: 0, instant: instant, total: qs.length,
      left: mins > 0 ? mins * 60 : 0, started: Date.now(), done: false
    };
    renderRun();
    if (mins > 0) startTimer();
  }

  function startTimer() {
    stopTimer();
    TIMER = setInterval(function () {
      if (!EXAM || EXAM.done) return;
      EXAM.left--;
      var c = $("#xmClock");
      if (c) { c.textContent = fmtClock(EXAM.left); c.classList.toggle("low", EXAM.left <= 60); }
      if (EXAM.left <= 0) { stopTimer(); finish(true); }
    }, 1000);
  }
  function stopTimer() { if (TIMER) { clearInterval(TIMER); TIMER = null; } }
  function fmtClock(s) { var m = Math.floor(s / 60); var x = s % 60; return fa(m) + ":" + fa(x < 10 ? "0" + x : x); }

  /* ── نمایش آزمون ── */
  function renderRun() {
    var box = $("#xmRun");
    box.hidden = false;
    $("#xmSetup").hidden = true;
    var q = EXAM.qs[EXAM.i];
    if (!q) return finish(false);
    var last = EXAM.i === EXAM.total - 1;
    box.innerHTML =
      '<div class="xm-top">' +
        (EXAM.left > 0 ? '<span class="xm-clock" id="xmClock">' + fmtClock(EXAM.left) + "</span>" : "") +
        '<span class="xm-prog"><b>سؤال ' + fa(EXAM.i + 1) + " از " + fa(EXAM.total) + "</b><div><i style=\"inline-size:" +
          Math.round(((EXAM.i + 1) / EXAM.total) * 100) + '%"></i></div></span>' +
        '<button type="button" class="xm-go ghost" data-xfinish>پایان و تصحیح</button>' +
      "</div>" +
      '<div class="xm-q">' +
        '<div class="xm-qq"><span class="xm-n">' + fa(EXAM.i + 1) + "</span><p>" + esc(q.q) + "</p></div>" +
        '<div class="xm-opts">' + q.o.map(function (o, oi) {
          var cls = "", dis = "";
          if (EXAM.instant && q.pick >= 0) {
            dis = " disabled";
            if (oi === q.a) cls = " right";
            else if (oi === q.pick) cls = " wrong";
          } else if (q.pick === oi) cls = " sel";
          return '<button type="button" class="xm-opt' + cls + '" data-xo="' + oi + '"' + dis + '>' +
            '<span class="k">' + fa(oi + 1) + "</span><span>" + esc(o) + "</span></button>";
        }).join("") + "</div>" +
        (EXAM.instant && q.pick >= 0 && q.e ? '<div class="xm-expl">' + esc(q.e) + "</div>" : "") +
        '<div class="xm-qnav">' +
          '<button type="button" class="xm-go ghost" data-xprev' + (EXAM.i ? "" : " disabled") + ">→ سؤال قبلی</button>" +
          (last ? '<button type="button" class="xm-go" data-xfinish>پایان و دیدن نتیجه</button>'
                : '<button type="button" class="xm-go" data-xnext>سؤال بعدی ←</button>') +
          '<span class="xm-hint">' + esc(q.book) + " · " + esc(q.lesson) + "</span>" +
        "</div>" +
        '<div class="xm-jump">' + EXAM.qs.map(function (x, xi) {
          var c = "done";
          if (EXAM.done || (EXAM.instant && x.pick >= 0)) c = x.pick < 0 ? "" : (x.pick === x.a ? "ok" : "no");
          else if (x.pick >= 0) c = "done";
          if (xi === EXAM.i) c += " cur";
          return '<button type="button" class="' + c.trim() + '" data-xjump="' + xi + '">' + fa(xi + 1) + "</button>";
        }).join("") + "</div>" +
      "</div>";
    if (W.innerWidth < 720) W.scrollTo({ top: box.offsetTop - 70, behavior: "smooth" });
  }

  /* ── پایان و تصحیح ── */
  function finish(byTime) {
    if (!EXAM || EXAM.done) return;
    EXAM.done = true;
    stopTimer();
    var right = 0, wrong = 0, skip = 0;
    var wrongIds = [];
    var seen = LS.get(SEEN_KEY, {}) || {};
    EXAM.qs.forEach(function (q) {
      if (q.pick < 0) { skip++; }
      else if (q.pick === q.a) { right++; seen[q.sig] = { ok: true, t: Date.now() }; }
      else { wrong++; wrongIds.push(q.sig); seen[q.sig] = { ok: false, t: Date.now() }; }
    });
    LS.set(SEEN_KEY, seen);
    var pct = Math.round((right / EXAM.total) * 100);
    var secs = Math.round((Date.now() - EXAM.started) / 1000);

    var hist = LS.get(HIST_KEY, []) || [];
    hist.unshift({ t: Date.now(), n: EXAM.total, right: right, pct: pct, secs: secs });
    LS.set(HIST_KEY, hist.slice(0, 20));

    var verdict = pct >= 90 ? "فوق‌العاده! این درس را بلدی 🌟" :
      pct >= 75 ? "خوب بود! چند نکتهٔ کوچک مانده 👍" :
      pct >= 50 ? "قابل قبول است، ولی جای کار دارد 💪" :
      "نگران نباش — برگرد سر جزوه و دوباره امتحان بده 📚";

    var box = $("#xmRun");
    box.innerHTML =
      '<div class="xm-res">' +
        '<div class="xm-score">' + fa(pct) + "٪</div>" +
        "<h2>" + (byTime ? "زمان تمام شد! " : "") + verdict + "</h2>" +
        "<p>پاسخ‌های درست را پایین ببین. توضیح هر سؤال در جزوه هم آمده است.</p>" +
        '<div class="xm-kpis">' +
          '<span class="xm-kpi"><b>' + fa(right) + "</b>درست</span>" +
          '<span class="xm-kpi"><b>' + fa(wrong) + "</b>غلط</span>" +
          '<span class="xm-kpi"><b>' + fa(skip) + "</b>بی‌پاسخ</span>" +
          '<span class="xm-kpi"><b>' + fmtClock(secs) + "</b>زمان</span>" +
        "</div>" +
        '<div class="xm-bar-actions" style="justify-content:center">' +
          (wrongIds.length ? '<button type="button" class="xm-go" data-xagain="' + esc(wrongIds.join(",")) + '">تمرین سؤال‌های غلط (' + fa(wrongIds.length) + ")</button>" : "") +
          '<button type="button" class="xm-go ghost" data-xnew>آزمون تازه با همین انتخاب</button>' +
          '<button type="button" class="xm-go ghost" data-xback>عوض‌کردن کتاب و درس</button>' +
        "</div>" +
      "</div>" +
      '<div class="xm-review">' + EXAM.qs.map(function (q, i) {
        var st = q.pick < 0 ? "sk" : (q.pick === q.a ? "ok" : "no");
        var badge = st === "ok" ? "✓" : st === "no" ? "✕" : "—";
        return '<div class="xm-rv ' + st + '">' +
          '<b class="q">' + fa(i + 1) + ". " + esc(q.q) + "</b>" +
          '<div class="ans">' + (q.pick < 0 ? "بی‌پاسخ" :
            (q.pick === q.a ? "<i>" + esc(q.o[q.pick]) + " ✓</i>"
              : "<s>" + esc(q.o[q.pick]) + "</s> · پاسخ درست: <i>" + esc(q.o[q.a]) + " ✓</i>")) +
            " <span style=\"color:var(--muted)\">" + badge + "</span></div>" +
          (q.e ? '<div class="why">' + esc(q.e) + "</div>" : "") +
          "</div>";
      }).join("") + "</div>";
    W.scrollTo({ top: box.offsetTop - 70, behavior: "smooth" });
    paintHistory();
  }

  /* ── تاریخچه ── */
  function paintHistory() {
    var box = $("#xmHistory");
    if (!box) return;
    var hist = LS.get(HIST_KEY, []) || [];
    if (!hist.length) { box.innerHTML = ""; return; }
    box.innerHTML = '<h2 style="margin:0 0 10px;font-size:.98rem">📈 نتیجه‌های پیشین تو</h2>' +
      hist.map(function (h, i) {
        var when = "";
        try { when = new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(h.t)); } catch (e) { }
        return '<div class="xm-hr"><span class="pct">' + fa(h.pct) + "٪</span>" +
          "<span>" + fa(h.right) + " از " + fa(h.n) + " درست</span>" +
          "<span style=\"color:var(--muted)\">" + fmtClock(h.secs) + " زمان</span>" +
          (i === 0 ? '<span style="color:var(--brand);font-weight:700">آخرین</span>' : "") +
          "<time>" + esc(when) + "</time></div>";
      }).join("");
  }

  /* ── رویدادها ── */
  function wire() {
    var body = $("#xmBody");
    body.addEventListener("click", function (e) {
      var t = e.target;
      function up(sel) { return t.closest ? t.closest(sel) : null; }
      var el;

      if ((el = up("[data-xg]"))) {                      /* پایه */
        var on = el.getAttribute("aria-pressed") === "true";
        el.setAttribute("aria-pressed", on ? "false" : "true");
        SEL_BOOKS = {}; SEL_LESSONS = {};
        paintBooks();
        return;
      }
      if ((el = up("[data-xb]"))) {                      /* کتاب */
        var kb = el.getAttribute("data-xb");
        SEL_BOOKS[kb] = !SEL_BOOKS[kb];
        if (!SEL_BOOKS[kb]) Object.keys(SEL_LESSONS).forEach(function (k) { if (k.indexOf(kb + "/") === 0) delete SEL_LESSONS[k]; });
        el.setAttribute("aria-pressed", SEL_BOOKS[kb] ? "true" : "false");
        paintLessons();
        return;
      }
      if ((el = up("[data-xl]"))) {                      /* درس */
        var kl = el.getAttribute("data-xl");
        SEL_LESSONS[kl] = !SEL_LESSONS[kl];
        el.setAttribute("aria-pressed", SEL_LESSONS[kl] ? "true" : "false");
        paintLessons();
        return;
      }
      if ((el = up("[data-xbl]"))) {                     /* همهٔ درس‌های یک کتاب */
        var k2 = el.getAttribute("data-xbl");
        Object.keys(SEL_LESSONS).forEach(function (k) { if (k.indexOf(k2 + "/") === 0) delete SEL_LESSONS[k]; });
        paintLessons();
        return;
      }
      if ((el = up("[data-xall]"))) {
        Object.keys(SEL_BOOKS).forEach(function (k) { SEL_BOOKS[k] = true; });
        paintBooks(); return;
      }
      if ((el = up("[data-xnone]"))) { SEL_BOOKS = {}; SEL_LESSONS = {}; paintBooks(); return; }
      if ((el = up("[data-xlall]"))) {
        Object.keys(loaded).forEach(function (g) {
          var j = loaded[g];
          j.books.forEach(function (b) {
            var k = g + "/" + b.s;
            if (!SEL_BOOKS[k]) return;
            b.lessons.forEach(function (L) { SEL_LESSONS[k + "/" + L.id] = true; });
          });
        });
        paintLessons(); return;
      }
      if ((el = up("[data-xstart]"))) { start(null); return; }
      if ((el = up("[data-xfinish]"))) { finish(false); return; }
      if ((el = up("[data-xprev]"))) { if (EXAM.i > 0) { EXAM.i--; renderRun(); } return; }
      if ((el = up("[data-xnext]"))) { if (EXAM.i < EXAM.total - 1) { EXAM.i++; renderRun(); } return; }
      if ((el = up("[data-xjump]"))) { EXAM.i = +el.getAttribute("data-xjump"); renderRun(); return; }
      if ((el = up("[data-xo]"))) {                      /* انتخاب گزینه */
        var q = EXAM.qs[EXAM.i];
        if (EXAM.instant && q.pick >= 0) return;
        q.pick = +el.getAttribute("data-xo");
        if (EXAM.instant) {
          if (q.pick !== q.a) { /* ثبت شد */ }
          setTimeout(function () { if (EXAM.i < EXAM.total - 1) { EXAM.i++; } renderRun(); }, 900);
        }
        renderRun();
        return;
      }
      if ((el = up("[data-xagain]"))) {
        var ids = (el.getAttribute("data-xagain") || "").split(",").filter(Boolean);
        EXAM = null; $("#xmRun").innerHTML = ""; $("#xmRun").hidden = true; $("#xmSetup").hidden = false;
        start(ids);
        return;
      }
      if ((el = up("[data-xnew]"))) {
        var sel = SEL_BOOKS, les = SEL_LESSONS;
        EXAM = null; $("#xmRun").hidden = true; $("#xmSetup").hidden = false;
        SEL_BOOKS = sel; SEL_LESSONS = les;
        paintBooks(); start(null);
        return;
      }
      if ((el = up("[data-xback]"))) {
        EXAM = null; stopTimer();
        $("#xmRun").hidden = true; $("#xmRun").innerHTML = "";
        $("#xmSetup").hidden = false;
        paintBooks();
        W.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
    });

    /* میان‌بُر کیبورد در آزمون */
    D.addEventListener("keydown", function (e) {
      if (!EXAM || EXAM.done) return;
      var tag = e.target && e.target.tagName ? e.target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "select" || tag === "textarea") return;
      if (["1", "2", "3", "4"].indexOf(e.key) > -1) {
        var i = +e.key - 1;
        var btn = $('.xm-opt[data-xo="' + i + '"]');
        if (btn && !btn.disabled) btn.click();
      } else if (e.key === "ArrowLeft") { var n = $("[data-xnext]"); if (n && !n.disabled) n.click(); }
      else if (e.key === "ArrowRight") { var p = $("[data-xprev]"); if (p && !p.disabled) p.click(); }
    });
  }

  /* ── راه‌اندازی ── */
  ready(function () {
    var body = $("#xmBody");
    if (!body) return;
    gradeSelect();
    var g = LS.get("pk:grade", null);
    if (["7", "8", "9"].indexOf(g) > -1) {
      $$("[data-xg]").forEach(function (b) { b.setAttribute("aria-pressed", b.getAttribute("data-xg") === g ? "true" : "false"); });
    }
    wire();
    paintBooks();
    paintHistory();
  });
})();
