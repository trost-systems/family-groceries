import type { CategoryId, Draft, Item, StoreId } from './types'

/**
 * Heuristic mock of the natural-language parser. Runs on every keystroke, so it is a single pass over
 * whitespace tokens against small dictionaries. The real classifier (SPEC.md req. 2) lives server-side.
 */

export interface Product {
  /** canonical German name */
  name: string
  /** canonical English name, then English aliases, pipe-separated */
  en: string
  emoji: string
  category: CategoryId
  /** default store when the household has no memory for this item yet */
  store?: StoreId
  /** properties filled in when the user typed none, e.g. diapers come in a "Standard Pack" */
  defaultProps?: string[]
  /** alternatives offered as suggestions */
  variants?: string[]
  /** brands the household might pick instead, offered as round-2 suggestions */
  brands?: string[]
  aliases?: string[]
}

const P = (name: string, en: string, emoji: string, category: CategoryId, extra: Partial<Product> = {}): Product => ({
  name,
  en,
  emoji,
  category,
  ...extra,
})

export const PRODUCTS: Product[] = [
  P('Windeln', 'Diapers|diaper|nappies|nappy', '👶', 'drogerie', {
    store: 'dm',
    defaultProps: ['Standard Pack'],
    variants: ['Standard Pack', 'Big Pack', 'Maxi Pack'],
    brands: ['Pampers', 'Babylove', 'Huggies'],
    aliases: ['windel'],
  }),
  P('Feuchttücher', 'Wet wipes|wipes', '🧻', 'drogerie', { store: 'dm', variants: ['4er Pack', '1er Pack'], brands: ['Babylove', 'Pampers'], aliases: ['feuchttuch'] }),
  P('Zahnpasta', 'Toothpaste', '🪥', 'drogerie', { store: 'dm', brands: ['elmex', 'Nivea'], aliases: ['zahncreme'] }),
  P('Shampoo', 'Shampoo', '🧴', 'drogerie', { store: 'dm' }),
  P('Duschgel', 'Shower gel|showergel', '🧴', 'drogerie', { store: 'dm' }),
  P('Sonnencreme', 'Sunscreen', '🧴', 'drogerie', { store: 'dm' }),
  P('Toilettenpapier', 'Toilet paper|toiletpaper', '🧻', 'haushalt', { aliases: ['klopapier'] }),
  P('Spülmittel', 'Dish soap|dishsoap', '🧴', 'haushalt', { brands: ['Pril'] }),
  P('Waschmittel', 'Detergent', '🫧', 'haushalt', { brands: ['Persil', 'Ariel'] }),
  P('Müllbeutel', 'Bin bags|binbags', '🗑️', 'haushalt'),
  P('Milch', 'Milk', '🥛', 'kuehl', { variants: ['1,5 %', '3,5 %'], brands: ['Weihenstephan', 'Landliebe'] }),
  P('Joghurt', 'Yogurt|yoghurt', '🥣', 'kuehl', { brands: ['Alpro', 'Müller', 'Landliebe'], aliases: ['jogurt', 'skyr'] }),
  P('Butter', 'Butter', '🧈', 'kuehl', { brands: ['Kerrygold'] }),
  P('Käse', 'Cheese', '🧀', 'kuehl', { aliases: ['gouda'] }),
  P('Eier', 'Eggs|egg', '🥚', 'kuehl', { variants: ['6er Pack', '10er Pack'], aliases: ['ei'] }),
  P('Bananen', 'Bananas|banana', '🍌', 'obst', { aliases: ['banane'] }),
  P('Äpfel', 'Apples|apple', '🍎', 'obst', { aliases: ['apfel'] }),
  P('Gurken', 'Cucumbers|cucumber', '🥒', 'obst', { aliases: ['gurke'] }),
  P('Tomaten', 'Tomatoes|tomato', '🍅', 'obst', { aliases: ['tomate'] }),
  P('Kartoffeln', 'Potatoes|potato', '🥔', 'obst', { aliases: ['kartoffel'] }),
  P('Zwiebeln', 'Onions|onion', '🧅', 'obst', { aliases: ['zwiebel'] }),
  P('Brot', 'Bread', '🍞', 'brot'),
  P('Brötchen', 'Rolls|bread rolls', '🥐', 'brot', { aliases: ['semmeln', 'semmel'] }),
  P('Hackfleisch', 'Minced meat|mince', '🥩', 'fleisch', { aliases: ['hack'] }),
  P('Hähnchen', 'Chicken', '🍗', 'fleisch', { aliases: ['huhn'] }),
  P('Lachs', 'Salmon', '🐟', 'fleisch'),
  P('Nudeln', 'Pasta|spaghetti', '🍝', 'vorrat', { brands: ['Barilla'], aliases: ['spaghetti'] }),
  P('Reis', 'Rice', '🍚', 'vorrat'),
  P('Kaffee', 'Coffee', '☕', 'vorrat', { brands: ['Tchibo', 'Jacobs', 'Lavazza'] }),
  P('Mehl', 'Flour', '🌾', 'vorrat'),
  P('Schokolade', 'Chocolate', '🍫', 'suess', { brands: ['Milka', 'Ritter Sport'], aliases: ['schoki'] }),
  P('Chips', 'Crisps', '🥔', 'suess'),
  P('Proteinriegel', 'Protein bars|protein bar|proteinbar', '🍫', 'suess', { aliases: ['riegel'] }),
  P('Cola', 'Coke', '🥤', 'getraenke'),
  P('Wasser', 'Water', '💧', 'getraenke', { brands: ['Gerolsteiner', 'Volvic'], aliases: ['sprudel'] }),
  P('Bier', 'Beer', '🍺', 'getraenke'),
  P('Saft', 'Juice', '🧃', 'getraenke'),
  P('Pizza', 'Pizza', '🍕', 'tk', { brands: ['Ristorante', 'Wagner'] }),
  P('Eis', 'Ice cream|icecream', '🍦', 'tk'),
]

