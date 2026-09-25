const {
  CITY_XP_REWARDS,
  PILOT_ROUTE_XP,
  cityLevelStartXp,
} = require('./constants.cjs');
const { routes: PILOT_ROUTES } = require('../gameplay/pilotRoutes.cjs');
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
  { prefix: '/api/cayo', key: 'cayo', level: 10, label: 'Cayo' },
];

function playerIdFromRequest(req, payload = null) {
  return String(
    req.playerId
      || req.body?.playerId
      || req.query?.playerId
      || payload?.playerId
      || payload?.state?.playerId
      || payload?.user?.playerId
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

function careerXpForLevel(level) {
  const safeLevel = Math.max(1, Math.min(50, Number(level) || 1));
  if (safeLevel <= 1) return 0;
  const x = safeLevel - 1;
  return Math.floor(120 * Math.pow(x, 1.32) + x * 40);
}

function careerLevelFromXp(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  let level = 1;
  for (let candidate = 2; candidate <= 50; candidate += 1) {
    if (safeXp < careerXpForLevel(candidate)) break;
    level = candidate;
  }
  return level;
}

function careerProgressNumbers(xp) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = careerLevelFromXp(safeXp);
  const start = careerXpForLevel(level);
  const next = level >= 50 ? null : careerXpForLevel(level + 1);
  return {
    xp: safeXp,
    level,
    currentLevelXp: Math.max(0, safeXp - start),
    nextLevelXp: next === null ? null : Math.max(1, next - start),
  };
}

function resultFromPayload(payload) {
  return payload?.result || payload?.lastResult || payload?.state?.lastResult || null;
}

function targetCareerReward(path, payload) {
  const result = resultFromPayload(payload);
  if (path === '/api/pizzer/delivery/handover' && result?.delivered && !result?.accident) {
    return { kind: 'pizzer', amount: CITY_XP_REWARDS.PIZZER_DELIVERY };
  }
  if ((path === '/api/fisher/dock/select' || path === '/api/fisher/land') && result?.caught) {
    return { kind: 'fisher', amount: CITY_XP_REWARDS.FISHER_CATCH };
  }
  if (path === '/api/pilot/flight/complete' && result?.completed) {
    const routeId = String(result?.routeId || payload?.state?.lastResult?.routeId || '').toUpperCase();
    const route = PILOT_ROUTES.find((entry) => entry.id === routeId);
    return { kind: 'pilot', amount: Number(route?.baseXp || PILOT_ROUTE_XP[routeId] || CITY_XP_REWARDS.PILOT_FLIGHT) };
  }
  return null;
}

async function normalizeCareerReward(playerId, path, payload) {
  const target = targetCareerReward(path, payload);
  if (!target || !pool) return payload;

  const result = resultFromPayload(payload);
  const progression = result?.progression || {};
  const beforeXp = Math.max(0, Number(progression.xpBefore || 0));
  const afterXp = Math.max(beforeXp, Number(progression.xpAfter || beforeXp));
  const actualAward = Math.max(0, afterXp - beforeXp);
  const correction = Number(target.amount || 0) - actualAward;

  const table = target.kind === 'pizzer'
    ? 'player_pizzer_progress'
    : target.kind === 'fisher'
      ? 'player_fisher_progress'
      : 'player_pilot_progress';
  const xpColumn = target.kind === 'pizzer' ? 'pizzer_xp' : target.kind === 'fisher' ? 'fisher_xp' : 'pilot_xp';
  const levelColumn = target.kind === 'pizzer' ? 'pizzer_level' : target.kind === 'fisher' ? 'fisher_level' : 'pilot_level';

  let finalXp = afterXp;
  if (correction !== 0) {
    const updated = await pool.query(
      `UPDATE ${table} SET ${xpColumn} = GREATEST(0, ${xpColumn} + $2), updated_at = NOW() WHERE player_id = $1 RETURNING ${xpColumn} AS xp`,
      [playerId, correction],
    );
    finalXp = Math.max(0, Number(updated.rows[0]?.xp ?? beforeXp + target.amount));
  }

  const progressNumbers = careerProgressNumbers(finalXp);
  await pool.query(
    `UPDATE ${table} SET ${levelColumn} = $2, updated_at = NOW() WHERE player_id = $1`,
    [playerId, progressNumbers.level],
  );

  if (result?.progression) {
    result.progression.xpBefore = beforeXp;
    result.progression.xpAfter = beforeXp + target.amount;
    result.progression.levelAfter = progressNumbers.level;
  }
  if (result?.breakdown) {
    if ('xpGained' in result.breakdown) result.breakdown.xpGained = target.amount;
    if ('totalXp' in result.breakdown) result.breakdown.totalXp = target.amount;
    if ('streakXpBonus' in result.breakdown) result.breakdown.streakXpBonus = 0;
    if ('milestoneXpBonus' in result.breakdown) result.breakdown.milestoneXpBonus = 0;
    if ('firstCompletionXpBonus' in result.breakdown) result.breakdown.firstCompletionXpBonus = 0;
  }

  const stateProgress = payload?.state?.progress || (payload?.progress && typeof payload.progress === 'object' ? payload.progress : null);
  if (stateProgress) {
    stateProgress.xp = finalXp;
    stateProgress.level = progressNumbers.level;
    stateProgress.currentLevelXp = progressNumbers.currentLevelXp;
    stateProgress.nextLevelXp = progressNumbers.nextLevelXp;
  }

  return payload;
}

function normalizeOptionXp(path, payload) {
  if (!payload || typeof payload !== 'object') return payload;
  if (path === '/api/pizzer/orders/options' && Array.isArray(payload.options)) {
    return { ...payload, options: payload.options.map((option) => ({ ...option, estimatedXp: CITY_XP_REWARDS.PIZZER_DELIVERY })) };
  }
  if (path === '/api/fisher/spots/options' && Array.isArray(payload.options)) {
    return { ...payload, options: payload.options.map((option) => ({ ...option, estimatedXp: CITY_XP_REWARDS.FISHER_CATCH })) };
  }
  return payload;
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

  app.use('/api/fisher', requirePlayer);
  app.use('/api/pilot', requirePlayer);
  app.use('/api/cayo', requirePlayer);

  app.use(async (req, res, next) => {
    const rule = LOCKED_API_PREFIXES.find((candidate) => req.path.startsWith(candidate.prefix));
    if (!rule || req.path.includes('/admin/')) return next();

    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return next();
      const progress = await getCityProgress(playerId);
      const access = progress.careerAccess?.[rule.key];
      if (access?.unlocked) return next();
      return res.status(403).json({
        error: 'career locked',
        career: rule.key,
        label: rule.label,
        reason: access?.reason || `Reach City Level ${rule.level}`,
        requiredLevel: rule.level,
        requiredCareer: access?.requiredCareer || null,
        requiredCareerLevel: access?.requiredCareerLevel || null,
        currentLevel: progress.level,
        xpToUnlock: Math.max(0, cityLevelStartXp(rule.level) - Number(progress.xp || 0)),
        cityProgress: progress,
      });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'city access unavailable' });
    }
  });
}

