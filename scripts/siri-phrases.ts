// The native Siri phrases (app/ios/Runner/AppIntents/HummlistIntents.swift) against the tables
// Siri matches them with: every phrase has an en and a de translation that keeps the app name and
// its parameter, no German phrase is left in English or said twice, and each language names the
// app the way its Siri writes it (INAlternativeAppNames, job 71). RunnerTests checks the same on
// macOS; this runs everywhere. Usage: deno run --allow-read scripts/siri-phrases.ts [ios-dir]
const ios = Deno.args[0] ?? new URL('../app/ios', import.meta.url).pathname;
const problems: string[] = [];
function read(path: string): string {
  try {
    return Deno.readTextFileSync(`${ios}/${path}`);
  } catch (error) {
    if (!(error instanceof Deno.errors.NotFound)) throw error;
    problems.push(`${path} is missing`);
    return '';
  }
}

/** `"key" = "value";` lines of a .strings file, comments skipped. */
function strings(path: string): Map<string, string> {
  const table = new Map<string, string>();
  const text = read(path).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const line of text.split('\n').filter((l) => l.trim())) {
    const match = line.match(/^\s*"((?:[^"\\]|\\.)*)"\s*=\s*"((?:[^"\\]|\\.)*)";\s*$/);
    if (!match) problems.push(`${path}: unreadable line ${JSON.stringify(line)}`);
    else if (table.has(match[1])) problems.push(`${path}: "${match[1]}" twice`);
    else table.set(match[1], match[2]);
  }
  return table;
}

const placeholders = (phrase: string) =>
  [...phrase.matchAll(/\$\{[A-Za-z]+\}/g)].map((m) => m[0]).sort();

const source = read('Runner/AppIntents/HummlistIntents.swift');
const phrases = [...source.matchAll(/"([^"\n]*\\\(\.applicationName\)[^"\n]*)"/g)].map((m) =>
  m[1].replaceAll('\\(.applicationName)', '${applicationName}').replace(
    /\\\(\\\.\$(\w+)\)/g,
    '${$1}',
  )
);
if (phrases.length < 10) {
  problems.push(`HummlistIntents.swift: only ${phrases.length} phrases found`);
}
for (const phrase of phrases) {
  if (placeholders(phrase).filter((p) => p !== '${applicationName}').length > 1) {
    problems.push(`"${phrase}": more than one parameter`);
  }
}

for (const lang of ['en', 'de']) {
  const path = `Runner/${lang}.lproj/AppShortcuts.strings`;
  const table = strings(path);
  for (const phrase of phrases) {
    const value = table.get(phrase);
    if (value === undefined) problems.push(`${path}: no translation of "${phrase}"`);
    else if (placeholders(value).join() !== placeholders(phrase).join()) {
      problems.push(`${path}: "${value}" must keep ${placeholders(phrase).join(', ')}`);
    } else if (lang === 'de' && value === phrase) {
      problems.push(`${path}: "${phrase}" is not translated`);
    }
  }
  for (const key of table.keys()) {
    if (!phrases.includes(key)) {
      problems.push(`${path}: "${key}" is no phrase in HummlistIntents.swift`);
    }
  }
  const said = new Map<string, string>();
  for (const [key, value] of table) {
    const spoken = value.toLowerCase();
    if (said.has(spoken)) {
      problems.push(`${path}: "${key}" and "${said.get(spoken)}" both say "${value}"`);
    }
    said.set(spoken, key);
  }
}

// The phrases the Zugänge page shows (app/lib/siri/siri_phrases.dart) must be ones Siri knows.
const dart = read('../lib/siri/siri_phrases.dart');
for (const lang of ['en', 'de']) {
  const block = dart.match(new RegExp(`\\b${lang}: \\[([\\s\\S]*?)\\]`))?.[1] ?? '';
  const list = [...block.matchAll(/'((?:[^'\\]|\\.)*)'|"([^"]*)"/g)].map((m) => m[1] ?? m[2]);
  if (list.length === 0) problems.push(`siri_phrases.dart: no ${lang} phrases`);
  const known = new Set(
    [...strings(`Runner/${lang}.lproj/AppShortcuts.strings`).values()].map((v) => v.toLowerCase()),
  );
  for (const phrase of list) {
    const asTable = phrase.replace(/[?.!]$/, '').replace(/<[^>]+>/g, '${item}')
      .replaceAll('Hummlist', '${applicationName}').toLowerCase();
    if (!known.has(asTable)) {
      problems.push(`siri_phrases.dart shows "${phrase}", which is no ${lang} phrase Siri knows`);
    }
  }
}

const plist = read('Runner/Info.plist');
const alternatives = plist.match(/<key>INAlternativeAppNames<\/key>\s*<array>([\s\S]*?)<\/array>/)
  ?.[1];
const variables = [
  ...(alternatives ?? '').matchAll(/<key>INAlternativeAppName<\/key>\s*<string>([^<]+)<\/string>/g),
].map((m) => m[1]);
if (variables.length === 0) problems.push('Info.plist: no INAlternativeAppNames');
if (variables.length > 3) {
  problems.push('Info.plist: Apple reads at most three INAlternativeAppNames');
}
for (const lang of ['en', 'de', 'Base']) {
  const path = `Runner/${lang}.lproj/InfoPlist.strings`;
  const table = strings(path);
  for (const variable of variables) {
    const name = table.get(variable)?.trim();
    if (!name) problems.push(`${path}: no ${variable}`);
    else if (name.toLowerCase() === 'hummlist') {
      problems.push(`${path}: ${variable} repeats the app name`);
    }
  }
}

if (problems.length) {
  console.error(problems.map((p) => `siri-phrases: ${p}`).join('\n'));
  Deno.exit(1);
}
console.log(
  `siri-phrases: ${phrases.length} phrases in en and de, ${variables.length} spoken app names per language`,
);