const BRANDS: Record<string, string> = Object.fromEntries(
  [
    'Pampers', 'Babylove', 'Huggies', 'elmex', 'Nivea', 'Balea', 'Alverde', 'Pril', 'Persil', 'Ariel', 'Tempo',
    'Weihenstephan', 'Müller', 'Alpro', 'Landliebe', 'Barilla', 'Tchibo', 'Jacobs', 'Lavazza', 'Milka', 'Ritter Sport',
    'Haribo', 'Ristorante', 'Wagner', 'Coca-Cola', 'Gerolsteiner', 'Volvic', 'Kerrygold', 'Philadelphia', 'Ja!', 'Gut&Günstig',
  ].map((b) => [norm(b), b]),
)

/** Brands that imply a product when the user types only the brand. */
const BRAND_PRODUCT: Record<string, string> = { pampers: 'Windeln', huggies: 'Windeln', 'coca-cola': 'Cola' }

const NUMBER_WORDS: Record<string, number> = {
  ein: 1, eine: 1, einen: 1, zwei: 2, drei: 3, vier: 4, fünf: 5, fuenf: 5, sechs: 6, sieben: 7, acht: 8, neun: 9, zehn: 10, zwölf: 12,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, a: 1, an: 1,
}

const PIECE_WORDS = new Set(['stück', 'stueck', 'stk', 'x', 'mal', 'pcs', 'pieces', 'piece'])
const FILLER = new Set(['bitte', 'noch', 'auch', 'und', 'von', 'vom', 'der', 'die', 'das', 'please', 'some', 'of', 'the', 'and'])
const UNIT = '(?:g|gr|kg|ml|l|cl|liter|litre|lt)'

export function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .trim()
}

export interface Match {
  product: Product
  lang: 'de' | 'en'
  /** typed word was a compound ending in the product word, e.g. "Vollmilch" */
  compound?: boolean
}

const PRODUCT_INDEX = new Map<string, Match>()
for (const p of PRODUCTS) {
  for (const key of [p.name, ...(p.aliases ?? [])]) PRODUCT_INDEX.set(norm(key), { product: p, lang: 'de' })
  for (const key of p.en.split('|')) PRODUCT_INDEX.set(norm(key), { product: p, lang: 'en' })
}

