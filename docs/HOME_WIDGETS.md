# Home Screen widgets (job 63)

Hummlist shows the shared list on the iPhone and Android Home Screen: how many
items are open and the next few, with their store's name in a hex pill, and an
Add button that opens the app's add sheet. The widgets only read what the app
last wrote; they never reach the network and never change the list.

## Pieces

| Piece | Where |
| --- | --- |
| Payload, sync, launch links | `app/lib/home_widget/` |
| iOS WidgetKit extension `HomeWidget` (`com.hummlist.app.HomeWidget`) | `app/ios/HomeWidget/` |
| Android Jetpack Glance widget | `app/android/app/src/main/kotlin/com/hummlist/app/widget/` |
| Colours (light and dark), generated from the tokens | `app/ios/HomeWidget/HummlistColors.swift`, `app/android/app/src/main/res/values{,-night}/hummlist_tokens.xml` (`node design/tokens/build.mjs`) |

The package is [`home_widget`](https://pub.dev/packages/home_widget) (Anton
Borri). On iOS the app and the extension share the App Group
`group.com.hummlist.app`; on Android the app and the widget share the plugin's
`HomeWidgetPreferences`.

## The payload

The app writes one string under the key `hummlist_widget`: JSON, version 1.

```json
{
  "version": 1,
  "state": "ready",
  "open": 9,
  "items": [
    {"name": "Hafermilch", "quantity": "2 l", "store": "Rewe"},
    {"name": "Äpfel", "quantity": null, "store": "Rewe"},
    {"name": "Brot", "quantity": null, "store": null}
  ],
  "updatedAt": "2026-11-01T21:30:00.000Z"
}
```

- `state`: `ready`, `signedOut` (no session) or `noHousehold` (signed in,
  no household yet). Only `ready` carries `open`, `items` and `updatedAt`.
- `open`: every open item on the list, not just the ones in `items`.
- `items`: the first six open items in the list's own order (stores in the
  household's order, then items without a store; categories in each store's
  walking order). `store` is the store's full name, or null without a store.
  The widget shows a store's pill on the first of its rows.
- `updatedAt`: when the app wrote it (UTC).
- No key yet, an unreadable string or another `version`: the widget asks the
  user to open Hummlist.

## Taps

| Link | Opens |
| --- | --- |
| `hummlist-widget://open/?homeWidget` | the list (the whole widget; every prompt) |
| `hummlist-widget://add/?homeWidget` | the list with the add sheet open (Add) |

iOS needs the `homeWidget` query item, or the plugin passes the URL on;
Android sends the plugin's launch action with the URI as data.
`lib/home_widget/widget_launch.dart` maps the two; anything else is ignored.
The router's auth gating still applies: signed out, both end on sign-in.

## When the app writes

`HomeWidgetSync` follows the session (signed out, no household) and the list
(every state change: start from the device's cache, sync, add, tick, a
partner's change), at most once a second, and only when the payload changed.
Starting offline, the cached list goes out as soon as the cache is read.

## Not in v1

No ticking from the widget. Android Glance actions and iOS 17 App Intents can
run code without opening the app, but a tick there has to go through the
app's op queue (`ItemOp`, retried until the server acknowledges it) or it is
lost offline; a second, native op queue is a project of its own.
