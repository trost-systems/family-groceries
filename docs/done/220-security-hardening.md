# Job 220: security hardening, RLS, functions, secrets, dependencies, CI permissions (2026-11-13)

PRs:

- https://github.com/trost-systems/snacklist/pull/416 (merged as aa953203): database grants
- https://github.com/trost-systems/snacklist/pull/417 (merged as f96fe553): MCP sign-in limit, Alexa chain cache
- https://github.com/trost-systems/snacklist/pull/418 (merged as 8602c629): locked dependency versions
- https://github.com/trost-systems/snacklist/pull/421 (merged as 986d3e6d): workflow permissions, secrets per step, environments, no Actions cache next to secrets

The review found no way for a caller to read or write another household's data, to skip a
signature or webhook check, or to obtain a token or a secret. What it found are second lines that
were open, availability gaps on unauthenticated routes, and secrets that any pushed branch can
read. The last one needs repository settings: `docs/NEEDS_PETER.md`, "Job 220".

## How it was reviewed

Read-only, on main at `9efe6c19`, against this job's local stack and GitHub's read API. No
production request, no secret value read or printed.

- **Database.** Catalog queries on the local stack with every migration applied (tables without
  RLS, tables with RLS and no policy, every policy's expression, grants to `anon` and
  `authenticated`, owners, default privileges, definer functions and their `search_path`). A fuzz
  called every function in `public` four ways (386 calls): as a member, as a signed-in outsider
  with the other household's ids, with the caller's own household and the other one's ids mixed,
  and signed out. No call outside the household returned or changed its rows. Four returned calls
  were flagged and read by hand: `create_list` in the caller's own household, and
  `insert_before_fallback`, which returns the ids it was given.
- **Edge functions.** One delegate read all eight functions and `mcp-proxy/`, probed the local
  stack without credentials, and proved its findings with fakes and with SQL in rolled-back
  transactions.
- **CI and secrets.** One delegate read every workflow and composite action, the repository's
  Actions and security settings through `gh api` GETs (secret names only), and ran gitleaks over
  all refs (972 commits, no leak) and actionlint (clean).
- **Dependencies.** One delegate checked every manifest and lockfile, `npm audit` on lockfile
  copies, and 377 exact locked versions against the OSV API.

## What shipped

