// The skill's behaviour over HTTP with a fake database: intents, read-back, the one re-prompt,
// unlinked and revoked accounts, two households, errors and analytics (AC2-AC10). The verification
// itself is verify_test.ts; here the first test runs the real verifier to show that a refused
// request reaches nothing.
import { assert, assertEquals, assertFalse, assertStringIncludes } from '@std/assert';
import { AuthError } from '../_shared/auth.ts';
import { telemetryFor } from '../_shared/telemetry.ts';
import type { Added } from '../voice/handler.ts';
import type { ParsedItem } from '../voice/parse.ts';
import { countAdds } from './analytics.ts';
import { createHandler, type Deps, type Linked } from './handler.ts';
import { readLimit, speech } from './speech.ts';
import type { AnalyticsSubject } from './store.ts';
import { makeTestCa, testCertUrl, testSkillId } from './test_ca.ts';
import { type Envelope, verifyRequest } from './verify.ts';

const HH_A = '0a0a0a0a-0000-4000-8000-00000000000a';
const HH_B = '0b0b0b0b-0000-4000-8000-00000000000b';

/** Categories as the classifier gives them, for the fake add path. */
const categoryOf: Record<string, string> = {
  milch: 'Kühlregal',
  eier: 'Kühlregal',
  äpfel: 'Obst & Gemüse',
  weißwurst: 'Fleisch/Wurst/Fisch',
  brot: 'Brot & Backwaren',
};

interface Row {
  household: string;
  name: string;
  quantity: string | null;
  addedBy: string;
}

/** A small stand-in for the database: tokens, households, items, links. */
class World {
  rows: Row[] = [];
  /** access token -> user and session; a deleted entry is a revoked grant. */
  tokens = new Map<string, { userId: string; sessionId: string }>();
  householdOf = new Map<string, string | null>();
  links = new Map<string, Set<string>>();
  revokedSessions: string[] = [];
  reports: unknown[] = [];
  taken = new Map<string, number>();
  failAdds = false;
  failList = false;
  counted: Added[][] = [];

  link(token: string, userId: string, household: string | null, sessionId = `s-${token}`) {
    this.tokens.set(token, { userId, sessionId });
    this.householdOf.set(userId, household);
  }

  open(household: string) {
    return this.rows.filter((r) => r.household === household);
  }

  deps(over: Partial<Deps> = {}): Deps {
    return {
      verify: (_headers, body) =>
        Promise.resolve(JSON.parse(new TextDecoder().decode(body)) as Envelope),
      authenticate: (token) => {
        const owner = this.tokens.get(token);
        if (!owner) return Promise.reject(new AuthError('invalid_token', 'revoked'));
        const householdId = this.householdOf.get(owner.userId);
        if (!householdId) return Promise.reject(new AuthError('no_household', 'none'));
        return Promise.resolve({ ...owner, householdId });
      },
      takeAdds: (linked, count) => {
        const used = (this.taken.get(linked.userId) ?? 0) + count;
        if (used > 30) return Promise.resolve(false);
        this.taken.set(linked.userId, used);
        return Promise.resolve(true);
      },
      addItems: (linked: Linked, items: ParsedItem[]) => {
        if (this.failAdds) return Promise.reject(new Error('connection reset'));
        const added: Added[] = [];
        for (const item of items) {
          const existing = this.open(linked.householdId).find((r) =>
            r.name.toLowerCase() === item.name.toLowerCase()
          );
          if (!existing) {
            this.rows.push({
              household: linked.householdId,
              name: item.name,
              quantity: item.quantity,
              addedBy: linked.userId,
            });
          }
          added.push({
            ...item,
            brand: null,
            properties: null,
            category: categoryOf[item.name.toLowerCase()] ?? 'Sonstiges',
            alreadyOnList: existing !== undefined,
          });
        }
        return Promise.resolve(added);
      },
      listItems: (linked) =>
        this.failList ? Promise.reject(new Error('timeout')) : Promise.resolve(
          this.open(linked.householdId).map((r) => ({
            name: r.name,
            quantity: r.quantity,
            brand: null,
            properties: null,
          })),
        ),
      remember: (alexaUser, linked, relinked) => {
        const held = this.links.get(alexaUser) ?? new Set();
        if (relinked) {
          for (const s of held) {
            if (s !== linked.sessionId) this.revokeSession(s);
          }
          held.clear();
        }
        held.add(linked.sessionId);
        this.links.set(alexaUser, held);
        return Promise.resolve();
      },
      revoke: (alexaUser) => {
        for (const s of this.links.get(alexaUser) ?? []) this.revokeSession(s);
        this.links.delete(alexaUser);
        return Promise.resolve();
      },
      counted: (_linked, added) => {
        this.counted.push(added);
        return Promise.resolve();
      },
      report: (e) => this.reports.push(e),
      ...over,
    };
  }

