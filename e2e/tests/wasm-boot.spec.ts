import { expect, test, type Page } from './fixtures';
import { addField, addSheet, addedNote, itemRow, newEmail, screenshot, signUpWithHousehold, tick, typeInto } from './helpers';
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

/**
 * Adds [text] with a tap on its row and closes the sheet with Schließen. Not with Enter: in Firefox
 * the field often loses its focus after an Enter (7 of 12 CI runs on 3.47 too, DECISIONS job 201).
 */
async function addByTap(page: Page, text: string): Promise<void> {
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await typeInto(addField(page), text);
  await addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ }).click();
  await expect(addedNote(page).first()).toBeVisible();
  await addSheet(page).getByRole('button', { name: 'Schließen' }).click();
  await expect(addSheet(page)).toHaveCount(0);
}

/** Signs up, adds and ticks one item, reloads, and checks that every load ran [build]. */
async function useTheList(page: Page, build: Build, item: string): Promise<void> {
  const loaded = watchBuild(page);
  const errors = watchErrors(page);
  await signUpWithHousehold(page, newEmail(`${build}-boot`));
  expect(loaded(), `main.dart.${build} only`).toEqual([build]);
  const renderer = build === 'wasm' ? '_flutter_skwasmInstance' : 'flutterCanvasKit';
  expect(await page.evaluate((key) => key in window, renderer), `the ${build === 'wasm' ? 'skwasm' : 'CanvasKit'} renderer runs`).toBe(true);

  await addByTap(page, item);
  await addByTap(page, 'Brot');
  await tick(page, 'Brot');
  await page.reload();
  await expect(itemRow(page, item)).toBeVisible();
  await expect(itemRow(page, 'Brot')).toHaveCount(0);
  expect(loaded()).toEqual([build, build]);
  expect(errors(), 'console errors').toEqual([]);
}

test('the engine runs the wasm build: sign up, add, tick, reload', async ({ page, browserName }) => {
  // A CI runner's WebKit draws in software, a frame every 200 ms or so: each step takes a second.
  test.slow(browserName === 'webkit');
  // Headless Firefox has no WebGL, which skwasm needs; playwright.config.ts runs it headed when
  // there is a display (scripts/gates/e2e.sh starts Xvfb). Real Firefox always has WebGL.
  const webgl = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl'));
  expect(webgl, 'WebGL in this browser: run Firefox headed under xvfb-run (scripts/gates/e2e.sh)').toBe(true);
  await useTheList(page, 'wasm', 'Bananen');
  await screenshot(page, `201-wasm-${browserName}`);
});

test('without the Wasm features the same build falls back to JS', async ({ page, browserName }) => {
  await withoutWasmGC(page);
  await useTheList(page, 'js', 'Äpfel');
  await screenshot(page, `201-js-fallback-${browserName}`);
});

test('off the allow list the engine runs JS', async ({ page, browserName }) => {
  await wasmAllowList(page, { [engineOf(browserName)]: false });
  await useTheList(page, 'js', 'Birnen');
});
