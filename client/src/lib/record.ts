import type { GameView } from '@kremala/shared';
import type { GameRecord } from './db';

/** Μετατρέπει την τελική προβολή ενός παιχνιδιού σε εγγραφή στατιστικών. */
export function recordFromView(view: GameView, opts: { online: boolean }): GameRecord {
  const me = view.players.find((p) => p.id === view.viewerId);
  let streak = 0, bestStreak = 0, roundsWon = 0, totalMistakes = 0;
  for (const r of view.history) {
    const won = view.mode === 'coop' ? r.teamWon === true : view.mode === 'duel' ? r.winnerId === view.viewerId : r.statusByPlayer[view.viewerId] === 'won';
    if (won) {
      roundsWon += 1;
      streak += 1;
      bestStreak = Math.max(bestStreak, streak);
    } else streak = 0;
    totalMistakes += r.mistakesByPlayer[view.viewerId] ?? 0;
  }
  return {
    gameId: view.id,
    finishedAt: Date.now(),
    mode: view.mode,
    online: opts.online,
    withBots: view.players.some((p) => p.isBot),
    players: view.players.filter((p) => p.connectionStatus !== 'left').length,
    roundsPlayed: view.history.length,
    roundsWon,
    score: me?.score ?? 0,
    teamScore: view.mode === 'coop' ? view.teamScore : null,
    rank: view.finalRanking?.find((r) => r.playerId === view.viewerId)?.rank ?? null,
    bestStreak,
    totalMistakes,
  };
}
