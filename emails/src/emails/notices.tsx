// Service notices outside Supabase Auth. Neither is wired to send: there is no sender yet.
import type { ReactElement } from 'react';
import { Draft, Heading, Paragraph, PrimaryButton } from '../components/index.ts';
import type { Lang } from '../lang.ts';
import { AuthLayout } from '../layouts.tsx';

export const PARTNER_JOINED_SUBJECT: Record<Lang, string> = {
  de: 'Neues Mitglied in deinem Haushalt',
  en: 'New member in your household',
};

/** "Partner joined" (Legal N-14): the one sentence and one button, nothing promotional. */
export function PartnerJoined({ lang, member, household }: { lang: Lang; member: string; household: string }): ReactElement {
  return lang === 'de' ? (
    <AuthLayout lang="de" title={PARTNER_JOINED_SUBJECT.de}
      reason={{ draft: 'Du bekommst diese E-Mail, weil jemand deinem Snacklist-Haushalt beigetreten ist.' }}>
      <Paragraph>{member} ist deinem Haushalt „{household}“ beigetreten.</Paragraph>
      <PrimaryButton href="https://app.snacklist.app">Liste öffnen</PrimaryButton>
    </AuthLayout>
  ) : (
    <AuthLayout lang="en" title={PARTNER_JOINED_SUBJECT.en}
      reason={{ draft: "You're getting this e-mail because someone joined your Snacklist household." }}>
      <Paragraph>{member} joined your household “{household}”.</Paragraph>
      <PrimaryButton href="https://app.snacklist.app">Open list</PrimaryButton>
    </AuthLayout>
  );
}

export const ACCOUNT_DELETED_SUBJECT: Record<Lang, string> = {
  de: 'Dein Snacklist-Konto ist gelöscht',
  en: 'Your Snacklist account is deleted',
};

/** Account deletion confirmation: the layout and Legal's reason line; Launch writes the body. */
export function AccountDeleted({ lang }: { lang: Lang }): ReactElement {
  return lang === 'de' ? (
    <AuthLayout lang="de" title={ACCOUNT_DELETED_SUBJECT.de}
      reason={{ confirmed: 'Du bekommst diese E-Mail, weil dein Snacklist-Konto gelöscht wurde.' }}>
      <Heading>{ACCOUNT_DELETED_SUBJECT.de}</Heading>
      <Draft>Dein Konto und deine Daten sind gelöscht. Launch schreibt diesen Text.</Draft>
    </AuthLayout>
  ) : (
    <AuthLayout lang="en" title={ACCOUNT_DELETED_SUBJECT.en}
      reason={{ confirmed: "You're getting this e-mail because your Snacklist account was deleted." }}>
      <Heading>{ACCOUNT_DELETED_SUBJECT.en}</Heading>
      <Draft>Your account and your data are deleted. Launch writes this text.</Draft>
    </AuthLayout>
  );
}
