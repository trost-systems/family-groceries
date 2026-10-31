// Usage: node publish.mjs <worktree>
// Copies the gallery (index.html, gallery.css, thumbs/) and every option-* folder into
// <worktree>/site/public/design-prototypes/. Vercel serves the site with cleanUrls and
// trailingSlash: false, so /design-prototypes/option-1-x/ redirects to a URL without the
// slash and relative links would resolve one level up. The copy therefore gets absolute,
// extension-less links in its HTML; the research folder keeps relative ones for file://.
import { cpSync, existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, relative, posix } from 'node:path';

const root = resolve(dirname(new URL(import.meta.url).pathname), '..');
const dest = join(resolve(process.argv[2]), 'site/public/design-prototypes');
const BASE = '/design-prototypes';

// Flutter web builds (build-widgetbook.sh) are copied as built: their links resolve against
// their own <base href>, so publish leaves their HTML alone.
const BUNDLES = ['widgetbook'];
const entries = ['index.html', 'gallery.css', 'thumbs', 'app-icon', ...readdirSync(root).filter((f) => /^option-\d[a-z]?-/.test(f)).sort(), ...BUNDLES];
rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const e of entries) {
  if (!existsSync(join(root, e))) throw new Error(`missing ${e}`);
  cpSync(join(root, e), join(dest, e), { recursive: true });
}

export function absolutize(html, pageDir) {
  return html.replace(/\b(href|src)="([^"]*)"/g, (m, attr, url) => {
    if (!url || url.startsWith('#') || url.startsWith('/') || /^[a-z]+:/i.test(url)) return m;
    const [path, hash = ''] = url.split('#');
    let abs = posix.normalize(posix.join(BASE, pageDir, path));
    // site/build.mjs accepts only links to a file or to <path>.html, so a folder links to its /index.
    if (abs.endsWith('/')) abs += 'index';
    else if (abs.endsWith('.html')) abs = abs.slice(0, -'.html'.length);
    return `${attr}="${abs}${hash ? `#${hash}` : ''}"`;
  });
}

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
let n = 0;
for (const f of walk(dest).filter((f) => f.endsWith('.html'))) {
  const pageDir = relative(dest, dirname(f)).split('\\').join('/');
  if (BUNDLES.some((b) => pageDir === b || pageDir.startsWith(`${b}/`))) continue;
  writeFileSync(f, absolutize(readFileSync(f, 'utf8'), pageDir));
  n++;
}
console.log(`published ${entries.length} entries, rewrote links in ${n} pages, into ${dest}`);
