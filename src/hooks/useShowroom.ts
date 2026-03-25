import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import type { ShowroomResponse, ShowroomBuyResult } from '../types/game';

export function useShowroom() {
  const [showroom, setShowroom] = useState<ShowroomResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .showroom()
      .then((data) => setShowroom(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Eroare la încărcarea showroom-ului'),
      )
      .finally(() => setLoading(false));
  }, []);

  const buy = useCallback(
    (playerId: string, modelId: number, useVoucher: boolean): Promise<ShowroomBuyResult> =>
      api.showroomBuy(playerId, modelId, useVoucher),
    [],
  );

  return { showroom, loading, error, load, buy };
}
