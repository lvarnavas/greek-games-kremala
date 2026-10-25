import { DICTIONARY, type BotLevel, type Settings } from '@kremala/shared';
import { DIFFICULTY_LABEL } from '../lib/format';
import { Segmented, Toggle } from './ui';

/** Φόρμα ρυθμίσεων παιχνιδιού — κοινή για τοπικό παιχνίδι και online lobby. */
export function GameSettingsForm({ value, onChange, disabled, showMode }: { value: Settings; onChange: (s: Settings) => void; disabled?: boolean; showMode?: boolean }) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...value, [k]: v });
  const toggleCat = (id: string) =>
    set('categories', value.categories.includes(id) ? value.categories.filter((c) => c !== id) : [...value.categories, id]);
  return (
    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
      {showMode && (
        <Segmented
          label="Τρόπος παιχνιδιού"
          value={value.gameMode}
          disabled={disabled}
          onChange={(v) => set('gameMode', v)}
          options={[
            { value: 'classic', label: '🎯 Κλασική (ανεξάρτητα)' },
            { value: 'duel', label: '⚔️ Μονομαχία' },
            { value: 'coop', label: '🤝 Συνεργατική' },
          ]}
        />
      )}
      <fieldset className="py-2" disabled={disabled}>
        <legend className="mb-1.5 font-medium">Κατηγορίες {value.categories.length === 0 && <span className="text-sm font-normal text-ink-soft">(όλες)</span>}</legend>
        <div className="flex flex-wrap gap-1.5">
          {DICTIONARY.categories.map((c) => {
            const on = value.categories.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={on}
                onClick={() => toggleCat(c.id)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${on ? 'bg-indigo-700 text-white dark:bg-indigo-500' : 'bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/15'}`}
              >
                {c.icon} {c.name}
              </button>
            );
          })}
        </div>
      </fieldset>
      <Segmented
        label="Δυσκολία"
        value={value.difficulty}
        disabled={disabled}
        onChange={(v) => set('difficulty', v)}
        options={(['any', 'easy', 'medium', 'hard'] as const).map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }))}
      />
      <Segmented label="Λανθασμένες προσπάθειες" value={value.maxMistakes} disabled={disabled} onChange={(v) => set('maxMistakes', v)} options={[4, 5, 6, 8, 10].map((n) => ({ value: n, label: String(n) }))} />
      <Toggle label="Χρονόμετρο" checked={value.timerEnabled} disabled={disabled} onChange={(v) => set('timerEnabled', v)} />
      {value.timerEnabled && (
        <Segmented
          label="Χρόνος ανά γύρο"
          value={value.roundDuration}
          disabled={disabled}
          onChange={(v) => set('roundDuration', v)}
          options={[30, 60, 90, 120, 180, 300].map((n) => ({ value: n, label: n < 60 ? `${n}″` : `${n / 60}′` }))}
        />
      )}
      <Segmented label="Γύροι" value={value.totalRounds} disabled={disabled} onChange={(v) => set('totalRounds', v)} options={[1, 3, 5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))} />
      <Segmented
        label="Στόχος πόντων"
        value={value.targetScore}
        disabled={disabled}
        onChange={(v) => set('targetScore', v)}
        options={[0, 300, 500, 1000].map((n) => ({ value: n, label: n === 0 ? 'Χωρίς' : String(n) }))}
      />
      <Toggle label="Υποδείξεις" hint={`Αποκάλυψη γράμματος −${value.hintPenalties.reveal}, αφαίρεση 3 γραμμάτων −${value.hintPenalties.eliminate} πόντοι`} checked={value.hintsEnabled} disabled={disabled} onChange={(v) => set('hintsEnabled', v)} />
      {value.hintsEnabled && (
        <Segmented label="Υποδείξεις ανά γύρο" value={value.maxHintsPerRound} disabled={disabled} onChange={(v) => set('maxHintsPerRound', v)} options={[1, 2, 3].map((n) => ({ value: n, label: String(n) }))} />
      )}
      <Toggle label="Μπόνους ταχύτητας" hint="Έως +20 πόντοι για γρήγορη λύση" checked={value.speedBonusEnabled} disabled={disabled || !value.timerEnabled} onChange={(v) => set('speedBonusEnabled', v)} />
      {value.gameMode === 'duel' && (
        <>
          <Segmented
            label="Λέξεις μονομαχίας"
            value={value.wordMode}
            disabled={disabled}
            onChange={(v) => set('wordMode', v)}
            options={[
              { value: 'same', label: 'Ίδια λέξη για όλους' },
              { value: 'equivalent', label: 'Ισοδύναμες διαφορετικές' },
            ]}
          />
        </>
      )}
      {value.gameMode !== 'coop' && (
        <Segmented
          label="Ορατότητα αντιπάλων"
          value={value.showOpponentProgress}
          disabled={disabled}
          onChange={(v) => set('showOpponentProgress', v)}
          options={[
            { value: 'progress', label: 'Μόνο πρόοδος' },
            { value: 'full', label: 'Και γράμματα' },
            { value: 'hidden', label: 'Κρυφή' },
          ]}
        />
      )}
      {value.gameMode === 'coop' && (
        <>
          <Toggle label="Εμφάνιση ποιος πρότεινε κάθε γράμμα" checked={value.showGuessAuthor} disabled={disabled} onChange={(v) => set('showGuessAuthor', v)} />
          <Segmented
            label="Βαθμολογία ομάδας"
            value={value.coopScoring}
            disabled={disabled}
            onChange={(v) => set('coopScoring', v)}
            options={[
              { value: 'team', label: 'Κοινή' },
              { value: 'teamPlusIndividual', label: 'Κοινή + ατομικοί πόντοι' },
            ]}
          />
        </>
      )}
    </div>
  );
}

export function BotPicker({ bots, onChange, min = 1 }: { bots: BotLevel[]; onChange: (b: BotLevel[]) => void; min?: number }) {
  const level = bots[0] ?? 'medium';
  return (
    <div className="flex flex-col divide-y divide-black/5 dark:divide-white/10">
      <Segmented
        label="Αριθμός bots"
        value={bots.length}
        onChange={(n) => onChange(Array.from({ length: n }, (_, i) => bots[i] ?? level))}
        options={[min === 0 ? 0 : null, 1, 2, 3].filter((n): n is number => n !== null).map((n) => ({ value: n, label: String(n) }))}
      />
      {bots.map((b, i) => (
        <Segmented
          key={i}
          label={`Bot ${i + 1} — επίπεδο`}
          value={b}
          onChange={(v) => onChange(bots.map((x, j) => (j === i ? v : x)))}
          options={[
            { value: 'easy', label: 'Εύκολο' },
            { value: 'medium', label: 'Μέτριο' },
            { value: 'hard', label: 'Δύσκολο' },
          ]}
        />
      ))}
    </div>
  );
}
