async function getVipMultiplier(db, playerId) {
  const result = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM active_boosts
       WHERE player_id = $1
         AND boost_type IN ('VIP_GOLD', 'VIP_SILVER')
         AND expires_at > NOW()
     ) AS active`,
    [playerId],
  );
  return result.rows[0]?.active ? 2 : 1;
}

async function consumeJobBoost(db, playerId, itemType) {
  const result = await db.query(
    `SELECT id FROM inventory_items
     WHERE player_id = $1 AND item_type = $2 AND quantity > 0
     ORDER BY created_at ASC
     LIMIT 1
     FOR UPDATE`,
    [playerId, itemType],
  );
  const item = result.rows[0];
  if (!item) return false;
  const consumed = await db.query(
    `UPDATE inventory_items SET quantity = quantity - 1
     WHERE id = $1 AND player_id = $2 AND quantity > 0
     RETURNING quantity`,
    [item.id, playerId],
  );
  if (!consumed.rows[0]) return false;
  if (Number(consumed.rows[0].quantity) <= 0) {
    await db.query(`DELETE FROM inventory_items WHERE id = $1`, [item.id]);
  }
  return true;
}

module.exports = {
  consumeJobBoost,
  getVipMultiplier,
};
