import { databaseAnswers } from '../_shared/db.ts';
import { json, preflight } from '../_shared/http.ts';

/** 200 only when Postgres answers a read: deploy smoke tests and the keepalive rely on it. */
export async function handle(
  req: Request,
  database: () => Promise<boolean> = databaseAnswers,
  timeoutMs = 5000,
): Promise<Response> {
  const early = preflight(req);
  if (early) return early;
  // Without a deadline a dead database takes the driver's 30 s connect timeout, longer than
  // the callers wait, and they see a timeout instead of the 503.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${timeoutMs} ms`)), timeoutMs);
  });
  const ok = await Promise.race([database(), deadline])
    .catch((e) => {
      console.error('health: database read failed', e);
      return false;
    })
    .finally(() => clearTimeout(timer));
  return json({ ok, service: 'family-groceries', database: ok }, { status: ok ? 200 : 503 });
}
