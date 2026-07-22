import { useEffect, useMemo, useState } from 'react';
import GangStockBar, { type GangStockSnapshot } from './GangStockBar';

export type SellableGangMaterial = 'blue' | 'gunpowder' | 'steel';

type StorageItem = {
  key: keyof GangStockSnapshot;
  label: string;
  use: string;
  price?: number;
  sellType?: SellableGangMaterial;
};

const ITEMS: StorageItem[] = [
  { key: 'frunze', label: 'Leaves', use: 'Used for White processing' },
  { key: 'white', label: 'White Packs', use: 'Used for Blue processing' },
  { key: 'blue', label: 'Blue Packs', use: 'Sellable product', price: 2_300, sellType: 'blue' },
  { key: 'sulfur', label: 'Sulfur', use: 'Used for Gunpowder' },
  { key: 'ironOre', label: 'Iron Ore', use: 'Used for Steel' },
  { key: 'gunpowder', label: 'Gunpowder', use: 'Sell now or keep for weapon crafting', price: 5_000, sellType: 'gunpowder' },
  { key: 'steel', label: 'Steel', use: 'Sell now or keep for weapon crafting', price: 6_000, sellType: 'steel' },
];

export default function GangStoragePanel({
  storage,
  busy,
  onSell,
}: {
  storage: GangStockSnapshot;
  busy: boolean;
  onSell: (type: SellableGangMaterial, quantity: number) => Promise<void> | void;
}) {
  const [selectedType, setSelectedType] = useState<SellableGangMaterial | null>(null);
  const [amount, setAmount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const selectedItem = ITEMS.find((item) => item.sellType === selectedType) || null;
  const available = selectedItem ? storage[selectedItem.key] : 0;
  const price = selectedItem?.price || 0;
  const quantity = available > 0 ? Math.max(1, Math.min(available, Math.floor(amount || 1))) : 0;

  useEffect(() => {
    if (selectedType && available <= 0) setSelectedType(null);
    if (selectedType && available > 0) setAmount((current) => Math.max(1, Math.min(available, current || 1)));
  }, [selectedType, available]);

  const totalStorageValue = useMemo(() => ITEMS.reduce((sum, item) => sum + storage[item.key] * (item.price || 0), 0), [storage]);

  const openSell = (type: SellableGangMaterial) => {
    const item = ITEMS.find((entry) => entry.sellType === type);
    if (!item || storage[item.key] <= 0) return;
    setSelectedType(type);
    setAmount(1);
  };

  const submit = async (sellAll: boolean) => {
    if (!selectedType || submitting || busy || available <= 0) return;
    setSubmitting(true);
    try {
      await onSell(selectedType, sellAll ? available : quantity);
      setSelectedType(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <section className="game-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="section-kicker">Gang storage</p><h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Materials and products</h1></div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-right"><p className="text-[8px] font-black uppercase tracking-[0.1em] text-white/25">Sellable value</p><p className="mt-1 text-sm font-black text-white/72">{totalStorageValue.toLocaleString('en-US')} dirty</p></div>
        </div>
      </section>
      <GangStockBar storage={storage} title="All materials" />

      <section className="game-panel-soft overflow-hidden">
        <div className="hidden grid-cols-[1.1fr_0.65fr_1.4fr_0.8fr_0.55fr] gap-3 border-b border-white/[0.07] px-5 py-3 text-[8px] font-black uppercase tracking-[0.11em] text-white/25 md:grid">
          <span>Material</span><span>Stock</span><span>Use</span><span>Value each</span><span />
        </div>
        <div className="divide-y divide-white/[0.06]">
          {ITEMS.map((item) => {
            const stock = storage[item.key];
            return (
              <div key={item.key} className="grid gap-3 px-4 py-4 md:grid-cols-[1.1fr_0.65fr_1.4fr_0.8fr_0.55fr] md:items-center md:px-5">
                <div><p className="text-sm font-black text-white">{item.label}</p><p className="mt-1 text-[9px] text-white/28 md:hidden">{item.use}</p></div>
                <p className="text-lg font-black text-white/80">{stock.toLocaleString('en-US')}</p>
                <p className="hidden text-xs text-white/38 md:block">{item.use}</p>
                <p className="text-xs font-black text-[var(--accent)]/65">{item.price ? `${item.price.toLocaleString('en-US')} dirty` : 'Not sellable'}</p>
                <button type="button" disabled={!item.sellType || stock <= 0 || busy} onClick={() => item.sellType && openSell(item.sellType)} className="btn-ghost rounded-xl px-3 py-2.5 text-[9px] disabled:opacity-25">{item.sellType ? 'Sell' : 'Stored'}</button>
              </div>
            );
          })}
        </div>
      </section>

      {selectedItem && selectedType ? (
        <div className="fixed inset-0 z-[136] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm" onClick={() => !submitting && setSelectedType(null)}>
          <div className="game-panel w-full max-w-lg p-5 sm:p-6" onClick={(event) => event.stopPropagation()}>
            <p className="section-kicker">Sell material</p>
            <div className="mt-2 flex items-start justify-between gap-3"><div><h2 className="text-2xl font-black text-white">{selectedItem.label}</h2><p className="mt-1 text-xs text-white/38">Available: {available.toLocaleString('en-US')}</p></div><span className="rounded-full border border-emerald-300/15 bg-emerald-400/[0.05] px-3 py-1.5 text-[9px] font-black text-emerald-100">{price.toLocaleString('en-US')} each</span></div>
            <label className="mt-5 block text-[8px] font-black uppercase tracking-[0.11em] text-white/28">Quantity</label>
            <input type="number" min={1} max={available} value={quantity} disabled={submitting} onChange={(event) => setAmount(Number(event.target.value))} className="mt-2 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-3 text-sm font-black text-white outline-none" />
            <div className="mt-2 grid grid-cols-3 gap-2"><Quick label="25%" onClick={() => setAmount(Math.max(1, Math.floor(available * 0.25)))} /><Quick label="50%" onClick={() => setAmount(Math.max(1, Math.floor(available * 0.5)))} /><Quick label="ALL" onClick={() => setAmount(available)} /></div>
            <div className="mt-4 rounded-xl border border-emerald-300/12 bg-emerald-400/[0.035] p-4"><p className="text-[8px] font-black uppercase tracking-[0.11em] text-emerald-100/45">You receive</p><p className="mt-1 text-2xl font-black text-emerald-100">{(quantity * price).toLocaleString('en-US')} dirty</p></div>
            <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" disabled={submitting || busy} onClick={() => void submit(false)} className="btn-ghost rounded-xl px-4 py-3 text-[10px] disabled:opacity-30">Sell X</button><button type="button" disabled={submitting || busy} onClick={() => void submit(true)} className="btn-primary rounded-xl px-4 py-3 text-[10px] disabled:opacity-30">Sell all</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Quick({ label, onClick }: { label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="btn-ghost rounded-lg px-2 py-2 text-[9px]">{label}</button>;
}
