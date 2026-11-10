// Every component once, for Launch and the previews. Not a mail anyone gets.
import type { ReactElement } from 'react';
import {
  CodeBox, Greeting, Heading, Paragraph, PhoneScreenshot, PrimaryButton, Signature, Steps, TextLink, TipBox, type UnsubscribeUrl,
} from '../components/index.ts';
import { OnboardingLayout } from '../layouts.tsx';

export const DEMO_SCREEN = 'https://snacklist.app/email/demo-list-de.png' as const;

export function Catalog({ unsubscribeUrl }: { unsubscribeUrl: UnsubscribeUrl }): ReactElement {
  return (
    <OnboardingLayout lang="de" title="Snacklist: alle Bausteine" preview="Alle Bausteine der Snacklist-Mails auf einen Blick." unsubscribeUrl={unsubscribeUrl}>
      <Heading>Alle Bausteine</Heading>
      <Greeting>Hi Anna, das ist die Begrüßung.</Greeting>
      <Paragraph>Ein Absatz mit einem <TextLink href="https://snacklist.app/de">Link im Text</TextLink> und <strong>fettem Anfang</strong>.</Paragraph>
      <Steps steps={[
        { title: 'Erster Schritt', children: <Paragraph>Zwei bis vier Schritte, jeder mit Titel und Text.</Paragraph> },
        { title: 'Zweiter Schritt', children: <Paragraph>Höchstens ein Knopf in der ganzen Mail.</Paragraph> },
      ]} />
      <TipBox title="Ein Tipp">
        <Paragraph>Der Tipp-Kasten hebt eine Sache hervor.</Paragraph>
      </TipBox>
      <PhoneScreenshot src={DEMO_SCREEN} width={240} height={300}
        alt="Die Einkaufsliste von Familie Brandt: Bananen abgehakt, Gurke, Tomaten und Avocados offen." />
      <CodeBox>48213907</CodeBox>
      <PrimaryButton href="https://snacklist.app/de" fallbackLabel="Falls der Knopf nicht geht, öffne diesen Link:">Der eine Knopf</PrimaryButton>
      <Signature />
    </OnboardingLayout>
  );
}
