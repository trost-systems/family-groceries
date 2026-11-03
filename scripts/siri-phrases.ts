// The native Siri phrases (app/ios/Runner/AppIntents/HummlistIntents.swift) against the tables
// Siri matches them with: every phrase has an en and a de translation that keeps the app name and
// its parameter, no German phrase is left in English or said twice, and each language names the
// app the way its Siri writes it (INAlternativeAppNames, job 71). German phrases stay out of
// Reminders' grammar, the add phrases without an item come first, and every spoken name carries a
// pronunciation hint (job 92). RunnerTests checks the same on macOS; this runs everywhere.
// Usage: deno run --allow-read scripts/siri-phrases.ts [ios-dir]
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
const phrasesIn = (code: string) =>
  [...code.matchAll(/"([^"\n]*\\\(\.applicationName\)[^"\n]*)"/g)].map((m) =>
    m[1].replaceAll('\\(.applicationName)', '${applicationName}').replace(
      /\\\(\\\.\$(\w+)\)/g,
      '${$1}',
    )
  );
const phrases = phrasesIn(source);
// Siri asks for the items after a phrase without one, so that works for any item; an item phrase
// matches only the names the app suggested.
const add = phrasesIn(source.match(/intent: AddItemsIntent\(\)([\s\S]*?)shortTitle:/)?.[1] ?? '');
const firstWithItem = add.findIndex((p) => p.includes('${item}'));
if (add.length === 0) problems.push('HummlistIntents.swift: no AddItemsIntent phrases found');
else if (firstWithItem === 0 || add.slice(firstWithItem).some((p) => !p.includes('${item}'))) {
  problems.push('HummlistIntents.swift: the add phrases without an item must come first');
}
if (phrases.length < 10) {
  problems.push(`HummlistIntents.swift: only ${phrases.length} phrases found`);
}
for (const phrase of phrases) {
  if (placeholders(phrase).filter((p) => p !== '${applicationName}').length > 1) {
    problems.push(`"${phrase}": more than one parameter`);
  }
}

const prepositions = new Set(['auf', 'zu', 'zur', 'zum', 'in', 'im', 'an', 'mit', 'für']);
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
    } else if (lang === 'de') {
      // German Siri hands "Einkaufsliste" and "Füge X zur <…>liste hinzu" to Reminders; a bare
      // "Auf meine Hummlist" is a fragment of that grammar.
      const first = value.split(' ')[0].toLowerCase();
      if (/einkaufsliste/i.test(value)) {
        problems.push(`${path}: "${value}" says Einkaufsliste, which Reminders takes`);
      } else if (prepositions.has(first) && value.endsWith('${applicationName}')) {
        problems.push(`${path}: "${value}" is a fragment without a verb`);
      }
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
const entries = [...(alternatives ?? '').matchAll(/<dict>([\s\S]*?)<\/dict>/g)].map((m) => m[1]);
const entryValue = (entry: string, key: string) =>
  entry.match(new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`))?.[1];
const variables = entries.map((e) => entryValue(e, 'INAlternativeAppName')).filter((v) =>
  v !== undefined
);
const hints = entries.map((e) => entryValue(e, 'INAlternativeAppNamePronunciationHint'));
if (hints.some((h) => h === undefined)) {
  problems.push(
    'Info.plist: every INAlternativeAppNames entry needs INAlternativeAppNamePronunciationHint',
  );
}
const intents = plist.match(/<key>INIntentsSupported<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ??
  '';
for (const intent of ['INAddTasksIntent', 'INSearchForNotebookItemsIntent']) {
  if (!intents.includes(`<string>${intent}</string>`)) {
    problems.push(`Info.plist: INIntentsSupported lacks ${intent} (AppDelegate handles it)`);
  }
}
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
  for (const hint of hints) {
    if (hint && !table.get(hint)?.trim()) problems.push(`${path}: no ${hint}`);
  }
  for (const key of ['CFBundleSpokenName', 'NSSiriUsageDescription']) {
    if (!table.get(key)?.trim()) problems.push(`${path}: no ${key}`);
  }
}

if (problems.length) {
  console.error(problems.map((p) => `siri-phrases: ${p}`).join('\n'));
  Deno.exit(1);
}
console.log(
  `siri-phrases: ${phrases.length} phrases in en and de, ${variables.length} spoken app names per language`,
);
