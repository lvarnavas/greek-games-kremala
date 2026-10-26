// Κοινό game engine για όλες τις λειτουργίες. Χρησιμοποιείται αυτούσιο από
// τον server (online δωμάτια) και από τον client (solo / bots / offline).
// Οι συναρτήσεις τροποποιούν το αντικείμενο Game· η αποθήκευσή του είναι
// ευθύνη του καλούντος (μνήμη server ή IndexedDB στον client).

import {
  applyHintToBoard,
  boardTimeMs,
  checkTimeout,
  createBoard,
  forfeitBoard,
  guessLetter,
  revealedCount,
  shiftBoardTimes,
  toBoardView,
  totalLetters,
} from './board';
import { BOT_NAMES, botDelay, chooseBotHint, chooseBotLetter } from './bots';
import { DICTIONARY, pickEquivalentWords, pickWord, type Dictionary, type WordEntry } from './dictionary';
import { compareTotals, rankResults, roundWinner, type RankInput } from './ranking';
import { randomId, type Rng } from './rng';
import { COOP_INDIVIDUAL_POINTS_PER_LETTER, computeScore } from './scoring';
import { DEFAULT_SETTINGS } from './settings';
import {
  TEAM_BOARD,
  type ActionResult,
  type Board,
  type BotLevel,
  type Game,
  type GameView,
  type HintType,
  type LogEntry,
  type OpponentView,
  type Participation,
  type Player,
  type RankEntry,
  type Round,
  type RoundResultView,
  type Settings,
  type TeamSummary,
} from './types';

const MAX_LOG = 60;

// ---------------------------------------------------------------- Παίκτες

export function createPlayer(opts: { id: string; displayName: string; now: number; botLevel?: BotLevel }): Player {
  return {
    id: opts.id,
    displayName: opts.displayName.trim().slice(0, 20) || 'Παίκτης',
    score: 0,
    wins: 0,
    losses: 0,
    streak: 0,
    connectionStatus: opts.botLevel ? 'bot' : 'connected',
    lastSeenAt: opts.now,
    isBot: opts.botLevel ? true : undefined,
    botLevel: opts.botLevel,
    joinedAt: opts.now,
  };
}

export function createGame(opts: { id: string; settings?: Partial<Settings>; players?: Player[]; now: number; hostId?: string | null }): Game {
  const settings: Settings = { ...DEFAULT_SETTINGS, ...opts.settings };
  return {
    id: opts.id,
    mode: settings.gameMode,
    status: 'lobby',
    settings,
    players: opts.players ?? [],
    currentRound: null,
    roundHistory: [],
    createdAt: opts.now,
    updatedAt: opts.now,
    teamScore: 0,
    hostId: opts.hostId ?? opts.players?.[0]?.id ?? null,
    bots: {},
    usedWordIds: [],
  };
}

export function getPlayer(game: Game, id: string): Player | undefined {
  return game.players.find((p) => p.id === id);
}

export function addPlayer(game: Game, player: Player): void {
  if (getPlayer(game, player.id)) return;
  game.players.push(player);
  if (player.isBot && player.botLevel) game.bots[player.id] = { level: player.botLevel, nextActionAt: 0 };
  if (!game.hostId && !player.isBot) game.hostId = player.id;
}

/** Προσθέτει bot με ελληνικό όνομα που δεν χρησιμοποιείται ήδη. */
export function addBot(game: Game, level: BotLevel, rng: Rng, now: number): Player {
  const used = new Set(game.players.map((p) => p.displayName));
  const free = BOT_NAMES.filter((n) => !used.has(n));
  const name = free.length > 0 ? free[Math.floor(rng() * free.length)] : `Bot ${game.players.length + 1}`;
  const bot = createPlayer({ id: `bot-${randomId(rng, 8)}`, displayName: name, now, botLevel: level });
  addPlayer(game, bot);
  return bot;
}

/** Ενεργός = συνδεδεμένος άνθρωπος ή bot. */
export function isActive(p: Player): boolean {
  return p.connectionStatus === 'connected' || p.connectionStatus === 'bot';
}

export function setConnection(game: Game, playerId: string, status: Player['connectionStatus'], now: number): void {
  const p = getPlayer(game, playerId);
  if (!p) return;
  p.connectionStatus = status;
  p.lastSeenAt = now;
  game.updatedAt = now;
}

