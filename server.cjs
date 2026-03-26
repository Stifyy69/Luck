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
      display_name TEXT,
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
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS display_name TEXT;
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
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      purchase_source TEXT NOT NULL DEFAULT 'SHOWROOM'
    );
  `);

  await pool.query(`
    ALTER TABLE owned_vehicles
    ADD COLUMN IF NOT EXISTS purchase_source TEXT NOT NULL DEFAULT 'SHOWROOM';
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
      seller_type TEXT NOT NULL DEFAULT 'PLAYER',
      seller_player_id TEXT,
      seller_npc_id TEXT,
      asset_type TEXT NOT NULL,
      asset_ref_id INT,
      asset_name TEXT NOT NULL DEFAULT 'Unknown Listing',
      asset_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ask_price BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS seller_type TEXT;`);
  await pool.query(`ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS asset_name TEXT;`);
  await pool.query(`ALTER TABLE market_listings ADD COLUMN IF NOT EXISTS asset_metadata JSONB;`);
  await pool.query(`ALTER TABLE market_listings ALTER COLUMN seller_type SET DEFAULT 'PLAYER';`);
  await pool.query(`ALTER TABLE market_listings ALTER COLUMN asset_name SET DEFAULT 'Unknown Listing';`);
  await pool.query(`ALTER TABLE market_listings ALTER COLUMN asset_metadata SET DEFAULT '{}'::jsonb;`);
  await pool.query(`
    UPDATE market_listings
    SET seller_type = CASE WHEN seller_npc_id IS NOT NULL THEN 'NPC' ELSE 'PLAYER' END
    WHERE seller_type IS NULL OR seller_type = '';
  `);
  await pool.query(`
    UPDATE market_listings
    SET asset_name = CASE
      WHEN asset_type = 'VEHICLE' THEN 'Vehicle Listing'
      WHEN asset_type = 'CLOTHING' THEN 'Clothing Listing'
      WHEN asset_type = 'XENON_VEHICLE' THEN 'Xenon Vehicle'
      ELSE 'Unknown Listing'
    END
    WHERE asset_name IS NULL OR asset_name = '';
  `);
  await pool.query(`
    UPDATE market_listings
    SET asset_metadata = '{}'::jsonb
    WHERE asset_metadata IS NULL;
  `);
  await pool.query(`ALTER TABLE market_listings ALTER COLUMN asset_name SET NOT NULL;`);
  await pool.query(`ALTER TABLE market_listings ALTER COLUMN asset_metadata SET NOT NULL;`);

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

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function asIso(value) {
  return value ? new Date(value).toISOString() : null;
}

function getVehicleImagePath(name) {
  return `/cars/${name}.png`;
}

function normalizeNpcId(value) {
  return String(value ?? '');
}

function getClothingFolder(category) {
  if (category === 'PANTS') return 'pants';
  if (category === 'SHOES') return 'shoes';
  return 'tshirt';
}

function getClothingImagePath(name, category) {
  return `/Clothes/${getClothingFolder(category)}/${name}.png`;
}

function randomInt(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

const NPC_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

function getNpcDynamicMultiplier() {
  // Common pricing swings: -20% to +40%, with rare hype spikes up to +200%.
  if (Math.random() < 0.04) {
    return 1 + Math.random() * 2;
  }
  return 0.8 + Math.random() * 0.6;
}

function toDynamicNpcPrice(basePrice) {
  return Math.max(1, Math.floor(Number(basePrice) * getNpcDynamicMultiplier()));
}

async function ensurePlayer(db, playerId) {
  await db.query(
    `INSERT INTO players (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
    [playerId],
  );
  const result = await db.query(`SELECT * FROM players WHERE player_id = $1`, [playerId]);
  return result.rows[0];
}

async function addInventoryItem(db, playerId, itemType, quantity = 1, metadata = {}) {
  if (itemType === 'CLOTHING') {
    const inserted = await db.query(
      `INSERT INTO inventory_items (player_id, item_type, quantity, metadata)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, item_type, quantity, metadata`,
      [playerId, itemType, quantity, JSON.stringify(metadata)],
    );
    return inserted.rows[0];
  }

  const existing = await db.query(
    `SELECT id, quantity FROM inventory_items
     WHERE player_id = $1 AND item_type = $2 AND metadata = $3::jsonb
     LIMIT 1`,
    [playerId, itemType, JSON.stringify(metadata)],
  );

  if (existing.rows[0]) {
    const updated = await db.query(
      `UPDATE inventory_items
       SET quantity = quantity + $2
       WHERE id = $1
       RETURNING id, item_type, quantity, metadata`,
      [existing.rows[0].id, quantity],
    );
    return updated.rows[0];
  }

  const inserted = await db.query(
    `INSERT INTO inventory_items (player_id, item_type, quantity, metadata)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, item_type, quantity, metadata`,
    [playerId, itemType, quantity, JSON.stringify(metadata)],
  );
  return inserted.rows[0];
}

async function consumeInventoryItem(db, itemId, amount = 1) {
  const updated = await db.query(
    `UPDATE inventory_items
     SET quantity = quantity - $2
     WHERE id = $1 AND quantity >= $2
     RETURNING id, player_id, item_type, quantity, metadata`,
    [itemId, amount],
  );

  if (!updated.rows[0]) {
    throw new Error('item missing or insufficient quantity');
  }

  if (updated.rows[0].quantity <= 0) {
    await db.query(`DELETE FROM inventory_items WHERE id = $1`, [itemId]);
  }

  return updated.rows[0];
}

async function ensureVehicleCapacity(db, playerId) {
  const [playerResult, vehiclesResult] = await Promise.all([
    db.query(`SELECT vehicle_slots_base, vehicle_slots_extra FROM players WHERE player_id = $1`, [playerId]),
    db.query(`SELECT COUNT(*)::INT AS count FROM owned_vehicles WHERE player_id = $1`, [playerId]),
  ]);

  const player = playerResult.rows[0];
  const usedSlots = vehiclesResult.rows[0]?.count ?? 0;
  const totalSlots = (player?.vehicle_slots_base ?? 0) + (player?.vehicle_slots_extra ?? 0);
  if (usedSlots >= totalSlots) {
    throw new Error('no vehicle slots available');
  }
}

function findVehicleSeedByName(name) {
  return VEHICLE_MODELS.find((vehicle) => vehicle.name === name) ?? null;
}

function findClothingSeedByName(name) {
  return CLOTHING_ITEMS.find((item) => item.name === name) ?? null;
}

