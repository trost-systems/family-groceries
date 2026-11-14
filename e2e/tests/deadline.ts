// A deadline for requests a spec sends from Node (job 219c, docs/DECISIONS.md). Without one, a
// request the server never answers holds the test until its 60 s timeout, and the report names
// the test, not the request. No imports: e2e/deadline.test.mjs runs this file in plain Node.

/** Longer than any answer of the local stack, and well inside a test's 60 s. */
export const requestDeadlineMs = 15_000;

/**
 * `inner` with a deadline for the response headers: past it the request is aborted and the error
 * names the method, the URL and the time waited. The body is not timed, an event stream may stay
 * open; the caller's own signal, in `init` or on a `Request`, still aborts with its own reason.
 */
export function withDeadline(inner: typeof fetch, ms: number = requestDeadlineMs): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = input instanceof Request ? input : undefined;
    const method = init?.method ?? request?.method ?? 'GET';
    const url = request?.url ?? String(input);
    const deadline = new AbortController();
    const started = Date.now();
    const timer = setTimeout(() => deadline.abort(), ms);
    const callers = init?.signal ?? request?.signal;
    const signal = callers ? AbortSignal.any([callers, deadline.signal]) : deadline.signal;
    try {
      return await inner(input, { ...init, signal });
    } catch (e) {
      if (!deadline.signal.aborted || callers?.aborted) throw e;
      throw new Error(`no response headers after ${Date.now() - started} ms: ${method} ${url}`, { cause: e });
    } finally {
      clearTimeout(timer);
    }
  };
}

/** `fetch` that gives up, naming the request, when no response headers came within 15 s. */
export const deadlineFetch: typeof fetch = withDeadline((input, init) => fetch(input, init));
