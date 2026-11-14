import { assertEquals } from '@std/assert';
import type { ListCatalog, ListOption } from './list.ts';
import {
  type ListWish,
  matchList,
  type SpokenLang,
  takeListPhrase,
  targetOf,
  wishOf,
} from './spoken_list.ts';
import { parseSentence } from '../voice/parse.ts';
import { parseEnglish } from '../voice/parse_en.ts';

const list = (id: string, name: string, seedKey: string | null = null): ListOption => ({
  id,
  name,
  seedKey,
});
const main = list('00000000-0000-4000-8000-000000000001', 'Einkaufsliste', 'main');
const alltag = list('00000000-0000-4000-8000-000000000002', 'Alltag');
const geburtstag = list('00000000-0000-4000-8000-000000000003', 'Geburtstag');
const baumarkt = list('00000000-0000-4000-8000-000000000004', 'Baumarkt');
const party = list('00000000-0000-4000-8000-000000000005', 'Party');
const partys = list('00000000-0000-4000-8000-000000000006', 'party');
const birthday = list('00000000-0000-4000-8000-000000000007', 'Birthday');
const geburtstagsparty = list('00000000-0000-4000-8000-000000000008', 'Geburtstagsparty');

const peters = [alltag, geburtstag];
const many = [main, alltag, geburtstag, baumarkt, party, birthday];

Deno.test('matchList: exact, case-insensitive, fuzzy, suffix stripped, generic, ambiguous, unknown', () => {
  const cases: [string, readonly ListOption[], string, ReturnType<typeof matchList>][] = [
    ['exact', many, 'Geburtstag', { kind: 'found', list: geburtstag }],
    ['case-insensitive', many, 'geburtstag', { kind: 'found', list: geburtstag }],
    ['trailing Liste', many, 'Geburtstag Liste', { kind: 'found', list: geburtstag }],
    ['trailing -Liste', many, 'Baumarkt-Liste', { kind: 'found', list: baumarkt }],
    ['glued liste', many, 'Geburtstagsliste', { kind: 'found', list: geburtstag }],
    ['split liste', many, 'geburtstags liste', { kind: 'found', list: geburtstag }],
    ['article', many, 'die Baumarkt Liste', { kind: 'found', list: baumarkt }],
    ['trailing List', many, 'the Birthday list', { kind: 'found', list: birthday }],
    ['one-letter typo', many, 'Baumarkd', { kind: 'found', list: baumarkt }],
    ['umlaut folded', [list('x', 'Drogerie Müller')], 'drogerie mueller', {
      kind: 'found',
      list: list('x', 'Drogerie Müller'),
    }],
    ['contained, 4+ letters', [alltag, geburtstagsparty], 'Party', {
      kind: 'found',
      list: geburtstagsparty,
    }],
    ['exact beats fuzzy', [party, geburtstagsparty], 'Party', { kind: 'found', list: party }],
    ['generic Liste', many, 'Liste', { kind: 'none' }],
    ['a list called Einkaufsliste is found by its name', many, 'Einkaufsliste', {
      kind: 'found',
      list: main,
    }],
    ['generic app name', many, 'Snacklist', { kind: 'none' }],
    ['generic snack list', many, 'snack list', { kind: 'none' }],
    ['generic shopping list', many, 'my shopping list', { kind: 'none' }],
    ['generic empty', many, '  ', { kind: 'none' }],
    ['two exact', [alltag, party, partys], 'Party', { kind: 'ambiguous' }],
    ['fuzzy tie', [list('a', 'Partyx'), list('b', 'Partyz')], 'Partyy', { kind: 'ambiguous' }],
    ['unknown', many, 'Weihnachten', { kind: 'unknown' }],
    ['three letters, one off', [list('a', 'Bau')], 'Bad', { kind: 'unknown' }],
  ];
  for (const [name, options, said, expected] of cases) {
    assertEquals(matchList(options, said), expected, name);
  }
});

