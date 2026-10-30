// Job 31 (Spec #7): the Alexa skill against the local stack. Alexa itself is not in the loop:
// requests are built and signed the way Alexa sends them (alexa-helpers.ts, a test CA the local
// function trusts), and account linking runs the flow the Alexa app runs, through the app's real
// consent page. The device checks are docs/NEEDS_PETER.md's beta checklist.
import { expect, test } from './fixtures';
import {
  addField,
  addItem,
  adminClient,
  apiAs,
  createInviteCode,
  itemRow,
  newEmail,
  openMore,
  screenshot,
  signUp,
  signUpWithHousehold,
  within,
} from './helpers';
import {
  addIntent,
  alexaRequest,
  linkAccount,
  note,
  postToAlexa,
  readIntent,
  registerAlexaClient,
  say,
  tokenRequest,
} from './alexa-helpers';

const linkCard = { type: 'LinkAccount' };
const linkSpeech =
  'Bitte verknüpfe zuerst dein Hummlist-Konto in der Alexa-App. Ich habe dir dort eine Karte dazu geschickt.';

async function openNames(email: string): Promise<[string, string][]> {
  const api = await apiAs(email);
  const { data, error } = await api.from('items').select('name, categories(name)').eq('status', 'active')
    .order('created_at');
  expect(error).toBeNull();
  return (data as unknown as { name: string; categories: { name: string } }[]).map((r) => [r.name, r.categories.name]);
}

async function userId(email: string): Promise<string> {
  return (await (await apiAs(email)).auth.getUser()).data.user!.id;
}

