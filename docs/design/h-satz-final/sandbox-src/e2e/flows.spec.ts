import { expect, test, type Page } from '@playwright/test'
import { DIRECTIONS } from './directions.ts'
import { category, expectContentInside, expectTappable, holdAndDrag, mousePointer, openItem, section } from './helpers.ts'

async function typeInAddSheet(page: Page, text: string) {
  await page.getByTestId('add-open').click()
  const input = page.getByTestId('add-input')
  await expect(input).toBeFocused()
  await input.pressSequentially(text, { delay: 15 })
}

for (const dir of DIRECTIONS) {
  test.describe(dir, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/#/${dir}`)
      await expect(section(page, 'dm')).toBeVisible()
    })

    test('live parse fills the preview', async ({ page }) => {
      await typeInAddSheet(page, 'Windeln Pampers Größe 3')
      const preview = page.getByTestId('preview')
      for (const text of ['Windeln', 'Pampers', 'Größe 3']) await expect(preview).toContainText(text)
      await expect(page.getByTestId('preview-store')).toContainText('dm')
    })

    test('tapping a suggestion adds the item under dm', async ({ page }) => {
      await typeInAddSheet(page, 'Windeln Pampers Größe 3')
      await page.getByTestId('suggestion').first().click()
      await page.getByTestId('sheet-close').click()
      await expect(page.getByTestId('add-sheet')).toBeHidden()
      await expect(openItem(section(page, 'dm'), 'Windeln')).toHaveCount(1)
    })

    test('store can be changed inline before adding', async ({ page }) => {
      await typeInAddSheet(page, 'Windeln Pampers Größe 3')
      await page.getByTestId('preview-store').click()
      await page.getByTestId('store-option-edeka').click()
      await expect(page.getByTestId('preview-store')).toContainText('Edeka')
      await expect(page.locator('[data-testid="add-sheet"] [data-testid="add-sheet"]')).toHaveCount(0)
      await page.getByTestId('suggestion').first().click()
      await page.getByTestId('sheet-close').click()
      await expect(openItem(section(page, 'edeka'), 'Windeln')).toHaveCount(1)
      await expect(openItem(section(page, 'dm'), 'Windeln')).toHaveCount(0)
    })

    test('tap checks off, undo restores', async ({ page }) => {
      await openItem(page, 'Gurken').click()
      await expect(openItem(page, 'Gurken')).toHaveCount(0)
      await expect(page.getByTestId('snackbar')).toBeVisible()
      await page.getByTestId('snackbar-undo').click()
      await expect(openItem(page, 'Gurken')).toHaveCount(1)
    })

    test('right-click opens the inline editor', async ({ page }) => {
      await openItem(page, 'Milch').click({ button: 'right' })
      const editor = page.getByTestId('item-editor')
      await expect(editor).toBeVisible()
      await expect(page.getByTestId('add-sheet')).toHaveCount(0)
      await expect(page.getByTestId('snackbar')).toHaveCount(0)
      await expectContentInside(editor)
      await expectTappable(page.getByTestId('editor-done'))
    })

    test('an editor opened at the bottom of the list scrolls fully into view', async ({ page }) => {
      const last = openItem(page, 'Äpfel')
      await last.scrollIntoViewIfNeeded()
      await last.click({ button: 'right' })
      await expectContentInside(page.getByTestId('item-editor'))
      await expectTappable(page.getByTestId('editor-done'))
      await page.getByTestId('editor-done').click()
      await expect(page.getByTestId('item-editor')).toHaveCount(0)
    })

    test('hold and drag moves an item to another store, auto-scrolling up', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Gurken'), category(page, 'dm', 'drogerie'))
      await expect(openItem(category(page, 'dm', 'drogerie'), 'Gurken')).toHaveCount(1)
      await expect(openItem(section(page, 'edeka'), 'Gurken')).toHaveCount(0)
    })

    test('hold and drag moves an item to another store, auto-scrolling down', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Feuchttücher'), category(page, 'lidl', 'haushalt'))
      await expect(openItem(category(page, 'lidl', 'haushalt'), 'Feuchttücher')).toHaveCount(1)
      await expect(openItem(section(page, 'dm'), 'Feuchttücher')).toHaveCount(0)
    })

    test('hold and drag moves an item to another category', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Gurken'), category(page, 'edeka', 'brot'))
      await expect(openItem(category(page, 'edeka', 'brot'), 'Gurken')).toHaveCount(1)
      await expect(openItem(category(page, 'edeka', 'obst'), 'Gurken')).toHaveCount(0)
    })

    test('hold and drag reorders stores', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), section(page, 'edeka').getByTestId('store-handle'), section(page, 'dm').getByTestId('store-handle'))
      await expect(page.getByTestId('store-section').first()).toHaveAttribute('data-store-id', 'edeka')
    })

    test('hold and drag reorders categories within a store', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), category(page, 'edeka', 'brot').getByTestId('category-handle'), category(page, 'edeka', 'obst').getByTestId('category-handle'))
      await expect(section(page, 'edeka').getByTestId('category').first()).toHaveAttribute('data-category-id', 'brot')
    })

    test('DE/EN toggle switches labels', async ({ page }) => {
      await expect(page.getByTestId('tab-list')).toContainText('Liste')
      await page.getByTestId('lang-toggle').first().click()
      await expect(page.getByTestId('tab-list')).toContainText('List')
      await expect(page.getByTestId('tab-list')).not.toContainText('Liste')
    })

    test('snackbar follows a language switch', async ({ page }) => {
      await openItem(page, 'Gurken').click()
      await expect(page.getByTestId('snackbar')).toContainText('abgehakt')
      await page.getByTestId('lang-toggle').first().click()
      await expect(page.getByTestId('snackbar')).toContainText('checked off')
      await expect(page.getByTestId('snackbar')).not.toContainText('abgehakt')
      await expect(page.getByTestId('snackbar-undo')).toHaveText('Undo')
    })

    test('parsed properties read in English after the switch', async ({ page }) => {
      await page.getByTestId('lang-toggle').first().click()
      await typeInAddSheet(page, 'Windeln Pampers Größe 3')
      await expect(page.getByTestId('preview')).toContainText('Size 3')
      await expect(page.getByTestId('preview')).not.toContainText('Größe')
    })

    test('More tab shows the licenses page', async ({ page }) => {
      await page.getByTestId('tab-more').click()
      await page.getByTestId('licenses-link').click()
      await expect(page.getByTestId('licenses-page')).toContainText('flutter')
    })
  })
}
