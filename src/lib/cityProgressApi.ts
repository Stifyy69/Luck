import type { CityProgress, CityProgressReward } from './cityProgress';

const EVENT_NAME = 'city-progress-updated';

export type CityProgressEventDetail = {
  progress: CityProgress;
  reward?: CityProgressReward | null;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(String(payload?.error || payload?.message || 'City progress request failed'));
  }
  return payload as T;
}

export function publishCityProgress(progress: CityProgress, reward?: CityProgressReward | null) {
  window.dispatchEvent(new CustomEvent<CityProgressEventDetail>(EVENT_NAME, { detail: { progress, reward } }));
}

export function subscribeCityProgress(listener: (detail: CityProgressEventDetail) => void) {
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<CityProgressEventDetail>).detail;
    if (detail?.progress) listener(detail);
  };
  window.addEventListener(EVENT_NAME, handler as EventListener);
  return () => window.removeEventListener(EVENT_NAME, handler as EventListener);
}

export async function fetchCityProgress(playerId: string): Promise<CityProgress> {
  const payload = await request<{ progress: CityProgress }>(`/api/city/progress?${new URLSearchParams({ playerId })}`);
  publishCityProgress(payload.progress);
  return payload.progress;
}

async function tutorialAction(playerId: string, action: 'advance' | 'complete' | 'skip' | 'replay', step?: number) {
  const payload = await request<{ progress: CityProgress }>(`/api/city/tutorial/${action}`, {
    method: 'POST',
    body: JSON.stringify({ playerId, ...(typeof step === 'number' ? { step } : {}) }),
  });
  publishCityProgress(payload.progress);
  return payload.progress;
}

export const advanceCityTutorial = (playerId: string, step?: number) => tutorialAction(playerId, 'advance', step);
export const completeCityTutorial = (playerId: string) => tutorialAction(playerId, 'complete');
export const skipCityTutorial = (playerId: string) => tutorialAction(playerId, 'skip');
export const replayCityTutorial = (playerId: string) => tutorialAction(playerId, 'replay');

export async function awardCayoCityXp(playerId: string, stage: 'COLLECT' | 'PROCESS' | 'REFINE', eventId: string) {
  const payload = await request<{ progress: CityProgress; cityReward: CityProgressReward }>(`/api/city/cayo/complete`, {
    method: 'POST',
    body: JSON.stringify({ playerId, stage, eventId }),
  });
  publishCityProgress(payload.progress, payload.cityReward);
  return payload;
}
