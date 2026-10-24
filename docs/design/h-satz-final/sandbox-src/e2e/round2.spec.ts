import { expect, test, type Page } from '@playwright/test'
import { category, holdAndDrag, mousePointer, openItem, section } from './helpers.ts'
import { ROUND2 } from './round2.ts'

const BRIEF = 'Windeln Pampers Größe 3'
/** Longest sheet transition is 320 ms; wait past it before measuring. */
const SETTLE = 450

async function openAndType(page: Page, text: string) {
  await page.getByTestId('add-input').click()
  await expect(page.getByTestId('add-sheet')).toBeVisible()
  await page.getByTestId('add-input').pressSequentially(text, { delay: 10 })
}

for (const v of ROUND2) {
  test.describe(v, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`/#/${v}`)
      await expect(section(page, 'dm')).toBeVisible()
    })

    test('typing lists the parse as the first selectable suggestion, plus alternatives', async ({ page }) => {
      await openAndType(page, BRIEF)
      const rows = page.getByTestId('suggestion')
      const first = rows.first()
      await expect(first).toHaveAttribute('data-source', 'typed')
      for (const text of ['Windeln', 'Pampers', 'Größe 3']) await expect(first).toContainText(text)
      await expect(page.getByTestId('chip-store')).toContainText('dm')
      await expect(page.getByTestId('chip-category')).toContainText('Drogerie')
      expect(await rows.count()).toBeGreaterThanOrEqual(4)
      await expect(page.locator('[data-testid="suggestion"][data-source="history"]')).toContainText('Größe 4')
      await expect(page.getByTestId('preview')).toHaveCount(0)
    })

    test('store chip folds out inline; the pick applies to the tapped suggestion', async ({ page }) => {
      await openAndType(page, BRIEF)
      await page.getByTestId('chip-store').click()
      const options = page.getByTestId('add-sheet').getByTestId('chip-options')
      await expect(options.getByTestId('store-option-edeka')).toBeVisible()
      await expect(page.locator('[role="dialog"]')).toHaveCount(1)
      await options.getByTestId('store-option-edeka').click()
      await expect(page.getByTestId('chip-store')).toContainText('Edeka')
      await expect(page.getByTestId('store-option-edeka')).toHaveCount(0)
      await page.getByTestId('suggestion').first().click()
      await expect(page.getByTestId('add-input')).toHaveValue('')
      await expect(page.getByTestId('add-input')).toBeFocused()
      await page.getByTestId('sheet-close').click()
      await expect(page.getByTestId('add-sheet')).toBeHidden()
      await expect(openItem(section(page, 'edeka'), 'Windeln')).toHaveCount(1)
      await expect(openItem(section(page, 'dm'), 'Windeln')).toHaveCount(0)
    })

    test('Enter adds the first suggestion', async ({ page }) => {
      await openAndType(page, BRIEF)
      await page.keyboard.press('Enter')
      await page.keyboard.press('Escape')
      await expect(openItem(section(page, 'dm'), 'Windeln')).toHaveCount(1)
    })

    test('the input bar stays in place while the sheet grows around it, and the tabs hide', async ({ page }) => {
      const input = page.getByTestId('add-input')
      const before = (await input.boundingBox())!
      const sheetBefore = (await page.getByTestId('sheet-surface').evaluate((el) => getComputedStyle(el).clipPath))
      await expect(page.getByTestId('tab-list')).toBeVisible()
      await input.click()
      await page.waitForTimeout(SETTLE)
      const after = (await input.boundingBox())!
      expect(Math.abs(after.y - before.y), 'input y').toBeLessThanOrEqual(2)
      expect(Math.abs(after.x - before.x), 'input x').toBeLessThanOrEqual(2)
      expect(Math.abs(after.height - before.height), 'input height').toBeLessThanOrEqual(2)
      await expect(page.getByTestId('tab-list')).toBeHidden()
      await expect(page.getByTestId('chip-store')).toBeVisible()
      const sheetTop = (await page.getByTestId('chip-store').boundingBox())!.y
      expect(sheetTop, 'chips sit above the input').toBeLessThan(after.y)
      expect(await page.getByTestId('sheet-surface').evaluate((el) => getComputedStyle(el).clipPath)).not.toBe(sheetBefore)
      await page.getByTestId('sheet-close').click()
      await page.waitForTimeout(SETTLE)
      const closed = (await input.boundingBox())!
      expect(Math.abs(closed.y - before.y), 'input y after close').toBeLessThanOrEqual(2)
      await expect(page.getByTestId('tab-list')).toBeVisible()
      await expect(page.getByTestId('add-sheet')).toBeHidden()
    })

    test('with reduced motion the sheet opens without animating', async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.getByTestId('add-input').click()
      const duration = await page.getByTestId('sheet-surface').evaluate((el) => getComputedStyle(el).transitionDuration)
      expect(duration.split(',').every((d) => parseFloat(d) === 0)).toBe(true)
      await expect(page.getByTestId('tab-list')).toBeHidden()
    })

    test('tapping a store folds it, shows its count, and stays folded after a reload', async ({ page }) => {
      const edeka = section(page, 'edeka')
      const count = await openItem(edeka, '').count()
      expect(count).toBeGreaterThan(0)
      await edeka.getByTestId('store-handle').click()
      await expect(edeka).toHaveAttribute('data-collapsed', 'true')
      await expect(openItem(edeka, '')).toHaveCount(0)
      await expect(edeka.getByTestId('store-count')).toContainText(String(count))
      await page.reload()
      await expect(section(page, 'edeka')).toHaveAttribute('data-collapsed', 'true')
      await expect(openItem(section(page, 'edeka'), '')).toHaveCount(0)
      await expect(openItem(section(page, 'dm'), 'Zahnpasta')).toHaveCount(1)
      await section(page, 'edeka').getByTestId('store-handle').click()
      await expect(section(page, 'edeka')).toHaveAttribute('data-collapsed', 'false')
      await expect(openItem(section(page, 'edeka'), '')).toHaveCount(count)
    })

    test('a folded store still takes a dropped item', async ({ page }) => {
      await section(page, 'lidl').getByTestId('store-handle').click()
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Zahnpasta'), section(page, 'lidl').getByTestId('store-handle'))
      await expect(section(page, 'lidl').getByTestId('store-count')).toContainText('4')
      // The click that ends a drag is swallowed for 250 ms so it cannot also fold the band.
      await page.waitForTimeout(300)
      await section(page, 'lidl').getByTestId('store-handle').click()
      await expect(openItem(section(page, 'lidl'), 'Zahnpasta')).toHaveCount(1)
    })

    test('tap checks off without a checkbox, undo restores', async ({ page }) => {
      const gurken = openItem(page, 'Gurken')
      await expect(gurken.locator('[role="checkbox"], input[type="checkbox"]')).toHaveCount(0)
      await gurken.click()
      await expect(openItem(page, 'Gurken')).toHaveCount(0)
      await page.getByTestId('snackbar-undo').click()
      await expect(openItem(page, 'Gurken')).toHaveCount(1)
    })

    test('right-click opens the same sheet as edit, prefilled; a chip change applies on Fertig', async ({ page }) => {
      await openItem(page, 'Milch').click({ button: 'right' })
      const editor = page.getByTestId('item-editor')
      await expect(editor).toBeVisible()
      await expect(page.getByTestId('add-input')).toHaveValue('2x Milch Weihenstephan 1,5 % 1 l')
      await expect(page.getByTestId('suggestion').first()).toHaveAttribute('data-source', 'current')
      await expect(page.getByTestId('chip-store')).toContainText('Edeka')
      await expect(page.getByTestId('tab-list')).toBeHidden()
      await page.getByTestId('chip-store').click()
      await page.getByTestId('store-option-lidl').click()
      await page.getByTestId('editor-done').click()
      await expect(editor).toBeHidden()
      await expect(openItem(section(page, 'lidl'), 'Milch')).toHaveCount(1)
      await expect(openItem(section(page, 'edeka'), 'Milch')).toHaveCount(0)
    })

    test('retyping in edit replaces the item with the tapped suggestion', async ({ page }) => {
      await openItem(page, 'Gurken').click({ button: 'right' })
      const input = page.getByTestId('add-input')
      await input.fill('3 Gurken Bio')
      await page.getByTestId('suggestion').first().click()
      await expect(page.getByTestId('item-editor')).toBeHidden()
      await expect(openItem(section(page, 'edeka'), 'Gurken')).toContainText('Bio')
      await expect(openItem(section(page, 'edeka'), 'Gurken')).toContainText('3')
    })

    test('a long name wraps and is shown in full', async ({ page }) => {
      const long = openItem(page, 'Sonnenblumenkernen')
      await long.scrollIntoViewIfNeeded()
      await expect(long).toContainText('Glutenfreie Dinkel-Vollkorn-Toastbrötchen mit Sonnenblumenkernen')
      const fits = await long.evaluate((el) => {
        const r = el.getBoundingClientRect()
        const clipped = [el, ...el.querySelectorAll('*')].some((n) => n.scrollWidth > n.clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible')
        return { clipped, right: r.right, vw: innerWidth, lines: Math.round(r.height / 20) }
      })
      expect(fits.clipped).toBe(false)
      expect(fits.right).toBeLessThanOrEqual(fits.vw)
      expect(fits.lines).toBeGreaterThanOrEqual(2)
    })

    test('hold and drag moves an item to another category', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Gurken'), category(page, 'edeka', 'brot'))
      await expect(openItem(category(page, 'edeka', 'brot'), 'Gurken')).toHaveCount(1)
      await expect(openItem(category(page, 'edeka', 'obst'), 'Gurken')).toHaveCount(0)
    })

    test('hold and drag moves an item to another store', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), openItem(page, 'Feuchttücher'), category(page, 'lidl', 'haushalt'))
      await expect(openItem(category(page, 'lidl', 'haushalt'), 'Feuchttücher')).toHaveCount(1)
      await expect(openItem(section(page, 'dm'), 'Feuchttücher')).toHaveCount(0)
    })

    test('hold and drag reorders stores without folding them', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), section(page, 'edeka').getByTestId('store-handle'), section(page, 'dm').getByTestId('store-handle'))
      await expect(page.getByTestId('store-section').first()).toHaveAttribute('data-store-id', 'edeka')
      await expect(section(page, 'edeka')).toHaveAttribute('data-collapsed', 'false')
    })

    test('hold and drag reorders categories within a store', async ({ page }) => {
      await holdAndDrag(page, mousePointer(page), category(page, 'edeka', 'brot').getByTestId('category-handle'), category(page, 'edeka', 'obst').getByTestId('category-handle'))
      await expect(section(page, 'edeka').getByTestId('category').first()).toHaveAttribute('data-category-id', 'brot')
      await expect(openItem(page, 'Gurken')).toHaveCount(1)
    })

    test('German by default, English after the toggle, nothing mixed', async ({ page }) => {
      await expect(page.getByTestId('tab-list')).toHaveText(/Liste/)
      await page.getByTestId('lang-toggle').click()
      await expect(page.getByTestId('tab-list')).not.toContainText('Liste')
      await openAndType(page, BRIEF)
      const first = page.getByTestId('suggestion').first()
      await expect(first).toContainText('As typed')
      await expect(first).toContainText('Size 3')
      await expect(page.getByTestId('chip-category')).toContainText('Drugstore')
      await expect(page.getByTestId('add-sheet')).not.toContainText(/Größe|Wie getippt|Andere/)
    })

    test('More tab shows the licenses page', async ({ page }) => {
      await page.getByTestId('tab-more').click()
      await page.getByTestId('licenses-link').click()
      await expect(page.getByTestId('licenses-page')).toContainText('flutter')
    })
  })
}
