/* Blog Zetabiz – trang render sẵn phía máy chủ (tốt cho SEO) + sitemap.xml + robots.txt.
   Định tuyến (vercel.json):
     /blog                 -> danh sách bài (?trang=2)
     /blog/chu-de/:cat     -> bài theo chuyên mục
     /blog/:slug           -> chi tiết bài
     /sitemap.xml, /robots.txt
   Dữ liệu đọc từ Supabase bằng khoá công khai; RLS chỉ trả bài đã xuất bản và đã tới giờ đăng
   (bài hẹn giờ = trạng thái "Đã xuất bản" với ngày đăng ở tương lai, tự hiện khi tới giờ). */
const MD = require('../assets/md.js');

const SB_URL = 'https://zuucoqfylagcfwnhomet.supabase.co';
const SB_KEY = 'sb_publishable_LVQhPQFXraB7C_1i0VtFlw_WndNHxAq';
const SITE = 'https://mhtbiz.com';
const PER_PAGE = 12;
const esc = MD.esc;

async function sb(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, { headers: { apikey: SB_KEY, Accept: 'application/json' } });
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + (await r.text()).slice(0, 200));
  return r.json();
}
const ART_COLS = 'id,title,slug,excerpt,published_at,updated_at,reading_minutes,featured_image_url,featured_image_alt,category_id,category:blog_categories(name,slug)';

