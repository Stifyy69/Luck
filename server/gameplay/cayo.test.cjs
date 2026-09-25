const assert = require('node:assert/strict');
const test = require('node:test');

const { ACTIONS, convertCayoCash, runCayoAction, sellCayoProduct, validateOperationId } = require('./cayo.cjs');
const {
  HEAT_GAINS,
  assertNotJailed,
  effectiveHeat,
  heatAfterAction,
  raidRisk,
} = require('./cayoHeat.cjs');

test('Cayo recipes are server-owned and conserve their declared inputs', () => {
  assert.deepEqual(Object.keys(ACTIONS), ['COLLECT', 'PROCESS', 'REFINE']);
  assert.equal(ACTIONS.PROCESS.leavesCost, ACTIONS.COLLECT.leavesGain);
  assert.equal(ACTIONS.REFINE.whiteCost, ACTIONS.PROCESS.whiteGain);
  assert.equal(ACTIONS.REFINE.blueGain, 800);
});

test('Cayo operation ids are retry-safe and reject unsafe values', () => {
  assert.equal(validateOperationId('cayo_550e8400e29b41d4a716446655440000'), 'cayo_550e8400e29b41d4a716446655440000');
  assert.throws(() => validateOperationId('../unsafe'), /operationId invalid/);
});

test('Heat bands, action gains, decay and the 60 Heat raid floor follow the approved curve', () => {
  assert.deepEqual(HEAT_GAINS, { COLLECT: 8, PROCESS: 12, REFINE: 16, BULK: 10, DELIVERY_100: 15 });
  for (const [heat, chance] of [[0, 5], [19, 5], [20, 10], [39, 10], [40, 18], [59, 18], [60, 28], [72, 28], [79, 28], [80, 40], [100, 40]]) {
    assert.equal(raidRisk(heat).chancePercent, chance);
  }
  const at = Date.parse('2026-09-25T12:00:00Z');
  const row = { heat: 72, heat_updated_at: new Date(at) };
  assert.equal(effectiveHeat(row, at + 14 * 60_000).value, 72);
  assert.equal(effectiveHeat(row, at + 15 * 60_000).value, 62);
  const cooled = effectiveHeat(row, at + 31 * 60_000);
  assert.equal(cooled.value, 52);
  assert.equal(cooled.updatedAt.getTime(), at + 30 * 60_000);
  assert.equal(effectiveHeat(row, at + 120 * 60_000).value, 0);
  assert.equal(heatAfterAction(52, 'BULK', false), 62);
  assert.equal(heatAfterAction(2, 'COLLECT', true), 60);
  assert.equal(heatAfterAction(96, 'REFINE', true), 100);
});

function fakeCayoDb(initial = {}) {
  const state = {
    leaves: 1200, white_packs: 400, blue_packs: 600, dirty_money: 900_000,
    clean_money: 1_000_000, city_xp: 25_000, heat: 0,
    heat_updated_at: new Date(), jailed_until: null, jail_reason: null,
    ...initial,
  };
  const operations = new Map();
  const queries = [];
  return {
    state, operations, queries,
    async query(sql, args = []) {
      queries.push(sql);
      if (sql.includes('FROM player_economy_operations')) {
        const saved = operations.get(args[1]);
        return { rows: saved ? [{ operation_type: saved.type, result: saved.result }] : [] };
      }
      if (sql.includes('SELECT city_xp FROM player_city_progress')) return { rows: [{ city_xp: state.city_xp }] };
      if (sql.includes('FROM player_cayo_state cs')) return { rows: [{ ...state }] };
      if (sql.includes('FROM active_boosts')) return { rows: [{ active: false }] };
      if (sql.includes('UPDATE players SET clean_money = clean_money -')) {
        state.clean_money -= args[1];
        return { rows: [{ clean_money: state.clean_money }] };
      }
      if (sql.includes('SET leaves = leaves -')) {
        state.leaves += -args[1] + args[2];
        state.white_packs += -args[3] + args[4];
        state.blue_packs += args[5];
        state.dirty_money -= args[6];
      }
      if (sql.includes('SET blue_packs = blue_packs -')) {
        state.blue_packs -= args[1];
        state.dirty_money += args[2];
      }
      if (sql.includes('SET heat =')) {
        state.heat = args[1];
        state.heat_updated_at = args[2];
      }
      if (sql.includes('SET jailed_until =')) {
        state.jailed_until = args[1];
        state.jail_reason = 'CAYO_RAID';
      }
      if (sql.includes('INSERT INTO player_economy_operations')) {
        operations.set(args[1], { type: args[2], result: JSON.parse(args[3]) });
      }
      return { rows: [] };
    },
  };
}

test('raid removes only the attempted production inputs, persists Heat and jail, and replay does not repeat the debit', async () => {
  const db = fakeCayoDb({ heat: 20 });
  const result = await runCayoAction(db, 'player1', 'PROCESS', 'process_operation_1', false, () => 0.05);
  const restrictionLockIndex = db.queries.findIndex((sql) => sql.includes('SELECT 1 FROM player_restrictions') && sql.includes('FOR UPDATE'));
  const resourcesLockIndex = db.queries.findIndex((sql) => sql.includes('FROM player_cayo_state cs') && sql.includes('FOR UPDATE OF cs, p'));
  assert.ok(restrictionLockIndex >= 0 && restrictionLockIndex < resourcesLockIndex);
  assert.equal(result.raided, true);
  assert.equal(result.state.leaves, 0);
  assert.equal(result.state.whitePacks, 400);
  assert.equal(result.state.dirtyMoney, 0);
  assert.equal(result.state.heat, 60);
  assert.ok(result.state.jailRemainingMs > 0);
  assert.ok(result.state.jailRemainingMs <= 5 * 60_000);
  const replay = await runCayoAction(db, 'player1', 'PROCESS', 'process_operation_1', false, () => 1);
  assert.equal(replay.idempotentReplay, true);
  assert.equal(db.state.leaves, 0);
  await assert.rejects(
    runCayoAction(db, 'player1', 'COLLECT', 'collect_operation_1', false, () => 1),
    /You are in jail/,
  );
  await assert.rejects(sellCayoProduct(db, 'player1', 'BULK', 'bulk_operation_123', () => 1), /You are in jail/);
  await assert.rejects(convertCayoCash(db, 'player1', 'convert_operation_1'), /You are in jail/);
  assert.throws(() => assertNotJailed(db.state), /You are in jail/);
  assert.equal(db.operations.size, 1);
});

test('bulk sale is exposed to raids and loses only the offered stock without paying dirty cash', async () => {
  const db = fakeCayoDb({ heat: 80 });
  const result = await sellCayoProduct(db, 'player1', 'BULK', 'bulk_operation_123', () => 0.3);
  assert.equal(result.raided, true);
  assert.equal(result.quantity, 600);
  assert.equal(result.payout, 0);
  assert.equal(result.state.bluePacks, 0);
  assert.equal(result.state.dirtyMoney, 900_000);
  assert.equal(result.state.heat, 90);
  assert.ok(result.state.jailRemainingMs > 0);
});
