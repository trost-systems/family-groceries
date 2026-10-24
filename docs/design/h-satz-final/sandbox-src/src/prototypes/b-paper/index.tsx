import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useRevealOnMount } from '../../shared/useRevealOnMount'
import type { PrototypeMeta } from '../../registry'
import { ListDnd, SortableCategories, SortableStores, useCategorySortable, useItemGesture, useStoreSortable } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { useGroceries, type CategoryGroup, type Groceries, type StoreSection } from '../../shared/store'
import type { CategoryId, Draft, Item, ListState, StoreId } from '../../shared/types'
import { useAddFlow } from '../../shared/useAddFlow'
import { MoreScreen } from '../../shared/ui/MoreScreen'
import { Sheet } from '../../shared/ui/Sheet'
import { Snackbar } from '../../shared/ui/Snackbar'
import { BackToIndex, GestureHint, LangToggle, StoreBadge } from '../../shared/ui/bits'
import './b-paper.css'

export const meta: PrototypeMeta = {
  letter: 'B',
  title: { de: 'Zettel', en: 'Paper list' },
  rationale: {
    de: 'Eine Zeile pro Artikel, winziges Emoji, Menge rechtsbündig: am meisten auf einen Blick, schnellstes Abhaken im Laden. Laden und Kategorie beim Hinzufügen als immer sichtbare Chip-Leisten.',
    en: 'One line per item, tiny emoji, quantity right-aligned: most items per screen, fastest check-off in the aisle. Store and category in the add sheet are always-visible chip rails.',
  },
}

const COPY = {
  title: { de: 'Einkaufszettel', en: 'Shopping list' },
  done: { de: 'Erledigt', en: 'Done' },
  propsHint: { de: 'kommagetrennt', en: 'comma separated' },
}

function qtyLabel(qty: string): string {
  return /^\d+$/.test(qty) ? `${qty}×` : qty
}

function Details({ item }: { item: Pick<Item, 'brand' | 'props'> }) {
  const bits = [item.brand, ...item.props].filter(Boolean)
  if (!bits.length) return null
  return <span className="b-details">{bits.join(' · ')}</span>
}

function Row({ item, leaving }: { item: Item; leaving?: boolean }) {
  return (
    <>
      <span className={`b-check ${leaving ? 'on' : ''}`} aria-hidden>
        {leaving ? '✓' : ''}
      </span>
      <span className="b-emoji" aria-hidden>
        {item.emoji}
      </span>
      <span className="b-text">
        <span className="b-name">{item.name}</span>
        <Details item={item} />
      </span>
      {item.addedBy === 'Sam' && (
        <span className="b-who" title="Sam">
          S
        </span>
      )}
      <span className="b-qty">{qtyLabel(item.qty)}</span>
    </>
  )
}

/** Keeps the selected chip in view without scrolling the sheet vertically. */
function useRevealSelected(value: string) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rail = ref.current
    const chip = rail?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (rail && chip) rail.scrollTo({ left: chip.offsetLeft - 16, behavior: 'smooth' })
  }, [value])
  return ref
}

function StoreRail({ state, value, onPick }: { state: ListState; value: StoreId; onPick: (id: StoreId) => void }) {
  const ref = useRevealSelected(value)
  return (
    <div className="b-rail" role="radiogroup" ref={ref}>
      {state.stores.map((s) => (
        <button
          key={s.id}
          role="radio"
          aria-checked={s.id === value}
          className={`b-chip ${s.id === value ? 'on' : ''}`}
          data-testid={`store-option-${s.id}`}
          onClick={() => onPick(s.id)}
        >
          <StoreBadge store={s} size={18} />
          {s.name}
        </button>
      ))}
    </div>
  )
}

