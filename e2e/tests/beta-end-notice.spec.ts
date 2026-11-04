import { expect, test } from './fixtures';
import { adminClient, newEmail, screenshot, signUpWithHousehold } from './helpers';
import { householdOf } from './iap';

// Job 43b, N-55: the notice that the free beta unlock ends, on the list, from 28 days before the
// grant's end. A beta household's promotional grant ends before 2099; a tester's (2100) never
// shows it. The grant is written the way the reconcile stores RevenueCat's state.

async function grant(household: string, expiresAt: string) {
  const { error } = await adminClient().rpc('promotional_premium_sync', {
    p_household: household,
    p_active: true,
    p_expires_at: expiresAt,
  });
  if (error) throw error;
}

const notice = (page: import('@playwright/test').Page) =>
  page.getByText(/^Kostenlose Beta-Freischaltung endet am /);

test('a beta household sees the end notice 4 weeks ahead; closing it hides it', async ({ page }) => {
  const email = newEmail('n55-beta');
  await page.setViewportSize({ width: 390, height: 844 });
  await signUpWithHousehold(page, email);
  const end = new Date(Date.now() + 10 * 86_400_000);
  end.setUTCHours(12, 0, 0, 0);
  await grant(await householdOf(email), end.toISOString());
  const date = new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Berlin',
  })
    .format(end);
  await page.reload();
  await expect(notice(page)).toBeVisible({ timeout: 15_000 });
  // Title and text are one node for screen readers (and Playwright).
  await expect(
    page.getByText(
      `Kostenlose Beta-Freischaltung endet am ${date} ` +
        `Die kostenlose Beta-Freischaltung von Hummlist Premium endet am ${date}. Ab dem ${date} ` +
        'gehört die Verbindung mit KI-Assistenten zu Hummlist Premium. Die Einkaufsliste nutzt du ' +
        'weiter kostenlos. Es wird nichts automatisch berechnet. Für die kostenlose Freischaltung ' +
        'musst du also nichts tun und nichts kündigen.',
      { exact: true },
    ),
    'the web has no native Siri: sentence 2 names only the AI assistants (5b)',
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Mehr dazu in der Datenschutzerklärung' }))
    .toHaveAttribute('href', 'https://hummlist.com/datenschutz#premium-beta');
  await screenshot(page, 'job43b-beta-end-notice-de-390');
  await page.getByRole('button', { name: 'Schließen' }).first().click();
  await expect(notice(page)).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Was brauchst du?' })).toBeVisible();
  await expect(notice(page), 'closed for this end date').toHaveCount(0);
});

test('a tester household (grant to 2100) and a grant ending later see no notice', async ({ browser }) => {
  for (const [tag, expiresAt] of [
    ['n55-tester', '2100-01-01T00:00:00Z'],
    ['n55-later', new Date(Date.now() + 60 * 86_400_000).toISOString()],
  ]) {
    const page = await (await browser.newContext()).newPage();
    const email = newEmail(tag);
    await signUpWithHousehold(page, email);
    await grant(await householdOf(email), expiresAt);
    await page.reload();
    await expect(page.getByRole('textbox', { name: 'Was brauchst du?' })).toBeVisible();
    await expect(notice(page), tag).toHaveCount(0);
  }
});
