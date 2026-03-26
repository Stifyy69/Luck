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

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const pool = hasDatabaseUrl ? new Pool({ connectionString: process.env.DATABASE_URL }) : null;
let dbReady = false;

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
  if (!pool) {
    throw new Error('DATABASE_URL is not configured');
  }

  // Batch A: Players, Vehicles, Inventory models
  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      player_id TEXT PRIMARY KEY,
      clean_money BIGINT NOT NULL DEFAULT 1000000,
      flow_coins INT NOT NULL DEFAULT 0,
      roulette_fragments INT NOT NULL DEFAULT 0,
      vehicle_slots_base INT NOT NULL DEFAULT 5,
      vehicle_slots_extra INT NOT NULL DEFAULT 0,
      next_tax_collection_at TIMESTAMPTZ,
      skip_next_tax BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vehicle_models (
      id SERIAL PRIMARY KEY,
      brand TEXT NOT NULL,
      name TEXT UNIQUE NOT NULL,
      base_price BIGINT NOT NULL,
      is_jackpot BOOLEAN NOT NULL DEFAULT FALSE,
      stock INT NOT NULL DEFAULT 10
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS owned_vehicles (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
      model_id INT NOT NULL REFERENCES vehicle_models(id),
      purchase_price BIGINT NOT NULL,
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clothing_items (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      rarity TEXT NOT NULL,
      min_value BIGINT NOT NULL,
      max_value BIGINT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
      item_type TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      quantity INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS active_boosts (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id) ON DELETE CASCADE,
      boost_type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Batch B: Marketplace models
  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_listings (
      id SERIAL PRIMARY KEY,
      seller_player_id TEXT,
      seller_npc_id TEXT,
      asset_type TEXT NOT NULL,
      asset_ref_id INT,
      ask_price BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS market_offers (
      id SERIAL PRIMARY KEY,
      listing_id INT NOT NULL REFERENCES market_listings(id),
      buyer_player_id TEXT NOT NULL,
      offered_price BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS npc_sellers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL
    );
  `);

  // Player stats analytics
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

// CORS setup for all origins during development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const requireDb = (_req, res, next) => {
  if (!dbReady || !pool) {
    return res.status(503).json({
      error: 'database unavailable',
      message: 'Set DATABASE_URL to a reachable Postgres instance for database-backed features.',
    });
  }
  next();
};

const requireUser = async (req, res, next) => {
  const userId = verifyUserToken(req.cookies.cityflow_user_token);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  req.userId = userId;
  next();
};

app.post('/api/stats/sync', requireDb, async (req, res) => {
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

app.post('/api/activity/heartbeat', requireDb, async (req, res) => {
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

app.post('/api/auth/register', requireDb, async (req, res) => {
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

app.post('/api/auth/login', requireDb, async (req, res) => {
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

app.get('/api/auth/me', requireDb, async (req, res) => {
  const userId = verifyUserToken(req.cookies.cityflow_user_token);
  if (!userId) return res.status(401).json({ error: 'unauthorized' });
  const result = await pool.query(`SELECT id, username, email FROM users WHERE id = $1`, [userId]);
  if (!result.rows[0]) return res.status(401).json({ error: 'unauthorized' });
  res.json({ user: result.rows[0] });
});

app.get('/api/account/state', requireDb, requireUser, async (req, res) => {
  const result = await pool.query(`SELECT game_state FROM user_profiles WHERE user_id = $1`, [req.userId]);
  res.json({ state: result.rows[0]?.game_state || {} });
});

app.post('/api/account/state', requireDb, requireUser, async (req, res) => {
  const { state } = req.body || {};
  await pool.query(
    `INSERT INTO user_profiles (user_id, game_state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET game_state = EXCLUDED.game_state, updated_at = NOW()`,
    [req.userId, JSON.stringify(state || {})],
  );
  res.json({ ok: true });
});

app.get('/api/inventory', requireDb, requireUser, async (req, res) => {
  const result = await pool.query(
    `SELECT item_key, item_name, item_type, quantity FROM user_inventory WHERE user_id = $1 ORDER BY item_type, item_name`,
    [req.userId],
  );
  res.json({ items: result.rows });
});

app.get('/api/market/posts', requireDb, async (_req, res) => {
  const result = await pool.query(
    `SELECT id, item_key, item_name, item_type, image_url, price, bot_name, created_at
     FROM market_posts
     WHERE active = TRUE
     ORDER BY created_at DESC
     LIMIT 60`,
  );
  res.json({ posts: result.rows });
});

app.post('/api/market/buy', requireDb, requireUser, async (req, res) => {
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

app.post('/api/market/offer', requireDb, requireUser, async (req, res) => {
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

// ========== BATCH A: Bootstrap, Showroom, Roulette ==========

// GET /api/bootstrap - Initialize player with full state
app.get('/api/bootstrap', requireDb, async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    // Ensure player exists
    await pool.query(
      `INSERT INTO players (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [playerId],
    );

    // Get player state
    const playerRes = await pool.query(`SELECT * FROM players WHERE player_id = $1`, [playerId]);
    const player = playerRes.rows[0];

    // Get owned vehicles
    const vehiclesRes = await pool.query(
      `SELECT ov.id, ov.model_id, vm.name, vm.brand, ov.purchase_price, ov.purchased_at
       FROM owned_vehicles ov
       JOIN vehicle_models vm ON ov.model_id = vm.id
       WHERE ov.player_id = $1`,
      [playerId],
    );

    // Get inventory
    const inventoryRes = await pool.query(
      `SELECT id, item_type, quantity, metadata FROM inventory_items WHERE player_id = $1`,
      [playerId],
    );

    // Get active boosts
    const boostsRes = await pool.query(
      `SELECT id, boost_type, expires_at FROM active_boosts WHERE player_id = $1 AND expires_at > NOW()`,
      [playerId],
    );

    const usedSlots = vehiclesRes.rows.length;
    const playerState = {
      playerId: player.player_id,
      cleanMoney: Number(player.clean_money),
      flowCoins: player.flow_coins,
      rouletteFragments: player.roulette_fragments,
      vehicleSlotsBase: player.vehicle_slots_base,
      vehicleSlotsExtra: player.vehicle_slots_extra,
      totalSlots: player.vehicle_slots_base + player.vehicle_slots_extra,
      usedSlots,
      skipNextTax: player.skip_next_tax,
      nextTaxCollectionAt: player.next_tax_collection_at,
      ownedVehicles: vehiclesRes.rows.map(v => ({
        id: v.id,
        modelId: v.model_id,
        modelName: v.name,
        brand: v.brand,
        purchasePrice: Number(v.purchase_price),
        purchasedAt: v.purchased_at.toISOString(),
      })),
      inventory: inventoryRes.rows.map(i => ({
        id: i.id,
        itemType: i.item_type,
        quantity: i.quantity,
        metadata: i.metadata,
      })),
      activeBoosts: boostsRes.rows.map(b => ({
        id: b.id,
        boostType: b.boost_type,
        expiresAt: b.expires_at.toISOString(),
      })),
    };

    res.json(playerState);
  } catch (e) {
    console.error('bootstrap error', e);
    res.status(500).json({ error: 'bootstrap failed' });
  }
});

// GET /api/showroom - List all vehicle models grouped by brand
app.get('/api/showroom', requireDb, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, brand, name, base_price, is_jackpot, stock FROM vehicle_models ORDER BY brand, name`,
    );

    const brands = {};
    for (const vehicle of result.rows) {
      if (!brands[vehicle.brand]) brands[vehicle.brand] = [];
      brands[vehicle.brand].push({
        id: vehicle.id,
        brand: vehicle.brand,
        name: vehicle.name,
        basePrice: Number(vehicle.base_price),
        isJackpot: vehicle.is_jackpot,
        stock: vehicle.stock,
      });
    }

    res.json({ brands });
  } catch (e) {
    console.error('showroom error', e);
    res.status(500).json({ error: 'showroom failed' });
  }
});

// POST /api/showroom/buy - Purchase a vehicle
app.post('/api/showroom/buy', requireDb, async (req, res) => {
  try {
    const { playerId, modelId, useVoucher } = req.body || {};
    if (!playerId || !modelId) return res.status(400).json({ error: 'missing fields' });

    // Get vehicle model
    const vmRes = await pool.query(`SELECT * FROM vehicle_models WHERE id = $1`, [modelId]);
    const model = vmRes.rows[0];
    if (!model) return res.status(404).json({ error: 'vehicle not found' });

    // Get player
    const playerRes = await pool.query(`SELECT * FROM players WHERE player_id = $1`, [playerId]);
    const player = playerRes.rows[0];
    if (!player) return res.status(404).json({ error: 'player not found' });

    // Check slots
    const vehiclesRes = await pool.query(
      `SELECT COUNT(*) as count FROM owned_vehicles WHERE player_id = $1`,
      [playerId],
    );
    const usedSlots = parseInt(vehiclesRes.rows[0].count);
    const totalSlots = player.vehicle_slots_base + player.vehicle_slots_extra;
    if (usedSlots >= totalSlots) return res.status(400).json({ error: 'no vehicle slots available' });

    // Calculate price with voucher discount
    let finalPrice = Number(model.base_price);
    let discountPct = 0;

    if (useVoucher) {
      const voucherRes = await pool.query(
        `SELECT id FROM inventory_items WHERE player_id = $1 AND item_type = 'VOUCHER_SHOWROOM' AND quantity > 0 LIMIT 1`,
        [playerId],
      );
      if (voucherRes.rows.length === 0) {
        return res.status(400).json({ error: 'no vouchers available' });
      }
      discountPct = Math.floor(10 + Math.random() * 25); // 10-35% discount
      finalPrice = Math.floor(finalPrice * (1 - discountPct / 100));

      // Use voucher
      await pool.query(
        `UPDATE inventory_items SET quantity = quantity - 1 WHERE player_id = $1 AND item_type = 'VOUCHER_SHOWROOM' AND quantity > 0`,
        [playerId],
      );
    }

    // Check funds
    if (Number(player.clean_money) < finalPrice) {
      return res.status(400).json({ error: 'insufficient funds' });
    }

    // Deduct money and add vehicle
    await pool.query(`BEGIN`);
    try {
      await pool.query(
        `UPDATE players SET clean_money = clean_money - $1 WHERE player_id = $2`,
        [finalPrice, playerId],
      );

      await pool.query(
        `INSERT INTO owned_vehicles (player_id, model_id, purchase_price) VALUES ($1, $2, $3)`,
        [playerId, modelId, finalPrice],
      );

      await pool.query(`COMMIT`);
    } catch (e) {
      await pool.query(`ROLLBACK`);
      throw e;
    }

    res.json({ ok: true, bought: model.name, price: finalPrice, discountPct });
  } catch (e) {
    console.error('showroom/buy error', e);
    res.status(500).json({ error: 'purchase failed' });
  }
});

// ========== ROULETTE HELPERS ==========

const ROULETTE_REWARDS = [
  { name: 'Vehicul Suvenir', tier: 'legendary', itemType: null, valueMin: 2_000_000, valueMax: 5_000_000 },
  { name: 'VIP Gold', tier: 'epic', itemType: 'VIP_GOLD', valueMin: 0, valueMax: 0 },
  { name: 'VIP Silver', tier: 'epic', itemType: 'VIP_SILVER', valueMin: 0, valueMax: 0 },
  { name: 'Mystery Box', tier: 'epic', itemType: 'MYSTERY_BOX', valueMin: 5_000, valueMax: 10_000_000 },
  { name: 'Fragmente Ruleta', tier: 'rare', itemType: 'ROULETTE_FRAGMENTS', valueMin: 5, valueMax: 5 },
  { name: 'FlowCoins', tier: 'rare', itemType: null, valueMin: 10, valueMax: 10 },
  { name: 'Slot Vehicle', tier: 'rare', itemType: 'SLOT_VEHICLE', valueMin: 1, valueMax: 1 },
  { name: 'Voucher Showroom', tier: 'rare', itemType: 'VOUCHER_SHOWROOM', valueMin: 1, valueMax: 1 },
  { name: 'Job Boost Pilot', tier: 'uncommon', itemType: 'JOB_BOOST_PILOT', valueMin: 1, valueMax: 1 },
  { name: 'Scutire Taxe', tier: 'uncommon', itemType: 'TAX_EXEMPTION', valueMin: 1, valueMax: 1 },
  { name: 'Xenon Vehicul', tier: 'common', itemType: 'XENON_VEHICLE', valueMin: 5_000, valueMax: 150_000 },
  { name: 'Bani', tier: 'common', itemType: null, valueMin: 25_000, valueMax: 50_000 },
];

const TIER_WEIGHT = { legendary: 2, epic: 8, rare: 18, uncommon: 30, common: 42 };

function pickWeightedReward() {
  const totalWeight = Object.values(TIER_WEIGHT).reduce((a, b) => a + b, 0);
  let roll = Math.random() * totalWeight;
  for (const reward of ROULETTE_REWARDS) {
    roll -= TIER_WEIGHT[reward.tier];
    if (roll <= 0) return reward;
  }
  return ROULETTE_REWARDS[ROULETTE_REWARDS.length - 1];
}

// POST /api/roulette/spin - Spin the roulette
app.post('/api/roulette/spin', requireDb, async (req, res) => {
  try {
    const { playerId, costType } = req.body || {};
    if (!playerId || !costType) return res.status(400).json({ error: 'missing fields' });

    const playerRes = await pool.query(`SELECT * FROM players WHERE player_id = $1`, [playerId]);
    const player = playerRes.rows[0];
    if (!player) return res.status(404).json({ error: 'player not found' });

    const cost = costType === 'flowcoins' ? 30 : 100_000;

    if (costType === 'flowcoins' && player.flow_coins < cost) {
      return res.status(400).json({ error: 'insufficient flowcoins' });
    }
    if (costType === 'cash' && Number(player.clean_money) < cost) {
      return res.status(400).json({ error: 'insufficient funds' });
    }

    // Deduct cost
    if (costType === 'flowcoins') {
      await pool.query(`UPDATE players SET flow_coins = flow_coins - $1 WHERE player_id = $2`, [cost, playerId]);
    } else {
      await pool.query(`UPDATE players SET clean_money = clean_money - $1 WHERE player_id = $2`, [cost, playerId]);
    }

    // Pick reward
    const reward = pickWeightedReward();
    let payout = 0;

    if (reward.valueMin === reward.valueMax && reward.valueMin > 0) {
      payout = reward.valueMin;
    } else if (reward.valueMin < reward.valueMax) {
      payout = Math.floor(reward.valueMin + Math.random() * (reward.valueMax - reward.valueMin));
    }

    // Grant reward
    await pool.query(`BEGIN`);
    try {
      if (reward.name === 'Bani' || reward.name === 'Mystery Box' || reward.name === 'Xenon Vehicul') {
        await pool.query(`UPDATE players SET clean_money = clean_money + $1 WHERE player_id = $2`, [payout, playerId]);
      } else if (reward.name === 'FlowCoins') {
        await pool.query(`UPDATE players SET flow_coins = flow_coins + $1 WHERE player_id = $2`, [payout, playerId]);
      } else if (reward.itemType) {
        await pool.query(
          `INSERT INTO inventory_items (player_id, item_type, quantity) VALUES ($1, $2, $3)
           ON CONFLICT (player_id, item_type) DO UPDATE SET quantity = inventory_items.quantity + EXCLUDED.quantity`,
          [playerId, reward.itemType, payout || 1],
        );

        // Add boost expiry if needed
        if (reward.itemType === 'VIP_GOLD' || reward.itemType === 'VIP_SILVER' || reward.itemType === 'JOB_BOOST_PILOT') {
          const boostHours = reward.itemType === 'JOB_BOOST_PILOT' ? 12 : 6 + Math.floor(Math.random() * 7);
          await pool.query(
            `INSERT INTO active_boosts (player_id, boost_type, expires_at)
             VALUES ($1, $2, NOW() + INTERVAL '${boostHours} hours')`,
            [playerId, reward.itemType],
          );
        }
      }

      await pool.query(`COMMIT`);
    } catch (e) {
      await pool.query(`ROLLBACK`);
      throw e;
    }

    // Return result
    const updatedPlayerRes = await pool.query(`SELECT flow_coins, clean_money, roulette_fragments FROM players WHERE player_id = $1`, [playerId]);
    const updatedPlayer = updatedPlayerRes.rows[0];

    res.json({
      rewardType: reward.itemType || 'cash',
      rewardName: reward.name,
      tier: reward.tier,
      payout,
      player: {
        cleanMoney: Number(updatedPlayer.clean_money),
        flowCoins: updatedPlayer.flow_coins,
        rouletteFragments: updatedPlayer.roulette_fragments,
      },
    });
  } catch (e) {
    console.error('roulette spin error', e);
    res.status(500).json({ error: 'spin failed' });
  }
});

// POST /api/mystery/open - Open a mystery box
app.post('/api/mystery/open', requireDb, async (req, res) => {
  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    // Get a random clothing item
    const clothRes = await pool.query(
      `SELECT id, name, category, rarity, min_value, max_value FROM clothing_items ORDER BY RANDOM() LIMIT 1`,
    );
    const cloth = clothRes.rows[0];
    if (!cloth) return res.status(404).json({ error: 'no clothing items' });

    const marketValue = Math.floor(cloth.min_value + Math.random() * (cloth.max_value - cloth.min_value));

    res.json({
      clothing: {
        id: cloth.id,
        name: cloth.name,
        category: cloth.category,
        rarity: cloth.rarity,
        marketValue,
      },
    });
  } catch (e) {
    console.error('mystery open error', e);
    res.status(500).json({ error: 'open failed' });
  }
});

// POST /api/inventory/use - Use an inventory item
app.post('/api/inventory/use', requireDb, async (req, res) => {
  try {
    const { playerId, itemId } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ error: 'missing fields' });

    const itemRes = await pool.query(`SELECT * FROM inventory_items WHERE player_id = $1 AND id = $2`, [playerId, itemId]);
    const item = itemRes.rows[0];
    if (!item) return res.status(404).json({ error: 'item not found' });
    if (item.quantity < 1) return res.status(400).json({ error: 'not enough items' });

    // Handle different item types
    await pool.query(`BEGIN`);
    try {
      // Deduct item
      await pool.query(`UPDATE inventory_items SET quantity = quantity - 1 WHERE id = $1`, [itemId]);

      if (item.item_type === 'SLOT_VEHICLE') {
        await pool.query(`UPDATE players SET vehicle_slots_extra = vehicle_slots_extra + 1 WHERE player_id = $1`, [playerId]);
      } else if (item.item_type === 'TAX_EXEMPTION') {
        await pool.query(`UPDATE players SET skip_next_tax = TRUE WHERE player_id = $1`, [playerId]);
      } else if (item.item_type === 'JOB_BOOST_PILOT') {
        await pool.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1, 'JOB_BOOST_PILOT', NOW() + INTERVAL '12 hours')`,
          [playerId],
        );
      }

      await pool.query(`COMMIT`);
    } catch (e) {
      await pool.query(`ROLLBACK`);
      throw e;
    }

    res.json({ ok: true, used: item.item_type });
  } catch (e) {
    console.error('inventory use error', e);
    res.status(500).json({ error: 'use failed' });
  }
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

