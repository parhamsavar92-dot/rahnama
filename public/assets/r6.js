/* ==========================================================================
   رهنما — لایهٔ تعاملی ۶٫۰  |  r6.js
   --------------------------------------------------------------------------
   افزودنی و بی‌خطر: اگر هر بخشی لازم نبود، همان بخش خاموش می‌ماند و بقیهٔ
   صفحه دست‌نخورده کار می‌کند. هیچ اسکریپت دیگری را بازنویسی نمی‌کند.

   ۱) «دستیار همراه» روی همهٔ صفحه‌ها
        • اگر کاربر وارد شده باشد و سرور دستیار داشته باشد → پاسخ از سرور
          با پخش زنده (SSE) و متن جزوهٔ مرتبط به‌عنوان منبع.
        • در غیر این صورت → موتور محلی روی نمایهٔ درسی سایت (بدون اینترنت).
   ۲) فهرست شناور درس (از عنوان‌های همان صفحه ساخته می‌شود)
   ۳) نوار پیشرفت مطالعه + زمان تقریبی خواندن
   ۴) سایهٔ سربرگ هنگام اسکرول، نشانگر آنلاین/آفلاین، پیوند پرش دسترس‌پذیری
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  var R6 = (W.R6 = W.R6 || {});
  if (R6.ready) return;
  R6.ready = true;

  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  };
  function toast(m, ms) {
    try {
      if (W.HK && W.HK.toast) return W.HK.toast(m, ms);
      if (W.G8 && W.G8.toast) return W.G8.toast(m, ms);
    } catch (e) {}
    var t = D.createElement("div");
    t.className = "r6-toast";
    t.textContent = m;
    t.style.cssText = "position:fixed;inset-inline:0;margin:auto;bottom:26px;width:max-content;max-width:90vw;" +
      "background:#161a2b;color:#fff;padding:10px 16px;border-radius:12px;z-index:9999;font-size:.85rem;font-weight:700;" +
      "box-shadow:0 14px 40px rgba(0,0,0,.35)";
    D.body.appendChild(t);
    setTimeout(function () { t.remove(); }, ms || 3200);
  }
  R6.toast = toast;

  /* ---------------------------------------------------------- ابزار متن فارسی */
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  function nfa(s) { return String(s == null ? "" : s).replace(/[۰-۹]/g, function (d) { return String(NFA.indexOf(d)); }); }
  function norm(s) {
    return nfa(String(s == null ? "" : s))
      .replace(/[\u064B-\u0652\u0670\u0640]/g, "")
      .replace(/[يﻯﻰ]/g, "ی").replace(/[كﻙ]/g, "ک")
      .replace(/[أإآٱ]/g, "ا").replace(/[ؤئ]/g, "ی").replace(/ۀ/g, "ه")
      .replace(/[^\p{L}\p{N} ]/gu, " ")
      .replace(/\s+/g, " ").trim().toLowerCase();
  }
  var STOP = {};
  ("و در به از که این را با برای است هست یک آن های ها یا اگر تا هم نه بله چه چی کی کجا چطور چگونه چرا می شود شده بود بودن کن بکن بگو بده ولی اما پس نیز دیگر خیلی همه هر بعضی بر ای ان درباره مورد طریق انجام داشته دارد لطفا میشه یعنی چیست چیه تعریف معنی کدام توضیح فرمول رابطه قاعده قانون تفاوت فرق مقایسه مثال نمونه فهرست انواع علت دلیل مراحل خلاصه چکیده چند بساز بزن بنویس").split(" ")
    .forEach(function (w) { STOP[w] = 1; });
  function toks(s) {
    return norm(s).split(" ").filter(function (t) { return t.length > 1 && !STOP[t]; });
  }

  /* ------------------------------------------------------------ پایهٔ جاری */
  function currentGrade() {
    try {
      var q = new URLSearchParams(location.search).get("g");
      if (q) return q;
    } catch (e) {}
    if (W.G8 && W.G8.LS) { var g = W.G8.LS.get("g8:grade", null); if (g) return String(g); }
    var b = D.body && D.body.getAttribute("data-grade");
    return b || "8";
  }
  function basePath() {
    var tag = D.querySelector('script[src*="r6.js"]');
    var b = "";
    if (tag && tag.src) {
      try { b = new URL(tag.src, location.href).pathname.replace(/assets\/r6\.js.*$/, ""); } catch (e) { b = ""; }
    }
    if (!b) {
      var m = D.body && D.body.getAttribute("data-base");
      b = m || "";
      if (b === "/") b = "";
    }
    return b;
  }
  var BASE = basePath();
  function url(p) {
    if (W.G8 && W.G8.url) { try { return W.G8.url(p); } catch (e) {} }
    if (!p) return p;
    if (/^(https?:|mailto:|tel:|#|\/)/.test(p)) return p;
    return BASE + p;
  }

  /* ======================================================================
     ۱) موتور محلی: جست‌وجو در نمایهٔ درس‌ها (بدون اینترنت، بدون کلید)
     ====================================================================== */
  var IDX = null, IDX_P = null;
  function loadIndex() {
    if (IDX_P) return IDX_P;
    IDX_P = fetch(url("assets/search-index.json"), { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (j) {
        IDX = Array.isArray(j) ? j : [];
        IDX.forEach(function (row) {
          row._n = norm(row.t);
          row._b = norm(row.bn);
          row._s = norm(row.s);
          row._hay = row._n + " " + row._b + " " + row._s;
        });
        return IDX;
      })
      .catch(function () { IDX = []; return IDX; });
    return IDX_P;
  }
  R6.loadIndex = loadIndex;

  function search(query, limit) {
    if (!IDX || !IDX.length) return [];
    var g = currentGrade();
    var ph = norm(query);
    if (!ph) return [];
    var ts = toks(query);
    if (!ts.length) ts = ph.split(" ").filter(function (t) { return t.length > 1; });
    if (!ts.length) return [];
    var out = [];
    for (var i = 0; i < IDX.length; i++) {
      var r = IDX[i], sc = 0, k;
      for (k = 0; k < ts.length; k++) {
        var t = ts[k];
        if (r._n.indexOf(t) > -1) sc += 12;
        if (r._b.indexOf(t) > -1) sc += 5;
        var idx = r._s.indexOf(t);
        if (idx > -1) { sc += 2.4; if (idx < 90) sc += 1; }
      }
      if (r._hay.indexOf(ph) > -1) sc += 9;
      if (sc <= 0) continue;
      if (String(r.g) === String(g)) sc *= 1.6;
      out.push({ row: r, score: sc });
    }
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, limit || 4);
  }
  R6.search = search;

  function snippet(text, max) {
    var s = String(text || "").replace(/\s+/g, " ").trim();
    if (s.length <= max) return s;
    var cut = s.slice(0, max);
    var sp = cut.lastIndexOf(" ");
    return (sp > max * 0.6 ? cut.slice(0, sp) : cut) + "…";
  }

  /* پاسخ محلی: اول نمایه را مطمئناً بارگذاری می‌کند، بعد پاسخ می‌دهد.
     (به همین دلیل Promise برمی‌گرداند.) */
  function localAnswer(q) {
    return loadIndex().then(function () {
      var hits = search(q, 4);
      if (!hits.length) {
        return {
          text: "برای این پرسش، مطلب مستقیمی در جزوه‌های بارگذاری‌شده پیدا نکردم. " +
            "می‌توانی واژهٔ اصلی را کوتاه‌تر بنویسی (مثلاً «قضیهٔ فیثاغورس» یا «آرایه‌های ادبی»)، " +
            "یا از بخش «جست‌وجوی سراسری» با Ctrl + K استفاده کنی.",
          src: []
        };
      }
      var lines = ["بر پایهٔ جزوه‌های همین سایت:"];
      var src = [];
      hits.slice(0, 3).forEach(function (h, i) {
        var r = h.row;
        lines.push((i + 1) + ". " + r.t + " — " + snippet(r.s, 190));
        src.push({ t: r.t, bn: r.bn, url: r.url });
      });
      lines.push("برای مطالعهٔ کامل، روی پیوندهای زیر بزن.");
      return { text: lines.join("\n"), src: src, hits: hits };
    });
  }
  R6.localAnswer = localAnswer;

  /* ======================================================================
     ۲) وضعیت سرور دستیار
     ====================================================================== */
  var SRV = { known: false, ai: false, providers: [], model: null, version: "" };
  function probeServer() {
    return fetch("/api/health", { credentials: "same-origin" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        SRV.known = true;
        SRV.ai = !!(j && j.ai && j.ai.configured);
        SRV.providers = (j && j.ai && j.ai.providers) || [];
        SRV.model = j && j.ai ? j.ai.defaultModel : null;
        SRV.version = (j && j.version) || "";
        return SRV;
      })
      .catch(function () { SRV.known = true; SRV.ai = false; return SRV; });
  }
  R6.server = function () { return SRV; };

  /* ------------------------------------------------- پاسخ سرور با پخش زنده */
  function serverAnswer(messages, ctx, onDelta) {
    return fetch("/api/ai/chat/completions", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        messages: messages.slice(-12),
        grade: currentGrade(),
        context: ctx || "",
        stream: true
      })
    }).then(function (r) {
      if (!r.ok) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          var e = new Error((j && j.error) || ("خطا " + r.status));
          e.status = r.status;
          throw e;
        });
      }
      var ct = r.headers.get("Content-Type") || "";
      if (ct.indexOf("text/event-stream") !== 0 || !r.body || !r.body.getReader) {
        return r.json().then(function (j) {
          var txt = j && j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : "";
          if (onDelta && txt) onDelta(txt);
          return { text: txt, provider: j && j.provider };
        });
      }
      var reader = r.body.getReader(), dec = new TextDecoder(), buf = "", full = "";
      return (function pump() {
        return reader.read().then(function (x) {
          if (x.done) return { text: full, provider: r.headers.get("X-AI-Provider") };
          buf += dec.decode(x.value, { stream: true });
          var i;
          while ((i = buf.indexOf("\n")) > -1) {
            var line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (line.indexOf("data:") !== 0) continue;
            var payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              var o = JSON.parse(payload);
              var d = o.choices && o.choices[0] && o.choices[0].delta ? o.choices[0].delta.content : "";
              if (d) { full += d; if (onDelta) onDelta(d); }
            } catch (e) {}
          }
          return pump();
        });
      })();
    });
  }

  /* ======================================================================
     ۳) «دستیار همراه» — دکمهٔ شناور روی همهٔ صفحه‌ها
     ====================================================================== */
  var AI_HTML =
    '<div class="r6-ai-head">' +
    '  <span class="r6-ai-mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" width="19" height="19">' +
    '  <path d="M12 3a1.6 1.6 0 0 1 1.6 1.6v.4a6.4 6.4 0 0 1 3.1 2L18 6.4a1.6 1.6 0 1 1 1.6 2.8l-1.2.7a6.4 6.4 0 0 1 0 3.6l1.2.7a1.6 1.6 0 1 1-1.6 2.8l-1.2-.7a6.4 6.4 0 0 1-2.7 2v.4a1.6 1.6 0 1 1-3.2 0v-.4a6.4 6.4 0 0 1-2.7-2l-1.2.7a1.6 1.6 0 1 1-1.6-2.8l1.2-.7a6.4 6.4 0 0 1 0-3.6l-1.2-.7A1.6 1.6 0 1 1 6.8 6.4l1.2.7a6.4 6.4 0 0 1 3.1-2v-.4A1.6 1.6 0 0 1 12 3z"/><circle cx="12" cy="12" r="2.6"/></svg></span>' +
    '  <div style="flex:1"><b>دستیار رهنما</b><small data-r6-mode>در حال آماده‌سازی…</small></div>' +
    '  <button class="icon-btn" data-r6-clear aria-label="پاک‌کردن گفت‌وگو" title="گفت‌وگوی تازه">' +
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg></button>' +
    '  <button class="icon-btn" data-r6-close aria-label="بستن">' +
    '  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="17" height="17"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
    "</div>" +
    '<div class="r6-ai-log" data-r6-log></div>' +
    '<div class="r6-ai-chips" data-r6-chips></div>' +
    '<div class="r6-ai-row"><textarea data-r6-input rows="1" placeholder="سؤالت را بنویس…" aria-label="پرسش"></textarea>' +
    '<button class="r6-ai-send" data-r6-send aria-label="ارسال"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="19" height="19"><path d="M20 12 4.5 4.5 7 12l-2.5 7.5z"/><path d="M7 12h13"/></svg></button></div>';

  var CHIPS = [
    "این فصل را خلاصه کن",
    "برای این درس ۵ سؤال بساز",
    "فرمول‌های مهم این بخش چیست؟",
    "یک مثال حل‌شده بده",
    "این مفهوم را ساده‌تر توضیح بده"
  ];

  var AI = null;
  function buildAI() {
    if (AI || !D.body) return AI;
    var fab = D.createElement("button");
    fab.id = "r6-ai-fab";
    fab.type = "button";
    fab.setAttribute("aria-label", "دستیار هوشمند رهنما");
    fab.title = "دستیار هوشمند (Alt + K)";
    fab.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 3l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z"/><path d="M18.5 15.5l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z"/></svg>';

    var panel = D.createElement("section");
    panel.id = "r6-ai-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "دستیار هوشمند رهنما");
    panel.innerHTML = AI_HTML;

    D.body.appendChild(fab);
    D.body.appendChild(panel);

    var log = $("[data-r6-log]", panel);
    var input = $("[data-r6-input]", panel);
    var sendBtn = $("[data-r6-send]", panel);
    var modeEl = $("[data-r6-mode]", panel);
    var chips = $("[data-r6-chips]", panel);
    var history = LS.get("r6:ai:hist", []) || [];
    var busy = false;

    AI = { fab: fab, panel: panel, log: log, input: input, send: sendBtn, mode: modeEl, history: history };

    CHIPS.forEach(function (c) {
      var b = D.createElement("button");
      b.type = "button";
      b.textContent = c;
      b.addEventListener("click", function () { ask(c); });
      chips.appendChild(b);
    });

    function push(role, html, src) {
      var el = D.createElement("div");
      el.className = "r6-msg " + (role === "me" ? "me" : "ai");
      el.innerHTML = html + (src && src.length ? srcHtml(src) : "");
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }
    function srcHtml(src) {
      var h = '<span class="r6-ai-src">';
      src.slice(0, 4).forEach(function (s) {
        h += '<a href="' + esc(url(s.url)) + '">' + esc(s.bn ? s.bn + " · " + s.t : s.t) + "</a>";
      });
      return h + "</span>";
    }
    function setMode(txt, ok) {
      if (!modeEl) return;
      modeEl.textContent = txt;
      modeEl.style.color = ok ? "var(--ok)" : "";
    }
    function typing() {
      var el = D.createElement("div");
      el.className = "r6-msg ai";
      el.innerHTML = '<span class="r6-typing"><span></span><span></span><span></span></span>';
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    /* متن درسِ همین صفحه به‌عنوان منبع، برای پاسخ مستند */
    function pageContext() {
      var art = $("article.lesson") || $("main");
      if (!art) return "";
      var t = art.innerText || art.textContent || "";
      return t.replace(/\s+/g, " ").trim().slice(0, 9000);
    }

    function ask(q) {
      q = String(q || "").trim();
      if (!q || busy) return;
      busy = true;
      sendBtn.disabled = true;
      input.value = "";
      input.style.height = "auto";
      push("me", esc(q));
      history.push({ role: "user", content: q });
      if (history.length > 24) history = history.slice(-24);

      var bubble = typing();
      var got = "";
      var done = function (text, src, note) {
        bubble.className = "r6-msg ai";
        bubble.innerHTML = esc(text).replace(/\n/g, "<br>") + (note ? '<span class="src">' + esc(note) + "</span>" : "") + (src && src.length ? srcHtml(src) : "");
        log.scrollTop = log.scrollHeight;
        history.push({ role: "assistant", content: text });
        if (history.length > 24) history = history.slice(-24);
        LS.set("r6:ai:hist", history);
        busy = false;
        sendBtn.disabled = false;
        input.focus();
      };

      var localFallback = function (reason) {
        localAnswer(q).then(function (a) {
          done(a.text, a.src, reason || "پاسخ از موتور محلی سایت — بدون اینترنت و بدون کلید");
        }).catch(function () {
          done("نمایهٔ درس‌ها بارگذاری نشد. اگر تازه سایت را باز کرده‌ای یک‌بار صفحه را تازه کن.", [], "");
        });
      };

      if (SRV.ai) {
        var ctx = pageContext();
        serverAnswer(history.slice(-8), ctx, function (d) {
          got += d;
          bubble.className = "r6-msg ai";
          bubble.innerHTML = esc(got).replace(/\n/g, "<br>");
          log.scrollTop = log.scrollHeight;
        }).then(function (out) {
          var text = (out && out.text) || got;
          if (!text) return localFallback("سرور پاسخی برنگرداند؛ پاسخ از موتور محلی سایت");
          var note = "پاسخ از سرور سایت" + (out.provider ? " (" + out.provider + ")" : "");
          localAnswer(q).then(function (a) { done(text, a.src, note); })
            .catch(function () { done(text, [], note); });
        }).catch(function (e) {
          if (e && e.status === 401) return localFallback("برای پاسخ سروری وارد حساب شو؛ فعلاً از موتور محلی پاسخ داده شد");
          if (got) return done(got, [], "پاسخ ناقص از سرور");
          localFallback("ارتباط با سرور برقرار نشد؛ پاسخ از موتور محلی سایت");
        });
      } else {
        setTimeout(function () { localFallback(); }, 120);
      }
    }
    AI.ask = ask;

    /* پیام خوش‌آمد */
    if (history.length) {
      history.slice(-6).forEach(function (m) {
        push(m.role === "user" ? "me" : "ai", esc(m.content).replace(/\n/g, "<br>"));
      });
    } else {
      push("ai", "سلام! من دستیار رهنما هستم. هر جای جزوه گیر کردی بپرس — خلاصه، نمونه‌سؤال، فرمول یا توضیح ساده. " +
        "می‌توانی جواب را از دل همین جزوه بگیری، حتی بدون اینترنت.");
    }

    function toggle(open) {
      var on = open == null ? !panel.classList.contains("is-open") : !!open;
      panel.classList.toggle("is-open", on);
      fab.classList.toggle("is-open", on);
      if (on) setTimeout(function () { input.focus(); }, 220);
    }
    AI.toggle = toggle;
    fab.addEventListener("click", function () { toggle(); });
    $("[data-r6-close]", panel).addEventListener("click", function () { toggle(false); });
    $("[data-r6-clear]", panel).addEventListener("click", function () {
      history = []; AI.history = history; LS.set("r6:ai:hist", []);
      log.innerHTML = "";
      push("ai", "گفت‌وگوی تازه شروع شد. چه چیزی را توضیح بدهم؟");
      toast("گفت‌وگو پاک شد");
    });
    sendBtn.addEventListener("click", function () { ask(input.value); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); }
    });
    input.addEventListener("input", function () {
      input.style.height = "auto";
      input.style.height = Math.min(input.scrollHeight, 130) + "px";
    });
    D.addEventListener("keydown", function (e) {
      if (e.altKey && (e.key === "k" || e.key === "K")) { e.preventDefault(); toggle(); }
      if (e.key === "Escape" && panel.classList.contains("is-open")) toggle(false);
    });

    probeServer().then(function (s) {
      if (s.ai) setMode("متصل — پاسخ از سرور سایت" + (s.model ? " · " + s.model : ""), true);
      else setMode("محلی — پاسخ از دل جزوه، بدون اینترنت", false);
    });

    return AI;
  }

  /* ======================================================================
     ۴) فهرست شناور درس (TOC) + پیشرفت مطالعه + زمان خواندن
     ====================================================================== */
  function buildTOC() {
    var heads = $$("article.lesson h2, article.lesson h3, section.panel > h2, main section > h2");
    if (heads.length < 3) return;
    var seen = {}, list = [];
    heads.forEach(function (h, i) {
      var txt = (h.textContent || "").trim();
      if (!txt || seen[txt]) return;
      seen[txt] = 1;
      if (!h.id) h.id = "r6h" + i;
      list.push({ id: h.id, text: txt, el: h, lvl: h.tagName === "H3" ? 1 : 0 });
    });
    if (list.length < 3) return;

    var box = D.createElement("nav");
    box.id = "r6-toc";
    box.setAttribute("aria-label", "فهرست این صفحه");
    box.innerHTML = "<h4>فهرست این صفحه</h4>" + list.map(function (x) {
      return '<a href="#' + esc(x.id) + '" data-lvl="' + x.lvl + '">' + esc(x.text) + "</a>";
    }).join("") + '<a href="#" data-r6-top style="margin-top:8px;color:var(--muted)">↑ بازگشت به بالا</a>';

    var btn = D.createElement("button");
    btn.id = "r6-toc-toggle";
    btn.type = "button";
    btn.setAttribute("aria-label", "فهرست صفحه");
    btn.title = "فهرست این صفحه";
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" width="20" height="20"><path d="M4 6h16M4 12h11M4 18h7"/></svg>';

    D.body.appendChild(box);
    D.body.appendChild(btn);
    btn.addEventListener("click", function () { box.classList.toggle("is-open"); });
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-r6-top]")) { e.preventDefault(); W.scrollTo({ top: 0, behavior: "smooth" }); }
      if (e.target.tagName === "A" && W.innerWidth < 1500) box.classList.remove("is-open");
    });

    var links = $$("a", box).filter(function (a) { return a.getAttribute("href") !== "#"; });
    if ("IntersectionObserver" in W) {
      var io = new IntersectionObserver(function (ents) {
        ents.forEach(function (en) {
          if (!en.isIntersecting) return;
          links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + en.target.id); });
        });
      }, { rootMargin: "-15% 0px -75% 0px" });
      list.forEach(function (x) { io.observe(x.el); });
    }
    box.style.insetBlockStart = "50%";
  }

  function readingProgress() {
    // اگر #readbar از قبل هست، app.js خودش آن را پر می‌کند؛ دوباره دست نمی‌زنیم
    // تا مقدار پیشرفت دو بار اعمال نشود.
    if ($("#readbar")) {
      var r0 = 0;
      W.addEventListener("scroll", function () {
        if (r0) return;
        r0 = W.requestAnimationFrame(function () { r0 = 0; D.body.classList.toggle("r6-scrolled", W.scrollY > 8); });
      }, { passive: true });
      return;
    }
    var bar = D.createElement("div");
    bar.id = "readbar";
    bar.style.cssText = "position:fixed;top:0;inset-inline:0;height:3px;transform-origin:right;transform:scaleX(0);z-index:400";
    D.body.insertBefore(bar, D.body.firstChild);
    var raf = 0;
    function upd() {
      raf = 0;
      var h = D.documentElement.scrollHeight - W.innerHeight;
      var p = h > 40 ? Math.min(1, Math.max(0, W.scrollY / h)) : 0;
      bar.style.transform = "scaleX(" + p + ")";
      D.body.classList.toggle("r6-scrolled", W.scrollY > 8);
    }
    W.addEventListener("scroll", function () { if (!raf) raf = W.requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  function readingTime() {
    var art = $("article.lesson");
    if (!art || $("[data-r6-rt]")) return;
    var words = (art.innerText || "").trim().split(/\s+/).length;
    if (words < 120) return;
    var mins = Math.max(1, Math.round(words / 190));
    var chip = D.createElement("div");
    chip.setAttribute("data-r6-rt", "1");
    chip.className = "r6-badge";
    chip.style.margin = "10px 0";
    chip.textContent = "زمان تقریبی مطالعه: " + mins + " دقیقه";
    var h = art.querySelector("h2") || art.firstElementChild;
    if (h && h.parentNode) h.parentNode.insertBefore(chip, h.nextSibling);
  }

  /* ------------------------------------------------- شبکه و دسترس‌پذیری */
  function netBadge() {
    var b = D.createElement("div");
    b.id = "r6-net";
    b.innerHTML = '<span class="r6-badge is-on">حالت آنلاین</span>';
    b.style.display = "none";
    D.body.appendChild(b);
    function upd() {
      var on = navigator.onLine;
      b.style.display = on ? "none" : "";
      b.querySelector(".r6-badge").className = "r6-badge " + (on ? "is-on" : "is-off");
      b.querySelector(".r6-badge").textContent = on ? "حالت آنلاین" : "حالت آفلاین — از حافظهٔ دستگاه";
    }
    W.addEventListener("online", upd);
    W.addEventListener("offline", upd);
    upd();
  }

  function skipLink() {
    if ($(".r6-skip") || !$("main")) return;
    var a = D.createElement("a");
    a.className = "r6-skip";
    a.href = "#main-anchor";
    a.textContent = "پرش به محتوای اصلی";
    var m = $("main");
    if (!m.id) { m.id = "main-anchor"; a.href = "#main-anchor"; }
    else a.href = "#" + m.id;
    D.body.insertBefore(a, D.body.firstChild);
  }

  /* دستیار باید بالای دکمهٔ «پنل مشاوره» بنشیند؛ آن دکمه ممکن است با
     کمی تأخیر ساخته شود، پس تا چند ثانیه نگاه می‌کنیم. */
  function stackFab() {
    if ($(".hk-fab")) { D.body.classList.add("r6-has-fab"); return true; }
    return false;
  }
  function watchFab() {
    if (stackFab()) return;
    var n = 0;
    var iv = setInterval(function () { n++; if (stackFab() || n > 16) clearInterval(iv); }, 500);
    if (W.MutationObserver) {
      var mo = new MutationObserver(function () { if (stackFab()) mo.disconnect(); });
      mo.observe(D.body, { childList: true });
      setTimeout(function () { mo.disconnect(); }, 9000);
    }
  }

  function stickyHeader() {
    var h = $(".site-header");
    if (!h) return;
    var raf = 0;
    function upd() { raf = 0; h.classList.toggle("is-stuck", W.scrollY > 10); }
    W.addEventListener("scroll", function () { if (!raf) raf = W.requestAnimationFrame(upd); }, { passive: true });
    upd();
  }

  /* ======================================================================
     ۵) کارت‌های تازهٔ پنل مدیریت: سلامت سرور + مصرف دستیار هوشمند
     ====================================================================== */
  function adminExtras() {
    var kpis = $("#admKpis");
    if (!kpis || $("#r6AdmCards")) return;
    var box = D.createElement("div");
    box.id = "r6AdmCards";
    box.className = "grid-2";
    box.style.margin = "4px 0 18px";
    box.innerHTML =
      '<div class="card" data-r6-health><h4><span class="card-icon">♥</span> سلامت سرور</h4>' +
      '<p style="color:var(--muted)">در حال بررسی…</p></div>' +
      '<div class="card" data-r6-usage><h4><span class="card-icon">◍</span> مصرف دستیار هوشمند</h4>' +
      '<p style="color:var(--muted)">در حال بارگذاری…</p></div>';
    kpis.parentNode.insertBefore(box, kpis.nextSibling);

    var rows = function (list) {
      return '<ul class="ticks" style="margin-top:8px">' + list.map(function (x) {
        return "<li><b>" + esc(x[0]) + ":</b> " + esc(x[1]) + "</li>";
      }).join("") + "</ul>";
    };

    fetch("/api/health", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var el = $("[data-r6-health]", box);
        if (!el) return;
        el.innerHTML = "<h4><span class=\"card-icon\">♥</span> سلامت سرور</h4>" + rows([
          ["وضعیت", j.ok ? "سالم" : "مشکل دارد"],
          ["نسخه", j.version || "—"],
          ["دیتابیس D1", (j.db && j.db.ok ? "متصل" : "قطع") + (j.db ? " · " + j.db.latencyMs + "ms" : "")],
          ["کاربران", j.db ? String(j.db.users) : "—"],
          ["دستیار", j.ai && j.ai.configured ? "فعال (" + (j.ai.providers || []).join("، ") + ")" : "خاموش — موتور محلی"],
          ["زمان پاسخ سرور", (j.uptimeSeconds != null ? j.uptimeSeconds + " ثانیه از شروع" : "—")]
        ]);
      })
      .catch(function () {
        var el = $("[data-r6-health]", box);
        if (el) el.innerHTML = "<h4><span class=\"card-icon\">♥</span> سلامت سرور</h4><p>ارتباط با سرور برقرار نشد.</p>";
      });

    fetch("/api/admin/ai-usage", { credentials: "same-origin" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var el = $("[data-r6-usage]", box);
        if (!el) return;
        if (j.error) { el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4><p>" + esc(j.error) + "</p>"; return; }
        var bars = (j.usage || []).slice(-7).map(function (d) {
          var w = Math.min(100, Math.round((d.total / Math.max(1, j.total)) * 100));
          return '<div style="display:flex;align-items:center;gap:8px;margin:5px 0;font-size:.78rem">' +
            '<span style="min-width:76px;color:var(--muted)">' + esc(d.day) + "</span>" +
            '<span style="flex:1;height:8px;border-radius:99px;background:var(--surface-3);overflow:hidden">' +
            '<span style="display:block;height:100%;width:' + w + '%;background:linear-gradient(90deg,var(--brand),var(--brand-3))"></span></span>' +
            '<b style="min-width:28px;text-align:center">' + esc(String(d.total || 0)) + "</b></div>";
        }).join("");
        el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4>" +
          (j.providers && j.providers.length
            ? "<p style=\"font-size:.8rem;color:var(--muted)\">ارائه‌دهنده: <b>" + esc(j.providers.join("، ")) + "</b>" + (j.model ? " · " + esc(j.model) : "") + "</p>"
            : "<p style=\"font-size:.8rem;color:var(--muted)\">دستیار سروری تنظیم نشده؛ پاسخ‌ها از موتور محلی سایت می‌آید.</p>") +
          (bars || "<p style=\"font-size:.8rem;color:var(--muted)\">هنوز مصرفی ثبت نشده است.</p>") +
          '<p style="font-size:.78rem;margin-top:8px">جمع هفتهٔ اخیر: <b>' + esc(String(j.total || 0)) + "</b> پرسش</p>";
      })
      .catch(function () {
        var el = $("[data-r6-usage]", box);
        if (el) el.innerHTML = "<h4><span class=\"card-icon\">◍</span> مصرف دستیار هوشمند</h4><p>در دسترس نیست.</p>";
      });
  }

  /* ------------------------------------------------------------ راه‌اندازی */
  function boot() {
    try { skipLink(); } catch (e) {}
    try { stickyHeader(); } catch (e) {}
    try { readingProgress(); } catch (e) {}
    try { netBadge(); } catch (e) {}
    try { buildTOC(); } catch (e) {}
    try { readingTime(); } catch (e) {}
    try { loadIndex(); } catch (e) {}     // نمایهٔ محلی را از پیش آماده می‌کند
    try { buildAI(); } catch (e) {}
    try { watchFab(); } catch (e) {}
    try { adminExtras(); } catch (e) {}
    R6.buildAI = function () { return buildAI(); };
    R6.openAssistant = function (q) {
      var a = buildAI();
      if (!a) return;
      a.toggle(true);
      if (q) a.ask(q);
    };
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
