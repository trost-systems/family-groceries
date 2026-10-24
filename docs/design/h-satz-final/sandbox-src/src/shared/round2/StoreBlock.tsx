import type { ReactNode } from 'react'
import { useHeaderTap, useStoreSortable } from '../dnd'
import { useI18n } from '../i18n'
import type { StoreSection } from '../store'
import { StoreBadge } from '../ui/bits'
import { storeTint } from './format'
import type { Collapse } from './Shell'

const PEEK = 6

/**
 * A store's band and its content. Tap the band to fold the store (the count and a strip of its items' icons stay);
 * hold and drag the band to reorder stores. A folded band still takes item drops.
 */
export function StoreBlock({ section, collapse, children }: { section: StoreSection; collapse: Collapse; children: ReactNode }) {
  const { t } = useI18n()
  const { store } = section
  const { containerProps, handleProps, isDragging, isItemOver, collapsed: reordering } = useStoreSortable(store.id)
  const folded = collapse.isCollapsed(store.id)
  const tap = useHeaderTap(() => collapse.toggle(store.id))
  const emojis = section.categories.flatMap((c) => c.items.map((i) => i.emoji))
  return (
    <section
      {...containerProps}
      className={`r2-store ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${folded || reordering ? 'folded' : ''}`}
      style={{ ...containerProps.style, ['--r2-tint' as string]: storeTint(store) }}
      data-collapsed={String(folded)}
    >
      <header {...handleProps} className="r2-band" onClick={tap} aria-expanded={!folded} aria-label={`${store.name}, ${section.count} ${t('items')}. ${t(folded ? 'expand' : 'collapse')}`}>
        <StoreBadge store={store} size={30} />
        <h2>{store.name}</h2>
        {folded && (
          <span className="r2-band-peek" aria-hidden>
            {emojis.slice(0, PEEK).join('')}
            {emojis.length > PEEK && '…'}
          </span>
        )}
        <span className="r2-band-count" data-testid="store-count">
          <b>{section.count}</b>
          <small>{t('items')}</small>
        </span>
        <span className="r2-band-caret" aria-hidden>
          ▾
        </span>
      </header>
      {!folded && !reordering && children}
    </section>
  )
}
