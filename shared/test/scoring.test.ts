import { describe, expect, it } from 'vitest';
import { basePoints, computeScore, createBoard, guessLetter, applyHintToBoard, DEFAULT_SETTINGS, seededRng, rankResults, roundWinner, compareResults } from '../src';

describe('Βαθμολογία', () => {
  it('πίνακας πόντων ανά λάθη', () => {
    expect([0, 1, 2, 3, 4, 5, 9].map((m) => basePoints(true, m))).toEqual([100, 80, 60, 40, 20, 20, 20]);
    expect(basePoints(false, 0)).toBe(0);
  });
  const solved = (mistakes: number, hints: ('reveal' | 'eliminate')[] = [], opts = { finish: 60_000 }) => {
    const b = createBoard({ wordId: 'w', word: 'ήλιος', category: 'c', maxMistakes: 6, startedAt: 0, durationMs: 120_000 });
    const wrong = ['Β', 'Γ', 'Δ', 'Ζ', 'Θ'];
    for (let i = 0; i < mistakes; i++) guessLetter(b, wrong[i], 'p', 1);
    for (const h of hints) applyHintToBoard(b, h, 'p', 1, { ...DEFAULT_SETTINGS, maxHintsPerRound: 5 }, seededRng(7));
    for (const l of ['Η', 'Λ', 'Ι', 'Ο', 'Σ']) guessLetter(b, l, 'p', opts.finish);
    return b;
  };
  it('νίκη χωρίς λάθη = 100', () => {
    expect(computeScore(solved(0), DEFAULT_SETTINGS)).toEqual({ base: 100, hintPenalty: 0, speedBonus: 0, total: 100 });
  });
  it('αφαιρεί ποινές υποδείξεων', () => {
    expect(computeScore(solved(1, ['eliminate']), DEFAULT_SETTINGS).total).toBe(70);
    expect(computeScore(solved(0, ['reveal', 'eliminate']), DEFAULT_SETTINGS).total).toBe(65);
  });
  it('δεν πέφτει κάτω από το μηδέν', () => {
    const r = computeScore(solved(4, ['reveal', 'reveal']), DEFAULT_SETTINGS);
    expect(r.base).toBe(20);
    expect(r.total).toBe(0);
  });
  it('ήττα = 0 ακόμη και με μπόνους', () => {
    const b = createBoard({ wordId: 'w', word: 'ήλιος', category: 'c', maxMistakes: 1, startedAt: 0, durationMs: 1000 });
    guessLetter(b, 'Β', 'p', 1);
    expect(computeScore(b, { speedBonusEnabled: true }).total).toBe(0);
  });
  it('μπόνους ταχύτητας έως 20 όταν είναι ενεργό', () => {
    expect(computeScore(solved(0, [], { finish: 0 }), { speedBonusEnabled: true }).total).toBe(120);
    expect(computeScore(solved(0, [], { finish: 60_000 }), { speedBonusEnabled: true }).speedBonus).toBe(10);
    expect(computeScore(solved(0), { speedBonusEnabled: false }).speedBonus).toBe(0);
  });
});

describe('Κατάταξη μονομαχίας', () => {
  const r = (playerId: string, won: boolean, points: number, mistakes: number, timeMs: number) => ({ playerId, won, points, mistakes, timeMs });
  it('νίκη > πόντοι > λάθη > χρόνος', () => {
    const ranking = rankResults([
      r('d', false, 0, 6, 10),
      r('c', true, 80, 1, 5000),
      r('b', true, 80, 1, 3000),
      r('a', true, 100, 0, 9000),
    ]);
    expect(ranking.map((x) => x.playerId)).toEqual(['a', 'b', 'c', 'd']);
    expect(ranking.map((x) => x.rank)).toEqual([1, 2, 3, 4]);
    expect(roundWinner(ranking)).toBe('a');
  });
  it('λιγότερα λάθη κερδίζουν σε ισοβαθμία πόντων (λόγω ποινών)', () => {
    const ranking = rankResults([r('a', true, 60, 2, 1000), r('b', true, 60, 0, 9000)]);
    expect(ranking[0].playerId).toBe('b');
  });
  it('πλήρης ισοπαλία: ίδια θέση, χωρίς νικητή, ντετερμινιστική σειρά', () => {
    const ranking = rankResults([r('z', true, 80, 1, 2000), r('m', true, 80, 1, 2000), r('a', false, 0, 6, 100)]);
    expect(ranking.map((x) => [x.playerId, x.rank, x.tied])).toEqual([
      ['m', 1, true],
      ['z', 1, true],
      ['a', 3, false],
    ]);
    expect(roundWinner(ranking)).toBeNull();
    expect(compareResults(ranking[0], ranking[1])).toBe(0);
  });
  it('κανείς δεν κέρδισε: δεν υπάρχει νικητής', () => {
    const ranking = rankResults([r('a', false, 0, 6, 1000), r('b', false, 0, 3, 1000)]);
    expect(ranking[0].playerId).toBe('b');
    expect(roundWinner(ranking)).toBeNull();
  });
});
