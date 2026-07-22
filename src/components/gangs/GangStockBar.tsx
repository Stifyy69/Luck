import type { GangResource } from '../../types/gang';

const labels: Array<[GangResource, string]> = [
  ['leaves', 'Leaves'], ['white', 'White'], ['blue', 'Blue'], ['sulfur', 'Sulfur'],
  ['ironOre', 'Iron Ore'], ['gunpowder', 'Gunpowder'], ['steel', 'Steel'],
];

export default function GangStockBar({ resources }: { resources: Record<GangResource, number> }) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/25 p-3 sm:grid-cols-4 xl:grid-cols-7" aria-label="Gang stock">
      {labels.map(([key, label]) => (
        <div key={key} className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
          <p className="truncate text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</p>
          <p className="mt-1 truncate text-base font-black">{resources[key].toLocaleString('ro-RO')}</p>
        </div>
      ))}
    </div>
  );
}
