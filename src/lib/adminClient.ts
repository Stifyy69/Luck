import type { VipTier } from './platformApi';
import type { AdminAction, AdminOverviewResponse, AdminPlayerDetail, AdminPlayerFilters, AdminPlayersResponse } from './adminTypes';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(String(payload?.error || payload?.message || 'Admin request failed'));
  return payload as T;
}

export const adminLogin = (username: string, credential: string) => request<{ ok: true }>('/api/adminpanelv2/login', {
  method: 'POST',
  body: JSON.stringify({ username, ['pass' + 'word']: credential }),
});

export const adminLogout = () => request<{ ok: true }>('/api/adminpanelv2/logout', { method: 'POST' });
export const fetchAdminOverview = () => request<AdminOverviewResponse>('/api/adminpanelv3/overview');
export const fetchAdminAudit = () => request<{ actions: AdminAction[] }>('/api/adminpanelv3/audit?limit=150');
export const fetchAdminPlayerDetail = (playerId: string) => request<AdminPlayerDetail>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}`);

export function fetchAdminPlayers(filters: AdminPlayerFilters) {
  const params = new URLSearchParams({
    search: filters.search,
    accountOnly: String(filters.accountOnly),
    onlineOnly: String(filters.onlineOnly),
    vipOnly: String(filters.vipOnly),
    gangOnly: String(filters.gangOnly),
    minLevel: filters.minLevel,
    maxLevel: filters.maxLevel,
    minCityXp: filters.minCityXp,
    maxCityXp: filters.maxCityXp,
    minMoney: filters.minMoney,
    maxMoney: filters.maxMoney,
    minNetWorth: filters.minNetWorth,
    maxNetWorth: filters.maxNetWorth,
    minEarnings: filters.minEarnings,
    maxEarnings: filters.maxEarnings,
    minCareer: filters.minCareer,
    maxCareer: filters.maxCareer,
    minTime: filters.minTime,
    maxTime: filters.maxTime,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    page: String(filters.page),
    pageSize: String(filters.pageSize),
  });
  return request<AdminPlayersResponse>(`/api/adminpanelv3/players?${params}`);
}

export type AdminNumericField = 'cleanMoney' | 'flowCoins' | 'rouletteFragments' | 'vehicleSlotsExtra' | 'cityXp' | 'pizzerLevel' | 'pizzerXp' | 'pizzerDeliveries' | 'fisherLevel' | 'fisherXp' | 'fisherCatches' | 'pilotLevel' | 'pilotXp' | 'pilotFlights';

export function updateAdminNumeric(playerId: string, field: AdminNumericField, mode: 'add' | 'set', value: number) {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/numeric`, {
    method: 'POST',
    body: JSON.stringify({ field, mode, value }),
  });
}

export function updateAdminProfile(playerId: string, displayName: string) {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/profile`, {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
}

export function grantAdminItem(playerId: string, itemType: string, quantity: number) {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/item`, {
    method: 'POST',
    body: JSON.stringify({ itemType, quantity }),
  });
}

export function grantAdminMythicMember(playerId: string, name: string) {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/gang/mythic`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function setAdminVip(playerId: string, tier: VipTier | 'NONE') {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/vip`, {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export function resetAdminTutorial(playerId: string) {
  return request<{ ok: true; detail: AdminPlayerDetail }>(`/api/adminpanelv3/players/${encodeURIComponent(playerId)}/tutorial/reset`, {
    method: 'POST',
  });
}
