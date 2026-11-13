// Synthetic households only. No real user data, no backend.

const items = {
  main: ['Milch', 'Brot', 'Bananen', 'Butter', 'Eier', 'Kaffee', 'Tomaten'],
  party: ['Luftballons', 'Sekt', 'Kerzen', 'Erdbeeren', 'Sahne'],
  drug: ['Zahnpasta', 'Duschgel', 'Pflaster'],
  diy: ['Schrauben 4 x 40', 'Malerkrepp'],
  clean: ['Spülmittel', 'Müllbeutel', 'Schwämme', 'Glasreiniger'],
};

const list = (id, name, kind) => ({ id, name, items: items[kind] });

const trost = (lists) => ({ id: 'trost', name: 'Trost', members: 2, lists });

export const scenarios = [
  {
    id: 'one-short',
    label: '1 Haushalt, 1 Liste',
    households: [trost([list('main', 'Einkaufsliste', 'main')])],
    shown: 'trost',
    defaultHousehold: 'trost',
  },
  {
    id: 'one-many',
    label: '1 Haushalt, 4 Listen',
    households: [
      trost([
        list('main', 'Einkaufsliste', 'main'),
        list('party', 'Geburtstag', 'party'),
        list('drug', 'Drogerie', 'drug'),
        list('diy', 'Baumarkt', 'diy'),
      ]),
    ],
    shown: 'trost',
    shownList: 'party',
    defaultHousehold: 'trost',
  },
  {
    id: 'many-households',
    label: '3 Haushalte',
    households: [
      trost([list('main', 'Einkaufsliste', 'main'), list('party', 'Geburtstag', 'party')]),
      { id: 'oma', name: 'Oma & Opa', members: 3, lists: [list('oma-main', 'Einkaufsliste', 'main')] },
      {
        id: 'wg',
        name: 'WG Kastanienallee',
        members: 4,
        lists: [list('wg-main', 'Einkaufsliste', 'main'), list('wg-clean', 'Putzmittel', 'clean')],
      },
    ],
    shown: 'trost',
    shownList: 'party',
    defaultHousehold: 'trost',
  },
  {
    id: 'long-names',
    label: 'Lange Namen',
    households: [
      {
        id: 'long',
        name: 'Wohngemeinschaft Kastanienallee 12, Hinterhaus links',
        members: 5,
        lists: [
          list('long-party', 'Geburtstagsfeier für Oma Hildegard am Samstag', 'party'),
          list('long-main', 'Einkaufsliste', 'main'),
          list('long-drug', 'Drogerie, Apotheke und Reformhaus', 'drug'),
        ],
      },
      trost([list('main', 'Einkaufsliste', 'main')]),
      { id: 'oma', name: 'Oma & Opa', members: 3, lists: [list('oma-main', 'Einkaufsliste', 'main')] },
    ],
    shown: 'long',
    shownList: 'long-party',
    defaultHousehold: 'trost',
  },
  {
    id: 'solo-long',
    label: 'Nur 1 Haushalt, lang',
    households: [
      {
        id: 'solo',
        name: 'Familie Trost-Brandtner aus Sendling',
        members: 2,
        lists: [
          list('solo-main', 'Einkaufsliste', 'main'),
          list('solo-party', 'Kindergeburtstag Paula und Jonas', 'party'),
        ],
      },
    ],
    shown: 'solo',
    shownList: 'solo-party',
    defaultHousehold: 'solo',
  },
];

// The state one phone holds: which household and list it shows, the last
// list per household (a household switch returns there), and the open sheet.
export function initialState(scenario) {
  const shown = scenario.households.find((h) => h.id === scenario.shown);
  const lastList = Object.fromEntries(scenario.households.map((h) => [h.id, h.lists[0].id]));
  lastList[shown.id] = scenario.shownList ?? shown.lists[0].id;
  return { scenario, household: shown.id, lastList, sheet: null, toast: null };
}

export const householdOf = (s) => s.scenario.households.find((h) => h.id === s.household);
export const listOf = (s) => householdOf(s).lists.find((l) => l.id === s.lastList[s.household]);
export const defaultOf = (s) => s.scenario.households.find((h) => h.id === s.scenario.defaultHousehold);

export function showList(s, householdId, listId) {
  const switched = householdId !== s.household;
  s.household = householdId;
  if (listId) s.lastList[householdId] = listId;
  s.sheet = null;
  s.toast = switched ? { household: householdOf(s).name, voice: defaultOf(s).name } : null;
}
