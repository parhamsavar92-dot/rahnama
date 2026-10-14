/* ==========================================================================
   رهنما — خوانندهٔ جزوه (reader.js)
   --------------------------------------------------------------------------
   روی صفحه‌های jozve/<پایه>/<درس>.html کار می‌کند و این‌ها را اضافه می‌کند:
     • نوار خواندن: نام کتاب، «درس ۳ از ۴۷»، دکمهٔ درس قبلی/بعدی، حلقهٔ پیشرفت
     • کشوی فهرست درس‌ها با جست‌وجو، شمارِ سؤال‌ها و ✓ درس‌های خوانده‌شده
     • حالت «فقط همین درس» (نشانی ?ch=3) — بدون شلوغی، تمرکز روی یک درس
     • دکمهٔ «خواندم» در پایان هر درس + علامت‌گذاری خودکار هنگام رسیدن به پایان
     • یادآوری «ادامه بده» برای درسی که رهایش کرده بودی
   نکتهٔ مهم: وضعیت خوانده‌شدن را با همان کلید خودِ سایت ذخیره می‌کند
   (`g8:read:<درس>:<شناسه>`) تا با دکمهٔ «خوانده‌ام» موجود هم‌گام بماند و
   آمار قبلی کاربر از دست نرود.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  if (!D || !W) return;

  var m = /\/jozve\/(\d)\/([a-z0-9-]+)\.html$/i.exec(location.pathname);
  if (!m) return;                       /* فقط روی صفحه‌های جزوه */
  var GRADE = m[1], SLUG = m[2];

  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function fa(n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ready(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }
  var REDUCED = false;
  try { REDUCED = W.matchMedia && W.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }

  var LS = {
    get: function (k, d) { try { var v = W.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { W.localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  /* همان کلید خود سایت — تا دکمهٔ «خوانده‌ام» موجود و این خواننده یکی باشند */
  var readKey = function (id) { return "g8:read:" + SLUG + ":" + id; };
  var POS_KEY = "rd:pos:" + GRADE + "/" + SLUG;
  var VIEW_KEY = "rd:view:" + GRADE + "/" + SLUG;

  var META = null;            /* اطلاعات کتاب از jozve-chapters.json */
  var lessons = [];           /* [{id, el, n, t, q, extra}] */
  var cur = 0;
  var bar = null, drawer = null, back = null;

  /* ── ۱. جمع‌آوری درس‌های همین صفحه از خود DOM (مطمئن‌ترین راه) ── */
  function collect() {
    var els = $$("main article.lesson[id]");
    lessons = els.map(function (el, i) {
      var h2 = el.querySelector("h2");
      var badge = el.querySelector(".lesson-badge");
      var host = el.closest ? el.closest("[id]") : null;
      var isExtra = /jz-extra/.test(el.id);
      return {
        id: el.id,
        el: el,
        n: isExtra ? 0 : i + 1,
        t: (h2 ? h2.textContent : "").trim() || ("درس " + fa(i + 1)),
        b: (badge ? badge.textContent : "").trim(),
        q: el.querySelectorAll(".quiz-item").length,
        extra: isExtra
      };
    });
    if (lessons.length && lessons[lessons.length - 1].extra) {
      /* «جمع‌بندی» شمارهٔ درس نمی‌گیرد */
      lessons[lessons.length - 1].t = "جمع‌بندی نهایی و آزمون خودسنجی";
    }
    return lessons.length;
  }

  /* ── ۲. اطلاعات کتاب از ایندکس (اختیاری؛ نبودش مانع کار نیست) ── */
  function meta(done) {
    fetch("../../assets/jozve-chapters.json", { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (j && j.books) {
          META = j.books.filter(function (b) { return String(b.g) === GRADE && b.s === SLUG; })[0] || null;
        }
      })
      .catch(function () { })
      .then(done);
  }

  /* ── ۳. وضعیت خوانده‌شدن ── */
  function isRead(id) { return LS.get(readKey(id), false) === true; }
  function setRead(id, on) {
    LS.set(readKey(id), !!on);
    var el = byId(id);
    if (el) el.classList.toggle("rd-done", !!on);
    var btn = D.querySelector(".toc a[href='#" + id + "']");
    if (btn) btn.classList.toggle("is-read", !!on);
    var t = D.querySelector('.read-toggle[data-rd-for="' + id + '"]');
    render();
  }
  function readCount() { var n = 0; for (var i = 0; i < lessons.length; i++) if (isRead(lessons[i].id)) n++; return n; }
  function byId(id) { for (var i = 0; i < lessons.length; i++) if (lessons[i].id === id) return lessons[i].el; return null; }

  /* ── ۴. ساخت نوار خواندن ── */
  function buildBar() {
    bar = D.createElement("div");
    bar.className = "rd-bar no-print";
    bar.innerHTML =
      '<svg width="0" height="0" aria-hidden="true" style="position:absolute"><defs><linearGradient id="rdGrad" x1="0" y1="0" x2="1" y2="1">' +
        '<stop offset="0" stop-color="#6d5efc"/><stop offset="1" stop-color="#a855f7"/></linearGradient></defs></svg>' +
      '<div class="rd-in">' +
        '<span class="rd-book"><i data-rd-icon>📖</i><div><b data-rd-book>جزوه</b><span data-rd-sub></span></div></span>' +
        '<span class="rd-now"><b data-rd-title>—</b><span data-rd-count></span></span>' +
        '<span class="rd-nav">' +
          '<button type="button" class="rd-b" data-rd-prev aria-label="درس قبلی" title="درس قبلی (→)">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m14 6-6 6 6 6"/></svg><span>قبلی</span></button>' +
          '<button type="button" class="rd-b" data-rd-next aria-label="درس بعدی" title="درس بعدی (←)">' +
            '<span>بعدی</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m10 6 6 6-6 6"/></svg></button>' +
          '<button type="button" class="rd-b" data-rd-list title="فهرست درس‌ها">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h11"/></svg><span>درس‌ها</span></button>' +
          '<button type="button" class="rd-b" data-rd-one title="فقط همین درس">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 9h6v6H9z"/></svg></button>' +
        '</span>' +
        '<span class="rd-ring" title="پیشرفت خواندن این کتاب">' +
          '<svg viewBox="0 0 40 40"><circle class="rd-tr" cx="20" cy="20" r="16"/>' +
          '<circle class="rd-pr" cx="20" cy="20" r="16" stroke-dasharray="100.5" stroke-dashoffset="100.5"/></svg>' +
          '<b data-rd-pct>۰٪</b>' +
        '</span>' +
      '</div>';
    var host = $("main");
    host.insertBefore(bar, host.firstChild);

    $$(".rd-b[data-rd-prev]", bar)[0].addEventListener("click", function () { goto(cur - 1); });
    $$(".rd-b[data-rd-next]", bar)[0].addEventListener("click", function () { goto(cur + 1); });
    $$(".rd-b[data-rd-list]", bar)[0].addEventListener("click", openDrawer);
    $$(".rd-b[data-rd-one]", bar)[0].addEventListener("click", function () { setOne(!one()); });
  }

  /* ── ۵. حلقهٔ پیشرفت ── */
  function ring() {
    var el = $("[data-rd-pct]", bar), pr = $(".rd-pr", bar);
    if (!el || !pr) return;
    var total = lessons.length || 1;
    var pct = Math.round((readCount() / total) * 100);
    el.textContent = fa(pct) + "٪";
    var C = 2 * Math.PI * 16;
    pr.setAttribute("stroke-dasharray", C.toFixed(1));
    pr.setAttribute("stroke-dashoffset", (C * (1 - pct / 100)).toFixed(1));
  }

  /* ── ۶. به‌روزرسانی متن‌های نوار ── */
  function render() {
    if (!bar || !lessons.length) return;
    var L = lessons[cur];
    if (L) {
      $("[data-rd-title]", bar).textContent = L.t;
      var pos = L.extra ? "جمع‌بندی" : "درس " + fa(L.n) + " از " + fa(lessons.filter(function (x) { return !x.extra; }).length);
      $("[data-rd-count]", bar).textContent = pos + (L.q ? " · " + fa(L.q) + " سؤال" : "") + (isRead(L.id) ? " · خوانده‌شده ✓" : "");
      var rb = $("[data-rd-read]", bar);
      if (rb) rb.classList.toggle("rd-read", isRead(L.id));
    }
    var pv = $("[data-rd-prev]", bar), nx = $("[data-rd-next]", bar);
    if (pv) pv.disabled = cur <= 0;
    if (nx) nx.disabled = cur >= lessons.length - 1;
    $$(".rd-dw-l a", D).forEach(function (a) {
      var id = (a.getAttribute("href") || "").replace("#", "");
      a.classList.toggle("rd-cur", id === (lessons[cur] || {}).id);
      a.parentNode.classList.toggle("rd-done", isRead(id));
    });
    ring();
  }

  /* ── ۷. رفتن به یک درس ── */
  function goto(i, scroll) {
    if (!lessons.length) return;
    cur = Math.max(0, Math.min(lessons.length - 1, i));
    var L = lessons[cur];
    if (one()) L.el.classList.add("rd-cur");
    if (scroll !== false) {
      var top = L.el.getBoundingClientRect().top + (W.pageYOffset || 0) - (bar ? bar.offsetHeight + 20 : 20) - 60;
      W.scrollTo({ top: Math.max(0, top), behavior: REDUCED ? "auto" : "smooth" });
    }
    LS.set(POS_KEY, L.id);
    syncUrl(L);
    render();
    closeDrawer();
  }

  function syncUrl(L) {
    try {
      var u = new URL(location.href);
      if (one()) u.searchParams.set("ch", String(cur + 1));
      else u.searchParams.delete("ch");
      u.hash = L.id;
      history.replaceState(null, "", u.pathname + u.search + u.hash);
    } catch (e) { }
  }

  /* ── ۸. حالت «فقط همین درس» ── */
  function one() { return D.body.classList.contains("rd-one"); }
  function setOne(on) {
    D.body.classList.toggle("rd-one", on);
    LS.set(VIEW_KEY, !!on);
    var b = $("[data-rd-one]", bar);
    if (b) b.classList.toggle("rd-on", !!on);
    if (on) {
      if (lessons[cur]) lessons[cur].el.classList.add("rd-cur");
      /* در حالت تک‌درس، اولین درس را نشان بده تا کاربر سرگردان نشود */
      window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
    } else {
      lessons.forEach(function (x) { x.el.classList.remove("rd-cur"); });
    }
    syncUrl(lessons[cur] || { id: "" });
    render();
  }

  /* ── ۹. کشوی فهرست درس‌ها ── */
  function buildDrawer() {
    back = D.createElement("div");
    back.className = "rd-back";
    back.hidden = true;
    back.addEventListener("click", closeDrawer);
    D.body.appendChild(back);

    drawer = D.createElement("aside");
    drawer.className = "rd-drawer";
    drawer.setAttribute("aria-label", "فهرست درس‌ها");
    drawer.innerHTML =
      '<div class="rd-dw-h"><b data-rd-dwh>فهرست درس‌ها</b><button type="button" data-rd-close aria-label="بستن">✕</button></div>' +
      '<div class="rd-dw-s"><input type="search" data-rd-q placeholder="جست‌وجو در درس‌ها…" aria-label="جست‌وجو در درس‌ها"></div>' +
      '<ul class="rd-dw-l" data-rd-list></ul>' +
      '<div class="rd-dw-f" data-rd-foot></div>';
    D.body.appendChild(drawer);

    $("[data-rd-close]", drawer).addEventListener("click", closeDrawer);
    var inp = $("[data-rd-q]", drawer);
    inp.addEventListener("input", function () { paintList(inp.value); });
    $("[data-rd-list]", drawer).addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[href^='#']") : null;
      if (!a) return;
      e.preventDefault();
      var id = a.getAttribute("href").slice(1);
      for (var i = 0; i < lessons.length; i++) if (lessons[i].id === id) { goto(i); return; }
    });
    D.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("rd-open")) closeDrawer();
    });
  }
  function paintList(q) {
    if (!drawer) return;
    var nq = String(q || "").trim().toLowerCase();
    var rows = lessons.map(function (L, i) { return { L: L, i: i }; });
    if (nq) rows = rows.filter(function (r) { return (r.L.t + " " + r.L.b).toLowerCase().indexOf(nq) > -1; });
    var ul = $("[data-rd-list]", drawer);
    ul.innerHTML = rows.length ? rows.map(function (r) {
      var L = r.L;
      return '<li class="' + (isRead(L.id) ? "rd-done" : "") + (r.i === cur ? " rd-cur" : "") + '">' +
        '<a href="#' + esc(L.id) + '"><span class="rd-num">' + (L.extra ? "★" : fa(L.n)) + "</span>" +
        "<span>" + esc(L.t) + "</span>" +
        (L.q ? '<span class="rd-q">' + fa(L.q) + " سؤال</span>" : "") + "</a></li>";
    }).join("") : '<li style="padding:20px;text-align:center;color:var(--muted)">درسی با این واژه پیدا نشد.</li>';
    var foot = $("[data-rd-foot]", drawer);
    if (foot) foot.textContent = "خوانده‌شده: " + fa(readCount()) + " از " + fa(lessons.length) + " درس";
  }
  function openDrawer() {
    if (!drawer) return;
    paintList("");
    back.hidden = false;
    drawer.classList.add("rd-open");
    var inp = $("[data-rd-q]", drawer);
    if (inp) { inp.value = ""; setTimeout(function () { inp.focus(); }, 60); }
  }
  function closeDrawer() {
    if (!drawer) return;
    drawer.classList.remove("rd-open");
    if (back) back.hidden = true;
  }

  /* ── ۱۰. دکمهٔ «خواندم» در پایان هر درس ── */
  function endButtons() {
    for (var i = 0; i < lessons.length; i++) {
      (function (L, i) {
        if (L.el.getAttribute("data-rd-end") === "1") return;
        L.el.setAttribute("data-rd-end", "1");
        var box = D.createElement("div");
        box.className = "rd-end no-print";
        box.innerHTML = '<p><b>این درس را تمام کردی؟</b><br>با زدن دکمه، این درس در پیشرفت کتاب سبز می‌شود.</p>' +
          '<button type="button" class="rd-b" data-rd-read>خواندم</button>' +
          '<button type="button" class="rd-b" data-rd-next2>درس بعدی ←</button>';
        L.el.appendChild(box);
        box.querySelector("[data-rd-read]").addEventListener("click", function () {
          var on = !isRead(L.id);
          setRead(L.id, on);
          if (on) toast("آفرین! «" + L.t + "» خوانده شد ✓");
        });
        box.querySelector("[data-rd-next2]").addEventListener("click", function () { goto(i + 1); });
      })(lessons[i], i);
    }
  }

  /* ── ۱۱. علامت‌گذاری خودکار هنگام رسیدن به پایان درس ── */
  function autoMark() {
    if (!("IntersectionObserver" in W) || REDUCED) return;
    var last = lessons[lessons.length - 1];
    var io = new IntersectionObserver(function (ents) {
      for (var i = 0; i < ents.length; i++) {
        if (!ents[i].isIntersecting) continue;
        var L = null;
        for (var k = 0; k < lessons.length; k++) if (lessons[k].el === ents[i].target) L = lessons[k];
        if (!L || isRead(L.id)) continue;
        /* فقط وقتی تا پایان درس اسکرول کرده باشد */
        var r = L.el.getBoundingClientRect();
        if (r.top < 0) { setRead(L.id, true); }
      }
    }, { threshold: 0.6 });
    for (var i = 0; i < lessons.length; i++) io.observe(lessons[i].el);
    void last;
  }

  /* ── ۱۲. پیام کوتاه ── */
  var tb = null, tt = null;
  function toast(msg) {
    if (W.R14 && W.R14.toast) { W.R14.toast(msg); return; }
    if (!tb) { tb = D.createElement("div"); tb.style.cssText = "position:fixed;inset-inline:0;bottom:24px;z-index:700;display:flex;justify-content:center;pointer-events:none"; D.body.appendChild(tb); }
    tb.innerHTML = '<div style="padding:11px 19px;border-radius:14px;font-size:.85rem;font-weight:600;color:#fff;background:linear-gradient(135deg,#15803d,#16a34a);box-shadow:0 18px 44px -18px rgba(8,10,24,.6)">' + esc(msg) + "</div>";
    clearTimeout(tt);
    tt = setTimeout(function () { if (tb) tb.innerHTML = ""; }, 2800);
  }

  /* ── ۱۳. میان‌بُر کیبورد ── */
  function keys() {
    D.addEventListener("keydown", function (e) {
      var t = e.target, tag = t && t.tagName ? t.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select" || (t && t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); goto(cur + 1); }      /* در راست‌به‌چپ: چپ = بعدی */
      else if (e.key === "ArrowRight") { e.preventDefault(); goto(cur - 1); }
      else if (e.key === "l" || e.key === "L") { e.preventDefault(); openDrawer(); }
      else if (e.key === "o" || e.key === "O") { e.preventDefault(); setOne(!one()); }
    });
  }

  /* ── ۱۴. کارت «ادامه بده» ── */
  function resumeCard() {
    var saved = LS.get(POS_KEY, null);
    if (!saved) return;
    var idx = -1;
    for (var i = 0; i < lessons.length; i++) if (lessons[i].id === saved) idx = i;
    if (idx < 1) return;                       /* درس اول یا نامعتبر: لازم نیست */
    if (isRead(saved)) return;                 /* اگر تمامش کرده، یادآوری بی‌معنی است */
    var box = D.createElement("div");
    box.className = "rd-resume no-print";
    box.innerHTML = '<i>📌</i><div><b>ادامه از: ' + esc(lessons[idx].t) + "</b><span>قبلاً تا این درس خوانده بودی</span></div>" +
      '<button type="button" class="rd-b" data-rd-go>برو به آن درس</button>' +
      '<button type="button" class="rd-b" data-rd-x aria-label="بستن">✕</button>';
    bar.parentNode.insertBefore(box, bar.nextSibling);
    box.querySelector("[data-rd-go]").addEventListener("click", function () { box.remove(); goto(idx); });
    box.querySelector("[data-rd-x]").addEventListener("click", function () { box.remove(); });
  }

  /* ── راه‌اندازی ── */
  ready(function () {
    if (!collect()) return;

    buildBar();
    buildDrawer();
    meta(function () {
      if (META) {
        $("[data-rd-icon]", bar).textContent = META.icon || "📖";
        $("[data-rd-book]", bar).textContent = META.subject || "جزوه";
        $("[data-rd-sub]", bar).textContent = "پایهٔ " + (META.grade || "") + " · " + fa(META.chapters || lessons.length) + " درس · " + fa(META.quiz || 0) + " سؤال";
        $("[data-rd-dwh]", drawer).textContent = "درس‌های " + (META.subject || "این کتاب");
      } else {
        $("[data-rd-book]", bar).textContent = "جزوهٔ " + SLUG;
        $("[data-rd-sub]", bar).textContent = fa(lessons.length) + " درس";
      }
    });

    /* درس جاری: از ?ch= یا # یا اولین درس */
    var start = 0;
    var qs = new URLSearchParams(location.search);
    var chN = parseInt(qs.get("ch") || "", 10);
    if (chN > 0 && chN <= lessons.length) start = chN - 1;
    else if (location.hash) {
      var hid = location.hash.slice(1);
      for (var i = 0; i < lessons.length; i++) if (lessons[i].id === hid) start = i;
    }
    cur = start;

    lessons.forEach(function (L) { if (isRead(L.id)) L.el.classList.add("rd-done"); });
    var wantOne = LS.get(VIEW_KEY, false) === true || (chN > 0);
    if (wantOne) { D.body.classList.add("rd-one"); $("[data-rd-one]", bar).classList.add("rd-on"); }

    endButtons();
    if (one()) lessons[cur].el.classList.add("rd-cur");
    render();
    if (wantOne) setTimeout(function () { goto(cur, false); }, 80);
    else resumeCard();
    autoMark();
    keys();
  });
})();
