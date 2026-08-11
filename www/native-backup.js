/* پشتیبان‌گیری خودکار: بعد از هر تغییر + هر ۱۵ دقیقه + هنگام بسته شدن اپ */
(function () {
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const stamp = () => {
    try { return (window.getTodayShamsi ? window.getTodayShamsi() : '').replace(/\//g, '-') || new Date().toISOString().slice(0, 10); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  const toast = (m, ok) => (window.__toast ? window.__toast(m, ok) : null);

  let timer = null, running = false, lastPayload = '';

  async function runBackup(showToast) {
    if (running) return;
    const entries = (window.__getEntries ? window.__getEntries() : []) || [];
    if (!entries.length) { if (showToast) toast('داده‌ای برای پشتیبان‌گیری نیست', false); return; }

    const csv = window.__buildCSV ? window.__buildCSV() : '';
    const json = window.__buildJSON ? window.__buildJSON() : '';
    if (!showToast && csv === lastPayload) return; // تغییری نبوده
    running = true;
    try {
      if (isNative() && window.__writeToDevice) {
        const res = await window.__writeToDevice(`گزارش_مغازه_${stamp()}.csv`, csv);
        await window.__writeToDevice(`پشتیبان_مغازه_${stamp()}.json`, json);
        lastPayload = csv;
        localStorage.setItem('lastAutoBackup', new Date().toISOString());
        if (showToast) toast('✅ پشتیبان ذخیره شد: ' + res.label, true);
      } else {
        // در مرورگر فقط نسخه محلی نگه داشته می‌شود (بدون دانلود مزاحم)
        localStorage.setItem('autoBackupCSV', csv);
        localStorage.setItem('lastAutoBackup', new Date().toISOString());
        lastPayload = csv;
        if (showToast) toast('✅ پشتیبان محلی ذخیره شد', true);
      }
    } catch (err) {
      if (showToast) toast('⚠️ پشتیبان ناموفق: ' + (err && err.message ? err.message : err), false);
      console.error(err);
    } finally { running = false; }
  }

  window.backupNow = () => runBackup(true);

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => runBackup(false), 3000);
  }

  function hook() {
    if (typeof window.render === 'function' && !window.render.__hooked) {
      const orig = window.render;
      const wrapped = function () { const out = orig.apply(this, arguments); schedule(); return out; };
      wrapped.__hooked = true;
      window.render = wrapped;
    }
    if (!document.getElementById('nativeBackupBtn')) {
      const btn = document.createElement('button');
      btn.id = 'nativeBackupBtn';
      btn.type = 'button';
      btn.textContent = '⬇️ پشتیبان اکسل';
      btn.className = 'no-print';
      btn.style.cssText = 'position:fixed;bottom:14px;left:14px;z-index:9999;background:#0f766e;color:#fff;border:none;padding:10px 14px;border-radius:999px;font-size:12px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.25);';
      btn.onclick = () => runBackup(true);
      document.body.appendChild(btn);
    }
  }

  // پشتیبان دوره‌ای هر ۱۵ دقیقه
  setInterval(() => runBackup(false), 15 * 60 * 1000);
  // هنگام مینیمایز/بسته شدن اپ
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') runBackup(false); });
  document.addEventListener('DOMContentLoaded', hook);
  window.addEventListener('load', () => { hook(); setTimeout(() => runBackup(false), 6000); });
  hook();
})();
