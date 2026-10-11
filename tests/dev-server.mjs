// سرور تست محلی: Worker + D1 شبیه‌ساز + فایل‌های public (فقط برای تست؛ برای توسعهٔ واقعی از «wrangler dev» استفاده کنید)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { D1Shim } from "./d1-shim.mjs";
import worker from "../src/worker.js";
const PORT = +process.env.PORT || 8790, ROOT = path.resolve("public");
// ⚠ امنیت: این رمز فقط برای «آزمون محلی» است و نباید همان رمز سایت زنده باشد.
// رمز واقعی سایت فقط به‌صورت Secret در Cloudflare نگه داشته می‌شود
// (npx wrangler secret put OWNER_PASSWORD) و هرگز داخل مخزن نوشته نمی‌شود.
const TEST_OWNER_PASSWORD = "local-test-only-pass";
const env = { DB: new D1Shim(), OWNER_EMAIL: "parham.savar92@gmail.com", OWNER_PASSWORD: process.env.OWNER_PASSWORD || TEST_OWNER_PASSWORD };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
env.ASSETS = { fetch: async (req) => {
  let p = decodeURIComponent(new URL(req.url).pathname); if (p.endsWith("/")) p += "index.html";
  let f = path.join(ROOT, p); if (!f.startsWith(ROOT)) return new Response("no", { status: 403 });
  if (!fs.existsSync(f) && fs.existsSync(f + ".html")) f += ".html";
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response("404", { status: 404 });
  return new Response(fs.readFileSync(f), { headers: { "Content-Type": MIME[path.extname(f)] || "application/octet-stream" } });
} };
http.createServer(async (rq, rs) => {
  const chunks = []; for await (const c of rq) chunks.push(c);
  const body = Buffer.concat(chunks);
  const req = new Request("http://" + rq.headers.host + rq.url, { method: rq.method, headers: rq.headers, body: ["GET", "HEAD"].includes(rq.method) ? undefined : body });
  const res = await worker.fetch(req, env, { waitUntil() {} });
  const h = {}; res.headers.forEach((v, k) => { h[k] = v; });
  const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : []; if (sc.length) h["set-cookie"] = sc;
  rs.writeHead(res.status, h); rs.end(Buffer.from(await res.arrayBuffer()));
}).listen(PORT, () => console.log("dev server on :" + PORT));
