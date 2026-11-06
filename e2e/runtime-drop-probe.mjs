// Counts the answers the local edge runtime drops (job 124, docs/DECISIONS.md): the request
// public-api.spec.ts sends in its throttle loop, an unknown API key, again and again. A dropped
// answer is the runtime's own empty 503 (x-served-by: base/server, "connection aborted" in its
// log) although the function ran. Turn the API on (public-api.spec.ts's beforeAll does it) and pin
// the edge runtime to one core to make the race show:
//   docker update --cpuset-cpus 11 supabase_edge_runtime_<project_id>
// Usage: node e2e/runtime-drop-probe.mjs <functions url> [requests] [concurrency] [GET|POST]
// Prints each answer that is not JSON and a summary line; exits 1 if there was one.
import process from 'node:process';

const [functionsUrl, n = '300', concurrency = '1', method = 'GET'] = process.argv.slice(2);
if (!functionsUrl) {
  console.error('usage: node e2e/runtime-drop-probe.mjs <functions url> [requests] [concurrency] [GET|POST]');
  process.exit(2);
}
const url = `${functionsUrl}/api/v1/items`;
const total = Number(n);
const statuses = {};
let dropped = 0;
let next = 0;

async function probe(i) {
  const res = await fetch(url, {
    method,
    headers: { authorization: `Bearer fgp_wrong${i}${crypto.randomUUID()}`, 'content-type': 'application/json' },
    body: method === 'POST' ? JSON.stringify({ items: [{ name: 'Milch' }] }) : undefined,
  });
  const text = await res.text();
  statuses[res.status] = (statuses[res.status] ?? 0) + 1;
  try {
    JSON.parse(text);
  } catch {
    dropped++;
    console.log(JSON.stringify({ i, status: res.status, servedBy: res.headers.get('x-served-by'), body: text }));
  }
}

await Promise.all(Array.from({ length: Number(concurrency) }, async () => {
  while (next < total) await probe(next++);
}));
console.log(JSON.stringify({ requests: total, concurrency: Number(concurrency), method, notJson: dropped, statuses }));
process.exit(dropped > 0 ? 1 : 0);
