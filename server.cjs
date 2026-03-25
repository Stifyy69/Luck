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

// ---------------------------------------------------------------------------
// CORS – allow frontend dev server and production same-origin
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  return next();
});

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ---------------------------------------------------------------------------
// Admin helpers (unchanged)
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// DB INIT – creates all required tables including Batch A tables
// ---------------------------------------------------------------------------
async function initDb() {
  // ---- existing table ----
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

  const existingCols = [
    ['farm_earned', 'BIGINT NOT NULL DEFAULT 0'],
    ['time_pilot', 'DOUBLE PRECISION NOT NULL DEFAULT 0'],
    ['sleep_count', 'BIGINT NOT NULL DEFAULT 0'],
    ['sleep_money', 'BIGINT NOT NULL DEFAULT 0'],
    ['country', 'TEXT'],
    ['city', 'TEXT'],
    ['path', 'TEXT'],
    ['user_agent', 'TEXT'],
    ['last_seen', 'TIMESTAMPTZ'],
    ['updated_at', 'TIMESTAMPTZ NOT NULL DEFAULT NOW()'],
  ];

  for (const [column, definition] of existingCols) {
    await pool.query(`ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS ${column} ${definition};`);
  }

  // ---- Batch A tables ----
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
      name TEXT NOT NULL UNIQUE,
      base_price BIGINT NOT NULL,
      is_jackpot BOOLEAN NOT NULL DEFAULT FALSE,
      stock INT NOT NULL DEFAULT 10
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS owned_vehicles (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      model_id INT NOT NULL REFERENCES vehicle_models(id),
      purchase_price BIGINT NOT NULL,
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      item_type TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}',
      quantity INT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clothing_items (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      rarity TEXT NOT NULL,
      min_value BIGINT NOT NULL,
      max_value BIGINT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS active_boosts (
      id SERIAL PRIMARY KEY,
      player_id TEXT NOT NULL REFERENCES players(player_id),
      boost_type TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Seed vehicle models (idempotent)
  const vehicleModels = [
    { brand: 'DRAVIA', name: 'Dravia Nova',      base_price: 100000,   is_jackpot: false },
    { brand: 'DRAVIA', name: 'Dravia Dustera',   base_price: 180000,   is_jackpot: false },
    { brand: 'BERVIK', name: 'Bervik M4R',       base_price: 650000,   is_jackpot: false },
    { brand: 'BERVIK', name: 'Bervik X8',        base_price: 900000,   is_jackpot: false },
    { brand: 'AURON',  name: 'Auron RS7',        base_price: 1200000,  is_jackpot: false },
    { brand: 'AURON',  name: 'Auron Q8X',        base_price: 1500000,  is_jackpot: false },
    { brand: 'FERANO', name: 'Ferano Roma X',    base_price: 2300000,  is_jackpot: false },
    { brand: 'FERANO', name: 'Ferano F8R',       base_price: 2800000,  is_jackpot: false },
    { brand: 'VORTEK', name: 'Vortek Cayenne X', base_price: 3200000,  is_jackpot: true  },
    { brand: 'VORTEK', name: 'Vortek 911R',      base_price: 4000000,  is_jackpot: true  },
  ];

  for (const v of vehicleModels) {
    await pool.query(
      `INSERT INTO vehicle_models (brand, name, base_price, is_jackpot, stock)
       VALUES ($1,$2,$3,$4,10)
       ON CONFLICT (name) DO NOTHING`,
      [v.brand, v.name, v.base_price, v.is_jackpot],
    );
  }

  // Seed clothing items (idempotent)
  const clothingItems = [
    { name: 'Like Basic Tee',         category: 'TSHIRT', rarity: 'BLUE',         min_value: 10000,  max_value: 80000  },
    { name: 'Adibas Sport Tee',       category: 'TSHIRT', rarity: 'LIGHT_PURPLE', min_value: 50000,  max_value: 200000 },
    { name: 'Guci Monogram Tee',      category: 'TSHIRT', rarity: 'YELLOW',       min_value: 500000, max_value: 900000 },
    { name: 'Balencii Oversize Tee',  category: 'TSHIRT', rarity: 'RED',          min_value: 250000, max_value: 500000 },
    { name: 'Stone Ilan Patch Tee',   category: 'TSHIRT', rarity: 'DARK_PURPLE',  min_value: 120000, max_value: 350000 },
    { name: 'Like Track Pants',       category: 'PANTS',  rarity: 'BLUE',         min_value: 10000,  max_value: 80000  },
    { name: 'Adibas Stripe Pants',    category: 'PANTS',  rarity: 'LIGHT_PURPLE', min_value: 50000,  max_value: 200000 },
    { name: 'Levios Urban Jeans',     category: 'PANTS',  rarity: 'DARK_PURPLE',  min_value: 120000, max_value: 350000 },
    { name: 'Stone Ilan Cargo Pants', category: 'PANTS',  rarity: 'RED',          min_value: 250000, max_value: 500000 },
    { name: 'Balencii Baggy Pants',   category: 'PANTS',  rarity: 'YELLOW',       min_value: 500000, max_value: 900000 },
    { name: 'Like Air Run',           category: 'SHOES',  rarity: 'YELLOW',       min_value: 500000, max_value: 900000 },
    { name: 'Adibas Ultra Move',      category: 'SHOES',  rarity: 'RED',          min_value: 250000, max_value: 500000 },
    { name: 'Niu Balanse 550',        category: 'SHOES',  rarity: 'DARK_PURPLE',  min_value: 120000, max_value: 350000 },
    { name: 'Convoy Classic High',    category: 'SHOES',  rarity: 'LIGHT_PURPLE', min_value: 50000,  max_value: 200000 },
    { name: 'Luma Street Rider',      category: 'SHOES',  rarity: 'BLUE',         min_value: 10000,  max_value: 80000  },
  ];

  for (const c of clothingItems) {
    await pool.query(
      `INSERT INTO clothing_items (name, category, rarity, min_value, max_value)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (name) DO NOTHING`,
      [c.name, c.category, c.rarity, c.min_value, c.max_value],
    );
  }
}

// ---------------------------------------------------------------------------
// Player helpers
// ---------------------------------------------------------------------------
async function getOrCreatePlayer(playerId) {
  const res = await pool.query(
    `INSERT INTO players (player_id) VALUES ($1)
     ON CONFLICT (player_id) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [playerId],
  );
  return res.rows[0];
}

async function getPlayerFull(playerId) {
  const player = await getOrCreatePlayer(playerId);

  const [vehiclesRes, inventoryRes, boostsRes] = await Promise.all([
    pool.query(
      `SELECT ov.id, ov.model_id, vm.name AS model_name, vm.brand,
              ov.purchase_price, ov.purchased_at
       FROM owned_vehicles ov
       JOIN vehicle_models vm ON vm.id = ov.model_id
       WHERE ov.player_id = $1
       ORDER BY ov.purchased_at`,
      [playerId],
    ),
    pool.query(
      `SELECT id, item_type, quantity, metadata, created_at
       FROM inventory_items
       WHERE player_id = $1
       ORDER BY created_at`,
      [playerId],
    ),
    pool.query(
      `SELECT id, boost_type, expires_at
       FROM active_boosts
       WHERE player_id = $1 AND expires_at > NOW()
       ORDER BY expires_at`,
      [playerId],
    ),
  ]);

  const totalSlots = Number(player.vehicle_slots_base) + Number(player.vehicle_slots_extra);
  const usedSlots = vehiclesRes.rows.length;

  return {
    playerId: player.player_id,
    cleanMoney: Number(player.clean_money),
    flowCoins: Number(player.flow_coins),
    rouletteFragments: Number(player.roulette_fragments),
    vehicleSlotsBase: Number(player.vehicle_slots_base),
    vehicleSlotsExtra: Number(player.vehicle_slots_extra),
    totalSlots,
    usedSlots,
    skipNextTax: player.skip_next_tax,
    nextTaxCollectionAt: player.next_tax_collection_at,
    ownedVehicles: vehiclesRes.rows.map((v) => ({
      id: v.id,
      modelId: v.model_id,
      modelName: v.model_name,
      brand: v.brand,
      purchasePrice: Number(v.purchase_price),
      purchasedAt: v.purchased_at,
    })),
    inventory: inventoryRes.rows.map((i) => ({
      id: i.id,
      itemType: i.item_type,
      quantity: i.quantity,
      metadata: i.metadata,
    })),
    activeBoosts: boostsRes.rows.map((b) => ({
      id: b.id,
      boostType: b.boost_type,
      expiresAt: b.expires_at,
    })),
  };
}

// ---------------------------------------------------------------------------
// Weighted roulette
// ---------------------------------------------------------------------------
const ROULETTE_REWARDS = [
  { type: 'VEHICLE_JACKPOT', name: 'Vortek 911R',      subtitle: 'Ultra Rare Jackpot', tier: 'legendary', emoji: '🏎️', weight: 1  },
  { type: 'VEHICLE_JACKPOT', name: 'Vortek Cayenne X', subtitle: 'Very Rare Jackpot',  tier: 'legendary', emoji: '🚗', weight: 3  },
  { type: 'VIP_GOLD',        name: 'VIP Gold',         subtitle: 'x2 bani 10 minute',  tier: 'epic',      emoji: '💎', weight: 4  },
  { type: 'VIP_SILVER',      name: 'VIP Silver',       subtitle: 'x2 bani 5 minute',   tier: 'epic',      emoji: '💠', weight: 6  },
  { type: 'MYSTERY_BOX',     name: 'Mystery Box',      subtitle: 'Haina random',        tier: 'epic',      emoji: '📦', weight: 8  },
  { type: 'FRAGMENTS',       name: 'Fragmente Ruleta', subtitle: 'x5 fragmente',        tier: 'rare',      emoji: '🪙', weight: 15 },
  { type: 'FLOW_COINS',      name: 'FlowCoins',        subtitle: '10 FC',               tier: 'rare',      emoji: '🟠', weight: 12 },
  { type: 'SLOT_VEHICLE',    name: 'Slot Vehicle',     subtitle: '+1 slot vehicul',     tier: 'rare',      emoji: '➕', weight: 12 },
  { type: 'VOUCHER_SHOWROOM',name: 'Voucher Showroom', subtitle: 'Discount showroom',   tier: 'rare',      emoji: '🎟️', weight: 12 },
  { type: 'JOB_BOOST_PILOT', name: 'Pilot Boost x2',  subtitle: 'O singura folosire',  tier: 'uncommon',  emoji: '✈️', weight: 15 },
  { type: 'JOB_BOOST_SLEEP', name: 'Sleep Boost x2',  subtitle: 'O singura folosire',  tier: 'uncommon',  emoji: '😴', weight: 15 },
  { type: 'TAX_EXEMPTION',   name: 'Scutire Taxe',    subtitle: 'Anuleaza urm. taxa',  tier: 'uncommon',  emoji: '💸', weight: 12 },
  { type: 'XENON_VEHICLE',   name: 'Xenon Vehicul',   subtitle: '1 pachet xenon',      tier: 'common',    emoji: '🔩', weight: 20 },
  { type: 'CASH',            name: 'Bani',            subtitle: 'Suma de bani',        tier: 'common',    emoji: '💵', weight: 30 },
];

const TOTAL_WEIGHT = ROULETTE_REWARDS.reduce((s, r) => s + r.weight, 0);

function pickWeightedReward() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const r of ROULETTE_REWARDS) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return ROULETTE_REWARDS[ROULETTE_REWARDS.length - 1];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Random multiple of 5000 between min and max
function randomMult5k(min, max) {
  const slots = Math.floor((max - min) / 5000);
  return min + Math.floor(Math.random() * (slots + 1)) * 5000;
}

// Voucher discount: 10-49% normal, 50% very rare (5% chance)
function randomVoucherDiscount() {
  if (Math.random() < 0.05) return 50;
  return randomInt(10, 49);
}

// ---------------------------------------------------------------------------
// Tax scheduler – processes due players every minute
// ---------------------------------------------------------------------------
async function processTaxes() {
  try {
    const due = await pool.query(
      `SELECT player_id, skip_next_tax FROM players
       WHERE next_tax_collection_at <= NOW()`,
    );

    for (const row of due.rows) {
      const playerId = row.player_id;

      if (row.skip_next_tax) {
        // skip this collection, reset flag and schedule next
        await pool.query(
          `UPDATE players SET skip_next_tax = FALSE,
           next_tax_collection_at = NOW() + INTERVAL '10 minutes'
           WHERE player_id = $1`,
          [playerId],
        );
        continue;
      }

      // Calculate total tax (1% per owned vehicle value)
      const vehiclesRes = await pool.query(
        `SELECT ov.purchase_price
         FROM owned_vehicles ov
         WHERE ov.player_id = $1`,
        [playerId],
      );

      if (vehiclesRes.rows.length === 0) {
        await pool.query(
          `UPDATE players SET next_tax_collection_at = NOW() + INTERVAL '10 minutes'
           WHERE player_id = $1`,
          [playerId],
        );
        continue;
      }

      const totalTax = vehiclesRes.rows.reduce(
        (sum, v) => sum + Math.floor(Number(v.purchase_price) * 0.01),
        0,
      );

      await pool.query(
        `UPDATE players SET
           clean_money = GREATEST(0, clean_money - $1),
           next_tax_collection_at = NOW() + INTERVAL '10 minutes',
           updated_at = NOW()
         WHERE player_id = $2`,
        [totalTax, playerId],
      );
    }
  } catch (e) {
    console.error('Tax processing error:', e);
  }
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(cookieParser());
app.use(express.json({ limit: '256kb' }));

// ---------------------------------------------------------------------------
// Batch A API endpoints
// ---------------------------------------------------------------------------

/** GET /api/bootstrap?playerId=xxx */
app.get('/api/bootstrap', async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });
    const player = await getPlayerFull(playerId);
    res.json(player);
  } catch (e) {
    console.error('bootstrap error', e);
    res.status(500).json({ error: 'bootstrap failed' });
  }
});

/** GET /api/showroom */
app.get('/api/showroom', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, brand, name, base_price, is_jackpot, stock
       FROM vehicle_models
       WHERE is_jackpot = FALSE
       ORDER BY base_price ASC`,
    );
    const brands = {};
    for (const row of result.rows) {
      const brand = row.brand;
      if (!brands[brand]) brands[brand] = [];
      brands[brand].push({
        id: row.id,
        brand: row.brand,
        name: row.name,
        basePrice: Number(row.base_price),
        isJackpot: row.is_jackpot,
        stock: row.stock,
      });
    }
    res.json({ brands });
  } catch (e) {
    console.error('showroom error', e);
    res.status(500).json({ error: 'showroom failed' });
  }
});

