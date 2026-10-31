import { type Browser, expect, type Page, test } from './fixtures';
import { apiAs, newEmail, openMore, openTab, password, screenshot, signUpWithHousehold, typeInto } from './helpers';
import { archiveSwitchOn, buy, householdOf, report } from './iap';

// Job 43: Hummlist Lifetime is household-bound (docs/PURCHASES.md, model A). Purchases are signed
// by the local stack's App Store stand-in and verified by the real function, as in
// purchases.spec.ts; the web shows what every member sees.

// The archive cases need the server's switch on as well as the e2e build's HOUSEHOLD_ARCHIVE.
test.beforeAll(archiveSwitchOn);

const newPage = async (browser: Browser) => {
  const page = await (await browser.newContext()).newPage();
  await page.setViewportSize({ width: 390, height: 844 });
  return page;
};

const unlocked = (page: Page) => page.getByText(/^Freigeschaltet/);
const buyButton = (page: Page) => page.getByRole('button', { name: /Weiter zum Kauf|kaufen/ });
const BOUGHT_TWICE = /^Euer Haushalt hat Hummlist Lifetime mehr als einmal gekauft\./;

async function inviteCode(email: string): Promise<string> {
  const { data, error } = await (await apiAs(email)).rpc('create_invite', {
    p_household: await householdOf(email),
  });
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data).code;
}

test('joining an unlocked household: nothing to buy, the warning, the refund help; the purchase stays behind', async ({ browser }) => {
  const annaEmail = newEmail('iap43-anna');
  const benEmail = newEmail('iap43-ben');
  const anna = await newPage(browser);
  const ben = await newPage(browser);
  await signUpWithHousehold(anna, annaEmail);
  await signUpWithHousehold(ben, benEmail);

  // Both bought, each in their own household (Ben recently, so the refund help applies).
  const annaTx = `4300${Date.now()}`;
  const benTx = `4301${Date.now()}`;
  expect(await buy(annaEmail, annaTx)).toBe('granted');
  expect(await buy(benEmail, benTx)).toBe('granted');

  // Ben opens Anna's invite link as the last member of his unlocked household.
  await ben.goto(`/join/${await inviteCode(annaEmail)}`);
  await expect(ben.getByText('Dieser Haushalt hat Hummlist Lifetime. Du musst nichts kaufen.')).toBeVisible();
  // The e2e build offers archiving (HOUSEHOLD_ARCHIVE, off in releases).
  await expect(ben.getByText(/Archiviere den Haushalt, statt ihn zu löschen/)).toBeVisible();
  const refundLink = ben.getByRole('button', { name: /vor Kurzem gekauft\? So forderst du den Kauf zurück/ });
  await expect(refundLink).toBeVisible();
  await screenshot(ben, 'job43-join-unlocked-de-390');
  await refundLink.click();
  await expect(ben.getByText('Kauf zurückfordern', { exact: true })).toBeVisible();
  await expect(ben.getByText(/^Hummlist Lifetime gehört immer zu dem Haushalt, in dem es gekauft wurde\. Käufe im App Store erstattet nur Apple\./)).toBeVisible();
  await expect(ben.getByRole('link', { name: 'Mehr in den häufigen Fragen' })).toHaveAttribute('href', 'https://hummlist.com/support');
  await expect(ben.getByRole('link', { name: 'Bei Apple anfragen' })).toHaveAttribute('href', 'https://reportaproblem.apple.com/');
  await expect(ben.getByRole('link', { name: 'Bei Google anfragen' })).toHaveAttribute(
    'href',
    'https://support.google.com/googleplay/answer/15574897?hl=de',
  );
  await screenshot(ben, 'job43-refund-help-de-390');
  await ben.keyboard.press('Escape');
  await expect(ben.getByText('Kauf zurückfordern', { exact: true })).toHaveCount(0);

  // Ben declines the archive: one more warning (deleted with its Lifetime), then it never blocks.
  await ben.getByRole('button', { name: 'Löschen und beitreten', exact: true }).click();
  await expect(ben.getByText(/Hummlist Lifetime endet mit ihm, denn ein Kauf gehört zu seinem Haushalt/)).toBeVisible();
  await screenshot(ben, 'job43-join-delete-confirm-de-390');
  await ben.getByRole('button', { name: 'Löschen und beitreten', exact: true }).last().click();
  await expect(ben).toHaveURL(/\/$/);

  // Ben's purchase stayed with his deleted household: it unlocks nothing anywhere else, ever.
  expect(await report(benEmail, benTx), 'restore after the household is gone').toBe('used_elsewhere');

  // In Anna's household, a member who did not buy sees it unlocked, with no Buy.
  await openMore(ben, 'Hummlist Lifetime');
  await expect(unlocked(ben)).toBeVisible();
  await expect(buyButton(ben)).toHaveCount(0);
});

