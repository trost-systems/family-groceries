import { type Browser, expect, type Page, test } from './fixtures';
import {
  apiAs,
  functionsUrl,
  joinWithCode,
  newEmail,
  openMore,
  password,
  screenshot,
  signUp,
  signUpWithHousehold,
  typeInto,
} from './helpers';

// Job 25: Hummlist Lifetime on the web (docs/PURCHASES.md). The web never sells: More shows that
// the purchase is in the iOS and Android app, and the household's unlock. The App Store's part
// is played by the local stack's /purchases/test/sign (scripts/iap-test-ca.sh's CA), so the
// purchase runs through the real /purchases/verify, Postgres, RLS and Realtime.

const newPage = async (browser: Browser) => await (await browser.newContext()).newPage();

const lifetimeRow = (page: Page) => page.getByRole('button', { name: /^Hummlist Lifetime/ });
const webNote = (page: Page) => page.getByText('Hummlist Lifetime gibt es in der iOS- und Android-App.');
/** The unlocked tile: title and text are one node ("Freigeschaltet Hummlist Lifetime ist …"). */
const unlocked = (page: Page) => page.getByText(/^Freigeschaltet/);

async function sign(body: Record<string, unknown>): Promise<Record<string, string>> {
  const res = await fetch(`${functionsUrl}/purchases/test/sign`, { method: 'POST', body: JSON.stringify(body) });
  expect(res.status, 'the local stack plays the App Store').toBe(200);
  return await res.json();
}

