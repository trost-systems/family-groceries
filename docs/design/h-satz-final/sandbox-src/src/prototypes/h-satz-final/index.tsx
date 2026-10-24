import { useState, type ReactNode } from 'react'
import type { PrototypeMeta } from '../../registry'
import { ListDnd, SortableCategories, SortableStores, useCategorySortable, useHeaderTap, useRowGesture, useStoreSortable } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { round2State } from '../../shared/mockData'
import { qtyLabel, storeTint } from '../../shared/round2/format'
import { useCollapsedStores } from '../../shared/round2/useCollapsedStores'
import { useGroceries, type CategoryGroup, type Groceries, type StoreSection } from '../../shared/store'
import type { Item, StoreId } from '../../shared/types'
import { MoreScreen } from '../../shared/ui/MoreScreen'
import { Snackbar } from '../../shared/ui/Snackbar'
import { BackToIndex, GestureHint, LangToggle, StoreBadge } from '../../shared/ui/bits'
import { Composer, type Tab } from './Composer'
import { useComposer } from './useComposer'
import '../../shared/round2/shell.css'
import './h.css'

export const meta: PrototypeMeta = {
  letter: 'H',
  round: 3,
  title: { de: 'Satz · Laufweg', en: 'Sentence · Walk order' },
  rationale: {
    de: 'Peters Favorit E, fertig gedacht: Laufreihenfolge im Laden, leise Trenner ohne Kleben, Bearbeiten Feld für Feld, Blatt so groß wie nötig.',
    en: 'Peter’s favourite E, finished: items in the order you walk the store, quiet non-sticky dividers, edit field by field, a sheet only as tall as it needs.',
  },
}

interface Collapse {
  isCollapsed: (id: StoreId) => boolean
  toggle: (id: StoreId) => void
}

export default function SatzFinal() {
  const groceries = useGroceries(round2State)
  const composer = useComposer(groceries)
  const collapse = useCollapsedStores('h')
  const [tab, setTab] = useState<Tab>('list')
  const { t } = useI18n()
  const open = groceries.sections.reduce((n, s) => n + s.count, 0)

  const edit = (id: string) => {
    const item = groceries.sections.flatMap((s) => s.categories.flatMap((c) => c.items)).find((i) => i.id === id)
    if (item) composer.openEdit(item)
  }

  return (
    <div className="h-root">
      {tab === 'list' ? (
        <>
          <header className="r2-top">
            <BackToIndex />
            <div className="r2-top-title">
              <strong>{t('appName')}</strong>
              <span>
                {open} {t('items')}
              </span>
            </div>
            <LangToggle />
          </header>
          <ListDnd groceries={groceries} onEdit={edit} renderItemOverlay={(item) => <Overlay item={item} />}>
            <div className="r2-scroll" data-testid="list-scroll">
              <GestureHint />
              {groceries.sections.length === 0 ? (
                <div className="r2-empty">
                  <span aria-hidden>🧺</span>
                  {t('emptyList')}
                </div>
              ) : (
                <List groceries={groceries} collapse={collapse} />
              )}
            </div>
          </ListDnd>
        </>
      ) : (
        <div className="r2-more">
          <MoreScreen onLogout={() => setTab('list')} />
        </div>
      )}
      <Composer c={composer} groceries={groceries} tab={tab} onTab={setTab} />
      <Snackbar snack={composer.open && groceries.snack?.message.kind === 'added' ? null : groceries.snack} onDismiss={groceries.dismissSnack} bottom={tab === 'list' ? 144 : 72} />
    </div>
  )
}

function List({ groceries, collapse }: { groceries: Groceries; collapse: Collapse }) {
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

/** A store is a section in the scrolling flow: tap its divider to fold it to the count, hold and drag to reorder. */
function StoreBlock({ section, collapse, children }: { section: StoreSection; collapse: Collapse; children: ReactNode }) {
  const { t } = useI18n()
  const { store } = section
  const { containerProps, handleProps, isDragging, isItemOver, collapsed: reordering } = useStoreSortable(store.id)
  const folded = collapse.isCollapsed(store.id)
  const tap = useHeaderTap(() => collapse.toggle(store.id))
  return (
    <section
      {...containerProps}
      className={`h-store ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${folded || reordering ? 'folded' : ''}`}
      style={{ ...containerProps.style, ['--h-tint' as string]: storeTint(store) }}
      data-collapsed={String(folded)}
    >
      <header {...handleProps} className="h-store-head" onClick={tap} aria-expanded={!folded} aria-label={`${store.name}, ${section.count} ${t('items')}. ${t(folded ? 'expand' : 'collapse')}`}>
        <StoreBadge store={store} size={24} />
        <h2 className="h-store-name">{store.name}</h2>
        <span className="h-store-rule" aria-hidden />
        <span className="h-store-count" data-testid="store-count">
          <b>{section.count}</b> {t('items')}
        </span>
        <span className="h-store-caret" aria-hidden />
      </header>
      {!folded && !reordering && children}
    </section>
  )
}

function CategoryRun({ storeId, group, groceries }: { storeId: string; group: CategoryGroup; groceries: Groceries }) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <div {...containerProps} className={`h-cat ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div {...handleProps} className="h-cat-head">
        <span className="h-cat-name">{l(group.category.name)}</span>
        <span className="h-cat-rule" aria-hidden />
      </div>
      {!collapsed && group.items.map((item) => <Row key={item.id} item={item} groceries={groceries} />)}
    </div>
  )
}

function Row({ item, groceries }: { item: Item; groceries: Groceries }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging, dropEdge } = useRowGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => groceries.actions.check(item.id), 260)
  })
  const meta = [item.brand, ...item.props].filter(Boolean).join(' · ')
  return (
    <div {...itemProps} className={`h-item ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''} ${dropEdge ? `drop-${dropEdge}` : ''}`}>
      <span className="h-emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="h-text">
        <span className="h-name">
          {item.qty !== '1' && <b className="h-qty">{qtyLabel(item.qty)}</b>}
          {item.name}
        </span>
        {meta && <span className="h-meta">{meta}</span>}
      </span>
    </div>
  )
}

function Overlay({ item }: { item: Item }) {
  return (
    <div className="h-overlay">
      <span aria-hidden>{item.emoji}</span>
      {item.qty !== '1' && <b className="h-qty">{qtyLabel(item.qty)}</b>}
      {item.name}
    </div>
  )
}
