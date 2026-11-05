import type { Tx } from '../_shared/db.ts';
import type { Added, SplitItem } from './handler.ts';
import type { ParsedItem } from './parse.ts';

/**
 * Adds the items through `add_item` (the parser, classifier, learned memory, store memory,
 * duplicate check) in one transaction. The splitter already read each amount, so the spoken
 * quantity goes in as the explicit one; brand and properties come from the parser. A new item
 * whose spelling variant or synonym is already open ("Karotten" with "Möhren") is still added
 * and names it in `similarOnList` (`public.similar_items`, job 32b); nothing is merged.
 */
export async function addItems(tx: Tx, householdId: string, items: ParsedItem[]): Promise<Added[]> {
  const active = await tx<{ id: string }[]>`
    select id from public.items where household_id = ${householdId} and status = 'active'`;
  const known = new Set(active.map((row) => row.id));
  const added: (Added & { id: string })[] = [];
  for (const item of items) {
    const [row] = await tx<
      {
        id: string;
        name: string;
        brand: string | null;
        properties: string | null;
        quantity: string | null;
        category: string;
      }[]
    >`
      select a.id, a.name, a.brand, a.properties, a.quantity, c.name as category
      from public.add_item(${householdId}, ${item.name}, p_quantity => ${item.quantity}) a
      join public.categories c on c.id = a.category_id`;
    // "Gurke und zwei Gurken" fold into one row; it is reported once.
    if (!row || added.some((a) => a.id === row.id)) continue;
    const alreadyOnList = known.has(row.id);
    const similar = alreadyOnList ? [] : await tx<{ name: string }[]>`
      select name from public.similar_items(${row.id})`;
    added.push({ ...row, alreadyOnList, similarOnList: similar.map((s) => s.name) });
  }
  return added.map(({ id: _, ...rest }) => rest);
}

/**
 * Splits brand, details and store off each item through `parse_item`, the parser `add_item` and
 * the app's typed add use: "Windeln Pampers Größe 3" is Windeln, Pampers, Größe 3, at dm. The
 * spoken quantity wins, as in `addItems`.
 */
export async function splitItems(
  tx: Tx,
  householdId: string,
  items: ParsedItem[],
): Promise<SplitItem[]> {
  const split: SplitItem[] = [];
  for (const item of items) {
    const [row] = await tx<SplitItem[]>`
      select name, brand, properties, quantity, store_id as "storeId"
      from public.parse_item(${householdId}, ${item.name})`;
    // A line parse_item reads no name from stays as heard, never dropped.
    split.push(
      row?.name
        ? { ...row, quantity: item.quantity ?? row.quantity }
        : { ...item, brand: null, properties: null, storeId: null },
    );
  }
  return split;
}
