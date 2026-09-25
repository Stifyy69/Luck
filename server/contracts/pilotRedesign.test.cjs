const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { routes } = require('../gameplay/pilotRoutes.cjs');
const { checkpointReady, legacyCredits } = require('../gameplay/pilotProgress.cjs');
const { PILOT_ROUTE_XP } = require('../cityProgress/constants.cjs');

const pilotLevel = (xp) => {
  let level = 1;
  for (let next = 2; next <= 50; next += 1) {
    if (xp >= Math.floor(120 * Math.pow(next - 1, 1.32) + (next - 1) * 40)) level = next;
  }
  return level;
};

test('Pilot V2 has exactly 390 sequential completions with strictly increasing rewards', () => {
  assert.equal(routes.length, 15);
  let cash = 0;
  let pilotXp = 0;
  let cityXp = 0;
  let seconds = 0;
  let previous = null;
  for (const [index, route] of routes.entries()) {
    assert.equal(route.id, `ROUTE_${Math.floor(index / 3) + 1}_${index % 3 + 1}`);
    assert.equal(route.requiredPreviousRouteId, previous?.id || null);
    assert.equal(route.requiredPreviousCompletions, previous?.progressionCompletions || 0);
    assert.equal(route.progressionCompletions, index < 12 ? 20 : 50);
    assert.ok(pilotLevel(pilotXp) >= route.unlockLevel, `${route.id} level blocks a player who completed the previous route`);
    assert.ok(route.stages.length >= 4);
    assert.ok(route.checkpointStageIndex >= 0 && route.checkpointStageIndex < route.stages.length);
    assert.ok(route.checkpointLabel);
    assert.equal(PILOT_ROUTE_XP[route.id], route.cityXp);
    if (previous) {
      assert.ok(route.baseReward > previous.baseReward);
      assert.ok(route.baseXp > previous.baseXp);
      assert.ok(route.cityXp > previous.cityXp);
      assert.ok(route.durationSeconds > previous.durationSeconds);
    }
    cash += route.baseReward * route.progressionCompletions;
    pilotXp += route.baseXp * route.progressionCompletions;
    cityXp += route.cityXp * route.progressionCompletions;
    seconds += route.durationSeconds * route.progressionCompletions;
    previous = route;
  }
  assert.equal(routes.reduce((sum, route) => sum + route.progressionCompletions, 0), 390);
  assert.equal(cash, 20_880_000);
  assert.equal(pilotXp, 22_830);
  assert.equal(cityXp, 112_200);
  assert.equal(seconds, 12_690);
  assert.equal(pilotLevel(pilotXp), 50);
});

test('legacy progress is capped per old route and credited once across the new sequence', () => {
  const credits = legacyCredits({
    route_1_completions: 50,
    route_2_completions: 25,
    route_3_completions: 25,
    route_4_completions: 25,
    route_5_completions: 25,
  });
  assert.equal(credits.reduce((sum, item) => sum + item.completions, 0), 125);
  assert.deepEqual(credits.slice(0, 7).map((item) => item.completions), [20, 20, 20, 20, 20, 20, 5]);
  assert.ok(credits.slice(7).every((item) => item.completions === 0));
});

test('a mission checkpoint cannot be confirmed before its stage has elapsed', () => {
  const route = routes[0];
  const flight = { startedAt: 1000 };
  const stageEnd = flight.startedAt + Math.floor((route.checkpointStageIndex + 1) * route.durationSeconds * 1000 / route.stages.length);
  assert.equal(checkpointReady(flight, route, stageEnd - 1), false);
  assert.equal(checkpointReady(flight, route, stageEnd), true);
});

test('Pilot completion requires the server checkpoint and persists route progress atomically', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
  const endpoint = source.split("app.post('/api/pilot/flight/complete'")[1].split("app.get('/api/pizzer/state'")[0];
  assert.match(endpoint, /!activeFlight\.checkpointCompleted/);
  assert.match(endpoint, /INSERT INTO player_pilot_route_progress/);
  assert.match(endpoint, /ON CONFLICT \(player_id, route_id\) DO UPDATE/);
  assert.match(endpoint, /const outcome = await withTransaction/);
});
