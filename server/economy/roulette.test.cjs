const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { REWARDS, TIER_WEIGHTS, pickWeightedReward, rewardPayout } = require('./roulette.cjs');

function sequence(...values) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

function rouletteRouteSource() {
  const serverSource = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
  const start = serverSource.indexOf("app.post('/api/roulette/spin'");
  const end = serverSource.indexOf("app.post('/api/mystery/open'", start);
  assert.notEqual(start, -1, 'Roulette spin route is missing');
  assert.notEqual(end, -1, 'Roulette route boundary is missing');
  return serverSource.slice(start, end);
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

test('every Roulette reward category has an atomic server grant path', () => {
  const route = rouletteRouteSource();
  assert.match(route, /clean_money = clean_money - \$1/);
  assert.match(route, /flow_coins = flow_coins - \$1/);
  assert.match(route, /roulette_fragments = roulette_fragments - \$1/);
  assert.match(route, /clean_money = clean_money \+ \$1/);
  assert.match(route, /flow_coins = flow_coins \+ \$1/);
  assert.match(route, /roulette_fragments = roulette_fragments \+ \$1/);
  assert.match(route, /INSERT INTO owned_vehicles/);
  assert.match(route, /purchase_source/);
  assert.match(route, /'ROULETTE'/);
  assert.match(route, /addInventoryItem\(db, playerId, reward\.rewardType, payout, metadata\)/);
  assert.match(route, /SELECT clean_money, flow_coins, roulette_fragments FROM players/);
});
