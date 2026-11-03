// Feature tips (job 80), entry point the List tab after sign-in. Proves the first tip shows once
// the gesture card is gone, the X hides it and stores its id on this device, and the next start
// shows the next tip in the queue.
//
//   node journeys/tips.mjs <evidence dir> [--lang de|en] [--dark]
import { capture, instance, logger, member, openApp, signIn } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'de';
const dark = rest.includes('--dark');
if (!dir) throw new Error('usage: tips.mjs <evidence dir> [--lang de|en] [--dark]');

const log = logger(dir);
const inst = instance();
const user = member(inst);
const { browser, page, L, errors } = await openApp(inst, { lang, dark, videoDir: dir });
let failed = null;
try {
  await signIn(page, L, user);
  const stored = () => page.evaluate(() => Object.entries(localStorage).filter(([k]) => k.includes('tips.')));
  // Title and text are one merged semantics node („<title> <text>“), which getByText does not
  // reach on the web build; the ARIA snapshot does.
  const aria = () => page.locator('body').ariaSnapshot();
  const tip = (key) => ({
    waitFor: async ({ state = 'visible', timeout = 15_000 } = {}) => {
      for (const end = Date.now() + timeout; Date.now() < end; await page.waitForTimeout(250)) {
        if ((await aria()).includes(`${L(key)} `) === (state === 'visible')) return;
      }
      throw new Error(`tip „${L(key)}“ not ${state} after ${timeout} ms`);
    },
    count: async () => ((await aria()).includes(`${L(key)} `) ? 1 : 0),
  });
  const first = tip('tipEditTitle');
  await first.waitFor({ timeout: 15_000 });
  log(`first tip: „${L('tipEditTitle')}“ (${lang}${dark ? ', dark' : ''})`);
  await capture(page, dir, '01-tip');

  await page.getByRole('button', { name: L('tipDismiss') }).click();
  await first.waitFor({ state: 'detached', timeout: 10_000 });
  log(`dismissed; stored on this device: ${JSON.stringify(await stored())}`);
  if ((await tip('tipAmountsTitle').count()) > 0) throw new Error('the next tip showed in the same session');
  await capture(page, dir, '02-dismissed');

  await page.reload();
  await tip('tipAmountsTitle').waitFor({ timeout: 30_000 });
  if ((await first.count()) > 0) throw new Error('the dismissed tip came back');
  log(`after a reload the next tip shows: „${L('tipAmountsTitle')}“`);
  await capture(page, dir, '03-next-start');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  await page.context().close();
  await browser.close();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS tips (evidence: ${dir})`);
