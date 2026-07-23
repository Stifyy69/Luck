const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { CITY_XP_REWARDS } = require('../cityProgress/constants.cjs');
const { ACTIONS: CAYO_ACTIONS } = require('../gameplay/cayo.cjs');

const serverSource = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');

function endpointSource(route, nextRoute) {
  const start = serverSource.indexOf(route);
  assert.notEqual(start, -1, `Missing route ${route}`);
  const end = nextRoute ? serverSource.indexOf(nextRoute, start + route.length) : serverSource.length;
  assert.notEqual(end, -1, `Missing route ${nextRoute}`);
  return serverSource.slice(start, end);
}

test('City XP amounts are fixed for every audited career action', () => {
  assert.equal(CITY_XP_REWARDS.PIZZER_DELIVERY, 100);
  assert.equal(CITY_XP_REWARDS.FISHER_CATCH, 80);
  assert.equal(CITY_XP_REWARDS.PILOT_FLIGHT, 220);
  assert.equal(CAYO_ACTIONS.COLLECT.xp, 15);
  assert.equal(CAYO_ACTIONS.PROCESS.xp, 25);
  assert.equal(CAYO_ACTIONS.REFINE.xp, 40);
});

test('Pizzer completion stores the exact career XP and clean cash returned in the result', () => {
  const source = endpointSource("app.post('/api/pizzer/delivery/handover'", "app.get('/api/fisher/state'");
  assert.match(source, /pizzer_xp = \$3/);
  assert.match(source, /clean_money = clean_money \+ \$2/);
  assert.match(source, /totalReward,/);
  assert.match(source, /xpGained,/);
  assert.match(source, /CITY_XP_REWARDS\.PIZZER_DELIVERY/);
});

test('Fisher catch stores career XP and Fisher sale credits the returned clean payout', () => {
  const catchSource = endpointSource("app.post('/api/fisher/dock/select'", "app.post('/api/fisher/spot/select'");
  const sellSource = endpointSource("app.post('/api/fisher/catch/sell'", "app.post('/api/fisher/rod/buy'");
  assert.match(catchSource, /fisher_xp = \$3/);
  assert.match(catchSource, /CITY_XP_REWARDS\.FISHER_CATCH/);
  assert.match(sellSource, /clean_money = clean_money \+ \$2/);
  assert.match(sellSource, /soldValue: sellValue/);
  assert.match(sellSource, /carryEstimatedValue = 0/);
});

test('Pilot completion stores the exact Pilot XP and clean cash returned in the result', () => {
  const source = endpointSource("app.post('/api/pilot/flight/complete'", "app.get('/api/pizzer/state'");
  assert.match(source, /pilot_xp = \$3/);
  assert.match(source, /clean_money = clean_money \+ \$2/);
  assert.match(source, /totalCash,/);
  assert.match(source, /totalXp,/);
  assert.match(source, /CITY_XP_REWARDS\.PILOT_FLIGHT/);
});
