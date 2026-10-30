import { expect, type Locator, type Page, test } from './fixtures';
import {
  addField,
  addItem,
  answerConsent,
  type Collector,
  createInviteCode,
  eventNames,
  fakeCollector,
  itemRow,
  newEmail,
  openMore,
  openTab,
  password,
  putBack,
  screenshot,
  signUp,
  signUpWithHousehold,
  tick,
  typeInto, createHousehold, skipInvite, confirmJoin,
} from './helpers';

// Job 19: analytics to PostHog EU, asked for right after the first sign-in (Peter, 2026-10-27).
// The e2e build points at https://posthog.invalid (app/config/e2e.json), which fakeCollector
// answers: nothing ever leaves the machine. The app flushes every 5 s.

/** Long enough for the app's 5 s flush to have happened, had it anything to send. */
const flushWindow = 7_000;

async function quietFor(page: Page, collector: Collector, before: number) {
  // The app sends on a timer; the only way to see that it sent nothing is to wait it out.
  await page.waitForTimeout(flushWindow);
  expect(collector.requests.length, `requests: ${collector.requests.join(', ')}`).toBe(before);
}

/** Wheels More's list until [target] is on screen above the tab bar; the switch sits below the fold. */
async function wheelIntoView(page: Page, target: Locator): Promise<void> {
  const size = page.viewportSize() ?? { width: 480, height: 900 };
  const tabs = await page.getByRole('tab').first().boundingBox({ timeout: 2000 }).catch(() => null);
  const bottom = tabs ? tabs.y : size.height;
  await page.mouse.move(size.width / 2, size.height / 3);
  await expect(async () => {
    const box = await target.boundingBox();
    if (!box || box.y + box.height > bottom) {
      await page.mouse.wheel(0, 300);
      throw new Error(`${target} is not above the tab bar yet`);
    }
  }).toPass();
}

/** The usage-data switch under More (a switch, or a checkbox for some engines). */
async function analyticsSwitch(page: Page) {
  await openTab(page, 'Mehr');
  await expect(page).toHaveURL(/\/(more|settings)\b/);
  // The tab comes back to the page it was left on; a second tap goes to More's list.
  if (!new URL(page.url()).pathname.endsWith('/more')) await openTab(page, 'Mehr');
  await expect(page).toHaveURL(/\/more$/);
  const toggle = page.getByRole('switch', { name: /^Nutzungsdaten und Fehlerberichte senden/ })
    .or(page.getByRole('checkbox', { name: /^Nutzungsdaten und Fehlerberichte senden/ }));
  await wheelIntoView(page, toggle);
  return toggle;
}

/**
 * The install id in localStorage (shared_preferences on the web), or null. Job 33b (legal review
 * H-08): it exists only after a yes, and turning analytics off deletes it.
 */
async function storedInstallId(page: Page): Promise<string | null> {
  // The key is `analytics.install_id` (shared_preferences' async web store has no `flutter.` prefix).
  // A yes must find it, so the "absent" checks cannot pass on a wrong key.
  const raw = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((k) => /(^|\.)analytics\.install_id$/.test(k));
    return key === undefined ? null : localStorage.getItem(key);
  });
  if (raw === null) return null;
  const value: unknown = JSON.parse(raw);
  return (typeof value === 'string' && value.startsWith('"') ? JSON.parse(value) : value) as string;
}

async function received(collector: Collector, names: string[]) {
  await expect
    .poll(() => eventNames(collector).filter((n) => names.includes(n)), { timeout: 15_000 })
    .toEqual(names);
}

/** The collector's log as a page, for the PR's screenshot. */
async function showLog(page: Page, title: string, collector: Collector) {
  const rows = collector.events.map((e) => {
    const p = e.properties;
    const extra = ['source', 'method', 'scope', 'actor_role', 'household_size']
      .filter((k) => k in p).map((k) => `${k}=${p[k]}`).join(' ');
    return `${e.event.padEnd(18)} household_id=${String(p.household_id).slice(0, 8)}… ` +
      `is_internal=${p.is_internal} $geoip_disable=${p.$geoip_disable} ${extra}`;
  });
  const html = `<pre style="font: 14px/1.5 monospace; padding: 16px">${title}\n` +
    `requests to the PostHog stand-in: ${collector.requests.length}\n` +
    `requests to a real PostHog host: ${collector.leaks.length}\n\n${rows.join('\n')}</pre>`;
  await page.setViewportSize({ width: 1100, height: 520 });
  await page.setContent(html.replace(/&/g, '&amp;'));
}

