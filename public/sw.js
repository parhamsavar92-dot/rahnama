/* ==========================================================================
   پایهٔ هشتم — Service Worker  |  sw.js
   مطالعهٔ آفلاین کامل: پیش‌بارگذاری همهٔ صفحه‌ها، تصاویر و دادهٔ مطالعه
   ========================================================================== */
const VERSION = "g8-v26";
const CORE = VERSION + "-core";
const PAGES = VERSION + "-pages";
const RUNTIME = VERSION + "-runtime";

const CORE_ASSETS = [
  "index.html",
  "ai.html",
  "about.html",
  "offline.html",
  "dashboard.html",
  "exam.html",
  "flashcards.html",
  "panel.html",
  "class.html",
  "profile.html",
  "jozve.html",
  "consult.html",
  "report.html",
  "privacy.html",
  "manifest.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "assets/fonts.css",
  "assets/style.css",
  "assets/polish.css",
  "assets/cute.css",
  "assets/polish.js",
  "assets/enhance.css",
  "assets/annotate.css",
  "assets/print.css",
  "assets/ultra.css",
  "assets/ai.css",
  "assets/ai2.css",
  "assets/hk.css",
  "assets/hk3d.css",
  "assets/hk-school.css",
  "assets/hk-editor.css",
  "assets/admin.css",
  "assets/hk-server.js",
  "assets/app.js",
  "assets/enhance.js",
  "assets/annotate.js",
  "assets/study.js",
  "assets/grade.js",
  "assets/ultra.js",
  "assets/ai.js",
  "assets/ai2.js",
  "assets/hk-agent.js",
  "assets/hk-panel.js",
  "assets/hk-jozve.js",
  "assets/hk3d.js",
  "assets/hk-auth.js",
  "assets/hk-class.js",
  "assets/hk-class-live.js",
  "assets/hk-student-panel.js",
  "assets/hk-editor.js",
  "assets/admin-extra.js",
  "assets/admin.js",
  "assets/mcq.js",
  "assets/study-data.json",
  "assets/study-data-g7.json",
  "assets/study-data-g9.json",
  "assets/kb.json",
  "assets/kb-g7.json",
  "assets/kb-g9.json",
  "assets/jozve-index.json",
  "assets/search-index.json",
  "assets/grades.json",
  "assets/r6.css",
  "assets/r6.js",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/maskable-512.png",
  "assets/icons/favicon.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CORE).then((c) => Promise.allSettled(CORE_ASSETS.map((u) => c.add(new Request(new URL(u, self.registration.scope).href, { cache: "reload" })))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isHTML(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin) return; // فونت و منابع بیرونی: بدون دخالت

  // پاسخ‌های API هرگز نباید از حافظهٔ نهان بیایند:
  // پیش‌تر وضعیت ورود، اعلان سراسری و پیام‌های به‌صورت کهنه دیده می‌شدند.
  if (u.pathname.indexOf("/api/") === 0 || u.pathname === "/__status" || u.pathname === "/healthz") return;

  if (isHTML(req)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGES).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((r) => r || caches.match(new URL("offline.html", self.registration.scope).href))
        )
    );
    return;
  }

  /* CSS و JS: اول شبکه، بعد حافظهٔ نهان.
     پیش‌تر «اول حافظه» بود و کاربر نسخهٔ کهنهٔ طرح را می‌دید (پس از هر
     تغییر ظاهر، باید نسخهٔ تازه را می‌دید ولی نمی‌دید). آفلاین هم چون
     fallback حافظه دارد، همان‌طور کار می‌کند. */
  if (/\.(css|js|webmanifest)$/.test(u.pathname)) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((r) => r || caches.match(u.pathname)))
    );
    return;
  }

  // دارایی‌های ایستا: ابتدا حافظه، سپس شبکه (با به‌روزرسانی در پس‌زمینه)
  e.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(RUNTIME).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit);
      return hit || net;
    })
  );
});

self.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "PRECACHE_ALL" && Array.isArray(d.urls)) {
    e.waitUntil(
      caches.open(PAGES)
        .then((c) => Promise.allSettled(d.urls.map((u) => c.add(new Request(u, { cache: "reload" })))))
        .then(() => {
          if (e.source) e.source.postMessage({ type: "PRECACHE_DONE", count: d.urls.length });
        })
    );
  }
  if (d.type === "SKIP_WAITING") self.skipWaiting();
});
