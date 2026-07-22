import type { GangRarity, GangRole, GangStatus } from '../../types/gang';

export type MemberFilters = { search: string; rarity: 'All' | GangRarity; status: 'All' | GangStatus; role: 'All' | GangRole; loyalty: 'All' | 'Low' | 'Medium' | 'High'; sort: string };
export const defaultMemberFilters: MemberFilters = { search: '', rarity: 'All', status: 'All', role: 'All', loyalty: 'All', sort: 'level-desc' };

export default function GangMemberFilters({ filters, count, onChange, onReset }: { filters: MemberFilters; count: number; onChange: (filters: MemberFilters) => void; onReset: () => void }) {
  const select = (key: keyof MemberFilters, options: string[]) => <select value={filters[key]} onChange={(event) => onChange({ ...filters, [key]: event.target.value })} className="rounded-lg border border-white/10 bg-[#17132b] px-3 py-2 text-xs">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select>;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
        <input value={filters.search} onChange={(event) => onChange({ ...filters, search: event.target.value })} placeholder="Search member…" className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs" />
        {select('rarity', ['All', 'Common', 'Rare', 'Epic', 'Legendary', 'Mythic'])}
        {select('status', ['All', 'Available', 'Working', 'Injured'])}
        {select('role', ['All', 'Shooter', 'Farmer', 'Strategist', 'Recruiter', 'Leader', 'Street Fixer'])}
        {select('loyalty', ['All', 'Low', 'Medium', 'High'])}
        {select('sort', ['level-desc', 'level-asc', 'rarity-desc', 'loyalty-desc', 'loyalty-asc', 'shooting-desc', 'farming-desc', 'tactics-desc', 'recruiting-desc', 'leadership-desc', 'streetSmart-desc', 'newest', 'oldest'])}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-white/55"><span>{count} results</span><button type="button" onClick={onReset} className="font-bold text-amber-200">Reset Filters</button></div>
    </div>
  );
}
