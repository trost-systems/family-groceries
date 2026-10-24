import type { CategoryId, Member } from '../../shared/types'

/** Tonal well color per category, so the grid reads as distinct shelves without non-token colors. */
const TONES = ['primary', 'secondary', 'tertiary'] as const
export function toneOf(categoryId: CategoryId): (typeof TONES)[number] {
  let h = 0
  for (const c of categoryId) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONES[h % TONES.length]
}

export interface FaceData {
  emoji: string
  name: string
  brand?: string
  props: string[]
  qty: string
  categoryId: CategoryId
  addedBy?: Member
}

/**
 * The tile's visual. `grid` puts brand and properties in one muted line; `large` and `small` show them as chips,
 * keyed by text so each new chip pops in. `isNew` marks chips that differ from the base suggestion.
 */
export function TileFace({ d, size, isNew }: { d: FaceData; size: 'grid' | 'large' | 'small'; isNew?: (s: string) => boolean }) {
  const details = [d.brand, ...d.props].filter((s): s is string => !!s)
  return (
    <div className={`a-face a-face--${size}`}>
      <div className={`a-well a-tone-${toneOf(d.categoryId)}`}>
        <span key={d.emoji} className="a-emoji">
          {d.emoji}
        </span>
      </div>
      {d.qty && d.qty !== '1' && (
        <span key={d.qty} className="a-qty">
          {d.qty}
        </span>
      )}
      {d.addedBy === 'Sam' && (
        <span className="a-who" aria-label="Sam">
          S
        </span>
      )}
      <div className="a-name">{d.name || ' '}</div>
      {size === 'grid' ? (
        details.length > 0 && <div className="a-meta">{details.join(' · ')}</div>
      ) : (
        <div className="a-chips">
          {details.map((s, i) => (
            <span key={s} className={`a-chip ${i === 0 && d.brand ? 'is-brand' : ''} ${isNew?.(s) ? 'is-new' : ''}`}>
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
