// The waitlist's parts of the site (job 82, docs/WAITLIST.md): the sign-up form on the landing
// pages and the pages behind the links in the mails, where a button confirms an address (the
// person's consent, with its own text and the launch-news box) or deletes a sign-up. public/waitlist.js drives them: every element with
// `data-when` shows only in the states it lists, and the page's `data-state` names the current one.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CopyError } from './landing.mjs';

export const WAITLIST_ANCHOR = { de: 'warteliste', en: 'waitlist' };

export const ACTION_PAGES = {
  confirm: { de: '/de/warteliste/bestaetigen', en: '/en/waitlist/confirm' },
  unsubscribe: { de: '/de/warteliste/abmelden', en: '/en/waitlist/unsubscribe' },
};

// Messages public/waitlist.js copies into a field's error or the status line, by key.
const MESSAGES = {
  'email-missing': 'waitlist.error.email-missing',
  'email-invalid': 'waitlist.error.email-invalid',
  'platform-missing': 'waitlist.error.platform-missing',
  'invalid_request': 'waitlist.error.invalid-request',
  unavailable: 'waitlist.error.unavailable',
  network: 'waitlist.error.network',
};

const messages = ({ el }, keys) =>
  `<div class="wl-messages" hidden>\n${keys.map((key) => el('p', MESSAGES[key], `data-message="${key}"`)).join('\n')}\n</div>`;

const PRIVACY = { de: '/datenschutz', en: '/en/privacy' };

// Legal's newest text per locale, one paragraph of inline Markdown, by file name prefix:
// `waitlist` is the form's text under the button (content/legal/consent/waitlist-<locale>-v<n>.md),
// `waitlist-confirm` the consent on the confirmation page. The file name is the version sent.
export function readConsent(contentDir, prefix = 'waitlist') {
  const dir = join(contentDir, 'legal/consent');
  const files = existsSync(dir) ? readdirSync(dir) : [];
  return Object.fromEntries(
    Object.keys(WAITLIST_ANCHOR).map((locale) => {
      const pattern = new RegExp(`^${prefix}-${locale}-v(\\d+)\\.md$`);
      const newest = files.filter((f) => pattern.test(f)).sort((a, b) => Number(pattern.exec(b)[1]) - Number(pattern.exec(a)[1]))[0];
      if (!newest) throw new CopyError(`content/legal/consent/${prefix}-${locale}-v1.md is missing: the waitlist pages show its consent text`);
      const markdown = readFileSync(join(dir, newest), 'utf8').trim();
      if (markdown === '' || /\n\s*\n/.test(markdown)) throw new CopyError(`content/legal/consent/${newest} must be one paragraph`);
      if (!markdown.includes(`](${PRIVACY[locale]})`)) throw new CopyError(`content/legal/consent/${newest} must link the privacy policy, ${PRIVACY[locale]}`);
      return [locale, { version: newest.slice(0, -3), markdown }];
    }),
  );
}

export function signupForm({ reader, consent, anchor, ctaId }) {
  const { text, md, el, inline } = reader;
  return `<section class="wl-card" id="${anchor}" aria-labelledby="wl-title" data-waitlist="signup" data-state="idle">
<form class="wl-form" method="post" action="/api/waitlist" novalidate data-when="idle sending">
${el('h2', 'waitlist.form.title', 'class="title" id="wl-title"')}
${el('p', 'waitlist.form.intro', 'class="wl-intro"')}
<div class="wl-field">
${el('label', 'waitlist.form.email', 'for="wl-email"')}
<input class="wl-input" id="wl-email" name="email" type="email" required autocomplete="email" inputmode="email" autocapitalize="off" spellcheck="false" maxlength="254" placeholder="${text('waitlist.form.email-placeholder')}" aria-describedby="wl-email-hint">
${el('p', 'waitlist.form.email-hint', 'class="wl-hint" id="wl-email-hint"')}
<p class="wl-error" id="wl-email-error" hidden></p>
</div>
<fieldset class="wl-field wl-platform">
${el('legend', 'waitlist.form.platform')}
<div class="wl-options">
<label class="wl-option"><input type="radio" name="platform" value="ios" required><span class="wl-mark"></span><span data-copy-id="waitlist.form.ios">${md('waitlist.form.ios')}</span></label>
<label class="wl-option"><input type="radio" name="platform" value="android" required><span class="wl-mark"></span><span data-copy-id="waitlist.form.android">${md('waitlist.form.android')}</span></label>
</div>
<p class="wl-error" id="wl-platform-error" hidden></p>
</fieldset>
<div class="wl-hp" aria-hidden="true">${el('label', 'waitlist.form.honeypot', 'for="wl-website"')}<input id="wl-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
<p class="wl-status" role="alert"></p>
<button class="hex wl-submit" type="submit"><span class="face"><span data-copy-id="${ctaId}" data-when="idle">${md(ctaId)}</span><span data-copy-id="waitlist.form.sending" data-when="sending" hidden>${md('waitlist.form.sending')}</span></span></button>
<p class="wl-consent" data-legal="${consent.version}">${inline(consent.markdown)}</p>
${messages(reader, Object.keys(MESSAGES))}
</form>
<div class="wl-done" data-when="done" hidden tabindex="-1">
<span class="tick hxp" aria-hidden="true">${CHECK}</span>
${el('h2', 'waitlist.thanks.title', 'class="title"')}
${el('p', 'waitlist.thanks.body')}
${el('p', 'waitlist.thanks.small', 'class="wl-small"')}
</div>
</section>`;
}

