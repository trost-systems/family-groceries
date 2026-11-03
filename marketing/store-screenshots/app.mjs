// The app side of a capture: seeded demo households (fg seed, generic stores only), a browser
// context on the web build at a device's viewport with the page clock faked from the first
// script on, sign-in through the real login screen, and the frozen frame.

import { instance, labels, signIn, addField } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { seed } from './seed.mjs';
import { CAPTURES } from './sets.mjs';

export { OUT, apiAs, seed } from './seed.mjs';

/**
 * The page's clock is fake from the first script on and starts at the moment its run was seeded.
 * The scenario's times count from that moment too, so the app sees the same ages every run (the
 * add sheet's 30-day recent rows are computed on the device); no scene shows a date. Timers and
 * animation frames run on the same clock, so a frame is "N ms after the tap", never "however long
 * the host took".
 */
const runs = new Map();

/** The locale's shared run (scenes that change nothing), seeded once per worker. */
export async function sharedRun(scenario) {
  if (!runs.has(scenario)) runs.set(scenario, await seed(scenario));
  return runs.get(scenario);
}

// The invite link on the web is the page's own origin; the phones share https://app.hummlist.com.
// A page that shows it runs at that origin, every request to it served by the local web build.
const APP_ORIGIN = 'https://app.hummlist.com';

/**
 * A page on the web build as [handle] of [run], at the capture's viewport, with the fake clock.
 * The first sign-in of a member at an origin goes through the login screen; later contexts reuse
 * its storage (the session, the declined analytics question, the dismissed explainer).
 */
export async function openAs(browser, { run, handle, capture, lang, appOrigin = false }) {
  const { viewport, dpr } = CAPTURES[capture];
  const user = run.users[handle];
  const origin = appOrigin ? APP_ORIGIN : instance().webUrl;
  const key = `${handle} ${origin}`;
  const context = await browser.newContext({
    baseURL: origin,
    viewport,
    deviceScaleFactor: dpr,
    locale: lang === 'en' ? 'en-US' : 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: 'light',
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
    storageState: run.states.get(key),
  });
  if (appOrigin) {
    await context.route(`${APP_ORIGIN}/**`, async (route) => {
      const { pathname, search } = new URL(route.request().url());
      await route.fulfill({ response: await route.fetch({ url: `${instance().webUrl}${pathname}${search}` }) });
    });
  }
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: run.seededAt });
  const L = labels(lang);
  if (run.states.has(key)) {
    await page.goto('/');
    await addField(page, L).waitFor({ timeout: 30_000 });
  } else {
    await signIn(page, L, user);
    run.states.set(key, await context.storageState());
  }
  await page.evaluate(() => document.fonts.ready);
  // No hover: a tooltip under a resting pointer is not part of any phone screen.
  await page.mouse.move(viewport.width - 1, 0);
  return { context, page: Object.assign(page, { clockStart: run.seededAt }), L, user, errors };
}

/**
 * Stops the page clock: from here on, frames come only from step(). The fake requestAnimationFrame
 * fires every 16 ms counted from the clock's install time, so the clock stops on that grid and
 * every later frame lands at the same phase, whatever the host took to get here.
 */
export async function pause(page) {
  const now = await page.evaluate(() => Date.now());
  const grid = 16;
  const from = page.clockStart;
  await page.clock.pauseAt(from + Math.ceil((now + 1000 - from) / grid) * grid);
}

/** Runs the paused clock forward by ms: timers fire and Flutter draws the frames in between. */
export const step = (page, ms) => page.clock.runFor(ms);

/**
 * Steps the paused clock a frame at a time until [locator] shows, then [settle] ms more. What
 * arrives from outside (a partner's add over realtime) lands on a frame boundary, so the frame
 * taken is [settle] ms after the arrival, give or take one frame of 16 ms.
 */
export async function stepUntil(page, locator, settle, timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  while (!(await locator.isVisible().catch(() => false))) {
    if (Date.now() > end) throw new Error(`${locator} did not show within ${timeoutMs} ms`);
    await step(page, 16);
    await new Promise((r) => setTimeout(r, 15));
  }
  await step(page, settle);
}
