import { useState } from 'react'
import type { StoreId } from '../types'

/** Which stores the user folded away, per variant, for this browser session. */
export function useCollapsedStores(variant: string) {
  const key = `fg-r2-collapsed:${variant}`
  const [collapsed, setCollapsed] = useState<ReadonlySet<StoreId>>(() => {
    try {
      return new Set(JSON.parse(sessionStorage.getItem(key) ?? '[]') as StoreId[])
    } catch {
      return new Set()
    }
  })
  const toggle = (id: StoreId) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      sessionStorage.setItem(key, JSON.stringify([...next]))
      return next
    })
  return { isCollapsed: (id: StoreId) => collapsed.has(id), toggle }
}
