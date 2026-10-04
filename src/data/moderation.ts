/**
 * Automatic text checks — SINGLE SOURCE OF TRUTH shared with firestore.rules (CLAUDE.md § 4,
 * ARCHITECTURE § 5). Patterns are written in the common subset of JavaScript RegExp and RE2
 * (the engine behind `string.matches()` in Firestore rules): no look-around, no
 * back-reference, no `\b` (RE2's `\b` is ASCII-only and would see « è » as a boundary).
 *
 * They are applied to text that has been NFC-normalised and lower-cased. Firestore rules
 * cannot strip accents, so accented and plain spellings are both listed (`[eé]`). Proven on the
 * emulator (2 Oct 2026): the rules' `lower()` only lower-cases ASCII letters (« É » stays « É »),
 * so every bracket class also receives the capital form of its accented letters (see
 * `withAccentCapitals`). The client lower-cases fully, so this changes nothing on its side.
 */

const ACCENTED = 'àâäçéèêëîïôöùûüÿœæ';

/** Adds the capital form of each accented letter found inside every `[...]` class. */
export function withAccentCapitals(pattern: string): string {
  return pattern.replace(/\[([^\]]*)\]/g, (_m, body: string) => {
    const capitals = [...ACCENTED].filter((c) => body.includes(c)).map((c) => c.toUpperCase());
    return `[${body}${capitals.join('')}]`;
  });
}

/** A letter or digit, including French accented letters. Used to emulate word boundaries. */
const WORD_CHAR = `a-z0-9${ACCENTED}`;
/** Start of a word: start of text or a non-word character. */
const L = `(^|[^${WORD_CHAR}])`;
/** End of a word: a non-word character or end of text. */
const R = `([^${WORD_CHAR}]|$)`;

/**
 * Terms suggesting a minor (zero tolerance, CLAUDE.md § 4.2). Each entry is a regex fragment
 * matched as a whole word. Ages 10–17 followed by « ans » are refused; single-digit ages are
 * not, so that « en couple depuis 3 ans » stays possible.
 */
export const MINOR_TERMS: readonly string[] = [
  'mineure?s?',
  'minors?',
  'under ?age',
  'ados?',
  'adolescente?s?',
  'teens?',
  'teenagers?',
  'coll[eé]gien(ne)?s?',
  'lyc[eé]en(ne)?s?',
  '[eé]coli[eè]re?s?',
  'school ?girls?',
  'school ?boys?',
  'lolitas?',
  'loli',
  'p[eé]dos?',
  'p[eé]dophiles?',
  'fillettes?',
  'gamine?s?',
  'petite?s? filles?',
  'petits? gar[cç]ons?',
  'jeune fille de 1[0-7]',
  '1[0-7] ?ans',
  '1[0-7] ?years?',
  '1[0-7] ?yrs?',
  '1[0-7] ?(yo|y/o)',
  '(dix|onze|douze|treize|quatorze|quinze|seize|dix[- ]?sept) ?ans',
];

/**
 * Prices and tariff terms (owner's decision: no price in a listing, CLAUDE.md § 4.3).
 * - an amount followed by a currency or « k / mille » (« 10 000 f », « 5k », « 2000frs ») ;
 *   a lone « f » needs 3+ digits so that « 27 F cherche homme » (27-year-old woman) passes,
 *   and « k » must be glued to the digits (« 70 kg » / « 70 k » pass) ;
 * - currency names and tariff / paid-sex vocabulary (list inherited from v1).
 */
export const PRICE_TERMS: readonly string[] = [
  '[0-9][0-9 .]* ?(fr|frs|francs?|fcfa|cfa|xaf|mil|mille|balles)',
  '[0-9]([ .]?[0-9]){2,} ?f',
  '[0-9]+k',
  'f ?cfa',
  'cfa',
  'xaf',
  'tarifs?',
  'tarif[eé]e?s?',
  'prix',
  'payante?s?',
  'r[eé]mun[eé]r[a-zéè]*',
  'money',
  'escorte?s?',
  'bizi',
  'wolowoss',
  'tchoko',
  'shorts? ?times?',
  'shots? ?times?',
  'longs? ?times?',
  'per night',
  'par nuit',
  'la nuit [aà] [0-9]',
  'une passe',
  'la passe',
  'pay me',
];

function wordAlternation(terms: readonly string[]): string {
  return withAccentCapitals(`${L}(${terms.join('|')})${R}`);
}

export const MINOR_PATTERN = wordAlternation(MINOR_TERMS);
export const PRICE_PATTERN = wordAlternation(PRICE_TERMS);

/**
 * Contact details in free text (the contact goes through the WhatsApp button only):
 * 8+ digits with up to 3 separators between them (« 6 - 78 - 80 »), wa.me / whatsapp.com / t.me
 * links, URLs, e-mails. Known false positive: a full date « 12/05/1995 » (8 digits) is refused.
 */
export const CONTACT_PATTERN =
  '([0-9]([ ./-]{0,3}[0-9]){7}|wa[.]me|whatsapp[.]com|t[.]me/|https?:|www[.]|@[a-z0-9-]+[.][a-z]{2,})';

export type TextProblem = 'minor' | 'price' | 'contact';

export function normalizeText(text: string): string {
  return text.normalize('NFC').toLowerCase();
}

const MINOR_RE = new RegExp(MINOR_PATTERN, 's');
const PRICE_RE = new RegExp(PRICE_PATTERN, 's');
const CONTACT_RE = new RegExp(CONTACT_PATTERN, 's');

/** First problem found in a user text, in order of severity, or null if the text is accepted. */
export function findTextProblem(text: string): TextProblem | null {
  const t = normalizeText(text);
  if (MINOR_RE.test(t)) return 'minor';
  if (PRICE_RE.test(t)) return 'price';
  if (CONTACT_RE.test(t)) return 'contact';
  return null;
}
