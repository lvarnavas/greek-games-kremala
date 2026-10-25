// Bots: επιλέγουν γράμματα ΜΟΝΟ από τη δημόσια προβολή του ταμπλό
// (μάσκα, επιλεγμένα γράμματα, κατηγορία). Δεν έχουν πρόσβαση στη λέξη.

import { GREEK_ALPHABET, LETTERS_BY_FREQUENCY, LETTER_FREQUENCY } from './alphabet';
import { normalizedWordsFor, type Dictionary, DICTIONARY } from './dictionary';
import { pickRandom, randomInt, type Rng } from './rng';
import type { BoardView, BotLevel, HintType } from './types';

export const BOT_NAMES = ['Νίκος', 'Μαρία', 'Γιώργος', 'Ελένη', 'Κώστας', 'Σοφία', 'Δημήτρης', 'Αγγελική', 'Παναγιώτης', 'Κατερίνα', 'Γιάννης', 'Δέσποινα'];

export const BOT_LEVEL_LABEL: Record<BotLevel, string> = { easy: 'Εύκολο', medium: 'Μέτριο', hard: 'Δύσκολο' };

/** Χρόνος αντίδρασης (ms) ανά επίπεδο. */
export const BOT_DELAY: Record<BotLevel, [number, number]> = {
  easy: [2800, 5000],
  medium: [1700, 3200],
  hard: [1000, 2000],
};

export function botDelay(level: BotLevel, rng: Rng): number {
  const [min, max] = BOT_DELAY[level];
  return randomInt(rng, min, max);
}

function available(view: BoardView): string[] {
  return GREEK_ALPHABET.filter((l) => !view.guessedLetters.includes(l) && !view.eliminatedLetters.includes(l));
}

/** Υποψήφιες λέξεις του λεξικού συμβατές με τη μάσκα και τα λάθη. */
export function matchingCandidates(view: BoardView, dict: Dictionary = DICTIONARY): string[][] {
  const wrong = new Set([...view.incorrectLetters, ...view.eliminatedLetters]);
  const revealed = new Set(view.correctLetters);
  const filter = (words: string[][]) =>
    words.filter(
      (w) =>
        w.length === view.mask.length &&
        w.every((ch, i) => {
          const m = view.mask[i];
          if (m !== null) return ch === m;
          return !wrong.has(ch) && !revealed.has(ch);
        }),
    );
  const inCategory = filter(normalizedWordsFor(dict, view.category));
  return inCategory.length > 0 ? inCategory : filter(normalizedWordsFor(dict, null));
}

/** Γράμμα με τη μεγαλύτερη συχνότητα εμφάνισης στις υποψήφιες λέξεις. */
function bestFromCandidates(candidates: string[][], options: string[]): string | null {
  if (candidates.length === 0) return null;
  const counts = new Map<string, number>();
  for (const w of candidates) for (const l of new Set(w)) if (options.includes(l)) counts.set(l, (counts.get(l) ?? 0) + 1);
  let best: string | null = null, bestCount = 0;
  for (const l of options) {
    const c = counts.get(l) ?? 0;
    if (c > bestCount || (c === bestCount && c > 0 && best !== null && LETTER_FREQUENCY[l] > LETTER_FREQUENCY[best])) {
      best = l; bestCount = c;
    }
  }
  return best;
}

/** Τυχαίο γράμμα σταθμισμένο με τη συχνότητα. */
function weightedRandom(options: string[], rng: Rng): string {
  const total = options.reduce((s, l) => s + LETTER_FREQUENCY[l], 0);
  let r = rng() * total;
  for (const l of options) {
    r -= LETTER_FREQUENCY[l];
    if (r <= 0) return l;
  }
  return options[options.length - 1];
}

/**
 * Στρατηγικές:
 * - Εύκολο: κυρίως τυχαία γράμματα σταθμισμένα με συχνότητα.
 * - Μέτριο: σειρά συχνότητας με λίγη τυχαιότητα· μερικές φορές χρησιμοποιεί λεξικό.
 * - Δύσκολο: φιλτράρει το λεξικό με βάση τη μάσκα και διαλέγει το πιο πιθανό γράμμα.
 */
export function chooseBotLetter(view: BoardView, level: BotLevel, rng: Rng, dict: Dictionary = DICTIONARY): string | null {
  const options = available(view);
  if (options.length === 0 || view.status !== 'playing') return null;
  if (level === 'easy') {
    return rng() < 0.75 ? weightedRandom(options, rng) : pickRandom(rng, options);
  }
  if (level === 'medium') {
    if (rng() < 0.4) {
      const smart = bestFromCandidates(matchingCandidates(view, dict), options);
      if (smart) return smart;
    }
    const ordered = LETTERS_BY_FREQUENCY.filter((l) => options.includes(l));
    return ordered[Math.min(ordered.length - 1, Math.floor(rng() * 3))];
  }
  const smart = bestFromCandidates(matchingCandidates(view, dict), options);
  return smart ?? LETTERS_BY_FREQUENCY.find((l) => options.includes(l)) ?? options[0];
}

/** Αν το bot θα χρησιμοποιήσει υπόδειξη (μόνο όταν το επιτρέπουν οι ρυθμίσεις). */
export function chooseBotHint(view: BoardView, level: BotLevel, hintsAllowed: boolean, rng: Rng): HintType | null {
  if (!hintsAllowed || view.hintsRemaining <= 0 || view.status !== 'playing' || level === 'easy') return null;
  const lastChance = view.maxMistakes - view.mistakes <= 1;
  if (!lastChance) return null;
  if (level === 'medium' && rng() < 0.5) return null;
  return view.revealedCount < view.totalLetters - 1 ? 'reveal' : 'eliminate';
}
