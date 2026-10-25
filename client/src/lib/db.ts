// Τοπική αποθήκευση σε IndexedDB: πρόοδος solo παιχνιδιού, ιστορικό και
// προτιμήσεις. Αν το IndexedDB δεν είναι διαθέσιμο (π.χ. ιδιωτική
// περιήγηση), χρησιμοποιείται μνήμη ώστε η εφαρμογή να λειτουργεί κανονικά.

import type { Game, GameMode } from '@kremala/shared';

const DB_NAME = 'kremala';
const DB_VERSION = 1;
const STORES = { progress: 'progress', games: 'games', kv: 'kv' } as const;

export interface SavedProgress {
  game: Game;
  humanId: string;
  savedAt: number;
}

export interface GameRecord {
  id?: number;
  gameId: string;
  finishedAt: number;
  mode: GameMode;
  online: boolean;
  withBots: boolean;
  players: number;
  roundsPlayed: number;
  roundsWon: number;
  score: number;
  teamScore: number | null;
  rank: number | null;
  bestStreak: number;
  totalMistakes: number;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory = { progress: new Map<string, unknown>(), games: [] as GameRecord[], kv: new Map<string, unknown>() };

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.progress)) db.createObjectStore(STORES.progress);
        if (!db.objectStoreNames.contains(STORES.games)) db.createObjectStore(STORES.games, { keyPath: 'id', autoIncrement: true });
        if (!db.objectStoreNames.contains(STORES.kv)) db.createObjectStore(STORES.kv);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const req = fn(db.transaction(store, mode).objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));

export async function saveProgress(p: SavedProgress): Promise<void> {
  const data = clone(p);
  memory.progress.set('current', data);
  await run(STORES.progress, 'readwrite', (s) => s.put(data, 'current'));
}

export async function loadProgress(): Promise<SavedProgress | null> {
  const db = await open();
  if (!db) return (memory.progress.get('current') as SavedProgress) ?? null;
  return ((await run<SavedProgress>(STORES.progress, 'readonly', (s) => s.get('current'))) as SavedProgress) ?? null;
}

export async function clearProgress(): Promise<void> {
  memory.progress.delete('current');
  await run(STORES.progress, 'readwrite', (s) => s.delete('current'));
}

export async function recordGame(rec: GameRecord): Promise<void> {
  const db = await open();
  const data = clone(rec);
  delete data.id;
  if (!db) {
    memory.games.push({ ...data, id: memory.games.length + 1 });
    return;
  }
  await run(STORES.games, 'readwrite', (s) => s.add(data));
}

export async function listGames(): Promise<GameRecord[]> {
  const db = await open();
  if (!db) return [...memory.games];
  return ((await run<GameRecord[]>(STORES.games, 'readonly', (s) => s.getAll())) as GameRecord[]) ?? [];
}

export async function clearGames(): Promise<void> {
  memory.games = [];
  await run(STORES.games, 'readwrite', (s) => s.clear());
}

export async function getKV<T>(key: string): Promise<T | undefined> {
  const db = await open();
  if (!db) return memory.kv.get(key) as T | undefined;
  return (await run<T>(STORES.kv, 'readonly', (s) => s.get(key))) as T | undefined;
}

export async function setKV<T>(key: string, value: T): Promise<void> {
  memory.kv.set(key, clone(value));
  await run(STORES.kv, 'readwrite', (s) => s.put(clone(value), key));
}

export interface Stats {
  gamesPlayed: number;
  roundsPlayed: number;
  roundsWon: number;
  winRate: number;
  bestScore: number;
  bestStreak: number;
  byMode: Record<GameMode, { games: number; roundsWon: number; roundsPlayed: number; points: number }>;
  duelWins: number;
  recent: GameRecord[];
}

export function computeStats(games: GameRecord[]): Stats {
  const byMode: Stats['byMode'] = {
    classic: { games: 0, roundsWon: 0, roundsPlayed: 0, points: 0 },
    duel: { games: 0, roundsWon: 0, roundsPlayed: 0, points: 0 },
    coop: { games: 0, roundsWon: 0, roundsPlayed: 0, points: 0 },
  };
  let roundsPlayed = 0, roundsWon = 0, bestScore = 0, bestStreak = 0, duelWins = 0;
  for (const g of games) {
    const m = byMode[g.mode];
    m.games += 1;
    m.roundsPlayed += g.roundsPlayed;
    m.roundsWon += g.roundsWon;
    m.points += g.mode === 'coop' ? (g.teamScore ?? 0) : g.score;
    roundsPlayed += g.roundsPlayed;
    roundsWon += g.roundsWon;
    bestScore = Math.max(bestScore, g.mode === 'coop' ? (g.teamScore ?? 0) : g.score);
    bestStreak = Math.max(bestStreak, g.bestStreak);
    if (g.mode === 'duel' && g.rank === 1) duelWins += 1;
  }
  return {
    gamesPlayed: games.length,
    roundsPlayed,
    roundsWon,
    winRate: roundsPlayed ? Math.round((roundsWon / roundsPlayed) * 100) : 0,
    bestScore,
    bestStreak,
    byMode,
    duelWins,
    recent: [...games].sort((a, b) => b.finishedAt - a.finishedAt).slice(0, 10),
  };
}

/** Μόνο για tests: επαναφορά της σύνδεσης. */
export function __resetDbForTests(): void {
  dbPromise = null;
  memory.progress.clear();
  memory.games = [];
  memory.kv.clear();
}
