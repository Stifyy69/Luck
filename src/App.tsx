import { useEffect, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';
import SleepPage from './components/SleepPage';

export default function App() {
  const [path, setPath] = useState(window.location.pathname || '/ruleta');

  useEffect(() => {
    if (path === '/' || (path !== '/ruleta' && path !== '/farmat' && path !== '/sleep')) {
      window.history.replaceState({}, '', '/ruleta');
      setPath('/ruleta');
    }

    const onPopState = () => setPath(window.location.pathname || '/ruleta');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [path]);

  const goTo = (nextPath: '/ruleta' | '/farmat' | '/sleep') => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  return (
    <div className="relative">
      <div className="fixed left-4 top-4 z-50 w-[220px] rounded-2xl border border-white/15 bg-gradient-to-b from-[#0d1227]/95 to-[#070913]/95 p-4 shadow-[0_25px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:left-6 sm:top-6">
        <div className="mb-4 border-b border-white/10 pb-3">
          <p className="inline-block rounded-full border border-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-white/55">
            OG Land
          </p>
          <p className="mt-2 text-2xl font-black text-white/95">Control Panel</p>
        </div>
        <button
          type="button"
          onClick={() => goTo('/farmat')}
          className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-bold uppercase tracking-[0.06em] transition ${path === '/farmat' ? 'border border-cyan-300/30 bg-white/10 text-white shadow-[inset_3px_0_0_#67e8f9]' : 'text-white/70 hover:bg-white/5'}`}
        >
          Farmat
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
      </div>

      {path === '/farmat' ? <FarmatPage /> : path === '/sleep' ? <SleepPage /> : <RouletteDemo />}
    </div>
  );
}
