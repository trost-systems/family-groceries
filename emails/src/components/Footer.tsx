import type { ReactNode } from 'react';
import type { Lang } from '../lang.ts';
import { text, ui } from '../theme.ts';
import { TextLink as A } from './Text.tsx';

// Legal Review 2026-11-01 N-15, pending Peter's approval. Word for word; change only with Legal.
const SENDER: Record<Lang, string> = {
  de: 'Hummlist · Peter Trost · Yalovastr. 5 · 72108 Rottenburg am Neckar · Deutschland · support@hummlist.com',
  en: 'Hummlist · Peter Trost · Yalovastr. 5 · 72108 Rottenburg am Neckar · Germany · support@hummlist.com',
};
const LEGAL_LINKS: Record<Lang, [label: string, url: string][]> = {
  de: [['Impressum', 'https://hummlist.com/impressum'], ['Datenschutz', 'https://hummlist.com/datenschutz']],
  en: [['Imprint', 'https://hummlist.com/en/imprint'], ['Privacy', 'https://hummlist.com/en/privacy']],
};

/**
 * Why this person gets the mail. `confirmed` is Legal's or Launch's final line; `draft` is a
 * line nobody has confirmed yet: it renders, but a production render refuses it.
 */
export type Reason = { confirmed: string } | { draft: string };

function FooterFrame({ children }: { children: ReactNode }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} border={0}>
      <tbody>
        <tr>
          <td className="hl-gutter" style={{ padding: `${ui.space[5]}px ${ui.space[5]}px 0 ${ui.space[5]}px` }}>
            <div data-hl-text="footer">{children}</div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function Small({ children }: { children: ReactNode }) {
  return <p className="hl-muted" style={text.muted}>{children}</p>;
}

function ReasonLine({ reason }: { reason: Reason }) {
  return 'draft' in reason
    ? <p className="hl-muted" data-hl-draft="reason line, Launch to confirm" style={text.muted}>{reason.draft}</p>
    : <Small>{reason.confirmed}</Small>;
}

function SenderAndLinks({ lang }: { lang: Lang }) {
  const [[l1, u1], [l2, u2]] = LEGAL_LINKS[lang];
  return (
    <>
      <Small>{SENDER[lang]}</Small>
      <Small>{l1}: <A href={u1}>{u1}</A> · {l2}: <A href={u2}>{u2}</A></Small>
    </>
  );
}

/**
 * Transactional mails (sign-in, confirmation, password, e-mail change, account deletion, service
 * notices): one reason line, sender, imprint and privacy. No unsubscribe link and nothing
 * promotional (no feedback ask, invite, Premium, "follow us"): Legal N-15 a.
 */
export function TransactionalFooter({ lang, reason }: { lang: Lang; reason: Reason }) {
  return (
    <FooterFrame>
      <ReasonLine reason={reason} />
      <SenderAndLinks lang={lang} />
    </FooterFrame>
  );
}

export type UnsubscribeUrl = `https://app.hummlist.com/email/abmelden?t=${string}`;
export const DEMO_UNSUBSCRIBE_URL: UnsubscribeUrl = 'https://app.hummlist.com/email/abmelden?t=DEMO';

/**
 * Onboarding and tips mails (E2 to E5): why, a one-click unsubscribe link, unsubscribe by reply,
 * the objection notice, sender, imprint and privacy (Legal N-15 b). `note` is an optional line
 * above it, e.g. where feedback goes. Send these with `onboardingHeaders` (List-Unsubscribe).
 */
export function OnboardingFooter({ lang, unsubscribeUrl, note }: { lang: Lang; unsubscribeUrl: UnsubscribeUrl; note?: ReactNode }) {
  if (!/^https:\/\/app\.hummlist\.com\/email\/abmelden\?t=[A-Za-z0-9_-]+$/.test(unsubscribeUrl ?? '')) {
    throw new Error(`OnboardingFooter needs the reader's one-click unsubscribe URL, got "${unsubscribeUrl}"`);
  }
  const mail = <A href="mailto:hello@hummlist.com">hello@hummlist.com</A>;
  const unsubscribe = lang === 'de' ? (
    <Small>
      Du bekommst diese E-Mail, weil du bei der Anmeldung Tipps zu Hummlist per E-Mail bestellt hast. Keine Tipps mehr?{' '}
      <A href={unsubscribeUrl}>Abbestellen</A> – ein Klick genügt, ohne Anmeldung. Oder antworte mit „Abbestellen“ an {mail}.
      Dafür entstehen dir nur die Übermittlungskosten nach den Basistarifen. Du kannst deine Einwilligung jederzeit widerrufen
      und der Nutzung deiner Daten für diese E-Mails jederzeit widersprechen (Art. 21 DSGVO).
    </Small>
  ) : (
    <Small>
      You're getting this e-mail because you signed up for Hummlist tips by e-mail. No more tips?{' '}
      <A href={unsubscribeUrl}>Unsubscribe</A>: one click, no sign-in. Or reply "Unsubscribe" to {mail}.
      This costs you nothing beyond your normal connection charges. You can withdraw your consent and object to the use
      of your data for these e-mails at any time (Art. 21 GDPR).
    </Small>
  );
  return (
    <FooterFrame>
      {note ? <Small>{note}</Small> : null}
      <div data-hl-unsubscribe="true">{unsubscribe}</div>
      <SenderAndLinks lang={lang} />
    </FooterFrame>
  );
}

/**
 * The Resend `headers` for an onboarding send (Legal N-16): one-click unsubscribe (RFC 8058) by
 * the reader's opaque token, never their address. Transactional mails get none.
 */
export function onboardingHeaders(token: string): Record<string, string> {
  if (!/^[A-Za-z0-9_-]{8,}$/.test(token)) {
    throw new Error('onboardingHeaders needs the opaque unsubscribe token (letters, digits, - and _), not an address');
  }
  return {
    'List-Unsubscribe': `<https://app.hummlist.com/email/abmelden?t=${token}>, <mailto:hello@hummlist.com?subject=unsubscribe>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  };
}
