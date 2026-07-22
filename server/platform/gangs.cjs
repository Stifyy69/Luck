const { cityLevelFromXp } = require('../cityProgress/constants.cjs');
const { GANG_LEVEL_LABELS } = require('./constants.cjs');
const {
  createAdminEventMember,
  getProtectedMythics,
  mergeProtectedMythics,
  sanitizeMembers,
} = require('./gangMembers.cjs');
const {
  clampInteger,
  ensurePlayer,
  ensureSchema,
  pool,
  safeNumber,
  withTransaction,
} = require('./db.cjs');

const GANG_UPGRADE_COSTS = Object.freeze([
  { from: 0, to: 1, dirtyCash: 300_000_000, leaves: 10_000, white: 10_000, blue: 10_000 },
  { from: 1, to: 2, dirtyCash: 1_000_000_000, leaves: 50_000, white: 50_000, blue: 50_000 },
  { from: 2, to: 3, dirtyCash: 10_000_000_000, leaves: 200_000, white: 200_000, blue: 200_000 },
]);

function calculateGangLevelIndex(dirtyEarned) {
  if (dirtyEarned >= 10_000_000_000) return 3;
  if (dirtyEarned >= 1_000_000_000) return 2;
  if (dirtyEarned >= 300_000_000) return 1;
  return 0;
}

function sanitizeText(value, maxLength, fallback = '') {
  return String(value || fallback).trim().slice(0, maxLength);
}

function sanitizeActivityLog(value) {
  if (!Array.isArray(value)) return [];
  const allowedTones = new Set(['positive', 'negative', 'warning', 'neutral']);
  return value.slice(0, 50).map((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry : {};
    const message = sanitizeText(raw.message, 220);
    if (!message) return null;
    return {
      id: sanitizeText(raw.id, 100, `server_log_${index}`),
      message,
      tone: allowedTones.has(String(raw.tone)) ? String(raw.tone) : 'neutral',
      createdAt: clampInteger(raw.createdAt || Date.now(), 0, Number.MAX_SAFE_INTEGER),
    };
  }).filter(Boolean);
}

function sanitizeBattleInjuries(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).map((injury) => ({
    memberId: sanitizeText(injury?.memberId, 100),
    memberName: sanitizeText(injury?.memberName, 80, 'Member'),
    recoveryHours: clampInteger(injury?.recoveryHours, 1, 3),
  })).filter((injury) => injury.memberId);
}

function sanitizeBattleHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map((entry, index) => {
    const raw = entry && typeof entry === 'object' ? entry : {};
    return {
      id: sanitizeText(raw.id, 100, `server_battle_${index}`),
      opponentId: sanitizeText(raw.opponentId, 100),
      opponentName: sanitizeText(raw.opponentName, 80, 'Unknown gang'),
      won: Boolean(raw.won),
      score: sanitizeText(raw.score, 10, '0-0'),
      memberIds: Array.isArray(raw.memberIds) ? raw.memberIds.map((id) => sanitizeText(id, 100)).filter(Boolean).slice(0, 5) : [],
      leaderId: sanitizeText(raw.leaderId, 100),
      injuries: sanitizeBattleInjuries(raw.injuries),
      dirtyReward: clampInteger(raw.dirtyReward, 0, Number.MAX_SAFE_INTEGER),
      reputationReward: clampInteger(raw.reputationReward, 0, 1_000_000),
      gunpowderReward: clampInteger(raw.gunpowderReward, 0, 1_000_000),
      steelReward: clampInteger(raw.steelReward, 0, 1_000_000),
      completedAt: clampInteger(raw.completedAt || Date.now(), 0, Number.MAX_SAFE_INTEGER),
    };
  });
}

