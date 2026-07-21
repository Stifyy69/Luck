const cookieParser = require('cookie-parser');
const {
  ADMIN_USER,
  adminConfigurationReady,
  adminCredentialsMatch,
  clearAdminSession,
  createAdminSession,
  requirePlatformAdmin,
} = require('./auth.cjs');
const {
  getAdminAudit,
  getAdminOverview,
  getAdminPlayerDetail,
  getAdminPlayers,
  getGangLeaderboard,
  getGangState,
  getPlatformStatus,
  getPlayerLeaderboard,
  grantAdminItem,
  grantAdminMythicMember,
  normalizeLatestVipActivation,
  resetAdminTutorial,
  setAdminVip,
  syncGang,
  updateAdminDisplayName,
  updateAdminNumericField,
} = require('./store.cjs');

function playerIdFromRequest(req, payload = null) {
  return String(
    req.body?.playerId
      || req.query?.playerId
      || req.params?.playerId
      || payload?.playerId
      || payload?.state?.playerId
      || '',
  ).trim();
}

function installPlatformSystems(app, express) {
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  app.use((req, res, next) => {
    const originalJson = res.json.bind(res);
    let sent = false;

    res.json = (payload) => {
      if (sent) return res;
      sent = true;
      Promise.resolve(handlePlatformResponse(req, payload))
        .then((nextPayload) => originalJson(nextPayload))
        .catch((error) => {
          console.error('[platform] response hook failed', error);
          originalJson(payload);
        });
      return res;
    };

    next();
  });

  app.post('/api/adminpanelv2/login', (req, res) => {
    if (!adminConfigurationReady()) {
      return res.status(503).json({ error: 'Set ADMIN_PASS and ADMIN_SECRET in Railway before using the control center.' });
    }
    if (!adminCredentialsMatch(req.body?.username, req.body?.password)) {
      return res.status(401).json({ error: 'invalid credentials' });
    }
    createAdminSession(res);
    return res.json({ ok: true, admin: ADMIN_USER });
  });

  app.post('/api/adminpanelv2/logout', (_req, res) => {
    clearAdminSession(res);
    return res.json({ ok: true });
  });

  app.get('/api/platform/status', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      return res.json({ status: await getPlatformStatus(playerId) });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'platform status unavailable' });
    }
  });

  app.get('/api/leaderboards/players', async (req, res) => {
    try {
      return res.json(await getPlayerLeaderboard(String(req.query?.metric || 'city_level')));
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'player leaderboard unavailable' });
    }
  });

  app.get('/api/leaderboards/gangs', async (req, res) => {
    try {
      return res.json(await getGangLeaderboard(String(req.query?.metric || 'dirty_earned')));
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'gang leaderboard unavailable' });
    }
  });

  app.get('/api/gangs/state', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      return res.json({ gang: await getGangState(playerId) });
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : 'gang state unavailable' });
    }
  });

  app.post('/api/gangs/sync', async (req, res) => {
    try {
      const playerId = playerIdFromRequest(req);
      if (!playerId) return res.status(400).json({ error: 'playerId required' });
      return res.json({ ok: true, gang: await syncGang(playerId, req.body?.gangData || {}) });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'gang sync failed' });
    }
  });

  app.get('/api/adminpanelv3/overview', requirePlatformAdmin, async (_req, res) => {
    try {
      return res.json(await getAdminOverview());
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'overview failed' });
    }
  });

  app.get('/api/adminpanelv3/players', requirePlatformAdmin, async (req, res) => {
    try {
      return res.json(await getAdminPlayers(req.query || {}));
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'players query failed' });
    }
  });

  app.get('/api/adminpanelv3/players/:playerId', requirePlatformAdmin, async (req, res) => {
    try {
      const player = await getAdminPlayerDetail(String(req.params.playerId || ''));
      if (!player) return res.status(404).json({ error: 'player not found' });
      return res.json(player);
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'player detail failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/numeric', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await updateAdminNumericField(
        ADMIN_USER,
        String(req.params.playerId || ''),
        String(req.body?.field || ''),
        String(req.body?.mode || 'set'),
        req.body?.value,
      );
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'numeric update failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/profile', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await updateAdminDisplayName(ADMIN_USER, String(req.params.playerId || ''), req.body?.displayName);
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'profile update failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/item', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await grantAdminItem(ADMIN_USER, String(req.params.playerId || ''), req.body?.itemType, req.body?.quantity);
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'item grant failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/gang/mythic', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await grantAdminMythicMember(
        ADMIN_USER,
        String(req.params.playerId || ''),
        String(req.body?.name || ''),
      );
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Mythic member grant failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/vip', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await setAdminVip(ADMIN_USER, String(req.params.playerId || ''), String(req.body?.tier || 'NONE'));
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'VIP update failed' });
    }
  });

  app.post('/api/adminpanelv3/players/:playerId/tutorial/reset', requirePlatformAdmin, async (req, res) => {
    try {
      const detail = await resetAdminTutorial(ADMIN_USER, String(req.params.playerId || ''));
      return res.json({ ok: true, detail });
    } catch (error) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'tutorial reset failed' });
    }
  });

  app.get('/api/adminpanelv3/audit', requirePlatformAdmin, async (req, res) => {
    try {
      return res.json({ actions: await getAdminAudit(req.query?.limit || 100) });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : 'audit failed' });
    }
  });
}

async function handlePlatformResponse(req, payload) {
  if (req.path !== '/api/inventory/use' || payload?.error || !payload?.ok) return payload;
  const playerId = playerIdFromRequest(req, payload);
  if (!playerId) return payload;

  const effectToTier = {
    vip_silver_activated: 'VIP_SILVER',
    vip_gold_activated: 'VIP_GOLD',
  };
  const tier = effectToTier[payload.effect];
  if (!tier) return payload;

  const vip = await normalizeLatestVipActivation(playerId, tier);
  return {
    ...payload,
    metadata: {
      ...(payload.metadata || {}),
      vip,
    },
    vipStatus: vip,
  };
}

module.exports = { installPlatformSystems };
