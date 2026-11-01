/**
 * Scenario fixtures: seed a scenario as a run, check it, list runs, tear runs down.
 *
 * Every record a run creates is attributable to it three ways: the email
 * `<handle>.<run>@fg-test.invalid`, auth app_metadata.fg_run, and the run
 * manifest of created ids. Teardown deletes the run's users and the
 * households only they belong to, and nothing else.
 */

import { type Ctx, FgError, type JsonObject, stopIf } from './core.ts';
import { expectedCounts, type Plan, plan, type PlannedHousehold, type PlannedItem, type Scenario, SEEDED_CATEGORIES } from './scenario.ts';
import { Api, type Target } from './target.ts';

export const TEST_DOMAIN = 'fg-test.invalid';
export const STALE_HOURS = 24;

/** Scenario fields from later schema versions and the items column each needs (job 15). */
export const ITEM_EXTENSION_COLUMNS = { brand: 'brand', properties: 'properties', walkOrder: 'sort_key' } as const;

export interface Member {
  handle: string;
  id: string;
  email: string;
  password: string;
  name: string;
  locale: 'de' | 'en';
  household: string | null;
}

export interface Manifest {
  version: 1;
  run: string;
  scenario: string;
  target: Target['kind'];
  apiUrl: string;
  createdAt: string;
  status: 'seeding' | 'ready' | 'failed';
  users: Record<string, Member>;
  households: Record<string, { id: string; name: string; members: string[] }>;
  invites: { household: string; code: string; state: 'open' | 'expired' | 'revoked' }[];
  views: Record<string, { store?: string }>;
  /** Every id the run created, by kind. */
  created: { users: string[]; households: string[]; stores: string[]; categories: string[]; items: string[]; invites: string[] };
  /** Hosted only: rows outside test households before seeding, to prove they were untouched. */
  nonTestCounts?: Record<string, number>;
}

export const emailFor = (handle: string, run: string) => `${handle}.${run}@${TEST_DOMAIN}`;
const isTestEmail = (email: string) => email.endsWith(`@${TEST_DOMAIN}`);
/** The run an email belongs to, or null for a non-test address. */
export const runOfEmail = (email: string) => (isTestEmail(email) ? (/^[a-z0-9]+\.(.+)@/.exec(email)?.[1] ?? null) : null);

const RUN_ID = /^[a-z0-9][a-z0-9-]{2,40}$/;

export function newFixtureRunId(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');
  return `fx-${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}-${rand}`;
}

export function checkRunId(run: string): string {
  if (!RUN_ID.test(run)) {
    throw new FgError(
      'usage',
      `"${run}" is not a run id.`,
      'Run ids are 3-41 lowercase letters, digits and dashes, e.g. fx-1025-1432-k3x9. `fg runs` lists them.',
      64,
    );
  }
  return run;
}

function password(): string {
  return btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18)))).replace(/[+/=]/g, 'x');
}

// Manifest files -------------------------------------------------------------

const manifestPath = (t: Target, run: string) => `${t.runsDir}/${run}.json`;

export async function readManifest(ctx: Ctx, t: Target, run: string): Promise<Manifest | null> {
  const path = manifestPath(t, run);
  return (await ctx.sh.exists(path)) ? JSON.parse(await ctx.sh.readText(path)) as Manifest : null;
}

/** Writes the manifest readable only by this user: it holds the seeded passwords. */
async function writeManifest(ctx: Ctx, t: Target, m: Manifest): Promise<void> {
  await ctx.sh.mkdir(t.runsDir);
  await ctx.sh.run(['chmod', '700', t.runsDir]);
  const path = manifestPath(t, m.run);
  await ctx.sh.writeText(path, JSON.stringify(m, null, 2), { mode: 0o600 });
  await ctx.sh.run(['chmod', '600', path]);
}

export async function listManifests(ctx: Ctx, t: Target): Promise<Manifest[]> {
  if (!(await ctx.sh.exists(t.runsDir))) return [];
  const res = await ctx.sh.run(['find', t.runsDir, '-maxdepth', '1', '-name', '*.json', '-printf', '%f\n']);
  const out: Manifest[] = [];
  for (const f of res.stdout.split('\n').filter(Boolean).sort()) {
    try {
      out.push(JSON.parse(await ctx.sh.readText(`${t.runsDir}/${f}`)));
    } catch { /* a half-written manifest: its users are found by email */ }
  }
  return out;
}

