import { expect, test } from '@playwright/test'
import { EDEKA, brot, walk } from './h.ts'
import { category, holdAndDrag, openItem, scrollToMiddle, section, touchPointer } from './helpers.ts'

test.describe('h-satz-final touch', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/h-satz-final')
    await expect(section(page, 'dm')).toBeVisible()
  })

  test('tap checks off, undo restores in place', async ({ page }) => {
    await openItem(page, 'Gurken').tap()
    await expect(openItem(page, 'Gurken')).toHaveCount(0)
    await page.getByTestId('snackbar-undo').tap()
    expect(await walk(section(page, 'edeka'))).toEqual(EDEKA)
  })

  test('long-press opens the editor with prefilled fields, without checking off', async ({ page }) => {
    const ptr = touchPointer(await page.context().newCDPSession(page))
    await scrollToMiddle(openItem(page, 'Milch'))
    const b = (await openItem(page, 'Milch').boundingBox())!
    await ptr.down(b.x + b.width / 2, b.y + b.height / 2)
    await page.waitForTimeout(600)
    await ptr.up(b.x + b.width / 2, b.y + b.height / 2)
    await expect(page.getByTestId('item-editor')).toBeVisible()
    await expect(page.getByTestId('field-name')).toHaveValue('Milch')
    await expect(page.getByTestId('field-brand')).toHaveValue('Weihenstephan')
    await expect(page.getByTestId('field-props')).toHaveValue('1,5 %, 1 l')
    await expect(page.getByTestId('field-qty')).toHaveValue('2')
    await expect(page.getByTestId('snackbar')).toHaveCount(0)
  })

  test('long-press drag onto a row in another category adopts it', async ({ page }) => {
    await holdAndDrag(page, touchPointer(await page.context().newCDPSession(page)), openItem(page, 'Gurken'), brot(page), 0.75)
    await expect(openItem(category(page, 'edeka', 'brot'), 'Gurken')).toHaveCount(1)
    expect(await walk(category(page, 'edeka', 'brot'))).toEqual(['Brötchen', 'Gurken', 'Glutenfreie'])
    await expect(page.getByTestId('item-editor')).toHaveCount(0)
  })

  test('long-press drag reorders within a store', async ({ page }) => {
    await holdAndDrag(page, touchPointer(await page.context().newCDPSession(page)), openItem(page, 'Joghurt'), openItem(page, 'Milch'), 0.25)
    expect(await walk(category(page, 'edeka', 'kuehl'))).toEqual(['Joghurt', 'Milch'])
  })
})
