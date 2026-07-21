import { useMemo, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import { replayCityTutorial } from '../lib/cityProgressApi';
import { readPlayerCityProgress } from '../lib/cityProgress';
import SharedStatsPanel from './SharedStatsPanel';

function fmt(n: number) {
  return n.toLocaleString('en-US');
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'CF';
  return parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function MyProfilePage() {
  const { player, playerId, refresh } = usePlayer();
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = String(player?.displayName || 'Player');
  const cityProgress = readPlayerCityProgress(player);
  const fleetValue = useMemo(
    () => (player?.ownedVehicles || []).reduce((total, vehicle) => total + Number(vehicle.purchasePrice || 0), 0),
    [player?.ownedVehicles],
  );
  const knownWealth = Number(player?.cleanMoney || 0) + fleetValue;
  const inventoryUnits = useMemo(
    () => (player?.inventory || []).reduce((total, item) => total + Number(item.quantity || 0), 0),
    [player?.inventory],
  );
  const latestVehicle = player?.ownedVehicles?.[0] || null;
  const slotUsage = player ? `${player.usedSlots} / ${player.totalSlots}` : '0 / 0';

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

  const replayTutorial = async () => {
    if (tutorialBusy) return;
    setTutorialBusy(true);
    setError(null);
    try {
      await replayCityTutorial(playerId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not restart tutorial.');
    } finally {
      setTutorialBusy(false);
    }
  };

  return (
    <div className="min-h-screen px-4 pb-10 pt-20 sm:px-6 md:px-8 md:pb-12 md:pt-8">
      <div className="mx-auto max-w-[1220px] space-y-5">
        <section className="game-panel relative overflow-hidden p-5 sm:p-7 lg:p-9">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-[var(--accent)] opacity-[0.07] blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.35fr_0.65fr] lg:items-end">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="section-kicker">City identity</p>
                <span className="rounded-full border border-[rgba(114,227,154,0.2)] bg-[rgba(114,227,154,0.07)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--money)]">Resident active</span>
                <span className="rounded-full border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.06)] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]">City Level {cityProgress?.level || 1}</span>
              </div>

              <div className="mt-6 flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="relative inline-flex h-24 w-24 shrink-0 items-center justify-center rounded-[28px] border border-[rgba(211,255,81,0.3)] bg-[var(--accent)] text-3xl font-black tracking-[-0.05em] text-[#10140b] shadow-[0_18px_50px_rgba(182,237,37,0.15)]">
                  {initials(displayName)}
                  <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-4 border-[#111511] bg-[var(--money)]" />
                </div>

                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/34">Citizen profile</p>
                  <h1 className="mt-1 truncate text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl">{displayName}</h1>
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-white/42">
                    <span>City ID {player?.playerId || playerId}</span>
                    <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
                    <span>{player?.ownedVehicles?.length || 0} vehicles owned</span>
                    <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
                    <span>{inventoryUnits} inventory units</span>
                  </div>
                </div>
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <button type="button" onClick={openRename} className="btn-primary rounded-2xl px-5 py-3 text-sm">Edit identity</button>
                <button type="button" onClick={() => replayTutorial().catch(() => {})} disabled={tutorialBusy} className="btn-ghost rounded-2xl px-5 py-3 text-sm disabled:opacity-40">{tutorialBusy ? 'Loading tutorial...' : 'Replay tutorial'}</button>
                <a href="/inventory" className="btn-ghost rounded-2xl px-5 py-3 text-sm no-underline">Open inventory</a>
                <a href="/showroom" className="btn-ghost rounded-2xl px-5 py-3 text-sm no-underline">Visit showroom</a>
              </div>
              {error && !editing ? <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs font-semibold text-red-200">{error}</p> : null}
            </div>

            <div className="rounded-[22px] border border-white/[0.08] bg-black/25 p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/30">Known net worth</p>
              <p className="mt-2 text-4xl font-black tracking-[-0.045em] text-white">{fmt(knownWealth)} $</p>
              <p className="mt-2 text-xs leading-relaxed text-white/38">Cash plus the recorded purchase value of your current fleet.</p>
              <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[0.07] pt-4">
                <MiniStat label="Cash ready" value={`${fmt(player?.cleanMoney || 0)} $`} tone="money" />
                <MiniStat label="Fleet value" value={`${fmt(fleetValue)} $`} />
              </div>
            </div>
          </div>
        </section>

        {!player ? (
          <section className="game-panel-soft p-6">
            <p className="text-sm font-semibold text-white/45">Loading your city profile...</p>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
            <div className="game-panel-soft p-5 sm:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="section-kicker">Asset snapshot</p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">What you control</h2>
                </div>
                <a href="/cnn" className="text-xs font-black uppercase tracking-[0.12em] text-[var(--accent)] no-underline">Open market ›</a>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
                <ProfileStat label="Clean money" value={`${fmt(player.cleanMoney)} $`} accent="money" />
                <ProfileStat label="FlowCoins" value={fmt(player.flowCoins)} />
                <ProfileStat label="Fragments" value={fmt(player.rouletteFragments)} />
                <ProfileStat label="Garage slots" value={slotUsage} />
              </div>

              <div className="mt-7 rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/28">Featured vehicle</p>
                    <p className="mt-1 text-lg font-black text-white">{latestVehicle ? `${latestVehicle.brand} ${latestVehicle.modelName}` : 'No vehicle in garage'}</p>
                    <p className="mt-1 text-xs text-white/38">
                      {latestVehicle ? `Acquired via ${latestVehicle.acquisitionSource || 'UNKNOWN'} for ${fmt(latestVehicle.purchasePrice)} $.` : 'Your first major status upgrade starts in the showroom.'}
                    </p>
                  </div>
                  <a href="/showroom" className="btn-secondary rounded-xl px-4 py-2.5 text-xs no-underline">
                    {latestVehicle ? 'Manage garage' : 'Buy first car'}
                  </a>
                </div>
              </div>
            </div>

            <div className="game-panel-soft p-5 sm:p-6">
              <p className="section-kicker">City access</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Ready for action</h2>
              <div className="mt-5 space-y-3">
                <QuickLink href="/pizzer" code="PZ" title="Courier shift" detail="Build cash and a delivery streak." />
                <QuickLink href="/fisher" code="FS" title="Fishing run" detail="Unlocks at City Level 3." />
                <QuickLink href="/pilot" code="PL" title="Pilot route" detail="Unlocks at City Level 6." />
              </div>
            </div>
          </section>
        )}

        <SharedStatsPanel />
      </div>

      {editing && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="game-panel w-full max-w-md overflow-hidden">
            <div className="border-b border-white/[0.07] p-6">
              <p className="section-kicker">Identity update</p>
              <h3 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Change display name</h3>
              <p className="mt-2 text-sm text-white/42">This is the name other players will associate with your profile and assets.</p>
            </div>
            <div className="p-6">
              <label className="block">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.16em] text-white/32">Display name</span>
                <input
                  value={nameInput}
                  onChange={(event: { target: { value: string } }) => setNameInput(event.target.value.slice(0, 32))}
                  placeholder="Enter name"
                  className="input-dark w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none"
                  autoFocus
                />
              </label>
              {error && <p className="mt-3 rounded-xl border border-red-400/20 bg-red-500/[0.07] px-3 py-2 text-xs font-semibold text-red-200">{error}</p>}
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => setEditing(false)} className="btn-ghost flex-1 rounded-2xl px-4 py-3 text-sm">Cancel</button>
                <button type="button" onClick={() => submitRename().catch(() => {})} disabled={saving} className="btn-primary flex-[1.3] rounded-2xl px-4 py-3 text-sm disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save identity'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone?: 'money' }) {
  return (
    <div>
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/27">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${tone === 'money' ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function ProfileStat({ label, value, accent }: { label: string; value: string; accent?: 'money' }) {
  return (
    <div className="stat-tile">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-white/28">{label}</p>
      <p className={`mt-2 truncate text-xl font-black tracking-[-0.025em] ${accent === 'money' ? 'text-[var(--money)]' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function QuickLink({ href, code, title, detail }: { href: string; code: string; title: string; detail: string }) {
  return (
    <a href={href} className="game-card-interactive flex items-center gap-3 p-3.5 no-underline">
      <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] border border-[rgba(211,255,81,0.22)] bg-[rgba(211,255,81,0.07)] text-[11px] font-black tracking-[0.08em] text-[var(--accent)]">{code}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black text-white">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-white/36">{detail}</span>
      </span>
      <span className="text-lg text-white/20">›</span>
    </a>
  );
}
