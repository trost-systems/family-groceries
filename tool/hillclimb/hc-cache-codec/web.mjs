// Serves the probe build (argv[2]) on 127.0.0.1 and prints each engine's HC_WEB line as one JSON
// object. Chromium loads main.dart.wasm, Firefox and WebKit main.dart.js, as the shipped build does.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium, firefox, webkit } from '../../../e2e/node_modules/@playwright/test/index.mjs';

const dir = process.argv[2];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  try {
    const body = await readFile(path);
    res.writeHead(200, {
      'content-type': types[extname(path)] ?? 'application/octet-stream',
      'cross-origin-opener-policy': 'same-origin',
      'cross-origin-embedder-policy': 'require-corp',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
}).listen(0, '127.0.0.1');
await new Promise((r) => server.once('listening', r));
const url = `http://127.0.0.1:${server.address().port}/`;

const out = {};
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch();
  const page = await browser.newPage();
  const line = new Promise((resolve) => page.on('console', (m) => m.text().startsWith('HC_WEB ') && resolve(m.text())));
  const wasm = new Promise((resolve) => page.on('request', (r) => r.url().endsWith('main.dart.wasm') && resolve(true)));
  await page.goto(url);
  const text = await Promise.race([line, new Promise((_, no) => setTimeout(() => no(new Error(`${name}: no HC_WEB line`)), 300_000))]);
  out[name] = { compiled: await Promise.race([wasm, new Promise((r) => setTimeout(() => r(false), 10))]) ? 'wasm' : 'js', ...JSON.parse(text.slice(7)) };
  await browser.close();
}
server.close();
console.log(JSON.stringify(out));
