// Job 169b: a user in several households keeps exactly one default while memberships end and
// begin on two connections at once, as two phones or a phone and another member do. The first
// transaction holds its change open until the second was sent. Runs like
// one_open_item_integration_test.ts: the db gate sets FG_DB_TEST=1 and SUPABASE_DB_URL.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { analyticsSubject } from '../alexa/store.ts';
import { CONSENT_TEXT_VERSION } from './consent_version.ts';
import { databaseUrl, householdOf, isMember } from './db.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';

type Sql = postgres.Sql;

const connect = () => postgres(databaseUrl(), { max: 1, prepare: false, onnotice: () => {} });

/** A user in households A, B and C, joined in that order; A is the default. */
async function withThree(
  work: (
    s: { admin: Sql; one: Sql; two: Sql; user: string; ids: Record<string, string> },
  ) => Promise<void>,
) {
  const admin = connect();
  const one = connect();
  const two = connect();
  const user = crypto.randomUUID();
  const ids: Record<string, string> = {};
  try {
    await admin`insert into auth.users (id, email) values (${user}, ${`${user}@fg-test.invalid`})`;
    for (const [i, name] of ['A', 'B', 'C'].entries()) {
      const [row] = await admin<{ id: string }[]>`
        insert into public.households (name, created_by) values (${name}, ${user}) returning id`;
      ids[name] = row?.id ?? '';
      await admin`insert into public.household_members (household_id, user_id, joined_at)
        values (${ids[name]}, ${user}, now() - make_interval(days => ${3 - i}))`;
    }
    await work({ admin, one, two, user, ids });
  } finally {
    await admin`delete from public.households where created_by = ${user}`;
    await admin`delete from auth.users where id = ${user}`;
    await Promise.all([admin.end(), one.end(), two.end()]);
  }
}

function as<T>(sql: Sql, user: string, work: (tx: postgres.TransactionSql) => Promise<T>) {
  const claims = JSON.stringify({ sub: user, role: 'authenticated' });
  return sql.begin(async (tx) => {
    await tx`select set_config('role', 'authenticated', true),
                    set_config('request.jwt.claims', ${claims}, true)`;
    return await work(tx);
  }) as Promise<T>;
}

const pause = () => new Promise((r) => setTimeout(r, 300));

/** [first] holds its transaction open until [second] was sent and had time to block. */
async function overlapping(
  first: (release: Promise<void>) => Promise<unknown>,
  second: () => Promise<unknown>,
) {
  let release!: () => void;
  const a = first(new Promise<void>((resolve) => (release = resolve)));
  await pause();
  const b = second();
  await pause();
  release();
  await Promise.all([a, b]);
}

const memberships = async (admin: Sql, user: string) => [
  ...await admin<{ name: string; is_default: boolean }[]>`
    select h.name, m.is_default from public.household_members m
    join public.households h on h.id = m.household_id
    where m.user_id = ${user} order by m.joined_at`,
];

const test = (name: string, fn: () => Promise<void>) =>
  Deno.test({ name, ignore: !enabled, sanitizeResources: false, sanitizeOps: false, fn });

test('B is deleted while the user leaves their default A: C becomes the default', () =>
  withThree(async ({ admin, one, two, user, ids }) => {
    await overlapping(
      (release) =>
        two.begin(async (tx) => {
          await tx`delete from public.households where id = ${ids.B ?? ''}`;
          await release;
        }),
      () => as(one, user, (tx) => tx`select public.leave_household(${ids.A ?? ''})`),
    );
    assertEquals(await memberships(admin, user), [{ name: 'C', is_default: true }]);
  }));

test('the user leaves B while A, the default, is deleted: C becomes the default', () =>
  withThree(async ({ admin, one, two, user, ids }) => {
    await overlapping(
      (release) =>
        as(two, user, async (tx) => {
          await tx`select public.leave_household(${ids.B ?? ''})`;
          await release;
        }),
      () => one`delete from public.households where id = ${ids.A ?? ''}`,
    );
    assertEquals(await memberships(admin, user), [{ name: 'C', is_default: true }]);
  }));

