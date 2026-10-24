import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useI18n, type StringKey } from '../../shared/i18n'
import { isCount, qtyLabel } from '../../shared/round2/format'
import type { Groceries } from '../../shared/store'
import type { Suggestion, SuggestionSource } from '../../shared/suggestions'
import type { Category, Draft, Store } from '../../shared/types'
import { StoreBadge } from '../../shared/ui/bits'
import type { Composer as ComposerModel, Fields } from './useComposer'
import './composer.css'

export type Tab = 'list' | 'more'

const SOURCE_LABEL: Record<SuggestionSource, StringKey> = {
  current: 'srcCurrent',
  typed: 'srcTyped',
  history: 'srcHistory',
  pack: 'srcPack',
  variant: 'srcVariant',
  size: 'srcSize',
  brand: 'srcBrand',
  catalog: 'srcCatalog',
}

/** Natural height of the sheet's content above the bottom band, so the surface can be exactly as tall as it needs. */
function useContentHeight(layout: string) {
  const top = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [px, setPx] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setPx((top.current?.offsetHeight ?? 0) + (inner.current?.offsetHeight ?? 0))
    measure()
    const ro = new ResizeObserver(measure)
    for (const el of [top.current, inner.current]) if (el) ro.observe(el)
    return () => ro.disconnect()
  }, [layout])
  return { top, inner, px }
}

/**
 * Bottom of H: the input bar, the List/More tabs, and the surface that grows upwards around the input to the height
 * its content needs (at least half the screen for add), up to full height. The input is its own layer and never moves.
 */
