// Πυρήνας παιχνιδιού: καθαρές συναρτήσεις πάνω σε ένα ταμπλό (μία λέξη).
// Χρησιμοποιούνται από όλες τις λειτουργίες (Κλασική, Μονομαχία, Συνεργατική).

import { GREEK_ALPHABET } from './alphabet';
import { isGuessable, normalizeLetter, normalizeWord, uniqueLetters } from './normalize';
import { pickRandom, shuffle, type Rng } from './rng';
import type { ActionError, Board, BoardView, HintType, Settings } from './types';

export interface CreateBoardInput {
  wordId: string;
  word: string;
  category: string;
  maxMistakes: number;
  startedAt: number;
  /** null = χωρίς χρονόμετρο. */
  durationMs: number | null;
}

export function createBoard(input: CreateBoardInput): Board {
  return {
    wordId: input.wordId,
    category: input.category,
    word: input.word,
    letters: normalizeWord(input.word),
    guessedLetters: [],
    correctLetters: [],
    incorrectLetters: [],
    eliminatedLetters: [],
    guessedBy: {},
    mistakes: 0,
    maxMistakes: input.maxMistakes,
    hintsUsed: [],
    hintPenalty: 0,
    startedAt: input.startedAt,
    deadline: input.durationMs === null ? null : input.startedAt + input.durationMs,
    finishedAt: null,
    status: 'playing',
    endReason: null,
  };
}

export function isSolved(board: Board): boolean {
  return board.letters.every((ch) => !isGuessable(ch) || board.correctLetters.includes(ch));
}

export function revealedCount(board: Board): number {
  return board.letters.filter((ch) => isGuessable(ch) && board.correctLetters.includes(ch)).length;
}

export function totalLetters(board: Board): number {
  return board.letters.filter(isGuessable).length;
}

/** Θέσεις όπου εμφανίζεται ένα γράμμα. */
export function positionsOf(board: Board, letter: string): number[] {
  const out: number[] = [];
  board.letters.forEach((ch, i) => ch === letter && out.push(i));
  return out;
}

function finish(board: Board, now: number, won: boolean, reason: Board['endReason']): void {
  board.status = won ? 'won' : 'lost';
  board.endReason = reason;
  board.finishedAt = board.deadline !== null ? Math.min(now, board.deadline) : now;
}

/** Ελέγχει τη λήξη χρόνου. Επιστρέφει true αν το ταμπλό μόλις έληξε. */
export function checkTimeout(board: Board, now: number): boolean {
  if (board.status !== 'playing' || board.deadline === null || now < board.deadline) return false;
  finish(board, board.deadline, false, 'timeout');
  return true;
}

/** Τερματίζει ένα ταμπλό που δεν ολοκληρώθηκε (π.χ. λήξη γύρου, αποχώρηση). */
export function forfeitBoard(board: Board, now: number): void {
  if (board.status !== 'playing') return;
  const timedOut = board.deadline !== null && now >= board.deadline;
  finish(board, now, false, timedOut ? 'timeout' : 'abandoned');
}

export type GuessOutcome =
  | { ok: true; letter: string; correct: boolean; positions: number[] }
  | { ok: false; error: ActionError };

/**
 * Επιλογή γράμματος. Τροποποιεί το ταμπλό. Η επανάληψη ήδη επιλεγμένου
 * γράμματος απορρίπτεται χωρίς να αφαιρείται προσπάθεια.
 */
export function guessLetter(board: Board, rawLetter: unknown, playerId: string, now: number): GuessOutcome {
  const letter = normalizeLetter(rawLetter);
  if (!letter) return { ok: false, error: 'invalid_letter' };
  if (checkTimeout(board, now)) return { ok: false, error: 'time_up' };
  if (board.status !== 'playing') return { ok: false, error: 'not_playing' };
  if (board.guessedLetters.includes(letter)) return { ok: false, error: 'already_guessed' };
  if (board.eliminatedLetters.includes(letter)) return { ok: false, error: 'eliminated' };

  board.guessedLetters.push(letter);
  board.guessedBy[letter] = playerId;
  const positions = positionsOf(board, letter);
  const correct = positions.length > 0;
  if (correct) {
    board.correctLetters.push(letter);
    if (isSolved(board)) finish(board, now, true, 'solved');
  } else {
    board.incorrectLetters.push(letter);
    board.mistakes += 1;
    if (board.mistakes >= board.maxMistakes) finish(board, now, false, 'mistakes');
  }
  return { ok: true, letter, correct, positions };
}

export type HintOutcome = { ok: true; hint: HintType; letters: string[] } | { ok: false; error: ActionError };

