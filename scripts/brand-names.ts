// Public copy never names the AI brands ChatGPT, OpenAI, Claude or Anthropic, except where Legal
// allowed it (Legal review N-80..N-86, job 96): site/content, the text files in site/public and
// mcp-proxy/public (the page at mcp.hummlist.com) and the values of app/l10n/*.arb (the @-metadata
// is not shown to users). Every exception is an entry with its reason in
// scripts/brand-names.allow.json, for a key, a line (contains) or a file, optionally only for the
// brands it lists; an entry that covers nothing any more is stale.
// Usage: deno run --allow-read scripts/brand-names.ts [repo-dir]
const BRAND = /\b(chatgpt|openai|claude|anthropic)\b/gi;
const PUBLIC_TEXT = /\.(html|txt|md|json|svg)$/;
const ALLOW_FILE = 'scripts/brand-names.allow.json';

interface Entry {
  file: string;
  key?: string;
  contains?: string;
  brands?: string[];
  reason: string;
}

interface Hit {
  file: string;
  line: number;
  brand: string;
  text: string;
  key?: string;
}

function* walk(dir: string): Generator<string> {
  let entries: Deno.DirEntry[];
  try {
    entries = [...Deno.readDirSync(dir)];
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return;
    throw error;
  }
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) yield* walk(path);
    else if (entry.isFile) yield path;
  }
}

function brandsIn(text: string): string[] {
  return [...text.matchAll(BRAND)].flatMap(([, brand]) => brand === undefined ? [] : [brand]);
}

function textHits(file: string, text: string): Hit[] {
  return text.split('\n').flatMap((line, i) =>
    brandsIn(line).map((brand) => ({ file, line: i + 1, brand, text: line }))
  );
}

function arbHits(file: string, text: string): Hit[] {
  const lines = text.split('\n');
  const values: Record<string, unknown> = JSON.parse(text);
  return Object.entries(values).flatMap(([key, value]) => {
    if (key.startsWith('@') || typeof value !== 'string') return [];
    const found = lines.findIndex((l) => l.trimStart().startsWith(`${JSON.stringify(key)}:`));
    return brandsIn(value).map((brand) => ({
      file,
      line: found + 1,
      brand,
      text: value,
      key,
    }));
  });
}

function covers(entry: Entry, hit: Hit): boolean {
  if (entry.file !== hit.file) return false;
  if (entry.brands && !entry.brands.some((b) => b.toLowerCase() === hit.brand.toLowerCase())) {
    return false;
  }
  if (entry.key !== undefined) return entry.key === hit.key;
  if (entry.contains !== undefined) return hit.text.includes(entry.contains);
  return true;
}

function exists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return false;
    throw error;
  }
}

/** Every problem with the repo's public copy and its allowlist, empty when it is clean. */
export function check(repoDir: string): string[] {
  const problems: string[] = [];
  const rel = (path: string) => path.slice(repoDir.length + 1);

  let entries: Entry[] = [];
  try {
    entries = JSON.parse(Deno.readTextFileSync(`${repoDir}/${ALLOW_FILE}`)).entries ?? [];
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
  }
  entries.forEach((entry, i) => {
    const name = `${ALLOW_FILE}: entry ${i + 1} (${entry.file})`;
    if (!entry.reason?.trim()) problems.push(`${name}: has no reason. Say why Legal allows it.`);
    if (entry.key !== undefined && entry.contains !== undefined) {
      problems.push(`${name}: has both key and contains. Use one.`);
    }
    if (
      entry.brands !== undefined &&
      (!Array.isArray(entry.brands) || entry.brands.length === 0 ||
        !entry.brands.every((b) => typeof b === 'string' && brandsIn(b).length === 1))
    ) {
      problems.push(`${name}: brands must list ChatGPT, OpenAI, Claude or Anthropic.`);
    }
    if (!exists(`${repoDir}/${entry.file}`)) {
      problems.push(`${name}: the file is missing. Remove the entry.`);
    }
  });

  const hits: Hit[] = [];
  const scan = (path: string, find: (file: string, text: string) => Hit[]) =>
    hits.push(...find(rel(path), Deno.readTextFileSync(path)));
  for (const path of walk(`${repoDir}/site/content`)) scan(path, textHits);
  for (const dir of ['site/public', 'mcp-proxy/public']) {
    for (const path of walk(`${repoDir}/${dir}`)) {
      if (PUBLIC_TEXT.test(path)) scan(path, textHits);
    }
  }
  for (const path of walk(`${repoDir}/app/l10n`)) {
    if (path.endsWith('.arb')) scan(path, arbHits);
  }

  const used = new Set<Entry>();
  for (const hit of hits) {
    const allowed = entries.filter((e) => covers(e, hit));
    allowed.forEach((e) => used.add(e));
    if (allowed.length === 0) {
      problems.push(
        `${hit.file}:${hit.line}: names "${hit.brand}". Write it brand-free (Legal N-80..N-86) or, ` +
          `if Legal allowed it, add an entry with its reason to ${ALLOW_FILE}`,
      );
    }
  }
  entries.forEach((entry, i) => {
    if (!used.has(entry) && exists(`${repoDir}/${entry.file}`)) {
      const what = entry.key ?? entry.contains ?? entry.brands?.join(', ') ?? 'the whole file';
      problems.push(
        `${ALLOW_FILE}: entry ${
          i + 1
        } (${entry.file}, ${what}) is stale, it covers no brand name. ` +
          `Remove it.`,
      );
    }
  });
  return problems;
}

if (import.meta.main) {
  const repo = Deno.args[0] ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  const problems = check(repo);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) Deno.exit(1);
}