  revokeSession(sessionId: string) {
    this.revokedSessions.push(sessionId);
    for (const [token, owner] of this.tokens) {
      if (owner.sessionId === sessionId) this.tokens.delete(token);
    }
  }
}

interface Ask {
  token?: string;
  user?: string;
  attributes?: Record<string, unknown>;
}

function envelope(request: Record<string, unknown>, ask: Ask = {}) {
  const user = { userId: ask.user ?? 'amzn1.ask.account.PETER', accessToken: ask.token };
  return {
    version: '1.0',
    session: {
      new: !ask.attributes,
      sessionId: 'amzn1.echo-api.session.1',
      application: { applicationId: testSkillId },
      attributes: ask.attributes,
      user,
    },
    context: { System: { application: { applicationId: testSkillId }, user } },
    request: {
      requestId: 'amzn1.echo-api.request.1',
      timestamp: new Date().toISOString(),
      locale: 'de-DE',
      ...request,
    },
  };
}

const intent = (name: string, items?: string) => ({
  type: 'IntentRequest',
  intent: {
    name,
    confirmationStatus: 'NONE',
    slots: name === 'AddItemIntent' ? { items: { name: 'items', value: items } } : undefined,
  },
});

interface AlexaReply {
  version: string;
  sessionAttributes?: Record<string, unknown>;
  response: {
    outputSpeech?: { type: string; text: string };
    reprompt?: { outputSpeech: { text: string } };
    card?: { type: string; title?: string; content?: string };
    directives?: { type: string; slotToElicit?: string; updatedIntent?: { name: string } }[];
    shouldEndSession?: boolean;
  };
}

