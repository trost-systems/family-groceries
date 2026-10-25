# Job 20 evidence: the app is "Hummlist", `com.hummlist.app`

Captured 2026-10-25 on e9e5714 (port block 546xx).

- `browser-tab-and-login.png`: headed Chromium on Xvfb, the release web build
  (`scripts/gates/e2e.sh` output) at `/login`. The tab reads "Hummlist".
- `login-page.png`: the same page without browser chrome.
- `konto-loeschen.png`: the public deletion page, title "Hummlist: Konto und
  Daten löschen", linking `app.hummlist.com`.
- `linux-list-peter.png`, `linux-magic-link-sent.png`: the Linux debug app
  driven with `scripts/fg` (`FG_PORT_PREFIX=546`).

Read from the real artifacts:

| Check | Result |
| --- | --- |
| `app/build/web/index.html` | `<title>Hummlist</title>`, `apple-mobile-web-app-title` "Hummlist" |
| `app/build/web/manifest.json` | `name` and `short_name` "Hummlist" |
| `aapt2 dump badging app-debug.apk` | `package: name='com.hummlist.app'`, `application-label:'Hummlist'`, `launchable-activity: name='com.hummlist.app.MainActivity'`; deep-link scheme `com.hummlist.app` |
| Linux window (`xdotool`, `xprop`) | title "Hummlist", `WM_CLASS` "com.hummlist.app" |
| Magic link mail (`fg mail --to lea`) | `redirect_to=com.hummlist.app://login-callback` (GoTrue keeps it, so it is on the allow list) |
| `fg fn call voice --bearer invalid-token` | 401, "Erstelle in der Hummlist-App unter Menü, Zugänge einen neuen." |

To rerun the artifact checks:

```bash
cd app
flutter build apk --debug
~/android-sdk/build-tools/36.0.0/aapt2 dump badging build/app/outputs/flutter-apk/app-debug.apk \
  | grep -E "^package|application-label:|launchable-activity"
~/android-sdk/build-tools/36.0.0/aapt2 dump xmltree --file AndroidManifest.xml \
  build/app/outputs/flutter-apk/app-debug.apk | grep -A3 scheme
grep -o '<title>[^<]*' build/web/index.html   # after a web build (the e2e gate makes one)
export FG_PORT_PREFIX=546                      # your port block
scripts/fg up --clients peter
DISPLAY=:5461 xdotool search --name Hummlist getwindowname   # display = <prefix>1
```
