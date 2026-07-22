import { useEffect, useRef } from 'react';
import { usePlayer } from '../../hooks/usePlayer';
import { fetchGangState, syncGangState, type ServerGangState } from '../../lib/platformApi';

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

function writeStoredState(state: Record<string, any>) {
  localStorage.setItem(GAME_KEY, JSON.stringify({ data: state, sig: signPayload(state) }));
}

function readGangData() {
  const state = readStoredState();
  const gangData = state?.gangData;
  if (!gangData || typeof gangData !== 'object' || !String(gangData.name || '').trim()) return null;
  return gangData as Record<string, any>;
}

function applyServerGang(remote: ServerGangState) {
  const state = readStoredState() || {};
  const local = state.gangData && typeof state.gangData === 'object' ? state.gangData : {};
  const removedEventMemberIds = new Set(
    Array.isArray(local.removedEventMemberIds)
      ? local.removedEventMemberIds.map((value: unknown) => String(value))
      : [],
  );
  const members = Array.isArray(remote.members)
    ? remote.members.filter((member) => !removedEventMemberIds.has(String(member?.id || '')))
    : [];
  const nextGangData = {
    ...local,
    name: remote.name,
    levelIndex: remote.gangLevelIndex,
    members,
    frunze: remote.leaves,
    white: remote.whitePacks,
    blue: remote.bluePacks,
    sulfur: remote.sulfur,
    ironOre: remote.ironOre,
    gunpowder: remote.gunpowder,
    steel: remote.steel,
    cleanBalance: remote.cleanBalance,
    dirtyBalance: remote.dirtyBalance,
    dirtyEarned: remote.dirtyEarned,
    onlineNow: remote.activeWorkers,
    dismissalPressure: remote.dismissalPressure,
    lastDismissalAt: remote.lastDismissalAt,
    activityLog: remote.activityLog,
    battleHistory: remote.battleHistory,
    battleReputation: remote.battleReputation,
    defensiveCrewIds: remote.defensiveCrewIds,
    battleBoardSeed: remote.battleBoardSeed,
    lastLeaveAt: remote.lastLeaveAt,
    serverUpdatedAt: remote.updatedAt,
    recruitmentBoard: Array.isArray(local.recruitmentBoard) ? local.recruitmentBoard : [],
    removedEventMemberIds: [...removedEventMemberIds],
  };
  const nextState = { ...state, gangData: nextGangData };
  writeStoredState(nextState);
  window.dispatchEvent(new Event('cityflow-gang-updated'));
  return nextGangData;
}

export default function GangSyncBridge() {
  const { playerId } = usePlayer();
  const lastPayloadRef = useRef('');
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!playerId) return;
    let cancelled = false;

    const sync = async () => {
      if (!initializedRef.current || cancelled) return;
      const gangData = readGangData();
      if (!gangData) return;
      const serialized = JSON.stringify(gangData);
      if (serialized === lastPayloadRef.current) return;
      const payload = await syncGangState(playerId, gangData);
      if (cancelled) return;
      const merged = applyServerGang(payload.gang);
      lastPayloadRef.current = JSON.stringify(merged);
    };

    const initialize = async () => {
      try {
        const remote = await fetchGangState(playerId);
        if (cancelled) return;
        if (remote?.name) {
          const merged = applyServerGang(remote);
          lastPayloadRef.current = JSON.stringify(merged);
        }
      } catch {}
      initializedRef.current = true;
      await sync().catch(() => {});
    };

    initialize().catch(() => {});
    const timer = window.setInterval(() => sync().catch(() => {}), 5000);
    return () => {
      cancelled = true;
      initializedRef.current = false;
      window.clearInterval(timer);
    };
  }, [playerId]);

  return null;
}
