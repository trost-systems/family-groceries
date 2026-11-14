// The language of one Alexa request: its copy, its sentence splitter and how a heard name is
// stored. de-DE is German (speech.ts, voice/parse.ts); every en-* locale is English.
import type { SpokenLang, Target } from '../_shared/spoken_list.ts';
import type { Added } from '../voice/handler.ts';
import { type ParsedItem, parseSentence } from '../voice/parse.ts';
import { parseEnglish } from '../voice/parse_en.ts';
import {
  confirmation,
  germanCase,
  listing,
  question,
  readLimit,
  speech,
  type Spoken,
} from './speech.ts';
import {
  confirmationEnglish,
  listingEnglish,
  questionEnglish,
  speechEnglish,
} from './speech_en.ts';

export interface Voice {
  speech: Record<keyof typeof speech, string>;
  parse(text: string, limit: number): ParsedItem[];
  /** The item name as stored, from the name the parser read and the whole phrase heard. */
  name(name: string, heard: string): string;
  /** [target]: where the add went; a list other than the default one is named (job 207). */
  confirmation(results: readonly Added[], target?: Target): string;
  /** Q79: the yes/no question about held items and their text to add on a yes, or null. */
  question(
    results: readonly Added[],
    target?: Target,
  ): { question: string; again: string } | null;
  /** The language of list phrases in the heard text (takeListPhrase). */
  lang: SpokenLang;
  listing(items: readonly Spoken[]): string;
}

const german: Voice = {
  speech,
  parse: parseSentence,
  name: germanCase,
  confirmation,
  question,
  listing,
  lang: 'de',
};

const english: Voice = {
  speech: speechEnglish,
  parse: parseEnglish,
  name: (name) => name,
  confirmation: confirmationEnglish,
  question: questionEnglish,
  listing: (items) => listingEnglish(items, readLimit),
  lang: 'en',
};

/** German unless Alexa says the request is in English; a request without a locale is German. */
export const speechFor = (locale: string | undefined): Voice =>
  locale?.startsWith('en') ? english : german;
