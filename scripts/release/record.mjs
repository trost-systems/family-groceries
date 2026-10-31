#!/usr/bin/env node
// Adds a public release to releases/releases.json (releases/README.md), with its stats from git.
// Run by .github/workflows/public-release-record.yml; plain node, no packages. The reviewed
// changelog draft releases/changelog/<version>.json, if there is one, goes into the entry as
// `changelog`, and the draft file is deleted (job 39). Its override <version>.override.md goes
// too, and releases/changelog/pending.json keeps the items still held back (job 40).
//
//   node scripts/release/record.mjs add --version 1.0.0 --sha <commit> --build 1100 [--dry-run]
//     [--date YYYY-MM-DD] [--channel public] [--stores app_store,play,web]
//     [--notes-de TEXT] [--notes-en TEXT] [--main origin/main] [--file releases/releases.json]
//     [--changelog releases/changelog/<version>.json]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { NoteError, Refusal, closedInPublic, collect, gateOf, loadGates, loadOverride, loadPending, serializePending, staleMessage, staleStoreTexts } from './changelog.mjs';
import { CATEGORIES, CHANNELS, PENDING_FILE, RecordError, compareVersions, dayNumber, isDate, isVersion, parseDraft, parseRecord, serializeRecord } from '../../site/releases.mjs';

const STORES = ['app_store', 'play', 'web'];
const NOREPLY = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i;

const refuse = (message) => {
  throw new Refusal(message);
};

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
  } catch (error) {
    refuse(`git ${args.join(' ')} failed: ${String(error.stderr || error.message).trim()}`);
  }
}

const isAncestor = (ancestor, descendant) => {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', ancestor, descendant], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const commitOf = (ref, flag) => {
  try {
    return execFileSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return refuse(`${flag} ${ref} is not a commit in this repository`);
  }
};

const berlinToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

// Sums `--numstat` lines; binary files ("-") count as changed with 0 lines.
function numstat(lines) {
  const total = { additions: 0, deletions: 0, files: 0 };
  for (const line of lines) {
    const [add, del] = line.split('\t');
    total.files += 1;
    total.additions += add === '-' ? 0 : Number(add);
    total.deletions += del === '-' ? 0 : Number(del);
  }
  return total;
}

// One person per identity: a listed e-mail, else a GitHub noreply login, else the e-mail itself.
function identityResolver(identities) {
  const keyOf = (identity) => (identity.github ? `github:${identity.github.toLowerCase()}` : `email:${identity.emails[0]}`);
  const byEmail = new Map();
  const byLogin = new Map();
  for (const identity of identities) {
    for (const email of identity.emails) byEmail.set(email, identity);
    if (identity.github) byLogin.set(identity.github.toLowerCase(), identity);
  }
  return (name, rawEmail) => {
    const email = rawEmail.trim().toLowerCase();
    const login = NOREPLY.exec(rawEmail.trim())?.[1];
    const known = byEmail.get(email) ?? (login && byLogin.get(login.toLowerCase()));
    if (known) return { key: keyOf(known), name: known.name, github: known.github, bot: known.bot };
    if (login) return { key: `github:${login.toLowerCase()}`, name, github: login, bot: name.endsWith('[bot]') || login.endsWith('[bot]') };
    return { key: email ? `email:${email}` : `name:${name.toLowerCase()}`, name, github: null, bot: name.endsWith('[bot]') };
  };
}

const parsePerson = (value) => {
  const match = /^(.*?)\s*<([^>]*)>\s*$/.exec(value.trim());
  return match ? [match[1], match[2]] : [value.trim(), ''];
};

