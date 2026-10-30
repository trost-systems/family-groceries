// Error tracking and server-side analytics events for the edge functions, sent to PostHog EU
// (docs/ANALYTICS.md). Off without POSTHOG_PROJECT_API_KEY; only https://eu.i.posthog.com is
// accepted as POSTHOG_HOST. An exception carries the function name, its message reduced to the
// runtime's own template words and code locations: never the request body, headers, tokens or
// item text. Events pass an allow-list.
//
// Use: `Deno.serve(withTelemetry('voice', handler))`. Errors a handler catches itself go through
// `telemetry.exception(e)`; the wrapper sends everything queued before the response returns.

export const posthogEuHost = 'https://eu.i.posthog.com';

export interface Env {
  get(key: string): string | undefined;
}

type Fetch = typeof fetch;

interface Config {
  key: string;
  host: string;
  /** Events from this deployment count as internal (local proofs, the test project). */
  internal: boolean;
}

/** Event name to its allowed properties, each a check on the value. Server events only. */
export type Rule = (value: unknown) => boolean;

const oneOf = (...values: string[]): Rule => (v) => typeof v === 'string' && values.includes(v);
const matches = (re: RegExp): Rule => (v) => typeof v === 'string' && re.test(v);
const amount: Rule = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v < 10_000;
const uuid = matches(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);

const revenue: Record<string, Rule> = {
  product_id: matches(/^[a-z0-9_.]{1,64}$/),
  price: amount,
  currency: matches(/^[A-Z]{3}$/),
  app_store: oneOf('apple', 'google'),
  country: matches(/^[A-Z]{2}$/),
  net_amount: amount,
  transaction_ref: matches(/^[0-9a-f]{32}$/),
};

/**
 * The events a function may send (docs/ANALYTICS.md, "Purchases"). Adding one: list it here,
 * with a rule per property, and add a case to telemetry_test.ts.
 */
export const serverEventCatalog: Record<string, Record<string, Rule>> = {
  purchase_completed: revenue,
  purchase_refunded: revenue,
  purchase_restored: { product_id: revenue.product_id, app_store: revenue.app_store },
};

/** Properties every server event carries besides its own. */
const contextRules: Record<string, Rule> = {
  distinct_id: uuid,
  install_id: uuid,
  household_id: (v) => v === null || uuid(v),
  event_id: uuid,
  platform: oneOf('server'),
  app_version: oneOf('server'),
  is_internal: (v) => typeof v === 'boolean',
  $geoip_disable: (v) => v === true,
  $process_person_profile: (v) => v === false,
  $lib: oneOf('hummlist-edge'),
};

export class RefusedEvent extends Error {}

/** Throws [RefusedEvent] (naming the property, never the value) unless all is allowed. */
export function checkServerEvent(event: string, properties: Record<string, unknown>): void {
  const rules = serverEventCatalog[event];
  if (!rules) throw new RefusedEvent(`unknown event ${event}`);
  for (const [key, value] of Object.entries(properties)) {
    const rule = rules[key] ?? contextRules[key];
    if (!rule) throw new RefusedEvent(`${event} does not carry ${key}`);
    if (!rule(value)) throw new RefusedEvent(`${event}.${key} has a value its rule refuses`);
  }
}

/** Where an event goes: an install that said yes in the app, and its household. */
export interface Subject {
  installId: string;
  householdId: string | null;
}

export class Telemetry {
  #queue: Record<string, unknown>[] = [];

  constructor(
    readonly fn: string,
    readonly config: Config | null,
    readonly fetchImpl: Fetch = fetch,
  ) {}

  get enabled(): boolean {
    return this.config !== null;
  }

  /** Queued, unsent events; for tests. */
  get queued(): readonly Record<string, unknown>[] {
    return this.#queue;
  }

