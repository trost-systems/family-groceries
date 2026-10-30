import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { type BrowserContext, expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import WebSocket from 'ws';
import { fakeOidcPort, localSecretKey, stack } from '../stack';

export const { url: supabaseUrl, key: publishableKey, mailpit } = stack;
export const functionsUrl = `${supabaseUrl}/functions/v1`;

export const password = 'test-password-123';

export function newEmail(tag: string): string {
  return `${tag}-${randomUUID().slice(0, 8)}@example.test`;
}

/** A supabase-js client signed in as the given user, for API-level checks. */
export async function apiAs(email: string): Promise<SupabaseClient> {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    // Node 20 has no global WebSocket.
    realtime: { transport: WebSocket as never },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

export const addField = (page: Page) => page.getByRole('textbox', { name: 'Was brauchst du?' });
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A list row; its accessible name is the item name, a space, then the quantity. A row under
 * "Zuletzt verwendet" ends in "Wieder auf die Liste" and is not one (`usedRow`).
 */
export const itemRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^(?!.* ${usedAction}$)${escape(name)}( |$)`) });

const usedAction = 'Wieder auf die Liste';

/**
 * A ticked item's row under "Zuletzt verwendet" (job 29b): the list's own row, faded, named like
 * it plus "Wieder auf die Liste". A tap puts the item back on the list.
 */
export const usedRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${escape(name)}( .*)? ${usedAction}$`) });

/**
 * Puts a ticked item back with a tap on it under "Zuletzt verwendet", the tick's undo since the
 * tick has no snackbar (job 29b); opens the section first if it is closed.
 */
export async function putBack(page: Page, name: string): Promise<void> {
  const section = page.getByRole('button', { name: 'Zuletzt verwendet' });
  await reveal(page, section);
  if (await usedRow(page, name).count() === 0) await section.click();
  await reveal(page, usedRow(page, name));
  await usedRow(page, name).click();
  await expect(itemRow(page, name)).toBeVisible();
}

/**
 * A snackbar with an action (undo): Flutter puts its text in the aria-label of a group, so
 * getByText finds only the screen-reader announcement, an off-screen copy the engine clears
 * after a few hundred milliseconds.
 */
export const actionSnackBar = (page: Page, text: string) => page.getByRole('group', { name: text, exact: true });

/**
 * The height of the bar above the list (`_Header.height` in app/lib/list/list_screen.dart): the
 * same in every sync state, and the web has no top inset.
 */
export const listBarHeight = 44;

/** The list's visible band: from the bar above it to the top of the add bar, 12 px above its field. */
export async function listArea(page: Page): Promise<{ top: number; bottom: number }> {
  const field = (await addField(page).boundingBox())!;
  return { top: listBarHeight, bottom: field.y - 12 };
}

/**
 * Scrolls the list with the mouse wheel until [target] is fully on screen. The list builds rows
 * lazily, so a row far off screen is not in the page at all until the list scrolls near it; it is
 * looked for downwards first, then upwards.
 */
export async function reveal(page: Page, target: Locator): Promise<void> {
  const { top, bottom } = await listArea(page);
  await page.mouse.move(page.viewportSize()!.width / 2, (top + bottom) / 2);
  for (let i = 0; i < 40; i++) {
    const box = await target.boundingBox({ timeout: 200 }).catch(() => null);
    if (box && box.y >= top && box.y + box.height <= bottom) return;
    const down = box ? box.y + box.height > bottom : i < 20;
    await page.mouse.wheel(0, down ? 250 : -250);
    await page.waitForTimeout(150);
  }
  throw new Error(`could not scroll ${target} into view`);
}

/**
 * Ticks an item off: a tap on its row (design H has no check box). The row leaves for 260 ms
 * before the tick commits, so this waits for the row to go (the tick has no snackbar since job
 * 29b): an add of the same name before then finds the item still on the list.
 */
export async function tick(page: Page, name: string): Promise<void> {
  await reveal(page, itemRow(page, name));
  const rows = await itemRow(page, name).count();
  await itemRow(page, name).click();
  await expect(itemRow(page, name)).toHaveCount(rows - 1);
}

