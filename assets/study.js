/* ==========================================================================
   پایهٔ هشتم — ابزارهای مطالعه  |  study.js
   داشبورد پیشرفت • آزمون جامع تصادفی • فلش‌کارت هوشمند • پشتیبان‌گیری داده
   ========================================================================== */
(function () {
  "use strict";
  var G = window.G8 || {};
  var LS = G.LS || { get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }, del: function (k) { try { localStorage.removeItem(k); } catch (e) {} } };
  var url = G.url || function (p) { return p; };
  var J = G.jsonLoad || function (p) { return fetch(url(p)).then(function (r) { return r.json(); }); };
  var esc = G.esc || function (s) { return String(s); };
  var toast = G.toast || function () {};

  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  var page = (document.body.getAttribute("data-page") || "");

  var GRADE = (function () {
    var q = new URLSearchParams(location.search).get("g");
    var saved = (window.G8 && G8.LS) ? G8.LS.get("g8:grade", null) : null;
    var g = q || saved || document.body.getAttribute("data-grade") || "8";
    if (["7", "8", "9"].indexOf(g) === -1) g = "8";
    if (window.G8 && G8.LS) G8.LS.set("g8:grade", g);
    window.G8GRADE = g;
    return g;
  })();
  J(GRADE === "8" ? "assets/study-data.json" : "assets/study-data-g" + GRADE + ".json")
    .then(function (d) {
      if (page === "dashboard") dash(d);
    if (page === "exam") exam(d);
    if (page === "flashcards") flash(d);
  }).catch(function () { toast("داده‌های مطالعه بارگذاری نشد"); });

  /* ================= داشبورد ================= */
  function readMap(subject, ids) {
    var done = 0;
    ids.forEach(function (id) { if (LS.get("g8:read:" + subject + ":" + id, false)) done++; });
    return done;
  }

  function dash(d) {
    var totals = { lessons: 0, done: 0, notes: 0, quizzes: 0 };
    var perBook = d.books.map(function (b) {
      var ids = d.lessons.filter(function (l) { return l.b === b.key; }).map(function (l) { return l.id; });
      var q = d.lessons.filter(function (l) { return l.b === b.key; }).reduce(function (a, l) { return a + (l.q || 0); }, 0);
      var done = readMap(b.key, ids);
      totals.lessons += ids.length; totals.done += done; totals.quizzes += q;
      return { b: b, total: ids.length, done: done, q: q };
    });

    // یادداشت‌ها
    var notesAll = 0;
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf("g8:notes:") === 0) notesAll += (LS.get(k, []) || []).length;
      }
    } catch (e) {}
    totals.notes = notesAll;

    var exams = LS.get("g8:exams", []);
    var pct = totals.lessons ? Math.round(totals.done / totals.lessons * 100) : 0;

    var stats = $("[data-dash-stats]");
    if (stats) stats.innerHTML =
      '<div class="stat"><b>' + fa(pct) + '٪</b><span>پیشرفت کل مطالعه</span></div>' +
      '<div class="stat"><b>' + fa(totals.done) + " از " + fa(totals.lessons) + '</b><span>درس خوانده‌شده</span></div>' +
      '<div class="stat"><b>' + fa(totals.quizzes) + '</b><span>پرسش در دسترس</span></div>' +
      '<div class="stat"><b>' + fa(totals.notes) + '</b><span>یادداشت ثبت‌شده</span></div>' +
      '<div class="stat"><b>' + fa(exams.length) + '</b><span>آزمون جامع داده‌شده</span></div>';

    var box = $("[data-dash-books]");
    if (box) box.innerHTML = perBook.map(function (p) {
      var r = 24, c = 2 * Math.PI * r, off = c - (p.total ? p.done / p.total : 0) * c;
      return '<a class="book-card" href="' + url(p.b.file) + '" style="--mc:' + p.b.color + '">' +
        '<span class="ring"><svg width="58" height="58"><circle class="rc" cx="29" cy="29" r="24"/><circle class="rv" cx="29" cy="29" r="24" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '"/></svg><b>' + fa(Math.round(p.total ? p.done / p.total * 100 : 0)) + '</b></span>' +
        '<span class="bc-t"><b>' + esc(p.b.name) + '</b><span>' + fa(p.done) + " از " + fa(p.total) + ' درس • ' + fa(p.q) + ' پرسش</span></span></a>';
    }).join("");

    var hist = $("[data-dash-exams]");
    if (hist) hist.innerHTML = exams.length
      ? exams.slice(0, 8).map(function (e) {
          var p = Math.round(e.correct / e.total * 100);
          return '<div class="note-item"><b>' + esc(new Date(e.t).toLocaleString("fa-IR")) + '</b><p>' + fa(e.correct) + " از " + fa(e.total) + " درست — " + fa(p) + '٪</p></div>';
        }).join("")
      : '<p style="color:var(--muted);font-size:.86rem">هنوز آزمون جامعی نداده‌اید. از صفحهٔ «آزمون جامع» شروع کنید.</p>';

    var acts = $("[data-dash-actions]");
    if (acts) {
      acts.addEventListener("click", function (e) {
        if (e.target.closest("[data-export]")) {
          var dump = {};
          try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("g8:") === 0) dump[k] = localStorage.getItem(k); } } catch (er) {}
          var a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(dump)], { type: "application/json" }));
          a.download = "paye-hashtom-backup.json"; a.click();
          toast("پروندهٔ پشتیبان ساخته شد");
        }
        if (e.target.closest("[data-import]")) $("[data-import-file]").click();
        if (e.target.closest("[data-reset]")) {
          if (!confirm("همهٔ پیشرفت و یادداشت‌ها پاک شود؟")) return;
          var ks = [];
          try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf("g8:") === 0 && k.indexOf("g8:theme") !== 0) ks.push(k); } } catch (er) {}
          ks.forEach(function (k) { localStorage.removeItem(k); });
          toast("همه‌چیز بازنشانی شد"); setTimeout(function () { location.reload(); }, 700);
        }
      });
      var fi = $("[data-import-file]");
      if (fi) fi.addEventListener("change", function () {
        var f = fi.files[0]; if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var o = JSON.parse(fr.result);
            Object.keys(o).forEach(function (k) { localStorage.setItem(k, o[k]); });
            toast("پشتیبان بازگردانی شد"); setTimeout(function () { location.reload(); }, 700);
          } catch (e) { toast("پروندهٔ پشتیبان معتبر نیست"); }
        };
        fr.readAsText(f);
      });
    }
  }

  /* ================= آزمون جامع ================= */
  var EX = { qs: [], answers: {}, left: 0, timer: null, running: false };

  function exam(d) {
    var setup = $("[data-exam-setup]");
    if (!setup) return;
    setup.innerHTML =
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">۱</span> کتاب‌ها را انتخاب کن</h4><div data-exam-books class="pill-row"></div></div>' +
      '<div class="card"><h4><span class="card-icon">۲</span> تعداد پرسش و زمان</h4>' +
      '<div class="flex"><label style="font-size:.85rem;font-weight:700">تعداد پرسش</label>' +
      '<select class="area" style="min-height:auto;width:auto;padding:8px 12px" data-exam-count><option value="10">۱۰ پرسش</option><option value="20">۲۰ پرسش</option><option value="30">۳۰ پرسش</option><option value="50">۵۰ پرسش</option></select>' +
      '<label style="font-size:.85rem;font-weight:700">زمان</label>' +
      '<select class="area" style="min-height:auto;width:auto;padding:8px 12px" data-exam-time><option value="0">بدون محدودیت</option><option value="600">۱۰ دقیقه</option><option value="1200">۲۰ دقیقه</option><option value="1800">۳۰ دقیقه</option></select></div></div></div>' +
      '<div class="flex mt-2"><button class="btn btn-primary" data-exam-start>شروع آزمون جامع</button>' +
      '<button class="btn btn-ghost" data-exam-all>انتخاب همهٔ کتاب‌ها</button>' +
      '<button class="btn btn-ghost" data-exam-none>پاک‌کردن انتخاب</button></div>';

    var bwrap = $("[data-exam-books]");
    bwrap.innerHTML = d.books.map(function (b) {
      var n = d.lessons.filter(function (l) { return l.b === b.key; }).reduce(function (a, l) { return a + (l.q || 0); }, 0);
      return '<label class="chip" style="cursor:pointer"><input type="checkbox" value="' + b.key + '" style="margin-inline-end:6px">' + esc(b.name) + " (" + fa(n) + ")</label>";
    }).join("");

    setup.addEventListener("click", function (e) {
      if (e.target.closest("[data-exam-all]")) $$("[data-exam-books] input").forEach(function (i) { i.checked = true; });
      if (e.target.closest("[data-exam-none]")) $$("[data-exam-books] input").forEach(function (i) { i.checked = false; });
      if (e.target.closest("[data-exam-start]")) start(d);
    });

    var bar = $("[data-exam-bar]");
    if (bar) bar.hidden = true;
    if (bar) bar.addEventListener("click", function (e) {
      if (e.target.closest("[data-exam-finish]")) finish(d);
      if (e.target.closest("[data-exam-quit]")) { clearInterval(EX.timer); location.reload(); }
    });

    drawHistory(d);
  }

  /* بانک پرسش‌های چهارگزینه‌ای (assets/mcq.js) — یک‌بار ساخته شده تا آزمون
     جامع هم سریع باشد و هم وقتی فایل‌ها را مستقیم از دیسک باز می‌کنید کار کند؛
     اگر بانک در دسترس نبود، مثل قبل از خود صفحه‌های درس خوانده می‌شود. */
  function bankItems(bank, b) {
    var list = (bank && bank[b.key]) || [];
    return list.map(function (it) {
      return { book: b, lesson: it.lesson || "", q: it.q,
        opts: (it.opts || []).map(function (o) { return { t: o.t, ok: !!o.ok }; }), ex: it.ex || "" };
    });
  }
  function collectQuestions(files) {
    return J("assets/mcq.js").then(function (bank) {
      bank = bank || {};
      var g = bank[GRADE] || bank;
      var all = [];
      files.forEach(function (b) { all = all.concat(bankItems(g, b)); });
      return all.length ? all : collectFromHtml(files);
    }).catch(function () { return collectFromHtml(files); });
  }
  function collectFromHtml(files) {
    return Promise.all(files.map(function (b) {
      return fetch(url(b.file)).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var out = [];
        $$("article.lesson[id]", doc).forEach(function (art) {
          var title = (art.querySelector("h2") || {}).textContent || "";
          $$(".quiz-item", art).forEach(function (qi) {
            var qt = qi.querySelector(".q-text"); if (!qt) return;
            var opts = $$(".opt", qi).map(function (o) { return { t: o.textContent.trim(), ok: o.hasAttribute("data-correct") }; });
            if (opts.length < 2 || !opts.some(function (o) { return o.ok; })) return;
            var ex = qi.querySelector(".q-explain");
            out.push({ book: b, lesson: title.trim(), q: qt.textContent.trim(), opts: opts, ex: ex ? ex.textContent.trim() : "" });
          });
        });
        return out;
      }).catch(function () { return []; });
    })).then(function (lists) { return [].concat.apply([], lists); });
  }

  function start(d) {
    var picked = $$("[data-exam-books] input:checked").map(function (i) { return i.value; });
    if (!picked.length) { toast("حداقل یک کتاب را انتخاب کن"); return; }
    var want = +$("[data-exam-count]").value;
    var secs = +$("[data-exam-time]").value;
    var files = d.books.filter(function (b) { return picked.indexOf(b.key) > -1; }).map(function (b) { return b; });

    toast("در حال آماده‌سازی پرسش‌ها…");
    collectQuestions(files).then(function (all) {
      if (!all.length) { toast("پرسشی پیدا نشد"); return; }
      for (var i = all.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = all[i]; all[i] = all[j]; all[j] = t; }
      EX.qs = all.slice(0, want); EX.answers = {};
      renderExam(d);
      if (secs) { EX.left = secs; EX.running = true; clearInterval(EX.timer); EX.timer = setInterval(function () { tick(d); }, 1000); }
      $("[data-exam-setup]").style.display = "none";
      var bar = $("[data-exam-bar]"); if (bar) { bar.hidden = false; bar.style.display = "flex"; }
      $("#exam-start-anchor") && $("#exam-start-anchor").scrollIntoView({ behavior: "smooth" });
      toast(EX.qs.length + " پرسش آماده شد");
    });
  }

  function tick(d) {
    EX.left--;
    var el = $("[data-exam-timer]");
    if (el) {
      var m = Math.floor(EX.left / 60), s = EX.left % 60;
      el.textContent = fa(m) + ":" + (s < 10 ? "۰" : "") + fa(s);
      el.classList.toggle("low", EX.left <= 60);
    }
    if (EX.left <= 0) { clearInterval(EX.timer); toast("زمان تمام شد"); finish(d); }
  }

  function renderExam(d) {
    var host = $("[data-exam-questions]");
    host.innerHTML = EX.qs.map(function (q, i) {
      return '<div class="q-block" id="q' + i + '">' +
        '<span class="qtag">' + esc(q.book.name) + " • " + esc(q.lesson) + "</span>" +
        "<h4>" + fa(i + 1) + ". " + esc(q.q.replace(/^[۰-۹0-9]+[.)]\s*/, "")) + "</h4>" +
        '<div class="opts">' + q.opts.map(function (o, j) {
          return '<button class="opt" data-q="' + i + '" data-o="' + j + '"><span class="k">' + fa(j + 1) + "</span> " + esc(o.t.replace(/^[۰-۹0-9]+[.)]\s*/, "")) + "</button>";
        }).join("") + "</div>" +
        '<div class="q-explain" data-ex="' + i + '">' + esc(q.ex || "") + "</div></div>";
    }).join("");
    updateProgress();

    host.addEventListener("click", function (e) {
      var b = e.target.closest(".opt"); if (!b) return;
      var qi = +b.dataset.q, oi = +b.dataset.o;
      if (EX.answers[qi] !== undefined) return;
      EX.answers[qi] = oi;
      var q = EX.qs[qi];
      $$('.opt[data-q="' + qi + '"]').forEach(function (o) {
        o.disabled = true;
        if (q.opts[+o.dataset.o].ok) o.classList.add("is-ok");
        else if (o === b) o.classList.add("is-no");
      });
      var ex = $('[data-ex="' + qi + '"]'); if (ex) ex.classList.add("show");
      updateProgress();
    });
  }

  function updateProgress() {
    var n = Object.keys(EX.answers).length;
    var el = $("[data-exam-progress]");
    if (el) el.textContent = "پاسخ‌داده: " + fa(n) + " از " + fa(EX.qs.length);
    var bar = $("[data-exam-fill]");
    if (bar) bar.style.width = (EX.qs.length ? n / EX.qs.length * 100 : 0) + "%";
  }

  function finish(d) {
    clearInterval(EX.timer);
    var correct = 0;
    EX.qs.forEach(function (q, i) {
      var a = EX.answers[i];
      if (a !== undefined && q.opts[a] && q.opts[a].ok) correct++;
    });
    var pct = Math.round(correct / EX.qs.length * 100);
    var medal = pct >= 90 ? "🏆" : pct >= 75 ? "🥇" : pct >= 50 ? "👍" : "📚";
    var hist = LS.get("g8:exams", []);
    hist.unshift({ t: Date.now(), correct: correct, total: EX.qs.length, pct: pct });
    LS.set("g8:exams", hist.slice(0, 40));

    var res = $("[data-exam-result]");
    res.innerHTML = '<div class="card result-hero"><div class="medal">' + medal + '</div>' +
      '<div class="score-big">' + fa(pct) + '<small>٪</small></div>' +
      "<p>" + fa(correct) + " پاسخ درست از " + fa(EX.qs.length) + " پرسش</p>" +
      '<div class="flex" style="justify-content:center"><button class="btn btn-primary" data-again>آزمون تازه</button>' +
      '<button class="btn btn-ghost" onclick="window.print()">چاپ کارنامه</button></div></div>';
    res.addEventListener("click", function (e) { if (e.target.closest("[data-again]")) location.reload(); });
    res.scrollIntoView({ behavior: "smooth" });
    drawHistory(d);
    toast("کارنامه ثبت شد");
  }

  function drawHistory(d) {
    var host = $("[data-exam-history]"); if (!host) return;
    var hist = LS.get("g8:exams", []);
    host.innerHTML = hist.length ? hist.slice(0, 6).map(function (h) {
      return '<div class="note-item"><b>' + esc(new Date(h.t).toLocaleString("fa-IR")) + '</b><p>' + fa(h.correct) + " از " + fa(h.total) + " — " + fa(h.pct) + '٪</p></div>';
    }).join("") : '<p style="color:var(--muted);font-size:.86rem">کارنامه‌ای ثبت نشده است.</p>';
  }

  /* ================= فلش‌کارت ================= */
  var FC = { cards: [], i: 0, know: {}, kind: "pts" };

  function flash(d) {
    var setup = $("[data-fc-setup]"); if (!setup) return;
    setup.innerHTML =
      '<div class="grid-2">' +
      '<div class="card"><h4><span class="card-icon">۱</span> کتاب</h4>' +
      '<select class="area" data-fc-book style="min-height:auto;padding:9px 12px">' + d.books.map(function (b) { return '<option value="' + b.key + '">' + esc(b.name) + "</option>"; }).join("") + "</select></div>" +
      '<div class="card"><h4><span class="card-icon">۲</span> نوع کارت</h4>' +
      '<select class="area" data-fc-kind style="min-height:auto;padding:9px 12px">' +
      '<option value="pts">نکته‌های کلیدی (پرسش از نکته)</option>' +
      '<option value="terms">اصطلاح و واژه‌نامه</option>' +
      '<option value="mix">ترکیبی</option></select></div></div>' +
      '<div class="flex mt-2"><button class="btn btn-primary" data-fc-start>شروع مرور</button>' +
      '<button class="btn btn-ghost" data-fc-unknown>مرور کارت‌های نامعلوم</button></div>';
    var st0 = $("[data-fc-stage]"); if (st0) st0.hidden = true;
    setup.addEventListener("click", function (e) {
      if (e.target.closest("[data-fc-start]")) build(d, false);
      if (e.target.closest("[data-fc-unknown]")) build(d, true);
    });
  }

  function build(d, onlyUnknown) {
    var bk = $("[data-fc-book]").value;
    var kind = $("[data-fc-kind]") ? $("[data-fc-kind]").value : "pts";
    var lessons = d.lessons.filter(function (l) { return l.b === bk; });
    var cards = [];
    lessons.forEach(function (l) {
      var useP = kind !== "terms", useT = kind !== "pts";
      if (useP) (l.pts || []).forEach(function (p, idx) { cards.push({ k: l.b + ":" + l.id + ":p" + idx, q: "در «" + l.t + "» — نکتهٔ کلیدی را کامل کن:", a: p, tag: l.t }); });
      if (useT) (l.terms || []).forEach(function (t, idx) { if (t[0].length + t[1].length > 8) cards.push({ k: l.b + ":" + l.id + ":t" + idx, q: t[0], a: t[1], tag: l.t }); });
    });
    var known = LS.get("g8:fcKnown", {});
    if (onlyUnknown) cards = cards.filter(function (c) { return !known[bk + "|" + c.k]; });
    if (!cards.length) { toast("کارتی برای مرور پیدا نشد"); return; }
    for (var i = cards.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = cards[i]; cards[i] = cards[j]; cards[j] = t; }
    FC.cards = cards.slice(0, 60); FC.i = 0; FC.know = {};
    $("[data-fc-setup]").style.display = "none";
    var st = $("[data-fc-stage]"); if (st) { st.hidden = false; st.style.display = "block"; }
    drawCard();
  }

  function drawCard() {
    var c = FC.cards[FC.i];
    var card = $("[data-fc-card]");
    if (!c) {
      $("[data-fc-stage]").innerHTML = '<div class="card result-hero"><div class="medal">🎯</div><h3>مرور تمام شد!</h3><p>' + fa(Object.keys(FC.know).length) + ' کارت را یاد گرفته‌ای.</p><div class="flex" style="justify-content:center"><button class="btn btn-primary" onclick="location.reload()">شروع دوباره</button></div></div>';
      return;
    }
    card.classList.remove("flipped");
    $("[data-fc-q]").textContent = c.q;
    $("[data-fc-a]").textContent = c.a;
    $("[data-fc-tag]").textContent = c.tag;
    $("[data-fc-count]").textContent = "کارت " + fa(FC.i + 1) + " از " + fa(FC.cards.length);
    var bar = $("[data-fc-fill]"); if (bar) bar.style.width = (FC.i / FC.cards.length * 100) + "%";
    var bk = $("[data-fc-book]").value;
    var kn = $("[data-fc-know]");
    if (kn) kn.classList.toggle("on", !!LS.get("g8:fcKnown", {})[bk + "|" + c.k]);
  }

  document.addEventListener("click", function (e) {
    if (FC.cards.length === 0) return;
    if (e.target.closest("[data-fc-flip]") || e.target.closest("[data-fc-card]")) $("[data-fc-card]").classList.toggle("flipped");
    if (e.target.closest("[data-fc-next]")) { FC.i++; drawCard(); }
    if (e.target.closest("[data-fc-prev]")) { FC.i = Math.max(0, FC.i - 1); drawCard(); }
    if (e.target.closest("[data-fc-know]")) {
      var c = FC.cards[FC.i]; var bk = $("[data-fc-book]").value;
      var map = LS.get("g8:fcKnown", {});
      map[bk + "|" + c.k] = 1; LS.set("g8:fcKnown", map);
      FC.know[c.k] = 1; FC.i++; drawCard(); toast("به کارت‌های آموخته‌شده اضافه شد");
    }
  });
})();
