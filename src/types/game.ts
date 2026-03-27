// Batch A shared game types

export type ClothingRarity = 'BLUE' | 'LIGHT_PURPLE' | 'DARK_PURPLE' | 'RED' | 'YELLOW';
export type ClothingCategory = 'TSHIRT' | 'PANTS' | 'SHOES';
export type Brand = 'DRAVIA' | 'BERVIK' | 'AURON' | 'FERANO' | 'VORTEK';
export type BoostType = 'VIP_GOLD' | 'VIP_SILVER' | 'JOB_PILOT' | 'JOB_SLEEP';
export type ItemType =
  | 'MYSTERY_BOX'
  | 'ROULETTE_FRAGMENTS'
  | 'SLOT_VEHICLE'
  | 'VOUCHER_SHOWROOM'
  | 'JOB_BOOST_PILOT'
  | 'JOB_BOOST_SLEEP'
  | 'TAX_EXEMPTION'
  | 'XENON_VEHICLE'
  | 'CLOTHING'
  | 'VIP_GOLD'
  | 'VIP_SILVER';

export type MarketAssetType = 'VEHICLE' | 'CLOTHING' | 'XENON_VEHICLE';
export type MarketListingStatus = 'ACTIVE' | 'SOLD' | 'CANCELLED';
export type MarketOfferStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface InventoryItem {
  id: number;
  itemType: ItemType;
  quantity: number;
  metadata: Record<string, unknown>;
}

export interface OwnedVehicle {
  id: number;
  modelId: number;
  modelName: string;
  brand: Brand;
  purchasePrice: number;
  purchasedAt: string;
  acquisitionSource?: 'SHOWROOM' | 'CNN' | 'ROULETTE' | 'UNKNOWN' | string;
}

export interface OwnedClothingMetadata {
  name: string;
  category: ClothingCategory;
  rarity: ClothingRarity;
  marketValue: number;
  source?: 'SHOWROOM' | 'CNN' | 'ROULETTE' | 'UNKNOWN' | string;
}

export interface ActiveBoost {
  id: number;
  boostType: BoostType;
  expiresAt: string;
}

export interface PlayerState {
  playerId: string;
  displayName?: string;
  cleanMoney: number;
  flowCoins: number;
  rouletteFragments: number;
  vehicleSlotsBase: number;
  vehicleSlotsExtra: number;
  totalSlots: number;
  usedSlots: number;
  skipNextTax: boolean;
  nextTaxCollectionAt: string | null;
  ownedVehicles: OwnedVehicle[];
  inventory: InventoryItem[];
  activeBoosts: ActiveBoost[];
}

export interface VehicleModelData {
  id: number;
  brand: Brand;
  name: string;
  basePrice: number;
  isJackpot: boolean;
  stock: number;
}

export interface ShowroomResponse {
  brands: Record<string, VehicleModelData[]>;
}

export interface SpinResult {
  rewardType: string;
  rewardName: string;
  rewardSubtitle: string;
  tier: 'legendary' | 'epic' | 'rare' | 'uncommon' | 'common';
  emoji: string;
  payout: number;
  metadata: Record<string, unknown>;
  player: Pick<PlayerState, 'cleanMoney' | 'flowCoins' | 'rouletteFragments'>;
}

export interface MysteryOpenResult {
  clothing: {
    id: number;
    name: string;
    category: ClothingCategory;
    rarity: ClothingRarity;
    marketValue: number;
  };
}

export interface ShowroomBuyResult {
  ok: boolean;
  vehicle: OwnedVehicle;
  newBalance: number;
  stockRemaining: number;
  discountPct?: number;
}

