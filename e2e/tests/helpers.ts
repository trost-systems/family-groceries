import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, type Locator, type Page } from '@playwright/test';
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

export const addField = (page: Page) => page.getByRole('textbox', { name: 'Was fehlt?' });
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A list row; its accessible name is the item name, a space, then the quantity. */
export const itemRow = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${escape(name)}( |$)`) });

/**
 * A snackbar with an action (undo): Flutter puts its text in the aria-label of a group, so
 * getByText finds only the screen-reader announcement, an off-screen copy the engine clears
 * after a few hundred milliseconds.
 */
export const actionSnackBar = (page: Page, text: string) => page.getByRole('group', { name: text, exact: true });

export const tickBox = (page: Page, name: string) => page.getByRole('checkbox', { name: `${name} abhaken` });

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

/** Opens an item's edit sheet with a right click, the web's long-press. */
export async function openEdit(page: Page, name: string): Promise<void> {
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

export async function signUp(page: Page, email: string, path = '/'): Promise<void> {
  await page.goto(path);
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Registrieren' }).click();
}

export async function signUpWithHousehold(page: Page, email: string): Promise<void> {
  await signUp(page, email);
  await page.getByRole('button', { name: 'Haushalt anlegen' }).click();
  await expect(addField(page)).toBeFocused();
}

export async function addItem(page: Page, text: string): Promise<void> {
  await typeInto(addField(page), text);
  await page.keyboard.press('Enter');
}

/** Reads the invite code from the in-app invite dialog. */
export async function createInviteCode(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Menü' }).click();
  await page.getByRole('menuitem', { name: 'Mitglied einladen' }).click();
  const code = page.getByRole('group', { name: /^Code [A-HJ-NP-Z2-9]{8}$/ });
  await expect(code).toBeVisible();
  const value = (await code.getAttribute('aria-label'))!.split(/\s+/)[1];
  await page.getByRole('button', { name: 'Schließen' }).click();
  return value;
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
