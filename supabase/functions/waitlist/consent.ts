// The waitlist's versioned texts, by page locale. Their wording lives in
// site/content/legal/consent/<version>.md; any change there is a new version.
// The form text under the button (F-1/F-2): it says what a sign-up starts. A sign-up names it.
export const CONSENT_VERSIONS = { de: 'waitlist-de-v3', en: 'waitlist-en-v3' } as const;
// The confirmation page's consent text (C-1/C-2): the button press there is the consent and
// names it (Legal Review 2026-11-04, N-73). One line: site/test/waitlist.test.mjs reads it as text.
// deno-fmt-ignore
export const CONFIRM_VERSIONS = { de: 'waitlist-confirm-de-v2', en: 'waitlist-confirm-en-v2' } as const;
// The texts before them: the same wording under the old name (job 174). A page opened before
// the swap still shows and sends them, so they are accepted too and stored as sent.
export const PREVIOUS_CONSENT_VERSIONS = { de: 'waitlist-de-v2', en: 'waitlist-en-v2' } as const;
// deno-fmt-ignore
export const PREVIOUS_CONFIRM_VERSIONS = { de: 'waitlist-confirm-de-v1', en: 'waitlist-confirm-en-v1' } as const;
