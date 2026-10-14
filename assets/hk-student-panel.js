/* ==========================================================================
   رهنما — پنل دانش‌آموزی پیشرفته  |  assets/hk-student-panel.js
   همه‌چیز از دادهٔ همان دستگاه (کلیدهای g8:) خوانده می‌شود، پس در اپ آفلاین
   هم کامل کار می‌کند؛ اگر سرور در دسترس باشد، آمار حساب هم اضافه می‌شود.
   بخش‌ها: کارت هویت (با تیک آبی و نشان مالک)، حلقهٔ پیشرفت، پیشرفت هر درس،
   آمار مطالعه، نشان‌ها، فعالیت اخیر، دسترسی سریع و خروج.
   ========================================================================== */
(function () {
  "use strict";
  var W = window, D = document;
  var U = function (p) { return (W.G8 && W.G8.url) ? W.G8.url(p) : String(p == null ? "" : p); };
  function q(s, r) { return (r || D).querySelector(s); }
  function fa(n) { return String(n).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; }); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  function get(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function lsKeys(prefix) {
    var out = [], i, k;
    try {
      for (i = 0; i < localStorage.length; i++) {
        k = localStorage.key(i);
        if (k && k.indexOf(prefix) === 0) out.push(k);
      }
    } catch (e) {}
    return out;
  }

  /* ------------------------------------------------ خواندن دادهٔ مطالعه */
  function scan() {
    var read = lsKeys("g8:read:"), study = lsKeys("g8:study:"), notes = lsKeys("g8:note"),
      edits = lsKeys("g8:edit:"), docEdits = lsKeys("g8:editdoc:"), fc = get("g8:fcKnown", {}) || {},
      exams = get("g8:exams", []) || [], tasks = get("g8:tasks", []) || [];
    var bySubject = {}, last = null;
    function subjectOf(path) {
      var m = String(path).match(/(?:^|\/)(?:jozve\/(\d)\/|g(\d)\/pages\/|pages\/)([a-z-]+)\.html/i);
      if (m) return (m[3] || "").replace(/-/g, " ");
      return "عمومی";
    }
    read.forEach(function (k) {
      var p = k.replace("g8:read:", ""), s = subjectOf(p);
      bySubject[s] = (bySubject[s] || 0) + 1;
    });
    study.forEach(function (k) {
      var d = get(k, null);
      if (d && d.at && (!last || d.at > last.at)) last = { at: d.at, path: k.replace("g8:study:", "") };
    });
    return {
      readCount: read.length, studyCount: study.length, noteCount: notes.length,
      markCount: edits.length, docCount: docEdits.length,
      fcKnown: Object.keys(fc).length, examCount: (exams.length || 0), taskCount: (tasks.length || 0),
      bySubject: bySubject, last: last,
    };
  }

  function badgeList(a, me) {
    var b = [];
    if (a.readCount >= 1) b.push(["🌱", "شروع‌کننده", "اولین درس را باز کردی"]);
    if (a.readCount >= 10) b.push(["📚", "پویا", "۱۰ درس خوانده‌شده"]);
    if (a.readCount >= 30) b.push(["🔥", "کوشا", "۳۰ درس خوانده‌شده"]);
    if (a.studyCount >= 5) b.push(["📈", "پیگیر", "در ۵ درس پیشرفت ثبت شده"]);
    if (a.noteCount >= 5) b.push(["🗒", "یادداشت‌نویس", "۵ یادداشت نوشته‌ای"]);
    if (a.markCount >= 1) b.push(["✏️", "نشانه‌گذار", "روی جزوه نشانه گذاشته‌ای"]);
    if (a.docCount >= 1) b.push(["📝", "ویرایشگر", "متن یک درس را ویرایش کرده‌ای"]);
    if (a.examCount >= 1) b.push(["🎯", "آزمون‌ده", "در آزمون شرکت کرده‌ای"]);
    if (a.fcKnown >= 20) b.push(["🃏", "فلش‌کارت‌باز", "۲۰ فلش‌کارت یاد گرفته‌ای"]);
    if (me && (me.role === "owner" || me.role === "admin")) b.push(["♛", "مدیر سایت", "دسترسی مدیریتی داری"]);
    if (me && me.verified) b.push(["✔", "تیک آبی", "حساب تأییدشده"]);
    return b;
  }

  function relative(ts) {
    var s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "همین حالا";
    if (s < 3600) return fa(Math.floor(s / 60)) + " دقیقه پیش";
    if (s < 86400) return fa(Math.floor(s / 3600)) + " ساعت پیش";
    return fa(Math.floor(s / 86400)) + " روز پیش";
  }

  /* ------------------------------------------------ رسم پنل */
  function paint(me, api) {
    var host = q("#stPanel");
    if (!host) return;
    var a = scan();
    var grade = (me && me.grade) || get("g8:grade", "") || "";
    var ringTotal = Math.max(a.readCount + Math.max(0, 34 - a.readCount), 34);
    var pct = Math.min(100, Math.round((a.readCount / ringTotal) * 100));
    var badges = badgeList(a, me);
    var subjects = Object.keys(a.bySubject).sort(function (x, y) { return a.bySubject[y] - a.bySubject[x]; }).slice(0, 8);
    var maxSub = subjects.length ? a.bySubject[subjects[0]] : 1;

    var html = "";

    /* هویت */
    html += '<section class="card st-id">' +
      '<div class="st-ava" aria-hidden="true">' + esc((me && me.name ? me.name : "؟").trim().charAt(0)) + "</div>" +
      "<div><h3 style=\"margin:0\">" + esc(me ? me.name : "مهمان") +
      (me && me.verified ? ' <span class="st-tick" title="حساب تأییدشده">✔</span>' : "") +
      (me && me.role === "owner" ? ' <span class="st-owner">♛ مالک سایت</span>' : "") + "</h3>" +
      '<p style="margin:4px 0 0;font-size:.85rem;color:var(--muted)">' +
      esc(me ? (me.email || "") : "وارد نشده‌ای") + (grade ? " · پایهٔ " + esc(grade) : "") +
      (me && me.local ? ' · <span class="st-chip">حساب این دستگاه</span>' : (me ? ' · <span class="st-chip">حساب آنلاین</span>' : "")) +
      "</p></div>" +
      '<div class="st-actions">' +
      (me ? '<a class="btn btn-ghost btn-sm" href="profile.html">ویرایش پروفایل</a>' +
        '<button class="btn btn-ghost btn-sm" data-st="logout">خروج</button>'
        : '<a class="btn btn-primary btn-sm" href="profile.html">ورود / ثبت‌نام</a>') +
      "</div></section>";

    /* حلقهٔ پیشرفت + آمار */
    html += '<div class="grid-3 st-kpis">' +
      '<section class="card st-ring-card"><div class="st-ring" style="--p:' + pct + '">' +
      '<b>' + fa(pct) + "٪</b></div><p>پیشرفت کلی مطالعه<br><small>" +
      fa(a.readCount) + " درس خوانده‌شده</small></p></section>" +
      kpi("📈", "سرفصل‌های مطالعه‌شده", a.studyCount || a.readCount, "ردیابی خودکار با اسکرول") +
      kpi("🗒", "یادداشت‌ها", a.noteCount, "یادداشت‌های شخصی تو") +
      kpi("✏️", "نشانه‌گذاری‌ها", a.markCount, "ماژیک، متن و قلم روی جزوه") +
      kpi("📝", "ویرایش متن درس", a.docCount, "درس‌هایی که متنشان را ویرایش کردی") +
      kpi("🎯", "آزمون‌ها", a.examCount, "آزمون‌های شرکت‌کرده") +
      "</div>";

    /* پیشرفت به تفکیک درس */
    html += '<section class="card"><h4><span class="card-icon">◆</span> پیشرفت به تفکیک درس</h4>';
    if (!subjects.length) {
      html += '<p style="font-size:.86rem;color:var(--muted)">هنوز چیزی نخوانده‌ای. از <a href="jozve.html">جزوه‌ها</a> شروع کن.</p>';
    } else {
      html += '<div class="st-bars">';
      subjects.forEach(function (s) {
        var n = a.bySubject[s], w = Math.max(6, Math.round((n / maxSub) * 100));
        html += '<div class="st-bar"><span class="st-bar-t">' + esc(s) + '</span>' +
          '<span class="st-bar-m"><i style="width:' + w + '%"></i></span>' +
          '<span class="st-bar-n">' + fa(n) + "</span></div>";
      });
      html += "</div>";
    }
    html += "</section>";

    /* نشان‌ها */
    html += '<section class="card"><h4><span class="card-icon">★</span> نشان‌های تو</h4><div class="st-badges">';
    if (!badges.length) html += '<p style="font-size:.86rem;color:var(--muted)">با خواندن درس‌ها نشان می‌گیری.</p>';
    badges.forEach(function (b) {
      html += '<div class="st-badge" title="' + esc(b[2]) + '"><span>' + b[0] + "</span><b>" + esc(b[1]) + "</b><small>" + esc(b[2]) + "</small></div>";
    });
    html += "</div></section>";

    /* فعالیت اخیر + دسترسی سریع */
    html += '<div class="grid-2">' +
      '<section class="card"><h4><span class="card-icon">⏱</span> آخرین جایی که بودی</h4>' +
      (a.last
        ? '<p style="margin:0"><a href="' + esc(U(a.last.path)) + '">ادامهٔ مطالعه</a><br><small style="color:var(--muted)">' + esc(relative(a.last.at)) + "</small></p>"
        : '<p style="font-size:.86rem;color:var(--muted)">هنوز مطالعه‌ای ثبت نشده است.</p>') +
      "</section>" +
      '<section class="card"><h4><span class="card-icon">→</span> دسترسی سریع</h4>' +
      '<div class="st-actions" style="flex-wrap:wrap">' +
      '<a class="btn btn-ghost btn-sm" href="jozve.html">جزوه‌ها</a>' +
      '<a class="btn btn-ghost btn-sm" href="exam.html">آزمون</a>' +
      '<a class="btn btn-ghost btn-sm" href="flashcards.html">فلش‌کارت</a>' +
      '<a class="btn btn-ghost btn-sm" href="report.html">کارنامه</a>' +
      '<a class="btn btn-ghost btn-sm" href="class.html">کلاس مجازی</a>' +
      '<a class="btn btn-ghost btn-sm" href="consult.html">مشاوره</a>' +
      "</div></section></div>";

    host.innerHTML = html;
  }

  function kpi(ico, title, val, hint) {
    return '<section class="card st-kpi"><h4><span class="card-icon">' + ico + "</span> " + esc(title) + "</h4>" +
      '<b class="st-num">' + fa(val) + "</b><p>" + esc(hint) + "</p></section>";
  }

  /* ------------------------------------------------ راه‌اندازی */
  function boot() {
    var me = (W.HK && W.HK.auth && W.HK.auth.me) ? W.HK.auth.me() : null;
    paint(me, null);
    W.addEventListener("hk:auth", function (e) { paint(e.detail, null); });
    if (!me) setTimeout(function () { if (W.HK && W.HK.auth && W.HK.auth.me) paint(W.HK.auth.me(), null); }, 1200);

    D.addEventListener("click", function (e) {
      var b = e.target.closest('[data-st="logout"]');
      if (!b) return;
      e.preventDefault();
      if (W.HK && W.HK.auth && W.HK.auth.logout) W.HK.auth.logout();
    });
  }

  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
