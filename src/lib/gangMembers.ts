export const GANG_MEMBER_SKILLS = [
  'shooting',
  'farming',
  'tactics',
  'recruiting',
  'leadership',
  'streetSmart',
] as const;

export type GangMemberSkill = (typeof GANG_MEMBER_SKILLS)[number];
export type GangMemberRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC';
export type GangMemberSource = 'STARTER' | 'RECRUITMENT' | 'ADMIN_EVENT';
export type GangMemberStatus = 'AVAILABLE' | 'WORKING';

export type GangMemberSkills = Record<GangMemberSkill, number>;

export type GangMemberBonus = {
  id: string;
  label: string;
  description: string;
  skill: GangMemberSkill;
  value: number;
};

export type GangMember = {
  id: string;
  firstName: string;
  nickname: string;
  lastName: string;
  displayName: string;
  rarity: GangMemberRarity;
  source: GangMemberSource;
  level: number;
  xp: number;
  loyalty: number;
  skills: GangMemberSkills;
  bonuses: GangMemberBonus[];
  joinedAt: number;
  status: GangMemberStatus;
  avatarSeed: number;
};

export type DismissalResult = {
  members: GangMember[];
  dismissed: GangMember | null;
  voluntaryDeparture: GangMember | null;
  loyaltyLoss: number;
  pressure: number;
  lastDismissalAt: number;
};

export const SKILL_LABELS: Record<GangMemberSkill, string> = {
  shooting: 'Shooting',
  farming: 'Farming',
  tactics: 'Tactics',
  recruiting: 'Recruiting',
  leadership: 'Leadership',
  streetSmart: 'Street Smart',
};

export const RARITY_LABELS: Record<GangMemberRarity, string> = {
  COMMON: 'Common',
  RARE: 'Rare',
  EPIC: 'Epic',
  LEGENDARY: 'Legendary',
  MYTHIC: 'Mythic',
};

export const RARITY_STYLES: Record<GangMemberRarity, string> = {
  COMMON: 'border-white/10 bg-white/[0.025] text-white/55',
  RARE: 'border-sky-400/25 bg-sky-500/[0.06] text-sky-200',
  EPIC: 'border-violet-400/30 bg-violet-500/[0.07] text-violet-200',
  LEGENDARY: 'border-amber-300/30 bg-amber-400/[0.07] text-amber-200',
  MYTHIC: 'border-rose-300/35 bg-rose-500/[0.08] text-rose-100 shadow-[0_0_30px_rgba(244,63,94,0.12)]',
};

const FIRST_NAMES = [
  'Enzo', 'Adrian', 'Darius', 'Sebi', 'Rico', 'Marcus', 'Mihai', 'Tavi', 'Nico', 'Alex', 'Danut', 'Edi',
  'Radu', 'Victor', 'Nash', 'Tudor', 'Dante', 'Ionut', 'Marius', 'Lucian', 'Razvan', 'Theo', 'Cristi', 'Fabian',
];

const NICKNAMES = [
  'Ghost', 'Frost', 'Flame', 'Viper', 'Hood', 'Zero', 'Smoke', 'Ace', 'Wolf', 'Shadow', 'Flex', 'Nova',
  'Lucky', 'Razor', 'Cash', 'Storm', 'Mamba', 'Bullet', 'Brick', 'Slick', 'Fox', 'Boss', 'Kid', 'Saint',
];

const LAST_NAMES = [
  'Ionescu', 'Popa', 'Marin', 'Stan', 'Dobre', 'Matei', 'Dinu', 'Toma', 'Rusu', 'Munteanu', 'Petrescu', 'Ilie',
  'Stoica', 'Dragomir', 'Sandu', 'Lazar', 'Roman', 'Mocanu', 'Avram', 'Neagu', 'Serban', 'Manea', 'Nistor', 'Barbu',
];

