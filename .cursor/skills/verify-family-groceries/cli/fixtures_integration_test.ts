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

// The CLI's JSON has a different shape per command; the assertions below read it field by field.
// deno-lint-ignore no-explicit-any
async function fg(...argv: string[]): Promise<{ code: number; doc: Record<string, any> }> {
  let out = '';
  const code = await main(argv, realShell, env, repo, { out: (t) => (out += t), err: () => {} });
  return { code, doc: JSON.parse(out) };
}

const zero = (leftovers: Record<string, number>) => Object.entries(leftovers).filter(([, n]) => n !== 0);

Deno.test({
  name: 'two scenario runs seed, check out, cannot see each other, and tear down to zero rows',
  ignore: env.FG_INTEGRATION !== '1',
  sanitizeResources: false,
  sanitizeOps: false,
  async fn() {
    const mid = await fg('seed', 'household-3-mid-shop');
    assertEquals(mid.code, 0, JSON.stringify(mid.doc.error));
    const heavy = await fg('seed', 'heavy-history');
    assertEquals(heavy.code, 0, JSON.stringify(heavy.doc.error));
    const runs = [mid.doc.run as string, heavy.doc.run as string];
    try {
      assert(mid.doc.checks.ok && mid.doc.checks.passed >= 10, 'counts, members, RLS checks of household-3-mid-shop');
      assert(heavy.doc.checks.ok, 'heavy-history usuals and due items via suggest_items');
      assertEquals(Object.keys(mid.doc.members).sort(), ['ida', 'mia', 'noah']);
      assert(!JSON.stringify([mid.doc, heavy.doc]).match(/password/i), 'no password in the seed output');

      const midHome = mid.doc.households.home.id;
      const heavyHome = heavy.doc.households.home.id;
      const count = async (as: string, household: string) => {
        const r = await fg('db', 'query', `select count(*)::int as n from items where household_id = '${household}'`, '--as', as);
        assertEquals(r.code, 0, JSON.stringify(r.doc.error));
        return r.doc.rows[0].n as number;
      };
      assertEquals(await count(`${runs[0]}:mia`, heavyHome), 0, 'a member of run X sees nothing of run Y');
      assertEquals(await count(`${runs[1]}:jo`, midHome), 0, 'and the other way round');
      assert((await count(`${runs[0]}:mia`, midHome)) > 0, 'but sees her own list');
      assert((await count(`${runs[1]}:jo`, heavyHome)) > 0);

      const listed = await fg('runs');
      for (const r of runs) assert(listed.doc.runs.some((x: { run: string }) => x.run === r), `fg runs lists ${r}`);
    } finally {
      for (const r of runs) {
        const down = await fg('teardown', r);
        assertEquals(down.code, 0, JSON.stringify(down.doc.error));
        assertEquals(zero(down.doc.leftovers), [], `no leftovers for ${r}`);
        const again = await fg('teardown', r);
        assertEquals(again.code, 0);
        assertEquals(again.doc.alreadyClean, true, 'a second teardown is a no-op');
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
    assertEquals(seeded.code, 0, JSON.stringify(seeded.doc.error));
    const run = seeded.doc.run as string;
    assertEquals(seeded.doc.invites.filter((i: { state: string }) => i.state === 'open').length, 1);
    await Deno.remove(seeded.doc.credentials);

    const listed = await fg('runs', '--stale', '--older-than', '0');
    const orphan = listed.doc.runs.find((r: { run: string }) => r.run === run);
    assertEquals(orphan?.status, 'orphaned');
    assertEquals(orphan?.manifest, false);

    const down = await fg('teardown', run);
    assertEquals(down.code, 0, JSON.stringify(down.doc.error));
    assertEquals(down.doc.deleted, { users: 2, households: 1 });
    assertEquals(zero(down.doc.leftovers), []);
  },
});
