// serve(root): a static server for root on 127.0.0.1 with a random port. Pages that use
// CSS masks need http: Chromium fetches mask images in CORS mode, which file:// fails.
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

export async function serve(root) {
  const server = createServer((req, res) => {
    let f = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, 'index.html');
    if (!f.startsWith(root) || !existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': TYPES[extname(f)] ?? 'application/octet-stream' });
    res.end(readFileSync(f));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { origin: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
