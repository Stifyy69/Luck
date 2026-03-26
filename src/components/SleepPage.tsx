import { useEffect, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';

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
  const { player, playerId, refresh } = usePlayer();
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);
  const [runBoostMultiplier, setRunBoostMultiplier] = useState(1);

  const sleepBoostItem = player?.inventory.find((item) => item.itemType === 'JOB_BOOST_SLEEP' && item.quantity > 0) ?? null;
  const sleepBoostCount = sleepBoostItem?.quantity ?? 0;

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
        setRunBoostMultiplier(Number(latest.sleepRewardMultiplier ?? 1));
      } else {
        setTimer(0);
        setRunBoostMultiplier(1);
      }

      if (sleepCooldownUntil > now) {
        setCooldown(Math.ceil((sleepCooldownUntil - now) / 1000));
      } else {
        setCooldown(0);
      }

      if (sleepEndsAt > 0 && sleepEndsAt <= now && !latest.sleepRewardClaimed) {
        const multiplier = Number(latest.sleepRewardMultiplier ?? 1);
        const reward = 300_000 * multiplier;
        const nextSleepTime = (latest.timeSleep ?? 0) + 24;
        const nextCooldownUntil = now + 30_000;
        const nextSleepCount = (latest.sleepCount ?? 0) + 1;
        const nextSleepMoney = (latest.sleepMoney ?? 0) + reward;

        saveGameState({
          ...latest,
          cashBalance: Number(player?.cleanMoney ?? latest.cashBalance ?? 0),
          baniCurati: Number(player?.cleanMoney ?? latest.cashBalance ?? 0),
          timeSleep: nextSleepTime,
          sleepCount: nextSleepCount,
          sleepMoney: nextSleepMoney,
          sleepRewardClaimed: true,
          sleepRewardMultiplier: 1,
          sleepCooldownUntil: nextCooldownUntil,
        });

        (async () => {
          try {
            const adjusted = await api.playerCashAdjust(playerId, reward);
            const newest = loadGameState() || {};
            saveGameState({
              ...newest,
              cashBalance: Number(adjusted.cleanMoney),
              baniCurati: Number(adjusted.cleanMoney),
            });
            refresh();
          } catch {
            setPopup('Sleep finished, but cash sync failed. Retry page refresh.');
          }
        })();

        setPopup(`Sleep completed. +${reward.toLocaleString('en-US')} clean money. 30s cooldown.`);
        window.setTimeout(() => setPopup(null), 2500);
      }
    }, 250);

    return () => window.clearInterval(interval);
  }, []);

  const startSleep = async () => {
    const latest = loadGameState() || {};
    const now = Date.now();

    if ((latest.sleepCooldownUntil ?? 0) > now) return;
    if ((latest.sleepEndsAt ?? 0) > now) return;

    let multiplier = 1;
    if (sleepBoostItem) {
      try {
        await api.inventoryUse(playerId, sleepBoostItem.id);
        await refresh();
        multiplier = 2;
        setPopup('Sleep Boost consumed for this run (x2).');
        window.setTimeout(() => setPopup(null), 1800);
      } catch {
        setPopup('Could not consume Sleep Boost. Starting normal sleep.');
        window.setTimeout(() => setPopup(null), 1800);
      }
    }

    saveGameState({
      ...latest,
      sleepEndsAt: now + 3_000,
      sleepRewardClaimed: false,
      sleepRewardMultiplier: multiplier,
    });

    syncFromStorage();
  };

  const isSleeping = timer > 0;

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-4">
        <div className="hud-panel p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-black/25 text-7xl">
            😴
          </div>

          <h1 className="text-4xl font-black uppercase">Sleep Job</h1>
          <p className="mt-2 text-white/80">Run a rest cycle and get paid.</p>
          <p className="text-white/70">Base reward: 300,000 clean money.</p>

          <div className="mx-auto mt-5 max-w-md rounded-xl border border-white/15 bg-black/20 p-4 text-left">
            <p className="text-xs uppercase tracking-widest text-white/45">Sleep Boost</p>
            <p className="mt-1 text-sm text-white/80">Ready boosts: <span className="font-black text-[#ffd95a]">x{sleepBoostCount}</span></p>
            <p className="text-sm text-white/70">Current run multiplier: <span className="font-black text-[#45d483]">x{runBoostMultiplier}</span></p>
            <p className="mt-1 text-xs text-white/45">If you have a boost, it is consumed one-time when you start Sleep.</p>
          </div>

          <button
            type="button"
            onClick={() => { startSleep().catch(() => {}); }}
            disabled={isSleeping || cooldown > 0}
            className={`mt-6 rounded-xl px-6 py-3 text-base font-black ${isSleeping || cooldown > 0 ? 'btn-ghost text-white/50' : 'btn-primary'}`}
          >
            {isSleeping ? `Sleeping... ${timer}s` : cooldown > 0 ? `Cooldown (${cooldown}s)` : 'Start Sleep'}
          </button>
        </div>
      </div>

      {(popup || isSleeping) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-violet-300/40 bg-violet-500/20 px-5 py-5 text-center text-base font-semibold text-violet-100 shadow-xl">
            {isSleeping ? `Sleeping... ${timer}s` : popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
