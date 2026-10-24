import { useState } from 'react'
import type { PrototypeMeta } from '../../registry'
import { SortableCategories, SortableStores, useCategorySortable, useItemGesture } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { Round2Shell, type ListProps } from '../../shared/round2/Shell'
import { StoreBlock } from '../../shared/round2/StoreBlock'
import { qtyLabel } from '../../shared/round2/format'
import type { CategoryGroup, Groceries } from '../../shared/store'
import type { Item } from '../../shared/types'
import './e.css'

export const meta: PrototypeMeta = {
  letter: 'E',
  round: 2,
  title: { de: 'Satz · Zwischenzeilen', en: 'Sentence · Inline headings' },
  rationale: {
    de: 'Kategorien als schmale Zwischenzeile im Fluss des Ladens, die beim Scrollen oben kleben. Am klarsten, kostet eine dünne Zeile pro Kategorie.',
    en: 'Categories as slim heading rows inside the store’s flow that stick while scrolling. Clearest; costs one thin row per category.',
  },
}

export default function SatzZeilen() {
  return <Round2Shell variant="e" className="e-root" List={List} overlay={(item) => <Overlay item={item} />} />
}

function List({ groceries, collapse }: ListProps) {
  return (
    <SortableStores ids={groceries.sections.map((s) => s.store.id)}>
      {groceries.sections.map((s) => (
        <StoreBlock key={s.store.id} section={s} collapse={collapse}>
          <SortableCategories storeId={s.store.id} ids={s.categories.map((c) => c.category.id)}>
            {s.categories.map((g) => (
              <CategoryRun key={g.category.id} storeId={s.store.id} group={g} groceries={groceries} />
            ))}
          </SortableCategories>
        </StoreBlock>
      ))}
    </SortableStores>
  )
}

function CategoryRun({ storeId, group, groceries }: { storeId: string; group: CategoryGroup; groceries: Groceries }) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <div {...containerProps} className={`e-cat ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div {...handleProps} className="e-cathead">
        <span aria-hidden>{group.category.emoji}</span>
        <span className="e-cathead-name">{l(group.category.name)}</span>
        <span className="e-cathead-rule" aria-hidden />
        <span className="e-cathead-count">{group.items.length}</span>
      </div>
      {!collapsed && group.items.map((item) => <Row key={item.id} item={item} groceries={groceries} />)}
    </div>
  )
}

function Row({ item, groceries }: { item: Item; groceries: Groceries }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => groceries.actions.check(item.id), 260)
  })
  const meta = [item.brand, ...item.props].filter(Boolean).join(' · ')
  return (
    <div {...itemProps} className={`e-item ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''}`}>
      <span className="e-emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="e-text">
        <span className="e-name">
          {item.qty !== '1' && <b className="e-qty">{qtyLabel(item.qty)}</b>}
          {item.name}
        </span>
        {meta && <span className="e-meta">{meta}</span>}
      </span>
      {item.addedBy !== 'Peter' && (
        <span className="e-who" title={item.addedBy}>
          {item.addedBy[0]}
        </span>
      )}
    </div>
  )
}

function Overlay({ item }: { item: Item }) {
  return (
    <div className="e-overlay">
      <span aria-hidden>{item.emoji}</span>
      {item.qty !== '1' && <b className="e-qty">{qtyLabel(item.qty)}</b>}
      {item.name}
    </div>
  )
}
