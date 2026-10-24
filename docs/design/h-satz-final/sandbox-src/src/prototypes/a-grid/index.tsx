import { useState } from 'react'
import type { PrototypeMeta } from '../../registry'
import { ListDnd, SortableCategories, SortableStores, useCategorySortable, useItemGesture, useStoreSortable } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { useGroceries, type CategoryGroup, type Groceries, type StoreSection } from '../../shared/store'
import type { Item, ItemId } from '../../shared/types'
import { BackToIndex, GestureHint, LangToggle, StoreBadge } from '../../shared/ui/bits'
import { MoreScreen } from '../../shared/ui/MoreScreen'
import { Snackbar } from '../../shared/ui/Snackbar'
import { AddSheet } from './AddSheet'
import { ItemEditor } from './ItemEditor'
import { TileFace } from './Tile'
import './a-grid.css'

export const meta: PrototypeMeta = {
  letter: 'A',
  title: { de: 'Regal', en: 'Shelf' },
  rationale: {
    de: 'Bildkacheln im 3er-Raster: Emoji zuerst erkennen, dann lesen. Die Vorschau beim Hinzufügen ist dieselbe Kachel in groß.',
    en: 'Illustrated tiles in a 3-column grid: recognise the emoji first, read second. The add preview is the same tile, large.',
  },
}

const CHECK_MS = 420
/** add bar + navigation bar height, so the snackbar floats above both */
const BOTTOM_CHROME = 140

interface ListCtx {
  groceries: Groceries
  editing: ItemId | null
  closeEditor: () => void
}

function ItemTile({ item, groceries }: { item: Item; groceries: Groceries }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    navigator.vibrate?.(8)
    setTimeout(() => groceries.actions.check(item.id), CHECK_MS)
  })
  return (
    <div {...itemProps} className={`a-tile ${leaving ? 'is-leaving' : ''} ${isDragging ? 'is-dragging' : ''}`}>
      <TileFace d={item} size="grid" />
      {leaving && (
        <span className="a-check" aria-hidden>
          <svg viewBox="0 0 24 24" width="34" height="34">
            <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      )}
    </div>
  )
}

function CategoryBlock({ storeId, group, ctx }: { storeId: string; group: CategoryGroup; ctx: ListCtx }) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <div {...containerProps} className={`a-cat ${isItemOver ? 'is-over' : ''} ${isDragging ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <div {...handleProps} className="a-cat-head">
        <span className="a-cat-emoji" aria-hidden>
          {group.category.emoji}
        </span>
        <span className="a-cat-name">{l(group.category.name)}</span>
        <span className="a-cat-n">{group.items.length}</span>
      </div>
      {!collapsed && (
        <div className="a-grid">
          {group.items.map((item) =>
            item.id === ctx.editing ? (
              <ItemEditor key={item.id} item={item} groceries={ctx.groceries} onClose={ctx.closeEditor} />
            ) : (
              <ItemTile key={item.id} item={item} groceries={ctx.groceries} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function StoreBlock({ section, ctx }: { section: StoreSection; ctx: ListCtx }) {
  const { t } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useStoreSortable(section.store.id)
  const ids = section.categories.map((c) => c.category.id)
  return (
    <section {...containerProps} className={`a-store ${isItemOver ? 'is-over' : ''} ${isDragging ? 'is-dragging' : ''} ${collapsed ? 'is-collapsed' : ''}`}>
      <header {...handleProps} className="a-store-head">
        <StoreBadge store={section.store} size={32} />
        <h2>{section.store.name}</h2>
        <span className="a-store-n">
          {section.count} {t('items')}
        </span>
        <span className="a-grip" aria-hidden>
          ⋮⋮
        </span>
      </header>
      {!collapsed && (
        <SortableCategories storeId={section.store.id} ids={ids}>
          {section.categories.map((g) => (
            <CategoryBlock key={g.category.id} storeId={section.store.id} group={g} ctx={ctx} />
          ))}
        </SortableCategories>
      )}
    </section>
  )
}

export default function GridPrototype() {
  const { t } = useI18n()
  const groceries = useGroceries()
  const [tab, setTab] = useState<'list' | 'more'>('list')
  const [editing, setEditing] = useState<ItemId | null>(null)
  const [adding, setAdding] = useState(false)
  const { sections } = groceries
  const total = sections.reduce((n, s) => n + s.count, 0)
  const ctx: ListCtx = { groceries, editing, closeEditor: () => setEditing(null) }

  return (
    <div className="a-root">
      {tab === 'more' ? (
        <MoreScreen onLogout={() => setTab('list')} />
      ) : (
        <>
          <header className="a-appbar">
            <BackToIndex />
            <div className="a-title">
              <h1>{t('appName')}</h1>
              <span className="a-sub">
                <span className="a-avatars" aria-hidden>
                  <span className="a-av p">P</span>
                  <span className="a-av l">L</span>
                </span>
                {total} {t('items')} · Peter & Sam
              </span>
            </div>
            <LangToggle />
          </header>
          <main className="a-scroll">
            <GestureHint />
            {sections.length === 0 ? (
              <div className="a-empty">
                <span aria-hidden>🧺</span>
                {t('emptyList')}
              </div>
            ) : (
              <ListDnd
                groceries={groceries}
                onEdit={setEditing}
                renderItemOverlay={(item) => (
                  <div className="a-tile a-tile--lifted">
                    <TileFace d={item} size="grid" />
                  </div>
                )}
              >
                <SortableStores ids={sections.map((s) => s.store.id)}>
                  {sections.map((s) => (
                    <StoreBlock key={s.store.id} section={s} ctx={ctx} />
                  ))}
                </SortableStores>
              </ListDnd>
            )}
            <p className="a-foot">{t('editHint')} · {t('dragHint')}</p>
          </main>
          <div className="a-addbar-wrap">
            <button className="a-addbar" data-testid="add-open" onClick={() => setAdding(true)}>
              <span className="a-addbar-plus" aria-hidden>
                +
              </span>
              <span>{t('addPlaceholder')}</span>
              <span className="a-addbar-mic" aria-hidden>
                🎙️
              </span>
            </button>
          </div>
        </>
      )}
      <nav className="a-nav">
        <button className={`a-tab ${tab === 'list' ? 'is-on' : ''}`} data-testid="tab-list" onClick={() => setTab('list')}>
          <span className="a-tab-icon" aria-hidden>
            🛒
          </span>
          <span>{t('tabList')}</span>
        </button>
        <button className={`a-tab ${tab === 'more' ? 'is-on' : ''}`} data-testid="tab-more" onClick={() => setTab('more')}>
          <span className="a-tab-icon" aria-hidden>
            ☰
          </span>
          <span>{t('tabMore')}</span>
        </button>
      </nav>
      <AddSheet groceries={groceries} open={adding} onClose={() => setAdding(false)} />
      <Snackbar snack={groceries.snack} onDismiss={groceries.dismissSnack} bottom={tab === 'list' ? BOTTOM_CHROME : 84} />
    </div>
  )
}