/** The run that a bare handle (`--as mia`) refers to: the last one seeded on this target. */
export const currentRunPath = (t: Target) => `${t.runsDir}/current`;

// Seeding --------------------------------------------------------------------

/** What the seed prints: no passwords, no tokens. */
export function publicView(m: Manifest) {
  return {
    run: m.run,
    scenario: m.scenario,
    target: m.target,
    createdAt: m.createdAt,
    members: Object.fromEntries(
      Object.values(m.users).map((
        u,
      ) => [u.handle, { ref: `${m.run}:${u.handle}`, email: u.email, name: u.name, locale: u.locale, household: u.household }]),
    ),
    households: Object.fromEntries(Object.entries(m.households).map(([h, x]) => [h, { id: x.id, name: x.name, members: x.members }])),
    invites: m.invites,
    views: m.views,
  };
}

const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
const inList = (ids: string[]) => `in.(${ids.join(',')})`;

/** Fails before anything is created when the scenario needs columns this database lacks. */
async function checkColumns(api: Api, p: Plan): Promise<void> {
  const used = new Set(p.households.flatMap((h) => [...h.items, ...h.trips.flatMap((t) => t.items)]).flatMap((i) => Object.keys(i.extra)));
  for (const field of used) {
    const column = ITEM_EXTENSION_COLUMNS[field as keyof typeof ITEM_EXTENSION_COLUMNS];
    try {
      await api.rest(`items?select=${column}&limit=0`);
    } catch {
      throw new FgError(
        'needs_column',
        `Scenario "${p.name}" sets ${field}, which needs items.${column}; this database does not have that column yet.`,
        'That column arrives with job 15 (design H schema). Remove the field from the scenario, or seed against a database that has it.',
      );
    }
  }
}

export interface SeedResult {
  manifest: Manifest;
  checks: Check[];
}

/**
 * Creates the scenario as run `run` on the target. The manifest is written
 * before the first record and after every step, so a crash leaves a run that
 * `fg teardown` can still remove.
 */
export async function seedScenario(
  ctx: Ctx,
  t: Target,
  s: Scenario,
  run: string,
  now = new Date(),
  signal?: AbortSignal,
): Promise<SeedResult> {
  // Seeding requests end at once on a stop; teardown (its own Api, without the signal) still runs after.
  const api = new Api(ctx.sh, t, signal);
  const p = plan(s, now);
  await checkColumns(api, p);
  const m: Manifest = {
    version: 1,
    run,
    scenario: s.name,
    target: t.kind,
    apiUrl: t.apiUrl,
    createdAt: now.toISOString(),
    status: 'seeding',
    users: {},
    households: {},
    invites: [],
    views: p.views,
    created: { users: [], households: [], stores: [], categories: [], items: [], invites: [] },
  };
  if (t.kind === 'hosted') m.nonTestCounts = await nonTestCounts(api);
  await writeManifest(ctx, t, m);
  const save = () => writeManifest(ctx, t, m);
  try {
    return await seedInto(api, m, p, save, signal);
  } catch (e) {
    m.status = 'failed';
    await save();
    throw e;
  }
}

async function seedInto(api: Api, m: Manifest, p: Plan, save: () => Promise<void>, signal?: AbortSignal): Promise<SeedResult> {
  const { run, scenario } = m;

  const tokens: Record<string, string> = {};
  for (const u of p.users) {
    stopIf(signal, 'Seeding');
    const email = emailFor(u.handle, run);
    const pw = password();
    const created = (await api.call('/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { display_name: u.name, locale: u.locale },
        app_metadata: { fg_run: run, fg_scenario: scenario },
      }),
    })) as JsonObject;
    const home = p.households.find((h) => h.members.includes(u.handle))?.handle ?? null;
    m.users[u.handle] = {
      handle: u.handle,
      id: created.id as string,
      email,
      password: pw,
      name: u.name,
      locale: u.locale,
      household: home,
    };
    m.created.users.push(created.id as string);
    await save();
  }
  await Promise.all(p.users.map(async (u) => {
    tokens[u.handle] = (await api.signIn(m.users[u.handle].email, m.users[u.handle].password)).token;
  }));

  for (const h of p.households) {
    stopIf(signal, 'Seeding');
    await seedHousehold(api, m, h, tokens, save, signal);
  }
  m.status = 'ready';
  await save();
  const checks = await verifyRun(api, m, p, tokens);
  return { manifest: m, checks };
}

