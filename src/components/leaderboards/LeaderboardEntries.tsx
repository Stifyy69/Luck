import type {
  GangLeaderboardMetric,
  LeaderboardGang,
  LeaderboardPlayer,
  PlayerLeaderboardMetric,
} from '../../lib/platformApi';

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

function relativeTime(value: string | null) {
  if (!value) return 'No activity';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function playerMetricValue(player: LeaderboardPlayer, metric: PlayerLeaderboardMetric) {
  if (metric === 'city_level') return `Level ${player.cityLevel}`;
  if (metric === 'wealth') return `${fmt(player.netWorth)} $`;
  if (metric === 'earnings') return `${fmt(player.totalEarnings)} $`;
  if (metric === 'cash') return `${fmt(player.cleanMoney)} $`;
  if (metric === 'career') return fmt(player.careerScore);
  if (metric === 'pizza') return `${fmt(player.deliveries)} runs`;
  if (metric === 'fishing') return `${fmt(player.catches)} catches`;
  if (metric === 'aviation') return `${fmt(player.flights)} flights`;
  if (metric === 'fleet') return `${fmt(player.fleetValue)} $`;
  return `${player.totalTimeHours.toFixed(1)}h`;
}

function gangMetricValue(gang: LeaderboardGang, metric: GangLeaderboardMetric) {
  if (metric === 'dirty_earned') return `${fmt(gang.dirtyEarned)} $`;
  if (metric === 'members') return `${gang.membersCount} members`;
  if (metric === 'stock_value') return `${fmt(gang.stockValue)} $`;
  if (metric === 'gang_level') return gang.gangLevel;
  return relativeTime(gang.updatedAt);
}

export function PlayerPodium({ player, position, metric }: { player: LeaderboardPlayer; position: number; metric: PlayerLeaderboardMetric }) {
  return (
    <article className={`game-panel-soft relative overflow-hidden p-5 ${position === 1 ? 'border-[rgba(211,255,81,0.26)] lg:-translate-y-2' : ''}`}>
      <div className="absolute right-[-30px] top-[-35px] text-[120px] font-black leading-none text-white/[0.025]">{position}</div>
      <div className="relative flex items-start justify-between gap-3"><RankBadge position={position} /><span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase text-white/35">City Lv {player.cityLevel}</span></div>
      <h3 className="relative mt-6 truncate text-2xl font-black text-white">{player.displayName}</h3>
      <p className="relative mt-1 truncate text-xs text-white/32">@{player.username || player.playerId}</p>
      <p className="relative mt-5 text-2xl font-black text-[var(--accent)]">{playerMetricValue(player, metric)}</p>
      <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
        <Mini label="Deliveries" value={fmt(player.deliveries)} /><Mini label="Catches" value={fmt(player.catches)} /><Mini label="Flights" value={fmt(player.flights)} />
      </div>
    </article>
  );
}

export function GangPodium({ gang, position, metric }: { gang: LeaderboardGang; position: number; metric: GangLeaderboardMetric }) {
  return (
    <article className={`game-panel-soft relative overflow-hidden p-5 ${position === 1 ? 'border-[rgba(211,255,81,0.26)] lg:-translate-y-2' : ''}`}>
      <div className="absolute right-[-30px] top-[-35px] text-[120px] font-black leading-none text-white/[0.025]">{position}</div>
      <div className="relative flex items-start justify-between gap-3"><RankBadge position={position} /><span className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[9px] font-black uppercase text-white/35">{gang.gangLevel}</span></div>
      <h3 className="relative mt-6 truncate text-2xl font-black text-white">{gang.name}</h3>
      <p className="relative mt-1 truncate text-xs text-white/32">Led by {gang.ownerName} · City Lv {gang.cityLevel}</p>
      <p className="relative mt-5 text-2xl font-black text-[var(--accent)]">{gangMetricValue(gang, metric)}</p>
      <div className="relative mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-4 text-center">
        <Mini label="Members" value={fmt(gang.membersCount)} /><Mini label="Workers" value={fmt(gang.activeWorkers)} /><Mini label="Blue" value={fmt(gang.bluePacks)} />
      </div>
    </article>
  );
}

export function PlayerRow({ player, metric }: { player: LeaderboardPlayer; metric: PlayerLeaderboardMetric }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[52px_minmax(0,1fr)_150px_220px] sm:items-center sm:px-6">
      <RankBadge position={player.rank} compact />
      <div className="min-w-0"><p className="truncate text-sm font-black text-white">{player.displayName}</p><p className="mt-1 truncate text-[10px] text-white/28">@{player.username || player.playerId} · City Lv {player.cityLevel}</p></div>
      <p className="text-sm font-black text-[var(--accent)] sm:text-right">{playerMetricValue(player, metric)}</p>
      <div className="flex flex-wrap gap-3 text-[10px] font-bold text-white/32 sm:justify-end"><span>{player.deliveries} deliveries</span><span>{player.catches} catches</span><span>{player.flights} flights</span></div>
    </div>
  );
}

export function GangRow({ gang, metric }: { gang: LeaderboardGang; metric: GangLeaderboardMetric }) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-[52px_minmax(0,1fr)_170px_210px] sm:items-center sm:px-6">
      <RankBadge position={gang.rank} compact />
      <div className="min-w-0"><p className="truncate text-sm font-black text-white">{gang.name}</p><p className="mt-1 truncate text-[10px] text-white/28">{gang.gangLevel} · Led by {gang.ownerName}</p></div>
      <p className="text-sm font-black text-[var(--accent)] sm:text-right">{gangMetricValue(gang, metric)}</p>
      <div className="flex flex-wrap gap-3 text-[10px] font-bold text-white/32 sm:justify-end"><span>{gang.membersCount} members</span><span>{fmt(gang.stockValue)} stock</span></div>
    </div>
  );
}

function RankBadge({ position, compact = false }: { position: number; compact?: boolean }) {
  const special = position === 1 ? 'bg-[var(--accent)] text-[#10140b]' : position === 2 ? 'bg-white/75 text-[#10140b]' : position === 3 ? 'bg-amber-500/80 text-[#171006]' : 'bg-white/[0.045] text-white/38';
  return <span className={`inline-flex shrink-0 items-center justify-center rounded-[14px] font-black ${compact ? 'h-10 w-10 text-xs' : 'h-12 w-12 text-base'} ${special}`}>#{position}</span>;
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25">{label}</p><p className="mt-1 text-xs font-black text-white/75">{value}</p></div>;
}
