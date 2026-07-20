import { useEffect, useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';

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

function fmt(value: number) {
  return value.toLocaleString('en-US');
}

export default function SharedStatsPanel() {
  const { player } = usePlayer();
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    const refresh = () => {
      const state = loadGameState() || {};
      setStats({
        cash: Number(player?.cleanMoney ?? state.cashBalance ?? 0),
        dirty: Number(state.baniMurdari ?? 0),
        farmEarned: Number(state.farmEarned ?? 0),
        spent: Number(state.rouletteSpent ?? 0),
        won: Number(state.rouletteWon ?? 0),
        net: Number((state.rouletteWon ?? 0) - (state.rouletteSpent ?? 0)),
        timeFarm: Number(state.timeFarm ?? 0),
        procF: Number(state.processedFrunze ?? 0),
        procA: Number(state.processedWhite ?? 0),
        procB: Number(state.processedBlue ?? 0),
        timeSleep: Number(state.timeSleep ?? 0),
        timePilot: Number(state.timePilot ?? 0),
      });
    };

    refresh();
    const timer = window.setInterval(refresh, 1000);
    return () => window.clearInterval(timer);
  }, [player?.cleanMoney]);

  const totalTime = (stats.timeFarm ?? 0) + (stats.timeSleep ?? 0) + (stats.timePilot ?? 0);
  const activity = useMemo(
    () => [
      { label: 'Cayo work', value: stats.timeFarm ?? 0 },
      { label: 'Pilot routes', value: stats.timePilot ?? 0 },
      { label: 'Recovery', value: stats.timeSleep ?? 0 },
    ],
    [stats.timeFarm, stats.timePilot, stats.timeSleep],
  );

  return (
    <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
      <div className="game-panel-soft p-5 sm:p-6">
        <p className="section-kicker">Career footprint</p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-black tracking-[-0.035em] text-white">Time in the city</h2>
          <p className="text-2xl font-black text-[var(--accent)]">{fmt(totalTime)}h</p>
        </div>

        <div className="mt-6 space-y-5">
          {activity.map((item) => {
            const percentage = totalTime > 0 ? Math.max(4, Math.round((item.value / totalTime) * 100)) : 0;
            return (
              <div key={item.label}>
                <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-white/55">{item.label}</span>
                  <span className="font-black text-white">{fmt(item.value)}h</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${percentage}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-7 rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-white/28">Processed resources</p>
          <p className="mt-2 text-lg font-black text-white">{fmt(stats.procF ?? 0)} / {fmt(stats.procA ?? 0)} / {fmt(stats.procB ?? 0)}</p>
          <p className="mt-1 text-xs text-white/34">Leaves, white product and blue product recorded.</p>
        </div>
      </div>

      <div className="game-panel-soft p-5 sm:p-6">
        <p className="section-kicker">Money trail</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">How the cash moves</h2>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <MoneyCard label="Clean cash" value={stats.cash ?? 0} tone="positive" />
          <MoneyCard label="Dirty cash" value={stats.dirty ?? 0} />
          <MoneyCard label="Farm earnings" value={stats.farmEarned ?? 0} tone="positive" />
          <MoneyCard label="Roulette spent" value={stats.spent ?? 0} tone="negative" />
          <MoneyCard label="Roulette won" value={stats.won ?? 0} tone="positive" />
          <MoneyCard label="Roulette net" value={stats.net ?? 0} tone={(stats.net ?? 0) >= 0 ? 'positive' : 'negative'} />
        </div>
      </div>
    </section>
  );
}

function MoneyCard({ label, value, tone }: { label: string; value: number; tone?: 'positive' | 'negative' }) {
  const valueClass = tone === 'positive' ? 'text-[var(--money)]' : tone === 'negative' ? 'text-[var(--danger)]' : 'text-white';
  return (
    <div className="game-card p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/27">{label}</p>
      <p className={`mt-2 truncate text-lg font-black tracking-[-0.025em] ${valueClass}`}>{fmt(value)} $</p>
    </div>
  );
}
