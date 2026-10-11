/* ==========================================================================
   رهنما — جعبهٔ ابزار PDF  |  r7-pdf.js
   --------------------------------------------------------------------------
   ویرایش PDF در خودِ مرورگر (بدون آپلود به هیچ سروری — داده‌ات از دستگاه بیرون
   نمی‌رود). کتابخانه‌ها فقط وقتی لازم شوند بارگذاری می‌شوند تا صفحه سبک بماند.
     • ادغام چند PDF            • استخراج صفحه‌ها
     • حذف صفحه‌ها              • چرخش صفحه‌ها
     • مرتب‌سازی صفحه‌ها         • شماره‌گذاری صفحه (فارسی)
     • واترمارک متنی (فارسی)    • تصویر → PDF
     • متادیتا و اطلاعات فایل
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function toast(m) { try { if (W.HK && W.HK.toast) return W.HK.toast(m); } catch (e) { } alert(m); }

  /* ------------------------------------------------ بارگذاری تنبل کتابخانه‌ها */
  var LOADED = {};
  function script(src) {
    if (LOADED[src]) return LOADED[src];
    LOADED[src] = new Promise(function (res, rej) {
      var s = D.createElement("script");
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error("بارگذاری نشد: " + src)); };
      D.head.appendChild(s);
    });
    return LOADED[src];
  }
  function lib() {
    if (W.PDFLib) return Promise.resolve(W.PDFLib);
    return script("assets/vendor/pdf-lib.min.js").then(function () { return W.PDFLib; });
  }
  function shaper() {
    if (W.PersianShaper) return Promise.resolve(W.PersianShaper);
    return script("assets/vendor/persian-shaper.js").then(function () { return W.PersianShaper; });
  }

  /* ------------------------------------ متن فارسی برای PDF (چسباندن + راست‌به‌چپ) */
  function shapeFa(str) {
    var s = String(str || "");
    if (!W.PersianShaper) return s;
    s = W.PersianShaper.convertArabic(s);
    var runs = s.match(/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]+|[^\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g) || [];
    var out = "";
    for (var i = runs.length - 1; i >= 0; i--) {
      var r = runs[i];
      if (/[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(r)) out += r.split("").reverse().join("");
      else out += r;
    }
    return out;
  }
  function faDigit(n) {
    return String(n).replace(/\d/g, function (d) { return "\u06F0\u06F1\u06F2\u06F3\u06F4\u06F5\u06F6\u06F7\u06F8\u06F9"[+d]; });
  }

  var FONT_CACHE = {};
  function embedFaFont(doc, bold) {
    var key = bold ? "b" : "r";
    if (FONT_CACHE[key]) return Promise.resolve(FONT_CACHE[key]);
    if (!doc.registerFontkit) return Promise.reject(new Error("fontkit لازم است"));
    return script("assets/vendor/fontkit.umd.min.js")
      .then(function () {
        doc.registerFontkit(W.fontkit);
        var src = "assets/vendor/Vazirmatn-" + (bold ? "Bold" : "Regular") + ".ttf";
        return fetch(src).then(function (r) { return r.arrayBuffer(); });
      })
      .then(function (buf) { return doc.embedFont(buf, { subset: true }); })
      .then(function (f) { FONT_CACHE[key] = f; return f; });
  }

  /* ------------------------------------------------------------ ابزارها */
  function readFile(file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(new Error("خواندن فایل ناموفق بود")); };
      fr.readAsArrayBuffer(file);
    });
  }
  function pagesOf(input, total) {
    // «1-3,5,8-10» → [0,1,2,4,7,8,9]
    var out = [];
    String(input || "").split(",").forEach(function (part) {
      var p = part.trim();
      if (!p) return;
      var m = /^(\d+)\s*-\s*(\d+)$/.exec(p);
      if (m) {
        var a = +m[1], b = +m[2];
        if (a > b) { var t = a; a = b; b = t; }
        for (var i = a; i <= b; i++) if (i >= 1 && i <= total) out.push(i - 1);
      } else if (/^\d+$/.test(p)) {
        var k = +p;
        if (k >= 1 && k <= total) out.push(k - 1);
      }
    });
    return out.filter(function (v, i, s) { return s.indexOf(v) === i; });
  }
  function download(bytes, name) {
    var blob = new Blob([bytes], { type: "application/pdf" });
    var a = D.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    D.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  function status(msg, kind) {
    var el = $("#pdStatus");
    if (!el) return;
    el.textContent = msg;
    el.className = "hk-status" + (kind ? " " + kind : "");
  }
  var busy = false;
  function withBusy(fn) {
    return function () {
      if (busy) { toast("یک کار در حال انجام است…"); return; }
      busy = true; status("در حال پردازش…");
      Promise.resolve().then(fn)
        .then(function (m) { status(m || "انجام شد ✅", "ok"); })
        .catch(function (e) { status("خطا: " + (e && e.message ? e.message : e), "err"); })
        .then(function () { busy = false; });
    };
  }
  function filesOf(id) { return Array.prototype.slice.call(($("#" + id) || {}).files || []); }
  function outName(base, suffix) { return (base || "rahnama") + "-" + suffix + ".pdf"; }

  var T = {};
  function one(id) { var f = filesOf(id); return f.length ? f[0] : null; }

  /* ادغام چند PDF */
  T.merge = withBusy(function () {
    var fs2 = filesOf("pdMergeFiles");
    if (fs2.length < 2) throw new Error("حداقل دو فایل PDF انتخاب کن.");
    return lib().then(function (P) {
      return fs2.reduce(function (chain, f) {
        return chain.then(function (out) {
          return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); })
            .then(function (src) { return out.copyPages(src, src.getPageIndices()).then(function (ps) { ps.forEach(function (p) { out.addPage(p); }); return out; }); });
        });
      }, P.PDFDocument.create()).then(function (out) {
        return out.save().then(function (bytes) { download(bytes, outName("adgham", "marge")); return "ادغام شد — " + fs2.length + " فایل"; });
      });
    });
  });

  /* استخراج یا حذف صفحه‌ها (یک پیاده‌سازی، دو حالت) */
  function pickPages(mode) {
    return function () {
      var f = one("pdPickFile");
      if (!f) throw new Error("یک فایل PDF انتخاب کن.");
      var spec = ($("#pdPickRange") || {}).value || "";
      return lib().then(function (P) {
        return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (src) {
          var total = src.getPageCount();
          var sel = pagesOf(spec, total);
          if (!sel.length) throw new Error("شمارهٔ صفحه‌ها را درست بنویس (مثلاً 1-3,5).");
          var keep = mode === "keep" ? sel : src.getPageIndices().filter(function (i) { return sel.indexOf(i) < 0; });
          if (!keep.length) throw new Error("هیچ صفحه‌ای باقی نمی‌ماند.");
          return P.PDFDocument.create().then(function (out) {
            return out.copyPages(src, keep).then(function (ps) {
              ps.forEach(function (p) { out.addPage(p); });
              return out.save().then(function (bytes) {
                download(bytes, outName(mode === "keep" ? "extract" : "delete", mode === "keep" ? "enteghab" : "hazf"));
                return (mode === "keep" ? "استخراج" : "حذف") + " انجام شد — " + keep.length + " صفحه";
              });
            });
          });
        });
      });
    };
  }
  T.extract = withBusy(pickPages("keep"));
  T.remove = withBusy(pickPages("drop"));

  /* چرخش */
  T.rotate = withBusy(function () {
    var f = one("pdRotFile");
    if (!f) throw new Error("یک فایل PDF انتخاب کن.");
    var deg = parseInt((($("#pdRotDeg") || {}).value) || "90", 10);
    var spec = (($("#pdRotRange") || {}).value || "").trim();
    return lib().then(function (P) {
      return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (doc) {
        var total = doc.getPageCount();
        var sel = spec ? pagesOf(spec, total) : doc.getPageIndices();
        sel.forEach(function (i) {
          var p = doc.getPage(i);
          p.setRotation(P.degrees(((p.getRotation().angle || 0) + deg) % 360));
        });
        return doc.save().then(function (bytes) { download(bytes, outName("rotate", "charkhesh")); return "چرخش " + deg + "° روی " + sel.length + " صفحه"; });
      });
    });
  });

  /* مرتب‌سازی صفحه‌ها */
  T.reorder = withBusy(function () {
    var f = one("pdOrdFile");
    if (!f) throw new Error("یک فایل PDF انتخاب کن.");
    var spec = (($("#pdOrdOrder") || {}).value || "").trim();
    return lib().then(function (P) {
      return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (src) {
        var total = src.getPageCount();
        var order = pagesOf(spec, total);
        if (!order.length) throw new Error("ترتیب تازه را بنویس، مثلاً 3,1,2");
        src.getPageIndices().forEach(function (i) { if (order.indexOf(i) < 0) order.push(i); });
        return P.PDFDocument.create().then(function (out) {
          return out.copyPages(src, order).then(function (ps) {
            ps.forEach(function (p) { out.addPage(p); });
            return out.save().then(function (bytes) { download(bytes, outName("order", "moratab")); return "ترتیب " + order.length + " صفحه اعمال شد"; });
          });
        });
      });
    });
  });

  /* شماره‌گذاری صفحه (با ارقام فارسی) */
  T.number = withBusy(function () {
    var f = one("pdNumFile");
    if (!f) throw new Error("یک فایل PDF انتخاب کن.");
    var pos = ($("#pdNumPos") || {}).value || "center";
    var start = parseInt((($("#pdNumStart") || {}).value) || "1", 10);
    return lib().then(function (P) {
      return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (doc) {
        return embedFaFont(doc, false).then(function (font) {
          var n = doc.getPageCount();
          doc.getPages().forEach(function (pg, i) {
            var label = faDigit(i + start);
            var size = 11;
            var w = font.widthOfTextAtSize(label, size);
            var pw = pg.getWidth();
            var x = pos === "right" ? pw - w - 34 : (pos === "left" ? 34 : (pw - w) / 2);
            pg.drawText(label, { x: x, y: 22, size: size, font: font, color: P.rgb(0.25, 0.25, 0.35) });
          });
          return doc.save().then(function (bytes) { download(bytes, outName("numbered", "shomare")); return "شماره‌گذاری " + n + " صفحه انجام شد"; });
        });
      });
    });
  });

  /* واترمارک متنی (فارسی) */
  T.watermark = withBusy(function () {
    var f = one("pdWmFile");
    if (!f) throw new Error("یک فایل PDF انتخاب کن.");
    var text = (($("#pdWmText") || {}).value || "").trim();
    if (!text) throw new Error("متن واترمارک را بنویس.");
    var op = Math.max(0.05, Math.min(0.6, parseFloat((($("#pdWmOpacity") || {}).value) || "0.16")));
    var size = Math.max(16, Math.min(90, parseInt((($("#pdWmSize") || {}).value) || "44", 10)));
    return lib().then(function (P) {
      return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (doc) {
        return embedFaFont(doc, true).then(function (font) {
          var label = shapeFa(text);
          var n = doc.getPageCount();
          doc.getPages().forEach(function (pg) {
            var w = font.widthOfTextAtSize(label, size);
            var pw = pg.getWidth(), ph = pg.getHeight();
            pg.drawText(label, {
              x: Math.max(12, (pw - w) / 2), y: ph / 2 - size / 2,
              size: size, font: font, color: P.rgb(0.42, 0.36, 0.9), opacity: op,
              rotate: P.degrees(-18)
            });
          });
          return doc.save().then(function (bytes) { download(bytes, outName("watermark", "vatarmark")); return "واترمارک روی " + n + " صفحه زده شد"; });
        });
      });
    });
  });

  /* تصویر → PDF */
  T.images = withBusy(function () {
    var fs2 = filesOf("pdImgFiles");
    if (!fs2.length) throw new Error("حداقل یک تصویر انتخاب کن.");
    return lib().then(function (P) {
      return P.PDFDocument.create().then(function (doc) {
        return fs2.reduce(function (chain, f) {
          return chain.then(function () {
            return readFile(f).then(function (b) {
              var isPng = /\.png$/i.test(f.name);
              return (isPng ? doc.embedPng(b) : doc.embedJpg(b)).then(function (img) {
                var pw = 595.28, ph = 841.89;                 // A4
                var m = 24;
                var sc = Math.min((pw - m * 2) / img.width, (ph - m * 2) / img.height);
                var w = img.width * sc, h = img.height * sc;
                var page = doc.addPage([pw, ph]);
                page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
              });
            });
          });
        }, Promise.resolve()).then(function () {
          return doc.save().then(function (bytes) { download(bytes, outName("images", "aks")); return fs2.length + " تصویر در یک PDF چیده شد"; });
        });
      });
    });
  });

  /* اطلاعات و متادیتا */
  T.info = withBusy(function () {
    var f = one("pdInfoFile");
    if (!f) throw new Error("یک فایل PDF انتخاب کن.");
    return lib().then(function (P) {
      return readFile(f).then(function (b) { return P.PDFDocument.load(b, { ignoreEncryption: true }); }).then(function (doc) {
        var setTitle = (($("#pdInfoTitle") || {}).value || "").trim();
        var setAuthor = (($("#pdInfoAuthor") || {}).value || "").trim();
        if (setTitle) doc.setTitle(setTitle);
        if (setAuthor) doc.setAuthor(setAuthor);
        if (setTitle || setAuthor) doc.setProducer("رهنما — جعبهٔ ابزار PDF");
        doc.setModificationDate(new Date());
        return doc.save().then(function (bytes) {
          var rows = [
            "تعداد صفحه: " + doc.getPageCount(),
            "حجم فایل: " + Math.round(f.size / 1024) + " کیلوبایت",
            "عنوان: " + (doc.getTitle() || "—"),
            "نویسنده: " + (doc.getAuthor() || "—"),
            "سازنده: " + (doc.getProducer() || "—")
          ];
          var box = $("#pdInfoOut");
          if (box) box.innerHTML = rows.map(function (r) { return "<div>" + r + "</div>"; }).join("");
          if (setTitle || setAuthor) { download(bytes, outName("meta", "metadata")); return "متادیتا ذخیره و فایل دانلود شد"; }
          return "اطلاعات خوانده شد";
        });
      });
    });
  });

  /* ------------------------------------------------------------ سیم‌کشی */
  function wire() {
    if (!$("#pdStatus")) return false;
    D.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-pd]");
      if (!b) return;
      var k = b.getAttribute("data-pd");
      if (T[k]) T[k]();
    });
    // پیش‌نمایش نام فایل‌های انتخابی
    D.addEventListener("change", function (e) {
      var i = e.target;
      if (!i || i.type !== "file") return;
      var box = i.parentNode && i.parentNode.querySelector(".pd-files");
      if (!box) return;
      var f = Array.prototype.slice.call(i.files || []);
      box.textContent = f.length ? f.map(function (x) { return x.name + " (" + Math.round(x.size / 1024) + "KB)"; }).join(" ، ") : "";
    });
    return true;
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", wire);
  else wire();
  W.R7PDF = T;
})();
