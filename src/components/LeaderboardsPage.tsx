import { useEffect, useMemo, useState } from 'react';
import {
  fetchGangLeaderboard,
  fetchPlayerLeaderboard,
  type GangLeaderboardMetric,
  type GangLeaderboardResponse,
  type LeaderboardGang,
  type LeaderboardPlayer,
  type PlayerLeaderboardMetric,
  type PlayerLeaderboardResponse,
} from '../lib/platformApi';
import CityIcon from './ui/CityIcon';
import { GangPodium, GangRow, PlayerPodium, PlayerRow } from './leaderboards/LeaderboardEntries';

type BoardTab = 'players' | 'gangs';

const PLAYER_METRICS: Array<{ id: PlayerLeaderboardMetric; label: string }> = [
  { id: 'city_level', label: 'City Level' },
  { id: 'wealth', label: 'Net Worth' },
  { id: 'earnings', label: 'Earnings' },
  { id: 'cash', label: 'Clean Money' },
  { id: 'career', label: 'Career Score' },
  { id: 'pizza', label: 'Pizza Runs' },
  { id: 'fishing', label: 'Fish Caught' },
  { id: 'aviation', label: 'Pilot Flights' },
  { id: 'fleet', label: 'Fleet Value' },
  { id: 'time', label: 'Time Played' },
];

const GANG_METRICS: Array<{ id: GangLeaderboardMetric; label: string }> = [
  { id: 'dirty_earned', label: 'Dirty Earned' },
  { id: 'members', label: 'Members' },
  { id: 'stock_value', label: 'Stock Value' },
  { id: 'gang_level', label: 'Gang Level' },
  { id: 'activity', label: 'Activity' },
];

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

function compact(value: number) {
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Math.max(0, Number(value || 0)));
}

