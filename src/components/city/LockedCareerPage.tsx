import type { CityProgress } from '../../lib/cityProgress';
import CityIcon, { type CityIconName } from '../ui/CityIcon';

type LockedCareerPageProps = {
  label: string;
  icon: CityIconName;
  requiredLevel: number | null;
  vipOnly?: boolean;
  progress: CityProgress | null;
  onNavigate: (path: string) => void;
  recommendedPath: string;
};

export default function LockedCareerPage({ label, icon, requiredLevel, vipOnly, progress, onNavigate, recommendedPath }: LockedCareerPageProps) {
  const currentLevel = progress?.level || 1;
  const targetTotalXp = requiredLevel && progress?.nextUnlock?.level === requiredLevel
    ? progress.nextLevelTotalXp
    : null;
  const progressPercent = vipOnly
    ? 0
    : requiredLevel
      ? Math.max(0, Math.min(100, (currentLevel / requiredLevel) * 100))
      : 0;

  return (
    <div className="min-h-screen px-4 pb-10 pt-24 sm:px-6 md:px-8 md:pb-12 lg:pt-8">
      <div className="mx-auto max-w-[900px]">
        <section className="game-panel relative overflow-hidden p-6 text-center sm:p-9 lg:p-12">
          <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[480px] w-[620px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.055] blur-3xl" />
          <div className="relative mx-auto max-w-2xl">
            <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-[26px] border border-white/[0.09] bg-black/25 text-[var(--accent)]">
              <CityIcon name={icon} className="h-9 w-9" />
            </span>
            <p className="section-kicker mt-7">Career locked</p>
            <h1 className="display-title mt-4">{label}</h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/43">
              {vipOnly
                ? 'Night Shift is a VIP recovery benefit. Activate VIP Silver or VIP Gold to access this activity.'
                : `Reach City Level ${requiredLevel} to unlock this career and its progression.`}
            </p>

            <div className="mx-auto mt-8 max-w-xl rounded-[22px] border border-white/[0.07] bg-black/20 p-5 text-left">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/28">Current access</p>
                  <p className="mt-2 text-2xl font-black text-white">{vipOnly ? 'VIP required' : `City Level ${currentLevel}`}</p>
                </div>
                <span className="rounded-full border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.06)] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-[var(--accent)]">
                  {vipOnly ? 'VIP' : `Unlock Lv. ${requiredLevel}`}
                </span>
              </div>

              {!vipOnly ? (
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                    <span className="font-bold text-white/38">City progression</span>
                    <span className="font-black text-white">{targetTotalXp ? `${progress?.xp || 0} / ${targetTotalXp} XP` : `Level ${currentLevel} / ${requiredLevel}`}</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
                </div>
              ) : null}
            </div>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <button type="button" onClick={() => onNavigate(recommendedPath)} className="btn-primary rounded-2xl px-6 py-3.5 text-sm">
                {vipOnly ? 'Open inventory' : 'Continue available career'}
              </button>
              <button type="button" onClick={() => onNavigate('/city')} className="btn-ghost rounded-2xl px-6 py-3.5 text-sm">Back to City Hub</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
