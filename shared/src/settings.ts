import type { GameMode, Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  gameMode: 'classic',
  categories: [],
  difficulty: 'any',
  maxMistakes: 6,
  roundDuration: 120,
  totalRounds: 10,
  targetScore: 0,
  hintsEnabled: true,
  hintPenalties: { reveal: 25, eliminate: 10 },
  maxHintsPerRound: 2,
  timerEnabled: true,
  speedBonusEnabled: false,
  soundEnabled: true,
  theme: 'system',
  reducedMotion: false,
  showOpponentProgress: 'progress',
  wordMode: 'same',
  showGuessAuthor: true,
  coopScoring: 'team',
  botsUseHints: true,
};

export const LIMITS = {
  maxMistakes: { min: 3, max: 10 },
  roundDuration: { min: 20, max: 600 },
  totalRounds: { min: 1, max: 30 },
  targetScore: { min: 0, max: 5000 },
  maxHintsPerRound: { min: 0, max: 5 },
  hintPenalty: { min: 0, max: 100 },
  players: { min: 2, max: 8 },
  bots: { min: 1, max: 3 },
} as const;

const clamp = (v: unknown, min: number, max: number, fallback: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : fallback;
  return Math.min(max, Math.max(min, n));
};
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback;
const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

/**
 * Επικυρώνει και συμπληρώνει ρυθμίσεις από μη αξιόπιστη είσοδο
 * (π.χ. από τον client). Άγνωστα πεδία αγνοούνται.
 */
export function sanitizeSettings(input: unknown, base: Settings = DEFAULT_SETTINGS): Settings {
  const s = (input && typeof input === 'object' ? input : {}) as Partial<Record<keyof Settings, unknown>>;
  const penalties = (s.hintPenalties && typeof s.hintPenalties === 'object' ? s.hintPenalties : {}) as Record<string, unknown>;
  return {
    gameMode: oneOf<GameMode>(s.gameMode, ['classic', 'duel', 'coop'], base.gameMode),
    categories: Array.isArray(s.categories)
      ? [...new Set(s.categories.filter((c): c is string => typeof c === 'string' && c.length < 40))].slice(0, 30)
      : base.categories,
    difficulty: oneOf(s.difficulty, ['easy', 'medium', 'hard', 'any'] as const, base.difficulty),
    maxMistakes: clamp(s.maxMistakes, LIMITS.maxMistakes.min, LIMITS.maxMistakes.max, base.maxMistakes),
    roundDuration: clamp(s.roundDuration, LIMITS.roundDuration.min, LIMITS.roundDuration.max, base.roundDuration),
    totalRounds: clamp(s.totalRounds, LIMITS.totalRounds.min, LIMITS.totalRounds.max, base.totalRounds),
    targetScore: clamp(s.targetScore, LIMITS.targetScore.min, LIMITS.targetScore.max, base.targetScore),
    hintsEnabled: bool(s.hintsEnabled, base.hintsEnabled),
    hintPenalties: {
      reveal: clamp(penalties.reveal, LIMITS.hintPenalty.min, LIMITS.hintPenalty.max, base.hintPenalties.reveal),
      eliminate: clamp(penalties.eliminate, LIMITS.hintPenalty.min, LIMITS.hintPenalty.max, base.hintPenalties.eliminate),
    },
    maxHintsPerRound: clamp(s.maxHintsPerRound, LIMITS.maxHintsPerRound.min, LIMITS.maxHintsPerRound.max, base.maxHintsPerRound),
    timerEnabled: bool(s.timerEnabled, base.timerEnabled),
    speedBonusEnabled: bool(s.speedBonusEnabled, base.speedBonusEnabled),
    soundEnabled: bool(s.soundEnabled, base.soundEnabled),
    theme: oneOf(s.theme, ['system', 'light', 'dark'] as const, base.theme),
    reducedMotion: bool(s.reducedMotion, base.reducedMotion),
    showOpponentProgress: oneOf(s.showOpponentProgress, ['hidden', 'progress', 'full'] as const, base.showOpponentProgress),
    wordMode: oneOf(s.wordMode, ['same', 'equivalent'] as const, base.wordMode),
    showGuessAuthor: bool(s.showGuessAuthor, base.showGuessAuthor),
    coopScoring: oneOf(s.coopScoring, ['team', 'teamPlusIndividual'] as const, base.coopScoring),
    botsUseHints: bool(s.botsUseHints, base.botsUseHints),
  };
}
