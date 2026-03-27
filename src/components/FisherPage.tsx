import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { FisherSpotOption, FisherStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const STATE_LABELS: Record<string, string> = {
  IDLE: 'Idle',
  STARTING_SHIFT: 'Starting Shift',
  SELECTING_DOCK: 'Go To Spot Marker',
  SELECTING_SPOT: 'Selecting Spot',
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

function tierBadge(tier: string) {
  if (tier === 'PREMIUM') return 'border-yellow-400/40 bg-yellow-500/15 text-yellow-200';
  if (tier === 'BETTER') return 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200';
  return 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200';
}

export default function FisherPage() {
  const { playerId, player, refresh } = usePlayer();
  const [state, setState] = useState<FisherStateResponse | null>(null);
  const [options, setOptions] = useState<FisherSpotOption[]>([]);
  const [popup, setPopup] = useState<Popup>(null);
  const [busy, setBusy] = useState(false);
  const [autoFlowText, setAutoFlowText] = useState<string | null>(null);
  const lastOptionsFetchRef = useRef(0);

  const pushPopup = useCallback((text: string, isError = false) => {
    setPopup({ text, isError });
    window.setTimeout(() => setPopup(null), 2800);
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
      if (state.shiftState !== 'IDLE') {
        loadState().catch(() => {});
      }
    }, 500);
    return () => window.clearInterval(timer);
  }, [state, loadState]);

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.fisherShiftStart(playerId);
      setState(next);
      await wait(550);
      const data = await api.fisherSpotOptions(playerId);
      setOptions(data.options || []);
      pushPopup('Fishing shift started. Pick a spot.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start fisher shift', true);
    } finally {
      setBusy(false);
    }
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
      pushPopup('Spot selected. Follow the GO square.');
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
        setAutoFlowText('Applying bait...');
        pushPopup('Applying bait...');
        await wait(500);
        setAutoFlowText('Fish bite detected...');
        pushPopup('Fish bite detected...');
        await wait(500);
        setAutoFlowText('Auto reeling and landing...');
        pushPopup('Auto reeling and landing...');
        await wait(600);
      }
      const next = await api.fisherDockSelect(playerId, cellId);
      setState(next);
      pushPopup(`Catch complete at marker ${cellId}. Continue on same spot or sell.`);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Dock select failed', true);
    } finally {
      setAutoFlowText(null);
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

  const displayName = useMemo(() => String(player?.displayName || player?.playerId || playerId), [player, playerId]);
  const readableState = STATE_LABELS[String(state?.shiftState || 'IDLE')] || String(state?.shiftState || 'Idle').replace(/_/g, ' ');
  const nextCarryCapacity = Math.min(100, Number(state?.carryCapacityKg ?? 20) + 5);
  const canUpgradeCarry = state?.shiftState === 'IDLE' && Number(state?.carryCapacityKg ?? 20) < 100;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(33,179,210,0.18),_transparent_55%),linear-gradient(180deg,rgba(6,14,23,0.94),rgba(2,8,14,0.98))] px-4 py-6 md:py-8">
      {popup && (
        <div className={`fixed right-4 top-6 z-[80] max-w-md rounded-xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur ${popup.isError ? 'border-red-500/40 bg-red-900/80 text-red-200' : 'border-cyan-500/40 bg-cyan-900/80 text-cyan-100'}`}>
          {popup.text}
        </div>
      )}

      {autoFlowText && (
        <div className="fixed left-1/2 top-20 z-[75] -translate-x-1/2 rounded-xl border border-emerald-400/45 bg-emerald-950/85 px-5 py-3 text-sm font-black uppercase tracking-[0.12em] text-emerald-100 shadow-2xl">
          {autoFlowText}
        </div>
      )}

      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Work</p>
          <h1 className="text-3xl font-black text-white">Fisher</h1>
          <p className="mt-1 text-sm text-white/60">{displayName} · Fisher Lv. {state?.progress.level ?? 1}</p>

          {underRepair && (
            <p className="mt-2 rounded-lg border border-orange-400/50 bg-orange-900/25 px-3 py-2 text-xs font-black uppercase tracking-wide text-orange-200">
              {state?.repairLabel || 'Repairing line'} · {state?.repairSecondsLeft}s
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Stat label="Level" value={String(state?.progress.level ?? 1)} />
            <Stat label="XP" value={state?.progress ? `${fmt(state.progress.xp)} / ${state.progress.nextLevelXp ? fmt(state.progress.nextLevelXp) : 'MAX'}` : '0'} />
            <Stat label="Rod" value={state?.progress.rodTierLabel || 'Basic Rod'} />
            <Stat label="Spot Tier" value={state?.progress.unlockedSpotTier || 'COMMON'} />
            <Stat label="Streak" value={String(state?.streak ?? 0)} />
            <Stat label="Carry" value={`${(state?.carryWeightKg ?? 0).toFixed(1)} / ${(state?.carryCapacityKg ?? 20).toFixed(0)} kg`} />
          </div>

          <div className="mt-3 rounded-xl border border-cyan-500/25 bg-cyan-900/10 p-3">
            <p className="text-xs uppercase tracking-[0.16em] text-cyan-200/85">Carry Hold</p>
            <p className="mt-1 text-sm font-bold text-cyan-100">Estimated sell value: {fmt(state?.carryEstimatedValue ?? 0)} $</p>
            <p className="text-xs text-cyan-100/70">Carry capacity: {(state?.carryCapacityKg ?? 20).toFixed(0)}kg (max 100kg).</p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startShift}
              disabled={busy || underRepair || state?.shiftState !== 'IDLE'}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              Start Shift
            </button>
            <button
              type="button"
              onClick={endShift}
              disabled={busy || state?.shiftState === 'IDLE'}
              className="rounded-xl border border-red-500/35 bg-red-900/20 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-50"
            >
              End Shift
            </button>
            {canSelectSpot && (
              <button
                type="button"
                onClick={() => refreshOptions().catch(() => {})}
                disabled={busy || underRepair}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/75 disabled:opacity-50"
              >
                Refresh Spots
              </button>
            )}
            <button
              type="button"
              onClick={() => sellCatch().catch(() => {})}
              disabled={busy || (state?.carryEstimatedValue ?? 0) <= 0}
              className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 px-4 py-2 text-sm font-bold text-emerald-100 disabled:opacity-50"
            >
              Sell Catch
            </button>
          </div>
        </div>

        {canSelectDock && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Go To The Spot (4x4)</h2>
            <p className="mt-1 text-sm text-white/70">{state?.dockPrompt || 'Click the green square to auto fish this spot.'}</p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {Array.from({ length: 16 }).map((_, idx) => {
                const cell = idx + 1;
                const selected = state?.currentDockCell === cell;
                const target = state?.targetDockCell === cell;
                return (
                  <button
                    key={`dock-${cell}`}
                    type="button"
                    onClick={() => selectDock(cell).catch(() => {})}
                    disabled={busy}
                    className={`h-14 rounded-lg border text-sm font-black transition ${target ? 'border-emerald-300 bg-emerald-500/35 text-emerald-100 shadow-[0_0_0_1px_rgba(16,185,129,0.45)]' : selected ? 'border-cyan-300 bg-cyan-500/25 text-cyan-100' : 'border-slate-700 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:bg-slate-800/75'} disabled:opacity-60`}
                  >
                    {target ? 'GO' : cell}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {canSelectSpot && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Fishing Spot Options</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {options.map((spot) => (
                <button
                  key={spot.spotId}
                  type="button"
                  onClick={() => selectSpot(spot.spotId)}
                  disabled={busy || underRepair || !!spot.locked}
                  className="rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-black ${tierBadge(spot.tier)}`}>
                    {spot.tier}
                  </span>
                  <p className="mt-2 text-sm font-black text-white">{spot.name}</p>
                  <p className="text-xs text-white/70">Difficulty: {spot.difficulty}</p>
                  <p className="text-xs text-white/70">Fish Pool: {spot.fishPool.join(', ')}</p>
                  <p className="text-xs text-white/70">Cast: {spot.castDifficulty} · Reel: {spot.reelDifficulty}</p>
                  <p className="text-xs text-white/70">Bite: ~{spot.waitBiteEstimateSec}s · Travel: {spot.travelSec}s</p>
                  <p className="text-xs text-white/70">Risk: {spot.failRisk}</p>
                  <p className="text-xs text-white/70">Size drop: Normal 75% · Big 20% · Giant 5%</p>
                  <p className="text-xs text-white/70">Approx payout: ~{fmt(spot.estimatedReward)} $ / catch</p>
                  {spot.locked ? (
                    <p className="mt-2 text-xs font-black text-orange-300">Locked until Lv. {spot.unlockLevel}</p>
                  ) : (
                    <>
                      <p className="mt-2 font-black text-[#ffd95a]">~{fmt(spot.estimatedReward)} $</p>
                      <p className="text-sm font-bold text-[#45d483]">~{spot.estimatedXp} XP</p>
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {state?.shiftState !== 'IDLE' && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Fishing Flow</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="State" value={readableState} />
              <Stat label="Current Spot" value={state?.activeSpotName || state?.activeCatch?.spotName || 'Not selected'} />
              <Stat label="Carry" value={`${(state?.carryWeightKg ?? 0).toFixed(1)} kg`} />
              <Stat label="Sell Value" value={`${fmt(state?.carryEstimatedValue ?? 0)} $`} />
            </div>
            <p className="mt-3 text-sm text-white/70">Choose spot {'->'} click green square (Go to spot) {'->'} catch runs automatic (bait/cast/bite/reel) {'->'} choose next spot.</p>
          </div>
        )}

        {state?.shiftState !== 'IDLE' && state?.lastResult && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Last Catch Result</h2>
            {state.lastResult.caught ? (
              <p className="mt-2 text-sm text-white/80">
                {state.lastResult.fishName} · {state.lastResult.fishRarity} · {state.lastResult.fishSize === 'GIANT' ? 'Best Size' : state.lastResult.fishSize === 'BIG' ? 'Medium Size' : 'Normal Size'} · {state.lastResult.fishWeightKg} kg
              </p>
            ) : (
              <p className="mt-2 text-sm text-red-200">{state.lastResult.failReason}</p>
            )}
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Summary label="Total Reward" value={`${fmt(state.lastResult.breakdown.totalReward)} $`} />
              <Summary label="XP Gained" value={`${state.lastResult.breakdown.xpGained}`} />
              <Summary label="Base Reward" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} />
              <Summary label="Spot Multiplier" value={`${state.lastResult.breakdown.spotMultiplier.toFixed(2)}x`} />
              <Summary label="Level Multiplier" value={`${state.lastResult.breakdown.levelMultiplier.toFixed(2)}x`} />
              <Summary label="Quality Multiplier" value={`${state.lastResult.breakdown.qualityMultiplier.toFixed(2)}x`} />
              <Summary label="Streak Multiplier" value={`${state.lastResult.breakdown.streakMultiplier.toFixed(2)}x`} />
              <Summary label="Integrity Multiplier" value={`${state.lastResult.breakdown.integrityMultiplier.toFixed(2)}x`} />
            </div>
          </div>
        )}

        {state?.shiftState === 'IDLE' && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Rod Shop</h2>
            <p className="mt-1 text-sm text-white/70">Upgrade rods for better fish size chance and higher catch payouts.</p>
            <div className="mt-4 rounded-xl border border-emerald-500/35 bg-emerald-900/20 p-3">
              <p className="text-sm font-black text-emerald-100">Carry Upgrade</p>
              <p className="text-xs text-emerald-200/80">+5kg for 50,000 $ (max 100kg)</p>
              <p className="mt-1 text-xs text-emerald-100/80">Current: {(state?.carryCapacityKg ?? 20).toFixed(0)}kg</p>
              <button
                type="button"
                onClick={() => buyCarry().catch(() => {})}
                disabled={busy || !canUpgradeCarry}
                className="mt-2 rounded-lg border border-emerald-400/45 bg-emerald-950/30 px-3 py-2 text-xs font-bold text-emerald-100 disabled:opacity-50"
              >
                {canUpgradeCarry ? `Upgrade to ${nextCarryCapacity}kg` : 'Carry Maxed'}
              </button>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {ROD_SHOP.map((rod) => {
                const currentTier = Number(state?.progress.rodTier || 1);
                const isCurrentTier = currentTier === rod.tier;
                const isLowerIncluded = currentTier > rod.tier;
                const disabled = busy || isCurrentTier || isLowerIncluded;
                return (
                  <div key={`rod-shop-${rod.tier}`} className="rounded-xl border border-white/15 bg-black/20 p-3">
                    <p className="text-sm font-black text-white">Tier {rod.tier} · {rod.name}</p>
                    <p className="text-xs text-white/70">{rod.bonus}</p>
                    <p className="mt-1 text-sm font-black text-[#ffd95a]">{fmt(rod.price)} $</p>
                    <button
                      type="button"
                      onClick={() => buyRod(rod.tier).catch(() => {})}
                      disabled={disabled}
                      className="mt-2 rounded-lg border border-cyan-500/40 bg-cyan-900/20 px-3 py-2 text-xs font-bold text-cyan-100 disabled:opacity-50"
                    >
                      {isCurrentTier ? 'Owned' : isLowerIncluded ? 'Included' : 'Buy Rod'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-widest text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-white/55">{label}</p>
      <p className="text-sm font-black text-white">{value}</p>
    </div>
  );
}
