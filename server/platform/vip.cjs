const {
  VIP_DURATION_SECONDS,
  VIP_LABELS,
} = require('./constants.cjs');
const {
  clampInteger,
  ensurePlayer,
  ensureSchema,
  pool,
  withTransaction,
} = require('./db.cjs');

function vipView(row) {
  if (!row) {
    return {
      active: false,
      tier: null,
      label: null,
      expiresAt: null,
      startedAt: null,
      durationMs: 0,
      remainingMs: 0,
    };
  }

  const tier = String(row.boost_type || '');
  const expiresAt = new Date(row.expires_at).getTime();
  const startedAt = new Date(row.created_at).getTime();
  const durationSeconds = Number(VIP_DURATION_SECONDS[tier] || 0);
  const allowedExpiresAt = durationSeconds > 0 ? startedAt + durationSeconds * 1000 : expiresAt;
  const effectiveExpiresAt = Math.min(expiresAt, allowedExpiresAt);
  const remainingMs = Math.max(0, effectiveExpiresAt - Date.now());

  return {
    active: remainingMs > 0,
    tier: remainingMs > 0 ? tier : null,
    label: remainingMs > 0 ? VIP_LABELS[tier] || tier : null,
    expiresAt: remainingMs > 0 ? new Date(effectiveExpiresAt).toISOString() : null,
    startedAt: remainingMs > 0 ? new Date(startedAt).toISOString() : null,
    durationMs: durationSeconds * 1000,
    remainingMs,
  };
}

async function getVipStatus(playerId) {
  await ensureSchema();
  const result = await pool.query(
    `
      SELECT id, boost_type, created_at, expires_at
      FROM active_boosts
      WHERE player_id = $1
        AND boost_type IN ('VIP_GOLD', 'VIP_SILVER')
        AND expires_at > NOW()
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [playerId],
  );

  const row = result.rows[0];
  if (!row) return vipView(null);

  const tier = String(row.boost_type || '');
  const startedAtMs = new Date(row.created_at).getTime();
  const storedExpiresAtMs = new Date(row.expires_at).getTime();
  const allowedExpiresAtMs = startedAtMs + Number(VIP_DURATION_SECONDS[tier] || 0) * 1000;
  const effectiveExpiresAtMs = Math.min(storedExpiresAtMs, allowedExpiresAtMs);

  if (Number.isFinite(effectiveExpiresAtMs) && storedExpiresAtMs !== effectiveExpiresAtMs) {
    await pool.query(`UPDATE active_boosts SET expires_at = $2 WHERE id = $1`, [row.id, new Date(effectiveExpiresAtMs).toISOString()]);
    row.expires_at = new Date(effectiveExpiresAtMs);
  }

  return vipView(row);
}

async function activateVip(playerId, tier, options = {}) {
  await ensureSchema();
  if (!VIP_DURATION_SECONDS[tier]) throw new Error('invalid VIP tier');
  const durationSeconds = clampInteger(options.durationSeconds || VIP_DURATION_SECONDS[tier], 5, 3600);

  await withTransaction(async (db) => {
    await ensurePlayer(db, playerId);
    await db.query(
      `UPDATE active_boosts SET expires_at = NOW() WHERE player_id = $1 AND boost_type IN ('VIP_GOLD', 'VIP_SILVER') AND expires_at > NOW()`,
      [playerId],
    );
    await db.query(
      `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1, $2, NOW() + ($3 || ' seconds')::interval)`,
      [playerId, tier, String(durationSeconds)],
    );
  });

  return getVipStatus(playerId);
}

async function normalizeLatestVipActivation(playerId, tier) {
  await ensureSchema();
  if (!VIP_DURATION_SECONDS[tier]) return getVipStatus(playerId);
  const durationSeconds = VIP_DURATION_SECONDS[tier];

  await withTransaction(async (db) => {
    const latest = await db.query(
      `
        SELECT id
        FROM active_boosts
        WHERE player_id = $1 AND boost_type = $2
        ORDER BY created_at DESC, id DESC
        LIMIT 1
        FOR UPDATE
      `,
      [playerId, tier],
    );
    const id = latest.rows[0]?.id;
    if (!id) return;
    await db.query(
      `UPDATE active_boosts SET expires_at = NOW() WHERE player_id = $1 AND boost_type IN ('VIP_GOLD', 'VIP_SILVER') AND id <> $2 AND expires_at > NOW()`,
      [playerId, id],
    );
    await db.query(
      `UPDATE active_boosts SET created_at = NOW(), expires_at = NOW() + ($2 || ' seconds')::interval WHERE id = $1`,
      [id, String(durationSeconds)],
    );
  });

  return getVipStatus(playerId);
}

async function revokeVip(playerId) {
  await ensureSchema();
  await pool.query(
    `UPDATE active_boosts SET expires_at = NOW() WHERE player_id = $1 AND boost_type IN ('VIP_GOLD', 'VIP_SILVER') AND expires_at > NOW()`,
    [playerId],
  );
  return getVipStatus(playerId);
}

async function getPlatformStatus(playerId) {
  return { vip: await getVipStatus(playerId) };
}


module.exports = {
  activateVip,
  getPlatformStatus,
  getVipStatus,
  normalizeLatestVipActivation,
  revokeVip,
  vipView,
};
