/** fg scenario list|show, fg seed [<scenario>], fg runs, fg teardown: the CLI side of cli/fixtures.ts. */

import { type Command, type Ctx, FgError, int, str, usage } from './core.ts';
import {
  checkRunId,
  currentRunPath,
  findRuns,
  newFixtureRunId,
  publicView,
  readManifest,
  seedScenario,
  STALE_HOURS,
  type TeardownResult,
  teardownRun,
} from './fixtures.ts';
import { expectedCounts, listScenarios, loadScenario, plan } from './scenario.ts';
import { seed as seedBaseline, stackEnv } from './stack.ts';
import { Api, resolveTarget, type Target, targetFlag, type TargetKind } from './target.ts';

const targetOf = (args: { flags: Record<string, string | boolean | undefined> }) =>
  ((args.flags.target as string | undefined) ?? 'local') as TargetKind;

/** Signals that end a command early: Ctrl-C, `kill`/`timeout`/a CI cancel, a closed terminal. */
export const STOP_SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;
export type StopSignal = typeof STOP_SIGNALS[number];
const EXIT_CODE: Record<StopSignal, number> = { SIGINT: 130, SIGTERM: 143, SIGHUP: 129 };

/** Process hooks, injectable so tests can send a signal and replace the teardown. */
export interface StopHooks {
  /** Calls onSignal for each stop signal until the returned function removes the listeners. */
  listen(onSignal: (sig: StopSignal) => void): () => void;
  teardown(): Promise<unknown>;
}

const realListen = (onSignal: (sig: StopSignal) => void) => {
  const handlers = STOP_SIGNALS.map((sig) => [sig, () => onSignal(sig)] as const);
  for (const [sig, h] of handlers) Deno.addSignalListener(sig, h);
  return () => {
    for (const [sig, h] of handlers) Deno.removeSignalListener(sig, h);
  };
};

/**
 * Runs fn with an AbortSignal and stops it cleanly.
 *
 * A stop signal (SIGINT, SIGTERM, SIGHUP) aborts the signal: a seeding loop
 * stops at its next request, and the lock wait, a build and the browser
 * driver are killed. fn's own cleanup (server, lock, config file) runs as it
 * unwinds. Then the run is torn down when `seeded()` says there is something
 * to remove, and an `interrupted` error carries the signal's exit code
 * (130/143/129) to main, which prints it as the command's JSON. A failure
 * tears down the same way. A hard kill (SIGKILL) cannot be caught: `fg runs`
 * and `fg teardown --stale` find what it leaves.
 */
export async function withTeardownOnFailure<T>(
  ctx: Ctx,
  t: Target,
  run: string,
  seeded: () => boolean,
  fn: (signal: AbortSignal) => Promise<T>,
  hooks: Partial<StopHooks> = {},
): Promise<T> {
  const listen = hooks.listen ?? realListen;
  const teardown = hooks.teardown ?? (() => teardownRun({ ...ctx, dryRun: false }, t, run));
  const controller = new AbortController();
  let caught: StopSignal | null = null;
  const cleanup = async (why: string): Promise<boolean> => {
    if (!seeded()) return false;
    ctx.log(`${why}: tearing down run ${run} on the ${t.label}`);
    return await teardown().then(() => true, (e) => {
      ctx.log(
        `TEARDOWN AFTER ${why.toUpperCase()} FAILED: ${(e as Error).message}. Run \`fg teardown ${run}${
          t.kind === 'hosted' ? ' --target hosted' : ''
        }\`.`,
      );
      return false;
    });
  };
  const stopListening = listen((sig) => {
    if (caught) return;
    caught = sig;
    ctx.log(`${sig}: stopping (killing the lock wait, build or browser; seeding stops at its next request)`);
    controller.abort();
  });
  try {
    return await fn(controller.signal);
  } catch (e) {
    if (!caught) {
      await cleanup('failure');
      throw e;
    }
    const sig: StopSignal = caught;
    const tornDown = await cleanup(sig);
    throw new FgError(
      'interrupted',
      `Stopped by ${sig}${
        tornDown ? `; run ${run} was torn down` : seeded() ? `; tearing down run ${run} failed` : '; nothing was seeded yet'
      }.`,
      tornDown || !seeded() ? 'Nothing is left behind.' : `Run \`fg teardown ${run}${t.kind === 'hosted' ? ' --target hosted' : ''}\`.`,
      EXIT_CODE[sig],
      { signal: sig, run, tornDown },
    );
  } finally {
    stopListening();
  }
}

