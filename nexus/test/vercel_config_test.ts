import { assert, assertEquals } from '@std/assert';
import { csp, outputConfig } from '../scripts/vercel-config.ts';

Deno.test('every response gets the strict CSP and noindex; the snapshot is never cached', () => {
  const all = outputConfig.routes[0];
  assertEquals(all?.src, '/(.*)');
  assertEquals(all?.headers?.['Content-Security-Policy'], csp);
  assertEquals(all?.headers?.['X-Robots-Tag'], 'noindex, nofollow');
  assert(!csp.includes('unsafe'), 'no unsafe-inline or unsafe-eval');
  assert(csp.includes("connect-src 'self'") && csp.includes("script-src 'self'"));
  const snap = outputConfig.routes.find((r) =>
    r.src !== undefined && new RegExp(`^${r.src}$`).test('/data/snapshot.json') && r.src !== '/(.*)'
  );
  assertEquals(snap?.headers?.['Cache-Control'], 'no-store');
  assertEquals(all?.headers?.['Cache-Control'], undefined, 'only the snapshot route sets Cache-Control');
  assertEquals(outputConfig.routes.at(-1), { handle: 'filesystem' });
});