test('sign-in, then consent, then onboarding; declining sends nothing, ever', async ({ browser }) => {
  const context = await browser.newContext();
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  await page.goto('/');
  await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible();
  expect(await storedInstallId(page), 'no install id at the login').toBeNull();
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), newEmail('consent-no'));
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Registrieren' }).click();

  await expect(page).toHaveURL(/\/analytics-consent$/);
  // Job 33b (legal review H-03): who asks, what for, pseudonymous, and a link to the policy.
  await expect(page.getByRole('heading', { name: 'Darf Hummlist Nutzungsdaten erfassen?' })
    .or(page.getByText('Darf Hummlist Nutzungsdaten erfassen?'))).toBeVisible();
  await expect.poll(() => page.locator('body').ariaSnapshot(), { message: 'the consent text as the review wrote it' })
    .toMatch(/Peter Trost, der Anbieter von Hummlist[\s\S]*Die Daten sind pseudonym, nicht anonym\./);
  const policy = page.getByRole('link', { name: 'Datenschutzerklärung', exact: true });
  await expect(policy).toHaveAttribute('href', 'https://hummlist.com/datenschutz');
  await expect.poll(() => page.locator('body').ariaSnapshot(), { message: 'approved wording: no draft mark' })
    .not.toMatch(/ENTWURF/);
  await screenshot(page, 'analytics-01-consent-after-sign-in');
  await context.route('https://hummlist.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>hummlist.com</title>' }));
  const popup = page.waitForEvent('popup');
  await policy.scrollIntoViewIfNeeded();
  await policy.click();
  expect((await popup).url(), 'the policy opens in a new tab').toBe('https://hummlist.com/datenschutz');
  await (await popup).close();
  await expect(page, 'still asking').toHaveURL(/\/analytics-consent$/);
  expect(collector.requests, 'the login screen sent nothing').toEqual([]);
  expect(await storedInstallId(page), 'no install id before the answer').toBeNull();

  await answerConsent(page, 'decline');
  await expect(page).toHaveURL(/\/welcome$/);
  expect(await storedInstallId(page), 'no install id after a no').toBeNull();
  await screenshot(page, 'analytics-02-declined-then-welcome');
  await createHousehold(page);
  await skipInvite(page);
  await addItem(page, 'Hafermilch');
  await tick(page, 'Hafermilch');
  await quietFor(page, collector, 0);

  // The switch under More shows the decision.
  await expect(await analyticsSwitch(page)).not.toBeChecked();
  expect(collector.leaks).toEqual([]);
  const log = await context.newPage();
  const after = await storedInstallId(page);
  await showLog(log, 'Declined at the consent screen, then: household, add, tick.\n' +
    `localStorage analytics.install_id at the login, on the consent screen, after the no, now: null, null, null, ${after}`, collector);
  await screenshot(log, 'analytics-03-collector-declined');
});

