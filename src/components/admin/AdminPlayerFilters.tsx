import type { AdminPlayerFilters } from '../../lib/adminApi';
import CityIcon from '../ui/CityIcon';

export default function AdminPlayerFiltersPanel({
  filters,
  onFiltersChange,
  onApply,
}: {
  filters: AdminPlayerFilters;
  onFiltersChange: (next: AdminPlayerFilters) => void;
  onApply: () => void;
}) {
  const set = <K extends keyof AdminPlayerFilters>(key: K, value: AdminPlayerFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value, ...(key !== 'page' ? { page: 1 } : {}) });
  };

  const reset = () => onFiltersChange({
    search: '', accountOnly: false, onlineOnly: false, vipOnly: false, gangOnly: false,
    minLevel: '', maxLevel: '', minCityXp: '', maxCityXp: '', minMoney: '', maxMoney: '',
    minNetWorth: '', maxNetWorth: '', minEarnings: '', maxEarnings: '', minCareer: '', maxCareer: '', minTime: '', maxTime: '',
    sortBy: 'lastSeenMs', sortDir: 'desc', page: 1, pageSize: filters.pageSize,
  });

  return (
    <section className="game-panel-soft p-5 sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="section-kicker">Database filters</p>
          <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">Find any player</h2>
          <p className="mt-2 text-xs leading-relaxed text-white/35">Every major number supports minimum and maximum filtering. Combine ranges with account, VIP, gang and online status.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={reset} className="btn-ghost rounded-xl px-4 py-3 text-xs">Reset</button>
          <button type="button" onClick={onApply} className="btn-primary rounded-xl px-5 py-3 text-xs">
            <span className="inline-flex items-center gap-2"><CityIcon name="refresh" className="h-4 w-4" />Apply filters</span>
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Search"><input className="input-dark w-full rounded-xl px-3 py-2.5 text-sm outline-none" value={filters.search} onChange={(event) => set('search', event.target.value)} placeholder="Name, email or player ID" /></Field>
        <RangeField label="City Level" min={filters.minLevel} max={filters.maxLevel} onMin={(value) => set('minLevel', value)} onMax={(value) => set('maxLevel', value)} />
        <RangeField label="City XP" min={filters.minCityXp} max={filters.maxCityXp} onMin={(value) => set('minCityXp', value)} onMax={(value) => set('maxCityXp', value)} />
        <RangeField label="Clean money" min={filters.minMoney} max={filters.maxMoney} onMin={(value) => set('minMoney', value)} onMax={(value) => set('maxMoney', value)} />
        <RangeField label="Net worth" min={filters.minNetWorth} max={filters.maxNetWorth} onMin={(value) => set('minNetWorth', value)} onMax={(value) => set('maxNetWorth', value)} />
        <RangeField label="Total earnings" min={filters.minEarnings} max={filters.maxEarnings} onMin={(value) => set('minEarnings', value)} onMax={(value) => set('maxEarnings', value)} />
        <RangeField label="Career score" min={filters.minCareer} max={filters.maxCareer} onMin={(value) => set('minCareer', value)} onMax={(value) => set('maxCareer', value)} />
        <RangeField label="Time played (hours)" min={filters.minTime} max={filters.maxTime} onMin={(value) => set('minTime', value)} onMax={(value) => set('maxTime', value)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
        <div className="flex flex-wrap gap-x-5 gap-y-3 rounded-[16px] border border-white/[0.06] bg-black/20 px-4 py-3">
          <Check label="Accounts only" checked={filters.accountOnly} onChange={(checked) => set('accountOnly', checked)} />
          <Check label="Online only" checked={filters.onlineOnly} onChange={(checked) => set('onlineOnly', checked)} />
          <Check label="VIP only" checked={filters.vipOnly} onChange={(checked) => set('vipOnly', checked)} />
          <Check label="Has gang" checked={filters.gangOnly} onChange={(checked) => set('gangOnly', checked)} />
        </div>
        <Field label="Sorting">
          <div className="grid grid-cols-[1fr_92px_74px] gap-2">
            <select className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none" value={filters.sortBy} onChange={(event) => set('sortBy', event.target.value)}>
              <option value="lastSeenMs">Last seen</option><option value="cityLevel">City Level</option><option value="cityXp">City XP</option>
              <option value="cleanMoney">Clean money</option><option value="netWorth">Net worth</option><option value="totalEarnings">Earnings</option>
              <option value="careerScore">Career score</option><option value="totalTimeHours">Time played</option><option value="vehicleCount">Vehicles</option><option value="inventoryUnits">Inventory</option>
            </select>
            <select className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none" value={filters.sortDir} onChange={(event) => set('sortDir', event.target.value as 'asc' | 'desc')}><option value="desc">High</option><option value="asc">Low</option></select>
            <select className="input-dark rounded-xl px-2 py-2.5 text-sm outline-none" value={filters.pageSize} onChange={(event) => set('pageSize', Number(event.target.value))}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select>
          </div>
        </Field>
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label><span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.13em] text-white/28">{label}</span>{children}</label>;
}

function RangeField({ label, min, max, onMin, onMax }: { label: string; min: string; max: string; onMin: (value: string) => void; onMax: (value: string) => void }) {
  return <Field label={`${label} range`}><div className="grid grid-cols-2 gap-2"><input className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none" type="number" value={min} onChange={(event) => onMin(event.target.value)} placeholder="Min" /><input className="input-dark rounded-xl px-3 py-2.5 text-sm outline-none" type="number" value={max} onChange={(event) => onMax(event.target.value)} placeholder="Max" /></div></Field>;
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-white/45"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />{label}</label>;
}
