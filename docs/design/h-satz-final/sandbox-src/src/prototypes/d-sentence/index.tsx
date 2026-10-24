import { useRef, useState } from 'react'
import { useRevealOnMount } from '../../shared/useRevealOnMount'
import type { PrototypeMeta } from '../../registry'
import { ListDnd, SortableCategories, SortableStores, useCategorySortable, useItemGesture, useStoreSortable } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { useGroceries, type CategoryGroup, type Groceries, type StoreSection } from '../../shared/store'
import type { Draft, Item } from '../../shared/types'
import { useAddFlow } from '../../shared/useAddFlow'
import { MoreScreen } from '../../shared/ui/MoreScreen'
import { Sheet } from '../../shared/ui/Sheet'
import { Snackbar } from '../../shared/ui/Snackbar'
import { BackToIndex, GestureHint, LangToggle, StoreBadge } from '../../shared/ui/bits'
import { DraftWords, Sentence, WORDS, isCount, qtyLabel, storeTint } from './Sentence'
import './d.css'

export const meta: PrototypeMeta = {
  letter: 'D',
  title: { de: 'Satz', en: 'Sentence' },
  rationale: {
    de: 'Daumen zuerst: Eingabe unten, große Laden-Bänder, und jeder Artikel ist ein Satz mit antippbaren Laden- und Kategorie-Wörtern.',
    en: 'Thumb first: input at the bottom, bold store bands, and every item reads as a sentence with tappable store and category words.',
  },
}

type Tab = 'list' | 'more'

/** Explains the per-field tints in the sentence, so the underline on properties reads as a field, not a link. */
function FieldLegend() {
  const { t } = useI18n()
  return (
    <p className="d-legend" aria-hidden>
      <span className="d-w d-w--qty">2×</span> {t('qty')} <span className="d-w d-w--name">{t('name')}</span>{' '}
      <span className="d-w d-w--brand">{t('brand')}</span> <span className="d-w d-w--props">{t('props')}</span>
    </p>
  )
}

export default function SentencePrototype() {
  const groceries = useGroceries()
  const { t } = useI18n()
  const [tab, setTab] = useState<Tab>('list')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  return (
    <div className="d-root">
      {tab === 'list' ? (
        <>
          <TopBar groceries={groceries} />
          <ListDnd groceries={groceries} onEdit={setEditingId} renderItemOverlay={(item) => <Overlay item={item} />}>
            <div className="d-scroll">
              <GestureHint />
              {groceries.sections.length === 0 ? (
                <div className="d-empty">
                  <span>🧺</span>
                  {t('emptyList')}
                </div>
              ) : (
                <SortableStores ids={groceries.sections.map((s) => s.store.id)}>
                  {groceries.sections.map((s) => (
                    <StoreBand key={s.store.id} section={s} groceries={groceries} editingId={editingId} onCloseEditor={() => setEditingId(null)} />
                  ))}
                </SortableStores>
              )}
              <div className="d-scroll-end" />
            </div>
          </ListDnd>
        </>
      ) : (
        <div className="d-more">
          <MoreScreen onLogout={() => setTab('list')} />
        </div>
      )}
      <div className="d-bottom">
        {tab === 'list' && (
          <div className="d-dock">
            <button className="d-addbar" data-testid="add-open" onClick={() => setAdding(true)}>
              <span className="d-addbar-plus" aria-hidden>
                +
              </span>
              <span className="d-addbar-text">{t('addPlaceholder')}</span>
            </button>
          </div>
        )}
        <nav className="d-tabs">
        <button className={`d-tab ${tab === 'list' ? 'on' : ''}`} data-testid="tab-list" onClick={() => setTab('list')}>
          <span className="d-tab-icon" aria-hidden>
            🛒
          </span>
          {t('tabList')}
        </button>
        <button className={`d-tab ${tab === 'more' ? 'on' : ''}`} data-testid="tab-more" onClick={() => setTab('more')}>
          <span className="d-tab-icon" aria-hidden>
            ☰
          </span>
          {t('tabMore')}
        </button>
      </nav>
      </div>
      <AddSheet open={adding} onClose={() => setAdding(false)} groceries={groceries} />
      <Snackbar snack={groceries.snack} onDismiss={groceries.dismissSnack} bottom={tab === 'list' ? 148 : 76} />
    </div>
  )
}

