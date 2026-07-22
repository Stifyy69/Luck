import type { GangRecipe, GangResource, GangState } from '../types/gang';
import { getPlayerId } from './gameSync';

type GangResponse = { state: GangState; stateVersion: number; idempotentReplay?: boolean };

async function request(path: string, init?: RequestInit): Promise<GangResponse> {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'Serverul gang nu este disponibil.');
  return payload;
}

export const gangApi = {
  load: () => request(`/api/gangs/state/${encodeURIComponent(getPlayerId())}`),
  bootstrap: (state: Partial<GangState>) => request('/api/gangs/bootstrap', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: getPlayerId(), state }),
  }),
  sell: (material: Extract<GangResource, 'blue' | 'gunpowder' | 'steel'>, quantity: number | 'all', operationId: string) => request('/api/gangs/sell', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: getPlayerId(), material, quantity, operationId }),
  }),
  process: (recipe: GangRecipe, batches: number, operationId: string) => request('/api/gangs/process', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playerId: getPlayerId(), recipe, batches, operationId }),
  }),
};

export function operationId(type: string) {
  return `${type}_${crypto.randomUUID().replace(/-/g, '')}`;
}
