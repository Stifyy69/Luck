'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const rewards = [
  { name: 'Vehicul Suvenir', subtitle: 'Editie limitata', tier: 'legendary', emoji: '🚗' },
  { name: 'VIP Gold', subtitle: '6-12 zile', tier: 'epic', emoji: '💎' },
  { name: 'VIP Silver', subtitle: '6-12 zile', tier: 'epic', emoji: '💠' },
  { name: 'Mystery Box', subtitle: 'Obiecte unice', tier: 'epic', emoji: '📦' },
  { name: 'Fragmente ruleta', subtitle: 'x5 fragmente', tier: 'rare', emoji: '🪙' },
  { name: 'OGCoins', subtitle: '10 OGC', tier: 'rare', emoji: '🟠' },
  { name: 'Slot Vehicle', subtitle: '1 slot', tier: 'rare', emoji: '➕' },
  { name: 'Voucher Showroom', subtitle: '1 voucher', tier: 'rare', emoji: '🎟️' },
  { name: 'Job Boost', subtitle: '12 de ore', tier: 'uncommon', emoji: '📈' },
  { name: 'Scutire Taxe', subtitle: '24 de ore', tier: 'uncommon', emoji: '💸' },
  { name: 'Xenon Vehicul', subtitle: '1 pachet xenon', tier: 'common', emoji: '🔩' },
  { name: 'Bani', subtitle: 'suma de bani', tier: 'common', emoji: '💵' },
];

const rarityLabel = {
  legendary: 'Galben',
  epic: 'Rosu',
  rare: 'Mov inchis',
  uncommon: 'Mov deschis',
  common: 'Albastru',
};

const tierWeight = {
  legendary: 2,
  epic: 8,
  rare: 18,
  uncommon: 30,
  common: 42,
};

const tierStyles = {
  legendary:
    'border-yellow-400/80 bg-gradient-to-br from-yellow-500/28 via-yellow-300/10 to-lime-400/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_0_26px_rgba(250,204,21,0.14)]',
  epic:
    'border-red-400/80 bg-gradient-to-br from-red-500/28 via-rose-400/10 to-red-700/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(248,113,113,0.13)]',
  rare:
    'border-fuchsia-500/80 bg-gradient-to-br from-fuchsia-500/25 via-purple-500/10 to-violet-700/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_24px_rgba(217,70,239,0.13)]',
  uncommon:
    'border-violet-400/80 bg-gradient-to-br from-violet-500/20 via-indigo-400/10 to-sky-400/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_22px_rgba(139,92,246,0.12)]',
  common:
    'border-sky-400/80 bg-gradient-to-br from-sky-500/24 via-blue-400/10 to-cyan-600/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_22px_rgba(56,189,248,0.12)]',
};

const CARD_WIDTH = 156;
const CARD_GAP = 10;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const TRACK_REPEATS = 56;
const START_INDEX = rewards.length * 4;
const SPIN_DURATION_MS = 4600;
const MIN_EXTRA_LOOPS = 6;
const MAX_EXTRA_LOOPS = 8;

function pickWeightedReward() {
  const totalWeight = rewards.reduce((sum, reward) => sum + (tierWeight[reward.tier] ?? 1), 0);
  let roll = Math.random() * totalWeight;

  for (const reward of rewards) {
    roll -= tierWeight[reward.tier] ?? 1;
    if (roll <= 0) return reward;
  }

  return rewards[rewards.length - 1];
}

function getTranslateForIndex(index, viewportWidth) {
  return -(index * CARD_STEP) + viewportWidth / 2 - CARD_WIDTH / 2;
}

