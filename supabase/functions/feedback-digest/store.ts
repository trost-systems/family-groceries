// The digest's SQL functions over the service connection. Times go as text both ways: postgres.js
// drops microseconds from timestamptz values, and the watermark needs them.
import { oneRow, type Sql } from '../_shared/db.ts';
import type { Batch, Store } from './handler.ts';

export function sqlStore(db: () => Sql): Store {
  return {
    async batch(now) {
      const rows = await db()<{ batch: Batch }[]>`
        select public.feedback_digest_batch(${now.toISOString()}::timestamptz) as batch`;
      return oneRow(rows, 'feedback_digest_batch').batch;
    },
    async advance(from, to, digestOn) {
      const rows = await db()<{ moved: boolean }[]>`
        select public.feedback_digest_advance(${from.created_at}, ${from.id}::uuid,
          ${to.created_at}, ${to.id}::uuid, ${digestOn}::date) as moved`;
      return oneRow(rows, 'feedback_digest_advance').moved;
    },
    async record(error) {
      await db()`select public.feedback_digest_record(${error}::text)`;
    },
    async status() {
      const rows = await db()<{ enabled: boolean; healthy: boolean }[]>`
        select enabled, healthy from public.feedback_digest_status()`;
      return oneRow(rows, 'feedback_digest_status');
    },
  };
}
