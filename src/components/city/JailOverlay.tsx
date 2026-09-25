import { useEffect, useState } from 'react';
import type { JailStatus } from '../../types/game';

export default function JailOverlay({ jail }: { jail: JailStatus | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const remainingMs = jail?.jailedUntil ? Math.max(0, new Date(jail.jailedUntil).getTime() - now) : 0;
  if (!remainingMs) return null;
  const seconds = Math.ceil(remainingMs / 1_000);
  const countdown = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-[#080b09]/95 p-5 text-center backdrop-blur-xl" role="alert" aria-live="polite">
      <div className="game-panel w-full max-w-lg border border-red-400/25 px-7 py-10 sm:px-10">
        <p className="section-kicker text-red-300">Jail</p>
        <h2 className="mt-4 text-3xl font-black tracking-tight text-white">You are in jail</h2>
        <p className="mt-3 text-sm text-white/55">All jobs are locked until your sentence ends.</p>
        <p className="mt-8 text-6xl font-black tabular-nums text-red-200">{countdown}</p>
        <p className="mt-5 text-xs text-white/40">Your progress is saved. Job access returns automatically when the timer reaches zero.</p>
      </div>
    </div>
  );
}
