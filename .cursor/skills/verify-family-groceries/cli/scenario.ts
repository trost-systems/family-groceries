/** Test scenarios: the YAML files in test/fixtures/scenarios, validated against the schema and resolved into a seeding plan. */

import { parse as parseYaml } from '@std/yaml';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { FgError, type Shell } from './core.ts';

export const SCENARIO_DIR = 'test/fixtures/scenarios';
export const SCHEMA_PATH = 'test/fixtures/scenario.schema.json';

/** The categories seed_household creates in every household (supabase/migrations); seeding checks the database still agrees. A household starts without stores. */
export const SEEDED_CATEGORIES = [
  'Obst & Gemüse',
  'Brot & Backwaren',
  'Kühlregal',
  'Fleisch/Wurst/Fisch',
  'Vorrat & Konserven',
  'Süßes & Snacks',
  'Getränke',
  'Tiefkühl',
  'Haushalt',
  '👶 Drogerie',
  'Sonstiges',
];
/** Baseline users of plain `fg seed`; a scenario handle may not shadow them. */
export const RESERVED_HANDLES = ['peter', 'lea'];

// The file as written (after schema validation).
type RawItem = string | {
  name: string;
  quantity?: string;
  store?: string;
  category?: string;
  by?: string;
  at?: string;
  brand?: string;
  properties?: string;
  walkOrder?: number;
};
interface RawScenario {
  name: string;
  summary: string;
  goodFor?: string[];
  users: { handle: string; name: string; locale?: 'de' | 'en' }[];
  households?: {
    handle?: string;
    name: string;
    members: string[];
    categories?: { add?: string[]; order?: string[] };
    stores?: { name: string; layout?: string[]; hidden?: string[] }[];
    items?: RawItem[];
    history?: { at: string; by?: string; store?: string; every?: string; times?: number; items: RawItem[] }[];
    invites?: { by?: string; expires?: string; revoked?: boolean }[];
  }[];
  views?: Record<string, { store?: string }>;
  expect?: { usuals?: Record<string, string[]>; due?: Record<string, string[]>; notDue?: Record<string, string[]> };
}

/** A validated scenario; times are still relative, so one scenario seeds the same state on any day. */
export type Scenario = RawScenario & { file: string };

export interface PlannedItem {
  name: string;
  quantity: string | null;
  store: string | null;
  category: string | null;
  by: string;
  at: Date;
  /** Columns from later schema versions, set only when the scenario names them. */
  extra: { brand?: string; properties?: string; walkOrder?: number };
}

export interface PlannedTrip {
  at: Date;
  by: string;
  store: string | null;
  items: PlannedItem[];
}

export interface PlannedHousehold {
  handle: string;
  name: string;
  members: string[];
  addCategories: string[];
  categoryOrder: string[];
  stores: { name: string; layout: string[]; hidden: string[] }[];
  items: PlannedItem[];
  /** Oldest first: replaying them in order keeps "latest wins" memories right. */
  trips: PlannedTrip[];
  invites: { by: string; expiresAt: Date | null; revoked: boolean }[];
}

export interface Plan {
  name: string;
  users: { handle: string; name: string; locale: 'de' | 'en' }[];
  households: PlannedHousehold[];
  views: Record<string, { store?: string }>;
  expect: { usuals: Record<string, string[]>; due: Record<string, string[]>; notDue: Record<string, string[]> };
}

let validator: ((data: unknown) => boolean) & { errors?: AjvError[] | null } | null = null;
type AjvError = { instancePath: string; keyword: string; message?: string; params: Record<string, unknown> };

async function schemaValidator(sh: Shell, repo: string) {
  if (validator) return validator;
  const schema = JSON.parse(await sh.readText(`${repo}/${SCHEMA_PATH}`));
  validator = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  return validator;
}

/** `/households/0/items/3/quantity` -> `households[0].items[3].quantity` */
const fieldPath = (pointer: string) =>
  pointer.split('/').slice(1).reduce((p, s) => (/^\d+$/.test(s) ? `${p}[${s}]` : p ? `${p}.${s}` : s), '');

/**
 * Ajv reports every failed branch of a oneOf; keep the errors that point at
 * the deepest field, and say which field is unknown or wrong.
 */
