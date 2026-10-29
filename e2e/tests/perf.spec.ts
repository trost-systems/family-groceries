import { chromium, expect, test, type Browser, type Page } from './fixtures';
import { newEmail } from './helpers';
import { householdWithItems, signIn, wasmAllowList, watchBuild, type Build } from './web-build';

// Job 28: what "clunky" costs, per build, in the same browser and the same run. For each build:
// the time from navigation to the drawn list (a signed-in reload, three times), and the frame
// intervals (requestAnimationFrame) while the mouse wheel scrolls a 200-item list down and up,
// twice (the first pass also builds the rows). Each result is one `PERF {...}` line in the
// output. The numbers compare builds within one run; a CI runner draws without a GPU, so they
// are not a phone's. Only when named on the command line (playwright.config.ts).
//
// Chromium runs wasm by default, wasm multi-threaded when the page is cross-origin isolated, and
// JS when it is off the allow list. WebKit (the `webkit`
// project) runs JS by default, as Safari does, and wasm when put on the allow list; a wasm boot
// that fails there is reported, not a failure, since Flutter keeps WebKit off by default.

const GROCERIES = [
  'Milch', 'Butter', 'Joghurt', 'Quark', 'Sahne', 'Käse', 'Eier', 'Brot', 'Brötchen', 'Toast',
  'Äpfel', 'Bananen', 'Birnen', 'Trauben', 'Zitronen', 'Orangen', 'Tomaten', 'Gurken', 'Paprika', 'Zwiebeln',
  'Kartoffeln', 'Karotten', 'Salat', 'Spinat', 'Brokkoli', 'Nudeln', 'Reis', 'Mehl', 'Zucker', 'Salz',
  'Kaffee', 'Tee', 'Saft', 'Wasser', 'Bier', 'Wein', 'Schokolade', 'Kekse', 'Chips', 'Müsli',
  'Hähnchen', 'Hackfleisch', 'Lachs', 'Wurst', 'Schinken', 'Spülmittel', 'Zahnpasta', 'Shampoo', 'Seife', 'Windeln',
];
const ITEMS = Array.from({ length: 200 }, (_, i) => `${GROCERIES[i % GROCERIES.length]} ${Math.floor(i / GROCERIES.length) + 1}`);

type Frames = { frames: number; meanMs: number; p50Ms: number; p95Ms: number; maxMs: number; over25ms: number };

function stats(intervals: number[]): Frames {
  const sorted = [...intervals].sort((a, b) => a - b);
  const at = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    frames: sorted.length,
    meanMs: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    p50Ms: round(at(0.5)),
    p95Ms: round(at(0.95)),
    maxMs: round(sorted[sorted.length - 1]),
    over25ms: sorted.filter((ms) => ms > 25).length,
  };
}

/** Milliseconds from navigation to the frame that shows the list's "200 Artikel". */
async function timeToList(page: Page): Promise<number> {
  const at = await page.waitForFunction(
    // Semantics texts run together in textContent ("Messung200 Artikel"): no word boundaries.
    () => (document.body.textContent ?? '').includes('200 Artikel') && performance.now(),
    undefined,
    { polling: 'raf', timeout: 60_000 },
  );
  return Math.round(await at.jsonValue() as number);
}

/** Wheel-scrolls the list to the bottom and back, recording every frame interval meanwhile. */
async function scrollPass(page: Page): Promise<Frames> {
  await page.evaluate(() => {
    const w = window as unknown as { frameLog: number[]; recording: boolean };
    w.frameLog = [];
    w.recording = true;
    let last = 0;
    const tick = (now: number) => {
      if (last) w.frameLog.push(now - last);
      last = now;
      if (w.recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const visibleRows = () => page.evaluate(() => [...document.querySelectorAll('flt-semantics[role="button"]')]
    .map((e) => e.getAttribute('aria-label') ?? e.textContent).filter(Boolean).join('|'));
  const before = await visibleRows();
  for (const dy of [100, -100]) {
    for (let step = 0; step < 60; step++) {
      await page.mouse.wheel(0, dy);
      await page.waitForTimeout(25);
    }
    if (dy > 0) expect(await visibleRows(), 'the wheel scrolled the list').not.toBe(before);
  }
  const intervals = await page.evaluate(() => {
    const w = window as unknown as { frameLog: number[]; recording: boolean };
    w.recording = false;
    return w.frameLog;
  });
  return stats(intervals);
}

type Variant = { build: Build; allow?: { blink?: boolean; webkit?: boolean }; isolated?: boolean; optional?: boolean };

/**
 * Serves the page cross-origin isolated (COOP same-origin, COEP credentialless), which lets skwasm
 * render on a worker thread; vercel.json does not send these headers (DECISIONS job 28).
 */
async function isolate(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.fallback();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'cross-origin-opener-policy': 'same-origin', 'cross-origin-embedder-policy': 'credentialless' },
    });
  });
}

async function measure(browser: Browser, baseURL: string | undefined, email: string, { build, allow, isolated }: Variant) {
  // Isolated, Chromium applies Local Network Access to the page's fetches, and the test page
  // (127.0.0.1:<web>) may not reach the local stack (127.0.0.1:54321). The hosted app talks to
  // a public Supabase host, so the check is off in this browser of its own.
  const own = isolated ? await chromium.launch({ args: ['--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults'] }) : null;
  const context = await (own ?? browser).newContext({ baseURL, viewport: { width: 393, height: 852 }, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  const page = await context.newPage();
  if (allow) await wasmAllowList(page, allow);
  if (isolated) await isolate(page);
  const loaded = watchBuild(page);
  try {
    await page.goto('/');
    await signIn(page, email);
    const loads: number[] = [];
    for (let i = 0; i < 3; i++) {
      await page.reload();
      loads.push(await timeToList(page));
    }
    expect([...new Set(loaded())], `every load ran the ${build} build`).toEqual([build]);
    expect(await page.evaluate(() => window.crossOriginIsolated), 'cross-origin isolated').toBe(!!isolated);
    const list = await page.getByText(/^200 Artikel$/).boundingBox();
    await page.mouse.move(196, (list?.y ?? 100) + 300);
    const first = await scrollPass(page);
    const second = await scrollPass(page);
    return { build: `${build}${isolated ? ' isolated' : ''}`, loadMs: loads, loadMedianMs: [...loads].sort((a, b) => a - b)[1], firstScroll: first, secondScroll: second };
  } finally {
    await context.close();
    await own?.close();
  }
}

test('boot and scroll timings, wasm against JS', { tag: '@perf' }, async ({ browser, browserName }, testInfo) => {
  test.setTimeout(300_000);
  const email = newEmail('perf');
  await householdWithItems(email, ITEMS);
  const variants: Variant[] = browserName === 'webkit'
    ? [{ build: 'js' }, { build: 'wasm', allow: { webkit: true }, optional: true }]
    : [{ build: 'wasm' }, { build: 'wasm', isolated: true, optional: true }, { build: 'js', allow: { blink: false } }];
  const results = [];
  for (const variant of variants) {
    try {
      const result = { browser: browserName, ...await measure(browser, testInfo.project.use.baseURL, email, variant) };
      console.log(`PERF ${JSON.stringify(result)}`);
      results.push(result);
    } catch (error) {
      if (!variant.optional) throw error;
      const result = { browser: browserName, build: variant.build, failed: String(error).split('\n')[0] };
      console.log(`PERF ${JSON.stringify(result)}`);
      results.push(result);
    }
  }
  await testInfo.attach(`perf-${browserName}.json`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
});
