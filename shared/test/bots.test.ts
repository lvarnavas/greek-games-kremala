import { describe, expect, it } from 'vitest';
import { botDelay, chooseBotHint, chooseBotLetter, createBoard, guessLetter, matchingCandidates, seededRng, toBoardView, DEFAULT_SETTINGS, BOT_DELAY } from '../src';
import { tinyDict } from './helpers';

const view = (word: string, guesses: string[] = []) => {
  const b = createBoard({ wordId: 'w', word, category: 'test', maxMistakes: 6, startedAt: 0, durationMs: null });
  for (const g of guesses) guessLetter(b, g, 'x', 1);
  return toBoardView(b, { revealWord: false, showGuessAuthor: false, settings: DEFAULT_SETTINGS });
};

describe('Συμπεριφορά bots', () => {
  it('η απόφαση εξαρτάται μόνο από τη δημόσια προβολή (δεν γνωρίζουν τη λέξη)', () => {
    // Δύο διαφορετικές μυστικές λέξεις με ίδια ορατή κατάσταση → ίδια επιλογή
    const v1 = view('βουνό', ['Ο', 'Υ']);
    const v2 = view('κουτό', ['Ο', 'Υ']);
    expect(v1).toEqual(v2);
    for (const level of ['easy', 'medium', 'hard'] as const) {
      expect(chooseBotLetter(v1, level, seededRng(3), tinyDict)).toBe(chooseBotLetter(v2, level, seededRng(3), tinyDict));
    }
    expect(JSON.stringify(v1)).not.toContain('ΒΟΥΝ');
  });
  it('δεν επιλέγουν ποτέ ήδη επιλεγμένο ή αφαιρεμένο γράμμα', () => {
    const v = view('θάλασσα', ['Α', 'Ω', 'Σ']);
    v.eliminatedLetters = ['Ε', 'Ι'];
    const rng = seededRng(1);
    for (let i = 0; i < 200; i++) {
      for (const level of ['easy', 'medium', 'hard'] as const) {
        const l = chooseBotLetter(v, level, rng, tinyDict)!;
        expect(['Α', 'Ω', 'Σ', 'Ε', 'Ι']).not.toContain(l);
      }
    }
  });
  it('το δύσκολο bot αξιοποιεί το λεξικό και τη μάσκα', () => {
    const v = view('θάλασσα', ['Α', 'Σ']);
    expect(matchingCandidates(v, tinyDict).map((w) => w.join(''))).toEqual(['ΘΑΛΑΣΣΑ']);
    expect(['Θ', 'Λ']).toContain(chooseBotLetter(v, 'hard', seededRng(1), tinyDict));
  });
  it('το δύσκολο bot λύνει λέξεις με λίγα λάθη, το εύκολο κάνει περισσότερα', () => {
    const play = (level: 'easy' | 'hard', seed: number) => {
      const b = createBoard({ wordId: 'w', word: 'ποτάμι', category: 'test', maxMistakes: 24, startedAt: 0, durationMs: null });
      const rng = seededRng(seed);
      while (b.status === 'playing') {
        const v = toBoardView(b, { revealWord: false, showGuessAuthor: false, settings: DEFAULT_SETTINGS });
        guessLetter(b, chooseBotLetter(v, level, rng, tinyDict)!, 'bot', 1);
      }
      return b.mistakes;
    };
    let easy = 0, hard = 0;
    for (let s = 1; s <= 20; s++) { easy += play('easy', s); hard += play('hard', s); }
    expect(hard).toBeLessThan(easy);
    expect(hard / 20).toBeLessThan(3);
  });
  it('διαφορετική ταχύτητα αντίδρασης ανά επίπεδο', () => {
    const rng = seededRng(2);
    for (const level of ['easy', 'medium', 'hard'] as const) {
      const d = botDelay(level, rng);
      expect(d).toBeGreaterThanOrEqual(BOT_DELAY[level][0]);
      expect(d).toBeLessThanOrEqual(BOT_DELAY[level][1]);
    }
    expect(BOT_DELAY.hard[1]).toBeLessThan(BOT_DELAY.easy[0]);
  });
  it('υποδείξεις μόνο όταν επιτρέπονται', () => {
    const v = view('θάλασσα', ['Β', 'Γ', 'Δ', 'Ζ', 'Ξ']);
    expect(chooseBotHint(v, 'hard', true, seededRng(1))).toBe('reveal');
    expect(chooseBotHint(v, 'hard', false, seededRng(1))).toBeNull();
    expect(chooseBotHint(v, 'easy', true, seededRng(1))).toBeNull();
  });
});