async function send(
  deps: Deps,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<{ status: number; reply: AlexaReply }> {
  const res = await createHandler(deps)(
    new Request('http://local/alexa', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, reply: await res.json() };
}

const said = (r: AlexaReply) => r.response.outputSpeech?.text;

function linkedWorld() {
  const world = new World();
  world.link('tok-peter', 'peter', HH_A);
  world.link('tok-lea', 'lea', HH_A);
  world.link('tok-max', 'max', HH_B);
  return world;
}

Deno.test('a request the verifier refuses gets 400 and reaches nothing', async () => {
  const world = linkedWorld();
  const ca = await makeTestCa();
  const deps = world.deps({
    verify: (headers, body) =>
      verifyRequest(headers, body, {
        anchors: [ca.root],
        fetchChain: () => Promise.resolve(ca.chainPem),
        skillIds: [testSkillId],
        now: () => new Date(),
      }),
  });
  const body = JSON.stringify(
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  const unsigned = await send(deps, body);
  assertEquals(unsigned.status, 400);
  const forged = await send(deps, body, {
    signaturecertchainurl: testCertUrl,
    'signature-256': await ca.sign(body.replace('Milch', 'Bier')),
  });
  assertEquals(forged.status, 400);
  const stale = JSON.stringify({
    ...envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  }).replace(
    /"timestamp":"[^"]+"/,
    `"timestamp":"${new Date(Date.now() - 200_000).toISOString()}"`,
  );
  const late = await send(deps, stale, {
    signaturecertchainurl: testCertUrl,
    'signature-256': await ca.sign(stale),
  });
  assertEquals(late.status, 400);
  assertEquals(world.rows, [], 'nothing was added');

  // The same request, signed: it goes through.
  const ok = await send(deps, body, {
    signaturecertchainurl: testCertUrl,
    'signature-256': await ca.sign(body),
  });
  assertEquals(ok.status, 200);
  assertEquals(world.rows.map((r) => r.name), ['Milch']);
});

Deno.test('AC1/AC3: "füg Milch hinzu" adds Milch to the linked household and says so', async () => {
  const world = linkedWorld();
  const { status, reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(status, 200);
  assertEquals(said(reply), 'Ich habe Milch auf die Hummlist gesetzt.');
  assertEquals(reply.response.shouldEndSession, true);
  assertEquals(reply.response.card, {
    type: 'Simple',
    title: 'Hummlist',
    content: 'Ich habe Milch auf die Hummlist gesetzt.',
  });
  assertEquals(world.rows, [{ household: HH_A, name: 'Milch', quantity: null, addedBy: 'peter' }]);
});

Deno.test('AC2/AC3: "Milch und Eier" adds two items and reads both back', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch und Eier'), { token: 'tok-peter' }),
  );
  assertEquals(said(reply), 'Milch und Eier sind auf der Hummlist.');
  assertEquals(world.rows.map((r) => r.name), ['Milch', 'Eier']);
});

Deno.test('German input: quantities, number words, umlauts, ß, commas', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps(),
    envelope(
      intent('AddItemIntent', 'zwei Liter Milch, ein Kilo Äpfel, drei Weißwurst und Brot'),
      { token: 'tok-peter' },
    ),
  );
  assertEquals(
    said(reply),
    '2 Liter Milch, 1 Kilo Äpfel, 3 Weißwurst und Brot sind auf der Hummlist.',
  );
  assertEquals(
    world.rows.map((r) => [r.name, r.quantity]),
    [['Milch', '2 l'], ['Äpfel', '1 kg'], ['Weißwurst', '3'], ['Brot', null]],
  );
});

Deno.test('an item already open is not added twice; the read-back says so', async () => {
  const world = linkedWorld();
  await send(world.deps(), envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-lea' }));
  const { reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Eier und Milch'), { token: 'tok-peter' }),
  );
  assertEquals(
    said(reply),
    'Ich habe Eier auf die Hummlist gesetzt. Schon auf der Hummlist: Milch.',
  );
  assertEquals(world.rows.map((r) => r.name), ['Milch', 'Eier']);
  const again = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch und Eier'), { token: 'tok-peter' }),
  );
  assertEquals(said(again.reply), 'Schon auf der Hummlist: Milch und Eier.');
});

Deno.test('AC4: nothing understood gets one re-prompt, then "nicht verstanden", nothing added', async () => {
  const world = linkedWorld();
  for (const unclear of ['äh', 'bitte', '', '   ', undefined]) {
    const first = await send(
      world.deps(),
      envelope(intent('AddItemIntent', unclear), { token: 'tok-peter' }),
    );
    assertEquals(said(first.reply), speech.notUnderstoodOnce, String(unclear));
    assertEquals(first.reply.response.shouldEndSession, false);
    assertEquals(first.reply.response.reprompt?.outputSpeech.text, speech.notUnderstoodReprompt);
    assertEquals(first.reply.response.directives?.[0].type, 'Dialog.ElicitSlot');
    assertEquals(first.reply.response.directives?.[0].slotToElicit, 'items');
    assertEquals(first.reply.sessionAttributes, { retry: 1 });

    const second = await send(
      world.deps(),
      envelope(intent('AddItemIntent', 'ähm'), {
        token: 'tok-peter',
        attributes: first.reply.sessionAttributes,
      }),
    );
    assertEquals(said(second.reply), speech.notUnderstood);
    assertEquals(second.reply.response.shouldEndSession, true);
    assertEquals(second.reply.response.directives, undefined);
  }
  // The fallback intent (Alexa matched nothing) follows the same rule.
  const fallback = await send(
    world.deps(),
    envelope(intent('AMAZON.FallbackIntent'), { token: 'tok-peter' }),
  );
  assertEquals(said(fallback.reply), speech.notUnderstoodOnce);
  const fallbackAgain = await send(
    world.deps(),
    envelope(intent('AMAZON.FallbackIntent'), { token: 'tok-peter', attributes: { retry: 1 } }),
  );
  assertEquals(said(fallbackAgain.reply), speech.notUnderstood);
  assertEquals(world.rows, []);
});

