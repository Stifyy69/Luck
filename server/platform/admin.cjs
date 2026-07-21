const {
  ADMIN_EDITABLE_FIELDS,
  ADMIN_GRANTABLE_ITEMS,
} = require('./constants.cjs');
const {
  clampInteger,
  ensureCityProgress,
  ensureEditableTableRow,
  ensurePlayer,
  ensureSchema,
  pool,
  safeNumber,
  withTransaction,
} = require('./db.cjs');
const { getGangState } = require('./gangs.cjs');
const { loadGangDataset, loadPlayerDataset, sortRows } = require('./rankings.cjs');
const { activateVip, getVipStatus, revokeVip } = require('./vip.cjs');

async function logAdminAction(adminName, playerId, actionType, actionPayload = {}) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO admin_action_log (admin_name, player_id, action_type, action_payload) VALUES ($1, $2, $3, $4::jsonb)`,
    [adminName, playerId || null, actionType, JSON.stringify(actionPayload || {})],
  );
}

async function getAdminAudit(limit = 100) {
  await ensureSchema();
  const safeLimit = clampInteger(limit, 1, 300);
  const result = await pool.query(
    `SELECT id, admin_name, player_id, action_type, action_payload, created_at FROM admin_action_log ORDER BY created_at DESC LIMIT $1`,
    [safeLimit],
  );
  return result.rows.map((row) => ({
    id: Number(row.id),
    adminName: row.admin_name,
    playerId: row.player_id,
    actionType: row.action_type,
    actionPayload: row.action_payload || {},
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function getAdminOverview() {
  const rows = await loadPlayerDataset();
  const gangs = await loadGangDataset();
  const now = Date.now();
  const levelMap = new Map();
  for (const row of rows) levelMap.set(row.cityLevel, (levelMap.get(row.cityLevel) || 0) + 1);
  const levelDistribution = [...levelMap.entries()].sort((a, b) => a[0] - b[0]).map(([level, count]) => ({ level, count }));
  return {
    summary: {
      totalPlayers: rows.length,
      totalAccounts: rows.filter((row) => row.accountId !== null).length,
      onlineNow: rows.filter((row) => row.lastSeenMs > now - 90 * 1000).length,
      activeRecent: rows.filter((row) => row.lastSeenMs > now - 15 * 60 * 1000).length,
      activeVip: rows.filter((row) => row.vipActive).length,
      totalGangs: gangs.length,
      totalCleanMoney: rows.reduce((sum, row) => sum + row.cleanMoney, 0),
      totalCityXp: rows.reduce((sum, row) => sum + row.cityXp, 0),
      totalFleetValue: rows.reduce((sum, row) => sum + row.fleetValue, 0),
      totalEarnings: rows.reduce((sum, row) => sum + row.totalEarnings, 0),
    },
    levelDistribution,
    topPlayers: sortRows(rows.filter((row) => row.accountId !== null), 'cityXp', 'desc').slice(0, 5),
    recentActions: await getAdminAudit(12),
  };
}

function parseAdminFilters(input = {}) {
  return {
    search: String(input.search || '').trim().toLowerCase(),
    accountOnly: String(input.accountOnly || '') === 'true',
    onlineOnly: String(input.onlineOnly || '') === 'true',
    vipOnly: String(input.vipOnly || '') === 'true',
    gangOnly: String(input.gangOnly || '') === 'true',
    minLevel: input.minLevel === undefined || input.minLevel === '' ? null : safeNumber(input.minLevel),
    maxLevel: input.maxLevel === undefined || input.maxLevel === '' ? null : safeNumber(input.maxLevel),
    minCityXp: input.minCityXp === undefined || input.minCityXp === '' ? null : safeNumber(input.minCityXp),
    maxCityXp: input.maxCityXp === undefined || input.maxCityXp === '' ? null : safeNumber(input.maxCityXp),
    minMoney: input.minMoney === undefined || input.minMoney === '' ? null : safeNumber(input.minMoney),
    maxMoney: input.maxMoney === undefined || input.maxMoney === '' ? null : safeNumber(input.maxMoney),
    minNetWorth: input.minNetWorth === undefined || input.minNetWorth === '' ? null : safeNumber(input.minNetWorth),
    maxNetWorth: input.maxNetWorth === undefined || input.maxNetWorth === '' ? null : safeNumber(input.maxNetWorth),
    minEarnings: input.minEarnings === undefined || input.minEarnings === '' ? null : safeNumber(input.minEarnings),
    maxEarnings: input.maxEarnings === undefined || input.maxEarnings === '' ? null : safeNumber(input.maxEarnings),
    minCareer: input.minCareer === undefined || input.minCareer === '' ? null : safeNumber(input.minCareer),
    maxCareer: input.maxCareer === undefined || input.maxCareer === '' ? null : safeNumber(input.maxCareer),
    minTime: input.minTime === undefined || input.minTime === '' ? null : safeNumber(input.minTime),
    maxTime: input.maxTime === undefined || input.maxTime === '' ? null : safeNumber(input.maxTime),
    sortBy: String(input.sortBy || 'lastSeenMs'),
    sortDir: String(input.sortDir || 'desc') === 'asc' ? 'asc' : 'desc',
    page: clampInteger(input.page || 1, 1, 100000),
    pageSize: clampInteger(input.pageSize || 25, 10, 100),
  };
}

async function getAdminPlayers(query = {}) {
  const filters = parseAdminFilters(query);
  const allowedSortFields = new Set([
    'displayName', 'cityLevel', 'cityXp', 'cleanMoney', 'netWorth', 'totalEarnings',
    'careerScore', 'totalTimeHours', 'lastSeenMs', 'vehicleCount', 'inventoryUnits',
  ]);
  if (!allowedSortFields.has(filters.sortBy)) filters.sortBy = 'lastSeenMs';

  let rows = await loadPlayerDataset();
  const now = Date.now();
  if (filters.search) {
    rows = rows.filter((row) => [row.playerId, row.displayName, row.username, row.email]
      .some((value) => String(value || '').toLowerCase().includes(filters.search)));
  }
  if (filters.accountOnly) rows = rows.filter((row) => row.accountId !== null);
  if (filters.onlineOnly) rows = rows.filter((row) => row.lastSeenMs > now - 90 * 1000);
  if (filters.vipOnly) rows = rows.filter((row) => row.vipActive);
  if (filters.gangOnly) rows = rows.filter((row) => row.hasGang);
  if (filters.minLevel !== null) rows = rows.filter((row) => row.cityLevel >= filters.minLevel);
  if (filters.maxLevel !== null) rows = rows.filter((row) => row.cityLevel <= filters.maxLevel);
  if (filters.minCityXp !== null) rows = rows.filter((row) => row.cityXp >= filters.minCityXp);
  if (filters.maxCityXp !== null) rows = rows.filter((row) => row.cityXp <= filters.maxCityXp);
  if (filters.minMoney !== null) rows = rows.filter((row) => row.cleanMoney >= filters.minMoney);
  if (filters.maxMoney !== null) rows = rows.filter((row) => row.cleanMoney <= filters.maxMoney);
  if (filters.minNetWorth !== null) rows = rows.filter((row) => row.netWorth >= filters.minNetWorth);
  if (filters.maxNetWorth !== null) rows = rows.filter((row) => row.netWorth <= filters.maxNetWorth);
  if (filters.minEarnings !== null) rows = rows.filter((row) => row.totalEarnings >= filters.minEarnings);
  if (filters.maxEarnings !== null) rows = rows.filter((row) => row.totalEarnings <= filters.maxEarnings);
  if (filters.minCareer !== null) rows = rows.filter((row) => row.careerScore >= filters.minCareer);
  if (filters.maxCareer !== null) rows = rows.filter((row) => row.careerScore <= filters.maxCareer);
  if (filters.minTime !== null) rows = rows.filter((row) => row.totalTimeHours >= filters.minTime);
  if (filters.maxTime !== null) rows = rows.filter((row) => row.totalTimeHours <= filters.maxTime);

  rows = sortRows(rows, filters.sortBy, filters.sortDir);
  const total = rows.length;
  const start = (filters.page - 1) * filters.pageSize;
  return {
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pages: Math.max(1, Math.ceil(total / filters.pageSize)),
    players: rows.slice(start, start + filters.pageSize),
  };
}

async function getAdminPlayerDetail(playerId) {
  const rows = await loadPlayerDataset();
  const player = rows.find((row) => row.playerId === playerId);
  if (!player) return null;
  const [boosts, inventory, vehicles, gang] = await Promise.all([
    pool.query(`SELECT id, boost_type, created_at, expires_at FROM active_boosts WHERE player_id = $1 ORDER BY created_at DESC LIMIT 30`, [playerId]),
    pool.query(`SELECT id, item_type, quantity, metadata, created_at FROM inventory_items WHERE player_id = $1 ORDER BY created_at DESC LIMIT 100`, [playerId]),
    pool.query(`SELECT ov.id, vm.brand, vm.name, ov.purchase_price, ov.purchase_source, ov.purchased_at FROM owned_vehicles ov JOIN vehicle_models vm ON vm.id = ov.model_id WHERE ov.player_id = $1 ORDER BY ov.purchased_at DESC`, [playerId]),
    getGangState(playerId),
  ]);
  return {
    player,
    vip: await getVipStatus(playerId),
    boosts: boosts.rows.map((row) => ({
      id: Number(row.id),
      boostType: row.boost_type,
      createdAt: new Date(row.created_at).toISOString(),
      expiresAt: new Date(row.expires_at).toISOString(),
    })),
    inventory: inventory.rows.map((row) => ({
      id: Number(row.id),
      itemType: row.item_type,
      quantity: Number(row.quantity),
      metadata: row.metadata || {},
      createdAt: new Date(row.created_at).toISOString(),
    })),
    vehicles: vehicles.rows.map((row) => ({
      id: Number(row.id),
      brand: row.brand,
      name: row.name,
      purchasePrice: Number(row.purchase_price),
      purchaseSource: row.purchase_source,
      purchasedAt: new Date(row.purchased_at).toISOString(),
    })),
    gang,
  };
}

async function updateAdminNumericField(adminName, playerId, field, mode, value) {
  await ensureSchema();
  const config = ADMIN_EDITABLE_FIELDS[field];
  if (!config) throw new Error('field is not editable');
  const parsedValue = Number(value);
  if (!Number.isFinite(parsedValue)) throw new Error('invalid value');
  const rawValue = Math.floor(parsedValue);
  const operation = mode === 'add' ? 'add' : 'set';
  const minimum = Number(config.min ?? 0);
  const maximum = Number(config.max ?? Number.MAX_SAFE_INTEGER);
  const safeValue = operation === 'add'
    ? Math.max(-maximum, Math.min(maximum, rawValue))
    : Math.max(minimum, Math.min(maximum, rawValue));

  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await ensureEditableTableRow(db, config.table, playerId);
    if (operation === 'add') {
      await db.query(
        `UPDATE ${config.table} SET ${config.column} = LEAST($4, GREATEST($3, ${config.column} + $2)), updated_at = NOW() WHERE player_id = $1`,
        [playerId, safeValue, minimum, maximum],
      );
    } else {
      await db.query(
        `UPDATE ${config.table} SET ${config.column} = LEAST($4, GREATEST($3, $2)), updated_at = NOW() WHERE player_id = $1`,
        [playerId, safeValue, minimum, maximum],
      );
    }
  });

  await logAdminAction(adminName, playerId, 'numeric_update', { field, mode: operation, value: safeValue });
  return getAdminPlayerDetail(playerId);
}

async function updateAdminDisplayName(adminName, playerId, displayName) {
  await ensureSchema();
  const nextName = String(displayName || '').trim().slice(0, 32);
  if (!nextName) throw new Error('display name required');
  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await db.query(`UPDATE players SET display_name = $2, updated_at = NOW() WHERE player_id = $1`, [playerId, nextName]);
  });
  await logAdminAction(adminName, playerId, 'display_name_update', { displayName: nextName });
  return getAdminPlayerDetail(playerId);
}

async function grantAdminItem(adminName, playerId, itemType, quantity) {
  await ensureSchema();
  const normalizedType = String(itemType || '').toUpperCase();
  if (!ADMIN_GRANTABLE_ITEMS.includes(normalizedType)) throw new Error('item cannot be granted');
  const safeQuantity = clampInteger(quantity || 1, 1, 100);
  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await db.query(
      `INSERT INTO inventory_items (player_id, item_type, metadata, quantity) VALUES ($1, $2, '{}'::jsonb, $3)`,
      [playerId, normalizedType, safeQuantity],
    );
  });
  await logAdminAction(adminName, playerId, 'item_grant', { itemType: normalizedType, quantity: safeQuantity });
  return getAdminPlayerDetail(playerId);
}

async function setAdminVip(adminName, playerId, tier) {
  let status;
  if (!tier || tier === 'NONE') status = await revokeVip(playerId);
  else status = await activateVip(playerId, tier);
  await logAdminAction(adminName, playerId, 'vip_update', { tier: tier || 'NONE', status });
  return getAdminPlayerDetail(playerId);
}

async function resetAdminTutorial(adminName, playerId) {
  await ensureSchema();
  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await ensureCityProgress(db, playerId);
    await db.query(
      `UPDATE player_city_progress SET tutorial_step = 0, tutorial_completed_at = NULL, tutorial_skipped_at = NULL, updated_at = NOW() WHERE player_id = $1`,
      [playerId],
    );
  });
  await logAdminAction(adminName, playerId, 'tutorial_reset', {});
  return getAdminPlayerDetail(playerId);
}

module.exports = {
  getAdminAudit,
  getAdminOverview,
  getAdminPlayerDetail,
  getAdminPlayers,
  grantAdminItem,
  logAdminAction,
  parseAdminFilters,
  resetAdminTutorial,
  setAdminVip,
  updateAdminDisplayName,
  updateAdminNumericField,
};
