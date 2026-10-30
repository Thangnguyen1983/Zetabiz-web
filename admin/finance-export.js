/* Zetabiz Admin – xuất Excel các chứng từ, sổ và báo cáo tài chính theo mẫu.
   Nạp sau app.js, finance.js, xlsx-lite.js.

   Mẫu chứng từ/sổ theo chế độ kế toán chọn trong "Thông tin in chứng từ" (mặc định TT133/2016 cho
   doanh nghiệp nhỏ và vừa; có thể chọn TT99/2025 thay TT200 từ 01/01/2026):
     - Phiếu thu 01-TT, Phiếu chi 02-TT
     - Sổ quỹ tiền mặt S07-DNN (S07-DN), Sổ tiền gửi ngân hàng S08-DNN (S08-DN)
     - Sổ chi tiết thanh toán với người mua (người bán) S13-DNN (S31-DN)
   Cùng các bảng quản trị: bảng kê phiếu, bảng kê công nợ, báo cáo thu – chi, ngân sách, chi phí. */
(function () {
  'use strict';
  const sb = BZ.sb;

  const REG = {
    TT133: { label: 'Thông tư 133/2016/TT-BTC (DN nhỏ và vừa)', note: '(Ban hành theo Thông tư số 133/2016/TT-BTC ngày 26/8/2016 của Bộ Tài chính)', cash: 'S07-DNN', bank: 'S08-DNN', party: 'S13-DNN' },
    TT99: { label: 'Thông tư 99/2025/TT-BTC (thay TT200 từ 01/01/2026)', note: '(Kèm theo Thông tư số 99/2025/TT-BTC ngày 27/10/2025 của Bộ trưởng Bộ Tài chính)', cash: 'S07-DN', bank: 'S08-DN', party: 'S31-DN' }
  };

  /* ---------- Cấu hình in ---------- */
  let CFG = null;
  async function cfg(force) {
    if (CFG && !force) return CFG;
    const r = await sb.from('settings').select('key,value').in('key', ['finance_export', 'zetabiz_company']);
    const m = {}; (r.data || []).forEach(function (x) { m[x.key] = x.value || {}; });
    const c = m.zetabiz_company || {}, f = m.finance_export || {};
    CFG = {
      regime: REG[f.regime] ? f.regime : 'TT133',
      unit_name: f.unit_name || c.name || '', unit_address: f.unit_address || c.address || '', tax_code: f.tax_code || c.tax_code || '',
      director: f.director || '', chief_accountant: f.chief_accountant || '', cashier: f.cashier || '', book_no: f.book_no || ''
    };
    return CFG;
  }
  /* Số TK theo chế độ: TT133 dùng 6421/6422, TT99 (như TT200) dùng 641/642 */
  function gl(code) {
    if (!code) return '';
    if (CFG && CFG.regime === 'TT99') { if (/^6421/.test(code)) return '641'; if (/^6422/.test(code)) return '642'; }
    return code;
  }
  function accGl(id) { const a = FIN.L.byId[id]; return a ? gl(a.gl_account || (a.account_type === 'cash' ? '1111' : '1121')) : ''; }
  function catGl(id) { const c = FIN.L.byId[id]; if (!c) return ''; const p = c.parent_id && FIN.L.byId[c.parent_id]; return gl(c.gl_account || (p && p.gl_account) || ''); }

  /* ---------- Đọc số thành chữ ---------- */
  const DIG = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  function read3(n, full) {
    const tr = Math.floor(n / 100), ch = Math.floor(n % 100 / 10), dv = n % 10, w = [];
    if (full || tr) w.push(DIG[tr], 'trăm');
    if (ch === 0) { if (dv && (full || tr)) w.push('linh'); }
    else if (ch === 1) w.push('mười');
    else w.push(DIG[ch], 'mươi');
    if (dv) {
      if (dv === 1 && ch > 1) w.push('mốt');
      else if (dv === 5 && ch > 0) w.push('lăm');
      else w.push(DIG[dv]);
    }
    return w.join(' ');
  }
  function words(num) {
    let n = Math.round(Math.abs(Number(num) || 0));
    if (!n) return 'Không đồng';
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const groups = []; while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
    const out = [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const g = groups[i];
      if (!g) continue;
      out.push(read3(g, i < groups.length - 1));
      if (units[i]) out.push(units[i]);
    }
    const s = out.join(' ').replace(/\s+/g, ' ').trim() + ' đồng';
    return (Number(num) < 0 ? 'Âm ' : '') + s.charAt(0).toUpperCase() + s.slice(1);
  }

  /* ---------- Tiện ích ---------- */
  function dmy(d) { if (!d) return ''; const x = new Date(d); return String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear(); }
  function dateWords(d) { if (!d) return 'Ngày ..... tháng ..... năm .......'; const x = new Date(d); return 'Ngày ' + String(x.getDate()).padStart(2, '0') + ' tháng ' + String(x.getMonth() + 1).padStart(2, '0') + ' năm ' + x.getFullYear(); }
  function slug(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^\w-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '').slice(0, 60); }
  const MONEY = '#,##0;[Red]-#,##0;0';
  const S = {
    title: { b: true, sz: 15, h: 'center' }, sub: { i: true, h: 'center' }, b: { b: true }, i: { i: true }, c: { h: 'center' },
    th: { b: true, h: 'center', wrap: true, border: true, fill: 'F2F2F2' }, thl: { i: true, h: 'center', border: true, sz: 10 },
    td: { border: true, wrap: true, v: 'top' }, tdc: { border: true, h: 'center', v: 'top' }, num: { border: true, fmt: MONEY, v: 'top' },
    tdb: { border: true, b: true }, numb: { border: true, b: true, fmt: MONEY },
    sign: { b: true, h: 'center', wrap: true }, signn: { i: true, h: 'center', sz: 10 }, signname: { b: true, h: 'center' }
  };

  /* Đầu trang: Đơn vị / Địa chỉ bên trái, Mẫu số bên phải */
  function header(ws, lastCol, formCode, leftSpan) {
    const L = leftSpan || Math.ceil(lastCol / 2);
    ws.merge(1, 1, 1, L, 'Đơn vị: ' + CFG.unit_name, { b: true, wrap: true });
    ws.merge(2, 1, 2, L, 'Địa chỉ: ' + CFG.unit_address, { wrap: true, v: 'top' });
    ws.height(1, 30); ws.height(2, 30);
    if (formCode) {
      ws.merge(1, L + 1, 1, lastCol, 'Mẫu số ' + formCode, { b: true, h: 'center' });
      ws.merge(2, L + 1, 3, lastCol, REG[CFG.regime].note, { i: true, h: 'center', wrap: true, sz: 10, v: 'top' });
    }
  }
  /* Khối chữ ký chia đều theo số cột */
  function signs(ws, row, lastCol, items) {
    const n = items.length, span = Math.floor(lastCol / n), extra = lastCol - span * n;
    let c = 1;
    items.forEach(function (it, i) {
      const w = span + (i < extra ? 1 : 0), c2 = c + w - 1;
      ws.merge(row, c, row, c2, it[0], S.sign);
      ws.merge(row + 1, c, row + 1, c2, it[1] || '(Ký, họ tên)', S.signn);
      ws.merge(row + 5, c, row + 5, c2, it[2] || '', S.signname);
      c = c2 + 1;
    });
    ws.height(row, 30);
    return row + 6;
  }
  function save(wb, name) { wb.download(name + '.xlsx'); BZ.toast('Đã tải ' + name + '.xlsx', 'ok'); }
  async function names(ids) { return FIN.people(ids); }

  /* ================= Phiếu thu 01-TT / Phiếu chi 02-TT ================= */
  async function voucher(tx) {
    await cfg();
    let kind = tx.tx_type;
    /* Chuyển quỹ: tiền mặt ra → phiếu chi, tiền mặt vào → phiếu thu; giữa hai ngân hàng thì dùng giấy báo của ngân hàng */
    if (kind === 'transfer') {
      const src = FIN.L.byId[tx.source_account_id], dst = FIN.L.byId[tx.target_account_id];
      if (src && src.account_type === 'cash') kind = 'payment';
      else if (dst && dst.account_type === 'cash') kind = 'receipt';
      else return BZ.toast('Chuyển tiền giữa hai tài khoản ngân hàng dùng giấy báo Nợ/Có của ngân hàng, không lập phiếu thu/chi.', 'err');
    }
    let debtType = null;
    if (tx.debt_id) { const d = await sb.from('finance_debts').select('debt_type').eq('id', tx.debt_id).maybeSingle(); debtType = d.data && d.data.debt_type; }
    const att = await sb.from('finance_attachments').select('id', { count: 'exact', head: true }).eq('transaction_id', tx.id);
    const who = await names([tx.requested_by]);
    const party = tx.counterparty_id && FIN.L.byId[tx.counterparty_id];
    let no, co;
    if (tx.tx_type === 'transfer') { no = accGl(tx.target_account_id); co = accGl(tx.source_account_id); }
    else if (kind === 'receipt') { no = accGl(tx.target_account_id); co = debtType === 'receivable' ? '131' : catGl(tx.category_id); }
    else { no = debtType === 'payable' ? '331' : catGl(tx.category_id); co = accGl(tx.source_account_id); }
    const recv = kind === 'receipt';
    const amountWords = words(tx.amount);

    const wb = XL.book();
    const N = 10;
    const ws = wb.sheet(recv ? 'Phiếu thu' : 'Phiếu chi', { cols: [9, 9, 9, 9, 9, 9, 9, 9, 9, 10] });
    header(ws, N, recv ? '01 - TT' : '02 - TT', 6);
    ws.merge(5, 3, 5, 7, recv ? 'PHIẾU THU' : 'PHIẾU CHI', S.title); ws.height(5, 24);
    ws.merge(6, 3, 6, 7, dateWords(tx.doc_date), S.sub);
    ws.merge(5, 8, 5, N, 'Quyển số: ' + (CFG.book_no || '..........'));
    ws.merge(6, 8, 6, N, 'Số: ' + tx.tx_code);
    ws.merge(7, 8, 7, N, 'Nợ: ' + (no || '..........'));
    ws.merge(8, 8, 8, N, 'Có: ' + (co || '..........'));
    let r = 10;
    function line(label, value, st) { ws.merge(r, 1, r, N, label + (value || '.....................................................................................'), st || { wrap: true }); r++; }
    line(recv ? 'Họ và tên người nộp tiền: ' : 'Họ và tên người nhận tiền: ', party ? party.name : '');
    line('Địa chỉ: ', party ? party.address : '');
    line(recv ? 'Lý do nộp: ' : 'Lý do chi: ', tx.description); ws.height(r - 1, 33);
    ws.merge(r, 1, r, 2, 'Số tiền:'); ws.set(r, 3, Number(tx.amount), { b: true, fmt: '#,##0' }); ws.merge(r, 4, r, N, 'đồng'); r++;
    line('(Viết bằng chữ): ', amountWords, { i: true, wrap: true }); ws.height(r - 1, 33);
    line('Kèm theo: ', (att.count || 0) + ' chứng từ gốc' + (tx.reference ? ' (số tham chiếu: ' + tx.reference + ')' : ''));
    r++;
    ws.merge(r, 6, r, N, dateWords(tx.paid_at || tx.doc_date), S.sub); r++;
    const people = recv
      ? [['Giám đốc', '(Ký, họ tên, đóng dấu)', CFG.director], ['Kế toán trưởng', '', CFG.chief_accountant], ['Người nộp tiền', '', ''], ['Người lập phiếu', '', who[tx.requested_by] || ''], ['Thủ quỹ', '', CFG.cashier]]
      : [['Giám đốc', '(Ký, họ tên, đóng dấu)', CFG.director], ['Kế toán trưởng', '', CFG.chief_accountant], ['Người lập phiếu', '', who[tx.requested_by] || ''], ['Thủ quỹ', '', CFG.cashier], ['Người nhận tiền', '', '']];
    r = signs(ws, r, N, people) + 1;
    line('Đã nhận đủ số tiền (viết bằng chữ): ', tx.status === 'paid' ? amountWords : '', { wrap: true }); ws.height(r - 1, 33);
    line('+ Tỷ giá ngoại tệ (vàng bạc, đá quý): ', '');
    line('+ Số tiền quy đổi: ', '');
    ws.merge(r, 1, r, N, '(Liên gửi ra ngoài phải đóng dấu)', S.i);
    save(wb, (recv ? 'PhieuThu_' : 'PhieuChi_') + tx.tx_code);
  }

  /* ================= Sổ quỹ tiền mặt / Sổ tiền gửi ngân hàng ================= */
  async function cashBook(accountId, ym) {
    await cfg();
    const a = FIN.L.byId[accountId]; if (!a) return;
    const rg = FIN.monthRange(ym);
    const r0 = await sb.from('finance_transactions').select('id,tx_code,tx_type,doc_date,paid_at,description,amount,source_account_id,target_account_id,counterparty_id,category_id,debt_id')
      .eq('status', 'paid').or('source_account_id.eq.' + a.id + ',target_account_id.eq.' + a.id).lte('doc_date', rg[1]).order('doc_date').order('paid_at').limit(20000);
    if (r0.error) throw r0.error;
    const debtIds = Array.from(new Set(r0.data.map(function (t) { return t.debt_id; }).filter(Boolean)));
    const dt = {};
    if (debtIds.length) { const d = await sb.from('finance_debts').select('id,debt_type').in('id', debtIds); (d.data || []).forEach(function (x) { dt[x.id] = x.debt_type; }); }
    let open0 = Number(a.opening_balance) || 0; const rows = [];
    r0.data.forEach(function (t) {
      const inn = t.target_account_id === a.id ? Number(t.amount) : 0, out = t.source_account_id === a.id ? Number(t.amount) : 0;
      if (t.doc_date < rg[0]) { open0 += inn - out; return; }
      let doiung;
      if (t.tx_type === 'transfer') doiung = accGl(inn ? t.source_account_id : t.target_account_id);
      else if (t.tx_type === 'receipt') doiung = dt[t.debt_id] === 'receivable' ? '131' : catGl(t.category_id);
      else doiung = dt[t.debt_id] === 'payable' ? '331' : catGl(t.category_id);
      const p = FIN.nameOf(t.counterparty_id);
      rows.push({ t: t, inn: inn, out: out, doiung: doiung, desc: (t.description || '') + (p ? ' – ' + p : '') });
    });
    const p = ym.split('-');
    const cash = a.account_type === 'cash';
    const wb = XL.book();
    let ws, r, N;
    if (cash) {
      N = 9;
      ws = wb.sheet('Sổ quỹ tiền mặt', { cols: [11, 11, 17, 17, 36, 15, 15, 16, 9], landscape: true });
      header(ws, N, REG[CFG.regime].cash, 5);
      ws.merge(5, 1, 5, N, 'SỔ QUỸ TIỀN MẶT', S.title);
      ws.merge(6, 1, 6, N, 'Loại quỹ: Tiền Việt Nam – ' + a.name, S.sub);
      ws.merge(7, 1, 7, N, 'Tháng ' + p[1] + ' năm ' + p[0], S.sub);
      ws.merge(8, 8, 8, N, 'Đơn vị tính: đồng', { i: true, h: 'right' });
      ws.merge(9, 1, 10, 1, 'Ngày, tháng ghi sổ', S.th); ws.merge(9, 2, 10, 2, 'Ngày, tháng chứng từ', S.th);
      ws.merge(9, 3, 9, 4, 'Số hiệu chứng từ', S.th); ws.set(10, 3, 'Thu', S.th); ws.set(10, 4, 'Chi', S.th);
      ws.merge(9, 5, 10, 5, 'Diễn giải', S.th); ws.merge(9, 6, 9, 8, 'Số tiền', S.th);
      ws.set(10, 6, 'Thu', S.th); ws.set(10, 7, 'Chi', S.th); ws.set(10, 8, 'Tồn', S.th); ws.merge(9, 9, 10, 9, 'Ghi chú', S.th);
      ['A', 'B', 'C', 'D', 'E', '1', '2', '3', 'G'].forEach(function (x, i) { ws.set(11, i + 1, x, S.thl); });
      r = 12;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 5, 'Số tồn đầu kỳ', S.tdb); ws.set(r, 8, open0, S.numb); const openRow = r; r++;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 5, 'Số phát sinh trong kỳ', { border: true, i: true }); r++;
      const first = r;
      let bal = open0;
      rows.forEach(function (x) {
        bal += x.inn - x.out;
        ws.set(r, 1, dmy(x.t.paid_at || x.t.doc_date), S.tdc); ws.set(r, 2, dmy(x.t.doc_date), S.tdc);
        ws.set(r, 3, x.inn ? x.t.tx_code : '', S.tdc); ws.set(r, 4, x.out ? x.t.tx_code : '', S.tdc);
        ws.set(r, 5, x.desc, S.td); ws.set(r, 6, x.inn || '', S.num); ws.set(r, 7, x.out || '', S.num);
        ws.set(r, 8, { f: 'H' + (r === first ? openRow : r - 1) + '+F' + r + '-G' + r, v: bal }, S.num); ws.set(r, 9, '', S.td);
        r++;
      });
      const last = r - 1, tin = rows.reduce(function (s, x) { return s + x.inn; }, 0), tout = rows.reduce(function (s, x) { return s + x.out; }, 0);
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 5, 'Cộng số phát sinh trong kỳ', S.tdb);
      ws.set(r, 6, rows.length ? { f: 'SUM(F' + first + ':F' + last + ')', v: tin } : 0, S.numb);
      ws.set(r, 7, rows.length ? { f: 'SUM(G' + first + ':G' + last + ')', v: tout } : 0, S.numb); const sumRow = r; r++;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 5, 'Số tồn cuối kỳ', S.tdb); ws.set(r, 8, { f: 'H' + openRow + '+F' + sumRow + '-G' + sumRow, v: open0 + tin - tout }, S.numb); r += 2;
    } else {
      N = 9;
      ws = wb.sheet('Sổ tiền gửi ngân hàng', { cols: [11, 17, 11, 38, 10, 15, 15, 16, 9], landscape: true });
      header(ws, N, REG[CFG.regime].bank, 5);
      ws.merge(5, 1, 5, N, 'SỔ TIỀN GỬI NGÂN HÀNG', S.title);
      ws.merge(6, 1, 6, N, 'Nơi mở tài khoản giao dịch: ' + (a.bank_name || '') + ' · Số hiệu tài khoản tại nơi gửi: ' + (a.account_number || ''), S.sub);
      ws.merge(7, 1, 7, N, 'Loại tiền gửi: VND · Tháng ' + p[1] + ' năm ' + p[0], S.sub);
      ws.merge(8, 8, 8, N, 'Đơn vị tính: đồng', { i: true, h: 'right' });
      ws.merge(9, 1, 10, 1, 'Ngày, tháng ghi sổ', S.th); ws.merge(9, 2, 9, 3, 'Chứng từ', S.th);
      ws.set(10, 2, 'Số hiệu', S.th); ws.set(10, 3, 'Ngày, tháng', S.th);
      ws.merge(9, 4, 10, 4, 'Diễn giải', S.th); ws.merge(9, 5, 10, 5, 'Tài khoản đối ứng', S.th); ws.merge(9, 6, 9, 8, 'Số tiền', S.th);
      ws.set(10, 6, 'Thu (gửi vào)', S.th); ws.set(10, 7, 'Chi (rút ra)', S.th); ws.set(10, 8, 'Còn lại', S.th); ws.merge(9, 9, 10, 9, 'Ghi chú', S.th);
      ws.height(10, 30);
      ['A', 'B', 'C', 'D', 'E', '1', '2', '3', 'F'].forEach(function (x, i) { ws.set(11, i + 1, x, S.thl); });
      r = 12;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 4, 'Số dư đầu kỳ', S.tdb); ws.set(r, 8, open0, S.numb); const openRow = r; r++;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 4, 'Số phát sinh trong kỳ', { border: true, i: true }); r++;
      const first = r; let bal = open0;
      rows.forEach(function (x) {
        bal += x.inn - x.out;
        ws.set(r, 1, dmy(x.t.paid_at || x.t.doc_date), S.tdc); ws.set(r, 2, x.t.tx_code, S.tdc); ws.set(r, 3, dmy(x.t.doc_date), S.tdc);
        ws.set(r, 4, x.desc, S.td); ws.set(r, 5, x.doiung, S.tdc); ws.set(r, 6, x.inn || '', S.num); ws.set(r, 7, x.out || '', S.num);
        ws.set(r, 8, { f: 'H' + (r === first ? openRow : r - 1) + '+F' + r + '-G' + r, v: bal }, S.num); ws.set(r, 9, '', S.td);
        r++;
      });
      const last = r - 1, tin = rows.reduce(function (s, x) { return s + x.inn; }, 0), tout = rows.reduce(function (s, x) { return s + x.out; }, 0);
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 4, 'Cộng số phát sinh trong kỳ', S.tdb);
      ws.set(r, 6, rows.length ? { f: 'SUM(F' + first + ':F' + last + ')', v: tin } : 0, S.numb);
      ws.set(r, 7, rows.length ? { f: 'SUM(G' + first + ':G' + last + ')', v: tout } : 0, S.numb); const sumRow = r; r++;
      for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
      ws.set(r, 4, 'Số dư cuối kỳ', S.tdb); ws.set(r, 8, { f: 'H' + openRow + '+F' + sumRow + '-G' + sumRow, v: open0 + tin - tout }, S.numb); r += 2;
    }
    ws.merge(r, 1, r, N, '- Sổ này có ..... trang, đánh số từ trang 01 đến trang .....'); r++;
    ws.merge(r, 1, r, N, '- Ngày mở sổ: .....................'); r++;
    ws.merge(r, 6, r, N, dateWords(null), S.sub); r++;
    signs(ws, r, N, [['Người ghi sổ'], ['Kế toán trưởng', '', CFG.chief_accountant], ['Người đại diện theo pháp luật', '(Ký, họ tên, đóng dấu)', CFG.director]]);
    save(wb, (cash ? 'SoQuyTienMat_' : 'SoTienGuiNganHang_') + slug(a.name) + '_' + ym);
  }

  /* ================= Sổ chi tiết thanh toán với người mua (người bán) ================= */
  async function partyLedger(partyId, type, from, to) {
    await cfg();
    const party = FIN.L.byId[partyId]; if (!party) return;
    const recv = type === 'receivable';
    const d = await sb.from('finance_debts').select('id,debt_code,issue_date,due_date,original_amount,note,status').eq('counterparty_id', partyId).eq('debt_type', type).neq('status', 'void').lte('issue_date', to).order('issue_date');
    if (d.error) throw d.error;
    const ids = d.data.map(function (x) { return x.id; });
    let al = { data: [] };
    if (ids.length) { al = await sb.from('finance_debt_allocations').select('debt_id,amount,transaction_id').in('debt_id', ids); if (al.error) throw al.error; }
    const txIds = Array.from(new Set(al.data.map(function (x) { return x.transaction_id; })));
    const txs = {};
    if (txIds.length) { const t = await sb.from('finance_transactions').select('id,tx_code,doc_date,paid_at,description,source_account_id,target_account_id').in('id', txIds); (t.data || []).forEach(function (x) { txs[x.id] = x; }); }
    /* Bút toán: phát sinh nợ (Nợ 131 / Có 331) và thanh toán (Có 131 / Nợ 331) */
    const E = [];
    d.data.forEach(function (x) { E.push({ date: x.issue_date, rec: x.issue_date, code: x.debt_code, desc: (x.note || 'Phát sinh công nợ ' + x.debt_code), du: '', due: x.due_date, inc: Number(x.original_amount) }); });
    al.data.forEach(function (x) {
      const t = txs[x.transaction_id] || {};
      E.push({ date: t.doc_date, rec: t.paid_at || t.doc_date, code: t.tx_code || '', desc: (t.description || (recv ? 'Thu tiền' : 'Trả tiền')) + ' (' + ((d.data.find(function (y) { return y.id === x.debt_id; }) || {}).debt_code || '') + ')', du: accGl(recv ? t.target_account_id : t.source_account_id), dec: Number(x.amount) });
    });
    E.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    let open0 = 0; const rows = [];
    E.forEach(function (e) { const v = (e.inc || 0) - (e.dec || 0); if (e.date < from) open0 += v; else if (e.date <= to) rows.push(e); });

    const wb = XL.book(); const N = 11;
    const ws = wb.sheet(recv ? 'Phải thu' : 'Phải trả', { cols: [10, 17, 10, 34, 9, 11, 14, 14, 14, 14, 8], landscape: true });
    header(ws, N, REG[CFG.regime].party, 6);
    ws.merge(5, 1, 5, N, 'SỔ CHI TIẾT THANH TOÁN VỚI ' + (recv ? 'NGƯỜI MUA' : 'NGƯỜI BÁN'), S.title);
    ws.merge(6, 1, 6, N, '(Dùng cho TK: ' + (recv ? '131' : '331') + ')', S.sub);
    ws.merge(7, 1, 7, N, 'Đối tượng: ' + party.name + (party.tax_code ? ' – MST: ' + party.tax_code : ''), S.sub);
    ws.merge(8, 1, 8, N, 'Từ ngày ' + dmy(from) + ' đến ngày ' + dmy(to), S.sub);
    ws.merge(9, 9, 9, N, 'Đơn vị tính: đồng', { i: true, h: 'right' });
    ws.merge(10, 1, 11, 1, 'Ngày, tháng ghi sổ', S.th); ws.merge(10, 2, 10, 3, 'Chứng từ', S.th); ws.set(11, 2, 'Số hiệu', S.th); ws.set(11, 3, 'Ngày, tháng', S.th);
    ws.merge(10, 4, 11, 4, 'Diễn giải', S.th); ws.merge(10, 5, 11, 5, 'TK đối ứng', S.th); ws.merge(10, 6, 11, 6, 'Thời hạn được chiết khấu', S.th);
    ws.merge(10, 7, 10, 8, 'Số phát sinh', S.th); ws.set(11, 7, 'Nợ', S.th); ws.set(11, 8, 'Có', S.th);
    ws.merge(10, 9, 10, 10, 'Số dư', S.th); ws.set(11, 9, 'Nợ', S.th); ws.set(11, 10, 'Có', S.th); ws.merge(10, 11, 11, 11, 'Ghi chú', S.th);
    ws.height(10, 20); ws.height(11, 30);
    ['A', 'B', 'C', 'D', 'E', '1', '2', '3', '4', '5', 'G'].forEach(function (x, i) { ws.set(12, i + 1, x, S.thl); });
    let r = 13;
    function balCells(row, bal) {  // phải thu: dư bên Nợ; phải trả: dư bên Có
      const v = recv ? bal : -bal; // v>0 → dư Nợ
      ws.set(row, 9, v > 0 ? v : '', S.num); ws.set(row, 10, v < 0 ? -v : '', S.num);
    }
    for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
    ws.set(r, 4, 'Số dư đầu kỳ', S.tdb); balCells(r, open0); r++;
    for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
    ws.set(r, 4, 'Số phát sinh trong kỳ', { border: true, i: true }); r++;
    let bal = open0, sn = 0, sc = 0;
    rows.forEach(function (e) {
      bal += (e.inc || 0) - (e.dec || 0);
      const no = recv ? (e.inc || 0) : (e.dec || 0), co = recv ? (e.dec || 0) : (e.inc || 0);
      sn += no; sc += co;
      ws.set(r, 1, dmy(e.rec), S.tdc); ws.set(r, 2, e.code, S.tdc); ws.set(r, 3, dmy(e.date), S.tdc); ws.set(r, 4, e.desc, S.td);
      ws.set(r, 5, e.du, S.tdc); ws.set(r, 6, e.due ? dmy(e.due) : '', S.tdc); ws.set(r, 7, no || '', S.num); ws.set(r, 8, co || '', S.num);
      balCells(r, bal); ws.set(r, 11, '', S.td); r++;
    });
    for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
    ws.set(r, 4, 'Cộng số phát sinh', S.tdb); ws.set(r, 7, sn, S.numb); ws.set(r, 8, sc, S.numb); r++;
    for (let c = 1; c <= N; c++) ws.set(r, c, '', S.td);
    ws.set(r, 4, 'Số dư cuối kỳ', S.tdb); balCells(r, bal); r += 2;
    ws.merge(r, 1, r, N, '- Sổ này có ..... trang, đánh số từ trang 01 đến trang .....'); r++;
    ws.merge(r, 1, r, N, '- Ngày mở sổ: .....................'); r++;
    ws.merge(r, 7, r, N, dateWords(null), S.sub); r++;
    signs(ws, r, N, [['Người ghi sổ'], ['Kế toán trưởng', '', CFG.chief_accountant], ['Người đại diện theo pháp luật', '(Ký, họ tên, đóng dấu)', CFG.director]]);
    save(wb, 'SoChiTiet_' + (recv ? 'PhaiThu_' : 'PhaiTra_') + slug(party.name) + '_' + from + '_' + to);
  }

  /* ================= Bảng quản trị dạng danh sách ================= */
  function table(ws, startRow, heads, widths, rows, totals) {
    heads.forEach(function (t, i) { ws.set(startRow, i + 1, t, S.th); });
    ws.height(startRow, 30);
    let r = startRow + 1;
    rows.forEach(function (row) {
      row.forEach(function (v, i) { ws.set(r, i + 1, v === null || v === undefined ? '' : v, typeof v === 'number' && widths[i] !== 'n' ? S.num : (widths[i] === 'c' ? S.tdc : S.td)); });
      r++;
    });
    if (totals) {
      const first = startRow + 1, last = r - 1;
      totals.forEach(function (t, i) {
        if (t === 'sum') ws.set(r, i + 1, rows.length ? { f: 'SUM(' + XL.colName(i + 1) + first + ':' + XL.colName(i + 1) + last + ')', v: rows.reduce(function (s, row) { return s + (Number(row[i]) || 0); }, 0) } : 0, S.numb);
        else ws.set(r, i + 1, t || '', S.tdb);
      });
      r++;
    }
    return r;
  }
  function titleBlock(ws, N, title, sub) {
    header(ws, N, null, N);
    ws.merge(4, 1, 4, N, title, S.title);
    if (sub) ws.merge(5, 1, 5, N, sub, S.sub);
    ws.merge(6, 1, 6, N, 'Đơn vị tính: đồng · Lập lúc ' + new Date().toLocaleString('vi-VN'), { i: true, h: 'right', sz: 10 });
    return 7;
  }

  async function txList(rows, sub) {
    await cfg();
    const debtIds = Array.from(new Set(rows.map(function (t) { return t.debt_id; }).filter(Boolean)));
    const dt = {};
    if (debtIds.length) { const d = await sb.from('finance_debts').select('id,debt_type').in('id', debtIds); (d.data || []).forEach(function (x) { dt[x.id] = x.debt_type; }); }
    const ST = { draft: 'Nháp', submitted: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Bị từ chối', paid: 'Đã thực hiện', void: 'Đã hủy' };
    const wb = XL.book(); const N = 15;
    const ws = wb.sheet('Bảng kê phiếu', { cols: [5, 11, 17, 10, 36, 26, 7, 7, 18, 22, 16, 14, 14, 12, 14], landscape: true, freezeRow: 7 });
    let r = titleBlock(ws, N, 'BẢNG KÊ PHIẾU THU – CHI', sub);
    const data = rows.map(function (t, i) {
      let no, co;
      if (t.tx_type === 'transfer') { no = accGl(t.target_account_id); co = accGl(t.source_account_id); }
      else if (t.tx_type === 'receipt') { no = accGl(t.target_account_id); co = dt[t.debt_id] === 'receivable' ? '131' : catGl(t.category_id); }
      else { no = dt[t.debt_id] === 'payable' ? '331' : catGl(t.category_id); co = accGl(t.source_account_id); }
      const acc = t.tx_type === 'transfer' ? (FIN.nameOf(t.source_account_id) || '') + ' → ' + (FIN.nameOf(t.target_account_id) || '') : FIN.nameOf(t.target_account_id || t.source_account_id);
      return [i + 1, dmy(t.doc_date), t.tx_code, FIN.TX_TYPE[t.tx_type], t.description || '', FIN.catLabel(t.category_id) || '', no, co, acc || '',
        FIN.nameOf(t.counterparty_id) || '', FIN.nameOf(t.cost_center_id) || '', t.tx_type === 'receipt' ? Number(t.amount) : '', t.tx_type === 'payment' ? Number(t.amount) : '',
        ST[t.status] || t.status, t.reference || ''];
    });
    table(ws, r, ['STT', 'Ngày CT', 'Số phiếu', 'Loại', 'Nội dung', 'Danh mục', 'TK Nợ', 'TK Có', 'Tài khoản tiền', 'Đối tác', 'Mảng', 'Thu', 'Chi', 'Trạng thái', 'Tham chiếu'],
      ['c', 'c', 'c', 'c', '', '', 'c', 'c', '', '', '', '', '', 'c', ''], data, ['', '', '', '', 'Cộng', '', '', '', '', '', '', 'sum', 'sum', '', '']);
    save(wb, 'BangKePhieu_' + FIN.today());
  }

  async function debtList(rows, title) {
    await cfg();
    const ST = { open: 'Chưa thanh toán', partial: 'Thanh toán một phần', paid: 'Đã tất toán', void: 'Đã hủy' };
    const today = FIN.today();
    const wb = XL.book(); const N = 12;
    const ws = wb.sheet('Công nợ', { cols: [5, 17, 10, 28, 14, 11, 11, 15, 15, 15, 10, 16], landscape: true, freezeRow: 7 });
    let r = titleBlock(ws, N, title, 'Tính đến ngày ' + dmy(today));
    const sorted = rows.slice().sort(function (a, b) { return (FIN.nameOf(a.counterparty_id) || '').localeCompare(FIN.nameOf(b.counterparty_id) || '') || String(a.due_date).localeCompare(String(b.due_date)); });
    const data = sorted.map(function (d, i) {
      const late = d.is_overdue ? Math.round((new Date(today) - new Date(d.due_date)) / 864e5) : '';
      const p = FIN.L.byId[d.counterparty_id] || {};
      return [i + 1, d.debt_code, d.debt_type === 'receivable' ? 'Phải thu' : 'Phải trả', p.name || '', p.tax_code || '', dmy(d.issue_date), dmy(d.due_date),
        Number(d.original_amount), Number(d.paid_amount), Number(d.remaining_amount), late, ST[d.status] || d.status];
    });
    table(ws, r, ['STT', 'Mã công nợ', 'Loại', 'Đối tác', 'MST', 'Ngày phát sinh', 'Hạn thanh toán', 'Giá trị', 'Đã thanh toán', 'Còn lại', 'Số ngày quá hạn', 'Trạng thái'],
      ['c', 'c', 'c', '', 'c', 'c', 'c', '', '', '', 'n', 'c'], data, ['', '', '', 'Cộng', '', '', '', 'sum', 'sum', 'sum', '', '']);
    save(wb, slug(title) + '_' + today);
  }

  /* Báo cáo thu – chi quản trị (nhiều trang tính) */
  async function overview(s, rg, trend) {
    await cfg();
    const wb = XL.book();
    const sub = 'Từ ngày ' + dmy(rg[0]) + ' đến ngày ' + dmy(rg[1]);
    let ws = wb.sheet('Tổng hợp', { cols: [6, 44, 20] });
    let r = titleBlock(ws, 3, 'BÁO CÁO THU – CHI QUẢN TRỊ', sub);
    const cash = s.balances.reduce(function (a, b) { return a + Number(b.balance); }, 0);
    r = table(ws, r, ['STT', 'Chỉ tiêu', 'Số tiền'], ['c', '', ''], [
      [1, 'Tổng thu (phiếu thu đã thực hiện)', Number(s.income)], [2, 'Tổng chi (phiếu chi đã thực hiện)', Number(s.expense)],
      [3, 'Chênh lệch thu – chi', Number(s.income) - Number(s.expense)], [4, 'Tiền hiện có (tất cả tài khoản)', cash],
      [5, 'Phải thu còn lại', Number(s.debts.receivable)], [6, '  Trong đó quá hạn', Number(s.debts.receivable_overdue)],
      [7, 'Phải trả còn lại', Number(s.debts.payable)], [8, '  Trong đó quá hạn', Number(s.debts.payable_overdue)],
      [9, 'Đơn hàng chờ khách thanh toán', Number(s.debts.orders_unpaid)], [10, 'Phiếu chờ duyệt', Number(s.pending.submitted_amount)]]);
    ws.merge(r + 1, 1, r + 1, 3, 'Ghi chú: báo cáo quản trị nội bộ theo dòng tiền thực thu, thực chi; không thay thế báo cáo tài chính theo quy định.', { i: true, sz: 10, wrap: true });
    ws.height(r + 1, 30);

    ws = wb.sheet('Theo tháng', { cols: [12, 18, 18, 18] });
    r = titleBlock(ws, 4, 'THU – CHI THEO THÁNG', 'Sáu tháng tính đến cuối kỳ');
    table(ws, r, ['Tháng', 'Thu', 'Chi', 'Chênh lệch'], ['c', '', '', ''],
      trend.map(function (m) { return [m.label, m.income, m.expense, m.income - m.expense]; }), ['Cộng', 'sum', 'sum', 'sum']);

    ws = wb.sheet('Theo danh mục', { cols: [10, 40, 18] });
    r = titleBlock(ws, 3, 'THU – CHI THEO NHÓM DANH MỤC', sub);
    table(ws, r, ['Loại', 'Nhóm danh mục', 'Số tiền'], ['c', '', ''],
      s.by_category.map(function (c) { return [c.type === 'receipt' ? 'Thu' : 'Chi', c.root, Number(c.amount)]; }));

    ws = wb.sheet('Theo mảng', { cols: [32, 18, 18, 18] });
    r = titleBlock(ws, 4, 'LÃI LỖ THEO MẢNG / BỘ PHẬN', sub);
    table(ws, r, ['Mảng', 'Thu', 'Chi', 'Lãi / lỗ'], ['', '', '', ''],
      s.by_center.map(function (c) { return [c.name, Number(c.income), Number(c.expense), Number(c.income) - Number(c.expense)]; }), ['Cộng', 'sum', 'sum', 'sum']);

    ws = wb.sheet('Số dư tài khoản', { cols: [32, 14, 20] });
    r = titleBlock(ws, 3, 'SỐ DƯ TÀI KHOẢN TIỀN', 'Tại thời điểm lập báo cáo');
    table(ws, r, ['Tài khoản', 'Loại', 'Số dư'], ['', 'c', ''],
      s.balances.map(function (b) { return [b.name, FIN.ACC_TYPE[b.type] || '', Number(b.balance)]; }), ['Cộng', '', 'sum']);
    save(wb, 'BaoCaoThuChi_' + rg[0] + '_' + rg[1]);
  }

  async function budgets(rows, sub) {
    await cfg();
    const PT = { month: 'Tháng', quarter: 'Quý', year: 'Năm' };
    const wb = XL.book(); const N = 10;
    const ws = wb.sheet('Ngân sách', { cols: [5, 30, 9, 11, 11, 26, 16, 16, 16, 9], landscape: true });
    const r = titleBlock(ws, N, 'BÁO CÁO THỰC HIỆN NGÂN SÁCH CHI PHÍ', sub);
    table(ws, r, ['STT', 'Ngân sách', 'Theo', 'Từ ngày', 'Đến ngày', 'Danh mục / mảng', 'Ngân sách', 'Đã chi', 'Còn lại', '% dùng'], ['c', '', 'c', 'c', 'c', '', '', '', '', 'n'],
      rows.map(function (b, i) {
        return [i + 1, b.name, PT[b.period_type] || '', dmy(b.period_start), dmy(b.period_end), (FIN.catLabel(b.category_id) || 'Mọi khoản chi') + ' / ' + (FIN.nameOf(b.cost_center_id) || 'Mọi mảng'),
          Number(b.amount), Number(b.actual_amount), Number(b.amount) - Number(b.actual_amount), Math.round(Number(b.actual_amount) / Number(b.amount) * 100) + '%'];
      }), ['', 'Cộng', '', '', '', '', 'sum', 'sum', 'sum', '']);
    save(wb, 'NganSach_' + FIN.today());
  }

  async function costs(rows, sub, fileTag) {
    await cfg();
    const wb = XL.book();
    const ws = wb.sheet('Chi phí', { cols: [44, 18, 10, 18, 14] });
    const r = titleBlock(ws, 5, 'BẢNG CHI PHÍ THEO DANH MỤC', sub);
    table(ws, r, ['Danh mục', 'Kỳ này', 'Tỷ trọng', 'Kỳ trước', 'Thay đổi'], ['', '', 'n', '', 'n'],
      rows.map(function (x) { return [(x.root ? '' : '    ') + x.name, x.a, x.pct, x.b, x.delta]; }));
    save(wb, 'ChiPhiTheoDanhMuc_' + fileTag);
  }

  window.FX = { REG: REG, cfg: cfg, words: words, voucher: voucher, cashBook: cashBook, partyLedger: partyLedger, txList: txList, debtList: debtList, overview: overview, budgets: budgets, costs: costs, gl: gl };
})();
