import { assertEquals } from '@std/assert';

const here = new URL('.', import.meta.url).pathname;

/** Runs a probe under a shell snippet (it runs "$PROBE") and returns what heldByAncestor said about $LOCK. */
async function heldUnder(snippet: string, lock: string, probe: string): Promise<string> {
  const out = await new Deno.Command('bash', {
    args: ['-c', snippet],
    env: { LOCK: lock, PROBE: `${Deno.execPath()} run -A --config ${here}deno.json ${probe}` },
    stdout: 'piped',
    stderr: 'inherit',
  }).output();
  return new TextDecoder().decode(out.stdout).trim();
}

Deno.test("the e2e lock held by a parent is recognised: flock FILE cmd, and the gate's exec 9>>lock; flock 9", async () => {
  const lock = await Deno.makeTempFile({ suffix: '.lock' });
  const probe = await Deno.makeTempFile({ suffix: '.ts' });
  await Deno.writeTextFile(
    probe,
    `import { heldByAncestor } from '${here}sync.ts';\nconsole.log(String(await heldByAncestor(Deno.env.get('LOCK')!)));\n`,
  );
  try {
    assertEquals(await heldUnder('flock "$LOCK" bash -c "$PROBE"', lock, probe), 'true');
    assertEquals(await heldUnder('exec 9>>"$LOCK"; flock 9; bash -c "$PROBE"', lock, probe), 'true');
    assertEquals(await heldUnder('$PROBE', lock, probe), 'false', 'nobody holds it');
  } finally {
    await Deno.remove(lock);
    await Deno.remove(probe);
  }
});
