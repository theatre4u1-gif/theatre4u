import { rewrite, next } from '@vercel/edge';

// Host-based landing pages: artstracker.org serves the ArtsTracker head/SEO,
// theatre4u.org (and previews) serve the Theatre4u one. Done in Edge Middleware
// because vercel.json `has: host` rewrites do not fire on static deployments
// (known Vercel limitation — see vercel/community discussion #698).
// Matcher skips real files (anything with a dot) and /assets/.
export const config = { matcher: ['/((?!assets/|.*\\.).*)'] };

export default function middleware(request) {
  const url = new URL(request.url);
  const path = url.pathname;
  // Let vercel.json handle these pretty URLs
  if (path === '/join' || path.startsWith('/org/')) return next();
  const host = (request.headers.get('host') || '').toLowerCase();
  const file = host.includes('artstracker') ? '/home-artstracker.html' : '/home-theatre4u.html';
  return rewrite(new URL(file, request.url));
}
