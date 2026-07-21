const crypto = require('crypto');

const ADMIN_USER = String(process.env.ADMIN_USER || 'Stifyy').trim();
const ADMIN_PASS = String(process.env.ADMIN_PASS || '');
const ADMIN_SECRET = String(process.env.ADMIN_SECRET || '');
const COOKIE_NAME = 'adminpanelv2_token';

function adminConfigurationReady() {
  return Boolean(ADMIN_USER && ADMIN_PASS.length >= 12 && ADMIN_SECRET.length >= 24);
}

function signAdminToken(value) {
  if (!adminConfigurationReady()) throw new Error('admin environment is not configured');
  const signature = crypto.createHmac('sha256', ADMIN_SECRET).update(value).digest('hex');
  return `${value}.${signature}`;
}

function verifyAdminToken(token) {
  if (!adminConfigurationReady() || !token) return false;
  const [value, signature] = String(token).split('.');
  if (!value || !signature) return false;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(value).digest('hex');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return false;
  const [username, expiresAt] = value.split('|');
  return username === ADMIN_USER && Number(expiresAt) > Date.now();
}

function createAdminSession(res) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const token = signAdminToken(`${ADMIN_USER}|${expiresAt}`);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAdminSession(res) {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

function adminCredentialsMatch(username, password) {
  if (!adminConfigurationReady()) return false;
  const providedUser = Buffer.from(String(username || ''));
  const expectedUser = Buffer.from(ADMIN_USER);
  const providedPass = Buffer.from(String(password || ''));
  const expectedPass = Buffer.from(ADMIN_PASS);
  const userMatches = providedUser.length === expectedUser.length && crypto.timingSafeEqual(providedUser, expectedUser);
  const passMatches = providedPass.length === expectedPass.length && crypto.timingSafeEqual(providedPass, expectedPass);
  return userMatches && passMatches;
}

function requirePlatformAdmin(req, res, next) {
  if (!adminConfigurationReady()) return res.status(503).json({ error: 'admin environment not configured' });
  if (!verifyAdminToken(req.cookies?.[COOKIE_NAME])) return res.status(401).json({ error: 'unauthorized' });
  return next();
}

module.exports = {
  ADMIN_USER,
  adminConfigurationReady,
  adminCredentialsMatch,
  clearAdminSession,
  createAdminSession,
  requirePlatformAdmin,
  verifyAdminToken,
};