/** POST /api/showroom/buy */
app.post('/api/showroom/buy', async (req, res) => {
  try {
    const { playerId, modelId, useVoucher } = req.body || {};
    if (!playerId || !modelId) return res.status(400).json({ error: 'playerId and modelId required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure player exists
      await client.query(
        `INSERT INTO players (player_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [playerId],
      );

      const playerRes = await client.query(
        `SELECT clean_money, vehicle_slots_base, vehicle_slots_extra FROM players WHERE player_id = $1 FOR UPDATE`,
        [playerId],
      );
      const player = playerRes.rows[0];

      const modelRes = await client.query(
        `SELECT id, brand, name, base_price, is_jackpot, stock FROM vehicle_models WHERE id = $1 FOR UPDATE`,
        [modelId],
      );
      const model = modelRes.rows[0];

      if (!model) return res.status(404).json({ error: 'Model not found' });
      if (model.is_jackpot) return res.status(403).json({ error: 'Vortek cannot be purchased in showroom' });
      if (model.stock <= 0) return res.status(409).json({ error: 'Out of stock' });

      // Check slots
      const slotsRes = await client.query(
        `SELECT COUNT(*)::int AS used FROM owned_vehicles WHERE player_id = $1`,
        [playerId],
      );
      const usedSlots = slotsRes.rows[0].used;
      const totalSlots = Number(player.vehicle_slots_base) + Number(player.vehicle_slots_extra);
      if (usedSlots >= totalSlots) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Vehicle slots full' });
      }

      let finalPrice = Number(model.base_price);
      let voucherUsed = false;
      let discountPct = 0;

      // Apply voucher
      if (useVoucher) {
        const voucherRes = await client.query(
          `SELECT id, metadata FROM inventory_items
           WHERE player_id = $1 AND item_type = 'VOUCHER_SHOWROOM' AND quantity > 0
           ORDER BY created_at ASC LIMIT 1`,
          [playerId],
        );
        if (voucherRes.rows.length > 0) {
          const voucher = voucherRes.rows[0];
          discountPct = voucher.metadata?.discount ?? randomVoucherDiscount();
          finalPrice = Math.floor(finalPrice * (1 - discountPct / 100));
          voucherUsed = true;

          // Remove voucher
          if (voucher.metadata?.discount !== undefined) {
            await client.query(
              `UPDATE inventory_items SET quantity = quantity - 1 WHERE id = $1`,
              [voucher.id],
            );
            await client.query(
              `DELETE FROM inventory_items WHERE id = $1 AND quantity <= 0`,
              [voucher.id],
            );
          } else {
            await client.query(
              `DELETE FROM inventory_items WHERE id = $1`,
              [voucher.id],
            );
          }
        }
      }

      if (Number(player.clean_money) < finalPrice) {
        await client.query('ROLLBACK');
        return res.status(402).json({ error: 'Insufficient funds' });
      }

      // Deduct money, decrement stock, create owned vehicle
      await client.query(
        `UPDATE players SET clean_money = clean_money - $1, updated_at = NOW(),
         next_tax_collection_at = COALESCE(next_tax_collection_at, NOW() + INTERVAL '10 minutes')
         WHERE player_id = $2`,
        [finalPrice, playerId],
      );
      await client.query(
        `UPDATE vehicle_models SET stock = stock - 1 WHERE id = $1`,
        [modelId],
      );
      const ownedRes = await client.query(
        `INSERT INTO owned_vehicles (player_id, model_id, purchase_price)
         VALUES ($1, $2, $3) RETURNING id, purchased_at`,
        [playerId, modelId, finalPrice],
      );

      await client.query('COMMIT');

      const stockRes = await pool.query(`SELECT stock FROM vehicle_models WHERE id = $1`, [modelId]);

      res.json({
        ok: true,
        vehicle: {
          id: ownedRes.rows[0].id,
          modelId: model.id,
          modelName: model.name,
          brand: model.brand,
          purchasePrice: finalPrice,
          purchasedAt: ownedRes.rows[0].purchased_at,
        },
        discountPct: voucherUsed ? discountPct : 0,
        newBalance: Number(player.clean_money) - finalPrice,
        stockRemaining: stockRes.rows[0].stock,
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('showroom/buy error', e);
    res.status(500).json({ error: 'purchase failed' });
  }
});

/** POST /api/roulette/spin */
app.post('/api/roulette/spin', async (req, res) => {
  try {
    const { playerId, costType } = req.body || {};
    if (!playerId || !costType) return res.status(400).json({ error: 'playerId and costType required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO players (player_id) VALUES ($1) ON CONFLICT DO NOTHING`,
        [playerId],
      );

      const playerRes = await client.query(
        `SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1 FOR UPDATE`,
        [playerId],
      );
      const player = playerRes.rows[0];

      const SPIN_COST_CASH = 100000;
      const SPIN_COST_FC = 30;

      // Check bonusSpins (fragments ÷ 4 accumulated on client, server trusts fragments)
      const bonusSpins = Math.floor(Number(player.roulette_fragments) / 4);

      if (costType === 'cash') {
        if (Number(player.clean_money) < SPIN_COST_CASH) {
          await client.query('ROLLBACK');
          return res.status(402).json({ error: 'Insufficient cash' });
        }
        await client.query(
          `UPDATE players SET clean_money = clean_money - $1, updated_at = NOW() WHERE player_id = $2`,
          [SPIN_COST_CASH, playerId],
        );
      } else if (costType === 'flowcoins') {
        if (bonusSpins > 0) {
          // consume one bonus spin (4 fragments = 1 spin, so consume 4 fragments)
          await client.query(
            `UPDATE players SET roulette_fragments = roulette_fragments - 4, updated_at = NOW() WHERE player_id = $1`,
            [playerId],
          );
        } else if (Number(player.flow_coins) >= SPIN_COST_FC) {
          await client.query(
            `UPDATE players SET flow_coins = flow_coins - $1, updated_at = NOW() WHERE player_id = $2`,
            [SPIN_COST_FC, playerId],
          );
        } else {
          await client.query('ROLLBACK');
          return res.status(402).json({ error: 'Insufficient FlowCoins' });
        }
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid costType' });
      }

      const reward = pickWeightedReward();
      let payout = 0;
      const metadata = {};

      // Apply reward effect
      if (reward.type === 'FRAGMENTS') {
        await client.query(
          `UPDATE players SET roulette_fragments = roulette_fragments + 5, updated_at = NOW() WHERE player_id = $1`,
          [playerId],
        );
      } else if (reward.type === 'FLOW_COINS') {
        await client.query(
          `UPDATE players SET flow_coins = flow_coins + 10, updated_at = NOW() WHERE player_id = $1`,
          [playerId],
        );
      } else if (reward.type === 'CASH') {
        payout = randomMult5k(25000, 50000);
        await client.query(
          `UPDATE players SET clean_money = clean_money + $1, updated_at = NOW() WHERE player_id = $2`,
          [payout, playerId],
        );
      } else if (reward.type === 'VIP_GOLD') {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'VIP_GOLD',$2)`,
          [playerId, expiresAt],
        );
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'VIP_GOLD','{}',1)`,
          [playerId],
        );
        metadata.expiresAt = expiresAt;
      } else if (reward.type === 'VIP_SILVER') {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'VIP_SILVER',$2)`,
          [playerId, expiresAt],
        );
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'VIP_SILVER','{}',1)`,
          [playerId],
        );
        metadata.expiresAt = expiresAt;
      } else if (reward.type === 'MYSTERY_BOX') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'MYSTERY_BOX','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'SLOT_VEHICLE') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'SLOT_VEHICLE','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'VOUCHER_SHOWROOM') {
        const discount = randomVoucherDiscount();
        metadata.discount = discount;
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'VOUCHER_SHOWROOM',$2,1)`,
          [playerId, JSON.stringify({ discount })],
        );
      } else if (reward.type === 'JOB_BOOST_PILOT') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'JOB_BOOST_PILOT','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'JOB_BOOST_SLEEP') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'JOB_BOOST_SLEEP','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'TAX_EXEMPTION') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'TAX_EXEMPTION','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'XENON_VEHICLE') {
        await client.query(
          `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
           VALUES ($1,'XENON_VEHICLE','{}',1)`,
          [playerId],
        );
      } else if (reward.type === 'VEHICLE_JACKPOT') {
        // Find the model and add as owned vehicle
        const modelRes = await client.query(
          `SELECT id, base_price FROM vehicle_models WHERE name = $1`,
          [reward.name],
        );
        if (modelRes.rows.length > 0) {
          const model = modelRes.rows[0];
          // Ensure player has a slot or grant one
          const slotsRes = await client.query(
            `SELECT vehicle_slots_base + vehicle_slots_extra AS total,
             (SELECT COUNT(*)::int FROM owned_vehicles WHERE player_id = $1) AS used
             FROM players WHERE player_id = $1`,
            [playerId],
          );
          const { total, used } = slotsRes.rows[0];
          if (used >= total) {
            await client.query(
              `UPDATE players SET vehicle_slots_extra = vehicle_slots_extra + 1 WHERE player_id = $1`,
              [playerId],
            );
          }
          await client.query(
            `UPDATE players SET next_tax_collection_at =
             COALESCE(next_tax_collection_at, NOW() + INTERVAL '10 minutes')
             WHERE player_id = $1`,
            [playerId],
          );
          await client.query(
            `INSERT INTO owned_vehicles (player_id, model_id, purchase_price) VALUES ($1,$2,$3)`,
            [playerId, model.id, model.base_price],
          );
          metadata.vehicleName = reward.name;
        }
      }

      await client.query('COMMIT');

      // Return updated balances
      const updatedRes = await pool.query(
        `SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1`,
        [playerId],
      );
      const updated = updatedRes.rows[0];

      res.json({
        rewardType: reward.type,
        rewardName: reward.name,
        rewardSubtitle: reward.subtitle,
        tier: reward.tier,
        emoji: reward.emoji,
        payout,
        metadata,
        player: {
          cleanMoney: Number(updated.clean_money),
          flowCoins: Number(updated.flow_coins),
          rouletteFragments: Number(updated.roulette_fragments),
        },
      });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('roulette/spin error', e);
    res.status(500).json({ error: 'spin failed' });
  }
});

/** POST /api/mystery/open */
app.post('/api/mystery/open', async (req, res) => {
  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const boxRes = await client.query(
        `SELECT id, quantity FROM inventory_items
         WHERE player_id = $1 AND item_type = 'MYSTERY_BOX' AND quantity > 0
         ORDER BY created_at ASC LIMIT 1 FOR UPDATE`,
        [playerId],
      );

      if (boxRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'No Mystery Box in inventory' });
      }

      const box = boxRes.rows[0];
      // Remove one box
      if (box.quantity > 1) {
        await client.query(
          `UPDATE inventory_items SET quantity = quantity - 1 WHERE id = $1`,
          [box.id],
        );
      } else {
        await client.query(`DELETE FROM inventory_items WHERE id = $1`, [box.id]);
      }

      // Pick random clothing
      const clothRes = await client.query(
        `SELECT id, name, category, rarity, min_value, max_value
         FROM clothing_items ORDER BY RANDOM() LIMIT 1`,
      );
      const cloth = clothRes.rows[0];

      if (!cloth) {
        await client.query('ROLLBACK');
        return res.status(500).json({ error: 'No clothing items defined' });
      }

      // Market value with volatility
      const range = Number(cloth.max_value) - Number(cloth.min_value);
      const marketValue = Math.floor(Number(cloth.min_value) + Math.random() * range);

      // Add clothing to inventory
      await client.query(
        `INSERT INTO inventory_items (player_id, item_type, metadata, quantity)
         VALUES ($1,'CLOTHING',$2,1)`,
        [playerId, JSON.stringify({ clothingId: cloth.id, name: cloth.name, rarity: cloth.rarity, category: cloth.category, marketValue })],
      );

      await client.query('COMMIT');

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
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('mystery/open error', e);
    res.status(500).json({ error: 'open failed' });
  }
});

/** POST /api/inventory/use */
app.post('/api/inventory/use', async (req, res) => {
  try {
    const { playerId, itemId } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ error: 'playerId and itemId required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemRes = await client.query(
        `SELECT id, item_type, metadata, quantity FROM inventory_items
         WHERE id = $1 AND player_id = $2 FOR UPDATE`,
        [itemId, playerId],
      );

      if (itemRes.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Item not found' });
      }

      const item = itemRes.rows[0];
      let effect = '';
      const responseMetadata = {};

      if (item.item_type === 'SLOT_VEHICLE') {
        await client.query(
          `UPDATE players SET vehicle_slots_extra = vehicle_slots_extra + 1, updated_at = NOW()
           WHERE player_id = $1`,
          [playerId],
        );
        effect = 'vehicle_slot_added';
      } else if (item.item_type === 'TAX_EXEMPTION') {
        await client.query(
          `UPDATE players SET skip_next_tax = TRUE, updated_at = NOW() WHERE player_id = $1`,
          [playerId],
        );
        effect = 'tax_exemption_activated';
      } else if (item.item_type === 'JOB_BOOST_PILOT') {
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'JOB_PILOT',$2)`,
          [playerId, expiresAt],
        );
        responseMetadata.expiresAt = expiresAt;
        effect = 'pilot_boost_activated';
      } else if (item.item_type === 'JOB_BOOST_SLEEP') {
        const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'JOB_SLEEP',$2)`,
          [playerId, expiresAt],
        );
        responseMetadata.expiresAt = expiresAt;
        effect = 'sleep_boost_activated';
      } else if (item.item_type === 'VIP_GOLD') {
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'VIP_GOLD',$2)`,
          [playerId, expiresAt],
        );
        responseMetadata.expiresAt = expiresAt;
        effect = 'vip_gold_activated';
      } else if (item.item_type === 'VIP_SILVER') {
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await client.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1,'VIP_SILVER',$2)`,
          [playerId, expiresAt],
        );
        responseMetadata.expiresAt = expiresAt;
        effect = 'vip_silver_activated';
      } else if (item.item_type === 'MYSTERY_BOX') {
        // Redirect to mystery/open logic
        await client.query('ROLLBACK');
        client.release();
        return res.status(400).json({ error: 'Use POST /api/mystery/open for Mystery Box' });
      } else {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Item type ${item.item_type} not usable via this endpoint` });
      }

      // Remove one-use item
      if (item.quantity > 1) {
        await client.query(
          `UPDATE inventory_items SET quantity = quantity - 1 WHERE id = $1`,
          [item.id],
        );
      } else {
        await client.query(`DELETE FROM inventory_items WHERE id = $1`, [item.id]);
      }

      await client.query('COMMIT');
      res.json({ ok: true, effect, metadata: responseMetadata });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (e) {
    console.error('inventory/use error', e);
    res.status(500).json({ error: 'use failed' });
  }
});

// ---------------------------------------------------------------------------
// Existing endpoints (unchanged)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Static / SPA fallback
// ---------------------------------------------------------------------------
app.use(express.static(distPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
initDb()
  .then(() => {
    // Run tax processor every 60 seconds
    setInterval(processTaxes, 60_000);

    app.listen(port, '0.0.0.0', () => {
      console.log(`Server listening on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('DB init failed', err);
    process.exit(1);
  });
