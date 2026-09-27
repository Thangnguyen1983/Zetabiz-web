/* Điền thông tin doanh nghiệp từ Cài đặt › Doanh nghiệp (settings 'zetabiz_company').
   Trường trống giữ nguyên nội dung mặc định trong trang. */
(function () {
  var URL = 'https://zuucoqfylagcfwnhomet.supabase.co/rest/v1/settings?key=eq.zetabiz_company&select=value';
  var KEY = 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq';
  function apply(v) {
    if (!v || typeof v !== 'object') return;
    document.querySelectorAll('[data-co]').forEach(function (el) {
      var k = el.getAttribute('data-co');
      var val = typeof v[k] === 'string' ? v[k].trim() : '';
      if (!val) return;
      el.textContent = val;
      el.classList.remove('ph');
      if (k === 'email' && el.tagName === 'A') el.href = 'mailto:' + val;
      if (k === 'phone' && el.tagName === 'A') el.href = 'tel:' + val.replace(/[^0-9+]/g, '');
    });
  }
  var ctl = typeof AbortController === 'function' ? new AbortController() : null;
  var t = setTimeout(function () { if (ctl) ctl.abort(); }, 5000);
  fetch(URL, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY }, signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (rows) { if (Array.isArray(rows) && rows[0]) apply(rows[0].value); })
    .catch(function () {})
    .then(function () { clearTimeout(t); });
})();