test('leaving the default while joining another household: the user keeps one default', () =>
  withThree(async ({ admin, one, two, user, ids }) => {
    await admin`delete from public.household_members
      where user_id = ${user} and household_id in (${ids.B ?? ''}, ${ids.C ?? ''})`;
    const [lea] = await admin<{ id: string }[]>`
      insert into auth.users (id, email) values (gen_random_uuid(), 'lea169@fg-test.invalid') returning id`;
    try {
      const [household] = await as(
        admin,
        lea?.id ?? '',
        (tx) => tx<{ id: string }[]>`select id from public.create_household('Bei Lea')`,
      );
      const [invite] = await as(
        admin,
        lea?.id ?? '',
        (tx) =>
          tx<{ code: string }[]>`select code from public.create_invite(${household?.id ?? ''})`,
      );
      await overlapping(
        (release) =>
          as(two, user, async (tx) => {
            await tx`select public.leave_household(${ids.A ?? ''})`;
            await release;
          }),
        () =>
          as(
            one,
            user,
            (tx) => tx`select public.accept_invite(${invite?.code ?? ''}, p_mode => 'add')`,
          ),
      );
      assertEquals(await memberships(admin, user), [{ name: 'Bei Lea', is_default: true }]);
    } finally {
      await admin`delete from public.households where created_by = ${lea?.id ?? ''}`;
      await admin`delete from auth.users where id = ${lea?.id ?? ''}`;
    }
  }));

test('two creates at once by a user without a household: two households, one default', () =>
  withThree(async ({ admin, one, two, user }) => {
    await admin`delete from public.household_members where user_id = ${user}`;
    await overlapping(
      (release) =>
        as(two, user, async (tx) => {
          await tx`select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Eins')`;
          await release;
        }),
      () =>
        as(
          one,
          user,
          (tx) =>
            tx`select public.create_household(p_request_id => gen_random_uuid(), p_name => 'Zwei')`,
        ),
    );
    const rows = await memberships(admin, user);
    assertEquals(rows.map((r) => r.name).sort(), ['Eins', 'Zwei']);
    assertEquals(rows.filter((r) => r.is_default).length, 1);
  }));

test('two old creates at once (no request id): one household, the other already_in_household', () =>
  withThree(async ({ admin, one, two, user }) => {
    await admin`delete from public.household_members where user_id = ${user}`;
    const outcomes: string[] = [];
    const create = (sql: Sql, name: string) =>
      as(sql, user, (tx) => tx`select public.create_household(${name})`).then(
        () => outcomes.push('created'),
        (e: { message?: string }) => outcomes.push(e.message ?? 'error'),
      );
    await overlapping(
      async (release) => {
        await two.begin(async (tx) => {
          const claims = JSON.stringify({ sub: user, role: 'authenticated' });
          await tx`select set_config('role', 'authenticated', true),
                          set_config('request.jwt.claims', ${claims}, true)`;
          await tx`select public.create_household('Eins')`;
          outcomes.push('created');
          await release;
        });
      },
      () => create(one, 'Zwei'),
    );
    assertEquals(outcomes.sort(), ['already_in_household', 'created']);
    assertEquals((await memberships(admin, user)).length, 1);
  }));

test('householdOf and the Alexa analytics subject read the default household', () =>
  withThree(async ({ admin, user, ids }) => {
    await as(admin, user, async (tx) => {
      await tx`select public.set_default_household(${ids.B ?? ''})`;
      await tx`select public.record_analytics_consent(gen_random_uuid(), true, false, true,
        ${CONSENT_TEXT_VERSION})`;
    });
    assertEquals(await householdOf(user), ids.B);
    const subject = await analyticsSubject(admin, user);
    assertEquals([subject?.householdId, subject?.role], [ids.B, 'member']);
  }));

test("isMember: any of the user's households, by id in any case; nothing else (voice, job 169b)", () =>
  withThree(async ({ user, ids }) => {
    for (const id of [ids.A ?? '', ids.B ?? '', (ids.C ?? '').toUpperCase()]) {
      assertEquals(await isMember(user, id), true, id);
    }
    for (const id of [crypto.randomUUID(), 'not-a-uuid', '']) {
      assertEquals(await isMember(user, id), false, id);
    }
    assertEquals(await isMember(crypto.randomUUID(), ids.A ?? ''), false, 'another user');
  }));

