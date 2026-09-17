const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { CITY_XP_REWARDS, PILOT_ROUTE_XP } = require('../cityProgress/constants.cjs');
const { ACTIONS: CAYO_ACTIONS } = require('../gameplay/cayo.cjs');

const serverSource = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
const cityInstallSource = fs.readFileSync(path.join(__dirname, '../cityProgress/install.cjs'), 'utf8');

function endpointSource(route, nextRoute) {
  const start = serverSource.indexOf(route);
  assert.notEqual(start, -1, `Missing route ${route}`);
  const end = nextRoute ? serverSource.indexOf(nextRoute, start + route.length) : serverSource.length;
  assert.notEqual(end, -1, `Missing route ${nextRoute}`);
  return serverSource.slice(start, end);
}

test('audited careers use one exact Job XP and City XP amount', () => {
  assert.equal(CITY_XP_REWARDS.PIZZER_DELIVERY, 100);
  assert.equal(CITY_XP_REWARDS.FISHER_CATCH, 120);
  assert.equal(PILOT_ROUTE_XP.ROUTE_1, 120);
  assert.equal(PILOT_ROUTE_XP.ROUTE_2, 170);
  assert.equal(PILOT_ROUTE_XP.ROUTE_3, 240);
  assert.equal(PILOT_ROUTE_XP.ROUTE_4, 320);
  assert.equal(PILOT_ROUTE_XP.ROUTE_5, 450);
  assert.equal(CAYO_ACTIONS.COLLECT.xp, 15);
  assert.equal(CAYO_ACTIONS.PROCESS.xp, 25);
  assert.equal(CAYO_ACTIONS.REFINE.xp, 40);
});

test('Pizzer completion is normalized to exactly 100 Courier XP and 100 City XP', () => {
  const source = endpointSource("app.post('/api/pizzer/delivery/handover'", "app.get('/api/fisher/state'");
  assert.match(source, /pizzer_xp = \$3/);
  assert.match(source, /clean_money = clean_money \+ \$2/);
  assert.match(source, /totalReward,/);
  assert.match(source, /CITY_XP_REWARDS\.PIZZER_DELIVERY/);
  assert.match(cityInstallSource, /PIZZER_DELIVERY/);
  assert.match(cityInstallSource, /\/api\/pizzer\/orders\/options/);
  assert.match(cityInstallSource, /estimatedXp: CITY_XP_REWARDS\.PIZZER_DELIVERY/);
});

test('Fisher catch is normalized to exactly 120 Fisher XP and 120 City XP, then sale credits clean cash', () => {
  const catchSource = endpointSource("app.post('/api/fisher/dock/select'", "app.post('/api/fisher/spot/select'");
  const sellSource = endpointSource("app.post('/api/fisher/catch/sell'", "app.post('/api/fisher/rod/buy'");
  assert.match(catchSource, /fisher_xp = \$3/);
  assert.match(catchSource, /CITY_XP_REWARDS\.FISHER_CATCH/);
  assert.match(cityInstallSource, /\/api\/fisher\/spots\/options/);
  assert.match(cityInstallSource, /estimatedXp: CITY_XP_REWARDS\.FISHER_CATCH/);
  assert.match(sellSource, /clean_money = clean_money \+ \$2/);
  assert.match(sellSource, /soldValue: sellValue/);
  assert.match(sellSource, /carryEstimatedValue = 0/);
});

test('Pilot Route 4 uses exactly 320 Pilot XP and 320 City XP', () => {
  const source = endpointSource("app.post('/api/pilot/flight/complete'", "app.get('/api/pizzer/state'");
  assert.match(source, /pilot_xp = \$3/);
  assert.match(source, /clean_money = clean_money \+ \$2/);
  assert.match(source, /totalCash,/);
  assert.match(source, /totalXp,/);
  assert.match(source, /routeId: route\.id/);
  assert.match(cityInstallSource, /PILOT_ROUTE_XP\[routeId\]/);
});
