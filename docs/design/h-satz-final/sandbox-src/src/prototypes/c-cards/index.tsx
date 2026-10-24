import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useRevealOnMount } from '../../shared/useRevealOnMount'
import type { PrototypeMeta } from '../../registry'
import { ListDnd, SortableCategories, SortableStores, useCategorySortable, useItemGesture, useStoreSortable } from '../../shared/dnd'
import { useI18n } from '../../shared/i18n'
import { useGroceries, type CategoryGroup, type Groceries, type StoreSection } from '../../shared/store'
import type { Category, CategoryId, Draft, Item, Localized, Store, StoreId } from '../../shared/types'
import { BackToIndex, GestureHint, LangToggle, StoreBadge } from '../../shared/ui/bits'
import { MoreScreen } from '../../shared/ui/MoreScreen'
import { Sheet } from '../../shared/ui/Sheet'
import { Snackbar } from '../../shared/ui/Snackbar'
import { useAddFlow, type AddFlow } from '../../shared/useAddFlow'
import './cards.css'

export const meta: PrototypeMeta = {
  letter: 'C',
  title: { de: 'Karten', en: 'Cards' },
  rationale: {
    de: 'Ruhige Material-3-Karten pro Kategorie mit dichten Zweizeilern; Laden und Kategorie werden direkt in der Karte umgeschaltet.',
    en: 'Calm Material 3 cards per category with dense two-line rows; store and category switch in place inside the card.',
  },
}

const ME = 'Peter'
const CHECK_MS = 260

const L = {
  title: { de: 'Einkaufsliste', en: 'Shopping list' },
  stores: { de: 'Läden', en: 'stores' },
  preview: { de: 'Vorschau', en: 'Preview' },
  emptyPreview: { de: 'Tippe einfach drauflos, wir sortieren es ein.', en: 'Just type, we sort it in.' },
  pickStore: { de: 'Laden wählen', en: 'Choose store' },
  pickCategory: { de: 'Kategorie wählen', en: 'Choose category' },
  propsHint: { de: 'mit Komma trennen', en: 'comma separated' },
} satisfies Record<string, Localized>

const TONES = ['primary', 'secondary', 'tertiary'] as const
const toneOf = (id: string) => TONES[[...id].reduce((a, c) => a + c.charCodeAt(0), 0) % TONES.length]

const qtyLabel = (q: string) => (/^\d+$/.test(q) ? (q === '1' ? '' : `${q}×`) : q)