const olderThan = { name: 'older-than', help: `Hours after which a run counts as stale (default ${STALE_HOURS}).` };

export const fixtureCommands: Command[] = [
  {
    name: 'scenario list',
    summary: 'List the test scenarios in test/fixtures/scenarios with what each is good for.',
    usage: 'fg scenario list',
    description:
      'Validates every scenario file against test/fixtures/scenario.schema.json and prints name, summary, goodFor, users and the row counts seeding produces. A broken file fails with bad_scenario naming the field.',
    examples: ['fg scenario list', "fg scenario list | jq -r '.scenarios[].name'"],
    async run(ctx) {
      const now = new Date();
      const scenarios = (await listScenarios(ctx.sh, ctx.inst.repo)).map((s) => ({
        name: s.name,
        summary: s.summary,
        goodFor: s.goodFor ?? [],
        users: s.users.map((u) => u.handle),
        counts: expectedCounts(plan(s, now)),
      }));
      return { count: scenarios.length, scenarios, next: 'fg scenario show <name>; fg seed <name>' };
    },
  },
  {
    name: 'scenario show',
    summary: 'Show one scenario resolved against now: users, households, items, trips with absolute times.',
    usage: 'fg scenario show <name|path.yaml>',
    description:
      'Prints the seeding plan: relative times ("-3d 18:10") resolved to ISO times, defaults filled in, repeated trips expanded, plus the counts and expectations seeding checks. Changes nothing. A path validates a scenario you are writing.',
    examples: ['fg scenario show heavy-history', 'fg scenario show ./my-scenario.yaml'],
    async run(ctx, args) {
      const name = args.positional[0];
      if (!name) throw usage('Which scenario?', '`fg scenario list` shows them.');
      const s = await loadScenario(ctx.sh, ctx.inst.repo, name);
      const p = plan(s, new Date());
      return {
        name: s.name,
        file: s.file,
        summary: s.summary,
        goodFor: s.goodFor ?? [],
        counts: expectedCounts(p),
        plan: JSON.parse(JSON.stringify(p)),
      };
    },
  },
  {
    name: 'seed',
    summary: 'Seed a scenario as a new run (no reset), or with no scenario reset the database to peter + lea.',
    usage: 'fg seed [<scenario>] [--target local|hosted] [--run-id ID] [--dry-run]',
    description: [
      "With a scenario: creates its users (auth admin API, email confirmed, no mail is sent) and data (service role and the users' own sessions, so triggers, classifier and history run as in the app) as one run, without touching anything else in the database, then checks the result as the members see it (counts, usuals and due items via suggest_items, RLS isolation). Prints the run id, member refs (<run>:<handle>, usable with --as, peer, login) and counts. Passwords go only to the run manifest ($FG_STATE_DIR/runs/<run>.json, mode 600), never to stdout. The run becomes the current one, so a bare handle (--as mia) refers to it. Remove it with `fg teardown <run>`.",
      'Without a scenario: the baseline. Runs `supabase db reset` on this instance (all data is lost) and creates peter@fg.test and lea@fg.test in "Familie Test" through the app\'s RPCs. Running apps keep stale sessions: `fg up` relaunches them signed out.',
      'A seed that fails or is stopped (Ctrl-C, SIGTERM, SIGHUP) is torn down before fg exits, on either target. --target hosted seeds the real project (test accounts only, @fg-test.invalid); tear it down yourself when done; `fg runs --target hosted` lists leftovers (a SIGKILL cannot be caught: `fg teardown --stale` finds those).',
    ].join('\n\n'),
    flags: [targetFlag, { name: 'run-id', help: 'Name the run (3-41 of a-z, 0-9, -). An existing ready run with this id is reused.' }],
    examples: [
      'fg seed household-3-mid-shop',
      'fg seed heavy-history --run-id hh1',
      'fg seed empty-new-user --target hosted',
      'fg seed --dry-run',
      'fg seed',
    ],
    destructive: true,
    async run(ctx, args) {
      const name = args.positional[0];
      if (!name) {
        if (str(args, 'target') || str(args, 'run-id')) {
          throw usage(
            '--target and --run-id need a scenario.',
            'Plain `fg seed` resets the local database to peter + lea; `fg seed <scenario>` seeds a run.',
          );
        }
        if (!(await stackEnv(ctx.sh, ctx.inst).catch(() => null))) {
          throw new FgError('stack_down', 'The stack is not running.', 'Run `fg up --only stack` (it seeds too).');
        }
        const result = await seedBaseline(ctx, ctx.inst);
        ctx.state.seededAt = new Date().toISOString();
        await ctx.save();
        return { ...result, next: 'Running apps hold stale sessions now: `fg up` relaunches them signed out.' };
      }
      const scenario = await loadScenario(ctx.sh, ctx.inst.repo, name);
      const kind = targetOf(args);
      const run = checkRunId(str(args, 'run-id') ?? newFixtureRunId());
      if (ctx.dryRun) {
        const p = plan(scenario, new Date());
        ctx.actions.push(
          `create ${p.users.length} users ${p.users.map((u) => `${u.handle}.${run}@fg-test.invalid`).join(', ')} on the ${kind} target`,
          ...p.households.map((h) =>
            `create household "${h.name}" (${h.members.join(', ')}): ${h.items.length} list items, ${h.trips.length} past trips, ${
              h.stores.filter((s) => s.isNew).length
            } new stores, ${h.invites.length} invites`
          ),
          'check counts, usuals and RLS as the members',
        );
        return { run, scenario: scenario.name, target: kind, counts: expectedCounts(p) };
      }
      const t = await resolveTarget(ctx, kind);
      const existing = await readManifest(ctx, t, run);
      if (existing) {
        if (existing.status === 'ready' && existing.scenario === scenario.name) {
          return { reused: true, ...publicView(existing), credentials: `${t.runsDir}/${run}.json` };
        }
        throw new FgError(
          'run_exists',
          `Run ${run} exists (${existing.scenario}, ${existing.status}).`,
          `\`fg teardown ${run}\` first, or pick another --run-id.`,
        );
      }
      ctx.log(`seeding ${scenario.name} as run ${run} on the ${t.label}`);
      const started = Date.now();
      const { manifest, checks } = await withTeardownOnFailure(
        ctx,
        t,
        run,
        // A half-seeded run is useless on either target: a failed or interrupted seed is removed.
        () => true,
        (signal) => seedScenario(ctx, t, scenario, run, new Date(), signal),
      );
      await ctx.sh.writeText(currentRunPath(t), run);
      const failed = checks.filter((c) => !c.ok);
      const doc = {
        ...publicView(manifest),
        counts: expectedCounts(plan(scenario, new Date(manifest.createdAt))),
        checks: { ok: failed.length === 0, passed: checks.length - failed.length, failed },
        seconds: Math.round((Date.now() - started) / 100) / 10,
        credentials: `${t.runsDir}/${run}.json`,
        next: kind === 'hosted'
          ? `fg sync ${scenario.name} --run-id ${run} --target hosted --script F; fg teardown ${run} --target hosted (member refs work on the local stack only)`
          : `fg db query "select count(*) from items" --as ${run}:${
            scenario.users[0].handle
          }; fg sync ${scenario.name} --run-id ${run} --script F; fg teardown ${run}`,
      };
      if (failed.length) {
        if (kind === 'hosted') await teardownRun(ctx, t, run);
        throw new FgError(
          'assert_failed',
          `Run ${run} seeded, but ${failed.length} check(s) failed: ${failed.map((c) => c.name).join('; ')}.`,
          kind === 'hosted'
            ? 'The hosted run was torn down. Fix the scenario or the seeding.'
            : `Inspect with \`fg db query\`, then \`fg teardown ${run}\`.`,
          1,
          doc as never,
        );
      }
      return doc;
    },
  },
  {
    name: 'runs',
    summary: 'List fixture runs on the target: manifests plus orphaned test users (lost manifests).',
    usage: 'fg runs [--stale] [--target local|hosted]',
    description:
      `Shows each run's scenario, age, status and whether its manifest still exists. Runs whose manifest is gone are found by the test email domain and listed as orphaned. --stale lists only runs older than ${STALE_HOURS} h (what \`fg teardown --stale\` removes). Without a running local stack only manifests are listed.`,
    flags: [targetFlag, { name: 'stale', type: 'boolean', help: `Only runs older than ${STALE_HOURS} h.` }, olderThan],
    examples: ['fg runs', 'fg runs --stale', 'fg runs --target hosted'],
    async run(ctx, args) {
      const kind = targetOf(args);
      const t = await resolveTarget(ctx, kind).catch((e) => {
        if (kind === 'local' && e instanceof FgError && e.code === 'stack_down') return null;
        throw e;
      });
      const runsDir = t?.runsDir ?? `${ctx.inst.stateDir}/runs`;
      const target = t ?? ({ kind, label: 'local stack (down)', apiUrl: '', publishableKey: '', secretKey: '', runsDir } as Target);
      const runs = (await findRuns(ctx, t ? new Api(ctx.sh, t) : null, target, int(args, 'older-than', STALE_HOURS))).filter((r) =>
        !args.flags.stale || r.stale
      );
      const current = (await ctx.sh.exists(currentRunPath(target))) ? (await ctx.sh.readText(currentRunPath(target))).trim() : null;
      return { target: kind, stackUp: t !== null, current: runs.some((r) => r.run === current) ? current : null, count: runs.length, runs };
    },
  },
  {
    name: 'teardown',
    summary: 'Delete exactly what a fixture run created, then prove it with a leftover check.',
    usage: 'fg teardown <run-id> | --all | --stale [--target local|hosted] [--dry-run]',
    description:
      `Deletes the run's users (via public.delete_account, the app's own path) and the households only its users belong to; a household with any other member is left alone. Finds the run by manifest and by the test email domain, so a lost manifest still tears down. Ends with a leftover check (auth users, households, members, items, events, invites, stores, categories, layouts, memories, profiles, tokens) that fails with code leftovers unless every count is zero. Idempotent: tearing down a gone run returns ok with alreadyClean. --stale removes runs older than ${STALE_HOURS} h, --all every run on the target.`,
    flags: [targetFlag, { name: 'all', type: 'boolean', help: 'Every run on the target.' }, {
      name: 'stale',
      type: 'boolean',
      help: `Runs older than ${STALE_HOURS} h, including orphans.`,
    }, olderThan],
    examples: [
      'fg teardown fx-1025-1432-k3x9',
      'fg teardown --stale --dry-run',
      'fg teardown --all',
      'fg teardown fx-1025-1432-k3x9 --target hosted',
    ],
    destructive: true,
    async run(ctx, args) {
      const kind = targetOf(args);
      const run = args.positional[0];
      const many = Boolean(args.flags.all) || Boolean(args.flags.stale);
      if (!run === !many || (args.flags.all && args.flags.stale)) {
        throw usage('Give one run id, or --all, or --stale.', '`fg runs` lists the run ids.');
      }
      const t = await resolveTarget(ctx, kind);
      const ids = run
        ? [checkRunId(run)]
        : (await findRuns(ctx, new Api(ctx.sh, t), t, int(args, 'older-than', STALE_HOURS))).filter((r) => args.flags.all || r.stale).map((
          r,
        ) => r.run);
      const results: TeardownResult[] = [];
      for (const id of ids) results.push(await teardownRun(ctx, t, id));
      if (run) return { target: kind, ...results[0] };
      return { target: kind, count: results.length, runs: results };
    },
  },
];
