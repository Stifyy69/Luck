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

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

export default function GangActivityOverlay({ activity }: { activity: GangActivityOverlayState | null }) {
  if (!activity) return null;
  const currentStage = activity.resultText || activity.stages[activity.stageIndex] || 'Preparing operation...';
  return (
    <div className="fixed inset-0 z-[125] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
      <div className="game-panel w-full max-w-4xl overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="relative flex h-[240px] items-center justify-center overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#090c09] p-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(211,255,81,0.11),transparent_55%)]" />
            <div className="relative text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[var(--accent)]/70">Gang operation</p>
              <p className="mt-4 text-5xl font-black tracking-[-0.06em] text-white">{activity.participants}</p>
              <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-white/35">members assigned</p>
              <span className="mt-5 inline-flex rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-white/55">
                {activity.gameTime}
              </span>
            </div>
          </div>

          <div>
            <p className="section-kicker">Operation in progress</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">{activity.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-white/42">{activity.subtitle}</p>

            <div className="mt-6 rounded-[20px] border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.055)] p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">
                {activity.resultText ? 'Operation complete' : `Stage ${Math.min(activity.stages.length, activity.stageIndex + 1)} / ${activity.stages.length}`}
              </p>
              <p className="mt-2 text-xl font-black text-white">{currentStage}</p>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-bold text-white/40">Operation progress</span>
                <span className="font-black text-[var(--accent)]">{Math.round(clampPercent(activity.progress))}%</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${clampPercent(activity.progress)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
