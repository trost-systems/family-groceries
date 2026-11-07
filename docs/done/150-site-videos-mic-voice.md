# Job 150: site videos with the microphone, and voice-add

- The Linux capture build shows the add field's microphone (`FG_DICTATION`, scripted recognizer
  at speech_to_text's platform boundary; `app/test_driver/scripted_speech.dart`).
- All four loops (add-tick, household-sync, mcp-chat, new voice-add), DE and EN, wide and compact:
  32 web files, posters, WebVTT in `site/public/media/`. Numbers in `marketing/videos/*/REVIEW.md`.
- Landing page: "In der App" / "In the app" card in the voice block (`site/landing.mjs`,
  `copy.yml`, `COPY_NEEDED.md`).
- App fixes found on the way: the field follows dictated words; dictated rows land in their
  category at once (voice parse answer carries `categoryId`).
- Verify: `scripts/verify.sh --only lint,site,functions,flutter`; `FG_DICTATION='…' scripts/fg up`
  then the "Microphone on linux" recipe in `.cursor/skills/verify-family-groceries/features/voice.md`.
- Review 0 (2026-11-06): rebased onto main after #261 (job 119); DECISIONS and NEEDS_LEAD keep
  both sections. #261 changes only e2e tests, so the footage stays valid.
- Review 1 (2026-11-06): the landing page's play button moved off the add field per slot
  (stills at 1440 and 390 px in `docs/screenshots/150/site-toggle-*.png`); `demo.voice-add`
  says she taps stop; the preview URL is in the PR body.
- Review 1 rebase: onto main after #290 (interactive store chips); media README keeps main's
  slot list plus voice-add; site tests 170/170 on Node 22 and 24.
- Review 2 (2026-11-07): rebased onto main after #304 (job 158); DECISIONS and DONE_SUMMARY keep
  both jobs' sections. #304 touches only mcp-proxy and scripts, so footage and site are unchanged.
