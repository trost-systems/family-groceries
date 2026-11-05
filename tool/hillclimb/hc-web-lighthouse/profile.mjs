// Diagnostic, not part of the score: a CPU profile of one cold load of a page, signed in against
// fake_supabase.py, on a build with wasm names (`flutter build web ... --no-strip-wasm`).
// Prints the busiest 100 ms windows with their top functions, then the top functions by
// inclusive and self time over the whole load.
//
//   node profile.mjs <build dir> <web port> <supabase port> <path> [seconds=6]
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
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push([Math.round(e.startTime), Math.round(e.duration)]))).observe({ type: 'longtask', buffered: true });
  const orig = OffscreenCanvas.prototype.transferToImageBitmap;
  OffscreenCanvas.prototype.transferToImageBitmap = function () {
    const t0 = performance.now();
    const r = orig.call(this);
    window.__frames.push([Math.round(t0), Math.round(performance.now() - t0), this.width, this.height]);
    return r;
  };
});
const cdp = await tab.createCDPSession();
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
await cdp.send('Profiler.start');
await tab.goto(`${origin}${path}`);
await new Promise((r) => setTimeout(r, Number(seconds) * 1000));
const { profile } = await cdp.send('Profiler.stop');
const longTasks = await tab.evaluate(() => performance.getEntriesByType('navigation')[0]?.toJSON());
const frames = await tab.evaluate(() => window.__frames);
const longTasksSeen = await tab.evaluate(() => window.__long);
console.log('requests (start, end, path):\n  ' + (await tab.evaluate(() => performance.getEntriesByType('resource').map((e) => `${Math.round(e.startTime)} ${Math.round(e.responseEnd)} ${e.name.replace(/^https?:\/\/[^/]+/, '').slice(0, 70)}`))).join('\n  '));
console.log(`long tasks (start, ms): ${JSON.stringify(await tab.evaluate(() => window.__long))}`);
console.log(`frames (${frames.length}, page time ms, raster ms, w, h): ${JSON.stringify(frames)}`);
await browser.close();
server.close();

const symbols = new Map();
try {
  for (const line of (await readFile(join(buildDir, 'canvaskit/skwasm.js.symbols'), 'utf8')).split('\n')) {
    const i = line.indexOf(':');
    if (i > 0) symbols.set(line.slice(0, i), line.slice(i + 1).replace(/\\([0-9a-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16))).slice(0, 100));
  }
} catch {}
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const name = (n) => `${(n.callFrame.url.endsWith('skwasm.wasm') && symbols.get(n.callFrame.functionName.match(/wasm-function\[(\d+)\]/)?.[1])) || n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}:${n.callFrame.columnNumber}`.replace(/ :-?1:-?1$/, '');
const IDLE = new Set(['(idle)', '(program)', '(garbage collector)']);
const self = new Map();
const incl = new Map();
const windows = new Map();
let t = 0;
const dt = profile.timeDeltas;
profile.samples.forEach((id, i) => {
  t += dt[i];
  const d = (dt[i + 1] ?? 0) / 1000;
  const node = byId.get(id);
  const nm = name(node);
  if (nm === '(idle)') return;
  self.set(nm, (self.get(nm) ?? 0) + d);
  const seen = new Set();
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const n = name(byId.get(cur));
    if (!seen.has(n)) {
      seen.add(n);
      incl.set(n, (incl.get(n) ?? 0) + d);
    }
  }
  const w = Math.floor(t / 100000);
  const win = windows.get(w) ?? { busy: 0, fns: new Map() };
  win.busy += d;
  if (!IDLE.has(nm)) win.fns.set(nm, (win.fns.get(nm) ?? 0) + d);
  windows.set(w, win);
});
const top = (m, k) => [...m].sort((a, b) => b[1] - a[1]).slice(0, k).map(([n, v]) => `${v.toFixed(1)}ms ${n}`);
console.log('navigation', JSON.stringify(longTasks && { domContentLoaded: longTasks.domContentLoadedEventEnd, load: longTasks.loadEventEnd }));
console.log('busy 100 ms windows (profile time):');
for (const [w, win] of [...windows].sort((a, b) => a[0] - b[0])) {
  if (win.busy < 30) continue;
  console.log(`  ${w * 100}ms busy ${win.busy.toFixed(0)}: ${top(win.fns, 4).join(' | ')}`);
}
console.log('top self:\n  ' + top(self, 40).join('\n  '));
console.log('top inclusive:\n  ' + top(incl, 80).join('\n  '));

// Per long task: the top functions by inclusive time among its samples. Profile time is aligned
// to page time by the first raster call (transferToImageBitmap, skwasm's `Nb`).
const firstRaster = (() => {
  let tt = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    tt += dt[i];
    if (name(byId.get(profile.samples[i])).startsWith('Nb ')) return tt / 1000;
  }
  return 0;
})();
const offset = firstRaster - frames[0][0];
for (const [start, dur] of longTasksSeen) {
  const m = new Map();
  let tt = 0;
  profile.samples.forEach((id, i) => {
    tt += dt[i];
    const pt = tt / 1000 - offset;
    if (pt < start || pt > start + dur) return;
    const d = (dt[i + 1] ?? 0) / 1000;
    const seen = new Set();
    for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
      const n = name(byId.get(cur)).replace(/ main\.dart\.wasm.*| skwasm\.wasm.*/, '');
      if (!seen.has(n)) { seen.add(n); m.set(n, (m.get(n) ?? 0) + d); }
    }
  });
  const skip = /^\(root\)|trampoline|^_CustomZone|^_root|closure wrapper|^invoke|^js-to-wasm|^wasm-to-js|^_invokeCallback|^\(anon\) main\.dart\.mjs/;
  console.log(`long task ${start}+${dur}: ` + [...m].filter(([n]) => !skip.test(n)).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([n, v]) => `${v.toFixed(0)} ${n.slice(0, 90)}`).join(' | '));
}
