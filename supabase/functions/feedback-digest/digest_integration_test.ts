// Job 225: the digest handler in-process against a database with the repo's migrations, through
// the production store (store.ts) and a fake mailer, over days in 2031 so no other row falls in a
// window: off is disabled; on, an empty day and an internal-only day send nothing; a mixed day
// sends one mail with the external notes; a rerun sends no second; a failed send followed by a
// rerun sends every note once; a note in the settle minute goes into the next day's mail; the
// address follows the reply-allowed box. The state and switch are restored afterwards. The db gate
// sets FG_DB_TEST=1 and SUPABASE_DB_URL; without them this is skipped.
import { assert, assertEquals } from '@std/assert';
import postgres from 'postgres';
import { databaseUrl } from '../_shared/db.ts';
import type { Mail } from '../_shared/resend.ts';
import { createHandler } from './handler.ts';
import { sqlStore } from './store.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const SECRET = 'integration-digest-secret';

const users = {
  anna: crypto.randomUUID(),
  ben: crypto.randomUUID(),
  tester: crypto.randomUUID(),
};

Deno.test({
  name: 'the digest over the real database: empty, internal-only, mixed, rerun, failure, cutoff',
  ignore: !enabled,
  async fn() {
    const sql = postgres(databaseUrl(), { max: 2, prepare: false });
    const sent: Mail[] = [];
    let now = new Date();
    let failSend = false;
    const handler = createHandler({
      secret: SECRET,
      store: sqlStore(() => sql),
      mailer: {
        send(_to, mail) {
          if (failSend) return Promise.reject(new Error('resend down'));
          sent.push(mail);
          return Promise.resolve();
        },
      },
      now: () => now,
    });
    const runAt = async (at: string) => {
      now = new Date(at);
      const res = await handler(
        new Request('http://localhost/feedback-digest', {
          method: 'POST',
          headers: { 'x-feedback-digest-secret': SECRET },
        }),
      );
      return [res.status, await res.json()];
    };
    const note = async (user: string, at: string, message: string, contactOk: boolean) => {
      const id = crypto.randomUUID();
      await sql`
        insert into public.feedback (id, user_id, message, contact_ok, app_version, build, platform,
          os_version, locale, screen)
        values (${id}, ${user}, ${message}, ${contactOk}, '1.4.0', '88', 'android', 'Android 15',
          'de', 'list')`;
      await sql`update public.feedback set created_at = ${at}::timestamptz where id = ${id}`;
      return id;
    };
    const [saved] = await sql<{ state: string; on: boolean }[]>`
      select to_jsonb(s)::text as state, public.app_switch('feedback_digest') as on
      from public.feedback_digest_state s`;
    assert(saved, 'the state row');
    try {
      await sql`insert into auth.users (id, email) values
        (${users.anna}, ${`digest-anna-${users.anna}@gmail.com`}),
        (${users.ben}, ${`digest-ben-${users.ben}@web.de`}),
        (${users.tester}, ${`digest-${users.tester}@fg-test.invalid`})`;

      await sql`update public.app_switches set enabled = false where key = 'feedback_digest'`;
      assertEquals(await runAt('2031-03-03T07:30:00Z'), [200, { status: 'disabled' }]);

      await sql`update public.app_switches set enabled = true where key = 'feedback_digest'`;
      await sql`update public.feedback_digest_state
        set since_created_at = '2031-03-02 06:00:00+00',
            since_id = '00000000-0000-0000-0000-000000000000', last_error = null, last_ok_at = null`;
      assertEquals(await runAt('2031-03-03T07:30:00Z'), [200, { status: 'empty' }], 'empty day');

      await note(users.tester, '2031-03-03T12:00:00Z', 'Interne Notiz', true);
      assertEquals(
        await runAt('2031-03-04T07:30:00Z'),
        [200, { status: 'empty' }],
        'internal-only day',
      );
      assertEquals(sent.length, 0);

      await note(users.anna, '2031-03-04T09:00:00.000001Z', 'Anna schreibt', true);
      await note(users.ben, '2031-03-04T10:00:00Z', 'Ben schreibt', false);
      await note(users.tester, '2031-03-04T11:00:00Z', 'Wieder intern', true);
      // 07:59:30 Berlin on the 5th: inside the settle minute, so the 6th's mail.
      await note(users.ben, '2031-03-05T06:59:30Z', 'Ben knapp vor acht', true);
      assertEquals(await runAt('2031-03-05T07:30:00Z'), [200, { status: 'sent', count: 2 }]);
      assertEquals(sent.length, 1, 'one mail for the mixed day');
      const [mixed] = sent;
      assert(mixed);
      assertEquals(mixed.subject, 'Snacklist feedback digest 2031-03-05 (2 new)');
      assert(mixed.text.includes('Anna schreibt') && mixed.text.includes('Ben schreibt'));
      assert(!mixed.text.includes('intern'), 'internal notes are left out');
      assert(!mixed.text.includes('knapp vor acht'), 'the settle minute waits for tomorrow');
      assert(mixed.text.includes(`Email: digest-anna-${users.anna}@gmail.com`), 'reply allowed');
      assert(!mixed.text.includes('digest-ben-'), 'no address without reply allowed');

      assertEquals(
        await runAt('2031-03-05T08:30:00Z'),
        [200, { status: 'empty' }],
        'a rerun the same day',
      );
      assertEquals(sent.length, 1, 'no second mail');

      await note(users.ben, '2031-03-05T10:00:00Z', 'Ben nochmal', true);
      failSend = true;
      assertEquals(await runAt('2031-03-06T07:00:00Z'), [502, { status: 'failed' }]);
      const [failed] = await sql<{ error: string; since: string }[]>`
        select last_error as error, since_created_at::text as since from public.feedback_digest_state`;
      assertEquals(failed, { error: 'send_failed', since: '2031-03-04 10:00:00+00' });
      failSend = false;
      assertEquals(await runAt('2031-03-06T08:00:00Z'), [200, { status: 'sent', count: 2 }]);
      assertEquals(sent.length, 2, 'one mail after the failure');
      const retried = sent[1];
      assert(retried);
      assertEquals(retried.subject, 'Snacklist feedback digest 2031-03-06 (2 new)');
      assert(retried.text.includes('knapp vor acht') && retried.text.includes('Ben nochmal'));
      assert(
        retried.text.includes(`Email: digest-ben-${users.ben}@web.de`),
        'Ben allowed a reply this time',
      );
      assertEquals(await runAt('2031-03-06T09:00:00Z'), [200, { status: 'empty' }]);
      assertEquals(sent.length, 2);

      const [state] = await sql<{ on: string; error: string | null }[]>`
        select last_digest_on::text as on, last_error as error from public.feedback_digest_state`;
      assertEquals(state, { on: '2031-03-06', error: null });
      const status = await handler(new Request('http://localhost/feedback-digest/status'));
      assertEquals(await status.json(), { enabled: true, healthy: true });
    } finally {
      await sql`delete from auth.users where id in ${sql(Object.values(users))}`;
      await sql`update public.feedback_digest_state s
        set (since_created_at, since_id, last_digest_on, last_run_at, last_ok_at, last_error) = (
          select r.since_created_at, r.since_id, r.last_digest_on, r.last_run_at, r.last_ok_at,
                 r.last_error
          from jsonb_populate_record(null::public.feedback_digest_state, ${saved.state}::text::jsonb) r)`;
      await sql`update public.app_switches set enabled = ${saved.on} where key = 'feedback_digest'`;
      await sql.end();
    }
  },
});
