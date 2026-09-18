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
const platformDb = fs.readFileSync(path.join(__dirname, '../platform/db.cjs'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');

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
  const start = functionSource(rouletteFlow, 'async function startRouletteSpin', 'async function getPendingRouletteSpin');
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

test('roulette start and claim are idempotent and a player cannot orphan multiple pending spins', () => {
  const start = functionSource(rouletteFlow, 'async function startRouletteSpin', 'async function getPendingRouletteSpin');
  const claim = functionSource(rouletteFlow, 'async function claimRouletteSpin', 'function installRouletteFlow');
  assert.match(start, /pg_advisory_xact_lock/);
  assert.match(start, /operation_id = \$2 FOR UPDATE/);
  assert.match(start, /claimed_at IS NULL/);
  assert.match(start, /return spinView\(pending\.rows\[0\]/);
  assert.match(claim, /if \(spin\.claimed_at && spin\.claim_result\) return spin\.claim_result/);
});

test('roulette pending schema is owned by the V2 flow and migrates the incompatible legacy table', () => {
  assert.doesNotMatch(platformDb, /CREATE TABLE IF NOT EXISTS roulette_pending_spins/);
  assert.equal(rouletteFlow.includes('DO ' + '$$'), true);
  assert.equal(rouletteFlow.includes('END ' + '$$' + ';'), true);
  assert.equal(rouletteFlow.includes('DO ' + '$' + '\n'), false);
  assert.match(rouletteFlow, /column_name = 'spin_token'/);
  assert.match(rouletteFlow, /DROP TABLE roulette_pending_spins/);
  assert.match(rouletteFlow, /spin_id TEXT PRIMARY KEY/);
  assert.match(rouletteFlow, /operation_id TEXT NOT NULL/);
  assert.match(rouletteFlow, /ready_at TIMESTAMPTZ NOT NULL/);
});

test('vehicle capacity is enforced at claim time so a reserved reward cannot bypass garage limits', () => {
  const metadata = functionSource(rouletteFlow, 'async function buildRewardMetadata', 'function spinView');
  const claim = functionSource(rouletteFlow, 'async function claimRouletteSpin', 'function installRouletteFlow');
  assert.doesNotMatch(metadata, /ensureVehicleCapacity/);
  assert.match(claim, /ensureVehicleCapacity\(db, safePlayerId\)/);
  assert.match(claim, /INSERT INTO owned_vehicles/);
});

test('roulette UI recovers a pending spin after refresh and retries the idempotent claim', () => {
  assert.match(rouletteUi, /api\.roulettePending/);
  assert.match(rouletteUi, /new Date\(pending\.readyAt\)/);
  assert.match(rouletteUi, /api\.rouletteClaim\(playerId, pending\.spinId\)/);
  assert.match(rouletteUi, /attempt < 4/);
  assert.match(rouletteUi, /api\.rouletteStart/);
  assert.match(rouletteUi, /SPIN_DURATION_MS \+ 40/);
  assert.doesNotMatch(rouletteUi, /api\.rouletteSpin\(/);
  assert.match(platformInstall, /installRouletteFlow\(app, requirePlayer, createRateLimiter\)/);
  assert.doesNotMatch(serverSource, /app\.post\('\/api\/roulette\/spin'/);
});

test('roulette V2 exposes start, pending recovery and claim endpoints', () => {
  assert.match(rouletteFlow, /app\.post\('\/api\/roulette\/start'/);
  assert.match(rouletteFlow, /app\.get\('\/api\/roulette\/pending'/);
  assert.match(rouletteFlow, /app\.post\('\/api\/roulette\/claim'/);
  assert.match(rouletteFlow, /app\.post\('\/api\/roulette\/spin'/);
  assert.match(rouletteFlow, /status\(410\)/);
});
