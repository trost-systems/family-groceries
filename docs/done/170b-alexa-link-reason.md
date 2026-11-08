# 170b-alexa-link-reason: Alexa logs why a linked token is rejected (2026-11-08)

Job 170's review 2 (Must fix 1) found a gap for Peter's voice test on 2026-11-08. When Hummlist
rejected Alexa's linked token, the request line said only `linked=true -> link`. Runbook row X5
read that as "relink", and when relinking failed it had no next row. This PR builds on all of
job 170's commits (#321) and supersedes that PR.

What changed:

- `AuthError` (`supabase/functions/_shared/auth.ts`) carries a closed `detail` for
  `invalid_token`: `expired`, `issuer`, `audience`, `signature`, `claims`, `malformed`,
  `unverified`, `session_ended`, `unknown_key` and `not_oauth` (the last is set by
  `alexa/deps.ts`). Responses keep the bare reason, so the API, MCP and old apps see no change.
- `alexa`'s request line logs it in the existing `[reason]` slot, as in
  `-> link invalid_token:session_ended`. A `SkillAccountLinked` event whose new token is rejected
  logs `-> empty invalid_token:<detail>`. Tests: `handler_test.ts` "job 170b" and `auth_test.ts`
  (each jose failure maps to its detail).
- `scripts/alexa/diagnose.ts` parses reasons on `link` and `empty`. It prints each reason seen
  with what it means and the next step (`linkReasons`, typed over every detail).
- Runbook (`docs/voice/TEST-SESSION-2026-11-08.md`): X5 is split into X5 to X5d by reason. The
  2A linking step, the "How to read a line" block (`nothing_added`, refresh rows), V2 and the
  Zahnpasta note follow review 2's nice-to-haves. `docs/ALEXA.md` "Request log" and
  "Troubleshooting" are split the same way.
- `scripts/voice/tail.sh` labels a `token_revoked` token call (Supabase's refresh rotation) as
  `grant=refresh_token`, as diagnose.ts already did.

How to verify:

- `cd supabase/functions && deno test -A _shared/auth_test.ts alexa/` and
  `cd scripts/alexa && deno test -A`.
- On a local stack, run `scripts/alexa-say.sh --token <token> --read` with an app session token, a
  signed-out one and `not-a-jwt`. The edge runtime log then shows `invalid_token:not_oauth`,
  `:session_ended` and `:malformed`.

Results: all functions and alexa script tests pass. The lint and functions gates pass. The live
local drive on 2026-11-08 logged these lines, and no part of the token appeared in the log:

```
alexa: IntentRequest ReadListIntent de-DE linked=true -> link invalid_token:malformed rid=local slot=- confirm=NONE ended=- error=- ms=5
alexa: IntentRequest AddItemIntent de-DE linked=true -> link invalid_token:session_ended rid=local slot=1 confirm=NONE ended=- error=- ms=9
alexa: IntentRequest ReadListIntent de-DE linked=true -> link invalid_token:not_oauth rid=local slot=- confirm=NONE ended=- error=- ms=8
```

Not done here: the deploy. supabase-deploy.yml ships it from main after the merge, and the lead
runs `VOICE_NEED_SHA=<merge sha> scripts/voice/health.sh` before 15:00. Job 170's open box step
(`alexa-deploy-dev.sh`, `health.sh --amazon`) is unchanged.
