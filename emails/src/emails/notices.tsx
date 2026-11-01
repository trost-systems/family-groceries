// Service notices outside Supabase Auth. Neither is wired to send: there is no sender yet.
import { Draft, Heading, Paragraph, PrimaryButton } from '../components/index.ts';
import { AuthLayout } from '../layouts.tsx';

/** "Partner joined" (Legal N-14): the one sentence and one button, nothing promotional. */
export function PartnerJoinedDe({ member, household }: { member: string; household: string }) {
  return (
    <AuthLayout lang="de" title="Neues Mitglied in deinem Haushalt"
      reason={{ draft: 'Du bekommst diese E-Mail, weil jemand deinem Hummlist-Haushalt beigetreten ist.' }}>
      <Paragraph>{member} ist deinem Haushalt „{household}“ beigetreten.</Paragraph>
      <PrimaryButton href="https://app.hummlist.com">Liste öffnen</PrimaryButton>
    </AuthLayout>
  );
}

/** Account deletion confirmation: the layout and Legal's reason line; Launch writes the body. */
export function AccountDeletedDe() {
  return (
    <AuthLayout lang="de" title="Dein Hummlist-Konto ist gelöscht"
      reason={{ confirmed: 'Du bekommst diese E-Mail, weil dein Hummlist-Konto gelöscht wurde.' }}>
      <Heading>Dein Hummlist-Konto ist gelöscht</Heading>
      <Draft>Dein Konto und deine Daten sind gelöscht. Launch schreibt diesen Text.</Draft>
    </AuthLayout>
  );
}
