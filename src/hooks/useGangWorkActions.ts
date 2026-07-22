import type { Dispatch, SetStateAction } from 'react';
import { applyWorkFatigue } from '../lib/gangActivity';
import {
  addMemberLoyalty,
  awardMemberActivity,
  calculateFarmingYield,
  markMembersWorking,
  type GangMember,
  type MemberTrainingPlan,
} from '../lib/gangMembers';
import type { GangData } from '../lib/gangState';
import {
  GANG_PROCESSING_RECIPES,
  calculateMaxProcessingBatches,
  calculateMiningResult,
  calculateTransportResult,
  type GangProcessingType,
  type GangWorkType,
} from '../lib/gangWork';
import { appendLog } from '../lib/gangLocalState';
import { applyRemoteGangData } from '../lib/gangLocalState';
import { processGangMaterial, sellGangMaterial, syncGangState } from '../lib/platformApi';

const RAID_CHANCE = 0.05;
export type SellableGangMaterial = 'blue' | 'gunpowder' | 'steel';
type Currency = 'clean' | 'dirty';

type Options = {
  busy: boolean;
  availableMembers: GangMember[];
  gangData: GangData;
  maxMembers: number;
  timeFarm: number;
  transportMembers: number;
  cashBalance: number;
  baniMurdari: number;
  setGangData: Dispatch<SetStateAction<GangData>>;
  setTimeFarm: Dispatch<SetStateAction<number>>;
  setCashBalance: Dispatch<SetStateAction<number>>;
  setBaniMurdari: Dispatch<SetStateAction<number>>;
  runActivityPresentation: (type: GangWorkType, participantCount: number, complete: () => Promise<string> | string) => Promise<void>;
  pushPopup: (message: string) => void;
  playerId: string | null;
};

function randomCrew(members: GangMember[], count: number) {
  return [...members].sort(() => Math.random() - 0.5).slice(0, Math.max(0, Math.min(count, members.length)));
}

function trainAndFatigue(
  members: GangMember[],
  ids: string[],
  training: MemberTrainingPlan,
  xp: number,
  workType: string,
) {
  const trained = awardMemberActivity(members, ids, training, xp);
  return applyWorkFatigue(trained, ids, workType);
}

function addFatigueLog(data: GangData, names: string[]) {
  if (names.length === 0) return data;
  const label = names.length === 1 ? names[0] : `${names.length} members`;
  return appendLog(data, `${label} lost 5% loyalty from repeated work.`, 'warning');
}

