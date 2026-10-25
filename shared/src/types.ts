// Μοντέλο δεδομένων του παιχνιδιού «Κρεμάλα».
// Οι τύποι χρησιμοποιούνται αυτούσιοι από τον client και τον server.

export type GameMode = 'classic' | 'duel' | 'coop';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type DifficultySetting = Difficulty | 'any';
/** Μονομαχία: ίδια λέξη για όλους ή ισοδύναμες διαφορετικές λέξεις. */
export type WordMode = 'same' | 'equivalent';
/** Ορατότητα αντιπάλων: τίποτα, μόνο πρόοδος, ή και τα επιλεγμένα γράμματα. */
export type OpponentVisibility = 'hidden' | 'progress' | 'full';
export type HintType = 'reveal' | 'eliminate';
export type CoopScoring = 'team' | 'teamPlusIndividual';
export type BotLevel = 'easy' | 'medium' | 'hard';
export type Theme = 'system' | 'light' | 'dark';
export type ConnectionStatus = 'connected' | 'disconnected' | 'left' | 'bot';

export interface Settings {
  gameMode: GameMode;
  /** Κενός πίνακας = όλες οι κατηγορίες. */
  categories: string[];
  difficulty: DifficultySetting;
  maxMistakes: number;
  /** Διάρκεια γύρου σε δευτερόλεπτα. */
  roundDuration: number;
  totalRounds: number;
  /** 0 = χωρίς στόχο πόντων. */
  targetScore: number;
  hintsEnabled: boolean;
  hintPenalties: Record<HintType, number>;
  maxHintsPerRound: number;
  timerEnabled: boolean;
  speedBonusEnabled: boolean;
  soundEnabled: boolean;
  theme: Theme;
  reducedMotion: boolean;
  showOpponentProgress: OpponentVisibility;
  wordMode: WordMode;
  /** Συνεργατική: εμφάνιση του ποιος πρότεινε κάθε γράμμα. */
  showGuessAuthor: boolean;
  coopScoring: CoopScoring;
  /** Bots: επιτρέπεται να χρησιμοποιούν υποδείξεις (αν είναι ενεργές). */
  botsUseHints: boolean;
}

export interface Player {
  id: string;
  displayName: string;
  score: number;
  wins: number;
  losses: number;
  streak: number;
  connectionStatus: ConnectionStatus;
  lastSeenAt: number;
  isBot?: boolean;
  botLevel?: BotLevel;
  joinedAt: number;
}

export type BoardStatus = 'playing' | 'won' | 'lost';
export type EndReason = 'solved' | 'mistakes' | 'timeout' | 'abandoned';

/**
 * Η κατάσταση ενός «ταμπλό» (μία λέξη). Στη Μονομαχία κάθε παίκτης έχει δικό
 * του ταμπλό· στη Συνεργατική υπάρχει ένα κοινό ταμπλό.
 * ΙΔΙΩΤΙΚΟ: περιέχει τη λέξη. Ποτέ δεν αποστέλλεται αυτούσιο.
 */
export interface Board {
  wordId: string;
  category: string;
  /** Η αρχική λέξη με τόνους (μυστική). */
  word: string;
  /** Κανονικοποιημένοι χαρακτήρες ανά θέση (μυστικοί). */
  letters: string[];
  guessedLetters: string[];
  correctLetters: string[];
  incorrectLetters: string[];
  /** Γράμματα που αφαιρέθηκαν με υπόδειξη (δεν μετράνε ως λάθη). */
  eliminatedLetters: string[];
  /** Ποιος παίκτης επέλεξε κάθε γράμμα. */
  guessedBy: Record<string, string>;
  mistakes: number;
  maxMistakes: number;
  hintsUsed: HintType[];
  hintPenalty: number;
  startedAt: number;
  deadline: number | null;
  finishedAt: number | null;
  status: BoardStatus;
  endReason: EndReason | null;
}

export interface ScoreBreakdown {
  base: number;
  hintPenalty: number;
  speedBonus: number;
  total: number;
}

export interface RankEntry {
  playerId: string;
  rank: number;
  won: boolean;
  points: number;
  mistakes: number;
  timeMs: number;
  /** true όταν μοιράζεται τη θέση με άλλον παίκτη. */
  tied: boolean;
}

export interface Participation {
  proposed: number;
  correct: number;
  incorrect: number;
  hints: number;
}

export type LogEntry =
  | { at: number; type: 'guess'; playerId: string; letter: string; correct: boolean }
  | { at: number; type: 'hint'; playerId: string; hint: HintType; letters: string[] }
  | { at: number; type: 'finished'; playerId: string; won: boolean }
  | { at: number; type: 'timeout' };

export type RoundStatus = 'playing' | 'finished';

