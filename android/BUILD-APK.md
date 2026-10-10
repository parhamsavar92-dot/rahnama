# ساخت اپلیکیشن اندروید رهنما

این پوشه یک اپ کامل اندروید است: **کل سایت (همهٔ ۹۷ صفحه، جزوه‌ها، تصاویر و فونت‌ها) داخل خودِ اپ ذخیره شده** و
بدون اینترنت هم کار می‌کند. هیچ کتابخانهٔ بیرونی (AndroidX) مصرف نمی‌شود.

| ویژگی | توضیح |
|---|---|
| نام بسته | `ir.rahnama.app` |
| کمینهٔ اندروید | 5.0 (API 21) |
| هدف | Android 14 (API 34) |
| حجم تقریبی APK | حدود ۱۵ مگابایت |
| اینترنت | فقط برای پرسش از دستیار سروری و دریافت اعلان‌ها؛ بقیهٔ سایت آفلاین است |

---

## چطور داخل اپ کار می‌کند؟

سایت از میزبان داخلی `https://appassets.androidplatform.net/` سرو می‌شود که خودِ
`MainActivity` آن را از پوشهٔ `assets/site` پاسخ می‌دهد. دو دلیل:

1. **کد خود سایت همین نام را می‌شناسد.** `hk-auth.js` وقتی این میزبان را ببیند،
   حساب کاربری را روی خود دستگاه می‌سازد (ثبت‌نام/ورود/پروفایل کار می‌کند).
2. **منشأ https است، نه `file://`.** پس `localStorage` و `fetch()` درون‌صفحه‌ای
   درست کار می‌کنند؛ با `file://` مرورگر اندروید جلوی خواندن فایل‌های JSON را می‌گیرد.

مسیرهای `/api/*` عمداً **۴۰۴** برمی‌گردند تا سایت خودکار به «حالت محلی» برود و
منتظر سروری که وجود ندارد نماند.

---

## روش ۱ — ساخت بدون Gradle و بدون Android SDK (همین‌جا)

فقط به یک JDK 17 و چهار فایل کوچک نیاز است. اسکریپت `tools/build-apk.mjs`
همهٔ کارها را انجام می‌دهد: aapt2 → javac → D8 → بسته‌بندی → هم‌ترازی → امضا.

```
node android/tools/build-apk.mjs --tools <پوشهٔ ابزار>
```

پوشهٔ ابزار باید این‌ها را داشته باشد:

```
jdk/bin/java.exe  jdk/bin/javac.exe  jdk/bin/keytool.exe
r8.jar          ← از com.android.tools:r8
aapt2.exe       ← از com.android.tools.build:aapt2 (classifier: windows)
apksig.jar      ← از com.android.tools.build:apksig
android.jar     ← از org.robolectric:android-all (یا پلتفرم رسمی)
```

خروجی: `android/dist/rahnama-android-6.0.apk` (امضاشده با نسخهٔ ۱ و ۲).

کلید امضا یک‌بار خودکار در `android/rahnama-release.keystore` ساخته می‌شود.
> **مهم:** این فایل را گم نکنید. برای انتشار نسخهٔ بعدی در همان اپ، باید با همین
> کلید امضا شود. رمز پیش‌فرض `rahnama-release` است و با `KEYSTORE_PASS` عوض می‌شود.

---

## روش ۲ — با Android Studio / Gradle (استاندارد و آمادهٔ Google Play)

پوشهٔ `android/` یک پروژهٔ کامل Gradle هم هست. **اول محتوای سایت را داخل اپ کپی کنید:**

```
npm run apk:sync               # public/ → android/app/assets/site/
cd android
gradle assembleRelease         # یا در Android Studio: Build > Build APK
```

برای امضای نسخهٔ انتشار:

```
KEYSTORE_PASS=رمز-شما KEYSTORE_ALIAS=rahnama ./gradlew assembleRelease
```

> اگر شبکه‌تان به `dl.google.com` دسترسی ندارد، در `settings.gradle` خط آینهٔ
> `maven.aliyun.com/repository/google` را از حالت توضیح خارج کنید.

---

## روش ۳ — ساخت خودکار روی GitHub (بدون نصب هیچ‌چیز)

فایل `.github/workflows/android-apk.yml` در ریشهٔ پروژه هست. کافی است مخزن را در
GitHub بگذارید؛ در هر تغییر، APK ساخته می‌شود و از بخش **Actions → Artifacts**
قابل دانلود است. برای امضای ثابت، این سه Secret را در مخزن بگذارید:

| Secret | مقدار |
|---|---|
| `KEYSTORE_BASE64` | فایل کلیدفروشگاه به‌صورت base64 |
| `KEYSTORE_PASS` | رمز کلیدفروشگاه |
| `KEYSTORE_ALIAS` | `rahnama` |

---

## نصب روی گوشی

1. فایل APK را به گوشی منتقل کنید.
2. «نصب برنامه‌های ناشناس» را برای مرورگر/فایل‌منیجر فعال کنید.
3. نصب کنید. آیکون «رهنما» در صفحهٔ اصلی ظاهر می‌شود.

اپ **آفلاین کامل** است؛ از همان لحظهٔ نصب، همهٔ جزوه‌ها و آزمون‌ها باز می‌شوند.

---

## نکته‌های فنی

- **آیکون:** `app/res/mipmap-*/ic_launcher.png` (همان آیکون سایت).
- **دکمهٔ بازگشت:** داخل سایت یک مرحله عقب می‌رود، بعد اپ را می‌بندد.
- **پیوندهای بیرونی** (مثل تلگرام یا تلفن) در مرورگر/برنامهٔ همان سرویس باز می‌شوند.
- **نسخهٔ اپ:** `android/app/AndroidManifest.xml` → `android:versionCode` / `versionName`.
- **تغییر محتوای سایت:** بعد از هر ویرایش در `public/`، دوباره APK را بسازید؛
  اسکریپت خودش محتوای تازه را داخل اپ کپی می‌کند.
