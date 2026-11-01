// AC11 and the skill package's structure (alexa/skill-package, alexa/account-linking.json): the
// rules ASK CLI's and certification's checks apply, checked locally since nothing here talks to
// Amazon (docs/ALEXA.md, "Skill package").
import { assert, assertEquals, assertFalse } from '@std/assert';
import skill from '../../../alexa/skill-package/skill.json' with { type: 'json' };
import model from '../../../alexa/skill-package/interactionModels/custom/de-DE.json' with {
  type: 'json',
};
import linking from '../../../alexa/account-linking.json' with { type: 'json' };
import resources from '../../../alexa/ask-resources.json' with { type: 'json' };
import { createHandler, type Deps } from './handler.ts';
import { speech } from './speech.ts';
import { testSkillId } from './test_ca.ts';

const language = model.interactionModel.languageModel;
const locale = skill.manifest.publishingInformation.locales['de-DE'];

/** Every string anywhere in a JSON value. */
const strings = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
    ? value.flatMap(strings)
    : value && typeof value === 'object'
    ? Object.values(value).flatMap(strings)
    : [];

Deno.test('AC11: skill name "Hummlist", invocation name "hummlist", never "Humm" alone', () => {
  assertEquals(locale.name, 'Hummlist');
  assertEquals(language.invocationName, 'hummlist');
  assertEquals(Object.keys(skill.manifest.publishingInformation.locales), ['de-DE']);
  for (const text of [...strings(skill), ...strings(model), ...strings(linking)]) {
    assertFalse(/\bhumm\b/i.test(text), `"Humm" alone in: ${text}`);
  }
});

Deno.test('manifestVersion sits inside manifest, where ask deploy keeps it', () => {
  // At the top level, ask deploy uploaded the manifest without it (job 31b).
  assertEquals(Object.keys(skill), ['manifest']);
  assertEquals(skill.manifest.manifestVersion, '1.0');
});

Deno.test('the manifest points Alexa and skill events at the alexa function', () => {
  const endpoint = 'https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/alexa';
  assertEquals(skill.manifest.apis.custom.endpoint, {
    uri: endpoint,
    sslCertificateType: 'Wildcard',
  });
  assertEquals(skill.manifest.events.endpoint.uri, endpoint);
  assertEquals(
    skill.manifest.events.subscriptions.map((s) => s.eventName).sort(),
    ['SKILL_ACCOUNT_LINKED', 'SKILL_DISABLED'],
  );
  assertEquals(resources.profiles.default.skillMetadata.src, './skill-package');
  for (const icon of [locale.smallIconUri, locale.largeIconUri]) {
    assert(icon.startsWith('file://assets/images/de-DE_'), icon);
  }
  assert(
    skill.manifest.privacyAndCompliance.locales['de-DE'].privacyPolicyUrl.startsWith('https://'),
  );
  assert(locale.summary.length <= 160, 'summary: at most 160 characters');
  assert(locale.description.length <= 4000, 'description: at most 4000 characters');
});

/** A sample as Alexa matches it: lowercase words, slots as {name}. */
const words = (sample: string) =>
  sample.toLowerCase().replace(/[,.!?]/g, '').split(/\s+/).filter(Boolean);

