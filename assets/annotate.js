/* ==========================================================================
   رهنما — یادداشت‌گذاری و ویرایش روی جزوه  |  annotate.js
   ابزارها: هایلایت رنگی • مداد با سایز و رنگ • ویرایش (یادداشت روی صفحه)
   ماجیک: پاک‌کن جادویی (کل خط)، پاک‌کردن درس جاری، پاک‌کردن صفحه، واگرد
   ذخیرهٔ خودکار روی همان دستگاه (localStorage) — بدون هیچ سرور
   معماری: بوم در اندازهٔ پنجره (fixed) و ترسیم با مختصات سند
   ========================================================================== */
(function () {
  "use strict";

  var G = window.G8 || {};
  var LS = G.LS || {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  var toast = G.toast || function () {};

  if (!document.querySelector(".lesson[id]")) return;

  var HL_COLORS = [["زرد", "#ffd400"], ["سبز", "#4ade80"], ["صورتی", "#fb7185"], ["آبی", "#60a5fa"], ["بنفش", "#c084fc"]];
  var PEN_COLORS = [["مشکی", "#111827"], ["سرخ", "#dc2626"], ["آبی", "#2563eb"], ["سبز", "#15803d"], ["نارنجی", "#ea580c"]];
  var NOTE_COLORS = [["زرد", "#fff3c4"], ["سبز", "#dcfce7"], ["صورتی", "#ffe4ec"], ["آبی", "#dbeafe"]];
  var HL_SIZES = [10, 16, 24];
  var PEN_SIZES = [2, 4, 7];

  var grade = (new URLSearchParams(location.search).get("g")) ||
              (LS.get("g8:grade", null)) ||
              document.body.getAttribute("data-grade") || "8";
  if (["7", "8", "9"].indexOf(grade) === -1) grade = "8";
  var KEY = "g8:ink:" + grade + ":" + location.pathname;

  var ST = {
    on: false, tool: "highlight",
    hlColor: "#ffd400", penColor: "#111827", noteColor: "#fff3c4",
    hlSize: 16, penSize: 4,
    magicScope: "stroke",          // stroke = فقط همان خط | lesson = همهٔ نشانه‌های همان درس
    strokes: [], notes: [], seq: 1
  };

  var cv, ctx, palette, notesBox, cur = null, drawing = false, raf = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  /* ---------- هندسه ---------- */
  function segDist(px, py, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    if (dx === 0 && dy === 0) return Math.hypot(px - x1, py - y1);
    var t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function hitStroke(s, x, y, tol) {
    var p = s.p;
    if (p.length === 1) return Math.hypot(x - p[0][0], y - p[0][1]) <= tol;
    for (var i = 1; i < p.length; i++) if (segDist(x, y, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]) <= tol) return true;
    return false;
  }
  function width(s) { return s.tool === "highlight" ? s.w * 2.6 : s.w; }
  function lessonAt(x, y) {
    var el = document.elementFromPoint(x - window.scrollX, y - window.scrollY);
    while (el && el !== document.body) {
      if (el.classList && el.classList.contains("lesson")) return el.id;
      el = el.parentElement;
    }
    return null;
  }

  /* ---------- رندر خط‌ها ---------- */
  function applyTf() { ctx.setTransform(dpr, 0, 0, dpr, 0, -window.scrollY * dpr); }
  function style(s) {
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.globalAlpha = s.tool === "highlight" ? 0.3 : 1;
    ctx.lineWidth = width(s);
    ctx.strokeStyle = s.c; ctx.fillStyle = s.c;
  }
  function paintStroke(s) {
    style(s);
    var p = s.p;
    ctx.beginPath();
    if (p.length === 1) { ctx.arc(p[0][0], p[0][1], width(s) / 2, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }
  function paintSeg(s, a, b) {
    style(s);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  function redraw() {
    raf = 0;
    if (!cv) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    applyTf();
    for (var i = 0; i < ST.strokes.length; i++) paintStroke(ST.strokes[i]);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(redraw); }

  function sizeCanvas() {
    var W = window.innerWidth, H = window.innerHeight;
    cv.style.width = W + "px"; cv.style.height = H + "px";
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    redraw();
  }

  function save() {
    if (!LS.set(KEY, { v: 3, s: ST.strokes, n: ST.notes, q: ST.seq }))
      toast("حافظهٔ دستگاه پر است؛ بخشی از یادداشت‌ها ذخیره نشد");
  }
  function load() {
    var d = LS.get(KEY, null);
    if (d) {
      ST.strokes = d.s || [];
      ST.notes = d.n || [];
      ST.seq = d.q || (ST.notes.length + 1);
    }
  }

  /* ---------- یادداشت‌های متنی (ویرایش) ---------- */
  function renderNotes() {
    if (!notesBox) return;
    notesBox.innerHTML = "";
    ST.notes.forEach(function (n) {
      var el = document.createElement("div");
      el.className = "ink-note-card";
      el.style.top = n.y + "px";
      el.style.left = n.x + "px";
      el.style.background = n.c || "#fff3c4";
      el.setAttribute("data-note", n.id);
      el.innerHTML = '<button class="ink-note-del" title="حذف یادداشت">×</button>' +
        '<textarea class="ink-note-body" rows="3" placeholder="یادداشت خود را بنویسید…"></textarea>';
      var ta = el.querySelector("textarea");
      ta.value = n.text || "";
      ta.addEventListener("input", function () { n.text = ta.value; save(); });
      ta.addEventListener("blur", function () { n.text = ta.value; save(); });
      el.querySelector(".ink-note-del").addEventListener("click", function (ev) {
        ev.stopPropagation();
        ST.notes = ST.notes.filter(function (x) { return x.id !== n.id; });
        renderNotes(); save(); toast("یادداشت حذف شد");
      });
      el.addEventListener("pointerdown", function (ev) { ev.stopPropagation(); });
      notesBox.appendChild(el);
    });
  }
  function addNote(x, y) {
    var n = { id: ST.seq++, x: Math.round(x), y: Math.round(y), text: "", c: ST.noteColor };
    ST.notes.push(n);
    renderNotes(); save();
    var el = notesBox.querySelector('[data-note="' + n.id + '"] textarea');
    if (el) el.focus();
  }

  /* ---------- تعامل بوم ---------- */
  function pt(e) { return [Math.round(e.pageX * 10) / 10, Math.round(e.pageY * 10) / 10]; }

  function down(e) {
    if (!ST.on) return;
    e.preventDefault();
    var p = pt(e);
    if (ST.tool === "note") { addNote(p[0], p[1]); return; }
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    if (ST.tool === "erase") { drawing = true; eraseAt(p[0], p[1]); return; }
    if (ST.strokes.length >= 600) { toast("حداکثر تعداد نشانه‌ها در این صفحه پر شده"); return; }
    cur = { tool: ST.tool, c: ST.tool === "highlight" ? ST.hlColor : ST.penColor,
            w: ST.tool === "highlight" ? ST.hlSize : ST.penSize, p: [p],
            les: lessonAt(p[0], p[1]) };
    ST.strokes.push(cur);
    drawing = true;
    paintStroke(cur);
  }
  function move(e) {
    if (!ST.on || !drawing) return;
    e.preventDefault();
    var p = pt(e);
    if (ST.tool === "erase") { eraseAt(p[0], p[1]); return; }
    if (!cur) return;
    var last = cur.p[cur.p.length - 1];
    if (Math.abs(p[0] - last[0]) < 1.2 && Math.abs(p[1] - last[1]) < 1.2) return;
    cur.p.push(p);
    paintSeg(cur, last, p);
  }
  function up() {
    if (!drawing) return;
    drawing = false;
    if (ST.tool !== "erase" && cur && cur.p.length) save();
    cur = null;
  }
  function eraseAt(x, y) {
    var before = ST.strokes.length;
    if (ST.magicScope === "lesson") {
      var id = lessonAt(x, y);
      ST.strokes = ST.strokes.filter(function (s) { return !(hitStroke(s, x, y, 16) && (!id || !s.les || s.les === id)); });
    } else {
      ST.strokes = ST.strokes.filter(function (s) { return !hitStroke(s, x, y, Math.max(12, width(s) / 2 + 6)); });
    }
    if (ST.strokes.length !== before) { redraw(); save(); }
  }

  /* ---------- پالت ---------- */
  function icon(n) {
    var p = {
      hl: '<path d="M9 14.5 4.5 19l4.5-1 1-3.5z"/><path d="M12.5 11 20 3.5l.5.5-7.5 7.5z"/><path d="M3 21h8"/>',
      pen: '<path d="M4 20h4l10-10-4-4L4 16z"/><path d="M14 6l4 4"/><path d="M4 20v-4"/>',
      note: '<path d="M5 4h9l5 5v11H5z"/><path d="M14 4v5h5"/><path d="M8 13h7M8 16h5"/>',
      magic: '<path d="M5 19 19 5"/><path d="M14 4l1.5 3L19 8.5 15.5 10 14 13l-1.5-3L9 8.5 12.5 7z"/><path d="M5 5l.8 1.7L7.5 7.5 5.8 8.3 5 10l-.8-1.7L2.5 7.5l1.7-.8z"/>',
      undo: '<path d="M9 14H5V10"/><path d="M5 14a7 7 0 1 0 7-7H5"/>',
      trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
      x: '<path d="M6 6l12 12M18 6 6 18"/>',
      broom: '<path d="M14 4l6 6"/><path d="M13 9l-7 7-3 5 5-3z"/><path d="M11 13l3 3"/>'
    };
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + (p[n] || "") + "</svg>";
  }

  function buildPalette() {
    if (palette) return;
    palette = document.createElement("div");
    palette.className = "ink-palette";
    palette.innerHTML =
      '<div class="ink-row">' +
        '<span class="lbl">ابزار</span>' +
        '<button class="ink-tool" data-ink-tool="highlight">' + icon("hl") + "<span>هایلایت</span></button>" +
        '<button class="ink-tool" data-ink-tool="pen">' + icon("pen") + "<span>مداد</span></button>" +
        '<button class="ink-tool" data-ink-tool="note">' + icon("note") + "<span>ویرایش</span></button>" +
        '<span class="ink-actions">' +
          '<button class="ink-btn" data-ink-undo>' + icon("undo") + "<span>واگرد</span></button>" +
          '<button class="ink-btn" data-ink-clear>' + icon("trash") + "<span>پاک‌کردن صفحه</span></button>" +
          '<button class="ink-btn" data-ink-exit>' + icon("x") + "<span>پایان</span></button>" +
        "</span>" +
      "</div>" +
      '<div class="ink-row">' +
        '<span class="lbl">رنگ</span><div class="ink-swatches" data-ink-swatches></div>' +
        '<span class="lbl" style="margin-inline-start:10px">ضخامت</span><div class="ink-sizes" data-ink-sizes></div>' +
      "</div>" +
      '<div class="ink-row ink-magic-row">' +
        '<span class="lbl">ماجیک</span>' +
        '<button class="ink-tool" data-ink-tool="erase">' + icon("magic") + "<span>پاک‌کن جادویی</span></button>" +
        '<button class="ink-btn" data-ink-scope="stroke">یک خط</button>' +
        '<button class="ink-btn" data-ink-scope="lesson">' + icon("broom") + "<span>همهٔ همین درس</span></button>" +
      "</div>" +
      '<div class="ink-note">با انگشت یا ماوس روی متن بکشید. <b>ویرایش</b> = گذاشتن یادداشت متنی روی صفحه؛ ' +
      'روی صفحه بزنید تا کارت یادداشت باز شود. <b>ماجیک</b>: پاک‌کن جادویی هر خطی را که لمس کند حذف می‌کند و ' +
      'می‌توانید حالت «یک خط» یا «همهٔ همین درس» را انتخاب کنید. میان‌بُرها: ' +
      '<b>H</b> هایلایت، <b>P</b> مداد، <b>N</b> ویرایش، <b>E</b> ماجیک، <b>Ctrl+Z</b> واگرد، <b>Esc</b> پایان. ' +
      'همه‌چیز خودکار روی همین دستگاه ذخیره می‌شود.</div>';
    document.body.appendChild(palette);

    palette.addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      if (b.hasAttribute("data-ink-tool")) { setTool(b.getAttribute("data-ink-tool")); return; }
      if (b.hasAttribute("data-ink-scope")) {
        ST.magicScope = b.getAttribute("data-ink-scope");
        setTool("erase");
        syncMagic();
        toast(ST.magicScope === "lesson" ? "ماجیک: همهٔ نشانه‌های درسِ لمس‌شده پاک می‌شود" : "ماجیک: فقط خطِ لمس‌شده پاک می‌شود");
        return;
      }
      if (b.hasAttribute("data-ink-undo")) {
        if (ST.strokes.length) { ST.strokes.pop(); redraw(); save(); toast("آخرین نشانه پاک شد"); }
        else toast("نشانه‌ای برای واگرد نیست");
        return;
      }
      if (b.hasAttribute("data-ink-clear")) {
        if (!ST.strokes.length && !ST.notes.length) { toast("چیزی برای پاک‌کردن نیست"); return; }
        if (confirm("همهٔ هایلایت‌ها، خط‌ها و یادداشت‌های این صفحه پاک شود؟")) {
          ST.strokes = []; ST.notes = []; redraw(); renderNotes(); save(); toast("صفحه پاک شد");
        }
        return;
      }
      if (b.hasAttribute("data-ink-exit")) setOn(false);
    });
    renderColorsSizes(); syncToolUI(); syncMagic();
  }

  function renderColorsSizes() {
    if (!palette) return;
    var isHl = ST.tool === "highlight", isNote = ST.tool === "note";
    var cols = isNote ? NOTE_COLORS : (isHl ? HL_COLORS : PEN_COLORS);
    var curC = isNote ? ST.noteColor : (isHl ? ST.hlColor : ST.penColor);
    var sizes = isHl ? HL_SIZES : PEN_SIZES;
    var curS = isHl ? ST.hlSize : ST.penSize;
    var sw = palette.querySelector("[data-ink-swatches]");
    var sz = palette.querySelector("[data-ink-sizes]");
    if (sw) {
      sw.innerHTML = cols.map(function (c) {
        return '<button class="ink-sw' + (c[1] === curC ? " on" : "") + '" data-ink-color="' + c[1] + '" title="' + c[0] + '" style="background:' + c[1] + '"></button>';
      }).join("");
    }
    var row = sz && sz.closest(".ink-row");
    if (row) row.style.display = (isNote || ST.tool === "erase") ? "none" : "";
    if (sz && !isNote) {
      sz.innerHTML = sizes.map(function (s, i) {
        return '<button class="ink-size' + (s === curS ? " on" : "") + '" data-ink-size="' + s + '" title="ضخامت ' + (i + 1) +
          '"><i style="width:' + (4 + i * 5) + 'px;height:' + (4 + i * 5) + 'px"></i></button>';
      }).join("");
    }
  }
  function syncToolUI() {
    if (!palette) return;
    palette.querySelectorAll("[data-ink-tool]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-ink-tool") === ST.tool);
    });
  }
  function syncMagic() {
    if (!palette) return;
    palette.querySelectorAll("[data-ink-scope]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-ink-scope") === ST.magicScope);
    });
  }
  function setTool(t) {
    ST.tool = t;
    document.body.classList.toggle("ink-erase", t === "erase");
    document.body.classList.toggle("ink-note-tool", t === "note");
    renderColorsSizes(); syncToolUI();
  }

  function setOn(v) {
    ST.on = v;
    document.body.classList.toggle("ink-on", v);
    var tb = document.querySelector('[data-tb="ink"]');
    if (tb) tb.classList.toggle("is-active", v);
    if (v) { sizeCanvas(); toast("حالت یادداشت روشن شد — با انگشت یا ماوس روی جزوه بکش"); }
    else { save(); document.body.classList.remove("ink-erase", "ink-note-tool"); }
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-ink-color],[data-ink-size]");
    if (b) {
      if (b.hasAttribute("data-ink-color")) {
        var col = b.getAttribute("data-ink-color");
        if (ST.tool === "note") ST.noteColor = col;
        else if (ST.tool === "highlight") ST.hlColor = col;
        else ST.penColor = col;
      } else {
        var v = parseInt(b.getAttribute("data-ink-size"), 10);
        if (ST.tool === "highlight") ST.hlSize = v; else ST.penSize = v;
      }
      renderColorsSizes();
      return;
    }
    if (e.target.closest('[data-tb="ink"]')) setOn(!ST.on);
  });

  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (/input|textarea|select/.test(tag)) return;
    if (e.key === "Escape" && ST.on) setOn(false);
    if (ST.on && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault(); if (ST.strokes.length) { ST.strokes.pop(); redraw(); save(); }
    }
    if (!ST.on || e.ctrlKey || e.metaKey) return;
    var k = e.key.toLowerCase();
    if (k === "h") setTool("highlight");
    if (k === "p") setTool("pen");
    if (k === "n") setTool("note");
    if (k === "e") setTool("erase");
  });

  /* ---------- راه‌اندازی ---------- */
  function init() {
    cv = document.createElement("canvas");
    cv.id = "inkCanvas";
    document.body.appendChild(cv);
    ctx = cv.getContext("2d");

    notesBox = document.createElement("div");
    notesBox.id = "inkNotes";
    document.body.appendChild(notesBox);

    load();
    sizeCanvas();
    buildPalette();
    setTool(ST.tool);
    renderNotes();

    cv.addEventListener("pointerdown", down);
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerup", up);
    cv.addEventListener("pointercancel", up);
    window.addEventListener("scroll", schedule, { passive: true });
    var t = 0;
    window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(sizeCanvas, 200); });

    var P = new URLSearchParams(location.search);
    if (P.get("ink") === "1" || location.hash === "#ink") setTimeout(function () { setOn(true); }, 250);
    if (P.get("inkdemo") === "1") {
      setTimeout(function () {
        ST.on = true; document.body.classList.add("ink-on");
        ST.strokes.push({ tool: "highlight", c: ST.hlColor, w: ST.hlSize, p: [[110, 400], [320, 422], [560, 400]], les: null });
        ST.strokes.push({ tool: "pen", c: "#dc2626", w: 7, p: [[110, 480], [320, 520], [560, 492]], les: null });
        ST.notes.push({ id: 9001, x: 140, y: 560, text: "یادداشت نمونه", c: ST.noteColor });
        redraw(); renderNotes();
        document.title = "INKDRAW:" + ST.strokes.length + ":" + ST.notes.length + ":" + ST.tool;
      }, 500);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 60); });
  else setTimeout(init, 60);
})();
