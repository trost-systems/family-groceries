// Lists the steps that took long in each Playwright trace under a directory (an --output dir, or
// an HTML report's data/), a passing run's too (job 122). A test that passes after a 10 s wait inside a retry hides a lost click or a late
// answer that a slower run turns into a failure.
//
//   npx playwright test <spec> --trace on --output /tmp/run
//   node trace-slow-steps.mjs /tmp/run [ms, default 1500]
import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';

const [dir, threshold = '1500'] = process.argv.slice(2);
if (!dir) {
  console.error('usage: node trace-slow-steps.mjs <dir with trace.zip files> [ms]');
  process.exit(2);
}

const traces = [];
const walk = (d) => {
  for (const name of readdirSync(d)) {
    const path = join(d, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (name.endsWith('.zip')) traces.push(path);
  }
};
walk(dir);

for (const trace of traces) {
  let text;
  try {
    text = execFileSync('unzip', ['-p', trace, 'test.trace'], { encoding: 'utf8', maxBuffer: 1 << 28, stdio: 'pipe' });
  } catch {
    continue;
  }
  const events = text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const started = new Map();
  let first;
  let last = 0;
  for (const e of events) {
    if (e.type !== 'before') continue;
    started.set(e.callId, e);
    first ??= e.startTime;
  }
  const slow = [];
  for (const e of events) {
    const b = e.type === 'after' && started.get(e.callId);
    if (!b) continue;
    last = Math.max(last, e.endTime);
    const took = e.endTime - b.startTime;
    if (took < Number(threshold)) continue;
    const params = JSON.stringify(b.params ?? {});
    const target = [...params.matchAll(/name: '([^']+)'/g)].at(-1)?.[1] ?? params.match(/"selector":"([^"]{0,60})/)?.[1] ?? '';
    const at = ((b.startTime - first) / 1000).toFixed(1).padStart(6);
    slow.push(`${at}s ${(took / 1000).toFixed(1).padStart(5)}s ${b.title ?? b.method} ${target}`
      + ` (line ${b.stack?.[0]?.line ?? '?'})${e.error ? ' failed' : ''}`);
  }
  const spec = events.flatMap((e) => e.stack ?? []).find((frame) => /\.spec\.ts$/.test(frame.file));
  const where = spec ? `${spec.file.split('/').at(-1)}:${spec.line}` : '';
  console.log(`${trace.split('/').at(-2)}/${trace.split('/').at(-1)} ${where}: ${((last - first) / 1000).toFixed(1)} s`);
  for (const line of slow) console.log(line);
}
