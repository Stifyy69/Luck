import { useEffect, useState, useCallback } from 'react';
import { api } from '../lib/api';
import { getClothingImagePath, getVehicleImagePath } from '../lib/assets';
import type {
  MarketListing,
  MarketOffer,
  MarketAssetType,
  NpcNegotiationResult,
  PlayerState,
  OwnedVehicle,
  InventoryItem,
} from '../types/game';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';

const PLAYER_KEY = 'luck_player_id_v1';

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (id) return id;
  id = `player_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(PLAYER_KEY, id);
  return id;
}

function fmt(n: number) {
  return n.toLocaleString('en-US') + '$';
}

function getMarketPrice(meta: Record<string, unknown>, askPrice: number): number {
  const value = Number(meta.marketPrice ?? meta.marketValue ?? meta.basePrice ?? meta.purchasePrice ?? askPrice);
  return Number.isFinite(value) && value > 0 ? value : askPrice;
}

function getAssetImage(listing: { assetType: MarketAssetType; assetName: string; assetMetadata: Record<string, unknown> }) {
  const meta = listing.assetMetadata;
  return typeof meta.imagePath === 'string'
    ? meta.imagePath
    : listing.assetType === 'VEHICLE'
      ? getVehicleImagePath(listing.assetName)
      : getClothingImagePath(listing.assetName);
}

const RARITY_COLOR: Record<string, string> = {
  BLUE: 'text-blue-400 border-blue-400/40',
  LIGHT_PURPLE: 'text-purple-400 border-purple-400/40',
  DARK_PURPLE: 'text-purple-600 border-purple-600/40',
  RED: 'text-red-400 border-red-400/40',
  YELLOW: 'text-yellow-400 border-yellow-400/40',
};

const RARITY_LABEL: Record<string, string> = {
  BLUE: 'Blue',
  LIGHT_PURPLE: 'Light Purple',
  DARK_PURPLE: 'Dark Purple',
  RED: 'Red',
  YELLOW: 'Yellow',
};

const ASSET_EMOJI: Record<string, string> = {
  VEHICLE: '🚗',
  CLOTHING: '👕',
  XENON_VEHICLE: '🔩',
};

type Tab = 'listings' | 'myListings' | 'myOffers' | 'createListing';

type NegotiationSignal = 'ACCEPT' | 'COUNTER' | 'REJECT';

interface SellerListing {
  id: number;
  assetType: MarketAssetType;
  assetName: string;
  assetMetadata: Record<string, unknown>;
  askPrice: number;
  status: string;
  createdAt: string;
}

interface IncomingOffer extends MarketOffer {
  buyerPlayerId: string;
}

export default function CNNMarketplace() {
  const [playerId] = useState(getPlayerId);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [tab, setTab] = useState<Tab>('listings');
  const [listings, setListings] = useState<MarketListing[]>([]);
  const [sellerListings, setSellerListings] = useState<SellerListing[]>([]);
  const [incomingOffers, setIncomingOffers] = useState<IncomingOffer[]>([]);
  const [myOffers, setMyOffers] = useState<MarketOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{ message: string; isError: boolean } | null>(null);

  // Offer modal
  const [offerModal, setOfferModal] = useState<{ listing: MarketListing } | null>(null);
  const [offerPrice, setOfferPrice] = useState('');

  // Create listing form
  const [createType, setCreateType] = useState<MarketAssetType>('VEHICLE');
  const [createAssetId, setCreateAssetId] = useState<number | null>(null);
  const [createAskPrice, setCreateAskPrice] = useState('');
  const [npcSignals, setNpcSignals] = useState<Record<number, NegotiationSignal[]>>({});

  const showPopup = (message: string, isError = false) => {
    setPopup({ message, isError });
    window.setTimeout(() => setPopup(null), 2800);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [playerData, listingsData, sellerData, buyerData] = await Promise.allSettled([
        api.bootstrap(playerId),
        api.marketListings(playerId),
        api.marketSeller(playerId),
        api.marketBuyer(playerId),
      ]);

      if (playerData.status === 'fulfilled') setPlayer(playerData.value);
      if (listingsData.status === 'fulfilled') setListings(listingsData.value.listings ?? []);
      if (sellerData.status === 'fulfilled') {
        setSellerListings((sellerData.value.listings ?? []) as SellerListing[]);
        setIncomingOffers((sellerData.value.incomingOffers ?? []) as IncomingOffer[]);
      } else {
        setSellerListings([]);
        setIncomingOffers([]);
      }
      if (buyerData.status === 'fulfilled') {
        setMyOffers(buyerData.value.offers ?? []);
      } else {
        setMyOffers([]);
      }

      // If listings endpoint is down, keep page usable without hard error toast.
      if (listingsData.status === 'rejected') {
        setListings([]);
      }
    } catch (e) {
      console.error('CNN load error', e);
      showPopup('Marketplace load failed.', true);
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  useEffect(() => {
    loadAll();
    // Auto-refresh listings every 30s
    const interval = window.setInterval(() => loadAll(), 30_000);
    return () => window.clearInterval(interval);
  }, [loadAll]);

  const handleBuy = async (listing: MarketListing) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.marketBuy(playerId, listing.id, listing);
      showPopup(`Purchased ${listing.assetName} for ${fmt(listing.askPrice)}.`);
      await loadAll();
    } catch (e) {
      const message = String(e instanceof Error ? e.message : 'Purchase failed');
      if (message.toLowerCase().includes('listing unavailable') || message.toLowerCase().includes('listing not found')) {
        showPopup('Listing just changed. Refreshing market...', true);
        await loadAll();
      } else {
        showPopup(message, true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleOfferSubmit = async () => {
    if (!offerModal || busy) return;
    const price = parseInt(offerPrice.replace(/\D/g, ''), 10);
    if (!price || price <= 0) { showPopup('Enter a valid price.', true); return; }
    setBusy(true);
    try {
      const result = await api.marketOffer(playerId, offerModal.listing.id, price, offerModal.listing);
      const negotiation = result.negotiation as NpcNegotiationResult | null | undefined;

      if (negotiation?.isNpc) {
        setNpcSignals((current) => {
          const next = [...(current[offerModal.listing.id] ?? [])];
          next.push(negotiation.signal);
          return { ...current, [offerModal.listing.id]: next.slice(0, 3) };
        });

        if (negotiation.signal === 'ACCEPT') {
          showPopup(`NPC accepted. Purchased for ${fmt(price)}.`);
          setOfferModal(null);
          setOfferPrice('');
        } else if (negotiation.signal === 'COUNTER') {
          showPopup(
            `NPC countered: ${fmt(negotiation.counterAskPrice ?? negotiation.askPrice)} (${negotiation.attemptsLeft} attempt(s) left).`,
          );
        } else {
          showPopup(
            negotiation.attemptsLeft > 0
              ? `NPC rejected this offer. ${negotiation.attemptsLeft} attempt(s) left.`
              : 'NPC negotiation closed. No attempts left.',
            true,
          );
          if (negotiation.attemptsLeft <= 0) {
            setOfferModal(null);
            setOfferPrice('');
          }
        }
      } else {
        showPopup(`Offer sent: ${fmt(price)}.`);
        setOfferModal(null);
        setOfferPrice('');
      }

      await loadAll();
    } catch (e) {
      const message = String(e instanceof Error ? e.message : 'Offer failed');
      if (message.toLowerCase().includes('listing unavailable') || message.toLowerCase().includes('listing not found')) {
        showPopup('Listing just changed. Refreshing market...', true);
        setOfferModal(null);
        setOfferPrice('');
        await loadAll();
      } else {
        showPopup(message, true);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleCancelMyOffer = async (offerId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.marketOfferCancel(playerId, offerId);
      showPopup('Offer cancelled.');
      await loadAll();
    } catch (e) {
      showPopup(String(e instanceof Error ? e.message : 'Cancel failed'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptOffer = async (offerId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.marketOfferAccept(playerId, offerId);
      showPopup(`Offer accepted. You got ${fmt(result.soldFor ?? 0)}.`);
      await loadAll();
    } catch (e) {
      showPopup(String(e instanceof Error ? e.message : 'Accept failed'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleRejectOffer = async (offerId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.marketOfferReject(playerId, offerId);
      showPopup('Offer rejected.');
      await loadAll();
    } catch (e) {
      showPopup(String(e instanceof Error ? e.message : 'Reject failed'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleCancelListing = async (listingId: number) => {
    if (busy) return;
    setBusy(true);
    try {
      await api.marketListingCancel(playerId, listingId);
      showPopup('Listing cancelled.');
      await loadAll();
    } catch (e) {
      showPopup(String(e instanceof Error ? e.message : 'Cancel failed'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateListing = async () => {
    if (busy) return;
    const price = parseInt(createAskPrice.replace(/\D/g, ''), 10);
    if (!price || price <= 0) { showPopup('Enter a valid price.', true); return; }
    if (createType !== 'VEHICLE' && createAssetId === null) {
      showPopup('Select an item.', true); return;
    }
    if (createType === 'VEHICLE' && createAssetId === null) {
      showPopup('Select a vehicle.', true); return;
    }
    setBusy(true);
    try {
      await api.marketList(playerId, createType, createAssetId, price);
      showPopup('Listing published on CNN.');
      setCreateAskPrice('');
      setCreateAssetId(null);
      setTab('myListings');
      await loadAll();
    } catch (e) {
      showPopup(String(e instanceof Error ? e.message : 'Listing failed'), true);
    } finally {
      setBusy(false);
    }
  };

  const handleNpcRefresh = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await api.marketNpcRefresh();
      showPopup('NPC sellers refreshed.');
      await loadAll();
    } catch (e) {
      // Soft fail: no noisy backend status message.
      showPopup('Refresh unavailable.', true);
    } finally {
      setBusy(false);
    }
  };

  // Assets available to list
  // Check which assets are already listed
  const listedAssetRefs = new Set(
    [...sellerListings.filter((l) => l.status === 'ACTIVE')].map(
      (l) => `${l.assetType}-${(l.assetMetadata as Record<string, unknown>)?.id ?? ''}`,
    ),
  );

  const listableVehicles: OwnedVehicle[] = (player?.ownedVehicles ?? []).filter(
    (vehicle) => !listedAssetRefs.has(`VEHICLE-${vehicle.id}`),
  );
  const listableClothing: InventoryItem[] = (player?.inventory ?? []).filter(
    (i) => i.itemType === 'CLOTHING' && i.quantity > 0 && !listedAssetRefs.has(`CLOTHING-${i.id}`),
  );
  const listableXenon: InventoryItem[] = (player?.inventory ?? []).filter(
    (i) => i.itemType === 'XENON_VEHICLE' && i.quantity > 0 && !listedAssetRefs.has(`XENON_VEHICLE-${i.id}`),
  );

  const activeListings = listings.filter((l) => !l.isOwn);
  const npcListings = activeListings.filter((listing) => listing.sellerType === 'NPC').slice(0, 10);
  const playerListings = activeListings.filter((listing) => listing.sellerType !== 'NPC');
  const visibleActiveListings = [...npcListings, ...playerListings];
  const ownListings = sellerListings.filter((l) => l.status === 'ACTIVE');
  const pendingIncoming = incomingOffers.filter((o) => o.status === 'PENDING');

  const selectedVehicle = createType === 'VEHICLE'
    ? listableVehicles.find((vehicle) => vehicle.id === createAssetId) ?? null
    : null;
  const selectedClothing = createType === 'CLOTHING'
    ? listableClothing.find((item) => item.id === createAssetId) ?? null
    : null;
  const selectedXenon = createType === 'XENON_VEHICLE'
    ? listableXenon.find((item) => item.id === createAssetId) ?? null
    : null;

  const selectedMarketPrice = selectedVehicle
    ? Number(selectedVehicle.purchasePrice)
    : selectedClothing
      ? Number((selectedClothing.metadata as Record<string, unknown>)?.marketValue ?? 0)
      : selectedXenon
        ? Number((selectedXenon.metadata as Record<string, unknown>)?.marketValue ?? 0)
        : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-white/60">
        <div className="text-center">
          <div className="mb-3 text-4xl">📡</div>
          <p className="text-sm font-bold uppercase tracking-widest">Loading CNN Marketplace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-2 py-6 md:py-8">
      <PageDisclaimer />
      {popup && (
        <div
          className={`fixed right-4 top-6 z-[80] max-w-xs rounded-xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur ${
            popup.isError
              ? 'border-red-500/40 bg-red-900/80 text-red-200'
              : 'border-green-500/40 bg-green-900/80 text-green-200'
          }`}
        >
          {popup.message}
        </div>
      )}

      {/* Offer Modal */}
      {offerModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm rounded-2xl p-6">
            {(() => {
              const meta = offerModal.listing.assetMetadata as Record<string, unknown>;
              const marketPrice = getMarketPrice(meta, offerModal.listing.askPrice);
              const signals = npcSignals[offerModal.listing.id] ?? [];
              return (
                <>
                  <h3 className="mb-1 text-lg font-black text-white">Send Offer</h3>
                  <p className="mb-4 text-sm text-white/60">{offerModal.listing.assetName}</p>
                  <div className="mb-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2">
                      <p className="text-white/45">Market Price</p>
                      <p className="text-sm font-black text-white">{fmt(marketPrice)}</p>
                    </div>
                    <div className="rounded-xl border border-[#ffd95a]/30 bg-[#ffd95a]/10 p-2">
                      <p className="text-white/45">Ask Price</p>
                      <p className="text-sm font-black text-[#ffd95a]">{fmt(offerModal.listing.askPrice)}</p>
                    </div>
                  </div>
                  {offerModal.listing.sellerType === 'NPC' && (
                    <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-white/55">NPC negotiation (max 3)</p>
                      <div className="mt-2 flex items-center gap-2">
                        {[0, 1, 2].map((index) => {
                          const signal = signals[index];
                          const cls = signal === 'ACCEPT'
                            ? 'bg-green-500'
                            : signal === 'COUNTER'
                              ? 'bg-yellow-400'
                              : signal === 'REJECT'
                                ? 'bg-red-500'
                                : 'bg-white/20';
                          return <span key={String(index)} className={`h-3.5 w-3.5 rounded-full ${cls}`} />;
                        })}
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
            <input
              type="number"
              className="mb-4 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#ffd95a]/50"
              placeholder="Offer amount ($)"
              value={offerPrice}
              onChange={(e) => setOfferPrice(e.target.value)}
              min={1}
            />
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleOfferSubmit}
                disabled={busy}
                className="btn-primary flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-50"
              >
                Send
              </button>
              <button
                type="button"
                onClick={() => { setOfferModal(null); setOfferPrice(''); }}
                className="flex-1 rounded-xl border border-white/20 py-2 text-sm font-bold text-white/70 hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">📡</span>
              <h1 className="text-2xl font-black tracking-tight text-white">CNN Marketplace</h1>
            </div>
            <p className="text-xs text-white/50">Buy, sell, negotiate — live market.</p>
          </div>
          {player && (
            <div className="ml-auto rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
              <p className="text-xs text-white/50">Balance</p>
              <p className="text-lg font-black text-[#ffd95a]">{fmt(player.cleanMoney)}</p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(
            [
              { key: 'listings', label: '🏪 Active Listings', count: visibleActiveListings.length },
              { key: 'myListings', label: '📋 My Listings', count: ownListings.length, badge: pendingIncoming.length },
              { key: 'myOffers', label: '💬 My Offers', count: myOffers.length },
              { key: 'createListing', label: '➕ Create Listing' },
            ] as Array<{ key: Tab; label: string; count?: number; badge?: number }>
          ).map(({ key, label, count, badge }) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative rounded-xl border px-4 py-2 text-sm font-bold transition ${
                tab === key
                  ? 'border-[#ffd95a]/50 bg-[#ffd95a]/10 text-[#ffd95a]'
                  : 'border-white/10 text-white/60 hover:bg-white/5'
              }`}
            >
              {label}
              {typeof count === 'number' && (
                <span className="ml-1.5 rounded-full bg-white/10 px-1.5 py-0.5 text-xs">{count}</span>
              )}
              {typeof badge === 'number' && badge > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-black text-white">
                  {badge}
                </span>
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={handleNpcRefresh}
            disabled={busy}
            className="ml-auto rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/40 transition hover:border-white/20 hover:text-white/60 disabled:opacity-40"
            title="Refresh NPC sellers"
          >
            🔄 NPC
          </button>
        </div>

        {/* ── TAB: Active Listings ── */}
        {tab === 'listings' && (
          <div>
            {visibleActiveListings.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 py-16 text-center text-white/40">
                <p className="mb-2 text-4xl">📭</p>
                <p className="font-bold">No active listings right now.</p>
                <p className="mt-1 text-sm">Check back later or publish the first one.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleActiveListings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onBuy={() => handleBuy(listing)}
                    onOffer={() => { setOfferModal({ listing }); setOfferPrice(''); }}
                    busy={busy}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: My Listings ── */}
        {tab === 'myListings' && (
          <div className="space-y-6">
            {/* Incoming offers */}
            {pendingIncoming.length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-[#ffd95a]">
                  📨 Incoming Offers ({pendingIncoming.length})
                </h2>
                <div className="space-y-2">
                  {pendingIncoming.map((offer) => (
                    <div
                      key={offer.id}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-[#ffd95a]/20 bg-[#ffd95a]/5 p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-white">{offer.assetName}</p>
                        <p className="text-xs text-white/50">
                          From:{' '}
                          <span className="font-bold text-white/70">
                            {offer.buyerPlayerId}
                          </span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-green-400">{fmt(offer.offeredPrice)}</p>
                        <p className="text-xs text-white/40">ask: {fmt(offer.askPrice)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptOffer(offer.id)}
                          disabled={busy}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-green-500 disabled:opacity-50"
                        >
                          ✅ Accept
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectOffer(offer.id)}
                          disabled={busy}
                          className="rounded-lg bg-red-700/60 px-3 py-1.5 text-xs font-bold text-red-200 hover:bg-red-600/60 disabled:opacity-50"
                        >
                          ✗ Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My active listings */}
            <div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white/60">
                📋 My Active Listings ({ownListings.length})
              </h2>
              {ownListings.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center text-white/40">
                  <p className="text-3xl mb-2">📭</p>
                  <p className="font-bold text-sm">You have no active listings.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {ownListings.map((listing) => {
                    const pendingCount = incomingOffers.filter(
                      (o) => o.listingId === listing.id && o.status === 'PENDING',
                    ).length;
                    return (
                      <OwnedListingCard
                        key={listing.id}
                        listing={listing}
                        pendingOffers={pendingCount}
                        busy={busy}
                        onCancel={() => handleCancelListing(listing.id)}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Sold/cancelled history */}
            {sellerListings.filter((l) => l.status !== 'ACTIVE').length > 0 && (
              <div>
                <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white/40">
                  History
                </h2>
                <div className="space-y-1">
                  {sellerListings
                    .filter((l) => l.status !== 'ACTIVE')
                    .slice(0, 10)
                    .map((listing) => (
                      <div
                        key={listing.id}
                        className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/3 p-2 opacity-60"
                      >
                        <span className="text-lg">{ASSET_EMOJI[listing.assetType]}</span>
                        <span className="flex-1 truncate text-sm text-white/60">{listing.assetName}</span>
                        <span className="text-sm font-bold text-white/40">{fmt(listing.askPrice)}</span>
                        <span
                          className={`rounded px-2 py-0.5 text-xs font-bold ${
                            listing.status === 'SOLD'
                              ? 'bg-green-900/50 text-green-400'
                              : 'bg-red-900/50 text-red-400'
                          }`}
                        >
                          {listing.status}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: My Offers ── */}
        {tab === 'myOffers' && (
          <div>
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-white/60">
              💬 My Offers ({myOffers.length})
            </h2>
            {myOffers.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/5 py-10 text-center text-white/40">
                <p className="text-3xl mb-2">💬</p>
                <p className="font-bold text-sm">You have not sent any offers.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myOffers.map((offer) => (
                  <MyOfferCard
                    key={offer.id}
                    offer={offer}
                    busy={busy}
                    onCancel={() => handleCancelMyOffer(offer.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Create Listing ── */}
        {tab === 'createListing' && (
          <div className="mx-auto max-w-md">
            <div className="hud-panel rounded-2xl p-6">
              <h2 className="mb-5 text-lg font-black text-white">📢 Create New Listing</h2>

              {/* Asset type selector */}
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/50">
                Asset Type
              </label>
              <div className="mb-4 flex gap-2">
                {(['VEHICLE', 'CLOTHING', 'XENON_VEHICLE'] as MarketAssetType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { setCreateType(t); setCreateAssetId(null); }}
                    className={`flex-1 rounded-xl border py-2 text-sm font-bold transition ${
                      createType === t
                        ? 'border-[#ffd95a]/50 bg-[#ffd95a]/10 text-[#ffd95a]'
                        : 'border-white/10 text-white/50 hover:bg-white/5'
                    }`}
                  >
                    {ASSET_EMOJI[t]} {t === 'XENON_VEHICLE' ? 'Xenon' : t === 'VEHICLE' ? 'Vehicle' : 'Clothing'}
                  </button>
                ))}
              </div>

              {/* Asset picker */}
              {createType === 'VEHICLE' && (
                <>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/50">
                    Select Vehicle
                  </label>
                  {listableVehicles.length === 0 ? (
                    <p className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/40">
                      You have no vehicles to list.
                    </p>
                  ) : (
                    <select
                      className="mb-4 w-full rounded-xl border border-white/15 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none"
                      value={createAssetId ?? ''}
                      onChange={(e) => setCreateAssetId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Select vehicle —</option>
                      {listableVehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.modelName} (paid {fmt(v.purchasePrice)})
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {createType === 'CLOTHING' && (
                <>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/50">
                    Select Clothing
                  </label>
                  {listableClothing.length === 0 ? (
                    <p className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/40">
                      You have no clothing to list.
                    </p>
                  ) : (
                    <select
                      className="mb-4 w-full rounded-xl border border-white/15 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none"
                      value={createAssetId ?? ''}
                      onChange={(e) => setCreateAssetId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Select clothing —</option>
                      {listableClothing.map((item) => {
                        const meta = item.metadata as Record<string, string>;
                        const rarity = RARITY_LABEL[meta.rarity] || meta.rarity;
                        return (
                          <option key={item.id} value={item.id}>
                            {meta.name || 'Clothing'} [{rarity}] — market {fmt(Number(meta.marketValue || 0))}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </>
              )}

              {createType === 'XENON_VEHICLE' && (
                <>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/50">
                    Select Xenon
                  </label>
                  {listableXenon.length === 0 ? (
                    <p className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/40">
                      You have no Xenon item in inventory.
                    </p>
                  ) : (
                    <select
                      className="mb-4 w-full rounded-xl border border-white/15 bg-[#1a1a2e] px-3 py-2 text-sm text-white focus:outline-none"
                      value={createAssetId ?? ''}
                      onChange={(e) => setCreateAssetId(e.target.value ? Number(e.target.value) : null)}
                    >
                      <option value="">— Select xenon —</option>
                      {listableXenon.map((item) => (
                        <option key={item.id} value={item.id}>
                          Xenon Vehicle #{item.id}
                        </option>
                      ))}
                    </select>
                  )}
                </>
              )}

              {createAssetId !== null && (
                <div className="mb-4 rounded-xl border border-white/10 bg-white/5 p-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/50">Selected Asset Pricing</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-2">
                      <p className="text-white/45">Market Price</p>
                      <p className="text-sm font-black text-white">{fmt(selectedMarketPrice)}</p>
                    </div>
                    <div className="rounded-lg border border-[#ffd95a]/30 bg-[#ffd95a]/10 p-2">
                      <p className="text-white/45">Ask Price</p>
                      <p className="text-sm font-black text-[#ffd95a]">
                        {createAskPrice ? fmt(Number(createAskPrice || 0)) : 'Set below'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Ask price */}
              <label className="mb-1 block text-xs font-bold uppercase tracking-widest text-white/50">
                Ask Price ($)
              </label>
              <input
                type="number"
                className="mb-5 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-[#ffd95a]/50"
                placeholder="ex: 1200000"
                value={createAskPrice}
                onChange={(e) => setCreateAskPrice(e.target.value)}
                min={1}
              />

              <button
                type="button"
                onClick={handleCreateListing}
                disabled={busy}
                className="btn-primary w-full rounded-xl py-3 font-black uppercase tracking-wider disabled:opacity-50"
              >
                📢 Publish on CNN
              </button>
            </div>
          </div>
        )}

        <SharedStatsPanel />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ListingCard({
  listing,
  onBuy,
  onOffer,
  busy,
}: {
  listing: MarketListing;
  onBuy: () => void;
  onOffer: () => void;
  busy: boolean;
}) {
  const meta = listing.assetMetadata as Record<string, unknown>;
  const rarity = meta.rarity as string | undefined;
  const rarityClass = rarity ? RARITY_COLOR[rarity] || 'text-white/70 border-white/20' : 'text-white/70 border-white/20';
  const marketPrice = getMarketPrice(meta, listing.askPrice);

  return (
    <div className="hud-panel flex flex-col rounded-2xl p-3">
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img
          src={getAssetImage(listing)}
          alt={listing.assetName}
          className="h-40 w-full object-cover"
        />
      </div>
      {/* Seller info */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-2xl">{listing.sellerEmoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-white/70">{listing.sellerName}</p>
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              listing.sellerType === 'NPC'
                ? 'bg-purple-900/60 text-purple-300'
                : 'bg-blue-900/60 text-blue-300'
            }`}
          >
            {listing.sellerType === 'NPC' ? '🤖 NPC' : '👤 Player'}
          </span>
        </div>
        <span className="text-xl">{ASSET_EMOJI[listing.assetType]}</span>
      </div>

      {/* Asset info */}
      <div className="mb-3 flex-1">
        <p className="text-xs font-black uppercase tracking-wide text-white/55">{String(meta.brand || listing.assetType)}</p>
        <p className="line-clamp-2 text-lg font-black text-white">{listing.assetName}</p>
        {rarity && (
          <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-bold ${rarityClass}`}>
            {RARITY_LABEL[rarity] || rarity}
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-3 grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2">
          <p className="text-white/45">Market Price</p>
          <p className="text-sm font-black text-white">{fmt(marketPrice)}</p>
        </div>
        <div className="rounded-xl border border-[#ffd95a]/20 bg-[#ffd95a]/5 p-2">
          <p className="text-white/45">Ask Price</p>
          <p className="text-sm font-black text-[#ffd95a]">{fmt(listing.askPrice)}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onBuy}
          disabled={busy}
          className="btn-primary flex-1 rounded-xl py-2 text-sm font-bold disabled:opacity-50"
        >
          💳 Buy
        </button>
        <button
          type="button"
          onClick={onOffer}
          disabled={busy}
          className="flex-1 rounded-xl border border-[#ffd95a]/30 py-2 text-sm font-bold text-[#ffd95a] hover:bg-[#ffd95a]/10 disabled:opacity-50"
        >
          💬 Offer
        </button>
      </div>
    </div>
  );
}

function OwnedListingCard({
  listing,
  pendingOffers,
  busy,
  onCancel,
}: {
  listing: SellerListing;
  pendingOffers: number;
  busy: boolean;
  onCancel: () => void;
}) {
  const meta = listing.assetMetadata as Record<string, unknown>;
  const marketPrice = getMarketPrice(meta, listing.askPrice);
  const view = {
    assetType: listing.assetType,
    assetName: listing.assetName,
    assetMetadata: listing.assetMetadata,
  };

  return (
    <div className="hud-panel flex flex-col rounded-2xl p-3">
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img src={getAssetImage(view)} alt={listing.assetName} className="h-40 w-full object-cover" />
      </div>
      <p className="text-xs font-black uppercase tracking-wide text-white/55">{String(meta.brand || listing.assetType)}</p>
      <p className="line-clamp-2 text-lg font-black text-white">{listing.assetName}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
          <p className="text-white/45">Market Price</p>
          <p className="text-sm font-black text-white">{fmt(marketPrice)}</p>
        </div>
        <div className="rounded-xl border border-[#ffd95a]/20 bg-[#ffd95a]/5 p-2 text-center">
          <p className="text-white/45">Ask Price</p>
          <p className="text-sm font-black text-[#ffd95a]">{fmt(listing.askPrice)}</p>
        </div>
      </div>
      {pendingOffers > 0 && (
        <p className="mt-2 text-xs font-black text-orange-400">{pendingOffers} pending offer(s)</p>
      )}
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="mt-3 rounded-xl border border-red-700/40 py-2 text-sm font-bold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
      >
        Cancel Listing
      </button>
    </div>
  );
}

function MyOfferCard({
  offer,
  busy,
  onCancel,
}: {
  offer: MarketOffer;
  busy: boolean;
  onCancel: () => void;
}) {
  const meta = (offer.assetMetadata ?? {}) as Record<string, unknown>;
  const marketPrice = getMarketPrice(meta, offer.askPrice);
  const view = {
    assetType: offer.assetType,
    assetName: offer.assetName,
    assetMetadata: meta,
  };

  return (
    <div className="hud-panel flex flex-col rounded-2xl p-3">
      <div className="mb-3 overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img src={getAssetImage(view)} alt={offer.assetName} className="h-40 w-full object-cover" />
      </div>
      <p className="text-xs font-black uppercase tracking-wide text-white/55">{String(meta.brand || offer.assetType)}</p>
      <p className="line-clamp-2 text-lg font-black text-white">{offer.assetName}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center">
          <p className="text-white/45">Market Price</p>
          <p className="text-sm font-black text-white">{fmt(marketPrice)}</p>
        </div>
        <div className="rounded-xl border border-[#ffd95a]/20 bg-[#ffd95a]/5 p-2 text-center">
          <p className="text-white/45">Ask Price</p>
          <p className="text-sm font-black text-[#ffd95a]">{fmt(offer.askPrice)}</p>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <p className="text-sm font-black text-white">Your Offer: {fmt(offer.offeredPrice)}</p>
        <OfferStatusBadge status={offer.status} />
      </div>
      {offer.status === 'PENDING' && (
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="mt-3 rounded-xl border border-red-700/40 py-2 text-sm font-bold text-red-300 hover:bg-red-900/30 disabled:opacity-50"
        >
          Cancel Offer
        </button>
      )}
    </div>
  );
}

function OfferStatusBadge({ status }: { status: string }) {
  const config = {
    PENDING: { label: 'Pending', class: 'bg-yellow-900/60 text-yellow-300' },
    ACCEPTED: { label: 'Accepted ✅', class: 'bg-green-900/60 text-green-300' },
    REJECTED: { label: 'Rejected ✗', class: 'bg-red-900/60 text-red-300' },
  }[status] ?? { label: status, class: 'bg-white/10 text-white/60' };

  return (
    <span className={`mt-0.5 inline-block rounded px-2 py-0.5 text-[10px] font-bold ${config.class}`}>
      {config.label}
    </span>
  );
}
