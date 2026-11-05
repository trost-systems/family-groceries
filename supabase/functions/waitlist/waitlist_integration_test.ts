// Job 82: the waitlist handler in-process against a database with the repo's migrations, through
// the production store (store.ts) and a fake mailer: a sign-up stores one row in any letter case,
// with launch news off whatever the form sent, and mails the confirmation; its token confirms once
// with the confirmation text's version and the launch-news box, and the welcome mail follows; the
// one-click values delete the row and leave a proof record keyed by the address's HMAC that names
// both texts; a sign-up over the per-client limit in an hour answers the same 202 and stores
// nothing. Test addresses only. The db gate sets FG_DB_TEST=1 and SUPABASE_DB_URL; without them
// this is skipped.
import { assertEquals } from '@std/assert';
import postgres from 'postgres';
import { CONFIRM_VERSIONS, CONSENT_VERSIONS } from './consent.ts';
import { hmacHex, sha256Hex } from './crypto.ts';
import { configFrom, createHandler, LIMITS } from './handler.ts';
import type { Mail } from './mail.ts';
import { sqlStore } from './store.ts';

const enabled = Deno.env.get('FG_DB_TEST') === '1';
const PROXY = 'integration-proxy-secret';
const HMAC = 'integration-hmac-secret';

function harness(sql: postgres.Sql) {
  const sent: { to: string; mail: Mail }[] = [];
  const deferred: (() => Promise<void>)[] = [];
  const handler = createHandler({
    config: configFrom(
      new Map([
        ['WAITLIST_PROXY_SECRET', PROXY],
        ['WAITLIST_HMAC_SECRET', HMAC],
      ]),
    ).config,
    store: sqlStore(() => sql),
    mailer: {
      send(to, mail) {
        sent.push({ to, mail });
        return Promise.resolve();
      },
    },
    now: () => new Date(),
    random: (n) => crypto.getRandomValues(new Uint8Array(n)),
    defer: (work) => {
      deferred.push(work);
    },
  });
  const call = (route: string, body: unknown, client = 'integration-client') =>
    handler(
      new Request(`http://localhost/waitlist/${route}`, {
        method: 'POST',
        headers: { 'x-waitlist-proxy-secret': PROXY, 'x-waitlist-client': client },
        body: JSON.stringify(body),
      }),
    );
  const flush = async () => {
    while (deferred.length) await deferred.shift()!();
  };
  return { sent, call, flush };
}

const form = (email: string) => ({
  email,
  platform: 'android',
  locale: 'en',
  launch_news: true,
  consent_version: CONSENT_VERSIONS.en,
  website: '',
  elapsed_ms: 8000,
});

