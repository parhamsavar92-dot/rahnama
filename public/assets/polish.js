/* رهنما — polish.js: منوی «بیشتر» در سربرگ + باز/بسته شدن تایمر شناور (فقط ظاهر) */
(function () {
  "use strict";
  var KEEP = ["index", "ai", "exam", "class", "panel", "jozve"];
  function base(a) {
    var p = (a.getAttribute("href") || "").split("#")[0].split("?")[0];
    p = p.replace(/\/$/, "/index").split("/").pop().replace(/\.html$/, "");
    return p || "index";
  }
  function tidyNav() {
    var nav = document.querySelector(".header-nav");
    if (!nav || nav.querySelector(".nav-more")) return;
    var extra = Array.prototype.filter.call(nav.children, function (c) {
      if (c.tagName !== "A" || c.classList.contains("hk-account")) return false;
      var h = c.getAttribute("href") || "";
      if (!h || h.charAt(0) === "#") return false;
      return KEEP.indexOf(base(c)) === -1;
    });
    if (extra.length < 2) return;
    var d = document.createElement("details"); d.className = "nav-more";
    var s = document.createElement("summary"); s.textContent = "بیشتر";
    var m = document.createElement("div"); m.className = "nav-more-menu";
    d.appendChild(s); d.appendChild(m);
    nav.insertBefore(d, extra[0]);
    extra.forEach(function (a) { m.appendChild(a); });
    if (m.querySelector(".is-current,.is-active,.active,[aria-current=page]")) s.style.color = "var(--brand,#6d5efc)";
    var mq = window.matchMedia ? window.matchMedia("(max-width: 900px)") : { matches: false };
    function sync() { if (mq.matches) d.setAttribute("open", ""); else d.removeAttribute("open"); }
    sync();
    if (mq.addEventListener) mq.addEventListener("change", sync); else if (mq.addListener) mq.addListener(sync);
    document.addEventListener("click", function (e) { if (!mq.matches && !d.contains(e.target)) d.removeAttribute("open"); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !mq.matches) d.removeAttribute("open"); });
  }
  function timer() {
    document.addEventListener("click", function (e) {
      var t = document.querySelector(".hk-timer");
      if (!t) return;
      if (e.target.closest(".hk-timer .ring")) t.classList.toggle("open");
      else if (!e.target.closest(".hk-timer")) t.classList.remove("open");
    });
  }
  function init() { tidyNav(); timer(); setTimeout(tidyNav, 900); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
