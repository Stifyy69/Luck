import { useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { api } from '../lib/api';
import type { InventoryItem, OwnedClothingMetadata } from '../types/game';

const ITEM_EMOJI: Record<string, string> = {
  MYSTERY_BOX: '📦',
  ROULETTE_FRAGMENTS: '🪙',
  SLOT_VEHICLE: '➕',
  VOUCHER_SHOWROOM: '🎟️',
  JOB_BOOST_PILOT: '✈️',
  JOB_BOOST_SLEEP: '😴',
  TAX_EXEMPTION: '💸',
  XENON_VEHICLE: '🔩',
  CLOTHING: '👕',
  VIP_GOLD: '💎',
  VIP_SILVER: '💠',
};

const ITEM_LABEL: Record<string, string> = {
  MYSTERY_BOX: 'Mystery Box',
  ROULETTE_FRAGMENTS: 'Fragmente Ruletă',
  SLOT_VEHICLE: 'Slot Vehicul',
  VOUCHER_SHOWROOM: 'Voucher Showroom',
  JOB_BOOST_PILOT: 'Boost Pilot x2',
  JOB_BOOST_SLEEP: 'Boost Sleep x2',
  TAX_EXEMPTION: 'Scutire Taxe',
  XENON_VEHICLE: 'Xenon Vehicul',
  CLOTHING: 'Haină',
  VIP_GOLD: 'VIP Gold',
  VIP_SILVER: 'VIP Silver',
};

const ITEM_DESC: Record<string, string> = {
  MYSTERY_BOX: 'Deschide pentru o haină aleatorie',
  ROULETTE_FRAGMENTS: '4 fragmente = 1 spin bonus',
  SLOT_VEHICLE: 'Adaugă +1 slot vehicul permanent',
  VOUCHER_SHOWROOM: 'Reducere la cumpărare din showroom',
  JOB_BOOST_PILOT: 'x2 câștig la job Pilot (o singură folosire)',
  JOB_BOOST_SLEEP: 'x2 câștig la job Sleep (o singură folosire)',
  TAX_EXEMPTION: 'Anulează următoarea colectare de taxe',
  XENON_VEHICLE: 'Pachet xenon pentru vehicul',
  CLOTHING: 'Haină câștigată din Mystery Box',
  VIP_GOLD: 'VIP Gold – x2 bani 10 minute',
  VIP_SILVER: 'VIP Silver – x2 bani 5 minute',
};

// Items that can be used via /api/inventory/use
const USABLE_ITEMS = new Set([
  'SLOT_VEHICLE',
  'TAX_EXEMPTION',
  'JOB_BOOST_PILOT',
  'JOB_BOOST_SLEEP',
  'VIP_GOLD',
  'VIP_SILVER',
]);

// Items used via /api/mystery/open
const MYSTERY_ITEMS = new Set(['MYSTERY_BOX']);

const RARITY_COLORS: Record<string, string> = {
  BLUE: 'text-blue-400 border-blue-400/40 bg-blue-900/20',
  LIGHT_PURPLE: 'text-purple-400 border-purple-400/40 bg-purple-900/20',
  DARK_PURPLE: 'text-violet-400 border-violet-600/40 bg-violet-900/20',
  RED: 'text-red-400 border-red-400/40 bg-red-900/20',
  YELLOW: 'text-yellow-400 border-yellow-400/40 bg-yellow-900/20',
};

const RARITY_LABEL: Record<string, string> = {
  BLUE: 'Albastru',
  LIGHT_PURPLE: 'Mov Deschis',
  DARK_PURPLE: 'Mov Închis',
  RED: 'Roșu',
  YELLOW: 'Galben',
};

function fmt(n: number) {
  return n.toLocaleString('ro-RO') + ' $';
}

export default function InventoryPage() {
  const { player, playerId, refresh } = usePlayer();
  const [busy, setBusy] = useState<number | null>(null);
  const [popup, setPopup] = useState<{ message: string; isError: boolean } | null>(null);
  const [mysteryResult, setMysteryResult] = useState<{
    name: string;
    category: string;
    rarity: string;
    marketValue: number;
  } | null>(null);

  function showPopup(message: string, isError = false) {
    setPopup({ message, isError });
    window.setTimeout(() => setPopup(null), 3200);
  }

  async function handleUse(item: InventoryItem) {
    if (busy !== null) return;
    setBusy(item.id);
    try {
      if (MYSTERY_ITEMS.has(item.itemType)) {
        const result = await api.mysteryOpen(playerId);
        refresh();
        setMysteryResult(result.clothing);
        showPopup(`📦 Ai deschis: ${result.clothing.name}`);
      } else if (USABLE_ITEMS.has(item.itemType)) {
        const result = await api.inventoryUse(playerId, item.id);
        refresh();
        const effectMsg: Record<string, string> = {
          vehicle_slot_added: '✅ Slot vehicul adăugat!',
          tax_exemption_activated: '✅ Scutire taxe activată!',
          pilot_boost_activated: '✅ Boost Pilot activat!',
          sleep_boost_activated: '✅ Boost Sleep activat!',
          vip_gold_activated: '✅ VIP Gold activat!',
          vip_silver_activated: '✅ VIP Silver activat!',
        };
        showPopup(effectMsg[result.effect] ?? `✅ ${result.effect}`);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Eroare la folosire';
      showPopup(`❌ ${msg}`, true);
    } finally {
      setBusy(null);
    }
  }

  const inventory = player?.inventory ?? [];
  const isEmpty = inventory.length === 0;

  // Separate clothing from usable items for display
  const clothingItems = inventory.filter((i) => i.itemType === 'CLOTHING');
  const otherItems = inventory.filter((i) => i.itemType !== 'CLOTHING');

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      {/* Toast */}
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

      <div className="mx-auto max-w-[1100px]">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">CityFlow No-RP</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">🎒 Inventar</h1>
        </div>

        {!player && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm font-bold uppercase tracking-widest text-white/50">Se încarcă...</p>
          </div>
        )}

        {player && isEmpty && (
          <div className="hud-panel px-6 py-12 text-center">
            <p className="text-4xl">📭</p>
            <p className="mt-3 text-lg font-black text-white/70">Inventarul este gol</p>
            <p className="mt-1 text-sm text-white/40">Câștigă iteme prin Ruletă sau CNN Marketplace.</p>
          </div>
        )}

        {player && !isEmpty && (
          <div className="space-y-8">
            {/* Usable / displayable items */}
            {otherItems.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-white/60">Iteme</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {otherItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onUse={handleUse}
                      busy={busy === item.id}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Clothing items */}
            {clothingItems.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-white/60">Haine deținute</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {clothingItems.map((item) => (
                    <ClothingCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Mystery result modal */}
      {mysteryResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="hud-panel w-full max-w-sm p-6 text-center">
            <p className="text-4xl">📦</p>
            <p className="mt-3 text-xs uppercase tracking-widest text-white/45">Ai obținut</p>
            <h3 className="mt-2 text-2xl font-black text-white">{mysteryResult.name}</h3>
            <div className={`mx-auto mt-3 inline-block rounded-full border px-3 py-1 text-xs font-bold ${RARITY_COLORS[mysteryResult.rarity] ?? ''}`}>
              {RARITY_LABEL[mysteryResult.rarity] ?? mysteryResult.rarity}
            </div>
            <p className="mt-2 text-sm text-white/55">Categorie: {mysteryResult.category}</p>
            <p className="mt-1 text-sm font-bold text-[#ffd95a]">Valoare piață: {fmt(mysteryResult.marketValue)}</p>
            <button
              type="button"
              onClick={() => setMysteryResult(null)}
              className="btn-ghost mt-5 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition hover:brightness-110"
            >
              Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemCard({
  item,
  onUse,
  busy,
}: {
  item: InventoryItem;
  onUse: (item: InventoryItem) => void;
  busy: boolean;
}) {
  const canUse = USABLE_ITEMS.has(item.itemType) || MYSTERY_ITEMS.has(item.itemType);
  const isReadOnly = !canUse;
  const emoji = ITEM_EMOJI[item.itemType] ?? '📦';
  const label = ITEM_LABEL[item.itemType] ?? item.itemType;
  const desc = ITEM_DESC[item.itemType] ?? '';

  return (
    <div className="hud-card flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-3xl leading-none">{emoji}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{label}</p>
          <p className="mt-0.5 text-[11px] leading-snug text-white/50">{desc}</p>
        </div>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/70">
          x{item.quantity}
        </span>
      </div>

      {item.itemType === 'VOUCHER_SHOWROOM' && item.metadata?.discount && (
        <p className="text-xs font-bold text-amber-300">🎟️ Reducere: {String(item.metadata.discount)}%</p>
      )}

      {item.itemType === 'ROULETTE_FRAGMENTS' && (
        <p className="text-xs text-white/40">{item.quantity % 4}/4 pentru un spin bonus</p>
      )}

      <div className="mt-auto">
        {canUse ? (
          <button
            type="button"
            onClick={() => onUse(item)}
            disabled={busy || item.quantity < 1}
            className="btn-primary w-full rounded-xl px-4 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? 'Se procesează...' : 'Folosește'}
          </button>
        ) : (
          <p className="text-center text-[11px] italic text-white/30">{isReadOnly ? 'Afișare' : ''}</p>
        )}
      </div>
    </div>
  );
}

function ClothingCard({ item }: { item: InventoryItem }) {
  const meta = item.metadata as Partial<OwnedClothingMetadata>;
  const rarity = meta.rarity ?? 'BLUE';
  const colorCls = RARITY_COLORS[rarity] ?? '';

  return (
    <div className={`hud-card flex flex-col gap-2 border p-4 ${colorCls}`}>
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">👕</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-black text-white">{meta.name ?? 'Haină'}</p>
          <p className="mt-0.5 text-[11px] text-white/50">{meta.category ?? ''}</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${colorCls}`}>
          {RARITY_LABEL[rarity] ?? rarity}
        </span>
      </div>
      {meta.marketValue != null && (
        <p className="text-xs font-bold text-[#ffd95a]">Valoare: {(meta.marketValue).toLocaleString('ro-RO')} $</p>
      )}
    </div>
  );
}
