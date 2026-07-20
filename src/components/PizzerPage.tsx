import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { PizzerOrderOption, PizzerStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const PACKING_STEPS = [
  { key: 'PICK_BOXES', label: 'Load pizzas', detail: 'Match every pizza box to the manifest.' },
  { key: 'ADD_DRINKS', label: 'Add drinks', detail: 'Secure the drinks before leaving the store.' },
  { key: 'CONFIRM_ORDER', label: 'Seal order', detail: 'Confirm the full order and release the route.' },
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

function orderTypeTone(orderType: string) {
  if (orderType === 'VIP') return 'border-[rgba(240,196,106,0.3)] bg-[rgba(240,196,106,0.08)] text-[var(--warning)]';
  if (orderType === 'URGENTA') return 'border-[rgba(255,107,114,0.3)] bg-[rgba(255,107,114,0.08)] text-[var(--danger)]';
  return 'border-[rgba(114,183,255,0.28)] bg-[rgba(114,183,255,0.07)] text-[var(--info)]';
}

function difficultyTone(difficulty: string) {
  if (difficulty === 'HARD') return 'text-[var(--danger)]';
  if (difficulty === 'MEDIUM') return 'text-[var(--warning)]';
  return 'text-[var(--money)]';
}

function ratingTone(rating: string) {
  if (rating === 'PERFECT') return 'border-[rgba(211,255,81,0.34)] bg-[rgba(211,255,81,0.09)] text-[var(--accent)]';
  if (rating === 'GOOD') return 'border-[rgba(114,227,154,0.28)] bg-[rgba(114,227,154,0.07)] text-[var(--money)]';
  if (rating === 'FAILED') return 'border-[rgba(255,107,114,0.3)] bg-[rgba(255,107,114,0.08)] text-[var(--danger)]';
  return 'border-white/[0.11] bg-white/[0.04] text-white/70';
}

function shiftLabel(shiftState?: string) {
  if (shiftState === 'SELECTING_ORDER') return 'Dispatch board';
  if (shiftState === 'PACKING_ORDER') return 'Packing order';
  if (shiftState === 'DELIVERY_ACTIVE') return 'Delivery live';
  if (shiftState === 'DELIVERY_RESULT') return 'Run complete';
  return 'Off duty';
}

export default function PizzerPage() {
  const { player, playerId, refresh } = usePlayer();
  const [state, setState] = useState<PizzerStateResponse | null>(null);
  const [options, setOptions] = useState<PizzerOrderOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);

  const pushPopup = useCallback((text: string, isError = false) => {
    setPopup({ text, isError });
    window.setTimeout(() => setPopup(null), 2600);
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
      pushPopup(e instanceof Error ? e.message : 'Failed to load courier state', true);
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
      pushPopup('You are on duty. Dispatch sent the first contracts.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start courier shift', true);
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
      pushPopup('Shift closed. Earnings were saved.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not end courier shift', true);
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
      pushPopup('Dispatch board refreshed.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not refresh contracts', true);
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
      pushPopup('Contract accepted. Prepare the order.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Contract selection failed', true);
    } finally {
      setBusy(false);
    }
  };

  const doPackingStep = async (stepKey: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const stepPopup = stepKey === 'PICK_BOXES'
        ? 'Loading pizza boxes...'
        : stepKey === 'ADD_DRINKS'
          ? 'Securing drinks...'
          : 'Sealing order...';
      pushPopup(stepPopup);
      await wait(800);
      const next = await api.pizzerPackingStep(playerId, stepKey);
      setState(next);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Packing step failed', true);
    } finally {
      setBusy(false);
    }
  };

  const handover = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Completing customer handoff...');
      await wait(800);
      const payload = await api.pizzerHandover(playerId, 'DOOR');
      setState(payload.state);
      refresh();
      if (payload.result.accident) {
        const repairLabel = payload.state.repairLabel || 'Repairing vehicle';
        const repairSec = payload.state.repairSecondsLeft || 10;
        pushPopup(`Run failed. ${repairLabel} for ${repairSec}s.`, true);
      } else {
        const messages = [`Run complete: +${fmt(payload.result.breakdown.totalReward)} $ and +${payload.result.breakdown.xpGained} XP.`];
        if (payload.result.progression.levelAfter > payload.result.progression.levelBefore) {
          messages.push(`Courier level ${payload.result.progression.levelAfter} reached.`);
        }
        if (payload.result.progression.unlockedVehicle) {
          messages.push(`${payload.result.progression.unlockedVehicle} unlocked.`);
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
      pushPopup(e instanceof Error ? e.message : 'Customer handoff failed', true);
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

  const xpPercent = useMemo(() => {
    if (!progress) return 0;
    if (!progress.nextLevelXp) return 100;
    const levelStart = Number(progress.currentLevelXp || 0);
    const levelEnd = Number(progress.nextLevelXp || levelStart + 1);
    const current = Number(progress.xp || 0);
    return clampPercent(((current - levelStart) / Math.max(1, levelEnd - levelStart)) * 100);
  }, [progress]);

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      {popup && (
        <div className={`animate-toast-in fixed left-1/2 top-4 z-[140] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-2xl backdrop-blur-xl md:top-6 ${
          popup.isError
            ? 'border-red-400/25 bg-[#261113]/95 text-red-100'
            : 'border-[rgba(211,255,81,0.24)] bg-[#11170d]/95 text-[#edffc0]'
        }`}>
          <div className="flex items-start gap-3">
            <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${popup.isError ? 'bg-[var(--danger)]' : 'bg-[var(--accent)]'}`} />
            <span>{popup.text}</span>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-[var(--accent)] opacity-[0.065] blur-3xl" />
          <div className="relative grid gap-7 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="section-kicker">Courier division</p>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${canStart ? 'border-white/[0.1] bg-white/[0.035] text-white/48' : 'border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.07)] text-[var(--accent)]'}`}>
                  {shiftLabel(state?.shiftState)}
                </span>
              </div>

              <h1 className="display-title mt-5">Move fast.<br /><span className="text-white/32">Deliver clean.</span></h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/44">
                Choose the contract, pack it correctly and protect the order quality until the customer handoff.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={() => startShift().catch(() => {})} disabled={!canStart || busy || underRepair} className="btn-primary rounded-2xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-40">
                  Clock in
                </button>
                <button type="button" onClick={() => endShift().catch(() => {})} disabled={canStart || busy} className="btn-danger rounded-2xl px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-35">
                  Clock out
                </button>
                {canShowOptions && (
                  <button type="button" onClick={() => refreshOptions().catch(() => {})} disabled={busy || underRepair} className="btn-ghost rounded-2xl px-5 py-3 text-sm disabled:opacity-40">
                    Refresh board
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-[22px] border border-white/[0.08] bg-black/25 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Courier profile</p>
                  <p className="mt-1 text-xl font-black text-white">{displayName}</p>
                  <p className="mt-1 text-xs text-white/38">{state?.vehicleLabel || 'Bicycle'} · Level {progress?.level ?? 1}</p>
                </div>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[15px] border border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.07)] text-xs font-black text-[var(--accent)]">PZ</span>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-white/38">Level progress</span>
                  <span className="font-black text-white">{progress ? `${fmt(progress.xp)} XP` : '0 XP'}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${xpPercent}%` }} />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/[0.07] pt-4">
                <HeroStat label="Streak" value={String(state?.streak ?? 0)} />
                <HeroStat label="Runs" value={fmt(progress?.totalDeliveries ?? 0)} />
                <HeroStat label="Earnings" value={`${fmt(progress?.totalEarnings ?? 0)} $`} money />
              </div>
            </div>
          </div>
        </section>

        {underRepair && (
          <section className="rounded-[20px] border border-[rgba(240,196,106,0.24)] bg-[rgba(240,196,106,0.065)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.14em] text-[var(--warning)]">Vehicle unavailable</p>
                <p className="mt-1 text-sm font-semibold text-white/68">{state?.repairLabel || 'Repairing vehicle'}</p>
              </div>
              <p className="text-2xl font-black text-white">{state?.repairSecondsLeft}s</p>
            </div>
          </section>
        )}

        {canShowOptions && (
          <section className="game-panel-soft p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="section-kicker">Dispatch board</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Choose the next run</h2>
                <p className="mt-2 text-sm text-white/38">Higher pressure contracts pay more, but give you less room for mistakes.</p>
              </div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white/28">{options.length} contracts live</p>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {options.map((option, index) => (
                <article key={option.orderId} className="game-card-interactive flex min-h-[330px] flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/24">Contract {String(index + 1).padStart(2, '0')}</p>
                      <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${orderTypeTone(option.orderType)}`}>
                        {option.orderType}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/25">Est. payout</p>
                      <p className="mt-1 text-xl font-black text-[var(--money)]">{fmt(option.estimatedReward)} $</p>
                      <p className="text-xs font-bold text-[var(--accent)]">+{option.estimatedXp} XP</p>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 border-y border-white/[0.065] py-4">
                    <ContractStat label="Distance" value={`${fmt(option.distanceMeters)}m`} />
                    <ContractStat label="ETA" value={`${option.estimatedTimeSec}s`} />
                    <ContractStat label="Pressure" value={option.difficulty} tone={difficultyTone(option.difficulty)} />
                  </div>

                  <div className="mt-4 flex-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/27">Order manifest</p>
                    <div className="mt-3 space-y-2">
                      {option.pizzas.map((item) => (
                        <ManifestRow key={`pizza-${option.orderId}-${item.name}`} quantity={item.quantity} name={item.name} />
                      ))}
                      {option.drinks.map((item) => (
                        <ManifestRow key={`drink-${option.orderId}-${item.name}`} quantity={item.quantity} name={item.name} muted />
                      ))}
                    </div>
                  </div>

                  <button type="button" onClick={() => selectOrder(option.orderId).catch(() => {})} disabled={busy} className="btn-secondary mt-5 w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-40">
                    Accept this run
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {(canPack || canDeliver) && active && (
          <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
            <div className="game-panel-soft p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="section-kicker">Active contract</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">{active.targetLabel}</h2>
                  <p className="mt-2 text-sm text-white/38">{canPack ? 'Finish the manifest before dispatch releases the route.' : 'The order is packed. Complete the customer handoff.'}</p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${orderTypeTone(active.orderType)}`}>{active.orderType}</span>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MissionStat label="Time left" value={`${active.timeLeftSec}s`} alert={active.timeLeftSec <= 20} />
                <MissionStat label="Freshness" value={`${active.freshness}%`} good={active.freshness >= 75} />
                <MissionStat label="Damage" value={`${active.damagePercent}%`} alert={active.damagePercent >= 30} />
                <MissionStat label="Current streak" value={String(state?.streak ?? 0)} />
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-2">
                <div className="rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Order manifest</p>
                  <div className="mt-4 space-y-2.5">
                    {active.pizzas.map((item) => (
                      <ManifestRow key={`active-pizza-${item.name}`} quantity={item.quantity} name={item.name} />
                    ))}
                    {active.drinks.map((item) => (
                      <ManifestRow key={`active-drink-${item.name}`} quantity={item.quantity} name={item.name} muted />
                    ))}
                  </div>
                </div>

                <div className="rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
                  <QualityBar label="Freshness" value={active.freshness} tone="good" />
                  <div className="mt-5">
                    <QualityBar label="Vehicle condition" value={100 - active.damagePercent} tone={active.damagePercent >= 30 ? 'danger' : 'good'} />
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-white/32">Final payout is affected by order freshness, damage, level and your active streak.</p>
                </div>
              </div>
            </div>

            <div className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">Run flow</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{canPack ? 'Prepare the order' : 'Customer handoff'}</h3>

              {canPack && (
                <div className="mt-5 space-y-3">
                  {PACKING_STEPS.map((step, index) => {
                    const done = active.packingStepsDone.includes(step.key);
                    const isNext = !done && active.nextPackingStep === step.key;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => doPackingStep(step.key).catch(() => {})}
                        disabled={busy || done || !isNext || underRepair}
                        className={`flex w-full items-center gap-3 rounded-[18px] border p-3.5 text-left transition disabled:cursor-default ${
                          done
                            ? 'border-[rgba(114,227,154,0.2)] bg-[rgba(114,227,154,0.055)]'
                            : isNext
                              ? 'border-[rgba(211,255,81,0.3)] bg-[rgba(211,255,81,0.075)] hover:bg-[rgba(211,255,81,0.1)]'
                              : 'border-white/[0.065] bg-white/[0.02] opacity-45'
                        }`}
                      >
                        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] border text-xs font-black ${
                          done
                            ? 'border-[rgba(114,227,154,0.25)] bg-[var(--money)] text-[#0b160f]'
                            : isNext
                              ? 'border-[rgba(211,255,81,0.3)] bg-[var(--accent)] text-[#10140b]'
                              : 'border-white/[0.08] bg-white/[0.03] text-white/35'
                        }`}>
                          {done ? 'OK' : String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-black text-white">{step.label}</span>
                          <span className="mt-0.5 block text-xs leading-relaxed text-white/34">{step.detail}</span>
                        </span>
                        {isNext && <span className="text-lg text-[var(--accent)]">›</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {canDeliver && (
                <div className="mt-5">
                  <div className="rounded-[20px] border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.055)] p-5">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">Route released</p>
                    <p className="mt-2 text-xl font-black text-white">Order ready for delivery</p>
                    <p className="mt-2 text-sm leading-relaxed text-white/42">Confirm the customer handoff to calculate your rating, payout and XP.</p>
                    <button type="button" onClick={() => handover().catch(() => {})} disabled={busy || underRepair} className="btn-primary mt-5 w-full rounded-2xl px-4 py-3.5 text-sm disabled:opacity-40">
                      Complete handoff
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {state?.lastResult && (
          <section className="game-panel overflow-hidden">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-white/[0.07] bg-black/20 p-6 sm:p-7 lg:border-b-0 lg:border-r">
                <p className="section-kicker">Delivery report</p>
                <span className={`mt-5 inline-flex rounded-full border px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] ${ratingTone(state.lastResult.breakdown.rating)}`}>
                  {state.lastResult.breakdown.rating}
                </span>
                <p className="mt-4 text-5xl font-black tracking-[-0.055em] text-[var(--money)]">+{fmt(state.lastResult.breakdown.totalReward)} $</p>
                <p className="mt-2 text-lg font-black text-[var(--accent)]">+{state.lastResult.breakdown.xpGained} XP</p>
                <p className="mt-4 text-sm leading-relaxed text-white/38">The full result is stored in your courier career history.</p>

                {state.lastResult.progression.unlockedVehicle && (
                  <div className="mt-6 rounded-[18px] border border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.06)] p-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">Vehicle unlocked</p>
                    <p className="mt-1 text-lg font-black text-white">{state.lastResult.progression.unlockedVehicle}</p>
                  </div>
                )}
              </div>

              <div className="p-6 sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Performance factors</p>
                    <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Why you earned it</h3>
                  </div>
                  <p className="text-sm font-black text-white/55">Tip: {fmt(state.lastResult.breakdown.tip)} $</p>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <ResultStat label="Base payout" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} />
                  <ResultStat label="Freshness" value={`${state.lastResult.breakdown.freshness}%`} />
                  <ResultStat label="Damage" value={`${state.lastResult.breakdown.damagePercent}%`} />
                  <ResultStat label="Level factor" value={`${state.lastResult.breakdown.levelMultiplier.toFixed(2)}x`} />
                  <ResultStat label="Streak factor" value={`${state.lastResult.breakdown.streakMultiplier.toFixed(2)}x`} />
                  <ResultStat label="Quality factor" value={`${state.lastResult.breakdown.freshnessMultiplier.toFixed(2)}x`} />
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function HeroStat({ label, value, money }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ContractStat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/24">{label}</p>
      <p className={`mt-1 truncate text-xs font-black ${tone || 'text-white'}`}>{value}</p>
    </div>
  );
}

function ManifestRow({ quantity, name, muted }: { quantity: number; name: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className={muted ? 'text-white/42' : 'text-white/72'}>{name}</span>
      <span className={`rounded-lg border px-2 py-0.5 text-xs font-black ${muted ? 'border-white/[0.07] bg-white/[0.025] text-white/50' : 'border-[rgba(211,255,81,0.16)] bg-[rgba(211,255,81,0.05)] text-[var(--accent)]'}`}>×{quantity}</span>
    </div>
  );
}

function MissionStat({ label, value, alert, good }: { label: string; value: string; alert?: boolean; good?: boolean }) {
  const valueClass = alert ? 'text-[var(--danger)]' : good ? 'text-[var(--money)]' : 'text-white';
  return (
    <div className="game-card p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p>
      <p className={`mt-2 truncate text-xl font-black tracking-[-0.025em] ${valueClass}`}>{value}</p>
    </div>
  );
}

function QualityBar({ label, value, tone }: { label: string; value: number; tone: 'good' | 'danger' }) {
  const safeValue = clampPercent(value);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-white/42">{label}</span>
        <span className={`font-black ${tone === 'danger' ? 'text-[var(--danger)]' : 'text-white'}`}>{safeValue}%</span>
      </div>
      <div className="progress-track">
        <div
          className={`h-full rounded-full transition-all ${tone === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--money)]'}`}
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="game-card p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/24">{label}</p>
      <p className="mt-2 truncate text-lg font-black text-white">{value}</p>
    </div>
  );
}
