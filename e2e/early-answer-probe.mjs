// Counts POSTs that the local edge runtime leaves without a single byte of answer (job 219c,
// docs/DECISIONS.md). A function that starts a streamed answer to a POST before the request body
// has arrived loses the answer in the runtime: the caller waits until its own timeout (Kong's is
// 150 s). mcp.spec.ts's `client.connect()` without a token, which hung the test for 60 s in CI,
// sends such a request first: the one without an answer in a hung run whose stack logs were kept
// (run 43566212940), and inferred for the runs before it.
// The probe sends that request again and again, each on its own connection, and sorts what comes
// back. The race shows in a third of the requests with the edge runtime on one core:
//   docker update --cpuset-cpus 11 supabase_edge_runtime_<project_id>
// Usage: node e2e/early-answer-probe.mjs <url> [requests] [deadline ms] [body|nobody]
//   <url> is the function behind Kong (http://127.0.0.1:<port>/functions/v1/mcp) or in the edge
//   runtime container itself (http://<container ip>:8081/mcp), which leaves Kong out.
// Prints each request without a full answer in time and a summary line; exits 1 if there was one.
import net from 'node:net';
import process from 'node:process';

const [target, n = '300', deadline = '3000', variant = 'body'] = process.argv.slice(2);
if (!target) {
  console.error('usage: node e2e/early-answer-probe.mjs <url> [requests] [deadline ms] [body|nobody]');
  process.exit(2);
}
const url = new URL(target);
const port = Number(url.port || 80);
const body = variant === 'body' ? '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' : '';
const request = [
  `POST ${url.pathname}${url.search} HTTP/1.1`,
  `host: ${url.host}`,
  'content-type: application/json',
  'accept: application/json, text/event-stream',
  `content-length: ${body.length}`,
  'connection: close',
  '',
  body,
].join('\r\n');

function probe(i) {
  return new Promise((done) => {
    const startedAt = new Date().toISOString();
    const started = performance.now();
    const socket = net.connect(port, url.hostname);
    let received = '';
    const finish = (how) => {
      clearTimeout(timer);
      socket.destroy();
      const [statusLine = ''] = received.split('\r\n');
      done({ i, startedAt, how, ms: Math.round(performance.now() - started), bytes: received.length, statusLine });
    };
    const timer = setTimeout(() => finish('deadline'), Number(deadline));
    socket.on('connect', () => socket.write(request));
    socket.on('data', (chunk) => {
      received += chunk.toString('latin1');
    });
    socket.on('end', () => finish('end'));
    socket.on('error', (e) => finish(`error ${e.code}`));
  });
}

const tally = {};
let unanswered = 0;
for (let i = 0; i < Number(n); i++) {
  const result = await probe(i);
  const late = result.ms > 1000 ? ', after more than 1 s' : '';
  let kind = `${result.statusLine}${late}`;
  if (result.how === 'deadline') kind = result.bytes === 0 ? 'no byte at the deadline' : 'part of an answer at the deadline';
  if (result.how.startsWith('error')) kind = result.how;
  tally[kind] = (tally[kind] ?? 0) + 1;
  if (result.how !== 'end' || late) {
    unanswered++;
    console.log(JSON.stringify(result));
  }
}
console.log(JSON.stringify({ url: url.href, requests: Number(n), deadlineMs: Number(deadline), variant, tally }));
process.exit(unanswered > 0 ? 1 : 0);
