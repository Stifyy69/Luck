import type { AdminPlayer, AdminPlayerFilters, AdminPlayersResponse } from '../../lib/adminApi';
import AdminPlayerFiltersPanel from './AdminPlayerFilters';

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

function online(player: AdminPlayer) {
  return player.lastSeenMs > Date.now() - 90_000;
}

export default function AdminPlayersTable({
  data,
  filters,
  loading,
  onFiltersChange,
  onApply,
  onPage,
  onEdit,
}: {
  data: AdminPlayersResponse | null;
  filters: AdminPlayerFilters;
  loading: boolean;
  onFiltersChange: (next: AdminPlayerFilters) => void;
  onApply: () => void;
  onPage: (page: number) => void;
  onEdit: (player: AdminPlayer) => void;
}) {
  return (
    <div className="space-y-5">
      <AdminPlayerFiltersPanel filters={filters} onFiltersChange={onFiltersChange} onApply={onApply} />

      <section className="game-panel-soft overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/[0.07] px-5 py-4"><p className="text-sm font-black text-white">{loading ? 'Loading...' : `${data?.total || 0} matching players`}</p><p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/25">Page {data?.page || 1} / {data?.pages || 1}</p></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] text-left text-xs">
            <thead className="bg-black/20 text-[9px] font-black uppercase tracking-[0.12em] text-white/28"><tr><th className="px-5 py-3">Player</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">City</th><th className="px-3 py-3">Clean money</th><th className="px-3 py-3">Net worth</th><th className="px-3 py-3">Earnings</th><th className="px-3 py-3">Careers</th><th className="px-3 py-3">Assets</th><th className="px-3 py-3">Last seen</th><th className="px-5 py-3" /></tr></thead>
            <tbody className="divide-y divide-white/[0.055]">
              {(data?.players || []).map((player) => (
                <tr key={player.playerId} className="hover:bg-white/[0.02]">
                  <td className="px-5 py-4"><p className="max-w-[210px] truncate font-black text-white">{player.displayName}</p><p className="mt-1 max-w-[210px] truncate text-[10px] text-white/28">{player.username ? `@${player.username}` : 'Guest'} · {player.playerId}</p></td>
                  <td className="px-3 py-4"><span className={`rounded-full border px-2 py-1 text-[8px] font-black uppercase ${online(player) ? 'border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300' : 'border-white/[0.07] bg-black/20 text-white/28'}`}>{online(player) ? 'Online' : 'Offline'}</span>{player.vipActive ? <span className="ml-1 rounded-full border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.07)] px-2 py-1 text-[8px] font-black text-[var(--accent)]">VIP</span> : null}{player.hasGang ? <span className="ml-1 rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-2 py-1 text-[8px] font-black text-violet-200">GANG</span> : null}</td>
                  <td className="px-3 py-4"><p className="font-black text-[var(--accent)]">Lv {player.cityLevel}</p><p className="mt-1 text-[10px] text-white/25">{fmt(player.cityXp)} XP</p></td>
                  <td className="px-3 py-4 font-black text-[var(--money)]">{fmt(player.cleanMoney)} $</td>
                  <td className="px-3 py-4 font-black text-white">{fmt(player.netWorth)} $</td>
                  <td className="px-3 py-4 text-white/55">{fmt(player.totalEarnings)} $</td>
                  <td className="px-3 py-4 text-white/42"><span>P{player.pizzerLevel}</span> · <span>F{player.fisherLevel}</span> · <span>A{player.pilotLevel}</span><p className="mt-1 text-[9px] text-white/22">Score {fmt(player.careerScore)}</p></td>
                  <td className="px-3 py-4 text-white/42">{player.vehicleCount} cars · {player.inventoryUnits} items</td>
                  <td className="px-3 py-4 text-white/32">{player.lastSeen ? new Date(player.lastSeen).toLocaleString() : '-'}</td>
                  <td className="px-5 py-4 text-right"><button type="button" onClick={() => onEdit(player)} className="btn-secondary rounded-lg px-3 py-2 text-[10px]">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(data?.players.length || 0) === 0 && !loading ? <p className="p-10 text-center text-sm text-white/30">No players match the current filters.</p> : null}
        <div className="flex items-center justify-between border-t border-white/[0.07] px-5 py-4"><button type="button" disabled={(data?.page || 1) <= 1} onClick={() => onPage(Math.max(1, (data?.page || 1) - 1))} className="btn-ghost rounded-lg px-4 py-2 text-xs disabled:opacity-30">Previous</button><button type="button" disabled={(data?.page || 1) >= (data?.pages || 1)} onClick={() => onPage(Math.min(data?.pages || 1, (data?.page || 1) + 1))} className="btn-ghost rounded-lg px-4 py-2 text-xs disabled:opacity-30">Next</button></div>
      </section>
    </div>
  );
}
