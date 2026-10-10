// ===========================================================================
//  آماده‌سازی ابزارهای ساخت APK (یک‌بار)
//  ---------------------------------------------------------------------------
//  استفاده:  node android/tools/fetch-tools.mjs [پوشهٔ مقصد]
//  پیش‌فرض مقصد: <ریشهٔ پروژه>/_work/android-tools
//
//  چه چیزهایی می‌گیرد؟
//     jdk/            JDK 17 (Temurin) — برای javac و keytool و اجرای D8
//     r8.jar          D8 برای تبدیل کلاس‌های جاوا به dex
//     aapt2.exe       ساخت و بسته‌بندی منابع اندروید
//     apksig.jar      امضای APK (نسخهٔ ۱ و ۲)
//     android.jar     کتابخانهٔ پلتفرم اندروید برای کامپایل
//
//  نکته: اگر دسترسی به مخازن گوگل (dl.google.com / maven.google.com) بسته باشد،
//  این اسکریپت خودکار از آینهٔ Aliyun استفاده می‌کند.
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "..", "..");
const OUT = path.resolve(process.argv[2] || path.join(REPO, "_work", "android-tools"));
fs.mkdirSync(OUT, { recursive: true });

const AG = "https://maven.aliyun.com/repository/google/";
const AC = "https://maven.aliyun.com/repository/central/";
const R8_VER = "8.5.35";
const AAPT2_VER = "8.5.2-11315950";
const APKSIG_VER = "8.5.2";
const ANDROID_ALL = "13-robolectric-9030017";   // API 33

async function download(url, file, tries = 4) {
  const dest = path.join(OUT, file);
  if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
    console.log("  ✓ از قبل هست:", file, Math.round(fs.statSync(dest).size / 1024) + "KB");
    return dest;
  }
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, { redirect: "follow" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 5000) throw new Error("پاسخ خیلی کوچک: " + buf.length);
      fs.writeFileSync(dest, buf);
      console.log("  ✓", file, Math.round(buf.length / 1024) + "KB");
      return dest;
    } catch (e) {
      lastErr = e;
      console.log(`  … تلاش ${i} برای ${file} ناموفق (${e.message})`);
      await new Promise((r) => setTimeout(r, 2000 * i));
    }
  }
  throw new Error("دانلود " + file + " نشد: " + lastErr.message);
}

async function main() {
  console.log("پوشهٔ ابزار:", OUT);

  console.log("۱) JDK 17");
  const jdkZip = path.join(OUT, "jdk17.zip");
  const jdkBin = path.join(OUT, "jdk", "bin", "javac.exe");
  if (!fs.existsSync(jdkBin)) {
    try {
      const j = await (await fetch("https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse")).json();
      await download(j[0].binary.package.link, "jdk17.zip");
      console.log("  → باز کردن فایل zip با پایتون…");
      const { execFileSync } = await import("node:child_process");
      execFileSync("python", ["-c",
        "import zipfile,os,shutil,sys\n" +
        "out=sys.argv[1]\n" +
        "z=zipfile.ZipFile(os.path.join(out,'jdk17.zip'))\n" +
        "top=z.namelist()[0].split('/')[0]\n" +
        "z.extractall(os.path.join(out,'_jdk_tmp'))\n" +
        "tgt=os.path.join(out,'jdk')\n" +
        "shutil.rmtree(tgt, ignore_errors=True)\n" +
        "shutil.move(os.path.join(out,'_jdk_tmp',top), tgt)\n" +
        "shutil.rmtree(os.path.join(out,'_jdk_tmp'), ignore_errors=True)\n" +
        "print('jdk ready')\n", OUT], { stdio: "inherit" });
    } catch (e) {
      console.log("  ! JDK آماده نشد:", e.message);
      console.log("    می‌توانید JDK 17 را دستی دانلود کنید و در " + path.join(OUT, "jdk") + " بگذارید.");
    }
  } else console.log("  ✓ JDK از قبل آماده است");

  console.log("۲) R8 (شامل D8)");
  await download(AG + `com/android/tools/r8/${R8_VER}/r8-${R8_VER}.jar`, "r8.jar");

  console.log("۳) aapt2 (ویندوز)");
  const aapt2Jar = await download(AG + `com/android/tools/build/aapt2/${AAPT2_VER}/aapt2-${AAPT2_VER}-windows.jar`, "aapt2-win.jar");
  if (!fs.existsSync(path.join(OUT, "aapt2.exe"))) {
    const { execFileSync } = await import("node:child_process");
    execFileSync("python", ["-c",
      "import zipfile,sys\n" +
      "z=zipfile.ZipFile(sys.argv[1])\n" +
      "n=[x for x in z.namelist() if x.lower().endswith('aapt2.exe')][0]\n" +
      "open(sys.argv[2],'wb').write(z.read(n))\n" +
      "print('aapt2.exe آماده شد')\n", aapt2Jar, path.join(OUT, "aapt2.exe")], { stdio: "inherit" });
  } else console.log("  ✓ aapt2.exe از قبل آماده است");

  console.log("۴) apksig (امضا)");
  try {
    await download(AG + `com/android/tools/build/apksig/${APKSIG_VER}/apksig-${APKSIG_VER}.jar`, "apksig.jar");
  } catch (e) {
    console.log("  ! apksig دانلود نشد — امضای نسخهٔ ۲ ممکن نیست.");
    console.log("    اسکریپت ساخت، در این حالت فقط با jarsigner امضا می‌کند (نسخهٔ ۱).");
  }

  console.log("۵) android.jar (پلتفرم)");
  await download(AC + `org/robolectric/android-all/${ANDROID_ALL}/android-all-${ANDROID_ALL}.jar`, "android.jar");

  console.log("\nابزارها آماده‌اند. حالا بزنید:");
  console.log("   node android/tools/build-apk.mjs --tools \"" + OUT + "\"");
}
main().catch((e) => { console.error("خطا:", e.message); process.exit(1); });
