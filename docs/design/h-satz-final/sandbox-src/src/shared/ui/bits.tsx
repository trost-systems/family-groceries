import { useState } from 'react'
import type { Store } from '../types'
import { useI18n } from '../i18n'
import './shared-ui.css'

/** Segmented DE | EN switch. Every prototype and the index page carry one. */
export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = useI18n()
  return (
    <button
      className={`lt-toggle ${className}`}
      data-testid="lang-toggle"
      aria-label={lang === 'de' ? 'Switch to English' : 'Auf Deutsch umschalten'}
      onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
    >
      <span className={lang === 'de' ? 'on' : ''}>DE</span>
      <span className={lang === 'en' ? 'on' : ''}>EN</span>
    </button>
  )
}

export function StoreBadge({ store, size = 24 }: { store: Store; size?: number }) {
  return (
    <span
      className="st-badge"
      style={{ width: size, height: size, background: store.badge.bg, color: store.badge.fg, fontSize: size * 0.48 }}
      aria-hidden
    >
      {store.badge.label}
    </span>
  )
}

/** Link back to the index; prototypes put it in their top bar. */
export function BackToIndex() {
  const { t } = useI18n()
  return (
    <a className="bi-link" href="#/" aria-label={t('allDirections')} data-testid="back-to-index">
      ‹
    </a>
  )
}

const HINT_KEY = 'fg-gesture-hint-dismissed'

/**
 * One-time, non-blocking banner that teaches the gesture model to someone evaluating the prototype cold.
 * It sits in the list flow (not an overlay), so it never intercepts a tap on an item.
 */
export function GestureHint({ className = '' }: { className?: string }) {
  const { t } = useI18n()
  const [hidden, setHidden] = useState(() => localStorage.getItem(HINT_KEY) === '1')
  if (hidden) return null
  return (
    <div className={`gh-hint ${className}`} role="note" data-testid="gesture-hint">
      <span aria-hidden>👆</span>
      <span className="gh-text">{t('gestureHint')}</span>
      <button
        className="gh-ok"
        onClick={() => {
          localStorage.setItem(HINT_KEY, '1')
          setHidden(true)
        }}
      >
        {t('gotIt')}
      </button>
    </div>
  )
}