export default function RouletteDemo() {
  const viewportRef = useRef(null);
  const audioContextRef = useRef(null);
  const currentIndexRef = useRef(START_INDEX);
  const timersRef = useRef([]);

  const [viewportWidth, setViewportWidth] = useState(920);
  const [translateX, setTranslateX] = useState(getTranslateForIndex(START_INDEX, 920));
  const [isSpinning, setIsSpinning] = useState(false);
  const [activeCost, setActiveCost] = useState('cash');
  const [selectedReward, setSelectedReward] = useState(null);
  const [showWinModal, setShowWinModal] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(START_INDEX);
  const [latestWins, setLatestWins] = useState([rewards[0], rewards[1], rewards[4], rewards[11]]);

  const trackRewards = useMemo(
    () => Array.from({ length: TRACK_REPEATS }, () => rewards).flat(),
    [],
  );

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

  const scheduleTask = (callback, delay) => {
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
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }

    return audioContextRef.current;
  };

  const playTone = ({
    frequency = 440,
    sweepTo,
    duration = 0.08,
    volume = 0.02,
    type = 'triangle',
  }) => {
    const context = getAudioContext();
    if (!context) return;

    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (typeof sweepTo === 'number') {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), now + duration);
    }

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
    scheduleTask(() => {
      playTone({ frequency: 260, sweepTo: 140, duration: 0.11, volume: 0.014, type: 'triangle' });
    }, 70);
  };

  const playTickSound = (strength = 1) => {
    const randomShift = Math.random() * 90;
    playTone({
      frequency: 820 + randomShift,
      sweepTo: 580 + randomShift * 0.4,
      duration: 0.045,
      volume: 0.012 + strength * 0.006,
      type: 'square',
    });
  };

  const playWinSound = () => {
    playTone({ frequency: 520, duration: 0.08, volume: 0.024, type: 'triangle' });
    scheduleTask(() => playTone({ frequency: 660, duration: 0.1, volume: 0.024, type: 'triangle' }), 90);
    scheduleTask(() => playTone({ frequency: 860, duration: 0.16, volume: 0.02, type: 'sine' }), 190);
  };

  const scheduleSpinSounds = () => {
    playStartSound();

    const tickCount = 28;
    for (let i = 1; i <= tickCount; i += 1) {
      const progress = i / tickCount;
      const easedTime = SPIN_DURATION_MS * (1 - Math.pow(1 - progress, 2.18));
      scheduleTask(() => playTickSound(1 - progress * 0.35), easedTime);
    }
  };

  const handleSpin = async (costType) => {
    if (isSpinning || !viewportWidth) return;

    clearScheduledTasks();

    const context = getAudioContext();
    if (context?.state === 'suspended') {
      await context.resume();
    }

    const winner = pickWeightedReward();
    const winnerRewardIndex = rewards.findIndex((reward) => reward.name === winner.name);
    const currentRewardIndex = currentIndexRef.current % rewards.length;
    const deltaToWinner = (winnerRewardIndex - currentRewardIndex + rewards.length) % rewards.length;
    const extraLoops = MIN_EXTRA_LOOPS + Math.floor(Math.random() * (MAX_EXTRA_LOOPS - MIN_EXTRA_LOOPS + 1));
    const targetIndex = currentIndexRef.current + extraLoops * rewards.length + deltaToWinner;

    setActiveCost(costType);
    setSelectedReward(null);
    setShowWinModal(false);
    setHighlightIndex(null);
    setIsSpinning(true);

    currentIndexRef.current = targetIndex;
    setTranslateX(getTranslateForIndex(targetIndex, viewportWidth));
    scheduleSpinSounds();

    scheduleTask(() => {
      setIsSpinning(false);
      setSelectedReward(winner);
      setHighlightIndex(targetIndex);
      setLatestWins((current) => [winner, ...current].slice(0, 4));
      playWinSound();
    }, SPIN_DURATION_MS + 40);

    scheduleTask(() => {
      setShowWinModal(true);
    }, SPIN_DURATION_MS + 220);
  };

  const closeWinModal = () => {
    setShowWinModal(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#130f2d] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,74,255,0.23),transparent_35%),radial-gradient(circle_at_bottom,rgba(255,72,72,0.12),transparent_23%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,24,0.2),rgba(7,6,20,0.76))]" />

      <div className="relative mx-auto grid min-h-screen w-full max-w-[1340px] grid-cols-1 gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[170px_minmax(0,1fr)] lg:gap-6 lg:px-7">
        <aside className="hidden lg:flex lg:flex-col lg:pt-7">
          <p className="pl-1 text-left text-[24px] font-black uppercase italic leading-[0.9] tracking-tight text-white/90">
            Ultimele
            <br />
            castiguri
          </p>
          <div className="mt-4 space-y-2 opacity-45">
            {rewards.slice(10, 12).concat(rewards.slice(4, 7)).map((reward, index) => (
              <RewardCard
                key={`${reward.name}-side-${index}`}
                reward={reward}
                styles={tierStyles}
                compact
                className="min-h-[152px] border-white/10 brightness-90"
              />
            ))}
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="mb-2 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.36em] text-white/45 sm:text-xs">OGRomania</p>
            <h1 className="bg-gradient-to-r from-white via-red-300 to-red-500 bg-clip-text text-3xl font-black uppercase tracking-tight text-transparent sm:text-4xl">
              Roulette
            </h1>
          </header>

          <div className="mx-auto w-full max-w-[1120px] rounded-[20px] border border-white/10 bg-[#17143a]/72 px-2.5 py-2.5 shadow-[0_30px_100px_rgba(0,0,0,0.44)] backdrop-blur-xl sm:px-3 sm:py-3">
          <section className="rounded-[20px] border border-white/8 bg-[#13112c]/86 p-3 sm:p-4">
            <div className="mb-3 flex justify-center">
              <div className="flex flex-col items-center gap-1.5">
                <div className="h-0 w-0 border-l-[8px] border-r-[8px] border-t-[12px] border-l-transparent border-r-transparent border-t-white drop-shadow-[0_0_10px_rgba(255,255,255,0.55)] sm:border-l-[9px] sm:border-r-[9px] sm:border-t-[14px]" />
                <div className="h-6 w-[2px] rounded-full bg-white/45" />
              </div>
            </div>

            <div ref={viewportRef} className="relative overflow-hidden rounded-[14px] border border-white/5 bg-black/20 px-2 py-3 sm:px-3 sm:py-3.5">
              <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-gradient-to-r from-[#13112c] via-[#13112c]/75 to-transparent sm:w-16" />
              <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-gradient-to-l from-[#13112c] via-[#13112c]/75 to-transparent sm:w-16" />
              <div className="pointer-events-none absolute inset-y-3 left-1/2 z-10 w-[2px] -translate-x-1/2 rounded-full bg-white/35 shadow-[0_0_18px_rgba(255,255,255,0.28)]" />

              <div
                className="flex min-w-max gap-[10px]"
                style={{
                  transform: `translateX(${translateX}px)`,
                  transition: isSpinning
                    ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.08, 0.78, 0.14, 1)`
                    : 'transform 360ms ease-out',
                  willChange: 'transform',
                }}
              >
                {trackRewards.map((reward, index) => (
                  <RewardCard
                    key={`${reward.name}-${index}`}
                    reward={reward}
                    compact
                    styles={tierStyles}
                    className="w-[156px] shrink-0"
                    highlighted={highlightIndex === index}
                    spinning={isSpinning}
                  />
                ))}
              </div>
            </div>
          </section>

          <div className="mt-3 flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-2.5">
            <button
              type="button"
              onClick={() => handleSpin('cash')}
              disabled={isSpinning}
              className="w-full rounded-[10px] border border-red-300/30 bg-gradient-to-r from-red-600 to-orange-500 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-white shadow-[0_7px_24px_rgba(239,68,68,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[176px]"
            >
              {isSpinning && activeCost === 'cash' ? 'Se deschide...' : 'Deschide cu 100,000$'}
            </button>
            <button
              type="button"
              onClick={() => handleSpin('ogc')}
              disabled={isSpinning}
              className="w-full rounded-[10px] border border-orange-300/30 bg-gradient-to-r from-orange-500 to-amber-400 px-6 py-2.5 text-xs font-bold uppercase tracking-[0.04em] text-white shadow-[0_7px_24px_rgba(251,146,60,0.3)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-[176px]"
            >
              {isSpinning && activeCost === 'ogc' ? 'Se deschide...' : 'Deschide cu 30 OGC'}
            </button>
          </div>

          <div className="mt-3 rounded-[12px] border border-white/8 bg-black/20 px-4 py-2.5 text-center">
            {isSpinning ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">In derulare</p>
                <p className="mt-1.5 text-sm text-white/70">
                  Ruleta ruleaza sub pointer si incetineste progresiv pana pe reward-ul castigator.
                </p>
              </>
            ) : selectedReward ? (
              <>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">Ultimul castig</p>
                <div className="mt-2 flex items-center justify-center gap-3">
                  <span className="text-2xl">{selectedReward.emoji}</span>
                  <div>
                    <p className="text-base font-extrabold text-white">{selectedReward.name}</p>
                    <p className="text-sm text-white/60">{rarityLabel[selectedReward.tier]} · {selectedReward.subtitle}</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-[10px] uppercase tracking-[0.28em] text-white/45 sm:text-[11px]">Demo web</p>
                <p className="mt-1.5 text-sm text-white/70">
                  Layout-ul este optimizat pentru o vedere mai clară a ruletei și a premiilor dintr-o singură privire.
                </p>
              </>
            )}
          </div>

          </div>

          <section className="mx-auto mt-5 w-full max-w-[1120px]">
            <div className="mb-2.5 flex items-end justify-between gap-4">
              <h2 className="text-center text-2xl font-black uppercase italic tracking-tight text-white sm:w-full sm:text-[35px]">
                Poti castiga premiile
              </h2>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
              {latestWins.map((reward, index) => (
                <RewardCard
                  key={`${reward.name}-${index}`}
                  reward={reward}
                  styles={tierStyles}
                  compact
                  className="min-h-[152px]"
                />
              ))}
              {rewards.slice(6, 8).map((reward, index) => (
                <RewardCard
                  key={`${reward.name}-bonus-${index}`}
                  reward={reward}
                  styles={tierStyles}
                  compact
                  className="min-h-[152px]"
                />
              ))}
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2.5 pb-8 sm:grid-cols-3 sm:gap-3 lg:grid-cols-6">
              {rewards.map((reward) => (
                <RewardCard key={reward.name} reward={reward} styles={tierStyles} />
              ))}
            </div>
          </section>
        </div>
      </div>

      {showWinModal && selectedReward ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070510]/72 p-4 backdrop-blur-[6px]">
          <div className="w-full max-w-md rounded-[32px] border border-white/10 bg-[#17142f]/96 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.5)]">
            <div className="mx-auto h-1 w-20 rounded-full bg-white/10" />
            <p className="mt-5 text-center text-xs font-semibold uppercase tracking-[0.42em] text-white/45">
              Ai castigat
            </p>

            <div className={`mt-5 rounded-[28px] border p-5 ${tierStyles[selectedReward.tier]}`}>
              <div className="mb-5 flex h-28 items-center justify-center rounded-[22px] bg-black/10 text-7xl backdrop-blur-sm">
                {selectedReward.emoji}
              </div>
              <p className="text-xs uppercase tracking-[0.32em] text-white/45">{rarityLabel[selectedReward.tier]}</p>
              <h3 className="mt-2 text-3xl font-black leading-tight text-white">{selectedReward.name}</h3>
              <p className="mt-2 text-base text-white/65">{selectedReward.subtitle}</p>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={closeWinModal}
                className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
              >
                Inchide
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowWinModal(false);
                  handleSpin(activeCost);
                }}
                disabled={isSpinning}
                className="flex-1 rounded-2xl border border-red-400/25 bg-gradient-to-r from-red-600 to-orange-500 px-5 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:scale-[1.01] disabled:opacity-60"
              >
                Mai incearca
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RewardCard({ reward, styles, className = '', compact = false, highlighted = false, spinning = false }) {
  const hoverClasses = compact || spinning ? '' : 'hover:-translate-y-0.5 hover:brightness-105';
  const highlightClasses = highlighted
    ? 'ring-2 ring-white/55 shadow-[0_0_38px_rgba(255,255,255,0.18)]'
    : '';

  return (
    <div
      className={`group relative overflow-hidden rounded-[10px] border p-2.5 transition duration-300 ${hoverClasses} ${styles[reward.tier]} ${highlightClasses} ${className}`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_45%)] opacity-50" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.08),transparent_40%)]" />

      <div
        className={`relative mb-2.5 flex items-center justify-center rounded-[9px] bg-black/15 backdrop-blur-sm ${compact ? 'h-[66px] text-4xl sm:h-[70px] sm:text-[2.45rem]' : 'h-[88px] text-5xl'}`}
      >
        <span className="drop-shadow-[0_0_14px_rgba(255,255,255,0.16)]">{reward.emoji}</span>
      </div>

      <div className="relative space-y-0.5">
        <p className="text-[10px] leading-tight text-white/50 sm:text-[11px]">{reward.subtitle}</p>
        <h3 className={`${compact ? 'text-[15px] sm:text-base' : 'text-base sm:text-lg'} font-extrabold leading-tight text-white`}>
          {reward.name}
        </h3>
      </div>
    </div>
  );
}
