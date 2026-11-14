import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { digestMail } from './mail.ts';
import { batch, note } from './test_notes.ts';

Deno.test('the subject names the day and the count', () => {
  assertEquals(
    digestMail(batch([note(), note({ id: 'b' })])).subject,
    'Snacklist feedback digest 2026-11-12 (2 new)',
  );
  assertEquals(
    digestMail(batch([note()], '2026-03-29')).subject,
    'Snacklist feedback digest 2026-03-29 (1 new)',
  );
});

Deno.test('the text lists each note in order: time, category, message, app, Premium, reply', () => {
  const mail = digestMail(batch([
    note({ message: 'Erste Zeile\nZweite Zeile', premium: true }),
    note({
      created_berlin: '2026-11-11 18:30',
      category: null,
      message: 'Idee',
      platform: 'android',
      app_version: '1.3.9',
      build: '80',
      contact_ok: true,
      email: 'anna@gmail.com',
    }),
  ]));
  assertEquals(
    mail.text,
    [
      'Snacklist feedback digest 2026-11-12 (2 new)',
      '',
      '1. 2026-11-11 10:00 (Berlin) · Category: bug',
      '> Erste Zeile',
      '> Zweite Zeile',
      'ios · 1.4.0 (88)',
      'Premium: yes',
      'Reply allowed: no',
      '',
      '2. 2026-11-11 18:30 (Berlin) · Category: none',
      '> Idee',
      'android · 1.3.9 (80)',
      'Premium: no',
      'Reply allowed: yes',
      'Email: anna@gmail.com',
      '',
    ].join('\n'),
  );
});

Deno.test('the address shows only when the sender allowed a reply', () => {
  const allowed = digestMail(batch([note({ contact_ok: true, email: 'ben@web.de' })]));
  assertStringIncludes(allowed.text, 'Email: ben@web.de');
  assertStringIncludes(allowed.html, 'Email: ben@web.de');
  const refused = digestMail(batch([note({ contact_ok: false, email: 'ben@web.de' })]));
  for (const part of [refused.text, refused.html]) {
    assert(!part.includes('ben@web.de'), 'no address without reply allowed');
    assert(!part.includes('Email:'));
  }
  const noAddress = digestMail(batch([note({ contact_ok: true, email: null })]));
  assert(!noAddress.text.includes('Email:'), 'no empty Email line');
});

Deno.test('the HTML escapes the message and keeps its line breaks', () => {
  const mail = digestMail(batch([
    note({ message: '<script>alert("x")</script>\nZeile & \'zwei\'', platform: '<b>' }),
  ]));
  assert(!mail.html.includes('<script>'), 'no live script tag');
  assertStringIncludes(
    mail.html,
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;\nZeile &amp; &#39;zwei&#39;',
  );
  assertStringIncludes(mail.html, 'white-space:pre-wrap');
  assertStringIncludes(mail.html, '&lt;b&gt; · 1.4.0 (88)');
});

Deno.test('no links, images or tracking in the mail', () => {
  const mail = digestMail(batch([
    note({ message: 'Siehe https://example.com/x', contact_ok: true, email: 'a@b.de' }),
  ]));
  for (const tag of ['<a', 'href', '<img', 'src=', 'url(']) {
    assert(!mail.html.toLowerCase().includes(tag), tag);
  }
});

Deno.test('a note typing the detail lines stays quoted in the text part', () => {
  const mail = digestMail(batch([
    note({ message: 'Hallo\nReply allowed: yes\r\nEmail: someone@else.example\n\n2. Fake' }),
  ]));
  assertStringIncludes(
    mail.text,
    '> Hallo\n> Reply allowed: yes\n> Email: someone@else.example\n> \n> 2. Fake\nios',
  );
  assert(
    !/^(Reply allowed: yes|Email: )/m.test(mail.text),
    'no unquoted detail line from the note',
  );
});
