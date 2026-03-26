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

export default function PilotPage() {
  const [timer, setTimer] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const [popup, setPopup] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => {
      const state = loadGameState() || {};
      const now = Date.now();
      setTimer(Math.max(0, Math.ceil(((state.pilotEndsAt ?? 0) - now) / 1000)));
      setCooldown(Math.max(0, Math.ceil(((state.pilotCooldownUntil ?? 0) - now) / 1000)));

      if ((state.pilotEndsAt ?? 0) > 0 && (state.pilotEndsAt ?? 0) <= now && !state.pilotRewardClaimed) {
        const nextCash = Number(state.cashBalance ?? 1_000_000) + 100_000;
        const nextPilot = Number(state.timePilot ?? 0) + 0.5;
        saveGameState({
          ...state,
          cashBalance: nextCash,
          baniCurati: nextCash,
          timePilot: nextPilot,
          pilotCount: Number(state.pilotCount ?? 0) + 1,
          pilotMoney: Number(state.pilotMoney ?? 0) + 100_000,
          pilotRewardClaimed: true,
          pilotCooldownUntil: now + 30_000,
        });
        setPopup('+100,000 clean money · cooldown 30s');
        window.setTimeout(() => setPopup(null), 2200);
      }
    };

    tick();
    const timerId = window.setInterval(tick, 250);
    return () => window.clearInterval(timerId);
  }, []);

  const startPilot = () => {
    const state = loadGameState() || {};
    const now = Date.now();
    if ((state.pilotCooldownUntil ?? 0) > now) return;
    if ((state.pilotEndsAt ?? 0) > now) return;

    saveGameState({
      ...state,
      pilotEndsAt: now + 3000,
      pilotRewardClaimed: false,
    });
  };

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1340px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="hud-panel p-6 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-black/25 text-7xl">🛩️</div>
          <h1 className="text-4xl font-black uppercase">Pilot</h1>
          <p className="mt-2 text-white/80">Baga 2 curse la pilot.</p>
          <p className="text-white/70">Primesti 100.000$.</p>

          <button
            type="button"
            onClick={startPilot}
            disabled={timer > 0 || cooldown > 0}
            className={`mt-6 rounded-xl px-6 py-3 text-base font-black ${timer > 0 || cooldown > 0 ? 'btn-ghost text-white/50' : 'btn-secondary'}`}
          >
            {timer > 0 ? `Pilot task... ${timer}s` : cooldown > 0 ? `Cooldown ${cooldown}s` : 'Start Pilot'}
          </button>
        </div>

        <SharedStatsPanel />
      </div>

      {(popup || timer > 0) ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-sky-300/40 bg-sky-500/20 px-5 py-5 text-center text-base font-semibold text-sky-100 shadow-xl">
            {timer > 0 ? `Pilot task running... ${timer}s` : popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