Deno.test({
  name: 'sign-up, confirm and one-click unsubscribe through the real database',
  ignore: !enabled,
  async fn() {
    const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 2, prepare: false });
    const email = `hello+it-${crypto.randomUUID()}@hummlist.com`;
    const proofKey = await hmacHex(HMAC, email.toLowerCase());
    const client = crypto.randomUUID();
    try {
      const { sent, call, flush } = harness(sql);
      assertEquals((await call('signup', form(email), client)).status, 202);
      assertEquals((await call('signup', form(email.toUpperCase()), client)).status, 202);
      await flush();
      const rows = await sql<
        { id: string; email: string; confirm_token_hash: string; launch_news: boolean }[]
      >`
        select id, email, confirm_token_hash, launch_news
        from public.waitlist where lower(email) = ${email}`;
      assertEquals(rows.length, 1, 'one row in any letter case');
      assertEquals(rows[0].email, email);
      assertEquals(rows[0].launch_news, false, 'launch_news from the form is not stored');
      assertEquals(sent.map((s) => s.to), [email], 'one confirmation mail');
      const token = sent[0].mail.text.match(/#t=([A-Za-z0-9_-]{43})/)![1];
      assertEquals(rows[0].confirm_token_hash, await sha256Hex(token), 'only the hash is stored');

      const pressed = { token, confirm_version: CONFIRM_VERSIONS.en, launch_news: true };
      assertEquals(
        (await call('confirm', { ...pressed, confirm_version: 'waitlist-en-v2' })).status,
        400,
      );
      assertEquals(await (await call('confirm', pressed)).json(), { status: 'confirmed' });
      assertEquals(await (await call('confirm', pressed)).json(), { status: 'invalid' });
      await flush();
      assertEquals(sent.length, 2, 'the welcome mail');
      const [row] = await sql<
        {
          confirmed: boolean;
          mailed: boolean;
          confirm_text_version: string;
          launch_news: boolean;
        }[]
      >`
        select confirmed_at is not null as confirmed, last_mail_at >= confirmed_at as mailed,
               confirm_text_version, launch_news
        from public.waitlist where id = ${rows[0].id}`;
      assertEquals(row, {
        confirmed: true,
        mailed: true,
        confirm_text_version: 'waitlist-confirm-en-v1',
        launch_news: true,
      });

      const url = new URL(sent[1].mail.headers['List-Unsubscribe'].slice(1, -1));
      const id = url.searchParams.get('id')!;
      assertEquals(id, rows[0].id);
      const sig = url.searchParams.get('s')!;
      assertEquals(await (await call('unsubscribe', { id, sig })).json(), { status: 'deleted' });
      const [left] = await sql<{ rows: number; proofs: number }[]>`
        select (select count(*)::int from public.waitlist where lower(email) = ${email}) as rows,
               (select count(*)::int from public.waitlist_consent_proof
                where email_hmac = ${proofKey} and end_reason = 'unsubscribed'
                  and launch_news and locale = 'en' and consent_text_version = 'waitlist-en-v2'
                  and confirm_text_version = 'waitlist-confirm-en-v1') as proofs`;
      assertEquals(left, { rows: 0, proofs: 1 });
      assertEquals(await (await call('unsubscribe', { id, sig })).json(), { status: 'deleted' });
    } finally {
      await sql`delete from public.waitlist where lower(email) = ${email}`;
      await sql`delete from public.waitlist_consent_proof where email_hmac = ${proofKey}`;
      await sql`delete from public.waitlist_rate where key_hash = ${await sha256Hex(client)}`;
      await sql.end();
    }
  },
});

Deno.test({
  name: 'one sign-up over the per-client limit in an hour gets the same 202 and stores nothing',
  ignore: !enabled,
  async fn() {
    const sql = postgres(Deno.env.get('SUPABASE_DB_URL')!, { max: 2, prepare: false });
    const client = crypto.randomUUID();
    const over = `hello+it-rate-${crypto.randomUUID()}@hummlist.com`;
    try {
      const { call, flush, sent } = harness(sql);
      const answers = [];
      for (let i = 0; i < LIMITS.perKey; i++) {
        const res = await call('signup', {
          ...form('hello+it-rate-bot@hummlist.com'),
          website: 'bot',
        }, client);
        answers.push(`${res.status} ${await res.text()}`);
      }
      const res = await call('signup', form(over), client);
      answers.push(`${res.status} ${await res.text()}`);
      await flush();
      assertEquals(answers, Array(LIMITS.perKey + 1).fill('202 {"status":"ok"}'));
      const [left] = await sql<{ hits: number; rows: number }[]>`
        select (select hits from public.waitlist_rate where key_hash = ${await sha256Hex(client)}),
               (select count(*)::int from public.waitlist where lower(email) = ${over}) as rows`;
      assertEquals(left, { hits: LIMITS.perKey + 1, rows: 0 }, 'counted, not stored');
      assertEquals(sent.length, 0, 'nothing sent');
    } finally {
      await sql`delete from public.waitlist where lower(email) = ${over}`;
      await sql`delete from public.waitlist_rate where key_hash = ${await sha256Hex(client)}`;
      await sql.end();
    }
  },
});
