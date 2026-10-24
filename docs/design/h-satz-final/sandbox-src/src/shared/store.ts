import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { initialState } from './mockData'
import { useI18n } from './i18n'
import { canonicalProps, localizeProps, memoryFromItems, type Memory } from './parser'
import type { Category, CategoryId, Draft, Item, ItemId, ListState, Store, StoreId } from './types'

type Action =
  | { type: 'add'; item: Item }
  | { type: 'setChecked'; id: ItemId; checked: boolean }
  | { type: 'update'; id: ItemId; patch: Partial<Omit<Item, 'id'>> }
  | { type: 'remove'; id: ItemId }
  | { type: 'restore'; item: Item; index: number }
  | { type: 'reorderStores'; from: StoreId; to: StoreId }
  | { type: 'reorderCategories'; storeId: StoreId; from: CategoryId; to: CategoryId }
  | { type: 'place'; id: ItemId; anchorId: ItemId; edge: 'before' | 'after' }

function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [x] = next.splice(from, 1)
  next.splice(to, 0, x)
  return next
}

/** Moving an item into a store whose layout lacks its category appends the category there. */
function withCategory(state: ListState, storeId: StoreId, categoryId: CategoryId): ListState['layout'] {
  const order = state.layout[storeId] ?? []
  return order.includes(categoryId) ? state.layout : { ...state.layout, [storeId]: [...order, categoryId] }
}

export function reducer(state: ListState, a: Action): ListState {
  switch (a.type) {
    case 'add':
      return { ...state, items: [...state.items, a.item], layout: withCategory(state, a.item.storeId, a.item.categoryId) }
    case 'setChecked':
      return { ...state, items: state.items.map((i) => (i.id === a.id ? { ...i, checked: a.checked } : i)) }
    case 'update': {
      const items = state.items.map((i) => (i.id === a.id ? { ...i, ...a.patch } : i))
      const it = items.find((i) => i.id === a.id)
      return { ...state, items, layout: it ? withCategory(state, it.storeId, it.categoryId) : state.layout }
    }
    case 'remove':
      return { ...state, items: state.items.filter((i) => i.id !== a.id) }
    case 'restore': {
      const items = [...state.items]
      items.splice(a.index, 0, a.item)
      return { ...state, items }
    }
    case 'reorderStores': {
      const from = state.stores.findIndex((s) => s.id === a.from)
      const to = state.stores.findIndex((s) => s.id === a.to)
      return from < 0 || to < 0 ? state : { ...state, stores: move(state.stores, from, to) }
    }
    case 'reorderCategories': {
      const order = state.layout[a.storeId] ?? []
      const from = order.indexOf(a.from)
      const to = order.indexOf(a.to)
      return from < 0 || to < 0 ? state : { ...state, layout: { ...state.layout, [a.storeId]: move(order, from, to) } }
    }
    case 'place': {
      // Within a category the list shows items in array order, so this is the walk-order position.
      const item = state.items.find((i) => i.id === a.id)
      const anchor = state.items.find((i) => i.id === a.anchorId)
      if (!item || !anchor || item === anchor) return state
      const items = state.items.filter((i) => i !== item)
      const at = items.indexOf(anchor) + (a.edge === 'after' ? 1 : 0)
      items.splice(at, 0, { ...item, storeId: anchor.storeId, categoryId: anchor.categoryId })
      return { ...state, items }
    }
  }
}

export interface CategoryGroup {
  category: Category
  items: Item[]
}

export interface StoreSection {
  store: Store
  categories: CategoryGroup[]
  count: number
}

/** Stores in the household's order, each with its categories in that store's layout order. Empty groups are dropped. */
export function sectionsOf(state: ListState): StoreSection[] {
  const open = state.items.filter((i) => !i.checked)
  return state.stores
    .map((store) => {
      const mine = open.filter((i) => i.storeId === store.id)
      const categories = (state.layout[store.id] ?? [])
        .map((cid) => ({ category: state.categories[cid], items: mine.filter((i) => i.categoryId === cid) }))
        .filter((g) => g.items.length > 0)
      return { store, categories, count: mine.length }
    })
    .filter((s) => s.count > 0)
}

