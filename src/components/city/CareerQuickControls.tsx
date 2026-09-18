import { useCallback, useEffect, useState } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { api } from '../../lib/api';
import type { FisherStateResponse, PilotStateResponse } from '../../types/game';

type CareerQuickControlsProps = {
  path: string;
};

export default function CareerQuickControls({ path }: CareerQuickControlsProps) {
  const { playerId } = usePlayer();
  const [fisher, setFisher] = useState<FisherStateResponse | null>(null);
  const [pilot, setPilot] = useState<PilotStateResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!playerId) return;
    try {
      if (path === '/fisher') {
        setFisher(await api.fisherState(playerId));
        setPilot(null);
      } else if (path === '/pilot') {
        setPilot(await api.pilotState(playerId));
        setFisher(null);
      } else {
        setFisher(null);
        setPilot(null);
      }
    } catch {
      // The page itself owns detailed load errors. This control stays silent.
    }
  }, [path, playerId]);

  useEffect(() => {
    load().catch(() => {});
    if (path !== '/fisher' && path !== '/pilot') return undefined;
    const timer = window.setInterval(() => load().catch(() => {}), 2500);
    return () => window.clearInterval(timer);
  }, [load, path]);

  const stopFishing = async () => {
    if (!playerId || busy) return;
    setBusy(true);
    setError(null);
    try {
      setFisher(await api.fisherShiftEnd(playerId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not stop fishing');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const stopPilot = async () => {
    if (!playerId || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (pilot?.activeFlight) {
        const payload = await api.pilotFlightCancel(playerId);
        setPilot(payload.state);
        window.dispatchEvent(new CustomEvent('cityflow-pilot-cancelled'));
      } else {
        setPilot(await api.pilotShiftEnd(playerId));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not stop pilot shift');
      await load();
    } finally {
      setBusy(false);
    }
  };

  const fisherActive = path === '/fisher' && fisher && fisher.shiftState !== 'IDLE';
  const pilotActive = path === '/pilot' && pilot && pilot.shiftState !== 'IDLE';
  if (!fisherActive && !pilotActive) return null;

  const label = fisherActive ? 'Stop fishing' : pilot?.activeFlight ? 'Cancel flight' : 'End pilot shift';
  const action = fisherActive ? stopFishing : stopPilot;

  return (
    <div className="fixed bottom-24 right-4 z-[235] flex max-w-[calc(100vw-2rem)] flex-col items-end gap-2 md:bottom-6 md:right-6">
      {error ? <div className="rounded-xl border border-red-400/20 bg-[#261113]/95 px-3 py-2 text-xs font-bold text-red-100 shadow-2xl">{error}</div> : null}
      <button
        type="button"
        onClick={() => action().catch(() => {})}
        disabled={busy}
        className="btn-danger rounded-2xl px-5 py-3 text-sm shadow-2xl disabled:opacity-40"
      >
        {busy ? 'Stopping...' : label}
      </button>
    </div>
  );
}
