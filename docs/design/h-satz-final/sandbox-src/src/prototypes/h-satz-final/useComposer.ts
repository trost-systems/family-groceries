import { useEffect, useMemo, useReducer, useRef } from 'react'
import { useI18n } from '../../shared/i18n'
import { HISTORY } from '../../shared/mockData'
import { findProduct, localizeProps } from '../../shared/parser'
import type { Groceries } from '../../shared/store'
import { suggestionsFor, type Suggestion } from '../../shared/suggestions'
import type { CategoryId, Draft, Item, StoreId } from '../../shared/types'

export type Fold = 'store' | 'category' | null

export interface Fields {
  name: string
  brand: string
  props: string
  qty: string
}

interface AddMode {
  kind: 'add'
  text: string
  /** the user's pick from the fold-out chips; null means each suggestion keeps its own guess */
  storeId: StoreId | null
  categoryId: CategoryId | null
  fold: Fold
}

interface EditMode {
  kind: 'edit'
  item: Item
  fields: Fields
  storeId: StoreId
  categoryId: CategoryId
  fold: Fold
}

interface State {
  open: boolean
  mode: AddMode | EditMode
}

type Event =
  | { type: 'openAdd' }
  | { type: 'openEdit'; item: Item }
  | { type: 'close' }
  | { type: 'settled' }
  | { type: 'type'; text: string }
  | { type: 'field'; key: keyof Fields; value: string }
  | { type: 'store'; id: StoreId }
  | { type: 'category'; id: CategoryId }
  | { type: 'fold'; fold: Fold }
  | { type: 'added' }

const blankAdd: AddMode = { kind: 'add', text: '', storeId: null, categoryId: null, fold: null }
const blank: State = { open: false, mode: blankAdd }

export const joinProps = (props: string[]) => props.join(', ')
/** Splits on "·", ";" or a comma followed by a space, so a decimal comma ("1,5 %") stays inside its property. */
export const splitProps = (text: string) =>
  text
    .split(/\s*[·;]\s*|,\s+/)
    .map((p) => p.trim())
    .filter(Boolean)

const fieldsOf = (item: Item): Fields => ({ name: item.name, brand: item.brand ?? '', props: joinProps(item.props), qty: item.qty })

function reducer(s: State, e: Event): State {
  const m = s.mode
  switch (e.type) {
    case 'openAdd':
      return s.open ? s : { open: true, mode: blankAdd }
    case 'openEdit':
      return { open: true, mode: { kind: 'edit', item: e.item, fields: fieldsOf(e.item), storeId: e.item.storeId, categoryId: e.item.categoryId, fold: null } }
    case 'close':
      return { open: false, mode: { ...m, fold: null } }
    case 'settled':
      // Content stays rendered while the sheet shrinks back around the input, then clears.
      return s.open ? s : blank
    case 'type':
      return m.kind === 'add' ? { ...s, mode: { ...m, text: e.text } } : s
    case 'field':
      return m.kind === 'edit' ? { ...s, mode: { ...m, fields: { ...m.fields, [e.key]: e.value } } } : s
    case 'store':
      return { ...s, mode: { ...m, storeId: e.id, fold: null } }
    case 'category':
      return { ...s, mode: { ...m, categoryId: e.id, fold: null } }
    case 'fold':
      return { ...s, mode: { ...m, fold: m.fold === e.fold ? null : e.fold } }
    case 'added':
      return { ...s, mode: blankAdd }
  }
}

/** Only what the user changed, so saving never rewrites a field they did not touch. */
export function editPatch(m: EditMode): Partial<Omit<Item, 'id'>> {
  const { item, fields } = m
  const patch: Partial<Omit<Item, 'id'>> = {}
  const name = fields.name.trim()
  if (name !== item.name) {
    patch.name = name
    const known = findProduct(name)
    if (known) patch.emoji = known.product.emoji
  }
  const brand = fields.brand.trim()
  if (brand !== (item.brand ?? '')) patch.brand = brand || undefined
  if (fields.props.trim() !== joinProps(item.props)) patch.props = splitProps(fields.props)
  const qty = fields.qty.trim()
  if (qty !== item.qty) patch.qty = qty || '1'
  if (m.storeId !== item.storeId) patch.storeId = m.storeId
  if (m.categoryId !== item.categoryId) patch.categoryId = m.categoryId
  return patch
}

