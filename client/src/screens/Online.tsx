import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, ERROR_MESSAGES, MAX_ROOM_PLAYERS, ROOM_CODE_LENGTH, sanitizeSettings, type GameMode, type RoomError, type Settings } from '@kremala/shared';
import { GameSettingsForm } from '../components/SettingsForm';
import { Badge, Button, Card, Field, inputClass, Screen, Segmented } from '../components/ui';
import { useOnlineClient, useOnlineStatus } from '../lib/hooks';
import { loadSession, online } from '../lib/online';
import { recordGame } from '../lib/db';
import { recordFromView } from '../lib/record';
import { usePrefs } from '../lib/prefs';
import { MODE_LABEL } from '../lib/format';
import { GameScreen } from './GameScreen';

export function Online({ initialMode, initialCode, onExit }: { initialMode?: GameMode; initialCode?: string; onExit: () => void }) {
  const snap = useOnlineClient();
  const isOnline = useOnlineStatus();
  const { prefs, update } = usePrefs();
  const [name, setName] = useState(prefs.playerName);
  const [code, setCode] = useState(initialCode ?? '');
  const [mode, setMode] = useState<GameMode>(initialMode ?? 'duel');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorded = useRef<string | null>(null);

  // Επανασύνδεση μετά από ανανέωση σελίδας.
  useEffect(() => {
    const s = loadSession();
    if (!snap.info && s && (!initialCode || initialCode.toUpperCase() === s.code)) {
      setBusy(true);
      void online.resume().finally(() => setBusy(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (snap.kicked) setError('Ο οικοδεσπότης σε αφαίρεσε από το δωμάτιο.');
  }, [snap.kicked]);

  const view = snap.state?.view;
  // Καταγραφή στατιστικών όταν τελειώσει online παιχνίδι.
  useEffect(() => {
    if (view?.status === 'finished') {
      const key = `${view.id}-${view.history.length}-${view.history.at(-1)?.index}`;
      if (recorded.current !== key) {
        recorded.current = key;
        void recordGame(recordFromView(view, { online: true }));
      }
    }
  }, [view]);

  const fail = (e: RoomError) => setError(ERROR_MESSAGES[e] ?? 'Κάτι πήγε στραβά.');

  const create = async () => {
    if (!name.trim()) return setError(ERROR_MESSAGES.invalid_name);
    setBusy(true);
    setError(null);
    update({ playerName: name.trim() });
    const base = prefs.lastSettings[mode] ?? DEFAULT_SETTINGS;
    const res = await online.create(name.trim(), sanitizeSettings({ ...base, gameMode: mode }));
    setBusy(false);
    if (!res.ok) fail(res.error);
  };
  const join = async () => {
    if (!name.trim()) return setError(ERROR_MESSAGES.invalid_name);
    if (code.trim().length !== ROOM_CODE_LENGTH) return setError(`Ο κωδικός έχει ${ROOM_CODE_LENGTH} χαρακτήρες.`);
    setBusy(true);
    setError(null);
    update({ playerName: name.trim() });
    const res = await online.join(code.trim(), name.trim());
    setBusy(false);
    if (!res.ok) fail(res.error);
  };
  const leave = async () => {
    await online.leave();
    onExit();
  };

  const actions = useMemo(
    () => ({
      guess: (l: string) => online.guess(l),
      hint: (t: 'reveal' | 'eliminate') => online.hint(t),
      next: () => void online.next(),
      restart: () => void online.start(),
      exit: () => void leave(),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const banner =
    snap.conn === 'reconnecting' || snap.conn === 'offline' ? (
      <div className="my-1 rounded-xl bg-amber-100 p-2 text-center text-sm font-medium text-amber-900 dark:bg-amber-500/20 dark:text-amber-100" role="status">
        🔌 Η σύνδεση χάθηκε — επανασύνδεση… Η πρόοδός σου διατηρείται.
      </div>
    ) : null;

  if (snap.info && view && view.status !== 'lobby') {
    const isHost = snap.state!.room.hostId === snap.info.playerId;
    return (
      <GameScreen
        view={view}
        actions={actions}
        canControl={isHost}
        clockOffset={snap.clockOffset}
        banner={banner}
        autoNextNote={view.status === 'roundOver' ? 'Ο επόμενος γύρος ξεκινά αυτόματα σε λίγα δευτερόλεπτα.' : undefined}
      />
    );
  }

  if (snap.info && view) return <Lobby onLeave={leave} banner={banner} />;

  return (
    <Screen title="Παίξε online" onBack={onExit}>
      {!isOnline && (
        <Card className="bg-amber-50 dark:bg-amber-500/10">
          📴 Είσαι εκτός σύνδεσης. Τα online δωμάτια απαιτούν σύνδεση στο διαδίκτυο — μπορείς να παίξεις Κλασική ή με bots.
        </Card>
      )}
      {busy && !snap.info && <p className="text-center text-ink-soft">Σύνδεση…</p>}
      <Card>
        <Field label="Το όνομά σου">
          <input className={inputClass} value={name} maxLength={20} placeholder="π.χ. Γιώργος" onChange={(e) => setName(e.target.value)} />
        </Field>
      </Card>
      <Card>
        <h2 className="font-display text-xl font-bold">Μπες σε δωμάτιο</h2>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void join();
          }}
        >
          <label className="sr-only" htmlFor="room-code">Κωδικός δωματίου</label>
          <input
            id="room-code"
            className={`${inputClass} text-center font-mono text-2xl uppercase tracking-[0.3em]`}
            value={code}
            maxLength={ROOM_CODE_LENGTH}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="ABCDE"
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <Button type="submit" disabled={busy || !isOnline}>
            Είσοδος
          </Button>
        </form>
      </Card>
      <Card>
        <h2 className="font-display text-xl font-bold">Δημιούργησε δωμάτιο</h2>
        <Segmented
          label="Τρόπος παιχνιδιού"
          value={mode}
          onChange={setMode}
          options={(['duel', 'coop', 'classic'] as const).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
        />
        <Button className="mt-2 w-full" size="lg" disabled={busy || !isOnline} onClick={() => void create()}>
          Νέο δωμάτιο
        </Button>
        <p className="mt-2 text-sm text-ink-soft dark:text-slate-400">2–{MAX_ROOM_PLAYERS} παίκτες · θα πάρεις κωδικό και σύνδεσμο πρόσκλησης.</p>
      </Card>
      {error && (
        <p className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100" role="alert">
          {error}
        </p>
      )}
    </Screen>
  );
}

function Lobby({ onLeave, banner }: { onLeave: () => void; banner: React.ReactNode }) {
  const snap = useOnlineClient();
  const { prefs, update } = usePrefs();
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const view = snap.state!.view;
  const room = snap.state!.room;
  const me = snap.info!.playerId;
  const isHost = room.hostId === me;
  const link = `${location.origin}/?room=${room.code}`;
  const players = view.players.filter((p) => p.connectionStatus !== 'left');

  const run = async (p: Promise<{ ok: boolean; error?: RoomError }>) => {
    const res = await p;
    if (!res.ok && res.error) setError(ERROR_MESSAGES[res.error]);
    else setError(null);
  };
  const changeSettings = (s: Settings) => {
    update({ lastSettings: { ...prefs.lastSettings, [s.gameMode]: s } });
    void run(online.settings(s) as never);
  };
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Κρεμάλα', text: `Έλα να παίξουμε Κρεμάλα! Κωδικός: ${room.code}`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* ο χρήστης ακύρωσε */
    }
  };

  return (
    <Screen title="Lobby" onBack={onLeave}>
      {banner}
      <Card className="text-center">
        <p className="text-sm text-ink-soft dark:text-slate-400">Κωδικός δωματίου</p>
        <p className="font-mono text-4xl font-extrabold tracking-[0.35em] text-indigo-700 dark:text-indigo-300" aria-label={`Κωδικός ${room.code.split('').join(' ')}`}>
          {room.code}
        </p>
        <div className="mt-3 flex justify-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => void share()}>
            {copied ? '✓ Αντιγράφηκε' : '🔗 Σύνδεσμος πρόσκλησης'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Παίκτες ({players.length}/{room.maxPlayers})</h2>
          <Badge tone="indigo">{MODE_LABEL[view.settings.gameMode]}</Badge>
        </div>
        <ul className="divide-y divide-black/5 dark:divide-white/10">
          {players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 py-2">
              <span className={`h-2.5 w-2.5 rounded-full ${p.connectionStatus === 'disconnected' ? 'bg-amber-500' : 'bg-emerald-500'}`} aria-hidden />
              <span className="flex-1 font-medium">
                {p.displayName} {p.id === me && <span className="text-sm text-ink-soft">(εσύ)</span>}
                {p.isBot && ' 🤖'}
                {p.connectionStatus === 'disconnected' && <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">αποσυνδεδεμένος</span>}
              </span>
              {p.id === room.hostId && <Badge tone="amber">👑 Οικοδεσπότης</Badge>}
              {isHost && p.id !== me && (
                <button className="rounded-lg px-2 py-1 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" onClick={() => void run(online.removePlayer(p.id) as never)} aria-label={`Αφαίρεση ${p.displayName}`}>
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
        {isHost && players.length < room.maxPlayers && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-soft dark:text-slate-400">Πρόσθεσε bot:</span>
            {(['easy', 'medium', 'hard'] as const).map((l) => (
              <Button key={l} size="sm" variant="secondary" onClick={() => void run(online.addBot(l) as never)}>
                🤖 {l === 'easy' ? 'Εύκολο' : l === 'medium' ? 'Μέτριο' : 'Δύσκολο'}
              </Button>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 font-semibold">Ρυθμίσεις {!isHost && <span className="text-sm font-normal text-ink-soft">(ορίζει ο οικοδεσπότης)</span>}</h2>
        <GameSettingsForm value={view.settings} onChange={changeSettings} disabled={!isHost} showMode />
      </Card>

      {error && (
        <p className="rounded-xl bg-rose-100 p-3 text-rose-900 dark:bg-rose-500/20 dark:text-rose-100" role="alert">
          {error}
        </p>
      )}
      <div className="sticky bottom-0 -mx-4 flex gap-2 bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:bg-paper-dark/95">
        <Button variant="secondary" onClick={onLeave}>
          Αποχώρηση
        </Button>
        {isHost ? (
          <Button size="lg" className="flex-1" disabled={players.length < room.minPlayers} onClick={() => void run(online.start() as never)}>
            {players.length < room.minPlayers ? 'Περιμένουμε παίκτες…' : 'Έναρξη παιχνιδιού'}
          </Button>
        ) : (
          <p className="flex-1 self-center text-center text-ink-soft">Αναμονή για τον οικοδεσπότη…</p>
        )}
      </div>
    </Screen>
  );
}
