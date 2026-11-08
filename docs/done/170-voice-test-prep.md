# 170-voice-test-prep: ready for Peter's Siri and Alexa session (2026-11-07)

Peter tests Siri and Alexa on Sunday 2026-11-08 at 16:00. His runbook is
`docs/voice/TEST-SESSION-2026-11-08.md`.

What changed:

- `voice` logs one line per request: how the caller signed in, mode, language, the iPhone's
  build and Siri path (`x-hummlist-client`), outcome, status, item count and time. It never logs
  text or ids (`voice/request_line_test.ts`). Docs are in `SIRI_SHORTCUT.md`, "Request log".
- `alexa`'s request line adds the end of Alexa's request id, the number of words in the items
  slot, the confirmation status, the session end reason, Alexa's error type and the time
  (`handler_test.ts`, "job 170"). `scripts/alexa/diagnose.ts` reads both line shapes. Docs are in
  `ALEXA.md`, "Request log".
- The iPhone sends `x-hummlist-client: ios-<build>.<AddItems|AddItems.item|ReadList|Lists.add|Lists.read>`
  and logs each intent to Console.app (`com.hummlist.app`, `siri`). XCTest
  `testTheRequestNamesTheBuildAndTheIntent` covers it.
- German negative Siri phrases: one plain translation per English key. Three checkers reject a
  negative left in English. DECISIONS "Job 170" item 3 explains why the change is a hedge, not a
  proven fix.
- `scripts/voice/health.sh` checks the deploys, the unsigned answers of both functions, that both
  write the new line in production, the Alexa secret, the OAuth server and client, the integration
  lock, the newest TestFlight build, and with `--amazon` (box) the development stage against the
  repo. `scripts/voice/tail.sh` follows a session live.

Not done from hz:

- The Alexa development-stage deploy of `humm list` needs the box's ASK login. BOARD asked the box
  to run `scripts/alexa-deploy-dev.sh` and `health.sh --amazon`.