async function resolveListingAsset(db, listing) {
  if (listing.asset_type === 'VEHICLE') {
    if (listing.seller_npc_id) {
      const result = await db.query(
        `SELECT id, brand, name, base_price, is_jackpot FROM vehicle_models WHERE id = $1`,
        [listing.asset_ref_id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        assetName: row.name,
        assetMetadata: {
          id: row.id,
          brand: row.brand,
          basePrice: Number(row.base_price),
          marketPrice: Number(row.base_price),
          isJackpot: row.is_jackpot,
          imagePath: getVehicleImagePath(row.name),
        },
      };
    }

    const result = await db.query(
      `SELECT ov.id, ov.purchase_price, vm.brand, vm.name
       FROM owned_vehicles ov
       JOIN vehicle_models vm ON vm.id = ov.model_id
       WHERE ov.id = $1`,
      [listing.asset_ref_id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      assetName: row.name,
      assetMetadata: {
        id: row.id,
        brand: row.brand,
        purchasePrice: Number(row.purchase_price),
        marketPrice: Number(row.purchase_price),
        imagePath: getVehicleImagePath(row.name),
      },
    };
  }

  if (listing.asset_type === 'CLOTHING') {
    if (listing.seller_npc_id) {
      const result = await db.query(
        `SELECT id, name, category, rarity, min_value, max_value FROM clothing_items WHERE id = $1`,
        [listing.asset_ref_id],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        assetName: row.name,
        assetMetadata: {
          id: row.id,
          name: row.name,
          category: row.category,
          rarity: row.rarity,
          marketValue: Math.round((Number(row.min_value) + Number(row.max_value)) / 2),
          marketPrice: Math.round((Number(row.min_value) + Number(row.max_value)) / 2),
          imagePath: getClothingImagePath(row.name, row.category),
        },
      };
    }

    const result = await db.query(
      `SELECT id, metadata FROM inventory_items WHERE id = $1 AND item_type = 'CLOTHING'`,
      [listing.asset_ref_id],
    );
    const row = result.rows[0];
    if (!row) return null;
    const metadata = row.metadata || {};
    return {
      assetName: metadata.name || 'Clothing',
      assetMetadata: {
        ...metadata,
        id: row.id,
        imagePath: getClothingImagePath(metadata.name || 'Like Basic Tee', metadata.category || 'TSHIRT'),
      },
    };
  }

  const result = await db.query(
    `SELECT id, metadata FROM inventory_items WHERE id = $1 AND item_type = 'XENON_VEHICLE'`,
    [listing.asset_ref_id],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    assetName: 'Xenon Vehicle',
    assetMetadata: {
      id: row.id,
      ...row.metadata,
    },
  };
}

async function transferListingAsset(db, listing, buyerPlayerId) {
  if (listing.asset_type === 'VEHICLE') {
    await ensureVehicleCapacity(db, buyerPlayerId);

    if (listing.seller_npc_id) {
      const result = await db.query(`SELECT id, name, base_price FROM vehicle_models WHERE id = $1`, [listing.asset_ref_id]);
      const model = result.rows[0];
      if (!model) throw new Error('vehicle not found');
      const inserted = await db.query(
        `INSERT INTO owned_vehicles (player_id, model_id, purchase_price)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [buyerPlayerId, model.id, Number(model.base_price)],
      );
      await db.query(`UPDATE owned_vehicles SET purchase_source = 'CNN' WHERE id = $1`, [inserted.rows[0].id]);
      return inserted.rows[0].id;
    }

    const updated = await db.query(
      `UPDATE owned_vehicles
       SET player_id = $1, purchase_source = 'CNN'
       WHERE id = $2 AND player_id = $3
       RETURNING id`,
      [buyerPlayerId, listing.asset_ref_id, listing.seller_player_id],
    );
    if (!updated.rows[0]) throw new Error('vehicle transfer failed');
    return updated.rows[0].id;
  }

  if (listing.asset_type === 'CLOTHING') {
    if (listing.seller_npc_id) {
      const result = await db.query(
        `SELECT name, category, rarity, min_value, max_value FROM clothing_items WHERE id = $1`,
        [listing.asset_ref_id],
      );
      const item = result.rows[0];
      if (!item) throw new Error('clothing not found');
      const marketValue = randomInt(Number(item.min_value), Number(item.max_value));
      const inserted = await addInventoryItem(db, buyerPlayerId, 'CLOTHING', 1, {
        name: item.name,
        category: item.category,
        rarity: item.rarity,
        marketValue,
        source: 'CNN',
        imagePath: getClothingImagePath(item.name, item.category),
      });
      return inserted.id;
    }

    const result = await db.query(
      `SELECT id, player_id, metadata FROM inventory_items
       WHERE id = $1 AND player_id = $2 AND item_type = 'CLOTHING' AND quantity > 0`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    const item = result.rows[0];
    if (!item) throw new Error('clothing transfer failed');
    await consumeInventoryItem(db, item.id, 1);
    const inserted = await addInventoryItem(db, buyerPlayerId, 'CLOTHING', 1, {
      ...(item.metadata || {}),
      source: 'CNN',
    });
    return inserted.id;
  }

  if (listing.seller_npc_id) {
    const inserted = await addInventoryItem(db, buyerPlayerId, 'XENON_VEHICLE', 1, {});
    return inserted.id;
  }

  const result = await db.query(
    `SELECT id, player_id, metadata FROM inventory_items
     WHERE id = $1 AND player_id = $2 AND item_type = 'XENON_VEHICLE' AND quantity > 0`,
    [listing.asset_ref_id, listing.seller_player_id],
  );
  const item = result.rows[0];
  if (!item) throw new Error('xenon transfer failed');
  await consumeInventoryItem(db, item.id, 1);
  const inserted = await addInventoryItem(db, buyerPlayerId, 'XENON_VEHICLE', 1, item.metadata || {});
  return inserted.id;
}

async function buildMarketListingView(db, listing, viewerPlayerId) {
  const asset = await resolveListingAsset(db, listing);
  if (!asset) return null;

  let sellerName = listing.seller_player_id;
  let sellerEmoji = '👤';
  let sellerType = 'PLAYER';

  if (listing.seller_npc_id) {
    const npc = NPC_SELLERS.find((entry) => normalizeNpcId(entry.id) === normalizeNpcId(listing.seller_npc_id));
    sellerName = npc?.name || 'NPC Seller';
    sellerEmoji = npc?.emoji || '🕵️';
    sellerType = 'NPC';
  }

  return {
    id: listing.id,
    sellerType,
    sellerPlayerId: listing.seller_player_id,
    sellerName,
    sellerEmoji,
    assetType: listing.asset_type,
    assetRefId: listing.asset_ref_id,
    assetName: asset.assetName,
    assetMetadata: asset.assetMetadata,
    askPrice: Number(listing.ask_price),
    isOwn: listing.seller_player_id === viewerPlayerId,
    createdAt: asIso(listing.created_at),
  };
}

async function findActiveListingByHint(db, hint) {
  if (!hint) return null;

  const assetType = String(hint.assetType || '');
  const assetRefId = Number(hint.assetRefId);
  if (!assetType || !Number.isInteger(assetRefId) || assetRefId <= 0) return null;

  if (String(hint.sellerType || '').toUpperCase() === 'NPC') {
    const npcMatch = await db.query(
      `SELECT *
       FROM market_listings
       WHERE status = 'ACTIVE'
         AND seller_npc_id IS NOT NULL
         AND asset_type = $1
         AND asset_ref_id = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [assetType, assetRefId],
    );
    return npcMatch.rows[0] || null;
  }

  const sellerPlayerId = String(hint.sellerPlayerId || '');
  if (!sellerPlayerId) return null;

  const playerMatch = await db.query(
    `SELECT *
     FROM market_listings
     WHERE status = 'ACTIVE'
       AND seller_player_id = $1
       AND asset_type = $2
       AND asset_ref_id = $3
     ORDER BY created_at DESC
     LIMIT 1`,
    [sellerPlayerId, assetType, assetRefId],
  );
  return playerMatch.rows[0] || null;
}

async function settleListingSale(db, listing, buyerPlayerId, salePrice, acceptedOfferId = null) {
  if (listing.seller_player_id && listing.seller_player_id === buyerPlayerId) {
    throw new Error('cannot buy your own listing');
  }

  const buyer = await ensurePlayer(db, buyerPlayerId);
  if (Number(buyer.clean_money) < salePrice) {
    throw new Error('insufficient funds');
  }

  if (listing.seller_player_id) {
    await ensurePlayer(db, listing.seller_player_id);
  }

  await db.query(
    `UPDATE players SET clean_money = clean_money - $1 WHERE player_id = $2`,
    [salePrice, buyerPlayerId],
  );

  if (listing.seller_player_id) {
    await db.query(
      `UPDATE players SET clean_money = clean_money + $1 WHERE player_id = $2`,
      [salePrice, listing.seller_player_id],
    );
  }

  await transferListingAsset(db, listing, buyerPlayerId);

  await db.query(
    `UPDATE market_listings
     SET status = 'SOLD', updated_at = NOW()
     WHERE id = $1`,
    [listing.id],
  );

  await db.query(
    `UPDATE market_offers
     SET status = CASE WHEN id = $2 THEN 'ACCEPTED' ELSE 'REJECTED' END,
         updated_at = NOW()
     WHERE listing_id = $1 AND status = 'PENDING'`,
    [listing.id, acceptedOfferId],
  );
}

async function estimatePlayerListingMarketPrice(db, listing) {
  if (listing.asset_type === 'VEHICLE') {
    const vehicle = await db.query(
      `SELECT vm.base_price
       FROM owned_vehicles ov
       JOIN vehicle_models vm ON vm.id = ov.model_id
       WHERE ov.id = $1 AND ov.player_id = $2`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    if (!vehicle.rows[0]) return null;
    return Number(vehicle.rows[0].base_price);
  }

  if (listing.asset_type === 'CLOTHING') {
    const item = await db.query(
      `SELECT metadata
       FROM inventory_items
       WHERE id = $1 AND player_id = $2 AND item_type = 'CLOTHING' AND quantity > 0`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    const row = item.rows[0];
    if (!row) return null;
    const meta = row.metadata || {};
    const marketValue = Number(meta.marketValue || 0);
    if (marketValue > 0) return marketValue;

    const byCatalog = await db.query(
      `SELECT min_value, max_value
       FROM clothing_items
       WHERE name = $1
       LIMIT 1`,
      [meta.name || ''],
    );
    if (byCatalog.rows[0]) {
      return Math.round((Number(byCatalog.rows[0].min_value) + Number(byCatalog.rows[0].max_value)) / 2);
    }
    return null;
  }

  if (listing.asset_type === 'XENON_VEHICLE') {
    const item = await db.query(
      `SELECT metadata
       FROM inventory_items
       WHERE id = $1 AND player_id = $2 AND item_type = 'XENON_VEHICLE' AND quantity > 0`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    const row = item.rows[0];
    if (!row) return null;
    const meta = row.metadata || {};
    const inferred = Number(meta.marketPrice || meta.marketValue || 0);
    return inferred > 0 ? inferred : 250000;
  }

  return null;
}

async function settleNpcPurchaseOfPlayerListing(db, listing, salePrice) {
  if (!listing.seller_player_id) {
    throw new Error('player listing required');
  }

  await db.query(
    `UPDATE players SET clean_money = clean_money + $1, updated_at = NOW() WHERE player_id = $2`,
    [salePrice, listing.seller_player_id],
  );

  if (listing.asset_type === 'VEHICLE') {
    const removed = await db.query(
      `DELETE FROM owned_vehicles
       WHERE id = $1 AND player_id = $2
       RETURNING id`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    if (!removed.rows[0]) throw new Error('vehicle asset unavailable');
  } else {
    const removed = await db.query(
      `UPDATE inventory_items
       SET quantity = quantity - 1
       WHERE id = $1 AND player_id = $2 AND quantity > 0
       RETURNING id, quantity`,
      [listing.asset_ref_id, listing.seller_player_id],
    );
    if (!removed.rows[0]) throw new Error('inventory asset unavailable');
    if (removed.rows[0].quantity <= 0) {
      await db.query(`DELETE FROM inventory_items WHERE id = $1`, [listing.asset_ref_id]);
    }
  }

  await db.query(
    `UPDATE market_listings
     SET status = 'SOLD', updated_at = NOW()
     WHERE id = $1`,
    [listing.id],
  );

  await db.query(
    `UPDATE market_offers
     SET status = 'REJECTED', updated_at = NOW()
     WHERE listing_id = $1 AND status = 'PENDING'`,
    [listing.id],
  );
}

async function runNpcAutoBuyerSweep() {
  const soldCount = await withTransaction(async (db) => {
    const listings = await db.query(
      `SELECT ml.*
       FROM market_listings ml
       WHERE ml.status = 'ACTIVE' AND ml.seller_player_id IS NOT NULL
       ORDER BY ml.created_at ASC
       LIMIT 30
       FOR UPDATE SKIP LOCKED`,
    );

    const candidates = [];
    for (const listing of listings.rows) {
      const marketPrice = await estimatePlayerListingMarketPrice(db, listing);
      if (!marketPrice || marketPrice <= 0) continue;

      const askPrice = Number(listing.ask_price);
      if (askPrice <= 0) continue;

      const ratio = askPrice / marketPrice;
      let chance = 0;
      if (ratio <= 0.75) chance = 0.58;
      else if (ratio <= 0.9) chance = 0.4;
      else if (ratio <= 1.0) chance = 0.26;
      else if (ratio <= 1.1) chance = 0.12;

      if (chance > 0 && Math.random() < chance) {
        candidates.push({ listing, ratio });
      }
    }

    if (candidates.length === 0) return 0;

    candidates.sort((a, b) => a.ratio - b.ratio);
    const maxBuys = Math.min(2, candidates.length);
    const buysThisCycle = Math.max(1, randomInt(1, maxBuys));
    let sold = 0;

    for (let i = 0; i < buysThisCycle; i += 1) {
      const picked = candidates[i];
      try {
        await settleNpcPurchaseOfPlayerListing(db, picked.listing, Number(picked.listing.ask_price));
        sold += 1;
      } catch {
        await db.query(
          `UPDATE market_listings SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
          [picked.listing.id],
        );
      }
    }

    return sold;
  });

  return soldCount;
}

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

app.post('/api/market/buy', requireDb, async (req, res) => {
  try {
    const { playerId, listingId, listingHint } = req.body || {};
    const normalizedListingId = Number(listingId);
    if (!playerId || !Number.isInteger(normalizedListingId) || normalizedListingId <= 0) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const soldFor = await withTransaction(async (db) => {
      await ensurePlayer(db, playerId);
      const listingResult = await db.query(
        `SELECT * FROM market_listings WHERE id = $1 AND status = 'ACTIVE'`,
        [normalizedListingId],
      );
      let listing = listingResult.rows[0];
      if (!listing) {
        listing = await findActiveListingByHint(db, listingHint);
      }
      if (!listing) throw new Error('listing unavailable');

      await settleListingSale(db, listing, playerId, Number(listing.ask_price));
      return Number(listing.ask_price);
    });

    res.json({ ok: true, boughtFor: soldFor });
  } catch (error) {
    res.status(400).json({ error: error.message || 'market buy failed' });
  }
});

app.post('/api/market/offer', requireDb, async (req, res) => {
  try {
    const { playerId, listingId, offeredPrice, listingHint } = req.body || {};
    const normalizedListingId = Number(listingId);
    const normalizedOfferPrice = Math.floor(Number(offeredPrice));
    if (!playerId || !Number.isInteger(normalizedListingId) || normalizedListingId <= 0 || !Number.isFinite(normalizedOfferPrice) || normalizedOfferPrice <= 0) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const result = await withTransaction(async (db) => {
      await ensurePlayer(db, playerId);
      const listingResult = await db.query(
        `SELECT * FROM market_listings WHERE id = $1 AND status = 'ACTIVE'`,
        [normalizedListingId],
      );
      let listing = listingResult.rows[0];
      if (!listing) {
        listing = await findActiveListingByHint(db, listingHint);
      }
      if (!listing) throw new Error('listing unavailable');
      if (listing.seller_player_id === playerId) throw new Error('cannot offer on your own listing');

      const buyerResult = await db.query(`SELECT clean_money FROM players WHERE player_id = $1`, [playerId]);
      if (Number(buyerResult.rows[0]?.clean_money ?? 0) < normalizedOfferPrice) {
        throw new Error('insufficient funds');
      }

      let existingNpcAttempts = 0;
      if (listing.seller_npc_id) {
        const existingAttemptsResult = await db.query(
          `SELECT COUNT(*)::INT AS count
           FROM market_offers
           WHERE listing_id = $1 AND buyer_player_id = $2`,
          [normalizedListingId, playerId],
        );
        existingNpcAttempts = existingAttemptsResult.rows[0]?.count ?? 0;
        if (existingNpcAttempts >= 3) {
          throw new Error('npc negotiation attempts exhausted');
        }
      }

      const inserted = await db.query(
        `INSERT INTO market_offers (listing_id, buyer_player_id, offered_price, status)
         VALUES ($1, $2, $3, $4)
         RETURNING id, created_at`,
        [normalizedListingId, playerId, normalizedOfferPrice, listing.seller_npc_id ? 'REJECTED' : 'PENDING'],
      );

      if (listing.seller_npc_id) {
        const attemptNo = existingNpcAttempts + 1;
        const attemptsLeft = Math.max(0, 3 - attemptNo);

        const accepted = normalizedOfferPrice >= Math.floor(Number(listing.ask_price) * 0.9);
        if (accepted) {
          await db.query(
            `UPDATE market_offers SET status = 'ACCEPTED', updated_at = NOW() WHERE id = $1`,
            [inserted.rows[0].id],
          );
          await settleListingSale(db, listing, playerId, normalizedOfferPrice, inserted.rows[0].id);
          return {
            ...inserted.rows[0],
            negotiation: {
              isNpc: true,
              signal: 'ACCEPT',
              attemptNo,
              attemptsLeft,
              askPrice: Number(listing.ask_price),
            },
          };
        }

        const canCounter = attemptNo < 3 && normalizedOfferPrice >= Math.floor(Number(listing.ask_price) * 0.45);
        const willCounter = canCounter && Math.random() < 0.7;
        if (willCounter) {
          const ask = Number(listing.ask_price);
          const floorPrice = Math.floor(ask * 0.82);
          const midpoint = Math.floor((ask + normalizedOfferPrice) / 2);
          const counterAsk = Math.max(floorPrice, midpoint);
          await db.query(
            `UPDATE market_listings SET ask_price = $2, updated_at = NOW() WHERE id = $1`,
            [normalizedListingId, counterAsk],
          );
          return {
            ...inserted.rows[0],
            negotiation: {
              isNpc: true,
              signal: 'COUNTER',
              attemptNo,
              attemptsLeft,
              askPrice: ask,
              counterAskPrice: counterAsk,
            },
          };
        }

        return {
          ...inserted.rows[0],
          negotiation: {
            isNpc: true,
            signal: 'REJECT',
            attemptNo,
            attemptsLeft,
            askPrice: Number(listing.ask_price),
          },
        };
      }

      return {
        ...inserted.rows[0],
        negotiation: null,
      };
    });

    res.json({
      ok: true,
      offerId: result.id,
      createdAt: asIso(result.created_at),
      negotiation: result.negotiation ?? null,
    });
  } catch (error) {
    res.status(400).json({ error: error.message || 'market offer failed' });
  }
});

app.get('/api/market/listings', async (req, res) => {
  try {
    if (!dbReady || !pool) return res.json({ listings: [] });
    const { playerId } = req.query;
    const npcCount = await pool.query(
      `SELECT COUNT(*)::INT AS count FROM market_listings WHERE seller_npc_id IS NOT NULL AND status = 'ACTIVE'`,
    );
    const activeNpcCount = npcCount.rows[0]?.count ?? 0;
    if (activeNpcCount === 0 || activeNpcCount > 10) {
      await refreshNpcListings();
    }

    const result = await pool.query(
      `SELECT * FROM market_listings WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 100`,
    );
    const listings = (
      await Promise.all(result.rows.map((listing) => buildMarketListingView(pool, listing, playerId || null)))
    ).filter(Boolean);
    res.json({ listings });
  } catch (error) {
    res.status(500).json({ error: 'market listings failed' });
  }
});

app.post('/api/market/list', requireDb, async (req, res) => {
  try {
    const { playerId, assetType, assetRefId, askPrice } = req.body || {};
    const normalizedAssetRefId = Number(assetRefId);
    const normalizedAskPrice = Math.floor(Number(askPrice));
    if (!playerId || !assetType || !Number.isInteger(normalizedAssetRefId) || normalizedAssetRefId <= 0 || !Number.isFinite(normalizedAskPrice) || normalizedAskPrice <= 0) {
      return res.status(400).json({ error: 'missing fields' });
    }

    const created = await withTransaction(async (db) => {
      await ensurePlayer(db, playerId);
      let assetName = 'Unknown Listing';
      let assetMetadata = {};

      if (assetType === 'VEHICLE') {
        const vehicle = await db.query(
          `SELECT ov.id, ov.purchase_price, vm.brand, vm.name
           FROM owned_vehicles ov
           JOIN vehicle_models vm ON vm.id = ov.model_id
           WHERE ov.id = $1 AND ov.player_id = $2`,
          [normalizedAssetRefId, playerId],
        );
        const row = vehicle.rows[0];
        if (!row) throw new Error('vehicle not owned');
        assetName = row.name;
        assetMetadata = {
          id: row.id,
          brand: row.brand,
          purchasePrice: Number(row.purchase_price),
          marketPrice: Number(row.purchase_price),
          imagePath: getVehicleImagePath(row.name),
        };
      } else if (assetType === 'CLOTHING') {
        const clothing = await db.query(
          `SELECT id, metadata
           FROM inventory_items
           WHERE id = $1 AND player_id = $2 AND item_type = 'CLOTHING' AND quantity > 0`,
          [normalizedAssetRefId, playerId],
        );
        const row = clothing.rows[0];
        if (!row) throw new Error('clothing not owned');
        const meta = row.metadata || {};
        assetName = String(meta.name || 'Clothing');
        assetMetadata = {
          ...meta,
          id: row.id,
          imagePath: getClothingImagePath(String(meta.name || 'Like Basic Tee'), String(meta.category || 'TSHIRT')),
        };
      } else if (assetType === 'XENON_VEHICLE') {
        const xenon = await db.query(
          `SELECT id, metadata
           FROM inventory_items
           WHERE id = $1 AND player_id = $2 AND item_type = 'XENON_VEHICLE' AND quantity > 0`,
          [normalizedAssetRefId, playerId],
        );
        const row = xenon.rows[0];
        if (!row) throw new Error('xenon not owned');
        assetName = 'Xenon Vehicle';
        assetMetadata = {
          id: row.id,
          ...(row.metadata || {}),
        };
      }

      const existing = await db.query(
        `SELECT id FROM market_listings
         WHERE seller_player_id = $1 AND asset_type = $2 AND asset_ref_id = $3 AND status = 'ACTIVE'`,
        [playerId, assetType, normalizedAssetRefId],
      );
      if (existing.rows[0]) throw new Error('asset already listed');

      const inserted = await db.query(
        `INSERT INTO market_listings (seller_type, seller_player_id, asset_type, asset_ref_id, asset_name, asset_metadata, ask_price, status)
         VALUES ('PLAYER', $1, $2, $3, $4, $5::jsonb, $6, 'ACTIVE')
         RETURNING id, created_at`,
        [playerId, assetType, normalizedAssetRefId, assetName, JSON.stringify(assetMetadata), normalizedAskPrice],
      );
      return inserted.rows[0];
    });

    res.json({ ok: true, listingId: created.id, createdAt: asIso(created.created_at) });
  } catch (error) {
    res.status(400).json({ error: error.message || 'market list failed' });
  }
});

app.get('/api/market/seller', async (req, res) => {
  try {
    if (!dbReady || !pool) return res.json({ listings: [], incomingOffers: [] });
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const listingsResult = await pool.query(
      `SELECT * FROM market_listings WHERE seller_player_id = $1 ORDER BY created_at DESC`,
      [playerId],
    );
    const listings = (
      await Promise.all(listingsResult.rows.map(async (listing) => {
        const asset = await resolveListingAsset(pool, listing);
        if (!asset) return null;
        return {
          id: listing.id,
          assetType: listing.asset_type,
          assetName: asset.assetName,
          assetMetadata: asset.assetMetadata,
          askPrice: Number(listing.ask_price),
          status: listing.status,
          createdAt: asIso(listing.created_at),
        };
      }))
    ).filter(Boolean);

    const offersResult = await pool.query(
      `SELECT mo.*, ml.asset_type, ml.ask_price
       FROM market_offers mo
       JOIN market_listings ml ON ml.id = mo.listing_id
       WHERE ml.seller_player_id = $1
       ORDER BY mo.created_at DESC`,
      [playerId],
    );

    const incomingOffers = (
      await Promise.all(offersResult.rows.map(async (offer) => {
        const listing = listingsResult.rows.find((entry) => entry.id === offer.listing_id);
        const asset = listing ? await resolveListingAsset(pool, listing) : null;
        if (!asset) return null;
        return {
          id: offer.id,
          listingId: offer.listing_id,
          buyerPlayerId: offer.buyer_player_id,
          offeredPrice: Number(offer.offered_price),
          status: offer.status,
          createdAt: asIso(offer.created_at),
          assetName: asset.assetName,
          assetType: offer.asset_type,
          askPrice: Number(offer.ask_price),
        };
      }))
    ).filter(Boolean);

    res.json({ listings, incomingOffers });
  } catch (error) {
    res.status(500).json({ error: 'market seller failed' });
  }
});

app.get('/api/market/buyer', async (req, res) => {
  try {
    if (!dbReady || !pool) return res.json({ offers: [] });
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const offersResult = await pool.query(
      `SELECT mo.*, ml.asset_type, ml.ask_price, ml.status AS listing_status
       FROM market_offers mo
       JOIN market_listings ml ON ml.id = mo.listing_id
       WHERE mo.buyer_player_id = $1
       ORDER BY mo.created_at DESC`,
      [playerId],
    );

    const offers = (
      await Promise.all(offersResult.rows.map(async (offer) => {
        const listingResult = await pool.query(`SELECT * FROM market_listings WHERE id = $1`, [offer.listing_id]);
        const listing = listingResult.rows[0];
        const asset = listing ? await resolveListingAsset(pool, listing) : null;
        if (!asset) return null;
        const sellerType = listing?.seller_npc_id ? 'NPC' : 'PLAYER';
        const sellerName = listing?.seller_npc_id
          ? (NPC_SELLERS.find((entry) => normalizeNpcId(entry.id) === normalizeNpcId(listing.seller_npc_id))?.name || 'NPC Seller')
          : listing?.seller_player_id;
        return {
          id: offer.id,
          listingId: offer.listing_id,
          offeredPrice: Number(offer.offered_price),
          status: offer.status,
          createdAt: asIso(offer.created_at),
          assetName: asset.assetName,
          assetMetadata: asset.assetMetadata,
          assetType: offer.asset_type,
          askPrice: Number(offer.ask_price),
          listingStatus: offer.listing_status,
          sellerType,
          sellerName,
        };
      }))
    ).filter(Boolean);

    res.json({ offers });
  } catch (error) {
    res.status(500).json({ error: 'market buyer failed' });
  }
});

app.post('/api/market/offer/accept', requireDb, async (req, res) => {
  try {
    const { playerId, offerId } = req.body || {};
    if (!playerId || !offerId) return res.status(400).json({ error: 'missing fields' });

    const soldFor = await withTransaction(async (db) => {
      const offerResult = await db.query(`SELECT * FROM market_offers WHERE id = $1 AND status = 'PENDING'`, [offerId]);
      const offer = offerResult.rows[0];
      if (!offer) throw new Error('offer not found');

      const listingResult = await db.query(`SELECT * FROM market_listings WHERE id = $1 AND status = 'ACTIVE'`, [offer.listing_id]);
      const listing = listingResult.rows[0];
      if (!listing || listing.seller_player_id !== playerId) throw new Error('listing not available');

      await settleListingSale(db, listing, offer.buyer_player_id, Number(offer.offered_price), offer.id);
      return Number(offer.offered_price);
    });

    res.json({ ok: true, soldFor });
  } catch (error) {
    res.status(400).json({ error: error.message || 'offer accept failed' });
  }
});

app.post('/api/market/offer/reject', requireDb, async (req, res) => {
  try {
    const { playerId, offerId } = req.body || {};
    if (!playerId || !offerId) return res.status(400).json({ error: 'missing fields' });

    const updated = await pool.query(
      `UPDATE market_offers mo
       SET status = 'REJECTED', updated_at = NOW()
       FROM market_listings ml
       WHERE mo.id = $1 AND mo.listing_id = ml.id AND ml.seller_player_id = $2
       RETURNING mo.id`,
      [offerId, playerId],
    );

    if (!updated.rows[0]) return res.status(404).json({ error: 'offer not found' });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'offer reject failed' });
  }
});

app.post('/api/market/offer/cancel', requireDb, async (req, res) => {
  try {
    const { playerId, offerId } = req.body || {};
    if (!playerId || !offerId) return res.status(400).json({ error: 'missing fields' });

    const updated = await pool.query(
      `UPDATE market_offers
       SET status = 'REJECTED', updated_at = NOW()
       WHERE id = $1 AND buyer_player_id = $2 AND status = 'PENDING'
       RETURNING id`,
      [offerId, playerId],
    );

    if (!updated.rows[0]) return res.status(404).json({ error: 'offer not found' });
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'offer cancel failed' });
  }
});

app.post('/api/market/listing/cancel', requireDb, async (req, res) => {
  try {
    const { playerId, listingId } = req.body || {};
    if (!playerId || !listingId) return res.status(400).json({ error: 'missing fields' });

    await withTransaction(async (db) => {
      const updated = await db.query(
        `UPDATE market_listings
         SET status = 'CANCELLED', updated_at = NOW()
         WHERE id = $1 AND seller_player_id = $2 AND status = 'ACTIVE'
         RETURNING id`,
        [listingId, playerId],
      );
      if (!updated.rows[0]) throw new Error('listing not found');

      await db.query(
        `UPDATE market_offers SET status = 'REJECTED', updated_at = NOW()
         WHERE listing_id = $1 AND status = 'PENDING'`,
        [listingId],
      );
    });

    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message || 'listing cancel failed' });
  }
});

app.post('/api/market/npc/refresh', async (_req, res) => {
  try {
    if (!dbReady || !pool) return res.json({ ok: true });
    await refreshNpcListings();
    const sold = await runNpcAutoBuyerSweep();
    res.json({ ok: true, sold });
  } catch (error) {
    res.status(500).json({ error: 'npc refresh failed' });
  }
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
      `SELECT ov.id, ov.model_id, vm.name, vm.brand, ov.purchase_price, ov.purchased_at, ov.purchase_source
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
      displayName: player.display_name || player.player_id,
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
        acquisitionSource: v.purchase_source || 'SHOWROOM',
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

app.get('/api/player/profile', requireDb, async (req, res) => {
  try {
    const { playerId } = req.query;
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });
    const player = await ensurePlayer(pool, playerId);
    res.json({ playerId: player.player_id, displayName: player.display_name || player.player_id });
  } catch (error) {
    res.status(500).json({ error: 'profile fetch failed' });
  }
});

app.post('/api/player/profile/name', requireDb, async (req, res) => {
  try {
    const { playerId, displayName } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });
    const safeName = String(displayName || '').trim().slice(0, 32);
    if (!safeName) return res.status(400).json({ error: 'display name required' });

    await ensurePlayer(pool, playerId);
    await pool.query(`UPDATE players SET display_name = $2, updated_at = NOW() WHERE player_id = $1`, [playerId, safeName]);
    res.json({ ok: true, displayName: safeName });
  } catch (error) {
    res.status(500).json({ error: 'profile update failed' });
  }
});

app.post('/api/player/cash/adjust', requireDb, async (req, res) => {
  try {
    const { playerId, delta } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const normalizedDelta = Math.floor(Number(delta));
    if (!Number.isFinite(normalizedDelta)) {
      return res.status(400).json({ error: 'invalid delta' });
    }

    const result = await withTransaction(async (db) => {
      await ensurePlayer(db, playerId);
      const current = await db.query(
        `SELECT clean_money FROM players WHERE player_id = $1 FOR UPDATE`,
        [playerId],
      );
      const currentMoney = Number(current.rows[0]?.clean_money ?? 0);
      const nextMoney = currentMoney + normalizedDelta;
      if (nextMoney < 0) throw new Error('insufficient funds');

      const updated = await db.query(
        `UPDATE players SET clean_money = $2, updated_at = NOW() WHERE player_id = $1 RETURNING clean_money`,
        [playerId, nextMoney],
      );

      return Number(updated.rows[0].clean_money);
    });

    res.json({ ok: true, cleanMoney: result });
  } catch (error) {
    res.status(400).json({ error: error.message || 'cash adjust failed' });
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

    const result = await withTransaction(async (db) => {
      const player = await ensurePlayer(db, playerId);
      await ensureVehicleCapacity(db, playerId);

      const vmRes = await db.query(`SELECT * FROM vehicle_models WHERE id = $1`, [modelId]);
      const model = vmRes.rows[0];
      if (!model) throw new Error('vehicle not found');
      if (model.stock <= 0) throw new Error('vehicle out of stock');

      let finalPrice = Number(model.base_price);
      let discountPct = 0;

      if (useVoucher) {
        const voucherRes = await db.query(
          `SELECT id FROM inventory_items WHERE player_id = $1 AND item_type = 'VOUCHER_SHOWROOM' AND quantity > 0 ORDER BY created_at ASC LIMIT 1`,
          [playerId],
        );
        if (!voucherRes.rows[0]) throw new Error('no vouchers available');
        discountPct = Math.floor(10 + Math.random() * 25);
        finalPrice = Math.floor(finalPrice * (1 - discountPct / 100));
        await consumeInventoryItem(db, voucherRes.rows[0].id, 1);
      }

      if (Number(player.clean_money) < finalPrice) {
        throw new Error('insufficient funds');
      }

      await db.query(
        `UPDATE players SET clean_money = clean_money - $1 WHERE player_id = $2`,
        [finalPrice, playerId],
      );
      await db.query(
        `UPDATE vehicle_models SET stock = stock - 1 WHERE id = $1`,
        [modelId],
      );
      const inserted = await db.query(
        `INSERT INTO owned_vehicles (player_id, model_id, purchase_price, purchase_source)
         VALUES ($1, $2, $3, 'SHOWROOM')
         RETURNING id, model_id, purchase_price, purchased_at`,
        [playerId, modelId, finalPrice],
      );
      const updatedPlayer = await db.query(`SELECT clean_money FROM players WHERE player_id = $1`, [playerId]);
      const updatedModel = await db.query(`SELECT stock FROM vehicle_models WHERE id = $1`, [modelId]);

      return {
        discountPct,
        vehicle: {
          id: inserted.rows[0].id,
          modelId: inserted.rows[0].model_id,
          modelName: model.name,
          brand: model.brand,
          purchasePrice: Number(inserted.rows[0].purchase_price),
          purchasedAt: asIso(inserted.rows[0].purchased_at),
          acquisitionSource: 'SHOWROOM',
        },
        newBalance: Number(updatedPlayer.rows[0].clean_money),
        stockRemaining: updatedModel.rows[0].stock,
      };
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('showroom/buy error', e);
    res.status(400).json({ error: e.message || 'purchase failed' });
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

    const result = await withTransaction(async (db) => {
      const player = await ensurePlayer(db, playerId);
      const cost = costType === 'flowcoins' ? 30 : 100_000;
      if (costType === 'flowcoins' && player.flow_coins < cost) throw new Error('insufficient flowcoins');
      if (costType === 'cash' && Number(player.clean_money) < cost) throw new Error('insufficient funds');

      if (costType === 'flowcoins') {
        await db.query(`UPDATE players SET flow_coins = flow_coins - $1 WHERE player_id = $2`, [cost, playerId]);
      } else {
        await db.query(`UPDATE players SET clean_money = clean_money - $1 WHERE player_id = $2`, [cost, playerId]);
      }

      const reward = pickWeightedReward();
      const payout = reward.valueMin === reward.valueMax
        ? reward.valueMin
        : Math.floor(reward.valueMin + Math.random() * (reward.valueMax - reward.valueMin));

      let rewardType = reward.itemType || 'CASH';
      let rewardSubtitle = '';
      let emoji = '🎁';
      let metadata = {};

      if (reward.name === 'Bani') {
        await db.query(`UPDATE players SET clean_money = clean_money + $1 WHERE player_id = $2`, [payout, playerId]);
        rewardSubtitle = `+${payout.toLocaleString('ro-RO')} $`;
        emoji = '💵';
      } else if (reward.name === 'FlowCoins') {
        await db.query(`UPDATE players SET flow_coins = flow_coins + $1 WHERE player_id = $2`, [payout, playerId]);
        rewardSubtitle = `+${payout} FlowCoins`;
        emoji = '🟠';
      } else if (reward.itemType === 'ROULETTE_FRAGMENTS') {
        await db.query(`UPDATE players SET roulette_fragments = roulette_fragments + $1 WHERE player_id = $2`, [payout, playerId]);
        rewardSubtitle = `+${payout} fragmente`;
        emoji = '🪙';
      } else if (reward.itemType) {
        metadata = reward.itemType === 'VOUCHER_SHOWROOM' ? { discount: randomInt(10, 35) } : {};
        await addInventoryItem(db, playerId, reward.itemType, payout || 1, metadata);
        rewardSubtitle = reward.name;
        emoji = {
          VIP_GOLD: '💎',
          VIP_SILVER: '💠',
          MYSTERY_BOX: '📦',
          SLOT_VEHICLE: '➕',
          VOUCHER_SHOWROOM: '🎟️',
          JOB_BOOST_PILOT: '✈️',
          TAX_EXEMPTION: '💸',
          XENON_VEHICLE: '🔩',
        }[reward.itemType] || '🎁';
      }

      const updatedPlayerRes = await db.query(
        `SELECT clean_money, flow_coins, roulette_fragments FROM players WHERE player_id = $1`,
        [playerId],
      );
      const updatedPlayer = updatedPlayerRes.rows[0];

      return {
        rewardType,
        rewardName: reward.name,
        rewardSubtitle,
        tier: reward.tier,
        emoji,
        payout,
        metadata,
        player: {
          cleanMoney: Number(updatedPlayer.clean_money),
          flowCoins: updatedPlayer.flow_coins,
          rouletteFragments: updatedPlayer.roulette_fragments,
        },
      };
    });

    res.json(result);
  } catch (e) {
    console.error('roulette spin error', e);
    res.status(400).json({ error: e.message || 'spin failed' });
  }
});

// POST /api/mystery/open - Open a mystery box
app.post('/api/mystery/open', requireDb, async (req, res) => {
  try {
    const { playerId } = req.body || {};
    if (!playerId) return res.status(400).json({ error: 'playerId missing' });

    const clothing = await withTransaction(async (db) => {
      const mysteryRes = await db.query(
        `SELECT id FROM inventory_items WHERE player_id = $1 AND item_type = 'MYSTERY_BOX' AND quantity > 0 ORDER BY created_at ASC LIMIT 1`,
        [playerId],
      );
      if (!mysteryRes.rows[0]) throw new Error('no mystery box available');

      await consumeInventoryItem(db, mysteryRes.rows[0].id, 1);

      const clothRes = await db.query(
        `SELECT id, name, category, rarity, min_value, max_value FROM clothing_items ORDER BY RANDOM() LIMIT 1`,
      );
      const cloth = clothRes.rows[0];
      if (!cloth) throw new Error('no clothing items');

      const marketValue = randomInt(Number(cloth.min_value), Number(cloth.max_value));
      await addInventoryItem(db, playerId, 'CLOTHING', 1, {
        name: cloth.name,
        category: cloth.category,
        rarity: cloth.rarity,
        marketValue,
        source: 'ROULETTE',
        imagePath: getClothingImagePath(cloth.name, cloth.category),
      });

      return {
        id: cloth.id,
        name: cloth.name,
        category: cloth.category,
        rarity: cloth.rarity,
        marketValue,
      };
    });

    res.json({ clothing });
  } catch (e) {
    console.error('mystery open error', e);
    res.status(400).json({ error: e.message || 'open failed' });
  }
});

// POST /api/inventory/use - Use an inventory item
app.post('/api/inventory/use', requireDb, async (req, res) => {
  try {
    const { playerId, itemId } = req.body || {};
    if (!playerId || !itemId) return res.status(400).json({ error: 'missing fields' });

    const result = await withTransaction(async (db) => {
      const itemRes = await db.query(`SELECT * FROM inventory_items WHERE player_id = $1 AND id = $2`, [playerId, itemId]);
      const item = itemRes.rows[0];
      if (!item) throw new Error('item not found');
      if (item.quantity < 1) throw new Error('not enough items');

      let effect = 'item_used';
      const metadata = {};

      await consumeInventoryItem(db, itemId, 1);

      if (item.item_type === 'SLOT_VEHICLE') {
        await db.query(`UPDATE players SET vehicle_slots_extra = vehicle_slots_extra + 1 WHERE player_id = $1`, [playerId]);
        effect = 'vehicle_slot_added';
      } else if (item.item_type === 'TAX_EXEMPTION') {
        await db.query(`UPDATE players SET skip_next_tax = TRUE WHERE player_id = $1`, [playerId]);
        effect = 'tax_exemption_activated';
      } else if (item.item_type === 'JOB_BOOST_PILOT') {
        effect = 'pilot_boost_reserved';
      } else if (item.item_type === 'JOB_BOOST_SLEEP') {
        effect = 'sleep_boost_reserved';
      } else if (item.item_type === 'VIP_GOLD') {
        await db.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1, 'VIP_GOLD', NOW() + INTERVAL '10 minutes')`,
          [playerId],
        );
        effect = 'vip_gold_activated';
      } else if (item.item_type === 'VIP_SILVER') {
        await db.query(
          `INSERT INTO active_boosts (player_id, boost_type, expires_at) VALUES ($1, 'VIP_SILVER', NOW() + INTERVAL '5 minutes')`,
          [playerId],
        );
        effect = 'vip_silver_activated';
      }

      return { effect, metadata };
    });

    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('inventory use error', e);
    res.status(400).json({ error: e.message || 'use failed' });
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
  { brand: 'DRAVIA', name: 'Dravia Nova', base_price: 100_000, is_jackpot: false, image_path: '/cars/Dravia Nova.png' },
  { brand: 'DRAVIA', name: 'Dravia Dustera', base_price: 180_000, is_jackpot: false, image_path: '/cars/Dravia Dustera.png' },
  { brand: 'BERVIK', name: 'Bervik M4R', base_price: 650_000, is_jackpot: false, image_path: '/cars/Bervik M4R.png' },
  { brand: 'BERVIK', name: 'Bervik X8', base_price: 900_000, is_jackpot: false, image_path: '/cars/Bervik X8.png' },
  { brand: 'AURON', name: 'Auron RS7', base_price: 1_200_000, is_jackpot: false, image_path: '/cars/Auron RS7.png' },
  { brand: 'AURON', name: 'Auron Q8X', base_price: 1_500_000, is_jackpot: false, image_path: '/cars/Auron Q8X.png' },
  { brand: 'FERANO', name: 'Ferano Roma X', base_price: 2_300_000, is_jackpot: false, image_path: '/cars/Ferano Roma X.png' },
  { brand: 'FERANO', name: 'Ferano F8R', base_price: 2_800_000, is_jackpot: false, image_path: '/cars/Ferano F8R.png' },
  { brand: 'VORTEK', name: 'Vortek Cayenne X', base_price: 3_200_000, is_jackpot: true, image_path: '/cars/Vortek Cayenne X.png' },
  { brand: 'VORTEK', name: 'Vortek 911R', base_price: 4_000_000, is_jackpot: true, image_path: '/cars/Vortek 911R.png' },
];

const CLOTHING_ITEMS = [
  // TSHIRTS
  { name: 'Like Basic Tee', category: 'TSHIRT', rarity: 'BLUE', min_value: 10_000, max_value: 80_000, image_path: '/Clothes/tshirt/Like Basic Tee.png' },
  { name: 'Adibas Sport Tee', category: 'TSHIRT', rarity: 'LIGHT_PURPLE', min_value: 50_000, max_value: 200_000, image_path: '/Clothes/tshirt/Adibas Sport Tee.png' },
  { name: 'Guci Monogram Tee', category: 'TSHIRT', rarity: 'YELLOW', min_value: 500_000, max_value: 900_000, image_path: '/Clothes/tshirt/Guci Monogram Tee.png' },
  { name: 'Balencii Oversize Tee', category: 'TSHIRT', rarity: 'RED', min_value: 250_000, max_value: 500_000, image_path: '/Clothes/tshirt/Balencii Oversize Tee.png' },
  { name: 'Stone Ilan Patch Tee', category: 'TSHIRT', rarity: 'DARK_PURPLE', min_value: 120_000, max_value: 350_000, image_path: '/Clothes/tshirt/Stone Ilan Patch Tee.png' },
  // PANTS
  { name: 'Like Track Pants', category: 'PANTS', rarity: 'BLUE', min_value: 10_000, max_value: 80_000, image_path: '/Clothes/pants/Like Track Pants.png' },
  { name: 'Adibas Stripe Pants', category: 'PANTS', rarity: 'LIGHT_PURPLE', min_value: 50_000, max_value: 200_000, image_path: '/Clothes/pants/Adibas Stripe Pants.png' },
  { name: 'Levios Urban Jeans', category: 'PANTS', rarity: 'DARK_PURPLE', min_value: 120_000, max_value: 350_000, image_path: '/Clothes/pants/Levios Urban Jeans.png' },
  { name: 'Stone Ilan Cargo Pants', category: 'PANTS', rarity: 'RED', min_value: 250_000, max_value: 500_000, image_path: '/Clothes/pants/Stone Ilan Cargo Pants.png' },
  { name: 'Balencii Baggy Pants', category: 'PANTS', rarity: 'YELLOW', min_value: 500_000, max_value: 900_000, image_path: '/Clothes/pants/Balencii Baggy Pants.png' },
  // SHOES
  { name: 'Like Air Run', category: 'SHOES', rarity: 'YELLOW', min_value: 500_000, max_value: 900_000, image_path: '/Clothes/shoes/Like Air Run.png' },
  { name: 'Adibas Ultra Move', category: 'SHOES', rarity: 'RED', min_value: 250_000, max_value: 500_000, image_path: '/Clothes/shoes/Adibas Ultra Move.png' },
  { name: 'Niu Balanse 550', category: 'SHOES', rarity: 'DARK_PURPLE', min_value: 120_000, max_value: 350_000, image_path: '/Clothes/shoes/Niu Balanse 550.png' },
  { name: 'Convoy Classic High', category: 'SHOES', rarity: 'LIGHT_PURPLE', min_value: 50_000, max_value: 200_000, image_path: '/Clothes/shoes/Convoy Classic High.png' },
  { name: 'Luma Street Rider', category: 'SHOES', rarity: 'BLUE', min_value: 10_000, max_value: 80_000, image_path: '/Clothes/shoes/Luma Street Rider.png' },
];

const NPC_SELLERS = [
  { id: 1, name: 'Shadow Dealer', emoji: '🕵️' },
  { id: 2, name: 'Gold Rush', emoji: '🤑' },
  { id: 3, name: 'Street King', emoji: '👑' },
  { id: 4, name: 'Midnight Shift', emoji: '🌙' },
  { id: 5, name: 'Chrome Broker', emoji: '🔧' },
  { id: 6, name: 'Velvet Tag', emoji: '🧥' },
  { id: 7, name: 'Runway Flip', emoji: '👠' },
  { id: 8, name: 'Nitro Node', emoji: '⚡' },
];

async function seedNpcSellers() {
  for (const npc of NPC_SELLERS) {
    await pool.query(
      `INSERT INTO npc_sellers (id, name, emoji)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, emoji = EXCLUDED.emoji`,
      [npc.id, npc.name, npc.emoji],
    );
  }
}

async function refreshNpcListings() {
  await pool.query(`DELETE FROM market_listings WHERE seller_npc_id IS NOT NULL AND status = 'ACTIVE'`);

  const vehicleRows = await pool.query(`SELECT id, brand, name, base_price FROM vehicle_models`);
  const clothingRows = await pool.query(`SELECT id, name, category, rarity, min_value, max_value FROM clothing_items`);

  const npcCap = 10;
  const sellers = [...NPC_SELLERS].sort(() => Math.random() - 0.5);
  let created = 0;

  while (created < npcCap) {
    const seller = sellers[created % sellers.length];
    const useVehicle = Math.random() < 0.6;
    if (useVehicle && vehicleRows.rows.length > 0) {
      const vehicle = vehicleRows.rows[randomInt(0, vehicleRows.rows.length - 1)];
      const askPrice = toDynamicNpcPrice(Number(vehicle.base_price));
      const assetMetadata = {
        id: vehicle.id,
        brand: vehicle.brand,
        basePrice: Number(vehicle.base_price),
        marketPrice: Number(vehicle.base_price),
        imagePath: getVehicleImagePath(vehicle.name),
      };
      await pool.query(
        `INSERT INTO market_listings (seller_type, seller_npc_id, asset_type, asset_ref_id, asset_name, asset_metadata, ask_price, status)
         VALUES ('NPC', $1, 'VEHICLE', $2, $3, $4::jsonb, $5, 'ACTIVE')`,
        [seller.id, vehicle.id, vehicle.name, JSON.stringify(assetMetadata), askPrice],
      );
      created += 1;
      continue;
    }

    if (clothingRows.rows.length > 0) {
      const clothing = clothingRows.rows[randomInt(0, clothingRows.rows.length - 1)];
      const midValue = Math.round((Number(clothing.min_value) + Number(clothing.max_value)) / 2);
      const askPrice = toDynamicNpcPrice(midValue);
      const assetMetadata = {
        id: clothing.id,
        name: clothing.name,
        category: clothing.category,
        rarity: clothing.rarity,
        marketValue: midValue,
        marketPrice: midValue,
        imagePath: getClothingImagePath(clothing.name, clothing.category),
      };
      await pool.query(
        `INSERT INTO market_listings (seller_type, seller_npc_id, asset_type, asset_ref_id, asset_name, asset_metadata, ask_price, status)
         VALUES ('NPC', $1, 'CLOTHING', $2, $3, $4::jsonb, $5, 'ACTIVE')`,
        [seller.id, clothing.id, clothing.name, JSON.stringify(assetMetadata), askPrice],
      );
      created += 1;
    }
  }
}

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
    .then(async () => {
      dbReady = true;
      await seedGameData();
      await seedNpcSellers();
      await refreshNpcListings();
      await seedBotPosts();
      await runNpcAutoBuyerSweep();
      setInterval(() => {
        refreshNpcListings().catch(() => {});
        seedBotPosts().catch(() => {});
        runNpcAutoBuyerSweep().catch(() => {});
      }, NPC_REFRESH_INTERVAL_MS);
      startServer();
    })
    .catch((err) => {
      console.error('DB init failed. Starting server in degraded mode.', err);
      startServer();
    });
}
