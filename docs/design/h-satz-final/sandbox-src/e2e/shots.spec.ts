import { expect, test } from '@playwright/test'
import { DIRECTIONS } from './directions.ts'
import { ROUND2 } from './round2.ts'

const SHOTS = '/workspace/fg-design-sandbox/shots'

test('index', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByTestId('index-page')).toBeVisible()
  await page.screenshot({ path: `${SHOTS}/index.png`, fullPage: true })
})

for (const dir of DIRECTIONS) {
  test(`${dir} screenshots`, async ({ page }) => {
    await page.goto(`/#/${dir}`)
    await expect(page.locator('[data-testid="store-section"]').first()).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${dir}-list.png` })
    await page.getByTestId('add-open').click()
    await page.getByTestId('add-input').pressSequentially('Windeln Pampers Größe 3')
    await expect(page.getByTestId('preview')).toContainText('Pampers')
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/${dir}-add.png` })
  })

  test(`${dir} editor screenshot`, async ({ page }) => {
    await page.goto(`/#/${dir}`)
    const milch = page.locator('[data-testid="item"][data-checked="false"]').filter({ hasText: 'Milch' })
    await milch.scrollIntoViewIfNeeded()
    await milch.click({ button: 'right' })
    await expect(page.getByTestId('editor-done')).toBeVisible()
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/${dir}-edit.png` })
  })
}

for (const v of ROUND2) {
  test(`${v} screenshots`, async ({ page }) => {
    await page.goto(`/#/${v}`)
    await expect(page.locator('[data-testid="store-section"]').first()).toBeVisible()
    await page.getByRole('button', { name: /Verstanden/ }).click()
    await page.screenshot({ path: `${SHOTS}/${v}-list.png` })
    await page.getByTestId('add-input').click()
    await page.getByTestId('add-input').pressSequentially('Windeln Pampers Größe 3')
    await expect(page.getByTestId('suggestion').first()).toContainText('Pampers')
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${SHOTS}/${v}-add.png` })
    await page.getByTestId('chip-store').click()
    await expect(page.getByTestId('store-option-edeka')).toBeVisible()
    await page.waitForTimeout(350)
    await page.screenshot({ path: `${SHOTS}/${v}-add-chip-open.png` })
  })

  test(`${v} edit screenshot`, async ({ page }) => {
    await page.goto(`/#/${v}`)
    await page.locator('[data-testid="item"][data-checked="false"]').filter({ hasText: 'Milch' }).click({ button: 'right' })
    await expect(page.getByTestId('editor-done')).toBeVisible()
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${SHOTS}/${v}-edit.png` })
  })
}

test.describe('h-satz-final screenshots', () => {
  const H = 'h-satz-final'
  test.beforeEach(async ({ page }) => {
    await page.goto(`/#/${H}`)
    await expect(page.locator('[data-testid="store-section"]').first()).toBeVisible()
  })

  test('list and folded list', async ({ page }) => {
    await page.getByRole('button', { name: /Verstanden/ }).click()
    await page.screenshot({ path: `${SHOTS}/${H}-list.png` })
    await page.locator('[data-testid="store-section"][data-store-id="dm"]').getByTestId('store-handle').click()
    await page.locator('[data-testid="store-section"][data-store-id="edeka"]').getByTestId('store-handle').click()
    await page.getByTestId('list-scroll').evaluate((el) => (el.scrollTop = 0))
    await page.waitForTimeout(300)
    await page.screenshot({ path: `${SHOTS}/${H}-list-collapsed.png` })
  })

  test('add, short and grown', async ({ page }) => {
    await page.getByTestId('add-input').click()
    await page.getByTestId('add-input').pressSequentially('Spülmittel')
    await expect(page.getByTestId('suggestion').first()).toContainText('Spülmittel')
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${SHOTS}/${H}-add.png` })
    await page.getByTestId('add-input').fill('Windeln Pampers Größe 3')
    await expect(page.getByTestId('suggestion').first()).toContainText('Pampers')
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${SHOTS}/${H}-add-grown.png` })
  })

  test('edit', async ({ page }) => {
    await page.locator('[data-testid="item"][data-checked="false"]').filter({ hasText: 'Milch' }).click({ button: 'right' })
    await expect(page.getByTestId('field-name')).toBeVisible()
    await page.waitForTimeout(450)
    await page.screenshot({ path: `${SHOTS}/${H}-edit.png` })
  })
})
