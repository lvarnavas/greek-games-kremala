import { describe, expect, it } from 'vitest';
import {
  addBot, applyGuess, applyHint, finishRound, getView, isRoundComplete, nextRound, removePlayer, resetToLobby,
  seededRng, setConnection, shiftGameTimes, startGame, stepGame, TEAM_BOARD,
} from '../src';
import { makeGame, startWith, tinyDict } from './helpers';

const guessAll = (g: ReturnType<typeof makeGame>, pid: string, letters: string, now = 2000) =>
  [...letters].map((l) => applyGuess(g, pid, l, now));

describe('Κλασική λειτουργία', () => {
  it('ολοκληρώνει γύρο με νίκη και βαθμολογία', () => {
    const g = makeGame('classic', ['p']);
    startWith(g, 'ήλιος');
    guessAll(g, 'p', 'ΗΛΙΟΣ');
    expect(g.status).toBe('roundOver');
    expect(g.currentRound!.scoreByPlayer.p).toBe(100);
    expect(g.players[0]).toMatchObject({ score: 100, wins: 1, streak: 1 });
    const v = getView(g, 'p', 3000);
    expect(v.lastResult!.words.p).toBe('ήλιος');
    expect(v.board!.word).toBe('ήλιος');
  });
  it('ήττα από λάθη και επόμενος γύρος με μηδενισμένο ταμπλό', () => {
    const g = makeGame('classic', ['p'], { maxMistakes: 3, totalRounds: 3 });
    startWith(g, 'ήλιος');
    guessAll(g, 'p', 'ΒΓΔ');
    expect(g.status).toBe('roundOver');
    expect(g.players[0]).toMatchObject({ score: 0, losses: 1, streak: 0 });
    const r2 = nextRound(g, 5000, seededRng(2), tinyDict)!;
    expect(r2.index).toBe(2);
    const v = getView(g, 'p', 5000);
    expect(v.board!.mistakes).toBe(0);
    expect(v.board!.guessedLetters).toEqual([]);
    expect(v.board!.word).toBeNull();
    expect(r2.wordId).not.toBe(g.roundHistory[0].wordId);
  });
  it('αυτόματη λήξη χρόνου μέσω stepGame', () => {
    const g = makeGame('classic', ['p'], { roundDuration: 30 });
    startWith(g, 'ήλιος', 0);
    expect(stepGame(g, 29_999, seededRng(1), tinyDict).roundEnded).toBe(false);
    expect(stepGame(g, 30_000, seededRng(1), tinyDict).roundEnded).toBe(true);
    expect(g.currentRound!.boards.p.endReason).toBe('timeout');
  });
  it('τέλος παιχνιδιού μετά από totalRounds και επανεκκίνηση', () => {
    const g = makeGame('classic', ['p'], { totalRounds: 2 });
    startGame(g, 0, seededRng(4), tinyDict);
    finishRound(g, 1000);
    nextRound(g, 2000, seededRng(4), tinyDict);
    finishRound(g, 3000);
    expect(g.status).toBe('finished');
    expect(nextRound(g, 4000, seededRng(1), tinyDict)).toBeNull();
    startGame(g, 5000, seededRng(5), tinyDict);
    expect(g.roundHistory).toHaveLength(0);
    expect(g.players[0].score).toBe(0);
    expect(g.status).toBe('playing');
  });
  it('δεν ξεκινά νέος γύρος όταν δεν έχει απομείνει κανείς', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'ήλιος');
    removePlayer(g, 'a', 1500);
    removePlayer(g, 'b', 1600);
    stepGame(g, 1700, seededRng(1), tinyDict);
    expect(g.status).toBe('roundOver');
    expect(nextRound(g, 2000, seededRng(1), tinyDict)).toBeNull();
  });
  it('στόχος πόντων τερματίζει το παιχνίδι', () => {
    const g = makeGame('classic', ['p'], { targetScore: 100, totalRounds: 10 });
    startWith(g, 'ήλιος');
    guessAll(g, 'p', 'ΗΛΙΟΣ');
    expect(g.status).toBe('finished');
  });
  it('μετατόπιση χρόνων για συνέχιση αποθηκευμένου παιχνιδιού', () => {
    const g = makeGame('classic', ['p'], { roundDuration: 60 });
    startWith(g, 'ήλιος', 0);
    shiftGameTimes(g, 100_000);
    expect(g.currentRound!.boards.p.deadline).toBe(160_000);
    expect(stepGame(g, 120_000, seededRng(1), tinyDict).roundEnded).toBe(false);
  });
});

