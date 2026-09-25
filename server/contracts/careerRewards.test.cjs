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

test('Pizzer completion stores exactly 100 Courier XP and 100 City XP at the endpoint', () => {
  const source = endpointSource("app.post('/api/pizzer/delivery/handover'", "app.get('/api/fisher/state'");
  assert.match(source, /const xpGained = hardFail \? 0 : CITY_XP_REWARDS\.PIZZER_DELIVERY/);
  assert.match(source, /pizzer_xp = \$3/);
  assert.match(source, /CITY_XP_REWARDS\.PIZZER_DELIVERY/);
  assert.doesNotMatch(source, /perfectBonusXp/);
  assert.match(cityInstallSource, /return \{ kind: 'pizzer', amount: CITY_XP_REWARDS\.PIZZER_DELIVERY \}/);
});

test('Fisher catch stores exactly 120 Fisher XP and 120 City XP, then sale credits clean cash', () => {
  const catchSource = endpointSource("app.post('/api/fisher/dock/select'", "app.post('/api/fisher/spot/select'");
  const sellSource = endpointSource("app.post('/api/fisher/catch/sell'", "app.post('/api/fisher/rod/buy'");
  assert.equal((serverSource.match(/const xpGained = CITY_XP_REWARDS\.FISHER_CATCH;/g) || []).length, 2);
  assert.match(catchSource, /fisher_xp = \$3/);
  assert.match(catchSource, /CITY_XP_REWARDS\.FISHER_CATCH/);
  assert.match(sellSource, /clean_money = clean_money \+ \$2/);
  assert.match(sellSource, /soldValue: sellValue/);
  assert.match(sellSource, /carryEstimatedValue = 0/);
});

test('Pilot career XP and City XP use their separate approved route amounts', () => {
  const source = endpointSource("app.post('/api/pilot/flight/complete'", "app.get('/api/pizzer/state'");
  assert.equal(PILOT_ROUTE_XP.ROUTE_4, 320);
  assert.equal(PILOT_ROUTE_XP.ROUTE_4_1, 300);
  assert.match(source, /const baseXp = Number\(route\.baseXp \|\| 0\)/);
  assert.match(source, /const totalXp = baseXp/);
  assert.match(source, /pilot_xp = \$3/);
  assert.match(source, /Number\(PILOT_ROUTE_XP\[route\.id\] \|\| CITY_XP_REWARDS\.PILOT_FLIGHT\)/);
  assert.match(cityInstallSource, /PILOT_ROUTE_XP\[routeId\]/);
  assert.match(cityInstallSource, /route\?\.baseXp \|\| PILOT_ROUTE_XP\[routeId\]/);
});
