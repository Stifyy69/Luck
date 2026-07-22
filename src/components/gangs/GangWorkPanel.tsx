import { useState } from 'react';
import type { GangRecipe, GangResource, GangState } from '../../types/gang';
import GangStockBar from './GangStockBar';

type Props = {
  state: GangState;
  pending: boolean;
  onProcess: (recipe: GangRecipe, batches: number) => void;
  onSell: (material: Extract<GangResource, 'blue' | 'gunpowder' | 'steel'>, quantity: number | 'all') => void;
};

const recipes = {
  white: { title: 'Process White', duration: '1h game time', input: '1.200 Leaves', output: '400 White', cost: '900.000 dirty', source: 'leaves', perBatch: 1_200 },
  blue: { title: 'Process Blue', duration: '1h game time', input: '400 White', output: '800 Blue', cost: '100.000 dirty', source: 'white', perBatch: 400 },
  gunpowder: { title: 'Process Gunpowder', duration: '30m game time', input: '5 Sulfur', output: '1 Gunpowder', cost: 'No money cost', source: 'sulfur', perBatch: 5 },
  steel: { title: 'Process Steel', duration: '30m game time', input: '5 Iron Ore', output: '1 Steel', cost: 'No money cost', source: 'ironOre', perBatch: 5 },
} as const;

export default function GangWorkPanel({ state, pending, onProcess, onSell }: Props) {
  const [tab, setTab] = useState<'production' | 'mining' | 'combat'>('production');
  const available = state.members.filter((member) => member.status === 'Available').length;
  const injured = state.members.filter((member) => member.status === 'Injured').length;
  const working = state.members.filter((member) => member.status === 'Working').length;
  const shownRecipes: GangRecipe[] = tab === 'production' ? ['white', 'blue'] : tab === 'mining' ? ['gunpowder', 'steel'] : [];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Metric label="Gang Dirty" value={`${state.dirtyBalance.toLocaleString('ro-RO')} $`} accent />
        <Metric label="Available" value={String(available)} />
        <Metric label="Injured" value={String(injured)} />
        <Metric label="Working" value={String(working)} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {(['production', 'mining', 'combat'] as const).map((value) => <button key={value} type="button" onClick={() => setTab(value)} className={`h-11 rounded-xl border text-xs font-black uppercase tracking-wider ${tab === value ? 'border-amber-300/50 bg-amber-400/20 text-amber-100' : 'border-white/10 bg-white/5 text-white/60'}`}>{value}</button>)}
      </div>
      <GangStockBar resources={state.resources} />
      {tab === 'combat' ? (
        <div className="grid gap-3 md:grid-cols-2"><StaticCard title="Illegal Transport" detail="Selectează membrii pentru payout și loyalty; riscul crește odată cu echipa." /><StaticCard title="Gang Battles" detail="Alege maximum 5 membri și un lider pentru lupta cu un gang bot." /></div>
      ) : (
        <div className="grid items-stretch gap-3 md:grid-cols-2">
          {shownRecipes.map((key) => <ProcessCard key={key} recipeKey={key} resources={state.resources} dirty={state.dirtyBalance} pending={pending} onProcess={onProcess} />)}
        </div>
      )}
      <SellPanel resources={state.resources} pending={pending} onSell={onSell} />
    </section>
  );
}

function ProcessCard({ recipeKey, resources, dirty, pending, onProcess }: { recipeKey: GangRecipe; resources: GangState['resources']; dirty: number; pending: boolean; onProcess: Props['onProcess'] }) {
  const recipe = recipes[recipeKey];
  const maxByStock = Math.floor(resources[recipe.source] / recipe.perBatch);
  const cost = recipeKey === 'white' ? 900_000 : recipeKey === 'blue' ? 100_000 : 0;
  const maximum = Math.min(maxByStock, cost ? Math.floor(dirty / cost) : maxByStock);
  const [batches, setBatches] = useState(1);
  const selected = Math.max(1, Math.min(maximum || 1, batches));
  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/10 bg-black/25 p-4">
      <h3 className="text-lg font-black">{recipe.title}</h3><p className="mt-1 text-xs text-white/45">{recipe.duration}</p>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><Detail label="Input" value={recipe.input} /><Detail label="Output" value={recipe.output} /><Detail label="Cost" value={recipe.cost} /><Detail label="Available" value={`${resources[recipe.source].toLocaleString('ro-RO')} ${recipe.source}`} /></div>
      <div className="mt-4"><label className="text-xs font-bold text-white/55">Exact batches</label><input type="number" min={1} max={Math.max(1, maximum)} value={batches} onChange={(event) => setBatches(Math.max(1, Number(event.target.value)))} className="mt-1 w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2" /><div className="mt-2 grid grid-cols-3 gap-2">{[.25, .5, 1].map((part) => <button key={part} type="button" onClick={() => setBatches(Math.max(1, Math.floor(maximum * part)))} className="rounded-lg bg-white/10 px-2 py-2 text-xs font-bold">{part === 1 ? 'MAX' : `${part * 100}%`}</button>)}</div></div>
      <button type="button" disabled={pending || maximum < 1} onClick={() => onProcess(recipeKey, selected)} className="mt-auto pt-4"><span className="block rounded-xl bg-violet-500/80 px-4 py-3 text-sm font-black disabled:opacity-40">{pending ? 'Processing…' : `Process ${selected}`}</span></button>
    </article>
  );
}

function SellPanel({ resources, pending, onSell }: { resources: GangState['resources']; pending: boolean; onSell: Props['onSell'] }) {
  const [quantities, setQuantities] = useState({ blue: 1, gunpowder: 1, steel: 1 });
  return <div className="grid gap-3 md:grid-cols-3">{(['blue', 'gunpowder', 'steel'] as const).map((material) => <article key={material} className="flex flex-col rounded-2xl border border-emerald-300/15 bg-emerald-950/15 p-4"><h3 className="font-black capitalize">Sell {material}</h3><p className="mt-1 text-xs text-white/50">Stock: {resources[material].toLocaleString('ro-RO')}</p><input type="number" min={1} max={Math.max(1, resources[material])} value={quantities[material]} onChange={(event) => setQuantities({ ...quantities, [material]: Math.max(1, Number(event.target.value)) })} className="mt-3 rounded-lg border border-white/10 bg-black/35 px-3 py-2"/><div className="mt-auto grid grid-cols-2 gap-2 pt-3"><button disabled={pending || quantities[material] > resources[material]} onClick={() => onSell(material, quantities[material])} className="rounded-lg bg-emerald-500/75 px-2 py-2 text-xs font-black disabled:opacity-40">Sell X</button><button disabled={pending || resources[material] === 0} onClick={() => onSell(material, 'all')} className="rounded-lg bg-white/10 px-2 py-2 text-xs font-black disabled:opacity-40">Sell All</button></div></article>)}</div>;
}

function Metric({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) { return <div className={`rounded-xl border p-3 ${accent ? 'border-amber-300/30 bg-amber-400/10' : 'border-white/10 bg-black/25'}`}><p className="text-[10px] uppercase tracking-wider text-white/45">{label}</p><p className="mt-1 font-black">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg bg-white/5 p-2"><p className="text-white/40">{label}</p><p className="mt-1 font-bold text-white/80">{value}</p></div>; }
function StaticCard({ title, detail }: { title: string; detail: string }) { return <article className="flex min-h-48 flex-col rounded-2xl border border-white/10 bg-black/25 p-4"><h3 className="text-lg font-black">{title}</h3><p className="mt-3 text-sm text-white/55">{detail}</p><button disabled className="mt-auto rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white/40">Select team</button></article>; }
