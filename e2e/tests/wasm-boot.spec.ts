import { expect, test, type Page } from './fixtures';
import { addField, addSheet, addedNote, closeSheet, itemRow, newEmail, screenshot, signUpWithHousehold, tick, typeInto } from './helpers';
import { engineOf, wasmAllowList, watchBuild, withoutWasmGC, type Build } from './web-build';

// Job 28: the web build is `flutter build web --wasm`, holding a wasm app and a JS app. Job 201:
// Flutter 3.50 runs the wasm app in Safari 26.2+ and Firefox 147+ too, and flutter_bootstrap.js
// puts all three engines on its allow list. Runs in the chromium, webkit and firefox projects:
// each engine runs the wasm app, and the same build still falls back to JS without the Wasm
// features or with the engine off the allow list.

/** Console errors and uncaught exceptions, which a broken boot or renderer shows first. */
function watchErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(String(error)));
  return () => errors;
}

/** Counts focusout events of the add field's input, from the page's start (job 210). */
async function countAddFieldBlurs(page: Page): Promise<() => Promise<number>> {
  await page.addInitScript(() => {
    const w = window as unknown as { addFieldBlurs: number };
    w.addFieldBlurs = 0;
    globalThis.addEventListener('focusout', (event) => {
      if (event.target instanceof HTMLInputElement && event.target.getAttribute('aria-label')?.startsWith('Was brauchst du?')) {
        w.addFieldBlurs++;
      }
    }, true);
  });
  return () => page.evaluate(() => (window as unknown as { addFieldBlurs: number }).addFieldBlurs);
}

/**
 * Adds [first] and [second] by Enter, typing the second without a click: the field must keep the
 * keyboard after an add. In Firefox it often lost it about 80 ms after the Enter, until job 210
 * (EditableText's restart of the text connection, whose deferred engine blur landed after the
 * refocus). Its input never blurs: in Firefox 18 of 20 Enters blurred it before, and most refocused.
 */
async function addTwoByEnter(page: Page, blurs: () => Promise<number>, first: string, second: string): Promise<void> {
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await typeInto(addField(page), first);
  await expect(addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ })).toBeVisible();
  const before = await blurs();
  await page.keyboard.press('Enter');
  await expect(addedNote(page, new RegExp(`^✓ Hinzugefügt: ${first}`))).toBeVisible();
  await expect(addField(page)).toHaveValue('');
  // The lost focus came about 80 ms after the Enter; typing waits that out.
  await page.waitForTimeout(300);
  await page.keyboard.insertText(second);
  await expect(addField(page), 'the field kept the keyboard after the add').toHaveValue(second);
  await expect(addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(addedNote(page, new RegExp(`^✓ Hinzugefügt: ${second}`))).toBeVisible();
  await page.waitForTimeout(300);
  expect(await blurs() - before, 'the add field\'s input never blurred').toBe(0);
  await screenshot(page, `210-two-by-enter-${page.context().browser()?.browserType().name() ?? 'browser'}-${first}`);
  await closeSheet(page);
}

/** Signs up, adds and ticks one item, reloads, and checks that every load ran [build]. */
async function useTheList(page: Page, build: Build, item: string): Promise<void> {
  const loaded = watchBuild(page);
  const errors = watchErrors(page);
  const blurs = await countAddFieldBlurs(page);
  await signUpWithHousehold(page, newEmail(`${build}-boot`));
  expect(loaded(), `main.dart.${build} only`).toEqual([build]);
  const renderer = build === 'wasm' ? '_flutter_skwasmInstance' : 'flutterCanvasKit';
  expect(await page.evaluate((key) => key in window, renderer), `the ${build === 'wasm' ? 'skwasm' : 'CanvasKit'} renderer runs`).toBe(true);

  await addTwoByEnter(page, blurs, item, 'Brot');
  await tick(page, 'Brot');
  await page.reload();
  await expect(itemRow(page, item)).toBeVisible();
  await expect(itemRow(page, 'Brot')).toHaveCount(0);
  expect(loaded()).toEqual([build, build]);
  expect(errors(), 'console errors').toEqual([]);
}

test('the engine runs the wasm build: sign up, add, tick, reload', async ({ page, browserName }) => {
  // A CI runner's WebKit draws in software, a frame every 200 ms or so: each step takes a second.
  // The JS tests too: the fallback took 53 s of its 60 on main already.
  test.slow(browserName === 'webkit');
  // Headless Firefox has no WebGL, which skwasm needs; playwright.config.ts runs it headed when
  // there is a display (scripts/gates/e2e.sh starts Xvfb). Real Firefox always has WebGL.
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
  expect(webgl, 'WebGL in this browser: run Firefox headed under xvfb-run (scripts/gates/e2e.sh)').toBe(true);
  await useTheList(page, 'wasm', 'Bananen');
  await screenshot(page, `201-wasm-${browserName}`);
});

test('without the Wasm features the same build falls back to JS', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit');
  await withoutWasmGC(page);
  await useTheList(page, 'js', 'Äpfel');
  await screenshot(page, `201-js-fallback-${browserName}`);
});

test('off the allow list the engine runs JS', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit');
  await wasmAllowList(page, { [engineOf(browserName)]: false });
  await useTheList(page, 'js', 'Birnen');
});
