// POST /functions/v1/voice {"text": "Milch, zwei Gurken und Klopapier"}
// Splits the sentence, adds the items to the caller's list and answers with a German
// sentence for Siri to speak. `?format=text` answers with that sentence as plain text.
// {"text": ..., "mode": "parse"} only splits; the app adds the items itself.
// Job 51: "lang": "en" answers in English (native Siri), "mode": "read" reads the open items, and
// a request that names a lang gets `outcome` in every JSON answer, which the native client
// branches on. Requests without lang (the Shortcut recipe) get the answers they always got.
import { AuthError, type Via } from '../_shared/auth.ts';
import { corsHeaders, json, preflight } from '../_shared/http.ts';
import { scrubMessage } from '../_shared/telemetry.ts';
import { copy, type FailureCode, type Lang, readLimit } from './copy.ts';
import { maxItems, type ParsedItem, parseSentence } from './parse.ts';
import { parseEnglish } from './parse_en.ts';

export interface Caller {
  userId: string;
  householdId: string;
  /** How the caller signed in; events go only to Siri (siri) and Shortcut (pat) calls. */
  via?: Via;
}

export interface Added extends ParsedItem {
  /** Marke the server's parser found, e.g. "Pampers". */
  brand: string | null;
  /** Eigenschaften, comma-separated, e.g. "Größe 3, Big Pack". */
  properties: string | null;
  /** The category the classifier picked, by name. */
  category: string;
  /** True when the item was active already and nothing was added. */
  alreadyOnList: boolean;
  /**
   * Open items that are another spelling or a synonym of this new one ("Möhren" for
   * "Karotten"), by name; it was added anyway (job 32b). Empty when there are none.
   */
  similarOnList: string[];
}

export interface Deps<C extends Caller = Caller> {
  /** Resolves the bearer token; throws an AuthError when it can't. */
  authenticate(req: Request): Promise<C>;
  addItems(caller: C, items: ParsedItem[]): Promise<Added[]>;
  /** The household's open items in the app's order, for mode read. */
  readItems?(caller: C): Promise<ParsedItem[]>;
  /** Sends a siri_add or siri_read event when the caller's analytics consent allows it. */
  track?(caller: C, event: VoiceEvent): Promise<void>;
  /** Error tracking for a failure answered with 500 (telemetry.ts); scrubbed there. */
  report?(error: unknown): void;
}

export const maxTextLength = 1000;

const statuses: Record<FailureCode, number> = {
  method: 405,
  unauthorized: 401,
  no_household: 403,
  no_text: 400,
  too_long: 413,
  nothing_understood: 422,
  server: 500,
  // The Shortcut speaks only a 200's answer; job 50 returns it with that status.
  premium_required: 200,
};

/** What the native Siri client branches on; the failure codes are also `error`. */
export type Outcome = 'added' | 'nothing_added' | 'parsed' | 'read' | FailureCode;

/** A server event for a Siri add or read (docs/ANALYTICS.md); never a name or text. */
export type VoiceEvent = {
  event: 'siri_add' | 'siri_read';
  result: 'success' | 'fail';
  reason: Outcome;
  language: Lang;
  source: 'native' | 'shortcut';
  /** Items understood (add) or open (read). */
  count: number;
};

const parsers: Record<Lang, (text: string, limit: number) => ParsedItem[]> = {
  de: parseSentence,
  en: parseEnglish,
};

/** How an added item is read back: "2 l Milch", "Windeln Pampers Größe 3 Big Pack". */
export const said = (item: Added, lang: Lang = 'de') =>
  [copy[lang].spoken(item), item.brand, item.properties?.replaceAll(', ', ' ')].filter(Boolean)
    .join(' ');

/** The confirmation Siri speaks. */
export function confirmation(results: Added[], lang: Lang = 'de'): string {
  const say = copy[lang];
  const list = (items: Added[]) => items.map((item) => said(item, lang));
  const added = results.filter((r) => !r.alreadyOnList);
  const existing = results.filter((r) => r.alreadyOnList);
  const similar = [...new Set(added.flatMap((r) => r.similarOnList ?? []))];
  return [
    added.length ? say.added(list(added)) : '',
    existing.length ? say.existing(list(existing)) : '',
    similar.length ? say.similar(similar) : '',
  ].filter(Boolean).join(' ');
}

/** "Möhren steht schon auf der Liste.", "Möhren und Milch stehen schon auf der Liste." */
export const similarNote = (names: string[], lang: Lang = 'de') => copy[lang].similar(names);

interface Body {
  text: string | null;
  mode: 'add' | 'parse' | 'read';
  lang: Lang;
  /**
   * The request named a lang (the native client always does): its answers carry `outcome`.
   * Without one (the Shortcut recipe) they stay exactly as before job 51.
   */
  tagged: boolean;
}

const modes = ['add', 'parse', 'read'] as const;

