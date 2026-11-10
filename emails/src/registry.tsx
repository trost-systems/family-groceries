// Every Snacklist mail, once. The build, the previews and the tests all read this list.
import type { ReactElement } from 'react';
import { DEMO_UNSUBSCRIBE_URL } from './components/index.ts';
import { AUTH_MAILS, AuthEmail, type AuthTemplate } from './emails/auth.tsx';
import { Catalog } from './emails/catalog.tsx';
import { ACCOUNT_DELETED_SUBJECT, AccountDeleted, PARTNER_JOINED_SUBJECT, PartnerJoined } from './emails/notices.tsx';
import { NudgeDe, NudgeEn, WelcomeAndroidDe, WelcomeAndroidEn } from './emails/onboarding.tsx';
import { LANGS, type Lang } from './lang.ts';

export type Kind = 'auth' | 'notice' | 'onboarding' | 'catalog';

export type Email = {
  id: string;
  kind: Kind;
  lang: Lang;
  subject: string;
  /** The mail with demo values (previews) or, for auth, with Supabase's Go template variables. */
  element: ReactElement;
  /** Auth only: its language's branch of supabase/templates/<template>.html. */
  template?: AuthTemplate;
  /** Go template variables -> demo values, for previews of auth templates. */
  demo?: Record<string, string>;
  /** Why it is not sendable yet, if it is not. */
  note?: string;
};

// Demo values only (fixture people, example.com addresses); the Play link is the tester track's.
const ANNA = { name: 'Anna', googleEmail: 'anna.beispiel@example.com', unsubscribeUrl: DEMO_UNSUBSCRIBE_URL };
const PLAY = 'https://play.google.com/apps/internaltest/4700554042680195988';

export const AUTH_DEMO: Record<string, string> = {
  '{{ .ConfirmationURL }}': 'https://jdwqrallbpdbshrdhenk.supabase.co/auth/v1/verify?token=pkce_DEMO&type=magiclink&redirect_to=https://app.snacklist.app',
  '{{ .Token }}': '48213907',
  '{{ .Email }}': 'anna.beispiel@example.com',
  '{{ .NewEmail }}': 'anna.neu@example.com',
  '{{ .OldEmail }}': 'anna.alt@example.com',
  '{{ .Phone }}': '+49 151 00000002',
  '{{ .OldPhone }}': '+49 151 00000001',
  '{{ .Provider }}': 'Google',
  '{{ .FactorType }}': 'totp',
};

export const EMAILS: Email[] = [
  ...AUTH_MAILS.flatMap((mail) => LANGS.map((lang): Email => ({
    id: `${mail.template}-${lang}`, kind: 'auth', lang, subject: mail.copy[lang].subject, element: <AuthEmail mail={mail} lang={lang} />,
    template: mail.template, demo: AUTH_DEMO, ...(mail.note === undefined ? {} : { note: mail.note }),
  }))),
  { id: 'welcome-android-de', kind: 'onboarding', lang: 'de', subject: "Willkommen bei Snacklist: so geht's los", element: <WelcomeAndroidDe {...ANNA} joinUrl={PLAY} /> },
  { id: 'welcome-android-en', kind: 'onboarding', lang: 'en', subject: "Welcome to Snacklist: here's how to get started", element: <WelcomeAndroidEn {...ANNA} joinUrl={PLAY} /> },
  { id: 'nudge-de', kind: 'onboarding', lang: 'de', subject: 'Ein Tipp für deinen nächsten Einkauf', element: <NudgeDe {...ANNA} /> },
  { id: 'nudge-en', kind: 'onboarding', lang: 'en', subject: 'One tip for your next grocery run', element: <NudgeEn {...ANNA} /> },
  ...LANGS.map((lang): Email => ({
    id: `partner-joined-${lang}`, kind: 'notice', lang, subject: PARTNER_JOINED_SUBJECT[lang],
    element: <PartnerJoined lang={lang} member="Anna" household={lang === 'de' ? 'Unser Haushalt' : 'Our household'} />,
    note: 'Draft subject and reason line; no sender exists.',
  })),
  ...LANGS.map((lang): Email => ({
    id: `account-deleted-${lang}`, kind: 'notice', lang, subject: ACCOUNT_DELETED_SUBJECT[lang],
    element: <AccountDeleted lang={lang} />, note: 'Layout only: Launch writes the body; no sender exists.',
  })),
  { id: 'catalog-de', kind: 'catalog', lang: 'de', subject: 'Snacklist: alle Bausteine', element: <Catalog unsubscribeUrl={DEMO_UNSUBSCRIBE_URL} />, note: 'Component catalog, never sent.' },
];

export const byId = (id: string): Email => {
  const email = EMAILS.find((e) => e.id === id);
  if (!email) throw new Error(`no email "${id}"; known: ${EMAILS.map((e) => e.id).join(', ')}`);
  return email;
};

export const fillDemo = (s: string, demo: Record<string, string> = {}): string =>
  Object.entries(demo).reduce((out, [k, v]) => out.replaceAll(k, v), s);
