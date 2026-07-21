import { useEffect, useRef } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { fetchGangState, syncGangState } from '../../lib/platformApi';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return String(hash);
}

function readStoredState() {
  try {
    const raw = localStorage.getItem(GAME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data || !parsed?.sig || signPayload(parsed.data) !== parsed.sig) return null;
    return parsed.data as Record<string, any>;
  } catch {
    return null;
  }
}

function readGangData() {
  const state = readStoredState();
  const gangData = state?.gangData;
  if (!gangData || typeof gangData !== 'object' || !String(gangData.name || '').trim()) return null;
  return gangData as Record<string, unknown>;
}

function mergeServerEventMembers(serverMembers: unknown[]) {
  const state = readStoredState();
  if (!state?.gangData || !Array.isArray(serverMembers)) return null;
  const localMembers = Array.isArray(state.gangData.members) ? state.gangData.members : [];
  const removedEventMemberIds = new Set(
    Array.isArray(state.gangData.removedEventMemberIds)
      ? state.gangData.removedEventMemberIds.map((value: unknown) => String(value))
      : [],
  );
  const ids = new Set(localMembers.map((member: any) => String(member?.id || '')));
  const protectedMembers = serverMembers.filter((member: any) => (
    member
    && typeof member === 'object'
    && member.rarity === 'MYTHIC'
    && member.source === 'ADMIN_EVENT'
    && !ids.has(String(member.id || ''))
    && !removedEventMemberIds.has(String(member.id || ''))
  ));
  if (protectedMembers.length === 0) return null;
  const nextGangData = {
    ...state.gangData,
    members: [...protectedMembers, ...localMembers].slice(0, 34),
  };
  const nextState = { ...state, gangData: nextGangData };
  localStorage.setItem(GAME_KEY, JSON.stringify({ data: nextState, sig: signPayload(nextState) }));
  window.dispatchEvent(new Event('cityflow-gang-updated'));
  return nextGangData;
}

export default function GangSyncBridge() {
  const { playerId } = usePlayer();
  const lastPayloadRef = useRef('');

  useEffect(() => {
    if (!playerId) return;
    const sync = async () => {
      try {
        const remote = await fetchGangState(playerId);
        mergeServerEventMembers(remote?.members || []);
        const gangData = readGangData();
        if (!gangData) return;
        const serialized = JSON.stringify(gangData);
        if (serialized === lastPayloadRef.current) return;
        const payload = await syncGangState(playerId, gangData);
        const merged = mergeServerEventMembers(payload.gang?.members || []);
        lastPayloadRef.current = JSON.stringify(merged || gangData);
      } catch {}
    };

    sync().catch(() => {});
    const timer = window.setInterval(() => sync().catch(() => {}), 5000);
    return () => window.clearInterval(timer);
  }, [playerId]);

  return null;
}
