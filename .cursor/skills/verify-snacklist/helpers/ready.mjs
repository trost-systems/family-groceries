// launch.sh's ready check: the first seeded member signs in on the web build, the add field has
// focus, and a seeded active item shows on the list.
import { accessibleName, addField, apiAs, instance, member, openApp, signIn } from './lib.mjs';

const inst = instance();
const user = member(inst);
const { data, error } = await (await apiAs(inst, user)).from('items').select('name').eq('status', 'active');
if (error) throw error;
const { browser, page, L, errors } = await openApp(inst);
try {
  await signIn(page, L, user);
  await page.reload();
  const focused = () => addField(page, L).evaluate((el) => el === document.activeElement).catch(() => false);
  for (let i = 0; i < 40 && !(await focused()); i++) await page.waitForTimeout(250);
  if (!(await focused())) throw new Error('reopened, the app did not focus the add field');
  // A long list (solo-long-list) builds only the rows near the screen, and an unordered query can
  // name a row thousands of pixels down: check the list's first row instead.
  let shown = null;
  if (data.length) {
    const first = page.getByRole('checkbox').first();
    await first.waitFor({ timeout: 15_000 });
    const label = await first.getAttribute('aria-label') || accessibleName(await first.ariaSnapshot());
    shown = data.map((d) => d.name).sort((a, b) => b.length - a.length).find((n) => label === n || (label.startsWith(n) && /^[\s,]/.test(label.slice(n.length))));
    if (!shown) throw new Error(`the list's first row "${label}" is none of the household's ${data.length} active items`);
  }
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  console.log(`ready: ${user.email} signed in on ${inst.webUrl}${shown ? `, "${shown}" on the list` : ''}`);
} finally {
  await browser.close();
}
