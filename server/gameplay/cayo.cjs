const { CITY_XP_REWARDS, cityLevelFromXp } = require('../cityProgress/constants.cjs');
const { awardCityXpInTransaction } = require('../cityProgress/store.cjs');
const { getVipMultiplier } = require('../economy/boosts.cjs');

const ACTIONS = Object.freeze({
  COLLECT: { leavesCost: 0, whiteCost: 0, dirtyCost: 0, leavesGain: 1_200, whiteGain: 0, blueGain: 0, xp: CITY_XP_REWARDS.CAYO_COLLECT },
  PROCESS: { leavesCost: 1_200, whiteCost: 0, dirtyCost: 900_000, leavesGain: 0, whiteGain: 400, blueGain: 0, xp: CITY_XP_REWARDS.CAYO_PROCESS },
  REFINE: { leavesCost: 0, whiteCost: 400, dirtyCost: 100_000, leavesGain: 0, whiteGain: 0, blueGain: 800, xp: CITY_XP_REWARDS.CAYO_REFINE },
});

function validateOperationId(value) {
  const operationId = String(value || '');
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) throw new Error('operationId invalid');
  return operationId;
}

async function ensureCayoState(db, playerId) {
  await db.query(
    `INSERT INTO player_cayo_state (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
}

async function readCayoState(db, playerId, { lock = false } = {}) {
  await ensureCayoState(db, playerId);
  const result = await db.query(
    `SELECT cs.*, p.clean_money
     FROM player_cayo_state cs
     JOIN players p ON p.player_id = cs.player_id
     WHERE cs.player_id = $1${lock ? ' FOR UPDATE OF cs, p' : ''}`,
    [playerId],
  );
  return result.rows[0];
}

function cayoStateView(row) {
  const nextActionAt = row?.next_action_at ? new Date(row.next_action_at) : null;
  return {
    leaves: Number(row?.leaves || 0),
    whitePacks: Number(row?.white_packs || 0),
    bluePacks: Number(row?.blue_packs || 0),
    dirtyMoney: Number(row?.dirty_money || 0),
    cleanMoney: Number(row?.clean_money || 0),
    totalEarnings: Number(row?.total_earnings || 0),
    timeHours: Number(row?.time_hours || 0),
    nextActionAt: nextActionAt?.toISOString() || null,
    actionCooldownMs: nextActionAt ? Math.max(0, nextActionAt.getTime() - Date.now()) : 0,
  };
}

async function getOperationReplay(db, playerId, operationId, operationType) {
  const result = await db.query(
    `SELECT operation_type, result FROM player_economy_operations WHERE player_id = $1 AND operation_id = $2`,
    [playerId, operationId],
  );
  if (!result.rows[0]) return null;
  if (result.rows[0].operation_type !== operationType) throw new Error('operationId already used for another action');
  return { ...result.rows[0].result, idempotentReplay: true };
}

async function saveOperation(db, playerId, operationId, operationType, result) {
  await db.query(
    `INSERT INTO player_economy_operations (player_id, operation_id, operation_type, result)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [playerId, operationId, operationType, JSON.stringify(result)],
  );
}

async function assertCayoUnlocked(db, playerId) {
  const result = await db.query(`SELECT city_xp FROM player_city_progress WHERE player_id = $1`, [playerId]);
  const level = cityLevelFromXp(Number(result.rows[0]?.city_xp || 0));
  if (level < 10) {
    const error = new Error('City Level 10 required');
    error.statusCode = 403;
    throw error;
  }
}

