// The free beta unlock of Hummlist Premium (job 43b; docs/PURCHASES.md "Free premium in the beta").
// The purchases function grants it to queued households while the server switch beta_promo is on;
// this script is the Lead's side:
//
//   deno run --allow-env --allow-net --allow-read scripts/iap/beta_promo.ts status
//   ... beta_promo.ts backfill [--apply]          queue the households created before the switch
//   ... beta_promo.ts set-end --ends-at <ISO> [--apply]   move every beta grant's end (launch)
//   ... beta_promo.ts revoke [--apply]            end every beta grant, once its end has come
//   ... beta_promo.ts object --household <uuid> [--apply]   a household objected (support)
//
// Dry run unless --apply. backfill --apply only on the Lead's OK (ADDENDUM 7). set-end refuses an
// end less than 28 days away and revoke refuses while a grant has not reached its end: the N-55
// notice needs those 4 weeks (Legal Review). An objection ends the household's free unlock at once,
// for good, and queues its RevenueCat customer for deletion (unless it bought something).
// Database: SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (Management API) or SUPABASE_DB_URL (local).
// RevenueCat (set-end, revoke, object): REVENUECAT_SECRET_KEY, REVENUECAT_PROJECT_ID; the reconcile
// afterwards: REVENUECAT_DELETIONS_SECRET and PURCHASES_URL or SUPABASE_PROJECT_REF. Prints no key.
import { managementApi } from '../../supabase/deploy/migrate.ts';
import type { RevenueCatKey } from '../../supabase/functions/purchases/deletions.ts';
import {
  grantEntitlement,
  revokeGrantedEntitlement,
} from '../../supabase/functions/purchases/grants.ts';
import { reconcileUrl } from './promotional.ts';

export type Query = (sql: string) => Promise<unknown[]>;

export type Command =
  | { action: 'status' }
  | { action: 'backfill'; apply: boolean }
  | { action: 'set-end'; endsAt: Date; apply: boolean }
  | { action: 'revoke'; apply: boolean }
  | { action: 'object'; household: string; apply: boolean };

/** The N-55 notice shows from 28 days before the end. */
export const noticeDays = 28;

const usage = 'usage: beta_promo.ts status | backfill [--apply] | ' +
  'set-end --ends-at <ISO 8601> [--apply] | revoke [--apply] | object --household <uuid> [--apply]';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseArgs(args: string[]): Command {
  const [action, ...rest] = args;
  let apply = false;
  let household: string | null = null;
  let endsAt: Date | null = null;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--apply' && action !== 'status') apply = true;
    else if (rest[i] === '--household' && action === 'object' && rest[i + 1] !== undefined) {
      household = rest[++i].toLowerCase();
    } else if (rest[i] === '--ends-at' && action === 'set-end' && rest[i + 1] !== undefined) {
      const raw = rest[++i];
      // A full timestamp with its offset: the end is a moment, not a day in some zone.
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(Z|[+-]\d{2}:\d{2})$/.test(raw)) {
        throw new Error('--ends-at: e.g. 2027-03-01T00:00:00+01:00');
      }
      endsAt = new Date(raw);
    } else throw new Error(usage);
  }
  switch (action) {
    case 'status':
      return { action };
    case 'backfill':
    case 'revoke':
      return { action, apply };
    case 'set-end':
      if (!endsAt || Number.isNaN(endsAt.getTime())) throw new Error('--ends-at is required');
      return { action, endsAt, apply };
    case 'object':
      if (!household || !uuid.test(household)) {
        throw new Error('--household: a household id (uuid)');
      }
      return { action, household, apply };
    default:
      throw new Error(usage);
  }
}

export interface Deps {
  query: Query;
  /** Only set-end, revoke and object call these. */
  grant(householdId: string, endsAt: Date): Promise<void>;
  revoke(householdId: string): Promise<void>;
  reconcile(householdId: string): Promise<void>;
  now(): Date;
}

interface Granted {
  id: string;
  ends_at: string | Date;
}

const iso = (d: Date) => `'${d.toISOString()}'::timestamptz`;
const id = (h: string) => {
  if (!uuid.test(h)) throw new Error('not a household id');
  return `'${h}'::uuid`;
};

async function running(query: Query): Promise<Granted[]> {
  return await query(
    `select beta_household::text as id, ends_at from public.beta_promo_grants
     where granted_at is not null and ended_at is null order by queued_at`,
  ) as Granted[];
}