function TopBar({ groceries }: { groceries: Groceries }) {
  const { t } = useI18n()
  const open = groceries.sections.reduce((n, s) => n + s.count, 0)
  return (
    <header className="d-top">
      <BackToIndex />
      <div className="d-top-title">
        <strong>{t('appName')}</strong>
        <span>
          {open} {t('items')}
        </span>
      </div>
      <LangToggle />
    </header>
  )
}

function StoreBand({ section, groceries, editingId, onCloseEditor }: { section: StoreSection; groceries: Groceries; editingId: string | null; onCloseEditor: () => void }) {
  const { t } = useI18n()
  const { store } = section
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useStoreSortable(store.id)
  return (
    <section
      {...containerProps}
      className={`d-store ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}
      style={{ ...containerProps.style, ['--d-tint' as string]: storeTint(store) }}
    >
      <header {...handleProps} className="d-band">
        <StoreBadge store={store} size={36} />
        <h2>{store.name}</h2>
        <span className="d-band-count">
          <b>{section.count}</b>
          <small>{t('items')}</small>
        </span>
      </header>
      {!collapsed && (
        <SortableCategories storeId={store.id} ids={section.categories.map((c) => c.category.id)}>
          {section.categories.map((g) => (
            <CategoryBlock key={g.category.id} storeId={store.id} group={g} groceries={groceries} editingId={editingId} onCloseEditor={onCloseEditor} />
          ))}
        </SortableCategories>
      )}
    </section>
  )
}

function CategoryBlock({
  storeId,
  group,
  groceries,
  editingId,
  onCloseEditor,
}: {
  storeId: string
  group: CategoryGroup
  groceries: Groceries
  editingId: string | null
  onCloseEditor: () => void
}) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <div {...containerProps} className={`d-cat ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div {...handleProps} className="d-gutter">
        <span className="d-gutter-emoji">{group.category.emoji}</span>
        <span className="d-gutter-name">{l(group.category.name)}</span>
      </div>
      {!collapsed && (
        <div className="d-items">
          {group.items.map((item) =>
            item.id === editingId ? (
              <Editor key={item.id} item={item} groceries={groceries} onClose={onCloseEditor} />
            ) : (
              <ItemRow key={item.id} item={item} groceries={groceries} />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function ItemRow({ item, groceries }: { item: Item; groceries: Groceries }) {
  const [leaving, setLeaving] = useState(false)
  const { itemProps, isDragging } = useItemGesture(item, () => {
    if (leaving) return
    setLeaving(true)
    setTimeout(() => groceries.actions.check(item.id), 280)
  })
  const meta = [item.brand, ...item.props].filter(Boolean).join(' · ')
  return (
    <div {...itemProps} className={`d-item ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''}`}>
      <span className={`d-qty ${item.qty === '1' ? 'one' : ''} ${isCount(item.qty) ? '' : 'amount'}`}>{qtyLabel(item.qty)}</span>
      <span className="d-item-text">
        <span className="d-item-name">{item.name}</span>
        {(meta || item.addedBy !== 'Peter') && (
          <span className="d-item-meta">
            {meta}
            {item.addedBy !== 'Peter' && <span className="d-who">{item.addedBy[0]}</span>}
          </span>
        )}
      </span>
      <span className="d-check" aria-hidden>
        <svg viewBox="0 0 24 24" width="22" height="22">
          <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </div>
  )
}

function Overlay({ item }: { item: Item }) {
  return (
    <div className="d-overlay">
      <span className="d-overlay-emoji">{item.emoji}</span>
      <span className="d-qty">{qtyLabel(item.qty)}</span>
      <span className="d-item-name">{item.name}</span>
    </div>
  )
}

/** Sized-to-content input so the editable sentence still reads as a sentence. */
function WordInput({ value, onChange, placeholder, field, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; field: string; autoFocus?: boolean }) {
  return (
    <input
      className={`d-w d-w--${field} d-winput`}
      value={value}
      placeholder={placeholder}
      autoFocus={autoFocus}
      size={Math.max(value.length, placeholder.length, 1)}
      onChange={(e) => onChange(e.target.value)}
      aria-label={placeholder}
    />
  )
}

function Editor({ item, groceries, onClose }: { item: Item; groceries: Groceries; onClose: () => void }) {
  const { t, l } = useI18n()
  const { state, actions } = groceries
  const [qty, setQty] = useState(item.qty)
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')
  const [props, setProps] = useState(item.props.join(', '))
  const [storeId, setStoreId] = useState(item.storeId)
  const [categoryId, setCategoryId] = useState(item.categoryId)

  const done = () => {
    actions.update(item.id, {
      qty: qty.trim() || '1',
      name: name.trim() || item.name,
      brand: brand.trim() || undefined,
      props: props.split(',').map((p) => p.trim()).filter(Boolean),
      storeId,
      categoryId,
    })
    onClose()
  }

  const reveal = useRevealOnMount<HTMLDivElement>()
  return (
    <div className="d-editor" data-testid="item-editor" ref={reveal} onKeyDown={(e) => e.key === 'Enter' && done()}>
      <div className="d-editor-sentence">
        <Sentence
          head={
            <>
              <WordInput field="qty" value={qty} onChange={setQty} placeholder="1" />
              <span className="d-conn">{isCount(qty) ? '×' : ''} </span>
              <WordInput field="name" value={name} onChange={setName} placeholder={t('name')} autoFocus />
              <span className="d-conn"> {l(WORDS.by)} </span>
              <WordInput field="brand" value={brand} onChange={setBrand} placeholder={l(WORDS.brandPh)} />
              <span className="d-conn">, </span>
              <WordInput field="props" value={props} onChange={setProps} placeholder={l(WORDS.propsPh)} />
            </>
          }
          storeId={storeId}
          categoryId={categoryId}
          stores={state.stores}
          categories={Object.values(state.categories)}
          onStore={setStoreId}
          onCategory={setCategoryId}
        />
      </div>
      <div className="d-editor-actions">
        <button
          className="d-btn danger"
          data-testid="editor-delete"
          onClick={() => {
            actions.remove(item.id)
            onClose()
          }}
        >
          {t('delete')}
        </button>
        <button className="d-btn primary" data-testid="editor-done" onClick={done}>
          {t('done')}
        </button>
      </div>
    </div>
  )
}

/** Only what this suggestion changes relative to the plain parse, e.g. "Big Pack" or "Babylove". */
function diffLabel(d: Draft, base: Draft): string {
  const parts = [d.brand !== base.brand ? d.brand : undefined, ...d.props.filter((p) => !base.props.includes(p))]
  return parts.filter(Boolean).join(' · ')
}

function AddSheet({ open, onClose, groceries }: { open: boolean; onClose: () => void; groceries: Groceries }) {
  const { t, l } = useI18n()
  const flow = useAddFlow(groceries)
  const input = useRef<HTMLInputElement>(null)
  const close = () => {
    flow.reset()
    onClose()
  }
  const add = (d: Draft) => {
    flow.add(d)
    input.current?.focus()
  }
  const base = flow.preview

  return (
    <Sheet open={open} onClose={close} className="d-sheet">
      <div className="d-sheet-body">
        <input
          ref={input}
          className="d-input"
          data-testid="add-input"
          autoFocus
          value={flow.text}
          placeholder={t('addPlaceholder')}
          onChange={(e) => flow.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && flow.suggestions[0]) add(flow.suggestions[0])
          }}
          enterKeyHint="done"
          autoComplete="off"
        />
        <div className="d-preview" data-testid="preview">
          {base ? (
            <>
              <span className="d-preview-emoji" key={base.emoji}>
                {base.emoji}
              </span>
              <Sentence
                head={<DraftWords d={base} />}
                storeId={base.storeId}
                categoryId={base.categoryId}
                stores={groceries.state.stores}
                categories={Object.values(groceries.state.categories)}
                onStore={flow.setStore}
                onCategory={flow.setCategory}
              />
              <FieldLegend />
            </>
          ) : (
            <p className="d-preview-hint">{t('addHint')}</p>
          )}
        </div>
        {base && (
          <div className="d-suggest">
            {flow.suggestions.map((d, i) => (
              <button key={i} className={`d-pill ${i === 0 ? 'primary' : ''}`} data-testid="suggestion" onClick={() => add(d)}>
                {i === 0 ? (
                  <>
                    <span aria-hidden>↵</span> {l(WORDS.addAsIs)}
                  </>
                ) : (
                  <>
                    <span aria-hidden>+</span> {diffLabel(d, base)}
                  </>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  )
}
