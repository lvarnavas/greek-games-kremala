import { LETTER_FREQUENCY } from './alphabet';
import { normalizeWord, uniqueLetters } from './normalize';
import type { Difficulty } from './types';

/**
 * «Ευκολία» λέξης: άθροισμα συχνοτήτων των μοναδικών γραμμάτων (πόσο πιθανό
 * είναι να πετύχει κανείς γράμμα) + 1,5 ανά θέση (οι μακριές λέξεις
 * αποκαλύπτονται γρηγορότερα). Μεγαλύτερη τιμή = ευκολότερη λέξη.
 */
export function easeScore(word: string): number {
  const letters = normalizeWord(word).filter((c) => c in LETTER_FREQUENCY);
  const coverage = uniqueLetters(letters).reduce((s, l) => s + LETTER_FREQUENCY[l], 0);
  return Math.round((coverage + letters.length * 1.5) * 10) / 10;
}

/** Όρια επιλεγμένα ώστε το λεξικό να μοιράζεται περίπου σε τρίτα. */
export const DIFFICULTY_THRESHOLDS = { easy: 55, medium: 44 } as const;

export function computeDifficulty(word: string): Difficulty {
  const s = easeScore(word);
  if (s >= DIFFICULTY_THRESHOLDS.easy) return 'easy';
  if (s >= DIFFICULTY_THRESHOLDS.medium) return 'medium';
  return 'hard';
}
