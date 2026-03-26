import { usePlayer } from '../hooks/usePlayer';
import SharedStatsPanel from './SharedStatsPanel';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

export default function MyProfilePage() {
  const { player } = usePlayer();

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      <div className="mx-auto max-w-[1040px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Profile</p>
          <h1 className="text-3xl font-black text-white">My Profile</h1>
          {!player ? (
            <p className="mt-2 text-sm text-white/60">Loading profile...</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <InfoCard label="Player ID" value={player.playerId} />
              <InfoCard label="Clean Money" value={`${fmt(player.cleanMoney)} $`} />
              <InfoCard label="FlowCoins" value={fmt(player.flowCoins)} />
              <InfoCard label="Fragments" value={fmt(player.rouletteFragments)} />
            </div>
          )}
        </div>

        <SharedStatsPanel />
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[11px] uppercase tracking-widest text-white/45">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-white">{value}</p>
    </div>
  );
}
