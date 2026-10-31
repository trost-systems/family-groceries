#!/usr/bin/env node
// The user-facing changelog (docs/CHANGELOG.md): every PR description carries a `## Changelog`
// section, push-pr.sh lands it in the one commit main takes, and this script reads it back from git.
// Plain node, no packages, no network.
//
//   node scripts/release/changelog.mjs check [--file F]
//     Checks the `## Changelog` section of a PR description or commit message (stdin without
//     --file). Exit 0: valid; 1: invalid (the reason on stderr); 3: no section.
//   node scripts/release/changelog.mjs draft --version X --sha S [--previous-sha P] [--out F]
//     [--skip SHA]... [--force] [--dry-run]
//     Collects the notes of main's commits in previous..sha into releases/changelog/<X>.json,
//     with the App Store and Play "What's new" texts.
//   node scripts/release/changelog.mjs store --version X [--file F]
//     Rewrites a draft's store texts from its (edited) title and items.
//   node scripts/release/changelog.mjs drafts [--dir D]
//     Checks every draft in releases/changelog/: valid, named <version>.json, store texts current.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { CATEGORIES, DRAFT_STATUS, RecordError, STORE_LIMITS, compareVersions, isVersion, parseDraft, parseRecord, publicReleases } from '../../site/releases.mjs';

export class NoteError extends Error {}

const HEADING = /^##[ \t]+changelog[ \t]*$/i;
const CATEGORY_WORDS = { new: 'new', neu: 'new', improved: 'improved', verbessert: 'improved', fixed: 'fixed', behoben: 'fixed' };
const TEXT_LINE = /^(?:[-*][ \t]+)?(de|en)[ \t]*:[ \t]*(.*)$/i;

