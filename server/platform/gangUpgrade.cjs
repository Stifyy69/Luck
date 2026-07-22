const crypto = require('crypto');
const { UPGRADE_COSTS, calculateStockValue, normalizeGangState } = require('./gangState.cjs');
const { withGangOperation } = require('./gangOperations.cjs');

function applyGangUpgrade(inputState) {
  const state = normalizeGangState(inputState);
  if (state.level >= 4) throw new Error('Gang-ul este deja Oficiala.');
  const cost = UPGRADE_COSTS[state.level - 1];
  if (state.dirtyBalance < cost.dirty) throw new Error('Gang Dirty Balance insuficient pentru upgrade.');
  for (const material of ['leaves', 'white', 'blue']) {
    if (state.resources[material] < cost[material]) throw new Error(`Stock ${material} insuficient pentru upgrade.`);
  }
  state.dirtyBalance -= cost.dirty;
  for (const material of ['leaves', 'white', 'blue']) state.resources[material] -= cost[material];
  state.level += 1;
  state.stockValue = calculateStockValue(state.resources);
  state.activityLog = [{ id: crypto.randomUUID(), type: 'upgrade', message: `Gang upgraded to level ${state.level}.`, details: { cost }, createdAt: new Date().toISOString() }, ...state.activityLog].slice(0, 100);
  return { state, cost, level: state.level };
}

function upgradeGang(pool, payload) {
  return withGangOperation(pool, { ...payload, operationType: 'upgrade' }, (state) => applyGangUpgrade(state));
}

module.exports = { applyGangUpgrade, upgradeGang };
