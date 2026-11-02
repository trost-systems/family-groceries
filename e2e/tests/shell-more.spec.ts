import { readFileSync } from 'node:fs';
import { expect, type Locator, test, type Page } from './fixtures';
import {
  addField, addItem, itemRow, newEmail, password, screenshot, signUpWithHousehold, typeInto, inviteCodeLabel, wheelTo,
} from './helpers';

const moreTab = (page: Page) => page.getByRole('tab', { name: 'Mehr' });

async function openMore(page: Page): Promise<void> {
  await moreTab(page).click();
  await expect(page.getByRole('heading', { name: 'Mehr' })).toBeVisible();
}

test('More opens every entry; licenses name Hummlist; sign-out ends at the login', async ({ page }) => {
  const email = newEmail('more');
  await signUpWithHousehold(page, email, { stores: ['Supermarkt', 'Drogerie'] });
  await openMore(page);
  await screenshot(page, 'more-01-phone');
  // More is a lazy list taller than the window (job 21 added Feedback): wheel to what is below.
  await wheelTo(page, page.getByText(/^Version \d+\.\d+\.\d+/));
  await wheelTo(page, page.getByRole('button', { name: /^Partner einladen/ }));

  // Job 22: Einladungen, a page below More: a new invite, its code, revoke.
  await page.getByRole('button', { name: /^Partner einladen/ }).click();
  await expect(page).toHaveURL(/\/more\/invites$/);
  await page.getByRole('button', { name: 'Neue Einladung' }).click();
  await expect(inviteCodeLabel(page).first()).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more$/);

  await wheelTo(page, page.getByRole('button', { name: 'Anderem Haushalt beitreten' }));
  await page.getByRole('button', { name: 'Anderem Haushalt beitreten' }).click();
  await expect(page).toHaveURL(/\/join$/);
  await expect(page.getByRole('textbox', { name: 'Einladungscode' })).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(addField(page)).toBeVisible();
  await openMore(page);
  await wheelTo(page, page.getByRole('button', { name: 'Kategorien verwalten' }));

  await page.getByRole('button', { name: 'Kategorien verwalten' }).click();
  await expect(page.getByRole('heading', { name: 'Kategorien' })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();

  await page.getByRole('button', { name: /^Läden/ }).click();
  await expect(page.getByRole('heading', { name: 'Läden' })).toBeVisible();
  for (const store of ['Supermarkt', 'Drogerie']) {
    // The list hides stores without items (job 17b); this screen lists every store.
    await expect(page.getByRole('button', { name: new RegExp(`^${store}\\b`) }), `${store} is listed though empty`).toBeVisible();
  }
  await page.getByRole('button', { name: /^Supermarkt/ }).click();
  await expect(page.getByRole('heading', { name: 'Supermarkt: Reihenfolge' }), 'a store opens its walking order').toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Zurück' }).click();

  // Job 29d: Zugänge and Konto are two pages, each with its own route.
  await page.getByRole('button', { name: /^Zugänge/ }).click();
  await expect(page).toHaveURL(/\/more\/access$/);
  await expect(page.getByRole('heading', { name: 'Zugänge' })).toBeVisible();
  await expect(page.getByText('MCP-Server', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Konto löschen', exact: true }), 'Konto is its own page').toHaveCount(0);
  await screenshot(page, 'more-04-access');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more$/);

  await page.getByRole('button', { name: /^Konto Daten/ }).click();
  await expect(page).toHaveURL(/\/more\/account$/);
  await expect(page.getByRole('heading', { name: 'Konto' })).toBeVisible();
  // Selectable text is a group named by its text on web, like the MCP URL.
  await expect(page.getByRole('group', { name: email, exact: true }), 'who is signed in').toBeVisible();
  await expect(page.getByRole('button', { name: /^Meine Daten exportieren/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Konto löschen', exact: true })).toBeVisible();
  await expect(page.getByText('MCP-Server', { exact: true }), 'Zugänge is its own page').toHaveCount(0);
  await screenshot(page, 'more-05-account');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more$/);

  await page.context().route('https://hummlist.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>hummlist.com</title>' }));
  for (const [name, url] of [
    ['Datenschutz', 'https://hummlist.com/datenschutz'],
    ['Impressum', 'https://hummlist.com/impressum'],
  ]) {
    const row = page.getByRole('button', { name: new RegExp(`^${name}`) });
    await wheelTo(page, row);
    const popup = page.waitForEvent('popup');
    await row.click();
    expect((await popup).url(), `${name} is the site page, in a new tab`).toBe(url);
    await (await popup).close();
    await expect(page, 'the app stays on More').toHaveURL(/\/more$/);
  }

  await wheelTo(page, page.getByRole('button', { name: /^Lizenzen/ }));
  await page.getByRole('button', { name: /^Lizenzen/ }).click();
  await expect.poll(() => page.locator('body').ariaSnapshot(), { message: 'the licenses page names the app and lists packages' })
    .toMatch(/Hummlist[\s\S]*Flutter[\s\S]*bloc/);
  await screenshot(page, 'more-02-licenses');
  await page.getByRole('button', { name: 'Zurück' }).click();

  await wheelTo(page, page.getByRole('button', { name: /^Abmelden/ }));
  await page.getByRole('button', { name: /^Abmelden/ }).click();
  await expect(page.getByRole('textbox', { name: 'E-Mail' })).toBeVisible();
  await expect(page).toHaveURL(/\/login/);
});

test('old /settings links open the right page; back from a deep link goes to More', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('deeplink'));
  await page.goto('/settings?section=account');
  await expect(page).toHaveURL(/\/more\/account$/);
  await expect(page.getByRole('button', { name: 'Konto löschen', exact: true })).toBeVisible();
  await expect(moreTab(page), 'inside the More tab').toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more$/);
  await expect(page.getByRole('heading', { name: 'Mehr' })).toBeVisible();

  await page.goto('/settings');
  await expect(page).toHaveURL(/\/more\/access$/);
  await expect(page.getByText('MCP-Server', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more$/);
});