test('Alexa: link with a confidential client, then adds land live for another member; unlinking in the app cuts Alexa off', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const peterContext = await browser.newContext();
  const peter = await peterContext.newPage();
  const lea = await (await browser.newContext()).newPage();
  const peterEmail = newEmail('alexa-peter');
  const leaEmail = newEmail('alexa-lea');
  await signUpWithHousehold(peter, peterEmail);
  const code = await createInviteCode(peter);
  await signUp(lea, leaEmail);
  expect((await (await apiAs(leaEmail)).rpc('join_household', { p_code: code })).error).toBeNull();
  await lea.goto('/');
  await expect(addField(lea)).toBeVisible();

  // AC6: not linked yet: Alexa asks to link in the Alexa app and adds nothing.
  const unlinked = await postToAlexa(alexaRequest(addIntent('Milch')));
  expect(unlinked.status).toBe(200);
  expect(unlinked.reply.response.outputSpeech?.text).toBe(linkSpeech);
  expect(unlinked.reply.response.card).toEqual(linkCard);

  // Account linking: authorization code + PKCE with a confidential client and Alexa's redirect.
  note(`--- ${new Date().toISOString()} account linking (local stack, Supabase Auth OAuth 2.1 server)`);
  const client = await registerAlexaClient();
  const tokens = await linkAccount(await peterContext.newPage(), client, baseURL!, {
    screenshotAs: (page) => screenshot(page, 'alexa-01-consent'),
  });
  // Renewal as Alexa does it when the access token expires; a wrong secret gets nothing.
  const wrong = await tokenRequest({ ...client, clientSecret: 'not-the-secret' }, {
    grant_type: 'refresh_token',
    refresh_token: tokens.refresh_token,
  });
  expect(wrong.status, 'the client secret is checked').not.toBe(200);
  const renewed = await tokenRequest(client, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  expect(renewed.status).toBe(200);
  expect(renewed.body.refresh_token).toBeTruthy();
  const token = renewed.body.access_token;

  // AC1/AC3: "Alexa, sag Hummlist, füg Milch hinzu": read back, and on Lea's screen within 5 s.
  // Alexa may hand the words over in lowercase; the list gets "Milch" as typed in German.
  expect(await say(token, 'milch')).toBe('Ich habe Milch auf die Hummlist gesetzt.');
  await within(5_000, (timeout) => expect(itemRow(lea, 'Milch'), 'an Alexa add shows up for another member').toBeVisible({ timeout }));

  // Several items, quantities, umlauts and ß; a duplicate of an open item is not added twice.
  expect(await say(token, 'Milch, zwei Liter Hafermilch, Äpfel und Weißwurst'))
    .toBe('2 Liter Hafermilch, Äpfel und Weißwurst sind auf der Hummlist. Schon auf der Hummlist: Milch.');
  await within(5_000, (timeout) => expect(itemRow(lea, 'Weißwurst')).toBeVisible({ timeout }));
  await expect(itemRow(lea, 'Hafermilch')).toHaveAccessibleName(/^Hafermilch (Neu )?2 l$/);
  await expect(itemRow(lea, 'Milch')).toHaveCount(1);
  expect(await openNames(leaEmail)).toEqual([
    ['Milch', 'Kühlregal'],
    ['Hafermilch', 'Kühlregal'],
    ['Äpfel', 'Obst & Gemüse'],
    ['Weißwurst', 'Fleisch/Wurst/Fisch'],
  ]);
  // Attributed to the speaker, Peter.
  const { data: byPeter } = await (await apiAs(leaEmail)).from('items').select('added_by').eq('name', 'Weißwurst').single();
  expect(byPeter!.added_by).toBe(await userId(peterEmail));
  await screenshot(lea, 'alexa-02-lea-sees-alexa-adds');

  // ReadListIntent: "Alexa, frag Hummlist, was auf der Liste steht".
  const read = await postToAlexa(alexaRequest(readIntent, { token }));
  expect(read.reply.response.outputSpeech?.text).toMatch(/^Auf der Hummlist stehen 4 Sachen: /);
  for (const name of ['Milch', '2 Liter Hafermilch', 'Äpfel', 'Weißwurst']) {
    expect(read.reply.response.outputSpeech?.text).toContain(name);
  }

  // AC4: one re-prompt, then "nicht verstanden"; nothing added.
  const first = await postToAlexa(alexaRequest(addIntent('äh'), { token }));
  expect(first.reply.response.outputSpeech?.text).toBe('Das habe ich nicht verstanden. Was soll auf die Liste?');
  expect(first.reply.response.shouldEndSession).toBe(false);
  const second = await postToAlexa(alexaRequest(addIntent('ähm bitte'), { token, attributes: first.reply.sessionAttributes }));
  expect(second.reply.response.outputSpeech?.text)
    .toBe('Das habe ich leider nicht verstanden. Ich habe nichts auf die Hummlist gesetzt.');
  expect(await openNames(leaEmail)).toHaveLength(4);

  // AC8: Peter disconnects Alexa in Zugänge: the next request is treated as unlinked.
  await openMore(peter, 'Zugänge');
  await expect(peter.getByText('Amazon Alexa').first()).toBeVisible();
  await screenshot(peter, 'alexa-03-zugaenge-alexa');
  await peter.getByRole('button', { name: 'Amazon Alexa trennen' }).click();
  await peter.getByRole('button', { name: 'Trennen', exact: true }).click();
  await expect(peter.getByText('Noch keine App verbunden.')).toBeVisible();
  const cut = await postToAlexa(alexaRequest(addIntent('Brot'), { token }));
  expect(cut.reply.response.outputSpeech?.text).toBe(linkSpeech);
  expect(cut.reply.response.card).toEqual(linkCard);
  const refresh = await tokenRequest(client, { grant_type: 'refresh_token', refresh_token: renewed.body.refresh_token });
  expect(refresh.status, 'the refresh token is revoked as well').not.toBe(200);
  expect(await openNames(leaEmail)).toHaveLength(4);
});

