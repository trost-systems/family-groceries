import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { formatLine, parseRequestLine, render } from './diagnose.ts';

const here = new URL('.', import.meta.url).pathname;
const fixture = `${here}fixtures/diagnose`;
const verdict = 'Alexa never sent a spoken request in this window';

async function diagnose(...args: string[]) {
  const deno = Deno.execPath();
  const out = await new Deno.Command('bash', {
    args: [`${here}diagnose.sh`, ...args],
    clearEnv: true,
    env: {
      PATH: `${deno.slice(0, deno.lastIndexOf('/'))}:/usr/bin:/bin`,
      HOME: Deno.env.get('HOME') ?? '/tmp',
      ...(Deno.env.get('DENO_DIR') ? { DENO_DIR: Deno.env.get('DENO_DIR')! } : {}),
      FG_OPS_ENV: '/nonexistent',
    },
  }).output();
  const decode = (b: Uint8Array) => new TextDecoder().decode(b);
  return { code: out.code, stdout: decode(out.stdout), stderr: decode(out.stderr) };
}

/** Every identifier and personal value in the fixture, found by shape, plus the names. */
async function sensitiveValues(): Promise<string[]> {
  const raw = await Deno.readTextFile(`${fixture}/logs.json`) +
    await Deno.readTextFile(`${fixture}/db.json`);
  const text = raw.replaceAll('\\"', '"');
  const shapes = [
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,
    /[\w.]+@[\w.]+/g,
    /\b\d{1,3}(\.\d{1,3}){3}\b/g,
    /req-[\w-]+/g,
    /tok\.[\w.]+/g,
    /"authorization_id": ?"(\w+)"/g,
  ];
  const found = shapes.flatMap((s) => [...text.matchAll(s)].map((m) => m[1] ?? m[0]));
  return [...new Set([...found, 'Lea Trostmann', 'Max Mustermann', 'app.hummlist.com'])];
}

Deno.test('a morning with only skill events: per-request lines, verdict, linking, links', async () => {
  const r = await diagnose(
    '--fixture',
    fixture,
    '--from',
    '2026-11-03 07:00',
    '--to',
    '2026-11-03 12:00',
  );
  assertEquals(r.code, 0, r.stderr);
  for (
    const expected of [
      'Window 2026-11-03 07:00 to 12:00 Europe/Berlin (06:00Z to 11:00Z)',
      'Requests to the alexa function (6)',
      '  08:20:56  POST 200  2142 ms  alexa: AlexaSkillEvent.SkillDisabled - - linked=false -> empty',
      '  08:21:16  POST 200  1253 ms  alexa: AlexaSkillEvent.SkillAccountLinked - - linked=true -> empty',
      '  10:10:00  POST 400  12 ms  (unrecognised alexa line)',
      '  10:11:00  POST 400  15 ms  alexa: - - - linked=false -> refused wrong_skill',
      '  10:12:00  POST 200  800 ms  (unrecognised alexa line)',
      '  10:13:00  POST 546  150000 ms  no request line (crashed or timed out before logging)',
      verdict,
      'refused: the request failed verification',
      'authorize  GET 302  auth=',
      'authorization  GET 403 bad_jwt  auth=',
      'consent approve  POST 200  auth=',
      'token authorization_code  POST 200  user=',
      '09:21:15  token refresh_token  POST 200  user=',
      '10:00:01  token  POST 400 refresh_token_already_used',
      'The link is dead',
      'alexa_links now: 1 links, 1 live sessions, 1 live refresh tokens, last seen 2026-11-03 09:21:17',
    ]
  ) assertStringIncludes(r.stdout, expected);
  const oauth = r.stdout.split('Account linking')[1].split('alexa_links now')[0];
  assertEquals(
    oauth.match(/^ {2}\d\d:\d\d:\d\d {2}/gm)?.length,
    9,
    `only the Alexa client's OAuth rows and the unattributed failure:\n${oauth}`,
  );
  const auths = new Set(oauth.match(/auth=[0-9a-f]{8}/g));
  assertEquals(auths.size, 2, 'two Alexa authorizations, each under one hash');
});

