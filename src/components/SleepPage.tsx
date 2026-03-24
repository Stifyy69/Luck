import { useState } from 'react';

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
  const saved = typeof window !== 'undefined' ? loadGameState() : null;
  const [cooldown, setCooldown] = useState(0);
  const [sleeping, setSleeping] = useState(false);
  const [timer, setTimer] = useState(12);
  const [popup, setPopup] = useState<string | null>(null);

  const startSleep = () => {
    if (sleeping || cooldown > 0) return;
    setSleeping(true);
    setTimer(12);

    let t = 12;
    const interval = window.setInterval(() => {
      t -= 1;
      setTimer(t);

      if (t <= 0) {
        window.clearInterval(interval);
        setSleeping(false);

        const latest = loadGameState() || saved || {};
        const nextCash = (latest.cashBalance ?? 1_000_000) + 150_000;
        const nextTimeLost = (latest.timeLostFarm ?? 0) + 12;

        saveGameState({
          ...latest,
          cashBalance: nextCash,
          baniCurati: nextCash,
          timeLostFarm: nextTimeLost,
        });

        setPopup('+150,000 bani curati (12h timp joc adaugat)');
        window.setTimeout(() => setPopup(null), 2500);

        setCooldown(30);
        let c = 30;
        const cooldownInterval = window.setInterval(() => {
          c -= 1;
          setCooldown(c);
          if (c <= 0) window.clearInterval(cooldownInterval);
        }, 1000);
      }
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto max-w-[920px] rounded-2xl border border-white/15 bg-[#171438]/72 p-6 text-center shadow-[0_25px_90px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="mx-auto mb-4 flex h-36 w-36 items-center justify-center rounded-full border border-white/20 bg-black/25 text-7xl">
          😴
        </div>

        <h1 className="text-4xl font-black uppercase">Sleep</h1>
        <p className="mt-2 text-white/70">Dormit 12h (simulat în 12 secunde), reward: 150.000 bani curati.</p>

        <button
          type="button"
          onClick={startSleep}
          disabled={sleeping || cooldown > 0}
          className={`mt-6 rounded-xl px-6 py-3 text-base font-black ${sleeping || cooldown > 0 ? 'bg-[#2a2744] text-white/50' : 'bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white'}`}
        >
          {sleeping ? `Se doarme... ${timer}s` : cooldown > 0 ? `Cooldown ${cooldown}s` : 'Sleep 12h'}
        </button>
      </div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-emerald-300/40 bg-emerald-500/20 px-5 py-5 text-center text-base font-semibold text-emerald-100 shadow-xl">
            {popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
