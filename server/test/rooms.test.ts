import { describe, expect, it } from 'vitest';
import { seededRng, TEAM_BOARD, type Dictionary } from '@kremala/shared';
import { RoomManager } from '../src/rooms';

const dict: Dictionary = {
  categories: [{ id: 'c', name: 'Δοκιμή', icon: '🧪' }],
  words: [{ id: 'w1', word: 'θάλασσα', category: 'c', difficulty: 'medium', ease: 50 }],
};
const mgr = () => new RoomManager({ rng: seededRng(1), dictionary: dict, autoNextMs: 5000, hostGraceMs: 1000, lobbyDropMs: 2000 });

function setup(mode: 'duel' | 'coop' | 'classic' = 'duel', n = 2) {
  const m = mgr();
  const c = m.create('Άννα', { gameMode: mode }, 0);
  if (!c.ok) throw new Error(c.error);
  const room = c.room;
  const ids = [c.info.playerId];
  const tokens = [c.info.token];
  for (let i = 1; i < n; i++) {
    const j = m.join(room.code, `Π${i}`, undefined, 0);
    if (!j.ok) throw new Error(j.error);
    ids.push(j.info.playerId);
    tokens.push(j.info.token);
  }
  return { m, room, ids, tokens };
}

describe('RoomManager', () => {
  it('κωδικός 5 χαρακτήρων και έλεγχος ονόματος', () => {
    const m = mgr();
    const r = m.create('Άννα', undefined, 0);
    expect(r.ok && r.info.code).toMatch(/^[A-Z2-9]{5}$/);
    expect(m.create('', undefined, 0)).toEqual({ ok: false, error: 'invalid_name' });
    expect(m.join('ZZZZZ', 'Β', undefined, 0)).toEqual({ ok: false, error: 'room_not_found' });
  });
  it('έως 8 παίκτες', () => {
    const { m, room } = setup('duel', 8);
    expect(m.join(room.code, 'Ένατος', undefined, 0)).toEqual({ ok: false, error: 'room_full' });
  });
  it('μόνο ο οικοδεσπότης αλλάζει ρυθμίσεις και ξεκινά· λειτουργία κλειδώνει', () => {
    const { m, room, ids } = setup();
    expect(m.updateSettings(room, ids[1], { gameMode: 'coop' }, 1)).toEqual({ ok: false, error: 'not_host' });
    expect(m.updateSettings(room, ids[0], { gameMode: 'coop', maxMistakes: 99 }, 1).ok).toBe(true);
    expect(room.game.settings.maxMistakes).toBe(10);
    expect(m.start(room, ids[1], 2)).toEqual({ ok: false, error: 'not_host' });
    expect(m.start(room, ids[0], 2).ok).toBe(true);
    expect(room.game.mode).toBe('coop');
    expect(m.updateSettings(room, ids[0], { gameMode: 'duel' }, 3)).toEqual({ ok: false, error: 'game_in_progress' });
    expect(room.game.mode).toBe('coop');
    expect(m.join(room.code, 'Αργοπορημένος', undefined, 4)).toEqual({ ok: false, error: 'game_in_progress' });
  });
  it('χρειάζονται τουλάχιστον 2 ενεργοί παίκτες (ή bot)', () => {
    const m = mgr();
    const c = m.create('Άννα', undefined, 0);
    if (!c.ok) throw 0;
    expect(m.start(c.room, c.info.playerId, 1)).toEqual({ ok: false, error: 'not_enough_players' });
    m.addBot(c.room, c.info.playerId, 'hard', 1);
    expect(m.start(c.room, c.info.playerId, 2).ok).toBe(true);
  });
  it('μονομαχία: η λέξη δεν εμφανίζεται στα δημόσια δεδομένα κανενός', () => {
    const { m, room, ids } = setup('duel', 3);
    m.start(room, ids[0], 0);
    for (const l of ['Θ', 'Α', 'Λ']) m.guess(room, ids[0], l, 10);
    for (const id of ids) {
      const json = JSON.stringify(m.payloadFor(room, id, 20));
      expect(json).not.toMatch(/θάλασσα|ΘΑΛΑΣΣΑ/);
    }
    // όταν λήξει ο γύρος, η λέξη αποκαλύπτεται
    m.guess(room, ids[0], 'Σ', 30);
    for (const id of ids.slice(1)) for (const l of 'ΒΓΔΖΚΞ') m.guess(room, id, l, 1000 + Math.random() * 10);
    expect(room.game.status).toBe('roundOver');
    expect(m.payloadFor(room, ids[1], 5000).view.lastResult!.words[ids[0]]).toBe('θάλασσα');
  });
  it('συνεργατική: διπλή ταυτόχρονη επιλογή δεν αφαιρεί δεύτερη προσπάθεια', () => {
    const { m, room, ids } = setup('coop', 3);
    m.start(room, ids[0], 0);
    const results = [ids[0], ids[1], ids[2]].map((id) => m.guess(room, id, 'Ω', 100));
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok && r.error === 'already_guessed')).toHaveLength(2);
    expect(room.game.currentRound!.boards[TEAM_BOARD].mistakes).toBe(1);
  });
  it('συνεργατική: συγχρονισμένη κοινή κατάσταση για όλους', () => {
    const { m, room, ids } = setup('coop', 3);
    m.start(room, ids[0], 0);
    m.guess(room, ids[1], 'Α', 10);
    m.guess(room, ids[2], 'Ω', 11);
    const boards = ids.map((id) => m.payloadFor(room, id, 12).view.board);
    expect(boards[0]).toEqual(boards[1]);
    expect(boards[1]).toEqual(boards[2]);
    expect(boards[0]!.mask.filter(Boolean)).toHaveLength(3);
    expect(boards[0]!.mistakes).toBe(1);
  });
  it('επανασύνδεση με token διατηρεί την πρόοδο', () => {
    const { m, room, ids, tokens } = setup('duel');
    m.start(room, ids[0], 0);
    m.guess(room, ids[1], 'Α', 10);
    m.guess(room, ids[1], 'Ω', 11);
    m.disconnect(room, ids[1], 12);
    expect(room.game.players[1].connectionStatus).toBe('disconnected');
    const r = m.join(room.code, 'οτιδήποτε', tokens[1], 500);
    expect(r.ok && r.reconnected && r.info.playerId).toBe(ids[1]);
    const v = m.payloadFor(room, ids[1], 501).view;
    expect(v.board!.guessedLetters).toEqual(['Α', 'Ω']);
    expect(v.board!.mistakes).toBe(1);
    expect(room.game.players[1].connectionStatus).toBe('connected');
  });
  it('μεταβίβαση οικοδεσπότη μετά από αποσύνδεση ή αποχώρηση', () => {
    const { m, room, ids } = setup('duel', 3);
    m.disconnect(room, ids[0], 100);
    m.tick(500);
    expect(room.game.hostId).toBe(ids[0]);
    m.tick(1200);
    expect(room.game.hostId).toBe(ids[1]);
    m.leave(room, ids[1], 1300);
    expect(room.game.hostId).toBe(ids[2]);
  });
  it('αυτόματη λήξη χρόνου και αυτόματος επόμενος γύρος', () => {
    const { m, room, ids } = setup('duel');
    m.updateSettings(room, ids[0], { roundDuration: 30, totalRounds: 3 }, 0);
    m.start(room, ids[0], 0);
    m.tick(29_000);
    expect(room.game.status).toBe('playing');
    m.tick(30_000);
    expect(room.game.status).toBe('roundOver');
    m.tick(35_001);
    expect(room.game.status).toBe('playing');
    expect(room.game.currentRound!.index).toBe(2);
  });
  it('περιορισμός συχνότητας ενεργειών', () => {
    const m = new RoomManager({ rng: seededRng(1), dictionary: dict, rateLimit: { capacity: 3, refillPerSec: 1 } });
    const c = m.create('Α', { gameMode: 'duel' }, 0);
    if (!c.ok) throw 0;
    m.addBot(c.room, c.info.playerId, 'easy', 0);
    m.start(c.room, c.info.playerId, 0);
    const res = ['Β', 'Γ', 'Δ', 'Ζ'].map((l) => m.guess(c.room, c.info.playerId, l, 1));
    expect(res[3]).toEqual({ ok: false, error: 'rate_limited' });
    expect(m.guess(c.room, c.info.playerId, 'Ζ', 2000).ok).toBe(true);
  });
  it('απορρίπτει άκυρη είσοδο χωρίς σφάλμα', () => {
    const { m, room, ids } = setup('duel');
    m.start(room, ids[0], 0);
    expect(m.guess(room, ids[0], { evil: true }, 1)).toEqual({ ok: false, error: 'invalid_letter' });
    expect(m.hint(room, ids[0], 'cheat', 2)).toEqual({ ok: false, error: 'invalid_request' });
    expect(m.guess(room, 'ghost', 'Α', 3).ok).toBe(false);
  });
});
