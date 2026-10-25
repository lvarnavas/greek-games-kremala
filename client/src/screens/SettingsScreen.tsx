import { Card, Field, inputClass, Screen, Segmented, Toggle } from '../components/ui';
import { usePrefs } from '../lib/prefs';

export function SettingsScreen({ onBack, canInstall, onInstall }: { onBack: () => void; canInstall: boolean; onInstall: () => void }) {
  const { prefs, update } = usePrefs();
  return (
    <Screen title="Ρυθμίσεις" onBack={onBack}>
      <Card>
        <Field label="Όνομα παίκτη">
          <input className={inputClass} value={prefs.playerName} maxLength={20} onChange={(e) => update({ playerName: e.target.value })} />
        </Field>
      </Card>
      <Card>
        <Segmented
          label="Θέμα εμφάνισης"
          value={prefs.theme}
          onChange={(theme) => update({ theme })}
          options={[
            { value: 'system', label: 'Συστήματος' },
            { value: 'light', label: '☀️ Φωτεινό' },
            { value: 'dark', label: '🌙 Σκοτεινό' },
          ]}
        />
        <Segmented
          label="Διάταξη πληκτρολογίου"
          value={prefs.keyboardLayout}
          onChange={(keyboardLayout) => update({ keyboardLayout })}
          options={[
            { value: 'alphabetical', label: 'Αλφαβητική' },
            { value: 'qwerty', label: 'Υπολογιστή' },
          ]}
        />
        <Toggle label="Ήχοι" checked={prefs.soundEnabled} onChange={(soundEnabled) => update({ soundEnabled })} />
        <Toggle label="Δόνηση" hint="Σε λάθος γράμμα (όπου υποστηρίζεται)" checked={prefs.vibration} onChange={(vibration) => update({ vibration })} />
        <Toggle label="Μειωμένη κίνηση" hint="Λιγότερα εφέ κίνησης" checked={prefs.reducedMotion} onChange={(reducedMotion) => update({ reducedMotion })} />
      </Card>
      {canInstall && (
        <Card>
          <button className="w-full text-left font-semibold" onClick={onInstall}>
            📲 Εγκατάσταση στην αρχική οθόνη
          </button>
        </Card>
      )}
      <p className="text-center text-sm text-ink-soft dark:text-slate-400">Οι ρυθμίσεις κάθε παιχνιδιού (κατηγορίες, δυσκολία, χρόνος) ορίζονται πριν από την έναρξή του.</p>
    </Screen>
  );
}
