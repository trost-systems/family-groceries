// What Alexa says, in German. The app is always "Hummlist" in full.
import type { Added } from '../voice/handler.ts';

/** An open item as read back; the voice function's Added and the MCP list's Item both fit. */
export interface Spoken {
  name: string;
  quantity: string | null;
  brand: string | null;
  properties: string | null;
}

/** Units the parser writes short, as Alexa should say them ("2 l" is "2 Liter"). */
const unitWords: Record<string, string> = { l: 'Liter', ml: 'Milliliter', kg: 'Kilo', g: 'Gramm' };

const sayQuantity = (quantity: string) =>
  quantity.replace(/(?<=^|\s|\d)(l|ml|kg|g)(?=\s|$)/g, (unit) => ` ${unitWords[unit]}`)
    .replace(/\s+/g, ' ').trim();

/** "2 Liter Milch", "Windeln Pampers Größe 3 Big Pack". */
export const said = (item: Spoken) =>
  [
    item.quantity ? sayQuantity(item.quantity) : null,
    item.name,
    item.brand,
    item.properties?.replaceAll(', ', ' '),
  ].filter(Boolean).join(' ');

/** "Milch", "Milch und Eier", "Milch, Eier und Brot". */
export function enumerate(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} und ${parts.at(-1)}`;
}

export const askForItems = 'Was soll auf die Liste?';
export const example = 'Sag zum Beispiel: Milch und Eier.';

export const speech = {
  launch: askForItems,
  launchReprompt: `${askForItems} ${example}`,
  help:
    'Mit Hummlist setzt du Sachen auf eure Einkaufsliste. Sag zum Beispiel: füg Milch und Eier hinzu. ' +
    'Oder frag: was steht auf der Liste? Was möchtest du?',
  helpReprompt: `${askForItems} Oder frag: was steht auf der Liste?`,
  notUnderstoodOnce: `Das habe ich nicht verstanden. ${askForItems}`,
  notUnderstoodReprompt: `${askForItems} ${example}`,
  notUnderstood: 'Das habe ich leider nicht verstanden. Ich habe nichts auf die Hummlist gesetzt.',
  goodbye: 'Bis bald.',
  linkAccount:
    'Bitte verknüpfe zuerst dein Hummlist-Konto in der Alexa-App. Ich habe dir dort eine Karte dazu geschickt.',
  noHousehold:
    'Du bist noch in keinem Haushalt. Leg in der Hummlist-App einen an oder tritt einem bei, dann klappt es auch mit Alexa.',
  tooLong: 'Das war zu lang. Sag höchstens dreißig Sachen auf einmal. Ich habe nichts hinzugefügt.',
  tooMany: 'Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal.',
  rateLimited:
    'Das waren gerade sehr viele Sachen auf einmal. Warte bitte eine Minute, dann geht es weiter. Ich habe nichts hinzugefügt.',
  failed:
    'Entschuldigung, das hat gerade nicht geklappt. Ich habe nichts hinzugefügt. Versuch es bitte gleich noch einmal.',
  listFailed:
    'Entschuldigung, ich komme gerade nicht an die Hummlist. Versuch es bitte gleich noch einmal.',
  emptyList: 'Die Hummlist ist leer.',
  cardTitle: 'Hummlist',
} as const;

/**
 * The read-back after an add: "Milch und Eier sind auf der Hummlist." One item reads "Ich habe
 * Milch auf die Hummlist gesetzt.", which holds for "Eier" too (a single name can be plural).
 * Items that were open already: "Schon auf der Hummlist: Milch." A new item with another spelling
 * or synonym open (job 32b): "Möhren steht schon auf der Hummlist."
 */
export function confirmation(results: readonly Added[]): string {
  const added = results.filter((r) => !r.alreadyOnList).map(said);
  const existing = results.filter((r) => r.alreadyOnList).map(said);
  const parts: string[] = [];
  if (added.length === 1) parts.push(`Ich habe ${added[0]} auf die Hummlist gesetzt.`);
  if (added.length > 1) parts.push(`${enumerate(added)} sind auf der Hummlist.`);
  if (existing.length) parts.push(`Schon auf der Hummlist: ${enumerate(existing)}.`);
  // Job 32b: a new item whose other spelling or synonym is open was added anyway; say which.
  const similar = [
    ...new Set(results.flatMap((r) => (r.alreadyOnList ? [] : r.similarOnList ?? []))),
  ];
  if (similar.length) {
    parts.push(
      `${enumerate(similar)} ${similar.length === 1 ? 'steht' : 'stehen'} schon auf der Hummlist.`,
    );
  }
  return parts.join(' ');
}

/** At most this many items are read aloud; the rest is a count. */
export const readLimit = 10;

/** "Auf der Hummlist stehen 3 Sachen: Milch, Eier und Brot." */
export function listing(items: readonly Spoken[]): string {
  if (items.length === 0) return speech.emptyList;
  const read = items.slice(0, readLimit).map(said);
  const rest = items.length - read.length;
  const head = items.length === 1
    ? 'Auf der Hummlist steht eine Sache'
    : `Auf der Hummlist stehen ${items.length} Sachen`;
  if (rest === 0) return `${head}: ${enumerate(read)}.`;
  return `${head}: ${read.join(', ')} und ${rest === 1 ? 'eine' : rest} weitere.`;
}

/** Words that stay lowercase inside an item name ("Milch ohne Laktose"). */
const smallWords = new Set([
  'und',
  'oder',
  'mit',
  'ohne',
  'von',
  'vom',
  'für',
  'aus',
  'in',
  'im',
  'zum',
  'zur',
  'zu',
  'auf',
  'der',
  'die',
  'das',
  'den',
  'dem',
  'des',
  'ein',
  'eine',
  'einen',
  'à',
  'a',
  'la',
  'al',
]);

/**
 * Alexa's speech recognition may hand over the utterance in lowercase ("milch und eier"). Typed
 * German capitalizes nouns, so an item name from a phrase without any capital letter gets its
 * words capitalized, small words after the first excepted: "milch ohne laktose" is
 * "Milch ohne Laktose", "äpfel" is "Äpfel". A phrase with capitals is left as heard.
 */
export function germanCase(name: string, heard: string): string {
  if (/\p{Lu}/u.test(heard)) return name;
  return name.split(' ').map((word, i) =>
    i > 0 && smallWords.has(word) ? word : word.charAt(0).toLocaleUpperCase('de-DE') + word.slice(1)
  ).join(' ');
}

/** Alexa reads at most 8000 characters of output speech. */
export const clip = (text: string) => (text.length <= 7_900 ? text : `${text.slice(0, 7_896)} …`);
