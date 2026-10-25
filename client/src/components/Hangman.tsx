// Σχέδιο κρεμάλας σε SVG. Τα τμήματα που προσχεδιάζονται εξαρτώνται από τον
// μέγιστο αριθμό λαθών, ώστε κάθε λάθος να προσθέτει ακριβώς ένα τμήμα.

const PARTS = [
  { key: 'base', d: 'M20 205 H130' },
  { key: 'pole', d: 'M45 205 V15' },
  { key: 'beam', d: 'M45 15 H140' },
  { key: 'rope', d: 'M140 15 V45' },
  { key: 'head', circle: true },
  { key: 'body', d: 'M140 85 V140' },
  { key: 'larm', d: 'M140 100 L115 122' },
  { key: 'rarm', d: 'M140 100 L165 122' },
  { key: 'lleg', d: 'M140 140 L118 175' },
  { key: 'rleg', d: 'M140 140 L162 175' },
] as const;

export function visibleParts(mistakes: number, maxMistakes: number): number {
  const pre = Math.max(0, PARTS.length - maxMistakes);
  return Math.min(PARTS.length, pre + mistakes);
}

export function Hangman({ mistakes, maxMistakes, lost, won, size = 'md' }: { mistakes: number; maxMistakes: number; lost?: boolean; won?: boolean; size?: 'sm' | 'md' }) {
  const shown = visibleParts(mistakes, maxMistakes);
  const left = maxMistakes - mistakes;
  return (
    <svg
      viewBox="0 0 200 220"
      className={size === 'sm' ? 'h-16 w-16' : 'h-full max-h-56 w-full'}
      role="img"
      aria-label={`Κρεμάλα: ${mistakes} από ${maxMistakes} λάθη, απομένουν ${left}`}
    >
      <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth={size === 'sm' ? 10 : 6}>
        {PARTS.map((p, i) => {
          if (i >= shown) return null;
          const isFigure = i >= 4;
          const cls = isFigure ? (lost ? 'stroke-rose-500' : won ? 'stroke-emerald-500' : 'stroke-amber-500') : 'stroke-ink dark:stroke-slate-200';
          const dashed = 'hangman-draw';
          return 'circle' in p ? (
            <circle key={p.key} cx="140" cy="65" r="20" className={`${cls} ${dashed}`} pathLength={300} />
          ) : (
            <path key={p.key} d={p.d} className={`${cls} ${dashed}`} pathLength={300} />
          );
        })}
        {lost && shown >= 5 && (
          <g className="stroke-rose-500" strokeWidth={3}>
            <path d="M131 58 l6 6 M137 58 l-6 6 M143 58 l6 6 M149 58 l-6 6" />
            <path d="M132 76 q8 -6 16 0" />
          </g>
        )}
        {won && shown >= 5 && (
          <g className="stroke-emerald-600" strokeWidth={3}>
            <path d="M133 62 h3 M144 62 h3" />
            <path d="M132 70 q8 8 16 0" />
          </g>
        )}
      </g>
    </svg>
  );
}
