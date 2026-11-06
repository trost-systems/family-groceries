// Runs the TypeScript pack (pack.ts) over the repo's tracked TS and JS files.
//   deno run -A tool/lint/ts/strict.ts            report every finding of `error` rules, exit 1 on any
//   deno run -A tool/lint/ts/strict.ts --target   also count `pending` rules, print one JSON object
import { compilerOptions, excluded, type Level, lintRules, type Project, projects, type Rule } from './pack.ts';

const repo = new URL('../../../', import.meta.url).pathname;
const target = Deno.args.includes('--target');
const counted: readonly Level[] = target ? ['error', 'pending'] : ['error'];
const sourceFile = /\.(ts|mts|cts|tsx|js|mjs|cjs)$/;
const typedFile = /\.(ts|mts|cts|tsx)$/;

interface Finding {
  readonly rule: string;
  readonly file: string;
  readonly line: number;
  readonly message: string;
}

const decoder = new TextDecoder();
const pinned = (await Deno.readTextFile(`${repo}.dvmrc`)).trim();

async function run(cmd: string, args: readonly string[], cwd: string): Promise<{ code: number; out: string }> {
  const { code, stdout, stderr } = await new Deno.Command(cmd, {
    args: [...args],
    cwd,
    stdout: 'piped',
    stderr: 'piped',
  })
    .output();
  return { code, out: decoder.decode(stdout) + decoder.decode(stderr) };
}

const isExcluded = (file: string): boolean => excluded.some((e) => file.startsWith(e.path));

function inScope(file: string): boolean {
  return sourceFile.test(file) && !isExcluded(file);
}

async function trackedFiles(): Promise<string[]> {
  const { out } = await run('git', ['ls-files', '-z'], repo);
  return out.split('\0').filter(inScope).sort();
}

const counts = (rule: Rule): boolean => counted.includes(rule.level);

async function checkRuleList(): Promise<void> {
  const { out } = await run('deno', ['lint', '--rules', '--json'], repo);
  const known = (JSON.parse(out) as { rules: { code: string }[] }).rules.map((r) => r.code).sort();
  const listed = Object.keys(lintRules).sort();
  const missing = known.filter((r) => !listed.includes(r));
  const stale = listed.filter((r) => !known.includes(r));
  if (missing.length > 0 || stale.length > 0) {
    throw new Error(
      `tool/lint/ts/pack.ts must list every rule of deno ${Deno.version.deno} exactly once ` +
        `(missing: ${missing.join(', ') || 'none'}; unknown: ${stale.join(', ') || 'none'}). ` +
        `The repo pins Deno ${pinned} in .dvmrc: run scripts/bootstrap.sh, or ` +
        `\`deno upgrade --version ${pinned}\`. To move the pin, classify the new rules in pack.ts.`,
    );
  }
}

async function lint(files: readonly string[], typed: boolean): Promise<Finding[]> {
  const include = Object.entries(lintRules).filter(([, r]) => counts(r) && (typed || r.tsOnly === undefined)).map((
    [n],
  ) => n);
  if (files.length === 0 || include.length === 0) return [];
  const config = await Deno.makeTempFile({ suffix: '.json' });
  tempConfigs.add(config);
  try {
    await Deno.writeTextFile(config, JSON.stringify({ lint: { rules: { tags: [], include } } }));
    const { out } = await run('deno', ['lint', '--config', config, '--json', ...files], repo);
    const report = JSON.parse(out) as {
      diagnostics: { code: string; filename: string; message: string; range: { start: { line: number } } }[];
      errors: { file_path: string; message: string }[];
    };
    if (report.errors.length > 0) throw new Error(`deno lint could not parse: ${JSON.stringify(report.errors)}`);
    return report.diagnostics.map((d) => ({
      rule: d.code,
      file: d.filename.replace(`file://${repo}`, ''),
      line: d.range.start.line,
      message: d.message,
    }));
  } finally {
    await Deno.remove(config);
    tempConfigs.delete(config);
  }
}

