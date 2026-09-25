const HEAT_DECAY_MS = 15 * 60 * 1000;
const HEAT_DECAY_AMOUNT = 10;
const JAIL_DURATION_MS = 5 * 60 * 1000;

const HEAT_GAINS = Object.freeze({
  COLLECT: 8,
  PROCESS: 12,
  REFINE: 16,
  BULK: 10,
  DELIVERY_100: 15,
});

function effectiveHeat(row, now = Date.now()) {
  const heat = Math.max(0, Math.min(100, Number(row?.heat || 0)));
  const lastDecayAt = row?.heat_updated_at ? new Date(row.heat_updated_at).getTime() : now;
  const elapsed = Math.max(0, now - lastDecayAt);
  const ticks = Math.floor(elapsed / HEAT_DECAY_MS);
  const value = Math.max(0, heat - ticks * HEAT_DECAY_AMOUNT);
  return {
    value,
    // A new heat streak starts its own decay clock after the previous streak reached zero.
    updatedAt: value === 0 ? new Date(now) : new Date(lastDecayAt + ticks * HEAT_DECAY_MS),
  };
}

function raidRisk(heat) {
  const value = Math.max(0, Math.min(100, Number(heat || 0)));
  if (value < 20) return { chancePercent: 5, level: 'LOW' };
  if (value < 40) return { chancePercent: 10, level: 'GUARDED' };
  if (value < 60) return { chancePercent: 18, level: 'ELEVATED' };
  if (value < 80) return { chancePercent: 28, level: 'HIGH' };
  return { chancePercent: 40, level: 'CRITICAL' };
}

function heatAfterAction(heat, action, raided) {
  const increased = Math.min(100, heat + HEAT_GAINS[action]);
  return raided ? Math.max(60, increased) : increased;
}

function jailRemainingMs(row, now = Date.now()) {
  return row?.jailed_until ? Math.max(0, new Date(row.jailed_until).getTime() - now) : 0;
}

function assertNotJailed(row, now = Date.now()) {
  const remainingMs = jailRemainingMs(row, now);
  if (!remainingMs) return;
  const minutes = Math.floor(remainingMs / 60_000);
  const seconds = Math.ceil((remainingMs % 60_000) / 1_000);
  const error = new Error(`You are in jail. ${String(minutes + Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')} remaining.`);
  error.statusCode = 403;
  error.jailedUntil = new Date(row.jailed_until).toISOString();
  error.jailRemainingMs = remainingMs;
  throw error;
}

module.exports = {
  HEAT_GAINS,
  JAIL_DURATION_MS,
  assertNotJailed,
  effectiveHeat,
  heatAfterAction,
  jailRemainingMs,
  raidRisk,
};
