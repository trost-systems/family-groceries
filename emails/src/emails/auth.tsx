// Every mail Supabase Auth can send, in its current hosted wording (Supabase's English defaults,
// read 2026-11-01), restyled. Keep the Go template variables exactly as they are: Supabase fills
// them when it sends. Build: npm run build (writes supabase/templates/).
import { CodeBox, Heading, Paragraph, PrimaryButton, type Reason } from '../components/index.ts';
import { AuthLayout } from '../layouts.tsx';

export type AuthTemplate =
  | 'confirmation' | 'magic_link' | 'recovery' | 'email_change' | 'invite' | 'reauthentication'
  | 'password_changed_notification' | 'email_changed_notification' | 'phone_changed_notification'
  | 'mfa_factor_enrolled_notification' | 'mfa_factor_unenrolled_notification'
  | 'identity_linked_notification' | 'identity_unlinked_notification';

type Block = { p: string } | { button: string } | { code: true };
type AuthMail = { template: AuthTemplate; subject: string; heading: string; body: Block[]; reason: Reason; note?: string };

const URL = '{{ .ConfirmationURL }}';
const contact = { p: "If you didn't make this change, contact support immediately." };
const security: Reason = { draft: "You're getting this e-mail because a security setting of your Hummlist account changed." };

export const AUTH_MAILS: AuthMail[] = [
  {
    template: 'confirmation', subject: 'Confirm your email address', heading: 'Confirm your email address',
    body: [{ p: 'Follow the link below to confirm this email address and finish signing up.' }, { button: 'Confirm email address' }],
    reason: { draft: "You're getting this e-mail because someone signed up for Hummlist with this address. If that wasn't you, just ignore it." },
  },
  {
    template: 'magic_link', subject: 'Your sign-in link', heading: 'Your sign-in link',
    body: [{ p: 'Follow the link below to sign in. This link expires shortly and can only be used once.' }, { button: 'Sign in' }],
    reason: { confirmed: "You're getting this e-mail because a Hummlist sign-in link was requested for this address. If that wasn't you, just ignore it." },
  },
  {
    template: 'recovery', subject: 'Reset your password', heading: 'Reset your password',
    body: [
      { p: 'We received a request to reset your password. Follow the link below to choose a new one.' },
      { button: 'Reset password' },
      { p: "If you didn't request this, you can safely ignore this email." },
    ],
    reason: { draft: "You're getting this e-mail because a password reset was requested for the Hummlist account with this address." },
  },
  {
    template: 'email_change', subject: 'Confirm your new email address', heading: 'Confirm your new email address',
    body: [
      { p: 'Follow the link below to confirm {{ .NewEmail }} as your new email address.' },
      { button: 'Confirm new email address' },
      { p: "If you didn't request this change, you can safely ignore this email." },
    ],
    reason: { draft: "You're getting this e-mail because a change of your Hummlist account's e-mail address was requested." },
  },
  {
    template: 'invite', subject: "You've been invited", heading: "You've been invited",
    body: [{ p: "You've been invited to create an account. Follow the link below to accept." }, { button: 'Accept invitation' }],
    reason: { draft: "You're getting this e-mail because you were invited to create a Hummlist account." },
    note: 'Unused: the app never calls inviteUserByEmail. Must not be used for household invites (Legal N-18).',
  },
  {
    template: 'reauthentication', subject: '{{ .Token }} is your verification code', heading: 'Your verification code',
    body: [{ p: 'Use the code below to verify your identity. It expires shortly.' }, { code: true }],
    reason: { draft: "You're getting this e-mail because a verification code was requested for your Hummlist account." },
  },
  {
    template: 'password_changed_notification', subject: 'Your password was changed', heading: 'Your password was changed',
    body: [{ p: 'The password for your account was recently changed.' }, { p: "If you didn't make this change, reset your password and contact support immediately." }],
    reason: security,
  },
  {
    template: 'email_changed_notification', subject: 'Your email address was changed', heading: 'Your email address was changed',
    body: [{ p: 'The email address for your account was changed from {{ .OldEmail }} to {{ .Email }}.' }, contact],
    reason: security,
  },
  {
    template: 'phone_changed_notification', subject: 'Your phone number was changed', heading: 'Your phone number was changed',
    body: [{ p: 'The phone number for your account was changed from {{ .OldPhone }} to {{ .Phone }}.' }, contact],
    reason: security,
  },
  {
    template: 'mfa_factor_enrolled_notification', subject: 'A new verification method was added to your account', heading: 'A new verification method was added',
    body: [{ p: 'Sign-in verification method {{ .FactorType }} was added to your account.' }, contact],
    reason: security,
  },
  {
    template: 'mfa_factor_unenrolled_notification', subject: 'A verification method was removed from your account', heading: 'A verification method was removed',
    body: [{ p: 'Sign-in verification method {{ .FactorType }} was removed from your account.' }, contact],
    reason: security,
  },
  {
    template: 'identity_linked_notification', subject: 'A new sign-in method was linked to your account', heading: 'A new sign-in method was linked',
    body: [{ p: 'Your {{ .Provider }} account was linked as a new sign-in method for {{ .Email }}.' }, contact],
    reason: security,
  },
  {
    template: 'identity_unlinked_notification', subject: 'A sign-in method was removed from your account', heading: 'A sign-in method was removed',
    body: [{ p: 'Your {{ .Provider }} account was removed as a sign-in method for {{ .Email }}.' }, contact],
    reason: security,
  },
];

export function AuthEmail({ mail }: { mail: AuthMail }) {
  return (
    <AuthLayout lang="en" title={mail.heading} reason={mail.reason}>
      <Heading>{mail.heading}</Heading>
      {mail.body.map((block, i) =>
        'p' in block ? <Paragraph key={i}>{block.p}</Paragraph>
          : 'button' in block ? <PrimaryButton key={i} href={URL}>{block.button}</PrimaryButton>
            : <CodeBox key={i}>{'{{ .Token }}'}</CodeBox>,
      )}
    </AuthLayout>
  );
}
