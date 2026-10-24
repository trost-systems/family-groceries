import { Fragment, useEffect, type ReactNode } from 'react'
import { useI18n, type StringKey } from '../i18n'
import type { Groceries } from '../store'
import type { Suggestion, SuggestionSource } from '../suggestions'
import type { Category, Draft, Store } from '../types'
import { StoreBadge } from '../ui/bits'
import { qtyLabel } from './format'
import type { Composer as ComposerModel } from './useComposer'
import './composer.css'
import './shell.css'

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

/**
 * Bottom of every round-2 variant: the input bar, the List/More tabs, and the sheet that grows upwards around the
 * input. The input never moves: closed, the sheet's surface is exactly the bar behind it; open, the same surface
 * unclips upwards and covers the tabs.
 */
export function Composer({ c, groceries, tab, onTab }: { c: ComposerModel; groceries: Groceries; tab: Tab; onTab: (t: Tab) => void }) {
  const { t } = useI18n()
  const first = c.suggestions[0]

  useEffect(() => {
    if (!c.open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && c.close()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [c.open, c])

  return (
    <div className={`r2c ${c.open ? 'is-open' : ''} ${tab === 'more' ? 'is-more' : ''}`}>
      <div className="r2c-scrim" onClick={c.close} />
      <div className="r2c-sheet" data-testid="sheet-surface">
        <div
          className="r2c-body"
          role="dialog"
          aria-modal={c.open}
          aria-label={t(c.editing ? 'editTitle' : 'addTitle')}
          data-testid={c.editing ? 'item-editor' : 'add-sheet'}
          inert={!c.open}
        >
          <header className="r2c-head">
            <span className="r2c-grab" aria-hidden />
            <strong>{c.editing ? `${t('editTitle')}: ${c.editing.name}` : t('addTitle')}</strong>
            {c.editing && (
              <button className="r2c-textbtn danger" data-testid="editor-delete" onClick={c.remove}>
                {t('delete')}
              </button>
            )}
            <button
              className="r2c-textbtn"
              data-testid={c.editing ? 'editor-done' : 'sheet-close'}
              onClick={() => (c.editing && first ? c.apply(first.draft) : c.close())}
            >
              {t(c.editing ? 'done' : 'close')}
            </button>
          </header>
          <FoldoutChips c={c} stores={groceries.state.stores} categories={Object.values(groceries.state.categories)} />
          <div className="r2c-list" data-testid="suggestions">
            {c.suggestions.length === 0 ? (
              <EmptyList groceries={groceries} />
            ) : (
              c.suggestions.map((s, i) => (
                <SuggestionRow
                  key={s.key}
                  s={s}
                  base={first.draft}
                  first={i === 0}
                  store={!c.storePinned && s.draft.storeId !== c.storeId ? groceries.state.stores.find((x) => x.id === s.draft.storeId) : undefined}
                  onPick={() => c.apply(s.draft)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {tab === 'list' && (
        <div className="r2c-dock" data-testid="add-dock">
          <span className={`r2c-lead ${c.open ? 'is-open' : ''}`} aria-hidden key={first?.draft.emoji ?? 'plus'}>
            {c.open ? (first?.draft.emoji ?? '🔍') : '+'}
          </span>
          <input
            ref={c.input}
            className="r2c-input"
            data-testid="add-input"
            value={c.text}
            placeholder={t('addPlaceholder')}
            aria-label={t('addPlaceholder')}
            onFocus={c.openAdd}
            onChange={(e) => c.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && first) c.apply(first.draft)
            }}
            enterKeyHint="done"
            autoComplete="off"
          />
          {c.open && c.text && (
            <button className="r2c-clear" aria-label={t('clear')} onClick={() => (c.setText(''), c.input.current?.focus())}>
              ✕
            </button>
          )}
        </div>
      )}
      <p className="r2c-hint" aria-hidden>
        {t(c.editing ? 'enterHintEdit' : 'enterHint')}
      </p>
      <nav className="r2c-tabs" data-testid="tabs" inert={c.open}>
        <TabButton on={tab === 'list'} icon="🛒" label={t('tabList')} testId="tab-list" onClick={() => onTab('list')} />
        <TabButton on={tab === 'more'} icon="☰" label={t('tabMore')} testId="tab-more" onClick={() => onTab('more')} />
      </nav>
    </div>
  )
}

/** Before typing: the confirmation of what was just added (with Undo) sits here, where the eyes are, else a hint. */
function EmptyList({ groceries }: { groceries: Groceries }) {
  const { t } = useI18n()
  const snack = groceries.snack
  if (snack?.message.kind !== 'added') return <p className="r2c-empty">{t('typeToSuggest')}</p>
  return (
    <p className="r2c-empty r2c-added" role="status" data-testid="added-note" key={snack.key}>
      <span>
        ✓ {t('added')}: <b>{snack.message.name}</b> → {snack.message.store}
      </span>
      {snack.undo && (
        <button
          className="r2c-textbtn"
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
    <button className={`r2c-tab ${on ? 'on' : ''}`} data-testid={testId} onClick={onClick}>
      <span className="r2c-tab-icon" aria-hidden>
        {icon}
      </span>
      {label}
    </button>
  )
}

/**
 * A-style fold-out: two chips; tapping one unfolds its options inline right below, picking folds it back.
 * The pick applies to whichever suggestion is tapped next.
 */
function FoldoutChips({ c, stores, categories }: { c: ComposerModel; stores: Store[]; categories: Category[] }) {
  const { t, l } = useI18n()
  const store = stores.find((s) => s.id === c.storeId)
  const category = categories.find((x) => x.id === c.categoryId)
  return (
    <div className="r2c-chips">
      <div className="r2c-chiprow">
        <button
          className={`r2c-chip ${c.fold === 'store' ? 'is-open' : ''} ${c.storeSet ? 'is-set' : ''}`}
          data-testid="chip-store"
          aria-expanded={c.fold === 'store'}
          onClick={() => c.toggleFold('store')}
        >
          {store ? <StoreBadge store={store} size={20} /> : <span aria-hidden>🏬</span>}
          <span>{store?.name ?? t('storeAuto')}</span>
          <span className="r2c-caret" aria-hidden>
            ▾
          </span>
        </button>
        <button
          className={`r2c-chip ${c.fold === 'category' ? 'is-open' : ''} ${c.categorySet ? 'is-set' : ''}`}
          data-testid="chip-category"
          aria-expanded={c.fold === 'category'}
          onClick={() => c.toggleFold('category')}
        >
          <span aria-hidden>{category?.emoji ?? '🗂️'}</span>
          <span>{category ? l(category.name) : t('categoryAuto')}</span>
          <span className="r2c-caret" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      <div className={`r2c-fold ${c.fold ? 'is-open' : ''}`}>
        <div className="r2c-fold-inner" role="listbox" aria-label={t(c.fold === 'category' ? 'category' : 'store')} data-testid="chip-options">
          {c.fold === 'store' &&
            stores.map((s) => (
              <Option key={s.id} on={s.id === c.storeId} testId={`store-option-${s.id}`} onPick={() => c.setStore(s.id)}>
                <StoreBadge store={s} size={22} />
                {s.name}
              </Option>
            ))}
          {c.fold === 'category' &&
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
    <button className={`r2c-opt ${on ? 'on' : ''}`} role="option" aria-selected={on} data-testid={testId} onClick={onPick}>
      {children}
    </button>
  )
}

/** C-style two-line row. Line 2 says why it is offered, then brand and details with what differs from the first row in bold. */
function SuggestionRow({ s, base, first, store, onPick }: { s: Suggestion; base: Draft; first: boolean; store?: Store; onPick: () => void }) {
  const { t } = useI18n()
  const d = s.draft
  const parts = [
    ...(d.brand ? [{ text: d.brand, diff: !first && d.brand !== base.brand }] : []),
    ...d.props.map((p) => ({ text: p, diff: !first && !base.props.includes(p) })),
  ]
  return (
    <button className={`r2c-sugg ${first ? 'is-first' : ''}`} data-testid="suggestion" data-source={s.source} onClick={onPick}>
      <span className="r2c-sugg-emoji" aria-hidden>
        {d.emoji}
      </span>
      <span className="r2c-sugg-text">
        <span className="r2c-sugg-name">
          {d.qty !== '1' && <b className="r2c-sugg-qty">{qtyLabel(d.qty)} </b>}
          {d.name || '…'}
        </span>
        <span className="r2c-sugg-meta">
          <span className="r2c-sugg-src">{t(SOURCE_LABEL[s.source])}</span>
          {parts.map((p) => (
            <Fragment key={p.text}>
              {' · '}
              <span className="r2c-part">{p.diff ? <strong>{p.text}</strong> : p.text}</span>
            </Fragment>
          ))}
        </span>
      </span>
      {store && <StoreBadge store={store} size={20} />}
      {first && (
        <kbd className="r2c-enter" aria-label="Enter">
          ↵
        </kbd>
      )}
    </button>
  )
}
