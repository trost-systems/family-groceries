import { assert, assertEquals, assertExists, assertRejects } from '@std/assert';
import {
  confirmationMail,
  confirmUrl,
  inviteMail,
  type Mail,
  mailAllowFrom,
  recipientAllowed,
  refusal,
  siteOrigin,
  unsubscribeLinks,
  welcomeMail,
} from './mail.ts';
import { MailError, resendMailer } from './resend.ts';

const ID = '3f2a8c1e-0b6d-4e7f-9a1b-2c3d4e5f6a7b';
const SIG = 'ab'.repeat(32);
const TOKEN = 'A'.repeat(43);
const unsubscribe = unsubscribeLinks('https://hummlist.com', 'de', ID, SIG);
const unsubscribeEn = unsubscribeLinks('https://hummlist.com', 'en', ID, SIG);
const SITE = 'https://hummlist.com';

const assertNoImagesOrTracking = (mail: Mail) => {
  const glued = mail.text.match(/https?:\/\/[^\s<>]*[.,:;)](?=\s|$)/);
  assert(!glued, `plain text: punctuation glued to a URL: ${glued?.[0]}`);
  assert(!/<img|<script|<link|url\(/i.test(mail.html), 'no images, scripts or remote styles');
  const hrefs = [...mail.html.matchAll(/href="([^"]+)"/g)].map(([, href]) => {
    assertExists(href);
    return href.replaceAll('&amp;', '&');
  });
  for (const href of hrefs) {
    assert(
      href.startsWith('https://hummlist.com/') ||
        href.startsWith('https://play.google.com/apps/testing/'),
      `a direct link, no redirect: ${href}`,
    );
  }
};

Deno.test('links: confirm and unsubscribe values sit in the fragment; one-click is the POST endpoint', () => {
  assertEquals(
    confirmUrl('https://hummlist.com', 'de', TOKEN),
    `https://hummlist.com/de/warteliste/bestaetigen#t=${TOKEN}`,
  );
  assertEquals(
    confirmUrl('https://hummlist.com', 'en', TOKEN),
    `https://hummlist.com/en/waitlist/confirm#t=${TOKEN}`,
  );
  assertEquals(unsubscribe, {
    page: `https://hummlist.com/de/warteliste/abmelden#id=${ID}&s=${SIG}`,
    oneClick: `https://hummlist.com/api/waitlist/unsubscribe?id=${ID}&s=${SIG}&l=de`,
  });
  assertEquals(
    unsubscribeEn.page,
    `https://hummlist.com/en/waitlist/unsubscribe#id=${ID}&s=${SIG}`,
  );
});

Deno.test('siteOrigin accepts hummlist.com, snacklist.app, previews and a local site, nothing else', () => {
  for (
    const ok of [
      'https://hummlist.com',
      'https://snacklist.app',
      'https://hummlist-site-git-job-82-waitlist-peter-trost.vercel.app',
      'https://hummlist-site-abc123-peter-trost.vercel.app',
      'http://127.0.0.1:4173',
    ]
  ) assertEquals(siteOrigin(ok), ok);
  for (
    const bad of [
      null,
      '',
      'https://www.hummlist.com',
      'http://hummlist.com',
      'https://hummlist.com/',
      'https://hummlist.com.evil.example',
      'https://evil-hummlist-site-x-peter-trost.vercel.app',
      'https://hummlist-site-x-peter-trost.vercel.app.evil.example',
      'http://localhost:4173',
      'https://127.0.0.1:4173',
    ]
  ) assertEquals(siteOrigin(bad), 'https://snacklist.app', String(bad));
});

Deno.test('AC10: the German confirmation mail is doi-mail-de-v2 (M-1) with footer (a), no launch line', () => {
  const mail = confirmationMail('de', {
    confirmUrl: confirmUrl('https://hummlist.com', 'de', TOKEN),
    unsubscribe,
  });
  assertEquals(mail.from, '"Peter von Snacklist" <hello@snacklist.app>');
  assertEquals(mail.replyTo, 'hello@snacklist.app');
  assertEquals(mail.subject, 'Bitte bestätige deine E-Mail für Hummlist');
  assertEquals(mail.headers, {});
  assert(
    mail.html.includes('Ein Tipp, dann stehst du auf der Warteliste für die Beta.'),
    'preheader',
  );
  assert(mail.html.startsWith('<!doctype html>') && mail.html.includes('lang="de"'));
  assertEquals(
    mail.text,
    [
      'Hi,',
      'diese Adresse wurde auf hummlist.com für die Warteliste der Hummlist-Beta eingetragen, von dir selbst oder zum Beispiel von einem KI-Assistenten für dich. Bitte bestätige kurz, dass das deine Adresse ist:',
      `E-Mail bestätigen <https://hummlist.com/de/warteliste/bestaetigen#t=${TOKEN}>`,
      'Der Link gilt 48 Stunden. Sobald du auf der Seite dahinter bestätigt hast, stehst du auf der Liste. Wir laden jede Woche neue Tester:innen ein, deine Einladung kommt per E-Mail.',
      'Du warst das nicht? Dann ignorier diese Mail einfach. Ohne Bestätigung tragen wir dich nicht ein und löschen die Adresse nach 7 Tagen.',
      'Peter',
      '--',
      'Du bekommst diese E-Mail, weil diese Adresse auf hummlist.com für die Warteliste eingetragen wurde. ' +
      `Eintrag sofort löschen <${unsubscribe.page}>`,
      'Hummlist · Peter Trost · Yalovastr. 5 · 72108 Rottenburg am Neckar · Deutschland · support@hummlist.com\n' +
      'Impressum: https://hummlist.com/impressum · Datenschutz: https://hummlist.com/datenschutz',
    ].join('\n\n') + '\n',
  );
  assert(
    mail.html.includes(`<a href="${unsubscribe.page.replace('&', '&amp;')}"`),
    'the delete link in HTML',
  );
  assert(mail.html.includes('>Eintrag sofort löschen</a>'));
  assert(mail.html.includes('Tester:innen ein, deine Einladung kommt per E-Mail.'));
  assert(!mail.html.includes('offiziell startet'), 'no launch line in HTML either');
  assertNoImagesOrTracking(mail);
});

