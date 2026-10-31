// A stand-in PostHog host for fg builds (job 44, features/analytics.md): run it, start the app with
// FG_POSTHOG_HOST=http://127.0.0.1:<port>, and every request the SDK makes lands in <out> as one
// JSON line (method, path, the events decoded, gzip included). It answers /flags with the flags
// given, all off by default, and never forwards anything.
//
//   deno run --allow-net=127.0.0.1 --allow-write cli/posthog_collector.ts <port> <out.jsonl> [flag=true ...]
const [port, out, ...flagArgs] = Deno.args;
if (!port || !out) {
  console.error('usage: posthog_collector.ts <port> <out.jsonl> [flag=true ...]');
  Deno.exit(2);
}
const flags = Object.fromEntries(flagArgs.map((a) => a.split('=')).map(([k, v]) => [k, v === 'true']));

async function decode(bytes: Uint8Array<ArrayBuffer>): Promise<unknown> {
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  const text = gzipped
    ? await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text()
    : new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

Deno.serve({ hostname: '127.0.0.1', port: Number(port) }, async (request) => {
  const path = new URL(request.url).pathname;
  const body = request.method === 'POST' ? await decode(new Uint8Array(await request.arrayBuffer())) : null;
  await Deno.writeTextFile(out, JSON.stringify({ at: new Date().toISOString(), method: request.method, path, body }) + '\n', {
    append: true,
  });
  const answer = path.startsWith('/flags')
    ? {
      flags: Object.fromEntries(Object.entries(flags).map(([key, enabled]) => [key, { key, enabled }])),
      featureFlags: flags,
      errorsWhileComputingFlags: false,
    }
    : path.startsWith('/array/')
    ? {}
    : { status: 'Ok' };
  return Response.json(answer);
});
