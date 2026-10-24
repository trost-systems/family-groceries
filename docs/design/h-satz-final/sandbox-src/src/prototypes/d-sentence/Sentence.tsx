import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n } from '../../shared/i18n'
import { StoreBadge } from '../../shared/ui/bits'
import type { Category, CategoryId, Draft, Lang, Store, StoreId } from '../../shared/types'

export const WORDS = {
  by: { de: 'von', en: 'by' },
  at: { de: 'bei', en: 'at' },
  in: { de: 'in', en: 'in' },
  addAsIs: { de: 'So hinzufügen', en: 'Add as is' },
  tapToCycle: { de: 'Antippen wechselt, oder direkt wählen', en: 'Tap to cycle, or pick directly' },
  brandPh: { de: 'Marke', en: 'brand' },
  propsPh: { de: 'Details', en: 'details' },
} satisfies Record<string, Record<Lang, string>>

export const isCount = (qty: string) => /^\d+$/.test(qty.trim())
export const qtyLabel = (qty: string) => (isCount(qty) ? `${qty}×` : qty)

/** Brand tint for a store: the badge background, unless it is white (dm), then the logo color. */
export function storeTint(store: Store): string {
  return /^#f{3,6}$/i.test(store.badge.bg) ? store.badge.fg : store.badge.bg
}

type Rail = 'store' | 'category' | null

/**
 * The item as one sentence: `head` is the words (qty, name, brand, props), followed by
 * "· bei [store] · in [category]". Each token cycles to the next option on tap and opens a rail for direct picks.
 */
export function Sentence({
  head,
  storeId,
  categoryId,
  stores,
  categories,
  onStore,
  onCategory,
}: {
  head: ReactNode
  storeId: StoreId
  categoryId: CategoryId
  stores: Store[]
  categories: Category[]
  onStore: (id: StoreId) => void
  onCategory: (id: CategoryId) => void
}) {
  const { l } = useI18n()
  const [rail, setRail] = useState<Rail>(null)
  const store = stores.find((s) => s.id === storeId) ?? stores[0]
  const category = categories.find((c) => c.id === categoryId) ?? categories[categories.length - 1]
  const next = <T extends { id: string }>(list: T[], id: string) => list[(list.findIndex((x) => x.id === id) + 1) % list.length].id

  return (
    <div className="d-sentence-wrap">
      <p className="d-sentence">
        {head}
        <span className="d-conn"> · {l(WORDS.at)} </span>
        <button
          type="button"
          className={`d-token ${rail === 'store' ? 'on' : ''}`}
          style={{ ['--d-tint' as string]: storeTint(store) }}
          data-testid="preview-store"
          onClick={() => {
            onStore(next(stores, store.id))
            setRail('store')
          }}
        >
          <span className="d-token-in" key={store.id}>
            <StoreBadge store={store} size={22} />
            {store.name}
          </span>
          <span className="d-cycle" aria-hidden>
            ↻
          </span>
        </button>
        <span className="d-conn"> · {l(WORDS.in)} </span>
        <button
          type="button"
          className={`d-token ${rail === 'category' ? 'on' : ''}`}
          data-testid="preview-category"
          onClick={() => {
            onCategory(next(categories, category.id))
            setRail('category')
          }}
        >
          <span className="d-token-in" key={category.id}>
            <span className="d-token-emoji">{category.emoji}</span>
            {l(category.name)}
          </span>
          <span className="d-cycle" aria-hidden>
            ↻
          </span>
        </button>
      </p>
      {rail && (
        <div className="d-rail-wrap" key={rail}>
          <div className="d-rail-hint">{l(WORDS.tapToCycle)}</div>
          <div className="d-rail" role="listbox">
            {rail === 'store'
              ? stores.map((s) => (
                  <RailChip
                    key={s.id}
                    active={s.id === store.id}
                    testId={`store-option-${s.id}`}
                    onPick={() => {
                      onStore(s.id)
                      setRail(null)
                    }}
                  >
                    <StoreBadge store={s} size={20} />
                    {s.name}
                  </RailChip>
                ))
              : categories.map((c) => (
                  <RailChip
                    key={c.id}
                    active={c.id === category.id}
                    testId={`category-option-${c.id}`}
                    onPick={() => {
                      onCategory(c.id)
                      setRail(null)
                    }}
                  >
                    <span>{c.emoji}</span>
                    {l(c.name)}
                  </RailChip>
                ))}
          </div>
        </div>
      )}
    </div>
  )
}

function RailChip({ active, testId, onPick, children }: { active: boolean; testId: string; onPick: () => void; children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])
  return (
    <button ref={ref} type="button" role="option" aria-selected={active} className={`d-chip ${active ? 'on' : ''}`} data-testid={testId} onClick={onPick}>
      {children}
    </button>
  )
}

/** Read-only words of a draft, tinted per field. Brand and props re-animate when their value changes. */
export function DraftWords({ d }: { d: Pick<Draft, 'qty' | 'name' | 'brand' | 'props'> }) {
  const { l } = useI18n()
  return (
    <>
      <span className={`d-w d-w--qty ${isCount(d.qty) && d.qty === '1' ? 'one' : ''}`} key={`q${d.qty}`}>
        {qtyLabel(d.qty)}
      </span>{' '}
      <span className="d-w d-w--name">{d.name || '…'}</span>
      {d.brand && (
        <>
          <span className="d-conn"> {l(WORDS.by)} </span>
          <span className="d-w d-w--brand" key={`b${d.brand}`}>
            {d.brand}
          </span>
        </>
      )}
      {d.props.map((p) => (
        <span key={`p${p}`}>
          <span className="d-conn">, </span>
          <span className="d-w d-w--props">{p}</span>
        </span>
      ))}
    </>
  )
}
