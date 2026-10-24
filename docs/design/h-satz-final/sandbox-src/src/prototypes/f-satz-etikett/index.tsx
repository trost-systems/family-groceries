import { useState, type HTMLAttributes, type ReactNode, type SyntheticEvent } from 'react'
import type { PrototypeMeta } from '../../registry'
import { SortableCategories, SortableStores, useCategorySortable, useItemGesture } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { Round2Shell, type ListProps } from '../../shared/round2/Shell'
import { StoreBlock } from '../../shared/round2/StoreBlock'
import { qtyLabel } from '../../shared/round2/format'
import type { CategoryGroup, Groceries } from '../../shared/store'
import type { Item } from '../../shared/types'
import './f.css'

export const meta: PrototypeMeta = {
  letter: 'F',
  round: 2,
  title: { de: 'Satz · Etikett', en: 'Sentence · Tag' },
  rationale: {
    de: 'Keine Kategoriezeilen: die erste Zeile jeder Gruppe trägt die Kategorie als kleines Etikett, ein breiterer Trennstreifen grenzt die Gruppen ab. Kostet null Zeilen.',
    en: 'No category rows: the first row of each group carries the category as a small tag, and a wider divider band separates groups. Costs zero rows.',
  },
}

export default function SatzEtikett() {
  return <Round2Shell variant="f" className="f-root" List={List} overlay={(item) => <Overlay item={item} />} />
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
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  const tag = <Tag group={group} handleProps={handleProps} />
  return (
    <div {...containerProps} className={`f-cat ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''}`}>
      {collapsed ? (
        <div className="f-marker">
          {tag}
          <span className="f-marker-count">{group.items.length}</span>
        </div>
      ) : (
        group.items.map((item, i) => <Row key={item.id} item={item} groceries={groceries} tag={i === 0 ? tag : null} />)
      )}
    </div>
  )
}

// The tag sits inside the first item row; keep its taps and context menus from checking or editing that item.
const swallow = (e: SyntheticEvent) => e.stopPropagation()
const swallowMenu = (e: SyntheticEvent) => {
  e.preventDefault()
  e.stopPropagation()
}

function Tag({ group, handleProps }: { group: CategoryGroup; handleProps: HTMLAttributes<HTMLElement> }) {
  const { l } = useI18n()
  return (
    <span {...handleProps} className="f-tag" onClick={swallow} onContextMenu={swallowMenu}>
      <span aria-hidden>{group.category.emoji}</span>
      <span className="f-tag-name">{l(group.category.name)}</span>
    </span>
  )
}

function Row({ item, groceries, tag }: { item: Item; groceries: Groceries; tag: ReactNode }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => groceries.actions.check(item.id), 260)
  })
  const meta = [item.brand, ...item.props].filter(Boolean).join(' · ')
  return (
    <div {...itemProps} className={`f-item ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''}`}>
      <span className="f-emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="f-text">
        <span className="f-name">
          {item.qty !== '1' && <b className="f-qty">{qtyLabel(item.qty)}</b>}
          {item.name}
        </span>
        {meta && <span className="f-meta">{meta}</span>}
      </span>
      {item.addedBy !== 'Peter' && (
        <span className="f-who" title={item.addedBy}>
          {item.addedBy[0]}
        </span>
      )}
      {tag}
    </div>
  )
}

function Overlay({ item }: { item: Item }) {
  return (
    <div className="f-overlay">
      <span aria-hidden>{item.emoji}</span>
      {item.qty !== '1' && <b className="f-qty">{qtyLabel(item.qty)}</b>}
      {item.name}
    </div>
  )
}
