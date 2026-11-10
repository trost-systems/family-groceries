import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { createHandler, type Deps } from '../../supabase/functions/alexa/handler.ts';
import { makeTestCa, testCertUrl, testSkillId } from '../../supabase/functions/alexa/test_ca.ts';
import { verifyRequest } from '../../supabase/functions/alexa/verify.ts';

const here = new URL('.', import.meta.url).pathname;
const token = 'smoke-access-not-a-real-one';

/** Stands in for ask-cli: keeps each body it is sent and answers like FAKE_MODE says. */
const fakeAsk = `#!/usr/bin/env bash
set -euo pipefail
for arg in "$@"; do [[ $arg == file:* ]] && body="\${arg#file:}"; done
n=$(ls "$CAPTURE" | wc -l); cp "$body" "$CAPTURE/$n.json"
linked=false; grep -q accessToken "$body" && linked=true
case $FAKE_MODE in
  good) if $linked; then card=null; text='Was soll auf die Liste?'; end=false
        else card='{"type":"LinkAccount"}'; text='Bitte verknüpfe zuerst dein Snacklist-Konto.'; end=true; fi
        status=SUCCESSFUL ;;
  apology) card=null; text='Das hat leider nicht geklappt.'; end=true; status=SUCCESSFUL ;;
  failed) echo '{"status":"FAILED","result":{"error":{"message":"An error occurred while invoking the skill endpoint."}}}'; exit 0 ;;
  crash) echo "ask: request failed for $(cat "$body")" >&2; exit 1 ;;
esac
jq -n --rawfile req "$body" --arg text "$text" --argjson card "$card" --argjson end "$end" --arg status "$status" '
  {status: $status, result: {skillExecutionInfo: {
    invocationRequest: {endpoint: "https://example.invalid/functions/v1/alexa", body: ($req | fromjson)},
    invocationResponse: {body: {version: "1.0", response: ({outputSpeech: {type: "PlainText", text: $text},
      shouldEndSession: $end} + (if $card == null then {} else {card: $card} end))}},
    metrics: {skillExecutionTimeInMilliseconds: 312}}}}'
`;

interface Run {
  code: number;
  stdout: string;
  stderr: string;
  /** The bodies the fake ask received, in order. */
  sent: string[];
}

async function smoke(
  args: string[],
  env: Record<string, string> = {},
  mode?: 'good' | 'apology' | 'failed' | 'crash',
): Promise<Run> {
  const dir = await Deno.makeTempDir();
  try {
    const capture = `${dir}/capture`;
    await Deno.mkdir(capture);
    const fake: Record<string, string> = {};
    if (mode) {
      await Deno.writeTextFile(`${dir}/ask`, fakeAsk, { mode: 0o755 });
      Object.assign(fake, { ASK: `${dir}/ask`, FAKE_MODE: mode, CAPTURE: capture });
    }
    const out = await new Deno.Command('bash', {
      args: [`${here}smoke.sh`, ...args],
      clearEnv: true,
      env: { PATH: '/usr/bin:/bin', HOME: dir, FG_OPS_ENV: '/nonexistent', ...fake, ...env },
    }).output();
    const sent = [];
    for (const name of [...Deno.readDirSync(capture)].map((e) => e.name).sort()) {
      sent.push(await Deno.readTextFile(`${capture}/${name}`));
    }
    const decode = (b: Uint8Array) => new TextDecoder().decode(b);
    return { code: out.code, stdout: decode(out.stdout), stderr: decode(out.stderr), sent };
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
}

const bodiesOf = (stdout: string) =>
  stdout.split('\n').filter((l) => l.startsWith('{')).map((l) => JSON.parse(l));

Deno.test('--dry-run prints both bodies and ask lines, without ask or a skill id', async () => {
  const r = await smoke(['--dry-run'], { ALEXA_SMOKE_TOKEN: token });
  assertEquals(r.code, 0, r.stderr);
  const [unlinked, linked] = bodiesOf(r.stdout);
  assertEquals(unlinked.request.type, 'LaunchRequest');
  assertEquals(unlinked.request.locale, 'de-DE');
  assertEquals(unlinked.context.System.user.userId, 'amzn1.ask.account.SNACKLIST-SMOKE');
  assertEquals(unlinked.context.System.user.accessToken, undefined, 'unlinked has no token');
  assertEquals(linked.context.System.user.accessToken, '<ALEXA_SMOKE_TOKEN>');
  assertEquals(linked.session.user.accessToken, '<ALEXA_SMOKE_TOKEN>');
  assert(unlinked.request.requestId !== linked.request.requestId, 'fresh request ids');
  assert(
    Math.abs(Date.parse(unlinked.request.timestamp) - Date.now()) < 60_000,
    'a fresh timestamp',
  );
  assertEquals(
    r.stdout.match(/^ask smapi invoke-skill-end-point --skill-id \S+ --stage development/gm)
      ?.length,
    2,
  );
  assert(!r.stdout.includes(token), 'the real token is never printed');
});

Deno.test('the unlinked body, signed like Amazon does, gets the LinkAccount card from our handler', async () => {
  const r = await smoke(['--dry-run'], { ALEXA_SKILL_ID: testSkillId });
  const body = r.stdout.split('\n').find((l) => l.startsWith('{'))!;
  const ca = await makeTestCa();
  const lines: string[] = [];
  const unexpected = () => Promise.reject(new Error('an unlinked launch reaches no store'));
  const deps: Deps = {
    verify: (headers, bytes) =>
      verifyRequest(headers, bytes, {
        anchors: [ca.root],
        fetchChain: () => Promise.resolve(ca.chainPem),
        skillIds: [testSkillId],
        now: () => new Date(),
      }),
    authenticate: unexpected,
    takeAdds: unexpected,
    addItems: unexpected,
    listItems: unexpected,
    remember: unexpected,
    revoke: unexpected,
    counted: unexpected,
    report: (e) => {
      throw e;
    },
    log: (line) => lines.push(line),
  };
  const res = await createHandler(deps)(
    new Request('http://local/alexa', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        signaturecertchainurl: testCertUrl,
        'signature-256': await ca.sign(body),
      },
      body,
    }),
  );
  assertEquals(res.status, 200, 'verification accepted the request');
  const reply = await res.json();
  assertEquals(reply.response.card, { type: 'LinkAccount' });
  assertEquals(lines.map((l) => l.replace(/ rid=.*$/, '')), [
    'alexa: LaunchRequest - de-DE linked=false -> link',
  ], 'the hinted line');
});