Deno.test('no e-mail, name, IP, uuid, authorization id, request id or token is printed', async () => {
  const values = await sensitiveValues();
  assert(values.length > 25, `the fixture holds user data (${values.length} values)`);
  for (
    const window of [['2026-11-03 07:00', '2026-11-03 12:00'], [
      '2026-11-03 13:00',
      '2026-11-03 23:00',
    ]]
  ) {
    const r = await diagnose('--fixture', fixture, '--from', window[0], '--to', window[1]);
    assertEquals(r.code, 0, r.stderr);
    for (const value of values) {
      assert(!(r.stdout + r.stderr).includes(value), `printed '${value}'`);
    }
  }
});

Deno.test('an afternoon with a LaunchRequest has no "no spoken request" verdict', async () => {
  const r = await diagnose(
    '--fixture',
    fixture,
    '--from',
    '2026-11-03T13:00:00Z',
    '--to',
    '2026-11-03T14:00:00Z',
  );
  assertEquals(r.code, 0, r.stderr);
  assertStringIncludes(
    r.stdout,
    '14:30:00  POST 200  640 ms  alexa: LaunchRequest - de-DE linked=true -> launch',
  );
  assert(!r.stdout.includes(verdict), r.stdout);
  assertStringIncludes(
    r.stdout,
    'Account linking (OAuth, Amazon Alexa client)\n  nothing in this window',
  );
});

Deno.test('a window over 24 h or a bad argument is a usage error (exit 2)', async () => {
  const long = await diagnose(
    '--fixture',
    fixture,
    '--from',
    '2026-11-02 07:00',
    '--to',
    '2026-11-03 07:01',
  );
  assertEquals(long.code, 2);
  assertStringIncludes(long.stderr, 'at most 24 h');
  assertEquals((await diagnose('--fixture', fixture, '--last', '25h')).code, 2, '--last 25h');
  assertEquals((await diagnose('--project', 'other')).code, 2, 'no --project option');
  assertEquals(
    (await diagnose('--from', 'yesterday', '--to', 'today')).code,
    2,
    'unreadable times',
  );
});

Deno.test('without an access token the network path stops before calling anything', async () => {
  const r = await diagnose('--last', '1h');
  assertEquals(r.code, 2);
  assertStringIncludes(r.stderr, 'SUPABASE_ACCESS_TOKEN is not set');
});

Deno.test('job 170: a line with details parses and prints them; a value with text does not', () => {
  const line =
    'alexa: IntentRequest AddItemIntent de-DE linked=true -> added rid=123456789abc slot=4 confirm=NONE ended=- error=- ms=812';
  const parsed = parseRequestLine(line);
  assert(parsed);
  assertEquals(formatLine(parsed), line);
  assertEquals(
    parseRequestLine('alexa: - - - linked=false -> refused bad_signature rid=- slot=- ms=3')
      ?.reason,
    'bad_signature',
  );
  assertEquals(parseRequestLine(`${line} words=Milch`), null);
  assertEquals(parseRequestLine(line.replace('slot=4', 'slot=Milch und Brot')), null);
});

Deno.test('job 170b: a rejected link prints its reason and the next step', () => {
  const line =
    'alexa: IntentRequest ReadListIntent de-DE linked=true -> link invalid_token:expired rid=123456789abc slot=- confirm=NONE ended=- error=- ms=31';
  const parsed = parseRequestLine(line);
  assert(parsed);
  assertEquals(formatLine(parsed), line);
  const event = parseRequestLine(
    'alexa: AlexaSkillEvent.SkillAccountLinked - - linked=true -> empty invalid_token:not_oauth',
  );
  assertEquals(event?.reason, 'invalid_token:not_oauth');
  assertEquals(parseRequestLine(line.replace(':expired', ':eyJhbGciOiJFUzI1NiJ9.e30')), null);
  assertEquals(parseRequestLine(line.replace('-> link', '-> added')), null);

  const at = new Date('2026-11-08T14:10:00Z');
  const out = render({ from: at, to: at }, {
    calls: [{ at, method: 'POST', status: 200, logged: { kind: 'line', line: parsed } }],
    oauth: [],
    links: {
      links: 1,
      liveSessions: 1,
      liveRefreshTokens: 1,
      lastSeen: null,
      alexaClientIds: ['c'],
      linkedUserIds: [],
    },
  });
  assertStringIncludes(out, '  link invalid_token:expired: ');
  assertStringIncludes(out, 'refresh');
});
