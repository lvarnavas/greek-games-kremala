import type { BoardStatus, DifficultySetting, EndReason, GameMode, Player } from '@kremala/shared';

export const MODE_LABEL: Record<GameMode, string> = { classic: 'Κλασική Κρεμάλα', duel: 'Μονομαχία', coop: 'Συνεργατική Κρεμάλα' };
export const MODE_ICON: Record<GameMode, string> = { classic: '🎯', duel: '⚔️', coop: '🤝' };
export const DIFFICULTY_LABEL: Record<DifficultySetting, string> = { any: 'Όλες', easy: 'Εύκολη', medium: 'Μέτρια', hard: 'Δύσκολη' };
export const STATUS_LABEL: Record<BoardStatus, string> = { playing: 'Παίζει', won: 'Νίκη', lost: 'Ήττα' };
export const END_REASON_LABEL: Record<EndReason, string> = {
  solved: 'Βρέθηκε η λέξη',
  mistakes: 'Εξαντλήθηκαν οι προσπάθειες',
  timeout: 'Τέλος χρόνου',
  abandoned: 'Αποχώρηση',
};

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60), s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 100) / 10;
  return s < 60 ? `${s.toFixed(1).replace('.', ',')}″` : formatTime(ms);
}

export function playerName(players: Player[], id: string, viewerId?: string): string {
  if (id === viewerId) return 'Εσύ';
  return players.find((p) => p.id === id)?.displayName ?? '—';
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