export function useGangWorkActions(options: Options) {
  const {
    busy, availableMembers, gangData, maxMembers, transportMembers,
    cashBalance, baniMurdari, setGangData, setTimeFarm, setCashBalance,
    setBaniMurdari, runActivityPresentation, pushPopup, playerId,
  } = options;

  const startCollection = async () => {
    if (busy || availableMembers.length === 0) return;
    const count = Math.max(1, Math.floor(availableMembers.length * (0.55 + Math.random() * 0.45)));
    const participants = randomCrew(availableMembers, count);
    const ids = participants.map((member) => member.id);
    const reward = calculateFarmingYield(participants);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));

    await runActivityPresentation('collect', ids.length, () => {
      const raid = Math.random() < RAID_CHANCE;
      setTimeFarm((current) => current + 1);
      setGangData((current) => {
        const fatigue = trainAndFatigue(current.members, ids, { primary: 'farming', secondary: 'leadership' }, raid ? 5 : 18, 'collect');
        let next: GangData = {
          ...current,
          frunze: raid ? current.frunze : current.frunze + reward.total,
          onlineNow: 0,
          members: fatigue.members,
        };
        next = appendLog(next, raid ? 'Police raid: current Leaves harvest lost.' : `+${reward.total.toLocaleString('en-US')} Leaves.`, raid ? 'negative' : 'positive');
        return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
      });
      const text = raid ? 'Police raid. Current harvest lost.' : `+${reward.total.toLocaleString('en-US')} Leaves`;
      pushPopup(text);
      return text;
    });
  };

  const startMining = async () => {
    if (busy || availableMembers.length === 0) return;
    const participants = randomCrew(availableMembers, Math.max(1, Math.ceil(availableMembers.length * 0.6)));
    const ids = participants.map((member) => member.id);
    const reward = calculateMiningResult();
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));

    await runActivityPresentation('mining', ids.length, () => {
      const raid = Math.random() < RAID_CHANCE;
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => {
        const fatigue = trainAndFatigue(current.members, ids, { primary: 'farming', secondary: 'streetSmart' }, raid ? 5 : 16, 'mining');
        let next: GangData = {
          ...current,
          sulfur: raid ? current.sulfur : current.sulfur + reward.sulfur,
          ironOre: raid ? current.ironOre : current.ironOre + reward.ironOre,
          onlineNow: 0,
          members: fatigue.members,
        };
        next = appendLog(next, raid ? 'Police raid: current mining haul lost.' : `+${reward.sulfur} Sulfur, +${reward.ironOre} Iron Ore.`, raid ? 'negative' : 'positive');
        return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
      });
      const text = raid ? 'Police raid. Current haul lost.' : `+${reward.sulfur} Sulfur, +${reward.ironOre} Iron Ore`;
      pushPopup(text);
      return text;
    });
  };

  const startTransport = async () => {
    if (busy || availableMembers.length === 0) return;
    const participants = randomCrew(availableMembers, Math.min(transportMembers, availableMembers.length));
    const ids = participants.map((member) => member.id);
    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));

    await runActivityPresentation('transport', ids.length, () => {
      const result = calculateTransportResult(participants, maxMembers, gangData.levelIndex);
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => {
        const trained = awardMemberActivity(current.members, ids, { primary: 'streetSmart', secondary: 'tactics' }, 24);
        const loyal = addMemberLoyalty(trained, ids, result.loyaltyGain);
        const fatigue = applyWorkFatigue(loyal, ids, 'transport');
        let next: GangData = {
          ...current,
          dirtyBalance: Math.max(0, current.dirtyBalance + result.netPayout),
          dirtyEarned: current.dirtyEarned + Math.max(0, result.netPayout),
          onlineNow: 0,
          members: fatigue.members,
        };
        const sign = result.netPayout >= 0 ? '+' : '-';
        next = appendLog(next, `${result.qualityLabel}: ${sign}${Math.abs(result.netPayout).toLocaleString('en-US')} dirty, +${result.loyaltyGain}% loyalty.`, result.netPayout >= 0 ? 'positive' : 'negative');
        return addFatigueLog(next, fatigue.penalized.map((member) => member.displayName));
      });
      const text = `${result.netPayout >= 0 ? '+' : '-'}${Math.abs(result.netPayout).toLocaleString('en-US')} dirty, +${result.loyaltyGain}% loyalty`;
      pushPopup(text);
      return text;
    });
  };

  const startProcessing = async (type: GangProcessingType, requestedBatches: number) => {
    if (busy || availableMembers.length === 0 || !playerId) return;
    const maximum = calculateMaxProcessingBatches(type, gangData, gangData.dirtyBalance);
    const batches = Math.max(0, Math.min(maximum, Math.floor(requestedBatches)));
    if (batches <= 0) {
      pushPopup('Not enough materials or Gang dirty cash.');
      return;
    }
    const recipe = GANG_PROCESSING_RECIPES[type];
    const outputAmount = recipe.outputPerBatch * batches;
    const participants = randomCrew(availableMembers, Math.max(1, Math.ceil(availableMembers.length * 0.5)));
    const ids = participants.map((member) => member.id);

    setGangData((current) => ({ ...current, onlineNow: ids.length, members: markMembersWorking(current.members, ids) }));

    await runActivityPresentation(type, ids.length, async () => {
      await syncGangState(playerId, gangData);
      const result = await processGangMaterial(playerId, type, batches, `process_${crypto.randomUUID().replace(/-/g, '')}`);
      const raid = result.raided;
      setTimeFarm((current) => current + 0.5);
      setGangData((current) => applyRemoteGangData({ ...current, onlineNow: 0 }, result.gang));
      const text = raid ? 'Police raid. Current batch lost.' : `+${outputAmount.toLocaleString('en-US')} ${recipe.output}`;
      pushPopup(text);
      return text;
    });
  };

  const sellMaterial = async (type: SellableGangMaterial, requestedQuantity: number) => {
    if (busy || !playerId) return;
    const quantity = Math.max(0, Math.min(gangData[type], Math.floor(requestedQuantity)));
    if (quantity <= 0) return;
    try {
      await syncGangState(playerId, gangData);
      const result = await sellGangMaterial(playerId, type, quantity, `sell_${crypto.randomUUID().replace(/-/g, '')}`);
      setGangData((current) => applyRemoteGangData(current, result.gang));
      pushPopup(`+${result.payout.toLocaleString('en-US')} dirty`);
    } catch (error) {
      pushPopup(error instanceof Error ? error.message : 'Gang sell failed.');
    }
  };

  const deposit = (currency: Currency, amount: number) => {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return;
    if (currency === 'clean' && safeAmount <= cashBalance) {
      setCashBalance((current) => current - safeAmount);
      setGangData((current) => appendLog({ ...current, cleanBalance: current.cleanBalance + safeAmount }, `Deposited ${safeAmount.toLocaleString('en-US')} clean.`, 'neutral'));
    }
    if (currency === 'dirty' && safeAmount <= baniMurdari) {
      setBaniMurdari((current) => current - safeAmount);
      setGangData((current) => appendLog({ ...current, dirtyBalance: current.dirtyBalance + safeAmount }, `Deposited ${safeAmount.toLocaleString('en-US')} dirty.`, 'neutral'));
    }
  };

  const withdraw = (currency: Currency, amount: number) => {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0) return;
    if (currency === 'clean' && safeAmount <= gangData.cleanBalance) {
      setCashBalance((current) => current + safeAmount);
      setGangData((current) => appendLog({ ...current, cleanBalance: current.cleanBalance - safeAmount }, `Withdrew ${safeAmount.toLocaleString('en-US')} clean.`, 'neutral'));
    }
    if (currency === 'dirty' && safeAmount <= gangData.dirtyBalance) {
      setBaniMurdari((current) => current + safeAmount);
      setGangData((current) => appendLog({ ...current, dirtyBalance: current.dirtyBalance - safeAmount }, `Withdrew ${safeAmount.toLocaleString('en-US')} dirty.`, 'neutral'));
    }
  };

  const launder = (amount: number) => {
    const safeAmount = Math.max(0, Math.floor(amount));
    if (safeAmount <= 0 || safeAmount > gangData.dirtyBalance) return;
    const cleanGain = Math.floor(safeAmount * 0.65);
    setGangData((current) => appendLog({
      ...current,
      dirtyBalance: current.dirtyBalance - safeAmount,
      cleanBalance: current.cleanBalance + cleanGain,
    }, `Laundered ${safeAmount.toLocaleString('en-US')} dirty into ${cleanGain.toLocaleString('en-US')} clean.`, 'neutral'));
    pushPopup(`+${cleanGain.toLocaleString('en-US')} clean`);
  };

  return { startCollection, startMining, startTransport, startProcessing, sellMaterial, deposit, withdraw, launder };
}
