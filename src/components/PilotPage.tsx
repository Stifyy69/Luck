import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { PilotRouteView, PilotStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const ROUTE_ART: Record<string, string> = {
  ROUTE_1: '/jobs/pilot/route-1-skydivers.svg',
  ROUTE_2: '/jobs/pilot/route-2-fertilizer.svg',
  ROUTE_3: '/jobs/pilot/route-3-military.svg',
  ROUTE_4: '/jobs/pilot/route-4-passenger.svg',
  ROUTE_5: '/jobs/pilot/route-5-nasa.svg',
};

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

function routeTone(route: PilotRouteView) {
  if (route.locked) return 'border-white/[0.07] bg-black/20';
  if (route.completions >= Math.max(1, route.progressionCompletions)) {
    return 'border-[rgba(114,227,154,0.22)] bg-[rgba(114,227,154,0.045)]';
  }
  return 'border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.035)]';
}

export default function PilotPage() {
  const { playerId, player, refresh } = usePlayer();
  const [state, setState] = useState<PilotStateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayRoute, setOverlayRoute] = useState<PilotRouteView | null>(null);
  const [overlayStageIndex, setOverlayStageIndex] = useState(0);
  const [overlayProgress, setOverlayProgress] = useState(0);
  const routesRef = useRef<HTMLElement | null>(null);

  const pushPopup = useCallback((text: string, isError = false) => {
    setPopup({ text, isError });
    window.setTimeout(() => setPopup(null), 2400);
  }, []);

  const loadState = useCallback(async () => {
    try {
      const next = await api.pilotState(playerId);
      setState(next);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Failed to load pilot state', true);
    }
  }, [playerId, pushPopup]);

  useEffect(() => {
    loadState().catch(() => {});
  }, [loadState]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!state) return;
      if (state.shiftState !== 'IDLE') {
        loadState().catch(() => {});
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [state, loadState]);

  const progress = state?.progress;
  const displayName = useMemo(() => String(player?.displayName || player?.playerId || playerId), [player, playerId]);
  const canStartShift = state?.shiftState === 'IDLE';

  const xpPercent = useMemo(() => {
    if (!progress) return 0;
    if (!progress.nextLevelXp) return 100;
    return clampPercent((Number(progress.currentLevelXp || 0) / Math.max(1, Number(progress.nextLevelXp || 1))) * 100);
  }, [progress]);

  const scrollToRoutes = useCallback(() => {
    window.setTimeout(() => {
      routesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }, []);

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pilotShiftStart(playerId);
      setState(next);
      pushPopup('Pilot shift started. Select a route.');
      scrollToRoutes();
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start pilot shift', true);
    } finally {
      setBusy(false);
    }
  };

  const chooseRoute = async () => {
    if (canStartShift) {
      await startShift();
      return;
    }
    scrollToRoutes();
  };

  const endShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pilotShiftEnd(playerId);
      setState(next);
      setOverlayOpen(false);
      setOverlayRoute(null);
      setOverlayStageIndex(0);
      setOverlayProgress(0);
      pushPopup('Pilot shift ended.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not end pilot shift', true);
    } finally {
      setBusy(false);
    }
  };

  const runFlightLifecycle = async () => {
    let payload;
    try {
      payload = await api.pilotFlightStart(playerId);
    } catch (startError) {
      const message = startError instanceof Error ? startError.message.toLowerCase() : '';
      if (!message.includes('wait 0.5s between actions')) throw startError;
      await wait(600);
      payload = await api.pilotFlightStart(playerId);
    }
    setState(payload.state);

    const route = (payload.state.routes || []).find((entry: PilotRouteView) => entry.id === payload.flight.routeId) || null;
    if (!route) throw new Error('Route data missing');

    setOverlayRoute(route);
    setOverlayOpen(true);
    setOverlayStageIndex(0);
    setOverlayProgress(0);

    const stageCount = Math.max(1, route.stages.length);
    const stageDurationMs = Math.max(200, Math.floor((route.durationSeconds * 1000) / stageCount));

    for (let index = 0; index < stageCount; index += 1) {
      setOverlayStageIndex(index);
      setOverlayProgress(Math.floor(((index + 1) / stageCount) * 100));
      await wait(stageDurationMs);
    }

    await wait(500);
    const finished = await api.pilotFlightComplete(playerId);
    setState(finished.state);
    await refresh();
    setOverlayOpen(false);
    setOverlayRoute(null);
    setOverlayStageIndex(0);
    setOverlayProgress(0);

    if (finished.result?.completed) {
      pushPopup(`Flight completed. +${fmt(finished.result.breakdown.totalCash)} $ / +${finished.result.breakdown.totalXp} XP`);
    }
  };

  const selectRoute = async (routeId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      let next: PilotStateResponse;
      try {
        next = await api.pilotRouteSelect(playerId, routeId);
      } catch (innerError) {
        const message = innerError instanceof Error ? innerError.message.toLowerCase() : '';
        if (!message.includes('shift not active')) throw innerError;
        const started = await api.pilotShiftStart(playerId);
        setState(started);
        next = await api.pilotRouteSelect(playerId, routeId);
      }

      setState(next);
      pushPopup('Route selected. Flight starting...');
      await runFlightLifecycle();
    } catch (e) {
      setOverlayOpen(false);
      setOverlayRoute(null);
      setOverlayStageIndex(0);
      setOverlayProgress(0);
      pushPopup(e instanceof Error ? e.message : 'Route selection failed', true);
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  const cancelFlight = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const payload = await api.pilotFlightCancel(playerId);
      setState(payload.state);
      setOverlayOpen(false);
      setOverlayRoute(null);
      setOverlayStageIndex(0);
      setOverlayProgress(0);
      pushPopup('Flight cancelled. Streak reset.', true);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Cancel flight failed', true);
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

      {overlayOpen && overlayRoute && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 px-4 backdrop-blur-md">
          <div className="game-panel w-full max-w-4xl overflow-hidden p-5 sm:p-7">
            <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div className="flex h-[240px] items-center justify-center rounded-[22px] border border-white/[0.08] bg-[#090c09] p-4">
                <img src={ROUTE_ART[overlayRoute.id]} alt={overlayRoute.theme} className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="section-kicker">Flight in progress</p>
                <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">{overlayRoute.theme}</h2>
                <p className="mt-2 text-sm text-white/42">{overlayRoute.routePath}</p>

                <div className="mt-6 rounded-[20px] border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.055)] p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-[var(--accent)]">Stage {Math.min(overlayRoute.stages.length, overlayStageIndex + 1)} / {overlayRoute.stages.length}</p>
                  <p className="mt-2 text-xl font-black text-white">{overlayRoute.stages[overlayStageIndex] || 'Preparing flight...'}</p>
                </div>

                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="font-bold text-white/40">Route progress</span>
                    <span className="font-black text-[var(--accent)]">{overlayProgress}%</span>
                  </div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${clampPercent(overlayProgress)}%` }} /></div>
                </div>

                <button type="button" onClick={() => cancelFlight().catch(() => {})} disabled={busy} className="btn-danger mt-6 rounded-2xl px-5 py-3 text-sm disabled:opacity-40">Cancel flight</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden px-5 py-10 text-center sm:px-8 sm:py-12">
          <div className="pointer-events-none absolute left-1/2 top-[-190px] h-[380px] w-[560px] -translate-x-1/2 rounded-full bg-[var(--info)] opacity-[0.065] blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <p className="section-kicker">Pilot career</p>
            <h1 className="display-title mt-5">Choose your next flight.</h1>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/45">Build route mastery, unlock larger aircraft missions and grow your pilot streak across the city.</p>
            <button type="button" onClick={() => chooseRoute().catch(() => {})} disabled={busy || !!state?.activeFlight} className="btn-primary mt-7 min-w-[220px] rounded-2xl px-6 py-3.5 text-sm disabled:opacity-35">
              {canStartShift ? 'Start pilot shift' : 'View flight routes'}
            </button>

            <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-5">
              <HeroStat label="Pilot" value={displayName} />
              <HeroStat label="Level" value={String(progress?.level ?? 1)} />
              <HeroStat label="Streak" value={String(progress?.streak ?? 0)} />
              <HeroStat label="Flights" value={String(progress?.totalFlights ?? 0)} />
              <HeroStat label="Earnings" value={`${fmt(progress?.totalEarnings ?? 0)} $`} money />
            </div>

            <div className="mx-auto mt-5 max-w-xl">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/38">Pilot level progress</span><span className="font-black text-white">{progress ? `${fmt(progress.xp)} XP` : '0 XP'}</span></div>
              <div className="progress-track"><div className="progress-fill" style={{ width: `${xpPercent}%` }} /></div>
            </div>
          </div>
        </section>

        <section ref={routesRef} className="game-panel-soft scroll-mt-24 p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="section-kicker">Flight board</p>
              <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Available routes</h2>
              <p className="mt-2 text-sm text-white/38">Every route is a progression card with its own aircraft mission, payout and unlock requirements.</p>
            </div>
            {!canStartShift && <button type="button" onClick={() => endShift().catch(() => {})} disabled={busy} className="btn-danger rounded-2xl px-4 py-2.5 text-xs disabled:opacity-35">End shift</button>}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(state?.routes || []).map((route) => {
              const target = Math.max(1, Number(route.progressionCompletions || 0));
              const completed = Number(route.completions || 0) >= target;
              return (
                <article key={route.id} className={`overflow-hidden rounded-[22px] border p-4 ${routeTone(route)}`}>
                  <div className="relative flex h-[190px] items-center justify-center overflow-hidden rounded-[18px] border border-white/[0.08] bg-[#090c09] p-3">
                    <img src={ROUTE_ART[route.id]} alt={route.theme} className={`h-full w-full object-contain ${route.locked ? 'grayscale opacity-35' : ''}`} />
                    <span className={`absolute right-3 top-3 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] ${route.locked ? 'border-white/[0.1] bg-black/60 text-white/40' : completed ? 'border-[rgba(114,227,154,0.3)] bg-[#102018]/90 text-[var(--money)]' : 'border-[rgba(211,255,81,0.3)] bg-[#141b0f]/90 text-[var(--accent)]'}`}>
                      {route.locked ? 'Locked' : completed ? 'Completed' : 'Available'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/26">{route.name}</p>
                      <h3 className="mt-1 text-xl font-black text-white">{route.theme}</h3>
                    </div>
                    <p className="text-right text-sm font-black text-[var(--money)]">{fmt(route.baseReward)} $<span className="block text-xs text-[var(--accent)]">+{route.baseXp} XP</span></p>
                  </div>

                  <p className="mt-3 min-h-[40px] text-xs leading-relaxed text-white/42">{route.routePath}</p>

                  <div className="mt-4 grid grid-cols-3 gap-2 border-y border-white/[0.065] py-4">
                    <RouteStat label="Level" value={String(route.unlockLevel)} />
                    <RouteStat label="Progress" value={route.progressLabel} />
                    <RouteStat label="Stages" value={String(route.stages.length)} />
                  </div>

                  {route.lockReasons.length > 0 && <p className="mt-3 text-xs font-bold text-[var(--warning)]">{route.lockReasons[0]}</p>}

                  <button type="button" onClick={() => selectRoute(route.id).catch(() => {})} disabled={busy || route.locked || !!state?.activeFlight} className="btn-secondary mt-5 w-full rounded-2xl px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-35">
                    {route.locked ? `Unlock at level ${route.unlockLevel}` : 'Start this flight'}
                  </button>
                </article>
              );
            })}
          </div>
        </section>

        {state?.lastResult && (
          <section className="game-panel overflow-hidden">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="border-b border-white/[0.07] bg-black/20 p-6 sm:p-7 lg:border-b-0 lg:border-r">
                <p className="section-kicker">Flight report</p>
                <p className={`mt-4 text-sm font-black uppercase tracking-[0.14em] ${state.lastResult.completed ? 'text-[var(--money)]' : 'text-[var(--danger)]'}`}>{state.lastResult.completed ? 'Route completed' : state.lastResult.failReason || 'Flight failed'}</p>
                <p className="mt-4 text-5xl font-black tracking-[-0.055em] text-[var(--money)]">+{fmt(state.lastResult.breakdown.totalCash)} $</p>
                <p className="mt-2 text-lg font-black text-[var(--accent)]">+{state.lastResult.breakdown.totalXp} XP</p>
                {state.lastResult.progression.promotionLabel && <p className="mt-4 text-sm font-black text-white">{state.lastResult.progression.promotionLabel}</p>}
              </div>
              <div className="p-6 sm:p-7">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Performance factors</p>
                <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Flight reward breakdown</h3>
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <Summary label="Base reward" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} />
                  <Summary label="Level bonus" value={`${fmt(state.lastResult.breakdown.levelBonus)} $`} />
                  <Summary label="Streak bonus" value={`${fmt(state.lastResult.breakdown.streakBonus)} $`} />
                  <Summary label="Milestone" value={`${fmt(state.lastResult.breakdown.milestoneBonus)} $`} />
                  <Summary label="First completion" value={`${fmt(state.lastResult.breakdown.firstCompletionBonus)} $`} />
                  <Summary label="Total XP" value={String(state.lastResult.breakdown.totalXp)} />
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
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p><p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}

function RouteStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 text-center"><p className="text-[9px] font-black uppercase tracking-[0.12em] text-white/24">{label}</p><p className="mt-1 truncate text-xs font-black text-white">{value}</p></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[17px] border border-white/[0.07] bg-black/20 p-4"><p className="text-[9px] font-black uppercase tracking-[0.13em] text-white/25">{label}</p><p className="mt-1 text-base font-black text-white">{value}</p></div>;
}