/**
 * Αφαίρεση παίκτη: στο lobby διαγράφεται· κατά τη διάρκεια παιχνιδιού
 * σημειώνεται ως «left» και το ταμπλό του τερματίζεται (δεν μπλοκάρει τον γύρο).
 */
export function removePlayer(game: Game, playerId: string, now: number): void {
  if (game.status === 'lobby') {
    game.players = game.players.filter((p) => p.id !== playerId);
    delete game.bots[playerId];
  } else {
    setConnection(game, playerId, 'left', now);
    const board = game.currentRound?.boards[playerId];
    if (board && game.currentRound?.status === 'playing') forfeitBoard(board, now);
  }
  if (game.hostId === playerId) game.hostId = nextHost(game);
}

/** Επόμενος οικοδεσπότης: ο αρχαιότερος συνδεδεμένος άνθρωπος. */
export function nextHost(game: Game, excludeId?: string): string | null {
  const humans = game.players
    .filter((p) => !p.isBot && p.connectionStatus === 'connected' && p.id !== excludeId)
    .sort((a, b) => a.joinedAt - b.joinedAt);
  return humans[0]?.id ?? null;
}

// ---------------------------------------------------------------- Γύροι

export function boardKeyFor(game: Game, playerId: string): string {
  return game.mode === 'coop' ? TEAM_BOARD : playerId;
}

export function boardFor(game: Game, playerId: string): Board | undefined {
  return game.currentRound?.boards[boardKeyFor(game, playerId)];
}

/**
 * Επιλέγει λέξεις για τον επόμενο γύρο, ανά ταμπλό:
 * - Συνεργατική: μία κοινή λέξη.
 * - Μονομαχία «same»: ίδια λέξη για όλους· «equivalent»: ισοδύναμες λέξεις.
 * - Κλασική: ανεξάρτητη τυχαία λέξη για κάθε παίκτη.
 */
export function selectRoundWords(game: Game, rng: Rng, dict: Dictionary = DICTIONARY): Record<string, WordEntry> {
  const s = game.settings;
  const exclude = new Set(game.usedWordIds);
  const filter = { categories: s.categories, difficulty: s.difficulty };
  const participants = game.players.filter((p) => p.connectionStatus !== 'left');
  if (game.mode === 'coop') return { [TEAM_BOARD]: pickWord(dict, filter, rng, exclude) };
  if (game.mode === 'duel') {
    const base = pickWord(dict, filter, rng, exclude);
    if (s.wordMode === 'same') return Object.fromEntries(participants.map((p) => [p.id, base]));
    const words = pickEquivalentWords(dict, base, participants.length, rng, { categories: s.categories, exclude });
    return Object.fromEntries(participants.map((p, i) => [p.id, words[i]]));
  }
  const out: Record<string, WordEntry> = {};
  for (const p of participants) {
    const w = pickWord(dict, filter, rng, exclude);
    exclude.add(w.id);
    out[p.id] = w;
  }
  return out;
}

function emptyParticipation(): Participation {
  return { proposed: 0, correct: 0, incorrect: 0, hints: 0 };
}

/** Υπάρχει τουλάχιστον ένας παίκτης που δεν έχει αποχωρήσει. */
export function hasParticipants(game: Game): boolean {
  return game.players.some((p) => p.connectionStatus !== 'left');
}

export function startRound(game: Game, words: Record<string, WordEntry>, now: number, rng: Rng): Round {
  if (Object.keys(words).length === 0) throw new Error('Δεν υπάρχουν παίκτες για νέο γύρο');
  const s = game.settings;
  const participants = game.players.filter((p) => p.connectionStatus !== 'left').map((p) => p.id);
  const durationMs = s.timerEnabled ? s.roundDuration * 1000 : null;
  const boards: Record<string, Board> = {};
  for (const [key, w] of Object.entries(words)) {
    boards[key] = createBoard({ wordId: w.id, word: w.word, category: w.category, maxMistakes: s.maxMistakes, startedAt: now, durationMs });
  }
  const first = Object.values(words)[0];
  for (const w of Object.values(words)) if (!game.usedWordIds.includes(w.id)) game.usedWordIds.push(w.id);
  const round: Round = {
    id: `${game.id}-r${game.roundHistory.length + 1}`,
    index: game.roundHistory.length + 1,
    mode: game.mode,
    wordId: first.id,
    category: first.category,
    guessedLetters: [],
    correctLetters: [],
    incorrectLetters: [],
    mistakes: 0,
    maxMistakes: s.maxMistakes,
    startedAt: now,
    deadline: durationMs === null ? null : now + durationMs,
    finishedAt: null,
    status: 'playing',
    participants,
    winnerId: null,
    scoreByPlayer: {},
    teamScore: null,
    boards,
    breakdown: {},
    ranking: [],
    participation: Object.fromEntries(participants.map((id) => [id, emptyParticipation()])),
    log: [],
  };
  game.currentRound = round;
  game.status = 'playing';
  game.updatedAt = now;
  for (const [id, bot] of Object.entries(game.bots)) bot.nextActionAt = now + botDelay(bot.level, rng) + 600;
  return round;
}

