const CITY_MAX_LEVEL = 50;

const CITY_LEVEL_START_XP = [
  0,
  0,
  800,
  2000,
  3800,
  6200,
  9000,
  12500,
  16500,
  20500,
  25000,
  32000,
  40000,
  48000,
  56500,
  65000,
];

let runningThreshold = CITY_LEVEL_START_XP[15];
for (let level = 16; level <= CITY_MAX_LEVEL; level += 1) {
  runningThreshold += 11000 + (level - 16) * 750;
  CITY_LEVEL_START_XP[level] = runningThreshold;
}

const CAREER_UNLOCKS = [
  { key: 'PIZZER', label: 'Pizza Courier', level: 1, path: '/pizzer' },
  { key: 'FISHER', label: 'Fisher', level: 3, path: '/fisher' },
  { key: 'PILOT', label: 'Pilot', level: 6, path: '/pilot' },
  { key: 'CAYO', label: 'Cayo', level: 10, path: '/farmat' },
  { key: 'GANGS', label: 'Gangs', level: 15, path: '/gangs' },
];

const PILOT_ROUTE_XP = Object.freeze({
  ROUTE_1: 120,
  ROUTE_2: 170,
  ROUTE_3: 240,
  ROUTE_4: 320,
  ROUTE_5: 450,
});

const CITY_XP_REWARDS = Object.freeze({
  PIZZER_DELIVERY: 100,
  FISHER_CATCH: 120,
  PILOT_FLIGHT: 120,
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

function requirementReason(cityOk, cityLevel, careerOk, careerLabel, careerLevel) {
  if (!cityOk && !careerOk) return `Reach City Level ${cityLevel} and ${careerLabel} Level ${careerLevel}`;
  if (!cityOk) return `Reach City Level ${cityLevel}`;
  if (!careerOk) return `Reach ${careerLabel} Level ${careerLevel}`;
  return null;
}

function buildCareerAccess(level, vipActive, careerLevels = {}) {
  const currentLevel = Math.max(1, Number(level || 1));
  const pizzerLevel = Math.max(1, Number(careerLevels.pizzerLevel || 1));
  const fisherLevel = Math.max(1, Number(careerLevels.fisherLevel || 1));
  const pilotLevel = Math.max(1, Number(careerLevels.pilotLevel || 1));

  const fisherCityOk = currentLevel >= 3;
  const fisherCareerOk = pizzerLevel >= 3;
  const pilotCityOk = currentLevel >= 6;
  const pilotCareerOk = fisherLevel >= 4;
  const cayoCityOk = currentLevel >= 10;
  const cayoCareerOk = pilotLevel >= 5;

  return {
    pizzer: { unlocked: true, requiredLevel: 1, reason: null },
    fisher: {
      unlocked: fisherCityOk && fisherCareerOk,
      requiredLevel: 3,
      requiredCareerLevel: 3,
      requiredCareer: 'Pizza Courier',
      reason: requirementReason(fisherCityOk, 3, fisherCareerOk, 'Pizza Courier', 3),
    },
    pilot: {
      unlocked: pilotCityOk && pilotCareerOk,
      requiredLevel: 6,
      requiredCareerLevel: 4,
      requiredCareer: 'Fisher',
      reason: requirementReason(pilotCityOk, 6, pilotCareerOk, 'Fisher', 4),
    },
    cayo: {
      unlocked: cayoCityOk && cayoCareerOk,
      requiredLevel: 10,
      requiredCareerLevel: 5,
      requiredCareer: 'Pilot',
      reason: requirementReason(cayoCityOk, 10, cayoCareerOk, 'Pilot', 5),
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
  PILOT_ROUTE_XP,
  buildCareerAccess,
  cityLevelFromXp,
  cityLevelStartXp,
  nextUnlockForLevel,
  unlocksAtLevel,
  unlocksBetweenLevels,
};
