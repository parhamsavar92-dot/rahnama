/* ==========================================================================
   رهنما نسخهٔ ۲ — مشاور و دستیار هوشمند آنلاین  |  ai2.js
   • اتصال به سرویس‌های قوی هوش مصنوعی (OpenAI، OpenRouter، Groq، DeepSeek، Gemini)
     و همچنین پروکسی سرور خودمان (/api/ai) تا کلید روی سرور بماند.
   • حالت آنلاین: پاسخ‌سازی از دل جزوه‌های خود سایت (بدون اینترنت).
   • ساخت برنامهٔ مطالعه، رفع اشکال درس‌به‌درس و پرسش و پاسخ.
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var J = (W.G8 && W.G8.jsonLoad) || function (p) { return fetch(U(p)).then(function (r) { return r.json(); }); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  var GRADE_NAME = { "7": "هفتم", "8": "هشتم", "9": "نهم" };

  var LS = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  var CFG = Object.assign({
    mode: "auto",              // auto | proxy | openai | openrouter | groq | deepseek | gemini | offline
    key: "",
    model: "",
    baseUrl: "",
    temp: 0.4
  }, LS.get("g8:ai2", {}) || {});

  var PROVIDERS = {
    openai: { label: "OpenAI", base: "https://api.openai.com/v1", model: "gpt-4o-mini", kind: "oai" },
    openrouter: { label: "OpenRouter", base: "https://openrouter.ai/api/v1", model: "openai/gpt-4o-mini", kind: "oai" },
    groq: { label: "Groq (سریع)", base: "https://api.groq.com/openai/v1", model: "llama-3.3-70b-versatile", kind: "oai" },
    deepseek: { label: "DeepSeek", base: "https://api.deepseek.com/v1", model: "deepseek-chat", kind: "oai" },
    gemini: { label: "Google Gemini", base: "https://generativelanguage.googleapis.com/v1beta", model: "gemini-2.0-flash", kind: "gemini" },
    proxy: { label: "سرور خود سایت", base: "/api/ai", model: "", kind: "oai" }
  };

  function grade() {
    var q = new URLSearchParams(location.search).get("g") || D.body.getAttribute("data-grade") || "8";
    return ["7", "8", "9"].indexOf(q) > -1 ? q : "8";
  }

  /* ------------------------------------------------------- نمایهٔ درسی */
  var KB = null;
  function loadKB() {
    if (KB) return Promise.resolve(KB);
    return J("assets/search-index.json")
      .then(function (j) { KB = j; return j; }).catch(function () { KB = []; return []; });
  }

  /* ------------------------------------------- یافتن درس‌های مرتبط */
  function relevant(question, limit) {
    return loadKB().then(function (rows) {
      var g = grade();
      var terms = String(question).toLowerCase()
        .replace(/[؟?!.,،:;()"'«»\-–—]/g, " ")
        .split(/\s+/).filter(function (t) { return t.length > 2; });
      if (!terms.length) return [];
      var scored = rows.map(function (r) {
        var hay = (r.t + " " + r.s + " " + r.bn).toLowerCase();
        var sc = 0;
        terms.forEach(function (t) { if (hay.indexOf(t) > -1) sc += (r.t.toLowerCase().indexOf(t) > -1 ? 3 : 1); });
        if (r.g === g) sc += 1.2;
        return { r: r, sc: sc };
      }).filter(function (x) { return x.sc > 0; });
      scored.sort(function (a, b) { return b.sc - a.sc; });
      return scored.slice(0, limit || 4).map(function (x) { return x.r; });
    });
  }

  /* ------------------------------------------- پاسخ‌ساز محلی */
  function offlineAnswer(question) {
    return relevant(question, 4).then(function (hits) {
      if (!hits.length) {
        return {
          text: "در جزوه‌های سایت پاسخی برای این پرسش پیدا نکردم.\n\n" +
            "برای پاسخ دقیق‌تر می‌توانید:\n" +
            "• پرسش را با واژه‌های کتاب درسی بنویسید (مثلاً «عدد گویا»، «هم‌نهشتی مثلث»، «تجوید»).\n" +
            "• در فهرست جزوه‌ها جست‌وجو کنید.\n" +
            "• از بخش تنظیمات، دستیار آنلاین را وصل کنید تا پاسخ تحلیلی بگیرید.",
          sources: []
        };
      }
      var parts = hits.map(function (h) {
        var body = (h.s || "").replace(/\s+/g, " ").trim();
        if (body.length > 320) body = body.slice(0, 320) + "…";
        return "◆ " + h.t + " (" + h.bn + " — پایهٔ " + (GRADE_NAME[h.g] || "") + ")\n" + body;
      });
      return {
        text: "بر پایهٔ جزوه‌های همین سایت، مرتبط‌ترین درس‌ها را پیدا کردم:\n\n" + parts.join("\n\n") +
          "\n\nبرای دیدن شرح کامل، هر درس را از فهرست باز کنید.",
        sources: hits
      };
    });
  }

  /* ------------------------------------------- درخواست آنلاین */
  /* ▼ دستیار بدون تنظیم کار می‌کند.
     خواستهٔ کاربر: «کاربر نیاز نباشد کلید API وارد کند یا مدل انتخاب کند.»
     پس همیشه از موتور متصل به خودِ سایت (/api/ai) استفاده می‌کنیم که
     روی سرور با هوش مصنوعی قوی کار می‌کند و کلیدی لازم ندارد.
     اگر آن لحظه اینترنت یا سرویس در دسترس نباشد، خودکار به موتور
     مستقل داخلی برمی‌گردیم تا باز هم پاسخ بگیرد. */
  function resolveProvider() {
    return "proxy";
  }
  /* موتور مستقل، فقط وقتی اتصال ممکن نبود به‌کار می‌آید. */
  function allowOfflineFallback() { return true; }

  function sysPrompt(context) {
    var g = grade();
    /* ▼ دستیار دیگر محدود به «فقط محتوای سایت» نیست.
       پیش‌تر قاعدهٔ ۵ می‌گفت پرسش‌های بیرون از درس را کوتاه رد کن؛
       نتیجه این بود که دستیار به بسیاری از پرسش‌ها جواب نمی‌داد.
       حالا رهنما یک دستیار دانا و همه‌فن‌حریف است: هر پرسشی را پاسخ
       می‌دهد، از ریاضی و علوم تا فناوری، برنامه‌نویسی، تاریخ، ادبیات،
       نگارش، مهارت مطالعه و پرسش‌های عمومی — و در درس‌های مدرسه
       دقیق‌تر و گام‌به‌گام‌تر عمل می‌کند. */
    return "تو «رهنما» هستی؛ دستیار هوشمند، دانا و همه‌فن‌حریفِ فارسی‌زبان. " +
      "کاربر اصلی‌ات دانش‌آموز دورهٔ متوسطهٔ اول (هفتم، هشتم، نهم) در ایران است، " +
      "اما محدود به کتاب درسی نیستی و به هر پرسشی که از تو پرسیده شود پاسخ می‌دهی.\n" +
      "پایهٔ کاربر: " + (GRADE_NAME[g] || "") + (context && context.subject ? " | درس: " + context.subject : "") + "\n" +
      "قواعد پاسخ:\n" +
      "۱) به هر پرسشی جواب بده. هیچ پرسشی را با «خارج از حیطهٔ من است» یا «فقط دربارهٔ درس بپرس» رد نکن. " +
      "علم، فناوری، برنامه‌نویسی، زبان، ترجمه، تاریخ، جغرافیا، ادبیات، نگارش، ریاضی، مهارت‌های مطالعه، " +
      "راهنمای کار با رایانه و موبایل، پرسش‌های عمومی و روزمره — همه را پاسخ بده.\n" +
      "۲) فارسی روان، ساده و درست بنویس؛ لحن صمیمی، محترم و تشویق‌کننده باشد. " +
      "اصطلاح‌های فنی را با معادل انگلیسی در پرانتز بیاور (مثلاً «فتوسنتز (Photosynthesis)»).\n" +
      "۳) پاسخ را ساخت‌یافته بنویس: جملهٔ کوتاه پاسخ، بعد توضیح، بعد مثال. " +
      "برای موضوع‌های چندبخشی از فهرست شماره‌دار یا جدول استفاده کن. " +
      "در پایان اگر مفید بود، یک «نکتهٔ امتحانی» یا «خلاصهٔ یک‌خطی» اضافه کن.\n" +
      "۴) در ریاضی، فیزیک و شیمی همیشه محاسبه را گام‌به‌گام و با ذکر یکا انجام بده و نتیجه را پررنگ کن.\n" +
      "۵) در برنامه‌نویسی، کد کامل و قابل اجرا بده و بعدش خط‌به‌خط توضیح بده.\n" +
      "۶) طول پاسخ را به پرسش اندازه بزن: پرسش کوتاه → پاسخ کوتاه؛ پرسش مفهومی یا «کامل توضیح بده» → پاسخ مفصل.\n" +
      "۷) سطح توضیح را با پایهٔ دانش‌آموز هم‌خوان کن، ولی اگر پرسش پیشرفته‌تر بود، دقیق‌تر و عمیق‌تر جواب بده.\n" +
      "۸) اگر چیزی را نمی‌دانی یا ممکن است تغییر کرده باشد (مثل قیمت، قانون یا خبر تازه)، صریح بگو " +
      "و به‌جای حدس زدن، روش درست پیدا کردنش را توضیح بده. هیچ‌وقت اطلاعات ساختگی نساز.\n" +
      "۹) محتوای نامناسب، خطرناک یا خلاف قانون نده؛ در عوض جانشین امن و مفید پیشنهاد کن.\n" +
      "۱۰) پاسخ را کامل به فارسی بنویس. از درج واژه یا نویسه از زبان‌های دیگر (جز اصطلاح فنی لاتین " +
      "مثل نام تابع و کتابخانه در کد) خودداری کن.";
  }

  function buildBody(pid, messages) {
    var p = PROVIDERS[pid];
    var model = CFG.model || p.model;
    if (p.kind === "gemini") {
      return {
        url: p.base + "/models/" + model + ":generateContent?key=" + encodeURIComponent(CFG.key || ""),
        headers: { "Content-Type": "application/json" },
        body: {
          systemInstruction: { parts: [{ text: messages[0].content }] },
          contents: messages.slice(1).map(function (m) { return { role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }; }),
          generationConfig: { temperature: Number(CFG.temp) || 0.4, maxOutputTokens: 2048 }
        },
        parse: function (j) {
          try { return j.candidates[0].content.parts.map(function (x) { return x.text; }).join(""); } catch (e) { return ""; }
        }
      };
    }
    var base = CFG.baseUrl || p.base;
    return {
      url: base.replace(/\/+$/, "") + "/chat/completions",
      headers: Object.assign({ "Content-Type": "application/json" }, CFG.key ? { Authorization: "Bearer " + CFG.key } : {}),
      body: { model: model, messages: messages, temperature: Number(CFG.temp) || 0.4, stream: false },
      parse: function (j) { try { return j.choices[0].message.content; } catch (e) { return ""; } }
    };
  }

  function ask(question, context, onDelta) {
    var pid = resolveProvider();
    if (!pid) return offlineAnswer(question);
    var messages = [
      { role: "system", content: sysPrompt(context) },
      { role: "user", content: String(question) }
    ];
    var req = buildBody(pid, messages);
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, 45000);
    return fetch(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(req.body), signal: ctrl.signal })
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (j) {
        var out = req.parse(j) || "";
        if (!out) throw new Error("empty");
        if (onDelta) onDelta(out);
        return relevant(question, 3).then(function (hits) { return { text: out, sources: hits, online: true }; });
      })
      .catch(function (err) {
        return offlineAnswer(question).then(function (off) {
          off.fallback = true;
          off.reason = String(err && err.message || err);
          return off;
        });
      })
      .finally(function () { clearTimeout(timer); });
  }

  /* ------------------------------------------- برنامهٔ مطالعه */
  function makePlan(subjects, days, hours) {
    var out = [];
    var perDay = Math.max(1, Math.round(subjects.length * (hours >= 3 ? 2 : 1) / days));
    var idx = 0;
    for (var d = 1; d <= days; d++) {
      var list = [];
      for (var i = 0; i < perDay && idx < subjects.length * 2; i++) {
        list.push(subjects[idx % subjects.length]);
        idx++;
      }
      out.push({ day: d, items: list });
    }
    return out;
  }

  /* ---------------------------------------------------------- رابط چت */
  function mount(root) {
    var log = $("[data-ai-log]", root);
    var input = $("[data-ai-input]", root);
    var send = $("[data-ai-send]", root);
    var dot = $("[data-ai-state]", root);
    var note = $("[data-ai-note]", root);
    var history = [];

    function setState(txt, cls) {
      if (dot) { dot.className = "ai-dot " + (cls || ""); dot.title = txt; }
      if (note) note.textContent = txt;
    }
    function push(role, html, extra) {
      var el = D.createElement("div");
      el.className = "msg " + (role === "me" ? "me" : (role === "off" ? "off" : "ai"));
      el.innerHTML = '<span class="av">' + (role === "me" ? "من" : (role === "off" ? "آ" : "AI")) + '</span><div class="bub">' + html + (extra || "") + "</div>";
      log.appendChild(el);
      log.scrollTop = log.scrollHeight;
      return el;
    }

    function sourcesHtml(list) {
      if (!list || !list.length) return "";
      return '<span class="src">منابع از جزوه‌های سایت: ' + list.map(function (h) {
        return '<a href="' + U(h.url) + '">' + esc(h.t) + "</a>";
      }).join(" · ") + "</span>";
    }

    function submit(q) {
      q = (q != null ? q : input.value).trim();
      if (!q) return;
      input.value = "";
      input.style.height = "";
      push("me", esc(q));
      history.push({ role: "user", content: q });
      var t = push("ai", '<span class="typing"><i></i><i></i><i></i></span>');
      setState("در حال پاسخ‌گویی…", "on");

      ask(q, { subject: root.getAttribute("data-ai-subject") || "" }, null).then(function (res) {
        var html = esc(res.text).replace(/\n/g, "<br>");
        t.querySelector(".bub").innerHTML = html + sourcesHtml(res.sources);
        if (res.fallback) {
          setState("پاسخ محلی (اتصال آنلاین برقرار نشد)", "off");
          W.HK && W.HK.toast && W.HK.toast("اتصال آنلاین برقرار نشد؛ پاسخ از جزوه‌های سایت داده شد.");
        } else if (res.online) {
          setState("متصل به دستیار آنلاین", "on");
        } else {
          setState("حالت آنلاین — پاسخ از جزوه‌های سایت", "off");
        }
        history.push({ role: "assistant", content: res.text });
        log.scrollTop = log.scrollHeight;
      });
    }

    if (send) send.addEventListener("click", function () { submit(); });
    if (input) {
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
      });
      input.addEventListener("input", function () {
        input.style.height = "auto";
        input.style.height = Math.min(168, input.scrollHeight) + "px";
      });
      setTimeout(function () { input.focus(); }, 300);
    }
    $$("[data-ai-q]", root).forEach(function (c) {
      c.addEventListener("click", function () { submit(c.textContent.trim()); });
    });

    setState("آماده — برای پاسخ آنلاین، دستیار را از تنظیمات وصل کنید", "off");
    return { submit: submit, history: history };
  }

  /* ----------------------------------------- جادوی تنظیمات روی صفحه */
  function mountSettings(root) {
    var f = {
      mode: $("[data-ai-mode]", root), key: $("[data-ai-key]", root),
      model: $("[data-ai-model]", root), base: $("[data-ai-base]", root), save: $("[data-ai-save]", root)
    };
    if (!f.mode) return;
    f.mode.value = CFG.mode || "auto";
    if (f.key) f.key.value = CFG.key || "";
    if (f.model) f.model.value = CFG.model || "";
    if (f.base) f.base.value = CFG.baseUrl || "";
    if (f.save) f.save.addEventListener("click", function () {
      CFG.mode = f.mode.value;
      CFG.key = f.key ? f.key.value.trim() : "";
      CFG.model = f.model ? f.model.value.trim() : "";
      CFG.baseUrl = f.base ? f.base.value.trim() : "";
      LS.set("g8:ai2", CFG);
      W.HK && W.HK.toast && W.HK.toast("تنظیمات ذخیره شد.");
    });
  }

  function boot() {
    var root = $("[data-ai-chat]");
    if (root) { W.HK_AI = mount(root); mountSettings(root); }
    /* نمایش وضعیت خودکار موتور هوش مصنوعی (بدون نیاز به تنظیم کاربر) */
    var st = D.getElementById("aiAutoState");
    if (st) {
      st.textContent = "در حال بررسی موتور…";
      fetch("/api/health", { credentials: "same-origin", cache: "no-store" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var on = !!(j && j.ok && j.ai && j.ai.configured);
          st.textContent = on
            ? "✅ موتور هوش مصنوعی سایت فعال است — آمادهٔ پاسخ به هر پرسش."
            : "⚠️ موتور آنلاین در دسترس نیست؛ دستیار با موتور مستقل داخلی پاسخ می‌دهد.";
        })
        .catch(function () {
          st.textContent = "⚠️ اتصال بررسی نشد؛ دستیار در صورت نیاز با موتور داخلی پاسخ می‌دهد.";
        });
    }
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();

  W.AI2 = { ask: ask, relevant: relevant, offlineAnswer: offlineAnswer, makePlan: makePlan, config: CFG, providers: PROVIDERS, save: function () { LS.set("g8:ai2", CFG); } };
})();
