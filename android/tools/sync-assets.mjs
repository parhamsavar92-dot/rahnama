// ===========================================================================
//  کپی محتوای سایت (public) به داخل اپ (android/app/assets/site)
//  ---------------------------------------------------------------------------
//  استفاده:  node android/tools/sync-assets.mjs
//  قبل از هر ساخت APK لازم است. اسکریپت build-apk.mjs خودش این را صدا می‌زند.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function syncAssets(appDir, repoRoot) {
  const dest = path.join(appDir, "assets", "site");
  const src = path.join(repoRoot, "public");
  if (!fs.existsSync(src)) throw new Error("پوشهٔ public پیدا نشد: " + src);

  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });

  let n = 0;
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const s = path.join(dir, e.name);
      const r = rel ? rel + "/" + e.name : e.name;
      if (e.isDirectory()) {
        fs.mkdirSync(path.join(dest, r), { recursive: true });
        walk(s, r);
      } else {
        fs.copyFileSync(s, path.join(dest, r));
        n++;
      }
    }
  };
  walk(src, "");
  return n;
}

// اجرای مستقیم
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("sync-assets.mjs")) {
  const repo = path.resolve(HERE, "..", "..");
  const app = path.join(repo, "android", "app");
  const n = syncAssets(app, repo);
  console.log("سایت داخل اپ کپی شد: " + n + " فایل → android/app/assets/site");
}