export interface InventoryUseResult {
  ok: boolean;
  effect: string;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Batch B: Marketplace types
// ---------------------------------------------------------------------------

export interface MarketListing {
  id: number;
  sellerType: 'PLAYER' | 'NPC';
  sellerPlayerId: string | null;
  sellerName: string;
  sellerEmoji: string;
  assetType: MarketAssetType;
  assetRefId: number | null;
  assetName: string;
  assetMetadata: Record<string, unknown>;
  askPrice: number;
  isOwn: boolean;
  createdAt: string;
}

export interface MarketOffer {
  id: number;
  listingId: number;
  buyerPlayerId?: string;
  buyerDisplayName?: string;
  offeredPrice: number;
  status: MarketOfferStatus;
  createdAt: string;
  assetName: string;
  assetMetadata?: Record<string, unknown>;
  assetType: MarketAssetType;
  askPrice: number;
  sellerType?: 'PLAYER' | 'NPC';
  sellerName?: string;
  listingStatus?: MarketListingStatus;
}

export interface NpcNegotiationResult {
  isNpc: boolean;
  signal: 'ACCEPT' | 'COUNTER' | 'REJECT';
  attemptNo: number;
  attemptsLeft: number;
  askPrice: number;
  counterAskPrice?: number;
}

export interface MarketListingsResponse {
  listings: MarketListing[];
}

export interface MarketSellerResponse {
  listings: Array<{
    id: number;
    assetType: MarketAssetType;
    assetName: string;
    assetMetadata: Record<string, unknown>;
    askPrice: number;
    status: MarketListingStatus;
    createdAt: string;
  }>;
  incomingOffers: Array<MarketOffer & { buyerPlayerId: string }>;
}

export interface MarketBuyerResponse {
  offers: MarketOffer[];
}

export interface MarketListResult {
  ok: boolean;
  listingId: number;
  createdAt: string;
}

export interface MarketOfferResult {
  ok: boolean;
  offerId: number;
  createdAt: string;
  negotiation?: NpcNegotiationResult | null;
}

export interface MarketActionResult {
  ok: boolean;
  soldFor?: number;
  boughtFor?: number;
}

export interface PlayerProfileResponse {
  playerId: string;
  displayName: string;
}

export type PizzerOrderType = 'STANDARD' | 'URGENTA' | 'VIP';
export type PizzerShiftState = 'IDLE' | 'SELECTING_ORDER' | 'PACKING_ORDER' | 'DELIVERY_ACTIVE' | 'DELIVERY_RESULT';

export interface PizzerOrderLineItem {
  name: string;
  quantity: number;
}

export interface PizzerProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  totalDeliveries: number;
  perfectDeliveries: number;
  bestStreak: number;
  totalEarnings: number;
}

export interface PizzerOrderOption {
  orderId: string;
  orderType: PizzerOrderType;
  distanceMeters: number;
  estimatedReward: number;
  estimatedXp: number;
  estimatedTimeSec: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  pizzas: PizzerOrderLineItem[];
  drinks: PizzerOrderLineItem[];
}

export interface PizzerStateResponse {
  progress: PizzerProgress;
  shiftState: PizzerShiftState;
  vehicleLabel: string;
  streak: number;
  repairSecondsLeft?: number;
  repairLabel?: string | null;
  activeOrder: {
    orderId: string;
    orderType: PizzerOrderType;
    distanceMeters: number;
    targetLabel: string;
    etaSec: number;
    timeLeftSec: number;
    freshness: number;
    damagePercent: number;
    packingStepsDone: string[];
    packingStepsRequired: string[];
    nextPackingStep: string | null;
    pizzas: PizzerOrderLineItem[];
    drinks: PizzerOrderLineItem[];
  } | null;
  lastResult?: PizzerDeliveryResult | null;
}

export interface PizzerDeliveryResult {
  delivered: boolean;
  accident?: boolean;
  orderType: PizzerOrderType;
  breakdown: {
    baseReward: number;
    orderTypeMultiplier: number;
    levelMultiplier: number;
    freshnessMultiplier: number;
    streakMultiplier: number;
    damageMultiplier: number;
    tip: number;
    totalReward: number;
    xpGained: number;
    freshness: number;
    damagePercent: number;
    timeLeftSec: number;
    rating: 'PERFECT' | 'GOOD' | 'OK' | 'FAILED';
  };
  progression: {
    levelBefore: number;
    levelAfter: number;
    xpBefore: number;
    xpAfter: number;
    unlockedVehicle?: string | null;
  };
}

