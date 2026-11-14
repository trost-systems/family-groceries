// captions.yaml read and checked once: the words of a locale for one store and one assistants
// variant, and the rules no caption may break (docs/STORE_SCREENSHOTS.md, "Checks").
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { LOCALES, SHOTS } from './sets.mjs';

const FILE = join(import.meta.dirname, 'captions.yaml');
export const VARIANTS = ['neutral', 'named', 'named_api'];
const ALT_MAX = 140;

// What no caption, alt text or sticker may say. Brand and chain names match whole words.
const FORBIDDEN = [
  [/premium/i, 'Premium'],
  [/[€$£]|\bpreis|\bprice|\bkostenlos|\bgratis|\bfree\b/i, 'a price or "free"'],
  [/\b(beste[nrs]?|best|nr\.? ?1|no\.? ?1|#1|top|neu|new)\b/i, '„beste“, „Nr. 1“, „Top“ or „Neu“'],
  [/\b(lidl|aldi|edeka|rewe|kaufland|penny|netto|rossmann|dm|norma|globus|tegut|walmart|target|kroger|costco|safeway|publix|whole foods|trader joe'?s|amazon fresh|instacart)\b/i, 'a retailer'],
  [/\b(chatgpt|openai|claude|anthropic|gemini|copilot|perplexity|mistral|llama|grok)\b/i, 'an AI brand'],
  [/humm/i, 'the old product name'],
  [/snack[\s­-]+list|snackl\b/i, 'a split or shortened "Snacklist"'],
];
// Allowed only in a named variant; API only in named_api.
const NAMED = [[/\b(siri|alexa|mcp)\b/i, ['named', 'named_api']], [/\bapi\b/i, ['named_api']]];

const all = parse(readFileSync(FILE, 'utf8'));

/** Every rule a text breaks, in a variant (or none for words outside the variants). */
export function textProblems(text, variant) {
  const problems = FORBIDDEN.filter(([re]) => re.test(text)).map(([, what]) => `names ${what}`);
  for (const [re, allowed] of NAMED) if (re.test(text) && !allowed.includes(variant)) problems.push(`names ${re.source.replace(/\\b|[()]/g, '')} outside ${allowed.join('/')}`);
  return problems;
}

const strings = (value) => (typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(strings));

/** Every problem in captions.yaml, for every locale, store and variant. */
export function captionProblems() {
  const problems = [];
  for (const locale of Object.keys(LOCALES)) {
    const doc = all[locale];
    if (!doc) {
      problems.push(`${locale}: missing`);
      continue;
    }
    const ids = Object.keys(doc.shots ?? {});
    if (ids.join() !== SHOTS.join()) problems.push(`${locale}: shots are ${ids.join(', ')}, sets.mjs has ${SHOTS.join(', ')} (store order)`);
    for (const variant of VARIANTS) {
      for (const store of ['play', 'appstore']) {
        const words = captionsFor(locale, { assistants: variant, store });
        for (const [id, c] of Object.entries(words)) {
          const where = `${locale} ${id} (${variant}, ${store})`;
          if (id !== 'feature' && (!Array.isArray(c.h) || c.h.length !== 2 || !c.s)) problems.push(`${where}: needs h as two lines and s`);
          if (!c.alt || c.alt.length > ALT_MAX) problems.push(`${where}: alt text missing or over ${ALT_MAX} characters`);
          if (!['draft', 'approved'].includes(c.status)) problems.push(`${where}: status must be draft or approved`);
          // Sticker words do not change with the variant: they must pass as neutral.
          for (const t of strings({ h: c.h, s: c.s, alt: c.alt, tagline: c.tagline })) problems.push(...textProblems(t, c.variant).map((p) => `${where}: "${t}" ${p}`));
          if (c.sticker && Object.values(c.sticker).some((v) => v === null || v === undefined)) problems.push(`${where}: a sticker key without a value (quote text with commas)`);
          for (const t of strings(c.sticker)) problems.push(...textProblems(t, 'neutral').map((p) => `${where} sticker: "${t}" ${p}`));
        }
      }
    }
  }
  return [...new Set(problems)];
}

/**
 * The words of a locale's shots for one store, with the assistants variant applied: a shot with
 * variants gets the chosen one or the nearest it has (named_api, then named, then neutral), and a
 * variant's `play:` replaces its own fields on Play. `feature` holds the feature graphic's words.
 */
export function captionsFor(locale, { assistants = 'neutral', store }) {
  if (!VARIANTS.includes(assistants)) throw new Error(`unknown assistants variant ${assistants} (${VARIANTS.join(', ')})`);
  const doc = all[locale];
  const out = {};
  for (const [id, { variants, ...base }] of Object.entries(doc.shots)) {
    if (!variants) {
      out[id] = { ...base, variant: null };
      continue;
    }
    const name = VARIANTS.slice(0, VARIANTS.indexOf(assistants) + 1).findLast((v) => variants[v]);
    const { play, ...chosen } = variants[name];
    out[id] = { ...base, ...chosen, ...(store === 'play' ? play : {}), variant: name };
  }
  out.feature = { ...doc.feature, variant: null };
  return out;
}