/** Runs [command]; returns the lines to print. */
export async function run(deps: Deps, command: Command): Promise<string[]> {
  const { query } = deps;
  const dry = 'apply' in command && !command.apply ? 'dry run, would ' : '';
  const suffix = 'apply' in command && !command.apply ? ' (add --apply to do it)' : '';
  switch (command.action) {
    case 'status': {
      const [s] = await query(
        `select public.app_switch('beta_promo') as on,
                count(*) filter (where granted_at is null and skipped is null and ended_at is null) as queued,
                count(*) filter (where granted_at is not null and ended_at is null) as running,
                count(*) filter (where skipped is not null) as skipped,
                count(*) filter (where ended_at is not null) as ended,
                count(*) filter (where objected_at is not null) as objected,
                min(ends_at) filter (where granted_at is not null and ended_at is null) as first_end
         from public.beta_promo_grants`,
      ) as Record<string, unknown>[];
      return [
        `beta_promo is ${s.on ? 'on' : 'off'}`,
        `queued ${Number(s.queued)}, granted ${Number(s.running)}, skipped (testers) ${
          Number(s.skipped)
        }, ended ${Number(s.ended)} (objected ${Number(s.objected)})`,
        ...(s.first_end ? [`earliest end ${new Date(s.first_end as string).toISOString()}`] : []),
      ];
    }
    case 'backfill': {
      const [r] = await query(`select public.beta_promo_backfill(${command.apply}) as n`) as {
        n: number;
      }[];
      const [s] = await query(`select public.app_switch('beta_promo') as on`) as { on: boolean }[];
      return [
        `${dry}queue ${Number(r.n)} household(s)${suffix}`,
        s.on
          ? 'the function grants queued households on its next run'
          : 'beta_promo is off: nothing is granted until the Lead turns it on',
      ];
    }
    case 'set-end': {
      const earliest = new Date(deps.now().getTime() + noticeDays * 86_400_000);
      if (command.endsAt < earliest) {
        return [
          `refused: the end must be at least ${noticeDays} days away (${earliest.toISOString()}), ` +
          'so the N-55 notice runs 4 weeks before it',
        ];
      }
      const moving = (await running(query)).filter((g) =>
        new Date(g.ends_at).getTime() !== command.endsAt.getTime()
      );
      if (command.apply) {
        for (const g of moving) {
          // RevenueCat never shortens a grant: revoke, then grant the new end.
          await deps.revoke(g.id);
          await deps.grant(g.id, command.endsAt);
          await deps.reconcile(g.id);
          await query(`select public.beta_promo_granted(${id(g.id)}, ${iso(command.endsAt)})`);
        }
      }
      return [
        `${dry}move ${moving.length} beta grant(s) to end ${command.endsAt.toISOString()}${suffix}`,
        'set the function secret BETA_PROMO_ENDS_AT to the same moment, for households to come',
      ];
    }
    case 'revoke': {
      const grants = await running(query);
      const early = grants.filter((g) => new Date(g.ends_at) > deps.now());
      if (early.length > 0) {
        return [
          `refused: ${early.length} beta grant(s) have not reached their end; ` +
          'move the end with set-end (28 days ahead, for the N-55 notice) and revoke after it',
        ];
      }
      if (command.apply) {
        for (const g of grants) {
          await deps.revoke(g.id);
          await deps.reconcile(g.id);
          await query(`select public.beta_promo_ended(${id(g.id)}, now(), false)`);
        }
      }
      return [`${dry}revoke ${grants.length} beta grant(s)${suffix}`];
    }
    case 'object': {
      if (command.apply) {
        await deps.revoke(command.household);
        await deps.reconcile(command.household);
        await query(`select public.beta_promo_ended(${id(command.household)}, now(), true)`);
      }
      return [
        `${dry}end the free unlock of ${command.household} for good and queue its RevenueCat ` +
        `customer for deletion (unless it bought something)${suffix}`,
      ];
    }
  }
}

async function directQuery(url: string): Promise<{ query: Query; end: () => Promise<void> }> {
  const { default: postgres } = await import('npm:postgres@3.4.9');
  const sql = postgres(url, { max: 1, prepare: false });
  return {
    query: (text) => sql.unsafe(text) as unknown as Promise<unknown[]>,
    end: () => sql.end(),
  };
}

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`set ${name}`);
  return v;
}

if (import.meta.main) {
  let command: Command;
  try {
    command = parseArgs(Deno.args);
  } catch (e) {
    console.error((e as Error).message);
    Deno.exit(2);
  }
  const dbUrl = Deno.env.get('SUPABASE_DB_URL');
  const token = Deno.env.get('SUPABASE_ACCESS_TOKEN');
  if (!dbUrl && !token) {
    console.error('set SUPABASE_ACCESS_TOKEN (hosted) or SUPABASE_DB_URL (local stack)');
    Deno.exit(2);
  }
  const db = dbUrl ? await directQuery(dbUrl) : {
    query: managementApi(Deno.env.get('SUPABASE_PROJECT_REF') ?? 'jdwqrallbpdbshrdhenk', token!),
    end: () => Promise.resolve(),
  };
  const key = (): RevenueCatKey => ({
    secretKey: required('REVENUECAT_SECRET_KEY'),
    projectId: required('REVENUECAT_PROJECT_ID'),
  });
  const deps: Deps = {
    query: db.query,
    grant: (h, endsAt) => grantEntitlement(key(), h, endsAt, fetch),
    revoke: (h) => revokeGrantedEntitlement(key(), h, fetch),
    reconcile: async (h) => {
      const res = await fetch(reconcileUrl((k) => Deno.env.get(k)), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-deletions-secret': required('REVENUECAT_DELETIONS_SECRET'),
        },
        body: JSON.stringify({ householdId: h }),
      });
      await res.body?.cancel();
      if (res.status !== 200) throw new Error(`reconcile: HTTP ${res.status}`);
    },
    now: () => new Date(),
  };
  try {
    for (const line of await run(deps, command)) console.log(line);
  } catch (e) {
    console.error((e as Error).message);
    Deno.exit(1);
  } finally {
    await db.end();
  }
}
