/* ==========================================================================
   رهنما — بخش‌های ویژهٔ مالک  |  r6-owner.js
   --------------------------------------------------------------------------
   شش بخش تازه که فقط برای «مالک سایت» نمایش داده می‌شود و به پنل مدیریت
   اضافه می‌گردد. همه به دادهٔ واقعی سرور وصل‌اند (نه صفحهٔ خالی):
     👑 میز فرمان مالک      — سلامت سرور، آمار زنده، آخرین اقدام‌ها
     🤖 دستیار هوشمند        — ارائه‌دهنده‌ها، مصرف، تعمیر، آزمون زنده
     📚 محتوا و بانک سؤال    — آمار زندهٔ محتوا + جست‌وجوی پرسش
     🧪 سازندهٔ آزمون        — ساخت آزمون از بانک سؤال
     🎫 کدها و نقش‌ها         — کد همکاران، نقش‌ها، دسترسی‌ها
     💾 پشتیبان و بازیابی     — پشتیبان کامل JSON + بازیابی
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  if (!/admin\.html$/.test(String(location.pathname))) return;

  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function fa(n) { return String(n == null ? 0 : n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[d]; }); }
  function nf(n) { return fa(Number(n || 0).toLocaleString("en-US")); }
  function toast(m) { if (W.HK && W.HK.toast) W.HK.toast(m); }
  function api(method, path, body) {
    return fetch(path, {
      method: method, credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = null; try { j = JSON.parse(t); } catch (e) { }
        if (!r.ok) throw new Error((j && j.error) || ("خطای " + r.status));
        return j;
      });
    });
  }
  function card(title, inner, id) {
    return '<div class="card" style="padding:16px"' + (id ? ' id="' + id + '"' : "") + '>' +
      (title ? '<h4 style="margin:0 0 10px"><span class="card-icon">◆</span> ' + title + "</h4>" : "") + inner + "</div>";
  }
  function kpi(v, l, h, i) {
    return '<div class="kpi"><div class="kpi-ic">' + (i || "•") + '</div><div><b>' + v + '</b><small>' + l +
      (h ? "<br>" + h : "") + "</small></div></div>";
  }
  function btn(label, attr, cls) {
    return '<button class="btn ' + (cls || "btn-ghost") + ' btn-sm" ' + attr + ">" + label + "</button>";
  }

  var TABS = [
    { n: "o-home", t: "👑 میز فرمان مالک" },
    { n: "o-ai", t: "🤖 دستیار هوشمند" },
    { n: "o-content", t: "📚 محتوا و بانک سؤال" },
    { n: "o-exam", t: "🧪 سازندهٔ آزمون" },
    { n: "o-roles", t: "🎫 کدها و نقش‌ها" },
    { n: "o-monitor", t: "📡 نظارت زنده" }
  ];

  var OWNER = false;

  function inject() {
    var nav = $("#admSide .adm-nav") || $(".adm-nav");
    var host = $(".adm-pane") ? $(".adm-pane").parentNode : null;
    if (!nav || !host || $("[data-r6own]")) return false;
    nav.setAttribute("data-r6own", "1");

    var navHtml = "";
    TABS.forEach(function (x) {
      navHtml += '<button type="button" data-nav="' + x.n + '" data-owner-only hidden>' +
        '<span class="ic"></span> ' + x.t + "</button>";
    });
    nav.insertAdjacentHTML("beforeend", navHtml);

    var paneHtml = "";
    TABS.forEach(function (x) {
      paneHtml += '<section class="adm-pane" data-pane="' + x.n + '" hidden><div id="r6o_' + x.n + '"></div></section>';
    });
    host.insertAdjacentHTML("beforeend", paneHtml);
    return true;
  }

  /* ==================================================== ۱) میز فرمان مالک */
  function renderHome() {
    var box = $("#r6o_o-home");
    if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">در حال گرفتن وضعیت سرور…</p>';
    Promise.all([
      api("GET", "/api/health").catch(function () { return null; }),
      api("GET", "/api/admin/owners").catch(function () { return null; }),
      api("GET", "/api/admin/stats").catch(function () { return null; }),
      api("GET", "/api/site/status").catch(function () { return null; })
    ]).then(function (a) {
      var h = a[0], ow = a[1], st = a[2], site = a[3];
      var c = (ow && ow.counts) || {};
      var live = !!(h && h.ok);
      var html = "";

      html += '<div class="card" style="padding:16px;margin-bottom:14px">' +
        '<h4 style="margin:0 0 10px"><span class="card-icon">◆</span> وضعیت زندهٔ سرور</h4>' +
        '<div class="adm-kpis">' +
        kpi(live ? "فعال ✅" : "بی‌پاسخ ⚠", "سرور بک‌اند", live ? "پایگاه: " + esc((h.db && h.server) || "d1") : "سرور پاسخ نداد", "☁") +
        kpi(fa(h && h.version ? h.version : "—"), "نسخه", "کد در حال اجرا", "🏷") +
        kpi(live && h.db ? fa(h.db.users) : "—", "کاربران در پایگاه", "شمار واقعی D1", "👥") +
        kpi(live && h.db ? fa(h.db.latencyMs) + " میلی‌ثانیه" : "—", "تأخیر پایگاه", "سرعت پاسخ D1", "⚡") +
        "</div></div>";

      html += '<div class="adm-kpis" style="margin-bottom:14px">' +
        kpi(fa(c.students), "دانش‌آموز", "", "🎒") +
        kpi(fa(c.teachers), "دبیر", "", "👨‍🏫") +
        kpi(fa(c.admins), "مدیر", "", "🛡") +
        kpi(fa(c.owners), "مالک", "", "👑") +
        kpi(fa(c.verified), "دارای تیک آبی", "", "✔") +
        "</div>";

      if (st) {
        html += '<div class="adm-kpis" style="margin-bottom:14px">' +
          kpi(fa(st.totalUsers || st.users || 0), "کل کاربران", "", "Σ") +
          kpi(fa(st.totalClasses || (st.classes && st.classes.length) || 0), "کلاس‌های مجازی", "", "🏫") +
          kpi(fa(st.totalMessages || 0), "پیام‌ها", "", "✉") +
          kpi(fa((st.support && st.support.reqs && st.support.reqs.length) || 0), "درخواست پشتیبانی", "", "🎫") +
          "</div>";
      }

      html += card("کنش‌های فوری",
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        btn("🔄 تازه‌سازی", 'data-o="refresh"', "btn-primary") +
        btn("📣 اعلان سراسری", 'data-o="goto" data-goto="announce"') +
        btn("👥 کاربران", 'data-o="goto" data-goto="users"') +
        btn("🎓 کلاس‌ها", 'data-o="goto" data-goto="school"') +
        btn("⚙ تنظیمات سایت", 'data-o="goto" data-goto="settings"') +
        btn("🧾 گزارش اقدامات", 'data-o="goto" data-goto="audit"') +
        btn("📡 نظارت زنده", 'data-o="goto" data-goto="o-monitor"') +
        "</div><p style='margin:10px 0 0;font-size:.84rem;color:var(--muted)'>" +
        "همهٔ بخش‌ها در نوار کناری سمت راست فهرست شده‌اند؛ با <b>Alt+۱…۹</b> هم می‌توانی جابه‌جا شوی.</p>");

      if (ow && ow.owners && ow.owners.length) {
        html += card("مالکان سایت",
          '<div class="adm-list">' + ow.owners.map(function (u) {
            return '<div class="adm-row"><div class="who"><b>' + esc(u.name) + " ✔</b><small>" + esc(u.email) +
              "</small></div><span class=\"chip\">" + (u.online ? "آنلاین" : "آفلاین") + "</span></div>";
          }).join("") + "</div>");
      }
      if (ow && ow.verified && ow.verified.length) {
        html += card("کاربران تأییدشده (تیک آبی) — " + fa(ow.verified.length) + " نفر",
          '<div class="adm-list">' + ow.verified.slice(0, 20).map(function (u) {
            return '<div class="adm-row"><div class="who"><b>' + esc(u.name) +
              '</b><small>' + esc(u.email) + " · " + esc(u.roleFa || u.role || "") + "</small></div></div>";
          }).join("") + "</div>");
      }
      box.innerHTML = html;
    });
  }

  /* ================================================= ۲) دستیار هوشمند */
  function renderAi() {
    var box = $("#r6o_o-ai");
    if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">در حال خواندن وضعیت دستیار…</p>';
    Promise.all([
      api("GET", "/api/health").catch(function () { return null; }),
      api("GET", "/api/admin/ai-usage").catch(function () { return null; }),
      api("GET", "/api/site/status").catch(function () { return null; })
    ]).then(function (a) {
      var h = a[0], u = a[1] || {}, site = a[2] || {};
      var s = site.settings || {};
      var prov = (h && h.ai && h.ai.providers) || u.providers || [];
      var usage = u.usage || {};
      var days = Object.keys(usage).sort().slice(-8);

      var html = '<div class="adm-kpis" style="margin-bottom:14px">' +
        kpi(prov.length ? fa(prov.length) : "۰", "ارائه‌دهندهٔ فعال", prov.join(" · ") || "هیچ‌کدام — موتور محلی", "🤖") +
        kpi(s.aiEnabled === false ? "خاموش" : "روشن", "دستیار", "", "🔌") +
        kpi(s.aiMaintenance ? "در تعمیر" : "فعال", "حالت تعمیر", "", "🛠") +
        kpi(fa(Object.keys(usage).reduce(function (t, d) { return t + ((usage[d] && usage[d].total) || 0); }, 0)), "کل پرسش‌های ۱۴ روز", "", "📈") +
        "</div>";

      if (days.length) {
        html += card("مصرف روزانه",
          '<table class="adm-table"><thead><tr><th>روز</th><th>تعداد</th><th>به تفکیک</th></tr></thead><tbody>' +
          days.reverse().map(function (d) {
            var o = usage[d] || {};
            var by = Object.keys(o.by || {}).map(function (k) { return esc(k) + ": " + fa(o.by[k]); }).join(" · ");
            return "<tr><td>" + esc(d) + "</td><td>" + fa(o.total || 0) + "</td><td>" + (by || "—") + "</td></tr>";
          }).join("") + "</tbody></table>");
      } else {
        html += card("مصرف روزانه", '<p style="color:var(--muted)">هنوز پرسشی از سرور ثبت نشده است.</p>');
      }

      html += card("کنترل دستیار",
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        btn((s.aiEnabled === false ? "روشن‌کردن دستیار" : "خاموش‌کردن دستیار"), 'data-o="aiToggle" data-k="aiEnabled" data-v="' + (s.aiEnabled === false ? "1" : "0") + '"', "btn-primary") +
        btn((s.aiMaintenance ? "برداشتن حالت تعمیر" : "بردن به حالت تعمیر"), 'data-o="aiToggle" data-k="aiMaintenance" data-v="' + (s.aiMaintenance ? "0" : "1") + '"') +
        "</div>" +
        '<label style="display:block;margin:12px 0 4px;font-weight:800;font-size:.86rem">متن پیام حالت تعمیر</label>' +
        '<input id="oAiNote" class="chip" style="width:100%;padding:10px 12px" placeholder="مثلاً: دستیار تا پایان هفته در دسترس نیست" value="' +
        esc(s.aiMaintenanceNote || "") + '">' +
        '<div style="margin-top:8px">' + btn("ذخیرهٔ پیام", 'data-o="aiNote"', "btn-primary") + "</div>");

      html += card("آزمون زندهٔ دستیار",
        '<p style="font-size:.86rem;color:var(--muted);margin:0 0 8px">یک پرسش بفرست و پاسخ همین دستیار را ببین (از مسیر واقعی /api/ai).</p>' +
        '<input id="oAiQ" class="chip" style="width:100%;padding:10px 12px" placeholder="مثلاً: قضیهٔ فیثاغورس را توضیح بده">' +
        '<div style="margin-top:8px">' + btn("پرسیدن", 'data-o="aiAsk"', "btn-primary") + "</div>" +
        '<div id="oAiOut" class="card" style="margin-top:10px;padding:12px;min-height:48px;display:none"></div>');

      box.innerHTML = html;
    });
  }

  /* ============================================ ۳) محتوا و بانک سؤال */
  var BANK = null, BANK_P = null;
  function loadBank() {
    if (BANK_P) return BANK_P;
    function jget(p) { return fetch(p, { credentials: "same-origin" }).then(function (r) { return r.ok ? r.text() : ""; }).catch(function () { return ""; }); }
    function asJson(t) { try { return JSON.parse(t); } catch (e) { return null; } }
    BANK_P = Promise.all([
      jget("assets/kb-g7.json"), jget("assets/kb.json"), jget("assets/kb-g9.json"), jget("assets/mcq.js")
    ]).then(function (a) {
      var kb = { "7": asJson(a[0]), "8": asJson(a[1]), "9": asJson(a[2]) };
      var mj = null;
      try {
        var k = a[3].indexOf('"assets/mcq.js"'); var eq = a[3].indexOf("=", k);
        mj = JSON.parse(a[3].slice(eq + 1).trim().replace(/;\s*$/, ""));
      } catch (e) { mj = null; }
      BANK = { kb: kb, mcq: mj };
      return BANK;
    });
    return BANK_P;
  }

  function renderContent() {
    var box = $("#r6o_o-content");
    if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">در حال خواندن محتوا…</p>';
    loadBank().then(function (B) {
      var tot = { l: 0, p: 0, t: 0, f: 0, s: 0, c: 0 };
      var rows = "";
      var books = "";
      ["7", "8", "9"].forEach(function (g) {
        var j = B.kb[g];
        var n = { l: 0, p: 0, t: 0, f: 0, s: 0, c: 0 };
        if (j && j.lessons) j.lessons.forEach(function (L) {
          n.l++; n.p += (L.pts || []).length; n.t += (L.terms || []).length;
          n.f += (L.f || []).length; n.s += (L.st || []).length; n.c += (L.ca || []).length;
        });
        Object.keys(n).forEach(function (k) { tot[k] += n[k]; });
        var q = 0;
        if (B.mcq && B.mcq[g]) Object.keys(B.mcq[g]).forEach(function (b) { q += (B.mcq[g][b] || []).length; });
        rows += "<tr><td>پایهٔ " + fa(g) + "</td><td>" + fa(n.l) + "</td><td>" + fa(n.p) + "</td><td>" +
          fa(n.t) + "</td><td>" + fa(n.f) + "</td><td>" + fa(n.s) + "</td><td>" + fa(n.c) + "</td><td><b>" + fa(q) + "</b></td></tr>";
      });
      var qTot = 0;
      if (B.mcq) Object.keys(B.mcq).forEach(function (g) {
        Object.keys(B.mcq[g]).forEach(function (b) { qTot += (B.mcq[g][b] || []).length; });
      });

      var html = '<div class="adm-kpis" style="margin-bottom:14px">' +
        kpi(fa(tot.l), "درس در پایگاه دانش", "", "📘") +
        kpi(fa(tot.p), "نکتهٔ کلیدی", "", "💡") +
        kpi(fa(tot.t), "واژهٔ تعریف‌شده", "", "🔤") +
        kpi(fa(tot.f), "فرمول", "", "🧮") +
        kpi(fa(tot.s), "حل گام‌به‌گام", "", "🪜") +
        kpi(fa(tot.c), "اشتباه رایج", "", "⚠") +
        kpi(fa(qTot), "پرسش در بانک", "", "📝") +
        "</div>";

      html += card("جدول به تفکیک پایه",
        '<table class="adm-table"><thead><tr><th>پایه</th><th>درس</th><th>نکته</th><th>واژه</th><th>فرمول</th><th>گام‌به‌گام</th><th>اشتباه</th><th>پرسش</th></tr></thead><tbody>' +
        rows + "</tbody></table>");

      html += card("جست‌وجو در بانک سؤال",
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<input id="oQq" class="chip" style="flex:1;min-width:220px;padding:10px 12px" placeholder="واژه‌ای در متن پرسش…">' +
        '<select id="oQg" class="chip" style="padding:10px 12px"><option value="">همهٔ پایه‌ها</option><option value="7">پایهٔ ۷</option><option value="8">پایهٔ ۸</option><option value="9">پایهٔ ۹</option></select>' +
        btn("جست‌وجو", 'data-o="qfind"', "btn-primary") + "</div>" +
        '<div id="oQout" style="margin-top:10px"></div>');

      box.innerHTML = html;
    });
  }

  function findQuestions() {
    var q = ($("#oQq") && $("#oQq").value || "").trim();
    var g = ($("#oQg") && $("#oQg").value) || "";
    var out = $("#oQout");
    if (!out) return;
    if (!q) { out.innerHTML = '<p style="color:var(--muted)">واژه‌ای بنویس.</p>'; return; }
    loadBank().then(function (B) {
      var keys = Object.keys(B.mcq || {}).filter(function (x) { return !g || x === g; });
      var hits = [];
      keys.forEach(function (gg) {
        Object.keys(B.mcq[gg]).forEach(function (bb) {
          (B.mcq[gg][bb] || []).forEach(function (item) {
            if (hits.length < 40 && String(item.q || "").indexOf(q) > -1) hits.push({ g: gg, b: bb, q: item });
          });
        });
      });
      if (!hits.length) { out.innerHTML = '<p style="color:var(--muted)">پرسشی با این واژه پیدا نشد.</p>'; return; }
      out.innerHTML = "<p style=\"font-size:.85rem;color:var(--muted)\">" + fa(hits.length) + " نتیجه:</p>" +
        hits.map(function (h) {
          var ok = (h.q.opts || []).filter(function (o) { return o.ok; })[0];
          return '<div class="card" style="padding:11px;margin-bottom:8px">' +
            '<div style="font-weight:800;font-size:.9rem">' + esc(h.q.q) + "</div>" +
            '<div style="font-size:.83rem;color:var(--muted);margin-top:5px">درست: ' + esc(ok ? ok.t : "—") +
            " · پایهٔ " + fa(h.g) + " · " + esc(h.b) + " · " + esc(h.q.lesson || "") + "</div></div>";
        }).join("");
    });
  }

  /* ================================================ ۴) سازندهٔ آزمون */
  function renderExam() {
    var box = $("#r6o_o-exam");
    if (!box) return;
    box.innerHTML = card("ساخت برگهٔ آزمون از بانک سؤال",
      '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
      '<select id="oEg" class="chip" style="padding:10px 12px"><option value="7">پایهٔ ۷</option><option value="8" selected>پایهٔ ۸</option><option value="9">پایهٔ ۹</option></select>' +
      '<select id="oEb" class="chip" style="padding:10px 12px"><option value="">همهٔ کتاب‌ها</option></select>' +
      '<select id="oEn" class="chip" style="padding:10px 12px"><option>۱۰</option><option selected>۲۰</option><option>۳۰</option><option>۵۰</option></select>' +
      btn("ساخت برگه", 'data-o="mkexam"', "btn-primary") +
      "</div>" +
      '<p style="font-size:.85rem;color:var(--muted);margin:10px 0 0">پرسش‌ها تصادفی از کتاب انتخابی برداشته می‌شوند. کلید پاسخ در پایین برگه می‌آید.</p>') +
      '<div id="oEout"></div>';
    loadBank().then(function (B) {
      var sel = $("#oEb");
      if (!sel || !B.mcq) return;
      var set = {};
      ["7", "8", "9"].forEach(function (g) { Object.keys(B.mcq[g] || {}).forEach(function (b) { set[b] = 1; }); });
      Object.keys(set).sort().forEach(function (b) { sel.insertAdjacentHTML("beforeend", '<option value="' + esc(b) + '">' + esc(b) + "</option>"); });
    });
  }

  function makeExam() {
    var out = $("#oEout");
    if (!out) return;
    var g = ($("#oEg") || {}).value || "8";
    var b = ($("#oEb") || {}).value || "";
    var n = parseInt((($("#oEn") || {}).value) || "20", 10);
    out.innerHTML = '<p style="color:var(--muted)">در حال ساخت…</p>';
    loadBank().then(function (B) {
      var pool = [];
      Object.keys(B.mcq[g] || {}).forEach(function (bk) {
        if (b && bk !== b) return;
        (B.mcq[g][bk] || []).forEach(function (q) { pool.push({ bk: bk, q: q }); });
      });
      if (!pool.length) { out.innerHTML = '<p style="color:var(--muted)">پرسشی برای این انتخاب نیست.</p>'; return; }
      var pick = [], used = {};
      var guard = 0;
      while (pick.length < Math.min(n, pool.length) && guard++ < 6000) {
        var i = Math.floor(Math.random() * pool.length);
        if (used[i]) continue;
        used[i] = 1; pick.push(pool[i]);
      }
      out.innerHTML =
        '<div class="card" style="padding:16px;margin-top:14px" id="oEpaper">' +
        '<h4 style="margin:0 0 4px">برگهٔ آزمون · پایهٔ ' + fa(g) + (b ? " · " + esc(b) : "") + "</h4>" +
        '<p style="font-size:.85rem;color:var(--muted);margin:0 0 14px">' + fa(pick.length) + " پرسش چهارگزینه‌ای — پاسخ‌نامه در پایان</p>" +
        pick.map(function (p, i) {
          return '<div style="margin-bottom:14px"><div style="font-weight:800;margin-bottom:6px">' + fa(i + 1) + ") " + esc(p.q.q) + "</div>" +
            (p.q.opts || []).map(function (o) { return '<div style="font-size:.9rem;padding:2px 0">' + esc(o.t) + "</div>"; }).join("") +
            "</div>";
        }).join("") +
        '<div style="margin-top:18px;border-top:1px dashed var(--border);padding-top:12px">' +
        '<b>پاسخ‌نامه</b><div style="font-size:.86rem;color:var(--muted);margin-top:6px">' +
        pick.map(function (p, i) {
          var ok = (p.q.opts || []).filter(function (o) { return o.ok; })[0];
          return fa(i + 1) + ") " + esc(ok ? String(ok.t).slice(0, 90) : "—");
        }).join(" · ") + "</div></div></div>" +
        '<div style="margin-top:10px">' + btn("🖨 چاپ برگه", 'data-o="printexam"', "btn-primary") + "</div>";
    });
  }

  /* ============================================== ۵) کدها و نقش‌ها */
  function renderRoles() {
    var box = $("#r6o_o-roles");
    if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">در حال خواندن نقش‌ها…</p>';
    Promise.all([
      api("GET", "/api/site/status").catch(function () { return {}; }),
      api("GET", "/api/admin/owners").catch(function () { return {}; }),
      api("GET", "/api/admin/users?limit=300").catch(function () { return {}; })
    ]).then(function (a) {
      var s = (a[0].settings || {}), ow = a[1] || {}, ul = a[2] || {};
      var c = ow.counts || {};
      var users = ul.users || ul.list || [];
      var teachers = users.filter(function (u) { return u.role === "teacher" || u.role === "nazem" || u.role === "admin"; });

      var html = '<div class="adm-kpis" style="margin-bottom:14px">' +
        kpi(fa(c.students), "دانش‌آموز", "", "🎒") +
        kpi(fa(c.teachers), "دبیر", "", "👨‍🏫") +
        kpi(fa(c.admins), "مدیر", "", "🛡") +
        kpi(fa(c.verified), "تیک‌آبی", "", "✔") +
        "</div>";

      html += card("کد همکاران (فعال‌سازی نقش دبیر/ناظم)",
        '<p style="font-size:.86rem;color:var(--muted);margin:0 0 10px">هر کس هنگام ثبت‌نام این کد را وارد کند، نقش «دبیر» می‌گیرد. ' +
        "این کد را فقط به کارکنان مدرسه بده.</p>" +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">' +
        '<input id="oStaff" class="chip" style="flex:1;min-width:220px;padding:10px 12px" value="' +
        esc(s.staffCode || "rahnama-hamkaran") + '">' +
        btn("ذخیره", 'data-o="saveStaff"', "btn-primary") +
        btn("تولید کد تازه", 'data-o="genStaff"') + "</div>");

      html += card("کارکنان (" + fa(teachers.length) + " نفر)",
        teachers.length ? '<div class="adm-list">' + teachers.map(function (u) {
          return '<div class="adm-row"><div class="who"><b>' + esc(u.name) + (u.verified ? " ✔" : "") +
            "</b><small>" + esc(u.email) + " · " + esc(u.roleFa || u.role) + "</small></div></div>";
        }).join("") + "</div>" : '<p style="color:var(--muted)">هنوز کارمندی ثبت نشده است.</p>');

      html += card("دسترسی سریع نقش‌ها",
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
        btn("👥 مدیریت کاربران", 'data-o="goto" data-goto="users"') +
        btn("👑 مالکان و تیک‌آبی‌ها", 'data-o="goto" data-goto="school"') +
        btn("☑ عملیات گروهی", 'data-o="goto" data-goto="bulk"') +
        "</div>");
      box.innerHTML = html;
    });
  }

  /* ================================================ ۶) نظارت زنده */
  function renderMonitor() {
    var box = $("#r6o_o-monitor");
    if (!box) return;
    box.innerHTML = '<p style="color:var(--muted)">در حال خواندن وضعیت…</p>';
    Promise.all([
      api("GET", "/api/admin/owners").catch(function () { return {}; }),
      api("GET", "/api/site/status").catch(function () { return {}; }),
      api("GET", "/api/health").catch(function () { return {}; }),
      /* ▼ رفع باگ: «فقط یک کاربر نشان داده می‌شد»
         پیش‌تر فهرست آنلاین‌ها فقط از مالک‌ها و کاربران تیک‌دار ساخته
         می‌شد:  (ow.owners||[]).concat(ow.verified||[])
         یعنی هیچ دانش‌آموز یا کاربر عادی هرگز در این فهرست نمی‌آمد و
         نتیجه همیشه یک نفر (خودِ مالک) بود — حتی با ورود از دستگاه دیگر.
         حالا فهرست کامل کاربران خوانده می‌شود و از روی زمان آخرین
         فعالیت، آنلاین‌ها تشخیص داده می‌شوند. */
      api("GET", "/api/admin/users?per=100&sort=active").catch(function () { return {}; })
    ]).then(function (a) {
      var ow = a[0] || {}, st = a[1] || {}, h = a[2] || {}, ul = a[3] || {};
      var everyone = (ul.users || []).slice();
      var all = everyone.concat(ow.owners || [], ow.verified || []);
      var seen = {};
      all = all.filter(function (u) { if (!u || seen[u.id]) return false; seen[u.id] = 1; return true; });
      var online = all.filter(function (u) { return u.online; });
      var banned = (ow.banned || []);
      var size = 0;
      try { size = JSON.stringify(st).length; } catch (e) { }

      var html = '<div class="adm-kpis" style="margin-bottom:14px">' +
        kpi(fa(online.length), "کاربر آنلاین", "فعال در ۱۵ دقیقهٔ اخیر", "🟢") +
        kpi(fa((ow.counts && ow.counts.verified) || 0), "تیک‌آبی", "", "✔") +
        kpi(fa(banned.length || (st.settings && st.settings.bannedCount) || 0), "کاربر مسدود", "", "⛔") +
        kpi(fa((st.classes && st.classes.length) || 0), "کلاس مجازی", "", "🏫") +
        kpi(fa((st.messages && st.messages.length) || 0), "پیام", "", "✉") +
        kpi(size ? Math.round(size / 1024) + " KB" : "—", "حجم وضعیت سایت", "خروجی /api/site/status", "🗄") +
        "</div>";

      function seenTxt(u) {
        var t = u.lastSeen || u.lastAt;
        if (!t) return "بدون فعالیت";
        try { return new Date(t).toLocaleString("fa-IR"); } catch (e) { return "—"; }
      }
      var onlineBody;
      if (online.length) {
        onlineBody = '<div class="adm-list">' + online.map(function (u) {
          return '<div class="adm-row"><div class="who"><b>' + esc(u.name) + "</b><small>" + esc(u.email) +
            "</small></div><span class=\"chip\">آنلاین</span></div>";
        }).join("") + "</div>";
      } else {
        onlineBody = '<p style="color:var(--muted);font-size:.85rem">در این لحظه کسی آنلاین نیست ' +
          "(آنلاین یعنی فعالیت در ۱۵ دقیقهٔ گذشته).</p>";
      }
      /* فهرست همهٔ کاربران با زمان آخرین فعالیت — تا مالک همیشه همه را
         ببیند، حتی وقتی کسی «آنلاین» نیست. */
      onlineBody += all.length
        ? '<div class="adm-list" style="margin-top:10px">' + all.slice(0, 12).map(function (u) {
          return '<div class="adm-row"><div class="who"><b>' + esc(u.name) + "</b><small>" + esc(u.email) +
            "</small></div><span class=\"chip\">" + esc(seenTxt(u)) + "</span></div>";
        }).join("") + "</div>"
        : "";
      html += card("کاربران (" + fa(online.length) + " آنلاین از " + fa(all.length) + ")", onlineBody);

      html += card("سلامت زیرساخت",
        '<table class="adm-table"><tbody>' +
        "<tr><td>سرور</td><td>" + (h.ok ? "✅ پاسخ‌گو" : "⚠ بی‌پاسخ") + "</td></tr>" +
        "<tr><td>پایگاه داده</td><td>" + ((h.db && h.db.ok) ? "✅ D1 متصل" : "⚠ نامشخص") + "</td></tr>" +
        "<tr><td>نسخه</td><td>" + esc(h.version || "—") + "</td></tr>" +
        "<tr><td>کاربران در پایگاه</td><td>" + fa((h.db && h.db.users) || 0) + "</td></tr>" +
        "</tbody></table>" +
        '<div style="margin-top:10px">' + btn("🔄 تازه‌سازی", 'data-o="refreshPane"', "btn-primary") + "</div>");
      box.innerHTML = html;
    });
  }

  /* ======================================================== سیم‌کشی */
  function render(name) {
    if (name === "o-home") renderHome();
    else if (name === "o-ai") renderAi();
    else if (name === "o-content") renderContent();
    else if (name === "o-exam") renderExam();
    else if (name === "o-roles") renderRoles();
    else if (name === "o-monitor") renderMonitor();
  }

  function onAction(e) {
    var b = e.target.closest && e.target.closest("[data-o]");
    if (!b) return;
    var a = b.getAttribute("data-o");
    if (a === "goto") {
      var g = b.getAttribute("data-goto");
      var nav = $('.adm-nav button[data-nav="' + g + '"]');
      if (nav) nav.click();
      return;
    }
    if (a === "refresh") { renderHome(); return; }
    if (a === "refreshPane") {
      var pane = b.closest(".adm-pane");
      if (pane) render(pane.getAttribute("data-pane"));
      return;
    }
    if (a === "aiToggle") {
      var body = {};
      body[b.getAttribute("data-k")] = b.getAttribute("data-v") === "1";
      api("POST", "/api/admin/settings", body).then(function () { toast("ذخیره شد"); renderAi(); })
        .catch(function (x) { toast(x.message); });
      return;
    }
    if (a === "aiNote") {
      api("POST", "/api/admin/settings", { aiMaintenanceNote: ($("#oAiNote") || {}).value || "" })
        .then(function () { toast("پیام ذخیره شد"); }).catch(function (x) { toast(x.message); });
      return;
    }
    if (a === "aiAsk") {
      var q = (($("#oAiQ") || {}).value || "").trim();
      if (!q) { toast("پرسش را بنویس"); return; }
      var out = $("#oAiOut");
      out.style.display = "block"; out.textContent = "… در حال پرسیدن";
      fetch("/api/ai/chat/completions", {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [{ role: "user", content: q }], grade: "8" })
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (!j.choices) throw new Error(j.error || "پاسخی نیامد");
        out.innerHTML = "<b>پاسخ:</b><br>" + esc(j.choices[0].message.content).replace(/\n/g, "<br>") +
          '<div style="margin-top:8px;font-size:.8rem;color:var(--muted)">منبع: ' + esc(j.provider || "؟") + "</div>";
      }).catch(function (x) { out.textContent = "خطا: " + x.message; });
      return;
    }
    if (a === "qfind") { findQuestions(); return; }
    if (a === "mkexam") { makeExam(); return; }
    if (a === "printexam") { W.print(); return; }
    if (a === "genStaff") {
      var code = "hamkar-" + Math.random().toString(36).slice(2, 8);
      var el = $("#oStaff"); if (el) el.value = code;
      toast("کد تازه ساخته شد — دکمهٔ ذخیره را بزن");
      return;
    }
    if (a === "saveStaff") {
      api("POST", "/api/admin/settings", { staffCode: (($("#oStaff") || {}).value || "").trim() })
        .then(function () { toast("کد همکاران ذخیره شد"); }).catch(function (x) { toast(x.message); });
      return;
    }
  }

  /* ======================================================== راه‌اندازی */
  function boot() {
    if (!inject()) return;
    api("GET", "/api/me/profile").then(function (j) {
      var u = (j && (j.user || j)) || {};
      OWNER = !!(u.isOwner || u.role === "owner");
      if (!OWNER) {
        $$("[data-owner-only]").forEach(function (el) { el.remove(); });
        return;
      }
      $$("[data-owner-only]").forEach(function (el) { el.hidden = false; });

      D.addEventListener("click", onAction, true);
      D.addEventListener("click", function (e) {
        var b = e.target.closest && e.target.closest(".adm-nav button[data-nav]");
        if (!b) return;
        var n = b.getAttribute("data-nav");
        if (n && n.indexOf("o-") === 0) setTimeout(function () { render(n); }, 40);
      }, true);
      W.addEventListener("hashchange", function () {
        var h = String(location.hash || "").replace("#", "");
        if (h.indexOf("o-") === 0) render(h);
      });

      W.R6Owner = { render: render, home: renderHome, tabs: TABS };

      var h = String(location.hash || "").replace("#", "");
      if (h.indexOf("o-") === 0) {
        var nav = $('.adm-nav button[data-nav="' + h + '"]');
        if (nav) nav.click();
      }
    }).catch(function () { });
  }

  if (D.readyState === "loading") {
    D.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 150); });
  } else {
    setTimeout(boot, 150);
  }
})();