describe('Μονομαχία', () => {
  it('ανεξάρτητη κατάσταση ανά παίκτη με κοινή λέξη', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'θάλασσα');
    applyGuess(g, 'a', 'Α', 1500);
    applyGuess(g, 'b', 'Ω', 1500);
    const r = g.currentRound!;
    expect(r.boards.a.correctLetters).toEqual(['Α']);
    expect(r.boards.b.correctLetters).toEqual([]);
    expect(r.boards.a.mistakes).toBe(0);
    expect(r.boards.b.mistakes).toBe(1);
    // ο b μπορεί να διαλέξει το ίδιο γράμμα στο δικό του ταμπλό
    expect(applyGuess(g, 'b', 'Α', 1600).ok).toBe(true);
  });
  it('η λέξη και τα γράμματα δεν φτάνουν στον αντίπαλο', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'θάλασσα');
    guessAll(g, 'a', 'ΘΑΛ');
    const vb = getView(g, 'b', 2000);
    const json = JSON.stringify(vb);
    expect(json).not.toMatch(/θάλασσα|ΘΑΛΑΣΣΑ/);
    const opp = vb.opponents.find((o) => o.playerId === 'a')!;
    expect(opp).toMatchObject({ revealedCount: 5, totalLetters: 7, mistakes: 0 });
    expect(opp.correctLetters).toBeUndefined();
    expect(vb.log.every((e) => e.type !== 'guess')).toBe(true);
    // Ακόμη κι όταν ο a λύσει τη λέξη, ο b δεν τη βλέπει πριν το τέλος
    applyGuess(g, 'a', 'Σ', 2100);
    expect(g.currentRound!.boards.a.status).toBe('won');
    expect(g.currentRound!.status).toBe('playing');
    expect(JSON.stringify(getView(g, 'b', 2200))).not.toMatch(/θάλασσα|ΘΑΛΑΣΣΑ/);
    expect(getView(g, 'a', 2200).board!.word).toBeNull();
  });
  it('ρύθμιση «full» δείχνει τα γράμματα, «hidden» κρύβει την πρόοδο', () => {
    const g = makeGame('duel', ['a', 'b'], { showOpponentProgress: 'full' });
    startWith(g, 'θάλασσα');
    applyGuess(g, 'a', 'Α', 1500);
    expect(getView(g, 'b', 1600).opponents[0].correctLetters).toEqual(['Α']);
    g.settings.showOpponentProgress = 'hidden';
    expect(getView(g, 'b', 1600).opponents).toEqual([]);
  });
  it('ο γύρος τελειώνει όταν όλοι τελειώσουν· κατάταξη από τον server', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'ήλιος', 0);
    guessAll(g, 'a', 'ΗΛΙΟΣ', 5000);
    expect(isRoundComplete(g)).toBe(false);
    guessAll(g, 'b', 'ΒΗΛΙΟΣ', 3000);
    expect(g.status).toBe('roundOver');
    const r = g.currentRound!;
    expect(r.ranking.map((x) => x.playerId)).toEqual(['a', 'b']);
    expect(r.winnerId).toBe('a');
    expect(r.scoreByPlayer).toEqual({ a: 100, b: 80 });
    expect(g.players.find((p) => p.id === 'a')!.wins).toBe(1);
    expect(g.players.find((p) => p.id === 'b')!.losses).toBe(1);
  });
  it('ισοβαθμία: ταχύτερος χρόνος κερδίζει', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'ήλιος', 0);
    guessAll(g, 'a', 'ΗΛΙΟΣ', 9000);
    guessAll(g, 'b', 'ΗΛΙΟΣ', 4000);
    expect(g.currentRound!.winnerId).toBe('b');
  });
  it('πλήρης ισοπαλία: χωρίς νικητή', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'ήλιος', 0);
    guessAll(g, 'a', 'ΗΛΙΟΣ', 4000);
    guessAll(g, 'b', 'ΗΛΙΟΣ', 4000);
    expect(g.currentRound!.winnerId).toBeNull();
    expect(g.currentRound!.ranking.every((r) => r.rank === 1 && r.tied)).toBe(true);
  });
  it('τέσσερις παίκτες με πλήρη κατάταξη', () => {
    const g = makeGame('duel', ['a', 'b', 'c', 'd'], { maxMistakes: 3 });
    startWith(g, 'ήλιος', 0);
    guessAll(g, 'c', 'ΗΛΙΟΣ', 1000);
    guessAll(g, 'a', 'ΒΗΛΙΟΣ', 1000);
    guessAll(g, 'd', 'ΒΓΔ', 1000);
    guessAll(g, 'b', 'ΒΓΗΛΙΟΣ', 1000);
    const ranks = g.currentRound!.ranking.map((r) => [r.playerId, r.rank]);
    expect(ranks).toEqual([['c', 1], ['a', 2], ['b', 3], ['d', 4]]);
  });
  it('αποσυνδεδεμένος παίκτης δεν μπλοκάρει τον γύρο', () => {
    const g = makeGame('duel', ['a', 'b']);
    startWith(g, 'ήλιος', 0);
    setConnection(g, 'b', 'disconnected', 100);
    guessAll(g, 'a', 'ΗΛΙΟΣ', 1000);
    expect(g.status).toBe('roundOver');
    expect(g.currentRound!.boards.b.endReason).toBe('abandoned');
  });
  it('ισοδύναμες λέξεις: διαφορετικές λέξεις ίδιας δυσκολίας', () => {
    const g = makeGame('duel', ['a', 'b', 'c'], { wordMode: 'equivalent' });
    startGame(g, 0, seededRng(9));
    const boards = Object.values(g.currentRound!.boards);
    expect(new Set(boards.map((b) => b.wordId)).size).toBe(3);
  });
});

