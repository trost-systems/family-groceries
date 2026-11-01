import { assertEquals, assertMatch, assertThrows } from '@std/assert';
import { FgError } from './core.ts';
import { DEFAULT_WITHIN_MS, parseScript } from './sync_dsl.ts';

const clients = [{ label: 'A', handle: 'mia' }, { label: 'B', handle: 'noah' }, { label: 'C', handle: 'ida' }];
const parse = (text: string) => parseScript(text, clients);
const strip = (text: string) => parse(text).map(({ line: _l, source: _s, ...rest }) => rest);

Deno.test('every step kind parses', () => {
  assertEquals(
    strip(`
# a comment line
A add "Hafermilch 2"   # trailing comment
expect B,C see "Hafermilch" within 2000ms
B tick "Milch"
expect A,C gone "Milch" within 2s
C edit "Bananen" quantity "6"
noah edit "Gurke" name "Salatgurke"
A delete "Brot"
A offline
A online
B reload
ida store "Supermarkt"
expect A text "Offline"
wait 500ms
screenshot "after-edit"
`),
    [
      { kind: 'act', client: 'A', action: 'add', text: 'Hafermilch 2' },
      { kind: 'expect', clients: ['B', 'C'], check: 'see', text: 'Hafermilch', withinMs: 2000 },
      { kind: 'act', client: 'B', action: 'tick', item: 'Milch' },
      { kind: 'expect', clients: ['A', 'C'], check: 'gone', text: 'Milch', withinMs: 2000 },
      { kind: 'act', client: 'C', action: 'edit', item: 'Bananen', field: 'quantity', value: '6' },
      { kind: 'act', client: 'B', action: 'edit', item: 'Gurke', field: 'name', value: 'Salatgurke' },
      { kind: 'act', client: 'A', action: 'delete', item: 'Brot' },
      { kind: 'act', client: 'A', action: 'offline' },
      { kind: 'act', client: 'A', action: 'online' },
      { kind: 'act', client: 'B', action: 'reload' },
      { kind: 'act', client: 'C', action: 'store', store: 'Supermarkt' },
      { kind: 'expect', clients: ['A'], check: 'text', text: 'Offline', withinMs: DEFAULT_WITHIN_MS },
      { kind: 'wait', ms: 500 },
      { kind: 'screenshot', name: 'after-edit' },
    ],
  );
});

Deno.test('quotes keep spaces, umlauts, emoji, escaped quotes and #', () => {
  assertEquals(strip('A add "2 Äpfel 🍎 \\"bio\\" #1"'), [{ kind: 'act', client: 'A', action: 'add', text: '2 Äpfel 🍎 "bio" #1' }]);
});

Deno.test('line numbers are kept for the report', () => {
  assertEquals(parse('\n\nA add "X"').map((s) => [s.line, s.source]), [[3, 'A add "X"']]);
});

Deno.test('every error names its line and what is wrong', () => {
  const fail = (text: string) => assertThrows(() => parse(text), FgError).message;
  assertMatch(fail('D add "X"'), /line 1: no client "D" \(this run has A=mia, B=noah, C=ida\)/);
  assertMatch(fail('A add Milch'), /line 1: expected the text to type in quotes/);
  assertMatch(fail('A buy "Milch"'), /line 1: unknown action "buy"/);
  assertMatch(fail('expect B find "X"'), /line 1: expect takes see, gone or text/);
  assertMatch(fail('expect B see "X" in 2s'), /did you mean within/);
  assertMatch(fail('expect B see "X" within soon'), /"soon" is not a duration/);
  assertMatch(fail('A edit "X" brand "Y"'), /edit takes name or quantity/);
  assertMatch(fail('wait'), /is not a duration/);
  assertMatch(fail('A offline now'), /unexpected "now"/);
  assertMatch(fail('# nothing'), /no steps/);
  const many = assertThrows(() => parse('A x "1"\nB y "2"'), FgError);
  assertEquals(many.code, 'bad_script');
  assertMatch(many.message, /line 1.*line 2/);
});

Deno.test('a two-client run rejects C', () => {
  assertThrows(() => parseScript('C add "X"', clients.slice(0, 2)), FgError, 'no client "C"');
});
