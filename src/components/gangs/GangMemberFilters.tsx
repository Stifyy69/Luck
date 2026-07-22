import type { GangMemberRarity } from '../../lib/gangMembers';

export type MemberStatusFilter = 'ALL' | 'AVAILABLE' | 'WORKING' | 'INJURED';
export type MemberRoleFilter = 'ALL' | 'Shooter' | 'Farmer' | 'Strategist' | 'Recruiter' | 'Leader' | 'Street Fixer';
export type MemberLoyaltyFilter = 'ALL' | 'LOW' | 'MEDIUM' | 'HIGH';
export type MemberLevelFilter = 'ALL' | '1_5' | '6_10' | '11_20' | '21_PLUS';
export type MemberSort =
  | 'LEVEL_DESC' | 'LEVEL_ASC' | 'RARITY_DESC' | 'LOYALTY_DESC' | 'LOYALTY_ASC'
  | 'SHOOTING_DESC' | 'FARMING_DESC' | 'TACTICS_DESC' | 'RECRUITING_DESC' | 'LEADERSHIP_DESC' | 'STREET_SMART_DESC'
  | 'NEWEST' | 'OLDEST';

export type MemberFiltersState = {
  search: string;
  rarity: 'ALL' | GangMemberRarity;
  status: MemberStatusFilter;
  role: MemberRoleFilter;
  loyalty: MemberLoyaltyFilter;
  level: MemberLevelFilter;
  sort: MemberSort;
};

export const DEFAULT_MEMBER_FILTERS: MemberFiltersState = {
  search: '', rarity: 'ALL', status: 'ALL', role: 'ALL', loyalty: 'ALL', level: 'ALL', sort: 'LEVEL_DESC',
};

export default function GangMemberFilters({
  value,
  resultCount,
  totalCount,
  onChange,
  onReset,
}: {
  value: MemberFiltersState;
  resultCount: number;
  totalCount: number;
  onChange: (next: MemberFiltersState) => void;
  onReset: () => void;
}) {
  const set = <K extends keyof MemberFiltersState>(key: K, nextValue: MemberFiltersState[K]) => onChange({ ...value, [key]: nextValue });
  return (
    <div className="rounded-[20px] border border-white/[0.07] bg-black/20 p-4">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1.35fr_repeat(6,1fr)]">
        <input value={value.search} onChange={(event) => set('search', event.target.value)} placeholder="Search member..." className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-xs font-bold text-white outline-none placeholder:text-white/20" />
        <FilterSelect label="Rarity" value={value.rarity} onChange={(next) => set('rarity', next as MemberFiltersState['rarity'])} options={['ALL', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']} />
        <FilterSelect label="Status" value={value.status} onChange={(next) => set('status', next as MemberStatusFilter)} options={['ALL', 'AVAILABLE', 'WORKING', 'INJURED']} />
        <FilterSelect label="Role" value={value.role} onChange={(next) => set('role', next as MemberRoleFilter)} options={['ALL', 'Shooter', 'Farmer', 'Strategist', 'Recruiter', 'Leader', 'Street Fixer']} />
        <FilterSelect label="Loyalty" value={value.loyalty} onChange={(next) => set('loyalty', next as MemberLoyaltyFilter)} options={['ALL', 'LOW', 'MEDIUM', 'HIGH']} />
        <FilterSelect label="Level" value={value.level} onChange={(next) => set('level', next as MemberLevelFilter)} options={['ALL', '1_5', '6_10', '11_20', '21_PLUS']} />
        <select value={value.sort} onChange={(event) => set('sort', event.target.value as MemberSort)} className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[10px] font-black text-white/70 outline-none">
          <option value="LEVEL_DESC">Level high to low</option><option value="LEVEL_ASC">Level low to high</option><option value="RARITY_DESC">Rarity high to low</option>
          <option value="LOYALTY_DESC">Loyalty high to low</option><option value="LOYALTY_ASC">Loyalty low to high</option>
          <option value="SHOOTING_DESC">Highest Shooting</option><option value="FARMING_DESC">Highest Farming</option><option value="TACTICS_DESC">Highest Tactics</option>
          <option value="RECRUITING_DESC">Highest Recruiting</option><option value="LEADERSHIP_DESC">Highest Leadership</option><option value="STREET_SMART_DESC">Highest Street Smart</option>
          <option value="NEWEST">Newest member</option><option value="OLDEST">Oldest member</option>
        </select>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[9px] font-black uppercase tracking-[0.11em] text-white/30">{resultCount} of {totalCount} members</p>
        <button type="button" onClick={onReset} className="btn-ghost rounded-lg px-3 py-2 text-[9px]">Reset filters</button>
      </div>
    </div>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <select aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} className="rounded-xl border border-white/[0.08] bg-black/25 px-3 py-2.5 text-[10px] font-black text-white/70 outline-none">
      {options.map((option) => <option key={option} value={option}>{option === 'ALL' ? `All ${label.toLowerCase()}` : option.replace('_', ' ')}</option>)}
    </select>
  );
}
