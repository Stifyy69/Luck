const test = require('node:test');
const assert = require('node:assert/strict');
const { applyProcess, applySell, defaultGangState } = require('./gangState.cjs');
const { applyGangUpgrade } = require('./gangUpgrade.cjs');

function state(resources = {}) {
  const result = defaultGangState('Test Gang');
  result.dirtyBalance = 1_000_000_000;
  Object.assign(result.resources, resources);
  result.members = [{ id: 'm1', displayName: 'Test', status: 'Available', loyalty: 80, level: 1, xp: 0, xpNeeded: 100, skills: { shooting: 10, tactics: 10, leadership: 10, streetSmart: 10, farming: 10, recruiting: 10 } }];
  return result;
}

test('Sell X removes exact blue stock and awards dirty once in returned state', () => {
  const result = applySell(state({ blue: 500 }), 'blue', 100);
  assert.equal(result.state.resources.blue, 400);
  assert.equal(result.payout, 230_000);
  assert.equal(result.state.dirtyBalance, 1_000_230_000);
  assert.equal(result.state.totalDirtyEarned, 230_000);
});

test('Sell All removes all gunpowder', () => {
  const result = applySell(state({ gunpowder: 200 }), 'gunpowder', 'all');
  assert.equal(result.state.resources.gunpowder, 0);
  assert.equal(result.payout, 1_000_000);
});

test('processing 100 batches converts only selected sulfur into gunpowder', () => {
  const result = applyProcess(state({ sulfur: 2_000 }), 'gunpowder', 100, { forceRaid: false });
  assert.equal(result.state.resources.sulfur, 1_500);
  assert.equal(result.state.resources.gunpowder, 100);
});

test('forced raid loses only selected batch input', () => {
  const result = applyProcess(state({ sulfur: 2_000, gunpowder: 20 }), 'gunpowder', 100, { forceRaid: true });
  assert.equal(result.state.resources.sulfur, 1_500);
  assert.equal(result.state.resources.gunpowder, 20);
  assert.equal(result.raided, true);
});

test('repeating same work applies 5 loyalty fatigue penalty on second completion', () => {
  const first = applyProcess(state({ sulfur: 100 }), 'gunpowder', 1, { forceRaid: false });
  const second = applyProcess(first.state, 'gunpowder', 1, { forceRaid: false });
  assert.equal(second.state.members[0].loyalty, 75);
  assert.deepEqual(second.state.members[0].fatigue, { activity: 'gunpowder', count: 0 });
});

test('gang upgrade consumes dirty and all required resources atomically', () => {
  const before = state({ leaves: 10_000, white: 10_000, blue: 10_000 });
  const result = applyGangUpgrade(before);
  assert.equal(result.state.level, 2);
  assert.equal(result.state.dirtyBalance, 700_000_000);
  assert.equal(result.state.resources.leaves, 0);
  assert.equal(result.state.resources.white, 0);
  assert.equal(result.state.resources.blue, 0);
});
