const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { REWARDS, TIER_WEIGHTS, pickWeightedReward, rewardPayout } = require('./roulette.cjs');

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

test('Roulette V2 keeps the exact server reward pool and unchanged tier weights', () => {
  assert.equal(Object.values(TIER_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(new Set(REWARDS.map((reward) => reward.name)).size, REWARDS.length);
  const rouletteUi = fs.readFileSync(path.join(__dirname, '../../src/components/RouletteDemo.tsx'), 'utf8');
  for (const reward of REWARDS) {
    assert.match(rouletteUi, new RegExp(reward.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(rouletteUi, /spinResult\.rewardName/);
  assert.match(rouletteUi, /spinResult\.player\.cleanMoney/);
  assert.match(rouletteUi, /spinResult\.player\.flowCoins/);
  assert.match(rouletteUi, /spinResult\.player\.rouletteFragments/);
});
