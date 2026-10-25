import type { GameView, LogEntry } from '@kremala/shared';
import { playerName } from '../lib/format';
import { Hangman } from './Hangman';

const dot = (status: string) =>
  status === 'connected' || status === 'bot' ? 'bg-emerald-500' : status === 'disconnected' ? 'bg-amber-500' : 'bg-slate-400';

/** Μονομαχία: κατάσταση αντιπάλων χωρίς αποκάλυψη της λέξης. */
export function OpponentsPanel({ view }: { view: GameView }) {
  if (view.opponents.length === 0) return null;
  return (
    <section aria-label="Αντίπαλοι" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {view.opponents.map((o) => {
        const p = view.players.find((x) => x.id === o.playerId);
        const pct = o.totalLetters ? Math.round((o.revealedCount / o.totalLetters) * 100) : 0;
        return (
          <div key={o.playerId} className="flex items-center gap-3 rounded-xl bg-white p-2 ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
            <Hangman mistakes={o.mistakes} maxMistakes={o.maxMistakes} lost={o.status === 'lost'} won={o.status === 'won'} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 font-semibold">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot(p?.connectionStatus ?? 'left')}`} aria-hidden />
                <span className="truncate">{p?.displayName}</span>
                {p?.isBot && <span title="Bot">🤖</span>}
                <span className="ml-auto text-sm font-normal tabular-nums">{p?.score ?? 0} π.</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Πρόοδος ${p?.displayName}`}>
                <div className={`h-full rounded-full ${o.status === 'won' ? 'bg-emerald-500' : o.status === 'lost' ? 'bg-rose-400' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
              </div>
              <div className="mt-0.5 text-xs text-ink-soft dark:text-slate-400">
                {o.status === 'won' ? '✅ Τελείωσε' : o.status === 'lost' ? '❌ Έχασε' : `${o.revealedCount}/${o.totalLetters} γράμματα`} · {o.mistakes}/{o.maxMistakes} λάθη
                {o.correctLetters && o.status === 'playing' && (
                  <span className="block truncate">
                    ✓ {o.correctLetters.join(' ') || '—'} · ✗ {o.incorrectLetters?.join(' ') || '—'}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </section>
  );
}

export function PlayersList({ view }: { view: GameView }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Παίκτες">
      {view.players
        .filter((p) => p.connectionStatus !== 'left')
        .map((p) => (
          <li key={p.id} className="flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-sm ring-1 ring-black/5 dark:bg-white/10 dark:ring-white/10">
            <span className={`h-2 w-2 rounded-full ${dot(p.connectionStatus)}`} aria-hidden />
            {p.id === view.viewerId ? 'Εσύ' : p.displayName}
            {p.isBot && <span aria-label="bot">🤖</span>}
            {p.connectionStatus === 'disconnected' && <span className="text-xs text-amber-700 dark:text-amber-300">(αποσυνδ.)</span>}
          </li>
        ))}
    </ul>
  );
}

function describe(e: LogEntry, view: GameView): string {
  const who = 'playerId' in e ? playerName(view.players, e.playerId, view.viewerId) : '';
  switch (e.type) {
    case 'guess':
      return `${who}: «${e.letter}» ${e.correct ? '✅' : '❌'}`;
    case 'hint':
      return `${who} χρησιμοποίησε υπόδειξη (${e.hint === 'reveal' ? `αποκάλυψη ${e.letters.join(', ')}` : `αφαίρεση ${e.letters.join(', ')}`})`;
    case 'finished':
      return `${who} ${e.won ? 'βρήκε τη λέξη 🎉' : 'έχασε'}`;
    case 'timeout':
      return '⏱ Τέλος χρόνου';
  }
}

export function ActivityLog({ view }: { view: GameView }) {
  const items = view.log.slice(-6).reverse();
  return (
    <section aria-label="Τελευταίες ενέργειες" className="rounded-xl bg-white p-3 text-sm ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10">
      <h3 className="mb-1 font-semibold">Τελευταίες ενέργειες</h3>
      {items.length === 0 ? (
        <p className="text-ink-soft dark:text-slate-400">Κανένα γράμμα ακόμη — ξεκινήστε!</p>
      ) : (
        <ul className="space-y-0.5" aria-live="polite">
          {items.map((e, i) => (
            <li key={`${e.at}-${i}`} className={i === 0 ? 'font-medium' : 'text-ink-soft dark:text-slate-400'}>
              {describe(e, view)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
