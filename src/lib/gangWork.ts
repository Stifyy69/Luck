import type { GangMember } from './gangMembers';

export type GangWorkType = 'collect' | 'white' | 'blue' | 'mining' | 'gunpowder' | 'steel' | 'transport';

export type TransportResult = {
  grossPayout: number;
  policeIncidents: number;
  policePenalty: number;
  netPayout: number;
  loyaltyGain: number;
  qualityLabel: string;
};

export type MiningResult = {
  sulfur: number;
  ironOre: number;
};

export const GANG_WORK_STAGES: Record<GangWorkType, string[]> = {
  collect: ['Crew is moving to the fields', 'Leaves are being collected', 'The harvest is returning to storage'],
  white: ['Leaves are being prepared', 'White packs are being processed', 'The batch is being secured'],
  blue: ['White packs are being prepared', 'Blue packs are being processed', 'The batch is being secured'],
  mining: ['Divers are entering the extraction zone', 'Sulfur and iron ore are being recovered', 'The haul is returning to storage'],
  gunpowder: ['Sulfur is being measured', 'Gunpowder is being processed', 'The batch is being sealed'],
  steel: ['Iron ore is being prepared', 'Steel is being processed', 'The batch is cooling'],
  transport: ['The illegal cargo is being loaded', 'The convoy is crossing the city', 'The crew is clearing the final checkpoint'],
};

export const GANG_WORK_LABELS: Record<GangWorkType, { title: string; subtitle: string; gameTime: string }> = {
  collect: { title: 'Gang leaf farm', subtitle: 'Farming and Leadership affect the final harvest.', gameTime: '+1h game time' },
  white: { title: 'White processing', subtitle: 'The selected batch is at risk until processing finishes.', gameTime: '+30m game time' },
  blue: { title: 'Blue processing', subtitle: 'The selected batch is at risk until processing finishes.', gameTime: '+30m game time' },
  mining: { title: 'Diver Miner', subtitle: 'Recover sulfur and iron ore from the extraction zone.', gameTime: '+30m game time' },
  gunpowder: { title: 'Gunpowder processing', subtitle: 'Five sulfur become one gunpowder.', gameTime: '+30m game time' },
  steel: { title: 'Steel processing', subtitle: 'Five iron ore become one steel.', gameTime: '+30m game time' },
  transport: { title: 'Illegal Transport', subtitle: 'More members increase the possible payout and police exposure.', gameTime: '+30m game time' },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min: number, max: number) {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  return low + Math.floor(Math.random() * (high - low + 1));
}

export function calculateMiningResult(): MiningResult {
  return {
    sulfur: randomBetween(30, 70),
    ironOre: randomBetween(30, 70),
  };
}

export function calculateTransportResult(participants: GangMember[], maxMembers: number): TransportResult {
  const count = Math.max(1, participants.length);
  const ratio = clamp((count - 1) / Math.max(1, maxMembers - 1), 0, 1);
  const minimumPayout = Math.round(100_000 + 1_400_000 * ratio);
  const maximumPayout = Math.round(500_000 + 4_500_000 * ratio);
  const grossPayout = randomBetween(minimumPayout, Math.max(minimumPayout, maximumPayout));

  const averageStreetSmart = participants.reduce((sum, member) => sum + member.skills.streetSmart, 0) / count;
  const averageTactics = participants.reduce((sum, member) => sum + member.skills.tactics, 0) / count;
  const skillProtection = (averageStreetSmart + averageTactics) / 4000;
  const exposureRisk = clamp(0.035 + count * 0.006 - skillProtection, 0.025, 0.18);
  let policeIncidents = 0;
  participants.forEach(() => {
    if (Math.random() < exposureRisk) policeIncidents += 1;
  });
  policeIncidents = Math.min(policeIncidents, Math.max(1, Math.ceil(count / 3)));

  const policePenalty = policeIncidents * 100_000;
  const netPayout = grossPayout - policePenalty;
  const payoutQuality = clamp(grossPayout / Math.max(1, maximumPayout), 0, 1);
  const safetyQuality = clamp(1 - policeIncidents / count, 0, 1);
  const quality = payoutQuality * 0.7 + safetyQuality * 0.3;
  const loyaltyGain = Math.round(clamp(5 + quality * 10, 5, 15));
  const qualityLabel = loyaltyGain >= 13 ? 'Excellent run' : loyaltyGain >= 9 ? 'Solid run' : 'Risky run';

  return {
    grossPayout,
    policeIncidents,
    policePenalty,
    netPayout,
    loyaltyGain,
    qualityLabel,
  };
}

export function gangStockValue(storage: {
  frunze: number;
  white: number;
  blue: number;
  sulfur: number;
  ironOre: number;
  gunpowder: number;
  steel: number;
}) {
  return Math.floor(
    storage.frunze * 100
    + storage.white * 900
    + storage.blue * 2300
    + storage.sulfur * 1000
    + storage.ironOre * 1200
    + storage.gunpowder * 5000
    + storage.steel * 6000,
  );
}