export const SHEET_MS = 280

/**
 * The bottom composer. Add: one input that is the add bar when closed and the sheet's input when open. Edit: the
 * same surface with one labelled field per part of the item, and Löschen / Fertig where the input sits.
 */
export function useComposer(groceries: Groceries) {
  const { lang } = useI18n()
  const [s, dispatch] = useReducer(reducer, blank)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (s.open) return
    const t = setTimeout(() => dispatch({ type: 'settled' }), SHEET_MS + 40)
    return () => clearTimeout(t)
  }, [s.open])

  const history = useMemo(() => [...groceries.recentlyBought, ...HISTORY], [groceries.recentlyBought])
  const text = s.mode.kind === 'add' ? s.mode.text : ''

  /** Raw suggestions, before the chips apply, so the chips can show the guess they would replace. */
  const raw: Suggestion[] = useMemo(() => suggestionsFor(text, { memory: groceries.memory, history }), [text, groceries.memory, history])

  const pick = s.mode.kind === 'add' ? s.mode : null
  const suggestions: Suggestion[] = useMemo(
    () =>
      raw.map((x) => ({
        ...x,
        draft: { ...x.draft, props: localizeProps(x.draft.props, lang), storeId: pick?.storeId ?? x.draft.storeId, categoryId: pick?.categoryId ?? x.draft.categoryId },
      })),
    [raw, lang, pick?.storeId, pick?.categoryId],
  )

  const guess = raw[0]?.draft
  const mode = s.mode
  const close = () => {
    dispatch({ type: 'close' })
    input.current?.blur()
  }

  return {
    open: s.open,
    mode,
    input,
    suggestions,
    /** what the chips display: the user's pick, else the first suggestion's guess, else automatic */
    storeId: mode.storeId ?? guess?.storeId ?? null,
    categoryId: mode.categoryId ?? guess?.categoryId ?? null,
    storeSet: mode.kind === 'add' ? mode.storeId !== null && mode.storeId !== guess?.storeId : mode.storeId !== mode.item.storeId,
    categorySet: mode.kind === 'add' ? mode.categoryId !== null && mode.categoryId !== guess?.categoryId : mode.categoryId !== mode.item.categoryId,
    /** the chip's store applies to every row once picked; otherwise a row with its own store shows a badge */
    storePinned: mode.kind === 'add' && mode.storeId !== null,
    canSave: mode.kind === 'edit' && mode.fields.name.trim() !== '',
    openAdd: () => dispatch({ type: 'openAdd' }),
    openEdit: (item: Item) => {
      input.current?.blur()
      dispatch({ type: 'openEdit', item })
    },
    close,
    setText: (t: string) => dispatch({ type: 'type', text: t }),
    setField: (key: keyof Fields, value: string) => dispatch({ type: 'field', key, value }),
    setStore: (id: StoreId) => dispatch({ type: 'store', id }),
    setCategory: (id: CategoryId) => dispatch({ type: 'category', id }),
    toggleFold: (fold: Fold) => dispatch({ type: 'fold', fold }),
    add: (d: Draft) => {
      groceries.actions.add(d)
      dispatch({ type: 'added' })
      input.current?.focus()
    },
    save: () => {
      if (mode.kind !== 'edit' || !mode.fields.name.trim()) return
      const patch = editPatch(mode)
      if (Object.keys(patch).length) groceries.actions.update(mode.item.id, patch)
      close()
    },
    remove: () => {
      if (mode.kind !== 'edit') return
      groceries.actions.remove(mode.item.id)
      close()
    },
  }
}

export type Composer = ReturnType<typeof useComposer>