Deno.test('after the re-prompt, a clear answer is added', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Eier'), { token: 'tok-peter', attributes: { retry: 1 } }),
  );
  assertEquals(said(reply), 'Ich habe Eier auf die Hummlist gesetzt.');
  assertEquals(world.rows.map((r) => r.name), ['Eier']);
});

Deno.test('AC6: without a linked account Alexa asks to link it, with the card; nothing added', async () => {
  const world = linkedWorld();
  for (
    const request of [
      intent('AddItemIntent', 'Milch'),
      intent('ReadListIntent'),
      { type: 'LaunchRequest' },
      intent('AddItemIntent', 'äh'),
    ]
  ) {
    const { status, reply } = await send(world.deps(), envelope(request));
    assertEquals(status, 200);
    assertEquals(said(reply), speech.linkAccount);
    assertEquals(reply.response.card, { type: 'LinkAccount' });
    assertEquals(reply.response.shouldEndSession, true);
  }
  assertEquals(world.rows, []);
});

Deno.test('AC8: a revoked or expired token counts as unlinked', async () => {
  const world = linkedWorld();
  world.tokens.delete('tok-peter');
  const { reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(said(reply), speech.linkAccount);
  assertEquals(reply.response.card, { type: 'LinkAccount' });
  assertEquals(world.rows, []);
});

Deno.test('AC8: disabling the skill revokes the sessions that Alexa account held', async () => {
  const world = linkedWorld();
  await send(world.deps(), envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }));
  assertEquals([...world.links.get('amzn1.ask.account.PETER')!], ['s-tok-peter']);
  const disabled = await send(world.deps(), {
    ...envelope({ type: 'AlexaSkillEvent.SkillDisabled', body: {} }),
  });
  assertEquals(disabled.status, 200);
  assertEquals(world.revokedSessions, ['s-tok-peter']);
  const after = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Eier'), { token: 'tok-peter' }),
  );
  assertEquals(said(after.reply), speech.linkAccount);
  assertEquals(world.rows.map((r) => r.name), ['Milch']);
  // Lea's own Alexa link is untouched.
  const lea = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Brot'), { token: 'tok-lea', user: 'amzn1.ask.account.LEA' }),
  );
  assertEquals(said(lea.reply), 'Ich habe Brot auf die Hummlist gesetzt.');
});

Deno.test('linking again revokes the session the Alexa account held before', async () => {
  const world = linkedWorld();
  world.link('tok-peter-2', 'peter', HH_A, 's-new');
  await send(world.deps(), envelope(intent('ReadListIntent'), { token: 'tok-peter' }));
  const linked = await send(world.deps(), {
    ...envelope({
      type: 'AlexaSkillEvent.SkillAccountLinked',
      body: { accessToken: 'tok-peter-2' },
    }),
  });
  assertEquals(linked.status, 200);
  assertEquals(world.revokedSessions, ['s-tok-peter']);
  assert(world.tokens.has('tok-peter-2'));
});

Deno.test('AC7: each linked user writes to their own current household only', async () => {
  const world = linkedWorld();
  await send(world.deps(), envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }));
  await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Bier'), { token: 'tok-max', user: 'amzn1.ask.account.MAX' }),
  );
  assertEquals(world.open(HH_A).map((r) => r.name), ['Milch']);
  assertEquals(world.open(HH_B).map((r) => r.name), ['Bier']);
  // A household id smuggled into the request changes nothing: only the token decides.
  const smuggled = envelope(intent('AddItemIntent', 'Wein'), { token: 'tok-max' });
  (smuggled.request as Record<string, unknown>).householdId = HH_A;
  (smuggled.session as Record<string, unknown>).attributes = { householdId: HH_A };
  await send(world.deps(), smuggled);
  assertEquals(world.open(HH_A).map((r) => r.name), ['Milch']);
  assertEquals(world.open(HH_B).map((r) => r.name), ['Bier', 'Wein']);

  // Max moves to Peter's household: the next add goes there.
  world.householdOf.set('max', HH_A);
  await send(world.deps(), envelope(intent('AddItemIntent', 'Eier'), { token: 'tok-max' }));
  assertEquals(world.open(HH_A).map((r) => [r.name, r.addedBy]), [
    ['Milch', 'peter'],
    ['Eier', 'max'],
  ]);
});