const denoDiagnostic = /(TS\d+) \[ERROR\]: (.*)\n(?:[^\n]*\n)*?\s+at file:\/\/([^:]+):(\d+):\d+/g;
// deno check colours its output even with NO_COLOR set.
const ansi = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const tscDiagnostic = /^(.+?)\((\d+),\d+\): error (TS\d+): (.*)$/gm;

async function typecheck(dir: string, checker: 'deno' | 'tsc', options: readonly string[]): Promise<Finding[]> {
  const cwd = `${repo}${dir}`;
  const enabled = Object.fromEntries(options.map((o) => [o, true]));
  if (checker === 'tsc') {
    const { code, out } = await run('npx', [
      'tsc',
      '--noEmit',
      '--pretty',
      'false',
      '-p',
      '.',
      ...options.map((o) => `--${o}`),
    ], cwd);
    const found = [...out.matchAll(tscDiagnostic)];
    failClosed(dir, 'tsc', code, found.length, out);
    return found.map(([, file = '', line = '0', rule = '', message = '']) => ({
      rule,
      file: `${dir}/${file}`,
      line: Number(line),
      message,
    })).filter((f) => !isExcluded(f.file));
  }
  const own = `${cwd}/deno.json`;
  const base: Record<string, unknown> = await exists(own) ? JSON.parse(await Deno.readTextFile(own)) : {};
  const merged = { ...base, compilerOptions: { ...(base['compilerOptions'] as object | undefined), ...enabled } };
  // Beside deno.json so its lockfile applies; per process so parallel runs keep their own.
  const config = `${cwd}/.deno.strict.${Deno.pid}.json`;
  tempConfigs.add(config);
  await Deno.writeTextFile(config, JSON.stringify(merged));
  try {
    const files = (await trackedFiles()).filter((f) => typedFile.test(f) && ownerOf(f)?.dir === dir).map((f) =>
      f.slice(dir.length + 1)
    );
    const { code, out } = await run('deno', ['check', '--quiet', '--frozen', '--config', config, ...files], cwd);
    const found = [...out.replaceAll(ansi, '').matchAll(denoDiagnostic)];
    failClosed(dir, 'deno check', code, found.length, out);
    return found
      .map(([, code = '', message = '', file = '', line = '0']) => ({
        rule: code,
        file: file.replace(repo, ''),
        line: Number(line),
        message,
      }))
      .filter((f) => f.file.startsWith(`${dir}/`) && !isExcluded(f.file));
  } finally {
    await Deno.remove(config);
    tempConfigs.delete(config);
  }
}

/** A checker that failed without a type diagnostic (lockfile, resolution, config) checked nothing. */
function failClosed(dir: string, checker: string, code: number, diagnostics: number, out: string): void {
  if (code !== 0 && diagnostics === 0) {
    throw new Error(`${checker} in ${dir} failed before type checking (exit ${code}):\n${out.replaceAll(ansi, '')}`);
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await Deno.stat(path);
    return true;
  } catch (e) {
    if (e instanceof Deno.errors.NotFound) return false;
    throw e;
  }
}

/** The nearest project above [file]. */
function ownerOf(file: string): Project | undefined {
  return projects.filter((p) => file.startsWith(`${p.dir}/`)).sort((a, b) => b.dir.length - a.dir.length)[0];
}

/** Temporary configs still on disk; an interrupted run removes them before it exits. */
const tempConfigs = new Set<string>();
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  Deno.addSignalListener(signal, () => {
    for (const config of tempConfigs) {
      try {
        Deno.removeSync(config);
      } catch (e) {
        if (!(e instanceof Deno.errors.NotFound)) throw e;
      }
    }
    Deno.exit(signal === 'SIGINT' ? 130 : 143);
  });
}

const key = (f: Finding): string => `${f.file}:${f.line}:${f.rule}:${f.message}`;

