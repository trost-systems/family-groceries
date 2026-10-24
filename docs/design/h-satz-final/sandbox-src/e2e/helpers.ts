import { expect, type CDPSession, type Locator, type Page } from '@playwright/test'

export const section = (page: Page, store: string) => page.locator(`[data-testid="store-section"][data-store-id="${store}"]`)
export const category = (page: Page, store: string, cat: string) =>
  page.locator(`[data-testid="category"][data-store-id="${store}"][data-category-id="${cat}"]`)
export const openItem = (scope: Page | Locator, name: string) =>
  scope.locator('[data-testid="item"][data-checked="false"]').filter({ hasText: name })

/** Mouse or touch, so one drag routine covers both input methods. */
export interface Pointer {
  down(x: number, y: number): Promise<void>
  move(x: number, y: number): Promise<void>
  up(x: number, y: number): Promise<void>
}

export function mousePointer(page: Page): Pointer {
  return {
    down: async (x, y) => {
      await page.mouse.move(x, y)
      await page.mouse.down()
    },
    move: (x, y) => page.mouse.move(x, y),
    up: async (x, y) => {
      await page.mouse.move(x, y)
      await page.mouse.up()
    },
  }
}

export function touchPointer(cdp: CDPSession): Pointer {
  const send = (type: 'touchStart' | 'touchMove' | 'touchEnd', x: number, y: number) =>
    cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] }).then(() => undefined)
  return {
    down: (x, y) => send('touchStart', x, y),
    move: (x, y) => send('touchMove', x, y),
    up: (x, y) => send('touchEnd', x, y),
  }
}

/** Center of the element's first line box: for an inline item that wraps, the bounding box center can sit on a neighbour. */
const center = (l: Locator) =>
  l.evaluate((el) => {
    const b = el.getClientRects()[0] ?? el.getBoundingClientRect()
    return { x: b.left + b.width / 2, y: b.top + b.height / 2 }
  })

/** Visible rect of the nearest vertically scrolling ancestor. */
async function scrollerOf(l: Locator) {
  return l.evaluate((el) => {
    let a = el.parentElement
    while (a) {
      const oy = getComputedStyle(a).overflowY
      if ((oy === 'auto' || oy === 'scroll') && a.scrollHeight > a.clientHeight) break
      a = a.parentElement
    }
    const r = (a ?? document.documentElement).getBoundingClientRect()
    return { top: Math.max(r.top, 0), bottom: Math.min(r.bottom, innerHeight) }
  })
}

/**
 * Press, hold past the 300 ms activation, then move to `to`. If the target is outside the scroller's comfortable
 * band, the pointer parks at the scroller edge so dnd-kit's auto-scroll brings it in, the way a thumb would.
 */
/** Scroll to the middle of the list: at the bottom edge a docked add bar or tab bar would take the press. */
export const scrollToMiddle = (l: Locator) => l.evaluate((el) => el.scrollIntoView({ block: 'center' }))

/** `at` drops at that fraction of the target's height (0 = top edge) instead of its comfortable middle. */
export async function holdAndDrag(page: Page, ptr: Pointer, from: Locator, to: Locator, at?: number) {
  await scrollToMiddle(from)
  const start = await center(from)
  await ptr.down(start.x, start.y)
  await page.waitForTimeout(450)
  await ptr.move(start.x, start.y + 12)
  const sc = await scrollerOf(to)
  const band = { top: sc.top + (sc.bottom - sc.top) * 0.2, bottom: sc.bottom - (sc.bottom - sc.top) * 0.2 }
  for (let i = 0; i < 80; i++) {
    const b = (await to.boundingBox())!
    if (b.y + b.height > band.top + 10 && b.y < band.bottom - 10) break
    await ptr.move(start.x, b.y < band.top ? sc.top + 4 : sc.bottom - 4)
    await page.waitForTimeout(80)
  }
  const b = (await to.boundingBox())!
  const y = at === undefined ? Math.min(Math.max(b.y + b.height / 2, b.y + 8, band.top), b.y + b.height - 8, band.bottom) : b.y + b.height * at
  const x = b.x + b.width / 2
  const steps = 15
  const here = { x: start.x, y: start.y + 12 }
  for (let s = 1; s <= steps; s++) await ptr.move(here.x + ((x - here.x) * s) / steps, here.y + ((y - here.y) * s) / steps)
  await page.waitForTimeout(150)
  if (at === undefined) return ptr.up(x, y)
  // Edge auto-scroll can still be settling, so re-aim at the target's current position before releasing.
  let aim = y
  for (let i = 0; i < 6; i++) {
    const now = (await to.boundingBox())!
    const next = now.y + now.height * at
    if (Math.abs(next - aim) < 1 && i > 0) break
    aim = next
    await ptr.move(x, aim)
    await page.waitForTimeout(120)
  }
  await ptr.up(x, aim)
}

/** Every descendant that is not inside a deliberate scroll/clip container stays within the element horizontally. */
export async function expectContentInside(l: Locator) {
  const r = await l.evaluate((root) => {
    const box = root.getBoundingClientRect()
    const escapes: string[] = []
    for (const el of root.querySelectorAll<HTMLElement>('*')) {
      let a = el.parentElement
      let clipped = false
      while (a && a !== root) {
        if (getComputedStyle(a).overflowX !== 'visible') clipped = true
        a = a.parentElement
      }
      if (clipped) continue
      const b = el.getBoundingClientRect()
      if (!b.width || !b.height) continue
      if (b.left < box.left - 1 || b.right > box.right + 1) escapes.push(`${el.tagName.toLowerCase()}.${el.className}`)
    }
    return { escapes, right: box.right, left: box.left, vw: innerWidth }
  })
  expect(r.escapes, 'children escape the editor').toEqual([])
  expect(r.left).toBeGreaterThanOrEqual(0)
  expect(r.right).toBeLessThanOrEqual(r.vw)
}

/** The element is on screen and is what a tap at its center would hit (not covered by a dock or sheet). */
export async function expectTappable(l: Locator) {
  await expect(async () => {
    const hit = await l.evaluate((el) => {
      const b = el.getBoundingClientRect()
      const x = b.left + b.width / 2
      const y = b.top + b.height / 2
      if (y < 0 || y > innerHeight || x < 0 || x > innerWidth) return false
      const top = document.elementFromPoint(x, y)
      return !!top && (top === el || el.contains(top))
    })
    expect(hit, 'covered or off screen').toBe(true)
  }).toPass({ timeout: 3000 })
}
