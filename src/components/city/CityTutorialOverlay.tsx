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
  target?: 'pizzer-nav' | 'pizzer-start' | 'pizzer-handover';
};

type TargetRect = { left: number; top: number; width: number; height: number };

const COPY: Record<number, TutorialCopy> = {
  0: {
    kicker: 'Welcome to CityFlow',
    title: 'Start your journey.',
    description: 'Learn the city, complete your first delivery and unlock your first career step.',
    icon: 'home',
    action: 'Start tutorial',
  },
  1: {
    kicker: 'Step 1 · City Level',
    title: 'Every job grows the main level.',
    description: 'Pizza starts at Level 1. Fisher unlocks at 3, Pilot at 6, Cayo at 10 and Gangs at 15.',
    icon: 'star',
    action: 'Show first job',
  },
  2: {
    kicker: 'Step 2 · First career',
    title: 'Open Pizza Courier.',
    description: 'Follow the arrow and open your starting career.',
    icon: 'pizza',
    action: 'Open Pizza Courier',
    target: 'pizzer-nav',
  },
  3: {
    kicker: 'Step 3 · Start working',
    title: 'Start your first shift.',
    description: 'Press Start delivery. The server will assign a random route and start it immediately.',
    icon: 'route',
    action: 'Start delivery',
    target: 'pizzer-start',
  },
  4: {
    kicker: 'Step 4 · Random route',
    title: 'Complete your first delivery.',
    description: 'Your route is already active. Protect the order and use the highlighted handoff button when you are ready.',
    icon: 'package',
    action: 'Complete delivery',
    target: 'pizzer-handover',
  },
  5: {
    kicker: 'Step 5 · Delivery',
    title: 'Finish the customer handoff.',
    description: 'The order prepares automatically. Follow the route, protect the delivery and use the highlighted handoff button when it appears.',
    icon: 'package',
    action: 'Complete handoff',
    target: 'pizzer-handover',
  },
  6: {
    kicker: 'Tutorial complete',
    title: 'Keep your first reward.',
    description: 'Create an account to preserve this Visitor progress and receive your permanent ID number. If you log in, your existing account will be opened instead.',
    icon: 'check',
    action: 'Create account or log in',
  },
};

function visibleTarget(name: string) {
  const candidates = Array.from(document.querySelectorAll<HTMLElement>(`[data-tutorial-target="${name}"]`));
  return candidates.find((element) => {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
      && rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
  }) || null;
}

export default function CityTutorialOverlay({ path, onNavigate }: CityTutorialOverlayProps) {
  const { playerId, player, session } = usePlayer();
  const [progress, setProgress] = useState<CityProgress | null>(readPlayerCityProgress(player));
  const [busy, setBusy] = useState(false);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  useEffect(() => subscribeCityProgress(({ progress: next }) => setProgress(next)), []);

  useEffect(() => {
    if (!playerId) return;
    fetchCityProgress(playerId).then(setProgress).catch(() => {});
  }, [playerId]);

  const tutorial = progress?.tutorial;
  const step = Math.max(0, Math.min(6, Number(tutorial?.step || 0)));
  const hidden = Boolean(tutorial?.completedAt || tutorial?.skippedAt);
  const copy = COPY[step];
  const guided = Boolean(copy?.target);
  const progressLabel = useMemo(() => `${step + 1} / 7`, [step]);

  useEffect(() => {
    if (step !== 2 || path !== '/pizzer' || busy) return;
    setBusy(true);
    advanceCityTutorial(playerId, 3).then(setProgress).finally(() => setBusy(false));
  }, [busy, path, playerId, step]);

  useEffect(() => {
    if (!copy?.target || hidden) {
      setTargetRect(null);
      return;
    }

    const update = () => {
      const target = visibleTarget(copy.target!);
      if (!target) {
        setTargetRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      setTargetRect({ left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    };

    update();
    const timer = window.setInterval(update, 250);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [copy?.target, hidden, path, step]);

  if (!progress || hidden || !copy) return null;

  const runPrimary = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (step === 0) setProgress(await advanceCityTutorial(playerId, 1));
      else if (step === 1) setProgress(await advanceCityTutorial(playerId, 2));
      else if (step === 2) onNavigate('/pizzer');
      else if (step === 6) {
        setProgress(await completeCityTutorial(playerId));
        onNavigate(session?.isGuest ? '/account' : '/city');
      }
    } finally {
      setBusy(false);
    }
  };

  const skip = async () => {
    if (busy) return;
    setBusy(true);
    try {
      setProgress(await skipCityTutorial(playerId));
      onNavigate(session?.isGuest ? '/account' : '/city');
    } finally {
      setBusy(false);
    }
  };

  if (guided) {
    const arrowBelow = targetRect ? targetRect.top < 90 : false;
    const arrowLeft = targetRect ? Math.max(18, Math.min(window.innerWidth - 50, targetRect.left + targetRect.width / 2 - 16)) : 20;
    const arrowTop = targetRect ? (arrowBelow ? targetRect.top + targetRect.height + 8 : targetRect.top - 42) : 80;

    return (
      <div className="pointer-events-none fixed inset-0 z-[185]">
        {targetRect ? (
          <>
            <div
              className="absolute rounded-[18px] border-2 border-[var(--accent)] shadow-[0_0_0_5px_rgba(211,255,81,0.12),0_0_30px_rgba(211,255,81,0.38)] animate-pulse"
              style={{ left: targetRect.left - 6, top: targetRect.top - 6, width: targetRect.width + 12, height: targetRect.height + 12 }}
            />
            <div className="absolute animate-bounce text-4xl font-black text-[var(--accent)] drop-shadow-[0_0_12px_rgba(211,255,81,0.65)]" style={{ left: arrowLeft, top: arrowTop }}>
              {arrowBelow ? '↑' : '↓'}
            </div>
          </>
        ) : null}

        <div className="absolute inset-x-3 bottom-20 mx-auto max-w-xl rounded-[22px] border border-[rgba(211,255,81,0.24)] bg-[#0c1109]/97 p-4 shadow-2xl backdrop-blur-xl md:bottom-5 md:left-[272px]">
          <div className="flex items-start gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#10140b]"><CityIcon name={copy.icon} className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">{copy.kicker}</p><span className="text-[9px] font-black text-white/28">{progressLabel}</span></div>
              <p className="mt-1 text-base font-black text-white">{copy.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/45">{targetRect ? copy.description : 'Complete the current action. The arrow will appear as soon as the next button is available.'}</p>
            </div>
            <button type="button" onClick={() => skip().catch(() => {})} className="pointer-events-auto text-[10px] font-black uppercase tracking-[0.12em] text-white/28 hover:text-white/60">Skip</button>
          </div>
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
            {step < 6 ? <button type="button" onClick={() => skip().catch(() => {})} disabled={busy} className="btn-ghost rounded-xl px-3 py-2 text-[10px] disabled:opacity-40">Skip tutorial</button> : null}
          </div>
          <p className="section-kicker mt-7">{copy.kicker}</p>
          <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{copy.title}</h2>
          <p className="mt-4 text-sm leading-relaxed text-white/43">{copy.description}</p>

          {step === 1 ? (
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