/** Findings of the base run (every enforced option) plus, per pending option, the findings it adds. */
async function compilerFindings(): Promise<Map<string, Finding[]>> {
  const enforced = Object.entries(compilerOptions).filter(([, r]) => r.level === 'error').map(([n]) => n);
  const extra = target ? Object.entries(compilerOptions).filter(([, r]) => r.level === 'pending').map(([n]) => n) : [];
  const perProject = await Promise.all(projects.map(async ({ dir, checker }) => {
    const base = await typecheck(dir, checker, enforced);
    const seen = new Set(base.map(key));
    const added: [string, Finding[]][] = [];
    for (const option of extra) {
      const found = await typecheck(dir, checker, [...enforced, option]);
      added.push([option, found.filter((f) => !seen.has(key(f)))]);
    }
    return { base, added };
  }));
  const byOption = new Map<string, Finding[]>([['typecheck', perProject.flatMap((p) => p.base)]]);
  for (const option of extra) {
    byOption.set(option, perProject.flatMap((p) => p.added.find(([o]) => o === option)?.[1] ?? []));
  }
  return byOption;
}

const suppression = /(?:\/\/|\/\*)\s*(deno-lint-ignore|@ts-ignore|@ts-expect-error|@ts-nocheck|eslint-disable)/g;

async function suppressions(files: readonly string[]): Promise<Finding[]> {
  const found: Finding[] = [];
  for (const file of files) {
    const lines = (await Deno.readTextFile(`${repo}${file}`)).split('\n');
    lines.forEach((text, i) => {
      for (const m of text.matchAll(suppression)) {
        found.push({ rule: m[1] ?? '', file, line: i + 1, message: text.trim() });
      }
    });
  }
  return found;
}

await checkRuleList();
const files = await trackedFiles();
const orphans = files.filter((f) => typedFile.test(f) && ownerOf(f) === undefined);
if (orphans.length > 0) {
  throw new Error(
    `TypeScript files in no type-checked project (add a project or an exclusion with its reason to tool/lint/ts/pack.ts): ${
      orphans.join(', ')
    }`,
  );
}
const [typedLint, plainLint, compiler] = await Promise.all([
  lint(files.filter((f) => typedFile.test(f)), true),
  lint(files.filter((f) => !typedFile.test(f)), false),
  compilerFindings(),
]);
const lintFindings = [...typedLint, ...plainLint];

if (target) {
  const ruleCounts: Record<string, number> = {};
  for (const f of lintFindings) ruleCounts[f.rule] = (ruleCounts[f.rule] ?? 0) + 1;
  for (const [option, found] of compiler) if (found.length > 0) ruleCounts[option] = found.length;
  const suppressed = await suppressions(files);
  if (suppressed.length > 0) ruleCounts['suppressions'] = suppressed.length;
  const targetRules = [...Object.entries(lintRules), ...Object.entries(compilerOptions)]
    .filter(([, r]) => r.level !== 'off').map(([n]) => n).sort();
  console.log(JSON.stringify({
    files: files.length,
    violations: Object.values(ruleCounts).reduce((a, b) => a + b, 0),
    rule_counts: Object.fromEntries(Object.entries(ruleCounts).sort(([a], [b]) => a.localeCompare(b))),
    target_rules: targetRules,
    enforced: targetRules.filter((n) => (lintRules[n] ?? compilerOptions[n])?.level === 'error').length,
  }));
} else {
  // Like ast-grep-ignore and squawk-ignore (scripts/lint.sh): an ignore a reviewer cannot judge gets copied.
  const unreasoned = (await suppressions(files))
    .filter((f) => !/ -- \S/.test(f.message))
    .map((f) => ({ ...f, rule: 'ignore-needs-reason', message: `${f.message} (add \` -- <reason>\`)` }));
  const all = [...lintFindings, ...(compiler.get('typecheck') ?? []), ...unreasoned];
  for (const f of all) console.error(`${f.file}:${f.line}: ${f.rule}: ${f.message}`);
  if (all.length > 0) {
    console.error(
      `tool/lint/ts: ${all.length} finding(s) of enforced rules (rule table and reasons: tool/lint/ts/pack.ts)`,
    );
    Deno.exit(1);
  }
  console.error(`tool/lint/ts: ${files.length} files clean`);
}
