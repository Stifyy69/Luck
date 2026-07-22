import { useCallback, useEffect, useRef, useState } from 'react';
import { gangApi, operationId } from '../lib/gangApi';
import type { GangRecipe, GangResource, GangState } from '../types/gang';

const emptyState: GangState = {
  name: 'CityFlow Crew', level: 1, cleanBalance: 0, dirtyBalance: 0, totalDirtyEarned: 0,
  battleReputation: 0, stockValue: 0, stateVersion: 0,
  resources: { leaves: 0, white: 0, blue: 0, sulfur: 0, ironOre: 0, gunpowder: 0, steel: 0 },
  members: [], activityLog: [],
};

export function useGangStockActions() {
  const [state, setState] = useState<GangState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const versionRef = useRef(0);

  const applyServerState = useCallback((next: GangState) => {
    if (Number(next.stateVersion) < versionRef.current) return false;
    versionRef.current = Number(next.stateVersion);
    setState(next);
    return true;
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let response;
      try { response = await gangApi.load(); } catch (loadError) {
        if (!(loadError instanceof Error) || !/inexistent/.test(loadError.message)) throw loadError;
        response = await gangApi.bootstrap(emptyState);
      }
      applyServerState(response.state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Gang indisponibil.');
    } finally { setLoading(false); }
  }, [applyServerState]);

  useEffect(() => { void refresh(); }, [refresh]);

  const execute = useCallback(async (run: () => ReturnType<typeof gangApi.sell>) => {
    if (pending) return;
    setPending(true);
    setError('');
    try {
      const response = await run();
      applyServerState(response.state);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Operația a eșuat.');
    } finally { setPending(false); }
  }, [applyServerState, pending]);

  const sell = useCallback((material: Extract<GangResource, 'blue' | 'gunpowder' | 'steel'>, quantity: number | 'all') =>
    execute(() => gangApi.sell(material, quantity, operationId('sell'))), [execute]);
  const process = useCallback((recipe: GangRecipe, batches: number) =>
    execute(() => gangApi.process(recipe, batches, operationId('process'))), [execute]);

  return { state, loading, pending, error, refresh, sell, process, applyServerState };
}
