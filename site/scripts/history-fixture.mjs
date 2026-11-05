// Builds the site against the fixture release record test/fixtures/history-record.json (three
// public releases, job 105), so /history can be looked at and run through checks/ before there is
// a public release. The real content, the real flags; only the record is the fixture's.
//
//   node scripts/history-fixture.mjs [outDir]     # default dist-history/ (git-ignored), then e.g.
//   cd checks && node crawl.mjs ../dist-history && node contrast.mjs ../dist-history --pages /history,/en/history
import { cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from '../build.mjs';

const SITE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = join(SITE_DIR, '..');
export const HISTORY_FIXTURE = join(SITE_DIR, 'test/fixtures/history-record.json');

const outDir = resolve(process.argv[2] ?? join(SITE_DIR, 'dist-history'));
const repo = mkdtempSync(join(tmpdir(), 'hummlist-history-'));
try {
  for (const rel of ['releases/flags.json', 'app/pubspec.yaml', 'docs/api/openapi.yaml']) {
    mkdirSync(dirname(join(repo, rel)), { recursive: true });
    cpSync(join(REPO_DIR, rel), join(repo, rel));
  }
  cpSync(HISTORY_FIXTURE, join(repo, 'releases/releases.json'));
  const { routes, live } = build({ outDir, repoDir: repo, env: { VERCEL_ENV: process.env.VERCEL_ENV } });
  console.log(`live version: ${live.live} (from the fixture record)`);
  console.log(`built ${routes.length} pages into ${outDir}`);
} finally {
  rmSync(repo, { recursive: true, force: true });
}
