const { cityLevelFromXp } = require('../cityProgress/constants.cjs');
const {
  GANG_LEADERBOARD_METRICS,
  GANG_LEVEL_LABELS,
  PLAYER_LEADERBOARD_METRICS,
} = require('./constants.cjs');
const { ensureSchema, pool, safeNumber } = require('./db.cjs');
const { getVipStatus } = require('./vip.cjs');

async function loadPlayerDataset() {
  await ensureSchema();
  const result = await pool.query(`
    WITH vehicle_totals AS (
      SELECT player_id, COUNT(*)::INT AS vehicle_count, COALESCE(SUM(purchase_price), 0) AS fleet_value
      FROM owned_vehicles
      GROUP BY player_id
    ), inventory_totals AS (
      SELECT player_id, COALESCE(SUM(quantity), 0)::INT AS inventory_units
      FROM inventory_items
      GROUP BY player_id
    )
    SELECT
      p.player_id,
      p.display_name,
      p.clean_money,
      p.flow_coins,
      p.roulette_fragments,
      p.vehicle_slots_base,
      p.vehicle_slots_extra,
      u.id AS account_id,
      u.username,
      u.email,
      COALESCE(cp.city_xp, 0) AS city_xp,
      COALESCE(ps.roulette_spent, 0) AS roulette_spent,
      COALESCE(ps.roulette_won, 0) AS roulette_won,
      COALESCE(ps.total_net, 0) AS total_net,
      COALESCE(ps.time_spent, 0) AS time_spent,
      COALESCE(ps.farm_earned, 0) AS farm_earned,
      COALESCE(ps.time_pilot, 0) AS time_pilot,
      COALESCE(ps.sleep_count, 0) AS sleep_count,
      COALESCE(ps.sleep_money, 0) AS sleep_money,
      ps.last_seen,
      ps.city,
      ps.country,
      ps.path,
      COALESCE(pp.pizzer_level, 1) AS pizzer_level,
      COALESCE(pp.pizzer_xp, 0) AS pizzer_xp,
      COALESCE(pp.pizzer_total_deliveries, 0) AS deliveries,
      COALESCE(pp.pizzer_total_earnings, 0) AS pizzer_earnings,
      COALESCE(fp.fisher_level, 1) AS fisher_level,
      COALESCE(fp.fisher_xp, 0) AS fisher_xp,
      COALESCE(fp.fisher_total_catches, 0) AS catches,
      COALESCE(fp.fisher_total_earnings, 0) AS fisher_earnings,
      COALESCE(pip.pilot_level, 1) AS pilot_level,
      COALESCE(pip.pilot_xp, 0) AS pilot_xp,
      COALESCE(pip.pilot_total_flights, 0) AS flights,
      COALESCE(pip.pilot_total_earnings, 0) AS pilot_earnings,
      COALESCE(vt.vehicle_count, 0) AS vehicle_count,
      COALESCE(vt.fleet_value, 0) AS fleet_value,
      COALESCE(it.inventory_units, 0) AS inventory_units,
      EXISTS (
        SELECT 1 FROM active_boosts ab
        WHERE ab.player_id = p.player_id
          AND ab.boost_type IN ('VIP_GOLD', 'VIP_SILVER')
          AND LEAST(
            ab.expires_at,
            ab.created_at + CASE ab.boost_type
              WHEN 'VIP_GOLD' THEN INTERVAL '125 seconds'
              ELSE INTERVAL '65 seconds'
            END
          ) > NOW()
      ) AS vip_active,
      EXISTS (SELECT 1 FROM player_gangs pg WHERE pg.player_id = p.player_id AND NULLIF(TRIM(pg.gang_name), '') IS NOT NULL) AS has_gang
    FROM players p
    LEFT JOIN users u ON u.player_id = p.player_id
    LEFT JOIN player_city_progress cp ON cp.player_id = p.player_id
    LEFT JOIN player_stats ps ON ps.player_id = p.player_id
    LEFT JOIN player_pizzer_progress pp ON pp.player_id = p.player_id
    LEFT JOIN player_fisher_progress fp ON fp.player_id = p.player_id
    LEFT JOIN player_pilot_progress pip ON pip.player_id = p.player_id
    LEFT JOIN vehicle_totals vt ON vt.player_id = p.player_id
    LEFT JOIN inventory_totals it ON it.player_id = p.player_id
  `);

  return result.rows.map((row) => {
    const cityXp = safeNumber(row.city_xp);
    const cleanMoney = safeNumber(row.clean_money);
    const fleetValue = safeNumber(row.fleet_value);
    const totalEarnings = safeNumber(row.pizzer_earnings)
      + safeNumber(row.fisher_earnings)
      + safeNumber(row.pilot_earnings)
      + safeNumber(row.farm_earned)
      + safeNumber(row.sleep_money)
      + safeNumber(row.roulette_won);
    const careerScore = safeNumber(row.deliveries) + safeNumber(row.catches) + safeNumber(row.flights);
    const totalTimeHours = safeNumber(row.time_spent) + safeNumber(row.time_pilot);
    return {
      playerId: row.player_id,
      accountId: row.account_id ? Number(row.account_id) : null,
      username: row.username || null,
      email: row.email || null,
      displayName: String(row.display_name || row.username || row.player_id),
      cityXp,
      cityLevel: cityLevelFromXp(cityXp),
      cleanMoney,
      flowCoins: safeNumber(row.flow_coins),
      rouletteFragments: safeNumber(row.roulette_fragments),
      vehicleSlotsBase: safeNumber(row.vehicle_slots_base),
      vehicleSlotsExtra: safeNumber(row.vehicle_slots_extra),
      fleetValue,
      vehicleCount: safeNumber(row.vehicle_count),
      inventoryUnits: safeNumber(row.inventory_units),
      netWorth: cleanMoney + fleetValue,
      totalEarnings,
      careerScore,
      totalTimeHours,
      rouletteSpent: safeNumber(row.roulette_spent),
      rouletteWon: safeNumber(row.roulette_won),
      totalNet: safeNumber(row.total_net),
      farmEarned: safeNumber(row.farm_earned),
      sleepCount: safeNumber(row.sleep_count),
      sleepMoney: safeNumber(row.sleep_money),
      pizzerLevel: safeNumber(row.pizzer_level, 1),
      pizzerXp: safeNumber(row.pizzer_xp),
      deliveries: safeNumber(row.deliveries),
      pizzerEarnings: safeNumber(row.pizzer_earnings),
      fisherLevel: safeNumber(row.fisher_level, 1),
      fisherXp: safeNumber(row.fisher_xp),
      catches: safeNumber(row.catches),
      fisherEarnings: safeNumber(row.fisher_earnings),
      pilotLevel: safeNumber(row.pilot_level, 1),
      pilotXp: safeNumber(row.pilot_xp),
      flights: safeNumber(row.flights),
      pilotEarnings: safeNumber(row.pilot_earnings),
      vipActive: Boolean(row.vip_active),
      hasGang: Boolean(row.has_gang),
      lastSeen: row.last_seen ? new Date(row.last_seen).toISOString() : null,
      lastSeenMs: row.last_seen ? new Date(row.last_seen).getTime() : 0,
      city: row.city || null,
      country: row.country || null,
      path: row.path || null,
    };
  });
}

