// Diagnostic, not part of the score: what each Flutter frame of one cold load built and laid
// out, from the framework's timeline events. Needs a profile build with readable names whose
// main() sets `debugProfileBuildsEnabled = true` (a throwaway edit):
//   flutter build web --profile -O1 --wasm --no-web-resources-cdn --output build/web-hc-dbg ...
// Writes the frames' raster times and every timeline measure to $OUT as JSON.
//
//   OUT=/tmp/frames.json node frametrace.mjs <build dir> <web port> <supabase port> <path> [seconds]
import { readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { homedir } from 'node:os';
import { extname, join, normalize } from 'node:path';
import puppeteer from 'puppeteer-core';

const [buildDir, webPort, supabasePort, path, seconds = '6'] = process.argv.slice(2);
const origin = `http://127.0.0.1:${webPort}`;
const STATIC = /^\/(?:(?:assets|canvaskit|fonts|icons|\.well-known)\/|.*\.(?:html|js|mjs|json|wasm|symbols|css|map|png|jpe?g|gif|webp|svg|ico|ttf|otf|woff2?|frag|bin|txt)$)/;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, origin).pathname);
  const file = join(buildDir, STATIC.test(p) ? normalize(p).replace(/^(\.\.\/)+/, '') : '/index.html');
  try {
    if (!(await stat(file)).isFile()) throw new Error();
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file));
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((r) => server.listen(Number(webPort), '127.0.0.1', r));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const user = '00000000-0000-4000-8000-000000000001';
const exp = 4102444800;
const session = JSON.stringify({
  access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: user, exp, role: 'authenticated', aud: 'authenticated' })}.c2ln`,
  expires_in: 3600, expires_at: exp, refresh_token: 'hc129', token_type: 'bearer',
  user: { id: user, aud: 'authenticated', role: 'authenticated', email: 'peter@example.test', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T10:00:00+00:00' },
});

const browser = await puppeteer.launch({
  executablePath: join(homedir(), '.cache/ms-playwright/chromium-1248/chrome-linux64/chrome'),
  headless: true,
  args: ['--no-sandbox', '--window-size=1350,940'],
  defaultViewport: { width: 1350, height: 940 },
});
const tab = await browser.newPage();
await tab.goto(`${origin}/manifest.json`);
await tab.evaluate((s) => localStorage.setItem('sb-127-auth-token', s), session);
await tab.evaluateOnNewDocument(() => {
  window.__frames = [];
  window.__long = [];
  window.__measures = [];
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__measures.push([Math.round(e.startTime * 10) / 10, Math.round(e.duration * 10) / 10, e.name]))).observe({ type: 'measure' });
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
  const orig = OffscreenCanvas.prototype.transferToImageBitmap;
  OffscreenCanvas.prototype.transferToImageBitmap = function () {
    const t0 = performance.now();
    const r = orig.call(this);
    window.__frames.push([Math.round(t0), Math.round(performance.now() - t0), this.width, this.height]);
    return r;
  };
});
await tab.goto(`${origin}${path}`);
await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
const data = await tab.evaluate(() => ({
  frames: window.__frames,
  marks: window.__measures,
  marks2: performance.getEntriesByType('mark').slice(0, 5).map((e) => [e.startTime, e.name]),
}));
await browser.close();
server.close();
const { writeFileSync } = await import('node:fs');
writeFileSync(process.env.OUT, JSON.stringify(data));
console.log('frames', data.frames.length, 'measures', data.marks.length, JSON.stringify(data.marks2));
