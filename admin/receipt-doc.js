/* Chứng từ xác nhận thanh toán – dùng chung cho trang quản trị và cổng khách hàng.
   RECEIPT.print(r) mở bản in; RECEIPT.excel(r) tải file Excel (cần xlsx-lite.js).
   r: một dòng payment_receipts. Thông tin đơn vị lấy từ settings 'zetabiz_company' (công khai). */
(function () {
  'use strict';
  const sb = window.zbSb;
  let CO = null;
  async function company() {
    if (CO) return CO;
    const r = await sb.from('settings').select('value').eq('key', 'zetabiz_company').maybeSingle();
    CO = (r.data && r.data.value) || {};
    return CO;
  }
  const nf = new Intl.NumberFormat('vi-VN');
  const money = function (n) { return nf.format(Math.round(Number(n) || 0)) + ' đ'; };
  const dmy = function (d) { if (!d) return ''; const x = new Date(d); return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear(); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  function words(n) { return window.FX ? window.FX.words(n) : ''; }

  async function print(r) {
    const c = await company();
    const w = window.open('', '_blank');
    if (!w) return alert('Trình duyệt chặn cửa sổ in. Cho phép cửa sổ bật lên rồi thử lại.');
    const rows = [['Khách hàng', r.customer_name], ['Mã số thuế', r.customer_tax_code], ['Email', r.customer_email], ['Dịch vụ', [r.product_name, r.plan_name].filter(Boolean).join(' – ')],
      ['Mã đơn hàng', r.order_code], ['Nội dung chuyển khoản', r.payment_reference]].filter(function (x) { return x[1]; });
    w.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Chứng từ ' + esc(r.receipt_code) + '</title><style>' +
      'body{font:14px/1.6 "Times New Roman",serif;color:#000;max-width:720px;margin:32px auto;padding:0 24px}h1{text-align:center;font-size:20px;margin:24px 0 4px}' +
      '.c{text-align:center}.i{font-style:italic}table{width:100%;border-collapse:collapse;margin:16px 0}td,th{border:1px solid #000;padding:6px 10px}th{background:#f2f2f2}' +
      '.r{text-align:right}.kv td{border:0;padding:3px 0}.sig{display:flex;justify-content:space-between;margin-top:36px;text-align:center}.sig div{width:45%}' +
      '.void{color:#b00;font-weight:bold;text-align:center;font-size:18px;border:2px solid #b00;padding:6px;margin:12px 0}@media print{body{margin:0}}</style></head><body>' +
      '<div><b>' + esc(c.name) + '</b><br>Địa chỉ: ' + esc(c.address) + (c.tax_code ? '<br>MST: ' + esc(c.tax_code) : '') + (c.phone ? ' · ĐT: ' + esc(c.phone) : '') + '</div>' +
      '<h1>CHỨNG TỪ XÁC NHẬN THANH TOÁN</h1><div class="c i">Số: ' + esc(r.receipt_code) + ' · Ngày ' + dmy(r.receipt_date) + '</div>' +
      (r.status === 'cancelled' ? '<div class="void">ĐÃ HỦY' + (r.cancel_reason ? ' – ' + esc(r.cancel_reason) : '') + '</div>' : '') +
      '<table class="kv">' + rows.map(function (x) { return '<tr><td style="width:190px">' + esc(x[0]) + ':</td><td><b>' + esc(x[1]) + '</b></td></tr>'; }).join('') + '</table>' +
      '<table><tr><th>Nội dung</th><th class="r">Số tiền</th></tr>' +
      '<tr><td>Tiền dịch vụ ' + esc([r.product_name, r.plan_name].filter(Boolean).join(' – ')) + '</td><td class="r">' + money(r.subtotal_amount) + '</td></tr>' +
      '<tr><td>Thuế GTGT (' + (r.tax_rate || 0) + '%)</td><td class="r">' + money(r.tax_amount) + '</td></tr>' +
      '<tr><th style="text-align:left">Tổng cộng đã thanh toán</th><th class="r">' + money(r.total_amount) + '</th></tr></table>' +
      (words(r.total_amount) ? '<div class="i">Bằng chữ: ' + esc(words(r.total_amount)) + '</div>' : '') +
      '<p class="i" style="font-size:13px">Chứng từ này xác nhận ' + esc(c.name) + ' đã nhận đủ số tiền trên. Hóa đơn GTGT (nếu có) được phát hành riêng theo quy định.</p>' +
      '<div class="sig"><div><b>Khách hàng</b><br><span class="i">(Ký, ghi rõ họ tên)</span></div><div><b>Đại diện ' + esc(c.name) + '</b><br><span class="i">(Ký, họ tên, đóng dấu)</span></div></div>' +
      '<script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  async function excel(r) {
    if (!window.XL) return;
    const c = await company();
    const wb = XL.book();
    const ws = wb.sheet('Chứng từ', { cols: [26, 34, 18] });
    const S = { b: { b: true }, t: { b: true, sz: 15, h: 'center' }, s: { i: true, h: 'center' }, th: { b: true, border: true, fill: 'F2F2F2', h: 'center' }, td: { border: true, wrap: true }, n: { border: true, fmt: '#,##0' }, nb: { border: true, b: true, fmt: '#,##0' } };
    ws.merge(1, 1, 1, 3, c.name || '', S.b); ws.merge(2, 1, 2, 3, 'Địa chỉ: ' + (c.address || '')); ws.merge(3, 1, 3, 3, 'MST: ' + (c.tax_code || '') + (c.phone ? ' · ĐT: ' + c.phone : ''));
    ws.merge(5, 1, 5, 3, 'CHỨNG TỪ XÁC NHẬN THANH TOÁN', S.t); ws.merge(6, 1, 6, 3, 'Số: ' + r.receipt_code + ' · Ngày ' + dmy(r.receipt_date), S.s);
    let row = 8;
    if (r.status === 'cancelled') { ws.merge(row, 1, row, 3, 'ĐÃ HỦY' + (r.cancel_reason ? ' – ' + r.cancel_reason : ''), { b: true, color: 'B00000', h: 'center' }); row += 2; }
    [['Khách hàng', r.customer_name], ['Mã số thuế', r.customer_tax_code], ['Email', r.customer_email], ['Dịch vụ', [r.product_name, r.plan_name].filter(Boolean).join(' – ')], ['Mã đơn hàng', r.order_code], ['Nội dung chuyển khoản', r.payment_reference]]
      .forEach(function (x) { if (!x[1]) return; ws.set(row, 1, x[0] + ':'); ws.merge(row, 2, row, 3, x[1], S.b); row++; });
    row++;
    ws.merge(row, 1, row, 2, 'Nội dung', S.th); ws.set(row, 3, 'Số tiền', S.th); row++;
    ws.merge(row, 1, row, 2, 'Tiền dịch vụ', S.td); ws.set(row, 3, Number(r.subtotal_amount) || 0, S.n); row++;
    ws.merge(row, 1, row, 2, 'Thuế GTGT (' + (r.tax_rate || 0) + '%)', S.td); ws.set(row, 3, Number(r.tax_amount) || 0, S.n); row++;
    ws.merge(row, 1, row, 2, 'Tổng cộng đã thanh toán', { border: true, b: true }); ws.set(row, 3, Number(r.total_amount) || 0, S.nb); row += 2;
    if (words(r.total_amount)) { ws.merge(row, 1, row, 3, 'Bằng chữ: ' + words(r.total_amount), { i: true, wrap: true }); row += 2; }
    ws.merge(row, 1, row, 3, 'Hóa đơn GTGT (nếu có) được phát hành riêng theo quy định.', { i: true, sz: 10 }); row += 2;
    ws.set(row, 1, 'Khách hàng', { b: true, h: 'center' }); ws.merge(row, 2, row, 3, 'Đại diện ' + (c.name || ''), { b: true, h: 'center', wrap: true });
    ws.set(row + 1, 1, '(Ký, ghi rõ họ tên)', { i: true, h: 'center', sz: 10 }); ws.merge(row + 1, 2, row + 1, 3, '(Ký, họ tên, đóng dấu)', { i: true, h: 'center', sz: 10 });
    wb.download('ChungTu_' + r.receipt_code + '.xlsx');
  }

  window.RECEIPT = { print: print, excel: excel };
})();
