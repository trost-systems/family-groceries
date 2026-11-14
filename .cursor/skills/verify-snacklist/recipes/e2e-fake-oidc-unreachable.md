---
gate: e2e
signal: ^ {4}\[[a-z]+\] › tests/(id-token\.spec\.ts:[0-9]+:[0-9]+ › |onboarding\.spec\.ts:[0-9]+:[0-9]+ › AC6: (Apple|Google) sign-in \(fake provider\)|social-sign-in\.spec\.ts:[0-9]+:[0-9]+ › (a first provider sign-in goes through household onboarding|the same email via a provider lands in the existing account and household))
---
# The stack's containers cannot reach the fake sign-in provider on the host

## Condition

All of these hold:

- Every failed test is one of these ten, the tests that call `fakeIdToken`, or `viaFakeProvider`
  without `cancel` (`e2e/tests/helpers.ts`):
  - the six tests of `e2e/tests/id-token.spec.ts`,
  - the two `AC6: … sign-in (fake provider)` tests of `e2e/tests/onboarding.spec.ts`,
  - in `e2e/tests/social-sign-in.spec.ts`, "a first provider sign-in goes through household
    onboarding" and "the same email via a provider lands in the existing account and household".

  Any other failed test is not this recipe: read it on its own. That includes "canceling at the
  provider says so on the login screen": the provider sends the browser back with an error, Auth
  has no code to exchange and asks the provider nothing, and the test passes on the runner.
- The auth container cannot open a host port. With the stack up, from the repo root:

  ```bash
  port="$(sed -n 's|^url = "http://host.docker.internal:\([0-9]*\)/realms/test"|\1|p' supabase/config.toml)"
  project="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
  node e2e/fake-oidc.mjs "$port" & sleep 1
  docker exec "supabase_auth_$project" wget -T 5 -qO- "http://host.docker.internal:$port/realms/test/.well-known/openid-configuration"
  kill $!
  ```

  `wget: download timed out` is this recipe. A JSON document means the provider is reachable: the
  failure is real, read the trace. Any other answer (connection refused, no such container, the
  port held by a running e2e) decides nothing: fix the probe and run it again.

On the Hetzner runner the second point holds (measured 13 and 14 Nov 2026: timed out after 5 s,
while `curl` on the host got 200 from the same server). GitHub's runners reach the host, and CI is
where these tests pass.

## Mechanism

Supabase Auth cannot fake Google or Apple, so the e2e suite signs in through Auth's Keycloak provider
against `e2e/fake-oidc.mjs`, which Playwright starts on the host
(`[auth.external.keycloak] url = http://host.docker.internal:<port>/realms/test`). Auth runs in a
container and fetches the provider's discovery document and keys from the host. On the runner
that connection times out instead of being refused, so a firewall drops it (inferred; its rules
are not ours to read or change). Auth then
answers with an error, and the tests that expect a refusal fail as well, after 10.0 to 10.4 s each
in the transcripts: the error they get is the timeout, not the refusal they assert.

## Do

- Take the other tests of the local run as the local result, and get these from GitHub's runners:
  `scripts/ci-e2e.sh --spec "tests/id-token.spec.ts tests/onboarding.spec.ts tests/social-sign-in.spec.ts" --no-db`
  for the pushed branch (`docs/CI.md`, On-demand e2e), or the PR's own `e2e` jobs.
- Say so where you report the gate: the local e2e gate failed on exactly these tests, and they
  passed in run `<id>`.
- When the change touches sign-in, ID tokens or the invite flow after a provider sign-in, the CI run
  is the proof. Do not claim it from the local run.

## Do not

- Skip, `fixme` or delete the tests, or add a host check that skips them: the gate would report
  green for sign-in code nobody ran.
- Bind the provider elsewhere, open the firewall, or point `supabase/config.toml` at another host.
- Rerun the gate hoping for another result. It costs the box-wide e2e lock each time and cannot
  pass here.

## Evidence

