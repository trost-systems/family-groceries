import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useI18n } from '../i18n'
import { HISTORY } from '../mockData'
import { localizeProps } from '../parser'
import type { Groceries } from '../store'
import { suggestionsFor, type Suggestion } from '../suggestions'
import type { CategoryId, Draft, Item, StoreId } from '../types'
import { itemToText } from './format'

export type Target = { kind: 'add' } | { kind: 'edit'; item: Item }
export type Fold = 'store' | 'category' | null

interface State {
  open: boolean
  target: Target
  text: string
  /** the user's pick from the fold-out chips; null means each suggestion keeps its own guess */
  storeId: StoreId | null
  categoryId: CategoryId | null
  fold: Fold
}

type Event =
  | { type: 'openAdd' }
  | { type: 'openEdit'; item: Item }
  | { type: 'close' }
  | { type: 'settled' }
  | { type: 'type'; text: string }
  | { type: 'store'; id: StoreId }
  | { type: 'category'; id: CategoryId }
  | { type: 'fold'; fold: Fold }
  | { type: 'added' }

const blank: State = { open: false, target: { kind: 'add' }, text: '', storeId: null, categoryId: null, fold: null }

function reducer(s: State, e: Event): State {
  switch (e.type) {
    case 'openAdd':
      return s.open ? s : { ...blank, open: true }
    case 'openEdit':
      return { open: true, target: { kind: 'edit', item: e.item }, text: itemToText(e.item), storeId: e.item.storeId, categoryId: e.item.categoryId, fold: null }
    case 'close':
      return { ...s, open: false, fold: null }
    case 'settled':
      // Content stays rendered while the sheet shrinks back around the input, then clears.
      return s.open ? s : blank
    case 'type':
      return { ...s, text: e.text }
    case 'store':
      return { ...s, storeId: e.id, fold: null }
    case 'category':
      return { ...s, categoryId: e.id, fold: null }
    case 'fold':
      return { ...s, fold: s.fold === e.fold ? null : e.fold }
    case 'added':
      return { ...s, text: '', storeId: null, categoryId: null, fold: null }
  }
}

export const SHEET_MS = 320

/**
 * The bottom composer: one input that is the add bar when closed and the sheet's input when open.
 * Add and edit share the structure: fold-out store/category chips, then suggestions, then the input.
 */
export function useComposer(groceries: Groceries) {
  const { lang } = useI18n()
  const [s, dispatch] = useReducer(reducer, blank)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (s.open) return
    const t = setTimeout(() => dispatch({ type: 'settled' }), SHEET_MS)
    return () => clearTimeout(t)
  }, [s.open])

  const history = useMemo(() => [...groceries.recentlyBought, ...HISTORY], [groceries.recentlyBought])
  const editing = s.target.kind === 'edit' ? s.target.item : null
  const unchanged = editing !== null && s.text === itemToText(editing)

  /** Raw suggestions, before the chips apply, so the chips can show the guess they would replace. */
  const raw: Suggestion[] = useMemo(() => {
    const list = suggestionsFor(s.text, { memory: groceries.memory, history })
    if (!editing || !unchanged) return list
    const { name, brand, props, qty, emoji, storeId, categoryId } = editing
    return [{ key: 'current', source: 'current' as const, draft: { name, brand, props, qty, emoji, storeId, categoryId } }, ...list.slice(1)]
  }, [s.text, groceries.memory, history, editing, unchanged])

  const suggestions: Suggestion[] = useMemo(
    () =>
      raw.map((x) => ({
        ...x,
        draft: { ...x.draft, props: localizeProps(x.draft.props, lang), storeId: s.storeId ?? x.draft.storeId, categoryId: s.categoryId ?? x.draft.categoryId },
      })),
    [raw, lang, s.storeId, s.categoryId],
  )

  const guess = raw[0]?.draft
  const apply = (d: Draft) => {
    if (editing) {
      groceries.actions.update(editing.id, d)
      dispatch({ type: 'close' })
      input.current?.blur()
      return
    }
    groceries.actions.add(d)
    dispatch({ type: 'added' })
    input.current?.focus()
  }

  return {
    ...s,
    input,
    editing,
    suggestions,
    /** what the chips display: the user's pick, else the first suggestion's guess, else automatic */
    storeId: s.storeId ?? guess?.storeId ?? null,
    categoryId: s.categoryId ?? guess?.categoryId ?? null,
    storeSet: s.storeId !== null && s.storeId !== guess?.storeId,
    categorySet: s.categoryId !== null && s.categoryId !== guess?.categoryId,
    /** the chip's store applies to every row once picked; otherwise a row with its own store shows a badge */
    storePinned: s.storeId !== null,
    openAdd: () => dispatch({ type: 'openAdd' }),
    openEdit: (item: Item) => {
      dispatch({ type: 'openEdit', item })
      input.current?.focus()
    },
    close: () => {
      dispatch({ type: 'close' })
      input.current?.blur()
    },
    setText: (text: string) => dispatch({ type: 'type', text }),
    setStore: (id: StoreId) => dispatch({ type: 'store', id }),
    setCategory: (id: CategoryId) => dispatch({ type: 'category', id }),
    toggleFold: (fold: Fold) => dispatch({ type: 'fold', fold }),
    apply,
    remove: () => {
      if (!editing) return
      groceries.actions.remove(editing.id)
      dispatch({ type: 'close' })
      input.current?.blur()
    },
  }
}

export type Composer = ReturnType<typeof useComposer>
