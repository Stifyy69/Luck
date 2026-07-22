const { applySell } = require('./gangState.cjs');
const { withGangOperation } = require('./gangOperations.cjs');

function sellGangStock(pool, payload) {
  return withGangOperation(pool, { ...payload, operationType: 'sell' }, (state) => applySell(state, payload.material, payload.quantity));
}

module.exports = { sellGangStock };
