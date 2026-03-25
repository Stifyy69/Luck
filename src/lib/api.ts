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
} from '../types/game';

const BASE = import.meta.env.VITE_API_BASE ?? '';

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed: ${text}`);
  }
  return res.json() as Promise<T>;
}

async function get<T>(path: string, params?: Record<string, string>): Promise<T> {
  const url = params ? `${BASE}${path}?${new URLSearchParams(params)}` : `${BASE}${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API ${path} failed: ${text}`);
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

  marketOffer: (playerId: string, listingId: number, offeredPrice: number) =>
    post<MarketOfferResult>('/api/market/offer', { playerId, listingId, offeredPrice }),

  marketOfferAccept: (playerId: string, offerId: number) =>
    post<MarketActionResult>('/api/market/offer/accept', { playerId, offerId }),

  marketOfferReject: (playerId: string, offerId: number) =>
    post<MarketActionResult>('/api/market/offer/reject', { playerId, offerId }),

  marketBuy: (playerId: string, listingId: number) =>
    post<MarketActionResult>('/api/market/buy', { playerId, listingId }),

  marketSeller: (playerId: string) =>
    get<MarketSellerResponse>('/api/market/seller', { playerId }),

  marketBuyer: (playerId: string) =>
    get<MarketBuyerResponse>('/api/market/buyer', { playerId }),

  marketNpcRefresh: () =>
    post<{ ok: boolean }>('/api/market/npc/refresh', {}),

  marketListingCancel: (playerId: string, listingId: number) =>
    post<{ ok: boolean }>('/api/market/listing/cancel', { playerId, listingId }),
};
