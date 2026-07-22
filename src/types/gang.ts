export type GangResource = 'leaves' | 'white' | 'blue' | 'sulfur' | 'ironOre' | 'gunpowder' | 'steel';
export type GangRecipe = 'white' | 'blue' | 'gunpowder' | 'steel';
export type GangRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythic';
export type GangStatus = 'Available' | 'Working' | 'Injured';
export type GangRole = 'Shooter' | 'Farmer' | 'Strategist' | 'Recruiter' | 'Leader' | 'Street Fixer';

export type GangSkills = {
  shooting: number;
  tactics: number;
  leadership: number;
  streetSmart: number;
  farming: number;
  recruiting: number;
};

export type GangMember = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string;
  displayName: string;
  rarity: GangRarity;
  status: GangStatus;
  role: GangRole;
  level: number;
  xp: number;
  xpNeeded: number;
  loyalty: number;
  skills: GangSkills;
  bonuses?: string[];
  lastWork?: string;
  fatigue?: { activity: string; count: number };
  injuryUntil?: string;
  joinedAt: string;
};

export type GangState = {
  name: string;
  level: number;
  cleanBalance: number;
  dirtyBalance: number;
  totalDirtyEarned: number;
  battleReputation: number;
  stockValue: number;
  stateVersion: number;
  resources: Record<GangResource, number>;
  members: GangMember[];
  activityLog: Array<{ id: string; type: string; message: string; createdAt: string }>;
};
