// Read-only diagnosis of the production Alexa skill: which requests reached the `alexa` function,
// the Amazon Alexa client's OAuth steps and the alexa_links rows now (diagnose.sh, docs/ALEXA.md,
// "Troubleshooting"). Raw log rows carry IPs, e-mails, names and tokens: they are parsed into the
// types below from allow-listed fields only, and render() sees nothing else.
import type { InvalidTokenDetail } from '../../supabase/functions/_shared/auth.ts';
import { type ReplyKind, replyKinds } from '../../supabase/functions/alexa/handler.ts';

export const projectRef = 'jdwqrallbpdbshrdhenk';
const api = `https://api.supabase.com/v1/projects/${projectRef}`;
const hour = 3_600_000;
/** The logs API answers about 24 h per query. */
const maxWindowMs = 24 * hour;
const zone = 'Europe/Berlin';

export class UsageError extends Error {}
export class ApiError extends Error {}

export interface Window {
  from: Date;
  to: Date;
}

export interface RequestLine {
  type: string;
  intent: string;
  locale: string;
  linked: boolean;
  kind: ReplyKind;
  reason?: string;
  /** Job 170's `rid=… slot=… confirm=… ended=… error=… ms=…`, as logged; absent on older lines. */
  details?: string;
}

/** What the function logged for one call: its request line, a line we refuse to echo, or none. */
export type Logged =
  | { kind: 'line'; line: RequestLine }
  | { kind: 'unrecognised' }
  | { kind: 'missing' };

export interface Call {
  at: Date;
  method?: string;
  status?: number;
  ms?: number;
  logged: Logged;
}

export type OAuthStep = 'authorize' | 'authorization' | 'consent' | 'token';

export interface OAuthEvent {
  at: Date;
  step: OAuthStep;
  method: string;
  status: number;
  errorCode?: string;
  consent?: 'approve' | 'deny';
  grant?: 'authorization_code' | 'refresh_token';
  /** sha256 prefix of the authorization id (auth=) or the user id (user=). */
  ref?: { label: 'auth' | 'user'; hash: string };
  /** A failed token call: the log names no client, so it may be another client's (MCP). */
  clientUnknown?: boolean;
}

export interface Links {
  links: number;
  liveSessions: number;
  liveRefreshTokens: number;
  lastSeen: Date | null;
  alexaClientIds: string[];
  linkedUserIds: string[];
}

export interface Diagnosis {
  calls: Call[];
  oauth: OAuthEvent[];
  links: Links;
}

const word = '[\\w.:-]+';
const requestGrammar = new RegExp(
  `^alexa: (${word}) (${word}) (${word}) linked=(true|false) -> (${
    replyKinds.join('|')
  })(?: (${word}))?((?: [a-z]+=${word})*)$`,
);
// Job 170's details: the keys it logs, each value a short enum, count or id end.
const detail = /^(rid|slot|confirm|ended|error|ms)=(-|[A-Za-z0-9_]{1,32})$/;
// Tighter than the grammar: a field that could hold a token or an address never gets printed.
const fieldShapes = {
  type: /^(-|[A-Za-z.]{1,64})$/,
  intent: /^(-|[A-Za-z.]{1,64})$/,
  locale: /^(-|[a-z]{2}-[A-Z]{2})$/,
  reason: /^[a-z_]{1,32}(:[a-z_]{1,32})?$/,
};
/** The kinds that log a reason: a verifier refusal, a rejected link, a link event's token. */
const reasonKinds = new Set<ReplyKind>(['refused', 'link', 'empty']);

/**
 * What a rejected link token's reason means and what to do next (`-> link invalid_token:<detail>`,
 * job 170b). docs/ALEXA.md "Troubleshooting" and the voice runbook's X5 rows say the same.
 */