/** Ξεκινά νέο παιχνίδι: μηδενίζει σκορ και ιστορικό, κλειδώνει τη λειτουργία. */
export function startGame(game: Game, now: number, rng: Rng, dict: Dictionary = DICTIONARY): Round {
  game.mode = game.settings.gameMode;
  game.roundHistory = [];
  game.teamScore = 0;
  game.usedWordIds = [];
  game.currentRound = null;
  for (const p of game.players) Object.assign(p, { score: 0, wins: 0, losses: 0, streak: 0 });
  return startRound(game, selectRoundWords(game, rng, dict), now, rng);
}

export function nextRound(game: Game, now: number, rng: Rng, dict: Dictionary = DICTIONARY): Round | null {
  if (game.status !== 'roundOver' || !hasParticipants(game)) return null;
  return startRound(game, selectRoundWords(game, rng, dict), now, rng);
}

/** Επιστροφή στο lobby (π.χ. «Νέο παιχνίδι» στο online δωμάτιο). */
export function resetToLobby(game: Game, now: number): void {
  game.status = 'lobby';
  game.currentRound = null;
  game.roundHistory = [];
  game.teamScore = 0;
  game.players = game.players.filter((p) => p.connectionStatus !== 'left');
  for (const p of game.players) Object.assign(p, { score: 0, wins: 0, losses: 0, streak: 0 });
  game.updatedAt = now;
}

function pushLog(round: Round, entry: LogEntry): void {
  round.log.push(entry);
  if (round.log.length > MAX_LOG) round.log.splice(0, round.log.length - MAX_LOG);
}

function canAct(game: Game, playerId: string): Board | null {
  const round = game.currentRound;
  if (!round || round.status !== 'playing' || game.status !== 'playing') return null;
  if (!round.participants.includes(playerId)) return null;
  const p = getPlayer(game, playerId);
  if (!p || p.connectionStatus === 'left') return null;
  return boardFor(game, playerId) ?? null;
}

function afterBoardAction(game: Game, playerId: string, board: Board, now: number): boolean {
  const round = game.currentRound!;
  if (board.status !== 'playing' && game.mode !== 'coop') {
    pushLog(round, { at: now, type: 'finished', playerId, won: board.status === 'won' });
  }
  game.updatedAt = now;
  if (isRoundComplete(game)) {
    finishRound(game, now);
    return true;
  }
  return false;
}

/**
 * Επιλογή γράμματος από παίκτη. Ο server (ή ο local controller) επεξεργάζεται
 * τις ενέργειες σειριακά: αν δύο παίκτες στείλουν το ίδιο γράμμα στη
 * Συνεργατική, μόνο η πρώτη γίνεται δεκτή και η δεύτερη απορρίπτεται ως
 * «already_guessed» χωρίς να αφαιρεθεί προσπάθεια.
 */
export function applyGuess(game: Game, playerId: string, letter: unknown, now: number): ActionResult {
  const board = canAct(game, playerId);
  if (!board) return { ok: false, error: game.currentRound?.status === 'playing' ? 'not_in_game' : 'not_playing' };
  const res = guessLetter(board, letter, playerId, now);
  if (!res.ok) {
    if (res.error === 'time_up') afterBoardAction(game, playerId, board, now);
    return res;
  }
  const round = game.currentRound!;
  const part = (round.participation[playerId] ??= emptyParticipation());
  part.proposed += 1;
  if (res.correct) part.correct += 1;
  else part.incorrect += 1;
  if (game.mode === 'coop') pushLog(round, { at: now, type: 'guess', playerId, letter: res.letter, correct: res.correct });
  const roundEnded = afterBoardAction(game, playerId, board, now);
  return { ok: true, correct: res.correct, letters: [res.letter], roundEnded };
}

