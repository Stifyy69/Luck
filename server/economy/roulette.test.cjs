const assert = require('node:assert/strict');
const test = require('node:test');

const { REWARDS, pickWeightedReward, rewardPayout } = require('./roulette.cjs');

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

test('weighted selection reaches rewards in every tier', () => {
  assert.equal(pickWeightedReward(sequence(0.01, 0)).rewardType, 'SOUVENIR_VEHICLE');
  assert.equal(pickWeightedReward(sequence(0.05, 0)).rewardType, 'VIP_GOLD');
  assert.equal(pickWeightedReward(sequence(0.15, 0)).rewardType, 'ROULETTE_FRAGMENTS');
  assert.equal(pickWeightedReward(sequence(0.4, 0)).rewardType, 'JOB_BOOST_PILOT');
  assert.equal(pickWeightedReward(sequence(0.99, 0.99)).rewardType, 'CASH');
});

test('inventory rewards always grant bounded quantities', () => {
  const mystery = REWARDS.find((reward) => reward.rewardType === 'MYSTERY_BOX');
  const xenon = REWARDS.find((reward) => reward.rewardType === 'XENON_VEHICLE');
  assert.equal(rewardPayout(mystery), 1);
  assert.equal(rewardPayout(xenon), 1);
  const cash = REWARDS.find((reward) => reward.rewardType === 'CASH');
  assert.equal(rewardPayout(cash, () => 0), 25_000);
  assert.equal(rewardPayout(cash, () => 0.999999), 50_000);
});
