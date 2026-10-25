import type { Board, ScoreBreakdown, Settings } from './types';

/** Πόντοι νίκης ανά αριθμό λαθών: 0→100, 1→80, 2→60, 3→40, 4+→20. */
export const WIN_POINTS = [100, 80, 60, 40, 20] as const;
export const MAX_SPEED_BONUS = 20;
/** Ατομικοί πόντοι ανά σωστό γράμμα (Συνεργατική, «ομάδα + ατομικά»). */
export const COOP_INDIVIDUAL_POINTS_PER_LETTER = 10;

export function basePoints(won: boolean, mistakes: number): number {
  if (!won) return 0;
  return WIN_POINTS[Math.min(Math.max(0, mistakes), WIN_POINTS.length - 1)];
}

/** Μπόνους ταχύτητας ανάλογο του χρόνου που απέμεινε (0–20). */
export function speedBonus(board: Board, settings: Pick<Settings, 'speedBonusEnabled'>): number {
  if (!settings.speedBonusEnabled || board.status !== 'won' || board.deadline === null || board.finishedAt === null) return 0;
  const duration = board.deadline - board.startedAt;
  if (duration <= 0) return 0;
  const remaining = Math.max(0, board.deadline - board.finishedAt);
  return Math.round((MAX_SPEED_BONUS * remaining) / duration);
}

/**
 * Βαθμολογία ταμπλό: οι ποινές υποδείξεων αφαιρούνται από το βασικό σκορ
 * χωρίς να πέφτει κάτω από το μηδέν· ακολουθεί το προαιρετικό μπόνους.
 */
export function computeScore(board: Board, settings: Pick<Settings, 'speedBonusEnabled'>): ScoreBreakdown {
  const won = board.status === 'won';
  const base = basePoints(won, board.mistakes);
  if (!won) return { base: 0, hintPenalty: board.hintPenalty, speedBonus: 0, total: 0 };
  const afterPenalty = Math.max(0, base - board.hintPenalty);
  const bonus = speedBonus(board, settings);
  return { base, hintPenalty: board.hintPenalty, speedBonus: bonus, total: afterPenalty + bonus };
}
