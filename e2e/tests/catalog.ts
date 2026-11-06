import { expect, type Locator, type Page } from '@playwright/test';
import { boxOf, editSheet, itemRow, openEdit, openTab, pickInSheet, reveal, saveEdit } from './helpers';

/** The list's group headings, top to bottom. */
export function groupHeadings(page: Page): Promise<string[]> {
  return page.getByRole('heading', { level: 2 }).allTextContents();
}

/** The heading of the group an item row sits in: the nearest heading above it. */
export async function groupOf(page: Page, item: string): Promise<string | undefined> {
  const row = await itemRow(page, item).boundingBox();
  if (!row) return undefined;
  let found: string | undefined;
  let foundY = -Infinity;
  for (const heading of await page.getByRole('heading', { level: 2 }).all()) {
    const box = await heading.boundingBox();
    if (box && box.y < row.y && box.y > foundY) {
      foundY = box.y;
      found = (await heading.textContent()) ?? undefined;
    }
  }
  return found;
}

export async function expectGroup(page: Page, item: string, group: string): Promise<void> {
  await reveal(page, itemRow(page, item));
  await expect.poll(() => groupOf(page, item), { message: `${item} is under ${group}` }).toBe(group);
}

/** Drags a row of a reorderable list by its handle to the position of another row. */
export async function dragHandle(page: Page, handleName: string, ontoHandleName: string): Promise<void> {
  await clearOfBottom(page, page.getByText(handleName, { exact: true }));
  await clearOfBottom(page, page.getByText(ontoHandleName, { exact: true }));
  const from = await boxOf(page.getByText(handleName, { exact: true }));
  const to = await boxOf(page.getByText(ontoHandleName, { exact: true }));
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 5, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 20 });
  await page.waitForTimeout(300);
  await page.mouse.up();
}

/**
 * Wheels the page until [target] sits above the floating add button and the tab pill. The page runs
 * on behind both, and a press on a handle under them lands on them instead (job 144).
 */
async function clearOfBottom(page: Page, target: Locator): Promise<void> {
  const size = page.viewportSize();
  if (!size) return;
  await target.waitFor();
  // The button scales in with the page; a short look misses it on a slow runner.
  const fab = await page.getByRole('button', { name: /^(Kategorie|Laden) hinzufügen$/ }).first()
    .boundingBox({ timeout: 3_000 }).catch(() => null);
  const tabs = await page.getByRole('tab', { name: /^(Liste|List)$/ }).boundingBox({ timeout: 1_000 }).catch(() => null);
  const bottom = Math.min(fab?.y ?? size.height, tabs?.y ?? size.height) - 8;
  await page.mouse.move(size.width / 2, size.height / 3);
  for (let i = 0; i < 10; i++) {
    const box = await boxOf(target);
    if (box.y + box.height <= bottom) return;
    await page.mouse.wheel(0, Math.min(250, box.y + box.height - bottom + 16));
    await page.waitForTimeout(200);
  }
}

export type Section ={ store: string; headings: string[]; items: string[] };

/**
 * The list as a screen reader reads it: each store section (and 'Ohne Laden') in order, with its
 * category headings and rows (checkboxes since job 57). Rows are named by item, quantity, then
 * Marke · Eigenschaften. On wide screens the columns are read one after the other.
 */
export async function outline(page: Page): Promise<Section[]> {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const line of (await page.locator('body').ariaSnapshot()).split('\n')) {
    const [, role, name] = /- (button|checkbox|heading) "(.*)"/.exec(line) ?? [];
    if (role === undefined || name === undefined) continue;
    const store = /^(.+), \d+ Artikel$/.exec(name)?.[1];
    if (role === 'button' && store !== undefined) {
      current = { store, headings: [], items: [] };
      sections.push(current);
    } else if (role === 'button' && name === 'Zuletzt verwendet') {
      current = undefined;
    } else if (current && role === 'heading') {
      current.headings.push(name);
    } else if (current) {
      current.items.push(name);
    }
  }
  return sections;
}

/** The category headings of one store's section ('Ohne Laden' for no store), top to bottom. */
export async function sectionHeadings(page: Page, store: string): Promise<string[]> {
  return (await outline(page)).find((s) => s.store === store)?.headings ?? [];
}

/** The rows of one store's section, top to bottom, by their accessible names. */
export async function sectionItems(page: Page, store: string): Promise<string[]> {
  return (await outline(page)).find((s) => s.store === store)?.items ?? [];
}

const startsWith = (row: string, item: string) => row === item || row.startsWith(`${item} `);

/** The store section an item row sits in. */
export async function storeOf(page: Page, item: string): Promise<string | undefined> {
  return (await outline(page)).find((s) => s.items.some((row) => startsWith(row, item)))?.store;
}

/** Moves [item] to [store] in its edit sheet; ordering and moving live off the list since job 78. */
export async function setStore(page: Page, item: string, store: string): Promise<void> {
  await openEdit(page, item);
  await pickInSheet(page, 'Laden', store);
  await saveEdit(page);
}

/** Moves [item] to [category] in its edit sheet. */
export async function setCategory(page: Page, item: string, category: string): Promise<void> {
  await openEdit(page, item);
  await pickInSheet(page, 'Kategorie', category);
  await saveEdit(page);
}

/** Opens Liste → Anpassen (job 78): the stores, "Ohne Laden" pinned last. */
export async function openStores(page: Page): Promise<void> {
  await openTab(page, 'Liste');
  await page.getByRole('button', { name: 'Anpassen', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Läden' })).toBeVisible();
}

/** A store's row on the stores screen; null is the pinned "Ohne Laden". */
export const storeRow = (page: Page, store: string | null): Locator => store === null
  ? page.getByRole('button', { name: /^Ohne Laden/ })
  : page.getByRole('button', { name: store, exact: true });

/**
 * Opens a store's details under Liste → Anpassen: its name, its categories in walking order. Null
 * opens "Ohne Laden", the household's route order and its categories.
 */
export async function openStoreDetails(page: Page, store: string | null): Promise<void> {
  await openStores(page);
  await storeRow(page, store).click();
  await expect(page.getByRole('heading', { name: store ?? 'Ohne Laden', exact: true })).toBeVisible();
}

export async function deleteItem(page: Page, item: string): Promise<void> {
  await openEdit(page, item);
  await editSheet(page).getByRole('button', { name: 'Löschen' }).click();
  await expect(itemRow(page, item)).toHaveCount(0);
}
