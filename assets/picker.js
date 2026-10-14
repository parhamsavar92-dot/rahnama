/* ==========================================================================
   رهنما — انتخابگر کتاب و درس (picker.js)
   --------------------------------------------------------------------------
   گام ۱: کتابت را انتخاب کن (پایه + درس).
   گام ۲: حالا درس مورد نظرت را با یک دکمه باز کن.
   وضعیت خوانده‌شدن را با همان کلید خود سایت می‌خواند (`g8:read:<درس>:<شناسه>`)
   تا پیشرفتی که کاربر با دکمهٔ «خوانده‌ام» ساخته، این‌جا هم دیده شود.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function fa(n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function num(s) { return String(s == null ? "" : s).replace(/[\u06f0-\u06f9]/g, function (d) { return String(FA.indexOf(d)); }); }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function norm(s) {
    return String(s || "").toLowerCase()
      .replace(/[\u064B-\u0652\u0670\u200c\u200e\u200f]/g, "")
      .replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").trim();
  }
  var LS = {
    get: function (k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  function ready(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }

  var BOOKS = [], BY = {};
  var grade = "8", slug = "", q = "";

  /* ── وضعیت خواندن هر کتاب ── */
  function readKey(s, id) { return "g8:read:" + s + ":" + id; }
  function isRead(s, id) { return LS.get(readKey(s, id), false) === true; }
  function bookProgress(b) {
    var done = 0;
    for (var i = 0; i < b.lessons.length; i++) if (isRead(b.s, b.lessons[i].id)) done++;
    return { done: done, total: b.lessons.length, pct: b.lessons.length ? Math.round((done / b.lessons.length) * 100) : 0 };
  }

  /* ── نشانی صفحه: ?g=8&s=math ── */
  function readUrl() {
    var p = new URLSearchParams(location.search);
    var g = num(p.get("g") || "");
    if (["7", "8", "9"].indexOf(g) > -1) grade = g;
    else {
      var lastG = LS.get("pk:grade", null);
      if (["7", "8", "9"].indexOf(lastG) > -1) grade = lastG;
    }
    var s = p.get("s") || "";
    slug = BY[grade + "/" + s] ? s : "";
  }
  function writeUrl(replace) {
    try {
      var u = new URL(location.href);
      u.searchParams.set("g", grade);
      if (slug) u.searchParams.set("s", slug); else u.searchParams.delete("s");
      (replace ? history.replaceState : history.pushState).call(history, null, "", u.pathname + (u.search || ""));
    } catch (e) { }
  }

  /* ── گام‌ها ── */
  function stepsHtml() {
    return '<div class="pk-steps">' +
      '<span class="pk-step ' + (slug ? "" : "pk-on") + '"><b>۱</b> کتابت را انتخاب کن</span>' +
      '<span class="pk-sep">›</span>' +
      '<span class="pk-step ' + (slug ? "pk-on" : "pk-off") + '"><b>۲</b> کدام درس را بخوانی؟</span>' +
      '</div>';
  }

  /* ── گام ۱: کتاب‌ها ── */
  function paintBooks() {
    var box = $("#pkBody");
    var list = BOOKS.filter(function (b) { return String(b.g) === grade; });
    var last = LS.get("pk:last", null);
    var resume = null;
    if (last && BY[last.g + "/" + last.s]) {
      var lb = BY[last.g + "/" + last.s];
      var idx = -1;
      for (var i = 0; i < lb.lessons.length; i++) if (lb.lessons[i].id === last.id) idx = i;
      if (idx > 0) resume = { b: lb, L: lb.lessons[idx], n: idx + 1 };
    }
    box.innerHTML = stepsHtml() +
      (resume ? '<div class="pk-resume"><i>📌</i><div><b>ادامه از: ' + esc(resume.L.t) + '</b>' +
        '<span>' + esc(resume.b.subject) + ' — پایهٔ ' + esc(resume.b.grade) + ' · درس ' + fa(resume.n) + ' از ' + fa(resume.b.lessons.length) + '</span></div>' +
        '<a class="pk-chip" style="text-decoration:none" href="' + resume.b.url + '?ch=' + resume.n + '#' + esc(resume.L.id) + '">برو به همان درس</a></div>' : "") +
      '<div class="pk-books">' +
      list.map(function (b, i) {
        var pr = bookProgress(b);
        return '<button type="button" class="pk-book" data-book="' + b.s + '" style="--pk-c:' + b.color + ";animation-delay:" + Math.min(i, 10) * 40 + 'ms">' +
          (pr.done ? '<span class="pk-badge">' + fa(pr.pct) + "٪ خوانده‌ای</span>" : "") +
          '<span class="pk-book-ico">' + b.icon + "</span>" +
          "<b>" + esc(b.subject) + "</b>" +
          "<small>پایهٔ " + esc(b.grade) + "</small>" +
          '<span class="pk-book-bar"><i style="inline-size:' + pr.pct + '%"></i></span>' +
          '<span class="pk-book-meta"><span>' + fa(b.chapters) + " درس</span><span>" + fa(b.quiz) + " سؤال</span></span>" +
          "</button>";
      }).join("") + "</div>" +
      '<p class="pk-note">💡 روی کتاب بزن تا فهرست درس‌هایش باز شود. هر جا خواستی، می‌توانی از همین‌جا با جست‌وجو مستقیم به یک درس بروی.</p>';

    box.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-book]") : null;
      if (!b) return;
      slug = b.getAttribute("data-book");
      LS.set("pk:grade", grade);
      writeUrl(false);
      paint();
    });
  }

  /* ── گام ۲: درس‌های کتاب ── */
  function paintChapters() {
    var box = $("#pkBody");
    var b = BY[grade + "/" + slug];
    if (!b) { slug = ""; return paint(); }
    var pr = bookProgress(b);
    box.innerHTML = stepsHtml() +
      '<div class="pk-bookhead" style="--pk-c:' + b.color + '">' +
        "<i>" + b.icon + "</i>" +
        "<div><b>جزوهٔ " + esc(b.subject) + " — پایهٔ " + esc(b.grade) + "</b>" +
        "<span>" + fa(b.chapters) + " درس · " + fa(b.quiz) + " سؤال آزمون · خوانده‌شده: " + fa(pr.done) + " از " + fa(b.lessons.length) + " (" + fa(pr.pct) + "٪)</span></div>" +
        '<button type="button" class="pk-chip" data-back>تغییر کتاب</button>' +
        '<a class="pk-chip" style="text-decoration:none" href="' + b.url + '">همهٔ کتاب در یک صفحه</a>' +
      "</div>" +
      '<div class="pk-chapters">' +
      b.lessons.map(function (L, i) {
        var done = isRead(b.s, L.id);
        var extra = L.k === "extra";
        return '<a class="pk-ch' + (done ? " pk-done" : "") + (extra ? " pk-extra" : "") + '" href="' + b.url + "#" + esc(L.id) + '"' +
          ' style="--pk-c:' + b.color + ";animation-delay:" + Math.min(i, 14) * 32 + 'ms\"' +
          ' data-ch="' + (i + 1) + '" data-g="' + b.g + '" data-s="' + b.s + '" data-id="' + esc(L.id) + '">' +
          '<span class="pk-ch-num">' + (extra ? "★" : fa(L.n)) + "</span>" +
          '<span class="pk-ch-tx"><b>' + esc(L.t) + "</b>" +
          "<small>" + (L.q ? fa(L.q) + " سؤال" : (extra ? "جمع‌بندی کامل کتاب" : "درس")) + (done ? " · خوانده‌شده" : "") + "</small></span>" +
          (done ? '<span class="pk-mark">✓</span>' : "") +
          "</a>";
      }).join("") + "</div>" +
      '<p class="pk-note">📖 با کلیک روی هر درس، فقط همان درس باز می‌شود و بالا و پایینش دکمهٔ «درس بعدی» هست. کلیدهای → و ← هم کار می‌کنند.</p>';

    box.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("[data-back]")) { slug = ""; writeUrl(false); paint(); return; }
      var a = e.target.closest ? e.target.closest("[data-ch]") : null;
      if (!a) return;
      /* یادش بماند کجا بود تا کارت «ادامه» کار کند */
      LS.set("pk:last", { g: a.getAttribute("data-g"), s: a.getAttribute("data-s"), id: a.getAttribute("data-id") });
      LS.set("pk:grade", a.getAttribute("data-g"));
    });
  }

  /* ── جست‌وجو در همهٔ درس‌های هر سه پایه ── */
  function paintSearch() {
    var box = $("#pkBody");
    var nq = norm(q);
    var hits = [];
    BOOKS.forEach(function (b) {
      b.lessons.forEach(function (L, i) {
        var hay = norm(L.t + " " + L.s + " " + b.subject + " " + b.grade + " درس " + (L.n || ""));
        var p = hay.indexOf(nq);
        if (p > -1) hits.push({ b: b, L: L, i: i, s: norm(L.t).indexOf(nq) === 0 ? 0 : 1 + p / 100 });
      });
    });
    hits.sort(function (a, c) { return a.s - c.s; });
    hits = hits.slice(0, 40);
    box.innerHTML = stepsHtml() +
      '<p class="pk-note" style="margin-bottom:14px">🔎 ' + fa(hits.length) + ' درس پیدا شد برای «' + esc(q) + '» — روی هرکدام بزنی مستقیم باز می‌شود.</p>' +
      (hits.length ? '<div class="pk-hits">' + hits.map(function (h) {
        return '<a class="pk-hit" href="' + h.b.url + "?ch=" + (h.i + 1) + "#" + esc(h.L.id) + '"' +
          ' data-g="' + h.b.g + '" data-s="' + h.b.s + '" data-id="' + esc(h.L.id) + '">' +
          '<span class="pk-ch-num" style="--pk-c:' + h.b.color + '">' + (h.L.k === "extra" ? "★" : fa(h.L.n)) + "</span>" +
          '<span class="pk-ch-tx"><b>' + esc(h.L.t) + "</b><small>" + esc(h.b.subject) + " — پایهٔ " + esc(h.b.grade) +
          (h.L.q ? " · " + fa(h.L.q) + " سؤال" : "") + "</small></span>" +
          (isRead(h.b.s, h.L.id) ? '<span class="pk-mark">✓</span>' : "") + "</a>";
      }).join("") + "</div>" : '<div class="pk-empty"><i>🔍</i>درسی با این واژه پیدا نشد.<br>مثلاً بنویس: کسر، فتوسنتز، اعراب، معنی</div>');

    /* یادش بماند کجا بود تا کارت «ادامهٔ مطالعه» درست کار کند */
    box.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("[data-id]") : null;
      if (!a) return;
      LS.set("pk:last", { g: a.getAttribute("data-g"), s: a.getAttribute("data-s"), id: a.getAttribute("data-id") });
      LS.set("pk:grade", a.getAttribute("data-g"));
    });
  }

  function paint() {
    $("#pkTools").hidden = false;
    if (q.trim()) return paintSearch();
    if (slug) return paintChapters();
    return paintBooks();
  }

  /* ── رویدادها ── */
  function wire() {
    $$("[data-grade]").forEach(function (c) {
      c.addEventListener("click", function () {
        grade = c.getAttribute("data-grade");
        slug = ""; q = "";
        var qi = $("#pkQ"); if (qi) qi.value = "";
        $$("[data-grade]").forEach(function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
        LS.set("pk:grade", grade);
        writeUrl(false);
        paint();
      });
    });
    var qi = $("#pkQ");
    if (qi) {
      var t = null;
      qi.addEventListener("input", function () {
        clearTimeout(t);
        t = setTimeout(function () { q = qi.value || ""; paint(); }, 180);
      });
      qi.addEventListener("keydown", function (e) { if (e.key === "Escape") { qi.value = ""; q = ""; paint(); } });
    }
    W.addEventListener("popstate", function () { readUrl(); syncGrade(); paint(); });
  }
  function syncGrade() {
    $$("[data-grade]").forEach(function (x) { x.setAttribute("aria-pressed", x.getAttribute("data-grade") === grade ? "true" : "false"); });
  }

  /* ── راه‌اندازی ── */
  ready(function () {
    var box = $("#pkBody");
    if (!box) return;
    fetch("assets/jozve-chapters.json", { cache: "force-cache" })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        BOOKS = (j.books || []).slice();
        BOOKS.forEach(function (b) { BY[b.g + "/" + b.s] = b; });
        var st = $("#pkStats");
        if (st) st.innerHTML = "<span>📚 <b>" + fa(j.totalBooks) + "</b> کتاب</span><span>📖 <b>" + fa(j.totalLessons) + "</b> درس</span><span>📝 <b>" + fa(j.totalQuiz) + "</b> سؤال</span>";
        readUrl();
        syncGrade();
        wire();
        paint();
      })
      .catch(function (e) {
        box.innerHTML = '<div class="pk-empty"><i>⚠️</i>فهرست کتاب‌ها خوانده نشد.<br>' + esc(e.message) +
          '<br><br>می‌توانی از <a href="jozve.html">صفحهٔ جزوه‌ها</a> استفاده کنی.</div>';
      });
  });
})();