export function describeSchemaErrors(errors: AjvError[]): string[] {
  const useful = errors.filter((e) =>
    e.keyword !== 'oneOf' &&
    !(e.keyword === 'type' && e.params.type === 'string' &&
      errors.some((o) => o.instancePath === e.instancePath && o !== e && o.keyword !== 'oneOf'))
  );
  const depth = (e: AjvError) =>
    e.instancePath.split('/').length + (e.keyword === 'additionalProperties' || e.keyword === 'required' ? 1 : 0);
  const max = Math.max(...useful.map(depth));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of useful.filter((e) => depth(e) >= max - 1).sort((a, b) => depth(b) - depth(a))) {
    let path = fieldPath(e.instancePath) || '(top level)';
    let message = e.message ?? e.keyword;
    if (e.keyword === 'additionalProperties') {
      path = `${fieldPath(e.instancePath) ? `${fieldPath(e.instancePath)}.` : ''}${e.params.additionalProperty}`;
      message = 'unknown field';
    } else if (e.keyword === 'required') {
      path = `${fieldPath(e.instancePath) ? `${fieldPath(e.instancePath)}.` : ''}${e.params.missingProperty}`;
      message = 'is required';
    } else if (e.keyword === 'enum') {
      message = `must be one of ${(e.params.allowedValues as string[]).join(', ')}`;
    }
    const line = `${path}: ${message}`;
    if (!seen.has(line)) out.push(line);
    seen.add(line);
  }
  return out.slice(0, 5);
}

function bad(file: string, problems: string[]): FgError {
  return new FgError(
    'bad_scenario',
    `${file}: ${problems.join('; ')}`,
    `Fix the named field(s); the format is test/fixtures/scenario.schema.json, explained in docs/TEST_FIXTURES.md.`,
    64,
    { problems },
  );
}

/** Parses and validates one scenario file's text; every problem names its field. */
export async function parseScenario(sh: Shell, repo: string, file: string, text: string): Promise<Scenario> {
  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (e) {
    throw bad(file, [`not valid YAML: ${(e as Error).message.split('\n')[0]}`]);
  }
  const validate = await schemaValidator(sh, repo);
  if (!validate(data)) throw bad(file, describeSchemaErrors(validate.errors ?? []));
  const raw = data as RawScenario;
  const problems = semanticProblems(raw);
  const base = file.split('/').pop()!.replace(/\.ya?ml$/, '');
  if (raw.name !== base) problems.unshift(`name: "${raw.name}" must match the file name "${base}"`);
  if (problems.length) throw bad(file, problems.slice(0, 5));
  return { ...raw, file };
}

const itemName = (i: RawItem) => (typeof i === 'string' ? i : i.name);

