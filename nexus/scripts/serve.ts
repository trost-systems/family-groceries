// Serves .vercel/output the way Vercel does for this config: static files plus the routes'
// headers, so the CSP is exercised locally. 127.0.0.1 only.
//   deno run --allow-net=127.0.0.1 --allow-read scripts/serve.ts [port]
import { outputConfig } from './vercel-config.ts';

const root = new URL('../.vercel/output/static', import.meta.url).pathname;
const port = Number(Deno.args[0] ?? 55690);
const types: Readonly<Record<string, string>> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json',
  svg: 'image/svg+xml',
  woff2: 'font/woff2',
};

Deno.serve({ hostname: '127.0.0.1', port }, async (req) => {
  const path = decodeURIComponent(new URL(req.url).pathname);
  const file = path.endsWith('/') ? `${path}index.html` : path;
  const headers = new Headers();
  for (const route of outputConfig.routes) {
    if (route.src === undefined || !new RegExp(`^${route.src}$`).test(path)) continue;
    for (const [k, v] of Object.entries(route.headers ?? {})) headers.set(k, v);
  }
  if (file.includes('..')) return new Response('bad path', { status: 400, headers });
  try {
    const body = await Deno.readFile(`${root}${file}`);
    headers.set('Content-Type', types[file.split('.').pop() ?? ''] ?? 'application/octet-stream');
    return new Response(body, { headers });
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return new Response('not found', { status: 404, headers });
    throw e;
  }
});
