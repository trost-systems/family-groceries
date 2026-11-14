# Local proof, 2026-11-14T00:35:26Z, stack family-groceries-225, synthetic notes only

## pg_cron run log (job scheduled every minute for the proof)
id | status | content
1 | 200 | {"status":"sent","count":2}
2 | 200 | {"status":"empty"}

## Mail the fake Resend received

```
to: hello@snacklist.app
from: "Peter · Snacklist" <hello@snacklist.app>
subject: Snacklist feedback digest 2026-11-13 (2 new)
idempotency-key: feedback-digest/2026-11-13/110e8bcaec89907e5031cc25b115a0b4
fields: from,html,subject,text,to

Snacklist feedback digest 2026-11-13 (2 new)

1. 2026-11-12 18:30 (Berlin) · Category: bug
Die Liste springt nach oben, wenn ich <script>alert(1)</script> eintippe.
Zweite Zeile: Äpfel & Öl.
ios · 0.9.0 (1201)
Premium: no
Reply allowed: yes
Email: anna.beispiel@digest-proof.snacklist.app

2. 2026-11-13 07:30 (Berlin) · Category: idea
Could stores be sorted by aisle?
android · 0.9.0 (1199)
Premium: no
Reply allowed: no

```

## Function log lines

```
      1 feedback-digest: disabled
      1 feedback-digest: empty
      1 feedback-digest: sent
      1 feedback-digest: unauthorized
```

## Status route

off: {"enabled":false,"healthy":true}; on after a good run: {"enabled":true,"healthy":true}; after send_failed recorded: {"enabled":true,"healthy":false}
