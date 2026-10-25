// Integration test: πραγματικός server Socket.IO με δύο clients.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { io as ioc, type Socket } from 'socket.io-client';
import { seededRng, type RoomStatePayload, type Dictionary } from '@kremala/shared';
import { createKremalaServer } from '../src/app';

const dict: Dictionary = {
  categories: [{ id: 'c', name: 'Δοκιμή', icon: '🧪' }],
  words: [{ id: 'w1', word: 'ήλιος', category: 'c', difficulty: 'easy', ease: 60 }],
};

let server: ReturnType<typeof createKremalaServer>;
let url = '';
const clients: Socket[] = [];

beforeEach(async () => {
  server = createKremalaServer({ rng: seededRng(3), dictionary: dict, tickMs: 50 });
  const port = await server.listen(0, '127.0.0.1');
  url = `http://127.0.0.1:${port}`;
});
afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await server.close();
});

function client() {
  const s = ioc(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  clients.push(s);
  const received: string[] = [];
  let last: RoomStatePayload | null = null;
  s.on('room:state', (p) => {
    received.push(JSON.stringify(p));
    last = p;
  });
  const emit = <T = any>(ev: string, ...args: unknown[]) => new Promise<T>((r) => (s.emit as any)(ev, ...args, r));
  return { s, received, emit, state: () => last! };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(fn: () => boolean, ms = 2000) {
  const t = Date.now();
  while (!fn()) {
    if (Date.now() - t > ms) throw new Error('timeout');
    await wait(10);
  }
}

describe('Socket.IO δωμάτια', () => {
  it('δύο συσκευές στο ίδιο δωμάτιο, μονομαχία με συγχρονισμό και απόκρυψη λέξης', async () => {
    const a = client(), b = client();
    const created = await a.emit<any>('room:create', { name: 'Άννα', settings: { gameMode: 'duel' } });
    expect(created.ok).toBe(true);
    const joined = await b.emit<any>('room:join', { code: created.info.code.toLowerCase(), name: 'Βασίλης' });
    expect(joined.ok).toBe(true);
    await until(() => a.state()?.view.players.length === 2);
    expect((await a.emit<any>('room:start')).ok).toBe(true);
    await until(() => b.state()?.view.status === 'playing');

    for (const l of ['Η', 'Λ', 'Ι', 'Ο']) await a.emit('game:guess', { letter: l });
    await until(() => b.state()?.view.opponents[0]?.revealedCount === 4);
    expect(b.state().view.opponents[0].correctLetters).toBeUndefined();
    // Κανένα μήνυμα προς τον b δεν περιέχει τη λέξη
    expect(b.received.join('\n')).not.toMatch(/ήλιος|ΗΛΙΟΣ/);

    await a.emit('game:guess', { letter: 'Σ' });
    for (const l of ['Β', 'Η', 'Λ', 'Ι', 'Ο', 'Σ']) await b.emit('game:guess', { letter: l });
    await until(() => b.state()?.view.status === 'roundOver');
    const result = b.state().view.lastResult!;
    expect(result.ranking.map((r) => r.playerId)).toEqual([created.info.playerId, joined.info.playerId]);
    expect(result.winnerId).toBe(created.info.playerId);
    expect(result.words[created.info.playerId]).toBe('ήλιος');
  });

  it('συνεργατική: ίδια κατάσταση σε όλους, διπλό γράμμα απορρίπτεται', async () => {
    const a = client(), b = client();
    const created = await a.emit<any>('room:create', { name: 'Άννα', settings: { gameMode: 'coop' } });
    await b.emit('room:join', { code: created.info.code, name: 'Βασίλης' });
    await a.emit('room:start');
    await until(() => b.state()?.view.status === 'playing');
    const [r1, r2] = await Promise.all([a.emit<any>('game:guess', { letter: 'Ω' }), b.emit<any>('game:guess', { letter: 'ω' })]);
    expect([r1.ok, r2.ok].filter(Boolean)).toHaveLength(1);
    expect([r1, r2].find((r) => !r.ok).error).toBe('already_guessed');
    await b.emit('game:guess', { letter: 'Η' });
    await until(() => a.state()?.view.board?.correctLetters.includes('Η') ?? false);
    expect(a.state().view.board).toEqual(b.state().view.board);
    expect(a.state().view.board!.mistakes).toBe(1);
  });

  it('επανασύνδεση παίκτη με token διατηρεί την πρόοδο', async () => {
    const a = client(), b = client();
    const created = await a.emit<any>('room:create', { name: 'Άννα', settings: { gameMode: 'duel' } });
    const joined = await b.emit<any>('room:join', { code: created.info.code, name: 'Βασίλης' });
    await a.emit('room:start');
    await until(() => b.state()?.view.status === 'playing');
    await b.emit('game:guess', { letter: 'Ω' });
    await b.emit('game:guess', { letter: 'Η' });
    b.s.disconnect();
    await until(() => a.state()?.view.players.find((p) => p.id === joined.info.playerId)?.connectionStatus === 'disconnected');
    const b2 = client();
    const re = await b2.emit<any>('room:join', { code: created.info.code, name: 'x', token: joined.info.token });
    expect(re.ok).toBe(true);
    expect(re.info.playerId).toBe(joined.info.playerId);
    await until(() => !!b2.state());
    expect(b2.state().view.board!.guessedLetters).toEqual(['Ω', 'Η']);
    expect(b2.state().view.board!.mistakes).toBe(1);
  });

  it('health endpoint', async () => {
    const res = await fetch(`${url}/health`);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe('Πολλαπλά sockets ανά παίκτη', () => {
  it('δεύτερη σύνδεση του ίδιου παίκτη δεν αποσυνδέει την πρώτη', async () => {
    const a = client(), b = client();
    const created = await a.emit<any>('room:create', { name: 'Άννα' });
    const a2 = client();
    await a2.emit('room:join', { code: created.info.code, name: 'x', token: created.info.token });
    a2.s.disconnect();
    await wait(50);
    await b.emit('room:join', { code: created.info.code, name: 'Βασίλης' });
    await until(() => a.state()?.view.players.length === 2);
    expect(a.state().view.players[0].connectionStatus).toBe('connected');
  });
});
