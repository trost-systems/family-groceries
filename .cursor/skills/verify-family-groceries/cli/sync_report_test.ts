import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { type EngineResult, indexHtml, indexMarkdown, latencySummary, pickClients } from './sync.ts';
import type { Manifest } from './fixtures.ts';

const obs = (client: string, fromAckMs: number | null, fromInputMs: number | null) => ({
  client,
  visibleAt: fromInputMs === null ? null : 1000 + fromInputMs,
  fromAckMs,
  fromInputMs,
});
const action = (client: string) => ({ line: 1, client, issuedAt: 1000, ack: { at: 1050, method: 'POST', path: 'items', status: 201 } });

const result: EngineResult = {
  ok: false,
  startedAt: '2026-10-25T10:00:00.000Z',
  durationMs: 9000,
  clients: [
    { label: 'A', ref: 'r:mia', name: 'Mia', screen: 'list', store: null, video: 'videos/A.webm' },
    { label: 'B', ref: 'r:noah', name: 'Noah', screen: 'list', store: 'Lidl', video: 'videos/B.webm' },
  ],
  steps: [
    { index: 0, line: 1, source: 'A add "X"', kind: 'act', ok: true, frame: '0002' },
    {
      index: 1,
      line: 2,
      source: 'expect A,B see "X"',
      kind: 'expect',
      ok: true,
      action: action('A'),
      observations: [obs('A', -40, 10), obs('B', 100, 150)],
    },
    { index: 2, line: 3, source: 'expect B see "Y"', kind: 'expect', ok: true, action: action('A'), observations: [obs('B', 300, 350)] },
    {
      index: 3,
      line: 4,
      source: 'expect B see "Z"',
      kind: 'expect',
      ok: true,
      catchUp: true,
      action: action('A'),
      observations: [obs('B', 4000, 4050), obs('A', 9, 9)],
    },
    {
      index: 4,
      line: 5,
      source: 'expect B gone "N"',
      kind: 'expect',
      ok: true,
      action: action('A'),
      observations: [{ ...obs('B', null, null), visibleAt: 1000, alreadyHeld: true }],
    },
    {
      index: 5,
      line: 6,
      source: 'expect B see "K"',
      kind: 'expect',
      ok: true,
      catchUp: true,
      action: { ...action('B'), kind: 'online' },
      observations: [obs('B', null, 2900)],
    },
    {
      index: 6,
      line: 7,
      source: 'expect B see "Q" within 1500ms',
      kind: 'expect',
      ok: false,
      error: 'B did not show "Q" within 1500 ms',
      frame: '0005',
      action: action('A'),
      observations: [obs('B', null, null)],
    },
  ],
  frames: [
    { id: '0004', kind: 'change', at: 1, ms: 1, cause: 'B: +Y', step: 3, files: {}, composite: 'frames/0004-change.png' },
    { id: '0005', kind: 'failure', at: 2, ms: 2, cause: 'line 7 FAILED', step: 6, files: {}, composite: 'frames/0005-failure.png' },
  ],
  changeFrames: 1,
  changeFramesCapped: false,
  compositeVideo: 'videos/composite.webm',
};

Deno.test('latency: live propagation per observer; own view, held-already and catch-up are left out of it', () => {
  const s = latencySummary(result);
  assertEquals(s.perClient.A.fromAckMs, null, 'A only observed its own add');
  assertEquals(s.perClient.B.fromAckMs, { n: 2, p50: 100, max: 300, min: 100 });
  assertEquals(s.all.fromInputMs?.max, 350);
  assertEquals(s.catchUp.fromAckMs, { n: 1, p50: 4000, max: 4000, min: 4000 }, "A's own view of its action is not catch-up");
  assertEquals(s.catchUp.fromInputMs?.max, 4050);
  assertEquals(s.catchUp.fromInputMs?.n, 2, 'the reconnecting client catching up after online counts');
});

Deno.test('the index leads with the failure and links frames and videos', () => {
  const meta = { scenario: 'household-3-mid-shop', run: 'r', target: 'local', script: 'x.fgs' };
  const html = indexHtml(meta, result, latencySummary(result));
  assert(html.indexOf('<h2>Failure</h2>') < html.indexOf('<h2>Clients</h2>'), 'failure first');
  assertStringIncludes(html, 'frames/0005-failure.png');
  assertStringIncludes(html, 'frames/0004-change.png', 'the frames before the failure too');
  assertStringIncludes(html, 'videos/composite.webm');
  assertStringIncludes(html, 'catch-up');
  const md = indexMarkdown(meta, result, latencySummary(result));
  assertStringIncludes(md, '# fg sync: household-3-mid-shop (FAIL)');
  assertStringIncludes(md, '**FAILED**: B did not show "Q" within 1500 ms');
});

Deno.test('clients come from one household, in member order', () => {
  const m = {
    scenario: 's',
    users: { mia: { household: 'home' }, noah: { household: 'home' }, ida: { household: 'home' }, olga: { household: 'home2' } },
    households: { home: { members: ['mia', 'noah', 'ida'] }, home2: { members: ['olga'] } },
  } as unknown as Manifest;
  assertEquals(pickClients(m, '3'), { household: 'home', members: ['mia', 'noah', 'ida'] });
  assertEquals(pickClients(m, 'ida,mia'), { household: 'home', members: ['ida', 'mia'] });
  let err = '';
  try {
    pickClients(m, 'mia,olga');
  } catch (e) {
    err = (e as Error).message;
  }
  assertStringIncludes(err, 'share one household');
});

Deno.test('a scenario without households signs in its users who have none', () => {
  const m = { scenario: 'empty-new-user', users: { nele: { household: null } }, households: {} } as unknown as Manifest;
  assertEquals(pickClients(m, '1'), { household: null, members: ['nele'] });
});

Deno.test('catch-up is per observer: a client that never went offline still counts as live', () => {
  const r: EngineResult = {
    ...result,
    steps: [{
      index: 0,
      line: 1,
      source: 'expect B,C see "X"',
      kind: 'expect',
      ok: true,
      catchUp: true,
      action: action('A'),
      observations: [{ ...obs('B', 3000, 3050), catchUp: true }, { ...obs('C', 120, 170), catchUp: false }],
    }],
  };
  const s = latencySummary(r);
  assertEquals(s.all.fromAckMs, { n: 1, p50: 120, max: 120, min: 120 });
  assertEquals(s.catchUp.fromAckMs, { n: 1, p50: 3000, max: 3000, min: 3000 });
});
