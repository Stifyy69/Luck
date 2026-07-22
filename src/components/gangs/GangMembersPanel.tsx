import { useMemo, useState } from 'react';
import { GANG_RARITY_ORDER } from '../../lib/gangMemberDefinitions';
import { getMemberRole, type GangMember, type GangMemberSkill } from '../../lib/gangMembers';
import GangMemberCard from './GangMemberCard';
import GangMemberFilters, { DEFAULT_MEMBER_FILTERS, type MemberFiltersState, type MemberSort } from './GangMemberFilters';

const SKILL_SORTS: Partial<Record<MemberSort, GangMemberSkill>> = {
  SHOOTING_DESC: 'shooting',
  FARMING_DESC: 'farming',
  TACTICS_DESC: 'tactics',
  RECRUITING_DESC: 'recruiting',
  LEADERSHIP_DESC: 'leadership',
  STREET_SMART_DESC: 'streetSmart',
};

export default function GangMembersPanel({
  members,
  currentGameHour,
  recruitingPower,
  busy,
  onDismiss,
  onSupport,
}: {
  members: GangMember[];
  currentGameHour: number;
  recruitingPower: number;
  busy: boolean;
  onDismiss: (member: GangMember) => void;
  onSupport: (member: GangMember) => void;
}) {
  const [filters, setFilters] = useState<MemberFiltersState>(DEFAULT_MEMBER_FILTERS);
  const filtered = useMemo(() => {
    const search = filters.search.trim().toLowerCase();
    const result = members.filter((member) => {
      const status = member.injuredUntilGameHour > currentGameHour ? 'INJURED' : member.status;
      if (search && !`${member.firstName} ${member.nickname} ${member.lastName} ${member.displayName}`.toLowerCase().includes(search)) return false;
      if (filters.rarity !== 'ALL' && member.rarity !== filters.rarity) return false;
      if (filters.status !== 'ALL' && status !== filters.status) return false;
      if (filters.role !== 'ALL' && getMemberRole(member) !== filters.role) return false;
      if (filters.loyalty === 'LOW' && member.loyalty >= 40) return false;
      if (filters.loyalty === 'MEDIUM' && (member.loyalty < 40 || member.loyalty >= 70)) return false;
      if (filters.loyalty === 'HIGH' && member.loyalty < 70) return false;
      if (filters.level === '1_5' && (member.level < 1 || member.level > 5)) return false;
      if (filters.level === '6_10' && (member.level < 6 || member.level > 10)) return false;
      if (filters.level === '11_20' && (member.level < 11 || member.level > 20)) return false;
      if (filters.level === '21_PLUS' && member.level < 21) return false;
      return true;
    });
    return result.sort((left, right) => compareMembers(left, right, filters.sort));
  }, [members, currentGameHour, filters]);

  return (
    <section className="game-panel p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="section-kicker">Gang members</p>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Manage the roster</h1>
        </div>
        <span className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.11em] text-white/45">Recruiting {Math.min(100, recruitingPower)}</span>
      </div>
      <div className="mt-4">
        <GangMemberFilters value={filters} resultCount={filtered.length} totalCount={members.length} onChange={setFilters} onReset={() => setFilters(DEFAULT_MEMBER_FILTERS)} />
      </div>
      {filtered.length > 0 ? (
        <div className="mt-4 grid items-stretch gap-3 xl:grid-cols-2">
          {filtered.map((member) => <GangMemberCard key={member.id} member={member} currentGameHour={currentGameHour} disabled={busy} onDismiss={onDismiss} onSupport={onSupport} />)}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] px-4 py-12 text-center">
          <p className="text-sm font-black text-white/45">No members match these filters.</p>
          <button type="button" onClick={() => setFilters(DEFAULT_MEMBER_FILTERS)} className="btn-ghost mt-3 rounded-xl px-4 py-2.5 text-[9px]">Reset filters</button>
        </div>
      )}
    </section>
  );
}

function compareMembers(left: GangMember, right: GangMember, sort: MemberSort) {
  if (sort === 'LEVEL_DESC') return right.level - left.level || right.xp - left.xp;
  if (sort === 'LEVEL_ASC') return left.level - right.level || left.xp - right.xp;
  if (sort === 'RARITY_DESC') return GANG_RARITY_ORDER[right.rarity] - GANG_RARITY_ORDER[left.rarity] || right.level - left.level;
  if (sort === 'LOYALTY_DESC') return right.loyalty - left.loyalty;
  if (sort === 'LOYALTY_ASC') return left.loyalty - right.loyalty;
  if (sort === 'NEWEST') return right.joinedAt - left.joinedAt;
  if (sort === 'OLDEST') return left.joinedAt - right.joinedAt;
  const skill = SKILL_SORTS[sort];
  if (skill) return right.skills[skill] - left.skills[skill] || right.level - left.level;
  return 0;
}
