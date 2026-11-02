/* Zetabiz – bộ chuyển Markdown → HTML gọn, an toàn (escape mọi HTML do người viết nhập).
   Dùng chung: trình soạn blog (window.ZBMD) và trang blog render phía máy chủ (require).
   Hỗ trợ: ## / ### / ####, đoạn văn, **đậm**, *nghiêng*, `code`, [link](url), ![ảnh](url "chú thích"),
   danh sách -, 1., checklist - [ ] / - [x], > trích dẫn, bảng | a | b |, --- , khối ```code```. */
(function (root) {
  'use strict';
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) {
    u = String(u || '').trim();
    if (/^(https?:\/\/|\/|#|mailto:|tel:)/i.test(u) && !/^\/\//.test(u)) return u;
    return '#';
  }
  function slugify(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  }
  /* Định dạng trong dòng: chạy trên chuỗi ĐÃ escape */
  function inline(s) {
    const codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) { codes.push(c); return '\u0000' + (codes.length - 1) + '\u0000'; });
    s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;([^&]*)&quot;)?\)/g, function (_, alt, url, title) {
      return '<img src="' + esc(safeUrl(url.replace(/&amp;/g, '&'))) + '" alt="' + alt + '" loading="lazy"' + (title ? ' title="' + title + '"' : '') + '>';
    });
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, txt, url) {
      const u = safeUrl(url.replace(/&amp;/g, '&'));
      const ext = /^https?:\/\//i.test(u) && !/^https?:\/\/(www\.)?mhtbiz\.com/i.test(u);
      return '<a href="' + esc(u) + '"' + (ext ? ' target="_blank" rel="noopener nofollow"' : '') + '>' + txt + '</a>';
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s.replace(/\u0000(\d+)\u0000/g, function (_, i) { return '<code>' + codes[Number(i)] + '</code>'; });
  }
  function render(md, opts) {
    opts = opts || {};
    const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
    const out = [], toc = [], used = {};
    let i = 0;
    function para(buf) { if (buf.length) out.push('<p>' + inline(esc(buf.join(' '))) + '</p>'); }
    let buf = [];
    while (i < lines.length) {
      const ln = lines[i];
      if (/^```/.test(ln)) {
        para(buf); buf = [];
        const code = []; i++;
        while (i < lines.length && !/^```/.test(lines[i])) { code.push(lines[i]); i++; }
        i++; out.push('<pre><code>' + esc(code.join('\n')) + '</code></pre>'); continue;
      }
      let m = /^(#{2,4})\s+(.+?)\s*#*$/.exec(ln);
      if (m) {
        para(buf); buf = [];
        const lv = m[1].length, txt = m[2]; let id = slugify(txt) || 'muc';
        if (used[id]) id += '-' + (++used[id]); else used[id] = 1;
        if (lv === 2) toc.push({ id: id, text: txt });
        out.push('<h' + lv + ' id="' + id + '">' + inline(esc(txt)) + '</h' + lv + '>'); i++; continue;
      }
      if (/^\s*(-{3,}|\*{3,})\s*$/.test(ln)) { para(buf); buf = []; out.push('<hr>'); i++; continue; }
      if (/^>\s?/.test(ln)) {
        para(buf); buf = [];
        const q = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) { q.push(lines[i].replace(/^>\s?/, '')); i++; }
        out.push('<blockquote>' + q.filter(Boolean).map(function (x) { return '<p>' + inline(esc(x)) + '</p>'; }).join('') + '</blockquote>'); continue;
      }
      if (/^\s*\|.*\|\s*$/.test(ln) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
        para(buf); buf = [];
        const cells = function (r) { return r.trim().replace(/^\||\|$/g, '').split('|').map(function (c) { return c.trim(); }); };
        const hd = cells(ln); i += 2; const rows = [];
        while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push('<div class="tbl"><table><thead><tr>' + hd.map(function (c) { return '<th>' + inline(esc(c)) + '</th>'; }).join('') + '</tr></thead><tbody>' +
          rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + inline(esc(c)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'); continue;
      }
      if (/^\s*([-*+]|\d+[.)])\s+/.test(ln)) {
        para(buf); buf = [];
        const ordered = /^\s*\d/.test(ln), items = [];
        while (i < lines.length && /^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) {
          let t = lines[i].replace(/^\s*([-*+]|\d+[.)])\s+/, ''); i++;
          while (i < lines.length && /^\s{2,}\S/.test(lines[i]) && !/^\s*([-*+]|\d+[.)])\s+/.test(lines[i])) { t += ' ' + lines[i].trim(); i++; }
          items.push(t);
        }
        const check = items.every(function (t) { return /^\[[ xX]\]\s/.test(t); });
        out.push('<' + (ordered ? 'ol' : 'ul') + (check ? ' class="check"' : '') + '>' + items.map(function (t) {
          if (check) { const done = /^\[[xX]\]/.test(t); return '<li class="' + (done ? 'done' : '') + '">' + inline(esc(t.replace(/^\[[ xX]\]\s/, ''))) + '</li>'; }
          return '<li>' + inline(esc(t)) + '</li>';
        }).join('') + '</' + (ordered ? 'ol' : 'ul') + '>'); continue;
      }
      if (/^\s*$/.test(ln)) { para(buf); buf = []; i++; continue; }
      buf.push(ln.trim()); i++;
    }
    para(buf);
    return opts.withToc ? { html: out.join('\n'), toc: toc } : out.join('\n');
  }
  /* Chữ thuần để đếm từ / kiểm tra từ khóa */
  function text(md) { return String(md || '').replace(/```[\s\S]*?```/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[#>*`|_-]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  function links(md) { const r = [], re = /(!?)\[([^\]]*)\]\(([^)\s]+)/g; let m; while ((m = re.exec(String(md || '')))) r.push({ image: !!m[1], text: m[2], url: m[3] }); return r; }
  const api = { render: render, esc: esc, slugify: slugify, text: text, links: links };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ZBMD = api;
})(typeof window !== 'undefined' ? window : this);
