import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api, type SessionUser } from '../lib/api';
import type { PlayerState } from '../types/game';

const PLAYER_KEY = 'luck_player_id_v1';

export function setPlayerId(value: string) {
  if (!value) return;
  localStorage.setItem(PLAYER_KEY, value);
  window.dispatchEvent(new Event('luck-player-id-changed'));
}

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
  session: SessionUser | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const PlayerContext = createContext<PlayerContextValue>({
  playerId: '',
  player: null,
  session: null,
  loading: false,
  error: null,
  refresh: () => {},
});

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [playerId, setPlayerIdState] = useState(getPlayerId);
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [session, setSession] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SessionUser | null>(null);
  const sessionRequestRef = useRef<Promise<SessionUser> | null>(null);

  useEffect(() => {
    const syncPlayerId = () => {
      const nextId = localStorage.getItem(PLAYER_KEY);
      if (nextId && nextId !== playerId) {
        setPlayerIdState(nextId);
      }
    };

    window.addEventListener('storage', syncPlayerId);
    window.addEventListener('luck-player-id-changed', syncPlayerId as EventListener);
    return () => {
      window.removeEventListener('storage', syncPlayerId);
      window.removeEventListener('luck-player-id-changed', syncPlayerId as EventListener);
    };
  }, [playerId]);

  const loadSession = useCallback(() => {
    if (!sessionRequestRef.current) {
      sessionRequestRef.current = api.ensureSession().finally(() => {
        sessionRequestRef.current = null;
      });
    }
    return sessionRequestRef.current;
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    setError(null);
    const knownSession = sessionRef.current;
    const sessionPromise = knownSession && knownSession.playerId === playerId
      ? Promise.resolve(knownSession)
      : loadSession();

    sessionPromise
      .then(async (nextSession) => {
        sessionRef.current = nextSession;
        setSession(nextSession);
        const sessionPlayerId = String(nextSession.playerId || '');
        if (!sessionPlayerId) throw new Error('Authenticated account has no player profile');
        if (sessionPlayerId !== playerId) {
          localStorage.setItem(PLAYER_KEY, sessionPlayerId);
          setPlayerIdState(sessionPlayerId);
        }
        return api.bootstrap(sessionPlayerId);
      })
      .then((data) => setPlayer(data))
      .catch((e: unknown) => {
        setSession(null);
        setError(e instanceof Error ? e.message : 'Failed to load player data');
      })
      .finally(() => setLoading(false));
  }, [loadSession, playerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const syncCityProgress = () => refresh();
    const syncSession = () => {
      sessionRef.current = null;
      refresh();
    };
    const syncPlayer = () => refresh();
    window.addEventListener('city-progress-updated', syncCityProgress as EventListener);
    window.addEventListener('luck-session-changed', syncSession as EventListener);
    window.addEventListener('cityflow-player-refresh', syncPlayer as EventListener);
    return () => {
      window.removeEventListener('city-progress-updated', syncCityProgress as EventListener);
      window.removeEventListener('luck-session-changed', syncSession as EventListener);
      window.removeEventListener('cityflow-player-refresh', syncPlayer as EventListener);
    };
  }, [refresh]);

  return (
    <PlayerContext.Provider value={{ playerId, player, session, loading, error, refresh }}>
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerContext(): PlayerContextValue {
  return useContext(PlayerContext);
}