function vnDate(d) {
  const x = new Date(d);
  if (isNaN(x)) return '';
  const p = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(x);
  return p;
}
function abs(u) { return !u ? '' : /^https?:\/\//i.test(u) ? u : SITE + (u[0] === '/' ? '' : '/') + u; }
function ld(obj) { return '<script type="application/ld+json">' + JSON.stringify(obj).replace(/</g, '\\u003c') + '</script>'; }

const CSS = `
:root{--bg:#F6F8FC;--card:#fff;--line:#DCE3EE;--text:#0B1B3F;--text-2:#33405E;--muted:#5B6785;--primary:#1D4ED8;--primary-soft:#E6EDFD;--accent:#F97316;--font:'Be Vietnam Pro',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.7 var(--font)}
a{color:var(--primary)}img{max-width:100%;height:auto}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:12px;background:#fff;padding:8px 12px;z-index:9}
header.top{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}
.wrap{max-width:1120px;margin:0 auto;padding:0 clamp(16px,3vw,28px)}
.top .wrap{display:flex;align-items:center;gap:18px;min-height:64px}
.logo{display:flex;align-items:center;gap:10px;font:700 20px Poppins,var(--font);color:var(--text);text-decoration:none}
.top nav{display:flex;gap:4px;margin-left:auto;flex-wrap:wrap}
.top nav a{padding:8px 12px;border-radius:10px;color:var(--text-2);text-decoration:none;font-size:15px}
.top nav a:hover,.top nav a[aria-current]{background:var(--primary-soft);color:var(--primary)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 18px;border-radius:12px;background:var(--primary);color:#fff;font-weight:600;text-decoration:none;border:0;cursor:pointer;font:600 15px var(--font)}
.btn.ghost{background:#fff;color:var(--primary);border:1px solid var(--line)}
@media (max-width:720px){.top nav a.hide-m{display:none}}
.hero{padding:44px 0 24px}.hero h1{font:700 clamp(28px,4vw,40px)/1.25 Poppins,var(--font);margin:0 0 8px}.hero p{color:var(--muted);margin:0;max-width:720px}
.cats{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 6px}
.cats a{padding:6px 14px;border-radius:99px;background:#fff;border:1px solid var(--line);text-decoration:none;color:var(--text-2);font-size:14px}
.cats a[aria-current]{background:var(--primary);border-color:var(--primary);color:#fff}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:20px;padding:18px 0 48px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden;display:flex;flex-direction:column;text-decoration:none;color:inherit;transition:box-shadow .15s,transform .15s}
.card:hover{box-shadow:0 10px 30px rgba(11,27,63,.08);transform:translateY(-2px)}
.card .ph{aspect-ratio:16/9;background:linear-gradient(135deg,#1D4ED8,#0EA5E9);display:flex;align-items:flex-end;padding:16px;color:#fff;font:600 14px var(--font)}
.card .ph img{width:100%;height:100%;object-fit:cover}
.card .ph.img{padding:0}.card .ph:not(.img){aspect-ratio:auto;min-height:96px;background:linear-gradient(135deg,#0B1B3F,#1D4ED8 60%,#0EA5E9)}
.card .b{padding:16px 18px 20px;display:flex;flex-direction:column;gap:8px;flex:1}
.card h2{font:600 19px/1.4 var(--font);margin:0}.card p{margin:0;color:var(--muted);font-size:15px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.meta{font-size:13px;color:var(--muted);display:flex;gap:10px;flex-wrap:wrap}
.pager{display:flex;gap:10px;justify-content:center;padding-bottom:48px}
.crumb{font-size:14px;color:var(--muted);padding-top:24px}.crumb a{color:var(--muted)}
.post{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:40px;padding:12px 0 48px}
@media (max-width:960px){.post{grid-template-columns:1fr}aside .box{position:static}}
article h1{font:700 clamp(28px,4vw,40px)/1.25 Poppins,var(--font);margin:8px 0 12px}
article .lead{font-size:18px;color:var(--text-2)}
article .cover{border-radius:18px;margin:18px 0;display:block}
.prose h2{font:700 25px/1.35 var(--font);margin:36px 0 10px;scroll-margin-top:84px}
.prose h3{font:600 20px/1.4 var(--font);margin:26px 0 8px;scroll-margin-top:84px}
.prose h4{font-size:17px;margin:20px 0 6px}
.prose p,.prose li{color:var(--text-2)}
.prose ul,.prose ol{padding-left:22px}.prose li{margin:4px 0}
.prose ul.check{list-style:none;padding-left:0}.prose ul.check li{padding-left:30px;position:relative}
.prose ul.check li::before{content:'';position:absolute;left:0;top:5px;width:18px;height:18px;border:2px solid var(--primary);border-radius:5px}
.prose ul.check li.done::before{background:var(--primary)}
.prose blockquote{margin:18px 0;padding:6px 18px;border-left:4px solid var(--primary);background:var(--primary-soft);border-radius:0 12px 12px 0}
.prose pre{background:#0B1B3F;color:#E6EDFD;padding:16px;border-radius:12px;overflow-x:auto;font-size:14px}
.prose code{background:#EEF2F8;padding:1px 6px;border-radius:6px;font-size:.92em}.prose pre code{background:none;padding:0}
.prose .tbl{overflow-x:auto}.prose table{border-collapse:collapse;width:100%;font-size:15px}.prose th,.prose td{border:1px solid var(--line);padding:8px 10px;text-align:left}.prose th{background:#EEF2F8}
.prose img{border-radius:12px}
aside .box{position:sticky;top:84px;display:flex;flex-direction:column;gap:16px}
.toc{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;font-size:14px}
.toc b{display:block;margin-bottom:6px}.toc ol{margin:0;padding-left:18px}.toc a{color:var(--text-2);text-decoration:none}.toc a:hover{color:var(--primary)}
.cta{background:linear-gradient(135deg,#0B1B3F,#1D4ED8);color:#fff;border-radius:18px;padding:22px;display:flex;flex-direction:column;gap:10px}
.cta p{margin:0;color:#DCE6FF;font-size:15px}.cta b{font-size:18px}.cta .btn{background:#fff;color:var(--primary)}
.faq{margin-top:36px}.faq details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:10px 0}
.faq summary{font-weight:600;cursor:pointer}.faq details p{margin:8px 0 0;color:var(--text-2)}
.related{border-top:1px solid var(--line);padding-top:28px}
.src{font-size:14px;color:var(--muted)}
footer{background:#fff;border-top:1px solid var(--line);padding:28px 0;font-size:14px;color:var(--muted)}
footer .wrap{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
`;

function page(o) {
  const title = esc(o.title), desc = esc(o.description || '');
  return `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>
<meta name="description" content="${desc}">
${o.noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow, max-image-preview:large">'}
${o.canonical ? `<link rel="canonical" href="${esc(o.canonical)}">` : ''}
<link rel="alternate" type="application/rss+xml" title="Blog Zetabiz" href="${SITE}/blog/rss.xml">
<meta property="og:site_name" content="Zetabiz">
<meta property="og:locale" content="vi_VN">
<meta property="og:type" content="${o.ogType || 'website'}">
<meta property="og:title" content="${esc(o.ogTitle || o.title)}">
<meta property="og:description" content="${desc}">
${o.canonical ? `<meta property="og:url" content="${esc(o.canonical)}">` : ''}
${o.image ? `<meta property="og:image" content="${esc(o.image)}"><meta name="twitter:card" content="summary_large_image">` : '<meta name="twitter:card" content="summary">'}
${o.published ? `<meta property="article:published_time" content="${esc(o.published)}">` : ''}
${o.modified ? `<meta property="article:modified_time" content="${esc(o.modified)}">` : ''}
<link rel="icon" type="image/png" href="/assets/zetabiz-mark-64.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Be+Vietnam+Pro:wght@400;500;600;700&display=swap">
<style>${CSS}</style>
${(o.ld || []).map(ld).join('\n')}
</head>
<body>
<a class="skip" href="#noi-dung">Bỏ qua, tới nội dung</a>
<header class="top"><div class="wrap">
<a class="logo" href="/"><img src="/assets/zetabiz-mark-64.png" alt="" width="30" height="31">Zetabiz</a>
<nav aria-label="Điều hướng chính"><a class="hide-m" href="/">Trang chủ</a><a href="/blog"${o.section === 'blog' ? ' aria-current="page"' : ''}>Blog</a><a class="hide-m" href="/bao-gia/">Bảng giá</a><a href="/tai-khoan/">Đăng nhập</a></nav>
</div></header>
<main id="noi-dung">${o.body}</main>
<footer><div class="wrap"><span>© ${new Date().getFullYear()} Zetabiz · CÔNG TY CỔ PHẦN TƯ VẤN VÀ GIẢI PHÁP MHT</span><span>0918 566 177 · info@mhtbiz.com · <a href="/chinh-sach-bao-mat/">Chính sách bảo mật</a></span></div></footer>
<script src="/assets/zb-chat.js" defer></script>
</body>
</html>`;
}

function card(a) {
  const cat = a.category && a.category.name;
  return `<a class="card" href="/blog/${esc(a.slug)}">
<div class="ph${a.featured_image_url ? ' img' : ''}">${a.featured_image_url ? `<img src="${esc(a.featured_image_url)}" alt="${esc(a.featured_image_alt || '')}" loading="lazy" width="640" height="360">` : esc(cat || 'Zetabiz')}</div>
<div class="b"><div class="meta">${cat ? `<span>${esc(cat)}</span>` : ''}<span>${vnDate(a.published_at)}</span>${a.reading_minutes ? `<span>${a.reading_minutes} phút đọc</span>` : ''}</div>
<h2>${esc(a.title)}</h2><p>${esc(a.excerpt || '')}</p></div></a>`;
}

async function listPage(req, res, catSlug) {
  const pg = Math.max(1, parseInt(req.query.trang || '1', 10) || 1);
  const cats = await sb('blog_categories?select=id,name,slug,description&order=sort_order');
  let cat = null;
  if (catSlug) { cat = cats.find(function (c) { return c.slug === catSlug; }); if (!cat) return notFound(res); }
  const q = 'blog_articles?select=' + ART_COLS + (cat ? '&category_id=eq.' + cat.id : '') + '&order=published_at.desc&limit=' + (PER_PAGE + 1) + '&offset=' + (pg - 1) * PER_PAGE;
  const rows = await sb(q);
  const more = rows.length > PER_PAGE, list = rows.slice(0, PER_PAGE);
  if (pg > 1 && !list.length) return notFound(res);
  const base = cat ? '/blog/chu-de/' + cat.slug : '/blog';
  const canonical = SITE + base + (pg > 1 ? '?trang=' + pg : '');
  const h1 = cat ? cat.name : 'Blog Zetabiz';
  const intro = cat ? (cat.description || 'Các bài viết về ' + cat.name + '.') : 'Kiến thức quản trị, chuyển đổi số và vận hành doanh nghiệp bằng phần mềm SaaS tích hợp AI.';
  const body = `<div class="wrap">
<section class="hero"><h1>${esc(h1)}</h1><p>${esc(intro)}</p>
<nav class="cats" aria-label="Chuyên mục"><a href="/blog"${!cat ? ' aria-current="page"' : ''}>Tất cả</a>${cats.map(function (c) { return `<a href="/blog/chu-de/${esc(c.slug)}"${cat && cat.id === c.id ? ' aria-current="page"' : ''}>${esc(c.name)}</a>`; }).join('')}</nav></section>
${list.length ? `<div class="grid">${list.map(card).join('')}</div>` : '<p style="padding:24px 0 60px;color:var(--muted)">Chưa có bài viết trong chuyên mục này.</p>'}
${pg > 1 || more ? `<nav class="pager" aria-label="Phân trang">${pg > 1 ? `<a class="btn ghost" href="${base}${pg > 2 ? '?trang=' + (pg - 1) : ''}" rel="prev">‹ Trang trước</a>` : ''}${more ? `<a class="btn ghost" href="${base}?trang=${pg + 1}" rel="next">Trang sau ›</a>` : ''}</nav>` : ''}
</div>`;
  const ldList = { '@context': 'https://schema.org', '@type': 'Blog', name: h1, url: canonical, blogPost: list.map(function (a) { return { '@type': 'BlogPosting', headline: a.title, url: SITE + '/blog/' + a.slug, datePublished: a.published_at }; }) };
  send(res, 200, page({ title: (cat ? cat.name + ' – ' : '') + 'Blog Zetabiz' + (pg > 1 ? ' – trang ' + pg : ''), description: intro, canonical: canonical, section: 'blog', body: body, ld: [ldList] }));
}

async function articlePage(req, res, slug) {
  const rows = await sb('blog_articles?select=*,category:blog_categories(id,name,slug),author:blog_authors(name,slug,title,bio,is_organization)&slug=eq.' + encodeURIComponent(slug) + '&limit=1');
  const a = rows[0];
  if (!a) return notFound(res);
  const r = MD.render(a.content, { withToc: true });
  const url = SITE + '/blog/' + a.slug;
  const canonical = a.canonical_url ? abs(a.canonical_url) : url;
  const related = a.category_id ? await sb('blog_articles?select=' + ART_COLS + '&category_id=eq.' + a.category_id + '&id=neq.' + a.id + '&order=published_at.desc&limit=3') : [];
  if (related.length < 3) {
    const more = await sb('blog_articles?select=' + ART_COLS + '&id=neq.' + a.id + '&order=published_at.desc&limit=6');
    more.forEach(function (x) { if (related.length < 3 && !related.some(function (y) { return y.id === x.id; })) related.push(x); });
  }
  const faqs = Array.isArray(a.faqs) ? a.faqs.filter(function (f) { return f && f.question && f.answer; }) : [];
  const srcs = Array.isArray(a.source_references) ? a.source_references.filter(function (s) { return s && (s.url || s.title); }) : [];
  const author = a.author || { name: 'Ban biên tập Zetabiz', is_organization: true };
  const img = a.og_image || a.featured_image_url;
  const body = `<div class="wrap">
<nav class="crumb" aria-label="Đường dẫn"><a href="/">Trang chủ</a> › <a href="/blog">Blog</a>${a.category ? ` › <a href="/blog/chu-de/${esc(a.category.slug)}">${esc(a.category.name)}</a>` : ''}</nav>
<div class="post"><article>
<h1>${esc(a.title)}</h1>
<div class="meta"><span>${esc(author.name)}</span><span>Đăng ${vnDate(a.published_at)}</span>${a.updated_at && new Date(a.updated_at) - new Date(a.published_at) > 864e5 ? `<span>Cập nhật ${vnDate(a.updated_at)}</span>` : ''}${a.reading_minutes ? `<span>${a.reading_minutes} phút đọc</span>` : ''}</div>
${a.excerpt ? `<p class="lead">${esc(a.excerpt)}</p>` : ''}
${a.featured_image_url ? `<img class="cover" src="${esc(a.featured_image_url)}" alt="${esc(a.featured_image_alt || a.title)}" width="1200" height="630">` : ''}
<div class="prose">${r.html}</div>
${faqs.length ? `<section class="faq" aria-labelledby="hoi-dap"><h2 id="hoi-dap" style="font-size:25px">Câu hỏi thường gặp</h2>${faqs.map(function (f) { return `<details><summary>${esc(f.question)}</summary><p>${esc(f.answer)}</p></details>`; }).join('')}</section>` : ''}
${srcs.length ? `<section class="src"><h2 style="font-size:18px">Nguồn tham khảo</h2><ol>${srcs.map(function (s) { return `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">${esc(s.title || s.url)}</a>` : esc(s.title)}</li>`; }).join('')}</ol></section>` : ''}
</article>
<aside><div class="box">
${r.toc.length >= 3 ? `<nav class="toc" aria-label="Mục lục"><b>Mục lục</b><ol>${r.toc.map(function (t) { return `<li><a href="#${t.id}">${esc(t.text)}</a></li>`; }).join('')}</ol></nav>` : ''}
<div class="cta"><b>Cần tư vấn phần mềm cho doanh nghiệp?</b><p>Zetabiz có giải pháp cho garage, đại lý vé, spa, thương mại và sản xuất. Tư vấn miễn phí theo hiện trạng.</p><a class="btn" href="/bao-gia/">Xem bảng giá</a><a class="btn ghost" href="tel:0918566177" style="background:transparent;color:#fff;border-color:rgba(255,255,255,.4)">Gọi 0918 566 177</a></div>
</div></aside></div>
${related.length ? `<section class="related"><h2 style="font-size:22px;margin:0">Bài viết liên quan</h2><div class="grid">${related.map(card).join('')}</div></section>` : ''}
</div>`;
  const ldArr = [
    { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: a.title, description: a.seo_description || a.excerpt || '', mainEntityOfPage: canonical, url: url,
      datePublished: a.published_at, dateModified: a.updated_at || a.published_at, image: img ? [abs(img)] : undefined, inLanguage: 'vi-VN',
      author: { '@type': author.is_organization ? 'Organization' : 'Person', name: author.name },
      publisher: { '@type': 'Organization', name: 'Zetabiz', logo: { '@type': 'ImageObject', url: SITE + '/assets/zetabiz-mark.png' } },
      articleSection: a.category ? a.category.name : undefined, keywords: a.focus_keyword || undefined },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trang chủ', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog' }]
      .concat(a.category ? [{ '@type': 'ListItem', position: 3, name: a.category.name, item: SITE + '/blog/chu-de/' + a.category.slug }] : [])
      .concat([{ '@type': 'ListItem', position: a.category ? 4 : 3, name: a.title, item: url }]) }
  ];
  if (faqs.length) ldArr.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map(function (f) { return { '@type': 'Question', name: f.question, acceptedAnswer: { '@type': 'Answer', text: f.answer } }; }) });
  send(res, 200, page({ title: a.seo_title || a.title + ' | Zetabiz', ogTitle: a.title, description: a.seo_description || a.excerpt || '', canonical: canonical, image: img ? abs(img) : null,
    ogType: 'article', published: a.published_at, modified: a.updated_at, section: 'blog', body: body, ld: ldArr }));
}

async function sitemap(res) {
  const arts = await sb('blog_articles?select=slug,updated_at,published_at&order=published_at.desc&limit=5000');
  const cats = await sb('blog_categories?select=slug,updated_at');
  const urls = [['/', null, '1.0'], ['/bao-gia/', null, '0.8'], ['/blog', arts[0] && (arts[0].updated_at || arts[0].published_at), '0.7'],
    ['/chinh-sach-bao-mat/', null, '0.2'], ['/dieu-khoan/', null, '0.2']]
    .concat(cats.map(function (c) { return ['/blog/chu-de/' + c.slug, c.updated_at, '0.5']; }))
    .concat(arts.map(function (a) { return ['/blog/' + a.slug, a.updated_at || a.published_at, '0.6']; }));
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.map(function (u) { return '<url><loc>' + esc(SITE + u[0]) + '</loc>' + (u[1] ? '<lastmod>' + new Date(u[1]).toISOString().slice(0, 10) + '</lastmod>' : '') + '<priority>' + u[2] + '</priority></url>'; }).join('\n') + '\n</urlset>\n';
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
async function rss(res) {
  const arts = await sb('blog_articles?select=title,slug,excerpt,published_at&order=published_at.desc&limit=30');
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel><title>Blog Zetabiz</title><link>' + SITE + '/blog</link><description>Kiến thức quản trị và chuyển đổi số doanh nghiệp</description><language>vi</language>\n' +
    arts.map(function (a) { return '<item><title>' + esc(a.title) + '</title><link>' + SITE + '/blog/' + esc(a.slug) + '</link><guid>' + SITE + '/blog/' + esc(a.slug) + '</guid><pubDate>' + new Date(a.published_at).toUTCString() + '</pubDate><description>' + esc(a.excerpt || '') + '</description></item>'; }).join('\n') + '\n</channel></rss>\n';
  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
function robots(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(200).send('User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /tai-khoan/\nDisallow: /api/\n\nSitemap: ' + SITE + '/sitemap.xml\n');
}
function notFound(res) {
  send(res, 404, page({ title: 'Không tìm thấy bài viết – Zetabiz', description: 'Bài viết không tồn tại hoặc đã được gỡ.', noindex: true, section: 'blog',
    body: '<div class="wrap" style="padding:80px 0;text-align:center"><h1>Không tìm thấy bài viết</h1><p style="color:var(--muted)">Bài viết có thể đã đổi đường dẫn hoặc được gỡ.</p><p><a class="btn" href="/blog">Xem các bài viết khác</a></p></div>' }), 60);
}
function send(res, code, html, ttl) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=' + (ttl || 300) + ', stale-while-revalidate=86400');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.status(code).send(html);
}

module.exports = async function handler(req, res) {
  const v = String(req.query.v || '');
  const slug = String(req.query.slug || '').toLowerCase();
  try {
    if (v === 'sitemap') return await sitemap(res);
    if (v === 'robots') return robots(res);
    if (v === 'rss') return await rss(res);
    if (v === 'cat') return /^[a-z0-9-]{1,100}$/.test(slug) ? await listPage(req, res, slug) : notFound(res);
    if (slug) return /^[a-z0-9-]{1,160}$/.test(slug) ? await articlePage(req, res, slug) : notFound(res);
    return await listPage(req, res, null);
  } catch (e) {
    console.error('blog', e);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.status(503).send(page({ title: 'Blog tạm gián đoạn – Zetabiz', description: '', noindex: true, body: '<div class="wrap" style="padding:80px 0;text-align:center"><h1>Blog đang tạm gián đoạn</h1><p>Vui lòng thử lại sau ít phút.</p></div>' }));
  }
};
