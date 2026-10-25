import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, sanitizeSettings, type GameMode, type Settings, type Theme } from '@kremala/shared';
import { getKV, setKV } from './db';
import { setSoundEnabled } from './sound';

export type KeyboardLayout = 'alphabetical' | 'qwerty';

export interface Prefs {
  playerName: string;
  theme: Theme;
  soundEnabled: boolean;
  vibration: boolean;
  reducedMotion: boolean;
  keyboardLayout: KeyboardLayout;
  /** Τελευταίες ρυθμίσεις ανά λειτουργία. */
  lastSettings: Partial<Record<GameMode, Settings>>;
}

export const DEFAULT_PREFS: Prefs = {
  playerName: '',
  theme: 'system',
  soundEnabled: true,
  vibration: true,
  reducedMotion: false,
  keyboardLayout: 'alphabetical',
  lastSettings: {},
};

export async function loadPrefs(): Promise<Prefs> {
  const stored = await getKV<Partial<Prefs>>('prefs');
  return { ...DEFAULT_PREFS, ...stored };
}

export function settingsFor(prefs: Prefs, mode: GameMode): Settings {
  const s = sanitizeSettings({ ...DEFAULT_SETTINGS, ...prefs.lastSettings[mode], gameMode: mode });
  return { ...s, soundEnabled: prefs.soundEnabled, theme: prefs.theme, reducedMotion: prefs.reducedMotion };
}

const Ctx = createContext<{ prefs: Prefs; update: (p: Partial<Prefs>) => void }>({ prefs: DEFAULT_PREFS, update: () => {} });

export function PrefsProvider({ initial, children }: { initial: Prefs; children: ReactNode }) {
  const [prefs, setPrefs] = useState(initial);
  useEffect(() => {
    const root = document.documentElement;
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => root.classList.toggle('dark', prefs.theme === 'dark' || (prefs.theme === 'system' && !!media?.matches));
    apply();
    media?.addEventListener?.('change', apply);
    root.classList.toggle('reduce-motion', prefs.reducedMotion);
    setSoundEnabled(prefs.soundEnabled);
    return () => media?.removeEventListener?.('change', apply);
  }, [prefs.theme, prefs.reducedMotion, prefs.soundEnabled]);
  const update = (p: Partial<Prefs>) =>
    setPrefs((cur) => {
      const next = { ...cur, ...p };
      void setKV('prefs', next);
      return next;
    });
  return <Ctx.Provider value={{ prefs, update }}>{children}</Ctx.Provider>;
}

export const usePrefs = () => useContext(Ctx);
