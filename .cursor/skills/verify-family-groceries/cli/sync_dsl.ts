/**
 * The fg sync script language: one step per line, clients named A, B, C (or by handle).
 *
 *   A add "Hafermilch 2"
 *   expect B,C see "Hafermilch" within 2000ms
 *   B tick "Milch"
 *   expect A,C gone "Milch"
 *   C edit "Bananen" quantity "6"
 *   A offline / A online / A reload / A store "Lidl"
 *   wait 500ms
 *   screenshot "after-edit"
 *
 * Steps are surface-agnostic: the web driver (e2e/sync/engine.mjs) runs them
 * in Playwright; a Marionette driver could run the same list.
 */

import { FgError } from './core.ts';

export type ClientAction =
  | { action: 'add'; text: string }
  | { action: 'tick'; item: string }
  | { action: 'edit'; item: string; field: 'name' | 'quantity'; value: string }
  | { action: 'delete'; item: string }
  | { action: 'store'; store: string }
  | { action: 'offline' }
  | { action: 'online' }
  | { action: 'reload' };

export type Condition = { check: 'see' | 'gone' | 'text'; text: string };

export type Step =
  & { line: number; source: string }
  & (
    | ({ kind: 'act'; client: string } & ClientAction)
    | ({ kind: 'expect'; clients: string[]; withinMs: number } & Condition)
    | { kind: 'wait'; ms: number }
    | { kind: 'screenshot'; name: string }
  );

export const DEFAULT_WITHIN_MS = 3000;
export const LETTERS = ['A', 'B', 'C'];

/** Splits a line into words, keeping "quoted strings" (with \" escapes) as one token. */
export function tokenize(line: string): { tokens: string[]; quoted: boolean[] } {
  const tokens: string[] = [];
  const quoted: boolean[] = [];
  const re = /"((?:[^"\\]|\\.)*)"|(\S+)/g;
  for (const m of line.matchAll(re)) {
    tokens.push(m[1] !== undefined ? m[1].replace(/\\(.)/g, '$1') : m[2]);
    quoted.push(m[1] !== undefined);
  }
  return { tokens, quoted };
}

/** Drops a # comment that is outside quotes. */
function stripComment(line: string): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '\\' && quoted) i++;
    else if (line[i] === '"') quoted = !quoted;
    else if (line[i] === '#' && !quoted && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function duration(raw: string, where: string): number {
  const m = /^(\d+)(ms|s)$/.exec(raw);
  if (!m) throw new Error(`${where}: "${raw}" is not a duration (use 500ms or 2s)`);
  return Number(m[1]) * (m[2] === 's' ? 1000 : 1);
}

/**
 * Parses a script. `clients` are the labels in play (A, B, C) and the handles
 * they map to; a step may use either. Every error names its line.
 */
export function parseScript(text: string, clients: { label: string; handle: string }[]): Step[] {
  const label = (raw: string, where: string) => {
    const c = clients.find((x) => x.label === raw || x.handle === raw);
    if (!c) throw new Error(`${where}: no client "${raw}" (this run has ${clients.map((x) => `${x.label}=${x.handle}`).join(', ')})`);
    return c.label;
  };
  const steps: Step[] = [];
  const errors: string[] = [];
  text.split('\n').forEach((rawLine, i) => {
    const source = stripComment(rawLine).trim();
    if (!source) return;
    const where = `line ${i + 1}`;
    const { tokens: t, quoted } = tokenize(source);
    const str = (k: number, what: string) => {
      if (t[k] === undefined || !quoted[k]) throw new Error(`${where}: expected ${what} in quotes`);
      return t[k];
    };
    const end = (k: number) => {
      if (t.length > k) throw new Error(`${where}: unexpected "${t[k]}"`);
    };
    try {
      if (t[0] === 'wait') {
        steps.push({ line: i + 1, source, kind: 'wait', ms: duration(t[1] ?? '', where) });
        end(2);
      } else if (t[0] === 'screenshot') {
        steps.push({ line: i + 1, source, kind: 'screenshot', name: str(1, 'a name') });
        end(2);
      } else if (t[0] === 'expect') {
        const who = (t[1] ?? '').split(',').filter(Boolean).map((c) => label(c, where));
        if (!who.length) throw new Error(`${where}: expect needs clients, e.g. expect B,C see "Milch"`);
        const check = t[2];
        if (check !== 'see' && check !== 'gone' && check !== 'text') {
          throw new Error(`${where}: expect takes see, gone or text, got "${check ?? ''}"`);
        }
        const value = str(3, 'the text to look for');
        let withinMs = DEFAULT_WITHIN_MS;
        if (t[4] !== undefined) {
          if (t[4] !== 'within') throw new Error(`${where}: unexpected "${t[4]}" (did you mean within 2000ms?)`);
          withinMs = duration(t[5] ?? '', where);
          end(6);
        }
        steps.push({ line: i + 1, source, kind: 'expect', clients: [...new Set(who)], check, text: value, withinMs });
      } else {
        const client = label(t[0], where);
        const verb = t[1];
        const base = { line: i + 1, source, kind: 'act' as const, client };
        switch (verb) {
          case 'add':
            steps.push({ ...base, action: 'add', text: str(2, 'the text to type') });
            end(3);
            break;
          case 'tick':
          case 'delete':
            steps.push({ ...base, action: verb, item: str(2, 'the item name') });
            end(3);
            break;
          case 'edit': {
            const item = str(2, 'the item name');
            const field = t[3];
            if (field !== 'name' && field !== 'quantity') throw new Error(`${where}: edit takes name or quantity, got "${field ?? ''}"`);
            steps.push({ ...base, action: 'edit', item, field, value: str(4, `the new ${field}`) });
            end(5);
            break;
          }
          case 'store':
            steps.push({ ...base, action: 'store', store: str(2, 'the store name (or "Alle")') });
            end(3);
            break;
          case 'offline':
          case 'online':
          case 'reload':
            steps.push({ ...base, action: verb });
            end(2);
            break;
          default:
            throw new Error(`${where}: unknown action "${verb ?? ''}" (add, tick, edit, delete, store, offline, online, reload)`);
        }
      }
    } catch (e) {
      errors.push((e as Error).message);
    }
  });
  if (errors.length) {
    throw new FgError(
      'bad_script',
      errors.slice(0, 5).join('; '),
      'Fix the named line(s). The language is in `fg help sync` and docs/TEST_FIXTURES.md.',
      64,
      {
        problems: errors,
      },
    );
  }
  if (!steps.length) {
    throw new FgError('bad_script', 'The script has no steps.', 'e.g. A add "Hafermilch" then expect B see "Hafermilch".', 64);
  }
  return steps;
}
