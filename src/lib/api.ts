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
  PilotStateResponse,
  PilotFlightResult,
  CayoActionResult,
  CayoState,
  SleepActionResult,
  SleepState,
} from '../types/game';
import {
  publishCayoConversionReward,
  publishCayoSaleReward,
  publishFisherCatchReward,
  publishFisherSaleReward,
  publishPilotReward,
  publishPizzerReward,
} from './careerRewards';

const BASE = import.meta.env.VITE_API_BASE ?? '';
export type SessionUser = { id: number; username: string; email: string; playerId: string; isGuest?: boolean };

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
    credentials: 'include',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await resolveApiError(res));
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${BASE}${path}?${new URLSearchParams(params)}` : `${BASE}${path}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error(await resolveApiError(res));
  return res.json() as Promise<T>;
}

export const api = {
  ensureSession: async () => {
    const current = await fetch(`${BASE}/api/auth/me`, { credentials: 'include' });
    if (current.ok) return (await current.json() as { user: SessionUser }).user;
    const guest = await fetch(`${BASE}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: '{}',
    });
    if (!guest.ok) throw new Error(await resolveApiError(guest));
    return (await guest.json() as { user: SessionUser }).user;
  },

  bootstrap: (playerId: string) => get<PlayerState>('/api/bootstrap', { playerId }),
  showroom: () => get<ShowroomResponse>('/api/showroom'),
  showroomBuy: (playerId: string, modelId: number, useVoucher?: boolean) =>
    post<ShowroomBuyResult>('/api/showroom/buy', { playerId, modelId, useVoucher: useVoucher ?? false }),
  rouletteSpin: (playerId: string, costType: 'cash' | 'flowcoins' | 'fragments') =>
    post<SpinResult>('/api/roulette/spin', { playerId, costType }),
  mysteryOpen: (playerId: string) => post<MysteryOpenResult>('/api/mystery/open', { playerId }),
  inventoryUse: (playerId: string, itemId: number) => post<InventoryUseResult>('/api/inventory/use', { playerId, itemId }),
  inventoryApplyXenon: (playerId: string, itemId: number, vehicleId: number) =>
    post<InventoryUseResult>('/api/inventory/xenon/apply', { playerId, itemId, vehicleId }),

  cayoState: (playerId: string) => get<{ state: CayoState }>('/api/cayo/state', { playerId }),
  cayoAction: (playerId: string, stage: 'COLLECT' | 'PROCESS' | 'REFINE', operationId: string, useCleanForShortfall = false) =>
    post<CayoActionResult>('/api/cayo/action', { playerId, stage, operationId, useCleanForShortfall }),
  cayoSell: async (playerId: string, mode: 'BULK' | 'DELIVERY_100', operationId: string) => {
    const payload = await post<CayoActionResult>('/api/cayo/sell', { playerId, mode, operationId });
    publishCayoSaleReward(payload);
    return payload;
  },
  cayoConvert: async (playerId: string, operationId: string) => {
    const payload = await post<CayoActionResult>('/api/cayo/convert', { playerId, operationId });
    publishCayoConversionReward(payload);
    return payload;
  },

  sleepState: (playerId: string) => get<{ state: SleepState }>('/api/sleep/state', { playerId }),
  sleepStart: (playerId: string, operationId: string) => post<SleepActionResult>('/api/sleep/start', { playerId, operationId }),
  sleepClaim: (playerId: string, operationId: string) => post<SleepActionResult>('/api/sleep/claim', { playerId, operationId }),

  marketListings: (playerId?: string) => get<MarketListingsResponse>('/api/market/listings', playerId ? { playerId } : undefined),
  marketList: (playerId: string, assetType: MarketAssetType, assetRefId: number | null, askPrice: number) =>
    post<MarketListResult>('/api/market/list', { playerId, assetType, assetRefId, askPrice }),
  marketOffer: (playerId: string, listingId: number, offeredPrice: number, listingHint?: Partial<MarketListing>) =>
    post<MarketOfferResult>('/api/market/offer', {
      playerId,
      listingId,
      offeredPrice,
      listingHint: listingHint ? {
        sellerType: listingHint.sellerType,
        sellerPlayerId: listingHint.sellerPlayerId,
        assetType: listingHint.assetType,
        assetRefId: listingHint.assetRefId,
      } : null,
    }),
  marketOfferAccept: (playerId: string, offerId: number) => post<MarketActionResult>('/api/market/offer/accept', { playerId, offerId }),
  marketOfferReject: (playerId: string, offerId: number) => post<MarketActionResult>('/api/market/offer/reject', { playerId, offerId }),
  marketOfferCancel: (playerId: string, offerId: number) => post<{ ok: boolean }>('/api/market/offer/cancel', { playerId, offerId }),
  marketBuy: (playerId: string, listingId: number, listingHint?: Partial<MarketListing>) =>
    post<MarketActionResult>('/api/market/buy', {
      playerId,
      listingId,
      listingHint: listingHint ? {
        sellerType: listingHint.sellerType,
        sellerPlayerId: listingHint.sellerPlayerId,
        assetType: listingHint.assetType,
        assetRefId: listingHint.assetRefId,
      } : null,
    }),
  marketSeller: (playerId: string) => get<MarketSellerResponse>('/api/market/seller', { playerId }),
  marketBuyer: (playerId: string) => get<MarketBuyerResponse>('/api/market/buyer', { playerId }),
  marketNpcRefresh: () => post<{ ok: boolean }>('/api/market/npc/refresh', {}),
  marketListingCancel: (playerId: string, listingId: number) => post<{ ok: boolean }>('/api/market/listing/cancel', { playerId, listingId }),

  playerProfile: (playerId: string) => get<PlayerProfileResponse>('/api/player/profile', { playerId }),
  playerRename: (playerId: string, displayName: string) => post<{ ok: boolean; displayName: string }>('/api/player/profile/name', { playerId, displayName }),

  pizzerState: (playerId: string) => get<PizzerStateResponse>('/api/pizzer/state', { playerId }),
  pizzerShiftStart: (playerId: string) => post<PizzerStateResponse>('/api/pizzer/shift/start', { playerId }),
  pizzerShiftEnd: (playerId: string) => post<PizzerStateResponse>('/api/pizzer/shift/end', { playerId }),
  pizzerOrderOptions: (playerId: string) => post<{ options: PizzerOrderOption[] }>('/api/pizzer/orders/options', { playerId }),
  pizzerOrderSelect: (playerId: string, orderId: string) => post<PizzerStateResponse>('/api/pizzer/order/select', { playerId, orderId }),
  pizzerPackingStep: (playerId: string, stepKey: string) => post<PizzerStateResponse>('/api/pizzer/packing/step', { playerId, stepKey }),
  pizzerDamageReport: (playerId: string, damageDelta: number) => post<PizzerStateResponse>('/api/pizzer/delivery/report-damage', { playerId, damageDelta }),
  pizzerHandover: async (playerId: string, handoverVariant: string) => {
    const payload = await post<{ state: PizzerStateResponse; result: PizzerDeliveryResult; cityProgress?: unknown; cityReward?: unknown }>('/api/pizzer/delivery/handover', { playerId, handoverVariant });
    publishPizzerReward(payload);
    return payload;
  },

  pilotState: (playerId: string) => get<PilotStateResponse>('/api/pilot/state', { playerId }),
  pilotShiftStart: (playerId: string) => post<PilotStateResponse>('/api/pilot/shift/start', { playerId }),
  pilotShiftEnd: (playerId: string) => post<PilotStateResponse>('/api/pilot/shift/end', { playerId }),
  pilotRouteSelect: (playerId: string, routeId: string) => post<PilotStateResponse>('/api/pilot/route/select', { playerId, routeId }),
  pilotFlightStart: (playerId: string) => post<{ state: PilotStateResponse; flight: { sessionId: string; routeId: string; durationSeconds: number; stages: string[] } }>('/api/pilot/flight/start', { playerId }),
  pilotFlightCancel: (playerId: string) => post<{ state: PilotStateResponse }>('/api/pilot/flight/cancel', { playerId }),
  pilotFlightComplete: async (playerId: string) => {
    const payload = await post<{ state: PilotStateResponse; result: PilotFlightResult; cityProgress?: unknown; cityReward?: unknown }>('/api/pilot/flight/complete', { playerId });
    publishPilotReward(payload);
    return payload;
  },

  fisherState: (playerId: string) => get<FisherStateResponse>('/api/fisher/state', { playerId }),
  fisherShiftStart: (playerId: string) => post<FisherStateResponse>('/api/fisher/shift/start', { playerId }),
  fisherShiftEnd: (playerId: string) => post<FisherStateResponse>('/api/fisher/shift/end', { playerId }),
  fisherSpotOptions: (playerId: string) => post<{ options: FisherSpotOption[] }>('/api/fisher/spots/options', { playerId }),
  fisherDockSelect: async (playerId: string, cellId: number) => {
    const payload = await post<FisherStateResponse>('/api/fisher/dock/select', { playerId, cellId });
    publishFisherCatchReward(payload);
    return payload;
  },
  fisherSpotSelect: (playerId: string, spotId: string) => post<FisherStateResponse>('/api/fisher/spot/select', { playerId, spotId }),
  fisherSpotChange: (playerId: string) => post<FisherStateResponse>('/api/fisher/spot/change', { playerId }),
  fisherStep: (playerId: string, stepKey: string) => post<FisherStateResponse>('/api/fisher/step', { playerId, stepKey }),
  fisherCastCommit: (playerId: string, meterValue: number) => post<FisherStateResponse>('/api/fisher/cast/commit', { playerId, meterValue }),
  fisherHookAttempt: (playerId: string) => post<FisherStateResponse>('/api/fisher/hook/attempt', { playerId }),
  fisherReelTick: (playerId: string, isReeling = true) => post<FisherStateResponse>('/api/fisher/reel/tick', { playerId, isReeling }),
  fisherPullRespond: (playerId: string, direction: 'LEFT' | 'RIGHT') => post<FisherStateResponse>('/api/fisher/pull/respond', { playerId, direction }),
  fisherLand: async (playerId: string) => {
    const payload = await post<{ state: FisherStateResponse; result: FisherCatchResult }>('/api/fisher/land', { playerId });
    publishFisherCatchReward(payload);
    return payload;
  },
  fisherCatchSell: async (playerId: string) => {
    const payload = await post<{ soldValue: number; baseSoldValue?: number; vipMultiplier?: number; state: FisherStateResponse }>('/api/fisher/catch/sell', { playerId });
    publishFisherSaleReward(payload);
    return payload;
  },
  fisherRodBuy: (playerId: string, tier: number) => post<{ boughtTier: number; rodName: string; cost: number; state: FisherStateResponse }>('/api/fisher/rod/buy', { playerId, tier }),
  fisherCarryBuy: (playerId: string) => post<{ previousCapacity: number; nextCapacity: number; cost: number; state: FisherStateResponse }>('/api/fisher/carry/buy', { playerId }),
};
