import { useEffect, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';
import SleepPage from './components/SleepPage';
import AdminPanelV2 from './components/AdminPanelV2';
import PilotPage from './components/PilotPage';
import GangsPage from './components/GangsPage';
import CNNMarketplace from './components/CNNMarketplace';
import ShowroomPage from './components/ShowroomPage';
import InventoryPage from './components/InventoryPage';
import MyProfilePage from './components/MyProfilePage';
import AccountHud from './components/AccountHud';
import { startGameSync } from './lib/gameSync';

type RoutePath =
  | '/ruleta'
  | '/farmat'
  | '/sleep'
  | '/pilot'
  | '/showroom'
  | '/inventory'
  | '/owned'
  | '/profile'
  | '/cnn'
  | '/gangs'
  | '/adminpanelv2';

const VALID_ROUTES: RoutePath[] = [
  '/ruleta',
  '/farmat',
  '/sleep',
  '/pilot',
  '/showroom',
  '/inventory',
  '/owned',
  '/profile',
  '/cnn',
  '/gangs',
  '/adminpanelv2',
];

function normalizePath(pathname: string): RoutePath {
  if (pathname === '/cars') return '/showroom';
  if (pathname === '/marketplace') return '/cnn';
  if (pathname === '/owned') return '/inventory';
  if (pathname === '/status') return '/profile';
  if (VALID_ROUTES.includes(pathname as RoutePath)) return pathname as RoutePath;
  return '/ruleta';
}

export default function App() {
  const [path, setPath] = useState<RoutePath>(normalizePath(window.location.pathname || '/ruleta'));
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const nextPath = normalizePath(window.location.pathname || path);
    if (nextPath !== window.location.pathname) {
      window.history.replaceState({}, '', nextPath);
    }
    if (nextPath !== path) setPath(nextPath);

    const onPopState = () => setPath(normalizePath(window.location.pathname || '/ruleta'));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [path]);

  useEffect(() => {
    const stop = startGameSync();
    return () => stop?.();
  }, []);

  const goTo = (nextPath: RoutePath) => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    setMenuOpen(false);
  };

  return (
    <div className="relative min-h-screen">
      <AccountHud />
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="fixed left-2 top-4 z-[70] inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#ffd95a]/35 bg-[#3b2a2a]/90 text-white shadow-[0_18px_35px_rgba(0,0,0,0.35)] backdrop-blur md:hidden"
        aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      >
        <span className="text-lg leading-none">{menuOpen ? '◀' : '▶'}</span>
      </button>

      <div className={`hud-panel fixed inset-y-0 left-0 z-[60] w-[242px] rounded-r-2xl p-4 backdrop-blur-xl transition-transform md:left-5 md:top-4 md:h-[calc(100vh-2rem)] md:w-[226px] md:rounded-2xl ${menuOpen ? 'translate-x-0' : '-translate-x-[86%] md:translate-x-0'}`}>
        <div className="mb-4 border-b border-white/10 pb-4">
          <div className="mb-3 rounded-xl border border-[#ffd95a]/45 bg-gradient-to-r from-[#ffb347]/20 to-[#ff7aa2]/12 px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd36a]">CityFlow No-RP</p>
          </div>
          <p className="inline-block rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
            OG Stifyy
          </p>
          <p className="mt-2 text-2xl font-black text-white/95">Luck Panel</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/profile')}
          className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/profile' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          My Profile
        </button>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Work</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/farmat')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/farmat' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Cayo
        </button>
        <button
          type="button"
          onClick={() => goTo('/sleep')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/sleep' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Sleep
        </button>
        <button
          type="button"
          onClick={() => goTo('/pilot')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/pilot' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Pilot
        </button>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Fun</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/ruleta')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/ruleta' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Roulette
        </button>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Inventory</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/inventory')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/inventory' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Inventory
        </button>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Market</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/showroom')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/showroom' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Showroom
        </button>
        <button
          type="button"
          onClick={() => goTo('/cnn')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/cnn' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          CNN Market
        </button>
        <div className="mt-4 border-t border-white/10 pt-4">
          <p className="px-4 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">Gangs</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/gangs')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/gangs' ? 'btn-secondary shadow-[inset_3px_0_0_#ffb347]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Gangs
        </button>
      </div>

      <main className="md:pl-[250px] md:pr-3">
        {path === '/farmat'
          ? <FarmatPage />
          : path === '/sleep'
            ? <SleepPage />
            : path === '/pilot'
              ? <PilotPage />
              : path === '/showroom'
                ? <ShowroomPage />
                : path === '/inventory'
                  ? <InventoryPage />
                  : path === '/owned'
                    ? <InventoryPage />
                    : path === '/profile'
                        ? <MyProfilePage />
                : path === '/gangs'
                  ? <GangsPage />
                  : path === '/cnn'
                    ? <CNNMarketplace />
            : path === '/adminpanelv2'
              ? <AdminPanelV2 />
              : <RouletteDemo />}
      </main>
    </div>
  );
}
