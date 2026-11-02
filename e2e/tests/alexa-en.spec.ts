// Job 69: the Alexa skill in English (en-US and the other en-* locales) against the local stack.
// Same signed requests and account linking as alexa.spec.ts; only the request's locale differs.
import { expect, test } from './fixtures';
import { apiAs, itemRow, newEmail, signUpWithHousehold, within } from './helpers';
import {
  addIntent,
  alexaRequest,
  linkAccount,
  postToAlexa,
  readIntent,
  registerAlexaClient,
} from './alexa-helpers';

test('Alexa in English: a linked add lands live and is read back in English', async ({ browser, baseURL }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext();
  const page = await context.newPage();
  const email = newEmail('alexa-en');
  await signUpWithHousehold(page, email);
  const english = (request: Record<string, unknown>, token?: string) =>
    postToAlexa(alexaRequest({ ...request, locale: 'en-US' }, { token, alexaUser: 'amzn1.ask.account.EN' }));
  const speech = async (request: Record<string, unknown>, token?: string) => {
    const { status, reply } = await english(request, token);
    expect(status).toBe(200);
    return reply.response.outputSpeech?.text;
  };

  expect(await speech(addIntent('milk'))).toBe(
    'Please link your Hummlist account in the Alexa app first. I sent you a card there.',
  );

  const client = await registerAlexaClient();
  const token = (await linkAccount(await context.newPage(), client, baseURL!)).access_token;

  expect(await speech({ type: 'LaunchRequest' }, token)).toBe('What should go on the list?');
  expect(await speech(addIntent('two liters of milk and eggs'), token)).toBe(
    'I put 2 liters of milk and eggs on Hummlist.',
  );
  await within(5_000, (timeout) => expect(itemRow(page, 'eggs')).toBeVisible({ timeout }));
  const { data } = await (await apiAs(email)).from('items').select('name, quantity').eq('status', 'active')
    .order('created_at');
  expect(data).toEqual([{ name: 'milk', quantity: '2 l' }, { name: 'eggs', quantity: null }]);

  expect(await speech(addIntent('milk'), token)).toBe('Already on Hummlist: 2 liters of milk.');
  expect(await speech(readIntent, token)).toBe('There are 2 things on your Hummlist: 2 liters of milk and eggs.');
});
