const { normalizeGangState } = require('./gangState.cjs');

function validateOperationId(operationId) {
  if (typeof operationId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(operationId)) {
    throw new Error('operationId invalid.');
  }
}

function validatePlayerId(playerId) {
  if (typeof playerId !== 'string' || !/^[a-zA-Z0-9_-]{3,100}$/.test(playerId)) {
    throw new Error('playerId invalid.');
  }
}

async function readGang(pool, playerId) {
  validatePlayerId(playerId);
  const result = await pool.query('SELECT state, state_version FROM player_gangs WHERE player_id = $1', [playerId]);
  if (!result.rows[0]) return null;
  return { ...normalizeGangState(result.rows[0].state), stateVersion: Number(result.rows[0].state_version) };
}

async function bootstrapGang(pool, playerId, requestedState) {
  validatePlayerId(playerId);
  const state = normalizeGangState(requestedState);
  const result = await pool.query(
    `INSERT INTO player_gangs (player_id, state, state_version)
     VALUES ($1, $2::jsonb, 1)
     ON CONFLICT (player_id) DO UPDATE SET player_id = EXCLUDED.player_id
     RETURNING state, state_version`,
    [playerId, JSON.stringify(state)],
  );
  return { ...normalizeGangState(result.rows[0].state), stateVersion: Number(result.rows[0].state_version) };
}

async function withGangOperation(pool, { playerId, operationId, operationType }, mutate) {
  validatePlayerId(playerId);
  validateOperationId(operationId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`${playerId}:${operationId}`]);
    const duplicate = await client.query(
      'SELECT operation_type, result FROM player_gang_operations WHERE player_id = $1 AND operation_id = $2',
      [playerId, operationId],
    );
    if (duplicate.rows[0]) {
      if (duplicate.rows[0].operation_type !== operationType) throw new Error('operationId folosit pentru alt tip de operație.');
      await client.query('COMMIT');
      return { ...duplicate.rows[0].result, idempotentReplay: true };
    }

    const locked = await client.query('SELECT state, state_version FROM player_gangs WHERE player_id = $1 FOR UPDATE', [playerId]);
    if (!locked.rows[0]) throw new Error('Gang inexistent.');
    const current = normalizeGangState(locked.rows[0].state);
    const mutation = await mutate(current, client);
    const nextVersion = Number(locked.rows[0].state_version) + 1;
    const nextState = normalizeGangState(mutation.state);
    await client.query(
      'UPDATE player_gangs SET state = $2::jsonb, state_version = $3, updated_at = NOW() WHERE player_id = $1',
      [playerId, JSON.stringify(nextState), nextVersion],
    );
    const result = { ...mutation, state: { ...nextState, stateVersion: nextVersion }, stateVersion: nextVersion };
    await client.query(
      `INSERT INTO player_gang_operations (player_id, operation_id, operation_type, result)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [playerId, operationId, operationType, JSON.stringify(result)],
    );
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bootstrapGang, readGang, validateOperationId, validatePlayerId, withGangOperation };
