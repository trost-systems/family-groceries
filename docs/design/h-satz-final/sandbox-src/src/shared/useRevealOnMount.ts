import { useEffect, useRef } from 'react'

/**
 * Scrolls an element fully into view when it mounts (inline editors opened near the bottom of the list).
 * Pair with a CSS `scroll-margin-bottom` that clears any dock floating over the scroller.
 */
export function useRevealOnMount<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [])
  return ref
}
