import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { DEFAULT_SETTINGS, seededRng, TEAM_BOARD } from '@kremala/shared';
import { HUMAN_ID, LocalGameController } from '../src/lib/localGame';
import { __resetDbForTests, listGames, loadProgress } from '../src/lib/db';

let clock = 0;
const now = () => clock;

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
  __resetDbForTests();
  clock = 1_000_000;
  // Offline: κανένα δίκτυο δεν επιτρέπεται.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
});
afterEach(() => vi.unstubAllGlobals());

/** Λύνει την τρέχουσα λέξη «κλέβοντας» από το ιδιωτικό ταμπλό (μόνο για test). */
function solve(c: LocalGameController) {
  const letters = new Set(c.game.currentRound!.boards[HUMAN_ID].letters);
  for (const l of letters) c.guess(l);
}

describe('Τοπικό παιχνίδι (offline)', () => {
  it('Κλασική Κρεμάλα: ολόκληρο παιχνίδι χωρίς δίκτυο, με καταγραφή στατιστικών', async () => {
    const c = LocalGameController.create({ settings: { ...DEFAULT_SETTINGS, totalRounds: 3 }, playerName: 'Ελένη', bots: [], rng: seededRng(1), now });
    expect(navigator.onLine).toBe(false);
    for (let r = 0; r < 3; r++) {
      solve(c);
      expect(c.view().lastResult?.statusByPlayer[HUMAN_ID]).toBe('won');
      if (r < 2) c.next();
    }
    expect(c.view().status).toBe('finished');
    expect(c.view().players[0].score).toBe(300);
    await c.save();
    const games = await listGames();
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({ mode: 'classic', roundsWon: 3, score: 300, online: false });
    expect(await loadProgress()).toBeNull();
  });

  it('η πρόοδος αποθηκεύεται και ανακτάται, με «πάγωμα» του χρόνου', async () => {
    const c = LocalGameController.create({ settings: { ...DEFAULT_SETTINGS, roundDuration: 60 }, playerName: 'Ελένη', bots: [], rng: seededRng(2), now });
    c.guess('Ψ');
    c.guess('Α');
    await c.save();
    const saved = await loadProgress();
    expect(saved).not.toBeNull();
    clock += 10 * 60_000; // ο χρήστης έκλεισε την εφαρμογή για 10 λεπτά
    const restored = LocalGameController.restore(saved!, { rng: seededRng(3), now });
    restored.tick();
    const v = restored.view();
    expect(v.board!.status).toBe('playing');
    expect(v.board!.guessedLetters).toEqual(['Ψ', 'Α']);
    expect(v.board!.deadline! - clock).toBeGreaterThan(55_000);
  });

  it('η παύση σταματά το χρονόμετρο', () => {
    const c = LocalGameController.create({ settings: { ...DEFAULT_SETTINGS, roundDuration: 30 }, playerName: 'Χ', bots: [], rng: seededRng(4), now, persist: false });
    c.pause();
    clock += 120_000;
    c.tick();
    expect(c.view().board!.status).toBe('playing');
    c.resume();
    c.tick();
    expect(c.view().board!.status).toBe('playing');
    clock += 31_000;
    c.tick();
    expect(c.view().board!.status).toBe('lost');
  });

  it('Μονομαχία με bots: τα bots παίζουν και ο γύρος ολοκληρώνεται', () => {
    const c = LocalGameController.create({ settings: { ...DEFAULT_SETTINGS, gameMode: 'duel', totalRounds: 1 }, playerName: 'Χ', bots: ['hard', 'easy'], rng: seededRng(5), now, persist: false });
    expect(c.view().players.filter((p) => p.isBot)).toHaveLength(2);
    solve(c);
    for (let i = 0; i < 2000 && c.view().status === 'playing'; i++) {
      clock += 250;
      c.tick();
    }
    const v = c.view();
    expect(v.status).toBe('finished');
    expect(v.lastResult!.ranking).toHaveLength(3);
  });

  it('Συνεργατική με bots: κοινό ταμπλό', () => {
    const c = LocalGameController.create({ settings: { ...DEFAULT_SETTINGS, gameMode: 'coop', totalRounds: 1, timerEnabled: false }, playerName: 'Χ', bots: ['medium', 'hard'], rng: seededRng(6), now, persist: false });
    expect(Object.keys(c.game.currentRound!.boards)).toEqual([TEAM_BOARD]);
    for (let i = 0; i < 4000 && c.view().status === 'playing'; i++) {
      clock += 250;
      c.tick();
    }
    expect(c.view().status).toBe('finished');
    expect(c.view().teamSummary!.roundsPlayed).toBe(1);
  });
});
