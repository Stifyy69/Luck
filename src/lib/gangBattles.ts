import {
  createGangMember,
  getLoyaltyEfficiency,
  getSkillWithBonuses,
  type GangMember,
  type GangMemberRarity,
} from './gangMembers';

export type GangBattleStageId = 'ambush' | 'firefight' | 'finalPush';
export type GangBattleDifficulty = 'EASY' | 'BALANCED' | 'HARD';

export type GangBotOpponent = {
  id: string;
  name: string;
  levelIndex: number;
  difficulty: GangBattleDifficulty;
  specialty: 'Shooting' | 'Tactics' | 'Leadership' | 'Street Smart';
  members: GangMember[];
  leaderId: string;
  dirtyReward: number;
  reputationReward: number;
  gunpowderReward: number;
  steelReward: number;
};

export type GangBattleStageResult = {
  id: GangBattleStageId;
  label: string;
  playerScore: number;
  opponentScore: number;
  winner: 'PLAYER' | 'OPPONENT';
  eventText: string;
};

export type GangBattleInjury = {
  memberId: string;
  memberName: string;
  recoveryHours: number;
};

export type GangBattleResult = {
  won: boolean;
  playerStageWins: number;
  opponentStageWins: number;
  stages: GangBattleStageResult[];
  injuries: GangBattleInjury[];
  dirtyReward: number;
  reputationReward: number;
  gunpowderReward: number;
  steelReward: number;
  loyaltyGain: number;
  xpGain: number;
  opponentId: string;
  opponentName: string;
  completedAt: number;
};

export type GangBattleHistoryEntry = {
  id: string;
  opponentId: string;
  opponentName: string;
  won: boolean;
  score: string;
  memberIds: string[];
  leaderId: string;
  injuries: GangBattleInjury[];
  dirtyReward: number;
  reputationReward: number;
  gunpowderReward: number;
  steelReward: number;
  completedAt: number;
};

export type GangBattlePreview = {
  playerPower: number;
  opponentPower: number;
  comparison: 'ADVANTAGE' | 'BALANCED' | 'DISADVANTAGE';
  injuryRisk: number;
};

const BOT_GANG_NAMES = [
  'East Side Locos', 'North Block', 'Redline Crew', 'Black Harbor', 'South Crown', 'Iron Saints',
  'Night Wolves', 'Golden Serpents', 'Dockyard Kings', 'Cold Street', 'Ash District', 'Zero Mercy',
];