describe('Συνεργατική', () => {
  it('ένα κοινό ταμπλό και κοινές προσπάθειες', () => {
    const g = makeGame('coop', ['a', 'b', 'c'], { maxMistakes: 4 });
    startWith(g, 'θάλασσα');
    expect(Object.keys(g.currentRound!.boards)).toEqual([TEAM_BOARD]);
    applyGuess(g, 'a', 'Ω', 1100);
    applyGuess(g, 'b', 'Β', 1200);
    expect(g.currentRound!.boards[TEAM_BOARD].mistakes).toBe(2);
    const va = getView(g, 'a', 1300), vc = getView(g, 'c', 1300);
    expect(va.board).toEqual(vc.board);
    expect(va.board!.guessedBy).toEqual({ Ω: 'a', Β: 'b' });
  });
  it('ταυτόχρονη επιλογή ίδιου γράμματος: δεκτή μόνο η πρώτη', () => {
    const g = makeGame('coop', ['a', 'b']);
    startWith(g, 'θάλασσα');
    const first = applyGuess(g, 'a', 'Ω', 1500);
    const second = applyGuess(g, 'b', 'ω', 1500);
    expect(first.ok).toBe(true);
    expect(second).toEqual({ ok: false, error: 'already_guessed' });
    expect(g.currentRound!.boards[TEAM_BOARD].mistakes).toBe(1);
    expect(g.currentRound!.participation.b.proposed).toBe(0);
  });
  it('κοινό σκορ και ατομικά στατιστικά συμμετοχής', () => {
    const g = makeGame('coop', ['a', 'b', 'c']);
    startWith(g, 'ήλιος');
    guessAll(g, 'a', 'ΗΛ');
    applyGuess(g, 'b', 'Β', 2000);
    guessAll(g, 'b', 'ΙΟΣ');
    const r = g.currentRound!;
    expect(r.teamScore).toBe(80);
    expect(g.teamScore).toBe(80);
    expect(r.scoreByPlayer).toEqual({ a: 80, b: 80, c: 80 });
    expect(r.participation.c).toEqual({ proposed: 0, correct: 0, incorrect: 0, hints: 0 });
    expect(r.participation.b).toMatchObject({ proposed: 4, correct: 3, incorrect: 1 });
    const v = getView(g, 'c', 3000);
    expect(v.teamSummary).toMatchObject({ totalPoints: 80, roundsWon: 1, roundsPlayed: 1, averageMistakes: 1 });
    expect(v.lastResult!.teamWon).toBe(true);
  });
  it('«ομάδα + ατομικά»: μπόνους ανά σωστό γράμμα', () => {
    const g = makeGame('coop', ['a', 'b'], { coopScoring: 'teamPlusIndividual' });
    startWith(g, 'ήλιος');
    guessAll(g, 'a', 'ΗΛΙ');
    guessAll(g, 'b', 'ΟΣ');
    expect(g.currentRound!.scoreByPlayer).toEqual({ a: 130, b: 120 });
  });
  it('η ομάδα χάνει όταν εξαντληθούν οι προσπάθειες', () => {
    const g = makeGame('coop', ['a', 'b'], { maxMistakes: 3 });
    startWith(g, 'ήλιος');
    applyGuess(g, 'a', 'Β', 1); applyGuess(g, 'b', 'Γ', 2); applyGuess(g, 'a', 'Δ', 3);
    expect(g.status).toBe('roundOver');
    expect(g.currentRound!.teamScore).toBe(0);
    expect(g.players.every((p) => p.losses === 1)).toBe(true);
  });
  it('κοινές υποδείξεις καταγράφονται στο ημερολόγιο', () => {
    const g = makeGame('coop', ['a', 'b']);
    startWith(g, 'θάλασσα');
    expect(applyHint(g, 'b', 'eliminate', 1500, seededRng(1)).ok).toBe(true);
    expect(getView(g, 'a', 1600).board!.eliminatedLetters).toHaveLength(3);
    expect(getView(g, 'a', 1600).log.at(-1)).toMatchObject({ type: 'hint', playerId: 'b' });
  });
});

