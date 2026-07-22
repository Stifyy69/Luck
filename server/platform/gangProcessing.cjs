const { applyProcess } = require('./gangState.cjs');
const { withGangOperation } = require('./gangOperations.cjs');

function processGangStock(pool, payload, options = {}) {
  return withGangOperation(pool, { ...payload, operationType: 'process' }, (state) => applyProcess(state, payload.recipe, payload.batches, options));
}

module.exports = { processGangStock };
