'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';

type RewardTier = 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
type CostType = 'cash' | 'ogc' | 'fragments';

type RouletteReward = {
  name: string;
  subtitle: string;
  tier: RewardTier;
  emoji: string;
  payout?: number;
};

const rewards: RouletteReward[] = [
  { name: 'Vehicul Suvenir', subtitle: 'Editie limitata', tier: 'legendary', emoji: '🚗' },
  { name: 'VIP Gold', subtitle: 'x2 rewards, 10 minute', tier: 'epic', emoji: '💎' },
  { name: 'VIP Silver', subtitle: 'x2 rewards, 5 minute', tier: 'epic', emoji: '💠' },
  { name: 'Mystery Box', subtitle: 'Obiecte unice', tier: 'epic', emoji: '📦' },
  { name: 'Fragmente Ruleta', subtitle: 'x5 fragmente', tier: 'rare', emoji: '🪙' },
  { name: 'FlowCoins', subtitle: '10 FlowCoins', tier: 'rare', emoji: '🟠' },
  { name: 'Slot Vehicle', subtitle: '1 slot', tier: 'rare', emoji: '➕' },
  { name: 'Voucher Showroom', subtitle: '1 voucher', tier: 'rare', emoji: '🎟️' },
  { name: 'Job Boost Pilot', subtitle: 'Single run x2', tier: 'uncommon', emoji: '📈' },
  { name: 'Xenon Vehicul', subtitle: '1 pachet xenon', tier: 'common', emoji: '🔩' },
  { name: 'Bani', subtitle: '25.000 - 50.000 $', tier: 'common', emoji: '💵' },
];

const rarityLabel: Record<RewardTier, string> = {
  legendary: 'Legendary',
  epic: 'Epic',
  rare: 'Rare',
  uncommon: 'Uncommon',
  common: 'Common',
};

const tierStyles: Record<RewardTier, string> = {
  legendary: 'border-amber-300/30 bg-amber-400/[0.07] text-amber-100',
  epic: 'border-rose-300/25 bg-rose-400/[0.055] text-rose-100',
  rare: 'border-violet-300/25 bg-violet-400/[0.055] text-violet-100',
  uncommon: 'border-sky-300/22 bg-sky-400/[0.05] text-sky-100',
  common: 'border-white/[0.09] bg-white/[0.025] text-white/75',
};

const COST_OPTIONS: Array<{ id: CostType; label: string; price: string; balanceLabel: string }> = [
  { id: 'cash', label: 'Clean money', price: '100.000 $', balanceLabel: 'Clean balance' },
  { id: 'ogc', label: 'FlowCoins', price: '30 FlowCoins', balanceLabel: 'FlowCoins' },
  { id: 'fragments', label: 'Fragments', price: '4 fragments', balanceLabel: 'Fragments' },
];

const CARD_WIDTH = 156;
const CARD_GAP = 10;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const TRACK_REPEATS = 56;
const START_INDEX = rewards.length * 4;
const SPIN_DURATION_MS = 4600;
const MIN_EXTRA_LOOPS = 6;
const MAX_EXTRA_LOOPS = 8;

function getTranslateForIndex(index: number, viewportWidth: number) {
  return -(index * CARD_STEP) + viewportWidth / 2 - CARD_WIDTH / 2;
}

function formatNumber(value: number) {
  return value.toLocaleString('en-US');
}

