import type { Tx } from '../_shared/db.ts';
import type { Added } from './handler.ts';
import type { ParsedItem } from './parse.ts';

/**
 * Adds the items through `add_item` (the parser, classifier, learned memory, store memory,
 * duplicate check) in one transaction. The splitter already read each amount, so the spoken
 * quantity goes in as the explicit one; brand and properties come from the parser.
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
    added.push({ ...row, alreadyOnList: known.has(row.id) });
  }
  return added.map(({ id: _, ...rest }) => rest);
}
