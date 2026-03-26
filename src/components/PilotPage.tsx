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

export default function PilotPage() {
  const { player, playerId, refresh } = usePlayer();
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);
  const [runBoostMultiplier, setRunBoostMultiplier] = useState(1);

  const pilotBoostItem = player?.inventory.find((item) => item.itemType === 'JOB_BOOST_PILOT' && item.quantity > 0) ?? null;
  const pilotBoostCount = pilotBoostItem?.quantity ?? 0;

  useEffect(() => {
    const tick = () => {
      const state = loadGameState() || {};
      const now = Date.now();
      const pilotEndsAt = state.pilotEndsAt ?? 0;
      setTimer(Math.max(0, Math.ceil((pilotEndsAt - now) / 1000)));
      setCooldown(Math.max(0, Math.ceil(((state.pilotCooldownUntil ?? 0) - now) / 1000)));
      if (pilotEndsAt > now) {
        setRunBoostMultiplier(Number(state.pilotRewardMultiplier ?? 1));
      } else {
        setRunBoostMultiplier(1);
      }

      if ((state.pilotEndsAt ?? 0) > 0 && (state.pilotEndsAt ?? 0) <= now && !state.pilotRewardClaimed) {
        const multiplier = Number(state.pilotRewardMultiplier ?? 1);
        const reward = 100_000 * multiplier;
        const nextPilot = Number(state.timePilot ?? 0) + 0.5;
        saveGameState({
          ...state,
          cashBalance: Number(player?.cleanMoney ?? state.cashBalance ?? 0),
          baniCurati: Number(player?.cleanMoney ?? state.cashBalance ?? 0),
          timePilot: nextPilot,
          pilotCount: Number(state.pilotCount ?? 0) + 1,
          pilotMoney: Number(state.pilotMoney ?? 0) + reward,
          pilotRewardClaimed: true,
          pilotRewardMultiplier: 1,
          pilotCooldownUntil: now + 30_000,
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
            setPopup('Pilot finished, but cash sync failed. Retry page refresh.');
          }
        })();

        setPopup(`Pilot completed. +${reward.toLocaleString('en-US')} clean money. 30s cooldown.`);
        window.setTimeout(() => setPopup(null), 2200);
      }
    };

    tick();
    const timerId = window.setInterval(tick, 250);
    return () => window.clearInterval(timerId);
  }, [player?.cleanMoney, playerId, refresh]);

  const startPilot = async () => {
    const state = loadGameState() || {};
    const now = Date.now();
    if ((state.pilotCooldownUntil ?? 0) > now) return;
    if ((state.pilotEndsAt ?? 0) > now) return;

    let multiplier = 1;
    if (pilotBoostItem) {
      try {
        await api.inventoryUse(playerId, pilotBoostItem.id);
        await refresh();
        multiplier = 2;
        setPopup('Pilot Boost consumed for this run (x2).');
        window.setTimeout(() => setPopup(null), 1800);
      } catch {
        setPopup('Could not consume Pilot Boost. Starting normal pilot run.');
        window.setTimeout(() => setPopup(null), 1800);
      }
    }

    saveGameState({
      ...state,
      pilotEndsAt: now + 3000,
      pilotRewardClaimed: false,
      pilotRewardMultiplier: multiplier,
    });
  };

  const isRunning = timer > 0;

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1040px] grid-cols-1 gap-4">
        <div className="hud-panel p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-black/25 text-7xl">🛩️</div>
          <h1 className="text-4xl font-black uppercase">Pilot Job</h1>
          <p className="mt-2 text-white/80">Run a pilot mission and get paid.</p>
          <p className="text-white/70">Base reward: 100,000 clean money.</p>

          <div className="mx-auto mt-5 max-w-md rounded-xl border border-white/15 bg-black/20 p-4 text-left">
            <p className="text-xs uppercase tracking-widest text-white/45">Pilot Boost</p>
            <p className="mt-1 text-sm text-white/80">Ready boosts: <span className="font-black text-[#ffd95a]">x{pilotBoostCount}</span></p>
            <p className="text-sm text-white/70">Current run multiplier: <span className="font-black text-[#45d483]">x{runBoostMultiplier}</span></p>
            <p className="mt-1 text-xs text-white/45">If you have a boost, it is consumed one-time when you start Pilot.</p>
          </div>

          <button
            type="button"
            onClick={() => { startPilot().catch(() => {}); }}
            disabled={isRunning || cooldown > 0}
            className={`mt-6 rounded-xl px-6 py-3 text-base font-black ${isRunning || cooldown > 0 ? 'btn-ghost text-white/50' : 'btn-secondary'}`}
          >
            {isRunning ? `Pilot running... ${timer}s` : cooldown > 0 ? `Cooldown ${cooldown}s` : 'Start Pilot'}
          </button>
        </div>
      </div>

      {(popup || isRunning) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-sky-300/40 bg-sky-500/20 px-5 py-5 text-center text-base font-semibold text-sky-100 shadow-xl">
            {isRunning ? `Pilot running... ${timer}s` : popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