const BONUS_DEFINITIONS: Record<GangMemberSkill, Omit<GangMemberBonus, 'id' | 'value'> & { values: number[] }> = {
  shooting: {
    label: 'Sharp Shooter',
    description: 'Prepared for future combat systems.',
    skill: 'shooting',
    values: [3, 5, 7],
  },
  farming: {
    label: 'Heavy Harvester',
    description: 'Collects extra leaves during gang farming.',
    skill: 'farming',
    values: [3, 5, 8],
  },
  tactics: {
    label: 'Tactical Mind',
    description: 'Prepared for future heists and operations.',
    skill: 'tactics',
    values: [3, 5, 7],
  },
  recruiting: {
    label: 'Talent Spotter',
    description: 'Improves the quality of normal recruitment candidates.',
    skill: 'recruiting',
    values: [3, 5, 8],
  },
  leadership: {
    label: 'Natural Leader',
    description: 'Improves the farming output of the active crew.',
    skill: 'leadership',
    values: [2, 4, 6],
  },
  streetSmart: {
    label: 'Street Connected',
    description: 'Can trigger extra opportunities during gang work.',
    skill: 'streetSmart',
    values: [2, 4, 6],
  },
};

const RARITY_RANGES: Record<GangMemberRarity, { min: number; max: number; loyaltyMin: number; loyaltyMax: number }> = {
  COMMON: { min: 18, max: 52, loyaltyMin: 58, loyaltyMax: 82 },
  RARE: { min: 32, max: 66, loyaltyMin: 62, loyaltyMax: 86 },
  EPIC: { min: 48, max: 80, loyaltyMin: 68, loyaltyMax: 91 },
  LEGENDARY: { min: 63, max: 92, loyaltyMin: 74, loyaltyMax: 95 },
  MYTHIC: { min: 82, max: 100, loyaltyMin: 90, loyaltyMax: 100 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.floor(Number.isFinite(value) ? value : min)));
}

