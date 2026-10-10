// ===========================================================================
//  تغییر دامنهٔ سایت در همهٔ فایل‌ها — با یک فرمان
//  ---------------------------------------------------------------------------
//  استفاده:
//     node deploy/set-domain.mjs rahnama.ir
//     node deploy/set-domain.mjs rahnama.ir --www        (دامنهٔ اصلی www.rahnama.ir)
//     node deploy/set-domain.mjs --show                  (فقط نمایش دامنهٔ فعلی)
//
//  این اسکریپت: CNAME، canonical، og:url، twitter، robots.txt، sitemap.xml،
//  _headers و _redirects را هماهنگ می‌کند تا بعد از خرید دامنه، همه‌چیز یک‌دست شود.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.resolve(HERE, "..", "public");

const args = process.argv.slice(2);
const useWww = args.includes("--www");
const domArg = args.find((a) => !a.startsWith("--"));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function currentDomain() {
  try {
    const c = fs.readFileSync(path.join(PUB, "CNAME"), "utf8").trim();
    if (c) return c;
  } catch (e) { /* نیست */ }
  const m = /https:\/\/([^/"']+)/.exec(fs.readFileSync(path.join(PUB, "sitemap.xml"), "utf8"));
  return m ? m[1] : "(نامشخص)";
}

if (!domArg || args.includes("--show")) {
  console.log("دامنهٔ فعلی سایت:", currentDomain());
  console.log("برای تغییر:  node deploy/set-domain.mjs <دامنهٔ-تازه> [--www]");
  process.exit(0);
}

const host = String(domArg).replace(/^https?:\/\//i, "").replace(/\/+$/, "").toLowerCase();
if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host)) {
  console.error("دامنهٔ نامعتبر:", domArg);
  process.exit(2);
}
const bare = host.replace(/^www\./, "");
const FQDN = useWww ? "www." + bare : bare;

const oldNames = new Set([currentDomain(), "www.hamkardarsi.ir", "hamkardarsi.ir"].filter(Boolean));
const targets = [PUB, path.resolve(HERE, "..")];   // public + ریشهٔ پروژه (README, wrangler)
const skip = new Set(["node_modules", ".git", ".wrangler", "build", "dist", "assets/site"]);

let changed = 0;
const files = [];
for (const root of targets) {
  for (const f of walk(root)) {
    const rel = path.relative(path.resolve(HERE, ".."), f).replace(/\\/g, "/");
    if (skip.has(path.basename(path.dirname(f)))) continue;
    if (!/\.(html|xml|txt|json|jsonc|md|js|webmanifest|headers|redirects|CNAME)$/i.test(f) && path.basename(f) !== "CNAME") continue;
    if (rel.startsWith("android/")) continue;
    files.push(f);
  }
}

for (const f of files) {
  let txt;
  try { txt = fs.readFileSync(f, "utf8"); } catch (e) { continue; }
  const before = txt;
  for (const old of oldNames) {
    if (!old || old === "(نامشخص)" || old === FQDN) continue;
    txt = txt.split(old).join(FQDN);
  }
  if (txt !== before) { fs.writeFileSync(f, txt, "utf8"); changed++; }
}

fs.writeFileSync(path.join(PUB, "CNAME"), FQDN + "\n", "utf8");
console.log("دامنه تنظیم شد:", FQDN);
console.log("فایل‌های تغییرکرده:", changed);
console.log("\nقدم بعدی:  npm run deploy   (یا انتشار از طریق Cloudflare)");
