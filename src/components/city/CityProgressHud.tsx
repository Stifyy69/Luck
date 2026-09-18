import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlatformStatus } from '../../context/PlatformStatusContext';
import { usePlayer } from '../../hooks/usePlayer';
import { subscribeCareerRewards, type CareerRewardReceipt } from '../../lib/careerRewards';
import { CAREER_REQUIREMENTS, CITY_UNLOCKS, careerAccessForPath, readPlayerCityProgress, type CityProgress, type CityUnlock } from '../../lib/cityProgress';
import { fetchCityProgress, subscribeCityProgress, type CityProgressEventDetail } from '../../lib/cityProgressApi';
import AccountHud from '../AccountHud';
import CityIcon from '../ui/CityIcon';

type CityProgressHudProps = {
  currentLabel: string;
  onNavigate: (path: string) => void;
};

type LevelUpState = {
  fromLevel: number;
  toLevel: number;
  unlocks: CityUnlock[];
};

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatMoney(receipt: CareerRewardReceipt) {
  if (typeof receipt.money !== 'number') return null;
  const suffix = receipt.moneyType === 'dirty' ? 'dirty' : receipt.moneyType === 'carry' ? 'catch value' : 'clean';
  return `+${receipt.money.toLocaleString('en-US')} $ ${suffix}`;
}

function accessKeyForUnlock(unlock: CityUnlock) {
  const requirement = CAREER_REQUIREMENTS[unlock.path];
  return requirement?.key || null;
}

