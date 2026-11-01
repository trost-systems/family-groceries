// Splits one dictated English sentence into list items:
// "We need milk, two cucumbers and a pack of eggs" -> milk | 2 cucumbers | 1 pack eggs.
// Names keep the casing and the plural Siri transcribed.
import { maxItems, type ParsedItem } from './parse.ts';

const maxNameLength = 120;
const maxQuantityLength = 40;

const separators = new Set([',', ';', '&', '+', 'and', 'plus', 'also']);

/** Names with "and" inside: one product each, not two items. */
const joinedNames = [['mac', 'cheese'], ['macaroni', 'cheese'], ['half', 'half']];

const words = (phrases: string) => phrases.split('|').map((p) => p.split(' '));
const cross = (...parts: string[][]) =>
  parts.reduce<string[][]>(
    (acc, options) =>
      acc.flatMap((head) => options.flatMap((o) => o ? [[...head, ...o.split(' ')]] : [head])),
    [[]],
  );

/** "to my list", "on the shopping list", "to Hummlist", ... */
const onTheList = cross(
  ['to', 'on', 'onto', 'in'],
  ['', 'my', 'the', 'our'],
  ['list', 'shopping list', 'grocery list', 'groceries list', 'hummlist'],
);

const leadingFiller = [
  ...words(
    'hey siri|siri|hummlist|ok|okay|so|um|uh|er|oh|well|yes|yeah|then|please|' +
      'add|put|get|buy|pick up|grab|write down|write|remember|remind me to buy|' +
      "don't forget|do not forget|we need|we need some|i need|need|we're out of|we are out of|" +
      "i'm out of|out of|can you add|could you add|can you|could you|can you please|" +
      'i want|i would like|some|more|any|the',
  ),
  ...onTheList,
];

const trailingFiller = [
  ...words('please|thanks|thank you|too|as well|for me|again|more'),
  ...onTheList,
];

const numberWords: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  hundred: 100,
};

/** Amounts said as words that stay words ("a couple of eggs"). */
const vagueAmounts = [['a', 'couple', 'of'], ['a', 'couple'], ['a', 'few'], ['a', 'bit', 'of']];

interface Unit {
  one: string;
  many: string;
}

const same = (short: string): Unit => ({ one: short, many: short });
const noun = (one: string, many = `${one}s`): Unit => ({ one, many });

const unitList: [string[], Unit][] = [
  [['kg', 'kilo', 'kilos', 'kilogram', 'kilograms'], same('kg')],
  [['g', 'gram', 'grams'], same('g')],
  [['lb', 'lbs', 'pound', 'pounds'], same('lb')],
  [['oz', 'ounce', 'ounces'], same('oz')],
  [['l', 'liter', 'liters', 'litre', 'litres'], same('l')],
  [['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'], same('ml')],
  [['pack', 'packs'], noun('pack')],
  [['package', 'packages'], noun('package')],
  [['packet', 'packets'], noun('packet')],
  [['box', 'boxes'], noun('box', 'boxes')],
  [['bottle', 'bottles'], noun('bottle')],
  [['can', 'cans'], noun('can')],
  [['tin', 'tins'], noun('tin')],
  [['jar', 'jars'], noun('jar')],
  [['bag', 'bags'], noun('bag')],
  [['carton', 'cartons'], noun('carton')],
  [['tub', 'tubs'], noun('tub')],
  [['loaf', 'loaves'], noun('loaf', 'loaves')],
  [['bunch', 'bunches'], noun('bunch', 'bunches')],
  [['roll', 'rolls'], noun('roll')],
  [['bar', 'bars'], noun('bar')],
  [['gallon', 'gallons'], noun('gallon')],
  [['pint', 'pints'], noun('pint')],
  [['piece', 'pieces'], noun('piece')],
  [['dozen'], same('dozen')],
];

const units = new Map(unitList.flatMap(([spellings, unit]) => spellings.map((s) => [s, unit])));

const isArticle = (token: string) => /^(a|an)$/i.test(token);

/** Digits ("2", "1.5", "500g") or a number word; glued is a unit written onto the digits. */
function readNumber(token: string): { value: number; glued: string } | null {
  const digits = /^(0|[1-9]\d{0,5}|(?:0|[1-9]\d{0,5})[.,]\d{1,3})(\p{L}*)$/u.exec(token);
  if (digits) return { value: Number(digits[1].replace(',', '.')), glued: digits[2] };
  const word = token.toLowerCase();
  if (word in numberWords) return { value: numberWords[word], glued: '' };
  if (isArticle(word)) return { value: 1, glued: '' };
  return null;
}

