/* Trợ lý tư vấn Zetabiz – hàm serverless trên Vercel.
   - GET  /api/chat            -> cấu hình khung chat (tên, lời chào, câu hỏi gợi ý, bật/tắt)
   - POST /api/chat            -> { messages, session } trả lời khách
   - POST /api/chat (nhân viên) -> { messages, preview: <bản nháp cấu hình>, showPrompt } kèm
                                   header Authorization: Bearer <phiên đăng nhập quản trị>
   Kiến thức lấy từ Quản trị › Đào tạo Trợ lý AI (settings 'chatbot_ai') và Nội dung trang ('zetabiz_site').
   AI gọi qua Vercel AI Gateway (OIDC tự động trên Vercel, hoặc AI_GATEWAY_API_KEY).
   Khi AI lỗi: trả lời theo hỏi đáp đã đào tạo, rồi theo từ khoá.

   Biến môi trường:
   - CHATBOT_SERVER_TOKEN : khoá để đọc cấu hình / ghi nhật ký qua RPC Supabase (bắt buộc)
   - AI_GATEWAY_API_KEY   : tuỳ chọn
   - CHAT_MODEL           : model chính, mặc định anthropic/claude-haiku-4.5
*/
const KB = require('./_kb.js');

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const MODELS = [process.env.CHAT_MODEL || 'anthropic/claude-haiku-4.5', 'google/gemini-2.5-flash', 'openai/gpt-4.1-mini'];
const SB_URL = 'https://zuucoqfylagcfwnhomet.supabase.co';
const SB_KEY = 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq';
const SERVER_TOKEN = process.env.CHATBOT_SERVER_TOKEN || '';
const MAX_TURNS = 16;          // số tin gần nhất gửi cho AI
const MAX_MSG_CHARS = 1000;    // độ dài tối đa một tin của khách
const RATE_LIMIT = 20;         // số câu hỏi / IP / 10 phút
const RATE_WINDOW_MS = 10 * 60 * 1000;
const CONFIG_TTL_MS = 60 * 1000;
const ALLOWED_ORIGINS = /^(https:\/\/((www\.)?mhtbiz\.com|[a-z0-9-]+\.vercel\.app)|http:\/\/localhost(:\d+)?)$/i;

const HOTLINE = '0918 566 177';
const EMAIL = 'info@mhtbiz.com';

