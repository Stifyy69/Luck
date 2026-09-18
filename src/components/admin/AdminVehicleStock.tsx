import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { fetchAdminVehicleStock, updateAdminVehicleStock } from '../../lib/adminApi';
import type { AdminVehicleStockItem, AdminVehicleStockResponse } from '../../lib/adminTypes';

type Scope = 'all' | 'selected' | 'rank';
type Mode = 'add' | 'set';

function fmt(value: number) {
  return Number(value || 0).toLocaleString('en-US');
}

export default function AdminVehicleStock() {
  const [data, setData] = useState<AdminVehicleStockResponse | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [scope, setScope] = useState<Scope>('all');
  const [mode, setMode] = useState<Mode>('add');
  const [rank, setRank] = useState<1 | 2 | 3>(1);
  const [amount, setAmount] = useState('10');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAdminVehicleStock());
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Vehicle stock failed to load.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => {});
  }, []);

  const selectedCount = selected.size;
  const matchingCount = useMemo(() => {
    if (!data) return 0;
    if (scope === 'all') return data.vehicles.length;
    if (scope === 'rank') return data.vehicles.filter((vehicle) => vehicle.rank === rank).length;
    return selectedCount;
  }, [data, rank, scope, selectedCount]);

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectRank = (targetRank: 1 | 2 | 3) => {
    if (!data) return;
    setSelected(new Set(data.vehicles.filter((vehicle) => vehicle.rank === targetRank).map((vehicle) => vehicle.id)));
    setScope('selected');
  };

  const apply = async () => {
    const parsed = Math.floor(Number(amount));
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      setError('Enter a valid stock amount.');
      return;
    }
    if (mode === 'add' && parsed <= 0) {
      setError('Add amount must be greater than 0.');
      return;
    }
    if (scope === 'selected' && selected.size === 0) {
      setError('Select at least one vehicle.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const result = await updateAdminVehicleStock({
        scope,
        mode,
        amount: parsed,
        rank: scope === 'rank' ? rank : undefined,
        modelIds: scope === 'selected' ? Array.from(selected) : undefined,
      });
      setNotice(`${result.affected} vehicle${result.affected === 1 ? '' : 's'} updated.`);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Stock update failed.');
    } finally {
      setSaving(false);
    }
  };

  const updateLocalStock = (vehicle: AdminVehicleStockItem, value: string) => {
    const parsed = Math.max(0, Math.floor(Number(value || 0)));
    if (!Number.isFinite(parsed)) return;
    setData((current) => current ? {
      ...current,
      vehicles: current.vehicles.map((entry) => entry.id === vehicle.id ? { ...entry, stock: parsed } : entry),
    } : current);
  };

  const setOne = async (vehicle: AdminVehicleStockItem) => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await updateAdminVehicleStock({ scope: 'selected', mode: 'set', amount: vehicle.stock, modelIds: [vehicle.id] });
      setNotice(`${vehicle.name} stock updated.`);
      await load();
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Stock update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="game-panel-soft p-5 sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="section-kicker">Showroom inventory</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Vehicle stock</h2>
          </div>
          <button type="button" onClick={() => load().catch(() => {})} className="btn-ghost rounded-xl px-4 py-3 text-xs" disabled={loading || saving}>Refresh</button>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[0.8fr_0.8fr_1fr_1fr_auto]">
          <Control label="Mode">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/[0.07] bg-black/20 p-1">
              {(['add', 'set'] as Mode[]).map((entry) => <button key={entry} type="button" onClick={() => setMode(entry)} className={`rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-[0.1em] ${mode === entry ? 'bg-[var(--accent)] text-[#10140b]' : 'text-white/35 hover:bg-white/[0.04]'}`}>{entry}</button>)}
            </div>
          </Control>

          <Control label="Amount">
            <input type="number" min="0" max="1000000" value={amount} onChange={(event) => setAmount(event.target.value)} className="input-dark w-full rounded-xl px-3 py-2.5 text-sm font-black outline-none" />
          </Control>

          <Control label="Apply to">
            <select value={scope} onChange={(event) => setScope(event.target.value as Scope)} className="input-dark w-full rounded-xl px-3 py-2.5 text-sm font-black outline-none">
              <option value="all">All vehicles</option>
              <option value="selected">Selected vehicles</option>
              <option value="rank">One rank</option>
            </select>
          </Control>

          <Control label="Rank">
            <select value={rank} disabled={scope !== 'rank'} onChange={(event) => setRank(Number(event.target.value) as 1 | 2 | 3)} className="input-dark w-full rounded-xl px-3 py-2.5 text-sm font-black outline-none disabled:opacity-35">
              {(data?.ranks || []).map((entry) => <option key={entry.rank} value={entry.rank}>{entry.label}</option>)}
            </select>
          </Control>

          <button type="button" onClick={() => apply().catch(() => {})} disabled={saving || loading || matchingCount === 0} className="btn-primary rounded-xl px-5 py-3 text-xs disabled:opacity-35">
            {saving ? 'Saving...' : mode === 'add' && scope === 'all' ? 'Add to all' : `Apply to ${matchingCount}`}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(data?.ranks || []).map((entry) => <button key={entry.rank} type="button" onClick={() => selectRank(entry.rank)} className="btn-ghost rounded-xl px-3 py-2 text-[10px]">Select {entry.label}</button>)}
          <button type="button" onClick={() => setSelected(new Set(data?.vehicles.map((vehicle) => vehicle.id) || []))} className="btn-ghost rounded-xl px-3 py-2 text-[10px]">Select all</button>
          <button type="button" onClick={() => setSelected(new Set())} className="btn-ghost rounded-xl px-3 py-2 text-[10px]">Clear selection</button>
          <span className="self-center text-[10px] font-bold text-white/30">{selectedCount} selected</span>
        </div>

        {error ? <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/[0.06] px-3 py-2 text-sm font-bold text-red-100">{error}</p> : null}
        {notice ? <p className="mt-4 rounded-xl border border-[rgba(211,255,81,0.2)] bg-[rgba(211,255,81,0.05)] px-3 py-2 text-sm font-bold text-[var(--accent)]">{notice}</p> : null}
      </section>

      <section className="game-panel-soft overflow-hidden">
        <div className="hidden grid-cols-[44px_0.75fr_1.4fr_0.7fr_0.7fr_170px_86px] gap-3 border-b border-white/[0.07] px-5 py-3 text-[8px] font-black uppercase tracking-[0.12em] text-white/25 md:grid">
          <span />
          <span>Brand</span>
          <span>Vehicle</span>
          <span>Rank</span>
          <span>Price</span>
          <span>Stock</span>
          <span />
        </div>

        {loading ? <div className="p-10 text-center text-xs font-black uppercase tracking-[0.14em] text-white/25">Loading stock...</div> : null}
        {!loading && data?.vehicles.map((vehicle) => (
          <div key={vehicle.id} className="grid gap-3 border-b border-white/[0.055] p-4 last:border-b-0 md:grid-cols-[44px_0.75fr_1.4fr_0.7fr_0.7fr_170px_86px] md:items-center md:px-5">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-white/45"><input type="checkbox" checked={selected.has(vehicle.id)} onChange={() => toggle(vehicle.id)} className="h-4 w-4 accent-[var(--accent)]" /><span className="md:hidden">Select</span></label>
            <p className="text-xs font-black text-white/50">{vehicle.brand}</p>
            <div><p className="text-sm font-black text-white">{vehicle.name}</p>{vehicle.jackpot ? <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-amber-200">Jackpot</p> : null}</div>
            <p className="text-xs font-black text-[var(--accent)]">Rank {vehicle.rank}</p>
            <p className="text-xs font-black text-white/55">{fmt(vehicle.basePrice)} $</p>
            <input type="number" min="0" max="1000000" value={vehicle.stock} onChange={(event) => updateLocalStock(vehicle, event.target.value)} className="input-dark w-full rounded-xl px-3 py-2 text-sm font-black outline-none" />
            <button type="button" onClick={() => setOne(vehicle).catch(() => {})} disabled={saving} className="btn-ghost rounded-xl px-3 py-2 text-[10px] disabled:opacity-35">Set</button>
          </div>
        ))}
      </section>
    </div>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.13em] text-white/28">{label}</span>{children}</label>;
}
