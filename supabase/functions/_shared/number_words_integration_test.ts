// Job 104: the server's number words are supabase/tests/number_words.tsv, as the app's
// parseEntry has them (app/test/list/entry_test.dart checks that side). The db gate sets
// FG_DB_TEST=1 and SUPABASE_DB_URL to the local stack; without FG_DB_TEST the test is skipped.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

Deno.test({
  name:
    'public.item_number_words, item_number_names and item_units are supabase/tests/number_words.tsv',
  ignore: !enabled,
  sanitizeResources: false,
  fn: async () => {
    const rows = (await Deno.readTextFile(new URL('../../tests/number_words.tsv', import.meta.url)))
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'))
      .map((line) => line.split('\t'));
    const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 1, prepare: false });
    try {
      const [{ words, names, units }] = await sql<
        { words: Record<string, number>; names: string[]; units: string }[]
      >`select public.item_number_words() as words, public.item_number_names() as names,
          public.item_units() as units`;
      assertEquals(
        Object.entries(words).sort(),
        rows.filter(([kind]) => kind === 'count').map(([, text, value]) => [text, Number(value)])
          .sort(),
      );
      assertEquals(names, rows.filter(([kind]) => kind === 'name').map(([, text]) => text));
      assertEquals(
        units.split('|'),
        rows.filter(([kind]) => kind === 'unit').map(([, text]) => text),
      );
    } finally {
      await sql.end();
    }
  },
});
