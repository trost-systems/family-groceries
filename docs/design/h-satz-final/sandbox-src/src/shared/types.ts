export type Lang = 'de' | 'en'

export type StoreId = string
export type CategoryId = string
export type ItemId = string

export type Localized = Record<Lang, string>

export interface Store {
  id: StoreId
  name: string
  /** Brand-ish badge colors for the tiny store logo. Stores are real brands, so these are the only non-token colors. */
  badge: { bg: string; fg: string; label: string }
}

export interface Category {
  id: CategoryId
  emoji: string
  name: Localized
}

export type Member = 'Peter' | 'Sam'

export interface Item {
  id: ItemId
  /** Bezeichnung, e.g. "Windeln" */
  name: string
  /** Marke, e.g. "Pampers" */
  brand?: string
  /** Eigenschaften, e.g. ["Größe 3", "Standard Pack"] */
  props: string[]
  /** Menge as displayed, e.g. "1", "2", "500 g" */
  qty: string
  emoji: string
  storeId: StoreId
  categoryId: CategoryId
  addedBy: Member
  checked: boolean
}

/** One store's section of the list. Category order is per store, matching that store's layout. */
export interface ListState {
  stores: Store[]
  categories: Record<CategoryId, Category>
  layout: Record<StoreId, CategoryId[]>
  items: Item[]
}

/** What the natural-language parser produces on every keystroke. */
export interface Draft {
  name: string
  brand?: string
  props: string[]
  qty: string
  emoji: string
  storeId: StoreId
  categoryId: CategoryId
}