export default function CardsPrototype() {
  const g = useGroceries()
  const { t } = useI18n()
  const [tab, setTab] = useState<'list' | 'more'>('list')
  const [adding, setAdding] = useState(false)

  return (
    <div className="c-root">
      {tab === 'list' ? <ListTab g={g} onAdd={() => setAdding(true)} /> : <MoreScreen onLogout={() => setTab('list')} />}
      <nav className="c-nav">
        <NavTab active={tab === 'list'} icon="☰" label={t('tabList')} testId="tab-list" onClick={() => setTab('list')} />
        <NavTab active={tab === 'more'} icon="⋯" label={t('tabMore')} testId="tab-more" onClick={() => setTab('more')} />
      </nav>
      <Snackbar snack={g.snack} onDismiss={g.dismissSnack} bottom={tab === 'list' && !adding ? 148 : 88} />
      <AddSheet g={g} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}

function NavTab({ active, icon, label, testId, onClick }: { active: boolean; icon: string; label: string; testId: string; onClick: () => void }) {
  return (
    <button className={`c-navtab ${active ? 'on' : ''}`} data-testid={testId} onClick={onClick}>
      <span className="c-navpill" aria-hidden>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  )
}

function ListTab({ g, onAdd }: { g: Groceries; onAdd: () => void }) {
  const { t, l } = useI18n()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [activeStore, setActiveStore] = useState<StoreId | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const total = g.sections.reduce((a, s) => a + s.count, 0)

  const sectionEl = (id: StoreId) => scrollRef.current?.querySelector<HTMLElement>(`[data-testid="store-section"][data-store-id="${id}"]`)
  const onScroll = () => {
    const root = scrollRef.current
    if (!root) return
    const top = root.getBoundingClientRect().top + 24
    let current = g.sections[0]?.store.id ?? null
    for (const s of g.sections) {
      const el = sectionEl(s.store.id)
      if (el && el.getBoundingClientRect().top <= top) current = s.store.id
    }
    setActiveStore(current)
  }
  const jump = (id: StoreId) => {
    setActiveStore(id)
    sectionEl(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  const current = activeStore && g.sections.some((s) => s.store.id === activeStore) ? activeStore : g.sections[0]?.store.id

  return (
    <>
      <header className="c-top">
        <div className="c-appbar">
          <BackToIndex />
          <div className="c-titles">
            <h1>{l(L.title)}</h1>
            <small>
              {total} {t('items')} · {g.sections.length} {l(L.stores)}
            </small>
          </div>
          <LangToggle />
        </div>
        <div className="c-jumpbar" role="tablist">
          {g.sections.map((s) => (
            <button key={s.store.id} role="tab" aria-selected={current === s.store.id} className={`c-jump ${current === s.store.id ? 'on' : ''}`} onClick={() => jump(s.store.id)}>
              <StoreBadge store={s.store} size={18} />
              <span>{s.store.name}</span>
              <span className="c-jumpcount">{s.count}</span>
            </button>
          ))}
        </div>
      </header>

      <div className="c-scroll" ref={scrollRef} onScroll={onScroll}>
        <GestureHint />
        <ListDnd groceries={g} onEdit={setEditingId} renderItemOverlay={(item) => <div className="c-overlay"><RowBody item={item} /></div>}>
          <SortableStores ids={g.sections.map((s) => s.store.id)}>
            {g.sections.map((s) => (
              <StoreSectionView key={s.store.id} section={s} g={g} editingId={editingId} setEditingId={setEditingId} />
            ))}
          </SortableStores>
        </ListDnd>
        {g.sections.length === 0 && <p className="c-empty">🎉 {t('emptyList')}</p>}
        <p className="c-hint">{t('editHint')} · {t('dragHint')}</p>
      </div>

      <div className="c-addwrap">
        <button className="c-addbar" data-testid="add-open" onClick={onAdd}>
          <span className="c-addplus" aria-hidden>
            +
          </span>
          <span>{t('addPlaceholder')}</span>
          <span className="c-addmic" aria-hidden>
            🎙️
          </span>
        </button>
      </div>
    </>
  )
}

function Grip() {
  return (
    <svg className="c-grip" width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      {[6, 12, 18].flatMap((y) => [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="currentColor" />))}
    </svg>
  )
}

function StoreSectionView({ section, g, editingId, setEditingId }: { section: StoreSection; g: Groceries; editingId: string | null; setEditingId: (id: string | null) => void }) {
  const { t } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useStoreSortable(section.store.id)
  return (
    <section {...containerProps} className={`c-section ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''} ${collapsed ? 'collapsed' : ''}`}>
      <div {...handleProps} className="c-storehead">
        <StoreBadge store={section.store} size={28} />
        <h2>{section.store.name}</h2>
        <span className="c-storecount">
          {section.count} {t('items')}
        </span>
        <Grip />
      </div>
      {!collapsed && (
        <SortableCategories storeId={section.store.id} ids={section.categories.map((c) => c.category.id)}>
          {section.categories.map((c) => (
            <CategoryCard key={c.category.id} storeId={section.store.id} group={c} g={g} editingId={editingId} setEditingId={setEditingId} />
          ))}
        </SortableCategories>
      )}
    </section>
  )
}

function CategoryCard({ storeId, group, g, editingId, setEditingId }: { storeId: StoreId; group: CategoryGroup; g: Groceries; editingId: string | null; setEditingId: (id: string | null) => void }) {
  const { l } = useI18n()
  const { containerProps, handleProps, isDragging, isItemOver, collapsed } = useCategorySortable(storeId, group.category.id)
  return (
    <div {...containerProps} className={`c-card ${isDragging ? 'dragging' : ''} ${isItemOver ? 'over' : ''}`}>
      <div {...handleProps} className="c-cathead">
        <span className="c-catemoji" aria-hidden>
          {group.category.emoji}
        </span>
        <span className="c-catname">{l(group.category.name)}</span>
        <span className="c-catcount">{group.items.length}</span>
        <Grip />
      </div>
      {!collapsed &&
        group.items.map((item) => (
          <ItemRow key={item.id} item={item} g={g} editing={editingId === item.id} dimmed={editingId !== null && editingId !== item.id} onClose={() => setEditingId(null)} />
        ))}
    </div>
  )
}

function detailsOf(item: Pick<Item, 'brand' | 'props'> & { addedBy?: Item['addedBy'] }, by: string): string[] {
  return [item.brand, ...item.props, item.addedBy && item.addedBy !== ME ? `${by} ${item.addedBy}` : undefined].filter((x): x is string => !!x)
}

function Avatar({ emoji, tone, checked }: { emoji: string; tone: string; checked?: boolean }) {
  return (
    <span className={`c-avatar tone-${tone} ${checked ? 'checked' : ''}`} aria-hidden>
      <span className="c-avatar-emoji">{emoji}</span>
      <svg className="c-avatar-check" viewBox="0 0 24 24" width="18" height="18">
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

/** The two-line row content; shared by list rows, the drag overlay and the add preview. */
function RowBody({ item, line2, checked }: { item: Draft & { addedBy?: Item['addedBy'] }; line2?: ReactNode; checked?: boolean }) {
  const { t } = useI18n()
  const details = detailsOf(item, t('addedBy'))
  const qty = qtyLabel(item.qty)
  return (
    <>
      <Avatar emoji={item.emoji} tone={toneOf(item.categoryId)} checked={checked} />
      <span className="c-lines">
        <span className="c-line1">
          <span className="c-name">{item.name || '…'}</span>
        </span>
        {line2 ?? (details.length > 0 && <span className="c-line2">{details.join(' · ')}</span>)}
      </span>
      {qty && <span className="c-qty">{qty}</span>}
    </>
  )
}

function ItemRow({ item, g, editing, dimmed, onClose }: { item: Item; g: Groceries; editing: boolean; dimmed: boolean; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const onTap = () => {
    if (editing) return onClose()
    if (leaving) return
    setLeaving(true)
    navigator.vibrate?.(8)
    timer.current = setTimeout(() => g.actions.check(item.id), CHECK_MS)
  }
  const { itemProps, isDragging } = useItemGesture(item, onTap)
  return (
    <div className={`c-rowwrap ${editing ? 'editing' : ''} ${dimmed ? 'dimmed' : ''}`}>
      <div {...itemProps} className={`c-row ${leaving ? 'leaving' : ''} ${isDragging ? 'dragging' : ''}`}>
        <RowBody item={item} checked={leaving} />
      </div>
      {editing && <ItemEditor item={item} g={g} onClose={onClose} />}
    </div>
  )
}

type Picking = 'store' | 'category' | null

function StoreOptions({ stores, value, onPick }: { stores: Store[]; value: StoreId; onPick: (id: StoreId) => void }) {
  const { l } = useI18n()
  const ref = useScrollSelectedIntoView()
  return (
    <span className="c-pick">
      <span className="c-picklabel">{l(L.pickStore)}</span>
      <div className="c-seg" role="radiogroup" ref={ref}>
        {stores.map((s) => (
          <button key={s.id} role="radio" aria-checked={s.id === value} className={`c-segopt ${s.id === value ? 'on' : ''}`} data-testid={`store-option-${s.id}`} onClick={() => onPick(s.id)}>
            {s.id === value ? <span className="c-segcheck">✓</span> : <StoreBadge store={s} size={18} />}
            {s.name}
          </button>
        ))}
      </div>
    </span>
  )
}

function CategoryOptions({ categories, value, onPick }: { categories: Category[]; value: CategoryId; onPick: (id: CategoryId) => void }) {
  const { l } = useI18n()
  const ref = useScrollSelectedIntoView()
  return (
    <span className="c-pick">
      <span className="c-picklabel">{l(L.pickCategory)}</span>
      <div className="c-seg" role="radiogroup" ref={ref}>
        {categories.map((c) => (
          <button key={c.id} role="radio" aria-checked={c.id === value} className={`c-segopt ${c.id === value ? 'on' : ''}`} data-testid={`category-option-${c.id}`} onClick={() => onPick(c.id)}>
            {c.id === value ? <span className="c-segcheck">✓</span> : <span aria-hidden>{c.emoji}</span>}
            {l(c.name)}
          </button>
        ))}
      </div>
    </span>
  )
}

function useScrollSelectedIntoView() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('.on')
    if (el && ref.current) ref.current.scrollLeft = el.offsetLeft - 16
  }, [])
  return ref
}

function Tokens({ store, category, onStore, onCategory, storeTestId, categoryTestId, overridden }: { store: Store; category: Category; onStore: () => void; onCategory: () => void; storeTestId?: string; categoryTestId?: string; overridden?: { store: boolean; category: boolean } }) {
  const { l } = useI18n()
  return (
    <span className="c-tokens">
      <button className={`c-token ${overridden?.store ? 'set' : ''}`} data-testid={storeTestId} onClick={onStore}>
        <StoreBadge store={store} size={16} />
        {store.name}
        <span className="c-caret" aria-hidden>
          ▾
        </span>
      </button>
      <button className={`c-token ${overridden?.category ? 'set' : ''}`} data-testid={categoryTestId} onClick={onCategory}>
        <span aria-hidden>{category.emoji}</span>
        {l(category.name)}
        <span className="c-caret" aria-hidden>
          ▾
        </span>
      </button>
    </span>
  )
}

function ItemEditor({ item, g, onClose }: { item: Item; g: Groceries; onClose: () => void }) {
  const { t, l } = useI18n()
  const [name, setName] = useState(item.name)
  const [brand, setBrand] = useState(item.brand ?? '')
  const [props, setProps] = useState(item.props.join(', '))
  const [qty, setQty] = useState(item.qty)
  const [storeId, setStoreId] = useState(item.storeId)
  const [categoryId, setCategoryId] = useState(item.categoryId)
  const [picking, setPicking] = useState<Picking>(null)
  const store = g.state.stores.find((s) => s.id === storeId)!
  const category = g.state.categories[categoryId]

  const done = () => {
    g.actions.update(item.id, {
      name: name.trim() || item.name,
      brand: brand.trim() || undefined,
      props: props.split(',').map((p) => p.trim()).filter(Boolean),
      qty: qty.trim() || '1',
      storeId,
      categoryId,
    })
    onClose()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') done()
    if (e.key === 'Escape') onClose()
  }

  const reveal = useRevealOnMount<HTMLDivElement>()
  return (
    <div className="c-editor" data-testid="item-editor" ref={reveal}>
      <div className="c-fieldrow">
        <Field label={t('name')} value={name} onChange={setName} onKeyDown={onKey} autoFocus grow />
        <Field label={t('qty')} value={qty} onChange={setQty} onKeyDown={onKey} narrow />
      </div>
      <Field label={t('brand')} value={brand} onChange={setBrand} onKeyDown={onKey} />
      <Field label={`${t('props')} · ${l(L.propsHint)}`} value={props} onChange={setProps} onKeyDown={onKey} />
      <div className="c-morph" key={picking ?? 'tokens'}>
        {picking === 'store' ? (
          <StoreOptions stores={g.state.stores} value={storeId} onPick={(id) => (setStoreId(id), setPicking(null))} />
        ) : picking === 'category' ? (
          <CategoryOptions categories={Object.values(g.state.categories)} value={categoryId} onPick={(id) => (setCategoryId(id), setPicking(null))} />
        ) : (
          <Tokens store={store} category={category} onStore={() => setPicking('store')} onCategory={() => setPicking('category')} />
        )}
      </div>
      <div className="c-editactions">
        <button
          className="c-btn text danger"
          onClick={() => {
            g.actions.remove(item.id)
            onClose()
          }}
        >
          {t('delete')}
        </button>
        <button className="c-btn tonal" onClick={done} data-testid="editor-done">
          {t('done')}
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, onKeyDown, autoFocus, grow, narrow }: { label: string; value: string; onChange: (v: string) => void; onKeyDown: (e: KeyboardEvent) => void; autoFocus?: boolean; grow?: boolean; narrow?: boolean }) {
  return (
    <label className={`c-field ${grow ? 'grow' : ''} ${narrow ? 'narrow' : ''}`}>
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} autoFocus={autoFocus} />
    </label>
  )
}

function AddSheet({ g, open, onClose }: { g: Groceries; open: boolean; onClose: () => void }) {
  const flow = useAddFlow(g)
  const close = () => {
    flow.reset()
    onClose()
  }
  return (
    <Sheet open={open} onClose={close} className="c-sheet">
      <AddContent g={g} flow={flow} />
    </Sheet>
  )
}

function AddContent({ g, flow }: { g: Groceries; flow: AddFlow }) {
  const { t, l } = useI18n()
  const input = useRef<HTMLInputElement>(null)
  const [picking, setPicking] = useState<Picking>(null)
  const draft = flow.preview
  const base = flow.suggestions[0]

  const add = (d: Draft) => {
    flow.add(d)
    setPicking(null)
    input.current?.focus()
  }

  return (
    <div className="c-add">
      <div className="c-addfield">
        <span className="c-addemoji" aria-hidden>
          {draft?.emoji ?? '🛒'}
        </span>
        <input
          ref={input}
          data-testid="add-input"
          autoFocus
          placeholder={t('addPlaceholder')}
          value={flow.text}
          onChange={(e) => flow.setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && base) add(base)
          }}
          enterKeyHint="done"
        />
      </div>

      <div className="c-label">{l(L.preview)}</div>
      <div className="c-card c-previewcard" data-testid="preview">
        {draft ? (
          <div className="c-row static">
            <RowBody
              item={draft}
             
              line2={
                <span className="c-morph" key={picking ?? 'meta'}>
                  {picking === 'store' ? (
                    <StoreOptions stores={g.state.stores} value={draft.storeId} onPick={(id) => (flow.setStore(id), setPicking(null))} />
                  ) : picking === 'category' ? (
                    <CategoryOptions categories={Object.values(g.state.categories)} value={draft.categoryId} onPick={(id) => (flow.setCategory(id), setPicking(null))} />
                  ) : (
                    <>
                      {detailsOf(draft, t('addedBy')).length > 0 && <span className="c-line2">{detailsOf(draft, t('addedBy')).join(' · ')}</span>}
                      <Tokens
                        store={g.state.stores.find((s) => s.id === draft.storeId)!}
                        category={g.state.categories[draft.categoryId]}
                        onStore={() => setPicking('store')}
                        onCategory={() => setPicking('category')}
                        storeTestId="preview-store"
                        categoryTestId="preview-category"
                        overridden={{ store: flow.storeOverridden, category: flow.categoryOverridden }}
                      />
                    </>
                  )}
                </span>
              }
            />
          </div>
        ) : (
          <div className="c-previewempty">
            <span>{l(L.emptyPreview)}</span>
            <small>{t('addHint')}</small>
          </div>
        )}
      </div>

      {flow.suggestions.length > 0 && (
        <>
          <div className="c-label">{t('suggestions')}</div>
          <div className="c-suggestions">
            {flow.suggestions.map((d, i) => (
              <button key={`${d.brand}|${d.props.join(',')}`} className="c-suggestion" data-testid="suggestion" onClick={() => add(d)}>
                <Avatar emoji={d.emoji} tone={toneOf(d.categoryId)} />
                <span className="c-lines">
                  <span className="c-line1">
                    <span className="c-name">{d.name}</span>
                  </span>
                  <span className="c-line2">
                    <Diff d={d} base={i === 0 ? d : base} />
                  </span>
                </span>
                {qtyLabel(d.qty) && <span className="c-qty">{qtyLabel(d.qty)}</span>}
                {i === 0 && (
                  <kbd className="c-enter" aria-label="Enter">
                    ↵
                  </kbd>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

/** Brand and props of a suggestion, with the parts that differ from the plain parse emphasized. */
function Diff({ d, base }: { d: Draft; base: Draft }) {
  const parts = [
    ...(d.brand ? [{ text: d.brand, diff: d.brand !== base.brand }] : []),
    ...d.props.map((p) => ({ text: p, diff: !base.props.includes(p) })),
  ]
  if (parts.length === 0) return <span>—</span>
  return (
    <>
      {parts.map((p, i) => (
        <span key={p.text}>
          {i > 0 && ' · '}
          {p.diff ? <strong className="c-diff">{p.text}</strong> : p.text}
        </span>
      ))}
    </>
  )
}