/* ---------- Dự phòng: trả lời theo từ khoá khi AI không phản hồi ---------- */
function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
}
const FALLBACK = [
  { k: ['garage', 'gara', 'o to', 'sua xe', 'autopro', 'phu tung'],
    a: '**Zetabiz AutoPro** dành cho garage ô tô: tiếp nhận xe, lệnh sửa chữa, lịch sử xe, kho phụ tùng, chia việc thợ và thanh toán. AI tự nhắc khách đến hạn bảo dưỡng. Anh/chị muốn nhận báo giá theo quy mô xưởng không ạ? [[FORM]]' },
  { k: ['xuat ve', 'booking'],
    a: '**Zetabiz SkyAgent** không kết nối hãng/GDS để đặt chỗ hay xuất vé. Anh/chị vẫn đặt chỗ, xuất vé trên hệ thống của hãng/GDS như hiện nay; SkyAgent dùng để nhập và quản lý vé đã xuất, công nợ khách và hãng, vé đoàn, đại lý cấp dưới và sổ sách. Anh/chị cần em tư vấn phần nào ạ?' },
  { k: ['ve may bay', 'dai ly ve', 'skyagent'],
    a: '**Zetabiz SkyAgent** dành cho đại lý vé máy bay: nhập vé từ file hãng hoặc PNR/GDS, công nợ khách và công nợ hãng, vé đoàn, cổng cho đại lý cấp dưới, sổ quỹ – sổ cái và nhân sự – lương. Anh/chị để lại thông tin để nhận bảng giá và tài khoản dùng thử nhé. [[FORM]]' },
  { k: ['spa', 'tham my', 'lieu trinh', 'spacare', 'salon'],
    a: '**Zetabiz SpaCare** dành cho spa & thẩm mỹ: đặt lịch online, thẻ liệu trình, hoa hồng kỹ thuật viên; AI nhắc khách quay lại. Anh/chị muốn em gửi báo giá không ạ? [[FORM]]' },
  { k: ['san xuat', 'nha may', 'xuong', 'factory', 'nguyen lieu', 'gia thanh'],
    a: '**Zetabiz FactoryOne** dành cho sản xuất & thương mại: định mức nguyên liệu, lệnh sản xuất, tính giá thành thực tế; AI cảnh báo thiếu nguyên liệu. Anh/chị để lại thông tin để chuyên viên tư vấn nhé. [[FORM]]' },
  { k: ['thuong mai', 'ban hang', 'cua hang', 'tradehub', 'ban le', 'ton kho', 'kho'],
    a: '**Zetabiz TradeHub** dành cho thương mại: bán tại cửa hàng và online, tồn kho khớp giữa các kênh, công nợ khách và nhà cung cấp; AI gợi ý nhập hàng. Anh/chị kinh doanh mặt hàng gì ạ?' },
  { k: ['gia', 'bao gia', 'chi phi', 'bao nhieu', 'phi', 'goi'],
    a: 'Zetabiz báo giá theo ngành và quy mô doanh nghiệp để anh/chị chỉ trả cho phần thực sự dùng. Anh/chị để lại thông tin, chuyên viên sẽ gửi báo giá phù hợp trong giờ làm việc ạ. [[FORM]]' },
  { k: ['cai dat', 'cai phan mem', 'dien thoai', 'trinh duyet'],
    a: 'Anh/chị không cần cài đặt gì cả. Zetabiz chạy trên web, chỉ cần đăng nhập là dùng ngay trên máy tính hoặc điện thoại.' },
  { k: ['dung thu', 'demo', 'trial'],
    a: 'Anh/chị để lại thông tin, chuyên viên Zetabiz sẽ liên hệ để giới thiệu và hướng dẫn trải nghiệm giải pháp phù hợp ạ. [[FORM]]' },
  { k: ['chuyen vien', 'gap nguoi', 'nhan vien'],
    a: 'Dạ, anh/chị để lại thông tin, chuyên viên Zetabiz sẽ gọi lại trong giờ làm việc. Cần gấp, anh/chị gọi ngay **0918 566 177** nhé. [[FORM]]' },
  { k: ['giai phap', 'tu van', 'phan mem', 'nganh'],
    a: 'Zetabiz có phần mềm riêng cho từng ngành:\n- **AutoPro**: garage ô tô\n- **SkyAgent**: đại lý vé máy bay\n- **SpaCare**: spa & thẩm mỹ\n- **TradeHub**: thương mại\n- **FactoryOne**: sản xuất & thương mại\nAnh/chị đang kinh doanh lĩnh vực nào để em tư vấn đúng giải pháp ạ?' },
  { k: ['chao', 'hello', 'hi', 'alo'],
    a: 'Em chào anh/chị! Em là Trợ lý Zetabiz. Anh/chị đang cần tìm phần mềm quản lý cho lĩnh vực nào ạ?' },
  { k: ['lien he', 'hotline', 'so dien thoai', 'dia chi', 'email', 'zalo', 'goi'],
    a: `Anh/chị có thể liên hệ Zetabiz qua hotline/Zalo **${HOTLINE}** hoặc email **${EMAIL}**. Văn phòng: 95 Nguyễn Thị Minh Khai, Phường Thành Vinh, Nghệ An. [[FORM]]` },
];
function fallbackReply(text) {
  /* so khớp theo từ nguyên vẹn: "gia" không được khớp nhầm với "giai phap" */
  const t = ' ' + norm(text).replace(/[^a-z0-9]+/g, ' ') + ' ';
  for (const r of FALLBACK) if (r.k.some(function (k) { return t.includes(' ' + k + ' '); })) return r.a;
  return `Cảm ơn anh/chị đã nhắn tin. Hiện em chưa trả lời chi tiết được câu này; anh/chị vui lòng để lại thông tin hoặc gọi **${HOTLINE}** để chuyên viên hỗ trợ ngay ạ. [[FORM]]`;
}


