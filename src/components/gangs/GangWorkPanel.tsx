import { useEffect, useMemo, useState } from 'react';
import { calculateMaxProcessingBatches, type GangProcessingType, type GangWorkCategory } from '../../lib/gangWork';
import GangCombatWork from './GangCombatWork';
import GangMiningWork from './GangMiningWork';
import GangProductionWork from './GangProductionWork';
import GangStockBar, { type GangStockSnapshot } from './GangStockBar';

const CATEGORY_LABELS: Record<GangWorkCategory, string> = { production: 'Production', mining: 'Mining', combat: 'Combat' };

export default function GangWorkPanel({
  busy,
  memberCount,
  injuredCount,
  workingCount,
  levelIndex,
  transportMembers,
  onTransportMembersChange,
  storage,
  dirtyBalance,
  onCollect,
  onMining,
  onTransport,
  onProcess,
  onOpenBattles,
}: {
  busy: boolean;
  memberCount: number;
  injuredCount: number;
  workingCount: number;
  levelIndex: number;
  transportMembers: number;
  onTransportMembersChange: (value: number) => void;
  storage: GangStockSnapshot;
  dirtyBalance: number;
  onCollect: () => void;
  onMining: () => void;
  onTransport: () => void;
  onProcess: (type: GangProcessingType, batches: number) => void;
  onOpenBattles: () => void;
}) {
  const [category, setCategory] = useState<GangWorkCategory>('production');
  const [batches, setBatches] = useState<Record<GangProcessingType, number>>({ white: 1, blue: 1, gunpowder: 1, steel: 1 });
  const noMembers = memberCount <= 0;
  const maximums = useMemo(() => ({
    white: calculateMaxProcessingBatches('white', storage, dirtyBalance),
    blue: calculateMaxProcessingBatches('blue', storage, dirtyBalance),
    gunpowder: calculateMaxProcessingBatches('gunpowder', storage, dirtyBalance),
    steel: calculateMaxProcessingBatches('steel', storage, dirtyBalance),
  }), [storage.frunze, storage.white, storage.sulfur, storage.ironOre, dirtyBalance]);

  useEffect(() => {
    setBatches((current) => {
      const next = { ...current };
      (Object.keys(maximums) as GangProcessingType[]).forEach((type) => {
        next[type] = maximums[type] <= 0 ? 0 : Math.max(1, Math.min(maximums[type], current[type] || 1));
      });
      return next;
    });
  }, [maximums.white, maximums.blue, maximums.gunpowder, maximums.steel]);

  const setBatchValue = (type: GangProcessingType, value: number) => {
    const maximum = maximums[type];
    setBatches((current) => ({ ...current, [type]: maximum <= 0 ? 0 : Math.max(1, Math.min(maximum, Math.floor(value || 1))) }));
  };

  return (
    <div className="space-y-4">
      <section className="game-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-kicker">Gang work</p>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Choose an operation</h1>
          </div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.07] bg-black/25 p-1">
            {(Object.keys(CATEGORY_LABELS) as GangWorkCategory[]).map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={`min-w-[92px] rounded-xl px-3 py-2.5 text-[9px] font-black uppercase tracking-[0.11em] ${category === item ? 'bg-[var(--accent)] text-black' : 'text-white/38 hover:text-white/70'}`}>{CATEGORY_LABELS[item]}</button>
            ))}
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <HeaderStat label="Gang dirty" value={dirtyBalance.toLocaleString('en-US')} />
          <HeaderStat label="Available" value={String(memberCount)} />
          <HeaderStat label="Working" value={String(workingCount)} />
          <HeaderStat label="Injured" value={String(injuredCount)} />
        </div>
      </section>

      <GangStockBar storage={storage} />

      {category === 'production' ? <GangProductionWork busy={busy} noMembers={noMembers} storage={storage} batches={batches} maximums={maximums} onCollect={onCollect} onBatchChange={setBatchValue} onProcess={onProcess} /> : null}
      {category === 'mining' ? <GangMiningWork busy={busy} noMembers={noMembers} storage={storage} batches={batches} maximums={maximums} onMining={onMining} onBatchChange={setBatchValue} onProcess={onProcess} /> : null}
      {category === 'combat' ? <GangCombatWork busy={busy} noMembers={noMembers} levelIndex={levelIndex} memberCount={memberCount} transportMembers={transportMembers} onTransportMembersChange={onTransportMembersChange} onTransport={onTransport} onOpenBattles={onOpenBattles} /> : null}
    </div>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">{label}</p><p className="mt-1 truncate text-xs font-black text-white/72">{value}</p></div>;
}