  /** Queues [error] for PostHog error tracking, tagged with the function name. */
  exception(error: unknown, { handled = true }: { handled?: boolean } = {}): void {
    if (!this.config) return;
    try {
      const id = crypto.randomUUID();
      this.#queue.push({
        event: '$exception',
        uuid: id,
        timestamp: new Date().toISOString(),
        properties: {
          distinct_id: `edge-function-${this.fn}`,
          event_id: id,
          function_name: this.fn,
          platform: 'server',
          is_internal: this.config.internal,
          $exception_level: 'error',
          $exception_list: exceptionList(error, handled),
          $geoip_disable: true,
          $process_person_profile: false,
          $lib: 'hummlist-edge',
        },
      });
    } catch (e) {
      // Reporting an error must never raise one.
      console.error(`${this.fn}: exception not captured`, (e as Error)?.name);
    }
  }

  /** Queues a server event for [subject]; refuses anything the catalog does not allow. */
  event(event: string, subject: Subject, properties: Record<string, unknown>): boolean {
    if (!this.config) return false;
    const id = crypto.randomUUID();
    const all = {
      ...properties,
      distinct_id: subject.installId,
      install_id: subject.installId,
      household_id: subject.householdId,
      event_id: id,
      platform: 'server',
      app_version: 'server',
      is_internal: this.config.internal,
      $geoip_disable: true,
      $process_person_profile: false,
      $lib: 'hummlist-edge',
    };
    try {
      checkServerEvent(event, all);
    } catch (e) {
      console.error(`${this.fn}: ${(e as Error).message}`);
      return false;
    }
    this.#queue.push({ event, uuid: id, timestamp: new Date().toISOString(), properties: all });
    return true;
  }

  /** Sends what is queued; never throws. Bounded, so a slow PostHog never holds a response. */
  async flush(timeoutMs = 3_000): Promise<void> {
    if (!this.config || this.#queue.length === 0) return;
    const batch = this.#queue.splice(0);
    try {
      const response = await this.fetchImpl(`${this.config.host}/batch/`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ api_key: this.config.key, batch }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      await response.body?.cancel();
      if (!response.ok) console.error(`${this.fn}: telemetry answered ${response.status}`);
    } catch (e) {
      console.error(`${this.fn}: telemetry not sent`, (e as Error)?.name);
    }
  }
}

/** PostHog's project key shape; a personal key (phx_) is never accepted. */
export const projectKeyLike = (key: string) => /^phc_[A-Za-z0-9_-]{8,64}$/.test(key);

/** Telemetry for function [fn] from the environment; disabled without a valid key and host. */
export function telemetryFor(fn: string, env: Env = Deno.env, fetchImpl: Fetch = fetch): Telemetry {
  const key = env.get('POSTHOG_PROJECT_API_KEY') ?? '';
  const host = env.get('POSTHOG_HOST') ?? '';
  if (!projectKeyLike(key) || host !== posthogEuHost) {
    if (key) console.error(`${fn}: telemetry off, the key or host is not accepted`);
    return new Telemetry(fn, null, fetchImpl);
  }
  return new Telemetry(
    fn,
    { key, host, internal: env.get('ANALYTICS_INTERNAL') === 'true' },
    fetchImpl,
  );
}

/**
 * Wraps a function's handler: an exception it does not catch is reported and answered with 500,
 * and whatever the request queued is sent before the response returns.
 */