export default function RouletteDemo() {
  const { player, playerId, refresh } = usePlayer();
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentIndexRef = useRef(START_INDEX);
  const timersRef = useRef<number[]>([]);

  const [viewportWidth, setViewportWidth] = useState(920);
  const [translateX, setTranslateX] = useState(getTranslateForIndex(START_INDEX, 920));
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeCost, setActiveCost] = useState<CostType>('cash');
  const [selectedReward, setSelectedReward] = useState<RouletteReward | null>(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState<number | null>(START_INDEX);
  const [latestWins, setLatestWins] = useState<RouletteReward[]>([rewards[0], rewards[1], rewards[4], rewards[10]]);
  const [fragments, setFragments] = useState(0);
  const [flowCoinsBalance, setFlowCoinsBalance] = useState(0);
  const [cashBalance, setCashBalance] = useState(0);
  const [spinCount, setSpinCount] = useState(0);
  const [nearVehicleIndex, setNearVehicleIndex] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trackRewards = useMemo(() => Array.from({ length: TRACK_REPEATS }, () => rewards).flat(), []);

  useEffect(() => {
    const measure = () => {
      if (!viewportRef.current) return;
      const width = viewportRef.current.clientWidth;
      setViewportWidth(width);
      setTranslateX(getTranslateForIndex(currentIndexRef.current, width));
    };
    measure();
    window.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (!player) return;
    setCashBalance(Number(player.cleanMoney || 0));
    setFlowCoinsBalance(Number(player.flowCoins || 0));
    setFragments(Number(player.rouletteFragments || 0));
  }, [player]);

  const scheduleTask = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
    return timer;
  };

  const clearScheduledTasks = () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const getAudioContext = () => {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current) audioContextRef.current = new AudioContextClass();
    return audioContextRef.current;
  };

  const playTone = ({ frequency = 440, sweepTo, duration = 0.08, volume = 0.02, type = 'triangle' }: { frequency?: number; sweepTo?: number; duration?: number; volume?: number; type?: OscillatorType }) => {
    const context = getAudioContext();
    if (!context) return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (typeof sweepTo === 'number') oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const playStartSound = () => {
    playTone({ frequency: 180, sweepTo: 65, duration: 0.22, volume: 0.022, type: 'sawtooth' });
    scheduleTask(() => playTone({ frequency: 260, sweepTo: 140, duration: 0.11, volume: 0.014 }), 70);
  };

  const playTickSound = (strength = 1) => {
    const randomShift = Math.random() * 90;
    playTone({ frequency: 820 + randomShift, sweepTo: 580 + randomShift * 0.4, duration: 0.045, volume: 0.012 + strength * 0.006, type: 'square' });
  };

  const playWinSound = () => {
    playTone({ frequency: 520, duration: 0.08, volume: 0.024 });
    scheduleTask(() => playTone({ frequency: 660, duration: 0.1, volume: 0.024 }), 90);
    scheduleTask(() => playTone({ frequency: 860, duration: 0.16, volume: 0.02, type: 'sine' }), 190);
  };

  const scheduleSpinSounds = () => {
    playStartSound();
    const tickCount = 28;
    for (let index = 1; index <= tickCount; index += 1) {
      const progress = index / tickCount;
      const easedTime = SPIN_DURATION_MS * (1 - Math.pow(1 - progress, 2.18));
      scheduleTask(() => playTickSound(1 - progress * 0.35), easedTime);
    }
  };

  const canAfford = (costType: CostType) => {
    if (costType === 'cash') return cashBalance >= 100_000;
    if (costType === 'ogc') return flowCoinsBalance >= 30;
    return fragments >= 4;
  };

  const balanceFor = (costType: CostType) => {
    if (costType === 'cash') return `${formatNumber(cashBalance)} $`;
    if (costType === 'ogc') return formatNumber(flowCoinsBalance);
    return `${formatNumber(fragments)} / 4`;
  };

  const handleSpin = async (costType: CostType) => {
    if (!playerId || !player || isSpinning || !viewportWidth || !canAfford(costType)) return;
    clearScheduledTasks();
    setErrorMessage(null);

    const context = getAudioContext();
    if (context?.state === 'suspended') await context.resume();

    let spinResult;
    try {
      spinResult = await api.rouletteSpin(playerId, costType === 'cash' ? 'cash' : costType === 'ogc' ? 'flowcoins' : 'fragments');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Spin failed');
      return;
    }

    setCashBalance(Number(spinResult.player.cleanMoney || 0));
    setFlowCoinsBalance(Number(spinResult.player.flowCoins || 0));
    setFragments(Number(spinResult.player.rouletteFragments || 0));

    const winnerCard = rewards.find((reward) => reward.name === spinResult.rewardName);
    const winner: RouletteReward = {
      name: spinResult.rewardName,
      subtitle: spinResult.rewardSubtitle || winnerCard?.subtitle || 'Reward received',
      tier: spinResult.tier,
      emoji: spinResult.emoji || winnerCard?.emoji || '🎁',
      payout: Number(spinResult.payout || 0),
    };

    const winnerRewardIndex = rewards.findIndex((reward) => reward.name === winner.name);
    const resolvedWinnerIndex = winnerRewardIndex >= 0 ? winnerRewardIndex : Math.max(0, rewards.findIndex((reward) => reward.tier === winner.tier));
    const currentRewardIndex = currentIndexRef.current % rewards.length;
    const deltaToWinner = (resolvedWinnerIndex - currentRewardIndex + rewards.length) % rewards.length;
    const extraLoops = MIN_EXTRA_LOOPS + Math.floor(Math.random() * (MAX_EXTRA_LOOPS - MIN_EXTRA_LOOPS + 1));
    const targetIndex = currentIndexRef.current + extraLoops * rewards.length + deltaToWinner;

    setActiveCost(costType);
    setSelectedReward(null);
    setShowWinModal(false);
    setHighlightIndex(null);
    setIsSpinning(true);
    setSpinCount((count) => count + 1);
    currentIndexRef.current = targetIndex;
    setTranslateX(getTranslateForIndex(targetIndex, viewportWidth));
    scheduleSpinSounds();

    scheduleTask(() => {
      setIsSpinning(false);
      setSelectedReward(winner);
      setHighlightIndex(targetIndex);
      setNearVehicleIndex(null);
      setLatestWins((current) => [winner, ...current].slice(0, 5));
      if ((spinCount + 1) % 5 === 0 && winner.name !== 'Vehicul Suvenir') {
        const neighbor = targetIndex + (Math.random() > 0.5 ? 1 : -1);
        if ((trackRewards[neighbor] || {}).name === 'Vehicul Suvenir') setNearVehicleIndex(neighbor);
      }
      playWinSound();
      refresh();
    }, SPIN_DURATION_MS + 40);

    scheduleTask(() => {
      const safeBase = rewards.length * 20;
      const normalizedIndex = safeBase + (targetIndex % rewards.length);
      currentIndexRef.current = normalizedIndex;
      setHighlightIndex(normalizedIndex);
      setNearVehicleIndex((current) => current === targetIndex - 1 ? normalizedIndex - 1 : current === targetIndex + 1 ? normalizedIndex + 1 : null);
      setTranslateX(getTranslateForIndex(normalizedIndex, viewportWidth));
    }, SPIN_DURATION_MS + 160);

    scheduleTask(() => setShowWinModal(true), SPIN_DURATION_MS + 220);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      event.preventDefault();
      if (!isSpinning && canAfford(activeCost)) void handleSpin(activeCost);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSpinning, activeCost, cashBalance, flowCoinsBalance, fragments, viewportWidth]);

  const activeOption = COST_OPTIONS.find((option) => option.id === activeCost) || COST_OPTIONS[0];

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 text-white sm:px-6 md:px-8 md:pb-12 md:pt-8">
      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7">
          <div className="pointer-events-none absolute left-1/2 top-[-220px] h-[440px] w-[700px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.07] blur-[100px]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="section-kicker">Roulette V2</p>
              <h1 className="display-title mt-4">Spin for a server-confirmed reward.</h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/42">The server selects and grants the reward first. The animation only reveals the result already saved to your account.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 lg:min-w-[430px]">
              <WalletStat label="Clean" value={`${formatNumber(cashBalance)} $`} />
              <WalletStat label="FlowCoins" value={formatNumber(flowCoinsBalance)} />
              <WalletStat label="Fragments" value={formatNumber(fragments)} />
            </div>
          </div>
        </section>

        {errorMessage ? <div className="rounded-2xl border border-red-400/25 bg-red-500/[0.07] px-4 py-3 text-sm font-bold text-red-100">{errorMessage}</div> : null}

        <section className="game-panel-soft overflow-hidden p-4 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="section-kicker">Prize track</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Choose a payment and spin</h2></div>
            <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/35">Space to spin</span>
          </div>

          <div className="relative mt-6">
            <div className="pointer-events-none absolute left-1/2 top-[-8px] z-30 h-0 w-0 -translate-x-1/2 border-l-[10px] border-r-[10px] border-t-[16px] border-l-transparent border-r-transparent border-t-[var(--accent)] drop-shadow-[0_0_12px_rgba(211,255,81,0.42)]" />
            <div ref={viewportRef} className="relative overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#080b08] px-3 py-5">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-[#080b08] to-transparent sm:w-28" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-[#080b08] to-transparent sm:w-28" />
              <div className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-px -translate-x-1/2 bg-[var(--accent)]/45 shadow-[0_0_24px_rgba(211,255,81,0.3)]" />
              <div className="flex min-w-max gap-[10px]" style={{ transform: `translateX(${translateX}px)`, transition: isSpinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.08,0.78,0.14,1)` : 'transform 360ms ease-out', willChange: 'transform' }}>
                {trackRewards.map((reward, index) => <RewardCard key={`${reward.name}-${index}`} reward={reward} compact className="w-[156px] shrink-0" highlighted={highlightIndex === index || nearVehicleIndex === index} spinning={isSpinning} />)}
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 md:grid-cols-3">
            {COST_OPTIONS.map((option) => {
              const selected = activeCost === option.id;
              const affordable = canAfford(option.id);
              return <button key={option.id} type="button" disabled={isSpinning} onClick={() => setActiveCost(option.id)} className={`rounded-[18px] border p-4 text-left transition ${selected ? 'border-[rgba(211,255,81,0.3)] bg-[rgba(211,255,81,0.07)]' : 'border-white/[0.07] bg-black/20 hover:border-white/[0.14]'} disabled:opacity-50`}><div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/30">{option.label}</p><p className="mt-2 text-lg font-black text-white">{option.price}</p></div><span className={`rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.1em] ${affordable ? 'border-emerald-300/20 bg-emerald-400/[0.06] text-emerald-100' : 'border-red-300/20 bg-red-400/[0.06] text-red-100'}`}>{affordable ? 'Ready' : 'Missing'}</span></div><p className="mt-3 text-xs font-bold text-white/38">{option.balanceLabel}: <span className="text-white/70">{balanceFor(option.id)}</span></p></button>;
            })}
          </div>

          <div className="mt-4 flex flex-col items-center justify-between gap-3 rounded-[20px] border border-white/[0.07] bg-black/20 p-4 sm:flex-row">
            <div><p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/28">Selected payment</p><p className="mt-1 text-base font-black text-white">{activeOption.price}</p></div>
            <button type="button" onClick={() => void handleSpin(activeCost)} disabled={!player || isSpinning || !canAfford(activeCost)} className="btn-primary w-full rounded-2xl px-8 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[220px]">{isSpinning ? 'Spinning...' : 'Spin roulette'}</button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
          <div className="game-panel-soft p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3"><div><p className="section-kicker">Recent</p><h2 className="mt-2 text-2xl font-black text-white">Latest wins</h2></div><span className="text-xs font-black text-white/35">{spinCount} spins</span></div>
            <div className="mt-5 space-y-2">{latestWins.map((reward, index) => <div key={`${reward.name}-recent-${index}`} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/20 p-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.035] text-xl">{reward.emoji}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{reward.name}</p><p className="mt-0.5 truncate text-[10px] text-white/35">{reward.subtitle}</p></div><span className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{rarityLabel[reward.tier]}</span></div>)}</div>
          </div>
          <div className="game-panel-soft p-5 sm:p-6"><p className="section-kicker">Reward pool</p><h2 className="mt-2 text-2xl font-black text-white">Available rewards</h2><div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">{rewards.map((reward) => <RewardCard key={reward.name} reward={reward} />)}</div></div>
        </section>
      </div>

      {showWinModal && selectedReward ? <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl"><div className="game-panel w-full max-w-md p-6"><p className="section-kicker text-center">Reward confirmed</p><div className={`mt-5 rounded-[24px] border p-5 ${tierStyles[selectedReward.tier]}`}><div className="flex h-28 items-center justify-center rounded-[20px] border border-white/[0.06] bg-black/20 text-7xl">{selectedReward.emoji}</div><p className="mt-5 text-[9px] font-black uppercase tracking-[0.16em] opacity-55">{rarityLabel[selectedReward.tier]}</p><h3 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{selectedReward.name}</h3><p className="mt-2 text-sm text-white/55">{selectedReward.subtitle}</p></div><p className="mt-4 text-center text-xs text-white/32">The reward was granted by the server before this reveal.</p><button type="button" onClick={() => setShowWinModal(false)} className="btn-primary mt-5 w-full rounded-2xl px-5 py-3.5 text-sm">Continue</button></div></div> : null}
    </div>
  );
}

function WalletStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-[16px] border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>;
}

function RewardCard({ reward, className = '', compact = false, highlighted = false, spinning = false }: { reward: RouletteReward; className?: string; compact?: boolean; highlighted?: boolean; spinning?: boolean }) {
  const hoverClasses = compact || spinning ? '' : 'hover:-translate-y-0.5 hover:border-white/[0.18]';
  return <div className={`relative flex min-h-[150px] flex-col overflow-hidden rounded-[18px] border p-3 transition ${tierStyles[reward.tier]} ${highlighted ? 'ring-2 ring-[var(--accent)]/55 shadow-[0_0_34px_rgba(211,255,81,0.14)]' : ''} ${hoverClasses} ${className}`}><div className={`flex items-center justify-center rounded-[14px] border border-white/[0.06] bg-black/20 ${compact ? 'h-[72px] text-4xl' : 'h-[82px] text-5xl'}`}>{reward.emoji}</div><div className="mt-3 flex-1"><p className="text-[8px] font-black uppercase tracking-[0.12em] opacity-45">{rarityLabel[reward.tier]}</p><h3 className="mt-1 text-sm font-black leading-tight text-white">{reward.name}</h3><p className="mt-1 text-[10px] leading-4 text-white/40">{reward.subtitle}</p></div></div>;
}