function sanitizeGangMeta(value) {
  const raw = value && typeof value === 'object' ? value : {};
  return {
    dismissalPressure: clampInteger(raw.dismissalPressure, 0, 5),
    lastDismissalAt: clampInteger(raw.lastDismissalAt, 0, Number.MAX_SAFE_INTEGER),
    activityLog: sanitizeActivityLog(raw.activityLog),
    battleHistory: sanitizeBattleHistory(raw.battleHistory),
    battleReputation: clampInteger(raw.battleReputation, 0, Number.MAX_SAFE_INTEGER),
    defensiveCrewIds: Array.isArray(raw.defensiveCrewIds)
      ? raw.defensiveCrewIds.map((id) => sanitizeText(id, 100)).filter(Boolean).slice(0, 5)
      : [],
    battleBoardSeed: clampInteger(raw.battleBoardSeed || 1, 1, Number.MAX_SAFE_INTEGER),
  };
}

function stockValueFor(values) {
  return Math.floor(
    values.leaves * 100
    + values.whitePacks * 900
    + values.bluePacks * 2300
    + values.sulfur * 1000
    + values.ironOre * 1200
    + values.gunpowder * 5000
    + values.steel * 6000,
  );
}

async function assertGangAccess(playerId) {
  const accessResult = await pool.query(
    `SELECT u.id AS account_id, COALESCE(cp.city_xp, 0) AS city_xp FROM players p LEFT JOIN users u ON u.player_id = p.player_id LEFT JOIN player_city_progress cp ON cp.player_id = p.player_id WHERE p.player_id = $1`,
    [playerId],
  );
  const access = accessResult.rows[0];
  if (!access?.account_id) throw new Error('account required for gang rankings');
  if (cityLevelFromXp(safeNumber(access.city_xp)) < 15) throw new Error('City Level 15 required');
}