/** Snackbars hold a message, not a string, so a language switch re-renders them in the new language. */
export type SnackMessage =
  | { kind: 'added'; name: string; store: string }
  | { kind: 'checked'; name: string }
  | { kind: 'deleted'; name: string }

export interface Snack {
  key: number
  message: SnackMessage
  undo?: () => void
}

let nextId = 1

export function useGroceries(seed: () => ListState = initialState) {
  const [state, dispatch] = useReducer(reducer, undefined, seed)
  const [snack, setSnack] = useState<Snack | null>(null)
  const snackKey = useRef(0)
  const stateRef = useRef(state)
  stateRef.current = state

  const showSnack = useCallback((message: SnackMessage, undo?: () => void) => {
    setSnack({ key: ++snackKey.current, message, undo })
  }, [])

  useEffect(() => {
    if (!snack) return
    const t = setTimeout(() => setSnack((s) => (s?.key === snack.key ? null : s)), 5000)
    return () => clearTimeout(t)
  }, [snack])

  const actions = useMemo(
    () => ({
      add(draft: Draft): ItemId {
        const id = `new-${nextId++}`
        dispatch({ type: 'add', item: { ...draft, props: canonicalProps(draft.props), id, addedBy: 'Peter', checked: false } })
        const store = stateRef.current.stores.find((s) => s.id === draft.storeId)?.name ?? draft.storeId
        showSnack({ kind: 'added', name: draft.name, store }, () => dispatch({ type: 'remove', id }))
        return id
      },
      check(id: ItemId) {
        const item = stateRef.current.items.find((i) => i.id === id)
        dispatch({ type: 'setChecked', id, checked: true })
        showSnack({ kind: 'checked', name: item?.name ?? '' }, () => dispatch({ type: 'setChecked', id, checked: false }))
      },
      uncheck(id: ItemId) {
        dispatch({ type: 'setChecked', id, checked: false })
      },
      update(id: ItemId, patch: Partial<Omit<Item, 'id'>>) {
        dispatch({ type: 'update', id, patch: patch.props ? { ...patch, props: canonicalProps(patch.props) } : patch })
      },
      remove(id: ItemId) {
        const index = stateRef.current.items.findIndex((i) => i.id === id)
        const item = stateRef.current.items[index]
        if (!item) return
        dispatch({ type: 'remove', id })
        showSnack({ kind: 'deleted', name: item.name }, () => dispatch({ type: 'restore', item, index }))
      },
      move(id: ItemId, storeId: StoreId, categoryId: CategoryId) {
        dispatch({ type: 'update', id, patch: { storeId, categoryId } })
      },
      reorderStores(from: StoreId, to: StoreId) {
        dispatch({ type: 'reorderStores', from, to })
      },
      reorderCategories(storeId: StoreId, from: CategoryId, to: CategoryId) {
        dispatch({ type: 'reorderCategories', storeId, from, to })
      },
      /** Put the item right before or after another one, adopting its store and category. */
      place(id: ItemId, anchorId: ItemId, edge: 'before' | 'after') {
        dispatch({ type: 'place', id, anchorId, edge })
      },
    }),
    [showSnack],
  )

  const { lang } = useI18n()
  // Props are stored canonical (German) and shown in the UI language.
  const display = useCallback((i: Item): Item => ({ ...i, props: localizeProps(i.props, lang) }), [lang])
  const sections = useMemo(
    () => sectionsOf(state).map((s) => ({ ...s, categories: s.categories.map((c) => ({ ...c, items: c.items.map(display) })) })),
    [state, display],
  )
  const memory: Memory = useMemo(() => memoryFromItems(state.items), [state.items])
  const recentlyBought = useMemo(() => state.items.filter((i) => i.checked).reverse().map(display), [state.items, display])

  return {
    state,
    sections,
    memory,
    recentlyBought,
    actions,
    snack,
    dismissSnack: () => setSnack(null),
  }
}

export type Groceries = ReturnType<typeof useGroceries>
