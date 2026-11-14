// Response helpers shared by every edge function.

export const corsHeaders: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

export function json(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(corsHeaders)) headers.set(key, value);
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS'
    ? new Response(null, { status: 204, headers: corsHeaders })
    : null;
}

/**
 * How much of a request body an answer waits for when its handler left the body unread: sixteen
 * times the largest cap a handler sets itself (64 KiB, the API's and the purchases webhook's); the
 * other handlers read whatever arrives (the MCP SDK up to 4 MiB).
 */
export const UNREAD_BODY_BYTES = 1024 * 1024;

/**
 * How long an answer waits for an unread body. A body arrives within milliseconds of its head; a
 * caller that stalls mid-body would otherwise hold its answer, and the worker, for as long as it
 * likes.
 */
export const UNREAD_BODY_MS = 5_000;

/**
 * Reads the rest of a request body and throws it away, so the answer leaves only after the
 * request has arrived. The edge runtime (v1.77.4 and v1.77.8) loses a streamed answer whose head
 * it sees while it still passes the request body on: the caller gets no byte and waits for its
 * own timeout (job 219c, docs/DECISIONS.md). Past `limit` bytes or `ms` the body is cancelled
 * instead.
 */
export async function discardUnreadBody(
  req: Request,
  limit = UNREAD_BODY_BYTES,
  ms = UNREAD_BODY_MS,
): Promise<void> {
  if (!req.body || req.bodyUsed || req.body.locked) return;
  const reader = req.body.getReader();
  const late = setTimeout(() => void reader.cancel().catch(() => {}), ms);
  try {
    for (let size = 0;;) {
      const { done, value } = await reader.read();
      if (done) return;
      size += value.byteLength;
      if (size > limit) return await reader.cancel();
    }
  } catch {
    // The caller went away mid-body: nothing is left to wait for, and the handler's answer stands.
  } finally {
    clearTimeout(late);
  }
}
