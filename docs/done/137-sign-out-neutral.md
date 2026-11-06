# Job 137: sign out looks like a normal More row

PR: https://github.com/trost-systems/family-groceries/pull/279 (lead merges).

## What changed

- „Abmelden“ / "Sign out" on More now has the label and icon colours and weight of the other plain rows (Lizenzen, Einstellungen). Before, both were in the error red with a bold label.
- `app/lib/more/more_screen.dart`: `_Row` loses its `destructive` flag, whose only user was sign-out. Glyph, layout, copy and the missing chevron stay. Account deletion on Konto is unchanged.
- `app/test/more/more_menu_test.dart`: the sign-out row's rendered label style and icon colour must equal Lizenzen's. It fails on main (`Actual` red 0.77) and passes here.
- Goldens `more-end-{de,en}-{light,dark}.png` regenerated.
- Feature files (verify-hummlist `more-help.md`, FEATURES-FOR-WRITERS, verify-family-groceries `shell-more.md`) say "plain like the other rows" instead of "red". `docs/DECISIONS.md` has a Job 137 section.

## How it was verified

- `scripts/verify.sh --only gitleaks,lint,changelog,fg-cli` and `--only flutter`: passed. CI ci-ok green on the first push (run 42132763682).
- Linux desktop debug app (`scripts/fg`, stack 603xx): More scrolled to the end in light and dark, screenshots in `docs/screenshots/137/linux-*.png`. The reddest pixel (r - max(g, b)) of the sign-out row equals Lizenzen's: 0 in light, -12 in dark. In main's golden the sign-out row measured 156. A tap on „Abmelden“ showed the login screen after 514 ms.

## Missing

- The web build (verify-hummlist) was not driven. Its launch takes `/tmp/fg-e2e.lock`, which flake stress runs of jobs 119 to 126 held for over two hours. The change is in shared Flutter widget code with no web-specific path; the CI e2e suite passed on the web build.
