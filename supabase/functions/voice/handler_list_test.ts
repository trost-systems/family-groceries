// Job 207: a voice add goes to the list the request names (the `list` field or a phrase the text
// ends with), else to the caller's default list; an unknown or ambiguous name says so.
import { assertEquals } from '@std/assert';
import type { ListCatalog, ListOption } from '../_shared/list.ts';
import { type Added, type Caller, createHandler, type Deps } from './handler.ts';
import type { ParsedItem } from './parse.ts';

const main: ListOption = {
  id: '00000000-0000-4000-8000-0000000000a1',
  name: 'Einkaufsliste',
  seedKey: 'main',
};
const alltag: ListOption = {
  id: '00000000-0000-4000-8000-0000000000a2',
  name: 'Alltag',
  seedKey: null,
};
const geburtstag: ListOption = {
  id: '00000000-0000-4000-8000-0000000000a3',
  name: 'Geburtstag',
  seedKey: null,
};
const party: ListOption = {
  id: '00000000-0000-4000-8000-0000000000a4',
  name: 'Party',
  seedKey: null,
};
const party2: ListOption = {
  id: '00000000-0000-4000-8000-0000000000a5',
  name: 'party',
  seedKey: null,
};

/** Peter's household: the seeded list first, Alltag his default. */
const peters: ListCatalog = { lists: [main, alltag, geburtstag], defaultList: alltag };

