import type { AdminOverviewResponse } from '../../lib/adminApi';
import CityIcon, { type CityIconName } from '../ui/CityIcon';

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, Number(value || 0)));
}

export default function AdminOverview({ data }: { data: AdminOverviewResponse }) {
  const cards: Array<{ label: string; value: string; icon: CityIconName; tone?: 'accent' | 'money' }> = [
    { label: 'Players', value: fmt(data.summary.totalPlayers), icon: 'profile' },
    { label: 'Accounts', value: fmt(data.summary.totalAccounts), icon: 'login' },
    { label: 'Online now', value: fmt(data.summary.onlineNow), icon: 'clock', tone: 'money' },
    { label: 'Active VIP', value: fmt(data.summary.activeVip), icon: 'star', tone: 'accent' },
    { label: 'Gangs', value: fmt(data.summary.totalGangs), icon: 'gangs' },
    { label: 'Clean money', value: `${compact(data.summary.totalCleanMoney)} $`, icon: 'wallet', tone: 'money' },
    { label: 'Fleet value', value: `${compact(data.summary.totalFleetValue)} $`, icon: 'car' },
    { label: 'All earnings', value: `${compact(data.summary.totalEarnings)} $`, icon: 'coin', tone: 'accent' },
  ];

  const maxLevelCount = Math.max(1, ...data.levelDistribution.map((entry) => entry.count));

  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="game-panel-soft p-4">
            <div className="flex items-center gap-2 text-white/28"><CityIcon name={card.icon} className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.15em]">{card.label}</p></div>
            <p className={`mt-3 text-2xl font-black tracking-[-0.035em] ${card.tone === 'money' ? 'text-[var(--money)]' : card.tone === 'accent' ? 'text-[var(--accent)]' : 'text-white'}`}>{card.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="game-panel-soft p-5 sm:p-6">
          <p className="section-kicker">Progress distribution</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">City Levels</h2>
          <div className="mt-6 space-y-3">
            {data.levelDistribution.length > 0 ? data.levelDistribution.map((entry) => (
              <div key={entry.level}>
                <div className="mb-1.5 flex items-center justify-between text-xs"><span className="font-black text-white/55">Level {entry.level}</span><span className="font-black text-white">{entry.count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.max(4, (entry.count / maxLevelCount) * 100)}%` }} /></div>
              </div>
            )) : <p className="text-sm text-white/35">No level data yet.</p>}
          </div>
        </section>

        <section className="game-panel-soft p-5 sm:p-6">
          <p className="section-kicker">Highest progression</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Top accounts</h2>
          <div className="mt-5 space-y-2.5">
            {data.topPlayers.map((player, index) => (
              <div key={player.playerId} className="flex items-center gap-3 rounded-[16px] border border-white/[0.065] bg-black/20 p-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-xs font-black ${index === 0 ? 'bg-[var(--accent)] text-[#10140b]' : 'bg-white/[0.05] text-white/45'}`}>#{index + 1}</span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-white">{player.displayName}</p><p className="mt-0.5 truncate text-[10px] text-white/28">{player.username ? `@${player.username}` : player.playerId}</p></div>
                <div className="text-right"><p className="text-sm font-black text-[var(--accent)]">Lv {player.cityLevel}</p><p className="text-[10px] text-white/28">{fmt(player.cityXp)} XP</p></div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="game-panel-soft p-5 sm:p-6">
        <div className="flex items-end justify-between gap-4"><div><p className="section-kicker">Recent control actions</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Audit preview</h2></div><span className="text-[10px] font-black uppercase tracking-[0.13em] text-white/25">Latest {data.recentActions.length}</span></div>
        <div className="mt-5 divide-y divide-white/[0.06]">
          {data.recentActions.length > 0 ? data.recentActions.map((action) => (
            <div key={action.id} className="grid gap-2 py-3 text-xs sm:grid-cols-[150px_minmax(0,1fr)_180px] sm:items-center">
              <p className="font-black uppercase tracking-[0.1em] text-[var(--accent)]">{action.actionType.replaceAll('_', ' ')}</p>
              <p className="truncate text-white/50">{action.playerId || 'System'} · {JSON.stringify(action.actionPayload)}</p>
              <p className="text-white/25 sm:text-right">{new Date(action.createdAt).toLocaleString()}</p>
            </div>
          )) : <p className="py-6 text-sm text-white/30">No admin changes recorded yet.</p>}
        </div>
      </section>
    </div>
  );
}
