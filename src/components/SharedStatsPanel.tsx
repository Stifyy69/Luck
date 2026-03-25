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
          <Card label="Bani Curati" value={`${(stats.cash ?? 0).toLocaleString('ro-RO')} $`} />
          <Card label="Bani Murdari" value={`${(stats.dirty ?? 0).toLocaleString('ro-RO')} $`} />
          <Card label="Castigat Farm" value={`${(stats.farmEarned ?? 0).toLocaleString('ro-RO')} $`} />
          <Card label="Cheltuit Ruleta" value={`${(stats.spent ?? 0).toLocaleString('ro-RO')} $`} />
          <Card label="Castigat Ruleta" value={`${(stats.won ?? 0).toLocaleString('ro-RO')} $`} />
          <Card label="Total NET" value={`${(stats.net ?? 0).toLocaleString('ro-RO')} $`} />
        </div>
        <div className="space-y-2">
          <Card label="Timp Petrecut Farm" value={`${(stats.timeFarm ?? 0).toLocaleString('ro-RO')}h`} />
          <Card label="Procesat (F/A/B)" value={`${(stats.procF ?? 0).toLocaleString('ro-RO')} / ${(stats.procA ?? 0).toLocaleString('ro-RO')} / ${(stats.procB ?? 0).toLocaleString('ro-RO')}`} />
          <Card label="Timp Sleep" value={`${(stats.timeSleep ?? 0).toLocaleString('ro-RO')}h`} />
          <Card label="Timp Petrecut Pilot" value={`${(stats.timePilot ?? 0).toLocaleString('ro-RO')}h`} />
          <Card label="Timp total" value={`${totalTime.toLocaleString('ro-RO')}h`} />
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
