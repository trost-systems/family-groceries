import type { Locator, Page } from '@playwright/test'

/** First word of each open item's name in a store or category, in DOM (walk) order. */
export const walk = (scope: Locator) =>
  scope.locator('[data-testid="item"][data-checked="false"]').evaluateAll((els) => els.map((e) => e.querySelector('.h-name')!.lastChild!.textContent!.split(' ')[0]))

export const EDEKA = ['Bananen', 'Gurken', 'Brötchen', 'Glutenfreie', 'Milch', 'Joghurt', 'Hackfleisch', 'Kaffee']

/** The plain "Brötchen" row; the long Toastbrötchen name contains the same word. */
export const brot = (page: Page) =>
  page.locator('[data-testid="item"][data-checked="false"]').filter({ has: page.locator('.h-name', { hasText: /Brötchen$/ }) })
