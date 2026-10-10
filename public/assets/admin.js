/* ==========================================================================
   رهنما — منطق پنل مدیریت  |  admin.js
   نمای کلی، کاربران، اعلان، تنظیمات، رویدادها، گزارش اقدامات و خروجی‌ها
   ========================================================================== */
(function () {
  "use strict";

  var W = window, D = document;
  var $ = function (s, r) { return (r || D).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); };
  var NFA = "۰۱۲۳۴۵۶۷۸۹";
  var fa = function (n) { return String(n).replace(/\d/g, function (d) { return NFA[+d]; }); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  var num = function (n) { return fa(Number(n || 0).toLocaleString("en-US")); };
  function toast(m, ms) { W.HK && W.HK.toast ? W.HK.toast(m, ms) : null; }
  function api(method, path, body) {
    var opt = { method: method, headers: {}, credentials: "same-origin" };
    if (method !== "GET") { opt.headers["Content-Type"] = "application/json"; opt.headers["X-HK"] = "1"; opt.body = JSON.stringify(body || {}); }
    return fetch(path, opt).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var e = new Error(j.error || ("خطا " + r.status)); e.status = r.status; throw e; }
        return j;
      });
    });
  }
  function jdate(t) {
    if (!t) return "—";
    try { return new Date(t).toLocaleString("fa-IR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }); }
    catch (e) { return "—"; }
  }

  var STATE = { user: null, stats: null, settings: null, users: [], page: 1, pages: 1, q: "", role: "", grade: "", sort: "new", audit: [], events: [] };

  /* --------------------------------------------------- دسترسی */
  function guard() {
    return api("GET", "/api/auth/me").then(function (r) {
      STATE.user = r.user;
      if (!r.user || ["admin", "owner"].indexOf(r.user.role) === -1) {
        $("#admDeny").hidden = false;
        $("#admBody").hidden = true;
        return false;
      }
      $("#admDeny").hidden = true;
      $("#admBody").hidden = false;
      $("#admWho").textContent = r.user.name + " — " + r.user.roleFa;
      $("[data-nav=users]").hidden = false;
      if (r.user.role !== "admin" && r.user.role !== "owner") {
        $$("[data-admin-only]").forEach(function (e) { e.hidden = true; });
      }
      return true;
    }).catch(function () {
      $("#admDeny").hidden = false;
      $("#admBody").hidden = true;
      return false;
    });
  }

  /* --------------------------------------------------- ناوبری */
  function show(name) {
    $$("[data-pane]").forEach(function (p) { p.hidden = p.getAttribute("data-pane") !== name; });
    $$(".adm-nav button").forEach(function (b) { b.classList.toggle("on", b.getAttribute("data-nav") === name); });
    $("#admSide").classList.remove("open");
    try { location.hash = name; } catch (e) {}
    if (name === "users") loadUsers();
    if (name === "events") loadEvents();
    if (name === "audit") loadAudit();
    if (name === "overview") loadStats();
    if (name === "school") { loadSchool(); loadOwners(); }
    if (name === "settings") loadSettings();
  }

  /* -------------------------------------------------- نمای کلی */
  function loadStats() {
    return api("GET", "/api/admin/stats").then(function (r) {
      STATE.stats = r.stats; STATE.settings = r.settings;
      paintStats();
      paintSettings(r.settings);
      return r;
    }).catch(function (e) { toast(e.message); });
  }

  function paintStats() {
    var s = STATE.stats;
    if (!s) return;
    var u = s.users, a = s.activity, l = s.learning, sv = s.server;

    $("#admKpis").innerHTML =
      kpi("کاربران", num(u.total), "امروز: " + fa(u.newToday) + " · این هفته: " + fa(u.newWeek), "👥") +
      kpi("آنلاین (۱۵ دقیقه)", num(a.activeNow), "فعال در ۲۴ ساعت: " + fa(a.activeToday), "🟢") +
      kpi("نشست‌های باز", num(a.sessions), "کل رویدادها: " + num(a.events), "🔑") +
      kpi("درس خوانده‌شده", num(l.lessonsRead), "یادداشت‌ها: " + fa(l.notes), "📚") +
      kpi("آزمون‌ها", num(l.exams), "میانگین نمره: " + fa(l.quizAvg) + "٪", "📝") +
      kpi("زمان مطالعه", num(l.studyMinutes) + " <em>دقیقه</em>", "مجموع همهٔ کاربران", "⏱") +
      kpi("دبیران / مدیران", fa(u.byRole.teacher) + " / " + fa(u.byRole.admin), "دانش‌آموز: " + num(u.byRole.student), "🎓") +
      kpi("سلامت سرور", num(Math.round(sv.uptimeSeconds / 60)) + " <em>دقیقه</em>", "حافظه: " + fa(sv.memoryMB) + " مگابایت · " + sv.node, "⚙");

    // اقلام هشداری
    var warn = [];
    if (u.banned) warn.push('<div class="callout error"><span class="c-ico">×</span><div><span class="c-title">' + fa(u.banned) + ' کاربر مسدود</span><p>در تب کاربران می‌توانی وضعیتشان را ببینی.</p></div></div>');
    if (u.newToday) warn.push('<div class="callout tip"><span class="c-ico">◆</span><div><span class="c-title">' + fa(u.newToday) + ' عضو جدید امروز</span><p>خوش‌آمد بگو و اعلان بگذار.</p></div></div>');
    $("#admAlerts").innerHTML = warn.join("") || '<p style="color:var(--muted);font-size:.86rem">هیچ هشدار مهمی نیست.</p>';

    // نمودار ۱۴ روز
    var days = Object.keys(a.byDay);
    var max = 1;
    days.forEach(function (k) { var v = a.byDay[k]; max = Math.max(max, v.logins, v.signs, v.quizzes, v.ai); });
    $("#admChart").innerHTML = chart(days, a.byDay, max);

    // توزیع پایه‌ها
    $("#admGrades").innerHTML = ["7", "8", "9"].map(function (g) {
      var n = u.byGrade[g] || 0;
      var pct = u.total ? Math.round(n / u.total * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">' +
        '<span style="min-width:56px;font-size:.82rem;font-weight:800">پایهٔ ' + ({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[g]) + "</span>" +
        '<div class="rp-bar" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
        '<b style="font-size:.82rem;min-width:70px;text-align:end">' + num(n) + " (" + fa(pct) + "٪)</b></div>";
    }).join("");

    // توزیع نقش‌ها
    $("#admRoles").innerHTML = ["admin", "teacher", "student"].map(function (r) {
      var n = u.byRole[r] || 0;
      var pct = u.total ? Math.round(n / u.total * 100) : 0;
      return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:9px">' +
        '<span style="min-width:56px;font-size:.82rem;font-weight:800">' + ({ admin: "مدیر", teacher: "دبیر", student: "دانش‌آموز" }[r]) + "</span>" +
        '<div class="rp-bar" style="flex:1"><i style="width:' + pct + '%"></i></div>' +
        '<b style="font-size:.82rem;min-width:70px;text-align:end">' + num(n) + "</b></div>";
    }).join("");

    var bad = $(".adm-nav [data-badge=users]");
    if (bad) bad.textContent = fa(u.total);
  }

  /* ------------------------------------- کلاس مجازی و (مدرسه) */
  function loadSchool() {
    return api("GET", "/api/class/overview").then(function (r) {
      var t = r.totals || {};
      var k = $("#admSchoolKpi");
      if (k) {
        k.innerHTML =
          kpi("کلاس‌های مجازی", fa(t.classes || 0), "کلاس ساخته‌شده در مدرسه", "🎓") +
          kpi("جلسه‌های زنده", fa(t.live || 0), "همین حالا در حال برگزاری", "●") +
          kpi("جلسه‌ها", fa(t.sessions || 0), "مجموع جلسه‌های برگزارشده", "🗓") +
          kpi("گروه‌های گفت‌وگو", fa(t.groups || 0), "گروه کلاسی و", "💬") +
          kpi("پیام‌ها", fa(t.messages || 0), "پیام ذخیره‌شده", "✉");
      }
      var box = $("#admSchoolClasses");
      if (box) {
        box.innerHTML = (r.classes || []).length
          ? '<div style="overflow:auto"><table class="adm-table"><thead><tr><th>کلاس</th><th>دبیر</th><th>پایه</th><th>درس</th><th>اعضا</th><th>کد ورود</th><th>وضعیت</th><th></th></tr></thead><tbody>' +
          r.classes.map(function (c) {
            return "<tr><td><b>" + esc(c.name) + "</b></td><td>" + esc(c.teacher ? c.teacher.name : "—") + "</td>" +
              "<td>" + esc(c.grade || "—") + "</td><td>" + esc(c.subject || "—") + "</td>" +
              "<td>" + fa(c.memberCount) + "</td>" +
              '<td style="direction:ltr;font-family:var(--font-mono)">' + esc(c.code) + "</td>" +
              "<td>" + (c.live ? '<span class="cls-chip is-live">● زنده</span>' : "—") + "</td>" +
              '<td><a class="btn btn-ghost btn-sm" href="/class.html?class=' + encodeURIComponent(c.id) + '">باز کردن</a></td></tr>';
          }).join("") + "</tbody></table></div>"
          : '<div class="adm-log">هنوز کلاسی ساخته نشده است.</div>';
      }
      var lb = $("#admSchoolLive");
      if (lb) {
        lb.innerHTML = (r.live || []).length
          ? r.live.map(function (s) {
            return '<div style="display:flex;gap:10px;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid var(--border)">' +
              "<span><b>" + esc(s.title) + "</b> · " + fa(s.participantCount) + " نفر حاضر</span>" +
              '<span class="cls-chip is-code">' + esc(s.code) + "</span>" +
              '<a class="btn btn-ghost btn-sm" href="/class.html?session=' + encodeURIComponent(s.id) + '">ورود</a></div>';
          }).join("")
          : '<div class="adm-log">الان هیچ کلاس زنده‌ای نیست.</div>';
      }
      return r;
    }).catch(function (e) { toast(e.message); });
  }

  /* ---------------------------------- مالکان سایت و تیک آبی‌ها (پنل مالک) */
  function ownRow(u, canManage, mode) {
    return '<div style="display:flex;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">' +
      '<span class="hk-ava" style="background:linear-gradient(140deg,' + (u.color || "#6d5efc") + ',color-mix(in srgb,' + (u.color || "#6d5efc") + ' 55%,#000))">' +
      esc(String(u.name || "؟").charAt(0)) + "</span>" +
      '<span style="min-width:0"><b style="font-size:.86rem">' + esc(u.name) + "</b>" +
      (u.isOwner ? ' <span class="hk-ownertag">مالک سایت</span>' : "") +
      (u.verified ? ' <span class="hk-tick" title="تأییدشده"></span>' : "") +
      (!u.verified && !u.isOwner ? ' <span style="font-size:.7rem;color:var(--muted)">بدون تیک</span>' : "") +
      '<small style="display:block;color:var(--muted);font-size:.72rem">' + esc(u.email) + " · " + esc(u.roleFa) +
      " · پایهٔ " + esc(u.grade) + (u.online ? " · <span style='color:var(--ok)'>آنلاین</span>" : "") + "</small></span>" +
      '<span style="margin-inline-start:auto;display:flex;gap:6px">' +
      (canManage && mode !== "owner"
        ? '<button class="btn btn-ghost btn-sm" data-act="tick" data-id="' + esc(u.id) + '" data-v="' + (u.verified ? "0" : "1") + '">' +
        (u.verified ? "برداشتن تیک آبی" : "دادن تیک آبی") + "</button>" : "") +
      '<button class="btn btn-ghost btn-sm" data-act="edit" data-id="' + esc(u.id) + '">ویرایش</button>' +
      "</span></div>";
  }

  function loadOwners() {
    return api("GET", "/api/admin/owners").then(function (r) {
      var k = $("#admSchoolOwnerKpi");
      if (k) {
        k.innerHTML = '<div class="adm-kpis">' +
          kpi("مالکان سایت", fa(r.counts.owners), "بالاترین سطح دسترسی", "♛") +
          kpi("کاربران تأییدشده", fa(r.counts.verified), "دارای تیک آبی", "✔") +
          kpi("مدیران", fa(r.counts.admins), "دسترسی کامل به پنل", "⚙") +
          kpi("دبیران", fa(r.counts.teachers), "کلاس مجازی و گروه کلاسی", "🎓") +
          "</div>";
      }
      var ob = $("#admSchoolOwners");
      if (ob) {
        ob.innerHTML = '<h5 style="margin:0 0 6px;font-size:.85rem">♛ مالکان سایت</h5>' +
          (r.owners.length ? r.owners.map(function (u) { return ownRow(u, r.canManage, "owner"); }).join("")
            : '<div class="adm-log">مالکی ثبت نشده است.</div>');
      }
      var vb = $("#admSchoolVerified");
      if (vb) {
        vb.innerHTML = '<h5 style="margin:0 0 6px;font-size:.85rem">✔ کاربران تأییدشده (تیک آبی)</h5>' +
          (r.verified.length ? r.verified.map(function (u) { return ownRow(u, r.canManage, "verified"); }).join("")
            : '<div class="adm-log">تا حالا به کسی تیک آبی داده نشده است.</div>');
      }
      return r;
    }).catch(function (e) { toast(e.message); });
  }

  function kpi(label, val, hint, ico) {
    return '<div class="adm-kpi"><div class="lbl"><span>' + ico + "</span>" + esc(label) + '</div>' +
      '<div class="val">' + val + '</div><div class="hint">' + hint + "</div></div>";
  }

  /** نمودار خطی سبک با SVG — بدون هیچ کتابخانه‌ای. */
  function chart(days, data, max) {
    var W_ = 720, H = 200, pl = 34, pr = 10, pt = 14, pb = 26;
    var iw = W_ - pl - pr, ih = H - pt - pb;
    var series = [
      { key: "logins", color: "var(--brand)", name: "ورود" },
      { key: "signs", color: "#22c55e", name: "ثبت‌نام" },
      { key: "quizzes", color: "#f59e0b", name: "آزمون" },
      { key: "ai", color: "#a855f7", name: "هوش مصنوعی" }
    ];
    var x = function (i) { return pl + (days.length > 1 ? i * iw / (days.length - 1) : iw / 2); };
    var y = function (v) { return pt + ih - (v / max) * ih; };

    var grid = "";
    for (var g = 0; g <= 4; g++) {
      var gy = pt + ih * g / 4;
      grid += '<line x1="' + pl + '" y1="' + gy + '" x2="' + (W_ - pr) + '" y2="' + gy + '" stroke="var(--border)" stroke-width="1" />' +
        '<text x="' + (pl - 6) + '" y="' + (gy + 4) + '" font-size="9" fill="var(--muted)" text-anchor="end">' + fa(Math.round(max * (4 - g) / 4)) + "</text>";
    }
    var labels = days.map(function (d, i) {
      if (i % 2) return "";
      return '<text x="' + x(i) + '" y="' + (H - 8) + '" font-size="9" fill="var(--muted)" text-anchor="middle">' + esc(d) + "</text>";
    }).join("");

    var paths = series.map(function (s) {
      var d = days.map(function (k, i) { return (i ? "L" : "M") + x(i).toFixed(1) + " " + y(data[k][s.key] || 0).toFixed(1); }).join(" ");
      var area = d + " L" + x(days.length - 1) + " " + (pt + ih) + " L" + pl + " " + (pt + ih) + " Z";
      return '<path d="' + area + '" fill="' + s.color + '" opacity=".08" />' +
        '<path d="' + d + '" fill="none" stroke="' + s.color + '" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" />' +
        days.map(function (k, i) {
          return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(data[k][s.key] || 0).toFixed(1) + '" r="2.4" fill="' + s.color + '"><title>' + esc(days[i] + " — " + s.name + ": " + fa(data[k][s.key] || 0)) + "</title></circle>";
        }).join("");
    }).join("");

    return '<svg class="adm-chart" viewBox="0 0 ' + W_ + " " + H + '" preserveAspectRatio="none">' + grid + paths + labels + "</svg>" +
      '<div class="adm-legend">' + series.map(function (s) { return "<span><i style=\"background:" + s.color + "\"></i>" + s.name + "</span>"; }).join("") + "</div>";
  }

  /* --------------------------------------------------- کاربران */
  function loadUsers(page) {
    if (page) STATE.page = page;
    var qs = "?q=" + encodeURIComponent(STATE.q) + "&role=" + STATE.role + "&grade=" + STATE.grade +
      "&sort=" + STATE.sort + "&page=" + STATE.page + "&per=25";
    return api("GET", "/api/admin/users" + qs).then(function (r) {
      STATE.users = r.users; STATE.pages = r.pages; STATE.page = r.page;
      $("#admUsersCount").textContent = num(r.total) + " کاربر";
      paintUsers(r);
    }).catch(function (e) { toast(e.message); });
  }

  function paintUsers(r) {
    var isOwnerMe = !!(STATE.user && (STATE.user.isOwner || STATE.user.role === "owner"));
    var canEdit = !!(STATE.user && (STATE.user.role === "admin" || isOwnerMe));
    $("#admUsers").innerHTML = r.users.length ? r.users.map(function (u) {
      return "<tr>" +
        '<td><div class="who"><span class="av" style="background:linear-gradient(140deg,' + (u.color || "#6d5efc") + ",color-mix(in srgb," + (u.color || "#6d5efc") + ' 55%,#000))">' + esc((u.name || "؟").charAt(0)) + "</span>" +
        '<span><span class="nm"><b>' + esc(u.name) + "</b>" +
          (u.verified ? '<span class="hk-tick" title="حساب تأییدشده"></span>' : "") +
          (u.isOwner ? '<span class="hk-ownertag">مالک</span>' : "") +
        "</span><small>" + esc(u.email) + "</small></span></div></td>" +
        '<td><span class="adm-pill ' + u.role + '">' + esc(u.roleFa) + "</span>" + (u.banned ? ' <span class="adm-pill banned">مسدود</span>' : "") + "</td>" +
        "<td>" + ({ "7": "هفتم", "8": "هشتم", "9": "نهم" }[u.grade] || "—") + "</td>" +
        "<td>" + esc(u.school || "—") + (u.city ? '<br><small style="color:var(--muted)">' + esc(u.city) + "</small>" : "") + "</td>" +
        "<td>" + fa(u.lessonsRead) + "</td><td>" + fa(u.exams) + "</td><td>" + fa(u.studyMinutes) + "</td>" +
        "<td>" + (u.lastLogin ? jdate(u.lastLogin) : "—") + "</td>" +
        '<td><div class="adm-row-actions">' +
          (canEdit ? '<button data-act="edit" data-id="' + u.id + '">ویرایش</button>' : "") +
          (isOwnerMe ? '<button data-act="tick" data-id="' + u.id + '">' + (u.verified ? "برداشتن تیک" : "تیک آبی") + "</button>" : "") +
          (canEdit ? '<button data-act="pass" data-id="' + u.id + '">رمز</button>' : "") +
          (canEdit ? '<button class="danger" data-act="del" data-id="' + u.id + '">حذف</button>' : "") +
        "</div></td></tr>";
    }).join("") : '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:28px">کاربری پیدا نشد.</td></tr>';

    var pager = "";
    var from = Math.max(1, r.page - 2), to = Math.min(r.pages, r.page + 2);
    if (r.pages > 1) {
      pager += '<button data-pg="1"' + (r.page === 1 ? ' class="on"' : "") + ">۱</button>";
      for (var i = from; i <= to; i++) {
        if (i === 1 || i === r.pages) continue;
        pager += '<button data-pg="' + i + '"' + (i === r.page ? ' class="on"' : "") + ">" + fa(i) + "</button>";
      }
      if (r.pages > 1) pager += '<button data-pg="' + r.pages + '"' + (r.page === r.pages ? ' class="on"' : "") + ">" + fa(r.pages) + "</button>";
    }
    $("#admPager").innerHTML = pager;
  }

  function openUser(id) {
    var u = STATE.users.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    $("#umTitle").textContent = "ویرایش " + u.name;
    $("#umId").value = u.id;
    $("#umName").value = u.name || "";
    $("#umEmail").value = u.email || "";
    $("#umGrade").value = u.grade || "8";
    $("#umSchool").value = u.school || "";
    $("#umCity").value = u.city || "";
    $("#umRole").value = u.role || "student";
    $("#umBan").checked = !!u.banned;
    if ($("#umTick")) {
      $("#umTick").checked = !!u.verified;
      var ownerMe = !!(STATE.user && (STATE.user.isOwner || STATE.user.role === "owner"));
      $("#umTickWrap").hidden = !ownerMe;
      $("#umOwnerWrap").hidden = !ownerMe;
    }
    $("#umInfo").innerHTML = "<span class=\"chip\">درس خوانده: " + fa(u.lessonsRead) + "</span><span class=\"chip\">آزمون: " + fa(u.exams) +
      "</span><span class=\"chip\">یادداشت: " + fa(u.notes) + "</span><span class=\"chip\">مطالعه: " + fa(u.studyMinutes) +
      " دقیقه</span><span class=\"chip\">عضویت: " + jdate(u.createdAt) + "</span>";
    $("#admModal").classList.add("open");
  }

  /* -------------------------------------------------- اعلان */
  function paintAnnounce(a) {
    a = a || { active: false, level: "info", text: "" };
    $("#anText").value = a.text || "";
    $("#anLevel").value = a.level || "info";
    $("#anActive").checked = !!a.active;
    preview();
  }
  function preview() {
    var t = $("#anText").value.trim() || "متن اعلان اینجا نمایش داده می‌شود…";
    var lv = $("#anLevel").value;
    $("#anPreview").className = "hk-announce lv-" + lv;
    $("#anPreview").innerHTML = "<span>" + esc(t) + "</span>";
    $("#anPreview").style.opacity = $("#anActive").checked ? "1" : ".5";
  }

  /* ------------------------------------------------- تنظیمات */
  function paintSettings(s) {
    if (!s) return;
    STATE.settings = s;
    setSwitch("registrationOpen", s.registrationOpen);
    setSwitch("maintenance", s.maintenance);
    setSwitch("aiEnabled", s.aiEnabled);
    $("#stNote").value = s.maintenanceNote || "";
    $$("[data-grade-chk]").forEach(function (c) {
      c.checked = (s.allowedGrades || []).indexOf(c.getAttribute("data-grade-chk")) > -1;
    });
    paintAnnounce(s.announcement);
  }
  function setSwitch(k, v) {
    var el = $("[data-switch=" + k + "]");
    if (el) el.classList.toggle("on", !!v);
  }
  function loadSettings() { return loadStats().then(function () { paintSettings(STATE.settings); }); }

  function saveSettings() {
    var grades = $$("[data-grade-chk]").filter(function (c) { return c.checked; }).map(function (c) { return c.getAttribute("data-grade-chk"); });
    return api("POST", "/api/admin/settings", {
      registrationOpen: $("[data-switch=registrationOpen]").classList.contains("on"),
      maintenance: $("[data-switch=maintenance]").classList.contains("on"),
      aiEnabled: $("[data-switch=aiEnabled]").classList.contains("on"),
      maintenanceNote: $("#stNote").value,
      allowedGrades: grades
    }).then(function (r) { toast("تنظیمات ذخیره شد"); paintSettings(r.settings); return r; })
      .catch(function (e) { toast(e.message); });
  }

  /* ---------------------------------------------- رویدادها و گزارش */
  function loadEvents() {
    var t = $("#evFilter") ? $("#evFilter").value : "";
    return api("GET", "/api/admin/events?type=" + encodeURIComponent(t)).then(function (r) {
      STATE.events = r.events;
      $("#admEvents").innerHTML = r.events.length ? r.events.map(function (e) {
        var u = e.meta && e.meta.email ? e.meta.email : "";
        return '<div class="adm-ev ' + esc(e.type) + '"><span class="k">' + esc(e.type) + "</span>" +
          '<span class="t">' + esc(e.meta ? JSON.stringify(e.meta).slice(0, 160) : "—") +
          (u ? "<small>" + esc(u) + "</small>" : "") + "</span>" +
          '<span class="tm">' + jdate(e.t) + "</span></div>";
      }).join("") : '<p style="color:var(--muted)">رویدادی ثبت نشده است.</p>';
    }).catch(function (e) { toast(e.message); });
  }

  function loadAudit() {
    return api("GET", "/api/admin/audit").then(function (r) {
      STATE.audit = r.audit;
      $("#admAudit").innerHTML = r.audit.length ? r.audit.map(function (a) {
        return '<div class="adm-ev"><span class="k">' + esc(a.action) + '</span><span class="t">' +
          esc(a.target || "—") + "<small>" + esc(a.meta ? JSON.stringify(a.meta).slice(0, 140) : "") + "</small></span>" +
          '<span class="tm">' + jdate(a.t) + "</span></div>";
      }).join("") : '<p style="color:var(--muted)">گزارشی ثبت نشده است.</p>';
    }).catch(function (e) { toast(e.message); });
  }

  /* --------------------------------------------------- راه‌اندازی */
  function boot() {
    $("#admSide").addEventListener("click", function (e) {
      var b = e.target.closest("[data-nav]");
      if (b) show(b.getAttribute("data-nav"));
    });
    $("#admMenu").addEventListener("click", function () { $("#admSide").classList.toggle("open"); });

    // جدول کاربران
    $("#admTable").addEventListener("click", function (e) {
      var th = e.target.closest("th[data-sort]");
      if (th) { STATE.sort = th.getAttribute("data-sort"); STATE.page = 1; loadUsers(); return; }
      var pg = e.target.closest("[data-pg]");
      if (pg) { loadUsers(+pg.getAttribute("data-pg")); return; }
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
      if (act === "edit") openUser(id);
      if (act === "tick") {
        var row = STATE.users.filter(function (x) { return x.id === id; })[0];
        if (!row) return;
        api("POST", "/api/admin/verify", { id: id, verified: !row.verified })
          .then(function (res) {
            toast(res.user.verified ? "تیک آبی داده شد" : "تیک آبی برداشته شد");
            loadUsers();
          }).catch(function (e) { toast(e.message); });
      }
      if (act === "pass") {
        if (!confirm("برای این کاربر رمز موقت ساخته شود؟")) return;
        api("POST", "/api/admin/user/password", { id: id }).then(function (r) {
          prompt("رمز موقت ساخته شد. آن را به کاربر بدهید:", r.password);
        }).catch(function (e) { toast(e.message); });
      }
      if (act === "del") {
        if (!confirm("این کاربر و همهٔ داده‌های درسی‌اش حذف شود؟")) return;
        api("POST", "/api/admin/user/delete", { id: id }).then(function () { toast("کاربر حذف شد"); loadUsers(); loadStats(); })
          .catch(function (e) { toast(e.message); });
      }
    });

    // فیلترها
    var tmr = 0;
    $("#admSearch").addEventListener("input", function () {
      clearTimeout(tmr);
      var v = this.value;
      tmr = setTimeout(function () { STATE.q = v; STATE.page = 1; loadUsers(); }, 320);
    });
    $("#admRole").addEventListener("change", function () { STATE.role = this.value; STATE.page = 1; loadUsers(); });
    $("#admGrade").addEventListener("change", function () { STATE.grade = this.value; STATE.page = 1; loadUsers(); });
    if ($("#evFilter")) $("#evFilter").addEventListener("change", loadEvents);

    // پنجرهٔ ویرایش
    $("#admModal").addEventListener("click", function (e) {
      if (e.target === $("#admModal")) $("#admModal").classList.remove("open");
      if (e.target.closest("[data-modal-close]")) $("#admModal").classList.remove("open");
    });
    $("#umSave").addEventListener("click", function () {
      var payload = {
        id: $("#umId").value,
        name: $("#umName").value.trim(),
        grade: $("#umGrade").value,
        school: $("#umSchool").value.trim(),
        city: $("#umCity").value.trim(),
        role: $("#umRole").value,
        banned: $("#umBan").checked
      };
      // تیک آبی فقط وقتی نمایش داده می‌شود که خودت مالک باشی
      if ($("#umTick") && !$("#umTickWrap").hidden) payload.verified = $("#umTick").checked;
      api("POST", "/api/admin/user", payload).then(function () {
        toast("ذخیره شد"); $("#admModal").classList.remove("open"); loadUsers(); loadStats();
      }).catch(function (e) { toast(e.message); });
    });

    // تعیین این کاربر به‌عنوان مالک سایت (فقط مالک فعلی)
    var mk = $("#umMakeOwner");
    if (mk) mk.addEventListener("click", function () {
      var email = $("#umEmail").value.trim();
      if (!email) return;
      if (!confirm("«" + email + "» مالک سایت شود؟ مالک فعلی به نقش مدیر برمی‌گردد.")) return;
      var cur = STATE.user ? STATE.user.email : "";
      api("POST", "/api/admin/owner", { email: email, remove_previous_email: cur })
        .then(function () { toast("مالک سایت تعیین شد"); $("#admModal").classList.remove("open"); loadUsers(); loadStats(); })
        .catch(function (e) { toast(e.message); });
    });

    var ownerOnly = !!(STATE.user && (STATE.user.isOwner || STATE.user.role === "owner"));
    if (!ownerOnly && $("#umMakeOwner")) $("#umMakeOwner").hidden = true;

    // اعلان
    ["#anText", "#anLevel", "#anActive"].forEach(function (s) {
      var el = $(s); if (el) el.addEventListener("input", preview);
      if (el) el.addEventListener("change", preview);
    });
    $("#anSave").addEventListener("click", function () {
      api("POST", "/api/admin/announce", {
        active: $("#anActive").checked, level: $("#anLevel").value, text: $("#anText").value.trim()
      }).then(function (r) { toast(r.announcement.active ? "اعلان فعال شد" : "اعلان خاموش شد"); paintAnnounce(r.announcement); })
        .catch(function (e) { toast(e.message); });
    });
    $("#anOff").addEventListener("click", function () {
      $("#anActive").checked = false; preview();
      api("POST", "/api/admin/announce", { active: false, level: $("#anLevel").value, text: $("#anText").value.trim() })
        .then(function () { toast("اعلان خاموش شد"); }).catch(function (e) { toast(e.message); });
    });

    // سوئیچ‌ها و تنظیمات
    $$("[data-switch]").forEach(function (el) {
      el.addEventListener("click", function () {
        el.classList.toggle("on");
        saveSettings();
      });
    });
    $("#stSave").addEventListener("click", saveSettings);

    // ابزارها
    // خروجی‌ها به‌صورت فایل واقعی از خود مرورگر ساخته می‌شوند (بدون خطای ۴۰۴)
    function dl(what) {
      if (W.HKServer && W.HKServer.downloadExport) { W.HKServer.downloadExport(what); toast("فایل آماده شد"); return; }
      api("GET", "/api/admin/export?what=" + what).then(function (r) { toast(r.name || "آماده شد"); });
    }
    $("#toolExportUsers").addEventListener("click", function () { dl("users"); });
    $("#toolExportEvents").addEventListener("click", function () { dl("events"); });
    $("#toolExportProgress").addEventListener("click", function () { dl("progress"); });

  /* رفع باگ: دکمه‌های «کاربران (CSV)» و «رویدادها (CSV)» در تب ابزارها
     شناسهٔ تکراری با تب کاربران/رویدادها داشتند و کلیکشان هیچ کاری نمی‌کرد. */
  [["toolExportUsers2", "toolExportUsers"], ["toolExportEvents2", "toolExportEvents"]].forEach(function (pair) {
    var dup = document.getElementById(pair[0]), main = document.getElementById(pair[1]);
    if (dup && main) dup.addEventListener("click", function (e) { e.preventDefault(); main.click(); });
  });
    $("#toolPrune").addEventListener("click", function () {
      var days = parseInt($("#pruneDays").value || "90", 10);
      if (!confirm("رویدادهای قدیمی‌تر از " + days + " روز پاک شود؟")) return;
      api("POST", "/api/admin/prune", { days: days }).then(function (r) { toast("پاک‌سازی انجام شد — " + fa(r.left) + " رویداد ماند"); loadStats(); })
        .catch(function (e) { toast(e.message); });
    });
    $("#toolReload").addEventListener("click", function () { loadStats(); loadUsers(); toast("تازه‌سازی شد"); });

    // ورود سریع با کلید
    D.addEventListener("keydown", function (e) {
      if (e.key === "g" && e.altKey) { e.preventDefault(); show("overview"); }
      if (e.key === "u" && e.altKey) { e.preventDefault(); show("users"); }
      if (e.key === "n" && e.altKey) { e.preventDefault(); show("announce"); }
      if (e.key === "s" && e.altKey) { e.preventDefault(); show("settings"); }
      if (e.key === "Escape") $("#admModal").classList.remove("open");
    });

    guard().then(function (ok) {
      if (!ok) return;
      var h = (location.hash || "").replace("#", "");
      show(["overview", "users", "announce", "settings", "events", "audit", "tools", "school", "quick", "flags", "content", "exams", "broadcast", "bulk", "reports", "security", "data"].indexOf(h) > -1 ? h : "overview");
      loadStats();
      setInterval(function () {
        var pane = $$("[data-pane]").filter(function (p) { return !p.hidden; })[0];
        if (pane && pane.getAttribute("data-pane") === "overview") loadStats();
      }, 30000);
    });
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot); else boot();
})();