const amountOf = (n: number, unit: Unit | null) =>
  unit ? `${n} ${n === 1 ? unit.one : unit.many}` : String(n);

const lower = (tokens: string[]) => tokens.map((t) => t.toLowerCase());

function startsWith(tokens: string[], phrase: string[]): boolean {
  const head = lower(tokens.slice(0, phrase.length));
  return tokens.length >= phrase.length && phrase.every((word, i) => head[i] === word);
}

function endsWith(tokens: string[], phrase: string[]): boolean {
  const tail = lower(tokens.slice(tokens.length - phrase.length));
  return tokens.length >= phrase.length && phrase.every((word, i) => tail[i] === word);
}

const longestFirst = (phrases: string[][]) => [...phrases].sort((a, b) => b.length - a.length);
const leading = longestFirst(leadingFiller);
const trailing = longestFirst(trailingFiller);

function stripFiller(tokens: string[]): string[] {
  let rest = tokens;
  for (let changed = true; changed && rest.length;) {
    changed = false;
    const lead = leading.find((p) => startsWith(rest, p));
    if (lead) {
      rest = rest.slice(lead.length);
      changed = true;
    }
    const trail = rest.length ? trailing.find((p) => endsWith(rest, p)) : undefined;
    if (trail) {
      rest = rest.slice(0, rest.length - trail.length);
      changed = true;
    }
  }
  return rest;
}

function readPiece(segment: string[]): ParsedItem | null {
  let tokens = stripFiller(segment);
  const vague = vagueAmounts.find((p) => startsWith(tokens, p) && tokens.length > p.length);
  if (vague) return item(tokens.slice(vague.length), vague.filter((w) => w !== 'of').join(' '));

  const first = tokens.length > 1 ? readNumber(tokens[0]) : null;
  const gluedUnit = first?.glued ? units.get(first.glued.toLowerCase()) : undefined;
  if (!first || (first.glued && !gluedUnit)) return item(tokens, null);
  const article = isArticle(tokens[0]);
  tokens = tokens.slice(1);
  let unit = gluedUnit ?? null;
  if (!unit && tokens.length > 1 && units.has(tokens[0].toLowerCase())) {
    unit = units.get(tokens[0].toLowerCase())!;
    tokens = tokens.slice(1);
  }
  if (unit && tokens.length > 1 && tokens[0].toLowerCase() === 'of') tokens = tokens.slice(1);
  if (unit) return item(tokens, amountOf(first.value, unit));
  return item(tokens, article ? null : amountOf(first.value, null));
}

function item(tokens: string[], quantity: string | null): ParsedItem | null {
  const name = stripFiller(tokens).join(' ').replace(/^[\s.!?:-]+|[\s.!?:-]+$/g, '')
    .slice(0, maxNameLength).trim();
  if (!/\p{L}/u.test(name) || readNumber(name)) return null;
  return { name, quantity: quantity?.slice(0, maxQuantityLength) ?? null };
}

const tokenPattern = /\d+(?:[.,]\d+)+\p{L}*|[,;&+]|[^\s,;&+]+/gu;

function segmentsOf(text: string): string[][] {
  const cleaned = text
    .normalize('NFC')
    .replace(/[.!?]+(\s|$)/g, ',$1')
    .replace(/\bas well as\b/gi, ',')
    .replace(/[’‘]/g, "'");
  const tokens = cleaned.match(tokenPattern) ?? [];
  const segments: string[][] = [[]];
  tokens.forEach((token, i) => {
    const current = segments[segments.length - 1];
    const joined = token.toLowerCase() === 'and' &&
      joinedNames.some(([before, after]) =>
        current.at(-1)?.toLowerCase() === before && tokens[i + 1]?.toLowerCase() === after
      );
    if (separators.has(token.toLowerCase()) && !joined) segments.push([]);
    else current.push(token);
  });
  return segments.filter((s) => s.length);
}

/** Splits a dictated English sentence into items, in the order spoken, without duplicates. */
export function parseEnglish(text: string, limit = maxItems): ParsedItem[] {
  const items: ParsedItem[] = [];
  for (const segment of segmentsOf(text)) {
    const read = readPiece(segment);
    if (!read) continue;
    if (items.some((i) => i.name.toLowerCase() === read.name.toLowerCase())) continue;
    if (items.length === limit) break;
    items.push(read);
  }
  return items;
}

/** How an item is read back in English: "2 cucumbers", "1 pack of eggs", "milk". */
export function spokenEnglish(item: ParsedItem): string {
  if (!item.quantity) return item.name;
  const bare = /^[\d.]+$|dozen$|few$/.test(item.quantity);
  return `${item.quantity} ${bare ? '' : 'of '}${item.name}`;
}
