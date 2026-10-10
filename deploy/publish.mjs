// ===========================================================================
//  انتشار سایت روی GitHub Pages — با یک فرمان
//  ---------------------------------------------------------------------------
//  ۱) یک‌بار وارد شوید:      gh auth login
//  ۲) بعد فقط:               node deploy/publish.mjs [دامنه]
//
//  چه می‌کند؟
//    • مخزن گیت می‌سازد (اگر نباشد) و همه‌چیز را push می‌کند
//    • GitHub Pages را روشن می‌کند
//    • اگر دامنه بدهید، کل سایت را روی همان دامنه تنظیم می‌کند
//    • آدرس زنده را چاپ می‌کند
//
//  مثال:
//    node deploy/publish.mjs                 → فقط انتشار روی github.io
//    node deploy/publish.mjs rahnama.ir      → انتشار + تنظیم دامنهٔ rahnama.ir
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..");
const DOMAIN = (process.argv[2] || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();

function run(bin, args, opts) {
  const o = Object.assign({ stdio: "pipe", encoding: "utf-8", cwd: REPO, maxBuffer: 1 << 26 }, opts || {});
  try { return (execFileSync(bin, args, o) || "").toString().trim(); }
  catch (e) { const out = [e.stdout, e.stderr].filter(Boolean).join("\n").trim(); throw new Error(`$${bin} ${args.join(" ")}\n${out || e.message}`); }
}
const ok = (bin, args) => { try { run(bin, args); return true; } catch (e) { return false; } };
const log = (m) => console.log(m);

/* ------------------------------------------------------------ ۰) پیش‌نیاز */
log("=== انتشار رهنما روی GitHub Pages ===");
try {
  const who = run("gh", ["api", "user", "--jq", ".login"]);
  log("حساب GitHub: " + who);
} catch (e) {
  console.error("\n❌ اول وارد GitHub شوید. یک‌بار این را بزنید و از مرورگر تأیید کنید:\n\n    gh auth login\n\nبعد دوباره همین فرمان را اجرا کنید.");
  process.exit(2);
}

/* ------------------------------------------------------ ۱) دامنه (اختیاری) */
if (DOMAIN) {
  log("تنظیم دامنه روی: " + DOMAIN);
  run(process.execPath, [path.join(HERE, "set-domain.mjs"), DOMAIN]);
}

/* --------------------------------------------------------------- ۲) مخزن */
const name = "rahnama";
if (!fs.existsSync(path.join(REPO, ".git"))) {
  run("git", ["init", "-b", "main"]);
  log("مخزن گیت ساخته شد");
}
run("git", ["add", "-A"]);

// اگر چیزی برای commit نبود، خطا ندهد
try {
  const st = run("git", ["status", "--porcelain"]);
  if (st) { run("git", ["commit", "-m", "رهنما ۶.۰ — سایت، بک‌اند، دستیار هوشمند و اپ اندروید"]); log("تغییرات commit شد"); }
  else log("چیز تازه‌ای برای commit نبود");
} catch (e) { log("هشدار commit: " + e.message.split("\n")[0]); }

let hasRemote = true;
try { run("git", ["remote", "get-url", "origin"]); } catch (e) { hasRemote = false; }

if (!hasRemote) {
  log("ساخت مخزن روی GitHub…");
  run("gh", ["repo", "create", name, "--public", "--source", ".", "--remote", "origin", "--push"]);
} else {
  run("git", ["push", "-u", "origin", "main"]);
  log("push انجام شد");
}

/* ---------------------------------------------------- ۳) روشن‌کردن Pages */
if (DOMAIN) {
  // با دامنهٔ اختصاصی، فایل CNAME خودش کار می‌کند
  ok("gh", ["api", "-X", "PUT", `repos/{owner}/${name}/pages`,
    "-f", "source[branch]=main", "-f", "source[path]=/public", "-f", `cname=${DOMAIN}`]);
} else {
  ok("gh", ["api", "-X", "PUT", `repos/{owner}/${name}/pages`,
    "-f", "source[branch]=main", "-f", "source[path]=/public"]);
}
log("GitHub Pages روشن شد (منبع: شاخهٔ main، پوشهٔ /public)");

/* --------------------------------------------------------- ۴) آدرس نهایی */
let user = "";
try { user = run("gh", ["api", "user", "--jq", ".login"]); } catch (e) { }
const live = DOMAIN ? "https://" + DOMAIN : `https://${user}.github.io/${name}/`;

log("\n✅ منتشر شد.");
log("   آدرس: " + live);
log("\nنکته: اولین انتشار تا یک دقیقه طول می‌کشد.");
if (!DOMAIN) {
  log("\nبرای دامنهٔ اختصاصی:");
  log("   ۱) دامنه را بخرید (rahnama.ir آزاد است)");
  log("   ۲) node deploy/publish.mjs rahnama.ir");
  log("   ۳) در DNS دامنه یک CNAME به " + user + ".github.io بسازید");
}
