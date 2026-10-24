import { useState } from 'react'
import { useRevealOnMount } from '../../shared/useRevealOnMount'
import { useI18n } from '../../shared/i18n'
import type { Groceries } from '../../shared/store'
import type { Item } from '../../shared/types'
import { Pickers } from './Pickers'
import { toneOf } from './Tile'

const bump = (qty: string, by: number): string => {
  const m = /^(\d+)(.*)$/.exec(qty.trim())
  if (!m) return qty
  return `${Math.max(1, Number(m[1]) + by)}${m[2]}`
}

/** The tile grown to a full grid row. Edits apply live; Done collapses it back. */
export function ItemEditor({ item, groceries, onClose }: { item: Item; groceries: Groceries; onClose: () => void }) {
  const { t } = useI18n()
  const [propsText, setPropsText] = useState(item.props.join(', '))
  const set = (patch: Partial<Omit<Item, 'id'>>) => groceries.actions.update(item.id, patch)

  const reveal = useRevealOnMount<HTMLDivElement>()
  return (
    <div className="a-editor" data-testid="item-editor" ref={reveal}>
      <div className="a-editor-head">
        <div className={`a-well a-tone-${toneOf(item.categoryId)}`}>
          <span key={item.emoji} className="a-emoji">
            {item.emoji}
          </span>
        </div>
        <div className="a-editor-title">
          <strong>{item.name || ' '}</strong>
          <small>{[item.brand, ...item.props].filter(Boolean).join(' · ')}</small>
        </div>
        <div className="a-stepper">
          <button aria-label="−" onClick={() => set({ qty: bump(item.qty, -1) })}>
            −
          </button>
          <input aria-label={t('qty')} value={item.qty} onChange={(e) => set({ qty: e.target.value })} />
          <button aria-label="+" onClick={() => set({ qty: bump(item.qty, 1) })}>
            +
          </button>
        </div>
      </div>
      <div className="a-fields">
        <label className="a-field wide">
          <span>{t('name')}</span>
          <input value={item.name} onChange={(e) => set({ name: e.target.value })} />
        </label>
        <label className="a-field">
          <span>{t('brand')}</span>
          <input value={item.brand ?? ''} onChange={(e) => set({ brand: e.target.value || undefined })} />
        </label>
        <label className="a-field">
          <span>{t('props')}</span>
          <input
            value={propsText}
            onChange={(e) => {
              setPropsText(e.target.value)
              set({ props: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })
            }}
          />
        </label>
      </div>
      <Pickers
        stores={groceries.state.stores}
        categories={Object.values(groceries.state.categories)}
        storeId={item.storeId}
        categoryId={item.categoryId}
        onStore={(storeId) => set({ storeId })}
        onCategory={(categoryId) => set({ categoryId })}
        testPrefix="edit"
      />
      <div className="a-editor-actions">
        <button className="a-btn-text danger" onClick={() => groceries.actions.remove(item.id)}>
          🗑 {t('delete')}
        </button>
        <button className="a-btn-filled" onClick={onClose} data-testid="editor-done">
          {t('done')}
        </button>
      </div>
    </div>
  )
}
