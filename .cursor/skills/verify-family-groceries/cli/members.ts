/** Who a user flag means: a baseline user (peter, lea) or a member of a seeded fixture run (<run>:<handle>, or a bare handle in the current run). */

import { FgError, type Shell } from './core.ts';
import type { Manifest } from './fixtures.ts';
import { clientName, type Instance, USERS } from './instance.ts';

export interface Member {
  /** Canonical: peter, lea or <run>:<handle>. */
  ref: string;
  email: string;
  password: string;
  name: string;
}

const runsDir = (inst: Instance) => `${inst.stateDir}/runs`;

/** Resolves a ref against the baseline users and this instance's local run manifests. */
export async function resolveMember(sh: Shell, inst: Instance, raw: string): Promise<Member> {
  clientName(raw);
  if (raw === 'peter' || raw === 'lea') return { ref: raw, ...USERS[raw] };
  let [run, handle] = raw.includes(':') ? raw.split(':') : [null, raw];
  if (!run) {
    const current = `${runsDir(inst)}/current`;
    if (!(await sh.exists(current))) {
      throw new FgError(
        'unknown_user',
        `"${raw}" is not a baseline user and no fixture run is current.`,
        'Seed one with `fg seed <scenario>`, or use <run>:<handle>.',
        64,
      );
    }
    run = (await sh.readText(current)).trim();
  }
  const path = `${runsDir(inst)}/${run}.json`;
  if (!(await sh.exists(path))) {
    throw new FgError(
      'unknown_run',
      `No fixture run "${run}" on this instance (FG_PORT_PREFIX=${inst.prefix}).`,
      '`fg runs` lists the runs; `fg seed <scenario>` makes one.',
      64,
    );
  }
  const m = JSON.parse(await sh.readText(path)) as Manifest;
  const u = m.users[handle];
  if (!u) {
    throw new FgError(
      'unknown_user',
      `Run ${run} (${m.scenario}) has no member "${handle}".`,
      `Its members: ${Object.keys(m.users).join(', ')}.`,
      64,
    );
  }
  return { ref: `${run}:${handle}`, email: u.email, password: u.password, name: u.name };
}
