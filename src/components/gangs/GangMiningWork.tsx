import type { GangProcessingType } from '../../lib/gangWork';
import GangActionCard from './GangActionCard';
import GangBatchCard from './GangBatchCard';

export default function GangMiningWork({
  busy,
  noMembers,
  storage,
  batches,
  maximums,
  onMining,
  onBatchChange,
  onProcess,
}: {
  busy: boolean;
  noMembers: boolean;
  storage: { sulfur: number; ironOre: number };
  batches: Record<GangProcessingType, number>;
  maximums: Record<GangProcessingType, number>;
  onMining: () => void;
  onBatchChange: (type: GangProcessingType, value: number) => void;
  onProcess: (type: GangProcessingType, batches: number) => void;
}) {
  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-3">
      <GangActionCard
        title="Diver Miner"
        duration="+30m"
        description="Sends a crew underwater to recover Sulfur and Iron Ore."
        stats={[
          { label: 'Sulfur', value: '30 to 70' },
          { label: 'Iron Ore', value: '30 to 70' },
          { label: 'Members', value: noMembers ? 'None available' : 'Automatic crew' },
          { label: 'Risk', value: 'Current haul only' },
        ]}
        buttonLabel="Start mining"
        disabled={busy || noMembers}
        onClick={onMining}
      />
      <GangBatchCard
        title="Gunpowder"
        duration="+30m"
        inputName="Sulfur"
        inputAvailable={storage.sulfur}
        inputPerBatch={5}
        outputName="Gunpowder"
        outputPerBatch={1}
        dirtyCostPerBatch={0}
        maximum={maximums.gunpowder}
        value={batches.gunpowder}
        busy={busy || noMembers}
        onChange={(value) => onBatchChange('gunpowder', value)}
        onProcess={(value) => onProcess('gunpowder', value)}
      />
      <GangBatchCard
        title="Steel"
        duration="+30m"
        inputName="Iron Ore"
        inputAvailable={storage.ironOre}
        inputPerBatch={5}
        outputName="Steel"
        outputPerBatch={1}
        dirtyCostPerBatch={0}
        maximum={maximums.steel}
        value={batches.steel}
        busy={busy || noMembers}
        onChange={(value) => onBatchChange('steel', value)}
        onProcess={(value) => onProcess('steel', value)}
      />
    </section>
  );
}
