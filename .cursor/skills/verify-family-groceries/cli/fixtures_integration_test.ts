/**
 * Seed -> check -> RLS across runs -> teardown -> leftover check, through the
 * real CLI against a running local stack. Runs only with FG_INTEGRATION=1
 * (CI's database job sets it, with FG_STACK_WORKDIR pointing at the repo's stack):
 *   FG_INTEGRATION=1 deno test -A fixtures_integration_test.ts
 */

import { assert, assertEquals } from '@std/assert';
import { main, realShell } from './fg.ts';

const repo = new URL('../../../../', import.meta.url).pathname.replace(/\/$/, '');
const env = Deno.env.toObject();

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

// The CLI's JSON has a different shape per command; the assertions below read it field by field.
async function fg(...argv: string[]): Promise<{ code: number; doc: Json }> {
  let out = '';
  const code = await main(argv, realShell, env, repo, { out: (t) => (out += t), err: () => {} });
  return { code, doc: JSON.parse(out) };
}

/** The value at a path of object keys and array indexes, undefined where the path leaves the document. */
function at(doc: Json | undefined, ...path: (string | number)[]): Json | undefined {
  let v = doc;
  for (const key of path) {
    if (Array.isArray(v) && typeof key === 'number') v = v[key];
    else if (typeof v === 'object' && v !== null && !Array.isArray(v) && typeof key === 'string') v = v[key];
    else return undefined;
  }
  return v;
}

function str(v: Json | undefined): string {
  if (typeof v !== 'string') throw new Error(`expected a string, got ${JSON.stringify(v)}`);
  return v;
}

function num(v: Json | undefined): number {
  if (typeof v !== 'number') throw new Error(`expected a number, got ${JSON.stringify(v)}`);
  return v;
}

function list(v: Json | undefined): Json[] {
  if (!Array.isArray(v)) throw new Error(`expected a list, got ${JSON.stringify(v)}`);
  return v;
}

function obj(v: Json | undefined): { [key: string]: Json } {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error(`expected an object, got ${JSON.stringify(v)}`);
  return v;
}

const zero = (leftovers: Json | undefined) => Object.entries(obj(leftovers)).filter(([, n]) => n !== 0);

Deno.test({
  name: 'two scenario runs seed, check out, cannot see each other, and tear down to zero rows',
  ignore: env.FG_INTEGRATION !== '1',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const mid = await fg('seed', 'household-3-mid-shop');
    assertEquals(mid.code, 0, JSON.stringify(at(mid.doc, 'error')));
    const heavy = await fg('seed', 'heavy-history');
    assertEquals(heavy.code, 0, JSON.stringify(at(heavy.doc, 'error')));
    const runs = [str(at(mid.doc, 'run')), str(at(heavy.doc, 'run'))];
    try {
      assert(
        at(mid.doc, 'checks', 'ok') && num(at(mid.doc, 'checks', 'passed')) >= 10,
        'counts, members, RLS checks of household-3-mid-shop',
      );
      assert(at(heavy.doc, 'checks', 'ok'), 'heavy-history usuals and due items via suggest_items');
      assertEquals(Object.keys(obj(at(mid.doc, 'members'))).sort(), ['ida', 'mia', 'noah']);
      assert(!JSON.stringify([mid.doc, heavy.doc]).match(/password/i), 'no password in the seed output');

      const midHome = str(at(mid.doc, 'households', 'home', 'id'));
      const heavyHome = str(at(heavy.doc, 'households', 'home', 'id'));
      const count = async (as: string, household: string) => {
        const r = await fg('db', 'query', `select count(*)::int as n from items where household_id = '${household}'`, '--as', as);
        assertEquals(r.code, 0, JSON.stringify(at(r.doc, 'error')));
        return num(at(r.doc, 'rows', 0, 'n'));
      };
      assertEquals(await count(`${runs[0]}:mia`, heavyHome), 0, 'a member of run X sees nothing of run Y');
      assertEquals(await count(`${runs[1]}:jo`, midHome), 0, 'and the other way round');
      assert((await count(`${runs[0]}:mia`, midHome)) > 0, 'but sees her own list');
      assert((await count(`${runs[1]}:jo`, heavyHome)) > 0);

      const listed = await fg('runs');
      for (const r of runs) assert(list(at(listed.doc, 'runs')).some((x) => at(x, 'run') === r), `fg runs lists ${r}`);
    } finally {
      for (const r of runs) {
        const down = await fg('teardown', r);
        assertEquals(down.code, 0, JSON.stringify(at(down.doc, 'error')));
        assertEquals(zero(at(down.doc, 'leftovers')), [], `no leftovers for ${r}`);
        const again = await fg('teardown', r);
        assertEquals(again.code, 0);
        assertEquals(at(again.doc, 'alreadyClean'), true, 'a second teardown is a no-op');
      }
    }
  },
});

Deno.test({
  name: 'a run whose manifest is lost is still found by its test email domain and torn down',
  ignore: env.FG_INTEGRATION !== '1',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const seeded = await fg('seed', 'pending-invite');
    assertEquals(seeded.code, 0, JSON.stringify(at(seeded.doc, 'error')));
    const run = str(at(seeded.doc, 'run'));
    assertEquals(list(at(seeded.doc, 'invites')).filter((i) => at(i, 'state') === 'open').length, 1);
    await Deno.remove(str(at(seeded.doc, 'credentials')));

    const listed = await fg('runs', '--stale', '--older-than', '0');
    const orphan = list(at(listed.doc, 'runs')).find((r) => at(r, 'run') === run);
    assertEquals(at(orphan, 'status'), 'orphaned');
    assertEquals(at(orphan, 'manifest'), false);

    const down = await fg('teardown', run);
    assertEquals(down.code, 0, JSON.stringify(at(down.doc, 'error')));
    assertEquals(at(down.doc, 'deleted'), { users: 2, households: 1 });
    assertEquals(zero(at(down.doc, 'leftovers')), []);
  },
});
