#!/usr/bin/env node
// Adds a public release to releases/releases.json (releases/README.md), with its stats from git.
// Run by .github/workflows/public-release-record.yml; plain node, no packages. The reviewed
// changelog draft releases/changelog/<version>.json, if there is one, goes into the entry as
// `changelog`, and the draft file is deleted (job 39).
//
//   node scripts/release/record.mjs add --version 1.0.0 --sha <commit> --build 1100 [--dry-run]
//     [--date YYYY-MM-DD] [--channel public] [--stores app_store,play,web]
//     [--notes-de TEXT] [--notes-en TEXT] [--main origin/main] [--file releases/releases.json]
//     [--changelog releases/changelog/<version>.json]

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { staleStoreTexts } from './changelog.mjs';
import { CHANNELS, RecordError, compareVersions, dayNumber, isDate, isVersion, parseDraft, parseRecord, serializeRecord } from '../../site/releases.mjs';

const STORES = ['app_store', 'play', 'web'];
const NOREPLY = /^(?:\d+\+)?([^@]+)@users\.noreply\.github\.com$/i;

class Refusal extends Error {}
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
  const draftFile = opts.changelog ? resolve(opts.changelog) : join(dirname(file), 'changelog', `${version}.json`);
  const draftLabel = opts.changelog ?? `${dirname(fileLabel)}/changelog/${version}.json`;
  let changelog;
  if (existsSync(draftFile)) {
    const draft = parseDraft(readFileSync(draftFile, 'utf8'), draftLabel);
    if (draft.version !== version) refuse(`${draftLabel} is the changelog of ${draft.version}, not ${version}`);
    const stale = staleStoreTexts(draft, version);
    if (stale.length) refuse(`${draftLabel}: the store texts ${stale.join(', ')} are not what its title and items give (edited after the store command?); run: node scripts/release/changelog.mjs store --version ${version}`);
    if (draft.generated_from.previous_sha !== previousSha) {
      console.warn(`warning: ${draftLabel} was collected from ${draft.generated_from.previous_sha?.slice(0, 7) ?? 'the root commit'}, the previous release is ${previousSha?.slice(0, 7) ?? 'none'}`);
    }
    if (draft.generated_from.sha !== sha) {
      console.warn(`warning: ${draftLabel} was collected up to ${draft.generated_from.sha.slice(0, 7)}, the release is ${sha.slice(0, 7)}; commits in between are not in its changelog`);
    }
    changelog = { title: draft.title, items: draft.items, store: draft.store };
  } else if (opts.changelog) {
    refuse(`--changelog ${opts.changelog} does not exist`);
  } else {
    console.warn(`warning: no ${draftLabel}, so ${version} has no changelog (hummlist.com shows "Bug fixes and improvements.")`);
  }

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
    console.log(`dry run: ${fileLabel} not changed${changelog ? `, ${draftLabel} kept` : ''}`);
    return;
  }
  writeFileSync(file, after);
  if (changelog) {
    rmSync(draftFile);
    console.log(`moved the changelog from ${draftLabel} into the record`);
  }
  console.log(`recorded ${version} (day ${entry.day}, ${stats.commits} commits, ${stats.contributors.length} contributors)`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command !== 'add') refuse(`unknown command ${command ?? '(none)'}; usage: record.mjs add --version X --sha S --build N [--dry-run]`);
  add(rest);
} catch (error) {
  if (!(error instanceof Refusal || error instanceof RecordError || error.code?.startsWith('ERR_PARSE_ARGS'))) throw error;
  console.error(`record: ${error.message}`);
  process.exit(1);
}
