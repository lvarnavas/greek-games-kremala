import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-indigo-700 text-white hover:bg-indigo-800 shadow-sm shadow-indigo-900/20 dark:bg-indigo-500 dark:hover:bg-indigo-400 dark:text-white',
  accent: 'bg-amber-400 text-ink hover:bg-amber-300 shadow-sm shadow-amber-900/20',
  secondary: 'bg-white text-ink ring-1 ring-black/10 hover:bg-slate-50 dark:bg-white/10 dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/15',
  ghost: 'text-ink-soft hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
};

export function Button({ variant = 'primary', className = '', size = 'md', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5', lg: 'px-6 py-3.5 text-lg' };
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-white/5 dark:ring-white/10 ${className}`}>{children}</div>;
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'green' | 'red' | 'amber' | 'indigo' }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200',
    green: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-200',
    red: 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200',
    amber: 'bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200',
    indigo: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Screen({ title, onBack, children, actions }: { title: string; onBack?: () => void; children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center gap-2">
        {onBack && (
          <button onClick={onBack} className="-ml-2 rounded-full p-2 text-2xl leading-none hover:bg-black/5 dark:hover:bg-white/10" aria-label="Πίσω">
            ←
          </button>
        )}
        <h1 className="flex-1 font-display text-2xl font-bold">{title}</h1>
        {actions}
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string; disabled?: boolean }) {
  return (
    <label className={`flex items-center justify-between gap-4 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'}`}>
      <span>
        <span className="block font-medium">{label}</span>
        {hint && <span className="block text-sm text-ink-soft dark:text-slate-400">{hint}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
        <span className="h-7 w-12 rounded-full bg-slate-300 transition peer-checked:bg-indigo-600 peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-400 dark:bg-white/20" />
        <span className="absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5" />
      </span>
    </label>
  );
}

export function Segmented<T extends string | number>({ label, value, options, onChange, disabled }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <fieldset className="py-2" disabled={disabled}>
      <legend className="mb-1.5 font-medium">{label}</legend>
      <div className="flex flex-wrap gap-1.5" role="radiogroup">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:opacity-50 ${value === o.value ? 'bg-indigo-700 text-white dark:bg-indigo-500' : 'bg-slate-100 text-ink hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/15'}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block py-2">
      <span className="mb-1.5 block font-medium">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base ring-1 ring-black/15 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-white/10 dark:ring-white/20';

export function Modal({ children, label, onClose }: { children: ReactNode; label: string; onClose?: () => void }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg animate-fadeup overflow-y-auto rounded-3xl bg-paper p-5 shadow-2xl dark:bg-[#1d1a2c]" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
