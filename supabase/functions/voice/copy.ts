// Everything the voice function says, in German (the Shortcut's language, unchanged since job 4)
// and English (native Siri, job 51). The request's `lang` picks one.
import { type ParsedItem, spoken } from './parse.ts';
import { spokenEnglish } from './parse_en.ts';

export type Lang = 'de' | 'en';

export const failureCodes = [
  'method',
  'unauthorized',
  'no_household',
  'no_text',
  'too_long',
  'nothing_understood',
  'server',
  // Job 50's integration lock answers with it; nothing in this function does yet.
  'premium_required',
] as const;

export type FailureCode = typeof failureCodes[number];

export interface Copy {
  failures: Record<FailureCode, string>;
  /** After the confirmation when more than thirty were said. */
  tooMany: string;
  /** "2 Gurken", "2 cucumbers". */
  spoken(item: ParsedItem): string;
  added(said: string[]): string;
  existing(said: string[]): string;
  /** Open items another spelling or synonym of a new one is (job 32b). */
  similar(names: string[]): string;
  parsed(said: string[]): string;
  /** The open items, the first readLimit of them by name. */
  listing(said: string[], total: number): string;
}

/** At most this many open items are read aloud; the rest is a count. */
export const readLimit = 10;

const enumerate = (and: string) => (names: string[]) =>
  names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} ${and} ${names.at(-1)}`;

const exampleDe = 'Sag zum Beispiel: Milch, zwei Gurken und Klopapier.';
const exampleEn = 'Say for example: milk, two cucumbers and toilet paper.';
const und = enumerate('und');
const and = enumerate('and');

export const copy: Record<Lang, Copy> = {
  de: {
    failures: {
      method: 'Bitte schick den Text per POST.',
      unauthorized:
        'Der Zugriffstoken fehlt oder ist ungültig. Erstelle in der Hummlist-App unter Mehr, Zugänge einen neuen.',
      no_household:
        'Du bist noch in keinem Haushalt. Leg in der Hummlist-App einen an oder tritt einem bei.',
      no_text: `Ich habe keinen Text bekommen. ${exampleDe}`,
      too_long: 'Das war zu lang. Sag höchstens dreißig Dinge auf einmal.',
      nothing_understood: `Ich habe nichts verstanden, was auf die Liste soll. ${exampleDe}`,
      server: 'Das hat leider nicht geklappt. Versuch es gleich noch einmal.',
      premium_required:
        'Sprachbefehle sind Teil von Hummlist Premium. Du kannst es in der App freischalten. Ich habe nichts hinzugefügt.',
    },
    tooMany: 'Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal.',
    spoken,
    added: (said) => `Hinzugefügt: ${said.join(', ')}.`,
    existing: (said) => `Schon auf der Liste: ${said.join(', ')}.`,
    similar: (names) =>
      `${und(names)} ${names.length === 1 ? 'steht' : 'stehen'} schon auf der Liste.`,
    parsed: (said) => `Verstanden: ${said.join(', ')}.`,
    listing: (said, total) => {
      if (total === 0) return 'Die Hummlist ist leer.';
      const head = total === 1
        ? 'Auf der Hummlist steht eine Sache'
        : `Auf der Hummlist stehen ${total} Sachen`;
      const rest = total - said.length;
      if (rest === 0) return `${head}: ${und(said)}.`;
      return `${head}: ${said.join(', ')} und ${rest === 1 ? 'eine' : rest} weitere.`;
    },
  },
  en: {
    failures: {
      method: 'Please send the text with POST.',
      unauthorized:
        "I couldn't sign in to Hummlist, so nothing was added. Open Hummlist and sign in again.",
      no_household:
        "You're not in a household yet, so nothing was added. Create one or join one in the Hummlist app.",
      no_text: `I didn't get any text, so nothing was added. ${exampleEn}`,
      too_long: 'That was too long, so nothing was added. Say at most thirty things at once.',
      nothing_understood: `I didn't understand anything to put on the list. ${exampleEn}`,
      server: "Sorry, that didn't work, nothing was added. Please try again in a moment.",
      premium_required:
        "Voice commands are part of Hummlist Premium. You can unlock it in the app under More, Hummlist Premium. I didn't add anything.",
    },
    tooMany: "More than thirty at once doesn't work; please say the rest again.",
    spoken: spokenEnglish,
    added: (said) => `Added ${and(said)} to Hummlist.`,
    existing: (said) => `Already on the list: ${and(said)}.`,
    similar: (names) => `${and(names)} ${names.length === 1 ? 'is' : 'are'} already on the list.`,
    parsed: (said) => `Got it: ${and(said)}.`,
    listing: (said, total) => {
      if (total === 0) return 'Your Hummlist is empty.';
      const head = total === 1
        ? 'There is one thing on your Hummlist'
        : `There are ${total} things on your Hummlist`;
      const rest = total - said.length;
      if (rest === 0) return `${head}: ${and(said)}.`;
      return `${head}: ${said.join(', ')} and ${rest} more.`;
    },
  },
};
