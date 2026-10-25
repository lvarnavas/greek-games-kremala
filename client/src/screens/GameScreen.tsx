import { useCallback, useEffect, useRef, useState } from 'react';
import { ERROR_MESSAGES, type GameView, type HintType, type RoomError } from '@kremala/shared';
import { Hangman } from '../components/Hangman';
import { Keyboard } from '../components/Keyboard';
import { WordDisplay } from '../components/WordDisplay';
import { Timer } from '../components/Timer';
import { ActivityLog, OpponentsPanel, PlayersList } from '../components/Panels';
import { FinalSummary, RoundSummary } from '../components/Results';
import { Badge, Button, Modal } from '../components/ui';
import { categoryName } from '@kremala/shared';
import { END_REASON_LABEL, MODE_ICON, MODE_LABEL, playerName } from '../lib/format';
import { useNow } from '../lib/hooks';
import { usePrefs } from '../lib/prefs';
import { play, vibrate } from '../lib/sound';

type Res = { ok: true } | { ok: false; error: RoomError };

export interface GameActions {
  guess: (letter: string) => Res | Promise<Res>;
  hint: (type: HintType) => Res | Promise<Res>;
  next?: () => void;
  restart?: () => void;
  exit: () => void;
  pause?: () => void;
  resume?: () => void;
}

