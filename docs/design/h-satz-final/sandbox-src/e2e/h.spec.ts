import { expect, test, type Locator, type Page } from '@playwright/test'
import { EDEKA, brot, walk } from './h.ts'
import { category, holdAndDrag, mousePointer, openItem, section } from './helpers.ts'

const BRIEF = 'Windeln Pampers Größe 3'
/** Longest sheet transition is 280 ms; wait past it before measuring. */
const SETTLE = 450

async function openAndType(page: Page, text: string) {
  await page.getByTestId('add-input').click()
  await expect(page.getByTestId('add-sheet')).toBeVisible()
  await page.getByTestId('add-input').pressSequentially(text, { delay: 10 })
  await page.waitForTimeout(SETTLE)
}

const box = async (l: Locator) => (await l.boundingBox())!
const scrolls = (l: Locator) => l.evaluate((el) => el.scrollHeight > el.clientHeight + 1)

test.describe('h-satz-final', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/h-satz-final')
    await expect(section(page, 'dm')).toBeVisible()
  })

  test('typing lists the parse first; a store chip pick applies to the tapped suggestion', async ({ page }) => {
    await openAndType(page, BRIEF)
    const first = page.getByTestId('suggestion').first()
    await expect(first).toHaveAttribute('data-source', 'typed')
    for (const text of ['Windeln', 'Pampers', 'Größe 3']) await expect(first).toContainText(text)
    await page.getByTestId('chip-store').click()
    await page.getByTestId('store-option-edeka').click()
    await expect(page.getByTestId('chip-store')).toContainText('Edeka')
    await expect(page.getByTestId('store-option-edeka')).toHaveCount(0)
    await page.getByTestId('suggestion').nth(2).click()
    await expect(page.getByTestId('add-input')).toHaveValue('')
    await expect(page.getByTestId('added-note')).toContainText('Edeka')
    await page.getByTestId('sheet-close').click()
    await expect(openItem(section(page, 'edeka'), 'Windeln')).toContainText('Big Pack')
    await expect(openItem(section(page, 'dm'), 'Windeln')).toHaveCount(0)
  })

  test('Enter adds the first suggestion', async ({ page }) => {
    await openAndType(page, BRIEF)
    await page.keyboard.press('Enter')
    await page.keyboard.press('Escape')
    await expect(openItem(section(page, 'dm'), 'Windeln')).toContainText('Größe 3')
  })

  test('the sheet opens at about half height, grows with suggestions, and scrolls only at full height', async ({ page }) => {
    const input = page.getByTestId('add-input')
    const sheet = page.getByTestId('sheet-surface')
    const list = page.getByTestId('suggestions')
    const vh = page.viewportSize()!.height
    const closed = await box(input)
    await expect(page.getByTestId('tab-list')).toBeVisible()

    await openAndType(page, 'Spülmittel')
    expect(await page.getByTestId('suggestion').count()).toBeLessThanOrEqual(2)
    const short = await box(sheet)
    expect(short.height / vh, 'short query: about half the screen').toBeGreaterThanOrEqual(0.4)
    expect(short.height / vh).toBeLessThanOrEqual(0.6)
    expect(await scrolls(list), 'short list does not scroll').toBe(false)
    await expect(page.getByTestId('tab-list')).toBeHidden()
    const opened = await box(input)
    expect(Math.abs(opened.y - closed.y), 'input y open').toBeLessThanOrEqual(2)
    expect(Math.abs(opened.height - closed.height), 'input height open').toBeLessThanOrEqual(2)

    await input.fill('Milch')
    await page.waitForTimeout(SETTLE)
    const grown = await box(sheet)
    const maxTop = await page.evaluate(() => (parseFloat(getComputedStyle(document.querySelector('.h-root')!).getPropertyValue('--safe-top')) || 0) + 28)
    expect(grown.height, 'more suggestions: taller').toBeGreaterThan(short.height + 100)
    expect(grown.y, 'below the max').toBeGreaterThan(maxTop + 2)
    expect(await scrolls(list), 'below max the list does not scroll').toBe(false)
    expect(Math.abs((await box(input)).y - closed.y), 'input y grown').toBeLessThanOrEqual(2)

    await input.fill(BRIEF)
    await page.waitForTimeout(SETTLE)
    const full = await box(sheet)
    expect(full.y, 'never above the max').toBeGreaterThanOrEqual(maxTop - 2)
    expect(full.y, 'at the max').toBeLessThanOrEqual(maxTop + 2)
    expect(await scrolls(list), 'at max the list scrolls').toBe(true)
    expect(Math.abs((await box(input)).y - closed.y), 'input y full').toBeLessThanOrEqual(2)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(SETTLE)
    expect(Math.abs((await box(input)).y - closed.y), 'input y after close').toBeLessThanOrEqual(2)
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

  test('store and category dividers scroll with the list and never stick', async ({ page }) => {
    const store = section(page, 'edeka').getByTestId('store-handle')
    const cat = category(page, 'edeka', 'kuehl').getByTestId('category-handle')
    const tops = () => Promise.all([store, cat].map((l) => l.evaluate((el) => el.getBoundingClientRect().top)))
    for (const l of [store, cat]) expect(await l.evaluate((el) => getComputedStyle(el).position)).not.toMatch(/sticky|fixed/)
    const before = await tops()
    const delta = await page.getByTestId('list-scroll').evaluate((el) => {
      const from = el.scrollTop
      el.scrollTop = from + 300
      return el.scrollTop - from
    })
    expect(delta).toBeGreaterThan(200)
    const after = await tops()
    expect(after[0]).toBeCloseTo(before[0] - delta, 0)
    expect(after[1]).toBeCloseTo(before[1] - delta, 0)
  })

  test('a folded store shows only its name and count, and stays folded after a reload', async ({ page }) => {
    const edeka = section(page, 'edeka')
    await edeka.getByTestId('store-handle').click()
    await expect(edeka).toHaveAttribute('data-collapsed', 'true')
    await expect(openItem(edeka, '')).toHaveCount(0)
    const headText = (s: Locator) =>
      s.getByTestId('store-handle').evaluate((el) => {
        const badge = el.querySelector('.st-badge')?.textContent ?? ''
        const text = (el as HTMLElement).innerText.trim()
        return (text.startsWith(badge) ? text.slice(badge.length) : text).replace(/\s+/g, ' ').trim()
      })
    expect(await headText(edeka)).toBe('Edeka 8 Artikel')
    await page.reload()
    await expect(section(page, 'edeka')).toHaveAttribute('data-collapsed', 'true')
    expect(await headText(section(page, 'edeka'))).toBe('Edeka 8 Artikel')
    await section(page, 'edeka').getByTestId('store-handle').click()
    expect(await walk(section(page, 'edeka'))).toEqual(EDEKA)
  })

  test('a folded store still takes a dropped item', async ({ page }) => {
    await section(page, 'lidl').getByTestId('store-handle').click()
    await holdAndDrag(page, mousePointer(page), openItem(page, 'Zahnpasta'), section(page, 'lidl').getByTestId('store-handle'))
    await expect(section(page, 'lidl').getByTestId('store-count')).toContainText('4')
    await page.waitForTimeout(300)
    await section(page, 'lidl').getByTestId('store-handle').click()
    await expect(openItem(section(page, 'lidl'), 'Zahnpasta')).toHaveCount(1)
  })

  test('items keep their walk order through check, undo and edit', async ({ page }) => {
    const edeka = section(page, 'edeka')
    expect(await walk(edeka)).toEqual(EDEKA)
    await openItem(page, 'Gurken').click()
    await expect(openItem(page, 'Gurken')).toHaveCount(0)
    await page.getByTestId('snackbar-undo').click()
    expect(await walk(edeka)).toEqual(EDEKA)
    await openItem(page, 'Joghurt').click({ button: 'right' })
    await page.getByTestId('field-qty').fill('3')
    await page.getByTestId('editor-done').click()
    await expect(openItem(page, 'Joghurt')).toContainText('3×')
    expect(await walk(edeka)).toEqual(EDEKA)
  })

  test('dropping on the upper half of a row puts the item right before it', async ({ page }) => {
    await holdAndDrag(page, mousePointer(page), openItem(page, 'Kaffee'), brot(page), 0.25)
    expect(await walk(section(page, 'edeka'))).toEqual(['Bananen', 'Gurken', 'Kaffee', 'Brötchen', 'Glutenfreie', 'Milch', 'Joghurt', 'Hackfleisch'])
    await expect(openItem(category(page, 'edeka', 'brot'), 'Kaffee')).toHaveCount(1)
  })

  test('dropping on a row in another category adopts that category, after the row', async ({ page }) => {
    await holdAndDrag(page, mousePointer(page), openItem(page, 'Gurken'), openItem(page, 'Milch'), 0.75)
    await expect(openItem(category(page, 'edeka', 'kuehl'), 'Gurken')).toHaveCount(1)
    expect(await walk(category(page, 'edeka', 'kuehl'))).toEqual(['Milch', 'Gurken', 'Joghurt'])
  })

  test('hold and drag reorders stores and categories', async ({ page }) => {
    await holdAndDrag(page, mousePointer(page), category(page, 'edeka', 'brot').getByTestId('category-handle'), category(page, 'edeka', 'obst').getByTestId('category-handle'))
    await expect(section(page, 'edeka').getByTestId('category').first()).toHaveAttribute('data-category-id', 'brot')
    await holdAndDrag(page, mousePointer(page), section(page, 'edeka').getByTestId('store-handle'), section(page, 'dm').getByTestId('store-handle'))
    await expect(page.getByTestId('store-section').first()).toHaveAttribute('data-store-id', 'edeka')
  })

  test('right-click edits field by field; changing only the brand saves only the brand', async ({ page }) => {
    const before = await walk(section(page, 'edeka'))
    await openItem(page, 'Milch').click({ button: 'right' })
    const editor = page.getByTestId('item-editor')
    await expect(editor).toBeVisible()
    await expect(page.getByTestId('field-name')).toHaveValue('Milch')
    await expect(page.getByTestId('field-brand')).toHaveValue('Weihenstephan')
    await expect(page.getByTestId('field-props')).toHaveValue('1,5 %, 1 l')
    await expect(page.getByTestId('field-qty')).toHaveValue('2')
    await expect(page.getByTestId('chip-store')).toContainText('Edeka')
    await expect(page.getByTestId('chip-category')).toContainText('Kühlregal')
    await expect(page.getByTestId('suggestion')).toHaveCount(0)
    await expect(page.getByTestId('add-input')).toBeHidden()
    await expect(page.getByTestId('tab-list')).toBeHidden()
    await page.waitForTimeout(SETTLE)
    const sheet = await box(page.getByTestId('sheet-surface'))
    const content = await page.evaluate(() => {
      const top = document.querySelector('.hc-top')!.getBoundingClientRect().height
      const band = document.querySelector('.hc-body')!.parentElement!.getBoundingClientRect().bottom - document.querySelector('.hc-body')!.getBoundingClientRect().bottom
      return top + band
    })
    expect(sheet.height, 'no dead area').toBeLessThanOrEqual(content + 2)

    await page.getByTestId('field-brand').fill('Landliebe')
    await page.getByTestId('editor-done').click()
    await expect(editor).toBeHidden()
    const milch = openItem(category(page, 'edeka', 'kuehl'), 'Milch')
    await expect(milch).toContainText('Landliebe · 1,5 % · 1 l')
    await expect(milch).toContainText('2×')
    await expect(milch.locator('.h-emoji')).toHaveText('🥛')
    expect(await walk(section(page, 'edeka'))).toEqual(before)
  })

  test('edit: a store chip moves the item, an empty name cannot be saved, Löschen removes with Undo', async ({ page }) => {
    await openItem(page, 'Milch').click({ button: 'right' })
    await page.getByTestId('field-name').fill('')
    await expect(page.getByTestId('editor-done')).toBeDisabled()
    await page.getByTestId('field-name').fill('Milch')
    await page.getByTestId('chip-store').click()
    await page.getByTestId('store-option-lidl').click()
    await page.getByTestId('editor-done').click()
    await expect(openItem(section(page, 'lidl'), 'Milch')).toContainText('Weihenstephan')
    await expect(openItem(section(page, 'edeka'), 'Milch')).toHaveCount(0)

    await page.waitForTimeout(SETTLE)
    await openItem(page, 'Joghurt').click({ button: 'right' })
    await page.getByTestId('editor-delete').click()
    await expect(page.getByTestId('item-editor')).toBeHidden()
    await expect(openItem(page, 'Joghurt')).toHaveCount(0)
    await page.getByTestId('snackbar-undo').click()
    await expect(openItem(category(page, 'edeka', 'kuehl'), 'Joghurt')).toHaveCount(1)
  })

  test('Escape cancels an edit without saving', async ({ page }) => {
    await openItem(page, 'Gurken').click({ button: 'right' })
    await page.getByTestId('field-name').fill('Zucchini')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('item-editor')).toBeHidden()
    await expect(openItem(page, 'Gurken')).toHaveCount(1)
    await expect(openItem(page, 'Zucchini')).toHaveCount(0)
  })

  test('tap checks off without a checkbox or member badge, undo restores', async ({ page }) => {
    const milch = openItem(page, 'Milch')
    await expect(milch.locator('[role="checkbox"], input[type="checkbox"]')).toHaveCount(0)
    expect((await milch.textContent())!.replace(/\s+/g, ' ').trim()).toBe('🥛2×MilchWeihenstephan · 1,5 % · 1 l')
    await milch.click()
    await expect(openItem(page, 'Milch')).toHaveCount(0)
    await page.getByTestId('snackbar-undo').click()
    await expect(openItem(page, 'Milch')).toHaveCount(1)
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

  test('German by default, English everywhere after the toggle', async ({ page }) => {
    await expect(page.getByTestId('tab-list')).toHaveText(/Liste/)
    await expect(section(page, 'edeka').getByTestId('store-count')).toHaveText('8 Artikel')
    await page.getByTestId('lang-toggle').click()
    await expect(section(page, 'edeka').getByTestId('store-count')).toHaveText('8 items')
    await expect(category(page, 'edeka', 'obst').getByTestId('category-handle')).toHaveText('Fruit & Veg')
    await openAndType(page, BRIEF)
    await expect(page.getByTestId('suggestion').first()).toContainText('As typed')
    await expect(page.getByTestId('suggestion').first()).toContainText('Size 3')
    await expect(page.getByTestId('chip-category')).toContainText('Drugstore')
    await expect(page.getByTestId('add-sheet')).not.toContainText(/Größe|Wie getippt|Andere|Hinzufügen|Schließen/)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(SETTLE)
    await openItem(page, 'Milch').click({ button: 'right' })
    const editor = page.getByTestId('item-editor')
    for (const label of ['Name', 'Brand', 'Details', 'Qty']) await expect(editor.getByText(label, { exact: true })).toBeVisible()
    await expect(page.getByTestId('field-props')).toHaveValue('1.5 %, 1 l')
    await expect(editor).not.toContainText(/Bezeichnung|Marke|Eigenschaften|Menge|Bearbeiten|Abbrechen|Kühlregal/)
    await expect(page.getByTestId('editor-done')).toHaveText('Done')
    await expect(page.getByTestId('editor-delete')).toHaveText('Delete')
    await page.getByTestId('editor-done').click()
    await expect(openItem(page, 'Milch')).toContainText('Weihenstephan · 1.5 % · 1 l')

    await page.goto('/#/')
    await expect(page.getByTestId('index-round-3')).toContainText('Round 3')
    await expect(page.getByTestId('index-link-h-satz-final')).toContainText('Walk order')
    await expect(page.getByTestId('index-page')).not.toContainText(/Runde|Laufreihenfolge/)
  })

  test('the index lists round 3 first', async ({ page }) => {
    await page.goto('/#/')
    const rounds = await page.locator('[data-testid^="index-round-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')))
    expect(rounds).toEqual(['index-round-3', 'index-round-2', 'index-round-1'])
    await expect(page.getByTestId('index-round-3').getByTestId('index-link-h-satz-final')).toContainText('Laufreihenfolge')
  })

  test('More tab shows the licenses page', async ({ page }) => {
    await page.getByTestId('tab-more').click()
    await page.getByTestId('licenses-link').click()
    await expect(page.getByTestId('licenses-page')).toContainText('flutter')
  })
})