Deno.test('takeListPhrase: the list phrase at the end of the text', () => {
  const cases: [
    SpokenLang,
    readonly ListOption[],
    string,
    { text: string; said: string | null },
  ][] = [
    ['de', peters, 'Luftballons zur Geburtstag Liste', { text: 'Luftballons', said: 'Geburtstag' }],
    ['de', peters, 'Füge Luftballons zur Geburtstag Liste hinzu.', {
      text: 'Füge Luftballons',
      said: 'Geburtstag',
    }],
    ['de', peters, 'luftballons zur geburtstag-liste', { text: 'luftballons', said: 'geburtstag' }],
    ['de', peters, 'Kerzen und Luftballons zur Geburtstagsliste', {
      text: 'Kerzen und Luftballons',
      said: 'Geburtstags',
    }],
    ['de', peters, 'Milch, Brot auf die Geburtstag Liste setzen', {
      text: 'Milch, Brot',
      said: 'Geburtstag',
    }],
    ['de', peters, 'Kerzen in die Geburtstag Liste', { text: 'Kerzen', said: 'Geburtstag' }],
    ['de', peters, 'Kerzen auf die Liste Geburtstag', { text: 'Kerzen', said: 'Geburtstag' }],
    ['de', peters, 'Kerzen zu Geburtstag dazu', { text: 'Kerzen', said: 'Geburtstag' }],
    ['de', peters, 'Kerzen auf Geburtstag', { text: 'Kerzen', said: 'Geburtstag' }],
    // A marked phrase is taken even when the name is unknown: the caller says so.
    ['de', peters, 'Luftballons zur Party Liste', { text: 'Luftballons', said: 'Party' }],
    // Bare names are taken only when they find a list.
    ['de', peters, 'Brot zu Hause', { text: 'Brot zu Hause', said: null }],
    ['de', peters, 'Milch auf die Liste Eier', { text: 'Milch auf die Liste Eier', said: null }],
    // Generic phrases name no list.
    ['de', peters, 'Milch zur Liste', { text: 'Milch', said: null }],
    ['de', peters, 'Milch auf die Einkaufsliste', { text: 'Milch', said: null }],
    ['de', peters, 'Milch auf die Snacklist', { text: 'Milch auf die Snacklist', said: null }],
    ['de', peters, 'Milch und Eier', { text: 'Milch und Eier', said: null }],
    ['de', peters, 'Gurken, Geburtstag Liste', { text: 'Gurken, Geburtstag Liste', said: null }],
    ['en', [alltag, birthday], 'balloons to the Birthday list', {
      text: 'balloons',
      said: 'Birthday',
    }],
    ['en', [alltag, birthday], 'add balloons onto the birthday list please', {
      text: 'add balloons',
      said: 'birthday',
    }],
    ['en', [alltag, birthday], 'balloons to my Birthday list', {
      text: 'balloons',
      said: 'Birthday',
    }],
    ['en', [alltag, birthday], 'balloons to Birthday', { text: 'balloons', said: 'Birthday' }],
    ['en', [alltag, birthday], 'balloons onto birthday', { text: 'balloons', said: 'birthday' }],
    ['en', [alltag, birthday], 'milk to my shopping list', { text: 'milk', said: null }],
    ['en', [alltag, birthday], 'go to town', { text: 'go to town', said: null }],
  ];
  for (const [lang, options, text, expected] of cases) {
    assertEquals(takeListPhrase(text, lang, options), expected, text);
  }
});

Deno.test('the items left after a generic phrase are the ones the parser read from the whole text', () => {
  const parsers = { de: parseSentence, en: parseEnglish };
  const cases: [SpokenLang, string][] = [
    ['de', 'Milch zur Liste'],
    ['de', 'Milch und Eier auf die Einkaufsliste setzen'],
    ['de', 'Milch auf die Liste'],
    ['en', 'milk and eggs to my shopping list'],
    ['en', 'milk to the list'],
  ];
  for (const [lang, text] of cases) {
    const rest = takeListPhrase(text, lang, peters).text;
    assertEquals(parsers[lang](rest), parsers[lang](text), text);
  }
});

