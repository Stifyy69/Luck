import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import { publishCityProgress } from '../lib/cityProgressApi';
import type { CityProgress, CityProgressReward } from '../lib/cityProgress';
import type { FisherSpotOption, FisherStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const STATE_LABELS: Record<string, string> = {
  IDLE: 'Off duty',
  STARTING_SHIFT: 'Starting shift',
  SELECTING_DOCK: 'Move to marker',
  SELECTING_SPOT: 'Choosing waters',
};

const SPOT_ART: Record<string, string> = {
  COMMON: '/jobs/fisher/common-dock.svg',
  BETTER: '/jobs/fisher/better-waters.svg',
  PREMIUM: '/jobs/fisher/premium-deep-water.svg',
};

const ROD_SHOP = [
  { tier: 1, name: 'Street Rod', price: 10000, bonus: 'Balanced starter rod' },
  { tier: 2, name: 'Lake Rod', price: 50000, bonus: 'Higher chance for bigger fish' },
  { tier: 3, name: 'Pro River Rod', price: 150000, bonus: 'Better fish size and payout' },
  { tier: 4, name: 'Deep Master Rod', price: 300000, bonus: 'Strong bonus for premium catches' },
  { tier: 5, name: 'Legend Hunter Rod', price: 500000, bonus: 'Best chance for top catches and cash' },
];

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function tierBadge(tier: string) {
  if (tier === 'PREMIUM') return 'border-[rgba(240,196,106,0.3)] bg-[rgba(240,196,106,0.08)] text-[var(--warning)]';
  if (tier === 'BETTER') return 'border-[rgba(114,183,255,0.28)] bg-[rgba(114,183,255,0.07)] text-[var(--info)]';
  return 'border-[rgba(114,227,154,0.25)] bg-[rgba(114,227,154,0.07)] text-[var(--money)]';
}

export default function FisherPage() {
  const { playerId, player, refresh } = usePlayer();
  const [state, setState] = useState<FisherStateResponse | null>(null);
  const [options, setOptions] = useState<FisherSpotOption[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [busy, setBusy] = useState(false);
  const lastOptionsFetchRef = useRef(0);
  const popupTimerRef = useRef<number | null>(null);
  const spotsRef = useRef<HTMLElement | null>(null);

  const pushPopup = useCallback((text: string, isError = false) => {
    if (popupTimerRef.current) window.clearTimeout(popupTimerRef.current);
    setPopup({ text, isError });
    popupTimerRef.current = window.setTimeout(() => setPopup(null), 2200);
  }, []);

  const underRepair = Number(state?.repairSecondsLeft || 0) > 0;
  const canSelectSpot = state?.shiftState === 'SELECTING_SPOT';
  const canSelectDock = state?.shiftState === 'SELECTING_DOCK';

  const loadState = useCallback(async () => {
    try {
      const next = await api.fisherState(playerId);
      setState(next);
      if (next.shiftState === 'SELECTING_SPOT' && !underRepair && options.length === 0) {
        const now = Date.now();
        if (now - lastOptionsFetchRef.current > 700) {
          lastOptionsFetchRef.current = now;
          const data = await api.fisherSpotOptions(playerId);
          setOptions(data.options || []);
        }
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Failed to load fisher state', true);
    }
  }, [playerId, options.length, pushPopup, underRepair]);

  useEffect(() => {
    loadState().catch(() => {});
  }, [loadState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!state) return;
      if (state.shiftState !== 'IDLE') loadState().catch(() => {});
    }, 500);
    return () => window.clearInterval(timer);
  }, [state, loadState]);

  const displayName = useMemo(() => String(player?.displayName || player?.playerId || playerId), [player, playerId]);
  const readableState = STATE_LABELS[String(state?.shiftState || 'IDLE')] || String(state?.shiftState || 'Idle').replace(/_/g, ' ');
  const nextCarryCapacity = Math.min(100, Number(state?.carryCapacityKg ?? 20) + 5);
  const canUpgradeCarry = state?.shiftState === 'IDLE' && Number(state?.carryCapacityKg ?? 20) < 100;
  const carryPercent = clampPercent((Number(state?.carryWeightKg || 0) / Math.max(1, Number(state?.carryCapacityKg || 20))) * 100);

  const scrollToSpots = useCallback(() => {
    window.setTimeout(() => spotsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }, []);

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.fisherShiftStart(playerId);
      setState(next);
      await wait(550);
      const data = await api.fisherSpotOptions(playerId);
      setOptions(data.options || []);
      pushPopup('Fishing shift started. Pick your waters.');
      scrollToSpots();
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start fisher shift', true);
    } finally {
      setBusy(false);
    }
  };

  const chooseWaters = async () => {
    if (state?.shiftState === 'IDLE') {
      await startShift();
      return;
    }
    scrollToSpots();
  };

  const endShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.fisherShiftEnd(playerId);
      setState(next);
      setOptions([]);
      pushPopup('Fishing shift ended.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not end shift', true);
    } finally {
      setBusy(false);
    }
  };

  const refreshOptions = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await wait(520);
      const data = await api.fisherSpotOptions(playerId);
      setOptions(data.options || []);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not refresh spots', true);
    } finally {
      setBusy(false);
    }
  };

  const selectSpot = async (spotId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.fisherSpotSelect(playerId, spotId);
      setState(next);
      setOptions([]);
      pushPopup('Waters selected. Follow the highlighted dock marker.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Spot select failed', true);
    } finally {
      setBusy(false);
    }
  };

  const selectDock = async (cellId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const isTarget = Number(state?.targetDockCell || 0) === Number(cellId);
      if (isTarget) {
        pushPopup('Applying bait...');
        await wait(1200);
        pushPopup('Fish bite detected...');
        await wait(1200);
        pushPopup('Reeling and landing...');
        await wait(1200);
      }
      const next = await api.fisherDockSelect(playerId, cellId);
      if (next.cityProgress) publishCityProgress(next.cityProgress as CityProgress, next.cityReward as CityProgressReward | undefined);
      setState(next);
      if (next?.lastResult?.caught) {
        await wait(350);
        const fish = next.lastResult.fishName || 'Fish';
        const reward = Number(next.lastResult.breakdown?.totalReward || 0);
        pushPopup(`Caught ${fish}. Estimated sale value: ${fmt(reward)} $.`);
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Dock select failed', true);
    } finally {
      setBusy(false);
    }
  };

  const sellCatch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = await api.fisherCatchSell(playerId);
      setState(payload.state);
      refresh();
      pushPopup(`Sold fish for +${fmt(payload.soldValue)} $.`);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not sell fish', true);
    } finally {
      setBusy(false);
    }
  };

  const buyRod = async (tier: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = await api.fisherRodBuy(playerId, tier);
      setState(payload.state);
      refresh();
      pushPopup(`Bought ${payload.rodName} for ${fmt(payload.cost)} $.`);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Rod purchase failed', true);
    } finally {
      setBusy(false);
    }
  };

  const buyCarry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = await api.fisherCarryBuy(playerId);
      setState(payload.state);
      refresh();
      pushPopup(`Carry upgraded to ${payload.nextCapacity}kg for ${fmt(payload.cost)} $.`);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Carry upgrade failed', true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      {popup && (
        <div className={`animate-toast-in fixed left-1/2 top-4 z-[140] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl md:top-6 ${popup.isError ? 'border-red-400/25 bg-[#261113]/95 text-red-100' : 'border-[rgba(211,255,81,0.24)] bg-[#11170d]/95 text-[#edffc0]'}`}>
          {popup.text}
        </div>
      )}

      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12">
          <div className="pointer-events-none absolute left-1/2 top-[-190px] h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[var(--info)] opacity-[0.055] blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <p className="section-kicker">Fishing career</p>
            <h1 className="display-title mt-5">Choose your waters.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45">Pick a fishing tier, follow the dock marker and build a valuable carry before returning to sell.</p>
            <button type="button" onClick={() => chooseWaters().catch(() => {})} disabled={busy || underRepair || canSelectDock} className="btn-primary mt-7 min-w-[220px] rounded-2xl px-6 py-3.5 text-sm disabled:opacity-35">
              {state?.shiftState === 'IDLE' ? 'Start fishing shift' : 'View fishing waters'}
            </button>

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-5">
              <HeroStat label="Fisher" value={displayName} />
              <HeroStat label="Level" value={String(state?.progress.level ?? 1)} />
              <HeroStat label="Rod" value={state?.progress.rodTierLabel || 'Street Rod'} />
              <HeroStat label="Streak" value={String(state?.streak ?? 0)} />
              <HeroStat label="Carry value" value={`${fmt(state?.carryEstimatedValue ?? 0)} $`} money />
            </div>

            <div className="mx-auto mt-5 max-w-xl">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/38">Carry hold</span><span className="font-black text-white">{(state?.carryWeightKg ?? 0).toFixed(1)} / {(state?.carryCapacityKg ?? 20).toFixed(0)} kg</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${carryPercent}%` }} /></div>
            </div>
          </div>
        </section>

        {underRepair && (
          <section className="rounded-[20px] border border-[rgba(240,196,106,0.24)] bg-[rgba(240,196,106,0.065)] p-4">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--warning)]">Equipment unavailable</p><p className="mt-1 text-sm font-semibold text-white/68">{state?.repairLabel || 'Repairing line'}</p></div><p className="text-2xl font-black text-white">{state?.repairSecondsLeft}s</p></div>
          </section>
        )}

        {canSelectSpot && (
          <section ref={spotsRef} className="game-panel-soft scroll-mt-24 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div><p className="section-kicker">Fishing board</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Available waters</h2><p className="mt-2 text-sm text-white/38">Higher tiers improve payout and rarity, but require better equipment and level.</p></div>
              <div className="flex gap-2"><button type="button" onClick={() => refreshOptions().catch(() => {})} disabled={busy} className="btn-ghost rounded-2xl px-4 py-2.5 text-xs disabled:opacity-35">Refresh waters</button><button type="button" onClick={() => endShift().catch(() => {})} disabled={busy} className="btn-danger rounded-2xl px-4 py-2.5 text-xs disabled:opacity-35">End shift</button></div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {options.map((spot) => (
                <article key={spot.spotId} className={`overflow-hidden rounded-[22px] border p-4 ${spot.locked ? 'border-white/[0.07] bg-black/20' : 'border-[rgba(211,255,81,0.18)] bg-[rgba(211,255,81,0.035)]'}`}>
                  <div className="relative flex h-[190px] items-center justify-center rounded-[18px] border border-white/[0.08] bg-[#090c09] p-3">
                    <img src={SPOT_ART[spot.tier]} alt={spot.name} className={`h-full w-full object-contain ${spot.locked ? 'grayscale opacity-35' : ''}`} />
                    <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${tierBadge(spot.tier)}`}>{spot.tier}</span>
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/26">Fishing spot</p><h3 className="mt-1 text-xl font-black text-white">{spot.name}</h3></div><p className="text-right text-sm font-black text-[var(--money)]">~{fmt(spot.estimatedReward)} $<span className="block text-xs text-[var(--accent)]">+{spot.estimatedXp} XP</span></p></div>
                  <p className="mt-3 min-h-[36px] text-xs leading-relaxed text-white/42">Fish pool: {spot.fishPool.join(', ')}</p>
                  <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/[0.065] py-4"><SpotStat label="Cast" value={spot.castDifficulty} /><SpotStat label="Reel" value={spot.reelDifficulty} /><SpotStat label="Risk" value={spot.failRisk} /></div>
                  <p className="mt-3 text-xs text-white/38">Bite ~{spot.waitBiteEstimateSec}s · Travel {spot.travelSec}s</p>
                  {spot.locked && <p className="mt-2 text-xs font-black text-[var(--warning)]">Unlock at level {spot.unlockLevel}</p>}
                  <button type="button" onClick={() => selectSpot(spot.spotId).catch(() => {})} disabled={busy || underRepair || !!spot.locked} className="btn-secondary mt-5 w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-35">{spot.locked ? `Locked until level ${spot.unlockLevel}` : 'Fish this spot'}</button>
                </article>
              ))}
            </div>
          </section>
        )}

        {canSelectDock && (
          <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">Active waters</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">{state?.activeSpotName || state?.activeCatch?.spotName || 'Fishing route'}</h2>
              <p className="mt-2 text-sm text-white/38">Find the highlighted dock square to start the automatic bait, bite and reel sequence.</p>
              <div className="mt-5 flex h-[210px] items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#090c09] p-3"><img src={SPOT_ART[state?.activeCatch?.spotTier || 'COMMON']} alt="Fishing waters" className="h-full w-full object-contain" /></div>
              <div className="mt-5 grid grid-cols-2 gap-3"><MissionStat label="State" value={readableState} /><MissionStat label="Carry" value={`${(state?.carryWeightKg ?? 0).toFixed(1)} kg`} /><MissionStat label="Sell value" value={`${fmt(state?.carryEstimatedValue ?? 0)} $`} good /><MissionStat label="Streak" value={String(state?.streak ?? 0)} /></div>
            </div>

            <div className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">Dock map</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Go to the marked square</h3>
              <p className="mt-2 text-sm text-white/38">The green square is the current fishing position.</p>
              <div className="mt-5 grid grid-cols-4 gap-2">
                {Array.from({ length: 16 }).map((_, index) => {
                  const cell = index + 1;
                  const selected = state?.currentDockCell === cell;
                  const target = state?.targetDockCell === cell;
                  return (
                    <button key={`dock-${cell}`} type="button" onClick={() => selectDock(cell).catch(() => {})} disabled={busy} className={`h-16 rounded-[15px] border text-sm font-black transition ${target ? 'border-[rgba(211,255,81,0.5)] bg-[var(--accent)] text-[#10140b] shadow-[0_0_28px_rgba(211,255,81,0.16)]' : selected ? 'border-[rgba(114,183,255,0.35)] bg-[rgba(114,183,255,0.1)] text-[var(--info)]' : 'border-white/[0.07] bg-black/20 text-white/35 hover:border-white/[0.16]'} disabled:opacity-50`}>{target ? 'GO' : cell}</button>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {state?.shiftState === 'IDLE' && (
          <section className="game-panel-soft p-5 sm:p-6">
            <div><p className="section-kicker">Equipment progression</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Rod shop and carry upgrades</h2><p className="mt-2 text-sm text-white/38">Upgrade equipment before starting a shift to reach better waters and improve catch value.</p></div>

            <div className="mt-6 rounded-[20px] border border-[rgba(114,227,154,0.2)] bg-[rgba(114,227,154,0.05)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--money)]">Carry upgrade</p><p className="mt-1 text-xl font-black text-white">{(state?.carryCapacityKg ?? 20).toFixed(0)} kg capacity</p><p className="mt-1 text-xs text-white/42">+5 kg for 50,000 $ · maximum 100 kg</p></div><button type="button" onClick={() => buyCarry().catch(() => {})} disabled={busy || !canUpgradeCarry} className="btn-secondary rounded-2xl px-4 py-3 text-sm disabled:opacity-35">{canUpgradeCarry ? `Upgrade to ${nextCarryCapacity} kg` : 'Carry maxed'}</button></div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {ROD_SHOP.map((rod) => {
                const currentTier = Number(state?.progress.rodTier || 1);
                const isCurrentTier = currentTier === rod.tier;
                const isLowerIncluded = currentTier > rod.tier;
                const disabled = busy || isCurrentTier || isLowerIncluded;
                return (
                  <article key={`rod-shop-${rod.tier}`} className={`rounded-[22px] border p-4 ${isCurrentTier ? 'border-[rgba(211,255,81,0.28)] bg-[rgba(211,255,81,0.055)]' : 'border-white/[0.08] bg-black/20'}`}>
                    <div className="flex h-[120px] items-center justify-center rounded-[18px] border border-white/[0.08] bg-[#090c09]"><div className="relative h-[92px] w-[150px]"><span className="absolute left-5 top-7 h-[8px] w-[118px] -rotate-[22deg] rounded-full bg-gradient-to-r from-[#e6ece7] via-[#7f8c84] to-[#202722]" /><span className="absolute right-2 top-1 h-[55px] w-[4px] rotate-[18deg] rounded-full bg-[var(--accent)]" /><span className="absolute left-[54px] top-[48px] h-8 w-8 rounded-full border-[5px] border-[#59645d] bg-[#171d19]" /></div></div>
                    <div className="mt-4 flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/26">Tier {rod.tier}</p><h3 className="mt-1 text-lg font-black text-white">{rod.name}</h3></div><p className="text-sm font-black text-[var(--money)]">{fmt(rod.price)} $</p></div>
                    <p className="mt-2 min-h-[36px] text-xs leading-relaxed text-white/42">{rod.bonus}</p>
                    <button type="button" onClick={() => buyRod(rod.tier).catch(() => {})} disabled={disabled} className="btn-secondary mt-4 w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-35">{isCurrentTier ? 'Equipped' : isLowerIncluded ? 'Owned' : 'Buy rod'}</button>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {(state?.carryEstimatedValue ?? 0) > 0 && (
          <section className="game-panel-soft flex flex-wrap items-center justify-between gap-4 p-5"><div><p className="section-kicker">Catch hold</p><p className="mt-1 text-2xl font-black text-white">Estimated value {fmt(state?.carryEstimatedValue ?? 0)} $</p></div><button type="button" onClick={() => sellCatch().catch(() => {})} disabled={busy} className="btn-primary rounded-2xl px-5 py-3 text-sm disabled:opacity-35">Sell full catch</button></section>
        )}

        {state?.lastResult && (
          <section className="game-panel overflow-hidden">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-white/[0.07] bg-black/20 p-6 sm:p-7 lg:border-b-0 lg:border-r"><p className="section-kicker">Catch report</p><p className={`mt-4 text-sm font-black uppercase tracking-[0.14em] ${state.lastResult.caught ? 'text-[var(--money)]' : 'text-[var(--danger)]'}`}>{state.lastResult.caught ? `${state.lastResult.fishName} · ${state.lastResult.fishRarity}` : state.lastResult.failReason}</p><p className="mt-4 text-5xl font-black tracking-[-0.055em] text-[var(--money)]">+{fmt(state.lastResult.breakdown.totalReward)} $</p><p className="mt-2 text-lg font-black text-[var(--accent)]">+{state.lastResult.breakdown.xpGained} XP</p>{state.lastResult.fishWeightKg && <p className="mt-4 text-sm font-black text-white">{state.lastResult.fishSize} · {state.lastResult.fishWeightKg} kg</p>}</div>
              <div className="p-6 sm:p-7"><p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Catch factors</p><h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Why this catch paid</h3><div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3"><Summary label="Base reward" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} /><Summary label="Spot factor" value={`${state.lastResult.breakdown.spotMultiplier.toFixed(2)}x`} /><Summary label="Level factor" value={`${state.lastResult.breakdown.levelMultiplier.toFixed(2)}x`} /><Summary label="Quality factor" value={`${state.lastResult.breakdown.qualityMultiplier.toFixed(2)}x`} /><Summary label="Streak factor" value={`${state.lastResult.breakdown.streakMultiplier.toFixed(2)}x`} /><Summary label="Integrity" value={`${state.lastResult.breakdown.integrityMultiplier.toFixed(2)}x`} /></div></div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function HeroStat({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p><p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}

function SpotStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 text-center"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/24">{label}</p><p className="mt-1 truncate text-xs font-black text-white">{value}</p></div>;
}

function MissionStat({ label, value, good = false }: { label: string; value: string; good?: boolean }) {
  return <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-3"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p><p className={`mt-1 text-base font-black ${good ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-4"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-1 text-base font-black text-white">{value}</p></div>;
}