function matchesSample(phrase: string, samples: readonly string[]): boolean {
  const said = words(phrase);
  return samples.some((sample) => {
    const pattern = words(sample).map((w) =>
      w.startsWith('{') ? '(.+)' : w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    return new RegExp(`^${pattern.join(' ')}$`).test(said.join(' '));
  });
}

Deno.test('every example phrase is "Alexa, <verb> Hummlist, ..." and matches a sample', () => {
  const phrases = locale.examplePhrases;
  assert(phrases.length >= 1 && phrases.length <= 3);
  const samples = language.intents.flatMap((i) => i.samples);
  for (const phrase of phrases) {
    const m = /^Alexa, (sag|frag|öffne|starte) Hummlist(?:, (.+))?$/.exec(phrase);
    assert(m, `example phrase shape: ${phrase}`);
    if (m[2]) assert(matchesSample(m[2], samples), `no sample matches "${m[2]}"`);
  }
  // The spec's own sentences.
  assert(matchesSample('füg Milch und Eier hinzu', samples));
  assert(matchesSample('was auf der Liste steht', samples));
});

Deno.test('the interaction model: required built-ins, one SearchQuery with carrier phrases', () => {
  const names = language.intents.map((i) => i.name);
  for (
    const required of [
      'AMAZON.HelpIntent',
      'AMAZON.StopIntent',
      'AMAZON.CancelIntent',
      'AMAZON.NavigateHomeIntent',
      'AMAZON.FallbackIntent',
      'AddItemIntent',
      'ReadListIntent',
    ]
  ) assert(names.includes(required), required);
  assertEquals(new Set(names).size, names.length);

  const add = language.intents.find((i) => i.name === 'AddItemIntent')!;
  assertEquals(add.slots, [{ ...add.slots![0], name: 'items', type: 'AMAZON.SearchQuery' }]);
  const all = language.intents.flatMap((i) => i.samples.map((s) => [i.name, s] as const));
  const seen = new Set<string>();
  for (const [intent, sample] of all) {
    assert(/^[a-zäöüß{} ]+$/.test(sample), `letters, spaces and slots only: "${sample}"`);
    assertFalse(seen.has(sample), `sample used twice: "${sample}"`);
    seen.add(sample);
    const slots = sample.match(/\{(\w+)\}/g) ?? [];
    if (intent === 'AddItemIntent') {
      assertEquals(slots, ['{items}'], sample);
      assert(words(sample).length > 1, `SearchQuery needs a carrier phrase: "${sample}"`);
    } else {
      assertEquals(slots, [], sample);
    }
  }
  // Slot samples (answers to "Was soll auf die Liste?") may be the slot alone.
  assert(add.slots![0].samples!.includes('{items}'));
});

Deno.test('the dialog model elicits the items with a prompt that exists', () => {
  const dialog = model.interactionModel.dialog.intents.find((i) => i.name === 'AddItemIntent')!;
  const slot = dialog.slots[0];
  assertEquals(slot.name, 'items');
  const prompt = model.interactionModel.prompts.find((p) => p.id === slot.prompts.elicitation);
  assertEquals(prompt?.variations[0].value, speech.launch);
});

Deno.test('every intent of the model has its own answer in the handler', async () => {
  const deps = {
    verify: (_h: Headers, body: Uint8Array) =>
      Promise.resolve(JSON.parse(new TextDecoder().decode(body))),
    authenticate: () => Promise.resolve({ userId: 'u', householdId: 'h', sessionId: 's' }),
    requirePremium: () => Promise.resolve('open'),
    takeAdds: () => Promise.resolve(true),
    addItems: () => Promise.resolve([]),
    listItems: () => Promise.resolve([]),
    remember: () => Promise.resolve(),
    revoke: () => Promise.resolve(),
    counted: () => Promise.resolve(),
    report: () => {},
  } as unknown as Deps;
  const handler = createHandler(deps);
  for (const intent of language.intents) {
    const res = await handler(
      new Request('http://local/alexa', {
        method: 'POST',
        body: JSON.stringify({
          version: '1.0',
          context: {
            System: { application: { applicationId: testSkillId }, user: { accessToken: 't' } },
          },
          request: {
            type: 'IntentRequest',
            timestamp: new Date().toISOString(),
            intent: { name: intent.name, slots: { items: { name: 'items', value: 'Milch' } } },
          },
        }),
      }),
    );
    const text = (await res.json()).response.outputSpeech.text as string;
    if (intent.name === 'AMAZON.FallbackIntent') assertEquals(text, speech.notUnderstoodOnce);
    else assert(text !== speech.notUnderstoodOnce, `${intent.name} is not handled`);
  }
});

Deno.test('account linking: auth code with PKCE S256 against Supabase Auth, no secret in the repo', () => {
  const request = linking.accountLinkingRequest;
  assertEquals(request.type, 'AUTH_CODE');
  assertEquals(
    request.authorizationUrl,
    'https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/oauth/authorize',
  );
  assertEquals(
    request.accessTokenUrl,
    'https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/oauth/token',
  );
  assertEquals(request.accessTokenScheme, 'HTTP_BASIC');
  assertEquals(request.pkceConfiguration, { status: 'ENABLED', codeChallengeMethod: 'S256' });
  assertFalse('clientSecret' in request, 'the client secret is set at deploy time only');
  assertEquals(request.clientId, 'REPLACE_WITH_CLIENT_ID');
});
