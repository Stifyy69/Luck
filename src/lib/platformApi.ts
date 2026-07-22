import type { GangActivityLogEntry } from './gangActivity';
import type { GangBattleHistoryEntry } from './gangBattles';
import type { GangMember } from './gangMembers';

export type VipTier = 'VIP_SILVER' | 'VIP_GOLD';
export type VipStatus = { active: boolean; tier: VipTier | null; label: string | null; expiresAt: string | null; startedAt: string | null; durationMs: number; remainingMs: number };
export type PlatformStatus = { vip: VipStatus };

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) }, credentials: options?.credentials || 'include' });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(payload?.error || payload?.message || 'Request failed'));
  return payload as T;
}

export async function fetchPlatformStatus(playerId: string) {
  const payload = await request<{ status: PlatformStatus }>(`/api/platform/status?${new URLSearchParams({ playerId })}`);
  return payload.status;
}

export type PlayerLeaderboardMetric = 'city_level' | 'wealth' | 'earnings' | 'cash' | 'career' | 'pizza' | 'fishing' | 'aviation' | 'fleet' | 'time';
export type GangLeaderboardMetric = 'dirty_earned' | 'members' | 'stock_value' | 'gang_level' | 'activity';
export type LeaderboardPlayer = { rank: number; playerId: string; username: string | null; displayName: string; cityLevel: number; cityXp: number; cleanMoney: number; fleetValue: number; netWorth: number; totalEarnings: number; careerScore: number; totalTimeHours: number; deliveries: number; catches: number; flights: number; pizzerLevel: number; fisherLevel: number; pilotLevel: number; vehicleCount: number; inventoryUnits: number; vipActive: boolean; lastSeen: string | null };
export type LeaderboardGang = { rank: number; playerId: string; ownerName: string; username: string; name: string; gangLevelIndex: number; gangLevel: string; cityLevel: number; membersCount: number; activeWorkers: number; leaves: number; whitePacks: number; bluePacks: number; dirtyEarned: number; stockValue: number; updatedAt: string | null };
export type PlayerLeaderboardResponse = { metric: PlayerLeaderboardMetric; metricLabel: string; summary: { totalAccounts: number; totalCleanMoney: number; totalEarnings: number; totalFleetValue: number; activeRecent: number }; players: LeaderboardPlayer[] };
export type GangLeaderboardResponse = { metric: GangLeaderboardMetric; metricLabel: string; summary: { totalGangs: number; totalMembers: number; totalDirtyEarned: number; totalStockValue: number; activeRecent: number }; gangs: LeaderboardGang[] };

export type ServerGangState = {
  playerId: string; name: string; gangLevelIndex: number; gangLevel: string; members: GangMember[]; membersCount: number; activeWorkers: number;
  leaves: number; whitePacks: number; bluePacks: number; sulfur: number; ironOre: number; gunpowder: number; steel: number;
  cleanBalance: number; dirtyBalance: number; dirtyEarned: number; stockValue: number; dismissalPressure: number; lastDismissalAt: number;
  activityLog: GangActivityLogEntry[]; battleHistory: GangBattleHistoryEntry[]; battleReputation: number; defensiveCrewIds: string[]; battleBoardSeed: number;
  lastLeaveAt: number; updatedAt: string | null;
};

export const fetchPlayerLeaderboard = (metric: PlayerLeaderboardMetric) => request<PlayerLeaderboardResponse>(`/api/leaderboards/players?${new URLSearchParams({ metric })}`);
export const fetchGangLeaderboard = (metric: GangLeaderboardMetric) => request<GangLeaderboardResponse>(`/api/leaderboards/gangs?${new URLSearchParams({ metric })}`);
export async function fetchGangState(playerId: string) { const payload = await request<{ gang: ServerGangState | null }>(`/api/gangs/state?${new URLSearchParams({ playerId })}`); return payload.gang; }
export function syncGangState(playerId: string, gangData: Record<string, unknown>) { return request<{ ok: true; gang: ServerGangState }>('/api/gangs/sync', { method: 'POST', body: JSON.stringify({ playerId, gangData }) }); }
export async function upgradeGangState(playerId: string) { const payload = await request<{ ok: true; gang: ServerGangState }>('/api/gangs/upgrade', { method: 'POST', body: JSON.stringify({ playerId }) }); return payload.gang; }
