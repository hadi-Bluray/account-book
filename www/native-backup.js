/* پشتیبان‌گیری خودکار در پوشه Downloads به صورت فایل CSV (قابل باز شدن با اکسل) */
(function () {
  const FOLDER = 'MaghazeBackup';
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const FS = () => (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null;

  function todayStamp() {
    try { return (window.getTodayShamsi ? window.getTodayShamsi() : '').replace(/\//g, '-'); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  }

  function csvCell(v) {
    const s = String(v == null ? '' : v).replace(/"/g, '""');
    return '"' + s + '"';
  }

  function buildCSV() {
    const entries = (window.__getEntries ? window.__getEntries() : []) || [];
    const headers = ['ردیف', 'گروه', 'نام کالا یا عنوان', 'نوع', 'مبلغ (تومان)', 'تاریخ (شمسی)', 'توضیحات'];
    let totalIn = 0, totalOut = 0;
    let csv = '\uFEFF' + headers.map(csvCell).join(',') + '\r\n';
    entries.forEach((e, i) => {
      if (e.type === 'ورود' || e.type === 'دریافت روزانه') totalIn += Number(e.price) || 0;
      else if (e.type === 'خروج') totalOut += Number(e.price) || 0;
      csv += [i + 1, e.category, e.name, e.type, Number(e.price) || 0, e.date, e.note || ''].map(csvCell).join(',') + '\r\n';
    });
    csv += '\r\n';
    csv += [csvCell(''), csvCell('کل دریافتی'), csvCell(totalIn), csvCell('کل هزینه'), csvCell(totalOut), csvCell('موجودی'), csvCell(totalIn - totalOut)].join(',') + '\r\n';
    return csv;
  }

  function buildJSON() {
    return JSON.stringify({
      entries: (window.__getEntries ? window.__getEntries() : []) || [],
      idCounter: window.__getIdCounter ? window.__getIdCounter() : 0,
      savedAt: new Date().toISOString(),
    }, null, 2);
  }

  // مسیرهای پشتیبان به ترتیب اولویت: پوشه دانلودها → اسناد → حافظه اپ
  const TARGETS = [
    { directory: 'EXTERNAL_STORAGE', prefix: 'Download/' + FOLDER + '/', label: 'Download/' + FOLDER },
    { directory: 'DOCUMENTS', prefix: FOLDER + '/', label: 'Documents/' + FOLDER },
    { directory: 'EXTERNAL', prefix: FOLDER + '/', label: 'حافظه اپ/' + FOLDER },
  ];

  async function writeToDevice(name, data) {
    const fs = FS();
    if (!fs) throw new Error('پلاگین فایل در دسترس نیست');
    let lastErr;
    for (const t of TARGETS) {
      try {
        await fs.writeFile({
          path: t.prefix + name,
          data: data,
          directory: t.directory,
          encoding: 'utf8',
          recursive: true,
        });
        return t.label;
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('نوشتن فایل ناموفق بود');
  }

  function browserDownload(name, data, mime) {
    const blob = new Blob([data], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  }

  function toast(msg, ok) {
    let el = document.getElementById('backupToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backupToast';
      el.style.cssText = 'position:fixed;bottom:14px;left:50%;transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:92vw;text-align:center;';
      document.body.appendChild(el);
    }
    el.style.background = ok ? '#065f46' : '#7f1d1d';
    el.style.color = '#fff';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 2600);
  }

  let timer = null, running = false;

  async function runBackup(showToast) {
    if (running) return;
    running = true;
    const stamp = todayStamp();
    const csvName = `گزارش_مغازه_${stamp}.csv`;
    const jsonName = `پشتیبان_مغازه_${stamp}.json`;
    try {
      if (isNative()) {
        const where = await writeToDevice(csvName, buildCSV());
        await writeToDevice(jsonName, buildJSON());
        localStorage.setItem('lastAutoBackup', new Date().toISOString());
        if (showToast) toast('✅ پشتیبان ذخیره شد: ' + where + '/' + csvName, true);
      } else {
        browserDownload(csvName, buildCSV(), 'text/csv;charset=utf-8;');
        if (showToast) toast('✅ فایل CSV در پوشه دانلودها ذخیره شد', true);
      }
    } catch (err) {
      if (showToast) toast('⚠️ ذخیره پشتیبان ناموفق: ' + (err && err.message ? err.message : err), false);
      console.error(err);
    } finally {
      running = false;
    }
  }

  window.backupNow = () => runBackup(true);

  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => runBackup(false), 2500);
  }

  function hook() {
    if (typeof window.render === 'function' && !window.render.__hooked) {
      const orig = window.render;
      const wrapped = function () {
        const out = orig.apply(this, arguments);
        schedule();
        return out;
      };
      wrapped.__hooked = true;
      window.render = wrapped;
    }
    // دکمه پشتیبان دستی
    if (!document.getElementById('nativeBackupBtn')) {
      const btn = document.createElement('button');
      btn.id = 'nativeBackupBtn';
      btn.type = 'button';
      btn.textContent = '⬇️ پشتیبان اکسل';
      btn.className = 'no-print';
      btn.style.cssText = 'position:fixed;bottom:14px;right:14px;z-index:9999;background:#0f766e;color:#fff;border:none;padding:10px 14px;border-radius:999px;font-size:13px;font-weight:800;box-shadow:0 6px 18px rgba(0,0,0,.25);';
      btn.onclick = () => runBackup(true);
      document.body.appendChild(btn);
    }
  }

  document.addEventListener('DOMContentLoaded', hook);
  window.addEventListener('load', hook);
  hook();
})();
