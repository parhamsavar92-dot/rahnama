/* ==========================================================================
   رهنما — منطق صفحه‌های متنی و جعبهٔ ابزار (legal.js)
   --------------------------------------------------------------------------
   روی هر صفحه‌ای که بارگذاری شود، فقط بخش مربوط به همان صفحه کار می‌کند:
     • قوانین: پرکردن تاریخ بازنگری
     • پرسش‌های پرتکرار: جست‌وجو و بازوبسته‌کردن
     • گزارش تخلف: فرستادن فرم به سرور
     • جعبهٔ ابزار: معدل، پومودورو، ماشین‌حساب، تبدیل یکا، تایمر آزمون، فهرست کار
   همهٔ ابزارها محلی‌اند و هیچ داده‌ای جایی فرستاده نمی‌شود.
   ========================================================================== */
(function () {
  "use strict";
  var D = document, W = window;
  var FA = "\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9";
  function fa(n) { return String(n == null ? "" : n).replace(/[0-9]/g, function (d) { return FA[+d]; }); }
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function store(k, v) {
    try {
      if (v === undefined) { var t = localStorage.getItem(k); return t == null ? null : JSON.parse(t); }
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return null; }
  }
  function num(s) {
    var t = String(s == null ? "" : s);
    for (var i = 0; i < 10; i++) t = t.split(FA[i]).join(String(i));
    return parseFloat(t.replace(/[٫،]/g, ".").replace(/[^\d.\-]/g, "")) || 0;
  }
  function toast(m, bad) {
    if (W.R14 && W.R14.toast) { W.R14.toast(m, bad); return; }
    try { console.log(m); } catch (e) { }
  }
  function ready(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn, { once: true }); else fn(); }

  ready(function () {
    try { showDate(); } catch (e) { }
    try { faq(); } catch (e) { }
    try { abuseForm(); } catch (e) { }
    try { toolbox(); } catch (e) { }
  });

  /* ── تاریخ بازنگری سند ── */
  function showDate() {
    var el = $("[data-terms-date]");
    if (!el) return;
    try {
      el.textContent = new Intl.DateTimeFormat("fa-IR", { year: "numeric", month: "long", day: "numeric" }).format(new Date(2026, 9, 14));
    } catch (e) { el.textContent = "مهر ۱۴۰۵"; }
  }

  /* ── پرسش‌های پرتکرار: جست‌وجو ── */
  function faq() {
    var box = $("[data-faq]");
    if (!box) return;
    var input = $("[data-faq-q]");
    var items = $$(".faq-item", box);
    if (input) {
      input.addEventListener("input", function () {
        var q = input.value.trim().toLowerCase();
        var shown = 0;
        for (var i = 0; i < items.length; i++) {
          var hay = items[i].textContent.toLowerCase();
          var on = !q || hay.indexOf(q) > -1;
          items[i].hidden = !on;
          if (on) shown++;
        }
        var none = $("[data-faq-none]", box);
        if (none) none.hidden = shown > 0;
      });
    }
    /* پیوند ریشه‌ای مثل #q3 یک پرسش را باز کند */
    if (location.hash) {
      var target = D.getElementById(location.hash.slice(1));
      if (target && target.classList.contains("faq-item")) target.open = true;
    }
  }

  /* ── فرم گزارش تخلف ── */
  function abuseForm() {
    var form = $("[data-abuse-form]");
    if (!form) return;
    var kind = "jozve", reason = "";
    var params = new URLSearchParams(location.search);

    var preK = params.get("kind");
    $$("[data-ak]").forEach(function (b) {
      if (preK && b.getAttribute("data-ak") === preK) { b.setAttribute("aria-pressed", "true"); kind = preK; }
      b.addEventListener("click", function () {
        kind = b.getAttribute("data-ak");
        $$("[data-ak]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      });
    });
    $$("[data-ar]").forEach(function (b) {
      b.addEventListener("click", function () {
        reason = b.getAttribute("data-ar");
        $$("[data-ar]").forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      });
    });

    /* پرکردن خودکار از پارامترهای نشانی */
    var urlIn = $("[data-abuse-url]");
    if (urlIn) {
      var u = params.get("url");
      urlIn.value = u ? (location.origin + decodeURIComponent(u)) : "";
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!reason) { toast("دلیل گزارش را انتخاب کن.", true); return; }
      var note = ($("[data-abuse-note]") || {}).value || "";
      if (note.trim().length < 8 && reason === "other") { toast("توضیح کوتاهی بنویس.", true); return; }
      var btn = $("[data-abuse-send]", form);
      if (btn) { btn.disabled = true; btn.textContent = "در حال فرستادن…"; }
      fetch("/api/report/send", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: kind, reason: reason,
          target: ($("[data-abuse-target]") || {}).value || "",
          url: urlIn ? urlIn.value : "",
          note: note
        })
      }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || ("HTTP " + r.status));
        return j;
      }); }).then(function (j) {
        var done = $("[data-abuse-done]");
        if (done) { form.hidden = true; done.hidden = false; }
        else toast(j.message || "گزارش ثبت شد.", false);
        window.scrollTo({ top: (done || form).offsetTop - 90, behavior: "smooth" });
      }).catch(function (err) {
        toast(err && err.message ? err.message : "فرستادن گزارش نشد.", true);
      }).then(function () {
        if (btn) { btn.disabled = false; btn.textContent = "فرستادن گزارش"; }
      });
    });

    staffQueue();
  }

  /* ── پنل بازبینی گزارش‌ها (فقط برای مدیر؛ سرور ۴۰۳ می‌دهد) ── */
  function staffQueue() {
    var box = $("[data-abuse-queue]");
    if (!box) return;
    var listEl = $("[data-abq-list]", box);
    var freshEl = $("[data-abq-fresh]", box);
    var mode = "new";
    var STATUS_FA = { new: "باز", seen: "در دست بررسی", done: "رسیدگی شد", rejected: "رد شد" };
    var STATUS_CLS = { new: "bad", seen: "", done: "ok", rejected: "" };

    function fmt(t) {
      try { return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(t)); }
      catch (e) { return ""; }
    }
    function load() {
      return fetch("/api/report/list" + (mode === "new" ? "?status=new" : ""), { credentials: "same-origin", cache: "no-store" })
        .then(function (r) { if (r.status === 403 || r.status === 401) return null; return r.json().catch(function () { return null; }); })
        .then(function (j) {
          if (!j) return;                       /* کاربر مدیر نیست → بخش پنهان می‌ماند */
          box.hidden = false;
          if (freshEl) freshEl.textContent = j.fresh ? "(" + fa(j.fresh) + " گزارش باز)" : "";
          var rs = j.reports || [];
          if (!rs.length) {
            listEl.innerHTML = '<div class="lg-note">گزارشی در این دسته نیست. 🎉</div>';
            return;
          }
          listEl.innerHTML = rs.map(function (x) {
            return '<div class="ab-item" data-id="' + esc(x.id) + '">' +
              '<div class="ab-head">' +
                '<span class="lg-pill ' + (STATUS_CLS[x.status] || "") + '">' + esc(STATUS_FA[x.status] || x.status) + "</span>" +
                '<b>' + esc(x.reasonLabel || x.reason) + "</b>" +
                '<span class="ab-kind">' + esc(x.kindLabel || x.kind) + "</span>" +
                '<span class="ab-when">' + esc(fmt(x.t)) + "</span>" +
              "</div>" +
              '<div class="ab-who">گزارش‌دهنده: ' + esc(x.who || "ناشناس") + "</div>" +
              (x.target ? '<div class="ab-target">مورد گزارش: ' + esc(x.target) + "</div>" : "") +
              (x.note ? '<p class="ab-note">' + esc(x.note) + "</p>" : "") +
              (x.url ? '<div class="ab-url"><a href="' + esc(x.url) + '" target="_blank" rel="noopener nofollow">دیدن صفحه</a></div>' : "") +
              '<div class="ab-acts">' +
                ["seen", "done", "rejected"].map(function (s) {
                  return '<button type="button" class="tb-btn' + (s === "done" ? "" : " ghost") + '" data-abs="' + s + '">' + STATUS_FA[s] + "</button>";
                }).join("") +
              "</div>" +
            "</div>";
          }).join("");
        })
        .catch(function () { });
    }
    listEl.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest("[data-abs]") : null;
      if (!b) return;
      var item = b.closest(".ab-item");
      if (!item) return;
      var id = item.getAttribute("data-id");
      b.disabled = true;
      fetch("/api/report/status", {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: id, status: b.getAttribute("data-abs") })
      }).then(function (r) { return r.json().catch(function () { return {}; }); })
        .then(function () { toast("وضعیت گزارش عوض شد."); return load(); })
        .catch(function () { toast("تغییر وضعیت نشد.", true); })
        .then(function () { b.disabled = false; });
    });
    $$("[data-abq-mode]", box).forEach(function (b) {
      b.addEventListener("click", function () {
        mode = b.getAttribute("data-abq-mode");
        $$("[data-abq-mode]", box).forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        load();
      });
    });
    var rf = $("[data-abq-refresh]", box);
    if (rf) rf.addEventListener("click", load);
    load();
  }

  /* ── جعبهٔ ابزار ── */
  function toolbox() {
    var root = $("[data-toolbox]");
    if (!root) return;
    gpa();
    pomodoro();
    calc();
    convert();
    examTimer();
    todo();

    /* ── معدل وزن‌دار ── */
    function gpa() {
      var box = $("[data-gpa]", root);
      if (!box) return;
      var grades = store("r14:gpa") || [];
      if (!grades.length) grades = [{ n: "", g: 18, w: 3 }, { n: "", g: 17, w: 2 }, { n: "", g: 19, w: 2 }];
      var out = $("[data-gpa-out]", box);
      function paint() {
        var body = $("[data-gpa-rows]", box);
        body.innerHTML = grades.map(function (r, i) {
          return '<div class="tb-f">' +
            '<label>درس ' + fa(i + 1) + '</label>' +
            '<input type="text" data-gn="' + i + '" placeholder="نام درس" value="' + String(r.n || "").replace(/"/g, "&quot;") + '">' +
            '<input type="text" inputmode="decimal" data-gg="' + i + '" value="' + fa(r.g) + '" aria-label="نمره" style="max-inline-size:74px">' +
            '<input type="text" inputmode="decimal" data-gw="' + i + '" value="' + fa(r.w) + '" aria-label="ضریب" style="max-inline-size:64px">' +
            '</div>';
        }).join("");
        sum();
      }
      function sum() {
        var tw = 0, tg = 0, bad = 0;
        for (var i = 0; i < grades.length; i++) {
          var g = num(grades[i].g), w = num(grades[i].w);
          if (g > 20 || g < 0) bad++;
          tw += w; tg += g * w;
        }
        if (!tw) { out.innerHTML = "—"; return; }
        var avg = tg / tw;
        var txt = fa(avg.toFixed(2));
        var verdict = avg >= 18 ? "عالی — همین‌طوری ادامه بده 🌟" : avg >= 16 ? "خوب است؛ با کمی تلاش بهتر هم می‌شود 👍" : avg >= 14 ? "قابل قبول، ولی جای پیشرفت هست 💪" : "نیاز به برنامهٔ جدی‌تر دارد؛ از جزوه‌ها کمک بگیر 📚";
        out.innerHTML = "معدل وزنی: " + txt + "<small>" + verdict + "</small>";
      }
      paint();
      box.addEventListener("input", function (e) {
        var t = e.target;
        if (t.hasAttribute && t.hasAttribute("data-gn")) grades[+t.getAttribute("data-gn")].n = t.value;
        if (t.hasAttribute && t.hasAttribute("data-gg")) { grades[+t.getAttribute("data-gg")].g = num(t.value); sum(); store("r14:gpa", grades); }
        if (t.hasAttribute && t.hasAttribute("data-gw")) { grades[+t.getAttribute("data-gw")].w = num(t.value); sum(); store("r14:gpa", grades); }
      });
      var add = $("[data-gpa-add]", box);
      if (add) add.addEventListener("click", function () { grades.push({ n: "", g: 18, w: 1 }); paint(); store("r14:gpa", grades); });
      var del = $("[data-gpa-del]", box);
      if (del) del.addEventListener("click", function () { if (grades.length > 1) { grades.pop(); paint(); store("r14:gpa", grades); } });
    }

    /* ── پومودورو ── */
    function pomodoro() {
      var box = $("[data-pomo]", root);
      if (!box) return;
      var clock = $("[data-pomo-clock]", box);
      var stat = $("[data-pomo-stat]", box);
      var WORK = 25 * 60, REST = 5 * 60;
      var left = WORK, run = false, mode = "work", t = null;
      var today = new Date().toISOString().slice(0, 10);
      var saved = store("r14:pomo") || {};
      if (saved.day !== today) saved = { day: today, count: 0 };
      function show() {
        var m = Math.floor(left / 60), s = left % 60;
        clock.textContent = fa(m) + ":" + fa(s < 10 ? "0" + s : s);
        clock.classList.toggle("tb-timer-done", left === 0);
        stat.textContent = (mode === "work" ? "زمان تمرکز" : "زمان استراحت") + " · امروز " + fa(saved.count) + " جلسه";
      }
      function tick() {
        left--;
        if (left <= 0) {
          try { beep(); } catch (e) { }
          if (mode === "work") { saved.count++; saved.day = today; store("r14:pomo", saved); mode = "rest"; left = REST; toast("جلسه تمام شد! چند دقیقه استراحت کن ☕"); }
          else { mode = "work"; left = WORK; toast("استراحت تمام شد، برگرد سر درس 📖"); }
          stop();
        }
        show();
      }
      function start() { if (run) return; run = true; t = setInterval(tick, 1000); $("[data-pomo-start]", box).textContent = "توقف"; }
      function stop() { run = false; clearInterval(t); t = null; var b = $("[data-pomo-start]", box); if (b) b.textContent = "شروع"; }
      function reset() { stop(); left = mode === "work" ? WORK : REST; show(); }
      $("[data-pomo-start]", box).addEventListener("click", function () { run ? stop() : start(); });
      $("[data-pomo-reset]", box).addEventListener("click", reset);
      $("[data-pomo-skip]", box).addEventListener("click", function () {
        stop();
        if (mode === "work") { mode = "rest"; left = REST; } else { mode = "work"; left = WORK; }
        show();
      });
      show();
    }

    /* ── صدای پایان تایمر (بدون فایل بیرونی) ── */
    function beep() {
      try {
        var AC = W.AudioContext || W.webkitAudioContext;
        if (!AC) return;
        var ac = new AC(), o = ac.createOscillator(), g = ac.createGain();
        o.connect(g); g.connect(ac.destination);
        o.type = "sine"; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.2, ac.currentTime + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.8);
        o.start(); o.stop(ac.currentTime + 0.85);
        setTimeout(function () { try { ac.close(); } catch (e) { } }, 1200);
      } catch (e) { }
    }

    /* ── ماشین‌حساب ── */
    function calc() {
      var box = $("[data-calc]", root);
      if (!box) return;
      var inp = $("[data-calc-in]", box), out = $("[data-calc-out]", box);
      function evalSafe(s) {
        var t = s.replace(/[×xX]/g, "*").replace(/[÷/]/g, "/")
          .replace(/[−–—]/g, "-")            /* منهای یونیکد و خط تیره */
          .replace(/٪/g, "%").replace(/[\u06f0-\u06f9]/g, function (d) { return String("\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9".indexOf(d)); })
          .replace(/٫/g, ".").replace(/\s+/g, "");
        if (!/^[\d+\-*/().%]+$/.test(t)) return null;
        try {
          /* eslint-disable no-new-func */
          var v = Function('"use strict";return (' + t + ")")();
          return (typeof v === "number" && isFinite(v)) ? v : null;
        } catch (e) { return null; }
      }
      function go() {
        var v = evalSafe(inp.value);
        out.innerHTML = v == null ? "—" : fa(String(Math.round(v * 1e6) / 1e6));
      }
      inp.addEventListener("input", go);
      $$("[data-calc-k]", box).forEach(function (b) {
        b.addEventListener("click", function () {
          var k = b.getAttribute("data-calc-k");
          if (k === "=") { go(); return; }
          if (k === "C") { inp.value = ""; go(); return; }
          inp.value += k; go();
        });
      });
      go();
    }

    /* ── تبدیل یکا ── */
    function convert() {
      var box = $("[data-conv]", root);
      if (!box) return;
      var GROUP = {
        len: { "میلی‌متر": 0.001, "سانتی‌متر": 0.01, "متر": 1, "کیلومتر": 1000, "اینچ": 0.0254, "فوت": 0.3048 },
        mass: { "میلی‌گرم": 1e-6, "گرم": 0.001, "کیلوگرم": 1, "تُن": 1000 },
        time: { "ثانیه": 1, "دقیقه": 60, "ساعت": 3600, "روز": 86400 },
        area: { "سانتی‌متر مربع": 1e-4, "متر مربع": 1, "هکتار": 10000, "کیلومتر مربع": 1e6 },
        vol: { "میلی‌لیتر": 0.001, "لیتر": 1, "متر مکعب": 1000 }
      };
      var gSel = $("[data-conv-group]", box), fSel = $("[data-conv-from]", box), tSel = $("[data-conv-to]", box), inp = $("[data-conv-in]", box), out = $("[data-conv-out]", box);
      function fillUnits() {
        var opts = Object.keys(GROUP[gSel.value]).map(function (u) { return '<option value="' + u + '">' + u + "</option>"; }).join("");
        fSel.innerHTML = opts; tSel.innerHTML = opts;
        fSel.value = Object.keys(GROUP[gSel.value])[2] || fSel.options[0].value;
        tSel.value = Object.keys(GROUP[gSel.value])[0];
      }
      function go() {
        var t = GROUP[gSel.value], v = num(inp.value);
        var r = (v * t[fSel.value]) / t[tSel.value];
        out.innerHTML = fa(Math.round(r * 1e6) / 1e6);
      }
      gSel.addEventListener("change", function () { fillUnits(); go(); });
      [fSel, tSel, inp].forEach(function (e) { e.addEventListener("input", go); e.addEventListener("change", go); });
      fillUnits(); go();
    }

    /* ── تایمر آزمون ── */
    function examTimer() {
      var box = $("[data-extime]", root);
      if (!box) return;
      var clock = $("[data-ex-clock]", box), sel = $("[data-ex-min]", box);
      var left = 0, t = null;
      function show() {
        var m = Math.floor(left / 60), s = left % 60;
        clock.textContent = fa(m) + ":" + fa(s < 10 ? "0" + s : s);
        clock.classList.toggle("tb-timer-done", left === 0 && t === null && m === 0 && s === 0 && left !== 0);
      }
      function stop() { clearInterval(t); t = null; }
      $("[data-ex-start]", box).addEventListener("click", function () {
        stop();
        left = Math.max(1, Math.round(num(sel.value))) * 60;
        show();
        t = setInterval(function () {
          left--; show();
          if (left <= 0) { stop(); beep(); toast("زمان آزمون تمام شد! ✍️"); }
        }, 1000);
      });
      $("[data-ex-stop]", box).addEventListener("click", stop);
      left = 30 * 60; show();
    }

    /* ── فهرست کار روزانه ── */
    function todo() {
      var box = $("[data-todo]", root);
      if (!box) return;
      var list = store("r14:todo") || [];
      var ul = $("[data-todo-list]", box), inp = $("[data-todo-in]", box), bar = $("[data-todo-bar]", box);
      function paint() {
        ul.innerHTML = list.length ? list.map(function (x, i) {
          return '<li class="' + (x.d ? "done" : "") + '"><input type="checkbox" data-td="' + i + '"' + (x.d ? " checked" : "") + '><span>' +
            String(x.t).replace(/[<>&]/g, "") + '</span><button type="button" data-tx="' + i + '" aria-label="حذف">✕</button></li>';
        }).join("") : '<li style="justify-content:center;color:var(--muted)">هنوز کاری اضافه نکردی</li>';
        var done = list.filter(function (x) { return x.d; }).length;
        var pct = list.length ? Math.round((done / list.length) * 100) : 0;
        if (bar) bar.innerHTML = '<i style="inline-size:' + pct + '%"></i>';
        var lbl = $("[data-todo-pct]", box);
        if (lbl) lbl.textContent = list.length ? fa(pct) + "٪ انجام شد (" + fa(done) + " از " + fa(list.length) + ")" : "";
      }
      function add() {
        var v = (inp.value || "").trim();
        if (!v) return;
        list.push({ t: v, d: false });
        inp.value = ""; store("r14:todo", list); paint();
      }
      $("[data-todo-add]", box).addEventListener("click", add);
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add(); } });
      ul.addEventListener("click", function (e) {
        var c = e.target.closest ? e.target.closest("[data-td]") : null;
        if (c) { list[+c.getAttribute("data-td")].d = c.checked; store("r14:todo", list); paint(); return; }
        var x = e.target.closest ? e.target.closest("[data-tx]") : null;
        if (x) { list.splice(+x.getAttribute("data-tx"), 1); store("r14:todo", list); paint(); }
      });
      paint();
    }
  }
})();
