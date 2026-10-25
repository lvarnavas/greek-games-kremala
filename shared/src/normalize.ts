import { GREEK_SET, LATIN_TO_GREEK } from './alphabet';

const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Κανονικοποιεί ένα μεμονωμένο γράμμα: αφαιρεί τόνους/διαλυτικά, μετατρέπει
 * σε κεφαλαίο και το τελικό «ς» σε «Σ». Επιστρέφει null αν δεν είναι
 * ελληνικό γράμμα.
 */
export function normalizeLetter(input: unknown): string | null {
  if (typeof input !== 'string' || input.length === 0 || input.length > 4) return null;
  const stripped = input.trim().normalize('NFD').replace(COMBINING_MARKS, '');
  const chars = [...stripped];
  if (chars.length !== 1) return null;
  const upper = chars[0].toLocaleUpperCase('el-GR');
  return GREEK_SET.has(upper) ? upper : null;
}

/** Μετατρέπει πλήκτρο (ελληνικό ή λατινικό) σε ελληνικό γράμμα, αν γίνεται. */
export function keyToGreekLetter(key: string): string | null {
  if (typeof key !== 'string' || [...key].length !== 1) return null;
  const greek = normalizeLetter(key);
  if (greek) return greek;
  return LATIN_TO_GREEK[key.toLowerCase()] ?? null;
}

/** Επιστρέφει true για χαρακτήρες που δεν μαντεύονται (κενό, παύλα κ.λπ.). */
export function isGuessable(ch: string): boolean {
  return GREEK_SET.has(ch);
}

/**
 * Κανονικοποιεί μια λέξη σε πίνακα χαρακτήρων. Τα ελληνικά γράμματα γίνονται
 * κεφαλαία χωρίς τόνους· τα κενά και οι παύλες διατηρούνται ως έχουν.
 * Πετάει σφάλμα για μη υποστηριζόμενους χαρακτήρες.
 */
export function normalizeWord(word: string): string[] {
  const out: string[] = [];
  for (const ch of word.normalize('NFC')) {
    const letter = normalizeLetter(ch);
    if (letter) out.push(letter);
    else if (ch === ' ' || ch === '-') out.push(ch);
    else throw new Error(`Μη έγκυρος χαρακτήρας «${ch}» στη λέξη «${word}»`);
  }
  return out;
}

/** Μοναδικά μαντεύσιμα γράμματα μιας κανονικοποιημένης λέξης. */
export function uniqueLetters(letters: string[]): string[] {
  return [...new Set(letters.filter(isGuessable))];
}
