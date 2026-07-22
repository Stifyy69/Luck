import GangBatchCard from './GangBatchCard';

export default function GangMiningWork({
  busy,
  noMembers,
  batches,
  maximums,
  onMining,
  onBatchChange,
  onProcess,
}: {
  busy: boolean;
  noMembers: boolean;
  batches: { gunpowder: number; steel: number };
  maximums: { gunpowder: number; steel: number };
  onMining: () => void;
  onBatchChange: (type: 'gunpowder' | 'steel', value: number) => void;
  onProcess: (type: 'gunpowder' | 'steel', batches: number) => void;
}) {
  return (
    <section className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-[22px] border border-white/[0.08] bg-black/20 p-5">
        <div className="flex items-start justify-between gap-3"><p className="text-lg font-black text-white">Diver Miner</p><span className="text-[10px] font-black uppercase tracking-[0.12em] text-[var(--accent)]/65">+30m</span></div>
        <p className="mt-3 min-h-[40px] text-xs font-bold leading-5 text-white/38">30-70 Sulfur and 30-70 Iron Ore</p>
        <button type="button" disabled={busy || noMembers} onClick={onMining} className="btn-primary mt-4 w-full rounded-xl px-4 py-3 text-xs disabled:opacity-35">Start</button>
      </div>
      <GangBatchCard title="Gunpowder" inputLabel="5 Sulfur" outputLabel="1 Gunpowder" dirtyCost={0} maximum={maximums.gunpowder} value={batches.gunpowder} disabled={busy || noMembers || maximums.gunpowder <= 0} onChange={(value) => onBatchChange('gunpowder', value)} onProcess={() => onProcess('gunpowder', batches.gunpowder)} />
      <GangBatchCard title="Steel" inputLabel="5 Iron Ore" outputLabel="1 Steel" dirtyCost={0} maximum={maximums.steel} value={batches.steel} disabled={busy || noMembers || maximums.steel <= 0} onChange={(value) => onBatchChange('steel', value)} onProcess={() => onProcess('steel', batches.steel)} />
    </section>
  );
}