Deno.test('AC10: the English confirmation mail is doi-mail-en-v2 (M-2) with footer (a), no launch line', () => {
  const mail = confirmationMail('en', {
    confirmUrl: confirmUrl('https://hummlist.com', 'en', TOKEN),
    unsubscribe: unsubscribeEn,
  });
  assertEquals(mail.from, '"Peter from Snacklist" <hello@snacklist.app>');
  assertEquals(mail.subject, 'Please confirm your email for Hummlist');
  assert(mail.html.includes("One tap and you're on the beta waitlist."), 'preheader');
  assertEquals(
    mail.text,
    [
      'Hi,',
      "This address was signed up on hummlist.com for the Hummlist beta waitlist, by you or, for example, by an AI assistant for you. Please confirm that it's yours:",
      `Confirm email <https://hummlist.com/en/waitlist/confirm#t=${TOKEN}>`,
      "The link works for 48 hours. Once you've confirmed on the page it opens, you're on the list. We invite new testers every week; your invite will come by email.",
      "Wasn't you? Just ignore this email. Without confirmation we won't add you, and we delete the address after 7 days.",
      'Peter',
      '--',
      "You're getting this email because this address was signed up for the waitlist on hummlist.com. " +
      `Delete this sign-up now <${unsubscribeEn.page}>`,
      'Hummlist · Peter Trost · Yalovastr. 5 · 72108 Rottenburg am Neckar · Germany · support@hummlist.com\n' +
      'Imprint: https://hummlist.com/en/imprint · Privacy: https://hummlist.com/en/privacy',
    ].join('\n\n') + '\n',
  );
  assert(!mail.html.includes('officially launches'), 'no launch line');
  assertNoImagesOrTracking(mail);
});

Deno.test('no template carries a ⟦…⟧ marker: every mail passes the placeholder guard', () => {
  const mails = (['de', 'en'] as const).flatMap((locale) => {
    const links = locale === 'de' ? unsubscribe : unsubscribeEn;
    return [
      confirmationMail(locale, { confirmUrl: confirmUrl(SITE, locale, TOKEN), unsubscribe: links }),
      welcomeMail(locale, { unsubscribe: links, launchNews: false }),
      welcomeMail(locale, { unsubscribe: links, launchNews: true }),
      inviteMail(locale, { platform: 'ios', unsubscribe: links }),
      inviteMail(locale, { platform: 'android', unsubscribe: links }),
    ];
  });
  for (const mail of mails) {
    for (const part of [mail.subject, mail.html, mail.text, ...Object.values(mail.headers)]) {
      assert(!part.includes('⟦') && !part.includes('⟧'), `${mail.subject}: no marker`);
    }
    assertEquals(
      refusal('hello+x@hummlist.com', mail, { allow: 'test', allowPlaceholders: false }),
      null,
    );
  }
});

