import { useCallback, useEffect, useState } from 'react';
import type { BotLevel, GameMode, Settings } from '@kremala/shared';
import { Home, type HomeAction } from './screens/Home';
import { LocalSetup } from './screens/LocalSetup';
import { LocalGame } from './screens/LocalGame';
import { Online } from './screens/Online';
import { Stats } from './screens/Stats';
import { HowTo } from './screens/HowTo';
import { SettingsScreen } from './screens/SettingsScreen';
import { LocalGameController } from './lib/localGame';
import { loadProgress, type SavedProgress } from './lib/db';
import { useOnlineStatus } from './lib/hooks';
import { loadSession } from './lib/online';

type Route =
  | { name: 'home' }
  | { name: 'setup'; mode: GameMode; pickMode?: boolean }
  | { name: 'local'; controller: LocalGameController }
  | { name: 'online'; mode?: GameMode; code?: string }
  | { name: 'stats' | 'howto' | 'settings' };

interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
}

function initialRoute(): Route {
  const code = new URLSearchParams(location.search).get('room');
  if (code) return { name: 'online', code: code.toUpperCase().slice(0, 5) };
  if (loadSession()) return { name: 'online' };
  return { name: 'home' };
}

export function App() {
  const [route, setRoute] = useState<Route>(initialRoute);
  const [saved, setSaved] = useState<SavedProgress | null>(null);
  const [installEvt, setInstallEvt] = useState<InstallPrompt | null>(null);
  const isOnline = useOnlineStatus();

  useEffect(() => {
    if (route.name === 'home') void loadProgress().then(setSaved);
    window.scrollTo(0, 0);
  }, [route]);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvt(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const home = useCallback(() => {
    if (location.search) history.replaceState(null, '', '/');
    setRoute({ name: 'home' });
  }, []);

  const onHome = (a: HomeAction) => {
    if (a.type === 'local') setRoute({ name: 'setup', mode: a.mode });
    else if (a.type === 'bots') setRoute({ name: 'setup', mode: 'duel', pickMode: true });
    else if (a.type === 'online') setRoute({ name: 'online', mode: a.mode });
    else if (a.type === 'continue' && saved) setRoute({ name: 'local', controller: LocalGameController.restore(saved) });
    else if (a.type === 'stats' || a.type === 'howto' || a.type === 'settings') setRoute({ name: a.type });
  };

  const startLocal = (settings: Settings, bots: BotLevel[], name: string) => {
    setRoute({ name: 'local', controller: LocalGameController.create({ settings, bots, playerName: name }) });
  };

  switch (route.name) {
    case 'home':
      return <Home onAction={onHome} saved={saved} isOnline={isOnline} />;
    case 'setup':
      return <LocalSetup key={route.mode} mode={route.mode} pickMode={route.pickMode} onBack={home} onStart={startLocal} />;
    case 'local':
      return <LocalGame controller={route.controller} onExit={home} />;
    case 'online':
      return <Online initialMode={route.mode} initialCode={route.code} onExit={home} />;
    case 'stats':
      return <Stats onBack={home} />;
    case 'howto':
      return <HowTo onBack={home} />;
    case 'settings':
      return (
        <SettingsScreen
          onBack={home}
          canInstall={!!installEvt}
          onInstall={() => {
            void installEvt?.prompt();
            setInstallEvt(null);
          }}
        />
      );
  }
}
