const crypto = require('crypto');

const SKILLS = Object.freeze(['shooting', 'farming', 'tactics', 'recruiting', 'leadership', 'streetSmart']);
const RARITIES = new Set(['COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC']);
const SOURCES = new Set(['STARTER', 'RECRUITMENT', 'ADMIN_EVENT']);
const STATUSES = new Set(['AVAILABLE', 'WORKING', 'INJURED']);

const FIRST_NAMES = ['Enzo', 'Darius', 'Marcus', 'Rico', 'Mihai', 'Tavi', 'Nico', 'Victor', 'Dante', 'Razvan', 'Fabian', 'Theo'];
const NICKNAMES = ['Ghost', 'Frost', 'Flame', 'Viper', 'Smoke', 'Ace', 'Wolf', 'Shadow', 'Nova', 'Razor', 'Storm', 'Saint'];
const LAST_NAMES = ['Ionescu', 'Popa', 'Marin', 'Stan', 'Dobre', 'Matei', 'Toma', 'Rusu', 'Petrescu', 'Stoica', 'Roman', 'Neagu'];

const BONUS_LABELS = Object.freeze({
  shooting: ['Event Sharp Shooter', 'Improves direct combat power.'],
  farming: ['Event Heavy Harvester', 'Collects extra leaves during gang farming.'],
  tactics: ['Event Tactical Mind', 'Improves battle positioning and processing.'],
  recruiting: ['Event Talent Spotter', 'Improves normal recruitment candidates.'],
  leadership: ['Event Natural Leader', 'Improves the active crew.'],
  streetSmart: ['Event Street Connected', 'Reduces operation and battle risk.'],
});

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(safeNumber(value, min))));
}

function sanitizeText(value, maxLength, fallback = '') {
  const text = String(value || fallback).trim();
  return text.slice(0, maxLength);
}

function legacyMemberFromName(name, index) {
  const safeName = sanitizeText(name, 24, 'Unknown');
  const nickname = NICKNAMES[index % NICKNAMES.length];
  const lastName = LAST_NAMES[index % LAST_NAMES.length];
  const skills = {};
  SKILLS.forEach((skill, skillIndex) => {
    skills[skill] = 28 + ((index * 11 + skillIndex * 7) % 28);
  });
  return {
    id: `legacy_${crypto.createHash('sha1').update(`${safeName}_${index}`).digest('hex').slice(0, 16)}`,
    firstName: safeName,
    nickname,
    lastName,
    displayName: `${safeName} "${nickname}" ${lastName}`,
    rarity: index === 0 ? 'RARE' : 'COMMON',
    source: 'STARTER',
    level: index === 0 ? 2 : 1,
    xp: 0,
    loyalty: 72,
    skills,
    bonuses: [],
    joinedAt: Date.now(),
    status: 'AVAILABLE',
    avatarSeed: index % 12,
    lastWorkType: null,
    consecutiveWorkRuns: 0,
    injuredUntilGameHour: 0,
  };
}

