type Tone = 'neutral' | 'good' | 'bad' | 'warn';

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-emerald-100 text-emerald-800',
  bad: 'bg-red-100 text-red-800',
  warn: 'bg-amber-100 text-amber-800',
};

/** A status pill. Colour is never the only signal — the label text always says the state in words too. */
export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