/**
 * Accepts JSON {"text", "mode", "lang", "list"} (list, a future list id, is ignored), a JSON
 * string, or a plain-text body.
 */
async function readBody(req: Request): Promise<Body> {
  const raw = await req.text();
  const plain = { mode: 'add', lang: 'de', tagged: false } as const;
  if (!(req.headers.get('content-type') ?? '').includes('json')) return { ...plain, text: raw };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') return { ...plain, text: parsed };
    const { text, mode, lang } = (parsed ?? {}) as {
      text?: unknown;
      mode?: unknown;
      lang?: unknown;
    };
    return {
      text: typeof text === 'string' ? text : null,
      mode: modes.find((m) => m === mode) ?? 'add',
      lang: lang === 'en' ? 'en' : 'de',
      tagged: lang !== undefined,
    };
  } catch {
    return { ...plain, text: null };
  }
}

const sources: Partial<Record<Via, VoiceEvent['source']>> = { siri: 'native', pat: 'shortcut' };

export function createHandler<C extends Caller>(deps: Deps<C>) {
  return async (req: Request): Promise<Response> => {
    const early = preflight(req);
    if (early) return early;
    const asText = new URL(req.url).searchParams.get('format') === 'text';

    const reply = (status: number, body: { speech: string } & Record<string, unknown>) => {
      if (!asText) return json(body, { status, headers: authHeader(status) });
      return new Response(body.speech, {
        status,
        headers: {
          ...corsHeaders,
          ...authHeader(status),
          'content-type': 'text/plain; charset=utf-8',
        },
      });
    };
    if (req.method !== 'POST') {
      return reply(405, { error: 'method', speech: copy.de.failures.method });
    }
    const body = await readBody(req);
    const say = copy[body.lang];
    const send = (
      status: number,
      { outcome, ...rest }: { outcome: Outcome; speech: string } & Record<string, unknown>,
    ) => reply(status, body.tagged ? { outcome, ...rest } : rest);
    const fail = (error: FailureCode) =>
      send(statuses[error], { outcome: error, error, speech: say.failures[error] });

    let caller: C;
    try {
      caller = await deps.authenticate(req);
    } catch (e) {
      if (e instanceof AuthError) return fail(e.status === 403 ? 'no_household' : 'unauthorized');
      console.error('voice: authenticate failed', errorShape(e));
      deps.report?.(e);
      return fail('server');
    }

    const source = caller.via && sources[caller.via];
    const track = async (event: VoiceEvent['event'], reason: Outcome, count: number) => {
      if (!source || !deps.track) return;
      const result = ['added', 'nothing_added', 'read'].includes(reason) ? 'success' : 'fail';
      try {
        await deps.track(caller, { event, result, reason, language: body.lang, source, count });
      } catch (e) {
        console.error('voice: event not recorded', errorShape(e));
      }
    };

    if (body.mode === 'read') {
      try {
        if (!deps.readItems) throw new Error('voice: no list reader');
        const open = await deps.readItems(caller);
        await track('siri_read', 'read', open.length);
        const items = open.map(({ name, quantity }) => ({ name, quantity }));
        const speech = say.listing(items.slice(0, readLimit).map(say.spoken), items.length);
        return send(200, { outcome: 'read', speech, items, total: items.length });
      } catch (e) {
        console.error('voice: reading the list failed', errorShape(e));
        deps.report?.(e);
        await track('siri_read', 'server', 0);
        return fail('server');
      }
    }

    const adding = body.mode === 'add';
    const refuse = async (error: FailureCode, count = 0) => {
      if (adding) await track('siri_add', error, count);
      return fail(error);
    };
    const text = body.text?.trim();
    if (!text) return refuse('no_text');
    if (text.length > maxTextLength) return refuse('too_long');
    const heard = parsers[body.lang](text, maxItems + 1);
    if (!heard.length) return refuse('nothing_understood');
    const items = heard.slice(0, maxItems);
    const truncated = heard.length > maxItems;
    const cut = truncated ? ` ${say.tooMany}` : '';

    if (!adding) {
      return send(200, {
        outcome: 'parsed',
        speech: say.parsed(items.map(say.spoken)) + cut,
        items,
        truncated,
      });
    }

    try {
      const added = await deps.addItems(caller, items);
      const outcome = added.some((a) => !a.alreadyOnList) ? 'added' : 'nothing_added';
      await track('siri_add', outcome, items.length);
      return send(200, {
        outcome,
        speech: confirmation(added, body.lang) + cut,
        items: added,
        truncated,
      });
    } catch (e) {
      console.error('voice: adding items failed', errorShape(e));
      deps.report?.(e);
      return refuse('server', items.length);
    }
  };
}

/** An error for the function log: its type and scrubbed message, never an item name. */
const errorShape = (e: unknown) => `${(e as Error)?.name ?? typeof e}: ${scrubMessage(e)}`;

const authHeader = (status: number): Record<string, string> =>
  status === 401 ? { 'www-authenticate': 'Bearer' } : {};
