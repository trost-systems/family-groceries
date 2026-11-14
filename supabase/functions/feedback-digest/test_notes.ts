// Notes and batches for the digest's tests.
import type { Note, OpenBatch } from './handler.ts';

export const note = (over: Partial<Note> = {}): Note => ({
  id: '30000000-0000-4000-8000-000000000001',
  created_at: '2026-11-11T09:00:00.123456Z',
  created_berlin: '2026-11-11 10:00',
  category: 'bug',
  message: 'Der Haken reagiert spät.',
  platform: 'ios',
  app_version: '1.4.0',
  build: '88',
  premium: false,
  contact_ok: false,
  email: null,
  ...over,
});

export const batch = (notes: Note[], digestOn = '2026-11-12'): OpenBatch => ({
  enabled: true,
  digest_on: digestOn,
  since: { created_at: '2026-11-11T07:00:00.000000Z', id: '00000000-0000-0000-0000-000000000000' },
  notes,
});