/** Cross-references the schema cannot express: handles, store and category names, who may do what. */
export function semanticProblems(s: RawScenario): string[] {
  const problems: string[] = [];
  const handles = new Set<string>();
  s.users.forEach((u, i) => {
    if (RESERVED_HANDLES.includes(u.handle)) problems.push(`users[${i}].handle: "${u.handle}" is reserved for the baseline seed (fg seed)`);
    if (handles.has(u.handle)) problems.push(`users[${i}].handle: "${u.handle}" is used twice`);
    handles.add(u.handle);
  });
  const homeOf = new Map<string, number>();
  const householdHandles = new Set<string>();
  (s.households ?? []).forEach((h, hi) => {
    const at = `households[${hi}]`;
    const handle = h.handle ?? householdHandle(hi);
    if (householdHandles.has(handle)) problems.push(`${at}.handle: "${handle}" is used twice`);
    householdHandles.add(handle);
    h.members.forEach((m, mi) => {
      if (!handles.has(m)) problems.push(`${at}.members[${mi}]: no user "${m}"`);
      else if (homeOf.has(m)) {
        problems.push(`${at}.members[${mi}]: "${m}" is already in households[${homeOf.get(m)}] (one household per user)`);
      }
      homeOf.set(m, hi);
    });
    const member = (who: string | undefined, path: string) => {
      if (who !== undefined && !h.members.includes(who)) problems.push(`${path}: "${who}" is not a member of this household`);
    };
    const categories = [...SEEDED_CATEGORIES, ...(h.categories?.add ?? [])];
    const stores = (h.stores ?? []).map((x) => x.name);
    const category = (name: string | undefined, path: string) => {
      if (name !== undefined && !categories.includes(name)) {
        problems.push(`${path}: no category "${name}" (have: ${categories.join(', ')})`);
      }
    };
    const store = (name: string | undefined, path: string) => {
      if (name !== undefined && !stores.includes(name)) {
        problems.push(`${path}: no store "${name}" (have: ${stores.join(', ') || 'none'}; declare it in ${at}.stores)`);
      }
    };
    (h.categories?.add ?? []).forEach((c, ci) => {
      if (SEEDED_CATEGORIES.includes(c)) problems.push(`${at}.categories.add[${ci}]: "${c}" exists in every household already`);
    });
    (h.categories?.order ?? []).forEach((c, ci) => category(c, `${at}.categories.order[${ci}]`));
    (h.stores ?? []).forEach((st, si) => {
      // add_store returns the existing store for a name that differs only in case or spacing.
      const twin = stores.findIndex((x) => fold(x) === fold(st.name));
      if (twin < si) problems.push(`${at}.stores[${si}]: "${st.name}" is stores[${twin}] again`);
      (st.layout ?? []).forEach((c, ci) => category(c, `${at}.stores[${si}].layout[${ci}]`));
      (st.hidden ?? []).forEach((c, ci) => category(c, `${at}.stores[${si}].hidden[${ci}]`));
    });
    const checkItem = (item: RawItem, path: string) => {
      if (typeof item === 'string') return;
      member(item.by, `${path}.by`);
      store(item.store, `${path}.store`);
      category(item.category, `${path}.category`);
    };
    (h.items ?? []).forEach((item, ii) => checkItem(item, `${at}.items[${ii}]`));
    // The items insert trigger skips an open item that is already on the list (items_skip_duplicate).
    const open = new Map<string, number>();
    (h.items ?? []).forEach((item, ii) => {
      const key = openItemKey(item);
      if (open.has(key)) {
        problems.push(
          `${at}.items[${ii}]: the same open item as items[${open.get(key)}]; the list keeps one (give it other properties or drop it)`,
        );
      } else open.set(key, ii);
    });
    (h.history ?? []).forEach((t, ti) => {
      const path = `${at}.history[${ti}]`;
      member(t.by, `${path}.by`);
      store(t.store, `${path}.store`);
      if ((t.times ?? 1) > 1 && !t.every) problems.push(`${path}.every: needed when times > 1`);
      t.items.forEach((item, ii) => checkItem(item, `${path}.items[${ii}]`));
    });
    (h.invites ?? []).forEach((inv, ii) => member(inv.by, `${at}.invites[${ii}].by`));
  });
  for (const [user, view] of Object.entries(s.views ?? {})) {
    if (!handles.has(user)) problems.push(`views.${user}: no user "${user}"`);
    else if (view.store !== undefined) {
      const h = homeOf.has(user) ? s.households![homeOf.get(user)!] : undefined;
      if (!h) problems.push(`views.${user}.store: "${user}" is in no household`);
      else if (!(h.stores ?? []).some((x) => x.name === view.store)) {
        problems.push(`views.${user}.store: no store "${view.store}" in ${h.name}`);
      }
    }
  }
  for (const kind of ['usuals', 'due', 'notDue'] as const) {
    for (const [handle, names] of Object.entries(s.expect?.[kind] ?? {})) {
      const hi = (s.households ?? []).findIndex((h, i) => (h.handle ?? householdHandle(i)) === handle);
      if (hi < 0) {
        problems.push(`expect.${kind}.${handle}: no household "${handle}"`);
        continue;
      }
      const bought = new Set((s.households![hi].history ?? []).flatMap((t) => t.items.map(itemName)));
      names.forEach((n, ni) => {
        if (!bought.has(n)) problems.push(`expect.${kind}.${handle}[${ni}]: "${n}" is never bought in this household's history`);
      });
    }
  }
  return problems;
}

const householdHandle = (index: number) => (index === 0 ? 'home' : `home${index + 1}`);

