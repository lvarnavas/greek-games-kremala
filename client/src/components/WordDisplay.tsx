export function WordDisplay({ mask, word, status }: { mask: (string | null)[]; word: string | null; status: 'playing' | 'won' | 'lost' }) {
  const hidden = mask.filter((m) => m === null).length;
  const label = word
    ? `Η λέξη ήταν ${word}`
    : `Λέξη ${mask.length} γραμμάτων: ${mask.map((m) => m ?? 'κενό').join(', ')}. Κρυφά γράμματα: ${hidden}`;
  const long = mask.length > 10;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex flex-wrap justify-center gap-1 sm:gap-1.5" role="img" aria-label={label}>
        {mask.map((ch, i) => (
          <span
            key={i}
            className={`flex items-end justify-center border-b-4 font-display font-bold ${long ? 'h-10 w-6 text-2xl sm:w-8 sm:text-3xl' : 'h-12 w-8 text-3xl sm:h-14 sm:w-10 sm:text-4xl'}
              ${ch === ' ' ? 'border-transparent' : status === 'lost' && word ? 'border-rose-400' : status === 'won' ? 'border-emerald-400' : 'border-indigo-300 dark:border-indigo-400/60'}`}
          >
            {ch && <span className="animate-pop">{ch}</span>}
          </span>
        ))}
      </div>
      {word && <p className="text-lg font-semibold">«{word}»</p>}
    </div>
  );
}
