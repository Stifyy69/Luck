const { ensureSchema, withTransaction } = require('./db.cjs');

const MAX_STOCK = 1_000_000;

function vehicleRank(basePrice) {
  const price = Math.max(0, Number(basePrice || 0));
  if (price < 1_000_000) return 1;
  if (price < 2_500_000) return 2;
  return 3;
}

function rankWhere(rank, startIndex = 1) {
  const safeRank = Number(rank);
  if (safeRank === 1) return { sql: `base_price < $${startIndex}`, params: [1_000_000] };
  if (safeRank === 2) return { sql: `base_price >= $${startIndex} AND base_price < $${startIndex + 1}`, params: [1_000_000, 2_500_000] };
  if (safeRank === 3) return { sql: `base_price >= $${startIndex}`, params: [2_500_000] };
  throw new Error('invalid vehicle rank');
}

function stockView(row) {
  return {
    id: Number(row.id),
    brand: String(row.brand || ''),
    name: String(row.name || ''),
    basePrice: Number(row.base_price || 0),
    jackpot: Boolean(row.is_jackpot),
    stock: Math.max(0, Number(row.stock || 0)),
    rank: vehicleRank(row.base_price),
  };
}

async function listVehicleStock() {
  await ensureSchema();
  const { pool } = require('./db.cjs');
  const result = await pool.query(
    `SELECT id, brand, name, base_price, is_jackpot, stock FROM vehicle_models ORDER BY base_price ASC, id ASC`,
  );
  return {
    ranks: [
      { rank: 1, label: 'Rank 1', description: 'Under 1,000,000 $' },
      { rank: 2, label: 'Rank 2', description: '1,000,000 - 2,499,999 $' },
      { rank: 3, label: 'Rank 3', description: '2,500,000 $+' },
    ],
    vehicles: result.rows.map(stockView),
  };
}

async function updateVehicleStock(adminName, input = {}) {
  await ensureSchema();
  const mode = String(input.mode || 'add').toLowerCase();
  const scope = String(input.scope || 'selected').toLowerCase();
  const amount = Math.floor(Number(input.amount));
  if (!['add', 'set'].includes(mode)) throw new Error('invalid stock mode');
  if (!['all', 'selected', 'rank'].includes(scope)) throw new Error('invalid stock scope');
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_STOCK) throw new Error('stock amount must be between 0 and 1000000');
  if (mode === 'add' && amount === 0) throw new Error('add amount must be greater than 0');

  return withTransaction(async (db) => {
    let whereSql = 'TRUE';
    const params = [];

    if (scope === 'selected') {
      const modelIds = Array.from(new Set((Array.isArray(input.modelIds) ? input.modelIds : [])
        .map((value) => Number(value))
        .filter((value) => Number.isSafeInteger(value) && value > 0)));
      if (modelIds.length === 0) throw new Error('select at least one vehicle');
      params.push(modelIds);
      whereSql = `id = ANY($1::int[])`;
    } else if (scope === 'rank') {
      const rankFilter = rankWhere(input.rank, 1);
      whereSql = rankFilter.sql;
      params.push(...rankFilter.params);
    }

    params.push(amount);
    const amountIndex = params.length;
    const stockExpression = mode === 'add'
      ? `LEAST(${MAX_STOCK}, GREATEST(0, stock + $${amountIndex}))`
      : `LEAST(${MAX_STOCK}, GREATEST(0, $${amountIndex}))`;

    const updated = await db.query(
      `UPDATE vehicle_models
       SET stock = ${stockExpression}
       WHERE ${whereSql}
       RETURNING id, brand, name, base_price, is_jackpot, stock`,
      params,
    );
    if (updated.rowCount === 0) throw new Error('no vehicles matched the stock update');

    await db.query(
      `INSERT INTO admin_action_log (admin_name, player_id, action_type, action_payload)
       VALUES ($1, NULL, 'VEHICLE_STOCK_BULK', $2::jsonb)`,
      [String(adminName || 'admin'), JSON.stringify({
        scope,
        mode,
        amount,
        rank: scope === 'rank' ? Number(input.rank) : null,
        modelIds: scope === 'selected' ? updated.rows.map((row) => Number(row.id)) : [],
        affected: updated.rowCount,
      })],
    );

    return {
      affected: updated.rowCount,
      vehicles: updated.rows.map(stockView),
    };
  });
}

module.exports = {
  listVehicleStock,
  updateVehicleStock,
  vehicleRank,
};
