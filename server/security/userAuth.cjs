const crypto = require('crypto');

const COOKIE_NAME = 'cityflow_user_token';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
const configuredSecret = String(process.env.USER_SECRET || '').trim();
const developmentSecret = crypto.randomBytes(32).toString('hex');

function userAuthConfigurationReady() {
  return process.env.NODE_ENV !== 'production' || configuredSecret.length >= 32;
}

function sessionSecret() {
  if (!userAuthConfigurationReady()) {
    throw new Error('USER_SECRET must contain at least 32 characters in production');
  }
  return configuredSecret || developmentSecret;
}

function signUserToken(userId, expiresAt) {
  const value = `${userId}|${expiresAt}`;
  const signature = crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
  return `${value}.${signature}`;
}

function verifyUserToken(token) {
  if (!token || !userAuthConfigurationReady()) return null;
  const [value, signature] = String(token).split('.');
  if (!value || !signature) return null;

  const expected = crypto.createHmac('sha256', sessionSecret()).update(value).digest('hex');
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  const [rawUserId, rawExpiresAt] = value.split('|');
  const userId = Number(rawUserId);
  const expiresAt = Number(rawExpiresAt);
  if (!Number.isSafeInteger(userId) || userId <= 0 || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return null;
  }
  return userId;
}

function createUserSession(res, userId) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;
  res.cookie(COOKIE_NAME, signUserToken(userId, expiresAt), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_DURATION_MS,
    path: '/',
  });
}

function clearUserSession(res) {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
}

async function authenticateUserRequest(req, db) {
  const userId = verifyUserToken(req.cookies?.[COOKIE_NAME]);
  if (!userId) return null;
  const result = await db.query(
    `SELECT id, username, email, player_id, is_guest FROM users WHERE id = $1`,
    [userId],
  );
  const user = result.rows[0];
  if (!user?.player_id) return null;
  return {
    id: Number(user.id),
    username: user.username,
    email: user.email,
    playerId: String(user.player_id),
    isGuest: Boolean(user.is_guest),
  };
}

function requestedPlayerId(req) {
  return String(req.body?.playerId || req.query?.playerId || '').trim();
}

function requireAuthenticatedPlayer(db) {
  return async (req, res, next) => {
    try {
      if (!db) return res.status(503).json({ error: 'database unavailable' });
      const user = req.authUser || await authenticateUserRequest(req, db);
      if (!user) return res.status(401).json({ error: 'authentication required' });

      const suppliedPlayerId = requestedPlayerId(req);
      if (suppliedPlayerId && suppliedPlayerId !== user.playerId) {
        return res.status(403).json({ error: 'player does not belong to authenticated account' });
      }

      req.userId = user.id;
      req.authUser = user;
      req.playerId = user.playerId;
      if (req.body && typeof req.body === 'object') req.body.playerId = user.playerId;
      return next();
    } catch (error) {
      console.error('[auth] request authentication failed', error);
      return res.status(503).json({ error: 'authentication unavailable' });
    }
  };
}

module.exports = {
  COOKIE_NAME,
  authenticateUserRequest,
  clearUserSession,
  createUserSession,
  requireAuthenticatedPlayer,
  signUserToken,
  userAuthConfigurationReady,
  verifyUserToken,
};