test('Alexa: two households stay apart, a household switch moves the adds, disabling the skill revokes it, forged requests change nothing', async ({ browser, baseURL }) => {
  test.setTimeout(240_000);
  const maxContext = await browser.newContext();
  const max = await maxContext.newPage();
  const nina = await (await browser.newContext()).newPage();
  const maxEmail = newEmail('alexa-max');
  const ninaEmail = newEmail('alexa-nina');
  await signUpWithHousehold(max, maxEmail);
  await signUpWithHousehold(nina, ninaEmail);
  // Typed in the app: the reference categories (AC2).
  await addItem(nina, 'Milch');
  await addItem(nina, 'Eier');
  const typed = await openNames(ninaEmail);

  const client = await registerAlexaClient();
  const tokens = await linkAccount(await maxContext.newPage(), client, baseURL!);
  const token = tokens.access_token;
  const alexaUser = 'amzn1.ask.account.MAX';

  // AC2: two items, categorized as typed in the app.
  expect(await say(token, 'Milch und Eier', { alexaUser })).toBe('Milch und Eier sind auf der Hummlist.');
  expect(await openNames(maxEmail)).toEqual(typed);
  await within(5_000, (timeout) => expect(itemRow(max, 'Eier')).toBeVisible({ timeout }));

  // AC7: Max's adds never reach Nina's household, whatever the request says.
  const { data: ninas } = await (await apiAs(ninaEmail)).from('household_members').select('household_id').single();
  const smuggled = alexaRequest(addIntent('Bier'), { token, alexaUser, attributes: { householdId: ninas!.household_id } });
  (smuggled.request as Record<string, unknown>).householdId = ninas!.household_id;
  expect((await postToAlexa(smuggled)).status).toBe(200);
  expect((await openNames(ninaEmail)).map(([n]) => n)).toEqual(['Milch', 'Eier']);
  expect((await openNames(maxEmail)).map(([n]) => n)).toEqual(['Milch', 'Eier', 'Bier']);

  // AC5: unsigned, tampered and stale requests are refused with 400 and add nothing.
  const unsigned = await postToAlexa(alexaRequest(addIntent('Wein'), { token, alexaUser }), { sign: false });
  expect(unsigned.status).toBe(400);
  const tampered = await postToAlexa(alexaRequest(addIntent('Wein'), { token, alexaUser }), {
    tamper: (raw) => raw.replace('Wein', 'Sekt'),
  });
  expect(tampered.status).toBe(400);
  const stale = await postToAlexa(alexaRequest(addIntent('Wein'), { token, alexaUser, skew: -200_000 }));
  expect(stale.status).toBe(400);
  const otherSkill = alexaRequest(addIntent('Wein'), { token, alexaUser });
  otherSkill.context.System.application.applicationId = 'amzn1.ask.skill.someone-else';
  expect((await postToAlexa(otherSkill)).status).toBe(400);
  expect((await openNames(maxEmail)).map(([n]) => n)).toEqual(['Milch', 'Eier', 'Bier']);

  // Max moves to Nina's household: his next Alexa add goes there, live in Nina's app.
  const code = await createInviteCode(nina);
  expect((await (await apiAs(maxEmail)).rpc('join_household', { p_code: code })).error).toBeNull();
  expect(await say(token, 'Brot', { alexaUser })).toBe('Ich habe Brot auf die Hummlist gesetzt.');
  await within(5_000, (timeout) => expect(itemRow(nina, 'Brot')).toBeVisible({ timeout }));
  expect((await openNames(ninaEmail)).map(([n]) => n)).toEqual(['Milch', 'Eier', 'Brot']);
  await screenshot(nina, 'alexa-04-after-household-switch');

  // AC8: disabling the skill in the Alexa app (AlexaSkillEvent.SkillDisabled, no token in it)
  // revokes the session Max's Alexa account held: the token and its refresh token stop working.
  const disabled = await postToAlexa(alexaRequest({ type: 'AlexaSkillEvent.SkillDisabled', body: {} }, { alexaUser }));
  expect(disabled.status).toBe(200);
  const after = await postToAlexa(alexaRequest(addIntent('Wein'), { token, alexaUser }));
  expect(after.reply.response.outputSpeech?.text).toBe(linkSpeech);
  const refresh = await tokenRequest(client, { grant_type: 'refresh_token', refresh_token: tokens.refresh_token });
  expect(refresh.status).not.toBe(200);
  expect((await openNames(ninaEmail)).map(([n]) => n)).toEqual(['Milch', 'Eier', 'Brot']);
});

test('the app records each install\'s analytics answer for server events (AC10)', async ({ browser }) => {
  const yes = await (await browser.newContext()).newPage();
  const no = await (await browser.newContext()).newPage();
  const yesEmail = newEmail('alexa-consent-yes');
  const noEmail = newEmail('alexa-consent-no');
  await signUp(yes, yesEmail, '/', { consent: 'accept' });
  await signUp(no, noEmail, '/', { consent: 'decline' });
  const admin = adminClient();
  for (const [email, consent] of [[yesEmail, true], [noEmail, false]] as const) {
    const id = await userId(email);
    await expect.poll(async () => {
      const { data } = await admin.from('analytics_consents').select('consent').eq('user_id', id);
      return data?.map((r) => r.consent);
    }, { message: `${email}'s answer reaches the server` }).toEqual([consent]);
  }
});
