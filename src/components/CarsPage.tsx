import { useEffect, useState } from 'react';
import SharedStatsPanel from './SharedStatsPanel';
import PageDisclaimer from './PageDisclaimer';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

type CarKey = 'audi_a4' | 'rs7' | 'p1' | 'lfa';

type CarOffer = {
  key: CarKey;
  name: string;
  price: number;
  image: string;
};

const cars: CarOffer[] = [
  { key: 'audi_a4', name: 'AUDI A4', price: 50_000, image: 'https://panel.ogland.ro/assets/img/vehicles/a899.png' },
  { key: 'rs7', name: 'RS7', price: 500_000, image: 'https://panel.ogland.ro/assets/img/vehicles/rs7c8.png' },
  { key: 'p1', name: 'P1', price: 2_200_000, image: 'https://panel.ogland.ro/assets/img/vehicles/p1.png' },
  { key: 'lfa', name: 'LFA', price: 2_000_000, image: 'https://panel.ogland.ro/assets/img/vehicles/aperta.png' },
];

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
  return String(hash);
}

function loadGameState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig) return null;
    return signPayload(parsed.data) === parsed.sig ? parsed.data : null;
  } catch {
    return null;
  }
}

function saveGameState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

export default function CarsPage() {
  const saved = typeof window !== 'undefined' ? loadGameState() : null;
  const [cashBalance, setCashBalance] = useState(Number(saved?.cashBalance ?? 1_000_000));
  const [ownedCars, setOwnedCars] = useState<Record<CarKey, number>>({
    audi_a4: Number(saved?.ownedCars?.audi_a4 ?? 0),
    rs7: Number(saved?.ownedCars?.rs7 ?? 0),
    p1: Number(saved?.ownedCars?.p1 ?? 0),
    lfa: Number(saved?.ownedCars?.lfa ?? 0),
  });
  const [popup, setPopup] = useState<string | null>(null);

  useEffect(() => {
    const latest = loadGameState() || {};
    setCashBalance(Number(latest.cashBalance ?? 1_000_000));
    setOwnedCars({
      audi_a4: Number(latest.ownedCars?.audi_a4 ?? 0),
      rs7: Number(latest.ownedCars?.rs7 ?? 0),
      p1: Number(latest.ownedCars?.p1 ?? 0),
      lfa: Number(latest.ownedCars?.lfa ?? 0),
    });
  }, []);

  useEffect(() => {
    const existing = loadGameState() || {};
    saveGameState({
      ...existing,
      cashBalance,
      baniCurati: cashBalance,
      ownedCars,
    });
  }, [cashBalance, ownedCars]);

  const buyCar = (car: CarOffer) => {
    if (cashBalance < car.price) {
      setPopup('Nu ai bani curati suficienti.');
      window.setTimeout(() => setPopup(null), 2200);
      return;
    }

    setCashBalance((current) => current - car.price);
    setOwnedCars((current) => ({ ...current, [car.key]: (current[car.key] ?? 0) + 1 }));
    setPopup(`Ai cumpărat ${car.name}.`);
    window.setTimeout(() => setPopup(null), 2200);
  };

  return (
    <div className="min-h-screen bg-[#110d28] px-4 pb-10 pt-20 text-white sm:px-6">
      <div className="mx-auto grid max-w-[1460px] grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="hud-panel p-4 backdrop-blur-xl sm:p-6">
          <h1 className="text-center text-4xl font-black uppercase tracking-tight text-white">Cars</h1>
          <p className="mt-2 text-center text-white/70">Cash disponibil: {cashBalance.toLocaleString('ro-RO')} $</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {cars.map((car) => {
              const canBuy = cashBalance >= car.price;
              return (
                <div key={car.key} className="rounded-xl border border-white/15 bg-black/25 p-3">
                  <img src={car.image} alt={car.name} className="h-28 w-full rounded-lg object-contain bg-black/35 p-2" />
                  <p className="mt-2 text-lg font-black">{car.name}</p>
                  <p className="text-sm text-white/70">{car.price.toLocaleString('ro-RO')} $</p>
                  <button
                    type="button"
                    onClick={() => buyCar(car)}
                    disabled={!canBuy}
                    className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-black ${canBuy ? 'bg-emerald-500/80 text-white' : 'bg-[#2a2744] text-white/50'}`}
                  >
                    Cumpără
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-6 rounded-xl border border-white/15 bg-black/25 p-4">
            <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white/60">Mașinile tale</p>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {cars.map((car) => (
                <div key={`owned-${car.key}`} className="rounded-lg border border-white/10 bg-black/30 p-2 text-center">
                  <img src={car.image} alt={car.name} className="mx-auto h-16 w-full object-contain" />
                  <p className="mt-1 text-xs font-bold">{car.name}</p>
                  <p className="text-lg font-black text-cyan-200">{(ownedCars[car.key] ?? 0).toLocaleString('ro-RO')}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SharedStatsPanel />
      </div>
      <div className="mx-auto mt-5 max-w-[1460px]"><PageDisclaimer /></div>

      {popup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setPopup(null)}>
          <div onClick={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-emerald-300/40 bg-emerald-500/20 px-5 py-5 text-center text-base font-semibold text-emerald-100 shadow-xl">
            {popup}
          </div>
        </div>
      ) : null}
    </div>
  );
}