export const linkReasons: Record<InvalidTokenDetail, string> = {
  session_ended: "the link's session is gone (removed under Zugänge, signed out everywhere, " +
    'account deleted, or a reused refresh token revoked it). Link the skill again.',
  expired: 'Alexa sent an access token past its expiry, so its refresh failed. Look for a ' +
    'token refresh_token row with an error below (refresh_token_already_used: link again).',
  not_oauth: 'a valid Snacklist token, but an app session or API key, not an OAuth token. Check ' +
    "the skill's Client ID is the Amazon Alexa client (health.sh), then link again.",
  unknown_key: 'an API key or Siri credential Snacklist does not know. Check the Client ID and ' +
    'Access Token URI in the skill (docs/ALEXA.md, Account linking), then link again.',
  issuer: "the token comes from another auth server: the skill's Access Token URI points at " +
    'another project or host. Fix the URIs (docs/ALEXA.md, Account linking), then link again.',
  audience: 'a JWT that is no Supabase user token. Check the Access Token URI, then link again.',
  signature: "signed with a key this project does not publish: another project's token, or " +
    'signing keys rotated. Check the Access Token URI, then link again.',
  claims: 'a Supabase token without a user session (anon or service role). Check the Access ' +
    'Token URI and Client ID, then link again.',
  malformed: 'not a JWT. Check the Access Token URI, then link again.',
  unverified: 'the check itself failed (the key set did not load). Try once more; if it ' +
    'repeats, read the function logs for an auth outage before anyone relinks.',
};

function linkHint(reason: string): string | undefined {
  const [failure, detail] = reason.split(':');
  if (detail && Object.hasOwn(linkReasons, detail)) {
    return linkReasons[detail as InvalidTokenDetail];
  }
  if (failure === 'invalid_token') return 'the token was rejected. Link the skill again.';
  return undefined;
}

export function parseRequestLine(message: string): RequestLine | null {
  const m = requestGrammar.exec(message.trimEnd());
  if (!m) return null;
  const [, type, intent, locale, linked, kind, reason, trailer] = m;
  const details = trailer?.trim();
  if (
    !fieldShapes.type.test(type) || !fieldShapes.intent.test(intent) ||
    !fieldShapes.locale.test(locale) ||
    (reason !== undefined &&
      (!reasonKinds.has(kind as ReplyKind) || !fieldShapes.reason.test(reason))) ||
    (details && !details.split(' ').every((d) => detail.test(d)))
  ) return null;
  return {
    type,
    intent,
    locale,
    linked: linked === 'true',
    kind: kind as ReplyKind,
    reason,
    ...(details && { details }),
  };
}

export const formatLine = (l: RequestLine) =>
  `alexa: ${l.type} ${l.intent} ${l.locale} linked=${l.linked} -> ${l.kind}${
    l.reason ? ` ${l.reason}` : ''
  }${l.details ? ` ${l.details}` : ''}`;

const spokenTypes = new Set(['LaunchRequest', 'IntentRequest', 'SessionEndedRequest']);

type Raw = Record<string, unknown>;
const isRecord = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
const num = (v: unknown) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};
const pick = <T extends string>(v: unknown, shape: RegExp) =>
  typeof v === 'string' && shape.test(v) ? v as T : undefined;

/** Log timestamps: ISO without a zone (UTC) or microseconds since the epoch. */
export function logTime(v: unknown): Date | null {
  if (typeof v === 'number') return new Date(v / 1000);
  if (typeof v !== 'string') return null;
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(\.\d{1,3})?\d*(Z|[+-]\d\d:?\d\d)?$/.exec(v);
  if (!m) return /^\d+$/.test(v) ? new Date(Number(v) / 1000) : null;
  const at = new Date(`${m[1]}${m[2] ?? ''}${m[3] ?? 'Z'}`);
  return Number.isNaN(at.getTime()) ? null : at;
}

export async function sha8(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest).slice(0, 4), (b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function apiErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (isRecord(error) && typeof error.message === 'string') return error.message;
  return JSON.stringify(error);
}

export function logRows(body: unknown): Raw[] {
  if (!isRecord(body)) throw new ApiError('logs API: unexpected response');
  if (body.error) throw new ApiError(`logs API: ${apiErrorText(body.error)}`);
  if (!Array.isArray(body.result)) throw new ApiError('logs API: response has no result');
  return body.result.filter(isRecord);
}

