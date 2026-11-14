// Which of the household's lists a voice add names (job 207): Siri's dictated text, the voice
// function's `list` field and Alexa's slots all resolve here. Pure: the caller loads the
// catalog (listCatalog) and adds to `Target.list`.
import { fold, type ListCatalog, type ListOption, UUID } from './list.ts';

export type SpokenLang = 'de' | 'en';

/** What a voice request said about the target list. */
export type ListWish = { by: 'none' } | { by: 'name'; said: string } | { by: 'id'; id: string };

/** Where a voice add goes and why; `list` is always the list actually used. */
export type Target =
  /** `several`: the household has other lists too, so the answer names this one. */
  | { kind: 'default'; list: ListOption; several: boolean }
  | { kind: 'named'; list: ListOption }
  /** Fell back to the default list; `said` is null when an id named no list of the household. */
  | { kind: 'unknown' | 'ambiguous'; list: ListOption; said: string | null };

/** How a spoken name compares with the lists: `none` when it names no list at all ("Liste"). */
export type Match =
  | { kind: 'none' }
  | { kind: 'found'; list: ListOption }
  | { kind: 'ambiguous' | 'unknown' };

/**
 * Folded words that mean the shopping list or the app, not one of the lists (voice/parse.ts's
 * onTheList, folded), with what is left of them once a list suffix is stripped. Hummlist's
 * spellings stay until Siri on old builds stops saying them (job 174).
 */
const generic = new Set([
  '',
  'liste',
  'list',
  'lists',
  'einkaufsliste',
  'einkaufs',
  'einkauf',
  'einkaufszettel',
  'zettel',
  'shopping',
  'shoppinglist',
  'grocery',
  'grocerylist',
  'groceries',
  'grocerieslist',
  'snacklist',
  'snacklists',
  'snackliste',
  'snack',
  'snaecklist',
  'snaeck',
  'snecklist',
  'sneck',
  'hummlist',
  'hummliste',
  'humm',
  'hummelliste',
  'hummel',
  'humlist',
  'hum',
]);

/** Folded endings that mark a list rather than name it, longest first. */
const suffixes = ['einkaufsliste', 'grocerieslist', 'shoppinglist', 'grocerylist', 'liste', 'list'];

const leadingWords = new Set([
  'die',
  'der',
  'den',
  'dem',
  'meine',
  'meiner',
  'meinen',
  'unsere',
  'unserer',
  'unseren',
  'deine',
  'eure',
  'the',
  'my',
  'our',
]);

function stripSuffix(key: string): string {
  const suffix = suffixes.find((s) => key.endsWith(s) && key.length > s.length);
  return suffix ? key.slice(0, -suffix.length) : key;
}

/** The folded forms a name is compared by: in full and without a trailing "Liste". */
function keys(name: string): string[] {
  const full = fold(name);
  return [...new Set([full, stripSuffix(full)])];
}

function saidKeys(said: string): string[] {
  const words = said.trim().split(/\s+/);
  while (words.length > 1 && leadingWords.has((words[0] ?? '').toLowerCase())) words.shift();
  return keys(words.join(' '));
}

function levenshtein(a: string, b: string): number {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      next.push(Math.min((row[j] ?? 0) + 1, (next[j - 1] ?? 0) + 1, (row[j - 1] ?? 0) + cost));
    }
    row = next;
  }
  return row[b.length] ?? Math.max(a.length, b.length);
}

/**
 * 1 for the same key. A key inside the other of at least 4 letters ("party" in
 * "geburtstagsparty") scores at least 0.8, whatever the edit distance says.
 */
function similarity(a: string, b: string): number {
  const longer = Math.max(a.length, b.length);
  if (longer === 0) return 0;
  const ratio = 1 - levenshtein(a, b) / longer;
  const shorter = Math.min(a.length, b.length);
  const contained = shorter >= 4 && (a.includes(b) || b.includes(a));
  return contained ? Math.max(ratio, 0.8 + 0.2 * (shorter / longer)) : ratio;
}

