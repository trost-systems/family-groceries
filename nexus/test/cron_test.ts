import { assertEquals } from '@std/assert';

// cron.sh publishes at most once a night: outside the deploy hour, or with today's stamp, it
// returns before it touches the checkout (a missing checkout would fail the run otherwise).
const script = new URL('../scripts/cron.sh', import.meta.url).pathname;

async function run(env: Record<string, string>): Promise<number> {
  const { code } = await new Deno.Command('bash', {
    args: [script],
    env: { NEXUS_CHECKOUT: '/nonexistent/nexus-publisher', ...env },
    stdout: 'null',
    stderr: 'null',
  }).output();
  return code;
}

Deno.test('cron.sh skips outside the 03:00 hour and once today is stamped', async () => {
  const dir = await Deno.makeTempDir();
  const stamp = `${dir}/stamp`;
  const lock = { NEXUS_LOCK: `${dir}/lock` };
  assertEquals(await run({ ...lock, NEXUS_CLOCK_HOUR: '14', NEXUS_STAMP: stamp }), 0);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());
  await Deno.writeTextFile(stamp, `${today}\n`);
  assertEquals(await run({ ...lock, NEXUS_CLOCK_HOUR: '03', NEXUS_STAMP: stamp }), 0);
  // In the hour without a stamp it goes on to publish: here it fails on the missing checkout.
  await Deno.remove(stamp);
  assertEquals((await run({ ...lock, NEXUS_CLOCK_HOUR: '03', NEXUS_STAMP: stamp })) !== 0, true);
  await Deno.remove(dir, { recursive: true });
});