export async function listScenarios(sh: Shell, repo: string): Promise<Scenario[]> {
  const res = await sh.run(['find', `${repo}/${SCENARIO_DIR}`, '-maxdepth', '1', '-name', '*.yaml', '-printf', '%f\n']);
  const files = res.stdout.split('\n').filter(Boolean).sort();
  const out: Scenario[] = [];
  for (const f of files) out.push(await parseScenario(sh, repo, `${SCENARIO_DIR}/${f}`, await sh.readText(`${repo}/${SCENARIO_DIR}/${f}`)));
  return out;
}

export async function loadScenario(sh: Shell, repo: string, name: string): Promise<Scenario> {
  if (name.includes('/') || name.endsWith('.yaml')) {
    const path = name.startsWith('/') ? name : `${Deno.cwd()}/${name}`;
    if (!(await sh.exists(path))) {
      throw new FgError('unknown_scenario', `No scenario file ${name}.`, '`fg scenario list` shows the shipped ones.', 64);
    }
    return await parseScenario(sh, repo, name, await sh.readText(path));
  }
  const file = `${SCENARIO_DIR}/${name}.yaml`;
  if (!(await sh.exists(`${repo}/${file}`))) {
    const names = (await sh.run(['find', `${repo}/${SCENARIO_DIR}`, '-maxdepth', '1', '-name', '*.yaml', '-printf', '%f '])).stdout
      .replaceAll('.yaml', '').trim();
    throw new FgError(
      'unknown_scenario',
      `No scenario "${name}".`,
      `Shipped scenarios: ${names}. \`fg scenario list\` describes them.`,
      64,
    );
  }
  return await parseScenario(sh, repo, file, await sh.readText(`${repo}/${file}`));
}

// Time ----------------------------------------------------------------------

const TZ = 'Europe/Berlin';

/** Minutes east of UTC that Berlin is at this instant (60 or 120). */
function berlinOffsetMinutes(at: Date): number {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' }).formatToParts(at)
    .find((p) => p.type === 'timeZoneName')!.value; // "GMT+02:00"
  const m = /GMT([+-])(\d\d):(\d\d)/.exec(name);
  return m ? (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3])) : 0;
}

/** The Berlin calendar day of an instant. */
function berlinDay(at: Date): { y: number; m: number; d: number } {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
    .split('-').map(Number);
  return { y, m, d };
}

/** Berlin wall-clock time to an instant; DST-safe (the offset is read at the result, twice). */
export function berlinWallTime(y: number, m: number, d: number, hh: number, mm: number): Date {
  const naive = Date.UTC(y, m - 1, d, hh, mm);
  let at = new Date(naive - berlinOffsetMinutes(new Date(naive)) * 60_000);
  at = new Date(naive - berlinOffsetMinutes(at) * 60_000);
  return at;
}