type Joiner = { sql: Sql; user: string };

/** A household with a group link at [used] of its 50 uses, and [count] users on their own
 * connections who are not in it. */
async function withGroupLink(
  used: number,
  count: number,
  work: (
    s: {
      admin: Sql;
      joiners: Joiner[];
      code: string;
      invite: string;
      household: string;
      owner: string;
    },
  ) => Promise<void>,
) {
  const admin = connect();
  const owner = crypto.randomUUID();
  const joiners = Array.from(
    { length: count },
    () => ({ sql: connect(), user: crypto.randomUUID() }),
  );
  const everyone = [owner, ...joiners.map((j) => j.user)];
  try {
    for (const id of everyone) {
      await admin`insert into auth.users (id, email) values (${id}, ${`${id}@fg-test.invalid`})`;
    }
    const [household] = await admin<{ id: string }[]>`
      insert into public.households (name, created_by) values ('Verein', ${owner}) returning id`;
    await admin`insert into public.household_members (household_id, user_id, role)
      values (${household?.id ?? ''}, ${owner}, 'owner')`;
    const [invite] = await as(
      admin,
      owner,
      (tx) =>
        tx<{ id: string; code: string }[]>`
          select id, code from public.create_invite(${household?.id ?? ''}, 'group')`,
    );
    await admin`update public.invites set use_count = ${used} where id = ${invite?.id ?? ''}`;
    await work({
      admin,
      joiners,
      code: invite?.code ?? '',
      invite: invite?.id ?? '',
      household: household?.id ?? '',
      owner,
    });
  } finally {
    await admin`delete from public.households where created_by = ${owner}`;
    await admin`delete from auth.users where id in ${admin(everyone)}`;
    await Promise.all([admin.end(), ...joiners.map((j) => j.sql.end())]);
  }
}

/** The first joiner holds its join open while the others try; their sorted answers. */
async function groupLinkRace(joiners: Joiner[], code: string): Promise<string[]> {
  const [holder, ...racers] = joiners;
  const statuses: string[] = [];
  const accept = (tx: postgres.TransactionSql) =>
    tx<{ status: string }[]>`
      select public.accept_invite(${code}, p_mode => 'add') ->> 'status' as status`
      .then(([row]) => statuses.push(row?.status ?? ''));
  if (holder === undefined) throw new Error('no joiners');
  await overlapping(
    (release) =>
      as(holder.sql, holder.user, async (tx) => {
        await accept(tx);
        await release;
      }),
    () => Promise.all(racers.map((r) => as(r.sql, r.user, (tx) => accept(tx)))),
  );
  return statuses.sort();
}

const uses = async (admin: Sql, invite: string, household: string) => {
  const [row] = await admin<{ use_count: number; joins: number; members: number }[]>`
    select i.use_count,
      (select count(*)::int from public.invite_uses u where u.invite_id = i.id) as joins,
      (select count(*)::int from public.household_members m where m.household_id = ${household}) as members
    from public.invites i where i.id = ${invite}`;
  return row;
};

test("two joins race for a group link's last use: one joins, the 51st is refused", () =>
  withGroupLink(49, 2, async ({ admin, joiners, code, invite, household }) => {
    assertEquals(await groupLinkRace(joiners, code), ['invalid_invite', 'joined']);
    assertEquals(await uses(admin, invite, household), { use_count: 50, joins: 1, members: 2 });
  }));

test('three joins race for the last two uses: two join, the third is refused', () =>
  withGroupLink(48, 3, async ({ admin, joiners, code, invite, household }) => {
    assertEquals(await groupLinkRace(joiners, code), ['invalid_invite', 'joined', 'joined']);
    assertEquals(await uses(admin, invite, household), { use_count: 50, joins: 2, members: 3 });
  }));

