import { useEffect, useState } from 'react';
import { online, type OnlineSnapshot } from './online';

export function useOnlineStatus(): boolean {
  const [on, setOn] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const up = () => setOn(true), down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return on;
}

export function useOnlineClient(): OnlineSnapshot {
  const [snap, setSnap] = useState(online.snap);
  useEffect(() => online.subscribe(setSnap), []);
  return snap;
}

/** Τρέχων χρόνος που ανανεώνεται περιοδικά (για χρονόμετρα). */
export function useNow(intervalMs = 250, offset = 0, frozenAt: number | null = null): number {
  const [now, setNow] = useState(() => Date.now() + offset);
  useEffect(() => {
    if (frozenAt !== null) return;
    const t = setInterval(() => setNow(Date.now() + offset), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs, offset, frozenAt]);
  return frozenAt ?? now;
}