// Commits, net diff and contributors of `range` (rev-list arguments); `base` is the commit or tree the
// net diff starts from.
function rangeStats(base, sha, range, identities) {
  const resolvePerson = identityResolver(identities);
  const log = git('log', '-M', '--numstat', '--format=%x1e%H%x00%an%x00%ae%x00%(trailers:key=Co-authored-by,valueonly,separator=%x1f)%x00', ...range);
  const contributors = new Map();
  let commits = 0;
  for (const chunk of log.split('\x1e').slice(1)) {
    commits += 1;
    const [, authorName, authorEmail, trailers, rest] = chunk.split('\x00');
    const { additions, deletions } = numstat(rest.split('\n').filter(Boolean));
    const people = [[authorName, authorEmail], ...trailers.split('\x1f').map((t) => t.trim()).filter(Boolean).map(parsePerson)];
    const seen = new Set();
    for (const [name, email] of people) {
      const person = resolvePerson(name, email);
      if (seen.has(person.key)) continue;
      seen.add(person.key);
      const entry = contributors.get(person.key) ?? { name: person.name, github: person.github, commits: 0, additions: 0, deletions: 0, bot: person.bot };
      entry.commits += 1;
      entry.additions += additions;
      entry.deletions += deletions;
      contributors.set(person.key, entry);
    }
  }
  const net = numstat(git('diff', '-M', '--numstat', base, sha).split('\n').filter(Boolean));
  return {
    commits,
    additions: net.additions,
    deletions: net.deletions,
    files_changed: net.files,
    contributors: [...contributors.values()].sort(
      (a, b) => b.commits - a.commits || b.additions - a.additions || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    ),
  };
}