describe('Bots', () => {
  it('bots σε μονομαχία παίζουν το δικό τους ταμπλό μέχρι τέλους', () => {
    const g = makeGame('duel', ['me'], { timerEnabled: false });
    const rng = seededRng(11);
    addBot(g, 'hard', rng, 0);
    addBot(g, 'easy', rng, 0);
    startGame(g, 0, rng, tinyDict);
    for (let t = 0; t < 400_000 && g.status === 'playing'; t += 250) {
      stepGame(g, t, rng, tinyDict);
      const b = g.currentRound!.boards.me;
      if (b.status === 'playing' && t === 100_000) applyGuess(g, 'me', 'Ψ', t);
      if (t === 200_000) setConnection(g, 'me', 'disconnected', t);
    }
    expect(g.status).toBe('roundOver');
    for (const p of g.players.filter((p) => p.isBot)) expect(g.currentRound!.boards[p.id].status).not.toBe('playing');
  });
  it('bots συνεργάζονται στο κοινό ταμπλό χωρίς διπλές επιλογές', () => {
    const g = makeGame('coop', ['me'], { timerEnabled: false });
    const rng = seededRng(5);
    addBot(g, 'medium', rng, 0);
    addBot(g, 'hard', rng, 0);
    addBot(g, 'easy', rng, 0);
    startGame(g, 0, rng, tinyDict);
    for (let t = 0; t < 400_000 && g.status === 'playing'; t += 200) stepGame(g, t, rng, tinyDict);
    const team = g.roundHistory[0].boards[TEAM_BOARD];
    expect(new Set(team.guessedLetters).size).toBe(team.guessedLetters.length);
    const botIds = g.players.filter((p) => p.isBot).map((p) => p.id);
    expect(Object.values(team.guessedBy).every((id) => botIds.includes(id))).toBe(true);
  });
  it('αποχώρηση παίκτη στο lobby τον αφαιρεί και μεταφέρει τον οικοδεσπότη', () => {
    const g = makeGame('duel', ['a', 'b']);
    expect(g.hostId).toBe('a');
    removePlayer(g, 'a', 10);
    expect(g.players.map((p) => p.id)).toEqual(['b']);
    expect(g.hostId).toBe('b');
    resetToLobby(g, 20);
    expect(g.status).toBe('lobby');
  });
});