export function applyHint(game: Game, playerId: string, hint: HintType, now: number, rng: Rng): ActionResult {
  const board = canAct(game, playerId);
  if (!board) return { ok: false, error: 'not_playing' };
  const res = applyHintToBoard(board, hint, playerId, now, game.settings, rng);
  if (!res.ok) return res;
  const round = game.currentRound!;
  (round.participation[playerId] ??= emptyParticipation()).hints += 1;
  if (game.mode === 'coop') pushLog(round, { at: now, type: 'hint', playerId, hint, letters: res.letters });
  const roundEnded = afterBoardAction(game, playerId, board, now);
  return { ok: true, letters: res.letters, roundEnded };
}

/**
 * Ο γύρος ολοκληρώνεται όταν:
 * - Συνεργατική: το κοινό ταμπλό έληξε (νίκη, λάθη ή χρόνος).
 * - Αλλιώς: όλοι οι ενεργοί παίκτες έχουν τελειώσει (ή όλα τα ταμπλό έχουν λήξει).
 */
export function isRoundComplete(game: Game): boolean {
  const round = game.currentRound;
  if (!round || round.status !== 'playing') return false;
  if (game.mode === 'coop') return round.boards[TEAM_BOARD].status !== 'playing';
  const boards = Object.entries(round.boards);
  if (boards.every(([, b]) => b.status !== 'playing')) return true;
  const active = boards.filter(([id]) => {
    const p = getPlayer(game, id);
    return p && isActive(p);
  });
  return active.length > 0 && active.every(([, b]) => b.status !== 'playing');
}

export function finishRound(game: Game, now: number): Round | null {
  const round = game.currentRound;
  if (!round || round.status !== 'playing') return null;
  let timedOut = false;
  for (const b of Object.values(round.boards)) {
    if (checkTimeout(b, now)) timedOut = true;
    forfeitBoard(b, now);
  }
  if (timedOut) pushLog(round, { at: now, type: 'timeout' });
  const s = game.settings;

  if (game.mode === 'coop') {
    const team = round.boards[TEAM_BOARD];
    const br = computeScore(team, s);
    round.breakdown[TEAM_BOARD] = br;
    round.teamScore = br.total;
    game.teamScore += br.total;
    const won = team.status === 'won';
    for (const id of round.participants) {
      const p = getPlayer(game, id);
      const individual = s.coopScoring === 'teamPlusIndividual' ? (round.participation[id]?.correct ?? 0) * COOP_INDIVIDUAL_POINTS_PER_LETTER : 0;
      round.scoreByPlayer[id] = br.total + individual;
      if (p) applyOutcome(p, won, round.scoreByPlayer[id]);
    }
    Object.assign(round, {
      guessedLetters: [...team.guessedLetters],
      correctLetters: [...team.correctLetters],
      incorrectLetters: [...team.incorrectLetters],
      mistakes: team.mistakes,
    });
  } else {
    const inputs: RankInput[] = [];
    for (const [id, b] of Object.entries(round.boards)) {
      const br = computeScore(b, s);
      round.breakdown[id] = br;
      round.scoreByPlayer[id] = br.total;
      inputs.push({ playerId: id, won: b.status === 'won', points: br.total, mistakes: b.mistakes, timeMs: boardTimeMs(b, now) });
    }
    round.ranking = rankResults(inputs);
    round.winnerId = game.mode === 'duel' ? roundWinner(round.ranking) : null;
    for (const [id, b] of Object.entries(round.boards)) {
      const p = getPlayer(game, id);
      if (!p) continue;
      const won = game.mode === 'duel' ? round.winnerId === id : b.status === 'won';
      applyOutcome(p, won, round.scoreByPlayer[id]);
    }
    const all = Object.values(round.boards);
    round.guessedLetters = [...new Set(all.flatMap((b) => b.guessedLetters))];
    round.correctLetters = [...new Set(all.flatMap((b) => b.correctLetters))];
    round.incorrectLetters = [...new Set(all.flatMap((b) => b.incorrectLetters))];
    round.mistakes = all.reduce((n, b) => n + b.mistakes, 0);
  }

  round.status = 'finished';
  round.finishedAt = now;
  game.roundHistory.push(round);
  game.status = isGameOver(game) ? 'finished' : 'roundOver';
  game.updatedAt = now;
  return round;
}

