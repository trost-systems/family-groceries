// The app side of a capture: seeded demo households (fg seed, generic stores only), a browser
// context on the web build at a device's viewport with the page clock faked from the first
// script on, sign-in through the real login screen, and the frozen frame.

import { instance, labels, signIn, addField } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { seed } from './seed.mjs';
import { layout } from './sets.mjs';

export { OUT, apiAs, seed } from './seed.mjs';

/**
 * The page's wall clock in every capture: Saturday morning, 31 October 2026, Berlin. Timers and
 * animation frames run on the same fake clock, so a frame is "N ms after the tap", never "however
 * long the host took". Seeded data is relative to the seeding moment and computed server-side
 * (due items, item order); the app shows no wall-clock time in any scene.
 */
export const FIXED_TIME = new Date('2026-10-31T10:00:00+01:00');

const runs = new Map();

/** The locale's shared run (scenes that change nothing), seeded once per worker. */
export async function sharedRun(scenario) {
  if (!runs.has(scenario)) runs.set(scenario, await seed(scenario));
  return runs.get(scenario);
}

/**
 * A page on the web build as [handle] of [run], at the device's viewport, with the fake clock.
 * The first sign-in of a member goes through the login screen; later contexts reuse its storage
 * (the session, the declined analytics question, the dismissed explainer).
 */
export async function openAs(browser, { run, handle, device, lang, dark = false }) {
  const { viewport, dpr } = layout(device);
  const user = run.users[handle];
  const context = await browser.newContext({
    baseURL: instance().webUrl,
    viewport,
    deviceScaleFactor: dpr,
    locale: lang === 'en' ? 'en-US' : 'de-DE',
    timezoneId: 'Europe/Berlin',
    colorScheme: dark ? 'dark' : 'light',
    reducedMotion: 'no-preference',
    storageState: run.states.get(handle),
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: FIXED_TIME });
  const L = labels(lang);
  if (run.states.has(handle)) {
    await page.goto('/');
    await addField(page, L).waitFor({ timeout: 30_000 });
  } else {
    await signIn(page, L, user);
    run.states.set(handle, await context.storageState());
  }
  await page.evaluate(() => document.fonts.ready);
  // No hover: a tooltip under a resting pointer is not part of any phone screen.
  await page.mouse.move(viewport.width - 1, 0);
  return { context, page, L, user, errors };
}

/**
 * Stops the page clock: from here on, frames come only from step(). The fake requestAnimationFrame
 * fires every 16 ms counted from the clock's install time, so the clock stops on that grid and
 * every later frame lands at the same phase, whatever the host took to get here.
 */
export async function pause(page) {
  const now = await page.evaluate(() => Date.now());
  const grid = 16;
  const from = FIXED_TIME.getTime();
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
