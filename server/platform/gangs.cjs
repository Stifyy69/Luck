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

function calculateGangLevelIndex(dirtyEarned) {
  if (dirtyEarned >= 10_000_000_000) return 3;
  if (dirtyEarned >= 1_000_000_000) return 2;
  if (dirtyEarned >= 300_000_000) return 1;
  return 0;
}

async function syncGang(playerId, gangData) {
  await ensureSchema();
  const name = String(gangData?.name || '').trim().slice(0, 48);
  const existingResult = await pool.query(`SELECT members FROM player_gangs WHERE player_id = $1`, [playerId]);
  const removedEventMemberIds = new Set(
    Array.isArray(gangData?.removedEventMemberIds)
      ? gangData.removedEventMemberIds.map((value) => String(value).slice(0, 100)).slice(0, 100)
      : [],
  );
  const protectedMythics = getProtectedMythics(existingResult.rows[0]?.members)
    .filter((member) => !removedEventMemberIds.has(member.id));
  const protectedIds = new Set(protectedMythics.map((member) => member.id));
  const incomingMembers = sanitizeMembers(gangData?.members, { allowMythicIds: protectedIds });
  const members = mergeProtectedMythics(incomingMembers, protectedMythics);
  const leaves = clampInteger(gangData?.frunze, 0, 10_000_000_000);
  const whitePacks = clampInteger(gangData?.white, 0, 10_000_000_000);
  const bluePacks = clampInteger(gangData?.blue, 0, 10_000_000_000);
  const dirtyEarned = clampInteger(gangData?.dirtyEarned, 0, Number.MAX_SAFE_INTEGER);
  const lastLeaveAt = clampInteger(gangData?.lastLeaveAt || Date.now(), 0, Number.MAX_SAFE_INTEGER);
  const gangLevelIndex = calculateGangLevelIndex(dirtyEarned);
  const stockValue = Math.floor(leaves * 100 + whitePacks * 900 + bluePacks * 2300);

  if (name) {
    const accessResult = await pool.query(
      `SELECT u.id AS account_id, COALESCE(cp.city_xp, 0) AS city_xp FROM players p LEFT JOIN users u ON u.player_id = p.player_id LEFT JOIN player_city_progress cp ON cp.player_id = p.player_id WHERE p.player_id = $1`,
      [playerId],
    );
    const access = accessResult.rows[0];
    if (!access?.account_id) throw new Error('account required for gang rankings');
    if (cityLevelFromXp(safeNumber(access.city_xp)) < 15) throw new Error('City Level 15 required');
  }

  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    const activeWorkers = members.length;
    await db.query(
      `
        INSERT INTO player_gangs (
          player_id, gang_name, gang_level_index, members, members_count, active_workers,
          leaves, white_packs, blue_packs, dirty_earned, stock_value, last_leave_at, updated_at
        )
        VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
        ON CONFLICT (player_id) DO UPDATE SET
          gang_name = EXCLUDED.gang_name,
          gang_level_index = EXCLUDED.gang_level_index,
          members = EXCLUDED.members,
          members_count = EXCLUDED.members_count,
          active_workers = EXCLUDED.active_workers,
          leaves = EXCLUDED.leaves,
          white_packs = EXCLUDED.white_packs,
          blue_packs = EXCLUDED.blue_packs,
          dirty_earned = EXCLUDED.dirty_earned,
          stock_value = EXCLUDED.stock_value,
          last_leave_at = EXCLUDED.last_leave_at,
          updated_at = NOW()
      `,
      [playerId, name, gangLevelIndex, JSON.stringify(members), members.length, activeWorkers, leaves, whitePacks, bluePacks, dirtyEarned, stockValue, lastLeaveAt],
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
      `UPDATE player_gangs SET members = $2::jsonb, members_count = $3, active_workers = $3, updated_at = NOW() WHERE player_id = $1`,
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
  return {
    playerId: row.player_id,
    name: row.gang_name,
    gangLevelIndex: Number(row.gang_level_index || 0),
    gangLevel: GANG_LEVEL_LABELS[Number(row.gang_level_index || 0)] || GANG_LEVEL_LABELS[0],
    members,
    membersCount: members.length,
    activeWorkers: members.length,
    leaves: Number(row.leaves || 0),
    whitePacks: Number(row.white_packs || 0),
    bluePacks: Number(row.blue_packs || 0),
    dirtyEarned: Number(row.dirty_earned || 0),
    stockValue: Number(row.stock_value || 0),
    lastLeaveAt: Number(row.last_leave_at || 0),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

module.exports = {
  calculateGangLevelIndex,
  getGangState,
  grantMythicGangMember,
  sanitizeMembers,
  syncGang,
};