async function seedHousehold(
  api: Api,
  m: Manifest,
  h: PlannedHousehold,
  tokens: Record<string, string>,
  save: () => Promise<void>,
  signal?: AbortSignal,
): Promise<void> {
  const owner = h.members[0];
  const ownerToken = tokens[owner];
  // The app's own path: create_household seeds the categories; the household has no store yet.
  const household = (await api.rpc('create_household', { p_name: h.name }, ownerToken)) as JsonObject;
  const hid = household.id as string;
  m.households[h.handle] = { id: hid, name: h.name, members: h.members };
  m.created.households.push(hid);
  await save();
  if (h.members.length > 1) {
    await api.rest('household_members', {
      method: 'POST',
      body: JSON.stringify(h.members.slice(1).map((handle) => ({ household_id: hid, user_id: m.users[handle].id, role: 'member' }))),
    });
  }

  const categories = new Map<string, string>();
  const loadCategories = async () => {
    categories.clear();
    const rows = (await api.rest(`categories?select=id,name,sort_order&household_id=eq.${hid}&order=sort_order,name`)) as JsonObject[];
    for (const r of rows) categories.set(r.name as string, r.id as string);
    return rows;
  };
  const seeded = await loadCategories();
  const missing = SEEDED_CATEGORIES.filter((c) => !categories.has(c));
  if (missing.length || seeded.length !== SEEDED_CATEGORIES.length) {
    throw new FgError(
      'seed_drift',
      `create_household no longer seeds what cli/scenario.ts expects: missing ${
        missing.map((c) => `category "${c}"`).join(', ') || `(${seeded.length} categories)`
      }.`,
      'Update SEEDED_CATEGORIES in cli/scenario.ts to match seed_household in supabase/migrations.',
    );
  }

  for (const name of h.addCategories) {
    const row = (await api.rpc('create_category', { p_household: hid, p_name: name }, ownerToken)) as JsonObject;
    m.created.categories.push(row.id as string);
  }
  const route = (await loadCategories()).map((r) => r.name as string);
  if (h.categoryOrder.length) {
    const order = [...h.categoryOrder, ...route.filter((c) => !h.categoryOrder.includes(c))];
    await api.rpc('reorder_categories', { p_household: hid, p_ids: order.map((c) => categories.get(c)!) }, ownerToken);
    route.splice(0, route.length, ...order);
  }

  // As the app adds one (store picker, Mehr → Läden): after the last store, with a layout.
  const stores = new Map<string, string>();
  for (const st of h.stores) {
    const id = (await api.rpc('add_store', { p_household: hid, p_name: st.name }, ownerToken)) as string;
    stores.set(st.name, id);
    m.created.stores.push(id);
    if (!st.layout.length && !st.hidden.length) continue;
    const order = [...st.layout, ...route.filter((c) => !st.layout.includes(c))];
    await api.rpc('set_store_layout', {
      p_store: id,
      p_categories: order.map((c) => categories.get(c)!),
      p_hidden: st.hidden.map((c) => categories.get(c)!),
    }, ownerToken);
  }
  await save();

  const row = (i: PlannedItem, store: string | null) => {
    const r: JsonObject = {
      id: crypto.randomUUID(),
      household_id: hid,
      name: i.name,
      quantity: i.quantity,
      created_at: i.at.toISOString(),
    };
    const s = store ?? i.store;
    // Null lets the insert trigger classify and apply item→store memory, as for the app.
    r.store_id = s ? stores.get(s)! : null;
    r.category_id = i.category ? categories.get(i.category)! : null;
    for (const [field, value] of Object.entries(i.extra)) r[ITEM_EXTENSION_COLUMNS[field as keyof typeof ITEM_EXTENSION_COLUMNS]] = value;
    return r;
  };
  /** Inserts as each adder (added_by and the event actor come from their session), then dates the 'added' events. */
  const insertAs = async (items: PlannedItem[], store: string | null): Promise<string[]> => {
    const ids: string[] = [];
    const byAdder = Map.groupBy(items, (i) => i.by);
    for (const [by, group] of byAdder) {
      // PostgREST takes a bulk insert only when every object has the same keys.
      const raw = group.map((i) => row(i, store));
      const keys = [...new Set(raw.flatMap((r) => Object.keys(r)))];
      const rows = raw.map((r) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null])) as JsonObject);
      for (const part of chunk(rows, 200)) {
        await api.rest('items', { method: 'POST', token: tokens[by], body: JSON.stringify(part), headers: { prefer: 'return=minimal' } });
      }
      rows.forEach((r) => ids.push(r.id as string));
      m.created.items.push(...rows.map((r) => r.id as string));
      for (const [at, dated] of Map.groupBy(rows, (r) => r.created_at as string)) {
        await api.rest(`item_events?action=eq.added&item_id=${inList(dated.map((r) => r.id as string))}`, {
          method: 'PATCH',
          body: JSON.stringify({ created_at: at }),
          headers: { prefer: 'return=minimal' },
        });
      }
    }
    return ids;
  };

  // Trips oldest first, each through the real triggers: insert, tick as the shopper (events,
  // item→store memory), then date the tick. Memories keep the replay's order, so the latest wins.
  for (const trip of h.trips) {
    stopIf(signal, 'Seeding');
    const ids = await insertAs(trip.items, trip.store);
    await api.rest(`items?id=${inList(ids)}`, {
      method: 'PATCH',
      token: tokens[trip.by],
      body: JSON.stringify({ status: 'bought' }),
      headers: { prefer: 'return=minimal' },
    });
    const at = trip.at.toISOString();
    await api.rest(`items?id=${inList(ids)}`, {
      method: 'PATCH',
      body: JSON.stringify({ bought_at: at }),
      headers: { prefer: 'return=minimal' },
    });
    await api.rest(`item_events?action=eq.bought&item_id=${inList(ids)}`, {
      method: 'PATCH',
      body: JSON.stringify({ created_at: at }),
      headers: { prefer: 'return=minimal' },
    });
  }
  await save();
  stopIf(signal, 'Seeding');
  await insertAs(h.items, null);
  await save();

  for (const inv of h.invites) {
    stopIf(signal, 'Seeding');
    const created = (await api.rpc('create_invite', { p_household: hid }, tokens[inv.by])) as JsonObject;
    m.created.invites.push(created.id as string);
    const patch: JsonObject = {};
    if (inv.expiresAt) patch.expires_at = inv.expiresAt.toISOString();
    if (inv.revoked) patch.revoked_at = new Date().toISOString();
    if (Object.keys(patch).length) {
      await api.rest(`invites?id=eq.${created.id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
        headers: { prefer: 'return=minimal' },
      });
    }
    m.invites.push({
      household: h.handle,
      code: created.code as string,
      state: inv.revoked ? 'revoked' : inv.expiresAt && inv.expiresAt <= new Date() ? 'expired' : 'open',
    });
  }
  await save();
}

// Checks ---------------------------------------------------------------------

export interface Check {
  name: string;
  ok: boolean;
  expected: unknown;
  actual: unknown;
}

const rows = (x: unknown) => x as JsonObject[];

/**
 * Checks the seeded state as the members see it, through RLS: counts per
 * household, users without one, suggest_items for usuals and due items, and
 * that a member sees no row of any other household.
 */
export async function verifyRun(api: Api, m: Manifest, p: Plan, tokens: Record<string, string>): Promise<Check[]> {
  const checks: Check[] = [];
  const check = (name: string, expected: unknown, actual: unknown, ok = JSON.stringify(expected) === JSON.stringify(actual)) =>
    checks.push({ name, ok, expected, actual });
  const counts = expectedCounts(p);
  for (const h of p.households) {
    const hid = m.households[h.handle].id;
    const token = tokens[h.members[0]];
    const want = counts.households[h.handle];
    const n = async (path: string) => rows(await api.rest(path, { token })).length;
    check(`${h.handle}: members`, want.members, await n(`household_members?select=user_id&household_id=eq.${hid}`));
    check(`${h.handle}: active items`, want.activeItems, await n(`items?select=id&household_id=eq.${hid}&status=eq.active`));
    check(`${h.handle}: bought items`, want.boughtItems, await n(`items?select=id&household_id=eq.${hid}&status=eq.bought`));
    check(`${h.handle}: stores`, want.stores, await n(`stores?select=id&household_id=eq.${hid}`));
    check(`${h.handle}: categories`, want.categories, await n(`categories?select=id&household_id=eq.${hid}`));
    check(
      `${h.handle}: open invites`,
      want.openInvites,
      await n(`invites?select=id&household_id=eq.${hid}&revoked_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`),
    );
    for (const member of h.members) {
      const foreign = rows(await api.rest(`items?select=household_id&household_id=neq.${hid}&limit=1`, { token: tokens[member] })).length +
        rows(await api.rest(`households?select=id&id=neq.${hid}&limit=1`, { token: tokens[member] })).length;
      check(`${h.handle}: ${member} sees no other household (RLS)`, 0, foreign);
    }
    const wanted = [...(p.expect.usuals[h.handle] ?? []), ...(p.expect.due[h.handle] ?? []), ...(p.expect.notDue[h.handle] ?? [])];
    if (wanted.length) {
      const suggestions = rows(await api.rpc('suggest_items', { p_household: hid, p_prefix: '', p_limit: 200 }, token));
      const byName = new Map(suggestions.map((r) => [r.name as string, r.due as boolean]));
      const usuals = p.expect.usuals[h.handle] ?? [];
      check(`${h.handle}: usuals`, usuals, usuals.filter((x) => byName.has(x)));
      const due = p.expect.due[h.handle] ?? [];
      check(`${h.handle}: due`, due, due.filter((x) => byName.get(x) === true));
      const notDue = p.expect.notDue[h.handle] ?? [];
      check(`${h.handle}: suggested, not due`, notDue, notDue.filter((x) => byName.get(x) === false));
    }
  }
  for (const u of p.users.filter((u) => !p.households.some((h) => h.members.includes(u.handle)))) {
    check(
      `${u.handle}: in no household`,
      0,
      rows(await api.rest('household_members?select=household_id', { token: tokens[u.handle] })).length,
    );
  }
  return checks;
}

// Finding runs ---------------------------------------------------------------

export interface RunInfo {
  run: string;
  scenario: string | null;
  createdAt: string;
  ageHours: number;
  stale: boolean;
  status: Manifest['status'] | 'orphaned';
  manifest: boolean;
  users: number;
}

/** Runs on the target: manifests, plus test users whose manifest is gone (found by the test email domain). */
export async function findRuns(ctx: Ctx, api: Api | null, t: Target, staleHours = STALE_HOURS, now = new Date()): Promise<RunInfo[]> {
  const byRun = new Map<string, RunInfo>();
  const info = (run: string, createdAt: string, rest: Partial<RunInfo>): RunInfo => {
    const ageHours = Math.round(((now.getTime() - new Date(createdAt).getTime()) / 3_600_000) * 10) / 10;
    return {
      run,
      scenario: null,
      createdAt,
      ageHours,
      stale: ageHours >= staleHours,
      status: 'orphaned',
      manifest: false,
      users: 0,
      ...rest,
    };
  };
  for (const m of await listManifests(ctx, t)) {
    byRun.set(
      m.run,
      info(m.run, m.createdAt, { scenario: m.scenario, status: m.status, manifest: true, users: Object.keys(m.users).length }),
    );
  }
  if (api) {
    for (const u of await api.users()) {
      const run = (u.app_metadata.fg_run as string | undefined) ?? runOfEmail(u.email);
      // A run id becomes a file name and a filter value: only well-formed ones.
      if (!run || !isTestEmail(u.email) || !RUN_ID.test(run)) continue;
      const known = byRun.get(run);
      if (known) {
        if (!known.manifest) known.users++;
        continue;
      }
      byRun.set(run, info(run, u.created_at, { scenario: (u.app_metadata.fg_scenario as string | undefined) ?? null, users: 1 }));
    }
  }
  return [...byRun.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

// Teardown -------------------------------------------------------------------

type AuthUser = { id: string; email: string; app_metadata: JsonObject };

/** The run's users: test-domain accounts tagged with the run, addressed to it, or listed in its manifest. */
export function runUserIds(run: string, m: Manifest | null, users: AuthUser[]): string[] {
  return users.filter((u) =>
    isTestEmail(u.email) &&
    ((u.app_metadata.fg_run as string | undefined) === run || runOfEmail(u.email) === run || (m?.created.users.includes(u.id) ?? false))
  ).map((u) => u.id);
}

/** A household goes only when every member is one of the run's users; any other member keeps it. */
export function splitHouseholds(userIds: string[], membersOf: Map<string, string[]>): { deletable: string[]; kept: string[] } {
  const deletable: string[] = [];
  const kept: string[] = [];
  for (const [hid, members] of membersOf) (members.every((id) => userIds.includes(id)) ? deletable : kept).push(hid);
  return { deletable, kept };
}

export interface TeardownResult {
  run: string;
  alreadyClean: boolean;
  deleted: { users: number; households: number };
  /** Households a run user belonged to that also had other members; left alone. */
  keptHouseholds: string[];
  leftovers: Record<string, number>;
  nonTestCountsUnchanged?: boolean;
}

/**
 * Deletes exactly what run created: its users (by id from the manifest and by
 * email/app_metadata) and the households whose members are all its users.
 * Idempotent: a second call finds nothing and returns alreadyClean. Ends with
 * a leftover check that fails unless every count is zero.
 */
export async function teardownRun(ctx: Ctx, t: Target, run: string): Promise<TeardownResult> {
  const api = new Api(ctx.sh, t);
  const m = await readManifest(ctx, t, run);
  const all = await api.users();
  const outsider = all.find((u) => m?.created.users.includes(u.id) && !isTestEmail(u.email));
  if (outsider) {
    throw new FgError(
      'refused',
      `Run ${run}'s manifest names a user outside @${TEST_DOMAIN}; teardown deletes test accounts only.`,
      'The manifest was edited by hand; fix or delete it.',
    );
  }
  const userIds = runUserIds(run, m, all);
  const memberships = userIds.length ? rows(await api.rest(`household_members?select=household_id&user_id=${inList(userIds)}`)) : [];
  const householdIds = [...new Set([...(m?.created.households ?? []), ...memberships.map((r) => r.household_id as string)])];
  const membersOf = new Map<string, string[]>();
  for (const hid of householdIds) {
    membersOf.set(hid, rows(await api.rest(`household_members?select=user_id&household_id=eq.${hid}`)).map((r) => r.user_id as string));
  }
  const { deletable, kept } = splitHouseholds(userIds, membersOf);
  const alreadyClean = !m && userIds.length === 0 && householdIds.length === 0;
  if (ctx.dryRun) {
    if (alreadyClean) ctx.actions.push(`nothing to delete: run ${run} has no users or households on the ${t.label}`);
    else {
      ctx.actions.push(
        `delete ${userIds.length} test users of run ${run} on the ${t.label}`,
        `delete ${deletable.length} households only they belong to`,
      );
    }
    if (kept.length) ctx.actions.push(`leave ${kept.length} households with other members (only the run's users leave them)`);
    return { run, alreadyClean, deleted: { users: userIds.length, households: deletable.length }, keptHouseholds: kept, leftovers: {} };
  }
  // delete_account is the app's own path. It locks each household row, deletes the household
  // with its last member and hands ownership on otherwise, so a non-test user who joined in the
  // meantime keeps the household. No bulk delete here: that would race exactly such a join.
  for (const id of userIds) await api.rpc('delete_account', { p_user: id });
  // A household the run created but no member is left in (e.g. emptied by hand) goes too.
  const empty: string[] = [];
  for (const hid of deletable) {
    if ((await api.count('households', `id=eq.${hid}`)) && !(await api.count('household_members', `household_id=eq.${hid}`))) {
      empty.push(hid);
    }
  }
  if (empty.length) await api.rest(`households?id=${inList(empty)}`, { method: 'DELETE', headers: { prefer: 'return=minimal' } });
  for (const hid of deletable) {
    if (await api.count('household_members', `household_id=eq.${hid}`)) kept.push(hid);
  }
  const leftovers = await leftoverCounts(api, run, householdIds.filter((h) => !kept.includes(h)), userIds);
  const result: TeardownResult = {
    run,
    alreadyClean,
    deleted: { users: userIds.length, households: deletable.filter((h) => !kept.includes(h)).length },
    keptHouseholds: kept,
    leftovers,
  };
  if (t.kind === 'hosted' && m?.nonTestCounts) {
    const after = await nonTestCounts(api);
    result.nonTestCountsUnchanged = Object.entries(m.nonTestCounts).every(([k, v]) => after[k] === v);
    (result as unknown as JsonObject).nonTestCounts = { before: m.nonTestCounts, after };
  }
  const dirty = Object.entries(leftovers).filter(([, n]) => n !== 0);
  if (dirty.length) {
    throw new FgError(
      'leftovers',
      `Teardown of ${run} left rows behind: ${dirty.map(([k, n]) => `${k}=${n}`).join(', ')}.`,
      `Rerun \`fg teardown ${run}\`; if it persists, a new table needs a cascade from households or auth.users.`,
      1,
      { leftovers },
    );
  }
  if (m) await ctx.sh.remove(manifestPath(t, run));
  const current = currentRunPath(t);
  if ((await ctx.sh.exists(current)) && (await ctx.sh.readText(current)).trim() === run) await ctx.sh.remove(current);
  return result;
}

