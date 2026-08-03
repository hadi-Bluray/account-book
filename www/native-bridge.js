/* پل ارتباطی با اندروید: دانلود JSON، خروجی CSV و فاکتور/PDF داخل اپ */
(function () {
  const FOLDER = 'MaghazeBackup';
  const isNative = () => !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const P = () => (window.Capacitor && window.Capacitor.Plugins) || {};
  const FS = () => P().Filesystem || null;
  const SH = () => P().Share || null;

  function toast(msg, ok) {
    let el = document.getElementById('backupToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'backupToast';
      el.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:99999;padding:10px 16px;border-radius:12px;font-size:13px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.2);max-width:92vw;text-align:center;transition:opacity .3s;';
      document.body.appendChild(el);
    }
    el.style.background = ok ? '#065f46' : '#7f1d1d';
    el.style.color = '#fff';
    el.textContent = msg;
    el.style.opacity = '1';
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.opacity = '0'; }, 3200);
  }
  window.__toast = toast;

  const TARGETS = [
    { directory: 'EXTERNAL_STORAGE', prefix: 'Download/' + FOLDER + '/', label: 'Download/' + FOLDER },
    { directory: 'DOCUMENTS', prefix: FOLDER + '/', label: 'Documents/' + FOLDER },
    { directory: 'EXTERNAL', prefix: FOLDER + '/', label: 'حافظه اپ/' + FOLDER },
  ];

  async function ensurePermission() {
    const fs = FS();
    if (!fs || !fs.checkPermissions) return;
    try {
      const st = await fs.checkPermissions();
      if (st && st.publicStorage !== 'granted' && fs.requestPermissions) await fs.requestPermissions();
    } catch (e) { /* روی اندروید جدید لازم نیست */ }
  }

  /* نوشتن فایل روی حافظه دستگاه؛ خروجی: {label, uri} */
  async function writeToDevice(name, data) {
    const fs = FS();
    if (!fs) throw new Error('پلاگین فایل نصب نیست');
    await ensurePermission();
    let lastErr;
    for (const t of TARGETS) {
      try {
        const res = await fs.writeFile({
          path: t.prefix + name,
          data: data,
          directory: t.directory,
          encoding: 'utf8',
          recursive: true,
        });
        return { label: t.label, uri: (res && res.uri) || '' };
      } catch (err) { lastErr = err; }
    }
    throw lastErr || new Error('نوشتن فایل ناموفق بود');
  }
  window.__writeToDevice = writeToDevice;

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

  /* ذخیره + پیشنهاد اشتراک‌گذاری/باز کردن فایل */
  async function saveFile(name, data, mime, shareTitle) {
    if (!isNative()) { browserDownload(name, data, mime); toast('✅ فایل در پوشه دانلودها ذخیره شد', true); return; }
    try {
      const res = await writeToDevice(name, data);
      toast('✅ ذخیره شد: ' + res.label + '/' + name, true);
      const sh = SH();
      if (sh && res.uri) {
        try { await sh.share({ title: shareTitle || name, url: res.uri, dialogTitle: 'اشتراک‌گذاری / باز کردن فایل' }); }
        catch (e) { /* کاربر لغو کرد */ }
      }
    } catch (err) {
      toast('⚠️ ذخیره ناموفق: ' + (err && err.message ? err.message : err), false);
    }
  }
  window.__saveFile = saveFile;

  const stamp = () => {
    try { return (window.getTodayShamsi ? window.getTodayShamsi() : '').replace(/\//g, '-') || new Date().toISOString().slice(0, 10); }
    catch (e) { return new Date().toISOString().slice(0, 10); }
  };
  const cell = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const num = (v) => Number(v) || 0;
  const fmt = (v) => (window.formatNumberWithCommas ? window.formatNumberWithCommas(num(v)) : String(num(v)));

  function getEntries() { return (window.__getEntries ? window.__getEntries() : []) || []; }

  function buildCSV() {
    const entries = getEntries();
    const headers = ['ردیف', 'گروه', 'نام کالا یا عنوان', 'نوع', 'مبلغ (تومان)', 'تاریخ (شمسی)', 'توضیحات'];
    let inSum = 0, outSum = 0;
    let csv = '\uFEFF' + headers.map(cell).join(',') + '\r\n';
    entries.forEach((e, i) => {
      if (e.type === 'خروج') outSum += num(e.price); else inSum += num(e.price);
      csv += [i + 1, e.category, e.name, e.type, num(e.price), e.date, e.note || ''].map(cell).join(',') + '\r\n';
    });
    csv += '\r\n' + [cell(''), cell('کل دریافتی'), cell(inSum), cell('کل هزینه'), cell(outSum), cell('موجودی'), cell(inSum - outSum)].join(',') + '\r\n';
    return csv;
  }
  window.__buildCSV = buildCSV;

  function buildJSON() {
    return JSON.stringify({
      entries: getEntries(),
      idCounter: window.__getIdCounter ? window.__getIdCounter() : 0,
      version: '3.7',
      savedAt: new Date().toISOString(),
    }, null, 2);
  }
  window.__buildJSON = buildJSON;

  /* فاکتور: یک فایل HTML قابل باز شدن و چاپ/PDF در گوشی */
  function buildInvoiceHTML() {
    const entries = getEntries();
    let inSum = 0, outSum = 0;
    const rows = entries.map((e, i) => {
      if (e.type === 'خروج') outSum += num(e.price); else inSum += num(e.price);
      return `<tr><td>${i + 1}</td><td>${e.name || ''}</td><td>${e.category || ''}</td><td>${e.type || ''}</td><td>${fmt(e.price)}</td><td>${e.date || ''}</td><td>${e.note || ''}</td></tr>`;
    }).join('');
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>فاکتور مغازه ${stamp()}</title>
<style>
body{font-family:Tahoma,sans-serif;padding:16px;color:#111}
h1{text-align:center;font-size:20px;margin:0 0 4px}
.sub{text-align:center;font-size:12px;color:#555;margin-bottom:14px}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #999;padding:6px;text-align:right}
th{background:#eee}
.sum{margin-top:14px;font-size:13px;font-weight:bold;display:flex;flex-wrap:wrap;gap:14px;justify-content:space-between}
@media print{body{padding:0}}
</style></head><body>
<h1>صورتحساب و گزارش مالی مغازه</h1>
<div class="sub">تاریخ گزارش: ${stamp()}</div>
<table><thead><tr><th>#</th><th>عنوان</th><th>گروه</th><th>نوع</th><th>مبلغ (تومان)</th><th>تاریخ</th><th>توضیحات</th></tr></thead><tbody>${rows}</tbody></table>
<div class="sum"><span>کل دریافتی: ${fmt(inSum)}</span><span>کل هزینه: ${fmt(outSum)}</span><span>موجودی: ${fmt(inSum - outSum)} تومان</span></div>
<script>setTimeout(function(){try{window.print()}catch(e){}},600)<\/script>
</body></html>`;
  }

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  /* جایگزینی دکمه‌های بالا با نسخه سازگار با اندروید */
  ready(function () {
    if (getEntries().length === 0 && !window.__getEntries) return;

    window.exportCSV = function () {
      if (getEntries().length === 0) { toast('هیچ داده‌ای برای خروجی نیست', false); return; }
      saveFile(`گزارش_مغازه_${stamp()}.csv`, buildCSV(), 'text/csv;charset=utf-8;', 'گزارش CSV مغازه');
    };

    window.manualBackup = function () {
      if (getEntries().length === 0) { toast('هیچ اطلاعاتی برای ذخیره نیست', false); return; }
      saveFile(`مغازه_داده‌ها_${stamp()}.json`, buildJSON(), 'application/json', 'پشتیبان مغازه');
    };

    window.printInvoice = function () {
      const html = buildInvoiceHTML();
      if (!isNative()) { window.print(); return; }
      saveFile(`فاکتور_مغازه_${stamp()}.html`, html, 'text/html', 'فاکتور مغازه');
    };
    // دکمه «فاکتور / PDF» در اندروید به printInvoice وصل می‌شود
    document.querySelectorAll('button').forEach((b) => {
      if ((b.getAttribute('onclick') || '').indexOf('window.print()') !== -1) {
        b.setAttribute('onclick', 'printInvoice()');
        b.onclick = () => window.printInvoice();
      }
    });
  });
})();
