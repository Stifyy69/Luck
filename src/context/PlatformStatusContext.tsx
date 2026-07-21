import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayer } from '../hooks/usePlayer';
import { fetchCityProgress } from '../lib/cityProgressApi';
import { fetchPlatformStatus, type PlatformStatus, type VipStatus } from '../lib/platformApi';

const EMPTY_VIP: VipStatus = {
  active: false,
  tier: null,
  label: null,
  expiresAt: null,
  startedAt: null,
  durationMs: 0,
  remainingMs: 0,
};

const EMPTY_STATUS: PlatformStatus = { vip: EMPTY_VIP };

type PlatformStatusContextValue = {
  status: PlatformStatus;
  loading: boolean;
  refresh: () => void;
};

const PlatformStatusContext = createContext<PlatformStatusContextValue>({
  status: EMPTY_STATUS,
  loading: false,
  refresh: () => {},
});

export function PlatformStatusProvider({ children }: { children: React.ReactNode }) {
  const { playerId, player } = usePlayer();
  const [serverStatus, setServerStatus] = useState<PlatformStatus>(EMPTY_STATUS);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(false);
  const expiredRefreshRef = useRef<string | null>(null);

  const load = useCallback(() => {
    if (!playerId) return;
    setLoading(true);
    fetchPlatformStatus(playerId)
      .then((next) => {
        setServerStatus(next);
        if (next.vip.expiresAt) expiredRefreshRef.current = null;
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [playerId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 2500);
    window.addEventListener('platform-status-refresh', load as EventListener);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('platform-status-refresh', load as EventListener);
    };
  }, [load]);


  useEffect(() => {
    const vipBoost = [...(player?.activeBoosts || [])]
      .filter((boost) => boost.boostType === 'VIP_SILVER' || boost.boostType === 'VIP_GOLD')
      .sort((left, right) => new Date(right.expiresAt).getTime() - new Date(left.expiresAt).getTime())[0];
    if (!vipBoost) return;
    const expiresAtMs = new Date(vipBoost.expiresAt).getTime();
    if (expiresAtMs <= Date.now()) return;
    const tier = vipBoost.boostType as 'VIP_SILVER' | 'VIP_GOLD';
    const durationMs = tier === 'VIP_GOLD' ? 125_000 : 65_000;
    setServerStatus({
      vip: {
        active: true,
        tier,
        label: tier === 'VIP_GOLD' ? 'VIP Gold' : 'VIP Silver',
        expiresAt: vipBoost.expiresAt,
        startedAt: new Date(expiresAtMs - durationMs).toISOString(),
        durationMs,
        remainingMs: Math.max(0, expiresAtMs - Date.now()),
      },
    });
  }, [player?.activeBoosts]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  const status = useMemo<PlatformStatus>(() => {
    const expiresAt = serverStatus.vip.expiresAt ? new Date(serverStatus.vip.expiresAt).getTime() : 0;
    const remainingMs = Math.max(0, expiresAt - now);
    if (!serverStatus.vip.active || !expiresAt || remainingMs <= 0) return { vip: EMPTY_VIP };
    return { vip: { ...serverStatus.vip, remainingMs } };
  }, [now, serverStatus]);

  useEffect(() => {
    const expiredKey = serverStatus.vip.expiresAt;
    if (!expiredKey || status.vip.active || expiredRefreshRef.current === expiredKey) return;
    expiredRefreshRef.current = expiredKey;
    fetchCityProgress(playerId).catch(() => {});
    load();
  }, [load, playerId, serverStatus.vip.expiresAt, status.vip.active]);

  return (
    <PlatformStatusContext.Provider value={{ status, loading, refresh: load }}>
      {children}
    </PlatformStatusContext.Provider>
  );
}

export function usePlatformStatus() {
  return useContext(PlatformStatusContext);
}
