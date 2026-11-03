// Tears down every fg run the capture seeded (seed.mjs records them in out/runs.txt). Tries each
// run and fails at the end, so one failure does not leave the others behind. Also runs on its
// own (`node teardown.mjs`) before a new capture clears out/.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { repo } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { OUT } from './seed.mjs';

export default function teardown() {
  const file = join(OUT, 'runs.txt');
  if (!existsSync(file)) return;
  const failed = [];
  for (const run of new Set(readFileSync(file, 'utf8').split('\n').filter(Boolean))) {
    try {
      execFileSync(join(repo, 'scripts/fg'), ['teardown', run], { stdio: ['ignore', 'ignore', 'inherit'] });
    } catch {
      failed.push(run);
    }
  }
  if (failed.length) throw new Error(`fg teardown failed for ${failed.join(', ')}; ${file} keeps them`);
  rmSync(file);
}

if (process.argv[1] === new URL(import.meta.url).pathname) teardown();
