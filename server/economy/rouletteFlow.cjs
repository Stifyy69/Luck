const crypto = require('crypto');
const { pickWeightedReward, rewardPayout } = require('./roulette.cjs');
const { ensureSchema, pool, withTransaction } = require('../platform/db.cjs');

const SPIN_REVEAL_MS = 4600;
let rouletteSchemaPromise = null;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function ensureRouletteSchema() {
  await ensureSchema();
  if (rouletteSchemaPromise) return rouletteSchemaPromise;
  rouletteSchemaPromise = pool.query(`
    CREATE TABLE IF NOT EXISTS roulette_pending_spins (
      spin_id TEXT PRIMARY KEY,
      operation_id TEXT NOT NULL,
      player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
      cost_type TEXT NOT NULL,
      cost_amount BIGINT NOT NULL,
      reward_type TEXT NOT NULL,
      reward_name TEXT NOT NULL,
      reward_tier TEXT NOT NULL,
      payout BIGINT NOT NULL,
      reward_subtitle TEXT NOT NULL DEFAULT '',
      emoji TEXT NOT NULL DEFAULT '🎁',
      reward_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      ready_at TIMESTAMPTZ NOT NULL,
      claimed_at TIMESTAMPTZ,
      claim_result JSONB,
      UNIQUE(player_id, operation_id)
    );
  `).catch((error) => {
    rouletteSchemaPromise = null;
    throw error;
  });
  return rouletteSchemaPromise;
}

