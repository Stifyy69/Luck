const { consumeJobBoost, getVipMultiplier } = require('../economy/boosts.cjs');
const { validateOperationId } = require('./cayo.cjs');

const BASE_REWARD = 300_000;
const CYCLE_SECONDS = 3;
const COOLDOWN_SECONDS = 30;

async function ensureSleepState(db, playerId) {
  await db.query(
    `INSERT INTO player_sleep_state (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
}

async function readSleepState(db, playerId, { lock = false } = {}) {
  await ensureSleepState(db, playerId);
  const result = await db.query(
    `SELECT ss.*, p.clean_money
     FROM player_sleep_state ss
     JOIN players p ON p.player_id = ss.player_id
     WHERE ss.player_id = $1${lock ? ' FOR UPDATE OF ss, p' : ''}`,
    [playerId],
  );
  return result.rows[0];
}

function sleepStateView(row) {
  const endsAt = row?.sleep_ends_at ? new Date(row.sleep_ends_at) : null;
  const cooldownUntil = row?.cooldown_until ? new Date(row.cooldown_until) : null;
  const now = Date.now();
  const active = Boolean(row?.active_cycle_id && !row?.reward_claimed);
  return {
    activeCycleId: active ? String(row.active_cycle_id) : null,
    sleepEndsAt: endsAt?.toISOString() || null,
    remainingMs: endsAt ? Math.max(0, endsAt.getTime() - now) : 0,
    claimable: active && Boolean(endsAt && endsAt.getTime() <= now),
    cooldownUntil: cooldownUntil?.toISOString() || null,
    cooldownMs: cooldownUntil ? Math.max(0, cooldownUntil.getTime() - now) : 0,
    multiplier: Math.max(1, Number(row?.reward_multiplier || 1)),
    projectedReward: BASE_REWARD * Math.max(1, Number(row?.reward_multiplier || 1)),
    cleanMoney: Number(row?.clean_money || 0),
  };
}

async function operationReplay(db, playerId, operationId, operationType) {
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

async function startSleepCycle(db, playerId, operationIdValue) {
  const operationId = validateOperationId(operationIdValue);
  const operationType = 'SLEEP_START';
  const replay = await operationReplay(db, playerId, operationId, operationType);
  if (replay) return replay;

  const row = await readSleepState(db, playerId, { lock: true });
  const now = Date.now();
  if (row.active_cycle_id && !row.reward_claimed) throw new Error('sleep cycle already active');
  if (row.cooldown_until && new Date(row.cooldown_until).getTime() > now) throw new Error('sleep cooldown active');

  const jobBoostUsed = await consumeJobBoost(db, playerId, 'JOB_BOOST_SLEEP');
  const vipMultiplier = await getVipMultiplier(db, playerId);
  if (vipMultiplier < 2) throw new Error('VIP access required');
  const multiplier = (jobBoostUsed ? 2 : 1) * vipMultiplier;
  await db.query(
    `UPDATE player_sleep_state
     SET active_cycle_id = $2,
         sleep_ends_at = NOW() + INTERVAL '${CYCLE_SECONDS} seconds',
         reward_multiplier = $3,
         reward_claimed = FALSE,
         updated_at = NOW()
     WHERE player_id = $1`,
    [playerId, operationId, multiplier],
  );
  const updated = await readSleepState(db, playerId);
  const result = { ok: true, jobBoostUsed, vipMultiplier, state: sleepStateView(updated) };
  await saveOperation(db, playerId, operationId, operationType, result);
  return result;
}

async function claimSleepReward(db, playerId, operationIdValue) {
  const operationId = validateOperationId(operationIdValue);
  const operationType = 'SLEEP_CLAIM';
  const replay = await operationReplay(db, playerId, operationId, operationType);
  if (replay) return replay;

  const row = await readSleepState(db, playerId, { lock: true });
  if (!row.active_cycle_id || row.reward_claimed) throw new Error('no sleep reward available');
  if (!row.sleep_ends_at || new Date(row.sleep_ends_at).getTime() > Date.now()) throw new Error('sleep cycle is not finished');

  const multiplier = Math.max(1, Number(row.reward_multiplier || 1));
  const reward = BASE_REWARD * multiplier;
  await db.query(
    `UPDATE players SET clean_money = clean_money + $2, updated_at = NOW() WHERE player_id = $1`,
    [playerId, reward],
  );
  await db.query(
    `UPDATE player_sleep_state
     SET active_cycle_id = NULL,
         reward_claimed = TRUE,
         reward_multiplier = 1,
         cooldown_until = NOW() + INTERVAL '${COOLDOWN_SECONDS} seconds',
         updated_at = NOW()
     WHERE player_id = $1`,
    [playerId],
  );
  await db.query(
    `INSERT INTO player_stats (player_id, sleep_count, sleep_money, time_spent, last_seen, updated_at)
     VALUES ($1, 1, $2, 24, NOW(), NOW())
     ON CONFLICT (player_id) DO UPDATE SET
       sleep_count = player_stats.sleep_count + 1,
       sleep_money = player_stats.sleep_money + $2,
       time_spent = player_stats.time_spent + 24,
       last_seen = NOW(), updated_at = NOW()`,
    [playerId, reward],
  );

  const updated = await readSleepState(db, playerId);
  const result = { ok: true, reward, multiplier, state: sleepStateView(updated) };
  await saveOperation(db, playerId, operationId, operationType, result);
  return result;
}

module.exports = {
  BASE_REWARD,
  claimSleepReward,
  readSleepState,
  sleepStateView,
  startSleepCycle,
};
