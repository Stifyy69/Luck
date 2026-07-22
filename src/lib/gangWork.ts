import type { GangMember } from './gangMembers';

export type GangWorkType = 'collect' | 'white' | 'blue' | 'mining' | 'gunpowder' | 'steel' | 'transport';
export type GangWorkCategory = 'production' | 'mining' | 'combat';
export type GangProcessingType = 'white' | 'blue' | 'gunpowder' | 'steel';

export type TransportResult = {
  grossPayout: number;
  operatingCost: number;
  policeIncidents: number;
  policePenalty: number;
  netPayout: number;
  loyaltyGain: number;
  qualityLabel: string;
};

export type MiningResult = { sulfur: number; ironOre: number };

export type GangProcessingRecipe = {
  input: 'frunze' | 'white' | 'sulfur' | 'ironOre';
  inputPerBatch: number;
  output: 'white' | 'blue' | 'gunpowder' | 'steel';
  outputPerBatch: number;
  dirtyCostPerBatch: number;
};

export const GANG_PROCESSING_RECIPES: Record<GangProcessingType, GangProcessingRecipe> = {
  white: { input: 'frunze', inputPerBatch: 1200, output: 'white', outputPerBatch: 400, dirtyCostPerBatch: 900_000 },
  blue: { input: 'white', inputPerBatch: 400, output: 'blue', outputPerBatch: 800, dirtyCostPerBatch: 100_000 },
  gunpowder: { input: 'sulfur', inputPerBatch: 5, output: 'gunpowder', outputPerBatch: 1, dirtyCostPerBatch: 0 },
  steel: { input: 'ironOre', inputPerBatch: 5, output: 'steel', outputPerBatch: 1, dirtyCostPerBatch: 0 },
};

export const GANG_WORK_STAGES: Record<GangWorkType, string[]> = {
  collect: ['Crew moving to the fields', 'Leaves being collected', 'Harvest returning to storage'],
  white: ['Leaves prepared', 'White packs processed', 'Batch secured'],
  blue: ['White packs prepared', 'Blue packs processed', 'Batch secured'],
  mining: ['Divers entering the extraction zone', 'Sulfur and iron ore recovered', 'Haul returning to storage'],
  gunpowder: ['Sulfur measured', 'Gunpowder processed', 'Batch sealed'],
  steel: ['Iron ore prepared', 'Steel processed', 'Batch cooling'],
  transport: ['Cargo loaded', 'Convoy crossing the city', 'Final checkpoint cleared'],
};

export const GANG_WORK_LABELS: Record<GangWorkType, { title: string; subtitle: string; gameTime: string }> = {
  collect: { title: 'Gang leaf farm', subtitle: 'Leaves are being collected.', gameTime: '+1h' },
  white: { title: 'White processing', subtitle: 'Selected Leaves are being processed.', gameTime: '+30m' },
  blue: { title: 'Blue processing', subtitle: 'Selected White Packs are being processed.', gameTime: '+30m' },
  mining: { title: 'Diver Miner', subtitle: 'Sulfur and Iron Ore are being recovered.', gameTime: '+30m' },
  gunpowder: { title: 'Gunpowder processing', subtitle: 'Selected Sulfur is being processed.', gameTime: '+30m' },
  steel: { title: 'Steel processing', subtitle: 'Selected Iron Ore is being processed.', gameTime: '+30m' },
  transport: { title: 'Illegal Transport', subtitle: 'The convoy is moving illegal cargo.', gameTime: '+30m' },
};

function clamp(value: number, min: number, max: number) { return Math.max(min, Math.min(max, value)); }
function randomBetween(min: number, max: number) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return low + Math.floor(Math.random() * (high - low + 1));
}

export function calculateMiningResult(): MiningResult {
  return { sulfur: randomBetween(30, 70), ironOre: randomBetween(30, 70) };
}

export function calculateMaxProcessingBatches(type: GangProcessingType, storage: { frunze: number; white: number; sulfur: number; ironOre: number }, dirtyBalance: number) {
  const recipe = GANG_PROCESSING_RECIPES[type];
  const byMaterials = Math.floor(Math.max(0, storage[recipe.input]) / recipe.inputPerBatch);
  if (recipe.dirtyCostPerBatch <= 0) return byMaterials;
  return Math.min(byMaterials, Math.floor(Math.max(0, dirtyBalance) / recipe.dirtyCostPerBatch));
}

export function calculateTransportResult(participants: GangMember[], maxMembers: number, levelIndex: number): TransportResult {
  const count = Math.max(1, participants.length);
  const ratio = clamp((count - 1) / Math.max(1, maxMembers - 1), 0, 1);
  const level = Math.max(0, Math.min(3, Math.floor(levelIndex)));
  const profiles = [
    { min: 100_000, max: 500_000, lossMin: 150_000, lossMax: 500_000 },
    { min: 250_000, max: 1_200_000, lossMin: 200_000, lossMax: 650_000 },
    { min: 600_000, max: 2_500_000, lossMin: 250_000, lossMax: 800_000 },
    { min: 1_500_000, max: 5_000_000, lossMin: 0, lossMax: 0 },
  ];
  const profile = profiles[level];
  const minimumPayout = Math.round(profile.min + (profile.max - profile.min) * ratio * 0.35);
  const maximumPayout = Math.round(profile.min + (profile.max - profile.min) * Math.max(0.25, ratio));
  const grossPayout = randomBetween(minimumPayout, Math.max(minimumPayout, maximumPayout));
  const averageStreetSmart = participants.reduce((sum, member) => sum + member.skills.streetSmart, 0) / count;
  const averageTactics = participants.reduce((sum, member) => sum + member.skills.tactics, 0) / count;
  const skillProtection = (averageStreetSmart + averageTactics) / 4000;
  const exposureRisk = clamp(0.05 + count * 0.006 - skillProtection - level * 0.012, 0.02, 0.18);
  let policeIncidents = 0;
  participants.forEach(() => { if (Math.random() < exposureRisk) policeIncidents += 1; });
  policeIncidents = Math.min(policeIncidents, Math.max(1, Math.ceil(count / 3)));
  const policePenalty = policeIncidents * 100_000;
  const operatingCost = level < 3 ? grossPayout + randomBetween(profile.lossMin, profile.lossMax) : Math.round(grossPayout * (randomBetween(12, 35) / 100));
  const rawNetPayout = grossPayout - operatingCost - policePenalty;
  const netPayout = level === 3 ? Math.max(100_000, rawNetPayout) : rawNetPayout;
  const quality = clamp(grossPayout / Math.max(1, maximumPayout), 0, 1) * 0.65 + clamp(1 - policeIncidents / count, 0, 1) * 0.35;
  const loyaltyGain = Math.round(clamp(5 + quality * 10, 5, 15));
  const qualityLabel = loyaltyGain >= 13 ? 'Excellent run' : loyaltyGain >= 9 ? 'Solid run' : 'Risky run';
  return { grossPayout, operatingCost, policeIncidents, policePenalty, netPayout, loyaltyGain, qualityLabel };
}

export function gangStockValue(storage: { frunze: number; white: number; blue: number; sulfur: number; ironOre: number; gunpowder: number; steel: number }) {
  return Math.floor(storage.frunze * 100 + storage.white * 900 + storage.blue * 2300 + storage.sulfur * 1000 + storage.ironOre * 1200 + storage.gunpowder * 5000 + storage.steel * 6000);
}
