/* Zetabiz Admin – phần dùng chung cho các trang Tài chính.
   Nạp SAU /admin/app.js. Mọi quy tắc nghiệp vụ (trạng thái phiếu, ai được duyệt, không tự duyệt phiếu
   của mình, phân bổ công nợ…) nằm ở trigger trong database; ở đây chỉ hiển thị đúng nút cho đúng người
   và nói lỗi bằng tiếng Việt. */
(function () {
  'use strict';
  const h = BZ.h, fmt = BZ.fmt, sb = BZ.sb;

  /* ---------- Nhãn ---------- */
  const TX_STATUS = {
    draft: ['Nháp', 'info'], submitted: ['Chờ duyệt', 'warn'], approved: ['Đã duyệt – chờ thực hiện', 'blue'],
    rejected: ['Bị từ chối', 'bad'], paid: ['Đã thực hiện', 'ok'], void: ['Đã hủy', 'bad']
  };
  const TX_TYPE = { receipt: 'Phiếu thu', payment: 'Phiếu chi', transfer: 'Chuyển quỹ' };
  const ACC_TYPE = { cash: 'Tiền mặt', bank: 'Ngân hàng', wallet: 'Ví điện tử' };
  const DEBT_STATUS = { open: ['Chưa thanh toán', 'warn'], partial: ['Thanh toán một phần', 'blue'], paid: ['Đã tất toán', 'ok'], void: ['Đã hủy', 'bad'] };
  const PARTY_TYPE = { customer: 'Khách hàng', supplier: 'Nhà cung cấp', staff: 'Nhân viên', other: 'Khác' };
  const CENTER_TYPE = { product: 'Sản phẩm', project: 'Dự án', department: 'Bộ phận', campaign: 'Chiến dịch' };

  function chipOf(map, v) { const m = map[v] || [v || '—', 'info']; return h('span', { class: 'chip ' + m[1] }, m[0]); }
  function txChip(tx) {
    if (tx.status === 'paid') return h('span', { class: 'chip ok' }, tx.tx_type === 'receipt' ? 'Đã thu' : tx.tx_type === 'payment' ? 'Đã chi' : 'Đã chuyển');
    if (tx.status === 'approved') return h('span', { class: 'chip blue' }, tx.tx_type === 'receipt' ? 'Đã duyệt – chờ thu' : tx.tx_type === 'payment' ? 'Đã duyệt – chờ chi' : 'Đã duyệt – chờ chuyển');
    return chipOf(TX_STATUS, tx.status);
  }

  /* ---------- Tiền ---------- */
  const nf = new Intl.NumberFormat('vi-VN');
  function vnd(n) { return n === null || n === undefined ? '—' : nf.format(Math.round(Number(n))) + ' đ'; }
  /* Rút gọn cho ô KPI và trục biểu đồ: 12,5 tr · 1,2 tỷ */
  function short(n) {
    const v = Math.abs(Number(n) || 0), s = Number(n) < 0 ? '−' : '';
    if (v >= 1e9) return s + (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
    if (v >= 1e6) return s + (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
    if (v >= 1e3) return s + (v / 1e3).toLocaleString('vi-VN', { maximumFractionDigits: 0 }) + ' k';
    return s + nf.format(v);
  }
  /* Ô nhập tiền: gõ số, tự chèn dấu chấm phân cách nghìn */
  function moneyInput(value) {
    const el = h('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: '0' });
    function show(n) { el.value = n ? nf.format(n) : ''; }
    show(value);
    el.addEventListener('input', function () {
      const digits = el.value.replace(/\D/g, '').slice(0, 15);
      show(digits ? Number(digits) : 0);
    });
    el.amount = function () { return Number(el.value.replace(/\D/g, '')) || 0; };
    return el;
  }

  /* ---------- Ngày ---------- */
  function iso(d) { const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return z.toISOString().slice(0, 10); }
  function today() { return iso(new Date()); }
  function monthRange(ym) { const p = ym.split('-').map(Number); return [iso(new Date(p[0], p[1] - 1, 1)), iso(new Date(p[0], p[1], 0))]; }
  function thisMonth() { return today().slice(0, 7); }
  function dateInput(v) { return h('input', { type: 'date', value: v || today() }); }

  /* ---------- Danh mục tra cứu (nạp một lần mỗi trang, gọi lại sau khi thêm mới) ---------- */
  const L = { accounts: [], categories: [], centers: [], parties: [], byId: {} };
  async function loadLookups() {
    const r = await Promise.all([
      sb.from('finance_accounts').select('*').order('account_type').order('name'),
      sb.from('finance_account_balances').select('account_id,current_balance'),
      sb.from('finance_categories').select('*').order('kind').order('sort_order').order('code'),
      sb.from('finance_cost_centers').select('*').order('center_type').order('name'),
      sb.from('finance_counterparties').select('*').order('name')
    ]);
    r.forEach(function (x) { if (x.error) throw x.error; });
    const bal = {}; r[1].data.forEach(function (b) { bal[b.account_id] = Number(b.current_balance); });
    L.accounts = r[0].data.map(function (a) { a.balance = bal[a.id] || 0; return a; });
    L.categories = r[2].data; L.centers = r[3].data; L.parties = r[4].data;
    L.byId = {};
    [L.accounts, L.categories, L.centers, L.parties].forEach(function (list) { list.forEach(function (x) { L.byId[x.id] = x; }); });
    return L;
  }
  function nameOf(id) { const x = id && L.byId[id]; return x ? x.name : null; }
  /* Tên danh mục kèm danh mục cha: "Vận hành & hạ tầng › Hosting" */
  function catLabel(id) {
    const c = id && L.byId[id]; if (!c) return null;
    const p = c.parent_id && L.byId[c.parent_id];
    return p ? p.name + ' › ' + c.name : c.name;
  }

  function opt(v, label, sel) { return h('option', { value: v, selected: sel ? true : null }, label); }
  function selectEl(items, value, emptyLabel) {
    const s = h('select', null, emptyLabel !== undefined ? opt('', emptyLabel, !value) : null,
      items.map(function (i) { return opt(i.value, i.label, i.value === value); }));
    return s;
  }
  function accountItems(includeInactive) {
    return L.accounts.filter(function (a) { return includeInactive || a.is_active; })
      .map(function (a) { return { value: a.id, label: a.name + ' · ' + (ACC_TYPE[a.account_type] || '') }; });
  }
  /* Danh mục theo loại, nhóm theo danh mục cha bằng optgroup */
  function categorySelect(kind, value) {
    const s = h('select', null, opt('', '— Chọn danh mục —', !value));
    const roots = L.categories.filter(function (c) { return c.kind === kind && !c.parent_id && (c.is_active || c.id === value); });
    roots.forEach(function (r) {
      const kids = L.categories.filter(function (c) { return c.parent_id === r.id && (c.is_active || c.id === value); });
      if (!kids.length) { s.appendChild(opt(r.id, r.name, r.id === value)); return; }
      s.appendChild(h('optgroup', { label: r.name }, opt(r.id, r.name + ' (chung)', r.id === value), kids.map(function (k) { return opt(k.id, k.name, k.id === value); })));
    });
    return s;
  }
  function centerSelect(value) {
    return selectEl(L.centers.filter(function (c) { return c.is_active || c.id === value; }).map(function (c) { return { value: c.id, label: c.name }; }), value, '— Không gán —');
  }
  function partySelect(value, types) {
    return selectEl(L.parties.filter(function (p) { return (p.is_active || p.id === value) && (!types || types.indexOf(p.counterparty_type) >= 0); })
      .map(function (p) { return { value: p.id, label: p.name + ' · ' + (PARTY_TYPE[p.counterparty_type] || '') }; }), value, '— Không chọn —');
  }

  /* ---------- Đối tác: tạo nhanh ---------- */
  function partyForm(p, onSaved) {
    p = p || {};
    const name = h('input', { type: 'text', maxlength: '200', value: p.name || '' });
    const type = selectEl(Object.keys(PARTY_TYPE).map(function (k) { return { value: k, label: PARTY_TYPE[k] }; }), p.counterparty_type || 'supplier');
    const tax = h('input', { type: 'text', maxlength: '30', value: p.tax_code || '' });
    const phone = h('input', { type: 'tel', maxlength: '30', value: p.phone || '' });
    const email = h('input', { type: 'email', maxlength: '255', value: p.email || '' });
    const addr = h('input', { type: 'text', maxlength: '400', value: p.address || '' });
    const note = h('textarea', { maxlength: '1000' }, p.note || '');
    const active = h('input', { type: 'checkbox', checked: p.id ? p.is_active : true });
    BZ.modal({ title: p.id ? 'Sửa đối tác' : 'Thêm đối tác', body: h('div', { class: 'form-grid' },
      h('div', { class: 'span2' }, BZ.field('Tên đối tác *', name)), BZ.field('Loại', type), BZ.field('Mã số thuế', tax),
      BZ.field('Điện thoại', phone), BZ.field('Email', email), h('div', { class: 'span2' }, BZ.field('Địa chỉ', addr)),
      h('div', { class: 'span2' }, BZ.field('Ghi chú', note)),
      p.id ? h('label', { class: 'span2 check' }, active, ' Đang giao dịch') : null),
      actions: [{ label: 'Hủy', kind: 'ghost' }, { label: 'Lưu', kind: 'primary', onClick: async function (close, msg) {
        if (name.value.trim().length < 2) { msg.textContent = 'Nhập tên đối tác (ít nhất 2 ký tự).'; msg.hidden = false; return; }
        const row = { name: name.value.trim(), counterparty_type: type.value, tax_code: tax.value.trim() || null, phone: phone.value.trim() || null,
          email: email.value.trim() || null, address: addr.value.trim() || null, note: note.value.trim() || null, is_active: active.checked };
        const r = p.id ? await sb.from('finance_counterparties').update(row).eq('id', p.id).select().single()
          : await sb.from('finance_counterparties').insert(row).select().single();
        if (r.error) throw r.error;
        await loadLookups(); close(); BZ.toast('Đã lưu đối tác.', 'ok');
        if (onSaved) onSaved(r.data);
      } }] });
  }

  /* ---------- Phiếu thu / chi: lập & sửa ----------
     opts: { tx (sửa nháp), type: 'receipt'|'payment', debt (khoản công nợ để gắn), onSaved } */
  function txForm(ctx, opts) {
    opts = opts || {};
    const t = opts.tx || {};
    const debt = opts.debt || null;
    let type = t.tx_type || opts.type || (debt ? (debt.debt_type === 'receivable' ? 'receipt' : 'payment') : 'payment');
    const typeSel = selectEl([{ value: 'payment', label: 'Phiếu chi (tiền ra)' }, { value: 'receipt', label: 'Phiếu thu (tiền vào)' }], type);
    typeSel.disabled = !!(t.id || debt);
    const amount = moneyInput(t.amount || (debt ? Number(debt.remaining_amount) : 0));
    const date = dateInput(t.doc_date);
    const accIds = accountItems();
    const account = selectEl(accIds, t.target_account_id || t.source_account_id || (accIds[0] && accIds[0].value), accIds.length ? undefined : '— Chưa có tài khoản —');
    const catBox = h('div');
    let category;
    function drawCat() { category = categorySelect(type === 'receipt' ? 'income' : 'expense', t.category_id); catBox.textContent = ''; catBox.appendChild(BZ.field('Danh mục *', category)); }
    drawCat();
    typeSel.addEventListener('change', function () { type = typeSel.value; t.category_id = null; drawCat(); accLabel.textContent = type === 'receipt' ? 'Tiền vào tài khoản *' : 'Chi từ tài khoản *'; });
    const center = centerSelect(t.cost_center_id || (debt && debt.cost_center_id));
    const partyBox = h('div');
    let party;
    function drawParty(v) {
      party = partySelect(v);
      partyBox.textContent = '';
      partyBox.appendChild(BZ.field('Đối tác', party));
      partyBox.appendChild(h('button', { type: 'button', class: 'link-btn', style: { fontSize: '13px', marginTop: '4px' }, onclick: function () { partyForm(null, function (p) { drawParty(p.id); }); } }, '+ Thêm đối tác mới'));
    }
    drawParty(t.counterparty_id || (debt && debt.counterparty_id));
    if (debt) party.disabled = true;
    const desc = h('textarea', { maxlength: '1000', placeholder: type === 'payment' ? 'VD: Thanh toán hosting Vercel tháng 10' : 'VD: Thu phí triển khai SkyAgent' }, t.description || (debt ? (debt.debt_type === 'receivable' ? 'Thu nợ ' : 'Trả nợ ') + debt.debt_code : ''));
    const ref = h('input', { type: 'text', maxlength: '150', value: t.reference || '', placeholder: 'Số hóa đơn, mã giao dịch ngân hàng…' });
    const accLabel = h('span', null, type === 'receipt' ? 'Tiền vào tài khoản *' : 'Chi từ tài khoản *');
    const accField = BZ.field('x', account); accField.querySelector('label').textContent = ''; accField.querySelector('label').appendChild(accLabel);

    const body = h('div', { class: 'form-grid' },
      debt ? h('div', { class: 'span2 msg info' }, 'Gắn với công nợ ', h('b', null, debt.debt_code), ' – còn ', vnd(debt.remaining_amount),
        '. Khi phiếu được xác nhận đã ' + (type === 'receipt' ? 'thu' : 'chi') + ', số nợ sẽ tự giảm.') : null,
      BZ.field('Loại phiếu', typeSel), BZ.field('Số tiền (đ) *', amount),
      BZ.field('Ngày chứng từ *', date), accField,
      catBox, BZ.field('Tính vào', center, 'Sản phẩm / bộ phận để xem lãi lỗ theo mảng'),
      h('div', { class: 'span2' }, partyBox),
      h('div', { class: 'span2' }, BZ.field('Nội dung *', desc)),
      h('div', { class: 'span2' }, BZ.field('Số tham chiếu', ref)),
      !L.accounts.length ? h('div', { class: 'span2 msg err' }, 'Chưa có tài khoản tiền nào. Vào "Thu – chi & sổ quỹ" › Tài khoản để thêm.') : null);

    async function save(submit, close, msg) {
      const amt = amount.amount();
      const err = !amt ? 'Nhập số tiền lớn hơn 0.' : !date.value ? 'Chọn ngày chứng từ.' : !account.value ? 'Chọn tài khoản tiền.'
        : !category.value ? 'Chọn danh mục để báo cáo chi phí được đúng.' : desc.value.trim().length < 3 ? 'Nhập nội dung phiếu (ít nhất 3 ký tự).' : null;
      if (err) { msg.textContent = err; msg.hidden = false; return; }
      const row = {
        tx_type: type, amount: amt, doc_date: date.value,
        target_account_id: type === 'receipt' ? account.value : null, source_account_id: type === 'payment' ? account.value : null,
        category_id: category.value, cost_center_id: center.value || null, counterparty_id: party.value || null,
        description: desc.value.trim(), reference: ref.value.trim() || null
      };
      let id = t.id;
      if (id) { const r = await sb.from('finance_transactions').update(row).eq('id', id); if (r.error) throw r.error; }
      else {
        row.tx_code = 'TMP';
        if (debt) row.debt_id = debt.debt_id || debt.id;
        const r = await sb.from('finance_transactions').insert(row).select('id').single();
        if (r.error) throw r.error; id = r.data.id;
      }
      if (submit) { const r = await sb.from('finance_transactions').update({ status: 'submitted' }).eq('id', id); if (r.error) throw r.error; }
      close();
      BZ.toast(submit ? 'Đã gửi phiếu chờ duyệt.' : 'Đã lưu nháp phiếu.', 'ok');
      if (opts.onSaved) opts.onSaved(id);
    }
    BZ.modal({ title: t.id ? 'Sửa phiếu ' + t.tx_code : (debt ? (type === 'receipt' ? 'Lập phiếu thu nợ' : 'Lập phiếu trả nợ') : 'Lập phiếu thu / chi'), wide: true, body: body,
      actions: [{ label: 'Hủy', kind: 'ghost' },
        { label: 'Lưu nháp', kind: 'ghost', onClick: function (c, m) { return save(false, c, m); } },
        { label: 'Lưu & gửi duyệt', kind: 'primary', onClick: function (c, m) { return save(true, c, m); } }] });
  }

  /* ---------- Chuyển quỹ nội bộ ---------- */
  function transferForm(ctx, onSaved) {
    const items = accountItems();
    const src = selectEl(items, items[0] && items[0].value), dst = selectEl(items, items[1] && items[1].value);
    const amount = moneyInput(0), date = dateInput();
    const desc = h('input', { type: 'text', maxlength: '1000', placeholder: 'VD: Rút tiền mặt nhập quỹ' });
    BZ.modal({ title: 'Chuyển tiền giữa các tài khoản', body: h('div', { class: 'form-grid' },
      BZ.field('Từ tài khoản *', src), BZ.field('Sang tài khoản *', dst), BZ.field('Số tiền (đ) *', amount), BZ.field('Ngày *', date),
      h('div', { class: 'span2' }, BZ.field('Nội dung', desc)),
      h('p', { class: 'span2 muted', style: { fontSize: '13px' } }, 'Chuyển quỹ không tính vào thu – chi, chỉ đổi số dư giữa hai tài khoản. Phiếu vẫn đi qua bước duyệt như phiếu chi.')),
      actions: [{ label: 'Hủy', kind: 'ghost' }, { label: 'Tạo & gửi duyệt', kind: 'primary', onClick: async function (close, msg) {
        if (!amount.amount()) { msg.textContent = 'Nhập số tiền lớn hơn 0.'; msg.hidden = false; return; }
        if (src.value === dst.value) { msg.textContent = 'Hai tài khoản phải khác nhau.'; msg.hidden = false; return; }
        const id = await BZ.rpc('finance_create_transfer', { _source: src.value, _target: dst.value, _amount: amount.amount(), _doc_date: date.value, _description: desc.value.trim() || 'Chuyển quỹ nội bộ', _reference: null, _cost_center: null });
        const r = await sb.from('finance_transactions').update({ status: 'submitted' }).eq('id', id); if (r.error) throw r.error;
        close(); BZ.toast('Đã tạo phiếu chuyển quỹ, chờ duyệt.', 'ok'); if (onSaved) onSaved(id);
      } }] });
  }

  /* ---------- Chứng từ đính kèm ---------- */
  const MIME_OK = ['application/pdf', 'image/jpeg', 'image/png', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  function attachBox(ctx, owner) { /* owner = { transaction_id } | { debt_id } */
    const list = h('ul', { class: 'timeline' });
    const box = h('div', null, h('h3', { class: 'sec-t' }, 'Chứng từ đính kèm'), list);
    async function draw() {
      list.textContent = '';
      const key = owner.transaction_id ? 'transaction_id' : 'debt_id';
      const r = await sb.from('finance_attachments').select('*').eq(key, owner[key]).order('created_at');
      if (r.error) { list.appendChild(h('li', null, BZ.errText(r.error))); return; }
      if (!r.data.length) list.appendChild(h('li', { class: 'muted' }, 'Chưa có chứng từ. Nên đính kèm hóa đơn, ảnh chuyển khoản để đối chiếu sau này.'));
      r.data.forEach(function (a) {
        list.appendChild(h('li', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
          h('span', { style: { flex: '1', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis' } }, a.file_name, h('small', null, fmt.dateTime(a.created_at) + (a.size_bytes ? ' · ' + Math.ceil(a.size_bytes / 1024) + ' KB' : ''))),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async function () {
            const u = await sb.storage.from('finance-docs').createSignedUrl(a.path, 300);
            if (u.error) return BZ.toast(BZ.errText(u.error), 'err');
            window.open(u.data.signedUrl, '_blank', 'noopener');
          } }, 'Xem'),
          ctx.can.approveFinance ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: async function () {
            if (!(await BZ.confirm('Xóa chứng từ', 'Xóa tệp "' + a.file_name + '"? Không khôi phục được.', 'Xóa', true))) return;
            const d = await sb.from('finance_attachments').delete().eq('id', a.id);
            if (d.error) return BZ.toast(BZ.errText(d.error), 'err');
            await sb.storage.from('finance-docs').remove([a.path]);
            draw();
          } }, 'Xóa') : null));
      });
    }
    if (ctx.can.finance) {
      const file = h('input', { type: 'file', accept: '.pdf,.jpg,.jpeg,.png,.xlsx,.docx', hidden: true });
      file.addEventListener('change', async function () {
        const f = file.files[0]; file.value = '';
        if (!f) return;
        if (MIME_OK.indexOf(f.type) < 0) return BZ.toast('Chỉ nhận PDF, ảnh JPG/PNG, Excel (.xlsx) hoặc Word (.docx).', 'err');
        if (f.size > 10 * 1024 * 1024) return BZ.toast('Tệp lớn hơn 10 MB.', 'err');
        const safe = f.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);
        const path = (owner.transaction_id ? 'tx/' + owner.transaction_id : 'debt/' + owner.debt_id) + '/' + Date.now() + '-' + safe;
        const up = await sb.storage.from('finance-docs').upload(path, f, { contentType: f.type });
        if (up.error) return BZ.toast(BZ.errText(up.error), 'err');
        const row = Object.assign({ bucket: 'finance-docs', path: path, file_name: f.name.slice(0, 255), mime_type: f.type, size_bytes: f.size }, owner);
        const ins = await sb.from('finance_attachments').insert(row);
        if (ins.error) { await sb.storage.from('finance-docs').remove([path]); return BZ.toast(BZ.errText(ins.error), 'err'); }
        BZ.toast('Đã đính kèm ' + f.name, 'ok'); draw();
      });
      box.append(file, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', style: { marginTop: '8px' }, onclick: function () { file.click(); } }, '+ Đính kèm tệp'));
    }
    draw();
    return box;
  }

  /* ---------- Chi tiết phiếu + các bước duyệt ---------- */
  function kv(pairs) {
    return h('dl', { class: 'kv' }, pairs.filter(Boolean).map(function (p) { return [h('dt', null, p[0]), h('dd', null, p[1] === null || p[1] === undefined || p[1] === '' ? '—' : p[1])]; }));
  }
  async function people(ids) {
    const u = Array.from(new Set(ids.filter(Boolean))); const m = {};
    if (!u.length) return m;
    const r = await sb.from('profiles').select('id,full_name,email').in('id', u);
    if (!r.error) r.data.forEach(function (p) { m[p.id] = p.full_name || p.email; });
    return m;
  }
  function askReason(title, label, okLabel, danger) {
    return new Promise(function (res) {
      const ta = h('textarea', { maxlength: '1000' }); let v = null;
      BZ.modal({ title: title, body: BZ.field(label, ta), onClose: function () { res(v); }, actions: [
        { label: 'Quay lại', kind: 'ghost' },
        { label: okLabel, kind: danger ? 'danger' : 'primary', onClick: function (c, msg) {
          if (ta.value.trim().length < 3) { msg.textContent = 'Nhập lý do (ít nhất 3 ký tự).'; msg.hidden = false; return; }
          v = ta.value.trim(); c();
        } }] });
    });
  }

  async function txDetail(ctx, id, onChange) {
    const r = await sb.from('finance_transactions').select('*').eq('id', id).maybeSingle();
    if (r.error || !r.data) return BZ.toast(r.error ? BZ.errText(r.error) : 'Không tìm thấy phiếu.', 'err');
    const t = r.data;
    const hist = await sb.from('finance_approvals').select('*').eq('transaction_id', id).order('created_at');
    const who = await people([t.requested_by, t.approved_by].concat((hist.data || []).map(function (x) { return x.actor_id; })));
    let debt = null;
    if (t.debt_id) { const d = await sb.from('finance_debt_balances').select('*').eq('debt_id', t.debt_id).maybeSingle(); debt = d.data; }

    const verb = t.tx_type === 'receipt' ? 'thu' : t.tx_type === 'payment' ? 'chi' : 'chuyển';
    const me = ctx.user.id;
    const sign = t.tx_type === 'receipt' ? '+' : t.tx_type === 'payment' ? '−' : '';
    const body = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '18px' } },
      h('div', { class: 'row-actions', style: { alignItems: 'center', gap: '12px' } },
        h('span', { class: 'big-amt ' + (t.tx_type === 'receipt' ? 'pos' : t.tx_type === 'payment' ? 'neg' : '') }, sign + vnd(t.amount)), txChip(t),
        t.is_system_generated ? h('span', { class: 'chip info' }, 'Tự động từ thanh toán đơn hàng') : null),
      h('div', { class: 'form-grid' },
        kv([['Loại', TX_TYPE[t.tx_type]], ['Ngày chứng từ', fmt.date(t.doc_date)],
          t.tx_type === 'transfer' ? ['Từ', nameOf(t.source_account_id)] : null,
          t.tx_type === 'transfer' ? ['Sang', nameOf(t.target_account_id)] : ['Tài khoản', nameOf(t.target_account_id || t.source_account_id)],
          t.category_id ? ['Danh mục', catLabel(t.category_id)] : null, ['Tính vào', nameOf(t.cost_center_id)],
          ['Đối tác', nameOf(t.counterparty_id)], ['Tham chiếu', t.reference]]),
        kv([['Nội dung', h('span', { style: { whiteSpace: 'pre-wrap' } }, t.description || '')],
          ['Người lập', who[t.requested_by]], t.approved_by ? ['Người duyệt', (who[t.approved_by] || '') + ' · ' + fmt.dateTime(t.approved_at)] : null,
          t.paid_at ? ['Đã ' + verb + ' lúc', fmt.dateTime(t.paid_at)] : null,
          debt ? ['Công nợ', h('a', { href: '/admin/finance-debts.html#' + debt.debt_id }, debt.debt_code + ' · còn ' + vnd(debt.remaining_amount))] : null,
          t.source_order_id ? ['Đơn hàng', h('a', { href: '/admin/orders.html#' + t.source_order_id }, 'Xem đơn')] : null])),
      t.status === 'rejected' && t.rejected_reason ? h('div', { class: 'msg err' }, h('b', null, 'Lý do từ chối: '), t.rejected_reason) : null,
      t.status === 'void' && t.void_reason ? h('div', { class: 'msg err' }, h('b', null, 'Lý do hủy: '), t.void_reason) : null,
      t.status === 'submitted' && t.requested_by === me && ctx.can.approveFinance && !ctx.can.superAdmin ? h('div', { class: 'msg info' }, 'Phiếu do chính bạn lập nên cần người quản trị khác duyệt.') : null,
      attachBox(ctx, { transaction_id: t.id }),
      h('div', null, h('h3', { class: 'sec-t' }, 'Lịch sử'), h('ul', { class: 'timeline' }, (hist.data || []).map(function (x) {
        const to = x.to_status === 'paid' ? 'Đã ' + verb : (TX_STATUS[x.to_status] || [x.to_status])[0];
        return h('li', null, (x.from_status ? to : 'Lập phiếu') + (x.comment && x.from_status ? ' — ' + x.comment : ''), h('small', null, (who[x.actor_id] || 'Hệ thống') + ' · ' + fmt.dateTime(x.created_at)));
      }))));

    async function setStatus(close, patch, okText) {
      const u = await sb.from('finance_transactions').update(patch).eq('id', t.id);
      if (u.error) throw u.error;
      close(); BZ.toast(okText, 'ok'); if (onChange) onChange(); txDetail(ctx, t.id, onChange);
    }
    const A = [{ label: 'Đóng', kind: 'ghost' }];
    const fin = ctx.can.finance, appr = ctx.can.approveFinance;
    if (t.status === 'draft' && fin) {
      A.push({ label: 'Hủy phiếu', kind: 'danger', onClick: async function (c) { const why = await askReason('Hủy phiếu ' + t.tx_code, 'Lý do hủy *', 'Hủy phiếu', true); if (why) await setStatus(c, { status: 'void', void_reason: why }, 'Đã hủy phiếu.'); } });
      if (t.tx_type !== 'transfer') A.push({ label: 'Sửa', kind: 'ghost', onClick: function (c) { c(); txForm(ctx, { tx: t, onSaved: function () { if (onChange) onChange(); txDetail(ctx, t.id, onChange); } }); } });
      A.push({ label: 'Gửi duyệt', kind: 'primary', onClick: function (c) { return setStatus(c, { status: 'submitted' }, 'Đã gửi phiếu chờ duyệt.'); } });
    }
    if (t.status === 'submitted' && appr) {
      A.push({ label: 'Từ chối', kind: 'danger', onClick: async function (c) { const why = await askReason('Từ chối phiếu ' + t.tx_code, 'Lý do từ chối *', 'Từ chối', true); if (why) await setStatus(c, { status: 'rejected', rejected_reason: why }, 'Đã từ chối phiếu.'); } });
      A.push({ label: 'Duyệt', kind: 'primary', onClick: function (c) { return setStatus(c, { status: 'approved' }, 'Đã duyệt. Kế toán xác nhận sau khi ' + verb + ' tiền.'); } });
    }
    if (t.status === 'rejected' && fin) A.push({ label: 'Đưa về nháp để sửa', kind: 'primary', onClick: function (c) { return setStatus(c, { status: 'draft' }, 'Phiếu đã về nháp.'); } });
    if (t.status === 'approved' && fin) {
      if (appr) A.push({ label: 'Hủy phiếu', kind: 'danger', onClick: async function (c) { const why = await askReason('Hủy phiếu ' + t.tx_code, 'Lý do hủy *', 'Hủy phiếu', true); if (why) await setStatus(c, { status: 'void', void_reason: why }, 'Đã hủy phiếu.'); } });
      A.push({ label: 'Xác nhận đã ' + verb, kind: 'primary', onClick: async function (c) {
        if (!(await BZ.confirm('Xác nhận đã ' + verb, 'Xác nhận tiền đã thực sự ' + (t.tx_type === 'receipt' ? 'vào' : 'ra khỏi') + ' tài khoản: ' + vnd(t.amount) + '. Số dư sẽ cập nhật ngay.', 'Xác nhận'))) return;
        await setStatus(c, { status: 'paid' }, 'Đã ghi nhận ' + verb + ' tiền.');
      } });
    }
    if (t.status === 'paid' && appr) A.push({ label: 'Hủy phiếu đã ' + verb, kind: 'danger', onClick: async function (c) {
      const why = await askReason('Hủy phiếu ' + t.tx_code, 'Lý do hủy * (số dư và công nợ sẽ được trả lại)', 'Hủy phiếu', true);
      if (why) await setStatus(c, { status: 'void', void_reason: why }, 'Đã hủy phiếu, số dư đã được trả lại.');
    } });
    BZ.modal({ title: (TX_TYPE[t.tx_type] || 'Phiếu') + ' ' + t.tx_code, wide: true, body: body, actions: A });
  }

  /* ---------- Khung trang tài chính: chặn vai trò không được xem ---------- */
  function guard(ctx) {
    if (ctx.can.viewFinance) return true;
    ctx.main.appendChild(h('div', { class: 'msg info' }, 'Tài khoản của bạn chưa được cấp quyền xem tài chính. Nhờ Quản trị thêm vai trò Kế toán hoặc Chỉ xem.'));
    return false;
  }

  /* Thanh tiến độ ngân sách */
  function budgetBar(actual, amount, warn, plain) {
    const pct = amount > 0 ? actual / amount * 100 : 0;
    const kind = plain ? 'ok' : pct >= 100 ? 'bad' : pct >= warn ? 'warn' : 'ok';
    return h('div', { class: 'bbar ' + kind, role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(pct)), 'aria-label': 'Đã dùng ' + Math.round(pct) + '% ngân sách' },
      h('span', { style: { width: Math.min(100, pct) + '%' } }));
  }

  window.FIN = { TX_STATUS: TX_STATUS, TX_TYPE: TX_TYPE, ACC_TYPE: ACC_TYPE, DEBT_STATUS: DEBT_STATUS, PARTY_TYPE: PARTY_TYPE, CENTER_TYPE: CENTER_TYPE,
    chipOf: chipOf, txChip: txChip, vnd: vnd, short: short, moneyInput: moneyInput, iso: iso, today: today, monthRange: monthRange, thisMonth: thisMonth, dateInput: dateInput,
    L: L, loadLookups: loadLookups, nameOf: nameOf, catLabel: catLabel, selectEl: selectEl, accountItems: accountItems, categorySelect: categorySelect, centerSelect: centerSelect, partySelect: partySelect,
    partyForm: partyForm, txForm: txForm, transferForm: transferForm, txDetail: txDetail, attachBox: attachBox, kv: kv, askReason: askReason, guard: guard, budgetBar: budgetBar, people: people };
})();