test('accepting sends first_open once, then one event per action, no list text; off stops at once', async ({ browser }) => {
  const context = await browser.newContext();
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  const email = newEmail('consent-yes');
  await signUp(page, email, '/', { consent: 'accept' });
  await expect(page).toHaveURL(/\/welcome$/);
  // The router moves on at the answer; the id is written right after.
  await expect.poll(() => storedInstallId(page), { message: 'a yes stores an install id' }).toMatch(/^[0-9a-f-]{36}$/);
  const installId = await storedInstallId(page);
  await createHousehold(page, { name: 'Familie Geheim' });
  await skipInvite(page);
  await received(collector, ['first_open', 'household_created']);

  await addItem(page, 'Hafermilch');
  await addItem(page, 'Brot');
  await tick(page, 'Hafermilch');
  await received(collector, ['first_open', 'household_created', 'item_added', 'item_added', 'item_ticked']);

  // Putting it back right away under "Zuletzt verwendet" is the undo and sends nothing; ticking
  // again is a new action.
  await tick(page, 'Brot');
  await putBack(page, 'Brot');
  await tick(page, 'Brot');
  await received(collector, [
    'first_open', 'household_created', 'item_added', 'item_added', 'item_ticked', 'item_ticked', 'item_ticked',
  ]);

  const byName = (name: string) => collector.events.filter((e) => e.event === name);
  const [ticked] = byName('item_ticked');
  const household = ticked.properties.household_id as string;
  expect(household).toMatch(/^[0-9a-f-]{36}$/);
  expect(byName('first_open')).toHaveLength(1);
  expect(byName('first_open')[0].properties.household_id).toBeNull();
  expect(byName('household_created')[0].properties.household_id).toBe(household);
  expect(byName('item_added').map((e) => e.properties.source)).toEqual(['typed', 'typed']);
  expect(ticked.properties.actor_role).toBe('owner');
  expect(ticked.properties.household_size).toBe(1);
  for (const e of collector.events) {
    expect(e.properties.install_id, 'every event carries the stored install id').toBe(installId);
    expect(e.uuid).toBe(e.properties.event_id);
    expect(e.properties.distinct_id).toBe(e.properties.install_id);
    expect(e.properties.$geoip_disable).toBe(true);
    expect(e.properties.platform).toBe('web');
    // A test account: e2e mail domains are reserved test domains.
    expect(e.properties.is_internal).toBe(true);
    expect('$ip' in e.properties).toBe(false);
  }
  const sent = JSON.stringify(collector.events);
  for (const secret of ['Hafermilch', 'Brot', 'Familie Geheim', email, email.split('@')[0]]) {
    expect(sent, `no "${secret}" in what was sent`).not.toContain(secret);
  }

  // A reload is the same install: no second first_open.
  await page.reload();
  await expect(addField(page)).toBeVisible();
  await addItem(page, 'Käse');
  await received(collector, [
    'first_open', 'household_created', 'item_added', 'item_added', 'item_ticked', 'item_ticked', 'item_ticked', 'item_added',
  ]);

  // Off under More: nothing more, at once.
  const toggle = await analyticsSwitch(page);
  await expect(toggle).toBeChecked();
  await screenshot(page, 'analytics-04-more-switch-on');
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect.poll(() => storedInstallId(page), { message: 'off deletes the install id' }).toBeNull();
  await screenshot(page, 'analytics-05-more-switch-off');
  const before = collector.requests.length;
  await openTab(page, 'Liste');
  await tick(page, 'Käse');
  await quietFor(page, collector, before);
  expect(collector.leaks).toEqual([]);
  const log = await context.newPage();
  await showLog(log, 'Accepted; household, 3 adds, 3 ticks (one undone), reload; then switched off and ticked.\n' +
    `localStorage analytics.install_id after the yes: ${installId}; after switching off: ${await storedInstallId(page)}`, collector);
  await screenshot(log, 'analytics-06-collector-accepted');
});

test('in English: the consent text links the English policy; the switch under More', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'en-US' });
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  await page.goto('/');
  await typeInto(page.getByRole('textbox', { name: 'Email' }), newEmail('consent-en'));
  await typeInto(page.getByRole('textbox', { name: 'Password' }), password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL(/\/analytics-consent$/);
  await expect.poll(() => page.locator('body').ariaSnapshot(), { message: 'the English consent text as the review wrote it' })
    .toMatch(/May Hummlist collect usage data\?[\s\S]*Peter Trost, who runs Hummlist[\s\S]*The data is pseudonymous, not anonymous\./);
  await screenshot(page, 'analytics-07-consent-en');
  await context.route('https://hummlist.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>hummlist.com</title>' }));
  const english = page.getByRole('link', { name: 'privacy policy', exact: true });
  await expect(english).toHaveAttribute('href', 'https://hummlist.com/en/privacy');
  const popup = page.waitForEvent('popup');
  await english.click();
  expect((await popup).url(), 'the English policy, in a new tab').toBe('https://hummlist.com/en/privacy');
  await (await popup).close();

  const allow = page.getByRole('button', { name: 'Allow' });
  const size = page.viewportSize() ?? { width: 400, height: 800 };
  await page.mouse.move(size.width / 2, size.height / 2);
  await expect(async () => {
    if (!(await allow.isVisible())) await page.mouse.wheel(0, 400);
    await expect(allow).toBeVisible({ timeout: 500 });
  }).toPass();
  await allow.click();
  await page.getByRole('button', { name: /^Create a household/ }).click();
  await expect(page).toHaveURL(/\/welcome\/create$/);
  await page.getByRole('button', { name: 'Create a household', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome\/invite$/);
  await page.getByRole('button', { name: /^(Later|Go to the list)$/ }).click();
  await expect(page.getByRole('textbox', { name: 'What do you need?' })).toBeVisible();
  await expect.poll(() => storedInstallId(page), { message: 'a yes stores an install id' }).toMatch(/^[0-9a-f-]{36}$/);

  await page.getByRole('tab', { name: 'More', exact: true }).or(page.getByRole('button', { name: /^More Tab / })).click();
  await expect(page).toHaveURL(/\/more$/);
  const toggle = page.getByRole('switch', { name: /^Send usage data and error reports/ })
    .or(page.getByRole('checkbox', { name: /^Send usage data and error reports/ }));
  await wheelIntoView(page, toggle);
  await expect(toggle).toBeChecked();
  await expect(toggle).toHaveAccessibleName(/Turning it off deletes the ID on this device/);
  await expect(toggle, 'approved wording: no draft mark').not.toHaveAccessibleName(/DRAFT/);
  await screenshot(page, 'analytics-08-more-switch-en');
  await toggle.click();
  await expect.poll(() => storedInstallId(page), { message: 'off deletes the install id' }).toBeNull();
  expect(collector.leaks).toEqual([]);
});

