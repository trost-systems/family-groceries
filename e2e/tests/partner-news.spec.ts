import { expect, test } from './fixtures';
import {
  addField, addItem, createInviteCode, itemRow, joinWithCode, newEmail, screenshot, signUp, signUpWithHousehold, typeInto,
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
