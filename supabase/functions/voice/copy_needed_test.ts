// The Q79 questions in copy_needed.json (listed in site/COPY_NEEDED.md for Peter) are what Siri
// and Alexa really say.
import { assertEquals } from '@std/assert';
import { question as alexaGerman } from '../alexa/speech.ts';
import { questionEnglish as alexaEnglish } from '../alexa/speech_en.ts';
import type { Added } from './handler.ts';
import { question as siri } from './handler.ts';
import table from './copy_needed.json' with { type: 'json' };

const held = (name: string, brand: string, heard: string): Added => ({
  name,
  quantity: null,
  brand,
  properties: null,
  category: 'Kühlregal',
  alreadyOnList: true,
  similarOnList: [],
  held: { name: heard, quantity: null },
});

const one = (heard: (de: string) => string) => [held('Butter', 'Weihenstephan', heard('Butter'))];
const many = (heard: (de: string) => string) => [
  ...one(heard),
  held('Quark', 'Ehrmann', heard('Quark')),
];
const asSaid = (name: string) => name;
const asHeardInEnglish = (name: string) => name.toLowerCase();

Deno.test('copy_needed.json holds the questions Siri and Alexa ask, in German and English', () => {
  const said = {
    'siri.ask.one': [siri(one(asSaid), 'de'), siri(one(asHeardInEnglish), 'en')],
    'siri.ask.many': [siri(many(asSaid), 'de'), siri(many(asHeardInEnglish), 'en')],
    'alexa.ask.one': [alexaGerman(one(asSaid)), alexaEnglish(one(asHeardInEnglish))],
    'alexa.ask.many': [alexaGerman(many(asSaid)), alexaEnglish(many(asHeardInEnglish))],
  };
  const { _: _note, ...entries } = table;
  assertEquals(Object.keys(entries).sort(), Object.keys(said).sort());
  for (const [id, [de, en]] of Object.entries(said)) {
    const entry = entries[id as keyof typeof entries];
    assertEquals([de?.question, en?.question], [entry.de, entry.en], id);
  }
});
