// What Alexa says, in German. The app is always "Snacklist" in full.
import { namesList, type Target } from '../_shared/spoken_list.ts';
import { copy } from '../voice/copy.ts';
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
    'Mit Snacklist setzt du Sachen auf eure Einkaufsliste. Sag zum Beispiel: füg Milch und Eier hinzu. ' +
    'Oder frag: was steht auf der Liste? Was möchtest du?',
  helpReprompt: `${askForItems} Oder frag: was steht auf der Liste?`,
  notUnderstoodOnce: `Das habe ich nicht verstanden. ${askForItems}`,
  notUnderstoodReprompt: `${askForItems} ${example}`,
  notUnderstood: 'Das habe ich leider nicht verstanden. Ich habe nichts auf die Snacklist gesetzt.',
  goodbye: 'Bis bald.',
  linkAccount:
    'Bitte verknüpfe zuerst dein Snacklist-Konto in der Alexa-App. Ich habe dir dort eine Karte dazu geschickt.',
  noHousehold:
    'Du bist noch in keinem Haushalt. Leg in der Snacklist-App einen an oder tritt einem bei, dann klappt es auch mit Alexa.',
  tooLong: 'Das war zu lang. Sag höchstens dreißig Sachen auf einmal. Ich habe nichts hinzugefügt.',
  tooMany: 'Mehr als dreißig auf einmal gehen nicht; sag den Rest bitte noch einmal.',
  rateLimited:
    'Das waren gerade sehr viele Sachen auf einmal. Warte bitte eine Minute, dann geht es weiter. Ich habe nichts hinzugefügt.',
  failed:
    'Entschuldigung, das hat gerade nicht geklappt. Ich habe nichts hinzugefügt. Versuch es bitte gleich noch einmal.',
  listFailed:
    'Entschuldigung, ich komme gerade nicht an die Snacklist. Versuch es bitte gleich noch einmal.',
  emptyList: 'Die Snacklist ist leer.',
  cardTitle: 'Snacklist',
} as const;

/**
 * Where an add went, as the sentences name it: the Snacklist for the default list as before job
 * 207, else the list ("Liste Geburtstag", "Einkaufsliste"), after why a named list was not used.
 */
function place(target: Target | undefined): { list: string; why: string | null } {
  if (!namesList(target)) return { list: 'Snacklist', why: null };
  return {
    list: copy.de.listName(target.list),
    why: target.kind === 'named' || target.kind === 'default'
      ? null
      : copy.de.notFound(target.kind, target.said),
  };
}

/**
 * The read-back after an add, one sentence per outcome. Added: "Ich habe Milch und Eier auf die
 * Snacklist gesetzt." Open already, the exact items and then the other spellings or synonyms of
 * new ones (job 32b, added anyway), each name once: "Schon auf der Snacklist: Milch und Möhren."
 * A named list: "Ich habe Luftballons auf die Liste Geburtstag gesetzt."
 */
export function confirmation(results: readonly Added[], target?: Target): string {
  const { list, why } = place(target);
  const added = results.filter((r) => !r.alreadyOnList);
  const open = [
    ...new Set([
      ...results.filter((r) => r.alreadyOnList).map(said),
      ...added.flatMap((r) => r.similarOnList ?? []),
    ]),
  ];
  const parts: string[] = why ? [why] : [];
  if (added.length) parts.push(`Ich habe ${enumerate(added.map(said))} auf die ${list} gesetzt.`);
  if (open.length) parts.push(`Schon auf der ${list}: ${enumerate(open)}.`);
  return parts.join(' ');
}

/**
 * Q79 (copy pending Peter): when held items ("Butter" with "Butter Weihenstephan" open) are in
 * the results, what was done and then "Butter Weihenstephan steht schon auf der Snacklist. Soll
 * ich Butter trotzdem dazuschreiben?", with the held items' text for the slot on a yes.
 */
export function question(
  results: readonly Added[],
  target?: Target,
): { question: string; again: string } | null {
  const held = results.filter((r) => r.held);
  if (!held.length) return null;
  const { list } = place(target);
  const open = enumerate(held.map(said));
  const wanted = enumerate(held.map((r) => said({ ...r.held!, brand: null, properties: null })));
  return {
    question: [
      confirmation(results.filter((r) => !r.held), target),
      `${open} ${held.length === 1 ? 'steht' : 'stehen'} schon auf der ${list}. ` +
      `Soll ich ${wanted} trotzdem dazuschreiben?`,
    ].filter(Boolean).join(' '),
    again: held.map((r) => copy.de.spoken(r.held!)).join(', '),
  };
}

/** At most this many items are read aloud (one more if that is all); the rest is a count. */
export const readLimit = 10;

/** "Auf der Snacklist stehen 3 Sachen: Milch, Eier und Brot." */
export function listing(items: readonly Spoken[]): string {
  if (items.length === 0) return speech.emptyList;
  // One more than the limit is read: "und eine weitere" is no shorter than the item.
  const read = items.slice(0, items.length > readLimit + 1 ? readLimit : undefined).map(said);
  const rest = items.length - read.length;
  const head = items.length === 1
    ? 'Auf der Snacklist steht eine Sache'
    : `Auf der Snacklist stehen ${items.length} Sachen`;
  if (rest === 0) return `${head}: ${enumerate(read)}.`;
  return `${head}: ${read.join(', ')} und ${rest} weitere.`;
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
