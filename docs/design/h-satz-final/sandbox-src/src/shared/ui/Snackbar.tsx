import type { Snack, SnackMessage } from '../store'
import { useI18n } from '../i18n'
import './shared-ui.css'

/** M3 snackbar with an Undo action, floating above the bottom bar. `bottom` lets a direction clear its own nav. */
export function Snackbar({ snack, onDismiss, bottom = 88 }: { snack: Snack | null; onDismiss: () => void; bottom?: number }) {
  const { t } = useI18n()
  if (!snack) return null
  const text = (m: SnackMessage) => {
    switch (m.kind) {
      case 'added':
        return `${t('added')}: ${m.name} → ${m.store}`
      case 'checked':
        return `${m.name} ${t('checkedOff')}`
      case 'deleted':
        return `${m.name} ${t('deleted')}`
    }
  }
  return (
    <div className="sb-snack" key={snack.key} style={{ bottom: `calc(${bottom}px + var(--safe-bottom))` }} role="status" data-testid="snackbar">
      <span className="sb-text">{text(snack.message)}</span>
      {snack.undo && (
        <button
          className="sb-undo"
          data-testid="snackbar-undo"
          onClick={() => {
            snack.undo?.()
            onDismiss()
          }}
        >
          {t('undo')}
        </button>
      )}
    </div>
  )
}
