// The language of one Alexa request: its copy, its sentence splitter and how a heard name is
// stored. de-DE is German (speech.ts, voice/parse.ts); every en-* locale is English.
import type { Added } from '../voice/handler.ts';
import { type ParsedItem, parseSentence } from '../voice/parse.ts';
import { parseEnglish } from '../voice/parse_en.ts';
import { confirmation, germanCase, listing, readLimit, speech, type Spoken } from './speech.ts';
import { confirmationEnglish, listingEnglish, speechEnglish } from './speech_en.ts';

export interface Voice {
  speech: Record<keyof typeof speech, string>;
  parse(text: string, limit: number): ParsedItem[];
  /** The item name as stored, from the name the parser read and the whole phrase heard. */
  name(name: string, heard: string): string;
  confirmation(results: readonly Added[]): string;
  listing(items: readonly Spoken[]): string;
}

const german: Voice = { speech, parse: parseSentence, name: germanCase, confirmation, listing };

const english: Voice = {
  speech: speechEnglish,
  parse: parseEnglish,
  name: (name) => name,
  confirmation: confirmationEnglish,
  listing: (items) => listingEnglish(items, readLimit),
};

/** German unless Alexa says the request is in English; a request without a locale is German. */
export const speechFor = (locale: string | undefined): Voice =>
  locale?.startsWith('en') ? english : german;
