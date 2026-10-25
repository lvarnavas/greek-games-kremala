import { useState } from 'react';
import type { BotLevel, GameMode, Settings } from '@kremala/shared';
import { BotPicker, GameSettingsForm } from '../components/SettingsForm';
import { Button, Card, Field, inputClass, Screen, Segmented } from '../components/ui';
import { MODE_LABEL } from '../lib/format';
import { settingsFor, usePrefs } from '../lib/prefs';

export function LocalSetup({ mode: initialMode, pickMode, onBack, onStart }: { mode: GameMode; pickMode?: boolean; onBack: () => void; onStart: (s: Settings, bots: BotLevel[], name: string) => void }) {
  const { prefs, update } = usePrefs();
  const [mode, setMode] = useState<GameMode>(initialMode);
  const [settings, setSettings] = useState<Settings>(() => settingsFor(prefs, initialMode));
  const [bots, setBots] = useState<BotLevel[]>(['medium']);
  const [name, setName] = useState(prefs.playerName);

  const changeMode = (m: GameMode) => {
    setMode(m);
    setSettings(settingsFor(prefs, m));
  };
  const start = () => {
    const s = { ...settings, gameMode: mode };
    update({ playerName: name.trim(), lastSettings: { ...prefs.lastSettings, [mode]: s } });
    onStart(s, mode === 'classic' ? [] : bots, name.trim() || 'Εγώ');
  };

  return (
    <Screen title={pickMode ? 'Παίξε με bots' : MODE_LABEL[mode]} onBack={onBack}>
      {pickMode && (
        <Card>
          <Segmented
            label="Τρόπος παιχνιδιού"
            value={mode}
            onChange={changeMode}
            options={[
              { value: 'duel', label: '⚔️ Μονομαχία' },
              { value: 'coop', label: '🤝 Συνεργατική' },
            ]}
          />
        </Card>
      )}
      <Card>
        <Field label="Το όνομά σου">
          <input className={inputClass} value={name} maxLength={20} placeholder="π.χ. Ελένη" onChange={(e) => setName(e.target.value)} />
        </Field>
      </Card>
      {mode !== 'classic' && (
        <Card>
          <h2 className="mb-1 font-semibold">🤖 Bots {mode === 'coop' ? '(συμπαίκτες)' : '(αντίπαλοι)'}</h2>
          <BotPicker bots={bots} onChange={setBots} />
        </Card>
      )}
      <Card>
        <h2 className="mb-1 font-semibold">Ρυθμίσεις</h2>
        <GameSettingsForm value={{ ...settings, gameMode: mode }} onChange={setSettings} />
      </Card>
      <div className="sticky bottom-0 -mx-4 mt-2 bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:bg-paper-dark/95">
        <Button size="lg" className="w-full" onClick={start}>
          Ξεκίνα!
        </Button>
      </div>
    </Screen>
  );
}