function randomBetween(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededValue(seed: number, offset: number) {
  const value = Math.sin(seed * 12.9898 + offset * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function seededBetween(seed: number, offset: number, min: number, max: number) {
  return min + Math.floor(seededValue(seed, offset) * (max - min + 1));
}

function makeId(prefix = 'member') {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildDisplayName(firstName: string, nickname: string, lastName: string) {
  return `${firstName} "${nickname}" ${lastName}`;
}

function getBonusCount(rarity: GangMemberRarity) {
  if (rarity === 'MYTHIC') return 3;
  if (rarity === 'LEGENDARY') return 2;
  if (rarity === 'EPIC' || rarity === 'RARE') return 1;
  return 0;
}

function strongestSkills(skills: GangMemberSkills) {
  return [...GANG_MEMBER_SKILLS].sort((left, right) => skills[right] - skills[left]);
}

function createBonuses(rarity: GangMemberRarity, skills: GangMemberSkills, seed = Math.random()) {
  const count = getBonusCount(rarity);
  if (count <= 0) return [];
  const sorted = strongestSkills(skills);
  return sorted.slice(0, count).map((skill, index) => {
    const definition = BONUS_DEFINITIONS[skill];
    const tier = rarity === 'MYTHIC' || rarity === 'LEGENDARY' ? 2 : rarity === 'EPIC' ? 1 : 0;
    const value = definition.values[tier] + (rarity === 'MYTHIC' && index === 0 ? 3 : 0);
    return {
      id: `${skill}_${Math.floor(seed * 1_000_000)}_${index}`,
      label: rarity === 'MYTHIC' && index === 0 ? `Event ${definition.label}` : definition.label,
      description: definition.description,
      skill,
      value,
    } satisfies GangMemberBonus;
  });
}

function rollNormalRarity(recruitingPower = 0): GangMemberRarity {
  const qualityShift = clamp(recruitingPower, 0, 100) / 100;
  const legendary = 2 + qualityShift * 3;
  const epic = 9 + qualityShift * 5;
  const rare = 27 + qualityShift * 5;
  const roll = Math.random() * 100;
  if (roll < legendary) return 'LEGENDARY';
  if (roll < legendary + epic) return 'EPIC';
  if (roll < legendary + epic + rare) return 'RARE';
  return 'COMMON';
}

function createSkills(rarity: GangMemberRarity, seed?: number): GangMemberSkills {
  const range = RARITY_RANGES[rarity];
  const useSeed = typeof seed === 'number';
  const base = {} as GangMemberSkills;
  GANG_MEMBER_SKILLS.forEach((skill, index) => {
    base[skill] = useSeed
      ? seededBetween(seed, index + 10, range.min, range.max)
      : randomBetween(range.min, range.max);
  });

  const specialist = useSeed
    ? GANG_MEMBER_SKILLS[seededBetween(seed, 90, 0, GANG_MEMBER_SKILLS.length - 1)]
    : GANG_MEMBER_SKILLS[Math.floor(Math.random() * GANG_MEMBER_SKILLS.length)];
  base[specialist] = clamp(base[specialist] + (rarity === 'COMMON' ? 8 : 12), 1, 100);
  return base;
}

export function createGangMember(options: {
  rarity?: GangMemberRarity;
  source?: GangMemberSource;
  recruitingPower?: number;
  forcedName?: string;
  seed?: number;
} = {}): GangMember {
  const seed = typeof options.seed === 'number' ? options.seed : Math.floor(Math.random() * 1_000_000_000);
  const rarity = options.rarity || rollNormalRarity(options.recruitingPower || 0);
  const firstName = options.forcedName?.trim() || FIRST_NAMES[seededBetween(seed, 1, 0, FIRST_NAMES.length - 1)];
  const nickname = NICKNAMES[seededBetween(seed, 2, 0, NICKNAMES.length - 1)];
  const lastName = LAST_NAMES[seededBetween(seed, 3, 0, LAST_NAMES.length - 1)];
  const skills = createSkills(rarity, seed);
  const range = RARITY_RANGES[rarity];
  const loyalty = seededBetween(seed, 5, range.loyaltyMin, range.loyaltyMax);
  const source = options.source || (rarity === 'MYTHIC' ? 'ADMIN_EVENT' : 'RECRUITMENT');

  return {
    id: makeId(source === 'ADMIN_EVENT' ? 'event' : 'member'),
    firstName,
    nickname,
    lastName,
    displayName: buildDisplayName(firstName, nickname, lastName),
    rarity,
    source,
    level: rarity === 'MYTHIC' ? 10 : rarity === 'LEGENDARY' ? 5 : rarity === 'EPIC' ? 3 : rarity === 'RARE' ? 2 : 1,
    xp: 0,
    loyalty,
    skills,
    bonuses: createBonuses(rarity, skills, seededValue(seed, 7)),
    joinedAt: Date.now(),
    status: 'AVAILABLE',
    avatarSeed: seed % 12,
  };
}

export function migrateGangMember(value: unknown, index = 0): GangMember | null {
  if (typeof value === 'string') {
    const seed = hashString(`${value}_${index}`);
    return createGangMember({ forcedName: value.slice(0, 20), source: 'STARTER', rarity: index === 0 ? 'RARE' : 'COMMON', seed });
  }
  if (!value || typeof value !== 'object') return null;

  const raw = value as Partial<GangMember> & { name?: string };
  const fallbackSeed = hashString(String(raw.id || raw.displayName || raw.name || index));
  const rarity: GangMemberRarity = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC'].includes(String(raw.rarity))
    ? raw.rarity as GangMemberRarity
    : 'COMMON';
  const source: GangMemberSource = ['STARTER', 'RECRUITMENT', 'ADMIN_EVENT'].includes(String(raw.source))
    ? raw.source as GangMemberSource
    : rarity === 'MYTHIC' ? 'ADMIN_EVENT' : 'RECRUITMENT';
  const firstName = String(raw.firstName || raw.name || 'Unknown').slice(0, 24);
  const nickname = String(raw.nickname || NICKNAMES[seededBetween(fallbackSeed, 2, 0, NICKNAMES.length - 1)]).slice(0, 24);
  const lastName = String(raw.lastName || LAST_NAMES[seededBetween(fallbackSeed, 3, 0, LAST_NAMES.length - 1)]).slice(0, 24);
  const fallbackSkills = createSkills(rarity, fallbackSeed);
  const rawSkills = raw.skills || fallbackSkills;
  const skills = {} as GangMemberSkills;
  GANG_MEMBER_SKILLS.forEach((skill) => {
    skills[skill] = clamp(Number(rawSkills[skill] ?? fallbackSkills[skill]), 1, 100);
  });

  const bonuses = Array.isArray(raw.bonuses)
    ? raw.bonuses.slice(0, 3).map((bonus, bonusIndex) => ({
        id: String(bonus?.id || `legacy_${fallbackSeed}_${bonusIndex}`).slice(0, 80),
        label: String(bonus?.label || 'Member bonus').slice(0, 48),
        description: String(bonus?.description || '').slice(0, 140),
        skill: GANG_MEMBER_SKILLS.includes(bonus?.skill as GangMemberSkill) ? bonus.skill as GangMemberSkill : 'farming',
        value: clamp(Number(bonus?.value || 1), 1, 25),
      }))
    : createBonuses(rarity, skills, seededValue(fallbackSeed, 7));

  return {
    id: String(raw.id || `legacy_${fallbackSeed}_${index}`).slice(0, 100),
    firstName,
    nickname,
    lastName,
    displayName: String(raw.displayName || buildDisplayName(firstName, nickname, lastName)).slice(0, 80),
    rarity,
    source,
    level: clamp(Number(raw.level || 1), 1, 50),
    xp: clamp(Number(raw.xp || 0), 0, 1_000_000),
    loyalty: clamp(Number(raw.loyalty ?? 72), 0, 100),
    skills,
    bonuses,
    joinedAt: clamp(Number(raw.joinedAt || Date.now()), 0, Number.MAX_SAFE_INTEGER),
    status: raw.status === 'WORKING' ? 'WORKING' : 'AVAILABLE',
    avatarSeed: clamp(Number(raw.avatarSeed ?? fallbackSeed % 12), 0, 99),
  };
}

export function migrateGangMembers(value: unknown): GangMember[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry, index) => migrateGangMember(entry, index)).filter((entry): entry is GangMember => Boolean(entry)).slice(0, 34);
}

export function createStarterMembers(count = 4) {
  return Array.from({ length: count }, (_, index) => createGangMember({
    source: 'STARTER',
    rarity: index === 0 ? 'RARE' : 'COMMON',
    seed: Date.now() + index * 97,
  }));
}

export function getPrimarySkill(member: GangMember): GangMemberSkill {
  return strongestSkills(member.skills)[0];
}

export function getMemberRole(member: GangMember) {
  const roles: Record<GangMemberSkill, string> = {
    shooting: 'Shooter',
    farming: 'Farmer',
    tactics: 'Strategist',
    recruiting: 'Recruiter',
    leadership: 'Leader',
    streetSmart: 'Street Fixer',
  };
  return roles[getPrimarySkill(member)];
}

export function getRecruitingPower(members: GangMember[]) {
  return members.reduce((best, member) => {
    const bonus = member.bonuses.filter((entry) => entry.skill === 'recruiting').reduce((sum, entry) => sum + entry.value, 0);
    return Math.max(best, member.skills.recruiting + bonus);
  }, 0);
}

export function createRecruitmentBoard(existingMembers: GangMember[], count = 3) {
  const existingNames = new Set(existingMembers.map((member) => member.displayName));
  const power = getRecruitingPower(existingMembers);
  const candidates: GangMember[] = [];
  let attempts = 0;
  while (candidates.length < count && attempts < 50) {
    attempts += 1;
    const candidate = createGangMember({ source: 'RECRUITMENT', recruitingPower: power });
    if (candidate.rarity === 'MYTHIC') continue;
    if (existingNames.has(candidate.displayName) || candidates.some((entry) => entry.displayName === candidate.displayName)) continue;
    candidates.push(candidate);
  }
  return candidates;
}

export function decayDismissalPressure(pressure: number, lastDismissalAt: number, now = Date.now()) {
  if (pressure <= 0 || lastDismissalAt <= 0) return 0;
  const elapsedBlocks = Math.floor((now - lastDismissalAt) / (6 * 60 * 60 * 1000));
  return clamp(pressure - elapsedBlocks, 0, 5);
}

export function dismissGangMember(
  members: GangMember[],
  memberId: string,
  currentPressure: number,
  lastDismissalAt: number,
): DismissalResult {
  const dismissed = members.find((member) => member.id === memberId) || null;
  if (!dismissed) {
    return { members, dismissed: null, voluntaryDeparture: null, loyaltyLoss: 0, pressure: currentPressure, lastDismissalAt };
  }

  const decayedPressure = decayDismissalPressure(currentPressure, lastDismissalAt);
  const pressure = clamp(decayedPressure + 1, 1, 5);
  const loyaltyLoss = 5 + Math.max(0, pressure - 1) * 2;
  let remaining = members
    .filter((member) => member.id !== memberId)
    .map((member) => ({ ...member, loyalty: clamp(member.loyalty - loyaltyLoss, 0, 100) }));

  let voluntaryDeparture: GangMember | null = null;
  if (pressure >= 2 && remaining.length > 0) {
    const atRisk = [...remaining].sort((left, right) => left.loyalty - right.loyalty)[0];
    const loyaltyRisk = Math.max(0, 58 - atRisk.loyalty) * 0.008;
    const pressureRisk = (pressure - 1) * 0.045;
    const leaveChance = Math.min(0.4, loyaltyRisk + pressureRisk);
    if (Math.random() < leaveChance) {
      voluntaryDeparture = atRisk;
      remaining = remaining.filter((member) => member.id !== atRisk.id);
    }
  }

  return {
    members: remaining,
    dismissed,
    voluntaryDeparture,
    loyaltyLoss,
    pressure,
    lastDismissalAt: Date.now(),
  };
}

export function memberXpForNextLevel(level: number) {
  return 90 + clamp(level, 1, 50) * 35;
}

export function awardMemberActivity(
  members: GangMember[],
  participantIds: string[],
  focusSkill: GangMemberSkill,
  xpGain: number,
) {
  const active = new Set(participantIds);
  return members.map((member) => {
    if (!active.has(member.id)) return { ...member, status: 'AVAILABLE' as GangMemberStatus };
    let level = member.level;
    let xp = member.xp + xpGain;
    let skillGain = 0;
    while (level < 50 && xp >= memberXpForNextLevel(level)) {
      xp -= memberXpForNextLevel(level);
      level += 1;
      skillGain += 1;
    }
    return {
      ...member,
      level,
      xp,
      loyalty: clamp(member.loyalty + 1, 0, 100),
      status: 'AVAILABLE' as GangMemberStatus,
      skills: {
        ...member.skills,
        [focusSkill]: clamp(member.skills[focusSkill] + skillGain, 1, 100),
      },
    };
  });
}

export function markMembersWorking(members: GangMember[], participantIds: string[]) {
  const active = new Set(participantIds);
  return members.map((member) => ({ ...member, status: active.has(member.id) ? 'WORKING' as const : 'AVAILABLE' as const }));
}

export function selectActiveMembers(members: GangMember[], count: number) {
  return [...members]
    .sort(() => Math.random() - 0.5)
    .slice(0, clamp(count, 0, members.length));
}

export function calculateFarmingYield(participants: GangMember[]) {
  if (participants.length === 0) return { total: 0, bonus: 0, exceptionalCount: 0 };
  let total = 0;
  let exceptionalCount = 0;
  participants.forEach((member) => {
    const farmingBonus = member.bonuses.filter((entry) => entry.skill === 'farming').reduce((sum, entry) => sum + entry.value, 0);
    const personalBonus = Math.floor(1200 * (member.skills.farming + farmingBonus) / 500);
    let yieldAmount = 1200 + personalBonus;
    const exceptionalChance = Math.min(0.22, 0.025 + member.skills.farming / 900);
    if (Math.random() < exceptionalChance) {
      yieldAmount += 300;
      exceptionalCount += 1;
    }
    total += yieldAmount;
  });

  const bestLeader = participants.reduce((best, member) => {
    const bonus = member.bonuses.filter((entry) => entry.skill === 'leadership').reduce((sum, entry) => sum + entry.value, 0);
    return Math.max(best, member.skills.leadership + bonus);
  }, 0);
  const leadershipBonus = Math.floor(total * Math.min(0.1, bestLeader / 1000));
  total += leadershipBonus;
  return {
    total,
    bonus: total - participants.length * 1200,
    exceptionalCount,
  };
}
