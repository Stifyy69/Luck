import type { PlayerState } from '../types/game';

export type CareerAccessKey = 'pizzer' | 'fisher' | 'pilot' | 'cayo' | 'gangs' | 'nightShift';

export type CareerAccessEntry = {
  unlocked: boolean;
  requiredLevel: number | null;
  vipOnly?: boolean;
  reason: string | null;
};

export type CityUnlock = {
  key: string;
  label: string;
  level: number;
  path: string;
};

export type CityTutorialState = {
  version: number;
  step: number;
  completedAt: string | null;
  skippedAt: string | null;
};

export type CityProgress = {
  level: number;
  xp: number;
  levelStartXp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  nextLevelTotalXp: number | null;
  xpToNext: number;
  progressPercent: number;
  maxLevel: number;
  nextUnlock: CityUnlock | null;
  vipActive: boolean;
  careerAccess: Record<CareerAccessKey, CareerAccessEntry>;
  tutorial: CityTutorialState;
};

export type CityProgressReward = {
  awardedXp: number;
  duplicate?: boolean;
  levelUp?: {
    fromLevel: number;
    toLevel: number;
    unlocks: CityUnlock[];
  } | null;
};

export type PlayerWithCityProgress = PlayerState & {
  cityProgress?: CityProgress;
  careerAccess?: CityProgress['careerAccess'];
};

export const CAREER_REQUIREMENTS: Record<string, { key: CareerAccessKey; label: string; level: number | null; vipOnly?: boolean; recommendedPath: string }> = {
  '/pizzer': { key: 'pizzer', label: 'Pizza Courier', level: 1, recommendedPath: '/pizzer' },
  '/fisher': { key: 'fisher', label: 'Fisher', level: 3, recommendedPath: '/pizzer' },
  '/pilot': { key: 'pilot', label: 'Pilot', level: 6, recommendedPath: '/fisher' },
  '/farmat': { key: 'cayo', label: 'Cayo', level: 10, recommendedPath: '/pilot' },
  '/gangs': { key: 'gangs', label: 'Gangs', level: 15, recommendedPath: '/farmat' },
  '/sleep': { key: 'nightShift', label: 'Night Shift', level: null, vipOnly: true, recommendedPath: '/inventory' },
};

export const CITY_UNLOCKS: CityUnlock[] = [
  { key: 'PIZZER', label: 'Pizza Courier', level: 1, path: '/pizzer' },
  { key: 'FISHER', label: 'Fisher', level: 3, path: '/fisher' },
  { key: 'PILOT', label: 'Pilot', level: 6, path: '/pilot' },
  { key: 'CAYO', label: 'Cayo', level: 10, path: '/farmat' },
  { key: 'GANGS', label: 'Gangs', level: 15, path: '/gangs' },
];

export function readPlayerCityProgress(player: PlayerState | null | undefined): CityProgress | null {
  return (player as PlayerWithCityProgress | null | undefined)?.cityProgress || null;
}

export function isCareerUnlocked(path: string, progress: CityProgress | null): boolean {
  const requirement = CAREER_REQUIREMENTS[path];
  if (!requirement) return true;
  if (!progress) return path === '/pizzer';
  return Boolean(progress.careerAccess?.[requirement.key]?.unlocked);
}

export function careerAccessForPath(path: string, progress: CityProgress | null): CareerAccessEntry | null {
  const requirement = CAREER_REQUIREMENTS[path];
  if (!requirement) return null;
  if (progress?.careerAccess?.[requirement.key]) return progress.careerAccess[requirement.key];
  return {
    unlocked: path === '/pizzer',
    requiredLevel: requirement.level,
    vipOnly: requirement.vipOnly,
    reason: requirement.vipOnly ? 'VIP access required' : requirement.level ? `Reach City Level ${requirement.level}` : null,
  };
}

export function unlockAtLevel(level: number): CityUnlock | null {
  return CITY_UNLOCKS.find((unlock) => unlock.level === Number(level)) || null;
}