/**
 * The lowest fuzzy score that finds a list: one edit per four letters, so "Partz" finds "Party"
 * (0.8) and "Geburtstags" finds "Geburtstag" (0.91), but no 3-letter name is one edit from
 * another (0.67) and "Hause" does not find "Haushalt" (0.5).
 */
export const fuzzyThreshold = 0.75;

/** The lists whose name is [wanted]: [full] the folded name alone, else with or without "Liste". */
function exactly(
  options: readonly ListOption[],
  wanted: readonly string[],
  full: boolean,
): Match | null {
  const exact = options.filter((o) =>
    full ? fold(o.name) === wanted[0] : keys(o.name).some((k) => wanted.includes(k))
  );
  const [only, ...more] = exact;
  if (!only) return null;
  return more.length ? { kind: 'ambiguous' } : { kind: 'found', list: only };
}

/**
 * Finds the list a spoken name means: a list with exactly that name first, so a list called
 * "Einkaufsliste" is found by its name; then generic words ("Liste", "shopping list", the app's
 * name) name no list; then exact (folded, with or without "Liste") before fuzzy. A tie at the top
 * is ambiguous. [exactOnly] skips fuzzy, for a bare "zu X" that may be part of an item.
 */
export function matchList(options: readonly ListOption[], said: string, exactOnly = false): Match {
  const wanted = saidKeys(said);
  const named = exactly(options, wanted, true);
  if (named) return named;
  if (wanted.some((k) => generic.has(k))) return { kind: 'none' };
  const exact = exactly(options, wanted, false);
  if (exact) return exact;
  if (exactOnly) return { kind: 'unknown' };
  const scored = options
    .map((list) => ({
      list,
      score: Math.max(...keys(list.name).flatMap((k) => wanted.map((w) => similarity(k, w)))),
    }))
    .sort((a, b) => b.score - a.score);
  const [best, second] = scored;
  if (!best || best.score < fuzzyThreshold) return { kind: 'unknown' };
  if (second && best.score - second.score < 1e-9) return { kind: 'ambiguous' };
  return { kind: 'found', list: best.list };
}

/** Whether an answer names the list it used: always, unless it is the household's only one. */
export const namesList = (target: Target | undefined): target is Target =>
  target !== undefined && (target.kind !== 'default' || target.several);

/** Where a voice add goes: the list the wish names, else the caller's default list. */
export function targetOf(catalog: ListCatalog, wish: ListWish): Target {
  const fallback = catalog.defaultList;
  const several = catalog.lists.length > 1;
  const standard: Target = { kind: 'default', list: fallback, several };
  if (wish.by === 'none') return standard;
  if (wish.by === 'id') {
    const id = wish.id.toLowerCase();
    const list = catalog.lists.find((o) => o.id === id);
    // Another household's list or a deleted one: never a household switch.
    if (!list) return { kind: 'unknown', list: fallback, said: null };
    // An id is no spoken name: the default list's (a yes to Q79 resends it) is spoken as before.
    return list.id === fallback.id ? standard : { kind: 'named', list };
  }
  const match = matchList(catalog.lists, wish.said);
  switch (match.kind) {
    case 'none':
      return standard;
    case 'found':
      // The only list, named ("auf die Einkaufsliste"): spoken as it always was.
      return several ? { kind: 'named', list: match.list } : standard;
    default:
      return { kind: match.kind, list: fallback, said: wish.said.trim() };
  }
}

/** A request's `list` field: an id, or a name to match. */
export const wishOf = (value: string | null): ListWish => {
  const said = value?.trim() ?? '';
  if (!said) return { by: 'none' };
  return UUID.test(said) ? { by: 'id', id: said } : { by: 'name', said };
};

const words = (text: string) => new Set(text.split('|'));

const phrasing: Record<SpokenLang, {
  /** Prepositions before a list phrase with "Liste". */
  marked: Set<string>;
  /** Prepositions that take a bare list name ("zu Geburtstag"), only when it is a list's name. */
  bare: Set<string>;
  /** Words after the phrase: "hinzu", "please". */
  trailing: Set<string>;
}> = {
  de: {
    marked: words('zur|zum|zu|auf|aufs|in|ins'),
    bare: words('zur|zum|zu|auf'),
    trailing: words('hinzu|hinzufügen|dazu|drauf|setzen|schreiben|packen|bitte|danke'),
  },
  en: {
    marked: words('to|onto|on|into'),
    bare: words('to|onto'),
    trailing: words('please|thanks|too'),
  },
};

