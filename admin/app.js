/* Zetabiz Admin – khung dùng chung cho mọi trang quản trị.
   Mỗi trang: <body data-page="leads"> … <main id="main"></main>
   rồi nạp supabase-js, /admin/config.js, /admin/app.js, sau đó gọi:
     BZ.boot(async function (ctx) { ... })   // ctx = { sb, user, roles, can }
*/
(function () {
  'use strict';
  const sb = window.zbSb;

  /* ---------- DOM helper: không bao giờ dùng innerHTML với dữ liệu ---------- */
  function h(tag, attrs) {
    const el = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      const v = attrs[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
    kids.flat(Infinity).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return el;
  }
  /* SVG tĩnh do chính mã nguồn định nghĩa (không chứa dữ liệu người dùng) */
  function svg(markup, size) {
    const s = size || 18;
    const t = document.createElement('template');
    t.innerHTML = '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" aria-hidden="true">' + markup + '</svg>';
    return t.content.firstChild;
  }

  const ICONS = {
    dashboard: ['t-blue', '<rect x="4" y="4" width="7" height="9" rx="2" fill="#fff"/><rect x="13" y="4" width="7" height="5" rx="2" fill="#fff" fill-opacity=".65"/><rect x="13" y="11" width="7" height="9" rx="2" fill="#fff"/><rect x="4" y="15" width="7" height="5" rx="2" fill="#fff" fill-opacity=".65"/>'],
    leads: ['t-sky', '<circle cx="10" cy="8" r="4" fill="#fff"/><path d="M3 20c0-4 3-6.5 7-6.5s7 2.5 7 6.5z" fill="#fff" fill-opacity=".7"/><path d="M19 6.5v6M16 9.5h6" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>'],
    orders: ['t-violet', '<path d="M6 3h9l4 4v14H6z" fill="#fff"/><path d="M15 3v4h4z" fill="#fff" fill-opacity=".55"/><path d="M9 12h7M9 16h5" stroke="#7C3AED" stroke-width="1.8" stroke-linecap="round"/>'],
    subscriptions: ['t-green', '<path d="M12 3 20 7v10l-8 4-8-4V7z" fill="#fff" fill-opacity=".7"/><path d="M12 11 20 7l-8-4-8 4z" fill="#fff"/><path d="M12 11v10" stroke="#047857" stroke-width="1.6"/>'],
    payments: ['t-amber', '<rect x="2.5" y="5" width="19" height="14" rx="2.5" fill="#fff"/><rect x="2.5" y="8.5" width="19" height="3" fill="#B45309" fill-opacity=".55"/><rect x="5" y="14" width="5" height="2" rx="1" fill="#B45309" fill-opacity=".6"/>'],
    content: ['t-pink', '<rect x="4" y="3" width="16" height="18" rx="2.5" fill="#fff"/><rect x="7" y="6" width="10" height="5" rx="1.2" fill="#DB2777" fill-opacity=".55"/><path d="M7 14.5h10M7 17.5h6" stroke="#DB2777" stroke-width="1.8" stroke-linecap="round"/>'],
    site: ['t-sky', '<circle cx="12" cy="12" r="9" fill="#fff" fill-opacity=".3"/><circle cx="12" cy="12" r="9" stroke="#fff" stroke-width="1.8"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18" stroke="#fff" stroke-width="1.6"/>'],
    ai: ['t-violet', '<rect x="4" y="7" width="16" height="12" rx="3.5" fill="#fff"/><path d="M12 3v4" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="3" r="1.6" fill="#fff"/><circle cx="9" cy="13" r="1.6" fill="#7C3AED"/><circle cx="15" cy="13" r="1.6" fill="#7C3AED"/><path d="M9.5 16.3h5" stroke="#7C3AED" stroke-width="1.6" stroke-linecap="round"/><path d="M2 12v3M22 12v3" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'],
    settings: ['t-slate', '<path d="M19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z" fill="#fff"/><circle cx="12" cy="12" r="3.2" fill="#475569"/>']
  };
  function icon3d(name, big) {
    const d = ICONS[name] || ICONS.dashboard;
    return h('span', { class: 'i3d ' + d[0] + (big ? ' lg' : '') }, svg(d[1], big ? 24 : 18));
  }

  const NAV = [
    { key: 'dashboard', label: 'Tổng quan', href: '/admin/dashboard.html' },
    { key: 'leads', label: 'Khách tiềm năng', href: '/admin/leads.html' },
    { key: 'orders', label: 'Báo giá & đơn hàng', href: '/admin/orders.html' },
    { key: 'payments', label: 'Thanh toán', href: '/admin/payments.html' },
    { key: 'subscriptions', label: 'Khách hàng & gói', href: '/admin/subscriptions.html' },
    { key: 'content', label: 'Nội dung trang', href: '/admin/content.html' },
    { key: 'ai', label: 'Đào tạo Trợ lý AI', href: '/admin/ai.html' },
    { key: 'settings', label: 'Cài đặt', href: '/admin/settings.html' },
    { key: 'site', label: 'Xem trang chủ', href: '/', ext: true }
  ];

  /* ---------- Định dạng ---------- */
  const nf = new Intl.NumberFormat('vi-VN');
  const fmt = {
    money: function (n, cur) { if (n === null || n === undefined) return '—'; return nf.format(Number(n)) + ' ' + (cur && cur !== 'VND' ? cur : 'đ'); },
    num: function (n) { return n === null || n === undefined ? '—' : nf.format(Number(n)); },
    date: function (d) { return d ? new Date(d).toLocaleDateString('vi-VN') : '—'; },
    dateTime: function (d) { return d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'; },
    cycle: function (c) { return ({ monthly: 'Hằng tháng', yearly: 'Hằng năm', one_time: 'Một lần', custom: 'Theo thỏa thuận' })[c] || c || '—'; }
  };

  /* Nhãn trạng thái: [nhãn, kiểu chip] – kiểu: info | blue | warn | ok | bad */
  const LABELS = {
    lead: { new: ['Mới', 'info'], contacted: ['Đã liên hệ', 'blue'], qualified: ['Đủ điều kiện', 'blue'], demo_scheduled: ['Hẹn demo', 'warn'], proposal: ['Đã gửi báo giá', 'warn'], won: ['Chốt thành công', 'ok'], lost: ['Không thành', 'bad'] },
    order: { draft: ['Nháp', 'info'], pending_payment: ['Chờ thanh toán', 'warn'], paid: ['Đã thanh toán', 'ok'], processing: ['Đang triển khai', 'blue'], completed: ['Hoàn tất', 'ok'], cancelled: ['Đã hủy', 'bad'], refunded: ['Đã hoàn tiền', 'bad'] },
    payment: { pending: ['Chờ chuyển khoản', 'info'], submitted: ['Chờ đối soát', 'warn'], approved: ['Đã duyệt', 'ok'], rejected: ['Từ chối', 'bad'], void: ['Đã hủy', 'bad'] },
    sub: { trial: ['Dùng thử', 'info'], active: ['Đang hoạt động', 'ok'], past_due: ['Quá hạn', 'warn'], suspended: ['Tạm ngưng', 'warn'], cancelled: ['Đã hủy', 'bad'], expired: ['Hết hạn', 'bad'] },
    role: { super_admin: 'Quản trị cao nhất', admin: 'Quản trị', editor: 'Biên tập', sales: 'Kinh doanh', finance: 'Kế toán', viewer: 'Chỉ xem' }
  };
  function chip(group, value) {
    const m = (LABELS[group] || {})[value] || [value || '—', 'info'];
    return h('span', { class: 'chip ' + m[1] }, m[0]);
  }

  /* ---------- Lỗi thân thiện ---------- */
  function errText(e) {
    const m = (e && (e.message || e.error_description || e.details)) || '';
    if (/JWT|session|not authenticated/i.test(m)) return 'Phiên đăng nhập đã hết hạn. Tải lại trang để đăng nhập lại.';
    if (/permission denied|row-level security|violates row-level/i.test(m)) return 'Tài khoản của bạn không có quyền thực hiện thao tác này.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
    if (/payments_provider_txn_unique/i.test(m)) return 'Mã giao dịch ngân hàng này đã được dùng cho một khoản thanh toán khác.';
    if (/payments_one_open_per_order/i.test(m)) return 'Đơn này đã có một khoản thanh toán đang chờ xử lý.';
    if (/duplicate key|unique constraint/i.test(m)) return 'Dữ liệu bị trùng với bản ghi đã có.';
    return m || 'Có lỗi xảy ra. Vui lòng thử lại.';
  }

  /* ---------- Thông báo nhanh ---------- */
  let toastBox;
  function toast(text, kind) {
    if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
    const t = h('div', { class: 'toast ' + (kind || 'ok') }, text);
    toastBox.appendChild(t);
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 300); }, kind === 'err' ? 6000 : 3500);
  }

  /* ---------- Hộp thoại ----------
     BZ.modal({ title, body: Node, actions: [{label, kind:'primary'|'ghost'|'danger', onClick: async(close)=>{}}], wide })
     Trả về { close, el }. Esc / bấm nền để đóng. */
  const modalStack = [];
  function modal(opts) {
    const prev = document.activeElement;
    const box = h('div', { class: 'modal' + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'mdl-t' });
    const back = h('div', { class: 'modal-back' }, box);
    let closed = false;
    function close() {
      if (closed) return; closed = true;
      back.remove(); document.removeEventListener('keydown', onKey);
      const i = modalStack.indexOf(back); if (i >= 0) modalStack.splice(i, 1);
      if (prev && prev.focus) prev.focus();
      if (opts.onClose) opts.onClose();
    }
    /* Esc chỉ đóng hộp thoại trên cùng */
    function onKey(e) { if (e.key === 'Escape' && modalStack[modalStack.length - 1] === back) { e.stopImmediatePropagation(); close(); } }
    modalStack.push(back);
    back.addEventListener('mousedown', function (e) { if (e.target === back) close(); });
    document.addEventListener('keydown', onKey);
    const msg = h('div', { class: 'msg err', role: 'alert', hidden: true });
    const acts = (opts.actions || []).map(function (a) {
      const b = h('button', { type: 'button', class: 'btn btn-' + (a.kind || 'ghost') }, a.label);
      b.addEventListener('click', async function () {
        if (!a.onClick) return close();
        msg.hidden = true; b.disabled = true;
        try { await a.onClick(close, msg); } catch (e) { msg.textContent = errText(e); msg.hidden = false; }
        finally { b.disabled = false; }
      });
      return b;
    });
    box.append(
      h('div', { class: 'modal-h' }, h('h2', { id: 'mdl-t' }, opts.title), h('button', { type: 'button', class: 'x', 'aria-label': 'Đóng', onclick: close }, '×')),
      h('div', { class: 'modal-b' }, msg, opts.body || null),
      acts.length ? h('div', { class: 'modal-f' }, acts) : null
    );
    document.body.appendChild(back);
    const f = box.querySelector('input,select,textarea,button:not(.x)'); if (f) f.focus();
    return { close: close, el: box, msg: msg };
  }
  function confirmBox(title, text, okLabel, danger) {
    return new Promise(function (res) {
      /* Đóng bằng Esc / nền / nút × cũng trả về false để không treo Promise */
      let answer = false;
      modal({ title: title, body: h('p', { class: 'muted' }, text), onClose: function () { res(answer); }, actions: [
        { label: 'Hủy', kind: 'ghost', onClick: function (c) { answer = false; c(); } },
        { label: okLabel || 'Đồng ý', kind: danger ? 'danger' : 'primary', onClick: function (c) { answer = true; c(); } }
      ] });
    });
  }

  /* ---------- Ô nhập có nhãn ---------- */
  let fid = 0;
  function field(label, input, hint) {
    const id = input.id || ('f' + (++fid));
    input.id = id;
    return h('div', { class: 'field' }, h('label', { for: id }, label), input, hint ? h('small', { class: 'muted' }, hint) : null);
  }

  /* ---------- Gọi RPC với lỗi tiếng Việt ---------- */
  async function rpc(name, args) {
    const r = await sb.rpc(name, args || {});
    if (r.error) throw r.error;
    return r.data;
  }

  /* ---------- Khung trang + chốt quyền ---------- */
  async function boot(render) {
    const page = document.body.dataset.page;
    const gate = h('div', { class: 'gate', role: 'status' }, h('span', { class: 'spin', 'aria-hidden': 'true' }), 'Đang kiểm tra quyền truy cập…');
    document.body.prepend(gate);
    const toLogin = function () { location.replace('/admin/'); };
    const s = (await sb.auth.getSession()).data.session;
    if (!s) return toLogin();
    const user = s.user;
    const staff = await sb.rpc('is_staff', { _user_id: user.id });
    if (staff.error) { gate.textContent = 'Không kết nối được máy chủ. Kiểm tra mạng rồi tải lại trang.'; return; }
    if (staff.data !== true) { await sb.auth.signOut(); return toLogin(); }
    sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT') toLogin(); });

    const rr = await sb.from('user_roles').select('role').eq('user_id', user.id);
    const roles = (rr.data || []).map(function (r) { return r.role; });
    const has = function () { const a = Array.prototype.slice.call(arguments); return roles.some(function (r) { return a.indexOf(r) >= 0; }); };
    const can = {
      admin: has('super_admin', 'admin'),
      superAdmin: has('super_admin'),
      leads: has('super_admin', 'admin', 'sales'),
      finance: has('super_admin', 'admin', 'finance')
    };
    const prof = await sb.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle();
    const name = (prof.data && prof.data.full_name) || user.email;

    /* Sidebar */
    const nav = h('nav', { class: 'nav', 'aria-label': 'Menu quản trị' }, NAV.map(function (n) {
      return h('a', { href: n.href, 'aria-current': n.key === page ? 'page' : null, target: n.ext ? '_blank' : null, rel: n.ext ? 'noopener' : null }, icon3d(n.key), n.label);
    }));
    const initials = (name || '?').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(-2).join('').toUpperCase();
    const side = h('aside', { class: 'side', id: 'side' },
      h('a', { class: 'logo', href: '/admin/dashboard.html' }, h('img', { class: 'logo-mark', src: '/assets/zetabiz-mark-64.png', alt: '', width: 28, height: 29 }), h('span', { class: 'logo-word' }, 'Zetabiz')),
      h('div', { class: 'nav-label' }, 'QUẢN TRỊ'),
      nav,
      h('div', { class: 'me' }, h('div', { class: 'avatar' }, initials), h('div', { class: 'who' }, h('b', null, name), h('small', null, roles.map(function (r) { return LABELS.role[r] || r; }).join(', ') || user.email))),
      h('button', { type: 'button', class: 'btn btn-ghost', style: { marginTop: '8px' }, onclick: async function () { await sb.auth.signOut(); toLogin(); } }, 'Đăng xuất')
    );
    const menuBtn = h('button', { type: 'button', class: 'btn btn-ghost menu-btn', 'aria-label': 'Mở menu', 'aria-controls': 'side', 'aria-expanded': 'false' }, '☰');
    const main = document.getElementById('main') || h('main', { id: 'main' });
    main.prepend(menuBtn);
    const app = h('div', { class: 'app' }, side, main);
    document.body.appendChild(app);

    const mq = matchMedia('(max-width:820px)');
    function setMenu(o) { side.classList.toggle('open', o); menuBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); side.inert = mq.matches && !o; }
    setMenu(false); mq.addEventListener('change', function () { setMenu(false); });
    menuBtn.addEventListener('click', function () { setMenu(!side.classList.contains('open')); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && side.classList.contains('open')) { setMenu(false); menuBtn.focus(); } });

    gate.remove();
    try { await render({ sb: sb, user: user, roles: roles, can: can, name: name, main: main }); }
    catch (e) { main.appendChild(h('div', { class: 'msg err', role: 'alert' }, errText(e))); }
  }

  /* Tiêu đề trang chuẩn */
  function pageHead(title, sub, actions) {
    return h('div', { class: 'top' }, h('div', { class: 'grow' }, h('h1', null, title), sub ? h('p', { class: 'sub' }, sub) : null), actions || null);
  }
  function emptyRow(cols, text) { return h('tr', null, h('td', { colspan: cols, class: 'empty' }, text)); }
  function debounce(fn, ms) { let t; return function () { const a = arguments; clearTimeout(t); t = setTimeout(function () { fn.apply(null, a); }, ms || 300); }; }

  window.BZ = { sb: sb, h: h, svg: svg, icon3d: icon3d, fmt: fmt, LABELS: LABELS, chip: chip, errText: errText, toast: toast, modal: modal, confirm: confirmBox, field: field, rpc: rpc, boot: boot, pageHead: pageHead, emptyRow: emptyRow, debounce: debounce };
})();
