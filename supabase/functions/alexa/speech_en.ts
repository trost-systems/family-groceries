// What Alexa says in English (en-US, en-GB, en-AU, en-CA, en-IN). Same outcomes as speech.ts, one
// sentence each. Alexa is not Premium (Legal N-27): the locked lines say nothing about buying.
import { copy } from '../voice/copy.ts';
import type { Added } from '../voice/handler.ts';
import type { Spoken } from './speech.ts';

const unitWords: Record<string, [string, string]> = {
  l: ['liter', 'liters'],
  ml: ['milliliter', 'milliliters'],
  kg: ['kilo', 'kilos'],
  g: ['gram', 'grams'],
};

/** "2 l" is "2 liters", "1 kg" is "1 kilo"; counts and "1 dozen" stay. */
const sayQuantity = (quantity: string) =>
  quantity.replace(
    /^([\d.]+)\s*(l|ml|kg|g)$/,
    (_, n: string, unit: string) => `${n} ${unitWords[unit][n === '1' ? 0 : 1]}`,
  );

/** "2 liters of milk", "3 bananas", "1 dozen eggs", "milk". */
export function saidEnglish(item: Spoken): string {
  const name = [item.name, item.brand, item.properties?.replaceAll(', ', ' ')]
    .filter(Boolean).join(' ');
  if (!item.quantity) return name;
  const bare = /^[\d.]+$|dozen$|few$/.test(item.quantity);
  return `${sayQuantity(item.quantity)} ${bare ? '' : 'of '}${name}`;
}

/** "milk", "milk and eggs", "milk, eggs and bread". */
export function enumerateEnglish(parts: readonly string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

const askForItems = 'What should go on the list?';
const example = 'Say for example: milk and eggs.';

export const speechEnglish = {
  launch: askForItems,
  launchReprompt: `${askForItems} ${example}`,
  help: "With Hummlist you add things to your household's shopping list. " +
    "Say for example: add milk and eggs. Or ask: what's on the list? What would you like?",
  helpReprompt: `${askForItems} Or ask: what's on the list?`,
  notUnderstoodOnce: `I didn't understand that. ${askForItems}`,
  notUnderstoodReprompt: `${askForItems} ${example}`,
  notUnderstood: "Sorry, I didn't understand that. I didn't add anything to Hummlist.",
  goodbye: 'Bye for now.',
  linkAccount: 'Please link your Hummlist account in the Alexa app first. I sent you a card there.',
  noHousehold:
    "You're not in a household yet. Create one or join one in the Hummlist app, then Alexa works too.",
  tooLong: "That was too long. Say at most thirty things at once. I didn't add anything.",
  tooMany: "More than thirty at once doesn't work; please say the rest again.",
  rateLimited:
    "That was a lot of things at once. Please wait a minute, then it works again. I didn't add anything.",
  failed: "Sorry, that didn't work. I didn't add anything. Please try again in a moment.",
  listFailed: "Sorry, I can't reach Hummlist right now. Please try again in a moment.",
  emptyList: 'Your Hummlist is empty.',
  cardTitle: 'Hummlist',
} as const;

/**
 * The read-back after an add, one sentence per outcome: "I put milk and eggs on Hummlist."
 * "Already on Hummlist: milk." Open already: the exact items, then the other spellings or
 * synonyms of new ones (added anyway), each name once.
 */
export function confirmationEnglish(results: readonly Added[]): string {
  const added = results.filter((r) => !r.alreadyOnList);
  const open = [
    ...new Set([
      ...results.filter((r) => r.alreadyOnList).map(saidEnglish),
      ...added.flatMap((r) => r.similarOnList ?? []),
    ]),
  ];
  const parts: string[] = [];
  if (added.length) parts.push(`I put ${enumerateEnglish(added.map(saidEnglish))} on Hummlist.`);
  if (open.length) parts.push(`Already on Hummlist: ${enumerateEnglish(open)}.`);
  return parts.join(' ');
}

/**
 * Q79 (copy pending Peter): "Butter Weihenstephan is already on Hummlist. Should I add butter
 * anyway?", after what was done, with the held items' text for the slot on a yes.
 */
export function questionEnglish(
  results: readonly Added[],
): { question: string; again: string } | null {
  const held = results.filter((r) => r.held);
  if (!held.length) return null;
  const open = enumerateEnglish(held.map(saidEnglish));
  const wanted = enumerateEnglish(
    held.map((r) => saidEnglish({ ...r.held!, brand: null, properties: null })),
  );
  return {
    question: [
      confirmationEnglish(results.filter((r) => !r.held)),
      `${open} ${held.length === 1 ? 'is' : 'are'} already on Hummlist. ` +
      `Should I add ${wanted} anyway?`,
    ].filter(Boolean).join(' '),
    again: held.map((r) => copy.en.spoken(r.held!)).join(', '),
  };
}

/** "There are 3 things on your Hummlist: milk, eggs and bread." */
export function listingEnglish(items: readonly Spoken[], limit: number): string {
  if (items.length === 0) return speechEnglish.emptyList;
  // One more than the limit is read: "and 1 more" is no shorter than the item.
  const read = items.slice(0, items.length > limit + 1 ? limit : undefined).map(saidEnglish);
  const rest = items.length - read.length;
  const head = items.length === 1
    ? 'There is one thing on your Hummlist'
    : `There are ${items.length} things on your Hummlist`;
  if (rest === 0) return `${head}: ${enumerateEnglish(read)}.`;
  return `${head}: ${read.join(', ')} and ${rest} more.`;
}
