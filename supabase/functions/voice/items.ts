import type { Tx } from '../_shared/db.ts';
import type { Added } from './handler.ts';
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