/** A store's divider by its name; its accessible name is "<store>, <n> Artikel". */
export const storeDivider = (page: Page, store: string) =>
  page.getByRole('button', { name: new RegExp(`^${escape(store)}, \\d+ Artikel`) });

/** The edit sheet (job 15): a group whose rect is exactly the sheet's content. */
export const editSheet = (page: Page) => page.getByRole('group', { name: 'Bearbeiten', exact: true });

/** A field of the edit sheet by its label: Bezeichnung, Marke, Menge, Eigenschaften. */
export const editField = (page: Page, label: string) => editSheet(page).getByRole('textbox', { name: label });

/**
 * Flutter web fills a text field's <input> only while it is being edited, so a prefilled value is
 * read after focusing the field.
 */
export async function expectFieldValue(field: Locator, value: string): Promise<void> {
  const page = field.page();
  await expect(async () => {
    await field.click();
    await expect(field).toBeFocused();
    await nextFrames(page);
    await expect(field).toHaveValue(value, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Passes once `check` does, within `ms` of the time the test runner ran. A live-sync budget
 * measures the app; a host pause inside it stops the runner, Chromium and the stack alike, and a
 * wall-clock deadline would fail on it however fast the app is. Each round is short and counts at
 * most one second, so a pause costs a second of the budget, not all of it.
 */
export async function within(ms: number, check: (timeout: number) => Promise<unknown>): Promise<void> {
  for (let ran = 0; ;) {
    const start = Date.now();
    try {
      await check(250);
      return;
    } catch (error) {
      ran += Math.min(Date.now() - start, 1_000);
      if (ran >= ms) throw error;
    }
  }
}

/** Opens an item's edit sheet with a right click, the web's long-press, scrolling to it first. */
export async function openEdit(page: Page, name: string): Promise<void> {
  await reveal(page, itemRow(page, name));
  await itemRow(page, name).click({ button: 'right' });
  await expect(editSheet(page)).toBeVisible();
}

/** Folds out the store or category chip and picks an option by its name. */
export async function pickInSheet(page: Page, chip: 'Laden' | 'Kategorie', option: string): Promise<void> {
  await editSheet(page).getByRole('button', { name: new RegExp(`^${chip}: `) }).click();
  await editSheet(page).getByRole('button', { name: option, exact: true }).click();
}

/** Presses Fertig and waits for the sheet to close. */
export async function saveEdit(page: Page): Promise<void> {
  await editSheet(page).getByRole('button', { name: 'Fertig' }).click();
  await expect(editSheet(page)).toHaveCount(0);
}

type Point = { x: number; y: number };

/**
 * One finger on a phone's browser (job 29c): it lands on the first point, waits [hold] ms, slides
 * through the others in [steps] moves each, and lifts after [pause] ms more. Chromium gets real
 * touch events over CDP. WebKit has no touch driver in Playwright, so it gets the pointer events
 * Safari sends for a finger (`pointerType: 'touch'`), which is what Flutter web listens to:
 * pointerdown on the view, then pointermove and pointerup reaching its global target.
 * [onMove] runs while the finger is still down, after the last move.
 */
export async function finger(
  page: Page,
  points: Point[],
  { hold = 0, steps = 10, pause = 50, onMove }: { hold?: number; steps?: number; pause?: number; onMove?: () => Promise<void> } = {},
): Promise<void> {
  const path: Point[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]];
    for (let s = 1; s <= steps; s++) path.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  const last = path[path.length - 1];
  if (page.context().browser()?.browserType().name() === 'chromium') {
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', at?: Point) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: at ? [{ x: at.x, y: at.y, id: 1 }] : [] });
    await touch('touchStart', path[0]);
    await page.waitForTimeout(hold);
    for (const at of path.slice(1)) {
      await touch('touchMove', at);
      await page.waitForTimeout(16);
    }
    await onMove?.();
    await page.waitForTimeout(pause);
    await touch('touchEnd');
    await cdp.detach();
    return;
  }
  const send = (type: string, at: Point) => page.evaluate(([type, x, y]) => {
    const w = window as unknown as { fingerTarget?: Element };
    // A finger's events go to the element it landed on. Once that element leaves the page (the
    // engine rebuilds a row's semantics node when the item lifts), the browser hit-tests again.
    if (type === 'pointerdown' || !w.fingerTarget?.isConnected) w.fingerTarget = document.elementFromPoint(x, y) ?? document.body;
    w.fingerTarget!.dispatchEvent(new PointerEvent(type, {
      pointerId: 29, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, composed: true,
      clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1,
      width: 20, height: 20, pressure: type === 'pointerup' ? 0 : 0.5,
    }));
  }, [type, at.x, at.y] as const);
  await send('pointerdown', path[0]);
  await page.waitForTimeout(hold);
  for (const at of path.slice(1)) {
    await send('pointermove', at);
    await page.waitForTimeout(16);
  }
  await onMove?.();
  await page.waitForTimeout(pause);
  await send('pointerup', last);
}

/** A finger swipe to the left across most of [target]'s width, along its middle. */
export async function swipeLeft(page: Page, target: Locator, options: { onMove?: () => Promise<void> } = {}): Promise<void> {
  const b = (await target.boundingBox())!;
  const y = b.y + b.height / 2;
  await finger(page, [{ x: b.x + b.width - 30, y }, { x: b.x + 30, y }], options);
}

/** Resolves once the page has drawn two more frames, so Flutter has drawn the frame it had scheduled. */
export async function nextFrames(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
}

/**
 * Flutter swaps in its own editor on focus, so focus first, then insert.
 * insertText (not type) because synthetic key events drop umlauts.
 *
 * The DOM focus only asks the app to focus the field; the engine starts
 * listening to the <input> with the next frame's semantics update. Text
 * inserted before that frame is in the DOM but not in the app, and the frame
 * puts the app's value back. That frame comes late under load: the password
 * typed right after a failed sign-in was sent as the old one (job 12b). So
 * wait for the frame before typing, and check the value after the next one.
 */
export async function typeInto(field: Locator, text: string): Promise<void> {
  const page = field.page();
  await expect(async () => {
    await field.click();
    await expect(field).toBeFocused();
    await nextFrames(page);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText(text);
    await nextFrames(page);
    await expect(field).toHaveValue(text, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

/**
 * Signs up in a fresh browser context, then answers the analytics consent that follows the first
 * sign-in on an install (job 19): declined unless [consent] says otherwise. Ends on onboarding
 * (or its join form for an invite link).
 */
export async function signUp(
  page: Page,
  email: string,
  path = '/',
  { consent = 'decline' }: { consent?: ConsentChoice } = {},
): Promise<void> {
  await page.goto(path);
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Registrieren' }).click();
  await answerConsent(page, consent);
}

/** One finger swipe up the middle of the screen, as touch pointer events (WebKit has no swipe API). */
export async function touchSwipeUp(page: Page): Promise<void> {
  const { width, height } = page.viewportSize() ?? { width: 390, height: 660 };
  await page.evaluate(({ width, height }) => {
    const x = width / 2;
    const from = height * 0.7;
    const target = document.elementFromPoint(x, from) ?? document.body;
    const fire = (type: string, y: number) => target.dispatchEvent(new PointerEvent(type, {
      bubbles: true, composed: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1, pressure: type === 'pointerup' ? 0 : 0.5,
    }));
    fire('pointerdown', from);
    for (let i = 1; i <= 10; i++) fire('pointermove', from - i * height * 0.04);
    fire('pointerup', from - height * 0.4);
  }, { width, height });
}

export type ConsentChoice = 'accept' | 'decline';

/** The analytics consent screen (job 19), asked once per install right after sign-in. */
export const consentScreen = (page: Page) => page.getByRole('button', { name: 'Einverstanden' });

/**
 * Answers the analytics consent, which a fresh browser context sees after its first sign-in, and
 * waits until the app moved on. Every first sign-in goes through here: the order sign-in,
 * consent, onboarding or list is part of every spec.
 */
export async function answerConsent(page: Page, choice: ConsentChoice = 'decline'): Promise<void> {
  await expect(page).toHaveURL(/\/analytics-consent(\?|$)/);
  const answer = page.getByRole('button', { name: choice === 'accept' ? 'Einverstanden' : 'Ablehnen' });
  await expect(page.getByRole('heading', { name: 'Nutzungsdaten' })).toBeVisible();
  // A phone (job 33b): the consent text is longer than an iPhone screen. Scroll as a finger does
  // (no mouse wheel on a phone), then tap the answer.
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    await expect(async () => {
      if (!(await answer.isVisible())) await touchSwipeUp(page);
      await expect(answer).toBeInViewport({ timeout: 500 });
    }).toPass();
    await answer.tap();
    await expect(page).not.toHaveURL(/\/analytics-consent/);
    return;
  }
  // On a short screen the answers sit below the text: wheel down to them. Only then: the mouse
  // left over the page would hover whatever comes next.
  if (!(await answer.isVisible())) {
    const size = page.viewportSize() ?? { width: 400, height: 800 };
    await page.mouse.move(size.width / 2, size.height / 2);
    await expect(async () => {
      if (!(await answer.isVisible())) await page.mouse.wheel(0, 400);
      await expect(answer).toBeVisible({ timeout: 500 });
    }).toPass();
  }
  await answer.click();
  await expect(page).not.toHaveURL(/\/analytics-consent/);
}

/** What the app sent to PostHog, as the stand-in collector received it. */
export interface Captured {
  event: string;
  uuid: string;
  properties: Record<string, unknown>;
}

/**
 * Answers the e2e build's PostHog host (app/config/e2e.json, a .invalid host) in [context] and
 * keeps every request: nothing leaves the machine. Any request to a real PostHog host fails the
 * spec through [Collector.leaks].
 */
export async function fakeCollector(context: BrowserContext): Promise<Collector> {
  const collector = { requests: [] as string[], events: [] as Captured[], leaks: [] as string[] };
  await context.route('https://posthog.invalid/**', async (route) => {
    const request = route.request();
    collector.requests.push(`${request.method()} ${new URL(request.url()).pathname}`);
    if (request.method() === 'POST') {
      const body = request.postDataJSON() as { api_key: string; batch: Captured[] };
      collector.events.push(...body.batch);
    }
    await route.fulfill({
      status: 200,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      },
      body: '{"status":1}',
    });
  });
  await context.route(/^https:\/\/([a-z0-9-]+\.)*posthog\.com\//, async (route) => {
    collector.leaks.push(route.request().url());
    await route.abort();
  });
  return collector;
}

export type Collector = { requests: string[]; events: Captured[]; leaks: string[] };

/** The names of what [collector] received, in order. */
export const eventNames = (collector: Collector) => collector.events.map((e) => e.event);

export async function signUpWithHousehold(page: Page, email: string): Promise<void> {
  await signUp(page, email);
  await createHousehold(page);
  await skipInvite(page);
}

/**
 * Onboarding (job 22) from Step 1: "Haushalt erstellen", then Step 2a with [name] (the prefilled
 * "Unser Haushalt" by default) and the default stores unless [stores] is false. Ends on Step 3,
 * inviting the partner.
 */
export async function createHousehold(
  page: Page,
  { name, stores = true }: { name?: string; stores?: boolean } = {},
): Promise<void> {
  await expect(page).toHaveURL(/\/welcome(\?|$)/);
  await page.getByRole('button', { name: /^Haushalt erstellen/ }).click();
  await expect(page).toHaveURL(/\/welcome\/create(\?|$)/);
  // The prefilled name is not in the DOM until the field is edited, so it is not checked here.
  const field = page.getByRole('textbox', { name: 'Name des Haushalts' });
  await expect(field).toBeVisible();
  if (name !== undefined) await typeInto(field, name);
  if (!stores) await page.getByRole('radio', { name: /^Überspringen/ }).click();
  await page.getByRole('button', { name: 'Haushalt erstellen', exact: true }).click();
  await expect(page).toHaveURL(/\/welcome\/invite$/);
}

/** Onboarding Step 3's "Später" (or "Weiter zur Liste" once invited): on to the list, its add field focused. */
export async function skipInvite(page: Page): Promise<void> {
  await page.getByRole('button', { name: /^(Später|Weiter zur Liste)$/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(addField(page)).toBeFocused();
}

/**
 * The household name the join screen shows for a good code. Its card is one text node on the web:
 * "Einladung in den Haushalt Familie Trost".
 */
export const invitePreview = (page: Page, household: string) =>
  page.getByText(new RegExp(`Einladung in den Haushalt\\s*${escape(household)}$`));

/**
 * Joins with a typed [code] (job 22): from Step 1 ("Einladung annehmen") or the join screen, type,
 * "Weiter", see the household's name, "Haushalt beitreten". Ends on the list.
 */
export async function joinWithCode(page: Page, code: string, household?: string): Promise<void> {
  if (/\/welcome(\?|$)/.test(new URL(page.url()).pathname)) {
    await page.getByRole('button', { name: /^Einladung annehmen/ }).click();
  }
  await expect(page).toHaveURL(/\/join(\?|\/|$)/);
  await typeInto(page.getByRole('textbox', { name: 'Einladungscode' }), code);
  await page.getByRole('button', { name: 'Weiter', exact: true }).click();
  await confirmJoin(page, household);
}

/** On the join screen with a previewed code: "Haushalt beitreten", then the list. */
export async function confirmJoin(page: Page, household?: string): Promise<void> {
  const join = page.getByRole('button', { name: 'Haushalt beitreten', exact: true });
  await expect(join).toBeVisible();
  if (household) await expect(invitePreview(page, household)).toBeVisible();
  await join.click();
  await expect(page).toHaveURL(/\/$/);
  await expect(addField(page)).toBeVisible();
}

/** The add sheet (job 17): a group whose rect is the sheet's content, open while adding. */
export const addSheet = (page: Page) => page.getByRole('group', { name: 'Hinzufügen', exact: true });

/**
 * The sheet's line about the last add, as shown: "✓ Hinzugefügt: Milch → Lidl" (with Rückgängig)
 * or "Butter steht schon auf der Liste". Any such line by default.
 */
export const addedNote = (page: Page, line: string | RegExp = /^✓ Hinzugefügt: | steht schon auf der Liste$/) =>
  addSheet(page).getByText(line, { exact: true });

/**
 * Types [text] and presses Enter, which takes the sheet's first suggestion (the server's reading
 * of the text), and waits for the sheet to say so. The sheet stays open for the next item, the
 * field focused, and the list behind the scrim out of reach: see [addItem].
 */
export async function enterItem(page: Page, text: string): Promise<void> {
  // Text inserted during the tap that opens the sheet lands in the DOM input but not in the app
  // (seen in job 17), so the sheet opens first.
  await addField(page).click();
  await expect(addSheet(page)).toBeVisible();
  await typeInto(addField(page), text);
  // The row for what was typed shows once the app has the text.
  await expect(addSheet(page).getByRole('button', { name: /, Wie getippt(,|$)/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(addedNote(page)).toBeVisible();
}

/**
 * Closes the add sheet with Escape in the field, which hands the list back. Not the Schließen
 * button: after it, the next tap on the field shows a cursor but drops what is typed (job 17,
 * reported to the lead).
 */
export async function closeSheet(page: Page): Promise<void> {
  await expect(addField(page)).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(addSheet(page)).toHaveCount(0);
}

/** Adds one item with Enter and closes the sheet, so the list is in reach again. */
export async function addItem(page: Page, text: string): Promise<void> {
  await enterItem(page, text);
  await closeSheet(page);
}

/** Switches tabs: a bottom bar on phones, a rail ("Mehr Tab 2 von 2") from 840 px. */
export async function openTab(page: Page, tab: 'Liste' | 'Mehr'): Promise<void> {
  await page.getByRole('tab', { name: tab, exact: true }).or(page.getByRole('button', { name: `${tab} Tab ` })).click();
}

/** Opens an entry of the More tab by its title ("Partner einladen", "Zugänge", "Abmelden" …). */
export async function openMore(page: Page, entry: string): Promise<void> {
  await openTab(page, 'Mehr');
  // The tab comes back to the page it was left on; a second tap goes to its first page, More's list.
  await expect(page).toHaveURL(/\/more\b/);
  if (new URL(page.url()).pathname !== '/more') await openTab(page, 'Mehr');
  await expect(page).toHaveURL(/\/more$/);
  await page.getByRole('button', { name: new RegExp(`^${escape(entry)}( |$)`) }).click();
}

const inviteCode = /^Code [A-HJ-NP-Z2-9]{8}$/;

/** Invite cards' code labels ("Code ABCD2345"), or the one for [code]. */
export const inviteCodeLabel = (page: Page, code?: string) => {
  const name = code === undefined ? inviteCode : `Code ${code}`;
  return page.getByRole('group', { name }).or(page.getByText(name, { exact: true }));
};

/** The codes the invite cards on screen show, top to bottom. */
export async function shownInviteCodes(page: Page): Promise<string[]> {
  const codes: string[] = [];
  for (const label of await inviteCodeLabel(page).all()) {
    const text = (await label.getAttribute('aria-label')) ?? (await label.textContent()) ?? '';
    const code = text.trim().split(/\s+/)[1];
    if (code && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

/**
 * Makes a new invite under More, Partner einladen (Einladungen, job 22), reads its code, then returns
 * to the list.
 */
export async function createInviteCode(page: Page): Promise<string> {
  await openMore(page, 'Partner einladen');
  await expect(page).toHaveURL(/\/more\/invites$/);
  await expect(page.getByText('Keine offenen Einladungen.').or(inviteCodeLabel(page).first())).toBeVisible();
  const before = await shownInviteCodes(page);
  await page.getByRole('button', { name: 'Neue Einladung' }).click();
  let created: string | undefined;
  await expect.poll(async () => (created = (await shownInviteCodes(page)).find((c) => !before.includes(c))))
    .toBeTruthy();
  await openTab(page, 'Liste');
  return created!;
}

export async function screenshot(page: Page, name: string): Promise<void> {
  const dir = process.env.SCREENSHOT_DIR;
  if (!dir) return;
  mkdirSync(dir, { recursive: true });
  // Flutter animates on its canvas, out of reach of Playwright's animation
  // controls, so wait until two frames agree (a chip that was just tapped
  // fades for ~200 ms).
  let previous = await page.screenshot();
  for (let attempt = 0; attempt < 20; attempt++) {
    await page.waitForTimeout(100);
    const current = await page.screenshot();
    if (current.equals(previous)) break;
    previous = current;
  }
  writeFileSync(`${dir}/${name}.png`, previous);
}

/** The newest sign-in link Mailpit holds for `email`. */
export async function latestLinkFor(email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const res = await fetch(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = await res.json() as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const message = await (await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`)).json() as { Text: string };
      const link = message.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\S+/)?.[0];
      if (link) return link;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`no magic link mail for ${email}`);
}

/** The local stack's service client, for setup no user may do (backdated history). */
export function adminClient(): SupabaseClient {
  return createClient(supabaseUrl, localSecretKey(), {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as never },
  });
}

/** A supabase-js client with no session. */
export function anonClient(): SupabaseClient {
  return createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket as never },
  });
}

export async function fakeIdToken(claims: {
  email: string; nonce?: string; aud?: string; emailVerified?: boolean; name?: string;
}): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${fakeOidcPort}/mint`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(claims),
  });
  return ((await res.json()) as { id_token: string }).id_token;
}

/**
 * Sends the app's next Google or Apple redirect to the fake provider as
 * `email`, or has the user cancel there. Only the provider name changes, so
 * the app's PKCE flow and Supabase's callback, code exchange and account
 * linking all run for real. Supabase passes extra authorize parameters on to
 * the provider, which reads the account from login_hint.
 */
export async function viaFakeProvider(page: Page, email: string, { cancel = false } = {}): Promise<void> {
  await page.route((url) => url.href.startsWith(`${supabaseUrl}/auth/v1/authorize?`), async (route) => {
    const url = new URL(route.request().url());
    url.searchParams.set('provider', 'keycloak');
    url.searchParams.set('login_hint', email);
    if (cancel) url.searchParams.set('deny', '1');
    await route.fulfill({ status: 302, headers: { location: url.href } });
  });
}

/** Cuts the page off from Supabase (HTTP and realtime); the app itself still loads. */
export async function cutOff(page: Page): Promise<{ restore: () => Promise<void> }> {
  let offline = true;
  const http = `${supabaseUrl}/**`;
  await page.route(http, (route) => route.abort());
  await page.routeWebSocket(new RegExp(`^ws://${new URL(supabaseUrl).host}/`), (ws) => {
    if (offline) ws.close();
    else ws.connectToServer();
  });
  return {
    restore: async () => {
      offline = false;
      await page.unroute(http);
    },
  };
}
