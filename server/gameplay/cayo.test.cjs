const assert = require('node:assert/strict');
const test = require('node:test');

const { ACTIONS, validateOperationId } = require('./cayo.cjs');

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
