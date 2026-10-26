// Διαχείριση online δωματίων, ανεξάρτητη από το Socket.IO ώστε να ελέγχεται
// με unit tests. Η κρυφή λέξη υπάρχει μόνο στο ιδιωτικό αντικείμενο Game·
// στους clients στέλνεται αποκλειστικά η προβολή getView().

import {
  addBot,
  addPlayer,
  applyGuess,
  applyHint,
  createGame,
  createPlayer,
  DEFAULT_SETTINGS,
  DICTIONARY,
  getPlayer,
  getView,
  MAX_ROOM_PLAYERS,
  MIN_ROOM_PLAYERS,
  nextHost,
  nextRound,
  randomId,
  removePlayer,
  resetToLobby,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  sanitizeSettings,
  setConnection,
  startGame,
  stepGame,
  type BotLevel,
  type Dictionary,
  type Game,
  type HintType,
  type RoomError,
  type RoomInfo,
  type RoomStatePayload,
  type Rng,
  type Settings,
} from '@kremala/shared';
import { RateLimiter } from './rateLimit';

export interface Room {
  code: string;
  game: Game;
  tokens: Map<string, string>;
  createdAt: number;
  lastActivity: number;
  /** Αυτόματη έναρξη επόμενου γύρου (αν ο οικοδεσπότης δεν πατήσει). */
  autoNextAt: number | null;
  hostDisconnectedAt: number | null;
}

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: RoomError };

export interface RoomManagerOptions {
  rng?: Rng;
  dictionary?: Dictionary;
  /** Χρόνος αναμονής πριν τον αυτόματο επόμενο γύρο. */
  autoNextMs?: number;
  /** Χάρη πριν μεταβιβαστεί ο ρόλος οικοδεσπότη από αποσυνδεδεμένο. */
  hostGraceMs?: number;
  /** Αφαίρεση αποσυνδεδεμένων από το lobby μετά από… */
  lobbyDropMs?: number;
  /** Διαγραφή δωματίου χωρίς συνδεδεμένους παίκτες μετά από… */
  emptyRoomTtlMs?: number;
  rateLimit?: { capacity: number; refillPerSec: number };
}

const isValidName = (name: unknown): name is string => typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 20;

