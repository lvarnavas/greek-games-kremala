import type { RankEntry } from './types';

export interface RankInput {
  playerId: string;
  won: boolean;
  points: number;
  mistakes: number;
  timeMs: number;
}

/**
 * Σύγκριση αποτελεσμάτων μονομαχίας (αρνητικό = το a προηγείται):
 * 1. νίκη, 2. περισσότεροι πόντοι, 3. λιγότερα λάθη, 4. λιγότερος χρόνος.
 * Επιστρέφει 0 για ισοπαλία.
 */
export function compareResults(a: RankInput, b: RankInput): number {
  if (a.won !== b.won) return a.won ? -1 : 1;
  if (a.points !== b.points) return b.points - a.points;
  if (a.mistakes !== b.mistakes) return a.mistakes - b.mistakes;
  if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  return 0;
}

/**
 * Ντετερμινιστική κατάταξη (τύπου 1-1-3). Οι ισόβαθμοι μοιράζονται θέση και
 * ταξινομούνται σταθερά κατά id ώστε όλοι οι clients να βλέπουν ίδια σειρά.
 */
export function rankResults(inputs: RankInput[], compare: (a: RankInput, b: RankInput) => number = compareResults): RankEntry[] {
  const sorted = [...inputs].sort((a, b) => compare(a, b) || (a.playerId < b.playerId ? -1 : a.playerId > b.playerId ? 1 : 0));
  const out: RankEntry[] = [];
  sorted.forEach((r, i) => {
    const prev = sorted[i - 1];
    const rank = prev && compare(prev, r) === 0 ? out[i - 1].rank : i + 1;
    out.push({ ...r, rank, tied: false });
  });
  for (const e of out) e.tied = out.filter((o) => o.rank === e.rank).length > 1;
  return out;
}

/** Νικητής γύρου: μόνο αν υπάρχει ένας και μοναδικός πρώτος που κέρδισε. */
export function roundWinner(ranking: RankEntry[]): string | null {
  const first = ranking.filter((r) => r.rank === 1);
  return first.length === 1 && first[0].won ? first[0].playerId : null;
}

/** Τελική κατάταξη παιχνιδιού: συνολικοί πόντοι, νίκες, λάθη, χρόνος. */
export interface TotalsInput extends RankInput {
  wins: number;
}
export function compareTotals(a: RankInput, b: RankInput): number {
  const ta = a as TotalsInput, tb = b as TotalsInput;
  if (ta.points !== tb.points) return tb.points - ta.points;
  if ((ta.wins ?? 0) !== (tb.wins ?? 0)) return (tb.wins ?? 0) - (ta.wins ?? 0);
  if (ta.mistakes !== tb.mistakes) return ta.mistakes - tb.mistakes;
  if (ta.timeMs !== tb.timeMs) return ta.timeMs - tb.timeMs;
  return 0;
}
