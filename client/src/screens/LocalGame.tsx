import { useEffect, useMemo, useState } from 'react';
import type { GameView } from '@kremala/shared';
import type { LocalGameController } from '../lib/localGame';
import { GameScreen } from './GameScreen';

export function LocalGame({ controller, onExit }: { controller: LocalGameController; onExit: () => void }) {
  const [view, setView] = useState<GameView>(() => controller.view());
  const [paused, setPaused] = useState(controller.paused);

  useEffect(() => {
    const unsub = controller.subscribe((v) => {
      setView(v);
      setPaused(controller.paused);
    });
    controller.start();
    // Αυτόματη παύση όταν η εφαρμογή πάει στο παρασκήνιο (μόνο χωρίς bots/online πίεση).
    const onVis = () => {
      if (document.hidden) controller.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      unsub();
      document.removeEventListener('visibilitychange', onVis);
      void controller.save();
      controller.dispose();
    };
  }, [controller]);

  const actions = useMemo(
    () => ({
      guess: (l: string) => controller.guess(l),
      hint: (t: 'reveal' | 'eliminate') => controller.hint(t),
      next: () => controller.next(),
      restart: () => controller.restart(),
      pause: () => controller.pause(),
      resume: () => controller.resume(),
      exit: onExit,
    }),
    [controller, onExit],
  );

  return <GameScreen view={view} actions={actions} canControl paused={paused} />;
}
