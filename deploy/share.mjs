// ===========================================================================
//  نمایش زندهٔ سایت روی اینترنت — بدون هیچ حساب کاربری
//  ---------------------------------------------------------------------------
//  استفاده:  node deploy/share.mjs [پورت]
//
//  چه می‌کند؟
//    ۱) اگر cloudflared نباشد، خودش از GitHub دانلود می‌کند
//    ۲) سرور محلی سایت را بالا می‌آورد (همان Worker واقعی + دیتابیس محلی)
//    ۳) یک تونل HTTPS عمومی می‌سازد و آدرسش را چاپ می‌کند
//
//  ⚠️ این یک «نمایش موقت» است: تا وقتی این پنجره باز است کار می‌کند و با بستن
//  آن، آدرس از کار می‌افتد. برای میزبانی دائمی از deploy/publish.mjs یا
//  Cloudflare Workers استفاده کنید (deploy/README-DEPLOY.md).
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const TOOLS = path.join(REPO, "_work", "share-tools");
const PORT = Number(process.argv[2]) || 8791;
const CF_URL = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe";

fs.mkdirSync(TOOLS, { recursive: true });
const CF = path.join(TOOLS, "cloudflared.exe");

// رمز مالک: اگر کاربر نداده باشد، یک رمز قوی می‌سازیم
const OWNER_PASSWORD = process.env.OWNER_PASSWORD ||
  "Rahnama-" + crypto.randomBytes(4).toString("hex").toUpperCase() + "-" + crypto.randomInt(1000, 9999) + "!";

async function ensureCloudflared() {
  if (fs.existsSync(CF) && fs.statSync(CF).size > 1e6) return;
  console.log("• دانلود cloudflared (یک‌بار)…");
  const r = await fetch(CF_URL, { redirect: "follow" });
  if (!r.ok) throw new Error("دانلود cloudflared نشد: HTTP " + r.status);
  fs.writeFileSync(CF, Buffer.from(await r.arrayBuffer()));
  console.log("• cloudflared آماده شد");
}

await ensureCloudflared();

console.log("• بالا آوردن سرور سایت روی پورت " + PORT + "…");
const server = spawn(process.execPath, [path.join(REPO, "tests", "dev-server.mjs")], {
  cwd: REPO,
  env: Object.assign({}, process.env, { PORT: String(PORT), OWNER_PASSWORD }),
  stdio: ["ignore", "pipe", "pipe"]
});
server.stdout.on("data", (d) => process.stdout.write("  [سرور] " + d));
server.stderr.on("data", (d) => process.stderr.write("  [سرور] " + d));

await new Promise((r) => setTimeout(r, 2500));

console.log("• ساخت تونل عمومی HTTPS…");
const cf = spawn(CF, ["tunnel", "--url", "http://127.0.0.1:" + PORT, "--no-autoupdate"], {
  cwd: TOOLS, stdio: ["ignore", "pipe", "pipe"]
});

let shown = false;
const scan = (buf) => {
  const txt = buf.toString();
  const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i.exec(txt);
  if (m && !shown) {
    shown = true;
    const url = m[0];
    console.log("\n" + "=".repeat(64));
    console.log("  ✅ سایت شما زنده است:");
    console.log("     " + url);
    console.log("");
    console.log("  • ورود مالک:  parham.savar92@gmail.com");
    console.log("  • رمز مالک:   " + OWNER_PASSWORD);
    console.log("");
    console.log("  این آدرس موقت است؛ برای دائمی‌کردن: deploy/README-DEPLOY.md");
    console.log("  برای بستن: Ctrl + C");
    console.log("=".repeat(64) + "\n");
  }
};
cf.stdout.on("data", scan);
cf.stderr.on("data", (d) => { scan(d); process.stderr.write(d); });

const bye = () => { try { cf.kill(); } catch (e) { } try { server.kill(); } catch (e) { } process.exit(0); };
process.on("SIGINT", bye);
process.on("SIGTERM", bye);