function relativeTime(value: string | null) {
  if (!value) return 'No activity';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function LeaderboardsPage() {
  const [tab, setTab] = useState<BoardTab>('players');
  const [playerMetric, setPlayerMetric] = useState<PlayerLeaderboardMetric>('city_level');
  const [gangMetric, setGangMetric] = useState<GangLeaderboardMetric>('dirty_earned');
  const [players, setPlayers] = useState<PlayerLeaderboardResponse | null>(null);
  const [gangs, setGangs] = useState<GangLeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = tab === 'players' ? fetchPlayerLeaderboard(playerMetric) : fetchGangLeaderboard(gangMetric);
    request
      .then((payload) => {
        if (cancelled) return;
        if (tab === 'players') setPlayers(payload as PlayerLeaderboardResponse);
        else setGangs(payload as GangLeaderboardResponse);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : 'Leaderboard could not be loaded.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gangMetric, playerMetric, tab]);

  const activeRows = tab === 'players' ? players?.players || [] : gangs?.gangs || [];
  const podium = activeRows.slice(0, 3);
  const remaining = activeRows.slice(3);
  const metricOptions = tab === 'players' ? PLAYER_METRICS : GANG_METRICS;
  const currentMetric = tab === 'players' ? playerMetric : gangMetric;

  const summaryCards = useMemo(() => {
    if (tab === 'players') {
      const summary = players?.summary;
      return [
        { label: 'Account players', value: fmt(summary?.totalAccounts || 0), icon: 'profile' as const },
        { label: 'Active recently', value: fmt(summary?.activeRecent || 0), icon: 'clock' as const },
        { label: 'Total earnings', value: `${compact(summary?.totalEarnings || 0)} $`, icon: 'wallet' as const },
        { label: 'Fleet value', value: `${compact(summary?.totalFleetValue || 0)} $`, icon: 'car' as const },
      ];
    }
    const summary = gangs?.summary;
    return [
      { label: 'Ranked gangs', value: fmt(summary?.totalGangs || 0), icon: 'gangs' as const },
      { label: 'Total members', value: fmt(summary?.totalMembers || 0), icon: 'profile' as const },
      { label: 'Dirty earned', value: `${compact(summary?.totalDirtyEarned || 0)} $`, icon: 'wallet' as const },
      { label: 'Stock value', value: `${compact(summary?.totalStockValue || 0)} $`, icon: 'package' as const },
    ];
  }, [gangs, players, tab]);

  return (
    <div className="min-h-screen px-4 pb-12 pt-24 sm:px-6 md:px-8">
      <div className="mx-auto max-w-[1260px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="section-kicker">City rankings</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.055em] text-white sm:text-6xl">Who controls the city?</h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/42">Only saved accounts are ranked. Switch categories to compare City Level, money, careers, gangs and long-term activity.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-[18px] border border-white/[0.07] bg-black/25 p-1.5">
              <button type="button" onClick={() => setTab('players')} className={`rounded-[14px] px-5 py-3 text-sm font-black ${tab === 'players' ? 'bg-[var(--accent)] text-[#10140b]' : 'text-white/45 hover:text-white'}`}>Top Players</button>
              <button type="button" onClick={() => setTab('gangs')} className={`rounded-[14px] px-5 py-3 text-sm font-black ${tab === 'gangs' ? 'bg-[var(--accent)] text-[#10140b]' : 'text-white/45 hover:text-white'}`}>Top Gangs</button>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summaryCards.map((card) => (
            <div key={card.label} className="game-panel-soft p-4">
              <div className="flex items-center gap-2 text-white/28"><CityIcon name={card.icon} className="h-4 w-4" /><p className="text-[9px] font-black uppercase tracking-[0.15em]">{card.label}</p></div>
              <p className="mt-3 text-2xl font-black tracking-[-0.035em] text-white">{card.value}</p>
            </div>
          ))}
        </section>

        <section className="game-panel-soft p-4 sm:p-5">
          <div className="flex flex-wrap gap-2">
            {metricOptions.map((metric) => (
              <button
                key={metric.id}
                type="button"
                onClick={() => tab === 'players' ? setPlayerMetric(metric.id as PlayerLeaderboardMetric) : setGangMetric(metric.id as GangLeaderboardMetric)}
                className={`rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] ${currentMetric === metric.id ? 'border-[rgba(211,255,81,0.32)] bg-[rgba(211,255,81,0.1)] text-[var(--accent)]' : 'border-white/[0.07] bg-black/20 text-white/34 hover:text-white/65'}`}
              >
                {metric.label}
              </button>
            ))}
          </div>
        </section>

        {error ? <section className="rounded-[20px] border border-red-400/20 bg-red-500/[0.06] p-5 text-sm font-bold text-red-100">{error}</section> : null}

        {loading ? (
          <section className="game-panel-soft p-12 text-center text-sm font-black uppercase tracking-[0.16em] text-white/30">Loading rankings...</section>
        ) : activeRows.length === 0 ? (
          <section className="game-panel-soft p-12 text-center"><p className="text-xl font-black text-white">No ranked entries yet</p><p className="mt-2 text-sm text-white/35">Create an account and progress in the city to enter the rankings.</p></section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-3">
              {podium.map((entry, index) => tab === 'players'
                ? <PlayerPodium key={(entry as LeaderboardPlayer).playerId} player={entry as LeaderboardPlayer} position={index + 1} metric={playerMetric} />
                : <GangPodium key={(entry as LeaderboardGang).playerId} gang={entry as LeaderboardGang} position={index + 1} metric={gangMetric} />)}
            </section>

            <section className="game-panel-soft overflow-hidden">
              <div className="flex items-end justify-between gap-4 border-b border-white/[0.07] p-5 sm:p-6">
                <div><p className="section-kicker">Top 10</p><h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Ranks 4 to 10</h2></div>
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.13em] text-white/35">{tab === 'players' ? players?.metricLabel : gangs?.metricLabel}</span>
              </div>
              <div className="divide-y divide-white/[0.06]">
                {remaining.map((entry) => tab === 'players'
                  ? <PlayerRow key={(entry as LeaderboardPlayer).playerId} player={entry as LeaderboardPlayer} metric={playerMetric} />
                  : <GangRow key={(entry as LeaderboardGang).playerId} gang={entry as LeaderboardGang} metric={gangMetric} />)}
                {remaining.length === 0 ? <p className="p-7 text-center text-sm text-white/30">Only podium entries are available right now.</p> : null}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
