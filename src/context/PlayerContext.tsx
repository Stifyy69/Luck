import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { PlayerState } from '../types/game';

const PLAYER_KEY = 'luck_player_id_v1';

export function getPlayerId(): string {
  let id = localStorage.getItem(PLAYER_KEY);
  if (id) return id;
  id = `player_${Math.random().toString(36).slice(2, 10)}`;
  localStorage.setItem(PLAYER_KEY, id);
  return id;
}

export interface PlayerContextValue {
  playerId: string;
  player: PlayerState | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const PlayerContext = createContext<PlayerContextValue>({
  playerId: '',
  player: null,
  loading: false,
  error: null,
  refresh: () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerId] = useState(getPlayerId);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .bootstrap(playerId)
      .then((data) => setPlayer(data))
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Eroare la încărcarea datelor'),
      )
      .finally(() => setLoading(false));
  }, [playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <PlayerContext.Provider value={{ playerId, player, loading, error, refresh }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext(): PlayerContextValue {
  return useContext(PlayerContext);
}
