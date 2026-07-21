export default function GangWorkPanel({
  busy,
  memberCount,
  transportMembers,
  onTransportMembersChange,
  storage,
  dirtyBalance,
  onCollect,
  onMining,
  onTransport,
  onWhite,
  onBlue,
  onGunpowder,
  onSteel,
}: {
  busy: boolean;
  memberCount: number;
  transportMembers: number;
  onTransportMembersChange: (value: number) => void;
  storage: { frunze: number; white: number; sulfur: number; ironOre: number };
  dirtyBalance: number;
  onCollect: () => void;
  onMining: () => void;
  onTransport: () => void;
  onWhite: () => void;
  onBlue: () => void;
  onGunpowder: () => void;
  onSteel: () => void;
}) {
  const noMembers = memberCount <= 0;
  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <p className="section-kicker">Gang work</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Choose an operation.</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/40">
          Activity durations add to the existing game-time hours. They are not real-world waiting times.
        </p>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          <WorkCard title="Gang leaf farm" detail="Farming and Leadership affect the harvest. Adds 1h game time." button="Start farming" disabled={busy || noMembers} onClick={onCollect} />
          <WorkCard title="Diver Miner" detail="Produces 30-70 Sulfur and 30-70 Iron Ore. Adds 30m game time." button="Start mining" disabled={busy || noMembers} onClick={onMining} />
          <div className="rounded-[22px] border border-amber-300/15 bg-amber-400/[0.045] p-4">
            <p className="text-lg font-black text-white">Illegal Transport</p>
            <p className="mt-2 text-xs leading-relaxed text-white/38">100,000 to 5,000,000 dirty cash. More members increase payout and police exposure.</p>
            <div className="mt-4 rounded-xl border border-white/[0.07] bg-black/20 p-3">
              <div className="flex items-center justify-between text-xs"><span className="font-bold text-white/40">Assigned members</span><span className="font-black text-amber-100">{transportMembers}</span></div>
              <input
                type="range"
                min={1}
                max={Math.max(1, memberCount)}
                value={Math.min(Math.max(1, transportMembers), Math.max(1, memberCount))}
                disabled={busy || noMembers}
                onChange={(event) => onTransportMembersChange(Number(event.target.value))}
                className="mt-3 w-full accent-[var(--accent)]"
              />
            </div>
            <button type="button" disabled={busy || noMembers} onClick={onTransport} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-35">Start transport</button>
          </div>
        </div>
      </section>

      <section className="game-panel-soft p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--accent)]/65">Processing</p>
        <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">Convert gang materials.</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ProcessCard title="White packs" detail="1200 Leaves + 900,000 dirty per batch" available={Math.floor(storage.frunze / 1200)} disabled={busy || storage.frunze < 1200 || dirtyBalance < 900_000} onClick={onWhite} />
          <ProcessCard title="Blue packs" detail="400 White + 100,000 dirty per batch" available={Math.floor(storage.white / 400)} disabled={busy || storage.white < 400 || dirtyBalance < 100_000} onClick={onBlue} />
          <ProcessCard title="Gunpowder" detail="5 Sulfur = 1 Gunpowder" available={Math.floor(storage.sulfur / 5)} disabled={busy || storage.sulfur < 5} onClick={onGunpowder} />
          <ProcessCard title="Steel" detail="5 Iron Ore = 1 Steel" available={Math.floor(storage.ironOre / 5)} disabled={busy || storage.ironOre < 5} onClick={onSteel} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/30">A police raid destroys only the batch currently being processed. Existing storage remains untouched.</p>
      </section>
    </div>
  );
}

function WorkCard({ title, detail, button, disabled, onClick }: { title: string; detail: string; button: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-4">
      <p className="text-lg font-black text-white">{title}</p>
      <p className="mt-2 min-h-[48px] text-xs leading-relaxed text-white/38">{detail}</p>
      <button type="button" disabled={disabled} onClick={onClick} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-35">{button}</button>
    </div>
  );
}

function ProcessCard({ title, detail, available, disabled, onClick }: { title: string; detail: string; available: number; disabled: boolean; onClick: () => void }) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-[10px] leading-4 text-white/35">{detail}</p>
      <p className="mt-3 text-[9px] font-black uppercase tracking-[0.13em] text-white/25">Available batches: {Math.max(0, available)}</p>
      <button type="button" disabled={disabled} onClick={onClick} className="btn-ghost mt-3 w-full rounded-xl px-3 py-2.5 text-[10px] disabled:opacity-30">Process all</button>
    </div>
  );
}
