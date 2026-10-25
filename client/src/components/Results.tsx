import type { GameView, RankEntry, RoundResultView } from '@kremala/shared';
import { formatDuration, playerName, STATUS_LABEL } from '../lib/format';
import { Badge } from './ui';

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`);

/** Αποτελέσματα γύρου για Μονομαχία / Κλασική (ανά παίκτη). */
export function DuelRoundTable({ view, result }: { view: GameView; result: RoundResultView }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Κατάταξη γύρου {result.index}</caption>
      <thead className="text-left text-ink-soft dark:text-slate-400">
        <tr>
          <th className="py-1">#</th>
          <th>Παίκτης</th>
          <th className="text-right">Πόντοι</th>
          <th className="text-right">Λάθη</th>
          <th className="text-right">Χρόνος</th>
        </tr>
      </thead>
      <tbody>
        {result.ranking.map((r) => (
          <tr key={r.playerId} className={`border-t border-black/5 dark:border-white/10 ${r.playerId === view.viewerId ? 'font-bold' : ''}`}>
            <td className="py-1.5">{medal(r.rank)}</td>
            <td>
              {playerName(view.players, r.playerId, view.viewerId)}{' '}
              <Badge tone={r.won ? 'green' : 'red'}>{STATUS_LABEL[result.statusByPlayer[r.playerId] ?? 'lost']}</Badge>
              {view.mode !== 'duel' || result.words[r.playerId] === result.words[view.viewerId] ? null : (
                <span className="block text-xs font-normal text-ink-soft dark:text-slate-400">«{result.words[r.playerId]}»</span>
              )}
            </td>
            <td className="text-right tabular-nums">{r.points}</td>
            <td className="text-right tabular-nums">{r.mistakes}</td>
            <td className="text-right tabular-nums">{formatDuration(r.timeMs)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Συμμετοχή παικτών στη Συνεργατική. */
export function ParticipationTable({ view, participation }: { view: GameView; participation: RoundResultView['participation'] }) {
  const rows = Object.entries(participation).sort((a, b) => b[1].correct - a[1].correct);
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Συμμετοχή παικτών</caption>
      <thead className="text-left text-ink-soft dark:text-slate-400">
        <tr>
          <th className="py-1">Παίκτης</th>
          <th className="text-right">Προτάσεις</th>
          <th className="text-right">Σωστές</th>
          <th className="text-right">Λάθος</th>
          <th className="text-right">Υποδ.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([id, p]) => (
          <tr key={id} className="border-t border-black/5 dark:border-white/10">
            <td className="py-1.5">{playerName(view.players, id, view.viewerId)}</td>
            <td className="text-right tabular-nums">{p.proposed}</td>
            <td className="text-right tabular-nums text-emerald-700 dark:text-emerald-300">{p.correct}</td>
            <td className="text-right tabular-nums text-rose-700 dark:text-rose-300">{p.incorrect}</td>
            <td className="text-right tabular-nums">{p.hints}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function RoundSummary({ view, result }: { view: GameView; result: RoundResultView }) {
  const myWord = view.mode === 'coop' ? Object.values(result.words)[0] : result.words[view.viewerId] ?? Object.values(result.words)[0];
  const br = view.mode === 'coop' ? result.breakdown['__team__'] : result.breakdown[view.viewerId];
  const won = view.mode === 'coop' ? result.teamWon : result.statusByPlayer[view.viewerId] === 'won';
  const headline =
    view.mode === 'duel'
      ? result.winnerId === view.viewerId
        ? 'Κέρδισες τον γύρο! 🏆'
        : result.winnerId
          ? `Νικητής: ${playerName(view.players, result.winnerId, view.viewerId)}`
          : 'Ισοπαλία ή κανένας νικητής'
      : view.mode === 'coop'
        ? won ? 'Η ομάδα βρήκε τη λέξη! 🎉' : 'Η ομάδα δεν τα κατάφερε'
        : won ? 'Μπράβο! Βρήκες τη λέξη! 🎉' : 'Χάθηκε ο γύρος';
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center">
        <p className="text-sm text-ink-soft dark:text-slate-400">Γύρος {result.index} από {view.totalRounds}</p>
        <h2 className="font-display text-2xl font-bold">{headline}</h2>
        <p className="mt-1 text-lg">
          Η λέξη ήταν <strong className="text-indigo-700 dark:text-indigo-300">«{myWord}»</strong>
        </p>
      </div>
      {br && (
        <div className="flex justify-center gap-2 text-sm">
          <Badge tone="indigo">Βάση {br.base}</Badge>
          {br.hintPenalty > 0 && <Badge tone="amber">Υποδείξεις −{br.hintPenalty}</Badge>}
          {br.speedBonus > 0 && <Badge tone="green">Ταχύτητα +{br.speedBonus}</Badge>}
          <Badge tone="slate">Σύνολο {br.total}</Badge>
        </div>
      )}
      {view.mode === 'coop' ? (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Stat label="Πόντοι ομάδας" value={result.teamScore ?? 0} />
            <Stat label="Λάθη" value={Object.values(result.mistakesByPlayer)[0] ?? 0} />
            <Stat label="Χρόνος" value={formatDuration(Object.values(result.timeByPlayer)[0] ?? 0)} />
          </div>
          <ParticipationTable view={view} participation={result.participation} />
        </>
      ) : (
        view.players.length > 1 && <DuelRoundTable view={view} result={result} />
      )}
    </div>
  );
}

export function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-black/5 p-2 dark:bg-white/5">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="text-xs text-ink-soft dark:text-slate-400">{label}</div>
    </div>
  );
}

export function StandingsTable({ view, ranking }: { view: GameView; ranking: RankEntry[] }) {
  return (
    <table className="w-full">
      <caption className="sr-only">Τελική κατάταξη</caption>
      <thead className="text-left text-sm text-ink-soft dark:text-slate-400">
        <tr>
          <th className="py-1">#</th>
          <th>Παίκτης</th>
          <th className="text-right">Πόντοι</th>
          <th className="text-right">Νίκες</th>
          <th className="text-right">Λάθη</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((r) => {
          const p = view.players.find((x) => x.id === r.playerId);
          return (
            <tr key={r.playerId} className={`border-t border-black/5 dark:border-white/10 ${r.playerId === view.viewerId ? 'font-bold' : ''}`}>
              <td className="py-2 text-lg">{medal(r.rank)}</td>
              <td>
                {playerName(view.players, r.playerId, view.viewerId)} {p?.isBot && <span title="Bot">🤖</span>}
                {r.tied && <span className="ml-1 text-xs text-ink-soft">(ισοβαθμία)</span>}
              </td>
              <td className="text-right tabular-nums">{r.points}</td>
              <td className="text-right tabular-nums">{p?.wins ?? 0}</td>
              <td className="text-right tabular-nums">{r.mistakes}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export function FinalSummary({ view }: { view: GameView }) {
  if (view.mode === 'coop' && view.teamSummary) {
    const t = view.teamSummary;
    const total: RoundResultView['participation'] = {};
    for (const r of view.history)
      for (const [id, p] of Object.entries(r.participation)) {
        const cur = (total[id] ??= { proposed: 0, correct: 0, incorrect: 0, hints: 0 });
        cur.proposed += p.proposed; cur.correct += p.correct; cur.incorrect += p.incorrect; cur.hints += p.hints;
      }
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-center font-display text-2xl font-bold">Τέλος παιχνιδιού — Η ομάδα σας</h2>
        <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Stat label="Συνολικοί πόντοι" value={t.totalPoints} />
          <Stat label="Επιτυχημένοι γύροι" value={`${t.roundsWon}/${t.roundsPlayed}`} />
          <Stat label="Μέσος όρος λαθών" value={String(t.averageMistakes).replace('.', ',')} />
          <Stat label="Συνολικός χρόνος" value={formatDuration(t.totalTimeMs)} />
        </div>
        <ParticipationTable view={view} participation={total} />
      </div>
    );
  }
  const ranking = view.finalRanking ?? [];
  const me = ranking.find((r) => r.playerId === view.viewerId);
  const single = view.players.length === 1;
  const won = view.history.filter((r) => r.statusByPlayer[view.viewerId] === 'won').length;
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-center font-display text-2xl font-bold">
        {single ? 'Τέλος παιχνιδιού' : me?.rank === 1 && !me.tied ? 'Είσαι ο μεγάλος νικητής! 🏆' : me?.rank === 1 ? 'Ισοπαλία στην κορυφή!' : `Τερμάτισες ${me?.rank ?? '—'}ος`}
      </h2>
      {single ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Πόντοι" value={view.players[0].score} />
          <Stat label="Λέξεις" value={`${won}/${view.history.length}`} />
          <Stat label="Λάθη" value={me?.mistakes ?? 0} />
        </div>
      ) : (
        <StandingsTable view={view} ranking={ranking} />
      )}
    </div>
  );
}
