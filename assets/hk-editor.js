/* ==========================================================================
   رهنما — ویرایشگر جزوه مثل Adobe Acrobat  |  assets/hk-editor.js
   ابزارها: افزودن متن، یادداشت چسبان، ماژیک نشانه‌گذاری، قلم آزاد، پاک‌کن،
            جابه‌جایی و تغییر اندازه، واگرد/ازنو، پنهان‌کردن نشانه‌ها، خروجی PDF
   ذخیره: خودکار در localStorage با کلید g8:… روی همان دستگاه + همگام‌سازی
          خودکار با حساب کاربری (hk-auth هر کلید g8: را به سرور می‌فرستد)
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(m, ms) { if (W.HK && W.HK.toast) W.HK.toast(m, ms); }
  function LSget(k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }
  function LSset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function uid() { return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  var COLORS = [
    { id: "yellow", bg: "#ffe066", ink: "#f2b705" },
    { id: "green", bg: "#a8e6a1", ink: "#2e9e4f" },
    { id: "pink", bg: "#ffb3c8", ink: "#e0466f" },
    { id: "blue", bg: "#a8d8ff", ink: "#2b7fd4" },
  ];

  var E = {
    on: false, tool: "select", color: COLORS[0], inkW: 3,
    host: null, layer: null, canvas: null, ctx: null, dpr: 1,
    items: [], sel: null, undoS: [], redoS: [], hidden: false,
    drag: null, saveT: 0, dirty: false, key: "",
  };

  var T = {};   // متن‌های رابط

  function gradeOf() {
    var g = null;
    try { g = JSON.parse(localStorage.getItem("g8:grade")); } catch (e) {}
    return String(g || (D.body && D.body.getAttribute("data-grade")) || "8");
  }

  /* ------------------------------------------------------------- ذخیره */
  function load() {
    E.key = "g8:edit:" + gradeOf() + ":" + location.pathname;
    var d = LSget(E.key, null);
    E.items = (d && Array.isArray(d.items)) ? d.items : [];
    T.updatedAt = (d && d.at) || 0;
  }

  function markDirty() {
    E.dirty = true;
    var s = $(".hk-ed-save");
    if (s) { s.textContent = "ذخیره‌نشده…"; s.classList.add("is-dirty"); }
    if (E.saveT) clearTimeout(E.saveT);
    E.saveT = setTimeout(save, 700);
  }

  function save() {
    var ok = LSset(E.key, { items: E.items, at: Date.now() });
    E.dirty = !ok;
    var s = $(".hk-ed-save");
    if (s) {
      s.classList.remove("is-dirty");
      s.textContent = ok ? "ذخیره شد ✓ (روی همهٔ دستگاه‌ها هم‌گام می‌شود)" : "حافظهٔ مرورگر پر است";
    }
  }

  function pushUndo() {
    E.undoS.push(JSON.stringify(E.items));
    if (E.undoS.length > 40) E.undoS.shift();
    E.redoS.length = 0;
  }
  function undo() {
    if (!E.undoS.length) return toast("چیزی برای واگرد نیست.");
    E.redoS.push(JSON.stringify(E.items));
    E.items = JSON.parse(E.undoS.pop());
    E.sel = null; render(); markDirty();
  }
  function redo() {
    if (!E.redoS.length) return toast("چیزی برای ازنو نیست.");
    E.undoS.push(JSON.stringify(E.items));
    E.items = JSON.parse(E.redoS.pop());
    E.sel = null; render(); markDirty();
  }

  /* ------------------------------------------------------------- رسم */
  /* سقف مجموع پیکسل‌های قلمرو. صفحه‌های جزوه می‌توانند ده‌ها هزار پیکسل بلند
     باشند؛ اگر قلمرو به اندازهٔ کل صفحه و با کیفیت کامل ساخته شود، روی گوشی
     صدها مگابایت حافظه می‌گیرد و اسکرول را قفل می‌کند.
     قلمرو فقط وقتی ساخته می‌شود که واقعاً نوشته‌ای وجود داشته باشد و مقیاسش
     طوری کم می‌شود که از این سقف رد نشود. */
  var MAX_CANVAS_PIXELS = 3500000;

  function ensureCanvas() {
    if (E.canvas || !E.layer) return E.canvas;
    var cv = D.createElement("canvas");
    cv.className = "hk-ann-ink";
    E.layer.insertBefore(cv, E.layer.firstChild);
    E.canvas = cv;
    E.ctx = cv.getContext("2d", { alpha: true });
    return cv;
  }

  function dropCanvas() {
    if (!E.canvas) return;
    if (inkItems().length) return;      // اگر نوشته‌ای هست، قلمرو می‌ماند تا دیده شود
    if (E.canvas.parentNode) E.canvas.parentNode.removeChild(E.canvas);
    E.canvas = null;
    E.ctx = null;
  }

  function sizeLayer() {
    if (!E.host || !E.layer) return;
    var w = E.host.offsetWidth, h = E.host.offsetHeight;
    E.layer.style.width = w + "px";
    E.layer.style.height = h + "px";
    var dpr = Math.min(W.devicePixelRatio || 1, 2);
    if (E.canvas) {
      var maxScale = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, w * h));
      E.dpr = Math.max(0.15, Math.min(dpr, maxScale));
      E.canvas.width = Math.max(1, Math.round(w * E.dpr));
      E.canvas.height = Math.max(1, Math.round(h * E.dpr));
      E.canvas.style.width = w + "px";
      E.canvas.style.height = h + "px";
      drawInk();
    }
  }

  function inkItems() { return E.items.filter(function (i) { return i.kind === "ink"; }); }

  function drawInk() {
    if (!E.ctx) return;
    var c = E.ctx;
    c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    c.clearRect(0, 0, E.canvas.width, E.canvas.height);
    c.lineCap = "round";
    c.lineJoin = "round";
    inkItems().forEach(function (s) {
      if (!s.pts || s.pts.length < 2) return;
      c.strokeStyle = s.color || "#f2b705";
      c.lineWidth = s.w || 3;
      c.globalAlpha = 1;
      c.beginPath();
      c.moveTo(s.pts[0][0], s.pts[0][1]);
      for (var i = 1; i < s.pts.length; i++) c.lineTo(s.pts[i][0], s.pts[i][1]);
      c.stroke();
    });
  }

  function render() {
    if (!E.layer) return;
    if (inkItems().length) ensureCanvas();     // فقط اگر نوشته‌ای هست، قلمرو ساخته می‌شود
    var keepInk = E.layer.querySelector("canvas");
    E.layer.innerHTML = "";
    if (keepInk) E.layer.appendChild(keepInk);

    E.items.forEach(function (it) {
      if (it.kind === "ink") return;
      var el = D.createElement("div");
      el.className = "hk-ann " + (it.kind === "note" ? "hk-ann-note" : it.kind === "rect" ? "hk-ann-rect" : "hk-ann-text");
      el.setAttribute("data-id", it.id);
      el.style.left = it.x + "px";
      el.style.top = it.y + "px";
      if (it.kind === "rect") {
        el.style.width = it.w + "px";
        el.style.height = it.h + "px";
        el.style.background = (it.color || "#ffe066");
        el.style.opacity = String(it.opacity == null ? 0.42 : it.opacity);
      } else {
        if (it.w) el.style.width = it.w + "px";
        if (it.h) el.style.minHeight = it.h + "px";
        el.textContent = it.text || "";
        if (E.on) el.setAttribute("contenteditable", "true");
      }
      if (E.sel === it.id) el.classList.add("is-sel");

      if (E.on) {
        var del = D.createElement("button");
        del.className = "hk-ann-del";
        del.type = "button";
        del.setAttribute("data-del", it.id);
        del.setAttribute("aria-label", "پاک کردن");
        del.textContent = "✕";
        el.appendChild(del);
        if (it.kind !== "rect") {
          var h = D.createElement("span");
          h.className = "hk-ann-handle";
          h.setAttribute("data-handle", it.id);
          el.appendChild(h);
        }
      }
      E.layer.appendChild(el);
    });
    if (E.hidden) E.layer.style.display = "none";
    dropCanvas();                              // صفحه‌های بدون نوشته، هیچ حافظه‌ای نمی‌گیرند
  }

  /* ------------------------------------------------------ ابزار و رویدادها */
  function hostPoint(e) {
    var r = E.host.getBoundingClientRect();
    return { x: Math.round(e.clientX - r.left), y: Math.round(e.clientY - r.top) };
  }

  function hitAt(x, y) {
    for (var i = E.items.length - 1; i >= 0; i--) {
      var it = E.items[i];
      if (it.kind === "ink") {
        var pts = it.pts || [];
        for (var k = 0; k < pts.length; k++) {
          var dx = pts[k][0] - x, dy = pts[k][1] - y;
          if (dx * dx + dy * dy < 140) return it;
        }
        continue;
      }
      var w = it.kind === "rect" ? it.w : (it.w || 190);
      var h = it.kind === "rect" ? it.h : (it.h || 40);
      if (x >= it.x && x <= it.x + w && y >= it.y && y <= it.y + h) return it;
    }
    return null;
  }

  function addItem(kind, x, y, extra) {
    pushUndo();
    var it = Object.assign({ id: uid(), kind: kind, x: x, y: y }, extra || {});
    if (kind === "text") { it.text = ""; it.w = 240; }
    if (kind === "note") { it.text = ""; it.w = 190; it.h = 74; }
    if (kind === "rect") { it.color = E.color.bg; it.opacity = 0.42; }
    if (kind === "ink") { it.color = E.color.ink; it.w = E.inkW; it.pts = [[x, y]]; }
    E.items.push(it);
    render();
    E.sel = it.id;
    return it;
  }

  var drawing = null;

  function onDown(e) {
    if (!E.on || e.button !== 0) return;
    if (e.target.closest(".hk-ann-del") || e.target.closest(".hk-ann-handle")) return;
    if (e.target.closest("[contenteditable='true']") && E.tool === "select") return;
    var p = hostPoint(e);

    if (E.tool === "eraser") {
      var hit = hitAt(p.x, p.y);
      if (hit) {
        pushUndo();
        E.items = E.items.filter(function (i) { return i.id !== hit.id; });
        render(); markDirty(); sizeLayer();
        toast("نشانه پاک شد.");
      }
      return;
    }
    if (E.tool === "text" || E.tool === "note") {
      var it = addItem(E.tool, p.x, p.y);
      markDirty();
      var el = E.layer.querySelector('[data-id="' + it.id + '"]');
      if (el) { el.focus(); }
      setTool("select");
      return;
    }
    if (E.tool === "mark") {
      drawing = { kind: "rect", x: p.x, y: p.y };
      return;
    }
    if (E.tool === "pen") {
      drawing = addItem("ink", p.x, p.y);
      markDirty();
      return;
    }
    // انتخاب/جابه‌جایی
    var target = e.target.closest(".hk-ann");
    if (target) {
      var id = target.getAttribute("data-id");
      var item = E.items.filter(function (i) { return i.id === id; })[0];
      E.sel = id;
      if (item) {
        if (e.target.closest(".hk-ann-handle")) drawing = { kind: "resize", item: item, sx: p.x, sy: p.y, w0: item.w || 190, h0: item.h || 74 };
        else drawing = { kind: "move", item: item, dx: p.x - item.x, dy: p.y - item.y };
        pushUndo();
      }
      render();
    } else { E.sel = null; render(); }
  }

  function onMove(e) {
    if (!drawing) return;
    var p = hostPoint(e);
    if (drawing.kind === "rect") {
      var x = Math.min(drawing.x, p.x), y = Math.min(drawing.y, p.y);
      var w = Math.abs(p.x - drawing.x), h = Math.abs(p.y - drawing.y);
      var tmp = E.items.filter(function (i) { return i.__tmp; })[0];
      if (!tmp) {
        tmp = { id: uid(), kind: "rect", __tmp: true, color: E.color.bg, opacity: 0.42 };
        E.items.push(tmp);
      }
      tmp.x = x; tmp.y = y; tmp.w = Math.max(6, w); tmp.h = Math.max(6, h);
      render();
      return;
    }
    if (drawing.kind === "pen" && drawing.pts) {
      drawing.pts.push([p.x, p.y]);
      drawInkLive();
      return;
    }
    if (drawing.kind === "move") {
      drawing.item.x = Math.max(0, p.x - drawing.dx);
      drawing.item.y = Math.max(0, p.y - drawing.dy);
      render();
      return;
    }
    if (drawing.kind === "resize") {
      drawing.item.w = Math.max(70, drawing.w0 + (p.x - drawing.sx));
      if (drawing.item.kind !== "text") drawing.item.h = Math.max(40, drawing.h0 + (p.y - drawing.sy));
      render();
    }
  }

  function drawInkLive() {
    if (!E.ctx || !drawing || !drawing.pts) return;
    drawInk();
    var c = E.ctx;
    c.setTransform(E.dpr, 0, 0, E.dpr, 0, 0);
    c.strokeStyle = drawing.color || "#f2b705";
    c.lineWidth = drawing.w || 3;
    c.lineCap = "round";
    c.beginPath();
    var pts = drawing.pts;
    c.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
    c.stroke();
  }

  function onUp() {
    if (!drawing) return;
    if (drawing.kind === "rect") {
      var tmp = E.items.filter(function (i) { return i.__tmp; })[0];
      if (tmp) {
        delete tmp.__tmp;
        if (tmp.w < 8 || tmp.h < 8) E.items = E.items.filter(function (i) { return i !== tmp; });
        E.sel = tmp.id;
      }
      markDirty();
    }
    if (drawing.kind === "pen") markDirty();
    if (drawing.kind === "move" || drawing.kind === "resize") markDirty();
    drawing = null;
    render();
    sizeLayer();
  }

  function onClick(e) {
    var del = e.target.closest && e.target.closest(".hk-ann-del");
    if (del && E.on) {
      var id = del.getAttribute("data-del");
      pushUndo();
      E.items = E.items.filter(function (i) { return i.id !== id; });
      render(); markDirty(); sizeLayer();
      e.stopPropagation();
      return;
    }
    var el = e.target.closest && e.target.closest(".hk-ann");
    if (el && E.on) { E.sel = el.getAttribute("data-id"); }
  }

  function onInput(e) {
    var el = e.target.closest && e.target.closest(".hk-ann");
    if (!el || !E.on) return;
    var id = el.getAttribute("data-id");
    var it = E.items.filter(function (i) { return i.id === id; })[0];
    if (!it) return;
    it.text = el.innerText.replace(/\n{3,}/g, "\n\n").slice(0, 4000);
    markDirty();
  }

  function onKey(e) {
    if (!E.on) return;
    var inEdit = e.target && e.target.closest && e.target.closest("[contenteditable='true']");
    if (e.key === "Escape") { setTool("select"); if (inEdit) e.target.blur(); return; }
    if ((e.key === "Delete" || e.key === "Backspace") && E.sel && !inEdit) {
      pushUndo();
      E.items = E.items.filter(function (i) { return i.id !== E.sel; });
      E.sel = null; render(); markDirty(); sizeLayer();
      e.preventDefault();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    }
  }

  /* ------------------------------------------------------------ نوار ابزار */
  var TOOLS = [
    { id: "select", label: "✥ جابه‌جایی", title: "انتخاب، جابه‌جایی و تغییر اندازه" },
    { id: "text", label: "✎ متن", title: "افزودن کادر متنی روی جزوه" },
    { id: "note", label: "🗒 یادداشت", title: "یادداشت چسبان" },
    { id: "mark", label: "🖍 ماژیک", title: "کشیدن نشانه‌گذاری روی متن" },
    { id: "pen", label: "🖊 قلم", title: "نوشتن آزاد با قلم" },
    { id: "eraser", label: "⌫ پاک‌کن", title: "پاک کردن نشانه‌ها" },
  ];

  function buildBar() {
    var bar = D.createElement("div");
    bar.className = "hk-ed-bar";
    bar.hidden = true;
    bar.innerHTML =
      '<span class="hk-ed-title">◆ ویرایشگر جزوه</span>' +
      TOOLS.map(function (t) {
        return '<button type="button" class="hk-ed-tool' + (t.id === "select" ? " is-on" : "") +
          '" data-tool="' + t.id + '" title="' + t.title + '">' + t.label + "</button>";
      }).join("") +
      '<span class="hk-tb-sep"></span>' +
      '<span class="hk-ed-colors">' + COLORS.map(function (c) {
        return '<button type="button" data-color="' + c.id + '" title="رنگ ' + c.id +
          '" style="background:' + c.bg + '"' + (c.id === COLORS[0].id ? ' class="is-on"' : "") + "></button>";
      }).join("") + "</span>" +
      '<span class="hk-tb-sep"></span>' +
      '<button type="button" class="hk-ed-tool" data-act="undo" title="واگرد (Ctrl+Z)">↶</button>' +
      '<button type="button" class="hk-ed-tool" data-act="redo" title="ازنو (Ctrl+Shift+Z)">↷</button>' +
      '<button type="button" class="hk-ed-tool" data-act="hide" title="پنهان/نمایش نشانه‌ها">👁 پنهان</button>' +
      '<button type="button" class="hk-ed-tool" data-act="wipe" title="پاک کردن همهٔ نشانه‌ها">🗑 همه</button>' +
      '<span class="hk-tb-sep"></span>' +
      '<button type="button" class="hk-ed-tool" data-act="pdf" title="خروجی PDF با نشانه‌ها">🖨 خروجی PDF</button>' +
      '<button type="button" class="hk-ed-tool" data-act="save" title="ذخیرهٔ فوری">💾 ذخیره</button>' +
      '<span class="hk-tb-sep"></span>' +
      '<button type="button" class="hk-ed-tool" data-act="docon" title="ویرایش خودِ متن جزوه (مثل Acrobat)">📝 ویرایش متن</button>' +
      '<button type="button" class="hk-ed-tool" data-act="docreset" title="بازگردانی متن اصلی جزوه">↺ اصلی</button>' +
      '<button type="button" class="hk-ed-tool" data-act="exit">✕ پایان ویرایش</button>' +
      '<span class="hk-ed-save">آماده</span>';
    D.body.appendChild(bar);
    return bar;
  }

  function setTool(id) {
    E.tool = id;
    D.body.classList.toggle("hk-tool-select", id === "select");
    D.body.classList.toggle("hk-tool-eraser", id === "eraser");
    $$(".hk-ed-tool[data-tool]").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-tool") === id);
    });
  }

  function setColor(id) {
    var c = COLORS.filter(function (x) { return x.id === id; })[0] || COLORS[0];
    E.color = c;
    $$(".hk-ed-colors button").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-color") === id);
    });
    var sel = E.items.filter(function (i) { return i.id === E.sel; })[0];
    if (sel && (sel.kind === "rect" || sel.kind === "ink")) {
      pushUndo();
      sel.color = sel.kind === "rect" ? c.bg : c.ink;
      render(); drawInk(); markDirty();
    }
  }

  /* ================= ویرایش خودِ متن جزوه (مثل Acrobat) =================
     متن هر بخش درس قابل ویرایش می‌شود و فقط بخش‌هایی که تغییر کرده‌اند ذخیره
     می‌شوند (تا حافظهٔ دستگاه پر نشود). کلید ذخیره با g8: شروع می‌شود، پس
     سیستم حساب کاربری خودش آن را با سرور هم‌گام می‌کند. */
  var DOC_KEY = "g8:editdoc:" + location.pathname;
  var docBase = [];
  var docT = 0;

  function docStore() {
    try { return JSON.parse(localStorage.getItem(DOC_KEY) || "null") || {}; }
    catch (e) { return {}; }
  }
  function docWrite(obj) {
    try { localStorage.setItem(DOC_KEY, JSON.stringify(obj)); return true; }
    catch (e) { toast("حجم ویرایش‌ها زیاد شد؛ بخشی ذخیره نشد.", 4200); return false; }
  }
  function applyDocEdits() {
    var st = docStore();
    var keys = Object.keys(st);
    if (!keys.length) return;
    var arts = $$("article.lesson");
    var n = 0;
    keys.forEach(function (k) {
      var a = arts[Number(k)];
      if (a) { a.innerHTML = st[k]; n++; }
    });
    if (n) toast("نسخهٔ ویرایش‌شدهٔ تو بارگذاری شد (" + n + " بخش).", 3200);
  }
  function docOn() {
    docBase = $$("article.lesson").map(function (a) { return a.innerHTML; });
    D.body.classList.add("hk-docedit");
    $$("article.lesson").forEach(function (a) { a.setAttribute("contenteditable", "true"); });
    toast("متن جزوه قابل ویرایش شد. تغییرها خودکار ذخیره می‌شوند.", 4200);
  }
  function docOff() {
    docFlush();
    D.body.classList.remove("hk-docedit");
    $$("article.lesson").forEach(function (a) { a.removeAttribute("contenteditable"); });
    toast("ویرایش متن بسته شد.");
  }
  function docFlush() {
    if (!D.body.classList.contains("hk-docedit")) return;
    var st = docStore();
    var arts = $$("article.lesson");
    arts.forEach(function (a, i) {
      if (a.innerHTML !== docBase[i]) st[i] = a.innerHTML;
      else delete st[i];
    });
    var ok = docWrite(st);
    var s = $(".hk-ed-save");
    if (s) s.textContent = ok ? "متن ذخیره شد" : "ذخیره ناقص";
  }
  function docReset() {
    if (!W.confirm("متن اصلی جزوه برگردد؟ ویرایش‌های متنی تو پاک می‌شود (نشانه‌ها دست‌نخورده می‌مانند).")) return;
    try { localStorage.removeItem(DOC_KEY); } catch (e) {}
    W.location.reload();
  }

  function enter() {
    E.on = true;
    D.body.classList.add("hk-editing");
    setTool("select");
    var bar = $(".hk-ed-bar");
    if (bar) bar.hidden = false;
    var fab = $(".hk-ed-fab");
    if (fab) fab.hidden = true;
    render();
    sizeLayer();
    toast("حالت ویرایش روشن شد: متن، یادداشت، ماژیک و قلم در اختیار توست.");
  }

  function exit() {
    E.on = false;
    E.sel = null;
    D.body.classList.remove("hk-editing", "hk-tool-select", "hk-tool-eraser");
    var bar = $(".hk-ed-bar");
    if (bar) bar.hidden = true;
    var fab = $(".hk-ed-fab");
    if (fab) fab.hidden = false;
    render();
    sizeLayer();
    save();
    toast("حالت ویرایش بسته شد. نشانه‌ها ذخیره شدند.");
  }

  function wipe() {
    if (!E.items.length) return toast("چیزی برای پاک‌کردن نیست.");
    if (!W.confirm("همهٔ نشانه‌ها و نوشته‌های این جزوه پاک شود؟")) return;
    pushUndo();
    E.items = [];
    E.sel = null;
    render(); drawInk(); markDirty();
    toast("همه پاک شد. اگر پشیمانی، واگرد بزن.");
  }

  function bindBar(bar) {
    bar.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tool], [data-act], [data-color]");
      if (!t) return;
      var tool = t.getAttribute("data-tool");
      if (tool) { setTool(tool); return; }
      var col = t.getAttribute("data-color");
      if (col) { setColor(col); return; }
      var act = t.getAttribute("data-act");
      if (act === "undo") return undo();
      if (act === "redo") return redo();
      if (act === "save") { save(); return toast("ذخیره شد."); }
      if (act === "wipe") return wipe();
      if (act === "exit") return exit();
      if (act === "hide") {
        E.hidden = !E.hidden;
        t.textContent = E.hidden ? "👁 نمایش" : "👁 پنهان";
        E.layer.style.display = E.hidden ? "none" : "";
        return;
      }
      if (act === "docon") {
        if (D.body.classList.contains("hk-docedit")) docOff(); else docOn();
        t.classList.toggle("is-on", D.body.classList.contains("hk-docedit"));
        return;
      }
      if (act === "docreset") return docReset();
      if (act === "pdf") {
        E.sel = null;
        render();
        // سرصفحهٔ موقت چاپ: نام جزوه، پایه و تاریخ — تا PDF تمیز و شناسنامه‌دار باشد
        var head = D.createElement("div");
        head.className = "hk-ed-print-head";
        var t = ($("h1") || {}).innerText || D.title.replace(/\s*\|.*$/, "");
        var d = new Date();
        var faN = function (n) { return String(n).replace(/\d/g, function (x) { return "۰۱۲۳۴۵۶۷۸۹"[+x]; }); };
        head.innerHTML = "<b>" + esc(String(t).trim()) + "</b><span>رهنما · پایهٔ " +
          ({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[gradeOf()] || gradeOf()) + " · " +
          faN(d.getFullYear() + "/" + (d.getMonth() + 1) + "/" + d.getDate()) + " · rahnama</span>";
        D.body.insertBefore(head, D.body.firstChild);
        toast("پنجرهٔ چاپ باز می‌شود؛ «Save as PDF» را بزن تا PDF با نشانه‌ها ذخیره شود.", 5200);
        setTimeout(function () {
          W.print();
          setTimeout(function () { if (head.parentNode) head.parentNode.removeChild(head); }, 1500);
        }, 400);
      }
    });
  }

  /* ------------------------------------------------------------- راه‌اندازی */
  function boot() {
    var host = $(".lesson-layout") || $("main");
    if (!host || !host.querySelector("article.lesson")) return;

    load();
    E.host = host;
    if (getComputedStyle(host).position === "static") host.style.position = "relative";

    var layer = D.createElement("div");
    layer.className = "hk-ann-layer";
    layer.setAttribute("data-hk-ann", "1");
    host.appendChild(layer);

    E.layer = layer;
    E.canvas = null;                    // قلمرو فقط در صورت نیاز ساخته می‌شود
    E.ctx = null;

    var fab = D.createElement("button");
    fab.type = "button";
    fab.className = "hk-ed-fab";
    fab.innerHTML = "✎ ویرایش جزوه";
    fab.title = "ویرایش مثل Acrobat: متن، یادداشت، ماژول و قلم";
    fab.addEventListener("click", enter);
    D.body.appendChild(fab);

    var bar = buildBar();
    bindBar(bar);

    layer.addEventListener("pointerdown", onDown);
    layer.addEventListener("pointermove", onMove);
    layer.addEventListener("pointerup", onUp);
    layer.addEventListener("pointercancel", onUp);
    layer.addEventListener("click", onClick);
    layer.addEventListener("input", onInput);
    D.addEventListener("keydown", onKey);

    // ذخیرهٔ خودکار ویرایش متن جزوه (با کمی تأخیر تا تایپ روان بماند)
    D.addEventListener("input", function () {
      if (!D.body.classList.contains("hk-docedit")) return;
      if (docT) clearTimeout(docT);
      docT = setTimeout(docFlush, 900);
    });

    applyDocEdits();

    var rt = 0;
    W.addEventListener("resize", function () {
      if (rt) clearTimeout(rt);
      rt = setTimeout(sizeLayer, 180);
    });
    W.addEventListener("beforeunload", function () { if (E.dirty) save(); });

    render();
    sizeLayer();
    // بعد از بار شدن کامل فونت‌ها و محتوا، اندازهٔ لایه یک بار دیگر تنظیم می‌شود
    setTimeout(sizeLayer, 900);
    setTimeout(sizeLayer, 2200);
  }

  W.HK = W.HK || {};
  W.HK.Editor = {
    enable: function () { if (!E.on) enter(); },
    disable: exit,
    state: E,
    undo: undo, redo: redo, save: save,
    exportPDF: function () { if (!E.on) enter(); setTimeout(function () { W.print(); }, 300); },
  };

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
