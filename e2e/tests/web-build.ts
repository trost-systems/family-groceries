import { expect, type Page } from '@playwright/test';
import { anonClient, answerConsent, apiAs, password, typeInto } from './helpers';

/**
 * Job 28: the web build is `flutter build web --wasm`, which holds two apps. flutter_bootstrap.js
 * runs main.dart.wasm (dart2wasm, skwasm renderer) where the browser has WasmGC and its engine is
 * on Flutter's wasm allow list (Chromium only, by default), and main.dart.js (dart2js, CanvasKit)
 * everywhere else.
 */
export type Build = 'wasm' | 'js';

/** Records which of the two apps the page loads: 'wasm', 'js', or both if something went wrong. */
export function watchBuild(page: Page): () => Build[] {
  const loaded: Build[] = [];
  page.on('request', (request) => {
    const match = /\/main\.dart\.(wasm|js)$/.exec(new URL(request.url()).pathname);
    if (match) loaded.push(match[1] as Build);
  });
  return () => loaded;
}

/** The page acts like a browser without WasmGC, the case the JS build exists for. */
export async function withoutWasmGC(page: Page): Promise<void> {
  await page.addInitScript(() => {
    WebAssembly.validate = () => false;
  });
}

/**
 * Passes Flutter's `wasmAllowList` to the loader in our flutter_bootstrap.js, as an app that opts
 * an engine in or out would; the measurement uses it to run both builds in one browser.
 */
export async function wasmAllowList(page: Page, list: { blink?: boolean; webkit?: boolean }): Promise<void> {
  await page.route('**/flutter_bootstrap.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const call = '_flutter.loader.load({';
    if (!body.includes(call)) throw new Error(`flutter_bootstrap.js no longer calls ${call}`);
    await route.fulfill({ response, body: body.replace(call, `${call} config: { wasmAllowList: ${JSON.stringify(list)} },`) });
  });
}

/** A new account with a household, made through the API, and its list filled with [names]. */
export async function householdWithItems(email: string, names: string[]): Promise<void> {
  const { error } = await anonClient().auth.signUp({ email, password });
  if (error) throw error;
  const api = await apiAs(email);
  const { data: household, error: created } = await api.rpc('create_household', { p_name: 'Messung' });
  if (created) throw created;
  const householdId = (household as { id: string }).id;
  for (let i = 0; i < names.length; i += 50) {
    const { error: inserted } = await api.from('items')
      .insert(names.slice(i, i + 50).map((name) => ({ household_id: householdId, name })));
    if (inserted) throw inserted;
  }
}

/** Signs in with email and password on the login page of a fresh context, declining analytics. */
export async function signIn(page: Page, email: string): Promise<void> {
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await answerConsent(page);
  await expect(page.getByText(/^\d+ Artikel$/)).toBeVisible({ timeout: 30_000 });
}
