import { describe, expect, it } from 'vitest';
import { computeDifficulty, DICTIONARY, filterWords, normalizeWord, pickEquivalentWords, pickWord, seededRng, wordProfile, GREEK_SET } from '../src';
import source from '../data/words.source.json';

describe('Ελληνικό λεξικό', () => {
  it('έχει κατηγορίες και αρκετές λέξεις ανά κατηγορία και δυσκολία', () => {
    expect(DICTIONARY.categories.length).toBeGreaterThanOrEqual(10);
    for (const c of DICTIONARY.categories) {
      const words = DICTIONARY.words.filter((w) => w.category === c.id);
      expect(words.length, c.id).toBeGreaterThanOrEqual(30);
    }
    for (const d of ['easy', 'medium', 'hard'] as const) expect(filterWords(DICTIONARY, { categories: [], difficulty: d }).length).toBeGreaterThan(100);
  });
  it('όλες οι λέξεις αποτελούνται από έγκυρα ελληνικά γράμματα, με μήκος 4–15', () => {
    for (const w of DICTIONARY.words) {
      const letters = normalizeWord(w.word);
      expect(letters.every((l) => GREEK_SET.has(l)), w.word).toBe(true);
      expect(letters.length, w.word).toBeGreaterThanOrEqual(4);
      expect(letters.length, w.word).toBeLessThanOrEqual(15);
    }
  });
  it('μοναδικά ids, χωρίς διπλές λέξεις, και κάθε λέξη έχει σωστή κατηγορία/δυσκολία', () => {
    const ids = new Set(DICTIONARY.words.map((w) => w.id));
    expect(ids.size).toBe(DICTIONARY.words.length);
    const norm = DICTIONARY.words.map((w) => normalizeWord(w.word).join(''));
    expect(new Set(norm).size).toBe(norm.length);
    const cats = new Set(DICTIONARY.categories.map((c) => c.id));
    for (const w of DICTIONARY.words) {
      expect(cats.has(w.category)).toBe(true);
      expect(w.difficulty).toBe(computeDifficulty(w.word));
    }
  });
  it('είναι συγχρονισμένο με το αρχείο πηγής', () => {
    const total = source.categories.reduce((n, c) => n + c.words.length, 0);
    expect(DICTIONARY.words.length).toBe(total);
  });
  it('επιλογή λέξης με φίλτρα και αποκλεισμό χρησιμοποιημένων', () => {
    const rng = seededRng(1);
    const w = pickWord(DICTIONARY, { categories: ['animals'], difficulty: 'hard' }, rng);
    expect(w.category).toBe('animals');
    expect(w.difficulty).toBe('hard');
    const pool = filterWords(DICTIONARY, { categories: ['animals'], difficulty: 'hard' });
    const exclude = new Set(pool.slice(1).map((x) => x.id));
    expect(pickWord(DICTIONARY, { categories: ['animals'], difficulty: 'hard' }, rng, exclude).id).toBe(pool[0].id);
  });
  it('ισοδύναμες λέξεις έχουν ίδια δυσκολία και παρόμοιο μήκος', () => {
    const rng = seededRng(4);
    for (let i = 0; i < 20; i++) {
      const base = pickWord(DICTIONARY, { categories: [], difficulty: 'any' }, rng);
      const eq = pickEquivalentWords(DICTIONARY, base, 4, rng);
      expect(eq[0]).toBe(base);
      expect(new Set(eq.map((w) => w.id)).size).toBe(4);
      for (const w of eq) {
        expect(w.difficulty).toBe(base.difficulty);
        expect(Math.abs(wordProfile(w.word).length - wordProfile(base.word).length)).toBeLessThanOrEqual(2);
      }
    }
  });
});
