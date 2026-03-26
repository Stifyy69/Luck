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
