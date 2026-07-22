export type GangStockSnapshot = {
  frunze: number;
  white: number;
  blue: number;
  sulfur: number;
  ironOre: number;
  gunpowder: number;
  steel: number;
};

const STOCK_ITEMS: Array<{ key: keyof GangStockSnapshot; label: string; price?: number }> = [
  { key: 'frunze', label: 'Leaves' },
  { key: 'white', label: 'White' },
  { key: 'blue', label: 'Blue', price: 2_300 },
  { key: 'sulfur', label: 'Sulfur' },
  { key: 'ironOre', label: 'Iron Ore' },
  { key: 'gunpowder', label: 'Gunpowder', price: 5_000 },
  { key: 'steel', label: 'Steel', price: 6_000 },
];

export default function GangStockBar({ storage, title = 'Current stock' }: { storage: GangStockSnapshot; title?: string }) {
  return (
    <section className="game-panel-soft p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="section-kicker">{title}</p>
        <span className="text-[8px] font-black uppercase tracking-[0.11em] text-white/22">Server stock</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {STOCK_ITEMS.map((item) => (
          <div key={item.key} className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-3">
            <p className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-white/28">{item.label}</p>
            <p className="mt-1 text-base font-black text-white">{storage[item.key].toLocaleString('en-US')}</p>
            {item.price ? <p className="mt-0.5 text-[8px] font-bold text-[var(--accent)]/55">{item.price.toLocaleString('en-US')} dirty</p> : null}
          </div>
        ))}
      </div>
    </section>
  );
}