function world(catalog: ListCatalog = peters, onList: string[] = []) {
  const adds: { list: string; items: ParsedItem[]; addVariants: boolean }[] = [];
  const deps: Deps = {
    authenticate: () => Promise.resolve<Caller>({ userId: 'u1', householdId: 'h1', via: 'siri' }),
    isMember: () => Promise.resolve(false),
    lists: () => Promise.resolve(catalog),
    splitItems: () => Promise.reject(new Error('not in this test')),
    log: () => {},
    addItems: (_caller, items, { list, addVariants = false }) => {
      adds.push({ list, items, addVariants });
      return Promise.resolve(items.map((item): Added => {
        const butter = item.name === 'Butter' && !addVariants;
        return {
          ...item,
          ...(butter && { name: 'Butter', brand: 'Weihenstephan', held: item }),
          brand: butter ? 'Weihenstephan' : null,
          properties: null,
          category: 'Sonstiges',
          alreadyOnList: butter || onList.includes(item.name),
          similarOnList: [],
        };
      }));
    },
  };
  const handle = createHandler(deps);
  const send = async (body: Record<string, unknown>) => {
    const res = await handle(
      new Request('http://local/voice', {
        method: 'POST',
        headers: { authorization: 'Bearer fgp_siri', 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }),
    );
    return await res.json();
  };
  return { send, adds };
}

Deno.test("Peter's sentence lands on Geburtstag as Luftballons and says so", async () => {
  const { send, adds } = world();
  const body = await send({ text: 'Luftballons zur Geburtstag Liste', lang: 'de' });
  assertEquals(adds, [{
    list: geburtstag.id,
    items: [{ name: 'Luftballons', quantity: null }],
    addVariants: false,
  }]);
  assertEquals(body.speech, 'Hinzugefügt zur Liste Geburtstag: Luftballons.');
  assertEquals(body.list, { id: geburtstag.id, name: 'Geburtstag' });
});

Deno.test('English: balloons to the Birthday list', async () => {
  const birthday: ListOption = { ...geburtstag, name: 'Birthday' };
  const { send, adds } = world({ lists: [main, birthday], defaultList: main });
  const body = await send({ text: 'balloons to the Birthday list', lang: 'en' });
  assertEquals(adds.map((a) => [a.list, a.items]), [[birthday.id, [{
    name: 'balloons',
    quantity: null,
  }]]]);
  assertEquals(body.speech, 'Added balloons to the Birthday list in Snacklist.');
});

Deno.test('without a list the add goes to the default list, not the first, and names it', async () => {
  const { send, adds } = world();
  const body = await send({ text: 'Milch und Eier', lang: 'de' });
  assertEquals(adds.map((a) => a.list), [alltag.id]);
  // Several lists: the answer says which one (review 0).
  assertEquals(body.speech, 'Hinzugefügt zur Liste Alltag: Milch, Eier.');
  assertEquals(body.list, { id: alltag.id, name: 'Alltag' });
});

Deno.test('the list field: a name or an id, and it wins over the phrase, which still leaves the text', async () => {
  const { send, adds } = world();
  await send({ text: 'Kerzen', lang: 'de', list: 'geburtstag' });
  await send({ text: 'Kerzen', lang: 'de', list: geburtstag.id });
  const body = await send({
    text: 'Kerzen zur Geburtstag Liste',
    lang: 'de',
    list: 'Einkaufsliste',
  });
  assertEquals(adds.map((a) => [a.list, a.items.map((i) => i.name)]), [
    [geburtstag.id, ['Kerzen']],
    [geburtstag.id, ['Kerzen']],
    // A list called "Einkaufsliste" is found by its name (review 0).
    [main.id, ['Kerzen']],
  ]);
  assertEquals(body.speech, 'Hinzugefügt zur Einkaufsliste: Kerzen.');
});

Deno.test('the seeded list is named in the request language', async () => {
  const { send } = world();
  const de = await send({ text: 'Kerzen', lang: 'de', list: main.id });
  const en = await send({ text: 'candles', lang: 'en', list: main.id });
  assertEquals(de.speech, 'Hinzugefügt zur Einkaufsliste: Kerzen.');
  assertEquals(en.speech, 'Added candles to the shopping list in Snacklist.');
});

Deno.test('unknown, ambiguous or gone: the default list, and the answer says why', async () => {
  const { send, adds } = world({ lists: [main, alltag, party, party2], defaultList: alltag }, [
    'Chips',
  ]);
  const cases: [Record<string, unknown>, string][] = [
    [
      { text: 'Luftballons zur Weihnachten Liste', lang: 'de' },
      'Eine Liste „Weihnachten“ habe ich nicht gefunden. Hinzugefügt zur Liste Alltag: Luftballons.',
    ],
    [
      { text: 'Luftballons', lang: 'de', list: 'Party' },
      '„Party“ passt zu mehreren Listen. Hinzugefügt zur Liste Alltag: Luftballons.',
    ],
    [
      { text: 'Chips', lang: 'de', list: '00000000-0000-4000-8000-0000000000ff' },
      'Diese Liste gibt es nicht mehr. Schon auf der Liste Alltag: Chips.',
    ],
    [
      { text: 'balloons to the Xmas list', lang: 'en' },
      "I couldn't find a list called Xmas. Added balloons to the Alltag list in Snacklist.",
    ],
    [
      { text: 'balloons', lang: 'en', list: 'party' },
      'party matches more than one list. Added balloons to the Alltag list in Snacklist.',
    ],
  ];
  for (const [body, speech] of cases) {
    const answer = await send(body);
    assertEquals(answer.speech, speech, JSON.stringify(body));
    assertEquals(answer.list, { id: alltag.id, name: 'Alltag' });
  }
  assertEquals(new Set(adds.map((a) => a.list)), new Set([alltag.id]));
});

Deno.test('Q79: the yes resends the list id and lands on the same list', async () => {
  const { send, adds } = world();
  const first = await send({ text: 'Butter zur Geburtstag Liste', lang: 'de', ask: true });
  assertEquals(first.outcome, 'confirm');
  assertEquals(
    first.question,
    'Butter Weihenstephan steht schon drauf. Soll ich Butter trotzdem dazuschreiben?',
  );
  assertEquals(first.list, { id: geburtstag.id, name: 'Geburtstag' });
  const yes = await send({ text: first.again, lang: 'de', confirmed: true, list: first.list.id });
  assertEquals(adds.map((a) => [a.list, a.addVariants]), [
    [geburtstag.id, false],
    [geburtstag.id, true],
  ]);
  assertEquals(yes.speech, 'Hinzugefügt zur Liste Geburtstag: Butter.');
});

Deno.test('Q79 on the default list: the yes with its id names it like the question', async () => {
  const { send } = world();
  const first = await send({ text: 'Butter', lang: 'de', ask: true });
  const yes = await send({ text: first.again, lang: 'de', confirmed: true, list: first.list.id });
  assertEquals(yes.speech, 'Hinzugefügt zur Liste Alltag: Butter.');
  const single = world({ lists: [main], defaultList: main });
  const once = await single.send({ text: 'Butter', lang: 'de', ask: true });
  const again = await single.send({
    text: once.again,
    lang: 'de',
    confirmed: true,
    list: once.list.id,
  });
  assertEquals(again.speech, 'Hinzugefügt: Butter.', 'one list: as before');
});