const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9.55 18 3.85 12.3l1.43-1.43 4.27 4.28 9.17-9.18 1.43 1.43Z"/></svg>';

// A page behind a mail link: the values sit in the fragment, and nothing happens until the
// button is pressed (mail scanners open links). States: ready, sending, failed (the button
// again, with a message), then done or invalid.
const back = (locale, { md }) => `<p><a class="link-strong" href="/${locale}" data-copy-id="waitlist.back">${md('waitlist.back')}</a></p>`;
const ACTIONS = {
  confirm: {
    done: 'confirmed',
    button: 'hex',
    afterDone: (locale, reader) => `${reader.el('p', 'waitlist.confirm.done-line')}\n${back(locale, reader)}`,
    afterInvalid: (locale, { md }, cta) => `<p><a class="hex" href="/${locale}#${cta.anchor[locale]}"><span class="face" data-copy-id="${cta.id}">${md(cta.id)}</span></a></p>`,
  },
  unsubscribe: { done: 'deleted', button: 'hex hex--tomato', afterDone: back, afterInvalid: back },
};

// The confirmation page carries the consent itself (Legal N-73, N-74): Legal's text
// (`consent`, waitlist-confirm-<locale>-v<n>) and the launch-news box, unticked; the button sends
// both, and only that press confirms.
export function actionPage(action, { locale, reader, consent, cta }) {
  const { el, md, inline } = reader;
  const { done, button, afterDone, afterInvalid } = ACTIONS[action];
  const id = (name) => `waitlist.${action}.${name}`;
  return `<div class="wl-page" data-waitlist="${action}" data-state="ready">
<h1 id="wl-heading" tabindex="-1"><span data-copy-id="${id('title')}" data-when="ready sending failed">${md(id('title'))}</span><span data-copy-id="${id('done-title')}" data-when="${done}" hidden>${md(id('done-title'))}</span><span data-copy-id="${id('invalid-title')}" data-when="invalid" hidden>${md(id('invalid-title'))}</span></h1>
<div class="wl-panel" data-when="ready sending failed">
${el('p', id('body'))}
${action === 'confirm' ? `<p class="wl-consent" data-legal="${consent.version}">${inline(consent.markdown)}</p>
<label class="wl-check"><input type="checkbox" name="launch_news"><span class="wl-mark"></span><span data-copy-id="waitlist.confirm.launch-news">${md('waitlist.confirm.launch-news')}</span></label>
` : ''}<p class="wl-status" role="alert"></p>
<button class="${button} wl-action" type="button"><span class="face"><span data-copy-id="${id('button')}" data-when="ready failed">${md(id('button'))}</span><span data-copy-id="waitlist.form.sending" data-when="sending" hidden>${md('waitlist.form.sending')}</span></span></button>
${action === 'confirm' ? el('p', 'waitlist.confirm.not-you', 'class="wl-small"') : ''}
</div>
<div class="wl-panel" data-when="${done}" hidden>
${el('p', id('done-body'))}
${afterDone(locale, reader)}
</div>
<div class="wl-panel" data-when="invalid" hidden>
${el('p', id('invalid-body'))}
${afterInvalid(locale, reader, cta)}
</div>
${messages(reader, ['unavailable', 'network', 'invalid_request'])}
</div>`;
}
