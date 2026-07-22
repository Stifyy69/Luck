import type { MemberFilters } from '../components/gangs/GangMemberFilters';
import type { GangMember, GangRarity } from '../types/gang';

const rarityRank: Record<GangRarity, number> = { Common: 1, Rare: 2, Epic: 3, Legendary: 4, Mythic: 5 };

export function filterGangMembers(members: GangMember[], filters: MemberFilters) {
  const query = filters.search.trim().toLocaleLowerCase('ro');
  return members.filter((member) => {
    const searchable = `${member.firstName} ${member.nickname} ${member.lastName} ${member.displayName}`.toLocaleLowerCase('ro');
    const loyaltyMatch = filters.loyalty === 'All' || (filters.loyalty === 'Low' && member.loyalty <= 39) || (filters.loyalty === 'Medium' && member.loyalty >= 40 && member.loyalty <= 69) || (filters.loyalty === 'High' && member.loyalty >= 70);
    return (!query || searchable.includes(query)) && (filters.rarity === 'All' || member.rarity === filters.rarity) && (filters.status === 'All' || member.status === filters.status) && (filters.role === 'All' || member.role === filters.role) && loyaltyMatch;
  }).sort((a, b) => {
    const [field, direction] = filters.sort.split('-');
    if (field === 'rarity') return rarityRank[b.rarity] - rarityRank[a.rarity];
    if (field === 'newest' || field === 'oldest') return (new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()) * (field === 'newest' ? -1 : 1);
    const read = (member: GangMember) => field in member.skills ? member.skills[field as keyof GangMember['skills']] : Number(member[field as 'level' | 'loyalty']);
    return (read(a) - read(b)) * (direction === 'asc' ? 1 : -1);
  });
}