export function GameScreen({
  view,
  actions,
  canControl,
  clockOffset = 0,
  paused = false,
  banner,
  autoNextNote,
}: {
  view: GameView;
  actions: GameActions;
  canControl: boolean;
  clockOffset?: number;
  paused?: boolean;
  banner?: React.ReactNode;
  autoNextNote?: string;
}) {
  const { prefs } = usePrefs();
  const now = useNow(250, clockOffset, paused ? view.serverNow : null);
  const [toast, setToast] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [shake, setShake] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const board = view.board;
  const prev = useRef<{ round: number; correct: number; wrong: number; status: string } | null>(null);

  // Ήχοι/ανακοινώσεις για κάθε αλλαγή του ταμπλό (και από άλλους παίκτες στη Συνεργατική).
  useEffect(() => {
    if (!board) return;
    const cur = { round: view.roundIndex, correct: board.correctLetters.length, wrong: board.incorrectLetters.length, status: board.status };
    const p = prev.current;
    prev.current = cur;
    if (!p || p.round !== cur.round) return;
    if (cur.wrong > p.wrong) {
      play('wrong');
      if (prefs.vibration) vibrate(80);
      setShake(true);
      setTimeout(() => setShake(false), 350);
      const l = board.incorrectLetters.at(-1);
      setAnnounce(`Λάθος: το ${l} δεν υπάρχει. Απομένουν ${board.maxMistakes - board.mistakes} προσπάθειες.`);
    } else if (cur.correct > p.correct) {
      play('correct');
      const l = board.correctLetters.at(-1)!;
      const n = board.mask.filter((m) => m === l).length;
      setAnnounce(`Σωστό: το ${l} εμφανίζεται ${n === 1 ? 'μία φορά' : `${n} φορές`}.`);
    }
    if (p.status === 'playing' && cur.status !== 'playing') {
      play(cur.status === 'won' ? 'win' : 'lose');
      setAnnounce(cur.status === 'won' ? 'Βρήκες τη λέξη!' : `Ο γύρος χάθηκε: ${board.endReason ? END_REASON_LABEL[board.endReason] : ''}`);
    }
  }, [board, view.roundIndex, prefs.vibration]);

  const showError = (error: RoomError) => {
    if (error === 'already_guessed' || error === 'not_playing') return;
    setToast(ERROR_MESSAGES[error]);
    setTimeout(() => setToast(null), 1800);
  };

  const onPick = useCallback(
    async (letter: string) => {
      const res = await actions.guess(letter);
      if (!res.ok) {
        if (res.error === 'already_guessed') setAnnounce(`Το ${letter} έχει ήδη επιλεγεί.`);
        showError(res.error);
      }
    },
    [actions],
  );

  const onHint = async (t: HintType) => {
    const res = await actions.hint(t);
    if (!res.ok) showError(res.error);
  };

  const playing = view.status === 'playing' && board?.status === 'playing' && !paused;
  const me = view.players.find((p) => p.id === view.viewerId);
  const authors =
    board?.guessedBy && view.mode === 'coop'
      ? Object.fromEntries(Object.entries(board.guessedBy).map(([l, id]) => [l, playerName(view.players, id, view.viewerId)]))
      : undefined;
  const roundOver = view.status === 'roundOver' && view.lastResult;
  const finished = view.status === 'finished';

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))]">
      <div aria-live="assertive" className="sr-only">{announce}</div>
      <header className="flex items-center gap-2 py-1">
        <button onClick={() => (finished ? actions.exit() : setConfirmExit(true))} className="rounded-full p-2 text-xl hover:bg-black/5 dark:hover:bg-white/10" aria-label="Έξοδος">
          ✕
        </button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {MODE_ICON[view.mode]} {MODE_LABEL[view.mode]}
          </div>
          <div className="text-xs text-ink-soft dark:text-slate-400">
            Γύρος {view.roundIndex}/{view.totalRounds} · {view.mode === 'coop' ? `Ομάδα: ${view.teamScore} π.` : `Σκορ: ${me?.score ?? 0} π.`}
          </div>
        </div>
        {actions.pause && view.status === 'playing' && (
          <button onClick={paused ? actions.resume : actions.pause} className="rounded-full p-2 text-xl hover:bg-black/5 dark:hover:bg-white/10" aria-label={paused ? 'Συνέχεια' : 'Παύση'}>
            {paused ? '▶' : '⏸'}
          </button>
        )}
        {board && <Timer deadline={board.deadline} startedAt={board.startedAt} finishedAt={board.finishedAt} now={now} />}
      </header>

      {banner}

      {view.mode === 'duel' || (view.mode === 'classic' && view.players.length > 1) ? (
        <div className="my-2">
          <OpponentsPanel view={view} />
        </div>
      ) : null}
      {view.mode === 'coop' && (
        <div className="my-2">
          <PlayersList view={view} />
        </div>
      )}

      {board ? (
        <main className="flex flex-1 flex-col gap-3">
          <div className="flex items-center justify-center gap-2 text-sm">
            <Badge tone="indigo">📂 {categoryName(board.category)}</Badge>
            <Badge tone={board.mistakes >= board.maxMistakes - 1 ? 'red' : 'slate'}>
              ❤️ {board.maxMistakes - board.mistakes}/{board.maxMistakes}
            </Badge>
          </div>
          <div className={`mx-auto h-44 w-44 sm:h-56 sm:w-56 ${shake && !prefs.reducedMotion ? 'animate-shake' : ''}`}>
            <Hangman mistakes={board.mistakes} maxMistakes={board.maxMistakes} lost={board.status === 'lost'} won={board.status === 'won'} />
          </div>
          <WordDisplay mask={board.mask} word={board.word} status={board.status} />

          {board.status !== 'playing' && view.status === 'playing' && (
            <p className="rounded-xl bg-indigo-50 p-2 text-center text-sm font-medium text-indigo-900 dark:bg-indigo-500/15 dark:text-indigo-100" role="status">
              {board.status === 'won' ? '🎉 Τελείωσες!' : `😔 ${board.endReason ? END_REASON_LABEL[board.endReason] : ''}.`} Περιμένουμε τους υπόλοιπους παίκτες…
            </p>
          )}

          {view.mode === 'coop' && <ActivityLog view={view} />}

          <div className="mt-auto flex flex-col gap-2">
            {view.settings.hintsEnabled && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-sm text-ink-soft dark:text-slate-400">Υποδείξεις: {board.hintsRemaining}</span>
                <Button size="sm" variant="secondary" disabled={!playing || board.hintsRemaining <= 0} onClick={() => onHint('reveal')}>
                  💡 Γράμμα (−{view.settings.hintPenalties.reveal})
                </Button>
                <Button size="sm" variant="secondary" disabled={!playing || board.hintsRemaining <= 0} onClick={() => onHint('eliminate')}>
                  🧹 Αφαίρεση 3 (−{view.settings.hintPenalties.eliminate})
                </Button>
              </div>
            )}
            <Keyboard
              correct={board.correctLetters}
              incorrect={board.incorrectLetters}
              eliminated={board.eliminatedLetters}
              disabled={!playing}
              layout={prefs.keyboardLayout}
              onPick={onPick}
              authors={authors}
            />
          </div>
        </main>
      ) : (
        <p className="m-auto text-center text-ink-soft">Δεν συμμετέχεις σε αυτόν τον γύρο. Περίμενε τον επόμενο…</p>
      )}

      {toast && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto w-fit animate-fadeup rounded-full bg-ink px-4 py-2 text-sm text-white shadow-lg" role="alert">
          {toast}
        </div>
      )}

      {paused && (
        <Modal label="Παύση">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="font-display text-2xl font-bold">⏸ Παύση</h2>
            <p className="text-ink-soft dark:text-slate-400">Το χρονόμετρο έχει σταματήσει.</p>
            <Button onClick={actions.resume}>▶ Συνέχεια</Button>
          </div>
        </Modal>
      )}

      {roundOver && !finished && (
        <Modal label={`Αποτελέσματα γύρου ${view.lastResult!.index}`}>
          <RoundSummary view={view} result={view.lastResult!} />
          <div className="mt-4 flex flex-col items-center gap-2">
            {canControl && actions.next ? (
              <Button size="lg" onClick={actions.next} autoFocus>
                Επόμενος γύρος →
              </Button>
            ) : (
              <p className="text-sm text-ink-soft dark:text-slate-400">Αναμονή για τον οικοδεσπότη…</p>
            )}
            {autoNextNote && <p className="text-xs text-ink-soft dark:text-slate-400">{autoNextNote}</p>}
          </div>
        </Modal>
      )}

      {finished && (
        <Modal label="Τελικά αποτελέσματα">
          {view.lastResult && (
            <details className="mb-3 rounded-xl bg-black/5 p-2 text-sm dark:bg-white/5">
              <summary className="cursor-pointer font-medium">Τελευταίος γύρος: «{view.lastResult.words[view.viewerId] ?? Object.values(view.lastResult.words)[0]}»</summary>
              <div className="mt-2">
                <RoundSummary view={view} result={view.lastResult} />
              </div>
            </details>
          )}
          <FinalSummary view={view} />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {canControl && actions.restart && <Button onClick={actions.restart}>🔄 Νέο παιχνίδι</Button>}
            <Button variant="secondary" onClick={actions.exit}>
              🏠 Αρχική
            </Button>
          </div>
        </Modal>
      )}

      {confirmExit && (
        <Modal label="Έξοδος από το παιχνίδι" onClose={() => setConfirmExit(false)}>
          <h2 className="font-display text-xl font-bold">Έξοδος;</h2>
          <p className="mt-1 text-ink-soft dark:text-slate-400">
            {actions.pause ? 'Η πρόοδος αποθηκεύεται και μπορείς να συνεχίσεις αργότερα από την αρχική οθόνη.' : 'Θα αποχωρήσεις από το δωμάτιο.'}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirmExit(false)}>
              Ακύρωση
            </Button>
            <Button variant="danger" onClick={actions.exit}>
              Έξοδος
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
