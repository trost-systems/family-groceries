// mcp-proxy/vercel.json decides per request whether mcp.hummlist.com shows the page for people
// (mcp-proxy/public) or forwards to the mcp function. This replays real browser and MCP client
// requests through its rewrites the way Vercel's router reads them: the filesystem first, then
// the first rewrite whose source, `has` and `missing` match. Vercel does not document whether a
// `value` regex must match the whole header, so every case runs both ways and must agree.
// Usage: deno test --config scripts/deno.json --allow-read scripts/mcp-proxy-routes_test.ts
import { assert, assertEquals } from '@std/assert';

interface Condition {
  type: 'header';
  key: string;
  value?: string;
}

interface Rewrite {
  source: string;
  destination: string;
  has?: Condition[];
  missing?: Condition[];
}

type Anchoring = 'whole value' | 'substring';

const proxyDir = new URL('../mcp-proxy/', import.meta.url);
const config: { outputDirectory: string; cleanUrls: boolean; rewrites: Rewrite[] } = JSON.parse(
  Deno.readTextFileSync(new URL('vercel.json', proxyDir)),
);
const publicDir = new URL(`${config.outputDirectory}/`, proxyDir);
const fn = 'https://jdwqrallbpdbshrdhenk.supabase.co/functions/v1/mcp';

function sourceMatches(source: string, path: string): boolean {
  if (source === '/:path*') return true;
  assert(!source.includes(':'), `this test reads literal sources and /:path* only, not ${source}`);
  return source === path;
}

function holds(condition: Condition, headers: Headers, anchoring: Anchoring): boolean {
  assertEquals(condition.type, 'header', 'this test reads header conditions only');
  const value = headers.get(condition.key);
  if (value === null) return false;
  if (condition.value === undefined) return true;
  const pattern = anchoring === 'whole value' ? `^(?:${condition.value})$` : condition.value;
  return new RegExp(pattern).test(value);
}

function staticFile(path: string): string | undefined {
  const name = path.slice(1) + (config.cleanUrls && !path.includes('.') ? '.html' : '');
  try {
    return Deno.statSync(new URL(name, publicDir)).isFile ? name : undefined;
  } catch {
    return undefined;
  }
}

/** What Vercel serves for a request: `public/<file>` or the function URL it forwards to. */
function route(path: string, init: Record<string, string>, anchoring: Anchoring): string {
  const headers = new Headers(init);
  const own = staticFile(path);
  if (own !== undefined) return `public/${own}`;
  for (const rule of config.rewrites) {
    if (!sourceMatches(rule.source, path)) continue;
    if (!(rule.has ?? []).every((c) => holds(c, headers, anchoring))) continue;
    if ((rule.missing ?? []).some((c) => holds(c, headers, anchoring))) continue;
    if (rule.destination.startsWith('https://')) {
      return rule.destination.replace(':path*', path.slice(1)).replace(/\?via=mcp-hummlist$/, '');
    }
    const file = staticFile(rule.destination);
    assert(file !== undefined, `${rule.destination} has no file in ${config.outputDirectory}/`);
    return `public/${file}`;
  }
  return 'no route';
}

const chrome = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,' +
  'image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7';
const firefox = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const safari = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
const mcpAccept = 'application/json, text/event-stream';

const cases: [string, string, Record<string, string>, string][] = [
  ['Chrome, German first', '/', { accept: chrome, 'accept-language': 'de-DE,de;q=0.9,en;q=0.8' }, 'public/de.html'],
  ['Safari, de only', '/', { accept: safari, 'accept-language': 'de' }, 'public/de.html'],
  ['Firefox, English', '/', { accept: firefox, 'accept-language': 'en-US,en;q=0.5' }, 'public/en.html'],
  ['English first, German second', '/', { accept: chrome, 'accept-language': 'en-GB,de;q=0.8' }, 'public/en.html'],
  ['French: the English page', '/', { accept: chrome, 'accept-language': 'fr-FR,fr;q=0.9' }, 'public/en.html'],
  ['no Accept-Language', '/', { accept: chrome }, 'public/en.html'],
  ['a language merely starting with "de"', '/', { accept: chrome, 'accept-language': 'dexx' }, 'public/en.html'],
  ['the language switch, /en', '/en', { accept: chrome, 'accept-language': 'de' }, 'public/en.html'],
  ['the language switch, /de', '/de', { accept: chrome }, 'public/de.html'],
  [
    'MCP initialize POST',
    '/',
    { accept: mcpAccept, 'content-type': 'application/json', 'mcp-protocol-version': '2025-11-25' },
    fn,
  ],
  ['initialize POST without a protocol header', '/', { accept: mcpAccept, 'content-type': 'application/json' }, fn],
  ['POST that also accepts HTML', '/', { accept: `text/html, ${mcpAccept}`, 'content-type': 'application/json' }, fn],
  [
    'JSON POST from a client that accepts HTML but not SSE',
    '/',
    { accept: 'application/json, text/html', 'content-type': 'application/json' },
    fn,
  ],
  ['GET for the SSE stream', '/', { accept: 'text/event-stream', authorization: 'Bearer t' }, fn],
  ['GET accepting HTML and SSE', '/', { accept: 'text/html, text/event-stream' }, fn],
  ['GET with a token', '/', { accept: chrome, authorization: 'Bearer t' }, fn],
  ['GET with an MCP session', '/', { accept: chrome, 'mcp-session-id': 's' }, fn],
  ['GET with an MCP protocol version', '/', { accept: chrome, 'mcp-protocol-version': '2025-11-25' }, fn],
  ['curl default', '/', { accept: '*/*' }, fn],
  ['no Accept', '/', {}, fn],
  [
    'protected resource metadata in a browser',
    '/.well-known/oauth-protected-resource',
    { accept: chrome },
    `${fn}/.well-known/oauth-protected-resource`,
  ],
  [
    'authorization server metadata in a browser',
    '/.well-known/openid-configuration',
    { accept: chrome },
    `${fn}/.well-known/openid-configuration`,
  ],
  ['/mcp in a browser', '/mcp', { accept: chrome }, `${fn}/mcp`],
];

for (const anchoring of ['whole value', 'substring'] as const) {
  for (const [name, path, headers, want] of cases) {
    Deno.test(`${name} (${anchoring} regex): ${path} → ${want}`, () => {
      assertEquals(route(path, headers, anchoring), want);
    });
  }
}

Deno.test('each page is noindex in its own language', () => {
  for (const lang of ['de', 'en']) {
    const html = Deno.readTextFileSync(new URL(`${lang}.html`, publicDir));
    assert(html.includes(`<html lang="${lang}"`), `${lang}.html: lang="${lang}"`);
    assert(/<meta name="robots" content="noindex/.test(html), `${lang}.html: robots noindex`);
  }
});
