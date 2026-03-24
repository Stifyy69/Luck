import { useEffect, useState } from 'react';
import RouletteDemo from './components/RouletteDemo';
import FarmatPage from './components/FarmatPage';

export default function App() {
  const [path, setPath] = useState(window.location.pathname || '/ruleta');

  useEffect(() => {
    if (path === '/' || (path !== '/ruleta' && path !== '/farmat')) {
      window.history.replaceState({}, '', '/ruleta');
      setPath('/ruleta');
    }

    const onPopState = () => setPath(window.location.pathname || '/ruleta');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [path]);

  const goTo = (nextPath: '/ruleta' | '/farmat') => {
    if (nextPath === path) return;
    window.history.pushState({}, '', nextPath);
    setPath(nextPath);
  };

  return (
    <div className="relative">
      <div className="fixed left-4 top-4 z-50 rounded-xl border border-white/15 bg-[#0a0920]/80 p-2 backdrop-blur-lg sm:left-6 sm:top-6">
        <button
          type="button"
          onClick={() => goTo('/farmat')}
          className={`block w-full rounded-lg px-4 py-2 text-left text-sm font-bold uppercase tracking-[0.08em] transition ${path === '/farmat' ? 'bg-violet-500/30 text-white' : 'text-white/70 hover:bg-white/10'}`}
        >
          Farmat
        </button>
        <button
          type="button"
          onClick={() => goTo('/ruleta')}
          className={`mt-1 block w-full rounded-lg px-4 py-2 text-left text-sm font-bold uppercase tracking-[0.08em] transition ${path === '/ruleta' ? 'bg-violet-500/30 text-white' : 'text-white/70 hover:bg-white/10'}`}
        >
          Ruleta
        </button>
      </div>

      {path === '/farmat' ? <FarmatPage /> : <RouletteDemo />}
    </div>
  );
}
