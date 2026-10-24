// Migration and RLS guards (DECISIONS, Job 12). Run from the repository root:
//   deno run --allow-read --allow-run=git,squawk supabase/checks/schema_check.ts [base-ref]
// The base ref defaults to origin/main. scripts/lint.sh runs it.

export type Migrations = ReadonlyMap<string, string>;
export type Finding = { file: string; message: string };

const MIGRATIONS = 'supabase/migrations';
const TESTS = 'supabase/tests';
const NAME = /^(\d{14})_[a-z0-9_]+\.sql$/;

/** Migrations on main are applied in production and never change (DECISIONS 31); new ones sort
 * after main's newest, because a deploy refuses a migration older than the remote's newest. */
export function checkHistory(base: Migrations, tree: Migrations): Finding[] {
  const findings: Finding[] = [];
  const newest = [...base.keys()].sort().at(-1) ?? '';
  const seen = new Map<string, string>();
  for (const [file, sql] of base) {
    const now = tree.get(file);
    if (now === undefined) {
      findings.push({
        file,
        message:
          `is on main and was deleted: restore it (git checkout origin/main -- ${MIGRATIONS}/${file})`,
      });
    } else if (now !== sql) {
      findings.push({
        file,
        message:
          `is on main and was modified: restore it (git checkout origin/main -- ${MIGRATIONS}/${file}) ` +
          'and put the change in a new migration (supabase migration new <name>)',
      });
    }
  }
  for (const file of [...tree.keys()].sort()) {
    const version = NAME.exec(file)?.[1];
    if (version === undefined) {
      findings.push({
        file,
        message: 'is not named <14-digit UTC timestamp>_<snake_case>.sql: create migrations with ' +
          'supabase migration new <name>',
      });
      continue;
    }
    const twin = seen.get(version);
    if (twin !== undefined) {
      findings.push({ file, message: `has the same version as ${twin}: rename one of them` });
    }
    seen.set(version, file);
    if (!base.has(file) && file <= newest) {
      findings.push({
        file,
        message: `sorts before ${newest}, the newest migration on main: rename it to a fresh ` +
          'timestamp (date -u +%Y%m%d%H%M%S) and rerun supabase db reset',
      });
    }
  }
  return findings;
}

type Table = {
  file: string;
  household: boolean;
  rls: boolean;
  /** Policy name -> whether it calls is_household_member(household_id). */
  policies: Map<string, boolean>;
};

