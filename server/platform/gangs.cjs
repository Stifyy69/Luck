const { cityLevelFromXp } = require('../cityProgress/constants.cjs');
const { GANG_LEVEL_LABELS } = require('./constants.cjs');
const {
  clampInteger,
  ensurePlayer,
  ensureSchema,
  pool,
  safeNumber,
  withTransaction,
} = require('./db.cjs');

function sanitizeMembers(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().slice(0, 32))
    .filter(Boolean)
    .slice(0, 34);
}

function calculateGangLevelIndex(dirtyEarned) {
  if (dirtyEarned >= 10_000_000_000) return 3;
  if (dirtyEarned >= 1_000_000_000) return 2;
  if (dirtyEarned >= 300_000_000) return 1;
  return 0;
}

async function syncGang(playerId, gangData) {
  await ensureSchema();
  const name = String(gangData?.name || '').trim().slice(0, 48);
  const members = sanitizeMembers(gangData?.members);
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
    const vehicleResult = await db.query(`SELECT COUNT(*)::INT AS count FROM owned_vehicles WHERE player_id = $1`, [playerId]);
    const activeWorkers = Math.min(members.length, Number(vehicleResult.rows[0]?.count || 0));
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

async function getGangState(playerId) {
  await ensureSchema();
  const result = await pool.query(`SELECT * FROM player_gangs WHERE player_id = $1`, [playerId]);
  const row = result.rows[0];
  if (!row) return null;
  return {
    playerId: row.player_id,
    name: row.gang_name,
    gangLevelIndex: Number(row.gang_level_index || 0),
    gangLevel: GANG_LEVEL_LABELS[Number(row.gang_level_index || 0)] || GANG_LEVEL_LABELS[0],
    members: Array.isArray(row.members) ? row.members : [],
    membersCount: Number(row.members_count || 0),
    activeWorkers: Number(row.active_workers || 0),
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
  sanitizeMembers,
  syncGang,
};
