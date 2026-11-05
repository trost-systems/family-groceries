// Serves a Flutter web build the way Vercel does (vercel.json's rewrite and headers, brotli),
// signs the page in against fake_supabase.py, and runs Lighthouse (desktop preset, simulated
// throttling) on each page of PAGES, `runs` times, each run in a fresh Chromium profile.
// Prints one JSON object on stdout: per page, the list of Lighthouse results.
//
//   node lighthouse.mjs <build dir> <web port> <supabase port> <runs> <report dir>
import { readFile, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';
import { homedir } from 'node:os';
import lighthouse from 'lighthouse';
import desktopConfig from 'lighthouse/core/config/desktop-config.js';
import puppeteer from 'puppeteer-core';

const [buildDir, webPort, supabasePort, runs, reportDir] = process.argv.slice(2);
const origin = `http://127.0.0.1:${webPort}`;
const supabase = `http://127.0.0.1:${supabasePort}`;
const chrome = join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome');

// The page set (docs/hillclimb/hc-web-lighthouse.md): the signed-in list, and the add sheet
// opened by the /add app link on a cold start. `ready` proves the page reached that state.
const PAGES = [
  { name: 'list', path: '/', ready: () => document.body.innerHTML.includes('Bananen') },
  {
    name: 'add',
    path: '/add',
    // The sheet's hint (ARB typeToSuggest, English or German) shows, and its barrier hides the
    // list's rows from the semantics tree. The list's own add bar is an input too, so an input
    // alone would pass on `/`.
    ready: () =>
      /Type to see suggestions|Tippe, um Vorschläge zu sehen/.test(document.body.innerHTML) &&
      !document.body.innerHTML.includes('Bananen'),
  },
];

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.symbols': 'text/plain',
  '.frag': 'application/octet-stream',
  '.bin': 'application/octet-stream',
  '.txt': 'text/plain',
};
const COMPRESSED = new Set(['.html', '.js', '.mjs', '.json', '.wasm', '.css', '.svg', '.symbols', '.frag', '.txt', '.ttf', '.otf', '.bin']);
const STATIC = /^\/(?:(?:assets|canvaskit|fonts|icons|\.well-known)\/|.*\.(?:html|js|mjs|json|wasm|symbols|css|map|png|jpe?g|gif|webp|svg|ico|ttf|otf|woff2?|frag|bin|txt)$)/;
const CSP =
  "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; " +
  `img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ${supabase} ` +
  `ws://127.0.0.1:${supabasePort}; worker-src 'self' blob:; object-src 'none'; base-uri 'self'`;

const cache = new Map();
async function body(file, ext) {
  if (!cache.has(file)) {
    const raw = await readFile(file);
    cache.set(
      file,
      COMPRESSED.has(ext)
        ? { data: brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }), br: true }
        : { data: raw, br: false },
    );
  }
  return cache.get(file);
}

const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, origin).pathname);
  const rel = STATIC.test(path) ? normalize(path).replace(/^(\.\.\/)+/, '') : '/index.html';
  const file = join(buildDir, rel);
  try {
    if (!(await stat(file)).isFile()) throw new Error('not a file');
  } catch {
    res.writeHead(404).end();
    return;
  }
  const ext = extname(file);
  const { data, br } = await body(file, ext);
  const headers = {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Content-Length': data.length,
    'Content-Security-Policy': CSP,
    'Cache-Control': /^\/fonts\/.*\.woff2$/.test(path)
      ? 'public, max-age=31536000, immutable'
      : /^\/(index\.html|flutter_service_worker\.js|flutter_bootstrap\.js|version\.json|manifest\.json)$/.test(path) ||
          !STATIC.test(path)
        ? 'no-cache'
        : 'public, max-age=0, must-revalidate',
  };
  if (br) headers['Content-Encoding'] = 'br';
  res.writeHead(200, headers).end(data);
});
await new Promise((resolve) => server.listen(Number(webPort), '127.0.0.1', resolve));

// A session gotrue restores without a network call: far-future expiry, any signature (the fake
// checks none). supabase_flutter keys it by the first label of the Supabase host.
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const exp = 4102444800;
const user = '00000000-0000-4000-8000-000000000001';
const accessToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user, exp, role: 'authenticated', aud: 'authenticated' })}.c2ln`;
const session = JSON.stringify({
  access_token: accessToken,
  expires_in: 3600,
  expires_at: exp,
  refresh_token: 'hc129',
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

const results = Object.fromEntries(PAGES.map((p) => [p.name, []]));
for (let run = 1; run <= Number(runs); run++) {
  for (const page of PAGES) {
    const browser = await puppeteer.launch({
      executablePath: chrome,
      headless: true,
      args: ['--no-sandbox', '--no-first-run', '--no-default-browser-check', '--window-size=1350,940'],
    });
    try {
      const tab = await browser.newPage();
      await tab.goto(`${origin}/manifest.json`);
      await tab.evaluate((s) => localStorage.setItem('sb-127-auth-token', s), session);
      const out = await lighthouse(
        `${origin}${page.path}`,
        { output: 'json', logLevel: 'error', disableStorageReset: true, onlyCategories: ['performance'] },
        desktopConfig,
        tab,
      );
      const lhr = out.lhr;
      await writeFile(join(reportDir, `${page.name}-${run}.lhr.json`), JSON.stringify(lhr));
      const ready = await tab.evaluate(page.ready);
      const shot = lhr.audits['final-screenshot']?.details?.data;
      if (shot) {
        await writeFile(join(reportDir, `${page.name}-${run}.jpg`), Buffer.from(shot.split(',')[1], 'base64'));
      }
      const num = (id) => lhr.audits[id]?.numericValue ?? null;
      results[page.name].push({
        performance: lhr.categories.performance.score === null ? null : lhr.categories.performance.score * 100,
        lcp_ms: num('largest-contentful-paint'),
        tbt_ms: num('total-blocking-time'),
        tti_ms: num('interactive'),
        si_ms: num('speed-index'),
        fcp_ms: num('first-contentful-paint'),
        cls: num('cumulative-layout-shift'),
        total_byte_weight: num('total-byte-weight'),
        ready,
        runtime_error: lhr.runtimeError?.code ?? null,
      });
      console.error(`lighthouse: run ${run} ${page.name}: ${JSON.stringify(results[page.name].at(-1))}`);
    } finally {
      await browser.close();
    }
  }
}
server.close();
process.stdout.write(`${JSON.stringify(results)}\n`);