Deno.test('a good answer passes; the token goes to ask but never to the output', async () => {
  const r = await smoke([], { ALEXA_SKILL_ID: testSkillId, ALEXA_SMOKE_TOKEN: token }, 'good');
  assertEquals(r.code, 0, r.stdout + r.stderr);
  assertStringIncludes(r.stdout, 'PASS unlinked: "Bitte verknüpfe zuerst dein Snacklist-Konto."');
  assertStringIncludes(r.stdout, 'LinkAccount, 312 ms at Amazon');
  assertStringIncludes(r.stdout, 'PASS linked: "Was soll auf die Liste?"');
  assertStringIncludes(r.stdout, 'scripts/alexa/diagnose.sh --last 15m');
  assertEquals(r.sent.length, 2);
  assertStringIncludes(r.sent[1], token, 'the linked body carries the token');
  assert(!r.sent[0].includes('accessToken'), 'the unlinked body has none');
  assertEquals(JSON.parse(r.sent[0]).session.application.applicationId, testSkillId);
  assert(!(r.stdout + r.stderr).includes(token), 'the token is never printed');
});

Deno.test('without ALEXA_SMOKE_TOKEN the linked run is skipped, unlinked still runs', async () => {
  const r = await smoke([], { ALEXA_SKILL_ID: testSkillId }, 'good');
  assertEquals(r.code, 0, r.stdout + r.stderr);
  assertStringIncludes(r.stdout, 'PASS unlinked');
  assertStringIncludes(r.stdout, 'SKIP linked: set ALEXA_SMOKE_TOKEN');
  assertEquals(r.sent.length, 1);
});

Deno.test('the apology, a FAILED status or a crashing ask fail (exit 1)', async () => {
  const env = { ALEXA_SKILL_ID: testSkillId, ALEXA_SMOKE_TOKEN: token };
  const apology = await smoke([], env, 'apology');
  assertEquals(apology.code, 1);
  assertStringIncludes(apology.stdout, 'FAIL unlinked: no LinkAccount card');
  assertStringIncludes(apology.stdout, 'FAIL linked: shouldEndSession is true');
  const failed = await smoke([], env, 'failed');
  assertEquals(failed.code, 1);
  assertStringIncludes(failed.stdout, 'FAIL unlinked: status FAILED: An error occurred');
  const crash = await smoke([], env, 'crash');
  assertEquals(crash.code, 1);
  assertStringIncludes(crash.stdout, 'FAIL linked: ask failed');
  assert(!(crash.stdout + crash.stderr).includes(token), 'ask echoing the token is masked');
});

Deno.test('no ask or no skill id stops before any call (exit 2)', async () => {
  const noAsk = await smoke([], { ALEXA_SKILL_ID: testSkillId });
  assertEquals(noAsk.code, 2);
  assertStringIncludes(noAsk.stderr, "'ask' not found");
  const noSkill = await smoke([], {}, 'good');
  assertEquals(noSkill.code, 2);
  assertStringIncludes(noSkill.stderr, 'ALEXA_SKILL_ID is not set');
  assertEquals(noSkill.sent.length, 0);
});