test('switching to English in Einstellungen changes the whole UI at once and survives a reload', async ({ page }) => {
  await signUpWithHousehold(page, newEmail('lang'));
  await addItem(page, 'Milch');
  await page.keyboard.press('Escape');
  await openMore(page);
  // Job 29e: the language is a list below Einstellungen, each language in its own name.
  await page.getByRole('button', { name: /^Einstellungen/ }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
  await page.getByRole('button', { name: /^Sprache Wie Gerät \(Deutsch\)/ }).click();
  await expect(page).toHaveURL(/\/more\/settings\/language$/);
  await expect(page.getByRole('radio', { name: /^Wie Gerät/ })).toBeChecked();
  await page.getByRole('radio', { name: 'English', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Language' }), 'live, without a restart').toBeVisible();
  await expect(page.getByRole('radio', { name: 'English', exact: true })).toBeChecked();
  await expect(page.getByRole('tab', { name: 'List' })).toBeVisible();
  await screenshot(page, 'more-03-english');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Language' }), 'kept on the device').toBeVisible();
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.getByRole('button', { name: /^Language English/ }), 'Settings names the pick').toBeVisible();
  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page.getByRole('textbox', { name: 'What do you need?' })).toBeVisible();
  await expect(page.getByText('Chilled'), 'a seeded category shows its English name').toBeVisible();
  await page.getByRole('tab', { name: 'More' }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
  await page.getByRole('button', { name: /^Language/ }).click();
  await page.getByRole('radio', { name: 'Deutsch', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sprache' })).toBeVisible();
});

/** German UI texts: every app_de.arb message that English words differently, as literal pieces. */
function germanTexts(): string[] {
  const de = JSON.parse(readFileSync(new URL('../../app/l10n/app_de.arb', import.meta.url), 'utf8')) as Record<string, unknown>;
  const en = JSON.parse(readFileSync(new URL('../../app/l10n/app_en.arb', import.meta.url), 'utf8')) as Record<string, unknown>;
  const pieces = new Set<string>();
  for (const [key, value] of Object.entries(de)) {
    if (key.startsWith('@') || typeof value !== 'string' || value === en[key]) continue;
    // Placeholders and plural forms (nested braces) split a message into the literal text around them.
    let depth = 0;
    let outside = '';
    for (const char of value) {
      if (char === '{') depth++;
      if (depth === 0) outside += char;
      else if (char === '}' && depth === 1) outside += '\u0000';
      if (char === '}') depth--;
    }
    for (const piece of outside.split('\u0000')) {
      const text = piece.trim();
      if (text.length >= 5 && /\p{L}{4}/u.test(text)) pieces.add(text);
    }
  }
  return [...pieces];
}

test.describe('with an English browser', () => {
  test.use({ locale: 'en-US' });

  async function expectNoGerman(page: Page, where: string, german: string[]) {
    const tree = await page.locator('body').ariaSnapshot();
    const found = german.filter((text) => tree.includes(text));
    expect(found, `${where}: German UI text`).toEqual([]);
  }

  test('the app starts in English and no German UI text shows anywhere', async ({ page }) => {
    const german = germanTexts();
    expect(german.length, 'the scan has German texts to look for').toBeGreaterThan(100);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Sign up' })).toBeVisible();
    await expectNoGerman(page, 'login', german);
    await typeInto(page.getByRole('textbox', { name: 'Email' }), newEmail('english'));
    await typeInto(page.getByRole('textbox', { name: 'Password' }), password);
    await page.getByRole('button', { name: 'Sign up' }).click();
    // Job 19: the analytics consent comes first, in English too.
    await expect(page.getByRole('button', { name: 'Allow', exact: true })).toBeVisible();
    await expectNoGerman(page, 'analytics consent', german);
    await page.getByRole('button', { name: "Don't allow", exact: true }).click();
    // Job 22: onboarding's steps, in English too.
    await expect(page.getByRole('button', { name: /^Create a household/ })).toBeVisible();
    await expectNoGerman(page, 'welcome', german);
    await page.getByRole('button', { name: /^Create a household/ }).click();
    await expect(page.getByRole('button', { name: 'Add your own store' })).toBeVisible();
    await expectNoGerman(page, 'create household', german);
    await page.getByRole('button', { name: 'Create a household', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Invite your partner', exact: true })).toBeVisible();
    await expectNoGerman(page, 'invite partner', german);
    await page.getByRole('button', { name: 'Invite your partner', exact: true }).click();
    await expect(page.getByText(/^valid until /)).toBeVisible();
    await expectNoGerman(page, 'invite card', german);
    await page.getByRole('button', { name: 'Go to the list' }).click();

    const field = page.getByRole('textbox', { name: 'What do you need?' });
    await expect(field).toBeFocused();
    await typeInto(field, 'Milch');
    await expect(page.getByRole('group', { name: 'Add', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Milch, As typed/ })).toBeVisible();
    await expectNoGerman(page, 'add sheet', german);
    await screenshot(page, 'en-01-add-sheet');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await expect(itemRow(page, 'Milch')).toBeVisible();
    await expectNoGerman(page, 'list', german);
    await screenshot(page, 'en-02-list');

    await itemRow(page, 'Milch').click({ button: 'right' });
    await expect(page.getByRole('group', { name: 'Edit', exact: true })).toBeVisible();
    await expectNoGerman(page, 'edit sheet', german);
    await page.getByRole('button', { name: 'Cancel' }).click();

    await page.getByRole('tab', { name: 'More' }).click();
    await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
    await expectNoGerman(page, 'More', german);
    await page.getByRole('button', { name: /^Access/ }).click();
    await expect(page.getByText('MCP server')).toBeVisible();
    await expectNoGerman(page, 'access', german);
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /^Account/ }).click();
    await expect(page.getByRole('button', { name: 'Delete account' })).toBeVisible();
    await expectNoGerman(page, 'account', german);
    await screenshot(page, 'en-03-settings');
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /^Settings/ }).click();
    await expect(page.getByRole('radio', { name: 'Dark', exact: true })).toBeVisible();
    await expectNoGerman(page, 'settings', german);
    await page.getByRole('button', { name: /^Language Device \(English\)/ }).click();
    // The row's line, what the device gives, is part of the radio's name.
    await expect(page.getByRole('radio', { name: 'Device Currently English', exact: true })).toBeChecked();
    await expectNoGerman(page, 'language list', german);
  });
});

test('wide screens: a rail, a sheet as wide as the list column, More in two panes', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 1024 });
  await signUpWithHousehold(page, newEmail('wide'));
  const railList = page.getByRole('button', { name: /^Liste Tab/ });
  await expect(railList, 'the rail has the tabs').toBeVisible();
  const rail = (await railList.boundingBox())!;
  expect(rail.x, 'the rail is on the left').toBeLessThan(120);

  await typeInto(addField(page), 'Butter');
  const sheet = page.getByRole('group', { name: 'Hinzufügen', exact: true });
  await expect(sheet).toBeVisible();
  const box = (await sheet.boundingBox())!;
  expect(box.width, 'the sheet keeps to the list column').toBeLessThanOrEqual(641);
  const field = (await addField(page).boundingBox())!;
  expect(Math.abs(box.x + box.width / 2 - (field.x + field.width / 2)), 'the input sits under the sheet').toBeLessThan(80);
  await screenshot(page, 'wide-01-sheet-1366');
  await page.keyboard.press('Escape');

  await page.getByRole('button', { name: /^Mehr Tab/ }).click();
  await expect(page.getByRole('button', { name: /^Konto Daten/ }), 'the sections on the left').toBeVisible();
  await expect(page.getByText('MCP-Server', { exact: true }), 'and a page beside them').toBeVisible();
  const list = (await page.getByRole('button', { name: /^Konto Daten/ }).boundingBox())!;
  const detail = (await page.getByText('MCP-Server', { exact: true }).boundingBox())!;
  expect(detail.x, 'two panes side by side').toBeGreaterThan(list.x + list.width - 1);
  await page.getByRole('button', { name: /^Konto Daten/ }).click();
  await expect(page).toHaveURL(/\/more\/account$/);
  await expect(page.getByRole('button', { name: 'Konto löschen', exact: true })).toBeInViewport();
  await expect(page.getByText('MCP-Server', { exact: true }), 'the pane shows Konto alone').toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Zurück' }), 'beside the list there is nothing to go back to').toHaveCount(0);
  await screenshot(page, 'wide-02-more-1366');
  await page.getByRole('button', { name: /^Zugänge/ }).click();
  await expect(page).toHaveURL(/\/more\/access$/);
  await expect(page.getByText('MCP-Server', { exact: true })).toBeVisible();

  // Job 29e: Einstellungen beside the list, its language list too, with a way back to it.
  await page.getByRole('button', { name: /^Einstellungen/ }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);
  await expect(page.getByRole('radio', { name: 'Dunkel', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^Sprache Wie Gerät/ }).click();
  await expect(page).toHaveURL(/\/more\/settings\/language$/);
  await expect(page.getByRole('radio', { name: 'English', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Konto Daten/ }), 'the list stays').toBeVisible();
  await screenshot(page, 'wide-04-language-1366');
  await page.getByRole('button', { name: 'Zurück' }).click();
  await expect(page).toHaveURL(/\/more\/settings$/);

  await page.setViewportSize({ width: 820, height: 1180 });
  await page.getByRole('tab', { name: 'Liste' }).click();
  await expect(addField(page)).toBeVisible();
  await screenshot(page, 'wide-03-list-820');
});