function applyOutcome(p: Player, won: boolean, points: number): void {
  p.score += points;
  if (won) {
    p.wins += 1;
    p.streak += 1;
  } else {
    p.losses += 1;
    p.streak = 0;
  }
}

export function isGameOver(game: Game): boolean {
  const s = game.settings;
  if (game.roundHistory.length >= s.totalRounds) return true;
  if (s.targetScore > 0) {
    if (game.mode === 'coop') return game.teamScore >= s.targetScore;
    return game.players.some((p) => p.score >= s.targetScore);
  }
  return false;
}

// ---------------------------------------------------------------- Βήμα χρόνου / bots

/**
 * Ένα «βήμα» του παιχνιδιού: λήξεις χρόνου, ενέργειες bots, ολοκλήρωση γύρου.
 * Καλείται περιοδικά από τον server και από τον local controller.
 */
export function stepGame(game: Game, now: number, rng: Rng, dict: Dictionary = DICTIONARY): { changed: boolean; roundEnded: boolean } {
  const round = game.currentRound;
  if (!round || round.status !== 'playing' || game.status !== 'playing') return { changed: false, roundEnded: false };
  let changed = false;
  for (const [id, b] of Object.entries(round.boards)) {
    if (checkTimeout(b, now)) {
      changed = true;
      if (game.mode !== 'coop') pushLog(round, { at: now, type: 'finished', playerId: id, won: false });
    }
  }
  if (isRoundComplete(game)) {
    finishRound(game, now);
    return { changed: true, roundEnded: true };
  }
  for (const [id, bot] of Object.entries(game.bots)) {
    const player = getPlayer(game, id);
    if (!player || player.connectionStatus === 'left' || !round.participants.includes(id)) continue;
    if (now < bot.nextActionAt) continue;
    const board = boardFor(game, id);
    if (!board || board.status !== 'playing') continue;
    bot.nextActionAt = now + botDelay(bot.level, rng);
    // Το bot βλέπει μόνο τη δημόσια προβολή (χωρίς τη λέξη).
    const view = toBoardView(board, { revealWord: false, showGuessAuthor: false, settings: game.settings });
    const hint = chooseBotHint(view, bot.level, game.settings.hintsEnabled && game.settings.botsUseHints, rng);
    const res = hint ? applyHint(game, id, hint, now, rng) : null;
    if (!res || !res.ok) {
      const letter = chooseBotLetter(view, bot.level, rng, dict);
      if (letter) applyGuess(game, id, letter, now);
    }
    changed = true;
    if (game.currentRound?.status !== 'playing') return { changed: true, roundEnded: true };
  }
  return { changed, roundEnded: false };
}

/** Μετατοπίζει όλους τους χρόνους (συνέχιση αποθηκευμένου solo παιχνιδιού). */
export function shiftGameTimes(game: Game, deltaMs: number): void {
  const r = game.currentRound;
  if (!r || r.status !== 'playing') return;
  r.startedAt += deltaMs;
  if (r.deadline !== null) r.deadline += deltaMs;
  for (const b of Object.values(r.boards)) shiftBoardTimes(b, deltaMs);
  for (const bot of Object.values(game.bots)) bot.nextActionAt += deltaMs;
}

// ---------------------------------------------------------------- Προβολές

export function roundResultView(game: Game, round: Round): RoundResultView {
  const words: Record<string, string> = {};
  const mistakesByPlayer: Record<string, number> = {};
  const timeByPlayer: Record<string, number> = {};
  const statusByPlayer: RoundResultView['statusByPlayer'] = {};
  const end = round.finishedAt ?? round.startedAt;
  for (const [key, b] of Object.entries(round.boards)) words[key] = b.word;
  for (const id of round.participants) {
    const b = round.boards[round.mode === 'coop' ? TEAM_BOARD : id];
    if (!b) continue;
    mistakesByPlayer[id] = b.mistakes;
    timeByPlayer[id] = boardTimeMs(b, end);
    statusByPlayer[id] = b.status;
  }
  return {
    index: round.index,
    words,
    category: round.category,
    ranking: round.ranking,
    scoreByPlayer: { ...round.scoreByPlayer },
    breakdown: { ...round.breakdown },
    teamScore: round.teamScore,
    winnerId: round.winnerId,
    mistakesByPlayer,
    timeByPlayer,
    statusByPlayer,
    participation: { ...round.participation },
    teamWon: round.mode === 'coop' ? round.boards[TEAM_BOARD].status === 'won' : null,
  };
}

