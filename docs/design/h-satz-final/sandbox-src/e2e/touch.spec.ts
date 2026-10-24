import { expect, test } from '@playwright/test'
import { DIRECTIONS } from './directions.ts'
import { category, holdAndDrag, openItem, scrollToMiddle, section, touchPointer } from './helpers.ts'

// Runs in the "touch" project (hasTouch + isMobile). Touches go through CDP so dnd-kit's TouchSensor sees real
// touchstart/touchmove/touchend events, including the 300 ms hold.
for (const dir of DIRECTIONS) {
  test.describe(`${dir} touch`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/#/${dir}`)
      await expect(section(page, 'dm')).toBeVisible()
    })

    test('tap checks off, undo restores', async ({ page }) => {
      await openItem(page, 'Gurken').tap()
      await expect(openItem(page, 'Gurken')).toHaveCount(0)
      await page.getByTestId('snackbar-undo').tap()
      await expect(openItem(page, 'Gurken')).toHaveCount(1)
    })

    test('hold and release opens the editor without checking off', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page)
      const ptr = touchPointer(cdp)
      await scrollToMiddle(openItem(page, 'Milch'))
      const b = (await openItem(page, 'Milch').boundingBox())!
      await ptr.down(b.x + b.width / 2, b.y + b.height / 2)
      await page.waitForTimeout(600)
      await ptr.up(b.x + b.width / 2, b.y + b.height / 2)
      await expect(page.getByTestId('item-editor')).toBeVisible()
      await expect(page.getByTestId('snackbar')).toHaveCount(0)
    })

    test('hold and move drags to another category', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page)
      await holdAndDrag(page, touchPointer(cdp), openItem(page, 'Gurken'), category(page, 'edeka', 'brot'))
      await expect(openItem(category(page, 'edeka', 'brot'), 'Gurken')).toHaveCount(1)
      await expect(page.getByTestId('item-editor')).toHaveCount(0)
    })

    test('hold and move drags to another store with edge auto-scroll', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page)
      await holdAndDrag(page, touchPointer(cdp), openItem(page, 'Feuchttücher'), category(page, 'lidl', 'haushalt'))
      await expect(openItem(category(page, 'lidl', 'haushalt'), 'Feuchttücher')).toHaveCount(1)
      await expect(openItem(section(page, 'dm'), 'Feuchttücher')).toHaveCount(0)
    })

    test('hold and move on a store header reorders stores', async ({ page }) => {
      const cdp = await page.context().newCDPSession(page)
      await holdAndDrag(page, touchPointer(cdp), section(page, 'edeka').getByTestId('store-handle'), section(page, 'dm').getByTestId('store-handle'))
      await expect(page.getByTestId('store-section').first()).toHaveAttribute('data-store-id', 'edeka')
    })
  })
}
