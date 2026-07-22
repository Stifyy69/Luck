export type GangLevelIndex = 0 | 1 | 2 | 3;

export type GangLevelDefinition = {
  index: GangLevelIndex;
  name: string;
  maxMembers: number;
};

export type GangUpgradeCost = {
  from: GangLevelIndex;
  to: GangLevelIndex;
  dirtyCash: number;
  leaves: number;
  white: number;
  blue: number;
};

export const GANG_LEVELS: GangLevelDefinition[] = [
  { index: 0, name: 'Nerecunoscut', maxMembers: 10 },
  { index: 1, name: 'Recunoscut', maxMembers: 15 },
  { index: 2, name: 'Neoficiala', maxMembers: 24 },
  { index: 3, name: 'Oficiala', maxMembers: 34 },
];

export const GANG_UPGRADE_COSTS: GangUpgradeCost[] = [
  { from: 0, to: 1, dirtyCash: 300_000_000, leaves: 10_000, white: 10_000, blue: 10_000 },
  { from: 1, to: 2, dirtyCash: 1_000_000_000, leaves: 50_000, white: 50_000, blue: 50_000 },
  { from: 2, to: 3, dirtyCash: 10_000_000_000, leaves: 200_000, white: 200_000, blue: 200_000 },
];

function clampLevel(value: number): GangLevelIndex {
  return Math.max(0, Math.min(3, Math.floor(Number.isFinite(value) ? value : 0))) as GangLevelIndex;
}

export function inferLegacyGangLevel(dirtyEarned: number): GangLevelIndex {
  if (dirtyEarned >= 10_000_000_000) return 3;
  if (dirtyEarned >= 1_000_000_000) return 2;
  if (dirtyEarned >= 300_000_000) return 1;
  return 0;
}

export function normalizeGangLevelIndex(value: unknown, dirtyEarned = 0): GangLevelIndex {
  const parsed = Number(value);
  if (Number.isFinite(parsed)) return clampLevel(parsed);
  return inferLegacyGangLevel(dirtyEarned);
}

export function getGangLevel(index: number) {
  return GANG_LEVELS[clampLevel(index)];
}

export function getGangUpgradeCost(index: number) {
  const levelIndex = clampLevel(index);
  return GANG_UPGRADE_COSTS.find((cost) => cost.from === levelIndex) || null;
}

export function canAffordGangUpgrade(
  cost: GangUpgradeCost | null,
  balances: { dirtyBalance: number; frunze: number; white: number; blue: number },
) {
  if (!cost) return false;
  return balances.dirtyBalance >= cost.dirtyCash
    && balances.frunze >= cost.leaves
    && balances.white >= cost.white
    && balances.blue >= cost.blue;
}
