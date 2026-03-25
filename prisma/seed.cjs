// prisma/seed.cjs
// Run with: node prisma/seed.cjs
// Requires DATABASE_URL env variable

'use strict';

const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function seed() {
  console.log('Seeding vehicle models...');
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

  console.log('Seeding clothing items...');
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

  console.log('Seed complete.');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
