/* ==========================================================================
   رهنما — ابزارهای زندهٔ کلاس مجازی  |  assets/hk-class-live.js
   روی صفحهٔ کلاس مجازی (وقتی جلسه شروع شده) این‌ها را اضافه می‌کند:
     • زمان‌سنج مشترک کلاس (شروع/توقف/صفر) — برای همه هم‌زمان
     • نظرسنجی زنده: سؤال + گزینه‌ها، رأی‌گیری با نمایش زندهٔ نتیجه
     • واکنش‌های سریع (👍 ❤️ ❓ 👏) با شمارش زنده
     • قرعه‌کشی نام دانش‌آموز حاضر (با انیمیشن)
     • پیام سریع دبیر (سکوت، سؤال بپرس، ۵ دقیقه مانده، فعالیت گروهی)
   این فایل جدا نوشته شده تا کد فعلی کلاس دست‌نخورده بماند.
   سبک برای موبایل: یک پرس‌وجوی دوره‌ای ۴ ثانیه‌ای، بدون حلقهٔ سنگین.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;

  function q(s, r) { return (r || D).querySelector(s); }
  function qa(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }

  function api(method, path, body) {
    var opt = { method: method, headers: { "X-HK": "1" }, credentials: "same-origin" };
    if (body !== undefined) {
      opt.headers["Content-Type"] = "application/json";
      opt.body = JSON.stringify(body);
    }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || "خطای سرور");
        return j;
      });
    });
  }

  var S = { sid: "", me: null, room: null, tick: 0, started: 0, busy: false };

  /* ------------------------------------------------ تشخیص جلسهٔ فعال */
  function fromUrl() {
    try {
      var u = new URL(location.href);
      var s = u.searchParams.get("session") || (u.hash.match(/session=([^\s&]+)/) || [])[1];
      return s || "";
    } catch (e) { return ""; }
  }

  /* پاسخ‌های خود صفحهٔ کلاس را می‌گیریم تا شناسهٔ جلسه را بفهمیم */
  function hookFetch() {
    if (W.__hkLiveHooked) return;
    W.__hkLiveHooked = true;
    var orig = W.fetch;
    W.fetch = function () {
      var args = arguments;
      return orig.apply(W, args).then(function (res) {
        try {
          var url = String((args[0] && args[0].url) || args[0] || "");
          if (url.indexOf("/api/class/") > -1) {
            res.clone().json().then(function (j) {
              if (j && j.session && j.session.id && j.session.id !== S.sid) {
                S.sid = j.session.id;
                mount();
              }
              if (j && j.room) { S.room = j.room; paint(); }
            }).catch(function () {});
          }
        } catch (e) {}
        return res;
      });
    };
  }

  function me() {
    if (S.me) return S.me;
    if (W.HK && W.HK.auth && W.HK.auth.me) S.me = W.HK.auth.me();
    return S.me;
  }
  function isHost() {
    var m = me();
    if (!m) return false;
    if (S.room && S.room.hostId) return m.id === S.room.hostId;
    return m.role === "admin" || m.role === "teacher" || m.role === "owner";
  }

  /* ------------------------------------------------ ساخت پنل */
  function mount() {
    if (!S.sid || q(".cls-live")) return;
    var host = q("#clsRoom");
    if (!host || host.hidden) return;

    var box = D.createElement("section");
    box.className = "cls-live";
    box.setAttribute("aria-label", "ابزارهای زندهٔ کلاس");
    box.innerHTML = '<div class="cls-live-head"><b>⚡ ابزارهای زنده</b>' +
      '<span class="cls-live-net" data-lv="net">◌ در حال اتصال…</span>' +
      '<span class="cls-live-note" data-lv="note"></span></div>' +
      '<div class="cls-live-body" data-lv="body"></div>';
    var box2 = q('[data-lv="note"]', box);
    if (box2) { /* نشانگر زنده کنار شمار حاضران */ }
    var bar = q(".cls-bar", host);
    if (bar && bar.parentNode) bar.parentNode.insertBefore(box, bar.nextSibling);
    else host.insertBefore(box, host.firstChild);

    if (!S.tick) S.tick = setInterval(load, 4000);
    load();
  }

  function destroyIfGone() {
    if (q("#clsRoom") && q("#clsRoom").hidden) {
      var box = q(".cls-live");
      if (box) box.parentNode.removeChild(box);
      if (S.tick) { clearInterval(S.tick); S.tick = 0; }
    }
  }

  function load() {
    destroyIfGone();
    if (!S.sid) return;
    api("GET", "/api/class/room?session=" + encodeURIComponent(S.sid)).then(function (r) {
      S.lastOk = Date.now(); S.errors = 0;
      if (r && r.room) { S.room = r.room; paint(); }
      stamp();
    }).catch(function () { S.errors = (S.errors || 0) + 1; stamp(); });
  }

  /* نشانگر «بدون وقفه»: زنده / در حال اتصال مجدد. با هر پاسخ موفق تازه می‌شود
     و هیچ‌وقت متوقف نمی‌شود، پس کلاس بدون وقفه هم‌زمان می‌ماند. */
  function stamp() {
    var el = q('[data-lv="net"]');
    if (!el) return;
    var age = S.lastOk ? (Date.now() - S.lastOk) / 1000 : 99;
    var live = age < 12 && !S.errors;
    el.textContent = live ? "● زنده" : (S.errors > 2 ? "◌ اتصال مجدد…" : "◌ در حال به‌روزرسانی…");
    el.className = "cls-live-net" + (live ? " is-live" : " is-warn");
  }

  /* ------------------------------------------------ رسم پنل */
  function paint() {
    var box = q(".cls-live");
    if (!box || !S.room) return;
    var r = S.room, host = isHost();
    var html = "";

    /* پیام سریع دبیر */
    if (r.ann && Date.now() - (r.ann.at || 0) < 120000) {
      html += '<div class="cls-ann">📣 ' + esc(r.ann.text) + "</div>";
    }

    /* زمان‌سنج */
    var t = r.timer || { base: 0, startedAt: 0, running: false };
    var ms = (t.base || 0) + (t.running ? Math.max(0, Date.now() - (t.startedAt || Date.now())) : 0);
    var sec = Math.floor(ms / 1000);
    html += '<div class="cls-lv-row"><span class="cls-lv-timer" data-lv="timer">⏱ ' +
      fa(Math.floor(sec / 60)) + ":" + fa(String(sec % 60).padStart(2, "0")) + "</span>" +
      (host ? '<button class="btn btn-ghost btn-sm" data-lv="tstart" title="شروع">▶</button>' +
        '<button class="btn btn-ghost btn-sm" data-lv="tpause" title="توقف">⏸</button>' +
        '<button class="btn btn-ghost btn-sm" data-lv="treset" title="صفر">⟲</button>' : "") +
      "</div>";

    /* نظرسنجی */
    html += '<div class="cls-poll">';
    if (!r.poll) {
      if (host) {
        html += '<details class="cls-poll-new"><summary>📊 ساخت نظرسنجی زنده</summary>' +
          '<div class="cls-lv-form">' +
          '<input type="text" data-lv="pq" placeholder="پرسش (مثلاً: این مبحث را فهمیدی؟)">' +
          '<input type="text" data-lv="po1" placeholder="گزینهٔ ۱">' +
          '<input type="text" data-lv="po2" placeholder="گزینهٔ ۲">' +
          '<input type="text" data-lv="po3" placeholder="گزینهٔ ۳ (اختیاری)">' +
          '<input type="text" data-lv="po4" placeholder="گزینهٔ ۴ (اختیاری)">' +
          '<button class="btn btn-primary btn-sm" data-lv="pcreate">ساخت نظرسنجی</button>' +
          "</div></details>";
      } else {
        html += '<span class="cls-live-note">الان نظرسنجی فعالی نیست.</span>';
      }
    } else {
      var p = r.poll;
      var total = 0, i;
      for (var k in (p.votes || {})) total++;
      var myVote = (me() && p.votes && p.votes[me().id] !== undefined) ? p.votes[me().id] : -1;
      html += '<div class="cls-poll-q">📊 ' + esc(p.q) + (p.open ? "" : " <small>(بسته شد)</small>") + "</div>";
      for (i = 0; i < p.opts.length; i++) {
        var cnt = 0;
        for (var u in (p.votes || {})) if (p.votes[u] === i) cnt++;
        var pct = total ? Math.round((cnt / total) * 100) : 0;
        html += '<button class="cls-poll-opt' + (myVote === i ? " is-mine" : "") + '" data-lv="vote" data-i="' + i + '"' +
          (p.open ? "" : " disabled") + '>' +
          '<span class="cls-poll-t">' + esc(p.opts[i]) + "</span>" +
          '<span class="cls-poll-bar" aria-hidden="true"><i style="width:' + pct + '%"></i></span>' +
          '<span class="cls-poll-n">' + fa(cnt) + " · " + fa(pct) + "٪</span></button>";
      }
      html += '<span class="cls-live-note">' + fa(total) + " رأی</span>";
      if (host) html += ' <button class="btn btn-ghost btn-sm" data-lv="pclose">پایان نظرسنجی</button>';
    }
    html += "</div>";

    /* قرعه‌کشی */
    if (r.picked && Date.now() - (r.picked.at || 0) < 180000) {
      html += '<div class="cls-pick">🎯 <b>' + esc(r.picked.name) + "</b> انتخاب شد!</div>";
    }
    if (host) html += '<button class="btn btn-ghost btn-sm" data-lv="pick">🎯 قرعه‌کشی نام</button>';

    /* واکنش‌های سریع */
    html += '<div class="cls-lv-row cls-react">';
    ["👍", "❤️", "❓", "👏"].forEach(function (e) {
      var c = (r.react && r.react[e]) || 0;
      html += '<button class="cls-react-btn" data-lv="react" data-e="' + e + '">' + e + (c ? " <b>" + fa(c) + "</b>" : "") + "</button>";
    });
    if (host) html += '<button class="btn btn-ghost btn-sm" data-lv="rclear" title="پاک‌کردن واکنش‌ها">🧹</button>';
    html += "</div>";

    /* پیام‌های سریع */
    if (host) {
      html += '<div class="cls-lv-row cls-quick">';
      ["سکوت لطفاً 🙏", "سؤال بپرس ✋", "۵ دقیقه مانده ⏳", "فعالیت گروهی 👥"].forEach(function (m) {
        html += '<button class="btn btn-ghost btn-sm" data-lv="ann" data-m="' + esc(m) + '">' + esc(m) + "</button>";
      });
      html += "</div>";
    }

    var body = q('[data-lv="body"]', box);
    if (body) body.innerHTML = html;
    var note = q('[data-lv="note"]', box);
    if (note) {
      var mm = me();
      var rl = mm ? (mm.roleFa || ({ student: "دانش‌آموز", teacher: "دبیر", deputy: "ناظم", admin: "مدیر", owner: "مالک سایت" }[mm.role] || "")) : "";
      note.textContent = (S.room && S.room.part ? fa(Object.keys(S.room.part).length) + " نفر حاضر" : "") +
        (rl ? " · تو: " + rl : "");
    }
    stamp();
    if (!host) {
      var v = q('[data-lv="timer"]', box);
      if (v) v.title = "زمان‌سنج کلاس (دبیر کنترل می‌کند)";
    }
  }

  /* ------------------------------------------------ کنش‌ها */
  function act(path, body) {
    if (S.busy) return;
    S.busy = true;
    body.sessionId = S.sid;
    api("POST", path, body).then(function (r) {
      if (r.room) { S.room = r.room; paint(); }
      else load();
    }).catch(function (e) { if (W.HK && W.HK.toast) W.HK.toast(e.message); else alert(e.message); })
      .then(function () { S.busy = false; });
  }

  D.addEventListener("click", function (e) {
    var b = e.target.closest("[data-lv]");
    if (!b) return;
    var a = b.getAttribute("data-lv");
    if (a === "vote") { e.preventDefault(); act("/api/class/vote", { index: Number(b.getAttribute("data-i")) }); return; }
    if (a === "react") { e.preventDefault(); act("/api/class/react", { emoji: b.getAttribute("data-e") }); return; }
    if (a === "pick") { e.preventDefault(); act("/api/class/pick", {}); return; }
    if (a === "rclear") { e.preventDefault(); act("/api/class/reactclear", {}); return; }
    if (a === "ann") { e.preventDefault(); act("/api/class/announce", { text: b.getAttribute("data-m") }); return; }
    if (a === "tstart") { e.preventDefault(); act("/api/class/timer", { act: "start" }); return; }
    if (a === "tpause") { e.preventDefault(); act("/api/class/timer", { act: "pause" }); return; }
    if (a === "treset") { e.preventDefault(); act("/api/class/timer", { act: "reset" }); return; }
    if (a === "pclose") { e.preventDefault(); act("/api/class/poll", { close: true }); return; }
    if (a === "pcreate") {
      e.preventDefault();
      var box = q(".cls-live");
      var g = function (k) { var el = q('[data-lv="' + k + '"]', box); return el ? el.value.trim() : ""; };
      act("/api/class/poll", { q: g("pq"), opts: [g("po1"), g("po2"), g("po3"), g("po4")].filter(Boolean) });
      return;
    }
  });

  /* ------------------------------------------------ راه‌اندازی */
  /* در نسخهٔ آفلاین/اپ، کلاس زنده به سرور نیاز دارد؛ به‌جای صفحهٔ خالی،
     یک توضیح روشن با راهنما نشان می‌دهیم تا کاربر بداند چه کند. */
  var OFFLINE = (location.hostname === "appassets.androidplatform.net") ||
    (location.hostname === "") || (location.protocol === "file:");
  function offlineNotice() {
    var lobby = D.querySelector("#clsLobby");
    if (!lobby || D.querySelector(".cls-offline")) return;
    if (!OFFLINE) return;
    var box = D.createElement("div");
    box.className = "card cls-offline";
    box.style.margin = "14px auto";
    box.innerHTML = "<h4><span class=\"card-icon\">!</span> کلاس مجازی در نسخهٔ آفلاین</h4>" +
      "<p style=\"font-size:.88rem;color:var(--muted)\">کلاس زندهٔ مجازی (تختهٔ اشتراکی، گفت‌وگوی زنده، حضور و غیاب و نظرسنجی) " +
      "به سرور سایت نیاز دارد. بقیهٔ بخش‌ها — جزوه‌ها، آزمون‌ها، فلش‌کارت‌ها، ویرایشگر جزوه و «پنل من» — کامل کار می‌کنند.</p>" +
      "<p style=\"font-size:.88rem\">برای شرکت در کلاس زنده، سایت را روی سرور باز کن و با همان حساب وارد شو.</p>";
    lobby.appendChild(box);
  }

  function boot() {
    var urlSid = fromUrl();
    offlineNotice();
    setInterval(offlineNotice, 1500);
    if (urlSid) S.sid = urlSid;
    hookFetch();
    if (S.sid) mount();
    // وقتی کاربر وارد کلاس می‌شود (بدون تغییر نشانی)، از پاسخ‌های صفحه می‌فهمیم
    setInterval(function () {
      if (!S.sid) { var u = fromUrl(); if (u) { S.sid = u; mount(); } }
      else destroyIfGone();
    }, 3000);
    var box = q("#clsRoom");
    if (box && W.MutationObserver) {
      new MutationObserver(function () { if (!q(".cls-live")) mount(); }).observe(box, { attributes: true, attributeFilter: ["hidden"] });
    }
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
