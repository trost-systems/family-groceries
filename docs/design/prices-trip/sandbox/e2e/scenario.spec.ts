import { expect, type Locator, type Page, test } from '@playwright/test'

/**
 * The shared scenario through each approach, ending on the same trip: Milch 3 × 1,19, Butter 2,49,
 * Bananen 1,68, Wasser 2 × 2,94 = 13,62 € with Joghurt, Äpfel and Brot still open.
 */
const SHOTS = process.env.SHOTS ?? '../../../screenshots/189'
const END = '13,62 €'

const phone = (page: Page): Locator => page.locator('.phone')
const row = (page: Page, id: string): Locator => phone(page).locator(`[data-item="${id}"]`)
const total = (page: Page): Locator => phone(page).getByTestId('trip-total').first()
const price = (page: Page): Locator => phone(page).locator('input[name="price"]')
const weight = (page: Page): Locator => phone(page).locator('input[name="weight"]')
const alert = (page: Page): Locator => phone(page).getByRole('alert')
const shot = (page: Page, slug: string, name: string) => phone(page).screenshot({ path: `${SHOTS}/${slug}-${name}.png`, animations: 'disabled' })

async function open(page: Page, slug: string) {
  await page.goto(`/#/${slug}`)
  await expect(phone(page)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
}

/** Empty, letters, too large and zero, each with its message, through a text field. */
async function fieldErrors(page: Page, save: () => Promise<void>) {
  await price(page).fill('')
  await save()
  await expect(alert(page)).toHaveText('Gib einen Preis ein.')
  await price(page).fill('abc')
  await save()
  await expect(alert(page)).toHaveText('Nur Zahlen mit Komma, z. B. 1,19.')
  await price(page).fill('1000')
  await save()
  await expect(alert(page)).toHaveText('Höchstens 999,99 € pro Artikel.')
  await price(page).fill('0')
  await save()
  await expect(alert(page)).toHaveText('Der Preis muss über 0 € liegen.')
}

test('1 inline-row-price', async ({ page }) => {
  const slug = 'inline-row-price'
  await open(page, slug)
  await expect(total(page)).toContainText('2,29 €')
  await shot(page, slug, '0-start')

  const fertig = () => phone(page).getByRole('button', { name: 'Fertig' }).click()
  await row(page, 'milch').getByRole('button', { name: /Preis für Vollmilch/ }).click()
  await expect(price(page)).toBeFocused()
  await price(page).fill('1,19')
  await expect(row(page, 'milch').getByTestId('draft-meaning')).toHaveText('Zusammen 2,38 €')
  await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Mehr' }).click()
  await expect(row(page, 'milch').getByTestId('draft-meaning')).toHaveText('Zusammen 3,57 €')
  await shot(page, slug, '1-enter')
  await price(page).press('Enter')
  await expect(row(page, 'milch')).toContainText('3× Vollmilch')
  await expect(row(page, 'milch')).toContainText('3,57 €')

  await row(page, 'butter').getByRole('button', { name: /Preis für Butter/ }).click()
  await expect(price(page)).toHaveValue('2,29')
  await price(page).fill('2,49')
  await fertig()

  await row(page, 'joghurt').getByRole('button', { name: /Preis für Joghurt/ }).click()
  await fieldErrors(page, fertig)
  await price(page).fill('1000')
  await fertig()
  await shot(page, slug, '2-error')
  await price(page).press('Escape')
  await expect(row(page, 'joghurt')).toContainText('Preis')

  await row(page, 'bananen').getByRole('button', { name: /Preis für Bananen/ }).click()
  await phone(page).getByRole('radio', { name: 'vom Etikett' }).click()
  await price(page).fill('1,68')
  await expect(row(page, 'bananen').getByTestId('draft-meaning')).toHaveText('Das sind 1,99 €/kg')
  await shot(page, slug, '3-weight')
  await fertig()

  await row(page, 'wasser').getByRole('button', { name: /Preis für Mineralwasser/ }).click()
  await price(page).fill('2,94')
  await expect(row(page, 'wasser').getByTestId('draft-meaning')).toHaveText('Zusammen 5,88 € · 0,49 € pro Flasche')
  await fertig()

  await expect(total(page)).toContainText(END)
  await expect(total(page)).toContainText('4 mit Preis · 3 offen')
  await shot(page, slug, '4-total')
})

test('2 item-sheet-price', async ({ page }) => {
  const slug = 'item-sheet-price'
  await open(page, slug)
  await shot(page, slug, '0-start')
  const sheet = phone(page).getByRole('dialog')
  const take = () => sheet.getByRole('button', { name: 'Übernehmen' }).click()

  await row(page, 'milch').click()
  await price(page).fill('1,19')
  await sheet.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Mehr' }).click()
  await expect(sheet.getByTestId('total-after')).toHaveText('Summe danach 5,86 €')
  await expect(total(page)).toContainText('2,29 €')
  await shot(page, slug, '1-enter')
  await take()
  await expect(total(page)).toContainText('5,86 €')
  await expect(row(page, 'milch')).toContainText('je 1,19 €')

  await row(page, 'butter').click()
  await expect(price(page)).toHaveValue('2,29')
  await price(page).fill('2,49')
  await take()

  await row(page, 'joghurt').click()
  await fieldErrors(page, take)
  await shot(page, slug, '2-error')
  await sheet.getByRole('button', { name: 'Schließen' }).click()
  await expect(sheet).toHaveCount(0)

  await row(page, 'bananen').click()
  await expect(sheet.getByRole('radio', { name: 'kg', exact: true })).toBeChecked()
  await price(page).fill('1,99')
  await weight(page).fill('0,846')
  await expect(sheet.getByTestId('draft-meaning')).toHaveText('Zusammen 1,68 €')
  await shot(page, slug, '3-weight')
  await take()

  await row(page, 'wasser').click()
  await price(page).fill('2,94')
  await expect(sheet.getByTestId('draft-meaning')).toHaveText('Zusammen 5,88 € · 0,49 € pro Flasche')
  await take()

  await expect(total(page)).toContainText(END)
  await shot(page, slug, '4-total')
})

test('3 trip-review-list', async ({ page }) => {
  const slug = 'trip-review-list'
  await open(page, slug)
  await shot(page, slug, '0-start')
  await phone(page).getByRole('button', { name: 'An der Kasse: Preise eintragen' }).click()
  const step = phone(page).getByTestId('step')
  const weiter = () => phone(page).getByRole('button', { name: 'Weiter' }).click()
  const skip = () => phone(page).getByRole('button', { name: 'Überspringen' }).click()

  await expect(step).toHaveText('1 von 7')
  await price(page).fill('1,19')
  await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Mehr' }).click()
  await shot(page, slug, '1-enter')
  await price(page).press('Enter')

  await expect(step).toHaveText('2 von 7')
  await expect(total(page)).toContainText('5,86 €')
  await expect(price(page)).toHaveValue('2,29')
  await price(page).fill('2,49')
  await weiter()

  await expect(step).toHaveText('3 von 7')
  await fieldErrors(page, weiter)
  await shot(page, slug, '2-error')
  await skip()

  await expect(step).toHaveText('4 von 7')
  await price(page).fill('1,99')
  await expect(phone(page).getByTestId('draft-meaning')).toHaveText('Zusammen 1,68 €')
  await shot(page, slug, '3-weight')
  await weiter()
  await skip()
  await price(page).fill('2,94')
  await weiter()
  await skip()

  await expect(total(page)).toContainText(END)
  await expect(phone(page)).toContainText('3 Artikel ohne Preis')
  await shot(page, slug, '4-total')

  await row(page, 'butter').click()
  await expect(step).toHaveText('2 von 7')
  await expect(price(page)).toHaveValue('2,49')
})

test('4 focused-price-keypad', async ({ page }) => {
  const slug = 'focused-price-keypad'
  await open(page, slug)
  await shot(page, slug, '0-start')
  const pad = phone(page).getByRole('dialog')
  const keys = async (s: string) => {
    for (const k of s) await pad.getByRole('button', { name: k, exact: true }).click()
  }
  const ok = () => pad.getByRole('button', { name: /^OK/ }).click()
  const amount = pad.getByTestId('amount')

  await row(page, 'milch').click()
  await keys('1,19')
  await expect(amount).toHaveText('1,19€')
  await pad.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Mehr' }).click()
  await expect(pad.getByRole('button', { name: /^OK/ })).toHaveText('OK · Summe 5,86 €')
  await expect(total(page)).toBeVisible()
  await shot(page, slug, '1-enter')
  await ok()

  await row(page, 'butter').click()
  await expect(amount).toHaveText('2,29€')
  await keys('2,49')
  await ok()

  await row(page, 'joghurt').click()
  await ok()
  await expect(alert(page)).toHaveText('Gib einen Preis ein.')
  await page.keyboard.type('abc')
  await expect(amount).toHaveText('0€')
  await keys('1000')
  await ok()
  await expect(alert(page)).toHaveText('Höchstens 999,99 € pro Artikel.')
  await shot(page, slug, '2-error')
  await pad.getByRole('button', { name: 'Löschen' }).click()
  await pad.getByRole('button', { name: 'Löschen' }).click()
  await pad.getByRole('button', { name: 'Löschen' }).click()
  await pad.getByRole('button', { name: 'Löschen' }).click()
  await keys('0')
  await ok()
  await expect(alert(page)).toHaveText('Der Preis muss über 0 € liegen.')
  await pad.getByRole('button', { name: 'Schließen' }).click()

  await row(page, 'bananen').click()
  await keys('1,99')
  await expect(pad).toContainText('= 1,68 €')
  await pad.getByRole('button', { name: /0,846 kg/ }).click()
  await keys('0,9')
  await expect(pad).toContainText('= 1,79 €')
  await shot(page, slug, '3-weight')
  await pad.getByRole('button', { name: /0,9 kg/ }).click()
  await keys('1,99')
  await pad.getByRole('button', { name: /0,9 kg/ }).click()
  await keys('0,846')
  await ok()

  await row(page, 'wasser').click()
  await page.keyboard.type('2,94')
  await expect(pad).toContainText('= 5,88 € · 0,49 € pro Stück im Pack')
  await page.keyboard.press('Enter')

  await expect(total(page)).toContainText(END)
  await shot(page, slug, '4-total')
})

test('5 last-price-confirm', async ({ page }) => {
  const slug = 'last-price-confirm'
  await open(page, slug)
  await expect(total(page)).toContainText('2,29 €')
  await expect(total(page)).toContainText('mit Vorschlägen ≈ 19,90 €')
  await shot(page, slug, '0-start')

  const take = () => phone(page).getByRole('button', { name: 'Übernehmen', exact: true }).click()
  await row(page, 'milch').getByRole('button', { name: /Vollmilch 1 l: 2,38 € übernehmen/ }).click()
  await expect(total(page)).toContainText('4,67 €')
  await row(page, 'milch').getByRole('button', { name: /Preis für Vollmilch/ }).click()
  await expect(price(page)).toHaveValue('1,19')
  await page.getByRole('group', { name: 'Menge' }).getByRole('button', { name: 'Mehr' }).click()
  await shot(page, slug, '1-enter')
  await take()

  await row(page, 'butter').getByRole('button', { name: /Preis für Butter/ }).click()
  await expect(price(page)).toHaveValue('2,29')
  await price(page).fill('2,49')
  await expect(phone(page).getByTestId('delta')).toHaveText('0,30 € teurer als zuletzt (2,19 € pro Stück)')
  await take()
  await expect(row(page, 'butter')).toContainText('zuletzt 2,19 €')

  await row(page, 'joghurt').getByRole('button', { name: /Preis für Joghurt/ }).click()
  await expect(price(page)).toHaveValue('1,79')
  await fieldErrors(page, take)
  await shot(page, slug, '2-error')
  await price(page).press('Escape')

  await row(page, 'bananen').getByRole('button', { name: /Preis für Bananen/ }).click()
  await expect(price(page)).toHaveValue('1,99')
  await expect(weight(page)).toHaveValue('0,846')
  await expect(row(page, 'bananen').getByTestId('draft-meaning')).toHaveText('Zusammen 1,68 €')
  await shot(page, slug, '3-weight')
  await take()
  await row(page, 'wasser').getByRole('button', { name: /Preis für Mineralwasser/ }).click()
  await expect(row(page, 'wasser').getByTestId('draft-meaning')).toHaveText('Zusammen 5,88 € · 0,49 € pro Flasche')
  await take()
  await expect(total(page)).toContainText(END)
  await shot(page, slug, '4-total')

  await phone(page).getByRole('button', { name: 'Alle übernehmen' }).click()
  await expect(total(page)).toContainText('Alle Preise bestätigt')
  await expect(total(page)).toContainText('21,29 €')
})

test('comparison page shows all five side by side and the recommendation', async ({ page }) => {
  await page.setViewportSize({ width: 2100, height: 1160 })
  await page.goto('/#/')
  await expect(page.locator('.slot')).toHaveCount(5)
  for (const slug of ['inline-row-price', 'item-sheet-price', 'trip-review-list', 'focused-price-keypad', 'last-price-confirm'])
    await expect(page.locator(`.slot[data-slug="${slug}"]`)).toBeVisible()
  await page.evaluate(() => document.fonts.ready)
  await page.screenshot({ path: `${SHOTS}/comparison.png` })
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.screenshot({ path: `${SHOTS}/comparison-dark.png` })
  await page.emulateMedia({ colorScheme: 'light' })
  await page.getByRole('link', { name: 'Empfehlung' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})
