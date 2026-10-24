import { useState } from 'react'
import { useI18n } from '../../shared/i18n'
import { StoreBadge } from '../../shared/ui/bits'
import type { Category, CategoryId, Store, StoreId } from '../../shared/types'

/**
 * Two pill chips (store, category). Tapping one expands an inline accordion row right below with the choices;
 * picking one collapses it. Used by the add sheet and the inline editor.
 */
export function Pickers({
  stores,
  categories,
  storeId,
  categoryId,
  onStore,
  onCategory,
  testPrefix,
}: {
  stores: Store[]
  categories: Category[]
  storeId: StoreId
  categoryId: CategoryId
  onStore: (id: StoreId) => void
  onCategory: (id: CategoryId) => void
  testPrefix: string
}) {
  const { l } = useI18n()
  const [open, setOpen] = useState<'store' | 'category' | null>(null)
  const store = stores.find((s) => s.id === storeId)
  const category = categories.find((c) => c.id === categoryId)
  const toggle = (k: 'store' | 'category') => setOpen((o) => (o === k ? null : k))

  return (
    <div className="a-pickers">
      <div className="a-pills">
        <button className={`a-pill ${open === 'store' ? 'is-open' : ''}`} data-testid={`${testPrefix}-store`} onClick={() => toggle('store')} aria-expanded={open === 'store'}>
          {store ? <StoreBadge store={store} size={22} /> : '🏬'}
          <span>{store?.name ?? storeId}</span>
          <span className="a-caret" aria-hidden>
            ▾
          </span>
        </button>
        <button className={`a-pill ${open === 'category' ? 'is-open' : ''}`} data-testid={`${testPrefix}-category`} onClick={() => toggle('category')} aria-expanded={open === 'category'}>
          <span aria-hidden>{category?.emoji}</span>
          <span>{category ? l(category.name) : categoryId}</span>
          <span className="a-caret" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      {open === 'store' && (
        <div className="a-accordion a-accordion--stores" role="listbox">
          {stores.map((s) => (
            <button
              key={s.id}
              className={`a-store-opt ${s.id === storeId ? 'is-on' : ''}`}
              data-testid={`store-option-${s.id}`}
              role="option"
              aria-selected={s.id === storeId}
              onClick={() => {
                onStore(s.id)
                setOpen(null)
              }}
            >
              <StoreBadge store={s} size={36} />
              <span>{s.name}</span>
            </button>
          ))}
        </div>
      )}
      {open === 'category' && (
        <div className="a-accordion a-accordion--cats" role="listbox">
          {categories.map((c) => (
            <button
              key={c.id}
              className={`a-cat-opt ${c.id === categoryId ? 'is-on' : ''}`}
              data-testid={`category-option-${c.id}`}
              role="option"
              aria-selected={c.id === categoryId}
              onClick={() => {
                onCategory(c.id)
                setOpen(null)
              }}
            >
              <span aria-hidden>{c.emoji}</span>
              <span>{l(c.name)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
