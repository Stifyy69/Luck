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

function checkpointReady(flight, route, now = Date.now()) {
  const stageEnd = Number(flight?.startedAt || 0)
    + Math.floor((route.checkpointStageIndex + 1) * route.durationSeconds * 1000 / route.stages.length);
  return now >= stageEnd;
}

module.exports = { checkpointReady, legacyCredits };
