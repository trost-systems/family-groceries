// What ships is built from exact versions (job 220): every `npm:` and `jsr:` specifier in
// supabase/functions/deno.json names one version, so a deploy that resolves without deno.lock
// still takes these packages at the versions the gates tested (the ranges inside them stay
// open); and the Gradle wrapper carries the checksum of the distribution it downloads, which the
// release job runs next to the signing keys. To keep that file the place a function's packages
// come from, these fail too: a second import map, a workspace or a package.json beside it, a URL
// in it, and in a function's source `npm:<name>` or `jsr:<name>` anywhere (a pragma and a string
// that reaches `import()` later count), an `http(s):` or `data:` URL after `from` or `import`,
// and one in a `@jsxImportSource`, `@ts-types` or `<reference types>` pragma. deno lint's
// `no-import-prefix` catches `import` only. Found by pattern, not by a parser: a specifier put
// together at run time passes, and so does a URL behind a comment or an escape JSON lacks.
// Usage: deno run --allow-read scripts/pinned-deps.ts [repo-dir]
const FUNCTIONS = 'supabase/functions';
const IMPORTS = `${FUNCTIONS}/deno.json`;
const WRAPPER = 'app/android/gradle/wrapper/gradle-wrapper.properties';

const SPECIFIER = /^(?:npm|jsr):\/?(?:@[^/@]+\/)?[^/@]+(?:@([^/]*))?(?:\/.*)?$/;
const EXACT_VERSION = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const CHECKSUM_LINE = /^distributionSha256Sum=[0-9a-f]{64}$/;
/** Keys of a deno.json that take imports from a file this check does not read. */
const OTHER_SOURCES = ['importMap', 'workspace'];
const SOURCE_FILE = /\.(?:[cm]?[jt]s|[jt]sx)$/;
/** The string after `from`, `import` or `import(`: a module specifier when it stands in code. */
const MODULE_LITERAL =
  /(?<![.\w$])(?:from\s*|import\s*(?:\(\s*)?)(["'`])((?:\\.|(?!\1)[^\\\n])*)\1/g;
/** A package wherever it is named: Deno takes one from a pragma too, and from a string that
 * reaches `import()` later. */
const PACKAGE_TOKEN = /(?<![\w$/.-])(?:npm|jsr):\/?@?\w[^\s"'`*)]*/gi;
/** The module a pragma names: a JSX runtime, the types of the next import, a types reference. */
const PRAGMA =
  /@(?:jsxImportSource(?:Types)?|ts-types|deno-types)[\s=]*["']?([^\s"'*]+)|<reference\s+(?:types|path)\s*=\s*["']([^"']*)/g;

function read(path: string): string | undefined {
  try {
    return Deno.readTextFileSync(path);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return undefined;
    throw error;
  }
}

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).flatMap(strings);
  }
  return [];
}

/**
 * The value as Deno reads it, as a URL: the scheme in lower case, without the whitespace and
 * control characters around it and the tabs and newlines inside. Undefined for a path.
 */
function asUrl(value: string): string | undefined {
  try {
    return new URL(value).href;
  } catch {
    return undefined;
  }
}

function specifierProblems(file: string, text: string): string[] {
  let config: unknown;
  try {
    config = JSON.parse(text);
  } catch {
    return [`${file}: is not plain JSON. Remove comments and trailing commas: the check reads it.`];
  }
  const lines = text.split('\n');
  // 0 when the file spells the value with other JSON escapes than JSON.stringify does.
  const at = (value: string): string => {
    const line = lines.findIndex((l) => l.includes(JSON.stringify(value))) + 1;
    return line > 0 ? `${file}:${line}` : file;
  };
  const elsewhere = OTHER_SOURCES.filter((key) => Object.hasOwn(Object(config), key)).map((key) =>
    `${file}: "${key}" takes imports from files this check does not read. Keep every import ` +
    `in this file's "imports".`
  );
  return elsewhere.concat(
    strings(config).flatMap((value) => {
      const specifier = asUrl(value);
      if (specifier === undefined || specifier.startsWith('node:')) return [];
      if (!/^(npm|jsr):/.test(specifier)) {
        return [
          `${at(value)}: ${JSON.stringify(value)} is a URL, which no lockfile entry pins at ` +
          `deploy time. Import the package as "npm:<name>@<version>" or "jsr:<name>@<version>".`,
        ];
      }
      const version = SPECIFIER.exec(specifier)?.[1];
      if (version !== undefined && EXACT_VERSION.test(version)) return [];
      const what = version === undefined || version === ''
        ? 'has no version'
        : `asks for "${version}", not one exact version`;
      return [
        `${at(value)}: ${JSON.stringify(value)} ${what}. Write the version deno.lock resolves it ` +
        `to (its "specifiers" entry), as in "npm:zod@4.6.7", then run ` +
        `\`deno install --lockfile-only\` beside the file.`,
      ];
    }),
  );
}

function sourceFiles(dir: string): string[] {
  return [...Deno.readDirSync(dir)].flatMap((entry) => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) return sourceFiles(path);
    return SOURCE_FILE.test(entry.name) ? [path] : [];
  }).sort();
}

/** The text a string literal's body stands for, the body itself where JSON cannot say. */
function unescaped(body: string): string {
  try {
    return String(JSON.parse(`"${body.replaceAll('"', '\\"')}"`));
  } catch {
    return body;
  }
}

/** Whether Deno would fetch the value: a package or a URL, not a path, a name or `node:`. */
function fetched(value: string): boolean {
  return /^(npm|jsr|https?|data):/.test(asUrl(value) ?? '');
}

function inlineProblems(file: string, text: string): string[] {
  const written = new Map<number, string>();
  const add = (index: number, what: string): void => {
    const line = text.slice(0, index).split('\n').length;
    if (!written.has(line)) written.set(line, what);
  };
  for (const match of text.matchAll(MODULE_LITERAL)) {
    const literal = `${match[1]}${match[2]}${match[1]}`;
    if (fetched(unescaped(match[2] ?? ''))) {
      add(match.index + match[0].length - literal.length, literal);
    }
  }
  for (const match of text.matchAll(PRAGMA)) {
    const value = match[1] ?? match[2] ?? '';
    if (fetched(value)) add(match.index, value);
  }
  for (const match of text.matchAll(PACKAGE_TOKEN)) add(match.index, match[0]);
  return [...written].sort(([a], [b]) => a - b).map(([line, what]) =>
    `${file}:${line}: ${what} names a package or URL in the source. Add it to ${IMPORTS}'s ` +
    `"imports" with one exact version and import it by that name (in a comment or a text: ` +
    `reword it).`
  );
}

/** Every unpinned dependency of what ships, empty when all are exact. */
export function check(repoDir: string): string[] {
  const problems: string[] = [];
  const imports = read(`${repoDir}/${IMPORTS}`);
  if (imports === undefined) {
    problems.push(`${IMPORTS}: is missing. Fix the path in scripts/pinned-deps.ts if it moved.`);
  } else {
    problems.push(...specifierProblems(IMPORTS, imports));
    if (read(`${repoDir}/${FUNCTIONS}/package.json`) !== undefined) {
      problems.push(
        `${FUNCTIONS}/package.json: Deno resolves its dependencies next to deno.json's, ranges ` +
          `included. Name the packages in ${IMPORTS}'s "imports" and delete the file.`,
      );
    }
    for (const path of sourceFiles(`${repoDir}/${FUNCTIONS}`)) {
      const file = path.slice(repoDir.length + 1);
      problems.push(...inlineProblems(file, Deno.readTextFileSync(path)));
    }
  }

  const wrapper = read(`${repoDir}/${WRAPPER}`);
  if (wrapper === undefined) {
    problems.push(
      `${WRAPPER}: is missing. Fix the path in scripts/pinned-deps.ts if it moved.`,
    );
  } else if (!wrapper.split(/\r?\n/).some((line) => CHECKSUM_LINE.test(line))) {
    problems.push(
      `${WRAPPER}: has no distributionSha256Sum=<64 hex digits> line. Add it with the value ` +
        `from <distributionUrl>.sha256; a distributionUrl bump changes it too.`,
    );
  }
  return problems;
}

if (import.meta.main) {
  const repo = Deno.args[0] ??
    new URL('..', import.meta.url).pathname.replace(/\/$/, '');
  const problems = check(repo);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) Deno.exit(1);
}
