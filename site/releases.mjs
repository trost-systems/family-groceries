// The public release record, releases/releases.json (releases/README.md): its format, checked here
// for the site build, the site tests and scripts/release/record.mjs, which writes it.

export const CHANNELS = ['public'];
const STORES = ['app_store', 'play', 'web'];
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SHA = /^[0-9a-f]{40}$/;

export class RecordError extends Error {}

export const isVersion = (value) => typeof value === 'string' && SEMVER.test(value);

// Strict MAJOR.MINOR.PATCH only: store versions have no pre-release or build part.
export function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

export const isDate = (value) =>
  typeof value === 'string' && DATE.test(value) && !Number.isNaN(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);

// Day 0 is project.day_zero, the date of the repository's first commit.
export const dayNumber = (dayZero, date) => Math.round((Date.parse(date) - Date.parse(dayZero)) / 86_400_000);

const sortReleases = (releases) => [...releases].sort((a, b) => compareVersions(a.version, b.version));

function checker(source) {
  const fail = (path, reason) => {
    throw new RecordError(`${source}: ${path}: ${reason}`);
  };
  const object = (value, path, keys) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(path, 'must be an object');
    for (const key of Object.keys(value)) if (!keys.includes(key)) fail(`${path}.${key}`, `unknown field (allowed: ${keys.join(', ')})`);
    for (const key of keys) if (!(key in value)) fail(`${path}.${key}`, 'missing');
    return value;
  };
  const array = (value, path) => (Array.isArray(value) ? value : fail(path, 'must be an array'));
  const string = (value, path) => (typeof value === 'string' ? value : fail(path, 'must be a string'));
  const nullableString = (value, path) => (value === null || typeof value === 'string' ? value : fail(path, 'must be a string or null'));
  const boolean = (value, path) => (typeof value === 'boolean' ? value : fail(path, 'must be true or false'));
  const count = (value, path) => (Number.isInteger(value) && value >= 0 ? value : fail(path, `must be a whole number >= 0, got ${JSON.stringify(value)}`));
  const matches = (ok, value, path, what) => (ok ? value : fail(path, `must be ${what}, got ${JSON.stringify(value)}`));
  return { fail, object, array, string, nullableString, boolean, count, matches };
}

// Parses and checks the record; throws RecordError naming `source` and the bad field.
export function parseRecord(text, source = 'releases/releases.json') {
  const c = checker(source);
  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    throw new RecordError(`${source}: not valid JSON (${error.message})`);
  }
  c.object(data, '$', ['project', 'identities', 'releases']);
  const project = c.object(data.project, 'project', ['name', 'repo', 'day_zero']);
  c.matches(project.name === 'Hummlist', project.name, 'project.name', '"Hummlist"');
  c.matches(/^[\w.-]+\/[\w.-]+$/.test(c.string(project.repo, 'project.repo')), project.repo, 'project.repo', 'owner/name');
  c.matches(isDate(project.day_zero), project.day_zero, 'project.day_zero', 'a date (YYYY-MM-DD)');

  const emails = new Map();
  c.array(data.identities, 'identities').forEach((identity, i) => {
    const path = `identities[${i}]`;
    c.object(identity, path, ['name', 'github', 'bot', 'emails']);
    c.string(identity.name, `${path}.name`);
    c.nullableString(identity.github, `${path}.github`);
    c.boolean(identity.bot, `${path}.bot`);
    c.array(identity.emails, `${path}.emails`).forEach((email, j) => {
      c.matches(typeof email === 'string' && email === email.toLowerCase() && email.includes('@'), email, `${path}.emails[${j}]`, 'a lower-case e-mail address');
      if (emails.has(email)) c.fail(`${path}.emails[${j}]`, `${email} is also listed under ${emails.get(email)}`);
      emails.set(email, path);
    });
  });

  const releases = c.array(data.releases, 'releases');
  const previous = {};
  releases.forEach((release, i) => {
    const path = `releases[${i}]`;
    c.object(release, path, ['version', 'channel', 'date', 'day', 'build', 'sha', 'previous_sha', 'stores', 'stats', 'notes']);
    c.matches(isVersion(release.version), release.version, `${path}.version`, 'a version MAJOR.MINOR.PATCH');
    c.matches(CHANNELS.includes(release.channel), release.channel, `${path}.channel`, `one of ${CHANNELS.join(', ')}`);
    c.matches(isDate(release.date), release.date, `${path}.date`, 'a date (YYYY-MM-DD)');
    c.matches(release.day === dayNumber(project.day_zero, release.date), release.day, `${path}.day`, `${dayNumber(project.day_zero, release.date)} (days from project.day_zero to date)`);
    c.matches(release.day >= 0, release.date, `${path}.date`, `on or after project.day_zero ${project.day_zero}`);
    c.matches(Number.isInteger(release.build) && release.build > 0, release.build, `${path}.build`, 'a whole number > 0');
    c.matches(SHA.test(c.string(release.sha, `${path}.sha`)), release.sha, `${path}.sha`, 'a full commit sha (40 hex)');
    c.object(release.stores, `${path}.stores`, STORES);
    for (const store of STORES) c.boolean(release.stores[store], `${path}.stores.${store}`);
    const stats = c.object(release.stats, `${path}.stats`, ['commits', 'additions', 'deletions', 'files_changed', 'contributors']);
    for (const key of ['commits', 'additions', 'deletions', 'files_changed']) c.count(stats[key], `${path}.stats.${key}`);
    c.array(stats.contributors, `${path}.stats.contributors`).forEach((person, j) => {
      const at = `${path}.stats.contributors[${j}]`;
      c.object(person, at, ['name', 'github', 'commits', 'additions', 'deletions', 'bot']);
      c.string(person.name, `${at}.name`);
      c.nullableString(person.github, `${at}.github`);
      for (const key of ['commits', 'additions', 'deletions']) c.count(person[key], `${at}.${key}`);
      c.boolean(person.bot, `${at}.bot`);
    });
    const notes = c.object(release.notes, `${path}.notes`, ['de', 'en']);
    c.string(notes.de, `${path}.notes.de`);
    c.string(notes.en, `${path}.notes.en`);

    const prev = previous[release.channel];
    if (prev) {
      if (compareVersions(release.version, prev.version) <= 0) c.fail(`${path}.version`, `${release.version} must be above ${prev.version}; releases are sorted by version, oldest first, and versions are unique`);
      if (release.date < prev.date) c.fail(`${path}.date`, `${release.date} is before ${prev.version}'s date ${prev.date}`);
      if (release.build <= prev.build) c.fail(`${path}.build`, `${release.build} must be above ${prev.version}'s build ${prev.build}`);
      c.matches(release.previous_sha === prev.sha, release.previous_sha, `${path}.previous_sha`, `${prev.version}'s sha ${prev.sha}`);
    } else {
      c.matches(release.previous_sha === null, release.previous_sha, `${path}.previous_sha`, `null (the first ${release.channel} release counts from the root commit)`);
    }
    previous[release.channel] = release;
  });
  return data;
}

export function serializeRecord(record) {
  return `${JSON.stringify({ ...record, releases: sortReleases(record.releases) }, null, 2)}\n`;
}

// Public releases, oldest first.
export const publicReleases = (record) => sortReleases(record.releases.filter((r) => r.channel === 'public'));
