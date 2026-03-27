import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { PilotRouteView, PilotStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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

  const startShift = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.pilotShiftStart(playerId);
      setState(next);
      pushPopup('Pilot shift started. Select a route.');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Could not start pilot shift', true);
    } finally {
      setBusy(false);
    }
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

  const runFlightLifecycle = async (flightState: PilotStateResponse) => {
    const payload = await api.pilotFlightStart(playerId);
    setState(payload.state);

    const route = (payload.state.routes || []).find((entry) => entry.id === payload.flight.routeId) || null;
    if (!route) throw new Error('Route data missing');

    setOverlayRoute(route);
    setOverlayOpen(true);
    setOverlayStageIndex(0);
    setOverlayProgress(0);

    const stageCount = Math.max(1, route.stages.length);
    const stageDurationMs = Math.max(200, Math.floor((route.durationSeconds * 1000) / stageCount));

    for (let i = 0; i < stageCount; i += 1) {
      setOverlayStageIndex(i);
      setOverlayProgress(Math.floor(((i + 1) / stageCount) * 100));
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
      const next = await api.pilotRouteSelect(playerId, routeId);
      setState(next);
      pushPopup('Route selected. Flight starting...');
      await runFlightLifecycle(next);
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

  const progress = state?.progress;
  const displayName = useMemo(() => String(player?.displayName || player?.playerId || playerId), [player, playerId]);
  const selectedRoute = useMemo(() => (state?.routes || []).find((route) => route.id === state.selectedRouteId) || null, [state]);
  const canStartShift = state?.shiftState === 'IDLE';

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(42,148,255,0.16),_transparent_55%),linear-gradient(180deg,rgba(5,10,22,0.95),rgba(2,7,16,0.98))] px-4 py-6 md:py-8">
      {popup && (
        <div className={`fixed left-1/2 top-8 z-[85] -translate-x-1/2 rounded-xl border px-4 py-3 text-sm font-black shadow-xl backdrop-blur ${popup.isError ? 'border-red-500/40 bg-red-900/80 text-red-100' : 'border-sky-400/45 bg-sky-950/85 text-sky-100'}`}>
          {popup.text}
        </div>
      )}

      {overlayOpen && overlayRoute && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md">
          <div className="w-full max-w-3xl rounded-3xl border border-sky-400/35 bg-[linear-gradient(140deg,rgba(12,25,46,0.96),rgba(7,14,28,0.98))] p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-sky-200/70">Flight In Progress</p>
            <h2 className="mt-2 text-3xl font-black text-white">{overlayRoute.theme}</h2>
            <p className="mt-1 text-sm text-white/70">{overlayRoute.routePath}</p>

            <div className="mt-6 rounded-2xl border border-sky-400/25 bg-sky-900/20 p-6 text-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200/70">
                Stage {Math.min(overlayRoute.stages.length, overlayStageIndex + 1)} / {overlayRoute.stages.length}
              </p>
              <p className="mt-3 text-2xl font-black text-sky-100">{overlayRoute.stages[overlayStageIndex] || 'Preparing flight...'}</p>
            </div>

            <div className="mt-5">
              <div className="mb-1 flex justify-between text-xs font-bold uppercase tracking-wide text-white/60">
                <span>Route Progress</span>
                <span>{overlayProgress}%</span>
              </div>
              <div className="h-3 rounded-full bg-white/10">
                <div className="h-3 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300 transition-all" style={{ width: `${Math.max(0, Math.min(100, overlayProgress))}%` }} />
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => cancelFlight().catch(() => {})}
                disabled={busy}
                className="rounded-xl border border-red-500/40 bg-red-950/35 px-4 py-2 text-sm font-black text-red-100 disabled:opacity-50"
              >
                Cancel Flight
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-[1180px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Work</p>
          <h1 className="text-3xl font-black text-white">Pilot</h1>
          <p className="mt-1 text-sm text-white/60">{displayName} · Pilot Lv. {progress?.level ?? 1}</p>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Level" value={String(progress?.level ?? 1)} />
            <Stat label="XP" value={progress ? `${fmt(progress.xp)} / ${progress.nextLevelXp ? fmt(progress.nextLevelXp) : 'MAX'}` : '0'} />
            <Stat label="Current Streak" value={String(progress?.streak ?? 0)} />
            <Stat label="Total Flights" value={String(progress?.totalFlights ?? 0)} />
            <Stat label="Total Earnings" value={`${fmt(progress?.totalEarnings ?? 0)} $`} />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => startShift().catch(() => {})}
              disabled={busy || !canStartShift}
              className="btn-primary rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50"
            >
              Start Shift
            </button>
            <button
              type="button"
              onClick={() => endShift().catch(() => {})}
              disabled={busy || state?.shiftState === 'IDLE'}
              className="rounded-xl border border-red-500/35 bg-red-900/20 px-4 py-2 text-sm font-bold text-red-200 disabled:opacity-50"
            >
              End Shift
            </button>
          </div>
        </div>

        <div className="hud-panel p-5">
          <h2 className="text-lg font-black text-white">Route Selection</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {(state?.routes || []).map((route) => {
              const selected = route.id === state?.selectedRouteId;
              return (
                <button
                  key={route.id}
                  type="button"
                  onClick={() => selectRoute(route.id).catch(() => {})}
                  disabled={busy || route.locked || !!state?.activeFlight}
                  className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-sky-300/60 bg-sky-500/15' : 'border-white/15 bg-white/5 hover:bg-white/10'} disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black text-white">{route.name}</p>
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-black ${route.locked ? 'border-orange-400/40 bg-orange-500/15 text-orange-200' : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'}`}>
                      {route.locked ? 'Locked' : 'Available'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs uppercase tracking-[0.15em] text-sky-200/85">{route.theme}</p>
                  <p className="mt-2 text-xs text-white/75">{route.routePath}</p>
                  <p className="mt-2 text-xs text-white/70">Duration: {route.durationSeconds}s</p>
                  <p className="text-xs text-white/70">Base Reward: {fmt(route.baseReward)} $</p>
                  <p className="text-xs text-white/70">Base XP: {route.baseXp}</p>
                  <p className="text-xs text-white/70">Progress: {route.progressLabel}</p>
                  {route.lockReasons.map((reason) => (
                    <p key={`${route.id}-${reason}`} className="mt-1 text-xs font-bold text-orange-200">
                      {reason}
                    </p>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        {state?.lastResult && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Flight Result</h2>
            {state.lastResult.completed ? (
              <p className="mt-2 text-sm text-emerald-200">Route completed successfully.</p>
            ) : (
              <p className="mt-2 text-sm text-red-200">{state.lastResult.failReason || 'Flight not completed.'}</p>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Summary label="Base Reward" value={`${fmt(state.lastResult.breakdown.baseReward)} $`} />
              <Summary label="Level Bonus" value={`${fmt(state.lastResult.breakdown.levelBonus)} $`} />
              <Summary label="Streak Bonus" value={`${fmt(state.lastResult.breakdown.streakBonus)} $`} />
              <Summary label="Milestone Bonus" value={`${fmt(state.lastResult.breakdown.milestoneBonus)} $`} />
              <Summary label="First Completion Bonus" value={`${fmt(state.lastResult.breakdown.firstCompletionBonus)} $`} />
              <Summary label="Total Cash" value={`${fmt(state.lastResult.breakdown.totalCash)} $`} />
              <Summary label="Base XP" value={`${state.lastResult.breakdown.baseXp}`} />
              <Summary label="Streak XP Bonus" value={`${state.lastResult.breakdown.streakXpBonus}`} />
              <Summary label="Milestone XP Bonus" value={`${state.lastResult.breakdown.milestoneXpBonus}`} />
              <Summary label="First Completion XP" value={`${state.lastResult.breakdown.firstCompletionXpBonus}`} />
              <Summary label="Total XP" value={`${state.lastResult.breakdown.totalXp}`} />
            </div>

            {state.lastResult.progression.milestoneLabel && (
              <p className="mt-3 text-sm font-black text-[#ffd95a]">{state.lastResult.progression.milestoneLabel}</p>
            )}
            {state.lastResult.progression.newlyUnlockedRouteIds.length > 0 && (
              <p className="text-sm font-black text-cyan-200">New Route Unlocked</p>
            )}
            {state.lastResult.progression.promotionLabel && (
              <p className="text-sm font-black text-emerald-200">{state.lastResult.progression.promotionLabel}</p>
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
