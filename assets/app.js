/* ==========================================================================
   پایهٔ هشتم — موتور تعاملی سایت  |  app.js
   تم تیره/روشن، فهرست پویا، آزمون تعاملی، پیشرفت مطالعه، جست‌وجو
   ========================================================================== */
(function () {
  "use strict";

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- ۱. تم روشن / تیره ---------- */
  var root = document.documentElement;
  var savedTheme = LS.get("g8:theme", null);
  if (!savedTheme) {
    savedTheme = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  root.setAttribute("data-theme", savedTheme);

  function syncThemeIcons() {
    var dark = root.getAttribute("data-theme") === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.setAttribute("aria-label", dark ? "حالت روشن" : "حالت تیره");
      b.innerHTML = dark
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
    });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-theme-toggle]");
    if (!t) return;
    var next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    LS.set("g8:theme", next);
    syncThemeIcons();
  });
  syncThemeIcons();

  /* ---------- ۲. منوی موبایل ---------- */
  var navToggle = document.querySelector("[data-nav-toggle]");
  if (navToggle) {
    navToggle.addEventListener("click", function () {
      var nav = document.querySelector(".header-nav");
      if (nav) nav.classList.toggle("open");
    });
    document.addEventListener("click", function (e) {
      if (!e.target.closest(".site-header")) {
        var nav = document.querySelector(".header-nav");
        if (nav) nav.classList.remove("open");
      }
    });
  }

  /* ---------- ۳. نوار پیشرفت مطالعه + دکمهٔ بالا ---------- */
  var readbar = document.getElementById("readbar");
  var toTop = document.getElementById("toTop");
  var ticking = false;

  function onScroll() {
    var h = document.documentElement.scrollHeight - window.innerHeight;
    var p = h > 0 ? Math.min(100, Math.max(0, (window.scrollY / h) * 100)) : 0;
    if (readbar) readbar.style.width = p + "%";
    if (toTop) toTop.classList.toggle("show", window.scrollY > 520);
    ticking = false;
  }
  window.addEventListener("scroll", function () {
    if (!ticking) { window.requestAnimationFrame(onScroll); ticking = true; }
  }, { passive: true });
  onScroll();

  if (toTop) toTop.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });

  /* ---------- ۴. باز/بسته کردن همهٔ پنل‌ها ---------- */
  document.addEventListener("click", function (e) {
    var open = e.target.closest("[data-expand-all]");
    var close = e.target.closest("[data-collapse-all]");
    if (open) document.querySelectorAll("details.panel").forEach(function (d) { d.open = true; });
    if (close) document.querySelectorAll("details.panel").forEach(function (d) { d.open = false; });
    var pr = e.target.closest("[data-print]");
    if (pr) window.print();
  });

  /* ---------- ۵. فهرست پویا (Scroll-Spy) ---------- */
  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  if (tocLinks.length) {
    var targets = tocLinks.map(function (a) {
      var el = document.getElementById(decodeURIComponent(a.getAttribute("href").slice(1)));
      return el ? { link: a, el: el } : null;
    }).filter(Boolean);

    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var hit = targets.filter(function (t) { return t.el === en.target; })[0];
        if (!hit) return;
        tocLinks.forEach(function (a) { a.classList.remove("is-active"); });
        hit.link.classList.add("is-active");
      });
    }, { rootMargin: "-96px 0px -70% 0px", threshold: 0 });

    targets.forEach(function (t) { spy.observe(t.el); });
  }

  /* ---------- ۶. جست‌وجو در فهرست ---------- */
  var tocSearch = document.querySelector("[data-toc-search]");
  if (tocSearch) {
    tocSearch.addEventListener("input", function () {
      var q = tocSearch.value.trim().toLowerCase();
      document.querySelectorAll(".toc li").forEach(function (li) {
        var a = li.querySelector("a");
        if (!a) { li.style.display = ""; return; }
        li.style.display = (!q || a.textContent.toLowerCase().indexOf(q) > -1) ? "" : "none";
      });
      document.querySelectorAll(".toc-group").forEach(function (g) {
        var n = g.nextElementSibling, any = false;
        while (n && !n.classList.contains("toc-group")) {
          if (n.style.display !== "none" && n.querySelector("a")) any = true;
          n = n.nextElementSibling;
        }
        g.style.display = any ? "" : "none";
      });
    });
  }

  /* ---------- ۷. آزمون تعاملی ---------- */
  document.querySelectorAll(".quiz").forEach(function (quiz) {
    var items = quiz.querySelectorAll(".quiz-item");
    var scoreBox = quiz.querySelector(".score-val");
    var totalBox = quiz.querySelector(".score-total");
    if (totalBox) totalBox.textContent = items.length;
    var answered = 0, correct = 0;

    items.forEach(function (item, idx) {
      var num = item.querySelector(".q-num");
      if (num && !num.textContent.trim()) num.textContent = (idx + 1).toLocaleString("fa-IR");
      var opts = item.querySelectorAll(".opt");
      var explain = item.querySelector(".q-explain");

      opts.forEach(function (opt) {
        opt.addEventListener("click", function () {
          if (item.dataset.locked === "1") return;
          item.dataset.locked = "1";
          var isRight = opt.hasAttribute("data-correct");
          opts.forEach(function (o) {
            o.disabled = true;
            if (o.hasAttribute("data-correct")) o.classList.add("is-ok");
            else if (o === opt) o.classList.add("is-no");
          });
          item.classList.add(isRight ? "is-correct" : "is-wrong");
          if (explain) explain.classList.add("show");
          answered++;
          if (isRight) correct++;
          if (scoreBox) scoreBox.textContent = correct.toLocaleString("fa-IR");
          var done = quiz.querySelector(".score-done");
          if (done) done.textContent = answered.toLocaleString("fa-IR");
        });
      });
    });

    var reset = quiz.querySelector("[data-quiz-reset]");
    if (reset) {
      reset.addEventListener("click", function () {
        quiz.querySelectorAll(".quiz-item").forEach(function (item) {
          delete item.dataset.locked;
          item.classList.remove("is-correct", "is-wrong");
          item.querySelectorAll(".opt").forEach(function (o) {
            o.disabled = false; o.classList.remove("is-ok", "is-no");
          });
          var ex = item.querySelector(".q-explain");
          if (ex) ex.classList.remove("show");
        });
        answered = 0; correct = 0;
        if (scoreBox) scoreBox.textContent = "۰";
        var done = quiz.querySelector(".score-done");
        if (done) done.textContent = "۰";
        quiz.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  });

  /* ---------- ۸. علامت‌گذاری درس خوانده‌شده + پیشرفت ---------- */
  var subject = document.body.getAttribute("data-subject") || "home";
  var lessons = Array.prototype.slice.call(document.querySelectorAll(".lesson[id]"));
  var fill = document.querySelector("[data-progress-fill]");
  var ptext = document.querySelector("[data-progress-text]");

  function keyOf(id) { return "g8:read:" + subject + ":" + id; }

  function refreshProgress() {
    if (!lessons.length) return;
    var done = 0;
    lessons.forEach(function (l) {
      var on = LS.get(keyOf(l.id), false);
      var btn = l.querySelector(".read-toggle");
      if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
      var tocA = document.querySelector(".toc a[href='#" + l.id + "']");
      if (tocA) tocA.classList.toggle("is-read", on);
      if (on) done++;
    });
    var pct = Math.round((done / lessons.length) * 100);
    if (fill) fill.style.width = pct + "%";
    if (ptext) ptext.textContent = pct.toLocaleString("fa-IR") + "٪";
    var cnt = document.querySelector("[data-progress-count]");
    if (cnt) cnt.textContent = done.toLocaleString("fa-IR");
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".read-toggle");
    if (!btn) return;
    var lesson = btn.closest(".lesson[id]");
    if (!lesson) return;
    var next = !LS.get(keyOf(lesson.id), false);
    LS.set(keyOf(lesson.id), next);
    refreshProgress();
  });
  refreshProgress();

  /* ---------- ۹. کلیدهای میان‌بر ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      if (tocSearch) { e.preventDefault(); tocSearch.focus(); }
    }
    if (e.key === "Escape" && tocSearch && document.activeElement === tocSearch) {
      tocSearch.value = "";
      tocSearch.dispatchEvent(new Event("input"));
      tocSearch.blur();
    }
    if (e.altKey && (e.key === "d" || e.key === "D")) {
      var t = document.querySelector("[data-theme-toggle]");
      if (t) t.click();
    }
  });

  /* ---------- ۱۰. سال جاری در پانویس ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    try { el.textContent = new Date().toLocaleDateString("fa-IR", { year: "numeric" }); } catch (e) {}
  });
})();
