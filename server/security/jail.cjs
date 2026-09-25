const { requireAuthenticatedPlayer } = require('./userAuth.cjs');

const CAREER_PREFIXES = ['/api/pizzer', '/api/fisher', '/api/pilot', '/api/cayo', '/api/sleep'];
const CLEANUP_ROUTES = new Set([
  '/api/pizzer/shift/end',
  '/api/fisher/shift/end',
  '/api/pilot/shift/end',
  '/api/pilot/flight/cancel',
]);
const GANG_JOB_ROUTES = new Set([
  '/api/gangs/work',
  '/api/gangs/process',
  '/api/gangs/sell',
  '/api/gangs/battle',
  '/api/gangs/funds/launder',
]);

function isJobMutation(method, path) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(String(method).toUpperCase())) return false;
  if (CLEANUP_ROUTES.has(path)) return false;
  if (GANG_JOB_ROUTES.has(path)) return true;
  return CAREER_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function jailStatus(row, now = Date.now()) {
  const until = row?.jailed_until ? new Date(row.jailed_until) : null;
  const remainingMs = until ? Math.max(0, until.getTime() - now) : 0;
  return {
    jailed: remainingMs > 0,
    jailedUntil: remainingMs ? until.toISOString() : null,
    jailReason: remainingMs ? row.jail_reason || null : null,
    remainingMs,
  };
}

function jailMessage(status) {
  const remainingSeconds = Math.ceil(status.remainingMs / 1000);
  return `You are in jail. ${String(Math.floor(remainingSeconds / 60)).padStart(2, '0')}:${String(remainingSeconds % 60).padStart(2, '0')} remaining.`;
}

async function readJailStatus(db, playerId, { lock = false } = {}) {
  if (lock) {
    await db.query(
      `INSERT INTO player_restrictions (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [playerId],
    );
  }
  const result = await db.query(
    `SELECT jailed_until, jail_reason FROM player_restrictions WHERE player_id = $1${lock ? ' FOR UPDATE' : ''}`,
    [playerId],
  );
  return jailStatus(result.rows[0]);
}

async function assertJobAvailable(db, playerId) {
  const status = await readJailStatus(db, playerId, { lock: true });
  if (!status.jailed) return;
  const error = new Error(jailMessage(status));
  error.statusCode = 403;
  error.jail = status;
  throw error;
}

function installJailGuard(app, db) {
  const requirePlayer = requireAuthenticatedPlayer(db);

  app.get('/api/jail/state', requirePlayer, async (req, res) => {
    try {
      return res.json({ jail: await readJailStatus(db, req.playerId) });
    } catch (error) {
      console.error('[jail] state failed', error);
      return res.status(503).json({ error: 'jail state unavailable' });
    }
  });

  app.use((req, res, next) => {
    if (!isJobMutation(req.method, req.path)) return next();
    return requirePlayer(req, res, async () => {
      try {
        const status = await readJailStatus(db, req.playerId);
        if (!status.jailed) return next();
        return res.status(403).json({ error: jailMessage(status), code: 'PLAYER_JAILED', jail: status });
      } catch (error) {
        console.error('[jail] job guard failed', error);
        return res.status(503).json({ error: 'jail state unavailable' });
      }
    });
  });
}

module.exports = { assertJobAvailable, installJailGuard, isJobMutation, jailMessage, jailStatus, readJailStatus };
