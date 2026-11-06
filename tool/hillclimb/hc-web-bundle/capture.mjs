// Serves a Flutter web build (vercel.json's SPA rewrite), signs the page in against
// fake_supabase.py, opens the list in a fresh Chromium profile and records every file the page
// fetches from the web origin until the list shows ("Bananen" in the semantics tree) and the
// network has been quiet for 3 s. Prints one JSON object on stdout:
// {"files": [<build-relative paths, sorted>], "ready": true}.
//
//   node capture.mjs <build dir> <web port> <supabase port> <screenshot path>
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';

const require = createRequire(join(process.cwd(), 'e2e', 'package.json'));
const { chromium } = require('playwright-core');

const [buildDir, webPort, supabasePort, shot] = process.argv.slice(2);
const origin = `http://127.0.0.1:${webPort}`;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
};
const STATIC = /^\/(?:(?:assets|canvaskit|fonts|icons|splash|posthog|\.well-known)\/|.*\.(?:html|js|mjs|json|wasm|symbols|css|png|svg|ico|ttf|otf|woff2?|frag|bin|txt)$)/;

const fetched = new Set();
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, origin).pathname);
  const rel = STATIC.test(path) ? normalize(path).replace(/^(\.\.\/)+/, '') : '/index.html';
  const file = join(buildDir, rel);
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
  } catch {
    console.error(`capture: 404 ${path}`);
    res.writeHead(404).end();
    return;
  }
  fetched.add(rel.replace(/^\//, ''));
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(await readFile(file));
});
await new Promise((resolve) => server.listen(Number(webPort), '127.0.0.1', resolve));

// A session gotrue restores without a network call (job 129's lighthouse.mjs): far-future
// expiry, any signature. supabase_flutter keys it by the first label of the Supabase host.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = 4102444800;
const user = '00000000-0000-4000-8000-000000000001';
const session = JSON.stringify({
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user, exp, role: 'authenticated', aud: 'authenticated' })}.c2ln`,
  expires_in: 3600,
  expires_at: exp,
  refresh_token: 'hc133',
  token_type: 'bearer',
  user: {
    id: user,
    aud: 'authenticated',
    role: 'authenticated',
    email: 'peter@example.test',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    created_at: '2026-11-01T10:00:00+00:00',
  },
});

const browser = await chromium.launch({ args: ['--no-sandbox'] });
let ready = false;
try {
  const context = await browser.newContext({ viewport: { width: 1350, height: 940 }, locale: 'de-DE' });
  const page = await context.newPage();
  let last = Date.now();
  page.on('request', () => {
    last = Date.now();
  });
  await page.goto(`${origin}/manifest.json`);
  await page.evaluate((s) => localStorage.setItem('sb-127-auth-token', s), session);
  fetched.clear();
  await page.goto(`${origin}/`);
  await page.waitForFunction(() => document.body.innerHTML.includes('Bananen'), null, { timeout: 60_000 });
  ready = true;
  while (Date.now() - last < 3000) await page.waitForTimeout(250);
  await page.screenshot({ path: shot });
} finally {
  await browser.close();
  server.close();
}
process.stdout.write(`${JSON.stringify({ files: [...fetched].sort(), ready })}\n`);