test('a joiner into a locked household is told nothing; a household bought twice says so', async ({ browser }) => {
  const caraEmail = newEmail('iap43-cara');
  const dirkEmail = newEmail('iap43-dirk');
  const cara = await newPage(browser);
  const dirk = await newPage(browser);
  await signUpWithHousehold(cara, caraEmail);
  await signUpWithHousehold(dirk, dirkEmail);

  await dirk.goto(`/join/${await inviteCode(caraEmail)}`);
  await expect(dirk.getByRole('button', { name: 'Haushalt beitreten', exact: true })).toBeVisible();
  await expect(dirk.getByText(/Du musst nichts kaufen/)).toHaveCount(0);
  await expect(dirk.getByText(/Hummlist Lifetime endet/)).toHaveCount(0);
  await dirk.getByRole('button', { name: 'Haushalt beitreten', exact: true }).click();
  await expect(dirk).toHaveURL(/\/$/);

  await openMore(cara, 'Hummlist Lifetime');
  expect(await buy(caraEmail, `4302${Date.now()}`)).toBe('granted');
  await expect(unlocked(cara)).toBeVisible({ timeout: 10_000 });
  // Dirk bought too on his phone before he saw it (two phones, Ask to Buy): flagged for the refund help.
  expect(await buy(dirkEmail, `4303${Date.now()}`)).toBe('granted');
  await expect(cara.getByText(BOUGHT_TWICE)).toBeVisible({ timeout: 10_000 });
  await screenshot(cara, 'job43-bought-twice-de-390');
});

test('the last member archives an unlocked household, its purchase stays its own, and brings it back', async ({ browser }) => {
  const frankEmail = newEmail('iap43-frank');
  const caraEmail = newEmail('iap43-cara2');
  const frank = await newPage(browser);
  await signUpWithHousehold(frank, frankEmail);
  await signUpWithHousehold(await newPage(browser), caraEmail);
  const frankHousehold = await householdOf(frankEmail);
  const frankTx = `4304${Date.now()}`;
  expect(await buy(frankEmail, frankTx)).toBe('granted');

  await frank.goto(`/join/${await inviteCode(caraEmail)}`);
  await expect(frank.getByText(/Archiviere den Haushalt, statt ihn zu löschen/)).toBeVisible();
  await screenshot(frank, 'job43-join-archive-offer-de-390');
  await frank.getByRole('button', { name: 'Archivieren und beitreten', exact: true }).click();
  await expect(frank).toHaveURL(/\/$/);

  // In Cara's household the purchase restores nothing: it belongs to the archived one.
  expect(await report(frankEmail, frankTx)).toBe('used_elsewhere');
  await openMore(frank, 'Hummlist Lifetime');
  await expect(unlocked(frank), 'Cara\'s household has no Lifetime').toHaveCount(0);

  await openTab(frank, 'Mehr');
  await frank.getByRole('button', { name: /^Archivierte Haushalte/ }).click();
  // Job 47 (H-50): each archived household says when it is deleted, 24 months after archiving.
  const deletes = new Date();
  deletes.setMonth(deletes.getMonth() + 24);
  const date = deletes.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
  await expect(frank.getByRole('group', { name: new RegExp(`Mit Hummlist Lifetime\\s+Wird am ${date} gelöscht$`) }))
    .toBeVisible();
  await screenshot(frank, 'job43-archived-de-390');
  await screenshot(frank, 'job47-archived-deletes-de-390');
  await frank.getByRole('button', { name: 'Wieder aktivieren', exact: true }).click();
  await frank.getByRole('button', { name: 'Wieder aktivieren', exact: true }).last().click();
  await expect.poll(() => householdOf(frankEmail)).toBe(frankHousehold);
  await openMore(frank, 'Hummlist Lifetime');
  await expect(unlocked(frank), 'back in his household, the unlock is back').toBeVisible({ timeout: 10_000 });
  expect(await report(frankEmail, frankTx)).toBe('restored');
});

test('the web says to buy in the app, also in English', async ({ browser }) => {
  const email = newEmail('iap43-web');
  const page = await newPage(browser);
  await signUpWithHousehold(page, email);
  await openMore(page, 'Hummlist Lifetime');
  await expect(
    page.getByText(
      'Kaufen kannst du Hummlist Lifetime in der iPhone- oder Android-App. Danach ist es auch hier für deinen ganzen Haushalt freigeschaltet.',
    ),
  ).toBeVisible();
  await expect(buyButton(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Doppelt gekauft\?/ })).toBeVisible();
  await screenshot(page, 'job43-web-de-390');
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });

  test('the web copy and the refund help', async ({ page }) => {
    const email = newEmail('iap43-en');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await typeInto(page.getByRole('textbox', { name: 'Email' }), email);
    await typeInto(page.getByRole('textbox', { name: 'Password' }), password);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByRole('button', { name: 'Decline' }).click();
    await page.getByRole('button', { name: /^Create a household/ }).click();
    await page.getByRole('button', { name: 'Create a household', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome\/invite$/);
    await page.goto('/more/lifetime');
    await expect(
      page.getByText("You can buy Hummlist Lifetime in the iPhone or Android app. It's then unlocked here too, for your whole household."),
    ).toBeVisible();
    await screenshot(page, 'job43-web-en-390');
    await page.getByRole('button', { name: /^Bought it twice\?/ }).click();
    await expect(page.getByText('Request a refund', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ask Google' })).toHaveAttribute(
      'href',
      'https://support.google.com/googleplay/answer/15574897?hl=en',
    );
    await screenshot(page, 'job43-refund-help-en-390');
  });
});