Deno.test('the welcome mail: footer (b), one-click unsubscribe, the launch sentence only when ticked', () => {
  for (const locale of ['de', 'en'] as const) {
    const links = locale === 'de' ? unsubscribe : unsubscribeEn;
    const mail = welcomeMail(locale, { unsubscribe: links, launchNews: false });
    assertEquals(mail.headers, {
      'List-Unsubscribe': `<${links.oneClick}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    });
    assert(
      mail.text.includes(
        locale === 'de' ? `Abmelden <${links.page}>` : `Unsubscribe <${links.page}>`,
      ),
    );
    assert(mail.text.includes(locale === 'de' ? 'Art. 21 DSGVO' : 'Art. 21 GDPR'));
    assertNoImagesOrTracking(mail);
    const news = welcomeMail(locale, { unsubscribe: links, launchNews: true });
    const sentence = locale === 'de'
      ? 'Sonst schreiben wir dir nur noch'
      : "Otherwise we'll only email you once more";
    assert(!mail.text.includes(sentence) && news.text.includes(sentence), locale);
  }
});

Deno.test('the invite mail has an iPhone and an Android line, footer (b) and one-click unsubscribe', () => {
  const ios = inviteMail('de', { platform: 'ios', unsubscribe });
  const android = inviteMail('en', { platform: 'android', unsubscribe: unsubscribeEn });
  assert(ios.text.includes('TestFlight') && !ios.text.includes('play.google.com'));
  assert(android.text.includes('https://play.google.com/apps/testing/com.hummlist.app'));
  assert(!android.text.includes('TestFlight'));
  assertEquals(ios.headers['List-Unsubscribe'], `<${unsubscribe.oneClick}>`);
  assertEquals(android.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert(ios.text.includes('Abmelden') && android.text.includes('Unsubscribe'));
  assertNoImagesOrTracking(ios);
  assertNoImagesOrTracking(android);
});

Deno.test('the HTML escapes what it interpolates', () => {
  const mail = confirmationMail('de', {
    confirmUrl: 'https://hummlist.com/de/warteliste/bestaetigen#t="><script>',
    unsubscribe,
  });
  assert(!mail.html.includes('<script>'));
  assert(mail.html.includes('#t=&quot;&gt;&lt;script&gt;'));
});

Deno.test('refusal: test addresses only unless *, and no draft text without the override', () => {
  const approved = welcomeMail('de', { unsubscribe, launchNews: false });
  const draft = { ...approved, text: `⟦LAUNCH COPY⟧\n${approved.text}` };
  assertEquals(mailAllowFrom(undefined), 'test');
  assertEquals(mailAllowFrom(''), 'test');
  assertEquals(mailAllowFrom('yes'), 'test');
  assertEquals(mailAllowFrom('*'), 'all');
  for (const ok of ['hello+x@hummlist.com', 'HELLO+waitlisttest@HUMMLIST.COM']) {
    assert(recipientAllowed(ok, 'test'), ok);
  }
  for (
    const no of [
      'hello@hummlist.com',
      'peter@example.com',
      'hello+x@hummlist.com.evil.de',
      'xhello+x@hummlist.com',
      'hello+@hummlist.com',
    ]
  ) {
    assert(!recipientAllowed(no, 'test'), no);
  }
  assert(recipientAllowed('peter@example.com', 'all'));
  const test = { allow: 'test' as const, allowPlaceholders: false };
  assertEquals(refusal('peter@example.com', approved, test), 'recipient');
  assertEquals(refusal('hello+x@hummlist.com', draft, test), 'placeholder');
  assertEquals(refusal('hello+x@hummlist.com', draft, { ...test, allowPlaceholders: true }), null);
  assertEquals(refusal('hello+x@hummlist.com', approved, test), null);
  assertEquals(
    refusal('peter@example.com', approved, { allow: 'all', allowPlaceholders: false }),
    null,
  );
});

Deno.test('Resend: one single send with an idempotency key, reply-to and the mail headers, no tags', async () => {
  const requests: Request[] = [];
  const mailer = resendMailer('re_test_key', 'https://resend.test/', (input, init) => {
    requests.push(new Request(input, init));
    return Promise.resolve(new Response('{"id":"x"}', { status: 200 }));
  });
  const mail = welcomeMail('de', { unsubscribe, launchNews: false });
  await mailer.send('hello+resend@hummlist.com', mail, `welcome/${ID}`);
  assertEquals(requests.length, 1);
  const [req] = requests;
  assertExists(req, 'the request');
  assertEquals([req.method, req.url], ['POST', 'https://resend.test/emails']);
  assertEquals(req.headers.get('authorization'), 'Bearer re_test_key');
  assertEquals(req.headers.get('idempotency-key'), `welcome/${ID}`);
  assertEquals(await req.json(), {
    from: '"Peter von Snacklist" <hello@snacklist.app>',
    to: ['hello+resend@hummlist.com'],
    reply_to: 'hello@snacklist.app',
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    headers: mail.headers,
  });

  const confirmation = confirmationMail('de', {
    confirmUrl: 'https://hummlist.com/x',
    unsubscribe,
  });
  await mailer.send('hello+resend@hummlist.com', confirmation, 'confirm/x');
  const second = requests[1];
  assertExists(second, 'the second request');
  assertEquals(Object.keys(await second.json()).sort(), [
    'from',
    'html',
    'reply_to',
    'subject',
    'text',
    'to',
  ]);
});

Deno.test('Resend: a refusal names the status, never the answer', async () => {
  const mailer = resendMailer(
    'k',
    undefined,
    () =>
      Promise.resolve(
        new Response('{"message":"hello+x@hummlist.com is invalid"}', { status: 422 }),
      ),
  );
  const e = await assertRejects(
    () =>
      mailer.send(
        'hello+x@hummlist.com',
        welcomeMail('en', { unsubscribe: unsubscribeEn, launchNews: false }),
        'k',
      ),
    MailError,
  );
  assertEquals(e.message, 'resend answered 422');
});
