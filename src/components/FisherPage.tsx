import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { FisherSpotOption, FisherStateResponse } from '../types/game';

type Popup = { text: string; isError?: boolean } | null;

const STEP_ORDER = ['BAIT', 'CAST', 'WAIT_BITE', 'HOOK', 'REEL', 'LAND'];

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
  const [castMeter, setCastMeter] = useState(0);
  const [castDir, setCastDir] = useState(1);
  const lastOptionsFetchRef = useRef(0);

  const pushPopup = useCallback((text: string, isError = false) => {
    setPopup({ text, isError });
    window.setTimeout(() => setPopup(null), 2800);
  }, []);

  const underRepair = Number(state?.repairSecondsLeft || 0) > 0;
  const canSelectSpot = state?.shiftState === 'SELECTING_SPOT';

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

  useEffect(() => {
    if (state?.shiftState !== 'CAST_STEP') return;
    const meter = window.setInterval(() => {
      setCastMeter((current) => {
        let next = current + castDir * 4;
        if (next >= 100) {
          next = 100;
          setCastDir(-1);
        } else if (next <= 0) {
          next = 0;
          setCastDir(1);
        }
        return next;
      });
    }, 30);
    return () => window.clearInterval(meter);
  }, [state?.shiftState, castDir]);

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
      pushPopup('Traveling to fishing spot...');
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Spot select failed', true);
    } finally {
      setBusy(false);
    }
  };

  const doBait = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Putting bait on hook...');
      await wait(900);
      const next = await api.fisherStep(playerId, 'BAIT');
      setState(next);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Bait step failed', true);
    } finally {
      setBusy(false);
    }
  };

  const commitCast = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Casting line...');
      await wait(900);
      const next = await api.fisherCastCommit(playerId, castMeter);
      setState(next);
      if (next.activeCatch?.castQuality) {
        pushPopup(`Cast quality: ${next.activeCatch.castQuality}`);
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Cast failed', true);
    } finally {
      setBusy(false);
    }
  };

  const hookNow = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Hooking fish...');
      await wait(850);
      const next = await api.fisherHookAttempt(playerId);
      setState(next);
      if (next.activeCatch?.hookQuality) {
        pushPopup(`Hook quality: ${next.activeCatch.hookQuality}`);
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Hook failed', true);
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  const reelTick = async (isReeling: boolean) => {
    if (busy || underRepair || state?.shiftState !== 'REELING') return;
    setBusy(true);
    try {
      const next = await api.fisherReelTick(playerId, isReeling);
      setState(next);
      if (next.activeCatch?.tension && next.activeCatch.tension >= 88) {
        pushPopup('Tension high!', true);
      }
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Reel action failed', true);
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  const respondPull = async (direction: 'LEFT' | 'RIGHT') => {
    if (busy) return;
    setBusy(true);
    try {
      const next = await api.fisherPullRespond(playerId, direction);
      setState(next);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Pull response failed', true);
    } finally {
      setBusy(false);
    }
  };

  const landCatch = async () => {
    if (busy) return;
    setBusy(true);
    try {
      pushPopup('Landing catch...');
      await wait(950);
      const payload = await api.fisherLand(playerId);
      setState(payload.state);
      refresh();
      if (payload.result.caught) {
        const messages = [`Catch landed: ${payload.result.fishName} (+${fmt(payload.result.breakdown.totalReward)} $ / +${payload.result.breakdown.xpGained} XP)`];
        if (payload.result.progression.levelAfter > payload.result.progression.levelBefore) {
          messages.push(`Congrats! Fisher Lv. ${payload.result.progression.levelAfter}.`);
        }
        if (payload.result.progression.unlockedTier) {
          messages.push(`Unlocked tier: ${payload.result.progression.unlockedTier}.`);
        }
        pushPopup(messages.join(' '));
      } else {
        pushPopup(payload.result.failReason || 'Catch failed', true);
      }
      window.setTimeout(() => {
        api
          .fisherSpotOptions(playerId)
          .then((data) => setOptions(data.options || []))
          .catch(() => {});
      }, 600);
    } catch (e) {
      pushPopup(e instanceof Error ? e.message : 'Land failed', true);
      await loadState();
    } finally {
      setBusy(false);
    }
  };

  const active = state?.activeCatch;
  const displayName = useMemo(() => String(player?.displayName || player?.playerId || playerId), [player, playerId]);

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      {popup && (
        <div className={`fixed right-4 top-6 z-[80] max-w-md rounded-xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur ${popup.isError ? 'border-red-500/40 bg-red-900/80 text-red-200' : 'border-green-500/40 bg-green-900/80 text-green-200'}`}>
          {popup.text}
        </div>
      )}

      <div className="mx-auto max-w-[1100px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Work</p>
          <h1 className="text-3xl font-black text-white">Fisher / Pescar</h1>
          <p className="mt-1 text-sm text-white/60">{displayName} · Fisher Lv. {state?.progress.level ?? 1}</p>

          {underRepair && (
            <p className="mt-2 rounded-lg border border-orange-400/50 bg-orange-900/25 px-3 py-2 text-xs font-black uppercase tracking-wide text-orange-200">
              {state?.repairLabel || 'Repairing line'} · {state?.repairSecondsLeft}s
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
            <Stat label="Level" value={String(state?.progress.level ?? 1)} />
            <Stat label="XP" value={state?.progress ? `${fmt(state.progress.xp)} / ${state.progress.nextLevelXp ? fmt(state.progress.nextLevelXp) : 'MAX'}` : '0'} />
            <Stat label="Rod" value={state?.progress.rodTierLabel || 'Basic Rod'} />
            <Stat label="Spot Tier" value={state?.progress.unlockedSpotTier || 'COMMON'} />
            <Stat label="Streak" value={String(state?.streak ?? 0)} />
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
          </div>
        </div>

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

        {state?.shiftState !== 'IDLE' && active && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Active Catch · {active.spotName}</h2>
            <p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#ffe48e]">
              Steps: {STEP_ORDER.join(' -> ')}
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
              <Stat label="State" value={String(state?.shiftState || '')} />
              <Stat label="Progress" value={`${Math.floor(active.catchProgress)}%`} />
              <Stat label="Tension" value={`${Math.floor(active.tension)}%`} />
              <Stat label="Integrity" value={`${Math.floor(active.lineIntegrity)}%`} />
              <Stat label="Bite In" value={`${active.waitBiteLeftSec}s`} />
            </div>

            {state.shiftState === 'TRAVEL_TO_SPOT' && (
              <p className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-900/20 px-4 py-3 text-sm font-bold text-cyan-100">
                Traveling to spot... {active.travelLeftSec}s
              </p>
            )}

            {(state.shiftState === 'BAIT_STEP' || state.shiftState === 'CAST_STEP' || state.shiftState === 'WAITING_BITE' || state.shiftState === 'HOOK_WINDOW' || state.shiftState === 'REELING' || state.shiftState === 'LANDING') && (
              <div className="mt-4 grid gap-2 sm:grid-cols-3">
                {STEP_ORDER.map((step) => {
                  const done = active.stepsDone.includes(step);
                  const isNext = !done && active.nextStep === step;
                  return (
                    <div
                      key={step}
                      className={`rounded-xl border px-4 py-3 text-sm font-bold ${done ? 'border-green-500/45 bg-green-900/30 text-green-200' : isNext ? 'border-yellow-400/60 bg-yellow-500/20 text-yellow-100' : 'border-white/20 bg-white/5 text-white/80'}`}
                    >
                      {done ? `Done: ${step}` : isNext ? `Next: ${step}` : step}
                    </div>
                  );
                })}
              </div>
            )}

            {state.shiftState === 'BAIT_STEP' && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => doBait().catch(() => {})}
                  disabled={busy || underRepair}
                  className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 px-4 py-3 text-sm font-bold text-emerald-100 disabled:opacity-60"
                >
                  Confirm Bait
                </button>
              </div>
            )}

            {state.shiftState === 'CAST_STEP' && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-bold text-white/80">Cast Power Meter (click in yellow zone)</p>
                <div className="relative h-4 rounded-full bg-white/10">
                  <div className="absolute inset-y-0 left-[62%] w-[16%] rounded-full bg-yellow-400/35" />
                  <div className="absolute inset-y-0 w-2 -translate-x-1/2 rounded-full bg-white" style={{ left: `${castMeter}%` }} />
                </div>
                <button
                  type="button"
                  onClick={() => commitCast().catch(() => {})}
                  disabled={busy || underRepair}
                  className="rounded-xl border border-yellow-500/45 bg-yellow-900/25 px-4 py-3 text-sm font-bold text-yellow-100 disabled:opacity-60"
                >
                  Lock Cast ({Math.floor(castMeter)}%)
                </button>
              </div>
            )}

            {state.shiftState === 'WAITING_BITE' && (
              <p className="mt-4 rounded-xl border border-cyan-500/40 bg-cyan-900/20 px-4 py-3 text-sm font-bold text-cyan-100">
                Waiting for bite... {active.waitBiteLeftSec}s
              </p>
            )}

            {state.shiftState === 'HOOK_WINDOW' && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-bold text-red-200">Fish bite! Hook now ({Math.floor(active.hookWindowLeftMs)}ms)</p>
                <button
                  type="button"
                  onClick={() => hookNow().catch(() => {})}
                  disabled={busy || underRepair}
                  className="rounded-xl border border-red-500/45 bg-red-900/20 px-4 py-3 text-sm font-bold text-red-100 disabled:opacity-60"
                >
                  Hook!
                </button>
              </div>
            )}

            {state.shiftState === 'REELING' && (
              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase text-white/60">Catch Progress</p>
                  <div className="mt-1 h-3 rounded-full bg-white/10">
                    <div className="h-3 rounded-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, active.catchProgress))}%` }} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-white/60">Tension</p>
                  <div className="mt-1 h-3 rounded-full bg-white/10">
                    <div
                      className={`h-3 rounded-full ${active.tension >= 88 ? 'bg-red-500' : active.tension >= 70 ? 'bg-yellow-400' : 'bg-cyan-400'}`}
                      style={{ width: `${Math.max(0, Math.min(100, active.tension))}%` }}
                    />
                  </div>
                </div>
                {active.pullPrompt && (
                  <div className="rounded-xl border border-orange-500/40 bg-orange-900/25 px-4 py-3">
                    <p className="text-sm font-black text-orange-100">Fish Pull {active.pullPrompt.direction}! React now.</p>
                    <p className="text-xs text-orange-200">{Math.floor(active.pullPrompt.expiresInMs)}ms</p>
                    <div className="mt-2 flex gap-2">
                      <button type="button" onClick={() => respondPull('LEFT').catch(() => {})} disabled={busy} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Left</button>
                      <button type="button" onClick={() => respondPull('RIGHT').catch(() => {})} disabled={busy} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Right</button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => reelTick(true).catch(() => {})} disabled={busy || underRepair} className="rounded-xl border border-emerald-500/40 bg-emerald-900/20 px-4 py-3 text-sm font-bold text-emerald-100 disabled:opacity-60">Reel</button>
                  <button type="button" onClick={() => reelTick(false).catch(() => {})} disabled={busy || underRepair} className="rounded-xl border border-sky-500/40 bg-sky-900/20 px-4 py-3 text-sm font-bold text-sky-100 disabled:opacity-60">Release</button>
                </div>
              </div>
            )}

            {state.shiftState === 'LANDING' && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => landCatch().catch(() => {})}
                  disabled={busy || underRepair}
                  className="rounded-xl border border-[#ffd95a]/35 bg-[#ffd95a]/10 px-4 py-3 text-sm font-bold text-[#ffe7a4] hover:bg-[#ffd95a]/20 disabled:opacity-60"
                >
                  Land Catch
                </button>
              </div>
            )}
          </div>
        )}

        {state?.lastResult && (
          <div className="hud-panel p-5">
            <h2 className="text-lg font-black text-white">Last Catch Result</h2>
            {state.lastResult.caught ? (
              <p className="mt-2 text-sm text-white/80">{state.lastResult.fishName} · {state.lastResult.fishRarity}</p>
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
