import { useEffect, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { useShowroom } from '../hooks/useShowroom';
import { getVehicleImagePath } from '../lib/assets';
import type { VehicleModelData } from '../types/game';

const BRAND_EMOJI: Record<string, string> = {
  DRAVIA: '🚙',
  BERVIK: '🚗',
  AURON: '🏎️',
  FERANO: '🚕',
  VORTEK: '🏁',
};

const BRAND_LABEL: Record<string, string> = {
  DRAVIA: 'Dravia',
  BERVIK: 'Bervik',
  AURON: 'Auron',
  FERANO: 'Ferano',
  VORTEK: 'Vortek',
};

function fmt(n: number) {
  return n.toLocaleString('en-US') + ' $';
}

interface BuyModal {
  model: VehicleModelData;
  useVoucher: boolean;
}

export default function ShowroomPage() {
  const { player, playerId, loading: playerLoading, refresh } = usePlayer();
  const { showroom, loading: showroomLoading, error: showroomError, load, buy } = useShowroom();

  const [buyModal, setBuyModal] = useState<BuyModal | null>(null);
  const [busy, setBusy] = useState(false);
  const [popup, setPopup] = useState<{ message: string; isError: boolean } | null>(null);

  useEffect(() => {
    load();
  }, [load]);

  function showPopup(message: string, isError = false) {
    setPopup({ message, isError });
    window.setTimeout(() => setPopup(null), 3000);
  }

  const voucherCount =
    player?.inventory.filter((i) => i.itemType === 'VOUCHER_SHOWROOM').reduce((s, i) => s + i.quantity, 0) ?? 0;

  const slotsAvailable = player ? player.totalSlots - player.usedSlots : 0;
  const slotsFull = player ? player.usedSlots >= player.totalSlots : false;

  async function handleBuy() {
    if (!buyModal) return;
    setBusy(true);
    try {
      const result = await buy(playerId, buyModal.model.id, buyModal.useVoucher);
      setBuyModal(null);
      refresh();
      load();
      const discountMsg = result.discountPct ? ` (discount ${result.discountPct}%)` : '';
      showPopup(`Purchased ${buyModal.model.name}${discountMsg}.`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Purchase failed';
      showPopup(msg, true);
    } finally {
      setBusy(false);
    }
  }

  const loading = playerLoading || showroomLoading;

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      {/* Popup toast */}
      {popup && (
        <div
          className={`fixed right-4 top-4 z-[80] max-w-sm rounded-xl border px-4 py-3 text-sm font-bold shadow-xl backdrop-blur-md ${
            popup.isError
              ? 'border-red-400/40 bg-red-900/80 text-red-200'
              : 'border-green-400/40 bg-green-900/80 text-green-200'
          }`}
        >
          {popup.message}
        </div>
      )}

      <div className="mx-auto max-w-[1180px]">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">CityFlow No-RP</p>
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">🚗 Showroom</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            {player && (
              <>
                <div className="hud-card px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Money</p>
                  <p className="text-sm font-black text-[#ffd95a]">{fmt(player.cleanMoney)}</p>
                </div>
                <div className="hud-card px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Free slots</p>
                  <p className={`text-sm font-black ${slotsFull ? 'text-red-400' : 'text-[#45d483]'}`}>
                    {player.usedSlots}/{player.totalSlots}
                  </p>
                </div>
                <div className="hud-card px-3 py-2 text-center">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">Vouchers</p>
                  <p className={`text-sm font-black ${voucherCount > 0 ? 'text-amber-300' : 'text-white/40'}`}>
                    🎟️ {voucherCount}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {slotsFull && (
          <div className="mb-4 rounded-xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm font-bold text-red-300">
            ⚠️ All vehicle slots are full. Use a <strong>Slot Vehicle</strong> item from inventory to add more space.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm font-bold uppercase tracking-widest text-white/50">Loading...</p>
          </div>
        )}

        {showroomError && (
          <div className="rounded-xl border border-red-400/40 bg-red-900/30 px-4 py-3 text-sm text-red-300">
            ❌ {showroomError}
          </div>
        )}

        {!loading && showroom && (
          <div className="space-y-8">
            {Object.entries(showroom.brands).map(([brand, models]) => (
              <section key={brand}>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-black uppercase tracking-wide text-white/80">
                  <span>{BRAND_EMOJI[brand] ?? '🚗'}</span>
                  <span>{BRAND_LABEL[brand] ?? brand}</span>
                </h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {models.map((model) => (
                    <VehicleCard
                      key={model.id}
                      model={model}
                      voucherCount={voucherCount}
                      slotsFull={slotsFull}
                      slotsAvailable={slotsAvailable}
                      onBuy={(useVoucher) => setBuyModal({ model, useVoucher })}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* Buy confirmation modal */}
      {buyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-6">
            <h3 className="mb-1 text-xl font-black text-white">{buyModal.model.name}</h3>
            <p className="mb-4 text-sm text-white/60">{BRAND_LABEL[buyModal.model.brand] ?? buyModal.model.brand}</p>

            <div className="mb-4 space-y-2">
              <InfoRow label="Base price" value={fmt(buyModal.model.basePrice)} />
              {buyModal.useVoucher && voucherCount > 0 && (
                <InfoRow label="With voucher" value="discount applied 🎟️" className="text-amber-300" />
              )}
              <InfoRow label="Stock left" value={String(buyModal.model.stock)} />
            </div>

            {voucherCount > 0 && (
              <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-900/20 px-3 py-2">
                <input
                  type="checkbox"
                  checked={buyModal.useVoucher}
                  onChange={(e) => setBuyModal((m) => m && { ...m, useVoucher: e.target.checked })}
                  className="h-4 w-4 accent-amber-400"
                />
                <span className="text-sm font-bold text-amber-300">
                  Use voucher ({voucherCount} available)
                </span>
              </label>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setBuyModal(null)}
                className="btn-ghost flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition hover:brightness-110"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBuy}
                disabled={busy || slotsFull}
                className="btn-primary flex-1 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy ? 'Processing...' : 'Buy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VehicleCard({
  model,
  voucherCount,
  slotsFull,
  slotsAvailable,
  onBuy,
}: {
  model: VehicleModelData;
  voucherCount: number;
  slotsFull: boolean;
  slotsAvailable: number;
  onBuy: (useVoucher: boolean) => void;
}) {
  const outOfStock = model.stock <= 0;
  const canBuy = !outOfStock && !slotsFull;

  return (
    <div className="hud-card flex flex-col gap-3 p-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img
          src={getVehicleImagePath(model.name)}
          alt={model.name}
          className="h-28 w-full object-contain"
        />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-white/45">{BRAND_LABEL[model.brand] ?? model.brand}</p>
          <p className="text-base font-black leading-tight text-white">{model.name}</p>
        </div>
        <span className="text-2xl">{BRAND_EMOJI[model.brand] ?? '🚗'}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-black text-[#ffd95a]">{fmt(model.basePrice)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${model.stock > 0 ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
          {model.stock > 0 ? `${model.stock} in stock` : 'Sold out'}
        </span>
      </div>

      {slotsFull && !outOfStock && (
        <p className="text-[11px] text-red-400">⚠️ Slots full ({slotsAvailable} free)</p>
      )}

      <div className="mt-auto flex gap-2">
        <button
          type="button"
          onClick={() => onBuy(false)}
          disabled={!canBuy}
          className="btn-secondary flex-1 rounded-xl px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40"
        >
          Buy
        </button>
        {voucherCount > 0 && (
          <button
            type="button"
            onClick={() => onBuy(true)}
            disabled={!canBuy}
            title="Buy with voucher"
            className="rounded-xl border border-amber-400/45 bg-amber-900/20 px-3 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            🎟️
          </button>
        )}
      </div>
    </div>
  );
}

function InfoRow({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-white/55">{label}</span>
      <span className={`font-bold text-white ${className}`}>{value}</span>
    </div>
  );
}
