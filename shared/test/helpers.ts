import { createGame, createPlayer, startRound, type Dictionary, type Game, type Settings, type WordEntry, seededRng } from '../src';

export const word = (w: string, id = w, category = 'test'): WordEntry => ({ id, word: w, category, difficulty: 'medium', ease: 50 });

export function makeGame(mode: Settings['gameMode'], playerIds: string[], settings: Partial<Settings> = {}, now = 1000): Game {
  const players = playerIds.map((id) => createPlayer({ id, displayName: id.toUpperCase(), now }));
  return createGame({ id: 'g1', settings: { gameMode: mode, ...settings }, players, now });
}

/** Ξεκινά γύρο με συγκεκριμένη λέξη για όλα τα ταμπλό. */
export function startWith(game: Game, w: string | Record<string, string>, now = 1000): void {
  game.mode = game.settings.gameMode;
  const keys = game.mode === 'coop' ? ['__team__'] : game.players.map((p) => p.id);
  const words = Object.fromEntries(keys.map((k) => [k, word(typeof w === 'string' ? w : w[k])]));
  startRound(game, words, now, seededRng(1));
}

export const tinyDict: Dictionary = {
  categories: [{ id: 'test', name: 'Δοκιμή', icon: '🧪' }],
  words: ['θάλασσα', 'βουνό', 'ποτάμι', 'λίμνη', 'δάσος', 'νησί', 'ήλιος', 'κύμα'].map((w, i) => word(w, `t-${i}`)),
};
