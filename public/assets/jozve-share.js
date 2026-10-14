/* ==========================================================================
   رهنما — پنل «جزوهٔ همکلاسی‌ها» (jozve-share.js)
   --------------------------------------------------------------------------
   جزوه گذاشتن با متن و عکس، دیدن و پسندیدن جزوهٔ بقیه.

   نکته‌های مهم پیاده‌سازی:
     • عکس‌ها پیش از فرستادن سمت مرورگر فشرده می‌شوند (کاهش اندازه و کیفیت)
       تا هم آپلود سریع باشد، هم فضای سرور کم مصرف شود.
     • همهٔ متن‌های کاربر پیش از درج در صفحه پاک‌سازی می‌شوند (جلوگیری از تزریق).
     • اگر ورود نکرده باشی، فقط خواندن ممکن است؛ فرم جای خود را به پیام ورود می‌دهد.
   ========================================================================== */
(function () {
  "use strict";
  var D = document;
  var REDUCED = false;
  try { REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { }

  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function fa(n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(s, r) { return (r || D).querySelector(s); }

  var GRADE_FA = { "7": "هفتم", "8": "هشتم", "9": "نهم" };
  /* شیب هر پایه از پیش آماده است تا درجِ خطیِ رنگ‌ها در مرورگرهای قدیمی هم کار کند */
  var GRADE_GRAD = {
    "7": "linear-gradient(140deg,#6d5efc,#a855f7)",
    "8": "linear-gradient(140deg,#0ea5a5,#22d3ee)",
    "9": "linear-gradient(140deg,#e0533f,#f97316)"
  };
  function gradeGrad(g) { return GRADE_GRAD[g] || "linear-gradient(140deg,#6d5efc,#7ee7ff)"; }
  function initials(name) { return (String(name || "؟").trim().charAt(0) || "؟"); }

  function ago(t) {
    var s = Math.max(0, Math.floor((Date.now() - (t || 0)) / 1000));
    if (s < 60) return "همین حالا";
    var m = Math.floor(s / 60); if (m < 60) return fa(m) + " دقیقه پیش";
    var h = Math.floor(m / 60); if (h < 24) return fa(h) + " ساعت پیش";
    var d = Math.floor(h / 24); if (d < 30) return fa(d) + " روز پیش";
    try {
      return new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(t));
    } catch (e) { return fa(d) + " روز پیش"; }
  }

  /* ── شبکه ──────────────────────────────────────────────────────────────── */
  function api(method, path, body) {
    return fetch(path, {
      method: method, credentials: "same-origin", cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || (j && j.error)) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* ── پیام کوتاه ───────────────────────────────────────────────────────── */
  var toastBox = null, toastTimer = null;
  function toast(msg, bad) {
    if (!toastBox) { toastBox = D.createElement("div"); toastBox.className = "jz-toast"; D.body.appendChild(toastBox); }
    toastBox.className = "jz-toast" + (bad ? " jz-bad" : "");
    toastBox.innerHTML = "<div>" + esc(msg) + "</div>";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { if (toastBox) toastBox.innerHTML = ""; }, 3600);
  }

  /* ── شمارندهٔ نرم آمار ────────────────────────────────────────────────── */
  function setStat(id, value) {
    var el = D.getElementById(id);
    if (!el) return;
    var from = parseInt(String(el.textContent).replace(/[^\d]/g, ""), 10) || 0;
    var to = +value || 0;
    if (REDUCED || from === to) { el.textContent = fa(to); return; }
    var t0 = 0, dur = to > from ? 620 : 0;
    if (!dur) { el.textContent = fa(to); return; }
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = fa(Math.round(from + (to - from) * e));
      if (p < 1) (window.requestAnimationFrame || setTimeout)(step);
    }
    (window.requestAnimationFrame || setTimeout)(step);
  }

  /* ── وضعیت صفحه ───────────────────────────────────────────────────────── */
  var notes = [], me = null, filterGrade = "", q = "", sortBy = "new";
  var feed = $("#jzFeed"), form = $("#jzForm"), gate = $("#jzGate");

  function filtered() {
    var needle = q.trim().toLowerCase();
    var out = notes.filter(function (n) {
      if (filterGrade && n.grade !== filterGrade) return false;
      if (needle) {
        var hay = (n.title + " " + n.body + " " + n.subject + " " + n.name + " " + (GRADE_FA[n.grade] || "")).toLowerCase();
        if (hay.indexOf(needle) < 0) return false;
      }
      return true;
    });
    out.sort(function (a, b) {
      if (sortBy === "like") return (b.likes || 0) - (a.likes || 0) || (b.t || 0) - (a.t || 0);
      if (sortBy === "img") return ((b.imgs || []).length - (a.imgs || []).length) || (b.t || 0) - (a.t || 0);
      return (b.t || 0) - (a.t || 0);
    });
    return out;
  }

  function cardHtml(n, i) {
    var imgs = (n.imgs || []).slice(0, 3);
    var media = "";
    if (imgs.length) {
      media = '<div class="jz-media" data-n="' + imgs.length + '">' +
        imgs.map(function (src) {
          return '<div class="jz-ph" data-src="' + esc(src) + '"><img src="' + esc(src) + '" alt="تصویر جزوه: ' + esc(n.title) + '" loading="lazy" decoding="async"></div>';
        }).join("") + "</div>";
    }
    var g = n.grade ? '<span class="jz-tag jz-g">پایهٔ ' + esc(GRADE_FA[n.grade] || n.grade) + "</span>" : "";
    var body = esc(n.body || "");
    var long = body.length > 260;
    var grad = gradeGrad(n.grade);
    return '<article class="jz-card" data-id="' + esc(n.id) + '" style="animation-delay:' + Math.min(i, 8) * 55 + 'ms">' +
      media +
      '<div class="jz-body">' +
        '<div class="jz-meta">' + g + (n.subject ? '<span class="jz-tag">' + esc(n.subject) + "</span>" : "") + "</div>" +
        "<h3 class=\"jz-title\">" + esc(n.title) + "</h3>" +
        '<p class="jz-text' + (long ? " jz-clamp" : "") + '">' + body + "</p>" +
        (long ? '<button type="button" class="jz-more">بیشتر بخوان</button>' : "") +
      "</div>" +
      '<div class="jz-foot">' +
        '<div class="jz-who">' +
          '<i style="background:' + grad + '">' + esc(initials(n.name)) + "</i>" +
          "<div><b>" + esc(n.name) + "</b><br><span>" + esc(ago(n.t)) + "</span></div>" +
        "</div>" +
        '<button type="button" class="jz-act jz-like" aria-pressed="' + (n.liked ? "true" : "false") + '" title="پسندیدن">' +
          '<svg viewBox="0 0 24 24" fill="' + (n.liked ? "currentColor" : "none") + '" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 20s-7-4.6-7-9.4A4.1 4.1 0 0 1 12 8a4.1 4.1 0 0 1 7 2.6C19 15.4 12 20 12 20Z"/></svg>' +
          "<span>" + fa(n.likes || 0) + "</span>" +
        "</button>" +
        (n.canDel ? '<button type="button" class="jz-act jz-del" title="حذف">✕ حذف</button>' : "") +
      "</div>" +
    "</article>";
  }

  function render() {
    var list = filtered();
    if (!list.length) {
      var has = notes.length > 0;
      feed.innerHTML = '<div class="jz-empty"><i>' + (has ? "🔍" : "📝") + "</i><b>" +
        (has ? "چیزی با این پالایش پیدا نشد" : "هنوز جزوه‌ای گذاشته نشده") + "</b><p>" +
        (has ? "پالایش پایه یا جست‌وجو را عوض کن." : "اولین نفر باش! جزوه یا خلاصه‌ات را با یک عکس بگذار.") +
        "</p></div>";
      return;
    }
    feed.innerHTML = list.map(cardHtml).join("");
  }

  function stats() {
    var imgs = 0, likes = 0, who = {};
    for (var i = 0; i < notes.length; i++) {
      imgs += (notes[i].imgs || []).length;
      likes += +notes[i].likes || 0;
      who[notes[i].name || "?"] = 1;
    }
    setStat("jzTotal", notes.length);
    setStat("jzImgs", imgs);
    setStat("jzLikes", likes);
    setStat("jzWriters", Object.keys(who).length);
  }

  var loading = false;
  function load(silent) {
    if (loading) return Promise.resolve();
    loading = true;
    var btn = $("#jzRefresh");
    if (btn && !silent) btn.classList.add("jz-spin");
    return api("GET", "/api/jozve/list").then(function (r) {
      notes = (r && r.notes) || [];
      me = (r && r.me) || null;
      gate.hidden = !!me;
      form.hidden = !me;
      if (me) {
        var ava = $("#jzAva");
        if (ava) ava.textContent = initials(me.name);
        var hi = $("#jzHello");
        if (hi) hi.textContent = (me.name ? me.name : "کاربر") + " جان، جزوهٔ تازه بگذار";
        if (!$("#jzGrade").value && me.grade && GRADE_FA[me.grade]) $("#jzGrade").value = me.grade;
      }
      stats();
      render();
    }).catch(function (e) {
      feed.innerHTML = '<div class="jz-empty"><i>⚠️</i><b>خواندن جزوه‌ها نشد</b><p>' +
        esc(e && e.message ? e.message : "اتصال را بررسی کن.") + "</p></div>";
    }).then(function () {
      loading = false;
      if (btn) btn.classList.remove("jz-spin");
    });
  }

  /* ── فشرده‌سازی عکس در مرورگر ─────────────────────────────────────────── */
  var MAX_DIM = 1400, TARGET = 250 * 1024, MAX_IMGS = 3;
  function compress(file) {
    return new Promise(function (resolve) {
      if (!file || !/^image\//.test(file.type)) { resolve(""); return; }
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () {
        try { URL.revokeObjectURL(url); } catch (e) { }
        var dim = Math.min(MAX_DIM, Math.max(img.width, img.height));
        var quality = 0.84, out = "";
        for (var pass = 0; pass < 7; pass++) {
          var scale = dim / Math.max(img.width, img.height, 1);
          var w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
          var c = D.createElement("canvas"); c.width = w; c.height = h;
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);       /* JPEG شفافیت ندارد */
          ctx.drawImage(img, 0, 0, w, h);
          out = c.toDataURL("image/jpeg", quality);
          if (Math.floor(out.length * 3 / 4) <= TARGET) break;
          if (quality > 0.52) quality -= 0.12; else dim = Math.round(dim * 0.78);
        }
        resolve(out);
      };
      img.onerror = function () { try { URL.revokeObjectURL(url); } catch (e) { } resolve(""); };
      img.src = url;
    });
  }

  var picked = [];      /* {src, name, size} */
  function paintThumbs() {
    var box = $("#jzThumbs");
    box.innerHTML = picked.map(function (p, i) {
      return '<div class="jz-thumb"><img src="' + p.src + '" alt="پیش‌نمایش ' + fa(i + 1) + '">' +
        '<button type="button" data-rm="' + i + '" aria-label="برداشتن تصویر ' + fa(i + 1) + '">✕</button></div>';
    }).join("");
    updateHint();
  }
  function updateHint() {
    var el = $("#jzHint");
    if (!el) return;
    if (!picked.length) { el.textContent = "نکته: برای احترام به بقیه، مودب بنویس و منبع جزوه را ذکر کن."; return; }
    var total = picked.reduce(function (a, p) { return a + (p.size || 0); }, 0);
    el.textContent = fa(picked.length) + " عکس آماده شد · روی‌هم " + fa(Math.round(total / 1024)) + " کیلوبایت";
  }

  function addFiles(files) {
    var arr = Array.prototype.slice.call(files || []);
    if (!arr.length) return;
    var room = MAX_IMGS - picked.length;
    if (room <= 0) { toast("بیشتر از " + fa(MAX_IMGS) + " عکس نمی‌شود گذاشت.", true); return; }
    if (arr.length > room) { toast("فقط " + fa(room) + " عکس دیگر جا می‌شود.", true); arr = arr.slice(0, room); }
    var el = $("#jzHint");
    if (el) el.textContent = "در حال فشرده‌کردن عکس‌ها…";
    Promise.all(arr.map(compress)).then(function (outs) {
      for (var i = 0; i < outs.length; i++) {
        if (!outs[i]) { toast("یک فایل تصویری نبود و رد شد.", true); continue; }
        picked.push({ src: outs[i], size: Math.floor(outs[i].length * 3 / 4) });
      }
      paintThumbs();
    });
  }

  /* ── رویدادها ─────────────────────────────────────────────────────────── */
  if (form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var title = ($("#jzTitle").value || "").trim();
      var text = ($("#jzText").value || "").trim();
      if (title.length < 3) { toast("عنوان جزوه را کامل‌تر بنویس.", true); $("#jzTitle").focus(); return; }
      if (text.length < 10) { toast("متن جزوه خیلی کوتاه است.", true); $("#jzText").focus(); return; }
      var send = $("#jzSend");
      send.disabled = true;
      send.textContent = "در حال فرستادن…";
      api("POST", "/api/jozve/post", {
        title: title, body: text,
        grade: $("#jzGrade").value || "",
        subject: ($("#jzSubject").value || "").trim(),
        images: picked.map(function (p) { return p.src; })
      }).then(function (r) {
        if (r && r.warn) toast(r.warn, true);
        else toast("جزوه‌ات گذاشته شد. ممنون که قسمت کردی! 🌱");
        if (r && r.note) { notes.unshift(r.note); stats(); render(); }
        $("#jzTitle").value = ""; $("#jzText").value = ""; picked = []; paintThumbs();
        window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
      }).catch(function (err) {
        toast(err && err.message ? err.message : "فرستادن جزوه نشد.", true);
      }).then(function () {
        send.disabled = false;
        send.textContent = "منتشر کن";
      });
    });

    $("#jzClear").addEventListener("click", function () {
      $("#jzTitle").value = ""; $("#jzText").value = ""; $("#jzSubject").value = "";
      picked = []; paintThumbs(); toast("فرم پاک شد.");
    });

    var drop = $("#jzDrop"), files = $("#jzFiles");
    files.addEventListener("change", function () { addFiles(files.files); files.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("jz-over"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("jz-over"); });
    });
    drop.addEventListener("drop", function (e) {
      if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
    });

    $("#jzThumbs").addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-rm]") : null;
      if (!b) return;
      picked.splice(+b.getAttribute("data-rm"), 1);
      paintThumbs();
    });
  }

  /* پالایش و جست‌وجو */
  var chips = D.querySelectorAll(".jz-chip");
  Array.prototype.forEach.call(chips, function (c) {
    c.addEventListener("click", function () {
      filterGrade = c.getAttribute("data-grade") || "";
      Array.prototype.forEach.call(chips, function (x) { x.setAttribute("aria-pressed", x === c ? "true" : "false"); });
      render();
    });
  });
  var qEl = $("#jzQ"), qTimer = null;
  if (qEl) qEl.addEventListener("input", function () {
    clearTimeout(qTimer);
    qTimer = setTimeout(function () { q = qEl.value || ""; render(); }, 160);
  });
  var sortEl = $("#jzSort");
  if (sortEl) sortEl.addEventListener("change", function () { sortBy = sortEl.value; render(); });
  var refEl = $("#jzRefresh");
  if (refEl) refEl.addEventListener("click", function () { load(false); });

  /* تعامل با کارت‌ها: پسند، حذف، بیشتر بخوان، بزرگ‌نمایی */
  feed.addEventListener("click", function (e) {
    var card = e.target.closest ? e.target.closest(".jz-card") : null;
    if (!card) return;
    var id = card.getAttribute("data-id");

    var like = e.target.closest(".jz-like");
    if (like) {
      if (!me) { toast("برای پسندیدن، اول وارد حساب شو.", true); return; }
      like.classList.add("jz-pop");
      setTimeout(function () { like.classList.remove("jz-pop"); }, 520);
      api("POST", "/api/jozve/like", { id: id }).then(function (r) {
        var n = notes.filter(function (x) { return x.id === id; })[0];
        if (n) { n.likes = r.likes; n.liked = r.liked; }
        like.setAttribute("aria-pressed", r.liked ? "true" : "false");
        var svg = like.querySelector("svg");
        if (svg) svg.setAttribute("fill", r.liked ? "currentColor" : "none");
        var sp = like.querySelector("span");
        if (sp) sp.textContent = fa(r.likes);
        stats();
      }).catch(function (err) { toast(err.message || "پسندیدن نشد.", true); });
      return;
    }

    var del = e.target.closest(".jz-del");
    if (del) {
      if (!window.confirm("این جزوه برای همیشه حذف شود؟")) return;
      api("POST", "/api/jozve/del", { id: id }).then(function () {
        notes = notes.filter(function (x) { return x.id !== id; });
        stats(); render(); toast("جزوه حذف شد.");
      }).catch(function (err) { toast(err.message || "حذف نشد.", true); });
      return;
    }

    var more = e.target.closest(".jz-more");
    if (more) {
      var p = card.querySelector(".jz-text");
      if (p) { p.classList.remove("jz-clamp"); more.remove(); }
      return;
    }

    var ph = e.target.closest(".jz-ph");
    if (ph) lightbox(ph.getAttribute("data-src"), card);
  });

  /* ── نورافکن تصویر ────────────────────────────────────────────────────── */
  function lightbox(src, card) {
    if (!src) return;
    var all = card ? Array.prototype.slice.call(card.querySelectorAll(".jz-ph")) : [];
    var idx = 0;
    for (var i = 0; i < all.length; i++) if (all[i].getAttribute("data-src") === src) idx = i;
    var box = D.createElement("div");
    box.className = "jz-lb";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.innerHTML = '<button class="jz-lb-x" aria-label="بستن">✕</button><img alt="نمای بزرگ تصویر جزوه">';
    var img = box.querySelector("img");
    function show(k) { img.src = all[k].getAttribute("data-src"); idx = k; }
    show(idx);
    function close() { box.remove(); D.removeEventListener("keydown", key); D.body.style.overflow = ""; }
    function key(e) {
      if (e.key === "Escape") close();
      if (all.length > 1 && e.key === "ArrowLeft") show((idx + 1) % all.length);
      if (all.length > 1 && e.key === "ArrowRight") show((idx - 1 + all.length) % all.length);
    }
    box.querySelector(".jz-lb-x").addEventListener("click", close);
    box.addEventListener("click", function (e) { if (e.target === box) close(); });
    D.addEventListener("keydown", key);
    D.body.style.overflow = "hidden";
    D.body.appendChild(box);
  }

  /* ── تازه‌سازی خودکار ─────────────────────────────────────────────────── */
  var last = 0;
  function maybeRefresh() {
    if (D.hidden) return;
    if (Date.now() - last < 12000) return;
    last = Date.now();
    load(true);
  }
  D.addEventListener("visibilitychange", function () { if (!D.hidden) maybeRefresh(); });
  window.addEventListener("focus", maybeRefresh);
  setInterval(function () { if (!D.hidden) { last = Date.now(); load(true); } }, 30000);

  load(false);
})();
