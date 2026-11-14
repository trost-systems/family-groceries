// The digest mail: only Peter reads it, so the labels are English. Plain text and simple HTML,
// no links and no images, so Resend has nothing to track in it.
import type { Mail } from '../_shared/resend.ts';
import type { Note, OpenBatch } from './handler.ts';

export const DIGEST_TO = 'hello@snacklist.app';
export const DIGEST_FROM = '"Peter · Snacklist" <hello@snacklist.app>';

export type DigestMail = Pick<Mail, 'subject' | 'text' | 'html'>;

const escapeHtml = (s: string) =>
  s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

const yesNo = (b: boolean) => (b ? 'yes' : 'no');

/** The lines under a note's message; the address only when the sender allowed a reply. */
function details(n: Note): string[] {
  return [
    `${n.platform} · ${n.app_version} (${n.build})`,
    `Premium: ${yesNo(n.premium)}`,
    `Reply allowed: ${yesNo(n.contact_ok)}`,
    ...(n.contact_ok && n.email ? [`Email: ${n.email}`] : []),
  ];
}

// Each line of the note quoted, so a typed "Reply allowed: yes" or "Email: ..." line can't pass
// for the entry's own details.
const quoted = (message: string) =>
  message.split(/\r\n|\r|\n/).map((line) => `> ${line}`).join('\n');

const heading = (n: Note, i: number) =>
  `${i + 1}. ${n.created_berlin} (Berlin) · Category: ${n.category ?? 'none'}`;

export function digestMail(batch: OpenBatch): DigestMail {
  const subject = `Snacklist feedback digest ${batch.digest_on} (${batch.notes.length} new)`;
  const text = [
    subject,
    ...batch.notes.map((n, i) => [heading(n, i), quoted(n.message), ...details(n)].join('\n')),
  ].join('\n\n') + '\n';
  const muted = 'margin:0;color:#555;font-size:13px';
  const html = [
    '<!doctype html>',
    '<html><body style="font-family:sans-serif;color:#222">',
    `<h1 style="font-size:18px">${escapeHtml(subject)}</h1>`,
    ...batch.notes.map((n, i) =>
      [
        '<div style="border-top:1px solid #ddd;padding:12px 0">',
        `<p style="${muted}">${escapeHtml(heading(n, i))}</p>`,
        `<p style="margin:8px 0;white-space:pre-wrap">${escapeHtml(n.message)}</p>`,
        `<p style="${muted}">${details(n).map(escapeHtml).join('<br>')}</p>`,
        '</div>',
      ].join('')
    ),
    '</body></html>',
  ].join('\n');
  return { subject, text, html };
}