/** Κλειδί του κοινού ταμπλό στη Συνεργατική λειτουργία. */
export const TEAM_BOARD = '__team__';

export interface Round {
  id: string;
  index: number;
  mode: GameMode;
  /** Λέξη του γύρου (στη Μονομαχία με ισοδύναμες λέξεις: η βασική). */
  wordId: string;
  category: string;
  // Συνοπτικά πεδία: στη Συνεργατική αντικατοπτρίζουν το κοινό ταμπλό,
  // στις ατομικές λειτουργίες είναι η ένωση (γράμματα) / το άθροισμα (λάθη).
  guessedLetters: string[];
  correctLetters: string[];
  incorrectLetters: string[];
  mistakes: number;
  maxMistakes: number;
  startedAt: number;
  deadline: number | null;
  finishedAt: number | null;
  status: RoundStatus;
  /** Παίκτες που συμμετέχουν στον γύρο (καθορίζονται στην έναρξή του). */
  participants: string[];
  winnerId: string | null;
  scoreByPlayer: Record<string, number>;
  teamScore: number | null;
  /** Ταμπλό ανά παίκτη (classic/duel) ή TEAM_BOARD (coop). */
  boards: Record<string, Board>;
  breakdown: Record<string, ScoreBreakdown>;
  ranking: RankEntry[];
  participation: Record<string, Participation>;
  log: LogEntry[];
}

export type GameStatus = 'lobby' | 'playing' | 'roundOver' | 'finished';

export interface BotState {
  level: BotLevel;
  nextActionAt: number;
}

export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  settings: Settings;
  players: Player[];
  currentRound: Round | null;
  roundHistory: Round[];
  createdAt: number;
  updatedAt: number;
  teamScore: number;
  hostId: string | null;
  bots: Record<string, BotState>;
  usedWordIds: string[];
}

// ---------- Δημόσιες προβολές (ασφαλείς για αποστολή) ----------

export interface BoardView {
  /** null = κρυφή θέση. Τα αποκαλυμμένα γράμματα είναι κεφαλαία χωρίς τόνους. */
  mask: (string | null)[];
  totalLetters: number;
  revealedCount: number;
  category: string;
  guessedLetters: string[];
  correctLetters: string[];
  incorrectLetters: string[];
  eliminatedLetters: string[];
  guessedBy: Record<string, string> | null;
  mistakes: number;
  maxMistakes: number;
  hintsUsed: number;
  hintsRemaining: number;
  startedAt: number;
  deadline: number | null;
  finishedAt: number | null;
  status: BoardStatus;
  endReason: EndReason | null;
  /** Η λέξη αποκαλύπτεται μόνο μετά τη λήξη του γύρου. */
  word: string | null;
}

export interface OpponentView {
  playerId: string;
  revealedCount: number;
  totalLetters: number;
  mistakes: number;
  maxMistakes: number;
  status: BoardStatus;
  finishedAt: number | null;
  /** Μόνο όταν showOpponentProgress === 'full'. */
  correctLetters?: string[];
  incorrectLetters?: string[];
}

export interface RoundResultView {
  index: number;
  words: Record<string, string>;
  category: string;
  ranking: RankEntry[];
  scoreByPlayer: Record<string, number>;
  breakdown: Record<string, ScoreBreakdown>;
  teamScore: number | null;
  winnerId: string | null;
  mistakesByPlayer: Record<string, number>;
  timeByPlayer: Record<string, number>;
  statusByPlayer: Record<string, BoardStatus>;
  participation: Record<string, Participation>;
  teamWon: boolean | null;
}

export interface TeamSummary {
  totalPoints: number;
  roundsWon: number;
  roundsPlayed: number;
  averageMistakes: number;
  totalTimeMs: number;
}

export interface GameView {
  id: string;
  mode: GameMode;
  status: GameStatus;
  settings: Settings;
  players: Player[];
  hostId: string | null;
  viewerId: string;
  roundIndex: number;
  totalRounds: number;
  roundStatus: RoundStatus | null;
  board: BoardView | null;
  opponents: OpponentView[];
  log: LogEntry[];
  lastResult: RoundResultView | null;
  history: RoundResultView[];
  teamScore: number;
  finalRanking: RankEntry[] | null;
  teamSummary: TeamSummary | null;
  serverNow: number;
}

export type ActionError =
  | 'invalid_letter'
  | 'already_guessed'
  | 'eliminated'
  | 'not_playing'
  | 'time_up'
  | 'hints_disabled'
  | 'no_hints_left'
  | 'hint_unavailable'
  | 'not_in_game'
  | 'rate_limited';

export type ActionResult =
  | { ok: true; correct?: boolean; letters?: string[]; roundEnded: boolean }
  | { ok: false; error: ActionError };
