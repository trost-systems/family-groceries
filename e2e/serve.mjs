// Static server for the Flutter web build, routed like vercel.json: a path its rewrite matches
// falls back to index.html, any other missing file is a 404.
// Usage: node e2e/serve.mjs <dir> <port> [--csp <supabase-url> <posthog-host>]
// --csp sends vercel.json's Content-Security-Policy with the production Supabase and PostHog
// origins swapped for the given ones (job 33c: the e2e suite runs under the production CSP).
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const [root, port = '3000', flag, supabaseUrl, posthogHost] = process.argv.slice(2);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.otf': 'font/otf',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
};

const vercel = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const spaPath = new RegExp(`^${vercel.rewrites.find((r) => r.destination === '/index.html').source}$`);

function productionCsp() {
  for (const rule of vercel.headers) {
    const header = rule.headers.find((h) => h.key === 'Content-Security-Policy');
    if (header) return header.value;
  }
  throw new Error('vercel.json sets no Content-Security-Policy');
}

let csp;
if (flag === '--csp') {
  if (!supabaseUrl || !posthogHost) throw new Error('usage: --csp <supabase-url> <posthog-host>');
  const supabase = new URL(supabaseUrl);
  const ws = `${supabase.protocol === 'https:' ? 'wss' : 'ws'}://${supabase.host}`;
  csp = productionCsp()
    .replace(/https:\/\/[a-z0-9]+\.supabase\.co/g, supabase.origin)
    .replace(/wss:\/\/[a-z0-9]+\.supabase\.co/g, ws)
    .replace('https://eu.i.posthog.com', new URL(posthogHost).origin);
}

function resolve(urlPath) {
  const path = normalize(join(root, decodeURIComponent(urlPath)));
  if (!path.startsWith(normalize(root))) return null;
  try {
    if (statSync(path).isFile()) return path;
  } catch {}
  return null;
}

createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  const file = resolve(urlPath) ?? (spaPath.test(urlPath) ? join(root, 'index.html') : null);
  const headers = { 'cache-control': 'no-store', ...(csp && { 'content-security-policy': csp }) };
  if (!file) {
    res.writeHead(404, headers).end();
    return;
  }
  res.writeHead(200, { ...headers, 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} on http://127.0.0.1:${port}`));
