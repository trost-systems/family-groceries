# In-app feedback

Job 21 (Spec #2, Peter's decisions of 2026-10-27 in DECISIONS.md "Job 21"). Testers and
customers send a short note from **Mehr → Feedback senden** on iOS, Android and the web. The
note goes into one table, `public.feedback`, which Peter and the Hummlist PM read with the
service role (Supabase dashboard or the Supabase connector). Nothing notifies anyone: the PM
reads the table every Monday with the SQL below.

## What is stored

One row per note (`supabase/migrations/20261030070000_feedback.sql`; every column has a
`comment`, shown in the dashboard):

| Column | What |
| --- | --- |
| `id` | Made by the app once per note. Retrying the same note (double tap, Retry after a lost answer) stays one row. |
| `created_at` | When it arrived, UTC (set by the database). |
| `user_id` | The sender. Deleting the account deletes their notes. |
| `household_id` | The sender's household when sending, set by the database from `household_members` (never from the app). Null without one, or once that household is deleted. |
| `message` | The typed note, trimmed, 1 to 2,000 characters. |
| `category` | `bug`, `idea`, `other`, or null when none was picked. |
| `contact_ok` | The sender ticked "Peter darf mich dazu kontaktieren". The e-mail is **not** copied. |
| `app_version`, `build` | `0.1.0`, `1023` (package_info_plus, like the version line in More). |
| `platform` | `ios`, `android`, `web`, `linux`, `macos`, `windows`. |
| `os_version` | `Android 14 (SDK 34)`, `iOS 18.1`; on the web only the browser family and OS (`Safari on iOS`), never the user agent. |
| `locale` | The app's language when sending (`de`, `en`). |
| `screen` | The screen the note is about, a fixed name: the last screen before the More tab (`list` almost always), or the More page the form was opened beside on wide screens (`access`, `account`, `privacy`). Never a path, an invite code or an item. The names are `screenNames` in `app/lib/app/router.dart`. |
| `is_internal` | Peter's household (the `ANALYTICS_INTERNAL_HOUSEHOLDS` define), a debug, profile or preview build, an install marked internal under More, or a test account. The database forces it for test accounts (`.test`, `.invalid`, `.example`, `.localhost`, `example.com/.net/.org`), whatever the app says. |

Nothing from the list is attached: no item, category or store names, no household name. The
form says so ("App-Version, Gerät, Sprache und aktueller Bildschirm. Keine Listeneinträge.").
No screenshots, no device model, no e-mail.

## Who can read it

- **Clients** (the app, MCP, anyone with the publishable key) may only insert, only as
  themselves (`user_id = auth.uid()`). No select, update or delete, not even of their own notes;
  anon gets nothing. RLS policy `feedback_insert_own` plus column grants; proven in
  `supabase/tests/feedback.test.sql`, `rls.test.sql` and `e2e/tests/rls.spec.ts`.
- **Peter and the PM** read with the service role: the dashboard's Table Editor
  (`public.feedback`) or the Supabase connector, project `jdwqrallbpdbshrdhenk`.
- **The sender** gets their own notes in "Meine Daten exportieren" (section `feedback`).

## Retention

- A daily pg_cron job, `purge-old-feedback` (03:17 UTC), runs `public.purge_old_feedback()`,
  which deletes notes older than 12 months and returns how many. Only the service connection
  may run it.
- Deleting an account deletes the user's notes at once (`on delete cascade`). A deleted
  household leaves its members' notes, without the household id.
- The encrypted nightly backups (docs/BACKUP.md) keep a deleted note for up to 90 more days.

Check the schedule: `select jobname, schedule, command, active from cron.job;` and its runs:
`select status, return_message, start_time from cron.job_run_details order by start_time desc limit 7;`

## Monday summary

The PM runs these through the Supabase connector (service role, project
`jdwqrallbpdbshrdhenk`) every Monday. Both are read-only. "Last week" is the previous full
calendar week in Berlin time, Monday 00:00 to Monday 00:00, so consecutive Mondays never
overlap or miss a note (daylight-saving weeks included). External notes come first.

All notes of last week:

<!-- monday-sql:notes -->
```sql
with week as (
  select (date_trunc('week', now() at time zone 'Europe/Berlin') - interval '1 week')
           at time zone 'Europe/Berlin' as starts,
         date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' as ends
)
select case when f.is_internal then 'internal' else 'external' end as audience,
       to_char(f.created_at at time zone 'Europe/Berlin', 'YYYY-MM-DD HH24:MI') as created_berlin,
       coalesce(f.category, 'none') as category,
       f.message,
       f.screen,
       f.platform,
       f.app_version || ' (' || f.build || ')' as app_version,
       f.os_version,
       f.locale,
       f.household_id,
       f.user_id,
       f.contact_ok
from public.feedback f, week
where f.created_at >= week.starts and f.created_at < week.ends
order by f.is_internal, f.created_at, f.id;
```
<!-- /monday-sql -->

How many, per category and per platform:

<!-- monday-sql:counts -->
```sql
with week as (
  select (date_trunc('week', now() at time zone 'Europe/Berlin') - interval '1 week')
           at time zone 'Europe/Berlin' as starts,
         date_trunc('week', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' as ends
),
last_week as (
  select f.* from public.feedback f, week
  where f.created_at >= week.starts and f.created_at < week.ends
)
select case when is_internal then 'internal' else 'external' end as audience,
       'category' as by, coalesce(category, 'none') as value, count(*) as notes
from last_week group by is_internal, category
union all
select case when is_internal then 'internal' else 'external' end, 'platform', platform, count(*)
from last_week group by is_internal, platform
order by audience, by, notes desc, value;
```
<!-- /monday-sql -->

When a note has `contact_ok = true`, Peter (only he contacts anyone) looks up the address:

<!-- monday-sql:contact -->
```sql
select u.email from auth.users u
where u.id = (select f.user_id from public.feedback f where f.id = :'feedback_id' and f.contact_ok);
```
<!-- /monday-sql -->

In the dashboard's SQL editor, replace `:'feedback_id'` with the note's id in quotes.

`scripts/feedback-monday.sh` (run by the db gate) seeds fake notes on the local stack, runs the
three blocks above exactly as written here and checks the result, so this page and the queries
can't drift apart. Its output on fake data is in the PR of job 21.
