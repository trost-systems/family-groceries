import { assertEquals, assertThrows } from 'jsr:@std/assert@^1';
import { type Deps, parseArgs, run } from './beta_promo.ts';

const A = '0b6f2c1e-6d0a-4c39-9a51-2f7d1f6a3b01';
const B = '7e1d9c22-1b3f-4f6e-8c0a-5a9e2d4b7c02';
const NOW = new Date('2027-01-01T10:00:00Z');

/** The database and RevenueCat as the script sees them; every write and call recorded. */
function world(grants: { id: string; ends_at: string }[], switchOn = true) {
  const sent: string[] = [];
  const calls: string[] = [];
  const deps: Deps = {
    query: (sql) => {
      sent.push(sql.replace(/\s+/g, ' ').trim());
      if (sql.includes('beta_promo_backfill')) return Promise.resolve([{ n: 3 }]);
      if (sql.includes("app_switch('beta_promo') as on") && !sql.includes('count')) {
        return Promise.resolve([{ on: switchOn }]);
      }
      if (sql.includes('from public.beta_promo_grants') && sql.includes('order by queued_at')) {
        return Promise.resolve(grants);
      }
      return Promise.resolve([]);
    },
    grant: (h, at) => (calls.push(`grant ${h} ${at.toISOString()}`), Promise.resolve()),
    revoke: (h) => (calls.push(`revoke ${h}`), Promise.resolve()),
    reconcile: (h) => (calls.push(`reconcile ${h}`), Promise.resolve()),
    now: () => NOW,
  };
  const writes = () => sent.filter((s) => /beta_promo_(granted|ended)|backfill\(true\)/.test(s));
  return { deps, sent, calls, writes };
}

Deno.test('backfill is a dry run until --apply, and says whether anything will be granted', async () => {
  const w = world([], false);
  assertEquals(await run(w.deps, parseArgs(['backfill'])), [
    'dry run, would queue 3 household(s) (add --apply to do it)',
    'beta_promo is off: nothing is granted until the Lead turns it on',
  ]);
  assertEquals(w.sent[0], 'select public.beta_promo_backfill(false) as n');
  await run(w.deps, parseArgs(['backfill', '--apply']));
  assertEquals(w.sent.includes('select public.beta_promo_backfill(true) as n'), true);
  assertEquals(w.calls, [], 'the backfill itself sends nothing to RevenueCat');
});

Deno.test('set-end refuses an end less than 28 days away (the N-55 notice)', async () => {
  const w = world([{ id: A, ends_at: '2027-12-31T23:00:00Z' }]);
  const lines = await run(
    w.deps,
    parseArgs(['set-end', '--ends-at', '2027-01-20T00:00:00+01:00', '--apply']),
  );
  assertEquals(lines[0].startsWith('refused: the end must be at least 28 days away'), true);
  assertEquals(w.calls, []);
});

Deno.test('set-end moves each running grant: revoke, grant the new end, reconcile, record', async () => {
  const w = world([
    { id: A, ends_at: '2027-12-31T23:00:00Z' },
    { id: B, ends_at: '2027-03-01T00:00:00Z' },
  ]);
  assertEquals(
    (await run(w.deps, parseArgs(['set-end', '--ends-at', '2027-03-01T01:00:00+01:00'])))[0],
    'dry run, would move 1 beta grant(s) to end 2027-03-01T00:00:00.000Z (add --apply to do it)',
  );
  assertEquals(w.calls, []);
  await run(w.deps, parseArgs(['set-end', '--ends-at', '2027-03-01T01:00:00+01:00', '--apply']));
  assertEquals(w.calls, [
    `revoke ${A}`,
    `grant ${A} 2027-03-01T00:00:00.000Z`,
    `reconcile ${A}`,
  ]);
  assertEquals(w.writes(), [
    `select public.beta_promo_granted('${A}'::uuid, '2027-03-01T00:00:00.000Z'::timestamptz)`,
  ]);
});

Deno.test('revoke waits until every grant reached its end, then ends them all', async () => {
  const early = world([{ id: A, ends_at: '2027-12-31T23:00:00Z' }]);
  assertEquals(
    (await run(early.deps, parseArgs(['revoke', '--apply'])))[0].startsWith(
      'refused: 1 beta grant',
    ),
    true,
  );
  assertEquals(early.calls, []);
  const due = world([{ id: A, ends_at: '2026-12-31T23:00:00Z' }]);
  assertEquals(await run(due.deps, parseArgs(['revoke', '--apply'])), ['revoke 1 beta grant(s)']);
  assertEquals(due.calls, [`revoke ${A}`, `reconcile ${A}`]);
  assertEquals(due.writes(), [`select public.beta_promo_ended('${A}'::uuid, now(), false)`]);
});

Deno.test('an objection ends one household for good and queues its deletion', async () => {
  const w = world([]);
  await run(w.deps, parseArgs(['object', '--household', A]));
  assertEquals(w.calls, [], 'dry run');
  await run(w.deps, parseArgs(['object', '--household', A.toUpperCase(), '--apply']));
  assertEquals(w.calls, [`revoke ${A}`, `reconcile ${A}`]);
  assertEquals(w.writes(), [`select public.beta_promo_ended('${A}'::uuid, now(), true)`]);
});

Deno.test('arguments', () => {
  assertThrows(() => parseArgs(['object', '--household', "x'; drop table households; --"]));
  assertThrows(() => parseArgs(['set-end', '--ends-at', '2027-03-01']));
  assertThrows(() => parseArgs(['set-end']));
  assertThrows(() => parseArgs(['revoke', '--household', A]));
  assertThrows(() => parseArgs(['grant']));
  assertEquals(parseArgs(['status']), { action: 'status' });
});
