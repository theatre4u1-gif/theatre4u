// Post-build: rename dist/index.html -> dist/home-theatre4u.html so the root
// path "/" is routed per-domain by vercel.json host rewrites instead of being
// served from the filesystem (which would always show the Theatre4u head on
// artstracker.org for crawlers/link previews).
import { renameSync, existsSync } from 'fs';
if (existsSync('dist/index.html')) {
  renameSync('dist/index.html', 'dist/home-theatre4u.html');
  console.log('postbuild: dist/index.html -> dist/home-theatre4u.html');
} else {
  console.error('postbuild: dist/index.html not found!');
  process.exit(1);
}
