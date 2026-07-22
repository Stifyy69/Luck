import type { GangActivityLogEntry } from '../../lib/gangActivity';

export default function GangActivityLog({ entries }: { entries: GangActivityLogEntry[] }) {
  return (
    <section className="game-panel-soft p-5 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="section-kicker">Activity</p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Gang log</h2>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/45">
          {entries.length}/50
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {entries.length > 0 ? entries.slice(0, 10).map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-3">
            <p className={`text-xs font-bold leading-5 ${toneClass(entry.tone)}`}>{entry.message}</p>
            <span className="shrink-0 text-[9px] font-bold text-white/22">{formatTime(entry.createdAt)}</span>
          </div>
        )) : (
          <div className="rounded-xl border border-dashed border-white/[0.08] px-4 py-7 text-center text-xs font-bold text-white/25">No activity yet</div>
        )}
      </div>
    </section>
  );
}

function toneClass(tone: GangActivityLogEntry['tone']) {
  if (tone === 'positive') return 'text-emerald-100/80';
  if (tone === 'negative') return 'text-red-100/80';
  if (tone === 'warning') return 'text-amber-100/80';
  return 'text-white/55';
}

function formatTime(value: number) {
  try {
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
