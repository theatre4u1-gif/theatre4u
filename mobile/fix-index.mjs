// The website build's postbuild step renames dist/index.html -> dist/home-theatre4u.html
// (that's how the site routes). Capacitor, though, needs an index.html as the app's
// entry point. This restores one for the native shell without touching the website build.
import { existsSync, copyFileSync } from 'node:fs';

const dist = 'dist';
if (!existsSync(`${dist}/index.html`) && existsSync(`${dist}/home-theatre4u.html`)) {
  copyFileSync(`${dist}/home-theatre4u.html`, `${dist}/index.html`);
  console.log('fix-index: restored dist/index.html for the app shell');
} else {
  console.log('fix-index: dist/index.html already present (nothing to do)');
}
