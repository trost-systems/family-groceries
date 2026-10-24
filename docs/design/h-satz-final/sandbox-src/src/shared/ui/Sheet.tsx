import { useEffect, type ReactNode } from 'react'
import { useI18n } from '../i18n'
import './shared-ui.css'

/** Modal bottom sheet positioned inside `.phone-screen`. Scrim tap and Escape close it. */
export function Sheet({
  open,
  onClose,
  children,
  className = '',
  testId = 'add-sheet',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  testId?: string
}) {
  const { t } = useI18n()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="sh-root">
      <div className="sh-scrim" onClick={onClose} />
      <div className={`sh-sheet ${className}`} role="dialog" aria-modal="true" data-testid={testId}>
        <button className="sh-grabber" aria-label={t('close')} data-testid="sheet-close" onClick={onClose}>
          <span />
        </button>
        {children}
      </div>
    </div>
  )
}
