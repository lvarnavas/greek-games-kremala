import { describe, expect, it } from 'vitest';
import { keyToGreekLetter, normalizeLetter, normalizeWord, uniqueLetters } from '../src';

describe('Κανονικοποίηση γραμμάτων', () => {
  it('αφαιρεί τόνους και κάνει κεφαλαία', () => {
    expect(normalizeLetter('ά')).toBe('Α');
    expect(normalizeLetter('έ')).toBe('Ε');
    expect(normalizeLetter('ή')).toBe('Η');
    expect(normalizeLetter('ί')).toBe('Ι');
    expect(normalizeLetter('ό')).toBe('Ο');
    expect(normalizeLetter('ύ')).toBe('Υ');
    expect(normalizeLetter('ώ')).toBe('Ω');
    expect(normalizeLetter('Ά')).toBe('Α');
  });
  it('χειρίζεται διαλυτικά και διαλυτικά με τόνο', () => {
    expect(normalizeLetter('ϊ')).toBe('Ι');
    expect(normalizeLetter('ΐ')).toBe('Ι');
    expect(normalizeLetter('ϋ')).toBe('Υ');
    expect(normalizeLetter('ΰ')).toBe('Υ');
  });
  it('μετατρέπει το τελικό ς σε Σ', () => {
    expect(normalizeLetter('ς')).toBe('Σ');
    expect(normalizeLetter('σ')).toBe('Σ');
  });
  it('απορρίπτει μη ελληνικούς χαρακτήρες και πολλαπλά γράμματα', () => {
    expect(normalizeLetter('a')).toBeNull();
    expect(normalizeLetter('1')).toBeNull();
    expect(normalizeLetter('αβ')).toBeNull();
    expect(normalizeLetter('')).toBeNull();
    expect(normalizeLetter(42)).toBeNull();
    expect(normalizeLetter(null)).toBeNull();
  });
  it('αντιστοιχίζει λατινικά πλήκτρα στην ελληνική διάταξη', () => {
    expect(keyToGreekLetter('a')).toBe('Α');
    expect(keyToGreekLetter('u')).toBe('Θ');
    expect(keyToGreekLetter('w')).toBe('Σ');
    expect(keyToGreekLetter('q')).toBeNull();
    expect(keyToGreekLetter('Enter')).toBeNull();
  });
});

describe('Κανονικοποίηση λέξεων', () => {
  it('κανονικοποιεί ολόκληρη λέξη', () => {
    expect(normalizeWord('Θάλασσα')).toEqual(['Θ', 'Α', 'Λ', 'Α', 'Σ', 'Σ', 'Α']);
    expect(normalizeWord('σκύλος').join('')).toBe('ΣΚΥΛΟΣ');
    expect(normalizeWord('ιστιοπλοΐα').join('')).toBe('ΙΣΤΙΟΠΛΟΙΑ');
    expect(normalizeWord('Ταϊλάνδη').join('')).toBe('ΤΑΙΛΑΝΔΗ');
  });
  it('διατηρεί κενά και παύλες', () => {
    expect(normalizeWord('άγιος βασίλης')).toContain(' ');
  });
  it('πετάει σφάλμα για άκυρους χαρακτήρες', () => {
    expect(() => normalizeWord('abc')).toThrow();
  });
  it('βρίσκει μοναδικά γράμματα', () => {
    expect(uniqueLetters(normalizeWord('θάλασσα')).sort()).toEqual(['Α', 'Θ', 'Λ', 'Σ']);
  });
});