test("a stranger's remove_member is refused without waiting on the member's lock", () =>
  withGroupLink(0, 1, async ({ admin, joiners, household, owner }) => {
    const [stranger] = joiners;
    if (stranger === undefined) throw new Error('no stranger');
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const holder = admin.begin(async (tx) => {
      await tx`select public.lock_memberships(${owner})`;
      await held;
    });
    await pause();
    const answer = await as(stranger.sql, stranger.user, async (tx) => {
      await tx`set local lock_timeout = '2s'`;
      await tx`select public.remove_member(${household}, ${owner})`;
      return 'removed';
    }).catch((e: unknown) => (e instanceof Error ? e.message : String(e)));
    release();
    await holder;
    assertEquals(answer, 'not_member');
  }));

test("W3: two admins approve requests racing for a group link's last use: one joins", () =>
  withGroupLink(49, 4, async ({ admin, joiners, code, invite, household }) => {
    const [first, second, ...requesters] = joiners;
    if (first === undefined || second === undefined) throw new Error('no admins');
    for (const { user } of [first, second]) {
      await admin`insert into public.household_members (household_id, user_id, role)
        values (${household}, ${user}, 'admin')`;
    }
    await admin`update public.households set join_approval = true where id = ${household}`;
    const requests: string[] = [];
    for (const r of requesters) {
      const [row] = await as(r.sql, r.user, async (tx) => {
        await tx`select public.accept_invite(${code}, p_mode => 'add')`;
        return await tx<{ id: string; status: string }[]>`
          select id, public.accept_invite(${code}, p_mode => 'add') ->> 'status' as status
          from public.join_requests`;
      });
      assertEquals(row?.status, 'requested', 'asking twice answers requested, one request');
      requests.push(row?.id ?? '');
    }
    assertEquals((await uses(admin, invite, household))?.use_count, 49, 'requests count nothing');

    const statuses: string[] = [];
    const decide = (tx: postgres.TransactionSql, request: string) =>
      tx<{ status: string }[]>`
        select public.decide_join_request(${request}, true) ->> 'status' as status`
        .then(([row]) => statuses.push(row?.status ?? ''));
    await overlapping(
      (release) =>
        as(first.sql, first.user, async (tx) => {
          await decide(tx, requests[0] ?? '');
          await release;
        }),
      () => as(second.sql, second.user, (tx) => decide(tx, requests[1] ?? '')),
    );
    assertEquals(statuses.sort(), ['approved', 'invite_full']);
    assertEquals(await uses(admin, invite, household), { use_count: 50, joins: 1, members: 4 });
  }));

/** A club with approval on: [admin] is an admin, [asker] has an open request through the link. */
async function withRequest(
  work: (
    s: {
      admin: Sql;
      approver: Joiner;
      asker: Joiner;
      code: string;
      invite: string;
      household: string;
      request: string;
    },
  ) => Promise<void>,
) {
  await withGroupLink(0, 2, async ({ admin, joiners, code, invite, household }) => {
    const [approver, asker] = joiners;
    if (approver === undefined || asker === undefined) throw new Error('no joiners');
    await admin`insert into public.household_members (household_id, user_id, role)
      values (${household}, ${approver.user}, 'admin')`;
    await admin`update public.households set join_approval = true where id = ${household}`;
    await as(
      asker.sql,
      asker.user,
      (tx) => tx`select public.accept_invite(${code}, p_mode => 'add')`,
    );
    const [row] = await admin<{ id: string }[]>`
      select id from public.join_requests where user_id = ${asker.user} and decision is null`;
    await work({ admin, approver, asker, code, invite, household, request: row?.id ?? '' });
  });
}

const requestState = async (admin: Sql, user: string, household: string) => {
  const [row] = await admin<{ members: number; open: number }[]>`
    select
      (select count(*)::int from public.household_members m
        where m.household_id = ${household} and m.user_id = ${user}) as members,
      (select count(*)::int from public.join_requests r
        where r.household_id = ${household} and r.user_id = ${user} and r.decision is null) as open`;
  return row;
};

const failure = (e: unknown) => `error: ${e instanceof Error ? e.message : String(e)}`;

