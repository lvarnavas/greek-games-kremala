import { describe, expect, it } from 'vitest';
import { applyHintToBoard, checkTimeout, createBoard, guessLetter, maskOf, seededRng, toBoardView, DEFAULT_SETTINGS } from '../src';

const mk = (word = 'θάλασσα', maxMistakes = 6, durationMs: number | null = 120_000) =>
  createBoard({ wordId: 'w', word, category: 'nature', maxMistakes, startedAt: 0, durationMs });

describe('Ταμπλό', () => {
  it('αποκαλύπτει όλες τις εμφανίσεις ενός γράμματος', () => {
    const b = mk();
    const r = guessLetter(b, 'α', 'p', 10);
    expect(r).toMatchObject({ ok: true, correct: true, positions: [1, 3, 6] });
    expect(maskOf(b)).toEqual([null, 'Α', null, 'Α', null, null, 'Α']);
  });
  it('δέχεται τονισμένα και τελικό ς ως το ίδιο γράμμα', () => {
    const b = mk('σκύλος');
    guessLetter(b, 'ς', 'p', 1);
    expect(maskOf(b)).toEqual(['Σ', null, null, null, null, 'Σ']);
    expect(guessLetter(b, 'ύ', 'p', 2)).toMatchObject({ ok: true, correct: true });
  });
  it('αποτρέπει επαναλαμβανόμενες επιλογές χωρίς επιπλέον λάθος', () => {
    const b = mk();
    guessLetter(b, 'Ω', 'p', 1);
    expect(b.mistakes).toBe(1);
    expect(guessLetter(b, 'ω', 'p', 2)).toEqual({ ok: false, error: 'already_guessed' });
    expect(guessLetter(b, 'ώ', 'q', 3)).toEqual({ ok: false, error: 'already_guessed' });
    expect(b.mistakes).toBe(1);
    guessLetter(b, 'Α', 'p', 4);
    expect(guessLetter(b, 'ά', 'p', 5)).toEqual({ ok: false, error: 'already_guessed' });
    expect(b.mistakes).toBe(1);
  });
  it('μετράει λάθη και χάνει στο μέγιστο', () => {
    const b = mk('θάλασσα', 3);
    for (const l of ['Β', 'Γ']) guessLetter(b, l, 'p', 1);
    expect(b.mistakes).toBe(2);
    expect(b.status).toBe('playing');
    guessLetter(b, 'Δ', 'p', 2);
    expect(b.status).toBe('lost');
    expect(b.endReason).toBe('mistakes');
    expect(guessLetter(b, 'Α', 'p', 3)).toEqual({ ok: false, error: 'not_playing' });
  });
  it('νίκη όταν αποκαλυφθεί ολόκληρη η λέξη', () => {
    const b = mk();
    for (const l of ['Θ', 'Α', 'Λ']) guessLetter(b, l, 'p', 5);
    expect(b.status).toBe('playing');
    guessLetter(b, 'Σ', 'p', 50);
    expect(b.status).toBe('won');
    expect(b.endReason).toBe('solved');
    expect(b.finishedAt).toBe(50);
  });
  it('απορρίπτει άκυρα γράμματα', () => {
    const b = mk();
    expect(guessLetter(b, 'x', 'p', 1)).toEqual({ ok: false, error: 'invalid_letter' });
    expect(guessLetter(b, '', 'p', 1)).toEqual({ ok: false, error: 'invalid_letter' });
    expect(b.mistakes).toBe(0);
  });
  it('λήγει αυτόματα όταν τελειώσει ο χρόνος', () => {
    const b = mk('θάλασσα', 6, 1000);
    expect(checkTimeout(b, 999)).toBe(false);
    expect(checkTimeout(b, 1000)).toBe(true);
    expect(b.status).toBe('lost');
    expect(b.endReason).toBe('timeout');
    expect(b.finishedAt).toBe(1000);
  });
  it('μαντεψιά μετά τη λήξη απορρίπτεται και τερματίζει', () => {
    const b = mk('θάλασσα', 6, 1000);
    expect(guessLetter(b, 'Α', 'p', 5000)).toEqual({ ok: false, error: 'time_up' });
    expect(b.status).toBe('lost');
  });
  it('χωρίς χρονόμετρο δεν λήγει ποτέ', () => {
    const b = mk('θάλασσα', 6, null);
    expect(checkTimeout(b, 10 ** 12)).toBe(false);
  });
  it('υπόδειξη αποκάλυψης γράμματος με ποινή', () => {
    const b = mk();
    const r = applyHintToBoard(b, 'reveal', 'p', 1, DEFAULT_SETTINGS, seededRng(3));
    expect(r.ok).toBe(true);
    expect(b.correctLetters).toHaveLength(1);
    expect(b.hintPenalty).toBe(25);
    expect(b.mistakes).toBe(0);
  });
  it('υπόδειξη αφαίρεσης 3 λανθασμένων γραμμάτων', () => {
    const b = mk();
    const r = applyHintToBoard(b, 'eliminate', 'p', 1, DEFAULT_SETTINGS, seededRng(3));
    expect(r.ok && r.letters).toHaveLength(3);
    for (const l of b.eliminatedLetters) expect(['Θ', 'Α', 'Λ', 'Σ']).not.toContain(l);
    expect(guessLetter(b, b.eliminatedLetters[0], 'p', 2)).toEqual({ ok: false, error: 'eliminated' });
  });
  it('σέβεται το όριο υποδείξεων και την απενεργοποίηση', () => {
    const b = mk();
    const s = { ...DEFAULT_SETTINGS, maxHintsPerRound: 1 };
    expect(applyHintToBoard(b, 'eliminate', 'p', 1, s, seededRng(1)).ok).toBe(true);
    expect(applyHintToBoard(b, 'reveal', 'p', 1, s, seededRng(1))).toEqual({ ok: false, error: 'no_hints_left' });
    expect(applyHintToBoard(mk(), 'reveal', 'p', 1, { ...s, hintsEnabled: false }, seededRng(1))).toEqual({ ok: false, error: 'hints_disabled' });
  });
  it('η δημόσια προβολή δεν περιέχει τη λέξη πριν τη λήξη', () => {
    const b = mk();
    guessLetter(b, 'Α', 'p', 1);
    const v = toBoardView(b, { revealWord: false, showGuessAuthor: false, settings: DEFAULT_SETTINGS });
    const json = JSON.stringify(v);
    expect(json).not.toContain('θάλασσα');
    expect(json).not.toContain('ΘΑΛΑΣΣΑ');
    expect(v.word).toBeNull();
    expect(v.mask.filter(Boolean)).toEqual(['Α', 'Α', 'Α']);
    const end = toBoardView(b, { revealWord: true, showGuessAuthor: false, settings: DEFAULT_SETTINGS });
    expect(end.word).toBe('θάλασσα');
  });
});
