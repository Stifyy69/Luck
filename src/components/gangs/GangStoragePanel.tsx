import { useState } from 'react';

export type SellableGangMaterial = 'blue' | 'gunpowder' | 'steel';

export default function GangStoragePanel({
  storage,
  onSell,
}: {
  storage: {
    frunze: number;
    white: number;
    blue: number;
    sulfur: number;
    ironOre: number;
    gunpowder: number;
    steel: number;
  };
  onSell: (type: SellableGangMaterial, quantity: number) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <p className="section-kicker">Gang storage</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Storage</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StorageCard label="Leaves" value={storage.frunze} />
          <StorageCard label="White Packs" value={storage.white} />
          <StorageCard label="Blue Packs" value={storage.blue} price="2,300 dirty" />
          <StorageCard label="Sulfur" value={storage.sulfur} />
          <StorageCard label="Iron Ore" value={storage.ironOre} />
          <StorageCard label="Gunpowder" value={storage.gunpowder} price="5,000 dirty" />
          <StorageCard label="Steel" value={storage.steel} price="6,000 dirty" />
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <SellCard type="blue" title="Blue Packs" quantity={storage.blue} price={2300} onSell={onSell} />
        <SellCard type="gunpowder" title="Gunpowder" quantity={storage.gunpowder} price={5000} onSell={onSell} />
        <SellCard type="steel" title="Steel" quantity={storage.steel} price={6000} onSell={onSell} />
      </section>
    </div>
  );
}

function StorageCard({ label, value, price }: { label: string; value: number; price?: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/28">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value.toLocaleString('en-US')}</p>
      {price ? <p className="mt-1 text-[10px] font-bold text-[var(--accent)]/60">{price} each</p> : null}
    </div>
  );
}

function SellCard({
  type,
  title,
  quantity,
  price,
  onSell,
}: {
  type: SellableGangMaterial;
  title: string;
  quantity: number;
  price: number;
  onSell: (type: SellableGangMaterial, quantity: number) => void;
}) {
  const [amount, setAmount] = useState(1);
  const selected = Math.max(1, Math.min(Math.max(1, quantity), Math.floor(amount || 1)));
  const disabled = quantity <= 0;
  const setQuick = (ratio: number) => setAmount(Math.max(1, Math.floor(quantity * ratio)));
  return (
    <div className="rounded-[22px] border border-emerald-300/10 bg-emerald-400/[0.035] p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-lg font-black text-white">{title}</p><p className="mt-1 text-[10px] font-bold text-white/35">{price.toLocaleString('en-US')} dirty each</p></div>
        <span className="text-[9px] font-black uppercase tracking-[0.12em] text-white/30">Have {quantity.toLocaleString('en-US')}</span>
      </div>
      <input type="number" min={1} max={Math.max(1, quantity)} value={selected} disabled={disabled} onChange={(event) => setAmount(Number(event.target.value))} className="mt-4 w-full rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-sm font-black text-white outline-none" />
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        <button type="button" disabled={disabled} onClick={() => setQuick(0.25)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">25%</button>
        <button type="button" disabled={disabled} onClick={() => setQuick(0.5)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">50%</button>
        <button type="button" disabled={disabled} onClick={() => setAmount(quantity)} className="btn-ghost rounded-lg px-2 py-2 text-[9px] disabled:opacity-25">ALL</button>
      </div>
      <p className="mt-3 text-xl font-black text-emerald-100">+{(selected * price).toLocaleString('en-US')} dirty</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={disabled} onClick={() => onSell(type, selected)} className="rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.11em] text-emerald-100 disabled:opacity-30">Sell X</button>
        <button type="button" disabled={disabled} onClick={() => onSell(type, quantity)} className="btn-primary rounded-xl px-3 py-2.5 text-[10px] disabled:opacity-30">Sell all</button>
      </div>
    </div>
  );
}
