import { useMemo, useState } from 'react'
import { useI18n } from './i18n'
import { localizeProps, suggest } from './parser'
import type { Groceries } from './store'
import type { CategoryId, Draft, StoreId } from './types'

/**
 * State of the add sheet: raw text, the live parse, and the user's inline store/category override.
 * Overrides survive further typing and apply to every suggestion, so "type, fix store, tap suggestion" stays two taps.
 */
export function useAddFlow(groceries: Groceries) {
  const { lang } = useI18n()
  const [text, setText] = useState('')
  const [storeId, setStoreId] = useState<StoreId | null>(null)
  const [categoryId, setCategoryId] = useState<CategoryId | null>(null)

  const suggestions: Draft[] = useMemo(
    () =>
      suggest(text, groceries.memory).map((d) => ({
        ...d,
        props: localizeProps(d.props, lang),
        storeId: storeId ?? d.storeId,
        categoryId: categoryId ?? d.categoryId,
      })),
    [text, groceries.memory, storeId, categoryId, lang],
  )

  const reset = () => {
    setText('')
    setStoreId(null)
    setCategoryId(null)
  }

  const add = (d: Draft) => {
    groceries.actions.add(d)
    reset()
  }

  return {
    text,
    setText,
    /** first entry is the plain parse, shown as the live preview */
    suggestions,
    preview: suggestions[0] ?? null,
    setStore: setStoreId,
    setCategory: setCategoryId,
    storeOverridden: storeId !== null,
    categoryOverridden: categoryId !== null,
    add,
    reset,
  }
}

export type AddFlow = ReturnType<typeof useAddFlow>
