import { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { getClothingImagePath, getVehicleImagePath } from '../lib/assets';
import type { OwnedVehicle, OwnedClothingMetadata } from '../types/game';

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

const RARITY_COLORS: Record<string, string> = {
  BLUE: 'text-blue-400 border-blue-400/40 bg-blue-900/20',
  LIGHT_PURPLE: 'text-purple-400 border-purple-400/40 bg-purple-900/20',
  DARK_PURPLE: 'text-violet-400 border-violet-600/40 bg-violet-900/20',
  RED: 'text-red-400 border-red-400/40 bg-red-900/20',
  YELLOW: 'text-yellow-400 border-yellow-400/40 bg-yellow-900/20',
};

const RARITY_LABEL: Record<string, string> = {
  BLUE: 'Blue',
  LIGHT_PURPLE: 'Light Purple',
  DARK_PURPLE: 'Dark Purple',
  RED: 'Red',
  YELLOW: 'Yellow',
};

function fmt(n: number) {
  return n.toLocaleString('en-US') + ' $';
}

function fmtDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

type Tab = 'vehicles' | 'clothes';

export default function OwnedAssetsPage() {
  const { player } = usePlayer();
  const [tab, setTab] = useState<Tab>('vehicles');

  const vehicles = player?.ownedVehicles ?? [];
  const clothingItems = (player?.inventory ?? []).filter((i) => i.itemType === 'CLOTHING');

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'vehicles', label: '🚗 Owned Vehicles', count: vehicles.length },
    { id: 'clothes', label: '👕 Owned Clothing', count: clothingItems.length },
  ];

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">CityFlow No-RP</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">📁 Owned Assets</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                tab === t.id
                  ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]'
                  : 'text-white/60 hover:bg-white/5'
              }`}
            >
              {t.label}
              <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-[10px]">{t.count}</span>
            </button>
          ))}
        </div>

        {!player && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm font-bold uppercase tracking-widest text-white/50">Loading...</p>
          </div>
        )}

        {/* Vehicles Tab */}
        {tab === 'vehicles' && player && (
          <>
            {vehicles.length === 0 ? (
              <EmptyState icon="🚗" title="No owned vehicles" sub="Buy vehicles from Showroom or win them in Roulette." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {vehicles.map((v) => (
                  <VehicleCard key={v.id} vehicle={v} />
                ))}
              </div>
            )}
          </>
        )}

        {/* Clothes Tab */}
        {tab === 'clothes' && player && (
          <>
            {clothingItems.length === 0 ? (
              <EmptyState icon="👕" title="No owned clothing" sub="Open Mystery Boxes from Inventory to get clothing." />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {clothingItems.map((item) => {
                  const meta = item.metadata as Partial<OwnedClothingMetadata>;
                  return <ClothingCard key={item.id} meta={meta} quantity={item.quantity} />;
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function VehicleCard({ vehicle }: { vehicle: OwnedVehicle }) {
  return (
    <div className="hud-card flex flex-col gap-3 p-4">
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img
          src={getVehicleImagePath(vehicle.modelName)}
          alt={vehicle.modelName}
          className="h-28 w-full object-contain"
        />
      </div>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{BRAND_EMOJI[vehicle.brand] ?? '🚗'}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-white/45">
            {BRAND_LABEL[vehicle.brand] ?? vehicle.brand}
          </p>
          <p className="font-black leading-tight text-white">{vehicle.modelName}</p>
        </div>
      </div>
      <div className="space-y-1.5 border-t border-white/8 pt-2">
        <Row label="Paid price" value={fmt(vehicle.purchasePrice)} />
        <Row label="Purchased" value={fmtDate(vehicle.purchasedAt)} />
      </div>
    </div>
  );
}

function ClothingCard({ meta, quantity }: { meta: Partial<OwnedClothingMetadata>; quantity: number }) {
  const rarity = meta.rarity ?? 'BLUE';
  const colorCls = RARITY_COLORS[rarity] ?? '';
  return (
    <div className={`hud-card flex flex-col gap-2 border p-4 ${colorCls}`}>
      <div className="overflow-hidden rounded-xl border border-white/10 bg-black/20 p-2">
        <img
          src={getClothingImagePath(meta.name ?? '')}
          alt={meta.name ?? 'Clothing'}
          className="h-28 w-full object-contain"
        />
      </div>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">👕</span>
        <div className="min-w-0 flex-1">
          <p className="font-black text-white">{meta.name ?? 'Clothing'}</p>
          <p className="mt-0.5 text-[11px] text-white/50">{meta.category ?? ''}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${colorCls}`}>
            {RARITY_LABEL[rarity] ?? rarity}
          </span>
          {quantity > 1 && (
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">x{quantity}</span>
          )}
        </div>
      </div>
      {meta.marketValue != null && (
        <p className="border-t border-white/8 pt-2 text-xs font-bold text-[#ffd95a]">
          Market value: {meta.marketValue.toLocaleString('en-US')} $
        </p>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="hud-panel px-6 py-12 text-center">
      <p className="text-4xl">{icon}</p>
      <p className="mt-3 text-lg font-black text-white/70">{title}</p>
      <p className="mt-1 text-sm text-white/40">{sub}</p>
    </div>
  );
}
