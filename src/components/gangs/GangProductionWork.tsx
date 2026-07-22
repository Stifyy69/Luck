import type { GangProcessingType } from '../../lib/gangWork';
import GangActionCard from './GangActionCard';
import GangBatchCard from './GangBatchCard';

export default function GangProductionWork({
  busy,
  noMembers,
  storage,
  batches,
  maximums,
  onCollect,
  onBatchChange,
  onProcess,
}: {
  busy: boolean;
  noMembers: boolean;
  storage: { frunze: number; white: number };
  batches: Record<GangProcessingType, number>;
  maximums: Record<GangProcessingType, number>;
  onCollect: () => void;
  onBatchChange: (type: GangProcessingType, value: number) => void;
  onProcess: (type: GangProcessingType, batches: number) => void;
}) {
  return (
    <section className="grid items-stretch gap-3 lg:grid-cols-3">
      <GangActionCard
        title="Collect Leaves"
        duration="+1h"
        description="Assigns available members to collect Leaves. Farming and Leadership improve the result."
        stats={[
          { label: 'Input', value: 'No materials' },
          { label: 'Output', value: 'Leaves' },
          { label: 'Members', value: noMembers ? 'None available' : 'Automatic crew' },
          { label: 'Risk', value: 'Current harvest only' },
        ]}
        buttonLabel="Collect Leaves"
        disabled={busy || noMembers}
        onClick={onCollect}
      />
      <GangBatchCard
        title="White Packs"
        duration="+30m"
        inputName="Leaves"
        inputAvailable={storage.frunze}
        inputPerBatch={1_200}
        outputName="White"
        outputPerBatch={400}
        dirtyCostPerBatch={900_000}
        maximum={maximums.white}
        value={batches.white}
        busy={busy || noMembers}
        onChange={(value) => onBatchChange('white', value)}
        onProcess={(value) => onProcess('white', value)}
      />
      <GangBatchCard
        title="Blue Packs"
        duration="+30m"
        inputName="White"
        inputAvailable={storage.white}
        inputPerBatch={400}
        outputName="Blue"
        outputPerBatch={800}
        dirtyCostPerBatch={100_000}
        maximum={maximums.blue}
        value={batches.blue}
        busy={busy || noMembers}
        onChange={(value) => onBatchChange('blue', value)}
        onProcess={(value) => onProcess('blue', value)}
      />
    </section>
  );
}