/* ---------- Supabase ---------- */
async function sbFetch(path, opts, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(function () { ctrl.abort(); }, ms || 4000);
  try {
    const r = await fetch(SB_URL + path, Object.assign({ signal: ctrl.signal }, opts));
    const txt = await r.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!r.ok) throw new Error('Supabase ' + r.status + ' ' + String(txt).slice(0, 200));
    return data;
  } finally { clearTimeout(t); }
}
function rpc(name, args, jwt) {
  return sbFetch('/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: Object.assign({ apikey: SB_KEY, 'Content-Type': 'application/json' }, jwt ? { Authorization: 'Bearer ' + jwt } : {}),
    body: JSON.stringify(args || {})
  });
}

/* Cấu hình đã lưu, lưu đệm 60 giây */
let cache = { at: 0, data: null };
async function loadConfig() {
  if (cache.data && Date.now() - cache.at < CONFIG_TTL_MS) return cache.data;
  let data = { ai: null, site: null };
  if (SERVER_TOKEN) {
    try { data = (await rpc('chatbot_runtime', { _token: SERVER_TOKEN })) || data; }
    catch (e) {
      console.error('[chat] config error:', e && e.message);
      if (cache.data) return cache.data; /* dùng tạm bản cũ nếu Supabase lỗi */
    }
  } else {
    console.error('[chat] thiếu CHATBOT_SERVER_TOKEN – dùng kiến thức mặc định');
  }
  cache = { at: Date.now(), data: data };
  return data;
}

/* Xác minh nhân viên (để thử bản nháp) – lưu đệm 5 phút */
const staffCache = new Map();
async function isStaff(jwt) {
  if (!jwt || jwt.length > 4000) return false;
  const hit = staffCache.get(jwt);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.ok;
  let ok = false;
  try {
    const u = await sbFetch('/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + jwt } });
    if (u && u.id) ok = (await rpc('is_staff', { _user_id: u.id }, jwt)) === true;
  } catch (e) { ok = false; }
  if (staffCache.size > 200) staffCache.clear();
  staffCache.set(jwt, { ok: ok, at: Date.now() });
  return ok;
}

async function logTurn(session, history, reply, page, fallback) {
  if (!SERVER_TOKEN || !session) return;
  const msgs = history.concat([{ role: 'assistant', content: reply }]).map(function (m) {
    return { role: m.role, content: String(m.content).slice(0, 2000), at: new Date().toISOString() };
  });
  try { await rpc('chatbot_log', { _token: SERVER_TOKEN, _session: session, _messages: msgs, _page: page || null, _fallback: !!fallback }); }
  catch (e) { console.error('[chat] log error:', e && e.message); }
}

/* ---------- Giới hạn tần suất đơn giản (theo từng instance) ---------- */
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const arr = (hits.get(ip) || []).filter(function (t) { return now - t < RATE_WINDOW_MS; });
  arr.push(now);
  hits.set(ip, arr);
  if (hits.size > 5000) { for (const key of hits.keys()) { hits.delete(key); if (hits.size < 2500) break; } }
  return arr.length > RATE_LIMIT;
}

function cleanHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const m of raw.slice(-MAX_TURNS)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant')) continue;
    const content = String(m.content || '').replace(/\[\[FORM\]\]/g, '').slice(0, MAX_MSG_CHARS * 2).trim();
    if (content) out.push({ role: m.role, content: content });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

