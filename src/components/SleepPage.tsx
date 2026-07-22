import { useEffect, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return String(hash);
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveGameState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

export default function SleepPage() {
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);

  const syncFromStorage = () => {
    const latest = loadGameState() || {};
    const now = Date.now();
    const sleepEndsAt = latest.sleepEndsAt ?? 0;
    const sleepCooldownUntil = latest.sleepCooldownUntil ?? 0;

    setTimer(Math.max(0, Math.ceil((sleepEndsAt - now) / 1000)));
    setCooldown(Math.max(0, Math.ceil((sleepCooldownUntil - now) / 1000)));
  };

  useEffect(() => {
    syncFromStorage();
    const interval = window.setInterval(() => {
      const latest = loadGameState() || {};
      const now = Date.now();

      const sleepEndsAt = latest.sleepEndsAt ?? 0;
      const sleepCooldownUntil = latest.sleepCooldownUntil ?? 0;

      if (sleepEndsAt > now) {
        setTimer(Math.ceil((sleepEndsAt - now) / 1000));
      } else {
        setTimer(0);
      }

      if (sleepCooldownUntil > now) {
        setCooldown(Math.ceil((sleepCooldownUntil - now) / 1000));
      } else {
        setCooldown(0);
      }

      if (sleepEndsAt > 0 && sleepEndsAt <= now && !latest.sleepRewardClaimed) {
        const nextCash = (latest.cashBalance ?? 1_000_000) + 300_000;
        const nextSleepTime = (latest.timeSleep ?? 0) + 24;
        const nextCooldownUntil = now + 30_000;
        const nextSleepCount = (latest.sleepCount ?? 0) + 1;
        const nextSleepMoney = (latest.sleepMoney ?? 0) + 300_000;

        saveGameState({
          ...latest,
          cashBalance: nextCash,
          baniCurati: nextCash,
          timeSleep: nextSleepTime,
          sleepCount: nextSleepCount,
          sleepMoney: nextSleepMoney,
          sleepRewardClaimed: true,
          sleepCooldownUntil: nextCooldownUntil,
        });

        setPopup('Abia ai dormit. +300,000 bani curati. Cooldown 30s.');
        window.setTimeout(() => setPopup(null), 2500);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const startSleep = () => {
    const latest = loadGameState() || {};
    const now = Date.now();

    if ((latest.sleepCooldownUntil ?? 0) > now) return;
    if ((latest.sleepEndsAt ?? 0) > now) return;

    saveGameState({
      ...latest,
      sleepEndsAt: now + 3_000,
      sleepRewardClaimed: false,
    });

    syncFromStorage();
  };

  const isSleeping = timer > 0;

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="hud-panel p-6 text-center backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-black/25 text-7xl">
          😴
        </div>

        <h1 className="text-4xl font-black uppercase">Sleep</h1>
        <p className="mt-2 text-white/80">Baga un somn puternic de 24h.</p>
        <p className="text-white/70">O sa faci 300.000$.</p>

        <button
          type="button"
          onClick={startSleep}
          disabled={isSleeping || cooldown > 0}
          className={`mt-6 rounded-xl px-6 py-3 text-base font-black ${isSleeping || cooldown > 0 ? 'btn-ghost text-white/50' : 'btn-primary'}`}
        >
          {isSleeping ? `Dormii... ${timer}s` : cooldown > 0 ? `Abia ai dormit (${cooldown}s)` : 'Sleep 24h'}
        </button>
      </div>
      <SharedStatsPanel />
      </div>

      {(popup || isSleeping) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-violet-300/40 bg-violet-500/20 px-5 py-5 text-center text-base font-semibold text-violet-100 shadow-xl">
            {isSleeping ? `Dormii... ${timer}s` : popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