const IDENT = String.raw`"?(\w+)"?`;
const TABLE_NAME = String.raw`(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?(?:public\.)?${IDENT}`;
const CREATE_TABLE = new RegExp(
  String
    .raw`^create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?(public\.|\w+\.)?${IDENT}([\s\S]*)$`,
);
const ALTER_TABLE = new RegExp(String.raw`^alter\s+table\s+${TABLE_NAME}\s+([\s\S]*)$`);
const DROP_TABLE = /^drop\s+table\s+(?:if\s+exists\s+)?([\s\S]*?)(?:\s+(?:cascade|restrict))?$/;
const CREATE_POLICY = new RegExp(
  String.raw`^create\s+policy\s+("[^"]+"|\w+)\s+on\s+(?:only\s+)?(?:public\.)?${IDENT}\b`,
);
const DROP_POLICY = new RegExp(
  String
    .raw`^drop\s+policy\s+(?:if\s+exists\s+)?("[^"]+"|\w+)\s+on\s+(?:only\s+)?(?:public\.)?${IDENT}`,
);
const MEMBER_CHECK = /\bis_household_member\s*\(\s*(?:\w+\.)?household_id\s*\)/;
const HOUSEHOLD_COLUMN = /[(,]\s*"?household_id"?\s+\w/;
/** `like public.items` copies the columns (household_id included) but not RLS or policies. */
const LIKE = /[(,]\s*like\s+(?:public\.)?"?(\w+)"?/g;

/** Every public table enables row level security, so PostgREST never serves it unfiltered. A
 * table with household_id also has a policy calling is_household_member(household_id) and a
 * cross-household case in a pgTAP test (CLAUDE.md). */
export function checkTables(tree: Migrations, tests: ReadonlyMap<string, string>): Finding[] {
  const tables = new Map<string, Table>();
  for (const file of [...tree.keys()].sort()) {
    for (const statement of statements(tree.get(file)!)) {
      apply(tables, file, statement);
    }
  }
  const crossHousehold = [...tests.values()].filter((sql) =>
    (sql.match(/\bcreate_household\s*\(/g) ?? []).length >= 2
  );
  const findings: Finding[] = [];
  for (const [name, table] of [...tables].sort(([a], [b]) => a.localeCompare(b))) {
    if (!table.rls) {
      findings.push({
        file: table.file,
        message: `public.${name} does not enable row level security: add ` +
          `"alter table public.${name} enable row level security;" and its policies`,
      });
    }
    if (!table.household) continue;
    if (![...table.policies.values()].some(Boolean)) {
      findings.push({
        file: table.file,
        message: `public.${name} has household_id but no policy using ` +
          `public.is_household_member(household_id): add one, e.g. "create policy ${name}_member on ` +
          `public.${name} for select to authenticated using (public.is_household_member(household_id));"`,
      });
    }
    const mention = new RegExp(String.raw`\bpublic\.${name}\b`);
    if (!crossHousehold.some((sql) => mention.test(sql))) {
      findings.push({
        file: table.file,
        message:
          `public.${name} has household_id but no pgTAP test with two households touches it: ` +
          `add a cross-household case for public.${name} to ${TESTS}/rls.test.sql`,
      });
    }
  }
  return findings;
}

function apply(tables: Map<string, Table>, file: string, statement: string) {
  let m: RegExpExecArray | null;
  if ((m = CREATE_TABLE.exec(statement))) {
    const [, schema, name, body] = m;
    if (schema === undefined || schema === 'public.') {
      tables.set(name, {
        file,
        household: HOUSEHOLD_COLUMN.test(body) ||
          [...body.matchAll(LIKE)].some(([, source]) => tables.get(source)?.household === true),
        rls: false,
        policies: new Map(),
      });
    }
  } else if ((m = ALTER_TABLE.exec(statement))) {
    const [, name, action] = m;
    const table = tables.get(name);
    if (table === undefined) return;
    const renamed = /^rename\s+to\s+"?(\w+)"?$/.exec(action);
    if (renamed) {
      tables.delete(name);
      tables.set(renamed[1], table);
    }
    if (/\benable\s+row\s+level\s+security\b/.test(action)) table.rls = true;
    if (/\bdisable\s+row\s+level\s+security\b/.test(action)) table.rls = false;
    if (/\badd\s+(?:column\s+)?(?:if\s+not\s+exists\s+)?"?household_id"?\s/.test(action)) {
      table.household = true;
    }
    if (/\bdrop\s+(?:column\s+)?(?:if\s+exists\s+)?"?household_id"?\b/.test(action)) {
      table.household = false;
    }
  } else if ((m = DROP_TABLE.exec(statement))) {
    for (const name of m[1].split(',')) {
      tables.delete(name.trim().replace(/^public\./, '').replaceAll('"', ''));
    }
  } else if ((m = CREATE_POLICY.exec(statement))) {
    tables.get(m[2])?.policies.set(m[1], MEMBER_CHECK.test(statement));
  } else if ((m = DROP_POLICY.exec(statement))) {
    tables.get(m[2])?.policies.delete(m[1]);
  }
}

/** The statements of a migration, lowercased, with comments, string literals and dollar-quoted
 * bodies blanked so that a function body or a comment never reads as DDL. */
export function statements(sql: string): string[] {
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const rest = sql.slice(i);
    const dollar = /^\$(\w*)\$/.exec(rest);
    if (rest.startsWith('--')) {
      const end = sql.indexOf('\n', i);
      i = end < 0 ? sql.length : end;
    } else if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', i + 2);
      i = end < 0 ? sql.length : end + 2;
      out += ' ';
    } else if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      out += "''";
      i = j + 1;
    } else if (dollar) {
      const end = sql.indexOf(dollar[0], i + dollar[0].length);
      out += '$$';
      i = end < 0 ? sql.length : end + dollar[0].length;
    } else {
      out += sql[i];
      i++;
    }
  }
  return out.split(';').map((s) => s.replace(/\s+/g, ' ').trim().toLowerCase()).filter(Boolean);
}

/** squawk's rules that protect clients already in people's hands: TestFlight and Play builds lag
 * main, so a migration must keep the API an older app uses working. Lock and timeout rules stay
 * off: the database is tiny and migrations run in seconds. */