export function parseLinks(body: unknown): Links {
  const row = Array.isArray(body) ? body[0] : undefined;
  if (!isRecord(row)) throw new ApiError(`database query: ${apiErrorText(body)}`);
  const strings = (v: unknown) => Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [];
  const lastSeen = str(row.last_seen);
  return {
    links: num(row.links) ?? 0,
    liveSessions: num(row.live_sessions) ?? 0,
    liveRefreshTokens: num(row.live_refresh_tokens) ?? 0,
    // Postgres text: '2026-11-03 07:21:17.12+00'.
    lastSeen: lastSeen
      ? new Date(lastSeen.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'))
      : null,
    alexaClientIds: strings(row.alexa_client_ids),
    linkedUserIds: strings(row.linked_user_ids),
  };
}

/** Pairs each edge row (status, duration) with the line its execution logged, in time order. */
function parseCalls(rows: Raw[]): Call[] {
  const byExecution = new Map<string, { edges: Raw[]; lines: Raw[] }>();
  const calls: Call[] = [];
  const toCall = (edge: Raw | undefined, line: Raw | undefined): Call | null => {
    const times = [edge, line].map((r) => r && logTime(r.timestamp)).filter((t) => t != null);
    if (times.length === 0) return null;
    const parsed = line && parseRequestLine(str(line.event_message) ?? '');
    return {
      at: new Date(Math.min(...times.map((t) => t.getTime()))),
      method: edge && pick(edge.method, /^[A-Z]{3,7}$/),
      status: edge && num(edge.status),
      ms: edge && num(edge.ms),
      logged: parsed
        ? { kind: 'line', line: parsed }
        : line
        ? { kind: 'unrecognised' }
        : { kind: 'missing' },
    };
  };
  for (const row of rows) {
    const id = str(row.execution_id);
    const edge = row.source === 'function_edge_logs';
    if (!id) {
      const call = edge ? toCall(row, undefined) : toCall(undefined, row);
      if (call) calls.push(call);
      continue;
    }
    const group = byExecution.get(id) ?? { edges: [], lines: [] };
    (edge ? group.edges : group.lines).push(row);
    byExecution.set(id, group);
  }
  for (const { edges, lines } of byExecution.values()) {
    for (let i = 0; i < Math.max(edges.length, lines.length); i++) {
      const call = toCall(edges[i], lines[i]);
      if (call) calls.push(call);
    }
  }
  return calls.sort((a, b) => a.at.getTime() - b.at.getTime());
}

function stepOf(path: string): { step: OAuthStep; authorization?: string } | null {
  if (path === '/oauth/authorize') return { step: 'authorize' };
  if (path === '/oauth/token') return { step: 'token' };
  const m = /^\/oauth\/authorizations\/([^/]+)(\/consent)?$/.exec(path);
  if (m) return { step: m[2] ? 'consent' : 'authorization', authorization: m[1] };
  return null;
}

const stepOrder: OAuthStep[] = ['authorize', 'authorization', 'consent', 'token'];

/** The Amazon Alexa client's OAuth steps; every other client's rows are dropped. */
async function parseOAuth(rows: Raw[], links: Links): Promise<OAuthEvent[]> {
  const alexaClients = new Set(links.alexaClientIds);
  const linkedUsers = new Set(links.linkedUserIds);
  const parsed = rows.flatMap((row) => {
    const at = logTime(row.timestamp);
    let msg: unknown;
    try {
      msg = JSON.parse(str(row.event_message) ?? '');
    } catch {
      return [];
    }
    if (!at || !isRecord(msg)) return [];
    const where = stepOf(str(msg.path) ?? '');
    const status = num(msg.status);
    return where && status !== undefined ? [{ at, msg, where, status }] : [];
  });
  // Consent rows name no client, only their authorization; the log has seconds only, so a flow's
  // rows can share a timestamp with the authorize row that names the client.
  const alexaAuthorizations = new Set(
    parsed.flatMap(({ msg }) =>
      alexaClients.has(str(msg.client_id) ?? '') && str(msg.authorization_id)
        ? [str(msg.authorization_id)!]
        : []
    ),
  );
  const events: OAuthEvent[] = [];
  for (const { at, msg, where, status } of parsed) {
    const base = {
      at,
      step: where.step,
      method: pick<string>(msg.method, /^[A-Z]{3,7}$/) ?? '?',
      status,
      errorCode: pick<string>(msg.error_code, /^[a-z_]{1,64}$/),
    };
    const authEvent = isRecord(msg.auth_event) ? msg.auth_event : {};
    const traits = isRecord(authEvent.traits) ? authEvent.traits : {};
    const actor = str(authEvent.actor_id);
    const user = actor ? { label: 'user' as const, hash: await sha8(actor) } : undefined;
    if (where.step === 'token') {
      const action = str(authEvent.action);
      if (traits.provider_type === 'oauth_provider_authorization_code') {
        if (alexaClients.has(str(traits.client_id) ?? '')) {
          events.push({ ...base, grant: 'authorization_code', ref: user });
        }
      } else if (action === 'token_refreshed' || action === 'token_revoked') {
        if (actor && linkedUsers.has(actor)) {
          events.push({ ...base, grant: 'refresh_token', ref: user });
        }
      } else if (status >= 400) {
        events.push({ ...base, clientUnknown: true });
      }
      continue;
    }
    const id = where.authorization ?? str(msg.authorization_id);
    if (!id || !alexaAuthorizations.has(id)) continue;
    events.push({
      ...base,
      consent: pick<'approve' | 'deny'>(msg.oauth_consent_action, /^(approve|deny)$/),
      ref: { label: 'auth', hash: await sha8(id) },
    });
  }
  return events.sort((a, b) =>
    a.at.getTime() - b.at.getTime() || stepOrder.indexOf(a.step) - stepOrder.indexOf(b.step)
  );
}

export async function diagnose(
  window: Window,
  logsBody: unknown,
  dbBody: unknown,
): Promise<Diagnosis> {
  const links = parseLinks(dbBody);
  const inWindow = (r: Raw) => {
    const at = logTime(r.timestamp);
    return at !== null && at >= window.from && at < window.to;
  };
  const rows = logRows(logsBody).filter(inWindow).sort((a, b) =>
    logTime(a.timestamp)!.getTime() - logTime(b.timestamp)!.getTime()
  );
  return {
    calls: parseCalls(rows.filter((r) => r.source !== 'auth_logs')),
    oauth: await parseOAuth(rows.filter((r) => r.source === 'auth_logs'), links),
    links,
  };
}

const berlinFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: zone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

function berlin(at: Date) {
  const p = Object.fromEntries(berlinFormat.formatToParts(at).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}:${p.second}` };
}

const utcTime = (at: Date) => at.toISOString().slice(11, 16) + 'Z';

/** Berlin wall-clock time to an instant; tries the offset at the naive instant, then corrects. */
function fromBerlin(y: number, mo: number, d: number, h: number, mi: number): Date {
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  const offsetAt = (t: number) => {
    const b = berlin(new Date(t));
    const [by, bmo, bd] = b.date.split('-').map(Number);
    const [bh, bmi, bs] = b.time.split(':').map(Number);
    return Date.UTC(by, bmo - 1, bd, bh, bmi, bs) - t;
  };
  return new Date(naive - offsetAt(naive - offsetAt(naive)));
}

export function parseTime(value: string): Date {
  const local = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)$/.exec(value);
  if (local) {
    const [y, mo, d, h, mi] = local.slice(1).map(Number);
    return fromBerlin(y, mo, d, h, mi);
  }
  if (/^\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d(\.\d+)?)?(Z|[+-]\d\d:\d\d)$/.test(value)) {
    const at = new Date(value);
    if (!Number.isNaN(at.getTime())) return at;
  }
  throw new UsageError(
    `cannot read the time '${value}': use 'YYYY-MM-DD HH:MM' (Europe/Berlin) or ISO with Z`,
  );
}

function windowLine({ from, to }: Window): string {
  const a = berlin(from), b = berlin(to);
  const local = a.date === b.date
    ? `${a.date} ${a.time.slice(0, 5)} to ${b.time.slice(0, 5)}`
    : `${a.date} ${a.time.slice(0, 5)} to ${b.date} ${b.time.slice(0, 5)}`;
  return `Window ${local} ${zone} (${utcTime(from)} to ${utcTime(to)})`;
}

function callLine(call: Call): string {
  const method = call.method ?? '-';
  const status = call.status ?? '-';
  const ms = call.ms === undefined ? '' : `  ${call.ms} ms`;
  const logged = call.logged.kind === 'line'
    ? formatLine(call.logged.line)
    : call.logged.kind === 'unrecognised'
    ? '(unrecognised alexa line)'
    : 'no request line (crashed or timed out before logging)';
  return `  ${berlin(call.at).time}  ${method} ${status}${ms}  ${logged}`;
}

function oauthLine(e: OAuthEvent): string {
  const step = [e.step, e.consent ?? e.grant].filter(Boolean).join(' ');
  const status = [e.method, e.status, e.errorCode].filter((x) => x !== undefined).join(' ');
  const ref = e.ref ? `  ${e.ref.label}=${e.ref.hash}` : '';
  const unknown = e.clientUnknown ? '  (the log names no client: may be another one)' : '';
  return `  ${berlin(e.at).time}  ${step}  ${status}${ref}${unknown}`;
}

export function render(window: Window, d: Diagnosis): string {
  const out = [`Alexa diagnosis, project ${projectRef}`, windowLine(window), ''];

  out.push(`Requests to the alexa function (${d.calls.length})`);
  if (d.calls.length === 0) out.push('  nothing in this window');
  out.push(...d.calls.map(callLine));
  const lines = d.calls.flatMap((c) => c.logged.kind === 'line' ? [c.logged.line] : []);
  if (!lines.some((l) => spokenTypes.has(l.type))) {
    out.push(
      '  No LaunchRequest, IntentRequest or SessionEndedRequest: Alexa never sent a spoken ' +
        'request in this window (docs/ALEXA.md, Troubleshooting).',
    );
  }
  if (lines.some((l) => l.kind === 'refused')) {
    out.push(
      '  refused: the request failed verification (wrong_skill: the ALEXA_SKILL_ID secret; ' +
        'stale_timestamp: a clock off by more than 150 s; cert_* or bad_signature: not from Amazon).',
    );
  }
  const rejected = new Set(
    lines.flatMap((l) => l.kind !== 'refused' && l.reason ? [l.reason] : []),
  );
  for (const reason of rejected) {
    const hint = linkHint(reason);
    if (hint) out.push(`  link ${reason}: ${hint}`);
  }
  out.push('');

  out.push('Account linking (OAuth, Amazon Alexa client)');
  if (d.links.alexaClientIds.length === 0) {
    out.push("  No OAuth client named 'Amazon Alexa' exists: account linking cannot work.");
  }
  if (d.oauth.length === 0) out.push('  nothing in this window');
  out.push(...d.oauth.map(oauthLine));
  if (d.oauth.some((e) => e.errorCode === 'refresh_token_already_used')) {
    out.push(
      '  refresh_token_already_used: a rotated refresh token came back, so Supabase revoked the ' +
        'session. The link is dead: link the skill again in the Alexa app.',
    );
  }
  if (d.oauth.some((e) => e.step === 'authorization' && e.errorCode === 'bad_jwt')) {
    out.push(
      '  bad_jwt on authorization: the browser sign-in had expired; the consent page asks again.',
    );
  }
  out.push('');

  const l = d.links;
  const seen = l.lastSeen
    ? `, last seen ${berlin(l.lastSeen).date} ${berlin(l.lastSeen).time}`
    : '';
  out.push(
    `alexa_links now: ${l.links} links, ${l.liveSessions} live sessions, ` +
      `${l.liveRefreshTokens} live refresh tokens${seen}`,
  );
  if (l.links > 0 && l.liveSessions === 0) {
    out.push('  No link has a live session: Alexa holds dead tokens. Link the skill again.');
  }
  return out.join('\n') + '\n';
}

const usage = `Usage: scripts/alexa/diagnose.sh [--last 6h|90m | --from 'YYYY-MM-DD HH:MM' --to '…']
       [--fixture <dir>]
Times are Europe/Berlin (or ISO with Z or an offset); the window is at most 24 h.
--fixture reads <dir>/logs.json and <dir>/db.json instead of the Management API.`;

export interface Options {
  window: Window;
  fixture?: string;
}

export function parseArgs(args: string[], now = new Date()): Options {
  const values: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (!['--from', '--to', '--last', '--fixture'].includes(flag)) {
      throw new UsageError(`unknown argument '${flag}'`);
    }
    if (i + 1 >= args.length) throw new UsageError(`${flag} needs a value`);
    values[flag.slice(2)] = args[++i];
  }
  let window: Window;
  if (values.from !== undefined || values.to !== undefined) {
    if (values.last !== undefined) throw new UsageError('use either --last or --from/--to');
    if (values.from === undefined || values.to === undefined) {
      throw new UsageError('--from and --to go together');
    }
    window = { from: parseTime(values.from), to: parseTime(values.to) };
  } else {
    const m = /^(\d+)(h|m)$/.exec(values.last ?? '6h');
    if (!m) throw new UsageError(`--last takes hours or minutes, like 6h or 90m`);
    const span = Number(m[1]) * (m[2] === 'h' ? hour : 60_000);
    window = { from: new Date(now.getTime() - span), to: now };
  }
  const span = window.to.getTime() - window.from.getTime();
  if (span <= 0) throw new UsageError('the window ends before it starts');
  if (span > maxWindowMs) {
    throw new UsageError(
      `the window is ${
        Math.round(span / hour * 10) / 10
      } h: the logs API returns at most 24 h per query, split it`,
    );
  }
  return { window, fixture: values.fixture };
}

const logsSql =
  `select timestamp, source, event_message, log_attributes['execution_id'] as execution_id, log_attributes['response.status_code'] as status, log_attributes['execution_time_ms'] as ms, log_attributes['request.method'] as method from logs where (source = 'function_logs' and event_message like 'alexa: %') or (source = 'function_edge_logs' and log_attributes['request.pathname'] = '/functions/v1/alexa') or (source = 'auth_logs' and event_message like '%/oauth/%') order by timestamp limit 2000`;

const dbSql = `select
  (select count(*) from public.alexa_links)::int as links,
  (select count(*) from public.alexa_links l join auth.sessions s on s.id = l.session_id)::int
    as live_sessions,
  (select count(*) from public.alexa_links l
     join auth.refresh_tokens r on r.session_id::uuid = l.session_id and not r.revoked)::int
    as live_refresh_tokens,
  (select max(last_seen)::text from public.alexa_links) as last_seen,
  (select coalesce(json_agg(id::text), '[]'::json) from auth.oauth_clients
     where client_name = 'Amazon Alexa' and deleted_at is null) as alexa_client_ids,
  (select coalesce(json_agg(distinct user_id::text), '[]'::json) from public.alexa_links)
    as linked_user_ids`;

/** The Management API throttles back-to-back calls ("ThrottlerException: Too Many Requests"). */
async function call(url: string, init: RequestInit, what: string): Promise<unknown> {
  for (let attempt = 0;; attempt++) {
    const res = await fetch(url, init);
    const text = await res.text();
    if ((res.status === 429 || text.includes('ThrottlerException')) && attempt < 3) {
      console.error(`${what}: throttled, retrying in 20 s`);
      await new Promise((r) => setTimeout(r, 20_000));
      continue;
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const message = isRecord(body) ? apiErrorText(body.message ?? body.error ?? body) : text;
      throw new ApiError(`${what}: HTTP ${res.status} ${message.slice(0, 500)}`);
    }
    if (body === undefined) throw new ApiError(`${what}: response is not JSON`);
    return body;
  }
}

async function fetchBodies(window: Window): Promise<[unknown, unknown]> {
  const token = Deno.env.get('SUPABASE_ACCESS_TOKEN');
  if (!token) {
    throw new UsageError('SUPABASE_ACCESS_TOKEN is not set (the ops env, FG_OPS_ENV, sets it)');
  }
  const headers = { Authorization: `Bearer ${token}` };
  const params = new URLSearchParams({
    sql: logsSql,
    iso_timestamp_start: window.from.toISOString(),
    iso_timestamp_end: window.to.toISOString(),
  });
  const logs = await call(`${api}/analytics/endpoints/logs?${params}`, { headers }, 'logs API');
  const db = await call(`${api}/database/query/read-only`, {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json' },
    body: JSON.stringify({ query: dbSql }),
  }, 'database query');
  return [logs, db];
}

async function readFixture(dir: string): Promise<[unknown, unknown]> {
  const read = async (name: string) => {
    try {
      return JSON.parse(await Deno.readTextFile(`${dir}/${name}`));
    } catch (e) {
      throw new UsageError(`--fixture: cannot read ${dir}/${name}: ${(e as Error).message}`);
    }
  };
  return [await read('logs.json'), await read('db.json')];
}

async function main(args: string[]): Promise<number> {
  try {
    if (args.includes('--help') || args.includes('-h')) {
      console.log(usage);
      return 0;
    }
    const options = parseArgs(args);
    const [logs, db] = options.fixture
      ? await readFixture(options.fixture)
      : await fetchBodies(options.window);
    const result = await diagnose(options.window, logs, db);
    await Deno.stdout.write(new TextEncoder().encode(render(options.window, result)));
    return 0;
  } catch (e) {
    if (e instanceof UsageError) {
      console.error(`${e.message}\n\n${usage}`);
      return 2;
    }
    if (e instanceof ApiError) {
      console.error(e.message);
      return 1;
    }
    throw e;
  }
}

if (import.meta.main) Deno.exit(await main(Deno.args));
