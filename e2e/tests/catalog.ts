import { expect, type Locator, type Page } from '@playwright/test';
import { editSheet, itemRow, listArea, openEdit, reveal, storeDivider } from './helpers';

/** The list's group headings, top to bottom (the household name above the list excluded). */
export async function groupHeadings(page: Page): Promise<string[]> {
  const headings = await page.getByRole('heading', { level: 2 }).allTextContents();
  return headings.slice(1);
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

/** Long-press drag of an item row onto a group heading. */
export async function dragItemTo(page: Page, item: string, group: string): Promise<void> {
  const from = (await itemRow(page, item).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(800);
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  const target = page.getByRole('heading', { level: 2, name: group, exact: true });
  await expect(target).toBeVisible();
  const to = (await target.boundingBox())!;
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

/** Drags a row of a reorderable list by its handle to the position of another row. */
export async function dragHandle(page: Page, handleName: string, ontoHandleName: string): Promise<void> {
  const from = (await page.getByText(handleName, { exact: true }).boundingBox())!;
  const to = (await page.getByText(ontoHandleName, { exact: true }).boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 5, { steps: 3 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 - 4, { steps: 20 });
  await page.waitForTimeout(300);
  await page.mouse.up();
}

export type Section = { store: string; headings: string[]; items: string[] };

/**
 * The list as a screen reader reads it: each store section (and 'Ohne Laden') in order, with its
 * category headings and rows. Rows are named by item, quantity, then Marke · Eigenschaften. On wide
 * screens the columns are read one after the other.
 */
export async function outline(page: Page): Promise<Section[]> {
  const sections: Section[] = [];
  let current: Section | undefined;
  for (const line of (await page.locator('body').ariaSnapshot()).split('\n')) {
    const match = /- (button|heading) "(.*)"/.exec(line);
    if (!match) continue;
    const [, role, name] = match;
    const store = /^(.+), \d+ Artikel$/.exec(name);
    if (role === 'button' && store) {
      current = { store: store[1], headings: [], items: [] };
      sections.push(current);
    } else if (role === 'button' && name === 'Zuletzt gekauft') {
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

type Box = { x: number; y: number; width: number; height: number };

/**
 * Holds [from] until it lifts, then carries it to [to] and lets go at [at] (a point in the target's
 * box). A target off screen is reached the way a user reaches it: by holding the item at the list's
 * top or bottom edge until the list has scrolled it into view. [up] says which way that is; as a
 * function it is asked once the item moves, when the empty stores show as drop targets too.
 * [beforeDrop] runs over the target, just before letting go.
 */
export async function holdAndDrop(
  page: Page, from: Locator, to: Locator, at: (box: Box) => { x: number; y: number },
  { up, beforeDrop }: { up: boolean | (() => Promise<boolean>); beforeDrop?: () => Promise<void> },
): Promise<void> {
  await reveal(page, from);
  const a = (await from.boundingBox())!;
  await page.mouse.move(a.x + Math.min(a.width / 2, 120), a.y + a.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(600);
  // Past the slop towards the target; sideways while its direction is still unknown, so a row near
  // an edge doesn't start the list scrolling the wrong way.
  const x = a.x + Math.min(a.width / 2, 120);
  const dy = typeof up === 'function' ? 0 : up ? -12 : 12;
  await page.mouse.move(x + (dy === 0 ? 12 : 0), a.y + a.height / 2 + dy, { steps: 4 });
  if (typeof up === 'function') up = await up();
  const list = await listArea(page);
  const top = list.top + 12;
  const bottom = list.bottom;
  let lastY: number | undefined;
  for (let i = 0; i < 80; i++) {
    const box = await to.boundingBox({ timeout: 200 }).catch(() => null);
    if (box && box.y > top + 60 && box.y + box.height < bottom - 60) break;
    // On screen and no longer moving: the list is at its end (a target at the very top or bottom
    // never leaves the edge zone). On screen from the start: nothing to scroll.
    if (box && box.y >= list.top && box.y + box.height <= bottom && (i === 0 || box.y === lastY)) break;
    lastY = box?.y;
    await page.mouse.move(a.x + 40, up ? top + 4 : bottom - 4, { steps: 2 });
    await page.waitForTimeout(100);
  }
  // Out of the edge zone first, so the list stops scrolling before the target is measured.
  await page.mouse.move(a.x + 40, (top + bottom) / 2, { steps: 2 });
  await page.waitForTimeout(250);
  const box = (await to.boundingBox())!;
  const point = at(box);
  await page.mouse.move(point.x, point.y, { steps: 15 });
  await page.waitForTimeout(150);
  await beforeDrop?.();
  await page.mouse.up();
}

/** Where [store] is relative to [item]'s section: true when above it. */
async function storeIsAbove(page: Page, item: string, store: string): Promise<boolean> {
  let sections: string[] = [];
  await expect.poll(async () => (sections = (await outline(page)).map((s) => s.store)).includes(store),
    { message: `${store} shows as a drop target` }).toBe(true);
  const from = await storeOf(page, item);
  return sections.indexOf(store) < sections.indexOf(from ?? '');
}

/**
 * Long-press drag of an item row onto a store's divider (folded or not). An empty store shows only
 * during the drag, so where it is gets asked then.
 */
export async function dragItemToStore(page: Page, item: string, store: string): Promise<void> {
  await holdAndDrop(page, itemRow(page, item), storeDivider(page, store), (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 }), {
    up: () => storeIsAbove(page, item, store),
  });
}

/** Opens a store's menu with a right click on its divider, then its layout screen. */
export async function openStoreLayout(page: Page, store: string): Promise<void> {
  await storeDivider(page, store).click({ button: 'right' });
  await page.getByRole('button', { name: 'Reihenfolge bearbeiten' }).click();
  await expect(page.getByText(`${store}: Reihenfolge`)).toBeVisible();
}

export async function deleteItem(page: Page, item: string): Promise<void> {
  await openEdit(page, item);
  await editSheet(page).getByRole('button', { name: 'Löschen' }).click();
  await expect(itemRow(page, item)).toHaveCount(0);
}