async function syncGang(playerId, gangData) {
  await ensureSchema();
  const name = String(gangData?.name || '').trim().slice(0, 48);
  const existingResult = await pool.query(`SELECT members, gang_level_index, updated_at FROM player_gangs WHERE player_id = $1`, [playerId]);
  const existing = existingResult.rows[0] || null;
  const incomingUpdatedAt = gangData?.serverUpdatedAt ? new Date(String(gangData.serverUpdatedAt)) : null;
  if (existing?.updated_at && incomingUpdatedAt && Number.isFinite(incomingUpdatedAt.getTime())) {
    const storedUpdatedAt = new Date(existing.updated_at);
    if (storedUpdatedAt.getTime() > incomingUpdatedAt.getTime() + 5) return getGangState(playerId);
  }
  const removedEventMemberIds = new Set(
    Array.isArray(gangData?.removedEventMemberIds)
      ? gangData.removedEventMemberIds.map((value) => String(value).slice(0, 100)).slice(0, 100)
      : [],
  );
  const protectedMythics = getProtectedMythics(existing?.members)
    .filter((member) => !removedEventMemberIds.has(member.id));
  const protectedIds = new Set(protectedMythics.map((member) => member.id));
  const incomingMembers = sanitizeMembers(gangData?.members, { allowMythicIds: protectedIds });
  const members = mergeProtectedMythics(incomingMembers, protectedMythics);

  const leaves = clampInteger(gangData?.frunze ?? gangData?.leaves, 0, 10_000_000_000);
  const whitePacks = clampInteger(gangData?.white ?? gangData?.whitePacks, 0, 10_000_000_000);
  const bluePacks = clampInteger(gangData?.blue ?? gangData?.bluePacks, 0, 10_000_000_000);
  const sulfur = clampInteger(gangData?.sulfur, 0, 10_000_000_000);
  const ironOre = clampInteger(gangData?.ironOre, 0, 10_000_000_000);
  const gunpowder = clampInteger(gangData?.gunpowder, 0, 10_000_000_000);
  const steel = clampInteger(gangData?.steel, 0, 10_000_000_000);
  const cleanBalance = clampInteger(gangData?.cleanBalance, 0, Number.MAX_SAFE_INTEGER);
  const dirtyBalance = clampInteger(gangData?.dirtyBalance, 0, Number.MAX_SAFE_INTEGER);
  const dirtyEarned = clampInteger(gangData?.dirtyEarned, 0, Number.MAX_SAFE_INTEGER);
  const lastLeaveAt = clampInteger(gangData?.lastLeaveAt || Date.now(), 0, Number.MAX_SAFE_INTEGER);
  const activeWorkers = clampInteger(gangData?.onlineNow, 0, members.length);
  const gangLevelIndex = existing
    ? clampInteger(existing.gang_level_index, 0, 3)
    : calculateGangLevelIndex(dirtyEarned);
  const gangMeta = sanitizeGangMeta({
    dismissalPressure: gangData?.dismissalPressure,
    lastDismissalAt: gangData?.lastDismissalAt,
    activityLog: gangData?.activityLog,
    battleHistory: gangData?.battleHistory,
    battleReputation: gangData?.battleReputation,
    defensiveCrewIds: gangData?.defensiveCrewIds,
    battleBoardSeed: gangData?.battleBoardSeed,
  });
  const memberIds = new Set(members.map((member) => member.id));
  gangMeta.defensiveCrewIds = gangMeta.defensiveCrewIds.filter((id) => memberIds.has(id));
  const stockValue = stockValueFor({ leaves, whitePacks, bluePacks, sulfur, ironOre, gunpowder, steel });

  if (name) await assertGangAccess(playerId);

  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await db.query(
      `
        INSERT INTO player_gangs (
          player_id, gang_name, gang_level_index, members, members_count, active_workers,
          leaves, white_packs, blue_packs, sulfur, iron_ore, gunpowder, steel,
          clean_balance, dirty_balance, dirty_earned, stock_value, gang_meta, last_leave_at, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19, NOW())
        ON CONFLICT (player_id) DO UPDATE SET
          gang_name = EXCLUDED.gang_name,
          members = EXCLUDED.members,
          members_count = EXCLUDED.members_count,
          active_workers = EXCLUDED.active_workers,
          leaves = EXCLUDED.leaves,
          white_packs = EXCLUDED.white_packs,
          blue_packs = EXCLUDED.blue_packs,
          sulfur = EXCLUDED.sulfur,
          iron_ore = EXCLUDED.iron_ore,
          gunpowder = EXCLUDED.gunpowder,
          steel = EXCLUDED.steel,
          clean_balance = EXCLUDED.clean_balance,
          dirty_balance = EXCLUDED.dirty_balance,
          dirty_earned = EXCLUDED.dirty_earned,
          stock_value = EXCLUDED.stock_value,
          gang_meta = EXCLUDED.gang_meta,
          last_leave_at = EXCLUDED.last_leave_at,
          updated_at = NOW()
      `,
      [
        playerId, name, gangLevelIndex, JSON.stringify(members), members.length, activeWorkers,
        leaves, whitePacks, bluePacks, sulfur, ironOre, gunpowder, steel,
        cleanBalance, dirtyBalance, dirtyEarned, stockValue, JSON.stringify(gangMeta), lastLeaveAt,
      ],
    );
  });

  return getGangState(playerId);
}

async function upgradeGang(playerId) {
  await ensureSchema();
  await assertGangAccess(playerId);
  await withTransaction(async (db) => {
    const result = await db.query(`SELECT * FROM player_gangs WHERE player_id = $1 FOR UPDATE`, [playerId]);
    const row = result.rows[0];
    if (!row?.gang_name) throw new Error('player does not have a synchronized gang');
    const currentLevel = clampInteger(row.gang_level_index, 0, 3);
    const cost = GANG_UPGRADE_COSTS.find((entry) => entry.from === currentLevel);
    if (!cost) throw new Error('maximum gang level reached');

    const dirtyBalance = Number(row.dirty_balance || 0);
    const leaves = Number(row.leaves || 0);
    const whitePacks = Number(row.white_packs || 0);
    const bluePacks = Number(row.blue_packs || 0);
    if (dirtyBalance < cost.dirtyCash || leaves < cost.leaves || whitePacks < cost.white || bluePacks < cost.blue) {
      throw new Error('gang upgrade requirements not met');
    }

    const nextValues = {
      leaves: leaves - cost.leaves,
      whitePacks: whitePacks - cost.white,
      bluePacks: bluePacks - cost.blue,
      sulfur: Number(row.sulfur || 0),
      ironOre: Number(row.iron_ore || 0),
      gunpowder: Number(row.gunpowder || 0),
      steel: Number(row.steel || 0),
    };
    const meta = sanitizeGangMeta(row.gang_meta);
    meta.activityLog = [{
      id: `upgrade_${Date.now()}`,
      message: `Gang upgraded to ${GANG_LEVEL_LABELS[cost.to] || `Level ${cost.to}`}.`,
      tone: 'positive',
      createdAt: Date.now(),
    }, ...meta.activityLog].slice(0, 50);

    await db.query(
      `UPDATE player_gangs SET gang_level_index = $2, dirty_balance = $3, leaves = $4, white_packs = $5, blue_packs = $6, stock_value = $7, gang_meta = $8::jsonb, updated_at = NOW() WHERE player_id = $1`,
      [
        playerId,
        cost.to,
        dirtyBalance - cost.dirtyCash,
        nextValues.leaves,
        nextValues.whitePacks,
        nextValues.bluePacks,
        stockValueFor(nextValues),
        JSON.stringify(meta),
      ],
    );
  });
  return getGangState(playerId);
}

