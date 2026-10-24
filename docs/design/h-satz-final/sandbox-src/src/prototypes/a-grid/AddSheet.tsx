import { useRef } from 'react'
import { useI18n } from '../../shared/i18n'
import type { Groceries } from '../../shared/store'
import type { Draft } from '../../shared/types'
import { Sheet } from '../../shared/ui/Sheet'
import { useAddFlow } from '../../shared/useAddFlow'
import { Pickers } from './Pickers'
import { TileFace } from './Tile'

const L = {
  title: { de: 'Hinzufügen', en: 'Add item' },
  empty: { de: 'Tippe los, die Kachel füllt sich', en: 'Start typing, the tile fills in' },
  enter: { de: '↵ fügt den ersten hinzu', en: '↵ adds the first one' },
}

export function AddSheet({ groceries, open, onClose }: { groceries: Groceries; open: boolean; onClose: () => void }) {
  const { t, l } = useI18n()
  const flow = useAddFlow(groceries)
  const input = useRef<HTMLInputElement>(null)
  const { preview, suggestions } = flow
  const close = () => {
    flow.reset()
    onClose()
  }
  const add = (d: Draft) => {
    flow.add(d)
    input.current?.focus()
  }
  const base = suggestions[0]
  const isNewFor = (d: Draft) => (s: string) => !!base && d !== base && (s === d.brand ? d.brand !== base.brand : !base.props.includes(s))

  return (
    <Sheet open={open} onClose={close} className="a-sheet">
      <div className="a-sheet-body">
        <div className="a-sheet-title">{l(L.title)}</div>
        <label className="a-input">
          <span aria-hidden>✏️</span>
          <input
            ref={input}
            data-testid="add-input"
            autoFocus
            value={flow.text}
            placeholder={t('addPlaceholder')}
            onChange={(e) => flow.setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && base) add(base)
            }}
          />
          {flow.text && (
            <button className="a-clear" aria-label={t('close')} onClick={() => (flow.setText(''), input.current?.focus())}>
              ×
            </button>
          )}
        </label>

        <div className={`a-preview ${preview ? '' : 'is-empty'}`} data-testid="preview">
          {preview ? (
            <TileFace d={preview} size="large" />
          ) : (
            <div className="a-face a-face--large a-ghost">
              <div className="a-well">✨</div>
              <div className="a-ghost-line" />
              <div className="a-ghost-line short" />
              <p>{l(L.empty)}</p>
            </div>
          )}
        </div>

        {preview && (
          <Pickers
            stores={groceries.state.stores}
            categories={Object.values(groceries.state.categories)}
            storeId={preview.storeId}
            categoryId={preview.categoryId}
            onStore={flow.setStore}
            onCategory={flow.setCategory}
            testPrefix="preview"
          />
        )}

        {suggestions.length > 0 ? (
          <>
            <div className="a-sugg-head">
              <span>{t('suggestions')}</span>
              <span>{l(L.enter)}</span>
            </div>
            <div className="a-sugg">
              {suggestions.map((d, i) => (
                <button key={`${d.brand}|${d.props.join(',')}`} className={`a-tile a-tile--small ${i === 0 ? 'is-first' : ''}`} data-testid="suggestion" onClick={() => add(d)}>
                  <TileFace d={d} size="small" isNew={isNewFor(d)} />
                  <span className="a-plus" aria-hidden>
                    +
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="a-hint">{t('addHint')}</p>
        )}
      </div>
    </Sheet>
  )
}
