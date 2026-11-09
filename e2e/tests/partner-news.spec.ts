import { expect, type Locator, test } from './fixtures';
import {
  addField, addItem, createInviteCode, householdChip, itemRow, joinWithCode, newEmail, screenshot, signUp,
  signUpWithHousehold,
} from './helpers';

test('items the partner added carry no initial but are new until seen', async ({ browser }) => {
  const peterContext = await browser.newContext();
  let peter = await peterContext.newPage();
  const lea = await (await browser.newContext()).newPage();
  const leaEmail = newEmail('lea');
  const leaName = leaEmail.split('@')[0];

  await signUpWithHousehold(peter, newEmail('peter'));
  await addItem(peter, 'Milch');
  const code = await createInviteCode(peter);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Milch')).toBeVisible();

  const subtitle = peter.getByText(`1 neu von ${leaName}`);
  // Design H: no added-by initial on rows (job 15). The row's name is the item and, while unseen, "Neu".
  const plain = (name: string) => new RegExp(`^${name}$`);

  await addItem(lea, 'Hafer');
  await expect(itemRow(peter, 'Hafer'), 'a live add from the partner is highlighted').toHaveAccessibleName(/^Hafer\sNeu$/);
  await expect(subtitle).toBeVisible();
  await screenshot(peter, '08-partner-new-live');
  await expect(itemRow(peter, 'Hafer'), 'a live highlight clears once seen').not.toHaveAccessibleName(/Neu/);
  await expect(subtitle).toHaveCount(0);
  await expect(itemRow(peter, 'Hafer'), 'and carries no initial once seen').toHaveAccessibleName(plain('Hafer'));
  await expect(itemRow(lea, 'Milch'), 'Peter\'s item carries no initial for Lea either').toHaveAccessibleName(/^Milch(\sNeu)?$/);

  await peter.reload();
  await expect(itemRow(peter, 'Hafer'), 'still cleared after a reload').toHaveAccessibleName(plain('Hafer'));
  await expect(peter.getByText(/ neu( von|$)/)).toHaveCount(0);

  await peter.close();
  await addItem(lea, 'Kaffee');
  await expect(itemRow(lea, 'Kaffee'), 'Lea\'s own add is never new for her').not.toHaveAccessibleName(/Neu/);
  // Wait for the server to have the row before Peter opens the app again.
  await expect(lea.getByText('Wird einsortiert')).toHaveCount(0);
  peter = await peterContext.newPage();
  await peter.goto('/');
  await expect(itemRow(peter, 'Kaffee'), 'added while Peter was away: new on open').toHaveAccessibleName(/Neu/);
  await expect(peter.getByText(`1 neu von ${leaName}`)).toBeVisible();
  await expect(itemRow(peter, 'Hafer'), 'what he saw before stays seen').not.toHaveAccessibleName(/Neu/);
  await screenshot(peter, '09-partner-new-on-open');
  await expect(itemRow(peter, 'Kaffee')).not.toHaveAccessibleName(/Neu/);
  await expect(addField(peter), 'the highlight never takes focus from the add field').toBeFocused();

  await peter.reload();
  await expect(itemRow(peter, 'Kaffee'), 'cleared for good').toHaveAccessibleName(plain('Kaffee'));
});

// Job 173: on a phone the bar has no room for the line beside the household chip (since the chip came,
// #327), so it shows right below the chip, readable by screen readers, covering neither. On the web the
// text is found even where it is painted cut off: whether it shows whole is switcher_test.dart's job.
test('on a phone the partner\'s new adds show whole below the household chip', async ({ browser }) => {
  const peter = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const lea = await (await browser.newContext()).newPage();
  const leaEmail = newEmail('lea');
  const leaName = leaEmail.split('@')[0];

  await signUpWithHousehold(peter, newEmail('peter'));
  await addItem(peter, 'Milch');
  const code = await createInviteCode(peter);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, code);
  await expect(itemRow(lea, 'Milch')).toBeVisible();

  const news = peter.getByText(`1 neu von ${leaName}`, { exact: true });
  const chip = householdChip(peter, 'Unser Haushalt');
  const anpassen = peter.getByRole('button', { name: 'Anpassen', exact: true });
  const box = async (locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> => {
    const b = await locator.boundingBox();
    expect(b, 'laid out').not.toBeNull();
    return b ?? { x: 0, y: 0, width: 0, height: 0 };
  };

  for (const [width, item] of [[390, 'Hafer'], [360, 'Kaffee']] as const) {
    await peter.setViewportSize({ width, height: 844 });
    await addItem(lea, item);
    await expect(news, `the whole line shows at ${width} px`).toBeVisible();
    if (width === 390) {
      await screenshot(peter, '10-partner-new-phone');
    }
    await expect(news).toBeInViewport({ ratio: 0.99 });
    await expect(chip, 'beside the household chip').toBeVisible();
    const [n, c, a] = [await box(news), await box(chip), await box(anpassen)];
    expect(n.y, 'below the chip').toBeGreaterThanOrEqual(c.y + c.height - 1);
    expect(n.y + n.height <= a.y || n.x >= a.x + a.width || n.x + n.width <= a.x, 'clear of Anpassen').toBe(true);
    expect(n.x + n.width, 'inside the screen').toBeLessThanOrEqual(width);
    await expect(news, 'and clears once seen').toHaveCount(0);
  }
});
