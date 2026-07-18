import { rewrite, next } from '@vercel/edge';

// Host-based landing pages: artstracker.org serves the ArtsTracker head/SEO,
// theatre4u.org (and previews) serve the Theatre4u one. Done in Edge Middleware
// because vercel.json `has: host` rewrites do not fire on static deployments
// (known Vercel limitation — see vercel/community discussion #698).
// Matcher skips real files (anything with a dot) and /assets/, PLUS the two SEO
// files we vary per host (sitemap.xml / robots.txt) added explicitly.
export const config = { matcher: ['/((?!assets/|.*\\.).*)', '/sitemap.xml', '/robots.txt'] };

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  const host = (request.headers.get('host') || '').toLowerCase();
  const isArtsTracker = host.includes('artstracker') && !host.startsWith('admin.');

  // Per-host SEO files (dotted paths, added to the matcher above). On artstracker.org
  // serve the ArtsTracker variants; otherwise let the static Theatre4u files serve.
  if (path === '/sitemap.xml') return isArtsTracker ? rewrite(new URL('/sitemap-artstracker.xml', request.url)) : next();
  if (path === '/robots.txt')  return isArtsTracker ? rewrite(new URL('/robots-artstracker.txt', request.url)) : next();

  // Let vercel.json handle these pretty URLs
  if (path === '/join' || path.startsWith('/org/')) return next();
  const file = host.includes('artstracker') ? '/home-artstracker.html' : '/home-theatre4u.html';
  // The admin host (admin.artstracker.org) must never be indexed by search engines.
  const init = host.startsWith('admin.') ? { headers: { 'x-robots-tag': 'noindex, nofollow' } } : undefined;
  return rewrite(new URL(file, request.url), init);
}
