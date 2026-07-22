export interface CityOnboardingState {
  dismissedAt: number | null;
}

const ONBOARDING_PREFIX = 'cityflow_onboarding_v1';

function storageKey(playerId: string) {
  return `${ONBOARDING_PREFIX}:${playerId}`;
}

export function readCityOnboarding(playerId: string): CityOnboardingState {
  if (!playerId || typeof window === 'undefined') return { dismissedAt: null };

  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) return { dismissedAt: null };
    const parsed = JSON.parse(raw);
    return {
      dismissedAt: typeof parsed?.dismissedAt === 'number' ? parsed.dismissedAt : null,
    };
  } catch {
    return { dismissedAt: null };
  }
}

export function dismissCityOnboarding(playerId: string) {
  if (!playerId || typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(playerId), JSON.stringify({ dismissedAt: Date.now() }));
}
