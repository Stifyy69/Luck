const test = require('node:test');
const assert = require('node:assert/strict');
const { withGangOperation } = require('./gangOperations.cjs');
const { defaultGangState } = require('./gangState.cjs');

function fakePool() {
  let state = defaultGangState('Atomic');
  state.resources.blue = 500;
  let version = 1;
  const operations = new Map();
  let updates = 0;
  const client = {
    async query(sql, args = []) {
      if (/^(BEGIN|COMMIT|ROLLBACK)/.test(sql)) return { rows: [] };
      if (sql.startsWith('SELECT pg_advisory')) return { rows: [] };
      if (sql.startsWith('SELECT operation_type')) return { rows: operations.has(args[1]) ? [operations.get(args[1])] : [] };
      if (sql.startsWith('SELECT state')) return { rows: [{ state, state_version: version }] };
      if (sql.startsWith('UPDATE player_gangs')) { state = JSON.parse(args[1]); version = args[2]; updates += 1; return { rows: [] }; }
      if (sql.includes('INSERT INTO player_gang_operations')) { operations.set(args[1], { operation_type: args[2], result: JSON.parse(args[3]) }); return { rows: [] }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release() {},
  };
  return { connect: async () => client, inspect: () => ({ state, version, updates }) };
}

test('same operationId is executed once and replay returns same state version', async () => {
  const pool = fakePool();
  const payload = { playerId: 'player_test', operationId: 'sell_abcdefgh', operationType: 'sell' };
  const mutate = (state) => { state.resources.blue -= 100; return { state, payout: 230_000 }; };
  const first = await withGangOperation(pool, payload, mutate);
  const replay = await withGangOperation(pool, payload, mutate);
  assert.equal(pool.inspect().state.resources.blue, 400);
  assert.equal(pool.inspect().updates, 1);
  assert.equal(first.stateVersion, 2);
  assert.equal(replay.stateVersion, 2);
  assert.equal(replay.idempotentReplay, true);
});
