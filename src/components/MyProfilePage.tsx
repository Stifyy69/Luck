import { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import SharedStatsPanel from './SharedStatsPanel';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

export default function MyProfilePage() {
  const { player, playerId, refresh } = usePlayer();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = String(player?.displayName || 'Player');

  const openRename = () => {
    setNameInput(displayName);
    setError(null);
    setEditing(true);
  };

  const submitRename = async () => {
    const nextName = nameInput.trim();
    if (!nextName) {
      setError('Name cannot be empty.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await api.playerRename(playerId, nextName);
      refresh();
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not update name.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      <div className="mx-auto max-w-[1040px] space-y-4">
        <div className="hud-panel p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Profile</p>
          <h1 className="text-3xl font-black text-white">{displayName}</h1>
          <p className="mt-1 text-xs text-white/50">Click Player ID to change display name.</p>
          {!player ? (
            <p className="mt-2 text-sm text-white/60">Loading profile...</p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={openRename}
                className="rounded-xl border border-white/10 bg-black/20 p-3 text-left transition hover:border-[#ffd95a]/35 hover:bg-black/30"
              >
                <p className="text-[11px] uppercase tracking-widest text-white/45">Display Name</p>
                <p className="mt-1 truncate text-sm font-black text-white">{displayName}</p>
                <p className="mt-1 truncate text-[10px] text-white/50">ID: {player.playerId}</p>
                <p className="mt-1 text-[10px] uppercase tracking-[0.15em] text-[#ffd95a]">Edit Name</p>
              </button>
              <InfoCard label="Clean Money" value={`${fmt(player.cleanMoney)} $`} />
              <InfoCard label="FlowCoins" value={fmt(player.flowCoins)} />
              <InfoCard label="Fragments" value={fmt(player.rouletteFragments)} />
            </div>
          )}
        </div>

        <SharedStatsPanel />
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-md p-6">
            <p className="text-xs uppercase tracking-[0.2em] text-white/45">Rename Profile</p>
            <h3 className="mt-2 text-xl font-black text-white">Set display name</h3>
            <input
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value.slice(0, 32))}
              placeholder="Enter name"
              className="mt-4 w-full rounded-xl border border-white/15 bg-black/25 px-3 py-2.5 text-sm font-semibold text-white outline-none transition focus:border-[#ffd95a]/45"
            />
            {error && <p className="mt-2 text-xs font-semibold text-red-300">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:brightness-110"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRename}
                disabled={saving}
                className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
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