export function findProduct(word: string): Match | undefined {
  const w = norm(word)
  const direct = PRODUCT_INDEX.get(w)
  if (direct) return direct
  // German compounds: "Vollkornbrot" -> Brot, "Babyshampoo" -> Shampoo. Longest suffix wins.
  let best: Match | undefined
  let bestLen = 3
  for (const [key, m] of PRODUCT_INDEX) {
    if (key.length > bestLen && w.endsWith(key)) {
      best = { ...m, compound: true }
      bestLen = key.length
    }
  }
  return best
}

export interface Memory {
  /** normalized item name -> last store / category the household used */
  store: Record<string, StoreId>
  category: Record<string, CategoryId>
}

/** "Cola Zero" and "Cola" share memory: the key is the first recognised product, else the whole name. */
function memoryKey(name: string): string {
  for (const word of name.split(/\s+/)) {
    const m = PRODUCT_INDEX.get(norm(word))
    if (m) return norm(m.product.name)
  }
  return norm(name)
}

export function memoryFromItems(items: Item[]): Memory {
  const m: Memory = { store: {}, category: {} }
  for (const i of items) {
    m.store[memoryKey(i.name)] = i.storeId
    m.category[memoryKey(i.name)] = i.categoryId
  }
  return m
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function formatAmount(raw: string): string {
  const m = raw.toLowerCase().match(new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*${UNIT}$`))
  if (!m) return raw
  const num = m[1].replace('.', ',')
  const unit = raw.toLowerCase().slice(m[1].length).trim().replace(/^(liter|litre|lt)$/, 'l').replace(/^gr$/, 'g')
  return `${num} ${unit}`
}

const PATTERNS: { re: RegExp; kind: 'qty' | 'prop' | 'amount'; fmt: (m: RegExpMatchArray) => string }[] = [
  // "2x", "x2", "3 Stück", "3 pcs"
  { re: /^(\d+)\s*(?:x|×|stück|stueck|stk\.?|pcs|pieces?)$/i, kind: 'qty', fmt: (m) => m[1] },
  // "3 Packungen", "3 packs (of)", "2 Dosen": a count of containers, not a pack size
  { re: /^(\d+)\s*(?:packs|packungen|packung|pckg?\.?|dosen|flaschen|bottles|cans|tins)$/i, kind: 'qty', fmt: (m) => m[1] },
  // "16 Rollen", "3-lagig", "3 ply"
  { re: /^(\d+)\s*(?:rollen|rolls)$/i, kind: 'prop', fmt: (m) => `${m[1]} Rollen` },
  { re: /^(\d)[- ]?(?:lagig|ply)$/i, kind: 'prop', fmt: (m) => `${m[1]}-lagig` },
  { re: /^(?:x|×)(\d+)$/i, kind: 'qty', fmt: (m) => m[1] },
  // "Größe 3", "Gr. 3", "size 4"
  { re: /^(?:größe|groesse|gr\.?|size)\s*(\d+\+?)$/i, kind: 'prop', fmt: (m) => `Größe ${m[1]}` },
  // "4er Pack", "6er", "10-pack", "4 pack"
  { re: /^(\d+)\s*(?:er|-?pack|er[- ]?pack(?:ung)?|er packung)$/i, kind: 'prop', fmt: (m) => `${m[1]}er Pack` },
  { re: /^(standard|big|maxi|mega|jumbo|spar)[- ]?pack$/i, kind: 'prop', fmt: (m) => `${capitalize(m[1].toLowerCase())} Pack` },
  // "1,5%", "3.5 %"
  { re: /^(\d+(?:[.,]\d+)?)\s*%$/, kind: 'prop', fmt: (m) => `${m[1].replace('.', ',')} %` },
  // "500g", "0,5l", "1 kg"
  { re: new RegExp(`^\\d+(?:[.,]\\d+)?\\s*${UNIT}$`, 'i'), kind: 'amount', fmt: (m) => formatAmount(m[0]) },
]

// "Zero" and "Light" are product lines ("Cola Zero"), so they stay in the name.
const DESCRIPTORS = new Set(['bio', 'vegan', 'laktosefrei', 'glutenfrei', 'organic', 'groß', 'klein', 'frisch', 'tk'])

/** Join multi-word patterns ("Größe 3", "4er Pack", "3 Stück", "500 g") into single tokens before classifying. */
function tokenize(input: string): string[] {
  const raw = input.trim().split(/\s+/).filter(Boolean)
  const out: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const pair = raw[i + 1] !== undefined ? `${raw[i]} ${raw[i + 1]}` : undefined
    if (pair && PATTERNS.some((p) => p.re.test(pair))) {
      out.push(pair)
      i++
    } else {
      out.push(raw[i])
    }
  }
  return out
}

export function parse(input: string, memory: Memory = { store: {}, category: {} }): Draft {
  const tokens = tokenize(input.replace(/(?<!\d)[,;]|[,;](?!\d)/g, ' '))
  let qty: string | undefined
  let amount: string | undefined
  let brand: string | undefined
  const props: string[] = []
  const nameWords: string[] = []
  let match: Match | undefined

  for (let idx = 0; idx < tokens.length; idx++) {
    const tok = tokens[idx]
    const lower = tok.toLowerCase()
    const pattern = PATTERNS.map((p) => ({ p, m: tok.match(p.re) })).find((x) => x.m)
    if (pattern?.m) {
      const value = pattern.p.fmt(pattern.m)
      if (pattern.p.kind === 'qty') qty = value
      else if (pattern.p.kind === 'amount') amount = value
      else props.push(value)
      continue
    }
    if (/^\d+$/.test(tok) && qty === undefined && idx === 0) {
      qty = tok
      continue
    }
    if (idx === 0 && NUMBER_WORDS[lower] !== undefined && tokens.length > 1) {
      qty = String(NUMBER_WORDS[lower])
      continue
    }
    if (PIECE_WORDS.has(lower) || FILLER.has(lower)) continue
    const b = BRANDS[norm(tok)]
    if (b && !brand) {
      brand = b
      continue
    }
    if (!match) {
      const m = findProduct(tok)
      if (m) {
        match = m
        nameWords.push(tok)
        continue
      }
    }
    if (DESCRIPTORS.has(lower) && (match || nameWords.length > 0)) {
      props.push(capitalize(lower === 'organic' ? 'Bio' : lower))
      continue
    }
    nameWords.push(tok)
  }

  if (!match && brand && BRAND_PRODUCT[norm(brand)]) {
    match = findProduct(BRAND_PRODUCT[norm(brand)])
    if (match) nameWords.unshift(match.product.name)
  }
  const product = match?.product

  // One product word becomes its canonical name in the language typed ("windel" -> "Windeln"); compounds and
  // multi-word names keep what the user wrote.
  let name = nameWords.map(capitalize).join(' ')
  if (match && nameWords.length === 1 && !match.compound) {
    const canonical = match.lang === 'en' ? match.product.en.split('|')[0] : match.product.name
    // Inflections normalize ("windel" -> "Windeln"); synonyms keep the user's word ("Klopapier" stays Klopapier).
    name = norm(canonical).slice(0, 4) === norm(nameWords[0]).slice(0, 4) ? canonical : capitalize(nameWords[0])
  }
  if (amount) props.push(amount)
  if (product?.defaultProps && !props.some((p) => /pack/i.test(p))) props.push(...product.defaultProps)

  const key = memoryKey(name)
  const categoryId = memory.category[key] ?? product?.category ?? 'sonst'
  const storeId = memory.store[key] ?? product?.store ?? defaultStoreFor(categoryId)
  const fallbackEmoji = categoryId === 'sonst' ? '🛒' : CATEGORY_EMOJI[categoryId]

  return {
    name,
    brand,
    props,
    qty: qty ?? '1',
    emoji: product?.emoji ?? fallbackEmoji,
    storeId,
    categoryId,
  }
}

const CATEGORY_EMOJI: Record<CategoryId, string> = {
  obst: '🥦', brot: '🥖', kuehl: '🧀', fleisch: '🥩', vorrat: '🥫', suess: '🍫', getraenke: '🧃', tk: '🧊', haushalt: '🧽', drogerie: '👶', sonst: '🛒',
}

function defaultStoreFor(category: CategoryId): StoreId {
  return category === 'drogerie' ? 'dm' : 'edeka'
}

/**
 * The tappable suggestions under the live preview. The first is always the parse itself;
 * the rest swap in the product's known variants or alternative brands, so the common correction is one tap.
 */
export function suggest(input: string, memory?: Memory): Draft[] {
  if (!input.trim()) return []
  const base = parse(input, memory)
  const out: Draft[] = [base]
  const product = findProduct(base.name)?.product
  for (const v of product?.variants ?? []) {
    if (base.props.includes(v)) continue
    const isPack = /pack|er$/i.test(v)
    const props = isPack ? [...base.props.filter((p) => !/pack|^\d+er$/i.test(p)), v] : [...base.props.filter((p) => !/%$/.test(p)), v]
    out.push({ ...base, props })
  }
  if (product?.name === 'Windeln') {
    const alt = base.brand === 'Babylove' ? 'Pampers' : 'Babylove'
    out.push({ ...base, brand: alt })
  }
  const seen = new Set<string>()
  return out.filter((d) => {
    const k = `${d.brand}|${d.props.join(',')}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  }).slice(0, 4)
}

