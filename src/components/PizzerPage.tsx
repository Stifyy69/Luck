import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { PizzerOrderOption, PizzerStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

type FleetVehicle = {
  id: 'bicycle' | 'scooter' | 'delivery-car';
  label: string;
  role: string;
  unlockLevel: number;
  image: string;
  speed: string;
  contractAccess: string;
  bonus: string;
};

const PACKING_STEPS = [
  { key: 'PICK_BOXES', label: 'Packing pizzas' },
  { key: 'ADD_DRINKS', label: 'Securing drinks' },
  { key: 'CONFIRM_ORDER', label: 'Checking receipt' },
];

const FLEET: FleetVehicle[] = [
  {
    id: 'bicycle',
    label: 'Bicycle Courier',
    role: 'Starter vehicle',
    unlockLevel: 1,
    image: '/jobs/pizzer/bicycle.svg',
    speed: 'Urban short runs',
    contractAccess: 'Standard contracts',
    bonus: 'Low repair risk',
  },
  {
    id: 'scooter',
    label: 'Scooter Courier',
    role: 'Mid-tier vehicle',
    unlockLevel: 17,
    image: '/jobs/pizzer/scooter.svg',
    speed: 'Faster city routes',
    contractAccess: 'Urgent contracts',
    bonus: 'Better freshness window',
  },
  {
    id: 'delivery-car',
    label: 'Delivery Car',
    role: 'Top-tier vehicle',
    unlockLevel: 34,
    image: '/jobs/pizzer/delivery-car.svg',
    speed: 'Long premium routes',
    contractAccess: 'VIP contracts',
    bonus: 'Highest route capacity',
  },
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
  if (shiftState === 'PACKING_ORDER') return 'Preparing order';
  if (shiftState === 'DELIVERY_ACTIVE') return 'Delivery live';
  if (shiftState === 'DELIVERY_RESULT') return 'Run complete';
  return 'Off duty';
}

function fleetVehicleForLevel(level: number) {
  if (level >= 34) return FLEET[2];
  if (level >= 17) return FLEET[1];
  return FLEET[0];
}

export default function PizzerPage() {
  const { player, playerId, refresh } = usePlayer();
  const [state, setState] = useState<PizzerStateResponse | null>(null);
  const [options, setOptions] = useState<PizzerOrderOption[]>([]);
  const [acceptedOption, setAcceptedOption] = useState<PizzerOrderOption | null>(null);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const [autoPreparing, setAutoPreparing] = useState(false);
  const [preparationStep, setPreparationStep] = useState(0);
  const [fleetPreviewId, setFleetPreviewId] = useState<FleetVehicle['id']>('bicycle');
  const dispatchRef = useRef<HTMLElement | null>(null);
  const activeRef = useRef<HTMLElement | null>(null);

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

  const progress = state?.progress;
  const active = state?.activeOrder;
  const canStart = state?.shiftState === 'IDLE';
  const canShowOptions = state?.shiftState === 'SELECTING_ORDER';
  const canPack = state?.shiftState === 'PACKING_ORDER';
  const canDeliver = state?.shiftState === 'DELIVERY_ACTIVE';
  const underRepair = Number(state?.repairSecondsLeft || 0) > 0;
  const displayName = useMemo(() => String(player?.displayName || 'Player'), [player]);
  const currentVehicle = useMemo(() => fleetVehicleForLevel(progress?.level ?? 1), [progress?.level]);
  const fleetPreview = useMemo(
    () => FLEET.find((vehicle) => vehicle.id === fleetPreviewId) || currentVehicle,
    [fleetPreviewId, currentVehicle],
  );

  useEffect(() => {
    setFleetPreviewId(currentVehicle.id);
  }, [currentVehicle.id]);

  const xpPercent = useMemo(() => {
    if (!progress) return 0;
    if (!progress.nextLevelXp) return 100;
    const levelStart = Number(progress.currentLevelXp || 0);
    const levelEnd = Number(progress.nextLevelXp || levelStart + 1);
    const current = Number(progress.xp || 0);
    return clampPercent(((current - levelStart) / Math.max(1, levelEnd - levelStart)) * 100);
  }, [progress]);

  const scrollToDispatch = useCallback(() => {
    window.setTimeout(() => {
      dispatchRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const scrollToActive = useCallback(() => {
    window.setTimeout(() => {
      activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pizzerShiftStart(playerId);
      setState(next);
      const data = await api.pizzerOrderOptions(playerId);
      setOptions(data.options || []);
      pushPopup('Dispatch sent the next available runs.');
      scrollToDispatch();
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start courier shift', true);
    } finally {
      setBusy(false);
    }
  };

  const chooseNextRun = async () => {
    if (busy || underRepair) return;
    if (canStart) {
      await startShift();
      return;
    }
    if (canShowOptions && options.length === 0) {
      setBusy(true);
      try {
        const data = await api.pizzerOrderOptions(playerId);
        setOptions(data.options || []);
      } catch (e) {
        pushPopup(e instanceof Error ? e.message : 'Could not load contracts', true);
      } finally {
        setBusy(false);
      }
    }
    scrollToDispatch();
  };

  const endShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pizzerShiftEnd(playerId);
      setState(next);
      setOptions([]);
      setAcceptedOption(null);
      setAutoPreparing(false);
      setPreparationStep(0);
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

  const selectOrder = async (option: PizzerOrderOption) => {
    if (busy) return;
    setBusy(true);
    setAcceptedOption(option);
    setAutoPreparing(true);
    setPreparationStep(0);
    try {
      let next = await api.pizzerOrderSelect(playerId, option.orderId);
      setState(next);
      setOptions([]);
      scrollToActive();

      for (let index = 0; index < PACKING_STEPS.length; index += 1) {
        setPreparationStep(index);
        await wait(700);
        next = await api.pizzerPackingStep(playerId, PACKING_STEPS[index].key);
        setState(next);
      }

      setPreparationStep(PACKING_STEPS.length);
      pushPopup('Order prepared automatically. Route is ready.');
    } catch (e) {
      setAcceptedOption(null);
      pushPopup(e instanceof Error ? e.message : 'Contract preparation failed', true);
    } finally {
      setAutoPreparing(false);
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
      setAcceptedOption(null);
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
          .then((data: { options: PizzerOrderOption[] }) => setOptions(data.options || []))
          .catch(() => {});
      }, 550);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Customer handoff failed', true);
    } finally {
      setBusy(false);
    }
  };

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
        <section className="game-panel relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12">
          <div className="pointer-events-none absolute left-1/2 top-[-180px] h-[360px] w-[520px] -translate-x-1/2 rounded-full bg-[var(--accent)] opacity-[0.06] blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <div className="flex flex-wrap items-center justify-center gap-2">
              <p className="section-kicker">Pizza courier</p>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${canStart ? 'border-white/[0.1] bg-white/[0.035] text-white/48' : 'border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.07)] text-[var(--accent)]'}`}>
                {shiftLabel(state?.shiftState)}
              </span>
            </div>

            <h1 className="display-title mt-5">Choose the next run.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45">
              Pick a contract, let the kitchen prepare it automatically and protect the order until the final handoff.
            </p>

            <button
              type="button"
              onClick={() => chooseNextRun().catch(() => {})}
              disabled={busy || underRepair || canPack || canDeliver}
              className="btn-primary mt-7 min-w-[220px] rounded-2xl px-6 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-35"
            >
              {busy && canStart ? 'Loading dispatch...' : canShowOptions ? 'View available runs' : 'Choose next run'}
            </button>

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-4">
              <HeroStat label="Courier" value={displayName} />
              <HeroStat label="Level" value={String(progress?.level ?? 1)} />
              <HeroStat label="Streak" value={String(state?.streak ?? 0)} />
              <HeroStat label="Earnings" value={`${fmt(progress?.totalEarnings ?? 0)} $`} money />
            </div>

            <div className="mx-auto mt-5 max-w-xl">
              <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                <span className="font-bold text-white/38">Courier level progress</span>
                <span className="font-black text-white">{progress ? `${fmt(progress.xp)} XP` : '0 XP'}</span>
              </div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${xpPercent}%` }} />
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

        <section className="game-panel-soft p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Delivery fleet</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Your next vehicle unlock</h2>
              <p className="mt-2 text-sm text-white/38">Vehicles unlock automatically with courier level. Select a card to inspect its route benefits.</p>
            </div>
            {!canStart && (
              <button type="button" onClick={() => endShift().catch(() => {})} disabled={busy} className="btn-danger rounded-2xl px-4 py-2.5 text-xs disabled:opacity-35">
                Clock out
              </button>
            )}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {FLEET.map((vehicle) => {
              const level = progress?.level ?? 1;
              const unlocked = level >= vehicle.unlockLevel;
              const inUse = currentVehicle.id === vehicle.id;
              const selected = fleetPreview.id === vehicle.id;
              return (
                <button
                  key={vehicle.id}
                  type="button"
                  onClick={() => setFleetPreviewId(vehicle.id)}
                  className={`overflow-hidden rounded-[22px] border p-4 text-left transition ${selected ? 'border-[rgba(211,255,81,0.32)] bg-[rgba(211,255,81,0.055)]' : 'border-white/[0.08] bg-black/20 hover:border-white/[0.16]'}`}
                >
                  <div className="flex h-[170px] items-center justify-center rounded-[18px] border border-white/[0.08] bg-[#090c09] p-3">
                    <img src={vehicle.image} alt={vehicle.label} className={`h-full w-full object-contain ${unlocked ? '' : 'grayscale opacity-40'}`} />
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/28">{vehicle.role}</p>
                      <p className="mt-1 text-lg font-black text-white">{vehicle.label}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${inUse ? 'border-[rgba(211,255,81,0.3)] bg-[rgba(211,255,81,0.08)] text-[var(--accent)]' : unlocked ? 'border-[rgba(114,227,154,0.25)] bg-[rgba(114,227,154,0.07)] text-[var(--money)]' : 'border-white/[0.1] bg-white/[0.035] text-white/38'}`}>
                      {inUse ? 'In use' : unlocked ? 'Unlocked' : `Level ${vehicle.unlockLevel}`}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 grid gap-3 rounded-[20px] border border-white/[0.07] bg-black/20 p-4 sm:grid-cols-3">
            <FleetDetail label="Route class" value={fleetPreview.speed} />
            <FleetDetail label="Contract access" value={fleetPreview.contractAccess} />
            <FleetDetail label="Vehicle benefit" value={fleetPreview.bonus} />
          </div>
        </section>

        {canShowOptions && (
          <section ref={dispatchRef} className="game-panel-soft scroll-mt-24 p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4 text-center sm:text-left">
              <div className="w-full sm:w-auto">
                <p className="section-kicker">Dispatch board</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Choose the next run</h2>
                <p className="mt-2 text-sm text-white/38">Higher pressure contracts pay more, but give you less room for mistakes.</p>
              </div>
              <button type="button" onClick={() => refreshOptions().catch(() => {})} disabled={busy || underRepair} className="btn-ghost mx-auto rounded-2xl px-4 py-2.5 text-xs disabled:opacity-40 sm:mx-0">
                Refresh board
              </button>
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

                  <button type="button" onClick={() => selectOrder(option).catch(() => {})} disabled={busy} className="btn-secondary mt-5 w-full rounded-2xl px-4 py-3 text-sm disabled:opacity-40">
                    Accept and prepare
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {(canPack || canDeliver) && active && (
          <section ref={activeRef} className="grid scroll-mt-24 gap-5 xl:grid-cols-[1.15fr_0.85fr]">
            <div className="game-panel-soft p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="section-kicker">Active contract</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">{active.targetLabel}</h2>
                  <p className="mt-2 text-sm text-white/38">{autoPreparing ? 'The kitchen is preparing the full order automatically.' : 'The route is active. Protect freshness and vehicle condition.'}</p>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.13em] ${orderTypeTone(active.orderType)}`}>{active.orderType}</span>
              </div>

              <div className="mt-6 rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Order manifest</p>
                  {acceptedOption && (
                    <p className="text-sm font-black text-[var(--money)]">~{fmt(acceptedOption.estimatedReward)} $ · +{acceptedOption.estimatedXp} XP</p>
                  )}
                </div>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <div className="space-y-2.5">
                    {active.pizzas.map((item) => (
                      <ManifestRow key={`active-pizza-${item.name}`} quantity={item.quantity} name={item.name} />
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {active.drinks.map((item) => (
                      <ManifestRow key={`active-drink-${item.name}`} quantity={item.quantity} name={item.name} muted />
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <MissionStat label="Distance" value={`${fmt(active.distanceMeters)}m`} />
                <MissionStat label="Time left" value={`${active.timeLeftSec}s`} alert={active.timeLeftSec <= 20} />
                <MissionStat label="Freshness" value={`${active.freshness}%`} good={active.freshness >= 75} />
                <MissionStat label="Damage" value={`${active.damagePercent}%`} alert={active.damagePercent >= 30} />
              </div>
            </div>

            <div className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">Delivery status</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">{autoPreparing ? 'Preparing order' : 'Ready for delivery'}</h3>

              <div className="mt-5 flex h-[155px] items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#090c09] p-3">
                <img src={currentVehicle.image} alt={currentVehicle.label} className="h-full w-full object-contain" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/28">Current vehicle</p>
                  <p className="mt-1 text-lg font-black text-white">{state?.vehicleLabel || currentVehicle.label}</p>
                </div>
                <p className="text-sm font-black text-[var(--accent)]">Streak {state?.streak ?? 0}</p>
              </div>

              {autoPreparing ? (
                <div className="mt-5 space-y-3">
                  {PACKING_STEPS.map((step, index) => {
                    const done = preparationStep > index;
                    const activeStep = preparationStep === index;
                    return (
                      <div key={step.key} className={`flex items-center gap-3 rounded-[17px] border p-3 ${done ? 'border-[rgba(114,227,154,0.2)] bg-[rgba(114,227,154,0.055)]' : activeStep ? 'border-[rgba(211,255,81,0.28)] bg-[rgba(211,255,81,0.07)]' : 'border-white/[0.065] bg-white/[0.02] opacity-45'}`}>
                        <span className={`inline-flex h-9 w-9 items-center justify-center rounded-[13px] text-[10px] font-black ${done ? 'bg-[var(--money)] text-[#0b160f]' : activeStep ? 'bg-[var(--accent)] text-[#10140b]' : 'bg-white/[0.05] text-white/35'}`}>
                          {done ? 'OK' : String(index + 1).padStart(2, '0')}
                        </span>
                        <p className="text-sm font-black text-white">{step.label}</p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5">
                  <QualityBar label="Freshness" value={active.freshness} tone="good" />
                  <div className="mt-5">
                    <QualityBar label="Vehicle condition" value={100 - active.damagePercent} tone={active.damagePercent >= 30 ? 'danger' : 'good'} />
                  </div>
                  <button type="button" onClick={() => handover().catch(() => {})} disabled={busy || underRepair || !canDeliver} className="btn-primary mt-6 w-full rounded-2xl px-4 py-3.5 text-sm disabled:opacity-40">
                    Complete delivery
                  </button>
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

function HeroStat({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function FleetDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-white/25">{label}</p>
      <p className="mt-1 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function ContractStat({ label, value, tone = 'text-white' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/24">{label}</p>
      <p className={`mt-1 truncate text-xs font-black ${tone}`}>{value}</p>
    </div>
  );
}

function ManifestRow({ quantity, name, muted = false }: { quantity: number; name: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[14px] border border-white/[0.06] bg-white/[0.025] px-3 py-2.5">
      <span className={`truncate text-xs font-bold ${muted ? 'text-white/48' : 'text-white/72'}`}>{name}</span>
      <span className={`shrink-0 text-xs font-black ${muted ? 'text-[var(--info)]' : 'text-[var(--accent)]'}`}>x{quantity}</span>
    </div>
  );
}

function MissionStat({ label, value, alert = false, good = false }: { label: string; value: string; alert?: boolean; good?: boolean }) {
  const tone = alert ? 'text-[var(--danger)]' : good ? 'text-[var(--money)]' : 'text-white';
  return (
    <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-3">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p>
      <p className={`mt-1 text-lg font-black ${tone}`}>{value}</p>
    </div>
  );
}

function QualityBar({ label, value, tone }: { label: string; value: number; tone: 'good' | 'danger' }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-xs">
        <span className="font-bold text-white/42">{label}</span>
        <span className={`font-black ${tone === 'danger' ? 'text-[var(--danger)]' : 'text-[var(--money)]'}`}>{clampPercent(value)}%</span>
      </div>
      <div className="progress-track">
        <div className={`h-full rounded-full transition-[width] duration-300 ${tone === 'danger' ? 'bg-[var(--danger)]' : 'bg-[var(--money)]'}`} style={{ width: `${clampPercent(value)}%` }} />
      </div>
    </div>
  );
}

function ResultStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p>
      <p className="mt-1 text-base font-black text-white">{value}</p>
    </div>
  );
}