/** Words a list name never holds: item separators. */
const separators = words('und|sowie|plus|and|&|+');

/** At most this many words name a list. */
const maxNameWords = 4;

const isMarker = (word: string) => /^list(e)?$/i.test(word);

/**
 * Finds a target-list phrase at the end of a dictated text: "Luftballons zur Geburtstag Liste
 * hinzu" is "Luftballons" for "Geburtstag". A phrase with "Liste" or "list" is always taken
 * (its name may then be unknown); a bare one ("zu Geburtstag", "to Birthday", "auf die Liste
 * Geburtstag") only when the name is a list's exactly, so "Brot zu Hause" stays an item next to a
 * list "Haus". A generic
 * phrase ("auf die Einkaufsliste") is taken with `said` null.
 */
export function takeListPhrase(
  text: string,
  lang: SpokenLang,
  options: readonly ListOption[],
): { text: string; said: string | null } {
  const { marked, bare, trailing } = phrasing[lang];
  const unchanged = { text, said: null };
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  /** A word as compared: lowercase, without the punctuation after it. */
  const word = (i: number) => (tokens[i] ?? '').replace(/[.!?,;:]+$/, '').toLowerCase();
  /** Punctuation after a word ends a phrase: "Milch, Party" names no list "Milch Party". */
  const ends = (i: number) => /[,;:]$/.test(tokens[i] ?? '');
  while (tokens.length && trailing.has(word(tokens.length - 1))) tokens.pop();
  if (!tokens.length) return unchanged;
  const last = tokens.length - 1;
  const spoken = (from: number, to: number) => {
    const name = tokens.slice(from, to).map((t) => t.replace(/[.!?,;:]+$/, ''));
    while (name.length && leadingWords.has((name[0] ?? '').toLowerCase())) name.shift();
    return name;
  };

  /** The nearest preposition of [preps] before index [end], with up to maxNameWords between. */
  const prepositionBefore = (end: number, preps: Set<string>) => {
    for (let i = end - 1; i >= 0 && end - i <= maxNameWords + 1; i--) {
      if (preps.has(word(i))) return i;
      if (separators.has(word(i)) || ends(i)) return -1;
    }
    return -1;
  };
  const taken = (at: number, said: string) => ({
    text: tokens.slice(0, at).join(' '),
    said: matchList(options, said).kind === 'none' ? null : said,
  });

  // "zur Geburtstag Liste", "auf die Liste", "to the birthday list".
  if (isMarker(word(last))) {
    const at = prepositionBefore(last, marked);
    return at < 0 ? unchanged : taken(at, spoken(at + 1, last).join(' '));
  }
  // "zur Geburtstagsliste", "zur Geburtstag-Liste", "to the birthday-list".
  const glued = (lang === 'de' ? /^(.+?)-?liste$/i : /^(.+)-list$/i).exec(
    spoken(last, last + 1)[0] ?? '',
  );
  if (glued?.[1]) {
    const at = prepositionBefore(last, marked);
    // A list called "Einkaufsliste" is found by its whole name; "Geburtstagsliste" by "Geburtstag".
    const whole = spoken(last, last + 1)[0] ?? '';
    const name = options.some((o) => fold(o.name) === fold(whole)) ? whole : glued[1];
    return at < 0 ? unchanged : taken(at, [...spoken(at + 1, last), name].join(' '));
  }
  // "zu Geburtstag", "auf die Liste Geburtstag", "to Birthday": only a name that finds a list.
  const at = prepositionBefore(tokens.length, bare);
  if (at < 0) return unchanged;
  const name = spoken(at + 1, tokens.length);
  const said = (isMarker(name[0] ?? '') ? name.slice(1) : name).join(' ');
  if (!said || matchList(options, said, true).kind !== 'found') return unchanged;
  return { text: tokens.slice(0, at).join(' '), said };
}
