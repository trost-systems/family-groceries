import { expect, type Page } from '@playwright/test';
import { addField, anonClient, answerConsent, apiAs, password, typeInto, openEmailSignIn } from './helpers';

/**
 * Job 28: the web build is `flutter build web --wasm`, which holds two apps. flutter_bootstrap.js
 * runs main.dart.wasm (dart2wasm, skwasm renderer) where the browser has the Wasm features
 * dart2wasm needs and its engine is on the wasm allow list (all three since job 201), and
 * main.dart.js (dart2js, CanvasKit) everywhere else.
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

/** Flutter's name for a Playwright browser's engine, as in `wasmAllowList`. */
export type Engine = 'blink' | 'webkit' | 'gecko';

export function engineOf(browserName: string): Engine {
  switch (browserName) {
    case 'chromium': return 'blink';
    case 'webkit': return 'webkit';
    case 'firefox': return 'gecko';
    default: throw new Error(`no Flutter engine for ${browserName}`);
  }
}

/**
 * Overrides engines in the `wasmAllowList` of our flutter_bootstrap.js, the switch that takes an
 * engine off wasm in one line; the specs use it to run both apps in one browser.
 */
export async function wasmAllowList(page: Page, list: Partial<Record<Engine, boolean>>): Promise<void> {
  await page.route('**/flutter_bootstrap.js', async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const line = /const wasmAllowList = \{([^}]*)\};/;
    if (!line.test(body)) throw new Error('flutter_bootstrap.js no longer has const wasmAllowList = { ... };');
    const patched = body.replace(line, (_, engines: string) => `const wasmAllowList = { ${engines}, ...${JSON.stringify(list)} };`);
    await route.fulfill({ response, body: patched });
  });
}

/** A new account with a household and [stores], made through the API, and its list filled with [names]. */
export async function householdWithItems(email: string, names: string[], { stores = [] }: { stores?: string[] } = {}): Promise<void> {
  const { error } = await anonClient().auth.signUp({ email, password });
  if (error) throw error;
  const api = await apiAs(email);
  const { data: household, error: created } = await api.rpc('create_household', { p_name: 'Messung', p_stores: stores });
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
  await openEmailSignIn(page);
  await typeInto(page.getByRole('textbox', { name: 'E-Mail' }), email);
  await typeInto(page.getByRole('textbox', { name: 'Passwort' }), password);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await answerConsent(page);
  await expect(addField(page)).toBeVisible({ timeout: 30_000 });
}
