/* ==========================================================================
   رهنما — پشتیبانی آنلاین  |  assets/r12-support.js
   --------------------------------------------------------------------------
   به‌جای شمارهٔ تلفن، گفت‌وگوی زندهٔ پشتیبانی:
     • کاربر: دکمهٔ شناور «پشتیبانی آنلاین» → می‌نویسد و پاسخ را همان‌جا می‌بیند
     • مالک/مدیر: در پنل مالک صندوق ورودی می‌بیند، گفت‌وگو را باز می‌کند و
       مستقیم جواب می‌دهد
   همه چیز هم‌زمان: هر ۴ ثانیه تازه می‌شود و به‌محض ارسال، بی‌درنگ دیده می‌شود.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fa(n) { try { return Number(n).toLocaleString("fa-IR"); } catch (e) { return String(n); } }
  function timeTxt(t) { try { return new Date(t).toLocaleString("fa-IR"); } catch (e) { return ""; } }

  var POLL = 4000;
  var open = false, isBoss = false, th = "", timer = 0, lastCount = -1;

  function api(m, p, b) {
    return fetch("/api/helpdesk/" + p, {
      method: m, credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: b ? JSON.stringify(b) : undefined
    }).then(function (r) { return r.json().catch(function () { return null; }); })
      .catch(function () { return null; });
  }

  /* ------------------------------------------------ ساخت ویجت */
  function build() {
    if ($("#r12Sup")) return;
    var box = D.createElement("div");
    box.id = "r12Sup";
    box.innerHTML =
      '<button type="button" class="r12-fab" id="r12Fab" title="پشتیبانی آنلاین" aria-label="پشتیبانی آنلاین">' +
      '<span class="r12-fab-t">💬</span><span class="r12-fab-l">پشتیبانی</span>' +
      '<span class="r12-dot" id="r12Dot" hidden></span></button>' +
      '<section class="r12-panel" id="r12Panel" hidden>' +
      '<header class="r12-head">' +
      '<b id="r12Title">پشتیبانی آنلاین</b>' +
      '<span class="r12-sub" id="r12Sub">هر وقت خواستی بنویس؛ زود جواب می‌دهیم.</span>' +
      '<button type="button" class="r12-x" id="r12Close" aria-label="بستن">✕</button>' +
      "</header>" +
      '<div class="r12-threads" id="r12Threads" hidden></div>' +
      '<div class="r12-msgs" id="r12Msgs"></div>' +
      '<form class="r12-form" id="r12Form">' +
      '<input id="r12Input" type="text" maxlength="900" placeholder="پیامت را بنویس…" autocomplete="off">' +
      '<button type="submit" class="r12-send" id="r12Send">ارسال</button>' +
      "</form></section>";
    D.body.appendChild(box);

    $("#r12Fab").addEventListener("click", function () {
      open = !open;
      $("#r12Panel").hidden = !open;
      if (open) { refresh(); if (!timer) timer = setInterval(refresh, POLL); }
      else if (timer) { clearInterval(timer); timer = 0; }
    });
    $("#r12Close").addEventListener("click", function () {
      open = false; $("#r12Panel").hidden = true;
      if (timer) { clearInterval(timer); timer = 0; }
    });
    /* هر لینک «پشتیبانی آنلاین» در صفحه (مثلاً فوتر) همین گفت‌وگو را باز کند */
    D.addEventListener("click", function (ev) {
      var el = ev.target && ev.target.closest && ev.target.closest("[data-r12-open]");
      if (!el) return;
      ev.preventDefault();
      if (!open) $("#r12Fab").click();
      var inp = $("#r12Input");
      if (inp) { try { inp.focus(); } catch (e) { } }
    });
    $("#r12Form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var inp = $("#r12Input"), text = (inp.value || "").trim();
      if (!text) return;
      inp.value = "";
      var payload = { text: text };
      if (isBoss && th) payload.to = th;
      api("POST", "send", payload).then(function (r) {
        if (!r || r.error) { paintSys(r && r.error ? r.error : "ارسال نشد؛ دوباره تلاش کن."); return; }
        refresh();
      });
    });
  }

  function paintSys(txt) {
    var m = $("#r12Msgs");
    if (!m) return;
    m.innerHTML += '<div class="r12-sys">' + esc(txt) + "</div>";
    m.scrollTop = m.scrollHeight;
  }

  function bubble(x) {
    var mine = x.from === "user";
    if (isBoss) mine = x.from === "owner";
    return '<div class="r12-b' + (mine ? " me" : " them") + '">' +
      (isBoss ? '<span class="r12-who">' + esc(x.name) + "</span>" : "") +
      '<div class="r12-txt">' + esc(x.text).replace(/\n/g, "<br>") + "</div>" +
      '<time class="r12-time">' + esc(timeTxt(x.t)) + "</time></div>";
  }

  /* ------------------------------------------------ تازه‌سازی */
  function refresh() {
    if (!open) return;
    if (isBoss) {
      api("GET", "threads").then(function (r) {
        if (!r || r.error) return;
        var list = r.threads || [];
        var box = $("#r12Threads");
        box.hidden = false;
        box.innerHTML = list.length
          ? list.map(function (t) {
              return '<button type="button" class="r12-th' + (t.th === th ? " is-on" : "") +
                '" data-th="' + esc(t.th) + '">' +
                "<b>" + esc(t.name) + (t.unread ? ' <i class="r12-badge">' + fa(t.unread) + "</i>" : "") + "</b>" +
                "<small>" + esc(String(t.last || "").slice(0, 40)) + "</small></button>";
            }).join("")
          : '<div class="r12-empty">هنوز کسی پیام نداده است.</div>';
        var dot = $("#r12Dot");
        if (dot) dot.hidden = !(r.unread > 0);
        Array.prototype.forEach.call(box.querySelectorAll(".r12-th"), function (b) {
          b.addEventListener("click", function () { openThread(b.getAttribute("data-th")); });
        });
      });
      if (th) loadThread(th);
    } else {
      api("GET", "thread").then(function (r) {
        if (!r || r.error) return;
        paint(r.msgs || []);
        var dot = $("#r12Dot");
        if (dot) dot.hidden = !(r.unread > 0);
        if (r.msgs && r.msgs.length !== lastCount) {
          lastCount = r.msgs.length;
          api("POST", "seen", {});
        }
      });
    }
  }

  function paint(list) {
    var m = $("#r12Msgs");
    if (!m) return;
    m.innerHTML = list.length
      ? list.map(bubble).join("")
      : '<div class="r12-empty">سلام! هر سؤالی داری همین‌جا بنویس — پاسخ می‌دهیم. 🙂</div>';
    m.scrollTop = m.scrollHeight;
  }

  function openThread(id) {
    th = id;
    $("#r12Threads").hidden = false;
    loadThread(id);
    api("POST", "seen", { th: id }).then(function () {
      var b = $('.r12-th[data-th="' + id + '"] .r12-badge');
      if (b) b.remove();
    });
  }

  function loadThread(id) {
    api("GET", "read?th=" + encodeURIComponent(id)).then(function (r) {
      if (!r || r.error) return;
      paint(r.msgs || []);
      var w = r.who;
      if (w) {
        $("#r12Sub").textContent = (w.name || "کاربر") + (w.grade ? " · پایه " + w.grade : "") +
          (w.phone ? " · " + w.phone : "") + (w.email ? " · " + w.email : "");
      }
    });
  }

  /* ------------------------------------------------ راه‌اندازی */
  function boot() {
    if (!D.body) return;
    fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var u = j && j.user;
        if (!u) return;                       // مهمان: پشتیبانی نمایش داده نمی‌شود
        isBoss = !!(u.isOwner || u.role === "owner" || u.role === "admin");
        build();
        if (isBoss) {
          $("#r12Title").textContent = "پشتیبانی آنلاین — صندوق ورودی";
          $("#r12Sub").textContent = "پیام‌های کاربران همین‌جا می‌آید؛ یکی را انتخاب کن و جواب بده.";
          $("#r12Input").placeholder = "پاسخ به کاربر انتخاب‌شده…";
          setInterval(function () {
            if (D.hidden) return;
            api("GET", "threads").then(function (r) { if (r && r.unread > 0) { var d = $("#r12Dot"); if (d) d.hidden = false; } });
          }, 15000);
        } else {
          setInterval(function () {
            if (D.hidden || open) return;
            api("GET", "thread").then(function (r) {
              if (r && r.unread > 0) { var d = $("#r12Dot"); if (d) d.hidden = false; }
            });
          }, 15000);
        }
      })
      .catch(function () { });
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
