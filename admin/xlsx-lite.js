/* xlsx-lite – bộ ghi file Excel (.xlsx) tối giản, không phụ thuộc thư viện ngoài.
   Đủ cho biểu mẫu kế toán: gộp ô, viền, căn lề, cỡ/kiểu chữ, định dạng số, công thức, độ rộng cột,
   khổ giấy A4 và co vừa trang khi in. File được nén kiểu STORE (không nén) – Excel, LibreOffice,
   Google Sheets đều mở được.

   Dùng:
     const wb = XL.book();
     const ws = wb.sheet('Phiếu thu', { cols: [12, 12, 30], landscape: false });
     ws.set(1, 1, 'Đơn vị: ...', { b: true });          // hàng, cột tính từ 1
     ws.merge(3, 1, 3, 3, 'PHIẾU THU', { b: true, sz: 16, h: 'center' });
     ws.set(5, 3, 1500000, { fmt: '#,##0', border: true });
     ws.set(6, 3, { f: 'SUM(C2:C5)', v: 1500000 }, { fmt: '#,##0' });
     const bytes = wb.toBytes();   // Uint8Array
*/
(function (root) {
  'use strict';
  const FONT = 'Times New Roman';

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; })
      // ký tự điều khiển không hợp lệ trong XML
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  }
  function colName(c) { let s = ''; while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); } return s; }
  function ref(r, c) { return colName(c) + r; }

  /* ---------- Kiểu ô ---------- */
  function Styles() {
    this.fonts = ['<font><sz val="11"/><name val="' + FONT + '"/><family val="1"/></font>'];
    this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
    this.numFmts = [];
    this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
    this.cache = {};
  }
  Styles.prototype.idx = function (list, xml) { let i = list.indexOf(xml); if (i < 0) { list.push(xml); i = list.length - 1; } return i; };
  Styles.prototype.get = function (st) {
    if (!st) return 0;
    const key = JSON.stringify(st);
    if (this.cache[key] !== undefined) return this.cache[key];
    const font = '<font>' + (st.b ? '<b/>' : '') + (st.i ? '<i/>' : '') + (st.u ? '<u/>' : '') +
      '<sz val="' + (st.sz || 11) + '"/>' + (st.color ? '<color rgb="FF' + st.color + '"/>' : '') + '<name val="' + FONT + '"/><family val="1"/></font>';
    const fontId = this.idx(this.fonts, font);
    const fillId = st.fill ? this.idx(this.fills, '<fill><patternFill patternType="solid"><fgColor rgb="FF' + st.fill + '"/><bgColor indexed="64"/></patternFill></fill>') : 0;
    let borderId = 0;
    if (st.border) {
      const t = st.border === 'medium' ? 'medium' : 'thin';
      const side = function (n) { return '<' + n + ' style="' + t + '"><color auto="1"/></' + n + '>'; };
      const b = st.border === 'bottom' ? '<border><left/><right/><top/>' + '<bottom style="thin"><color auto="1"/></bottom>' + '<diagonal/></border>'
        : st.border === 'dotted' ? '<border><left/><right/><top/><bottom style="dotted"><color auto="1"/></bottom><diagonal/></border>'
        : '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>';
      borderId = this.idx(this.borders, b);
    }
    let numFmtId = 0;
    if (st.fmt) {
      const builtin = { '0': 1, '0.00': 2, '#,##0': 3, '#,##0.00': 4, '0%': 9, 'dd/mm/yyyy': null };
      if (builtin[st.fmt]) numFmtId = builtin[st.fmt];
      else {
        let i = this.numFmts.indexOf(st.fmt);
        if (i < 0) { this.numFmts.push(st.fmt); i = this.numFmts.length - 1; }
        numFmtId = 164 + i;
      }
    }
    const align = (st.h || st.v || st.wrap || st.indent) ? '<alignment' + (st.h ? ' horizontal="' + st.h + '"' : '') + ' vertical="' + (st.v || 'center') + '"' +
      (st.wrap ? ' wrapText="1"' : '') + (st.indent ? ' indent="' + st.indent + '"' : '') + '/>' : '<alignment vertical="center"/>';
    const xf = '<xf numFmtId="' + numFmtId + '" fontId="' + fontId + '" fillId="' + fillId + '" borderId="' + borderId + '" xfId="0"' +
      (numFmtId ? ' applyNumberFormat="1"' : '') + ' applyFont="1"' + (fillId ? ' applyFill="1"' : '') + (borderId ? ' applyBorder="1"' : '') + ' applyAlignment="1">' + align + '</xf>';
    const id = this.idx(this.xfs, xf);
    this.cache[key] = id;
    return id;
  };
  Styles.prototype.xml = function () {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (this.numFmts.length ? '<numFmts count="' + this.numFmts.length + '">' + this.numFmts.map(function (f, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + esc(f) + '"/>'; }).join('') + '</numFmts>' : '') +
      '<fonts count="' + this.fonts.length + '">' + this.fonts.join('') + '</fonts>' +
      '<fills count="' + this.fills.length + '">' + this.fills.join('') + '</fills>' +
      '<borders count="' + this.borders.length + '">' + this.borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + this.xfs.length + '">' + this.xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
  };

  /* ---------- Trang tính ---------- */
  function Sheet(book, name, opts) {
    this.book = book;
    this.name = String(name).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet';
    this.opts = opts || {};
    this.rows = {};      // r -> { c -> {v, s} }
    this.heights = {};
    this.merges = [];
  }
  Sheet.prototype.set = function (r, c, v, st) {
    const row = this.rows[r] = this.rows[r] || {};
    row[c] = { v: v, s: this.book.styles.get(st) };
    return this;
  };
  /* Gộp ô và áp kiểu cho mọi ô trong vùng (để viền hiện đủ) */
  Sheet.prototype.merge = function (r1, c1, r2, c2, v, st) {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) this.set(r, c, r === r1 && c === c1 ? v : null, st);
    if (r1 !== r2 || c1 !== c2) this.merges.push(ref(r1, c1) + ':' + ref(r2, c2));
    return this;
  };
  Sheet.prototype.height = function (r, h) { this.heights[r] = h; return this; };
  Sheet.prototype.lastRow = function () { const k = Object.keys(this.rows).map(Number); return k.length ? Math.max.apply(null, k) : 0; };
  Sheet.prototype.xml = function () {
    const o = this.opts;
    const cols = (o.cols || []).map(function (w, i) { return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'; }).join('');
    const self = this;
    const rows = Object.keys(this.rows).map(Number).sort(function (a, b) { return a - b; }).map(function (r) {
      const cells = self.rows[r];
      const cs = Object.keys(cells).map(Number).sort(function (a, b) { return a - b; }).map(function (c) {
        const cell = cells[c], v = cell.v, rf = ref(r, c), s = cell.s ? ' s="' + cell.s + '"' : '';
        if (v === null || v === undefined || v === '') return '<c r="' + rf + '"' + s + '/>';
        if (typeof v === 'number' && isFinite(v)) return '<c r="' + rf + '"' + s + '><v>' + v + '</v></c>';
        if (typeof v === 'object' && v.f) return '<c r="' + rf + '"' + s + '><f>' + esc(v.f) + '</f>' + (typeof v.v === 'number' ? '<v>' + v.v + '</v>' : '') + '</c>';
        return '<c r="' + rf + '"' + s + ' t="inlineStr"><is><t xml:space="preserve">' + esc(v) + '</t></is></c>';
      }).join('');
      const ht = self.heights[r] ? ' ht="' + self.heights[r] + '" customHeight="1"' : '';
      return '<row r="' + r + '"' + ht + '>' + cs + '</row>';
    }).join('');
    const land = o.landscape ? 'landscape' : 'portrait';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<sheetViews><sheetView workbookViewId="0" showGridLines="' + (o.grid ? 1 : 0) + '"' + (o.zoom ? ' zoomScale="' + o.zoom + '"' : '') + '>' +
      (o.freezeRow ? '<pane ySplit="' + o.freezeRow + '" topLeftCell="A' + (o.freezeRow + 1) + '" activePane="bottomLeft" state="frozen"/>' : '') + '</sheetView></sheetViews>' +
      '<sheetFormatPr defaultRowHeight="16.5"/>' +
      (cols ? '<cols>' + cols + '</cols>' : '') +
      '<sheetData>' + rows + '</sheetData>' +
      (this.merges.length ? '<mergeCells count="' + this.merges.length + '">' + this.merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') +
      '<printOptions horizontalCentered="1"/>' +
      '<pageMargins left="0.5" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="' + land + '" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
  };

  /* ---------- Sổ (workbook) + nén ZIP ---------- */
  function Book() { this.styles = new Styles(); this.sheets = []; }
  Book.prototype.sheet = function (name, opts) {
    const s = new Sheet(this, name, opts);
    // tên trang không được trùng
    let n = s.name, k = 2; while (this.sheets.some(function (x) { return x.name === n; })) n = s.name.slice(0, 28) + ' ' + (k++);
    s.name = n; this.sheets.push(s); return s;
  };
  Book.prototype.files = function () {
    const sh = this.sheets;
    const f = {};
    f['[Content_Types].xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      sh.map(function (s, i) { return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'; }).join('') + '</Types>';
    f['_rels/.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    f['xl/workbook.xml'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>' +
      sh.map(function (s, i) { return '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') + '</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>';
    f['xl/_rels/workbook.xml.rels'] = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      sh.map(function (s, i) { return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'; }).join('') +
      '<Relationship Id="rId' + (sh.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
    sh.forEach(function (s, i) { f['xl/worksheets/sheet' + (i + 1) + '.xml'] = s.xml(); });
    f['xl/styles.xml'] = this.styles.xml();   // sau cùng: các trang đã đăng ký đủ kiểu
    return f;
  };

  let CRC;
  function crc32(bytes) {
    if (!CRC) { CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }
  function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    Object.keys(files).forEach(function (name) {
      const data = enc.encode(files[name]), nm = enc.encode(name), crc = crc32(data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true);
      h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
      parts.push(new Uint8Array(h.buffer), nm, data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
      c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, nm.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
      c.setUint32(38, 0, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), nm);
      offset += 30 + nm.length + data.length;
    });
    const csize = central.reduce(function (s, p) { return s + p.length; }, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, Object.keys(files).length, true); e.setUint16(10, Object.keys(files).length, true);
    e.setUint32(12, csize, true); e.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce(function (s, p) { return s + p.length; }, 0));
    let p = 0; all.forEach(function (a) { out.set(a, p); p += a.length; });
    return out;
  }
  Book.prototype.toBytes = function () { return zip(this.files()); };
  Book.prototype.download = function (filename) {
    const blob = new Blob([this.toBytes()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  root.XL = { book: function () { return new Book(); }, colName: colName, ref: ref };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.XL;
})(typeof window !== 'undefined' ? window : globalThis);