function add(argv) {
  const { values: opts } = parseArgs({
    args: argv,
    strict: true,
    options: {
      version: { type: 'string' },
      sha: { type: 'string' },
      build: { type: 'string' },
      date: { type: 'string' },
      channel: { type: 'string', default: 'public' },
      stores: { type: 'string', default: STORES.join(',') },
      'notes-de': { type: 'string', default: '' },
      'notes-en': { type: 'string', default: '' },
      main: { type: 'string', default: 'origin/main' },
      file: { type: 'string' },
      changelog: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  for (const required of ['version', 'sha', 'build']) if (opts[required] === undefined) refuse(`--${required} is required`);

  const fileLabel = opts.file ?? 'releases/releases.json';
  const file = opts.file ? resolve(opts.file) : resolve(git('rev-parse', '--show-toplevel').trim(), 'releases/releases.json');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (error) {
    refuse(`cannot read ${fileLabel}: ${error.message}`);
  }
  const record = parseRecord(text, fileLabel);

  const { version, channel } = opts;
  if (!CHANNELS.includes(channel)) refuse(`--channel ${channel} is not one of ${CHANNELS.join(', ')}`);
  if (!isVersion(version)) refuse(`--version ${version} is not MAJOR.MINOR.PATCH`);
  const duplicate = record.releases.find((r) => r.version === version);
  if (duplicate) refuse(`--version ${version} is already recorded (${duplicate.channel}, ${duplicate.date})`);
  const previous = record.releases.filter((r) => r.channel === channel).sort((a, b) => compareVersions(a.version, b.version)).at(-1);
  if (previous && compareVersions(version, previous.version) <= 0) refuse(`--version ${version} must be above the newest ${channel} release ${previous.version}`);

  if (!/^\d+$/.test(opts.build) || Number(opts.build) <= 0) refuse(`--build ${opts.build} is not a whole number > 0`);
  const build = Number(opts.build);
  if (previous && build <= previous.build) refuse(`--build ${build} must be above ${previous.version}'s build ${previous.build}`);

  const date = opts.date ?? berlinToday();
  if (!isDate(date)) refuse(`--date ${date} is not a date (YYYY-MM-DD)`);
  if (date < record.project.day_zero) refuse(`--date ${date} is before project.day_zero ${record.project.day_zero}`);
  if (previous && date < previous.date) refuse(`--date ${date} is before ${previous.version}'s date ${previous.date}`);

  const named = opts.stores.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = named.filter((s) => !STORES.includes(s));
  if (unknown.length) refuse(`--stores: unknown store ${unknown.join(', ')} (known: ${STORES.join(', ')})`);
  const stores = Object.fromEntries(STORES.map((s) => [s, named.includes(s)]));

  const sha = commitOf(opts.sha, '--sha');
  const main = commitOf(opts.main, '--main');
  if (!isAncestor(sha, main)) refuse(`--sha ${sha} is not on ${opts.main}; only commits on main are released`);
  const previousSha = previous?.sha ?? null;
  if (previousSha && !isAncestor(previousSha, sha)) refuse(`${previous.version}'s sha ${previousSha} is not an ancestor of ${sha}`);

  const stats = previousSha
    ? rangeStats(previousSha, sha, [`${previousSha}..${sha}`], record.identities)
    : rangeStats(git('hash-object', '-t', 'tree', '/dev/null').trim(), sha, [sha], record.identities);
  // The draft sits next to the record: releases/changelog/<version>.json.
  const dir = join(dirname(file), 'changelog');
  const draftFile = opts.changelog ? resolve(opts.changelog) : join(dir, `${version}.json`);
  const draftLabel = opts.changelog ?? `${dirname(fileLabel)}/changelog/${version}.json`;
  const override = loadOverride(dir, version);
  if (override?.status === 'draft') {
    const why = `${override.label} says "status: draft": its launch text is not approved yet. Peter approves it by removing that line`;
    if (!opts['dry-run']) refuse(`${why}; until then ${version} can't be recorded as a public release`);
    console.warn(`warning: ${why}; without --dry-run this refuses`);
  }
  const gates = loadGates(join(dirname(file), 'flags.json'));
  const pendingBefore = loadPending(dir).items;
  let changelog;
  let draft = null;
  if (existsSync(draftFile)) {
    draft = parseDraft(readFileSync(draftFile, 'utf8'), draftLabel);
    if (draft.version !== version) refuse(`${draftLabel} is the changelog of ${draft.version}, not ${version}`);
    const stale = staleStoreTexts(draft, version, override);
    if (stale.length) refuse(`${staleMessage(draftLabel, stale, version, override)} (edited after the store command?)`);
    const closed = closedInPublic(draft, gates);
    if (closed.length) refuse(`${draftLabel} would publish what is held back; redraft it with --force (or fix releases/flags.json):\n  ${closed.join('\n  ')}`);
    // A draft collected elsewhere or past the release would drop or repeat items.
    if (!isAncestor(draft.generated_from.sha, sha)) {
      refuse(`${draftLabel} was collected up to ${draft.generated_from.sha.slice(0, 7)}, which is not ${sha.slice(0, 7)} or before it; redraft with --sha ${sha} --force`);
    }
    if (!draft.held && pendingBefore.length) refuse(`${draftLabel} has no "held" (a draft from before job 40) while ${PENDING_FILE} has items; redraft it with --force`);
    if (draft.generated_from.previous_sha !== previousSha) {
      console.warn(`warning: ${draftLabel} was collected from ${draft.generated_from.previous_sha?.slice(0, 7) ?? 'the root commit'}, the previous release is ${previousSha?.slice(0, 7) ?? 'none'}`);
    }
    if (draft.generated_from.sha !== sha) {
      console.warn(`warning: ${draftLabel} was collected up to ${draft.generated_from.sha.slice(0, 7)}, the release is ${sha.slice(0, 7)}; commits in between are not in its changelog (their gated items go to ${PENDING_FILE})`);
    }
    changelog = { title: draft.title, items: draft.items, store: draft.store };
  } else if (opts.changelog) {
    refuse(`--changelog ${opts.changelog} does not exist`);
  } else if (override) {
    refuse(`${override.label} has the store texts of ${version}, but there is no ${draftLabel}; run: node scripts/release/changelog.mjs draft --version ${version} --sha ${sha}`);
  } else {
    console.warn(`warning: no ${draftLabel}, so ${version} has no changelog (hummlist.com shows "Bug fixes and improvements.")`);
  }

  const pendingAfter = heldAfter({ draft, draftLabel, pendingBefore, previousSha, sha, gates });

  const entry = {
    version,
    channel,
    date,
    day: dayNumber(record.project.day_zero, date),
    build,
    sha,
    previous_sha: previousSha,
    stores,
    stats,
    notes: { de: opts['notes-de'], en: opts['notes-en'] },
    ...(changelog ? { changelog } : {}),
  };

  const after = serializeRecord({ ...record, releases: [...record.releases, entry] });
  parseRecord(after, `${fileLabel} with ${version}`);
  if (opts['dry-run']) {
    console.log(JSON.stringify(entry, null, 2));
    console.log(`${PENDING_FILE}: ${pendingAfter.length} items held back after ${version} (now ${pendingBefore.length})`);
    console.log(`dry run: ${fileLabel} not changed${changelog ? `, ${draftLabel} kept` : ''}`);
    return;
  }
  writeFileSync(file, after);
  if (changelog) {
    rmSync(draftFile);
    console.log(`moved the changelog from ${draftLabel} into the record`);
  }
  if (override) {
    rmSync(override.file);
    console.log(`removed ${override.label}: its title and store texts are in the record`);
  }
  if (pendingAfter.length || pendingBefore.length || existsSync(join(dir, PENDING_FILE))) {
    writeFileSync(join(dir, PENDING_FILE), serializePending({ items: pendingAfter }));
    console.log(`${PENDING_FILE}: ${pendingAfter.length} items held back after ${version} (was ${pendingBefore.length})`);
  }
  console.log(`recorded ${version} (day ${entry.day}, ${stats.commits} commits, ${stats.contributors.length} contributors)`);
}

// pending.json after the release: what the reviewed draft held back, plus the gated items of
// commits it never saw (merged after its sha, or the whole range without a draft), which the next
// draft looks at. pending.json is written here and not by the draft command, so a draft that is
// thrown away loses nothing; every item pending before must be either published by the draft or
// held by it (DECISIONS, "Job 40").
function heldAfter({ draft, draftLabel, pendingBefore, previousSha, sha, gates }) {
  const key = (i) => `${i.sha}\0${i.flag ?? ''}\0${i.hold ?? ''}`;
  // The draft's dedupe by sentence (a reverted and relanded PR) applies to pending.json too.
  const text = (i) => `${i.de}\n${i.en}`;
  pendingBefore = pendingBefore.filter((i, n) => pendingBefore.findIndex((j) => text(j) === text(i)) === n);
  let base = pendingBefore;
  let from = previousSha;
  if (draft) {
    from = draft.generated_from.sha;
    // A job 39 draft has no `held`: it saw no gates, so pending.json stays as it is.
    if (draft.held) {
      base = draft.held;
      const accounted = [...draft.held, ...CATEGORIES.flatMap((c) => draft.items[c]).filter((i) => i.flag || i.hold)].map(key);
      const lost = pendingBefore.filter((i) => {
        const at = accounted.indexOf(key(i));
        if (at >= 0) accounted.splice(at, 1);
        return at < 0;
      });
      if (lost.length) {
        refuse(`${draftLabel} neither publishes nor holds ${lost.length} item(s) of ${PENDING_FILE}, which would be lost: ${lost.map((i) => `"${i.en}" (${i.sha.slice(0, 7)})`).join(', ')}; put them back under "held", or redraft with --force`);
      }
    }
  }
  if (from === sha) return base;
  const late = [];
  for (const item of collect({ previous: from, sha })) {
    let matched;
    try {
      ({ matched } = gateOf(item, gates));
    } catch (error) {
      if (error instanceof NoteError) refuse(`${item.sha.slice(0, 7)} "${item.en}": ${error.message}`);
      throw error;
    }
    if (!item.flag && !item.hold && !matched) continue;
    late.push({ category: item.category, de: item.de, en: item.en, flag: item.flag ?? null, hold: item.hold ?? matched?.key ?? null, pr: item.pr, sha: item.sha });
  }
  if (late.length) console.warn(`warning: ${late.length} gated item(s) merged after ${draft ? `${draftLabel} was collected` : 'the previous release'} wait in ${PENDING_FILE} for the next draft`);
  const seen = new Set(base.map(text));
  return [...base, ...late.filter((i) => !seen.has(text(i)) && seen.add(text(i)))];
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command !== 'add') refuse(`unknown command ${command ?? '(none)'}; usage: record.mjs add --version X --sha S --build N [--dry-run]`);
  add(rest);
} catch (error) {
  if (!(error instanceof Refusal || error instanceof RecordError || error instanceof NoteError || error.code?.startsWith('ERR_PARSE_ARGS'))) throw error;
  console.error(`record: ${error.message}`);
  process.exit(1);
}
