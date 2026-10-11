// ===========================================================================
//  راه‌اندازی بک‌اند واقعی روی Cloudflare — با یک فرمان
//  ---------------------------------------------------------------------------
//  استفاده:   node deploy/backend.mjs [رمز-مالک]
//
//  چه می‌کند؟
//    ۱) بررسی می‌کند وارد حساب Cloudflare شده‌اید (وگرنه راهنمایی می‌کند)
//    ۲) پایگاه دادهٔ D1 را می‌سازد و شناسه‌اش را در wrangler.jsonc می‌نویسد
//    ۳) جدول‌ها را می‌سازد
//    ۴) رمز مالک را به‌صورت Secret ذخیره می‌کند
//    ۵) سایت + بک‌اند را منتشر می‌کند و آدرس نهایی را چاپ می‌کند
//
//  نتیجه: حساب‌ها، کلاس مجازی و پیام‌ها برای همهٔ کاربران و همهٔ دستگاه‌ها
//  مشترک می‌شوند (همان چیزی که در میزبانی استاتیک ممکن نبود).
// ===========================================================================
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")), "..");
const DB_NAME = "rahnama-db";
const args = process.argv.slice(2);
let ownerPass = args[0] || "";

const WRANGLER = path.join(REPO, "node_modules", "wrangler", "bin", "wrangler.js");

function run(argv, opts) {
  return execFileSync(process.execPath, [WRANGLER].concat(argv), {
    cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...(opts || {})
  });
}

function tryRun(argv) {
  try { return { ok: true, out: run(argv) }; }
  catch (e) { return { ok: false, out: String((e.stdout || "") + (e.stderr || "") + (e.message || "")) }; }
}

function log(s) { console.log(s); }

// ---------------------------------------------------------------- ورود حساب
log("• بررسی ورود به Cloudflare ...");
const who = tryRun(["whoami"]);
if (!who.ok || /not authenticated|You are not authenticated/i.test(who.out)) {
  log("");
  log("✗ هنوز وارد حساب Cloudflare نشده‌اید. یک‌بار این فرمان را بزنید:");
  log("");
  log("    npx wrangler login");
  log("");
  log("مرورگر باز می‌شود؛ روی Allow بزنید. بعد همین فرمان را دوباره اجرا کنید.");
  process.exit(1);
}
log("  ✓ " + who.out.split("\n").filter(Boolean).slice(0, 2).join(" · "));

// ------------------------------------------------------------- پایگاه داده
const cfgPath = path.join(REPO, "wrangler.jsonc");
let cfgText = fs.readFileSync(cfgPath, "utf8");
const idMatch = /"database_id"\s*:\s*"([^"]*)"/.exec(cfgText);
let dbId = idMatch ? idMatch[1] : "";
const placeholder = !dbId || /PUT-YOUR|HERE/i.test(dbId);

if (placeholder) {
  log("");
  log("• ساخت پایگاه دادهٔ D1 («" + DB_NAME + "») ...");
  const cr = tryRun(["d1", "create", DB_NAME]);
  const m = /"database_id"\s*:\s*"([0-9a-f-]{36})"/i.exec(cr.out) || /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(cr.out);
  if (!m) {
    if (/already exists/i.test(cr.out)) {
      log("  ! پایگاه از قبل ساخته شده ولی شناسه‌اش در wrangler.jsonc نیست.");
      log("    این فرمان را بزنید و شناسه را ببینید، بعد در wrangler.jsonc بگذارید:");
      log("       npx wrangler d1 list");
    } else {
      log("  ✗ ساخت پایگاه داده ممکن نشد:\n" + cr.out.split("\n").slice(-8).join("\n"));
    }
    process.exit(1);
  }
  dbId = m[1];
  cfgText = cfgText.replace(/"database_id"\s*:\s*"[^"]*"/, '"database_id": "' + dbId + '"');
  fs.writeFileSync(cfgPath, cfgText, "utf8");
  log("  ✓ شناسهٔ پایگاه در wrangler.jsonc نوشته شد: " + dbId);
} else {
  log("• پایگاه دادهٔ D1 از قبل تنظیم شده: " + dbId);
}

// ------------------------------------------------------------------ جدول‌ها
log("");
log("• ساخت جدول‌ها ...");
let schemaOk = false;
for (const cmd of [["d1", "execute", DB_NAME, "--remote", "--yes", "--file=schema.sql"],
                   ["d1", "execute", DB_NAME, "--remote", "--file=schema.sql"]]) {
  const r = tryRun(cmd);
  if (r.ok) { schemaOk = true; break; }
}
log(schemaOk ? "  ✓ جدول‌ها آماده‌اند" : "  ! اجرای schema.sql ناموفق بود (خود سرور هنگام اولین درخواست جدول‌ها را می‌سازد)");

// ---------------------------------------------------------------- رمز مالک
if (!ownerPass) ownerPass = "Rn-" + Math.random().toString(36).slice(2, 10) + Math.floor(Math.random() * 9000 + 1000) + "!";
log("");
log("• ثبت رمز مالک ...");
// wrangler secret put رمز را از stdin می‌خواند
let secretOk = false;
try {
  execFileSync(process.execPath, [WRANGLER, "secret", "put", "OWNER_PASSWORD"], {
    cwd: REPO, input: ownerPass + "\n", stdio: ["pipe", "pipe", "pipe"], encoding: "utf8"
  });
  secretOk = true;
} catch (e) { secretOk = false; }
if (!secretOk) {
  cfgText = fs.readFileSync(cfgPath, "utf8");
  if (!/"OWNER_PASSWORD"/.test(cfgText)) {
    cfgText = cfgText.replace(/"vars"\s*:\s*\{/, '"vars": {\n    "OWNER_PASSWORD": ' + JSON.stringify(ownerPass) + ",");
    fs.writeFileSync(cfgPath, cfgText, "utf8");
  }
  log("  ! Secret ثبت نشد؛ رمز مالک در wrangler.jsonc (vars) گذاشته شد.");
  log("    برای امنیت بیشتر بعداً اجرا کنید: npx wrangler secret put OWNER_PASSWORD");
} else {
  log("  ✓ رمز مالک به‌صورت Secret ذخیره شد");
}

// ----------------------------------------------------------------- انتشار
log("");
log("• انتشار سایت و بک‌اند (چند دقیقه طول می‌کشد) ...");
const dep = tryRun(["deploy"]);
const url = (/"https:\/\/[a-z0-9.-]+\.workers\.dev"/i.exec(dep.out) || [])[0];
if (!dep.ok) {
  log("  ✗ انتشار ناموفق بود:\n" + dep.out.split("\n").slice(-14).join("\n"));
  process.exit(1);
}

log("");
log("════════════════════════════════════════════════════════");
log("  ✅ بک‌اند واقعی راه‌اندازی شد");
if (url) log("  نشانی سایت: " + url.replace(/"/g, ""));
log("  ورود مالک : parham.savar92@gmail.com");
log("  رمز مالک  : " + ownerPass + "   ← این را جایی امن نگه دار");
log("  (محل ذخیره: " + (secretOk ? "Cloudflare Secret (امن)" : "wrangler.jsonc vars — بعداً به Secret منتقل کن") + ")");
log("════════════════════════════════════════════════════════");
log("");
log("اکنون حساب‌ها، کلاس مجازی و پیام‌ها برای همهٔ دستگاه‌ها مشترک است.");
log("برای وصل‌کردن دامنهٔ اختصاصی: npm run domain -- <دامنه>  و بعد دوباره deploy");