export type FisherShiftState =
  | 'IDLE'
  | 'STARTING_SHIFT'
  | 'SELECTING_DOCK'
  | 'SELECTING_SPOT'
  | 'TRAVEL_TO_SPOT'
  | 'PREPARING_GEAR'
  | 'BAIT_STEP'
  | 'CAST_STEP'
  | 'WAITING_BITE'
  | 'HOOK_WINDOW'
  | 'REELING'
  | 'LANDING'
  | 'CATCH_RESULT'
  | 'END_SHIFT';

export interface FisherProgress {
  level: number;
  xp: number;
  currentLevelXp: number;
  nextLevelXp: number | null;
  totalCatches: number;
  perfectCatches: number;
  bestStreak: number;
  totalEarnings: number;
  rareCatches: number;
  legendaryCatches: number;
  rodTier: number;
  carryCapacityKg: number;
  rodTierLabel: string;
  unlockedSpotTier: 'COMMON' | 'BETTER' | 'PREMIUM';
}

export interface FisherSpotOption {
  spotId: string;
  tier: 'COMMON' | 'BETTER' | 'PREMIUM';
  name: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  fishPool: string[];
  estimatedReward: number;
  estimatedXp: number;
  castDifficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  reelDifficulty: 'LOW' | 'MEDIUM' | 'HIGH';
  waitBiteEstimateSec: number;
  failRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  travelSec: number;
  rarityHint?: string;
  locked?: boolean;
  unlockLevel?: number;
}

export interface FisherStateResponse {
  progress: FisherProgress;
  shiftState: FisherShiftState;
  streak: number;
  carryCapacityKg: number;
  carryWeightKg: number;
  carryEstimatedValue: number;
  carriedFish: Array<{
    name: string;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY';
    size: 'NORMAL' | 'BIG' | 'GIANT';
    weightKg: number;
    value: number;
  }>;
  repairSecondsLeft?: number;
  repairLabel?: string | null;
  activeSpotName?: string | null;
  currentDockCell?: number | null;
  targetDockCell?: number | null;
  dockPrompt?: string | null;
  activeCatch: {
    spotId: string;
    spotTier: 'COMMON' | 'BETTER' | 'PREMIUM';
    spotName: string;
    travelLeftSec: number;
    waitBiteLeftSec: number;
    hookWindowLeftMs: number;
    castQuality: 'PERFECT' | 'GOOD' | 'BAD' | null;
    castMeter: number;
    hookQuality: 'PERFECT' | 'GOOD' | 'OK' | null;
    tension: number;
    catchProgress: number;
    lineIntegrity: number;
    stepsRequired: string[];
    stepsDone: string[];
    nextStep: string | null;
    pullPrompt: {
      direction: 'LEFT' | 'RIGHT';
      expiresInMs: number;
    } | null;
  } | null;
  lastResult?: FisherCatchResult | null;
}

export interface FisherCatchResult {
  caught: boolean;
  failReason: string | null;
  fishName: string | null;
  fishRarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'LEGENDARY' | null;
  fishSize?: 'NORMAL' | 'BIG' | 'GIANT' | null;
  fishWeightKg?: number | null;
  breakdown: {
    baseReward: number;
    spotMultiplier: number;
    levelMultiplier: number;
    qualityMultiplier: number;
    streakMultiplier: number;
    integrityMultiplier: number;
    bonusLootValue: number;
    totalReward: number;
    xpGained: number;
    qualityScore: number;
  };
  progression: {
    levelBefore: number;
    levelAfter: number;
    xpBefore: number;
    xpAfter: number;
    unlockedTier: 'COMMON' | 'BETTER' | 'PREMIUM' | null;
  };
}
