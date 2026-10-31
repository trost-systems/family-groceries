// serveDist(worktree): serves <worktree>/site/dist on 127.0.0.1 the way Vercel serves it
// (site/vercel.json: cleanUrls, trailingSlash false, each path's CSP header).
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.txt': 'text/plain', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.ttf': 'font/ttf', '.otf': 'font/otf' };

export async function serveDist(worktree) {
  const dist = join(resolve(worktree), 'site/dist');
  const vercel = JSON.parse(readFileSync(join(resolve(worktree), 'site/vercel.json'), 'utf8'));
  // Vercel applies every header rule whose source matches, a later one overriding an earlier
  // one. The sources are plain regexes in path-to-regexp's group syntax, as in the repo root's
  // vercel.json.
  const cspFor = (path) =>
    vercel.headers
      .filter((rule) => new RegExp(`^${rule.source}$`).test(path))
      .flatMap((rule) => rule.headers)
      .findLast((h) => h.key === 'Content-Security-Policy')?.value;
  const isFile = (f) => existsSync(f) && statSync(f).isFile();
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.length > 1 && path.endsWith('/')) { res.writeHead(308, { Location: path.slice(0, -1) }); res.end(); return; }
    if (path.endsWith('.html')) { res.writeHead(308, { Location: path.slice(0, -5).replace(/\/index$/, '') }); res.end(); return; }
    const f = [join(dist, path), join(dist, `${path}.html`), join(dist, path, 'index.html')].find(isFile);
    if (!f || !f.startsWith(dist)) { res.writeHead(404); res.end(); return; }
    const csp = cspFor(path);
    if (!csp) { res.writeHead(500); res.end(`no CSP rule matches ${path}`); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream', 'Content-Security-Policy': csp });
    res.end(readFileSync(f));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}

// A Flutter page renders after its scripts load: wait for the view, then for the first frames
// and the font and asset fetches they start. Returns whether the page is a Flutter app.
export async function settleFlutter(page) {
  if (!(await page.$('script[src$="flutter_bootstrap.js"]'))) return false;
  await page.waitForSelector('flutter-view', { state: 'attached', timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  await page.waitForLoadState('networkidle');
  return true;
}
