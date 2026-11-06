// A fake MCP server for scripts/mcp-smoke.test.mjs that answers like supabase/functions/mcp on
// the local stack: the MCP endpoint at /functions/v1/mcp, Supabase Auth at /auth/v1. Each name in
// `breaks` turns one behaviour wrong, so a test can show the smoke check that catches it.
import { createServer } from 'node:http';

export const token = 'fgp_fixture-secret-token-0123456789';

const tools = [
  { name: 'list_items', description: 'Lists the items.', inputSchema: { type: 'object', properties: {} } },
  { name: 'add_items', description: 'Adds items.', inputSchema: { type: 'object', properties: {} } },
];

/** @param {Set<string>} breaks @returns {Promise<{ url: string, close: () => Promise<void> }>} */
export async function startFake(breaks = new Set()) {
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const origin = `http://${req.headers.host}`;
    const endpoint = `${origin}/functions/v1/mcp`;
    const issuer = `${origin}/auth/v1`;
    const path = new URL(req.url, origin).pathname;
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

    if (path === '/functions/v1/mcp/.well-known/oauth-protected-resource') {
      return json(200, {
        resource: breaks.has('prm-resource') ? `${origin}/elsewhere` : endpoint,
        authorization_servers: [issuer],
      });
    }
    if (path === '/.well-known/oauth-authorization-server/auth/v1') return json(200, asMetadata);
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
    if (path !== '/functions/v1/mcp' || req.method !== 'POST') return json(404, { error: 'not found' });

    const metadata = breaks.has('metadata-host')
      ? `${endpoint.replace('127.0.0.1', 'localhost')}/.well-known/oauth-protected-resource`
      : `${endpoint}/.well-known/oauth-protected-resource`;
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
    if (message.method === 'initialize') {
      return json(200, {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: breaks.has('protocol-version') ? '2025-06-18' : message.params.protocolVersion,
          capabilities: { tools: {} },
          serverInfo: { name: 'fixture', version: '1' },
        },
      });
    }
    if (message.method === 'server/discover') {
      return json(200, {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          supportedVersions: breaks.has('protocol-version') ? ['2025-11-25'] : ['2025-11-25', '2026-07-28'],
          capabilities: { tools: {} },
          _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'fixture', version: '1' } },
        },
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
      // Streamable HTTP may answer as an event stream; the smoke test reads both.
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      return res.end(`event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: message.id, result: { tools: listed } })}\n\n`);
    }
    return json(200, { jsonrpc: '2.0', id: message.id, error: { code: -32601, message: 'method not found' } });
  });
  await new Promise((done) => server.listen(0, '127.0.0.1', done));
  return {
    url: `http://127.0.0.1:${server.address().port}/functions/v1/mcp`,
    close: () => new Promise((done) => server.close(() => done())),
  };
}
