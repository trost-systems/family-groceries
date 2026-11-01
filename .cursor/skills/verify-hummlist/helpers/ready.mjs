// launch.sh's ready check: the first seeded member signs in on the web build, the add field has
// focus, and a seeded active item shows on the list.
import { addField, apiAs, instance, itemRow, member, openApp, signIn } from './lib.mjs';

const inst = instance();
const user = member(inst);
const { data, error } = await (await apiAs(inst, user)).from('items').select('name').eq('status', 'active').limit(1);
if (error) throw error;
const { browser, page, L, errors } = await openApp(inst);
try {
  await signIn(page, L, user);
  await page.reload();
  const focused = () => addField(page, L).evaluate((el) => el === document.activeElement).catch(() => false);
  for (let i = 0; i < 40 && !(await focused()); i++) await page.waitForTimeout(250);
  if (!(await focused())) throw new Error('reopened, the app did not focus the add field');
  if (data.length) await itemRow(page, data[0].name).first().waitFor({ timeout: 15_000 });
  if (errors.length) throw new Error(`page errors: ${errors.join('; ')}`);
  console.log(`ready: ${user.email} signed in on ${inst.webUrl}${data.length ? `, "${data[0].name}" on the list` : ''}`);
} finally {
  await browser.close();
}
