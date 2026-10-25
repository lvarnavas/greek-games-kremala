import { beforeEach, describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createGame, createPlayer } from '@kremala/shared';
import { __resetDbForTests, clearProgress, computeStats, getKV, listGames, loadProgress, recordGame, saveProgress, setKV, type GameRecord } from '../src/lib/db';

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetDbForTests();
});

const rec = (over: Partial<GameRecord> = {}): GameRecord => ({
  gameId: 'g', finishedAt: 1, mode: 'classic', online: false, withBots: false, players: 1,
  roundsPlayed: 10, roundsWon: 7, score: 560, teamScore: null, rank: 1, bestStreak: 4, totalMistakes: 12, ...over,
});

describe('IndexedDB', () => {
  it('αποθηκεύει και ανακτά την πρόοδο solo παιχνιδιού', async () => {
    const game = createGame({ id: 'local-1', players: [createPlayer({ id: 'me', displayName: 'Ελένη', now: 0 })], now: 0 });
    game.players[0].score = 180;
    await saveProgress({ game, humanId: 'me', savedAt: 1234 });
    __resetDbForTests(); // νέα «συνεδρία» (σαν επανεκκίνηση της εφαρμογής)
    const loaded = await loadProgress();
    expect(loaded?.savedAt).toBe(1234);
    expect(loaded?.game.players[0]).toMatchObject({ displayName: 'Ελένη', score: 180 });
    await clearProgress();
    expect(await loadProgress()).toBeNull();
  });
  it('καταγράφει ολοκληρωμένα παιχνίδια και υπολογίζει στατιστικά', async () => {
    await recordGame(rec());
    await recordGame(rec({ mode: 'duel', rank: 1, score: 300, roundsWon: 3, roundsPlayed: 5, bestStreak: 2, players: 3 }));
    await recordGame(rec({ mode: 'coop', teamScore: 900, score: 900, roundsWon: 10, roundsPlayed: 10, bestStreak: 10 }));
    const games = await listGames();
    expect(games).toHaveLength(3);
    const s = computeStats(games);
    expect(s).toMatchObject({ gamesPlayed: 3, roundsPlayed: 25, roundsWon: 20, winRate: 80, bestScore: 900, bestStreak: 10, duelWins: 1 });
    expect(s.byMode.classic.games).toBe(1);
  });
  it('key/value για προτιμήσεις', async () => {
    await setKV('prefs', { theme: 'dark' });
    expect(await getKV('prefs')).toEqual({ theme: 'dark' });
  });
  it('λειτουργεί και χωρίς IndexedDB (fallback στη μνήμη)', async () => {
    // @ts-expect-error προσομοίωση περιβάλλοντος χωρίς IndexedDB
    delete globalThis.indexedDB;
    __resetDbForTests();
    await recordGame(rec());
    expect(await listGames()).toHaveLength(1);
  });
});
