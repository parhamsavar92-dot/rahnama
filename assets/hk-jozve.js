/* ==========================================================================
   رهنما — جعبهٔ ابزار جزوه روی دستگاه شخصی  |  hk-jozve.js
   وقتی یک جزوه باز می‌شود، کاربر می‌تواند همین‌جا در دستگاه خودش:
   جست‌وجو، برجسته‌سازی رنگی، یادداشت، نشان‌گذاری، ادامه از آخرین محل،
   ساخت آزمون، ساخت فلش‌کارت، خلاصه‌سازی، خواندن صوتی، حذف نویز بصری،
   تنظیم متن، خروجی Markdown/HTML/JSON، چاپ PDF، ذخیرهٔ آفلاین و پشتیبان‌گیری.
   همهٔ داده‌ها فقط روی همان دستگاه ذخیره می‌شوند.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  // فقط روی صفحه‌های جزوه/درس فعال می‌شود
  if (!D.querySelector(".toc") && !D.querySelector("article.lesson")) return;

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

  var SUBJECT = D.body.getAttribute("data-subject") || "jozve";
  var GRADE = D.body.getAttribute("data-grade") || "8";
  var PAGE = location.pathname;
  var K = {
    hl: "g8:hl:" + PAGE,
    notes: "g8:notes:" + SUBJECT,
    marks: "g8:marks",
    pos: "g8:pos:" + PAGE,
    ui: "g8:ui",
    hist: "g8:qhist:" + PAGE,
    fc: "g8:fcKnown"
  };

  /* ==================================================== ۱) نوار ابزار */
  function buildToolbar() {
    var host = $(".lesson-layout") || $("main");
    if (!host || $(".hk-tools")) return;

    var bar = D.createElement("div");
    bar.className = "hk-tools";
    bar.innerHTML =
      '<div class="hk-find">' +
        '<input type="search" data-hk-find placeholder="جست‌وجو در همین جزوه… (Enter = بعدی)">' +
        '<button class="hk-tb" data-hk-find-prev title="قبلی">↑</button>' +
        '<button class="hk-tb" data-hk-find-next title="بعدی">↓</button>' +
        '<span class="hk-status" data-hk-find-info></span>' +
      "</div>" +
      '<span class="hk-tb-sep"></span>' +
      '<button class="hk-tb" data-hk-act="quiz">آزمون بساز</button>' +
      '<button class="hk-tb" data-hk-act="fc">فلش‌کارت</button>' +
      '<button class="hk-tb" data-hk-act="summary">خلاصه</button>' +
      '<button class="hk-tb" data-hk-act="voice">خواندن صوتی</button>' +
      '<span class="hk-tb-sep"></span>' +
      '<button class="hk-tb" data-hk-act="note">یادداشت</button>' +
      '<button class="hk-tb" data-hk-act="mark">نشان‌گذاری</button>' +
      '<span class="hk-tb-sep"></span>' +
      '<button class="hk-tb" data-hk-act="focus">تمرکز</button>' +
      '<button class="hk-tb" data-hk-act="theme">سپیا</button>' +
      '<button class="hk-tb" data-hk-act="fontUp">ا+</button>' +
      '<button class="hk-tb" data-hk-act="fontDn">ا-</button>' +
      '<span class="hk-tb-sep"></span>' +
      '<button class="hk-tb" data-hk-act="export">خروجی</button>' +
      '<button class="hk-tb" data-hk-act="print">چاپ / PDF</button>';

    // نوار باید داخل ستون درس‌ها بنشیند، نه در ستون فهرست
    var firstLesson = host.querySelector("article.lesson");
    if (firstLesson) firstLesson.parentNode.insertBefore(bar, firstLesson);
    else host.insertBefore(bar, host.firstChild);

    bar.addEventListener("click", function (e) {
      var b = e.target.closest("[data-hk-act]");
      if (!b) return;
      run(b.getAttribute("data-hk-act"));
    });

    var fin = $("[data-hk-find]", bar);
    if (fin) {
      fin.addEventListener("input", function () { findRun(fin.value); });
      fin.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); findStep(e.shiftKey ? -1 : 1); }
      });
    }
    var pv = $("[data-hk-find-prev]", bar), nx = $("[data-hk-find-next]", bar);
    if (pv) pv.addEventListener("click", function () { findStep(-1); });
    if (nx) nx.addEventListener("click", function () { findStep(1); });
  }

  function run(act) {
    switch (act) {
      case "quiz": return openQuizDialog();
      case "fc": return flashcards(12);
      case "summary": return summary();
      case "voice": return voice();
      case "note": return addNotePrompt();
      case "mark": return mark();
      case "focus": return toggle("hk-focus", "uiFocus");
      case "theme": return sepia();
      case "fontUp": return font(+1);
      case "fontDn": return font(-1);
      case "export": return exportDialog();
      case "print": return printAll();
    }
  }

  function toggle(cls, key) {
    D.body.classList.toggle(cls);
    var on = D.body.classList.contains(cls);
    LS.set("g8:" + key, on);
    toast(on ? "روشن شد" : "خاموش شد");
  }
  function sepia() {
    D.body.classList.toggle("hk-sepia");
    var on = D.body.classList.contains("hk-sepia");
    LS.set(K.ui + ":sepia", on);
    toast(on ? "حالت سپیا (کاغذی) روشن شد" : "حالت سپیا خاموش شد");
  }
  function font(d) {
    var cur = LS.get(K.ui + ":font", 2);
    var next = Math.max(1, Math.min(4, cur + d));
    for (var i = 1; i <= 4; i++) D.body.classList.remove("hk-font-" + i);
    D.body.classList.add("hk-font-" + next);
    LS.set(K.ui + ":font", next);
    toast("اندازهٔ متن: " + fa(next));
  }
  function printAll() {
    $$("details.panel").forEach(function (p) { p.setAttribute("open", ""); });
    setTimeout(function () { W.print(); }, 200);
  }

  /* ============================================ ۲) جست‌وجو در جزوه */
  var hits = [], hitIdx = -1;

  function clearFind() {
    $$("mark.hk-hit").forEach(function (m) {
      var t = D.createTextNode(m.textContent);
      m.parentNode.replaceChild(t, m);
      t.parentNode.normalize();
    });
    hits = []; hitIdx = -1;
  }

  function findRun(q) {
    clearFind();
    var info = $("[data-hk-find-info]");
    q = String(q || "").trim();
    if (q.length < 2) { if (info) info.innerHTML = ""; return; }

    var lessons = $$("article.lesson");
    var needle = q.toLowerCase();
    var count = 0;

    lessons.forEach(function (lesson) {
      if (count > 220) return;
      var walker = D.createTreeWalker(lesson, NodeFilter.SHOW_TEXT, null);
      var nodes = [], n;
      while ((n = walker.nextNode())) {
        if (n.nodeValue && n.nodeValue.toLowerCase().indexOf(needle) > -1 && n.parentNode &&
            !/^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) && !n.parentNode.classList.contains("hk-hit")) {
          nodes.push(n);
        }
      }
      nodes.forEach(function (node) {
        var text = node.nodeValue, low = text.toLowerCase(), pos = 0;
        var frag = D.createDocumentFragment(), last = 0;
        while ((pos = low.indexOf(needle, pos)) > -1) {
          if (pos > last) frag.appendChild(D.createTextNode(text.slice(last, pos)));
          var m = D.createElement("mark");
          m.className = "hk-hit";
          m.textContent = text.slice(pos, pos + needle.length);
          frag.appendChild(m);
          hits.push(m);
          last = pos + needle.length;
          pos = last;
          count++;
        }
        if (last < text.length) frag.appendChild(D.createTextNode(text.slice(last)));
        node.parentNode.replaceChild(frag, node);
      });
    });

    if (info) info.innerHTML = hits.length ? "<b>" + fa(hits.length) + "</b> مورد" : "چیزی پیدا نشد";
    if (hits.length) findStep(1);
  }

  function findStep(dir) {
    if (!hits.length) return;
    if (hitIdx > -1 && hits[hitIdx]) hits[hitIdx].classList.remove("cur");
    hitIdx = (hitIdx + dir + hits.length) % hits.length;
    var el = hits[hitIdx];
    el.classList.add("cur");
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    var info = $("[data-hk-find-info]");
    if (info) info.innerHTML = "مورد <b>" + fa(hitIdx + 1) + "</b> از <b>" + fa(hits.length) + "</b>";
  }

  /* ==================================== ۳) برجسته‌سازی رنگی + یادداشت */
  var pendingSel = null;

  function buildSelMenu() {
    if ($(".hk-sel")) return;
    var menu = D.createElement("div");
    menu.className = "hk-sel";
    menu.style.display = "none";
    menu.innerHTML =
      '<button data-c="y" title="زرد">■</button>' +
      '<button data-c="g" title="سبز">■</button>' +
      '<button data-c="b" title="آبی">■</button>' +
      '<button data-c="p" title="بنفش">■</button>' +
      '<button data-a="note" title="یادداشت">✎</button>' +
      '<button data-a="copy" title="کپی">⧉</button>';
    D.body.appendChild(menu);

    menu.addEventListener("mousedown", function (e) { e.preventDefault(); });
    menu.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b || !pendingSel) return;
      var c = b.getAttribute("data-c"), a = b.getAttribute("data-a");
      if (c) highlightSelection(c);
      else if (a === "note") addNotePrompt(pendingSel.text);
      else if (a === "copy") { try { navigator.clipboard.writeText(pendingSel.text); toast("متن کپی شد"); } catch (x) {} }
      menu.style.display = "none";
      pendingSel = null;
    });
  }

  D.addEventListener("mouseup", function () { setTimeout(showSelMenu, 10); });
  D.addEventListener("touchend", function () { setTimeout(showSelMenu, 120); });

  function showSelMenu() {
    var sel = W.getSelection();
    var menu = $(".hk-sel");
    if (!menu) return;
    if (!sel || sel.isCollapsed || !sel.rangeCount) { menu.style.display = "none"; return; }
    var text = String(sel).trim();
    if (text.length < 2) { menu.style.display = "none"; return; }
    var range = sel.getRangeAt(0);
    var lesson = closestLesson(range.startContainer);
    if (!lesson) { menu.style.display = "none"; return; }
    pendingSel = { text: text, lesson: lesson };
    var r = range.getBoundingClientRect();
    menu.style.display = "flex";
    menu.style.top = (r.top + W.scrollY - 46) + "px";
    menu.style.left = Math.max(8, r.left + W.scrollX - 10) + "px";
  }

  function closestLesson(node) {
    var el = node.nodeType === 3 ? node.parentNode : node;
    while (el && el !== D.body) { if (el.classList && el.classList.contains("lesson")) return el; el = el.parentNode; }
    return null;
  }

  /** برجسته کردن متن انتخاب‌شده (اگر متنی انتخاب نشده، با agent کار می‌کند). */
  function highlightSelection(color) {
    if (!pendingSel) return false;
    var lesson = pendingSel.lesson, text = pendingSel.text;
    var arr = LS.get(K.hl, []) || [];
    var nth = arr.filter(function (h) { return h.l === lesson.id && h.t === text; }).length;
    var id = "h" + Date.now().toString(36);
    wrapOccurrence(lesson, text, nth, color, id);
    arr.push({ l: lesson.id, t: text, n: nth, c: color || "y", id: id, at: Date.now() });
    LS.set(K.hl, arr);
    toast("برجسته شد");
    try { W.getSelection().removeAllRanges(); } catch (e) {}
    return true;
  }

  function wrapOccurrence(root, text, nth, color, id) {
    var walker = D.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var full = "", nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName)) continue;
      nodes.push({ node: n, start: full.length, end: full.length + n.nodeValue.length });
      full += n.nodeValue;
    }
    var idx = -1, from = 0;
    for (var k = 0; k <= nth; k++) {
      idx = full.indexOf(text, from);
      if (idx === -1) return false;
      from = idx + text.length;
    }
    var end = idx + text.length;
    var segs = nodes.filter(function (s) { return s.end > idx && s.start < end; });
    for (var i = segs.length - 1; i >= 0; i--) {
      var s = segs[i];
      var sIdx = Math.max(0, idx - s.start);
      var eIdx = Math.min(s.node.nodeValue.length, end - s.start);
      try {
        var range = D.createRange();
        range.setStart(s.node, sIdx);
        range.setEnd(s.node, eIdx);
        var mark = D.createElement("mark");
        mark.className = "hk-hl";
        mark.setAttribute("data-c", color || "y");
        mark.setAttribute("data-hid", id);
        range.surroundContents(mark);
      } catch (e) { /* بازهٔ پیچیده — رد می‌شود */ }
    }
    return true;
  }

  D.addEventListener("click", function (e) {
    var m = e.target.closest(".hk-hl");
    if (!m || !e.altKey) return;
    var id = m.getAttribute("data-hid");
    var arr = (LS.get(K.hl, []) || []).filter(function (h) { return h.id !== id; });
    LS.set(K.hl, arr);
    var t = D.createTextNode(m.textContent);
    m.parentNode.replaceChild(t, m);
    t.parentNode.normalize();
    toast("برجسته حذف شد (برای حذف، با Alt کلیک کن)");
  });

  function restoreHighlights() {
    var arr = LS.get(K.hl, []) || [];
    arr.forEach(function (h) {
      var lesson = D.getElementById(h.l);
      if (!lesson) return;
      if ($('mark[data-hid="' + h.id + '"]')) return;
      wrapOccurrence(lesson, h.t, h.n, h.c, h.id);
    });
  }

  /* ==================================================== ۴) یادداشت‌ها */
  function addNotePrompt(prefill) {
    var lesson = currentLesson();
    var title = lesson ? (($("h2", lesson) || {}).textContent || "") : "";
    var note = LS.get(K.notes, []) || [];
    note.unshift({
      t: prefill || "",
      q: prefill || "",
      title: title,
      l: lesson ? lesson.id : "",
      at: Date.now()
    });
    LS.set(K.notes, note);
    if (W.HK && W.HK.refreshNotes) W.HK.refreshNotes();
    if (W.HK && W.HK.openPanel) W.HK.openPanel("notes");
    toast("یادداشت ساخته شد — متنش را در پنل مشاور بنویس");
  }

  function currentLesson() {
    var h = (location.hash || "").replace("#", "");
    if (h) { var el = D.getElementById(h); if (el && el.classList.contains("lesson")) return el; }
    var ls = $$("article.lesson");
    for (var i = 0; i < ls.length; i++) {
      var r = ls[i].getBoundingClientRect();
      if (r.top >= -80 && r.top < W.innerHeight) return ls[i];
    }
    return ls[0] || null;
  }

  /* ============================================ ۵) نشان‌گذاری و ادامه */
  function mark() {
    var arr = LS.get(K.marks, []) || [];
    var url = PAGE + (location.hash || "");
    if (arr.some(function (x) { return x.url === url; })) { toast("قبلاً نشان‌گذاری شده"); return; }
    arr.unshift({ url: url, title: D.title.split("—")[0].trim(), g: GRADE, at: Date.now() });
    LS.set(K.marks, arr.slice(0, 80));
    toast("نشان‌گذاری شد");
    if (W.HK && W.HK.refreshMarks) W.HK.refreshMarks();
  }

  function savePos() {
    var lesson = currentLesson();
    if (lesson) LS.set(K.pos, { id: lesson.id, y: W.scrollY, at: Date.now() });
  }
  function restorePos() {
    var p = LS.get(K.pos, null);
    if (!p || !p.id) return;
    var el = D.getElementById(p.id);
    if (el) {
      var r = el.getBoundingClientRect();
      W.scrollTo(0, Math.max(0, r.top + W.scrollY - 90));
      toast("از آخرین محلی که رها کرده بودی ادامه دادم", 2600);
    }
  }

  /* ================================================== ۶) ساخت آزمون */
  function collectMcq() {
    var out = [];
    $$("article.lesson").forEach(function (lesson) {
      var title = (($("h2", lesson) || {}).textContent || "").trim();
      $$(".quiz-item", lesson).forEach(function (it) {
        var qEl = $(".q-text", it);
        var opts = $$(".opt", it);
        if (!qEl || opts.length < 2) return;
        var correct = opts.findIndex(function (o) { return o.hasAttribute("data-correct"); });
        if (correct < 0) return;
        var ex = $(".q-explain", it);
        out.push({
          q: qEl.textContent.replace(/^[\d۰-۹.\s]+/, "").trim(),
          options: opts.map(function (o) { return o.textContent.replace(/^[\d۰-۹.\s؊]+/, "").trim(); }),
          correct: correct,
          explain: ex ? ex.textContent.replace(/^پاسخ:\s*/, "").trim() : "",
          title: title,
          lid: lesson.id
        });
      });
    });
    return out;
  }

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function openQuizDialog() {
    var all = collectMcq();
    if (!all.length) { toast("در این جزوه پرسش چهارگزینه‌ای پیدا نشد"); return; }
    var host = $(".hk-quizbox");
    if (host) host.remove();

    var box = D.createElement("div");
    box.className = "hk-quizbox";
    box.innerHTML = '<h4>آزمون ساخته‌شده از همین جزوه — ' + fa(Math.min(all.length, 20)) + ' پرسش از ' + fa(all.length) + '</h4>' +
      '<div class="hk-status"><span>پاسخ‌داده: <b data-q-done>۰</b></span><span>درست: <b data-q-ok>۰</b></span><span>امتیاز: <b class="hk-score" data-q-score>۰٪</b></span>' +
      '<button class="hk-tb" data-q-again>آزمون تازه</button></div><div data-q-body></div>';

    insertAtTop(box);
    renderQuiz(box, shuffle(all).slice(0, 20));
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-q-again]")) renderQuiz(box, shuffle(all).slice(0, 20));
    });
  }

  function renderQuiz(box, items) {
    var body = $("[data-q-body]", box);
    var state = { done: 0, ok: 0 };
    body.innerHTML = items.map(function (m, i) {
      return '<div class="hk-q-item" data-i="' + i + '">' +
        '<div class="q">' + fa(i + 1) + ') ' + esc(m.q) + "</div>" +
        '<div class="opts">' + m.options.map(function (o, j) {
          return '<button data-j="' + j + '">' + esc(o) + "</button>";
        }).join("") + "</div>" +
        '<div class="exp">' + esc(m.explain || "—") + "</div></div>";
    }).join("");

    body.onclick = function (e) {
      var b = e.target.closest("button[data-j]"); if (!b) return;
      var item = b.closest(".hk-q-item");
      if (item.classList.contains("answered")) return;
      var i = +item.getAttribute("data-i");
      var j = +b.getAttribute("data-j");
      var m = items[i];
      item.classList.add("answered");
      $$("button", item).forEach(function (x) { x.disabled = true; });
      if (j === m.correct) { b.classList.add("ok"); state.ok++; }
      else {
        b.classList.add("no");
        var c = $('button[data-j="' + m.correct + '"]', item);
        if (c) c.classList.add("ok");
      }
      state.done++;
      var pct = Math.round(state.ok / state.done * 100);
      $("[data-q-done]", box).textContent = fa(state.done);
      $("[data-q-ok]", box).textContent = fa(state.ok);
      $("[data-q-score]", box).textContent = fa(pct) + "٪";
      if (state.done === items.length) saveQuiz(state.ok, items.length);
    };
  }

  function saveQuiz(ok, total) {
    var arr = LS.get(K.hist, []) || [];
    arr.unshift({ at: Date.now(), ok: ok, total: total, pct: Math.round(ok / total * 100), page: PAGE });
    LS.set(K.hist, arr.slice(0, 60));
    var ex = LS.get("g8:exams", []) || [];
    ex.unshift({ t: Date.now(), correct: ok, total: total, pct: Math.round(ok / total * 100) });
    LS.set("g8:exams", ex.slice(0, 200));
    toast("آزمون تمام شد: " + fa(ok) + " از " + fa(total) + " — در کارنامه ثبت شد");
  }

  /* ============================================== ۷) ساخت فلش‌کارت */
  function flashcards(count) {
    var cards = [];
    $$("article.lesson").forEach(function (lesson) {
      var title = (($("h2", lesson) || {}).textContent || "").trim();
      $$(".panel-body li", lesson).forEach(function (li) {
        var t = li.textContent.trim();
        if (t.length < 12 || t.length > 220) return;
        var m = t.split(/[:：]/);
        if (m.length > 1 && m[0].length < 60) cards.push({ f: m[0].trim(), b: m.slice(1).join(":").trim(), lesson: title });
      });
      $$(".tbl tbody tr", lesson).forEach(function (tr) {
        var td = $$("td", tr);
        if (td.length >= 2) cards.push({ f: td[0].textContent.trim(), b: td[1].textContent.trim(), lesson: title });
      });
    });
    var known = LS.get(K.fc, {}) || {};
    cards = cards.filter(function (c) { return c.f && c.b && !known[c.f]; });
    if (!cards.length) { toast("فلش‌کارت تازه‌ای برای ساختن پیدا نشد"); return; }

    var host = $(".hk-quizbox"); if (host) host.remove();
    var box = D.createElement("div");
    box.className = "hk-quizbox";
    var items = shuffle(cards).slice(0, count || 12);
    box.innerHTML = "<h4>فلش‌کارت‌های همین جزوه — " + fa(items.length) + " کارت (برای دیدن پاسخ، روی کارت بزن)</h4>" +
      '<div class="hk-status"><span>مسلط: <b data-fc-ok>۰</b></span><span>مانده: <b data-fc-left>' + fa(items.length) + "</b></span>" +
      '<button class="hk-tb" data-fc-shuffle>بُر زدن</button></div><div data-fc-body></div>';
    insertAtTop(box);

    function draw(list) {
      var body = $("[data-fc-body]", box);
      var okCount = 0;
      body.innerHTML = list.map(function (c, i) {
        return '<div class="hk-fc" data-i="' + i + '"><div class="inner">' +
          '<div class="face front"><div><div style="font-size:.74rem;color:var(--muted);margin-bottom:6px">' + esc(c.lesson) + "</div>" + esc(c.f) + "</div></div>" +
          '<div class="face back">' + esc(c.b) + "</div></div></div>";
      }).join("") + '<div class="hk-status"><button class="hk-tb" data-fc-export>خروجی CSV</button></div>';

      body.addEventListener("click", function (e) {
        if (e.target.closest("[data-fc-export]")) {
          var lines = ["\uFEFFسؤال,پاسخ,درس"];
          list.forEach(function (c) { lines.push([c.f, c.b, c.lesson].map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(",")); });
          download("flashcards-" + SUBJECT + ".csv", lines.join("\n"), "text/csv;charset=utf-8");
          return;
        }
        var c = e.target.closest(".hk-fc"); if (!c) return;
        c.classList.toggle("flip");
        if (c.classList.contains("flip") && !c.dataset.counted) {
          c.dataset.counted = "1";
          var item = list[+c.getAttribute("data-i")];
          var kn = LS.get(K.fc, {}) || {};
          kn[item.f] = 1; LS.set(K.fc, kn);
          okCount++;
          var okEl = $("[data-fc-ok]", box); if (okEl) okEl.textContent = fa(okCount);
          var lfEl = $("[data-fc-left]", box); if (lfEl) lfEl.textContent = fa(list.length - okCount);
        }
      });
    }
    draw(items);
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-fc-shuffle]")) draw(shuffle(cards).slice(0, count || 12));
    });
  }

  function insertAtTop(el) {
    var host = $(".lesson-layout") || $("main");
    var first = host.querySelector("article.lesson");
    if (first) first.parentNode.insertBefore(el, first);
    else host.insertBefore(el, host.firstChild);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* =================================================== ۸) خلاصه و صدا */
  function summary() {
    var lesson = currentLesson();
    if (!lesson) { toast("درسی پیدا نشد"); return; }
    var host = $(".hk-quizbox"); if (host) host.remove();
    var title = (($("h2", lesson) || {}).textContent || "").trim();
    var points = $$(".panel-body li", lesson).slice(0, 10).map(function (l) { return l.textContent.trim(); });
    var concept = (($(".panel-body p", lesson) || {}).textContent || "").trim();
    var box = D.createElement("div");
    box.className = "hk-quizbox";
    box.innerHTML = "<h4>خلاصهٔ «" + esc(title) + "»</h4>" +
      "<p style='font-size:.88rem;line-height:1.95'>" + esc(concept.slice(0, 700)) + "</p>" +
      (points.length ? '<div class="hk-status">نکات کلیدی</div><ul style="font-size:.86rem;line-height:2;padding-inline-start:18px">' +
        points.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>" : "") +
      '<div class="hk-status"><button class="hk-tb" data-sum-read>بلند بخوان</button><button class="hk-tb" data-sum-copy>کپی خلاصه</button></div>';
    insertAtTop(box);
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-sum-read]")) speak(concept + ". " + points.join(". "));
      if (e.target.closest("[data-sum-copy]")) {
        var txt = title + "\n\n" + concept + "\n\n" + points.map(function (p, i) { return fa(i + 1) + ") " + p; }).join("\n");
        try { navigator.clipboard.writeText(txt); toast("خلاصه کپی شد"); } catch (x) {}
      }
    });
  }

  var speaking = false;
  function speak(text) {
    if (!("speechSynthesis" in W)) { toast("خواندن صوتی در این مرورگر پشتیبانی نمی‌شود"); return; }
    if (speaking) { W.speechSynthesis.cancel(); speaking = false; toast("متوقف شد"); return; }
    var u = new SpeechSynthesisUtterance(String(text).slice(0, 6000));
    u.lang = "fa-IR"; u.rate = 0.98;
    u.onend = function () { speaking = false; };
    W.speechSynthesis.speak(u);
    speaking = true;
    toast("شروع خواندن… برای توقف دوباره بزن");
  }
  function voice() { speak(collectLessonText(currentLesson())); }
  function collectLessonText(lesson) {
    if (!lesson) return "";
    return $$(".panel-body p, .panel-body li, h2", lesson).map(function (e) { return e.textContent.trim(); })
      .filter(function (t) { return t.length > 20; }).join(". ");
  }

  /* ==================================================== ۹) خروجی و چاپ */
  function exportDialog() {
    var host = $(".hk-quizbox"); if (host) host.remove();
    var box = D.createElement("div");
    box.className = "hk-quizbox";
    box.innerHTML = "<h4>خروجی گرفتن از این جزوه</h4><div class='hk-quick'>" +
      '<button class="hk-q" data-ex="md">مارک‌داون (.md)</button>' +
      '<button class="hk-q" data-ex="html">صفحهٔ HTML مستقل</button>' +
      '<button class="hk-q" data-ex="json">JSON (پرسش‌ها)</button>' +
      '<button class="hk-q" data-ex="csv">CSV پرسش‌ها</button>' +
      '<button class="hk-q" data-ex="txt">متن ساده</button>' +
      '<button class="hk-q" data-ex="print">چاپ / PDF</button>' +
      "</div><div class='hk-status'><span>همهٔ این خروجی‌ها روی همین دستگاه ساخته می‌شوند.</span></div>";
    insertAtTop(box);
    box.addEventListener("click", function (e) {
      var b = e.target.closest("[data-ex]"); if (!b) return;
      var f = b.getAttribute("data-ex");
      if (f === "print") return printAll();
      export_(f);
    });
  }

  function pageLessons() {
    return $$("article.lesson").map(function (l) {
      return {
        id: l.id,
        title: (($("h2", l) || {}).textContent || "").trim(),
        sub: (($(".lesson-sub", l) || {}).textContent || "").trim(),
        panels: $$("details.panel", l).map(function (p) {
          var s = p.querySelector("summary");
          return { label: s ? s.textContent.replace(/[▾\s]+$/, "").replace(/^[\d۰-۹]+\s*/, "").trim() : "", html: ($(".panel-body", p) || {}).innerHTML || "" };
        })
      };
    });
  }

  function export_(fmt) {
    var name = (D.title.split("—")[0] || "jozve").trim().replace(/\s+/g, "-");
    var lessons = pageLessons();

    if (fmt === "md") {
      var md = "# " + D.title.split("—")[0].trim() + "\n\n> ساخته‌شده از رهنما — " + new Date().toLocaleString("fa-IR") + "\n\n";
      lessons.forEach(function (l, i) {
        md += "## " + fa(i + 1) + ") " + l.title + "\n" + (l.sub ? "_" + l.sub + "_\n" : "") + "\n";
        l.panels.forEach(function (p) {
          md += "### " + p.label + "\n\n" + htmlToText(p.html) + "\n\n";
        });
      });
      download(name + ".md", md, "text/markdown;charset=utf-8");
      toast("فایل مارک‌داون دانلود شد");
      return;
    }

    if (fmt === "html") {
      var body = lessons.map(function (l, i) {
        return "<article><h2>" + fa(i + 1) + ") " + esc(l.title) + "</h2>" +
          (l.sub ? "<p class='sub'>" + esc(l.sub) + "</p>" : "") +
          l.panels.map(function (p) { return "<h3>" + esc(p.label) + "</h3>" + p.html; }).join("") + "</article>";
      }).join("\n");
      var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1">' +
        "<title>" + esc(D.title) + "</title><style>" +
        "body{font-family:Tahoma,system-ui,sans-serif;line-height:2;max-width:820px;margin:0 auto;padding:20px;background:#fff;color:#1b1d2b}" +
        "h2{border-bottom:2px solid #6d5efc;padding-bottom:6px;margin-top:34px}h3{color:#4b3fd0;margin-top:20px}" +
        "table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #dfe2ee;padding:7px}" +
        ".sub{color:#666}mark{background:#ffe680}li{margin:3px 0}" +
        "@media print{body{max-width:none}}" +
        "</style></head><body><h1>" + esc(D.title.split("—")[0].trim()) + "</h1>" +
        "<p style='color:#666'>فایل مستقل و آفلاین — ساخته‌شده از رهنما</p>" + body + "</body></html>";
      download(name + ".html", html, "text/html;charset=utf-8");
      toast("صفحهٔ HTML مستقل دانلود شد — آفلاین هم باز می‌شود");
      return;
    }

    var mcq = collectMcq();
    if (fmt === "json") {
      download(name + "-questions.json", JSON.stringify({ title: D.title, questions: mcq, at: new Date().toISOString() }, null, 2), "application/json;charset=utf-8");
      toast("فایل JSON دانلود شد");
      return;
    }
    if (fmt === "csv") {
      var lines = ["\uFEFFپرسش,گزینه۱,گزینه۲,گزینه۳,گزینه۴,پاسخ,توضیح"];
      mcq.forEach(function (m) {
        var o = m.options.concat(["", "", "", ""]).slice(0, 4);
        lines.push([m.q, o[0], o[1], o[2], o[3], m.options[m.correct] || "", m.explain]
          .map(function (x) { return '"' + String(x).replace(/"/g, '""') + '"'; }).join(","));
      });
      download(name + "-questions.csv", lines.join("\n"), "text/csv;charset=utf-8");
      toast("فایل CSV دانلود شد");
      return;
    }
    if (fmt === "txt") {
      var txt = D.title + "\n\n" + lessons.map(function (l, i) {
        return fa(i + 1) + ") " + l.title + "\n" + l.panels.map(function (p) { return p.label + ":\n" + htmlToText(p.html); }).join("\n\n");
      }).join("\n\n----------------\n\n");
      download(name + ".txt", txt, "text/plain;charset=utf-8");
      toast("فایل متنی دانلود شد");
    }
  }

  function htmlToText(html) {
    var d = D.createElement("div");
    d.innerHTML = String(html || "");
    $$("br", d).forEach(function (b) { b.replaceWith("\n"); });
    $$("li", d).forEach(function (li) { li.insertAdjacentText("afterbegin", "• "); });
    $$("tr", d).forEach(function (tr) {
      tr.appendChild(D.createTextNode("\n"));
      $$("td,th", tr).forEach(function (td) { td.insertAdjacentText("afterend", " | "); });
    });
    var t = d.textContent.replace(/\n{3,}/g, "\n\n").replace(/[ \t]{2,}/g, " ");
    return t.trim();
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type || "text/plain;charset=utf-8" });
    var a = D.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    D.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  /* ============================================ ۱۰) راه‌اندازی و وضعیت */
  function buildProgressBar() {
    // نوار پیشرفت موجود سایت (#readbar) استفاده می‌شود تا نوار تکراری ساخته نشود
    if (!$("#readbar")) {
      var el = D.createElement("div");
      el.id = "readbar";
      D.body.insertBefore(el, D.body.firstChild);
    }
  }
  /* نوار پیشرفت مطالعه
     ---------------------------------------------------------------------
     پیش‌تر روی «هر» رویداد اسکرول، ارتفاع کل صفحه خوانده و عرض نوار نوشته
     می‌شد؛ خواندن scrollHeight مرورگر را مجبور به محاسبهٔ دوبارهٔ چیدمان
     می‌کند و روی جزوه‌های بلند (۴۷ درس) همین باعث کندی و لَختی اسکرول بود.
     حالا: یک بار در هر فریم (requestAnimationFrame)، با ارتفاع کش‌شده که
     فقط هنگام تغییر اندازه/محتوا تازه می‌شود. */
  var _pbEl = null, _pbH = -1, _pbRaf = 0;
  function progressBar() {
    if (_pbRaf) return;
    _pbRaf = W.requestAnimationFrame(function () {
      _pbRaf = 0;
      if (!_pbEl || !_pbEl.isConnected) _pbEl = D.getElementById("readbar");
      if (!_pbEl) return;
      if (_pbH < 0) _pbH = D.documentElement.scrollHeight - W.innerHeight;
      _pbEl.style.width = (_pbH > 0 ? Math.min(100, (W.scrollY / _pbH) * 100) : 0) + "%";
    });
  }

  function applySavedUi() {
    var f = LS.get(K.ui + ":font", 0);
    if (f) { for (var i = 1; i <= 4; i++) D.body.classList.remove("hk-font-" + i); D.body.classList.add("hk-font-" + f); }
    if (LS.get(K.ui + ":sepia", false)) D.body.classList.add("hk-sepia");
    if (LS.get("g8:uiFocus", false)) D.body.classList.add("hk-focus");
    var lh = LS.get(K.ui + ":lh", 0);
    if (lh) D.body.classList.add("hk-lh-" + lh);
  }

  function boot() {
    applySavedUi();
    buildToolbar();
    buildSelMenu();
    buildProgressBar();
    restoreHighlights();
    setTimeout(restorePos, 420);

    var t0 = Date.now();
    W.addEventListener("scroll", function () { progressBar(); }, { passive: true });
    W.addEventListener("resize", function () { _pbH = -1; progressBar(); }, { passive: true });
    // هر تغییری در اندازهٔ محتوا (تغییر فونت، باز/بستن درس، بارگذاری تصویر)
    // ارتفاع کش‌شده را باطل می‌کند
    try {
      if (W.ResizeObserver) new W.ResizeObserver(function () { _pbH = -1; }).observe(D.body);
    } catch (e) { }
    W.addEventListener("beforeunload", savePos);
    setInterval(savePos, 8000);

    // کلیدهای میان‌بر برای دست باز کاربر
    D.addEventListener("keydown", function (e) {
      if (/INPUT|TEXTAREA/.test(D.activeElement.tagName)) return;
      if (e.key === "f" && e.ctrlKey) { e.preventDefault(); var i = $("[data-hk-find]"); if (i) { i.focus(); i.select(); } }
      if (e.key === "j") { var ls = $$("article.lesson"); var cur = ls.indexOf(currentLesson()); if (ls[cur + 1]) location.hash = "#" + ls[cur + 1].id; }
      if (e.key === "k") { var ls2 = $$("article.lesson"); var cur2 = ls2.indexOf(currentLesson()); if (ls2[cur2 - 1]) location.hash = "#" + ls2[cur2 - 1].id; }
      if (e.key === "p" && e.ctrlKey) { e.preventDefault(); printAll(); }
    });

    W.HK = W.HK || {};
    W.HK.jozve = {
      quiz: function (n) { var all = collectMcq(); if (!all.length) { toast("پرسشی نیست"); return; } openQuizDialog(); },
      flashcards: flashcards,
      export: export_,
      summary: summary,
      voice: voice,
      find: findRun,
      count: function () { return { lessons: $$("article.lesson").length, questions: collectMcq().length, highlights: (LS.get(K.hl, []) || []).length, minutes: Math.round((Date.now() - t0) / 60000) }; }
    };
    W.HK.highlightSelection = highlightSelection;
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
