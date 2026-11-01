// Job 50: requirePremium's contract around the database gate (_shared/premium.ts).
import { assertEquals, assertRejects } from '@std/assert';
import { type Integration, premiumGate } from './premium.ts';

const caller = { userId: 'u', householdId: 'h' };

function gate(answer: { locked: boolean; report: boolean } | Error, blocked?: () => Promise<void>) {
  const reported: Integration[] = [];
  const require = premiumGate({
    gate: () => answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer),
    blocked: (_caller, integration) => {
      reported.push(integration);
      return blocked?.() ?? Promise.resolve();
    },
  });
  return { require, reported };
}

Deno.test('open: nothing is reported', async () => {
  const g = gate({ locked: false, report: false });
  assertEquals(await g.require(caller, 'siri'), 'open');
  assertEquals(g.reported, []);
});

Deno.test('locked: reported only when the database says it is the first of the hour', async () => {
  const first = gate({ locked: true, report: true });
  assertEquals(await first.require(caller, 'alexa'), 'locked');
  assertEquals(first.reported, ['alexa']);
  const again = gate({ locked: true, report: false });
  assertEquals(await again.require(caller, 'alexa'), 'locked');
  assertEquals(again.reported, []);
});

Deno.test('a failing event never changes the answer', async () => {
  const g = gate({ locked: true, report: true }, () => Promise.reject(new Error('posthog down')));
  assertEquals(await g.require(caller, 'mcp'), 'locked');
});

Deno.test('a failing check throws, so the endpoint answers with its transient error', async () => {
  const g = gate(new Error('connection refused'));
  await assertRejects(() => g.require(caller, 'siri'), Error, 'connection refused');
});
