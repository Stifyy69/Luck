import { useEffect, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';
import SleepPage from './components/SleepPage';
import AdminPanelV2 from './components/AdminPanelV2';
import PilotPage from './components/PilotPage';
import CarsPage from './components/CarsPage';
import GangsPage from './components/GangsPage';
import { startGameSync } from './lib/gameSync';

export default function App() {
  const [path, setPath] = useState(window.location.pathname || '/ruleta');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (path === '/' || (path !== '/ruleta' && path !== '/farmat' && path !== '/sleep' && path !== '/pilot' && path !== '/cars' && path !== '/gangs' && path !== '/adminpanelv2')) {
      window.history.replaceState({}, '', '/ruleta');
      setPath('/ruleta');
    }

    const onPopState = () => setPath(window.location.pathname || '/ruleta');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [path]);

  useEffect(() => {
    const stop = startGameSync();
    return () => stop?.();
  }, []);

  const goTo = (nextPath: '/ruleta' | '/farmat' | '/sleep' | '/pilot' | '/cars' | '/gangs' | '/adminpanelv2') => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
    setMenuOpen(false);
  };

  return (
    <div className="relative bg-[#08061a]">
      <button
        type="button"
        onClick={() => setMenuOpen((current) => !current)}
        className="fixed left-2 top-4 z-[70] inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-[#070913]/95 text-white shadow-[0_18px_35px_rgba(0,0,0,0.45)] backdrop-blur md:hidden"
        aria-label={menuOpen ? 'Închide meniul' : 'Deschide meniul'}
      >
        <span className="text-lg leading-none">{menuOpen ? '◀' : '▶'}</span>
      </button>

      <div className={`fixed inset-y-0 left-0 z-[60] w-[242px] rounded-r-2xl border-r border-white/15 bg-gradient-to-b from-[#0b1128]/96 to-[#060812]/98 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl transition-transform md:left-5 md:top-4 md:h-[calc(100vh-2rem)] md:w-[226px] md:rounded-2xl md:border md:border-white/15 md:rounded-r-2xl ${menuOpen ? 'translate-x-0' : '-translate-x-[86%] md:translate-x-0'}`}>
        <div className="mb-4 border-b border-white/10 pb-4">
          <div className="mb-3 rounded-xl border border-[#f8c144]/35 bg-gradient-to-r from-[#f8c144]/18 to-transparent px-3 py-2">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd36a]">CityFlow No-RP</p>
          </div>
          <p className="inline-block rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
            OG Stifyy
          </p>
          <p className="mt-2 text-2xl font-black text-white/95">Farm Panel</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/farmat')}
          className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/farmat' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Cayo
        </button>
        <button
          type="button"
          onClick={() => goTo('/ruleta')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/ruleta' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Ruleta
        </button>
        <button
          type="button"
          onClick={() => goTo('/sleep')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/sleep' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Sleep
        </button>
        <button
          type="button"
          onClick={() => goTo('/pilot')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/pilot' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Pilot
        </button>
        <button
          type="button"
          onClick={() => goTo('/cars')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/cars' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Cars
        </button>
        <button
          type="button"
          onClick={() => goTo('/gangs')}
          className={`mt-2 block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/gangs' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Gangs
        </button>
      </div>

      {path === '/farmat'
        ? <FarmatPage />
        : path === '/sleep'
          ? <SleepPage />
          : path === '/pilot'
            ? <PilotPage />
            : path === '/cars'
              ? <CarsPage />
              : path === '/gangs'
                ? <GangsPage />
          : path === '/adminpanelv2'
            ? <AdminPanelV2 />
            : <RouletteDemo />}
    </div>
  );
}
