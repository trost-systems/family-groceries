// The Build Output API v3 config (.vercel/output/config.json): a static site with strict headers.
//   deno run --allow-write scripts/vercel-config.ts <out/config.json>

export const csp = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

export interface Route {
  src?: string;
  headers?: Record<string, string>;
  continue?: boolean;
  handle?: 'filesystem';
}

export const outputConfig: { version: 3; routes: Route[] } = {
  version: 3,
  routes: [
    {
      src: '/(.*)',
      headers: {
        'Content-Security-Policy': csp,
        'X-Robots-Tag': 'noindex, nofollow',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer',
      },
      continue: true,
    },
    { src: '/data/snapshot\\.json', headers: { 'Cache-Control': 'no-store' }, continue: true },
    { handle: 'filesystem' },
  ],
};

if (import.meta.main) {
  const [out] = Deno.args;
  if (out === undefined) throw new Error('usage: vercel-config.ts <config.json>');
  await Deno.writeTextFile(out, JSON.stringify(outputConfig, null, 2) + '\n');
}
