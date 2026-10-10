// ===========================================================================
//  ساخت APK رهنما — بدون Gradle و بدون Android SDK
//  ---------------------------------------------------------------------------
//  زنجیره: aapt2 (منابع) → javac (جاوای اپ) → D8 (dex) → بسته‌بندی →
//          هم‌ترازی (zipalign.py) → امضا با apksig (نسخهٔ ۱ و ۲)
//
//  استفاده:
//     node android/tools/build-apk.mjs [--tools <پوشهٔ ابزار>] [--no-assets]
//
//  پوشهٔ ابزار باید داشته باشد:
//     jdk/bin/javac.exe  jdk/bin/java.exe  jdk/bin/keytool.exe
//     r8.jar  aapt2.exe  apksig.jar  android.jar
// ===========================================================================
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { syncAssets } from "./sync-assets.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANDROID = path.resolve(HERE, "..");
const REPO = path.resolve(ANDROID, "..");
const APP = path.join(ANDROID, "app");
const BUILD = path.join(ANDROID, "build");
const DIST = path.join(ANDROID, "dist");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i > -1 && argv[i + 1] ? argv[i + 1] : d; };
const TOOLS = path.resolve(arg("--tools", process.env.ANDROID_TOOLS || path.join(REPO, "_work", "android-tools")));
const SKIP_ASSETS = argv.includes("--no-assets");

const PKG_DIR = "ir/rahnama/app";
const KS = path.join(ANDROID, "rahnama-release.keystore");
const KS_PASS = process.env.KEYSTORE_PASS || "rahnama-release";
const KS_ALIAS = process.env.KEYSTORE_ALIAS || "rahnama";
const OUT_NAME = "rahnama-android-6.0.apk";

const EXE = process.platform === "win32" ? ".exe" : "";
const JAVA = path.join(TOOLS, "jdk", "bin", "java" + EXE);
const JAVAC = path.join(TOOLS, "jdk", "bin", "javac" + EXE);
const KEYTOOL = path.join(TOOLS, "jdk", "bin", "keytool" + EXE);
const AAPT2 = path.join(TOOLS, "aapt2" + EXE);
const R8 = path.join(TOOLS, "r8.jar");
const APKSIG = path.join(TOOLS, "apksig.jar");
const ANDROID_JAR = path.join(TOOLS, "android.jar");

function run(bin, args, opts) {
  const o = Object.assign({ stdio: "pipe", encoding: "utf-8", maxBuffer: 1 << 28 }, opts || {});
  try {
    return execFileSync(bin, args, o);
  } catch (e) {
    const out = [e.stdout, e.stderr].filter(Boolean).join("\n");
    throw new Error(`\n$ ${path.basename(bin)} ${args.join(" ")}\n${out || e.message}`);
  }
}
const log = (m) => console.log("• " + m);
const rm = (p) => fs.rmSync(p, { recursive: true, force: true });

/* ------------------------------------------------------------ ۰) بررسی ابزار */
function checkTools() {
  const need = [[JAVA, "java"], [JAVAC, "javac"], [KEYTOOL, "keytool"], [AAPT2, "aapt2"], [R8, "r8.jar"], [APKSIG, "apksig.jar"], [ANDROID_JAR, "android.jar"]];
  const missing = need.filter(([p]) => !fs.existsSync(p)).map(([, n]) => n);
  if (missing.length) {
    console.error("ابزارهای لازم پیدا نشد: " + missing.join("، "));
    console.error("پوشهٔ ابزار: " + TOOLS);
    console.error("راهنما: android/BUILD-APK.md");
    process.exit(2);
  }
}

/* ------------------------------------------------- ۱) کپی سایت داخل اپ (assets) */
function copySiteIn() {
  const n = syncAssets(APP, REPO);
  log(`سایت داخل اپ کپی شد: ${n} فایل`);
}

/* ------------------------------------------------------------------- ۲) منابع */
function buildResources() {
  rm(BUILD);
  fs.mkdirSync(path.join(BUILD, "gen"), { recursive: true });
  run(AAPT2, ["compile", "--dir", path.join(APP, "res"), "-o", path.join(BUILD, "res.zip")]);
  log("منابع کامپایل شد");

  // aapt2 برای تولید R.java به نام بسته نیاز دارد؛ منبع مانیفست عمداً بدون
  // package است (برای سازگاری با Gradle 8)، پس اینجا تزریق می‌شود.
  const manSrc = fs.readFileSync(path.join(APP, "AndroidManifest.xml"), "utf8");
  const manOut = path.join(BUILD, "AndroidManifest.xml");
  fs.writeFileSync(manOut, manSrc.replace(/<manifest\s/, '<manifest package="ir.rahnama.app" '), "utf8");

  run(AAPT2, [
    "link", "-o", path.join(BUILD, "base.apk"),
    "-I", ANDROID_JAR,
    "--manifest", manOut,
    "-R", path.join(BUILD, "res.zip"),
    "--java", path.join(BUILD, "gen"),
    "--min-sdk-version", "21",
    "--target-sdk-version", "34",
    "--version-code", "6",
    "--version-name", "6.0.0",
    "--auto-add-overlay"
  ]);
  log("APK پایه ساخته شد (منابع + مانیفست)");
}

