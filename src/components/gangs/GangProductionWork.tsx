import GangBatchCard from './GangBatchCard';

export default function GangProductionWork({
  busy,
  noMembers,
  batches,
  maximums,
  onCollect,
  onBatchChange,
  onProcess,
}: {
  busy: boolean;
  noMembers: boolean;
  batches: { white: number; blue: number };
  maximums: { white: number; blue: number };
  onCollect: () => void;
  onBatchChange: (type: 'white' | 'blue', value: number) => void;
  onProcess: (type: 'white' | 'blue', batches: number) => void;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-5">
        <div className="flex items-start justify-between gap-3"><p className="text-lg font-black text-white">Leaves</p><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]/65">+1h</span></div>
        <p className="mt-3 min-h-[40px] text-xs font-bold leading-5 text-white/38">Farming and Leadership</p>
        <button type="button" disabled={busy || noMembers} onClick={onCollect} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-35">Collect</button>
      </div>
      <GangBatchCard title="White Packs" inputLabel="1,200 Leaves" outputLabel="400 White" dirtyCost={900_000} maximum={maximums.white} value={batches.white} disabled={busy || noMembers || maximums.white <= 0} onChange={(value) => onBatchChange('white', value)} onProcess={() => onProcess('white', batches.white)} />
      <GangBatchCard title="Blue Packs" inputLabel="400 White" outputLabel="800 Blue" dirtyCost={100_000} maximum={maximums.blue} value={batches.blue} disabled={busy || noMembers || maximums.blue <= 0} onChange={(value) => onBatchChange('blue', value)} onProcess={() => onProcess('blue', batches.blue)} />
    </section>
  );
}