/** What the iPhone app sends after a StoreKit purchase, as [email]. */
async function verify(email: string, jws: string, source = 'purchase') {
  const api = await apiAs(email);
  const { data } = await api.auth.getSession();
  const res = await fetch(`${functionsUrl}/purchases/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${data.session!.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ store: 'apple', source, jws }),
  });
  return { status: res.status, body: await res.json() };
}

async function householdOf(email: string): Promise<string> {
  const api = await apiAs(email);
  const { data, error } = await api.from('household_members').select('household_id').single();
  if (error) throw error;
  return data.household_id as string;
}

test('the web shows the unlock live for both partners, sells nothing, and a refund locks again', async ({ browser }) => {
  const peterEmail = newEmail('iap-peter');
  const leaEmail = newEmail('iap-lea');
  const peter = await newPage(browser);
  await peter.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(peter, peterEmail);
  const household = await householdOf(peterEmail);
  const { data: invite, error } = await (await apiAs(peterEmail)).rpc('create_invite', { p_household: household });
  if (error) throw error;
  const lea = await newPage(browser);
  await signUp(lea, leaEmail);
  await joinWithCode(lea, (Array.isArray(invite) ? invite[0] : invite).code);

  await openMore(peter, 'Hummlist Lifetime');
  await expect(peter).toHaveURL(/\/more\/lifetime$/);
  await expect(webNote(peter)).toBeVisible();
  await expect(peter.getByRole('button', { name: /kaufen/ }), 'no buy button on the web').toHaveCount(0);
  await expect(peter.getByRole('button', { name: 'Käufe wiederherstellen' }), 'no restore on the web').toHaveCount(0);
  await expect(unlocked(peter)).toHaveCount(0);
  await screenshot(peter, 'job25-web-de-390');
  await peter.setViewportSize({ width: 1366, height: 1024 });
  await expect(webNote(peter)).toBeVisible();
  await screenshot(peter, 'job25-web-de-1366');
  await peter.setViewportSize({ width: 390, height: 844 });
  await openMore(lea, 'Hummlist Lifetime');
  await expect(webNote(lea)).toBeVisible();

  // Peter buys on his iPhone; both web pages show it without a reload.
  const transactionId = `2000${Date.now()}`;
  const { jws } = await sign({ transactionId });
  expect(await verify(peterEmail, jws)).toEqual({ status: 200, body: { status: 'granted', unlocked: true } });
  await expect(unlocked(peter), 'the buyer sees it live').toBeVisible({ timeout: 10_000 });
  await expect(unlocked(lea), 'the partner sees it live, without buying').toBeVisible({ timeout: 10_000 });
  await screenshot(peter, 'job25-unlocked-web-de-390');
  await peter.setViewportSize({ width: 1366, height: 1024 });
  await screenshot(peter, 'job25-unlocked-web-de-1366');
  await peter.setViewportSize({ width: 390, height: 844 });

  // The same transaction again (a retry, a double tap) only restores.
  expect((await verify(peterEmail, jws)).body).toEqual({ status: 'restored', unlocked: true });
  expect((await verify(leaEmail, jws, 'restore')).body, 'Lea restores the purchase on her phone').toEqual({
    status: 'restored',
    unlocked: true,
  });

  // Max replays Peter's transaction from his own household: refused.
  const maxEmail = newEmail('iap-max');
  const max = await newPage(browser);
  await signUpWithHousehold(max, maxEmail);
  expect((await verify(maxEmail, jws, 'restore')).body).toEqual({ status: 'used_elsewhere', unlocked: false });
  await openMore(max, 'Hummlist Lifetime');
  await expect(webNote(max)).toBeVisible();
  await expect(unlocked(max), 'Max stays locked').toHaveCount(0);

  // A forged JWS (another key, same claims) is refused.
  const [header, payload] = jws.split('.');
  const { jws: other } = await sign({ transactionId: `${transactionId}9` });
  const forged = `${header}.${payload}.${other.split('.')[2]}`;
  expect(await verify(maxEmail, forged)).toEqual({ status: 422, body: { error: 'refused', reason: 'bad_signature' } });

  // Apple refunds it: the unlock goes for both, live.
  const { signedPayload } = await sign({ transactionId, notificationType: 'REFUND' });
  const notify = () =>
    fetch(`${functionsUrl}/purchases/apple/notifications`, { method: 'POST', body: JSON.stringify({ signedPayload }) })
      .then((r) => r.json());
  expect(await notify()).toEqual({ status: 'revoked' });
  expect(await notify(), 'a repeated notification changes nothing').toEqual({ status: 'unchanged' });
  await expect(unlocked(peter)).toHaveCount(0, { timeout: 10_000 });
  await expect(unlocked(lea)).toHaveCount(0, { timeout: 10_000 });
  await expect(webNote(lea)).toBeVisible();
  expect((await verify(peterEmail, jws, 'restore')).body, 'a refunded purchase does not unlock again').toEqual({
    status: 'revoked',
    unlocked: false,
  });
});

test('More shows the row, and Freigeschaltet once the household has it', async ({ page }) => {
  const email = newEmail('iap-row');
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, email);
  await page.getByRole('tab', { name: 'Mehr' }).click();
  await expect(lifetimeRow(page)).toContainText('Hummlist unterstützen');
  await screenshot(page, 'job25-more-de-390');
  const { jws } = await sign({ transactionId: `2001${Date.now()}` });
  expect((await verify(email, jws)).status).toBe(200);
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
    await page.getByRole('button', { name: 'Decline' }).click();
    await page.getByRole('button', { name: /^Create a household/ }).click();
    await page.getByRole('button', { name: 'Create a household', exact: true }).click();
    await expect(page).toHaveURL(/\/welcome\/invite$/);
    await page.goto('/more/lifetime');
    const note = page.getByText('Hummlist Lifetime is available in the iOS and Android apps.');
    await expect(note).toBeVisible();
    await expect(page.getByRole('button', { name: 'Restore purchases' })).toHaveCount(0);
    await screenshot(page, 'job25-web-en-390');
    await page.setViewportSize({ width: 1366, height: 1024 });
    await screenshot(page, 'job25-web-en-1366');
    const { jws } = await sign({ transactionId: `2002${Date.now()}` });
    expect((await verify(email, jws)).status).toBe(200);
    await expect(page.getByText(/^Unlocked/)).toBeVisible({ timeout: 10_000 });
    await screenshot(page, 'job25-unlocked-web-en-1366');
    await page.setViewportSize({ width: 390, height: 844 });
    await screenshot(page, 'job25-unlocked-web-en-390');
  });
});