const UNIT_MS = { m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** "now", "-90m", "-2h", "-3d" (exact offsets) or "-3d 18:10" (3 Berlin calendar days ago at 18:10). */
export function resolveTime(rel: string, now: Date): Date {
  if (rel === 'now') return now;
  const clock = /^-(\d+)d (\d\d):(\d\d)$/.exec(rel);
  if (clock) {
    const today = berlinDay(now);
    const day = new Date(Date.UTC(today.y, today.m - 1, today.d - Number(clock[1])));
    return berlinWallTime(day.getUTCFullYear(), day.getUTCMonth() + 1, day.getUTCDate(), Number(clock[2]), Number(clock[3]));
  }
  const offset = /^([+-])(\d+)([mhd])$/.exec(rel);
  if (!offset) throw new FgError('bad_scenario', `Unreadable time "${rel}".`, 'Use now, -90m, -2h, -3d or "-3d 18:10".', 64);
  const ms = Number(offset[2]) * UNIT_MS[offset[3] as keyof typeof UNIT_MS];
  return new Date(now.getTime() + (offset[1] === '-' ? -ms : ms));
}

/** Resolves a scenario against a moment: absolute times, defaults filled in, repeated trips expanded. */
export function plan(s: Scenario, now: Date): Plan {
  const households: PlannedHousehold[] = (s.households ?? []).map((h, hi) => {
    const owner = h.members[0];
    const listSize = (h.items ?? []).length;
    const items = (h.items ?? []).map((raw, i) =>
      // Default times keep the file's order: the first item is the oldest, a second apart.
      toItem(raw, owner, new Date(now.getTime() - (listSize - i) * 1000), now)
    );
    const trips: PlannedTrip[] = [];
    for (const t of h.history ?? []) {
      const newest = resolveTime(t.at, now);
      const step = t.every ? Number(t.every.slice(0, -1)) * UNIT_MS[t.every.slice(-1) as 'h' | 'd'] : 0;
      for (let k = 0; k < (t.times ?? 1); k++) {
        // Calendar days, not 24 h steps, so "-3d 18:10" every 7d stays at 18:10 across a DST change.
        const at = t.every?.endsWith('d') && /\d\d:\d\d$/.test(t.at)
          ? resolveTime(t.at.replace(/^-(\d+)d/, (_, n) => `-${Number(n) + k * Number(t.every!.slice(0, -1))}d`), now)
          : new Date(newest.getTime() - k * step);
        const by = t.by ?? owner;
        trips.push({
          at,
          by,
          store: t.store ?? null,
          items: t.items.map((raw) => toItem(raw, by, new Date(at.getTime() - UNIT_MS.d), now)),
        });
      }
    }
    trips.sort((a, b) => a.at.getTime() - b.at.getTime());
    return {
      handle: h.handle ?? householdHandle(hi),
      name: h.name,
      members: h.members,
      addCategories: h.categories?.add ?? [],
      categoryOrder: h.categories?.order ?? [],
      stores: (h.stores ?? []).map((st) => ({
        name: st.name,
        layout: st.layout ?? [],
        hidden: st.hidden ?? [],
      })),
      items,
      trips,
      invites: (h.invites ?? []).map((inv) => ({
        by: inv.by ?? owner,
        expiresAt: inv.expires ? resolveTime(inv.expires, now) : null,
        revoked: inv.revoked ?? false,
      })),
    };
  });
  return {
    name: s.name,
    users: s.users.map((u) => ({ handle: u.handle, name: u.name, locale: u.locale ?? 'de' })),
    households,
    views: s.views ?? {},
    expect: { usuals: s.expect?.usuals ?? {}, due: s.expect?.due ?? {}, notDue: s.expect?.notDue ?? {} },
  };
}

const fold = (s: string | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/** Approximates public.open_item_key: name, brand and the comma-separated details folded, in any order. */
function openItemKey(item: RawItem): string {
  const raw = typeof item === 'string' ? { name: item } : item;
  const details = (raw.properties ?? '').split(',').map(fold).filter(Boolean).sort();
  return [fold(raw.name), fold(raw.brand), details.join(',')].join('|');
}

function toItem(raw: RawItem, defaultBy: string, defaultAt: Date, now: Date): PlannedItem {
  if (typeof raw === 'string') return { name: raw, quantity: null, store: null, category: null, by: defaultBy, at: defaultAt, extra: {} };
  const extra: PlannedItem['extra'] = {};
  if (raw.brand !== undefined) extra.brand = raw.brand;
  if (raw.properties !== undefined) extra.properties = raw.properties;
  if (raw.walkOrder !== undefined) extra.walkOrder = raw.walkOrder;
  return {
    name: raw.name,
    quantity: raw.quantity ?? null,
    store: raw.store ?? null,
    category: raw.category ?? null,
    by: raw.by ?? defaultBy,
    at: raw.at ? resolveTime(raw.at, now) : defaultAt,
    extra,
  };
}

/** Row counts a seeded plan must produce; seeding checks them against the database. */
export function expectedCounts(p: Plan) {
  return {
    users: p.users.length,
    households: Object.fromEntries(p.households.map((h) => [h.handle, {
      members: h.members.length,
      activeItems: h.items.length,
      boughtItems: h.trips.reduce((n, t) => n + t.items.length, 0),
      stores: h.stores.length,
      categories: SEEDED_CATEGORIES.length + h.addCategories.length,
      openInvites: h.invites.filter((i) => !i.revoked && (i.expiresAt === null || i.expiresAt > new Date())).length,
    }])),
    withoutHousehold: p.users.filter((u) => !p.households.some((h) => h.members.includes(u.handle))).length,
  };
}
