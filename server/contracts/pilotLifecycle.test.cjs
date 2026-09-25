const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const { completePilotSession } = require('../gameplay/pilotSession.cjs');

test('completing a flight leaves the shift ready for another route and preserves its reward report', () => {
  const flight = { sessionId: 'flight-1', routeId: 'ROUTE_1', completing: true };
  const result = { sessionId: flight.sessionId, routeId: flight.routeId, completed: true };
  const previous = {
    shiftState: 'FLIGHT_STAGE_PROGRESS',
    selectedRouteId: flight.routeId,
    activeFlight: flight,
    lastResult: null,
    cooldownUntil: 0,
    lastActionAt: 1234,
  };

  const next = completePilotSession(previous, result);
  assert.equal(next.shiftState, 'SELECTING_ROUTE');
  assert.equal(next.selectedRouteId, null);
  assert.equal(next.activeFlight, null);
  assert.deepEqual(next.lastResult, result);
  assert.equal(next.cooldownUntil, 0);
  assert.equal(next.lastActionAt, 1234);
  assert.equal(previous.activeFlight, flight);
});

test('state polling cannot overwrite a flight completion with an older session snapshot', () => {
  const source = fs.readFileSync(path.join(__dirname, '../../server.cjs'), 'utf8');
  const start = source.indexOf("app.get('/api/pilot/state'");
  const end = source.indexOf("app.post('/api/pilot/shift/start'", start);
  assert.ok(start >= 0 && end > start);
  const endpoint = source.slice(start, end);
  assert.match(endpoint, /getPilotSession\(playerId\)/);
  assert.doesNotMatch(endpoint, /setPilotSession\(/);
});
