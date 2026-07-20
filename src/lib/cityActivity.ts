export type CityActivityIcon = 'pizza' | 'plane' | 'fish' | 'car' | 'inventory' | 'wallet' | 'star';
export type CityActivityTone = 'accent' | 'money' | 'info' | 'warning' | 'danger';

export interface CityActivityEntry {
  id: string;
  dedupeKey: string;
  icon: CityActivityIcon;
  tone: CityActivityTone;
  title: string;
  detail: string;
  amount?: number;
  xp?: number;
  createdAt: number;
}

export interface NewCityActivityEntry {
  dedupeKey: string;
  icon: CityActivityIcon;
  tone: CityActivityTone;
  title: string;
  detail: string;
  amount?: number;
  xp?: number;
  createdAt?: number;
}

const ACTIVITY_PREFIX = 'cityflow_activity_v1';
const ACTIVITY_EVENT = 'cityflow-activity-changed';
const MAX_ACTIVITY_ITEMS = 30;

function storageKey(playerId: string) {
  return `${ACTIVITY_PREFIX}:${playerId}`;
}

export function readCityActivity(playerId: string): CityActivityEntry[] {
  if (!playerId || typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((entry): entry is CityActivityEntry => Boolean(entry && typeof entry.id === 'string' && typeof entry.createdAt === 'number'))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, MAX_ACTIVITY_ITEMS);
  } catch {
    return [];
  }
}

export function recordCityActivity(playerId: string, entry: NewCityActivityEntry): CityActivityEntry[] {
  if (!playerId || typeof window === 'undefined') return [];

  const current = readCityActivity(playerId);
  if (current.some((item) => item.dedupeKey === entry.dedupeKey)) return current;

  const createdAt = entry.createdAt ?? Date.now();
  const nextEntry: CityActivityEntry = {
    ...entry,
    createdAt,
    id: `${entry.dedupeKey}:${createdAt}`,
  };
  const next = [nextEntry, ...current].slice(0, MAX_ACTIVITY_ITEMS);

  try {
    window.localStorage.setItem(storageKey(playerId), JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: { playerId } }));
  } catch {
    return current;
  }

  return next;
}

export function subscribeCityActivity(playerId: string, callback: () => void) {
  if (typeof window === 'undefined') return () => {};

  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ playerId?: string }>).detail;
    if (!detail?.playerId || detail.playerId === playerId) callback();
  };

  window.addEventListener(ACTIVITY_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(ACTIVITY_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
