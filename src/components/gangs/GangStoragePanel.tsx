export default function GangStoragePanel({
  storage,
  onSellBlue,
  onSellGunpowder,
  onSellSteel,
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
  onSellBlue: () => void;
  onSellGunpowder: () => void;
  onSellSteel: () => void;
}) {
  return (
    <div className="space-y-5">
      <section className="game-panel p-5 sm:p-7">
        <p className="section-kicker">Gang storage</p>
        <h1 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Materials and finished goods.</h1>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StorageCard label="Leaves" value={storage.frunze} />
          <StorageCard label="White Packs" value={storage.white} />
          <StorageCard label="Blue Packs" value={storage.blue} />
          <StorageCard label="Sulfur" value={storage.sulfur} />
          <StorageCard label="Iron Ore" value={storage.ironOre} />
          <StorageCard label="Gunpowder" value={storage.gunpowder} price="5,000 $ each" />
          <StorageCard label="Steel" value={storage.steel} price="6,000 $ each" />
        </div>
      </section>

      <section className="game-panel-soft p-5 sm:p-6">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[var(--accent)]/65">Sell materials</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <SellCard title="Sell Blue Packs" value={storage.blue * 2300} detail="2,300 dirty each" disabled={storage.blue <= 0} onClick={onSellBlue} />
          <SellCard title="Sell Gunpowder" value={storage.gunpowder * 5000} detail="5,000 dirty each" disabled={storage.gunpowder <= 0} onClick={onSellGunpowder} />
          <SellCard title="Sell Steel" value={storage.steel * 6000} detail="6,000 dirty each" disabled={storage.steel <= 0} onClick={onSellSteel} />
        </div>
        <p className="mt-4 text-xs leading-relaxed text-white/30">Gunpowder and Steel can be sold now or saved for future weapon crafting.</p>
      </section>
    </div>
  );
}

function StorageCard({ label, value, price }: { label: string; value: number; price?: string }) {
  return (
    <div className="rounded-[18px] border border-white/[0.07] bg-black/20 p-4">
      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-white/28">{label}</p>
      <p className="mt-2 text-2xl font-black text-white">{value.toLocaleString('en-US')}</p>
      {price ? <p className="mt-1 text-[10px] font-bold text-[var(--accent)]/60">{price}</p> : null}
    </div>
  );
}

function SellCard({ title, value, detail, disabled, onClick }: { title: string; value: number; detail: string; disabled: boolean; onClick: () => void }) {
  return (
    <div className="rounded-[18px] border border-emerald-300/10 bg-emerald-400/[0.035] p-4">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-1 text-[10px] text-white/35">{detail}</p>
      <p className="mt-3 text-lg font-black text-emerald-100">+{value.toLocaleString('en-US')} dirty</p>
      <button type="button" disabled={disabled} onClick={onClick} className="mt-3 w-full rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-3 py-2.5 text-[10px] font-black uppercase tracking-[0.11em] text-emerald-100 disabled:opacity-30">Sell all</button>
    </div>
  );
}
