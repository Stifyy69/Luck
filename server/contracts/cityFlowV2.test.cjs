const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const {
  CAREER_75_PERCENT_XP,
  CAREER_MAX_LEVEL_XP,
  CITY_LEVEL_START_XP,
  PILOT_75_PERCENT_COMPLETIONS,
  PILOT_TOTAL_ROUTE_COMPLETIONS,
  buildCareerAccess,
} = require('../cityProgress/constants.cjs');
const { STARTING_CLEAN_MONEY } = require('../platform/constants.cjs');

const apiSource = fs.readFileSync(path.join(__dirname, '../../src/lib/api.ts'), 'utf8');
const serverSource = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
const pizzerSource = fs.readFileSync(path.join(__dirname, '../../src/components/PizzerPage.tsx'), 'utf8');
const fisherSource = fs.readFileSync(path.join(__dirname, '../../src/components/FisherPage.tsx'), 'utf8');
const hudSource = fs.readFileSync(path.join(__dirname, '../../src/components/city/CityProgressHud.tsx'), 'utf8');
const controlsSource = fs.readFileSync(path.join(__dirname, '../../src/components/city/CareerQuickControls.tsx'), 'utf8');
const sidebarSource = fs.readFileSync(path.join(__dirname, '../../src/components/app/AppSidebar.tsx'), 'utf8');
const leaderboardSource = fs.readFileSync(path.join(__dirname, '../../src/components/leaderboards/LeaderboardEntries.tsx'), 'utf8');
const stockSource = fs.readFileSync(path.join(__dirname, '../platform/vehicleStock.cjs'), 'utf8');
const platformDbSource = fs.readFileSync(path.join(__dirname, '../platform/db.cjs'), 'utf8');

test('main career unlock curve is slower than the old city progression', () => {
  assert.equal(CITY_LEVEL_START_XP[3], 2_000);
  assert.equal(CITY_LEVEL_START_XP[6], 9_000);
  assert.equal(CITY_LEVEL_START_XP[10], 25_000);
  assert.equal(CITY_LEVEL_START_XP[15], 65_000);
});

test('each new unlock requires 75% of the previous career progression and its City level', () => {
  assert.equal(CAREER_MAX_LEVEL_XP, 22_388);
  assert.equal(CAREER_75_PERCENT_XP, 16_791);
  assert.equal(PILOT_TOTAL_ROUTE_COMPLETIONS, 390);
  assert.equal(PILOT_75_PERCENT_COMPLETIONS, 293);

  for (const [key, cityLevel, progressKey, threshold] of [
    ['fisher', 3, 'pizzerXp', CAREER_75_PERCENT_XP],
    ['pilot', 6, 'fisherXp', CAREER_75_PERCENT_XP],
    ['cayo', 10, 'pilotRouteCompletions', PILOT_75_PERCENT_COMPLETIONS],
  ]) {
    assert.equal(buildCareerAccess(cityLevel, false, { [progressKey]: threshold - 1 })[key].unlocked, false);
    assert.equal(buildCareerAccess(cityLevel - 1, false, { [progressKey]: threshold })[key].unlocked, false);
    assert.equal(buildCareerAccess(cityLevel, false, { [progressKey]: threshold })[key].unlocked, true);
    assert.equal(buildCareerAccess(cityLevel, false, { [progressKey]: threshold })[key].reason, null);
    assert.equal(buildCareerAccess(1, false, { legacyGrants: { [key]: true } })[key].unlocked, true);
  }
});

test('Pizza Courier receives a random delivery directly from the server instead of route selection', () => {
  assert.match(serverSource, /function buildActivePizzerOrder\(level\)/);
  assert.match(serverSource, /shiftState: 'DELIVERY_ACTIVE'/);
  assert.match(serverSource, /activeOrder: buildActivePizzerOrder\(progressView\.level\)/);
  assert.match(serverSource, /session\.activeOrder = buildActivePizzerOrder\(progressAfter\.level\)/);
  assert.doesNotMatch(apiSource, /autoDispatchPizzer/);
  assert.doesNotMatch(pizzerSource, /Dispatch board/);
  assert.doesNotMatch(pizzerSource, /Accept and prepare/);
});

test('Pizzer and Fisher show full-screen activity stages before the shared reward result', () => {
  assert.match(pizzerSource, /fixed inset-0 z-\[120\]/);
  assert.match(pizzerSource, /PIZZER_ACTIVITY_STAGES/);
  assert.match(pizzerSource, /Packing pizzas/);
  assert.match(pizzerSource, /Driving to customer/);
  assert.match(pizzerSource, /Customer reached/);
  assert.match(pizzerSource, /'Complete'/);
  assert.match(pizzerSource, /Complete & end shift/);
  assert.match(pizzerSource, /handover\(false\)/);
  assert.match(pizzerSource, /handover\(true\)/);
  assert.match(pizzerSource, /api\.pizzerShiftEnd\(playerId\)/);
  assert.match(pizzerSource, /btn-danger/);
  assert.match(fisherSource, /fixed inset-0 z-\[120\]/);
  assert.match(fisherSource, /FISHER_ACTIVITY_STAGES/);
  assert.match(fisherSource, /Preparing bait/);
  assert.match(fisherSource, /Waiting for bite/);
  assert.match(fisherSource, /Reeling catch/);
  assert.match(fisherSource, /Landing fish/);
});

test('Pizzer, Fisher and Pilot share full-screen reward feedback and explicit stop controls', () => {
  assert.match(hudSource, /fixed inset-0 z-\[210\]/);
  assert.match(hudSource, /careerReceipt\.careerXp/);
  assert.match(hudSource, /careerReceipt\.cityXp/);
  assert.match(controlsSource, /Stop fishing/);
  assert.match(controlsSource, /Cancel flight/);
  assert.match(controlsSource, /pilotFlightCancel/);
  assert.match(controlsSource, /fisherShiftEnd/);
});

test('new accounts start from one shared 69 dollar constant without rewriting existing balances', () => {
  assert.equal(STARTING_CLEAN_MONEY, 69);
  assert.match(platformDbSource, /SET DEFAULT \$\{STARTING_CLEAN_MONEY\}/);
  assert.match(platformDbSource, /\[playerId, STARTING_CLEAN_MONEY\]/);
  assert.match(serverSource, /DEFAULT \$\{STARTING_CLEAN_MONEY\}/);
  assert.doesNotMatch(serverSource, /DEFAULT 1000000/);
  assert.doesNotMatch(sidebarSource, /Control Center/);
});

test('leaderboard context does not always show deliveries, catches and flights together', () => {
  assert.match(leaderboardSource, /function playerContextStats/);
  assert.match(leaderboardSource, /metric === 'fishing'/);
  assert.match(leaderboardSource, /metric === 'aviation'/);
  assert.doesNotMatch(leaderboardSource, /<span>\{player\.deliveries\} deliveries<\/span><span>\{player\.catches\} catches<\/span><span>\{player\.flights\} flights<\/span>/);
});

test('vehicle stock supports all, selected and rank bulk updates', () => {
  assert.match(stockSource, /\['all', 'selected', 'rank'\]/);
  assert.match(stockSource, /scope === 'rank'/);
  assert.match(stockSource, /scope === 'selected'/);
  assert.match(stockSource, /VEHICLE_STOCK_BULK/);
});