// The word a category or `none` line holds, without Markdown around it, a trailing colon or full
// stop, or a remark in brackets: "**New:**", "`none`", "None.", "none (docs only)".
const word = (line) =>
  line
    .trim()
    .replace(/^(?:[-*>][ \t]+)+/, '')
    .replace(/[*_`]/g, '')
    .replace(/[ \t]*\([^)]*\)$/, '')
    .replace(/[:.]$/, '')
    .trim()
    .toLowerCase();
const NEAR_HEADING = /^[ \t]*#{1,6}[ \t]*\**changelog\b/i;

// The `## Changelog` section of a PR description or commit message: null when there is none,
// 'none', or the items in order. It runs to the next heading or `---` rule; a paragraph that is
// neither an item nor `none` ends it too, so text after it (a "Generated with" line, trailers)
// is no part of it. Strict about structure, lenient about case, a trailing colon and list dashes.
export function parseNote(message) {
  // Code fences go too: a description may quote the format, heading included.
  const lines = message
    .replace(/\r/g, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[`~]*[ \t]*$/gm, '')
    .split('\n');
  const starts = lines.flatMap((line, i) => (HEADING.test(line) ? [i] : []));
  const near = lines.find((line) => NEAR_HEADING.test(line) && !HEADING.test(line));
  if (near !== undefined) throw new NoteError(`"${near.trim()}" is not the section heading; write it as "## Changelog" on its own line`);
  if (starts.length === 0) return null;
  if (starts.length > 1) throw new NoteError('there are several "## Changelog" sections; keep one');
  const body = [];
  for (const line of lines.slice(starts[0] + 1)) {
    if (/^#{1,6}([ \t]|$)/.test(line) || /^-{3,}[ \t]*$/.test(line)) break;
    body.push(line);
  }
  const paragraphs = [];
  for (const line of body) {
    if (line.trim() === '') paragraphs.push([]);
    else (paragraphs.at(-1) ?? paragraphs[paragraphs.push([]) - 1]).push(line.trim());
  }
  const items = [];
  let none = false;
  let ended = null;
  for (const paragraph of paragraphs.filter((p) => p.length > 0)) {
    const [first, ...rest] = paragraph;
    const head = word(first);
    const looksLikeItem = paragraph.some((line) => TEXT_LINE.test(line)) || /^[\p{L}-]+$/u.test(head);
    if (ended !== null) {
      if (looksLikeItem) throw new NoteError(`"${first}" comes after "${ended}", which is no item; put the items first, one after another`);
      continue;
    }
    if (head === 'none' || head === 'keine') {
      if (rest.length > 0) throw new NoteError(`"${first}" stands alone; found "${rest[0]}" after it`);
      none = true;
      continue;
    }
    const category = CATEGORY_WORDS[head];
    if (!category) {
      if (looksLikeItem) throw new NoteError(`unknown category "${first}"; an item starts with new, improved or fixed (or the section is just "none")`);
      ended = first;
      continue;
    }
    const texts = {};
    for (const line of rest) {
      const match = TEXT_LINE.exec(line);
      if (!match) throw new NoteError(`${category} item: "${line}" is not a "de: ..." or "en: ..." line`);
      const lang = match[1].toLowerCase();
      if (lang in texts) throw new NoteError(`${category} item: two "${lang}:" lines; one item has one de: and one en: line`);
      if (match[2].trim() === '') throw new NoteError(`${category} item: the "${lang}:" line is empty`);
      texts[lang] = match[2].trim();
    }
    for (const lang of ['de', 'en']) if (!(lang in texts)) throw new NoteError(`${category} item${texts.de || texts.en ? ` "${texts.de ?? texts.en}"` : ''} has no "${lang}:" line`);
    items.push({ category, de: texts.de, en: texts.en });
  }
  if (none && items.length > 0) throw new NoteError('"none" and items in one section; write either items or just "none"');
  if (!none && items.length === 0) throw new NoteError('the "## Changelog" section is empty; add items (new, improved or fixed with a de: and an en: line) or "none"');
  return none ? 'none' : items;
}

// --- store texts -------------------------------------------------------------------------------

const STORE_WORDS = {
  de: { new: 'Neu:', improved: 'Verbessert:', fixed: 'Behoben:', nothing: 'Fehlerbehebungen und Verbesserungen.', more: (anchor) => `Alle Änderungen: hummlist.com/de/changelog${anchor}` },
  en: { new: 'New:', improved: 'Improved:', fixed: 'Fixed:', nothing: 'Bug fixes and improvements.', more: (anchor) => `All changes: hummlist.com/en/changelog${anchor}` },
};
// What pilot's sanitize_changelog takes out because Apple rejects it: emoji and "<" (it then cuts at
// 4000 bytes; storeText never lets it get there).
// Emoji are what shows as emoji: emoji presentation, or text symbols with the emoji selector. ©, ™,
// arrows and ✔ without the selector are text and stay.
const EMOJI = /\p{Extended_Pictographic}\u{FE0F}|[\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\u{FE0F}\u{20E3}\u{200D}]/gu;
export const sanitize = (text) =>
  text.normalize('NFC').replace(EMOJI, '').replace(/</g, '').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,:;!?])/g, '$1').trim();

export const anchorOf = (version) => `#v${version.replaceAll('.', '-')}`;

// One store's "What's new" in one language: the title, then the items under Neu/Verbessert/Behoben.
// When it doesn't fit, whole items go from the end (fixed first, then improved, then new) and a
// last line points to the full list; a sentence is never cut.
export function storeText(changelog, store, lang, version) {
  const { limit, length } = STORE_LIMITS[store];
  const words = STORE_WORDS[lang];
  const title = sanitize(changelog.title[lang]);
  const items = CATEGORIES.flatMap((category) => changelog.items[category].map((item) => ({ category, text: sanitize(item[lang]) }))).filter((i) => i.text !== '');
  const render = (kept, more) => {
    const blocks = title ? [title] : [];
    for (const category of CATEGORIES) {
      const lines = kept.filter((i) => i.category === category).map((i) => `• ${i.text}`);
      if (lines.length) blocks.push([words[category], ...lines].join('\n'));
    }
    if (kept.length === 0 && !more) blocks.push(words.nothing);
    if (more) blocks.push(words.more(anchorOf(version)));
    return blocks.join('\n\n');
  };
  let text = render(items, false);
  // Items are in category order, so dropping from the end drops fixed first, then improved, then new.
  for (let kept = items.length - 1; length(text) > limit; kept--) {
    if (kept < 0) throw new NoteError(`${store} ${lang}: the title alone does not fit the store's ${limit} ${STORE_LIMITS[store].unit}; shorten it`);
    text = render(items.slice(0, kept), true);
  }
  return text;
}

// Store texts that are not what title and items give, as "store.lang" paths: a draft edited without
// running the store command afterwards.
export const staleStoreTexts = (changelog, version) => {
  const fresh = storeTexts(changelog, version);
  return Object.entries(fresh).flatMap(([store, langs]) => Object.keys(langs).filter((lang) => changelog.store[store][lang] !== langs[lang]).map((lang) => `${store}.${lang}`));
};

export const storeTexts = (changelog, version) =>
  Object.fromEntries(Object.keys(STORE_LIMITS).map((store) => [store, { de: storeText(changelog, store, 'de', version), en: storeText(changelog, store, 'en', version) }]));

// --- collecting from git ------------------------------------------------------------------------

class Refusal extends Error {}
const refuse = (message) => {
  throw new Refusal(message);
};

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  } catch (error) {
    return refuse(`git ${args.join(' ')} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

const commitOf = (ref, flag) => {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return refuse(`${flag} ${ref} is not a commit in this repository`);
  }
};

const isAncestor = (ancestor, descendant) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

// main's commits in previous..sha (from the root without previous), oldest first, with the items
// of their notes. Commits without a section (before job 39, release records, Dependabot) and
// `none` give no items.
export function collect({ previous, sha, skip = [] }) {
  const range = previous ? [`${previous}..${sha}`] : [sha];
  const log = git('log', '--first-parent', '--reverse', '--format=%x1e%H%x00%s%x00%B', ...range);
  const items = Object.fromEntries(CATEGORIES.map((c) => [c, []]));
  const seen = new Set();
  const problems = [];
  for (const chunk of log.split('\x1e').slice(1)) {
    const [hash, subject, message] = chunk.split('\x00');
    if (skip.some((s) => hash.startsWith(s))) continue;
    let note;
    try {
      note = parseNote(message);
    } catch (error) {
      if (!(error instanceof NoteError)) throw error;
      problems.push(`${hash.slice(0, 7)} "${subject}": ${error.message}`);
      continue;
    }
    if (note === null || note === 'none') continue;
    const pr = Number(/\(#(\d+)\)$/.exec(subject)?.[1]) || null;
    for (const { category, de, en } of note) {
      const key = `${de}\n${en}`;
      if (seen.has(key)) continue;
      seen.add(key);
      items[category].push({ de, en, pr, sha: hash });
    }
  }
  if (problems.length) {
    refuse(`invalid ## Changelog sections on main (fix the wording in the draft by hand and rerun with --skip <sha> for each):\n  ${problems.join('\n  ')}`);
  }
  return items;
}

const repoRoot = () => git('rev-parse', '--show-toplevel').trim();
const draftPath = (version) => resolve(repoRoot(), 'releases/changelog', `${version}.json`);
export const serializeDraft = (draft) => `${JSON.stringify(draft, null, 2)}\n`;

function report(draft, file) {
  const lines = [];
  for (const [store, langs] of Object.entries(draft.store)) {
    for (const [lang, text] of Object.entries(langs)) {
      const { limit, unit, length } = STORE_LIMITS[store];
      lines.push(`--- ${store} ${lang} (${length(text)} of ${limit} ${unit})`, text);
    }
  }
  const count = CATEGORIES.reduce((n, c) => n + draft.items[c].length, 0);
  if (count === 0) {
    console.error(`WARNING: ${file}: no user-visible change in this range, so the store texts say only "${STORE_WORDS.en.nothing}". A release without anything users notice is suspicious: check the range and the PRs' ## Changelog sections.`);
  }
  if (!draft.title.de || !draft.title.en) lines.push(`--- title is empty: add a headline naming the 2-3 biggest things (title.de, title.en), then run: node scripts/release/changelog.mjs store --version ${draft.version}`);
  return lines.join('\n');
}

function draftCommand(argv) {
  const { values: opts } = parseArgs({
    args: argv,
    strict: true,
    options: {
      version: { type: 'string' },
      sha: { type: 'string' },
      'previous-sha': { type: 'string' },
      out: { type: 'string' },
      skip: { type: 'string', multiple: true, default: [] },
      record: { type: 'string' },
      force: { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  for (const required of ['version', 'sha']) if (opts[required] === undefined) refuse(`--${required} is required`);
  if (!isVersion(opts.version)) refuse(`--version ${opts.version} is not MAJOR.MINOR.PATCH`);
  const recordFile = opts.record ? resolve(opts.record) : resolve(repoRoot(), 'releases/releases.json');
  const releases = publicReleases(parseRecord(readFileSync(recordFile, 'utf8'), relative(process.cwd(), recordFile) || recordFile));
  const recorded = releases.find((r) => r.version === opts.version);
  if (recorded) refuse(`--version ${opts.version} is already a public release (${recorded.date}); its changelog is in the record`);
  const newest = releases.at(-1);
  if (newest && compareVersions(opts.version, newest.version) <= 0) refuse(`--version ${opts.version} must be above the newest public release ${newest.version}`);

  const sha = commitOf(opts.sha, '--sha');
  const previous = opts['previous-sha'] !== undefined ? commitOf(opts['previous-sha'], '--previous-sha') : (newest?.sha ?? null);
  if (previous && !isAncestor(previous, sha)) refuse(`${previous} (${opts['previous-sha'] ? '--previous-sha' : `release ${newest.version}`}) is not an ancestor of ${sha}`);

  const items = collect({ previous, sha, skip: opts.skip });
  const changelog = { title: { de: '', en: '' }, items };
  const draft = { version: opts.version, status: DRAFT_STATUS, generated_from: { previous_sha: previous, sha }, ...changelog, store: storeTexts(changelog, opts.version) };
  const text = serializeDraft(draft);
  const file = opts.out ? resolve(opts.out) : draftPath(opts.version);
  const label = relative(process.cwd(), file) || file;
  parseDraft(text, label);
  if (opts['dry-run']) {
    console.log(text.trimEnd());
    console.log(report(draft, label));
    console.log(`dry run: ${label} not written`);
    return;
  }
  if (existsSync(file) && !opts.force) {
    refuse(`${label} exists and may hold reviewed wording; edit it by hand (then run the store command), or rerun with --force to replace it`);
  }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  console.log(report(draft, label));
  const count = CATEGORIES.reduce((n, c) => n + items[c].length, 0);
  console.log(`wrote ${label}: ${count} items from ${previous ? previous.slice(0, 7) : 'the root commit'}..${sha.slice(0, 7)}`);
}

function storeCommand(argv) {
  const { values: opts } = parseArgs({ args: argv, strict: true, options: { version: { type: 'string' }, file: { type: 'string' } } });
  if (opts.version === undefined) refuse('--version is required');
  const file = opts.file ? resolve(opts.file) : draftPath(opts.version);
  const label = relative(process.cwd(), file) || file;
  if (!existsSync(file)) refuse(`${label} does not exist; run the draft command first`);
  const draft = parseDraft(readFileSync(file, 'utf8'), label);
  if (draft.version !== opts.version) refuse(`${label} is the draft of ${draft.version}, not ${opts.version}`);
  draft.store = storeTexts(draft, draft.version);
  const text = serializeDraft(draft);
  parseDraft(text, label);
  writeFileSync(file, text);
  console.log(report(draft, label));
  console.log(`updated the store texts in ${label}`);
}

// Every draft in releases/changelog/ parses, is named after its version and has current store
// texts. The changelog gate runs it, so a draft PR can't land with stale "What's new" texts.
function draftsCommand(argv) {
  const { values: opts } = parseArgs({ args: argv, strict: true, options: { dir: { type: 'string' } } });
  const dir = opts.dir ? resolve(opts.dir) : resolve(repoRoot(), 'releases/changelog');
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.json')) : [];
  for (const f of files) {
    const label = relative(process.cwd(), join(dir, f)) || f;
    const draft = parseDraft(readFileSync(join(dir, f), 'utf8'), label);
    if (f !== `${draft.version}.json`) refuse(`${label} holds version ${draft.version}; name it ${draft.version}.json`);
    const stale = staleStoreTexts(draft, draft.version);
    if (stale.length) refuse(`${label}: the store texts ${stale.join(', ')} are not what its title and items give; run: node scripts/release/changelog.mjs store --version ${draft.version}`);
  }
  console.log(`changelog drafts: ${files.length} checked`);
}

function checkCommand(argv) {
  const { values: opts } = parseArgs({ args: argv, strict: true, options: { file: { type: 'string' } } });
  const message = readFileSync(opts.file ?? 0, 'utf8');
  const note = parseNote(message);
  if (note === null) {
    console.error('no "## Changelog" section');
    process.exit(3);
  }
  console.log(note === 'none' ? 'changelog: none (nothing users see)' : `changelog: ${note.map((i) => `${i.category}: ${i.en}`).join(' | ')}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [command, ...rest] = process.argv.slice(2);
  const commands = { check: checkCommand, draft: draftCommand, store: storeCommand, drafts: draftsCommand };
  try {
    if (!commands[command]) refuse(`unknown command ${command ?? '(none)'}; usage: changelog.mjs check|draft|store (see the comment at the top)`);
    commands[command](rest);
  } catch (error) {
    if (!(error instanceof Refusal || error instanceof NoteError || error instanceof RecordError || error.code?.startsWith('ERR_PARSE_ARGS'))) throw error;
    console.error(`changelog: ${error.message}`);
    process.exit(1);
  }
}