test('W3: the asker taps the link again while an admin approves: a member, no open request', () =>
  withRequest(async ({ admin, approver, asker, code, household, request }) => {
    const answers: Record<string, string> = {};
    await overlapping(
      (release) =>
        as(approver.sql, approver.user, async (tx) => {
          const [row] = await tx<{ status: string }[]>`
            select public.decide_join_request(${request}, true) ->> 'status' as status`;
          answers.decide = row?.status ?? '';
          await release;
        }),
      () =>
        as(asker.sql, asker.user, (tx) =>
          tx<{ status: string }[]>`
            select public.accept_invite(${code}, p_mode => 'add') ->> 'status' as status`)
          .then(([row]) => (answers.tap = row?.status ?? ''), (e) => (answers.tap = failure(e))),
    );
    assertEquals(answers, { decide: 'approved', tap: 'member' });
    assertEquals(await requestState(admin, asker.user, household), { members: 1, open: 0 });
  }));

test('W3: an approval racing a direct join (approval off meanwhile): no deadlock, one membership', () =>
  withRequest(async ({ admin, approver, asker, code, invite, household, request }) => {
    await admin`update public.households set join_approval = false where id = ${household}`;
    // Holding the asker's membership lock lines both calls up mid-way, whatever order they take.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    const holder = admin.begin(async (tx) => {
      await tx`select public.lock_memberships(${asker.user})`;
      await held;
    });
    await pause();
    const answers: Record<string, string> = {};
    const join = as(asker.sql, asker.user, (tx) =>
      tx<{ status: string }[]>`
        select public.accept_invite(${code}, p_mode => 'add') ->> 'status' as status`)
      .then(([row]) => (answers.join = row?.status ?? ''), (e) => (answers.join = failure(e)));
    await pause();
    const decide = as(approver.sql, approver.user, (tx) =>
      tx<{ status: string }[]>`
        select public.decide_join_request(${request}, true) ->> 'status' as status`)
      .then(([row]) => (answers.decide = row?.status ?? ''), (e) => (answers.decide = failure(e)));
    await pause();
    release();
    await Promise.all([holder, join, decide]);
    assertEquals(answers, { join: 'joined', decide: 'cancelled' });
    assertEquals(await requestState(admin, asker.user, household), { members: 1, open: 0 });
    assertEquals((await uses(admin, invite, household))?.use_count, 1, 'one use counted');
  }));

test('W3: a request filed by a call that began before a join and removal is closed, not approved', () =>
  withGroupLink(0, 2, async ({ admin, joiners, code, household, owner }) => {
    const [approver, lou] = joiners;
    if (approver === undefined || lou === undefined) throw new Error('no joiners');
    await admin`insert into public.household_members (household_id, user_id, role)
      values (${household}, ${approver.user}, 'admin')`;
    const status = await as(lou.sql, lou.user, async (tx) => {
      await tx`select now()`;
      await as(admin, lou.user, (t) => t`select public.accept_invite(${code}, p_mode => 'add')`);
      await as(
        approver.sql,
        approver.user,
        (t) => t`select public.remove_member(${household}, ${lou.user})`,
      );
      const [fresh] = await as(
        admin,
        owner,
        (t) => t<{ code: string }[]>`select code from public.create_invite(${household}, 'person')`,
      );
      await admin`update public.households set join_approval = true where id = ${household}`;
      const [row] = await tx<{ status: string }[]>`
        select public.accept_invite(${fresh?.code ?? ''}, p_mode => 'add') ->> 'status' as status`;
      return row?.status;
    });
    assertEquals(status, 'requested', "the owner's newer invite lets Lou ask");
    const [request] = await admin<{ id: string }[]>`
      select id from public.join_requests where user_id = ${lou.user} and decision is null`;
    const [decided] = await as(approver.sql, approver.user, (tx) =>
      tx<{ status: string }[]>`
        select public.decide_join_request(${request?.id ?? ''}, true) ->> 'status' as status`);
    assertEquals(decided?.status, 'cancelled');
    assertEquals(await requestState(admin, lou.user, household), { members: 0, open: 0 });
  }));
