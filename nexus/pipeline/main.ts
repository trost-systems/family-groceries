// deno run --allow-all pipeline/main.ts --ops <dir> --repo <dir> --out <file>  (reading /proc/<pid> needs --allow-all)
import { buildSnapshot } from './build.ts';
import { ghCli } from './github.ts';
import { procWorkerAlive } from './jobs.ts';
import { readHost } from './ops.ts';

function arg(name: string): string {
  const i = Deno.args.indexOf(`--${name}`);
  const value = i < 0 ? undefined : Deno.args[i + 1];
  if (value === undefined) throw new Error(`missing --${name} <path>`);
  return value;
}

const snapshot = await buildSnapshot({
  opsDir: arg('ops'),
  repoDir: arg('repo'),
  gh: ghCli,
  host: readHost,
  isWorkerAlive: procWorkerAlive,
  now: new Date(),
  warn: (msg) => console.error(`nexus: ${msg}`),
});
const json = JSON.stringify(snapshot);
// Fail closed: a snapshot with an email address in it is not published (README "Privacy").
if (/[\w.+-]+@[\w-]+\.[a-z]{2,}/i.test(json)) {
  throw new Error('nexus: the snapshot contains an email address; not written');
}
await Deno.writeTextFile(arg('out'), json);
const count = (state: string): number => snapshot.jobs.filter((j) => j.state === state).length;
console.error(
  `nexus: snapshot ${snapshot.jobs.length} jobs (${
    count('building') + count('reviewing') + count('fixing')
  } live, ${
    count('queued')
  } queued), ${snapshot.hillclimbs.length} hill-climbs, ${snapshot.needsLead.length} for the lead`,
);