function CategoryRail({ state, value, onPick }: { state: ListState; value: CategoryId; onPick: (id: CategoryId) => void }) {
  const { l } = useI18n()
  const ref = useRevealSelected(value)
  return (
    <div className="b-rail" role="radiogroup" ref={ref}>
      {Object.values(state.categories).map((c) => (
        <button
          key={c.id}
          role="radio"
          aria-checked={c.id === value}
          className={`b-chip ${c.id === value ? 'on' : ''}`}
          data-testid={`category-option-${c.id}`}
          onClick={() => onPick(c.id)}
        >
          {c.emoji} {l(c.name)}
        </button>
      ))}
    </div>
  )
}

function Editor({ item, g, onClose }: { item: Item; g: Groceries; onClose: () => void }) {
  const { t } = useI18n()
  const set = (patch: Partial<Item>) => g.actions.update(item.id, patch)
  const reveal = useRevealOnMount<HTMLDivElement>()
  return (
    <div className="b-editor" data-testid="item-editor" ref={reveal}>
      <div className="b-fields">
        <label>
          <span>{t('name')}</span>
          <input autoFocus value={item.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label>
          <span>{t('qty')}</span>
          <input value={item.qty} onChange={(e) => set({ qty: e.target.value })} />
        </label>
        <label>
          <span>{t('brand')}</span>
          <input value={item.brand ?? ''} onChange={(e) => set({ brand: e.target.value || undefined })} />
        </label>
        <label>
          <span>{t('props')}</span>
          <input
            defaultValue={item.props.join(', ')}
            onChange={(e) => set({ props: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
          />
        </label>
      </div>
      <div className="b-rail-label">{t('store')}</div>
      <StoreRail state={g.state} value={item.storeId} onPick={(storeId) => set({ storeId })} />
      <div className="b-rail-label">{t('category')}</div>
      <CategoryRail state={g.state} value={item.categoryId} onPick={(categoryId) => set({ categoryId })} />
      <div className="b-editor-actions">
        <button
          className="b-text-btn danger"
          onClick={() => {
            g.actions.remove(item.id)
            onClose()
          }}
        >
          {t('delete')}
        </button>
        <button className="b-filled-btn" onClick={onClose} data-testid="editor-done">
          {t('done')}
        </button>
      </div>
    </div>
  )
}

function ItemRow({ item, g, editing, onCloseEdit }: { item: Item; g: Groceries; editing: boolean; onCloseEdit: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => g.actions.check(item.id), 220)
  })
  if (editing) return <Editor item={item} g={g} onClose={onCloseEdit} />
  return (
    <div {...itemProps} className={`b-row ${isDragging ? 'ghost' : ''} ${leaving ? 'leaving' : ''}`}>
      <Row item={item} leaving={leaving} />
    </div>
  )
}

function Category({ storeId, group, g, editingId, setEditingId }: { storeId: StoreId; group: CategoryGroup; g: Groceries; editingId: string | null; setEditingId: (id: string | null) => void }) {
  const { l } = useI18n()
  const c = useCategorySortable(storeId, group.category.id)
  return (
    <div {...c.containerProps} className={`b-cat ${c.isItemOver ? 'over' : ''} ${c.isDragging ? 'lifted' : ''}`}>
      <div {...c.handleProps} className="b-cat-head">
        <span>{group.category.emoji}</span>
        {l(group.category.name)}
        {c.collapsed && <span className="b-count">{group.items.length}</span>}
      </div>
      {!c.collapsed &&
        group.items.map((item) => (
          <ItemRow key={item.id} item={item} g={g} editing={editingId === item.id} onCloseEdit={() => setEditingId(null)} />
        ))}
    </div>
  )
}

function Store({ section, g, editingId, setEditingId }: { section: StoreSection; g: Groceries; editingId: string | null; setEditingId: (id: string | null) => void }) {
  const s = useStoreSortable(section.store.id)
  return (
    <section {...s.containerProps} className={`b-store ${s.isItemOver ? 'over' : ''} ${s.isDragging ? 'lifted' : ''}`}>
      <header {...s.handleProps} className="b-store-head">
        <StoreBadge store={section.store} size={22} />
        <h2>{section.store.name}</h2>
        <span className="b-count">{section.count}</span>
        <span className="b-grip" aria-hidden>
          ⠿
        </span>
      </header>
      {!s.collapsed && (
        <SortableCategories storeId={section.store.id} ids={section.categories.map((c) => c.category.id)}>
          {section.categories.map((group) => (
            <Category key={group.category.id} storeId={section.store.id} group={group} g={g} editingId={editingId} setEditingId={setEditingId} />
          ))}
        </SortableCategories>
      )}
    </section>
  )
}

function AddSheet({ g, open, onClose }: { g: Groceries; open: boolean; onClose: () => void }) {
  const { t, l } = useI18n()
  const flow = useAddFlow(g)
  const input = useRef<HTMLInputElement>(null)
  const [flash, setFlash] = useState<'store' | 'category' | null>(null)
  const p = flow.preview

  useEffect(() => {
    if (!flash) return
    const tm = setTimeout(() => setFlash(null), 600)
    return () => clearTimeout(tm)
  }, [flash])

  const add = (d: Draft) => {
    flow.add(d)
    input.current?.focus()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && p) add(p)
  }
  const close = () => {
    flow.reset()
    onClose()
  }
  const store = p && g.state.stores.find((s) => s.id === p.storeId)
  const category = p && g.state.categories[p.categoryId]

  return (
    <Sheet open={open} onClose={close} className="b-sheet">
      <div className="b-input-wrap">
        <span aria-hidden>＋</span>
        <input
          ref={input}
          autoFocus
          data-testid="add-input"
          value={flow.text}
          placeholder={t('addPlaceholder')}
          onChange={(e) => flow.setText(e.target.value)}
          onKeyDown={onKey}
          enterKeyHint="done"
          autoComplete="off"
        />
        {flow.text && (
          <button className="b-clear" onClick={() => flow.setText('')} aria-label="clear">
            ✕
          </button>
        )}
      </div>
      <div className="b-sheet-body">
        {!p ? (
          <p className="b-hint">{t('addHint')}</p>
        ) : (
          <>
            <div className="b-preview" data-testid="preview">
              <div className="b-row static">
                <Row item={{ ...p, id: 'preview', addedBy: 'Peter', checked: false }} />
              </div>
              <dl className="b-slots">
                <div>
                  <dt>{t('name')}</dt>
                  <dd>{p.name || '–'}</dd>
                </div>
                <div>
                  <dt>{t('brand')}</dt>
                  <dd>{p.brand ?? '–'}</dd>
                </div>
                <div>
                  <dt>{t('props')}</dt>
                  <dd>{p.props.length ? p.props.join(', ') : '–'}</dd>
                </div>
                <div>
                  <dt>{t('qty')}</dt>
                  <dd>{p.qty}</dd>
                </div>
                <div>
                  <dt>{t('store')}</dt>
                  <dd>
                    <button className="b-slot-btn" data-testid="preview-store" onClick={() => setFlash('store')}>
                      {store?.name}
                    </button>
                  </dd>
                </div>
                <div>
                  <dt>{t('category')}</dt>
                  <dd>
                    <button className="b-slot-btn" data-testid="preview-category" onClick={() => setFlash('category')}>
                      {category && `${category.emoji} ${l(category.name)}`}
                    </button>
                  </dd>
                </div>
              </dl>
            </div>
            <div>
              <div className={`b-rail-label ${flash === 'store' ? 'flash' : ''}`}>{t('store')}</div>
              <StoreRail state={g.state} value={p.storeId} onPick={flow.setStore} />
              <div className={`b-rail-label ${flash === 'category' ? 'flash' : ''}`}>{t('category')}</div>
              <CategoryRail state={g.state} value={p.categoryId} onPick={flow.setCategory} />
            </div>
            <div className="b-rail-label">{t('suggestions')}</div>
            <div className="b-suggestions">
              {flow.suggestions.map((d, i) => (
                <button key={i} className="b-suggestion" data-testid="suggestion" onClick={() => add(d)}>
                  <span className="b-plus">＋</span>
                  <span className="b-emoji">{d.emoji}</span>
                  <span className="b-text">
                    <span className="b-name">{d.name}</span>
                    <span className="b-details">
                      {[d.brand, ...d.props].filter(Boolean).map((bit, k) => (
                        <span key={k} className={i > 0 && !(p.brand === bit || p.props.includes(bit!)) ? 'diff' : ''}>
                          {k > 0 && ' · '}
                          {bit}
                        </span>
                      ))}
                    </span>
                  </span>
                  <span className="b-qty">{qtyLabel(d.qty)}</span>
                  {i === 0 && <kbd>↵</kbd>}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  )
}

function ListTab({ g, onAdd }: { g: Groceries; onAdd: () => void }) {
  const { t, l } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const total = g.sections.reduce((n, s) => n + s.count, 0)
  return (
    <>
      <header className="b-top">
        <BackToIndex />
        <div className="b-title">
          <h1>{l(COPY.title)}</h1>
          <small>
            Peter & Sam · {total} {t('items')}
          </small>
        </div>
        <LangToggle />
      </header>
      <button className="b-addbar" data-testid="add-open" onClick={onAdd}>
        <span aria-hidden>＋</span>
        {t('addPlaceholder')}
      </button>
      <div className="b-scroll">
        <GestureHint />
        <div className="b-paper">
          <ListDnd
            groceries={g}
            onEdit={setEditingId}
            renderItemOverlay={(item) => (
              <div className="b-row overlay">
                <Row item={item} />
              </div>
            )}
          >
            <SortableStores ids={g.sections.map((s) => s.store.id)}>
              {g.sections.map((section) => (
                <Store key={section.store.id} section={section} g={g} editingId={editingId} setEditingId={setEditingId} />
              ))}
            </SortableStores>
          </ListDnd>
          {total === 0 && <p className="b-hint">{t('emptyList')}</p>}
          {g.recentlyBought.length > 0 && (
            <div className="b-done">
              <div className="b-cat-head">{l(COPY.done)}</div>
              {g.recentlyBought.slice(0, 8).map((item) => (
                <button key={item.id} className="b-row done" data-testid="done-item" onClick={() => g.actions.uncheck(item.id)}>
                  <span className="b-check on">✓</span>
                  <span className="b-emoji">{item.emoji}</span>
                  <span className="b-text">
                    <span className="b-name">{item.name}</span>
                  </span>
                  <span className="b-qty">{qtyLabel(item.qty)}</span>
                </button>
              ))}
            </div>
          )}
          <p className="b-footnote">{t('editHint')} · {t('dragHint')}</p>
        </div>
      </div>
    </>
  )
}

export default function PaperList() {
  const { t } = useI18n()
  const g = useGroceries()
  const [tab, setTab] = useState<'list' | 'more'>('list')
  const [adding, setAdding] = useState(false)
  return (
    <div className="b-root">
      {tab === 'list' ? <ListTab g={g} onAdd={() => setAdding(true)} /> : <MoreScreen onLogout={() => setTab('list')} />}
      <nav className="b-tabs">
        <button data-testid="tab-list" className={tab === 'list' ? 'on' : ''} onClick={() => setTab('list')}>
          <span aria-hidden>☰</span>
          {t('tabList')}
        </button>
        <button data-testid="tab-more" className={tab === 'more' ? 'on' : ''} onClick={() => setTab('more')}>
          <span aria-hidden>⋯</span>
          {t('tabMore')}
        </button>
      </nav>
      <Snackbar snack={g.snack} onDismiss={g.dismissSnack} bottom={72} />
      <AddSheet g={g} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
