/* ==========================================================================
   رهنما — موتور جست‌وجو و دسته‌بندی مرکز ابزارها  |  r9-hub.js
   ========================================================================== */
(function () {
  "use strict";
  var D = document;
  function $(s, r) { return (r || D).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || D).querySelectorAll(s)); }

  function boot() {
    var grid = $("#rtGrid");
    if (!grid) return;
    var tools = $$(".rt-tool", grid);
    var search = $("#rtSearch");
    var cats = $("#rtCats");
    var count = $("#rtCount");
    var empty = $("#rtEmpty");
    var cat = "all";
    var keys = tools.map(function (t) { return (t.getAttribute("data-key") || "") + " " + (t.querySelector("h4") ? t.querySelector("h4").textContent : ""); });

    function apply() {
      var q = (search && search.value || "").trim().toLowerCase();
      var shown = 0;
      tools.forEach(function (t, i) {
        var okCat = cat === "all" || t.getAttribute("data-cat") === cat;
        var okQ = !q || keys[i].toLowerCase().indexOf(q) > -1;
        var show = okCat && okQ;
        t.hidden = !show;
        if (show) shown++;
      });
      if (count) count.textContent = String(shown).replace(/\d/g, function (d) { return "۰۱۲۳۴۵۶۷۸۹"[+d]; });
      if (empty) empty.hidden = shown > 0;
    }
    if (search) {
      var t = null;
      search.addEventListener("input", function () { if (t) clearTimeout(t); t = setTimeout(apply, 120); });
      search.addEventListener("keydown", function (e) { if (e.key === "Escape") { search.value = ""; apply(); } });
    }
    if (cats) {
      cats.addEventListener("click", function (e) {
        var b = e.target.closest(".rt-chip"); if (!b) return;
        $$(".rt-chip", cats).forEach(function (x) { x.classList.remove("on"); });
        b.classList.add("on");
        cat = b.getAttribute("data-cat");
        apply();
      });
    }
    // کلید «/» برای پریدن به جست‌وجو
    D.addEventListener("keydown", function (e) {
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test((e.target.tagName || ""))) {
        if (search) { e.preventDefault(); search.focus(); }
      }
    });
    apply();
  }
  if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
