const TIER_WEIGHTS = Object.freeze({ legendary: 2, epic: 8, rare: 18, uncommon: 30, common: 42 });

const REWARDS = Object.freeze([
  { name: 'Vehicul Suvenir', tier: 'legendary', rewardType: 'SOUVENIR_VEHICLE', valueMin: 1, valueMax: 1 },
  { name: 'VIP Gold', tier: 'epic', rewardType: 'VIP_GOLD', valueMin: 1, valueMax: 1 },
  { name: 'VIP Silver', tier: 'epic', rewardType: 'VIP_SILVER', valueMin: 1, valueMax: 1 },
  { name: 'Mystery Box', tier: 'epic', rewardType: 'MYSTERY_BOX', valueMin: 1, valueMax: 1 },
  { name: 'Fragmente Ruleta', tier: 'rare', rewardType: 'ROULETTE_FRAGMENTS', valueMin: 5, valueMax: 5 },
  { name: 'FlowCoins', tier: 'rare', rewardType: 'FLOW_COINS', valueMin: 10, valueMax: 10 },
  { name: 'Slot Vehicle', tier: 'rare', rewardType: 'SLOT_VEHICLE', valueMin: 1, valueMax: 1 },
  { name: 'Voucher Showroom', tier: 'rare', rewardType: 'VOUCHER_SHOWROOM', valueMin: 1, valueMax: 1 },
  { name: 'Job Boost Pilot', tier: 'uncommon', rewardType: 'JOB_BOOST_PILOT', valueMin: 1, valueMax: 1 },
  { name: 'Xenon Vehicul', tier: 'common', rewardType: 'XENON_VEHICLE', valueMin: 1, valueMax: 1 },
  { name: 'Bani', tier: 'common', rewardType: 'CASH', valueMin: 25_000, valueMax: 50_000 },
]);

function pickWeightedReward(random = Math.random) {
  const tiers = Object.entries(TIER_WEIGHTS);
  const totalWeight = tiers.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.max(0, Math.min(0.999999999, Number(random()))) * totalWeight;
  let selectedTier = tiers[tiers.length - 1][0];
  for (const [tier, weight] of tiers) {
    roll -= weight;
    if (roll < 0) {
      selectedTier = tier;
      break;
    }
  }

  const candidates = REWARDS.filter((reward) => reward.tier === selectedTier);
  const index = Math.min(candidates.length - 1, Math.floor(Math.max(0, Number(random())) * candidates.length));
  return candidates[index];
}

function rewardPayout(reward, random = Math.random) {
  if (reward.valueMin === reward.valueMax) return reward.valueMin;
  return Math.floor(reward.valueMin + Math.max(0, Math.min(0.999999999, Number(random()))) * (reward.valueMax - reward.valueMin + 1));
}

module.exports = {
  REWARDS,
  TIER_WEIGHTS,
  pickWeightedReward,
  rewardPayout,
};