async function runCayoAction(db, playerId, stageValue, operationIdValue, useCleanForShortfall = false, random = Math.random) {
  const stage = String(stageValue || '').toUpperCase();
  const config = ACTIONS[stage];
  if (!config) throw new Error('invalid Cayo stage');
  const operationId = validateOperationId(operationIdValue);
  const operationType = `CAYO_${stage}`;
  const replay = await getOperationReplay(db, playerId, operationId, operationType);
  if (replay) return replay;

  await assertCayoUnlocked(db, playerId);
  const row = await readCayoState(db, playerId, { lock: true });
  if (row.next_action_at && new Date(row.next_action_at).getTime() > Date.now()) {
    const error = new Error('Cayo action is still cooling down');
    error.statusCode = 429;
    throw error;
  }
  if (Number(row.leaves) < config.leavesCost) throw new Error('not enough leaves');
  if (Number(row.white_packs) < config.whiteCost) throw new Error('not enough white packs');

  const dirtyShortfall = Math.max(0, config.dirtyCost - Number(row.dirty_money));
  const cleanCost = dirtyShortfall > 0 ? Math.ceil(dirtyShortfall * 0.65) : 0;
  if (dirtyShortfall > 0 && !useCleanForShortfall) throw new Error('not enough dirty money');
  if (cleanCost > Number(row.clean_money)) throw new Error('insufficient funds');

  if (cleanCost > 0) {
    const debited = await db.query(
      `UPDATE players SET clean_money = clean_money - $2, updated_at = NOW()
       WHERE player_id = $1 AND clean_money >= $2 RETURNING clean_money`,
      [playerId, cleanCost],
    );
    if (!debited.rows[0]) throw new Error('insufficient funds');
  }

  const raided = Number(random()) < 0.1;
  const leavesGain = raided ? 0 : config.leavesGain;
  const whiteGain = raided ? 0 : config.whiteGain;
  const blueGain = raided ? 0 : config.blueGain;
  const dirtyDebit = Math.min(config.dirtyCost, Number(row.dirty_money));
  const timeHours = stage === 'REFINE' ? 1 : 0.5;

  await db.query(
    `UPDATE player_cayo_state
     SET leaves = leaves - $2 + $3,
         white_packs = white_packs - $4 + $5,
         blue_packs = blue_packs + $6,
         dirty_money = dirty_money - $7,
         time_hours = time_hours + $8,
         next_action_at = NOW() + INTERVAL '5 seconds',
         updated_at = NOW()
     WHERE player_id = $1`,
    [playerId, config.leavesCost, leavesGain, config.whiteCost, whiteGain, blueGain, dirtyDebit, timeHours],
  );

  await db.query(
    `INSERT INTO player_stats (player_id, leaves_collected, white_processed, blue_processed, time_spent, last_seen, updated_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
     ON CONFLICT (player_id) DO UPDATE SET
       leaves_collected = player_stats.leaves_collected + $2,
       white_processed = player_stats.white_processed + $3,
       blue_processed = player_stats.blue_processed + $4,
       time_spent = player_stats.time_spent + $5,
       last_seen = NOW(), updated_at = NOW()`,
    [playerId, leavesGain, whiteGain, blueGain, timeHours],
  );

  const cityReward = raided
    ? null
    : await awardCityXpInTransaction(db, playerId, operationType, operationId, config.xp, { stage });
  const updated = await readCayoState(db, playerId);
  const result = {
    ok: true,
    stage,
    raided,
    cleanCost,
    state: cayoStateView(updated),
    cityProgress: cityReward?.progress || null,
    cityReward,
  };
  await saveOperation(db, playerId, operationId, operationType, result);
  return result;
}

async function sellCayoProduct(db, playerId, modeValue, operationIdValue, random = Math.random) {
  const mode = String(modeValue || '').toUpperCase();
  if (!['BULK', 'DELIVERY_100'].includes(mode)) throw new Error('invalid sale mode');
  const operationId = validateOperationId(operationIdValue);
  const operationType = `CAYO_SELL_${mode}`;
  const replay = await getOperationReplay(db, playerId, operationId, operationType);
  if (replay) return replay;

  await assertCayoUnlocked(db, playerId);
  const row = await readCayoState(db, playerId, { lock: true });
  const quantity = mode === 'BULK' ? Number(row.blue_packs) : 100;
  if (quantity <= 0 || Number(row.blue_packs) < quantity) throw new Error('not enough blue packs');
  const raided = mode === 'DELIVERY_100' && Number(random()) < 0.1;
  const multiplier = await getVipMultiplier(db, playerId);
  const basePayout = raided ? 0 : quantity * (mode === 'BULK' ? 2_300 : 3_179);
  const payout = basePayout * multiplier;

  await db.query(
    `UPDATE player_cayo_state
     SET blue_packs = blue_packs - $2,
         dirty_money = dirty_money + $3,
         total_earnings = total_earnings + $3,
         time_hours = time_hours + $4,
         updated_at = NOW()
     WHERE player_id = $1`,
    [playerId, quantity, payout, mode === 'DELIVERY_100' ? 0.25 : 0],
  );
  await db.query(
    `INSERT INTO player_stats (player_id, farm_earned, time_spent, last_seen, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     ON CONFLICT (player_id) DO UPDATE SET farm_earned = player_stats.farm_earned + $2,
       time_spent = player_stats.time_spent + $3, last_seen = NOW(), updated_at = NOW()`,
    [playerId, payout, mode === 'DELIVERY_100' ? 0.25 : 0],
  );

  const updated = await readCayoState(db, playerId);
  const result = { ok: true, mode, quantity, payout, multiplier, raided, state: cayoStateView(updated) };
  await saveOperation(db, playerId, operationId, operationType, result);
  return result;
}

async function convertCayoCash(db, playerId, operationIdValue) {
  const operationId = validateOperationId(operationIdValue);
  const operationType = 'CAYO_CONVERT';
  const replay = await getOperationReplay(db, playerId, operationId, operationType);
  if (replay) return replay;

  await assertCayoUnlocked(db, playerId);
  const row = await readCayoState(db, playerId, { lock: true });
  const dirtySpent = Number(row.dirty_money);
  if (dirtySpent <= 0) throw new Error('no dirty money to convert');
  const cleanGained = Math.floor(dirtySpent * 0.65);
  await db.query(`UPDATE player_cayo_state SET dirty_money = 0, updated_at = NOW() WHERE player_id = $1`, [playerId]);
  await db.query(
    `UPDATE players SET clean_money = clean_money + $2, updated_at = NOW() WHERE player_id = $1`,
    [playerId, cleanGained],
  );
  const updated = await readCayoState(db, playerId);
  const result = { ok: true, dirtySpent, cleanGained, state: cayoStateView(updated) };
  await saveOperation(db, playerId, operationId, operationType, result);
  return result;
}

module.exports = {
  ACTIONS,
  cayoStateView,
  convertCayoCash,
  readCayoState,
  runCayoAction,
  sellCayoProduct,
  validateOperationId,
};
