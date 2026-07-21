const { Pool } = require('pg');
const { ensureSchema: ensureCityProgressSchema } = require('../cityProgress/store.cjs');

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  : null;

let schemaPromise = null;

function assertDatabase() {
  if (!pool) throw new Error('DATABASE_URL is not configured');
}

function safeNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, Math.floor(safeNumber(value, min))));
}

async function ensureSchema() {
  assertDatabase();
  if (schemaPromise) return schemaPromise;

  schemaPromise = (async () => {
    await ensureCityProgressSchema();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_gangs (
        player_id TEXT PRIMARY KEY REFERENCES players(player_id) ON DELETE CASCADE,
        gang_name TEXT NOT NULL DEFAULT '',
        gang_level_index INT NOT NULL DEFAULT 0,
        members JSONB NOT NULL DEFAULT '[]'::jsonb,
        members_count INT NOT NULL DEFAULT 0,
        active_workers INT NOT NULL DEFAULT 0,
        leaves BIGINT NOT NULL DEFAULT 0,
        white_packs BIGINT NOT NULL DEFAULT 0,
        blue_packs BIGINT NOT NULL DEFAULT 0,
        dirty_earned BIGINT NOT NULL DEFAULT 0,
        stock_value BIGINT NOT NULL DEFAULT 0,
        last_leave_at BIGINT NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_action_log (
        id BIGSERIAL PRIMARY KEY,
        admin_name TEXT NOT NULL,
        player_id TEXT,
        action_type TEXT NOT NULL,
        action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS player_gangs_rank_idx ON player_gangs(dirty_earned DESC, updated_at DESC);`);
    await pool.query(`CREATE INDEX IF NOT EXISTS admin_action_log_recent_idx ON admin_action_log(created_at DESC);`);
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
  await db.query(`INSERT INTO players (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
}

async function ensureCityProgress(db, playerId) {
  await db.query(
    `INSERT INTO player_city_progress (player_id, city_xp) VALUES ($1, 0) ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
}

async function ensureEditableTableRow(db, table, playerId) {
  if (table === 'player_city_progress') {
    await ensureCityProgress(db, playerId);
    return;
  }
  const allowed = new Set(['player_pizzer_progress', 'player_fisher_progress', 'player_pilot_progress']);
  if (!allowed.has(table)) return;
  await db.query(`INSERT INTO ${table} (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`, [playerId]);
}


module.exports = {
  clampInteger,
  ensureCityProgress,
  ensureEditableTableRow,
  ensurePlayer,
  ensureSchema,
  pool,
  safeNumber,
  withTransaction,
};
