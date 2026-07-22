const DEFAULT_WINDOW_MS = 60_000;

function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' https:; font-src 'self' data:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  next();
}

function configuredOrigins() {
  const values = [process.env.APP_ORIGIN, process.env.CORS_ORIGINS]
    .flatMap((value) => String(value || '').split(','))
    .map((value) => value.trim())
    .filter(Boolean);
  if (process.env.NODE_ENV !== 'production') {
    values.push('http://localhost:5173', 'http://127.0.0.1:5173');
  }
  return new Set(values);
}

function corsMiddleware(req, res, next) {
  const origin = String(req.headers.origin || '').trim();
  const allowed = configuredOrigins();
  if (origin && allowed.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    if (!origin || !allowed.has(origin)) return res.sendStatus(403);
    return res.sendStatus(204);
  }
  return next();
}

function createRateLimiter({ windowMs = DEFAULT_WINDOW_MS, max = 60, key = (req) => req.ip } = {}) {
  const entries = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const identifier = String(key(req) || 'unknown');
    const current = entries.get(identifier);
    if (!current || current.resetAt <= now) {
      entries.set(identifier, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((current.resetAt - now) / 1000))));
      return res.status(429).json({ error: 'too many requests' });
    }
    if (entries.size > 10_000) {
      for (const [entryKey, value] of entries) {
        if (value.resetAt <= now) entries.delete(entryKey);
      }
    }
    return next();
  };
}

function installHttpSecurity(app) {
  if (app.locals?.cityflowHttpSecurityInstalled) return;
  app.locals.cityflowHttpSecurityInstalled = true;
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use('/api', createRateLimiter({ windowMs: 60_000, max: 180 }));
}

module.exports = {
  corsMiddleware,
  createRateLimiter,
  installHttpSecurity,
  securityHeaders,
};
