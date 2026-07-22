import type { AdminPlayer, AdminPlayerDetail } from '../../lib/adminApi';

function fmt(value: number) {
  return Math.max(0, Number(value || 0)).toLocaleString('en-US');
}

export function AdminPlayerSummary({ player }: { player: AdminPlayer }) {
  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label="City Level" value={String(player.cityLevel)} accent />
      <Stat label="City XP" value={fmt(player.cityXp)} />
      <Stat label="Clean money" value={`${fmt(player.cleanMoney)} $`} money />
      <Stat label="Net worth" value={`${fmt(player.netWorth)} $`} />
      <Stat label="FlowCoins" value={fmt(player.flowCoins)} />
      <Stat label="Fragments" value={fmt(player.rouletteFragments)} />
      <Stat label="Vehicles" value={fmt(player.vehicleCount)} />
      <Stat label="Inventory" value={fmt(player.inventoryUnits)} />
    </section>
  );
}

export function AdminPlayerProgress({ detail, busy, onReset }: { detail: AdminPlayerDetail; busy: boolean; onReset: () => void }) {
  const player = detail.player;
  return (
    <>
      <section className="grid gap-5 lg:grid-cols-2">
        <div className="game-panel-soft p-5">
          <p className="section-kicker">Career snapshot</p>
          <div className="mt-4 space-y-3">
            <Career label="Pizza" level={player.pizzerLevel} value={`${player.deliveries} deliveries`} earnings={player.pizzerEarnings} />
            <Career label="Fisher" level={player.fisherLevel} value={`${player.catches} catches`} earnings={player.fisherEarnings} />
            <Career label="Pilot" level={player.pilotLevel} value={`${player.flights} flights`} earnings={player.pilotEarnings} />
          </div>
        </div>
        <div className="game-panel-soft p-5">
          <p className="section-kicker">Gang snapshot</p>
          {detail.gang ? (
            <div className="mt-4">
              <p className="text-xl font-black text-white">{detail.gang.name}</p>
              <p className="mt-1 text-xs text-white/35">{detail.gang.gangLevel} · {detail.gang.membersCount} members</p>
              <p className="mt-4 text-lg font-black text-[var(--money)]">{fmt(detail.gang.dirtyEarned)} $ dirty earned</p>
              <p className="mt-1 text-xs text-white/30">Stock value: {fmt(detail.gang.stockValue)} $</p>
            </div>
          ) : <p className="mt-4 text-sm text-white/30">No synced gang.</p>}
        </div>
      </section>
      <section className="game-panel-soft p-5">
        <div className="flex items-center justify-between gap-4">
          <div><p className="section-kicker">Tutorial state</p><h3 className="mt-2 text-xl font-black text-white">Reset onboarding</h3></div>
          <button type="button" disabled={busy} onClick={onReset} className="btn-ghost rounded-xl px-4 py-3 text-xs disabled:opacity-50">Reset tutorial</button>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, accent, money }: { label: string; value: string; accent?: boolean; money?: boolean }) {
  return <div className="rounded-[16px] border border-white/[0.07] bg-black/20 p-3"><p className="text-[8px] font-black uppercase tracking-[0.12em] text-white/25">{label}</p><p className={`mt-2 truncate text-sm font-black ${money ? 'text-[var(--money)]' : accent ? 'text-[var(--accent)]' : 'text-white'}`}>{value}</p></div>;
}

function Career({ label, level, value, earnings }: { label: string; level: number; value: string; earnings: number }) {
  return <div className="rounded-[15px] border border-white/[0.06] bg-black/20 p-3"><div className="flex items-center justify-between"><p className="text-sm font-black text-white">{label}</p><p className="text-xs font-black text-[var(--accent)]">Lv {level}</p></div><div className="mt-2 flex items-center justify-between text-[10px] text-white/30"><span>{value}</span><span>{fmt(earnings)} $</span></div></div>;
}