Deno.test('a linked user in no household gets a clear German answer; nothing added', async () => {
  const world = linkedWorld();
  world.link('tok-new', 'newbie', null);
  for (const request of [intent('AddItemIntent', 'Milch'), intent('ReadListIntent')]) {
    const { reply } = await send(world.deps(), envelope(request, { token: 'tok-new' }));
    assertEquals(said(reply), speech.noHousehold);
    assertEquals(reply.response.card, undefined);
  }
  assertEquals(world.rows, []);
});

Deno.test('a database error: a German apology, nothing added, reported', async () => {
  const world = linkedWorld();
  world.failAdds = true;
  const { status, reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(status, 200);
  assertEquals(said(reply), speech.failed);
  assertEquals(world.rows, []);
  assertEquals(world.reports.length, 1);
  world.failList = true;
  const list = await send(world.deps(), envelope(intent('ReadListIntent'), { token: 'tok-peter' }));
  assertEquals(said(list.reply), speech.listFailed);
  assertEquals(world.reports.length, 2);
  // An unexpected failure while checking the token is an apology too, not a link card.
  const broken = await send(
    world.deps({ authenticate: () => Promise.reject(new Error('db down')) }),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(said(broken.reply), speech.failed);
  assertEquals(world.reports.length, 3);
});

Deno.test('a failed link bookkeeping or analytics write does not cost the add', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps({
      remember: () => Promise.reject(new Error('x')),
      counted: () => Promise.reject(new Error('y')),
    }),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(said(reply), 'Ich habe Milch auf die Hummlist gesetzt.');
  assertEquals(world.reports.length, 2);
});

Deno.test('rate limit: 30 items a minute per user, then a German answer and nothing added', async () => {
  const world = linkedWorld();
  const thirty = Array.from({ length: 30 }, (_, i) => `Sache${i}`).join(', ');
  const first = await send(
    world.deps(),
    envelope(intent('AddItemIntent', thirty), { token: 'tok-peter' }),
  );
  assertStringIncludes(said(first.reply)!, 'sind auf der Hummlist');
  assertEquals(world.rows.length, 30);
  const more = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(said(more.reply), speech.rateLimited);
  assertEquals(world.rows.length, 30);
  // Lea has her own allowance.
  const lea = await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-lea' }),
  );
  assertEquals(said(lea.reply), 'Ich habe Milch auf die Hummlist gesetzt.');
});

Deno.test('a very long utterance: more than 30 items adds 30 and says so; over 1000 chars adds none', async () => {
  const world = linkedWorld();
  const many = Array.from({ length: 35 }, (_, i) => `Ding${i}`).join(' und ');
  const { reply } = await send(
    world.deps(),
    envelope(intent('AddItemIntent', many), { token: 'tok-peter' }),
  );
  assertEquals(world.rows.length, 30);
  assertStringIncludes(said(reply)!, speech.tooMany);
  const huge = 'Milch '.repeat(200);
  const long = await send(
    world.deps(),
    envelope(intent('AddItemIntent', huge), { token: 'tok-lea' }),
  );
  assertEquals(said(long.reply), speech.tooLong);
  assertEquals(world.rows.length, 30);
});