async function handleResponse(req, originalPayload) {
  const path = req.path;
  let payload = normalizeOptionXp(path, originalPayload);
  const playerId = playerIdFromRequest(req, payload);
  if (!playerId) return payload;

  if (!payload?.error) {
    payload = await normalizeCareerReward(playerId, path, payload);
  }

  if (path === '/api/bootstrap' && payload && typeof payload === 'object' && !payload.error) {
    const progress = await getCityProgress(playerId);
    return { ...payload, cityProgress: progress, careerAccess: progress.careerAccess };
  }

  if (payload?.cityReward) {
    const progress = await getCityProgress(playerId);
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

  if ((path === '/api/fisher/dock/select' || path === '/api/fisher/land') && resultFromPayload(payload)?.caught) {
    const resultPayload = resultFromPayload(payload);
    const count = Number(payload?.state?.progress?.totalCatches || payload?.progress?.totalCatches || 0);
    const result = await awardCityXp(
      playerId,
      'FISHER_CATCH',
      String(count || resultPayload?.fishName || Date.now()),
      CITY_XP_REWARDS.FISHER_CATCH,
      { rarity: resultPayload?.fishRarity || null },
    );
    return attachCityResult(payload, result);
  }

  if (path === '/api/pilot/flight/complete' && payload?.result?.completed) {
    const count = Number(payload?.state?.progress?.totalFlights || 0);
    const routeId = payload?.result?.routeId || null;
    const result = await awardCityXp(
      playerId,
      'PILOT_FLIGHT',
      String(count || routeId || Date.now()),
      Number(PILOT_ROUTE_XP[String(routeId || '').toUpperCase()] || CITY_XP_REWARDS.PILOT_FLIGHT),
      { routeId },
    );
    return attachCityResult(payload, result);
  }

  return payload;
}

module.exports = { installCityProgress };
