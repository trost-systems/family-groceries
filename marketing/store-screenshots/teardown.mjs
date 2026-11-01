// Tears down every fg run the capture seeded (app.mjs records them in out/runs.txt).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { repo } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';
import { OUT } from './seed.mjs';

export default function teardown() {
  const file = join(OUT, 'runs.txt');
  if (!existsSync(file)) return;
  for (const run of new Set(readFileSync(file, 'utf8').split('\n').filter(Boolean))) {
    execFileSync(join(repo, 'scripts/fg'), ['teardown', run], { stdio: ['ignore', 'ignore', 'inherit'] });
  }
  rmSync(file);
}