Deno.test('ReadListIntent: open items of the linked household, at most 10, then a count', async () => {
  const world = linkedWorld();
  const read = async (token: string) =>
    said((await send(world.deps(), envelope(intent('ReadListIntent'), { token }))).reply);
  assertEquals(await read('tok-peter'), 'Die Hummlist ist leer.');
  await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'zwei Liter Milch'), { token: 'tok-peter' }),
  );
  assertEquals(await read('tok-peter'), 'Auf der Hummlist steht eine Sache: 2 Liter Milch.');
  await send(
    world.deps(),
    envelope(intent('AddItemIntent', 'Äpfel und Weißwurst'), { token: 'tok-lea' }),
  );
  assertEquals(
    await read('tok-peter'),
    'Auf der Hummlist stehen 3 Sachen: 2 Liter Milch, Äpfel und Weißwurst.',
  );
  assertEquals(await read('tok-max'), 'Die Hummlist ist leer.', 'Max sees only his household');
  const twelve = Array.from({ length: 9 }, (_, i) => `Teil${i}`).join(', ');
  await send(world.deps(), envelope(intent('AddItemIntent', twelve), { token: 'tok-lea' }));
  const long = await read('tok-peter');
  assertEquals(
    long,
    'Auf der Hummlist stehen 12 Sachen: 2 Liter Milch, Äpfel, Weißwurst, ' +
      'Teil0, Teil1, Teil2, Teil3, Teil4, Teil5, Teil6 und 2 weitere.',
  );
  assertEquals(readLimit, 10);
  await send(world.deps(), envelope(intent('AddItemIntent', 'Teil9'), { token: 'tok-lea' }));
  assertStringIncludes((await read('tok-peter'))!, 'Teil6 und 3 weitere.');
});

Deno.test('Launch asks what to add and keeps the session open for the answer', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps(),
    envelope({ type: 'LaunchRequest' }, { token: 'tok-peter' }),
  );
  assertEquals(said(reply), 'Was soll auf die Liste?');
  assertEquals(reply.response.shouldEndSession, false);
  assertEquals(reply.response.directives?.[0].updatedIntent?.name, 'AddItemIntent');
  assertEquals(reply.response.reprompt?.outputSpeech.text, speech.launchReprompt);
});

Deno.test('Help, Stop, Cancel, NavigateHome, SessionEnded and unknown requests', async () => {
  const world = linkedWorld();
  const help = await send(world.deps(), envelope(intent('AMAZON.HelpIntent')));
  assertStringIncludes(said(help.reply)!, 'Hummlist');
  assertEquals(help.reply.response.shouldEndSession, false);
  for (const name of ['AMAZON.StopIntent', 'AMAZON.CancelIntent', 'AMAZON.NavigateHomeIntent']) {
    const { reply } = await send(world.deps(), envelope(intent(name)));
    assertEquals(said(reply), 'Bis bald.');
    assertEquals(reply.response.shouldEndSession, true);
  }
  for (
    const type of ['SessionEndedRequest', 'System.ExceptionEncountered', 'CanFulfillIntentRequest']
  ) {
    const { status, reply } = await send(
      world.deps(),
      envelope({ type, reason: 'USER_INITIATED' }),
    );
    assertEquals(status, 200);
    assertEquals(reply, { version: '1.0', response: {} });
  }
  const unknown = await send(
    world.deps(),
    envelope(intent('SomethingElseIntent'), { token: 'tok-peter' }),
  );
  assertEquals(said(unknown.reply), speech.notUnderstoodOnce);
  const get = await createHandler(world.deps())(new Request('http://local/alexa'));
  assertEquals(get.status, 405);
});

Deno.test('the skill name is Hummlist in full in every reply, never Humm alone', () => {
  for (const text of Object.values(speech)) {
    assertFalse(/\bHumm\b/.test(text), text);
  }
  assertEquals(speech.cardTitle, 'Hummlist');
});

// AC9/AC10 -----------------------------------------------------------------------------------

const KEY = 'phc_testprojectkey0123456789';
const INSTALL = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

function recorder() {
  const sent: { batch: Record<string, unknown>[] }[] = [];
  const fetchImpl = ((_url: string, init?: RequestInit) => {
    sent.push(JSON.parse(String(init?.body)));
    return Promise.resolve(new Response('{}'));
  }) as typeof fetch;
  const t = telemetryFor(
    'alexa',
    { get: (k) => ({ POSTHOG_PROJECT_API_KEY: KEY, POSTHOG_HOST: 'https://eu.i.posthog.com' })[k] },
    fetchImpl,
  );
  return { sent, t };
}

