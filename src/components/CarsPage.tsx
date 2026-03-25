import { useEffect, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';
import { api } from '../lib/api';
import type { VehicleModelData, OwnedVehicle, PlayerState } from '../types/game';

const PLAYER_KEY = 'luck_player_id_v1';

function getPlayerId() {
  let id = localStorage.getItem(PLAYER_KEY);
  if (id) return id;
  id = `player_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(PLAYER_KEY, id);
  return id;
}

const BRAND_ORDER = ['DRAVIA', 'BERVIK', 'AURON', 'FERANO'];

const BRAND_LABELS: Record<string, string> = {
  DRAVIA: 'Dravia',
  BERVIK: 'Bervik',
  AURON: 'Auron',
  FERANO: 'Ferano',
};

const BRAND_EMOJIS: Record<string, string> = {
  DRAVIA: '🚙',
  BERVIK: '🏁',
  AURON: '⚡',
  FERANO: '🔥',
};

export default function CarsPage() {
  const [playerId] = useState(getPlayerId);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [brands, setBrands] = useState<Record<string, VehicleModelData[]>>({});
  const [ownedVehicles, setOwnedVehicles] = useState<OwnedVehicle[]>([]);
  const [popup, setPopup] = useState<{ message: string; isError: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<string>(BRAND_ORDER[0]);
  const [useVoucher, setUseVoucher] = useState(false);

  const showPopup = (message: string, isError = false) => {
    setPopup({ message, isError });
    window.setTimeout(() => setPopup(null), 2800);
  };

  useEffect(() => {
    Promise.all([
      api.bootstrap(playerId),
      api.showroom(),
    ]).then(([playerData, showroomData]) => {
      setPlayer(playerData);
      setOwnedVehicles(playerData.ownedVehicles);
      setBrands(showroomData.brands);
    }).catch((err) => {
      console.error('Failed to load showroom', err);
      showPopup('Nu s-a putut încărca showroom-ul.', true);
    }).finally(() => setLoading(false));
  }, [playerId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleBuy = async (model: VehicleModelData) => {
    if (!player) return;
    if (buying !== null) return;

    const totalSlots = player.vehicleSlotsBase + player.vehicleSlotsExtra;
    if (ownedVehicles.length >= totalSlots) {
      showPopup(`Sloturi pline! Ai ${ownedVehicles.length}/${totalSlots} sloturi ocupate.`, true);
      return;
    }

    setBuying(model.id);
    try {
      // Check if player has a voucher
      const hasVoucher = player.inventory.some((i) => i.itemType === 'VOUCHER_SHOWROOM');
      const result = await api.showroomBuy(playerId, model.id, useVoucher && hasVoucher);

      setOwnedVehicles((prev) => [...prev, result.vehicle]);
      setPlayer((prev) =>
        prev
          ? {
              ...prev,
              cleanMoney: result.newBalance,
              usedSlots: prev.usedSlots + 1,
              inventory: useVoucher && hasVoucher
                ? prev.inventory.filter((i) => {
                    if (i.itemType === 'VOUCHER_SHOWROOM') {
                      return false; // remove one voucher
                    }
                    return true;
                  })
                : prev.inventory,
            }
          : prev,
      );

      // Update showroom stock
      setBrands((prev) => {
        const updated = { ...prev };
        for (const brand of Object.keys(updated)) {
          updated[brand] = updated[brand].map((m) =>
            m.id === model.id ? { ...m, stock: result.stockRemaining } : m,
          );
        }
        return updated;
      });

      const discountMsg = result.discountPct > 0 ? ` (discount ${result.discountPct}%)` : '';
      showPopup(`Ai cumpărat ${model.name}!${discountMsg}`);
      setUseVoucher(false);
    } catch (err: any) {
      const msg = err?.message ?? 'Eroare la cumpărare.';
      if (msg.includes('slots full')) showPopup('Sloturi pline! Folosește Slot Vehicle pentru mai mult spațiu.', true);
      else if (msg.includes('Insufficient')) showPopup('Nu ai suficienți bani curați.', true);
      else if (msg.includes('Out of stock')) showPopup('Stoc epuizat pentru acest model.', true);
      else showPopup(msg, true);
    } finally {
      setBuying(null);
    }
  };

  const voucherItem = player?.inventory.find((i) => i.itemType === 'VOUCHER_SHOWROOM');
  const voucherDiscount = voucherItem?.metadata?.discount as number | undefined;

  return (
    <div className="min-h-screen bg-transparent px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hud-panel p-4 backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">🚘 Showroom</h1>

          {/* Player info bar */}
          {player ? (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 px-4 py-2 text-sm">
              <span className="text-white/70">
                Bani curați: <span className="font-black text-emerald-300">{player.cleanMoney.toLocaleString('ro-RO')} $</span>
              </span>
              <span className="text-white/70">
                Sloturi: <span className="font-black text-amber-300">{ownedVehicles.length}/{player.vehicleSlotsBase + player.vehicleSlotsExtra}</span>
              </span>
              {voucherItem ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-white/70">
                  <input
                    type="checkbox"
                    checked={useVoucher}
                    onChange={(e) => setUseVoucher(e.target.checked)}
                    className="accent-amber-400"
                  />
                  <span>
                    Folosește voucher{voucherDiscount ? ` (${voucherDiscount}% reducere)` : ''}
                  </span>
                </label>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <p className="mt-6 text-center text-white/50">Se încarcă showroom-ul...</p>
          ) : (
            <>
              {/* Brand tabs */}
              <div className="mt-4 flex flex-wrap gap-2">
                {BRAND_ORDER.filter((b) => brands[b]).map((brand) => (
                  <button
                    key={brand}
                    type="button"
                    onClick={() => setActiveTab(brand)}
                    className={`rounded-xl px-4 py-2 text-sm font-bold uppercase tracking-wider transition ${activeTab === brand ? 'bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/50' : 'text-white/60 hover:bg-white/5'}`}
                  >
                    {BRAND_EMOJIS[brand]} {BRAND_LABELS[brand]}
                  </button>
                ))}
              </div>

              {/* Cars grid for active tab */}
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {(brands[activeTab] ?? []).map((model) => {
                  let finalPrice = model.basePrice;
                  if (useVoucher && voucherDiscount) {
                    finalPrice = Math.floor(finalPrice * (1 - voucherDiscount / 100));
                  }
                  const canBuy =
                    player !== null &&
                    player.cleanMoney >= finalPrice &&
                    model.stock > 0 &&
                    ownedVehicles.length < (player.vehicleSlotsBase + player.vehicleSlotsExtra);

                  return (
                    <div key={model.id} className="rounded-xl border border-white/15 bg-black/25 p-3">
                      <div className="flex h-14 items-center justify-center rounded-lg bg-black/35 text-4xl">
                        {BRAND_EMOJIS[model.brand]}
                      </div>
                      <p className="mt-2 text-lg font-black">{model.name}</p>
                      <p className="text-sm text-white/70">
                        {useVoucher && voucherDiscount ? (
                          <>
                            <span className="line-through text-white/40">{model.basePrice.toLocaleString('ro-RO')}</span>
                            {' '}
                            <span className="text-amber-300 font-bold">{finalPrice.toLocaleString('ro-RO')} $</span>
                          </>
                        ) : (
                          <>{model.basePrice.toLocaleString('ro-RO')} $</>
                        )}
                      </p>
                      <p className={`mt-1 text-xs ${model.stock > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        Stoc: {model.stock}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleBuy(model)}
                        disabled={!canBuy || buying === model.id}
                        className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-black transition ${canBuy && buying !== model.id ? 'bg-emerald-500/80 text-white hover:bg-emerald-400/80' : 'bg-[#2a2744] text-white/50'}`}
                      >
                        {buying === model.id ? 'Se procesează...' : 'Cumpără'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Owned vehicles */}
          {ownedVehicles.length > 0 ? (
            <div className="mt-6 rounded-xl border border-white/15 bg-black/25 p-4">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Mașinile tale</p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {ownedVehicles.map((v) => (
                  <div key={v.id} className="rounded-lg border border-white/10 bg-black/30 p-2 text-center">
                    <div className="flex h-10 items-center justify-center text-2xl">
                      {BRAND_EMOJIS[v.brand] ?? '🚗'}
                    </div>
                    <p className="mt-1 text-xs font-bold">{v.modelName}</p>
                    <p className="text-[10px] text-white/50">{v.purchasePrice.toLocaleString('ro-RO')} $</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={() => setPopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-2xl border px-5 py-5 text-center text-base font-semibold shadow-xl ${
              popup.isError
                ? 'border-red-300/40 bg-red-500/20 text-red-100'
                : 'border-emerald-300/40 bg-emerald-500/20 text-emerald-100'
            }`}
          >
            {popup.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
