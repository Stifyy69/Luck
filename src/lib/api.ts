// API helper for Batch A endpoints
import type {
  PlayerState,
  ShowroomResponse,
  SpinResult,
  MysteryOpenResult,
  ShowroomBuyResult,
  InventoryUseResult,
  MarketListingsResponse,
  MarketSellerResponse,
  MarketBuyerResponse,
  MarketListResult,
  MarketOfferResult,
  MarketActionResult,
  MarketAssetType,
  PlayerProfileResponse,
  MarketListing,
  PizzerOrderOption,
  PizzerStateResponse,
  PizzerDeliveryResult,
  FisherSpotOption,
  FisherStateResponse,
  FisherCatchResult,
} from '../types/game';

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function resolveApiError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    const raw = String(data?.error ?? data?.message ?? '').trim();
    if (!raw) return res.statusText || 'request failed';
    if (raw.toLowerCase().includes('insufficient funds')) return 'insufficient';
    if (raw.toLowerCase().includes('service unavailable')) return 'service unavailable';
    return raw;
  } catch {
    const text = await res.text().catch(() => res.statusText);
    const normalized = String(text || res.statusText || 'request failed').trim();
    if (normalized.toLowerCase().includes('insufficient funds')) return 'insufficient';
    if (normalized.toLowerCase().includes('service unavailable')) return 'service unavailable';
    return normalized;
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await resolveApiError(res));
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${BASE}${path}?${new URLSearchParams(params)}` : `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(await resolveApiError(res));
  }
  return res.json() as Promise<T>;
}

