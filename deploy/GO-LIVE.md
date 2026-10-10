# سایت را زنده کنید — ۳ گام

> این سند نتیجهٔ تست واقعی شبکهٔ همین سیستم است (چه چیزی در دسترس است و چه چیزی نیست).

---

## وضعیت شبکه (تست‌شده)

| سرویس | وضعیت | معنی |
|---|---|---|
| GitHub API | ✅ در دسترس | انتشار روی GitHub Pages کار می‌کند |
| Cloudflare API | ✅ در دسترس | انتشار روی Cloudflare Workers کار می‌کند |
| IRNIC (nic.ir) | ✅ در دسترس | ثبت دامنهٔ `.ir` کار می‌کند |
| Netlify / Vercel | ✅ در دسترس | گزینه‌های جایگزین |
| Google (dl.google.com) | ❌ بسته | ساخت APK با ابزار گوگل مستقیم ممکن نیست (از آینه حل شد) |
| Cloudflare Tunnel | ❌ بسته | تونل موقت کار نمی‌کند |

---

## گام ۱ — دامنه

`rahnama.com` **آزاد نیست** (از ۲۰۰۳ ثبت شده). این‌ها بررسی شده و **آزادند**:

| دامنه | چرا | وضعیت |
|---|---|---|
| **`rahnama.ir`** | همان کلمه، ارزان، رسمی ایران، IRNIC در دسترس | ✅ آزاد — پیشنهاد اول |
| `rahnama.co` | نزدیک‌ترین ظاهر به `.com` | ✅ آزاد |
| `rahnamaedu.com` | کلمهٔ رهنما + آموزش روی `.com` | ✅ آزاد |
| `rahnamaacademy.com` | ترکیب آموزشی روی `.com` | ✅ آزاد |
| `rahnama.app` | مخصوص اپ | ✅ آزاد |
| `rahnama.school` | آموزشی | ✅ آزاد |
| `rahnama.net` · `rahnama.org` · `rahnama.info` | — | ❌ گرفته‌شده |

ثبت `rahnama.ir` از [nic.ir](https://www.nic.ir) انجام می‌شود و IRNIC از همین سیستم در دسترس است.

بعد از خرید، با یک فرمان روی کل سایت اعمالش کنید:

```
npm run domain -- rahnama.ir
```

این فرمان `CNAME`، همهٔ `canonical`ها، `og:url`، `sitemap.xml`، `robots.txt` و `_headers` را هماهنگ می‌کند.

---

## گام ۲ — ورود به GitHub (یک‌بار، ۳۰ ثانیه)

```
gh auth login
```

گزینه‌ها را این‌طور انتخاب کنید: `GitHub.com` → `HTTPS` → `Login with a web browser` → کد را در مرورگر بزنید.

## گام ۳ — انتشار

```
npm run publish                            # فقط انتشار (آدرس github.io)
npm run publish -- rahnama.ir              # انتشار + تنظیم دامنه
```

اسکریپت خودش همه‌کار را می‌کند: مخزن می‌سازد، push می‌کند، GitHub Pages را روشن می‌کند و **آدرس زنده** را چاپ می‌کند.

> بعد از دامنهٔ اختصاصی، در DNS دامنه یک رکورد `CNAME` به `نام‌کاربری.github.io` بسازید.

---

## گزینهٔ حرفه‌ای — Cloudflare Workers (پنل واقعی + کلاس مجازی مشترک)

GitHub Pages سایت را آفلاین‌محور منتشر می‌کند (حساب‌ها روی هر دستگاه). اگر پنل مدیریت
واقعی، تیک آبی و کلاس مجازی مشترک می‌خواهید:

```
npm install
npx wrangler login
npx wrangler d1 create rahnama-db      # شناسه را در wrangler.jsonc بگذارید
npx wrangler secret put OWNER_PASSWORD
npm run deploy
```

جزئیات کامل: [`README-DEPLOY.md`](README-DEPLOY.md)

---

## نمایش موقت روی کامپیوتر خودتان

```
npm run share
```

⚠️ تست شد: تونل عمومی Cloudflare از این شبکه بسته است، پس `npm run share` روی این
اینترنت کار نمی‌کند. اما **پیش‌نمایش محلی** همیشه کار می‌کند:

```
npm run serve        # http://127.0.0.1:8790
```

---

## چک‌لیست بعد از انتشار

- [ ] آدرس سایت باز می‌شود و قفل SSL دارد
- [ ] `آدرس/api/health` → `ok: true`
- [ ] ورود با ایمیل مالک کار می‌کند
- [ ] یک جزوه باز می‌شود و دستیار پاسخ می‌دهد
- [ ] `آدرس/sitemap.xml` و `robots.txt` باز می‌شوند
