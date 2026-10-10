/* ==========================================================================
   رهنما — کلاس مجازی  |  assets/hk-class.js
   • ساخت کلاس با کد ورود، پیوستن با کد، جلسهٔ زنده
   • تختهٔ اشتراکی، گفت‌وگوی زندهٔ کلاس، فهرست حاضرین، بلندکردن دست
   • حضور و غیاب خودکار + خروجی CSV، زمان‌سنج جلسه
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var esc = function (s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  };
  var toast = function (m, ms) { if (W.HK && W.HK.toast) W.HK.toast(m, ms); };
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); };
  var pad2 = function (n) { return (n < 10 ? "0" : "") + n; };

  function api(method, path, body) {
    var opt = { method: method, credentials: "same-origin", headers: {} };
    if (method !== "GET") {
      opt.headers["Content-Type"] = "application/json";
      opt.headers["X-HK"] = "1";
      opt.body = JSON.stringify(body === undefined ? {} : body);
    }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error((j && j.error) || ("خطا (" + r.status + ")")); e.status = r.status; throw e; }
        return j;
      });
    });
  }

  var C = {
    me: null, mine: [], taught: [], sessions: [], isStaff: false,
    cls: null, session: null, room: null, rev: 0, tab: "chat",
    rev0: 0, boardDirty: false, boardTimer: 0, loopTimer: 0, hbTimer: 0,
    pendingCode: "", alive: true, tick: 0,
  };

  function classCard(c, forTeacher) {
    var live = c.live;
    return '<article class="cls-card' + (live ? " is-live" : "") + '">' +
      "<h4>" + esc(c.name) + "</h4>" +
      '<div class="cls-meta">' +
      (live ? '<span class="cls-chip is-live">● زنده</span>' : '<span class="cls-chip">بدون جلسهٔ زنده</span>') +
      (c.subject ? '<span class="cls-chip">' + esc(c.subject) + "</span>" : "") +
      (c.grade ? '<span class="cls-chip">پایهٔ ' + esc(c.grade) + "</span>" : "") +
      '<span class="cls-chip">' + fa(c.memberCount) + " عضو</span>" +
      (forTeacher || c.isTeacher ? '<span class="cls-chip is-code" title="کد ورود کلاس">' + esc(c.code) + "</span>" : "") +
      "</div>" +
      (c.teacher ? '<p style="margin:0;font-size:.8rem;color:var(--muted)">دبیر: ' + esc(c.teacher.name) + "</p>" : "") +
      '<div class="cls-actions">' +
      (c.isTeacher
        ? '<button class="btn btn-primary" data-act="start" data-id="' + esc(c.id) + '">شروع کلاس مجازی</button>'
        : (live ? '<button class="btn btn-primary" data-act="enter" data-id="' + esc(live.id) + '">ورود به کلاس</button>'
          : '<span style="font-size:.8rem;color:var(--muted)">منتظر شروع کلاس باش</span>')) +
      '' +
      '<button class="btn btn-ghost" data-act="attendance" data-id="' + esc(c.id) + '" ' + (c.isTeacher ? "" : "hidden") + ">حضور و غیاب</button>" +
      "</div></article>";
  }

  function renderLobby() {
    var host = $("#clsLobby");
    if (!host) return;
    var liveSessions = C.sessions.filter(function (s) { return s.status === "live"; });

    host.innerHTML =
      '<section class="wrap" style="padding-top:22px">' +
      '<div class="card">' +
      "<h4><span class=\"card-icon\">◆</span> کلاس مجازی رهنما</h4>" +
      "<p>با کد کلاس وارد شو، یا اگر دبیری کلاس بساز. داخل کلاس مجازی: تختهٔ اشتراکی، گفت‌وگوی زنده، فهرست حاضرین و حضور و غیاب خودکار.</p>" +
      '<div class="grid-2" style="align-items:start;gap:14px">' +
      '<div class="card" style="margin:0"><h4>ورود با کد کلاس</h4>' +
      '<div class="hk-field"><input id="clsCode" type="text" inputmode="latin" autocomplete="off" placeholder="مثلاً A7K2QP" style="letter-spacing:4px;text-align:center;font-family:var(--font-mono);direction:ltr;font-size:1.05rem"></div>' +
      '<button class="btn btn-primary" data-act="join" style="margin-top:10px;width:100%">ورود به کلاس</button>' +
      "</div>" +
      (C.isStaff
        ? '<div class="card" style="margin:0"><h4>ساخت کلاس تازه</h4>' +
        '<div class="hk-field"><input id="newName" placeholder="نام کلاس (مثلاً ریاضی هشتم — الف)"></div>' +
        '<div class="flex mt-2" style="gap:8px">' +
        '<div class="hk-field" style="flex:1"><select id="newGrade"><option value="">پایه…</option><option value="7">هفتم</option><option value="8">هشتم</option><option value="9">نهم</option></select></div>' +
        '<div class="hk-field" style="flex:1"><input id="newSubject" placeholder="درس"></div>' +
        "</div>" +
        '<label style="display:flex;gap:8px;align-items:center;margin:8px 0;font-size:.82rem"><input id="newAuto" type="checkbox" checked> همهٔ دانش‌آموزان همان پایه خودکار عضو شوند</label>' +
        '<button class="btn btn-primary" data-act="create" style="width:100%">ساخت کلاس و گرفتن کد</button>' +
        "</div>"
        : "") +
      "</div></div></section>" +

      (liveSessions.length
        ? '<section class="wrap" style="padding-top:18px"><div class="section-head" style="text-align:start"><h2 style="margin:0">جلسه‌های زندهٔ امروز</h2></div><div class="cls-grid">' +
        liveSessions.map(function (s) {
          return '<article class="cls-card is-live"><h4>' + esc(s.title) + "</h4>" +
            '<div class="cls-meta"><span class="cls-chip is-live">● در حال برگزاری</span>' +
            '<span class="cls-chip">' + fa(s.participantCount) + " نفر حاضر</span>" +
            '<span class="cls-chip is-code">' + esc(s.code) + "</span></div>" +
            '<div class="cls-actions"><button class="btn btn-primary" data-act="enter" data-id="' + esc(s.id) + '">ورود به کلاس</button></div></article>';
        }).join("") + "</div></section>"
        : "") +

      "<section class=\"wrap\" style=\"padding-top:18px;padding-bottom:34px\">" +
      (C.taught.length ? '<div class="section-head" style="text-align:start"><h2 style="margin:0">کلاس‌هایی که تدریس می‌کنم</h2></div><div class="cls-grid">' +
        C.taught.map(function (c) { return classCard(c, true); }).join("") + "</div>" : "") +
      (C.mine.length ? '<div class="section-head" style="text-align:start;margin-top:18px"><h2 style="margin:0">کلاس‌های من</h2></div><div class="cls-grid">' +
        C.mine.map(function (c) { return classCard(c, false); }).join("") + "</div>"
        : (C.taught.length ? "" : '<div class="hk-empty"><b>هنوز عضو هیچ کلاسی نیستی</b>کد کلاس را از دبیرت بگیر و از کادر بالا وارد شو.</div>')) +
      "</section>";
  }

  function renderRoom() {
    var host = $("#clsRoom");
    if (!host || !C.session || !C.room) return;
    var s = C.session, r = C.room, c = C.cls || {};
    var part = r.part || [];
    var hands = part.filter(function (p) { return p.hand; });
    var remain = Math.max(0, (s.startedAt + (s.minutes || 45) * 60000) - Date.now());
    var mm = Math.floor(remain / 60000), ss = Math.floor((remain % 60000) / 1000);
    var ended = s.status !== "live";

    host.innerHTML =
      '<section class="wrap" style="padding-top:16px">' +
      '<div class="cls-bar" style="border-radius:16px 16px 0 0;border:1px solid var(--border);border-bottom:0">' +
      '<span class="cls-live-dot" style="' + (ended ? "background:var(--muted);box-shadow:none" : "") + '"></span>' +
      "<h3>" + esc(s.title) + "</h3>" +
      (c.grade ? '<span class="cls-chip">پایهٔ ' + esc(c.grade) + "</span>" : "") +
      (c.subject ? '<span class="cls-chip">' + esc(c.subject) + "</span>" : "") +
      '<span class="cls-chip is-code" data-act="copycode" title="کپی کد کلاس" style="cursor:pointer">' + esc(s.code) + "</span>" +
      '<span class="cls-spacer" style="flex:1"></span>' +
      '<span class="cls-timer' + (remain < 5 * 60000 && !ended ? " is-warn" : "") + '">' +
      (ended ? "پایان‌یافته" : fa(pad2(mm) + ":" + pad2(ss))) + "</span>" +
      (r.canTeach && !ended
        ? '<button class="btn btn-ghost" data-act="attendance" data-id="' + esc(c.id) + '">حضور و غیاب</button>' +
        '<button class="btn btn-primary" data-act="end" data-id="' + esc(s.id) + '">پایان کلاس</button>'
        : "") +
      '<button class="btn btn-ghost" data-act="exit">بازگشت</button>' +
      "</div>" +

      '<div class="cls-room">' +
      '<div class="cls-main">' +
      '<div class="cls-tabs">' +
      '<button class="cls-tab' + (C.tab === "chat" ? " is-on" : "") + '" data-act="tab" data-tab="chat">گفت‌وگوی زنده</button>' +
      '<button class="cls-tab' + (C.tab === "board" ? " is-on" : "") + '" data-act="tab" data-tab="board">تختهٔ اشتراکی' + (r.canTeach ? " ✎" : "") + "</button>" +
      "</div>" +

      '<div class="cls-panel"' + (C.tab === "chat" ? "" : " hidden") + ">" +
      '<div class="hk-thread" id="clsChat" style="min-height:300px">' +
      ((r.msgs || []).length ? r.msgs.map(function (m) {
        var mine = C.me && m.from === C.me.id;
        return '<div class="hk-msg' + (mine ? " from-me" : "") + '"><div><div class="hk-msg-body">' +
          (!mine ? '<b style="font-size:.72rem;opacity:.8;display:block">' + esc(m.name) + "</b>" : "") +
          esc(m.text) + "</div></div></div>";
      }).join("") : '<div class="hk-empty"><b>گفت‌وگوی کلاس</b>اولین پیام را بنویس؛ دبیر و همهٔ هم‌کلاسی‌ها می‌بینند.</div>') +
      "</div>" +
      '<div class="hk-chat-compose"><textarea rows="1" id="clsMsg" data-act="msg" placeholder="پیام به کلاس… (Enter برای ارسال)"' + (ended ? " disabled" : "") + "></textarea>" +
      '<button class="hk-send" data-act="sendmsg"' + (ended ? " disabled" : "") + ">ارسال</button></div>" +
      "</div>" +

      '<div class="cls-panel"' + (C.tab === "board" ? "" : " hidden") + ">" +
      '<textarea class="cls-board" id="clsBoard" ' + (r.canTeach && !ended ? "" : "readonly") + ' placeholder="' +
      (r.canTeach ? "سؤال یا نکتهٔ امروز را این‌جا بنویس؛ همهٔ دانش‌آموزان همان لحظه می‌بینند." : "تختهٔ کلاس — هر چیزی که دبیر بنویسد همین‌جا دیده می‌شود.") + '" dir="auto">' +
      esc(r.board || "") + "</textarea>" +
      '<div class="cls-board-note">' + (r.canTeach ? "نوشته‌هایت خودکار ذخیره می‌شود." : "فقط دبیر می‌تواند روی تخته بنویسد.") + "</div>" +
      "</div>" +
      "</div>" +

      '<aside class="cls-side">' +
      '<h4 style="margin:0 0 8px;font-size:.9rem">حاضرین · ' + fa(part.length) + "</h4>" +
      (hands.length ? '<div class="cls-chip" style="background:var(--warn-bg);border-color:var(--warn);color:var(--warn);display:block;margin-bottom:8px">✋ ' +
        fa(hands.length) + " نفر دستشان بلند است: " + esc(hands.map(function (h) { return h.name; }).join("، ")) + "</div>" : "") +
      (part.length ? part.map(function (p) {
        return '<div class="cls-part">' +
          '<span class="hk-ava2" style="width:30px;height:30px;font-size:.75rem;border-radius:10px">' + esc(String(p.name || "؟").charAt(0)) + "</span>" +
          "<span><b>" + esc(p.name) + "</b><small>" +
            (String(p.roleFa || "").indexOf("دبیر") > -1 ? "👩‍🏫 "
              : (String(p.roleFa || "").indexOf("ناظم") > -1 ? "🧑‍💼 "
                : (String(p.roleFa || "").indexOf("مدیر") > -1 || String(p.roleFa || "").indexOf("مالک") > -1 ? "🛡 " : "🧑‍🎓 "))) +
            esc(p.roleFa || "") + (p.muted ? " · بی‌صدا" : "") + "</small></span>" +
          (p.hand ? '<span class="hand" title="دست بلند">✋</span>' : "") +
          (r.canTeach
            ? '<button class="hk-ic-btn" data-act="hand" data-id="' + esc(p.id) + '" data-up="' + (p.hand ? "0" : "1") + '" title="' +
            (p.hand ? "پایین آوردن دست" : "اجازهٔ صحبت") + '" style="width:28px;height:28px">' + (p.hand ? "↓" : "↑") + "</button>"
            : "") +
          "</div>";
      }).join("") : '<div class="hk-empty" style="padding:14px">هنوز کسی وارد نشده.</div>') +
      (C.me && !r.canTeach && !ended
        ? '<button class="btn btn-ghost" data-act="hand" data-id="' + esc(C.me.id) + '" data-up="' +
        ((part.filter(function (p) { return p.id === C.me.id && p.hand; }).length) ? "0" : "1") + '" style="width:100%;margin-top:8px">✋ ' +
        ((part.filter(function (p) { return p.id === C.me.id && p.hand; }).length) ? "پایین آوردن دست" : "بلند کردن دست") + "</button>"
        : "") +
      "</aside></div>" +
      "</section>";
  }

  function paint() {
    var lobby = $("#clsLobby"), room = $("#clsRoom");
    if (C.session && C.room) {
      if (lobby) lobby.hidden = true;
      if (room) { room.hidden = false; renderRoom(); }
    } else {
      if (lobby) { lobby.hidden = false; renderLobby(); }
      if (room) room.hidden = true;
    }
  }

  /* ------------------------------------------------------------- داده‌ها */
  function loadList() {
    return api("GET", "/api/class/list").then(function (r) {
      C.mine = r.mine || [];
      C.taught = r.taught || [];
      C.sessions = r.sessions || [];
      C.isStaff = !!r.isStaff;
      paint();
      return r;
    });
  }

  function applyRoom(r) {
    C.cls = r.class || C.cls;
    C.session = r.session || C.session;
    C.room = r.room || C.room;
    if (r.room) C.rev = r.room.rev || 0;
    var wasBoard = $("#clsBoard");
    var keepFocus = wasBoard && D.activeElement === wasBoard;
    var caret = keepFocus ? wasBoard.selectionStart : 0;
    var typing = $("#clsMsg");
    var msgVal = typing ? typing.value : "";
    var msgFocus = !!(typing && D.activeElement === typing);
    var msgCaret = msgFocus ? typing.selectionStart : 0;
    var chatHidden = $("#clsChat");
    var stick = chatHidden ? (chatHidden.scrollTop + chatHidden.clientHeight >= chatHidden.scrollHeight - 40) : true;
    paint();
    if (keepFocus) {
      var nb = $("#clsBoard");
      if (nb && nb.value === (C.room.board || "")) { nb.focus(); try { nb.setSelectionRange(caret, caret); } catch (e) {} }
    }
    var nm = $("#clsMsg");
    if (nm && msgVal) {
      nm.value = msgVal;
      if (msgFocus && !nm.disabled) {
        nm.focus();
        try { nm.setSelectionRange(msgCaret, msgCaret); } catch (e) {}
      }
    }
    var ch = $("#clsChat");
    if (ch && stick) ch.scrollTop = ch.scrollHeight;
  }

  function enterRoom(sessionId) {
    return api("GET", "/api/class/room?session=" + encodeURIComponent(sessionId)).then(function (r) {
      applyRoom(r);
      C.rev = (r.room && r.room.rev) || 0;
      startLoops();
      toast("وارد کلاس شدی. موفق باشی!");
    }).catch(function (e) { toast(e.message); });
  }

  function startLoops() {
    stopLoops();
    C.alive = true;
    roomLoop();
    C.hbTimer = setInterval(function () {
      if (!C.session || C.session.status !== "live") return;
      api("POST", "/api/class/ping", { sessionId: C.session.id }).catch(function () {});
    }, 30000);
    C.tick = setInterval(function () {
      if (!C.session || C.session.status !== "live") return;
      // فقط زمان‌سنج را تازه می‌کند، بدون بازسازی کل صفحه
      var t = $(".cls-timer");
      if (!t) return;
      var remain = Math.max(0, (C.session.startedAt + (C.session.minutes || 45) * 60000) - Date.now());
      var mm = Math.floor(remain / 60000), ss = Math.floor((remain % 60000) / 1000);
      t.textContent = fa(pad2(mm) + ":" + pad2(ss));
      t.classList.toggle("is-warn", remain < 5 * 60000);
    }, 1000);
  }

  function stopLoops() {
    if (C.loopTimer) { clearTimeout(C.loopTimer); C.loopTimer = 0; }
    if (C.hbTimer) { clearInterval(C.hbTimer); C.hbTimer = 0; }
    if (C.tick) { clearInterval(C.tick); C.tick = 0; }
  }

  function roomLoop() {
    if (!C.session || !C.alive) return;
    api("GET", "/api/class/stream?session=" + encodeURIComponent(C.session.id) + "&rev=" + C.rev + "&timeout=25000")
      .then(function (r) {
        if (r.changed) {
          var newChat = (r.room.msgs || []).length !== ((C.room && C.room.msgs) || []).length;
          applyRoom(r);
          if (newChat) {
            var ch = $("#clsChat");
            if (ch) ch.scrollTop = ch.scrollHeight;
          }
          if (r.session && r.session.status === "ended") {
            clearInterval(C.tick);
            toast("کلاس توسط دبیر تمام شد.");
            stopLoops();
            setTimeout(function () { exitRoom(); }, 1200);
            return;
          }
        } else {
          C.session = r.session || C.session;
        }
        C.loopTimer = setTimeout(roomLoop, 200);
      })
      .catch(function (e) {
        if (e && (e.status === 401 || e.status === 403 || e.status === 404)) {
          toast(e.message);
          stopLoops();
          setTimeout(exitRoom, 900);
          return;
        }
        C.loopTimer = setTimeout(roomLoop, 6000);
      });
  }

  function exitRoom() {
    stopLoops();
    C.session = null; C.room = null; C.cls = null; C.rev = 0;
    var url = new URL(W.location.href);
    if (url.searchParams.get("session") || url.searchParams.get("code")) {
      url.searchParams.delete("session");
      url.searchParams.delete("code");
      try { W.history.replaceState({}, "", url.toString()); } catch (e) {}
    }
    paint();
    loadList().catch(function () {});
  }

  function startClass(classId) {
    api("POST", "/api/class/session", { classId: classId }).then(function (r) {
      C.session = r.session;
      return enterRoom(r.session.id);
    }).catch(function (e) { toast(e.message); });
  }

  function joinByCode(code) {
    if (!code || code.trim().length < 4) { toast("کد کلاس را کامل وارد کن."); return; }
    api("POST", "/api/class/join", { code: code.trim().toUpperCase() }).then(function (r) {
      if (r.session && r.session.status === "live") {
        enterRoom(r.session.id);
      } else {
        toast("به کلاس «" + r.class.name + "» پیوستی. الان جلسهٔ زنده‌ای نیست.");
        C.pendingCode = r.class.code;
        loadList().catch(function () {});
        paint();
      }
    }).catch(function (e) { toast(e.message); });
  }

  function createClass() {
    var name = ($("#newName") || {}).value || "";
    var grade = ($("#newGrade") || {}).value || "";
    var subject = ($("#newSubject") || {}).value || "";
    var auto = $("#newAuto") ? $("#newAuto").checked : true;
    if (name.trim().length < 2) { toast("نام کلاس را بنویس."); return; }
    api("POST", "/api/class/create", { name: name, grade: grade, subject: subject, autoMembers: auto })
      .then(function (r) {
        toast("کلاس ساخته شد · کد ورود: " + r.class.code);
        loadList().catch(function () {});
      }).catch(function (e) { toast(e.message); });
  }

  function sendMsg() {
    var ta = $("#clsMsg");
    if (!ta || !C.session) return;
    var text = String(ta.value || "").trim();
    if (!text) return;
    ta.disabled = true;
    api("POST", "/api/class/chat", { sessionId: C.session.id, text: text }).then(function () {
      ta.value = "";
      ta.disabled = false;
      ta.focus();
      roomLoopNow();
    }).catch(function (e) {
      ta.disabled = false;
      toast(e.message);
    });
  }

  function roomLoopNow() {
    if (C.loopTimer) clearTimeout(C.loopTimer);
    C.loopTimer = setTimeout(roomLoop, 10);
  }

  function saveBoard() {
    var ta = $("#clsBoard");
    if (!ta || !C.room || !C.room.canTeach || !C.session) return;
    C.boardDirty = false;
    api("POST", "/api/class/board", { sessionId: C.session.id, board: ta.value }).then(function (r) {
      if (C.room) C.room.board = ta.value;
      C.rev = r.rev || C.rev;
    }).catch(function (e) { toast(e.message); });
  }

  function showAttendance(classId) {
    var live = C.session && C.session.status === "live" ? C.session.id : null;
    var sid = live || null;
    var go = function (id) {
      api("GET", "/api/class/attendance?session=" + encodeURIComponent(id)).then(function (r) {
        var html = '<div class="hk-empty" style="text-align:start;padding:0 0 10px">' +
          "<b>" + esc(r.className) + " — " + esc(r.session.title) + "</b>" +
          fa(r.present) + " نفر حاضر · " + fa(r.online) + " نفر آنلاین</div>" +
          '<div style="max-height:52vh;overflow:auto"><table class="cls-att"><thead><tr><th>نام</th><th>پایه</th><th>حاضر</th><th>آنلاین</th><th>دقیقه</th></tr></thead><tbody>' +
          r.rows.map(function (x) {
            return "<tr><td>" + esc(x.name) + "</td><td>" + esc(x.grade) + "</td><td>" +
              (x.present ? "✓" : "—") + "</td><td>" + (x.online ? "●" : "—") + "</td><td>" + fa(x.minutes) + "</td></tr>";
          }).join("") + "</tbody></table></div>" +
          '<div class="flex mt-2"><a class="btn btn-primary" href="/api/class/attendance?session=' +
          encodeURIComponent(id) + '&format=csv">دانلود CSV</a>' +
          '<button class="btn btn-ghost" data-act="closeModal">بستن</button></div>';
        modal("حضور و غیاب", html);
      }).catch(function (e) { toast(e.message); });
    };
    if (sid) return go(sid);
    // اگر جلسهٔ زنده نیست، آخرین جلسهٔ همان کلاس را می‌گیریم
    api("GET", "/api/class/overview").then(function (r) {
      var found = (r.classes || []).filter(function (c) { return c.id === classId; })[0];
      var sessions = (r.live || []).filter(function (s) { return s.classId === classId; });
      if (found && found.live) return go(found.live.id);
      if (sessions.length) return go(sessions[0].id);
      toast("برای این کلاس هنوز جلسه‌ای برگزار نشده است.");
    }).catch(function (e) { toast(e.message); });
  }

  function modal(title, html) {
    var m = $("#clsModal");
    if (!m) {
      m = D.createElement("div");
      m.id = "clsModal";
      m.style.cssText = "position:fixed;inset:0;z-index:900;background:rgba(12,14,30,.5);display:grid;place-items:center;padding:16px";
      D.body.appendChild(m);
    }
    m.innerHTML = '<div class="card" style="max-width:640px;width:100%;max-height:86vh;overflow:auto">' +
      "<h4>" + esc(title) + "</h4>" + html + "</div>";
    m.hidden = false;
    m.onclick = function (e) { if (e.target === m || e.target.closest('[data-act="closeModal"]')) m.hidden = true; };
  }

  /* -------------------------------------------------------------- رویدادها */
  function bind() {
    D.addEventListener("click", function (e) {
      var t = e.target.closest("[data-act]");
      if (!t) return;
      var act = t.getAttribute("data-act");
      var id = t.getAttribute("data-id");
      if (act === "join") { joinByCode(($("#clsCode") || {}).value || ""); return; }
      if (act === "create") { createClass(); return; }
      if (act === "start") { startClass(id); return; }
      if (act === "enter") { enterRoom(id); return; }
      if (act === "exit") { exitRoom(); return; }
      if (act === "tab") { C.tab = t.getAttribute("data-tab"); paint(); return; }
      if (act === "sendmsg") { sendMsg(); return; }
      if (act === "end") {
        if (!W.confirm("کلاس را تمام کنی؟ دانش‌آموزان از کلاس بیرون می‌آیند و حضور و غیاب ثبت می‌شود.")) return;
        api("POST", "/api/class/session/end", { sessionId: id }).then(function () {
          toast("کلاس تمام شد.");
          exitRoom();
        }).catch(function (er) { toast(er.message); });
        return;
      }
      if (act === "hand") {
        api("POST", "/api/class/hand", { sessionId: C.session ? C.session.id : "", userId: id, up: t.getAttribute("data-up") === "1" })
          .then(function () { roomLoopNow(); })
          .catch(function (er) { toast(er.message); });
        return;
      }
      if (act === "attendance") { showAttendance(id); return; }
      if (act === "copycode") {
        var code = t.textContent.trim();
        try {
          navigator.clipboard.writeText(code);
          toast("کد کلاس کپی شد: " + code);
        } catch (er) { toast("کد کلاس: " + code); }
        return;
      }
    });

    D.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && e.target && e.target.id === "clsMsg") {
        e.preventDefault();
        sendMsg();
      }
      if (e.key === "Enter" && e.target && e.target.id === "clsCode") {
        e.preventDefault();
        joinByCode(e.target.value);
      }
    });

    D.addEventListener("input", function (e) {
      var el = e.target;
      if (!el) return;
      if (el.id === "clsBoard") {
        if (C.boardTimer) clearTimeout(C.boardTimer);
        C.boardTimer = setTimeout(saveBoard, 900);
      }
      if (el.id === "clsMsg") {
        el.style.height = "auto";
        el.style.height = Math.min(120, el.scrollHeight) + "px";
      }
    });

    W.addEventListener("beforeunload", function () { stopLoops(); });
  }

  /* ------------------------------------------------------------- راه‌اندازی */
  function boot() {
    if (!D.getElementById("clsLobby")) return;
    bind();

    var params = new URLSearchParams(W.location.search);
    var code = params.get("code") || "";
    var session = params.get("session") || "";
    var classId = params.get("class") || "";

    function ready(me) {
      C.me = me;
      if (!me) {
        paintAuthWall();
        return;
      }
      loadList().then(function () {
        if (code) return joinByCode(code);
        if (session) return enterRoom(session);
        if (classId) {
          var found = C.mine.concat(C.taught).filter(function (c) { return c.id === classId; })[0];
          if (found && found.live) return enterRoom(found.live.id);
          if (found && found.isTeacher) return startClass(found.id);
          toast("برای این کلاس جلسهٔ زنده‌ای نیست.");
        }
        return null;
      }).catch(function (e) { toast(e.message); });
    }

    var got = false;
    W.addEventListener("hk:auth", function (e) { got = true; ready(e.detail); });
    if (W.HK && W.HK.auth && W.HK.auth.me && W.HK.auth.me()) { got = true; ready(W.HK.auth.me()); }
    setTimeout(function () {
      if (got) return;
      api("GET", "/api/auth/me").then(function (r) { ready(r.user); }).catch(function () { ready(null); });
    }, 900);
  }

  function paintAuthWall() {
    var lobby = $("#clsLobby");
    if (!lobby) return;
    lobby.hidden = false;
    lobby.innerHTML = '<section class="wrap" style="padding-top:26px"><div class="cls-lobby">' +
      "<h2>کلاس مجازی رهنما</h2>" +
      "<p>برای ورود به کلاس مجازی، اول وارد حساب کاربری‌ات شو. اگر کد کلاس داری، بعد از ورود همان کد را وارد کن.</p>" +
      '<div class="flex mt-2" style="justify-content:center"><a class="btn btn-primary" href="' + U("profile.html") + '">ورود / ثبت‌نام</a>' +
      '</div></div></section>';
  }

  W.HK = W.HK || {};
  W.HK.Class = { api: api, state: C, load: loadList, join: joinByCode, start: startClass };

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
