import { expect, test, type Page } from './fixtures';
import { addField, addSheet, newEmail, nextFrames, screenshot } from './helpers';
import { householdWithItems, signIn, watchBuild } from './web-build';

// Job 28, in WebKit as an iPhone (the `iphone` project). Peter had to tap the add field twice in
// Safari before the keyboard opened. iOS opens the keyboard only for a focus that happens while
// the tap is being handled, and closes it on blur. So one tap must focus the field's DOM input
// either natively or from inside the tap's own events, and nothing may blur or refocus it later.

type FocusEntry = { at: number; what: string; target: string; during: string; already?: boolean };

/** Logs every focus change of the page from now on, and every focus()/blur() call, with the event being handled. */
async function logFocus(page: Page): Promise<void> {
  await page.evaluate(() => {
    const log: FocusEntry[] = [];
    (window as unknown as { focusLog: FocusEntry[] }).focusLog = log;
    const name = (el: EventTarget | null) => el instanceof HTMLElement
      ? `${el.tagName.toLowerCase()}${el.dataset.semanticsRole ? `[${el.dataset.semanticsRole}]` : ''}`
      : String(el);
    const add = (what: string, target: EventTarget | null, during = window.event?.type ?? 'none', already?: boolean) =>
      log.push({ at: Math.round(performance.now()), what, target: name(target), during, already });
    for (const type of ['touchstart', 'touchend', 'click', 'focusin', 'focusout']) {
      document.addEventListener(type, (event) => add(type, event.target, type), true);
    }
    for (const method of ['focus', 'blur'] as const) {
      const original = HTMLElement.prototype[method];
      HTMLElement.prototype[method] = function (this: HTMLElement, ...args: [FocusOptions?]) {
        add(`${method}()`, this, undefined, document.activeElement === this);
        return original.apply(this, args);
      };
    }
  });
}

const format = (log: FocusEntry[]) =>
  log.map((e) => `  ${e.at} ${e.what} ${e.target} during ${e.during}${e.already ? ' (already focused)' : ''}`).join('\n');

const focusLog = (page: Page) => page.evaluate(() => (window as unknown as { focusLog: FocusEntry[] }).focusLog);

const gestureEvents = new Set(['touchstart', 'touchend', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click']);

const isInput = (e: FocusEntry) => /^(input|textarea)/.test(e.target);

/**
 * A focus() that moved the focus outside a tap: iOS shows no keyboard for it. The engine calls
 * focus() again on the input it already focused when it places it, a no-op (no focus change, no
 * keyboard change), so only a call that moves the focus counts.
 */
const focusOutsideTap = (log: FocusEntry[]) =>
  log.filter((e) => isInput(e) && e.what === 'focus()' && !e.already && !gestureEvents.has(e.during));

/**
 * Taps the add field once and checks it took the focus for the keyboard, with the log as the
 * reason: the input is focused during the tap (natively, or by focus() in the tap's events; a
 * tap that refocuses an input brings the keyboard back on iOS), nothing moves the focus later,
 * and nothing blurs it.
 */
async function tapFieldOnce(page: Page, text: string): Promise<void> {
  await logFocus(page);
  await addField(page).tap();
  await nextFrames(page);
  // Long enough for every deferred focus change (the app's 50 ms refocus, the engine's timers).
  await page.waitForTimeout(500);
  await nextFrames(page);
  const log = await focusLog(page);
  const report = `focus log after one tap:\n${format(log)}`;
  console.log(report);

  await expect(addField(page), report).toBeFocused();
  expect(log.filter((e) => isInput(e) && (e.what === 'focusin' || (e.what === 'focus()' && gestureEvents.has(e.during)))),
    `the tap did not focus the input\n${report}`).not.toEqual([]);
  expect(focusOutsideTap(log), `the input was focused outside the tap, so iOS shows no keyboard\n${report}`).toEqual([]);
  expect(log.filter((e) => isInput(e) && (e.what === 'focusout' || e.what === 'blur()')), `the input lost focus after the tap, which closes the keyboard\n${report}`)
    .toEqual([]);

  // Typing right away reaches the app: no second tap.
  await page.keyboard.insertText(text);
  await expect(addSheet(page).getByRole('button', { name: new RegExp(`^${text}, Wie getippt(,|$)`) })).toBeVisible();
  await expect(addField(page)).toHaveValue(text);
}

// Playwright's iPhone profile sets the user agent, but navigator.platform stays the host's
// ("Linux x86_64" on CI), and Flutter takes the OS from the platform: it would run its Linux
// text input and autofocus the field like on a desktop. Safari on an iPhone says "iPhone".
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'platform', { get: () => 'iPhone' });
  });
});

test('one tap on the add field opens the sheet with the field focused for the keyboard', async ({ page }) => {
  const email = newEmail('iphone');
  await householdWithItems(email, ['Brot']);
  const loaded = watchBuild(page);
  await page.goto('/');
  await signIn(page, email);
  expect(await page.evaluate(() => navigator.platform)).toBe('iPhone');
  // Flutter keeps WebKit (Safari, every iOS browser) on the JS build by default (DECISIONS job 28).
  expect(loaded()).toEqual(['js']);
  await expect(addField(page), 'phones get the keyboard only when asked').not.toBeFocused();

  await tapFieldOnce(page, 'Milch');
  await screenshot(page, '28-iphone-one-tap');

  // Closed with the sheet's button, the field again takes one tap.
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await addSheet(page).getByRole('button', { name: 'Schließen' }).tap();
  await expect(addSheet(page)).toHaveCount(0);
  await expect(addField(page)).not.toBeFocused();
  await tapFieldOnce(page, 'Milch');
});

test('after a tapped suggestion one tap on the field brings the keyboard back', async ({ page }) => {
  const email = newEmail('iphone-pick');
  await householdWithItems(email, ['Brot']);
  await page.goto('/');
  await signIn(page, email);
  await tapFieldOnce(page, 'Milch');

  // Takes "Milch" from the sheet with a tap, as on the phone. The tap blurs the input, which puts
  // the keyboard away. The field keeps Flutter's focus for the next item, and the engine focuses
  // the input again on its next semantics update, outside the tap: no keyboard until the next
  // tap on the field, which must bring it back by itself (DECISIONS job 28, 6).
  await logFocus(page);
  await addSheet(page).getByRole('button', { name: /^Milch, Wie getippt(,|$)/ }).tap();
  await expect(addSheet(page).getByText(/^✓ Hinzugefügt: Milch\b/)).toBeVisible();
  await page.waitForTimeout(500);
  console.log(`focus log after tapping a suggestion:\n${format(await focusLog(page))}`);
  await screenshot(page, '28-iphone-after-pick');

  await tapFieldOnce(page, 'Eier');
});
