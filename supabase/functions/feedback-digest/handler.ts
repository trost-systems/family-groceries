// The daily feedback digest (docs/FEEDBACK.md, "Daily digest"). pg_cron posts here hourly once
// feedback_digest_set(true, ...) has switched it on; only the 08:00 Berlin run finds notes.
//   POST /feedback-digest         x-feedback-digest-secret = FEEDBACK_DIGEST_SECRET: mails the
//                                 day's notes to hello@snacklist.app and moves the watermark.
//                                 200 {"status":"disabled"|"empty"|"sent"|"raced"}, 502 failed,
//                                 503 without the secret or the Resend key, 401 wrong secret.
//   GET  /feedback-digest/status  200 {"enabled","healthy"} for the watch workflow, no secret.
// Answers and logs never carry a note or an address: pg_net keeps answers in net._http_response,
// and logs are fixed codes ("feedback-digest: sent") plus at most a SQLSTATE or HTTP status.
import { type Mailer, MailError, RESEND_API_URL, resendMailer } from '../_shared/resend.ts';
import { sameSecret, sha256Hex } from '../waitlist/crypto.ts';
import { DIGEST_FROM, DIGEST_TO, type DigestMail, digestMail } from './mail.ts';

/** One note as feedback_digest_batch returns it. Times are text with microseconds. */
export interface Note {
  id: string;
  'created_at': string;
  /** "YYYY-MM-DD HH:MI", Berlin time. */
  'created_berlin': string;
  category: 'bug' | 'idea' | 'other' | null;
  message: string;
  platform: string;
  'app_version': string;
  build: string;
  premium: boolean;
  'contact_ok': boolean;
  /** Only when contact_ok. */
  email: string | null;
}

export interface Watermark {
  'created_at': string;
  id: string;
}

export interface OpenBatch {
  enabled: true;
  'digest_on': string;
  since: Watermark;
  notes: Note[];
}

export type Batch = { enabled: false } | OpenBatch;

export type RunError = 'send_failed' | 'db_error' | 'mail_not_configured';

/** The feedback_digest_* SQL functions (migration *_feedback_digest.sql). */
export interface Store {
  batch(now: Date): Promise<Batch>;
  /** Compare-and-set: false when another run already moved the watermark. */
  advance(from: Watermark, to: Watermark, digestOn: string): Promise<boolean>;
  record(error: RunError | null): Promise<void>;
  status(): Promise<{ enabled: boolean; healthy: boolean }>;
}

export interface Deps {
  /** FEEDBACK_DIGEST_SECRET; null answers every run 503. */
  secret: string | null;
  store: Store;
  /** Null without RESEND_API_KEY. */
  mailer: Mailer | null;
  now(): Date;
}

export function configFrom(
  env: { get(key: string): string | undefined },
): Pick<Deps, 'secret' | 'mailer'> {
  const apiKey = env.get('RESEND_API_KEY');
  return {
    secret: env.get('FEEDBACK_DIGEST_SECRET') || null,
    mailer: apiKey ? resendMailer(apiKey, env.get('RESEND_API_URL') || RESEND_API_URL) : null,
  };
}

const log = (code: string) => console.log(`feedback-digest: ${code}`);

/** The SQLSTATE or Resend's HTTP status of a failure, never its message. */
function failure(code: string, e: unknown) {
  if (e instanceof MailError) return log(`${code} ${e.status}`);
  const state = typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
  log(typeof state === 'string' && /^[0-9A-Z]{5}$/.test(state) ? `${code} ${state}` : code);
}

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });

/**
 * The same window renders the same mail, so a rerun after a lost advance sends the same key and
 * Resend delivers it once (24 h).
 */
export async function idempotencyKey(digestOn: string, mail: DigestMail): Promise<string> {
  const hash = await sha256Hex(mail.subject + mail.text + mail.html);
  return `feedback-digest/${digestOn}/${hash.slice(0, 32)}`;
}

const ROUTE = /^\/(?:functions\/v1\/)?feedback-digest(\/status)?\/?$/;

export function createHandler(deps: Deps): (req: Request) => Promise<Response> {
  const { store } = deps;

  async function run(): Promise<Response> {
    const batch = await store.batch(deps.now());
    if (!batch.enabled) {
      log('disabled');
      return answer(200, { status: 'disabled' });
    }
    const last = batch.notes.at(-1);
    if (!last) {
      await store.record(null);
      log('empty');
      return answer(200, { status: 'empty' });
    }
    if (!deps.mailer) {
      await store.record('mail_not_configured');
      log('mail_not_configured');
      return answer(503, { error: 'mail_not_configured' });
    }
    const mail = digestMail(batch);
    try {
      await deps.mailer.send(
        DIGEST_TO,
        { from: DIGEST_FROM, ...mail },
        await idempotencyKey(batch.digest_on, mail),
      );
    } catch (e) {
      failure('send_failed', e);
      await store.record('send_failed');
      return answer(502, { status: 'failed' });
    }
    const moved = await store.advance(
      batch.since,
      { created_at: last.created_at, id: last.id },
      batch.digest_on,
    );
    await store.record(null);
    if (!moved) {
      log('raced');
      return answer(200, { status: 'raced' });
    }
    log('sent');
    return answer(200, { status: 'sent', count: batch.notes.length });
  }

  return async (req) => {
    const route = new URL(req.url).pathname.match(ROUTE);
    if (!route) return answer(404, { error: 'not_found' });
    if (route[1]) {
      if (req.method !== 'GET') return answer(404, { error: 'not_found' });
      try {
        const { enabled, healthy } = await store.status();
        return answer(200, { enabled, healthy });
      } catch (e) {
        failure('status_failed', e);
        return answer(500, { error: 'failed' });
      }
    }
    if (req.method !== 'POST') return answer(404, { error: 'not_found' });
    if (!deps.secret) {
      log('not_configured');
      return answer(503, { error: 'not_configured' });
    }
    if (!await sameSecret(req.headers.get('x-feedback-digest-secret') ?? '', deps.secret)) {
      log('unauthorized');
      return answer(401, { error: 'unauthorized' });
    }
    try {
      return await run();
    } catch (e) {
      failure('db_error', e);
      await store.record('db_error').catch(() => {});
      return answer(500, { error: 'failed' });
    }
  };
}