export default function CityProgressHud({ currentLabel, onNavigate }: CityProgressHudProps) {
  const { playerId, player } = usePlayer();
  const { status } = usePlatformStatus();
  const playerProgress = readPlayerCityProgress(player);
  const [progress, setProgress] = useState<CityProgress | null>(playerProgress);
  const [xpToast, setXpToast] = useState<number | null>(null);
  const [careerReceipt, setCareerReceipt] = useState<CareerRewardReceipt | null>(null);
  const [levelUp, setLevelUp] = useState<LevelUpState | null>(null);
  const initializedRef = useRef(false);
  const previousLevelRef = useRef<number | null>(playerProgress?.level || null);
  const previousXpRef = useRef<number | null>(playerProgress?.xp || null);
  const careerTimerRef = useRef<number | null>(null);

  const applyProgress = (detail: CityProgressEventDetail) => {
    const next = detail.progress;
    const previousLevel = previousLevelRef.current;
    const previousXp = previousXpRef.current;

    if (initializedRef.current && previousXp !== null && next.xp > previousXp) {
      const gained = Number(detail.reward?.awardedXp || next.xp - previousXp);
      if (gained > 0) {
        setXpToast(gained);
        window.setTimeout(() => setXpToast(null), 2200);
      }
    }

    if (initializedRef.current && previousLevel !== null && next.level > previousLevel) {
      const rewardUnlocks = detail.reward?.levelUp?.unlocks || [];
      const fallbackUnlocks = CITY_UNLOCKS.filter((unlock) => unlock.level > previousLevel && unlock.level <= next.level);
      const candidates = rewardUnlocks.length > 0 ? rewardUnlocks : fallbackUnlocks;
      const unlockedNow = candidates.filter((unlock) => {
        const key = accessKeyForUnlock(unlock);
        return !key || Boolean(next.careerAccess?.[key]?.unlocked);
      });
      setLevelUp({
        fromLevel: detail.reward?.levelUp?.fromLevel || previousLevel,
        toLevel: detail.reward?.levelUp?.toLevel || next.level,
        unlocks: unlockedNow,
      });
    }

    previousLevelRef.current = next.level;
    previousXpRef.current = next.xp;
    initializedRef.current = true;
    setProgress(next);
  };

  useEffect(() => {
    if (!playerProgress) return;
    applyProgress({ progress: playerProgress });
  }, [playerProgress?.xp, playerProgress?.level]);

  useEffect(() => subscribeCityProgress(applyProgress), []);

  useEffect(() => subscribeCareerRewards((receipt) => {
    if (careerTimerRef.current) window.clearTimeout(careerTimerRef.current);
    setCareerReceipt(receipt);
    careerTimerRef.current = window.setTimeout(() => setCareerReceipt(null), 3200);
  }), []);

  useEffect(() => () => {
    if (careerTimerRef.current) window.clearTimeout(careerTimerRef.current);
  }, []);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;
    const load = () => fetchCityProgress(playerId).catch(() => null);
    load().catch(() => {});
    const timer = window.setInterval(() => {
      if (!cancelled) load().catch(() => {});
    }, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [playerId]);

  const nextUnlockLabel = useMemo(() => {
    if (!progress) return 'Pizza Courier';
    const locked = CITY_UNLOCKS.find((unlock) => {
      const access = careerAccessForPath(unlock.path, progress);
      return access && !access.unlocked;
    });
    if (!locked) return 'All main careers unlocked';
    const access = careerAccessForPath(locked.path, progress);
    return access?.reason ? `${locked.label}: ${access.reason}` : `${locked.label} at Lv. ${locked.level}`;
  }, [progress]);

  const mainUnlock = levelUp?.unlocks?.[0] || null;
  const receiptMoney = careerReceipt ? formatMoney(careerReceipt) : null;

  return (
    <>
      <div className="fixed left-[68px] right-4 top-4 z-[65] md:left-[280px] lg:left-[288px]">
        <div className="rounded-[20px] border border-white/[0.07] bg-[#090d0a]/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[var(--accent)] text-sm font-black text-[#10140b]">
              {progress?.level || 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-white/35 sm:text-[10px]">
                  City Level · {currentLabel}
                </p>
                <p className="shrink-0 text-[9px] font-black text-white/55 sm:text-[10px]">
                  {progress?.nextLevelXp === null ? 'MAX' : `${progress?.currentLevelXp || 0} / ${progress?.nextLevelXp || 0} XP`}
                </p>
              </div>

              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-700 ease-out" style={{ width: `${progress?.progressPercent || 0}%` }} />
              </div>

              <div className="mt-1.5 flex min-w-0 items-center justify-between gap-3">
                <p className="min-w-0 truncate text-[8px] font-bold uppercase tracking-[0.1em] text-white/24 sm:text-[9px] sm:tracking-[0.12em]">
                  Next unlock: {nextUnlockLabel}
                </p>
                {status.vip.active ? (
                  <span className="hidden shrink-0 rounded-full border border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.075)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--accent)] sm:inline-flex">
                    {status.vip.label} · {formatRemaining(status.vip.remainingMs)}
                  </span>
                ) : null}
              </div>
            </div>

            <AccountHud embedded />
          </div>
        </div>

        {xpToast && !careerReceipt ? (
          <div className="animate-toast-in pointer-events-none absolute left-1/2 top-[72px] -translate-x-1/2 rounded-full border border-[rgba(211,255,81,0.25)] bg-[#11170d]/95 px-4 py-2 text-[11px] font-black uppercase tracking-[0.13em] text-[var(--accent)] shadow-2xl">
            +{xpToast} City XP
          </div>
        ) : null}
      </div>

      {careerReceipt ? (
        <div className="animate-toast-in pointer-events-none fixed inset-0 z-[210] flex items-center justify-center bg-black/78 px-4 backdrop-blur-md">
          <div className="game-panel relative w-full max-w-xl overflow-hidden p-7 text-center sm:p-9">
            <div className="pointer-events-none absolute left-1/2 top-[-150px] h-[300px] w-[420px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.09] blur-3xl" />
            <div className="relative">
              <p className="section-kicker">{careerReceipt.title}</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.055em] text-white">Activity complete</h2>
              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {receiptMoney ? (
                  <div className="rounded-[18px] border border-white/[0.08] bg-white/[0.025] p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Reward</p>
                    <p className={`mt-2 text-xl font-black ${careerReceipt.moneyType === 'dirty' ? 'text-amber-100' : careerReceipt.moneyType === 'carry' ? 'text-sky-100' : 'text-[var(--money)]'}`}>{receiptMoney}</p>
                  </div>
                ) : null}
                {typeof careerReceipt.careerXp === 'number' ? (
                  <div className="rounded-[18px] border border-[rgba(211,255,81,0.16)] bg-[rgba(211,255,81,0.045)] p-5">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">{careerReceipt.careerLabel || 'Job XP'}</p>
                    <p className="mt-2 text-xl font-black text-[var(--accent)]">+{careerReceipt.careerXp} XP</p>
                  </div>
                ) : null}
                {typeof careerReceipt.cityXp === 'number' && careerReceipt.cityXp > 0 ? (
                  <div className="rounded-[18px] border border-[rgba(114,183,255,0.16)] bg-[rgba(114,183,255,0.045)] p-5 sm:col-span-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">City XP</p>
                    <p className="mt-2 text-xl font-black text-[var(--info)]">+{careerReceipt.cityXp} XP</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {levelUp ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center overflow-hidden bg-black/90 p-4 backdrop-blur-xl">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)] opacity-[0.11] blur-[110px]" />
          <div className="relative w-full max-w-2xl text-center">
            <p className="text-[11px] font-black uppercase tracking-[0.32em] text-[var(--accent)]">City level up</p>
            <div className="mt-8 flex items-center justify-center gap-5 sm:gap-8">
              <span className="text-5xl font-black tracking-[-0.08em] text-white/25 sm:text-7xl">{levelUp.fromLevel}</span>
              <CityIcon name="route" className="h-8 w-8 text-[var(--accent)] sm:h-10 sm:w-10" />
              <span className="text-8xl font-black tracking-[-0.09em] text-white sm:text-[10rem]">{levelUp.toLevel}</span>
            </div>

            <div className="mx-auto mt-8 max-w-xl rounded-[24px] border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.055)] p-6">
              {mainUnlock ? (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--accent)]">New career unlocked</p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">{mainUnlock.label}</h2>
                </>
              ) : (
                <>
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[var(--accent)]">Account progression</p>
                  <h2 className="mt-3 text-4xl font-black tracking-[-0.05em] text-white">City Level {levelUp.toLevel}</h2>
                </>
              )}
            </div>

            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              {mainUnlock ? <button type="button" onClick={() => { setLevelUp(null); onNavigate(mainUnlock.path); }} className="btn-primary rounded-2xl px-7 py-3.5 text-sm">View {mainUnlock.label}</button> : null}
              <button type="button" onClick={() => setLevelUp(null)} className="btn-ghost rounded-2xl px-7 py-3.5 text-sm">Continue</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
