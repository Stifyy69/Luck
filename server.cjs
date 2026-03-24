const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const distPath = path.join(__dirname, 'dist');

const ADMIN_USER = 'Stifyy';
const ADMIN_PASS = 'Fifi23';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'adminpanelv2-secret';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const signAdminToken = (value) => {
  const sig = crypto.createHmac('sha256', ADMIN_SECRET).update(value).digest('hex');
  return `${value}.${sig}`;
};

const verifyAdminToken = (token) => {
  if (!token) return false;
  const [value, sig] = token.split('.');
  if (!value || !sig) return false;
  const expected = crypto.createHmac('sha256', ADMIN_SECRET).update(value).digest('hex');
  if (expected !== sig) return false;
  const [username, expires] = value.split('|');
  if (username !== ADMIN_USER) return false;
  return Number(expires) > Date.now();
};

const getIp = (req) =>
  (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();

const getLocation = (req) => ({
  country: req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || null,
  city: req.headers['x-vercel-ip-city'] || null,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS player_stats (
      player_id TEXT PRIMARY KEY,
      cash_available BIGINT NOT NULL DEFAULT 0,
      roulette_spent BIGINT NOT NULL DEFAULT 0,
      roulette_won BIGINT NOT NULL DEFAULT 0,
      total_net BIGINT NOT NULL DEFAULT 0,
      time_spent DOUBLE PRECISION NOT NULL DEFAULT 0,
      leaves_collected BIGINT NOT NULL DEFAULT 0,
      white_processed BIGINT NOT NULL DEFAULT 0,
      blue_processed BIGINT NOT NULL DEFAULT 0,
      farm_earned BIGINT NOT NULL DEFAULT 0,
      sleep_count BIGINT NOT NULL DEFAULT 0,
      sleep_money BIGINT NOT NULL DEFAULT 0,
      time_pilot DOUBLE PRECISION NOT NULL DEFAULT 0,
      last_seen TIMESTAMPTZ,
      path TEXT,
      ip TEXT,
      country TEXT,
      city TEXT,
      user_agent TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const requiredColumns = [
    ['farm_earned', "BIGINT NOT NULL DEFAULT 0"],
    ['time_pilot', "DOUBLE PRECISION NOT NULL DEFAULT 0"],
    ['sleep_count', "BIGINT NOT NULL DEFAULT 0"],
    ['sleep_money', "BIGINT NOT NULL DEFAULT 0"],
    ['country', 'TEXT'],
    ['city', 'TEXT'],
    ['path', 'TEXT'],
    ['user_agent', 'TEXT'],
    ['last_seen', 'TIMESTAMPTZ'],
    ['updated_at', "TIMESTAMPTZ NOT NULL DEFAULT NOW()"],
  ];

  for (const [column, definition] of requiredColumns) {
    await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS ${column} ${definition};`);
  }
}

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

app.post('/api/stats/sync', async (req, res) => {
  try {
    const { playerId, stats = {}, path: currentPath } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const ip = getIp(req);
    const { country, city } = getLocation(req);
    const ua = req.headers['user-agent'] || null;

    await pool.query(
      `
      INSERT INTO player_stats (
        player_id, cash_available, roulette_spent, roulette_won, total_net,
        time_spent, leaves_collected, white_processed, blue_processed, farm_earned,
        sleep_count, sleep_money, time_pilot, last_seen, path, ip, country, city, user_agent, updated_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),$14,$15,$16,$17,$18,NOW()
      )
      ON CONFLICT (player_id) DO UPDATE SET
        cash_available = EXCLUDED.cash_available,
        roulette_spent = EXCLUDED.roulette_spent,
        roulette_won = EXCLUDED.roulette_won,
        total_net = EXCLUDED.total_net,
        time_spent = EXCLUDED.time_spent,
        leaves_collected = EXCLUDED.leaves_collected,
        white_processed = EXCLUDED.white_processed,
        blue_processed = EXCLUDED.blue_processed,
        farm_earned = EXCLUDED.farm_earned,
        sleep_count = EXCLUDED.sleep_count,
        sleep_money = EXCLUDED.sleep_money,
        time_pilot = EXCLUDED.time_pilot,
        last_seen = NOW(),
        path = EXCLUDED.path,
        ip = EXCLUDED.ip,
        country = COALESCE(EXCLUDED.country, player_stats.country),
        city = COALESCE(EXCLUDED.city, player_stats.city),
        user_agent = EXCLUDED.user_agent,
        updated_at = NOW();
      `,
      [
        playerId,
        Number(stats.cashAvailable || 0),
        Number(stats.rouletteSpent || 0),
        Number(stats.rouletteWon || 0),
        Number(stats.totalNet || 0),
        Number(stats.timeSpent || 0),
        Number(stats.leavesCollected || 0),
        Number(stats.whiteProcessed || 0),
        Number(stats.blueProcessed || 0),
        Number(stats.farmEarned || 0),
        Number(stats.sleepCount || 0),
        Number(stats.sleepMoney || 0),
        Number(stats.timePilot || 0),
        currentPath || null,
        ip || null,
        country || null,
        city || null,
        ua,
      ],
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('stats sync error', e);
    res.status(500).json({ error: 'sync failed' });
  }
});

app.post('/api/activity/heartbeat', async (req, res) => {
  try {
    const { playerId, path: currentPath } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const ip = getIp(req);
    const { country, city } = getLocation(req);

    await pool.query(
      `
      INSERT INTO player_stats (player_id, last_seen, path, ip, country, city, updated_at)
      VALUES ($1, NOW(), $2, $3, $4, $5, NOW())
      ON CONFLICT (player_id) DO UPDATE SET
        last_seen = NOW(),
        path = EXCLUDED.path,
        ip = EXCLUDED.ip,
        country = COALESCE(EXCLUDED.country, player_stats.country),
        city = COALESCE(EXCLUDED.city, player_stats.city),
        updated_at = NOW();
      `,
      [playerId, currentPath || null, ip || null, country || null, city || null],
    );

    res.json({ ok: true });
  } catch (e) {
    console.error('heartbeat error', e);
    res.status(500).json({ error: 'heartbeat failed' });
  }
});

app.post('/api/adminpanelv2/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username !== ADMIN_USER || password !== ADMIN_PASS) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const expires = Date.now() + 8 * 60 * 60 * 1000;
  const token = signAdminToken(`${ADMIN_USER}|${expires}`);

  res.cookie('adminpanelv2_token', token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
});

app.get('/api/adminpanelv2/dashboard', async (req, res) => {
  if (!verifyAdminToken(req.cookies.adminpanelv2_token)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const [playersResult, summaryResult] = await Promise.all([
      pool.query(
        `
        SELECT
          player_id,
          cash_available,
          roulette_spent,
          roulette_won,
          total_net,
          time_spent,
          leaves_collected,
          white_processed,
          blue_processed,
          farm_earned,
          sleep_count,
          sleep_money,
          time_pilot,
          last_seen,
          city,
          country,
          path
        FROM player_stats
        ORDER BY updated_at DESC
        LIMIT 300;
        `,
      ),
      pool.query(
        `
        SELECT
          COUNT(*)::INT AS total_players,
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '90 seconds')::INT AS online_now,
          COUNT(*) FILTER (WHERE last_seen > NOW() - INTERVAL '15 minutes')::INT AS active_recent
        FROM player_stats;
        `,
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || { total_players: 0, online_now: 0, active_recent: 0 };

    res.json({
      summary: {
        totalPlayers: summaryRow.total_players,
        onlineNow: summaryRow.online_now,
        activeRecent: summaryRow.active_recent,
      },
      players: playersResult.rows,
    });
  } catch (e) {
    console.error('dashboard error', e);
    res.status(500).json({ error: 'dashboard failed' });
  }
});

app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

initDb()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('DB init failed', err);
    process.exit(1);
  });