async function addInventoryItem(db, playerId, itemType, quantity = 1, metadata = {}) {
  const existing = await db.query(
    `SELECT id, quantity FROM inventory_items
     WHERE player_id = $1 AND item_type = $2 AND metadata = $3::jsonb
     LIMIT 1`,
    [playerId, itemType, JSON.stringify(metadata)],
  );

  if (existing.rows[0]) {
    const updated = await db.query(
      `UPDATE inventory_items
       SET quantity = quantity + $2
       WHERE id = $1
       RETURNING id, item_type, quantity, metadata`,
      [existing.rows[0].id, quantity],
    );
    return updated.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO inventory_items (player_id, item_type, quantity, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, item_type, quantity, metadata`,
    [playerId, itemType, quantity, JSON.stringify(metadata)],
  );
  return inserted.rows[0];
}

async function ensureVehicleCapacity(db, playerId) {
  const [playerResult, vehiclesResult] = await Promise.all([
    db.query(`SELECT vehicle_slots_base, vehicle_slots_extra FROM players WHERE player_id = $1`, [playerId]),
    db.query(`SELECT COUNT(*)::INT AS count FROM owned_vehicles WHERE player_id = $1`, [playerId]),
  ]);
  const player = playerResult.rows[0];
  const usedSlots = Number(vehiclesResult.rows[0]?.count || 0);
  const totalSlots = Number(player?.vehicle_slots_base || 0) + Number(player?.vehicle_slots_extra || 0);
  if (usedSlots >= totalSlots) throw new Error('no vehicle slots available');
}

function rewardPresentation(reward, payout, metadata = {}) {
  if (reward.rewardType === 'CASH') return { subtitle: `+${payout.toLocaleString('ro-RO')} $`, emoji: '💵' };
  if (reward.rewardType === 'FLOW_COINS') return { subtitle: `+${payout} FlowCoins`, emoji: '🟠' };
  if (reward.rewardType === 'ROULETTE_FRAGMENTS') return { subtitle: `+${payout} fragmente`, emoji: '🪙' };
  if (reward.rewardType === 'SOUVENIR_VEHICLE') return { subtitle: String(metadata.modelName || reward.name), emoji: '🚗' };
  return {
    subtitle: reward.name,
    emoji: {
      VIP_GOLD: '💎',
      VIP_SILVER: '💠',
      MYSTERY_BOX: '📦',
      SLOT_VEHICLE: '➕',
      VOUCHER_SHOWROOM: '🎟️',
      JOB_BOOST_PILOT: '✈️',
      TAX_EXEMPTION: '💸',
      XENON_VEHICLE: '🔩',
    }[reward.rewardType] || '🎁',
  };
}

async function buildRewardMetadata(db, playerId, reward) {
  if (reward.rewardType === 'SOUVENIR_VEHICLE') {
    await ensureVehicleCapacity(db, playerId);
    const modelResult = await db.query(`SELECT id, brand, name FROM vehicle_models ORDER BY RANDOM() LIMIT 1`);
    const model = modelResult.rows[0];
    if (!model) throw new Error('no souvenir vehicle available');
    return { modelId: Number(model.id), modelName: model.name, brand: model.brand };
  }
  if (reward.rewardType === 'VOUCHER_SHOWROOM') return { discount: randomInt(10, 35) };
  if (reward.rewardType === 'XENON_VEHICLE') return { marketValue: randomInt(5_000, 150_000) };
  return {};
}

function spinView(row, player, claimed = false) {
  return {
    spinId: row.spin_id,
    rewardType: row.reward_type,
    rewardName: row.reward_name,
    rewardSubtitle: row.reward_subtitle,
    tier: row.reward_tier,
    emoji: row.emoji,
    payout: Number(row.payout || 0),
    metadata: row.reward_metadata || {},
    readyAt: row.ready_at instanceof Date ? row.ready_at.toISOString() : row.ready_at,
    claimed,
    player: {
      cleanMoney: Number(player.clean_money || 0),
      flowCoins: Number(player.flow_coins || 0),
      rouletteFragments: Number(player.roulette_fragments || 0),
    },
  };
}

async function startRouletteSpin(playerId, costType, operationId) {
  await ensureRouletteSchema();
  const safePlayerId = String(playerId || '').trim();
  const safeOperationId = String(operationId || '').trim();
  if (!safePlayerId || !safeOperationId) throw new Error('missing fields');
  if (!['cash', 'flowcoins', 'fragments'].includes(costType)) throw new Error('invalid cost type');

  return withTransaction(async (db) => {
    const duplicate = await db.query(
      `SELECT * FROM roulette_pending_spins WHERE player_id = $1 AND operation_id = $2 FOR UPDATE`,
      [safePlayerId, safeOperationId],
    );
    if (duplicate.rows[0]) {
      const playerResult = await db.query(`SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1`, [safePlayerId]);
      return spinView(duplicate.rows[0], playerResult.rows[0] || {}, Boolean(duplicate.rows[0].claimed_at));
    }

    await db.query(`INSERT INTO players (player_id, clean_money) VALUES ($1, 69) ON CONFLICT (player_id) DO NOTHING`, [safePlayerId]);
    const playerResult = await db.query(`SELECT * FROM players WHERE player_id = $1 FOR UPDATE`, [safePlayerId]);
    const player = playerResult.rows[0];
    const cost = costType === 'flowcoins' ? 30 : costType === 'fragments' ? 4 : 100_000;

    if (costType === 'flowcoins' && Number(player.flow_coins) < cost) throw new Error('insufficient flowcoins');
    if (costType === 'fragments' && Number(player.roulette_fragments) < cost) throw new Error('insufficient fragments');
    if (costType === 'cash' && Number(player.clean_money) < cost) throw new Error('insufficient funds');

    const reward = pickWeightedReward();
    const payout = rewardPayout(reward);
    const metadata = await buildRewardMetadata(db, safePlayerId, reward);
    const presentation = rewardPresentation(reward, payout, metadata);

    if (costType === 'flowcoins') {
      await db.query(`UPDATE players SET flow_coins = flow_coins - $1, updated_at = NOW() WHERE player_id = $2`, [cost, safePlayerId]);
    } else if (costType === 'fragments') {
      await db.query(`UPDATE players SET roulette_fragments = roulette_fragments - $1, updated_at = NOW() WHERE player_id = $2`, [cost, safePlayerId]);
    } else {
      await db.query(`UPDATE players SET clean_money = clean_money - $1, updated_at = NOW() WHERE player_id = $2`, [cost, safePlayerId]);
    }

    const spinId = `spin_${crypto.randomBytes(12).toString('hex')}`;
    const readyAt = new Date(Date.now() + SPIN_REVEAL_MS);
    const inserted = await db.query(
      `INSERT INTO roulette_pending_spins (
         spin_id, operation_id, player_id, cost_type, cost_amount,
         reward_type, reward_name, reward_tier, payout, reward_subtitle, emoji,
         reward_metadata, ready_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       RETURNING *`,
      [
        spinId,
        safeOperationId,
        safePlayerId,
        costType,
        cost,
        reward.rewardType,
        reward.name,
        reward.tier,
        payout,
        presentation.subtitle,
        presentation.emoji,
        JSON.stringify(metadata),
        readyAt,
      ],
    );

    await db.query(
      `INSERT INTO player_stats (player_id, roulette_spent, roulette_won, last_seen, updated_at)
       VALUES ($1, $2, 0, NOW(), NOW())
       ON CONFLICT (player_id) DO UPDATE SET
         roulette_spent = player_stats.roulette_spent + $2,
         last_seen = NOW(), updated_at = NOW()`,
      [safePlayerId, costType === 'cash' ? cost : 0],
    );

    const updatedPlayer = await db.query(`SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1`, [safePlayerId]);
    return spinView(inserted.rows[0], updatedPlayer.rows[0] || {}, false);
  });
}

async function claimRouletteSpin(playerId, spinId) {
  await ensureRouletteSchema();
  const safePlayerId = String(playerId || '').trim();
  const safeSpinId = String(spinId || '').trim();
  if (!safePlayerId || !safeSpinId) throw new Error('missing fields');

  return withTransaction(async (db) => {
    const spinResult = await db.query(
      `SELECT * FROM roulette_pending_spins WHERE spin_id = $1 AND player_id = $2 FOR UPDATE`,
      [safeSpinId, safePlayerId],
    );
    const spin = spinResult.rows[0];
    if (!spin) throw new Error('spin not found');
    if (spin.claimed_at && spin.claim_result) return spin.claim_result;
    if (new Date(spin.ready_at).getTime() > Date.now()) {
      const error = new Error('reveal not finished');
      error.statusCode = 409;
      throw error;
    }

    const payout = Number(spin.payout || 0);
    const metadata = spin.reward_metadata || {};

    if (spin.reward_type === 'CASH') {
      await db.query(`UPDATE players SET clean_money = clean_money + $1, updated_at = NOW() WHERE player_id = $2`, [payout, safePlayerId]);
    } else if (spin.reward_type === 'FLOW_COINS') {
      await db.query(`UPDATE players SET flow_coins = flow_coins + $1, updated_at = NOW() WHERE player_id = $2`, [payout, safePlayerId]);
    } else if (spin.reward_type === 'ROULETTE_FRAGMENTS') {
      await db.query(`UPDATE players SET roulette_fragments = roulette_fragments + $1, updated_at = NOW() WHERE player_id = $2`, [payout, safePlayerId]);
    } else if (spin.reward_type === 'SOUVENIR_VEHICLE') {
      const modelId = Number(metadata.modelId);
      if (!Number.isSafeInteger(modelId) || modelId <= 0) throw new Error('souvenir vehicle missing');
      const vehicle = await db.query(
        `INSERT INTO owned_vehicles (player_id, model_id, purchase_price, purchase_source)
         VALUES ($1, $2, 0, 'ROULETTE') RETURNING id`,
        [safePlayerId, modelId],
      );
      metadata.vehicleId = Number(vehicle.rows[0].id);
    } else {
      await addInventoryItem(db, safePlayerId, spin.reward_type, payout, metadata);
    }

    if (spin.reward_type === 'CASH') {
      await db.query(
        `UPDATE player_stats SET roulette_won = roulette_won + $2, last_seen = NOW(), updated_at = NOW() WHERE player_id = $1`,
        [safePlayerId, payout],
      );
    }

    const playerResult = await db.query(`SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1`, [safePlayerId]);
    const result = spinView({ ...spin, reward_metadata: metadata }, playerResult.rows[0] || {}, true);

    await db.query(
      `UPDATE roulette_pending_spins
       SET claimed_at = NOW(), reward_metadata = $2::jsonb, claim_result = $3::jsonb
       WHERE spin_id = $1`,
      [safeSpinId, JSON.stringify(metadata), JSON.stringify(result)],
    );

    return result;
  });
}

function installRouletteFlow(app, requirePlayer, createRateLimiter) {
  const rateLimit = createRateLimiter({ windowMs: 60_000, max: 20, key: (req) => req.playerId || req.ip });

  app.post('/api/roulette/spin', requirePlayer, (_req, res) => {
    return res.status(410).json({ error: 'use roulette reveal flow' });
  });

  app.post('/api/roulette/start', requirePlayer, rateLimit, async (req, res) => {
    try {
      const result = await startRouletteSpin(req.playerId, req.body?.costType, req.body?.operationId);
      return res.json(result);
    } catch (error) {
      return res.status(Number(error?.statusCode || 400)).json({ error: error instanceof Error ? error.message : 'spin start failed' });
    }
  });

  app.post('/api/roulette/claim', requirePlayer, rateLimit, async (req, res) => {
    try {
      const result = await claimRouletteSpin(req.playerId, req.body?.spinId);
      return res.json(result);
    } catch (error) {
      return res.status(Number(error?.statusCode || 400)).json({ error: error instanceof Error ? error.message : 'spin claim failed' });
    }
  });
}

module.exports = {
  SPIN_REVEAL_MS,
  claimRouletteSpin,
  installRouletteFlow,
  startRouletteSpin,
};