Deno.test("Peter's sentence: Luftballons land on Geburtstag, not as one long item on Alltag", () => {
  const catalog: ListCatalog = { lists: peters, defaultList: alltag };
  const { text, said } = takeListPhrase('Luftballons zur Geburtstag Liste', 'de', peters);
  assertEquals(parseSentence(text), [{ name: 'Luftballons', quantity: null }]);
  assertEquals(targetOf(catalog, wishOf(said)), { kind: 'named', list: geburtstag });
});

Deno.test('targetOf: the named list, else the default list and why', () => {
  // The default is the catalog's, not the first list.
  const catalog: ListCatalog = {
    lists: [main, alltag, geburtstag, party, partys],
    defaultList: alltag,
  };
  const cases: [ListWish, ReturnType<typeof targetOf>][] = [
    [{ by: 'none' }, { kind: 'default', list: alltag, several: true }],
    // A list called "Einkaufsliste" is found by its name, generic word or not (review 0).
    [{ by: 'name', said: 'Einkaufsliste' }, { kind: 'named', list: main }],
    [{ by: 'name', said: 'shopping list' }, { kind: 'default', list: alltag, several: true }],
    [{ by: 'name', said: 'Geburtstag' }, { kind: 'named', list: geburtstag }],
    [{ by: 'id', id: main.id.toUpperCase() }, { kind: 'named', list: main }],
    [{ by: 'id', id: alltag.id }, { kind: 'default', list: alltag, several: true }],
    [{ by: 'name', said: ' Weihnachten ' }, { kind: 'unknown', list: alltag, said: 'Weihnachten' }],
    [{ by: 'name', said: 'Party' }, { kind: 'ambiguous', list: alltag, said: 'Party' }],
    // Another household's list or a deleted one: the default list, never a household switch.
    [{ by: 'id', id: '00000000-0000-4000-8000-0000000000ff' }, {
      kind: 'unknown',
      list: alltag,
      said: null,
    }],
  ];
  for (const [wish, expected] of cases) {
    assertEquals(targetOf(catalog, wish), expected, JSON.stringify(wish));
  }
});

Deno.test('targetOf: the only list, named or not, is spoken as before', () => {
  const catalog: ListCatalog = { lists: [main], defaultList: main };
  for (const said of ['Einkaufsliste', 'Liste']) {
    assertEquals(targetOf(catalog, { by: 'name', said }), {
      kind: 'default',
      list: main,
      several: false,
    });
  }
  assertEquals(targetOf(catalog, { by: 'name', said: 'Party' }), {
    kind: 'unknown',
    list: main,
    said: 'Party',
  });
});

Deno.test("review 0: 'Milch zur Einkaufsliste' with Geburtstag as default goes to Einkaufsliste", () => {
  const catalog: ListCatalog = { lists: [main, geburtstag], defaultList: geburtstag };
  for (const sentence of ['Milch zur Einkaufsliste', 'Milch auf die Einkaufsliste']) {
    const { text, said } = takeListPhrase(sentence, 'de', catalog.lists);
    assertEquals(text, 'Milch', sentence);
    assertEquals(targetOf(catalog, wishOf(said)), { kind: 'named', list: main }, sentence);
  }
});

Deno.test('a bare "zu X" takes only an exact list name: "Brot zu Hause" stays next to "Haus"', () => {
  const haus = { id: '00000000-0000-4000-8000-0000000000a9', name: 'Haus', seedKey: null };
  assertEquals(takeListPhrase('Brot zu Hause', 'de', [main, haus]), {
    text: 'Brot zu Hause',
    said: null,
  });
  assertEquals(takeListPhrase('Brot zu Haus', 'de', [main, haus]), { text: 'Brot', said: 'Haus' });
  // With "Liste" it is a list phrase, and fuzzy: "Hause Liste" finds Haus.
  assertEquals(takeListPhrase('Brot zur Hause Liste', 'de', [main, haus]).said, 'Hause');
});

Deno.test('wishOf: an id, a name or nothing', () => {
  assertEquals(wishOf(null), { by: 'none' });
  assertEquals(wishOf('  '), { by: 'none' });
  assertEquals(wishOf(main.id), { by: 'id', id: main.id });
  assertEquals(wishOf(' Geburtstag '), { by: 'name', said: 'Geburtstag' });
});
