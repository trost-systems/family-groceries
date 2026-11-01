// Every Hummlist mail, once. The build, the previews and the tests all read this list.
import type { ReactElement } from 'react';
import { DEMO_UNSUBSCRIBE_URL } from './components/index.ts';
import { AUTH_MAILS, AuthEmail, type AuthTemplate } from './emails/auth.tsx';
import { Catalog } from './emails/catalog.tsx';
import { AccountDeletedDe, PartnerJoinedDe } from './emails/notices.tsx';
import { NudgeDe, NudgeEn, WelcomeAndroidDe, WelcomeAndroidEn } from './emails/onboarding.tsx';
import type { Lang } from './lang.ts';

export type Kind = 'auth' | 'notice' | 'onboarding' | 'catalog';

export type Email = {
  id: string;
  kind: Kind;
  lang: Lang;
  subject: string;
  /** The mail with demo values (previews) or, for auth, with Supabase's Go template variables. */
  element: ReactElement;
  /** Auth only: written to supabase/templates/<template>.html, .txt and subjects.json. */
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
  '{{ .ConfirmationURL }}': 'https://app.hummlist.com/auth/confirm?token=DEMO',
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
  ...AUTH_MAILS.map((mail): Email => ({
    id: mail.template, kind: 'auth', lang: 'en', subject: mail.subject, element: <AuthEmail mail={mail} />,
    template: mail.template, demo: AUTH_DEMO, note: mail.note,
  })),
  { id: 'welcome-android-de', kind: 'onboarding', lang: 'de', subject: "Willkommen bei Hummlist: so geht's los", element: <WelcomeAndroidDe {...ANNA} joinUrl={PLAY} /> },
  { id: 'welcome-android-en', kind: 'onboarding', lang: 'en', subject: "Welcome to Hummlist: here's how to get started", element: <WelcomeAndroidEn {...ANNA} joinUrl={PLAY} /> },
  { id: 'nudge-de', kind: 'onboarding', lang: 'de', subject: 'Ein Tipp für deinen nächsten Einkauf', element: <NudgeDe {...ANNA} /> },
  { id: 'nudge-en', kind: 'onboarding', lang: 'en', subject: 'One tip for your next grocery run', element: <NudgeEn {...ANNA} /> },
  {
    id: 'partner-joined-de', kind: 'notice', lang: 'de', subject: 'Neues Mitglied in deinem Haushalt',
    element: <PartnerJoinedDe member="Anna" household="Unser Haushalt" />, note: 'Draft subject and reason line; no sender exists.',
  },
  {
    id: 'account-deleted-de', kind: 'notice', lang: 'de', subject: 'Dein Hummlist-Konto ist gelöscht',
    element: <AccountDeletedDe />, note: 'Layout only: Launch writes the body; no sender exists.',
  },
  { id: 'catalog-de', kind: 'catalog', lang: 'de', subject: 'Hummlist: alle Bausteine', element: <Catalog unsubscribeUrl={DEMO_UNSUBSCRIBE_URL} />, note: 'Component catalog, never sent.' },
];

export const byId = (id: string): Email => {
  const email = EMAILS.find((e) => e.id === id);
  if (!email) throw new Error(`no email "${id}"; known: ${EMAILS.map((e) => e.id).join(', ')}`);
  return email;
};

export const fillDemo = (s: string, demo: Record<string, string> = {}) =>
  Object.entries(demo).reduce((out, [k, v]) => out.replaceAll(k, v), s);
