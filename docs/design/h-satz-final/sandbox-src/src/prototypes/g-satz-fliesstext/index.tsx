import { Fragment, useState } from 'react'
import type { PrototypeMeta } from '../../registry'
import { SortableCategories, SortableStores, useCategorySortable, useItemGesture } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { Round2Shell, type ListProps } from '../../shared/round2/Shell'
import { StoreBlock } from '../../shared/round2/StoreBlock'
import { qtyLabel } from '../../shared/round2/format'
import type { CategoryGroup, Groceries } from '../../shared/store'
import type { Item } from '../../shared/types'
import './g.css'

export const meta: PrototypeMeta = {
  letter: 'G',
  round: 2,
  title: { de: 'Satz · Fließtext', en: 'Sentence · Running text' },
  rationale: {
    de: 'Jede Kategorie ist ein Absatz, der sich wie ein Satz liest: Kategorie vorneweg, dann die Artikel wie Wörter. Am dichtesten, dafür weniger Zeilenraster.',
    en: 'Each category is one paragraph that reads like a sentence: category first, then the items like words. Densest; trades away the row grid.',
  },
}

export default function SatzFliesstext() {
  return <Round2Shell variant="g" className="g-root" List={List} overlay={(item) => <Overlay item={item} />} />
}

function List({ groceries, collapse }: ListProps) {
  return (
    <SortableStores ids={groceries.sections.map((s) => s.store.id)}>
      {groceries.sections.map((s) => (
        <StoreBlock key={s.store.id} section={s} collapse={collapse}>
          <SortableCategories storeId={s.store.id} ids={s.categories.map((c) => c.category.id)}>
            {s.categories.map((g) => (
              <Paragraph key={g.category.id} storeId={s.store.id} group={g} groceries={groceries} />
            ))}
          </SortableCategories>
        </StoreBlock>
      ))}
    </SortableStores>
  )
}

function Paragraph({ storeId, group, groceries }: { storeId: string; group: CategoryGroup; groceries: Groceries }) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <p {...containerProps} className={`g-par ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <span {...handleProps} className="g-label">
        <span aria-hidden>{group.category.emoji}</span> {l(group.category.name)}
        {collapsed && <span className="g-count"> {group.items.length}</span>}
      </span>
      {!collapsed &&
        group.items.map((item, i) => (
          <Fragment key={item.id}>
            {i > 0 && (
              <span className="g-sep" aria-hidden>
                {' · '}
              </span>
            )}
            <Token item={item} groceries={groceries} />
          </Fragment>
        ))}
    </p>
  )
}

function Token({ item, groceries }: { item: Item; groceries: Groceries }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => groceries.actions.check(item.id), 260)
  })
  const meta = [item.brand, ...item.props].filter(Boolean).join(', ')
  return (
    <span {...itemProps} className={`g-item ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''}`}>
      <span className="g-emoji" aria-hidden>
        {item.emoji}
      </span>
      {item.qty !== '1' && <b className="g-qty">{qtyLabel(item.qty)}</b>}
      <span className="g-name">{item.name}</span>
      {meta && <span className="g-meta">{meta}</span>}
      {item.addedBy !== 'Peter' && (
        <span className="g-who" title={item.addedBy}>
          {item.addedBy[0]}
        </span>
      )}
    </span>
  )
}

function Overlay({ item }: { item: Item }) {
  return (
    <div className="g-overlay">
      <span aria-hidden>{item.emoji}</span>
      {item.qty !== '1' && <b className="g-qty">{qtyLabel(item.qty)}</b>}
      {item.name}
    </div>
  )
}
