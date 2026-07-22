const {
  CITY_XP_REWARDS,
  cityLevelStartXp,
} = require('./constants.cjs');
const {
  advanceTutorialAtLeast,
  awardCityXp,
  getCityProgress,
  pool,
  updateTutorial,
} = require('./store.cjs');
const cookieParser = require('cookie-parser');
const { requireAuthenticatedPlayer } = require('../security/userAuth.cjs');

const LOCKED_API_PREFIXES = [
  { prefix: '/api/fisher', key: 'fisher', level: 3, label: 'Fisher' },
  { prefix: '/api/pilot', key: 'pilot', level: 6, label: 'Pilot' },
];

function playerIdFromRequest(req, payload = null) {
  return String(
    req.playerId
      || req.body?.playerId
      || req.query?.playerId
      || payload?.playerId
      || payload?.state?.playerId
      || '',
  ).trim();
}

function attachCityResult(payload, result) {
  if (!payload || typeof payload !== 'object' || !result) return payload;
  return {
    ...payload,
    cityProgress: result.progress,
    cityReward: {
      awardedXp: Number(result.awardedXp || 0),
      duplicate: Boolean(result.duplicate),
      levelUp: result.levelUp || null,
    },
  };
}

function installCityProgress(app, express) {
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    let sent = false;

    res.json = (payload) => {
      if (sent) return res;
      sent = true;

      Promise.resolve(handleResponse(req, payload))
        .then((nextPayload) => originalJson(nextPayload))
        .catch((error) => {
          console.error('[city-progress] response hook failed', error);
          originalJson(payload);
        });
      return res;
    };

    next();
  });

  const requirePlayer = requireAuthenticatedPlayer(pool);
  app.use('/api/city', requirePlayer);

  app.get('/api/city/progress', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      const progress = await getCityProgress(playerId);
      return res.json({ progress });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'city progress unavailable' });
    }
  });

  app.post('/api/city/tutorial/advance', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      const progress = await updateTutorial(playerId, 'advance', req.body?.step ?? null);
      return res.json({ ok: true, progress });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'tutorial update failed' });
    }
  });

  app.post('/api/city/tutorial/complete', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      const progress = await updateTutorial(playerId, 'complete');
      return res.json({ ok: true, progress });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'tutorial completion failed' });
    }
  });

  app.post('/api/city/tutorial/skip', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      const progress = await updateTutorial(playerId, 'skip');
      return res.json({ ok: true, progress });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'tutorial skip failed' });
    }
  });

  app.post('/api/city/tutorial/replay', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      const progress = await updateTutorial(playerId, 'replay');
      return res.json({ ok: true, progress });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'tutorial replay failed' });
    }
  });

  app.use('/api/fisher', requirePlayer);
  app.use('/api/pilot', requirePlayer);

  app.use(async (req, res, next) => {
    const rule = LOCKED_API_PREFIXES.find((candidate) => req.path.startsWith(candidate.prefix));
    if (!rule || req.path.includes('/admin/')) return next();

    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return next();
      const progress = await getCityProgress(playerId);
      if (progress.level >= rule.level) return next();
      return res.status(403).json({
        error: 'career locked',
        career: rule.key,
        label: rule.label,
        requiredLevel: rule.level,
        currentLevel: progress.level,
        xpToUnlock: Math.max(0, cityLevelStartXp(rule.level) - Number(progress.xp || 0)),
        cityProgress: progress,
      });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'city access unavailable' });
    }
  });
}

async function handleResponse(req, payload) {
  const path = req.path;
  const playerId = playerIdFromRequest(req, payload);
  if (!playerId) return payload;
  if (payload?.cityReward) return payload;

  if (path === '/api/bootstrap' && payload && typeof payload === 'object' && !payload.error) {
    const progress = await getCityProgress(playerId);
    return { ...payload, cityProgress: progress, careerAccess: progress.careerAccess };
  }

  if (path === '/api/player/profile/name' && !payload?.error) {
    const progress = await advanceTutorialAtLeast(playerId, 2);
    return { ...payload, cityProgress: progress };
  }

  if (path === '/api/pizzer/shift/start' && !payload?.error) {
    const progress = await advanceTutorialAtLeast(playerId, 4);
    return { ...payload, cityProgress: progress };
  }

  if (path === '/api/pizzer/order/select' && !payload?.error) {
    const progress = await advanceTutorialAtLeast(playerId, 5);
    return { ...payload, cityProgress: progress };
  }

  if (path === '/api/pizzer/delivery/handover' && payload?.result?.delivered && !payload?.result?.accident) {
    const count = Number(payload?.state?.progress?.totalDeliveries || payload?.result?.progression?.totalDeliveries || 0);
    const result = await awardCityXp(
      playerId,
      'PIZZER_DELIVERY',
      String(count || payload?.result?.sessionId || Date.now()),
      CITY_XP_REWARDS.PIZZER_DELIVERY,
      { rating: payload?.result?.breakdown?.rating || null },
    );
    await advanceTutorialAtLeast(playerId, 6);
    return attachCityResult(payload, result);
  }

  if (path === '/api/fisher/land' && payload?.result?.caught) {
    const count = Number(payload?.state?.progress?.totalCatches || 0);
    const result = await awardCityXp(
      playerId,
      'FISHER_CATCH',
      String(count || payload?.result?.fishName || Date.now()),
      CITY_XP_REWARDS.FISHER_CATCH,
      { rarity: payload?.result?.fishRarity || null },
    );
    return attachCityResult(payload, result);
  }

  if (path === '/api/pilot/flight/complete' && payload?.result?.completed) {
    const count = Number(payload?.state?.progress?.totalFlights || 0);
    const result = await awardCityXp(
      playerId,
      'PILOT_FLIGHT',
      String(count || payload?.result?.routeId || Date.now()),
      CITY_XP_REWARDS.PILOT_FLIGHT,
      { routeId: payload?.result?.routeId || null },
    );
    return attachCityResult(payload, result);
  }

  return payload;
}

module.exports = { installCityProgress };