const SPECIALTIES: GangBotOpponent['specialty'][] = ['Shooting', 'Tactics', 'Leadership', 'Street Smart'];
const STAGE_LABELS: Record<GangBattleStageId, string> = {
  ambush: 'Ambush',
  firefight: 'Firefight',
  finalPush: 'Final Push',
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hashSeed(value: number) {
  let seed = Math.floor(value) >>> 0;
  seed ^= seed << 13;
  seed ^= seed >>> 17;
  seed ^= seed << 5;
  return seed >>> 0;
}

function seededUnit(seed: number, offset: number) {
  return (hashSeed(seed + offset * 2654435761) % 1_000_000) / 1_000_000;
}

function seededBetween(seed: number, offset: number, min: number, max: number) {
  return min + Math.floor(seededUnit(seed, offset) * (max - min + 1));
}

function randomFactor(random: () => number) {
  return 0.95 + clamp(random(), 0, 1) * 0.1;
}

function rarityForBot(levelIndex: number, difficultyIndex: number, slot: number): GangMemberRarity {
  const score = levelIndex * 2 + difficultyIndex + Math.floor(slot / 2);
  if (score >= 8) return 'LEGENDARY';
  if (score >= 5) return 'EPIC';
  if (score >= 2) return 'RARE';
  return 'COMMON';
}

function memberBattleMultiplier(member: GangMember) {
  const levelBonus = 1 + Math.min(0.2, member.level * 0.005);
  return getLoyaltyEfficiency(member) * levelBonus;
}

function teamSkillAverage(members: GangMember[], skill: 'shooting' | 'tactics' | 'leadership' | 'streetSmart') {
  if (members.length === 0) return 0;
  return members.reduce((sum, member) => sum + getSkillWithBonuses(member, skill) * memberBattleMultiplier(member), 0) / members.length;
}

function teamLoyaltyAverage(members: GangMember[]) {
  if (members.length === 0) return 0;
  return members.reduce((sum, member) => sum + member.loyalty, 0) / members.length;
}

function getLeader(members: GangMember[], leaderId: string) {
  return members.find((member) => member.id === leaderId)
    || [...members].sort((left, right) => getSkillWithBonuses(right, 'leadership') - getSkillWithBonuses(left, 'leadership'))[0]
    || null;
}

function crewMultiplier(count: number) {
  return 0.75 + clamp(count, 1, 5) * 0.05;
}

function leaderMultiplier(leader: GangMember | null) {
  if (!leader) return 1;
  return 1 + getSkillWithBonuses(leader, 'leadership') / 2000;
}

function stageBaseScore(stage: GangBattleStageId, members: GangMember[], leaderId: string) {
  if (members.length === 0) return 0;
  const shooting = teamSkillAverage(members, 'shooting');
  const tactics = teamSkillAverage(members, 'tactics');
  const streetSmart = teamSkillAverage(members, 'streetSmart');
  const loyalty = teamLoyaltyAverage(members);
  const leader = getLeader(members, leaderId);
  const leadership = leader ? getSkillWithBonuses(leader, 'leadership') * memberBattleMultiplier(leader) : 0;
  let base = 0;
  if (stage === 'ambush') base = tactics * 0.45 + streetSmart * 0.35 + shooting * 0.2;
  if (stage === 'firefight') base = shooting * 0.6 + tactics * 0.25 + loyalty * 0.15;
  if (stage === 'finalPush') base = shooting * 0.35 + tactics * 0.15 + leadership * 0.3 + loyalty * 0.2;
  return base * crewMultiplier(members.length) * leaderMultiplier(leader);
}

export function calculateBattleTeamPower(members: GangMember[], leaderId: string) {
  if (members.length === 0) return 0;
  const score = (stageBaseScore('ambush', members, leaderId)
    + stageBaseScore('firefight', members, leaderId)
    + stageBaseScore('finalPush', members, leaderId)) / 3;
  return Math.round(score * 100);
}

function averageInjuryChance(playerMembers: GangMember[], opponentMembers: GangMember[], won: boolean) {
  if (playerMembers.length === 0) return 0;
  const enemyShooting = teamSkillAverage(opponentMembers, 'shooting');
  const total = playerMembers.reduce((sum, member) => {
    const tactics = getSkillWithBonuses(member, 'tactics');
    const streetSmart = getSkillWithBonuses(member, 'streetSmart');
    let chance = 0.08 + (enemyShooting - tactics) / 500 - streetSmart / 1800;
    chance *= won ? 0.68 : 1.2;
    return sum + clamp(chance, 0.02, 0.3);
  }, 0);
  return total / playerMembers.length;
}

export function previewGangBattle(
  playerMembers: GangMember[],
  leaderId: string,
  opponent: GangBotOpponent,
): GangBattlePreview {
  const playerPower = calculateBattleTeamPower(playerMembers, leaderId);
  const opponentPower = calculateBattleTeamPower(opponent.members, opponent.leaderId);
  const ratio = playerPower / Math.max(1, opponentPower);
  const comparison = ratio >= 1.12 ? 'ADVANTAGE' : ratio <= 0.88 ? 'DISADVANTAGE' : 'BALANCED';
  const injuryRisk = Math.round(averageInjuryChance(playerMembers, opponent.members, ratio >= 1) * 100);
  return { playerPower, opponentPower, comparison, injuryRisk };
}

export function generateBotOpponents(levelIndex: number, boardSeed: number): GangBotOpponent[] {
  const safeLevel = Math.max(0, Math.min(3, Math.floor(levelIndex)));
  const usedNames = new Set<string>();
  return Array.from({ length: 3 }, (_, difficultyIndex) => {
    const seed = hashSeed(boardSeed + difficultyIndex * 1013 + safeLevel * 7919);
    const difficulty: GangBattleDifficulty = difficultyIndex === 0 ? 'EASY' : difficultyIndex === 1 ? 'BALANCED' : 'HARD';
    const memberCount = Math.min(5, 3 + difficultyIndex + (safeLevel >= 2 ? 1 : 0));
    const specialty = SPECIALTIES[seededBetween(seed, 2, 0, SPECIALTIES.length - 1)];
    const members = Array.from({ length: memberCount }, (_, slot) => {
      const memberSeed = seed + slot * 193;
      const member = createGangMember({
        rarity: rarityForBot(safeLevel, difficultyIndex, slot),
        source: 'RECRUITMENT',
        seed: memberSeed,
      });
      const specialtySkill = specialty === 'Shooting' ? 'shooting'
        : specialty === 'Tactics' ? 'tactics'
          : specialty === 'Leadership' ? 'leadership'
            : 'streetSmart';
      return {
        ...member,
        id: `bot_${seed}_${slot}`,
        level: Math.min(50, member.level + safeLevel * 2 + difficultyIndex * 2),
        loyalty: Math.min(100, member.loyalty + difficultyIndex * 4),
        skills: {
          ...member.skills,
          [specialtySkill]: Math.min(100, member.skills[specialtySkill] + 8 + difficultyIndex * 4),
        },
      };
    });
    const leader = [...members].sort((left, right) => right.skills.leadership - left.skills.leadership)[0];
    const rewardMultiplier = 1 + safeLevel * 0.8 + difficultyIndex * 0.65;
    let nameIndex = seededBetween(seed, 3, 0, BOT_GANG_NAMES.length - 1);
    while (usedNames.has(BOT_GANG_NAMES[nameIndex])) nameIndex = (nameIndex + 1) % BOT_GANG_NAMES.length;
    const name = BOT_GANG_NAMES[nameIndex];
    usedNames.add(name);
    return {
      id: `bot_gang_${seed}`,
      name,
      levelIndex: safeLevel,
      difficulty,
      specialty,
      members,
      leaderId: leader.id,
      dirtyReward: Math.round((50_000 + seededBetween(seed, 4, 10_000, 70_000)) * rewardMultiplier),
      reputationReward: 60 + safeLevel * 45 + difficultyIndex * 55,
      gunpowderReward: difficultyIndex === 0 ? 0 : seededBetween(seed, 5, 3, 8 + safeLevel * 3),
      steelReward: difficultyIndex === 0 ? seededBetween(seed, 6, 1, 4) : seededBetween(seed, 6, 4, 10 + safeLevel * 3),
    };
  });
}

function battleEventText(stage: GangBattleStageId, winner: 'PLAYER' | 'OPPONENT', playerMembers: GangMember[], opponent: GangBotOpponent) {
  const playerName = [...playerMembers].sort((left, right) => right.skills.shooting - left.skills.shooting)[0]?.nickname || 'Your crew';
  const opponentName = [...opponent.members].sort((left, right) => right.skills.shooting - left.skills.shooting)[0]?.nickname || opponent.name;
  if (stage === 'ambush') return winner === 'PLAYER' ? `${playerName} detected the ambush first.` : `${opponent.name} controlled the opening position.`;
  if (stage === 'firefight') return winner === 'PLAYER' ? `${playerName} broke the enemy firing line.` : `${opponentName} pushed your crew back.`;
  return winner === 'PLAYER' ? 'Your leader completed the final push.' : `${opponent.name} held the final position.`;
}

export function simulateGangBattle(
  playerMembers: GangMember[],
  leaderId: string,
  opponent: GangBotOpponent,
  random: () => number = Math.random,
): GangBattleResult {
  const stages: GangBattleStageResult[] = (['ambush', 'firefight', 'finalPush'] as GangBattleStageId[]).map((id) => {
    const playerScore = Math.round(stageBaseScore(id, playerMembers, leaderId) * randomFactor(random) * 100) / 100;
    const opponentScore = Math.round(stageBaseScore(id, opponent.members, opponent.leaderId) * randomFactor(random) * 100) / 100;
    const winner = playerScore >= opponentScore ? 'PLAYER' as const : 'OPPONENT' as const;
    return {
      id,
      label: STAGE_LABELS[id],
      playerScore,
      opponentScore,
      winner,
      eventText: battleEventText(id, winner, playerMembers, opponent),
    };
  });
  const playerStageWins = stages.filter((stage) => stage.winner === 'PLAYER').length;
  const opponentStageWins = stages.length - playerStageWins;
  const won = playerStageWins >= 2;
  const injuries: GangBattleInjury[] = [];
  const enemyShooting = teamSkillAverage(opponent.members, 'shooting');
  playerMembers.forEach((member) => {
    const tactics = getSkillWithBonuses(member, 'tactics');
    const streetSmart = getSkillWithBonuses(member, 'streetSmart');
    let chance = 0.08 + (enemyShooting - tactics) / 500 - streetSmart / 1800;
    chance *= won ? 0.68 : 1.2;
    chance = clamp(chance, 0.02, 0.3);
    if (random() < chance) {
      injuries.push({
        memberId: member.id,
        memberName: member.displayName,
        recoveryHours: random() < 0.2 ? 3 : random() < 0.55 ? 2 : 1,
      });
    }
  });
  const preview = previewGangBattle(playerMembers, leaderId, opponent);
  const loyaltyGain = won
    ? preview.comparison === 'DISADVANTAGE' ? 10 : opponent.difficulty === 'HARD' ? 8 : opponent.difficulty === 'BALANCED' ? 5 : 3
    : 0;
  const xpGain = 20 + playerStageWins * 10 + (won ? 30 : 0);
  return {
    won,
    playerStageWins,
    opponentStageWins,
    stages,
    injuries,
    dirtyReward: won ? opponent.dirtyReward : 0,
    reputationReward: won ? opponent.reputationReward : 10,
    gunpowderReward: won ? opponent.gunpowderReward : 0,
    steelReward: won ? opponent.steelReward : 0,
    loyaltyGain,
    xpGain,
    opponentId: opponent.id,
    opponentName: opponent.name,
    completedAt: Date.now(),
  };
}

export function toBattleHistoryEntry(result: GangBattleResult, memberIds: string[], leaderId: string): GangBattleHistoryEntry {
  return {
    id: `battle_${result.completedAt}_${Math.random().toString(36).slice(2, 8)}`,
    opponentId: result.opponentId,
    opponentName: result.opponentName,
    won: result.won,
    score: `${result.playerStageWins}-${result.opponentStageWins}`,
    memberIds: memberIds.slice(0, 5),
    leaderId,
    injuries: result.injuries.slice(0, 5),
    dirtyReward: result.dirtyReward,
    reputationReward: result.reputationReward,
    gunpowderReward: result.gunpowderReward,
    steelReward: result.steelReward,
    completedAt: result.completedAt,
  };
}

export function migrateBattleHistory(value: unknown): GangBattleHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry as Partial<GangBattleHistoryEntry> : {};
    return {
      id: String(raw.id || `legacy_battle_${index}`).slice(0, 100),
      opponentId: String(raw.opponentId || '').slice(0, 100),
      opponentName: String(raw.opponentName || 'Unknown gang').slice(0, 80),
      won: Boolean(raw.won),
      score: String(raw.score || '0-0').slice(0, 10),
      memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.map(String).slice(0, 5) : [],
      leaderId: String(raw.leaderId || '').slice(0, 100),
      injuries: Array.isArray(raw.injuries) ? raw.injuries.slice(0, 5).map((injury) => ({
        memberId: String(injury?.memberId || '').slice(0, 100),
        memberName: String(injury?.memberName || 'Member').slice(0, 80),
        recoveryHours: Math.max(1, Math.min(3, Number(injury?.recoveryHours || 1))),
      })) : [],
      dirtyReward: Math.max(0, Number(raw.dirtyReward || 0)),
      reputationReward: Math.max(0, Number(raw.reputationReward || 0)),
      gunpowderReward: Math.max(0, Number(raw.gunpowderReward || 0)),
      steelReward: Math.max(0, Number(raw.steelReward || 0)),
      completedAt: Math.max(0, Number(raw.completedAt || Date.now())),
    };
  });
}
