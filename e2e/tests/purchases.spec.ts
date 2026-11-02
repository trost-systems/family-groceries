import { type Browser, expect, type Page, test } from './fixtures';
import {
  apiAs,
  functionsUrl,
  joinWithCode,
  newEmail,
  openPremium,
  password,
  screenshot,
  signUp,
  signUpWithHousehold,
  typeInto } from './helpers';
import { buy, claim, householdOf, rcEvent, report } from './iap';

// Job 25, as of job 43: Hummlist Lifetime on the web (docs/PURCHASES.md). The web never sells: More
// shows that the purchase is in the iPhone or Android app, and the household's unlock. RevenueCat's
// part is played by events posted to the real webhook with the local secret (iap.ts), so the
// purchase runs through the function, Postgres, RLS and Realtime (with the H-55 column grants).

const newPage = async (browser: Browser) => await (await browser.newContext()).newPage();

const lifetimeRow = (page: Page) => page.getByRole('button', { name: /^Hummlist Premium/ });
const webNote = (page: Page) => page.getByText(/^Hummlist Premium kaufst du in der iPhone- oder Android-App\./);
/** The status tile: its title says which Premium the household has (job 49). */
const unlocked = (page: Page) => page.getByText(/^Hummlist Premium (Lifetime|aktiv|über)/);

test('the web shows the unlock live for both partners, sells nothing, and a refund locks again', async ({ browser }) => {
  const peterEmail = newEmail('iap-peter');
  const leaEmail = newEmail('iap-lea');
  const peter = await newPage(browser);
  // H-67: nothing on the page (or before it) talks to RevenueCat.
  const revenueCat: string[] = [];
  peter.on('request', (r) => {
    if (/revenuecat/i.test(new URL(r.url()).hostname)) revenueCat.push(r.url());
  });
  await peter.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(peter, peterEmail);
  const household = await householdOf(peterEmail);
  const { data: invite, error } = await (await apiAs(peterEmail)).rpc('create_invite', { p_household: household });
  if (error) throw error;
  const lea = await newPage(browser);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, (Array.isArray(invite) ? invite[0] : invite).code);

  await openPremium(peter);
  await expect(peter).toHaveURL(/\/more\/lifetime$/);
  await expect(webNote(peter)).toBeVisible();
  await expect(peter.getByRole('button', { name: /Weiter zum Kauf|kaufen/ }), 'no buy button on the web').toHaveCount(0);
  await expect(peter.getByRole('button', { name: 'Kauf wiederherstellen' }), 'no restore on the web').toHaveCount(0);
  await expect(unlocked(peter)).toHaveCount(0);
  expect(revenueCat, 'no request to RevenueCat from app start or the Lifetime page').toEqual([]);
  await screenshot(peter, 'job25-web-de-390');
  await peter.setViewportSize({ width: 1366, height: 1024 });
  await expect(webNote(peter)).toBeVisible();
  await screenshot(peter, 'job25-web-de-1366');
  await peter.setViewportSize({ width: 390, height: 844 });
  await openPremium(lea);
  await expect(webNote(lea)).toBeVisible();

  // Peter buys on his iPhone; both web pages show it without a reload.
  const transactionId = `2000${Date.now()}`;
  const peterHousehold = await householdOf(peterEmail);
  expect(await buy(peterEmail, transactionId)).toBe('granted');
  await expect(unlocked(peter), 'the buyer sees it live').toBeVisible({ timeout: 10_000 });
  await expect(unlocked(lea), 'the partner sees it live, without buying').toBeVisible({ timeout: 10_000 });
  await screenshot(peter, 'job25-unlocked-web-de-390');
  await peter.setViewportSize({ width: 1366, height: 1024 });
  await screenshot(peter, 'job25-unlocked-web-de-1366');
  await peter.setViewportSize({ width: 390, height: 844 });

  // The same transaction again (a restore on Lea's phone) only restores; a retried event does nothing.
  expect(await report(leaEmail, transactionId), 'Lea restores the purchase on her phone').toBe('restored');
  const id = crypto.randomUUID();
  await rcEvent('NON_RENEWING_PURCHASE', peterHousehold, transactionId, { id });
  expect((await rcEvent('NON_RENEWING_PURCHASE', peterHousehold, transactionId, { id })).body).toEqual({ status: 'duplicate' });
  expect((await claim(leaEmail, transactionId)).body, 'Peter claimed it first').toEqual({ status: 'taken' });

  // Peter's transaction reported for Max's household (a transfer, a replay): refused.
  const maxEmail = newEmail('iap-max');
  const max = await newPage(browser);
  await signUpWithHousehold(max, maxEmail);
  expect(await report(maxEmail, transactionId)).toBe('used_elsewhere');
  expect((await rcEvent('TRANSFER', await householdOf(maxEmail), transactionId)).body).toEqual({ status: 'ignored' });
  await openPremium(max);
  await expect(webNote(max)).toBeVisible();
  await expect(unlocked(max), 'Max stays locked').toHaveCount(0);

  // Without RevenueCat's secret nothing is recorded.
  expect(await rcEvent('NON_RENEWING_PURCHASE', await householdOf(maxEmail), `${transactionId}9`, { authorization: 'Bearer forged' }))
    .toEqual({ status: 401, body: { error: 'invalid_token' } });
  await expect(unlocked(max)).toHaveCount(0);

  // Apple refunds it (RevenueCat's CANCELLATION): the unlock goes for both, live.
  expect((await rcEvent('CANCELLATION', peterHousehold, transactionId)).body).toEqual({ status: 'revoked' });
  expect((await rcEvent('CANCELLATION', peterHousehold, transactionId)).body, 'a repeated refund changes nothing')
    .toEqual({ status: 'unchanged' });
  await expect(unlocked(peter)).toHaveCount(0, { timeout: 10_000 });
  await expect(unlocked(lea)).toHaveCount(0, { timeout: 10_000 });
  await expect(webNote(lea)).toBeVisible();
  expect(await report(peterEmail, transactionId), 'a refunded purchase does not unlock again').toBe('revoked');
});

