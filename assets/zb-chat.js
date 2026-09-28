/* Zetabiz – Khung chat tư vấn & chăm sóc khách hàng.
   Nhúng: <script src="/assets/zb-chat.js" defer></script>
   - Hỏi đáp qua /api/chat (AI), tự dự phòng khi mất kết nối.
   - Khách để lại thông tin ngay trong khung chat -> ghi vào bảng leads (nguồn: website-chatbot).
*/
(function () {
  'use strict';
  if (window.__zbChat) return;
  window.__zbChat = true;

  var CFG = {
    api: '/api/chat',
    supabaseUrl: 'https://zuucoqfylagcfwnhomet.supabase.co',
    supabaseKey: 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq',
    hotline: '0918566177', hotlineText: '0918 566 177',
    zalo: 'https://zalo.me/0918566177',
    privacy: '/chinh-sach-bao-mat/',
    logo: '/assets/zetabiz-mark-64.png',
    storeKey: 'zbChat.v1'
  };
  var WELCOME = 'Xin chào anh/chị 👋 Em là **Trợ lý Zetabiz**. Em có thể tư vấn phần mềm quản lý cho garage ô tô, đại lý vé máy bay, spa, thương mại và sản xuất. Anh/chị đang kinh doanh lĩnh vực gì ạ?';
  var QUICK = ['Tư vấn giải pháp cho ngành của tôi', 'Nhận báo giá', 'Có cần cài đặt phần mềm không?', 'Gặp chuyên viên tư vấn'];

  /* ---------- trạng thái (lưu theo phiên trình duyệt) ---------- */
  var state = { open: false, msgs: [], leadDone: false, teased: false, sid: '' };
  var remote = null; /* cấu hình từ Quản trị › Đào tạo Trợ lý AI */
  function newSid() { var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function load() { try { var s = JSON.parse(sessionStorage.getItem(CFG.storeKey) || 'null'); if (s && Array.isArray(s.msgs)) state = Object.assign(state, s, { open: false }); } catch (e) {} }
  function save() { try { sessionStorage.setItem(CFG.storeKey, JSON.stringify({ msgs: state.msgs.slice(-40), leadDone: state.leadDone, teased: state.teased, sid: state.sid })); } catch (e) {} }
  load();
  if (!/^[a-f0-9]{24}$/.test(state.sid || '')) { try { state.sid = newSid(); } catch (e) { state.sid = String(Date.now()) + Math.random().toString(36).slice(2, 10); } save(); }

  /* ---------- giao diện ---------- */
  var css = [
    '.zbc,.zbc *{box-sizing:border-box}',
    '.zbc{--zc-bg:#0B1433;--zc-bg2:#111C45;--zc-line:rgba(143,176,255,.22);--zc-text:#E8ECFF;--zc-muted:#A9B6E6;--zc-pri:#1D4ED8;--zc-glow:#4F7BFF;--zc-acc:#F97316;--zc-ok:#34D399;font-family:"Be Vietnam Pro",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--zc-text);font-size:14.5px;line-height:1.55}',
    '.zbc-launch{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:max(20px,env(safe-area-inset-bottom));z-index:2147483000;width:60px;height:60px;border-radius:50%;border:0;cursor:pointer;background:linear-gradient(135deg,var(--zc-acc),#fb923c);color:#fff;box-shadow:0 10px 30px rgba(249,115,22,.45),0 0 0 1px rgba(255,255,255,.12) inset;display:grid;place-items:center;transition:transform .2s ease}',
    '.zbc-launch:hover{transform:translateY(-2px) scale(1.04)}.zbc-launch:focus-visible{outline:3px solid #fff;outline-offset:3px}',
    '.zbc-launch svg{width:28px;height:28px}',
    '.zbc-dot{position:absolute;top:4px;right:4px;width:12px;height:12px;border-radius:50%;background:var(--zc-ok);border:2px solid #050A1E}',
    '.zbc-tease{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:calc(max(20px,env(safe-area-inset-bottom)) + 72px);z-index:2147483000;max-width:260px;background:#fff;color:#0B1B3F;border-radius:14px 14px 4px 14px;padding:12px 34px 12px 14px;font-size:14px;box-shadow:0 12px 30px rgba(0,0,0,.35);cursor:pointer;animation:zbcIn .3s ease}',
    '.zbc-tease b{color:var(--zc-acc)}.zbc-tease button{position:absolute;top:4px;right:6px;border:0;background:none;font-size:18px;line-height:1;color:#64748b;cursor:pointer;padding:4px}',
    '.zbc-panel{position:fixed;right:max(20px,env(safe-area-inset-right));bottom:calc(max(20px,env(safe-area-inset-bottom)) + 72px);z-index:2147483001;width:380px;max-width:calc(100vw - 32px);height:min(620px,calc(100vh - 120px));display:flex;flex-direction:column;background:var(--zc-bg);border:1px solid var(--zc-line);border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.55),0 0 0 1px rgba(79,123,255,.08);animation:zbcIn .25s ease}',
    '.zbc-panel[hidden],.zbc-tease[hidden]{display:none}',
    '@keyframes zbcIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}',
    '.zbc-head{display:flex;align-items:center;gap:10px;padding:14px 12px 14px 16px;background:linear-gradient(135deg,#0B1B3F,#132463);border-bottom:1px solid var(--zc-line)}',
    '.zbc-av{width:38px;height:38px;border-radius:50%;background:#fff;display:grid;place-items:center;flex-shrink:0;overflow:hidden}.zbc-av img{width:26px;height:26px;object-fit:contain}',
    '.zbc-ttl{flex:1;min-width:0}.zbc-ttl b{display:block;font-size:15px}.zbc-ttl span{font-size:12.5px;color:var(--zc-muted);display:flex;align-items:center;gap:6px}.zbc-ttl span:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--zc-ok)}',
    '.zbc-ic{width:36px;height:36px;border-radius:10px;border:0;background:transparent;color:var(--zc-text);display:grid;place-items:center;cursor:pointer;text-decoration:none}.zbc-ic:hover{background:rgba(255,255,255,.08)}.zbc-ic:focus-visible{outline:2px solid var(--zc-glow)}.zbc-ic svg{width:19px;height:19px}',
    '.zbc-body{flex:1;overflow-y:auto;padding:16px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth;overscroll-behavior:contain}',
    '.zbc-m{max-width:86%;padding:10px 13px;border-radius:14px;word-wrap:break-word;white-space:normal}',
    '.zbc-m.bot{align-self:flex-start;background:var(--zc-bg2);border:1px solid var(--zc-line);border-bottom-left-radius:4px}',
    '.zbc-m.me{align-self:flex-end;background:var(--zc-pri);color:#fff;border-bottom-right-radius:4px}',
    '.zbc-m ul{margin:6px 0 2px;padding-left:18px}.zbc-m li{margin:2px 0}.zbc-m p{margin:0 0 6px}.zbc-m p:last-child{margin:0}.zbc-m a{color:#8fb0ff}',
    '.zbc-m.err{background:rgba(249,115,22,.12);border-color:rgba(249,115,22,.4)}',
    '.zbc-typing{display:inline-flex;gap:4px;align-items:center}.zbc-typing i{width:7px;height:7px;border-radius:50%;background:var(--zc-muted);animation:zbcB 1.2s infinite}.zbc-typing i:nth-child(2){animation-delay:.15s}.zbc-typing i:nth-child(3){animation-delay:.3s}',
    '@keyframes zbcB{0%,60%,100%{opacity:.3;transform:none}30%{opacity:1;transform:translateY(-3px)}}',
    '.zbc-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px}',
    '.zbc-chip{border:1px solid var(--zc-line);background:transparent;color:var(--zc-text);border-radius:999px;padding:7px 12px;font:inherit;font-size:13px;cursor:pointer;text-align:left}.zbc-chip:hover{border-color:var(--zc-glow);background:rgba(79,123,255,.12)}.zbc-chip:focus-visible{outline:2px solid var(--zc-glow)}',
    '.zbc-cta{align-self:flex-start;border:0;border-radius:10px;padding:9px 14px;background:var(--zc-acc);color:#fff;font:inherit;font-weight:600;font-size:13.5px;cursor:pointer}.zbc-cta:hover{filter:brightness(1.08)}.zbc-cta:disabled{opacity:.6;cursor:default}',
    '.zbc-form{align-self:stretch;background:var(--zc-bg2);border:1px solid var(--zc-line);border-radius:14px;padding:12px;display:grid;gap:8px}',
    '.zbc-form b{font-size:14px}.zbc-form label{font-size:12.5px;color:var(--zc-muted);display:grid;gap:4px}',
    '.zbc-form input[type=text],.zbc-form input[type=tel],.zbc-form input[type=email]{width:100%;background:#050A1E;border:1px solid var(--zc-line);border-radius:9px;padding:9px 10px;color:var(--zc-text);font:inherit;font-size:14px}',
    '.zbc-form input:focus{outline:2px solid var(--zc-glow);outline-offset:0;border-color:transparent}.zbc-form input[aria-invalid=true]{border-color:#f87171}',
    '.zbc-form .zbc-cons{display:flex;gap:8px;align-items:flex-start;font-size:12px;line-height:1.45}.zbc-form .zbc-cons input{margin-top:2px;accent-color:var(--zc-acc)}',
    '.zbc-form .zbc-hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}',
    '.zbc-ferr{color:#fca5a5;font-size:12.5px}.zbc-frow{display:flex;gap:8px}.zbc-frow .zbc-cta{flex:1;text-align:center}',
    '.zbc-ghost{border:1px solid var(--zc-line);background:transparent;color:var(--zc-muted);border-radius:10px;padding:9px 12px;font:inherit;font-size:13px;cursor:pointer}',
    '.zbc-foot{border-top:1px solid var(--zc-line);padding:10px 10px 8px;background:var(--zc-bg)}',
    '.zbc-in{display:flex;gap:8px;align-items:flex-end}',
    '.zbc-in textarea{flex:1;resize:none;max-height:110px;min-height:42px;background:#050A1E;border:1px solid var(--zc-line);border-radius:12px;padding:10px 12px;color:var(--zc-text);font:inherit;font-size:14.5px;line-height:1.4}',
    '.zbc-in textarea:focus{outline:2px solid var(--zc-glow);border-color:transparent}',
    '.zbc-send{width:42px;height:42px;border-radius:12px;border:0;background:var(--zc-pri);color:#fff;display:grid;place-items:center;cursor:pointer;flex-shrink:0}.zbc-send:disabled{opacity:.45;cursor:default}.zbc-send svg{width:19px;height:19px}',
    '.zbc-note{font-size:11px;color:#7F8DC0;text-align:center;margin-top:6px}',
    '@media (max-width:520px){.zbc-panel{right:0;left:0;bottom:0;top:0;width:100%;max-width:none;height:100%;height:100dvh;border-radius:0;border:0}.zbc-head{padding-top:max(14px,env(safe-area-inset-top))}.zbc-foot{padding-bottom:max(8px,env(safe-area-inset-bottom))}.zbc-in textarea{font-size:16px}.zbc-open .zbc-launch{display:none}}',
    '@media (prefers-reduced-motion:reduce){.zbc-panel,.zbc-tease{animation:none}.zbc-typing i{animation:none}.zbc-launch{transition:none}}'
  ].join('');

  var I = {
    chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/><path d="M8.5 11h.01M12 11h.01M15.5 11h.01" stroke-width="2.6"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>'
  };

  function el(tag, attrs, html) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) { if (attrs[k] != null) e.setAttribute(k, attrs[k]); }
    if (html != null) e.innerHTML = html;
    return e;
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  /* markdown tối giản, luôn escape trước */
  function md(s) {
    var lines = esc(s).split(/\n/), out = [], list = false;
    lines.forEach(function (ln) {
      var t = ln.trim();
      var li = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(t);
      if (li) { if (!list) { out.push('<ul>'); list = true; } out.push('<li>' + li[1] + '</li>'); return; }
      if (list) { out.push('</ul>'); list = false; }
      if (t) out.push('<p>' + t + '</p>');
    });
    if (list) out.push('</ul>');
    return out.join('')
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(>])((?:0|\+84)\d[\d .]{7,12}\d)/g, function (m, p, num) { return p + '<a href="tel:' + num.replace(/[ .]/g, '') + '">' + num + '</a>'; })
      .replace(/([\w.+-]+@[\w-]+\.[\w.]+)/g, '<a href="mailto:$1">$1</a>');
  }

  var root, launch, panel, body, chips, ta, sendBtn, tease, busy = false;

  function build() {
    var st = el('style', { id: 'zbc-style' }); st.textContent = css; document.head.appendChild(st);
    root = el('div', { class: 'zbc', id: 'zbc' });

    launch = el('button', { class: 'zbc-launch', type: 'button', 'aria-label': 'Mở khung chat tư vấn Zetabiz', 'aria-expanded': 'false', 'aria-controls': 'zbc-panel' }, I.chat + '<span class="zbc-dot" aria-hidden="true"></span>');
    tease = el('div', { class: 'zbc-tease', role: 'status', hidden: '' }, 'Chào anh/chị! Cần tư vấn phần mềm quản lý? <b>Nhắn em ngay</b> nhé.<button type="button" aria-label="Ẩn lời chào">×</button>');

    panel = el('section', { class: 'zbc-panel', id: 'zbc-panel', role: 'dialog', 'aria-label': 'Chat với Trợ lý Zetabiz', hidden: '' });
    panel.innerHTML =
      '<header class="zbc-head"><div class="zbc-av"><img src="' + CFG.logo + '" alt="" width="26" height="26"></div>' +
      '<div class="zbc-ttl"><b class="zbc-name">Trợ lý Zetabiz</b><span>Thường trả lời ngay</span></div>' +
      '<a class="zbc-ic" href="tel:' + CFG.hotline + '" aria-label="Gọi hotline ' + CFG.hotlineText + '" title="Gọi ' + CFG.hotlineText + '">' + I.phone + '</a>' +
      '<button class="zbc-ic zbc-x" type="button" aria-label="Thu nhỏ khung chat" title="Thu nhỏ">' + I.down + '</button></header>' +
      '<div class="zbc-body" aria-live="polite"></div><div class="zbc-chips"></div>' +
      '<div class="zbc-foot"><form class="zbc-in"><textarea rows="1" maxlength="1000" placeholder="Nhập câu hỏi…" aria-label="Nhập câu hỏi"></textarea>' +
      '<button class="zbc-send" type="submit" aria-label="Gửi" disabled>' + I.send + '</button></form>' +
      '<div class="zbc-note">Trợ lý AI có thể nhầm lẫn · Hội thoại được lưu để cải thiện tư vấn · <a href="' + CFG.privacy + '" target="_blank" rel="noopener" style="color:inherit">Bảo mật</a></div></div>';

    root.appendChild(panel); root.appendChild(tease); root.appendChild(launch);
    document.body.appendChild(root);

    body = panel.querySelector('.zbc-body');
    chips = panel.querySelector('.zbc-chips');
    ta = panel.querySelector('textarea');
    sendBtn = panel.querySelector('.zbc-send');

    launch.addEventListener('click', function () { toggle(); });
    panel.querySelector('.zbc-x').addEventListener('click', function () { toggle(false); });
    tease.addEventListener('click', function (e) { if (e.target.tagName === 'BUTTON') { hideTease(); return; } toggle(true); });
    panel.querySelector('form').addEventListener('submit', function (e) { e.preventDefault(); ask(ta.value); });
    ta.addEventListener('input', function () { sendBtn.disabled = !ta.value.trim() || busy; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 110) + 'px'; });
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(ta.value); } });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state.open) toggle(false); });

    /* các nút trên trang có data-zb-chat sẽ mở khung chat */
    document.addEventListener('click', function (e) {
      var t = e.target.closest && e.target.closest('[data-zb-chat]');
      if (!t) return; e.preventDefault(); toggle(true);
      var q = t.getAttribute('data-zb-chat'); if (q) ask(q);
    });

    if (!state.teased) setTimeout(function () { if (!state.open && !state.teased) { tease.hidden = false; state.teased = true; save(); } }, 9000);
  }
  function hideTease() { tease.hidden = true; state.teased = true; save(); }

  function toggle(force) {
    var open = typeof force === 'boolean' ? force : !state.open;
    state.open = open;
    panel.hidden = !open;
    launch.setAttribute('aria-expanded', String(open));
    launch.setAttribute('aria-label', open ? 'Đóng khung chat' : 'Mở khung chat tư vấn Zetabiz');
    launch.innerHTML = open ? I.close : I.chat + '<span class="zbc-dot" aria-hidden="true"></span>';
    root.classList.toggle('zbc-open', open);
    if (open) {
      hideTease();
      if (!body.childElementCount) render();
      setTimeout(function () { ta.focus({ preventScroll: true }); body.scrollTop = body.scrollHeight; }, 30);
    } else { launch.focus({ preventScroll: true }); }
  }

  /* ---------- hiển thị ---------- */
  function addBubble(role, text, extra) {
    var hasForm = /\[\[FORM\]\]/.test(text);
    var clean = text.replace(/\s*\[\[FORM\]\]\s*/g, ' ').trim();
    var b = el('div', { class: 'zbc-m ' + (role === 'user' ? 'me' : 'bot') + (extra ? ' ' + extra : '') }, role === 'user' ? esc(clean).replace(/\n/g, '<br>') : md(clean));
    body.appendChild(b);
    if (role !== 'user' && hasForm && !state.leadDone) body.appendChild(ctaBtn());
    return b;
  }
  function ctaBtn() {
    var b = el('button', { class: 'zbc-cta', type: 'button' }, 'Để lại thông tin – chuyên viên gọi lại');
    b.addEventListener('click', function () { b.remove(); showForm(); });
    return b;
  }
  function render() {
    body.innerHTML = '';
    addBubble('assistant', (remote && remote.greeting) || WELCOME);
    state.msgs.forEach(function (m) { addBubble(m.role, m.content); });
    body.querySelectorAll('.zbc-cta').forEach(function (b, i, all) { if (i < all.length - 1) b.remove(); });
    renderChips();
    body.scrollTop = body.scrollHeight;
  }
  function renderChips() {
    chips.innerHTML = '';
    if (state.msgs.length) return;
    ((remote && remote.quick_replies) || QUICK).forEach(function (q) {
      var c = el('button', { class: 'zbc-chip', type: 'button' }, esc(q));
      c.addEventListener('click', function () { ask(q); });
      chips.appendChild(c);
    });
  }
  function scrollEnd() { body.scrollTop = body.scrollHeight; }

  /* ---------- hỏi đáp ---------- */
  async function ask(text) {
    text = String(text || '').trim();
    if (!text || busy) return;
    if (text.length > 1000) text = text.slice(0, 1000);
    busy = true; sendBtn.disabled = true;
    ta.value = ''; ta.style.height = 'auto';
    chips.innerHTML = '';
    state.msgs.push({ role: 'user', content: text }); save();
    addBubble('user', text);
    var typing = el('div', { class: 'zbc-m bot', 'aria-label': 'Trợ lý đang trả lời' }, '<span class="zbc-typing"><i></i><i></i><i></i></span>');
    body.appendChild(typing); scrollEnd();

    var reply, apiErr = null;
    try {
      var ctrl = new AbortController(); var tm = setTimeout(function () { ctrl.abort(); }, 45000);
      var r = await fetch(CFG.api, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.msgs.slice(-16), session: state.sid, page: location.pathname }), signal: ctrl.signal });
      clearTimeout(tm);
      var d = await r.json().catch(function () { return {}; });
      reply = d.reply || null;
      apiErr = !reply && d.error && /[à-ỹđ]/i.test(d.error) ? d.error : null;
    } catch (e) { reply = null; }
    typing.remove();
    if (!reply) {
      /* lỗi không lưu vào lịch sử để lần gửi sau không bị lặp */
      state.msgs.pop(); save();
      addBubble('assistant', apiErr || ('Xin lỗi anh/chị, kết nối đang chập chờn. Anh/chị thử gửi lại, hoặc gọi ngay **' + CFG.hotlineText + '** để được hỗ trợ ạ. [[FORM]]'), 'err');
    } else {
      state.msgs.push({ role: 'assistant', content: reply }); save();
      addBubble('assistant', reply);
    }
    busy = false; sendBtn.disabled = !ta.value.trim();
    scrollEnd();
    if (window.innerWidth > 520) ta.focus({ preventScroll: true });
  }

  /* ---------- form để lại thông tin ---------- */
  function transcript() {
    var lines = state.msgs.map(function (m) { var t = m.content.replace(/\[\[FORM\]\]/g, '').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); return m.role === 'user' ? 'Khách: ' + t : 'Bot: ' + (t.length > 160 ? t.slice(0, 157) + '…' : t); });
    var out = '[Từ chatbot website · mã hội thoại ' + state.sid.slice(0, 8) + ']\n', i = lines.length - 1, acc = [];
    for (; i >= 0; i--) { if ((out + acc.join('\n')).length + lines[i].length > 1400) break; acc.unshift(lines[i]); }
    return (out + acc.join('\n')).slice(0, 1500);
  }
  function guessInterest() {
    var t = state.msgs.filter(function (m) { return m.role === 'user'; }).map(function (m) { return m.content; }).join(' ').toLowerCase();
    var map = [[/garage|gara|ô tô|oto|sửa xe/, 'Zetabiz AutoPro – Garage ô tô'], [/vé máy bay|đại lý vé|booking/, 'Zetabiz SkyAgent – Đại lý vé máy bay'], [/spa|thẩm mỹ|liệu trình/, 'Zetabiz SpaCare – Spa & thẩm mỹ'], [/sản xuất|nhà máy|nguyên liệu/, 'Zetabiz FactoryOne – Sản xuất'], [/thương mại|cửa hàng|bán lẻ|bán hàng/, 'Zetabiz TradeHub – Thương mại']];
    for (var i = 0; i < map.length; i++) if (map[i][0].test(t)) return map[i][1];
    return 'Chatbot website';
  }
  function showForm() {
    var f = el('form', { class: 'zbc-form', novalidate: '' });
    f.innerHTML =
      '<b>Để lại thông tin, chuyên viên Zetabiz sẽ gọi lại</b>' +
      '<label>Họ tên *<input type="text" name="name" autocomplete="name" maxlength="100" required></label>' +
      '<label>Số điện thoại / Zalo *<input type="tel" name="phone" autocomplete="tel" inputmode="tel" maxlength="20" required></label>' +
      '<label>Email *<input type="email" name="email" autocomplete="email" maxlength="255" required></label>' +
      '<label>Tên doanh nghiệp<input type="text" name="company" autocomplete="organization" maxlength="150"></label>' +
      '<div class="zbc-hp" aria-hidden="true"><input type="text" name="website" tabindex="-1" autocomplete="off"></div>' +
      '<label class="zbc-cons"><input type="checkbox" name="consent"><span>Tôi đồng ý với <a href="' + CFG.privacy + '" target="_blank" rel="noopener">Chính sách bảo mật</a>, cho phép Zetabiz liên hệ tư vấn qua điện thoại, Zalo hoặc email. *</span></label>' +
      '<div class="zbc-ferr" role="alert" hidden></div>' +
      '<div class="zbc-frow"><button class="zbc-cta" type="submit">Gửi thông tin</button><button class="zbc-ghost" type="button">Để sau</button></div>';
    body.appendChild(f); scrollEnd();
    var err = f.querySelector('.zbc-ferr'), btn = f.querySelector('.zbc-cta');
    f.elements.name.focus();
    f.querySelector('.zbc-ghost').addEventListener('click', function () { f.remove(); body.appendChild(ctaBtn()); scrollEnd(); });
    function bad(msg, input) { err.textContent = msg; err.hidden = false; if (input) { input.setAttribute('aria-invalid', 'true'); input.focus(); } }
    f.addEventListener('input', function (e) { err.hidden = true; if (e.target.removeAttribute) e.target.removeAttribute('aria-invalid'); });
    f.addEventListener('change', function () { err.hidden = true; });
    f.addEventListener('submit', async function (e) {
      e.preventDefault(); err.hidden = true;
      var name = f.elements.name.value.trim().replace(/\s+/g, ' ');
      var phone = f.elements.phone.value.trim().replace(/[\s.\-()]/g, '');
      var email = f.elements.email.value.trim().toLowerCase();
      if (name.length < 2) return bad('Vui lòng nhập họ tên.', f.elements.name);
      if (!/^(\+?84|0)\d{8,10}$/.test(phone)) return bad('Số điện thoại chưa đúng. Ví dụ: 0918 566 177.', f.elements.phone);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return bad('Email chưa đúng định dạng.', f.elements.email);
      if (!f.elements.consent.checked) return bad('Vui lòng đồng ý với Chính sách bảo mật để Zetabiz liên hệ.', f.elements.consent);
      var q = new URLSearchParams(location.search);
      var payload = {
        full_name: name, phone: phone, email: email, company: f.elements.company.value.trim() || null,
        interest: guessInterest().slice(0, 120), need: transcript(), consent: true,
        honeypot: f.elements.website.value || '', variant: 'chatbot',
        landing_page: location.href.slice(0, 500), referrer: (document.referrer || '').slice(0, 500) || null
      };
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(function (k) { var v = q.get(k); if (v) payload[k] = v.slice(0, 200); });
      btn.disabled = true; btn.textContent = 'Đang gửi…';
      try {
        var r = await fetch(CFG.supabaseUrl + '/rest/v1/rpc/submit_public_lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey },
          body: JSON.stringify({ payload: payload })
        });
        var d = await r.json().catch(function () { return null; });
        if (!r.ok) throw new Error((d && d.message) || 'HTTP ' + r.status);
        var code = typeof d === 'string' ? d : '';
        f.remove();
        state.leadDone = true;
        if (code) fetch(CFG.supabaseUrl + '/rest/v1/rpc/chatbot_attach_lead', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: CFG.supabaseKey }, body: JSON.stringify({ _session: state.sid, _code: code }) }).catch(function () {});
        var msg = 'Em đã nhận thông tin của anh/chị **' + name + '**' + (code ? ' (mã yêu cầu **' + code + '**)' : '') + '. Chuyên viên Zetabiz sẽ liên hệ trong giờ làm việc. Cần gấp, anh/chị gọi **' + CFG.hotlineText + '** nhé!';
        state.msgs.push({ role: 'assistant', content: msg }); save();
        addBubble('assistant', msg); scrollEnd();
        try { if (window.gtag) window.gtag('event', 'generate_lead', { method: 'chatbot' }); if (window.fbq) window.fbq('track', 'Lead'); } catch (x) {}
      } catch (ex) {
        var m = (ex && ex.message) || '';
        bad(/[à-ỹđ]/i.test(m) ? m : 'Chưa gửi được. Anh/chị thử lại hoặc gọi ' + CFG.hotlineText + '.');
        btn.disabled = false; btn.textContent = 'Gửi thông tin';
      }
    });
  }

  function start() {
    build();
    fetch(CFG.api, { headers: { Accept: 'application/json' } }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
      if (!c) return;
      remote = c;
      if (c.enabled === false) { root.hidden = true; return; }
      if (c.name) { panel.querySelector('.zbc-name').textContent = c.name; panel.setAttribute('aria-label', 'Chat với ' + c.name); }
      if (state.open && !state.msgs.length) render();
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
