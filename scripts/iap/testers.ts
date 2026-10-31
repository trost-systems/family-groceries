// The Lead's list of Hummlist Lifetime testers (public.lifetime_testers, docs/PURCHASES.md
// "Testers"). Each tester has a number of free unlocks (grants, 1 by default). A grant unlocks a
// household the tester is in that has no Lifetime yet, at once or when they next create or join
// one, and then stays with that household like a purchase.
//
//   deno run --allow-env --allow-net --allow-read scripts/iap/testers.ts list
//   ... testers.ts add --email a@b.de [--grants 2] [--note "TestFlight"] [--apply]
//   ... testers.ts set-grants --email a@b.de --grants 3 [--apply]
//   ... testers.ts remove --email a@b.de [--apply]
//
// Dry run by default: add, set-grants and remove only say what they would change. Removing a
// tester or lowering the count never takes back an unlock already given. The e-mail is resolved to
// the user id at run time and never stored. Hosted: SUPABASE_ACCESS_TOKEN (Management API) and
// SUPABASE_PROJECT_REF (default: the hosted project). With SUPABASE_DB_URL it talks to that
// database instead (the local stack). Prints no key, token or URL.
import { managementApi } from '../../supabase/deploy/migrate.ts';

export type Query = (sql: string) => Promise<unknown[]>;

export type Command =
  | { action: 'list' }
  | { action: 'add'; email: string; grants: number; note: string | null; apply: boolean }
  | { action: 'set-grants'; email: string; grants: number; apply: boolean }
  | { action: 'remove'; email: string; apply: boolean };

const usage = 'usage: testers.ts list | add --email <e> [--grants <n>] [--note <n>] [--apply] | ' +
  'set-grants --email <e> --grants <n> [--apply] | remove --email <e> [--apply]';

// One address, nothing a literal could break out of (quotes, backslashes, dollar signs, spaces).
const emailPattern = /^[^\s'"\\$;@]+@[^\s'"\\$;@]+\.[^\s'"\\$;@]+$/;

/** lifetime_testers.grants' check. */
const maxGrants = 100;

function parseGrants(value: string | true | undefined, required: boolean): number {
  if (value === undefined && !required) return 1;
  const n = typeof value === 'string' && /^\d{1,3}$/.test(value) ? Number(value) : NaN;
  if (!(n >= 0 && n <= maxGrants)) throw new Error(`--grants: a number from 0 to ${maxGrants}`);
  return n;
}

export function parseArgs(args: string[]): Command {
  const [action, ...rest] = args;
  const flags = new Map<string, string | true>();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    if (!flag.startsWith('--')) throw new Error(usage);
    const value = rest[i + 1];
    if (flag === '--apply') flags.set('apply', true);
    else if (value === undefined || value.startsWith('--')) {
      throw new Error(`${flag} needs a value`);
    } else flags.set(flag.slice(2), rest[++i]);
  }
  for (const key of flags.keys()) {
    if (!['email', 'note', 'grants', 'apply'].includes(key)) {
      throw new Error(`unknown flag --${key}`);
    }
  }
  if (action === 'list') return { action };
  if (action !== 'add' && action !== 'remove' && action !== 'set-grants') throw new Error(usage);
  const email = flags.get('email');
  if (typeof email !== 'string' || !emailPattern.test(email)) {
    throw new Error('--email <address> is required');
  }
  const apply = flags.get('apply') === true;
  if (action === 'remove') return { action, email, apply };
  if (action === 'set-grants') {
    return { action, email, grants: parseGrants(flags.get('grants'), true), apply };
  }
  const note = flags.get('note');
  if (typeof note === 'string' && note.length > 200) {
    throw new Error('--note: at most 200 characters');
  }
  return {
    action,
    email,
    grants: parseGrants(flags.get('grants'), false),
    note: typeof note === 'string' ? note : null,
    apply,
  };
}

/** A Postgres string literal (standard_conforming_strings is on). */
export const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;

interface Tester {
  user_id: string;
  grants: number;
  used: number | string;
  note: string | null;
  added_at: string | Date;
}

const usedGrants = (user: string) =>
  `(select count(*) from public.entitlements e where e.source = 'tester' and e.tester = ${user})`;

async function userId(query: Query, email: string): Promise<string | null> {
  const rows = await query(
    `select id from auth.users where lower(email) = lower(${literal(email)})`,
  ) as { id: string }[];
  return rows[0]?.id ?? null;
}

/** Runs [command]; returns the lines to print. */
export async function run(query: Query, command: Command): Promise<string[]> {
  if (command.action === 'list') {
    const rows = await query(
      `select t.user_id, t.grants, ${usedGrants('t.user_id')} as used, t.note, t.added_at
       from public.lifetime_testers t
       order by t.added_at`,
    ) as Tester[];
    if (rows.length === 0) return ['no testers'];
    return rows.map((r) =>
      `${r.user_id}  added ${new Date(r.added_at).toISOString()}  grants ${r.grants}, used ${
        Number(r.used)
      }${r.note ? `  (${r.note})` : ''}`
    );
  }
  const id = await userId(query, command.email);
  if (!id) return [`no account with that e-mail; nothing changed`];
  const user = `${literal(id)}::uuid`;
  const [listed] = await query(
    `select t.grants, ${usedGrants(user)} as used from public.lifetime_testers t
     where t.user_id = ${user}`,
  ) as { grants: number; used: number | string }[];
  const dry = command.apply ? '' : 'dry run, would ';
  const suffix = command.apply ? '' : ' (add --apply to do it)';
  if (command.action === 'add') {
    if (listed) return [`${id} is a tester already (grants ${listed.grants}); nothing changed`];
    if (command.apply) {
      const note = command.note === null ? 'null' : literal(command.note);
      await query(
        `insert into public.lifetime_testers (user_id, grants, note)
         values (${user}, ${command.grants}, ${note})
         on conflict (user_id) do nothing`,
      );
    }
    return [`${dry}add ${id} with ${command.grants} grant(s)${suffix}`];
  }
  if (!listed) return [`${id} is not a tester; nothing changed`];
  const used = Number(listed.used);
  if (command.action === 'set-grants') {
    if (command.apply) {
      await query(
        `update public.lifetime_testers set grants = ${command.grants} where user_id = ${user}`,
      );
    }
    const kept = used > command.grants ? `; the ${used} unlock(s) already given stay` : '';
    return [`${dry}set ${id} from ${listed.grants} to ${command.grants} grant(s)${kept}${suffix}`];
  }
  if (command.apply) {
    await query(`delete from public.lifetime_testers where user_id = ${user}`);
  }
  return [`${dry}remove ${id}; the ${used} unlock(s) already given stay${suffix}`];
}

async function directQuery(url: string): Promise<{ query: Query; end: () => Promise<void> }> {
  const { default: postgres } = await import('npm:postgres@3.4.9');
  const sql = postgres(url, { max: 1, prepare: false });
  return {
    query: (text) => sql.unsafe(text) as unknown as Promise<unknown[]>,
    end: () => sql.end(),
  };
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
  try {
    for (const line of await run(db.query, command)) console.log(line);
  } finally {
    await db.end();
  }
}
