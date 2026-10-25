import { useState } from 'react';
import type { GameMode } from '@kremala/shared';
import { Badge, Button, Modal } from '../components/ui';
import { MODE_LABEL } from '../lib/format';
import type { SavedProgress } from '../lib/db';

export type HomeAction =
  | { type: 'local'; mode: GameMode }
  | { type: 'bots' }
  | { type: 'online'; mode?: GameMode }
  | { type: 'continue' }
  | { type: 'stats' | 'howto' | 'settings' };

const CARDS: { mode: GameMode; icon: string; players: string; text: string[]; color: string }[] = [
  { mode: 'classic', icon: '🎯', players: '1 παίκτης', text: ['Επιλογή κατηγορίας και δυσκολίας', 'Ιδανική για γρήγορο παιχνίδι', 'Παίζει και offline'], color: 'from-indigo-600 to-indigo-800' },
  { mode: 'duel', icon: '⚔️', players: '2–8 παίκτες', text: ['Ανταγωνιστικό παιχνίδι', 'Ατομική βαθμολογία & κατάταξη', 'Online ή εναντίον bots'], color: 'from-rose-500 to-rose-700' },
  { mode: 'coop', icon: '🤝', players: '2–8 παίκτες', text: ['Όλοι εναντίον της ίδιας λέξης', 'Κοινές προσπάθειες & χρονόμετρο', 'Online ή με bots'], color: 'from-emerald-500 to-teal-700' },
];

export function Home({ onAction, saved, isOnline }: { onAction: (a: HomeAction) => void; saved: SavedProgress | null; isOnline: boolean }) {
  const [choose, setChoose] = useState<GameMode | null>(null);
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-4xl flex-col gap-5 px-4 pb-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-12 w-12 rounded-2xl shadow" />
        <div className="flex-1">
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Κρεμάλα</h1>
          <p className="text-sm text-ink-soft dark:text-slate-400">Το κλασικό παιχνίδι λέξεων στα ελληνικά</p>
        </div>
        {!isOnline && <Badge tone="amber">📴 Εκτός σύνδεσης</Badge>}
      </header>

      {saved && (
        <button
          onClick={() => onAction({ type: 'continue' })}
          className="flex items-center gap-3 rounded-2xl bg-amber-100 p-4 text-left ring-1 ring-amber-300 transition hover:bg-amber-200 dark:bg-amber-500/15 dark:ring-amber-500/30"
        >
          <span className="text-3xl">▶️</span>
          <span className="flex-1">
            <span className="block font-semibold">Συνέχεια παιχνιδιού</span>
            <span className="text-sm text-ink-soft dark:text-slate-300">
              {MODE_LABEL[saved.game.mode]} · γύρος {saved.game.currentRound?.index ?? 1}/{saved.game.settings.totalRounds}
            </span>
          </span>
        </button>
      )}

      <section className="grid gap-4 md:grid-cols-3" aria-label="Τρόποι παιχνιδιού">
        {CARDS.map((c) => (
          <article key={c.mode} className={`flex flex-col rounded-3xl bg-gradient-to-br ${c.color} p-5 text-white shadow-lg`}>
            <div className="flex items-start justify-between">
              <span className="text-5xl" aria-hidden>{c.icon}</span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold">👥 {c.players}</span>
            </div>
            <h2 className="mt-3 font-display text-2xl font-bold">{MODE_LABEL[c.mode]}</h2>
            <ul className="mt-2 flex-1 space-y-1 text-sm text-white/90">
              {c.text.map((t) => (
                <li key={t}>• {t}</li>
              ))}
            </ul>
            <Button variant="accent" size="lg" className="mt-4" onClick={() => (c.mode === 'classic' ? onAction({ type: 'local', mode: 'classic' }) : setChoose(c.mode))}>
              Έναρξη
            </Button>
          </article>
        ))}
      </section>

      <nav className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Κεντρικό μενού">
        <MenuItem icon="🤖" label="Παίξε με bots" onClick={() => onAction({ type: 'bots' })} />
        <MenuItem icon="🌐" label="Παίξε online" onClick={() => onAction({ type: 'online' })} disabled={!isOnline} note={!isOnline ? 'Απαιτεί σύνδεση' : undefined} />
        <MenuItem icon="📊" label="Στατιστικά" onClick={() => onAction({ type: 'stats' })} />
        <MenuItem icon="📖" label="Πώς παίζεται" onClick={() => onAction({ type: 'howto' })} />
        <MenuItem icon="⚙️" label="Ρυθμίσεις" onClick={() => onAction({ type: 'settings' })} />
      </nav>

      {choose && (
        <Modal label={`${MODE_LABEL[choose]}: επιλογή αντιπάλων`} onClose={() => setChoose(null)}>
          <h2 className="font-display text-2xl font-bold">{MODE_LABEL[choose]}</h2>
          <p className="mb-4 text-ink-soft dark:text-slate-400">Με ποιους θέλεις να παίξεις;</p>
          <div className="grid gap-3">
            <ChoiceButton icon="🤖" title="Με bots" text="1–3 bots σε τρία επίπεδα. Λειτουργεί και offline." onClick={() => onAction({ type: 'local', mode: choose })} />
            <ChoiceButton
              icon="🌐"
              title="Online με φίλους"
              text={isOnline ? 'Ιδιωτικό δωμάτιο με κωδικό ή σύνδεσμο πρόσκλησης.' : 'Απαιτεί σύνδεση στο διαδίκτυο.'}
              disabled={!isOnline}
              onClick={() => onAction({ type: 'online', mode: choose })}
            />
          </div>
        </Modal>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, disabled, note }: { icon: string; label: string; onClick: () => void; disabled?: boolean; note?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-3 rounded-2xl bg-white p-4 text-left font-semibold shadow-sm ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:shadow disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/5 dark:ring-white/10"
    >
      <span className="text-2xl" aria-hidden>{icon}</span>
      <span>
        {label}
        {note && <span className="block text-xs font-normal text-amber-700 dark:text-amber-300">{note}</span>}
      </span>
    </button>
  );
}

function ChoiceButton({ icon, title, text, onClick, disabled }: { icon: string; title: string; text: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} className="flex items-center gap-4 rounded-2xl bg-white p-4 text-left ring-1 ring-black/10 transition hover:bg-indigo-50 disabled:opacity-50 dark:bg-white/5 dark:ring-white/10 dark:hover:bg-white/10">
      <span className="text-4xl" aria-hidden>{icon}</span>
      <span>
        <span className="block text-lg font-bold">{title}</span>
        <span className="text-sm text-ink-soft dark:text-slate-400">{text}</span>
      </span>
    </button>
  );
}
