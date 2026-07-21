import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { advanceCityTutorial, completeCityTutorial, fetchCityProgress, skipCityTutorial, subscribeCityProgress } from '../../lib/cityProgressApi';
import { readPlayerCityProgress, type CityProgress } from '../../lib/cityProgress';
import CityIcon, { type CityIconName } from '../ui/CityIcon';

type CityTutorialOverlayProps = {
  path: string;
  onNavigate: (path: string) => void;
};

type TutorialCopy = {
  kicker: string;
  title: string;
  description: string;
  icon: CityIconName;
  action: string;
  secondary?: string;
};

const COPY: Record<number, TutorialCopy> = {
  0: {
    kicker: 'Welcome to CityFlow',
    title: 'Build your life in the city.',
    description: 'Work careers, earn money, grow your City Level and unlock the rest of the map one step at a time.',
    icon: 'home',
    action: 'Enter the city',
  },
  1: {
    kicker: 'Step 1 · Identity',
    title: 'Choose the name people will know.',
    description: 'Your city name appears in careers, market activity, rankings and future social systems.',
    icon: 'profile',
    action: 'Open My Profile',
  },
  2: {
    kicker: 'Step 2 · City Level',
    title: 'Every job grows the main level.',
    description: 'Pizza starts at Level 1. Fisher unlocks at 3, Pilot at 6, Cayo at 10 and Gangs at 15.',
    icon: 'star',
    action: 'Show my first career',
  },
  3: {
    kicker: 'Step 3 · First career',
    title: 'Pizza Courier is your starting point.',
    description: 'Complete deliveries to earn clean money, Courier XP and City XP. Better performance gives better rewards.',
    icon: 'pizza',
    action: 'Start Pizza Courier',
  },
  4: {
    kicker: 'Step 4 · Dispatch',
    title: 'Choose the next run.',
    description: 'Start the shift, inspect the available contracts and accept the run that fits your risk and payout.',
    icon: 'route',
    action: 'Continue on Pizza',
  },
  5: {
    kicker: 'Step 5 · Delivery',
    title: 'Protect the order until handoff.',
    description: 'The kitchen prepares automatically. Keep freshness and vehicle condition high, then complete the customer handoff.',
    icon: 'package',
    action: 'Finish the delivery',
  },
  6: {
    kicker: 'Tutorial complete',
    title: 'Your city life is active.',
    description: 'The first reward is in your account. Follow the City Level bar to unlock Fisher, Pilot, Cayo and Gangs.',
    icon: 'check',
    action: 'Enter the full city',
  },
};

export default function CityTutorialOverlay({ path, onNavigate }: CityTutorialOverlayProps) {
  const { playerId, player } = usePlayer();
  const [progress, setProgress] = useState<CityProgress | null>(readPlayerCityProgress(player));
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeCityProgress(({ progress: next }) => setProgress(next)), []);

  useEffect(() => {
    if (!playerId) return;
    fetchCityProgress(playerId).then(setProgress).catch(() => {});
  }, [playerId]);

  const tutorial = progress?.tutorial;
  const step = Math.max(0, Math.min(6, Number(tutorial?.step || 0)));
  const hidden = Boolean(tutorial?.completedAt || tutorial?.skippedAt);
  const copy = COPY[step];
  const compact = (step === 1 && path === '/profile') || (step >= 4 && step <= 5 && path === '/pizzer');

  const progressLabel = useMemo(() => `${Math.min(6, step + 1)} / 7`, [step]);

  if (!progress || hidden || !copy) return null;

  const runPrimary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step === 0) {
        const next = await advanceCityTutorial(playerId, 1);
        setProgress(next);
      } else if (step === 1) {
        onNavigate('/profile');
        if (String(player?.displayName || '').trim()) {
          const next = await advanceCityTutorial(playerId, 2);
          setProgress(next);
        }
      } else if (step === 2) {
        const next = await advanceCityTutorial(playerId, 3);
        setProgress(next);
      } else if (step === 3) {
        onNavigate('/pizzer');
        const next = await advanceCityTutorial(playerId, 4);
        setProgress(next);
      } else if (step === 4 || step === 5) {
        onNavigate('/pizzer');
      } else if (step === 6) {
        const next = await completeCityTutorial(playerId);
        setProgress(next);
        onNavigate('/city');
      }
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await skipCityTutorial(playerId);
      setProgress(next);
    } finally {
      setBusy(false);
    }
  };

  if (compact) {
    return (
      <div className="fixed inset-x-4 bottom-4 z-[180] mx-auto max-w-xl rounded-[22px] border border-[rgba(211,255,81,0.22)] bg-[#0c1109]/95 p-4 shadow-2xl backdrop-blur-xl md:left-[272px]">
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#10140b]"><CityIcon name={copy.icon} className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">{copy.kicker}</p><span className="text-[9px] font-black text-white/28">{progressLabel}</span></div>
            <p className="mt-1 text-base font-black text-white">{copy.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-white/42">{step === 1 && path === '/profile' ? 'Use Edit identity, save your city name, and the tutorial will continue automatically.' : copy.description}</p>
          </div>
          <button type="button" onClick={skip} className="text-[10px] font-black uppercase tracking-[0.12em] text-white/28 hover:text-white/60">Skip</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[190] flex items-center justify-center bg-black/78 p-4 backdrop-blur-lg">
      <div className="game-panel relative w-full max-w-[560px] overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute right-[-100px] top-[-130px] h-[300px] w-[300px] rounded-full bg-[var(--accent)] opacity-[0.08] blur-3xl" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.07)] text-[var(--accent)]"><CityIcon name={copy.icon} className="h-7 w-7" /></span>
            <button type="button" onClick={skip} disabled={busy} className="btn-ghost rounded-xl px-3 py-2 text-[10px] disabled:opacity-40">Skip tutorial</button>
          </div>
          <p className="section-kicker mt-7">{copy.kicker}</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{copy.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/43">{copy.description}</p>

          {step === 2 ? (
            <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[['1', 'Pizza'], ['3', 'Fisher'], ['6', 'Pilot'], ['10', 'Cayo'], ['15', 'Gangs']].map(([level, label]) => (
                <div key={label} className="rounded-[16px] border border-white/[0.07] bg-black/20 p-3 text-center"><p className="text-lg font-black text-[var(--accent)]">{level}</p><p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-white/34">{label}</p></div>
              ))}
            </div>
          ) : null}

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.13em] text-white/28"><span>Tutorial progress</span><span>{progressLabel}</span></div>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${((step + 1) / 7) * 100}%` }} /></div>
          </div>

          <button type="button" onClick={() => runPrimary().catch(() => {})} disabled={busy} className="btn-primary mt-7 w-full rounded-2xl px-5 py-3.5 text-sm disabled:opacity-40">{busy ? 'Loading...' : copy.action}</button>
        </div>
      </div>
    </div>
  );
}
