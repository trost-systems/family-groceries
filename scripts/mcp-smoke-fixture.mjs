// A fake MCP server for scripts/mcp-smoke.test.mjs that answers like supabase/functions/mcp on
// the local stack: the MCP endpoint at /functions/v1/mcp, Supabase Auth at /auth/v1, and for
// 2026-era clients the authorization server front at /functions/v1/mcp/oauth (job 94). Each name
// in `breaks` turns one behaviour wrong, so a test can show the smoke check that catches it.
import { createServer } from 'node:http';

export const token = 'fgp_fixture-secret-token-0123456789';
export const documentPath = '/client/mcp-smoke.json';

const tools = [
  { name: 'list_items', description: 'Lists the items.', inputSchema: { type: 'object', properties: {} } },
  { name: 'add_items', description: 'Adds items.', inputSchema: { type: 'object', properties: {} } },
];

const MODERN = '2026-07-28';
const isModern = (version) => /^\d{4}-\d{2}-\d{2}$/.test(version ?? '') && version >= MODERN;

/** @param {Set<string>} breaks @returns {Promise<{ url: string, documentUrl: string, close: () => Promise<void> }>} */
export async function startFake(breaks = new Set()) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const origin = `http://${req.headers.host}`;
    const endpoint = `${origin}/functions/v1/mcp`;
    const issuer = `${origin}/auth/v1`;
    const front = `${endpoint}/oauth`;
    const url = new URL(req.url, origin);
    const path = url.pathname;
    const version = req.headers['mcp-protocol-version'];
    const json = (status, value, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(value));
    };
    const asMetadata = {
      issuer,
      'authorization_endpoint': `${issuer}/oauth/authorize`,
      'token_endpoint': `${issuer}/oauth/token`,
      'grant_types_supported': ['authorization_code', 'refresh_token'],
      ...(breaks.has('no-registration') ? {} : { registration_endpoint: `${issuer}/oauth/clients/register` }),
    };
    const frontMetadata = {
      ...asMetadata,
      issuer: front,
      'authorization_endpoint': `${front}/authorize`,
      'token_endpoint': `${front}/token`,
      ...(breaks.has('no-cimd-flag') ? {} : { client_id_metadata_document_supported: true }),
    };
    const prm = (server) => ({
      resource: breaks.has('prm-resource') ? `${origin}/elsewhere` : endpoint,
      authorization_servers: [server],
    });

    if (path === documentPath) {
      return json(200, {
        client_id: `${origin}${documentPath}`,
        client_name: 'mcp-smoke',
        redirect_uris: ['http://127.0.0.1:9/mcp-smoke'],
      });
    }
    if (path === '/functions/v1/mcp/.well-known/oauth-protected-resource/cimd') return json(200, prm(front));
    if (path === '/functions/v1/mcp/.well-known/oauth-protected-resource') {
      return json(200, prm(isModern(version) && !breaks.has('no-rediscovery') ? front : issuer));
    }
    if (path === '/.well-known/oauth-authorization-server/auth/v1') return json(200, asMetadata);
    if (path === '/functions/v1/mcp/oauth/.well-known/oauth-authorization-server') {
      return json(200, frontMetadata);
    }
    if (path === '/functions/v1/mcp/.well-known/openid-configuration') {
      return breaks.has('no-hintless') ? json(404, { error: 'not found' }) : json(200, asMetadata);
    }
    const browser = req.method === 'GET' && /text\/html/.test(req.headers.accept ?? '') &&
      req.headers['content-type'] === undefined && req.headers.authorization === undefined;
    if (path === '/functions/v1/mcp' && browser && !breaks.has('no-page')) {
      const lang = /^de/.test(req.headers['accept-language'] ?? '') && !breaks.has('page-language') ? 'de' : 'en';
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return res.end(`<!doctype html><html lang="${lang}"><meta name="robots" content="noindex, nofollow">`);
    }
    if (path === '/functions/v1/mcp/oauth/authorize') {
      const clientId = url.searchParams.get('client_id') ?? '';
      // The real front takes https document URLs only; the fake's own document is served over http.
      const own = clientId === `${origin}${documentPath}`;
      if (clientId.startsWith('http://') && !own && !breaks.has('front-accepts-bad-client')) {
        return json(400, { error: 'invalid_client', error_description: 'client_id URL: https only' });
      }
      const mapped = breaks.has('front-keeps-url') ? clientId : '7d4f3b8e-1c2a-4c5d-9e6f-0a1b2c3d4e5f';
      url.searchParams.set('client_id', mapped);
      res.writeHead(302, { location: `${issuer}/oauth/authorize?${url.searchParams}` });
      return res.end();
    }
    if (path === '/auth/v1/oauth/authorize') {
      res.writeHead(302, { location: `${origin}/oauth/consent?authorization_id=fixture` });
      return res.end();
    }
    if (path !== '/functions/v1/mcp' || req.method !== 'POST') return json(404, { error: 'not found' });

    const metadata = breaks.has('metadata-host')
      ? `${endpoint.replace('127.0.0.1', 'localhost')}/.well-known/oauth-protected-resource`
      : `${endpoint}/.well-known/oauth-protected-resource${
        (isModern(version) && !breaks.has('no-cimd-hint')) || breaks.has('legacy-gets-front') ? '/cimd' : ''}`;
    const authorization = req.headers.authorization;
    if (!breaks.has('no-401') && authorization !== `Bearer ${token}`) {
      const error = authorization ? ', error="invalid_token", error_description="token unknown"' : '';
      return json(401, { error: 'invalid_token' }, {
        'www-authenticate': `Bearer resource_metadata="${metadata}", scope="openid email"${error}`,
      });
    }

    const message = JSON.parse(body);
    if (message.id === undefined) {
      res.writeHead(202);
      return res.end();
    }
    const reply = (result) => json(200, { jsonrpc: '2.0', id: message.id, result });
    const error = (status, code, text, data) =>
      json(status, { jsonrpc: '2.0', id: message.id, error: { code, message: text, ...(data ? { data } : {}) } });
    const serverInfo = { 'io.modelcontextprotocol/serverInfo': { name: 'fixture', version: '1' } };
    if (isModern(version) || message.method === 'server/discover') {
      if (version !== MODERN && !breaks.has('no-version-error')) {
        return error(400, -32022, 'Unsupported protocol version', { supported: [MODERN], requested: version });
      }
      if (req.headers['mcp-method'] !== message.method && !breaks.has('no-method-check')) {
        return error(400, -32020, 'header mismatch: Mcp-Method');
      }
      if (message.method === 'tools/call' && req.headers['mcp-name'] !== message.params?.name &&
        !breaks.has('no-name-check')) {
        return error(400, -32020, 'header mismatch: Mcp-Name');
      }
    }
    if (message.method === 'initialize') {
      return reply({
        protocolVersion: breaks.has('protocol-version') ? '2025-06-18' : message.params.protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '1' },
      });
    }
    if (message.method === 'server/discover') {
      return reply({
        supportedVersions: breaks.has('protocol-version') ? ['2025-11-25'] : [MODERN],
        capabilities: { tools: {} },
        resultType: 'complete',
        ttlMs: 3600000,
        cacheScope: 'private',
        _meta: breaks.has('discover-no-server-info') ? {} : serverInfo,
      });
    }
    if (message.method === 'tools/list') {
      if (breaks.has('tools-error')) {
        return json(403, { error: `no tools for ${authorization}` });
      }
      const listed = tools
        .filter((tool) => !(breaks.has('no-add-items') && tool.name === 'add_items'))
        .map((tool) => (breaks.has('no-input-schema') && tool.name === 'list_items'
          ? { name: tool.name, description: tool.description }
          : tool));
      const cache = isModern(version)
        ? {
          resultType: 'complete',
          ...(breaks.has('no-ttl') ? {} : { ttlMs: 3600000 }),
          cacheScope: breaks.has('bad-cache-scope') ? 'shared' : 'private',
          _meta: serverInfo,
        }
        : {};
      // Streamable HTTP may answer as an event stream; the smoke test reads both.
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      return res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: listed, ...cache } })}\n\n`);
    }
    if (message.method === 'tools/call') {
      return reply({ content: [{ type: 'text', text: '{}' }], resultType: 'complete' });
    }
    return error(200, -32601, 'method not found');
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  const base = `http://127.0.0.1:${server.address().port}`;
  return {
    url: `${base}/functions/v1/mcp`,
    documentUrl: `${base}${documentPath}`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
