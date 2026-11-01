// A household's free Hummlist Premium from RevenueCat promotional grants (docs/PURCHASES.md,
// "Free premium: RevenueCat promotional grants"). The grant itself is made in RevenueCat (its
// dashboard, Customer → Entitlements → Grant); the purchases function stores it on RevenueCat's
// webhook. This reads RevenueCat's state, and on --apply asks the function to store it now
// (POST /purchases/revenuecat/reconcile), e.g. for a household granted before the webhook knew
// promotional grants, or after a missed delivery.
//
//   deno run --allow-env --allow-net scripts/iap/promotional.ts status --household <uuid>
//   ... promotional.ts reconcile --household <uuid> [--apply]
//
// Dry run by default. Needs REVENUECAT_SECRET_KEY and REVENUECAT_PROJECT_ID (API v2, read), and for
// --apply REVENUECAT_DELETIONS_SECRET (the function's Ops secret, sent as x-deletions-secret) and
// SUPABASE_PROJECT_REF (default: the hosted project) or PURCHASES_URL (the local stack's
// http://127.0.0.1:54321/functions/v1/purchases). Prints no key, secret or token.
import {
  fetchPromotional,
  type PromotionalPremium,
} from '../../supabase/functions/purchases/promotional.ts';

export type Command = { action: 'status' | 'reconcile'; household: string; apply: boolean };

const usage = 'usage: promotional.ts status --household <uuid> | ' +
  'reconcile --household <uuid> [--apply]';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function parseArgs(args: string[]): Command {
  const [action, ...rest] = args;
  if (action !== 'status' && action !== 'reconcile') throw new Error(usage);
  let household: string | null = null;
  let apply = false;
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--apply' && action === 'reconcile') apply = true;
    else if (rest[i] === '--household' && rest[i + 1] !== undefined) household = rest[++i];
    else throw new Error(usage);
  }
  household = household?.toLowerCase() ?? null;
  if (!household || !uuid.test(household)) throw new Error('--household: a household id (uuid)');
  return { action, household, apply };
}

export function describe(p: PromotionalPremium): string {
  if (!p.active) return 'no promotional premium at RevenueCat';
  return p.expiresAt
    ? `promotional premium at RevenueCat until ${p.expiresAt.toISOString()}`
    : 'promotional premium at RevenueCat, without end';
}

/** The function's reconcile route for [env]. */
export function reconcileUrl(env: (k: string) => string | undefined): string {
  const local = env('PURCHASES_URL');
  if (local) return `${local.replace(/\/+$/, '')}/revenuecat/reconcile`;
  const ref = env('SUPABASE_PROJECT_REF') ?? 'jdwqrallbpdbshrdhenk';
  if (!/^[a-z0-9]{20}$/.test(ref)) throw new Error('SUPABASE_PROJECT_REF: a project ref');
  return `https://${ref}.supabase.co/functions/v1/purchases/revenuecat/reconcile` +
    '?forceFunctionRegion=eu-central-1';
}

function required(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`set ${name}`);
  return v;
}

if (import.meta.main) {
  try {
    const command = parseArgs(Deno.args);
    const key = {
      secretKey: required('REVENUECAT_SECRET_KEY'),
      projectId: required('REVENUECAT_PROJECT_ID'),
    };
    const now = await fetchPromotional(key, command.household, fetch, new Date());
    console.log(describe(now));
    if (command.action === 'reconcile') {
      if (!command.apply) {
        console.log('dry run: --apply asks the purchases function to store this');
      } else {
        const res = await fetch(reconcileUrl((k) => Deno.env.get(k)), {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-deletions-secret': required('REVENUECAT_DELETIONS_SECRET'),
          },
          body: JSON.stringify({ householdId: command.household }),
        });
        const body = await res.text();
        console.log(`purchases function: HTTP ${res.status} ${body.slice(0, 200)}`);
        if (res.status !== 200) Deno.exit(1);
      }
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    Deno.exit(1);
  }
}
