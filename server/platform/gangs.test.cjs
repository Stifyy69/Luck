const assert = require('node:assert/strict');
const test = require('node:test');

const { stockValueFor, validateOperationId } = require('./gangs.cjs');

test('operation ids accept retry-safe UUID-based values and reject unsafe input', () => {
  assert.doesNotThrow(() => validateOperationId('sell_550e8400e29b41d4a716446655440000'));
  assert.throws(() => validateOperationId('short'), /operationId invalid/);
  assert.throws(() => validateOperationId('sell/unsafe/value'), /operationId invalid/);
});

test('gang stock value includes every legacy and gang progression resource', () => {
  assert.equal(stockValueFor({
    leaves: 1, whitePacks: 1, bluePacks: 1, sulfur: 1,
    ironOre: 1, gunpowder: 1, steel: 1,
  }), 16_500);
});
