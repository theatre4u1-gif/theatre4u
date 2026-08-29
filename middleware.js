import { rewrite, next } from '@vercel/edge';

// Host-based landing pages: artstracker.org serves the ArtsTracker head/SEO,
// theatre4u.org (and previews) serve the Theatre4u one. Done in Edge Middleware
// because vercel.json `has: host` rewrites do not fire on static deployments
// (known Vercel limitation — see vercel/community discussion #698).
// Matcher skips real files (anything with a dot) and /assets/, PLUS the two SEO
// files we vary per host (sitemap.xml / robots.txt) added explicitly.
export const config = { matcher: ['/((?!assets/|.*\\.).*)', '/sitemap.xml', '/robots.txt'] };

const SB_URL = 'https://ldmmphwivnnboyhlxipl.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxkbW1waHdpdm5uYm95aGx4aXBsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQxODA2MDUsImV4cCI6MjA3OTc1NjYwNX0.U2acfM5Ew7leACj4TWEy7EKwHi92270B1lt78dEjEfA';

const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function shell({ title, ogTitle, ogDesc, ogImg, ogUrl, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${esc(title)}</title>
<meta name="description" content="${esc(ogDesc)}"/>
<meta property="og:type" content="product"/>
<meta property="og:title" content="${esc(ogTitle)}"/>
<meta property="og:description" content="${esc(ogDesc)}"/>
<meta property="og:image" content="${esc(ogImg)}"/>
<meta property="og:url" content="${esc(ogUrl)}"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(ogTitle)}"/>
<meta name="twitter:description" content="${esc(ogDesc)}"/>
<meta name="twitter:image" content="${esc(ogImg)}"/>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#fdf8f1;color:#1a1008;font-family:'DM Sans',system-ui,sans-serif;line-height:1.6;padding:24px}
.card{max-width:520px;margin:24px auto;background:#fff;border:1px solid #e8dcc8;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(60,30,0,.10)}
.ph{height:340px;background:#f5ede0;display:flex;align-items:center;justify-content:center;font-size:72px;overflow:hidden}
.ph img{width:100%;height:100%;object-fit:cover}
.bd{padding:22px}
.bd h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:700;margin-bottom:4px}
.sub{color:#7a6a54;font-size:14px;margin-bottom:10px}
.price{font-size:18px;font-weight:700;color:#2d6e3a;margin-bottom:18px}
.btn{display:block;text-align:center;text-decoration:none;padding:13px 18px;border-radius:10px;font-weight:700;font-size:15px;margin-top:10px;background:linear-gradient(135deg,#e8b84b,#c4922a);color:#1a1008}
.btn.ghost{background:#f5ede0;color:#1a1008;border:1px solid #e8dcc8}
.empty{max-width:480px;margin:60px auto;text-align:center}
.empty .ico{font-size:52px;margin-bottom:12px;opacity:.5}
.empty h1{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;margin-bottom:8px}
.empty p{color:#7a6a54;margin-bottom:22px}
</style></head>
<body>${body}</body></html>`;
}

// Serve /item/:id as a crawlable, share-ready page with per-item Open Graph tags.
async function itemPage(request, host) {
  const url = new URL(request.url);
  const isAT = host.includes('artstracker') && !host.startsWith('admin.');
  const brand = isAT ? 'artstracker.org' : 'theatre4u.org';
  const appName = isAT ? 'ArtsTracker' : 'Theatre4u';
  const homeUrl = 'https://' + brand;
  const defImg = homeUrl + '/og-' + (isAT ? 'artstracker' : 'theatre4u') + '.png';
  const canonical = 'https://' + host + url.pathname;
  const raw = decodeURIComponent((url.pathname.split('/').filter(Boolean).pop() || ''));

  const notFound = (msg) => new Response(shell({
    title: appName, ogTitle: appName + ' — Marketplace', ogDesc: msg, ogImg: defImg, ogUrl: canonical,
    body: `<div class="empty"><div class="ico">🎭</div><h1>Item not available</h1><p>${esc(msg)}</p><a class="btn" href="${homeUrl}">Go to ${appName}</a></div>`,
  }), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });

  if (!/^[A-Za-z0-9._-]{1,80}$/.test(raw)) return notFound('This item link is not valid.');

  let item = null;
  try {
    const r = await fetch(
      `${SB_URL}/rest/v1/items?or=(display_id.eq.${raw},id.eq.${raw})&mkt=neq.Not%20Listed&select=name,category,condition,img,rent,sale,mkt,display_id&limit=1`,
      { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY } }
    );
    const rows = await r.json();
    item = Array.isArray(rows) ? rows[0] : null;
  } catch (_) { /* fall through to not-found */ }
  if (!item) return notFound('This item is no longer listed, or the link is incorrect.');

  const priceBits = [];
  if (item.mkt === 'For Loan') priceBits.push('Free loan');
  else {
    if (item.rent > 0) priceBits.push('$' + item.rent + '/wk to rent');
    if (item.sale > 0) priceBits.push('$' + item.sale + ' to buy');
  }
  const price = priceBits.join(' · ') || (item.mkt || '');
  const sub = [item.category, item.condition].filter(Boolean).join(' · ');
  const img = item.img || defImg;
  const ogDesc = [sub, price].filter(Boolean).join(' · ') + ' · Shared on ' + appName;
  const openUrl = homeUrl + '/#/item/' + encodeURIComponent(item.display_id || raw);

  const body = `<div class="card">
    <div class="ph">${item.img ? `<img src="${esc(item.img)}" alt="${esc(item.name)}"/>` : '<span>🎭</span>'}</div>
    <div class="bd">
      <h1>${esc(item.name)}</h1>
      ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}
      <div class="price">${esc(price)}</div>
      <a class="btn" href="${esc(openUrl)}">View on ${appName}</a>
      <a class="btn ghost" href="${homeUrl}">Browse ${appName}</a>
    </div>
  </div>`;

  return new Response(
    shell({ title: item.name + ' — ' + appName, ogTitle: item.name, ogDesc, ogImg: img, ogUrl: canonical, body }),
    { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' } }
  );
}

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const host = (request.headers.get('host') || '').toLowerCase();
  const isArtsTracker = host.includes('artstracker') && !host.startsWith('admin.');

  // Per-host SEO files (dotted paths, added to the matcher above). On artstracker.org
  // serve the ArtsTracker variants; otherwise let the static Theatre4u files serve.
  if (path === '/sitemap.xml') return isArtsTracker ? rewrite(new URL('/sitemap-artstracker.xml', request.url)) : next();
  if (path === '/robots.txt')  return isArtsTracker ? rewrite(new URL('/robots-artstracker.txt', request.url)) : next();

  // Shareable item page with per-item Open Graph tags (fixes Facebook/social item links).
  if (path.startsWith('/item/')) return itemPage(request, host);

  // Let vercel.json handle these pretty URLs
  if (path === '/join' || path.startsWith('/org/')) return next();
  const file = host.includes('artstracker') ? '/home-artstracker.html' : '/home-theatre4u.html';
  // The admin host (admin.artstracker.org) must never be indexed by search engines.
  const init = host.startsWith('admin.') ? { headers: { 'x-robots-tag': 'noindex, nofollow' } } : undefined;
  return rewrite(new URL(file, request.url), init);
}
