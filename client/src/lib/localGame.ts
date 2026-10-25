// Τοπικός controller για Κλασική / Μονομαχία / Συνεργατική με bots.
// Τρέχει εξ ολοκλήρου στον browser με το κοινό game engine — δεν απαιτεί
// σύνδεση στο διαδίκτυο. Η πρόοδος αποθηκεύεται στο IndexedDB.

import {
  addBot,
  applyGuess,
  applyHint,
  createGame,
  createPlayer,
  getView,
  nextRound,
  shiftGameTimes,
  startGame,
  stepGame,
  type ActionResult,
  type BotLevel,
  type Game,
  type GameView,
  type HintType,
  type Rng,
  type Settings,
} from '@kremala/shared';
import { clearProgress, recordGame, saveProgress, type SavedProgress } from './db';
import { recordFromView } from './record';

export const HUMAN_ID = 'me';

export interface LocalGameOptions {
  settings: Settings;
  playerName: string;
  bots: BotLevel[];
  rng?: Rng;
  now?: () => number;
  persist?: boolean;
}

type Listener = (view: GameView) => void;

export class LocalGameController {
  game: Game;
  paused = false;
  private pausedAt = 0;
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private rng: Rng;
  private now: () => number;
  private persist: boolean;
  private recorded = false;

  private constructor(game: Game, opts: { rng?: Rng; now?: () => number; persist?: boolean }) {
    this.game = game;
    this.rng = opts.rng ?? Math.random;
    this.now = opts.now ?? Date.now;
    this.persist = opts.persist ?? true;
  }

  static create(opts: LocalGameOptions): LocalGameController {
    const now = (opts.now ?? Date.now)();
    const human = createPlayer({ id: HUMAN_ID, displayName: opts.playerName || 'Εγώ', now });
    const game = createGame({ id: `local-${now.toString(36)}`, settings: opts.settings, players: [human], now, hostId: HUMAN_ID });
    const c = new LocalGameController(game, opts);
    if (opts.settings.gameMode !== 'classic') for (const level of opts.bots) addBot(game, level, c.rng, now);
    startGame(game, now, c.rng);
    void c.save();
    return c;
  }

  /** Συνέχιση αποθηκευμένου παιχνιδιού: ο χρόνος «παγώνει» όσο ήταν κλειστό. */
  static restore(saved: SavedProgress, opts: { rng?: Rng; now?: () => number; persist?: boolean } = {}): LocalGameController {
    const c = new LocalGameController(saved.game, opts);
    shiftGameTimes(c.game, c.now() - saved.savedAt);
    return c;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 200);
  }

  dispose(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.view());
    return () => this.listeners.delete(fn);
  }

  view(): GameView {
    return getView(this.game, HUMAN_ID, this.paused ? this.pausedAt : this.now());
  }

  tick(): void {
    if (this.paused) return;
    const res = stepGame(this.game, this.now(), this.rng);
    if (res.changed) this.changed();
  }

  guess(letter: string): ActionResult {
    if (this.paused) return { ok: false, error: 'not_playing' };
    const res = applyGuess(this.game, HUMAN_ID, letter, this.now());
    if (res.ok || res.error === 'time_up') this.changed();
    return res;
  }

  hint(type: HintType): ActionResult {
    if (this.paused) return { ok: false, error: 'not_playing' };
    const res = applyHint(this.game, HUMAN_ID, type, this.now(), this.rng);
    if (res.ok) this.changed();
    return res;
  }

  next(): void {
    if (nextRound(this.game, this.now(), this.rng)) this.changed();
  }

  restart(): void {
    startGame(this.game, this.now(), this.rng);
    this.recorded = false;
    this.changed();
  }

  pause(): void {
    if (this.paused || this.game.status !== 'playing') return;
    this.paused = true;
    this.pausedAt = this.now();
    this.changed();
  }

  resume(): void {
    if (!this.paused) return;
    shiftGameTimes(this.game, this.now() - this.pausedAt);
    this.paused = false;
    this.changed();
  }

  private changed(): void {
    const v = this.view();
    for (const l of this.listeners) l(v);
    void this.save();
  }

  async save(): Promise<void> {
    if (!this.persist) return;
    if (this.game.status === 'finished') {
      if (!this.recorded) {
        this.recorded = true;
        await recordGame(recordFromView(this.view(), { online: false }));
      }
      await clearProgress();
      return;
    }
    await saveProgress({ game: this.game, humanId: HUMAN_ID, savedAt: this.paused ? this.pausedAt : this.now() });
  }
}