/** Rows that could belong to the run; all must be zero after teardown. Counts only. */
export async function leftoverCounts(api: Api, run: string, householdIds: string[], userIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  out.auth_users =
    (await api.users()).filter((u) => (u.app_metadata.fg_run as string | undefined) === run || runOfEmail(u.email) === run).length;
  const byHousehold = [
    'households:id',
    'household_members',
    'items',
    'item_events',
    'invites',
    'categories',
    'stores',
    'store_category_order',
    'category_memory',
    'item_store_memory',
  ];
  for (const spec of byHousehold) {
    const [table, column = 'household_id'] = spec.split(':');
    out[table] = householdIds.length ? await api.count(table, `${column}=${inList(householdIds)}`) : 0;
  }
  const byUser: [string, string][] = [['profiles', 'id'], ['household_members', 'user_id'], ['personal_access_tokens', 'user_id'], [
    'item_events',
    'actor',
  ], [
    'items',
    'added_by',
  ]];
  for (const [table, column] of byUser) {
    const key = `${table}.${column}`;
    out[key] = userIds.length ? await api.count(table, `${column}=${inList(userIds)}`) : 0;
  }
  return out;
}

const COUNTED = ['households', 'household_members', 'items', 'item_events', 'invites', 'stores', 'categories'];

/**
 * Rows outside pure test households (every member in the test domain) and
 * users outside the test domain: counts only, never content. A real household
 * that a test user joined stays counted, so a change to it shows. Real users
 * may change rows during a run, so a difference is a hint to look, not proof.
 */
export async function nonTestCounts(api: Api): Promise<Record<string, number>> {
  const users = await api.users();
  const testIds = new Set(users.filter((u) => isTestEmail(u.email)).map((u) => u.id));
  const candidates = testIds.size
    ? [
      ...new Set(
        rows(await api.rest(`household_members?select=household_id&user_id=${inList([...testIds])}`)).map((r) => r.household_id as string),
      ),
    ]
    : [];
  const pureTest: string[] = [];
  for (const hid of candidates) {
    const members = rows(await api.rest(`household_members?select=user_id&household_id=eq.${hid}`)).map((r) => r.user_id as string);
    if (members.every((id) => testIds.has(id))) pureTest.push(hid);
  }
  const out: Record<string, number> = { auth_users: users.length - testIds.size };
  for (const table of COUNTED) {
    const column = table === 'households' ? 'id' : 'household_id';
    out[table] = await api.count(table, pureTest.length ? `${column}=not.${inList(pureTest)}` : '');
  }
  return out;
}