const added = (name: string, alreadyOnList = false): Added => ({
  name,
  quantity: null,
  brand: null,
  properties: null,
  category: 'Kühlregal',
  alreadyOnList,
});

Deno.test('AC10: with consent, one item_added (source alexa) per new item, no names', async () => {
  const { sent, t } = recorder();
  const subject: AnalyticsSubject = {
    installId: INSTALL,
    internal: false,
    householdId: HH_A,
    role: 'member',
    householdSize: 2,
  };
  assertEquals(countAdds(t, subject, [added('Milch'), added('Weißwurst'), added('Eier', true)]), 2);
  await t.flush();
  const batch = sent[0].batch;
  assertEquals(batch.map((e) => e.event), ['item_added', 'item_added']);
  const props = batch[0].properties as Record<string, unknown>;
  assertEquals(props.source, 'alexa');
  assertEquals(props.distinct_id, INSTALL);
  assertEquals(props.actor_role, 'member');
  assertEquals(props.household_size, 2);
  const text = JSON.stringify(sent);
  for (const name of ['Milch', 'Weißwurst', 'Eier', 'Kühlregal']) {
    assertFalse(text.includes(name), `no "${name}" in the events`);
  }
});

Deno.test('AC10: without consent (or a latest no) nothing is counted', async () => {
  const { sent, t } = recorder();
  assertEquals(countAdds(t, null, [added('Milch')]), 0);
  await t.flush();
  assertEquals(sent, []);
});

Deno.test('AC9: an error is reported scrubbed: no item names, tokens or household', async () => {
  const { sent, t } = recorder();
  const world = linkedWorld();
  const handler = createHandler(
    world.deps({
      addItems: () => Promise.reject(new TypeError('cannot add "Weißwurst" for household ' + HH_A)),
      report: (e) => t.exception(e),
    }),
  );
  const res = await handler(
    new Request('http://local/alexa', {
      method: 'POST',
      body: JSON.stringify(envelope(intent('AddItemIntent', 'Weißwurst'), { token: 'tok-peter' })),
    }),
  );
  assertEquals((await res.json()).response.outputSpeech.text, speech.failed);
  await t.flush();
  const [exception] = sent[0].batch;
  assertEquals(exception.event, '$exception');
  const props = exception.properties as Record<string, unknown>;
  assertEquals(props.function_name, 'alexa');
  const text = JSON.stringify(exception);
  for (const secret of ['Weißwurst', 'tok-peter', HH_A, 'amzn1.ask.account']) {
    assertFalse(text.includes(secret), `no "${secret}" in the report`);
  }
});

Deno.test('the server adding nothing (its parser found no item) is "nicht verstanden"', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps({ addItems: () => Promise.resolve([]) }),
    envelope(intent('AddItemIntent', 'Milch'), { token: 'tok-peter' }),
  );
  assertEquals(said(reply), speech.notUnderstood);
});

Deno.test('a lowercase utterance (as Alexa may hear it) is stored with German capitals', async () => {
  const world = linkedWorld();
  const { reply } = await send(
    world.deps(),
    envelope(
      intent('AddItemIntent', 'milch, zwei liter hafermilch, äpfel und milch ohne laktose'),
      {
        token: 'tok-peter',
      },
    ),
  );
  assertEquals(
    world.rows.map((r) => [r.name, r.quantity]),
    [['Milch', null], ['Hafermilch', '2 l'], ['Äpfel', null], ['Milch ohne Laktose', null]],
  );
  assertEquals(
    said(reply),
    'Milch, 2 Liter Hafermilch, Äpfel und Milch ohne Laktose sind auf der Hummlist.',
  );
  // Heard with capitals: left as heard (the Siri splitter capitalizes the first letter only).
  const asHeard = linkedWorld();
  await send(
    asHeard.deps(),
    envelope(intent('AddItemIntent', 'rote Paprika und Milch von der Weide'), {
      token: 'tok-peter',
    }),
  );
  assertEquals(asHeard.rows.map((r) => r.name), ['Rote Paprika', 'Milch von der Weide']);
});