export const COMPAT_RULES: ReadonlySet<string> = new Set([
  'adding-not-nullable-field',
  'adding-required-field',
  'ban-drop-column',
  'ban-drop-database',
  'ban-drop-function',
  'ban-drop-not-null',
  'ban-drop-table',
  'ban-drop-view',
  'changing-column-type',
  'renaming-column',
  'renaming-table',
]);

type SquawkViolation = {
  file: string;
  line: number;
  level: string;
  message: string;
  rule_name: string;
};

/** squawk's JSON report reduced to the compatibility rules, plus anything it could not parse,
 * which it could not check either. */
export function compat(report: SquawkViolation[]): Finding[] {
  return report
    .filter((v) => COMPAT_RULES.has(v.rule_name) || v.level === 'Error')
    .map((v) => ({
      file: `${v.file.replace(`${MIGRATIONS}/`, '')}:${v.line + 1}`,
      message:
        `${v.rule_name}: ${v.message} Old app builds still use the current schema: add the ` +
        `new shape next to the old one and remove the old one only once no released build reads ` +
        `it, or put "-- squawk-ignore ${v.rule_name} -- <reason>" on the line above.`,
    }));
}

/** An inline squawk exception says why, so a reviewer can judge it:
 * `-- squawk-ignore ban-drop-column -- the column moved to qty in 20261020...`. */
export function checkIgnores(tree: Migrations): Finding[] {
  const findings: Finding[] = [];
  for (const [file, sql] of tree) {
    sql.split('\n').forEach((line, i) => {
      if (
        /squawk-ignore/.test(line) &&
        !/squawk-ignore\s+[\w-]+(?:\s*,\s*[\w-]+)*\s+--\s+\S+(?:\s+\S+){2,}/.test(line)
      ) {
        findings.push({
          file: `${file}:${i + 1}`,
          message:
            'a squawk-ignore without its reason: write "-- squawk-ignore <rule> -- <why old ' +
            'app builds are not affected>"',
        });
      }
    });
  }
  return findings;
}

async function run(
  cmd: string,
  args: string[],
): Promise<{ ok: boolean; out: string; err: string }> {
  const { success, stdout, stderr } = await new Deno.Command(cmd, { args }).output();
  const text = new TextDecoder();
  return { ok: success, out: text.decode(stdout), err: text.decode(stderr) };
}

async function readDir(dir: string, pattern: RegExp): Promise<Map<string, string>> {
  const files = new Map<string, string>();
  for await (const e of Deno.readDir(dir)) {
    if (e.isFile && pattern.test(e.name)) {
      files.set(e.name, await Deno.readTextFile(`${dir}/${e.name}`));
    }
  }
  return files;
}

async function baseMigrations(ref: string): Promise<Map<string, string>> {
  const listing = await run('git', ['ls-tree', '--name-only', ref, `${MIGRATIONS}/`]);
  if (!listing.ok) {
    throw new Error(
      `cannot read ${ref} (${listing.err.trim()}): fetch it first (git fetch origin main)`,
    );
  }
  const base = new Map<string, string>();
  for (const path of listing.out.split('\n').filter((p) => p.endsWith('.sql'))) {
    const show = await run('git', ['show', `${ref}:${path}`]);
    if (!show.ok) throw new Error(`git show ${ref}:${path}: ${show.err}`);
    base.set(path.slice(MIGRATIONS.length + 1), show.out);
  }
  return base;
}

if (import.meta.main) {
  const ref = Deno.args[0] ?? 'origin/main';
  const base = await baseMigrations(ref);
  const tree = await readDir(MIGRATIONS, /\.sql$/);
  const findings = [
    ...checkHistory(base, tree),
    ...checkTables(tree, await readDir(TESTS, /\.test\.sql$/)),
    ...checkIgnores(tree),
  ];
  const added = [...tree.keys()].filter((f) => !base.has(f)).sort();
  if (added.length > 0) {
    // squawk exits 1 whenever it reports anything, so its report decides, not its status.
    const squawk = await run('squawk', [
      '--reporter',
      'json',
      ...added.map((f) => `${MIGRATIONS}/${f}`),
    ]);
    if (!squawk.out.trim().startsWith('[')) throw new Error(`squawk failed: ${squawk.err}`);
    findings.push(...compat(JSON.parse(squawk.out)));
  }
  for (const f of findings) console.error(`${MIGRATIONS}/${f.file}: ${f.message}`);
  if (findings.length > 0) Deno.exit(1);
  console.log(
    `schema check: ${tree.size} migrations, ${added.length} new since ${ref}, no findings`,
  );
}
