// The daily feedback digest: /functions/v1/feedback-digest (docs/FEEDBACK.md, "Daily digest").
// Not wrapped in withTelemetry: nothing about a run leaves the function but the mail.
import { serviceDb } from '../_shared/db.ts';
import { configFrom, createHandler } from './handler.ts';
import { sqlStore } from './store.ts';

Deno.serve(createHandler({
  ...configFrom(Deno.env),
  store: sqlStore(serviceDb),
  now: () => new Date(),
}));
