import { useEffect, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import type { ActiveBoost, InventoryItem } from '../types/game';

// ---------------------------------------------------------------------------
// Countdown hook – returns remaining time as a formatted string
// ---------------------------------------------------------------------------
function useCountdown(expiresAt: string | null | undefined): string {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    if (!expiresAt) {
      setRemaining('—');
      return;
    }

    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining('Expirat');
        return;
      }
      const h = Math.floor(diff / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (h > 0) setRemaining(`${h}h ${m}m ${s}s`);
      else if (m > 0) setRemaining(`${m}m ${s}s`);
      else setRemaining(`${s}s`);
    };

    tick();
    const id = window.setInterval(tick, 1_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return remaining;
}

// ---------------------------------------------------------------------------
// Boost type labels
// ---------------------------------------------------------------------------
const BOOST_EMOJI: Record<string, string> = {
  VIP_GOLD: '💎',
  VIP_SILVER: '💠',
  JOB_PILOT: '✈️',
  JOB_SLEEP: '😴',
};

const BOOST_LABEL: Record<string, string> = {
  VIP_GOLD: 'VIP Gold',
  VIP_SILVER: 'VIP Silver',
  JOB_PILOT: 'Boost Pilot x2',
  JOB_SLEEP: 'Boost Sleep x2',
};

const BOOST_DESC: Record<string, string> = {
  VIP_GOLD: 'x2 bani, 10 minute',
  VIP_SILVER: 'x2 bani, 5 minute',
  JOB_PILOT: 'x2 câștig job Pilot',
  JOB_SLEEP: 'x2 câștig job Sleep',
};

type Tab = 'slots' | 'boosts' | 'vouchers' | 'taxes';

export default function PlayerStatusPage() {
  const { player, loading, refresh } = usePlayer();
  const [tab, setTab] = useState<Tab>('slots');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'slots', label: '🔲 Sloturi' },
    { id: 'boosts', label: '⚡ Boost-uri' },
    { id: 'vouchers', label: '🎟️ Vouchere' },
    { id: 'taxes', label: '💸 Taxe' },
  ];

  // Refresh data periodically so countdowns stay in sync with server
  useEffect(() => {
    const id = window.setInterval(refresh, 30_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return (
    <div className="min-h-screen px-4 py-6 md:py-8">
      <div className="mx-auto max-w-[900px]">
        <div className="mb-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/45">CityFlow No-RP</p>
          <h1 className="text-3xl font-black uppercase tracking-tight text-white">📊 Status Jucător</h1>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap gap-2">
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
            </button>
          ))}
        </div>

        {loading && !player && (
          <div className="flex items-center justify-center py-20">
            <p className="text-sm font-bold uppercase tracking-widest text-white/50">Se încarcă...</p>
          </div>
        )}

        {player && tab === 'slots' && <SlotsTab player={player} />}
        {player && tab === 'boosts' && <BoostsTab boosts={player.activeBoosts} />}
        {player && tab === 'vouchers' && <VouchersTab inventory={player.inventory} />}
        {player && tab === 'taxes' && (
          <TaxesTab
            nextTaxAt={player.nextTaxCollectionAt}
            skipNextTax={player.skipNextTax}
            ownedVehicles={player.ownedVehicles}
          />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slots Tab
// ---------------------------------------------------------------------------
function SlotsTab({ player }: { player: import('../types/game').PlayerState }) {
  const pct = player.totalSlots > 0 ? Math.round((player.usedSlots / player.totalSlots) * 100) : 0;
  const isFull = player.usedSlots >= player.totalSlots;
  return (
    <div className="space-y-4">
      <div className="hud-panel p-5">
        <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/60">Sloturi Vehicule</h2>
        <div className="flex items-center gap-4">
          <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
            <svg className="absolute inset-0" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="17" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
              <circle
                cx="20" cy="20" r="17" fill="none"
                stroke={isFull ? '#ff5e62' : '#45d483'}
                strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 106.8} 106.8`}
                strokeLinecap="round"
                transform="rotate(-90 20 20)"
              />
            </svg>
            <span className={`text-xl font-black ${isFull ? 'text-red-400' : 'text-[#45d483]'}`}>
              {player.usedSlots}/{player.totalSlots}
            </span>
          </div>
          <div className="space-y-2">
            <StatRow label="Sloturi de bază" value={String(player.vehicleSlotsBase)} />
            <StatRow label="Sloturi extra" value={String(player.vehicleSlotsExtra)} />
            <StatRow label="Total sloturi" value={String(player.totalSlots)} />
            <StatRow label="Ocupate" value={String(player.usedSlots)} />
            <StatRow label="Libere" value={String(player.totalSlots - player.usedSlots)} />
          </div>
        </div>
        {isFull && (
          <div className="mt-4 rounded-xl border border-red-400/35 bg-red-900/25 px-4 py-3 text-sm text-red-300">
            ⚠️ Toate sloturile sunt ocupate. Folosește un item <strong>Slot Vehicul</strong> din Inventar pentru a adăuga mai multe.
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Boosts Tab
// ---------------------------------------------------------------------------
function BoostsTab({ boosts }: { boosts: ActiveBoost[] }) {
  return (
    <div className="space-y-3">
      {boosts.length === 0 ? (
        <EmptyState icon="⚡" title="Niciun boost activ" sub="Câștigă boosturi prin Ruletă sau folosește iteme din Inventar." />
      ) : (
        boosts.map((b) => <BoostCard key={b.id} boost={b} />)
      )}
    </div>
  );
}

function BoostCard({ boost }: { boost: ActiveBoost }) {
  const countdown = useCountdown(boost.expiresAt);
  const isExpired = countdown === 'Expirat';
  return (
    <div className={`hud-card flex items-center gap-4 p-4 ${isExpired ? 'opacity-50' : ''}`}>
      <span className="text-3xl leading-none">{BOOST_EMOJI[boost.boostType] ?? '⚡'}</span>
      <div className="min-w-0 flex-1">
        <p className="font-black text-white">{BOOST_LABEL[boost.boostType] ?? boost.boostType}</p>
        <p className="text-[11px] text-white/50">{BOOST_DESC[boost.boostType] ?? ''}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-black tabular-nums ${isExpired ? 'text-red-400' : 'text-[#45d483]'}`}>
          {countdown}
        </p>
        <p className="text-[10px] text-white/40">rămas</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Vouchers Tab
// ---------------------------------------------------------------------------
function VouchersTab({ inventory }: { inventory: InventoryItem[] }) {
  const vouchers = inventory.filter((i) => i.itemType === 'VOUCHER_SHOWROOM');

  return (
    <div className="space-y-3">
      {vouchers.length === 0 ? (
        <EmptyState icon="🎟️" title="Niciun voucher disponibil" sub="Câștigă vouchere prin Ruletă. Folosește-le la cumpărare din Showroom." />
      ) : (
        <>
          <div className="hud-panel px-5 py-4">
            <p className="text-sm text-white/55">
              Ai <span className="font-black text-amber-300">{vouchers.reduce((s, v) => s + v.quantity, 0)} voucher{vouchers.reduce((s, v) => s + v.quantity, 0) !== 1 ? 'e' : ''}</span> disponibil{vouchers.reduce((s, v) => s + v.quantity, 0) !== 1 ? 'e' : ''}.
              Selectează opțiunea de voucher la cumpărare din <strong className="text-white">Showroom</strong>.
            </p>
          </div>
          {vouchers.map((v) => (
            <div key={v.id} className="hud-card flex items-center gap-4 p-4">
              <span className="text-3xl leading-none">🎟️</span>
              <div className="min-w-0 flex-1">
                <p className="font-black text-white">Voucher Showroom</p>
                {v.metadata?.discount ? (
                  <p className="text-sm font-bold text-amber-300">Reducere: {String(v.metadata.discount)}%</p>
                ) : (
                  <p className="text-[11px] text-white/50">Reducere la cumpărare vehicule</p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-bold text-white/70">
                x{v.quantity}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Taxes Tab
// ---------------------------------------------------------------------------
function TaxesTab({
  nextTaxAt,
  skipNextTax,
  ownedVehicles,
}: {
  nextTaxAt: string | null;
  skipNextTax: boolean;
  ownedVehicles: import('../types/game').OwnedVehicle[];
}) {
  const countdown = useCountdown(nextTaxAt);
  const totalTax = ownedVehicles.reduce((s, v) => s + Math.floor(v.purchasePrice * 0.01), 0);

  return (
    <div className="space-y-4">
      <div className="hud-panel p-5">
        <h2 className="mb-4 text-sm font-black uppercase tracking-[0.2em] text-white/60">Următoarea Colectare</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
          <div className="text-center sm:text-left">
            <p className="text-[11px] uppercase tracking-widest text-white/40">Timp rămas</p>
            <p className={`mt-1 text-4xl font-black tabular-nums ${countdown === 'Expirat' ? 'text-red-400' : 'text-[#ffd95a]'}`}>
              {nextTaxAt ? countdown : '—'}
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-1">
            <StatRow label="Sumă de colectat" value={totalTax > 0 ? (totalTax.toLocaleString('ro-RO') + ' $') : '0 $'} />
            <StatRow label="Vehicule taxate" value={String(ownedVehicles.length)} />
            <StatRow label="Rată taxă" value="1% / vehicul" />
          </div>
        </div>

        {skipNextTax && (
          <div className="mt-4 rounded-xl border border-green-400/35 bg-green-900/25 px-4 py-3 text-sm text-green-300">
            ✅ <strong>Scutire activă</strong> — următoarea colectare va fi anulată automat.
          </div>
        )}

        {!nextTaxAt && (
          <p className="mt-3 text-sm text-white/40">Taxa se activează după prima cumpărare de vehicul.</p>
        )}
      </div>

      {ownedVehicles.length > 0 && (
        <div className="hud-panel p-5">
          <h2 className="mb-3 text-sm font-black uppercase tracking-[0.2em] text-white/60">Detaliu Taxe pe Vehicule</h2>
          <div className="space-y-2">
            {ownedVehicles.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-white/3 px-4 py-2.5">
                <p className="text-sm font-bold text-white">{v.modelName}</p>
                <p className="text-sm font-black text-[#ffd95a]">
                  {Math.floor(v.purchasePrice * 0.01).toLocaleString('ro-RO')} $
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="font-black text-white">{value}</span>
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