- **Database grants (#416).** `authenticated` loses `TRUNCATE`, `REFERENCES` and `TRIGGER` on
  every public table, both client roles lose every privilege on the three sequences, three
  functions stop being executable signed out, and new tables and sequences start with nothing
  granted to the client roles. Row level security does not cover `TRUNCATE`, and `setval` makes
  later inserts collide. PostgREST offers neither, so nothing was reachable: this closes a second
  line. `supabase/tests/least_privilege.test.sql` has 9 tests, 6 fail without the migration.
- **MCP sign-in (#417).** Strangers could use up the hourly document-fetch limits (about 600
  anonymous requests, or 30 naming one host), and then every client whose cached document had
  gone stale got 503 instead of the consent page until the hour ended. A URL that is a client
  already now has its own limit, which only failing fetches fill. The price, stated in
  `docs/MCP.md` and under "What remains": the old overall limit of 600 fetches an hour no longer
  covers known clients.
- **Alexa chain cache (#417).** The cache keyed on the whole URL, so a new query string per
  request made the function fetch the chain again and keep another copy for the worker's life. It
  now keys on host and path, fetches without the query and keeps at most 16 chains. Which URLs are
  accepted is unchanged.
- **Locked dependencies (#418).** The Gradle wrapper checks its download's sha256, three gates
  run `flutter pub get --enforce-lockfile`, three gates run Deno with `--frozen`, every CI job
  installs the Deno of `.dvmrc`, and the edge functions' import map names exact versions. The
  lint check `pinned-deps` keeps the wrapper and the import map that way, and fails the other
  ways to a package it knows: a second import map, a workspace or a `package.json`, a URL in the
  map, `npm:<name>` or `jsr:<name>` anywhere in a function's source (pragmas included), and a URL
  after `from` or `import`. No version moved.
- **Workflows (#421).** Three jobs that need no token get `permissions: {}`, two workflows drop
  an unused `contents: read`, the RevenueCat deletion secret is read in one step and no longer on
  curl's command line, and the three scheduled production jobs name the environment `ops`. The
  store release (`plan`, `ios`, `android`) and `certificates.yml` restored a Flutter SDK and a
  gem directory from the Actions cache in the jobs that hold the signing secrets, and any job
  that runs on `main` can save a cache entry. They now pass `cache: false` and install the gems
  from `Gemfile.lock` in a step. Measured on the release runs of 13 and 14 November (10 before
  the merge, 6 after, medians): `plan` 32 s to 55 s, `android` 572 s to 564 s, `ios` 858 s to
  986 s. `plan` is slower by about 23 s; the `ios` job ranged from 719 s to 1,576 s before
  the change, so its difference may be chance. The lint check
  `scripts/workflow-hardening.ts` enforces four rules: actions pinned by commit SHA, secrets read
  only in a step, an environment on every job that reads a secret, and no Actions cache in a job
  that reads a secret, names an environment or whose token may write. On main's workflows it
  reported 16 findings. 12 are fixed; 4 are in `supabase-deploy.yml`, behind three entries of
  the check's allow-list (below).

## What remains

### For Peter (repository settings)

`docs/NEEDS_PETER.md`, "Job 220". In short: limit the environment `ops` to `main` and move the
database password and the deletions secret into it, add a ruleset for `main`, and
turn on secret scanning with push protection and Dependabot alerts. Until the secrets move, a
workflow file on any pushed branch can read the production database password.

### In files other jobs own

- **`.github/workflows/supabase-deploy.yml` (job 209).** Its `deploy` job reads
  `SUPABASE_ACCESS_TOKEN` from the job's `env:` and names no environment, so the token has to
  stay a repository secret and every step and action of the job gets it. One of those actions is
  `supabase/setup-cli`, which restores the `bun` binary it then runs from the Actions cache (a CI
  log of this repo shows "Using a cached version of Bun"), and any job that runs on `main` can
  save a cache entry. The "main only" rule is a shell test inside the file, which a branch copy
  leaves out. The workflow also installs Deno `v2.x` and runs `migrate.ts` without `--frozen`,
  and it deploys on a push to `main` without waiting for `ci-ok`.
  `scripts/workflow-hardening.allow.json` holds three entries for that job: `secret-in-step` and
  `secret-needs-environment` (both for `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF`) and
  `no-cache-in-trusted-job` (for `supabase/setup-cli`). To close them: move the two secrets to
  the `env:` of the steps that call the Management API, install the CLI in a step that restores
  no cache (a pinned release download, checked against its sha256), add `environment: ops` to the job, move the token into the environment
  (NEEDS_PETER, Job 220, step 3), and delete the entries. The lint gate fails on a stale entry,
  so none can be forgotten. The same action runs in the db and e2e setup actions, in jobs without
  secrets and with a read-only token, which the rule allows.
- **Edge function deploy and `deno.lock`.** `supabase functions deploy --use-api` most likely
  does not send the lockfile, so ranges inside packages resolve at deploy time. Likely, not
  proven: it needs a look at what the hosted bundler resolved.
- **`supabase/functions/voice/handler.ts` (jobs 207 and 213).** The body is read without a size
  limit before the caller is authenticated.
- **`supabase/functions/alexa/handler.ts` (PR #405).** The body is read without a size limit
  before the signature check.

### Recorded, not done

Each of these is real and small. None was worth a change that this job could prove safe today.

- **MCP.** `/mcp/oauth/token` reads its body without a size limit. `oauth_cimd_rate` takes one
  row per caller-chosen key for two hours, has no index on `window_start` and no scheduled purge;
  a `token:all` ceiling was rejected because whoever fills it locks everyone out. A known
  client's refetch count has no fixed number while its document is stale (measured: 44 to 122
  fetches for 1,500 requests). Someone who registers URLs on names of their own can have each
  fetched at another public address, one fetch per request: 30 times in a row, or about 29 times
  every 5 minutes with one working fetch in between (about 350 an hour per URL, for requests
  sent one after another; main stopped at 600 an hour in all). Three review rounds weighed
  mechanisms that would bound it and found none worth its cost (DECISIONS, Job 220). A key `fetch:<url>` can be as long as the URL. A `client_id` on the
  host `all` shares the key `fetch:all`. The CIMD integration file can run about 5 times an hour
  per stack before its own limits answer 503.
- **Alexa.** Percent-encoded spellings of one chain path are separate cache entries (memory stays
  capped at 16). Not checked against S3.
- **iOS.** No `Package.resolved` is tracked, so the store build resolves posthog-ios,
  GoogleSignIn-iOS and CwlCatchException within their ranges on every build. The file has to come
  from a macOS build, and `scripts/gates/ios.sh` would then fail when a build changes it.
- **pub.** The store lanes in `app/fastlane/Fastfile` and the `android` and `ios` gates rely on
  the implicit `pub get` of `flutter build`, which does not enforce the lock.
  `scripts/gates/db.sh` runs Deno unfrozen (PR #405 edits it).
- **Downloads without a checksum.** The PGDG apt key in `scripts/backup/install-tools.sh` (the
  job that holds the database password), `npx @posthog/cli@0.19.0` in `scripts/vercel.sh` (its
  postinstall downloads a binary), the CI tools in `scripts/ci/install-tools.sh`, and
  `scripts/bootstrap.sh` on the dev box.
- **Dependabot.** It watches `github-actions`, `pub` in `/app` and `npm` in `/e2e`. Not watched:
  `bundler` in `/app` (fastlane runs with the signing secrets), `npm` in `/site`, `/site/checks`
  and `/emails`, `pub` in `/app/widgetbook`, Gradle. Alerts (NEEDS_PETER) need no configuration and cover the
  manifests GitHub's dependency graph reads; whether that includes Gradle and `deno.lock` here
  was not checked.
- **Known advisories.** All in dev, CI or release tooling, none reachable: `addressable` 2.9.0
  and `activesupport` 7.2.4 in `app/Gemfile.lock`, `glob` and `minimatch` under lighthouse in
  `site/checks`, `deepmerge` in `emails`, `ajv` 8.17.1 in the fg CLI, `undici` under
  `marketing/videos`. Nothing shipped has one. No bump was made: none could be justified by reach,
  and `addressable` 2.9.1 would need a release run to prove.
- **Workflows.** `public-release-record.yml` holds `contents: write` in dry runs too. The nightly
  database dump is a public artifact for 90 days, encrypted to one age key (documented in
  `docs/BACKUP.md`). `release.yml`'s comment that signing secrets reach "the fastlane steps only"
  overstates it: a step can read the runner's memory. The `workflow-hardening` check reads local
  actions at `.github/actions/<name>/action.yml` only and does not look at `container:`,
  `services:` or an action's `runs.image` (the repo has none of these). Its cache rule knows the
  actions this repo uses that cache unless told not to (`actions/setup-node`,
  `oven-sh/setup-bun`, `supabase/setup-cli`, the local `deno` action), not every such action
  (`actions/setup-go` and Gradle's setup action do too), and it trusts the local `deno` action to
  honour `cache: false`. It finds a cache input by its name (`cache`, a name ending in `-cache`,
  or setup-java's `cache-jdk`): an input that turns a cache on under another name passes until it
  is listed. `action-pinned` reads this repo's files, not the actions an action calls:
  `subosito/flutter-action`, pinned here, calls `actions/cache@v5` by tag (in the steps
  `cache: false` skips), so GitHub's own "pinned to a full-length commit SHA" setting cannot go
  on yet (NEEDS_PETER, Job 220, step 6).
- **Dependency checks.** `pinned-deps` finds a specifier in a source file by pattern, not with a
  parser. These pass: one put together from pieces at run time, one spelled with an escape JSON
  does not have, an `https:` or `data:` URL behind a comment or in a variable that reaches
  `import()` later, a module file without an extension (not read by the check, followed by
  Deno), and a URL in a `@ts-self-types` pragma. The other way round, `npm:<name>` in a comment or a text fails and has to be
  reworded. `"lock": false` in a
  `deno.json` would make `--frozen` do nothing; no directory has it and no check asks. The gates
  send pub's standard output to `/dev/null`, so a refused lock shows pub's error but not the
  list of what would change.
- **Not checked.** The hosted gateway's header handling, Vercel project settings, the Google
  Cloud side of the Play OIDC binding, organization-level Actions settings (403), and gitleaks'
  coverage of vendor token formats beyond its default rules.

## Verification

Every PR: `scripts/verify.sh --only gitleaks,lint` (and the gates its files touch) green before
each push, a review by a fresh `claude-fable-5-2` delegate until PASS, `ci-ok` green on the
commit that merged. The review rounds and their cost are in
`docs/hillclimb/fable-improvement-2026-11.md`.

- **#416.** `supabase/tests/least_privilege.test.sql`: 9 pass, 6 fail on main's schema without
  the migration. Review: PASS in one round. CI run 43513709741 on `cad27164`. After the merge:
  Supabase deploy run 43517308617 logged "applied 20261113190206_least_privilege_grants" and its
  smoke test passed (health 200, voice 401 on a bad token, MCP discovery).
- **#417.** 3 new Deno tests, each failing on main's code. Review: FAIL, FAIL, FAIL, PASS. CI run
  43527696967 on `91e0ebf3`. After the merge: main's CI run 43530340347 green; Supabase deploy
  run 43530340532 deployed the eight functions and its smoke test passed.
- **#421.** 32 Deno tests of the check; 28 of 28 mutations of it fail a test. Review: FAIL, PASS,
  FAIL (the cache rule, reviewed on its own before it was folded in), FAIL, PASS. The probe run
  43497861772 showed that a job with `environment: {name: ops, deployment: false}` starts and
  leaves no deployment record. CI run 43530355423 on `8e1a68c1`. After the merge: main's CI run
  43533555415 green, and six release runs with the cache-free `plan`, `ios` and `android` jobs succeeded (the first
  43536540280, the latest 43561228988).
- **#418.** 62 Deno tests of the check; 37 of 37 mutations fail a test. A probe showed that
  `deno lint` passes a `@jsxImportSource npm:preact@^10` pragma which `deno info` resolves, and
  that `pinned-deps` fails it. Review: PASS, FAIL, FAIL, FAIL, PASS. The rebase onto #421 kept
  both PRs' lines in `AGENTS.md` and `scripts/lint.sh`; gates `gitleaks,lint,functions` green on
  it. CI run 43579112903 on `fd82a351`. After the merge: Supabase deploy run 43581231552 deployed
  the nine functions from the exact-version import map and its smoke test passed (health, voice,
  MCP discovery, Alexa without a signature, purchases).

Scheduled jobs in the environment `ops`: the nightly backup ran after the merge (run
43579735166, green: the job got the database password, and `ops` has no deployment record). Not
seen yet when this was written: the first scheduled runs of `revenuecat-delete.yml` and
`price-drift.yml` after the merge (daily; price drift fails with "SKIPPED" until its secrets
exist, NEEDS_LEAD Job 49), and a `certificates.yml` run, which is started by hand. To check:
`gh run list --event schedule --limit 10`.

## Ops

- Nothing was changed in the repository's settings and nothing was run against production.
- The environment `ops` exists on GitHub, empty and without rules: the probe run for #421
  created it. Both probe branches are deleted, and so is the one failed deployment record the refused
  probe run left in `release`.
- #416's migration is applied in production. NEEDS_PETER (Job 220, step 8) has a read-only
  query that shows whether the hosted project's migration role owns the default privileges the
  migration set; nobody has run it yet.

No user-facing change, no flag. Changelog: none.