async function grantMythicGangMember(playerId, customName = '') {
  await ensureSchema();
  const member = createAdminEventMember(customName);
  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    const result = await db.query(`SELECT gang_name, members FROM player_gangs WHERE player_id = $1 FOR UPDATE`, [playerId]);
    const row = result.rows[0];
    if (!row?.gang_name) throw new Error('player does not have a synchronized gang');
    const existing = sanitizeMembers(row.members, {
      allowMythicIds: new Set(getProtectedMythics(row.members).map((entry) => entry.id)),
    });
    if (existing.length >= 34) throw new Error('gang member limit reached');
    const members = [member, ...existing];
    await db.query(
      `UPDATE player_gangs SET members = $2::jsonb, members_count = $3, updated_at = NOW() WHERE player_id = $1`,
      [playerId, JSON.stringify(members), members.length],
    );
  });
  return { member, gang: await getGangState(playerId) };
}

async function getGangState(playerId) {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM player_gangs WHERE player_id = $1`, [playerId]);
  const row = result.rows[0];
  if (!row) return null;
  const protectedMythics = getProtectedMythics(row.members);
  const members = sanitizeMembers(row.members, {
    allowMythicIds: new Set(protectedMythics.map((member) => member.id)),
  });
  const meta = sanitizeGangMeta(row.gang_meta);
  return {
    playerId: row.player_id,
    name: row.gang_name,
    gangLevelIndex: Number(row.gang_level_index || 0),
    gangLevel: GANG_LEVEL_LABELS[Number(row.gang_level_index || 0)] || GANG_LEVEL_LABELS[0],
    members,
    membersCount: members.length,
    activeWorkers: Number(row.active_workers || 0),
    leaves: Number(row.leaves || 0),
    whitePacks: Number(row.white_packs || 0),
    bluePacks: Number(row.blue_packs || 0),
    sulfur: Number(row.sulfur || 0),
    ironOre: Number(row.iron_ore || 0),
    gunpowder: Number(row.gunpowder || 0),
    steel: Number(row.steel || 0),
    cleanBalance: Number(row.clean_balance || 0),
    dirtyBalance: Number(row.dirty_balance || 0),
    dirtyEarned: Number(row.dirty_earned || 0),
    stockValue: Number(row.stock_value || 0),
    dismissalPressure: meta.dismissalPressure,
    lastDismissalAt: meta.lastDismissalAt,
    activityLog: meta.activityLog,
    battleHistory: meta.battleHistory,
    battleReputation: meta.battleReputation,
    defensiveCrewIds: meta.defensiveCrewIds,
    battleBoardSeed: meta.battleBoardSeed,
    lastLeaveAt: Number(row.last_leave_at || 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

module.exports = {
  GANG_UPGRADE_COSTS,
  calculateGangLevelIndex,
  getGangState,
  grantMythicGangMember,
  sanitizeGangMeta,
  sanitizeMembers,
  syncGang,
  upgradeGang,
};
