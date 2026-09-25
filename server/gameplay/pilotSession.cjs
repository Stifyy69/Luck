function completePilotSession(session, result) {
  return {
    ...session,
    shiftState: 'SELECTING_ROUTE',
    selectedRouteId: null,
    activeFlight: null,
    lastResult: result,
  };
}

module.exports = { completePilotSession };
