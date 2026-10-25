import { useEffect } from 'react';
import { KEYBOARD_ALPHABETICAL, KEYBOARD_QWERTY, keyToGreekLetter } from '@kremala/shared';
import type { KeyboardLayout } from '../lib/prefs';

export interface KeyboardProps {
  correct: string[];
  incorrect: string[];
  eliminated: string[];
  disabled?: boolean;
  layout?: KeyboardLayout;
  onPick: (letter: string) => void;
  /** Συνεργατική: ποιος επέλεξε κάθε γράμμα (όνομα). */
  authors?: Record<string, string>;
}

export function Keyboard({ correct, incorrect, eliminated, disabled, layout = 'alphabetical', onPick, authors }: KeyboardProps) {
  const rows = layout === 'qwerty' ? KEYBOARD_QWERTY : KEYBOARD_ALPHABETICAL;

  // Φυσικό πληκτρολόγιο (ελληνικό ή λατινικό).
  useEffect(() => {
    if (disabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const l = keyToGreekLetter(e.key);
      if (l) {
        e.preventDefault();
        onPick(l);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [disabled, onPick]);

  return (
    <div className="flex select-none flex-col gap-1.5" role="group" aria-label="Ελληνικό πληκτρολόγιο">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-center gap-1.5">
          {row.map((l) => {
            const isCorrect = correct.includes(l), isWrong = incorrect.includes(l), isElim = eliminated.includes(l);
            const used = isCorrect || isWrong || isElim;
            const state = isCorrect ? 'σωστό' : isWrong ? 'λάθος' : isElim ? 'αφαιρέθηκε' : 'διαθέσιμο';
            const by = authors?.[l];
            return (
              <button
                key={l}
                type="button"
                disabled={disabled || used}
                onClick={() => onPick(l)}
                aria-label={`${l}, ${state}${by ? `, από ${by}` : ''}`}
                title={by ? `Επιλογή: ${by}` : undefined}
                className={`relative aspect-[4/5] min-h-[44px] w-full max-w-[3.25rem] flex-1 rounded-xl text-lg font-bold transition sm:text-xl
                  ${isCorrect ? 'bg-emerald-500 text-white dark:bg-emerald-600' : ''}
                  ${isWrong ? 'bg-rose-500/90 text-white dark:bg-rose-600/80' : ''}
                  ${isElim ? 'bg-slate-200 text-slate-400 line-through dark:bg-white/5 dark:text-slate-600' : ''}
                  ${!used ? 'bg-white text-ink shadow-sm ring-1 ring-black/10 hover:-translate-y-0.5 hover:bg-indigo-50 active:translate-y-0 disabled:opacity-50 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10 dark:hover:bg-white/20' : ''}`}
              >
                {l}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
