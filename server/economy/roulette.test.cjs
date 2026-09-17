const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { REWARDS, TIER_WEIGHTS, pickWeightedReward, rewardPayout } = require('./roulette.cjs');

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

const rouletteUi = fs.readFileSync(path.join(__dirname, '../../src/components/RouletteDemo.tsx'), 'utf8');
const rouletteFlow = fs.readFileSync(path.join(__dirname, './rouletteFlow.cjs'), 'utf8');
const platformInstall = fs.readFileSync(path.join(__dirname, '../platform/install.cjs'), 'utf8');

function functionSource(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `Missing ${endNeedle}`);
  return source.slice(start, end);
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

test('Roulette V2 keeps the exact reward pool and unchanged tier weights', () => {
  assert.equal(Object.values(TIER_WEIGHTS).reduce((sum, weight) => sum + weight, 0), 100);
  assert.equal(new Set(REWARDS.map((reward) => reward.name)).size, REWARDS.length);
  for (const reward of REWARDS) {
    assert.match(rouletteUi, new RegExp(reward.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(rouletteUi, /spinResult\.rewardName/);
});

test('roulette charges at start but grants only after the reveal claim', () => {
  const start = functionSource(rouletteFlow, 'async function startRouletteSpin', 'async function claimRouletteSpin');
  const claim = functionSource(rouletteFlow, 'async function claimRouletteSpin', 'function installRouletteFlow');

  assert.match(start, /roulette_pending_spins/);
  assert.match(start, /clean_money = clean_money - \$1/);
  assert.match(start, /flow_coins = flow_coins - \$1/);
  assert.match(start, /roulette_fragments = roulette_fragments - \$1/);
  assert.doesNotMatch(start, /clean_money = clean_money \+ \$1/);
  assert.doesNotMatch(start, /flow_coins = flow_coins \+ \$1/);
  assert.doesNotMatch(start, /roulette_fragments = roulette_fragments \+ \$1/);

  assert.match(claim, /ready_at/);
  assert.match(claim, /reveal not finished/);
  assert.match(claim, /clean_money = clean_money \+ \$1/);
  assert.match(claim, /flow_coins = flow_coins \+ \$1/);
  assert.match(claim, /roulette_fragments = roulette_fragments \+ \$1/);
  assert.match(claim, /INSERT INTO owned_vehicles/);
  assert.match(claim, /'ROULETTE'/);
  assert.match(claim, /addInventoryItem\(db, safePlayerId, spin\.reward_type, payout, metadata\)/);
  assert.match(claim, /claimed_at = NOW\(\)/);
});

test('roulette UI starts the reveal first and claims the reward after the animation', () => {
  assert.match(rouletteUi, /api\.rouletteStart/);
  assert.match(rouletteUi, /SPIN_DURATION_MS \+ 40/);
  assert.match(rouletteUi, /api\.rouletteClaim/);
  assert.doesNotMatch(rouletteUi, /api\.rouletteSpin\(/);
  assert.match(platformInstall, /installRouletteFlow\(app, requirePlayer, createRateLimiter\)/);
});
