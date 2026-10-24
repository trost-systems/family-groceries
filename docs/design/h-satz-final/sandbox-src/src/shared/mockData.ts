import type { Category, CategoryId, Item, ListState, Store } from './types'

export const STORES: Store[] = [
  { id: 'dm', name: 'dm', badge: { bg: '#ffffff', fg: '#d6001c', label: 'dm' } },
  { id: 'edeka', name: 'Edeka', badge: { bg: '#1d4ea3', fg: '#ffd400', label: 'E' } },
  { id: 'lidl', name: 'Lidl', badge: { bg: '#0050aa', fg: '#fff000', label: 'L' } },
  { id: 'rewe', name: 'Rewe', badge: { bg: '#cc071e', fg: '#ffffff', label: 'R' } },
  { id: 'aldi', name: 'Aldi', badge: { bg: '#00005f', fg: '#ff9a00', label: 'A' } },
]

const CATEGORY_LIST: Category[] = [
  { id: 'obst', emoji: '🥦', name: { de: 'Obst & Gemüse', en: 'Fruit & Veg' } },
  { id: 'brot', emoji: '🥖', name: { de: 'Brot & Backwaren', en: 'Bread & Bakery' } },
  { id: 'kuehl', emoji: '🧀', name: { de: 'Kühlregal', en: 'Chilled' } },
  { id: 'fleisch', emoji: '🥩', name: { de: 'Fleisch, Wurst & Fisch', en: 'Meat & Fish' } },
  { id: 'vorrat', emoji: '🥫', name: { de: 'Vorrat & Konserven', en: 'Pantry' } },
  { id: 'suess', emoji: '🍫', name: { de: 'Süßes & Snacks', en: 'Sweets & Snacks' } },
  { id: 'getraenke', emoji: '🧃', name: { de: 'Getränke', en: 'Drinks' } },
  { id: 'tk', emoji: '🧊', name: { de: 'Tiefkühl', en: 'Frozen' } },
  { id: 'haushalt', emoji: '🧽', name: { de: 'Haushalt', en: 'Household' } },
  { id: 'drogerie', emoji: '👶', name: { de: 'Drogerie', en: 'Drugstore' } },
  { id: 'sonst', emoji: '📦', name: { de: 'Sonstiges', en: 'Other' } },
]

export const CATEGORIES: Record<CategoryId, Category> = Object.fromEntries(
  CATEGORY_LIST.map((c) => [c.id, c]),
)

export const ROUTE_ORDER: CategoryId[] = CATEGORY_LIST.map((c) => c.id)

let seq = 0
const item = (p: Omit<Item, 'id' | 'checked' | 'props' | 'addedBy'> & Partial<Pick<Item, 'props' | 'addedBy'>>): Item => ({
  id: `seed-${++seq}`,
  checked: false,
  props: [],
  addedBy: 'Peter',
  ...p,
})

export function initialState(): ListState {
  seq = 0
  return {
    stores: STORES,
    categories: CATEGORIES,
    layout: {
      dm: ['drogerie', 'haushalt', 'suess', 'getraenke', 'sonst'],
      edeka: [...ROUTE_ORDER],
      lidl: [...ROUTE_ORDER],
      rewe: [...ROUTE_ORDER],
      aldi: [...ROUTE_ORDER],
    },
    items: [
      item({ name: 'Feuchttücher', brand: 'Babylove', props: ['4er Pack'], qty: '1', emoji: '🧻', storeId: 'dm', categoryId: 'drogerie', addedBy: 'Sam' }),
      item({ name: 'Zahnpasta', brand: 'elmex', props: ['Kinder'], qty: '1', emoji: '🪥', storeId: 'dm', categoryId: 'drogerie' }),
      item({ name: 'Proteinriegel', qty: '7', emoji: '🍫', storeId: 'dm', categoryId: 'suess' }),
      item({ name: 'Cola Zero', props: ['0,5 l'], qty: '2', emoji: '🥤', storeId: 'dm', categoryId: 'getraenke', addedBy: 'Sam' }),
      item({ name: 'Bananen', props: ['Bio'], qty: '6', emoji: '🍌', storeId: 'edeka', categoryId: 'obst', addedBy: 'Sam' }),
      item({ name: 'Gurken', qty: '2', emoji: '🥒', storeId: 'edeka', categoryId: 'obst' }),
      item({ name: 'Brötchen', qty: '6', emoji: '🥐', storeId: 'edeka', categoryId: 'brot' }),
      item({ name: 'Milch', brand: 'Weihenstephan', props: ['1,5 %', '1 l'], qty: '2', emoji: '🥛', storeId: 'edeka', categoryId: 'kuehl', addedBy: 'Sam' }),
      item({ name: 'Joghurt', brand: 'Alpro', props: ['Skyr Style'], qty: '1', emoji: '🥣', storeId: 'edeka', categoryId: 'kuehl' }),
      item({ name: 'Hackfleisch', props: ['gemischt'], qty: '500 g', emoji: '🥩', storeId: 'edeka', categoryId: 'fleisch' }),
      item({ name: 'Kaffee', brand: 'Tchibo', props: ['Cappuccino'], qty: '1', emoji: '☕', storeId: 'edeka', categoryId: 'vorrat', addedBy: 'Sam' }),
      item({ name: 'Pizza', brand: 'Ristorante', props: ['Salame'], qty: '2', emoji: '🍕', storeId: 'lidl', categoryId: 'tk' }),
      item({ name: 'Spülmittel', brand: 'Pril', qty: '1', emoji: '🧴', storeId: 'lidl', categoryId: 'haushalt', addedBy: 'Sam' }),
      item({ name: 'Äpfel', props: ['Elstar'], qty: '1 kg', emoji: '🍎', storeId: 'lidl', categoryId: 'obst' }),
    ],
  }
}

/** Round 2 seeds the same list plus one long name, so every variant proves names wrap instead of truncating. */
export function round2State(): ListState {
  const base = initialState()
  const long = item({
    name: 'Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen',
    brand: 'Schär',
    props: ['6 Stück'],
    qty: '1',
    emoji: '🥖',
    storeId: 'edeka',
    categoryId: 'brot',
    addedBy: 'Sam',
  })
  return { ...base, items: [...base.items.slice(0, 7), long, ...base.items.slice(7)] }
}

/** What the household bought on earlier trips, newest first. Round 2 offers these as suggestions. */
export const HISTORY: Item[] = [
  item({ name: 'Windeln', brand: 'Pampers', props: ['Größe 4', 'Big Pack'], qty: '1', emoji: '👶', storeId: 'dm', categoryId: 'drogerie', addedBy: 'Sam' }),
  item({ name: 'Milch', brand: 'Landliebe', props: ['3,5 %', '1 l'], qty: '2', emoji: '🥛', storeId: 'edeka', categoryId: 'kuehl' }),
  item({ name: 'Mineralwasser', brand: 'Gerolsteiner', props: ['Medium', '6er Pack'], qty: '1', emoji: '💧', storeId: 'lidl', categoryId: 'getraenke' }),
  item({ name: 'Wäscheklammern', qty: '1', emoji: '🧺', storeId: 'aldi', categoryId: 'haushalt' }),
  item({ name: 'Bananen', props: ['Bio'], qty: '6', emoji: '🍌', storeId: 'edeka', categoryId: 'obst', addedBy: 'Sam' }),
].map((i, n) => ({ ...i, id: `hist-${n + 1}`, checked: true }))
