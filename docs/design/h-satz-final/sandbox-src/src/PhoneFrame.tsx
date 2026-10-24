import type { ReactNode } from 'react'
import './phone-frame.css'

/**
 * 390x844 device frame on desktop; on narrow viewports (<500px) the screen fills the viewport and the
 * safe-area insets become padding. `.phone-screen` is the positioning root for sheets and snackbars.
 */
export function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-stage">
      <div className="phone-frame">
        <div className="phone-screen" data-testid="phone-screen">
          {children}
        </div>
      </div>
    </div>
  )
}
