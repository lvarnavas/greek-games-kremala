// Πρωτόκολλο Socket.IO μεταξύ client και server.
import type { ActionError, BotLevel, GameView, HintType, Settings } from './types';

export const ROOM_CODE_LENGTH = 5;
/** Χωρίς χαρακτήρες που μπερδεύονται (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const MAX_ROOM_PLAYERS = 8;
export const MIN_ROOM_PLAYERS = 2;

export type RoomError =
  | ActionError
  | 'room_not_found'
  | 'room_full'
  | 'game_in_progress'
  | 'not_host'
  | 'invalid_name'
  | 'not_enough_players'
  | 'invalid_request';

export interface RoomInfo {
  code: string;
  hostId: string | null;
  playerId: string;
  token: string;
}

export interface RoomStatePayload {
  room: { code: string; hostId: string | null; minPlayers: number; maxPlayers: number };
  view: GameView;
}

export type Ack<T = unknown> = (res: ({ ok: true } & T) | { ok: false; error: RoomError }) => void;

export interface ClientToServerEvents {
  'room:create': (p: { name: string; settings?: Partial<Settings> }, ack: Ack<{ info: RoomInfo }>) => void;
  'room:join': (p: { code: string; name: string; token?: string }, ack: Ack<{ info: RoomInfo }>) => void;
  'room:leave': (ack?: Ack) => void;
  'room:settings': (p: { settings: Partial<Settings> }, ack?: Ack) => void;
  'room:addBot': (p: { level: BotLevel }, ack?: Ack) => void;
  'room:removePlayer': (p: { playerId: string }, ack?: Ack) => void;
  'room:start': (ack?: Ack) => void;
  'room:next': (ack?: Ack) => void;
  'room:lobby': (ack?: Ack) => void;
  'game:guess': (p: { letter: string }, ack?: Ack<{ correct?: boolean }>) => void;
  'game:hint': (p: { hint: HintType }, ack?: Ack) => void;
  'time:sync': (ack: (serverNow: number) => void) => void;
}

export interface ServerToClientEvents {
  'room:state': (p: RoomStatePayload) => void;
  'room:kicked': () => void;
}

export const ERROR_MESSAGES: Record<RoomError, string> = {
  invalid_letter: 'Μη έγκυρο γράμμα.',
  already_guessed: 'Το γράμμα έχει ήδη επιλεγεί.',
  eliminated: 'Το γράμμα έχει αφαιρεθεί με υπόδειξη.',
  not_playing: 'Ο γύρος δεν είναι ενεργός.',
  time_up: 'Ο χρόνος τελείωσε.',
  hints_disabled: 'Οι υποδείξεις είναι απενεργοποιημένες.',
  no_hints_left: 'Δεν απομένουν υποδείξεις.',
  hint_unavailable: 'Η υπόδειξη δεν είναι διαθέσιμη.',
  not_in_game: 'Δεν συμμετέχεις σε αυτόν τον γύρο.',
  rate_limited: 'Πολύ γρήγορα! Περίμενε λίγο.',
  room_not_found: 'Το δωμάτιο δεν βρέθηκε.',
  room_full: 'Το δωμάτιο είναι γεμάτο.',
  game_in_progress: 'Το παιχνίδι έχει ήδη ξεκινήσει.',
  not_host: 'Μόνο ο οικοδεσπότης μπορεί να το κάνει αυτό.',
  invalid_name: 'Δώσε ένα όνομα (1–20 χαρακτήρες).',
  not_enough_players: 'Χρειάζονται τουλάχιστον 2 παίκτες.',
  invalid_request: 'Μη έγκυρο αίτημα.',
};
