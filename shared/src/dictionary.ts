import data from '../data/words.json';
import { normalizeWord, uniqueLetters, isGuessable } from './normalize';
import { pickRandom, shuffle, type Rng } from './rng';
import type { Difficulty, DifficultySetting } from './types';

export interface WordEntry {
  id: string;
  word: string;
  category: string;
  difficulty: Difficulty;
  ease: number;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
}

export interface Dictionary {
  categories: Category[];
  words: WordEntry[];
}

export const DICTIONARY: Dictionary = data as Dictionary;

export function categoryName(id: string, dict: Dictionary = DICTIONARY): string {
  return dict.categories.find((c) => c.id === id)?.name ?? id;
}

export function filterWords(dict: Dictionary, opts: { categories: string[]; difficulty: DifficultySetting }): WordEntry[] {
  return dict.words.filter(
    (w) =>
      (opts.categories.length === 0 || opts.categories.includes(w.category)) &&
      (opts.difficulty === 'any' || w.difficulty === opts.difficulty),
  );
}

/**
 * Τυχαία λέξη από τη δεξαμενή, αποφεύγοντας όσες έχουν ήδη χρησιμοποιηθεί.
 * Αν εξαντληθούν, επιτρέπεται επανάληψη. Αν η δεξαμενή είναι άδεια
 * (π.χ. συνδυασμός κατηγορίας/δυσκολίας χωρίς λέξεις), χαλαρώνει η δυσκολία.
 */
export function pickWord(
  dict: Dictionary,
  opts: { categories: string[]; difficulty: DifficultySetting },
  rng: Rng,
  exclude: ReadonlySet<string> = new Set(),
): WordEntry {
  let pool = filterWords(dict, opts);
  if (pool.length === 0) pool = filterWords(dict, { categories: opts.categories, difficulty: 'any' });
  if (pool.length === 0) pool = dict.words;
  const fresh = pool.filter((w) => !exclude.has(w.id));
  return pickRandom(rng, fresh.length > 0 ? fresh : pool);
}

/** Χαρακτηριστικά για σύγκριση ισοδυναμίας λέξεων. */
export function wordProfile(word: string): { length: number; unique: number } {
  const letters = normalizeWord(word).filter(isGuessable);
  return { length: letters.length, unique: uniqueLetters(letters).length };
}

/** Απόσταση δύο λέξεων ως προς τη δυσκολία (μικρότερη = πιο ισοδύναμες). */
export function equivalenceDistance(a: WordEntry, b: WordEntry): number {
  const pa = wordProfile(a.word), pb = wordProfile(b.word);
  return Math.abs(pa.length - pb.length) * 2 + Math.abs(pa.unique - pb.unique) * 2 + Math.abs(a.ease - b.ease) / 3;
}

/**
 * Ισοδύναμες διαφορετικές λέξεις για Μονομαχία: ίδια δυσκολία, παρόμοιο
 * μήκος, πλήθος μοναδικών γραμμάτων και συχνότητα γραμμάτων.
 * Επιστρέφει `count` λέξεις, με πρώτη τη βασική.
 */
export function pickEquivalentWords(
  dict: Dictionary,
  base: WordEntry,
  count: number,
  rng: Rng,
  opts: { categories: string[]; exclude?: ReadonlySet<string> } = { categories: [] },
): WordEntry[] {
  const exclude = opts.exclude ?? new Set<string>();
  const candidates = dict.words
    .filter((w) => w.id !== base.id && !exclude.has(w.id) && w.difficulty === base.difficulty)
    .filter((w) => opts.categories.length === 0 || opts.categories.includes(w.category))
    .map((w) => ({ w, d: equivalenceDistance(base, w) }))
    .sort((x, y) => x.d - y.d);
  // Τυχαία επιλογή ανάμεσα στις πιο κοντινές, για ποικιλία.
  const top = shuffle(rng, candidates.slice(0, Math.max(count * 3, 6)));
  const picked = [base, ...top.slice(0, count - 1).map((c) => c.w)];
  while (picked.length < count) picked.push(base);
  return picked;
}

/** Κανονικοποιημένες λέξεις μιας κατηγορίας (για τα «έξυπνα» bots). */
const normalizedCache = new Map<string, string[][]>();
export function normalizedWordsFor(dict: Dictionary, category: string | null): string[][] {
  const key = `${dict.words.length}:${category ?? '*'}`;
  let list = normalizedCache.get(key);
  if (!list) {
    list = dict.words.filter((w) => category === null || w.category === category).map((w) => normalizeWord(w.word));
    normalizedCache.set(key, list);
  }
  return list;
}
