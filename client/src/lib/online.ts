// Σύνδεση με τον server (Socket.IO) για online δωμάτια.
import { io, type Socket } from 'socket.io-client';
import type {
  BotLevel,
  ClientToServerEvents,
  HintType,
  RoomError,
  RoomInfo,
  RoomStatePayload,
  ServerToClientEvents,
  Settings,
} from '@kremala/shared';

type KSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
export type ConnState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';

const SESSION_KEY = 'kremala.session';
const SERVER_URL = (import.meta.env.VITE_SERVER_URL as string | undefined) || undefined;

export interface StoredSession {
  code: string;
  token: string;
  name: string;
}

// Η συνεδρία (κωδικός + token) αποθηκεύεται ανά καρτέλα (sessionStorage) ώστε
// δύο καρτέλες να μην μπερδεύονται, και στο localStorage ως εφεδρεία για
// επανασύνδεση όταν ανοίξει ξανά η εφαρμογή.
export function loadSession(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}
function storeSession(s: StoredSession | null): void {
  try {
    if (s) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ιδιωτική περιήγηση: συνεχίζουμε χωρίς επανασύνδεση */
  }
}

type Res<T = object> = ({ ok: true } & T) | { ok: false; error: RoomError };

export interface OnlineSnapshot {
  conn: ConnState;
  state: RoomStatePayload | null;
  info: RoomInfo | null;
  clockOffset: number;
  kicked: boolean;
}

/** Ένας client ανά εφαρμογή· οι React components εγγράφονται στις αλλαγές. */
export class OnlineClient {
  private socket: KSocket | null = null;
  private listeners = new Set<(s: OnlineSnapshot) => void>();
  snap: OnlineSnapshot = { conn: 'idle', state: null, info: null, clockOffset: 0, kicked: false };

  subscribe(fn: (s: OnlineSnapshot) => void): () => void {
    this.listeners.add(fn);
    fn(this.snap);
    return () => this.listeners.delete(fn);
  }

  private set(patch: Partial<OnlineSnapshot>): void {
    this.snap = { ...this.snap, ...patch };
    for (const l of this.listeners) l(this.snap);
  }

  private ensureSocket(): KSocket {
    if (this.socket) return this.socket;
    const s: KSocket = io(SERVER_URL ?? '/', { transports: ['websocket', 'polling'], reconnectionDelayMax: 4000, autoConnect: true });
    this.socket = s;
    this.set({ conn: 'connecting' });
    s.on('connect', () => {
      this.set({ conn: 'connected' });
      this.syncClock();
      // Επανασύνδεση στο ίδιο δωμάτιο μετά από διακοπή.
      const session = loadSession();
      if (session && this.snap.info) {
        s.emit('room:join', { code: session.code, name: session.name, token: session.token }, (res) => {
          if (!res.ok) {
            storeSession(null);
            this.set({ info: null, state: null });
          }
        });
      }
    });
    s.on('disconnect', () => this.set({ conn: navigator.onLine ? 'reconnecting' : 'offline' }));
    s.io.on('reconnect_attempt', () => this.set({ conn: 'reconnecting' }));
    s.on('room:state', (p) => this.set({ state: p }));
    s.on('room:kicked', () => {
      storeSession(null);
      this.set({ info: null, state: null, kicked: true });
    });
    return s;
  }

  private syncClock(): void {
    const t0 = Date.now();
    this.socket?.emit('time:sync', (serverNow) => {
      const t1 = Date.now();
      this.set({ clockOffset: serverNow + (t1 - t0) / 2 - t1 });
    });
  }

  private call<T>(fn: (s: KSocket, done: (r: Res<T>) => void) => void, timeoutMs = 8000): Promise<Res<T>> {
    const s = this.ensureSocket();
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'invalid_request' }), timeoutMs);
      fn(s, (r) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  async create(name: string, settings: Partial<Settings>): Promise<Res> {
    const res = await this.call<{ info: RoomInfo }>((s, done) => s.emit('room:create', { name, settings }, done as never));
    if (res.ok) {
      storeSession({ code: res.info.code, token: res.info.token, name });
      this.set({ info: res.info, kicked: false });
    }
    return res;
  }

  async join(code: string, name: string): Promise<Res> {
    const prev = loadSession();
    const token = prev && prev.code === code.toUpperCase() ? prev.token : undefined;
    const res = await this.call<{ info: RoomInfo }>((s, done) => s.emit('room:join', { code: code.toUpperCase(), name, token }, done as never));
    if (res.ok) {
      storeSession({ code: res.info.code, token: res.info.token, name });
      this.set({ info: res.info, kicked: false });
    }
    return res;
  }

  /** Προσπάθεια επανασύνδεσης με αποθηκευμένη συνεδρία (π.χ. μετά από reload). */
  async resume(): Promise<boolean> {
    const session = loadSession();
    if (!session) return false;
    const res = await this.join(session.code, session.name);
    if (!res.ok) storeSession(null);
    return res.ok;
  }

  async leave(): Promise<void> {
    if (this.socket) await this.call((s, done) => s.emit('room:leave', done as never), 2000);
    storeSession(null);
    this.set({ info: null, state: null });
  }

  settings(settings: Partial<Settings>) {
    return this.call((s, done) => s.emit('room:settings', { settings }, done as never));
  }
  addBot(level: BotLevel) {
    return this.call((s, done) => s.emit('room:addBot', { level }, done as never));
  }
  removePlayer(playerId: string) {
    return this.call((s, done) => s.emit('room:removePlayer', { playerId }, done as never));
  }
  start() {
    return this.call((s, done) => s.emit('room:start', done as never));
  }
  next() {
    return this.call((s, done) => s.emit('room:next', done as never));
  }
  lobby() {
    return this.call((s, done) => s.emit('room:lobby', done as never));
  }
  guess(letter: string) {
    return this.call<{ correct?: boolean }>((s, done) => s.emit('game:guess', { letter }, done as never));
  }
  hint(hint: HintType) {
    return this.call((s, done) => s.emit('game:hint', { hint }, done as never));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.set({ conn: 'idle' });
  }
}

export const online = new OnlineClient();
