import { useEffect, useState } from 'react';
import { Stat } from '../components/Results';
import { Button, Card, Modal, Screen } from '../components/ui';
import { clearGames, computeStats, listGames, type Stats as S } from '../lib/db';
import { MODE_ICON, MODE_LABEL } from '../lib/format';

export function Stats({ onBack }: { onBack: () => void }) {
  const [stats, setStats] = useState<S | null>(null);
  const [confirm, setConfirm] = useState(false);
  const load = () => void listGames().then((g) => setStats(computeStats(g)));
  useEffect(load, []);
  if (!stats) return <Screen title="Στατιστικά" onBack={onBack}><p>Φόρτωση…</p></Screen>;
  return (
    <Screen title="Στατιστικά" onBack={onBack}>
      {stats.gamesPlayed === 0 ? (
        <Card className="text-center">
          <p className="text-4xl">📊</p>
          <p className="mt-2">Δεν έχεις ολοκληρώσει παιχνίδι ακόμη. Παίξε έναν γύρο και τα στατιστικά θα εμφανιστούν εδώ!</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Stat label="Παιχνίδια" value={stats.gamesPlayed} />
            <Stat label="Λέξεις που βρήκες" value={`${stats.roundsWon}/${stats.roundsPlayed}`} />
            <Stat label="Ποσοστό επιτυχίας" value={`${stats.winRate}%`} />
            <Stat label="Καλύτερο σκορ" value={stats.bestScore} />
            <Stat label="Καλύτερο σερί" value={stats.bestStreak} />
            <Stat label="Νίκες σε μονομαχίες" value={stats.duelWins} />
          </div>
          <Card>
            <h2 className="mb-2 font-semibold">Ανά τρόπο παιχνιδιού</h2>
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {(['classic', 'duel', 'coop'] as const).map((m) => {
                const s = stats.byMode[m];
                return (
                  <li key={m} className="flex items-center justify-between py-2">
                    <span>{MODE_ICON[m]} {MODE_LABEL[m]}</span>
                    <span className="text-sm text-ink-soft dark:text-slate-300">
                      {s.games} παιχνίδια · {s.roundsWon}/{s.roundsPlayed} λέξεις · {s.points} π.
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
          <Card>
            <h2 className="mb-2 font-semibold">Πρόσφατα παιχνίδια</h2>
            <ul className="divide-y divide-black/5 text-sm dark:divide-white/10">
              {stats.recent.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 py-2">
                  <span>
                    {MODE_ICON[g.mode]} {MODE_LABEL[g.mode]} {g.online ? '🌐' : g.withBots ? '🤖' : ''}
                    <span className="block text-xs text-ink-soft dark:text-slate-400">{new Date(g.finishedAt).toLocaleString('el-GR')}</span>
                  </span>
                  <span className="text-right">
                    {g.mode === 'coop' ? `${g.teamScore} π. ομάδας` : `${g.score} π.`}
                    {g.rank && g.players > 1 && <span className="block text-xs">θέση {g.rank}/{g.players}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
          <Button variant="ghost" onClick={() => setConfirm(true)}>
            Διαγραφή στατιστικών
          </Button>
        </>
      )}
      {confirm && (
        <Modal label="Διαγραφή στατιστικών" onClose={() => setConfirm(false)}>
          <h2 className="font-display text-xl font-bold">Διαγραφή όλων των στατιστικών;</h2>
          <p className="mt-1 text-ink-soft">Η ενέργεια δεν αναιρείται.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>Ακύρωση</Button>
            <Button variant="danger" onClick={() => void clearGames().then(() => { setConfirm(false); load(); })}>Διαγραφή</Button>
          </div>
        </Modal>
      )}
    </Screen>
  );
}
