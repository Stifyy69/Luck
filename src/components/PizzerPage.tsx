import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { PizzerOrderOption, PizzerStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const PACKING_STEPS = [
  { key: 'PICK_BOXES', label: 'Pizza' },
  { key: 'ADD_DRINKS', label: 'Drink' },
  { key: 'CONFIRM_ORDER', label: 'Confirm' },
];

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function orderTypeBadge(orderType: string) {
  if (orderType === 'VIP') return 'border-yellow-400/40 bg-yellow-500/15 text-yellow-200';
  if (orderType === 'URGENTA') return 'border-red-400/40 bg-red-500/15 text-red-200';
  return 'border-sky-400/40 bg-sky-500/15 text-sky-200';
}

export default function PizzerPage() {
  const { player, playerId, refresh } = usePlayer();
  const [state, setState] = useState<PizzerStateResponse | null>(null);
  const [options, setOptions] = useState<PizzerOrderOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);

  const pushPopup = useCallback((text: string, isError = false) => {
    setPopup({ text, isError });
    window.setTimeout(() => setPopup(null), 400);
  }, []);

  const loadState = useCallback(async () => {
    try {
      const next = await api.pizzerState(playerId);
      setState(next);
      if (next.shiftState === 'SELECTING_ORDER' && options.length === 0 && Number(next.repairSecondsLeft || 0) <= 0) {
        const data = await api.pizzerOrderOptions(playerId);
        setOptions(data.options || []);
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Failed to load pizzer state', true);
    }
  }, [playerId, options.length, pushPopup]);

  useEffect(() => {
    loadState().catch(() => {});
  }, [loadState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!state) return;
      if (state.shiftState === 'DELIVERY_ACTIVE' || state.shiftState === 'PACKING_ORDER') {
        loadState().catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, loadState]);

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pizzerShiftStart(playerId);
      setState(next);
      const data = await api.pizzerOrderOptions(playerId);
      setOptions(data.options || []);
      pushPopup('Shift started. Pick your first order.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start shift', true);
    } finally {
      setBusy(false);
    }
  };

  const endShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pizzerShiftEnd(playerId);
      setState(next);
      setOptions([]);
      pushPopup('Shift ended.');
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
      const data = await api.pizzerOrderOptions(playerId);
      setOptions(data.options || []);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not load options', true);
    } finally {
      setBusy(false);
    }
  };

  const selectOrder = async (orderId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pizzerOrderSelect(playerId, orderId);
      setState(next);
      setOptions([]);
      pushPopup('Order accepted. Complete packing steps.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Order select failed', true);
    } finally {
      setBusy(false);
    }
  };

  const doPackingStep = async (stepKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const stepPopup = stepKey === 'PICK_BOXES' ? 'Putting pizza in backpack...' : stepKey === 'ADD_DRINKS' ? 'Putting drinks in backpack...' : 'Confirming order...';
      pushPopup(stepPopup);
      await wait(1000);
      const next = await api.pizzerPackingStep(playerId, stepKey);
      setState(next);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Packing failed', true);
    } finally {
      setBusy(false);
    }
  };

  const handover = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Delivering order...');
      await wait(1000);
      const payload = await api.pizzerHandover(playerId, 'DOOR');
      setState(payload.state);
      refresh();
      if (payload.result.accident) {
        const repairLabel = payload.state.repairLabel || 'Repairing vehicle';
        const repairSec = payload.state.repairSecondsLeft || 10;
        pushPopup(`Accident! Course failed. ${repairLabel} (${repairSec}s)`, true);
      } else {
        const messages = [`Delivery finished: +${fmt(payload.result.breakdown.totalReward)} $ / +${payload.result.breakdown.xpGained} XP`];
        if (payload.result.progression.levelAfter > payload.result.progression.levelBefore) {
          messages.push(`Congrats! You reached level ${payload.result.progression.levelAfter}.`);
        }
        if (payload.result.progression.unlockedVehicle) {
          messages.push(`Congrats! You now deliver with ${payload.result.progression.unlockedVehicle}.`);
        }
        pushPopup(messages.join(' '));
      }
      window.setTimeout(() => {
        api
          .pizzerOrderOptions(playerId)
          .then((data) => setOptions(data.options || []))
          .catch(() => {});
      }, 550);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Handover failed', true);
    } finally {
      setBusy(false);
    }
  };

  const progress = state?.progress;
  const active = state?.activeOrder;
  const canStart = state?.shiftState === 'IDLE';
  const canShowOptions = state?.shiftState === 'SELECTING_ORDER';
  const canPack = state?.shiftState === 'PACKING_ORDER';
  const canDeliver = state?.shiftState === 'DELIVERY_ACTIVE';
  const underRepair = Number(state?.repairSecondsLeft || 0) > 0;

  const displayName = useMemo(() => String(player?.displayName || 'Player'), [player]);

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      {popup && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/35 p-4 backdrop-blur-[1px]">
          <div className={`max-w-sm rounded-2xl border px-5 py-4 text-center text-sm font-bold shadow-2xl backdrop-blur ${popup.isError ? 'border-red-500/45 bg-red-950/90 text-red-200' : 'border-green-500/45 bg-green-950/90 text-green-200'}`}>
            {popup.text}
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Work</p>
          <h1 className="text-3xl font-black text-white">Pizzer / Pizza Courier</h1>
          <p className="mt-1 text-sm text-white/60">{displayName} · Pizzer Lv. {progress?.level ?? 1}</p>

          {underRepair && (
            <p className="mt-2 rounded-lg border border-orange-400/50 bg-orange-900/25 px-3 py-2 text-xs font-black uppercase tracking-wide text-orange-200">
              {state?.repairLabel || 'Repairing vehicle'} · {state?.repairSecondsLeft}s
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Level" value={String(progress?.level ?? 1)} />
            <Stat label="XP" value={progress ? `${fmt(progress.xp)} / ${progress.nextLevelXp ? fmt(progress.nextLevelXp) : 'MAX'}` : '0'} />
            <Stat label="Vehicle" value={state?.vehicleLabel ?? 'Bicycle'} />
            <Stat label="Streak" value={String(state?.streak ?? 0)} />
            <Stat label="Total Earnings" value={`${fmt(progress?.totalEarnings ?? 0)} $`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={startShift}
              disabled={!canStart || busy || underRepair}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              Start Shift
            </button>
            <button
              type="button"
              onClick={endShift}
              disabled={canStart || busy}
              className="rounded-xl border border-red-500/35 bg-red-900/20 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-50"
            >
              End Shift
            </button>
            {canShowOptions && (
              <button
                type="button"
                onClick={() => refreshOptions().catch(() => {})}
                disabled={busy || underRepair}
                className="rounded-xl border border-white/20 px-4 py-2 text-sm font-bold text-white/75 disabled:opacity-50"
              >
                Refresh Orders
              </button>
            )}
          </div>
        </div>

        {canShowOptions && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Available Orders</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {options.map((option) => (
                <button
                  key={option.orderId}
                  type="button"
                  onClick={() => selectOrder(option.orderId)}
                  disabled={busy}
                  className="rounded-xl border border-white/15 bg-white/5 p-4 text-left transition hover:bg-white/10 disabled:opacity-60"
                >
                  <span className={`inline-block rounded border px-2 py-0.5 text-[10px] font-black ${orderTypeBadge(option.orderType)}`}>
                    {option.orderType}
                  </span>
                  <p className="mt-2 text-sm text-white/70">Distance: {fmt(option.distanceMeters)}m</p>
                  <p className="text-sm text-white/70">ETA: {option.estimatedTimeSec}s</p>
                  <p className="text-sm text-white/70">Difficulty: {option.difficulty}</p>
                  <div className="mt-2 rounded-lg border border-white/10 bg-black/20 p-2">
                    <p className="text-[11px] font-black uppercase tracking-wide text-[#ffd95a]">Order</p>
                    {option.pizzas.map((item) => (
                      <p key={`pizza-${option.orderId}-${item.name}`} className="text-xs text-white/75">
                        {item.quantity} x {item.name}
                      </p>
                    ))}
                    {option.drinks.map((item) => (
                      <p key={`drink-${option.orderId}-${item.name}`} className="text-xs text-[#9fe7ff]">
                        {item.quantity} x {item.name}
                      </p>
                    ))}
                  </div>
                  <p className="mt-2 font-black text-[#ffd95a]">~{fmt(option.estimatedReward)} $</p>
                  <p className="text-sm font-bold text-[#45d483]">~{option.estimatedXp} XP</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {(canPack || canDeliver) && active && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Active Delivery · {active.orderType}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#ffe48e]">Flow: Pizza - Drink - Confirm</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="Target" value={active.targetLabel} />
              <Stat label="Time Left" value={`${active.timeLeftSec}s`} />
              <Stat label="Freshness" value={`${active.freshness}%`} />
              <Stat label="Damage" value={`${active.damagePercent}%`} />
              <Stat label="Streak" value={String(state?.streak ?? 0)} />
            </div>

            <div className="mt-4 rounded-xl border border-white/15 bg-black/20 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-[#ffd95a]">Comanda</p>
              <div className="mt-1 grid gap-1 sm:grid-cols-2">
                <div>
                  <p className="text-[11px] font-bold uppercase text-white/55">Pizza</p>
                  {active.pizzas.map((item) => (
                    <p key={`active-pizza-${item.name}`} className="text-sm text-white/80">
                      {item.quantity} x {item.name}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase text-white/55">Drink</p>
                  {active.drinks.map((item) => (
                    <p key={`active-drink-${item.name}`} className="text-sm text-[#9fe7ff]">
                      {item.quantity} x {item.name}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            {canPack && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {PACKING_STEPS.map((step) => {
                  const done = active.packingStepsDone.includes(step.key);
                  const isNext = !done && active.nextPackingStep === step.key;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => doPackingStep(step.key)}
                      disabled={busy || done || underRepair}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold transition ${done ? 'border-green-500/45 bg-green-900/30 text-green-200' : isNext ? 'border-yellow-400/60 bg-yellow-500/20 text-yellow-100 hover:bg-yellow-500/30' : 'border-white/20 bg-white/5 text-white/80 hover:bg-white/10'} disabled:opacity-60`}
                    >
                      {done ? `Done: ${step.label}` : isNext ? `Next: ${step.label}` : step.label}
                    </button>
                  );
                })}
              </div>
            )}

            {canDeliver && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => handover().catch(() => {})}
                  disabled={busy || underRepair}
                  className="rounded-xl border border-[#ffd95a]/35 bg-[#ffd95a]/10 px-4 py-3 text-sm font-bold text-[#ffe7a4] hover:bg-[#ffd95a]/20 disabled:opacity-60"
                >
                  Deliver Order
                </button>
              </div>
            )}
          </div>
        )}

        {state?.lastResult && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Last Delivery Summary</h2>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Summary label="Rating" value={state.lastResult.breakdown.rating} />
              <Summary label="Total Reward" value={`${fmt(state.lastResult.breakdown.totalReward)} $`} />
              <Summary label="XP Gained" value={`${state.lastResult.breakdown.xpGained}`} />
              <Summary label="Base Reward" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} />
              <Summary label="Level Multiplier" value={`${state.lastResult.breakdown.levelMultiplier.toFixed(2)}x`} />
              <Summary label="Freshness Multiplier" value={`${state.lastResult.breakdown.freshnessMultiplier.toFixed(2)}x`} />
              <Summary label="Streak Multiplier" value={`${state.lastResult.breakdown.streakMultiplier.toFixed(2)}x`} />
              <Summary label="Damage Multiplier" value={`${state.lastResult.breakdown.damageMultiplier.toFixed(2)}x`} />
            </div>
            {state.lastResult.progression.unlockedVehicle && (
              <p className="mt-3 text-sm font-black text-[#ffd95a]">Unlocked: {state.lastResult.progression.unlockedVehicle}</p>
            )}
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
