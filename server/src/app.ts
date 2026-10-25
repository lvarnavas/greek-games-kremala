import express from 'express';
import { createServer, type Server as HttpServer } from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@kremala/shared';
import { RoomManager, type Room, type RoomManagerOptions } from './rooms';

export interface KremalaServerOptions extends RoomManagerOptions {
  clientOrigin?: string | string[];
  staticDir?: string;
  tickMs?: number;
  clock?: () => number;
}

interface SocketData {
  code?: string;
  playerId?: string;
}

export function createKremalaServer(options: KremalaServerOptions = {}) {
  const clock = options.clock ?? Date.now;
  const manager = new RoomManager(options);
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.json({ ok: true, rooms: manager.rooms.size }));

  if (options.staticDir && fs.existsSync(options.staticDir)) {
    const dir = options.staticDir;
    app.use(express.static(dir, { index: false, maxAge: '1h', setHeaders: (res, file) => {
      if (file.endsWith('sw.js') || file.endsWith('.webmanifest') || file.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache');
    } }));
    app.get('*', (_req, res) => res.sendFile(path.join(dir, 'index.html')));
  }

  const http: HttpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(http, {
    cors: options.clientOrigin ? { origin: options.clientOrigin } : undefined,
    connectionStateRecovery: { maxDisconnectionDuration: 30_000 },
    maxHttpBufferSize: 16_000,
  });

  /** Στέλνει σε κάθε παίκτη τη δική του, φιλτραρισμένη προβολή. */
  const broadcast = (room: Room) => {
    const now = clock();
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.code === room.code && socket.data.playerId) {
        socket.emit('room:state', manager.payloadFor(room, socket.data.playerId, now));
      }
    }
  };

  io.on('connection', (socket) => {
    const current = () => (socket.data.code ? manager.get(socket.data.code) : undefined);
    // Ένας παίκτης μπορεί να έχει πολλά sockets (π.χ. δύο καρτέλες ή
    // επανασύνδεση πριν κλείσει το παλιό)· όλα λαμβάνουν την ίδια προβολή.
    const bind = (room: Room, playerId: string) => {
      socket.data.code = room.code;
      socket.data.playerId = playerId;
      socket.join(room.code);
    };
    const safeAck = (ack: unknown) => (typeof ack === 'function' ? (ack as (r: unknown) => void) : () => {});

    const withRoom = <T>(ack: unknown, fn: (room: Room, playerId: string, now: number) => T) => {
      const room = current();
      const reply = safeAck(ack);
      if (!room || !socket.data.playerId) return reply({ ok: false, error: 'room_not_found' });
      const res = fn(room, socket.data.playerId, clock());
      reply(res);
      broadcast(room);
    };

    socket.on('time:sync', (ack) => safeAck(ack)(clock()));

    socket.on('room:create', (p, ack) => {
      const reply = safeAck(ack);
      const res = manager.create(p?.name, p?.settings, clock());
      if (!res.ok) return reply(res);
      bind(res.room, res.info.playerId);
      reply({ ok: true, info: res.info });
      broadcast(res.room);
    });

    socket.on('room:join', (p, ack) => {
      const reply = safeAck(ack);
      const res = manager.join(p?.code, p?.name, p?.token, clock());
      if (!res.ok) return reply(res);
      bind(res.room, res.info.playerId);
      reply({ ok: true, info: res.info });
      broadcast(res.room);
    });

    socket.on('room:leave', (ack) => {
      const room = current();
      if (room && socket.data.playerId) {
        manager.leave(room, socket.data.playerId, clock());
        socket.leave(room.code);
        socket.data = {};
        broadcast(room);
      }
      safeAck(ack)({ ok: true });
    });

    socket.on('room:settings', (p, ack) => withRoom(ack, (r, id, now) => manager.updateSettings(r, id, p?.settings, now)));
    socket.on('room:addBot', (p, ack) => withRoom(ack, (r, id, now) => manager.addBot(r, id, p?.level, now)));
    socket.on('room:removePlayer', (p, ack) =>
      withRoom(ack, (r, id, now) => {
        const res = manager.kick(r, id, p?.playerId, now);
        if (res.ok) {
          for (const s of io.sockets.sockets.values()) {
            if (s.data.playerId === res.kickedId) {
              s.emit('room:kicked');
              s.data = {};
            }
          }
        }
        return res.ok ? { ok: true } : res;
      }),
    );
    socket.on('room:start', (ack) => withRoom(ack, (r, id, now) => manager.start(r, id, now)));
    socket.on('room:next', (ack) => withRoom(ack, (r, id, now) => manager.next(r, id, now)));
    socket.on('room:lobby', (ack) => withRoom(ack, (r, id, now) => manager.backToLobby(r, id, now)));
    socket.on('game:guess', (p, ack) => withRoom(ack, (r, id, now) => manager.guess(r, id, p?.letter, now)));
    socket.on('game:hint', (p, ack) => withRoom(ack, (r, id, now) => manager.hint(r, id, p?.hint, now)));

    socket.on('disconnect', () => {
      const room = current();
      const pid = socket.data.playerId;
      if (!room || !pid) return;
      // Αν υπάρχει άλλο ενεργό socket για τον ίδιο παίκτη, δεν τον αποσυνδέουμε.
      const stillHere = [...io.sockets.sockets.values()].some((s) => s.id !== socket.id && s.data.playerId === pid);
      if (!stillHere) {
        manager.disconnect(room, pid, clock());
        broadcast(room);
      }
    });
  });

  const tickMs = options.tickMs ?? 250;
  let timer: NodeJS.Timeout | null = null;
  const startTicking = () => {
    timer ??= setInterval(() => {
      for (const room of manager.tick(clock())) broadcast(room);
    }, tickMs);
  };

  return {
    app,
    http,
    io,
    manager,
    broadcast,
    listen(port: number, host?: string): Promise<number> {
      startTicking();
      return new Promise((resolve) => {
        http.listen(port, host, () => {
          const addr = http.address();
          resolve(typeof addr === 'object' && addr ? addr.port : port);
        });
      });
    },
    async close(): Promise<void> {
      if (timer) clearInterval(timer);
      timer = null;
      io.close();
      await new Promise<void>((r) => (http.listening ? http.close(() => r()) : r()));
    },
  };
}
