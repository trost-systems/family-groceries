#!/usr/bin/env node
// Runs the hc-memory session in the profile app and prints one JSON line of samples and phase maxima.
// Usage: session.mjs <bundle> <email> <password> (DISPLAY set, e.g. under xvfb-run).
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [bundle, email, password] = process.argv.slice(2);
const SAMPLE_MS = 250;
const IDLE_MS = 60_000;
const STEADY_MS = 30_000;
const SCROLL_ROUNDS = 3;
const SWIPES_PER_PASS = 45;
const ADDED = [
  'Ingwer', 'Koriander', 'Petersilie', 'Basilikum', 'Rosmarin', 'Thymian', 'Oregano', 'Zimt', 'Muskat', 'Paprikapulver',
  'Kurkuma', 'Kreuzkümmel', 'Lorbeer', 'Dill', 'Schnittlauch', 'Minze', 'Salbei', 'Vanillezucker', 'Backpulver', 'Hefe',
];

const t0 = Date.now();
const now = () => Date.now() - t0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let errors = 0;
let actions = 0;

const home = mkdtempSync(join(tmpdir(), 'hc-memory-'));
// stdbuf execs the bundle, so app.pid is the app's own pid.
const app = spawn('stdbuf', ['-oL', '-eL', bundle], {
  env: {
    ...process.env,
    XDG_DATA_HOME: `${home}/data`,
    XDG_CONFIG_HOME: `${home}/config`,
    XDG_CACHE_HOME: `${home}/cache`,
    NO_AT_BRIDGE: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
app.stdout.on('data', (d) => (output += d));
app.stderr.on('data', (d) => (output += d));

function cleanup() {
  try {
    app.kill('SIGKILL');
  } catch {}
  rmSync(home, { recursive: true, force: true });
}
function fail(step, err) {
  cleanup();
  process.stderr.write(`FAIL ${step}: ${err?.stack ?? err}\n--- app output (tail) ---\n${output.slice(-4000)}\n`);
  process.exit(1);
}

async function vmUri() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    const m = output.match(/The Dart VM service is listening on (http:\/\/127\.0\.0\.1:\d+\/[^\s]*)/);
    if (m) return m[1].replace(/^http/, 'ws').replace(/\/?$/, '/ws');
    await sleep(100);
  }
  throw new Error('no VM service URI within 90 s');
}

class Vm {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result);
    });
  }
  static async connect(uri) {
    const ws = new WebSocket(uri);
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true });
      ws.addEventListener('error', rej, { once: true });
    });
    return new Vm(ws);
  }
  call(method, params = {}) {
    const id = String(++this.id);
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
}

function rssKb(pid) {
  const status = readFileSync(`/proc/${pid}/status`, 'utf8');
  const field = (name) => Number(status.match(new RegExp(`^${name}:\\s+(\\d+) kB`, 'm'))?.[1] ?? NaN);
  return { rss: field('VmRSS'), hwm: field('VmHWM') };
}

const samples = [];
let phase = 'launch';
const phases = [];
function enter(name) {
  phase = name;
  phases.push({ name, startMs: now() });
}