/* ---------------------------------------------------------------- ۳) کامپایل جاوا */
function compileJava() {
  const gen = path.join(BUILD, "gen", PKG_DIR, "R.java");
  const src = path.join(APP, "java", PKG_DIR, "MainActivity.java");
  const classes = path.join(BUILD, "classes");
  fs.mkdirSync(classes, { recursive: true });
  const common = ["-encoding", "UTF-8", "-d", classes];
  const tryFlags = [
    ["-source", "8", "-target", "8", "--system", "none", "-bootclasspath", ANDROID_JAR, "-classpath", ANDROID_JAR],
    ["-source", "8", "-target", "8", "-classpath", ANDROID_JAR]
  ];
  let ok = false, lastErr = null;
  for (const f of tryFlags) {
    try { run(JAVAC, common.concat(f, [gen, src])); ok = true; break; }
    catch (e) { lastErr = e; }
  }
  if (!ok) throw lastErr;
  log("جاوای اپ کامپایل شد");
}

/* ------------------------------------------------------------------ ۴) ساخت dex */
function buildDex() {
  const classesDir = path.join(BUILD, "classes");
  const out = path.join(BUILD, "dex");
  fs.mkdirSync(out, { recursive: true });
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".class")) files.push(p);
    }
  })(classesDir);
  if (!files.length) throw new Error("هیچ فایل .class پیدا نشد");
  run(JAVA, ["-Xmx1g", "-cp", R8, "com.android.tools.r8.D8",
    "--release", "--min-api", "21", "--lib", ANDROID_JAR, "--output", out].concat(files));
  log(`dex ساخته شد (${files.length} کلاس)`);
}

/* -------------------------------------------------- ۵) افزودن dex + هم‌ترازی */
function packageApk() {
  const py = process.env.PYTHON || "python";
  const base = path.join(BUILD, "base.apk");
  const dex = path.join(BUILD, "dex", "classes.dex");
  const packed = path.join(BUILD, "packed.apk");
  rm(packed);
  // دارایی‌ها (کل سایت) + dex با نام‌گذاری استاندارد ZIP اضافه می‌شوند
  run(py, [path.join(HERE, "pack.py"), base, packed, path.join(APP, "assets"), dex]);

  const aligned = path.join(BUILD, "aligned.apk");
  rm(aligned);
  run(py, [path.join(HERE, "zipalign.py"), packed, aligned, "4"]);
  const chk = run(py, ["-c",
    "import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); a=z.getinfo('resources.arsc'); d=z.getinfo('classes.dex'); h=z.getinfo('assets/site/index.html'); print('arsc_stored=%s dex_stored=%s site_included=%s' % (a.compress_type==0, d.compress_type==0, h.file_size>1000))", aligned]);
  log("بسته‌بندی و هم‌ترازی: " + String(chk).trim());
  return aligned;
}

/* ------------------------------------------------------------------- ۶) امضا */
function signApk(aligned) {
  if (!fs.existsSync(KS)) {
    log("ساخت کلید امضا (یک‌بار برای همیشه)");
    run(KEYTOOL, ["-genkeypair", "-keystore", KS, "-alias", KS_ALIAS,
      "-keyalg", "RSA", "-keysize", "2048", "-validity", "10000",
      "-storetype", "PKCS12", "-storepass", KS_PASS, "-keypass", KS_PASS,
      "-dname", "CN=Rahnama, OU=Education, O=Rahnama, L=Tehran, C=IR"]);
  }
  const signClasses = path.join(BUILD, "signer");
  fs.mkdirSync(signClasses, { recursive: true });
  run(JAVAC, ["-encoding", "UTF-8", "-d", signClasses, "-cp", APKSIG, path.join(HERE, "Sign.java")]);
  fs.mkdirSync(DIST, { recursive: true });
  const out = path.join(DIST, OUT_NAME);
  rm(out);
  const sep = process.platform === "win32" ? ";" : ":";
  const res = run(JAVA, ["-cp", APKSIG + sep + signClasses, "Sign", aligned, out, KS, KS_PASS, KS_ALIAS]);
  log(String(res).trim());
  return out;
}

/* ------------------------------------------------------------------ اجرا */
try {
  console.log("=== ساخت APK رهنما ۶٫۰ ===");
  checkTools();
  if (!SKIP_ASSETS) copySiteIn();
  buildResources();
  compileJava();
  buildDex();
  const aligned = packageApk();
  const apk = signApk(aligned);
  const size = (fs.statSync(apk).size / 1048576).toFixed(2);
  console.log("\n✅ آماده است: " + apk + "  (" + size + " مگابایت)");
} catch (e) {
  console.error("\n❌ ساخت ناموفق بود:");
  console.error(e && e.message ? e.message : e);
  process.exit(1);
}
