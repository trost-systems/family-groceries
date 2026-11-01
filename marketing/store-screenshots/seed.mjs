#!/usr/bin/env node
// The demo household of the store screenshots and the demo videos: an fg seed run of the
// scenario (demo-haushalt, demo-household-en) with only the scenario's own stores. On main,
// create_household still adds dm, Lidl and Edeka, and no retailer may show (legal N-23).
//
//   node seed.mjs <scenario>    prints {"run": ..., "users": {...}} without passwords
//
// Every run is recorded in out/runs.txt; teardown.mjs removes them.

import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { parse } from 'yaml';
import { instance, repo } from '../../.cursor/skills/verify-hummlist/helpers/lib.mjs';

export const OUT = process.env.STORE_SHOTS_OUT ?? join(new URL('.', import.meta.url).pathname, 'out');

/** supabase-js signed in as a member: setup writes (store pruning, a partner's adds). */
export async function apiAs(user) {
  const { apiUrl, publishableKey } = instance();
  const client = createClient(apiUrl, publishableKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password });
  if (error) throw error;
  return client;
}

/** A fresh run: { run, users: { handle: { email, password, id, name, householdId } }, states }. */
export async function seed(scenario) {
  const out = execFileSync(join(repo, 'scripts/fg'), ['seed', scenario], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
  const doc = JSON.parse(out);
  if (!doc.ok) throw new Error(`fg seed ${scenario}: ${JSON.stringify(doc.error)}`);
  mkdirSync(OUT, { recursive: true });
  appendFileSync(join(OUT, 'runs.txt'), `${doc.run}\n`);
  const manifest = JSON.parse(readFileSync(join(process.env.FG_STATE_DIR, 'runs', `${doc.run}.json`), 'utf8'));
  const plan = parse(readFileSync(join(repo, 'test/fixtures/scenarios', `${scenario}.yaml`), 'utf8'));
  const keep = new Set(plan.households[0].stores.map((s) => s.name));
  const api = await apiAs(Object.values(manifest.users)[0]);
  const { data: stores, error } = await api.from('stores').select('id,name');
  if (error) throw error;
  for (const s of stores.filter((x) => !keep.has(x.name))) {
    const { error: e } = await api.rpc('delete_store', { p_store: s.id });
    if (e) throw e;
  }
  const users = Object.fromEntries(Object.entries(manifest.users).map(([h, u]) => [h, { ...u, householdId: manifest.households[u.household]?.id }]));
  return { run: doc.run, users, states: new Map() };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { run, users } = await seed(process.argv[2]);
  const safe = Object.fromEntries(Object.entries(users).map(([h, u]) => [h, { email: u.email, name: u.name }]));
  console.log(JSON.stringify({ run, users: safe }));
}
