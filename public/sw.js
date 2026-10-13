/* ==========================================================================
   پایهٔ هشتم — Service Worker  |  sw.js
   مطالعهٔ آفلاین کامل: پیش‌بارگذاری همهٔ صفحه‌ها، تصاویر و دادهٔ مطالعه
   ========================================================================== */
const VERSION = "g8-v42";
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
    "assets/r7.css",
  "assets/r8.css",
  "assets/r7.js",
  "assets/r8.js",
  "assets/r7-pdf.js",
  "study-tools.html",
  "pdf-tools.html",
  "assets/r9.css",
  "assets/r9.js",
  "assets/r9-tools.js",
  "assets/r9-hub.js",
  "assets/r9-owner.js",
    "community.html",
  "assets/r10.css",
  "assets/r10.js",
  "assets/r12-support.js",
  "assets/r11-voice.js",
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

/* ---------------------------------------------------------------------------
   ▼ رفع باگ ERR_FAILED
   پیش‌تر هنگام ناوبری، پاسخ شبکه بدون هیچ بررسی‌ای در حافظهٔ نهان نوشته
   می‌شد:  caches.open(PAGES).then((c) => c.put(req, copy));
   اگر پاسخْ ریدایرکت‌شده بود (مثل «/exam.html» که Cloudflare با ۳۰۷ به
   «/exam» می‌فرستاد) نوشتن در حافظهٔ نهان رد می‌شد، آن رد شدن مدیریت
   نمی‌شد و کل ناوبری با ERR_FAILED می‌ترکید.
   حالا: هر نوشتنْ محافظت‌شده است، پاسخ ریدایرکت‌شده هرگز ذخیره نمی‌شود،
   و زنجیرهٔ ناوبری در هیچ حالتی رد نمی‌شود.
--------------------------------------------------------------------------- */

/* اگر شبکه کند بود، بی‌پایان منتظر نمان؛ از حافظهٔ نهان بده (سرعت بیشتر). */
function withTimeout(p, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    p.then(
      (v) => { clearTimeout(t); resolve(v); },
      (err) => { clearTimeout(t); reject(err); }
    );
  });
}

/* ذخیره در حافظهٔ نهان فقط وقتی امن است. */
function saveIfOk(event, cacheName, req, res) {
  try {
    if (!res || res.status !== 200 || res.type !== "basic" || res.redirected) return;
    const copy = res.clone();
    event.waitUntil(
      caches.open(cacheName).then((c) => c.put(req, copy)).catch(function () { })
    );
  } catch (err) { /* هرگز نباید صفحه را خراب کند */ }
}

function fromCache(req) {
  return caches.match(req).then(
    (r) => r || caches.match(new URL("offline.html", self.registration.scope).href)
  );
}

/* آخرین سنگر: اگر نه شبکه بود و نه حافظهٔ نهان، یک صفحهٔ ساده و سالم. */
function offlineFallback() {
  return new Response(
    '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8">' +
    "<title>اتصال برقرار نشد</title>" +
    '<body style="font-family:system-ui;background:#eef3fb;display:grid;place-items:center;height:100vh;margin:0">' +
    '<div style="text-align:center"><h1>اتصال برقرار نشد</h1>' +
    "<p>اینترنت را بررسی کن و دوباره تلاش کن.</p>" +
    '<p><button onclick="location.reload()">تلاش دوباره</button></p></div></body></html>',
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  try {
    if (req.method !== "GET") return;
    const u = new URL(req.url);
    if (u.origin !== self.location.origin) return; // فونت و منابع بیرونی: بدون دخالت

    // پاسخ‌های API هرگز نباید از حافظهٔ نهان بیایند:
    // پیش‌تر وضعیت ورود، اعلان سراسری و پیام‌های به‌صورت کهنه دیده می‌شدند.
    if (u.pathname.indexOf("/api/") === 0 || u.pathname === "/__status" || u.pathname === "/healthz") return;

    if (isHTML(req)) {
      /* ناوبری: اول شبکه، بعد حافظهٔ نهان، آخر صفحهٔ آفلاین.
         این زنجیره هرگز رد نمی‌شود تا هیچ‌وقت ERR_FAILED نبینیم. */
      e.respondWith(
        withTimeout(fetch(req), 12000)
          .then((res) => { saveIfOk(e, PAGES, req, res); return res; })
          .catch(() => fromCache(req))
          .catch(() => offlineFallback())
      );
      return;
    }

    /* CSS و JS: اول شبکه، بعد حافظهٔ نهان. */
    if (/\.(css|js|webmanifest)$/.test(u.pathname)) {
      e.respondWith(
        withTimeout(fetch(req), 12000)
          .then((res) => { saveIfOk(e, RUNTIME, req, res); return res; })
          .catch(() => caches.match(req).then((r) => r || caches.match(u.pathname)))
          .catch(() => Response.error())
      );
      return;
    }

    // دارایی‌های ایستا: ابتدا حافظه، سپس شبکه (با به‌روزرسانی در پس‌زمینه)
    e.respondWith(
      caches.match(req).then((hit) => {
        if (hit) {
          e.waitUntil(
            fetch(req)
              .then((res) => { saveIfOk(e, RUNTIME, req, res); return res; })
              .catch(() => { })
          );
          return hit;
        }
        return fetch(req)
          .then((res) => { saveIfOk(e, RUNTIME, req, res); return res; })
          .catch(() => Response.error());
      })
    );
  } catch (err) {
    /* اگر همین‌جا خطایی رخ داد، هیچ respondWith نکن تا مرورگر
       خودش درخواست را طبیعی انجام دهد (سالم‌ترین حالت). */
  }
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