app.get('/api/adminpanelv2/dashboard', requireDb, async (req, res) => {
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

// ========== SEED DATA ==========

const VEHICLE_MODELS = [
  { brand: 'DRAVIA', name: 'Dravia Nova',     base_price: 100_000,   is_jackpot: false },
  { brand: 'DRAVIA', name: 'Dravia Dustera',  base_price: 180_000,   is_jackpot: false },
  { brand: 'BERVIK', name: 'Bervik M4R',      base_price: 650_000,   is_jackpot: false },
  { brand: 'BERVIK', name: 'Bervik X8',       base_price: 900_000,   is_jackpot: false },
  { brand: 'AURON',  name: 'Auron RS7',       base_price: 1_200_000, is_jackpot: false },
  { brand: 'AURON',  name: 'Auron Q8X',       base_price: 1_500_000, is_jackpot: false },
  { brand: 'FERANO', name: 'Ferano Roma X',   base_price: 2_300_000, is_jackpot: false },
  { brand: 'FERANO', name: 'Ferano F8R',      base_price: 2_800_000, is_jackpot: false },
  { brand: 'VORTEK', name: 'Vortek Cayenne X',base_price: 3_200_000, is_jackpot: true  },
  { brand: 'VORTEK', name: 'Vortek 911R',     base_price: 4_000_000, is_jackpot: true  },
];

const CLOTHING_ITEMS = [
  // TSHIRTS
  { name: 'Like Basic Tee',        category: 'TSHIRT', rarity: 'BLUE',         min_value: 10_000,  max_value: 80_000  },
  { name: 'Adibas Sport Tee',      category: 'TSHIRT', rarity: 'LIGHT_PURPLE', min_value: 50_000,  max_value: 200_000 },
  { name: 'Guci Monogram Tee',     category: 'TSHIRT', rarity: 'YELLOW',       min_value: 500_000, max_value: 900_000 },
  { name: 'Balencii Oversize Tee', category: 'TSHIRT', rarity: 'RED',          min_value: 250_000, max_value: 500_000 },
  { name: 'Stone Ilan Patch Tee',  category: 'TSHIRT', rarity: 'DARK_PURPLE',  min_value: 120_000, max_value: 350_000 },
  // PANTS
  { name: 'Like Track Pants',      category: 'PANTS',  rarity: 'BLUE',         min_value: 10_000,  max_value: 80_000  },
  { name: 'Adibas Stripe Pants',   category: 'PANTS',  rarity: 'LIGHT_PURPLE', min_value: 50_000,  max_value: 200_000 },
  { name: 'Levios Urban Jeans',    category: 'PANTS',  rarity: 'DARK_PURPLE',  min_value: 120_000, max_value: 350_000 },
  { name: 'Stone Ilan Cargo Pants',category: 'PANTS',  rarity: 'RED',          min_value: 250_000, max_value: 500_000 },
  { name: 'Balencii Baggy Pants',  category: 'PANTS',  rarity: 'YELLOW',       min_value: 500_000, max_value: 900_000 },
  // SHOES
  { name: 'Like Air Run',          category: 'SHOES',  rarity: 'YELLOW',       min_value: 500_000, max_value: 900_000 },
  { name: 'Adibas Ultra Move',     category: 'SHOES',  rarity: 'RED',          min_value: 250_000, max_value: 500_000 },
  { name: 'Niu Balanse 550',       category: 'SHOES',  rarity: 'DARK_PURPLE',  min_value: 120_000, max_value: 350_000 },
  { name: 'Convoy Classic High',   category: 'SHOES',  rarity: 'LIGHT_PURPLE', min_value: 50_000,  max_value: 200_000 },
  { name: 'Luma Street Rider',     category: 'SHOES',  rarity: 'BLUE',         min_value: 10_000,  max_value: 80_000  },
];

async function seedGameData() {
  try {
    // Seed vehicles
    for (const v of VEHICLE_MODELS) {
      await pool.query(
        `INSERT INTO vehicle_models (brand, name, base_price, is_jackpot, stock)
         VALUES ($1, $2, $3, $4, 10)
         ON CONFLICT (name) DO UPDATE SET
           brand = EXCLUDED.brand,
           base_price = EXCLUDED.base_price,
           is_jackpot = EXCLUDED.is_jackpot`,
        [v.brand, v.name, v.base_price, v.is_jackpot],
      );
    }

    // Seed clothing
    for (const c of CLOTHING_ITEMS) {
      await pool.query(
        `INSERT INTO clothing_items (name, category, rarity, min_value, max_value)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (name) DO UPDATE SET
           category = EXCLUDED.category,
           rarity = EXCLUDED.rarity,
           min_value = EXCLUDED.min_value,
           max_value = EXCLUDED.max_value`,
        [c.name, c.category, c.rarity, c.min_value, c.max_value],
      );
    }

    console.log('✅ Game data seeded successfully');
  } catch (e) {
    console.error('Seed game data error:', e);
  }
}

const startServer = () => {
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on port ${port}`);
    if (!dbReady) {
      console.warn('Database is unavailable. DB-backed API routes will return 503.');
    }
  });
};

if (!pool) {
  console.warn('DATABASE_URL is missing. Starting server in degraded mode.');
  startServer();
} else {
  initDb()
    .then(() => {
      dbReady = true;
      seedGameData().catch(() => {});
      seedBotPosts().catch(() => {});
      setInterval(() => {
        seedBotPosts().catch(() => {});
      }, 5 * 60 * 1000);
      startServer();
    })
    .catch((err) => {
      console.error('DB init failed. Starting server in degraded mode.', err);
      startServer();
    });
}
