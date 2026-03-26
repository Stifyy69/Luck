import { useEffect, useState } from 'react';

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

export default function SharedStatsPanel() {
  const [stats, setStats] = useState<Record<string, number>>({});

  if (typeof window !== 'undefined' && window.location.pathname !== '/profile') {
    return null;
  }

  useEffect(() => {
    const refresh = () => {
      const s = loadGameState() || {};
      setStats({
        cash: Number(s.cashBalance ?? 0),
        dirty: Number(s.baniMurdari ?? 0),
        farmEarned: Number(s.farmEarned ?? 0),
        spent: Number(s.rouletteSpent ?? 0),
        won: Number(s.rouletteWon ?? 0),
        net: Number((s.rouletteWon ?? 0) - (s.rouletteSpent ?? 0)),
        timeFarm: Number(s.timeFarm ?? 0),
        procF: Number(s.processedFrunze ?? 0),
        procA: Number(s.processedWhite ?? 0),
        procB: Number(s.processedBlue ?? 0),
        timeSleep: Number(s.timeSleep ?? 0),
        timePilot: Number(s.timePilot ?? 0),
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const totalTime = (stats.timeFarm ?? 0) + (stats.timeSleep ?? 0) + (stats.timePilot ?? 0);

  return (
    <div className="hud-panel p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[#ffe1b2]">Stats</p>
      <div className="mt-3 grid grid-cols-2 gap-2.5 text-sm">
        <div className="space-y-2">
          <Card label="Clean Money" value={`${(stats.cash ?? 0).toLocaleString('en-US')} $`} />
          <Card label="Dirty Money" value={`${(stats.dirty ?? 0).toLocaleString('en-US')} $`} />
          <Card label="Farm Earnings" value={`${(stats.farmEarned ?? 0).toLocaleString('en-US')} $`} />
          <Card label="Roulette Spent" value={`${(stats.spent ?? 0).toLocaleString('en-US')} $`} />
          <Card label="Roulette Won" value={`${(stats.won ?? 0).toLocaleString('en-US')} $`} />
          <Card label="Total NET" value={`${(stats.net ?? 0).toLocaleString('en-US')} $`} />
        </div>
        <div className="space-y-2">
          <Card label="Farm Time" value={`${(stats.timeFarm ?? 0).toLocaleString('en-US')}h`} />
          <Card label="Processed (L/W/B)" value={`${(stats.procF ?? 0).toLocaleString('en-US')} / ${(stats.procA ?? 0).toLocaleString('en-US')} / ${(stats.procB ?? 0).toLocaleString('en-US')}`} />
          <Card label="Sleep Time" value={`${(stats.timeSleep ?? 0).toLocaleString('en-US')}h`} />
          <Card label="Pilot Time" value={`${(stats.timePilot ?? 0).toLocaleString('en-US')}h`} />
          <Card label="Total Time" value={`${totalTime.toLocaleString('en-US')}h`} />
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="hud-card p-2.5">
      <p className="text-[11px] text-white/60">{label}</p>
      <p className="text-sm font-black leading-tight text-[#f5f7ff]">{value}</p>
    </div>
  );
}
