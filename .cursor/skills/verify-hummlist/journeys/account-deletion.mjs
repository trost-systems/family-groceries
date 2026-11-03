// Feature account-deletion, sub-feature acct-entry (job 80): the Konto page shows the email as
// plain text with a copy button. Proves the button's accessible name, the clipboard content and
// the „Kopiert“ snackbar. Export and deletion: e2e/tests/account-*.spec.ts.
//
//   node journeys/account-deletion.mjs <evidence dir> [--lang de|en]
import { capture, instance, logger, member, openApp, openTab, signIn } from '../helpers/lib.mjs';

const [dir, ...rest] = process.argv.slice(2);
const lang = rest.includes('--lang') ? rest[rest.indexOf('--lang') + 1] : 'de';
if (!dir) throw new Error('usage: account-deletion.mjs <evidence dir> [--lang de|en]');

const log = logger(dir);
const inst = instance();
const user = member(inst);
const { browser, context, page, L, errors } = await openApp(inst, { lang, videoDir: dir });
await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: inst.webUrl });
let failed = null;
try {
  await signIn(page, L, user);
  await openTab(page, L, 'tabMore');
  await page.getByRole('button', { name: new RegExp(`^${L('account')}`) }).first().click();
  const copy = page.getByRole('button', { name: L('copyEmail') });
  await copy.waitFor({ timeout: 15_000 });
  await capture(page, dir, '01-account');
  await copy.click();
  await page.getByText(L('copied'), { exact: true }).first().waitFor({ timeout: 5_000 });
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  log(`copied: ${clipboard === user.email ? 'the member\'s email' : JSON.stringify(clipboard)}`);
  if (clipboard !== user.email) throw new Error('the clipboard does not hold the email');
  await capture(page, dir, '02-copied');
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
} catch (error) {
  failed = error;
  await capture(page, dir, '99-failure').catch(() => {});
} finally {
  await context.close();
  await browser.close();
}
if (failed) {
  log(`FAIL: ${failed.message}`);
  process.exit(1);
}
log(`PASS account-deletion (evidence: ${dir})`);
