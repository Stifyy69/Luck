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
const USER_SECRET = process.env.USER_SECRET || 'cityflow-user-secret';

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

const signUserToken = (value) => {
  const sig = crypto.createHmac('sha256', USER_SECRET).update(value).digest('hex');
  return `${value}.${sig}`;
};

const verifyUserToken = (token) => {
  if (!token) return null;
  const [value, sig] = token.split('.');
  if (!value || !sig) return null;
  const expected = crypto.createHmac('sha256', USER_SECRET).update(value).digest('hex');
  if (expected !== sig) return null;
  const [userId, expires] = value.split('|');
  if (!userId || Number(expires) <= Date.now()) return null;
  return Number(userId);
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

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_profiles (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      game_state JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_inventory (
      user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      quantity BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, item_key)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_posts (
      id BIGSERIAL PRIMARY KEY,
      item_key TEXT NOT NULL,
      item_name TEXT NOT NULL,
      item_type TEXT NOT NULL,
      image_url TEXT,
      price BIGINT NOT NULL,
      bot_name TEXT NOT NULL,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

const requireUser = async (req, res, next) => {
  const userId = verifyUserToken(req.cookies.cityflow_user_token);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  req.userId = userId;
  next();
};

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

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, passwordConfirm } = req.body || {};
    if (!username || !email || !password) return res.status(400).json({ error: 'missing fields' });
    if (password !== passwordConfirm) return res.status(400).json({ error: 'password mismatch' });

    const inserted = await pool.query(
      `INSERT INTO users (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email`,
      [String(username).trim(), String(email).trim().toLowerCase(), String(password)],
    );
    const user = inserted.rows[0];
    await pool.query(`INSERT INTO user_profiles (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`, [user.id]);

    const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
    res.cookie('cityflow_user_token', signUserToken(`${user.id}|${expires}`), {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(400).json({ error: 'register failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'missing fields' });
  const result = await pool.query(`SELECT id, username, email, password FROM users WHERE username = $1`, [String(username).trim()]);
  const user = result.rows[0];
  if (!user || user.password !== password) return res.status(401).json({ error: 'invalid credentials' });

  const expires = Date.now() + 7 * 24 * 60 * 60 * 1000;
  res.cookie('cityflow_user_token', signUserToken(`${user.id}|${expires}`), {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email } });
});

app.post('/api/auth/logout', (_req, res) => {
  res.clearCookie('cityflow_user_token');
  res.json({ ok: true });
});

app.get('/api/auth/me', async (req, res) => {
  const userId = verifyUserToken(req.cookies.cityflow_user_token);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const result = await pool.query(`SELECT id, username, email FROM users WHERE id = $1`, [userId]);
  if (!result.rows[0]) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: result.rows[0] });
});

app.get('/api/account/state', requireUser, async (req, res) => {
  const result = await pool.query(`SELECT game_state FROM user_profiles WHERE user_id = $1`, [req.userId]);
  res.json({ state: result.rows[0]?.game_state || {} });
});

app.post('/api/account/state', requireUser, async (req, res) => {
  const { state } = req.body || {};
  await pool.query(
    `INSERT INTO user_profiles (user_id, game_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET game_state = EXCLUDED.game_state, updated_at = NOW()`,
    [req.userId, JSON.stringify(state || {})],
  );
  res.json({ ok: true });
});

app.get('/api/inventory', requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT item_key, item_name, item_type, quantity FROM user_inventory WHERE user_id = $1 ORDER BY item_type, item_name`,
    [req.userId],
  );
  res.json({ items: result.rows });
});

app.get('/api/market/posts', async (_req, res) => {
  const result = await pool.query(
    `SELECT id, item_key, item_name, item_type, image_url, price, bot_name, created_at
     FROM market_posts
     WHERE active = TRUE
     ORDER BY created_at DESC
     LIMIT 60`,
  );
  res.json({ posts: result.rows });
});

app.post('/api/market/buy', requireUser, async (req, res) => {
  const { postId } = req.body || {};
  const postResult = await pool.query(`SELECT * FROM market_posts WHERE id = $1 AND active = TRUE`, [postId]);
  const post = postResult.rows[0];
  if (!post) return res.status(404).json({ error: 'post missing' });

  await pool.query(
    `INSERT INTO user_inventory (user_id, item_key, item_name, item_type, quantity)
     VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (user_id, item_key)
     DO UPDATE SET quantity = user_inventory.quantity + 1`,
    [req.userId, post.item_key, post.item_name, post.item_type],
  );
  await pool.query(`UPDATE market_posts SET active = FALSE WHERE id = $1`, [post.id]);
  res.json({ ok: true, item: post });
});

app.post('/api/market/offer', requireUser, async (req, res) => {
  const { postId, offerPrice } = req.body || {};
  const postResult = await pool.query(`SELECT * FROM market_posts WHERE id = $1 AND active = TRUE`, [postId]);
  const post = postResult.rows[0];
  if (!post) return res.status(404).json({ error: 'post missing' });

  const offer = Number(offerPrice || 0);
  const threshold = Number(post.price) * (0.78 + Math.random() * 0.22);
  const accepted = offer >= threshold;
  if (!accepted) return res.json({ accepted: false, message: 'NPC a refuzat oferta.' });

  await pool.query(
    `INSERT INTO user_inventory (user_id, item_key, item_name, item_type, quantity)
     VALUES ($1, $2, $3, $4, 1)
     ON CONFLICT (user_id, item_key)
     DO UPDATE SET quantity = user_inventory.quantity + 1`,
    [req.userId, post.item_key, post.item_name, post.item_type],
  );
  await pool.query(`UPDATE market_posts SET active = FALSE WHERE id = $1`, [post.id]);
  return res.json({ accepted: true, message: 'NPC a acceptat oferta.', item: post });
});

const BOT_NAMES = ['Rico', 'Marlon', 'Maya', 'Toretto', 'Nina', 'Sergio', 'Vlad', 'Alex'];
const BOT_ITEMS = [
  { item_key: 'car_audi_a4', item_name: 'AUDI A4', item_type: 'car', image_url: 'https://panel.ogland.ro/assets/img/vehicles/a899.png', min: 40_000, max: 70_000 },
  { item_key: 'car_rs7', item_name: 'RS7', item_type: 'car', image_url: 'https://panel.ogland.ro/assets/img/vehicles/rs7c8.png', min: 420_000, max: 620_000 },
  { item_key: 'car_p1', item_name: 'P1', item_type: 'car', image_url: 'https://panel.ogland.ro/assets/img/vehicles/p1.png', min: 1_800_000, max: 2_500_000 },
  { item_key: 'cloth_hoodie_cityflow', item_name: 'Hoodie CityFlow', item_type: 'cloth', image_url: '/hoodie-cityflow.svg', min: 30_000, max: 90_000 },
  { item_key: 'cloth_jacket_sunset', item_name: 'Jachetă Sunset', item_type: 'cloth', image_url: '/jacket-sunset.svg', min: 40_000, max: 120_000 },
];

const randomInRange = (min, max) => Math.floor(min + Math.random() * (max - min + 1));

async function seedBotPosts() {
  for (let i = 0; i < 3; i += 1) {
    const item = BOT_ITEMS[Math.floor(Math.random() * BOT_ITEMS.length)];
    const botName = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
    const price = randomInRange(item.min, item.max);
    await pool.query(
      `INSERT INTO market_posts (item_key, item_name, item_type, image_url, price, bot_name, active, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,TRUE,NOW())`,
      [item.item_key, item.item_name, item.item_type, item.image_url, price, botName],
    );
  }
}

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
    seedBotPosts().catch(() => {});
    setInterval(() => {
      seedBotPosts().catch(() => {});
    }, 5 * 60 * 1000);
    app.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('DB init failed', err);
    process.exit(1);
  });