export function hintsRemaining(board: Board, settings: Pick<Settings, 'hintsEnabled' | 'maxHintsPerRound'>): number {
  if (!settings.hintsEnabled) return 0;
  return Math.max(0, settings.maxHintsPerRound - board.hintsUsed.length);
}

/**
 * Υποδείξεις:
 * - «reveal»: αποκαλύπτει ένα τυχαίο κρυφό γράμμα (σε όλες τις θέσεις του).
 * - «eliminate»: αφαιρεί έως 3 γράμματα που δεν υπάρχουν στη λέξη.
 * Η ποινή προστίθεται στο hintPenalty του ταμπλό.
 */
export function applyHintToBoard(
  board: Board,
  hint: HintType,
  playerId: string,
  now: number,
  settings: Pick<Settings, 'hintsEnabled' | 'maxHintsPerRound' | 'hintPenalties'>,
  rng: Rng,
): HintOutcome {
  if (!settings.hintsEnabled) return { ok: false, error: 'hints_disabled' };
  if (checkTimeout(board, now)) return { ok: false, error: 'time_up' };
  if (board.status !== 'playing') return { ok: false, error: 'not_playing' };
  if (hintsRemaining(board, settings) <= 0) return { ok: false, error: 'no_hints_left' };

  let letters: string[];
  if (hint === 'reveal') {
    const hidden = uniqueLetters(board.letters).filter((l) => !board.correctLetters.includes(l));
    if (hidden.length === 0) return { ok: false, error: 'hint_unavailable' };
    const letter = pickRandom(rng, hidden);
    board.guessedLetters.push(letter);
    board.correctLetters.push(letter);
    board.guessedBy[letter] = playerId;
    letters = [letter];
  } else if (hint === 'eliminate') {
    const inWord = new Set(board.letters);
    const candidates = GREEK_ALPHABET.filter(
      (l) => !inWord.has(l) && !board.guessedLetters.includes(l) && !board.eliminatedLetters.includes(l),
    );
    if (candidates.length === 0) return { ok: false, error: 'hint_unavailable' };
    letters = shuffle(rng, candidates).slice(0, 3);
    board.eliminatedLetters.push(...letters);
  } else {
    return { ok: false, error: 'hint_unavailable' };
  }
  board.hintsUsed.push(hint);
  board.hintPenalty += settings.hintPenalties[hint];
  if (isSolved(board)) finish(board, now, true, 'solved');
  return { ok: true, hint, letters };
}

/** Μάσκα της λέξης: null για κρυφές θέσεις. */
export function maskOf(board: Board): (string | null)[] {
  return board.letters.map((ch) => (!isGuessable(ch) || board.correctLetters.includes(ch) ? ch : null));
}

/**
 * Δημόσια προβολή ταμπλό. Η λέξη συμπεριλαμβάνεται ΜΟΝΟ αν revealWord=true
 * (δηλαδή όταν έχει ολοκληρωθεί ο γύρος).
 */
export function toBoardView(
  board: Board,
  opts: { revealWord: boolean; showGuessAuthor: boolean; settings: Pick<Settings, 'hintsEnabled' | 'maxHintsPerRound'> },
): BoardView {
  return {
    mask: opts.revealWord ? board.letters.slice() : maskOf(board),
    totalLetters: totalLetters(board),
    revealedCount: revealedCount(board),
    category: board.category,
    guessedLetters: [...board.guessedLetters],
    correctLetters: [...board.correctLetters],
    incorrectLetters: [...board.incorrectLetters],
    eliminatedLetters: [...board.eliminatedLetters],
    guessedBy: opts.showGuessAuthor ? { ...board.guessedBy } : null,
    mistakes: board.mistakes,
    maxMistakes: board.maxMistakes,
    hintsUsed: board.hintsUsed.length,
    hintsRemaining: board.status === 'playing' ? hintsRemaining(board, opts.settings) : 0,
    startedAt: board.startedAt,
    deadline: board.deadline,
    finishedAt: board.finishedAt,
    status: board.status,
    endReason: board.endReason,
    word: opts.revealWord ? board.word : null,
  };
}

/** Χρόνος ολοκλήρωσης σε ms (για ημιτελή: μέχρι τη λήξη ή το now). */
export function boardTimeMs(board: Board, now: number): number {
  const end = board.finishedAt ?? (board.deadline !== null ? Math.min(now, board.deadline) : now);
  return Math.max(0, end - board.startedAt);
}

/** Μετατόπιση χρόνων (π.χ. όταν συνεχίζεται αποθηκευμένο solo παιχνίδι). */
export function shiftBoardTimes(board: Board, deltaMs: number): void {
  board.startedAt += deltaMs;
  if (board.deadline !== null) board.deadline += deltaMs;
  if (board.finishedAt !== null) board.finishedAt += deltaMs;
}
