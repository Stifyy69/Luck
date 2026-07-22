const { Pool } = require('pg');
const {
  CITY_MAX_LEVEL,
  CITY_XP_REWARDS,
  buildCareerAccess,
  cityLevelFromXp,
  cityLevelStartXp,
  nextUnlockForLevel,
  unlocksBetweenLevels,
} = require('./constants.cjs');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

let schemaPromise = null;

function assertDatabase() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
}

async function ensureSchema() {
  assertDatabase();
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_city_progress (
        player_id TEXT PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
        city_xp BIGINT NOT NULL DEFAULT 0,
        tutorial_version INT NOT NULL DEFAULT 1,
        tutorial_step INT NOT NULL DEFAULT 0,
        tutorial_completed_at TIMESTAMPTZ,
        tutorial_skipped_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_city_xp_events (
        id BIGSERIAL PRIMARY KEY,
        player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        xp_amount INT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(player_id, source_type, source_id)
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS player_city_xp_events_recent_idx ON player_city_xp_events(player_id, created_at DESC);`);
  })().catch((error) => {
    schemaPromise = null;
    throw error;
  });

  return schemaPromise;
}

async function withTransaction(work) {
  assertDatabase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function ensurePlayer(db, playerId) {
  await db.query(
    `INSERT INTO players (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
}

async function calculateLegacySeedXp(db, playerId) {
  const result = await db.query(
    `
      SELECT
        COALESCE(pp.pizzer_total_deliveries, 0) AS deliveries,
        COALESCE(fp.fisher_total_catches, 0) AS catches,
        COALESCE(pip.pilot_total_flights, 0) AS flights,
        COALESCE(ps.leaves_collected, 0) AS leaves_collected,
        COALESCE(ps.white_processed, 0) AS white_processed,
        COALESCE(ps.blue_processed, 0) AS blue_processed
      FROM players p
      LEFT JOIN player_pizzer_progress pp ON pp.player_id = p.player_id
      LEFT JOIN player_fisher_progress fp ON fp.player_id = p.player_id
      LEFT JOIN player_pilot_progress pip ON pip.player_id = p.player_id
      LEFT JOIN player_stats ps ON ps.player_id = p.player_id
      WHERE p.player_id = $1
    `,
    [playerId],
  );

  const row = result.rows[0] || {};
  const pizzaXp = Number(row.deliveries || 0) * CITY_XP_REWARDS.PIZZER_DELIVERY;
  const fisherXp = Number(row.catches || 0) * CITY_XP_REWARDS.FISHER_CATCH;
  const pilotXp = Number(row.flights || 0) * CITY_XP_REWARDS.PILOT_FLIGHT;
  const collectRuns = Math.floor(Number(row.leaves_collected || 0) / 1200);
  const processRuns = Math.floor(Number(row.white_processed || 0) / 400);
  const refineRuns = Math.floor(Number(row.blue_processed || 0) / 800);
  return Math.max(0, pizzaXp + fisherXp + pilotXp + collectRuns * CITY_XP_REWARDS.CAYO_COLLECT + processRuns * CITY_XP_REWARDS.CAYO_PROCESS + refineRuns * CITY_XP_REWARDS.CAYO_REFINE);
}

async function ensureProgressRow(db, playerId) {
  await ensurePlayer(db, playerId);
  const existing = await db.query(`SELECT * FROM player_city_progress WHERE player_id = $1`, [playerId]);
  if (existing.rows[0]) return existing.rows[0];

  const seedXp = await calculateLegacySeedXp(db, playerId);
  const inserted = await db.query(
    `
      INSERT INTO player_city_progress (player_id, city_xp)
      VALUES ($1, $2)
      ON CONFLICT (player_id) DO UPDATE SET player_id = EXCLUDED.player_id
      RETURNING *
    `,
    [playerId, seedXp],
  );
  return inserted.rows[0];
}

async function getVipActive(db, playerId) {
  const result = await db.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM active_boosts
        WHERE player_id = $1
          AND boost_type IN ('VIP_GOLD', 'VIP_SILVER')
          AND expires_at > NOW()
      ) AS active
    `,
    [playerId],
  );
  return Boolean(result.rows[0]?.active);
}

function tutorialView(row) {
  return {
    version: Number(row?.tutorial_version || 1),
    step: Math.max(0, Math.min(6, Number(row?.tutorial_step || 0))),
    completedAt: row?.tutorial_completed_at ? new Date(row.tutorial_completed_at).toISOString() : null,
    skippedAt: row?.tutorial_skipped_at ? new Date(row.tutorial_skipped_at).toISOString() : null,
  };
}

function buildProgressView(row, vipActive) {
  const xp = Math.max(0, Number(row?.city_xp || 0));
  const level = cityLevelFromXp(xp);
  const levelStartXp = cityLevelStartXp(level);
  const nextLevelTotalXp = level >= CITY_MAX_LEVEL ? null : cityLevelStartXp(level + 1);
  const levelSpan = nextLevelTotalXp === null ? 1 : Math.max(1, nextLevelTotalXp - levelStartXp);
  const currentLevelXp = Math.max(0, xp - levelStartXp);
  const nextUnlock = nextUnlockForLevel(level);

  return {
    level,
    xp,
    levelStartXp,
    currentLevelXp,
    nextLevelXp: nextLevelTotalXp === null ? null : levelSpan,
    nextLevelTotalXp,
    xpToNext: nextLevelTotalXp === null ? 0 : Math.max(0, nextLevelTotalXp - xp),
    progressPercent: nextLevelTotalXp === null ? 100 : Math.max(0, Math.min(100, (currentLevelXp / levelSpan) * 100)),
    maxLevel: CITY_MAX_LEVEL,
    nextUnlock,
    vipActive: Boolean(vipActive),
    careerAccess: buildCareerAccess(level, vipActive),
    tutorial: tutorialView(row),
  };
}

async function reconcileTutorial(db, playerId, row) {
  if (row.tutorial_completed_at || row.tutorial_skipped_at) return row;

  const facts = await db.query(
    `
      SELECT
        COALESCE(NULLIF(TRIM(p.display_name), ''), '') AS display_name,
        COALESCE(pp.pizzer_total_deliveries, 0) AS deliveries
      FROM players p
      LEFT JOIN player_pizzer_progress pp ON pp.player_id = p.player_id
      WHERE p.player_id = $1
    `,
    [playerId],
  );

  const fact = facts.rows[0] || {};
  let requiredStep = Number(row.tutorial_step || 0);
  if (String(fact.display_name || '').trim()) requiredStep = Math.max(requiredStep, 2);
  if (Number(fact.deliveries || 0) > 0) requiredStep = Math.max(requiredStep, 6);

  if (requiredStep === Number(row.tutorial_step || 0)) return row;
  const updated = await db.query(
    `UPDATE player_city_progress SET tutorial_step = $2, updated_at = NOW() WHERE player_id = $1 RETURNING *`,
    [playerId, requiredStep],
  );
  return updated.rows[0];
}

async function getCityProgress(playerId) {
  await ensureSchema();
  return withTransaction(async (db) => {
    let row = await ensureProgressRow(db, playerId);
    row = await reconcileTutorial(db, playerId, row);
    const vipActive = await getVipActive(db, playerId);
    return buildProgressView(row, vipActive);
  });
}

async function awardCityXp(playerId, sourceType, sourceId, xpAmount, metadata = {}) {
  await ensureSchema();
  return withTransaction((db) => awardCityXpInTransaction(db, playerId, sourceType, sourceId, xpAmount, metadata));
}

async function awardCityXpInTransaction(db, playerId, sourceType, sourceId, xpAmount, metadata = {}) {
  const safeAmount = Math.max(0, Math.min(1000, Math.floor(Number(xpAmount || 0))));
  if (!safeAmount) {
    let row = await ensureProgressRow(db, playerId);
    const vipActive = await getVipActive(db, playerId);
    const progress = buildProgressView(row, vipActive);
    return { progress, awardedXp: 0, levelUp: null, duplicate: false };
  }

  let row = await ensureProgressRow(db, playerId);
  const vipActive = await getVipActive(db, playerId);
  const before = buildProgressView(row, vipActive);

  const inserted = await db.query(
    `
      INSERT INTO player_city_xp_events (player_id, source_type, source_id, xp_amount, metadata)
      VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (player_id, source_type, source_id) DO NOTHING
      RETURNING id
    `,
    [playerId, String(sourceType), String(sourceId), safeAmount, JSON.stringify(metadata || {})],
  );

  if (!inserted.rows[0]) {
    return { progress: before, awardedXp: 0, levelUp: null, duplicate: true };
  }

  const updated = await db.query(
    `
      UPDATE player_city_progress
      SET city_xp = city_xp + $2, updated_at = NOW()
      WHERE player_id = $1
      RETURNING *
    `,
    [playerId, safeAmount],
  );
  row = updated.rows[0];
  const after = buildProgressView(row, vipActive);
  const levelUp = after.level > before.level
    ? {
        fromLevel: before.level,
        toLevel: after.level,
        unlocks: unlocksBetweenLevels(before.level, after.level),
      }
    : null;

  return { progress: after, awardedXp: safeAmount, levelUp, duplicate: false };
}

async function updateTutorial(playerId, action, requestedStep = null) {
  await ensureSchema();
  return withTransaction(async (db) => {
    let row = await ensureProgressRow(db, playerId);
    const currentStep = Math.max(0, Math.min(6, Number(row.tutorial_step || 0)));

    if (action === 'advance') {
      const target = requestedStep === null ? currentStep + 1 : Number(requestedStep);
      const nextStep = Math.max(currentStep, Math.min(6, target));
      const result = await db.query(
        `UPDATE player_city_progress SET tutorial_step = $2, updated_at = NOW() WHERE player_id = $1 RETURNING *`,
        [playerId, nextStep],
      );
      row = result.rows[0];
    } else if (action === 'complete') {
      const result = await db.query(
        `
          UPDATE player_city_progress
          SET tutorial_step = 6, tutorial_completed_at = NOW(), tutorial_skipped_at = NULL, updated_at = NOW()
          WHERE player_id = $1
          RETURNING *
        `,
        [playerId],
      );
      row = result.rows[0];
    } else if (action === 'skip') {
      const result = await db.query(
        `
          UPDATE player_city_progress
          SET tutorial_skipped_at = NOW(), tutorial_completed_at = NULL, updated_at = NOW()
          WHERE player_id = $1
          RETURNING *
        `,
        [playerId],
      );
      row = result.rows[0];
    } else if (action === 'replay') {
      const result = await db.query(
        `
          UPDATE player_city_progress
          SET tutorial_step = 0, tutorial_completed_at = NULL, tutorial_skipped_at = NULL, tutorial_version = 1, updated_at = NOW()
          WHERE player_id = $1
          RETURNING *
        `,
        [playerId],
      );
      row = result.rows[0];
    }

    const vipActive = await getVipActive(db, playerId);
    return buildProgressView(row, vipActive);
  });
}

async function advanceTutorialAtLeast(playerId, minimumStep) {
  await ensureSchema();
  return withTransaction(async (db) => {
    let row = await ensureProgressRow(db, playerId);
    if (row.tutorial_completed_at || row.tutorial_skipped_at || Number(row.tutorial_step || 0) >= minimumStep) {
      const vipActive = await getVipActive(db, playerId);
      return buildProgressView(row, vipActive);
    }
    const result = await db.query(
      `UPDATE player_city_progress SET tutorial_step = $2, updated_at = NOW() WHERE player_id = $1 RETURNING *`,
      [playerId, Math.max(0, Math.min(6, Number(minimumStep || 0)))],
    );
    row = result.rows[0];
    const vipActive = await getVipActive(db, playerId);
    return buildProgressView(row, vipActive);
  });
}

module.exports = {
  advanceTutorialAtLeast,
  awardCityXp,
  awardCityXpInTransaction,
  ensureSchema,
  getCityProgress,
  pool,
  updateTutorial,
};
