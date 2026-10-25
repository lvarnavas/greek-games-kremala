import { formatTime } from '../lib/format';

export function Timer({ deadline, startedAt, now, finishedAt }: { deadline: number | null; startedAt: number; now: number; finishedAt: number | null }) {
  if (deadline === null) return <span className="text-sm text-ink-soft dark:text-slate-400" aria-label="Χωρίς χρονόμετρο">∞</span>;
  const end = finishedAt ?? now;
  const remaining = Math.max(0, deadline - end);
  const pct = Math.max(0, Math.min(100, (remaining / (deadline - startedAt)) * 100));
  const urgent = remaining <= 15_000 && finishedAt === null;
  return (
    <div className="flex min-w-[5.5rem] flex-col items-end gap-1" role="timer" aria-label={`Απομένουν ${Math.ceil(remaining / 1000)} δευτερόλεπτα`}>
      <span className={`font-mono text-xl font-bold tabular-nums ${urgent ? 'text-rose-600 dark:text-rose-400' : ''}`}>⏱ {formatTime(remaining)}</span>
      <span className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <span className={`block h-full rounded-full transition-[width] duration-300 ${urgent ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}