Counted on 13 Nov 2026 in the transcripts of 199 jobs, from the `✘` and `✓` lines of Playwright's
list reporter (job 219's `fake_oidc_failures.py`). A line is local unless its tool result carries a
GitHub log timestamp, its command names GitHub, or it is the one tool result found reading a saved
CI log. A job counts for a test when the script finds a `✘` line of it from a local run, a first
attempt or its retry. A time is from a first attempt's line that kept it.

Every job number here is a lower bound. The agents' commands filter, cut and sort what they
print: some cut the retry mark and the time off a line, and two cut the `✘` itself (the script
lists those two tool results by hand). Failures printed only as a numbered failure header or as a
line under `N failed` are not counted. Job 219's fourth review counted those forms as well and
found 22 jobs (14, 22 and 13 for the table's three rows).

| Tests | Jobs with a local `✘` line, at least | Time of a failed first attempt | Local `✓` lines |
| --- | ---: | --- | ---: |
| `id-token.spec.ts`, all but the sixth | 12 | 10.0 to 10.4 s | 0 |
| `id-token.spec.ts`, the sixth ("… reuse the one account") | 0 | | 1 |
| `onboarding.spec.ts`, the two AC6 tests | 18 | 21.4 to 22.6 s | 0 |
| `social-sign-in.spec.ts`, the two tests | 11 | 21.0 to 27.0 s | 0 |

- At least 20 of the 199 jobs have a local `✘` line of one of the ten. Nine of the ten have such
  lines; the sixth test of `id-token.spec.ts` has none, for the reason two points down. A job is
  here because its agent printed a failure, so the number counts jobs that read one and not runs.
- In 12 failed runs of the e2e gate, in 7 of those jobs, one of the two AC6 tests was the first
  failure in what the agent's command printed.
- The sixth test of `id-token.spec.ts` compared the users of two sign-ins and passed with both
  absent: its one local line is a pass after 20.0 s, in a run where the file's first test failed.
  Since job 219 it requires the first user, and failed with the other five in that job's run.
- Every other `✓` line of the ten that the count found is from a CI log.

## Example

The summary of a whole-suite run of the e2e gate on the runner, from before job 219: nine of the
ten, since the sixth test of `id-token.spec.ts` still passed there. The lines are job 116's
(`build.jsonl` line 994). That command printed the three counts first and the test lines sorted
after them. Here the counts stand where the reporter prints them, and the test lines keep the
command's sorted order (the reporter lists Google before Apple). Two of the lines end in a rule
of dashes in the transcript, left out here:

```text
  9 failed
    [chromium] › tests/id-token.spec.ts:17:1 › the raw nonce matching the hashed one in the token signs in
    [chromium] › tests/id-token.spec.ts:24:1 › a wrong or missing nonce is refused
    [chromium] › tests/id-token.spec.ts:30:1 › a token issued to another client is refused
    [chromium] › tests/id-token.spec.ts:36:1 › an ID token for an existing email account links to it, household included
    [chromium] › tests/id-token.spec.ts:54:1 › an account created by a provider signs in again by magic link
    [chromium] › tests/onboarding.spec.ts:246:3 › AC6: Apple sign-in (fake provider) lands on the join screen
    [chromium] › tests/onboarding.spec.ts:246:3 › AC6: Google sign-in (fake provider) lands on the join screen
    [chromium] › tests/social-sign-in.spec.ts:70:1 › a first provider sign-in goes through household onboarding
    [chromium] › tests/social-sign-in.spec.ts:85:1 › the same email via a provider lands in the existing account and household
  4 skipped
  185 passed (25.4m)
```

The summary of job 219's run of the gate for `id-token.spec.ts` alone, with that change to its
sixth test (`scripts/verify.sh --only e2e -- tests/id-token.spec.ts` on the runner): all six.
Two of its lines end in a rule of dashes as well:

```text
  6 failed
    [chromium] › tests/id-token.spec.ts:18:1 › the raw nonce matching the hashed one in the token signs in
    [chromium] › tests/id-token.spec.ts:25:1 › a wrong or missing nonce is refused
    [chromium] › tests/id-token.spec.ts:31:1 › a token issued to another client is refused
    [chromium] › tests/id-token.spec.ts:37:1 › an ID token for an existing email account links to it, household included
    [chromium] › tests/id-token.spec.ts:55:1 › an account created by a provider signs in again by magic link
    [chromium] › tests/id-token.spec.ts:71:1 › Apple and Google again with the same email reuse the one account
```

## Not this

Lines from the transcripts that the signal must pass over: two of the ten passing in a CI log and
the cancel test passing on the runner (jobs 51 and 57), then two tests that failed for their own
reasons in job 168b's summary (`build.jsonl` line 3809).

```text
  ✓  26 [chromium] › tests/onboarding.spec.ts:242:3 › AC6: Google sign-in (fake provider) lands on the join screen (3.4s)
  ✓  27 [chromium] › tests/onboarding.spec.ts:242:3 › AC6: Apple sign-in (fake provider) lands on the join screen (2.8s)
  ✓  51 [chromium] › tests/social-sign-in.spec.ts:93:1 › canceling at the provider says so on the login screen (1.7s)
    [chromium] › tests/list.spec.ts:12:1 › adds are grouped by category in route order
    [chromium] › tests/social-sign-in.spec.ts:105:1 › canceling at the provider says so on the login screen
```
