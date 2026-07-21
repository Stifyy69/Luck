import { useEffect, useRef } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { syncGangState } from '../../lib/platformApi';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return String(hash);
}

function readGangData() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig || signPayload(parsed.data) !== parsed.sig) return null;
    const gangData = parsed.data?.gangData;
    if (!gangData || typeof gangData !== 'object' || !String(gangData.name || '').trim()) return null;
    return gangData as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function GangSyncBridge() {
  const { playerId } = usePlayer();
  const lastPayloadRef = useRef('');

  useEffect(() => {
    if (!playerId) return;
    const sync = () => {
      const gangData = readGangData();
      if (!gangData) return;
      const serialized = JSON.stringify(gangData);
      if (serialized === lastPayloadRef.current) return;
      syncGangState(playerId, gangData)
        .then(() => {
          lastPayloadRef.current = serialized;
        })
        .catch(() => {});
    };

    sync();
    const timer = window.setInterval(sync, 4000);
    return () => window.clearInterval(timer);
  }, [playerId]);

  return null;
}