async function main() {
  enter('launch');
  const vm = await Vm.connect(await vmUri()).catch((e) => fail('connect', e));
  let isolate;
  const extDeadline = Date.now() + 90_000;
  while (!isolate) {
    const { isolates } = await vm.call('getVM');
    for (const ref of isolates) {
      const iso = await vm.call('getIsolate', { isolateId: ref.id });
      if ((iso.extensionRPCs ?? []).includes('ext.flutter.marionette.tap')) isolate = ref.id;
    }
    if (!isolate) {
      if (Date.now() > extDeadline) throw new Error('Marionette did not register within 90 s');
      await sleep(250);
    }
  }

  let sampling = true;
  const sampler = (async () => {
    while (sampling) {
      const at = now();
      const p = phase;
      try {
        const { rss } = rssKb(app.pid);
        const mem = await vm.call('getMemoryUsage', { isolateId: isolate });
        samples.push({ at, phase: p, rssKb: rss, heapUsage: mem.heapUsage, heapCapacity: mem.heapCapacity, external: mem.externalUsage });
      } catch (e) {
        errors++;
      }
      await sleep(Math.max(0, SAMPLE_MS - (now() - at)));
    }
  })();

  const ext = async (name, params = {}) => {
    actions++;
    const stringy = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]));
    return await vm.call(`ext.flutter.marionette.${name}`, { isolateId: isolate, ...stringy });
  };
  const elements = async () => (await ext('interactiveElements')).elements ?? [];
  const waitFor = async (pred, what, timeout = 30_000) => {
    const deadline = Date.now() + timeout;
    for (;;) {
      const els = await elements();
      if (els.some(pred)) return;
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await sleep(250);
    }
  };
  const waitGone = async (pred, what, timeout = 15_000) => {
    const deadline = Date.now() + timeout;
    while ((await elements()).some(pred)) {
      if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
      await sleep(250);
    }
  };
  const byKey = (key) => (e) => e.key === key;
  const byText = (text) => (e) => e.text === text || e.label === text;
  const step = async (name, fn) => {
    try {
      await fn();
    } catch (e) {
      throw new Error(`${name}: ${e.message}`);
    }
  };

  enter('login');
  await step('login', async () => {
    await waitFor(byKey('login-email'), 'login-email', 60_000);
    await ext('tap', { key: 'login-email' });
    await ext('enterText', { key: 'login-email', input: email });
    await ext('tap', { key: 'login-password' });
    await ext('enterText', { key: 'login-password', input: password });
    await ext('pressKey', { key: 'enter' });
    await waitFor(byKey('list-header'), 'list-header', 60_000);
  });

  enter('open-list');
  await step('open-list', async () => {
    await sleep(3000);
    const els = await elements();
    if (els.some(byKey('list-hint-dismiss'))) await ext('tap', { key: 'list-hint-dismiss' });
    await sleep(1000);
  });

  enter('scroll');
  await step('scroll', async () => {
    for (let round = 0; round < SCROLL_ROUNDS; round++) {
      for (let i = 0; i < SWIPES_PER_PASS; i++) await ext('swipe', { startX: 206, startY: 700, endX: 206, endY: 200 });
      for (let i = 0; i < SWIPES_PER_PASS; i++) await ext('swipe', { startX: 206, startY: 200, endX: 206, endY: 700 });
    }
  });

  enter('add');
  await step('add', async () => {
    await ext('tap', { key: 'add-item-field' });
    await waitFor(byKey('add-sheet'), 'add-sheet');
    for (const name of ADDED) {
      await ext('enterText', { key: 'add-item-field', input: name });
      await waitFor((e) => e.key === 'suggestion-0', `suggestion for ${name}`);
      await ext('pressKey', { key: 'enter' });
      await waitFor((e) => e.key === 'added-note', `added-note for ${name}`);
    }
    await ext('tap', { key: 'add-sheet-close' });
    await waitFor((e) => e.key === 'list-header', 'list after add');
    await sleep(1000);
  });

  enter('tick');
  await step('tick', async () => {
    for (const name of ADDED) {
      await ext('scrollTo', { text: name });
      // scrollTo can leave the row at the list's top edge under the header; bring it clear of it.
      const row = (await elements()).find(byText(name));
      if (!row || row.bounds.y < 100) await ext('swipe', { startX: 206, startY: 400, endX: 206, endY: 550 });
      await ext('tap', { text: name });
      await waitGone(byText(name), `${name} ticked away`);
    }
    await sleep(1000);
  });

  enter('add-sheet');
  await step('add-sheet', async () => {
    await ext('tap', { key: 'add-item-field' });
    await waitFor(byKey('add-sheet'), 'add-sheet');
    await sleep(1500);
    await ext('tap', { key: 'add-sheet-close' });
    await sleep(1000);
  });

  enter('more');
  await step('more', async () => {
    await ext('tap', { key: 'tab-more' });
    await waitFor(byKey('more-screen'), 'more-screen');
    await sleep(1500);
  });

  enter('premium');
  await step('premium', async () => {
    await ext('scrollTo', { key: 'more-lifetime' });
    await ext('tap', { key: 'more-lifetime' });
    await waitFor(byKey('premium-card-yearly'), 'premium-card-yearly');
    await sleep(2000);
    await ext('pressBackButton');
    await waitFor(byKey('more-screen'), 'more-screen after premium');
  });

  enter('back-to-list');
  await step('back-to-list', async () => {
    await ext('tap', { key: 'tab-list' });
    await waitFor(byKey('list-header'), 'list-header after more');
  });

  enter('idle');
  const idleStart = now();
  await sleep(IDLE_MS);
  const imageCache = await vm.call('ext.hc.imageCache', { isolateId: isolate });
  sampling = false;
  await sampler;
  const { hwm } = rssKb(app.pid);
  // Diagnostics for runs that are not reported: the idle mapping breakdown.
  if (process.env.HC_SMAPS) writeFileSync(process.env.HC_SMAPS, readFileSync(`/proc/${app.pid}/smaps`));
  cleanup();

  const mb = (kb) => Math.round((kb / 1024) * 10) / 10;
  const mib = (b) => Math.round((b / 1048576) * 10) / 10;
  const median = (xs) => {
    const s = [...xs].sort((a, b) => a - b);
    const m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const steadySamples = samples.filter((s) => s.at >= idleStart + IDLE_MS - STEADY_MS);
  const perPhase = {};
  for (const s of samples) {
    const p = (perPhase[s.phase] ??= { rssMb: 0, dartHeapMb: 0, samples: 0 });
    p.rssMb = Math.max(p.rssMb, mb(s.rssKb));
    p.dartHeapMb = Math.max(p.dartHeapMb, mib(s.heapUsage + s.external));
    p.samples++;
  }
  const peakSampled = Math.max(...samples.map((s) => s.rssKb));
  const result = {
    peakRssMb: mb(hwm),
    peakRssSampledMb: mb(peakSampled),
    steadyRssMb: mb(median(steadySamples.map((s) => s.rssKb))),
    steadyDartHeapMb: mib(median(steadySamples.map((s) => s.heapUsage))),
    steadyDartExternalMb: mib(median(steadySamples.map((s) => s.external))),
    peakDartHeapMb: mib(Math.max(...samples.map((s) => s.heapUsage))),
    imageCacheMb: mib(imageCache.bytes ?? 0),
    imageCacheCount: imageCache.count,
    imageCacheLive: imageCache.live,
    phases: perPhase,
    samples: samples.length,
    steadySamples: steadySamples.length,
    actions,
    sampleErrors: errors,
    sessionSec: Math.round(now() / 100) / 10,
  };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exit(0);
}

main().catch((e) => fail('session', e));
