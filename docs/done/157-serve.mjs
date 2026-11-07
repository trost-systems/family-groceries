// Serves site/public with the production CSP and cleanUrls; imported by 157-shots.mjs.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const pub = join(repo, 'site/public');
const csp = JSON.parse(readFileSync(join(repo, 'site/vercel.json'), 'utf8')).headers[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

export async function serve() {
  const server = createServer((req, res) => {
    let p = join(pub, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!existsSync(p) || statSync(p).isDirectory()) p += '.html';
    if (!existsSync(p)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream', 'content-security-policy': csp });
    res.end(readFileSync(p));
  }).listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  return { server, url: `http://127.0.0.1:${server.address().port}/internal/sync-indicator-v2` };
}