/** Συνολική κατάταξη παικτών (πόντοι, νίκες, λάθη, χρόνος). */
export function standings(game: Game): RankEntry[] {
  const inputs = game.players
    .filter((p) => p.connectionStatus !== 'left' || game.roundHistory.some((r) => r.participants.includes(p.id)))
    .map((p) => {
      let mistakes = 0, timeMs = 0;
      for (const r of game.roundHistory) {
        const b = r.boards[r.mode === 'coop' ? TEAM_BOARD : p.id];
        if (!b || !r.participants.includes(p.id)) continue;
        mistakes += b.mistakes;
        timeMs += boardTimeMs(b, r.finishedAt ?? r.startedAt);
      }
      return { playerId: p.id, won: false, points: p.score, mistakes, timeMs, wins: p.wins } as RankInput;
    });
  return rankResults(inputs, compareTotals);
}

export function teamSummary(game: Game): TeamSummary {
  const rounds = game.roundHistory.filter((r) => r.mode === 'coop');
  const boards = rounds.map((r) => r.boards[TEAM_BOARD]);
  return {
    totalPoints: game.teamScore,
    roundsWon: boards.filter((b) => b.status === 'won').length,
    roundsPlayed: rounds.length,
    averageMistakes: boards.length ? Math.round((boards.reduce((n, b) => n + b.mistakes, 0) / boards.length) * 10) / 10 : 0,
    totalTimeMs: rounds.reduce((n, r) => n + boardTimeMs(r.boards[TEAM_BOARD], r.finishedAt ?? r.startedAt), 0),
  };
}

/**
 * Προβολή του παιχνιδιού για συγκεκριμένο παίκτη. ΔΕΝ περιέχει την κρυφή
 * λέξη όσο ο γύρος παίζεται, ούτε τα γράμματα των αντιπάλων (εκτός αν το
 * επιτρέπει η ρύθμιση «full»).
 */
export function getView(game: Game, viewerId: string, now: number): GameView {
  const round = game.currentRound;
  const finished = round?.status === 'finished';
  const s = game.settings;
  const own = round ? round.boards[boardKeyFor(game, viewerId)] : undefined;
  const opponents: OpponentView[] = [];
  if (round && game.mode !== 'coop' && (s.showOpponentProgress !== 'hidden' || finished)) {
    for (const [id, b] of Object.entries(round.boards)) {
      if (id === viewerId) continue;
      const o: OpponentView = {
        playerId: id,
        revealedCount: revealedCount(b),
        totalLetters: totalLetters(b),
        mistakes: b.mistakes,
        maxMistakes: b.maxMistakes,
        status: b.status,
        finishedAt: b.finishedAt,
      };
      if (s.showOpponentProgress === 'full' || finished) {
        o.correctLetters = [...b.correctLetters];
        o.incorrectLetters = [...b.incorrectLetters];
      }
      opponents.push(o);
    }
  }
  const log = round ? (game.mode === 'coop' ? round.log : round.log.filter((e) => e.type !== 'guess' && e.type !== 'hint')) : [];
  return {
    id: game.id,
    mode: game.mode,
    status: game.status,
    settings: s,
    players: game.players.map((p) => ({ ...p })),
    hostId: game.hostId,
    viewerId,
    roundIndex: round?.index ?? 0,
    totalRounds: s.totalRounds,
    roundStatus: round?.status ?? null,
    board: own ? toBoardView(own, { revealWord: finished, showGuessAuthor: game.mode === 'coop' && s.showGuessAuthor, settings: s }) : null,
    opponents,
    log: log.map((e) => ({ ...e })),
    lastResult: round && finished ? roundResultView(game, round) : null,
    history: game.roundHistory.map((r) => roundResultView(game, r)),
    teamScore: game.teamScore,
    finalRanking: game.mode === 'coop' ? null : standings(game),
    teamSummary: game.mode === 'coop' ? teamSummary(game) : null,
    serverNow: now,
  };
}
