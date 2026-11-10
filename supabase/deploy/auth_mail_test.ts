import { assert, assertEquals, assertExists, assertMatch } from '@std/assert';
import { desired, drafts, templates } from './auth_mail.ts';

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

// The bodies are built from emails/ (a button, the raw link under it and Outlook's VML twin), so
// the link shows up more than once in a language: check each branch has it.
function branches(body: string): [string, string] {
  const [de, en, ...rest] = body.split('{{- else -}}');
  assert(de !== undefined && en !== undefined && rest.length === 0, 'one {{- else -}}');
  return [de, en];
}

Deno.test('every link mail carries the confirmation link in both languages', async () => {
  const keys = await desired();
  for (const name of templates.filter((t) => t !== 'reauthentication')) {
    for (const branch of branches(key(keys, `mailer_templates_${name}_content`))) {
      assertMatch(branch, /<a href="\{\{ \.ConfirmationURL \}\}"/, name);
    }
  }
  for (const branch of branches(key(keys, 'mailer_templates_reauthentication_content'))) {
    assertMatch(branch, /\{\{ \.Token \}\}/);
  }
});

Deno.test('a template with a draft line is not applied', () => {
  assertEquals(
    drafts({ a: '<p data-hl-draft="reason line, Launch to confirm">x</p>', b: '<p>approved</p>' }),
    ['a'],
  );
});