export function withTelemetry(
  fn: string,
  handler: (req: Request) => Response | Promise<Response>,
  telemetry: Telemetry = telemetryFor(fn),
): (req: Request) => Promise<Response> {
  return async (req) => {
    let response: Response;
    try {
      response = await handler(req);
    } catch (e) {
      console.error(`${fn}: unhandled`, e);
      telemetry.exception(e, { handled: false });
      response = new Response(JSON.stringify({ error: 'server' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
    await telemetry.flush();
    return response;
  };
}

// ---------------------------------------------------------------------------------------------
// The exception, as PostHog's $exception_list wants it.

const runtimeErrors = [TypeError, RangeError, ReferenceError, SyntaxError, EvalError, URIError];

/** A runtime error's first line reduced to its shape; a code for anything else. */
export function scrubMessage(error: unknown): string {
  if (runtimeErrors.some((t) => error instanceof t)) {
    const first = String((error as Error).message ?? '').split('\n')[0];
    return shape(scrub(first)).slice(0, 120);
  }
  const code = (error as { code?: unknown } | null)?.code ??
    (error as { status?: unknown } | null)?.status;
  const text = typeof code === 'number' ? String(code) : code;
  return typeof text === 'string' && /^[A-Za-z0-9_.:-]{1,64}$/.test(text) ? text : '<redacted>';
}

const scrub = (text: string) =>
  text
    .replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, '<url>')
    .replace(/[^\s@]+@[^\s@]+/g, '<email>')
    .replace(/"[^"]*"|'[^']*'|„[^“”]*[“”]|“[^”]*”|‘[^’]*’|«[^»]*»|`[^`]*`/g, '<redacted>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/[0-9]{6,}/g, '<n>');

/**
 * Words of V8's and Deno's own error templates. Any other word came from a value (an item, a
 * name, a key) and becomes <w>, so `cannot parse Hafermilch` reads `cannot <w>`.
 */
const templateWords = new Set(
  `a abort aborted access already an and argument arguments array assignment async at await been
  before between bigint body bounds buffer call called cannot character class code column
  constant constructor convert create date decode declared deep defined detached digits element
  empty encode end error exceeded expected explicit expression extensible failed fetch field
  flags fraction frozen function generator getter has in index initial initialization input
  instance invalid is iterable iterator json keyword left length line literal locked malformed
  maximum member method missing mix mode must network new non not null number object of offset
  on only or out position precision primitive private promise properties property radix range
  read reading recursion redefine reduce regular request reserved response right sealed set
  setter setting side size stack strict stream string super symbol the this time timed to token
  too type types undefined unexpected unterminated uri use used valid value variable with without
  writable`.split(/\s+/),
);

const marker = /^<(?:url|email|redacted|uuid|n)>$/;

const shape = (text: string) =>
  text
    .replace(/<[a-z]+>|[\p{L}\p{N}_$]+(?:\.[\p{L}\p{N}_$]+)*/gu, (word) => {
      if (marker.test(word)) return word;
      if (/^\p{N}+$/u.test(word)) return '<n>';
      return templateWords.has(word.toLowerCase()) ? word : '<w>';
    })
    .replace(/<w>(?:\s*<w>)+/g, '<w>');

function exceptionList(error: unknown, handled: boolean): Record<string, unknown>[] {
  const type = error instanceof Error ? error.name || error.constructor.name : typeof error;
  const frames = error instanceof Error ? framesOf(error.stack ?? '') : [];
  return [{
    type: /^[A-Za-z0-9_$.]{1,64}$/.test(type) ? type : 'Error',
    value: scrubMessage(error),
    mechanism: { handled, synthetic: frames.length === 0, type: 'generic' },
    ...(frames.length ? { stacktrace: { type: 'raw', frames } } : {}),
  }];
}

const v8Frame = /^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/;

/** V8 frames, crash site last; files relative to the functions directory, no device paths. */
export function framesOf(stack: string): Record<string, unknown>[] {
  const frames: Record<string, unknown>[] = [];
  for (const line of stack.split('\n').slice(1, 81)) {
    const m = v8Frame.exec(line);
    if (!m) continue;
    const [, fn, file, lineno, colno] = m;
    const path = file.replace(/^file:\/\//, '').replace(/[?#].*$/, '');
    const inFunctions = path.match(/\/functions\/(.+)$/)?.[1];
    const filename = inFunctions ?? path.split('/').pop() ?? '';
    frames.push({
      platform: 'node:javascript',
      filename,
      abs_path: filename,
      function: fn ? fn.slice(0, 200) : '<anonymous>',
      lineno: Number(lineno),
      colno: Number(colno),
      in_app: inFunctions !== undefined && !inFunctions.includes('node_modules'),
    });
  }
  return frames.reverse();
}