export const api = {
  bootstrap: (playerId: string) =>
    get<PlayerState>('/api/bootstrap', { playerId }),

  showroom: () =>
    get<ShowroomResponse>('/api/showroom'),

  showroomBuy: (playerId: string, modelId: number, useVoucher?: boolean) =>
    post<ShowroomBuyResult>('/api/showroom/buy', { playerId, modelId, useVoucher: useVoucher ?? false }),

  rouletteSpin: (playerId: string, costType: 'cash' | 'flowcoins') =>
    post<SpinResult>('/api/roulette/spin', { playerId, costType }),

  mysteryOpen: (playerId: string) =>
    post<MysteryOpenResult>('/api/mystery/open', { playerId }),

  inventoryUse: (playerId: string, itemId: number) =>
    post<InventoryUseResult>('/api/inventory/use', { playerId, itemId }),

  // ---------------------------------------------------------------------------
  // Batch B: Marketplace
  // ---------------------------------------------------------------------------

  marketListings: (playerId?: string) =>
    get<MarketListingsResponse>('/api/market/listings', playerId ? { playerId } : undefined),

  marketList: (playerId: string, assetType: MarketAssetType, assetRefId: number | null, askPrice: number) =>
    post<MarketListResult>('/api/market/list', { playerId, assetType, assetRefId, askPrice }),

  marketOffer: (playerId: string, listingId: number, offeredPrice: number, listingHint?: Partial<MarketListing>) =>
    post<MarketOfferResult>('/api/market/offer', {
      playerId,
      listingId,
      offeredPrice,
      listingHint: listingHint
        ? {
            sellerType: listingHint.sellerType,
            sellerPlayerId: listingHint.sellerPlayerId,
            assetType: listingHint.assetType,
            assetRefId: listingHint.assetRefId,
          }
        : null,
    }),

  marketOfferAccept: (playerId: string, offerId: number) =>
    post<MarketActionResult>('/api/market/offer/accept', { playerId, offerId }),

  marketOfferReject: (playerId: string, offerId: number) =>
    post<MarketActionResult>('/api/market/offer/reject', { playerId, offerId }),

  marketOfferCancel: (playerId: string, offerId: number) =>
    post<{ ok: boolean }>('/api/market/offer/cancel', { playerId, offerId }),

  marketBuy: (playerId: string, listingId: number, listingHint?: Partial<MarketListing>) =>
    post<MarketActionResult>('/api/market/buy', {
      playerId,
      listingId,
      listingHint: listingHint
        ? {
            sellerType: listingHint.sellerType,
            sellerPlayerId: listingHint.sellerPlayerId,
            assetType: listingHint.assetType,
            assetRefId: listingHint.assetRefId,
          }
        : null,
    }),

  marketSeller: (playerId: string) =>
    get<MarketSellerResponse>('/api/market/seller', { playerId }),

  marketBuyer: (playerId: string) =>
    get<MarketBuyerResponse>('/api/market/buyer', { playerId }),

  marketNpcRefresh: () =>
    post<{ ok: boolean }>('/api/market/npc/refresh', {}),

  marketListingCancel: (playerId: string, listingId: number) =>
    post<{ ok: boolean }>('/api/market/listing/cancel', { playerId, listingId }),

  playerProfile: (playerId: string) =>
    get<PlayerProfileResponse>('/api/player/profile', { playerId }),

  playerRename: (playerId: string, displayName: string) =>
    post<{ ok: boolean; displayName: string }>('/api/player/profile/name', { playerId, displayName }),

  playerCashAdjust: (playerId: string, delta: number) =>
    post<{ ok: boolean; cleanMoney: number }>('/api/player/cash/adjust', { playerId, delta }),

  pizzerState: (playerId: string) =>
    get<PizzerStateResponse>('/api/pizzer/state', { playerId }),

  pizzerShiftStart: (playerId: string) =>
    post<PizzerStateResponse>('/api/pizzer/shift/start', { playerId }),

  pizzerShiftEnd: (playerId: string) =>
    post<PizzerStateResponse>('/api/pizzer/shift/end', { playerId }),

  pizzerOrderOptions: (playerId: string) =>
    post<{ options: PizzerOrderOption[] }>('/api/pizzer/orders/options', { playerId }),

  pizzerOrderSelect: (playerId: string, orderId: string) =>
    post<PizzerStateResponse>('/api/pizzer/order/select', { playerId, orderId }),

  pizzerPackingStep: (playerId: string, stepKey: string) =>
    post<PizzerStateResponse>('/api/pizzer/packing/step', { playerId, stepKey }),

  pizzerDamageReport: (playerId: string, damageDelta: number) =>
    post<PizzerStateResponse>('/api/pizzer/delivery/report-damage', { playerId, damageDelta }),

  pizzerHandover: (playerId: string, handoverVariant: string) =>
    post<{ state: PizzerStateResponse; result: PizzerDeliveryResult }>('/api/pizzer/delivery/handover', { playerId, handoverVariant }),

  pizzerAdminSetLevel: (playerId: string, level: number) =>
    post<{ ok: boolean }>('/api/pizzer/admin/set-level', { playerId, level }),

  pizzerAdminAddXp: (playerId: string, xp: number) =>
    post<{ ok: boolean }>('/api/pizzer/admin/add-xp', { playerId, xp }),

  pizzerAdminReset: (playerId: string) =>
    post<{ ok: boolean }>('/api/pizzer/admin/reset', { playerId }),

  fisherState: (playerId: string) =>
    get<FisherStateResponse>('/api/fisher/state', { playerId }),

  fisherShiftStart: (playerId: string) =>
    post<FisherStateResponse>('/api/fisher/shift/start', { playerId }),

  fisherShiftEnd: (playerId: string) =>
    post<FisherStateResponse>('/api/fisher/shift/end', { playerId }),

  fisherSpotOptions: (playerId: string) =>
    post<{ options: FisherSpotOption[] }>('/api/fisher/spots/options', { playerId }),

  fisherSpotSelect: (playerId: string, spotId: string) =>
    post<FisherStateResponse>('/api/fisher/spot/select', { playerId, spotId }),

  fisherSpotChange: (playerId: string) =>
    post<FisherStateResponse>('/api/fisher/spot/change', { playerId }),

  fisherStep: (playerId: string, stepKey: string) =>
    post<FisherStateResponse>('/api/fisher/step', { playerId, stepKey }),

  fisherCastCommit: (playerId: string, meterValue: number) =>
    post<FisherStateResponse>('/api/fisher/cast/commit', { playerId, meterValue }),

  fisherHookAttempt: (playerId: string) =>
    post<FisherStateResponse>('/api/fisher/hook/attempt', { playerId }),

  fisherReelTick: (playerId: string, isReeling: boolean) =>
    post<FisherStateResponse>('/api/fisher/reel/tick', { playerId, isReeling }),

  fisherPullRespond: (playerId: string, direction: 'LEFT' | 'RIGHT') =>
    post<FisherStateResponse>('/api/fisher/pull/respond', { playerId, direction }),

  fisherLand: (playerId: string) =>
    post<{ state: FisherStateResponse; result: FisherCatchResult }>('/api/fisher/land', { playerId }),

  fisherCatchSell: (playerId: string) =>
    post<{ soldValue: number; state: FisherStateResponse }>('/api/fisher/catch/sell', { playerId }),
};