function sortRows(rows, field, direction = 'desc') {
  const sign = direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    if (typeof av === 'string' || typeof bv === 'string') return String(av || '').localeCompare(String(bv || '')) * sign;
    return (safeNumber(av) - safeNumber(bv)) * sign;
  });
}

async function getPlayerLeaderboard(metric = 'city_level') {
  const config = PLAYER_LEADERBOARD_METRICS[metric] || PLAYER_LEADERBOARD_METRICS.city_level;
  const rows = (await loadPlayerDataset()).filter((row) => row.accountId !== null);
  const ranked = sortRows(rows, config.field, 'desc').slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 }));
  return {
    metric: PLAYER_LEADERBOARD_METRICS[metric] ? metric : 'city_level',
    metricLabel: config.label,
    summary: {
      totalAccounts: rows.length,
      totalCleanMoney: rows.reduce((sum, row) => sum + row.cleanMoney, 0),
      totalEarnings: rows.reduce((sum, row) => sum + row.totalEarnings, 0),
      totalFleetValue: rows.reduce((sum, row) => sum + row.fleetValue, 0),
      activeRecent: rows.filter((row) => row.lastSeenMs > Date.now() - 15 * 60 * 1000).length,
    },
    players: ranked,
  };
}

async function loadGangDataset() {
  await ensureSchema();
  const result = await pool.query(`
    SELECT
      g.*,
      COALESCE(NULLIF(TRIM(p.display_name), ''), u.username, g.player_id) AS owner_name,
      u.id AS account_id,
      u.username,
      COALESCE(cp.city_xp, 0) AS city_xp
    FROM player_gangs g
    JOIN users u ON u.player_id = g.player_id
    LEFT JOIN players p ON p.player_id = g.player_id
    LEFT JOIN player_city_progress cp ON cp.player_id = g.player_id
    WHERE NULLIF(TRIM(g.gang_name), '') IS NOT NULL
  `);
  return result.rows.map((row) => ({
    playerId: row.player_id,
    ownerName: row.owner_name,
    username: row.username,
    name: row.gang_name,
    gangLevelIndex: safeNumber(row.gang_level_index),
    gangLevel: GANG_LEVEL_LABELS[safeNumber(row.gang_level_index)] || GANG_LEVEL_LABELS[0],
    membersCount: safeNumber(row.members_count),
    activeWorkers: safeNumber(row.active_workers),
    leaves: safeNumber(row.leaves),
    whitePacks: safeNumber(row.white_packs),
    bluePacks: safeNumber(row.blue_packs),
    dirtyEarned: safeNumber(row.dirty_earned),
    stockValue: safeNumber(row.stock_value),
    cityXp: safeNumber(row.city_xp),
    cityLevel: cityLevelFromXp(safeNumber(row.city_xp)),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    updatedAtMs: row.updated_at ? new Date(row.updated_at).getTime() : 0,
  }));
}

async function getGangLeaderboard(metric = 'dirty_earned') {
  const config = GANG_LEADERBOARD_METRICS[metric] || GANG_LEADERBOARD_METRICS.dirty_earned;
  const rows = await loadGangDataset();
  const ranked = sortRows(rows, config.field, 'desc').slice(0, 10).map((row, index) => ({ ...row, rank: index + 1 }));
  return {
    metric: GANG_LEADERBOARD_METRICS[metric] ? metric : 'dirty_earned',
    metricLabel: config.label,
    summary: {
      totalGangs: rows.length,
      totalMembers: rows.reduce((sum, row) => sum + row.membersCount, 0),
      totalDirtyEarned: rows.reduce((sum, row) => sum + row.dirtyEarned, 0),
      totalStockValue: rows.reduce((sum, row) => sum + row.stockValue, 0),
      activeRecent: rows.filter((row) => row.updatedAtMs > Date.now() - 15 * 60 * 1000).length,
    },
    gangs: ranked,
  };
}


module.exports = {
  getGangLeaderboard,
  getPlayerLeaderboard,
  loadGangDataset,
  loadPlayerDataset,
  sortRows,
};
