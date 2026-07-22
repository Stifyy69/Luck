import { useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { SleepState } from '../types/game';

function fmt(value: number) {
  return value.toLocaleString('en-US');
}

export default function SleepPage() {
  const { player, playerId, refresh } = usePlayer();
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);
  const [runBoostMultiplier, setRunBoostMultiplier] = useState(1);
  const [serverState, setServerState] = useState<SleepState | null>(null);
  const claimingRef = useRef(false);
  const lastClaimAttemptRef = useRef(0);
  const claimOperationRef = useRef<string | null>(null);

  const sleepBoostItem = player?.inventory.find((item) => item.itemType === 'JOB_BOOST_SLEEP' && item.quantity > 0) ?? null;
  const sleepBoostCount = sleepBoostItem?.quantity ?? 0;

  const operationId = (prefix: string) => {
    const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    return `${prefix}_${suffix}`;
  };

  useEffect(() => {
    let cancelled = false;
    api.sleepState(playerId)
      .then((payload) => {
        if (cancelled) return;
        setServerState(payload.state);
        claimOperationRef.current = payload.state.activeCycleId ? `sleep_claim_${payload.state.activeCycleId}`.slice(0, 100) : null;
      })
      .catch((error) => { if (!cancelled) setPopup(error instanceof Error ? error.message : 'Sleep state failed.'); });
    return () => { cancelled = true; };
  }, [playerId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      const now = Date.now();
      const sleepEndsAt = serverState?.sleepEndsAt ? new Date(serverState.sleepEndsAt).getTime() : 0;
      const sleepCooldownUntil = serverState?.cooldownUntil ? new Date(serverState.cooldownUntil).getTime() : 0;

      if (sleepEndsAt > now) {
        setTimer(Math.ceil((sleepEndsAt - now) / 1000));
        setRunBoostMultiplier(Number(serverState?.multiplier ?? 1));
      } else {
        setTimer(0);
        setRunBoostMultiplier(Number(serverState?.multiplier ?? 1));
      }

      if (sleepCooldownUntil > now) {
        setCooldown(Math.ceil((sleepCooldownUntil - now) / 1000));
      } else {
        setCooldown(0);
      }

      if (serverState?.activeCycleId && sleepEndsAt > 0 && sleepEndsAt <= now && !claimingRef.current && now - lastClaimAttemptRef.current >= 3000) {
        claimingRef.current = true;
        lastClaimAttemptRef.current = now;
        const claimOperationId = claimOperationRef.current || `sleep_claim_${serverState.activeCycleId}`.slice(0, 100);
        claimOperationRef.current = claimOperationId;
        api.sleepClaim(playerId, claimOperationId)
          .then((result) => {
            setServerState(result.state);
            claimOperationRef.current = null;
            setPopup(`Recovery completed. +${fmt(Number(result.reward || 0))} clean money. 30s cooldown.`);
            window.setTimeout(() => setPopup(null), 2500);
            refresh();
          })
          .catch((error) => setPopup(error instanceof Error ? error.message : 'Reward claim failed. It will retry.'))
          .finally(() => { claimingRef.current = false; });
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, [playerId, refresh, serverState]);

  const startSleep = async () => {
    try {
      const result = await api.sleepStart(playerId, operationId('sleep_start'));
      setServerState(result.state);
      claimOperationRef.current = result.state.activeCycleId ? `sleep_claim_${result.state.activeCycleId}`.slice(0, 100) : null;
      setRunBoostMultiplier(result.state.multiplier);
      if (result.jobBoostUsed) {
        setPopup(`Recovery Boost consumed. Active multiplier x${result.state.multiplier}.`);
        window.setTimeout(() => setPopup(null), 1800);
      }
      refresh();
    } catch (error) {
      setPopup(error instanceof Error ? error.message : 'Could not start recovery.');
    }
  };

  const isSleeping = timer > 0;
  const cycleProgress = useMemo(() => {
    if (!isSleeping) return 0;
    return Math.max(0, Math.min(100, ((3 - timer) / 3) * 100));
  }, [isSleeping, timer]);
  const projectedReward = serverState?.projectedReward || 300_000 * (sleepBoostCount > 0 ? 2 : 1);

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      {popup && !isSleeping && (
        <div className="animate-toast-in fixed left-1/2 top-4 z-[140] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-[rgba(211,255,81,0.24)] bg-[#11170d]/95 px-4 py-3 text-sm font-bold text-[#edffc0] shadow-2xl backdrop-blur-xl md:top-6">
          {popup}
        </div>
      )}

      <div className="mx-auto max-w-[1120px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-20 -top-28 h-[390px] w-[390px] rounded-full bg-[var(--accent)] opacity-[0.055] blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="section-kicker">Recovery cycle</p>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.13em] ${isSleeping ? 'border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.07)] text-[var(--accent)]' : cooldown > 0 ? 'border-[rgba(240,196,106,0.25)] bg-[rgba(240,196,106,0.07)] text-[var(--warning)]' : 'border-white/[0.1] bg-white/[0.035] text-white/48'}`}>
                  {isSleeping ? 'Cycle active' : cooldown > 0 ? 'Cooling down' : 'Ready'}
                </span>
              </div>

              <h1 className="display-title mt-5">Step away.<br /><span className="text-white/32">Return funded.</span></h1>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/45">
                Run a short recovery cycle, consume an available boost automatically and collect clean money when the cycle finishes.
              </p>

              <button
                type="button"
                onClick={() => { startSleep().catch(() => {}); }}
                disabled={isSleeping || cooldown > 0}
                className="btn-primary mt-7 min-w-[210px] rounded-2xl px-6 py-3.5 text-sm disabled:cursor-not-allowed disabled:opacity-35"
              >
                {isSleeping ? `Recovering... ${timer}s` : cooldown > 0 ? `Available in ${cooldown}s` : 'Start recovery cycle'}
              </button>

              <div className="mt-7 grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-4">
                <HeroStat label="Base reward" value="300,000 $" money />
                <HeroStat label="Ready boosts" value={`x${sleepBoostCount}`} />
                <HeroStat label="Next multiplier" value={`x${sleepBoostCount > 0 ? 2 : 1}`} />
                <HeroStat label="Projected" value={`${fmt(projectedReward)} $`} money />
              </div>
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-black/20 p-4">
              <div className="flex h-[285px] items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#090c09] p-4">
                <img src="/jobs/sleep/recovery-bed.svg" alt="Recovery bed" className="h-full w-full object-contain" />
              </div>
              <div className="mt-4 flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/27">Recovery suite</p>
                  <p className="mt-1 text-xl font-black text-white">Private Rest Unit</p>
                  <p className="mt-1 text-xs text-white/38">3 second cycle · 30 second cooldown</p>
                </div>
                <span className="rounded-full border border-[rgba(211,255,81,0.25)] bg-[rgba(211,255,81,0.07)] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">Owned</span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <InfoCard title="Automatic boost" body="If a Recovery Boost is in your inventory, one item is consumed when the cycle starts." value={`x${sleepBoostCount}`} />
          <InfoCard title="Active multiplier" body="The multiplier is locked for the current cycle and applied to the final cash reward." value={`x${runBoostMultiplier}`} accent />
          <InfoCard title="Cooldown" body="A completed cycle starts a short cooldown before recovery becomes available again." value={`${cooldown}s`} />
        </section>
      </div>

      {isSleeping && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="game-panel w-full max-w-3xl p-5 sm:p-7">
            <div className="grid gap-6 sm:grid-cols-[0.85fr_1.15fr] sm:items-center">
              <div className="flex h-[210px] items-center justify-center rounded-[20px] border border-white/[0.08] bg-[#090c09] p-3">
                <img src="/jobs/sleep/recovery-bed.svg" alt="Recovery in progress" className="h-full w-full object-contain" />
              </div>
              <div>
                <p className="section-kicker">Recovery active</p>
                <h2 className="mt-2 text-4xl font-black tracking-[-0.05em] text-white">Rest cycle in progress</h2>
                <p className="mt-2 text-sm text-white/42">Reward multiplier locked at x{runBoostMultiplier}.</p>
                <div className="mt-6">
                  <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold text-white/40">Cycle progress</span><span className="font-black text-[var(--accent)]">{timer}s</span></div>
                  <div className="progress-track"><div className="progress-fill" style={{ width: `${cycleProgress}%` }} /></div>
                </div>
                <p className="mt-5 text-2xl font-black text-[var(--money)]">+{fmt(300_000 * runBoostMultiplier)} $</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HeroStat({ label, value, money = false }: { label: string; value: string; money?: boolean }) {
  return <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/25">{label}</p><p className={`mt-1 truncate text-sm font-black ${money ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p></div>;
}

function InfoCard({ title, body, value, accent = false }: { title: string; body: string; value: string; accent?: boolean }) {
  return (
    <article className="game-card p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/27">Recovery system</p><h3 className="mt-1 text-lg font-black text-white">{title}</h3></div><p className={`text-lg font-black ${accent ? 'text-[var(--accent)]' : 'text-white'}`}>{value}</p></div>
      <p className="mt-3 text-xs leading-relaxed text-white/42">{body}</p>
    </article>
  );
}
