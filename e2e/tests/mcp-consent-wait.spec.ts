// Job 62: after Erlauben the browser waits on the client's callback (Claude's took about 10 s)
// with the consent page still up. The page leaves for the callback at once and says the user is
// done. window.open is stubbed so the page stays as it looks during that wait: a real pending
// navigation holds Playwright's locators until it ends (mcp.spec.ts follows the real one).
import { Client, StreamableHTTPClientTransport, UnauthorizedError } from '@modelcontextprotocol/client';
import { expect, test } from './fixtures';
import { newEmail, screenshot, signUpWithHousehold } from './helpers';
import { callbackUrl, mcpUrl, openAuthorization, TestOAuthProvider } from './mcp-helpers';

type Opened = { url: string; target: string; at: number };

test('while the client finishes connecting, the consent page says the user is done', async ({ browser, baseURL }) => {
  const context = await browser.newContext();
  const app = await context.newPage();
  await signUpWithHousehold(app, newEmail('consent-wait'));
  const provider = new TestOAuthProvider('Claude (E2E)');
  await expect(new Client({ name: 'family-groceries-e2e', version: '1.0.0' })
    .connect(new StreamableHTTPClientTransport(mcpUrl, { authProvider: provider })))
    .rejects.toThrow(UnauthorizedError);

  const consent = await context.newPage();
  await consent.addInitScript(() => {
    window.open = (url, target) => {
      (window as unknown as { opened: Opened }).opened = { url: String(url), target: String(target), at: Date.now() };
      return null;
    };
  });
  await openAuthorization(consent, provider.authorizationUrl!, baseURL!);
  await consent.getByRole('button', { name: 'Erlauben' }).click();
  const tapped = Date.now();

  await expect(consent.getByText('Fertig, du kannst zu Claude (E2E) zurückkehren.')).toBeVisible();
  await expect(consent.getByText('Verbunden', { exact: true })).toBeVisible();
  await expect(consent.getByRole('button', { name: 'Erlauben' }), 'nothing left to tap').toHaveCount(0);
  const opened = await consent.evaluate(() => (window as unknown as { opened?: Opened }).opened);
  expect(opened?.target, 'the client opens in this window').toBe('_self');
  expect(new URL(opened!.url).origin + new URL(opened!.url).pathname).toBe(callbackUrl);
  expect(new URL(opened!.url).searchParams.get('code'), 'with the authorization code').toBeTruthy();
  expect(opened!.at - tapped, 'no wait of ours between the tap and the callback').toBeLessThan(2_000);
  await screenshot(consent, 'mcp-08-consent-done-while-client-connects');
});
