# Tips on the list

A small card at the top of the List tab shows one tip at a time (job 80). The X hides it for good on this device for this user; the next tip in the queue shows from the next app start on. The card appears only once the list has an open item and the gesture card („Tippen hakt ab …“) is dismissed, so the first, empty list stays clean and there is never more than one card. It scrolls with the list.

## Sub-features

- `tip-card` the card: icon, bold title, one or two lines of text, and an X (tooltip and screen-reader name „Tipp ausblenden“ / "Hide tip", key `tip-dismiss`). The card is one screen-reader group; the title and text read together. Key `tip-<id>`.
- `tip-queue` the tips in order (`tips` in `app/lib/tips/tips.dart`):
  1. `edit-long-press` „Artikel bearbeiten“: „Halte einen Artikel gedrückt, ohne ihn zu ziehen, und ändere Menge, Marke, Laden und mehr.“ (EN "Edit an item": "Press and hold an item without dragging it to change its quantity, brand, store and more.")
  2. `quick-add-amounts` „Menge gleich mittippen“: „Schreib „2 Gurken“ oder „Milch 2 l“, und Hummlist erkennt die Menge.“ (EN "Type the amount too": "Write “2 cucumbers” or “milk 2 l” and Hummlist picks up the amount.")
- `tip-dismiss` the X animates the card away (instantly with reduced motion) and stores the id in the device cache under `tips.<user id>`. It stays dismissed after signing out and in again on that device; another device shows it again.
- `tip-targeting` a tip can name its platforms (iOS, Android, web, macOS, Windows, Linux) and an app version range; both tips today show everywhere.

## How to get to it (user POV)

- Open the app with at least one item on the list, after tapping „Verstanden“ on the gesture card.

## Driving it with Playwright

Preconditions: a seeded household with items (launch.sh's demo household); `signIn` from helpers/lib.mjs dismisses the gesture card, so the first tip shows right after sign-in.

- **Card.** `page.getByRole('button', { name: 'Tipp ausblenden' })` visible; `page.getByText('Artikel bearbeiten')` visible.
- **Dismiss.** Click „Tipp ausblenden“: the card goes; reload the page and sign-in state persists: the next tip („Menge gleich mittippen“) shows.
- Widget tests: `app/test/tips/tip_card_test.dart`, `app/test/tips/tips_test.dart`; goldens `app/test/design/tip_card_golden_test.dart`.

## Gotchas

- The queue is read once per List tab build, so the next tip never appears right after a dismiss in the same session.
- A brand new household sees no tip until its first item is on the list and the gesture card is dismissed.
