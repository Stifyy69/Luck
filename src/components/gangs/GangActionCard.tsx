export default function GangActionCard({
  title,
  duration,
  description,
  stats,
  buttonLabel,
  disabled,
  onClick,
  tone = 'default',
}: {
  title: string;
  duration: string;
  description: string;
  stats: Array<{ label: string; value: string }>;
  buttonLabel: string;
  disabled: boolean;
  onClick: () => void;
  tone?: 'default' | 'combat';
}) {
  const toneClass = tone === 'combat' ? 'border-red-300/12 bg-red-400/[0.025]' : 'border-white/[0.08] bg-black/20';
  return (
    <article className={`flex h-full min-h-[310px] flex-col rounded-[22px] border p-5 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-black text-white">{title}</p>
          <p className="mt-2 text-xs leading-5 text-white/40">{description}</p>
        </div>
        <span className="shrink-0 rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)]/70">{duration}</span>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3">
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{stat.label}</p>
            <p className="mt-1 text-xs font-black text-white/72">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-auto pt-5">
        <button type="button" disabled={disabled} onClick={onClick} className="btn-primary w-full rounded-xl px-4 py-3 text-xs disabled:cursor-not-allowed disabled:opacity-30">
          {buttonLabel}
        </button>
      </div>
    </article>
  );
}
