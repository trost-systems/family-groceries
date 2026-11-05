// The hc-backend-perf workload: the app's, MCP's and voice's hot paths against the local stack,
// as the seeded run's members. Prints one JSON object (per-path latencies, error and request
// counts) on stdout. Usage: deno run -A bench.ts <run manifest> <api url> <publishable key>
import adds from './adds.json' with { type: 'json' };

const SEED = 106;
const WARMUP = 5;
const SEQ = 40;
const WORKERS = 4;
const CONC_ROUNDS = 10;

const [manifestPath, apiUrl, publishableKey] = Deno.args;
const manifest = JSON.parse(await Deno.readTextFile(manifestPath));
const household: string = manifest.households.home.id;

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(SEED);
const uuid = () => {
  const b = Array.from({ length: 16 }, () => Math.floor(random() * 256));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

let requests = 0;
let errors = 0;
const errorSamples: string[] = [];

async function call(
  path: string,
  token: string,
  init: RequestInit = {},
  ok = (_: string) => true,
): Promise<string> {
  requests++;
  const res = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      apikey: publishableKey,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  const text = await res.text();
  if (!res.ok || !ok(text)) {
    errors++;
    if (errorSamples.length < 5) {
      errorSamples.push(
        `${init.method ?? 'GET'} ${path.split('?')[0]}: ${res.status} ${text.slice(0, 200)}`,
      );
    }
  }
  return text;
}
const rest = (path: string, token: string, init: RequestInit = {}) =>
  call(`/rest/v1/${path}`, token, init);
const rpc = (fn: string, token: string, body: unknown) =>
  rest(`rpc/${fn}`, token, { method: 'POST', body: JSON.stringify(body) });

async function signIn(handle: string): Promise<string> {
  const u = manifest.users[handle];
  const res = await fetch(`${apiUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey, 'content-type': 'application/json' },
    body: JSON.stringify({ email: u.email, password: u.password }),
  });
  if (!res.ok) throw new Error(`sign-in ${handle}: ${res.status}`);
  return (await res.json()).access_token;
}

const ann = await signIn('ann');
const ben = await signIn('ben');
const pat: string =
  JSON.parse(await rpc('create_personal_access_token', ann, { p_name: 'hc-backend-perf' }))[0]
    .token;

const itemColumns =
  'id,name,quantity,brand,properties,category_id,store_id,sort_key,status,created_at,updated_at,bought_at,added_by,categorized_via,canonical_key';
const h = `household_id=eq.${household}`;
const open: { id: string; name: string }[] = JSON.parse(
  await rest(`items?select=id,name&${h}&status=eq.active&order=name`, ann),
);
const bought: { id: string }[] = JSON.parse(
  await rest(`items?select=id&${h}&status=eq.bought&order=bought_at.desc,id&limit=1000`, ann),
);
if (open.length !== 300) throw new Error(`expected 300 open items, got ${open.length}`);

const names: string[] = [...adds.names];
const nextName = () => {
  const n = names.shift();
  if (!n) throw new Error('add names ran out');
  return n;
};
// Disjoint slices of the open list, so ticks never collide and every path finds its items active.
const tickPool = open.slice(0, 100).map((i) => i.id);
const ticked: string[] = [];
const untickNext = () => {
  const id = ticked.shift()!;
  tickPool.push(id);
  return id;
};
const mcpTickPool = open.slice(100, 200).map((i) => i.name);
const mcpTicked: string[] = [];

const mcp = (tool: string, args: unknown) =>
  call('/functions/v1/mcp', pat, {
    method: 'POST',
    headers: {
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-11-25',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: tool, arguments: args },
    }),
  }, (t) => t.includes('"result"') && !t.includes('"isError":true'));

const usuals = () =>
  rpc('suggest_items', ann, { p_household: household, p_prefix: '', p_limit: 200 });
const itemsActive = () => rest(`items?select=${itemColumns}&${h}&status=eq.active`, ann);
const itemsBought = () =>
  rest(`items?select=${itemColumns}&${h}&status=eq.bought&order=bought_at.desc&limit=50`, ann);

type Path = { name: string; run: () => Promise<unknown> };
const paths: Path[] = [
  {
    // ListCubit.resync: fetchCatalog and fetchItems together, then the usuals.
    name: 'list_open',
    run: async () => {
      await Promise.all([
        rest(`categories?select=id,name,sort_order,seed_key&${h}&order=sort_order.asc`, ann),
        rest(`stores?select=id,name,sort_order,seed_key&${h}&order=sort_order.asc`, ann),
        rest(`store_category_order?select=store_id,category_id,sort_order,hidden&${h}`, ann),
        rest(`household_members?select=user_id,role&${h}`, ann),
        rest('profiles?select=id,display_name', ann),
        itemsActive(),
        itemsBought(),
      ]);
      await usuals();
    },
  },
  { name: 'items_active', run: itemsActive },
  { name: 'items_bought', run: itemsBought },
  { name: 'suggest_items', run: usuals },
  {
    name: 'item_by_id',
    run: () =>
      rest(
        `items?select=${itemColumns}&id=eq.${bought[Math.floor(random() * bought.length)].id}`,
        ben,
      ),
  },
  {
    name: 'put_item',
    run: () =>
      rpc('put_item', ben, {
        p_id: uuid(),
        p_household: household,
        p_name: nextName(),
        p_quantity: null,
        p_brand: null,
        p_properties: null,
        p_category: null,
        p_store: null,
        p_sort_key: null,
        p_status: 'active',
        p_no_store: false,
      }),
  },
  {
    name: 'tick',
    run: () => {
      const id = tickPool.shift()!;
      ticked.push(id);
      return rest(`items?id=eq.${id}&select=${itemColumns}`, ann, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ status: 'bought' }),
      });
    },
  },
  {
    name: 'untick',
    run: () =>
      rest(`items?id=eq.${untickNext()}&select=${itemColumns}`, ann, {
        method: 'PATCH',
        headers: { prefer: 'return=representation' },
        body: JSON.stringify({ status: 'active' }),
      }),
  },
  { name: 'mcp_list_items', run: () => mcp('list_items', {}) },
  {
    name: 'mcp_add_items',
    run: () =>
      mcp('add_items', { items: [{ name: nextName() }, { name: nextName(), quantity: '2' }] }),
  },
  {
    name: 'mcp_tick',
    run: () => {
      const name = mcpTickPool.shift()!;
      mcpTicked.push(name);
      return mcp('tick_items', { items: [name] });
    },
  },
  {
    name: 'voice_add',
    run: () =>
      call('/functions/v1/voice', ben, {
        method: 'POST',
        body: JSON.stringify({ text: `${nextName()} und ${nextName()}` }),
      }),
  },
];

const pct = (sorted: number[], p: number) =>
  sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const timed = async (run: () => Promise<unknown>) => {
  const t0 = performance.now();
  await run();
  return performance.now() - t0;
};
const summary = (samples: number[]) => {
  const s = [...samples].sort((a, b) => a - b);
  const r = (x: number) => Math.round(x * 100) / 100;
  return { n: s.length, p50: r(pct(s, 50)), p95: r(pct(s, 95)), p99: r(pct(s, 99)) };
};

// Round-robin: every round runs each path once (or WORKERS times at once), so a burst of load
// from elsewhere on the host lands on all paths alike instead of on one path's block.
const seqSamples: Record<string, number[]> = Object.fromEntries(paths.map((p) => [p.name, []]));
const concSamples: Record<string, number[]> = Object.fromEntries(paths.map((p) => [p.name, []]));
// mcp_tick's items go back on the list (untimed) after every round.
const restoreMcpTicks = async () => {
  const ids = open.filter((i) => mcpTicked.includes(i.name)).map((i) => i.id);
  await rest(`items?id=in.(${ids.join(',')})`, ann, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active' }),
  });
  mcpTickPool.push(...mcpTicked);
  mcpTicked.length = 0;
};
for (let r = 0; r < WARMUP; r++) {
  for (const p of paths) await p.run();
  await restoreMcpTicks();
}
for (let r = 0; r < SEQ; r++) {
  for (const p of paths) seqSamples[p.name].push(await timed(p.run));
  await restoreMcpTicks();
}
for (let r = 0; r < CONC_ROUNDS; r++) {
  for (const p of paths) {
    concSamples[p.name].push(
      ...await Promise.all(Array.from({ length: WORKERS }, () => timed(p.run))),
    );
  }
  await restoreMcpTicks();
}
const out = Object.fromEntries(
  paths.map((
    p,
  ) => [p.name, { seq: summary(seqSamples[p.name]), conc: summary(concSamples[p.name]) }]),
);

console.log(
  JSON.stringify({
    seed: SEED,
    warmup: WARMUP,
    seq: SEQ,
    workers: WORKERS,
    concRounds: CONC_ROUNDS,
    requests,
    errors,
    errorSamples,
    paths: out,
  }),
);