export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private rng: Rng;
  private dict: Dictionary;
  private limiter: RateLimiter;
  private opts: Required<Omit<RoomManagerOptions, 'rng' | 'dictionary' | 'rateLimit'>>;

  constructor(options: RoomManagerOptions = {}) {
    this.rng = options.rng ?? Math.random;
    this.dict = options.dictionary ?? DICTIONARY;
    this.limiter = new RateLimiter(options.rateLimit?.capacity ?? 8, options.rateLimit?.refillPerSec ?? 4);
    this.opts = {
      autoNextMs: options.autoNextMs ?? 20_000,
      hostGraceMs: options.hostGraceMs ?? 15_000,
      lobbyDropMs: options.lobbyDropMs ?? 120_000,
      emptyRoomTtlMs: options.emptyRoomTtlMs ?? 10 * 60_000,
    };
  }

  private newCode(): string {
    for (;;) {
      let code = '';
      for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_CODE_ALPHABET[Math.floor(this.rng() * ROOM_CODE_ALPHABET.length)];
      if (!this.rooms.has(code)) return code;
    }
  }

  get(code: string): Room | undefined {
    return typeof code === 'string' ? this.rooms.get(code.trim().toUpperCase()) : undefined;
  }

  create(name: unknown, settings: Partial<Settings> | undefined, now: number): Result<{ room: Room; info: RoomInfo }> {
    if (!isValidName(name)) return { ok: false, error: 'invalid_name' };
    const code = this.newCode();
    const player = createPlayer({ id: `p-${randomId(this.rng, 10)}`, displayName: name, now });
    const s = sanitizeSettings({ ...DEFAULT_SETTINGS, gameMode: 'duel', ...settings });
    const game = createGame({ id: code, settings: s, players: [player], now, hostId: player.id });
    const room: Room = { code, game, tokens: new Map(), createdAt: now, lastActivity: now, autoNextAt: null, hostDisconnectedAt: null };
    const token = randomId(this.rng, 24);
    room.tokens.set(player.id, token);
    this.rooms.set(code, room);
    return { ok: true, room, info: { code, hostId: player.id, playerId: player.id, token } };
  }

  /**
   * Είσοδος σε δωμάτιο. Με έγκυρο token γίνεται επανασύνδεση στον ίδιο
   * παίκτη, διατηρώντας σκορ και πρόοδο γύρου.
   */
  join(code: unknown, name: unknown, token: unknown, now: number): Result<{ room: Room; info: RoomInfo; reconnected: boolean }> {
    const room = this.get(code as string);
    if (!room) return { ok: false, error: 'room_not_found' };
    const game = room.game;
    if (typeof token === 'string') {
      for (const [pid, t] of room.tokens) {
        const p = getPlayer(game, pid);
        if (t === token && p && p.connectionStatus !== 'left') {
          setConnection(game, pid, 'connected', now);
          if (game.hostId === pid) room.hostDisconnectedAt = null;
          if (!game.hostId) game.hostId = pid;
          room.lastActivity = now;
          return { ok: true, room, info: { code: room.code, hostId: game.hostId, playerId: pid, token: t }, reconnected: true };
        }
      }
    }
    if (!isValidName(name)) return { ok: false, error: 'invalid_name' };
    if (game.status !== 'lobby') return { ok: false, error: 'game_in_progress' };
    if (game.players.filter((p) => p.connectionStatus !== 'left').length >= MAX_ROOM_PLAYERS) return { ok: false, error: 'room_full' };
    const player = createPlayer({ id: `p-${randomId(this.rng, 10)}`, displayName: this.uniqueName(game, name), now });
    addPlayer(game, player);
    const newToken = randomId(this.rng, 24);
    room.tokens.set(player.id, newToken);
    room.lastActivity = now;
    return { ok: true, room, info: { code: room.code, hostId: game.hostId, playerId: player.id, token: newToken }, reconnected: false };
  }

  private uniqueName(game: Game, name: string): string {
    const base = name.trim().slice(0, 18);
    const taken = new Set(game.players.map((p) => p.displayName));
    if (!taken.has(base)) return base;
    for (let i = 2; ; i++) if (!taken.has(`${base} ${i}`)) return `${base} ${i}`;
  }

  leave(room: Room, playerId: string, now: number): void {
    removePlayer(room.game, playerId, now);
    room.tokens.delete(playerId);
    this.limiter.forget(playerId);
    this.afterChange(room, now);
  }

  disconnect(room: Room, playerId: string, now: number): void {
    setConnection(room.game, playerId, 'disconnected', now);
    if (room.game.hostId === playerId) room.hostDisconnectedAt = now;
    this.afterChange(room, now);
  }

  private requireHost(room: Room, playerId: string): RoomError | null {
    return room.game.hostId === playerId ? null : 'not_host';
  }

  updateSettings(room: Room, playerId: string, settings: unknown, now: number): Result {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    // Η λειτουργία και οι κανόνες οριστικοποιούνται πριν την έναρξη.
    if (room.game.status === 'playing' || room.game.status === 'roundOver') return { ok: false, error: 'game_in_progress' };
    room.game.settings = sanitizeSettings(settings, room.game.settings);
    room.game.mode = room.game.settings.gameMode;
    room.game.updatedAt = now;
    return { ok: true };
  }

  addBot(room: Room, playerId: string, level: unknown, now: number): Result {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    if (room.game.status !== 'lobby') return { ok: false, error: 'game_in_progress' };
    if (room.game.players.length >= MAX_ROOM_PLAYERS) return { ok: false, error: 'room_full' };
    const lvl: BotLevel = level === 'easy' || level === 'hard' ? level : 'medium';
    addBot(room.game, lvl, this.rng, now);
    return { ok: true };
  }

  kick(room: Room, playerId: string, targetId: unknown, now: number): Result<{ kickedId: string }> {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    if (typeof targetId !== 'string' || targetId === playerId || !getPlayer(room.game, targetId)) return { ok: false, error: 'invalid_request' };
    this.leave(room, targetId, now);
    return { ok: true, kickedId: targetId };
  }

  start(room: Room, playerId: string, now: number): Result {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    const g = room.game;
    if (g.status === 'playing' || g.status === 'roundOver') return { ok: false, error: 'game_in_progress' };
    if (g.status === 'finished') resetToLobby(g, now);
    const active = g.players.filter((p) => p.connectionStatus === 'connected' || p.connectionStatus === 'bot');
    if (active.length < MIN_ROOM_PLAYERS) return { ok: false, error: 'not_enough_players' };
    startGame(g, now, this.rng, this.dict);
    room.autoNextAt = null;
    room.lastActivity = now;
    return { ok: true };
  }

  next(room: Room, playerId: string, now: number): Result {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    if (room.game.status !== 'roundOver') return { ok: false, error: 'not_playing' };
    nextRound(room.game, now, this.rng, this.dict);
    room.autoNextAt = null;
    return { ok: true };
  }

  backToLobby(room: Room, playerId: string, now: number): Result {
    const err = this.requireHost(room, playerId);
    if (err) return { ok: false, error: err };
    resetToLobby(room.game, now);
    room.autoNextAt = null;
    return { ok: true };
  }

  guess(room: Room, playerId: string, letter: unknown, now: number): Result<{ correct?: boolean }> {
    if (!this.limiter.take(playerId, now)) return { ok: false, error: 'rate_limited' };
    const res = applyGuess(room.game, playerId, letter, now);
    room.lastActivity = now;
    this.afterChange(room, now);
    return res.ok ? { ok: true, correct: res.correct } : res;
  }

  hint(room: Room, playerId: string, hint: unknown, now: number): Result {
    if (!this.limiter.take(playerId, now)) return { ok: false, error: 'rate_limited' };
    if (hint !== 'reveal' && hint !== 'eliminate') return { ok: false, error: 'invalid_request' };
    const res = applyHint(room.game, playerId, hint as HintType, now, this.rng);
    this.afterChange(room, now);
    return res.ok ? { ok: true } : res;
  }

  private afterChange(room: Room, now: number): void {
    if (room.game.status === 'roundOver' && room.autoNextAt === null) room.autoNextAt = now + this.opts.autoNextMs;
  }

  /**
   * Περιοδικό βήμα: χρονόμετρα, bots, αυτόματος επόμενος γύρος, μεταβίβαση
   * οικοδεσπότη και καθαρισμός. Επιστρέφει τα δωμάτια που άλλαξαν.
   */
  tick(now: number): Set<Room> {
    const changed = new Set<Room>();
    for (const room of [...this.rooms.values()]) {
      try {
        this.tickRoom(room, now, changed);
      } catch (err) {
        // Ένα σφάλμα σε ένα δωμάτιο δεν πρέπει να ρίξει ολόκληρο τον server.
        console.error(`[room ${room.code}] σφάλμα στο tick:`, err);
        changed.delete(room);
      }
    }
    return changed;
  }

  private tickRoom(room: Room, now: number, changed: Set<Room>): void {
    {
      const g = room.game;
      // Όλοι οι άνθρωποι αποχώρησαν: το δωμάτιο δεν έχει πια λόγο ύπαρξης.
      if (!g.players.some((p) => !p.isBot && p.connectionStatus !== 'left')) {
        this.rooms.delete(room.code);
        return;
      }
      if (stepGame(g, now, this.rng, this.dict).changed) changed.add(room);
      this.afterChange(room, now);
      const humanConnected = g.players.some((p) => !p.isBot && p.connectionStatus === 'connected');
      if (g.status === 'roundOver' && humanConnected && room.autoNextAt !== null && now >= room.autoNextAt) {
        nextRound(g, now, this.rng, this.dict);
        room.autoNextAt = null;
        changed.add(room);
      }
      // Μεταβίβαση οικοδεσπότη αν έχει αποσυνδεθεί για πολύ.
      const host = g.hostId ? getPlayer(g, g.hostId) : undefined;
      if (!host || host.connectionStatus === 'left' || (host.connectionStatus === 'disconnected' && room.hostDisconnectedAt !== null && now - room.hostDisconnectedAt >= this.opts.hostGraceMs)) {
        const nh = nextHost(g, host?.connectionStatus === 'connected' ? undefined : g.hostId ?? undefined);
        if (nh && nh !== g.hostId) {
          g.hostId = nh;
          room.hostDisconnectedAt = null;
          changed.add(room);
        }
      }
      // Αφαίρεση όσων έμειναν αποσυνδεδεμένοι στο lobby.
      if (g.status === 'lobby') {
        for (const p of [...g.players]) {
          if (p.connectionStatus === 'disconnected' && now - p.lastSeenAt >= this.opts.lobbyDropMs) {
            this.leave(room, p.id, now);
            changed.add(room);
          }
        }
      }
      const anyoneConnected = g.players.some((p) => p.connectionStatus === 'connected');
      if (anyoneConnected) room.lastActivity = Math.max(room.lastActivity, now - 1);
      else if (now - room.lastActivity >= this.opts.emptyRoomTtlMs) {
        this.rooms.delete(room.code);
        changed.delete(room);
      }
    }
  }

  /** Η προβολή που στέλνεται σε συγκεκριμένο παίκτη. */
  payloadFor(room: Room, playerId: string, now: number): RoomStatePayload {
    return {
      room: { code: room.code, hostId: room.game.hostId, minPlayers: MIN_ROOM_PLAYERS, maxPlayers: MAX_ROOM_PLAYERS },
      view: getView(room.game, playerId, now),
    };
  }
}
