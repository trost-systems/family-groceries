import { assertEquals, assertStringIncludes } from '@std/assert';

const script = new URL('../scripts/publish.sh', import.meta.url).pathname;

async function publish(...args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  // NEXUS_ENV points nowhere: should the argument check ever let a call through, it still cannot deploy.
  const out = await new Deno.Command('bash', {
    args: [script, ...args],
    env: { NEXUS_ENV: '/nonexistent', NEXUS_OPS_DIR: '/nonexistent' },
  }).output();
  const text = new TextDecoder();
  return { code: out.code, stdout: text.decode(out.stdout), stderr: text.decode(out.stderr) };
}

Deno.test('publish.sh refuses anything but no argument or one --deploy, before it builds', async () => {
  for (const args of [['--deploy', 'extra'], ['--deploy', '--deploy'], ['--bogus'], ['extra', '--deploy']]) {
    const { code, stdout, stderr } = await publish(...args);
    assertEquals([args, code, stdout], [args, 64, '']);
    assertStringIncludes(stderr, 'usage: publish.sh [--deploy]');
  }
});
