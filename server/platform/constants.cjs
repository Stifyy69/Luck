const VIP_DURATION_SECONDS = Object.freeze({
  VIP_SILVER: 5 * 60,
  VIP_GOLD: 10 * 60,
});

const VIP_LABELS = Object.freeze({
  VIP_SILVER: 'VIP Silver',
  VIP_GOLD: 'VIP Gold',
});

const PLAYER_LEADERBOARD_METRICS = Object.freeze({
  city_level: { label: 'City Level', field: 'cityXp' },
  wealth: { label: 'Net Worth', field: 'netWorth' },
  earnings: { label: 'Total Earnings', field: 'totalEarnings' },
  cash: { label: 'Clean Money', field: 'cleanMoney' },
  career: { label: 'Career Score', field: 'careerScore' },
  pizza: { label: 'Pizza Deliveries', field: 'deliveries' },
  fishing: { label: 'Fish Caught', field: 'catches' },
  aviation: { label: 'Pilot Flights', field: 'flights' },
  fleet: { label: 'Fleet Value', field: 'fleetValue' },
  time: { label: 'Time Played', field: 'totalTimeHours' },
});

const GANG_LEADERBOARD_METRICS = Object.freeze({
  dirty_earned: { label: 'Dirty Earned', field: 'dirtyEarned' },
  members: { label: 'Members', field: 'membersCount' },
  stock_value: { label: 'Stock Value', field: 'stockValue' },
  gang_level: { label: 'Gang Level', field: 'gangLevelIndex' },
  activity: { label: 'Recent Activity', field: 'updatedAtMs' },
});

const ADMIN_EDITABLE_FIELDS = Object.freeze({
  cleanMoney: { table: 'players', column: 'clean_money', min: 0, max: Number.MAX_SAFE_INTEGER },
  flowCoins: { table: 'players', column: 'flow_coins', min: 0, max: 100_000_000 },
  rouletteFragments: { table: 'players', column: 'roulette_fragments', min: 0, max: 100_000_000 },
  vehicleSlotsExtra: { table: 'players', column: 'vehicle_slots_extra', min: 0, max: 500 },
  cityXp: { table: 'player_city_progress', column: 'city_xp', min: 0, max: Number.MAX_SAFE_INTEGER },
  pizzerLevel: { table: 'player_pizzer_progress', column: 'pizzer_level', min: 1, max: 50 },
  pizzerXp: { table: 'player_pizzer_progress', column: 'pizzer_xp', min: 0, max: Number.MAX_SAFE_INTEGER },
  pizzerDeliveries: { table: 'player_pizzer_progress', column: 'pizzer_total_deliveries', min: 0, max: Number.MAX_SAFE_INTEGER },
  fisherLevel: { table: 'player_fisher_progress', column: 'fisher_level', min: 1, max: 50 },
  fisherXp: { table: 'player_fisher_progress', column: 'fisher_xp', min: 0, max: Number.MAX_SAFE_INTEGER },
  fisherCatches: { table: 'player_fisher_progress', column: 'fisher_total_catches', min: 0, max: Number.MAX_SAFE_INTEGER },
  pilotLevel: { table: 'player_pilot_progress', column: 'pilot_level', min: 1, max: 50 },
  pilotXp: { table: 'player_pilot_progress', column: 'pilot_xp', min: 0, max: Number.MAX_SAFE_INTEGER },
  pilotFlights: { table: 'player_pilot_progress', column: 'pilot_total_flights', min: 0, max: Number.MAX_SAFE_INTEGER },
});

const ADMIN_GRANTABLE_ITEMS = Object.freeze([
  'MYSTERY_BOX',
  'SLOT_VEHICLE',
  'VOUCHER_SHOWROOM',
  'JOB_BOOST_PILOT',
  'JOB_BOOST_SLEEP',
  'XENON_VEHICLE',
  'VIP_GOLD',
  'VIP_SILVER',
]);

const GANG_LEVEL_LABELS = Object.freeze([
  'Nerecunoscut',
  'Recunoscut',
  'Neoficiala',
  'Oficiala',
]);

module.exports = {
  ADMIN_EDITABLE_FIELDS,
  ADMIN_GRANTABLE_ITEMS,
  GANG_LEADERBOARD_METRICS,
  GANG_LEVEL_LABELS,
  PLAYER_LEADERBOARD_METRICS,
  VIP_DURATION_SECONDS,
  VIP_LABELS,
};