async function callGateway(token, messages) {
  let lastErr;
  for (const model of MODELS) {
    const ctrl = new AbortController();
    const timer = setTimeout(function () { ctrl.abort(); }, 20000);
    try {
      const r = await fetch(GATEWAY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ model: model, messages: messages, max_tokens: 700, temperature: 0.4 }),
        signal: ctrl.signal,
      });
      if (!r.ok) {
        const body = (await r.text()).slice(0, 300);
        lastErr = new Error(model + ' HTTP ' + r.status + ' ' + body);
        /* lỗi tài khoản (chưa có thẻ, hết hạn mức…) thì model khác cũng lỗi y hệt */
        if (r.status === 401 || r.status === 402 || r.status === 403) break;
        continue;
      }
      const d = await r.json();
      const text = d && d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content;
      if (typeof text === 'string' && text.trim()) return text.trim();
      lastErr = new Error(model + ' empty response');
    } catch (e) {
      lastErr = e;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr || new Error('no model');
}

function send(res, status, body, cacheable) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', cacheable ? 'public, max-age=0, s-maxage=60, stale-while-revalidate=300' : 'no-store');
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || '';
  if (origin && ALLOWED_ORIGINS.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end(); }

  if (req.method === 'GET') {
    const cfg = await loadConfig();
    return send(res, 200, KB.widgetConfig(cfg.ai, cfg.site), true);
  }
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (origin && !ALLOWED_ORIGINS.test(origin)) return send(res, 403, { error: 'Forbidden' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  body = body || {};

  /* Chế độ thử của nhân viên: dùng bản nháp chưa lưu, không ghi nhật ký, không giới hạn tần suất */
  const auth = String(req.headers.authorization || '');
  const jwt = /^Bearer\s+(.+)$/i.test(auth) ? auth.replace(/^Bearer\s+/i, '').trim() : '';
  const wantsPreview = body.preview && typeof body.preview === 'object';
  const staff = (wantsPreview || body.showPrompt) ? await isStaff(jwt) : false;
  if ((wantsPreview || body.showPrompt) && !staff) return send(res, 401, { error: 'Cần đăng nhập quản trị để thử bản nháp.' });

  const cfg = await loadConfig();
  const aiCfg = wantsPreview ? body.preview : cfg.ai;
  const prompt = KB.buildPrompt(aiCfg, cfg.site);
  if (body.showPrompt) return send(res, 200, { prompt: prompt, chars: prompt.length });

  const history = cleanHistory(body.messages);
  const last = history[history.length - 1];
  if (!last || last.role !== 'user') return send(res, 400, { error: 'Thiếu nội dung câu hỏi.' });
  if (last.content.length > MAX_MSG_CHARS) return send(res, 400, { error: 'Tin nhắn quá dài, anh/chị vui lòng rút gọn giúp em.' });
  if (!staff && !KB.normalizeAI(cfg.ai).enabled) return send(res, 200, { reply: 'Hiện khung chat đang tạm nghỉ. Anh/chị vui lòng gọi **' + HOTLINE + '** hoặc email **' + EMAIL + '** để được hỗ trợ ạ.', mode: 'off' });

  const ip = String(req.headers['x-forwarded-for'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
  if (!staff && rateLimited(ip)) {
    return send(res, 429, { reply: 'Anh/chị đã gửi nhiều tin trong thời gian ngắn. Vui lòng chờ ít phút hoặc gọi **' + HOTLINE + '** để được hỗ trợ ngay ạ.' });
  }

  const session = typeof body.session === 'string' && /^[A-Za-z0-9_-]{8,64}$/.test(body.session) ? body.session : null;
  const page = typeof body.page === 'string' ? body.page.slice(0, 300) : null;
  const token = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;

  let reply, mode;
  try {
    if (!token) throw new Error('no AI token');
    reply = await callGateway(token, [{ role: 'system', content: prompt }].concat(history));
    mode = 'ai';
  } catch (e) {
    console.error('[chat] AI error:', e && e.message);
    const faq = KB.faqMatch(aiCfg, cfg.site, last.content);
    reply = faq || fallbackReply(last.content);
    mode = faq ? 'faq' : 'fallback';
  }
  if (!staff) await logTurn(session, history, reply, page, mode !== 'ai');
  return send(res, 200, { reply: reply, mode: mode });
};

module.exports.fallbackReply = fallbackReply;
module.exports.cleanHistory = cleanHistory;
