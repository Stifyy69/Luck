export type GangActivityOverlayState = {
  title: string;
  subtitle: string;
  gameTime: string;
  stages: string[];
  stageIndex: number;
  progress: number;
  participants: number;
  resultText?: string;
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export default function GangActivityOverlay({ activity }: { activity: GangActivityOverlayState | null }) {
  if (!activity) return null;
  const complete = Boolean(activity.resultText);
  const stage = activity.stages[activity.stageIndex] || 'Preparing operation';
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
      <div className="game-panel w-full max-w-xl p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div><p className="section-kicker">{complete ? 'Operation complete' : 'Operation in progress'}</p><h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{activity.title}</h2></div>
          <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--accent)]/70">{activity.gameTime}</span>
        </div>
        <div className={`mt-5 rounded-[18px] border p-4 ${complete ? 'border-emerald-300/15 bg-emerald-400/[0.045]' : 'border-white/[0.08] bg-black/20'}`}>
          <p className="text-[8px] font-black uppercase tracking-[0.11em] text-white/28">{complete ? 'Result' : `Stage ${Math.min(activity.stages.length, activity.stageIndex + 1)} of ${activity.stages.length}`}</p>
          <p className={`mt-2 text-lg font-black ${complete ? 'text-emerald-100' : 'text-white'}`}>{activity.resultText || stage}</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2"><Info label="Members" value={String(activity.participants)} /><Info label="Game time" value={activity.gameTime} /></div>
        <div className="mt-5"><div className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.1em] text-white/30"><span>Progress</span><span>{Math.round(clamp(activity.progress))}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300" style={{ width: `${clamp(activity.progress)}%` }} /></div></div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 text-xs font-black text-white/72">{value}</p></div>; }
