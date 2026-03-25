import { useEffect, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';
import SleepPage from './components/SleepPage';
import AdminPanelV2 from './components/AdminPanelV2';
import PilotPage from './components/PilotPage';
import CarsPage from './components/CarsPage';
import GangsPage from './components/GangsPage';
import CNNMarketplace from './components/CNNMarketplace';
import ShowroomPage from './components/ShowroomPage';
import InventoryPage from './components/InventoryPage';
import OwnedAssetsPage from './components/OwnedAssetsPage';
import PlayerStatusPage from './components/PlayerStatusPage';
import { startGameSync } from './lib/gameSync';

const VALID_PATHS = [
  '/ruleta', '/farmat', '/sleep', '/pilot', '/cars', '/gangs',
  '/adminpanelv2', '/cnn', '/showroom', '/inventory', '/owned', '/status',
] as const;

type AppPath = (typeof VALID_PATHS)[number];

export default function App() {
  const [path, setPath] = useState<AppPath>(() => {
    const p = window.location.pathname as AppPath;
    return (VALID_PATHS as readonly string[]).includes(p) ? p : '/ruleta';
  });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!(VALID_PATHS as readonly string[]).includes(window.location.pathname)) {
      window.history.replaceState({}, '', '/ruleta');
      setPath('/ruleta');
    }

    const onPopState = () => {
      const p = window.location.pathname as AppPath;
      setPath((VALID_PATHS as readonly string[]).includes(p) ? p : '/ruleta');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const stop = startGameSync();
    return () => stop?.();
  }, []);

  const goTo = (nextPath: AppPath) => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    setMenuOpen(false);
  };

  const navBtn = (label: string, target: AppPath) => (
    <button
      type="button"
      onClick={() => goTo(target)}
      className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${
        path === target ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="relative min-h-screen">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="fixed left-2 top-4 z-[70] inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffd95a]/35 bg-[#3b2a2a]/90 text-white shadow-[0_18px_35px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
        aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'}
      >
        <span className="text-lg leading-none">{menuOpen ? '◀' : '▶'}</span>
      </button>

      <div
        className={`hud-panel fixed inset-y-0 left-0 z-[60] w-[242px] overflow-y-auto rounded-r-2xl p-4 backdrop-blur-xl transition-transform md:left-5 md:top-4 md:h-[calc(100vh-2rem)] md:w-[226px] md:rounded-2xl ${
          menuOpen ? 'translate-x-0' : '-translate-x-[86%] md:translate-x-0'
        }`}
      >
        <div className="mb-4 border-b border-white/10 pb-4">
          <div className="mb-3 rounded-xl border border-[#ffd95a]/45 bg-gradient-to-r from-[#ffb347]/20 to-[#ff7aa2]/12 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd36a]">CityFlow No-RP</p>
          </div>
          <p className="inline-block rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
            OG Stifyy
          </p>
          <p className="mt-2 text-2xl font-black text-white/95">Farm Panel</p>
        </div>

        {/* Farm / existing pages */}
        {navBtn('Cayo', '/farmat')}
        {navBtn('Sleep', '/sleep')}
        {navBtn('Pilot', '/pilot')}
        {navBtn('Cars', '/cars')}
        {navBtn('Gangs', '/gangs')}

        {/* Batch C sections */}
        <div className="mt-4 border-t border-white/8 pt-3">
          <p className="mb-1 px-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Economie</p>
          {navBtn('🎰 Ruletă', '/ruleta')}
          {navBtn('🚗 Showroom', '/showroom')}
          {navBtn('📡 CNN Marketplace', '/cnn')}
        </div>

        <div className="mt-4 border-t border-white/8 pt-3">
          <p className="mb-1 px-1 text-[9px] font-black uppercase tracking-[0.3em] text-white/30">Jucător</p>
          {navBtn('🎒 Inventar', '/inventory')}
          {navBtn('📁 Active Deținute', '/owned')}
          {navBtn('📊 Status', '/status')}
        </div>
      </div>

      <main className="md:pl-[250px] md:pr-3">
        {path === '/farmat' ? <FarmatPage />
          : path === '/sleep' ? <SleepPage />
          : path === '/pilot' ? <PilotPage />
          : path === '/cars' ? <CarsPage />
          : path === '/gangs' ? <GangsPage />
          : path === '/cnn' ? <CNNMarketplace />
          : path === '/showroom' ? <ShowroomPage />
          : path === '/inventory' ? <InventoryPage />
          : path === '/owned' ? <OwnedAssetsPage />
          : path === '/status' ? <PlayerStatusPage />
          : path === '/adminpanelv2' ? <AdminPanelV2 />
          : <RouletteDemo />}
      </main>
    </div>
  );
}

