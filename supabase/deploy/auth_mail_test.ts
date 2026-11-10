import { assert, assertEquals, assertExists, assertMatch } from '@std/assert';
import { desired, templates } from './auth_mail.ts';

function key(keys: Record<string, string>, name: string): string {
  const value = keys[name];
  assertExists(value, name);
  return value;
}

// The templates pick German from user_metadata.mail_locale, which the app saves (mail_language.dart).
const pick =
  /\{\{-? \$de := false \}\}\{\{ with \.Data \}\}\{\{ \$de = eq \(printf "%v" \.mail_locale\) "de" \}\}\{\{ end/;

Deno.test('every auth mail has a German and an English subject and body', async () => {
  const keys = await desired();
  for (const name of templates) {
    const subject = key(keys, `mailer_subjects_${name}`);
    const body = key(keys, `mailer_templates_${name}_content`);
    assertMatch(subject, pick, name);
    assertMatch(body, pick, name);
    assertMatch(subject, /\{\{ if \$de \}\}.+\{\{ else \}\}.+\{\{ end \}\}$/, name);
    assertMatch(
      body,
      /\{\{ if \$de -?\}\}[\s\S]+\{\{-? else -?\}\}[\s\S]+\{\{-? end \}\}\s*$/,
      name,
    );
    assert(!subject.includes('\n'), `${name}: one-line subject`);
  }
});

Deno.test('the mails name Snacklist and never Hummlist', async () => {
  for (const [key, value] of Object.entries(await desired())) {
    assert(value.includes('Snacklist'), key);
    assert(!/hummlist/i.test(value), key);
  }
});

Deno.test('every link mail carries the confirmation link in both languages', async () => {
  const keys = await desired();
  for (const name of templates.filter((t) => t !== 'reauthentication')) {
    const body = key(keys, `mailer_templates_${name}_content`);
    assertEquals(body.match(/href="\{\{ \.ConfirmationURL \}\}"/g)?.length, 2, name);
  }
  assertEquals(
    key(keys, 'mailer_templates_reauthentication_content').match(/\{\{ \.Token \}\}/g)?.length,
    2,
  );
});