function sanitizeMember(value, index = 0, allowMythicIds = new Set()) {
  if (typeof value === 'string') return legacyMemberFromName(value, index);
  if (!value || typeof value !== 'object') return null;

  const id = sanitizeText(value.id, 100, `member_${index}`);
  let rarity = RARITIES.has(String(value.rarity)) ? String(value.rarity) : 'COMMON';
  let source = SOURCES.has(String(value.source)) ? String(value.source) : 'RECRUITMENT';
  const mythicAllowed = rarity === 'MYTHIC' && source === 'ADMIN_EVENT' && allowMythicIds.has(id);
  if (rarity === 'MYTHIC' && !mythicAllowed) {
    rarity = 'LEGENDARY';
    source = 'RECRUITMENT';
  }
  if (source === 'ADMIN_EVENT' && rarity !== 'MYTHIC') source = 'RECRUITMENT';

  const firstName = sanitizeText(value.firstName, 24, 'Unknown');
  const nickname = sanitizeText(value.nickname, 24, 'Ghost');
  const lastName = sanitizeText(value.lastName, 24, 'Ionescu');
  const skills = {};
  SKILLS.forEach((skill) => {
    skills[skill] = clampInteger(value.skills?.[skill], 1, 100);
  });

  const bonuses = Array.isArray(value.bonuses)
    ? value.bonuses.slice(0, 3).map((bonus, bonusIndex) => {
        const skill = SKILLS.includes(String(bonus?.skill)) ? String(bonus.skill) : 'farming';
        return {
          id: sanitizeText(bonus?.id, 80, `bonus_${index}_${bonusIndex}`),
          label: sanitizeText(bonus?.label, 48, 'Member bonus'),
          description: sanitizeText(bonus?.description, 140, ''),
          skill,
          value: clampInteger(bonus?.value, 1, 25),
        };
      })
    : [];

  const injuredUntilGameHour = Math.max(0, safeNumber(value.injuredUntilGameHour, 0));
  let status = STATUSES.has(String(value.status)) ? String(value.status) : 'AVAILABLE';
  if (injuredUntilGameHour > 0) status = 'INJURED';
  if (status === 'INJURED' && injuredUntilGameHour <= 0) status = 'AVAILABLE';

  return {
    id,
    firstName,
    nickname,
    lastName,
    displayName: sanitizeText(value.displayName, 80, `${firstName} "${nickname}" ${lastName}`),
    rarity,
    source,
    level: clampInteger(value.level, 1, 50),
    xp: clampInteger(value.xp, 0, 1_000_000),
    loyalty: clampInteger(value.loyalty, 0, 100),
    skills,
    bonuses,
    joinedAt: clampInteger(value.joinedAt || Date.now(), 0, Number.MAX_SAFE_INTEGER),
    status,
    avatarSeed: clampInteger(value.avatarSeed, 0, 99),
    lastWorkType: value.lastWorkType ? sanitizeText(value.lastWorkType, 40, '') : null,
    consecutiveWorkRuns: clampInteger(value.consecutiveWorkRuns, 0, 1),
    injuredUntilGameHour,
  };
}

function sanitizeMembers(value, options = {}) {
  if (!Array.isArray(value)) return [];
  const allowMythicIds = options.allowMythicIds instanceof Set ? options.allowMythicIds : new Set();
  const members = value
    .map((entry, index) => sanitizeMember(entry, index, allowMythicIds))
    .filter(Boolean);
  const seen = new Set();
  return members.filter((member) => {
    if (seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  }).slice(0, 34);
}

function getProtectedMythics(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((member) => member && typeof member === 'object' && member.rarity === 'MYTHIC' && member.source === 'ADMIN_EVENT')
    .map((member, index) => sanitizeMember(member, index, new Set([String(member.id || '')])))
    .filter(Boolean);
}

function mergeProtectedMythics(incoming, protectedMembers) {
  const protectedIds = new Set(protectedMembers.map((member) => member.id));
  const withoutDuplicates = incoming.filter((member) => !protectedIds.has(member.id));
  return [...protectedMembers, ...withoutDuplicates].slice(0, 34);
}

function randomEntry(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function createAdminEventMember(customName = '') {
  const firstName = sanitizeText(customName, 24, randomEntry(FIRST_NAMES));
  const nickname = randomEntry(NICKNAMES);
  const lastName = randomEntry(LAST_NAMES);
  const skills = {};
  SKILLS.forEach((skill) => {
    skills[skill] = clampInteger(82 + Math.floor(Math.random() * 19), 82, 100);
  });
  const strongest = [...SKILLS].sort((left, right) => skills[right] - skills[left]);
  const bonuses = strongest.slice(0, 3).map((skill, index) => ({
    id: `event_${skill}_${crypto.randomBytes(5).toString('hex')}`,
    label: BONUS_LABELS[skill][0],
    description: BONUS_LABELS[skill][1],
    skill,
    value: index === 0 ? 10 : 7,
  }));
  return {
    id: `event_${crypto.randomUUID()}`,
    firstName,
    nickname,
    lastName,
    displayName: `${firstName} "${nickname}" ${lastName}`,
    rarity: 'MYTHIC',
    source: 'ADMIN_EVENT',
    level: 10,
    xp: 0,
    loyalty: 100,
    skills,
    bonuses,
    joinedAt: Date.now(),
    status: 'AVAILABLE',
    avatarSeed: Math.floor(Math.random() * 12),
    lastWorkType: null,
    consecutiveWorkRuns: 0,
    injuredUntilGameHour: 0,
  };
}

module.exports = {
  SKILLS,
  createAdminEventMember,
  getProtectedMythics,
  mergeProtectedMythics,
  sanitizeMember,
  sanitizeMembers,
};
