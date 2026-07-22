import { useMemo, useState } from 'react';
import { calculateMaxProcessingBatches, type GangProcessingType, type GangWorkCategory } from '../../lib/gangWork';
import GangCombatWork from './GangCombatWork';
import GangMiningWork from './GangMiningWork';
import GangProductionWork from './GangProductionWork';

const CATEGORY_LABELS: Record<GangWorkCategory, string> = { production: 'Production', mining: 'Mining', combat: 'Combat' };

export default function GangWorkPanel({
  busy,
  memberCount,
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
  levelIndex: number;
  transportMembers: number;
  onTransportMembersChange: (value: number) => void;
  storage: { frunze: number; white: number; sulfur: number; ironOre: number };
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

  const setBatchValue = (type: GangProcessingType, value: number) => {
    const maximum = Math.max(0, maximums[type]);
    setBatches((current) => ({ ...current, [type]: Math.max(1, Math.min(maximum || 1, Math.floor(value || 1))) }));
  };

  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="section-kicker">Gang work</p><h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Operations</h1></div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/[0.07] bg-black/25 p-1">
            {(Object.keys(CATEGORY_LABELS) as GangWorkCategory[]).map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-[0.11em] ${category === item ? 'bg-[var(--accent)] text-black' : 'text-white/38'}`}>{CATEGORY_LABELS[item]}</button>)}
          </div>
        </div>
      </section>
      {category === 'production' ? <GangProductionWork busy={busy} noMembers={noMembers} batches={batches} maximums={maximums} onCollect={onCollect} onBatchChange={setBatchValue} onProcess={onProcess} /> : null}
      {category === 'mining' ? <GangMiningWork busy={busy} noMembers={noMembers} batches={batches} maximums={maximums} onMining={onMining} onBatchChange={setBatchValue} onProcess={onProcess} /> : null}
      {category === 'combat' ? <GangCombatWork busy={busy} noMembers={noMembers} levelIndex={levelIndex} memberCount={memberCount} transportMembers={transportMembers} onTransportMembersChange={onTransportMembersChange} onTransport={onTransport} onOpenBattles={onOpenBattles} /> : null}
    </div>
  );
}