export function draftToItem(d: Draft, id: string, addedBy: Item['addedBy'] = 'Peter'): Item {
  return { ...d, id, addedBy, checked: false }
}

/**
 * Props are stored in canonical German form and translated for display. Each rule maps a German template to its
 * English form; `canonicalProps` runs them backwards so text typed or edited in English is stored canonically too.
 */
const PROP_RULES: { de: RegExp; en: (m: RegExpMatchArray) => string; enRe: RegExp; de2: (m: RegExpMatchArray) => string }[] = [
  { de: /^Größe (\S+)$/, en: (m) => `Size ${m[1]}`, enRe: /^Size (\S+)$/i, de2: (m) => `Größe ${m[1]}` },
  { de: /^(\d+)er Pack$/, en: (m) => `${m[1]}-pack`, enRe: /^(\d+)-pack$/i, de2: (m) => `${m[1]}er Pack` },
  { de: /^(Standard|Big|Maxi|Mega|Jumbo|Spar) Pack$/, en: (m) => `${m[1]} pack`, enRe: /^(Standard|Big|Maxi|Mega|Jumbo|Spar) pack$/, de2: (m) => `${m[1]} Pack` },
  { de: /^(\d+) Rollen$/, en: (m) => `${m[1]} rolls`, enRe: /^(\d+) rolls$/i, de2: (m) => `${m[1]} Rollen` },
  { de: /^(\d)-lagig$/, en: (m) => `${m[1]}-ply`, enRe: /^(\d)-ply$/i, de2: (m) => `${m[1]}-lagig` },
  { de: /^(\d+),(\d+) (%|l|kg|g|ml)$/, en: (m) => `${m[1]}.${m[2]} ${m[3]}`, enRe: /^(\d+)\.(\d+) (%|l|kg|g|ml)$/, de2: (m) => `${m[1]},${m[2]} ${m[3]}` },
]

const PROP_WORDS: [de: string, en: string][] = [
  ['Bio', 'Organic'],
  ['Kinder', 'Kids'],
  ['gemischt', 'mixed'],
  ['Laktosefrei', 'Lactose-free'],
  ['Glutenfrei', 'Gluten-free'],
  ['Frisch', 'Fresh'],
  ['Groß', 'Large'],
  ['Klein', 'Small'],
]

function propToEnglish(p: string): string {
  for (const r of PROP_RULES) {
    const m = p.match(r.de)
    if (m) return r.en(m)
  }
  return PROP_WORDS.find(([de]) => de === p)?.[1] ?? p
}

function propToGerman(p: string): string {
  for (const r of PROP_RULES) {
    const m = p.match(r.enRe)
    if (m) return r.de2(m)
  }
  return PROP_WORDS.find(([, en]) => en === p)?.[0] ?? p
}

export function canonicalProps(props: string[]): string[] {
  return props.map(propToGerman)
}

export function localizeProps(props: string[], lang: 'de' | 'en'): string[] {
  return lang === 'de' ? canonicalProps(props) : canonicalProps(props).map(propToEnglish)
}
