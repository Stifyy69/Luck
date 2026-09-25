const { routes } = require('./pilotRoutes.cjs');

function legacyCredits(row) {
  const total = [1, 2, 3, 4, 5].reduce((sum, index) =>
    sum + Math.min(25, Math.max(0, Math.floor(Number(row?.[`route_${index}_completions`]) || 0))), 0);
  let remaining = total;
  return routes.map((route) => {
    const credited = Math.min(route.progressionCompletions, remaining);
    remaining -= credited;
    return { routeId: route.id, completions: credited };
  });
}

function creditedPilotCompletions(routeRows, legacyRow = null) {
  const current = new Map(routeRows.map((row) => [row.route_id, Number(row.completions)]));
  const pendingLegacy = legacyRow?.pilot_route_v2_migrated === false
    ? new Map(legacyCredits(legacyRow).map((credit) => [credit.routeId, credit.completions]))
    : new Map();
  return routes.reduce((sum, route) => sum + Math.min(
    route.progressionCompletions,
    Math.max(0, current.get(route.id) || 0, pendingLegacy.get(route.id) || 0),
  ), 0);
}

function checkpointReady(flight, route, now = Date.now()) {
  const stageEnd = Number(flight?.startedAt || 0)
    + Math.floor((route.checkpointStageIndex + 1) * route.durationSeconds * 1000 / route.stages.length);
  return now >= stageEnd;
}

module.exports = { checkpointReady, creditedPilotCompletions, legacyCredits };
