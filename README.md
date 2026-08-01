# ساخت اپ اندروید «حساب مغازه»

این پوشه یک پروژه آمادهٔ Capacitor است. برنامه همان سایت HTML توست + پشتیبان‌گیری خودکار در پوشهٔ Downloads به صورت فایل CSV (با اکسل باز می‌شود).

## پشتیبان‌گیری چطور کار می‌کند؟
- بعد از هر ثبت / ویرایش / حذف تراکنش، حدود ۲.۵ ثانیه بعد یک فایل ذخیره می‌شود:
  - `گزارش_مغازه_1405-05-10.csv` → قابل باز شدن در اکسل (UTF-8 با BOM، فارسی سالم) و شامل ردیف جمع‌ها
  - `پشتیبان_مغازه_1405-05-10.json` → برای بازگردانی با دکمه «بارگذاری از فایل» در خود برنامه
- مسیر ذخیره به ترتیب تلاش: `Download/MaghazeBackup` → `Documents/MaghazeBackup` → حافظهٔ اختصاصی اپ
- دکمهٔ گرد پایین-راست «⬇️ پشتیبان اکسل» برای گرفتن پشتیبان فوری و دیدن مسیر ذخیره
- فایل هر روز یکی است (با تاریخ شمسی) و در طول روز به‌روزرسانی می‌شود، پس پوشه پر نمی‌شود.

## روش ۱: ساخت APK بدون نصب چیزی (پیشنهادی)
۱. یک ریپازیتوری خالی در GitHub بساز.
۲. کل محتوای این پوشه (شامل `.github`) را آپلود کن.
۳. تب **Actions** → **Build Android APK** → **Run workflow**.
۴. بعد از ~۵ دقیقه از بخش Artifacts فایل `app-debug.apk` را دانلود و روی گوشی نصب کن.

## روش ۲: روی کامپیوتر خودت
پیش‌نیاز: Node.js، Android Studio، JDK 21
```bash
npm install
npx cap add android
npx cap sync android
npx cap open android      # سپس در Android Studio: Build > Build APK(s)
```
یا بدون Android Studio:
```bash
cd android && ./gradlew assembleDebug
# خروجی: android/app/build/outputs/apk/debug/app-debug.apk
```
اگر گوشی اندروید ۹ یا پایین‌تر داری، مجوز حافظه را در `android/app/src/main/AndroidManifest.xml` اضافه کن:
```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29" />
```
(در روش GitHub این کار خودکار انجام می‌شود.)

## نکات
- رمز ورود همچنان در `www/index.html` خط `const APP_PIN = "2001";` تغییر می‌کند. بعد از تغییر، `npx cap sync` را اجرا کن.
- همگام‌سازی گوگل درایو بدون تغییر کار می‌کند (نیاز به اینترنت).
- برای نصب روی گوشی، «نصب برنامه از منابع نامعتبر» را برای فایل‌منیجر فعال کن.
- برای انتشار در گوگل‌پلی به نسخهٔ امضاشده (`assembleRelease` + keystore) نیاز است؛ بگو تا راهنمایش را اضافه کنم.
