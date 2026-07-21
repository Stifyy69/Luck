const CITY_MAX_LEVEL = 50;

const CITY_LEVEL_START_XP = [
  0,
  0,
  400,
  800,
  1500,
  2500,
  4000,
  6000,
  8500,
  11500,
  15000,
  21000,
  29000,
  39000,
  51000,
  65000,
];

let runningThreshold = CITY_LEVEL_START_XP[15];
for (let level = 16; level <= CITY_MAX_LEVEL; level += 1) {
  runningThreshold += 9000 + (level - 16) * 500;
  CITY_LEVEL_START_XP[level] = runningThreshold;
}

const CAREER_UNLOCKS = [
  { key: 'PIZZER', label: 'Pizza Courier', level: 1, path: '/pizzer' },
  { key: 'FISHER', label: 'Fisher', level: 3, path: '/fisher' },
  { key: 'PILOT', label: 'Pilot', level: 6, path: '/pilot' },
  { key: 'CAYO', label: 'Cayo', level: 10, path: '/farmat' },
  { key: 'GANGS', label: 'Gangs', level: 15, path: '/gangs' },
];

const CITY_XP_REWARDS = Object.freeze({
  PIZZER_DELIVERY: 100,
  FISHER_CATCH: 80,
  PILOT_FLIGHT: 220,
  CAYO_COLLECT: 15,
  CAYO_PROCESS: 25,
  CAYO_REFINE: 40,
});

function cityLevelStartXp(level) {
  const normalized = Math.max(1, Math.min(CITY_MAX_LEVEL, Number(level || 1)));
  return Number(CITY_LEVEL_START_XP[normalized] || 0);
}

function cityLevelFromXp(xp) {
  const normalizedXp = Math.max(0, Number(xp || 0));
  let level = 1;
  for (let candidate = 2; candidate <= CITY_MAX_LEVEL; candidate += 1) {
    if (normalizedXp < cityLevelStartXp(candidate)) break;
    level = candidate;
  }
  return level;
}

function unlocksAtLevel(level) {
  return CAREER_UNLOCKS.filter((unlock) => unlock.level === Number(level || 0));
}

function unlocksBetweenLevels(fromLevel, toLevel) {
  const from = Number(fromLevel || 1);
  const to = Number(toLevel || from);
  return CAREER_UNLOCKS.filter((unlock) => unlock.level > from && unlock.level <= to);
}

function nextUnlockForLevel(level) {
  return CAREER_UNLOCKS.find((unlock) => unlock.level > Number(level || 1)) || null;
}

function buildCareerAccess(level, vipActive) {
  const currentLevel = Math.max(1, Number(level || 1));
  return {
    pizzer: { unlocked: true, requiredLevel: 1, reason: null },
    fisher: {
      unlocked: currentLevel >= 3,
      requiredLevel: 3,
      reason: currentLevel >= 3 ? null : 'Reach City Level 3',
    },
    pilot: {
      unlocked: currentLevel >= 6,
      requiredLevel: 6,
      reason: currentLevel >= 6 ? null : 'Reach City Level 6',
    },
    cayo: {
      unlocked: currentLevel >= 10,
      requiredLevel: 10,
      reason: currentLevel >= 10 ? null : 'Reach City Level 10',
    },
    gangs: {
      unlocked: currentLevel >= 15,
      requiredLevel: 15,
      reason: currentLevel >= 15 ? null : 'Reach City Level 15',
    },
    nightShift: {
      unlocked: Boolean(vipActive),
      requiredLevel: null,
      vipOnly: true,
      reason: vipActive ? null : 'VIP access required',
    },
  };
}

module.exports = {
  CAREER_UNLOCKS,
  CITY_LEVEL_START_XP,
  CITY_MAX_LEVEL,
  CITY_XP_REWARDS,
  buildCareerAccess,
  cityLevelFromXp,
  cityLevelStartXp,
  nextUnlockForLevel,
  unlocksAtLevel,
  unlocksBetweenLevels,
};
