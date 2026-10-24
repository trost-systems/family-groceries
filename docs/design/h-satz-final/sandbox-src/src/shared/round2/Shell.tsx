import { useState, type ComponentType, type ReactNode } from 'react'
import { ListDnd } from '../dnd'
import { useI18n } from '../i18n'
import { round2State } from '../mockData'
import { useGroceries, type Groceries } from '../store'
import type { Item, StoreId } from '../types'
import { MoreScreen } from '../ui/MoreScreen'
import { Snackbar } from '../ui/Snackbar'
import { BackToIndex, GestureHint, LangToggle } from '../ui/bits'
import { Composer, type Tab } from './Composer'
import { useCollapsedStores } from './useCollapsedStores'
import { useComposer } from './useComposer'

export interface Collapse {
  isCollapsed: (id: StoreId) => boolean
  toggle: (id: StoreId) => void
}

export interface ListProps {
  groceries: Groceries
  collapse: Collapse
}

/**
 * Everything the round-2 variants share: data, the bottom composer (add and edit), collapse state, tabs and the
 * snackbar. A variant supplies only how the list renders stores, categories and items.
 */
export function Round2Shell({ variant, className, List, overlay }: { variant: string; className: string; List: ComponentType<ListProps>; overlay: (item: Item) => ReactNode }) {
  const groceries = useGroceries(round2State)
  const composer = useComposer(groceries)
  const collapse = useCollapsedStores(variant)
  const [tab, setTab] = useState<Tab>('list')
  const { t } = useI18n()
  const open = groceries.sections.reduce((n, s) => n + s.count, 0)

  const edit = (id: string) => {
    const item = groceries.sections.flatMap((s) => s.categories.flatMap((c) => c.items)).find((i) => i.id === id)
    if (item) composer.openEdit(item)
  }

  return (
    <div className={`r2-root ${className}`}>
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
          <ListDnd groceries={groceries} onEdit={edit} renderItemOverlay={overlay}>
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
