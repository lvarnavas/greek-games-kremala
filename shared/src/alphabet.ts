/** Τα 24 κεφαλαία γράμματα του ελληνικού αλφαβήτου (χωρίς τόνους). */
export const GREEK_ALPHABET = [
  'Α', 'Β', 'Γ', 'Δ', 'Ε', 'Ζ', 'Η', 'Θ', 'Ι', 'Κ', 'Λ', 'Μ',
  'Ν', 'Ξ', 'Ο', 'Π', 'Ρ', 'Σ', 'Τ', 'Υ', 'Φ', 'Χ', 'Ψ', 'Ω',
] as const;

export type GreekLetter = (typeof GREEK_ALPHABET)[number];

export const GREEK_SET: ReadonlySet<string> = new Set(GREEK_ALPHABET);

/** Αλφαβητική διάταξη πληκτρολογίου: 3 σειρές των 8. */
export const KEYBOARD_ALPHABETICAL: string[][] = [
  GREEK_ALPHABET.slice(0, 8) as unknown as string[],
  GREEK_ALPHABET.slice(8, 16) as unknown as string[],
  GREEK_ALPHABET.slice(16, 24) as unknown as string[],
];

/** Διάταξη ελληνικού πληκτρολογίου υπολογιστή. */
export const KEYBOARD_QWERTY: string[][] = [
  ['Ε', 'Ρ', 'Τ', 'Υ', 'Θ', 'Ι', 'Ο', 'Π'],
  ['Α', 'Σ', 'Δ', 'Φ', 'Γ', 'Η', 'Ξ', 'Κ', 'Λ'],
  ['Ζ', 'Χ', 'Ψ', 'Ω', 'Β', 'Ν', 'Μ'],
];

/**
 * Προσεγγιστική συχνότητα γραμμάτων (%) στα ελληνικά κείμενα.
 * Χρησιμοποιείται από τα bots και για τον υπολογισμό δυσκολίας.
 */
export const LETTER_FREQUENCY: Record<string, number> = {
  Α: 11.5, Ο: 10.0, Ι: 8.5, Ε: 8.0, Τ: 8.0, Σ: 7.5, Ν: 6.5, Η: 5.0,
  Ρ: 4.8, Κ: 4.2, Π: 4.0, Υ: 4.0, Λ: 3.0, Μ: 3.0, Ω: 2.0, Δ: 1.8,
  Γ: 1.8, Χ: 1.2, Θ: 1.2, Φ: 0.8, Β: 0.8, Ξ: 0.4, Ζ: 0.4, Ψ: 0.2,
};

/** Γράμματα ταξινομημένα κατά φθίνουσα συχνότητα. */
export const LETTERS_BY_FREQUENCY: string[] = [...GREEK_ALPHABET].sort(
  (a, b) => LETTER_FREQUENCY[b] - LETTER_FREQUENCY[a],
);

/**
 * Αντιστοίχιση πλήκτρων λατινικού πληκτρολογίου στην τυπική ελληνική διάταξη,
 * ώστε ο παίκτης να μπορεί να πληκτρολογεί χωρίς αλλαγή γλώσσας.
 */
export const LATIN_TO_GREEK: Record<string, string> = {
  a: 'Α', b: 'Β', g: 'Γ', d: 'Δ', e: 'Ε', z: 'Ζ', h: 'Η', u: 'Θ',
  i: 'Ι', k: 'Κ', l: 'Λ', m: 'Μ', n: 'Ν', j: 'Ξ', o: 'Ο', p: 'Π',
  r: 'Ρ', s: 'Σ', w: 'Σ', t: 'Τ', y: 'Υ', f: 'Φ', x: 'Χ', c: 'Ψ', v: 'Ω',
};
