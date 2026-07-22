import { migrateGangActivityLog, prependGangActivityLog, type GangActivityLogTone } from './gangActivity';
import { migrateBattleHistory } from './gangBattles';
import { createRecruitmentBoard, decayDismissalPressure, migrateGangMembers } from './gangMembers';
import { getGangLevel, normalizeGangLevelIndex } from './gangProgression';
import type { GangData } from './gangState';
import type { ServerGangState } from './platformApi';

const GAME_KEY = 'luck_game_state_v1';
const GAME_SALT = 'stifyy-ogromania-salt';

function signPayload(payload: unknown) {
  const raw = JSON.stringify(payload) + GAME_SALT;
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  return String(hash);
}

export function loadGameState(): Record<string, any> | null {
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

export function saveGameState(data: unknown) {
  try {
    localStorage.setItem(GAME_KEY, JSON.stringify({ data, sig: signPayload(data) }));
  } catch {}
}

function safeNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function buildInitialGangData(saved: any): GangData {
  const raw = saved?.gangData && typeof saved.gangData === 'object' ? saved.gangData : {};
  const dirtyEarned = Math.max(0, safeNumber(raw.dirtyEarned));
  const levelIndex = normalizeGangLevelIndex(raw.levelIndex ?? raw.gangLevelIndex, dirtyEarned);
  const members = migrateGangMembers(raw.members);
  const maxMembers = getGangLevel(levelIndex).maxMembers;
  const formed = Boolean(String(raw.name || '').trim());
  const savedBoard = migrateGangMembers(raw.recruitmentBoard).filter((member) => member.rarity !== 'MYTHIC' && member.source !== 'ADMIN_EVENT');
  return {
    stateVersion: Math.max(0, Math.floor(safeNumber(raw.stateVersion))),
    name: String(raw.name || '').slice(0, 48),
    levelIndex,
    members,
    recruitmentBoard: formed && members.length < maxMembers ? (savedBoard.length >= 3 ? savedBoard.slice(0, 3) : createRecruitmentBoard(members, 3)) : [],
    frunze: Math.max(0, safeNumber(raw.frunze ?? raw.leaves)),
    white: Math.max(0, safeNumber(raw.white ?? raw.whitePacks)),
    blue: Math.max(0, safeNumber(raw.blue ?? raw.bluePacks)),
    sulfur: Math.max(0, safeNumber(raw.sulfur)),
    ironOre: Math.max(0, safeNumber(raw.ironOre)),
    gunpowder: Math.max(0, safeNumber(raw.gunpowder)),
    steel: Math.max(0, safeNumber(raw.steel)),
    cleanBalance: Math.max(0, safeNumber(raw.cleanBalance)),
    dirtyBalance: Math.max(0, safeNumber(raw.dirtyBalance)),
    dirtyEarned,
    lastLeaveAt: Math.max(0, safeNumber(raw.lastLeaveAt, Date.now())),
    onlineNow: Math.max(0, safeNumber(raw.onlineNow)),
    dismissalPressure: decayDismissalPressure(Math.max(0, safeNumber(raw.dismissalPressure)), Math.max(0, safeNumber(raw.lastDismissalAt))),
    lastDismissalAt: Math.max(0, safeNumber(raw.lastDismissalAt)),
    removedEventMemberIds: Array.isArray(raw.removedEventMemberIds) ? raw.removedEventMemberIds.map(String).slice(0, 100) : [],
    serverUpdatedAt: raw.serverUpdatedAt ? String(raw.serverUpdatedAt) : null,
    activityLog: migrateGangActivityLog(raw.activityLog),
    battleHistory: migrateBattleHistory(raw.battleHistory),
    battleReputation: Math.max(0, safeNumber(raw.battleReputation)),
    defensiveCrewIds: Array.isArray(raw.defensiveCrewIds) ? raw.defensiveCrewIds.map(String).slice(0, 5) : [],
    battleBoardSeed: Math.max(1, Math.floor(safeNumber(raw.battleBoardSeed, 1))),
  };
}

export function applyRemoteGangData(current: GangData, remote: ServerGangState | Record<string, any>): GangData {
  const raw = remote as Record<string, any>;
  const remoteVersion = Math.max(0, Math.floor(safeNumber(remote.stateVersion, current.stateVersion)));
  if (remoteVersion < current.stateVersion) return current;
  const members = migrateGangMembers(remote.members);
  const levelIndex = normalizeGangLevelIndex(remote.gangLevelIndex ?? raw.levelIndex, remote.dirtyEarned ?? raw.dirtyEarned);
  const maxMembers = getGangLevel(levelIndex).maxMembers;
  const memberIds = new Set(members.map((member) => member.id));
  const removedEventMemberIds = new Set(current.removedEventMemberIds);
  const filteredMembers = members.filter((member) => !removedEventMemberIds.has(member.id));
  const board = filteredMembers.length >= maxMembers ? [] : current.recruitmentBoard.length >= 3 ? current.recruitmentBoard.slice(0, 3) : createRecruitmentBoard(filteredMembers, 3);

  return {
    ...current,
    stateVersion: remoteVersion,
    name: String(remote.name ?? current.name).slice(0, 48),
    levelIndex,
    members: filteredMembers,
    recruitmentBoard: board,
    frunze: Math.max(0, safeNumber(remote.leaves ?? raw.frunze, 0)),
    white: Math.max(0, safeNumber(remote.whitePacks ?? raw.white, 0)),
    blue: Math.max(0, safeNumber(remote.bluePacks ?? raw.blue, 0)),
    sulfur: Math.max(0, safeNumber(remote.sulfur, 0)),
    ironOre: Math.max(0, safeNumber(remote.ironOre, 0)),
    gunpowder: Math.max(0, safeNumber(remote.gunpowder, 0)),
    steel: Math.max(0, safeNumber(remote.steel, 0)),
    cleanBalance: Math.max(0, safeNumber(remote.cleanBalance, 0)),
    dirtyBalance: Math.max(0, safeNumber(remote.dirtyBalance, 0)),
    dirtyEarned: Math.max(0, safeNumber(remote.dirtyEarned, 0)),
    onlineNow: Math.max(0, safeNumber(remote.activeWorkers ?? raw.onlineNow, 0)),
    dismissalPressure: Math.max(0, safeNumber(remote.dismissalPressure, 0)),
    lastDismissalAt: Math.max(0, safeNumber(remote.lastDismissalAt, 0)),
    activityLog: migrateGangActivityLog(remote.activityLog ?? []),
    battleHistory: migrateBattleHistory(remote.battleHistory ?? []),
    battleReputation: Math.max(0, safeNumber(remote.battleReputation, 0)),
    defensiveCrewIds: Array.isArray(remote.defensiveCrewIds) ? remote.defensiveCrewIds.map(String).filter((id: string) => memberIds.has(id)).slice(0, 5) : [],
    battleBoardSeed: Math.max(1, Math.floor(safeNumber(remote.battleBoardSeed, 1))),
    lastLeaveAt: Math.max(0, safeNumber(remote.lastLeaveAt, current.lastLeaveAt)),
    serverUpdatedAt: remote.updatedAt ? String(remote.updatedAt) : current.serverUpdatedAt,
  };
}

export function appendLog(data: GangData, message: string, tone: GangActivityLogTone = 'neutral'): GangData {
  return { ...data, activityLog: prependGangActivityLog(data.activityLog, message, tone) };
}

export function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}