test('More lists Premium only once the household has it (premium_offer off), then live with Freigeschaltet', async ({ page }) => {
  const email = newEmail('iap-row');
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, email);
  await page.getByRole('tab', { name: 'Mehr' }).click();
  await expect(page.getByRole('button', { name: /^Kategorien verwalten/ })).toBeVisible();
  await expect(lifetimeRow(page), 'not listed before the launch (job 64)').toHaveCount(0);
  await screenshot(page, 'job25-more-de-390');
  expect(await buy(email, `2001${Date.now()}`)).toBe('granted');
  await expect(lifetimeRow(page), 'the row says so, live').toContainText('Freigeschaltet', { timeout: 10_000 });
  await screenshot(page, 'job25-more-unlocked-de-390');
  await page.setViewportSize({ width: 1366, height: 1024 });
  await expect(lifetimeRow(page)).toContainText('Freigeschaltet');
  await screenshot(page, 'job25-more-unlocked-de-1366');
});

test.describe('in English', () => {
  test.use({ locale: 'en-US' });

  test('the page says where to buy, and Unlocked', async ({ page }) => {
    const email = newEmail('iap-en');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await typeInto(page.getByRole('textbox', { name: 'Email' }), email);
    await typeInto(page.getByRole('textbox', { name: 'Password' }), password);
    await page.getByRole('button', { name: 'Sign up' }).click();
    await page.getByRole('button', { name: "Don't allow", exact: true }).click();
    await page.getByRole('button', { name: /^Create a household/ }).click();
    await page.getByRole('button', { name: 'Create a household', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome\/invite$/);
    await page.goto('/more/lifetime');
    const note = page.getByText(/^You can buy Hummlist Premium in the iPhone or Android app\./);
    await expect(note).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore purchase' })).toHaveCount(0);
    await screenshot(page, 'job25-web-en-390');
    await page.setViewportSize({ width: 1366, height: 1024 });
    await screenshot(page, 'job25-web-en-1366');
    expect(await buy(email, `2002${Date.now()}`)).toBe('granted');
    await expect(page.getByText(/^Hummlist Premium Lifetime/)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'job25-unlocked-web-en-1366');
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, 'job25-unlocked-web-en-390');
  });
});