export function Composer({ c, groceries, tab, onTab }: { c: ComposerModel; groceries: Groceries; tab: Tab; onTab: (t: Tab) => void }) {
  const { t } = useI18n()
  const edit = c.mode.kind === 'edit' ? c.mode : null
  const first = c.suggestions[0]
  const size = useContentHeight(c.mode.kind)

  useEffect(() => {
    if (!c.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && c.close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c.open, c])

  return (
    <div
      className={`hc ${c.open ? 'is-open' : ''} ${tab === 'more' ? 'is-more' : ''} ${edit ? 'is-edit' : ''}`}
      style={{ ['--hc-content' as string]: `${size.px}px` }}
    >
      <div className="hc-scrim" onClick={c.close} />
      <div className="hc-sheet" data-testid="sheet-surface">
        <div
          className="hc-body"
          role="dialog"
          aria-modal={c.open}
          aria-label={t(edit ? 'editTitle' : 'addTitle')}
          data-testid={edit ? 'item-editor' : 'add-sheet'}
          inert={!c.open}
        >
          <div className="hc-top" ref={size.top}>
            <header className="hc-head">
              <span className="hc-grab" aria-hidden />
              <strong>{edit ? `${t('editTitle')}: ${edit.item.name}` : t('addTitle')}</strong>
              <button className="hc-textbtn" data-testid={edit ? 'editor-cancel' : 'sheet-close'} onClick={c.close}>
                {t(edit ? 'cancel' : 'close')}
              </button>
            </header>
            {edit && <EditFields fields={edit.fields} c={c} />}
            <FoldoutChips c={c} stores={groceries.state.stores} categories={Object.values(groceries.state.categories)} />
          </div>
          {!edit && (
            <div className="hc-list" data-testid="suggestions">
              <div className="hc-list-inner" ref={size.inner}>
                {c.suggestions.length === 0 ? (
                  <AddedNote groceries={groceries} />
                ) : (
                  c.suggestions.map((s, i) => (
                    <SuggestionRow
                      key={s.key}
                      s={s}
                      base={first.draft}
                      first={i === 0}
                      store={!c.storePinned && s.draft.storeId !== c.storeId ? groceries.state.stores.find((x) => x.id === s.draft.storeId) : undefined}
                      onPick={() => c.add(s.draft)}
                    />
                  ))
                )}
              </div>
              <div className="hc-fill" aria-hidden>
                <p>{t(c.suggestions.length ? 'enterHint' : 'typeToSuggest')}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {tab === 'list' && (
        <div className="hc-dock" data-testid="add-dock" inert={!!edit}>
          <span className={`hc-lead ${c.open ? 'is-open' : ''}`} aria-hidden key={first?.draft.emoji ?? 'plus'}>
            {c.open ? (first?.draft.emoji ?? '🔍') : '+'}
          </span>
          <input
            ref={c.input}
            className="hc-input"
            data-testid="add-input"
            value={c.mode.kind === 'add' ? c.mode.text : ''}
            placeholder={t('addPlaceholder')}
            aria-label={t('addPlaceholder')}
            onFocus={c.openAdd}
            onChange={(e) => c.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && first) c.add(first.draft)
            }}
            enterKeyHint="done"
            autoComplete="off"
          />
          {c.open && c.mode.kind === 'add' && c.mode.text && (
            <button className="hc-clear" aria-label={t('clear')} onClick={() => (c.setText(''), c.input.current?.focus())}>
              ✕
            </button>
          )}
        </div>
      )}
      {edit && (
        <div className="hc-actions">
          <button className="hc-textbtn danger" data-testid="editor-delete" onClick={c.remove}>
            {t('delete')}
          </button>
          <button className="hc-filled" data-testid="editor-done" disabled={!c.canSave} onClick={c.save}>
            {t('done')}
          </button>
        </div>
      )}
      <p className="hc-hint" aria-hidden>
        {t(edit ? 'editHintFields' : 'enterHint')}
      </p>
      <nav className="hc-tabs" data-testid="tabs" inert={c.open}>
        <TabButton on={tab === 'list'} icon="🛒" label={t('tabList')} testId="tab-list" onClick={() => onTab('list')} />
        <TabButton on={tab === 'more'} icon="☰" label={t('tabMore')} testId="tab-more" onClick={() => onTab('more')} />
      </nav>
    </div>
  )
}

function EditFields({ fields, c }: { fields: Fields; c: ComposerModel }) {
  const { t } = useI18n()
  const count = isCount(fields.qty) ? Number(fields.qty) : null
  const field = (key: keyof Fields, label: StringKey, placeholder?: string) => (
    <label className={`hc-field hc-field-${key}`}>
      <span>{t(label)}</span>
      <input
        data-testid={`field-${key}`}
        value={fields[key]}
        placeholder={placeholder}
        onChange={(e) => c.setField(key, e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && c.save()}
        autoComplete="off"
        inputMode={key === 'qty' && count !== null ? 'numeric' : undefined}
      />
    </label>
  )
  return (
    <div className="hc-fields">
      {field('name', 'name')}
      <div className="hc-fieldrow">
        {field('brand', 'brand', t('brandNone'))}
        <div className="hc-qty">
          {field('qty', 'qty')}
          {count !== null && (
            <>
              <button className="hc-step" aria-label={t('qtyMinus')} disabled={count <= 1} onClick={() => c.setField('qty', String(count - 1))}>
                −
              </button>
              <button className="hc-step" aria-label={t('qtyPlus')} onClick={() => c.setField('qty', String(count + 1))}>
                +
              </button>
            </>
          )}
        </div>
      </div>
      {field('props', 'props', t('propsExample'))}
    </div>
  )
}

/** Before typing: the confirmation of what was just added (with Undo) sits where the eyes are. */
function AddedNote({ groceries }: { groceries: Groceries }) {
  const { t } = useI18n()
  const snack = groceries.snack
  if (snack?.message.kind !== 'added') return null
  return (
    <p className="hc-added" role="status" data-testid="added-note" key={snack.key}>
      <span>
        ✓ {t('added')}: <b>{snack.message.name}</b> → {snack.message.store}
      </span>
      {snack.undo && (
        <button
          className="hc-textbtn"
          onClick={() => {
            snack.undo?.()
            groceries.dismissSnack()
          }}
        >
          {t('undo')}
        </button>
      )}
    </p>
  )
}

function TabButton({ on, icon, label, testId, onClick }: { on: boolean; icon: string; label: string; testId: string; onClick: () => void }) {
  return (
    <button className={`hc-tab ${on ? 'on' : ''}`} data-testid={testId} onClick={onClick}>
      <span className="hc-tab-icon" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}

/** Two chips; tapping one unfolds its options inline right below, picking folds it back. */
function FoldoutChips({ c, stores, categories }: { c: ComposerModel; stores: Store[]; categories: Category[] }) {
  const { t, l } = useI18n()
  const store = stores.find((s) => s.id === c.storeId)
  const category = categories.find((x) => x.id === c.categoryId)
  const fold = c.mode.fold
  return (
    <div className="hc-chips">
      <div className="hc-chiprow">
        <button className={`hc-chip ${fold === 'store' ? 'is-open' : ''} ${c.storeSet ? 'is-set' : ''}`} data-testid="chip-store" aria-expanded={fold === 'store'} onClick={() => c.toggleFold('store')}>
          {store ? <StoreBadge store={store} size={20} /> : <span aria-hidden>🏬</span>}
          <span>{store?.name ?? t('storeAuto')}</span>
          <span className="hc-caret" aria-hidden>
            ▾
          </span>
        </button>
        <button
          className={`hc-chip ${fold === 'category' ? 'is-open' : ''} ${c.categorySet ? 'is-set' : ''}`}
          data-testid="chip-category"
          aria-expanded={fold === 'category'}
          onClick={() => c.toggleFold('category')}
        >
          <span aria-hidden>{category?.emoji ?? '🗂️'}</span>
          <span>{category ? l(category.name) : t('categoryAuto')}</span>
          <span className="hc-caret" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      <div className={`hc-fold ${fold ? 'is-open' : ''}`}>
        <div className="hc-fold-inner" role="listbox" aria-label={t(fold === 'category' ? 'category' : 'store')} data-testid="chip-options">
          {fold === 'store' &&
            stores.map((s) => (
              <Option key={s.id} on={s.id === c.storeId} testId={`store-option-${s.id}`} onPick={() => c.setStore(s.id)}>
                <StoreBadge store={s} size={22} />
                {s.name}
              </Option>
            ))}
          {fold === 'category' &&
            categories.map((x) => (
              <Option key={x.id} on={x.id === c.categoryId} testId={`category-option-${x.id}`} onPick={() => c.setCategory(x.id)}>
                <span aria-hidden>{x.emoji}</span>
                {l(x.name)}
              </Option>
            ))}
        </div>
      </div>
    </div>
  )
}

function Option({ on, testId, onPick, children }: { on: boolean; testId: string; onPick: () => void; children: ReactNode }) {
  return (
    <button className={`hc-opt ${on ? 'on' : ''}`} role="option" aria-selected={on} data-testid={testId} onClick={onPick}>
      {children}
    </button>
  )
}

/** Two-line row. Line 2 says why it is offered, then brand and details with what differs from the first row in bold. */
function SuggestionRow({ s, base, first, store, onPick }: { s: Suggestion; base: Draft; first: boolean; store?: Store; onPick: () => void }) {
  const { t } = useI18n()
  const d = s.draft
  const parts = [
    ...(d.brand ? [{ text: d.brand, diff: !first && d.brand !== base.brand }] : []),
    ...d.props.map((p) => ({ text: p, diff: !first && !base.props.includes(p) })),
  ]
  return (
    <button className={`hc-sugg ${first ? 'is-first' : ''}`} data-testid="suggestion" data-source={s.source} onClick={onPick}>
      <span className="hc-sugg-emoji" aria-hidden>
        {d.emoji}
      </span>
      <span className="hc-sugg-text">
        <span className="hc-sugg-name">
          {d.qty !== '1' && <b className="hc-sugg-qty">{qtyLabel(d.qty)} </b>}
          {d.name || '…'}
        </span>
        <span className="hc-sugg-meta">
          <span className="hc-sugg-src">{t(SOURCE_LABEL[s.source])}</span>
          {parts.map((p) => (
            <Fragment key={p.text}>
              {' · '}
              <span className="hc-part">{p.diff ? <strong>{p.text}</strong> : p.text}</span>
            </Fragment>
          ))}
        </span>
      </span>
      {store && <StoreBadge store={store} size={20} />}
      {first && (
        <kbd className="hc-enter" aria-label="Enter">
          ↵
        </kbd>
      )}
    </button>
  )
}