test('an invite link survives sign-in and consent, ends on joining, and counts as invite_accepted by link', async ({ browser }) => {
  const owner = await (await browser.newContext()).newPage();
  await signUpWithHousehold(owner, newEmail('consent-owner'));
  const code = await createInviteCode(owner);

  const context = await browser.newContext();
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  await page.goto(`/join/${code}`);
  await expect(page).toHaveURL(new RegExp(`/login\\?invite=${code}$`));
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), newEmail('consent-member'));
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Registrieren' }).click();
  await expect(page).toHaveURL(new RegExp(`/analytics-consent\\?invite=${code}$`));
  await answerConsent(page, 'accept');
  // Job 22: the invite skips Step 1 and opens the join screen with the household's name.
  await expect(page).toHaveURL(new RegExp(`/join/${code}$`));
  await confirmJoin(page, 'Unser Haushalt');
  await expect(addField(page)).toBeFocused();
  await received(collector, ['first_open', 'invite_accepted']);
  const joined = collector.events.find((e) => e.event === 'invite_accepted')!;
  expect(joined.properties.method).toBe('link');
  expect(joined.properties.household_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(JSON.stringify(collector.events)).not.toContain(code);
});

test('a member with a household is asked once on a new install, then goes to the list', async ({ browser }) => {
  const email = newEmail('consent-existing');
  const first = await (await browser.newContext()).newPage();
  await signUpWithHousehold(first, email);
  await addItem(first, 'Kaffee');

  const context = await browser.newContext();
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  await page.goto('/');
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(page).toHaveURL(/\/analytics-consent$/);
  await screenshot(page, 'analytics-07-consent-before-list');
  await answerConsent(page, 'decline');
  await expect(addField(page)).toBeFocused();
  await expect(itemRow(page, 'Kaffee')).toBeVisible();
  await screenshot(page, 'analytics-08-declined-then-list');

  // Signing out and in again on this install does not ask again.
  await openMore(page, 'Abmelden');
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await expect(addField(page)).toBeFocused();
  expect(collector.requests).toEqual([]);
});

test('an internal device sends a test error, scrubbed, to error tracking', async ({ browser }) => {
  const context = await browser.newContext();
  const collector = await fakeCollector(context);
  const page = await context.newPage();
  await signUp(page, newEmail('errors'), '/', { consent: 'accept' });
  await createHousehold(page);
  await skipInvite(page);
  await openTab(page, 'Mehr');
  await expect(page).toHaveURL(/\/more$/);
  // More is a lazy list: wheel down to the version line at its end.
  await page.mouse.move(240, 400);
  const version = page.getByText(/^Version /);
  await expect(async () => {
    await page.mouse.wheel(0, 800);
    await expect(version).toBeVisible({ timeout: 500 });
  }).toPass();
  // Let the scroll settle before measuring where to press.
  await page.waitForTimeout(500);
  const box = (await version.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1_000);
  await page.mouse.up();
  // "Interne Installation" and "Testfehler senden" show below the version: wheel down to them.
  const testError = page.getByRole('button', { name: 'Testfehler senden' });
  await expect(async () => {
    await page.mouse.wheel(0, 400);
    await expect(testError).toBeVisible({ timeout: 500 });
  }).toPass();
  await page.waitForTimeout(500);
  await testError.click();

  await expect.poll(() => eventNames(collector).includes('$exception'), { timeout: 15_000 }).toBe(true);
  const error = collector.events.find((e) => e.event === '$exception')!;
  const [exception] = error.properties.$exception_list as {
    type: string; value: string; mechanism: { handled: boolean }; stacktrace?: { frames: unknown[] };
  }[];
  expect(exception.type).toBe('StateError');
  expect(exception.value).toBe('Bad state: Hummlist test error (More, internal install)');
  expect(exception.mechanism.handled).toBe(false);
  expect(exception.stacktrace?.frames.length ?? 0).toBeGreaterThan(0);
  expect(error.properties.is_internal).toBe(true);
  expect(error.properties.household_id).toMatch(/^[0-9a-f-]{36}$/);
  expect(error.uuid).toBe(error.properties.event_id);
  expect(collector.leaks).toEqual([]);
});
