/* ==========================================================================
   رهنما — «زنگ تفریح»: بخش هم‌زمان سایت  |  r10.js
   --------------------------------------------------------------------------
   مثل توییتر: نوشته بگذار، بپسند، پاسخ بده — و همه چیز بدون رفرش تازه شود.

   هم‌زمانی چطور کار می‌کند:
     • هر ۵ ثانیه فقط نوشته‌های تازه پرسیده می‌شود (since=آخرین زمان)
       پس ترافیک کم است و صفحه تازه می‌شود
     • برگشتن به تب یا پنجره → تازه‌سازی فوری
     • اگر در همین مرورگر چند زبانه باز باشد، با BroadcastChannel
       بی‌درنگ هماهنگ می‌شوند
     • اگر اتصال قطع شود، خودش دوباره تلاش می‌کند و وضعیت را نشان می‌دهد
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function toast(m) { try { W.HK && W.HK.toast ? W.HK.toast(m) : null; } catch (e) { } }
  function fa(n) { return String(n == null ? 0 : n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function ini(n) {
    n = String(n || "?").trim();
    var p = n.split(/\s+/);
    return (p[0] ? p[0].charAt(0) : "?") + (p[1] ? p[1].charAt(0) : "");
  }
  function ago(t) {
    if (!t) return "";
    var s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 45) return "همین حالا";
    if (s < 3600) return fa(Math.floor(s / 60)) + " دقیقه پیش";
    if (s < 86400) return fa(Math.floor(s / 3600)) + " ساعت پیش";
    if (s < 604800) return fa(Math.floor(s / 86400)) + " روز پیش";
    try { return new Date(t).toLocaleDateString("fa-IR"); } catch (e) { return ""; }
  }

  var LAST = 0;           // آخرین زمان نوشتهٔ دیده‌شده
  var SEEN = {};          // شناسه‌های موجود در صفحه
  var TIMER = 0, FAILS = 0, OPENED = {};
  var CH = null;
  try { if (W.BroadcastChannel) CH = new W.BroadcastChannel("g8-feed"); } catch (e) { CH = null; }

  function api(method, path, body) {
    return fetch(path, {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || (j && j.error)) { var e = new Error((j && j.error) || ("HTTP " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  /* ------------------------------------------------------------ نمایش یک نوشته */
  function postHTML(p, isNew) {
    var cms = (p.comments || []).map(function (c) {
      return '<div class="zt-cm"><div class="zt-ava" style="inline-size:26px;block-size:26px;font-size:.62rem;background:' +
        esc(c.color || "#8b93b8") + '">' + esc(ini(c.name)) + '</div><div class="zt-cm-t"><b>' + esc(c.name) +
        '</b> ' + esc(c.text) + "<small>" + esc(ago(c.t)) + "</small></div></div>";
    }).join("");
    return '<article class="zt-post' + (isNew ? " is-new" : "") + '" data-id="' + esc(p.id) +
      '" data-t="' + esc(p.t || 0) + '">' +
      '<div class="zt-ava" style="background:' + esc(p.color || "#6d5efc") + '">' + esc(ini(p.name)) + "</div>" +
      '<div class="zt-main">' +
      '<div class="zt-head"><b>' + esc(p.name) + "</b>" +
      (p.grade ? '<span class="zt-grade">پایهٔ ' + esc({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[p.grade] || p.grade) + "</span>" : "") +
      '<span class="zt-meta">' + esc(ago(p.t)) + "</span></div>" +
      '<p class="zt-text">' + esc(p.text) + "</p>" +
      '<div class="zt-acts">' +
      '<button type="button" class="zt-act like' + (p.liked ? " on" : "") + '" data-zt="like" data-id="' + esc(p.id) + '">' +
      "♥ <span>" + fa(p.likes) + "</span></button>" +
      '<button type="button" class="zt-act" data-zt="cmt" data-id="' + esc(p.id) + '">💬 ' +
      fa((p.comments || []).length) + "</button>" +
      (p.canDel ? '<button type="button" class="zt-act danger" data-zt="del" data-id="' + esc(p.id) + '">حذف</button>' : "") +
      "</div>" +
      '<div class="zt-comments" data-cm="' + esc(p.id) + '"' + (OPENED[p.id] ? "" : " hidden") + ">" + cms +
      '<form class="zt-cmform" data-cmform="' + esc(p.id) + '">' +
      '<input class="zt-cmin" type="text" maxlength="400" placeholder="پاسخ خود را بنویس…" aria-label="پاسخ">' +
      '<button type="submit" class="zt-btn">پاسخ</button>' +
      "</form></div></div></article>";
  }

  function prepend(posts, isNew) {
    var box = $("#ztFeed");
    if (!box || !posts.length) return;
    var html = posts.map(function (p) { SEEN[p.id] = 1; return postHTML(p, isNew); }).join("");
    var empty = $("#ztEmpty");
    if (empty) empty.remove();
    box.insertAdjacentHTML("afterbegin", html);
  }

  function paintStatus(j) {
    var dot = $("#ztDot"), on = $("#ztOnline"), tot = $("#ztTotal");
    if (dot) dot.className = "zt-dot" + (FAILS ? " off" : "");
    if (on) on.textContent = fa(j && j.online != null ? j.online : 0);
    if (tot) tot.textContent = fa(j && j.total != null ? j.total : 0);
    var st = $("#ztStat");
    if (st) st.textContent = FAILS ? "اتصال قطع است — دوباره تلاش می‌کنم…" : "هم‌زمان و بدون رفرش";
  }

  /* ------------------------------------------------------------ گرفتن نوشته‌ها */
  function load(since) {
    var url = "/api/feed/list" + (since ? "?since=" + since : "");
    return api("GET", url).then(function (j) {
      FAILS = 0;
      paintStatus(j);
      var posts = j.posts || [];
      if (since) {
        var fresh = posts.filter(function (p) { return !SEEN[p.id]; }).reverse();
        if (fresh.length) {
          prepend(fresh, true);
          setTimeout(function () {
            $$(".zt-post.is-new").forEach(function (x) { x.classList.remove("is-new"); });
          }, 4000);
        }
      } else {
        var box = $("#ztFeed");
        if (box) {
          box.innerHTML = "";
          if (!posts.length) {
            box.innerHTML = '<div class="zt-empty" id="ztEmpty">هنوز نوشته‌ای نیست. اولین نفر باش! ✏️</div>';
          } else {
            prepend(posts, false);
          }
        }
      }
      if (posts.length) {
        var mx = Math.max.apply(null, posts.map(function (p) { return p.t || 0; }));
        if (mx > LAST) LAST = mx;
      } else if (j.now && !LAST) LAST = j.now;
      try { W.ZT_ME = j.me || null; } catch (e) { }
      /* اگر کاربر وارد نشده باشد، جای کادر نوشتن، پیام ورود نشان بده */
      var gate = $("#ztGate");
      if (gate) gate.hidden = !!j.me;
      var f0 = $("#ztForm");
      if (f0) f0.hidden = !j.me;
      return j;
    }).catch(function () {
      FAILS++;
      paintStatus(null);
      return null;
    });
  }

  /* ------------------------------------------------------------ حلقهٔ هم‌زمانی */
  function startLoop() {
    if (TIMER) clearInterval(TIMER);
    TIMER = setInterval(function () {
      if (D.hidden) return;                 // تب پنهان: بی‌دلیل درخواست نزن
      load(LAST);
    }, 5000);
    D.addEventListener("visibilitychange", function () { if (!D.hidden) load(LAST); });
    W.addEventListener("focus", function () { load(LAST); });
    W.addEventListener("online", function () { load(LAST); });
    if (CH) CH.onmessage = function (ev) { if (!ev || !ev.data) return; if (ev.data.t === "feed") load(LAST); };
  }
  function ping() { try { if (CH) CH.postMessage({ t: "feed" }); } catch (e) { } }

  /* ------------------------------------------------------------ سیم‌کشی */
  function wire() {
    var form = $("#ztForm"), ta = $("#ztText"), cnt = $("#ztCount");
    if (!form) return;

    // شمارندهٔ نویسه
    if (ta && cnt) {
      ta.addEventListener("input", function () {
        var n = ta.value.length;
        cnt.textContent = fa(n) + " / ۸۰۰";
        cnt.className = "zt-count" + (n > 800 ? " bad" : "");
      });
    }

    // فرستادن نوشتهٔ تازه
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (ta.value || "").trim();
      if (!text) return;
      if (text.length > 800) { toast("نوشته بلندتر از ۸۰۰ نویسه است"); return; }
      var btn = $("#ztSend");
      if (btn) btn.disabled = true;
      api("POST", "/api/feed/post", { text: text }).then(function (r) {
        ta.value = ""; if (cnt) { cnt.textContent = "۰ / ۸۰۰"; cnt.className = "zt-count"; }
        if (r && r.post) { SEEN[r.post.id] = 1; LAST = Math.max(LAST, r.post.t || 0); prepend([r.post], true); }
        ping();
        toast("نوشته منتشر شد ✅");
      }).catch(function (err) {
        if (err.status === 401) toast("برای نوشتن، اول از «حساب من» وارد شو");
        else toast(err.message || "منتشر نشد");
      }).then(function () { if (btn) btn.disabled = false; });
    });

    // دکمه‌های هر نوشته
    D.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-zt]");
      if (!b) return;
      var act = b.getAttribute("data-zt"), id = b.getAttribute("data-id");
      if (act === "like") {
        // خوش‌بینانه: همان لحظه عوض کن، بعد با سرور هم‌راست کن
        var sp = b.querySelector("span"), was = b.classList.contains("on");
        b.classList.toggle("on", !was);
        if (sp) sp.textContent = fa(Math.max(0, (parseInt(sp.textContent.replace(/[۰-۹]/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹".indexOf(d); }), 10) || 0) + (was ? -1 : 1)));
        api("POST", "/api/feed/like", { id: id }).then(function (r) {
          if (sp) sp.textContent = fa(r.likes);
          b.classList.toggle("on", !!r.liked);
          ping();
        }).catch(function (err) {
          b.classList.toggle("on", was);
          if (err.status === 401) toast("برای پسندیدن، اول وارد شو");
        });
        return;
      }
      if (act === "cmt") {
        var box = $('[data-cm="' + id + '"]');
        if (box) { box.hidden = !box.hidden; if (!box.hidden) { var i = box.querySelector("input"); if (i) i.focus(); } }
        return;
      }
      if (act === "del") {
        if (!W.confirm("این نوشته حذف شود؟")) return;
        api("POST", "/api/feed/del", { id: id }).then(function () {
          var el = $('.zt-post[data-id="' + id + '"]');
          if (el) el.remove();
          delete SEEN[id];
          ping();
          toast("حذف شد");
        }).catch(function (err) { toast(err.message || "حذف نشد"); });
      }
    });

    // فرستادن پاسخ
    D.addEventListener("submit", function (e) {
      var f = e.target.closest && e.target.closest("[data-cmform]");
      if (!f) return;
      e.preventDefault();
      var id = f.getAttribute("data-cmform");
      var inp = f.querySelector("input");
      var text = (inp.value || "").trim();
      if (!text) return;
      api("POST", "/api/feed/comment", { id: id, text: text }).then(function (r) {
        var box = $('[data-cm="' + id + '"]');
        if (box) box.innerHTML = (r.comments || []).map(function (c) {
          return '<div class="zt-cm"><div class="zt-ava" style="inline-size:26px;block-size:26px;font-size:.62rem;background:#8b93b8">' +
            esc(ini(c.name)) + '</div><div class="zt-cm-t"><b>' + esc(c.name) + "</b> " + esc(c.text) +
            "<small>" + esc(ago(c.t)) + "</small></div></div>";
        }).join("") + '<form class="zt-cmform" data-cmform="' + esc(id) + '">' +
          '<input class="zt-cmin" type="text" maxlength="400" placeholder="پاسخ خود را بنویس…">' +
          '<button type="submit" class="zt-btn">پاسخ</button></form>';
        OPENED[id] = 1;
        ping();
        toast("پاسخ ثبت شد");
      }).catch(function (err) {
        if (err.status === 401) toast("برای پاسخ دادن، اول وارد شو");
        else toast(err.message || "ثبت نشد");
      });
    });
  }

  function boot() {
    if (!$("#ztFeed")) return;
    wire();
    load(0).then(function () { startLoop(); });
    // هر دقیقه زمان‌های «چند دقیقه پیش» را تازه کن
    setInterval(function () {
      if (D.hidden) return;
      $$(".zt-post").forEach(function (el) {
        var t = +el.getAttribute("data-t");
        if (t) { var m = el.querySelector(".zt-meta"); if (m) m.textContent = ago(t); }
      });
    }, 60000);
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
  W.ZT = { refresh: function () { return load(LAST); }, reload: function () { return load(0); } };
})();
